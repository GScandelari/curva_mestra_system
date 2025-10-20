/**
 * Frontend Error Handling E2E Tests
 * 
 * These tests verify that the frontend properly handles and displays errors
 * from the backend API, including validation errors, network errors, and
 * authentication errors.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// Mock API responses
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Components to test
import LoginForm from '../../components/auth/LoginForm';
import ProductForm from '../../components/products/ProductForm';
import { ErrorProvider } from '../../contexts/ErrorContext';
import { AuthProvider } from '../../contexts/AuthContext';
import NotificationToast from '../../components/common/NotificationToast';

// Mock server for API responses
const server = setupServer(
  // Mock login endpoint
  rest.post('/api/auth/login', (req, res, ctx) => {
    const { username, password } = req.body;
    
    if (username === 'invalid@test.com') {
      return res(
        ctx.status(401),
        ctx.json({
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Credenciais inválidas. Verifique seu usuário e senha.',
            timestamp: new Date().toISOString(),
            path: '/api/auth/login',
            method: 'POST'
          }
        })
      );
    }
    
    if (username === 'validation@test.com') {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: {
            code: 'VAL_001',
            message: 'Dados de entrada inválidos',
            timestamp: new Date().toISOString(),
            path: '/api/auth/login',
            method: 'POST',
            details: [
              {
                field: 'username',
                message: 'Nome de usuário deve ter pelo menos 3 caracteres'
              },
              {
                field: 'password',
                message: 'Senha deve ter pelo menos 6 caracteres'
              }
            ]
          }
        })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: { id: '1', username, role: 'admin' }
        }
      })
    );
  }),

  // Mock product creation endpoint
  rest.post('/api/products', (req, res, ctx) => {
    const product = req.body;
    
    if (!product.name || product.name.length < 1) {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: {
            code: 'VAL_001',
            message: 'Dados de entrada inválidos',
            timestamp: new Date().toISOString(),
            path: '/api/products',
            method: 'POST',
            details: [
              {
                field: 'name',
                message: 'Nome do produto é obrigatório'
              }
            ]
          }
        })
      );
    }
    
    if (product.invoiceNumber === 'DUPLICATE-001') {
      return res(
        ctx.status(400),
        ctx.json({
          success: false,
          error: {
            code: 'INVOICE_001',
            message: 'Este número de nota fiscal já existe',
            timestamp: new Date().toISOString(),
            path: '/api/products',
            method: 'POST'
          }
        })
      );
    }
    
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          product: { id: '1', ...product }
        }
      })
    );
  }),

  // Mock network error
  rest.get('/api/products/network-error', (req, res, ctx) => {
    return res.networkError('Network connection failed');
  }),

  // Mock server error
  rest.get('/api/products/server-error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({
        success: false,
        error: {
          code: 'SYS_001',
          message: 'Erro interno do servidor. Tente novamente.',
          timestamp: new Date().toISOString(),
          path: '/api/products/server-error',
          method: 'GET'
        }
      })
    );
  })
);

// Test wrapper component
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorProvider>
          <AuthProvider>
            {children}
            <NotificationToast />
          </AuthProvider>
        </ErrorProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Frontend Error Handling E2E', () => {
  beforeEach(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Authentication Errors', () => {
    test('should display authentication error message', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Fill in invalid credentials
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'wrongpassword' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for error notification to appear
      await waitFor(() => {
        expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
      });

      // Verify error notification has proper styling
      const errorNotification = screen.getByText(/credenciais inválidas/i).closest('div');
      expect(errorNotification).toHaveClass('bg-red-50');
    });

    test('should display validation errors for form fields', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Fill in data that will trigger validation errors
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'validation@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'short' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for validation errors to appear
      await waitFor(() => {
        expect(screen.getByText(/nome de usuário deve ter pelo menos 3 caracteres/i)).toBeInTheDocument();
        expect(screen.getByText(/senha deve ter pelo menos 6 caracteres/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Errors', () => {
    test('should display field-specific validation errors', async () => {
      const mockOnSubmit = vi.fn();
      
      render(
        <TestWrapper>
          <ProductForm onSubmit={mockOnSubmit} />
        </TestWrapper>
      );

      // Submit form without required fields
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      // Wait for validation errors
      await waitFor(() => {
        expect(screen.getByText(/nome do produto é obrigatório/i)).toBeInTheDocument();
      });

      // Verify error styling on form fields
      const nameInput = screen.getByLabelText(/nome/i);
      expect(nameInput).toHaveClass('border-red-300');
    });

    test('should clear validation errors when user corrects input', async () => {
      const mockOnSubmit = vi.fn();
      
      render(
        <TestWrapper>
          <ProductForm onSubmit={mockOnSubmit} />
        </TestWrapper>
      );

      // Submit form to trigger validation errors
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/nome do produto é obrigatório/i)).toBeInTheDocument();
      });

      // Fill in the required field
      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Test Product' }
      });

      // Error should disappear
      await waitFor(() => {
        expect(screen.queryByText(/nome do produto é obrigatório/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Business Logic Errors', () => {
    test('should display business logic error for duplicate invoice', async () => {
      const mockOnSubmit = vi.fn();
      
      render(
        <TestWrapper>
          <ProductForm onSubmit={mockOnSubmit} />
        </TestWrapper>
      );

      // Fill form with duplicate invoice number
      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Test Product' }
      });
      fireEvent.change(screen.getByLabelText(/categoria/i), {
        target: { value: 'Test Category' }
      });
      fireEvent.change(screen.getByLabelText(/quantidade/i), {
        target: { value: '10' }
      });
      fireEvent.change(screen.getByLabelText(/nota fiscal/i), {
        target: { value: 'DUPLICATE-001' }
      });
      fireEvent.change(screen.getByLabelText(/data de validade/i), {
        target: { value: '2025-12-31' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      // Wait for business logic error
      await waitFor(() => {
        expect(screen.getByText(/este número de nota fiscal já existe/i)).toBeInTheDocument();
      });
    });
  });

  describe('Network Errors', () => {
    test('should display network error message', async () => {
      // Mock a network error
      server.use(
        rest.post('/api/products', (req, res, ctx) => {
          return res.networkError('Failed to connect');
        })
      );

      const mockOnSubmit = vi.fn();
      
      render(
        <TestWrapper>
          <ProductForm onSubmit={mockOnSubmit} />
        </TestWrapper>
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Test Product' }
      });
      fireEvent.change(screen.getByLabelText(/categoria/i), {
        target: { value: 'Test Category' }
      });
      fireEvent.change(screen.getByLabelText(/quantidade/i), {
        target: { value: '10' }
      });
      fireEvent.change(screen.getByLabelText(/nota fiscal/i), {
        target: { value: 'INV-001' }
      });
      fireEvent.change(screen.getByLabelText(/data de validade/i), {
        target: { value: '2025-12-31' }
      });

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      // Wait for network error
      await waitFor(() => {
        expect(screen.getByText(/erro de conexão/i)).toBeInTheDocument();
      });
    });

    test('should display server error message', async () => {
      // Mock a server error
      server.use(
        rest.post('/api/products', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: {
                code: 'SYS_001',
                message: 'Erro interno do servidor. Tente novamente.',
                timestamp: new Date().toISOString(),
                path: '/api/products',
                method: 'POST'
              }
            })
          );
        })
      );

      const mockOnSubmit = vi.fn();
      
      render(
        <TestWrapper>
          <ProductForm onSubmit={mockOnSubmit} />
        </TestWrapper>
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/nome/i), {
        target: { value: 'Test Product' }
      });
      fireEvent.change(screen.getByLabelText(/categoria/i), {
        target: { value: 'Test Category' }
      });
      fireEvent.change(screen.getByLabelText(/quantidade/i), {
        target: { value: '10' }
      });
      fireEvent.change(screen.getByLabelText(/nota fiscal/i), {
        target: { value: 'INV-001' }
      });
      fireEvent.change(screen.getByLabelText(/data de validade/i), {
        target: { value: '2025-12-31' }
      });

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      // Wait for server error
      await waitFor(() => {
        expect(screen.getByText(/erro interno do servidor/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Notification Behavior', () => {
    test('should auto-hide error notifications after timeout', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Trigger an error
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'wrongpassword' }
      });
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
      });

      // Wait for auto-hide (this would need to be adjusted based on actual timeout)
      await waitFor(() => {
        expect(screen.queryByText(/credenciais inválidas/i)).not.toBeInTheDocument();
      }, { timeout: 6000 });
    });

    test('should allow manual dismissal of error notifications', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Trigger an error
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'wrongpassword' }
      });
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
      });

      // Find and click dismiss button
      const dismissButton = screen.getByRole('button', { name: /fechar/i });
      fireEvent.click(dismissButton);

      // Error should disappear immediately
      await waitFor(() => {
        expect(screen.queryByText(/credenciais inválidas/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States During Errors', () => {
    test('should show loading state and then error', async () => {
      // Mock delayed error response
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(
            ctx.delay(1000),
            ctx.status(401),
            ctx.json({
              success: false,
              error: {
                code: 'AUTH_001',
                message: 'Credenciais inválidas',
                timestamp: new Date().toISOString(),
                path: '/api/auth/login',
                method: 'POST'
              }
            })
          );
        })
      );

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'password' }
      });
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Should show loading state
      expect(screen.getByText(/entrando/i)).toBeInTheDocument();

      // Wait for error to appear and loading to disappear
      await waitFor(() => {
        expect(screen.queryByText(/entrando/i)).not.toBeInTheDocument();
        expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    test('should allow retry after error', async () => {
      let attemptCount = 0;
      
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          attemptCount++;
          
          if (attemptCount === 1) {
            return res(
              ctx.status(500),
              ctx.json({
                success: false,
                error: {
                  code: 'SYS_001',
                  message: 'Erro interno do servidor',
                  timestamp: new Date().toISOString(),
                  path: '/api/auth/login',
                  method: 'POST'
                }
              })
            );
          }
          
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              data: {
                token: 'mock-jwt-token',
                user: { id: '1', username: 'test@test.com', role: 'admin' }
              }
            })
          );
        })
      );

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // First attempt - should fail
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@test.com' }
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: 'password' }
      });
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/erro interno do servidor/i)).toBeInTheDocument();
      });

      // Retry - should succeed
      fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

      // Wait for success (error should disappear)
      await waitFor(() => {
        expect(screen.queryByText(/erro interno do servidor/i)).not.toBeInTheDocument();
      });
    });
  });
});