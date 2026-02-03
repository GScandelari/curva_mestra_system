"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileBarChart,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ClinicSelector } from "@/components/consultant/ClinicSelector";
import { ReadOnlyBanner } from "@/components/consultant/ReadOnlyBanner";

interface Clinic {
  id: string;
  name: string;
}

export default function ConsultantReportsPage() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadClinics();
    }
  }, [user]);

  const loadClinics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch("/api/consultants/me/clinics", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setClinics(data.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-8 w-8 text-sky-600" />
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Visualize relatórios das clínicas vinculadas
          </p>
        </div>

        <ReadOnlyBanner />

        {/* Clinic Selector */}
        {clinics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Clínica</CardTitle>
              <CardDescription>
                Escolha uma clínica para visualizar os relatórios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClinicSelector
                clinics={clinics}
                className="max-w-md"
              />
            </CardContent>
          </Card>
        )}

        {/* Coming Soon */}
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Em Desenvolvimento</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Os relatórios consolidados para consultores estão sendo desenvolvidos.
                Em breve você poderá visualizar análises detalhadas de todas as suas clínicas.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-lg">Consolidado de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visão geral do estoque de todas as clínicas vinculadas.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-lg">Consumo por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Análise de consumo de produtos por período.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-lg">Alertas Consolidados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Produtos próximos ao vencimento em todas as clínicas.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
