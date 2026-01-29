"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  Package,
} from "lucide-react";
import { License, Tenant } from "@/types";
import PaymentSection from "./PaymentSection";
import {
  getActiveLicenseByTenant,
  getDaysUntilExpiration,
  isLicenseExpiringSoon,
} from "@/lib/services/licenseService";
import { Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function LicenseTab() {
  const { user, tenantId } = useAuth();
  const [license, setLicense] = useState<License | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [tenantId]);

  async function loadData() {
    if (!tenantId) return;

    try {
      setLoading(true);

      // Carregar licença e tenant em paralelo
      const [licenseData, tenantData] = await Promise.all([
        getActiveLicenseByTenant(tenantId),
        loadTenant(tenantId),
      ]);

      setLicense(licenseData);
      setTenant(tenantData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTenant(tenantId: string): Promise<Tenant | null> {
    try {
      const tenantRef = doc(db, "tenants", tenantId);
      const tenantDoc = await getDoc(tenantRef);

      if (tenantDoc.exists()) {
        return { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
      }
      return null;
    } catch (error) {
      console.error("Erro ao carregar tenant:", error);
      return null;
    }
  }

  function getPlanName(): string {
    if (!tenant) return "Standard";
    return tenant.document_type === "cpf" ? "Autônomo" : "Clínica";
  }

  function getMaxUsers(): number {
    if (!tenant) return 5;
    return tenant.max_users || (tenant.document_type === "cpf" ? 1 : 5);
  }

  function getFeatures(): string[] {
    if (!tenant) {
      return [
        "Gestão de Estoque com FEFO",
        "Controle de Lotes e Validades",
        "Cadastro de Pacientes",
        "Histórico de Procedimentos",
        "Solicitações de Produtos",
        "Relatórios Básicos",
      ];
    }

    const baseFeatures = [
      "Gestão de Estoque com FEFO",
      "Controle de Lotes e Validades",
      "Cadastro de Pacientes",
      "Histórico de Procedimentos",
      "Solicitações de Produtos",
      "Relatórios Básicos",
      "Notificações de Vencimento",
      "Alertas de Estoque Baixo",
    ];

    if (tenant.document_type === "cnpj") {
      return [
        ...baseFeatures,
        "Gestão Multi-Usuário (até 5 usuários)",
        "Controle de Permissões",
        "Relatórios Avançados",
        "Dashboard Executivo",
      ];
    }

    return [
      ...baseFeatures,
      "Gestão Individual",
    ];
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "ativa":
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case "expirada":
        return <XCircle className="w-8 h-8 text-red-600" />;
      case "suspensa":
        return <AlertTriangle className="w-8 h-8 text-orange-600" />;
      case "pendente":
        return <Clock className="w-8 h-8 text-yellow-600" />;
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
      <div className="space-y-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">
            Nenhuma Licença Ativa
          </h2>
          <p className="text-red-700 mb-4">
            Sua clínica não possui uma licença ativa no momento.
          </p>
          <p className="text-sm text-red-600">
            Entre em contato com o administrador do sistema para ativar sua licença.
          </p>
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysUntilExpiration(license);
  const expiringSoon = isLicenseExpiringSoon(license);

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div
        className={`p-6 rounded-lg border-2 ${
          license.status === "ativa"
            ? expiringSoon
              ? "bg-orange-50 border-orange-200"
              : "bg-green-50 border-green-200"
            : license.status === "expirada"
            ? "bg-red-50 border-red-200"
            : "bg-orange-50 border-orange-200"
        }`}
      >
        <div className="flex items-center gap-4">
          {getStatusIcon(license.status)}
          <div className="flex-1">
            <h2 className="text-2xl font-bold capitalize mb-1">
              Licença {license.status}
            </h2>
            {license.status === "ativa" && (
              <p className="text-lg">
                {expiringSoon ? (
                  <span className="text-orange-700 font-medium">
                    ⚠️ Sua licença expira em {daysRemaining} dias
                  </span>
                ) : daysRemaining < 0 ? (
                  <span className="text-red-700 font-medium">
                    Sua licença expirou há {Math.abs(daysRemaining)} dias
                  </span>
                ) : (
                  <span className="text-green-700">
                    Válida por mais {daysRemaining} dias
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Warning for Expiring Soon */}
      {expiringSoon && license.status === "ativa" && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-orange-900">
                Atenção: Licença Expirando em Breve
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Sua licença expira em {daysRemaining} dias. Entre em contato com
                o administrador para renovar e evitar interrupção do serviço.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="font-bold text-gray-900">Plano</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {getPlanName()}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tenant?.document_type === "cpf" ? "Profissional Autônomo" : "Clínica/Empresa"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-6 h-6 text-purple-600" />
            <h3 className="font-bold text-gray-900">Usuários</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            Até {getMaxUsers()}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tenant?.document_type === "cpf" ? "1 usuário" : "5 usuários"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-6 h-6 text-green-600" />
            <h3 className="font-bold text-gray-900">Renovação</h3>
          </div>
          <p className="text-lg font-bold text-green-600">
            {license.auto_renew ? "Automática" : "Manual"}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dates Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Período</h2>

          <div>
            <p className="text-sm text-gray-600">Data de Início</p>
            <p className="font-medium text-gray-900 text-lg">
              {formatDate(license.start_date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Data de Término</p>
            <p className="font-medium text-gray-900 text-lg">
              {formatDate(license.end_date)}
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600">Tempo Restante</p>
            <p
              className={`font-bold text-2xl ${
                expiringSoon
                  ? "text-orange-600"
                  : daysRemaining < 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {daysRemaining > 0 ? `${daysRemaining} dias` : "Expirada"}
            </p>
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Funcionalidades Incluídas
          </h2>
          <div className="space-y-2">
            {getFeatures().map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seção de Pagamento */}
      <PaymentSection />

      {/* Support Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">
          Precisa de ajuda com sua licença?
        </h3>
        <p className="text-sm text-blue-700">
          Entre em contato com o administrador do sistema em:{" "}
          <a
            href="mailto:scandelari.guilherme@curvamestra.com.br"
            className="font-medium underline"
          >
            scandelari.guilherme@curvamestra.com.br
          </a>
        </p>
      </div>
    </div>
  );
}
