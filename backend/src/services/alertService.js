const { Product, User } = require('../models');
const { Op } = require('sequelize');
const NotificationService = require('./notificationService');

/**
 * Alert service for managing product alerts and notifications
 */
class AlertService {
  /**
   * Get all active alerts
   */
  static async getActiveAlerts() {
    try {
      const alerts = [];

      // Get expiring products (within 30 days)
      const expiringProducts = await this.getExpiringProductsAlert();
      if (expiringProducts.length > 0) {
        alerts.push({
          type: 'expiring_products',
          severity: 'warning',
          title: 'Produtos próximos ao vencimento',
          message: `${expiringProducts.length} produto(s) vencem em até 30 dias`,
          count: expiringProducts.length,
          data: expiringProducts
        });
      }

      // Get low stock products
      const lowStockProducts = await this.getLowStockAlert();
      if (lowStockProducts.length > 0) {
        alerts.push({
          type: 'low_stock',
          severity: 'warning',
          title: 'Produtos com estoque baixo',
          message: `${lowStockProducts.length} produto(s) com estoque abaixo do mínimo`,
          count: lowStockProducts.length,
          data: lowStockProducts
        });
      }

      // Get expired products
      const expiredProducts = await this.getExpiredProductsAlert();
      if (expiredProducts.length > 0) {
        alerts.push({
          type: 'expired_products',
          severity: 'error',
          title: 'Produtos vencidos',
          message: `${expiredProducts.length} produto(s) vencido(s) no estoque`,
          count: expiredProducts.length,
          data: expiredProducts
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error getting active alerts:', error);
      throw error;
    }
  }

  /**
   * Get products expiring within specified days
   */
  static async getExpiringProductsAlert(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await Product.findAll({
      where: {
        expirationDate: {
          [Op.between]: [new Date(), futureDate]
        },
        currentStock: {
          [Op.gt]: 0
        }
      },
      attributes: ['id', 'name', 'currentStock', 'expirationDate', 'category'],
      order: [['expirationDate', 'ASC']]
    });
  }

  /**
   * Get products with low stock
   */
  static async getLowStockAlert() {
    const sequelize = require('../config/database');
    
    return await Product.findAll({
      where: sequelize.where(
        sequelize.col('current_stock'),
        Op.lte,
        sequelize.col('minimum_stock')
      ),
      attributes: ['id', 'name', 'currentStock', 'minimumStock', 'category'],
      order: [['currentStock', 'ASC']]
    });
  }

  /**
   * Get expired products with stock
   */
  static async getExpiredProductsAlert() {
    return await Product.findAll({
      where: {
        expirationDate: {
          [Op.lt]: new Date()
        },
        currentStock: {
          [Op.gt]: 0
        }
      },
      attributes: ['id', 'name', 'currentStock', 'expirationDate', 'category'],
      order: [['expirationDate', 'ASC']]
    });
  }

  /**
   * Check if product needs alert
   */
  static async checkProductAlerts(productId) {
    const product = await Product.findByPk(productId);
    if (!product) return [];

    const alerts = [];

    // Check if expired
    if (product.isExpired && product.currentStock > 0) {
      alerts.push({
        type: 'expired',
        severity: 'error',
        message: 'Produto vencido com estoque disponível'
      });
    }

    // Check if expiring soon
    if (product.daysToExpiration <= 30 && product.daysToExpiration > 0) {
      alerts.push({
        type: 'expiring_soon',
        severity: 'warning',
        message: `Produto vence em ${product.daysToExpiration} dias`
      });
    }

    // Check if low stock
    if (product.isLowStock) {
      alerts.push({
        type: 'low_stock',
        severity: 'warning',
        message: `Estoque baixo: ${product.currentStock}/${product.minimumStock}`
      });
    }

    return alerts;
  }

  /**
   * Get alert summary for dashboard
   */
  static async getAlertSummary() {
    try {
      const [expiringCount, lowStockCount, expiredCount] = await Promise.all([
        Product.count({
          where: {
            expirationDate: {
              [Op.between]: [new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
            },
            currentStock: { [Op.gt]: 0 }
          }
        }),
        Product.count({
          where: require('../config/database').where(
            require('../config/database').col('current_stock'),
            Op.lte,
            require('../config/database').col('minimum_stock')
          )
        }),
        Product.count({
          where: {
            expirationDate: { [Op.lt]: new Date() },
            currentStock: { [Op.gt]: 0 }
          }
        })
      ]);

      return {
        expiring: expiringCount,
        lowStock: lowStockCount,
        expired: expiredCount,
        total: expiringCount + lowStockCount + expiredCount
      };
    } catch (error) {
      console.error('Error getting alert summary:', error);
      throw error;
    }
  }

  /**
   * Check and create automatic alert notifications
   */
  static async checkAndCreateAlertNotifications() {
    try {
      console.log('Checking for alert conditions...');
      
      const alerts = await this.getActiveAlerts();
      
      if (alerts.length === 0) {
        console.log('No active alerts found');
        return { alertsProcessed: 0, notificationsCreated: 0 };
      }

      // Get users who should receive alerts (managers and admins)
      const users = await User.findAll({
        where: {
          role: ['admin', 'manager'],
          isActive: true
        },
        attributes: ['id']
      });

      const userIds = users.map(user => user.id);
      let totalNotifications = 0;

      // Create notifications for each alert type
      for (const alert of alerts) {
        // Only create notifications for critical alerts to avoid spam
        if (alert.severity === 'error' || alert.count >= 5) {
          const notifications = await NotificationService.createBulkNotifications(
            userIds,
            {
              type: alert.type,
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
              data: alert.data,
              sendEmail: alert.severity === 'error'
            }
          );
          totalNotifications += notifications.length;
          console.log(`Created ${notifications.length} notifications for ${alert.type}`);
        }
      }

      console.log(`Alert check completed: ${alerts.length} alerts processed, ${totalNotifications} notifications created`);
      
      return {
        alertsProcessed: alerts.length,
        notificationsCreated: totalNotifications
      };
    } catch (error) {
      console.error('Error checking and creating alert notifications:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic alert checking
   */
  static startAlertScheduler() {
    // Check for alerts every hour
    const ALERT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

    console.log('Starting alert scheduler...');
    
    // Run initial check
    this.checkAndCreateAlertNotifications().catch(error => {
      console.error('Error in initial alert check:', error);
    });

    // Schedule periodic checks
    setInterval(() => {
      this.checkAndCreateAlertNotifications().catch(error => {
        console.error('Error in scheduled alert check:', error);
      });
    }, ALERT_CHECK_INTERVAL);

    console.log(`Alert scheduler started - checking every ${ALERT_CHECK_INTERVAL / 1000 / 60} minutes`);
  }
}

module.exports = AlertService;