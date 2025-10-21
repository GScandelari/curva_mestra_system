/**
 * Comprehensive Validation Test Runner
 * Executes all validation tests for the SYS_001 platform recovery
 * Provides a complete overview of system health and SYS_001 elimination
 */

const { runErrorScenariosTests } = require('./simpleErrorScenariosTest.js');
const { runEnvironmentTests } = require('./environmentTest.js');
const { runPerformanceTests } = require('./performanceTest.js');
const { runSYS001Validation } = require('./sys001ValidationTest.js');

class ComprehensiveValidationRunner {
  constructor() {
    this.allResults = {
      errorScenarios: null,
      environment: null,
      performance: null,
      sys001Validation: null
    };
    this.startTime = null;
    this.endTime = null;
  }

  async runAllValidations() {
    console.log('🚀 INICIANDO VALIDAÇÃO COMPLETA DA PLATAFORMA');
    console.log('==============================================');
    console.log('🎯 Objetivo: Validar eliminação completa do SYS_001');
    console.log('📋 Executando todos os testes de validação\n');

    this.startTime = Date.now();

    try {
      // 1. Testes de Cenários de Erro
      console.log('1️⃣ EXECUTANDO TESTES DE CENÁRIOS DE ERRO...');
      console.log('─'.repeat(50));
      this.allResults.errorScenarios = await runErrorScenariosTests();
      console.log('\n');

      // 2. Testes de Ambiente
      console.log('2️⃣ EXECUTANDO TESTES DE AMBIENTE...');
      console.log('─'.repeat(50));
      this.allResults.environment = await runEnvironmentTests();
      console.log('\n');

      // 3. Testes de Performance
      console.log('3️⃣ EXECUTANDO TESTES DE PERFORMANCE...');
      console.log('─'.repeat(50));
      this.allResults.performance = await runPerformanceTests();
      console.log('\n');

      // 4. Validação Final do SYS_001
      console.log('4️⃣ EXECUTANDO VALIDAÇÃO FINAL DO SYS_001...');
      console.log('─'.repeat(50));
      this.allResults.sys001Validation = await runSYS001Validation();
      console.log('\n');

      this.endTime = Date.now();
      this.printComprehensiveSummary();

    } catch (error) {
      console.error('💥 Erro durante a execução dos testes:', error);
      this.endTime = Date.now();
      this.printErrorSummary(error);
    }

    return this.allResults;
  }

  printComprehensiveSummary() {
    const totalTime = ((this.endTime - this.startTime) / 1000).toFixed(1);
    
    console.log('🏁 RESUMO COMPLETO DA VALIDAÇÃO');
    console.log('================================');
    console.log(`⏱️ Tempo total de execução: ${totalTime}s\n`);

    // Estatísticas gerais
    const stats = this.calculateOverallStats();
    
    console.log('📊 ESTATÍSTICAS GERAIS:');
    console.log(`Total de testes executados: ${stats.totalTests}`);
    console.log(`✅ Sucessos: ${stats.totalSuccess} (${stats.successRate}%)`);
    console.log(`❌ Falhas: ${stats.totalFailures} (${stats.failureRate}%)`);
    console.log(`🚨 SYS_001 detectado: ${stats.sys001Detected ? 'SIM' : 'NÃO'}\n`);

    // Resultados por categoria de teste
    console.log('📋 RESULTADOS POR CATEGORIA:');
    
    if (this.allResults.errorScenarios) {
      const errorStats = this.getTestStats(this.allResults.errorScenarios);
      console.log(`🔍 Cenários de Erro: ${errorStats.success}/${errorStats.total} (${errorStats.rate}%)`);
    }
    
    if (this.allResults.environment) {
      const envStats = this.getTestStats(this.allResults.environment);
      console.log(`🌍 Ambiente: ${envStats.success}/${envStats.total} (${envStats.rate}%)`);
    }
    
    if (this.allResults.performance) {
      const perfStats = this.getTestStats(this.allResults.performance);
      console.log(`⚡ Performance: ${perfStats.success}/${perfStats.total} (${perfStats.rate}%)`);
    }
    
    if (this.allResults.sys001Validation) {
      const validationStats = this.getTestStats(this.allResults.sys001Validation);
      console.log(`🎯 Validação SYS_001: ${validationStats.success}/${validationStats.total} (${validationStats.rate}%)`);
    }

    // Status do SYS_001
    console.log('\n🚨 STATUS FINAL DO SYS_001:');
    if (stats.sys001Detected) {
      console.log('❌ SYS_001 AINDA PRESENTE NO SISTEMA!');
      console.log('   ⚠️ AÇÃO NECESSÁRIA: Revisar implementação');
      console.log('   🔧 Verificar logs de erro para detalhes específicos');
    } else {
      console.log('✅ SYS_001 COMPLETAMENTE ELIMINADO!');
      console.log('   🎉 Objetivo principal alcançado');
      console.log('   🚀 Sistema validado para produção');
    }

    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    this.printRecommendations(stats);

    // Próximos passos
    console.log('\n📋 PRÓXIMOS PASSOS:');
    this.printNextSteps(stats);
  }

  calculateOverallStats() {
    let totalTests = 0;
    let totalSuccess = 0;
    let sys001Detected = false;

    // Processa cada categoria de teste
    Object.values(this.allResults).forEach(results => {
      if (results && Array.isArray(results)) {
        results.forEach(result => {
          totalTests++;
          if (result.success) {
            totalSuccess++;
          }
          if (result.sys001Detected || result.sys001 || 
              (result.category === 'SYS_001' && result.scenario && result.scenario.includes('SYS_001'))) {
            sys001Detected = true;
          }
        });
      }
    });

    const totalFailures = totalTests - totalSuccess;
    const successRate = totalTests > 0 ? ((totalSuccess / totalTests) * 100).toFixed(1) : '0.0';
    const failureRate = totalTests > 0 ? ((totalFailures / totalTests) * 100).toFixed(1) : '0.0';

    return {
      totalTests,
      totalSuccess,
      totalFailures,
      successRate,
      failureRate,
      sys001Detected
    };
  }

  getTestStats(results) {
    if (!results || !Array.isArray(results)) {
      return { total: 0, success: 0, rate: '0.0' };
    }

    const total = results.length;
    const success = results.filter(r => r.success).length;
    const rate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';

    return { total, success, rate };
  }

  printRecommendations(stats) {
    if (stats.sys001Detected) {
      console.log('🔧 SYS_001 ainda presente:');
      console.log('   - Revisar implementação do error handler');
      console.log('   - Verificar configurações Firebase');
      console.log('   - Analisar logs de erro detalhados');
      console.log('   - Executar diagnóstico específico');
    } else if (stats.totalFailures > 0) {
      console.log('⚠️ Algumas validações falharam:');
      console.log('   - Revisar testes com falha');
      console.log('   - Otimizar performance se necessário');
      console.log('   - Verificar configurações de ambiente');
      console.log('   - Considerar ajustes de configuração');
    } else {
      console.log('✅ Sistema completamente validado:');
      console.log('   - Monitorar métricas em produção');
      console.log('   - Manter documentação atualizada');
      console.log('   - Executar validações periódicas');
      console.log('   - Implementar alertas de monitoramento');
    }
  }

  printNextSteps(stats) {
    if (stats.sys001Detected) {
      console.log('1. 🔍 Investigar ocorrências de SYS_001');
      console.log('2. 🔧 Corrigir implementações problemáticas');
      console.log('3. 🧪 Re-executar validações');
      console.log('4. 📋 Documentar correções aplicadas');
    } else if (stats.totalFailures > 0) {
      console.log('1. 📊 Analisar falhas específicas');
      console.log('2. ⚡ Otimizar componentes com baixa performance');
      console.log('3. ⚙️ Ajustar configurações se necessário');
      console.log('4. 🚀 Preparar para deploy em produção');
    } else {
      console.log('1. 🚀 Sistema pronto para produção');
      console.log('2. 📈 Implementar monitoramento contínuo');
      console.log('3. 📚 Atualizar documentação final');
      console.log('4. 🎉 Celebrar eliminação completa do SYS_001!');
    }
  }

  printErrorSummary(error) {
    console.log('\n💥 ERRO DURANTE VALIDAÇÃO');
    console.log('==========================');
    console.log(`Erro: ${error.message}`);
    console.log(`Tempo até falha: ${((this.endTime - this.startTime) / 1000).toFixed(1)}s`);
    
    console.log('\n📊 RESULTADOS PARCIAIS:');
    Object.entries(this.allResults).forEach(([category, results]) => {
      if (results) {
        const stats = this.getTestStats(results);
        console.log(`${category}: ${stats.success}/${stats.total} (${stats.rate}%)`);
      } else {
        console.log(`${category}: Não executado`);
      }
    });
  }
}

// Função principal para executar todas as validações
async function runComprehensiveValidation() {
  const runner = new ComprehensiveValidationRunner();
  return await runner.runAllValidations();
}

// Executa validação completa se chamado diretamente
if (require.main === module) {
  runComprehensiveValidation()
    .then(() => {
      console.log('\n🎯 Validação completa da plataforma concluída!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erro na validação completa:', error);
      process.exit(1);
    });
}

module.exports = {
  ComprehensiveValidationRunner,
  runComprehensiveValidation
};