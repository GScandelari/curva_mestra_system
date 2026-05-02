# Feature: Reformulação das Regras de Negócio de Procedimentos

**Projeto:** Curva Mestra
**Data:** 02/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Tipo:** Feature
**Branch sugerida:** `feature/reformulacao-regras-procedimentos`
**Prioridade:** Alta
**Versão:** 1.0

> Reformulação em dois eixos do módulo de Procedimentos: (1) criação de dois modos de registro — **Procedimento Programado** (data futura, reserva de estoque, fluxo atual) e **Procedimento Efetuado** (data passada ou presente, consumo imediato sem reserva); (2) remoção da etapa de aprovação (`aprovada`/`reprovada`), simplificando o fluxo para `agendada` → `concluida` | `cancelada` e `efetuada` → `concluida` | `cancelada`. O impacto atinge o serviço central, os tipos TypeScript, três páginas da clínica, a página do consultor, o dashboard e os testes existentes.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/reformulacao-regras-procedimentos`
**PR target:** branch pessoal (`gscandelari_setup` ou `lhuan_setup`) → `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/reformulacao-regras-procedimentos
```

| Step   | Tipo    | Escopo     | Mensagem sugerida                                                                              |
|--------|---------|------------|-----------------------------------------------------------------------------------------------|
| STEP 1 | `feat`  | `types`    | `feat(types): add efetuada status and TipoProcedimento union to Solicitacao`                  |
| STEP 2 | `feat`  | `requests` | `feat(requests): add createSolicitacaoEfetuada and remove approval flow from updateStatus`    |
| STEP 3 | `feat`  | `requests` | `feat(requests): add tipo selector to new procedure page and split creation logic`            |
| STEP 4 | `feat`  | `requests` | `feat(requests): remove aprovada/reprovada actions from procedure detail page`                |
| STEP 5 | `feat`  | `requests` | `feat(requests): update list page — remove aprovada card, add efetuada card`                  |
| STEP 6 | `feat`  | `requests` | `feat(requests): update consultant procedures page to remove aprovada/reprovada`              |
| STEP 7 | `feat`  | `dashboard` | `feat(dashboard): update getDashboardProcedimentosStats to include efetuada status`          |
| STEP 8 | `test`  | `requests` | `test(requests): update solicitacaoService tests for new status flow`                         |
| STEP 9 | `docs`  | `tasks`    | `docs(tasks): move FEAT-reformulacao-regras-procedimentos to TASK_COMPLETED`                  |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

O módulo de Procedimentos possui um único modo de criação: a clínica informa uma data (validada como ≥ hoje em `new/page.tsx`, linha 189), produtos são reservados no inventário (`quantidade_reservada += N`, `quantidade_disponivel -= N`) e a solicitação é criada com status `agendada`.

O fluxo de status atual — definido em `src/lib/services/solicitacaoService.ts` na função `updateSolicitacaoStatus` — é:

```
agendada → aprovada | reprovada | cancelada
aprovada → concluida | cancelada
```

Há dois status finais alternativos (`reprovada`, `cancelada`) e um intermediário obrigatório (`aprovada`) antes de `concluida`. O consumo efetivo do estoque ocorre apenas na transição `aprovada → concluida` (a reserva é liquidada: `quantidade_reservada -= N`, sem alterar `quantidade_disponivel`).

No `src/types/index.ts`, o tipo `SolicitacaoStatus` é:
```ts
export type SolicitacaoStatus =
  | 'criada'
  | 'agendada'
  | 'concluida'
  | 'aprovada'
  | 'reprovada'
  | 'cancelada';
```

A interface `Solicitacao` não possui campo `tipo` — não existe distinção entre procedimentos programados e efetuados.

A validação de data em `new/page.tsx` (função `validateStep1`, linhas 176–199) impede datas no passado, exceto em modo de edição de solicitação criada no mesmo dia.

As notificações `createRequestApprovedNotification` e `createRequestRejectedNotification` em `src/lib/services/notificationService.ts` são disparadas exclusivamente na transição para `aprovada` e `reprovada`.

A página do consultor em `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` exibe o card "Aprovadas" e oferece filtro por `aprovada` e `reprovada` no dropdown.

O dashboard (`src/lib/services/dashboardService.ts`, função `getDashboardProcedimentosStats`) conta como `agendados` procedimentos com `status === 'agendada' || status === 'aprovada'`.

Os testes em `src/__tests__/solicitacaoService.test.ts` testam `determineInitialStatus` (sempre retorna `'agendada'`) e o contrato de `CreateSolicitacaoInput`.

### 1.2 Problema identificado

1. **Registro retroativo impossível:** clínicas que atendem pacientes e fazem o registro no final do dia ou no dia seguinte não conseguem registrar um procedimento com data no passado. A validação em `validateStep1` bloqueia qualquer data anterior a hoje.

2. **Fluxo de aprovação desnecessário:** o intermediário `aprovada` foi concebido para um modelo onde outra pessoa aprovava o procedimento. Na prática real das clínicas, quem cria o procedimento é o próprio admin, tornando a aprovação uma etapa burocrática sem valor. O botão "Reprovar" causa confusão e não reflete o fluxo de trabalho real.

### 1.3 Motivação estratégica

Clientes reais do Curva Mestra precisam de flexibilidade para registrar procedimentos que já ocorreram. O modelo atual força um registro antecipado (agendamento) mesmo quando o procedimento já foi realizado. A remoção da aprovação elimina fricção sem perda de rastreabilidade — o histórico de status ainda preserva quem criou, quando e o que foi feito.

---

## 2. Objetivos

1. Adicionar modo **Procedimento Efetuado**: data no passado ou presente, consumo imediato (sem reserva), status inicial `efetuada`.
2. Manter modo **Procedimento Programado** (comportamento atual): data futura, reserva de estoque, status inicial `agendada`.
3. Remover os status `aprovada` e `reprovada` do fluxo de transição.
4. Simplificar as ações na página de detalhe para: **Editar** | **Concluir** | **Cancelar**.
5. Atualizar tipos TypeScript, serviço, páginas, dashboard e testes para refletir o novo modelo.
6. Remover notificações de `aprovada`/`reprovada` (sem substituto imediato).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descrição                                                                                                                         | Ator          | Prioridade |
|-------|-----------------------------------------------------------------------------------------------------------------------------------|---------------|------------|
| RF-01 | Na página de criação, exibir seletor de tipo: "Procedimento Programado" ou "Procedimento Efetuado"                                | clinic_admin  | Must       |
| RF-02 | Para "Programado": aceitar apenas datas ≥ hoje; reservar estoque; status inicial `agendada`                                       | clinic_admin  | Must       |
| RF-03 | Para "Efetuado": aceitar datas ≤ hoje (passado ou presente); consumir estoque imediatamente; status inicial `efetuada`            | clinic_admin  | Must       |
| RF-04 | Para "Efetuado": a seleção de produto/lote/quantidade deve permitir informar exatamente o que foi utilizado (funcionalidade já existente de FEFO, mantida) | clinic_admin | Must |
| RF-05 | Na página de detalhe, exibir apenas: Editar (se `agendada`), Concluir, Cancelar — remover Aprovar e Reprovar                     | clinic_admin  | Must       |
| RF-06 | Procedimento `agendada` pode ser editado (fluxo de edição atual mantido) ou concluído ou cancelado                                | clinic_admin  | Must       |
| RF-07 | Procedimento `efetuada` pode ser concluído ou cancelado (edição não disponível neste status)                                      | clinic_admin  | Must       |
| RF-08 | Na transição `agendada → cancelada`: liberar reserva e devolver ao disponível (comportamento atual mantido)                       | system        | Must       |
| RF-09 | Na transição `agendada → concluida`: liquidar reserva (consumo efetivo) — sem alterar `quantidade_disponivel`                     | system        | Must       |
| RF-10 | Na transição `efetuada → cancelada`: devolver estoque ao disponível (reverter consumo imediato)                                   | system        | Must       |
| RF-11 | Na transição `efetuada → concluida`: nenhuma alteração de estoque (já consumido na criação)                                       | system        | Must       |
| RF-12 | A página de listagem deve remover o card "Aprovadas" e adicionar card "Efetuadas"                                                 | clinic_admin  | Must       |
| RF-13 | O filtro de status na listagem deve remover `aprovada`/`reprovada` e adicionar `efetuada`                                         | clinic_admin  | Must       |
| RF-14 | A página do consultor deve refletir os mesmos ajustes de labels e filtros                                                         | clinic_consultant | Must   |
| RF-15 | O campo `tipo` da solicitação deve ser salvo no Firestore para auditoria futura                                                   | system        | Must       |

### 3.2 Requisitos Não Funcionais (RNF)

| ID     | Descrição                                                                                                                        | Categoria        |
|--------|----------------------------------------------------------------------------------------------------------------------------------|------------------|
| RNF-01 | Toda criação de `Solicitacao` no Firestore deve manter filtro por `tenant_id` (multi-tenant obrigatório)                         | Segurança        |
| RNF-02 | A lógica de criação de "Efetuado" deve usar `runTransaction` para garantir atomicidade do consumo de estoque                     | Confiabilidade   |
| RNF-03 | Dados existentes com `status === 'aprovada'` ou `status === 'reprovada'` devem continuar exibíveis na interface (compatibilidade) | Manutenibilidade |
| RNF-04 | Nenhuma migração de dados retroativa é necessária — dados legados são preservados como estão                                     | Manutenibilidade |
| RNF-05 | O build de produção não deve gerar erros TypeScript relacionados aos status removidos                                             | Qualidade        |

### 3.3 Regras de Negócio (RN)

| ID    | Regra                                                                                                                             | Justificativa                                          |
|-------|-----------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|
| RN-01 | "Procedimento Programado" exige `dt_procedimento >= hoje`                                                                        | Não faz sentido agendar algo no passado                |
| RN-02 | "Procedimento Efetuado" exige `dt_procedimento <= hoje`                                                                          | Registro retroativo de algo que já ocorreu             |
| RN-03 | "Efetuado" consume estoque imediatamente na criação (mesmo mecanismo de CRIAÇÃO atual, mas sem reserva — debita diretamente de `quantidade_disponivel`) | O produto já foi usado; não há reserva a fazer  |
| RN-04 | "Efetuado" não pode ser editado após criação (status `efetuada` não permite edição)                                               | O consumo já ocorreu; alteração exigiria estorno complexo |
| RN-05 | Cancelar um "Efetuado" devolve as quantidades a `quantidade_disponivel` (estorno do consumo)                                     | Consistência de estoque                                |
| RN-06 | Cancelar um "Programado" (`agendada`) libera `quantidade_reservada` e devolve a `quantidade_disponivel` (comportamento atual mantido) | Consistência de estoque                         |
| RN-07 | Concluir um "Programado" (`agendada → concluida`) diminui apenas `quantidade_reservada` — `quantidade_disponivel` já foi debitado na criação | Modelo de reserva atual mantido              |
| RN-08 | Concluir um "Efetuado" (`efetuada → concluida`) não altera estoque                                                               | Consumo já foi realizado na criação                    |
| RN-09 | Dados legados com `status === 'aprovada'` devem ser exibidos sem erro, usando label "Aprovada (legado)" ou simplesmente "Aprovada" | Compatibilidade com histórico                          |
| RN-10 | As notificações de `aprovada` e `reprovada` são removidas sem substituto imediato                                                 | Fluxo simplificado elimina esses eventos               |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Adicionar o campo `tipo: 'programado' | 'efetuado'` à interface `Solicitacao` e criar uma nova função `createSolicitacaoEfetuada` no serviço, paralela à `createSolicitacaoWithConsumption` existente. A função existente é mantida intacta (sem renomeação) para preservar compatibilidade com todos os pontos de chamada atuais.

O campo `tipo` é salvo no Firestore para rastreabilidade. Em dados legados sem o campo, a UI assume `tipo: 'programado'` por padrão.

Para o consumo imediato no modo "Efetuado": debitamos diretamente de `quantidade_disponivel` (sem passar por `quantidade_reservada`), pois não há reserva intermediária — o produto já foi utilizado.

### 4.2 Alternativas descartadas

- **Reutilizar `createSolicitacaoWithConsumption` com flag boolean:** descartado porque tornaria a função com lógica condicional extensa, dificultando a leitura e o teste isolado de cada modo.
- **Migração de dados retroativa (alterar `aprovada` → `concluida` em documentos antigos):** descartado por risco e custo operacional. Dados legados são preservados.
- **Manter `aprovada` como status mas ocultar o botão na UI:** descartado porque deixaria inconsistência entre tipos TypeScript e fluxo de negócio real.

### 4.3 Trade-offs aceitos

- Dados com `status === 'aprovada'` ou `status === 'reprovada'` continuarão existindo no Firestore indefinidamente. A UI exibirá esses status com seus labels originais sem quebrar. Futuramente, pode-se criar um script de migração.
- O modo "Efetuado" não permite edição. Isso simplifica a lógica de estorno, ao custo de forçar o usuário a cancelar e recriar se errou os dados.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| N/A | — | Nenhum arquivo novo necessário |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/types/index.ts` | Adicionar `'efetuada'` ao union `SolicitacaoStatus`; adicionar campo `tipo?: 'programado' \| 'efetuado'` à interface `Solicitacao` |
| `src/lib/services/solicitacaoService.ts` | Adicionar função `createSolicitacaoEfetuada`; atualizar `updateSolicitacaoStatus` removendo transições de/para `aprovada` e `reprovada`; atualizar `determineInitialStatus`; remover chamadas às notificações de aprovação/reprovação; atualizar `getUpcomingProcedures` para incluir `efetuada` |
| `src/app/(clinic)/clinic/requests/new/page.tsx` | Adicionar seletor de tipo no formulário; bifurcar lógica de criação para chamar `createSolicitacaoEfetuada` quando tipo = "Efetuado"; remover validação que impede datas no passado no modo "Efetuado" |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx` | Remover botões "Aprovar" e "Reprovar"; simplificar `handleStatusUpdate` para aceitar apenas `'concluida'` e `'cancelada'`; adicionar botão "Concluir" para status `agendada`; atualizar alertas de status na base da página |
| `src/app/(clinic)/clinic/requests/page.tsx` | Substituir card "Aprovadas" por card "Efetuadas"; remover `aprovada` e `reprovada` do dropdown de filtro; adicionar `efetuada` |
| `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` | Substituir card "Aprovadas" por "Efetuadas"; ajustar filtro de status; ajustar `getStatusBadge` |
| `src/lib/services/dashboardService.ts` | Em `getDashboardProcedimentosStats`: incluir `efetuada` na contagem de `agendados`; remover dependência de `aprovada` na contagem |
| `src/__tests__/solicitacaoService.test.ts` | Atualizar testes de `determineInitialStatus`; adicionar testes para `createSolicitacaoEfetuada` (lógica pura de consumo imediato) |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---------|--------|
| N/A | — |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants/{tenantId}/solicitacoes` | Novos documentos escritos com campo `tipo: 'programado' \| 'efetuado'` | Documentos existentes sem `tipo` continuam funcionando |
| `tenants/{tenantId}/inventory` | Lógica de escrita alterada para modo "Efetuado": debita `quantidade_disponivel` diretamente, sem alterar `quantidade_reservada` | Transação atômica mantida |
| `tenants/{tenantId}/inventory_activity` | Novos registros para "Efetuado" terão `tipo: 'consumo_imediato'` em vez de `'reserva'` | Distingue auditoria de reservas vs. consumos diretos |

### 5.5 O que NÃO muda

- `firestore.rules` — as regras de acesso por tenant não mudam; nenhuma regra é específica por status
- `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx` — redireciona para `new` com parâmetros; continua funcional para `agendada`
- `src/lib/services/inventoryService.ts` — sem alteração
- `src/lib/services/reportService.ts` — sem alteração
- Todo o módulo de autenticação, licenças, usuários e consultores — sem impacto
- O campo `status_history` e a lógica de auditoria de histórico — mantidos e expandidos

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**`src/types/index.ts` — SolicitacaoStatus (antes)**
```ts
export type SolicitacaoStatus =
  | 'criada'
  | 'agendada'
  | 'concluida'
  | 'aprovada'
  | 'reprovada'
  | 'cancelada';
```

**`src/types/index.ts` — SolicitacaoStatus (depois)**
```ts
export type SolicitacaoStatus =
  | 'criada'
  | 'agendada'
  | 'efetuada'
  | 'concluida'
  | 'aprovada'    // mantido para compatibilidade com dados legados
  | 'reprovada'   // mantido para compatibilidade com dados legados
  | 'cancelada';
```

**`src/types/index.ts` — interface Solicitacao (campo adicionado)**
```ts
export interface Solicitacao {
  // ... campos existentes ...
  tipo?: 'programado' | 'efetuado'; // NOVO — undefined em dados legados (assume 'programado')
}
```

### 6.2 Mudanças em serviços

#### `determineInitialStatus` — nova assinatura

```ts
// ANTES
export function determineInitialStatus(_dtProcedimento: Date): SolicitacaoStatus {
  return 'agendada';
}

// DEPOIS
export function determineInitialStatus(
  dtProcedimento: Date,
  tipo: 'programado' | 'efetuado'
): SolicitacaoStatus {
  if (tipo === 'efetuado') return 'efetuada';
  return 'agendada';
}
```

#### `createSolicitacaoEfetuada` — nova função

Mesma estrutura de `createSolicitacaoWithConsumption`, com as seguintes diferenças:

- Aceita `dt_procedimento` no passado ou presente (sem restrição de data futura)
- Status inicial: `'efetuada'`
- Movimentação de estoque: **consumo imediato** — decrementa apenas `quantidade_disponivel`, não toca `quantidade_reservada`
- Registro em `inventory_activity` com `tipo: 'consumo_imediato'` (não `'reserva'`)
- Campo `tipo: 'efetuado'` salvo no documento da solicitação

```ts
export interface CreateSolicitacaoEfetuadaInput {
  descricao?: string;
  dt_procedimento: Date; // deve ser <= hoje (validado na UI, não no service)
  produtos: {
    inventory_item_id: string;
    quantidade: number;
  }[];
  observacoes?: string;
}

export async function createSolicitacaoEfetuada(
  tenantId: string,
  userId: string,
  userName: string,
  input: CreateSolicitacaoEfetuadaInput
): Promise<{
  success: boolean;
  solicitacaoId?: string;
  error?: string;
  validationErrors?: string[];
}>
```

**Lógica de estoque para "Efetuado":**
```
quantidade_disponivel -= quantidade  (consumo direto)
quantidade_reservada   — não altera
```

#### `updateSolicitacaoStatus` — remoção das transições de aprovação

Remover as validações:
- `agendada → aprovada` (via `updateSolicitacaoStatus`) — não existe mais
- `agendada → reprovada` — não existe mais
- `aprovada → concluida` — não existe mais
- `aprovada → cancelada` — não existe mais

Adicionar as novas transições válidas:
```
agendada → concluida | cancelada
efetuada → concluida | cancelada
```

**Novo bloco de validação de transição:**
```ts
const VALID_TRANSITIONS: Record<SolicitacaoStatus, SolicitacaoStatus[]> = {
  criada:   ['agendada', 'cancelada'],
  agendada: ['concluida', 'cancelada'],
  efetuada: ['concluida', 'cancelada'],
  concluida: [],
  cancelada: [],
  // Legados — nenhuma transição permitida pela UI nova
  aprovada:  ['concluida', 'cancelada'], // compatibilidade com dados antigos
  reprovada: [],
};
```

**Lógica de estoque para `efetuada → cancelada`:**
```
// Estorno do consumo imediato
quantidade_disponivel += quantidade
// quantidade_reservada não altera
```

**Lógica de estoque para `efetuada → concluida`:**
```
// Nenhuma alteração de estoque — consumo já foi feito na criação
```

**Lógica de estoque para `agendada → concluida`:**
```
// Mantida como está: liquidar reserva
quantidade_reservada -= quantidade
// quantidade_disponivel não altera (já descontado na criação)
```

**Lógica de estoque para `agendada → cancelada`:**
```
// Mantida como está: liberar reserva
quantidade_reservada -= quantidade
quantidade_disponivel += quantidade
```

Remover as chamadas a `createRequestApprovedNotification` e `createRequestRejectedNotification`.

#### `getUpcomingProcedures` — incluir `efetuada`

```ts
// ANTES
where('status', 'in', ['criada', 'agendada', 'aprovada'])

// DEPOIS
where('status', 'in', ['criada', 'agendada', 'efetuada'])
```

### 6.3 Mudanças na UI

#### `new/page.tsx` — seletor de tipo e bifurcação de lógica

**Estado novo:**
```ts
const [tipoProcedimento, setTipoProcedimento] = useState<'programado' | 'efetuado'>('programado');
```

**Seletor de tipo** (novo componente acima do formulário):
- Dois botões tipo "toggle" ou RadioGroup: "Programado" | "Efetuado"
- "Programado" = data futura, reserva de estoque
- "Efetuado" = data passada ou presente, consumo imediato

**`validateStep1` — ajuste de validação de data:**
- Se `tipoProcedimento === 'programado'`: manter validação `dtProcedimento >= hoje`
- Se `tipoProcedimento === 'efetuado'`: validar apenas `dtProcedimento <= hoje` (negar futuro)

**`submitCreateMode` — bifurcação:**
```ts
if (tipoProcedimento === 'efetuado') {
  // chamar createSolicitacaoEfetuada
} else {
  // chamar createSolicitacaoWithConsumption (comportamento atual)
}
```

**Texto do alerta na etapa de revisão** — diferente por tipo:
- Programado: "Os produtos serão RESERVADOS..."
- Efetuado: "Os produtos serão CONSUMIDOS IMEDIATAMENTE..."

**Texto do botão de confirmação:**
- Programado: "Confirmar e Reservar Produtos" (atual)
- Efetuado: "Confirmar e Registrar Consumo" (novo)

**Nota sobre modo edição:** a edição via `?edit=` ainda só funciona para `agendada`. No modo "Efetuado" não há edição; este path não muda.

#### `[id]/page.tsx` — simplificação das ações

**Estado atual — botões para `agendada`:** Editar | Aprovar | Reprovar | Cancelar

**Novo estado — botões para `agendada`:** Editar | Concluir | Cancelar

**Novo estado — botões para `efetuada`:** Concluir | Cancelar

**`handleStatusUpdate`** — alterar tipo de parâmetro:
```ts
// ANTES
const handleStatusUpdate = async (
  newStatus: 'aprovada' | 'reprovada' | 'cancelada' | 'concluida',
  observacao?: string
)

// DEPOIS
const handleStatusUpdate = async (
  newStatus: 'concluida' | 'cancelada',
  observacao?: string
)
```

**Alertas na base da página:**
- Remover blocos para `aprovada` e `reprovada`
- Adicionar bloco para `efetuada`: "Consumo Imediato — Os produtos foram consumidos no momento do registro."
- Manter blocos para `agendada`, `concluida`, `cancelada`

**Labels e badges:** adicionar `efetuada: 'Efetuada'` nos objetos `labels` e `variants`. Manter `aprovada` e `reprovada` nos objetos (com label "Aprovada" e "Reprovada") para exibir dados legados sem erro.

#### `page.tsx` (listagem) — ajuste de cards e filtros

**Cards de estatísticas:**
- Substituir card "Aprovadas" por card "Efetuadas" (contador `s.status === 'efetuada'`)

**Dropdown de filtro:**
- Remover `<SelectItem value="aprovada">` e `<SelectItem value="reprovada">`
- Adicionar `<SelectItem value="efetuada">Efetuada</SelectItem>`

#### `consultant/.../procedures/page.tsx` — mesmo ajuste de UI

- Card "Aprovadas" → "Efetuadas"
- Filtro: remover `aprovada`/`reprovada`, adicionar `efetuada`
- `getStatusBadge`: adicionar `efetuada: 'secondary'` em `variants` e `'Efetuada'` em `labels`

### 6.4 Mudanças em API Routes

N/A — não há API routes específicas para solicitações. Toda lógica opera via SDK do Firestore client-side.

---

## 7. Plano de Implementação

### STEP 1 — Atualizar tipos TypeScript

**Objetivo:** Adicionar `'efetuada'` ao union de status e o campo `tipo` à interface `Solicitacao`, sem quebrar nenhum tipo existente.

**Arquivos afetados:**
- `src/types/index.ts` — modificar `SolicitacaoStatus` e `Solicitacao`

**Ações:**
1. Adicionar `'efetuada'` ao union `SolicitacaoStatus` (manter `'aprovada'` e `'reprovada'` para compatibilidade)
2. Adicionar campo `tipo?: 'programado' | 'efetuado'` à interface `Solicitacao`

**Validação:** `npm run type-check` sem erros. Nenhum arquivo importador deve quebrar (o campo é opcional).

**Commit:** `feat(types): add efetuada status and tipo field to Solicitacao`

---

### STEP 2 — Atualizar serviço de solicitações

**Objetivo:** Adicionar `createSolicitacaoEfetuada`, atualizar `determineInitialStatus`, simplificar `updateSolicitacaoStatus`, atualizar `getUpcomingProcedures`.

**Arquivos afetados:**
- `src/lib/services/solicitacaoService.ts` — múltiplas funções

**Ações:**
1. Atualizar `determineInitialStatus` para receber `tipo` e retornar `'efetuada'` quando aplicável
2. Criar função `createSolicitacaoEfetuada` com a nova lógica de consumo imediato (baseada na estrutura de `createSolicitacaoWithConsumption`, mas sem reserva)
3. Exportar `CreateSolicitacaoEfetuadaInput`
4. Em `updateSolicitacaoStatus`:
   - Substituir o mapa de transições válidas pelo novo (ver seção 6.2)
   - Adicionar case `efetuada → cancelada`: estornar `quantidade_disponivel`
   - Adicionar case `efetuada → concluida`: sem ação de estoque
   - Adicionar case `agendada → concluida`: mantida igual ao atual `aprovada → concluida`
   - Remover cases `agendada → aprovada`, `agendada → reprovada`, `aprovada → concluida`, `aprovada → cancelada`
   - Remover chamadas a `createRequestApprovedNotification` e `createRequestRejectedNotification`
5. Em `getUpcomingProcedures`: substituir `'aprovada'` por `'efetuada'` no filtro de status

**Validação:** `npm run type-check` e `npm run lint` sem erros. Testes existentes ainda passam (serão atualizados no STEP 8).

**Commit:** `feat(requests): add createSolicitacaoEfetuada and simplify status flow`

---

### STEP 3 — Atualizar página de criação (`new/page.tsx`)

**Objetivo:** Adicionar seletor de tipo e bifurcar lógica de criação e validação de data.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/new/page.tsx`

**Ações:**
1. Adicionar estado `tipoProcedimento: 'programado' | 'efetuado'` (default `'programado'`)
2. Adicionar controle UI de seleção de tipo (RadioGroup ou dois botões toggle com shadcn `ToggleGroup` ou botões simples com `variant="outline"`)
3. Ajustar `validateStep1`:
   - Programado: `dtProcedimento >= hoje` (comportamento atual)
   - Efetuado: `dtProcedimento <= hoje` (novo)
4. Ajustar `submitCreateMode` para chamar `createSolicitacaoEfetuada` quando `tipoProcedimento === 'efetuado'`
5. Ajustar textos do alerta de revisão e do botão de confirmação conforme tipo
6. Incluir `tipo: tipoProcedimento` no payload enviado ao service

**Validação:** Testar manualmente nos dois modos — programado e efetuado. Validar que data passada é aceita no modo efetuado e rejeitada no modo programado, e vice-versa.

**Commit:** `feat(requests): add procedure type selector and split creation logic`

---

### STEP 4 — Atualizar página de detalhe (`[id]/page.tsx`)

**Objetivo:** Remover botões de aprovação/reprovação; adicionar botão "Concluir" para `agendada`; ajustar alertas e labels.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/[id]/page.tsx`

**Ações:**
1. Atualizar tipo do parâmetro `newStatus` em `handleStatusUpdate` para `'concluida' | 'cancelada'`
2. Remover botões "Aprovar" e "Reprovar" do bloco `agendada`
3. Adicionar botão "Concluir Procedimento" no bloco `agendada`
4. Criar bloco de ações para `efetuada`: botões "Concluir" e "Cancelar"
5. Nos objetos `labels` e `variants` do `getStatusBadge`: adicionar `efetuada`; manter `aprovada` e `reprovada` para dados legados
6. Atualizar a mensagem de toast em `handleStatusUpdate` para cobrir apenas os novos status
7. Ajustar alertas informativos na base da página (remover `aprovada` e `reprovada`; adicionar `efetuada`)

**Validação:** Abrir um procedimento `agendada` e verificar que apenas Editar, Concluir e Cancelar aparecem. Criar um procedimento "Efetuado" e verificar que Concluir e Cancelar aparecem. Verificar que dados legados com `aprovada` não causam erro de renderização.

**Commit:** `feat(requests): remove approval actions and add concluir to agendada`

---

### STEP 5 — Atualizar página de listagem (`requests/page.tsx`)

**Objetivo:** Substituir card "Aprovadas" por "Efetuadas" e ajustar filtros de status.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/page.tsx`

**Ações:**
1. Substituir o card "Aprovadas" por card "Efetuadas" (`s.status === 'efetuada'`)
2. No `getStatusBadge`: adicionar `efetuada`; manter `aprovada` e `reprovada`
3. No `SelectContent` do filtro: remover itens `aprovada` e `reprovada`; adicionar item `efetuada`

**Validação:** Abrir a listagem e verificar os 4 cards (Total, Agendadas, Efetuadas, Concluídas). Testar filtro por cada status.

**Commit:** `feat(requests): replace aprovada card with efetuada in list page`

---

### STEP 6 — Atualizar página do consultor

**Objetivo:** Refletir os mesmos ajustes de labels e filtros na visão read-only do consultor.

**Arquivos afetados:**
- `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx`

**Ações:**
1. Card "Aprovadas" → "Efetuadas" (`s.status === 'efetuada'`)
2. `getStatusBadge`: adicionar `efetuada: 'secondary'` e label `'Efetuada'`; manter `aprovada` e `reprovada`
3. Filtro de status: remover `aprovada` e `reprovada`; adicionar `efetuada`

**Validação:** Acessar visão do consultor e verificar que cards e filtros estão corretos.

**Commit:** `feat(requests): update consultant procedures page status labels and filters`

---

### STEP 7 — Atualizar dashboard service

**Objetivo:** Incluir status `efetuada` na contagem correta de procedimentos do mês no dashboard.

**Arquivos afetados:**
- `src/lib/services/dashboardService.ts`

**Ações:**
1. Em `getDashboardProcedimentosStats`, no bloco de contagem por status (`snapAtual.forEach`):
   - Alterar linha `if (status === 'agendada' || status === 'aprovada') agendados++;`
   - Para: `if (status === 'agendada' || status === 'efetuada') agendados++;`

**Validação:** O dashboard da clínica deve exibir os procedimentos efetuados no bloco "Agendados" (ou o nome do bloco pode ser revisado para "Em aberto" futuramente — ⚠️ Decisão necessária, ver seção abaixo).

**Commit:** `feat(dashboard): include efetuada in procedimentos stats count`

---

### STEP 8 — Atualizar testes

**Objetivo:** Atualizar os testes existentes para a nova assinatura de `determineInitialStatus` e adicionar cenários para o novo fluxo.

**Arquivos afetados:**
- `src/__tests__/solicitacaoService.test.ts`

**Ações:**
1. Atualizar os 3 testes existentes de `determineInitialStatus` para passar o segundo parâmetro `tipo`:
   - `determineInitialStatus(futureDate, 'programado')` → `'agendada'`
   - `determineInitialStatus(new Date(), 'programado')` → `'agendada'`
   - `determineInitialStatus(pastDate, 'programado')` → `'agendada'`
2. Adicionar novos testes:
   - `determineInitialStatus(pastDate, 'efetuado')` → `'efetuada'`
   - `determineInitialStatus(new Date(), 'efetuado')` → `'efetuada'`
   - Verificar que `CreateSolicitacaoEfetuadaInput` não aceita campos de paciente (mesmo padrão de teste existente)
3. Atualizar o teste de contrato de `CreateSolicitacaoInput` se necessário

**Validação:** `npm run test` — todos os testes passando.

**Commit:** `test(requests): update determineInitialStatus tests and add efetuada scenarios`

---

### STEP 9 — Mover documento para TASK_COMPLETED

**Objetivo:** Registrar conclusão da task no sistema de documentação.

**Arquivos afetados:**
- `ONLY_FOR_DEVS/TO_DO/FEAT-reformulacao-regras-procedimentos.md` → mover para `ONLY_FOR_DEVS/TASK_COMPLETED/`

**Ações:**
1. Mover o arquivo para `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-reformulacao-regras-procedimentos.md`
2. Atualizar o campo `**Status:**` do documento para `Concluído`

**Commit:** `docs(tasks): move FEAT-reformulacao-regras-procedimentos to TASK_COMPLETED`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| `determineInitialStatus` | `src/__tests__/solicitacaoService.test.ts` | tipo `'programado'` retorna `'agendada'`; tipo `'efetuado'` retorna `'efetuada'`; data passada com `'programado'` ainda retorna `'agendada'` |
| `CreateSolicitacaoEfetuadaInput` (contrato de tipo) | `src/__tests__/solicitacaoService.test.ts` | Aceita `dt_procedimento` no passado; não aceita campos de paciente |

Regras aplicadas:
- `createSolicitacaoEfetuada` e `updateSolicitacaoStatus` envolvem Firestore — **não testar** (integração, fora do MVP)
- Componentes React e páginas — **não testar**
- Lógica pura (`determineInitialStatus`) — **sempre testar**

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando (incluindo novos)
[ ] Multi-tenant: createSolicitacaoEfetuada filtra por tenant_id em todas as operações Firestore
[ ] Segurança: nenhum secret ou credencial no código
[ ] Dados legados: procedimentos com status 'aprovada' e 'reprovada' renderizam sem erro
[ ] Modo "Programado": data passada é rejeitada na UI
[ ] Modo "Efetuado": data futura é rejeitada na UI
[ ] Modo "Efetuado": estoque é debitado de quantidade_disponivel (não quantidade_reservada)
[ ] Cancelar "Efetuado": estoque é devolvido a quantidade_disponivel
[ ] Concluir "Agendado": apenas quantidade_reservada é decrementada
[ ] Branch pessoal: task branch mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Dados legados com `status === 'aprovada'` causarem erro TypeScript ou de runtime | Baixa | Médio | Manter `'aprovada'` e `'reprovada'` no union type e nos objetos de label/variant da UI |
| `updateSolicitacaoStatus` chamado com `newStatus === 'aprovada'` por código não atualizado | Baixa | Alto | A validação de transição no service rejeita explicitamente a transição; erros são capturados e logados |
| Confusão de UX ao exibir "Efetuada" sem explicação clara para o usuário | Média | Médio | Adicionar tooltip ou texto auxiliar ao seletor de tipo na página de criação |
| Transação Firestore de `createSolicitacaoEfetuada` falhar em alta concorrência (dois procedimentos consumindo o mesmo lote) | Baixa | Alto | `runTransaction` garante atomicidade — se estoque insuficiente, transação aborta e retorna erro amigável |
| `getDashboardProcedimentosStats` não refletir dados de `efetuada` imediatamente após o deploy (cache de query) | Baixa | Baixo | Firestore não tem cache de query no client — a mudança é imediata no deploy |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Procedimento Programado | Procedimento a ser realizado em data futura; gera reserva de estoque |
| Procedimento Efetuado | Procedimento já realizado; data passada ou presente; gera consumo imediato de estoque |
| Reserva de estoque | Quantidade movida de `quantidade_disponivel` para `quantidade_reservada` sem ser consumida |
| Consumo imediato | Decremento direto de `quantidade_disponivel` sem passar por `quantidade_reservada` |
| Status legado | Status (`aprovada`, `reprovada`) que existia no sistema anterior e ainda pode aparecer em documentos Firestore antigos |
| FEFO | First Expired, First Out — política de alocação que prioriza lotes com validade mais próxima |
| `inventory_activity` | Coleção Firestore que registra toda movimentação de estoque para auditoria |

---

## 12. Referências

- `src/lib/services/solicitacaoService.ts` — serviço central com toda a lógica atual
- `src/types/index.ts` — tipos e interfaces do sistema
- `src/app/(clinic)/clinic/requests/new/page.tsx` — formulário de criação
- `src/app/(clinic)/clinic/requests/[id]/page.tsx` — página de detalhe com ações
- `src/app/(clinic)/clinic/requests/page.tsx` — listagem de procedimentos
- `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` — visão do consultor
- `src/lib/services/dashboardService.ts` — estatísticas do dashboard
- `src/__tests__/solicitacaoService.test.ts` — testes existentes
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow e commits

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 02/05/2026 | Doc Writer (Claude) | Versão inicial |