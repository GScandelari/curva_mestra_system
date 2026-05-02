/**
 * Dashboard Service
 * Funções de agregação de dados para o Dashboard da Clínica
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================================================
// ESTOQUE
// ============================================================================

export interface CategoriaStats {
  nome: string;
  totalUnidades: number;
  totalValor: number;
}

export interface DashboardEstoqueStats {
  categorias: CategoriaStats[]; // Ordenadas por totalUnidades DESC, "Sem Categoria" por último
  totalUnidades: number;
  totalCategorias: number;
  totalValor: number;
}

export async function getDashboardEstoqueStats(tenantId: string): Promise<DashboardEstoqueStats> {
  const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
  const q = query(inventoryRef, where('active', '==', true));
  const snapshot = await getDocs(q);

  // Agrupar itens por categoria usando o campo denormalizado `category`
  // (gravado em cada doc de inventário no momento da entrada pelo add-products)
  const categoriaMap: Record<string, CategoriaStats> = {};
  let totalUnidades = 0;
  let totalValor = 0;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const quantidade = data.quantidade_disponivel || 0;
    if (quantidade <= 0) return;

    const categoria = (data.category as string | undefined) || 'Sem Categoria';
    const valor = quantidade * (data.valor_unitario || 0);

    if (!categoriaMap[categoria]) {
      categoriaMap[categoria] = { nome: categoria, totalUnidades: 0, totalValor: 0 };
    }
    categoriaMap[categoria].totalUnidades += quantidade;
    categoriaMap[categoria].totalValor += valor;
    totalUnidades += quantidade;
    totalValor += valor;
  });

  // Ordenar: categorias com dados primeiro (por unidades DESC), "Sem Categoria" por último
  const categorias = Object.values(categoriaMap).sort((a, b) => {
    if (a.nome === 'Sem Categoria') return 1;
    if (b.nome === 'Sem Categoria') return -1;
    return b.totalUnidades - a.totalUnidades;
  });

  return {
    categorias,
    totalUnidades,
    totalCategorias: categorias.filter((c) => c.nome !== 'Sem Categoria').length,
    totalValor,
  };
}

// ============================================================================
// PROCEDIMENTOS
// ============================================================================

export interface DashboardProcedimentosStats {
  feitos: number; // status === 'concluida' no mês atual
  agendados: number; // status === 'agendada' no mês atual
  total: number; // todos exceto cancelada/reprovada no mês atual
  totalMesAnterior: number;
  crescimentoPercent: number | null; // null se mês anterior for 0
}

export async function getDashboardProcedimentosStats(
  tenantId: string
): Promise<DashboardProcedimentosStats> {
  const now = new Date();

  const inicioMesAtual = new Date(now.getFullYear(), now.getMonth(), 1);
  const fimMesAtual = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const solicitacoesRef = collection(db, 'tenants', tenantId, 'solicitacoes');

  // Buscar mês atual e anterior em paralelo (filtrar status em memória para evitar índice composto)
  const [snapAtual, snapAnterior] = await Promise.all([
    getDocs(
      query(
        solicitacoesRef,
        where('dt_procedimento', '>=', Timestamp.fromDate(inicioMesAtual)),
        where('dt_procedimento', '<=', Timestamp.fromDate(fimMesAtual))
      )
    ),
    getDocs(
      query(
        solicitacoesRef,
        where('dt_procedimento', '>=', Timestamp.fromDate(inicioMesAnterior)),
        where('dt_procedimento', '<=', Timestamp.fromDate(fimMesAnterior))
      )
    ),
  ]);

  const STATUS_EXCLUIDOS = new Set(['cancelada', 'reprovada']);

  let feitos = 0;
  let agendados = 0;
  let total = 0;

  snapAtual.forEach((docSnap) => {
    const status = docSnap.data().status as string;
    if (STATUS_EXCLUIDOS.has(status)) return;
    total++;
    if (status === 'concluida') feitos++;
    if (status === 'agendada') agendados++;
  });

  let totalMesAnterior = 0;
  snapAnterior.forEach((docSnap) => {
    const status = docSnap.data().status as string;
    if (!STATUS_EXCLUIDOS.has(status)) totalMesAnterior++;
  });

  const crescimentoPercent =
    totalMesAnterior === 0
      ? null
      : Math.round(((total - totalMesAnterior) / totalMesAnterior) * 100);

  return { feitos, agendados, total, totalMesAnterior, crescimentoPercent };
}
