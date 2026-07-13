'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { PackageSearch, CheckCircle, ExternalLink } from 'lucide-react';
import {
  listPendingMasterProducts,
  resolvePendingMasterProduct,
} from '@/lib/services/pendingMasterProductService';
import { getTenant } from '@/lib/services/tenantServiceDirect';
import type { PendingMasterProduct } from '@/types/pendingMasterProduct';
import { useToast } from '@/hooks/use-toast';

interface PendingRow extends PendingMasterProduct {
  tenant_nome: string;
}

export default function PendingProductsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    try {
      setLoading(true);
      const pending = await listPendingMasterProducts();

      const tenantNomeCache = new Map<string, string>();
      const withTenantNome: PendingRow[] = [];

      for (const item of pending) {
        let tenantNome = tenantNomeCache.get(item.tenant_id);

        if (!tenantNome) {
          try {
            const { tenant } = await getTenant(item.tenant_id);
            tenantNome = tenant.name;
          } catch {
            tenantNome = item.tenant_id;
          }
          tenantNomeCache.set(item.tenant_id, tenantNome);
        }

        withTenantNome.push({ ...item, tenant_nome: tenantNome });
      }

      setRows(withTenantNome);
    } catch (error) {
      console.error('Erro ao carregar produtos pendentes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos pendentes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(pendingId: string) {
    setResolvingId(pendingId);

    try {
      await resolvePendingMasterProduct(pendingId);
      toast({ title: 'Pendência removida' });
      setRows((prev) => prev.filter((r) => r.id !== pendingId));
    } catch (error) {
      console.error('Erro ao resolver pendência:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a pendência',
        variant: 'destructive',
      });
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Produtos Pendentes de Cadastro</h2>
            <p className="text-muted-foreground">
              Produtos identificados em imports de NF-e que ainda não existem no catálogo master
            </p>
          </div>
          <Button onClick={loadPending} variant="outline">
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fila de Pendências</CardTitle>
            <CardDescription>
              Cadastre o produto em &quot;Produtos&quot; usando o código exibido; depois marque como
              resolvido para tirá-lo da fila. A clínica pode reenviar o XML da NF-e para completar a
              importação assim que o produto estiver cadastrado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma pendência</h3>
                <p className="text-muted-foreground">
                  Todos os produtos das NFs importadas estão cadastrados no catálogo master
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto (nome no XML)</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.tenant_nome}</TableCell>
                      <TableCell>{row.numero_nf}</TableCell>
                      <TableCell className="font-mono text-sm">{row.codigo}</TableCell>
                      <TableCell>{row.nome_produto}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.created_at instanceof Date
                          ? row.created_at.toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push('/admin/products/new')}
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Cadastrar Produto
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleResolve(row.id)}
                          disabled={resolvingId === row.id}
                        >
                          <PackageSearch className="mr-1 h-4 w-4" />
                          {resolvingId === row.id ? 'Removendo...' : 'Marcar Resolvido'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
