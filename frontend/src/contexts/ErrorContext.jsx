import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { parseApiError, shouldLogout, logError } from '../utils/errorHandler';

// Error context
const ErrorContext = createContext();

// Error types
const ERROR_ACTIONS = {
  ADD_ERROR: 'ADD_ERROR',
  REMOVE_ERROR: 'REMOVE_ERROR',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  SET_GLOBAL_ERROR: 'SET_GLOBAL_ERROR',
  CLEAR_GLOBAL_ERROR: 'CLEAR_GLOBAL_ERROR'
};

// Error reducer
const errorReducer = (state, action) => {
  switch (action.type) {
    case ERROR_ACTIONS.ADD_ERROR:
      return {
        ...state,
        errors: [...state.errors, { ...action.payload, id: Date.now() }]
      };
    
    case ERROR_ACTIONS.REMOVE_ERROR:
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload)
      };
    
    case ERROR_ACTIONS.CLEAR_ERRORS:
      return {
        ...state,
        errors: []
      };
    
    case ERROR_ACTIONS.SET_GLOBAL_ERROR:
      return {
        ...state,
        globalError: action.payload
      };
    
    case ERROR_ACTIONS.CLEAR_GLOBAL_ERROR:
      return {
        ...state,
        globalError: null
      };
    
    default:
      return state;
  }
};

// Initial state
const initialState = {
  errors: [],
  globalError: null
};

// Error provider component
export const ErrorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  // Add error
  const addError = useCallback((error, options = {}) => {
    const {
      persist = false,
      autoHide = true,
      duration = 5000,
      context = null
    } = options;

    // Parse error if it's from API
    const parsedError = error.response ? parseApiError(error) : error;
    
    // Log error
    logError(parsedError, context);

    // Handle logout if needed
    if (shouldLogout(parsedError)) {
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth:logout', {
        detail: { reason: 'error_logout', error: parsedError }
      }));
      return;
    }

    // Add to error list
    const errorItem = {
      ...parsedError,
      persist,
      autoHide,
      duration,
      context
    };

    dispatch({
      type: ERROR_ACTIONS.ADD_ERROR,
      payload: errorItem
    });

    // Auto-hide if configured
    if (autoHide && !persist) {
      setTimeout(() => {
        removeError(errorItem.id);
      }, duration);
    }

    return errorItem.id;
  }, []);

  // Remove error
  const removeError = useCallback((errorId) => {
    dispatch({
      type: ERROR_ACTIONS.REMOVE_ERROR,
      payload: errorId
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    dispatch({
      type: ERROR_ACTIONS.CLEAR_ERRORS
    });
  }, []);

  // Set global error (for critical errors that should block the UI)
  const setGlobalError = useCallback((error) => {
    const parsedError = error.response ? parseApiError(error) : error;
    logError(parsedError, { global: true });
    
    dispatch({
      type: ERROR_ACTIONS.SET_GLOBAL_ERROR,
      payload: parsedError
    });
  }, []);

  // Clear global error
  const clearGlobalError = useCallback(() => {
    dispatch({
      type: ERROR_ACTIONS.CLEAR_GLOBAL_ERROR
    });
  }, []);

  // Handle API errors with automatic parsing and display
  const handleApiError = useCallback((error, options = {}) => {
    const {
      showNotification = true,
      setAsGlobal = false,
      ...otherOptions
    } = options;

    if (setAsGlobal) {
      setGlobalError(error);
    } else if (showNotification) {
      addError(error, otherOptions);
    }

    return parseApiError(error);
  }, [addError, setGlobalError]);

  // Create error handler for specific contexts
  const createErrorHandler = useCallback((context) => {
    return (error, options = {}) => {
      return handleApiError(error, { ...options, context });
    };
  }, [handleApiError]);

  const value = {
    // State
    errors: state.errors,
    globalError: state.globalError,
    
    // Actions
    addError,
    removeError,
    clearErrors,
    setGlobalError,
    clearGlobalError,
    handleApiError,
    createErrorHandler
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

// Hook to use error context
export const useError = () => {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  
  return context;
};

// Hook for handling errors in specific components
export const useErrorHandler = (context = null) => {
  const { handleApiError, createErrorHandler } = useError();
  
  const errorHandler = React.useMemo(() => {
    if (context) {
      return createErrorHandler(context);
    }
    return handleApiError;
  }, [context, createErrorHandler, handleApiError]);

  return errorHandler;
};

// Hook for form error handling
export const useFormError = () => {
  const [fieldErrors, setFieldErrors] = React.useState({});
  const { handleApiError } = useError();

  const setFieldError = useCallback((field, error) => {
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearFieldError = useCallback((field) => {
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const handleFormError = useCallback((error) => {
    const parsedError = handleApiError(error, { showNotification: false });
    
    // Handle validation errors
    if (parsedError.details && Array.isArray(parsedError.details)) {
      const newFieldErrors = {};
      parsedError.details.forEach(detail => {
        if (detail.field) {
          newFieldErrors[detail.field] = detail.message;
        }
      });
      setFieldErrors(newFieldErrors);
    } else {
      // Show general error
      handleApiError(error);
    }

    return parsedError;
  }, [handleApiError]);

  return {
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    handleFormError
  };
};

export default ErrorContext;