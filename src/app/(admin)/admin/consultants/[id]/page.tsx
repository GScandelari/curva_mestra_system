"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Loader2,
  Copy,
  Building2,
  Save,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatTimestamp } from "@/lib/utils";
import type { Consultant } from "@/types";

export default function ConsultantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const consultantId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    loadConsultant();
  }, [consultantId, user]);

  const loadConsultant = async () => {
    if (!user || !consultantId) return;

    try {
      setLoading(true);

      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultantId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar consultor");
      }

      setConsultant(data.data);
      setFormData({
        name: data.data.name || "",
        email: data.data.email || "",
        phone: data.data.phone || "",
      });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao carregar consultor", variant: "destructive" });
      router.push("/admin/consultants");
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === "phone") {
      formattedValue = formatPhone(value);
    } else if (field === "name") {
      formattedValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleSave = async () => {
    if (!user || !consultantId) return;

    setSaving(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultantId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email.toLowerCase(),
          phone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao atualizar consultor");
      }

      toast({ title: "Consultor atualizado com sucesso!" });
      loadConsultant();
    } catch (err: any) {
      toast({ title: err.message || "Erro ao atualizar consultor", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: "Código copiado" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Ativo</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspenso</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!consultant) {
    return (
      <div className="container py-8">
        <div className="text-center py-8 text-muted-foreground">
          Consultor não encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push("/admin/consultants")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Users className="h-8 w-8 text-sky-600" />
                {consultant.name}
              </h1>
              <p className="text-muted-foreground">
                Detalhes e configurações do consultor
              </p>
            </div>
            {getStatusBadge(consultant.status)}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Código do Consultor */}
          <Card>
            <CardHeader>
              <CardTitle>Código do Consultor</CardTitle>
              <CardDescription>
                Código único para identificação e vínculo com clínicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-6 text-center">
                <p className="text-4xl font-bold font-mono text-sky-700 tracking-widest">
                  {consultant.code}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={copyCode}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Código
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Informações */}
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-mono">
                  {consultant.cpf.replace(
                    /(\d{3})(\d{3})(\d{3})(\d{2})/,
                    "$1.$2.$3-$4"
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Criado em:</span>
                <span>{formatTimestamp(consultant.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Atualizado em:</span>
                <span>{formatTimestamp(consultant.updated_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Clínicas vinculadas:</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {consultant.authorized_tenants?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editar Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Editar Dados</CardTitle>
            <CardDescription>
              Altere os dados de contato do consultor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(00) 00000-0000"
                className="max-w-xs"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clínicas Vinculadas */}
        <Card>
          <CardHeader>
            <CardTitle>Clínicas Vinculadas</CardTitle>
            <CardDescription>
              Lista de clínicas que este consultor tem acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {consultant.authorized_tenants?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma clínica vinculada
              </div>
            ) : (
              <div className="space-y-2">
                {consultant.authorized_tenants?.map((tenantId) => (
                  <div
                    key={tenantId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{tenantId}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/admin/tenants/${tenantId}`)}
                    >
                      Ver Clínica
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
