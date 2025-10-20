import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authService } from '../services/authService'
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

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      try {
        const parsedUser = JSON.parse(user)
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { token, user: parsedUser }
        })
        authService.setAuthToken(token)
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  }, [])

  const login = async (credentials) => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await authService.login(credentials)
      const { token, user } = response.data
      
      // Store in localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      // Set auth token for future requests
      authService.setAuthToken(token)
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user }
      })
      
      toast.success('Login realizado com sucesso!')
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erro ao fazer login'
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
      await authService.logout()
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      // Clear local storage
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // Clear auth token
      authService.setAuthToken(null)
      
      dispatch({ type: 'LOGOUT' })
      toast.info('Logout realizado com sucesso')
    }
  }

  const forgotPassword = async (email) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      await authService.forgotPassword(email)
      toast.success('Email de recuperação enviado com sucesso!')
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erro ao enviar email de recuperação'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const resetPassword = async (token, newPassword) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      await authService.resetPassword(token, newPassword)
      toast.success('Senha alterada com sucesso!')
      return { success: true }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erro ao alterar senha'
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

  const value = {
    ...state,
    login,
    logout,
    forgotPassword,
    resetPassword,
    clearError,
    hasPermission
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