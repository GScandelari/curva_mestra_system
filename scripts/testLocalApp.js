#!/usr/bin/env node

/**
 * Test Local Application
 * 
 * This script tests the local application to identify SYS_001 errors
 */

const puppeteer = require('puppeteer');

async function testLocalApp() {
  console.log('🔍 Testando aplicação local para identificar erro SYS_001...\n');

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        console.log('❌ Console Error:', text);
      } else if (text.includes('SYS_001')) {
        console.log('🚨 SYS_001 Error Found:', text);
      }
    });

    // Listen for network failures
    page.on('requestfailed', request => {
      console.log('🌐 Network Error:', request.url(), request.failure().errorText);
    });

    // Navigate to local app
    console.log('📱 Navegando para http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check for error messages on page
    const errorElements = await page.$$eval('[class*="error"], [class*="Error"]', elements => 
      elements.map(el => el.textContent)
    );

    if (errorElements.length > 0) {
      console.log('🔍 Erros encontrados na página:');
      errorElements.forEach(error => {
        if (error.includes('SYS_001')) {
          console.log('🚨 SYS_001:', error);
        } else {
          console.log('⚠️ Erro:', error);
        }
      });
    }

    // Try to interact with the app
    console.log('🔄 Testando interações básicas...');
    
    // Check if login form exists
    const loginForm = await page.$('form');
    if (loginForm) {
      console.log('✅ Formulário de login encontrado');
    }

    // Check for any SYS_001 in page content
    const pageContent = await page.content();
    if (pageContent.includes('SYS_001')) {
      console.log('🚨 SYS_001 encontrado no conteúdo da página');
    }

    console.log('✅ Teste concluído. Verifique os logs acima para erros SYS_001.');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  require('puppeteer');
  testLocalApp();
} catch (error) {
  console.log('⚠️ Puppeteer não está instalado. Testando manualmente...\n');
  
  console.log('🔍 Para identificar o erro SYS_001:');
  console.log('1. Abra http://localhost:3000 no navegador');
  console.log('2. Abra o Console do Desenvolvedor (F12)');
  console.log('3. Procure por erros que contenham "SYS_001"');
  console.log('4. Verifique a aba Network para falhas de requisição');
  console.log('5. Tente fazer login ou navegar pela aplicação');
  console.log('\n📋 Possíveis causas do SYS_001:');
  console.log('- Erro de conexão com Firebase');
  console.log('- Problema de autenticação');
  console.log('- Falha na inicialização do app');
  console.log('- Erro de configuração');
}