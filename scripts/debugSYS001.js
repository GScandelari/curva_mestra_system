#!/usr/bin/env node

/**
 * Debug SYS_001 Error
 * 
 * This script helps debug the SYS_001 internal server error
 */

const https = require('https');
const http = require('http');

console.log('🔍 Debugging SYS_001 Error\n');

// Test Firebase Functions
async function testFirebaseFunctions() {
  console.log('1️⃣ Testando Firebase Functions...');
  
  const functions = [
    'validateAdminInitialization',
    'initializeDefaultAdmin'
  ];

  for (const func of functions) {
    try {
      const url = `https://us-central1-curva-mestra.cloudfunctions.net/${func}`;
      const data = JSON.stringify({ data: {} });
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const response = await new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      if (response.status === 200) {
        console.log(`✅ ${func}: OK`);
      } else {
        console.log(`❌ ${func}: Status ${response.status}`);
        console.log(`   Response: ${response.body}`);
      }
    } catch (error) {
      console.log(`❌ ${func}: Error - ${error.message}`);
    }
  }
}

// Test local development server
async function testLocalServer() {
  console.log('\n2️⃣ Testando servidor local...');
  
  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3000', { method: 'GET' }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => reject(new Error('Timeout')));
      req.end();
    });

    if (response.status === 200) {
      console.log('✅ Servidor local: OK');
      
      // Check for SYS_001 in response
      if (response.body.includes('SYS_001')) {
        console.log('🚨 SYS_001 encontrado na resposta do servidor local!');
      }
    } else {
      console.log(`❌ Servidor local: Status ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Servidor local: ${error.message}`);
    console.log('   Certifique-se de que o servidor está rodando em http://localhost:3000');
  }
}

// Check common causes of SYS_001
function checkCommonCauses() {
  console.log('\n3️⃣ Verificando causas comuns do SYS_001...');
  
  const causes = [
    {
      name: 'Configuração Firebase',
      check: () => {
        const fs = require('fs');
        const path = require('path');
        
        const envPath = path.join(__dirname, '../frontend/.env');
        if (fs.existsSync(envPath)) {
          const env = fs.readFileSync(envPath, 'utf8');
          if (env.includes('VITE_FIREBASE_API_KEY') && env.includes('VITE_FIREBASE_PROJECT_ID')) {
            return { ok: true, message: 'Configuração Firebase presente' };
          }
        }
        return { ok: false, message: 'Configuração Firebase ausente ou incompleta' };
      }
    },
    {
      name: 'Servidor de desenvolvimento',
      check: () => {
        // This would be checked by testLocalServer
        return { ok: true, message: 'Verificado separadamente' };
      }
    },
    {
      name: 'Dependências Node.js',
      check: () => {
        const fs = require('fs');
        const path = require('path');
        
        const packagePath = path.join(__dirname, '../frontend/package.json');
        if (fs.existsSync(packagePath)) {
          return { ok: true, message: 'package.json encontrado' };
        }
        return { ok: false, message: 'package.json não encontrado' };
      }
    }
  ];

  causes.forEach(cause => {
    try {
      const result = cause.check();
      if (result.ok) {
        console.log(`✅ ${cause.name}: ${result.message}`);
      } else {
        console.log(`❌ ${cause.name}: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ ${cause.name}: Erro ao verificar - ${error.message}`);
    }
  });
}

// Provide troubleshooting steps
function provideTroubleshootingSteps() {
  console.log('\n4️⃣ Passos para resolver SYS_001:');
  console.log('');
  console.log('📋 Se o erro aparece no navegador:');
  console.log('   1. Abra o Console do Desenvolvedor (F12)');
  console.log('   2. Vá para a aba Console');
  console.log('   3. Procure por erros em vermelho');
  console.log('   4. Vá para a aba Network');
  console.log('   5. Recarregue a página e veja se há requisições falhando');
  console.log('');
  console.log('🔧 Soluções comuns:');
  console.log('   • Limpar cache do navegador (Ctrl+Shift+R)');
  console.log('   • Verificar se o servidor está rodando (npm run dev)');
  console.log('   • Verificar configuração Firebase no .env');
  console.log('   • Verificar se há erros de CORS');
  console.log('   • Verificar se as funções Firebase estão deployadas');
  console.log('');
  console.log('🆘 Se o problema persistir:');
  console.log('   • Verifique os logs do Firebase: firebase functions:log');
  console.log('   • Teste as APIs diretamente com curl ou Postman');
  console.log('   • Verifique se há problemas de rede ou firewall');
}

// Main execution
async function main() {
  await testFirebaseFunctions();
  await testLocalServer();
  checkCommonCauses();
  provideTroubleshootingSteps();
  
  console.log('\n✅ Debug concluído. Verifique os resultados acima.');
}

main().catch(console.error);