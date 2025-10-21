/**
 * Script simplificado para testar regras de segurança do Firestore
 * 
 * NOTA: Este script requer que o Firebase Emulator esteja rodando.
 * Execute: firebase emulators:start --only firestore
 */

const { 
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// Configuração do projeto de teste
const PROJECT_ID = 'curva-mestra-test';
const RULES_FILE = path.join(__dirname, '../../firestore.rules');

// Dados de teste
const testData = {
  clinicId: 'test-clinic',
  userId: 'test-user-1',
  adminUserId: 'admin-user-1',
  otherClinicId: 'other-clinic'
};

class SimpleFirestoreRulesTest {
  constructor() {
    this.testEnv = null;
  }

  async setup() {
    try {
      const rules = fs.readFileSync(RULES_FILE, 'utf8');
      
      this.testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: rules,
          host: 'localhost',
          port: 8080
        }
      });
      
      console.log('✅ Ambiente de teste configurado');
    } catch (error) {
      console.error('❌ Erro ao configurar ambiente de teste:', error.message);
      console.log('\n⚠️ Certifique-se de que o Firebase Emulator está rodando:');
      console.log('firebase emulators:start --only firestore');
      throw error;
    }
  }

  getContext(auth = null) {
    if (!this.testEnv) {
      throw new Error('Test environment not initialized');
    }
    
    if (auth) {
      return this.testEnv.authenticatedContext(auth.uid, auth.token);
    } else {
      return this.testEnv.unauthenticatedContext();
    }
  }

  async runTest(testName, testFn) {
    try {
      console.log(`\n🧪 ${testName}`);
      await testFn();
      console.log(`✅ PASSOU`);
      return true;
    } catch (error) {
      console.log(`❌ FALHOU: ${error.message}`);
      return false;
    }
  }

  async runBasicTests() {
    const results = [];

    // Teste 1: Usuário não autenticado não pode acessar dados
    results.push(await this.runTest(
      'Usuário não autenticado não pode ler dados da clínica',
      async () => {
        const context = this.getContext(); // Sem auth
        const db = context.firestore();
        
        await assertFails(
          db.collection(`clinics/${testData.clinicId}/products`).get()
        );
      }
    ));

    // Teste 2: Usuário autenticado pode acessar dados da própria clínica
    results.push(await this.runTest(
      'Usuário autenticado pode ler dados da própria clínica',
      async () => {
        const context = this.getContext({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = context.firestore();
        
        await assertSucceeds(
          db.collection(`clinics/${testData.clinicId}/products`).get()
        );
      }
    ));

    // Teste 3: Usuário não pode acessar dados de outra clínica
    results.push(await this.runTest(
      'Usuário não pode acessar dados de outra clínica',
      async () => {
        const context = this.getContext({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = context.firestore();
        
        await assertFails(
          db.collection(`clinics/${testData.otherClinicId}/products`).get()
        );
      }
    ));

    // Teste 4: Apenas admin pode criar usuários
    results.push(await this.runTest(
      'Apenas admin pode criar usuários',
      async () => {
        // Receptionist não pode criar usuário
        const receptionistContext = this.getContext({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await assertFails(
          receptionistContext.firestore()
            .doc(`clinics/${testData.clinicId}/users/new-user`)
            .set({ name: 'Novo Usuário', role: 'doctor' })
        );

        // Admin pode criar usuário
        const adminContext = this.getContext({
          uid: testData.adminUserId,
          token: { 
            role: 'admin',
            clinicId: testData.clinicId
          }
        });
        
        await assertSucceeds(
          adminContext.firestore()
            .doc(`clinics/${testData.clinicId}/users/new-user`)
            .set({ name: 'Novo Usuário', role: 'doctor' })
        );
      }
    ));

    // Teste 5: Admin e manager podem criar produtos
    results.push(await this.runTest(
      'Admin e manager podem criar produtos',
      async () => {
        // Receptionist não pode criar produto
        const receptionistContext = this.getContext({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await assertFails(
          receptionistContext.firestore()
            .doc(`clinics/${testData.clinicId}/products/new-product`)
            .set({ name: 'Novo Produto', category: 'medicamento' })
        );

        // Manager pode criar produto
        const managerContext = this.getContext({
          uid: 'manager-user-1',
          token: { 
            role: 'manager',
            clinicId: testData.clinicId
          }
        });
        
        await assertSucceeds(
          managerContext.firestore()
            .doc(`clinics/${testData.clinicId}/products/new-product`)
            .set({ name: 'Novo Produto', category: 'medicamento' })
        );
      }
    ));

    return results;
  }

  async runAllTests() {
    console.log('🚀 Iniciando testes das regras de segurança do Firestore\n');
    
    await this.setup();
    
    const results = await this.runBasicTests();
    
    // Calcular resultados
    const passed = results.filter(result => result).length;
    const failed = results.length - passed;
    
    console.log('\n📊 Resultados dos Testes:');
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📈 Taxa de Sucesso: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 Todos os testes passaram! As regras de segurança estão funcionando corretamente.');
    } else {
      console.log('\n⚠️ Alguns testes falharam. Revise as regras de segurança.');
    }
    
    return { passed, failed, total: results.length };
  }

  async cleanup() {
    if (this.testEnv) {
      await this.testEnv.cleanup();
      console.log('\n🧹 Limpeza concluída');
    }
  }
}

// Função principal
async function main() {
  const tester = new SimpleFirestoreRulesTest();
  
  try {
    const results = await tester.runAllTests();
    
    // Retornar código de saída baseado nos resultados
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Erro durante execução dos testes:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = SimpleFirestoreRulesTest;