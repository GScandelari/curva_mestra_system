"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { getPatientById, updatePatient } from "@/lib/services/patientService";
import { Patient } from "@/types/patient";

export default function EditPatientPage() {
  const params = useParams();
  const router = useRouter();
  const { claims, user } = useAuth();
  const patientId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    data_nascimento: "",
    cpf: "",
    observacoes: "",
  });

  const tenantId = claims?.tenant_id;

  // Verificar permissão - apenas clinic_admin pode editar pacientes
  useEffect(() => {
    if (claims && claims.role !== "clinic_admin") {
      router.push("/clinic/patients");
    }
  }, [claims, router]);

  useEffect(() => {
    if (tenantId && patientId) {
      loadPatient();
    }
  }, [tenantId, patientId]);

  async function loadPatient() {
    if (!tenantId) return;

    try {
      setLoadingData(true);
      const data = await getPatientById(tenantId, patientId);

      if (data) {
        setPatient(data);
        setFormData({
          nome: data.nome || "",
          telefone: data.telefone || "",
          email: data.email || "",
          data_nascimento: data.data_nascimento || "",
          cpf: data.cpf || "",
          observacoes: data.observacoes || "",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar paciente:", error);
      alert("Erro ao carregar dados do paciente");
    } finally {
      setLoadingData(false);
    }
  }

  // Funções de formatação
  function formatPhone(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 10) {
      return cleaned
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return cleaned
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }

  function formatCPF(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }

  function formatDate(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/^(\d{2})(\d)/, "$1/$2")
      .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3")
      .slice(0, 10);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.nome.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    if (!tenantId || !user) return;

    try {
      setLoading(true);

      const result = await updatePatient(
        tenantId,
        patientId,
        {
          nome: formData.nome,
          telefone: formData.telefone || undefined,
          email: formData.email || undefined,
          data_nascimento: formData.data_nascimento || undefined,
          cpf: formData.cpf || undefined,
          observacoes: formData.observacoes || undefined,
        },
        user.uid,
        user.displayName || "Usuário"
      );

      if (result.success) {
        alert("Paciente atualizado com sucesso!");
        router.push(`/clinic/patients/${patientId}`);
      } else {
        alert(result.error || "Erro ao atualizar paciente");
      }
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao atualizar paciente");
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Paciente não encontrado</p>
          <Button onClick={() => router.back()} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Paciente</h1>
          <p className="text-gray-600 mt-1">
            {patient.nome} • Código: {patient.codigo}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código
              </label>
              <Input value={patient.codigo} disabled className="bg-gray-50" />
              <p className="text-xs text-gray-500 mt-1">
                O código do paciente não pode ser alterado
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <Input
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do paciente"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
              <Input
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: formatPhone(e.target.value) })
                }
                placeholder="(00) 00000-0000"
                maxLength={15}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Nascimento
              </label>
              <Input
                value={formData.data_nascimento}
                onChange={(e) =>
                  setFormData({ ...formData, data_nascimento: formatDate(e.target.value) })
                }
                placeholder="DD/MM/AAAA"
                maxLength={10}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o paciente"
              rows={4}
              disabled={loading}
            />
          </div>

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
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
