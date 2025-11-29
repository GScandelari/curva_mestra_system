"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Save, Building2 } from "lucide-react";
import { createTenant } from "@/lib/services/tenantServiceDirect";
import { validateDocument, getDocumentType, maskDocument } from "@/lib/utils/documentValidation";
import { DocumentType } from "@/types";

export default function NewTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("cnpj");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cep, setCep] = useState("");
  const [planId, setPlanId] = useState("semestral");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!name.trim()) {
      setError("Nome da clínica/pessoa é obrigatório");
      return;
    }

    if (!validateDocument(document)) {
      setError(`${documentType === "cpf" ? "CPF" : "CNPJ"} inválido. Verifique os dígitos verificadores.`);
      return;
    }

    if (!email.trim()) {
      setError("Email é obrigatório");
      return;
    }

    setLoading(true);
    const documentNumbers = document.replace(/\D/g, "");
    const maxUsers = documentType === "cpf" ? 1 : 5;

    try {
      await createTenant({
        name: name.trim(),
        document_type: documentType,
        document_number: documentNumbers,
        cnpj: documentNumbers, // Compatibilidade
        max_users: maxUsers,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        cep: cep.replace(/\D/g, ""),
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
    <div className="container max-w-2xl py-8">
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
                    <Label>
                      Tipo de Conta <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="cnpj"
                          checked={documentType === "cnpj"}
                          onChange={(e) => {
                            setDocumentType(e.target.value as DocumentType);
                            setDocument("");
                          }}
                          disabled={loading}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">
                          CNPJ (Clínica/Empresa - até 5 usuários)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="cpf"
                          checked={documentType === "cpf"}
                          onChange={(e) => {
                            setDocumentType(e.target.value as DocumentType);
                            setDocument("");
                          }}
                          disabled={loading}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">
                          CPF (Pessoa Física - 1 usuário)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document">
                      {documentType === "cpf" ? "CPF" : "CNPJ"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="document"
                      type="text"
                      value={document}
                      onChange={(e) => setDocument(maskDocument(e.target.value, documentType))}
                      placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
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
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      type="text"
                      value={cep}
                      onChange={(e) => {
                        const formatted = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setCep(formatted.replace(/^(\d{5})(\d)/, "$1-$2"));
                      }}
                      placeholder="00000-000"
                      disabled={loading}
                      maxLength={9}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, complemento"
                      disabled={loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <select
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        disabled={loading}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Selecione</option>
                        <option value="AC">AC</option>
                        <option value="AL">AL</option>
                        <option value="AP">AP</option>
                        <option value="AM">AM</option>
                        <option value="BA">BA</option>
                        <option value="CE">CE</option>
                        <option value="DF">DF</option>
                        <option value="ES">ES</option>
                        <option value="GO">GO</option>
                        <option value="MA">MA</option>
                        <option value="MT">MT</option>
                        <option value="MS">MS</option>
                        <option value="MG">MG</option>
                        <option value="PA">PA</option>
                        <option value="PB">PB</option>
                        <option value="PR">PR</option>
                        <option value="PE">PE</option>
                        <option value="PI">PI</option>
                        <option value="RJ">RJ</option>
                        <option value="RN">RN</option>
                        <option value="RS">RS</option>
                        <option value="RO">RO</option>
                        <option value="RR">RR</option>
                        <option value="SC">SC</option>
                        <option value="SP">SP</option>
                        <option value="SE">SE</option>
                        <option value="TO">TO</option>
                      </select>
                    </div>
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
                      <option value="anual">Plano Anual - R$ 49,90/mês</option>
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
    </div>
  );
}
