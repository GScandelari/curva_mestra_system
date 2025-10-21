import { 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

/**
 * Firebase Authentication Service
 * 
 * This service replaces the JWT-based authentication with Firebase Auth
 */
class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Initialize auth state listener
    this.initializeAuthStateListener();
  }

  /**
   * Initialize authentication state listener
   */
  initializeAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get fresh token with custom claims
          const idTokenResult = await user.getIdTokenResult();
          
          this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            photoURL: user.photoURL,
            // Custom claims from Firebase Auth
            role: idTokenResult.claims.role || 'receptionist',
            permissions: idTokenResult.claims.permissions || [],
            clinicId: idTokenResult.claims.clinicId || null,
            isAdmin: idTokenResult.claims.admin || false,
            // Token information
            token: idTokenResult.token,
            tokenExpiration: new Date(idTokenResult.expirationTime)
          };
        } catch (error) {
          console.error('Error getting user token:', error);
          this.currentUser = null;
        }
      } else {
        this.currentUser = null;
      }

      // Notify all listeners
      this.authStateListeners.forEach(listener => listener(this.currentUser));
    });
  }

  /**
   * Add auth state change listener
   * @param {Function} callback - Callback function
   */
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Login with email and password
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   */
  async login(credentials) {
    try {
      const { email, password } = credentials;
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get ID token with custom claims
      const idTokenResult = await user.getIdTokenResult();

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          role: idTokenResult.claims.role || 'receptionist',
          permissions: idTokenResult.claims.permissions || [],
          clinicId: idTokenResult.claims.clinicId || null,
          isAdmin: idTokenResult.claims.admin || false
        },
        token: idTokenResult.token
      };
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Erro ao fazer login';
      
      // Handle Firebase Auth errors
      if (error.code && error.code.startsWith('auth/')) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Usuário não encontrado';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Senha incorreta';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email inválido';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Conta desativada';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Erro de conexão. Verifique sua internet';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Credenciais inválidas';
            break;
          default:
            errorMessage = error.message || 'Erro de autenticação';
        }
      } else {
        // Handle other types of errors
        errorMessage = error.message || 'Erro interno do servidor';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao fazer logout'
      };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   */
  async forgotPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Email de recuperação enviado com sucesso'
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      
      let errorMessage = 'Erro ao enviar email de recuperação';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
          break;
        default:
          errorMessage = error.message || 'Erro desconhecido';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Reset password with token
   * @param {string} oobCode - Password reset code
   * @param {string} newPassword - New password
   */
  async resetPassword(oobCode, newPassword) {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      return {
        success: true,
        message: 'Senha alterada com sucesso'
      };
    } catch (error) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Erro ao alterar senha';
      
      switch (error.code) {
        case 'auth/expired-action-code':
          errorMessage = 'Código de recuperação expirado';
          break;
        case 'auth/invalid-action-code':
          errorMessage = 'Código de recuperação inválido';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca';
          break;
        default:
          errorMessage = error.message || 'Erro desconhecido';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   */
  async updateProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { displayName, email } = profileData;
      
      // Update profile using Firebase Functions
      const updateUserProfile = httpsCallable(functions, 'updateUserProfile');
      const result = await updateUserProfile({ displayName, email });

      return {
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: result.data
      };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar perfil'
      };
    }
  }

  /**
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      return {
        success: true,
        message: 'Senha alterada com sucesso'
      };
    } catch (error) {
      console.error('Change password error:', error);
      
      let errorMessage = 'Erro ao alterar senha';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Senha atual incorreta';
          break;
        case 'auth/weak-password':
          errorMessage = 'Nova senha muito fraca';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Faça login novamente para alterar a senha';
          break;
        default:
          errorMessage = error.message || 'Erro desconhecido';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get current user profile from Firebase Functions
   */
  async getUserProfile() {
    try {
      const getUserProfile = httpsCallable(functions, 'getUserProfile');
      const result = await getUserProfile();
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar perfil'
      };
    }
  }

  /**
   * Initialize clinic (for new users)
   * @param {string} clinicName - Clinic name
   * @param {Object} clinicData - Additional clinic data
   */
  async initializeClinic(clinicName, clinicData = {}) {
    try {
      const initializeClinic = httpsCallable(functions, 'initializeClinic');
      const result = await initializeClinic({ clinicName, clinicData });
      
      // Refresh user token to get new custom claims
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Initialize clinic error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar clínica'
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Check if user has specific role
   * @param {string} role - Role to check
   */
  hasRole(role) {
    return this.currentUser?.role === role;
  }

  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    // Admin has all permissions
    if (this.currentUser.isAdmin) return true;
    
    return this.currentUser.permissions?.includes(permission) || false;
  }

  /**
   * Get current user's ID token
   */
  async getIdToken(forceRefresh = false) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  }

  /**
   * Set authentication token for API requests
   * This method is kept for compatibility with existing code
   * @param {string} token - Firebase ID token
   */
  setAuthToken(token) {
    // This is handled automatically by Firebase Auth
    // Kept for compatibility with existing authService interface
    console.log('setAuthToken called - handled automatically by Firebase Auth');
  }
}

// Create singleton instance
const firebaseAuthService = new FirebaseAuthService();

export default firebaseAuthService;