# Feature: Cards de Procedimentos por Mês na Página de Listagem

**Projeto:** Curva Mestra
**Data:** 02/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Tipo:** Feature
**Branch sugerida:** `feature/cards-procedimentos-por-mes`
**Prioridade:** Média
**Versão:** 1.0

> Reformulação dos cards de estatísticas na página `clinic/requests/page.tsx`: substituir contagens globais por métricas do mês atual, adicionar indicador de crescimento em relação ao mês anterior e reduzir de 4 para 3 cards.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/cards-procedimentos-por-mes`
**PR target:** branch pessoal (`gscandelari_setup` ou `lhuan_setup`) → `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/cards-procedimentos-por-mes
```

| Step   | Tipo   | Escopo      | Mensagem sugerida                                                                          |
|--------|--------|-------------|-------------------------------------------------------------------------------------------|
| STEP 1 | `feat` | `dashboard` | `feat(dashboard): add agendadasMes, concluidasMes and crescimentoAbsoluto to stats`       |
| STEP 2 | `feat` | `requests`  | `feat(requests): replace global cards with current-month stats and growth indicator`       |
| STEP 3 | `docs` | `tasks`     | `docs(tasks): move FEAT-cards-procedimentos-por-mes to TASK_COMPLETED`                    |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A página `src/app/(clinic)/clinic/requests/page.tsx` exibe quatro cards de estatísticas:

| Card | Dado | Período |
|------|------|---------|
| Total | `solicitacoes.length` | Todo o histórico carregado |
| Agendadas | `s.status === 'agendada'` | Todo o histórico |
| Efetuadas | `s.status === 'efetuada'` | Todo o histórico |
| Concluídas | `s.status === 'concluida'` | Todo o histórico |

Os dados são computados da lista já carregada no estado (`solicitacoes`), sem distinção de período. O valor de "Total" varia conforme o filtro de status aplicado — se o usuário filtrar por "agendada", o Total mostra apenas agendadas.

O `dashboardService.ts` já possui a função `getDashboardProcedimentosStats` que faz queries Firestore para o mês atual e o anterior, retornando: `efetuados`, `agendados`, `total`, `totalMesAnterior`, `crescimentoPercent`. Faltam os campos `agendadasMes`, `concluidasMes` e `crescimentoAbsoluto`.

### 1.2 Problema identificado

- Os cards mostram dados históricos globais sem contexto temporal, o que não reflete o movimento atual da clínica.
- O card "Total" é inconsistente com o filtro de status ativo (muda conforme o filtro).
- Não há indicador de crescimento/tendência mensal na listagem.
- O card "Efetuadas" é redundante com o status `efetuada` (procedimentos já realizados mas ainda não concluídos formalmente) e confunde com o conceito de procedimento já feito.

### 1.3 Motivação

Cards com contexto mensal e comparação com o mês anterior dão à clínica uma visão operacional imediata sem precisar acessar o dashboard separado.

---

## 2. Objetivos

1. Substituir os 4 cards por 3 cards com escopo do mês atual.
2. Card "Mês: [MÊS]" — total de procedimentos do mês com indicador de crescimento (% e quantidade absoluta) em relação ao mês anterior.
3. Card "Agendadas" — procedimentos com `status === 'agendada'` e `dt_procedimento` no mês atual.
4. Card "Concluídas" — procedimentos com `status === 'concluida'` e `dt_procedimento` no mês atual.
5. Remover o card "Efetuadas".

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descrição                                                                                                      | Prioridade |
|-------|----------------------------------------------------------------------------------------------------------------|------------|
| RF-01 | Card "Mês: [MÊS ATUAL]" exibe total de procedimentos do mês atual (exceto `cancelada`)                        | Must       |
| RF-02 | Card "Mês" contém subtexto com crescimento em % e em quantidade absoluta vs mês anterior                      | Must       |
| RF-03 | Card "Agendadas" exibe contagem de procedimentos com `status === 'agendada'` e `dt_procedimento` no mês atual  | Must       |
| RF-04 | Card "Concluídas" exibe contagem de procedimentos com `status === 'concluida'` e `dt_procedimento` no mês atual | Must      |
| RF-05 | Grid passa de 4 para 3 colunas                                                                                  | Must       |
| RF-06 | Card "Efetuadas" é removido                                                                                     | Must       |
| RF-07 | Os cards são carregados independentemente da lista e do filtro de status ativo                                   | Must       |

### 3.2 Requisitos Não Funcionais (RNF)

| ID     | Descrição                                                                                      | Categoria      |
|--------|------------------------------------------------------------------------------------------------|----------------|
| RNF-01 | Os stats do mês devem vir de query Firestore própria, não derivados da lista filtrada          | Confiabilidade |
| RNF-02 | A query de stats não deve bloquear a renderização da lista — loading independente               | UX             |

### 3.3 Regras de Negócio (RN)

| ID    | Regra                                                                                                                                      |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------|
| RN-01 | "Mês atual" é definido por `dt_procedimento` (não `created_at`) — consistente com `dashboardService`                                     |
| RN-02 | Status `cancelada` e `reprovada` são excluídos de todos os totais                                                                        |
| RN-03 | Se `totalMesAnterior === 0`, o indicador de crescimento exibe "Primeiro mês com dados" em vez de percentual                              |
| RN-04 | Crescimento positivo exibe em verde com `▲`; negativo em vermelho com `▼`; neutro em cinza com `→`                                       |
| RN-05 | O label do card usa o nome do mês em pt-BR com inicial maiúscula: ex. "Mês: Maio 2026"                                                   |

---

## 4. Mapa de Impacto

### 4.1 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/lib/services/dashboardService.ts` | Adicionar campos `agendadasMes`, `concluidasMes`, `crescimentoAbsoluto` à interface `DashboardProcedimentosStats` e à função `getDashboardProcedimentosStats` |
| `src/app/(clinic)/clinic/requests/page.tsx` | Importar e chamar `getDashboardProcedimentosStats`; substituir os 4 cards por 3; adicionar subtexto de crescimento no card de mês |

### 4.2 O que NÃO muda

- A lista de procedimentos, filtros e busca — sem alteração
- A tabela de resultados — sem alteração
- `dashboardService.getDashboardEstoqueStats` — sem alteração
- O dashboard da clínica (`clinic/dashboard`) — sem alteração
- A página do consultor (`consultant/.../procedures`) — fora do escopo desta task

---

## 5. Especificação Técnica

### 5.1 Extensão de `DashboardProcedimentosStats`

```ts
// ANTES
export interface DashboardProcedimentosStats {
  efetuados: number;
  agendados: number;
  total: number;
  totalMesAnterior: number;
  crescimentoPercent: number | null;
}

// DEPOIS
export interface DashboardProcedimentosStats {
  efetuados: number;        // status === 'concluida' no mês atual (mantido — usado pelo dashboard)
  agendados: number;        // status === 'agendada' | 'efetuada' no mês atual (mantido — usado pelo dashboard)
  agendadasMes: number;     // NOVO: status === 'agendada', dt_procedimento no mês atual
  concluidasMes: number;    // NOVO: status === 'concluida', dt_procedimento no mês atual
  total: number;
  totalMesAnterior: number;
  crescimentoPercent: number | null;
  crescimentoAbsoluto: number; // NOVO: total - totalMesAnterior (pode ser negativo)
}
```

### 5.2 Cálculo dos novos campos em `getDashboardProcedimentosStats`

Dentro do `snapAtual.forEach` existente, adicionar:

```ts
if (status === 'agendada') agendadasMes++;
if (status === 'concluida') concluidasMes++;
```

E no retorno:

```ts
return {
  efetuados,
  agendados,
  agendadasMes,     // novo
  concluidasMes,    // novo
  total,
  totalMesAnterior,
  crescimentoPercent,
  crescimentoAbsoluto: total - totalMesAnterior, // novo
};
```

### 5.3 Novos cards em `requests/page.tsx`

**Estado adicional:**

```ts
const [mesStats, setMesStats] = useState<DashboardProcedimentosStats | null>(null);
const [loadingStats, setLoadingStats] = useState(true);
```

**Efeito adicional** (paralelo ao carregamento da lista):

```ts
useEffect(() => {
  async function loadStats() {
    if (!tenantId) return;
    try {
      setLoadingStats(true);
      const stats = await getDashboardProcedimentosStats(tenantId);
      setMesStats(stats);
    } catch (error) {
      console.error('Erro ao carregar stats do mês:', error);
    } finally {
      setLoadingStats(false);
    }
  }
  loadStats();
}, [tenantId]);
```

**Label do mês:**

```ts
const mesAtualLabel = new Date().toLocaleDateString('pt-BR', {
  month: 'long',
  year: 'numeric',
});
// ex: "maio de 2026" → capitalizar: "Maio de 2026"
const mesLabel = mesAtualLabel.charAt(0).toUpperCase() + mesAtualLabel.slice(1);
```

**Subtexto de crescimento** (componente inline):

```tsx
function CrescimentoSubtext({ stats }: { stats: DashboardProcedimentosStats }) {
  const { crescimentoPercent, crescimentoAbsoluto, totalMesAnterior } = stats;

  if (totalMesAnterior === 0) {
    return <p className="text-xs text-muted-foreground mt-1">Primeiro mês com dados</p>;
  }

  const sinal = crescimentoAbsoluto > 0 ? '+' : '';
  const cor =
    crescimentoAbsoluto > 0
      ? 'text-green-600'
      : crescimentoAbsoluto < 0
        ? 'text-red-600'
        : 'text-muted-foreground';
  const icone = crescimentoAbsoluto > 0 ? '▲' : crescimentoAbsoluto < 0 ? '▼' : '→';

  return (
    <p className={`text-xs mt-1 ${cor}`}>
      {icone} {sinal}{crescimentoPercent}% ({sinal}{crescimentoAbsoluto} vs mês anterior)
    </p>
  );
}
```

**Grid de cards (3 colunas):**

```tsx
<div className="grid gap-4 md:grid-cols-3">
  {/* Card 1: Mês atual */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Mês: {mesLabel}</CardTitle>
      <FileText className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {loadingStats ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <>
          <div className="text-2xl font-bold">{mesStats?.total ?? '—'}</div>
          {mesStats && <CrescimentoSubtext stats={mesStats} />}
        </>
      )}
    </CardContent>
  </Card>

  {/* Card 2: Agendadas no mês */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
      <Calendar className="h-4 w-4 text-blue-600" />
    </CardHeader>
    <CardContent>
      {loadingStats ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold">{mesStats?.agendadasMes ?? '—'}</div>
      )}
    </CardContent>
  </Card>

  {/* Card 3: Concluídas no mês */}
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
      <Package className="h-4 w-4 text-purple-600" />
    </CardHeader>
    <CardContent>
      {loadingStats ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold">{mesStats?.concluidasMes ?? '—'}</div>
      )}
    </CardContent>
  </Card>
</div>
```

---

## 6. Plano de Implementação

### STEP 1 — Estender `dashboardService.ts`

**Arquivo:** `src/lib/services/dashboardService.ts`

**Ações:**
1. Adicionar `agendadasMes`, `concluidasMes`, `crescimentoAbsoluto` à interface `DashboardProcedimentosStats`
2. Declarar `let agendadasMes = 0` e `let concluidasMes = 0` antes do `forEach`
3. Dentro do `snapAtual.forEach`: adicionar `if (status === 'agendada') agendadasMes++` e `if (status === 'concluida') concluidasMes++`
4. Atualizar o `return` com os novos campos

**Validação:** `npm run type-check` — nenhum erro. O dashboard (`clinic/dashboard`) que usa `getDashboardProcedimentosStats` só acessa `efetuados`, `agendados`, `total`, `crescimentoPercent` — os novos campos são aditivos e não quebram consumidores existentes.

**Commit:** `feat(dashboard): add agendadasMes, concluidasMes and crescimentoAbsoluto to stats`

---

### STEP 2 — Atualizar `requests/page.tsx`

**Arquivo:** `src/app/(clinic)/clinic/requests/page.tsx`

**Ações:**
1. Importar `getDashboardProcedimentosStats` e `DashboardProcedimentosStats` de `dashboardService`
2. Importar `Skeleton` de `@/components/ui/skeleton` (se não importado)
3. Adicionar estado `mesStats` e `loadingStats`
4. Adicionar `useEffect` para carregar stats ao montar
5. Adicionar helper `mesLabel` (nome do mês capitalizado)
6. Adicionar componente interno `CrescimentoSubtext`
7. Substituir o grid de 4 cards pelo de 3 cards conforme especificação
8. Remover o import de `Package` se não mais usado em outros lugares da página (verificar)

**Validação:** Abrir a página e conferir que:
- Os 3 cards aparecem com dados do mês atual
- O subtexto de crescimento exibe corretamente
- Os cards não se alteram ao trocar o filtro de status da lista
- `npm run type-check` e `npm run lint` sem erros

**Commit:** `feat(requests): replace global cards with current-month stats and growth indicator`

---

### STEP 3 — Mover documento para TASK_COMPLETED

**Ações:**
1. Mover `ONLY_FOR_DEVS/TO_DO/FEAT-cards-procedimentos-por-mes.md` → `ONLY_FOR_DEVS/TASK_COMPLETED/`
2. Atualizar campo `**Status:**` para `Concluído`

**Commit:** `docs(tasks): move FEAT-cards-procedimentos-por-mes to TASK_COMPLETED`

---

## 7. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] Cards exibem dados do mês atual (não histórico global)
[ ] Card "Mês" mostra crescimento % e absoluto vs mês anterior
[ ] crescimentoPercent === null (mês anterior sem dados) → "Primeiro mês com dados"
[ ] Cards não mudam ao alternar filtro de status na lista
[ ] Grid tem 3 colunas (não 4)
[ ] Card "Efetuadas" removido
[ ] PR aberto para branch pessoal com test plan preenchido
```

---

## 8. Referências

- `src/lib/services/dashboardService.ts` — função `getDashboardProcedimentosStats` (base para reutilização)
- `src/app/(clinic)/clinic/requests/page.tsx` — página alvo
- `src/app/(clinic)/clinic/dashboard/page.tsx` — exemplo de uso de `DashboardProcedimentosStats` e `CrescimentoBadge`
