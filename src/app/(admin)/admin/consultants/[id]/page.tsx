'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Users,
  Loader2,
  Copy,
  Building2,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatTimestamp } from '@/lib/utils';
import type { Consultant } from '@/types';

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
    name: '',
    email: '',
    phone: '',
  });

  // Redefinir senha por email
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailAddress, setResetEmailAddress] = useState<string | null>(null);

  // Definir senha manualmente
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [settingPassword, setSettingPassword] = useState(false);
  const [setPasswordSuccess, setSetPasswordSuccess] = useState(false);

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
        throw new Error(data.error || 'Erro ao carregar consultor');
      }

      setConsultant(data.data);
      setFormData({
        name: data.data.name || '',
        email: data.data.email || '',
        phone: data.data.phone || '',
      });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao carregar consultor', variant: 'destructive' });
      router.push('/admin/consultants');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;

    if (field === 'phone') {
      formattedValue = formatPhone(value);
    } else if (field === 'name') {
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
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
        throw new Error(data.error || 'Erro ao atualizar consultor');
      }

      toast({ title: 'Consultor atualizado com sucesso!' });
      loadConsultant();
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao atualizar consultor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !consultant) return;

    if (
      !confirm(
        `Tem certeza que deseja redefinir a senha de ${consultant.email}?\n\nUm email será enviado com um link seguro para o consultor definir uma nova senha.`
      )
    ) {
      return;
    }

    try {
      setResettingPassword(true);
      setResetEmailSent(false);
      setResetEmailAddress(null);

      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultantId}/reset-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao solicitar reset de senha');
      }

      setResetEmailSent(true);
      setResetEmailAddress(data.email);
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao enviar email', variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSetPassword = async () => {
    if (!user) return;

    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }

    try {
      setSettingPassword(true);
      setSetPasswordSuccess(false);

      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultantId}/set-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword, requirePasswordChange: forcePasswordChange }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao definir senha');
      }

      setSetPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao definir senha', variant: 'destructive' });
    } finally {
      setSettingPassword(false);
    }
  };

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: 'Código copiado' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Ativo</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspenso</Badge>;
      case 'inactive':
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
        <div className="text-center py-8 text-muted-foreground">Consultor não encontrado</div>
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
            onClick={() => router.push('/admin/consultants')}
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
              <p className="text-muted-foreground">Detalhes e configurações do consultor</p>
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
                <Button variant="ghost" size="sm" className="mt-2" onClick={copyCode}>
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
            <CardDescription>Altere os dados de contato do consultor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
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

        {/* Gerenciamento de Senha */}
        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Senha</CardTitle>
            <CardDescription>Redefina ou defina manualmente a senha do consultor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Redefinir Senha via Email */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Redefinir Senha</Label>
              </div>

              {resetEmailSent ? (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      Email enviado com sucesso!
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>
                      Enviado para: <strong>{resetEmailAddress}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    O consultor receberá um link seguro para definir uma nova senha. O link expira
                    em 30 minutos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Envie um email com link seguro para o consultor definir uma nova senha. O link
                    expira em 30 minutos.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {resettingPassword ? 'Enviando...' : 'Enviar Link de Reset'}
                  </Button>
                </div>
              )}
            </div>

            {/* Definir Senha Manualmente */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-orange-500" />
                <Label className="font-medium">Definir Senha Manualmente</Label>
              </div>

              {setPasswordSuccess ? (
                <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      Senha definida com sucesso!
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Use para suporte quando o sistema de email falhar. A senha é definida
                    imediatamente.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pr-10 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <input
                      id="confirmPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="forcePasswordChange"
                      checked={forcePasswordChange}
                      onCheckedChange={(checked) => setForcePasswordChange(checked === true)}
                    />
                    <Label
                      htmlFor="forcePasswordChange"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Solicitar troca de senha no próximo login
                    </Label>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSetPassword}
                    disabled={settingPassword || !newPassword || !confirmPassword}
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {settingPassword ? 'Definindo...' : 'Definir Senha'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clínicas Vinculadas */}
        <Card>
          <CardHeader>
            <CardTitle>Clínicas Vinculadas</CardTitle>
            <CardDescription>Lista de clínicas que este consultor tem acesso</CardDescription>
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
