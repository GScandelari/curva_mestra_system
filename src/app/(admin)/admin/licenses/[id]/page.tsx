"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { License } from "@/types";
import {
  getLicenseById,
  getDaysUntilExpiration,
  renewLicense,
  suspendLicense,
  reactivateLicense,
  deleteLicense,
} from "@/lib/services/licenseService";
import { Timestamp } from "firebase/firestore";

export default function LicenseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const licenseId = params.id as string;

  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadLicense();
  }, [licenseId]);

  async function loadLicense() {
    try {
      setLoading(true);
      const data = await getLicenseById(licenseId);
      setLicense(data);
    } catch (error) {
      console.error("Erro ao carregar licença:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenew() {
    if (!license) return;

    const months = confirm(
      "Renovar por quantos meses?\n\n6 - Semestral\n12 - Anual"
    );
    if (!months) return;

    const monthsNum = parseInt(months as unknown as string);
    if (isNaN(monthsNum) || (monthsNum !== 6 && monthsNum !== 12)) {
      alert("Valor inválido. Digite 6 ou 12.");
      return;
    }

    try {
      setActionLoading(true);
      const currentEndDate = (license.end_date as Timestamp).toDate();
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + monthsNum);

      await renewLicense(licenseId, newEndDate);
      alert("Licença renovada com sucesso!");
      loadLicense();
    } catch (error) {
      console.error("Erro ao renovar licença:", error);
      alert("Erro ao renovar licença.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSuspend() {
    if (!confirm("Tem certeza que deseja suspender esta licença?")) return;

    try {
      setActionLoading(true);
      await suspendLicense(licenseId);
      alert("Licença suspensa com sucesso!");
      loadLicense();
    } catch (error) {
      console.error("Erro ao suspender licença:", error);
      alert("Erro ao suspender licença.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    if (!confirm("Tem certeza que deseja reativar esta licença?")) return;

    try {
      setActionLoading(true);
      await reactivateLicense(licenseId);
      alert("Licença reativada com sucesso!");
      loadLicense();
    } catch (error) {
      console.error("Erro ao reativar licença:", error);
      alert("Erro ao reativar licença.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "ATENÇÃO: Tem certeza que deseja DELETAR esta licença?\n\nEsta ação não pode ser desfeita!"
      )
    )
      return;

    try {
      setActionLoading(true);
      await deleteLicense(licenseId);
      alert("Licença deletada com sucesso!");
      router.push("/admin/licenses");
    } catch (error) {
      console.error("Erro ao deletar licença:", error);
      alert("Erro ao deletar licença.");
    } finally {
      setActionLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "ativa":
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case "expirada":
        return <XCircle className="w-6 h-6 text-red-600" />;
      case "suspensa":
        return <AlertTriangle className="w-6 h-6 text-orange-600" />;
      case "pendente":
        return <Clock className="w-6 h-6 text-yellow-600" />;
      default:
        return null;
    }
  }

  function formatDate(timestamp: Timestamp | Date): string {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Licença não encontrada</p>
        <Button onClick={() => router.back()} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const daysRemaining = getDaysUntilExpiration(license);
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 15;

  return (
    <div className="container py-8">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Detalhes da Licença
          </h1>
          <p className="text-gray-600 mt-1">ID: {license.id}</p>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`p-4 rounded-lg border-2 ${
          license.status === "ativa"
            ? "bg-green-50 border-green-200"
            : license.status === "expirada"
            ? "bg-red-50 border-red-200"
            : license.status === "suspensa"
            ? "bg-orange-50 border-orange-200"
            : "bg-yellow-50 border-yellow-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(license.status)}
            <div>
              <p className="font-bold text-lg capitalize">{license.status}</p>
              {license.status === "ativa" && (
                <p className="text-sm text-gray-600">
                  {isExpiringSoon ? (
                    <span className="text-orange-600 font-medium">
                      ⚠️ Expira em {daysRemaining} dias
                    </span>
                  ) : daysRemaining < 0 ? (
                    <span className="text-red-600 font-medium">
                      Expirou há {Math.abs(daysRemaining)} dias
                    </span>
                  ) : (
                    <span>Válida por mais {daysRemaining} dias</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {license.status === "ativa" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRenew}
                  disabled={actionLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Renovar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSuspend}
                  disabled={actionLoading}
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Suspender
                </Button>
              </>
            )}

            {license.status === "suspensa" && (
              <Button
                variant="outline"
                onClick={handleReactivate}
                disabled={actionLoading}
              >
                <Play className="w-4 h-4 mr-2" />
                Reativar
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={actionLoading}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar
            </Button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Informações</h2>

          <div>
            <p className="text-sm text-gray-600">Tenant ID</p>
            <p className="font-medium text-gray-900">{license.tenant_id}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Plano</p>
            <p className="font-medium text-gray-900">{license.plan_id}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Máximo de Usuários</p>
            <p className="font-medium text-gray-900">{license.max_users}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Renovação Automática</p>
            <p className="font-medium text-gray-900">
              {license.auto_renew ? "Sim" : "Não"}
            </p>
          </div>
        </div>

        {/* Dates Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Datas</h2>

          <div>
            <p className="text-sm text-gray-600">Data de Início</p>
            <p className="font-medium text-gray-900">
              {formatDate(license.start_date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Data de Término</p>
            <p className="font-medium text-gray-900">
              {formatDate(license.end_date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Criada em</p>
            <p className="font-medium text-gray-900">
              {formatDate(license.created_at)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Última Atualização</p>
            <p className="font-medium text-gray-900">
              {formatDate(license.updated_at)}
            </p>
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Funcionalidades Incluídas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {license.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
          </div>
    </div>
  );
}
