import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;

/**
 * Hook para gerenciar timeout de sessão por inatividade
 *
 * Sistema único de timeout - não duplicar em outros lugares!
 *
 * Comportamento:
 * - Timeout configurável via system_settings/global.session_timeout_minutes
 *   (fallback para 15 minutos caso o documento/campo não exista ou seja inválido)
 * - Eventos monitorados: mousedown, keydown, click (ações ativas do usuário)
 * - Eventos NÃO monitorados: scroll, touchstart (ações passivas)
 * - Timer reseta a cada ação ativa do usuário
 * - Sem limite absoluto de sessão (apenas inatividade)
 */
export function useSessionTimeout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimeoutMinutesRef = useRef<number>(DEFAULT_SESSION_TIMEOUT_MINUTES);
  const sessionStartTime = useRef<number>(Date.now());
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Listener para mudanças no estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const startLogging = () => {
    // Limpar intervalo anterior
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current);
    }

    // Resetar tempo de início da sessão
    sessionStartTime.current = Date.now();

    // Não criar intervalo de log - logs removidos
  };

  const resetTimeout = () => {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Resetar tempo de início
    sessionStartTime.current = Date.now();

    // Criar novo timeout
    timeoutRef.current = setTimeout(
      async () => {
        if (auth.currentUser) {
          await auth.signOut();
          router.push('/login?timeout=true');
        }
      },
      sessionTimeoutMinutesRef.current * 60 * 1000
    ); // Converter minutos para milissegundos
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    let cleanupActivityListeners: (() => void) | null = null;

    async function init() {
      // Busca o timeout configurado em system_settings/global uma única vez por
      // sessão -- antes, o valor era sempre 15 minutos hardcoded, ignorando o
      // que era configurado na tela de Configurações (UC-35).
      try {
        const snap = await getDoc(doc(db, 'system_settings', 'global'));
        const configured = snap.data()?.session_timeout_minutes;
        if (typeof configured === 'number' && configured > 0) {
          sessionTimeoutMinutesRef.current = configured;
        }
      } catch {
        // Falha ao ler configuração: mantém o fallback de 15 minutos.
      }

      if (cancelled) return;

      // Iniciar timeout e logging
      resetTimeout();
      startLogging();

      // Eventos que resetam o timeout (apenas ações ATIVAS do usuário)
      // Removidos: "scroll" e "touchstart" (ações passivas que não devem resetar timer)
      const events = ['mousedown', 'keydown', 'click'];

      const handleUserActivity = () => {
        resetTimeout();
      };

      events.forEach((event) => {
        document.addEventListener(event, handleUserActivity);
      });

      cleanupActivityListeners = () => {
        events.forEach((event) => {
          document.removeEventListener(event, handleUserActivity);
        });
      };
    }

    init();

    // Cleanup
    return () => {
      cancelled = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
      }

      cleanupActivityListeners?.();
    };
  }, [currentUser, router]);

  return null;
}
