/**
 * Custo Hora Service
 * Leitura/escrita da configuração de precificação pela hora clínica
 * (tenants/{tenantId}/financeiro/custo_hora). Cálculos ficam em
 * src/lib/precificacao.ts; a proteção real está em firestore.rules
 * (bloco `financeiro`: só clinic_admin, consultor só com opt-in).
 */

import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  mesCorrenteSaoPaulo,
  type CustoHoraConfigInput,
  type LoteParaCusto,
} from '@/lib/precificacao';
import { determineFinancialShareAuditAction } from '@/lib/auditLogPayload';
import { writeAuditLog } from '@/lib/services/auditLogService';
import type { BoletoTec, CustoHoraConfig } from '@/types';

export type { CustoHoraConfigInput } from '@/lib/precificacao';

const docRef = (tenantId: string) => doc(db, 'tenants', tenantId, 'financeiro', 'custo_hora');

/**
 * Documento inexistente → null. `permission-denied` é propagado: a tela do
 * consultor trata como "não compartilhado"; a do admin mostra o erro traduzido.
 */
export async function getCustoHoraConfig(tenantId: string): Promise<CustoHoraConfig | null> {
  const snap = await getDoc(docRef(tenantId));
  return snap.exists() ? (snap.data() as CustoHoraConfig) : null;
}

/**
 * RN-02/D1: boleto novo ou com `parcelas_pagas` editado passa a contar a
 * partir do mês corrente; os demais mantêm o mês de referência gravado.
 * A tela marca o boleto editado com o mês corrente, então mudança em
 * `mes_referencia` também conta como edição — sem isso, informar de novo o
 * mesmo número gravado meses atrás manteria a referência antiga.
 */
function aplicarMesReferencia(
  boletos: BoletoTec[],
  existentes: BoletoTec[],
  mesAtual: string
): BoletoTec[] {
  const porId = new Map(existentes.map((b) => [b.id, b]));
  return boletos.map((boleto) => {
    const anterior = porId.get(boleto.id);
    const inalterado =
      anterior?.parcelas_pagas === boleto.parcelas_pagas &&
      anterior?.mes_referencia === boleto.mes_referencia;
    return inalterado ? boleto : { ...boleto, mes_referencia: mesAtual };
  });
}

export interface SaveCustoHoraOptions {
  consultantName?: string;
  /** RN-16: o compartilhamento anterior era de outro consultor e foi desligado. */
  trocaDeConsultor?: boolean;
}

/**
 * D4/RN-14: só a mudança do compartilhamento com o consultor é auditada.
 * Best-effort: falha na auditoria não desfaz nem bloqueia o salvamento.
 */
async function auditarCompartilhamento(
  tenantId: string,
  userId: string,
  actorName: string,
  existing: CustoHoraConfig | null,
  config: CustoHoraConfig,
  options: SaveCustoHoraOptions
): Promise<void> {
  const audit = determineFinancialShareAuditAction(existing, config, {
    trocaDeConsultor: options.trocaDeConsultor,
  });
  if (!audit) return;

  const descricao =
    audit.action === 'share_with_consultant'
      ? `Dados financeiros compartilhados com o consultor ${options.consultantName ?? ''}`.trim()
      : 'Compartilhamento de dados financeiros com o consultor revogado';

  try {
    await writeAuditLog({
      tenant_id: tenantId,
      entity_type: 'financial_config',
      entity_id: tenantId,
      action: audit.action,
      descricao,
      actor_id: userId,
      actor_name: actorName,
      actor_role: 'clinic_admin',
      metadata: audit.metadata,
    });
  } catch (error) {
    console.error('Erro ao auditar compartilhamento financeiro:', error);
  }
}

export async function saveCustoHoraConfig(
  tenantId: string,
  userId: string,
  actorName: string,
  input: CustoHoraConfigInput,
  existing: CustoHoraConfig | null,
  options: SaveCustoHoraOptions = {}
): Promise<CustoHoraConfig> {
  const now = Timestamp.now();
  const compartilhar = input.compartilhar_com_consultor === true;

  const config: CustoHoraConfig = {
    ...input,
    tenant_id: tenantId,
    boletos_tec: aplicarMesReferencia(
      input.boletos_tec,
      existing?.boletos_tec ?? [],
      mesCorrenteSaoPaulo()
    ),
    compartilhar_com_consultor: compartilhar,
    compartilhado_com_consultant_id: compartilhar ? input.compartilhado_com_consultant_id : null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    updated_by: userId,
  };

  await setDoc(docRef(tenantId), config);
  await auditarCompartilhamento(tenantId, userId, actorName, existing, config, options);
  return config;
}

/**
 * Lotes do inventário para o custo médio (RN-09). Sem filtro de `active`: o
 * fallback histórico precisa dos lotes inativos/zerados.
 */
export async function listInventoryForCosting(tenantId: string): Promise<LoteParaCusto[]> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'inventory'));
  return snap.docs
    .map((d) => d.data())
    .filter((data) => typeof data.codigo_produto === 'string')
    .map((data) => ({
      codigo_produto: data.codigo_produto,
      valor_unitario: data.valor_unitario,
      quantidade_disponivel: Number(data.quantidade_disponivel) || 0,
      quantidade_inicial: Number(data.quantidade_inicial) || 0,
      active: data.active,
      brand: typeof data.brand === 'string' ? data.brand : undefined,
    }));
}
