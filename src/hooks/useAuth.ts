import { useState, useEffect } from "react";
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
    requirePasswordChange: claims.requirePasswordChange || false,
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    claims: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Forçar refresh do token para obter custom claims atualizados
        await user.getIdToken(true);
        const idTokenResult = await user.getIdTokenResult();

        // DEBUG: Log dos claims brutos
        console.log("[useAuth DEBUG] Raw claims:", JSON.stringify(idTokenResult.claims, null, 2));

        const claims = extractCustomClaims(idTokenResult.claims);

        // DEBUG: Log dos claims extraídos
        console.log("[useAuth DEBUG] Extracted claims:", JSON.stringify(claims, null, 2));

        setState({
          user,
          loading: false,
          claims,
        });
      } else {
        setState({
          user: null,
          loading: false,
          claims: null,
        });
      }
    });

    return () => {
      unsubscribe();
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
