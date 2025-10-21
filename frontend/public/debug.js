
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
    console.log(`
🔍 Debug Commands for SYS_001:

debugSYS001.showErrorLogs()    - Show all error logs
debugSYS001.clearErrorLogs()   - Clear error logs
debugSYS001.testFirebase()     - Test Firebase connection
debugSYS001.testAPI()          - Test API connection
debugSYS001.forceError()       - Force an error for testing
debugSYS001.help()             - Show this help

Usage: Open browser console and type any command above.
    `);
  }
};

// Auto-run help on load
console.log('🔧 SYS_001 Debug tools loaded. Type debugSYS001.help() for commands.');
