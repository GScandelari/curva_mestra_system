import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/layout/Header'
import InvoiceList from '../components/invoices/InvoiceList'
import InvoiceForm from '../components/invoices/InvoiceForm'
import InvoiceProducts from '../components/invoices/InvoiceProducts'
import PurchaseReport from '../components/invoices/PurchaseReport'
import ProductSearch from '../components/invoices/ProductSearch'
import { useAuth } from '../contexts/AuthContext'

const InvoicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentView, setCurrentView] = useState(searchParams.get('view') || 'list')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showModal, setShowModal] = useState(false)
  
  const { hasPermission } = useAuth()

  const handleViewChange = (view) => {
    setCurrentView(view)
    setSearchParams({ view })
    setSelectedInvoice(null)
  }

  const handleCreateInvoice = () => {
    setSelectedInvoice(null)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleEditInvoice = (invoice) => {
    setSelectedInvoice(invoice)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleViewInvoiceProducts = (invoice) => {
    setSelectedInvoice(invoice)
    setCurrentView('products')
  }

  const handleSaveInvoice = () => {
    setShowModal(false)
    setSelectedInvoice(null)
    
    // If we're in form view, go back to list
    if (currentView === 'form') {
      setCurrentView('list')
    }
    
    // Refresh the current view data
    window.location.reload()
  }

  const handleCancelForm = () => {
    setShowModal(false)
    setSelectedInvoice(null)
    
    if (currentView === 'form') {
      setCurrentView('list')
    }
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedInvoice(null)
  }

  const renderContent = () => {
    switch (currentView) {
      case 'list':
        return (
          <InvoiceList
            onEditInvoice={handleEditInvoice}
            onCreateInvoice={handleCreateInvoice}
            onViewProducts={handleViewInvoiceProducts}
          />
        )
      
      case 'form':
        return (
          <InvoiceForm
            invoice={selectedInvoice}
            onSave={handleSaveInvoice}
            onCancel={handleCancelForm}
            isModal={false}
          />
        )
      
      case 'products':
        return (
          <InvoiceProducts
            invoice={selectedInvoice}
            onBack={handleBackToList}
          />
        )
      
      case 'reports':
        return <PurchaseReport />
      
      case 'search':
        return <ProductSearch />
      
      default:
        return (
          <InvoiceList
            onEditInvoice={handleEditInvoice}
            onCreateInvoice={handleCreateInvoice}
            onViewProducts={handleViewInvoiceProducts}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => handleViewChange('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Lista de Notas Fiscais
              </button>
              
              {hasPermission('manage_invoices') && (
                <button
                  onClick={() => handleViewChange('form')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    currentView === 'form'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {selectedInvoice ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
                </button>
              )}
              
              <button
                onClick={() => handleViewChange('search')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'search'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Buscar Produtos
              </button>
              
              <button
                onClick={() => handleViewChange('reports')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'reports'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Relatórios
              </button>

              {currentView === 'products' && selectedInvoice && (
                <button
                  className="py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm"
                >
                  Produtos da NF {selectedInvoice.number}
                </button>
              )}
            </nav>
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </main>

      {/* Modal for Invoice Form */}
      {showModal && (
        <InvoiceForm
          invoice={selectedInvoice}
          onSave={handleSaveInvoice}
          onCancel={handleCancelForm}
          isModal={true}
        />
      )}
    </div>
  )
}

export default InvoicesPage