import api from '../utils/apiClient'

export const authService = {
  // Login user
  login: async (credentials) => {
    return await api.post('/auth/login', credentials, {}, 'auth.login');
  },

  // Logout user
  logout: async () => {
    try {
      await api.post('/auth/logout', {}, {}, 'auth.logout');
    } catch (error) {
      // Even if logout fails on server, we still want to clear local data
      console.error('Logout error:', error);
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    return await api.post('/auth/forgot-password', { email }, {}, 'auth.forgotPassword');
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    return await api.post('/auth/reset-password', {
      token,
      newPassword
    }, {}, 'auth.resetPassword');
  },

  // Refresh token
  refreshToken: async () => {
    return await api.post('/auth/refresh', {}, {}, 'auth.refresh');
  },

  // Verify token
  verifyToken: async () => {
    return await api.get('/auth/verify', {}, 'auth.verify');
  }
};

export default authService;