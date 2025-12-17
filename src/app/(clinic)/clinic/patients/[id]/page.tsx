"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Calendar, FileText, List, Plus } from "lucide-react";
import { Patient } from "@/types/patient";
import {
  getPatientById,
  getPatientHistory,
  deletePatient,
} from "@/lib/services/patientService";
import { formatCurrency } from "@/lib/services/reportService";
import { Timestamp } from "firebase/firestore";

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { claims } = useAuth();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (tenantId && patientId) {
      loadData();
    }
  }, [tenantId, patientId]);

  async function loadData() {
    if (!tenantId) return;

    try {
      setLoading(true);
      const [patientData, historyData] = await Promise.all([
        getPatientById(tenantId, patientId),
        getPatientHistory(tenantId, patientId).catch(() => []),
      ]);

      if (patientData) {
        setPatient(patientData);
        // Buscar histórico com o código do paciente
        const fullHistory = await getPatientHistory(tenantId, patientData.codigo);
        setHistory(fullHistory);
      }
    } catch (error) {
      console.error("Erro ao carregar paciente:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!tenantId || !confirm("Tem certeza que deseja deletar este paciente?")) return;

    try {
      setActionLoading(true);
      const result = await deletePatient(tenantId, patientId);

      if (result.success) {
        alert("Paciente deletado com sucesso!");
        router.push("/clinic/patients");
      } else {
        alert(result.error || "Erro ao deletar paciente");
      }
    } catch (error) {
      alert("Erro ao deletar paciente");
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(timestamp: Timestamp | Date): string {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    return date.toLocaleDateString("pt-BR");
  }

  function calculateTotalValue(procedimento: any): number {
    if (!procedimento.produtos_solicitados) return 0;

    return procedimento.produtos_solicitados.reduce((total: number, produto: any) => {
      return total + (produto.quantidade || 0) * (produto.valor_unitario || 0);
    }, 0);
  }

  if (loading) {
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

  const totalProcedimentos = history.length;
  const totalGasto = history.reduce((sum, proc) => sum + calculateTotalValue(proc), 0);

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{patient.nome}</h1>
          <p className="text-gray-600 mt-1">Código: {patient.codigo}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/clinic/patients/${patientId}/edit`)}
            disabled={actionLoading}
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar Dados
          </Button>
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

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={() => {
            // Scroll para a seção de histórico
            const historicoSection = document.getElementById("historico-procedimentos");
            historicoSection?.scrollIntoView({ behavior: "smooth" });
          }}
          className="h-16"
          variant="outline"
        >
          <List className="w-5 h-5 mr-2" />
          Listar Procedimentos ({history.length})
        </Button>
        <Button
          onClick={() => {
            // Navegar para novo procedimento com dados pré-preenchidos
            const params = new URLSearchParams({
              patientCode: patient.codigo,
              patientName: patient.nome,
            });
            router.push(`/clinic/requests/new?${params.toString()}`);
          }}
          className="h-16"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Procedimento
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dados do Paciente */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Dados do Paciente</h2>

          <div>
            <p className="text-sm text-gray-600">Nome Completo</p>
            <p className="font-medium text-gray-900">{patient.nome}</p>
          </div>

          {patient.telefone && (
            <div>
              <p className="text-sm text-gray-600">Telefone</p>
              <p className="font-medium text-gray-900">{patient.telefone}</p>
            </div>
          )}

          {patient.email && (
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{patient.email}</p>
            </div>
          )}

          {patient.data_nascimento && (
            <div>
              <p className="text-sm text-gray-600">Data de Nascimento</p>
              <p className="font-medium text-gray-900">{patient.data_nascimento}</p>
            </div>
          )}

          {patient.cpf && (
            <div>
              <p className="text-sm text-gray-600">CPF</p>
              <p className="font-medium text-gray-900">{patient.cpf}</p>
            </div>
          )}

          {patient.observacoes && (
            <div>
              <p className="text-sm text-gray-600">Observações</p>
              <p className="font-medium text-gray-900">{patient.observacoes}</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600">Cadastrado em</p>
            <p className="font-medium text-gray-900">{formatDate(patient.created_at)}</p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Estatísticas</h2>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-blue-600 font-medium">Total de Procedimentos</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{totalProcedimentos}</p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600 font-medium">Valor Total Gasto</p>
            </div>
            <p className="text-3xl font-bold text-green-900">
              {formatCurrency(totalGasto)}
            </p>
          </div>

          {history.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600">Último Procedimento</p>
              <p className="font-medium text-gray-900">
                {formatDate(history[0].dt_procedimento)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Histórico de Procedimentos */}
      <div id="historico-procedimentos" className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Histórico de Procedimentos
        </h2>

        {history.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhum procedimento realizado
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((proc) => (
              <div
                key={proc.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatDate(proc.dt_procedimento)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: <span className="capitalize">{proc.status}</span>
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(calculateTotalValue(proc))}
                  </p>
                </div>

                {proc.produtos_solicitados && proc.produtos_solicitados.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Produtos Utilizados:
                    </p>
                    <div className="space-y-1">
                      {proc.produtos_solicitados.map((produto: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between text-sm text-gray-600"
                        >
                          <span>
                            {produto.nome_produto} (Lote: {produto.lote})
                          </span>
                          <span>
                            {produto.quantidade}x {formatCurrency(produto.valor_unitario)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {proc.observacoes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{proc.observacoes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
