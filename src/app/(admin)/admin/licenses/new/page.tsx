"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createLicense } from "@/lib/services/licenseService";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLANS, getPlanConfig } from "@/lib/constants/plans";

interface TenantOption {
  id: string;
  name: string;
}

export default function NewLicensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [formData, setFormData] = useState({
    tenant_id: "",
    plan_id: "semestral",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    auto_renew: false,
  });

  useEffect(() => {
    loadTenants();
    // Calcular data de término padrão (6 meses)
    calculateEndDate("semestral");
  }, []);

  async function loadTenants() {
    try {
      const snapshot = await getDocs(collection(db, "tenants"));
      const tenantsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || doc.id,
      }));
      setTenants(tenantsData);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
    }
  }

  function calculateEndDate(planId: string) {
    const startDate = new Date(formData.start_date);
    const endDate = new Date(startDate);

    if (planId === "semestral") {
      endDate.setMonth(endDate.getMonth() + 6);
    } else if (planId === "anual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    setFormData((prev) => ({
      ...prev,
      end_date: endDate.toISOString().split("T")[0],
    }));
  }

  function handlePlanChange(planId: string) {
    setFormData((prev) => ({ ...prev, plan_id: planId }));
    calculateEndDate(planId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.tenant_id) {
      alert("Selecione um tenant");
      return;
    }

    try {
      setLoading(true);

      const selectedPlan = getPlanConfig(formData.plan_id);
      if (!selectedPlan) {
        throw new Error("Plano não encontrado");
      }

      await createLicense({
        tenant_id: formData.tenant_id,
        plan_id: formData.plan_id,
        max_users: selectedPlan.maxUsers,
        features: selectedPlan.features,
        start_date: new Date(formData.start_date),
        end_date: new Date(formData.end_date),
        auto_renew: formData.auto_renew,
      });

      alert("Licença criada com sucesso!");
      router.push("/admin/licenses");
    } catch (error) {
      console.error("Erro ao criar licença:", error);
      alert("Erro ao criar licença. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8">
          <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nova Licença</h1>
          <p className="text-gray-600 mt-1">
            Crie uma nova licença para um tenant
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tenant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenant <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.tenant_id}
              onChange={(e) =>
                setFormData({ ...formData, tenant_id: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione um tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.id})
                </option>
              ))}
            </select>
          </div>

          {/* Plano */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(PLANS).map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => handlePlanChange(plan.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.plan_id === plan.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <span className="text-2xl font-bold text-blue-600">
                      R$ {plan.price}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{plan.duration}</p>
                  <p className="text-xs text-gray-500">
                    Máx. {plan.maxUsers} usuário(s)
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Início <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => {
                  setFormData({ ...formData, start_date: e.target.value });
                  calculateEndDate(formData.plan_id);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Término <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Renovação Automática */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto_renew"
              checked={formData.auto_renew}
              onChange={(e) =>
                setFormData({ ...formData, auto_renew: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="auto_renew" className="text-sm text-gray-700">
              Ativar renovação automática
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Licença"}
            </Button>
          </div>
        </form>
      </div>
          </div>
    </div>
  );
}
