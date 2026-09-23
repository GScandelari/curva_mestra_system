'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { TrendingDown, ArrowLeft, Info, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getReplenishmentProjections,
  type ProductProjection,
} from '@/lib/services/projectionService';
import { formatDecimalBR } from '@/lib/services/reportService';

interface ProjectionsViewProps {
  tenantId: string;
  backUrl?: string;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    date
  );

export function ProjectionsView({ tenantId, backUrl }: ProjectionsViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [projections, setProjections] = useState<ProductProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadProjections = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await getReplenishmentProjections(tenantId);
      setProjections(data);
    } catch (err) {
      console.error('Erro ao carregar projeções:', err);
      setError(true);
      toast({ title: 'Erro ao carregar projeções de reposição', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    loadProjections();
  }, [loadProjections]);

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {backUrl && (
          <Button variant="ghost" onClick={() => router.push(backUrl)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        )}

        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-8 w-8 text-sky-600" />
            Projeções Gerais
          </h2>
          <p className="text-muted-foreground">
            Estimativa de quando cada produto vai esgotar, com base no consumo histórico real
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Isto é uma estimativa</AlertTitle>
          <AlertDescription>
            Estimativa baseada no histórico de consumo real — não é uma garantia. A janela de
            histórico usada em cada linha está indicada na coluna &quot;Janela Usada&quot;.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Produtos ({projections.length})</CardTitle>
            <CardDescription>
              Ordenados pela data estimada de esgotamento mais próxima
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-destructive">Não foi possível carregar as projeções.</p>
                <Button variant="outline" onClick={loadProjections}>
                  Tentar novamente
                </Button>
              </div>
            ) : projections.length === 0 ? (
              <div className="text-center py-12">
                <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Nenhum produto ativo no estoque</h3>
                <p className="text-sm text-muted-foreground">
                  Não há produtos ativos para calcular projeções de reposição
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd. Disponível</TableHead>
                      <TableHead className="text-right">Taxa de Consumo Diária</TableHead>
                      <TableHead>Data Estimada</TableHead>
                      <TableHead>Janela Usada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((projection) => (
                      <TableRow key={projection.codigo_produto}>
                        <TableCell className="font-mono text-xs">
                          {projection.codigo_produto}
                        </TableCell>
                        <TableCell className="font-medium">{projection.nome_produto}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">
                          {projection.quantidade_disponivel_total}
                        </TableCell>
                        <TableCell className="text-right">
                          {projection.taxa_consumo_diaria !== null
                            ? `${formatDecimalBR(projection.taxa_consumo_diaria, 2)} un./dia`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {projection.dados_insuficientes ? (
                            <Badge variant="secondary" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Dados insuficientes para projeção
                            </Badge>
                          ) : (
                            <span className="text-sm font-medium">
                              {formatDate(projection.data_estimada_esgotamento!)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {projection.janela_usada_dias !== null ? (
                            <Badge variant="outline">{projection.janela_usada_dias} dias</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
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
