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

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    claims: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Obter custom claims
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims as CustomClaims;

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

    return () => unsubscribe();
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
      const claims = idTokenResult.claims as CustomClaims;

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
