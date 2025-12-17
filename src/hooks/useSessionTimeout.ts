import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

/**
 * Hook para gerenciar timeout de sessão por inatividade
 *
 * Sistema único de timeout - não duplicar em outros lugares!
 *
 * Comportamento:
 * - Timeout fixo: 15 minutos de inatividade
 * - Eventos monitorados: mousedown, keydown, click (ações ativas do usuário)
 * - Eventos NÃO monitorados: scroll, touchstart (ações passivas)
 * - Timer reseta a cada ação ativa do usuário
 * - Sem limite absoluto de sessão (apenas inatividade)
 */
export function useSessionTimeout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTimeoutMinutes = 15; // Timeout fixo: 15 minutos
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
    timeoutRef.current = setTimeout(async () => {
      if (auth.currentUser) {
        await auth.signOut();
        router.push("/login?timeout=true");
      }
    }, sessionTimeoutMinutes * 60 * 1000); // Converter minutos para milissegundos
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    // Iniciar timeout e logging
    resetTimeout();
    startLogging();

    // Eventos que resetam o timeout (apenas ações ATIVAS do usuário)
    // Removidos: "scroll" e "touchstart" (ações passivas que não devem resetar timer)
    const events = ["mousedown", "keydown", "click"];

    const handleUserActivity = () => {
      resetTimeout();
    };

    // Adicionar listeners
    events.forEach((event) => {
      document.addEventListener(event, handleUserActivity);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
      }

      events.forEach((event) => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [currentUser, router]);

  return null;
}
