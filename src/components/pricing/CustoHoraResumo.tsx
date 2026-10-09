'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import { formatCurrency } from '@/lib/services/reportService';
import { formatarMesReferencia, type ResumoCustoHora } from '@/lib/precificacao';

function formatHoras(horas: number): string {
  return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
}

interface CustoHoraResumoProps {
  resumo: ResumoCustoHora;
}

/**
 * Resumo da hora clínica (RF-09). Usado na aba "Custos Fixos" (recalculado a
 * cada alteração, sem salvar) e, somente leitura, na tela do consultor.
 */
export default function CustoHoraResumo({ resumo }: Readonly<CustoHoraResumoProps>) {
  const { custoFixo } = resumo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Custo da Hora Clínica
        </CardTitle>
        <CardDescription>
          Referência: {formatarMesReferencia(resumo.mesReferencia)}. Estimativa de referência para
          precificação — não substitui a contabilidade. Ocupação considerada: 100%; feriados não
          descontados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4 sm:col-span-2 lg:col-span-1">
            <p className="text-sm font-medium text-muted-foreground">Custo da hora clínica</p>
            <p className="text-2xl font-bold" data-testid="custo-hora">
              {resumo.custoHora === null ? '—' : formatCurrency(resumo.custoHora)}
            </p>
            {resumo.custoHora === null && (
              <p className="text-xs text-muted-foreground">
                Configure a disponibilidade semanal para calcular.
              </p>
            )}
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">Custos fixos do mês</p>
            <p className="text-xl font-semibold">{formatCurrency(custoFixo.total)}</p>
            <p className="text-xs text-muted-foreground">
              Base {formatCurrency(custoFixo.base)} · Personalizados{' '}
              {formatCurrency(custoFixo.personalizados)} · Boletos Tec{' '}
              {formatCurrency(custoFixo.boletos)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">Horas planejadas no mês</p>
            <p className="text-xl font-semibold">{formatHoras(resumo.horasMes)}</p>
            <p className="text-xs text-muted-foreground">
              Capacidade simultânea: {resumo.capacidade}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium text-muted-foreground">Divisor de markup</p>
            <p className="text-xl font-semibold">
              {resumo.divisor === null
                ? '—'
                : resumo.divisor.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
            </p>
            <p className="text-xs text-muted-foreground">Preço = custo real ÷ divisor</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
