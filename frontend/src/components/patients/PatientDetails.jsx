import React, { useState, useEffect } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  FileText, 
  Plus,
  Edit,
  Trash2,
  Package,
  Activity,
  BarChart3,
  X
} from 'lucide-react'
import { toast } from 'react-toastify'
import { patientService, productService } from '../../services'
import { useAuth } from '../../contexts/AuthContext'
import TreatmentForm from './TreatmentForm'
import PatientConsumptionReport from './PatientConsumptionReport'

const PatientDetails = ({ patient, onEdit, onClose }) => {
  const [treatments, setTreatments] = useState([])
  const [isLoadingTreatments, setIsLoadingTreatments] = useState(true)
  const [showTreatmentForm, setShowTreatmentForm] = useState(false)
  const [selectedTreatment, setSelectedTreatment] = useState(null)
  const [showConsumptionReport, setShowConsumptionReport] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  
  const { hasPermission } = useAuth()

  useEffect(() => {
    if (patient) {
      loadTreatments()
    }
  }, [patient])

  const loadTreatments = async () => {
    setIsLoadingTreatments(true)
    try {
      const data = await patientService.getPatientTreatments(patient.id)
      setTreatments(data || [])
    } catch (error) {
      console.error('Error loading treatments:', error)
      toast.error('Erro ao carregar tratamentos')
    } finally {
      setIsLoadingTreatments(false)
    }
  }

  const handleCreateTreatment = () => {
    setSelectedTreatment(null)
    setShowTreatmentForm(true)
  }

  const handleEditTreatment = (treatment) => {
    setSelectedTreatment(treatment)
    setShowTreatmentForm(true)
  }

  const handleDeleteTreatment = async (treatment) => {
    if (!window.confirm(`Tem certeza que deseja excluir este tratamento?`)) {
      return
    }

    try {
      await patientService.deleteTreatment(patient.id, treatment.id)
      toast.success('Tratamento excluído com sucesso!')
      loadTreatments()
    } catch (error) {
      console.error('Error deleting treatment:', error)
      const message = error.response?.data?.message || 'Erro ao excluir tratamento'
      toast.error(message)
    }
  }

  const handleSaveTreatment = (treatment) => {
    setShowTreatmentForm(false)
    setSelectedTreatment(null)
    loadTreatments()
  }

  const calculateAge = (birthDate) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    
    return age
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatAddress = (address) => {
    if (!address) return 'Não informado'
    
    const parts = []
    if (address.street) parts.push(address.street)
    if (address.number) parts.push(address.number)
    if (address.complement) parts.push(address.complement)
    if (address.neighborhood) parts.push(address.neighborhood)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    if (address.zipCode) parts.push(`CEP: ${address.zipCode}`)
    
    return parts.join(', ') || 'Não informado'
  }

  const getTotalProductsUsed = () => {
    return treatments.reduce((total, treatment) => {
      return total + (treatment.productsUsed?.length || 0)
    }, 0)
  }

  if (!patient) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white mb-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-12 w-12">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-medium text-gray-900">{patient.name}</h3>
              <p className="text-sm text-gray-500">
                {calculateAge(patient.birthDate)} anos • Cadastrado em {formatDate(patient.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasPermission('manage_patients') && (
              <button
                onClick={() => onEdit(patient)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Informações
            </button>
            
            <button
              onClick={() => setActiveTab('treatments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'treatments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Tratamentos ({treatments.length})
            </button>
            
            <button
              onClick={() => setActiveTab('consumption')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'consumption'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="h-4 w-4 inline mr-2" />
              Relatório de Consumo
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-h-96 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Informações Pessoais</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{patient.email}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{patient.phone}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">
                      {formatDate(patient.birthDate)} ({calculateAge(patient.birthDate)} anos)
                    </span>
                  </div>
                  
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-gray-400 mr-3 mt-0.5" />
                    <span className="text-sm text-gray-900">{formatAddress(patient.address)}</span>
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Histórico Médico</h4>
                
                {patient.medicalHistory ? (
                  <div className="flex items-start">
                    <FileText className="h-4 w-4 text-gray-400 mr-3 mt-0.5" />
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {patient.medicalHistory}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Nenhum histórico médico registrado
                  </p>
                )}
              </div>

              {/* Statistics */}
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Estatísticas</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{treatments.length}</div>
                    <div className="text-sm text-gray-500">Tratamentos</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{getTotalProductsUsed()}</div>
                    <div className="text-sm text-gray-500">Produtos Utilizados</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {patient.isActive ? 'Ativo' : 'Inativo'}
                    </div>
                    <div className="text-sm text-gray-500">Status</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'treatments' && (
            <div>
              {/* Treatments Header */}
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">Tratamentos</h4>
                {hasPermission('manage_treatments') && (
                  <button
                    onClick={handleCreateTreatment}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Tratamento
                  </button>
                )}
              </div>

              {/* Treatments List */}
              {isLoadingTreatments ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Carregando tratamentos...</p>
                </div>
              ) : treatments.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum tratamento registrado</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Comece registrando o primeiro tratamento para este paciente.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {treatments.map((treatment) => (
                    <div key={treatment.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <Activity className="h-4 w-4 text-blue-500 mr-2" />
                            <h5 className="text-sm font-medium text-gray-900">{treatment.procedure}</h5>
                          </div>
                          
                          <div className="text-xs text-gray-500 mb-2">
                            {formatDateTime(treatment.date)} • Dr. {treatment.doctorName}
                          </div>
                          
                          {treatment.notes && (
                            <p className="text-sm text-gray-600 mb-3">{treatment.notes}</p>
                          )}
                          
                          {treatment.productsUsed && treatment.productsUsed.length > 0 && (
                            <div>
                              <h6 className="text-xs font-medium text-gray-700 mb-1">Produtos utilizados:</h6>
                              <div className="flex flex-wrap gap-1">
                                {treatment.productsUsed.map((product, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    {product.productName} ({product.quantity} {product.unit})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {hasPermission('manage_treatments') && (
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleEditTreatment(treatment)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar tratamento"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTreatment(treatment)}
                              className="text-red-600 hover:text-red-900"
                              title="Excluir tratamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'consumption' && (
            <PatientConsumptionReport patientId={patient.id} />
          )}
        </div>
      </div>

      {/* Treatment Form Modal */}
      {showTreatmentForm && (
        <TreatmentForm
          patient={patient}
          treatment={selectedTreatment}
          onSave={handleSaveTreatment}
          onCancel={() => {
            setShowTreatmentForm(false)
            setSelectedTreatment(null)
          }}
        />
      )}
    </div>
  )
}

export default PatientDetails