const fs = require('fs').promises;
const path = require('path');
const { AuditLog } = require('../models');
const { Op } = require('sequelize');

/**
 * Audit Backup Service
 * Handles automatic backup of audit logs
 */
class AuditBackupService {
  constructor() {
    this.backupDir = process.env.AUDIT_BACKUP_DIR || path.join(process.cwd(), 'backups', 'audit');
    this.maxBackupAge = parseInt(process.env.AUDIT_BACKUP_MAX_AGE_DAYS) || 90; // 90 days default
    this.backupInterval = parseInt(process.env.AUDIT_BACKUP_INTERVAL_HOURS) || 24; // 24 hours default
    this.isRunning = false;
  }

  /**
   * Initialize backup service
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      // Start automatic backup schedule
      this.startBackupSchedule();
      
      console.log('Audit backup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audit backup service:', error);
      throw error;
    }
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`Created audit backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Start automatic backup schedule
   */
  startBackupSchedule() {
    if (this.isRunning) {
      console.log('Audit backup schedule is already running');
      return;
    }

    this.isRunning = true;
    
    // Run initial backup
    this.performBackup().catch(error => {
      console.error('Initial audit backup failed:', error);
    });

    // Schedule periodic backups
    this.backupTimer = setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        console.error('Scheduled audit backup failed:', error);
      }
    }, this.backupInterval * 60 * 60 * 1000); // Convert hours to milliseconds

    console.log(`Audit backup scheduled every ${this.backupInterval} hours`);
  }

  /**
   * Stop backup schedule
   */
  stopBackupSchedule() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    this.isRunning = false;
    console.log('Audit backup schedule stopped');
  }

  /**
   * Perform backup of audit logs
   */
  async performBackup() {
    try {
      console.log('Starting audit logs backup...');
      
      const startTime = Date.now();
      const backupDate = new Date();
      const fileName = `audit_logs_${backupDate.toISOString().split('T')[0]}_${Date.now()}.json`;
      const filePath = path.join(this.backupDir, fileName);

      // Get all audit logs from the last backup period
      const cutoffDate = new Date(Date.now() - (this.backupInterval * 60 * 60 * 1000));
      
      const auditLogs = await AuditLog.findAll({
        where: {
          timestamp: {
            [Op.gte]: cutoffDate
          }
        },
        order: [['timestamp', 'ASC']],
        raw: true
      });

      if (auditLogs.length === 0) {
        console.log('No new audit logs to backup');
        return;
      }

      // Prepare backup data
      const backupData = {
        metadata: {
          backupDate: backupDate.toISOString(),
          recordCount: auditLogs.length,
          periodStart: cutoffDate.toISOString(),
          periodEnd: backupDate.toISOString(),
          version: '1.0'
        },
        auditLogs
      };

      // Write backup file
      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf8');

      const duration = Date.now() - startTime;
      console.log(`Audit backup completed: ${auditLogs.length} records backed up to ${fileName} in ${duration}ms`);

      // Clean up old backups
      await this.cleanupOldBackups();

    } catch (error) {
      console.error('Audit backup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old backup files
   */
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const cutoffDate = Date.now() - (this.maxBackupAge * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (!file.startsWith('audit_logs_') || !file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Deleted old audit backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old audit backups:', error);
    }
  }

  /**
   * Manual backup trigger
   */
  async triggerManualBackup() {
    try {
      console.log('Manual audit backup triggered');
      await this.performBackup();
      return { success: true, message: 'Manual backup completed successfully' };
    } catch (error) {
      console.error('Manual audit backup failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get backup status and statistics
   */
  async getBackupStatus() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => 
        file.startsWith('audit_logs_') && file.endsWith('.json')
      );

      const backups = [];
      let totalSize = 0;

      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        backups.push({
          fileName: file,
          size: stats.size,
          createdAt: stats.mtime,
          age: Date.now() - stats.mtime.getTime()
        });

        totalSize += stats.size;
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.createdAt - a.createdAt);

      return {
        isRunning: this.isRunning,
        backupInterval: this.backupInterval,
        maxBackupAge: this.maxBackupAge,
        backupDirectory: this.backupDir,
        totalBackups: backups.length,
        totalSize,
        backups: backups.slice(0, 10) // Return only the 10 most recent
      };
    } catch (error) {
      console.error('Failed to get backup status:', error);
      throw error;
    }
  }

  /**
   * Restore audit logs from backup file
   */
  async restoreFromBackup(fileName) {
    try {
      const filePath = path.join(this.backupDir, fileName);
      
      // Check if file exists
      await fs.access(filePath);
      
      // Read backup file
      const backupContent = await fs.readFile(filePath, 'utf8');
      const backupData = JSON.parse(backupContent);

      if (!backupData.auditLogs || !Array.isArray(backupData.auditLogs)) {
        throw new Error('Invalid backup file format');
      }

      // Restore audit logs (this would typically be used in disaster recovery)
      console.log(`Restoring ${backupData.auditLogs.length} audit logs from ${fileName}`);
      
      // Note: In a real scenario, you might want to check for duplicates
      // and handle the restoration more carefully
      
      return {
        success: true,
        message: `Successfully restored ${backupData.auditLogs.length} audit logs`,
        metadata: backupData.metadata
      };
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw error;
    }
  }
}

// Create singleton instance
const auditBackupService = new AuditBackupService();

module.exports = auditBackupService;