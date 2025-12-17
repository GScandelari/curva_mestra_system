"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Bell } from "lucide-react";

// Import page components (we'll create these next)
import dynamic from "next/dynamic";

const UsersTab = dynamic(() => import("@/components/clinic/UsersTab"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

const LicenseTab = dynamic(() => import("@/components/clinic/LicenseTab"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

const AlertsTab = dynamic(() => import("@/components/clinic/AlertsTab"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});

export default function MyClinicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { claims } = useAuth();

  const isAdmin = claims?.role === "clinic_admin";
  const defaultTab = searchParams.get("tab") || "license";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sincronizar activeTab com URL ao montar ou quando searchParams mudar
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  // Redirect non-admins if they try to access admin-only tabs
  useEffect(() => {
    if (!isAdmin && (activeTab === "users" || activeTab === "alerts")) {
      setActiveTab("license");
    }
  }, [isAdmin, activeTab]);

  // Handler para mudança de tab
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Atualizar URL sem reload usando window.history
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.pushState({}, "", url.toString());
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Minha Clínica</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, licença e configurações de alertas da sua clínica
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} mb-6`}>
          <TabsTrigger value="license" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Licença
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alertas
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="license">
          <LicenseTab />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>

            <TabsContent value="alerts">
              <AlertsTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
