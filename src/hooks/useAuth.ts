import { useState, useEffect, useRef } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { CustomClaims } from "@/types";

// Constante: tempo de expiração da sessão (30 minutos em milissegundos)
const SESSION_TIMEOUT = 30 * 60 * 1000;

interface AuthState {
  user: User | null;
  loading: boolean;
  claims: CustomClaims | null;
}

/**
 * Extrai custom claims do Firebase Auth token de forma type-safe
 */
function extractCustomClaims(claims: Record<string, any>): CustomClaims | null {
  // Usuário precisa ter pelo menos tenant_id OU ser system_admin
  // E também precisa ter a propriedade 'role' definida
  if (!claims.role) {
    return null;
  }

  return {
    tenant_id: claims.tenant_id || null,
    role: claims.role || null,
    is_system_admin: claims.is_system_admin || false,
    active: claims.active !== undefined ? claims.active : false,
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    claims: null,
  });

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Função para resetar o timeout de inatividade
  const resetSessionTimeout = () => {
    lastActivityRef.current = Date.now();

    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(async () => {
      console.log("⏰ Sessão expirada após 30 minutos de inatividade");
      await firebaseSignOut(auth);
    }, SESSION_TIMEOUT);
  };

  // Monitorar atividade do usuário
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleActivity = () => {
      if (state.user) {
        resetSessionTimeout();
      }
    };

    // Eventos que indicam atividade do usuário
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [state.user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Obter custom claims
        const idTokenResult = await user.getIdTokenResult();
        const claims = extractCustomClaims(idTokenResult.claims);

        setState({
          user,
          loading: false,
          claims,
        });

        // Iniciar timeout de sessão
        resetSessionTimeout();
      } else {
        setState({
          user: null,
          loading: false,
          claims: null,
        });

        // Limpar timeout ao fazer logout
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
        }
      }
    });

    return () => {
      unsubscribe();
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Atualizar profile com nome
      await updateProfile(userCredential.user, { displayName });

      return { success: true, user: userCredential.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const refreshClaims = async () => {
    if (state.user) {
      await state.user.getIdToken(true); // Force refresh
      const idTokenResult = await state.user.getIdTokenResult();
      const claims = extractCustomClaims(idTokenResult.claims);

      setState((prev) => ({
        ...prev,
        claims,
      }));
    }
  };

  return {
    user: state.user,
    loading: state.loading,
    claims: state.claims,
    signIn,
    signUp,
    signOut,
    refreshClaims,
    isAuthenticated: !!state.user,
    isSystemAdmin: state.claims?.is_system_admin || false,
    tenantId: state.claims?.tenant_id || null,
    role: state.claims?.role || null,
  };
}
