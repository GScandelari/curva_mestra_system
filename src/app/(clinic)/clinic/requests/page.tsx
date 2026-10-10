'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, Search, Calendar, Package, Settings } from 'lucide-react';
import { listSolicitacoes, type SolicitacaoWithDetails } from '@/lib/services/solicitacaoService';
import {
  getDashboardProcedimentosStats,
  type DashboardProcedimentosStats,
} from '@/lib/services/dashboardService';
import { formatTimestamp } from '@/lib/utils';
import { getCustoHoraConfig } from '@/lib/services/custoHoraService';
import { listPrecificacoesProcedimentos } from '@/lib/services/precificacaoProcedimentoService';
import {
  FORMAS_PAGAMENTO,
  estimarPrecificacaoProcedimento,
  formatarDataProcedimento,
} from '@/lib/precificacao';
import type { CustoHoraConfig, FormaPagamento, PrecificacaoProcedimento } from '@/types';

interface PrecificacaoLinha {
  custoReal: number | null;
  precoSugerido: number | null;
  forma: FormaPagamento;
  estimado: boolean;
}

/** Snapshot gravado prevalece; sem ele, estimativa atual (RN-30). */
function precificacaoDaLinha(
  solicitacao: SolicitacaoWithDetails,
  snapshots: Map<string, PrecificacaoProcedimento>,
  config: CustoHoraConfig | null
): PrecificacaoLinha | null {
  const snapshot = snapshots.get(solicitacao.id);
  if (snapshot) {
    return {
      custoReal: snapshot.custo_real,
      precoSugerido: snapshot.precos_sugeridos[snapshot.forma_pagamento],
      forma: snapshot.forma_pagamento,
      estimado: false,
    };
  }
  if (!config || !solicitacao.dt_procedimento?.toDate) return null;
  const estimativa = estimarPrecificacaoProcedimento(config, {
    dtProcedimento: solicitacao.dt_procedimento.toDate(),
    duracao_minutos: solicitacao.duracao_minutos,
    forma_pagamento: solicitacao.forma_pagamento,
    produtos: solicitacao.produtos_solicitados,
  });
  return {
    custoReal: estimativa.calculo.custoReal,
    precoSugerido: estimativa.calculo.precos[estimativa.formaPagamento],
    forma: estimativa.formaPagamento,
    estimado: true,
  };
}

const ROTULO_FORMA = new Map(FORMAS_PAGAMENTO.map(({ key, label }) => [key, label]));

export default function SolicitacoesPage() {
  const { claims } = useAuth();
  const router = useRouter();

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === 'clinic_admin';

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesStats, setMesStats] = useState<DashboardProcedimentosStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [snapshots, setSnapshots] = useState<Map<string, PrecificacaoProcedimento>>(new Map());
  const [custoConfig, setCustoConfig] = useState<CustoHoraConfig | null>(null);

  // Precificação: dado financeiro interno, só clinic_admin lê (RNF-08)
  useEffect(() => {
    if (!tenantId || !isAdmin) return;
    Promise.all([listPrecificacoesProcedimentos(tenantId), getCustoHoraConfig(tenantId)])
      .then(([mapa, config]) => {
        setSnapshots(mapa);
        setCustoConfig(config);
      })
      .catch((error) => console.error('Erro ao carregar precificação dos procedimentos:', error));
  }, [tenantId, isAdmin]);

  useEffect(() => {
    async function loadSolicitacoes() {
      if (!tenantId) return;

      try {
        setLoading(true);
        const data = await listSolicitacoes(tenantId, {
          status: statusFilter === 'all' ? undefined : statusFilter,
        });
        setSolicitacoes(data);
      } catch (error) {
        console.error('Erro ao carregar procedimentos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSolicitacoes();
  }, [tenantId, statusFilter]);

  useEffect(() => {
    async function loadStats() {
      if (!tenantId) return;
      try {
        setLoadingStats(true);
        const stats = await getDashboardProcedimentosStats(tenantId);
        setMesStats(stats);
      } catch (error) {
        console.error('Erro ao carregar stats do mês:', error);
      } finally {
        setLoadingStats(false);
      }
    }
    loadStats();
  }, [tenantId]);

  const mesLabel = (() => {
    const s = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const filteredSolicitacoes = solicitacoes.filter((sol) => {
    const matchesSearch =
      !searchTerm || (sol.descricao ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      agendada: 'secondary',
      efetuada: 'secondary',
      aprovada: 'default',
      concluida: 'default',
      reprovada: 'destructive',
      cancelada: 'destructive',
    };

    const labels: Record<string, string> = {
      agendada: 'Agendada',
      efetuada: 'Efetuada',
      aprovada: 'Aprovada',
      concluida: 'Concluída',
      reprovada: 'Reprovada',
      cancelada: 'Cancelada',
    };

    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Procedimentos</h2>
            <p className="text-muted-foreground">
              Histórico de consumo de produtos por procedimento
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/clinic/requests/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Procedimento
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mês: {mesLabel}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{mesStats?.total ?? '—'}</div>
                  {mesStats &&
                    (mesStats.totalMesAnterior === 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">Primeiro mês com dados</p>
                    ) : (
                      <p
                        className={`text-xs mt-1 ${
                          mesStats.crescimentoAbsoluto > 0
                            ? 'text-green-600'
                            : mesStats.crescimentoAbsoluto < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {mesStats.crescimentoAbsoluto > 0
                          ? '▲'
                          : mesStats.crescimentoAbsoluto < 0
                            ? '▼'
                            : '→'}{' '}
                        {mesStats.crescimentoAbsoluto > 0 ? '+' : ''}
                        {mesStats.crescimentoPercent}% (
                        {mesStats.crescimentoAbsoluto > 0 ? '+' : ''}
                        {mesStats.crescimentoAbsoluto} vs mês anterior)
                      </p>
                    ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{mesStats?.agendadasMes ?? '—'}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{mesStats?.concluidasMes ?? '—'}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busque e filtre os procedimentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="efetuada">Efetuada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Procedimentos */}
        <Card>
          <CardHeader>
            <CardTitle>Procedimentos ({filteredSolicitacoes.length})</CardTitle>
            <CardDescription>Lista de todos os procedimentos realizados</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSolicitacoes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhum procedimento encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? 'Tente ajustar os filtros de busca'
                    : 'Crie seu primeiro procedimento'}
                </p>
                <Button onClick={() => router.push('/clinic/requests/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Procedimento
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Data Procedimento</TableHead>
                      <TableHead className="text-right">Produtos</TableHead>
                      <TableHead className="text-right">Material</TableHead>
                      {isAdmin && <TableHead className="text-right">Custo real</TableHead>}
                      {isAdmin && <TableHead className="text-right">Preço sugerido</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSolicitacoes.map((solicitacao) => (
                      <TableRow key={solicitacao.id}>
                        <TableCell>
                          <div className="font-medium">{solicitacao.descricao || '—'}</div>
                        </TableCell>
                        <TableCell>
                          {solicitacao.dt_procedimento?.toDate
                            ? formatarDataProcedimento(solicitacao.dt_procedimento.toDate())
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{solicitacao.total_produtos}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(solicitacao.valor_total)}
                        </TableCell>
                        {isAdmin && (
                          <PrecificacaoCells
                            linha={precificacaoDaLinha(solicitacao, snapshots, custoConfig)}
                            formatCurrency={formatCurrency}
                          />
                        )}
                        <TableCell>{getStatusBadge(solicitacao.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatTimestamp(solicitacao.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/clinic/requests/${solicitacao.id}`)}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Gerenciar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrecificacaoCells({
  linha,
  formatCurrency,
}: Readonly<{ linha: PrecificacaoLinha | null; formatCurrency: (v: number) => string }>) {
  const fmt = (v: number | null | undefined) => (v == null ? '—' : formatCurrency(v));
  return (
    <>
      <TableCell className="text-right">{fmt(linha?.custoReal)}</TableCell>
      <TableCell className="text-right">
        <div className="font-medium">{fmt(linha?.precoSugerido)}</div>
        {linha && (
          <div className="text-xs text-muted-foreground">
            {ROTULO_FORMA.get(linha.forma)}
            {linha.estimado ? ' · estimado' : ''}
          </div>
        )}
      </TableCell>
    </>
  );
}
