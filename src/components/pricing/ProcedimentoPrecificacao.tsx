'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/services/reportService';
import {
  FORMAS_PAGAMENTO,
  formatarMesReferencia,
  taxaPagamentoPct,
  type ValoresPorForma,
} from '@/lib/precificacao';
import type { FormaPagamento, OrigemDuracao, ParametrosMarkup } from '@/types';

interface ProcedimentoPrecificacaoProps {
  duracaoMinutos: number;
  duracaoOrigem: OrigemDuracao;
  custoMaterial: { total: number; incompleto: boolean };
  custoHoraAplicado: number | null;
  custoReal: number | null;
  precos: ValoresPorForma;
  markup: ParametrosMarkup;
  formaPagamento: FormaPagamento;
  /** Texto do selo da forma em destaque ("Forma escolhida" / "Forma registrada"). */
  seloForma: string;
  mesReferencia: string;
}

function rotuloForma(markup: ParametrosMarkup, forma: FormaPagamento, label: string): string {
  if (forma === 'pix_dinheiro') return `${label} (sem taxa de cartão)`;
  const taxa = taxaPagamentoPct(markup, forma).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });
  return `${label} (taxa ${taxa}%)`;
}

function Valor({ label, valor }: Readonly<{ label: string; valor: string }>) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  );
}

function Aviso({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-500">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {children}
    </p>
  );
}

/**
 * Preço sugerido do procedimento (D13): mostra sempre os três preços, cada
 * um com a taxa considerada, destacando a forma de pagamento escolhida.
 */
export default function ProcedimentoPrecificacao({
  duracaoMinutos,
  duracaoOrigem,
  custoMaterial,
  custoHoraAplicado,
  custoReal,
  precos,
  markup,
  formaPagamento,
  seloForma,
  mesReferencia,
}: Readonly<ProcedimentoPrecificacaoProps>) {
  const fmt = (v: number | null) => (v === null ? '—' : formatCurrency(v));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Valor
          label="Duração"
          valor={`${duracaoMinutos} min${duracaoOrigem === 'padrao' ? ' (padrão)' : ''}`}
        />
        <Valor label="Material" valor={formatCurrency(custoMaterial.total)} />
        <Valor label="Hora clínica" valor={fmt(custoHoraAplicado)} />
        <Valor label="Custo real" valor={fmt(custoReal)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {FORMAS_PAGAMENTO.map(({ key, label }) => {
          const escolhida = key === formaPagamento;
          return (
            <div
              key={key}
              data-testid={`preco-${key}`}
              className={`rounded-lg border p-3 ${escolhida ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{rotuloForma(markup, key, label)}</p>
                {escolhida && <Badge variant="secondary">{seloForma}</Badge>}
              </div>
              <p className={escolhida ? 'text-xl font-bold text-primary' : 'text-lg font-semibold'}>
                {fmt(precos[key])}
              </p>
            </div>
          );
        })}
      </div>

      {duracaoOrigem === 'padrao' && <Aviso>Duração não informada — considerada 1 hora</Aviso>}
      {custoMaterial.incompleto && (
        <Aviso>Custo de material incompleto: há produto sem valor unitário</Aviso>
      )}
      <p className="text-xs text-muted-foreground">
        Estimativa com base nos custos de {formatarMesReferencia(mesReferencia)} — não substitui a
        contabilidade. A forma de pagamento é apenas informativa.
      </p>
    </div>
  );
}
