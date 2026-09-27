'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { listAuditLog, type UnifiedAuditItem } from '@/lib/services/auditLogService';
import { listTenants } from '@/lib/services/tenantServiceDirect';

const PAGE_SIZE = 100;

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface AuditLogViewProps {
  scope: 'system_admin' | 'clinic_admin';
  tenantId?: string;
}

function formatDateTime(date: Date): string {
  if (date.getTime() === 0) return '—';
  return date.toLocaleString('pt-BR');
}

function toDayStart(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

function toDayEnd(value: string): number {
  return new Date(`${value}T23:59:59.999`).getTime();
}

export function AuditLogView({ scope, tenantId }: AuditLogViewProps) {
  const isSystemAdmin = scope === 'system_admin';

  const [items, setItems] = useState<UnifiedAuditItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [acao, setAcao] = useState('');
  const [ator, setAtor] = useState('');
  const [clinica, setClinica] = useState('');

  const load = useCallback(
    async (size: number) => {
      try {
        setError('');
        const result = await listAuditLog({ scope, tenantId, pageSize: size });
        setItems(result.items);
        setHasMore(result.hasMore);
      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar a trilha de auditoria.');
      }
    },
    [scope, tenantId]
  );

  useEffect(() => {
    if (!isSystemAdmin && !tenantId) return;
    setLoading(true);
    load(PAGE_SIZE).finally(() => setLoading(false));
  }, [load, isSystemAdmin, tenantId]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    listTenants({ limit: 200 })
      .then(({ tenants }) => {
        setTenantNames(Object.fromEntries(tenants.map((t) => [t.id, t.name])));
      })
      .catch((err) => console.error(err));
  }, [isSystemAdmin]);

  async function handleLoadMore() {
    const nextSize = pageSize + PAGE_SIZE;
    setLoadingMore(true);
    await load(nextSize);
    setPageSize(nextSize);
    setLoadingMore(false);
  }

  const categoriaOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.categoria))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const acaoOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.acao))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const clinicaOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.tenant_id).filter((t): t is string => !!t))).sort(
        (a, b) => (tenantNames[a] ?? a).localeCompare(tenantNames[b] ?? b)
      ),
    [items, tenantNames]
  );

  const filtered = useMemo(() => {
    const atorTerm = ator.trim().toLowerCase();
    return items.filter((item) => {
      const time = item.timestamp.getTime();
      if (dateFrom && time < toDayStart(dateFrom)) return false;
      if (dateTo && time > toDayEnd(dateTo)) return false;
      if (categoria && item.categoria !== categoria) return false;
      if (acao && item.acao !== acao) return false;
      if (atorTerm && !item.ator.toLowerCase().includes(atorTerm)) return false;
      if (isSystemAdmin && clinica && item.tenant_id !== clinica) return false;
      return true;
    });
  }, [items, dateFrom, dateTo, categoria, acao, ator, clinica, isSystemAdmin]);

  function clinicLabel(item: UnifiedAuditItem): string {
    if (!item.tenant_id) return '—';
    return tenantNames[item.tenant_id] ?? item.tenant_id;
  }

  const hasActiveFilter = !!(dateFrom || dateTo || categoria || acao || ator.trim() || clinica);

  function clearFilters() {
    setDateFrom('');
    setDateTo('');
    setCategoria('');
    setAcao('');
    setAtor('');
    setClinica('');
  }

  return (
    <div className="space-y-6" data-testid="audit-log-view">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trilha de Auditoria</h1>
        <p className="text-muted-foreground">
          {isSystemAdmin
            ? 'Ações administrativas e movimentações de estoque de todas as clínicas.'
            : 'Ações administrativas e movimentações de estoque da sua clínica.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="audit-date-from">De</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-date-to">Até</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-categoria">Categoria</Label>
              <select
                id="audit-categoria"
                className={selectClassName}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">Todas</option>
                {categoriaOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-acao">Ação</Label>
              <select
                id="audit-acao"
                className={selectClassName}
                value={acao}
                onChange={(e) => setAcao(e.target.value)}
              >
                <option value="">Todas</option>
                {acaoOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-ator">Ator</Label>
              <Input
                id="audit-ator"
                placeholder="Nome do ator"
                value={ator}
                onChange={(e) => setAtor(e.target.value)}
              />
            </div>
            {isSystemAdmin && (
              <div className="space-y-2">
                <Label htmlFor="audit-clinica">Clínica</Label>
                <select
                  id="audit-clinica"
                  className={selectClassName}
                  value={clinica}
                  onChange={(e) => setClinica(e.target.value)}
                >
                  <option value="">Todas</option>
                  {clinicaOptions.map((t) => (
                    <option key={t} value={t}>
                      {tenantNames[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription data-testid="audit-log-count">
            {filtered.length} registro(s) exibido(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center" data-testid="audit-log-empty">
              {items.length === 0
                ? 'Nenhum registro de auditoria encontrado.'
                : 'Nenhum registro corresponde aos filtros aplicados.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Descrição</TableHead>
                  {isSystemAdmin && <TableHead>Clínica</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`} data-testid="audit-log-row">
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(item.timestamp)}
                    </TableCell>
                    <TableCell>{item.ator}</TableCell>
                    <TableCell>{item.categoria}</TableCell>
                    <TableCell>{item.acao}</TableCell>
                    <TableCell>{item.descricao}</TableCell>
                    {isSystemAdmin && <TableCell>{clinicLabel(item)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && !error && hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
