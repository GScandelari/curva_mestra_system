/**
 * Configurações dos planos do sistema
 */

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  maxUsers: number; // Total de usuários (incluindo admin)
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  semestral: {
    id: "semestral",
    name: "Plano Semestral",
    description: "6 meses de acesso completo ao sistema",
    price: 59.90,
    duration: "6 meses",
    maxUsers: 5, // Máximo 5 usuários (incluindo admin)
    features: [
      "Gestão completa de estoque",
      "Até 5 usuários",
      "Controle de lotes e validades",
      "Rastreamento por paciente",
      "Relatórios e alertas",
      "Suporte por email",
    ],
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    description: "12 meses de acesso completo ao sistema",
    price: 49.90,
    duration: "12 meses",
    maxUsers: 5, // Máximo 5 usuários (incluindo admin)
    features: [
      "Gestão completa de estoque",
      "Até 5 usuários",
      "Controle de lotes e validades",
      "Rastreamento por paciente",
      "Relatórios e alertas",
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
  return plan?.maxUsers || 5;
}

/**
 * Obtém a configuração completa do plano
 */
export function getPlanConfig(planId: string): PlanConfig | undefined {
  return PLANS[planId];
}
