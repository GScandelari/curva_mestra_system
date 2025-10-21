#!/usr/bin/env node

/**
 * Fix SYS_001 Error
 * 
 * This script applies patches to improve error handling and debugging
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Aplicando correções para erro SYS_001...\n');

// Patch 1: Add better error logging to errorHandler
function patchErrorHandler() {
  console.log('1️⃣ Melhorando tratamento de erros...');
  
  const errorHandlerPath = path.join(__dirname, '../frontend/src/utils/errorHandler.js');
  
  if (!fs.existsSync(errorHandlerPath)) {
    console.log('❌ Arquivo errorHandler.js não encontrado');
    return;
  }

  let content = fs.readFileSync(errorHandlerPath, 'utf8');
  
  // Add debug logging to parseApiError function
  const debugCode = `
// Enhanced debug logging for SYS_001 errors
const debugApiError = (error, context = {}) => {
  console.group('🔍 API Error Debug');
  console.log('Error object:', error);
  console.log('Error response:', error?.response);
  console.log('Error status:', error?.response?.status);
  console.log('Error data:', error?.response?.data);
  console.log('Context:', context);
  console.groupEnd();
  
  // Log to localStorage for persistence
  try {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      },
      context,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
    
    const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
    existingLogs.push(errorLog);
    
    // Keep only last 10 errors
    if (existingLogs.length > 10) {
      existingLogs.splice(0, existingLogs.length - 10);
    }
    
    localStorage.setItem('errorLogs', JSON.stringify(existingLogs));
  } catch (e) {
    console.warn('Could not save error log:', e);
  }
};

`;

  // Insert debug code before parseApiError function
  const parseApiErrorIndex = content.indexOf('export const parseApiError = (error) => {');
  if (parseApiErrorIndex !== -1) {
    content = content.slice(0, parseApiErrorIndex) + debugCode + content.slice(parseApiErrorIndex);
    
    // Add debug call to parseApiError
    content = content.replace(
      'export const parseApiError = (error) => {',
      `export const parseApiError = (error) => {
  // Debug logging
  debugApiError(error, { function: 'parseApiError' });`
    );
    
    fs.writeFileSync(errorHandlerPath, content);
    console.log('✅ ErrorHandler atualizado com debug logging');
  } else {
    console.log('❌ Não foi possível encontrar função parseApiError');
  }
}

// Patch 2: Add error boundary to main App
function patchAppWithErrorBoundary() {
  console.log('2️⃣ Adicionando Error Boundary...');
  
  const appPath = path.join(__dirname, '../frontend/src/App.jsx');
  
  if (!fs.existsSync(appPath)) {
    console.log('❌ Arquivo App.jsx não encontrado');
    return;
  }

  let content = fs.readFileSync(appPath, 'utf8');
  
  // Check if ErrorBoundary already exists
  if (content.includes('ErrorBoundary')) {
    console.log('✅ ErrorBoundary já existe no App.jsx');
    return;
  }

  // Add ErrorBoundary import
  const importIndex = content.indexOf("import React");
  if (importIndex !== -1) {
    const errorBoundaryImport = `import React, { Component } from 'react';\n\n// Error Boundary Component\nclass ErrorBoundary extends Component {\n  constructor(props) {\n    super(props);\n    this.state = { hasError: false, error: null };\n  }\n\n  static getDerivedStateFromError(error) {\n    return { hasError: true, error };\n  }\n\n  componentDidCatch(error, errorInfo) {\n    console.error('🚨 Error Boundary caught error:', error, errorInfo);\n    \n    // Log to localStorage\n    try {\n      const errorLog = {\n        timestamp: new Date().toISOString(),\n        error: error.message,\n        stack: error.stack,\n        componentStack: errorInfo.componentStack,\n        type: 'ErrorBoundary'\n      };\n      \n      const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');\n      existingLogs.push(errorLog);\n      localStorage.setItem('errorLogs', JSON.stringify(existingLogs));\n    } catch (e) {\n      console.warn('Could not save error boundary log:', e);\n    }\n  }\n\n  render() {\n    if (this.state.hasError) {\n      return (\n        <div style={{ padding: '20px', textAlign: 'center' }}>\n          <h2>🚨 Erro na Aplicação</h2>\n          <p>Ocorreu um erro inesperado. Código: SYS_001</p>\n          <p>Horário: {new Date().toLocaleString()}</p>\n          <button onClick={() => window.location.reload()}>Recarregar Página</button>\n          <details style={{ marginTop: '20px', textAlign: 'left' }}>\n            <summary>Detalhes do Erro</summary>\n            <pre>{this.state.error?.stack}</pre>\n          </details>\n        </div>\n      );\n    }\n\n    return this.props.children;\n  }\n}\n\n`;
    
    content = content.replace('import React', errorBoundaryImport.replace('import React, { Component } from \'react\';\n\n', '') + 'import React');
    
    // Wrap App content with ErrorBoundary
    const appFunctionIndex = content.indexOf('function App()');
    if (appFunctionIndex !== -1) {
      const returnIndex = content.indexOf('return (', appFunctionIndex);
      if (returnIndex !== -1) {
        content = content.replace('return (', 'return (\n    <ErrorBoundary>');
        
        // Find the closing of the return statement and add closing ErrorBoundary
        const lastReturnIndex = content.lastIndexOf('  );');
        if (lastReturnIndex !== -1) {
          content = content.slice(0, lastReturnIndex) + '    </ErrorBoundary>\n' + content.slice(lastReturnIndex);
        }
      }
    }
    
    fs.writeFileSync(appPath, content);
    console.log('✅ ErrorBoundary adicionado ao App.jsx');
  }
}

// Patch 3: Add debug console commands
function addDebugConsoleCommands() {
  console.log('3️⃣ Adicionando comandos de debug...');
  
  const debugScript = `
// Debug commands for SYS_001 troubleshooting
window.debugSYS001 = {
  // Show error logs
  showErrorLogs: () => {
    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
    console.table(logs);
    return logs;
  },
  
  // Clear error logs
  clearErrorLogs: () => {
    localStorage.removeItem('errorLogs');
    console.log('✅ Error logs cleared');
  },
  
  // Test Firebase connection
  testFirebase: async () => {
    try {
      const { auth } = await import('./config/firebase.js');
      console.log('✅ Firebase Auth:', auth);
      console.log('✅ Current User:', auth.currentUser);
      return { success: true, auth: auth, user: auth.currentUser };
    } catch (error) {
      console.error('❌ Firebase Error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Test API connection
  testAPI: async () => {
    try {
      const response = await fetch('https://us-central1-curva-mestra.cloudfunctions.net/validateAdminInitialization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} })
      });
      
      const data = await response.json();
      console.log('✅ API Response:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ API Error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Force error for testing
  forceError: () => {
    throw new Error('Test SYS_001 error');
  },
  
  // Show help
  help: () => {
    console.log(\`
🔍 Debug Commands for SYS_001:

debugSYS001.showErrorLogs()    - Show all error logs
debugSYS001.clearErrorLogs()   - Clear error logs
debugSYS001.testFirebase()     - Test Firebase connection
debugSYS001.testAPI()          - Test API connection
debugSYS001.forceError()       - Force an error for testing
debugSYS001.help()             - Show this help

Usage: Open browser console and type any command above.
    \`);
  }
};

// Auto-run help on load
console.log('🔧 SYS_001 Debug tools loaded. Type debugSYS001.help() for commands.');
`;

  const debugPath = path.join(__dirname, '../frontend/public/debug.js');
  fs.writeFileSync(debugPath, debugScript);
  
  // Add script to index.html
  const indexPath = path.join(__dirname, '../frontend/index.html');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    if (!indexContent.includes('debug.js')) {
      indexContent = indexContent.replace(
        '</body>',
        '  <script src="/debug.js"></script>\n  </body>'
      );
      fs.writeFileSync(indexPath, indexContent);
      console.log('✅ Debug script adicionado ao index.html');
    } else {
      console.log('✅ Debug script já existe no index.html');
    }
  }
}

// Patch 4: Create error monitoring component
function createErrorMonitor() {
  console.log('4️⃣ Criando monitor de erros...');
  
  const monitorPath = path.join(__dirname, '../frontend/src/components/ErrorMonitor.jsx');
  
  const monitorContent = `
import React, { useEffect, useState } from 'react';

const ErrorMonitor = () => {
  const [errors, setErrors] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for errors
    const handleError = (event) => {
      const error = {
        timestamp: new Date().toISOString(),
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: 'javascript'
      };
      
      setErrors(prev => [...prev.slice(-9), error]); // Keep last 10 errors
    };

    const handleUnhandledRejection = (event) => {
      const error = {
        timestamp: new Date().toISOString(),
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        type: 'promise'
      };
      
      setErrors(prev => [...prev.slice(-9), error]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Keyboard shortcut to toggle monitor (Ctrl+Shift+E)
    const handleKeyPress = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (!isVisible || errors.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '400px',
      maxHeight: '300px',
      backgroundColor: '#ff4444',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>🚨 Errors Detected ({errors.length})</strong>
        <button 
          onClick={() => setIsVisible(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
      
      {errors.map((error, index) => (
        <div key={index} style={{ marginTop: '10px', padding: '5px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div><strong>{error.type.toUpperCase()}</strong> - {new Date(error.timestamp).toLocaleTimeString()}</div>
          <div>{error.message}</div>
          {error.filename && <div>File: {error.filename}:{error.lineno}:{error.colno}</div>}
        </div>
      ))}
      
      <div style={{ marginTop: '10px', fontSize: '10px', opacity: 0.8 }}>
        Press Ctrl+Shift+E to toggle this monitor
      </div>
    </div>
  );
};

export default ErrorMonitor;
`;

  fs.writeFileSync(monitorPath, monitorContent);
  console.log('✅ ErrorMonitor component criado');
}

// Main execution
function main() {
  try {
    patchErrorHandler();
    patchAppWithErrorBoundary();
    addDebugConsoleCommands();
    createErrorMonitor();
    
    console.log('\n✅ Todas as correções aplicadas com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Reinicie o servidor de desenvolvimento');
    console.log('2. Abra http://localhost:3000 no navegador');
    console.log('3. Abra o Console (F12) e digite: debugSYS001.help()');
    console.log('4. Pressione Ctrl+Shift+E para ver o monitor de erros');
    console.log('5. Reproduza o erro SYS_001 e verifique os logs');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar correções:', error);
  }
}

main();