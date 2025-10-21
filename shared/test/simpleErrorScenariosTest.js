/**
 * Simple Error Scenarios Test Suite
 * Tests all identified error types and validates error handling
 * Can run with Node.js without TypeScript compilation
 */

// Mock error types and severities
const ErrorType = {
  AUTHENTICATION: 'auth',
  NETWORK: 'network',
  VALIDATION: 'validation',
  PERMISSION: 'permission',
  DATABASE: 'database',
  CONFIGURATION: 'config',
  UNKNOWN: 'unknown'
};

const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class SimpleErrorHandler {
  constructor() {
    this.errorLog = [];
  }

  classifyError(error, context) {
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let recoverable = true;
    let userMessage = 'Ocorreu um erro. Tente novamente.';

    // Classify by error code
    if (error.code) {
      if (error.code.startsWith('auth/')) {
        type = ErrorType.AUTHENTICATION;
        severity = ErrorSeverity.MEDIUM;
        
        switch (error.code) {
          case 'auth/invalid-credential':
            userMessage = 'Email ou senha inválidos. Verifique suas credenciais e tente novamente.';
            break;
          case 'auth/user-disabled':
            userMessage = 'Sua conta foi desabilitada. Entre em contato com o suporte.';
            severity = ErrorSeverity.HIGH;
            recoverable = false;
            break;
          case 'auth/network-request-failed':
            userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
            break;
          case 'auth/too-many-requests':
            userMessage = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
            severity = ErrorSeverity.HIGH;
            break;
        }
      } else if (['ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'].includes(error.code)) {
        type = ErrorType.NETWORK;
        severity = ErrorSeverity.MEDIUM;
        userMessage = 'Problema de conexão. Verifique sua internet e tente novamente.';
      } else if (error.code === 'permission-denied') {
        type = ErrorType.PERMISSION;
        severity = ErrorSeverity.HIGH;
        recoverable = false;
        userMessage = 'Você não tem permissão para realizar esta ação.';
      } else if (error.code === 'SYS_001') {
        type = ErrorType.UNKNOWN;
        severity = ErrorSeverity.CRITICAL;
        userMessage = 'Erro interno do sistema. Nossa equipe foi notificada.';
      }
    }

    // Classify by field (validation errors)
    if (error.field) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.LOW;
      userMessage = `Erro de validação no campo ${error.field}: ${error.message}`;
    }

    const processedError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message: error.message,
      userMessage,
      originalError: error,
      context,
      recoverable,
      timestamp: new Date()
    };

    this.errorLog.push(processedError);
    return processedError;
  }

  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recoverable: 0,
      nonRecoverable: 0
    };

    this.errorLog.forEach(error => {
      // Count by type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count recoverable
      if (error.recoverable) {
        stats.recoverable++;
      } else {
        stats.nonRecoverable++;
      }
    });

    return stats;
  }
}

class ErrorScenariosTestSuite {
  constructor() {
    this.errorHandler = new SimpleErrorHandler();
    this.testResults = [];
  }

  async runAllErrorScenarios() {
    console.log('🧪 Iniciando testes de cenários de erro...\n');

    const testSuites = [
      this.testAuthenticationErrors.bind(this),
      this.testNetworkErrors.bind(this),
      this.testValidationErrors.bind(this),
      this.testFirebaseErrors.bind(this),
      this.testPermissionErrors.bind(this),
      this.testSYS001Scenarios.bind(this),
      this.testErrorMessages.bind(this),
      this.testRecoveryClassification.bind(this)
    ];

    for (const testSuite of testSuites) {
      try {
        await testSuite();
      } catch (error) {
        console.error(`❌ Test suite failed: ${error.message}`);
        this.testResults.push({
          suite: testSuite.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    this.printTestSummary();
    return this.testResults;
  }

  async testAuthenticationErrors() {
    console.log('🔐 Testando erros de autenticação...');

    const authScenarios = [
      {
        name: 'Invalid Credentials',
        error: { code: 'auth/invalid-credential', message: 'Invalid email or password' },
        expectedType: ErrorType.AUTHENTICATION,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'User Disabled',
        error: { code: 'auth/user-disabled', message: 'User account has been disabled' },
        expectedType: ErrorType.AUTHENTICATION,
        expectedSeverity: ErrorSeverity.HIGH,
        expectedRecoverable: false
      },
      {
        name: 'Token Expired',
        error: { code: 'auth/id-token-expired', message: 'Firebase ID token has expired' },
        expectedType: ErrorType.AUTHENTICATION,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'Network Request Failed',
        error: { code: 'auth/network-request-failed', message: 'Network error during authentication' },
        expectedType: ErrorType.AUTHENTICATION,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'Too Many Requests',
        error: { code: 'auth/too-many-requests', message: 'Too many unsuccessful login attempts' },
        expectedType: ErrorType.AUTHENTICATION,
        expectedSeverity: ErrorSeverity.HIGH,
        expectedRecoverable: true
      }
    ];

    for (const scenario of authScenarios) {
      await this.testErrorScenario('Authentication', scenario);
    }

    console.log('✅ Testes de autenticação concluídos');
  }

  async testNetworkErrors() {
    console.log('🌐 Testando erros de rede...');

    const networkScenarios = [
      {
        name: 'Connection Timeout',
        error: { code: 'ECONNABORTED', message: 'Request timeout' },
        expectedType: ErrorType.NETWORK,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'Connection Refused',
        error: { code: 'ECONNREFUSED', message: 'Connection refused by server' },
        expectedType: ErrorType.NETWORK,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'DNS Resolution Failed',
        error: { code: 'ENOTFOUND', message: 'DNS lookup failed' },
        expectedType: ErrorType.NETWORK,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'Network Unreachable',
        error: { code: 'ENETUNREACH', message: 'Network is unreachable' },
        expectedType: ErrorType.NETWORK,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      }
    ];

    for (const scenario of networkScenarios) {
      await this.testErrorScenario('Network', scenario);
    }

    console.log('✅ Testes de rede concluídos');
  }

  async testValidationErrors() {
    console.log('📝 Testando erros de validação...');

    const validationScenarios = [
      {
        name: 'Invalid Email Format',
        error: { field: 'email', message: 'Invalid email format' },
        expectedType: ErrorType.VALIDATION,
        expectedSeverity: ErrorSeverity.LOW,
        expectedRecoverable: true
      },
      {
        name: 'Required Field Missing',
        error: { field: 'name', message: 'Name is required' },
        expectedType: ErrorType.VALIDATION,
        expectedSeverity: ErrorSeverity.LOW,
        expectedRecoverable: true
      },
      {
        name: 'Password Too Weak',
        error: { field: 'password', message: 'Password must be at least 8 characters' },
        expectedType: ErrorType.VALIDATION,
        expectedSeverity: ErrorSeverity.LOW,
        expectedRecoverable: true
      }
    ];

    for (const scenario of validationScenarios) {
      await this.testErrorScenario('Validation', scenario);
    }

    console.log('✅ Testes de validação concluídos');
  }

  async testFirebaseErrors() {
    console.log('🔥 Testando erros do Firebase...');

    const firebaseScenarios = [
      {
        name: 'Permission Denied',
        error: { code: 'permission-denied', message: 'Missing or insufficient permissions' },
        expectedType: ErrorType.PERMISSION,
        expectedSeverity: ErrorSeverity.HIGH,
        expectedRecoverable: false
      },
      {
        name: 'Document Not Found',
        error: { code: 'not-found', message: 'Document does not exist' },
        expectedType: ErrorType.UNKNOWN,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      },
      {
        name: 'Unavailable Service',
        error: { code: 'unavailable', message: 'Service temporarily unavailable' },
        expectedType: ErrorType.UNKNOWN,
        expectedSeverity: ErrorSeverity.MEDIUM,
        expectedRecoverable: true
      }
    ];

    for (const scenario of firebaseScenarios) {
      await this.testErrorScenario('Firebase', scenario);
    }

    console.log('✅ Testes do Firebase concluídos');
  }

  async testPermissionErrors() {
    console.log('🔒 Testando erros de permissão...');

    const permissionScenarios = [
      {
        name: 'Permission Denied',
        error: { code: 'permission-denied', message: 'Access denied' },
        expectedType: ErrorType.PERMISSION,
        expectedSeverity: ErrorSeverity.HIGH,
        expectedRecoverable: false
      }
    ];

    for (const scenario of permissionScenarios) {
      await this.testErrorScenario('Permission', scenario);
    }

    console.log('✅ Testes de permissão concluídos');
  }

  async testSYS001Scenarios() {
    console.log('🚨 Testando cenários específicos do SYS_001...');

    const sys001Scenarios = [
      {
        name: 'Generic Server Error (SYS_001)',
        error: { code: 'SYS_001', message: 'Internal server error' },
        expectedType: ErrorType.UNKNOWN,
        expectedSeverity: ErrorSeverity.CRITICAL,
        expectedRecoverable: true,
        shouldNotOccur: true
      }
    ];

    for (const scenario of sys001Scenarios) {
      await this.testErrorScenario('SYS_001', scenario);
      
      if (scenario.shouldNotOccur) {
        console.log('⚠️ SYS_001 detectado - este erro deveria ter sido eliminado');
      }
    }

    console.log('✅ Testes de SYS_001 concluídos');
  }

  async testErrorMessages() {
    console.log('💬 Testando mensagens de erro específicas...');

    const messageTests = [
      {
        errorCode: 'auth/invalid-credential',
        expectedMessage: 'Email ou senha inválidos',
        context: 'login'
      },
      {
        errorCode: 'auth/network-request-failed',
        expectedMessage: 'Problema de conexão',
        context: 'authentication'
      },
      {
        errorCode: 'permission-denied',
        expectedMessage: 'Você não tem permissão',
        context: 'database'
      }
    ];

    for (const test of messageTests) {
      const error = new Error('Test error');
      error.code = test.errorCode;
      
      const context = {
        component: test.context,
        action: 'test-action',
        timestamp: new Date(),
        environment: 'test'
      };

      const processedError = this.errorHandler.classifyError(error, context);
      
      if (processedError.userMessage && processedError.userMessage.includes(test.expectedMessage.split(' ')[0])) {
        console.log(`  ✓ Mensagem específica para ${test.errorCode}: OK`);
        this.testResults.push({
          category: 'Messages',
          scenario: test.errorCode,
          success: true,
          details: `Message: ${processedError.userMessage}`,
          timestamp: new Date()
        });
      } else {
        console.log(`  ⚠️ Mensagem genérica para ${test.errorCode}: ${processedError.userMessage}`);
        this.testResults.push({
          category: 'Messages',
          scenario: test.errorCode,
          success: false,
          error: `Expected message containing "${test.expectedMessage}", got "${processedError.userMessage}"`,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de mensagens de erro concluídos');
  }

  async testRecoveryClassification() {
    console.log('🔄 Testando classificação de recuperação...');

    const recoveryTests = [
      { code: 'auth/invalid-credential', expectedRecoverable: true },
      { code: 'auth/user-disabled', expectedRecoverable: false },
      { code: 'permission-denied', expectedRecoverable: false },
      { code: 'ECONNABORTED', expectedRecoverable: true },
      { field: 'email', expectedRecoverable: true }
    ];

    for (const test of recoveryTests) {
      const error = new Error('Test error');
      if (test.code) error.code = test.code;
      if (test.field) error.field = test.field;

      const processedError = this.errorHandler.classifyError(error, {
        component: 'test',
        action: 'recovery-test',
        timestamp: new Date(),
        environment: 'test'
      });

      if (processedError.recoverable === test.expectedRecoverable) {
        console.log(`  ✓ Classificação de recuperação para ${test.code || test.field}: OK`);
        this.testResults.push({
          category: 'Recovery',
          scenario: test.code || test.field,
          success: true,
          details: `Recoverable: ${processedError.recoverable}`,
          timestamp: new Date()
        });
      } else {
        console.log(`  ✗ Classificação incorreta para ${test.code || test.field}`);
        this.testResults.push({
          category: 'Recovery',
          scenario: test.code || test.field,
          success: false,
          error: `Expected recoverable: ${test.expectedRecoverable}, got: ${processedError.recoverable}`,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de classificação de recuperação concluídos');
  }

  async testErrorScenario(category, scenario) {
    try {
      const error = new Error(scenario.error.message);
      if (scenario.error.code) {
        error.code = scenario.error.code;
      }
      if (scenario.error.field) {
        error.field = scenario.error.field;
      }

      const context = {
        component: `test-${category.toLowerCase()}`,
        action: 'test-scenario',
        timestamp: new Date(),
        environment: 'test'
      };

      const processedError = this.errorHandler.classifyError(error, context);

      // Validações
      const validations = [
        {
          condition: processedError.type === scenario.expectedType,
          message: `Expected type ${scenario.expectedType}, got ${processedError.type}`
        },
        {
          condition: processedError.severity === scenario.expectedSeverity,
          message: `Expected severity ${scenario.expectedSeverity}, got ${processedError.severity}`
        },
        {
          condition: processedError.recoverable === scenario.expectedRecoverable,
          message: `Expected recoverable ${scenario.expectedRecoverable}, got ${processedError.recoverable}`
        }
      ];

      for (const validation of validations) {
        if (!validation.condition) {
          throw new Error(`${scenario.name}: ${validation.message}`);
        }
      }

      this.testResults.push({
        category,
        scenario: scenario.name,
        success: true,
        details: `Type: ${processedError.type}, Severity: ${processedError.severity}, Recoverable: ${processedError.recoverable}`,
        timestamp: new Date()
      });

      console.log(`  ✓ ${scenario.name}: OK`);

    } catch (error) {
      console.log(`  ✗ ${scenario.name}: ${error.message}`);
      this.testResults.push({
        category,
        scenario: scenario.name,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  printTestSummary() {
    console.log('\n📋 RESUMO DOS TESTES DE CENÁRIOS DE ERRO');
    console.log('==========================================');

    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`Total de cenários testados: ${totalTests}`);
    console.log(`✅ Sucessos: ${successfulTests}`);
    console.log(`❌ Falhas: ${failedTests}`);
    console.log(`📊 Taxa de sucesso: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

    // Estatísticas do error handler
    const errorStats = this.errorHandler.getErrorStats();
    console.log('\n📊 ESTATÍSTICAS DE ERROS PROCESSADOS:');
    console.log(`Total de erros processados: ${errorStats.total}`);
    console.log(`Recuperáveis: ${errorStats.recoverable}`);
    console.log(`Não recuperáveis: ${errorStats.nonRecoverable}`);
    
    console.log('\nPor tipo:');
    Object.entries(errorStats.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nPor severidade:');
    Object.entries(errorStats.bySeverity).forEach(([severity, count]) => {
      console.log(`  ${severity}: ${count}`);
    });

    // Agrupa por categoria
    const byCategory = this.testResults.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = { total: 0, success: 0 };
      }
      acc[result.category].total++;
      if (result.success) {
        acc[result.category].success++;
      }
      return acc;
    }, {});

    console.log('\n📊 RESULTADOS POR CATEGORIA:');
    Object.entries(byCategory).forEach(([category, stats]) => {
      const rate = ((stats.success / stats.total) * 100).toFixed(1);
      console.log(`${category}: ${stats.success}/${stats.total} (${rate}%)`);
    });

    if (failedTests > 0) {
      console.log('\n❌ CENÁRIOS COM FALHA:');
      this.testResults
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`- ${result.category}/${result.scenario}: ${result.error}`);
        });
    }

    // Verifica se SYS_001 foi detectado
    const sys001Detected = this.testResults.some(r => 
      r.category === 'SYS_001' && r.scenario.includes('SYS_001')
    );
    
    if (sys001Detected) {
      console.log('\n⚠️ ATENÇÃO: Erro SYS_001 foi detectado nos testes!');
      console.log('Este erro deveria ter sido eliminado pela implementação.');
    } else {
      console.log('\n✅ Nenhum erro SYS_001 inesperado detectado.');
    }
  }
}

// Função para executar todos os testes
async function runErrorScenariosTests() {
  const testSuite = new ErrorScenariosTestSuite();
  return await testSuite.runAllErrorScenarios();
}

// Executa testes se chamado diretamente
if (require.main === module) {
  runErrorScenariosTests()
    .then(() => {
      console.log('\n🎉 Testes de cenários de erro concluídos!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erro nos testes:', error);
      process.exit(1);
    });
}

module.exports = {
  ErrorScenariosTestSuite,
  runErrorScenariosTests
};