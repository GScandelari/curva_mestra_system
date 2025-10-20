import React from 'react';
import { Transition } from '@headlessui/react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useError } from '../../contexts/ErrorContext';

const NotificationToast = () => {
  const { errors, removeError } = useError();

  const getIcon = (severity) => {
    switch (severity) {
      case 'low':
        return InformationCircleIcon;
      case 'medium':
        return ExclamationTriangleIcon;
      case 'high':
      case 'critical':
        return XCircleIcon;
      default:
        return ExclamationTriangleIcon;
    }
  };

  const getColors = (severity) => {
    switch (severity) {
      case 'low':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-400',
          text: 'text-blue-800'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-400',
          text: 'text-yellow-800'
        };
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-400',
          text: 'text-red-700'
        };
      case 'critical':
        return {
          bg: 'bg-red-100',
          border: 'border-red-300',
          icon: 'text-red-500',
          text: 'text-red-900'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'text-gray-400',
          text: 'text-gray-800'
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {errors.map((error) => {
        const Icon = getIcon(error.severity);
        const colors = getColors(error.severity);

        return (
          <Transition
            key={error.id}
            show={true}
            enter="transform ease-out duration-300 transition"
            enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
            enterTo="translate-y-0 opacity-100 sm:translate-x-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className={`${colors.bg} ${colors.border} border rounded-lg shadow-lg p-4`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icon className={`h-5 w-5 ${colors.icon}`} />
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${colors.text}`}>
                    {error.message}
                  </p>
                  
                  {/* Show validation errors */}
                  {error.details && Array.isArray(error.details) && error.details.length > 0 && (
                    <div className="mt-2">
                      <ul className={`text-xs ${colors.text} space-y-1`}>
                        {error.details.slice(0, 3).map((detail, index) => (
                          <li key={index}>
                            • {detail.field}: {detail.message}
                          </li>
                        ))}
                        {error.details.length > 3 && (
                          <li>• E mais {error.details.length - 3} erro(s)...</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {/* Show error code in development */}
                  {import.meta.env.DEV && error.code && (
                    <p className={`text-xs ${colors.text} opacity-75 mt-1`}>
                      Código: {error.code}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    className={`inline-flex ${colors.text} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    onClick={() => removeError(error.id)}
                  >
                    <span className="sr-only">Fechar</span>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        );
      })}
    </div>
  );
};

// Success notification component
export const SuccessToast = ({ 
  message, 
  onClose, 
  autoHide = true, 
  duration = 3000 
}) => {
  React.useEffect(() => {
    if (autoHide && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <Transition
        show={true}
        enter="transform ease-out duration-300 transition"
        enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
        enterTo="translate-y-0 opacity-100 sm:translate-x-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-green-800">
                {message}
              </p>
            </div>
            {onClose && (
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="inline-flex text-green-800 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Fechar</span>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Transition>
    </div>
  );
};

// Hook for showing success notifications
export const useSuccessNotification = () => {
  const [notification, setNotification] = React.useState(null);

  const showSuccess = React.useCallback((message, options = {}) => {
    const { duration = 3000, autoHide = true } = options;
    
    setNotification({ message, duration, autoHide });
    
    if (autoHide) {
      setTimeout(() => setNotification(null), duration);
    }
  }, []);

  const hideSuccess = React.useCallback(() => {
    setNotification(null);
  }, []);

  const SuccessNotification = React.useCallback(() => {
    if (!notification) return null;
    
    return (
      <SuccessToast
        message={notification.message}
        onClose={hideSuccess}
        autoHide={notification.autoHide}
        duration={notification.duration}
      />
    );
  }, [notification, hideSuccess]);

  return {
    showSuccess,
    hideSuccess,
    SuccessNotification
  };
};

export default NotificationToast;