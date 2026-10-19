'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { chunkUids, type LastAccessMap } from '@/lib/lastAccess';

/**
 * Último acesso (Firebase Auth) de uma lista de usuários, para as listagens do
 * system_admin. Não bloqueia a tabela: enquanto carrega ou se a API falhar, o
 * mapa fica sem a chave e a tela mostra "—".
 */
export function useLastAccess(uids: string[]): { lastAccess: LastAccessMap; loading: boolean } {
  const [lastAccess, setLastAccess] = useState<LastAccessMap>({});
  const [loading, setLoading] = useState(false);
  const key = [...new Set(uids.filter(Boolean))].sort((a, b) => a.localeCompare(b)).join(',');

  useEffect(() => {
    let cancelled = false;
    const chunks = chunkUids(key ? key.split(',') : []);
    const user = auth.currentUser;
    if (chunks.length === 0 || !user) {
      setLastAccess({});
      return;
    }

    setLoading(true);
    (async () => {
      const token = await user.getIdToken();
      const results = await Promise.allSettled(
        chunks.map(async (chunk) => {
          const response = await fetch('/api/admin/users/last-access', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uids: chunk }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = (await response.json()) as { data?: LastAccessMap };
          return body.data ?? {};
        })
      );

      const merged: LastAccessMap = {};
      for (const result of results) {
        if (result.status === 'fulfilled') Object.assign(merged, result.value);
        else console.error('[useLastAccess] Erro ao buscar último acesso:', result.reason);
      }
      if (!cancelled) setLastAccess(merged);
    })()
      .catch((error) => console.error('[useLastAccess] Erro ao buscar último acesso:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { lastAccess, loading };
}
