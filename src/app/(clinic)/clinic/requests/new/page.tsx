'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Package, AlertTriangle, Check, X, Trash2, Plus } from 'lucide-react';
import { listInventory, type InventoryItem } from '@/lib/services/inventoryService';
import { agruparProdutosPorCodigo, type ProdutoAgrupado } from '@/lib/inventoryUtils';
import {
  createSolicitacaoWithConsumption,
  createSolicitacaoEfetuada,
  updateSolicitacaoAgendada,
  type CreateSolicitacaoInput,
  type CreateSolicitacaoEfetuadaInput,
} from '@/lib/services/solicitacaoService';

type Step = 'adicionar_produtos' | 'revisao';

interface ProdutoSelecionado {
  inventory_item_id: string;
  produto_codigo: string;
  produto_nome: string;
  lote: string;
  quantidade_solicitada: number;
  quantidade_disponivel: number;
  valor_unitario: number;
}

export default function NovaSolicitacaoPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (claims && claims.role !== 'clinic_admin') {
      router.push('/clinic/requests');
    }
  }, [claims, router]);

  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  const createdAtParam = searchParams.get('createdAt');

  // Estados do formulário
  const [step, setStep] = useState<Step>('adicionar_produtos');
  const [tipoProcedimento, setTipoProcedimento] = useState<'programado' | 'efetuado'>('programado');
  const [descricao, setDescricao] = useState('');
  const [dtProcedimento, setDtProcedimento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Estados de produtos
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [produtosAgrupados, setProdutosAgrupados] = useState<ProdutoAgrupado<InventoryItem>[]>([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);
  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [quantidadeSolicitada, setQuantidadeSolicitada] = useState('1');

  // Estados de loading e erro
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Carregar inventário ao iniciar
  useEffect(() => {
    async function loadInventory() {
      if (!tenantId) return;

      try {
        setLoading(true);
        const items = await listInventory(tenantId);
        const availableItems = items.filter(
          (item) => item.active && item.quantidade_disponivel > 0
        );
        setInventoryItems(availableItems);
        setProdutosAgrupados(agruparProdutosPorCodigo(availableItems));
      } catch (err: any) {
        console.error('Erro ao carregar inventário:', err);
        toast({
          title: 'Erro ao carregar inventário',
          description: 'Não foi possível carregar os produtos disponíveis',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [tenantId, toast]);

  // Carregar dados para edição
  useEffect(() => {
    if (!isEditMode || !searchParams) return;

    try {
      const descricaoParam = searchParams.get('descricao');
      if (descricaoParam) setDescricao(descricaoParam);

      const dtParam = searchParams.get('dtProcedimento');
      if (dtParam) setDtProcedimento(dtParam);

      const obsParam = searchParams.get('observacoes');
      if (obsParam) setObservacoes(obsParam);

      const produtosParam = searchParams.get('produtos');
      if (produtosParam) {
        try {
          const produtos = JSON.parse(produtosParam);
          const selecionados: ProdutoSelecionado[] = produtos.map((p: any) => ({
            inventory_item_id: p.inventory_item_id,
            produto_codigo: p.codigo_produto,
            produto_nome: p.nome_produto,
            lote: p.lote,
            quantidade_solicitada: p.quantidade,
            quantidade_disponivel: 0,
            valor_unitario: p.valor_unitario,
          }));
          setProdutosSelecionados(selecionados);
        } catch (e) {
          console.error('Erro ao parsear produtos:', e);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados de edição:', err);
    }
  }, [isEditMode, searchParams]);

  // Atualizar quantidade disponível dos produtos selecionados quando o inventário carregar
  useEffect(() => {
    if (!isEditMode || produtosSelecionados.length === 0 || inventoryItems.length === 0) return;

    const jaAtualizado = produtosSelecionados.some((p) => p.quantidade_disponivel > 0);
    if (jaAtualizado) return;

    const produtosAtualizados = produtosSelecionados.map((produtoSelecionado) => {
      const itemInventario = inventoryItems.find(
        (item) => item.id === produtoSelecionado.inventory_item_id
      );
      if (itemInventario) {
        return {
          ...produtoSelecionado,
          quantidade_disponivel: itemInventario.quantidade_disponivel,
          produto_nome: produtoSelecionado.produto_nome || itemInventario.nome_produto,
          produto_codigo: produtoSelecionado.produto_codigo || itemInventario.codigo_produto,
        };
      }
      return produtoSelecionado;
    });

    setProdutosSelecionados(produtosAtualizados);
  }, [inventoryItems, isEditMode, produtosSelecionados]);

  const validateStep1 = () => {
    if (!dtProcedimento) {
      setError('Data do procedimento é obrigatória');
      return false;
    }

    const dataHoje = new Date();
    const dataHojeString = [
      dataHoje.getFullYear(),
      String(dataHoje.getMonth() + 1).padStart(2, '0'),
      String(dataHoje.getDate()).padStart(2, '0'),
    ].join('-');

    if (!isEditMode && tipoProcedimento === 'efetuado') {
      if (dtProcedimento > dataHojeString) {
        setError('Procedimento efetuado não pode ter data futura');
        return false;
      }
    } else {
      if (dtProcedimento < dataHojeString) {
        if (isEditMode && createdAtParam && createdAtParam < dtProcedimento) {
          setError('');
          return true;
        }
        setError('Data do procedimento não pode ser no passado');
        return false;
      }
    }

    setError('');
    return true;
  };

  // Função para alocar quantidade usando FEFO (First Expired, First Out)
  const alocarProdutoFEFO = (
    codigoProduto: string,
    quantidadeDesejada: number
  ): ProdutoSelecionado[] => {
    const produtoAgrupado = produtosAgrupados.find((p) => p.codigo_produto === codigoProduto);
    if (!produtoAgrupado) return [];

    const alocacoes: ProdutoSelecionado[] = [];
    let quantidadeRestante = quantidadeDesejada;

    for (const lote of produtoAgrupado.lotes) {
      if (quantidadeRestante <= 0) break;
      const quantidadeDoLote = Math.min(quantidadeRestante, lote.quantidade_disponivel);
      alocacoes.push({
        inventory_item_id: lote.id,
        produto_codigo: lote.codigo_produto,
        produto_nome: lote.nome_produto,
        lote: lote.lote,
        quantidade_solicitada: quantidadeDoLote,
        quantidade_disponivel: lote.quantidade_disponivel,
        valor_unitario: lote.valor_unitario,
      });
      quantidadeRestante -= quantidadeDoLote;
    }

    return alocacoes;
  };

  function validateProductSelection(
    code: string,
    quantidade: number,
    produtoAgrupado: ProdutoAgrupado<InventoryItem> | undefined
  ): { title: string; description: string } | null {
    if (!code)
      return { title: 'Selecione um produto', description: 'Escolha um produto do inventário' };
    if (Number.isNaN(quantidade) || quantidade <= 0)
      return { title: 'Quantidade inválida', description: 'Informe uma quantidade válida' };
    if (!produtoAgrupado) return null;
    if (quantidade > produtoAgrupado.quantidade_total)
      return {
        title: 'Estoque insuficiente',
        description: `Disponível: ${produtoAgrupado.quantidade_total} unidades`,
      };
    if (produtosSelecionados.some((p) => p.produto_codigo === code))
      return {
        title: 'Produto já adicionado',
        description: 'Este produto já está na lista. Remova-o para adicionar novamente',
      };
    return null;
  }

  const handleAdicionarProduto = () => {
    const quantidade = parseInt(quantidadeSolicitada);
    const produtoAgrupado = produtosAgrupados.find((p) => p.codigo_produto === selectedProductCode);

    const validationError = validateProductSelection(
      selectedProductCode,
      quantidade,
      produtoAgrupado
    );
    if (validationError) {
      toast({ ...validationError, variant: 'destructive' });
      return;
    }

    if (!produtoAgrupado) return;

    const alocacoes = alocarProdutoFEFO(selectedProductCode, quantidade);

    if (alocacoes.length === 0) {
      toast({
        title: 'Erro ao alocar produto',
        description: 'Não foi possível alocar o produto',
        variant: 'destructive',
      });
      return;
    }

    setProdutosSelecionados([...produtosSelecionados, ...alocacoes]);
    setSelectedProductCode('');
    setQuantidadeSolicitada('1');

    const lotesUsados = alocacoes
      .map((a) => `${a.lote} (${a.quantidade_solicitada} un)`)
      .join(', ');

    toast({
      title: 'Produto adicionado',
      description:
        alocacoes.length === 1
          ? `${produtoAgrupado.nome_produto} - Lote: ${lotesUsados}`
          : `${produtoAgrupado.nome_produto} - Lotes: ${lotesUsados}`,
    });
  };

  const handleRemoverProduto = (inventory_item_id: string) => {
    setProdutosSelecionados(
      produtosSelecionados.filter((p) => p.inventory_item_id !== inventory_item_id)
    );
  };

  const handleIrParaRevisao = () => {
    if (!validateStep1()) return;

    if (produtosSelecionados.length === 0) {
      toast({
        title: 'Adicione produtos',
        description: 'Adicione pelo menos um produto ao procedimento',
        variant: 'destructive',
      });
      return;
    }

    setValidationErrors([]);
    setStep('revisao');
  };

  function buildProdutosPayload() {
    return produtosSelecionados.map((p) => ({
      inventory_item_id: p.inventory_item_id,
      quantidade: p.quantidade_solicitada,
    }));
  }

  async function submitEditMode(tenantId: string, editId: string, userName: string) {
    const updatePayload: Parameters<typeof updateSolicitacaoAgendada>[4] = {
      descricao: descricao || undefined,
      dt_procedimento: new Date(dtProcedimento),
      produtos: buildProdutosPayload(),
    };
    if (observacoes) updatePayload.observacoes = observacoes;

    const result = await updateSolicitacaoAgendada(
      tenantId,
      editId,
      user!.uid,
      userName,
      updatePayload
    );

    if (result.success) {
      toast({
        title: 'Procedimento atualizado com sucesso!',
        description: 'As reservas de produtos foram ajustadas',
      });
      router.push(`/clinic/requests/${editId}`);
    } else {
      toast({
        title: 'Erro ao atualizar procedimento',
        description: result.error || 'Ocorreu um erro ao processar a atualização',
        variant: 'destructive',
      });
    }
  }

  async function submitCreateMode(tenantId: string, userName: string) {
    const produtos = buildProdutosPayload();
    const dt_procedimento = new Date(dtProcedimento);

    const result =
      tipoProcedimento === 'efetuado'
        ? await createSolicitacaoEfetuada(tenantId, user!.uid, userName, {
            descricao: descricao || undefined,
            dt_procedimento,
            produtos,
            observacoes: observacoes || undefined,
          } satisfies CreateSolicitacaoEfetuadaInput)
        : await createSolicitacaoWithConsumption(tenantId, user!.uid, userName, {
            descricao: descricao || undefined,
            dt_procedimento,
            produtos,
            observacoes: observacoes || undefined,
          } satisfies CreateSolicitacaoInput);

    if (result.success) {
      toast({
        title: 'Procedimento criado com sucesso!',
        description:
          tipoProcedimento === 'efetuado'
            ? 'Os produtos foram consumidos do inventário'
            : 'Os produtos foram reservados no inventário',
      });
      router.push(`/clinic/requests/${result.solicitacaoId}`);
    } else {
      if (result.validationErrors && result.validationErrors.length > 0) {
        setValidationErrors(result.validationErrors);
        setStep('revisao');
      }
      toast({
        title: 'Erro ao criar procedimento',
        description: result.error || 'Ocorreu um erro ao processar o procedimento',
        variant: 'destructive',
      });
    }
  }

  const handleConfirmarSolicitacao = async () => {
    if (!tenantId || !user) return;

    const userName = user.displayName || user.email || 'Usuário';

    try {
      setSaving(true);
      setValidationErrors([]);

      if (isEditMode && editId) {
        await submitEditMode(tenantId, editId, userName);
      } else {
        await submitCreateMode(tenantId, userName);
      }
    } catch (err: any) {
      const action = isEditMode ? 'atualizar' : 'criar';
      console.error(`Erro ao ${action} procedimento:`, err);
      toast({
        title: `Erro ao ${action} procedimento`,
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const valorTotal = produtosSelecionados.reduce(
    (sum, p) => sum + p.quantidade_solicitada * p.valor_unitario,
    0
  );

  const formatarDataLocal = (dataString: string) => {
    if (!dataString) return '';
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditMode ? 'Editar Procedimento' : 'Novo Procedimento'}
          </h2>
          <p className="text-muted-foreground">
            {isEditMode
              ? 'Modifique os dados do procedimento agendado'
              : 'Registre o consumo de produtos para um procedimento'}
          </p>
        </div>

        {/* Progress Indicator — 2 etapas */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === 'adicionar_produtos'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              1
            </div>
            <span className="text-sm">Adicionar Produtos</span>
          </div>

          <div className="h-[2px] w-12 bg-border" />

          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step === 'revisao'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <span className="text-sm">Revisão e Confirmação</span>
          </div>
        </div>

        {/* PASSO 1: Dados e Produtos */}
        {step === 'adicionar_produtos' && (
          <div className="space-y-4">
            {/* Dados do Procedimento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Dados do Procedimento
                </CardTitle>
                <CardDescription>Informe os dados e os produtos do procedimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEditMode && (
                  <div className="space-y-2">
                    <Label>Tipo de Procedimento *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={tipoProcedimento === 'programado' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setTipoProcedimento('programado')}
                      >
                        Procedimento Programado
                      </Button>
                      <Button
                        type="button"
                        variant={tipoProcedimento === 'efetuado' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setTipoProcedimento('efetuado')}
                      >
                        Procedimento Efetuado
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tipoProcedimento === 'programado'
                        ? 'Procedimento agendado para o futuro. Os produtos serão reservados e consumidos ao concluir.'
                        : 'Procedimento já realizado. Os produtos serão consumidos imediatamente do inventário.'}
                    </p>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (opcional)</Label>
                  <Input
                    id="descricao"
                    placeholder="Ex: Procedimento facial - Sala 2"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dt-procedimento">Data do Procedimento *</Label>
                  <Input
                    id="dt-procedimento"
                    type="date"
                    value={dtProcedimento}
                    onChange={(e) => setDtProcedimento(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Input
                    id="observacoes"
                    placeholder="Informações adicionais sobre o procedimento"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Adicionar Produtos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Adicionar Produtos do Inventário
                </CardTitle>
                <CardDescription>Selecione os produtos utilizados no procedimento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="produto">Produto</Label>
                    <Select
                      value={selectedProductCode}
                      onValueChange={setSelectedProductCode}
                      disabled={loading}
                    >
                      <SelectTrigger id="produto">
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosAgrupados.map((produto) => (
                          <SelectItem key={produto.codigo_produto} value={produto.codigo_produto}>
                            {produto.nome_produto} - {produto.quantidade_total} unidades disponíveis
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <div className="flex gap-2">
                      <Input
                        id="quantidade"
                        type="number"
                        min="1"
                        value={quantidadeSolicitada}
                        onChange={(e) => setQuantidadeSolicitada(e.target.value)}
                      />
                      <Button onClick={handleAdicionarProduto}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {produtosSelecionados.length > 0 && (
                  <div className="space-y-2">
                    <Label>Produtos Adicionados ({produtosSelecionados.length})</Label>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Lote</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Disponível</TableHead>
                            <TableHead className="text-right">Valor Unit.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {produtosSelecionados.map((produto) => (
                            <TableRow key={produto.inventory_item_id}>
                              <TableCell className="font-medium">
                                {produto.produto_nome}
                                <div className="text-xs text-muted-foreground">
                                  {produto.produto_codigo}
                                </div>
                              </TableCell>
                              <TableCell>{produto.lote}</TableCell>
                              <TableCell className="text-right">
                                {produto.quantidade_solicitada}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{produto.quantidade_disponivel}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                R$ {produto.valor_unitario.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R${' '}
                                {(produto.quantidade_solicitada * produto.valor_unitario).toFixed(
                                  2
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoverProduto(produto.inventory_item_id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={5} className="text-right font-bold">
                              Valor Total:
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              R$ {valorTotal.toFixed(2)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleIrParaRevisao}>
                    Revisar Procedimento <Check className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PASSO 2: Revisão e Confirmação */}
        {step === 'revisao' && (
          <div className="space-y-4">
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erros de Validação</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {validationErrors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção!</AlertTitle>
              <AlertDescription>
                {isEditMode
                  ? 'Ao confirmar, as reservas de produtos serão ajustadas automaticamente no inventário. Produtos removidos terão suas reservas liberadas, e novos produtos serão reservados.'
                  : tipoProcedimento === 'efetuado'
                    ? 'Ao confirmar, os produtos serão CONSUMIDOS IMEDIATAMENTE do inventário. O procedimento será registrado como já realizado.'
                    : 'Ao confirmar, os produtos serão RESERVADOS no inventário e o procedimento será criado com status "Agendado". Os produtos só serão consumidos quando o procedimento for concluído.'}
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Dados do Procedimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Descrição</Label>
                    <p className="font-medium">{descricao || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data do Procedimento</Label>
                    <p className="font-medium">{formatarDataLocal(dtProcedimento)}</p>
                  </div>
                  {observacoes && (
                    <div>
                      <Label className="text-muted-foreground">Observações</Label>
                      <p className="font-medium">{observacoes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Produtos a Consumir</CardTitle>
                <CardDescription>
                  {produtosSelecionados.length} produto(s) - Total: R$ {valorTotal.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosSelecionados.map((produto) => (
                      <TableRow key={produto.inventory_item_id}>
                        <TableCell>
                          <div className="font-medium">{produto.produto_nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {produto.produto_codigo}
                          </div>
                        </TableCell>
                        <TableCell>{produto.lote}</TableCell>
                        <TableCell className="text-right">
                          {produto.quantidade_solicitada}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {(produto.quantidade_solicitada * produto.valor_unitario).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep('adicionar_produtos')}
                disabled={saving}
              >
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/clinic/requests')}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarSolicitacao} disabled={saving}>
                  {saving ? (
                    'Processando...'
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {isEditMode
                    ? 'Confirmar Alterações'
                    : tipoProcedimento === 'efetuado'
                      ? 'Confirmar e Consumir Produtos'
                      : 'Confirmar e Reservar Produtos'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
