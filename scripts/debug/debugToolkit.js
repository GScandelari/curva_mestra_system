#!/usr/bin/env node

/**
 * Kit de Ferramentas de Debug para Desenvolvedores
 * Fornece utilitários de diagnóstico e debug para a plataforma
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DebugToolkit {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/debug.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  // Diagnóstico de Sistema
  async systemDiagnostic() {
    this.log('=== DIAGNÓSTICO DE SISTEMA ===', 'INFO');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Verificar arquivos críticos
    const criticalFiles = [
      '.env',
      'package.json',
      'firebase.json',
      'frontend/package.json',
      'backend/package.json'
    ];

    diagnostics.files = {};
    criticalFiles.forEach(file => {
      diagnostics.files[file] = fs.existsSync(file) ? 'EXISTS' : 'MISSING';
    });

    // Verificar processos Node.js
    try {
      const processes = execSync('ps aux | grep node', { encoding: 'utf8' });
      diagnostics.nodeProcesses = processes.split('\n').filter(line => 
        line.includes('node') && !line.includes('grep')
      ).length;
    } catch (error) {
      diagnostics.nodeProcesses = 'ERROR: ' + error.message;
    }

    this.log(JSON.stringify(diagnostics, null, 2));
    return diagnostics;
  }

  // Debug de Configuração Firebase
  async debugFirebaseConfig() {
    this.log('=== DEBUG FIREBASE CONFIG ===', 'INFO');
    
    const config = {};
    
    // Verificar variáveis de ambiente Firebase
    const firebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ];

    config.environment = {};
    firebaseVars.forEach(varName => {
      const value = process.env[varName];
      config.environment[varName] = value ? 
        (value.length > 10 ? value.substring(0, 10) + '...' : value) : 
        'NOT_SET';
    });

    // Verificar arquivo de configuração
    const configFiles = [
      'frontend/src/config/firebase.js',
      'backend/src/config/firebase.js',
      'functions/src/config/firebase.js'
    ];

    config.configFiles = {};
    configFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        config.configFiles[file] = {
          exists: true,
          size: content.length,
          hasApiKey: content.includes('apiKey'),
          hasProjectId: content.includes('projectId')
        };
      } else {
        config.configFiles[file] = { exists: false };
      }
    });

    this.log(JSON.stringify(config, null, 2));
    return config;
  }

  // Debug de Conectividade
  async debugConnectivity() {
    this.log('=== DEBUG CONECTIVIDADE ===', 'INFO');
    
    const connectivity = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Teste de conectividade básica
    const hosts = [
      'google.com',
      'firebase.googleapis.com',
      'firestore.googleapis.com',
      'identitytoolkit.googleapis.com'
    ];

    for (const host of hosts) {
      try {
        execSync(`ping -c 1 ${host}`, { timeout: 5000 });
        connectivity.tests[host] = 'SUCCESS';
      } catch (error) {
        connectivity.tests[host] = 'FAILED';
      }
    }

    // Teste de portas locais
    const ports = [3000, 5000, 8080, 9099];
    connectivity.localPorts = {};
    
    ports.forEach(port => {
      try {
        execSync(`netstat -an | grep :${port}`, { timeout: 2000 });
        connectivity.localPorts[port] = 'IN_USE';
      } catch (error) {
        connectivity.localPorts[port] = 'AVAILABLE';
      }
    });

    this.log(JSON.stringify(connectivity, null, 2));
    return connectivity;
  }

  // Debug de Dependências
  async debugDependencies() {
    this.log('=== DEBUG DEPENDÊNCIAS ===', 'INFO');
    
    const deps = {
      timestamp: new Date().toISOString(),
      npm: {},
      packages: {}
    };

    // Verificar versão do npm
    try {
      deps.npm.version = execSync('npm --version', { encoding: 'utf8' }).trim();
      deps.npm.status = 'OK';
    } catch (error) {
      deps.npm.status = 'ERROR';
      deps.npm.error = error.message;
    }

    // Verificar node_modules
    const nodeModulesPaths = [
      'node_modules',
      'frontend/node_modules',
      'backend/node_modules',
      'functions/node_modules'
    ];

    deps.nodeModules = {};
    nodeModulesPaths.forEach(modulePath => {
      if (fs.existsSync(modulePath)) {
        const moduleCount = fs.readdirSync(modulePath).length;
        deps.nodeModules[modulePath] = {
          exists: true,
          moduleCount: moduleCount
        };
      } else {
        deps.nodeModules[modulePath] = { exists: false };
      }
    });

    // Verificar dependências críticas
    const criticalDeps = ['react', 'firebase', 'express'];
    deps.critical = {};
    
    criticalDeps.forEach(dep => {
      try {
        const version = execSync(`npm list ${dep} --depth=0`, { encoding: 'utf8' });
        deps.critical[dep] = 'INSTALLED';
      } catch (error) {
        deps.critical[dep] = 'MISSING';
      }
    });

    this.log(JSON.stringify(deps, null, 2));
    return deps;
  }

  // Debug de Logs
  async debugLogs() {
    this.log('=== DEBUG LOGS ===', 'INFO');
    
    const logs = {
      timestamp: new Date().toISOString(),
      files: {}
    };

    const logPaths = [
      'backend/logs/app.log',
      'backend/logs/error.log',
      'frontend/logs/debug.log',
      'functions/logs/functions.log'
    ];

    logPaths.forEach(logPath => {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        
        logs.files[logPath] = {
          exists: true,
          size: stats.size,
          modified: stats.mtime,
          lineCount: lines.length,
          recentErrors: lines.filter(line => 
            line.includes('ERROR') || line.includes('CRITICAL')
          ).slice(-5)
        };
      } else {
        logs.files[logPath] = { exists: false };
      }
    });

    this.log(JSON.stringify(logs, null, 2));
    return logs;
  }

  // Executar todos os diagnósticos
  async runFullDiagnostic() {
    this.log('=== DIAGNÓSTICO COMPLETO INICIADO ===', 'INFO');
    
    const results = {
      timestamp: new Date().toISOString(),
      system: await this.systemDiagnostic(),
      firebase: await this.debugFirebaseConfig(),
      connectivity: await this.debugConnectivity(),
      dependencies: await this.debugDependencies(),
      logs: await this.debugLogs()
    };

    // Salvar resultado completo
    const resultFile = path.join(__dirname, '../logs/full-diagnostic.json');
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
    
    this.log(`Diagnóstico completo salvo em: ${resultFile}`, 'INFO');
    this.log('=== DIAGNÓSTICO COMPLETO FINALIZADO ===', 'INFO');
    
    return results;
  }

  // Gerar relatório de debug
  generateDebugReport(diagnosticResults) {
    const report = [];
    
    report.push('# Relatório de Debug');
    report.push(`Gerado em: ${new Date().toISOString()}`);
    report.push('');
    
    // Resumo do sistema
    report.push('## Sistema');
    report.push(`- Node.js: ${diagnosticResults.system.nodeVersion}`);
    report.push(`- Plataforma: ${diagnosticResults.system.platform}`);
    report.push(`- Ambiente: ${diagnosticResults.system.environment}`);
    report.push(`- Uptime: ${Math.floor(diagnosticResults.system.uptime / 60)} minutos`);
    report.push('');
    
    // Status dos arquivos críticos
    report.push('## Arquivos Críticos');
    Object.entries(diagnosticResults.system.files).forEach(([file, status]) => {
      const icon = status === 'EXISTS' ? '✅' : '❌';
      report.push(`- ${icon} ${file}: ${status}`);
    });
    report.push('');
    
    // Configuração Firebase
    report.push('## Configuração Firebase');
    Object.entries(diagnosticResults.firebase.environment).forEach(([key, value]) => {
      const icon = value !== 'NOT_SET' ? '✅' : '❌';
      report.push(`- ${icon} ${key}: ${value}`);
    });
    report.push('');
    
    // Conectividade
    report.push('## Conectividade');
    Object.entries(diagnosticResults.connectivity.tests).forEach(([host, status]) => {
      const icon = status === 'SUCCESS' ? '✅' : '❌';
      report.push(`- ${icon} ${host}: ${status}`);
    });
    
    return report.join('\n');
  }
}

// CLI Interface
if (require.main === module) {
  const toolkit = new DebugToolkit();
  const command = process.argv[2];
  
  switch (command) {
    case 'system':
      toolkit.systemDiagnostic();
      break;
    case 'firebase':
      toolkit.debugFirebaseConfig();
      break;
    case 'connectivity':
      toolkit.debugConnectivity();
      break;
    case 'dependencies':
      toolkit.debugDependencies();
      break;
    case 'logs':
      toolkit.debugLogs();
      break;
    case 'full':
    default:
      toolkit.runFullDiagnostic().then(results => {
        const report = toolkit.generateDebugReport(results);
        console.log('\n' + report);
      });
      break;
  }
}

module.exports = DebugToolkit;