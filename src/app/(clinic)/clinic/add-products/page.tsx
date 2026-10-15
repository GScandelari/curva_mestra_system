'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Plus, Trash2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { calcularQuantidadeInventario } from '@/lib/services/inventoryService';
import {
  formatNFLabel,
  maskCnpjInput,
  normalizeLeadingZeros,
  normalizeNumeroNF,
  validateManualIdentity,
} from '@/lib/nfIdentity';
import { buildComplementNotice, evaluateIdentityConflict } from '@/lib/nfImportPlanner';
import type { NFIdentity, NfIdentityLookupResponse } from '@/types/nf';
import { getNomeCompletoMasterProduct, isCatalogProductCode } from '@/types/masterProduct';
import { Badge } from '@/components/ui/badge';
import { normalizeBrand } from '@/lib/brandUtils';

interface MasterProduct {
  id: string;
  code: string;
  name: string;
  category?: string;
  fragmentavel: boolean;
  unidades_por_embalagem?: number;
}

interface NFProduct {
  master_product_id?: string;
  codigo: string;
  nome_produto: string;
  category?: string;
  brand?: string;
  lote: string;
  quantidade: number; // sempre em unidades
  dt_validade: string;
  valor_unitario: number; // sempre por unidade
  // Campos de auditoria (fragmentação)
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
  quantidade_embalagens?: number;
  valor_por_embalagem?: number;
  // Produto Rennova fora do catálogo: quantidade e valor como na NF (embalagens);
  // vira pendência no servidor e não é enviado como flag (o servidor decide)
  pendente_cadastro?: boolean;
}

interface ResultadoLancamento {
  idLabel: string;
  complemento: boolean;
  produtosImportados: number;
  pendentes: Array<{ codigo: string; nome_produto: string; lote: string }>;
}

const TEXTO_PENDENTES_MANUAL =
  'O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações.';

/** "O produto X não foi inserido" / "Os produtos X, Y e Z não foram inseridos". */
function textoNaoInseridos(nomesBrutos: string[]): string {
  const nomes = Array.from(new Set(nomesBrutos));
  const lista = new Intl.ListFormat('pt-BR').format(nomes);
  return nomes.length === 1
    ? `O produto ${lista} não foi inserido no estoque.`
    : `Os produtos ${lista} não foram inseridos no estoque.`;
}

export default function ManualNFPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, claims } = useAuth();
  const isAdmin = claims?.role === 'clinic_admin';

  const [step, setStep] = useState<
    'select_type' | 'select_method' | 'enter_nf' | 'add_products' | 'review' | 'resultado'
  >('select_type');
  const [resultado, setResultado] = useState<ResultadoLancamento | null>(null);
  const [tipoNF, setTipoNF] = useState<'rennova' | 'outra_marca' | null>(null);
  const [numeroNF, setNumeroNF] = useState('');
  const [cnpjEmitente, setCnpjEmitente] = useState('');
  const [serieNF, setSerieNF] = useState('');
  const [chaveAcesso, setChaveAcesso] = useState('');
  // Identidade normalizada (CNPJ + série + número) — definida ao avançar do Passo 2
  const [identidade, setIdentidade] = useState<NFIdentity | null>(null);
  const [chaveNormalizada, setChaveNormalizada] = useState<string | undefined>(undefined);
  // Checagem antecipada (Passo 2): aviso de complemento do mesmo ID
  const [avisoComplemento, setAvisoComplemento] = useState('');
  const [verificandoNF, setVerificandoNF] = useState(false);
  const [produtos, setProdutos] = useState<NFProduct[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form fields para adicionar produto
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedProductObj, setSelectedProductObj] = useState<MasterProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([]);
  const [lote, setLote] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [dtValidade, setDtValidade] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');

  // Produto Rennova fora do catálogo, informado à mão (vira pendência de cadastro)
  const [modoManual, setModoManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [nomeManual, setNomeManual] = useState('');

  // Form fields para produtos de outra marca
  const [codigoOutraMarca, setCodigoOutraMarca] = useState('');
  const [nomeOutraMarca, setNomeOutraMarca] = useState('');
  const [brandOutraMarca, setBrandOutraMarca] = useState('');

  useEffect(() => {
    if (tipoNF === 'rennova') {
      loadMasterProducts();
    }
  }, [tipoNF]);

  // Filtrar produtos conforme busca
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts(masterProducts);
      return;
    }

    const searchLower = productSearch.toLowerCase();
    const filtered = masterProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(searchLower) || p.name.toLowerCase().includes(searchLower)
    );
    setFilteredProducts(filtered);
  }, [productSearch, masterProducts]);

  // Mesma restricao ja aplicada em clinic/upload/page.tsx (UC-10) -- antes,
  // qualquer clinic_user conseguia completar este fluxo e gravar NF + itens
  // de inventario, sem nenhuma checagem de role.
  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Apenas administradores podem inserir notas fiscais manualmente
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleSelectType = (type: 'rennova' | 'outra_marca') => {
    setTipoNF(type);
    if (type === 'rennova') {
      setStep('select_method');
    } else {
      setStep('enter_nf');
    }
  };

  /**
   * Passo 2 → 3: valida a identidade e consulta se a NF já existe (bloqueia o
   * lançamento sobre NF importada via XML; avisa que um lançamento existente
   * será complementado). A transação ao salvar continua sendo a checagem que
   * vale; se a consulta falhar, segue com aviso.
   */
  const handleContinueToProducts = async () => {
    const resultado = validateManualIdentity({
      numero: numeroNF,
      cnpj: cnpjEmitente,
      serie: serieNF,
      chave: chaveAcesso.trim() || undefined,
    });
    if (!resultado.ok) {
      toast({
        title: 'Dados da nota fiscal',
        description: resultado.error,
        variant: 'destructive',
      });
      return;
    }

    setAvisoComplemento('');
    if (user) {
      setVerificandoNF(true);
      try {
        const params = new URLSearchParams({
          cnpj: resultado.identity.cnpj,
          serie: resultado.identity.serie,
          numero: resultado.identity.numero,
        });
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/nf-imports/identidade?${params.toString()}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const fatos = (await response.json()) as NfIdentityLookupResponse;
        if (fatos.existe) {
          const decisao = evaluateIdentityConflict('manual', {
            nf_import_id: fatos.importId,
            origem: fatos.origem,
            hasPending: fatos.hasPending,
            hasRejected: fatos.hasRejected,
          });
          if (decisao.action === 'blocked') {
            toast({
              title: 'Nota fiscal já cadastrada',
              description: decisao.reason,
              variant: 'destructive',
            });
            return;
          }
          if (decisao.action === 'complement') {
            const aviso = buildComplementNotice(fatos.importId, fatos.origem);
            setAvisoComplemento(aviso);
            toast({ title: 'NF já cadastrada', description: aviso });
          }
        }
      } catch {
        toast({
          title: 'Verificação de duplicidade',
          description:
            'Não foi possível verificar agora se a NF já foi cadastrada; a verificação será feita ao salvar.',
        });
      } finally {
        setVerificandoNF(false);
      }
    }

    setIdentidade(resultado.identity);
    setChaveNormalizada(resultado.chave_acesso);
    setStep('add_products');
  };

  const loadMasterProducts = async () => {
    try {
      const q = query(collection(db, 'master_products'), where('active', '==', true));
      const snapshot = await getDocs(q);
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        code: doc.data().code,
        name: doc.data().name,
        category: doc.data().category,
        fragmentavel: doc.data().fragmentavel ?? false,
        unidades_por_embalagem: doc.data().unidades_por_embalagem,
      }));
      setMasterProducts(products);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos Rennova',
        variant: 'destructive',
      });
    }
  };

  const handleAddProduct = () => {
    if (tipoNF === 'rennova' && modoManual) {
      if (
        !codigoManual ||
        !nomeManual.trim() ||
        !lote ||
        !quantidade ||
        !dtValidade ||
        !valorUnitario
      ) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos para adicionar o produto',
          variant: 'destructive',
        });
        return;
      }
      const codigo = normalizeLeadingZeros(codigoManual);
      if (!/^\d+$/.test(codigo) || !isCatalogProductCode(codigo)) {
        toast({
          title: 'Código inválido',
          description: 'Use de 5 a 8 dígitos numéricos.',
          variant: 'destructive',
        });
        return;
      }
      if (masterProducts.some((p) => normalizeLeadingZeros(p.code) === codigo)) {
        toast({
          title: 'Produto já está no catálogo',
          description: 'Este código está no catálogo: selecione o produto na busca.',
          variant: 'destructive',
        });
        return;
      }
      // Sem conversão: quantidade e valor como na NF (o servidor converte na
      // incorporação, pela regra do catálogo)
      setProdutos([
        ...produtos,
        {
          codigo,
          nome_produto: nomeManual.trim().toUpperCase(),
          brand: 'Rennova',
          lote: normalizeLeadingZeros(lote),
          quantidade: parseFloat(quantidade),
          dt_validade: dtValidade,
          valor_unitario: parseFloat(valorUnitario),
          pendente_cadastro: true,
        },
      ]);
    } else if (tipoNF === 'rennova') {
      // Validar campos Rennova
      if (!selectedProduct || !lote || !quantidade || !dtValidade || !valorUnitario) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos para adicionar o produto',
          variant: 'destructive',
        });
        return;
      }

      const product = masterProducts.find((p) => p.id === selectedProduct);
      if (!product) return;

      const qtdInformada = parseFloat(quantidade);
      const valorInformado = parseFloat(valorUnitario);
      const { quantidade_inicial, valor_unitario: valorUnit } = calcularQuantidadeInventario({
        quantidadeInformada: qtdInformada,
        fragmentavel: product.fragmentavel,
        unidadesPorEmbalagem: product.unidades_por_embalagem,
        valorInformado,
      });

      const newProduct: NFProduct = {
        master_product_id: product.id,
        codigo: product.code,
        nome_produto: getNomeCompletoMasterProduct(product as any),
        category: product.category,
        brand: 'Rennova',
        lote: normalizeLeadingZeros(lote),
        quantidade: quantidade_inicial,
        dt_validade: dtValidade,
        valor_unitario: valorUnit,
        fragmentavel: product.fragmentavel,
        unidades_por_embalagem: product.unidades_por_embalagem,
        quantidade_embalagens: product.fragmentavel ? qtdInformada : undefined,
        valor_por_embalagem: product.fragmentavel ? valorInformado : undefined,
      };

      setProdutos([...produtos, newProduct]);
    } else {
      // Validar campos de outra marca
      if (
        !codigoOutraMarca ||
        !nomeOutraMarca ||
        !brandOutraMarca ||
        !lote ||
        !quantidade ||
        !dtValidade ||
        !valorUnitario
      ) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos para adicionar o produto',
          variant: 'destructive',
        });
        return;
      }

      const newProduct: NFProduct = {
        codigo: normalizeLeadingZeros(codigoOutraMarca),
        nome_produto: nomeOutraMarca,
        brand: normalizeBrand(brandOutraMarca),
        lote: normalizeLeadingZeros(lote),
        quantidade: parseFloat(quantidade),
        dt_validade: dtValidade,
        valor_unitario: parseFloat(valorUnitario),
      };

      setProdutos([...produtos, newProduct]);
    }

    // Limpar campos
    setModoManual(false);
    setCodigoManual('');
    setNomeManual('');
    setSelectedProduct('');
    setSelectedProductObj(null);
    setProductSearch('');
    setShowSuggestions(false);
    setCodigoOutraMarca('');
    setNomeOutraMarca('');
    setBrandOutraMarca('');
    setLote('');
    setQuantidade('');
    setDtValidade('');
    setValorUnitario('');
    setIsDialogOpen(false);

    toast({
      title: 'Produto adicionado',
      description: 'Produto adicionado à lista com sucesso',
    });
  };

  const handleRemoveProduct = (index: number) => {
    setProdutos(produtos.filter((_, i) => i !== index));
    toast({
      title: 'Produto removido',
      description: 'Produto removido da lista',
    });
  };

  const handleGoToReview = () => {
    if (produtos.length === 0) {
      toast({
        title: 'Adicione produtos',
        description: 'Adicione pelo menos um produto antes de continuar',
        variant: 'destructive',
      });
      return;
    }
    setStep('review');
  };

  /**
   * Grava pela rota do servidor (UC-11): a transação verifica a identidade da
   * nota, cria o registro "ID 100x" ou complementa o da mesma NF manual.
   */
  const handleSaveNF = async () => {
    if (!identidade || !user) {
      toast({
        title: 'Dados da nota fiscal',
        description: 'Informe número, CNPJ do emitente e série da nota fiscal',
        variant: 'destructive',
      });
      return;
    }

    if (produtos.length === 0) {
      toast({
        title: 'Adicione produtos',
        description: 'Adicione pelo menos um produto à nota fiscal',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // O servidor recalcula a fragmentação a partir do catálogo: envia o que
      // foi informado (embalagens e valor por embalagem, se fragmentável).
      const payload = {
        numero: identidade.numero,
        cnpj: identidade.cnpj,
        serie: identidade.serie,
        ...(chaveNormalizada ? { chave_acesso: chaveNormalizada } : {}),
        tipo: tipoNF,
        produtos: produtos.map((p) => ({
          codigo: p.codigo,
          nome_produto: p.nome_produto,
          lote: p.lote,
          quantidade: p.fragmentavel ? p.quantidade_embalagens : p.quantidade,
          valor_unitario: p.fragmentavel ? p.valor_por_embalagem : p.valor_unitario,
          dt_validade: p.dt_validade,
          ...(p.brand ? { brand: p.brand } : {}),
          ...(p.category ? { category: p.category } : {}),
        })),
      };

      const idToken = await user.getIdToken();
      const response = await fetch('/api/nf-imports/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Partial<ResultadoLancamento> & { error?: string };

      if (!response.ok) {
        toast({
          title: 'Nota fiscal não pode ser salva',
          description: body.error ?? 'Não foi possível salvar a nota fiscal',
          variant: 'destructive',
        });
        return;
      }

      // Com pendências, a página não redireciona: mostra o resultado com o aviso
      if ((body.pendentes ?? []).length > 0) {
        setResultado({
          idLabel: body.idLabel ?? '',
          complemento: body.complemento === true,
          produtosImportados: body.produtosImportados ?? 0,
          pendentes: body.pendentes ?? [],
        });
        setStep('resultado');
        return;
      }

      toast(
        body.complemento
          ? {
              title: 'Lançamento adicionado',
              description: `Lançamento adicionado à NF já cadastrada (${body.idLabel})`,
            }
          : {
              title: `Nota fiscal salva — ${body.idLabel}`,
              description: 'Os produtos foram adicionados ao inventário',
            }
      );
      router.push('/clinic/inventory');
    } catch (error) {
      console.error('Erro ao salvar NF:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a nota fiscal',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'select_type':
      case 'select_method':
        return 1;
      case 'enter_nf':
        return 2;
      case 'add_products':
        return 3;
      case 'review':
      case 'resultado':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Inserção Manual de Produtos</h1>
          <p className="text-muted-foreground">Adicione produtos manualmente ao inventário</p>
        </div>
      </div>

      {/* Indicador de Progresso */}
      {step !== 'select_type' && (
        <div className="mb-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {/* Step 1: Tipo */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  getStepNumber() >= 1
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                1
              </div>
              <span className="text-xs text-center">Tipo</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 2 ? 'bg-primary' : 'bg-muted'}`} />

            {/* Step 2: NF */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  getStepNumber() >= 2
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                2
              </div>
              <span className="text-xs text-center">Nº NF</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 3 ? 'bg-primary' : 'bg-muted'}`} />

            {/* Step 3: Produtos */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  getStepNumber() >= 3
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                3
              </div>
              <span className="text-xs text-center">Produtos</span>
            </div>
            <div className={`flex-1 h-[2px] ${getStepNumber() >= 4 ? 'bg-primary' : 'bg-muted'}`} />

            {/* Step 4: Revisão */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  getStepNumber() >= 4
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground'
                }`}
              >
                4
              </div>
              <span className="text-xs text-center">Revisão</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {/* Passo 1: Seleção de tipo de produto */}
        {step === 'select_type' && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o tipo de produto</CardTitle>
              <CardDescription>
                Escolha se deseja adicionar produtos Rennova ou de outras marcas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => handleSelectType('rennova')}
                >
                  Adicionar Produtos Rennova
                </Button>
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => handleSelectType('outra_marca')}
                >
                  Adicionar Outras Marcas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sub-step: Escolha de método (apenas Rennova) */}
        {step === 'select_method' && (
          <Card>
            <CardHeader>
              <CardTitle>Como deseja adicionar os produtos Rennova?</CardTitle>
              <CardDescription>
                Escolha entre cadastro manual ou importação automática via XML da NF-e
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-32 flex-col gap-2 text-base"
                  onClick={() => setStep('enter_nf')}
                >
                  <span className="font-semibold">Inserção Manual</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Informe os dados produto a produto
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex-col gap-2 text-base"
                  onClick={() => router.push('/clinic/upload')}
                >
                  <span className="font-semibold">Importar XML da NF-e</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Faça upload do XML e os dados são preenchidos automaticamente
                  </span>
                </Button>
              </div>
              <div className="flex justify-start mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep('select_type')}>
                  ← Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 2: Informar número da NF */}
        {step === 'enter_nf' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados da Nota Fiscal</CardTitle>
              <CardDescription>
                Informe a identificação da NF para{' '}
                {tipoNF === 'rennova' ? 'produtos Rennova' : 'outras marcas'}. A mesma nota (CNPJ do
                emitente + série + número) não pode ser cadastrada duas vezes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero-nf">Número da NF *</Label>
                  <Input
                    id="numero-nf"
                    placeholder="Ex: 026229"
                    value={numeroNF}
                    onChange={(e) => setNumeroNF(e.target.value)}
                  />
                  {numeroNF.trim() !== '' &&
                    normalizeNumeroNF(numeroNF) !== '' &&
                    normalizeNumeroNF(numeroNF) !== numeroNF.trim() && (
                      <p className="text-xs text-muted-foreground">
                        Será registrada como {normalizeNumeroNF(numeroNF)}
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serie-nf">Série *</Label>
                  <Input
                    id="serie-nf"
                    placeholder="Ex: 1"
                    inputMode="numeric"
                    value={serieNF}
                    onChange={(e) => setSerieNF(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj-emitente">CNPJ do emitente *</Label>
                <Input
                  id="cnpj-emitente"
                  placeholder="00.000.000/0000-00"
                  value={cnpjEmitente}
                  onChange={(e) => setCnpjEmitente(maskCnpjInput(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chave-acesso">Chave de acesso (opcional)</Label>
                <Input
                  id="chave-acesso"
                  placeholder="44 caracteres"
                  value={chaveAcesso}
                  onChange={(e) => setChaveAcesso(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se informada, precisa conferir com CNPJ, série e número acima.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(tipoNF === 'rennova' ? 'select_method' : 'select_type')}
                >
                  Voltar
                </Button>
                <Button onClick={() => void handleContinueToProducts()} disabled={verificandoNF}>
                  {verificandoNF ? 'Verificando...' : 'Continuar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 3: Adicionar produtos */}
        {step === 'add_products' && (
          <>
            {/* Informações da NF (resumo) */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Nota Fiscal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nota fiscal</Label>
                    <p className="font-medium">{identidade && formatNFLabel(identidade)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="font-medium">
                      {tipoNF === 'rennova' ? 'Produtos Rennova' : 'Outras Marcas'}
                    </p>
                  </div>
                </div>
                {avisoComplemento && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Complemento de lançamento</AlertTitle>
                    <AlertDescription>{avisoComplemento}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Card de produtos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Produtos</CardTitle>
                  <CardDescription>Lista de produtos adicionados à nota fiscal</CardDescription>
                </div>
                <Dialog
                  open={isDialogOpen}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      setModoManual(false);
                      setCodigoManual('');
                      setNomeManual('');
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Adicionar Produto</DialogTitle>
                      <DialogDescription>
                        Preencha os dados do produto a ser adicionado
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {tipoNF === 'rennova' ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="produto">Produto Rennova</Label>
                            <div className="relative">
                              <Input
                                id="produto"
                                placeholder="Digite para buscar produto (código ou nome)..."
                                value={productSearch}
                                onChange={(e) => {
                                  setProductSearch(e.target.value);
                                  setShowSuggestions(true);
                                  setSelectedProduct(''); // Limpar seleção ao editar
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                autoComplete="off"
                              />
                              {showSuggestions && productSearch && filteredProducts.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
                                  {filteredProducts.slice(0, 10).map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground transition-colors text-sm"
                                      onClick={() => {
                                        setSelectedProduct(product.id);
                                        setSelectedProductObj(product);
                                        setProductSearch(
                                          `${product.code} - ${getNomeCompletoMasterProduct(product as any)}`
                                        );
                                        setShowSuggestions(false);
                                      }}
                                    >
                                      <span className="font-mono font-semibold">
                                        {product.code}
                                      </span>
                                      {' - '}
                                      <span>{getNomeCompletoMasterProduct(product as any)}</span>
                                      {product.fragmentavel && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                          (embalagem c/ {product.unidades_por_embalagem} UND)
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {!modoManual &&
                                showSuggestions &&
                                productSearch &&
                                filteredProducts.length === 0 && (
                                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-sm space-y-2">
                                    <p className="text-muted-foreground">
                                      Nenhum produto encontrado
                                    </p>
                                    <button
                                      type="button"
                                      className="text-primary underline underline-offset-2 hover:no-underline"
                                      onClick={() => {
                                        setModoManual(true);
                                        setShowSuggestions(false);
                                        if (/^\d+$/.test(productSearch.trim())) {
                                          setCodigoManual(productSearch.trim());
                                        }
                                      }}
                                    >
                                      Produto não está no catálogo — informar manualmente
                                    </button>
                                  </div>
                                )}
                            </div>
                          </div>
                          {modoManual && (
                            <div className="space-y-4 rounded-md border border-amber-300 bg-amber-50 p-3">
                              <p className="text-sm text-amber-900">
                                Este produto ficará <strong>pendente de cadastro</strong>: ele não
                                entra no estoque agora e o Administrador do Sistema será avisado.
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="codigo-manual">Código (como na NF)</Label>
                                  <Input
                                    id="codigo-manual"
                                    inputMode="numeric"
                                    placeholder="5 a 8 dígitos"
                                    value={codigoManual}
                                    onChange={(e) => setCodigoManual(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="nome-manual">Nome (conforme a NF)</Label>
                                  <Input
                                    id="nome-manual"
                                    placeholder="Ex: PRODUTO NOVO"
                                    value={nomeManual}
                                    onChange={(e) => setNomeManual(e.target.value)}
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                className="text-sm text-primary underline underline-offset-2 hover:no-underline"
                                onClick={() => {
                                  setModoManual(false);
                                  setCodigoManual('');
                                  setNomeManual('');
                                }}
                              >
                                Voltar à busca do catálogo
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="codigo-outra">Código do Produto</Label>
                            <Input
                              id="codigo-outra"
                              placeholder="Ex: 1234567"
                              value={codigoOutraMarca}
                              onChange={(e) => setCodigoOutraMarca(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nome-outra">Nome do Produto</Label>
                            <Input
                              id="nome-outra"
                              placeholder="Ex: PRODUTO TESTE"
                              value={nomeOutraMarca}
                              onChange={(e) => setNomeOutraMarca(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="brand-outra">Marca</Label>
                            <Input
                              id="brand-outra"
                              placeholder="Ex: Allergan, Merz, Rennova..."
                              value={brandOutraMarca}
                              onChange={(e) => setBrandOutraMarca(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="lote">Lote</Label>
                          <Input
                            id="lote"
                            placeholder="Ex: ABC123"
                            value={lote}
                            onChange={(e) => setLote(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quantidade">
                            {tipoNF === 'rennova' &&
                            (selectedProductObj?.fragmentavel || modoManual)
                              ? 'Número de Embalagens'
                              : 'Quantidade'}
                          </Label>
                          <Input
                            id="quantidade"
                            type="number"
                            placeholder={
                              tipoNF === 'rennova' && selectedProductObj?.fragmentavel
                                ? 'Ex: 2'
                                : 'Ex: 10'
                            }
                            value={quantidade}
                            onChange={(e) => setQuantidade(e.target.value)}
                          />
                          {tipoNF === 'rennova' &&
                            selectedProductObj?.fragmentavel &&
                            quantidade && (
                              <p className="text-xs text-muted-foreground">
                                {quantidade} embalagem(ns) ×{' '}
                                {selectedProductObj.unidades_por_embalagem} UND ={' '}
                                <strong>
                                  {parseFloat(quantidade) *
                                    (selectedProductObj.unidades_por_embalagem ?? 1)}{' '}
                                  unidades
                                </strong>
                              </p>
                            )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dt-validade">Data de Validade</Label>
                          <Input
                            id="dt-validade"
                            type="date"
                            value={dtValidade}
                            onChange={(e) => setDtValidade(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valor-unitario">
                            {tipoNF === 'rennova' &&
                            (selectedProductObj?.fragmentavel || modoManual)
                              ? 'Valor por Embalagem (R$)'
                              : 'Valor Unitário (R$)'}
                          </Label>
                          <Input
                            id="valor-unitario"
                            type="number"
                            step="0.01"
                            placeholder="Ex: 10.50"
                            value={valorUnitario}
                            onChange={(e) => setValorUnitario(e.target.value)}
                          />
                          {tipoNF === 'rennova' &&
                            selectedProductObj?.fragmentavel &&
                            valorUnitario &&
                            selectedProductObj.unidades_por_embalagem && (
                              <p className="text-xs text-muted-foreground">
                                Valor por unidade:{' '}
                                <strong>
                                  R${' '}
                                  {(
                                    parseFloat(valorUnitario) /
                                    selectedProductObj.unidades_por_embalagem
                                  ).toFixed(4)}
                                </strong>
                              </p>
                            )}
                        </div>
                      </div>

                      {tipoNF === 'rennova' && modoManual && (
                        <p className="text-xs text-muted-foreground">
                          Informe como está na NF (embalagens).
                        </p>
                      )}

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddProduct}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {produtos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto adicionado. Clique em "Adicionar Produto" para começar.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtos.map((produto, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{produto.codigo}</TableCell>
                          <TableCell>
                            {produto.nome_produto}
                            {produto.pendente_cadastro && (
                              <Badge
                                variant="outline"
                                className="ml-2 border-amber-400 bg-amber-50 text-amber-800"
                              >
                                Pendente de cadastro
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{produto.lote}</TableCell>
                          <TableCell>{produto.quantidade}</TableCell>
                          <TableCell>{produto.dt_validade}</TableCell>
                          <TableCell>R$ {produto.valor_unitario.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveProduct(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setStep('enter_nf')}>
                Voltar
              </Button>
              <Button onClick={handleGoToReview} disabled={produtos.length === 0}>
                Revisar e Confirmar
              </Button>
            </div>
          </>
        )}

        {/* Resultado com pendências (não redireciona, para o aviso ser lido) */}
        {step === 'resultado' && resultado && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="text-green-600">
                {resultado.complemento
                  ? `Lançamento adicionado à NF já cadastrada (${resultado.idLabel})`
                  : `Nota fiscal salva — ${resultado.idLabel}`}
              </CardTitle>
              <CardDescription>{identidade && formatNFLabel(identidade)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm">
                {resultado.produtosImportados} produto(s) adicionado(s) ao estoque.
              </p>
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Produtos pendentes de cadastro</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {textoNaoInseridos(resultado.pendentes.map((p) => p.nome_produto))}{' '}
                    {TEXTO_PENDENTES_MANUAL}
                  </p>
                  <ul className="list-disc pl-5">
                    {resultado.pendentes.map((p, i) => (
                      <li key={`${p.codigo}-${p.lote}-${i}`}>
                        {p.codigo} — {p.nome_produto} (lote {p.lote})
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button onClick={() => router.push('/clinic/inventory')} className="flex-1">
                  Ver Estoque
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResultado(null);
                    setProdutos([]);
                    setIdentidade(null);
                    setChaveNormalizada(undefined);
                    setNumeroNF('');
                    setCnpjEmitente('');
                    setSerieNF('');
                    setChaveAcesso('');
                    setAvisoComplemento('');
                    setTipoNF(null);
                    setStep('select_type');
                  }}
                >
                  Novo lançamento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 4: Revisão e Confirmação */}
        {step === 'review' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Revisão da Nota Fiscal</CardTitle>
                <CardDescription>
                  Revise todos os dados antes de confirmar o salvamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações da NF */}
                <div>
                  <h3 className="font-semibold mb-3">Informações da Nota Fiscal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground">Nota fiscal</Label>
                      <p className="font-medium">{identidade && formatNFLabel(identidade)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tipo</Label>
                      <p className="font-medium">
                        {tipoNF === 'rennova' ? 'Produtos Rennova' : 'Outras Marcas'}
                      </p>
                    </div>
                  </div>
                  {avisoComplemento && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Complemento de lançamento</AlertTitle>
                      <AlertDescription>{avisoComplemento}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Lista de produtos */}
                <div>
                  <h3 className="font-semibold mb-3">Produtos ({produtos.length})</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead className="text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtos.map((produto, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{produto.codigo}</TableCell>
                            <TableCell>
                              {produto.nome_produto}
                              {produto.pendente_cadastro && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-amber-400 bg-amber-50 text-amber-800"
                                >
                                  Pendente de cadastro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{produto.lote}</TableCell>
                            <TableCell className="text-right">{produto.quantidade}</TableCell>
                            <TableCell>{produto.dt_validade}</TableCell>
                            <TableCell className="text-right">
                              R$ {produto.valor_unitario.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(produto.quantidade * produto.valor_unitario).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={6} className="text-right font-bold">
                            Valor Total:
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            R${' '}
                            {produtos
                              .reduce((sum, p) => sum + p.quantidade * p.valor_unitario, 0)
                              .toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {produtos.some((p) => p.pendente_cadastro) && (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Itens pendentes de cadastro</AlertTitle>
                    <AlertDescription>
                      Itens pendentes de cadastro não entram no estoque agora.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Alerta de confirmação */}
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">
                        Atenção
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                        Ao confirmar, a nota fiscal será salva e todos os produtos serão adicionados
                        ao inventário da clínica. Esta ação não pode ser desfeita automaticamente.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('add_products')}>
                Voltar e Editar
              </Button>
              <Button
                onClick={handleSaveNF}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? 'Salvando...' : 'Confirmar e Salvar'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
