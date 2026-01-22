"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, writeBatch, Timestamp, doc } from "firebase/firestore";
import type { InventoryItem } from "@/types";

interface AuditResult {
  id: string;
  nome: string;
  lote: string;
  inicial: number;
  reservadaAtual: number;
  disponivelAtual: number;
  reservadaEsperada: number;
  disponivelEsperado: number;
  problemaReserva: boolean;
  problemaDisponivel: boolean;
}

export default function InventoryAuditPage() {
  const { claims } = useAuth();
  const tenantId = claims?.tenant_id;

  const [loading, setLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [fixSuccess, setFixSuccess] = useState(false);

  async function runAudit() {
    if (!tenantId) return;

    setLoading(true);
    setFixSuccess(false);

    try {
      // Buscar inventário
      const inventoryRef = collection(db, "tenants", tenantId, "inventory");
      const inventoryQuery = query(inventoryRef, where("active", "==", true));
      const inventorySnapshot = await getDocs(inventoryQuery);

      // Buscar todos os procedimentos relevantes
      const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");
      const agendadasQuery = query(solicitacoesRef, where("status", "==", "agendada"));
      const aprovadasQuery = query(solicitacoesRef, where("status", "==", "aprovada"));
      const concluidasQuery = query(solicitacoesRef, where("status", "==", "concluida"));

      const [agendadasSnapshot, aprovadasSnapshot, concluidasSnapshot] = await Promise.all([
        getDocs(agendadasQuery),
        getDocs(aprovadasQuery),
        getDocs(concluidasQuery)
      ]);

      // Calcular reservas esperadas (agendadas + aprovadas)
      const reservasEsperadas = new Map<string, number>();

      // Somar reservas das agendadas
      agendadasSnapshot.forEach((doc) => {
        const solicitacao = doc.data();
        if (solicitacao.produtos_solicitados) {
          solicitacao.produtos_solicitados.forEach((p: any) => {
            const atual = reservasEsperadas.get(p.inventory_item_id) || 0;
            reservasEsperadas.set(p.inventory_item_id, atual + (p.quantidade || 0));
          });
        }
      });

      // Somar reservas das aprovadas
      aprovadasSnapshot.forEach((doc) => {
        const solicitacao = doc.data();
        if (solicitacao.produtos_solicitados) {
          solicitacao.produtos_solicitados.forEach((p: any) => {
            const atual = reservasEsperadas.get(p.inventory_item_id) || 0;
            reservasEsperadas.set(p.inventory_item_id, atual + (p.quantidade || 0));
          });
        }
      });

      // Calcular quantidades consumidas (concluídas)
      const quantidadesConsumidas = new Map<string, number>();

      concluidasSnapshot.forEach((doc) => {
        const solicitacao = doc.data();
        if (solicitacao.produtos_solicitados) {
          solicitacao.produtos_solicitados.forEach((p: any) => {
            const atual = quantidadesConsumidas.get(p.inventory_item_id) || 0;
            quantidadesConsumidas.set(p.inventory_item_id, atual + (p.quantidade || 0));
          });
        }
      });

      // Analisar cada item
      const results: AuditResult[] = [];

      inventorySnapshot.forEach((doc) => {
        const item = doc.data() as InventoryItem;
        const inicial = item.quantidade_inicial || 0;
        const reservadaAtual = item.quantidade_reservada || 0;
        const disponivelAtual = item.quantidade_disponivel || 0;
        const reservadaEsperada = reservasEsperadas.get(doc.id) || 0;
        const consumido = quantidadesConsumidas.get(doc.id) || 0;
        const disponivelEsperado = Math.max(0, inicial - consumido - reservadaEsperada);

        const problemaReserva = reservadaAtual !== reservadaEsperada;
        const problemaDisponivel = disponivelAtual !== disponivelEsperado;

        if (problemaReserva || problemaDisponivel) {
          results.push({
            id: doc.id,
            nome: item.nome_produto || item.codigo_produto,
            lote: item.lote,
            inicial,
            reservadaAtual,
            disponivelAtual,
            reservadaEsperada,
            disponivelEsperado,
            problemaReserva,
            problemaDisponivel,
          });
        }
      });

      setAuditResults(results);
      setTotalItems(inventorySnapshot.size);
    } catch (error) {
      console.error("Erro ao auditar inventário:", error);
      alert("Erro ao auditar inventário");
    } finally {
      setLoading(false);
    }
  }

  async function fixInventory() {
    if (!tenantId || auditResults.length === 0) return;

    const confirmacao = confirm(
      `⚠️ ATENÇÃO: Isso irá atualizar ${auditResults.length} itens no inventário.\n\nDeseja continuar?`
    );

    if (!confirmacao) return;

    setFixing(true);

    try {
      const batch = writeBatch(db);

      auditResults.forEach((result) => {
        const itemRef = collection(db, "tenants", tenantId, "inventory");
        const docRef = doc(itemRef, result.id);

        batch.update(docRef, {
          quantidade_reservada: result.reservadaEsperada,
          quantidade_disponivel: result.disponivelEsperado,
          updated_at: Timestamp.now(),
        });
      });

      await batch.commit();

      setFixSuccess(true);
      setAuditResults([]);

      // Re-executar auditoria para confirmar
      setTimeout(() => {
        runAudit();
      }, 1000);

    } catch (error) {
      console.error("Erro ao corrigir inventário:", error);
      alert("Erro ao corrigir inventário");
    } finally {
      setFixing(false);
    }
  }

  const itemsOk = totalItems - auditResults.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link
            href="/clinic/inventory"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Inventário
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl py-8">
        <div className="space-y-6">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Auditoria de Inventário
            </h1>
            <p className="text-muted-foreground">
              Verifique e corrija inconsistências nos valores de reserva e
              disponibilidade
            </p>
          </div>

          {/* Info Card */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription>
              Esta ferramenta verifica se os valores de{" "}
              <strong>quantidade_reservada</strong> e{" "}
              <strong>quantidade_disponivel</strong> estão corretos com base nos
              procedimentos agendados. Itens com problemas serão listados abaixo.
            </AlertDescription>
          </Alert>

          {/* Action Button */}
          <Card>
            <CardHeader>
              <CardTitle>Executar Auditoria</CardTitle>
              <CardDescription>
                Clique no botão abaixo para verificar o estado do inventário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runAudit}
                disabled={loading || !tenantId}
                className="w-full sm:w-auto"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Auditando..." : "Executar Auditoria"}
              </Button>
            </CardContent>
          </Card>

          {/* Success Message */}
          {fixSuccess && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-600">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">
                Correção Aplicada!
              </AlertTitle>
              <AlertDescription className="text-green-600">
                Os itens foram corrigidos com sucesso.
              </AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {totalItems > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resultado da Auditoria</CardTitle>
                <CardDescription>
                  Total de {totalItems} itens analisados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Itens Corretos
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {itemsOk}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      Itens com Problemas
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {auditResults.length}
                    </div>
                  </div>
                </div>

                {auditResults.length === 0 ? (
                  <Alert className="bg-green-50 dark:bg-green-900/20 border-green-600">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">
                      Tudo Certo!
                    </AlertTitle>
                    <AlertDescription className="text-green-600">
                      Nenhum problema encontrado no inventário.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Problemas Encontrados</AlertTitle>
                      <AlertDescription>
                        {auditResults.length} itens com valores incorretos foram
                        identificados
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      {auditResults.map((result) => (
                        <Card key={result.id}>
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-medium">
                                    {result.nome}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Lote: {result.lote}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {result.problemaReserva && (
                                    <Badge variant="destructive">
                                      Reserva
                                    </Badge>
                                  )}
                                  {result.problemaDisponivel && (
                                    <Badge variant="destructive">
                                      Disponível
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">
                                    Quantidade Inicial
                                  </div>
                                  <div className="font-medium">
                                    {result.inicial}
                                  </div>
                                </div>
                              </div>

                              {result.problemaReserva && (
                                <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded">
                                  <div>
                                    <div className="text-muted-foreground">
                                      Reservada (Atual)
                                    </div>
                                    <div className="font-medium text-red-600">
                                      {result.reservadaAtual}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      Reservada (Esperada)
                                    </div>
                                    <div className="font-medium text-green-600">
                                      {result.reservadaEsperada}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {result.problemaDisponivel && (
                                <div className="grid grid-cols-2 gap-4 text-sm p-3 bg-orange-50 dark:bg-orange-900/20 rounded">
                                  <div>
                                    <div className="text-muted-foreground">
                                      Disponível (Atual)
                                    </div>
                                    <div className="font-medium text-orange-600">
                                      {result.disponivelAtual}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">
                                      Disponível (Esperado)
                                    </div>
                                    <div className="font-medium text-green-600">
                                      {result.disponivelEsperado}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Button
                      onClick={fixInventory}
                      disabled={fixing}
                      variant="destructive"
                      className="w-full"
                    >
                      {fixing ? "Corrigindo..." : "Corrigir Todos os Itens"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
