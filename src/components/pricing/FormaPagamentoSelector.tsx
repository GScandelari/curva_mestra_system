'use client';

import { Button } from '@/components/ui/button';
import { FORMAS_PAGAMENTO } from '@/lib/precificacao';
import type { FormaPagamento } from '@/types';

interface FormaPagamentoSelectorProps {
  value: FormaPagamento;
  onChange: (forma: FormaPagamento) => void;
}

/** Forma de pagamento do procedimento — informativa (D13), só define o destaque. */
export default function FormaPagamentoSelector({
  value,
  onChange,
}: Readonly<FormaPagamentoSelectorProps>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {FORMAS_PAGAMENTO.map(({ key, label }) => (
        <Button
          key={key}
          type="button"
          variant={value === key ? 'default' : 'outline'}
          className="flex-1"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
