'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ProcedimentoPrecificacao from '@/components/pricing/ProcedimentoPrecificacao';
import { getCustoHoraConfig } from '@/lib/services/custoHoraService';
import { getPrecificacaoProcedimento } from '@/lib/services/precificacaoProcedimentoService';
import { formatCurrency } from '@/lib/services/reportService';
import {
  calcularCustoMaterialSolicitacao,
  estimarPrecificacaoProcedimento,
  formatarMesReferencia,
  mesReferenciaDoProcedimento,
} from '@/lib/precificacao';
import type { CustoHoraConfig, PrecificacaoProcedimento, Solicitacao } from '@/types';

interface ProcedimentoPrecoSugeridoCardProps {
  tenantId: string;
  solicitacao: Pick<
    Solicitacao,
    | 'id'
    | 'status'
    | 'dt_procedimento'
    | 'duracao_minutos'
    | 'forma_pagamento'
    | 'produtos_solicitados'
  >;
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'snapshot'; snapshot: PrecificacaoProcedimento }
  | { tipo: 'estimativa'; config: CustoHoraConfig | null };

/**
 * Preço sugerido no detalhe do procedimento — só clinic_admin (D10/RN-30): o
 * snapshot gravado na confirmação sempre prevalece; sem ele, mostra uma
 * estimativa atual sinalizada como tal.
 */
export default function ProcedimentoPrecoSugeridoCard({
  tenantId,
  solicitacao,
}: Readonly<ProcedimentoPrecoSugeridoCardProps>) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    async function carregar() {
      try {
        const snapshot = await getPrecificacaoProcedimento(tenantId, solicitacao.id);
        if (snapshot) {
          setEstado({ tipo: 'snapshot', snapshot });
          return;
        }
        setEstado({ tipo: 'estimativa', config: await getCustoHoraConfig(tenantId) });
      } catch (error) {
        console.error('Erro ao carregar precificação do procedimento:', error);
        setEstado({ tipo: 'erro' });
      }
    }
    carregar().catch(() => setEstado({ tipo: 'erro' }));
  }, [tenantId, solicitacao.id]);

  const statusEncerrado = solicitacao.status === 'cancelada' || solicitacao.status === 'reprovada';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Preço sugerido</CardTitle>
          {estado.tipo === 'snapshot' && <Badge variant="secondary">Registrado</Badge>}
          {estado.tipo === 'estimativa' && estado.config && (
            <Badge variant="warning">Estimativa atual</Badge>
          )}
        </div>
        <CardDescription>{descricao(estado, solicitacao)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {estado.tipo === 'carregando' && <Skeleton className="h-24 w-full" />}
        {estado.tipo === 'erro' && (
          <p className="text-sm text-muted-foreground">Não foi possível carregar a precificação.</p>
        )}
        {estado.tipo === 'snapshot' && <ConteudoSnapshot snapshot={estado.snapshot} />}
        {estado.tipo === 'estimativa' && estado.config && (
          <ConteudoEstimativa config={estado.config} solicitacao={solicitacao} />
        )}
        {estado.tipo === 'estimativa' && !estado.config && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Configure seus custos fixos para ver o preço sugerido. Material:{' '}
                {formatCurrency(
                  calcularCustoMaterialSolicitacao(solicitacao.produtos_solicitados).total
                )}
              </span>
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
        {statusEncerrado && (estado.tipo === 'snapshot' || estado.tipo === 'estimativa') && (
          <p className="text-xs text-muted-foreground">
            Procedimento {solicitacao.status === 'cancelada' ? 'cancelado' : 'reprovado'} — valores
            mantidos apenas como referência.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function descricao(
  estado: Estado,
  solicitacao: ProcedimentoPrecoSugeridoCardProps['solicitacao']
): string {
  if (estado.tipo === 'snapshot') {
    const gravadoEm = estado.snapshot.gravado_em?.toDate?.();
    const quando = gravadoEm
      ? `${gravadoEm.toLocaleDateString('pt-BR')} ${gravadoEm.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : '—';
    return `Registrado em ${quando} com os custos de ${formatarMesReferencia(
      estado.snapshot.mes_referencia
    )}. Mudanças posteriores nos custos fixos não alteram este registro.`;
  }
  if (estado.tipo === 'estimativa' && estado.config) {
    const mes = formatarMesReferencia(
      mesReferenciaDoProcedimento(solicitacao.dt_procedimento.toDate())
    );
    return `Este procedimento não tem precificação registrada. Valores calculados agora com a configuração de custos atual, para ${mes}.`;
  }
  return 'Custo dos materiais + hora clínica, com as taxas de cada forma de pagamento';
}

function ConteudoSnapshot({ snapshot }: Readonly<{ snapshot: PrecificacaoProcedimento }>) {
  return (
    <ProcedimentoPrecificacao
      duracaoMinutos={snapshot.duracao_minutos}
      duracaoOrigem={snapshot.duracao_origem}
      custoMaterial={{
        total: snapshot.custo_material,
        incompleto: snapshot.custo_material_incompleto,
      }}
      custoHoraAplicado={snapshot.custo_hora_aplicado}
      custoReal={snapshot.custo_real}
      precos={snapshot.precos_sugeridos}
      markup={snapshot.markup}
      formaPagamento={snapshot.forma_pagamento}
      seloForma="Forma registrada"
      mesReferencia={snapshot.mes_referencia}
    />
  );
}

function ConteudoEstimativa({
  config,
  solicitacao,
}: Readonly<{
  config: CustoHoraConfig;
  solicitacao: ProcedimentoPrecoSugeridoCardProps['solicitacao'];
}>) {
  const estimativa = estimarPrecificacaoProcedimento(config, {
    dtProcedimento: solicitacao.dt_procedimento.toDate(),
    duracao_minutos: solicitacao.duracao_minutos,
    forma_pagamento: solicitacao.forma_pagamento,
    produtos: solicitacao.produtos_solicitados,
  });

  return (
    <ProcedimentoPrecificacao
      duracaoMinutos={estimativa.duracao.minutos}
      duracaoOrigem={estimativa.duracao.origem}
      custoMaterial={estimativa.calculo.custoMaterial}
      custoHoraAplicado={estimativa.calculo.custoHoraAplicado}
      custoReal={estimativa.calculo.custoReal}
      precos={estimativa.calculo.precos}
      markup={config.markup}
      formaPagamento={estimativa.formaPagamento}
      seloForma="Forma registrada"
      mesReferencia={estimativa.mesReferencia}
    />
  );
}
