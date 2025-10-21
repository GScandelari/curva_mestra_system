# 🚀 System Deployment Guide

This guide covers how to deploy and publish the Admin System Organization components.

## 📋 Pre-Deployment Checklist

### 1. Environment Validation
```bash
# Validate your environment
cd scripts
node validateEnvironment.js --verbose

# Check all dependencies are installed
npm run install:all
```

### 2. Run Tests
```bash
# Run comprehensive test suite
cd scripts
npm run test:all

# Verify all components work
npm test
```

### 3. Configuration Setup
```bash
# Review system configuration
cd scripts
node systemOrchestrator.js config --show

# Set up environment-specific configs
cp .kiro/config/development.json .kiro/config/production.json
# Edit production.json with your production settings
```

## 🔧 System Configuration

### Required Environment Variables
```bash
# Firebase Configuration
export FIREBASE_PROJECT_ID="curva-mestra"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Git Configuration (if not already set)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Optional: Encryption key for sensitive data
export CONFIG_ENCRYPTION_KEY="your-32-character-encryption-key"
```

### Firebase Setup
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Set the project
firebase use curva-mestra
```

## 🚀 Deployment Steps

### Option 1: Complete System Setup (Recommended)
```bash
# Navigate to scripts directory
cd scripts

# Run complete system setup with interactive mode
node systemOrchestrator.js setup --interactive --verbose

# Or run in dry-run mode first to preview changes
node systemOrchestrator.js setup --dry-run --verbose
```

### Option 2: Step-by-Step Deployment
```bash
cd scripts

# 1. Initialize admin user
node systemOrchestrator.js admin --verbose

# 2. Organize documentation
node systemOrchestrator.js docs --verbose

# 3. Deploy to Firebase
node systemOrchestrator.js deploy --verbose
```

### Option 3: Individual Components
```bash
# Admin setup only
node systemOrchestrator.js admin

# Documentation organization only  
node systemOrchestrator.js docs

# Deployment only
node systemOrchestrator.js deploy --targets hosting,functions
```

## 📊 Monitoring and Verification

### 1. Check Admin User Setup
```bash
# Verify admin user was initialized
firebase functions:call validateAdminInitialization --project=curva-mestra
```

### 2. Verify Documentation Organization
```bash
# Check that docs directory was created and populated
ls -la docs/
ls -la docs/admin/
ls -la docs/setup/
ls -la docs/deployment/
```

### 3. Verify Deployment
```bash
# Check Firebase hosting
firebase hosting:sites:list --project=curva-mestra

# Check Firebase functions
firebase functions:list --project=curva-mestra

# Check Firestore rules
firebase firestore:rules:list --project=curva-mestra
```

## 🔄 Rollback Procedures

### Automatic Rollback
The system includes automatic rollback capabilities:
- Git changes are automatically reverted on deployment failure
- Firebase hosting can be rolled back to previous releases
- Configuration backups are created before major changes

### Manual Rollback
```bash
# Rollback Git changes
git log --oneline -10  # Find the commit to rollback to
git reset --hard <commit-hash>

# Rollback Firebase hosting
firebase hosting:releases:list --project=curva-mestra
firebase hosting:releases:rollback <release-id> --project=curva-mestra

# Restore configuration from backup
cp backup-docs-<timestamp>/.kiro/system-config.json .kiro/system-config.json
```

## 📝 Post-Deployment Tasks

### 1. Update Documentation
- Review generated documentation in `docs/` directory
- Update any project-specific documentation
- Commit documentation changes to Git

### 2. Verify System Health
```bash
# Run environment validation again
cd scripts
node validateEnvironment.js --environment production

# Test admin functions
firebase functions:call initializeDefaultAdmin --project=curva-mestra
```

### 3. Set Up Monitoring
- Configure Firebase monitoring and alerts
- Set up log aggregation for system orchestrator logs
- Configure notification handlers for deployment failures

## 🔐 Security Considerations

### 1. Credential Management
- Store service account keys securely
- Use environment variables for sensitive configuration
- Enable encryption for sensitive config data:
  ```bash
  export CONFIG_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  ```

### 2. Access Control
- Verify admin user has correct permissions
- Review Firebase security rules
- Audit user access and roles

### 3. Backup Strategy
- System automatically creates backups before major operations
- Store backups in secure, versioned storage
- Test backup restoration procedures

## 🚨 Troubleshooting

### Common Issues

#### Firebase CLI Not Authenticated
```bash
firebase login
firebase projects:list  # Verify access to curva-mestra
```

#### Git Configuration Missing
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Node.js Version Issues
```bash
# Check Node.js version (requires v16+)
node --version

# Update if necessary
nvm install 18
nvm use 18
```

#### Missing Dependencies
```bash
# Install all dependencies
npm run install:all

# Or install individually
cd scripts && npm install
cd ../functions && npm install
cd ../frontend && npm install
cd ../backend && npm install
```

### Getting Help
- Check system logs: `logs/system-orchestrator.log`
- Run environment validation: `node validateEnvironment.js --verbose`
- Review configuration: `node systemOrchestrator.js config --show`

## 📈 Performance Optimization

### 1. Build Optimization
- Enable production builds: `NODE_ENV=production npm run build`
- Optimize Firebase function cold starts
- Configure CDN for static assets

### 2. Monitoring
- Set up Firebase Performance Monitoring
- Configure log aggregation and analysis
- Monitor deployment success rates

### 3. Scaling
- Configure Firebase function scaling limits
- Set up load balancing for high traffic
- Implement caching strategies

## 🔄 Maintenance

### Regular Tasks
- Update dependencies monthly
- Review and rotate encryption keys quarterly
- Audit user permissions and access logs
- Test backup and recovery procedures

### Updates and Patches
```bash
# Update system components
npm update

# Test after updates
npm run test:all

# Deploy updates
node systemOrchestrator.js setup --verbose
```

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review system logs in `logs/` directory
3. Run environment validation for diagnostic information
4. Check Firebase console for deployment status

The system is designed to be self-healing and provides detailed error messages to help diagnose and resolve issues quickly.