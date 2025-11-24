"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Bell, Package, Calendar, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationSettings,
  saveNotificationSettings,
  initializeNotificationSettings,
} from "@/lib/services/notificationService";
import type { NotificationSettings } from "@/types/notification";
import { Timestamp } from "firebase/firestore";

export default function ClinicSettingsPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === "clinic_admin";

  // Carregar configurações
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId || !user) return;

      try {
        setLoading(true);
        setError("");

        let settingsData = await getNotificationSettings(tenantId);

        // Se não existir, inicializar com valores padrão
        if (!settingsData) {
          await initializeNotificationSettings(tenantId, user.uid);
          settingsData = await getNotificationSettings(tenantId);
        }

        setSettings(settingsData);
      } catch (err: any) {
        console.error("Erro ao carregar configurações:", err);
        setError("Erro ao carregar configurações");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [tenantId, user]);

  // Salvar configurações
  const handleSave = async () => {
    if (!tenantId || !user || !settings) return;

    try {
      setSaving(true);
      setError("");

      await saveNotificationSettings(tenantId, settings, user.uid);

      toast({
        title: "Configurações salvas",
        description: "Suas preferências foram atualizadas com sucesso.",
      });
    } catch (err: any) {
      console.error("Erro ao salvar configurações:", err);
      setError("Erro ao salvar configurações");
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Update handlers
  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
        <ClinicLayout>
          <div className="container py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Apenas administradores podem acessar as configurações.
              </AlertDescription>
            </Alert>
          </div>
        </ClinicLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["clinic_admin"]}>
      <ClinicLayout>
        <div className="container py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Configurações</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie as preferências de notificações e alertas da clínica
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : settings ? (
            <div className="space-y-6">
              {/* Alertas de Vencimento */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    <CardTitle>Alertas de Vencimento</CardTitle>
                  </div>
                  <CardDescription>
                    Configure alertas para produtos próximos do vencimento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-expiry">
                        Ativar alertas de vencimento
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receber notificações sobre produtos próximos do vencimento
                      </p>
                    </div>
                    <Switch
                      id="enable-expiry"
                      checked={settings.enable_expiry_alerts}
                      onCheckedChange={(checked) =>
                        updateSetting("enable_expiry_alerts", checked)
                      }
                    />
                  </div>

                  {settings.enable_expiry_alerts && (
                    <div className="space-y-2">
                      <Label htmlFor="expiry-days">
                        Dias de antecedência para alerta
                      </Label>
                      <Input
                        id="expiry-days"
                        type="number"
                        min="1"
                        max="365"
                        value={settings.expiry_warning_days}
                        onChange={(e) =>
                          updateSetting(
                            "expiry_warning_days",
                            parseInt(e.target.value) || 30
                          )
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Produtos que vencem em até {settings.expiry_warning_days}{" "}
                        dias geram alerta
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alertas de Estoque Baixo */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-yellow-500" />
                    <CardTitle>Alertas de Estoque Baixo</CardTitle>
                  </div>
                  <CardDescription>
                    Configure alertas para produtos com estoque baixo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-low-stock">
                        Ativar alertas de estoque baixo
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receber notificações quando produtos atingirem quantidade mínima
                      </p>
                    </div>
                    <Switch
                      id="enable-low-stock"
                      checked={settings.enable_low_stock_alerts}
                      onCheckedChange={(checked) =>
                        updateSetting("enable_low_stock_alerts", checked)
                      }
                    />
                  </div>

                  {settings.enable_low_stock_alerts && (
                    <div className="space-y-2">
                      <Label htmlFor="low-stock-threshold">
                        Quantidade mínima (limite padrão)
                      </Label>
                      <Input
                        id="low-stock-threshold"
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.low_stock_threshold}
                        onChange={(e) =>
                          updateSetting(
                            "low_stock_threshold",
                            parseInt(e.target.value) || 10
                          )
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Produtos com menos de {settings.low_stock_threshold}{" "}
                        unidades geram alerta
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alertas de Solicitações */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-500" />
                    <CardTitle>Alertas de Solicitações</CardTitle>
                  </div>
                  <CardDescription>
                    Configure alertas sobre mudanças de status nas solicitações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-requests">
                        Ativar alertas de solicitações
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receber notificações sobre aprovações e reprovações
                      </p>
                    </div>
                    <Switch
                      id="enable-requests"
                      checked={settings.enable_request_alerts}
                      onCheckedChange={(checked) =>
                        updateSetting("enable_request_alerts", checked)
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Preferências de Notificação */}
              <Card>
                <CardHeader>
                  <CardTitle>Preferências de Notificação</CardTitle>
                  <CardDescription>
                    Personalize como você recebe as notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notification-sound">Som de notificação</Label>
                      <p className="text-sm text-muted-foreground">
                        Tocar som quando receber novas notificações
                      </p>
                    </div>
                    <Switch
                      id="notification-sound"
                      checked={settings.notification_sound}
                      onCheckedChange={(checked) =>
                        updateSetting("notification_sound", checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">
                        Notificações por e-mail
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receber alertas importantes por e-mail (em breve)
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={settings.email_notifications}
                      onCheckedChange={(checked) =>
                        updateSetting("email_notifications", checked)
                      }
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Botão Salvar */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível carregar as configurações.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ClinicLayout>
    </ProtectedRoute>
  );
}
