#!/usr/bin/env node

/**
 * Database Restore Script
 * Restores PostgreSQL database from backup files
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class DatabaseRestore {
  constructor() {
    this.dbHost = process.env.DB_HOST || 'localhost';
    this.dbPort = process.env.DB_PORT || 5432;
    this.dbName = process.env.DB_NAME || 'inventario_clinica';
    this.dbUser = process.env.DB_USER || 'postgres';
    this.dbPassword = process.env.DB_PASSWORD;
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
  }

  /**
   * Restore database from backup file
   * @param {string} backupPath Path to backup file
   * @param {Object} options Restore options
   * @returns {Promise<void>}
   */
  async restoreDatabase(backupPath, options = {}) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      console.log(`Restoring database from: ${backupPath}`);

      // Decompress if needed
      let actualBackupPath = backupPath;
      if (backupPath.endsWith('.gz')) {
        actualBackupPath = await this.decompressBackup(backupPath);
      }

      // Set PGPASSWORD environment variable
      const env = { ...process.env, PGPASSWORD: this.dbPassword };

      let pgRestoreOptions = [
        '--host', this.dbHost,
        '--port', this.dbPort,
        '--username', this.dbUser,
        '--dbname', this.dbName,
        '--verbose'
      ];

      // Add restore options
      if (options.clean) {
        pgRestoreOptions.push('--clean');
      }

      if (options.createDb) {
        pgRestoreOptions.push('--create');
      }

      if (options.noOwner) {
        pgRestoreOptions.push('--no-owner');
      }

      if (options.noPrivileges) {
        pgRestoreOptions.push('--no-privileges');
      }

      if (options.schemaOnly) {
        pgRestoreOptions.push('--schema-only');
      }

      if (options.dataOnly) {
        pgRestoreOptions.push('--data-only');
      }

      pgRestoreOptions.push(actualBackupPath);

      const command = `pg_restore ${pgRestoreOptions.join(' ')}`;
      
      console.log('Starting restore process...');
      execSync(command, { 
        env,
        stdio: 'inherit',
        timeout: 600000 // 10 minutes timeout
      });

      console.log('Database restore completed successfully');

      // Clean up decompressed file if it was created
      if (actualBackupPath !== backupPath) {
        fs.unlinkSync(actualBackupPath);
      }

    } catch (error) {
      console.error('Restore failed:', error.message);
      throw error;
    }
  }

  /**
   * Decompress backup file
   * @param {string} compressedPath Path to compressed backup
   * @returns {Promise<string>} Path to decompressed file
   */
  async decompressBackup(compressedPath) {
    const decompressedPath = compressedPath.replace('.gz', '');
    
    try {
      console.log('Decompressing backup file...');
      execSync(`gunzip -c "${compressedPath}" > "${decompressedPath}"`, { stdio: 'inherit' });
      return decompressedPath;
    } catch (error) {
      console.error('Decompression failed:', error.message);
      throw error;
    }
  }

  /**
   * Create database if it doesn't exist
   * @returns {Promise<void>}
   */
  async createDatabase() {
    try {
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      
      // Connect to postgres database to create target database
      const command = `createdb --host=${this.dbHost} --port=${this.dbPort} --username=${this.dbUser} ${this.dbName}`;
      
      execSync(command, { 
        env,
        stdio: 'pipe' // Suppress output for this operation
      });
      
      console.log(`Database '${this.dbName}' created successfully`);
    } catch (error) {
      // Database might already exist, which is fine
      if (!error.message.includes('already exists')) {
        console.error('Failed to create database:', error.message);
        throw error;
      }
    }
  }

  /**
   * Drop database (with confirmation)
   * @returns {Promise<void>}
   */
  async dropDatabase() {
    try {
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      
      const command = `dropdb --host=${this.dbHost} --port=${this.dbPort} --username=${this.dbUser} ${this.dbName}`;
      
      execSync(command, { 
        env,
        stdio: 'inherit'
      });
      
      console.log(`Database '${this.dbName}' dropped successfully`);
    } catch (error) {
      console.error('Failed to drop database:', error.message);
      throw error;
    }
  }

  /**
   * List available backup files
   * @returns {Array} List of backup files
   */
  listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      const backups = [];

      files.forEach(file => {
        if (file.includes(this.dbName) && (file.endsWith('.sql') || file.endsWith('.sql.gz'))) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
            type: file.includes('_schema_') ? 'schema' : 
                  file.includes('_data_') ? 'data' : 'full'
          });
        }
      });

      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error listing backups:', error.message);
      return [];
    }
  }

  /**
   * Prompt user for confirmation
   * @param {string} message Confirmation message
   * @returns {Promise<boolean>} User confirmation
   */
  async promptConfirmation(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
}

// CLI interface
if (require.main === module) {
  const restore = new DatabaseRestore();
  const command = process.argv[2];

  switch (command) {
    case 'restore':
      const backupPath = process.argv[3];
      if (!backupPath) {
        console.error('Please provide backup file path');
        process.exit(1);
      }

      const options = {
        clean: process.argv.includes('--clean'),
        createDb: process.argv.includes('--create-db'),
        noOwner: process.argv.includes('--no-owner'),
        noPrivileges: process.argv.includes('--no-privileges'),
        schemaOnly: process.argv.includes('--schema-only'),
        dataOnly: process.argv.includes('--data-only')
      };

      restore.restoreDatabase(backupPath, options)
        .then(() => {
          console.log('Restore completed successfully');
        })
        .catch(error => {
          console.error('Restore failed:', error.message);
          process.exit(1);
        });
      break;

    case 'list':
      const backups = restore.listBackups();
      console.log('\nAvailable backups:');
      backups.forEach((b, index) => {
        const sizeKB = Math.round(b.size / 1024);
        console.log(`  ${index + 1}. ${b.filename} (${sizeKB}KB, ${b.created.toISOString()})`);
      });
      break;

    case 'create-db':
      restore.createDatabase()
        .then(() => {
          console.log('Database creation completed');
        })
        .catch(error => {
          console.error('Database creation failed:', error.message);
          process.exit(1);
        });
      break;

    case 'drop-db':
      restore.promptConfirmation(`Are you sure you want to drop database '${restore.dbName}'?`)
        .then(confirmed => {
          if (confirmed) {
            return restore.dropDatabase();
          } else {
            console.log('Operation cancelled');
          }
        })
        .then(() => {
          console.log('Database drop completed');
        })
        .catch(error => {
          console.error('Database drop failed:', error.message);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: node restore-database.js <command> [options]

Commands:
  restore <path>  Restore database from backup file
  list           List available backup files
  create-db      Create database if it doesn't exist
  drop-db        Drop database (with confirmation)

Restore Options:
  --clean         Clean database before restore
  --create-db     Create database if it doesn't exist
  --no-owner      Skip ownership restoration
  --no-privileges Skip privileges restoration
  --schema-only   Restore schema only
  --data-only     Restore data only

Examples:
  node restore-database.js restore /path/to/backup.sql.gz --clean
  node restore-database.js list
  node restore-database.js create-db
      `);
  }
}

module.exports = DatabaseRestore;