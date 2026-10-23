'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Building2, Search, ArrowRight, Copy, TrendingDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAsyncState } from '@/hooks/useAsyncState';
import { readApiData, resolveLoadView } from '@/lib/loadErrors';
import { LoadErrorAlert, UnavailableValue } from '@/components/ui/load-error-alert';
import {
  getReplenishmentProjections,
  countProjectionsWithinHorizon,
} from '@/lib/services/projectionService';
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
  const [projectionsCount, setProjectionsCount] = useState<number | null>(null);
  const [loadingProjections, setLoadingProjections] = useState(true);

  // UX-051: perfil e clínicas carregam de forma independente, cada um com o
  // próprio erro — a falha de um não esconde o outro nem vira estado vazio.
  const profile = useAsyncState();
  const clinicsLoad = useAsyncState();
  const runProfile = profile.run;
  const runClinics = clinicsLoad.run;
  // refreshClaims muda de identidade a cada render; via ref não reinicia a leitura.
  const refreshClaimsRef = useRef(refreshClaims);
  refreshClaimsRef.current = refreshClaims;

  const loadProfile = useCallback(() => {
    if (!user || !consultantId) return;
    runProfile(
      async ({ isCurrent }) => {
        const token = await user.getIdToken();
        const res = await fetch(`/api/consultants/${consultantId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<Consultant>(res);
        if (isCurrent()) setConsultant(data ?? null);
      },
      'Erro ao carregar perfil do consultor:',
      'Não foi possível carregar seu código de consultor'
    );
  }, [user, consultantId, runProfile]);

  const loadClinics = useCallback(async () => {
    if (!user) return;
    let loaded = false;
    await runClinics(
      async ({ isCurrent }) => {
        const token = await user.getIdToken();
        const res = await fetch('/api/consultants/me/clinics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiData<ClinicSummary[]>(res);
        if (!isCurrent()) return;
        setClinics(data ?? []);
        loaded = true;
      },
      'Erro ao carregar clínicas:',
      'Não foi possível carregar suas clínicas'
    );
    // Sincroniza vínculos só após leitura bem-sucedida; falha aqui não é erro de carregamento.
    if (loaded) {
      refreshClaimsRef.current().catch((e) => console.error('Erro ao sincronizar vínculos:', e));
    }
  }, [user, runClinics]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadClinics();
  }, [loadClinics]);

  const clinicsView = resolveLoadView({
    loading: clinicsLoad.loading,
    error: !!clinicsLoad.error,
    isEmpty: clinics.length === 0,
  });
  const clinicsReady = clinicsView === 'ready' || clinicsView === 'empty';

  // Projeção de reposição (UC-52) — agrega a contagem de todas as clínicas
  // vinculadas ativas (RF-03/RNF-02). Falha em uma clínica individual não
  // deve derrubar o card inteiro: soma as demais e loga a falha parcial.
  // Só calcula depois que as clínicas foram lidas: com erro, o card fica "Indisponível".
  useEffect(() => {
    if (!clinicsReady) return;
    const activeClinics = clinics.filter((c) => c.active);
    if (activeClinics.length === 0) {
      setProjectionsCount(clinics.length === 0 ? null : 0);
      setLoadingProjections(false);
      return;
    }

    setLoadingProjections(true);
    Promise.allSettled(activeClinics.map((clinic) => getReplenishmentProjections(clinic.id))).then(
      (results) => {
        let total = 0;
        let hasFailure = false;
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            total += countProjectionsWithinHorizon(result.value, new Date(), 30);
          } else {
            hasFailure = true;
            console.error('Erro ao carregar projeção de reposição de uma clínica:', result.reason);
          }
        });
        if (hasFailure) {
          toast({
            title: 'Não foi possível carregar a projeção de todas as clínicas',
            variant: 'destructive',
          });
        }
        setProjectionsCount(total);
        setLoadingProjections(false);
      }
    );
  }, [clinics, clinicsReady, toast]);

  const copyCode = () => {
    if (consultant?.code) {
      navigator.clipboard.writeText(consultant.code);
      toast({ title: 'Código copiado' });
    }
  };

  const firstName = consultant?.name?.split(' ')[0];
  const clinicsUnavailable = clinicsView === 'error';

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
            {firstName
              ? `Bem-vindo ao Portal do Consultor, ${firstName}`
              : 'Bem-vindo ao Portal do Consultor'}
          </p>
        </div>

        {/* Consultant Code Card */}
        {profile.error && !profile.loading ? (
          <LoadErrorAlert
            title="Não foi possível carregar seu código de consultor"
            detail={profile.errorDetail}
            onRetry={loadProfile}
          />
        ) : (
          <Card className="bg-gradient-to-r from-sky-500 to-sky-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sky-100 text-sm mb-1">Seu código de consultor</p>
                  {profile.loading ? (
                    <Skeleton className="h-10 w-40 bg-white/30" />
                  ) : (
                    <p className="text-4xl font-bold font-mono tracking-widest">
                      {consultant?.code}
                    </p>
                  )}
                  <p className="text-sky-100 text-sm mt-2">
                    Compartilhe este código com as clínicas para vincular-se
                  </p>
                </div>
                {consultant?.code && !profile.loading && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={copyCode}
                    className="bg-white/20 hover:bg-white/30 text-white"
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clínicas Vinculadas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clinicsView === 'loading' ? (
                <Skeleton className="h-8 w-16" />
              ) : clinicsUnavailable ? (
                <UnavailableValue />
              ) : (
                <>
                  <div className="text-2xl font-bold">{clinics.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {clinics.filter((c) => c.active).length} ativas
                  </p>
                </>
              )}
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

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push('/consultant/clinics')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projeção de Reposição</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {clinicsUnavailable ? (
                <UnavailableValue />
              ) : loadingProjections ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{projectionsCount ?? 0}</div>
                  <p className="text-xs text-muted-foreground">
                    produtos em risco nas clínicas vinculadas
                  </p>
                </>
              )}
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
            {clinicsView === 'loading' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : clinicsView === 'error' ? (
              <LoadErrorAlert
                title="Não foi possível carregar suas clínicas"
                description="Seus vínculos não foram alterados. Tente novamente antes de buscar ou pedir vínculo com uma clínica."
                detail={clinicsLoad.errorDetail}
                onRetry={loadClinics}
              />
            ) : clinicsView === 'empty' ? (
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
