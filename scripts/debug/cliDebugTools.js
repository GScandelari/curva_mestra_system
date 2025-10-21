#!/usr/bin/env node

/**
 * Utilitários de Debug para Linha de Comando
 * Ferramentas CLI para diagnóstico e debug do sistema
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

class CLIDebugTools {
  constructor() {
    this.projectRoot = process.cwd();
    this.logDir = path.join(this.projectRoot, 'scripts/logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // Utilitário para executar comandos com timeout
  execWithTimeout(command, timeout = 10000) {
    try {
      return execSync(command, { 
        timeout, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      return `ERROR: ${error.message}`;
    }
  }

  // Monitor de logs em tempo real
  watchLogs(logFile = 'backend/logs/app.log') {
    console.log(`📊 Monitorando logs: ${logFile}`);
    console.log('Pressione Ctrl+C para parar\n');

    if (!fs.existsSync(logFile)) {
      console.log(`❌ Arquivo de log não encontrado: ${logFile}`);
      return;
    }

    const tail = spawn('tail', ['-f', logFile]);
    
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          this.formatLogLine(line);
        }
      });
    });

    tail.stderr.on('data', (data) => {
      console.error(`Erro no tail: ${data}`);
    });

    process.on('SIGINT', () => {
      tail.kill();
      console.log('\n📊 Monitoramento de logs interrompido');
      process.exit(0);
    });
  }

  formatLogLine(line) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (line.includes('ERROR') || line.includes('CRITICAL')) {
      console.log(`🔴 [${timestamp}] ${line}`);
    } else if (line.includes('WARN')) {
      console.log(`🟡 [${timestamp}] ${line}`);
    } else if (line.includes('INFO')) {
      console.log(`🔵 [${timestamp}] ${line}`);
    } else {
      console.log(`⚪ [${timestamp}] ${line}`);
    }
  }

  // Análise de performance de processos
  analyzeProcessPerformance() {
    console.log('📈 Analisando performance de processos Node.js...\n');

    try {
      // Processos Node.js ativos
      const processes = this.execWithTimeout('ps aux | grep node | grep -v grep');
      console.log('🔍 Processos Node.js ativos:');
      console.log(processes);

      // Uso de memória
      const memory = this.execWithTimeout('free -h');
      console.log('💾 Uso de memória:');
      console.log(memory);

      // Uso de CPU
      const cpu = this.execWithTimeout('top -bn1 | grep "Cpu(s)"');
      console.log('⚡ Uso de CPU:');
      console.log(cpu);

      // Espaço em disco
      const disk = this.execWithTimeout('df -h');
      console.log('💿 Espaço em disco:');
      console.log(disk);

    } catch (error) {
      console.error('❌ Erro ao analisar performance:', error.message);
    }
  }

  // Monitor de rede
  monitorNetwork() {
    console.log('🌐 Monitorando conexões de rede...\n');

    try {
      // Conexões ativas
      const connections = this.execWithTimeout('netstat -tuln | grep LISTEN');
      console.log('🔗 Portas em escuta:');
      console.log(connections);

      // Teste de conectividade
      const hosts = [
        'google.com',
        'firebase.googleapis.com',
        'firestore.googleapis.com'
      ];

      console.log('🏓 Teste de conectividade:');
      hosts.forEach(host => {
        try {
          this.execWithTimeout(`ping -c 1 ${host}`, 5000);
          console.log(`✅ ${host}: OK`);
        } catch (error) {
          console.log(`❌ ${host}: FALHA`);
        }
      });

    } catch (error) {
      console.error('❌ Erro ao monitorar rede:', error.message);
    }
  }

  // Análise de dependências
  analyzeDependencies() {
    console.log('📦 Analisando dependências...\n');

    const packageFiles = [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
      'functions/package.json'
    ];

    packageFiles.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`📄 Analisando ${file}:`);
        
        try {
          const packageJson = JSON.parse(fs.readFileSync(file, 'utf8'));
          
          // Dependências principais
          const deps = Object.keys(packageJson.dependencies || {});
          console.log(`  📚 Dependências (${deps.length}):`, deps.slice(0, 5).join(', '));
          
          // Dependências de desenvolvimento
          const devDeps = Object.keys(packageJson.devDependencies || {});
          console.log(`  🛠️ Dev Dependencies (${devDeps.length}):`, devDeps.slice(0, 5).join(', '));
          
          // Verificar vulnerabilidades
          try {
            const audit = this.execWithTimeout(`npm audit --json`, 15000);
            const auditData = JSON.parse(audit);
            console.log(`  🔒 Vulnerabilidades: ${auditData.metadata?.vulnerabilities?.total || 0}`);
          } catch (auditError) {
            console.log('  🔒 Não foi possível verificar vulnerabilidades');
          }
          
        } catch (error) {
          console.log(`  ❌ Erro ao analisar ${file}:`, error.message);
        }
        
        console.log('');
      }
    });
  }

  // Verificação de saúde do Firebase
  checkFirebaseHealth() {
    console.log('🔥 Verificando saúde do Firebase...\n');

    try {
      // Verificar CLI do Firebase
      const firebaseVersion = this.execWithTimeout('firebase --version');
      console.log('🔧 Firebase CLI:', firebaseVersion.trim());

      // Verificar projeto ativo
      const project = this.execWithTimeout('firebase use');
      console.log('📋 Projeto ativo:', project.trim());

      // Verificar status dos serviços
      console.log('🔍 Testando serviços Firebase...');
      
      // Teste básico de conectividade
      const services = [
        'firestore.googleapis.com',
        'firebase.googleapis.com',
        'identitytoolkit.googleapis.com'
      ];

      services.forEach(service => {
        try {
          this.execWithTimeout(`curl -s -o /dev/null -w "%{http_code}" https://${service}`, 5000);
          console.log(`✅ ${service}: Acessível`);
        } catch (error) {
          console.log(`❌ ${service}: Inacessível`);
        }
      });

    } catch (error) {
      console.error('❌ Erro ao verificar Firebase:', error.message);
    }
  }

  // Limpeza de cache e arquivos temporários
  cleanupSystem() {
    console.log('🧹 Limpando sistema...\n');

    const cleanupTasks = [
      {
        name: 'Cache npm',
        command: 'npm cache clean --force',
        path: null
      },
      {
        name: 'node_modules (root)',
        command: null,
        path: 'node_modules'
      },
      {
        name: 'node_modules (frontend)',
        command: null,
        path: 'frontend/node_modules'
      },
      {
        name: 'node_modules (backend)',
        command: null,
        path: 'backend/node_modules'
      },
      {
        name: 'Logs antigos',
        command: null,
        path: 'scripts/logs'
      },
      {
        name: 'Build artifacts',
        command: null,
        path: 'frontend/dist'
      }
    ];

    cleanupTasks.forEach(task => {
      try {
        if (task.command) {
          console.log(`🔄 ${task.name}...`);
          this.execWithTimeout(task.command);
          console.log(`✅ ${task.name}: Limpo`);
        } else if (task.path && fs.existsSync(task.path)) {
          console.log(`🔄 ${task.name}...`);
          fs.rmSync(task.path, { recursive: true, force: true });
          console.log(`✅ ${task.name}: Removido`);
        } else {
          console.log(`⚪ ${task.name}: Não encontrado`);
        }
      } catch (error) {
        console.log(`❌ ${task.name}: Erro - ${error.message}`);
      }
    });

    console.log('\n🎉 Limpeza concluída!');
  }

  // Menu interativo
  async showInteractiveMenu() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const menu = `
🔧 FERRAMENTAS DE DEBUG CLI

1. 📊 Monitorar logs em tempo real
2. 📈 Analisar performance de processos
3. 🌐 Monitorar rede
4. 📦 Analisar dependências
5. 🔥 Verificar saúde do Firebase
6. 🧹 Limpeza do sistema
7. 🔍 Diagnóstico completo
8. ❌ Sair

Escolha uma opção (1-8): `;

    const choice = await new Promise(resolve => {
      rl.question(menu, resolve);
    });

    rl.close();

    switch (choice.trim()) {
      case '1':
        this.watchLogs();
        break;
      case '2':
        this.analyzeProcessPerformance();
        break;
      case '3':
        this.monitorNetwork();
        break;
      case '4':
        this.analyzeDependencies();
        break;
      case '5':
        this.checkFirebaseHealth();
        break;
      case '6':
        this.cleanupSystem();
        break;
      case '7':
        this.runFullDiagnostic();
        break;
      case '8':
        console.log('👋 Saindo...');
        process.exit(0);
        break;
      default:
        console.log('❌ Opção inválida');
        this.showInteractiveMenu();
    }
  }

  // Diagnóstico completo
  runFullDiagnostic() {
    console.log('🔍 Executando diagnóstico completo...\n');
    
    this.analyzeProcessPerformance();
    console.log('\n' + '='.repeat(50) + '\n');
    
    this.monitorNetwork();
    console.log('\n' + '='.repeat(50) + '\n');
    
    this.analyzeDependencies();
    console.log('\n' + '='.repeat(50) + '\n');
    
    this.checkFirebaseHealth();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✅ Diagnóstico completo finalizado!');
  }
}

// CLI Interface
if (require.main === module) {
  const tools = new CLIDebugTools();
  const command = process.argv[2];

  switch (command) {
    case 'logs':
      tools.watchLogs(process.argv[3]);
      break;
    case 'performance':
      tools.analyzeProcessPerformance();
      break;
    case 'network':
      tools.monitorNetwork();
      break;
    case 'deps':
      tools.analyzeDependencies();
      break;
    case 'firebase':
      tools.checkFirebaseHealth();
      break;
    case 'cleanup':
      tools.cleanupSystem();
      break;
    case 'diagnostic':
      tools.runFullDiagnostic();
      break;
    case 'menu':
    default:
      tools.showInteractiveMenu();
      break;
  }
}

module.exports = CLIDebugTools;