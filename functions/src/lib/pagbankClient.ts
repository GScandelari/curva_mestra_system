/**
 * PagBank API Client
 * Cliente para integração com API de Pagamentos Recorrentes do PagBank/PagSeguro
 */

import {
  PagBankPlanRequest,
  PagBankPlanResponse,
  PagBankSubscriberRequest,
  PagBankSubscriberResponse,
  PagBankSubscriptionRequest,
  PagBankSubscriptionResponse,
  PagBankSubscriptionDetailsResponse,
  PagBankErrorResponse,
} from "../types/pagbank";

export class PagBankClient {
  private email: string;
  private token: string;
  private baseUrl: string;

  constructor(email: string, token: string, isProduction = false) {
    this.email = email;
    this.token = token;
    this.baseUrl = isProduction
      ? "https://api.pagseguro.com"
      : "https://sandbox.api.pagseguro.com";
  }

  /**
   * Monta URL com credenciais
   */
  private getAuthUrl(path: string): string {
    const separator = path.includes("?") ? "&" : "?";
    return `${this.baseUrl}${path}${separator}email=${encodeURIComponent(
      this.email
    )}&token=${this.token}`;
  }

  /**
   * Faz requisição à API do PagBank
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getAuthUrl(path);

    console.log(`[PagBank] ${options.method || "GET"} ${path}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Accept: "application/json;charset=UTF-8",
        ...options.headers,
      },
    });

    const responseText = await response.text();

    // Tentar parsear como JSON
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Se não for JSON, pode ser XML (Session)
      data = responseText;
    }

    if (!response.ok) {
      console.error("[PagBank] Erro na requisição:", {
        status: response.status,
        data,
      });

      // Extrair mensagem de erro
      let errorMessage = "Erro na API do PagBank";
      if (data && typeof data === "object" && data.errors) {
        const errors = data.errors as PagBankErrorResponse["errors"];
        errorMessage = errors.map((e) => `${e.code}: ${e.message}`).join(", ");
      } else if (typeof data === "string") {
        errorMessage = data;
      }

      throw new Error(errorMessage);
    }

    console.log("[PagBank] Sucesso:", data);
    return data as T;
  }

  // ============================================================================
  // PLANOS (PLANS)
  // ============================================================================

  /**
   * Criar um plano de assinatura
   */
  async createPlan(planData: PagBankPlanRequest): Promise<PagBankPlanResponse> {
    return this.request<PagBankPlanResponse>(
      "/pre-approvals/request",
      {
        method: "POST",
        body: JSON.stringify(planData),
      }
    );
  }

  /**
   * Consultar plano por código
   */
  async getPlan(planCode: string): Promise<any> {
    return this.request(`/pre-approvals/request/${planCode}`);
  }

  // ============================================================================
  // ASSINANTES (SUBSCRIBERS)
  // ============================================================================

  /**
   * Criar assinante (customer)
   * NOTA: A API antiga não tem endpoint específico para criar subscriber
   * Os dados do assinante são enviados junto com a criação da assinatura
   */
  async createSubscriber(
    subscriberData: PagBankSubscriberRequest
  ): Promise<PagBankSubscriberResponse> {
    // Para compatibilidade, retornamos um código baseado no reference
    // O subscriber real será criado ao criar a assinatura
    console.log("[PagBank] Subscriber data prepared:", subscriberData);
    return {
      code: subscriberData.reference,
      date: new Date().toISOString(),
    };
  }

  // ============================================================================
  // ASSINATURAS (SUBSCRIPTIONS)
  // ============================================================================

  /**
   * Criar assinatura (subscription)
   */
  async createSubscription(
    subscriptionData: PagBankSubscriptionRequest
  ): Promise<PagBankSubscriptionResponse> {
    return this.request<PagBankSubscriptionResponse>(
      "/pre-approvals",
      {
        method: "POST",
        body: JSON.stringify(subscriptionData),
      }
    );
  }

  /**
   * Consultar assinatura por código
   */
  async getSubscription(
    subscriptionCode: string
  ): Promise<PagBankSubscriptionDetailsResponse> {
    return this.request<PagBankSubscriptionDetailsResponse>(
      `/pre-approvals/${subscriptionCode}`
    );
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(subscriptionCode: string): Promise<void> {
    await this.request(`/pre-approvals/${subscriptionCode}/cancel`, {
      method: "PUT",
    });
  }

  /**
   * Cobrar pagamento de assinatura manualmente
   */
  async chargeSubscription(subscriptionCode: string): Promise<any> {
    return this.request(`/pre-approvals/${subscriptionCode}/payment`, {
      method: "POST",
    });
  }

  // ============================================================================
  // SESSION (para tokenização no frontend)
  // ============================================================================

  /**
   * Criar sessão para tokenização de cartão
   */
  async createSession(): Promise<string> {
    const response = await this.request<string>("/v2/sessions", {
      method: "POST",
    });

    // A resposta é XML, extrair o ID da sessão
    const match = response.match(/<id>(.*?)<\/id>/);
    if (!match) {
      throw new Error("Falha ao criar sessão: ID não encontrado");
    }

    return match[1];
  }

  // ============================================================================
  // NOTIFICAÇÕES (WEBHOOKS)
  // ============================================================================

  /**
   * Consultar notificação de webhook
   */
  async getNotification(notificationCode: string): Promise<any> {
    return this.request(`/v2/pre-approvals/notifications/${notificationCode}`);
  }
}

/**
 * Factory para criar instância do cliente PagBank
 */
export function createPagBankClient(
  email: string,
  token: string,
  isProduction = false
): PagBankClient {
  return new PagBankClient(email, token, isProduction);
}
