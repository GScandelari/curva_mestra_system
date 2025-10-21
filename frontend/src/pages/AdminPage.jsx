import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CostMonitoringDashboard from '../components/admin/CostMonitoringDashboard';
import ErrorReportingDashboard from '../components/admin/ErrorReportingDashboard';
import BackupManagementDashboard from '../components/admin/BackupManagementDashboard';
import { useAnalytics } from '../hooks/useAnalytics';

const AdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('costs');
  const { trackPageView, trackCustomEvent } = useAnalytics();

  React.useEffect(() => {
    trackPageView('/admin', 'Painel de Administração');
  }, [trackPageView]);

  // Verificar se é admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Acesso Negado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'costs', name: 'Monitoramento de Custos', icon: '💰' },
    { id: 'errors', name: 'Relatórios de Erro', icon: '🚨' },
    { id: 'backups', name: 'Gerenciamento de Backup', icon: '💾' }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    trackCustomEvent('admin_tab_changed', { tab: tabId });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Painel de Administração
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Monitoramento e gerenciamento do sistema
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Admin
                </span>
                <span className="text-sm text-gray-500">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'costs' && <CostMonitoringDashboard />}
        {activeTab === 'errors' && <ErrorReportingDashboard />}
        {activeTab === 'backups' && <BackupManagementDashboard />}
      </div>
    </div>
  );
};

export default AdminPage;