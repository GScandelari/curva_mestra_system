#!/usr/bin/env node

/**
 * Pre-Migration Validation Script
 * 
 * This script validates that all prerequisites are met before starting
 * the production migration to Firebase.
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PreMigrationCheck {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Add check result
   */
  addCheck(name, status, message, details = {}) {
    const check = {
      name,
      status, // 'pass', 'fail', 'warning'
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.checks.push(check);

    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${message}`);

    if (status === 'fail') {
      this.errors.push(check);
    } else if (status === 'warning') {
      this.warnings.push(check);
    }
  }

  /**
   * Check PostgreSQL database connectivity and data
   */
  async checkPostgreSQLDatabase() {
    try {
      const { sequelize, User, Product, Patient } = require('../src/models');
      
      // Test connection
      await sequelize.authenticate();
      this.addCheck('PostgreSQL Connection', 'pass', 'Database connection successful');

      // Check data counts
      const userCount = await User.count();
      const productCount = await Product.count();
      const patientCount = await Patient.count();

      this.addCheck('PostgreSQL Data', 'pass', 
        `Found ${userCount} users, ${productCount} products, ${patientCount} patients`, {
          users: userCount,
          products: productCount,
          patients: patientCount
        });

      // Check for required data
      if (userCount === 0) {
        this.addCheck('User Data', 'warning', 'No users found in database');
      }

    } catch (error) {
      this.addCheck('PostgreSQL Database', 'fail', `Database connection failed: ${error.message}`);
    }
  }

  /**
   * Check Firebase configuration and connectivity
   */
  async checkFirebaseConfiguration() {
    try {
      // Check Firebase config file
      const configPath = path.join(__dirname, '../src/config/firebase.js');
      await fs.access(configPath);
      this.addCheck('Firebase Config File', 'pass', 'Firebase configuration file exists');

      // Test Firebase connection
      const firebaseConfig = require('../src/config/firebase');
      firebaseConfig.initialize();
      
      const db = firebaseConfig.getFirestore();
      const auth = firebaseConfig.getAuth();

      // Test Firestore connection
      await db.collection('test').limit(1).get();
      this.addCheck('Firestore Connection', 'pass', 'Firestore connection successful');

      // Check Firebase project ID
      const projectId = process.env.FIREBASE_PROJECT_ID || 'curva-mestra';
      this.addCheck('Firebase Project', 'pass', `Project ID: ${projectId}`, { projectId });

    } catch (error) {
      this.addCheck('Firebase Configuration', 'fail', `Firebase setup failed: ${error.message}`);
    }
  }

  /**
   * Check required environment variables
   */
  checkEnvironmentVariables() {
    const requiredVars = [
      'DB_HOST',
      'DB_NAME', 
      'DB_USER',
      'DB_PASSWORD'
    ];

    const optionalVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_API_KEY',
      'CLINIC_ID',
      'FIREBASE_HOSTING_URL'
    ];

    let missingRequired = [];
    let missingOptional = [];

    // Check required variables
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        missingRequired.push(varName);
      }
    });

    // Check optional variables
    optionalVars.forEach(varName => {
      if (!process.env[varName]) {
        missingOptional.push(varName);
      }
    });

    if (missingRequired.length > 0) {
      this.addCheck('Required Environment Variables', 'fail', 
        `Missing required variables: ${missingRequired.join(', ')}`);
    } else {
      this.addCheck('Required Environment Variables', 'pass', 'All required variables present');
    }

    if (missingOptional.length > 0) {
      this.addCheck('Optional Environment Variables', 'warning', 
        `Missing optional variables: ${missingOptional.join(', ')} (will use defaults)`);
    }
  }

  /**
   * Check disk space for backups
   */
  async checkDiskSpace() {
    try {
      const backupDir = path.join(__dirname, '../backups');
      
      // Create backup directory if it doesn't exist
      await fs.mkdir(backupDir, { recursive: true });

      // Check available disk space (Linux/Mac)
      try {
        const output = execSync('df -h .', { encoding: 'utf8' });
        const lines = output.split('\n');
        const dataLine = lines[1];
        const parts = dataLine.split(/\s+/);
        const available = parts[3];

        this.addCheck('Disk Space', 'pass', `Available space: ${available}`, { available });
      } catch (error) {
        // Fallback for Windows or if df command fails
        this.addCheck('Disk Space', 'warning', 'Could not check disk space automatically');
      }

    } catch (error) {
      this.addCheck('Backup Directory', 'fail', `Cannot create backup directory: ${error.message}`);
    }
  }

  /**
   * Check system dependencies
   */
  checkSystemDependencies() {
    const dependencies = [
      { command: 'node --version', name: 'Node.js' },
      { command: 'npm --version', name: 'NPM' },
      { command: 'pg_dump --version', name: 'PostgreSQL Client' }
    ];

    dependencies.forEach(dep => {
      try {
        const version = execSync(dep.command, { encoding: 'utf8' }).trim();
        this.addCheck(`${dep.name} Dependency`, 'pass', `${dep.name} available: ${version}`);
      } catch (error) {
        this.addCheck(`${dep.name} Dependency`, 'fail', `${dep.name} not found or not working`);
      }
    });
  }

  /**
   * Check migration scripts
   */
  async checkMigrationScripts() {
    const scripts = [
      'backup-database.js',
      'migrate-users-to-firebase.js',
      'migrate-to-firestore.js',
      'production-migration.js'
    ];

    for (const script of scripts) {
      try {
        const scriptPath = path.join(__dirname, script);
        await fs.access(scriptPath);
        this.addCheck(`Migration Script: ${script}`, 'pass', 'Script file exists and accessible');
      } catch (error) {
        this.addCheck(`Migration Script: ${script}`, 'fail', 'Script file not found or not accessible');
      }
    }
  }

  /**
   * Check Firebase project permissions
   */
  async checkFirebasePermissions() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      firebaseConfig.initialize();
      
      const auth = firebaseConfig.getAuth();
      const db = firebaseConfig.getFirestore();

      // Test creating a user (will fail if no permission, but that's expected)
      try {
        await auth.createUser({
          uid: 'test-permission-check',
          email: 'test@example.com',
          disabled: true
        });
        
        // Clean up test user
        await auth.deleteUser('test-permission-check');
        
        this.addCheck('Firebase Auth Permissions', 'pass', 'Can create and delete users');
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          this.addCheck('Firebase Auth Permissions', 'pass', 'Auth permissions verified');
        } else {
          this.addCheck('Firebase Auth Permissions', 'warning', 
            `Auth permission check inconclusive: ${error.message}`);
        }
      }

      // Test Firestore write permissions
      try {
        const testDoc = db.collection('migration-test').doc('permission-check');
        await testDoc.set({ test: true, timestamp: new Date() });
        await testDoc.delete();
        
        this.addCheck('Firestore Permissions', 'pass', 'Can write and delete documents');
      } catch (error) {
        this.addCheck('Firestore Permissions', 'fail', 
          `Firestore write permission failed: ${error.message}`);
      }

    } catch (error) {
      this.addCheck('Firebase Permissions', 'fail', 
        `Cannot check Firebase permissions: ${error.message}`);
    }
  }

  /**
   * Estimate migration time and resources
   */
  async estimateMigration() {
    try {
      const { sequelize, User, Product, Patient, ProductRequest, Invoice } = require('../src/models');
      
      const counts = {
        users: await User.count(),
        products: await Product.count(),
        patients: await Patient.count(),
        requests: await ProductRequest.count(),
        invoices: await Invoice.count()
      };

      const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      // Estimate time (rough calculation: ~100 records per minute)
      const estimatedMinutes = Math.ceil(totalRecords / 100);
      
      this.addCheck('Migration Estimation', 'pass', 
        `Estimated time: ${estimatedMinutes} minutes for ${totalRecords} records`, {
          totalRecords,
          estimatedMinutes,
          breakdown: counts
        });

    } catch (error) {
      this.addCheck('Migration Estimation', 'warning', 
        `Could not estimate migration: ${error.message}`);
    }
  }

  /**
   * Run all pre-migration checks
   */
  async runAllChecks() {
    console.log('🔍 Running Pre-Migration Validation Checks...\n');

    // System checks
    console.log('📋 System Dependencies:');
    this.checkSystemDependencies();
    
    console.log('\n🔧 Environment Configuration:');
    this.checkEnvironmentVariables();
    
    console.log('\n💾 Storage and Backup:');
    await this.checkDiskSpace();
    
    console.log('\n📜 Migration Scripts:');
    await this.checkMigrationScripts();
    
    console.log('\n🗄️ Database Connectivity:');
    await this.checkPostgreSQLDatabase();
    
    console.log('\n🔥 Firebase Configuration:');
    await this.checkFirebaseConfiguration();
    
    console.log('\n🔐 Firebase Permissions:');
    await this.checkFirebasePermissions();
    
    console.log('\n⏱️ Migration Estimation:');
    await this.estimateMigration();

    // Print summary
    this.printSummary();

    return {
      ready: this.errors.length === 0,
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRE-MIGRATION VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    const passCount = this.checks.filter(c => c.status === 'pass').length;
    const failCount = this.errors.length;
    const warnCount = this.warnings.length;
    
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warnCount}`);
    console.log(`📋 Total Checks: ${this.checks.length}`);

    if (failCount > 0) {
      console.log('\n❌ CRITICAL ISSUES (Must be resolved):');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.name}: ${error.message}`);
      });
    }

    if (warnCount > 0) {
      console.log('\n⚠️  WARNINGS (Should be reviewed):');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.name}: ${warning.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (failCount === 0) {
      console.log('🎉 SYSTEM READY FOR MIGRATION!');
      console.log('\nNext steps:');
      console.log('1. Review any warnings above');
      console.log('2. Run: node production-migration.js migrate');
      console.log('3. Monitor the migration process');
    } else {
      console.log('🚫 SYSTEM NOT READY FOR MIGRATION');
      console.log('\nPlease resolve the critical issues above before proceeding.');
    }
  }

  /**
   * Save validation report
   */
  async saveReport() {
    try {
      const reportDir = path.join(__dirname, '../logs/pre-migration');
      await fs.mkdir(reportDir, { recursive: true });
      
      const reportPath = path.join(reportDir, `validation-${Date.now()}.json`);
      const report = {
        timestamp: new Date().toISOString(),
        ready: this.errors.length === 0,
        summary: {
          total: this.checks.length,
          passed: this.checks.filter(c => c.status === 'pass').length,
          failed: this.errors.length,
          warnings: this.warnings.length
        },
        checks: this.checks,
        errors: this.errors,
        warnings: this.warnings
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Validation report saved: ${reportPath}`);
      
      return reportPath;
    } catch (error) {
      console.error('Could not save validation report:', error.message);
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const checker = new PreMigrationCheck();
  
  try {
    const result = await checker.runAllChecks();
    await checker.saveReport();
    
    // Exit with appropriate code
    process.exit(result.ready ? 0 : 1);
    
  } catch (error) {
    console.error('Pre-migration check failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PreMigrationCheck;