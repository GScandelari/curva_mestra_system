import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LoadErrorAlertProps {
  /** Ex.: "Não foi possível carregar os procedimentos". */
  title: string;
  /** Orientação fixa opcional, específica do bloco. */
  description?: string;
  /** Detalhe em pt-BR (`errorDetail` do useAsyncState). */
  detail?: string;
  onRetry: () => void;
  className?: string;
}

/** Contador cuja leitura falhou: nunca exibir 0 nem "—" no lugar (RN-03). */
export function UnavailableValue() {
  return <div className="text-sm font-medium text-muted-foreground">Indisponível</div>;
}

/**
 * Estado de erro de um bloco de leitura: distinto do estado vazio, no próprio
 * bloco e com "Tentar novamente" (_PADRAO-UX.md §2; padrão do UX-046).
 */
export function LoadErrorAlert({
  title,
  description,
  detail,
  onRetry,
  className,
}: LoadErrorAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        {description && <p>{description}</p>}
        {detail && <p>{detail}</p>}
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
