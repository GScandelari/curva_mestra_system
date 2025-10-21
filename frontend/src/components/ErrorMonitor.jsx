
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
