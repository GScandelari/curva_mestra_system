"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
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
import { ArrowLeft, User, Mail, Key, Save, Building2, MapPin, FileCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Tenant } from "@/types/tenant";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProfilePage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const tenantId = claims?.tenant_id;

  // Tenant data
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Terms acceptance
  const [termsAcceptances, setTermsAcceptances] = useState<any[]>([]);
  const [termsLoading, setTermsLoading] = useState(true);

  // Load tenant data
  useEffect(() => {
    async function loadTenant() {
      if (!tenantId) return;

      try {
        setTenantLoading(true);
        const tenantDoc = await getDoc(doc(db, "tenants", tenantId));

        if (tenantDoc.exists()) {
          setTenant({ id: tenantDoc.id, ...tenantDoc.data() } as Tenant);
        }
      } catch (error) {
        console.error("Erro ao carregar dados da clínica:", error);
      } finally {
        setTenantLoading(false);
      }
    }

    loadTenant();
  }, [tenantId]);

  // Load terms acceptances
  useEffect(() => {
    async function loadTermsAcceptances() {
      if (!user) return;

      try {
        setTermsLoading(true);
        const acceptancesRef = collection(db, "user_document_acceptances");
        const q = query(acceptancesRef, where("user_id", "==", user.uid));
        const snapshot = await getDocs(q);

        const acceptances: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          acceptances.push({
            id: doc.id,
            document_id: data.document_id,
            document_version: data.document_version,
            accepted_at: data.accepted_at,
          });
        });

        // Buscar os títulos dos documentos
        const acceptancesWithTitles = await Promise.all(
          acceptances.map(async (acceptance) => {
            try {
              const docRef = doc(db, "legal_documents", acceptance.document_id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                return {
                  ...acceptance,
                  document_title: docSnap.data().title,
                };
              }
              return acceptance;
            } catch (err) {
              return acceptance;
            }
          })
        );

        setTermsAcceptances(acceptancesWithTitles);
      } catch (error) {
        console.error("Erro ao carregar aceitações de termos:", error);
      } finally {
        setTermsLoading(false);
      }
    }

    loadTermsAcceptances();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      if (!user) throw new Error("Usuário não autenticado");

      await updateProfile(user, {
        displayName: displayName.trim(),
      });

      setProfileSuccess("Perfil atualizado com sucesso!");
    } catch (error: any) {
      setProfileError(error.message || "Erro ao atualizar perfil");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    // Validações
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setPasswordLoading(true);

    try {
      if (!user || !user.email) throw new Error("Usuário não autenticado");

      // Reautenticar usuário antes de mudar a senha
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Atualizar senha
      await updatePassword(user, newPassword);

      setPasswordSuccess("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error.code === "auth/wrong-password") {
        setPasswordError("Senha atual incorreta");
      } else if (error.code === "auth/too-many-requests") {
        setPasswordError("Muitas tentativas. Tente novamente mais tarde");
      } else {
        setPasswordError(error.message || "Erro ao alterar senha");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex h-16 items-center">
            <Link
              href="/clinic/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Dashboard
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="container max-w-2xl py-8">
          <div className="space-y-8">
            {/* Page Title */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
              <p className="text-muted-foreground">
                Gerencie suas informações pessoais e segurança
              </p>
            </div>

            {/* Clinic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informações da Clínica
                </CardTitle>
                <CardDescription>
                  Dados da clínica à qual você está vinculado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenantLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : tenant ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Nome da Clínica</Label>
                        <p className="font-medium">{tenant.name}</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">
                          {tenant.document_type === "cnpj" ? "CNPJ" : "CPF"}
                        </Label>
                        <p className="font-medium">{tenant.document_number}</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Email</Label>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{tenant.email}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p className="font-medium">{tenant.phone}</p>
                      </div>
                    </div>

                    {(tenant.address || tenant.city || tenant.state || tenant.cep) && (
                      <div className="pt-4 border-t">
                        <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4" />
                          Localização
                        </Label>
                        <div className="space-y-1">
                          {tenant.address && (
                            <p className="text-sm">{tenant.address}</p>
                          )}
                          {(tenant.city || tenant.state) && (
                            <p className="text-sm">
                              {[tenant.city, tenant.state].filter(Boolean).join(" - ")}
                            </p>
                          )}
                          {tenant.cep && (
                            <p className="text-sm">CEP: {tenant.cep}</p>
                          )}
                          {tenant.timezone && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Fuso horário: {tenant.timezone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível carregar os dados da clínica
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>
                  Atualize seu nome e informações de perfil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nome</Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={profileLoading}
                      required
                    />
                  </div>

                  {profileSuccess && (
                    <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                      {profileSuccess}
                    </div>
                  )}

                  {profileError && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {profileError}
                    </div>
                  )}

                  <Button type="submit" disabled={profileLoading}>
                    <Save className="mr-2 h-4 w-4" />
                    {profileLoading ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Terms Acceptance Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Termos de Uso e Privacidade
                </CardTitle>
                <CardDescription>
                  Documentos legais que você aceitou
                </CardDescription>
              </CardHeader>
              <CardContent>
                {termsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : termsAcceptances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum termo aceito ainda
                  </p>
                ) : (
                  <div className="space-y-3">
                    {termsAcceptances.map((acceptance) => (
                      <div
                        key={acceptance.id}
                        className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {acceptance.document_title || "Documento Legal"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Versão {acceptance.document_version} • Aceito em{" "}
                            {acceptance.accepted_at?.toDate?.()?.toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) || "Data não disponível"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Mantenha sua conta segura com uma senha forte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordLoading}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={passwordLoading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo de 6 caracteres
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={passwordLoading}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  {passwordSuccess && (
                    <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                      {passwordSuccess}
                    </div>
                  )}

                  {passwordError && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {passwordError}
                    </div>
                  )}

                  <Button type="submit" disabled={passwordLoading}>
                    <Key className="mr-2 h-4 w-4" />
                    {passwordLoading ? "Alterando..." : "Alterar Senha"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
    </div>
  );
}
