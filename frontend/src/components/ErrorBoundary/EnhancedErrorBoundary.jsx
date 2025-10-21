/**
 * Enhanced Error Boundary with Recovery Capabilities
 * Catches React errors and provides recovery options
 */

import React from 'react';
import { ErrorHandler } from '../../../../shared/utils/ErrorHandler.js';
import { FallbackStrategy } from '../../../../shared/strategies/FallbackStrategy.js';
import { ErrorType, ErrorSeverity } from '../../../../shared/types/errorTypes.js';
import logger, { LogCategory, ErrorType as LogErrorType } from '../../utils/logger.js';

class EnhancedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      processedError: null,
      recoveryAttempts: 0,
      isRecovering: false
    };

    // Initialize error handler
    this.errorHandler = new ErrorHandler();
    this.errorHandler.registerStrategy(ErrorType.SYSTEM, new FallbackStrategy());
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Process the error through our unified error handler
    const errorContext = {
      component: this.props.componentName || 'ErrorBoundary',
      action: 'render',
      timestamp: new Date(),
      environment: import.meta.env.PROD ? 'production' : 'development',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        props: this.props.errorContext || {}
      }
    };

    const processedError = this.errorHandler.captureError(error, errorContext);

    // Log the error
    logger.critical('React Error Boundary triggered', {
      category: LogCategory.ERROR,
      errorType: LogErrorType.SYSTEM,
      processedError: {
        id: processedError.id,
        type: processedError.type,
        severity: processedError.severity,
        message: processedError.message
      },
      react: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    this.setState({
      errorInfo,
      processedError
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, processedError);
    }
  }

  handleRetry = async () => {
    if (this.state.recoveryAttempts >= 3) {
      return; // Max retry attempts reached
    }

    this.setState({ 
      isRecovering: true,
      recoveryAttempts: this.state.recoveryAttempts + 1
    });

    try {
      // Attempt recovery using fallback strategy
      const strategy = this.errorHandler.getRecoveryStrategy(this.state.processedError);
      
      if (strategy) {
        const recoveryResult = await this.errorHandler.executeRecovery(strategy, this.state.processedError);
        
        if (recoveryResult.success || recoveryResult.data?.action === 'continue_anyway') {
          // Reset error boundary state
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            processedError: null,
            isRecovering: false
          });

          logger.info('Error boundary recovery successful', {
            category: LogCategory.ERROR,
            errorId: this.state.processedError.id,
            recoveryAttempts: this.state.recoveryAttempts
          });

          return;
        }
      }

      // Recovery failed, stay in error state
      this.setState({ isRecovering: false });
      
    } catch (recoveryError) {
      logger.error('Error boundary recovery failed', {
        category: LogCategory.ERROR,
        errorId: this.state.processedError?.id,
        recoveryError: recoveryError.message
      });

      this.setState({ isRecovering: false });
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  handleReportError = () => {
    // Create error report
    const errorReport = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      processedError: this.state.processedError,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Log error report
    logger.info('Error report generated', {
      category: LogCategory.ERROR,
      errorReport
    });

    // In a real application, this would send the report to an error tracking service
    console.log('Error Report:', errorReport);
    
    // Show confirmation to user
    alert('Relatório de erro gerado. Nossa equipe foi notificada.');
  };

  renderErrorUI() {
    const { processedError, recoveryAttempts, isRecovering } = this.state;
    const { fallbackComponent: FallbackComponent } = this.props;

    // Use custom fallback component if provided
    if (FallbackComponent) {
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          processedError={processedError}
          onRetry={this.handleRetry}
          onRefresh={this.handleRefresh}
          onGoBack={this.handleGoBack}
          onReportError={this.handleReportError}
          isRecovering={isRecovering}
          recoveryAttempts={recoveryAttempts}
        />
      );
    }

    // Default error UI
    const severity = processedError?.severity || ErrorSeverity.HIGH;
    const isCritical = severity === ErrorSeverity.CRITICAL;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            {/* Error Icon */}
            <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
              isCritical ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              <svg
                className={`h-8 w-8 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* Error Title */}
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {isCritical ? 'Erro Crítico' : 'Algo deu errado'}
            </h2>

            {/* Error Message */}
            <p className="mt-2 text-sm text-gray-600">
              {processedError?.userMessage || 
               'Ocorreu um erro inesperado. Tente uma das opções abaixo.'}
            </p>

            {/* Recovery Attempts Info */}
            {recoveryAttempts > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Tentativas de recuperação: {recoveryAttempts}/3
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Retry Button */}
            {recoveryAttempts < 3 && (
              <button
                onClick={this.handleRetry}
                disabled={isRecovering}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRecovering ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Recuperando...
                  </>
                ) : (
                  'Tentar Novamente'
                )}
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={this.handleRefresh}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Recarregar Página
            </button>

            {/* Go Back Button */}
            <button
              onClick={this.handleGoBack}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Voltar
            </button>

            {/* Report Error Button */}
            <button
              onClick={this.handleReportError}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Reportar Erro
            </button>
          </div>

          {/* Technical Details (Development Only) */}
          {!import.meta.env.PROD && this.state.error && (
            <details className="mt-6 text-xs text-gray-500">
              <summary className="cursor-pointer font-medium">Detalhes Técnicos</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words bg-gray-100 p-2 rounded">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI();
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;