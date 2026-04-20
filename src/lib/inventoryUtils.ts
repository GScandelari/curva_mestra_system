export interface InventoryStats {
  total_items: number;
  expiring_soon: number;
  low_stock: number;
}

export interface InventoryItemLike {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel: number;
  dt_validade: Date;
}

export interface ProdutoAgrupado<T extends InventoryItemLike = InventoryItemLike> {
  codigo_produto: string;
  nome_produto: string;
  quantidade_total: number;
  lotes: T[];
}

export function parseInventoryDate(dt_validade: unknown): Date | null {
  if (!dt_validade) return null;
  if (typeof dt_validade === 'string') {
    if (dt_validade.includes('/')) {
      const [day, month, year] = dt_validade.split('/');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(dt_validade);
  }
  if (typeof dt_validade === 'object' && 'toDate' in (dt_validade as object)) {
    return (dt_validade as { toDate: () => Date }).toDate();
  }
  return null;
}

export function computeInventoryStats(
  docs: { data: () => Record<string, unknown> }[],
  cutoffDate: Date
): InventoryStats {
  let total_items = 0;
  let expiring_soon = 0;
  let low_stock = 0;

  for (const doc of docs) {
    const data = doc.data();
    if ((data.quantidade_disponivel as number) <= 0) continue;
    total_items++;
    const expDate = parseInventoryDate(data.dt_validade);
    if (expDate && expDate <= cutoffDate) expiring_soon++;
    if ((data.quantidade_disponivel as number) <= 5) low_stock++;
  }

  return { total_items, expiring_soon, low_stock };
}

export function agruparProdutosPorCodigo<T extends InventoryItemLike>(
  items: T[]
): ProdutoAgrupado<T>[] {
  const gruposPorCodigo = new Map<string, T[]>();

  for (const item of items) {
    const grupo = gruposPorCodigo.get(item.codigo_produto) ?? [];
    grupo.push(item);
    gruposPorCodigo.set(item.codigo_produto, grupo);
  }

  const result: ProdutoAgrupado<T>[] = [];

  gruposPorCodigo.forEach((lotes, codigo) => {
    const lotesOrdenados = lotes.sort(
      (a, b) => new Date(a.dt_validade).getTime() - new Date(b.dt_validade).getTime()
    );
    const quantidadeTotal = lotesOrdenados.reduce((sum, l) => sum + l.quantidade_disponivel, 0);
    result.push({
      codigo_produto: codigo,
      nome_produto: lotesOrdenados[0].nome_produto,
      quantidade_total: quantidadeTotal,
      lotes: lotesOrdenados,
    });
  });

  return result.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
}
