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
  basic: {
    id: "basic",
    name: "Basic",
    price: 49.90,
    maxUsers: 5, // 4 usuários + 1 admin
    features: [
      "Gestão de estoque básica",
      "Até 5 usuários",
      "Suporte por email",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    price: 99.90,
    maxUsers: 10, // 9 usuários + 1 admin (dobro do basic)
    features: [
      "Gestão de estoque avançada",
      "Até 10 usuários",
      "Relatórios detalhados",
      "Suporte prioritário",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 199.90,
    maxUsers: 20, // 19 usuários + 1 admin (dobro do professional)
    features: [
      "Recursos ilimitados",
      "Até 20 usuários",
      "Relatórios personalizados",
      "Suporte 24/7",
      "API dedicada",
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
  return plan?.maxUsers || 5;
}

/**
 * Obtém a configuração completa do plano
 */
export function getPlanConfig(planId: string): PlanConfig | undefined {
  return PLANS[planId];
}
