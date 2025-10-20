import React, { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Plus, ArrowLeft } from 'lucide-react'
import Header from '../components/layout/Header'
import RequestList from '../components/requests/RequestList'
import RequestForm from '../components/requests/RequestForm'
import RequestDetails from '../components/requests/RequestDetails'
import { useAuth } from '../hooks/useAuth'

const RequestsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { permissions } = useAuth()
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRequestDetails, setShowRequestDetails] = useState(false)

  const handleNewRequest = () => {
    navigate('/requests/new')
  }

  const handleViewRequest = (request) => {
    setSelectedRequest(request)
    setShowRequestDetails(true)
  }

  const handleCloseRequestDetails = () => {
    setShowRequestDetails(false)
    setSelectedRequest(null)
  }

  const handleRequestUpdate = (updatedRequest) => {
    setSelectedRequest(updatedRequest)
    // Optionally refresh the list or update the specific request in the list
  }

  const handleRequestSaved = (newRequest) => {
    navigate('/requests')
    // Optionally show the new request details
    if (newRequest) {
      setTimeout(() => {
        setSelectedRequest(newRequest)
        setShowRequestDetails(true)
      }, 100)
    }
  }

  const handleFormCancel = () => {
    navigate('/requests')
  }

  const isNewRequestPage = location.pathname === '/requests/new'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Routes>
            <Route 
              path="/" 
              element={
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                          Solicitações
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                          Gerencie solicitações de produtos do inventário
                        </p>
                      </div>
                      {permissions.canRequestProducts && (
                        <button
                          onClick={handleNewRequest}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Nova Solicitação
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Request List */}
                  <RequestList 
                    onViewRequest={handleViewRequest}
                    showFilters={true}
                  />

                  {/* Request Details Modal */}
                  {showRequestDetails && selectedRequest && (
                    <RequestDetails
                      request={selectedRequest}
                      onClose={handleCloseRequestDetails}
                      onUpdate={handleRequestUpdate}
                    />
                  )}
                </>
              } 
            />
            
            <Route 
              path="/new" 
              element={
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-center">
                      <button
                        onClick={handleFormCancel}
                        className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                          Nova Solicitação
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                          Solicite produtos do inventário para uso em procedimentos
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Request Form */}
                  <RequestForm
                    onSave={handleRequestSaved}
                    onCancel={handleFormCancel}
                    isModal={false}
                  />
                </>
              } 
            />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default RequestsPage