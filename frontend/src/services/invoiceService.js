import firebaseService from './firebaseService'
import { ErrorHandler } from '../../../shared/utils/ErrorHandler.ts'
import { AuthErrorStrategy } from '../../../shared/strategies/AuthErrorStrategy.ts'
import { NetworkErrorStrategy } from '../../../shared/strategies/NetworkErrorStrategy.ts'
import { ValidationErrorStrategy } from '../../../shared/strategies/ValidationErrorStrategy.ts'
import { FallbackStrategy } from '../../../shared/strategies/FallbackStrategy.ts'
import { ErrorType } from '../../../shared/types/errorTypes.ts'
import logger, { LogCategory, ErrorType as LogErrorType } from '../utils/logger.js'

// Initialize error handler for service
const errorHandler = new ErrorHandler({
  logLevel: import.meta.env.PROD ? 'error' : 'debug',
  enableRetry: true,
  maxRetries: 3,
  enableFallback: true
})

// Register strategies
errorHandler.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy())
errorHandler.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy())
errorHandler.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy())
Object.values(ErrorType).forEach(type => {
  errorHandler.registerStrategy(type, new FallbackStrategy())
})

const handleServiceError = async (error, context) => {
  const errorContext = {
    component: 'invoiceService',
    action: context.action,
    timestamp: new Date(),
    environment: import.meta.env.PROD ? 'production' : 'development',
    additionalData: context.additionalData
  }

  const processedError = errorHandler.captureError(error, errorContext)
  
  logger.error(`Invoice service error: ${context.action}`, {
    category: LogCategory.API,
    errorType: LogErrorType.BUSINESS_LOGIC,
    processedError: {
      id: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      message: processedError.message
    },
    context: errorContext
  })

  // Try recovery
  const strategy = errorHandler.getRecoveryStrategy(processedError)
  if (strategy && processedError.recoverable) {
    const recoveryResult = await errorHandler.executeRecovery(strategy, processedError)
    if (recoveryResult.success) {
      return { recovered: true, result: recoveryResult }
    }
  }

  throw processedError
}

export const invoiceService = {
  // Get all invoices with optional filters
  getInvoices: async (filters = {}) => {
    try {
      const options = {}

      // Apply filters
      if (filters.supplier || filters.search) {
        options.where = []
        if (filters.supplier) {
          options.where.push(['supplier', '==', filters.supplier])
        }
        if (filters.search) {
          // For search, we'll filter by supplier name or invoice number
          options.where.push(['supplier', '>=', filters.search])
          options.where.push(['supplier', '<=', filters.search + '\uf8ff'])
        }
      }

      // Apply ordering
      options.orderBy = [['receiptDate', 'desc']]

      // Apply pagination
      if (filters.limit) {
        options.limit = parseInt(filters.limit)
      }

      const result = await firebaseService.getAll('invoices', options)

      if (!result.success) {
        throw new Error(result.error)
      }

      // Filter by date range if specified
      let invoices = result.data
      if (filters.startDate || filters.endDate) {
        invoices = invoices.filter(invoice => {
          const receiptDate = new Date(invoice.receiptDate)
          if (filters.startDate && receiptDate < new Date(filters.startDate)) {
            return false
          }
          if (filters.endDate && receiptDate > new Date(filters.endDate)) {
            return false
          }
          return true
        })
      }

      return {
        invoices,
        total: invoices.length,
        page: filters.page || 1,
        totalPages: Math.ceil(invoices.length / (filters.limit || 10))
      }
    } catch (error) {
      await handleServiceError(error, {
        action: 'getInvoices',
        additionalData: { filters }
      })
    }
  },

  // Get single invoice by ID
  getInvoice: async (id) => {
    try {
      const result = await firebaseService.getById('invoices', id)

      if (!result.success) {
        throw new Error(result.error)
      }

      return { invoice: result.data }
    } catch (error) {
      await handleServiceError(error, {
        action: 'getInvoice',
        additionalData: { id }
      })
    }
  },

  // Create new invoice
  createInvoice: async (invoiceData) => {
    try {
      const invoiceWithTimestamp = {
        ...invoiceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const result = await firebaseService.create('invoices', invoiceWithTimestamp)

      if (!result.success) {
        throw new Error(result.error)
      }

      return { invoice: result.data }
    } catch (error) {
      await handleServiceError(error, {
        action: 'createInvoice',
        additionalData: { invoiceData }
      })
    }
  },

  // Update invoice
  updateInvoice: async (id, invoiceData) => {
    try {
      const updateData = {
        ...invoiceData,
        updatedAt: new Date().toISOString()
      }

      const result = await firebaseService.update('invoices', id, updateData)

      if (!result.success) {
        throw new Error(result.error)
      }

      return { invoice: result.data }
    } catch (error) {
      await handleServiceError(error, {
        action: 'updateInvoice',
        additionalData: { id, invoiceData }
      })
    }
  },

  // Delete invoice
  deleteInvoice: async (id) => {
    try {
      const result = await firebaseService.delete('invoices', id)

      if (!result.success) {
        throw new Error(result.error)
      }

      return { success: true }
    } catch (error) {
      await handleServiceError(error, {
        action: 'deleteInvoice',
        additionalData: { id }
      })
    }
  },

  // Get products associated with invoice
  getInvoiceProducts: async (id) => {
    try {
      // Get the invoice first
      const invoiceResult = await firebaseService.getById('invoices', id)

      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error)
      }

      // Get products associated with this invoice
      const productsResult = await firebaseService.getAll('products', {
        where: [['invoiceId', '==', id]],
        orderBy: [['name', 'asc']]
      })

      if (!productsResult.success) {
        throw new Error(productsResult.error)
      }

      return {
        invoice: invoiceResult.data,
        products: productsResult.data
      }
    } catch (error) {
      await handleServiceError(error, {
        action: 'getInvoiceProducts',
        additionalData: { id }
      })
    }
  },

  // Generate purchase report by period
  getPurchaseReport: async (startDate, endDate, supplier = null) => {
    try {
      const options = {
        orderBy: [['receiptDate', 'desc']]
      }

      if (supplier) {
        options.where = [['supplier', '==', supplier]]
      }

      const result = await firebaseService.getAll('invoices', options)

      if (!result.success) {
        throw new Error(result.error)
      }

      // Filter by date range
      const filteredInvoices = result.data.filter(invoice => {
        const receiptDate = new Date(invoice.receiptDate)
        return receiptDate >= new Date(startDate) && receiptDate <= new Date(endDate)
      })

      // Calculate totals
      const totalValue = filteredInvoices.reduce((sum, invoice) => sum + (invoice.totalValue || 0), 0)
      const totalInvoices = filteredInvoices.length

      // Group by supplier
      const supplierSummary = filteredInvoices.reduce((acc, invoice) => {
        const supplier = invoice.supplier
        if (!acc[supplier]) {
          acc[supplier] = {
            supplier,
            invoiceCount: 0,
            totalValue: 0
          }
        }
        acc[supplier].invoiceCount++
        acc[supplier].totalValue += invoice.totalValue || 0
        return acc
      }, {})

      return {
        invoices: filteredInvoices,
        summary: {
          totalInvoices,
          totalValue,
          averageValue: totalInvoices > 0 ? totalValue / totalInvoices : 0,
          supplierSummary: Object.values(supplierSummary)
        }
      }
    } catch (error) {
      await handleServiceError(error, {
        action: 'getPurchaseReport',
        additionalData: { startDate, endDate, supplier }
      })
    }
  }
}