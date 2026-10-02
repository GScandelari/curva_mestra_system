'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ChevronRight } from 'lucide-react';
import type { EmailTemplateDoc, EmailTemplateCategory } from '@/types';

const CATEGORY_LABEL: Record<EmailTemplateCategory, string> = {
  email: 'E-mail',
  internal_notification: 'Notificação Interna',
  special_mechanism: 'Mecanismo Próprio',
};

// Gatilho #9 (tenants/create, corpo livre por criação de clínica) — RN-14 do
// UC-55: não migra para email_templates, exibido apenas informativamente.
const FREE_BODY_TRIGGER = {
  label: 'Envio de E-mail de Boas-Vindas por Clínica',
  related_uc: 'UC-21',
  note: 'Gerenciado em Cadastro de Clínica — corpo livre por envio, não editável aqui.',
};

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplateDoc[]>([]);

  const loadTemplates = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/email-templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Erro ao carregar templates de e-mail');
      }

      setTemplates(json.data as EmailTemplateDoc[]);
    } catch (error) {
      toast({
        title: 'Erro ao carregar templates',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = templates.reduce<Record<string, EmailTemplateDoc[]>>((acc, template) => {
    acc[template.category] ??= [];
    acc[template.category].push(template);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Mail className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Templates de E-mail</h1>
        </div>
        <p className="text-muted-foreground">
          Edite o assunto e o corpo dos e-mails enviados automaticamente pelo sistema
        </p>
      </div>

      {(Object.keys(grouped) as EmailTemplateCategory[]).map((category) => (
        <div key={category} className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            {CATEGORY_LABEL[category]}
          </h2>
          <div className="grid gap-3">
            {grouped[category].map((template) => (
              <Link key={template.tipo} href={`/admin/email-templates/${template.tipo}`}>
                <Card className="hover:border-primary transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{template.label}</CardTitle>
                      <CardDescription>{template.related_uc}</CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">
          {CATEGORY_LABEL.special_mechanism}
        </h2>
        <Card className="opacity-70">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                {FREE_BODY_TRIGGER.label}
                <Badge variant="outline">Não editável aqui</Badge>
              </CardTitle>
              <CardDescription>
                {FREE_BODY_TRIGGER.related_uc} — {FREE_BODY_TRIGGER.note}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
