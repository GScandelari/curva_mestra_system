#!/usr/bin/env node

const axios = require('axios');

/**
 * Script para forçar refresh do token do usuário
 * Isso garante que as custom claims sejam atualizadas no frontend
 */

const BASE_URL = 'https://us-central1-curva-mestra.cloudfunctions.net';

class TokenRefresher {
  
  async callAPI(endpoint, data = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    const payload = { data };

    try {
      console.log(`🚀 Chamando: ${endpoint}`);
      console.log(`📤 Dados:`, JSON.stringify(data, null, 2));
      
      const response = await axios.post(url, payload, { headers });
      
      console.log(`✅ Sucesso (${response.status})`);
      console.log(`📥 Resposta:`, JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error(`❌ Erro em ${endpoint}:`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Resposta:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`Erro:`, error.message);
      }
      throw error;
    }
  }

  async validateAdminStatus() {
    try {
      console.log('\n🔍 === VALIDANDO STATUS DO ADMIN ===');
      
      // Validar inicialização
      console.log('\n1️⃣ Verificando inicialização do sistema...');
      const validation = await this.callAPI('validateAdminInitialization');
      
      if (validation.result.isInitialized) {
        console.log('✅ Sistema inicializado corretamente');
        console.log(`📧 Admin: ${validation.result.email}`);
        console.log(`🆔 UID: ${validation.result.uid}`);
        console.log(`👑 Role: ${validation.result.role}`);
        console.log(`🔐 Admin Claims: ${validation.result.hasAdminClaims}`);
        
        if (validation.result.claims && validation.result.claims.permissions) {
          console.log('\n📋 Permissões ativas:');
          validation.result.claims.permissions.forEach((permission, index) => {
            console.log(`   ${index + 1}. ✅ ${permission}`);
          });
        }
        
        return validation.result;
      } else {
        console.log('❌ Sistema não inicializado');
        return null;
      }
      
    } catch (error) {
      console.error('\n❌ Erro ao validar status:', error.message);
      throw error;
    }
  }

  async showInstructions() {
    console.log(`
🔄 Token Refresher - Curva Mestra

Este script valida o status do admin e fornece instruções para refresh do token.

📋 === INSTRUÇÕES PARA REFRESH DO TOKEN ===

1️⃣ **No navegador (https://curva-mestra.web.app):**
   - Abra o Console do Navegador (F12)
   - Faça logout completo
   - Limpe o localStorage: localStorage.clear()
   - Faça login novamente

2️⃣ **Forçar refresh do token (se já logado):**
   - No console do navegador, digite:
   - firebase.auth().currentUser.getIdToken(true)
   - Depois recarregue a página (F5)

3️⃣ **Verificar permissões no console:**
   - firebase.auth().currentUser.getIdTokenResult()
   - Verifique se as claims estão corretas

4️⃣ **Se ainda não funcionar:**
   - Faça logout completo
   - Aguarde 5 minutos
   - Faça login novamente
   - As permissões podem levar alguns minutos para propagar

🎯 === STATUS ESPERADO ===

Sua conta deve ter:
- ✅ admin: true
- ✅ role: "administrator"  
- ✅ isDefaultAdmin: true
- ✅ 14 permissões administrativas
- ✅ Acesso a todas as funcionalidades

🔧 === TROUBLESHOOTING ===

Se o problema persistir:
1. Verifique se está usando o email correto: scandelari.guilherme@hotmail.com
2. Confirme que não há múltiplas contas com o mesmo email
3. Tente em uma aba anônima/privada do navegador
4. Limpe completamente o cache do navegador
    `);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const refresher = new TokenRefresher();
  
  try {
    switch (command) {
      case 'validate':
        await refresher.validateAdminStatus();
        break;
        
      case 'instructions':
      default:
        await refresher.showInstructions();
        if (command !== 'instructions') {
          console.log('\n🔍 Validando status atual...');
          await refresher.validateAdminStatus();
        }
        break;
    }
  } catch (error) {
    console.error('💥 Erro na execução:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TokenRefresher;