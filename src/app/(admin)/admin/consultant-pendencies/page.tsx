'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatTimestamp } from '@/lib/utils';
import { getPendencyTypeLabel, isRequestExpired } from '@/lib/consultantRequests';
import type { ConsultantTransferRequest } from '@/types';

/**
 * Tela somente leitura (RNF-04) — nenhum botão de ação, mesmo a API
 * já aceitando is_system_admin como aprovador.
 */
export default function ConsultantPendenciesPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ConsultantTransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const res = await fetch(`/api/consultants/transfer-requests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setRequests(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar pendências de consultor:', error);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, typeFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const getStatusBadge = (request: ConsultantTransferRequest) => {
    if (request.status === 'pending' && isRequestExpired(request)) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    if (request.status === 'approved') return <Badge>Aprovado</Badge>;
    if (request.status === 'rejected') return <Badge variant="destructive">Rejeitado</Badge>;
    if (request.status === 'cancelled') return <Badge variant="secondary">Cancelado</Badge>;
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800">
        Pendente
      </Badge>
    );
  };

  const getConsultantsCell = (request: ConsultantTransferRequest) => {
    if (getPendencyTypeLabel(request.type) === 'Convite') {
      return (
        <span>
          Convidado: {request.requesting_consultant_name} ({request.requesting_consultant_code})
        </span>
      );
    }
    return (
      <span>
        {request.requesting_consultant_name} ({request.requesting_consultant_code}) →{' '}
        {request.current_consultant_name || '—'}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="h-8 w-8 text-primary" />
          Pendências de Consultor
        </h1>
        <p className="text-muted-foreground">
          Convites e pedidos de transferência de vínculo consultor–clínica (somente leitura)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre por status ou tipo de pendência</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="invite">Convite</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pendências</CardTitle>
          <CardDescription>
            {requests.length} {requests.length === 1 ? 'registro' : 'registros'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">Nenhuma pendência encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Consultor(es)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.tenant_name}</div>
                      <div className="text-xs text-muted-foreground">{request.tenant_document}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getPendencyTypeLabel(request.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getConsultantsCell(request)}</TableCell>
                    <TableCell>{getStatusBadge(request)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(request.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
