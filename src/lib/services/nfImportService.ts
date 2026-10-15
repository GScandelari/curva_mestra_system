/**
 * NF Import Service
 * Leitura dos registros de importação de NF. A gravação acontece só no servidor
 * (src/lib/services/nfImportServer.ts, via /api/nf-imports/*).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NFImport, NFOrigem, ParsedNF } from '@/types/nf';

/**
 * Mapeia um documento Firestore de nf_imports para o tipo NFImport.
 */
function mapNFImportDoc(id: string, data: Record<string, unknown>): NFImport {
  const createdAt = data.created_at;
  const updatedAt = data.updated_at;

  return {
    id,
    tenant_id: data.tenant_id as string,
    numero_nf: data.numero_nf as string,
    origem: (data.origem as NFOrigem) ?? 'manual',
    arquivo_nome: data.arquivo_nome as string,
    arquivo_url: data.arquivo_url as string | undefined,
    status: data.status as NFImport['status'],
    produtos_importados: (data.produtos_importados as number) || 0,
    produtos_novos: (data.produtos_novos as number) || 0,
    produtos_pendentes: data.produtos_pendentes as NFImport['produtos_pendentes'],
    error_message: data.error_message as string | undefined,
    natureza_operacao: data.natureza_operacao as string | undefined,
    forma_pagamento: data.forma_pagamento as string | undefined,
    tipo_nota: data.tipo_nota as NFImport['tipo_nota'],
    parsed_data: data.parsed_data as ParsedNF | undefined,
    created_at: createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt as string),
    updated_at: updatedAt instanceof Timestamp ? updatedAt.toDate() : new Date(updatedAt as string),
    created_by: data.created_by as string,
  };
}

/**
 * Busca importação por ID
 */
export async function getNFImport(tenantId: string, importId: string): Promise<NFImport | null> {
  try {
    const importRef = doc(db, 'tenants', tenantId, 'nf_imports', importId);

    const snapshot = await getDoc(importRef);

    if (!snapshot.exists()) {
      return null;
    }

    return mapNFImportDoc(snapshot.id, snapshot.data());
  } catch (error) {
    console.error('Erro ao buscar importação:', error);
    throw error;
  }
}

/**
 * Lista importações de NF do tenant
 */
export async function listNFImports(
  tenantId: string,
  limitResults: number = 50
): Promise<NFImport[]> {
  try {
    const importsRef = collection(db, 'tenants', tenantId, 'nf_imports');

    const q = query(importsRef, orderBy('created_at', 'desc'), limit(limitResults));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => mapNFImportDoc(docSnap.id, docSnap.data()));
  } catch (error) {
    console.error('Erro ao listar importações:', error);
    throw error;
  }
}
