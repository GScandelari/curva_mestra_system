'use client';

import { useCallback, useRef, useState } from 'react';
import { describeLoadError } from '@/lib/loadErrors';

export interface AsyncRunContext {
  /** false quando um `run` mais recente já começou (ex.: troca de filtro). */
  isCurrent: () => boolean;
}

/**
 * Hook compartilhado para padronizar o ciclo loading/error de carregamentos
 * assíncronos feitos diretamente em componentes de página (fetch/Firestore).
 *
 * Extraído para eliminar a duplicação do bloco
 * `setLoading(true) -> try -> catch(console.error + setError) -> finally(setLoading(false))`
 * que se repetia, quase idêntico, em várias telas (UC-41, UC-46, UC-49) — sem
 * introduzir uma camada completa de data-fetching, já que cada chamador
 * mantém total controle sobre o que é buscado e como o resultado é aplicado
 * ao próprio estado (ex.: `consultant`, `termsAcceptances`).
 *
 * Lote "erro exibido como estado vazio" (BUGFIX-ux-erro-exibido-como-vazio):
 * `errorDetail` traz a mensagem pt-BR do erro e só a execução mais recente de
 * `run` altera o estado — quem aplica dados deve checar `isCurrent()`.
 */
export function useAsyncState(initialLoading = true) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const seq = useRef(0);

  const run = useCallback(
    async (
      action: (ctx: AsyncRunContext) => Promise<void>,
      errorLogLabel: string,
      fallbackMessage: string
    ) => {
      const id = ++seq.current;
      const isCurrent = () => id === seq.current;

      setLoading(true);
      setError('');
      setErrorDetail('');
      try {
        await action({ isCurrent });
      } catch (err) {
        console.error(errorLogLabel, err);
        if (isCurrent()) {
          setError(fallbackMessage);
          setErrorDetail(describeLoadError(err));
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    []
  );

  return { loading, error, errorDetail, setError, setLoading, run };
}
