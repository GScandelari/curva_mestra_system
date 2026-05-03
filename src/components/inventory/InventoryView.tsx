'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Package,
  Search,
  AlertTriangle,
  Calendar,
  TrendingDown,
  ArrowLeft,
  Download,
  Plus,
  Tag,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MASTER_PRODUCT_CATEGORIES } from '@/types/masterProduct';
import { ReadOnlyBanner } from '@/components/consultant/ReadOnlyBanner';
import { exportToExcel, formatDecimalBR } from '@/lib/services/reportService';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { type InventoryItem } from '@/lib/services/inventoryService';
import { getStatusEstoque, type StatusEstoque } from '@/lib/inventoryUtils';

interface InventoryViewProps {
  tenantId: string;
  realtime?: boolean;
  readOnly?: boolean;
  backUrl?: string;
  isAdmin?: boolean;
  initialFilter?: string;
  onRowClick?: (itemId: string) => void;
  onAddProducts?: () => void;
}

function parseItem(doc: { id: string; data: () => Record<string, unknown> }): InventoryItem {
  const data = doc.data();
  return {
    id: doc.id,
    tenant_id: data.tenant_id as string,
    produto_id: data.produto_id as string,
    codigo_produto: data.codigo_produto as string,
    nome_produto: data.nome_produto as string,
    lote: data.lote as string,
    quantidade_inicial: data.quantidade_inicial as number,
    quantidade_disponivel: data.quantidade_disponivel as number,
    quantidade_reservada: data.quantidade_reservada as number | undefined,
    dt_validade:
      data.dt_validade instanceof Timestamp
        ? data.dt_validade.toDate()
        : new Date(data.dt_validade as string),
    dt_entrada:
      data.dt_entrada instanceof Timestamp
        ? data.dt_entrada.toDate()
        : new Date(data.dt_entrada as string),
    valor_unitario: data.valor_unitario as number,
    nf_numero: data.nf_numero as string | undefined,
    nf_id: data.nf_id as string | undefined,
    category: data.category as string | undefined,
    active: data.active as boolean,
    created_at:
      data.created_at instanceof Timestamp
        ? data.created_at.toDate()
        : new Date((data.created_at as string) || Date.now()),
    updated_at:
      data.updated_at instanceof Timestamp
        ? data.updated_at.toDate()
        : new Date((data.updated_at as string) || Date.now()),
  };
}

function applyFilter(
  data: InventoryItem[],
  filter: string,
  search: string,
  category: string,
  limitsMap: Map<string, number>,
  totalByCode: Map<string, number>
): InventoryItem[] {
  let filtered = [...data];

  const productStatus = (item: InventoryItem): StatusEstoque =>
    getStatusEstoque({
      quantidade_disponivel: totalByCode.get(item.codigo_produto) ?? item.quantidade_disponivel,
      limite_estoque_baixo: limitsMap.get(item.codigo_produto),
    });

  if (filter === 'expiring') {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);
    filtered = filtered.filter(
      (item) => item.dt_validade <= in30Days && item.quantidade_disponivel > 0
    );
  } else if (filter === 'low_stock') {
    filtered = filtered.filter((item) => productStatus(item) === 'Baixo');
  } else if (filter === 'out_of_stock') {
    filtered = filtered.filter((item) => item.quantidade_disponivel === 0);
  }

  if (category !== 'all') {
    filtered = filtered.filter((item) => item.category === category);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.nome_produto.toLowerCase().includes(searchLower) ||
        item.codigo_produto.toLowerCase().includes(searchLower) ||
        item.lote.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    date
  );

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getDaysUntilExpiry = (date: Date) =>
  Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

function ExpiryBadge({ date, quantity }: { date: Date; quantity: number }) {
  if (quantity === 0) return <Badge variant="secondary">Sem estoque</Badge>;
  const days = getDaysUntilExpiry(date);
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days <= 7) return <Badge variant="destructive">{days} dias</Badge>;
  if (days <= 30) return <Badge variant="warning">{days} dias</Badge>;
  return <Badge variant="default">{days} dias</Badge>;
}

function StockBadge({ status }: { status: StatusEstoque }) {
  if (status === 'Sem estoque')
    return (
      <Badge variant="destructive" className="gap-1">
        <TrendingDown className="h-3 w-3" />
        Esgotado
      </Badge>
    );
  if (status === 'Baixo')
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Baixo
      </Badge>
    );
  return <Badge variant="default">Normal</Badge>;
}

export function InventoryView({
  tenantId,
  realtime,
  readOnly,
  backUrl,
  isAdmin,
  initialFilter,
  onRowClick,
  onAddProducts,
}: InventoryViewProps) {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [limitsMap, setLimitsMap] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<string>(initialFilter ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quantidade total por codigo_produto (soma de todos os lotes)
  const totalByCode = new Map<string, number>();
  for (const item of inventory) {
    totalByCode.set(
      item.codigo_produto,
      (totalByCode.get(item.codigo_produto) ?? 0) + item.quantidade_disponivel
    );
  }

  const getItemStatus = (item: InventoryItem) =>
    getStatusEstoque({
      quantidade_disponivel: totalByCode.get(item.codigo_produto) ?? item.quantidade_disponivel,
      limite_estoque_baixo: limitsMap.get(item.codigo_produto),
    });

  const filteredInventory = applyFilter(inventory, filterBy, searchTerm, categoryFilter, limitsMap, totalByCode);

  useEffect(() => {
    const ref = collection(db, 'tenants', tenantId, 'inventory');
    const q = query(ref, where('active', '==', true), orderBy('nome_produto', 'asc'));

    // Carrega limites por produto (não crítico — falha silenciosa)
    getDocs(collection(db, 'tenants', tenantId, 'stock_limits'))
      .then((snap) => {
        const map = new Map<string, number>();
        snap.forEach((d) => map.set(d.id, d.data().limite_estoque_baixo as number));
        setLimitsMap(map);
      })
      .catch(() => {});

    if (realtime) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setInventory(snapshot.docs.map(parseItem));
          setLoading(false);
          setError('');
        },
        (err) => {
          console.error('Erro ao carregar inventário:', err);
          setError('Erro ao carregar inventário');
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      getDocs(q)
        .then((snapshot) => {
          setInventory(snapshot.docs.map(parseItem));
        })
        .catch((err) => {
          console.error('Erro ao carregar inventário:', err);
          setError('Erro ao carregar inventário');
        })
        .finally(() => setLoading(false));
    }
  }, [tenantId, realtime]);

  const handleExport = () => {
    const data = filteredInventory.map((item) => ({
      Código: item.codigo_produto,
      Produto: item.nome_produto,
      Lote: item.lote,
      'Qtd. Total': item.quantidade_disponivel + (item.quantidade_reservada || 0),
      Reservado: item.quantidade_reservada || 0,
      Disponível: item.quantidade_disponivel,
      Validade: formatDate(item.dt_validade),
      'Valor Unitário': formatDecimalBR(item.valor_unitario, 2),
      NF: item.nf_numero || '-',
    }));
    exportToExcel(data, 'inventario');
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {backUrl && (
          <Button variant="ghost" onClick={() => router.push(backUrl)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              {readOnly && <Package className="h-8 w-8 text-sky-600" />}
              {readOnly ? 'Estoque da Clínica' : 'Gerenciar Estoque'}
            </h2>
            <p className="text-muted-foreground">
              {readOnly
                ? 'Visualização do inventário de produtos'
                : 'Visualize e gerencie seus produtos e estoques'}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && onAddProducts && (
              <Button onClick={onAddProducts}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Produtos
              </Button>
            )}
            <Button variant="outline" onClick={handleExport} disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {readOnly && <ReadOnlyBanner />}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Produtos Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {inventory.reduce((acc, item) => acc + item.quantidade_disponivel, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {inventory.reduce((acc, item) => acc + (item.quantidade_reservada || 0), 0)}{' '}
                reservados
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Próximos ao Vencimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {
                  inventory.filter((item) => {
                    const days = getDaysUntilExpiry(item.dt_validade);
                    return days <= 30 && days >= 0 && item.quantidade_disponivel > 0;
                  }).length
                }
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {
                  new Set(
                    inventory
                      .filter((item) => getItemStatus(item) === 'Baixo')
                      .map((item) => item.codigo_produto)
                  ).size
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros e Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por produto, código ou lote..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {MASTER_PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'expiring', 'low_stock', 'out_of_stock'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filterBy === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterBy(f)}
                  >
                    {f === 'expiring' && <AlertTriangle className="mr-2 h-4 w-4" />}
                    {f === 'low_stock' && <TrendingDown className="mr-2 h-4 w-4" />}
                    {
                      {
                        all: 'Todos',
                        expiring: 'Vencendo',
                        low_stock: 'Estoque Baixo',
                        out_of_stock: 'Esgotado',
                      }[f]
                    }
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos ({filteredInventory.length})</CardTitle>
            <CardDescription>Lista completa de produtos no estoque</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">{error}</div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Nenhum produto encontrado</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterBy !== 'all'
                    ? 'Tente ajustar os filtros ou busca'
                    : readOnly
                      ? 'Esta clínica ainda não possui produtos no estoque'
                      : 'Faça upload de uma DANFE para adicionar produtos'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">Qtd. Total</TableHead>
                      <TableHead className="text-right">Reservado</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="text-right">Valor Un.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow
                        key={item.id}
                        className={onRowClick ? 'cursor-pointer hover:bg-accent/50' : undefined}
                        onClick={onRowClick ? () => onRowClick(item.id) : undefined}
                      >
                        <TableCell className="font-mono text-xs">{item.codigo_produto}</TableCell>
                        <TableCell className="font-medium">{item.nome_produto}</TableCell>
                        <TableCell className="font-mono text-xs">{item.lote}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">
                          {item.quantidade_disponivel + (item.quantidade_reservada || 0)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 font-medium">
                          {item.quantidade_reservada || 0}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {item.quantidade_disponivel}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{formatDate(item.dt_validade)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.valor_unitario)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <ExpiryBadge
                              date={item.dt_validade}
                              quantity={item.quantidade_disponivel}
                            />
                            <StockBadge status={getItemStatus(item)} />
                          </div>
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
