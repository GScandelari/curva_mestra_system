import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const UnauthorizedPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleGoBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Acesso Negado
          </h2>
          
          <p className="mt-2 text-sm text-gray-600">
            Você não tem permissão para acessar esta página.
          </p>
          
          {user && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-700">
                <strong>Usuário:</strong> {user.name || user.email}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Perfil:</strong> {user.role === 'admin' ? 'Administrador' : 
                  user.role === 'doctor' ? 'Médico' :
                  user.role === 'manager' ? 'Gerente' :
                  user.role === 'receptionist' ? 'Recepcionista' : user.role}
              </p>
            </div>
          )}
          
          <p className="mt-4 text-sm text-gray-500">
            Se você acredita que deveria ter acesso a esta página, entre em contato com o administrador do sistema.
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <button
            onClick={handleGoBack}
            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </button>
          
          <Link
            to="/dashboard"
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Home className="h-4 w-4 mr-2" />
            Ir para Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedPage