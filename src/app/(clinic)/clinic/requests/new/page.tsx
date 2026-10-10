'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Package, AlertTriangle, Check, X, Trash2, Plus, ClipboardList } from 'lucide-react';
import { listInventory, type InventoryItem } from '@/lib/services/inventoryService';
import { agruparProdutosPorCodigo, type ProdutoAgrupado } from '@/lib/inventoryUtils';
import {
  createSolicitacaoWithConsumption,
  createSolicitacaoEfetuada,
  updateSolicitacaoAgendada,
  type CreateSolicitacaoInput,
  type CreateSolicitacaoEfetuadaInput,
} from '@/lib/services/solicitacaoService';
import { listProtocolos } from '@/lib/services/protocoloService';
import { getCustoHoraConfig } from '@/lib/services/custoHoraService';
import { formatCurrency } from '@/lib/services/reportService';
import { salvarPrecificacaoProcedimento } from '@/lib/services/precificacaoProcedimentoService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FormaPagamentoSelector from '@/components/pricing/FormaPagamentoSelector';
import ProcedimentoPrecificacao from '@/components/pricing/ProcedimentoPrecificacao';
import {
  FORMAS_PAGAMENTO,
  calcularCustoMaterialSolicitacao,
  calcularPrecificacaoProcedimento,
  calcularResumoCustoHora,
  mesCorrenteSaoPaulo,
  mesReferenciaDoProcedimento,
  montarSnapshotPrecificacao,
  parseDuracaoMinutos,
  parseFormaPagamento,
  resolverDuracaoProcedimento,
} from '@/lib/precificacao';
import type { CustoHoraConfig, FormaPagamento, ProdutoSolicitado, Protocolo } from '@/types';

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
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [quantidadeSolicitada, setQuantidadeSolicitada] = useState('1');

  // Estados de protocolo
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [protocoloSelecionado, setProtocoloSelecionado] = useState<Protocolo | null>(null);
  const [avisoProtocoloSemDuracao, setAvisoProtocoloSemDuracao] = useState(false);

  // Precificação (FEAT-precificacao-hora-clinica, Fase 2B)
  const [duracaoTexto, setDuracaoTexto] = useState('');
  // true enquanto o campo guarda a duração preenchida pelo protocolo, sem edição
  const [duracaoVeioDoProtocolo, setDuracaoVeioDoProtocolo] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix_dinheiro');
  const [custoConfig, setCustoConfig] = useState<CustoHoraConfig | null>(null);
  const [custoConfigStatus, setCustoConfigStatus] = useState<'carregando' | 'ok' | 'erro'>(
    'carregando'
  );

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
        const now = new Date();
        const availableItems = items.filter(
          (item) => item.active && item.quantidade_disponivel > 0 && item.dt_validade > now
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

  // Custos fixos — a tela é exclusiva de clinic_admin, único papel que lê `financeiro`
  useEffect(() => {
    if (!tenantId || claims?.role !== 'clinic_admin') return;
    getCustoHoraConfig(tenantId)
      .then((config) => {
        setCustoConfig(config);
        setCustoConfigStatus('ok');
      })
      .catch((err) => {
        console.error('Erro ao carregar custos fixos:', err);
        setCustoConfigStatus('erro');
      });
  }, [tenantId, claims?.role]);

  // Carregar protocolos disponíveis
  useEffect(() => {
    if (!tenantId || isEditMode) return;
    listProtocolos(tenantId)
      .then(setProtocolos)
      .catch(() => {});
  }, [tenantId, isEditMode]);

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

      const duracaoParam = searchParams.get('duracaoMinutos');
      if (duracaoParam) setDuracaoTexto(duracaoParam);
      setFormaPagamento(parseFormaPagamento(searchParams.get('formaPagamento')));

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

  const handleAplicarProtocolo = (protocolo: Protocolo) => {
    // Produtos já na lista (adicionados manualmente ou por um protocolo
    // anterior) não são realocados -- alocarProdutoFEFO não sabe quanto já
    // está reservado no carrinho, então realocar o mesmo produto contaria a
    // mesma quantidade disponível duas vezes. Antes, aplicar um protocolo
    // sobrescrevia a lista inteira sem nenhum aviso, descartando o que já
    // tinha sido adicionado manualmente.
    const codigosJaSelecionados = new Set(produtosSelecionados.map((p) => p.produto_codigo));
    const jaNaLista: string[] = [];
    const insuficientes: string[] = [];
    const novosAlocados: ProdutoSelecionado[] = [];

    for (const item of protocolo.itens) {
      if (codigosJaSelecionados.has(item.codigo_produto)) {
        jaNaLista.push(item.codigo_produto);
        continue;
      }

      const fefo = alocarProdutoFEFO(item.codigo_produto, item.quantidade_sugerida);
      const alocado = fefo.reduce((sum, a) => sum + a.quantidade_solicitada, 0);
      if (alocado < item.quantidade_sugerida) {
        insuficientes.push(
          `${item.codigo_produto} (sugerido: ${item.quantidade_sugerida}, disponível: ${alocado})`
        );
      }
      novosAlocados.push(...fefo);
    }

    setProdutosSelecionados([...produtosSelecionados, ...novosAlocados]);
    setProtocoloSelecionado(protocolo);

    // D11: a duração do protocolo preenche o campo vazio; sem duração, vale 1 hora
    if (protocolo.duracao_minutos && duracaoTexto.trim() === '') {
      setDuracaoTexto(String(protocolo.duracao_minutos));
      setDuracaoVeioDoProtocolo(true);
    } else if (!protocolo.duracao_minutos) {
      setAvisoProtocoloSemDuracao(true);
    }

    if (insuficientes.length > 0) {
      toast({
        title: 'Protocolo aplicado com estoque insuficiente',
        description: `Ajuste manualmente: ${insuficientes.join('; ')}`,
        variant: 'destructive',
      });
    } else if (jaNaLista.length > 0) {
      toast({
        title: `Protocolo "${protocolo.nome}" aplicado`,
        description: `Produtos novos adicionados. Já estavam na lista (mantidos como estavam): ${jaNaLista.join(', ')}.`,
      });
    } else {
      toast({
        title: `Protocolo "${protocolo.nome}" aplicado`,
        description: 'Produtos adicionados à lista. Ajuste as quantidades se necessário.',
      });
    }
  };

  const handleAdicionarProduto = () => {
    const quantidade = parseInt(quantidadeSolicitada);

    if (tipoProcedimento === 'efetuado') {
      if (!selectedProductCode) {
        toast({
          title: 'Selecione um produto',
          description: 'Escolha um produto do inventário',
          variant: 'destructive',
        });
        return;
      }
      if (!selectedLoteId) {
        toast({
          title: 'Selecione o lote',
          description: 'Informe o lote utilizado no procedimento',
          variant: 'destructive',
        });
        return;
      }
      if (Number.isNaN(quantidade) || quantidade <= 0) {
        toast({
          title: 'Quantidade inválida',
          description: 'Informe uma quantidade válida',
          variant: 'destructive',
        });
        return;
      }

      const loteItem = inventoryItems.find((item) => item.id === selectedLoteId);
      if (!loteItem) return;

      if (quantidade > loteItem.quantidade_disponivel) {
        toast({
          title: 'Estoque insuficiente',
          description: `Disponível: ${loteItem.quantidade_disponivel} unidades`,
          variant: 'destructive',
        });
        return;
      }
      if (produtosSelecionados.some((p) => p.inventory_item_id === selectedLoteId)) {
        toast({
          title: 'Lote já adicionado',
          description: 'Este lote já está na lista',
          variant: 'destructive',
        });
        return;
      }

      setProdutosSelecionados([
        ...produtosSelecionados,
        {
          inventory_item_id: loteItem.id,
          produto_codigo: loteItem.codigo_produto,
          produto_nome: loteItem.nome_produto,
          lote: loteItem.lote,
          quantidade_solicitada: quantidade,
          quantidade_disponivel: loteItem.quantidade_disponivel,
          valor_unitario: loteItem.valor_unitario,
        },
      ]);
      setSelectedProductCode('');
      setSelectedLoteId('');
      setQuantidadeSolicitada('1');
      toast({
        title: 'Produto adicionado',
        description: `${loteItem.nome_produto} - Lote: ${loteItem.lote} (${quantidade} un)`,
      });
      return;
    }

    // Modo Programado — alocação FEFO automática
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

    const duracao = parseDuracaoMinutos(duracaoTexto);
    if ('erro' in duracao) {
      toast({ title: duracao.erro, variant: 'destructive' });
      return;
    }

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

  /** Só a duração presente no campo (digitada ou do protocolo); o padrão de 1 h não é gravado. */
  function duracaoDoCampo(): number | null {
    const duracao = parseDuracaoMinutos(duracaoTexto);
    return 'valor' in duracao ? duracao.valor : null;
  }

  /**
   * D10: snapshot do preço sugerido. Best-effort — o procedimento já foi
   * gravado e não pode falhar por causa da precificação.
   */
  async function registrarPrecificacao(
    tenantId: string,
    solicitacaoId: string,
    produtosGravados: ProdutoSolicitado[] | undefined,
    origem: 'criacao' | 'edicao'
  ) {
    if (custoConfigStatus !== 'ok' || !custoConfig || !user) return;
    try {
      await salvarPrecificacaoProcedimento(
        tenantId,
        user.uid,
        montarSnapshotPrecificacao({
          tenantId,
          solicitacaoId,
          config: custoConfig,
          mesReferencia: mesReferenciaDoProcedimento(dtProcedimento),
          duracao,
          formaPagamento,
          produtos:
            produtosGravados ??
            produtosSelecionados.map((p) => ({
              quantidade: p.quantidade_solicitada,
              valor_unitario: p.valor_unitario,
            })),
          origem,
        })
      );
    } catch (err) {
      console.error('Erro ao registrar precificação do procedimento:', err);
      toast({
        title: 'Procedimento salvo, mas a precificação não foi registrada',
        description: 'O detalhe mostrará uma estimativa com os custos atuais.',
      });
    }
  }

  async function submitEditMode(tenantId: string, editId: string, userName: string) {
    const updatePayload: Parameters<typeof updateSolicitacaoAgendada>[4] = {
      descricao: descricao || undefined,
      dt_procedimento: new Date(dtProcedimento),
      produtos: buildProdutosPayload(),
      duracao_minutos: duracaoDoCampo(),
      forma_pagamento: formaPagamento,
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
      await registrarPrecificacao(tenantId, editId, result.produtosSolicitados, 'edicao');
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
            protocolo_id: protocoloSelecionado?.id,
            protocolo_nome: protocoloSelecionado?.nome,
            duracao_minutos: duracaoDoCampo() ?? undefined,
            forma_pagamento: formaPagamento,
          } satisfies CreateSolicitacaoEfetuadaInput)
        : await createSolicitacaoWithConsumption(tenantId, user!.uid, userName, {
            descricao: descricao || undefined,
            dt_procedimento,
            produtos,
            observacoes: observacoes || undefined,
            protocolo_id: protocoloSelecionado?.id,
            protocolo_nome: protocoloSelecionado?.nome,
            duracao_minutos: duracaoDoCampo() ?? undefined,
            forma_pagamento: formaPagamento,
          } satisfies CreateSolicitacaoInput);

    if (result.success && result.solicitacaoId) {
      await registrarPrecificacao(
        tenantId,
        result.solicitacaoId,
        result.produtosSolicitados,
        'criacao'
      );
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

  const textoDuracao = parseDuracaoMinutos(duracaoTexto);
  const duracao = resolverDuracaoProcedimento({
    duracaoInformada: 'valor' in textoDuracao ? textoDuracao.valor : null,
    protocoloAplicado: protocoloSelecionado,
    campoPreenchidoPeloProtocolo: duracaoVeioDoProtocolo,
  });
  // D12: custos do mês da data do procedimento; sem data, prévia com o mês corrente
  const mesReferencia = dtProcedimento
    ? mesReferenciaDoProcedimento(dtProcedimento)
    : mesCorrenteSaoPaulo();
  const resumoCusto = useMemo(
    () => (custoConfig ? calcularResumoCustoHora(custoConfig, mesReferencia) : null),
    [custoConfig, mesReferencia]
  );
  const precificacao = calcularPrecificacaoProcedimento({
    duracaoMinutos: duracao.minutos,
    custoHora: resumoCusto?.custoHora ?? null,
    divisores: resumoCusto?.divisores ?? { pix_dinheiro: null, debito: null, credito: null },
    custoMaterial: calcularCustoMaterialSolicitacao(
      produtosSelecionados.map((p) => ({
        quantidade: p.quantidade_solicitada,
        valor_unitario: p.valor_unitario,
      }))
    ),
  });
  const rotuloFormaPagamento =
    FORMAS_PAGAMENTO.find((f) => f.key === formaPagamento)?.label ?? 'Pix/Dinheiro';

  const blocoPrecificacao = (
    <Card>
      <CardHeader>
        <CardTitle>Preço sugerido</CardTitle>
        <CardDescription>
          Custo dos materiais + hora clínica, com as taxas de cada forma de pagamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {custoConfigStatus === 'erro' && (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os custos fixos. Material: {formatCurrency(valorTotal)}
          </p>
        )}
        {custoConfigStatus === 'ok' && (!custoConfig || resumoCusto?.custoHora == null) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              Configure seus custos fixos para ver o preço sugerido. Material:{' '}
              {formatCurrency(valorTotal)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/clinic/my-clinic?tab=fixed_costs')}
              >
                Configurar custos fixos
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {custoConfig && resumoCusto?.custoHora != null && (
          <ProcedimentoPrecificacao
            duracaoMinutos={duracao.minutos}
            duracaoOrigem={duracao.origem}
            custoMaterial={precificacao.custoMaterial}
            custoHoraAplicado={precificacao.custoHoraAplicado}
            custoReal={precificacao.custoReal}
            precos={precificacao.precos}
            markup={custoConfig.markup}
            formaPagamento={formaPagamento}
            seloForma="Forma escolhida"
            mesReferencia={mesReferencia}
          />
        )}
        {custoConfig && resumoCusto?.custoHora != null && !dtProcedimento && (
          <p className="text-xs text-muted-foreground">
            Informe a data para calcular com os custos do mês do procedimento.
          </p>
        )}
      </CardContent>
    </Card>
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
                {!isEditMode && protocolos.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-dashed p-4 bg-muted/30">
                    <Label className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Usar Protocolo (opcional)
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={protocoloSelecionado?.id ?? ''}
                        onValueChange={(v) => {
                          if (!v) {
                            setProtocoloSelecionado(null);
                            return;
                          }
                          const p = protocolos.find((x) => x.id === v);
                          if (p) handleAplicarProtocolo(p);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um protocolo para pré-carregar produtos" />
                        </SelectTrigger>
                        <SelectContent>
                          {protocolos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {protocoloSelecionado && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setProtocoloSelecionado(null);
                            setProdutosSelecionados([]);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {protocoloSelecionado && (
                      <p className="text-xs text-muted-foreground">
                        Protocolo &quot;{protocoloSelecionado.nome}&quot; aplicado. Ajuste os
                        produtos abaixo se necessário.
                      </p>
                    )}
                  </div>
                )}

                {!isEditMode && (
                  <div className="space-y-2">
                    <Label>Tipo de Procedimento *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={tipoProcedimento === 'programado' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          setTipoProcedimento('programado');
                          setSelectedLoteId('');
                        }}
                      >
                        Procedimento Programado
                      </Button>
                      <Button
                        type="button"
                        variant={tipoProcedimento === 'efetuado' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          setTipoProcedimento('efetuado');
                          setSelectedLoteId('');
                        }}
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="duracao">Duração (min)</Label>
                    <Input
                      id="duracao"
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      placeholder="Ex: 60"
                      value={duracaoTexto}
                      onChange={(e) => {
                        setDuracaoTexto(e.target.value);
                        setDuracaoVeioDoProtocolo(false);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usada para calcular o custo da hora clínica. Em branco, considera 1 hora.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de pagamento</Label>
                    <FormaPagamentoSelector value={formaPagamento} onChange={setFormaPagamento} />
                    <p className="text-xs text-muted-foreground">
                      Informativa: o preço sugerido mostra as três formas.
                    </p>
                  </div>
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
                      onValueChange={(v) => {
                        setSelectedProductCode(v);
                        setSelectedLoteId('');
                      }}
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

                {tipoProcedimento === 'efetuado' && selectedProductCode && (
                  <div className="space-y-2">
                    <Label htmlFor="lote">Lote Utilizado *</Label>
                    <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                      <SelectTrigger id="lote">
                        <SelectValue placeholder="Selecione o lote utilizado no procedimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryItems
                          .filter((item) => item.codigo_produto === selectedProductCode)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              Lote {item.lote} — {item.quantidade_disponivel} un. disponíveis (val.{' '}
                              {String(item.dt_validade)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                                {formatCurrency(produto.valor_unitario)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(
                                  produto.quantidade_solicitada * produto.valor_unitario
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
                              {formatCurrency(valorTotal)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {produtosSelecionados.length > 0 && blocoPrecificacao}

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
                  <div>
                    <Label className="text-muted-foreground">Duração</Label>
                    <p className="font-medium">
                      {duracao.minutos} min
                      {duracao.origem === 'padrao' ? ' (padrão — duração não informada)' : ''}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Forma de pagamento</Label>
                    <p className="font-medium">{rotuloFormaPagamento}</p>
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
                  {produtosSelecionados.length} produto(s) - Total: {formatCurrency(valorTotal)}
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
                          {formatCurrency(produto.quantidade_solicitada * produto.valor_unitario)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {blocoPrecificacao}

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

      <AlertDialog open={avisoProtocoloSemDuracao} onOpenChange={setAvisoProtocoloSemDuracao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Protocolo sem duração</AlertDialogTitle>
            <AlertDialogDescription>
              O protocolo &quot;{protocoloSelecionado?.nome}&quot; não tem duração cadastrada. Será
              considerada 1 hora de procedimento, a menos que você informe a duração neste
              procedimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
