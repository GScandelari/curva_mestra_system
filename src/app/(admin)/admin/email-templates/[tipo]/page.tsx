'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, Send, History, RotateCcw } from 'lucide-react';
import { renderTemplate } from '@/lib/emailTemplateRendering';
import { formatTimestamp } from '@/lib/utils';
import type { EmailTemplateDoc, EmailTemplateVersion } from '@/types';

export default function EmailTemplateEditorPage() {
  const params = useParams<{ tipo: string }>();
  const tipo = params.tipo;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<EmailTemplateDoc | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<EmailTemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch(`/api/email-templates/${tipo}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar template');
      const data = json.data as EmailTemplateDoc;
      setTemplate(data);
      setSubject(data.subject);
      setBody(data.body);
    } catch (error) {
      toast({
        title: 'Erro ao carregar template',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, tipo, toast]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  function sampleValues(): Record<string, string> {
    if (!template) return {};
    return template.variables.reduce<Record<string, string>>((acc, v) => {
      acc[v.key] = v.sample;
      return acc;
    }, {});
  }

  function renderedPreview() {
    const values = sampleValues();
    return { subject: renderTemplate(subject, values), body: renderTemplate(body, values) };
  }

  async function handleSave() {
    if (!user) return;
    try {
      setSaving(true);
      const token = await user.getIdToken();
      const response = await fetch(`/api/email-templates/${tipo}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao salvar template');
      toast({ title: 'Template salvo com sucesso' });
      await loadTemplate();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail) return;
    try {
      setSendingTest(true);
      const rendered = renderedPreview();
      const sendTest = httpsCallable(functions, 'sendTemplateTestEmail');
      await sendTest({ to: testEmail, subject: rendered.subject, html: rendered.body });
      toast({ title: 'E-mail de teste enviado', description: `Enviado para ${testEmail}` });
      setTestDialogOpen(false);
      setTestEmail('');
    } catch (error) {
      toast({
        title: 'Erro ao enviar e-mail de teste',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function loadVersions() {
    if (!user) return;
    try {
      setLoadingVersions(true);
      const token = await user.getIdToken();
      const response = await fetch(`/api/email-templates/${tipo}/versions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar histórico');
      setVersions(json.data as EmailTemplateVersion[]);
    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleOpenHistory() {
    setHistoryOpen(true);
    await loadVersions();
  }

  async function handleRevert(versionId: string) {
    if (!user) return;
    try {
      setRevertingId(versionId);
      const token = await user.getIdToken();
      const response = await fetch(`/api/email-templates/${tipo}/versions/${versionId}/revert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erro ao reverter template');
      toast({ title: 'Template revertido com sucesso' });
      setHistoryOpen(false);
      await loadTemplate();
    } catch (error) {
      toast({
        title: 'Erro ao reverter',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setRevertingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Template não encontrado.</p>
      </div>
    );
  }

  const preview = renderedPreview();

  let historyContent: ReactNode;
  if (loadingVersions) {
    historyContent = (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (versions.length === 0) {
    historyContent = (
      <p className="text-sm text-muted-foreground py-4">Nenhuma versão anterior salva.</p>
    );
  } else {
    historyContent = (
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {versions.map((v) => (
          <div key={v.id} className="flex items-center justify-between border rounded p-3 gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{v.subject}</p>
              <p className="text-xs text-muted-foreground">
                {v.replaced_by_name} • {formatTimestamp(v.replaced_at)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRevert(v.id)}
              disabled={revertingId === v.id}
            >
              {revertingId === v.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reverter
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/email-templates')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{template.label}</h1>
            <p className="text-sm text-muted-foreground">{template.related_uc}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleOpenHistory}>
            <History className="mr-2 h-4 w-4" />
            Histórico
          </Button>
          <Button variant="outline" onClick={() => setTestDialogOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Enviar teste
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variáveis disponíveis</CardTitle>
          <CardDescription>
            Use as chaves abaixo entre chaves duplas no assunto ou no corpo. Variáveis marcadas com
            * são obrigatórias.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {template.variables.map((v) => (
            <Badge key={v.key} variant={v.required ? 'default' : 'outline'} title={v.label}>
              {`{{${v.key}}}`}
              {v.required && ' *'}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assunto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          <p className="text-sm text-muted-foreground truncate">
            Pré-visualização: {preview.subject}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Corpo (HTML)</CardTitle>
          <CardDescription>
            A pré-visualização à direita atualiza em tempo real, com os valores de exemplo de cada
            variável.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={24}
              className="font-mono text-sm resize-none min-h-[600px]"
            />
            <iframe
              srcDoc={preview.body}
              title="Pré-visualização do corpo do e-mail"
              className="w-full min-h-[600px] border rounded-md bg-white"
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar e-mail de teste</DialogTitle>
            <DialogDescription>
              Envia o conteúdo em edição (ainda não salvo), com os valores de exemplo das variáveis,
              com o prefixo &quot;[TESTE]&quot; no assunto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-email">E-mail de destino</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSendTest} disabled={sendingTest || !testEmail}>
              {sendingTest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de versões</DialogTitle>
            <DialogDescription>
              Reverter cria uma nova entrada no histórico com o conteúdo atual — nenhuma versão é
              apagada.
            </DialogDescription>
          </DialogHeader>
          {historyContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}
