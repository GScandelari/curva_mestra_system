"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { License } from "@/types";
import { getAllLicenses, getDaysUntilExpiration } from "@/lib/services/licenseService";
import { Timestamp } from "firebase/firestore";

export default function LicensesPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLicenses();
  }, []);

  async function loadLicenses() {
    try {
      setLoading(true);
      const data = await getAllLicenses();
      setLicenses(data);
    } catch (error) {
      console.error("Erro ao carregar licenças:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "ativa":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "expirada":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "suspensa":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "pendente":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  }

  function getStatusBadge(status: string) {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium";
    switch (status) {
      case "ativa":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "expirada":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "suspensa":
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case "pendente":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  function formatDate(timestamp: Timestamp | Date): string {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleDateString("pt-BR");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container py-8">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Licenças</h1>
          <p className="text-gray-600 mt-1">
            Gerencie as licenças de todas as clínicas
          </p>
        </div>
        <Button onClick={() => router.push("/admin/licenses/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Licença
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Licenças</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {licenses.length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ativas</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {licenses.filter((l) => l.status === "ativa").length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expirando em Breve</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {
                  licenses.filter(
                    (l) =>
                      l.status === "ativa" &&
                      getDaysUntilExpiration(l) > 0 &&
                      getDaysUntilExpiration(l) <= 15
                  ).length
                }
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Expiradas</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {licenses.filter((l) => l.status === "expirada").length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Início
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Término
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dias Restantes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Renovação Automática
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhuma licença encontrada</p>
                    <Button
                      onClick={() => router.push("/admin/licenses/new")}
                      className="mt-4"
                    >
                      Criar Primeira Licença
                    </Button>
                  </td>
                </tr>
              ) : (
                licenses.map((license) => {
                  const daysRemaining = getDaysUntilExpiration(license);
                  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 15;

                  return (
                    <tr
                      key={license.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/admin/licenses/${license.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {license.tenant_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{license.plan_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(license.status)}
                          <span className={getStatusBadge(license.status)}>
                            {license.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(license.start_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(license.end_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {license.status === "ativa" ? (
                          <span
                            className={`text-sm font-medium ${
                              isExpiringSoon
                                ? "text-orange-600"
                                : daysRemaining < 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {daysRemaining} dias
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {license.auto_renew ? (
                          <span className="text-green-600 font-medium">Sim</span>
                        ) : (
                          <span className="text-gray-400">Não</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/licenses/${license.id}`);
                          }}
                        >
                          Ver Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
          </div>
    </div>
  );
}
