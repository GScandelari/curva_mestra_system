#!/usr/bin/env node

/**
 * Diagnose SYS_001 Error
 * 
 * This script helps diagnose the specific cause of SYS_001 errors
 */

console.log('🔍 Diagnóstico Específico do Erro SYS_001\n');

console.log('📋 ANÁLISE DOS LOGS FIREBASE:');
console.log('');
console.log('❌ Erros encontrados nos logs:');
console.log('   • "Request has invalid method. GET"');
console.log('   • "Invalid request, unable to process"');
console.log('   • Funções Firebase recebendo GET em vez de POST');
console.log('');

console.log('🔍 POSSÍVEIS CAUSAS:');
console.log('');

console.log('1️⃣ Requisições GET para Firebase Functions:');
console.log('   • Navegador fazendo preflight requests');
console.log('   • Extensões do navegador fazendo requests');
console.log('   • Bots ou crawlers acessando URLs');
console.log('   • Configuração incorreta de CORS');
console.log('');

console.log('2️⃣ Problemas de Frontend:');
console.log('   • Código fazendo requisições GET por engano');
console.log('   • Configuração incorreta do apiClient');
console.log('   • Problemas no firebaseService');
console.log('   • Cache do navegador com requisições antigas');
console.log('');

console.log('3️⃣ Problemas de Configuração:');
console.log('   • Firebase Functions mal configuradas');
console.log('   • CORS não configurado corretamente');
console.log('   • Middleware de autenticação com problemas');
console.log('');

console.log('💡 SOLUÇÕES PARA TESTAR:');
console.log('');

console.log('🔄 Limpeza Completa:');
console.log('   1. Limpar cache do navegador (Ctrl+Shift+R)');
console.log('   2. Limpar localStorage e sessionStorage');
console.log('   3. Testar em modo incógnito');
console.log('   4. Testar em outro navegador');
console.log('');

console.log('🔧 Debug no Navegador:');
console.log('   1. Abrir Developer Tools (F12)');
console.log('   2. Ir para aba Network');
console.log('   3. Limpar network log');
console.log('   4. Reproduzir o erro');
console.log('   5. Procurar por requisições GET para Firebase Functions');
console.log('');

console.log('📱 Comandos de Debug:');
console.log('   // No console do navegador:');
console.log('   debugSYS001.showErrorLogs()');
console.log('   debugSYS001.testFirebase()');
console.log('   debugSYS001.clearErrorLogs()');
console.log('');

console.log('🚨 AÇÕES IMEDIATAS:');
console.log('');

console.log('1. Verificar se há requisições GET nas funções:');
console.log('   • Abrir aba Network no DevTools');
console.log('   • Procurar por requests para:');
console.log('     - validateAdminInitialization');
console.log('     - initializeDefaultAdmin');
console.log('     - Outras funções Firebase');
console.log('   • Verificar se o método é POST (correto) ou GET (erro)');
console.log('');

console.log('2. Verificar código do frontend:');
console.log('   • Procurar por fetch() ou axios.get() para Firebase Functions');
console.log('   • Verificar se firebaseService está usando POST');
console.log('   • Verificar se não há código fazendo GET por engano');
console.log('');

console.log('3. Testar isoladamente:');
console.log('   • Testar login sem outras ações');
console.log('   • Testar em página limpa');
console.log('   • Verificar se erro ocorre sempre ou esporadicamente');
console.log('');

console.log('📊 INFORMAÇÕES PARA COLETA:');
console.log('');
console.log('Se o problema persistir, colete:');
console.log('   • Screenshot da aba Network mostrando requisições');
console.log('   • Logs do console do navegador');
console.log('   • Horário exato do erro');
console.log('   • Ação específica que causa o erro');
console.log('   • Navegador e versão');
console.log('');

console.log('🔧 COMANDOS ÚTEIS:');
console.log('');
console.log('# Ver logs Firebase em tempo real:');
console.log('firebase functions:log --project curva-mestra --follow');
console.log('');
console.log('# Testar funções diretamente:');
console.log('node scripts/testAPIClient.js no-auth');
console.log('');
console.log('# Verificar configuração Firebase:');
console.log('node scripts/testFirebaseInit.js');
console.log('');

console.log('✅ Execute estes passos e documente os resultados.');
console.log('🌐 Aplicação: https://curva-mestra.web.app');
console.log('🌐 Local: http://localhost:3000');