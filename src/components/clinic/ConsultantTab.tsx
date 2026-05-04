'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  Mail,
  Phone,
  Copy,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Consultant, ConsultantClaim } from '@/types';

export default function ConsultantTab() {
  const { user, tenantId, role } = useAuth();
  const { toast } = useToast();
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [pendingClaims, setPendingClaims] = useState<ConsultantClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const isClinicAdmin = role === 'clinic_admin';

  useEffect(() => {
    if (user && tenantId) {
      loadData();
    }
  }, [user, tenantId]);

  const loadData = async () => {
    if (!user || !tenantId) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const consultantRes = await fetch(`/api/tenants/${tenantId}/consultant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const consultantData = await consultantRes.json();
      setConsultant(consultantRes.ok && consultantData.data ? consultantData.data : null);

      const claimsRes = await fetch(
        `/api/consultants/claims?tenant_id=${tenantId}&status=pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const claimsData = await claimsRes.json();
      if (claimsRes.ok) {
        setPendingClaims(claimsData.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do consultor:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: 'Código copiado' });
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/consultants/claims/${claimId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao aprovar solicitação');
      toast({ title: 'Solicitação aprovada com sucesso' });
      loadData();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao aprovar solicitação', variant: 'destructive' });
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    if (!user) return;
    const reason = prompt('Motivo da rejeição (opcional):');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/consultants/claims/${claimId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao rejeitar solicitação');
      toast({ title: 'Solicitação rejeitada' });
      loadData();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao rejeitar solicitação', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Claims */}
      {pendingClaims.length > 0 && isClinicAdmin && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Clock className="h-5 w-5" />
              Solicitações de Vínculo Pendentes
            </CardTitle>
            <CardDescription className="text-amber-700">
              Consultores solicitando vínculo com sua clínica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white p-4 rounded-lg border border-amber-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{claim.consultant_name}</p>
                    <p className="text-sm text-muted-foreground">Código: {claim.consultant_code}</p>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-800">
                    Pendente
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApproveClaim(claim.id)}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectClaim(claim.id)}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
              <p className="text-muted-foreground max-w-md mx-auto">
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
  );
}
