"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { createPatient } from "@/lib/services/patientService";

export default function NewPatientPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    telefone: "",
    email: "",
    data_nascimento: "",
    cpf: "",
    observacoes: "",
  });

  // Verificar permissão - apenas clinic_admin pode criar pacientes
  useEffect(() => {
    if (claims && claims.role !== "clinic_admin") {
      router.push("/clinic/patients");
    }
  }, [claims, router]);

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

    if (!claims?.tenant_id || !user) return;

    try {
      setLoading(true);

      const result = await createPatient(
        claims.tenant_id,
        user.uid,
        user.displayName || "Usuário",
        {
          codigo: formData.codigo || undefined,
          nome: formData.nome,
          telefone: formData.telefone || undefined,
          email: formData.email || undefined,
          data_nascimento: formData.data_nascimento || undefined,
          cpf: formData.cpf || undefined,
          observacoes: formData.observacoes || undefined,
        }
      );

      if (result.success) {
        alert("Paciente cadastrado com sucesso!");
        router.push("/clinic/patients");
      } else {
        alert(result.error || "Erro ao cadastrar paciente");
      }
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao cadastrar paciente");
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-3xl font-bold tracking-tight">Novo Paciente</h1>
            <p className="text-muted-foreground mt-1">Cadastre um novo paciente</p>
          </div>
        </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código (opcional)
              </label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Deixe em branco para gerar automaticamente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo <span className="text-red-500">*</span>
              </label>
              <Input
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do paciente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CPF</label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
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
              {loading ? "Cadastrando..." : "Cadastrar Paciente"}
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
