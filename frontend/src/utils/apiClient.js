import axios from 'axios';
import { 
  parseApiError, 
  shouldLogout, 
  shouldRetry, 
  getRetryDelay, 
  logError,
  ErrorCodes,
  ErrorTypes,
  ErrorSeverity,
  AppError
} from './errorHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Create axios instance with enhanced configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request retry configuration
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    return shouldRetry(parseApiError(error));
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request timestamp for timeout tracking
    config.metadata = { startTime: new Date() };
    
    // Add retry count
    config.retryCount = config.retryCount || 0;
    
    return config;
  },
  (error) => {
    return Promise.reject(parseApiError(error));
  }
);

// Response interceptor with retry logic
apiClient.interceptors.response.use(
  (response) => {
    // Add response time to metadata
    if (response.config.metadata) {
      response.config.metadata.endTime = new Date();
      response.config.metadata.duration = 
        response.config.metadata.endTime - response.config.metadata.startTime;
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const parsedError = parseApiError(error);
    
    // Log error
    logError(parsedError, {
      url: originalRequest?.url,
      method: originalRequest?.method,
      retryCount: originalRequest?.retryCount || 0
    });
    
    // Handle authentication errors
    if (shouldLogout(parsedError)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { reason: 'token_expired' }
      }));
      
      return Promise.reject(parsedError);
    }
    
    // Retry logic
    if (
      originalRequest && 
      !originalRequest._retry && 
      shouldRetry(parsedError, originalRequest.retryCount, retryConfig.maxRetries)
    ) {
      originalRequest._retry = true;
      originalRequest.retryCount = (originalRequest.retryCount || 0) + 1;
      
      const delay = getRetryDelay(originalRequest.retryCount);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the request
      return apiClient(originalRequest);
    }
    
    return Promise.reject(parsedError);
  }
);

// Enhanced request methods with loading states
class ApiClient {
  constructor() {
    this.loadingStates = new Map();
  }
  
  // Set loading state
  setLoading(key, loading) {
    this.loadingStates.set(key, loading);
    
    // Dispatch loading event
    window.dispatchEvent(new CustomEvent('api:loading', {
      detail: { key, loading }
    }));
  }
  
  // Get loading state
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }
  
  // Generic request method
  async request(config, loadingKey = null) {
    if (loadingKey) {
      this.setLoading(loadingKey, true);
    }
    
    try {
      const response = await apiClient(config);
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      if (loadingKey) {
        this.setLoading(loadingKey, false);
      }
    }
  }
  
  // GET request
  async get(url, config = {}, loadingKey = null) {
    return this.request({ ...config, method: 'GET', url }, loadingKey);
  }
  
  // POST request
  async post(url, data = {}, config = {}, loadingKey = null) {
    return this.request({ ...config, method: 'POST', url, data }, loadingKey);
  }
  
  // PUT request
  async put(url, data = {}, config = {}, loadingKey = null) {
    return this.request({ ...config, method: 'PUT', url, data }, loadingKey);
  }
  
  // PATCH request
  async patch(url, data = {}, config = {}, loadingKey = null) {
    return this.request({ ...config, method: 'PATCH', url, data }, loadingKey);
  }
  
  // DELETE request
  async delete(url, config = {}, loadingKey = null) {
    return this.request({ ...config, method: 'DELETE', url }, loadingKey);
  }
  
  // Upload file
  async upload(url, file, onProgress = null, loadingKey = null) {
    const formData = new FormData();
    formData.append('file', file);
    
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    
    if (onProgress) {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      };
    }
    
    return this.post(url, formData, config, loadingKey);
  }
  
  // Download file
  async download(url, filename = null, loadingKey = null) {
    try {
      if (loadingKey) {
        this.setLoading(loadingKey, true);
      }
      
      const response = await apiClient({
        url,
        method: 'GET',
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return response.data;
    } catch (error) {
      throw parseApiError(error);
    } finally {
      if (loadingKey) {
        this.setLoading(loadingKey, false);
      }
    }
  }
  
  // Batch requests
  async batch(requests, loadingKey = null) {
    if (loadingKey) {
      this.setLoading(loadingKey, true);
    }
    
    try {
      const promises = requests.map(request => 
        apiClient(request).catch(error => ({ error: parseApiError(error) }))
      );
      
      const results = await Promise.all(promises);
      
      return results.map((result, index) => ({
        success: !result.error,
        data: result.error ? null : result.data,
        error: result.error || null,
        request: requests[index]
      }));
    } finally {
      if (loadingKey) {
        this.setLoading(loadingKey, false);
      }
    }
  }
  
  // Health check
  async healthCheck() {
    try {
      const response = await apiClient.get('/health');
      return {
        healthy: true,
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: parseApiError(error)
      };
    }
  }
  
  // Cancel request
  cancelRequest(source) {
    if (source) {
      source.cancel('Request cancelled by user');
    }
  }
  
  // Create cancel token
  createCancelToken() {
    return axios.CancelToken.source();
  }
}

// Create singleton instance
const api = new ApiClient();

// Export both the instance and the class
export default api;
export { ApiClient, apiClient };

// Utility functions for common operations
export const withRetry = async (operation, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries || !shouldRetry(error, i)) {
        break;
      }
      
      await new Promise(resolve => 
        setTimeout(resolve, getRetryDelay(i))
      );
    }
  }
  
  throw lastError;
};

export const withTimeout = (promise, timeoutMs = 30000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(
        new AppError(
          'Tempo limite excedido',
          ErrorCodes.TIMEOUT_ERROR,
          ErrorTypes.NETWORK,
          ErrorSeverity.MEDIUM
        )
      ), timeoutMs)
    )
  ]);
};