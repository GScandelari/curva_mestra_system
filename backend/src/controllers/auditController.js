const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');
const { validateAuditQuery } = require('../utils/validation');
const auditBackupService = require('../services/auditBackupService');

/**
 * Get audit logs with filtering and pagination
 */
const getAuditLogs = async (req, res) => {
  try {
    const { error, value } = validateAuditQuery(req.query);
    if (error) {
      return res.status(400).json({ 
        error: 'Parâmetros de consulta inválidos',
        details: error.details.map(d => d.message)
      });
    }

    const {
      page = 1,
      limit = 50,
      userId,
      action,
      resource,
      resourceId,
      success,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'DESC'
    } = value;

    // Build where clause
    const whereClause = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (action) {
      if (Array.isArray(action)) {
        whereClause.action = { [Op.in]: action };
      } else {
        whereClause.action = action;
      }
    }

    if (resource) {
      if (Array.isArray(resource)) {
        whereClause.resource = { [Op.in]: resource };
      } else {
        whereClause.resource = resource;
      }
    }

    if (resourceId) {
      whereClause.resourceId = resourceId;
    }

    if (success !== undefined) {
      whereClause.success = success;
    }

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.timestamp[Op.lte] = new Date(endDate);
      }
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Query audit logs
    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'role'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      auditLogs: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar logs de auditoria' 
    });
  }
};

/**
 * Get audit log by ID
 */
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await AuditLog.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'role'],
          required: false
        }
      ]
    });

    if (!auditLog) {
      return res.status(404).json({ 
        error: 'Log de auditoria não encontrado' 
      });
    }

    res.json(auditLog);

  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar log de auditoria' 
    });
  }
};

/**
 * Get audit statistics
 */
const getAuditStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

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

    // Get action statistics
    const actionStats = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        'action',
        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
      ],
      group: ['action'],
      order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']]
    });

    // Get resource statistics
    const resourceStats = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        'resource',
        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
      ],
      group: ['resource'],
      order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']]
    });

    // Get success/failure statistics
    const successStats = await AuditLog.findAll({
      where: whereClause,
      attributes: [
        'success',
        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
      ],
      group: ['success']
    });

    // Get user activity statistics
    const userStats = await AuditLog.findAll({
      where: {
        ...whereClause,
        userId: { [Op.not]: null }
      },
      attributes: [
        'userId',
        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count']
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'role'],
          required: true
        }
      ],
      group: ['userId', 'user.id', 'user.username', 'user.role'],
      order: [[AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'DESC']],
      limit: 10
    });

    res.json({
      actionStats,
      resourceStats,
      successStats,
      userStats
    });

  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar estatísticas de auditoria' 
    });
  }
};

/**
 * Get user activity timeline
 */
const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate 
    } = req.query;

    const whereClause = { userId };

    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) {
        whereClause.timestamp[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.timestamp[Op.lte] = new Date(endDate);
      }
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'role'],
          required: true
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      activities: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar atividade do usuário' 
    });
  }
};

/**
 * Get resource history
 */
const getResourceHistory = async (req, res) => {
  try {
    const { resource, resourceId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const whereClause = {
      resource: resource.toUpperCase(),
      resourceId
    };

    const offset = (page - 1) * limit;

    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email', 'role'],
          required: false
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      history: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching resource history:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar histórico do recurso' 
    });
  }
};

/**
 * Trigger manual backup
 */
const triggerBackup = async (req, res) => {
  try {
    const result = await auditBackupService.triggerManualBackup();
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao executar backup' 
    });
  }
};

/**
 * Get backup status
 */
const getBackupStatus = async (req, res) => {
  try {
    const status = await auditBackupService.getBackupStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar status do backup' 
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  getAuditStats,
  getUserActivity,
  getResourceHistory,
  triggerBackup,
  getBackupStatus
};