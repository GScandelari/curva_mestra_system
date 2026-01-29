/**
 * Hook: Verificar Status da Clínica
 * Monitora em tempo real se a clínica do usuário foi suspensa ou está inativa
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SuspensionInfo } from "@/types";

interface TenantSuspensionState {
  isSuspended: boolean;
  isInactive: boolean; // Clínica com active: false
  suspensionInfo: SuspensionInfo | null;
  isLoading: boolean;
}

export function useTenantSuspension(): TenantSuspensionState {
  const { claims } = useAuth();
  const [state, setState] = useState<TenantSuspensionState>({
    isSuspended: false,
    isInactive: false,
    suspensionInfo: null,
    isLoading: true,
  });

  useEffect(() => {
    // System admin nunca é bloqueado
    if (claims?.is_system_admin) {
      setState({
        isSuspended: false,
        isInactive: false,
        suspensionInfo: null,
        isLoading: false,
      });
      return;
    }

    // Se não tem tenant_id, não há o que verificar
    if (!claims?.tenant_id) {
      setState({
        isSuspended: false,
        isInactive: false,
        suspensionInfo: null,
        isLoading: false,
      });
      return;
    }

    // Listener em tempo real para mudanças no tenant
    const tenantRef = doc(db, "tenants", claims.tenant_id);

    const unsubscribe = onSnapshot(
      tenantRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({
            isSuspended: false,
            isInactive: false,
            suspensionInfo: null,
            isLoading: false,
          });
          return;
        }

        const tenantData = snapshot.data();
        const suspension = tenantData.suspension as SuspensionInfo | undefined;
        const isActive = tenantData.active !== false; // default true se não definido

        setState({
          isSuspended: suspension?.suspended || false,
          isInactive: !isActive,
          suspensionInfo: suspension || null,
          isLoading: false,
        });
      },
      (error) => {
        console.error("Erro ao verificar status da clínica:", error);
        setState({
          isSuspended: false,
          isInactive: false,
          suspensionInfo: null,
          isLoading: false,
        });
      }
    );

    return () => unsubscribe();
  }, [claims?.tenant_id, claims?.is_system_admin]);

  return state;
}
