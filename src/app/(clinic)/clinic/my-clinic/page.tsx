'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, UserCheck, TrendingDown } from 'lucide-react';

import dynamic from 'next/dynamic';

const ClinicInfoTab = dynamic(() => import('@/components/clinic/ClinicInfoTab'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

const UsersTab = dynamic(() => import('@/components/clinic/UsersTab'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

const ConsultantTab = dynamic(() => import('@/components/clinic/ConsultantTab'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

const StockLimitsTab = dynamic(() => import('@/components/clinic/StockLimitsTab'), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

export default function MyClinicPage() {
  const searchParams = useSearchParams();
  const { claims } = useAuth();

  const isAdmin = claims?.role === 'clinic_admin';
  const defaultTab = searchParams.get('tab') || 'clinic';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAdmin && (activeTab === 'users' || activeTab === 'stock_limits')) {
      setActiveTab('clinic');
    }
  }, [isAdmin, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Minha Clínica</h1>
        <p className="text-muted-foreground">
          Gerencie as informações, usuários e consultor da sua clínica
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-2'} mb-6`}>
          <TabsTrigger value="clinic" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Clínica
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="stock_limits" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Limite de Estoque
            </TabsTrigger>
          )}
          <TabsTrigger value="consultant" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Consultor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicInfoTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="stock_limits">
            <StockLimitsTab />
          </TabsContent>
        )}

        <TabsContent value="consultant">
          <ConsultantTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
