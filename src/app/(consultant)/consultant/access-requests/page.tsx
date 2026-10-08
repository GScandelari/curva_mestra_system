'use client';

/**
 * UC-56 — Consultor aprova solicitação de acesso.
 * Lista TODAS as solicitações pendentes (RN-04); o botão "Aprovar" só fica
 * habilitado quando o backend anota `eligible_now` (RN-01 a RN-05). A decisão
 * final é sempre revalidada em POST /api/access-requests/[id]/approve-consultant.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckCircle2, UserPlus, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ConsultantPendingAccessRequest {
  id: string;
  role: 'especialista' | 'consultor';
  full_name: string;
  email: string;
  phone: string;
  council_number: string;
  business_name: string;
  volume: string | null;
  consultant_code: string | null;
  consultant_id: string | null;
  consultant_name: string | null;
  created_at: string | null;
  linked_to_me: boolean;
  exclusivity_expires_at: string | null;
  eligible_now: boolean;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LinkBadge({ request }: { request: ConsultantPendingAccessRequest }) {
  if (!request.consultant_id) {
    return <Badge variant="secondary">Sem consultor vinculado</Badge>;
  }
  if (request.linked_to_me) {
    return <Badge className="bg-sky-600 hover:bg-sky-600">Vinculada a você</Badge>;
  }
  if (!request.eligible_now) {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800">
        Exclusiva de {request.consultant_name || 'outro consultor'} até{' '}
        {formatDateTime(request.exclusivity_expires_at)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      Exclusividade de {request.consultant_name || 'outro consultor'} expirada
    </Badge>
  );
}

export default function ConsultantAccessRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ConsultantPendingAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<ConsultantPendingAccessRequest | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/consultants/me/pending-access-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar solicitações');
      setRequests(data.data || []);
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Erro ao carregar solicitações',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (request: ConsultantPendingAccessRequest) => {
    if (!user) return;
    setProcessingId(request.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/access-requests/${request.id}/approve-consultant`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar solicitação');
      toast({
        title: 'Solicitação aprovada!',
        description: `Clínica criada e e-mail de acesso enviado para ${request.email}.`,
      });
    } catch (error: unknown) {
      toast({
        title: error instanceof Error ? error.message : 'Erro ao aprovar solicitação',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
      loadRequests();
    }
  };

  return (
    <div className="container py-8 max-w-3xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-sky-600" />
            Solicitações de Acesso
          </h1>
          <p className="text-muted-foreground">
            Solicitações pendentes de novos especialistas. Solicitações vinculadas a outro consultor
            ficam exclusivas dele por 48h a partir do envio.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pendentes</CardTitle>
            <CardDescription>
              {loading ? 'Carregando...' : `${requests.length} solicitação(ões) pendente(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">Nenhuma solicitação pendente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    data-testid="consultant-access-request"
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{request.full_name}</p>
                        <p className="text-sm text-muted-foreground">{request.email}</p>
                      </div>
                      <LinkBadge request={request} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium text-foreground">
                          {request.role === 'especialista' ? 'Clínica:' : 'Região / carteira:'}
                        </span>{' '}
                        {request.business_name}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {request.role === 'especialista' ? 'Conselho:' : 'ID Rennova:'}
                        </span>{' '}
                        {request.council_number}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Recebida em:</span>{' '}
                        {formatDateTime(request.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setApproveTarget(request)}
                      disabled={!request.eligible_now || processingId !== null}
                    >
                      {request.eligible_now ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Aprovar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
        title="Aprovar solicitação?"
        description={`Será criada a clínica "${approveTarget?.business_name}" e ${approveTarget?.full_name} receberá por e-mail o link para definir a senha. Esta ação é irreversível.`}
        confirmLabel="Aprovar"
        onConfirm={() => {
          const target = approveTarget;
          setApproveTarget(null);
          if (target) handleApprove(target);
        }}
      />
    </div>
  );
}
