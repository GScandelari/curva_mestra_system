# Feature: Reformulação do Dashboard da Clínica

**Projeto:** Curva Mestra
**Data:** 01/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Scandelari
**Data de Conclusão:** 01/05/2026
**Branch de execução:** `feature/reformulacao-dashboard-clinica`
**Tipo:** Feature
**Branch sugerida:** `feature/reformulacao-dashboard-clinica`
**Prioridade:** Alta
**Versão:** 1.2

> O Dashboard atual (`/clinic/dashboard`) exibe informações dispersas sem organização clara por domínio. O objetivo desta feature é reestruturar a página para apresentar cinco seções bem definidas — **Estoque**, **Procedimentos**, **Alertas**, **Próximos Procedimentos** e **Atividade Recente** — dando ao administrador da clínica uma visão rápida e acionável do estado da operação. Os dados de estoque passam a ser agrupados por categoria (campo `grupo` do MasterProduct), com total de unidades e valor por categoria. Os dados de procedimentos passam a ser contextualizados no mês atual, com comparativo de crescimento em relação ao mês anterior. As seções de Próximos Procedimentos e Atividade Recente são mantidas do dashboard atual, preservando sua funcionalidade existente.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/reformulacao-dashboard-clinica`
**PR target:** branch pessoal → `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/reformulacao-dashboard-clinica
```

| Step   | Tipo    | Escopo      | Mensagem sugerida                                                                             |
| ------ | ------- | ----------- | --------------------------------------------------------------------------------------------- |
| STEP 1 | `feat`  | `dashboard` | `feat(dashboard): add getDashboardEstoqueStats service with category grouping`                |
| STEP 2 | `feat`  | `dashboard` | `feat(dashboard): add getDashboardProcedimentosStats service with monthly comparison`         |
| STEP 3 | `feat`  | `dashboard` | `feat(dashboard): restructure clinic dashboard with summary blocks and detail sections`       |
| STEP 4 | `docs`  | `tasks`     | `docs(tasks): move FEAT-reformulacao-dashboard-clinica to TASK_COMPLETED`                     |

---

## 1. Estado Atual

A página `src/app/(clinic)/clinic/dashboard/page.tsx` exibe:
- 4 cards de topo: total de produtos (unidades), valor total, vencendo em 30 dias, estoque baixo
- Seção "Ações Rápidas" com botões de navegação
- 3 cards inferiores: próximos procedimentos, alertas de vencimento, atividade recente

**Problemas identificados:**
- Estoque exibe apenas o total de unidades sem agrupamento por categoria
- Procedimentos mostram apenas os próximos agendados, sem contexto do mês atual nem comparativo histórico
- Seção "Ações Rápidas" é redundante com a navegação lateral — pode ser mantida ou removida

**O que deve ser mantido:**
- "Próximos Procedimentos" — manter com a funcionalidade atual (procedimentos agendados nas próximas 2 semanas)
- "Atividade Recente" — manter com a funcionalidade atual (últimas movimentações do estoque)

---

## 2. Modelo de Dados Relevante

### Inventário

```ts
// Firestore: /tenants/{tenantId}/inventory
// InventoryItem (src/types/index.ts)
{
  nome_produto: string,        // Nome do produto
  quantidade_disponivel: number,
  valor_unitario: number,
  dt_validade: string,         // DD/MM/YYYY
  master_product_id?: string,  // Referência ao MasterProduct global
  produto_id?: string,         // Alias alternativo ao master_product_id
  active: boolean,
}
```

```ts
// Firestore: /master_products (coleção global, sem tenant_id)
// MasterProduct (src/types/masterProduct.ts)
{
  id: string,
  code: string,
  name: string,
  grupo?: string,   // Categoria: "Preenchedores", "Bioestimuladores", "Toxinas", etc.
  active: boolean,
}
```

**Relação:** `InventoryItem.master_product_id` (ou `produto_id`) → `MasterProduct.id`

O campo `grupo` do `MasterProduct` é a categoria a ser usada para agrupamento. Itens sem `master_product_id` ou com `MasterProduct` sem `grupo` devem ser agrupados em `"Sem Categoria"`.

### Procedimentos

```ts
// Firestore: /tenants/{tenantId}/solicitacoes
// Solicitacao (src/types/index.ts)
{
  dt_procedimento: Timestamp,  // Data do procedimento
  status: 'criada' | 'agendada' | 'concluida' | 'aprovada' | 'reprovada' | 'cancelada',
}
```

**Mapeamento para os blocos:**
- "Feitos no mês": `status === 'concluida'` + `dt_procedimento` no mês atual
- "Agendados no mês": `status === 'agendada'` + `dt_procedimento` no mês atual
- "Total do mês": todos os status (exceto `cancelada` e `reprovada`) + `dt_procedimento` no mês atual
- "Crescimento %": (total mês atual − total mês anterior) / total mês anterior × 100

---

## 3. Layout Esperado

```
┌─────────────────────────────────────────────────────────────────┐
│  Olá, [Nome]!                                                   │
│  Visão geral da clínica                                         │
├────────────────────┬────────────────────┬───────────────────────┤
│   ESTOQUE          │   PROCEDIMENTOS    │   ALERTAS             │
│                    │   (mês atual)      │                       │
│  Por categoria:    │  Feitos:      12   │  Vencidos:      2     │
│  Preenchedores 40  │  Agendados:    8   │  Vencem em 30d: 5     │
│  Bioestimul.   10  │  Total mês:   20   │  Estoque baixo: 3     │
│  Fios PDO      2   │  vs mês ant: +15%  │                       │
│  Toxinas       6   │                    │                       │
│  Cannulas      47  │                    │                       │
│  ─────────────     │                    │                       │
│  Total:  105 un.   │                    │                       │
│  5 categorias      │                    │                       │
│                    │                    │                       │
│  Valor total:      │                    │                       │
│  R$ X.XXX,XX       │                    │                       │
│                    │                    │                       │
│  Por categoria:    │                    │                       │
│  Preench. R$XXX    │                    │                       │
│  ...               │                    │                       │
├────────────────────┴────────────────────┴───────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │  PRÓXIMOS PROCEDIMENTOS  │  │    ATIVIDADE RECENTE      │    │
│  │  (próximas 2 semanas)    │  │  (últimas movimentações)  │    │
│  │  [lista existente]       │  │  [lista existente]        │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Arquivos Afetados

| Arquivo | Ação |
| ------- | ---- |
| `src/lib/services/dashboardService.ts` | Criar — funções de dados para o dashboard |
| `src/app/(clinic)/clinic/dashboard/page.tsx` | Refatorar — nova estrutura de 3 blocos |

> **Nota:** Não criar sub-componentes separados para esta fase — manter tudo na page.tsx para simplicidade. Extrair componentes apenas se o arquivo ultrapassar ~400 linhas.

---

## 5. Steps de Implementação

### STEP 1 — `getDashboardEstoqueStats` em dashboardService.ts

Criar `src/lib/services/dashboardService.ts` com a função:

```ts
export interface CategoriaStats {
  nome: string;
  totalUnidades: number;
  totalValor: number;
}

export interface DashboardEstoqueStats {
  categorias: CategoriaStats[];         // Ordenadas por totalUnidades DESC
  totalUnidades: number;                // Soma de todas as categorias
  totalCategorias: number;
  totalValor: number;                   // Valor total de todo o estoque
}

export async function getDashboardEstoqueStats(tenantId: string): Promise<DashboardEstoqueStats>
```

**Estratégia de implementação:**

1. Buscar todos os `InventoryItem` ativos do tenant: `/tenants/{tenantId}/inventory` onde `active == true` e `quantidade_disponivel > 0`
2. Coletar os `master_product_id` únicos dos itens (campo `master_product_id` ou `produto_id`)
3. Buscar os `MasterProduct` correspondentes da coleção global `/master_products` (em lotes de até 30 IDs via `where('__name__', 'in', [...ids])`)
4. Montar um mapa `{ [masterId]: grupo }` para lookup O(1)
5. Agrupar os itens de inventário por `grupo` (fallback: `"Sem Categoria"`), somando `quantidade_disponivel` e `quantidade_disponivel * valor_unitario` por grupo
6. Retornar o resultado ordenado por `totalUnidades` decrescente

**Validação:** Testar com dados reais — os totais por categoria devem bater com a soma manual dos itens do inventário agrupados por produto.

### STEP 2 — `getDashboardProcedimentosStats` em dashboardService.ts

Adicionar à `dashboardService.ts`:

```ts
export interface DashboardProcedimentosStats {
  feitos: number;        // status === 'concluida' no mês atual
  agendados: number;     // status === 'agendada' no mês atual
  total: number;         // todos exceto cancelada/reprovada no mês atual
  totalMesAnterior: number;
  crescimentoPercent: number | null; // null se mês anterior for 0 (evitar divisão por zero)
}

export async function getDashboardProcedimentosStats(tenantId: string): Promise<DashboardProcedimentosStats>
```

**Estratégia de implementação:**

1. Calcular `inicioMesAtual`, `fimMesAtual`, `inicioMesAnterior`, `fimMesAnterior` como `Timestamp`
2. Buscar solicitações com `dt_procedimento >= inicioMesAtual` e `dt_procedimento <= fimMesAtual`
3. Filtrar em memória por status para obter `feitos`, `agendados`, `total`
4. Buscar solicitações do mês anterior com mesma lógica para `totalMesAnterior`
5. Calcular `crescimentoPercent`: `totalMesAnterior === 0 ? null : ((total - totalMesAnterior) / totalMesAnterior) * 100`

> **Atenção ao índice Firestore:** a query com `where` em `dt_procedimento` e range query requer índice composto se houver outro `where`. Usar apenas o filtro de data e filtrar status em memória para evitar necessidade de índice adicional.

**Validação:** Verificar que os contadores batem com os dados na página `/clinic/requests`.

### STEP 3 — Refatorar `clinic/dashboard/page.tsx`

Substituir o conteúdo da página pelo novo layout de 3 blocos:

**Estrutura de estado:**
```ts
const [estoqueStats, setEstoqueStats] = useState<DashboardEstoqueStats | null>(null);
const [procedimentosStats, setProcedimentosStats] = useState<DashboardProcedimentosStats | null>(null);
const [alertasStats, setAlertasStats] = useState<{
  vencidos: number;
  vencendo30dias: number;
  estoqueBaixo: number;
} | null>(null);
```

**Carregamento:** Usar `Promise.all` para buscar os 3 blocos em paralelo no `useEffect`. Manter o listener `onSnapshot` apenas para os alertas de inventário (dados mais críticos para tempo real). Os blocos de Estoque e Procedimentos podem usar `getDocs` simples (não precisam ser realtime para o dashboard).

**Bloco Estoque:**
- Listar categorias com `totalUnidades` e `totalValor`
- Exibir totais gerais (unidades, categorias, valor)
- Itens "Sem Categoria" aparecem por último

**Bloco Procedimentos:**
- Cards: Feitos / Agendados / Total do mês
- Badge de crescimento: verde com `↑ X%` ou vermelho com `↓ X%` ou cinza `—` se mês anterior for 0
- Título com mês/ano atual (ex: "Procedimentos — Maio 2026")

**Bloco Alertas:**
- 3 linhas com ícone + número + label
- Cores: vencidos = vermelho, vencendo = amarelo, baixo = laranja
- Cada linha é clicável e navega para `/clinic/inventory` com o filtro correspondente

**Seção Próximos Procedimentos** (abaixo dos 3 blocos, lado a lado com Atividade Recente):
- Manter a funcionalidade atual integralmente: lista de procedimentos agendados nas próximas 2 semanas
- Fonte de dados: `getUpcomingProcedures(tenantId, 5)` — já existe em `solicitacaoService`
- Comportamento de clique, badge de status e link "Ver todos" devem ser preservados

**Seção Atividade Recente** (abaixo dos 3 blocos, ao lado de Próximos Procedimentos):
- Manter a funcionalidade atual integralmente: lista das últimas movimentações do estoque
- Fonte de dados: `getRecentActivity(tenantId, 5)` — já existe em `inventoryService`
- Ícones de entrada/saída e formatação de timestamp devem ser preservados

**Validação:** Verificar que todos os blocos e seções carregam corretamente, exibem loading skeleton, e mostram estado vazio quando não há dados.

### STEP 4 — Modo B: mover doc para TASK_COMPLETED

Executar o **Modo B** do agente `dev-task-manager` ainda na task branch antes de abrir a PR.

---

## 6. Checklist de Validação Final

- [ ] `getDashboardEstoqueStats` retorna categorias corretas com totais de unidades e valor
- [ ] Itens sem `master_product_id` ou sem `grupo` agrupados em "Sem Categoria"
- [ ] `getDashboardProcedimentosStats` conta corretamente feitos, agendados e total do mês
- [ ] Crescimento % calculado corretamente (incluindo caso mês anterior = 0)
- [ ] Loading skeletons em todos os 3 blocos
- [ ] Estado vazio tratado em todos os 3 blocos
- [ ] Links dos alertas navegam para o inventário com filtro correto
- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] Documento movido para `TASK_COMPLETED/` (commit na task branch)

---

## 7. Observações

- O campo `grupo` no `MasterProduct` é opcional — produtos cadastrados sem grupo devem aparecer em "Sem Categoria" no dashboard, não devem ser ignorados.
- O "estoque mínimo" está atualmente hardcoded como `< 10 unidades` no código existente. Manter esse threshold por ora.
- Não há índice Firestore para `dt_procedimento` range query combinada com `status` — filtrar `status` em memória para evitar erros de índice.
- "Próximos Procedimentos" e "Atividade Recente" são mantidos obrigatoriamente — exibidos abaixo dos 3 blocos de resumo, lado a lado.
- A seção de "Ações Rápidas" pode ser mantida ou removida — decisão do desenvolvedor durante a implementação.

---

## 13. Histórico de Versões

| Versão | Data       | Autor               | Descrição                                                              |
| ------ | ---------- | ------------------- | ---------------------------------------------------------------------- |
| 1.0    | 01/05/2026 | Doc Writer (Claude) | Documento criado                                                       |
| 1.1    | 01/05/2026 | Doc Writer (Claude) | Adicionadas seções Próximos Procedimentos e Atividade Recente ao escopo |
| 1.2    | 01/05/2026 | Guilherme Scandelari | Task concluída — movida para TASK_COMPLETED |
