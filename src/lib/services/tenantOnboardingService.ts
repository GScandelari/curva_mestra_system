import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  TenantOnboarding,
  OnboardingStatus,
  ClinicSetupData,
  PlanSelectionData,
  PaymentData,
} from "@/types/onboarding";
import { updateTenant } from "./tenantServiceDirect";
import { createLicense } from "./licenseService";
import { PLANS } from "@/lib/constants/plans";

/**
 * Obtém o status de onboarding de um tenant
 */
export async function getTenantOnboarding(
  tenantId: string
): Promise<TenantOnboarding | null> {
  try {
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);
    const onboardingSnap = await getDoc(onboardingRef);

    if (!onboardingSnap.exists()) {
      return null;
    }

    return {
      tenant_id: onboardingSnap.id,
      ...onboardingSnap.data(),
    } as TenantOnboarding;
  } catch (error) {
    console.error("Erro ao buscar onboarding:", error);
    return null;
  }
}

/**
 * Cria registro de onboarding inicial ao criar tenant
 */
export async function initializeTenantOnboarding(
  tenantId: string
): Promise<void> {
  try {
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);

    await setDoc(onboardingRef, {
      tenant_id: tenantId,
      status: "pending_setup" as OnboardingStatus,
      setup_completed: false,
      plan_selected: false,
      payment_confirmed: false,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });
  } catch (error) {
    console.error("Erro ao inicializar onboarding:", error);
    throw error;
  }
}

/**
 * Verifica se o tenant precisa completar onboarding
 */
export async function needsOnboarding(tenantId: string): Promise<boolean> {
  const onboarding = await getTenantOnboarding(tenantId);

  if (!onboarding) {
    return true; // Sem registro = precisa onboarding
  }

  return onboarding.status !== "completed";
}

/**
 * Obtém a próxima etapa do onboarding
 */
export async function getNextOnboardingStep(
  tenantId: string
): Promise<OnboardingStatus | null> {
  const onboarding = await getTenantOnboarding(tenantId);

  if (!onboarding) {
    return "pending_setup";
  }

  if (!onboarding.setup_completed) {
    return "pending_setup";
  }

  if (!onboarding.plan_selected) {
    return "pending_plan";
  }

  if (!onboarding.payment_confirmed) {
    return "pending_payment";
  }

  return null; // Onboarding completo
}

/**
 * Completa a etapa de configuração inicial
 */
export async function completeClinicSetup(
  tenantId: string,
  setupData: ClinicSetupData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Atualiza dados do tenant com campos separados
    await updateTenant(tenantId, {
      name: setupData.name,
      document_type: setupData.document_type,
      document_number: setupData.document_number.replace(/\D/g, ""),
      email: setupData.email,
      phone: setupData.phone.replace(/\D/g, ""),
      address: setupData.address, // Apenas rua/número
      city: setupData.city,        // Cidade separada
      state: setupData.state,      // Estado separado
      cep: setupData.cep.replace(/\D/g, ""), // CEP separado
      max_users: setupData.document_type === "cnpj" ? 5 : 1,
    });

    // Atualiza status de onboarding
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);
    await updateDoc(onboardingRef, {
      setup_completed: true,
      status: "pending_plan" as OnboardingStatus,
      updated_at: Timestamp.now(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao completar setup:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Completa a etapa de seleção de plano
 */
export async function completePlanSelection(
  tenantId: string,
  planData: PlanSelectionData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Atualiza tenant com plano selecionado
    await updateTenant(tenantId, {
      plan_id: planData.plan_id,
    });

    // Atualiza onboarding
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);
    await updateDoc(onboardingRef, {
      plan_selected: true,
      selected_plan_id: planData.plan_id,
      status: "pending_payment" as OnboardingStatus,
      payment_data: {
        provider: "mock", // Será "pagseguro" quando integrado
        payment_status: "pending",
        amount: PLANS[planData.plan_id].price,
      } as PaymentData,
      updated_at: Timestamp.now(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao selecionar plano:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Confirma pagamento e cria licença (mock para MVP)
 */
export async function confirmPayment(
  tenantId: string,
  paymentData: Partial<PaymentData>
): Promise<{ success: boolean; licenseId?: string; error?: string }> {
  try {
    const onboarding = await getTenantOnboarding(tenantId);

    if (!onboarding || !onboarding.selected_plan_id) {
      return { success: false, error: "Plano não selecionado" };
    }

    const plan = PLANS[onboarding.selected_plan_id];

    // Atualiza dados de pagamento
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);
    await updateDoc(onboardingRef, {
      payment_confirmed: true,
      status: "completed" as OnboardingStatus,
      payment_data: {
        ...onboarding.payment_data,
        ...paymentData,
        payment_status: "approved",
        payment_date: Timestamp.now(),
      } as PaymentData,
      completed_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    });

    // Cria licença automaticamente
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(
      endDate.getMonth() + (onboarding.selected_plan_id === "anual" ? 12 : 6)
    );

    const licenseId = await createLicense({
      tenant_id: tenantId,
      plan_id: onboarding.selected_plan_id,
      start_date: startDate,
      end_date: endDate,
      max_users: plan.maxUsers,
      features: plan.features,
      auto_renew: true, // Habilita renovação automática
    });

    // Ativa o tenant
    await updateTenant(tenantId, {
      active: true,
    });

    return { success: true, licenseId };
  } catch (error: any) {
    console.error("Erro ao confirmar pagamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Processa webhook de pagamento (para integração futura com PagSeguro)
 */
export async function processPaymentWebhook(
  notificationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Implementar consulta à API do PagSeguro
    // const paymentInfo = await pagseguroAPI.getNotification(notificationCode);

    // Mock para MVP
    console.log("Webhook recebido:", notificationCode);

    // Aqui você faria:
    // 1. Consultar API PagSeguro com notificationCode
    // 2. Verificar status do pagamento
    // 3. Se aprovado, chamar confirmPayment()

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao processar webhook:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica se tenant tem licença ativa (para uso no middleware)
 */
export async function hasActiveLicense(tenantId: string): Promise<boolean> {
  try {
    // Verifica se onboarding está completo
    const onboarding = await getTenantOnboarding(tenantId);
    if (!onboarding || onboarding.status !== "completed") {
      return false;
    }

    // Verifica se tem licença ativa
    const licensesRef = collection(db, "licenses");
    const q = query(
      licensesRef,
      where("tenant_id", "==", tenantId),
      where("status", "==", "ativa")
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar licença:", error);
    return false;
  }
}

/**
 * Reseta onboarding (apenas para system_admin)
 */
export async function resetOnboarding(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const onboardingRef = doc(db, "tenant_onboarding", tenantId);

    await updateDoc(onboardingRef, {
      status: "pending_setup" as OnboardingStatus,
      setup_completed: false,
      plan_selected: false,
      payment_confirmed: false,
      selected_plan_id: null,
      payment_data: null,
      completed_at: null,
      updated_at: Timestamp.now(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao resetar onboarding:", error);
    return { success: false, error: error.message };
  }
}
