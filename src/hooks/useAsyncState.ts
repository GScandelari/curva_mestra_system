'use client';

import { useCallback, useState } from 'react';

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
 */
export function useAsyncState(initialLoading = true) {
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState('');

  const run = useCallback(
    async (action: () => Promise<void>, errorLogLabel: string, fallbackMessage: string) => {
      setLoading(true);
      setError('');
      try {
        await action();
      } catch (err) {
        console.error(errorLogLabel, err);
        setError(fallbackMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { loading, error, setError, setLoading, run };
}
