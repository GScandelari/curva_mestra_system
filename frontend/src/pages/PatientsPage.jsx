import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/layout/Header'
import PatientList from '../components/patients/PatientList'
import PatientForm from '../components/patients/PatientForm'
import PatientDetails from '../components/patients/PatientDetails'
import { useAuth } from '../contexts/AuthContext'

const PatientsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentView, setCurrentView] = useState(searchParams.get('view') || 'list')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const { hasPermission } = useAuth()

  const handleViewChange = (view) => {
    setCurrentView(view)
    setSearchParams({ view })
  }

  const handleCreatePatient = () => {
    setSelectedPatient(null)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleEditPatient = (patient) => {
    setSelectedPatient(patient)
    setShowDetails(false)
    if (currentView === 'list') {
      setShowModal(true)
    } else {
      setCurrentView('form')
    }
  }

  const handleViewPatient = (patient) => {
    setSelectedPatient(patient)
    setShowDetails(true)
  }

  const handleSavePatient = (patient) => {
    setShowModal(false)
    setSelectedPatient(null)
    
    // If we're in form view, go back to list
    if (currentView === 'form') {
      setCurrentView('list')
    }
    
    // Trigger refresh of the patient list
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCancelForm = () => {
    setShowModal(false)
    setSelectedPatient(null)
    
    if (currentView === 'form') {
      setCurrentView('list')
    }
  }

  const handleCloseDetails = () => {
    setShowDetails(false)
    setSelectedPatient(null)
  }

  const renderContent = () => {
    switch (currentView) {
      case 'list':
        return (
          <PatientList
            onEditPatient={handleEditPatient}
            onCreatePatient={handleCreatePatient}
            onViewPatient={handleViewPatient}
            refreshTrigger={refreshTrigger}
          />
        )
      
      case 'form':
        return (
          <PatientForm
            patient={selectedPatient}
            onSave={handleSavePatient}
            onCancel={handleCancelForm}
            isModal={false}
          />
        )
      
      default:
        return (
          <PatientList
            onEditPatient={handleEditPatient}
            onCreatePatient={handleCreatePatient}
            onViewPatient={handleViewPatient}
            refreshTrigger={refreshTrigger}
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
                Lista de Pacientes
              </button>
              
              {hasPermission('manage_patients') && (
                <button
                  onClick={() => handleViewChange('form')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    currentView === 'form'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {selectedPatient ? 'Editar Paciente' : 'Novo Paciente'}
                </button>
              )}
            </nav>
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </main>

      {/* Modal for Patient Form */}
      {showModal && (
        <PatientForm
          patient={selectedPatient}
          onSave={handleSavePatient}
          onCancel={handleCancelForm}
          isModal={true}
        />
      )}

      {/* Patient Details Modal */}
      {showDetails && selectedPatient && (
        <PatientDetails
          patient={selectedPatient}
          onEdit={handleEditPatient}
          onClose={handleCloseDetails}
        />
      )}
    </div>
  )
}

export default PatientsPage