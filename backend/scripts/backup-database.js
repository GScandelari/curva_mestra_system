#!/usr/bin/env node

/**
 * Database Backup Script
 * Creates automated backups of the PostgreSQL database
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DatabaseBackup {
  constructor() {
    this.dbHost = process.env.DB_HOST || 'localhost';
    this.dbPort = process.env.DB_PORT || 5432;
    this.dbName = process.env.DB_NAME || 'inventario_clinica';
    this.dbUser = process.env.DB_USER || 'postgres';
    this.dbPassword = process.env.DB_PASSWORD;
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  }

  /**
   * Create database backup
   * @param {string} backupType Type of backup (full, schema, data)
   * @returns {Promise<string>} Path to backup file
   */
  async createBackup(backupType = 'full') {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${this.dbName}_${backupType}_${timestamp}.sql`;
      const backupPath = path.join(this.backupDir, backupFileName);

      console.log(`Creating ${backupType} backup: ${backupFileName}`);

      // Set PGPASSWORD environment variable
      const env = { ...process.env, PGPASSWORD: this.dbPassword };

      let pgDumpOptions = [
        '--host', this.dbHost,
        '--port', this.dbPort,
        '--username', this.dbUser,
        '--format', 'custom',
        '--verbose',
        '--file', backupPath
      ];

      // Add specific options based on backup type
      switch (backupType) {
        case 'schema':
          pgDumpOptions.push('--schema-only');
          break;
        case 'data':
          pgDumpOptions.push('--data-only');
          break;
        case 'full':
        default:
          // Full backup includes both schema and data
          break;
      }

      pgDumpOptions.push(this.dbName);

      const command = `pg_dump ${pgDumpOptions.join(' ')}`;
      
      execSync(command, { 
        env,
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });

      console.log(`Backup created successfully: ${backupPath}`);

      // Compress backup file
      const compressedPath = await this.compressBackup(backupPath);
      
      // Remove uncompressed file
      fs.unlinkSync(backupPath);

      return compressedPath;
    } catch (error) {
      console.error('Backup failed:', error.message);
      throw error;
    }
  }

  /**
   * Compress backup file using gzip
   * @param {string} filePath Path to backup file
   * @returns {Promise<string>} Path to compressed file
   */
  async compressBackup(filePath) {
    const compressedPath = `${filePath}.gz`;
    
    try {
      execSync(`gzip "${filePath}"`, { stdio: 'inherit' });
      console.log(`Backup compressed: ${compressedPath}`);
      return compressedPath;
    } catch (error) {
      console.error('Compression failed:', error.message);
      return filePath; // Return original file if compression fails
    }
  }

  /**
   * Clean old backup files based on retention policy
   */
  cleanOldBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return;
      }

      const files = fs.readdirSync(this.backupDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate && file.includes(this.dbName)) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted old backup: ${file}`);
        }
      });

      console.log(`Cleaned ${deletedCount} old backup files`);
    } catch (error) {
      console.error('Error cleaning old backups:', error.message);
    }
  }

  /**
   * List available backups
   * @returns {Array} List of backup files with metadata
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
   * Verify backup integrity
   * @param {string} backupPath Path to backup file
   * @returns {Promise<boolean>} True if backup is valid
   */
  async verifyBackup(backupPath) {
    try {
      // For compressed files, check if they can be decompressed
      if (backupPath.endsWith('.gz')) {
        execSync(`gzip -t "${backupPath}"`, { stdio: 'pipe' });
      }

      // Check if file is a valid PostgreSQL dump
      const env = { ...process.env, PGPASSWORD: this.dbPassword };
      execSync(`pg_restore --list "${backupPath}"`, { 
        env,
        stdio: 'pipe'
      });

      return true;
    } catch (error) {
      console.error(`Backup verification failed for ${backupPath}:`, error.message);
      return false;
    }
  }
}

// CLI interface
if (require.main === module) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      const backupType = process.argv[3] || 'full';
      backup.createBackup(backupType)
        .then(path => {
          console.log(`Backup completed: ${path}`);
          backup.cleanOldBackups();
        })
        .catch(error => {
          console.error('Backup failed:', error.message);
          process.exit(1);
        });
      break;

    case 'list':
      const backups = backup.listBackups();
      console.log('\nAvailable backups:');
      backups.forEach(b => {
        const sizeKB = Math.round(b.size / 1024);
        console.log(`  ${b.filename} (${sizeKB}KB, ${b.created.toISOString()})`);
      });
      break;

    case 'clean':
      backup.cleanOldBackups();
      break;

    case 'verify':
      const backupPath = process.argv[3];
      if (!backupPath) {
        console.error('Please provide backup file path');
        process.exit(1);
      }
      backup.verifyBackup(backupPath)
        .then(isValid => {
          console.log(`Backup ${isValid ? 'is valid' : 'is corrupted'}`);
          process.exit(isValid ? 0 : 1);
        });
      break;

    default:
      console.log(`
Usage: node backup-database.js <command> [options]

Commands:
  create [type]  Create backup (type: full, schema, data)
  list          List available backups
  clean         Remove old backups
  verify <path> Verify backup integrity

Examples:
  node backup-database.js create full
  node backup-database.js list
  node backup-database.js verify /path/to/backup.sql.gz
      `);
  }
}

module.exports = DatabaseBackup;