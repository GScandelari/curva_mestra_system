import React, { useState, useEffect } from 'react'
import { 
  X, 
  CheckCircle, 
  XCircle, 
  Package, 
  User, 
  Calendar,
  FileText,
  AlertCircle,
  Clock
} from 'lucide-react'
import { toast } from 'react-toastify'
import { requestService } from '../../services'
import { useAuth } from '../../hooks/useAuth'
import { useNotifications } from '../../contexts/NotificationContext'

const RequestDetails = ({ request: initialRequest, onClose, onUpdate }) => {
  const { user, permissions } = useAuth()
  const { notifyRequestStatusChange } = useNotifications()
  const [request, setRequest] = useState(initialRequest)
  const [loading, setLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    if (initialRequest?.id) {
      loadRequestDetails()
    }
  }, [initialRequest?.id])

  const loadRequestDetails = async () => {
    try {
      setLoading(true)
      const data = await requestService.getRequestById(initialRequest.id)
      setRequest(data.request)
    } catch (error) {
      console.error('Error loading request details:', error)
      toast.error('Erro ao carregar detalhes da solicitação')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setLoading(true)
      const data = await requestService.approveRequest(request.id)
      setRequest(data.request)
      toast.success('Solicitação aprovada com sucesso!')
      
      // Notify the requester if it's not the current user
      if (data.request.requesterId !== user.id) {
        notifyRequestStatusChange(data.request.id, 'approved', data.request.requester?.username)
      }
      
      onUpdate && onUpdate(data.request)
    } catch (error) {
      console.error('Error approving request:', error)
      const message = error.response?.data?.error || 'Erro ao aprovar solicitação'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Motivo da rejeição é obrigatório')
      return
    }

    try {
      setLoading(true)
      const data = await requestService.rejectRequest(request.id, rejectReason)
      setRequest(data.request)
      setShowRejectModal(false)
      setRejectReason('')
      toast.success('Solicitação rejeitada com sucesso!')
      
      // Notify the requester if it's not the current user
      if (data.request.requesterId !== user.id) {
        notifyRequestStatusChange(data.request.id, 'rejected', data.request.requester?.username)
      }
      
      onUpdate && onUpdate(data.request)
    } catch (error) {
      console.error('Error rejecting request:', error)
      const message = error.response?.data?.error || 'Erro ao rejeitar solicitação'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleFulfill = async () => {
    try {
      setLoading(true)
      const data = await requestService.fulfillRequest(request.id)
      setRequest(data.request)
      toast.success('Solicitação marcada como atendida!')
      
      // Notify the requester if it's not the current user
      if (data.request.requesterId !== user.id) {
        notifyRequestStatusChange(data.request.id, 'fulfilled', data.request.requester?.username)
      }
      
      onUpdate && onUpdate(data.request)
    } catch (error) {
      console.error('Error fulfilling request:', error)
      const message = error.response?.data?.error || 'Erro ao marcar solicitação como atendida'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-6 w-6 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-6 w-6 text-green-500" />
      case 'rejected':
        return <XCircle className="h-6 w-6 text-red-500" />
      case 'fulfilled':
        return <Package className="h-6 w-6 text-blue-500" />
      default:
        return <Clock className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pendente'
      case 'approved':
        return 'Aprovada'
      case 'rejected':
        return 'Rejeitada'
      case 'fulfilled':
        return 'Atendida'
      default:
        return status
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'fulfilled':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const canApprove = permissions.canApproveRequests && request?.status === 'pending'
  const canFulfill = (permissions.canApproveRequests || user.role === 'doctor') && request?.status === 'approved'

  if (loading && !request) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-semibold text-gray-900">
                Solicitação #{request?.id?.slice(-8)}
              </h3>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(request?.status)}`}>
                {getStatusIcon(request?.status)}
                <span className="ml-2">{getStatusText(request?.status)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Request Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Requester Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Solicitante
              </h4>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Nome:</span> {request?.requester?.username}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Email:</span> {request?.requester?.email}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Função:</span> {request?.requester?.role}
                </p>
              </div>
            </div>

            {/* Request Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Detalhes da Solicitação
              </h4>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Data:</span> {formatDate(request?.requestDate)}
                </p>
                {request?.approvalDate && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Data de Aprovação:</span> {formatDate(request?.approvalDate)}
                  </p>
                )}
                {request?.approver && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Aprovado por:</span> {request?.approver?.username}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Patient Info */}
          {request?.patient && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Paciente Associado
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Nome:</span> {request?.patient?.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Email:</span> {request?.patient?.email}
                </p>
              </div>
            </div>
          )}

          {/* Products */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Produtos Solicitados
            </h4>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estoque Atual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {request?.requestedProducts?.map((rp, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {rp.product?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rp.quantity} {rp.product?.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          rp.product?.currentStock < rp.quantity 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-900'
                        }`}>
                          {rp.product?.currentStock} {rp.product?.unit}
                          {rp.product?.currentStock < rp.quantity && (
                            <span className="ml-1 text-red-500">
                              <AlertCircle className="h-4 w-4 inline" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {rp.reason}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {request?.notes && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Observações
              </h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {request?.notes}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              Fechar
            </button>
            
            {canFulfill && (
              <button
                onClick={handleFulfill}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Marcar como Atendida
                  </>
                )}
              </button>
            )}

            {canApprove && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <XCircle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">
                  Rejeitar Solicitação
                </h3>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo da rejeição *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="Explique o motivo da rejeição..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Rejeitando...' : 'Rejeitar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default RequestDetails