'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Package,
  AlertTriangle,
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  DollarSign,
  ShieldAlert,
  Minus,
} from 'lucide-react';
import {
  getDashboardEstoqueStats,
  getDashboardProcedimentosStats,
  type DashboardEstoqueStats,
  type DashboardProcedimentosStats,
} from '@/lib/services/dashboardService';
import {
  getExpiringProducts,
  getRecentActivity,
  type ExpiringProduct,
  type RecentActivity as ActivityType,
} from '@/lib/services/inventoryService';
import { getUpcomingProcedures } from '@/lib/services/solicitacaoService';
import type { Solicitacao } from '@/types';
import { formatTimestamp } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';

interface AlertasStats {
  vencidos: number;
  vencendo30dias: number;
  estoqueBaixo: number;
}

export default function ClinicDashboard() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [estoqueStats, setEstoqueStats] = useState<DashboardEstoqueStats | null>(null);
  const [procedimentosStats, setProcedimentosStats] = useState<DashboardProcedimentosStats | null>(
    null
  );
  const [alertasStats, setAlertasStats] = useState<AlertasStats | null>(null);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityType[]>([]);
  const [upcomingProcedures, setUpcomingProcedures] = useState<Solicitacao[]>([]);

  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [error, setError] = useState('');

  const tenantId = claims?.tenant_id;

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Listener realtime para alertas (inventário — dado crítico)
  useEffect(() => {
    if (!tenantId) return;

    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
    const inventoryQuery = query(inventoryRef, where('active', '==', true));

    const unsubscribe = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(now.getDate() + 30);

        let vencidos = 0;
        let vencendo30dias = 0;
        let estoqueBaixo = 0;
        const expiring: ExpiringProduct[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const quantidade = data.quantidade_disponivel || 0;
          if (quantidade <= 0) return;

          const dtValidade =
            data.dt_validade instanceof Timestamp
              ? data.dt_validade.toDate()
              : new Date(data.dt_validade);

          const diasParaVencer = Math.ceil(
            (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (dtValidade < now) {
            vencidos++;
          } else if (dtValidade <= in30Days) {
            vencendo30dias++;
            if (expiring.length < 5) {
              expiring.push({
                id: docSnap.id,
                nome_produto: data.nome_produto,
                lote: data.lote,
                quantidade_disponivel: quantidade,
                dt_validade: dtValidade,
                diasParaVencer,
              });
            }
          }

          if (quantidade < 10) estoqueBaixo++;
        });

        expiring.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
        setAlertasStats({ vencidos, vencendo30dias, estoqueBaixo });
        setExpiringProducts(expiring);
      },
      () => setError('Erro ao carregar alertas de estoque')
    );

    return () => unsubscribe();
  }, [tenantId]);

  // Carregar blocos de resumo e seções de detalhe
  useEffect(() => {
    if (!tenantId) return;

    setLoadingBlocks(true);
    setLoadingDetails(true);
    setError('');

    Promise.all([getDashboardEstoqueStats(tenantId), getDashboardProcedimentosStats(tenantId)])
      .then(([estoque, procedimentos]) => {
        setEstoqueStats(estoque);
        setProcedimentosStats(procedimentos);
      })
      .catch(() => setError('Erro ao carregar dados do dashboard'))
      .finally(() => setLoadingBlocks(false));

    Promise.all([getRecentActivity(tenantId, 5), getUpcomingProcedures(tenantId, 5)])
      .then(([activity, upcoming]) => {
        setRecentActivity(activity);
        setUpcomingProcedures(upcoming);
      })
      .catch(() => {})
      .finally(() => setLoadingDetails(false));
  }, [tenantId]);

  // ── Formatters ──────────────────────────────────────────────────────────────

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

  const formatProcedureDate = (timestamp: Timestamp | Date | undefined) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Atrasado';
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays <= 7) return `Em ${diffDays} dias`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
  };

  const getExpiryBadgeVariant = (dias: number): 'destructive' | 'warning' | 'default' => {
    if (dias <= 0 || dias <= 7) return 'destructive';
    if (dias <= 30) return 'warning';
    return 'default';
  };

  const getExpiryText = (dias: number) => {
    if (dias < 0) return 'Vencido';
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return `${dias} dias`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'reprovada':
      case 'cancelada':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      criada: 'Criada',
      agendada: 'Agendada',
      aprovada: 'Aprovada',
      concluida: 'Concluída',
      reprovada: 'Reprovada',
      cancelada: 'Cancelada',
    };
    return labels[status] ?? status;
  };

  // ── Crescimento badge ────────────────────────────────────────────────────────

  const CrescimentoBadge = ({ percent }: { percent: number | null }) => {
    if (percent === null)
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" /> Sem dados do mês anterior
        </span>
      );
    if (percent > 0)
      return (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <TrendingUp className="h-3 w-3" /> +{percent}% vs mês anterior
        </span>
      );
    if (percent < 0)
      return (
        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
          <TrendingDown className="h-3 w-3" /> {percent}% vs mês anterior
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> Igual ao mês anterior
      </span>
    );
  };

  // ── Skeleton helpers ─────────────────────────────────────────────────────────

  const BlockSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, {user?.displayName?.split(' ')[0]}!
          </h2>
          <p className="text-muted-foreground">Visão geral da clínica</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ── 3 Blocos de resumo ─────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* ESTOQUE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-blue-600" />
                Estoque
              </CardTitle>
              <CardDescription>Unidades e valor por categoria</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBlocks ? (
                <BlockSkeleton />
              ) : !estoqueStats || estoqueStats.categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto em estoque
                </p>
              ) : (
                <div className="space-y-3">
                  {estoqueStats.categorias.map((cat) => (
                    <div key={cat.nome} className="space-y-0.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.nome}</span>
                        <span className="text-muted-foreground">{cat.totalUnidades} un.</span>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {formatCurrency(cat.totalValor)}
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 space-y-1">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span>{estoqueStats.totalUnidades} un.</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{estoqueStats.totalCategorias} categorias</span>
                      <span>{formatCurrency(estoqueStats.totalValor)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PROCEDIMENTOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-purple-600" />
                Procedimentos
              </CardTitle>
              <CardDescription className="capitalize">{mesAtual}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBlocks ? (
                <BlockSkeleton />
              ) : !procedimentosStats ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de procedimentos
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Realizados</span>
                      <span className="font-semibold">{procedimentosStats.feitos}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Agendados</span>
                      <span className="font-semibold">{procedimentosStats.agendados}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium">Total do mês</span>
                      <span className="font-bold text-lg leading-none">
                        {procedimentosStats.total}
                      </span>
                    </div>
                  </div>
                  <CrescimentoBadge percent={procedimentosStats.crescimentoPercent} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ALERTAS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Alertas
              </CardTitle>
              <CardDescription>Atenção imediata necessária</CardDescription>
            </CardHeader>
            <CardContent>
              {!alertasStats ? (
                <BlockSkeleton />
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/clinic/inventory?filter=expired')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>Produtos vencidos</span>
                    </div>
                    <span
                      className={`font-bold text-lg ${alertasStats.vencidos > 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                    >
                      {alertasStats.vencidos}
                    </span>
                  </button>
                  <button
                    onClick={() => router.push('/clinic/inventory?filter=expiring')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span>Vencem em 30 dias</span>
                    </div>
                    <span
                      className={`font-bold text-lg ${alertasStats.vencendo30dias > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}
                    >
                      {alertasStats.vencendo30dias}
                    </span>
                  </button>
                  <button
                    onClick={() => router.push('/clinic/inventory?filter=low-stock')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-orange-600" />
                      <span>Estoque baixo</span>
                    </div>
                    <span
                      className={`font-bold text-lg ${alertasStats.estoqueBaixo > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}
                    >
                      {alertasStats.estoqueBaixo}
                    </span>
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Seções de detalhe ──────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* PRÓXIMOS PROCEDIMENTOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Próximos Procedimentos
              </CardTitle>
              <CardDescription>Procedimentos agendados nas próximas 2 semanas</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetails ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                </div>
              ) : upcomingProcedures.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum procedimento agendado nas próximas 2 semanas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingProcedures.map((proc) => (
                    <div
                      key={proc.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/clinic/requests?id=${proc.id}`)}
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-sm leading-tight">
                          {proc.descricao || 'Procedimento sem descrição'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{proc.produtos_solicitados?.length || 0} produtos</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span>{formatProcedureDate(proc.dt_procedimento)}</span>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(proc.status) as any}>
                        {getStatusLabel(proc.status)}
                      </Badge>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push('/clinic/requests')}
                  >
                    Ver todos os procedimentos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ATIVIDADE RECENTE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Atividade Recente
              </CardTitle>
              <CardDescription>Últimas movimentações do estoque</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetails ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação recente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                    >
                      <div
                        className={`p-2 rounded-full ${
                          activity.tipo === 'entrada'
                            ? 'bg-green-100 text-green-600'
                            : activity.tipo === 'saida'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {activity.tipo === 'entrada' ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-tight">{activity.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.nome_produto} • {activity.quantidade} unidades
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertas de vencimento (detalhe) */}
        {expiringProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Produtos a Vencer
              </CardTitle>
              <CardDescription>Produtos vencendo nos próximos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expiringProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm leading-tight">{product.nome_produto}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Lote: {product.lote}</span>
                        <span>•</span>
                        <span>{product.quantidade_disponivel} un.</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(product.dt_validade)}</span>
                      </div>
                    </div>
                    <Badge variant={getExpiryBadgeVariant(product.diasParaVencer) as any}>
                      {getExpiryText(product.diasParaVencer)}
                    </Badge>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/clinic/inventory?filter=expiring')}
                >
                  Ver todos os alertas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
