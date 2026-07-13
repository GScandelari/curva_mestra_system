import { Badge } from '@/components/ui/badge';
import { Gift, Receipt, FileText } from 'lucide-react';
import type { TipoNota } from '@/types/nf';

export function TipoNotaBadge({ tipoNota }: { tipoNota?: TipoNota }) {
  if (tipoNota === 'bonificacao') {
    return (
      <Badge variant="warning" className="gap-1">
        <Gift className="h-3 w-3" />
        Bonificação
      </Badge>
    );
  }
  if (tipoNota === 'venda') {
    return (
      <Badge className="gap-1 border-transparent bg-green-600 text-white hover:bg-green-700">
        <Receipt className="h-3 w-3" />
        Venda
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <FileText className="h-3 w-3" />
      Outro
    </Badge>
  );
}
