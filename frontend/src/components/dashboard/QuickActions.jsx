import React from 'react'
import { 
  Package, 
  FileText, 
  Users, 
  ClipboardList,
  BarChart3,
  Download
} from 'lucide-react'

const QuickActions = ({ hasPermission }) => {
  const actions = [
    {
      name: 'Cadastrar Produto',
      href: '/products/new',
      icon: Package,
      permission: 'manage_products',
      color: 'text-blue-600 hover:text-blue-700'
    },
    {
      name: 'Nova Solicitação',
      href: '/requests/new',
      icon: ClipboardList,
      permission: 'request_products',
      color: 'text-green-600 hover:text-green-700'
    },
    {
      name: 'Cadastrar Paciente',
      href: '/patients/new',
      icon: Users,
      permission: 'manage_patients',
      color: 'text-purple-600 hover:text-purple-700'
    },
    {
      name: 'Registrar Nota Fiscal',
      href: '/invoices/new',
      icon: FileText,
      permission: 'manage_invoices',
      color: 'text-orange-600 hover:text-orange-700'
    },
    {
      name: 'Ver Relatórios',
      href: '/reports',
      icon: BarChart3,
      permission: 'view_reports',
      color: 'text-indigo-600 hover:text-indigo-700'
    },
    {
      name: 'Exportar Dados',
      href: '/reports/export',
      icon: Download,
      permission: 'export_data',
      color: 'text-gray-600 hover:text-gray-700'
    }
  ]

  const visibleActions = actions.filter(action => 
    !action.permission || hasPermission(action.permission)
  )

  if (visibleActions.length === 0) {
    return null
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleActions.map((action) => {
            const Icon = action.icon
            return (
              <a
                key={action.name}
                href={action.href}
                className="group flex items-center p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
              >
                <Icon className={`h-6 w-6 ${action.color} group-hover:scale-110 transition-transform duration-200`} />
                <span className="ml-3 text-sm font-medium text-gray-900 group-hover:text-gray-700">
                  {action.name}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default QuickActions