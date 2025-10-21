// Firebase Hosting configuration helper
// This file contains configuration for custom domains and advanced hosting features

const hostingConfig = {
  // Custom domain configuration
  customDomain: {
    production: 'app.curvamestra.com.br', // Replace with actual domain
    staging: 'staging.curvamestra.com.br'  // Replace with actual staging domain
  },
  
  // Security headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  },
  
  // Cache configuration
  cacheConfig: {
    // Static assets - long cache
    staticAssets: {
      pattern: '/assets/**',
      maxAge: 31536000, // 1 year
      immutable: true
    },
    
    // Images - medium cache
    images: {
      pattern: '**/*.@(jpg|jpeg|gif|png|svg|webp|ico)',
      maxAge: 86400 // 1 day
    },
    
    // HTML files - no cache
    html: {
      pattern: '/index.html',
      maxAge: 0,
      mustRevalidate: true
    },
    
    // Service worker - no cache
    serviceWorker: {
      pattern: '/sw.js',
      maxAge: 0
    }
  },
  
  // Redirects for legacy URLs
  redirects: [
    {
      source: '/login',
      destination: '/auth/login',
      type: 301
    },
    {
      source: '/register',
      destination: '/auth/register',
      type: 301
    },
    {
      source: '/dashboard',
      destination: '/',
      type: 302
    }
  ],
  
  // Rewrites for API calls
  rewrites: [
    {
      source: '/api/**',
      function: 'api'
    },
    {
      source: '**',
      destination: '/index.html'
    }
  ]
};

module.exports = hostingConfig;