'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, ClipboardList, Calculator } from 'lucide-react';
import { listProtocolos, deleteProtocolo } from '@/lib/services/protocoloService';
import { getCustoHoraConfig, listInventoryForCosting } from '@/lib/services/custoHoraService';
import ProtocoloPrecificacao from '@/components/pricing/ProtocoloPrecificacao';
import {
  calcularCustoMaterialProtocolo,
  calcularCustoMedioPorProduto,
  calcularPrecificacaoProtocolo,
  calcularResumoCustoHora,
  formatarMesReferencia,
  mesCorrenteSaoPaulo,
  type LoteParaCusto,
} from '@/lib/precificacao';
import type { CustoHoraConfig, Protocolo } from '@/types';

export default function ProtocolosPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === 'clinic_admin';

  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [custoConfig, setCustoConfig] = useState<CustoHoraConfig | null>(null);
  const [lotes, setLotes] = useState<LoteParaCusto[] | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    load();
  }, [tenantId]);

  // Precificação só para clinic_admin (RF-18): clinic_user nunca lê `financeiro`.
  useEffect(() => {
    if (!tenantId || !isAdmin) return;
    Promise.all([getCustoHoraConfig(tenantId), listInventoryForCosting(tenantId)])
      .then(([config, inventario]) => {
        setCustoConfig(config);
        setLotes(inventario);
      })
      .catch((error) => console.error('Erro ao carregar precificação dos protocolos:', error));
  }, [tenantId, isAdmin]);

  const mesAtual = useMemo(() => mesCorrenteSaoPaulo(), []);
  const custosMedios = useMemo(() => (lotes ? calcularCustoMedioPorProduto(lotes) : null), [lotes]);
  const resumo = useMemo(
    () => (custoConfig ? calcularResumoCustoHora(custoConfig, mesAtual) : null),
    [custoConfig, mesAtual]
  );
  const precificacaoIndisponivel = !resumo || resumo.custoHora === null || resumo.divisor === null;

  async function load() {
    if (!tenantId) return;
    try {
      setLoading(true);
      setProtocolos(await listProtocolos(tenantId));
    } catch {
      toast({ title: 'Erro ao carregar protocolos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tenantId) return;
    try {
      await deleteProtocolo(tenantId, id);
      toast({ title: 'Protocolo removido com sucesso' });
      setProtocolos((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast({ title: 'Erro ao remover protocolo', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-8 w-8 text-primary" />
              Protocolos
            </h1>
            <p className="text-muted-foreground">
              Combinações pré-definidas de produtos para procedimentos recorrentes
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/clinic/protocolos/novo')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Protocolo
            </Button>
          )}
        </div>

        {isAdmin && custosMedios && precificacaoIndisponivel && (
          <Alert variant="warning">
            <Calculator className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              Configure seus custos fixos para ver o preço sugerido dos protocolos
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

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : protocolos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <ClipboardList className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Nenhum protocolo cadastrado</p>
                <p className="text-sm text-muted-foreground">
                  Crie protocolos para agilizar o registro de procedimentos recorrentes
                </p>
              </div>
              {isAdmin && (
                <Button onClick={() => router.push('/clinic/protocolos/novo')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro protocolo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {protocolos.map((protocolo) => (
              <Card key={protocolo.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{protocolo.nome}</CardTitle>
                    {protocolo.descricao && (
                      <p className="text-sm text-muted-foreground">{protocolo.descricao}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/clinic/protocolos/${protocolo.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingId(protocolo.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {protocolo.itens.map((item) => (
                      <Badge key={item.codigo_produto} variant="secondary">
                        {item.nome_produto} × {item.quantidade_sugerida}
                      </Badge>
                    ))}
                  </div>
                  {isAdmin && custosMedios && (
                    <ProtocoloPrecificacao
                      modo="admin"
                      duracaoMinutos={protocolo.duracao_minutos}
                      precificacao={calcularPrecificacaoProtocolo({
                        duracaoMinutos: protocolo.duracao_minutos,
                        custoHora: resumo?.custoHora ?? null,
                        divisor: resumo?.divisor ?? null,
                        custoMaterial: calcularCustoMaterialProtocolo(
                          protocolo.itens,
                          custosMedios
                        ),
                      })}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
            {isAdmin && resumo && !precificacaoIndisponivel && (
              <p className="text-xs text-muted-foreground">
                Valores com base nos custos de {formatarMesReferencia(mesAtual)} — estimativa de
                referência, não substitui a contabilidade.
              </p>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover protocolo?</AlertDialogTitle>
            <AlertDialogDescription>
              O protocolo será desativado. Procedimentos já criados com este protocolo não serão
              afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
