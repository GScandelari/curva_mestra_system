'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '@/lib/firebase';
import { writeAdminAuditLog } from '@/lib/services/auditLogService';
import { translateFirestoreError } from '@/lib/firestoreErrors';
import {
  DEFAULT_SYSTEM_SETTINGS_FORM,
  buildSystemSettingsPayload,
  canSaveSystemSettings,
  hasConcurrentChange,
  normalizeSystemSettingsForm,
  validateSystemSettingsForm,
  type SettingsBaseline,
  type SettingsLoadStatus,
  type SystemSettingsForm,
} from '@/lib/systemSettings';
import { Settings, Save, Loader2, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';

interface ClaimsMismatch {
  uid: string;
  email: string;
  tenant_id: string;
  role: string;
  issues: string[];
}

interface ClaimsIntegrityCheckResult {
  checked: number;
  mismatches: ClaimsMismatch[];
}

/** O documento mudou em outra sessão desde a leitura (UC-35-RN-01). */
class SettingsConflictError extends Error {}

export default function SystemSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [checkingClaims, setCheckingClaims] = useState(false);
  const [claimsResult, setClaimsResult] = useState<ClaimsIntegrityCheckResult | null>(null);

  // UX-046: o formulário só existe sobre uma leitura confirmada pelo servidor.
  const [form, setForm] = useState<SystemSettingsForm>(DEFAULT_SYSTEM_SETTINGS_FORM);
  const [loadStatus, setLoadStatus] = useState<SettingsLoadStatus>('loading');
  const [baseline, setBaseline] = useState<SettingsBaseline | null>(null);
  const [loadErrorDetail, setLoadErrorDetail] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoadStatus('loading');
    try {
      // getDocFromServer: um resultado só do cache nunca vale como leitura
      // (senão "offline" poderia virar "documento inexistente").
      const docSnap = await getDocFromServer(doc(db, 'system_settings', 'global'));

      if (docSnap.exists()) {
        const data = docSnap.data();
        setForm(normalizeSystemSettingsForm(data));
        setBaseline({ exists: true, updatedAt: data.updated_at ?? null });
        setLoadStatus('loaded');
      } else {
        setForm(DEFAULT_SYSTEM_SETTINGS_FORM);
        setBaseline({ exists: false, updatedAt: null });
        setLoadStatus('missing');
      }
    } catch (error) {
      console.error('Erro ao carregar system_settings/global', error);
      setLoadErrorDetail(translateFirestoreError((error as { code?: string })?.code));
      setLoadStatus('error');
    }
  }

  async function handleSave() {
    if (!canSaveSystemSettings(loadStatus, saving) || !baseline) return;

    if (!auth.currentUser) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar autenticado',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateSystemSettingsForm(form);
    if (!validation.ok) {
      toast({
        title: 'Erro de validação',
        description: validation.message,
        variant: 'destructive',
      });
      return;
    }

    const uid = auth.currentUser.uid;
    setSaving(true);
    try {
      const docRef = doc(db, 'system_settings', 'global');
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        const current: SettingsBaseline = {
          exists: snap.exists(),
          updatedAt: snap.exists() ? (snap.data().updated_at ?? null) : null,
        };
        if (hasConcurrentChange(baseline, current)) throw new SettingsConflictError();
        tx.set(
          docRef,
          { ...buildSystemSettingsPayload(form, uid), updated_at: serverTimestamp() },
          { merge: true }
        );
      });
      await writeAdminAuditLog({
        tenant_id: null,
        entity_type: 'system_settings',
        entity_id: 'global',
        action: 'update',
        descricao: 'Configurações globais do sistema atualizadas',
      });

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso',
      });
      // Atualiza a base de updated_at (o valor do serverTimestamp só existe após gravar).
      await loadSettings({ silent: true });
    } catch (error) {
      if (error instanceof SettingsConflictError) {
        setLoadStatus('stale');
        return;
      }
      console.error('Erro ao salvar system_settings/global', error);
      toast({
        title: 'Erro ao salvar',
        description: translateFirestoreError((error as { code?: string })?.code),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckClaimsIntegrity() {
    setCheckingClaims(true);
    setClaimsResult(null);
    try {
      const checkClaimsIntegrity = httpsCallable(functions, 'checkClaimsIntegrityOnDemand');
      const result = await checkClaimsIntegrity();
      const data = result.data as ClaimsIntegrityCheckResult;
      setClaimsResult(data);

      if (data.mismatches.length === 0) {
        toast({
          title: 'Nenhuma divergência encontrada',
          description: `${data.checked} usuário(s) verificado(s) — custom claims consistentes com o Firestore.`,
        });
      } else {
        toast({
          title: 'Divergências encontradas',
          description: `${data.mismatches.length} de ${data.checked} usuário(s) com claims divergentes. Um e-mail de alerta foi enviado.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      // Erros de httpsCallable têm prefixo functions/, fora do translateFirestoreError.
      console.error('Erro ao verificar integridade de claims', error);
      toast({
        title: 'Erro ao verificar integridade de claims',
        description:
          'Não foi possível verificar a integridade agora. Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setCheckingClaims(false);
    }
  }

  if (loadStatus === 'loading') {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showForm = loadStatus === 'loaded' || loadStatus === 'missing';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
        </div>
        <p className="text-muted-foreground">Gerencie as configurações globais da plataforma</p>
      </div>

      {loadStatus === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível carregar as configurações</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              As configurações em vigor não foram lidas. Para não substituí-las por engano, a edição
              fica bloqueada até a leitura dar certo.
            </p>
            <p>{loadErrorDetail}</p>
            <Button variant="outline" onClick={() => loadSettings()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loadStatus === 'stale' && (
        <Alert variant="destructive">
          <AlertTitle>As configurações foram alteradas em outra sessão</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Outra alteração foi salva enquanto esta tela estava aberta. Recarregue para ver os
              valores atuais; o que você digitou aqui será descartado.
            </p>
            <Button variant="outline" onClick={() => loadSettings()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar configurações
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loadStatus === 'missing' && (
        <Alert>
          <AlertTitle>Nenhuma configuração salva ainda</AlertTitle>
          <AlertDescription>
            Os valores abaixo são os padrões aplicados hoje pelo sistema. Ao salvar, eles passam a
            ficar registrados.
          </AlertDescription>
        </Alert>
      )}

      {showForm && (
        <>
          {/* Sessão */}
          <Card>
            <CardHeader>
              <CardTitle>Sessão de Usuários</CardTitle>
              <CardDescription>Configure o tempo de expiração da sessão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="session_timeout">Tempo de sessão (minutos)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min="1"
                  max="1440"
                  value={form.session_timeout_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      session_timeout_minutes: parseInt(e.target.value) || 15,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Valor padrão: 15 minutos. Recomendado: entre 15 e 60 minutos.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Modo de Manutenção */}
          <Card>
            <CardHeader>
              <CardTitle>Modo de Manutenção</CardTitle>
              <CardDescription>Ative para bloquear o acesso ao sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="maintenance_mode" className="cursor-pointer">
                  Ativar modo de manutenção
                </Label>
                <Switch
                  id="maintenance_mode"
                  checked={form.maintenance_mode}
                  onCheckedChange={(checked) => setForm({ ...form, maintenance_mode: checked })}
                />
              </div>

              {form.maintenance_mode && (
                <div className="grid gap-2 pt-2">
                  <Label htmlFor="maintenance_message">Mensagem de manutenção</Label>
                  <Input
                    id="maintenance_message"
                    placeholder="Ex: Sistema em manutenção. Retornaremos em breve."
                    value={form.maintenance_message}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maintenance_message: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registros */}
          <Card>
            <CardHeader>
              <CardTitle>Registro de Novos Usuários</CardTitle>
              <CardDescription>Controle se novos usuários podem se registrar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="registration_enabled" className="cursor-pointer">
                  Permitir novos registros
                </Label>
                <Switch
                  id="registration_enabled"
                  checked={form.registration_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, registration_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Integridade de Custom Claims */}
      <Card>
        <CardHeader>
          <CardTitle>Integridade de Custom Claims</CardTitle>
          <CardDescription>
            Verifica se os custom claims (Firebase Auth) de cada usuário de clínica batem com o
            documento correspondente no Firestore. Essa verificação também roda automaticamente
            todos os dias — use o botão abaixo para checar sob demanda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleCheckClaimsIntegrity} disabled={checkingClaims} variant="outline">
            {checkingClaims ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verificar agora
              </>
            )}
          </Button>

          {claimsResult && (
            <div className="pt-2 space-y-3">
              {claimsResult.mismatches.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  {claimsResult.checked} usuário(s) verificado(s) — nenhuma divergência encontrada.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    {claimsResult.mismatches.length} de {claimsResult.checked} usuário(s) com
                    divergência de claims:
                  </div>
                  <div className="space-y-2">
                    {claimsResult.mismatches.map((mismatch) => (
                      <div
                        key={mismatch.uid}
                        className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
                      >
                        <p className="font-medium">
                          {mismatch.email}{' '}
                          <span className="text-muted-foreground">({mismatch.uid})</span>
                        </p>
                        <p className="text-muted-foreground">
                          Tenant: {mismatch.tenant_id} · Role: {mismatch.role}
                        </p>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {mismatch.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>
          Cancelar
        </Button>
        {showForm && (
          <Button onClick={handleSave} disabled={!canSaveSystemSettings(loadStatus, saving)}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
