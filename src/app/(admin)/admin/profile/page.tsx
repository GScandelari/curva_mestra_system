"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import { ArrowLeft, User, Mail, Key, Save, Shield } from "lucide-react";
import Link from "next/link";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

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
    if (newPassword.length < 8) {
      setPasswordError("Para system_admin, a senha deve ter pelo menos 8 caracteres");
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
    <ProtectedRoute allowedRoles={["system_admin"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex h-16 items-center">
            <Link
              href="/admin/dashboard"
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
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Meu Perfil
              </h1>
              <p className="text-muted-foreground">
                Gerencie suas informações de System Admin
              </p>
            </div>

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

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Mantenha sua conta segura com uma senha forte (mínimo 8 caracteres para admins)
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
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo de 8 caracteres para system_admin
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
    </ProtectedRoute>
  );
}
