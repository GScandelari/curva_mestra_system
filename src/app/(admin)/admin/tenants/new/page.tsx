"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import { ArrowLeft, Save, Building2 } from "lucide-react";
import { createTenant } from "@/lib/services/tenantServiceDirect";
import { validateCNPJ } from "@/types/tenant";

export default function NewTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [planId, setPlanId] = useState("semestral");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!name.trim()) {
      setError("Nome da clínica é obrigatório");
      return;
    }

    if (!validateCNPJ(cnpj)) {
      setError("CNPJ inválido. Verifique os dígitos verificadores.");
      return;
    }

    if (!email.trim()) {
      setError("Email é obrigatório");
      return;
    }

    setLoading(true);
    const cnpjNumbers = cnpj.replace(/\D/g, "");

    try {
      await createTenant({
        name: name.trim(),
        cnpj: cnpjNumbers,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        plan_id: planId as "semestral" | "anual",
      });

      router.push("/admin/tenants");
    } catch (err: any) {
      setError(err.message || "Erro ao criar clínica");
      console.error("Erro ao criar tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCNPJInput = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 14);
    if (numbers.length <= 14) {
      return numbers
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers;
  };

  const formatPhoneInput = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  return (
    <ProtectedRoute allowedRoles={["system_admin"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex h-16 items-center">
            <Link
              href="/admin/tenants"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Clínicas
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="container max-w-2xl py-8">
          <div className="space-y-6">
            {/* Page Title */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="h-8 w-8 text-primary" />
                Nova Clínica
              </h1>
              <p className="text-muted-foreground">
                Cadastre uma nova clínica no sistema
              </p>
            </div>

            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Clínica</CardTitle>
                <CardDescription>
                  Preencha os dados da clínica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Nome da Clínica <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Clínica Beleza & Harmonia"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpj">
                      CNPJ <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cnpj"
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCNPJInput(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      required
                      disabled={loading}
                      maxLength={18}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@clinica.com"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                      placeholder="(00) 00000-0000"
                      disabled={loading}
                      maxLength={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, bairro, cidade - UF"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="planId">
                      Plano <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="planId"
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="semestral">Plano Semestral - R$ 59,90/mês</option>
                      <option value="anual">Plano Anual - R$ 59,90/mês</option>
                    </select>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/tenants")}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? "Criando..." : "Criar Clínica"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
