import React from 'react';
import { 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { getErrorMessage, formatValidationErrors, ErrorSeverity } from '../../utils/errorHandler';

const ErrorDisplay = ({ 
  error, 
  onRetry = null, 
  onDismiss = null,
  className = '',
  variant = 'default',
  showDetails = false
}) => {
  if (!error) return null;

  const message = getErrorMessage(error);
  const validationErrors = error.details ? formatValidationErrors(error.details) : [];

  // Determine icon and colors based on severity
  const getVariantStyles = () => {
    if (variant !== 'default') {
      const variants = {
        success: {
          container: 'bg-green-50 border-green-200 text-green-800',
          icon: CheckCircleIcon,
          iconColor: 'text-green-400'
        },
        warning: {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: ExclamationTriangleIcon,
          iconColor: 'text-yellow-400'
        },
        info: {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: InformationCircleIcon,
          iconColor: 'text-blue-400'
        }
      };
      return variants[variant];
    }

    // Default: based on error severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: XCircleIcon,
          iconColor: 'text-red-400'
        };
      case ErrorSeverity.HIGH:
        return {
          container: 'bg-red-50 border-red-200 text-red-700',
          icon: XCircleIcon,
          iconColor: 'text-red-400'
        };
      case ErrorSeverity.MEDIUM:
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: ExclamationTriangleIcon,
          iconColor: 'text-yellow-400'
        };
      case ErrorSeverity.LOW:
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: InformationCircleIcon,
          iconColor: 'text-blue-400'
        };
      default:
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: XCircleIcon,
          iconColor: 'text-red-400'
        };
    }
  };

  const styles = getVariantStyles();
  const Icon = styles.icon;

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {message}
          </h3>
          
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="mt-2">
              <ul className="text-sm list-disc list-inside space-y-1">
                {validationErrors.map((validationError, index) => (
                  <li key={index}>
                    <span className="font-medium">{validationError.field}:</span> {validationError.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Error details */}
          {showDetails && error.code && (
            <div className="mt-2 text-xs opacity-75">
              <p>Código: {error.code}</p>
              {error.timestamp && (
                <p>Horário: {new Date(error.timestamp).toLocaleString()}</p>
              )}
            </div>
          )}
          
          {/* Action buttons */}
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex space-x-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-sm bg-white px-3 py-1 rounded border border-current hover:bg-opacity-10 transition-colors"
                >
                  Tentar novamente
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-sm bg-white px-3 py-1 rounded border border-current hover:bg-opacity-10 transition-colors"
                >
                  Dispensar
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Close button */}
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              onClick={onDismiss}
              className={`inline-flex rounded-md p-1.5 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.iconColor}`}
            >
              <span className="sr-only">Fechar</span>
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Inline error for form fields
export const FieldError = ({ error, className = '' }) => {
  if (!error) return null;
  
  return (
    <p className={`text-sm text-red-600 mt-1 ${className}`}>
      {getErrorMessage(error)}
    </p>
  );
};

// Toast-style error notification
export const ErrorToast = ({ 
  error, 
  onDismiss, 
  autoHide = true, 
  duration = 5000 
}) => {
  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);

  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <ErrorDisplay 
        error={error}
        onDismiss={onDismiss}
        className="shadow-lg"
      />
    </div>
  );
};

// Error boundary fallback
export const ErrorBoundaryFallback = ({ 
  error, 
  resetError, 
  className = '' 
}) => (
  <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className}`}>
    <div className="max-w-md w-full">
      <ErrorDisplay
        error={error}
        onRetry={resetError}
        showDetails={true}
        className="shadow-lg"
      />
    </div>
  </div>
);

// Network error display
export const NetworkError = ({ onRetry, className = '' }) => (
  <div className={`text-center py-8 ${className}`}>
    <div className="mx-auto w-16 h-16 text-gray-400 mb-4">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1} 
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      Erro de Conexão
    </h3>
    <p className="text-gray-600 mb-4">
      Não foi possível conectar ao servidor. Verifique sua conexão com a internet.
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        Tentar Novamente
      </button>
    )}
  </div>
);

export default ErrorDisplay;