/**
 * Validation Error Recovery Strategy
 * Handles form validation and data validation errors
 */

import {
  ErrorType,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  BackoffStrategy
} from '../types/errorTypes.js';

export class ValidationErrorStrategy implements RecoveryStrategy {
  name = 'ValidationErrorStrategy';
  maxRetries = 1; // Validation errors usually don't benefit from retries
  backoffStrategy = BackoffStrategy.FIXED;

  canHandle(error: ProcessedError): boolean {
    return error.type === ErrorType.VALIDATION;
  }

  async execute(error: ProcessedError): Promise<RecoveryResult> {
    const errorMessage = error.originalError.message.toLowerCase();
    const errorDetails = error.technicalDetails;

    // Handle different types of validation errors
    if (errorMessage.includes('required') || errorMessage.includes('missing')) {
      return this.handleRequiredFieldError(error);
    }

    if (errorMessage.includes('format') || errorMessage.includes('invalid')) {
      return this.handleFormatError(error);
    }

    if (errorMessage.includes('length') || errorMessage.includes('size')) {
      return this.handleLengthError(error);
    }

    if (errorMessage.includes('email')) {
      return this.handleEmailValidationError(error);
    }

    if (errorMessage.includes('password')) {
      return this.handlePasswordValidationError(error);
    }

    if (errorMessage.includes('date')) {
      return this.handleDateValidationError(error);
    }

    if (errorMessage.includes('number') || errorMessage.includes('numeric')) {
      return this.handleNumericValidationError(error);
    }

    // Handle structured validation errors (from backend)
    if (errorDetails && Array.isArray(errorDetails.validationErrors)) {
      return this.handleStructuredValidationErrors(error);
    }

    // Default validation error handling
    return this.handleGenericValidationError(error);
  }

  private async handleRequiredFieldError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true, // We can handle this by showing user feedback
      message: 'Required field validation error handled',
      data: {
        action: 'highlight_required_fields',
        userMessage: 'Preencha todos os campos obrigatórios.',
        validationType: 'required',
        recoverable: true
      }
    };
  }

  private async handleFormatError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Format validation error handled',
      data: {
        action: 'show_format_help',
        userMessage: 'Verifique o formato dos dados inseridos.',
        validationType: 'format',
        recoverable: true
      }
    };
  }

  private async handleLengthError(error: ProcessedError): Promise<RecoveryResult> {
    const errorMessage = error.originalError.message;
    let specificMessage = 'Verifique o tamanho dos dados inseridos.';

    // Extract length requirements if available
    const lengthMatch = errorMessage.match(/(\d+)/g);
    if (lengthMatch && lengthMatch.length > 0) {
      const requiredLength = lengthMatch[0];
      specificMessage = `O campo deve ter ${requiredLength} caracteres.`;
    }

    return {
      success: true,
      message: 'Length validation error handled',
      data: {
        action: 'show_length_requirements',
        userMessage: specificMessage,
        validationType: 'length',
        recoverable: true
      }
    };
  }

  private async handleEmailValidationError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Email validation error handled',
      data: {
        action: 'focus_email_field',
        userMessage: 'Insira um endereço de email válido (exemplo: usuario@dominio.com).',
        validationType: 'email',
        recoverable: true,
        suggestions: ['Verifique se o email contém @ e um domínio válido']
      }
    };
  }

  private async handlePasswordValidationError(error: ProcessedError): Promise<RecoveryResult> {
    const errorMessage = error.originalError.message.toLowerCase();
    let specificMessage = 'Verifique os requisitos da senha.';
    const suggestions = [];

    if (errorMessage.includes('length') || errorMessage.includes('6')) {
      specificMessage = 'A senha deve ter pelo menos 6 caracteres.';
      suggestions.push('Use pelo menos 6 caracteres');
    }

    if (errorMessage.includes('uppercase')) {
      suggestions.push('Inclua pelo menos uma letra maiúscula');
    }

    if (errorMessage.includes('lowercase')) {
      suggestions.push('Inclua pelo menos uma letra minúscula');
    }

    if (errorMessage.includes('number') || errorMessage.includes('digit')) {
      suggestions.push('Inclua pelo menos um número');
    }

    if (errorMessage.includes('special')) {
      suggestions.push('Inclua pelo menos um caractere especial');
    }

    return {
      success: true,
      message: 'Password validation error handled',
      data: {
        action: 'show_password_requirements',
        userMessage: specificMessage,
        validationType: 'password',
        recoverable: true,
        suggestions
      }
    };
  }

  private async handleDateValidationError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Date validation error handled',
      data: {
        action: 'show_date_picker',
        userMessage: 'Insira uma data válida no formato DD/MM/AAAA.',
        validationType: 'date',
        recoverable: true,
        suggestions: ['Use o formato DD/MM/AAAA', 'Verifique se a data é válida']
      }
    };
  }

  private async handleNumericValidationError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Numeric validation error handled',
      data: {
        action: 'format_numeric_input',
        userMessage: 'Insira apenas números válidos.',
        validationType: 'numeric',
        recoverable: true,
        suggestions: ['Use apenas números', 'Verifique se não há caracteres especiais']
      }
    };
  }

  private async handleStructuredValidationErrors(error: ProcessedError): Promise<RecoveryResult> {
    const validationErrors = error.technicalDetails?.validationErrors || [];
    
    const fieldErrors = validationErrors.map((err: any) => ({
      field: err.field || err.path,
      message: err.message,
      value: err.value
    }));

    return {
      success: true,
      message: 'Structured validation errors handled',
      data: {
        action: 'highlight_validation_errors',
        userMessage: 'Corrija os erros nos campos destacados.',
        validationType: 'structured',
        recoverable: true,
        fieldErrors,
        suggestions: fieldErrors.map((err: any) => `${err.field}: ${err.message}`)
      }
    };
  }

  private async handleGenericValidationError(error: ProcessedError): Promise<RecoveryResult> {
    return {
      success: true,
      message: 'Generic validation error handled',
      data: {
        action: 'show_generic_validation_message',
        userMessage: 'Verifique os dados inseridos e tente novamente.',
        validationType: 'generic',
        recoverable: true,
        originalMessage: error.originalError.message
      }
    };
  }
}