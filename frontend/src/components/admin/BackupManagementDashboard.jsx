import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAnalytics } from '../../hooks/useAnalytics';

const BackupManagementDashboard = () => {
  const [backupHistory, setBackupHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const { trackCustomEvent } = useAnalytics();

  const restoreFirestoreBackup = httpsCallable(functions, 'restoreFirestoreBackup');

  useEffect(() => {
    loadBackupHistory();
  }, []);

  const loadBackupHistory = async () => {
    try {
      setLoading(true);
      // Simular dados de backup (em produção, viria de uma função Firebase)
      const mockBackupHistory = [
        {
          id: '1',
          date: '2024-01-20',
          status: 'completed',
          size: '2.5 MB',
          duration: '45s',
          path: 'gs://curva-mestra-firestore-backups/backup-2024-01-20'
        },
        {
          id: '2',
          date: '2024-01-19',
          status: 'completed',
          size: '2.3 MB',
          duration: '42s',
          path: 'gs://curva-mestra-firestore-backups/backup-2024-01-19'
        },
        {
          id: '3',
          date: '2024-01-18',
          status: 'completed',
          size: '2.1 MB',
          duration: '38s',
          path: 'gs://curva-mestra-firestore-backups/backup-2024-01-18'
        },
        {
          id: '4',
          date: '2024-01-17',
          status: 'failed',
          size: '-',
          duration: '-',
          error: 'Timeout durante backup'
        }
      ];
      
      setBackupHistory(mockBackupHistory);
      trackCustomEvent('backup_history_viewed');
    } catch (err) {
      setError('Erro ao carregar histórico de backups');
      console.error('Erro ao carregar backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupPath) => {
    if (!confirm('ATENÇÃO: Restaurar um backup irá substituir todos os dados atuais. Esta ação não pode ser desfeita. Deseja continuar?')) {
      return;
    }

    const confirmText = prompt('Digite "CONFIRMAR" para prosseguir com a restauração:');
    if (confirmText !== 'CONFIRMAR') {
      alert('Restauração cancelada');
      return;
    }

    try {
      setRestoreLoading(true);
      await restoreFirestoreBackup({ backupPath });
      alert('Restauração iniciada com sucesso! O processo pode levar alguns minutos.');
      trackCustomEvent('backup_restore_initiated', { backup_path: backupPath });
    } catch (err) {
      alert('Erro ao iniciar restauração: ' + err.message);
      console.error('Erro na restauração:', err);
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleManualBackup = async () => {
    if (!confirm('Deseja iniciar um backup manual agora?')) {
      return;
    }

    try {
      // Em produção, chamaria uma função para backup manual
      alert('Backup manual iniciado! Você será notificado quando concluído.');
      trackCustomEvent('manual_backup_initiated');
    } catch (err) {
      alert('Erro ao iniciar backup manual: ' + err.message);
      console.error('Erro no backup manual:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'in_progress': return 'Em Progresso';
      default: return 'Desconhecido';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">{error}</div>
        <button
          onClick={loadBackupHistory}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Gerenciamento de Backup
        </h2>
        
        {/* Informações do Sistema */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-900">Próximo Backup</p>
                <p className="text-sm text-blue-700">Hoje às 02:00</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-900">Último Backup</p>
                <p className="text-sm text-green-700">Ontem às 02:00</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-900">Retenção</p>
                <p className="text-sm text-purple-700">30 dias</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex space-x-4">
          <button
            onClick={handleManualBackup}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Backup Manual
          </button>
          <button
            onClick={loadBackupHistory}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Atualizar Lista
          </button>
        </div>
      </div>

      {/* Histórico de Backups */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Histórico de Backups
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tamanho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duração
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backupHistory.map((backup) => (
                <tr key={backup.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(backup.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(backup.status)}`}>
                      {getStatusText(backup.status)}
                    </span>
                    {backup.error && (
                      <div className="text-xs text-red-600 mt-1">
                        {backup.error}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {backup.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {backup.duration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {backup.status === 'completed' && backup.path && (
                      <button
                        onClick={() => handleRestoreBackup(backup.path)}
                        disabled={restoreLoading}
                        className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        {restoreLoading ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configurações de Backup */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Configurações de Backup
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Backup Automático</h4>
              <p className="text-sm text-gray-500">Executar backup diário às 02:00</p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Retenção de Backups</h4>
              <p className="text-sm text-gray-500">Manter backups por 30 dias</p>
            </div>
            <div>
              <select className="text-sm border-gray-300 rounded-md">
                <option value="7">7 dias</option>
                <option value="30" selected>30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Notificações</h4>
              <p className="text-sm text-gray-500">Receber alertas sobre falhas de backup</p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Informações Importantes */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Informações Importantes sobre Backup
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Backups são armazenados no Google Cloud Storage</li>
                <li>A restauração substitui TODOS os dados atuais</li>
                <li>Backups incluem todas as coleções do Firestore</li>
                <li>O processo de restauração pode levar vários minutos</li>
                <li>Sempre teste restaurações em ambiente de desenvolvimento primeiro</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupManagementDashboard;