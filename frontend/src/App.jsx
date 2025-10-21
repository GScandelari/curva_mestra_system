import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Context
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ErrorProvider } from './contexts/ErrorContext'

// Serviços de monitoramento
import analyticsService from './services/analyticsService'
import performanceService from './services/performanceService'
import errorReportingService from './services/errorReportingService'

// Components
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginForm from './components/auth/LoginForm'
import ForgotPasswordForm from './components/auth/ForgotPasswordForm'
import ResetPasswordForm from './components/auth/ResetPasswordForm'
import { ErrorBoundary, NotificationToast } from './components'
import { NotificationToastContainer } from './components/notifications/NotificationToast'
import { useNotifications } from './hooks/useNotifications'

// Pages
import DashboardPage from './pages/DashboardPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import ProductsPage from './pages/ProductsPage'
import RequestsPage from './pages/RequestsPage'
import PatientsPage from './pages/PatientsPage'
import InvoicesPage from './pages/InvoicesPage'
import AdminPage from './pages/AdminPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// App content component that uses notifications
const AppContent = () => {
  const { notifications, markAsRead } = useNotifications({
    autoSetupListeners: true,
    limit: 10
  });

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/products" 
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/products/*" 
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/requests" 
            element={
              <ProtectedRoute>
                <RequestsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/requests/*" 
            element={
              <ProtectedRoute>
                <RequestsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/patients" 
            element={
              <ProtectedRoute>
                <PatientsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/patients/*" 
            element={
              <ProtectedRoute>
                <PatientsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/invoices" 
            element={
              <ProtectedRoute>
                <InvoicesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/invoices/*" 
            element={
              <ProtectedRoute>
                <InvoicesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch all route - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {/* Error notifications */}
      <NotificationToast />
      
      {/* Firebase notification toasts */}
      <NotificationToastContainer
        notifications={notifications}
        onMarkAsRead={markAsRead}
        maxToasts={3}
        position="top-right"
      />
    </>
  );
};

function App() {
  useEffect(() => {
    // Inicializar serviços de monitoramento
    const initializeMonitoring = async () => {
      try {
        // Configurar Web Vitals monitoring
        performanceService.setupWebVitalsMonitoring();
        
        // Testar error reporting em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
          console.log('Serviços de monitoramento inicializados');
        }
      } catch (error) {
        console.warn('Erro ao inicializar monitoramento:', error);
      }
    };

    initializeMonitoring();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary name="App">
        <ErrorProvider>
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <AppContent />
              </Router>
            </NotificationProvider>
          </AuthProvider>
        </ErrorProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App