/**
 * Recusa de pendência de catálogo pelo system_admin (Admin SDK) —
 * FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem. Só é importado pela
 * API route de recusa. Uma transação: a pendência vira 'recusada', o registro
 * da NF move o item para produtos_recusados e a clínica é notificada. O tenant
 * vem da própria pendência, nunca do corpo da requisição.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { applyRejectionToImport, buildPendingRejectedMessage } from '@/lib/nfPendingRejection';
import type { NFProdutoPendente, NFProdutoRecusado } from '@/types/nf';

export type RejectPendingResult =
  | { kind: 'rejected'; tenantId: string; importId: string }
  | { kind: 'not_found' }
  | { kind: 'conflict'; error: string };

export async function rejectPendingProduct(p: {
  pendingId: string;
  motivo: string;
  uid: string;
  actorName: string;
}): Promise<RejectPendingResult> {
  const pendingRef = adminDb.collection('pending_master_products').doc(p.pendingId);

  return adminDb.runTransaction(async (tx) => {
    // Todas as leituras antes das escritas (exigência da transação)
    const pendSnap = await tx.get(pendingRef);
    if (!pendSnap.exists) return { kind: 'not_found' };
    const pend = pendSnap.data() as {
      tenant_id: string;
      nf_import_id: string;
      codigo: string;
      nome_produto: string;
      lote: string;
      status: string;
    };
    // Idempotência: só pendência aberta pode ser recusada (a incorporação e
    // outra recusa simultânea mudam o status dentro de transação)
    if (pend.status !== 'aberta') {
      return { kind: 'conflict', error: 'Esta pendência já foi resolvida ou recusada.' };
    }

    const tenant = adminDb.collection('tenants').doc(pend.tenant_id);
    const nfRef = tenant.collection('nf_imports').doc(pend.nf_import_id);
    const nfSnap = await tx.get(nfRef);
    if (!nfSnap.exists) return { kind: 'not_found' };
    const nf = nfSnap.data() as {
      produtos_pendentes?: NFProdutoPendente[];
      produtos_recusados?: NFProdutoRecusado[];
    };

    const recusadoEm = new Date();
    const upd = applyRejectionToImport(nf, pend, p.motivo, recusadoEm);
    const agora = FieldValue.serverTimestamp();

    tx.update(pendingRef, {
      status: 'recusada',
      motivo_recusa: p.motivo,
      recusado_por: p.uid,
      recusado_por_nome: p.actorName,
      recusado_em: agora,
    });
    tx.update(nfRef, {
      produtos_pendentes: upd.produtos_pendentes,
      produtos_recusados: upd.produtos_recusados.map((r) => ({
        ...r,
        recusado_em:
          r.recusado_em instanceof Date ? Timestamp.fromDate(r.recusado_em) : r.recusado_em,
      })),
      status: upd.status,
      updated_at: agora,
    });
    tx.set(tenant.collection('notifications').doc(), {
      tenant_id: pend.tenant_id,
      type: 'nf_pending_rejected',
      priority: 'high',
      title: 'Produto não cadastrado no catálogo',
      message: buildPendingRejectedMessage(pend.nome_produto, pend.nf_import_id, p.motivo),
      read: false,
      created_at: agora,
      metadata: {
        nf_import_id: pend.nf_import_id,
        product_names: [pend.nome_produto],
        product_code: pend.codigo,
        motivo: p.motivo,
      },
    });

    return { kind: 'rejected', tenantId: pend.tenant_id, importId: pend.nf_import_id };
  });
}
