#!/usr/bin/env node

/**
 * Deploy All Changes
 * 
 * This script automatically commits changes to Git and deploys to Firebase
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando deploy completo...\n');

// Function to execute command and log output
function executeCommand(command, options = {}) {
  try {
    console.log(`📋 Executando: ${command}`);
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'inherit',
      ...options 
    });
    return { success: true, output };
  } catch (error) {
    console.error(`❌ Erro ao executar: ${command}`);
    console.error(error.message);
    return { success: false, error: error.message };
  }
}

// Check if there are changes to commit
function hasChangesToCommit() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim().length > 0;
  } catch (error) {
    console.error('❌ Erro ao verificar status do Git:', error.message);
    return false;
  }
}

// Get commit message from user or use default
function getCommitMessage() {
  const args = process.argv.slice(2);
  const messageIndex = args.indexOf('-m');
  
  if (messageIndex !== -1 && args[messageIndex + 1]) {
    return args[messageIndex + 1];
  }
  
  // Default commit message with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `chore: Deploy automático - ${timestamp}`;
}

// Main deployment function
async function deployAll() {
  const startTime = new Date();
  
  try {
    // Step 1: Check for changes
    console.log('1️⃣ Verificando alterações...');
    if (!hasChangesToCommit()) {
      console.log('ℹ️ Nenhuma alteração encontrada para commit');
    } else {
      // Step 2: Add all changes
      console.log('2️⃣ Adicionando alterações ao Git...');
      const addResult = executeCommand('git add .');
      if (!addResult.success) {
        throw new Error('Falha ao adicionar arquivos ao Git');
      }

      // Step 3: Commit changes
      console.log('3️⃣ Fazendo commit das alterações...');
      const commitMessage = getCommitMessage();
      const commitResult = executeCommand(`git commit -m "${commitMessage}"`);
      if (!commitResult.success) {
        throw new Error('Falha ao fazer commit');
      }

      // Step 4: Push to repository
      console.log('4️⃣ Enviando para repositório...');
      const pushResult = executeCommand('git push origin main');
      if (!pushResult.success) {
        throw new Error('Falha ao fazer push');
      }
    }

    // Step 5: Build frontend
    console.log('5️⃣ Fazendo build do frontend...');
    const buildResult = executeCommand('npm run build', { cwd: 'frontend' });
    if (!buildResult.success) {
      throw new Error('Falha no build do frontend');
    }

    // Step 6: Deploy to Firebase
    console.log('6️⃣ Fazendo deploy no Firebase...');
    const deployResult = executeCommand('firebase deploy --only "functions,hosting" --project curva-mestra');
    if (!deployResult.success) {
      throw new Error('Falha no deploy do Firebase');
    }

    // Success
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n✅ Deploy completo realizado com sucesso!');
    console.log(`⏱️ Tempo total: ${duration} segundos`);
    console.log('🌐 URL da aplicação: https://curva-mestra.web.app');
    console.log('🔧 Console Firebase: https://console.firebase.google.com/project/curva-mestra/overview');
    
  } catch (error) {
    console.error('\n❌ Erro durante o deploy:', error.message);
    process.exit(1);
  }
}

// Show help
function showHelp() {
  console.log(`
🚀 Deploy All Changes

Uso:
  node scripts/deployAll.js                    # Deploy com mensagem automática
  node scripts/deployAll.js -m "Sua mensagem" # Deploy com mensagem customizada
  node scripts/deployAll.js --help            # Mostrar esta ajuda

O que este script faz:
1. Verifica se há alterações no Git
2. Adiciona todas as alterações (git add .)
3. Faz commit com mensagem automática ou customizada
4. Faz push para o repositório (git push origin main)
5. Faz build do frontend (npm run build)
6. Faz deploy no Firebase (functions + hosting)

Exemplos:
  node scripts/deployAll.js -m "feat: Nova funcionalidade X"
  node scripts/deployAll.js -m "fix: Correção do bug Y"
  node scripts/deployAll.js -m "docs: Atualização da documentação"
`);
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run deployment
deployAll();