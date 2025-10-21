#!/usr/bin/env node

/**
 * Recovery System Test Runner
 * Executa todos os testes de resiliência do sistema de recuperação
 */

const { runRecoverySystemTests } = require('./recoverySystemTest.js');

async function main() {
  console.log('🚀 Iniciando bateria completa de testes de resiliência...\n');
  
  try {
    const startTime = Date.now();
    
    // Executa testes de resiliência
    const results = await runRecoverySystemTests();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n⏱️  Tempo total de execução: ${duration}ms`);
    
    // Verifica se todos os testes passaram
    const allPassed = results.every(result => result.success);
    
    if (allPassed) {
      console.log('\n🎉 TODOS OS TESTES DE RESILIÊNCIA PASSARAM!');
      console.log('✅ Sistema de recuperação automática está funcionando corretamente');
      process.exit(0);
    } else {
      console.log('\n❌ ALGUNS TESTES FALHARAM');
      console.log('⚠️  Sistema de recuperação precisa de ajustes');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Erro crítico durante os testes:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executa se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { main };