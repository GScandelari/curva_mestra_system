/**
 * Configurações dos planos do sistema
 */

export interface PlanConfig {
  id: string;
  name: string;
  price: number;
  maxUsers: number; // Total de usuários (incluindo admin)
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  semestral: {
    id: "semestral",
    name: "Plano Semestral",
    price: 59.90,
    maxUsers: 10, // 9 usuários + 1 admin
    features: [
      "Gestão completa de estoque",
      "Até 10 usuários",
      "6 meses de acesso",
      "Suporte por email",
    ],
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    price: 59.90,
    maxUsers: 10, // 9 usuários + 1 admin
    features: [
      "Gestão completa de estoque",
      "Até 10 usuários",
      "12 meses de acesso",
      "Suporte prioritário",
    ],
  },
};

/**
 * Formata o preço do plano em reais
 */
export function formatPlanPrice(planId: string): string {
  const plan = PLANS[planId];
  if (!plan) return "N/A";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(plan.price);
}

/**
 * Obtém o limite de usuários para um plano
 */
export function getPlanMaxUsers(planId: string): number {
  const plan = PLANS[planId];
  return plan?.maxUsers || 10;
}

/**
 * Obtém a configuração completa do plano
 */
export function getPlanConfig(planId: string): PlanConfig | undefined {
  return PLANS[planId];
}
