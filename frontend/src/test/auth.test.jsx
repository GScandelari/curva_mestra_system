import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { AuthProvider } from '../contexts/AuthContext'
import LoginForm from '../components/auth/LoginForm'
import ProtectedRoute from '../components/auth/ProtectedRoute'

// Mock the auth service
vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    setAuthToken: vi.fn(),
    logout: vi.fn(),
  }
}))

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  ToastContainer: () => null,
}))

const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Authentication Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('LoginForm', () => {
    it('renders login form correctly', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      expect(screen.getByText('Faça login em sua conta')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Senha')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    })

    it('shows validation errors for empty fields', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const submitButton = screen.getByRole('button', { name: /entrar/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email é obrigatório')).toBeInTheDocument()
        expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument()
      })
    })

    it('shows validation error for invalid email', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const emailInput = screen.getByLabelText('Email')
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email inválido')).toBeInTheDocument()
      })
    })

    it('toggles password visibility', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      )

      const passwordInput = screen.getByLabelText('Senha')
      const toggleButton = screen.getByRole('button', { name: '' }) // Eye icon button

      expect(passwordInput.type).toBe('password')

      fireEvent.click(toggleButton)
      expect(passwordInput.type).toBe('text')

      fireEvent.click(toggleButton)
      expect(passwordInput.type).toBe('password')
    })
  })

  describe('ProtectedRoute', () => {
    it('renders children when authenticated', () => {
      // Mock authenticated state
      localStorage.setItem('token', 'fake-token')
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@test.com', role: 'admin' }))

      render(
        <TestWrapper>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })

    it('shows loading state initially', () => {
      render(
        <TestWrapper>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      )

      expect(screen.getByText('Verificando autenticação...')).toBeInTheDocument()
    })
  })

  describe('AuthContext', () => {
    it('provides authentication state', () => {
      let authState = null

      const TestComponent = () => {
        const auth = require('../contexts/AuthContext').useAuth()
        authState = auth
        return <div>Test</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      expect(authState).toBeDefined()
      expect(authState.isAuthenticated).toBe(false)
      expect(authState.user).toBe(null)
      expect(authState.loading).toBe(false)
    })
  })
})