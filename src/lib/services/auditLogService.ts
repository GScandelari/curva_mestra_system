/**
 * Audit Log Service (client SDK)
 * Escrita e leitura da trilha de auditoria (UC-53) — unifica audit_log +
 * inventory_activity (já existente) na camada de apresentação, sem migração
 * de dados entre as coleções (RN-02).
 */

import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { buildAuditLogPayload, type NewAuditLogInput } from '@/lib/auditLogPayload';
import type { AuditEntityType, AuditAction } from '@/types';

const DEFAULT_PAGE_SIZE = 100;

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  user: 'Usuário',
  consultant: 'Consultor',
  tenant: 'Clínica',
  master_product: 'Produto Master',
  legal_document: 'Documento Legal',
  system_settings: 'Configurações Globais',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Criar',
  update: 'Editar',
  activate: 'Ativar',
  deactivate: 'Desativar',
  suspend: 'Suspender',
  reactivate: 'Reativar',
  change_role: 'Alterar Papel',
  set_password: 'Definir Senha',
  reset_password_link: 'Enviar Link de Redefinição',
  delete: 'Excluir',
};

export interface ListAuditLogParams {
  scope: 'system_admin' | 'clinic_admin';
  tenantId?: string; // obrigatório quando scope === 'clinic_admin'
  pageSize?: number;
}

export interface UnifiedAuditItem {
  id: string;
  source: 'audit_log' | 'inventory_activity';
  tenant_id: string | null;
  categoria: string;
  ator: string;
  acao: string;
  descricao: string;
  timestamp: Date;
}

/**
 * Grava uma entrada na trilha de auditoria (RF-01). Chamada pelos pontos de
 * escrita client-side (Clínica/updateTenant call site, Produtos Master,
 * Documentos Legais, Configurações Globais).
 */
export async function writeAuditLog(input: NewAuditLogInput): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_log'), {
      ...buildAuditLogPayload(input),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao gravar entrada de auditoria:', error);
    throw new Error('Falha ao gravar entrada de auditoria');
  }
}

/**
 * Variante para páginas do portal admin: preenche o ator a partir do usuário
 * logado (sempre system_admin) e nunca propaga erro — falha de auditoria não
 * pode quebrar a operação administrativa principal.
 */
export async function writeAdminAuditLog(
  input: Omit<NewAuditLogInput, 'actor_id' | 'actor_name' | 'actor_role'>
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  try {
    await writeAuditLog({
      ...input,
      actor_id: currentUser.uid,
      actor_name: currentUser.displayName || currentUser.email || 'Admin',
      actor_role: 'system_admin',
    });
  } catch (error) {
    console.error(error);
  }
}

/**
 * Lê e unifica audit_log + inventory_activity, ordenados por timestamp
 * decrescente. Paginação em janela crescente (RNF-02): "carregar mais"
 * reconsulta ambas as fontes com um pageSize maior.
 */
export async function listAuditLog(
  params: ListAuditLogParams
): Promise<{ items: UnifiedAuditItem[]; hasMore: boolean }> {
  try {
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

    if (params.scope === 'clinic_admin' && !params.tenantId) {
      throw new Error('tenantId é obrigatório para scope clinic_admin');
    }

    // audit_log
    const auditLogRef = collection(db, 'audit_log');
    const auditLogQuery =
      params.scope === 'clinic_admin'
        ? query(
            auditLogRef,
            where('tenant_id', '==', params.tenantId),
            orderBy('timestamp', 'desc'),
            limit(pageSize)
          )
        : query(auditLogRef, orderBy('timestamp', 'desc'), limit(pageSize));

    // inventory_activity
    const inventoryActivityQuery =
      params.scope === 'clinic_admin'
        ? query(
            collection(db, 'tenants', params.tenantId as string, 'inventory_activity'),
            orderBy('timestamp', 'desc'),
            limit(pageSize)
          )
        : query(
            collectionGroup(db, 'inventory_activity'),
            orderBy('timestamp', 'desc'),
            limit(pageSize)
          );

    const [auditLogSnap, inventoryActivitySnap] = await Promise.all([
      getDocs(auditLogQuery),
      getDocs(inventoryActivityQuery),
    ]);

    const auditLogItems: UnifiedAuditItem[] = auditLogSnap.docs.map((doc) => {
      const data = doc.data();
      const entityType = data.entity_type as AuditEntityType;
      const action = data.action as AuditAction;
      const timestamp: Timestamp | undefined = data.timestamp;
      return {
        id: doc.id,
        source: 'audit_log',
        tenant_id: (data.tenant_id as string | null) ?? null,
        categoria: ENTITY_TYPE_LABELS[entityType] ?? entityType,
        ator: data.actor_name,
        acao: ACTION_LABELS[action] ?? action,
        descricao: data.descricao,
        timestamp: timestamp ? timestamp.toDate() : new Date(0),
      };
    });

    const inventoryActivityItems: UnifiedAuditItem[] = inventoryActivitySnap.docs.map((doc) => {
      const data = doc.data();
      const timestamp: Timestamp | undefined = data.timestamp;
      return {
        id: doc.id,
        source: 'inventory_activity',
        tenant_id: (data.tenant_id as string | undefined) ?? null,
        categoria: 'Estoque',
        ator: data.created_by_name ?? '—',
        acao: data.tipo ?? '—',
        descricao: data.descricao ?? '—',
        timestamp: timestamp ? timestamp.toDate() : new Date(0),
      };
    });

    const items = [...auditLogItems, ...inventoryActivityItems].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    const hasMore = auditLogSnap.size === pageSize || inventoryActivitySnap.size === pageSize;

    return { items, hasMore };
  } catch (error) {
    console.error('Erro ao listar trilha de auditoria:', error);
    throw new Error('Falha ao carregar trilha de auditoria');
  }
}
