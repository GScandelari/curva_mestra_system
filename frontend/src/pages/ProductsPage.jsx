import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/layout/Header'
import ProductDashboard from '../components/products/ProductDashboard'
import ProductList from '../components/products/ProductList'
import ProductForm from '../components/products/ProductForm'
import { useAuth } from '../contexts/AuthContext'

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentView, setCurrentView] = useState(searchParams.get('view') || 'dashboard')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  
  const { hasPermission } = useAuth()

  const handleViewChange = (view) => {
    setCurrentView(view)
    setSearchParams({ view })
  }

  const handleCreateProduct = () => {
    setSelectedProduct(null)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleEditProduct = (product) => {
    setSelectedProduct(product)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleViewProduct = (product) => {
    // For now, just edit the product
    handleEditProduct(product)
  }

  const handleSaveProduct = (product) => {
    setShowModal(false)
    setSelectedProduct(null)
    
    // If we're in form view, go back to list
    if (currentView === 'form') {
      setCurrentView('list')
    }
    
    // Refresh the current view data
    window.location.reload()
  }

  const handleCancelForm = () => {
    setShowModal(false)
    setSelectedProduct(null)
    
    if (currentView === 'form') {
      setCurrentView('list')
    }
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <ProductDashboard
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
          />
        )
      
      case 'list':
        return (
          <ProductList
            onEditProduct={handleEditProduct}
            onCreateProduct={handleCreateProduct}
          />
        )
      
      case 'form':
        return (
          <ProductForm
            product={selectedProduct}
            onSave={handleSaveProduct}
            onCancel={handleCancelForm}
            isModal={false}
          />
        )
      
      default:
        return (
          <ProductDashboard
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
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
                onClick={() => handleViewChange('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              
              <button
                onClick={() => handleViewChange('list')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentView === 'list'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Lista de Produtos
              </button>
              
              {hasPermission('manage_products') && (
                <button
                  onClick={() => handleViewChange('form')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    currentView === 'form'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {selectedProduct ? 'Editar Produto' : 'Novo Produto'}
                </button>
              )}
            </nav>
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </main>

      {/* Modal for Product Form */}
      {showModal && (
        <ProductForm
          product={selectedProduct}
          onSave={handleSaveProduct}
          onCancel={handleCancelForm}
          isModal={true}
        />
      )}
    </div>
  )
}

export default ProductsPage