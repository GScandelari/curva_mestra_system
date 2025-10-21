/**
 * Script para testar regras de segurança do Firestore
 * 
 * Este script usa o Firebase Rules Unit Testing para validar
 * as regras de segurança implementadas no Firestore.
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
  doctorUserId: 'doctor-user-1',
  otherClinicId: 'other-clinic',
  otherUserId: 'other-user-1'
};

class FirestoreRulesTest {
  constructor() {
    this.testEnv = null;
  }

  /**
   * Configurar ambiente de teste
   */
  async setup() {
    try {
      // Carregar regras de segurança
      const rules = fs.readFileSync(RULES_FILE, 'utf8');
      
      // Inicializar ambiente de teste
      this.testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: rules,
          host: 'localhost',
          port: 8080
        }
      });
      
      console.log('Ambiente de teste configurado');
    } catch (error) {
      console.error('Erro ao configurar ambiente de teste:', error.message);
      console.log('\n⚠️ Certifique-se de que o Firebase Emulator está rodando:');
      console.log('firebase emulators:start --only firestore');
      throw error;
    }
  }

  /**
   * Criar contexto de teste com autenticação específica
   */
  getTestContext(auth = null) {
    if (!this.testEnv) {
      throw new Error('Test environment not initialized');
    }
    
    if (auth) {
      return this.testEnv.authenticatedContext(auth.uid, auth.token);
    } else {
      return this.testEnv.unauthenticatedContext();
    }
  }

  /**
   * Executar teste e verificar resultado
   */
  async runTest(testName, testFn) {
    try {
      console.log(`\n🧪 Executando: ${testName}`);
      await testFn();
      console.log(`✅ ${testName} - PASSOU`);
      return true;
    } catch (error) {
      console.log(`❌ ${testName} - FALHOU: ${error.message}`);
      return false;
    }
  }

  /**
   * Testes de autenticação básica
   */
  async testAuthentication() {
    const tests = [];

    // Teste 1: Usuário não autenticado não pode acessar dados
    tests.push(await this.runTest(
      'Usuário não autenticado não pode ler dados da clínica',
      async () => {
        const context = this.getTestContext(); // Sem auth
        const db = context.firestore();
        
        await assertFails(
          db.collection(`clinics/${testData.clinicId}/products`).get()
        );
      }
    ));

    // Teste 2: Usuário autenticado pode acessar dados da própria clínica
    tests.push(await this.runTest(
      'Usuário autenticado pode ler dados da própria clínica',
      async () => {
        const context = this.getTestContext({
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
    tests.push(await this.runTest(
      'Usuário não pode acessar dados de outra clínica',
      async () => {
        const context = this.getTestContext({
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

    return tests;
  }

  /**
   * Testes de permissões por role
   */
  async testRolePermissions() {
    const tests = [];

    // Teste 1: Apenas admin pode criar usuários
    tests.push(await this.runTest(
      'Apenas admin pode criar usuários',
      async () => {
        // Receptionist não pode criar usuário
        const receptionistApp = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertFails(
          receptionistApp.firestore()
            .doc(`clinics/${testData.clinicId}/users/new-user`)
            .set({ name: 'Novo Usuário', role: 'doctor' })
        );

        // Admin pode criar usuário
        const adminApp = this.getTestApp({
          uid: testData.adminUserId,
          token: { 
            role: 'admin',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertSucceeds(
          adminApp.firestore()
            .doc(`clinics/${testData.clinicId}/users/new-user`)
            .set({ name: 'Novo Usuário', role: 'doctor' })
        );
      }
    ));

    // Teste 2: Admin e manager podem criar produtos
    tests.push(await this.runTest(
      'Admin e manager podem criar produtos',
      async () => {
        // Receptionist não pode criar produto
        const receptionistApp = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertFails(
          receptionistApp.firestore()
            .doc(`clinics/${testData.clinicId}/products/new-product`)
            .set({ name: 'Novo Produto', category: 'medicamento' })
        );

        // Manager pode criar produto
        const managerApp = this.getTestApp({
          uid: 'manager-user-1',
          token: { 
            role: 'manager',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertSucceeds(
          managerApp.firestore()
            .doc(`clinics/${testData.clinicId}/products/new-product`)
            .set({ name: 'Novo Produto', category: 'medicamento' })
        );
      }
    ));

    // Teste 3: Apenas doctors podem criar tratamentos
    tests.push(await this.runTest(
      'Apenas doctors e admins podem criar tratamentos',
      async () => {
        // Receptionist não pode criar tratamento
        const receptionistApp = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertFails(
          receptionistApp.firestore()
            .doc(`clinics/${testData.clinicId}/patients/patient-1/treatments/treatment-1`)
            .set({ description: 'Tratamento teste', doctorId: testData.doctorUserId })
        );

        // Doctor pode criar tratamento
        const doctorApp = this.getTestApp({
          uid: testData.doctorUserId,
          token: { 
            role: 'doctor',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertSucceeds(
          doctorApp.firestore()
            .doc(`clinics/${testData.clinicId}/patients/patient-1/treatments/treatment-1`)
            .set({ description: 'Tratamento teste', doctorId: testData.doctorUserId })
        );
      }
    ));

    return tests;
  }

  /**
   * Testes de propriedade de dados
   */
  async testDataOwnership() {
    const tests = [];

    // Teste 1: Usuário pode atualizar seus próprios dados
    tests.push(await this.runTest(
      'Usuário pode atualizar seus próprios dados',
      async () => {
        const app = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = app.firestore();
        
        // Primeiro criar o usuário
        await db.doc(`clinics/${testData.clinicId}/users/${testData.userId}`)
          .set({ name: 'Usuário Teste', email: 'teste@teste.com' });
        
        // Usuário pode atualizar seus próprios dados
        await firebase.assertSucceeds(
          db.doc(`clinics/${testData.clinicId}/users/${testData.userId}`)
            .update({ name: 'Nome Atualizado' })
        );
        
        // Usuário não pode atualizar dados de outro usuário
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/users/other-user`)
            .update({ name: 'Nome Atualizado' })
        );
      }
    ));

    // Teste 2: Usuário pode modificar suas próprias solicitações
    tests.push(await this.runTest(
      'Usuário pode modificar suas próprias solicitações',
      async () => {
        const app = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = app.firestore();
        
        // Criar solicitação
        await db.doc(`clinics/${testData.clinicId}/requests/request-1`)
          .set({ 
            requesterId: testData.userId,
            status: 'pending',
            notes: 'Solicitação teste'
          });
        
        // Usuário pode atualizar sua própria solicitação
        await firebase.assertSucceeds(
          db.doc(`clinics/${testData.clinicId}/requests/request-1`)
            .update({ notes: 'Notas atualizadas' })
        );
        
        // Criar solicitação de outro usuário
        await db.doc(`clinics/${testData.clinicId}/requests/request-2`)
          .set({ 
            requesterId: 'other-user',
            status: 'pending',
            notes: 'Solicitação de outro usuário'
          });
        
        // Usuário não pode atualizar solicitação de outro usuário
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/requests/request-2`)
            .update({ notes: 'Tentativa de atualização' })
        );
      }
    ));

    return tests;
  }

  /**
   * Testes de logs de auditoria
   */
  async testAuditLogs() {
    const tests = [];

    // Teste 1: Apenas admins podem ler logs de auditoria
    tests.push(await this.runTest(
      'Apenas admins podem ler logs de auditoria',
      async () => {
        // Receptionist não pode ler logs
        const receptionistApp = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertFails(
          receptionistApp.firestore()
            .collection(`clinics/${testData.clinicId}/auditLogs`)
            .get()
        );

        // Admin pode ler logs
        const adminApp = this.getTestApp({
          uid: testData.adminUserId,
          token: { 
            role: 'admin',
            clinicId: testData.clinicId
          }
        });
        
        await firebase.assertSucceeds(
          adminApp.firestore()
            .collection(`clinics/${testData.clinicId}/auditLogs`)
            .get()
        );
      }
    ));

    // Teste 2: Logs não podem ser modificados ou deletados
    tests.push(await this.runTest(
      'Logs não podem ser modificados ou deletados',
      async () => {
        const adminApp = this.getTestApp({
          uid: testData.adminUserId,
          token: { 
            role: 'admin',
            clinicId: testData.clinicId
          }
        });
        const db = adminApp.firestore();
        
        // Tentar atualizar log (deve falhar)
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/auditLogs/log-1`)
            .update({ action: 'modified' })
        );
        
        // Tentar deletar log (deve falhar)
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/auditLogs/log-1`)
            .delete()
        );
      }
    ));

    return tests;
  }

  /**
   * Testes de notificações
   */
  async testNotifications() {
    const tests = [];

    // Teste 1: Usuário pode ler apenas suas próprias notificações
    tests.push(await this.runTest(
      'Usuário pode ler apenas suas próprias notificações',
      async () => {
        const app = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = app.firestore();
        
        // Criar notificação do usuário
        await db.doc(`clinics/${testData.clinicId}/notifications/notif-1`)
          .set({ 
            userId: testData.userId,
            message: 'Notificação do usuário',
            isRead: false
          });
        
        // Usuário pode ler sua própria notificação
        await firebase.assertSucceeds(
          db.doc(`clinics/${testData.clinicId}/notifications/notif-1`).get()
        );
        
        // Criar notificação de outro usuário
        await db.doc(`clinics/${testData.clinicId}/notifications/notif-2`)
          .set({ 
            userId: 'other-user',
            message: 'Notificação de outro usuário',
            isRead: false
          });
        
        // Usuário não pode ler notificação de outro usuário
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/notifications/notif-2`).get()
        );
      }
    ));

    // Teste 2: Usuário pode marcar suas notificações como lidas
    tests.push(await this.runTest(
      'Usuário pode marcar suas notificações como lidas',
      async () => {
        const app = this.getTestApp({
          uid: testData.userId,
          token: { 
            role: 'receptionist',
            clinicId: testData.clinicId
          }
        });
        const db = app.firestore();
        
        // Criar notificação
        await db.doc(`clinics/${testData.clinicId}/notifications/notif-3`)
          .set({ 
            userId: testData.userId,
            message: 'Notificação para marcar como lida',
            isRead: false
          });
        
        // Usuário pode marcar como lida
        await firebase.assertSucceeds(
          db.doc(`clinics/${testData.clinicId}/notifications/notif-3`)
            .update({ isRead: true })
        );
        
        // Usuário não pode modificar outros campos
        await firebase.assertFails(
          db.doc(`clinics/${testData.clinicId}/notifications/notif-3`)
            .update({ message: 'Mensagem modificada' })
        );
      }
    ));

    return tests;
  }

  /**
   * Executar todos os testes
   */
  async runAllTests() {
    console.log('🚀 Iniciando testes das regras de segurança do Firestore\n');
    
    await this.setup();
    
    const allTests = [];
    
    // Executar grupos de testes
    allTests.push(...await this.testAuthentication());
    allTests.push(...await this.testRolePermissions());
    allTests.push(...await this.testDataOwnership());
    allTests.push(...await this.testAuditLogs());
    allTests.push(...await this.testNotifications());
    
    // Calcular resultados
    const passed = allTests.filter(result => result).length;
    const failed = allTests.length - passed;
    
    console.log('\n📊 Resultados dos Testes:');
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📈 Taxa de Sucesso: ${((passed / allTests.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 Todos os testes passaram! As regras de segurança estão funcionando corretamente.');
    } else {
      console.log('\n⚠️ Alguns testes falharam. Revise as regras de segurança.');
    }
    
    return { passed, failed, total: allTests.length };
  }

  /**
   * Limpar recursos de teste
   */
  async cleanup() {
    if (this.testEnv) {
      await this.testEnv.cleanup();
      console.log('\n🧹 Limpeza concluída');
    }
  }
}

// Função principal
async function main() {
  const tester = new FirestoreRulesTest();
  
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

module.exports = FirestoreRulesTest;