"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Settings, Save, Loader2 } from "lucide-react";
import { SystemSettings } from "@/types";

export default function SystemSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<SystemSettings>({
    id: "global",
    session_timeout_minutes: 15,
    maintenance_mode: false,
    maintenance_message: "",
    registration_enabled: true,
    updated_by: "",
    updated_at: null as any,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const docRef = doc(db, "system_settings", "global");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setSettings(docSnap.data() as SystemSettings);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!auth.currentUser) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado",
        variant: "destructive",
      });
      return;
    }

    if (settings.session_timeout_minutes < 1 || settings.session_timeout_minutes > 1440) {
      toast({
        title: "Erro de validação",
        description: "O timeout deve estar entre 1 e 1440 minutos (24 horas)",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, "system_settings", "global");
      await setDoc(docRef, {
        ...settings,
        updated_by: auth.currentUser.uid,
        updated_at: serverTimestamp(),
      });

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie as configurações globais da plataforma
          </p>
        </div>

        {/* Sessão */}
        <Card>
          <CardHeader>
            <CardTitle>Sessão de Usuários</CardTitle>
            <CardDescription>
              Configure o tempo de expiração da sessão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="session_timeout">
                Tempo de sessão (minutos)
              </Label>
              <Input
                id="session_timeout"
                type="number"
                min="1"
                max="1440"
                value={settings.session_timeout_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    session_timeout_minutes: parseInt(e.target.value) || 15,
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Valor padrão: 15 minutos. Recomendado: entre 15 e 60 minutos.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Modo de Manutenção */}
        <Card>
          <CardHeader>
            <CardTitle>Modo de Manutenção</CardTitle>
            <CardDescription>
              Ative para bloquear o acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="maintenance_mode" className="cursor-pointer">
                Ativar modo de manutenção
              </Label>
              <Switch
                id="maintenance_mode"
                checked={settings.maintenance_mode}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, maintenance_mode: checked })
                }
              />
            </div>

            {settings.maintenance_mode && (
              <div className="grid gap-2 pt-2">
                <Label htmlFor="maintenance_message">
                  Mensagem de manutenção
                </Label>
                <Input
                  id="maintenance_message"
                  placeholder="Ex: Sistema em manutenção. Retornaremos em breve."
                  value={settings.maintenance_message || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maintenance_message: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registros */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Novos Usuários</CardTitle>
            <CardDescription>
              Controle se novos usuários podem se registrar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="registration_enabled" className="cursor-pointer">
                Permitir novos registros
              </Label>
              <Switch
                id="registration_enabled"
                checked={settings.registration_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, registration_enabled: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
    </div>
  );
}
