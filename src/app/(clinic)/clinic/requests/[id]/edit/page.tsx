"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  getSolicitacao,
  updateSolicitacaoAgendada,
} from "@/lib/services/solicitacaoService";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EditRequestPage() {
  const router = useRouter();
  const params = useParams();
  const { user, claims } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const solicitacaoId = params.id as string;
  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === "clinic_admin";

  useEffect(() => {
    async function loadSolicitacao() {
      if (!tenantId || !solicitacaoId) return;

      try {
        setLoading(true);
        const data = await getSolicitacao(tenantId, solicitacaoId);

        if (!data) {
          setError("Procedimento não encontrado");
          return;
        }

        // Verificar se pode editar
        if (data.status !== "agendada") {
          setError("Apenas procedimentos no status 'Agendado' podem ser editados");
          return;
        }

        // Redirecionar para página de criação com parâmetros de edição
        const params = new URLSearchParams({
          edit: solicitacaoId,
          pacienteCodigo: data.paciente_codigo,
          pacienteNome: data.paciente_nome,
          dtProcedimento: data.dt_procedimento.toDate().toISOString().split('T')[0],
          createdAt: data.created_at.toDate().toISOString().split('T')[0],
          observacoes: data.observacoes || "",
          produtos: JSON.stringify(data.produtos_solicitados.map(p => ({
            inventory_item_id: p.inventory_item_id,
            quantidade: p.quantidade,
            produto_codigo: p.produto_codigo,
            produto_nome: p.produto_nome,
            lote: p.lote,
            valor_unitario: p.valor_unitario,
          }))),
        });

        router.push(`/clinic/requests/new?${params.toString()}`);
      } catch (err: any) {
        console.error("Erro ao carregar procedimento:", err);
        setError("Erro ao carregar procedimento");
      } finally {
        setLoading(false);
      }
    }

    loadSolicitacao();
  }, [tenantId, solicitacaoId, router]);

  if (!isAdmin) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Apenas administradores podem editar procedimentos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  return null; // Will redirect
}
