"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Users, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function NewConsultantPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdConsultant, setCreatedConsultant] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone é obrigatório";
    } else if (formData.phone.replace(/\D/g, "").length < 10) {
      newErrors.phone = "Telefone inválido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/consultants", {
        method: "POST",
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
        throw new Error(data.error || "Erro ao criar consultor");
      }

      setCreatedConsultant(data.data);
      setSuccess(true);
      toast({ title: "Consultor criado com sucesso!" });
    } catch (err: any) {
      toast({ title: err.message || "Erro ao criar consultor", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success && createdConsultant) {
    return (
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Consultor Criado com Sucesso!</CardTitle>
            <CardDescription>
              Um email foi enviado com as credenciais de acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-6 text-center">
              <p className="text-sm text-sky-600 mb-2">Código do Consultor</p>
              <p className="text-4xl font-bold font-mono text-sky-700 tracking-widest">
                {createdConsultant.code}
              </p>
              <p className="text-xs text-sky-500 mt-2">
                Este código identifica o consultor para vínculo com clínicas
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{createdConsultant.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{createdConsultant.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-green-600">Ativo</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Importante:</strong> O consultor receberá um email com uma senha temporária.
                Ele será solicitado a alterar a senha no primeiro acesso.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSuccess(false);
                  setCreatedConsultant(null);
                  setFormData({ name: "", email: "", phone: "" });
                }}
              >
                Cadastrar Outro
              </Button>
              <Button
                className="flex-1 bg-sky-600 hover:bg-sky-700"
                onClick={() => router.push("/admin/consultants")}
              >
                Ver Lista de Consultores
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-2xl">
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-sky-600" />
            Novo Consultor
          </h1>
          <p className="text-muted-foreground">
            Cadastre um novo consultor externo no sistema
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Consultor</CardTitle>
            <CardDescription>
              Preencha os dados abaixo. Um código de 6 dígitos será gerado automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="NOME COMPLETO DO CONSULTOR"
                  className="uppercase"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="consultor@email.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">O que acontece após o cadastro:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Um código único de 6 dígitos será gerado</li>
                  <li>• Uma senha temporária será enviada por email</li>
                  <li>• O consultor poderá fazer login e vincular-se a clínicas</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/admin/consultants")}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-700"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Consultor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
