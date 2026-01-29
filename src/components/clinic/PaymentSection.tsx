"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  CreditCard,
  Plus,
  Edit2,
  History,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
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

// Detectar bandeira pelo primeiro dígito
function detectCardBrand(firstDigit: string): string {
  switch (firstDigit) {
    case "4":
      return "visa";
    case "5":
      return "mastercard";
    case "3":
      return "amex";
    case "6":
      return "elo";
    default:
      return "visa";
  }
}

// Formatar valor em reais
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// Formatar data
function formatDate(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString("pt-BR", {
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

export default function PaymentSection() {
  const { tenantId } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states para novo cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  useEffect(() => {
    if (tenantId) {
      loadPaymentData();
    }
  }, [tenantId]);

  async function loadPaymentData() {
    if (!tenantId) return;

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

      // Carregar histórico de pagamentos
      const historyQuery = query(
        collection(db, "payment_history"),
        where("tenant_id", "==", tenantId),
        orderBy("payment_date", "desc")
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

  function maskCardNumber(value: string): string {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    // Limita a 16 dígitos
    const limited = numbers.slice(0, 16);
    // Formata com espaços
    return limited.replace(/(\d{4})/g, "$1 ").trim();
  }

  function handleCardNumberChange(value: string) {
    setCardNumber(maskCardNumber(value));
  }

  async function handleSaveCard() {
    if (!tenantId) return;

    // Validação básica
    const cleanNumber = cardNumber.replace(/\D/g, "");
    if (cleanNumber.length < 13) {
      alert("Número do cartão inválido");
      return;
    }
    if (!cardHolder.trim()) {
      alert("Nome do titular é obrigatório");
      return;
    }
    if (!expiryMonth || !expiryYear) {
      alert("Data de validade é obrigatória");
      return;
    }
    if (cvv.length < 3) {
      alert("CVV inválido");
      return;
    }

    try {
      setSaving(true);

      const firstDigits = cleanNumber.slice(0, 4);
      const lastDigits = cleanNumber.slice(-4);
      const brand = detectCardBrand(cleanNumber[0]);

      // Se já existe um método, desativar
      if (paymentMethod) {
        await updateDoc(doc(db, "payment_methods", paymentMethod.id), {
          is_default: false,
          updated_at: serverTimestamp(),
        });
      }

      // Criar novo método de pagamento
      const newMethod = {
        tenant_id: tenantId,
        type: "credit_card" as const,
        card_first_digits: firstDigits,
        card_last_digits: lastDigits,
        card_brand: brand,
        card_holder_name: cardHolder.toUpperCase(),
        expiry_month: expiryMonth.padStart(2, "0"),
        expiry_year: expiryYear,
        is_default: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "payment_methods"), newMethod);

      setPaymentMethod({
        id: docRef.id,
        ...newMethod,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      } as PaymentMethod);

      // Limpar form
      setCardNumber("");
      setCardHolder("");
      setExpiryMonth("");
      setExpiryYear("");
      setCvv("");
      setShowCardDialog(false);
    } catch (error) {
      console.error("Erro ao salvar cartão:", error);
      alert("Erro ao salvar cartão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Método de Pagamento */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Método de Pagamento
          </h2>
          {paymentMethod && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCardDialog(true)}
            >
              <Edit2 className="w-4 h-4 mr-1" />
              Alterar
            </Button>
          )}
        </div>

        {paymentMethod ? (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white max-w-md">
            <div className="flex justify-between items-start mb-8">
              <div className="text-xs opacity-70">Cartão de Crédito</div>
              <div className="text-lg font-bold">
                {CARD_BRANDS[paymentMethod.card_brand] || paymentMethod.card_brand}
              </div>
            </div>
            <div className="text-xl tracking-widest font-mono mb-6">
              {paymentMethod.card_first_digits} **** **** {paymentMethod.card_last_digits}
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs opacity-70 mb-1">Titular</div>
                <div className="text-sm font-medium">{paymentMethod.card_holder_name}</div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">Validade</div>
                <div className="text-sm font-medium">
                  {paymentMethod.expiry_month}/{paymentMethod.expiry_year}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Cadastre um cartão de crédito para gerenciar seus pagamentos
            </p>
            <Button onClick={() => setShowCardDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Cartão
            </Button>
          </div>
        )}
      </div>

      {/* Histórico de Pagamentos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-green-600" />
            Histórico de Pagamentos
            {paymentHistory.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {paymentHistory.length}
              </Badge>
            )}
          </h2>
          {showHistory ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {showHistory && (
          <div className="mt-4">
            {paymentHistory.length > 0 ? (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {payment.description}
                        </span>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                      <div className="text-sm text-gray-500">
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
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>Nenhum pagamento registrado ainda</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog para cadastrar/editar cartão */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentMethod ? "Alterar Cartão" : "Cadastrar Cartão"}
            </DialogTitle>
            <DialogDescription>
              Os dados do cartão são armazenados de forma segura e mascarada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Número do Cartão</Label>
              <Input
                id="cardNumber"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => handleCardNumberChange(e.target.value)}
                maxLength={19}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardHolder">Nome do Titular</Label>
              <Input
                id="cardHolder"
                placeholder="Como está no cartão"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiryMonth">Mês</Label>
                <Input
                  id="expiryMonth"
                  placeholder="MM"
                  value={expiryMonth}
                  onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryYear">Ano</Label>
                <Input
                  id="expiryYear"
                  placeholder="AAAA"
                  value={expiryYear}
                  onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="***"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-md">
              <strong>Nota de segurança:</strong> Apenas os primeiros 4 e últimos 4 dígitos
              do cartão são armazenados. O CVV nunca é salvo.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCardDialog(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveCard} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Cartão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
