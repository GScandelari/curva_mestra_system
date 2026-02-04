"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, Building2, XCircle, CheckCircle, Users, UserPlus, Shield, User, UserCheck, Search, Copy, Loader2, X } from "lucide-react";
import { getTenant, updateTenant, deactivateTenant, reactivateTenant } from "@/lib/services/tenantServiceDirect";
import { listClinicUsers, ClinicUser } from "@/lib/services/clinicUserService";
import { formatPlanPrice, getPlanMaxUsers } from "@/lib/constants/plans";
import { Tenant, DocumentType, Consultant } from "@/types";
import { formatAddress, formatCNPJ } from "@/lib/utils";
import { validateDocument, formatDocumentAuto, getDocumentType } from "@/lib/utils/documentValidation";
import TenantPaymentInfo from "@/components/admin/TenantPaymentInfo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [planId, setPlanId] = useState("semestral");
  const [active, setActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Estado para usuários da clínica
  const [clinicUsers, setClinicUsers] = useState<ClinicUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Estado para modal de adicionar usuário
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"clinic_admin" | "clinic_user">("clinic_user");
  const [creatingUser, setCreatingUser] = useState(false);

  // Estado para consultor
  const [showConsultantDialog, setShowConsultantDialog] = useState(false);
  const [consultantSearch, setConsultantSearch] = useState("");
  const [consultantResults, setConsultantResults] = useState<Consultant[]>([]);
  const [searchingConsultant, setSearchingConsultant] = useState(false);
  const [assigningConsultant, setAssigningConsultant] = useState(false);
  const [removingConsultant, setRemovingConsultant] = useState(false);

  useEffect(() => {
    loadTenant();
    loadUsers();
  }, [tenantId]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const result = await listClinicUsers(tenantId);
      setClinicUsers(result.users);
    } catch (err: any) {
      console.error("Erro ao carregar usuários:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTenant = async () => {
    try {
      setLoadingTenant(true);
      setError("");
      const result = await getTenant(tenantId);
      const tenantData = result.tenant;
      setTenant(tenantData);

      // Preencher formulário
      setName(tenantData.name);
      // Usar document_number se disponível, senão usar cnpj para compatibilidade
      const documentNumber = tenantData.document_number || tenantData.cnpj || "";
      setCnpj(formatCNPJInput(documentNumber));
      setEmail(tenantData.email);
      setPhone(formatPhoneInput(tenantData.phone || ""));
      // Converter address de objeto para string se necessário
      const addressStr = formatAddress(tenantData.address);
      setAddress(addressStr === "Não informado" ? "" : addressStr);
      setPlanId(tenantData.plan_id);
      setActive(tenantData.active);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar clínica");
      console.error("Erro ao carregar tenant:", err);
    } finally {
      setLoadingTenant(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validações
    if (!name.trim()) {
      setError("Nome da clínica é obrigatório");
      return;
    }

    if (!validateDocument(cnpj)) {
      setError("CPF/CNPJ inválido. Verifique os dígitos verificadores.");
      return;
    }

    if (!email.trim()) {
      setError("Email é obrigatório");
      return;
    }

    setLoading(true);
    const documentNumbers = cnpj.replace(/\D/g, "");
    const docType = getDocumentType(documentNumbers);

    if (!docType) {
      setError("Tipo de documento inválido");
      setLoading(false);
      return;
    }

    try {
      await updateTenant(tenantId, {
        name: name.trim(),
        document_type: docType,
        document_number: documentNumbers,
        cnpj: documentNumbers, // Manter compatibilidade
        max_users: docType === "cpf" ? 1 : 5,
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        plan_id: planId as "semestral" | "anual",
        active,
      });

      setSuccess("Clínica atualizada com sucesso!");
      setTimeout(() => {
        router.push("/admin/tenants");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar clínica");
      console.error("Erro ao atualizar tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Tem certeza que deseja desativar "${tenant?.name}"?`)) {
      return;
    }

    try {
      await deactivateTenant(tenantId);
      setSuccess("Clínica desativada com sucesso!");
      setTimeout(() => {
        router.push("/admin/tenants");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao desativar clínica");
      console.error("Erro ao desativar tenant:", err);
    }
  };

  const handleReactivate = async () => {
    if (!confirm(`Tem certeza que deseja reativar "${tenant?.name}"?`)) {
      return;
    }

    try {
      await reactivateTenant(tenantId);
      setSuccess("Clínica reativada com sucesso!");
      // Atualizar estado local
      setActive(true);
      if (tenant) {
        setTenant({ ...tenant, active: true });
      }
    } catch (err: any) {
      setError(err.message || "Erro ao reativar clínica");
      console.error("Erro ao reativar tenant:", err);
    }
  };

  const handleCreateUser = async () => {
    try {
      setCreatingUser(true);
      setError("");

      // Obter token do usuário atual (system_admin)
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Erro de autenticação. Faça login novamente.");
      }

      // Chamar API para criar usuário (NÃO autentica automaticamente)
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserName,
          role: newUserRole,
          // Para system_admin, enviar tenant_id manualmente
          tenant_id_override: tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar usuário");
      }

      setSuccess("Usuário criado com sucesso!");

      // Limpar formulário
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("clinic_user");
      setShowAddUserDialog(false);

      // Recarregar lista de usuários
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Erro ao criar usuário");
      console.error("Erro ao criar usuário:", err);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSearchConsultant = async () => {
    if (!consultantSearch.trim()) return;

    try {
      setSearchingConsultant(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Erro de autenticação");

      const response = await fetch(
        `/api/consultants/search?q=${encodeURIComponent(consultantSearch)}`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao buscar consultores");
      }

      setConsultantResults(data.data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar consultores");
    } finally {
      setSearchingConsultant(false);
    }
  };

  const handleAssignConsultant = async (consultant: Consultant) => {
    if (!confirm(`Deseja vincular o consultor "${consultant.name}" a esta clínica?`)) {
      return;
    }

    try {
      setAssigningConsultant(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Erro de autenticação");

      const response = await fetch(`/api/tenants/${tenantId}/consultant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ new_consultant_id: consultant.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao vincular consultor");
      }

      setSuccess("Consultor vinculado com sucesso!");
      setShowConsultantDialog(false);
      setConsultantSearch("");
      setConsultantResults([]);

      // Recarregar tenant para atualizar dados do consultor
      loadTenant();
    } catch (err: any) {
      setError(err.message || "Erro ao vincular consultor");
    } finally {
      setAssigningConsultant(false);
    }
  };

  const handleRemoveConsultant = async () => {
    if (!confirm("Tem certeza que deseja remover o consultor desta clínica?")) {
      return;
    }

    try {
      setRemovingConsultant(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Erro de autenticação");

      const response = await fetch(`/api/tenants/${tenantId}/consultant`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao remover consultor");
      }

      setSuccess("Consultor removido com sucesso!");

      // Recarregar tenant para atualizar dados do consultor
      loadTenant();
    } catch (err: any) {
      setError(err.message || "Erro ao remover consultor");
    } finally {
      setRemovingConsultant(false);
    }
  };

  const copyConsultantCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccess("Código copiado para a área de transferência");
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

  if (loadingTenant) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando tenant...</p>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="container py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => router.push("/admin/tenants")}>
            Voltar para Clínicas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
          <div className="space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Building2 className="h-8 w-8 text-primary" />
                  Editar Clínica
                </h1>
                <p className="text-muted-foreground">
                  Atualize as informações da clínica
                </p>
              </div>
              {tenant && (
                <Badge variant={tenant.active ? "default" : "destructive"}>
                  {tenant.active ? "Ativo" : "Inativo"}
                </Badge>
              )}
            </div>

            {/* Clinic Summary */}
            {tenant && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Informações Gerais</span>
                    <Badge variant={tenant.active ? "default" : "destructive"}>
                      {tenant.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Resumo das informações principais</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Nome</p>
                      <p className="text-base font-semibold">{tenant.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {tenant.document_type === "cpf" ? "CPF" : "CNPJ"}
                      </p>
                      <p className="text-base font-semibold">
                        {formatDocumentAuto(tenant.document_number || tenant.cnpj || "")}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="text-base">{tenant.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                      <p className="text-base">{tenant.phone || "Não informado"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Plano</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-base">
                          {tenant.plan_id}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatPlanPrice(tenant.plan_id)}/mês
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                      <p className="text-base">{formatAddress(tenant.address)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usuários da Clínica */}
            {tenant && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Usuários da Clínica
                      </CardTitle>
                      <CardDescription>
                        {clinicUsers.length} de {tenant.max_users || 5} usuários
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => setShowAddUserDialog(true)}
                      disabled={clinicUsers.length >= (tenant.max_users || 5)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar Usuário
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingUsers ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando usuários...
                    </div>
                  ) : clinicUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum usuário cadastrado
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clinicUsers.map((user) => (
                        <div
                          key={user.uid}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {user.role === "clinic_admin" ? (
                                <Shield className="h-5 w-5 text-primary" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {user.displayName}
                                {user.role === "clinic_admin" && (
                                  <Badge variant="default" className="text-xs">
                                    Admin
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <Badge variant={user.active ? "default" : "destructive"}>
                            {user.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Informações de Pagamento */}
            {tenant && (
              <TenantPaymentInfo tenantId={tenantId} tenantName={tenant.name} />
            )}

            {/* Consultor Rennova */}
            {tenant && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-sky-600" />
                        Consultor Rennova
                      </CardTitle>
                      <CardDescription>
                        Consultor responsável por esta clínica
                      </CardDescription>
                    </div>
                    {tenant.consultant_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConsultantDialog(true)}
                      >
                        Alterar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {tenant.consultant_id ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-sky-50/50">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-sky-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{tenant.consultant_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Código:</span>
                              <span className="font-mono font-bold text-sky-600">
                                {tenant.consultant_code}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyConsultantCode(tenant.consultant_code || "")}
                                title="Copiar código"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={handleRemoveConsultant}
                          disabled={removingConsultant}
                        >
                          {removingConsultant ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <UserCheck className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-4">
                        Esta clínica não possui consultor vinculado
                      </p>
                      <Button
                        onClick={() => setShowConsultantDialog(true)}
                        className="bg-sky-600 hover:bg-sky-700"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Configurar Consultor
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>Editar Informações</CardTitle>
                <CardDescription>
                  Atualize os dados da clínica conforme necessário
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
                      CPF/CNPJ <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cnpj"
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCNPJInput(e.target.value))}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
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
                      <option value="anual">Plano Anual - R$ 49,90/mês</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="active">Status</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={active ? "default" : "outline"}
                        onClick={() => setActive(true)}
                        disabled={loading}
                        className="flex-1"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Ativo
                      </Button>
                      <Button
                        type="button"
                        variant={!active ? "destructive" : "outline"}
                        onClick={() => setActive(false)}
                        disabled={loading}
                        className="flex-1"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Inativo
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                      {success}
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
                      {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            {tenant && tenant.active && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
                  <CardDescription>
                    Ações irreversíveis que afetam o tenant
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={handleDeactivate}
                    disabled={loading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Desativar Clínica
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Desativar irá suspender todos os usuários desta clínica
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Reactivate Zone */}
            {tenant && !tenant.active && (
              <Card className="border-green-500">
                <CardHeader>
                  <CardTitle className="text-green-600">Reativar Clínica</CardTitle>
                  <CardDescription>
                    Esta clínica está desativada no momento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleReactivate}
                    disabled={loading}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Reativar Clínica
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Reativar permitirá que os usuários desta clínica voltem a acessar o sistema
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

        {/* Dialog para adicionar usuário */}
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um novo usuário para esta clínica. O usuário receberá as credenciais por email.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newUserName">Nome Completo</Label>
                <Input
                  id="newUserName"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: João Silva"
                  disabled={creatingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newUserEmail">Email</Label>
                <Input
                  id="newUserEmail"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  disabled={creatingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newUserPassword">Senha</Label>
                <Input
                  id="newUserPassword"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  disabled={creatingUser}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newUserRole">Função</Label>
                <select
                  id="newUserRole"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as "clinic_admin" | "clinic_user")}
                  disabled={creatingUser}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="clinic_user">Usuário</option>
                  <option value="clinic_admin">Administrador</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {newUserRole === "clinic_admin"
                    ? "Administradores podem gerenciar usuários e configurações"
                    : "Usuários têm acesso limitado ao sistema"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddUserDialog(false)}
                disabled={creatingUser}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={creatingUser}>
                {creatingUser ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para buscar e vincular consultor */}
        <Dialog open={showConsultantDialog} onOpenChange={setShowConsultantDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configurar Consultor Rennova</DialogTitle>
              <DialogDescription>
                Busque um consultor por código, nome ou telefone para vincular a esta clínica
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Código, nome ou telefone do consultor"
                  value={consultantSearch}
                  onChange={(e) => setConsultantSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchConsultant()}
                />
                <Button
                  onClick={handleSearchConsultant}
                  disabled={searchingConsultant || !consultantSearch.trim()}
                >
                  {searchingConsultant ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {consultantResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {consultantResults.map((consultant) => {
                    const isActive = consultant.status === "active";
                    return (
                      <div
                        key={consultant.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          isActive
                            ? "hover:bg-muted/50 cursor-pointer"
                            : "opacity-60 cursor-not-allowed bg-muted/30"
                        }`}
                        onClick={() => isActive && handleAssignConsultant(consultant)}
                        title={!isActive ? "Consultor inativo não pode ser vinculado" : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isActive ? "bg-sky-100" : "bg-gray-200"
                          }`}>
                            <UserCheck className={`h-5 w-5 ${isActive ? "text-sky-600" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <p className="font-medium">{consultant.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className={`font-mono font-bold ${isActive ? "text-sky-600" : "text-gray-400"}`}>
                                {consultant.code}
                              </span>
                              <span>•</span>
                              <span>{consultant.email}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={isActive ? "default" : "destructive"}>
                          {isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {consultantResults.length === 0 && consultantSearch && !searchingConsultant && (
                <div className="text-center py-6 text-muted-foreground">
                  Nenhum consultor encontrado. Tente outro termo de busca.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConsultantDialog(false);
                  setConsultantSearch("");
                  setConsultantResults([]);
                }}
                disabled={assigningConsultant}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
