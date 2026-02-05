"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ArrowLeft,
  Package,
  Users,
  FileBarChart,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ReadOnlyBanner } from "@/components/consultant/ReadOnlyBanner";
import { formatTimestamp } from "@/lib/utils";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TenantDetails {
  id: string;
  name: string;
  document_type?: string;
  document_number?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  created_at?: any;
}

interface InventoryStats {
  total_items: number;
  expiring_soon: number;
  low_stock: number;
}

interface RecentProcedure {
  id: string;
  paciente_nome: string;
  status: string;
  dt_procedimento: any;
}

export default function ClinicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { user, authorizedTenants, loading: authLoading, claims } = useAuth();

  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [stats, setStats] = useState<InventoryStats>({
    total_items: 0,
    expiring_soon: 0,
    low_stock: 0,
  });
  const [recentProcedures, setRecentProcedures] = useState<RecentProcedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to load before checking authorization
    if (authLoading) return;

    // Check authorization only after claims are loaded
    if (claims) {
      if (!authorizedTenants.includes(tenantId)) {
        router.push("/consultant/clinics");
        return;
      }
      // Authorized - load data
      if (user && tenantId) {
        loadTenantData();
      }
    }
  }, [user, tenantId, authorizedTenants, authLoading, claims]);

  const loadTenantData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      // Load tenant details
      const tenantRes = await fetch(`/api/tenants/${tenantId}/consultant`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If the endpoint returns the tenant info, use it
      // Otherwise we'll load directly from Firestore

      // Load inventory stats
      try {
        const inventoryRef = collection(db, `tenants/${tenantId}/inventory`);
        const inventorySnapshot = await getDocs(inventoryRef);

        let totalItems = 0;
        let expiringSoon = 0;
        let lowStock = 0;

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        inventorySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.quantidade_disponivel > 0) {
            totalItems++;

            // Check expiring
            if (data.dt_validade) {
              let expirationDate: Date;
              if (typeof data.dt_validade === "string") {
                if (data.dt_validade.includes("/")) {
                  const [day, month, year] = data.dt_validade.split("/");
                  expirationDate = new Date(Number(year), Number(month) - 1, Number(day));
                } else {
                  expirationDate = new Date(data.dt_validade);
                }
              } else {
                expirationDate = data.dt_validade.toDate();
              }

              if (expirationDate <= thirtyDaysFromNow) {
                expiringSoon++;
              }
            }

            // Check low stock
            if (data.quantidade_disponivel <= 5) {
              lowStock++;
            }
          }
        });

        setStats({ total_items: totalItems, expiring_soon: expiringSoon, low_stock: lowStock });
      } catch (e) {
        console.error("Error loading inventory stats:", e);
      }

      // Load recent procedures
      try {
        const proceduresRef = collection(db, `tenants/${tenantId}/solicitacoes`);
        const proceduresQuery = query(
          proceduresRef,
          orderBy("created_at", "desc"),
          limit(5)
        );
        const proceduresSnapshot = await getDocs(proceduresQuery);

        const procedures = proceduresSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as RecentProcedure[];

        setRecentProcedures(procedures);
      } catch (e) {
        console.error("Error loading procedures:", e);
      }

      // Load tenant basic info from tenants collection
      try {
        const { doc: fbDoc, getDoc } = await import("firebase/firestore");
        const tenantDoc = await getDoc(fbDoc(db, "tenants", tenantId));
        if (tenantDoc.exists()) {
          setTenant({
            id: tenantDoc.id,
            ...tenantDoc.data(),
          } as TenantDetails);
        }
      } catch (e) {
        console.error("Error loading tenant:", e);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDocument = (type?: string, number?: string): string => {
    if (!number) return "—";

    const clean = number.replace(/\D/g, "");

    if (type === "cpf" || clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      criada: { label: "Criada", variant: "outline" },
      agendada: { label: "Agendada", variant: "default" },
      concluida: { label: "Concluída", variant: "secondary" },
      aprovada: { label: "Aprovada", variant: "default" },
      reprovada: { label: "Reprovada", variant: "destructive" },
      cancelada: { label: "Cancelada", variant: "destructive" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (authLoading || loading) {
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
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push("/consultant/clinics")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="h-8 w-8 text-sky-600" />
                {tenant?.name || "Clínica"}
              </h1>
              <p className="text-muted-foreground">
                {formatDocument(tenant?.document_type, tenant?.document_number)}
              </p>
            </div>
            <Badge variant={tenant?.active ? "default" : "secondary"}>
              {tenant?.active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>

        {/* Read-Only Banner */}
        <ReadOnlyBanner />

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Itens no Estoque
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_items}</div>
              <p className="text-xs text-muted-foreground">
                produtos com estoque disponível
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Próximos a Vencer
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {stats.expiring_soon}
              </div>
              <p className="text-xs text-muted-foreground">
                nos próximos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Estoque Baixo
              </CardTitle>
              <Package className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.low_stock}
              </div>
              <p className="text-xs text-muted-foreground">
                produtos com 5 unidades ou menos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => router.push(`/consultant/clinics/${tenantId}/inventory`)}
          >
            <Package className="h-6 w-6" />
            <span>Ver Estoque</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => router.push(`/consultant/clinics/${tenantId}/procedures`)}
          >
            <Users className="h-6 w-6" />
            <span>Ver Procedimentos</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => router.push(`/consultant/clinics/${tenantId}/reports`)}
          >
            <FileBarChart className="h-6 w-6" />
            <span>Ver Relatórios</span>
          </Button>
        </div>

        {/* Recent Procedures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Procedimentos Recentes
            </CardTitle>
            <CardDescription>
              Últimos procedimentos registrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentProcedures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum procedimento registrado
              </div>
            ) : (
              <div className="space-y-3">
                {recentProcedures.map((procedure) => (
                  <div
                    key={procedure.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{procedure.paciente_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {procedure.dt_procedimento ? formatTimestamp(procedure.dt_procedimento) : "—"}
                      </p>
                    </div>
                    {getStatusBadge(procedure.status)}
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
