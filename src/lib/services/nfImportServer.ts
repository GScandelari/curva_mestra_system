/**
 * Confirmação de NF-e no servidor (Admin SDK) — BUGFIX-identidade-e-duplicidade-nfe.
 * Só é importado por API routes. Cada confirmação é UMA transação: identidade
 * (CNPJ + série + número), contador do ID legível, registro da importação,
 * itens de estoque e pendências de catálogo. Duas confirmações simultâneas da
 * mesma NF são serializadas pelo Firestore: a primeira grava, a segunda é
 * refeita, encontra a identidade e é bloqueada (409).
 */

import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { adminDb, getAdminApp } from '@/lib/firebase-admin';
import { calcularQuantidadeInventario } from '@/lib/inventoryQuantity';
import { buildIdentityKey, normalizeLeadingZeros } from '@/lib/nfIdentity';
import {
  evaluateIdentityConflict,
  nextImportId,
  planXmlLines,
  type MasterLite,
} from '@/lib/nfImportPlanner';
import type { NFIdentity, NFOrigem, ParsedNF } from '@/types/nf';

const IN_QUERY_LIMIT = 30;

export interface PendingSummary {
  codigo: string;
  nome_produto: string;
  lote: string;
}

export interface ManualNfProductInput {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number; // como informado (embalagens, se Rennova fragmentável)
  valor_unitario: number; // como informado (por embalagem, se fragmentável)
  dt_validade: string; // 'YYYY-MM-DD'
  brand?: string;
  category?: string;
}

/**
 * Data de calendário gravada ao meio-dia UTC: cai no mesmo dia em qualquer fuso
 * das Américas (à meia-noite UTC, Brasília exibiria o dia anterior).
 */
function calendarDate(ano: number, mes: number, dia: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)));
}

/** 'DD/MM/YYYY' (parser do XML) → Timestamp. */
export function validadeFromNF(ddmmyyyy: string): Timestamp {
  const [dia, mes, ano] = ddmmyyyy.split('/').map(Number);
  return calendarDate(ano, mes, dia);
}

/** 'YYYY-MM-DD' (input date) → Timestamp. */
export function validadeFromInput(yyyymmdd: string): Timestamp {
  const [ano, mes, dia] = yyyymmdd.split('-').map(Number);
  return calendarDate(ano, mes, dia);
}

const refs = (tenantId: string) => {
  const tenant = adminDb.collection('tenants').doc(tenantId);
  return {
    counter: tenant.collection('contadores').doc('nf_imports'),
    identity: (key: string) => tenant.collection('nf_identidades').doc(key),
    nfImport: (id: string) => tenant.collection('nf_imports').doc(id),
    inventory: () => tenant.collection('inventory').doc(),
  };
};

async function readMasters(tx: Transaction, codes: string[]): Promise<Map<string, MasterLite>> {
  const masters = new Map<string, MasterLite>();
  for (let i = 0; i < codes.length; i += IN_QUERY_LIMIT) {
    const chunk = codes.slice(i, i + IN_QUERY_LIMIT);
    const snap = await tx.get(adminDb.collection('master_products').where('code', 'in', chunk));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const code = normalizeLeadingZeros(data.code);
      const atual = masters.get(code);
      // Produto ativo prevalece sobre um inativo com o mesmo código
      if (atual?.active && data.active !== true) return;
      masters.set(code, {
        id: docSnap.id,
        code,
        active: data.active === true,
        category: data.category,
        fragmentavel: data.fragmentavel === true,
        unidades_por_embalagem: data.unidades_por_embalagem,
      });
    });
  }
  return masters;
}

async function readConflict(
  tx: Transaction,
  tenantId: string,
  identityKey: string
): Promise<{ nf_import_id: string; origem: NFOrigem; hasPending: boolean } | null> {
  const r = refs(tenantId);
  const identSnap = await tx.get(r.identity(identityKey));
  if (!identSnap.exists) return null;
  const ident = identSnap.data() as { nf_import_id: string; origem: NFOrigem };
  const importSnap = await tx.get(r.nfImport(ident.nf_import_id));
  const pendentes = (importSnap.data()?.produtos_pendentes ?? []) as unknown[];
  return {
    nf_import_id: ident.nf_import_id,
    origem: ident.origem,
    hasPending: pendentes.length > 0,
  };
}

export async function confirmXmlImport(p: {
  tenantId: string;
  uid: string;
  parsedNF: ParsedNF;
  arquivoNome: string;
}): Promise<
  | { kind: 'created'; importId: string; produtosImportados: number; pendentes: PendingSummary[] }
  | { kind: 'blocked'; importId: string; reason: string }
> {
  const { tenantId, uid, parsedNF } = p;
  const identity: NFIdentity = {
    cnpj: parsedNF.cnpj_fornecedor,
    serie: parsedNF.serie,
    numero: parsedNF.numero,
  };
  const identityKey = buildIdentityKey(identity);
  const codes = Array.from(new Set(parsedNF.produtos.map((prod) => prod.codigo)));
  const r = refs(tenantId);

  return adminDb.runTransaction(async (tx) => {
    // Todas as leituras antes das escritas (exigência da transação)
    const conflict = await readConflict(tx, tenantId, identityKey);
    const decision = evaluateIdentityConflict('xml', conflict);
    if (decision.action === 'blocked') {
      return { kind: 'blocked', importId: decision.nfImportId, reason: decision.reason };
    }
    const counterSnap = await tx.get(r.counter);
    const masters = await readMasters(tx, codes);

    const plan = planXmlLines(parsedNF.produtos, masters);
    const idSequencial = nextImportId(counterSnap.data()?.ultimo_id);
    const importId = String(idSequencial);
    const agora = FieldValue.serverTimestamp();
    const pendentes: PendingSummary[] = plan.pending.map(({ produto }) => ({
      codigo: produto.codigo,
      nome_produto: produto.nome_produto,
      lote: produto.lote,
    }));

    tx.set(r.counter, { ultimo_id: idSequencial, updated_at: agora });
    tx.set(r.nfImport(importId), {
      id_sequencial: idSequencial,
      tenant_id: tenantId,
      origem: 'xml',
      identidade: identityKey,
      numero_nf: identity.numero,
      serie: identity.serie,
      cnpj_emitente: identity.cnpj,
      chave_acesso: parsedNF.chave_acesso,
      fornecedor: parsedNF.fornecedor ?? null,
      data_emissao: parsedNF.data_emissao ?? null,
      natureza_operacao: parsedNF.natureza_operacao ?? null,
      forma_pagamento: parsedNF.forma_pagamento ?? null,
      tipo_nota: parsedNF.tipo_nota,
      status: pendentes.length > 0 ? 'novo_produto_pendente' : 'success',
      produtos_importados: plan.inventory.length,
      produtos_pendentes: pendentes,
      arquivo_nome: p.arquivoNome,
      created_by: uid,
      created_at: agora,
      updated_at: agora,
    });
    tx.set(r.identity(identityKey), { nf_import_id: importId, origem: 'xml', created_at: agora });

    for (const linha of plan.inventory) {
      const { produto, master } = linha;
      tx.set(r.inventory(), {
        tenant_id: tenantId,
        produto_id: master.id,
        codigo_produto: produto.codigo,
        nome_produto: produto.nome_produto,
        lote: produto.lote,
        quantidade_inicial: linha.quantidade,
        quantidade_disponivel: linha.quantidade,
        quantidade_reservada: 0,
        dt_validade: validadeFromNF(produto.dt_validade),
        dt_entrada: agora,
        valor_unitario: linha.valor_unitario,
        nf_numero: identity.numero,
        nf_id: importId,
        natureza_operacao: parsedNF.natureza_operacao ?? null,
        tipo_nota: parsedNF.tipo_nota ?? null,
        active: true,
        category: master.category ?? null,
        brand: 'Rennova',
        fragmentavel: master.fragmentavel === true,
        unidades_por_embalagem: master.unidades_por_embalagem ?? null,
        quantidade_embalagens: master.fragmentavel ? produto.quantidade : null,
        valor_por_embalagem: master.fragmentavel ? produto.valor_unitario : null,
        created_at: agora,
        updated_at: agora,
      });
    }

    for (const { linha, produto } of plan.pending) {
      tx.set(
        adminDb.collection('pending_master_products').doc(`${tenantId}_${importId}_${linha}`),
        {
          tenant_id: tenantId,
          nf_import_id: importId,
          id_sequencial: idSequencial,
          numero_nf: identity.numero,
          serie: identity.serie,
          cnpj_emitente: identity.cnpj,
          linha,
          codigo: produto.codigo,
          nome_produto: produto.nome_produto,
          lote: produto.lote,
          quantidade: produto.quantidade,
          valor_unitario: produto.valor_unitario,
          dt_validade: validadeFromNF(produto.dt_validade),
          ...(produto.dt_fabricacao
            ? { dt_fabricacao: validadeFromNF(produto.dt_fabricacao) }
            : {}),
          ...(produto.sem_rastro ? { sem_rastro: true } : {}),
          status: 'aberta',
          created_at: agora,
        }
      );
    }

    return {
      kind: 'created',
      importId,
      produtosImportados: plan.inventory.length,
      pendentes,
    };
  });
}

export async function confirmManualLaunch(p: {
  tenantId: string;
  uid: string;
  identity: NFIdentity;
  chave_acesso?: string;
  tipo: 'rennova' | 'outra_marca';
  produtos: ManualNfProductInput[];
}): Promise<
  | { kind: 'created' | 'complemented'; importId: string; produtosImportados: number }
  | { kind: 'blocked'; importId: string; reason: string }
  | { kind: 'invalid'; error: string }
> {
  const { tenantId, uid, identity, tipo } = p;
  const identityKey = buildIdentityKey(identity);
  const produtos = p.produtos.map((prod) => ({
    ...prod,
    codigo: normalizeLeadingZeros(prod.codigo),
    lote: normalizeLeadingZeros(prod.lote),
  }));
  const r = refs(tenantId);

  return adminDb.runTransaction(async (tx) => {
    const conflict = await readConflict(tx, tenantId, identityKey);
    const decision = evaluateIdentityConflict('manual', conflict);
    if (decision.action === 'blocked') {
      return { kind: 'blocked', importId: decision.nfImportId, reason: decision.reason };
    }

    const counterSnap = decision.action === 'create' ? await tx.get(r.counter) : null;
    const masters =
      tipo === 'rennova'
        ? await readMasters(tx, Array.from(new Set(produtos.map((prod) => prod.codigo))))
        : new Map<string, MasterLite>();

    if (tipo === 'rennova') {
      const ausente = produtos.find((prod) => !masters.get(prod.codigo)?.active);
      if (ausente) {
        return {
          kind: 'invalid',
          error: `Produto ${ausente.codigo} não está ativo no catálogo Rennova.`,
        };
      }
    }

    const agora = FieldValue.serverTimestamp();
    let importId: string;
    if (decision.action === 'complement') {
      importId = decision.nfImportId;
      tx.update(r.nfImport(importId), {
        produtos_importados: FieldValue.increment(produtos.length),
        lancamentos_manuais: FieldValue.increment(1),
        updated_at: agora,
      });
    } else {
      const idSequencial = nextImportId(counterSnap?.data()?.ultimo_id);
      importId = String(idSequencial);
      tx.set(r.counter, { ultimo_id: idSequencial, updated_at: agora });
      tx.set(r.nfImport(importId), {
        id_sequencial: idSequencial,
        tenant_id: tenantId,
        origem: 'manual',
        identidade: identityKey,
        numero_nf: identity.numero,
        serie: identity.serie,
        cnpj_emitente: identity.cnpj,
        ...(p.chave_acesso ? { chave_acesso: p.chave_acesso } : {}),
        tipo,
        status: 'success',
        produtos_importados: produtos.length,
        produtos_pendentes: [],
        lancamentos_manuais: 1,
        created_by: uid,
        created_at: agora,
        updated_at: agora,
      });
      tx.set(r.identity(identityKey), {
        nf_import_id: importId,
        origem: 'manual',
        created_at: agora,
      });
    }

    for (const prod of produtos) {
      const master = masters.get(prod.codigo);
      const fragmentavel = tipo === 'rennova' && master?.fragmentavel === true;
      const calculo =
        tipo === 'rennova'
          ? calcularQuantidadeInventario({
              quantidadeInformada: prod.quantidade,
              fragmentavel,
              unidadesPorEmbalagem: master?.unidades_por_embalagem,
              valorInformado: prod.valor_unitario,
            })
          : { quantidade_inicial: prod.quantidade, valor_unitario: prod.valor_unitario };

      tx.set(r.inventory(), {
        tenant_id: tenantId,
        nf_id: importId,
        nf_import_id: importId,
        nf_numero: identity.numero,
        master_product_id: master?.id ?? null,
        produto_id: master?.id ?? null,
        codigo_produto: prod.codigo,
        nome_produto: prod.nome_produto,
        category: (tipo === 'rennova' ? master?.category : prod.category) ?? null,
        lote: prod.lote,
        quantidade_inicial: calculo.quantidade_inicial,
        quantidade_disponivel: calculo.quantidade_inicial,
        quantidade_reservada: 0,
        dt_validade: validadeFromInput(prod.dt_validade),
        dt_entrada: agora,
        valor_unitario: calculo.valor_unitario,
        active: true,
        is_rennova: tipo === 'rennova',
        brand: tipo === 'rennova' ? 'Rennova' : (prod.brand ?? null),
        ...(fragmentavel
          ? {
              fragmentavel: true,
              unidades_por_embalagem: master?.unidades_por_embalagem ?? null,
              quantidade_embalagens: prod.quantidade,
              valor_por_embalagem: prod.valor_unitario,
            }
          : {}),
        created_at: agora,
        updated_at: agora,
      });
    }

    return {
      kind: decision.action === 'complement' ? 'complemented' : 'created',
      importId,
      produtosImportados: produtos.length,
    };
  });
}

/**
 * Grava o XML em `danfe/{tenantId}/{importId}.xml` depois do commit. Best-effort:
 * falhar aqui não desfaz a importação — só marca `arquivo_status: 'falhou'`.
 */
export async function saveNfXmlFileBestEffort(
  tenantId: string,
  importId: string,
  buffer: Buffer
): Promise<'salvo' | 'falhou'> {
  const path = `danfe/${tenantId}/${importId}.xml`;
  let status: 'salvo' | 'falhou' = 'salvo';
  try {
    const bucket = getStorage(getAdminApp()).bucket(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    );
    await bucket.file(path).save(buffer, { contentType: 'text/xml', resumable: false });
  } catch (error) {
    console.error('[nf-imports] Falha ao salvar o XML no Storage:', error);
    status = 'falhou';
  }
  try {
    await refs(tenantId)
      .nfImport(importId)
      .update({
        arquivo_status: status,
        ...(status === 'salvo' ? { arquivo_path: path } : {}),
      });
  } catch (error) {
    console.error('[nf-imports] Falha ao registrar o status do arquivo:', error);
  }
  return status;
}
