'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncState } from '@/hooks/useAsyncState';
import type { Consultant } from '@/types';

/**
 * Hook compartilhado para buscar o consultor vinculado ao tenant do usuário
 * autenticado (`GET /api/tenants/{tenantId}/consultant`).
 *
 * Extraído para eliminar a duplicação entre `ConsultantTab` e
 * `ClinicConsultantPage` (UC-46-RN-01): as duas telas chamam a mesma API e
 * processam a resposta de forma idêntica — antes, cada uma reimplementava
 * o fetch e o tratamento de erro de forma independente.
 */
export function useLinkedConsultant() {
  const { user, tenantId } = useAuth();
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const { loading, error, setError, run } = useAsyncState();

  const reload = useCallback(
    () =>
      run(
        async () => {
          if (!user || !tenantId) return;
          const token = await user.getIdToken();

          const consultantRes = await fetch(`/api/tenants/${tenantId}/consultant`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const consultantData = await consultantRes.json();
          if (consultantRes.ok) {
            setConsultant(consultantData.data ?? null);
          } else {
            setConsultant(null);
            setError(consultantData.error || 'Não foi possível carregar o consultor vinculado.');
          }
        },
        'Erro ao carregar dados do consultor:',
        'Não foi possível carregar o consultor vinculado. Tente novamente mais tarde.'
      ),
    [user, tenantId, run, setError]
  );

  useEffect(() => {
    if (user && tenantId) {
      void reload();
    }
  }, [user, tenantId, reload]);

  return { consultant, loading, error, reload };
}
