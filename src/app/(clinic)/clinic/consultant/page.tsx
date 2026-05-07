'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Mail, Phone, Copy, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Consultant } from '@/types';

export default function ClinicConsultantPage() {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !tenantId) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const consultantRes = await fetch(`/api/tenants/${tenantId}/consultant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const consultantData = await consultantRes.json();
      if (consultantRes.ok && consultantData.data) {
        setConsultant(consultantData.data);
      } else {
        setConsultant(null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [user, tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: 'Código copiado' });
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="h-8 w-8 text-primary" />
            Consultor
          </h1>
          <p className="text-muted-foreground">Consultor vinculado à sua clínica</p>
        </div>

        {/* Current Consultant */}
        {consultant ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Consultor Atual</CardTitle>
                  <CardDescription>Consultor vinculado à sua clínica</CardDescription>
                </div>
                <Badge variant={consultant.status === 'active' ? 'default' : 'destructive'}>
                  {consultant.status === 'active' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Consultant Code */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Código do Consultor</p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-3xl font-bold font-mono tracking-widest text-primary">
                    {consultant.code}
                  </p>
                  <Button variant="ghost" size="icon" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Consultant Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{consultant.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </span>
                  <span className="font-medium">{consultant.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </span>
                  <span className="font-medium">{consultant.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhum Consultor Vinculado</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Sua clínica ainda não possui um consultor vinculado. O consultor pode solicitar
                  vínculo informando seu CNPJ/CPF.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Sobre Consultores
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Consultores têm acesso somente leitura aos dados da clínica</li>
                <li>• Cada clínica pode ter apenas um consultor vinculado</li>
                <li>• O consultor pode acompanhar estoque, procedimentos e relatórios</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
