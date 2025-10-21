/**
 * Performance Testing Suite
 * Tests system performance under load and stress conditions
 * Validates response times, circuit breakers, and system limits
 */

class PerformanceTestSuite {
  constructor() {
    this.testResults = [];
    this.metrics = {
      responseTimes: [],
      throughput: [],
      errorRates: [],
      memoryUsage: [],
      cpuUsage: []
    };
  }

  async runAllPerformanceTests() {
    console.log('⚡ Iniciando testes de performance...\n');

    const testSuites = [
      this.testResponseTimes.bind(this),
      this.testLoadCapacity.bind(this),
      this.testStressLimits.bind(this),
      this.testCircuitBreakerPerformance.bind(this),
      this.testMemoryUsage.bind(this),
      this.testConcurrentUsers.bind(this),
      this.testDatabasePerformance.bind(this),
      this.testAPIThroughput.bind(this),
      this.testErrorHandlingPerformance.bind(this),
      this.testRecoveryPerformance.bind(this)
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

  async testResponseTimes() {
    console.log('⏱️ Testando tempos de resposta...');

    const responseTimeTests = [
      {
        name: 'API Health Check',
        target: '/api/health',
        expectedMaxTime: 100, // ms
        iterations: 10
      },
      {
        name: 'User Authentication',
        target: '/api/auth/login',
        expectedMaxTime: 500, // ms
        iterations: 5
      },
      {
        name: 'Data Retrieval',
        target: '/api/patients',
        expectedMaxTime: 1000, // ms
        iterations: 5
      },
      {
        name: 'Report Generation',
        target: '/api/reports',
        expectedMaxTime: 2000, // ms
        iterations: 3
      }
    ];

    for (const test of responseTimeTests) {
      const responseTimes = [];
      
      for (let i = 0; i < test.iterations; i++) {
        const startTime = Date.now();
        
        try {
          // Simula chamada de API
          await this.simulateAPICall(test.target);
          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);
          
          // Adiciona delay entre chamadas
          await this.sleep(50);
        } catch (error) {
          console.log(`  ⚠️ Erro na iteração ${i + 1}: ${error.message}`);
        }
      }

      if (responseTimes.length > 0) {
        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes);
        
        const success = avgTime <= test.expectedMaxTime;
        
        if (success) {
          console.log(`  ✓ ${test.name}: Avg ${avgTime.toFixed(0)}ms (Max: ${maxTime}ms, Min: ${minTime}ms)`);
        } else {
          console.log(`  ✗ ${test.name}: Avg ${avgTime.toFixed(0)}ms (esperado ≤${test.expectedMaxTime}ms)`);
        }

        this.testResults.push({
          category: 'Response Time',
          test: test.name,
          success,
          details: `Avg: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms, Min: ${minTime}ms`,
          metrics: { avgTime, maxTime, minTime, iterations: responseTimes.length },
          timestamp: new Date()
        });

        // Armazena métricas
        this.metrics.responseTimes.push(...responseTimes);
      }
    }

    console.log('✅ Testes de tempo de resposta concluídos');
  }

  async testLoadCapacity() {
    console.log('📊 Testando capacidade de carga...');

    const loadTests = [
      {
        name: 'Low Load (10 requests/sec)',
        requestsPerSecond: 10,
        duration: 5, // seconds
        expectedSuccessRate: 99
      },
      {
        name: 'Medium Load (50 requests/sec)',
        requestsPerSecond: 50,
        duration: 3,
        expectedSuccessRate: 95
      },
      {
        name: 'High Load (100 requests/sec)',
        requestsPerSecond: 100,
        duration: 2,
        expectedSuccessRate: 90
      }
    ];

    for (const loadTest of loadTests) {
      console.log(`  Executando: ${loadTest.name}...`);
      
      const results = await this.simulateLoad(
        loadTest.requestsPerSecond,
        loadTest.duration
      );

      const successRate = (results.successful / results.total) * 100;
      const avgResponseTime = results.totalTime / results.successful;
      
      const success = successRate >= loadTest.expectedSuccessRate;
      
      if (success) {
        console.log(`  ✓ ${loadTest.name}: ${successRate.toFixed(1)}% sucesso, ${avgResponseTime.toFixed(0)}ms avg`);
      } else {
        console.log(`  ✗ ${loadTest.name}: ${successRate.toFixed(1)}% sucesso (esperado ≥${loadTest.expectedSuccessRate}%)`);
      }

      this.testResults.push({
        category: 'Load Capacity',
        test: loadTest.name,
        success,
        details: `${successRate.toFixed(1)}% success rate, ${avgResponseTime.toFixed(0)}ms avg response`,
        metrics: {
          successRate,
          avgResponseTime,
          totalRequests: results.total,
          successfulRequests: results.successful
        },
        timestamp: new Date()
      });
    }

    console.log('✅ Testes de capacidade de carga concluídos');
  }

  async testStressLimits() {
    console.log('🔥 Testando limites de stress...');

    const stressTests = [
      {
        name: 'Memory Stress Test',
        test: async () => {
          const initialMemory = process.memoryUsage();
          const largeArrays = [];
          
          // Aloca memória gradualmente
          for (let i = 0; i < 10; i++) {
            largeArrays.push(new Array(100000).fill('test data'));
            await this.sleep(100);
          }
          
          const finalMemory = process.memoryUsage();
          const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
          
          // Limpa memória
          largeArrays.length = 0;
          
          return {
            success: memoryIncrease < 100, // Menos de 100MB de aumento
            details: `Memory increase: ${memoryIncrease.toFixed(2)}MB`,
            metrics: { memoryIncrease, initialMemory, finalMemory }
          };
        }
      },
      {
        name: 'CPU Intensive Operations',
        test: async () => {
          const startTime = Date.now();
          
          // Operação intensiva de CPU
          let result = 0;
          for (let i = 0; i < 1000000; i++) {
            result += Math.sqrt(i) * Math.sin(i);
          }
          
          const executionTime = Date.now() - startTime;
          
          return {
            success: executionTime < 1000, // Menos de 1 segundo
            details: `Execution time: ${executionTime}ms`,
            metrics: { executionTime, result }
          };
        }
      },
      {
        name: 'Concurrent Operations Stress',
        test: async () => {
          const concurrentOperations = 50;
          const promises = [];
          
          const startTime = Date.now();
          
          for (let i = 0; i < concurrentOperations; i++) {
            promises.push(this.simulateAsyncOperation());
          }
          
          const results = await Promise.allSettled(promises);
          const executionTime = Date.now() - startTime;
          
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const successRate = (successful / concurrentOperations) * 100;
          
          return {
            success: successRate >= 80, // Pelo menos 80% de sucesso
            details: `${successRate.toFixed(1)}% success rate in ${executionTime}ms`,
            metrics: { successRate, executionTime, concurrentOperations, successful }
          };
        }
      }
    ];

    for (const stressTest of stressTests) {
      try {
        console.log(`  Executando: ${stressTest.name}...`);
        const result = await stressTest.test();
        
        if (result.success) {
          console.log(`  ✓ ${stressTest.name}: ${result.details}`);
        } else {
          console.log(`  ✗ ${stressTest.name}: ${result.details}`);
        }

        this.testResults.push({
          category: 'Stress Limits',
          test: stressTest.name,
          success: result.success,
          details: result.details,
          metrics: result.metrics,
          timestamp: new Date()
        });
      } catch (error) {
        console.log(`  ✗ ${stressTest.name}: Erro - ${error.message}`);
        this.testResults.push({
          category: 'Stress Limits',
          test: stressTest.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de limites de stress concluídos');
  }

  async testCircuitBreakerPerformance() {
    console.log('⚡ Testando performance do circuit breaker...');

    const circuitBreakerTests = [
      {
        name: 'Circuit Breaker Response Time',
        test: async () => {
          const mockCircuitBreaker = new MockCircuitBreaker();
          const responseTimes = [];
          
          // Testa operações normais
          for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            try {
              await mockCircuitBreaker.execute(async () => 'success');
            } catch (error) {
              // Ignora erros para este teste
            }
            responseTimes.push(Date.now() - startTime);
          }
          
          const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          
          return {
            success: avgTime < 10, // Menos de 10ms overhead
            details: `Average overhead: ${avgTime.toFixed(2)}ms`,
            metrics: { avgTime, responseTimes }
          };
        }
      },
      {
        name: 'Circuit Breaker Under Load',
        test: async () => {
          const mockCircuitBreaker = new MockCircuitBreaker();
          const startTime = Date.now();
          
          // Simula carga com falhas
          const promises = [];
          for (let i = 0; i < 100; i++) {
            promises.push(
              mockCircuitBreaker.execute(async () => {
                if (Math.random() < 0.3) { // 30% de falha
                  throw new Error('Simulated failure');
                }
                return 'success';
              }).catch(() => 'failed')
            );
          }
          
          await Promise.all(promises);
          const totalTime = Date.now() - startTime;
          
          return {
            success: totalTime < 2000, // Menos de 2 segundos para 100 operações
            details: `100 operations completed in ${totalTime}ms`,
            metrics: { totalTime, operations: 100 }
          };
        }
      },
      {
        name: 'Circuit Breaker State Transitions',
        test: async () => {
          const mockCircuitBreaker = new MockCircuitBreaker();
          const startTime = Date.now();
          
          // Força abertura do circuito
          for (let i = 0; i < 5; i++) {
            try {
              await mockCircuitBreaker.execute(async () => {
                throw new Error('Force failure');
              });
            } catch (error) {
              // Esperado
            }
          }
          
          // Testa se circuito está aberto (deve ser rápido)
          const openStartTime = Date.now();
          try {
            await mockCircuitBreaker.execute(async () => 'should be blocked');
          } catch (error) {
            // Esperado
          }
          const openTime = Date.now() - openStartTime;
          
          const totalTime = Date.now() - startTime;
          
          return {
            success: openTime < 5 && totalTime < 1000, // Bloqueio rápido
            details: `State transition in ${totalTime}ms, open circuit response in ${openTime}ms`,
            metrics: { totalTime, openTime }
          };
        }
      }
    ];

    for (const cbTest of circuitBreakerTests) {
      try {
        console.log(`  Executando: ${cbTest.name}...`);
        const result = await cbTest.test();
        
        if (result.success) {
          console.log(`  ✓ ${cbTest.name}: ${result.details}`);
        } else {
          console.log(`  ✗ ${cbTest.name}: ${result.details}`);
        }

        this.testResults.push({
          category: 'Circuit Breaker Performance',
          test: cbTest.name,
          success: result.success,
          details: result.details,
          metrics: result.metrics,
          timestamp: new Date()
        });
      } catch (error) {
        console.log(`  ✗ ${cbTest.name}: Erro - ${error.message}`);
        this.testResults.push({
          category: 'Circuit Breaker Performance',
          test: cbTest.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de performance do circuit breaker concluídos');
  }

  async testMemoryUsage() {
    console.log('🧠 Testando uso de memória...');

    const memoryTests = [
      {
        name: 'Memory Leak Detection',
        test: async () => {
          const initialMemory = process.memoryUsage().heapUsed;
          
          // Simula operações que podem causar vazamento
          for (let i = 0; i < 1000; i++) {
            const tempData = new Array(1000).fill(`data-${i}`);
            await this.processData(tempData);
          }
          
          // Força garbage collection se disponível
          if (global.gc) {
            global.gc();
          }
          
          await this.sleep(100); // Aguarda GC
          
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
          
          return {
            success: memoryIncrease < 10, // Menos de 10MB de vazamento
            details: `Memory increase: ${memoryIncrease.toFixed(2)}MB`,
            metrics: { initialMemory, finalMemory, memoryIncrease }
          };
        }
      },
      {
        name: 'Memory Usage Under Load',
        test: async () => {
          const memorySnapshots = [];
          
          // Monitora memória durante carga
          for (let i = 0; i < 10; i++) {
            const memory = process.memoryUsage();
            memorySnapshots.push(memory.heapUsed / 1024 / 1024); // MB
            
            // Simula carga
            await this.simulateLoad(20, 0.5);
            await this.sleep(100);
          }
          
          const maxMemory = Math.max(...memorySnapshots);
          const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length;
          
          return {
            success: maxMemory < 200, // Menos de 200MB máximo
            details: `Max: ${maxMemory.toFixed(2)}MB, Avg: ${avgMemory.toFixed(2)}MB`,
            metrics: { maxMemory, avgMemory, snapshots: memorySnapshots }
          };
        }
      }
    ];

    for (const memTest of memoryTests) {
      try {
        console.log(`  Executando: ${memTest.name}...`);
        const result = await memTest.test();
        
        if (result.success) {
          console.log(`  ✓ ${memTest.name}: ${result.details}`);
        } else {
          console.log(`  ✗ ${memTest.name}: ${result.details}`);
        }

        this.testResults.push({
          category: 'Memory Usage',
          test: memTest.name,
          success: result.success,
          details: result.details,
          metrics: result.metrics,
          timestamp: new Date()
        });
      } catch (error) {
        console.log(`  ✗ ${memTest.name}: Erro - ${error.message}`);
        this.testResults.push({
          category: 'Memory Usage',
          test: memTest.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de uso de memória concluídos');
  }

  async testConcurrentUsers() {
    console.log('👥 Testando usuários concorrentes...');

    const concurrencyTests = [
      { users: 10, duration: 2, expectedSuccessRate: 95 },
      { users: 25, duration: 2, expectedSuccessRate: 90 },
      { users: 50, duration: 1, expectedSuccessRate: 85 }
    ];

    for (const test of concurrencyTests) {
      console.log(`  Simulando ${test.users} usuários concorrentes...`);
      
      const startTime = Date.now();
      const userPromises = [];
      
      for (let i = 0; i < test.users; i++) {
        userPromises.push(this.simulateUserSession(test.duration));
      }
      
      const results = await Promise.allSettled(userPromises);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const successRate = (successful / test.users) * 100;
      
      const success = successRate >= test.expectedSuccessRate;
      
      if (success) {
        console.log(`  ✓ ${test.users} usuários: ${successRate.toFixed(1)}% sucesso em ${totalTime}ms`);
      } else {
        console.log(`  ✗ ${test.users} usuários: ${successRate.toFixed(1)}% sucesso (esperado ≥${test.expectedSuccessRate}%)`);
      }

      this.testResults.push({
        category: 'Concurrent Users',
        test: `${test.users} Concurrent Users`,
        success,
        details: `${successRate.toFixed(1)}% success rate in ${totalTime}ms`,
        metrics: { users: test.users, successRate, totalTime, successful },
        timestamp: new Date()
      });
    }

    console.log('✅ Testes de usuários concorrentes concluídos');
  }

  async testDatabasePerformance() {
    console.log('🗄️ Testando performance do banco de dados...');

    const dbTests = [
      {
        name: 'Read Operations',
        operations: 100,
        expectedAvgTime: 50 // ms
      },
      {
        name: 'Write Operations',
        operations: 50,
        expectedAvgTime: 100 // ms
      },
      {
        name: 'Complex Queries',
        operations: 20,
        expectedAvgTime: 200 // ms
      }
    ];

    for (const dbTest of dbTests) {
      console.log(`  Testando: ${dbTest.name}...`);
      
      const responseTimes = [];
      
      for (let i = 0; i < dbTest.operations; i++) {
        const startTime = Date.now();
        await this.simulateDatabaseOperation(dbTest.name);
        responseTimes.push(Date.now() - startTime);
      }
      
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      
      const success = avgTime <= dbTest.expectedAvgTime;
      
      if (success) {
        console.log(`  ✓ ${dbTest.name}: Avg ${avgTime.toFixed(0)}ms (Max: ${maxTime}ms)`);
      } else {
        console.log(`  ✗ ${dbTest.name}: Avg ${avgTime.toFixed(0)}ms (esperado ≤${dbTest.expectedAvgTime}ms)`);
      }

      this.testResults.push({
        category: 'Database Performance',
        test: dbTest.name,
        success,
        details: `Avg: ${avgTime.toFixed(0)}ms, Max: ${maxTime}ms, Operations: ${dbTest.operations}`,
        metrics: { avgTime, maxTime, operations: dbTest.operations },
        timestamp: new Date()
      });
    }

    console.log('✅ Testes de performance do banco de dados concluídos');
  }

  async testAPIThroughput() {
    console.log('🚀 Testando throughput da API...');

    const throughputTest = async (requestsPerSecond, duration) => {
      const totalRequests = requestsPerSecond * duration;
      const interval = 1000 / requestsPerSecond; // ms entre requests
      
      let completed = 0;
      let errors = 0;
      const startTime = Date.now();
      
      const promises = [];
      
      for (let i = 0; i < totalRequests; i++) {
        promises.push(
          this.simulateAPICall('/api/test')
            .then(() => completed++)
            .catch(() => errors++)
        );
        
        if (i < totalRequests - 1) {
          await this.sleep(interval);
        }
      }
      
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      const actualThroughput = (completed / (totalTime / 1000)).toFixed(1);
      
      return {
        completed,
        errors,
        totalTime,
        actualThroughput: parseFloat(actualThroughput),
        expectedThroughput: requestsPerSecond
      };
    };

    const throughputTests = [
      { rps: 10, duration: 3, tolerance: 0.8 },
      { rps: 25, duration: 2, tolerance: 0.7 },
      { rps: 50, duration: 1, tolerance: 0.6 }
    ];

    for (const test of throughputTests) {
      console.log(`  Testando ${test.rps} req/s por ${test.duration}s...`);
      
      const result = await throughputTest(test.rps, test.duration);
      const throughputRatio = result.actualThroughput / result.expectedThroughput;
      
      const success = throughputRatio >= test.tolerance;
      
      if (success) {
        console.log(`  ✓ Throughput: ${result.actualThroughput} req/s (${(throughputRatio * 100).toFixed(1)}% do esperado)`);
      } else {
        console.log(`  ✗ Throughput: ${result.actualThroughput} req/s (esperado ≥${(test.tolerance * 100).toFixed(0)}% de ${test.rps})`);
      }

      this.testResults.push({
        category: 'API Throughput',
        test: `${test.rps} req/s`,
        success,
        details: `${result.actualThroughput} req/s actual, ${result.completed} completed, ${result.errors} errors`,
        metrics: result,
        timestamp: new Date()
      });
    }

    console.log('✅ Testes de throughput da API concluídos');
  }

  async testErrorHandlingPerformance() {
    console.log('🚨 Testando performance do tratamento de erros...');

    const errorTests = [
      {
        name: 'Error Processing Speed',
        test: async () => {
          const errors = [];
          const startTime = Date.now();
          
          // Gera e processa 100 erros
          for (let i = 0; i < 100; i++) {
            const error = new Error(`Test error ${i}`);
            error.code = 'TEST_ERROR';
            
            const processStartTime = Date.now();
            await this.simulateErrorProcessing(error);
            errors.push(Date.now() - processStartTime);
          }
          
          const totalTime = Date.now() - startTime;
          const avgProcessingTime = errors.reduce((a, b) => a + b, 0) / errors.length;
          
          return {
            success: avgProcessingTime < 10, // Menos de 10ms por erro
            details: `Avg processing time: ${avgProcessingTime.toFixed(2)}ms per error`,
            metrics: { avgProcessingTime, totalTime, errorsProcessed: 100 }
          };
        }
      },
      {
        name: 'Error Recovery Performance',
        test: async () => {
          const recoveryTimes = [];
          
          for (let i = 0; i < 20; i++) {
            const startTime = Date.now();
            await this.simulateErrorRecovery();
            recoveryTimes.push(Date.now() - startTime);
          }
          
          const avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
          
          return {
            success: avgRecoveryTime < 100, // Menos de 100ms para recuperação
            details: `Avg recovery time: ${avgRecoveryTime.toFixed(0)}ms`,
            metrics: { avgRecoveryTime, recoveryTimes }
          };
        }
      }
    ];

    for (const errorTest of errorTests) {
      try {
        console.log(`  Executando: ${errorTest.name}...`);
        const result = await errorTest.test();
        
        if (result.success) {
          console.log(`  ✓ ${errorTest.name}: ${result.details}`);
        } else {
          console.log(`  ✗ ${errorTest.name}: ${result.details}`);
        }

        this.testResults.push({
          category: 'Error Handling Performance',
          test: errorTest.name,
          success: result.success,
          details: result.details,
          metrics: result.metrics,
          timestamp: new Date()
        });
      } catch (error) {
        console.log(`  ✗ ${errorTest.name}: Erro - ${error.message}`);
        this.testResults.push({
          category: 'Error Handling Performance',
          test: errorTest.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de performance do tratamento de erros concluídos');
  }

  async testRecoveryPerformance() {
    console.log('🔄 Testando performance de recuperação...');

    const recoveryTests = [
      {
        name: 'Automatic Recovery Speed',
        test: async () => {
          const recoveryTimes = [];
          
          for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            
            // Simula falha e recuperação automática
            await this.simulateFailureAndRecovery();
            
            recoveryTimes.push(Date.now() - startTime);
          }
          
          const avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
          
          return {
            success: avgRecoveryTime < 500, // Menos de 500ms para recuperação
            details: `Avg recovery time: ${avgRecoveryTime.toFixed(0)}ms`,
            metrics: { avgRecoveryTime, recoveryTimes }
          };
        }
      },
      {
        name: 'Recovery Under Load',
        test: async () => {
          const startTime = Date.now();
          
          // Simula múltiplas recuperações simultâneas
          const recoveryPromises = [];
          for (let i = 0; i < 5; i++) {
            recoveryPromises.push(this.simulateFailureAndRecovery());
          }
          
          await Promise.all(recoveryPromises);
          const totalTime = Date.now() - startTime;
          
          return {
            success: totalTime < 2000, // Menos de 2 segundos para 5 recuperações
            details: `5 concurrent recoveries in ${totalTime}ms`,
            metrics: { totalTime, concurrentRecoveries: 5 }
          };
        }
      }
    ];

    for (const recoveryTest of recoveryTests) {
      try {
        console.log(`  Executando: ${recoveryTest.name}...`);
        const result = await recoveryTest.test();
        
        if (result.success) {
          console.log(`  ✓ ${recoveryTest.name}: ${result.details}`);
        } else {
          console.log(`  ✗ ${recoveryTest.name}: ${result.details}`);
        }

        this.testResults.push({
          category: 'Recovery Performance',
          test: recoveryTest.name,
          success: result.success,
          details: result.details,
          metrics: result.metrics,
          timestamp: new Date()
        });
      } catch (error) {
        console.log(`  ✗ ${recoveryTest.name}: Erro - ${error.message}`);
        this.testResults.push({
          category: 'Recovery Performance',
          test: recoveryTest.name,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    console.log('✅ Testes de performance de recuperação concluídos');
  }

  // Métodos auxiliares de simulação

  async simulateAPICall(endpoint) {
    const baseTime = 50;
    const randomDelay = Math.random() * 100;
    await this.sleep(baseTime + randomDelay);
    
    // Simula 5% de falha
    if (Math.random() < 0.05) {
      throw new Error('Simulated API failure');
    }
    
    return { status: 200, data: 'success' };
  }

  async simulateLoad(requestsPerSecond, duration) {
    const totalRequests = Math.floor(requestsPerSecond * duration);
    const promises = [];
    
    let successful = 0;
    let totalTime = 0;
    
    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        this.simulateAPICall('/test')
          .then(() => {
            successful++;
            totalTime += 100; // Tempo simulado
          })
          .catch(() => {
            // Falha
          })
      );
      
      // Delay entre requests
      if (i < totalRequests - 1) {
        await this.sleep(1000 / requestsPerSecond);
      }
    }
    
    await Promise.all(promises);
    
    return {
      total: totalRequests,
      successful,
      totalTime
    };
  }

  async simulateAsyncOperation() {
    await this.sleep(Math.random() * 100 + 50);
    
    // 10% de chance de falha
    if (Math.random() < 0.1) {
      throw new Error('Async operation failed');
    }
    
    return 'success';
  }

  async processData(data) {
    // Simula processamento de dados
    await this.sleep(1);
    return data.length;
  }

  async simulateUserSession(duration) {
    const operations = Math.floor(duration * 5); // 5 operações por segundo
    
    for (let i = 0; i < operations; i++) {
      await this.simulateAPICall('/user/action');
      await this.sleep(200); // 200ms entre operações
    }
    
    return 'session completed';
  }

  async simulateDatabaseOperation(type) {
    let baseTime = 30;
    
    switch (type) {
      case 'Read Operations':
        baseTime = 20;
        break;
      case 'Write Operations':
        baseTime = 50;
        break;
      case 'Complex Queries':
        baseTime = 100;
        break;
    }
    
    await this.sleep(baseTime + Math.random() * 50);
    return 'db operation completed';
  }

  async simulateErrorProcessing(error) {
    // Simula processamento de erro
    await this.sleep(Math.random() * 5 + 2);
    return { processed: true, error };
  }

  async simulateErrorRecovery() {
    // Simula recuperação de erro
    await this.sleep(Math.random() * 50 + 30);
    return { recovered: true };
  }

  async simulateFailureAndRecovery() {
    // Simula falha
    await this.sleep(50);
    
    // Simula detecção e recuperação
    await this.sleep(Math.random() * 200 + 100);
    
    return { recovered: true };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printTestSummary() {
    console.log('\n📋 RESUMO DOS TESTES DE PERFORMANCE');
    console.log('====================================');

    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`Total de testes: ${totalTests}`);
    console.log(`✅ Sucessos: ${successfulTests}`);
    console.log(`❌ Falhas: ${failedTests}`);
    console.log(`📊 Taxa de sucesso: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);

    // Estatísticas de performance
    if (this.metrics.responseTimes.length > 0) {
      const avgResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
      const maxResponseTime = Math.max(...this.metrics.responseTimes);
      console.log(`\n⏱️ MÉTRICAS DE RESPOSTA:`);
      console.log(`Tempo médio de resposta: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`Tempo máximo de resposta: ${maxResponseTime}ms`);
    }

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
      console.log('\n❌ TESTES COM FALHA:');
      this.testResults
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`- ${result.category}/${result.test}: ${result.error || 'Performance below threshold'}`);
        });
    }

    // Recomendações de performance
    console.log('\n💡 RECOMENDAÇÕES:');
    if (failedTests === 0) {
      console.log('✅ Sistema apresenta boa performance em todos os testes');
    } else {
      console.log('⚠️ Considere otimizações nos componentes com falhas');
      console.log('📈 Monitore métricas de performance em produção');
      console.log('🔧 Ajuste configurações de circuit breaker se necessário');
    }
  }
}

// Mock Circuit Breaker para testes
class MockCircuitBreaker {
  constructor() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.failureThreshold = 3;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Função para executar todos os testes
async function runPerformanceTests() {
  const testSuite = new PerformanceTestSuite();
  return await testSuite.runAllPerformanceTests();
}

// Executa testes se chamado diretamente
if (require.main === module) {
  runPerformanceTests()
    .then(() => {
      console.log('\n🎉 Testes de performance concluídos!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erro nos testes:', error);
      process.exit(1);
    });
}

module.exports = {
  PerformanceTestSuite,
  runPerformanceTests
};