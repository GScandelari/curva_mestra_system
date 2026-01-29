"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  History,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PaymentMethod, PaymentHistory, PaymentStatus } from "@/types/onboarding";

// Mapeamento de bandeiras
const CARD_BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  diners: "Diners Club",
};

// Formatar valor em reais
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// Formatar data
function formatDate(timestamp: any): string {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Badge de status do pagamento
function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>
      );
    case "pending":
    case "processing":
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case "refunded":
      return (
        <Badge variant="outline">
          Reembolsado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface TenantPaymentInfoProps {
  tenantId: string;
  tenantName?: string;
}

export default function TenantPaymentInfo({ tenantId, tenantName }: TenantPaymentInfoProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadPaymentData();
    }
  }, [tenantId]);

  async function loadPaymentData() {
    try {
      setLoading(true);

      // Carregar método de pagamento
      const methodsQuery = query(
        collection(db, "payment_methods"),
        where("tenant_id", "==", tenantId),
        where("is_default", "==", true)
      );
      const methodsSnapshot = await getDocs(methodsQuery);

      if (!methodsSnapshot.empty) {
        const methodDoc = methodsSnapshot.docs[0];
        setPaymentMethod({ id: methodDoc.id, ...methodDoc.data() } as PaymentMethod);
      }

      // Carregar histórico de pagamentos (últimos 20)
      const historyQuery = query(
        collection(db, "payment_history"),
        where("tenant_id", "==", tenantId),
        orderBy("payment_date", "desc"),
        limit(20)
      );
      const historySnapshot = await getDocs(historyQuery);
      const history = historySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PaymentHistory[];

      setPaymentHistory(history);
    } catch (error) {
      console.error("Erro ao carregar dados de pagamento:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calcular totais
  const totalApproved = paymentHistory
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = paymentHistory
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Informações de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Método de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Método de Pagamento
          </CardTitle>
          <CardDescription>
            Cartão de crédito configurado para cobrança
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethod ? (
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 text-white max-w-sm">
              <div className="flex justify-between items-start mb-6">
                <div className="text-xs opacity-70">Cartão de Crédito</div>
                <div className="text-sm font-bold">
                  {CARD_BRANDS[paymentMethod.card_brand] || paymentMethod.card_brand}
                </div>
              </div>
              <div className="text-lg tracking-widest font-mono mb-4">
                {paymentMethod.card_first_digits} **** **** {paymentMethod.card_last_digits}
              </div>
              <div className="flex justify-between items-end text-sm">
                <div>
                  <div className="text-xs opacity-70 mb-1">Titular</div>
                  <div className="font-medium">{paymentMethod.card_holder_name}</div>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Validade</div>
                  <div className="font-medium">
                    {paymentMethod.expiry_month}/{paymentMethod.expiry_year}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Nenhum cartão cadastrado</p>
                <p className="text-sm text-amber-700">
                  Esta clínica ainda não configurou um método de pagamento.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Pagamentos */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-green-600" />
                Histórico de Pagamentos
                {paymentHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {paymentHistory.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {paymentHistory.length > 0
                  ? `Total aprovado: ${formatCurrency(totalApproved)}`
                  : "Nenhum pagamento registrado"}
              </CardDescription>
            </div>
            {showHistory ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </CardHeader>

        {showHistory && (
          <CardContent>
            {paymentHistory.length > 0 ? (
              <div className="space-y-3">
                {/* Resumo */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Aprovado</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(totalApproved)}
                    </p>
                  </div>
                  {totalPending > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Pendente</p>
                      <p className="text-lg font-bold text-amber-600">
                        {formatCurrency(totalPending)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Lista de pagamentos */}
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {payment.description}
                        </span>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                      <div className="text-xs text-gray-500">
                        {payment.card_first_digits && payment.card_last_digits ? (
                          <span>
                            Cartão {payment.card_first_digits} **** {payment.card_last_digits}
                            {payment.card_brand && (
                              <span className="ml-1">
                                ({CARD_BRANDS[payment.card_brand] || payment.card_brand})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span>Pagamento processado</span>
                        )}
                        <span className="mx-2">•</span>
                        <span>{formatDate(payment.payment_date)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p>Nenhum pagamento registrado ainda</p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
