/**
 * Serviço para gerenciar Tenants via Cloud Functions
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import { Tenant } from "@/types";

const functions = getFunctions(app);

interface CreateTenantData {
  name: string;
  cnpj: string;
  email: string;
  planId?: string;
  phone?: string;
  address?: string;
}

interface UpdateTenantData extends Partial<CreateTenantData> {
  tenantId: string;
  active?: boolean;
}

interface ListTenantsParams {
  limit?: number;
  activeOnly?: boolean;
}

// Criar novo tenant
export async function createTenant(data: CreateTenantData) {
  const createTenantFn = httpsCallable(functions, "createTenant");
  const result = await createTenantFn(data);
  return result.data;
}

// Atualizar tenant existente
export async function updateTenant(data: UpdateTenantData) {
  const updateTenantFn = httpsCallable(functions, "updateTenant");
  const result = await updateTenantFn(data);
  return result.data;
}

// Listar todos os tenants
export async function listTenants(params: ListTenantsParams = {}) {
  const listTenantsFn = httpsCallable(functions, "listTenants");
  const result = await listTenantsFn(params);
  return result.data as { tenants: Tenant[]; count: number };
}

// Obter detalhes de um tenant
export async function getTenant(tenantId: string) {
  const getTenantFn = httpsCallable(functions, "getTenant");
  const result = await getTenantFn({ tenantId });
  return result.data as { tenant: Tenant };
}

// Desativar tenant
export async function deactivateTenant(tenantId: string) {
  const deactivateTenantFn = httpsCallable(functions, "deactivateTenant");
  const result = await deactivateTenantFn({ tenantId });
  return result.data;
}
