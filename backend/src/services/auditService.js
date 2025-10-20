const { AuditLog, StockMovement, User } = require('../models');
const { logAudit } = require('../middleware/audit');
const { Op } = require('sequelize');

/**
 * Audit Service for enhanced audit logging
 */
class AuditService {
  
  /**
   * Log stock movement with enhanced audit information
   */
  static async logStockMovement(movementData, req) {
    try {
      const { productId, movementType, quantity, userId, patientId, requestId, notes } = movementData;
      
      await logAudit({
        userId,
        action: `STOCK_${movementType.toUpperCase()}`,
        resource: 'STOCK_MOVEMENT',
        resourceId: productId,
        newValues: {
          productId,
          movementType,
          quantity,
          patientId,
          requestId,
          notes
        },
        metadata: {
          stockChange: movementType === 'entry' ? quantity : -quantity,
          associatedPatient: patientId,
          associatedRequest: requestId,
          operationType: 'stock_movement'
        },
        req
      });
    } catch (error) {
      console.error('Failed to log stock movement audit:', error);
    }
  }

  /**
   * Log critical system operations
   */
  static async logCriticalOperation(operationData, req) {
    try {
      const { action, resource, resourceId, oldValues, newValues, userId, metadata } = operationData;
      
      await logAudit({
        userId,
        action: `CRITICAL_${action}`,
        resource,
        resourceId,
        oldValues,
        newValues,
        metadata: {
          ...metadata,
          criticality: 'HIGH',
          timestamp: new Date().toISOString()
        },
        req
      });
    } catch (error) {
      console.error('Failed to log critical operation audit:', error);
    }
  }

  /**
   * Log user authentication events with enhanced details
   */
  static async logAuthEvent(eventData, req) {
    try {
      const { userId, action, success, errorMessage, metadata } = eventData;
      
      await logAudit({
        userId,
        action: `AUTH_${action}`,
        resource: 'AUTHENTICATION',
        success,
        errorMessage,
        metadata: {
          ...metadata,
          loginAttempt: true,
          sessionInfo: {
            userAgent: req?.headers['user-agent'],
            acceptLanguage: req?.headers['accept-language'],
            referer: req?.headers['referer']
          }
        },
        req
      });
    } catch (error) {
      console.error('Failed to log auth event audit:', error);
    }
  }

  /**
   * Log data access events for sensitive operations
   */
  static async logDataAccess(accessData, req) {
    try {
      const { userId, resource, resourceId, action, metadata } = accessData;
      
      await logAudit({
        userId,
        action: `ACCESS_${action}`,
        resource,
        resourceId,
        metadata: {
          ...metadata,
          accessType: 'data_access',
          sensitiveData: true,
          queryParameters: req?.query,
          requestPath: req?.originalUrl
        },
        req
      });
    } catch (error) {
      console.error('Failed to log data access audit:', error);
    }
  }

  /**
   * Log bulk operations that affect multiple records
   */
  static async logBulkOperation(bulkData, req) {
    try {
      const { userId, action, resource, affectedIds, metadata } = bulkData;
      
      await logAudit({
        userId,
        action: `BULK_${action}`,
        resource,
        metadata: {
          ...metadata,
          bulkOperation: true,
          affectedRecords: affectedIds?.length || 0,
          affectedIds: affectedIds?.slice(0, 10), // Limit to first 10 IDs
          operationScope: 'multiple_records'
        },
        req
      });
    } catch (error) {
      console.error('Failed to log bulk operation audit:', error);
    }
  }

  /**
   * Get audit trail for a specific resource
   */
  static async getResourceAuditTrail(resource, resourceId, options = {}) {
    try {
      const { limit = 50, offset = 0, startDate, endDate } = options;
      
      const whereClause = {
        resource: resource.toUpperCase(),
        resourceId
      };

      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) {
          whereClause.timestamp[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.timestamp[Op.lte] = new Date(endDate);
        }
      }

      const auditTrail = await AuditLog.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'role']
          }
        ],
        order: [['timestamp', 'DESC']],
        limit,
        offset
      });

      return auditTrail;
    } catch (error) {
      console.error('Failed to get resource audit trail:', error);
      throw error;
    }
  }

  /**
   * Generate audit summary for a time period
   */
  static async generateAuditSummary(startDate, endDate) {
    try {
      const whereClause = {};
      if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) {
          whereClause.timestamp[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.timestamp[Op.lte] = new Date(endDate);
        }
      }

      // Get total operations
      const totalOperations = await AuditLog.count({ where: whereClause });

      // Get operations by type
      const operationsByType = await AuditLog.findAll({
        where: whereClause,
        attributes: [
          'action',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
        ],
        group: ['action'],
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']]
      });

      // Get failed operations
      const failedOperations = await AuditLog.count({
        where: { ...whereClause, success: false }
      });

      // Get most active users
      const activeUsers = await AuditLog.findAll({
        where: {
          ...whereClause,
          userId: { [Op.not]: null }
        },
        attributes: [
          'userId',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'operationCount']
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['username', 'role']
          }
        ],
        group: ['userId', 'user.id', 'user.username', 'user.role'],
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']],
        limit: 10
      });

      return {
        period: { startDate, endDate },
        summary: {
          totalOperations,
          failedOperations,
          successRate: totalOperations > 0 ? ((totalOperations - failedOperations) / totalOperations * 100).toFixed(2) : 0
        },
        operationsByType,
        activeUsers
      };
    } catch (error) {
      console.error('Failed to generate audit summary:', error);
      throw error;
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  static async detectSuspiciousActivity(options = {}) {
    try {
      const { timeWindow = 24, threshold = 100 } = options; // Last 24 hours, 100+ operations
      const cutoffTime = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));

      // Find users with excessive activity
      const suspiciousUsers = await AuditLog.findAll({
        where: {
          timestamp: { [Op.gte]: cutoffTime },
          userId: { [Op.not]: null }
        },
        attributes: [
          'userId',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'operationCount']
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['username', 'role', 'email']
          }
        ],
        group: ['userId', 'user.id', 'user.username', 'user.role', 'user.email'],
        having: AuditLog.sequelize.where(
          AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')),
          Op.gte,
          threshold
        ),
        order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']]
      });

      // Find high failure rates
      const highFailureUsers = await AuditLog.findAll({
        where: {
          timestamp: { [Op.gte]: cutoffTime },
          userId: { [Op.not]: null }
        },
        attributes: [
          'userId',
          [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'totalOperations'],
          [AuditLog.sequelize.fn('SUM', AuditLog.sequelize.literal('CASE WHEN success = false THEN 1 ELSE 0 END')), 'failedOperations']
        ],
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['username', 'role', 'email']
          }
        ],
        group: ['userId', 'user.id', 'user.username', 'user.role', 'user.email'],
        having: AuditLog.sequelize.where(
          AuditLog.sequelize.literal('(SUM(CASE WHEN success = false THEN 1 ELSE 0 END) * 100.0 / COUNT(*))'),
          Op.gte,
          30 // 30% failure rate
        )
      });

      return {
        suspiciousUsers,
        highFailureUsers,
        analysisWindow: `${timeWindow} hours`,
        thresholds: {
          operationCount: threshold,
          failureRate: 30
        }
      };
    } catch (error) {
      console.error('Failed to detect suspicious activity:', error);
      throw error;
    }
  }
}

module.exports = AuditService;