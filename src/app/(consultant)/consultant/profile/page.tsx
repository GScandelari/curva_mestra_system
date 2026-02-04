"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Copy,
  Building2,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatTimestamp } from "@/lib/utils";
import type { Consultant } from "@/types";

export default function ConsultantProfilePage() {
  const { user, consultantId } = useAuth();
  const { toast } = useToast();
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && consultantId) {
      loadProfile();
    }
  }, [user, consultantId]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setConsultant(data.data);
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: "Código copiado" });
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
    <div className="container py-8 max-w-3xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-8 w-8 text-sky-600" />
            Meu Perfil
          </h1>
          <p className="text-muted-foreground">
            Informações da sua conta de consultor
          </p>
        </div>

        {/* Consultant Code Card */}
        <Card className="bg-gradient-to-r from-sky-500 to-sky-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 text-sm mb-1">Seu código de consultor</p>
                <p className="text-5xl font-bold font-mono tracking-widest">
                  {consultant?.code}
                </p>
                <p className="text-sky-100 text-sm mt-2">
                  Compartilhe este código com as clínicas para vincular-se
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={copyCode}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>
              Dados cadastrados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center">
                <User className="h-8 w-8 text-sky-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{consultant?.name}</h3>
                <Badge variant={consultant?.status === "active" ? "default" : "destructive"}>
                  {consultant?.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p className="font-medium">{consultant?.email}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  Telefone
                </div>
                <p className="font-medium">{consultant?.phone}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Membro desde
                </div>
                <p className="font-medium">
                  {consultant?.created_at ? formatTimestamp(consultant.created_at) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinics Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Clínicas Vinculadas
            </CardTitle>
            <CardDescription>
              Resumo das suas clínicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-4xl font-bold text-sky-600">
                {consultant?.authorized_tenants?.length || 0}
              </p>
              <p className="text-muted-foreground">
                clínica(s) vinculada(s) à sua conta
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Precisa de ajuda?</h4>
              <p className="text-sm text-muted-foreground">
                Para alterar seus dados cadastrais, entre em contato com o suporte do sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
