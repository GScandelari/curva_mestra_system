/**
 * Incorporação automática de produtos pendentes de NF-e
 * (BUGFIX-identidade-e-duplicidade-nfe): quando o produto de código X fica
 * ativo no catálogo master, as linhas pendentes desse código (de TODAS as
 * clínicas) entram no inventário e cada clínica recebe uma notificação.
 *
 * Usado pelo trigger onMasterProductWritten e pelo callable
 * reprocessPendingMasterProducts (botão "Reprocessar" do system_admin).
 * Idempotente: dentro da transação, só linhas ainda 'aberta' são lançadas.
 */

import * as admin from 'firebase-admin';
import {
  buildPendingResolvedMessage,
  chunkPendingLines,
  normalizeCodigo,
  planPendingResolution,
  removeResolvedPendentes,
  type PendingLineInput,
} from './nfPendingResolutionRules';

interface MasterDoc {
  id: string;
  active: boolean;
  category?: string;
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
}

async function findActiveMaster(
  db: admin.firestore.Firestore,
  codigo: string
): Promise<MasterDoc | null> {
  const snap = await db.collection('master_products').where('code', '==', codigo).get();
  const ativo = snap.docs.find((d) => d.data().active === true);
  if (!ativo) return null;
  const data = ativo.data();
  return {
    id: ativo.id,
    active: true,
    category: data.category,
    fragmentavel: data.fragmentavel,
    unidades_por_embalagem: data.unidades_por_embalagem,
  };
}

async function resolveBlock(
  db: admin.firestore.Firestore,
  tenantId: string,
  importId: string,
  pendingIds: string[],
  master: MasterDoc
): Promise<number> {
  const nfRef = db.doc(`tenants/${tenantId}/nf_imports/${importId}`);
  const pendingRefs = pendingIds.map((id) => db.collection('pending_master_products').doc(id));

  return db.runTransaction(async (tx) => {
    // Todas as leituras antes das escritas
    const nfSnap = await tx.get(nfRef);
    const pendingSnaps = await Promise.all(pendingRefs.map((ref) => tx.get(ref)));
    if (!nfSnap.exists) {
      throw new Error(`Registro nf_imports ${importId} não encontrado em ${tenantId}`);
    }

    const abertas = pendingSnaps.filter((s) => s.exists && s.data()?.status === 'aberta');
    if (abertas.length === 0) return 0;

    const porId = new Map(abertas.map((s) => [s.id, s]));
    const linhas: PendingLineInput[] = abertas.map((s) => {
      const d = s.data() as Record<string, unknown>;
      return {
        id: s.id,
        codigo: d.codigo as string,
        nome_produto: d.nome_produto as string,
        lote: d.lote as string,
        quantidade: d.quantidade as number,
        valor_unitario: d.valor_unitario as number,
      };
    });
    const plano = planPendingResolution(linhas, master);
    const nf = nfSnap.data() as Record<string, unknown>;
    const agora = admin.firestore.FieldValue.serverTimestamp();

    for (const linha of plano) {
      const pendente = porId.get(linha.pendingId)!.data() as Record<string, unknown>;
      const fragmenta = linha.quantidade_embalagens !== undefined;
      const inventoryRef = db.collection(`tenants/${tenantId}/inventory`).doc();
      // Mesmos campos da importação via XML (src/lib/services/nfImportServer.ts)
      tx.set(inventoryRef, {
        tenant_id: tenantId,
        produto_id: master.id,
        codigo_produto: pendente.codigo,
        nome_produto: pendente.nome_produto,
        lote: pendente.lote,
        quantidade_inicial: linha.quantidade,
        quantidade_disponivel: linha.quantidade,
        quantidade_reservada: 0,
        dt_validade: pendente.dt_validade,
        dt_entrada: agora,
        valor_unitario: linha.valor_unitario,
        nf_numero: nf.numero_nf ?? null,
        nf_id: importId,
        natureza_operacao: nf.natureza_operacao ?? null,
        tipo_nota: nf.tipo_nota ?? null,
        active: true,
        category: master.category ?? null,
        brand: 'Rennova',
        fragmentavel: master.fragmentavel === true,
        unidades_por_embalagem: master.unidades_por_embalagem ?? null,
        quantidade_embalagens: fragmenta ? linha.quantidade_embalagens : null,
        valor_por_embalagem: fragmenta ? linha.valor_por_embalagem : null,
        created_at: agora,
        updated_at: agora,
      });
      tx.update(porId.get(linha.pendingId)!.ref, {
        status: 'resolvida',
        inventory_id: inventoryRef.id,
        resolved_at: agora,
      });
    }

    const pendentesAtuais = (nf.produtos_pendentes ?? []) as Array<{
      codigo: string;
      nome_produto: string;
      lote: string;
    }>;
    const restantes = removeResolvedPendentes(pendentesAtuais, linhas);
    tx.update(nfRef, {
      produtos_pendentes: restantes,
      produtos_importados: admin.firestore.FieldValue.increment(plano.length),
      status: restantes.length === 0 ? 'success' : 'novo_produto_pendente',
      updated_at: agora,
    });

    const nomes = Array.from(new Set(linhas.map((l) => l.nome_produto)));
    tx.set(db.collection(`tenants/${tenantId}/notifications`).doc(), {
      tenant_id: tenantId,
      type: 'nf_pending_resolved',
      priority: 'medium',
      title: 'Produtos incorporados ao estoque',
      message: buildPendingResolvedMessage(importId, nomes),
      read: false,
      created_at: agora,
      metadata: { nf_import_id: importId, product_names: nomes },
    });

    return plano.length;
  });
}

export async function resolvePendingForCode(
  db: admin.firestore.Firestore,
  codigoRaw: unknown
): Promise<{ incorporados: number; produtoAtivo: boolean; erros: string[] }> {
  const codigo = normalizeCodigo(codigoRaw);
  if (!codigo) return { incorporados: 0, produtoAtivo: false, erros: [] };

  const master = await findActiveMaster(db, codigo);
  if (!master) return { incorporados: 0, produtoAtivo: false, erros: [] };

  const pendSnap = await db
    .collection('pending_master_products')
    .where('codigo', '==', codigo)
    .where('status', '==', 'aberta')
    .get();

  // Agrupa por registro de importação (tenant + ID): uma transação por bloco
  const grupos = new Map<string, { tenantId: string; importId: string; ids: string[] }>();
  for (const d of pendSnap.docs) {
    const tenantId = d.data().tenant_id as string;
    const importId = d.data().nf_import_id as string;
    const chave = `${tenantId}/${importId}`;
    if (!grupos.has(chave)) grupos.set(chave, { tenantId, importId, ids: [] });
    grupos.get(chave)!.ids.push(d.id);
  }

  let incorporados = 0;
  const erros: string[] = [];
  for (const { tenantId, importId, ids } of grupos.values()) {
    for (const bloco of chunkPendingLines(ids)) {
      try {
        incorporados += await resolveBlock(db, tenantId, importId, bloco, master);
      } catch (error: unknown) {
        // Um bloco com erro não interrompe os demais
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Pendências ${tenantId}/${importId} (código ${codigo}):`, msg);
        erros.push(`${tenantId}/${importId}: ${msg}`);
      }
    }
  }

  console.log(
    `✅ Código ${codigo}: ${incorporados} pendência(s) incorporada(s) em ${grupos.size} importação(ões)`
  );
  return { incorporados, produtoAtivo: true, erros };
}
