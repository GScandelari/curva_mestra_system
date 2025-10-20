import { useAuth as useAuthContext } from '../contexts/AuthContext'

// Re-export the useAuth hook for convenience
export const useAuth = useAuthContext

// Additional auth-related hooks can be added here
export const usePermissions = () => {
  const { hasPermission, user } = useAuthContext()
  
  return {
    hasPermission,
    isAdmin: user?.role === 'admin',
    isDoctor: user?.role === 'doctor',
    isManager: user?.role === 'manager',
    isReceptionist: user?.role === 'receptionist',
    canManageProducts: hasPermission('manage_products'),
    canViewProducts: hasPermission('view_products'),
    canRequestProducts: hasPermission('request_products'),
    canApproveRequests: hasPermission('approve_requests'),
    canManagePatients: hasPermission('manage_patients'),
    canViewPatients: hasPermission('view_patients'),
    canViewReports: hasPermission('view_reports')
  }
}

export const useAuthRedirect = () => {
  const { isAuthenticated } = useAuthContext()
  
  return {
    shouldRedirectToLogin: !isAuthenticated,
    shouldRedirectToDashboard: isAuthenticated
  }
}