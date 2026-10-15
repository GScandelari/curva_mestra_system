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
import { buildIdentityKey, normalizeLeadingZeros } from '@/lib/nfIdentity';
import {
  buildPendingAdminAlertMessage,
  evaluateIdentityConflict,
  hasResolvablePending,
  nextImportId,
  planManualLines,
  planXmlLines,
  type MasterLite,
} from '@/lib/nfImportPlanner';
import { isCatalogProductCode } from '@/types/masterProduct';
import type {
  ManualNfProductInput,
  NFIdentity,
  NFOrigem,
  NFProdutoPendente,
  NfIdentityLookupResponse,
  ParsedNF,
} from '@/types/nf';

const IN_QUERY_LIMIT = 30;

export interface PendingSummary {
  codigo: string;
  nome_produto: string;
  lote: string;
  fora_do_padrao?: boolean;
}

export type { ManualNfProductInput } from '@/types/nf';

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

interface ConflictInfo {
  nf_import_id: string;
  origem: NFOrigem;
  hasPending: boolean; // só pendências incorporáveis (fora do padrão não contam)
  hasRejected: boolean;
  lancamentos_manuais?: number;
  produtos_pendentes: NFProdutoPendente[];
  status?: string;
}

async function readConflict(
  tx: Transaction,
  tenantId: string,
  identityKey: string
): Promise<ConflictInfo | null> {
  const r = refs(tenantId);
  const identSnap = await tx.get(r.identity(identityKey));
  if (!identSnap.exists) return null;
  const ident = identSnap.data() as { nf_import_id: string; origem: NFOrigem };
  const importSnap = await tx.get(r.nfImport(ident.nf_import_id));
  const nf = importSnap.data() ?? {};
  const pendentes = (nf.produtos_pendentes ?? []) as NFProdutoPendente[];
  return {
    nf_import_id: ident.nf_import_id,
    origem: ident.origem,
    hasPending: hasResolvablePending(pendentes),
    hasRejected: ((nf.produtos_recusados ?? []) as unknown[]).length > 0,
    lancamentos_manuais:
      typeof nf.lancamentos_manuais === 'number' ? nf.lancamentos_manuais : undefined,
    produtos_pendentes: pendentes,
    status: typeof nf.status === 'string' ? nf.status : undefined,
  };
}

async function readTenantName(tx: Transaction, tenantId: string): Promise<string> {
  const snap = await tx.get(adminDb.collection('tenants').doc(tenantId));
  const name = snap.data()?.name;
  return typeof name === 'string' && name.trim() ? name : tenantId;
}

/**
 * Alerta do sino do system_admin para importação/lançamento que gerou pendência
 * (coleção de raiz `admin_notifications`, gravada só pelo servidor).
 */
function setPendingAdminAlert(
  tx: Transaction,
  p: {
    alertId: string;
    tenantId: string;
    tenantName: string;
    origem: NFOrigem;
    importId: string;
    lancamento?: number;
    identity: NFIdentity;
    pendentes: PendingSummary[];
    agora: FieldValue;
  }
): void {
  const distintos = (lista: PendingSummary[]) => Array.from(new Set(lista.map((x) => x.codigo)));
  const codigosForaPadrao = distintos(p.pendentes.filter((x) => x.fora_do_padrao));
  const codigosPendentes = distintos(p.pendentes.filter((x) => !x.fora_do_padrao));
  tx.set(adminDb.collection('admin_notifications').doc(p.alertId), {
    type: 'nf_pendencias',
    title: 'Pendências de catálogo em NF-e',
    message: buildPendingAdminAlertMessage({
      tenantName: p.tenantName,
      origem: p.origem,
      importId: p.importId,
      identity: p.identity,
      codigosPendentes,
      codigosForaPadrao,
    }),
    read: false,
    link:
      codigosPendentes.length === 0
        ? '/admin/pending-products#fora-do-padrao'
        : '/admin/pending-products',
    created_at: p.agora,
    metadata: {
      tenant_id: p.tenantId,
      tenant_name: p.tenantName,
      origem: p.origem,
      nf_import_id: p.importId,
      ...(p.lancamento ? { lancamento: p.lancamento } : {}),
      numero_nf: p.identity.numero,
      serie: p.identity.serie,
      cnpj_emitente: p.identity.cnpj,
      codigos_pendentes: codigosPendentes,
      codigos_fora_padrao: codigosForaPadrao,
    },
  });
}

/**
 * Consulta antecipada de duplicidade (GET /api/nf-imports/identidade): só
 * fatos; a mensagem é montada no client com evaluateIdentityConflict. A
 * transação de confirmação continua sendo a checagem que vale.
 */
export async function lookupNfIdentity(
  tenantId: string,
  identity: NFIdentity
): Promise<NfIdentityLookupResponse> {
  const r = refs(tenantId);
  const identSnap = await r.identity(buildIdentityKey(identity)).get();
  if (!identSnap.exists) return { existe: false };
  const ident = identSnap.data() as { nf_import_id: string; origem: NFOrigem };
  const nf = (await r.nfImport(ident.nf_import_id).get()).data() ?? {};
  return {
    existe: true,
    importId: ident.nf_import_id,
    idLabel: `ID ${ident.nf_import_id}`,
    origem: ident.origem,
    hasPending: hasResolvablePending(nf.produtos_pendentes as NFProdutoPendente[] | undefined),
    hasRejected: ((nf.produtos_recusados ?? []) as unknown[]).length > 0,
  };
}

type PlannedXmlInventory = ReturnType<typeof planXmlLines>['inventory'][number];
type PlannedXmlPending = ReturnType<typeof planXmlLines>['pending'][number];
type ManualPlanOk = Extract<ReturnType<typeof planManualLines>, { ok: true }>;

/** Item de estoque de uma linha XML (mesmos campos de sempre). */
function xmlInventoryDoc(
  p: {
    tenantId: string;
    importId: string;
    identity: NFIdentity;
    parsedNF: ParsedNF;
    agora: FieldValue;
  },
  linha: PlannedXmlInventory
) {
  const { produto, master } = linha;
  return {
    tenant_id: p.tenantId,
    produto_id: master.id,
    codigo_produto: produto.codigo,
    nome_produto: produto.nome_produto,
    lote: produto.lote,
    quantidade_inicial: linha.quantidade,
    quantidade_disponivel: linha.quantidade,
    quantidade_reservada: 0,
    dt_validade: validadeFromNF(produto.dt_validade),
    dt_entrada: p.agora,
    valor_unitario: linha.valor_unitario,
    nf_numero: p.identity.numero,
    nf_id: p.importId,
    natureza_operacao: p.parsedNF.natureza_operacao ?? null,
    tipo_nota: p.parsedNF.tipo_nota ?? null,
    active: true,
    category: master.category ?? null,
    brand: 'Rennova',
    fragmentavel: master.fragmentavel === true,
    unidades_por_embalagem: master.unidades_por_embalagem ?? null,
    quantidade_embalagens: master.fragmentavel ? produto.quantidade : null,
    valor_por_embalagem: master.fragmentavel ? produto.valor_unitario : null,
    created_at: p.agora,
    updated_at: p.agora,
  };
}

/** Pendência de catálogo de uma linha XML. */
function xmlPendingDoc(
  p: {
    tenantId: string;
    importId: string;
    idSequencial: number;
    identity: NFIdentity;
    agora: FieldValue;
  },
  { linha, produto, fora_do_padrao }: PlannedXmlPending
) {
  return {
    tenant_id: p.tenantId,
    nf_import_id: p.importId,
    id_sequencial: p.idSequencial,
    numero_nf: p.identity.numero,
    serie: p.identity.serie,
    cnpj_emitente: p.identity.cnpj,
    origem: 'xml',
    ...(fora_do_padrao ? { fora_do_padrao: true } : {}),
    linha,
    codigo: produto.codigo,
    nome_produto: produto.nome_produto,
    lote: produto.lote,
    quantidade: produto.quantidade,
    valor_unitario: produto.valor_unitario,
    dt_validade: validadeFromNF(produto.dt_validade),
    ...(produto.dt_fabricacao ? { dt_fabricacao: validadeFromNF(produto.dt_fabricacao) } : {}),
    ...(produto.sem_rastro ? { sem_rastro: true } : {}),
    status: 'aberta',
    created_at: p.agora,
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
  // Código fora do padrão nunca está no catálogo: não entra na consulta
  const codes = Array.from(
    new Set(parsedNF.produtos.map((prod) => prod.codigo).filter(isCatalogProductCode))
  );
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
    const tenantName = plan.pending.length > 0 ? await readTenantName(tx, tenantId) : '';
    const idSequencial = nextImportId(counterSnap.data()?.ultimo_id);
    const importId = String(idSequencial);
    const agora = FieldValue.serverTimestamp();
    const pendentes: PendingSummary[] = plan.pending.map(({ produto, fora_do_padrao }) => ({
      codigo: produto.codigo,
      nome_produto: produto.nome_produto,
      lote: produto.lote,
      ...(fora_do_padrao ? { fora_do_padrao: true } : {}),
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

    const ctx = { tenantId, importId, idSequencial, identity, parsedNF, agora };
    for (const linha of plan.inventory) tx.set(r.inventory(), xmlInventoryDoc(ctx, linha));
    for (const pendente of plan.pending) {
      tx.set(
        adminDb
          .collection('pending_master_products')
          .doc(`${tenantId}_${importId}_${pendente.linha}`),
        xmlPendingDoc(ctx, pendente)
      );
    }

    if (pendentes.length > 0) {
      setPendingAdminAlert(tx, {
        alertId: `nf_pendencias_${tenantId}_${importId}`,
        tenantId,
        tenantName,
        origem: 'xml',
        importId,
        identity,
        pendentes,
        agora,
      });
    }

    return {
      kind: 'created',
      importId,
      produtosImportados: plan.inventory.length,
      pendentes,
    };
  });
}

/** Item de estoque de um lançamento manual. */
function manualInventoryDoc(
  p: {
    tenantId: string;
    importId: string;
    identity: NFIdentity;
    tipo: 'rennova' | 'outra_marca';
    agora: FieldValue;
  },
  linha: ManualPlanOk['inventory'][number]
) {
  const { produto: prod, master } = linha;
  const rennova = p.tipo === 'rennova';
  const fragmentavel = rennova && master?.fragmentavel === true;
  return {
    tenant_id: p.tenantId,
    nf_id: p.importId,
    nf_import_id: p.importId,
    nf_numero: p.identity.numero,
    master_product_id: master?.id ?? null,
    produto_id: master?.id ?? null,
    codigo_produto: prod.codigo,
    nome_produto: prod.nome_produto,
    category: (rennova ? master?.category : prod.category) ?? null,
    lote: prod.lote,
    quantidade_inicial: linha.quantidade,
    quantidade_disponivel: linha.quantidade,
    quantidade_reservada: 0,
    dt_validade: validadeFromInput(prod.dt_validade),
    dt_entrada: p.agora,
    valor_unitario: linha.valor_unitario,
    active: true,
    is_rennova: rennova,
    brand: rennova ? 'Rennova' : (prod.brand ?? null),
    ...(fragmentavel
      ? {
          fragmentavel: true,
          unidades_por_embalagem: master?.unidades_por_embalagem ?? null,
          quantidade_embalagens: prod.quantidade,
          valor_por_embalagem: prod.valor_unitario,
        }
      : {}),
    created_at: p.agora,
    updated_at: p.agora,
  };
}

/** Pendência de catálogo de um item manual (quantidade e valor como na NF). */
function manualPendingDoc(
  p: {
    tenantId: string;
    importId: string;
    idSequencial: number;
    identity: NFIdentity;
    lancamento: number;
    agora: FieldValue;
  },
  { linha, produto }: ManualPlanOk['pending'][number]
) {
  return {
    tenant_id: p.tenantId,
    nf_import_id: p.importId,
    id_sequencial: p.idSequencial,
    numero_nf: p.identity.numero,
    serie: p.identity.serie,
    cnpj_emitente: p.identity.cnpj,
    origem: 'manual',
    lancamento: p.lancamento,
    linha,
    codigo: produto.codigo,
    nome_produto: produto.nome_produto,
    lote: produto.lote,
    quantidade: produto.quantidade,
    valor_unitario: produto.valor_unitario,
    dt_validade: validadeFromInput(produto.dt_validade),
    status: 'aberta',
    created_at: p.agora,
  };
}

/**
 * Grava o registro do lançamento manual: cria (contador + registro +
 * identidade) ou complementa o mesmo ID. No complemento, produtos_pendentes é
 * regravado por leitura-modificação-escrita (não arrayUnion, que fundiria
 * linhas iguais).
 */
function writeManualRecord(
  tx: Transaction,
  p: {
    tenantId: string;
    uid: string;
    identity: NFIdentity;
    identityKey: string;
    chave_acesso?: string;
    tipo: 'rennova' | 'outra_marca';
    decision: { action: 'create' } | { action: 'complement'; nfImportId: string };
    conflict: ConflictInfo | null;
    ultimoId: number | undefined;
    importados: number;
    pendentes: PendingSummary[];
    agora: FieldValue;
  }
): { importId: string; idSequencial: number } {
  const r = refs(p.tenantId);
  const temPendente = p.pendentes.length > 0;
  if (p.decision.action === 'complement') {
    const importId = p.decision.nfImportId;
    tx.update(r.nfImport(importId), {
      produtos_importados: FieldValue.increment(p.importados),
      lancamentos_manuais: FieldValue.increment(1),
      ...(temPendente
        ? {
            produtos_pendentes: [...(p.conflict?.produtos_pendentes ?? []), ...p.pendentes],
            status: 'novo_produto_pendente',
          }
        : {}),
      updated_at: p.agora,
    });
    return { importId, idSequencial: Number(importId) };
  }

  const idSequencial = nextImportId(p.ultimoId);
  const importId = String(idSequencial);
  tx.set(r.counter, { ultimo_id: idSequencial, updated_at: p.agora });
  tx.set(r.nfImport(importId), {
    id_sequencial: idSequencial,
    tenant_id: p.tenantId,
    origem: 'manual',
    identidade: p.identityKey,
    numero_nf: p.identity.numero,
    serie: p.identity.serie,
    cnpj_emitente: p.identity.cnpj,
    ...(p.chave_acesso ? { chave_acesso: p.chave_acesso } : {}),
    tipo: p.tipo,
    status: temPendente ? 'novo_produto_pendente' : 'success',
    produtos_importados: p.importados,
    produtos_pendentes: p.pendentes,
    lancamentos_manuais: 1,
    created_by: p.uid,
    created_at: p.agora,
    updated_at: p.agora,
  });
  tx.set(r.identity(p.identityKey), {
    nf_import_id: importId,
    origem: 'manual',
    created_at: p.agora,
  });
  return { importId, idSequencial };
}

async function readManualMasters(
  tx: Transaction,
  tipo: 'rennova' | 'outra_marca',
  produtos: ManualNfProductInput[]
): Promise<Map<string, MasterLite>> {
  if (tipo !== 'rennova') return new Map<string, MasterLite>();
  const codes = Array.from(
    new Set(produtos.map((prod) => prod.codigo).filter(isCatalogProductCode))
  );
  return readMasters(tx, codes);
}

export async function confirmManualLaunch(p: {
  tenantId: string;
  uid: string;
  identity: NFIdentity;
  chave_acesso?: string;
  tipo: 'rennova' | 'outra_marca';
  produtos: ManualNfProductInput[];
}): Promise<
  | {
      kind: 'created' | 'complemented';
      importId: string;
      produtosImportados: number;
      pendentes: PendingSummary[];
    }
  | { kind: 'blocked'; importId: string; reason: string }
  | { kind: 'invalid'; status: 400 | 422; error: string }
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
    // Todas as leituras antes das escritas (exigência da transação)
    const conflict = await readConflict(tx, tenantId, identityKey);
    const decision = evaluateIdentityConflict('manual', conflict);
    if (decision.action === 'blocked') {
      return { kind: 'blocked', importId: decision.nfImportId, reason: decision.reason };
    }

    const counterSnap = decision.action === 'create' ? await tx.get(r.counter) : null;
    const masters = await readManualMasters(tx, tipo, produtos);

    // O servidor decide pelo catálogo: produto Rennova sem master ativo
    // (ausente ou inativo) vira pendência no mesmo ID.
    const plan = planManualLines(tipo, produtos, masters);
    if (!plan.ok) return { kind: 'invalid', status: plan.status, error: plan.error };
    const tenantName = plan.pending.length > 0 ? await readTenantName(tx, tenantId) : '';

    const agora = FieldValue.serverTimestamp();
    const pendentes: PendingSummary[] = plan.pending.map(({ produto }) => ({
      codigo: produto.codigo,
      nome_produto: produto.nome_produto,
      lote: produto.lote,
    }));
    // n do lançamento: 1 na criação; complementos continuam a contagem do registro
    const lancamento =
      decision.action === 'complement' ? (conflict?.lancamentos_manuais ?? 0) + 1 : 1;

    const { importId, idSequencial } = writeManualRecord(tx, {
      tenantId,
      uid,
      identity,
      identityKey,
      chave_acesso: p.chave_acesso,
      tipo,
      decision,
      conflict,
      ultimoId: counterSnap?.data()?.ultimo_id,
      importados: plan.inventory.length,
      pendentes,
      agora,
    });

    const ctx = { tenantId, importId, idSequencial, identity, tipo, lancamento, agora };
    for (const linha of plan.inventory) tx.set(r.inventory(), manualInventoryDoc(ctx, linha));
    for (const pendente of plan.pending) {
      tx.set(
        adminDb
          .collection('pending_master_products')
          .doc(`${tenantId}_${importId}_m${lancamento}_${pendente.linha}`),
        manualPendingDoc(ctx, pendente)
      );
    }

    if (pendentes.length > 0) {
      setPendingAdminAlert(tx, {
        alertId: `nf_pendencias_${tenantId}_${importId}_m${lancamento}`,
        tenantId,
        tenantName,
        origem: 'manual',
        importId,
        lancamento,
        identity,
        pendentes,
        agora,
      });
    }

    return {
      kind: decision.action === 'complement' ? 'complemented' : 'created',
      importId,
      produtosImportados: plan.inventory.length,
      pendentes,
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
