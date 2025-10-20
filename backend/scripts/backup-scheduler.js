#!/usr/bin/env node

/**
 * Backup Scheduler Service
 * Manages automated database backups using cron-like scheduling
 */

require('dotenv').config();
const DatabaseBackup = require('./backup-database');
const fs = require('fs');
const path = require('path');

class BackupScheduler {
  constructor() {
    this.backup = new DatabaseBackup();
    this.schedule = process.env.DB_BACKUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Parse cron expression to milliseconds interval
   * Simplified parser for basic cron expressions
   * @param {string} cronExpression Cron expression
   * @returns {number} Interval in milliseconds
   */
  parseCronExpression(cronExpression) {
    const parts = cronExpression.split(' ');
    
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression. Expected format: "minute hour day month weekday"');
    }

    const [minute, hour, day, month, weekday] = parts;

    // For simplicity, we'll handle daily backups
    // In production, use a proper cron library like node-cron
    if (hour !== '*' && minute !== '*') {
      // Daily backup at specific time
      return 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    }

    // Default to daily backup
    return 24 * 60 * 60 * 1000;
  }

  /**
   * Calculate next backup time based on schedule
   * @returns {Date} Next backup time
   */
  getNextBackupTime() {
    const now = new Date();
    const parts = this.schedule.split(' ');
    const [minute, hour] = parts;

    if (hour !== '*' && minute !== '*') {
      const nextBackup = new Date();
      nextBackup.setHours(parseInt(hour), parseInt(minute), 0, 0);

      // If time has passed today, schedule for tomorrow
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }

      return nextBackup;
    }

    // Default to next day at 2 AM
    const nextBackup = new Date();
    nextBackup.setDate(nextBackup.getDate() + 1);
    nextBackup.setHours(2, 0, 0, 0);
    return nextBackup;
  }

  /**
   * Start the backup scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('Backup scheduler is already running');
      return;
    }

    console.log(`Starting backup scheduler with schedule: ${this.schedule}`);
    
    const nextBackupTime = this.getNextBackupTime();
    const timeUntilNextBackup = nextBackupTime.getTime() - Date.now();

    console.log(`Next backup scheduled for: ${nextBackupTime.toISOString()}`);

    // Schedule first backup
    setTimeout(() => {
      this.performScheduledBackup();
      
      // Set up recurring backups
      this.intervalId = setInterval(() => {
        this.performScheduledBackup();
      }, 24 * 60 * 60 * 1000); // Daily interval
      
    }, timeUntilNextBackup);

    this.isRunning = true;
  }

  /**
   * Stop the backup scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Backup scheduler is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Backup scheduler stopped');
  }

  /**
   * Perform scheduled backup
   */
  async performScheduledBackup() {
    try {
      console.log('Starting scheduled backup...');
      
      const backupPath = await this.backup.createBackup('full');
      
      // Verify backup
      const isValid = await this.backup.verifyBackup(backupPath);
      if (!isValid) {
        throw new Error('Backup verification failed');
      }

      // Clean old backups
      this.backup.cleanOldBackups();

      // Log successful backup
      this.logBackupResult(true, backupPath);
      
      console.log(`Scheduled backup completed successfully: ${backupPath}`);
      
    } catch (error) {
      console.error('Scheduled backup failed:', error.message);
      this.logBackupResult(false, null, error.message);
      
      // Send notification about backup failure
      this.notifyBackupFailure(error);
    }
  }

  /**
   * Log backup result to file
   * @param {boolean} success Whether backup was successful
   * @param {string} backupPath Path to backup file
   * @param {string} error Error message if failed
   */
  logBackupResult(success, backupPath, error = null) {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'backup.log');
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      success,
      backupPath,
      error
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (logError) {
      console.error('Failed to write backup log:', logError.message);
    }
  }

  /**
   * Send notification about backup failure
   * @param {Error} error Backup error
   */
  async notifyBackupFailure(error) {
    // In a real implementation, you would send email notifications
    // or integrate with monitoring systems like Slack, PagerDuty, etc.
    
    console.error(`BACKUP FAILURE NOTIFICATION: ${error.message}`);
    
    // Example: Send email notification (requires email service setup)
    /*
    try {
      const emailService = require('../services/emailService');
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: 'Database Backup Failed',
        text: `Database backup failed at ${new Date().toISOString()}\n\nError: ${error.message}`
      });
    } catch (emailError) {
      console.error('Failed to send backup failure notification:', emailError.message);
    }
    */
  }

  /**
   * Get backup scheduler status
   * @returns {Object} Scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.schedule,
      nextBackupTime: this.isRunning ? this.getNextBackupTime() : null
    };
  }

  /**
   * Get backup history from logs
   * @param {number} limit Number of entries to return
   * @returns {Array} Backup history
   */
  getBackupHistory(limit = 10) {
    const logFile = path.join(__dirname, '../logs/backup.log');
    
    try {
      if (!fs.existsSync(logFile)) {
        return [];
      }

      const logContent = fs.readFileSync(logFile, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line);
      
      const history = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null)
        .reverse();

      return history;
    } catch (error) {
      console.error('Failed to read backup history:', error.message);
      return [];
    }
  }
}

// CLI interface
if (require.main === module) {
  const scheduler = new BackupScheduler();
  const command = process.argv[2];

  switch (command) {
    case 'start':
      scheduler.start();
      
      // Keep process running
      process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, stopping scheduler...');
        scheduler.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, stopping scheduler...');
        scheduler.stop();
        process.exit(0);
      });
      
      break;

    case 'stop':
      scheduler.stop();
      break;

    case 'status':
      const status = scheduler.getStatus();
      console.log('Backup Scheduler Status:');
      console.log(`  Running: ${status.isRunning}`);
      console.log(`  Schedule: ${status.schedule}`);
      if (status.nextBackupTime) {
        console.log(`  Next backup: ${status.nextBackupTime.toISOString()}`);
      }
      break;

    case 'history':
      const limit = parseInt(process.argv[3]) || 10;
      const history = scheduler.getBackupHistory(limit);
      
      console.log(`\nBackup History (last ${limit} entries):`);
      history.forEach(entry => {
        const status = entry.success ? '✓' : '✗';
        const timestamp = new Date(entry.timestamp).toLocaleString();
        console.log(`  ${status} ${timestamp} - ${entry.success ? entry.backupPath : entry.error}`);
      });
      break;

    case 'run':
      scheduler.performScheduledBackup()
        .then(() => {
          console.log('Manual backup completed');
          process.exit(0);
        })
        .catch(error => {
          console.error('Manual backup failed:', error.message);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: node backup-scheduler.js <command>

Commands:
  start     Start the backup scheduler
  stop      Stop the backup scheduler
  status    Show scheduler status
  history   Show backup history
  run       Run backup manually

Examples:
  node backup-scheduler.js start
  node backup-scheduler.js status
  node backup-scheduler.js history 20
      `);
  }
}

module.exports = BackupScheduler;