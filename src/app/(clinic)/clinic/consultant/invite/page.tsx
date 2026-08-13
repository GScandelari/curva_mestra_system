'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Search,
  Mail,
  Loader2,
  CheckCircle2,
  UserCheck,
  Ban,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ConsultantResult {
  id: string;
  code: string;
  name: string;
  email: string;
}

interface PendingInvite {
  id: string;
  requesting_consultant_name: string;
  requesting_consultant_code: string;
  expires_at: unknown;
}

/** Dias restantes até `expires_at` (Timestamp serializado como {_seconds, _nanoseconds}). */
function daysUntil(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('_seconds' in value)) return null;
  const { _seconds } = value as { _seconds: number };
  const diffMs = _seconds * 1000 - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export default function InviteConsultantPage() {
  const router = useRouter();
  const { user, tenantId, role } = useAuth();
  const { toast } = useToast();

  // RN-08: apenas clinic_admin pode acessar; clinic_user é redirecionado (UC-46/RN-04 evitado)
  useEffect(() => {
    if (role === 'clinic_user') {
      router.replace('/clinic/my-clinic?tab=consultant');
    }
  }, [role, router]);

  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ConsultantResult | null>(null);
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadState = useCallback(async () => {
    if (!user || !tenantId) return;
    setChecking(true);
    try {
      const token = await user.getIdToken();

      const [consultantRes, inviteRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}/consultant`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/tenants/${tenantId}/consultant/invite`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const consultantData = await consultantRes.json();
      const inviteData = await inviteRes.json();

      setBlocked(Boolean(consultantData?.data));
      setPendingInvite(inviteData?.data ?? null);
    } catch (error) {
      console.error('Erro ao verificar estado do convite:', error);
    } finally {
      setChecking(false);
    }
  }, [user, tenantId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleSearch = async () => {
    if (!user) return;
    const code = searchCode.replace(/\D/g, '');

    if (code.length !== 6) {
      toast({ title: 'Informe um código de 6 dígitos', variant: 'destructive' });
      return;
    }

    setSearching(true);
    setSearchResult(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/consultants/by-code/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          toast({ title: 'Consultor não encontrado', variant: 'destructive' });
        } else {
          throw new Error(data.error || 'Erro ao buscar consultor');
        }
        return;
      }

      setSearchResult(data.data);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao buscar consultor', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async () => {
    if (!user || !tenantId || !searchResult) return;

    if (!confirm(`Tem certeza que deseja convidar o consultor ${searchResult.name}?`)) {
      return;
    }

    setInviting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/tenants/${tenantId}/consultant/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ consultant_id: searchResult.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar convite');
      }

      setSuccess(true);
      toast({ title: 'Convite enviado com sucesso!' });

      // Redireciona para o único caminho de navegação real (UC-46/RN-05)
      setTimeout(() => {
        router.push('/clinic/my-clinic?tab=consultant');
      }, 2000);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao enviar convite', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !tenantId || !pendingInvite) return;

    if (!confirm('Tem certeza que deseja cancelar este convite?')) {
      return;
    }

    setCancelling(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/tenants/${tenantId}/consultant/invite/${pendingInvite.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cancelar convite');
      }

      toast({ title: 'Convite cancelado' });
      // RN-12: convite cancelado não bloqueia mais um novo envio — volta ao formulário
      setPendingInvite(null);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao cancelar convite', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  if (checking) {
    return (
      <div className="container py-8 max-w-lg">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="container py-8 max-w-lg">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Convite Enviado!</h3>
              <p className="text-muted-foreground mb-4">
                Aguarde a aceitação do consultor. Você será notificado quando ele responder.
              </p>
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-lg">
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push('/clinic/my-clinic?tab=consultant')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            Convidar Consultor
          </h1>
          <p className="text-muted-foreground">
            Informe o código do consultor para enviar um convite de vínculo
          </p>
        </div>

        {blocked ? (
          // Estado 1: clínica já tem consultor vinculado
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <Ban className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Sua clínica já possui um consultor vinculado. Para trocar, aguarde uma solicitação
                  de transferência do consultor interessado.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : pendingInvite ? (
          // Estado 3: convite pending não expirado já existe
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Convite Pendente
              </CardTitle>
              <CardDescription>Aguardando resposta do consultor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consultor</span>
                  <span className="font-semibold">{pendingInvite.requesting_consultant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Código</span>
                  <span className="font-mono">{pendingInvite.requesting_consultant_code}</span>
                </div>
                {daysUntil(pendingInvite.expires_at) !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Expira em</span>
                    <Badge variant="outline">{daysUntil(pendingInvite.expires_at)} dias</Badge>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancelar Convite
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Estado 2: sem consultor e sem convite ativo — formulário de busca
          <>
            <Card>
              <CardHeader>
                <CardTitle>Buscar por Código</CardTitle>
                <CardDescription>O consultor deve informar seu código de 6 dígitos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código do Consultor</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="font-mono text-center text-xl tracking-widest"
                      maxLength={6}
                    />
                    <Button onClick={handleSearch} disabled={searching || searchCode.length !== 6}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {searchResult && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    Consultor Encontrado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-semibold">{searchResult.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span>{searchResult.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Código</span>
                      <span className="font-mono">{searchResult.code}</span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleInvite} disabled={inviting}>
                    {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Convite
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Como funciona?</h4>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Solicite o código de 6 dígitos ao consultor</li>
                    <li>Busque o consultor pelo código</li>
                    <li>Envie o convite</li>
                    <li>O consultor terá 15 dias para aceitar ou recusar</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
