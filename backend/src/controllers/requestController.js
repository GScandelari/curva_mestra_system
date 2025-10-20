const { 
  ProductRequest, 
  RequestedProduct, 
  Product, 
  User, 
  Patient, 
  StockMovement,
  sequelize 
} = require('../models');
const { validateRequest } = require('../utils/validation');
const AuditService = require('../services/auditService');
const NotificationService = require('../services/notificationService');

class RequestController {
  // Create a new product request
  async createRequest(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { products, patientId, notes } = req.body;
      const requesterId = req.user.id;

      // Validate request data
      const validation = validateRequest({
        products,
        patientId,
        notes,
        requesterId
      });

      if (!validation.isValid) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Dados de solicitação inválidos',
          details: validation.errors
        });
      }

      // Validate that all products exist and have sufficient stock
      for (const item of products) {
        const product = await Product.findByPk(item.productId);
        if (!product) {
          await transaction.rollback();
          return res.status(404).json({
            error: `Produto não encontrado: ${item.productId}`
          });
        }

        if (product.currentStock < item.quantity) {
          await transaction.rollback();
          return res.status(400).json({
            error: `Estoque insuficiente para o produto ${product.name}. Disponível: ${product.currentStock}, Solicitado: ${item.quantity}`
          });
        }

        // Check if product is expired
        if (product.isExpired) {
          await transaction.rollback();
          return res.status(400).json({
            error: `Produto ${product.name} está vencido e não pode ser solicitado`
          });
        }
      }

      // Validate patient exists if provided
      if (patientId) {
        const patient = await Patient.findByPk(patientId);
        if (!patient) {
          await transaction.rollback();
          return res.status(404).json({
            error: 'Paciente não encontrado'
          });
        }
      }

      // Create the request
      const request = await ProductRequest.create({
        requesterId,
        patientId,
        notes,
        status: 'pending'
      }, { transaction });

      // Create requested products
      const requestedProducts = await Promise.all(
        products.map(item => 
          RequestedProduct.create({
            requestId: request.id,
            productId: item.productId,
            quantity: item.quantity,
            reason: item.reason
          }, { transaction })
        )
      );

      await transaction.commit();

      // Fetch the complete request with associations
      const completeRequest = await ProductRequest.findByPk(request.id, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ]
      });

      // Notify managers about new pending request
      const managers = await User.findAll({
        where: {
          role: ['admin', 'manager'],
          isActive: true
        },
        attributes: ['id']
      });

      if (managers.length > 0) {
        const managerIds = managers.map(manager => manager.id);
        await NotificationService.notifyPendingRequests(
          request.id,
          requesterId,
          managerIds
        );
      }

      res.status(201).json({
        message: 'Solicitação criada com sucesso',
        request: completeRequest
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao criar solicitação:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all requests with filtering options
  async getRequests(req, res) {
    try {
      const { 
        status, 
        requesterId, 
        patientId, 
        page = 1, 
        limit = 10,
        startDate,
        endDate
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      // Apply filters
      if (status) where.status = status;
      if (requesterId) where.requesterId = requesterId;
      if (patientId) where.patientId = patientId;
      
      if (startDate || endDate) {
        where.requestDate = {};
        if (startDate) where.requestDate[sequelize.Op.gte] = new Date(startDate);
        if (endDate) where.requestDate[sequelize.Op.lte] = new Date(endDate);
      }

      const { count, rows: requests } = await ProductRequest.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ],
        order: [['requestDate', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      res.json({
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get a specific request by ID
  async getRequestById(req, res) {
    try {
      const { id } = req.params;

      const request = await ProductRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email', 'phone']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock', 'expirationDate']
            }]
          },
          {
            model: StockMovement,
            as: 'stockMovements',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit']
            }]
          }
        ]
      });

      if (!request) {
        return res.status(404).json({
          error: 'Solicitação não encontrada'
        });
      }

      res.json({ request });

    } catch (error) {
      console.error('Erro ao buscar solicitação:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Approve a request
  async approveRequest(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const approverId = req.user.id;

      const request = await ProductRequest.findByPk(id, {
        include: [{
          model: RequestedProduct,
          as: 'requestedProducts',
          include: [{
            model: Product,
            as: 'product'
          }]
        }]
      });

      if (!request) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Solicitação não encontrada'
        });
      }

      if (request.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          error: `Solicitação já foi processada. Status atual: ${request.status}`
        });
      }

      // Check if user has permission to approve (admin or manager)
      if (!['admin', 'manager'].includes(req.user.role)) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Permissão insuficiente para aprovar solicitações'
        });
      }

      // Verify stock availability again
      for (const requestedProduct of request.requestedProducts) {
        const currentProduct = await Product.findByPk(requestedProduct.productId, { transaction });
        
        if (currentProduct.currentStock < requestedProduct.quantity) {
          await transaction.rollback();
          return res.status(400).json({
            error: `Estoque insuficiente para ${currentProduct.name}. Disponível: ${currentProduct.currentStock}, Solicitado: ${requestedProduct.quantity}`
          });
        }
      }

      // Update request status
      await request.update({
        status: 'approved',
        approverId,
        approvalDate: new Date()
      }, { transaction });

      // Deduct stock and create stock movements
      for (const requestedProduct of request.requestedProducts) {
        const product = requestedProduct.product;
        
        // Update product stock
        await product.update({
          currentStock: product.currentStock - requestedProduct.quantity
        }, { transaction });

        // Create stock movement record
        const stockMovement = await StockMovement.create({
          productId: product.id,
          movementType: 'exit',
          quantity: -requestedProduct.quantity, // Negative for exit
          userId: approverId,
          patientId: request.patientId,
          requestId: request.id,
          notes: `Aprovação da solicitação ${request.id}`
        }, { transaction });

        // Log stock movement audit
        await AuditService.logStockMovement({
          productId: product.id,
          movementType: 'exit',
          quantity: -requestedProduct.quantity,
          userId: approverId,
          patientId: request.patientId,
          requestId: request.id,
          notes: `Aprovação da solicitação ${request.id}`
        }, req);
      }

      await transaction.commit();

      // Fetch updated request
      const updatedRequest = await ProductRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ]
      });

      // Send notification to requester
      await NotificationService.notifyRequestStatusChange(
        request.id,
        'approved',
        request.requesterId,
        approverId
      );

      res.json({
        message: 'Solicitação aprovada com sucesso',
        request: updatedRequest
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao aprovar solicitação:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Reject a request
  async rejectRequest(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const approverId = req.user.id;

      const request = await ProductRequest.findByPk(id);

      if (!request) {
        return res.status(404).json({
          error: 'Solicitação não encontrada'
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          error: `Solicitação já foi processada. Status atual: ${request.status}`
        });
      }

      // Check if user has permission to reject (admin or manager)
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Permissão insuficiente para rejeitar solicitações'
        });
      }

      await request.update({
        status: 'rejected',
        approverId,
        approvalDate: new Date(),
        notes: reason ? `${request.notes || ''}\nRejeitada: ${reason}` : request.notes
      });

      // Fetch updated request
      const updatedRequest = await ProductRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ]
      });

      // Send notification to requester
      await NotificationService.notifyRequestStatusChange(
        request.id,
        'rejected',
        request.requesterId,
        approverId
      );

      res.json({
        message: 'Solicitação rejeitada com sucesso',
        request: updatedRequest
      });

    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark request as fulfilled
  async fulfillRequest(req, res) {
    try {
      const { id } = req.params;

      const request = await ProductRequest.findByPk(id);

      if (!request) {
        return res.status(404).json({
          error: 'Solicitação não encontrada'
        });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({
          error: `Apenas solicitações aprovadas podem ser marcadas como atendidas. Status atual: ${request.status}`
        });
      }

      await request.update({
        status: 'fulfilled'
      });

      // Fetch updated request
      const updatedRequest = await ProductRequest.findByPk(id, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ]
      });

      res.json({
        message: 'Solicitação marcada como atendida',
        request: updatedRequest
      });

    } catch (error) {
      console.error('Erro ao marcar solicitação como atendida:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get requests by user (for tracking user's own requests)
  async getUserRequests(req, res) {
    try {
      const { userId } = req.params;
      const { status, page = 1, limit = 10 } = req.query;

      // Check if user can access these requests
      if (req.user.id !== userId && !['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Permissão insuficiente para acessar solicitações de outro usuário'
        });
      }

      const offset = (page - 1) * limit;
      const where = { requesterId: userId };
      
      if (status) where.status = status;

      const { count, rows: requests } = await ProductRequest.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'email', 'role']
          },
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'name', 'email']
          },
          {
            model: RequestedProduct,
            as: 'requestedProducts',
            include: [{
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit', 'currentStock']
            }]
          }
        ],
        order: [['requestDate', 'DESC']],
        limit: parseInt(limit),
        offset
      });

      res.json({
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Erro ao buscar solicitações do usuário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = new RequestController();