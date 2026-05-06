'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, Building2, Search, ArrowRight, Copy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Consultant } from '@/types';

interface ClinicSummary {
  id: string;
  name: string;
  active: boolean;
}

export default function ConsultantDashboardPage() {
  const router = useRouter();
  const { user, consultantId, refreshClaims } = useAuth();
  const { toast } = useToast();
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      // Load consultant profile
      const consultantRes = await fetch(`/api/consultants/${consultantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const consultantData = await consultantRes.json();
      if (consultantRes.ok) {
        setConsultant(consultantData.data);
      }

      // Load clinics
      const clinicsRes = await fetch('/api/consultants/me/clinics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const clinicsData = await clinicsRes.json();
      if (clinicsRes.ok) {
        setClinics(clinicsData.data || []);
        await refreshClaims();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
    // refreshClaims e toast são omitidos das deps: não são refs estáveis em useAuth/useToast
    // e não afetam quando o carregamento deve ser re-executado (apenas user/consultantId determinam isso)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, consultantId]);

  useEffect(() => {
    if (user && consultantId) {
      void loadDashboardData();
    }
  }, [user, consultantId, loadDashboardData]);

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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-sky-600" />
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao Portal do Consultor, {consultant?.name?.split(' ')[0]}
          </p>
        </div>

        {/* Consultant Code Card */}
        <Card className="bg-gradient-to-r from-sky-500 to-sky-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sky-100 text-sm mb-1">Seu código de consultor</p>
                <p className="text-4xl font-bold font-mono tracking-widest">{consultant?.code}</p>
                <p className="text-sky-100 text-sm mt-2">
                  Compartilhe este código com as clínicas para vincular-se
                </p>
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={copyCode}
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clínicas Vinculadas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clinics.length}</div>
              <p className="text-xs text-muted-foreground">
                {clinics.filter((c) => c.active).length} ativas
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/consultant/clinics/search')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Buscar Clínicas</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Encontre e vincule-se a novas clínicas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* My Clinics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Minhas Clínicas</CardTitle>
                <CardDescription>Clínicas vinculadas à sua conta</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/consultant/clinics')}
              >
                Ver Todas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {clinics.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não possui clínicas vinculadas
                </p>
                <Button
                  onClick={() => router.push('/consultant/clinics/search')}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Clínicas
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clinics.slice(0, 6).map((clinic) => (
                  <div
                    key={clinic.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/consultant/clinics/${clinic.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-sky-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{clinic.name}</p>
                        <Badge
                          variant={clinic.active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {clinic.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    </div>
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
