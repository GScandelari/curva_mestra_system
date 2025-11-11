"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Package,
  Calendar,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  FileText,
  Barcode,
} from "lucide-react";
import {
  getInventoryItem,
  type InventoryItem,
} from "@/lib/services/inventoryService";

export default function InventoryItemPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const params = useParams();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tenantId = claims?.tenant_id;
  const itemId = params.id as string;

  useEffect(() => {
    async function loadItem() {
      if (!tenantId || !itemId) return;

      try {
        setLoading(true);
        setError("");

        const data = await getInventoryItem(tenantId, itemId);
        if (!data) {
          setError("Produto não encontrado");
          return;
        }

        setItem(data);
      } catch (err: any) {
        console.error("Erro ao carregar produto:", err);
        setError("Erro ao carregar produto");
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [tenantId, itemId]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getDaysUntilExpiry = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (date: Date) => {
    const days = getDaysUntilExpiry(date);

    if (days < 0) {
      return {
        text: "Vencido",
        variant: "destructive" as const,
        icon: AlertTriangle,
      };
    }
    if (days <= 7) {
      return {
        text: `Vence em ${days} dias`,
        variant: "destructive" as const,
        icon: AlertTriangle,
      };
    }
    if (days <= 30) {
      return {
        text: `Vence em ${days} dias`,
        variant: "warning" as const,
        icon: AlertTriangle,
      };
    }
    return {
      text: `Vence em ${days} dias`,
      variant: "default" as const,
      icon: Calendar,
    };
  };

  const getStockStatus = (quantity: number, initial: number) => {
    const percentage = (quantity / initial) * 100;

    if (quantity === 0) {
      return {
        text: "Esgotado",
        variant: "destructive" as const,
        icon: TrendingDown,
      };
    }
    if (quantity < 10 || percentage < 20) {
      return {
        text: "Estoque Baixo",
        variant: "warning" as const,
        icon: AlertTriangle,
      };
    }
    return {
      text: "Estoque Normal",
      variant: "default" as const,
      icon: Package,
    };
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
        <ClinicLayout>
          <div className="container py-8">
            <div className="space-y-6">
              <Skeleton className="h-10 w-48" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            </div>
          </div>
        </ClinicLayout>
      </ProtectedRoute>
    );
  }

  if (error || !item) {
    return (
      <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
        <ClinicLayout>
          <div className="container py-8">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-2xl font-bold">
                {error || "Produto não encontrado"}
              </h2>
              <Button onClick={() => router.push("/clinic/inventory")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Inventário
              </Button>
            </div>
          </div>
        </ClinicLayout>
      </ProtectedRoute>
    );
  }

  const expiryStatus = getExpiryStatus(item.dt_validade);
  const stockStatus = getStockStatus(
    item.quantidade_disponivel,
    item.quantidade_inicial
  );
  const ExpiryIcon = expiryStatus.icon;
  const StockIcon = stockStatus.icon;

  return (
    <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
      <ClinicLayout>
        <div className="container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/clinic/inventory")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div className="flex-1">
                <h2 className="text-3xl font-bold tracking-tight">
                  {item.nome_produto}
                </h2>
                <p className="text-muted-foreground">
                  Código: {item.codigo_produto}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={expiryStatus.variant}>
                  <ExpiryIcon className="mr-1 h-3 w-3" />
                  {expiryStatus.text}
                </Badge>
                <Badge variant={stockStatus.variant}>
                  <StockIcon className="mr-1 h-3 w-3" />
                  {stockStatus.text}
                </Badge>
              </div>
            </div>

            {/* Main Info Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Produto</CardTitle>
                  <CardDescription>
                    Detalhes e identificação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Barcode className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Código do Produto</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {item.codigo_produto}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Nome do Produto</p>
                      <p className="text-sm text-muted-foreground">
                        {item.nome_produto}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Lote</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {item.lote}
                      </p>
                    </div>
                  </div>

                  {item.nf_numero && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Nota Fiscal</p>
                        <p className="text-sm text-muted-foreground">
                          NF-e {item.nf_numero}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Estoque e Valores */}
              <Card>
                <CardHeader>
                  <CardTitle>Estoque e Valores</CardTitle>
                  <CardDescription>
                    Quantidades e informações financeiras
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Quantidade Inicial</p>
                      <p className="text-2xl font-bold">
                        {item.quantidade_inicial}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Quantidade Disponível
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {item.quantidade_disponivel}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Utilizado</span>
                      <span className="font-medium">
                        {item.quantidade_inicial - item.quantidade_disponivel}{" "}
                        unidades
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${
                            ((item.quantidade_inicial -
                              item.quantidade_disponivel) /
                              item.quantidade_inicial) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Valor Unitário</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(item.valor_unitario)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Valor Total em Estoque
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {formatCurrency(
                            item.valor_unitario * item.quantidade_disponivel
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Datas e Histórico */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Datas Importantes</CardTitle>
                  <CardDescription>
                    Validade e entrada no sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Data de Validade</p>
                      <p className="text-lg font-semibold">
                        {formatDate(item.dt_validade)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {expiryStatus.text}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Data de Entrada</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(item.dt_entrada)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Informações do Sistema</CardTitle>
                  <CardDescription>
                    Registro e atualizações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Cadastrado em</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Última atualização
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(item.updated_at)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant={item.active ? "default" : "secondary"}>
                      {item.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ClinicLayout>
    </ProtectedRoute>
  );
}
