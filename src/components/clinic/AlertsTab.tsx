"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Bell,
  Play,
  CheckCircle,
  AlertCircle,
  Package,
  Calendar,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  runAllChecks,
  checkExpiringProducts,
  checkLowStock,
  checkExpiredProducts,
} from "@/lib/services/alertTriggers";

export default function AlertsTab() {
  const { claims } = useAuth();
  const { toast } = useToast();

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === "clinic_admin";

  const handleRunAllChecks = async () => {
    if (!tenantId) return;

    setRunning(true);
    setResults(null);

    try {
      const checkResults = await runAllChecks(tenantId);
      setResults(checkResults);

      const totalCreated =
        checkResults.expiring.created +
        checkResults.expired.created +
        checkResults.lowStock.created;

      toast({
        title: "Checks concluídos!",
        description: `${totalCreated} notificações foram criadas.`,
      });
    } catch (error: any) {
      console.error("Erro ao executar checks:", error);
      toast({
        title: "Erro ao executar checks",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRunSingleCheck = async (
    type: "expiring" | "expired" | "lowStock"
  ) => {
    if (!tenantId) return;

    setRunning(true);

    try {
      let result;
      let checkName = "";

      switch (type) {
        case "expiring":
          result = await checkExpiringProducts(tenantId);
          checkName = "Produtos Vencendo";
          break;
        case "expired":
          result = await checkExpiredProducts(tenantId);
          checkName = "Produtos Vencidos";
          break;
        case "lowStock":
          result = await checkLowStock(tenantId);
          checkName = "Estoque Baixo";
          break;
      }

      toast({
        title: `${checkName} - Concluído`,
        description: `${result.checked} produtos verificados, ${result.notificationsCreated} alertas criados.`,
      });
    } catch (error: any) {
      console.error("Erro ao executar check:", error);
      toast({
        title: "Erro ao executar check",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Apenas administradores podem executar checks de alertas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sobre os Checks Automáticos</AlertTitle>
        <AlertDescription>
          Esta página permite executar manualmente os checks que normalmente
          rodariam automaticamente via Firebase Scheduled Functions. Use
          para testar ou gerar alertas sob demanda.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Check Vencendo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Produtos Vencendo</CardTitle>
            </div>
            <CardDescription>
              Detecta produtos próximos do vencimento baseado nas
              configurações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleRunSingleCheck("expiring")}
              disabled={running}
              className="w-full"
              variant="outline"
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Check
            </Button>
          </CardContent>
        </Card>

        {/* Check Vencidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-lg">Produtos Vencidos</CardTitle>
            </div>
            <CardDescription>
              Detecta produtos que já passaram da data de validade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleRunSingleCheck("expired")}
              disabled={running}
              className="w-full"
              variant="outline"
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Check
            </Button>
          </CardContent>
        </Card>

        {/* Check Estoque Baixo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Estoque Baixo</CardTitle>
            </div>
            <CardDescription>
              Detecta produtos abaixo da quantidade mínima configurada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => handleRunSingleCheck("lowStock")}
              disabled={running}
              className="w-full"
              variant="outline"
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Check
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Executar Todos */}
      <Card>
        <CardHeader>
          <CardTitle>Executar Todos os Checks</CardTitle>
          <CardDescription>
            Executa todos os checks de uma vez (recomendado para varredura
            completa)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRunAllChecks}
            disabled={running}
            size="lg"
            className="w-full"
          >
            {running ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            {running ? "Executando..." : "Executar Todos os Checks"}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle>Resultados do Último Check</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Produtos Vencendo
                </p>
                <p className="text-2xl font-bold">
                  {results.expiring.created}
                </p>
                <p className="text-xs text-muted-foreground">
                  {results.expiring.checked} verificados
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Produtos Vencidos
                </p>
                <p className="text-2xl font-bold">
                  {results.expired.created}
                </p>
                <p className="text-xs text-muted-foreground">
                  {results.expired.checked} verificados
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Estoque Baixo
                </p>
                <p className="text-2xl font-bold">
                  {results.lowStock.created}
                </p>
                <p className="text-xs text-muted-foreground">
                  {results.lowStock.checked} verificados
                </p>
              </div>
            </div>

            {results.totalErrors > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erros Encontrados</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {results.errors.map((error: string, index: number) => (
                      <li key={index} className="text-sm">
                        {error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
