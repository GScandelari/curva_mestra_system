/**
 * Busca de clínicas para o consultor (Admin SDK, server-only) —
 * FEAT-ajustes-registro-e-busca-consultor. Só tenants ativos. A busca por nome
 * filtra em memória (sem campo novo, backfill nem índice): lê os tenants
 * ativos e os clinic_admin ativos e aplica filterTenantsByName.
 */

import { adminDb } from '@/lib/firebase-admin';
import { filterTenantsByName } from '@/lib/clinicSearch';
import type { DocumentType } from '@/types';

export interface TenantSearchResult {
  id: string;
  name: string;
  document_type?: DocumentType;
  document_number?: string;
  email?: string;
  consultant_id: string | null;
  consultant_name: string | null;
}

function toResult(id: string, data: FirebaseFirestore.DocumentData): TenantSearchResult {
  return {
    id,
    name: data.name,
    document_type: data.document_type,
    document_number: data.document_number,
    email: data.email,
    consultant_id: data.consultant_id || null,
    consultant_name: data.consultant_name || null,
  };
}

/** Igualdade exata no documento (só dígitos), como sempre foi. */
export async function searchActiveTenantsByDocument(
  document: string
): Promise<TenantSearchResult[]> {
  const snapshot = await adminDb
    .collection('tenants')
    .where('document_number', '==', document)
    .where('active', '==', true)
    .get();
  return snapshot.docs.map((d) => toResult(d.id, d.data()));
}

/** Nome da clínica ou de um especialista (clinic_admin ativo) do tenant. */
export async function searchActiveTenantsByName(
  term: string
): Promise<{ data: TenantSearchResult[]; truncated: boolean }> {
  const [tenantsSnap, adminsSnap] = await Promise.all([
    adminDb.collection('tenants').where('active', '==', true).get(),
    adminDb.collection('users').where('role', '==', 'clinic_admin').get(),
  ]);

  const especialistas = new Map<string, string[]>();
  for (const u of adminsSnap.docs) {
    const user = u.data();
    if (user.active === false || !user.tenant_id) continue;
    const nome = user.full_name || user.displayName;
    if (typeof nome !== 'string' || !nome.trim()) continue;
    especialistas.set(user.tenant_id, [...(especialistas.get(user.tenant_id) ?? []), nome]);
  }

  const candidatos = tenantsSnap.docs.map((d) => ({
    id: d.id,
    name: typeof d.data().name === 'string' ? (d.data().name as string) : '',
    specialistNames: especialistas.get(d.id) ?? [],
    data: d.data(),
  }));

  const { matches, truncated } = filterTenantsByName(candidatos, term);
  return { data: matches.map((m) => toResult(m.id, m.data)), truncated };
}
