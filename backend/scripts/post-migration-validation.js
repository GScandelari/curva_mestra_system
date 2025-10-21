#!/usr/bin/env node

/**
 * Post-Migration Validation Script
 * 
 * This script validates that the Firebase migration was successful
 * and all systems are working correctly.
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

class PostMigrationValidation {
  constructor() {
    this.clinicId = process.env.CLINIC_ID || 'default-clinic';
    this.validations = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Add validation result
   */
  addValidation(name, status, message, details = {}) {
    const validation = {
      name,
      status, // 'pass', 'fail', 'warning'
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.validations.push(validation);

    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${message}`);

    if (status === 'fail') {
      this.errors.push(validation);
    } else if (status === 'warning') {
      this.warnings.push(validation);
    }
  }

  /**
   * Validate Firebase Auth users
   */
  async validateFirebaseAuth() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      firebaseConfig.initialize();
      const auth = firebaseConfig.getAuth();

      // Get PostgreSQL user count for comparison
      const { User } = require('../src/models');
      const pgUserCount = await User.count({ where: { isActive: true } });

      // List Firebase users (limited sample)
      const listUsersResult = await auth.listUsers(1000);
      const firebaseUserCount = listUsersResult.users.length;

      if (firebaseUserCount === pgUserCount) {
        this.addValidation('Firebase Auth Users', 'pass', 
          `All ${firebaseUserCount} users migrated successfully`);
      } else {
        this.addValidation('Firebase Auth Users', 'fail', 
          `User count mismatch: PostgreSQL=${pgUserCount}, Firebase=${firebaseUserCount}`);
      }

      // Validate custom claims on sample users
      const sampleUsers = listUsersResult.users.slice(0, 5);
      let validClaimsCount = 0;

      for (const user of sampleUsers) {
        try {
          const customClaims = user.customClaims || {};
          if (customClaims.role && customClaims.clinicId) {
            validClaimsCount++;
          }
        } catch (error) {
          console.log(`Warning: Could not check claims for user ${user.uid}`);
        }
      }

      if (validClaimsCount === sampleUsers.length) {
        this.addValidation('Firebase Custom Claims', 'pass', 
          `Custom claims validated on ${validClaimsCount} sample users`);
      } else {
        this.addValidation('Firebase Custom Claims', 'warning', 
          `Custom claims issues on ${sampleUsers.length - validClaimsCount} users`);
      }

    } catch (error) {
      this.addValidation('Firebase Auth Validation', 'fail', 
        `Auth validation failed: ${error.message}`);
    }
  }

  /**
   * Validate Firestore data
   */
  async validateFirestoreData() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      const db = firebaseConfig.getFirestore();

      // Get PostgreSQL counts
      const { User, Product, Patient, ProductRequest, Invoice } = require('../src/models');
      const pgCounts = {
        users: await User.count(),
        products: await Product.count(),
        patients: await Patient.count(),
        requests: await ProductRequest.count(),
        invoices: await Invoice.count()
      };

      // Get Firestore counts
      const collections = ['users', 'products', 'patients', 'requests', 'invoices'];
      const fsCounts = {};

      for (const collection of collections) {
        const snapshot = await db.collection(`clinics/${this.clinicId}/${collection}`).get();
        fsCounts[collection] = snapshot.size;
      }

      // Compare counts
      let allValid = true;
      const mismatches = [];

      for (const [key, pgCount] of Object.entries(pgCounts)) {
        const fsCount = fsCounts[key] || 0;
        if (pgCount !== fsCount) {
          allValid = false;
          mismatches.push({ collection: key, postgresql: pgCount, firestore: fsCount });
        }
      }

      if (allValid) {
        const totalRecords = Object.values(pgCounts).reduce((sum, count) => sum + count, 0);
        this.addValidation('Firestore Data Integrity', 'pass', 
          `All ${totalRecords} records migrated correctly`, { counts: fsCounts });
      } else {
        this.addValidation('Firestore Data Integrity', 'fail', 
          `Data count mismatches found`, { mismatches });
      }

    } catch (error) {
      this.addValidation('Firestore Data Validation', 'fail', 
        `Data validation failed: ${error.message}`);
    }
  }

  /**
   * Validate Firestore security rules
   */
  async validateFirestoreRules() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      const db = firebaseConfig.getFirestore();

      // Test unauthorized access (should fail)
      try {
        // This should fail due to security rules
        await db.collection('clinics/unauthorized-clinic/products').get();
        this.addValidation('Firestore Security Rules', 'warning', 
          'Security rules may not be properly configured - unauthorized access succeeded');
      } catch (error) {
        if (error.code === 'permission-denied') {
          this.addValidation('Firestore Security Rules', 'pass', 
            'Security rules are working - unauthorized access denied');
        } else {
          this.addValidation('Firestore Security Rules', 'warning', 
            `Unexpected error testing security rules: ${error.message}`);
        }
      }

    } catch (error) {
      this.addValidation('Firestore Security Rules', 'fail', 
        `Security rules validation failed: ${error.message}`);
    }
  }

  /**
   * Validate Firebase Functions
   */
  async validateFirebaseFunctions() {
    try {
      // Check if functions are deployed (this would need to be adapted based on actual deployment)
      this.addValidation('Firebase Functions', 'warning', 
        'Functions validation requires manual testing - check Firebase Console');

    } catch (error) {
      this.addValidation('Firebase Functions', 'fail', 
        `Functions validation failed: ${error.message}`);
    }
  }

  /**
   * Test sample data operations
   */
  async testDataOperations() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      const db = firebaseConfig.getFirestore();

      // Test reading data
      const productsSnapshot = await db
        .collection(`clinics/${this.clinicId}/products`)
        .limit(5)
        .get();

      if (!productsSnapshot.empty) {
        this.addValidation('Data Read Operations', 'pass', 
          `Successfully read ${productsSnapshot.size} sample products`);

        // Test data structure
        const sampleProduct = productsSnapshot.docs[0].data();
        const expectedFields = ['name', 'createdAt', 'currentStock'];
        const hasRequiredFields = expectedFields.every(field => 
          sampleProduct.hasOwnProperty(field));

        if (hasRequiredFields) {
          this.addValidation('Data Structure', 'pass', 
            'Migrated data has correct structure');
        } else {
          this.addValidation('Data Structure', 'warning', 
            'Some expected fields may be missing from migrated data');
        }
      } else {
        this.addValidation('Data Read Operations', 'warning', 
          'No products found - may indicate migration issue');
      }

    } catch (error) {
      this.addValidation('Data Operations Test', 'fail', 
        `Data operations test failed: ${error.message}`);
    }
  }

  /**
   * Validate system performance
   */
  async validatePerformance() {
    try {
      const firebaseConfig = require('../src/config/firebase');
      const db = firebaseConfig.getFirestore();

      // Test query performance
      const startTime = Date.now();
      
      await db
        .collection(`clinics/${this.clinicId}/products`)
        .limit(100)
        .get();
      
      const queryTime = Date.now() - startTime;

      if (queryTime < 1000) {
        this.addValidation('Query Performance', 'pass', 
          `Query completed in ${queryTime}ms`);
      } else if (queryTime < 3000) {
        this.addValidation('Query Performance', 'warning', 
          `Query took ${queryTime}ms - may need optimization`);
      } else {
        this.addValidation('Query Performance', 'fail', 
          `Query took ${queryTime}ms - performance issue detected`);
      }

    } catch (error) {
      this.addValidation('Performance Validation', 'fail', 
        `Performance test failed: ${error.message}`);
    }
  }

  /**
   * Check backup integrity
   */
  async validateBackups() {
    try {
      const backupDir = path.join(__dirname, '../backups');
      const files = await fs.readdir(backupDir);
      
      const recentBackups = files
        .filter(file => file.includes('postgresql-backup'))
        .filter(file => {
          const stats = require('fs').statSync(path.join(backupDir, file));
          const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
          return ageHours < 24; // Backups from last 24 hours
        });

      if (recentBackups.length > 0) {
        this.addValidation('Backup Integrity', 'pass', 
          `Found ${recentBackups.length} recent backup(s)`);
      } else {
        this.addValidation('Backup Integrity', 'warning', 
          'No recent backups found - ensure backup was created');
      }

    } catch (error) {
      this.addValidation('Backup Validation', 'fail', 
        `Backup validation failed: ${error.message}`);
    }
  }

  /**
   * Validate system redirection
   */
  async validateRedirection() {
    try {
      // Check if maintenance page exists
      const maintenancePath = path.join(__dirname, '../../public/maintenance.html');
      await fs.access(maintenancePath);
      
      this.addValidation('System Redirection', 'pass', 
        'Maintenance page created successfully');

      // Check nginx config
      const nginxPath = path.join(__dirname, '../../nginx/sites-available/migration.conf');
      try {
        await fs.access(nginxPath);
        this.addValidation('Nginx Configuration', 'pass', 
          'Migration nginx configuration created');
      } catch (error) {
        this.addValidation('Nginx Configuration', 'warning', 
          'Migration nginx configuration not found');
      }

    } catch (error) {
      this.addValidation('System Redirection', 'fail', 
        `Redirection validation failed: ${error.message}`);
    }
  }

  /**
   * Run all post-migration validations
   */
  async runAllValidations() {
    console.log('🔍 Running Post-Migration Validation...\n');

    console.log('👥 Firebase Authentication:');
    await this.validateFirebaseAuth();

    console.log('\n📊 Firestore Data:');
    await this.validateFirestoreData();

    console.log('\n🔐 Security Rules:');
    await this.validateFirestoreRules();

    console.log('\n⚡ Firebase Functions:');
    await this.validateFirebaseFunctions();

    console.log('\n🧪 Data Operations:');
    await this.testDataOperations();

    console.log('\n⚡ Performance:');
    await this.validatePerformance();

    console.log('\n💾 Backups:');
    await this.validateBackups();

    console.log('\n🔄 System Redirection:');
    await this.validateRedirection();

    // Print summary
    this.printSummary();

    return {
      success: this.errors.length === 0,
      validations: this.validations,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 POST-MIGRATION VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    const passCount = this.validations.filter(v => v.status === 'pass').length;
    const failCount = this.errors.length;
    const warnCount = this.warnings.length;
    
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warnCount}`);
    console.log(`📋 Total Validations: ${this.validations.length}`);

    if (failCount > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.name}: ${error.message}`);
      });
    }

    if (warnCount > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.name}: ${warning.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (failCount === 0) {
      console.log('🎉 MIGRATION VALIDATION SUCCESSFUL!');
      console.log('\nNext steps:');
      console.log('1. Review any warnings above');
      console.log('2. Test the system thoroughly with real users');
      console.log('3. Monitor performance and costs');
      console.log('4. Update DNS when ready to go live');
    } else {
      console.log('🚫 MIGRATION VALIDATION FAILED');
      console.log('\nPlease resolve the critical issues above.');
    }
  }

  /**
   * Save validation report
   */
  async saveReport() {
    try {
      const reportDir = path.join(__dirname, '../logs/post-migration');
      await fs.mkdir(reportDir, { recursive: true });
      
      const reportPath = path.join(reportDir, `validation-${Date.now()}.json`);
      const report = {
        timestamp: new Date().toISOString(),
        clinicId: this.clinicId,
        success: this.errors.length === 0,
        summary: {
          total: this.validations.length,
          passed: this.validations.filter(v => v.status === 'pass').length,
          failed: this.errors.length,
          warnings: this.warnings.length
        },
        validations: this.validations,
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
  const validator = new PostMigrationValidation();
  
  try {
    const result = await validator.runAllValidations();
    await validator.saveReport();
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('Post-migration validation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PostMigrationValidation;