'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRightLeft, CheckCircle2, XCircle, Building2, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatTimestamp } from '@/lib/utils';
import type { ConsultantTransferRequest } from '@/types';

export default function TransferRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ConsultantTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConsultantTransferRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/consultants/transfer-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRequests(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos de transferência:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: ConsultantTransferRequest) => {
    if (!user) return;
    setProcessing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/consultants/transfer-requests/${request.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar');
      toast({ title: 'Transferência aprovada com sucesso' });
      loadRequests();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao aprovar transferência', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!user || !selectedRequest) return;
    setProcessing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/consultants/transfer-requests/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao rejeitar');
      toast({ title: 'Pedido rejeitado' });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
      loadRequests();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao rejeitar pedido', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const openRejectDialog = (request: ConsultantTransferRequest) => {
    setSelectedRequest(request);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  const getStatusBadge = (status: ConsultantTransferRequest['status']) => {
    if (status === 'approved')
      return <Badge variant="default">Aprovado</Badge>;
    if (status === 'rejected')
      return <Badge variant="destructive">Rejeitado</Badge>;
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800">
        Pendente
      </Badge>
    );
  };

  const RequestCard = ({ request }: { request: ConsultantTransferRequest }) => (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{request.tenant_name}</p>
            <p className="text-xs text-muted-foreground">{request.tenant_document}</p>
          </div>
        </div>
        {getStatusBadge(request.status)}
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground">Solicitante:</span>{' '}
          {request.requesting_consultant_name} ({request.requesting_consultant_code})
        </p>
        <p>
          <span className="font-medium text-foreground">Recebido em:</span>{' '}
          {formatTimestamp(request.created_at)}
        </p>
        {request.status === 'rejected' && request.rejection_reason && (
          <p>
            <span className="font-medium text-foreground">Motivo:</span>{' '}
            {request.rejection_reason}
          </p>
        )}
      </div>

      {request.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => handleApprove(request)}
            disabled={processing}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => openRejectDialog(request)}
            disabled={processing}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Rejeitar
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="container py-8 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="h-8 w-8 text-sky-600" />
            Pedidos de Transferência
          </h1>
          <p className="text-muted-foreground">
            Gerencie pedidos de consultores que querem assumir suas clínicas vinculadas
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pendentes
                {pending.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Pedidos Pendentes</CardTitle>
                  <CardDescription>
                    Pedidos aguardando sua decisão
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pending.length === 0 ? (
                    <div className="text-center py-12">
                      <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">Nenhum pedido de transferência pendente</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pending.map((r) => (
                        <RequestCard key={r.id} request={r} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico</CardTitle>
                  <CardDescription>Pedidos já processados</CardDescription>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Nenhum pedido no histórico</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((r) => (
                        <RequestCard key={r.id} request={r} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pedido de Transferência</DialogTitle>
            <DialogDescription>
              Informe um motivo para rejeitar o pedido de{' '}
              {selectedRequest?.requesting_consultant_name} para a clínica{' '}
              {selectedRequest?.tenant_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo da rejeição..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              disabled={processing}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={processing}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
