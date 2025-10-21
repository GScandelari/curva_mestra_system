import React, { createContext, useContext, useReducer, useEffect } from 'react'
import firebaseAuthService from '../services/firebaseAuthService'
import { toast } from 'react-toastify'

const AuthContext = createContext()

// Auth reducer for state management
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        error: null
      }
    case 'LOGIN_FAILURE':
      return {
        ...state,
        loading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        error: action.payload
      }
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        error: null,
        loading: false
      }
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      }
    default:
      return state
  }
}

const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Set up Firebase auth state listener
  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthStateChange((user) => {
      if (user) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { 
            token: user.token, 
            user: {
              id: user.uid,
              email: user.email,
              username: user.displayName || user.email,
              role: user.role || 'receptionist',
              permissions: user.permissions || [],
              clinicId: user.clinicId,
              isAdmin: user.isAdmin || user.role === 'admin',
              emailVerified: user.emailVerified
            }
          }
        })
      } else {
        dispatch({ type: 'LOGOUT' })
      }
    })

    return unsubscribe
  }, [])

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const result = await firebaseAuthService.login(credentials)
      
      if (result.success) {
        // Firebase auth state listener will handle the state update
        toast.success('Login realizado com sucesso!')
        return { success: true }
      } else {
        dispatch({
          type: 'LOGIN_FAILURE',
          payload: result.error
        })
        toast.error(result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao fazer login'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      })
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    try {
      const result = await firebaseAuthService.logout()
      
      if (result.success) {
        // Firebase auth state listener will handle the state update
        toast.info('Logout realizado com sucesso')
      } else {
        console.error('Logout error:', result.error)
        // Force logout locally even if Firebase logout fails
        dispatch({ type: 'LOGOUT' })
        toast.info('Logout realizado com sucesso')
      }
    } catch (error) {
      console.error('Error during logout:', error)
      // Force logout locally
      dispatch({ type: 'LOGOUT' })
      toast.info('Logout realizado com sucesso')
    }
  }

  const forgotPassword = async (email) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const result = await firebaseAuthService.forgotPassword(email)
      
      if (result.success) {
        toast.success(result.message)
        return { success: true }
      } else {
        toast.error(result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao enviar email de recuperação'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const resetPassword = async (oobCode, newPassword) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const result = await firebaseAuthService.resetPassword(oobCode, newPassword)
      
      if (result.success) {
        toast.success(result.message)
        return { success: true }
      } else {
        toast.error(result.error)
        return { success: false, error: result.error }
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao alterar senha'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const hasPermission = (permission) => {
    if (!state.user) return false
    
    // Admin has all permissions
    if (state.user.role === 'admin') return true
    
    // Define role-based permissions
    const rolePermissions = {
      doctor: ['view_products', 'request_products', 'view_patients', 'manage_patients', 'view_invoices'],
      manager: ['view_products', 'manage_products', 'view_requests', 'approve_requests', 'view_reports', 'view_invoices', 'manage_invoices'],
      receptionist: ['view_patients', 'manage_patients', 'view_requests', 'view_invoices']
    }
    
    const userPermissions = rolePermissions[state.user.role] || []
    return userPermissions.includes(permission)
  }

  const getDefaultRedirectPath = () => {
    if (!state.user) return '/dashboard'
    
    // Role-based default redirects
    switch (state.user.role) {
      case 'admin':
      case 'manager':
        return '/dashboard'
      case 'doctor':
        return '/patients'
      case 'receptionist':
        return '/patients'
      default:
        return '/dashboard'
    }
  }

  const value = {
    ...state,
    login,
    logout,
    forgotPassword,
    resetPassword,
    clearError,
    hasPermission,
    getDefaultRedirectPath
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}