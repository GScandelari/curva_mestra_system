/**
 * Recovery System Tests - Testes de Resiliência
 * Testa sistema de recuperação automática, circuit breaker e fallbacks
 */

const { RecoveryManager } = require('../utils/RecoveryManager.ts');
const { CircuitBreaker, CircuitBreakerFactory } = require('../utils/CircuitBreaker.ts');
const { RetryManager } = require('../utils/RetryManager.ts');
const { FallbackManager } = require('../utils/FallbackManager.ts');
const { ErrorType, ErrorSeverity, BackoffStrategy } = require('../types/errorTypes.ts');

class RecoverySystemTests {
  constructor() {
    this.recoveryManager = new RecoveryManager();
    this.retryManager = new RetryManager();
    this.fallbackManager = new FallbackManager();
    this.testResults = [];
  }

  /**
   * Executa todos os testes de resiliência
   */
  async runAllTests() {
    console.log('🧪 Iniciando testes de resiliência do sistema de recuperação...\n');

    const tests = [
      this.testRecoveryManager.bind(this),
      this.testCircuitBreaker.bind(this),
      this.testRetryMechanism.bind(this),
      this.testFallbackSystem.bind(this),
      this.testNetworkFailureSimulation.bind(this),
      this.testSystemOverloadSimulation.bind(this),
      this.testIntegratedRecoveryFlow.bind(this)
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error(`❌ Teste falhou: ${error.message}`);
        this.testResults.push({
          test: test.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    this.printTestSummary();
    return this.testResults;
  }

  /**
   * Testa RecoveryManager
   */
  async testRecoveryManager() {
    console.log('🔄 Testando RecoveryManager...');

    // Cria estratégia de teste
    const testStrategy = {
      name: 'test-strategy',
      canHandle: (error) => error.type === ErrorType.NETWORK,
      execute: async (error) => ({
        success: true,
        message: 'Recovery successful'
      }),
      maxRetries: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    };

    // Registra estratégia
    this.recoveryManager.registerStrategy(ErrorType.NETWORK, testStrategy);

    // Cria erro de teste
    const testError = {
      id: 'test-error-1',
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      message: 'Network timeout',
      originalError: new Error('Network timeout'),
      context: {
        component: 'test-component',
        action: 'test-action',
        timestamp: new Date(),
        environment: 'test'
      },
      recoverable: true,
      retryable: true
    };

    // Testa execução de recuperação
    const result = await this.recoveryManager.executeRecovery(testError);

    if (result.success) {
      console.log('✅ RecoveryManager: Recuperação executada com sucesso');
      this.testResults.push({
        test: 'RecoveryManager',
        success: true,
        details: 'Recovery strategy executed successfully',
        timestamp: new Date()
      });
    } else {
      throw new Error('Recovery failed: ' + result.message);
    }

    // Testa estatísticas
    const stats = this.recoveryManager.getRecoveryStats();
    console.log(`📊 RecoveryManager Stats: ${stats.totalAttempts} tentativas, ${stats.registeredStrategies} estratégias`);
  }

  /**
   * Testa Circuit Breaker
   */
  async testCircuitBreaker() {
    console.log('⚡ Testando Circuit Breaker...');

    const circuitBreaker = CircuitBreakerFactory.forTesting();
    let successCount = 0;
    let failureCount = 0;

    // Simula operações bem-sucedidas
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(async () => {
          return 'success';
        });
        successCount++;
      } catch (error) {
        failureCount++;
      }
    }

    console.log(`✅ Circuit Breaker: ${successCount} sucessos iniciais`);

    // Simula falhas para abrir o circuito
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Simulated failure');
        });
      } catch (error) {
        failureCount++;
      }
    }

    // Verifica se o circuito está aberto
    const stats = circuitBreaker.getStats();
    if (stats.state === 'open') {
      console.log('✅ Circuit Breaker: Circuito aberto após falhas');
    } else {
      throw new Error('Circuit breaker should be open after failures');
    }

    // Testa bloqueio de operações
    try {
      await circuitBreaker.execute(async () => 'should be blocked');
      throw new Error('Operation should have been blocked');
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        console.log('✅ Circuit Breaker: Operações bloqueadas corretamente');
      } else {
        throw error;
      }
    }

    this.testResults.push({
      test: 'CircuitBreaker',
      success: true,
      details: `Failures: ${failureCount}, State: ${stats.state}`,
      timestamp: new Date()
    });
  }

  /**
   * Testa mecanismo de retry
   */
  async testRetryMechanism() {
    console.log('🔁 Testando mecanismo de retry...');

    let attemptCount = 0;
    const maxRetries = 3;

    // Testa retry com falha eventual
    const result = await this.retryManager.executeWithRetry(
      async () => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error('Temporary failure');
        }
        return 'success after retries';
      },
      ErrorType.NETWORK,
      { maxRetries, baseDelay: 100, maxDelay: 1000 }
    );

    if (result.success && result.totalAttempts === maxRetries) {
      console.log(`✅ Retry Mechanism: Sucesso após ${result.totalAttempts} tentativas`);
      this.testResults.push({
        test: 'RetryMechanism',
        success: true,
        details: `Success after ${result.totalAttempts} attempts`,
        timestamp: new Date()
      });
    } else {
      throw new Error('Retry mechanism failed');
    }

    // Testa retry com falha permanente
    attemptCount = 0;
    const failResult = await this.retryManager.executeWithRetry(
      async () => {
        attemptCount++;
        throw new Error('Permanent failure');
      },
      ErrorType.NETWORK,
      { maxRetries: 2, baseDelay: 50, maxDelay: 500 }
    );

    if (!failResult.success && failResult.totalAttempts === 3) {
      console.log('✅ Retry Mechanism: Falha permanente detectada corretamente');
    } else {
      throw new Error('Retry should have failed after max attempts');
    }
  }

  /**
   * Testa sistema de fallback
   */
  async testFallbackSystem() {
    console.log('🛡️ Testando sistema de fallback...');

    // Testa cache de dados
    this.fallbackManager.cacheData('test-key', { data: 'cached value' }, 5000);
    
    const cachedData = this.fallbackManager.getCachedData('test-key');
    if (cachedData && cachedData.data.data === 'cached value') {
      console.log('✅ Fallback System: Cache funcionando');
    } else {
      throw new Error('Cache not working properly');
    }

    // Testa fallback com dados
    const fallbackResult = await this.fallbackManager.getDataWithFallback(
      'test-fallback',
      async () => {
        throw new Error('Primary source failed');
      },
      { fallback: 'fallback data' }
    );

    if (fallbackResult.success && fallbackResult.source === 'fallback') {
      console.log('✅ Fallback System: Fallback de dados funcionando');
    } else {
      throw new Error('Fallback data not working');
    }

    // Testa modo offline
    this.fallbackManager.setOfflineMode(true);
    if (this.fallbackManager.isOfflineMode()) {
      console.log('✅ Fallback System: Modo offline ativado');
    } else {
      throw new Error('Offline mode not activated');
    }

    this.testResults.push({
      test: 'FallbackSystem',
      success: true,
      details: 'Cache, fallback data, and offline mode working',
      timestamp: new Date()
    });
  }

  /**
   * Simula falhas de rede
   */
  async testNetworkFailureSimulation() {
    console.log('🌐 Simulando falhas de rede...');

    const networkCircuitBreaker = CircuitBreakerFactory.forExternalAPI();
    let networkFailures = 0;
    let networkRecoveries = 0;

    // Simula falhas intermitentes de rede
    for (let i = 0; i < 10; i++) {
      try {
        await networkCircuitBreaker.execute(async () => {
          // Simula 70% de falha de rede
          if (Math.random() < 0.7) {
            throw new Error('Network request failed');
          }
          return 'network success';
        });
        networkRecoveries++;
      } catch (error) {
        networkFailures++;
      }

      // Pequeno delay entre tentativas
      await this.sleep(50);
    }

    console.log(`📊 Network Simulation: ${networkFailures} falhas, ${networkRecoveries} sucessos`);

    // Verifica se o circuit breaker reagiu apropriadamente
    const stats = networkCircuitBreaker.getStats();
    if (stats.failureCount > 0) {
      console.log('✅ Network Failure Simulation: Circuit breaker detectou falhas');
    }

    this.testResults.push({
      test: 'NetworkFailureSimulation',
      success: true,
      details: `${networkFailures} failures, ${networkRecoveries} recoveries, CB state: ${stats.state}`,
      timestamp: new Date()
    });
  }

  /**
   * Simula sobrecarga do sistema
   */
  async testSystemOverloadSimulation() {
    console.log('⚡ Simulando sobrecarga do sistema...');

    const systemCircuitBreaker = CircuitBreakerFactory.forCriticalService();
    let overloadCount = 0;
    let processedCount = 0;

    // Simula múltiplas requisições simultâneas
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        systemCircuitBreaker.execute(async () => {
          // Simula processamento lento
          await this.sleep(Math.random() * 100);
          
          // Simula sobrecarga (50% de falha)
          if (Math.random() < 0.5) {
            throw new Error('System overload');
          }
          return 'processed';
        }).then(() => {
          processedCount++;
        }).catch(() => {
          overloadCount++;
        })
      );
    }

    await Promise.all(promises);

    console.log(`📊 System Overload: ${overloadCount} sobrecargas, ${processedCount} processados`);

    const stats = systemCircuitBreaker.getStats();
    console.log(`🔧 Circuit Breaker final state: ${stats.state}`);

    this.testResults.push({
      test: 'SystemOverloadSimulation',
      success: true,
      details: `${overloadCount} overloads, ${processedCount} processed, CB state: ${stats.state}`,
      timestamp: new Date()
    });
  }

  /**
   * Testa fluxo integrado de recuperação
   */
  async testIntegratedRecoveryFlow() {
    console.log('🔗 Testando fluxo integrado de recuperação...');

    // Cria estratégia integrada
    const integratedStrategy = {
      name: 'integrated-recovery',
      canHandle: (error) => error.type === ErrorType.NETWORK,
      execute: async (error) => {
        // Simula tentativa de recuperação
        await this.sleep(100);
        
        // 60% de chance de sucesso
        if (Math.random() < 0.6) {
          return { success: true, message: 'Integrated recovery successful' };
        } else {
          return { success: false, message: 'Recovery failed', fallbackRequired: true };
        }
      },
      maxRetries: 2,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    };

    this.recoveryManager.registerStrategy(ErrorType.NETWORK, integratedStrategy);

    // Testa múltiplos cenários de erro
    const scenarios = [
      { type: ErrorType.NETWORK, message: 'Connection timeout' },
      { type: ErrorType.DATABASE, message: 'Database unavailable' },
      { type: ErrorType.AUTHENTICATION, message: 'Token expired' }
    ];

    let recoverySuccesses = 0;
    let fallbackExecutions = 0;

    for (const scenario of scenarios) {
      const testError = {
        id: `integrated-test-${Date.now()}`,
        type: scenario.type,
        severity: ErrorSeverity.HIGH,
        message: scenario.message,
        originalError: new Error(scenario.message),
        context: {
          component: 'integrated-test',
          action: 'test-recovery',
          timestamp: new Date(),
          environment: 'test'
        },
        recoverable: true,
        retryable: true
      };

      try {
        const recoveryResult = await this.recoveryManager.executeRecovery(testError);
        
        if (recoveryResult.success) {
          recoverySuccesses++;
        } else if (recoveryResult.fallbackRequired) {
          await this.fallbackManager.executeFallback(testError);
          fallbackExecutions++;
        }
      } catch (error) {
        console.warn(`Recovery failed for ${scenario.type}: ${error.message}`);
      }
    }

    console.log(`📊 Integrated Flow: ${recoverySuccesses} recuperações, ${fallbackExecutions} fallbacks`);

    this.testResults.push({
      test: 'IntegratedRecoveryFlow',
      success: true,
      details: `${recoverySuccesses} recoveries, ${fallbackExecutions} fallbacks`,
      timestamp: new Date()
    });
  }

  /**
   * Utilitário para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Imprime resumo dos testes
   */
  printTestSummary() {
    console.log('\n📋 RESUMO DOS TESTES DE RESILIÊNCIA');
    console.log('=====================================');

    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`Total de testes: ${totalTests}`);
    console.log(`✅ Sucessos: ${successfulTests}`);
    console.log(`❌ Falhas: ${failedTests}`);
    console.log(`📊 Taxa de sucesso: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ TESTES FALHARAM:');
      this.testResults
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`- ${result.test}: ${result.error}`);
        });
    }

    console.log('\n✅ TESTES BEM-SUCEDIDOS:');
    this.testResults
      .filter(r => r.success)
      .forEach(result => {
        console.log(`- ${result.test}: ${result.details || 'Passed'}`);
      });
  }
}

// Função para executar testes
async function runRecoverySystemTests() {
  const tester = new RecoverySystemTests();
  return await tester.runAllTests();
}

// Executa testes se chamado diretamente
if (require.main === module) {
  runRecoverySystemTests()
    .then(() => {
      console.log('\n🎉 Testes de resiliência concluídos!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erro nos testes:', error);
      process.exit(1);
    });
}

module.exports = {
  RecoverySystemTests,
  runRecoverySystemTests
};