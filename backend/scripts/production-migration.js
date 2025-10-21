#!/usr/bin/env node

/**
 * Production Migration Script - PostgreSQL to Firebase
 * 
 * This script orchestrates the complete migration process from PostgreSQL to Firebase
 * including backup, user migration, data migration, validation, and system redirection.
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import existing migration classes
const DatabaseBackup = require('./backup-database');
const UserMigration = require('./migrate-users-to-firebase');
const FirestoreMigration = require('./migrate-to-firestore');

class ProductionMigration {
  constructor() {
    this.clinicId = process.env.CLINIC_ID || 'default-clinic';
    this.migrationId = `migration-${Date.now()}`;
    this.logDir = path.join(__dirname, '../logs/migrations');
    this.backupDir = path.join(__dirname, '../backups');
    this.migrationLog = {
      id: this.migrationId,
      clinicId: this.clinicId,
      startTime: new Date().toISOString(),
      steps: [],
      errors: [],
      status: 'started'
    };
  }

  /**
   * Log migration step
   */
  async logStep(step, status, details = {}) {
    const stepLog = {
      step,
      status,
      timestamp: new Date().toISOString(),
      details
    };
    
    this.migrationLog.steps.push(stepLog);
    console.log(`[${stepLog.timestamp}] ${step}: ${status}`);
    
    if (details.error) {
      this.migrationLog.errors.push({
        step,
        error: details.error,
        timestamp: stepLog.timestamp
      });
    }

    // Save log after each step
    await this.saveMigrationLog();
  }

  /**
   * Save migration log to file
   */
  async saveMigrationLog() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const logPath = path.join(this.logDir, `${this.migrationId}.json`);
      await fs.writeFile(logPath, JSON.stringify(this.migrationLog, null, 2));
    } catch (error) {
      console.error('Error saving migration log:', error);
    }
  }

  /**
   * Step 1: Create complete backup of current system
   */
  async createSystemBackup() {
    await this.logStep('System Backup', 'started');
    
    try {
      const backup = new DatabaseBackup();
      
      // Create full database backup
      const backupPath = await backup.createBackup('full');
      
      // Verify backup integrity
      const isValid = await backup.verifyBackup(backupPath);
      if (!isValid) {
        throw new Error('Backup verification failed');
      }

      await this.logStep('System Backup', 'completed', {
        backupPath,
        verified: true
      });

      return backupPath;
    } catch (error) {
      await this.logStep('System Backup', 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 2: Migrate users to Firebase Auth
   */
  async migrateUsers() {
    await this.logStep('User Migration', 'started');
    
    try {
      const userMigration = new UserMigration();
      const results = await userMigration.executeMigration();

      if (results.failed > 0) {
        await this.logStep('User Migration', 'completed_with_errors', {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
          errors: results.errors
        });
      } else {
        await this.logStep('User Migration', 'completed', {
          total: results.total,
          successful: results.successful
        });
      }

      return results;
    } catch (error) {
      await this.logStep('User Migration', 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 3: Migrate data to Firestore
   */
  async migrateData() {
    await this.logStep('Data Migration', 'started');
    
    try {
      const firestoreMigration = new FirestoreMigration();
      await firestoreMigration.initialize();
      
      const results = await firestoreMigration.migrate(this.clinicId);

      if (results.errors.length > 0) {
        await this.logStep('Data Migration', 'completed_with_errors', {
          migrationLog: results.migrationLog,
          errors: results.errors,
          backupPath: results.backupPath
        });
      } else {
        await this.logStep('Data Migration', 'completed', {
          migrationLog: results.migrationLog,
          backupPath: results.backupPath
        });
      }

      return results;
    } catch (error) {
      await this.logStep('Data Migration', 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 4: Validate data integrity
   */
  async validateMigration() {
    await this.logStep('Data Validation', 'started');
    
    try {
      const firestoreMigration = new FirestoreMigration();
      await firestoreMigration.initialize();
      
      const validation = await firestoreMigration.validateMigration(this.clinicId);

      if (!validation.valid) {
        await this.logStep('Data Validation', 'failed', {
          results: validation.results,
          inconsistencies: Object.entries(validation.results)
            .filter(([_, result]) => !result.valid)
            .map(([key, result]) => ({
              collection: key,
              postgresql: result.postgresql,
              firestore: result.firestore
            }))
        });
        throw new Error('Data validation failed - inconsistencies found');
      }

      await this.logStep('Data Validation', 'completed', {
        results: validation.results
      });

      return validation;
    } catch (error) {
      await this.logStep('Data Validation', 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 5: Configure system redirection
   */
  async configureRedirection() {
    await this.logStep('System Redirection', 'started');
    
    try {
      // Create maintenance page
      await this.createMaintenancePage();
      
      // Update nginx configuration for redirection
      await this.updateNginxConfig();
      
      // Create environment configuration for Firebase
      await this.createFirebaseEnvConfig();

      await this.logStep('System Redirection', 'completed', {
        maintenancePage: 'created',
        nginxConfig: 'updated',
        firebaseConfig: 'created'
      });

    } catch (error) {
      await this.logStep('System Redirection', 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create maintenance page for old system
   */
  async createMaintenancePage() {
    const maintenanceHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Migrado - Curva Mestra</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
        }
        .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            max-width: 500px;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            margin-bottom: 1rem;
            font-size: 2rem;
        }
        p {
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .new-url {
            background: rgba(255, 255, 255, 0.2);
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            font-weight: bold;
        }
        .redirect-btn {
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            text-decoration: none;
            display: inline-block;
            transition: background 0.3s;
        }
        .redirect-btn:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚀</div>
        <h1>Sistema Migrado com Sucesso!</h1>
        <p>O sistema Curva Mestra foi migrado para uma nova plataforma mais moderna e eficiente.</p>
        
        <div class="new-url">
            Nova URL: ${process.env.FIREBASE_HOSTING_URL || 'https://curva-mestra.web.app'}
        </div>
        
        <p>Você será redirecionado automaticamente em <span id="countdown">10</span> segundos.</p>
        
        <a href="${process.env.FIREBASE_HOSTING_URL || 'https://curva-mestra.web.app'}" class="redirect-btn">
            Acessar Novo Sistema
        </a>
    </div>

    <script>
        let countdown = 10;
        const countdownElement = document.getElementById('countdown');
        
        const timer = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(timer);
                window.location.href = '${process.env.FIREBASE_HOSTING_URL || 'https://curva-mestra.web.app'}';
            }
        }, 1000);
    </script>
</body>
</html>`;

    const maintenancePath = path.join(__dirname, '../../public/maintenance.html');
    await fs.writeFile(maintenancePath, maintenanceHtml);
  }

  /**
   * Update nginx configuration for redirection
   */
  async updateNginxConfig() {
    const nginxConfig = `
# Nginx configuration for system migration
server {
    listen 80;
    server_name ${process.env.DOMAIN_NAME || 'localhost'};
    
    # Redirect all traffic to maintenance page initially
    location / {
        root /app/public;
        try_files /maintenance.html =404;
    }
    
    # Health check endpoint
    location /health {
        return 200 'System migrated to Firebase';
        add_header Content-Type text/plain;
    }
}

# Optional: Redirect to new Firebase hosting URL
# Uncomment when ready to fully redirect
# server {
#     listen 80;
#     server_name ${process.env.DOMAIN_NAME || 'localhost'};
#     return 301 ${process.env.FIREBASE_HOSTING_URL || 'https://curva-mestra.web.app'}$request_uri;
# }
`;

    const nginxPath = path.join(__dirname, '../../nginx/sites-available/migration.conf');
    await fs.mkdir(path.dirname(nginxPath), { recursive: true });
    await fs.writeFile(nginxPath, nginxConfig);
  }

  /**
   * Create Firebase environment configuration
   */
  async createFirebaseEnvConfig() {
    const firebaseEnv = `
# Firebase Production Environment Variables
# Generated during migration on ${new Date().toISOString()}

# Firebase Configuration
VITE_FIREBASE_API_KEY=${process.env.FIREBASE_API_KEY || 'AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU'}
VITE_FIREBASE_AUTH_DOMAIN=${process.env.FIREBASE_AUTH_DOMAIN || 'curva-mestra.firebaseapp.com'}
VITE_FIREBASE_PROJECT_ID=${process.env.FIREBASE_PROJECT_ID || 'curva-mestra'}
VITE_FIREBASE_STORAGE_BUCKET=${process.env.FIREBASE_STORAGE_BUCKET || 'curva-mestra.appspot.com'}
VITE_FIREBASE_MESSAGING_SENDER_ID=${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}
VITE_FIREBASE_APP_ID=${process.env.FIREBASE_APP_ID || ''}

# Migration Information
MIGRATION_ID=${this.migrationId}
MIGRATION_DATE=${new Date().toISOString()}
CLINIC_ID=${this.clinicId}
MIGRATED_FROM=postgresql
`;

    const envPath = path.join(__dirname, '../../.env.firebase.production');
    await fs.writeFile(envPath, firebaseEnv);
  }

  /**
   * Execute complete production migration
   */
  async executeMigration() {
    console.log('🚀 Starting Production Migration to Firebase...\n');
    console.log(`Migration ID: ${this.migrationId}`);
    console.log(`Clinic ID: ${this.clinicId}`);
    console.log(`Start Time: ${this.migrationLog.startTime}\n`);

    try {
      // Step 1: Create system backup
      console.log('📦 Step 1: Creating system backup...');
      const backupPath = await this.createSystemBackup();
      console.log(`✅ Backup created: ${backupPath}\n`);

      // Step 2: Migrate users to Firebase Auth
      console.log('👥 Step 2: Migrating users to Firebase Auth...');
      const userResults = await this.migrateUsers();
      console.log(`✅ Users migrated: ${userResults.successful}/${userResults.total}\n`);

      // Step 3: Migrate data to Firestore
      console.log('📊 Step 3: Migrating data to Firestore...');
      const dataResults = await this.migrateData();
      console.log(`✅ Data migration completed with ${dataResults.errors.length} errors\n`);

      // Step 4: Validate migration
      console.log('🔍 Step 4: Validating data integrity...');
      const validation = await this.validateMigration();
      console.log('✅ Data validation completed successfully\n');

      // Step 5: Configure system redirection
      console.log('🔄 Step 5: Configuring system redirection...');
      await this.configureRedirection();
      console.log('✅ System redirection configured\n');

      // Update final status
      this.migrationLog.status = 'completed';
      this.migrationLog.endTime = new Date().toISOString();
      this.migrationLog.duration = new Date(this.migrationLog.endTime) - new Date(this.migrationLog.startTime);
      
      await this.saveMigrationLog();

      // Print final summary
      this.printMigrationSummary();

      return {
        success: true,
        migrationId: this.migrationId,
        backupPath,
        userResults,
        dataResults,
        validation
      };

    } catch (error) {
      this.migrationLog.status = 'failed';
      this.migrationLog.endTime = new Date().toISOString();
      this.migrationLog.fatalError = error.message;
      
      await this.saveMigrationLog();
      
      console.error('\n❌ Migration failed:', error.message);
      console.error('Check migration log for details:', path.join(this.logDir, `${this.migrationId}.json`));
      
      throw error;
    }
  }

  /**
   * Print migration summary
   */
  printMigrationSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PRODUCTION MIGRATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Migration ID: ${this.migrationId}`);
    console.log(`Clinic ID: ${this.clinicId}`);
    console.log(`Duration: ${Math.round(this.migrationLog.duration / 1000 / 60)} minutes`);
    console.log(`Total Steps: ${this.migrationLog.steps.length}`);
    console.log(`Errors: ${this.migrationLog.errors.length}`);
    
    if (this.migrationLog.errors.length > 0) {
      console.log('\n⚠️  ERRORS ENCOUNTERED:');
      this.migrationLog.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.step}: ${error.error}`);
      });
    }

    console.log('\n📋 NEXT STEPS:');
    console.log('1. Test the new Firebase system thoroughly');
    console.log('2. Update DNS to point to Firebase Hosting');
    console.log('3. Monitor system performance and costs');
    console.log('4. Archive old PostgreSQL system after validation period');
    
    console.log('\n🔗 IMPORTANT URLS:');
    console.log(`Firebase Console: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || 'curva-mestra'}`);
    console.log(`New System URL: ${process.env.FIREBASE_HOSTING_URL || 'https://curva-mestra.web.app'}`);
    console.log(`Migration Log: ${path.join(this.logDir, `${this.migrationId}.json`)}`);
    
    console.log('\n✨ Migration completed successfully!');
  }

  /**
   * Rollback migration (emergency use only)
   */
  async rollbackMigration() {
    console.log('🔄 Starting migration rollback...');
    
    try {
      await this.logStep('Migration Rollback', 'started');

      // Rollback user migration
      const userMigration = new UserMigration();
      await userMigration.rollbackMigration();

      // Note: Firestore data rollback would need to be done manually
      // as there's no automated way to delete all migrated data safely

      await this.logStep('Migration Rollback', 'completed');
      console.log('✅ Migration rollback completed');

    } catch (error) {
      await this.logStep('Migration Rollback', 'failed', { error: error.message });
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const command = process.argv[2];
  const migration = new ProductionMigration();

  try {
    switch (command) {
      case 'migrate':
        await migration.executeMigration();
        break;
      
      case 'rollback':
        const confirm = process.argv[3];
        if (confirm !== '--confirm') {
          console.log('⚠️  Rollback is destructive. Use: node production-migration.js rollback --confirm');
          process.exit(1);
        }
        await migration.rollbackMigration();
        break;
      
      case 'status':
        const migrationId = process.argv[3];
        if (!migrationId) {
          console.log('Usage: node production-migration.js status <migration-id>');
          process.exit(1);
        }
        
        const logPath = path.join(__dirname, '../logs/migrations', `${migrationId}.json`);
        try {
          const logData = JSON.parse(await fs.readFile(logPath, 'utf8'));
          console.log(JSON.stringify(logData, null, 2));
        } catch (error) {
          console.error('Migration log not found:', logPath);
          process.exit(1);
        }
        break;
      
      default:
        console.log(`
🚀 Production Migration Script - PostgreSQL to Firebase

Usage: node production-migration.js <command> [options]

Commands:
  migrate           Execute complete production migration
  rollback --confirm Rollback migration (destructive)
  status <id>       Show migration status and log

Environment Variables:
  CLINIC_ID                 Target clinic ID (default: default-clinic)
  FIREBASE_API_KEY         Firebase API key
  FIREBASE_PROJECT_ID      Firebase project ID
  FIREBASE_HOSTING_URL     New system URL
  DOMAIN_NAME              Current domain name

Examples:
  CLINIC_ID=clinic-123 node production-migration.js migrate
  node production-migration.js status migration-1640995200000
  node production-migration.js rollback --confirm
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('Script execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ProductionMigration;