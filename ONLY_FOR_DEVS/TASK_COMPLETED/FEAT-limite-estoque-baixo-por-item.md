# Feature: Limite de Estoque Baixo por Item do Inventário

**Projeto:** Curva Mestra
**Data:** 03/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Aguardando execução
**Tipo:** Feature
**Branch sugerida:** `feature/limite-estoque-baixo-por-item`
**Prioridade:** Média
**Versão:** 1.0

> O sistema classifica todos os itens do inventário como "Estoque Baixo" usando limiares hardcoded e inconsistentes (5 unidades em `inventoryUtils.ts`, 10 unidades em `inventoryService.ts` e `InventoryView.tsx`). Esta feature unifica a lógica em um helper centralizado e adiciona o campo `limite_estoque_baixo` por item no inventário, permitindo que o clinic_admin defina individualmente qual quantidade é considerada "Baixo" ou "Normal" para cada produto de sua clínica. O padrão é 10 unidades (≤ 10 = Baixo; ≥ 11 = Normal). Os alertas de notificação passam a usar o limite por item com fallback para o limite global da clínica.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/limite-estoque-baixo-por-item`
**PR target:** branch pessoal → `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/limite-estoque-baixo-por-item
```

| Step   | Tipo    | Escopo      | Mensagem sugerida                                                                                       |
| ------ | ------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| STEP 1 | `feat`  | `inventory` | `feat(inventory): add limite_estoque_baixo field to InventoryItem and getStatusEstoque helper`          |
| STEP 2 | `feat`  | `inventory` | `feat(inventory): add updateInventoryItemLimite service and edit UI in inventory detail page`           |
| STEP 3 | `feat`  | `inventory` | `feat(inventory): apply getStatusEstoque to InventoryView filter and badge display`                     |
| STEP 4 | `feat`  | `alerts`    | `feat(alerts): use per-item limite_estoque_baixo in alertTriggers with fallback to global threshold`    |
| STEP 5 | `test`  | `inventory` | `test(inventory): add unit tests for getStatusEstoque helper`                                           |
| STEP 6 | `docs`  | `tasks`     | `docs(tasks): move FEAT-limite-estoque-baixo-por-item to TASK_COMPLETED`                               |

---

## 1. Estado Atual

### 1.1 Problema central

O status de estoque de um item é calculado de forma hardcoded e inconsistente em quatro locais distintos:

| Arquivo | Linha | Threshold atual | Inconsistência |
| ------- | ----- | --------------- | -------------- |
| `src/lib/services/inventoryService.ts` | 152 | `quantidade < 10` | Usa `<` (exclui o 10) |
| `src/lib/inventoryUtils.ts` | 50 | `quantidade_disponivel <= 5` | Threshold diferente (5) |
| `src/components/inventory/InventoryView.tsx` | 115, 328 | `quantidade_disponivel < 10` | Usa `<` (exclui o 10) |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx` | 132 | `quantity < 10 \|\| percentage < 20` | Usa também percentual |

Resultado: o dashboard mostra contagem de "baixo estoque" diferente do filtro "Estoque Baixo" do inventário, e ambos diferem das notificações geradas pelos alertas.

### 1.2 O que já existe de configuração global

O arquivo `src/types/notification.ts` define `low_stock_threshold: number` (padrão 10) em `NotificationSettings`. Esse valor já é usado em `alertTriggers.ts` para gerar alertas, mas não é lido pelas telas de inventário.

### 1.3 O que não existe

- Campo por item (`limite_estoque_baixo`) no `InventoryItem`
- Helper centralizado de classificação de status
- UI para o clinic_admin editar o limite por item no detalhe do inventário

---

## 2. Modelo de Dados Relevante

### 2.1 InventoryItem (antes)

```ts
// src/lib/services/inventoryService.ts
export interface InventoryItem {
  id: string;
  tenant_id: string;
  produto_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  dt_validade: Date;
  dt_entrada: Date;
  valor_unitario: number;
  nf_numero?: string;
  nf_id?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  category?: string;
  // campos de fragmentação...
}
```

### 2.2 InventoryItem (depois)

```ts
export interface InventoryItem {
  // ... todos os campos existentes sem alteração ...

  // NOVO: limite por item para classificação de estoque
  // undefined → usar padrão 10 (equivale a ≤ 10 = Baixo, ≥ 11 = Normal)
  limite_estoque_baixo?: number;
}
```

### 2.3 InventoryItemLike (depois)

```ts
// src/lib/inventoryUtils.ts
export interface InventoryItemLike {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel: number;
  dt_validade: Date;
  limite_estoque_baixo?: number; // NOVO
}
```

### 2.4 Regra de classificação de status

```
quantidade_disponivel === 0               → "Sem estoque"
quantidade_disponivel <= limite_estoque_baixo  → "Baixo"
quantidade_disponivel >  limite_estoque_baixo  → "Normal"

onde: limite_estoque_baixo = item.limite_estoque_baixo ?? 10
```

**Padrão de 10:** o limite padrão (10) significa que ≤ 10 = "Baixo" e ≥ 11 = "Normal", conforme especificado no produto.

### 2.5 Firestore

| Coleção | Campo novo | Tipo | Padrão quando ausente |
| ------- | ---------- | ---- | --------------------- |
| `/tenants/{tenantId}/inventory/{itemId}` | `limite_estoque_baixo` | `number` | `10` (tratado via `?? 10` no código) |

Itens existentes sem o campo são tratados como `limite_estoque_baixo = 10` — sem migração necessária.

---

## 3. Regras de Negócio

| ID | Regra | Justificativa |
| -- | ----- | ------------- |
| RN-01 | `limite_estoque_baixo` deve ser um inteiro ≥ 0 | Quantidade não pode ser negativa |
| RN-02 | Somente `clinic_admin` pode editar `limite_estoque_baixo` | `clinic_user` tem acesso de leitura; configuração é administrativa |
| RN-03 | Quando `limite_estoque_baixo` é `undefined` no Firestore, o sistema usa 10 como padrão | Compatibilidade retroativa com itens cadastrados antes da feature |
| RN-04 | Em `alertTriggers.ts`, o `limite_estoque_baixo` do item tem prioridade sobre o `low_stock_threshold` global da clínica | Configuração mais granular prevalece sobre a global |
| RN-05 | O campo `limite_estoque_baixo` é editável a qualquer momento; não há restrição de produto em uso | Diferente dos campos de fragmentação; não impacta cálculos de consumo |
| RN-06 | Estoque zero (`quantidade_disponivel === 0`) é sempre "Sem estoque", independente do `limite_estoque_baixo` | Comportamento óbvio e existente; não deve ser sobrescrito pelo limite |

---

## 4. Decisões de Design

### 4.1 Helper centralizado `getStatusEstoque`

Toda a lógica de classificação passa a viver em uma única função pura em `inventoryUtils.ts`. Todos os locais que hoje calculam status de forma independente passam a chamar esse helper.

**Por que em `inventoryUtils.ts` e não em `inventoryService.ts`?**
`inventoryUtils.ts` já é o módulo de utilitários puros de inventário (sem IO/Firebase). Funções puras com testes unitários devem ficar aqui, mantendo `inventoryService.ts` focado em IO com o Firestore.

### 4.2 Edição inline no detalhe do item (não em dialog separado)

A página `/clinic/inventory/[id]` atualmente é somente leitura. Adicionaremos edição **inline** apenas para o campo `limite_estoque_baixo`, com botão de editar/salvar. Não é necessário transformar a página inteira em formulário de edição.

### 4.3 Fallback em alertTriggers

Em vez de substituir `settings.low_stock_threshold` por `item.limite_estoque_baixo`, usamos precedência:
```
item.limite_estoque_baixo ?? settings.low_stock_threshold ?? 10
```
Isso preserva a configuração global como fallback funcional e garante que a alteração seja não-destrutiva.

### 4.4 Alternativas descartadas

| Alternativa | Motivo da rejeição |
| ----------- | ------------------ |
| Migração de dados no Firestore para preencher `limite_estoque_baixo = 10` em itens existentes | Desnecessário; `?? 10` no código garante o mesmo comportamento sem custo de operação em produção |
| Campo no nível do produto master (global para todas as clínicas) | O requisito é por clínica; cada clínica define o que é baixo para seus produtos |
| Campo no nível do tenant (global por clínica, sem granularidade) | Já existe (`low_stock_threshold`); o requisito é granularidade por item |
| Criar nova coleção de configurações por produto/tenant | Complexidade desnecessária; o campo é um atributo simples do item de inventário |

---

## 5. Mapa de Impacto

### 5.1 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
| ------- | ------------------- |
| `src/lib/services/inventoryService.ts` | Adicionar `limite_estoque_baixo?: number` à interface `InventoryItem`; adicionar função `updateInventoryItemLimite()`; atualizar `getInventoryStats()` para usar o campo por item |
| `src/lib/inventoryUtils.ts` | Adicionar `limite_estoque_baixo?: number` a `InventoryItemLike`; criar `getStatusEstoque()`; atualizar `computeInventoryStats()` para usar o campo |
| `src/components/inventory/InventoryView.tsx` | Substituir lógica hardcoded de filtro e badge de status por `getStatusEstoque()` |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx` | Substituir `getStockStatus()` local por `getStatusEstoque()`; adicionar UI de edição inline do `limite_estoque_baixo` para `clinic_admin` |
| `src/lib/services/alertTriggers.ts` | Usar `item.limite_estoque_baixo ?? settings.low_stock_threshold ?? 10` por item |
| `src/__tests__/inventoryUtils.test.ts` | Adicionar testes para `getStatusEstoque()` |

### 5.2 Arquivos a CRIAR

Nenhum arquivo novo será criado.

### 5.3 Arquivos que NÃO mudam

- `src/lib/services/masterProductService.ts` — `limite_estoque_baixo` é por item de inventário, não por produto master
- `src/app/(clinic)/clinic/add-products/page.tsx` — o campo não é definido na entrada; o default 10 se aplica automaticamente
- `src/types/notification.ts` — `low_stock_threshold` global permanece intacto como fallback
- `src/app/(clinic)/clinic/settings/page.tsx` — configuração global de threshold permanece funcional
- `firestore.rules` — nenhuma alteração (as regras existentes de tenant já cobrem o campo novo)
- `firestore.indexes.json` — nenhum índice adicional necessário

---

## 6. Especificação Técnica

### 6.1 `getStatusEstoque` em `inventoryUtils.ts`

```ts
export type StatusEstoque = 'Normal' | 'Baixo' | 'Sem estoque';

export function getStatusEstoque(item: {
  quantidade_disponivel: number;
  limite_estoque_baixo?: number;
}): StatusEstoque {
  if (item.quantidade_disponivel === 0) return 'Sem estoque';
  const limite = item.limite_estoque_baixo ?? 10;
  return item.quantidade_disponivel <= limite ? 'Baixo' : 'Normal';
}
```

### 6.2 `updateInventoryItemLimite` em `inventoryService.ts`

```ts
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function updateInventoryItemLimite(
  tenantId: string,
  itemId: string,
  limiteEstoqueBaixo: number
): Promise<void> {
  const itemRef = doc(db, 'tenants', tenantId, 'inventory', itemId);
  await updateDoc(itemRef, {
    limite_estoque_baixo: limiteEstoqueBaixo,
    updated_at: serverTimestamp(),
  });
}
```

### 6.3 `getInventoryStats` atualizado em `inventoryService.ts`

Substituir:
```ts
// Antes (hardcoded)
if (quantidade < 10) {
  produtosEstoqueBaixo++;
}
```

Por:
```ts
// Depois (por item, com fallback)
const limite = (data.limite_estoque_baixo as number | undefined) ?? 10;
if (quantidade > 0 && quantidade <= limite) {
  produtosEstoqueBaixo++;
}
```

> **Nota:** a condição muda de `< 10` para `<= limite` (padrão 10). Isso corrige a inconsistência onde o item com exatamente 10 unidades não era contado como "baixo" no dashboard mas era exibido como "Estoque Baixo" no filtro do inventário.

### 6.4 `computeInventoryStats` atualizado em `inventoryUtils.ts`

Substituir:
```ts
// Antes (hardcoded, valor diferente: 5)
if ((data.quantidade_disponivel as number) <= 5) low_stock++;
```

Por:
```ts
// Depois (por item, com fallback ao padrão 10)
const limite = (data.limite_estoque_baixo as number | undefined) ?? 10;
if ((data.quantidade_disponivel as number) <= limite) low_stock++;
```

> `InventoryItemLike` também recebe `limite_estoque_baixo?: number` para que `agruparProdutosPorCodigo` passado a `computeInventoryStats` carregue o campo quando disponível.

### 6.5 `InventoryView.tsx` atualizado

Substituir o filtro em memória:
```ts
// Antes
filtered = filtered.filter(
  (item) => item.quantidade_disponivel > 0 && item.quantidade_disponivel < 10
);
```
Por:
```ts
// Depois
filtered = filtered.filter(
  (item) => getStatusEstoque(item) === 'Baixo'
);
```

E o badge de status (linha 328) segue a mesma lógica:
```ts
// Antes
const isLowStock = item.quantidade_disponivel > 0 && item.quantidade_disponivel < 10;
```
Por:
```ts
const status = getStatusEstoque(item);
```

### 6.6 `alertTriggers.ts` atualizado

Substituir:
```ts
// Antes: threshold global para todos os itens
const minQuantity = settings.low_stock_threshold || 10;
// ...
if (item.quantidade_disponivel < minQuantity) { ... }
```

Por:
```ts
// Depois: threshold por item, fallback para global da clínica
const minQuantity = item.limite_estoque_baixo ?? settings.low_stock_threshold ?? 10;
if (item.quantidade_disponivel <= minQuantity) { ... }
```

> **Atenção:** a condição muda de `<` para `<=` — alinhando com a regra de negócio RN-03 e com o helper `getStatusEstoque`.

### 6.7 UI de edição inline em `/clinic/inventory/[id]/page.tsx`

Adicionar estado local e lógica de edição **somente para clinic_admin**:

```ts
// Estado
const [editandoLimite, setEditandoLimite] = useState(false);
const [limiteInput, setLimiteInput] = useState<number>(item?.limite_estoque_baixo ?? 10);
const [salvandoLimite, setSalvandoLimite] = useState(false);

// Handler
async function handleSalvarLimite() {
  if (!tenantId || !itemId || limiteInput < 0) return;
  setSalvandoLimite(true);
  try {
    await updateInventoryItemLimite(tenantId, itemId, limiteInput);
    setItem((prev) => prev ? { ...prev, limite_estoque_baixo: limiteInput } : prev);
    setEditandoLimite(false);
  } finally {
    setSalvandoLimite(false);
  }
}
```

**Layout da seção no card de status:**

```
┌─────────────────────────────────────────────┐
│  Status do Estoque                          │
│  ─────────────────────────────────────────  │
│  [Badge: Normal | Baixo | Sem estoque]      │
│                                             │
│  Limite de estoque baixo: [10]  [Editar]   │  ← somente clinic_admin
│  (≤ X unidades = Baixo; ≥ X+1 = Normal)    │
└─────────────────────────────────────────────┘
```

Ao clicar em **Editar**, o valor vira um `<Input type="number" min={0}>` com botões **Salvar** e **Cancelar** ao lado.

**Restrição de acesso:**
```ts
const isAdmin = claims?.role === 'clinic_admin';
// Renderizar o botão Editar apenas se isAdmin
```

---

## 7. Plano de Implementação

### STEP 1 — Campo, helper `getStatusEstoque` e atualização dos cálculos de stats

**Objetivo:** Centralizar a lógica de classificação e corrigir as inconsistências de threshold.

**Arquivos afetados:**
- `src/lib/services/inventoryService.ts`
- `src/lib/inventoryUtils.ts`

**Ações:**

1. Adicionar `limite_estoque_baixo?: number` à interface `InventoryItem` em `inventoryService.ts`
2. Criar `StatusEstoque` type e `getStatusEstoque()` em `inventoryUtils.ts` (ver seção 6.1)
3. Adicionar `limite_estoque_baixo?: number` à interface `InventoryItemLike` em `inventoryUtils.ts`
4. Atualizar `computeInventoryStats()` — substituir `<= 5` por `<= limite` com fallback (ver seção 6.4)
5. Adicionar função `updateInventoryItemLimite()` em `inventoryService.ts` (ver seção 6.2)
6. Atualizar `getInventoryStats()` — substituir `< 10` por `<= limite` com fallback (ver seção 6.3)

**Validação:** `npm run type-check` sem erros; `npm run test` passa (testes existentes em inventoryUtils.test.ts não devem quebrar — o threshold de 5 nos testes existentes precisa ser ajustado para 10).

> **Atenção:** verificar `src/__tests__/inventoryUtils.test.ts` — os testes existentes usam threshold 5. Ajustá-los para o novo padrão (10) como parte deste step.

**Commit:** `feat(inventory): add limite_estoque_baixo field to InventoryItem and getStatusEstoque helper`

---

### STEP 2 — UI de edição inline na página de detalhe do item

**Objetivo:** Permitir que o clinic_admin edite o `limite_estoque_baixo` diretamente na página de detalhe.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx`

**Ações:**

1. Importar `updateInventoryItemLimite` de `inventoryService`
2. Importar `getStatusEstoque` de `inventoryUtils`
3. Remover a função local `getStockStatus()` da página; substituir suas chamadas por `getStatusEstoque(item)` (mapear o retorno `'Normal' | 'Baixo' | 'Sem estoque'` para o badge existente `variant`)
4. Adicionar os estados `editandoLimite`, `limiteInput`, `salvandoLimite` (ver seção 6.7)
5. Implementar `handleSalvarLimite()` (ver seção 6.7)
6. Renderizar a seção de edição inline do limite no card de status (somente `clinic_admin`)
7. Exibir o label explicativo `"≤ X unidades = Baixo; ≥ X+1 = Normal"` abaixo do campo

**Mapeamento de retorno do helper para Badge variant:**

| `getStatusEstoque` retorna | variant do Badge |
| -------------------------- | ---------------- |
| `'Normal'` | `'default'` (verde/padrão) |
| `'Baixo'` | `'warning'` (amarelo/laranja) |
| `'Sem estoque'` | `'destructive'` (vermelho) |

**Validação:** Editar o limite como clinic_admin → valor salvo no Firestore e badge atualizado imediatamente. Acessar como clinic_user → botão Editar não aparece.

**Commit:** `feat(inventory): add updateInventoryItemLimite service and edit UI in inventory detail page`

---

### STEP 3 — Aplicar `getStatusEstoque` no `InventoryView`

**Objetivo:** Unificar o filtro de "Estoque Baixo" e o badge de status na listagem do inventário.

**Arquivos afetados:**
- `src/components/inventory/InventoryView.tsx`

**Ações:**

1. Importar `getStatusEstoque` de `inventoryUtils`
2. Substituir o filtro `low_stock` (linha 113-115) usando `getStatusEstoque(item) === 'Baixo'` (ver seção 6.5)
3. Substituir a lógica de badge de status (linha 328) por `getStatusEstoque(item)` (ver seção 6.5)
4. Verificar se o contador de "Estoque Baixo" exibido no rodapé/header do filtro também usa lógica hardcoded — se sim, corrigir da mesma forma

**Validação:** O filtro "Estoque Baixo" e o dashboard devem exibir a mesma contagem. Item com `limite_estoque_baixo = 5` deve aparecer como "Normal" se `quantidade_disponivel = 8`, e como "Baixo" se `quantidade_disponivel = 3`.

**Commit:** `feat(inventory): apply getStatusEstoque to InventoryView filter and badge display`

---

### STEP 4 — Atualizar `alertTriggers.ts` com threshold por item

**Objetivo:** Os alertas de notificação passam a respeitar o `limite_estoque_baixo` configurado por item.

**Arquivos afetados:**
- `src/lib/services/alertTriggers.ts`

**Ações:**

1. Dentro do loop `for (const docSnap of inventorySnap.docs)`, substituir o uso do `minQuantity` global pelo valor por item com fallback (ver seção 6.6)
2. Atualizar a variável de threshold para ser calculada por item: `const minQuantity = item.limite_estoque_baixo ?? settings.low_stock_threshold ?? 10;`
3. Corrigir a condição de `< minQuantity` para `<= minQuantity` (alinhando com a regra de negócio)

**Validação:** Item com `limite_estoque_baixo = 5` e `quantidade_disponivel = 5` deve gerar alerta. Item com `limite_estoque_baixo = 5` e `quantidade_disponivel = 6` não deve gerar alerta, mesmo que `settings.low_stock_threshold = 10`.

**Commit:** `feat(alerts): use per-item limite_estoque_baixo in alertTriggers with fallback to global threshold`

---

### STEP 5 — Testes unitários para `getStatusEstoque`

**Objetivo:** Cobrir o novo helper com testes unitários garantindo todos os cenários.

**Arquivos afetados:**
- `src/__tests__/inventoryUtils.test.ts`

**Ações:**

Adicionar bloco `describe('getStatusEstoque', ...)` com os seguintes cenários:

| Cenário | `quantidade_disponivel` | `limite_estoque_baixo` | Esperado |
| ------- | ----------------------- | ----------------------- | -------- |
| Sem estoque | 0 | undefined | `'Sem estoque'` |
| Sem estoque com limite | 0 | 5 | `'Sem estoque'` |
| Baixo — default (exatamente no limite) | 10 | undefined | `'Baixo'` |
| Baixo — default (abaixo do limite) | 7 | undefined | `'Baixo'` |
| Normal — default (acima do limite) | 11 | undefined | `'Normal'` |
| Baixo — limite customizado (no limite) | 5 | 5 | `'Baixo'` |
| Baixo — limite customizado (abaixo) | 3 | 5 | `'Baixo'` |
| Normal — limite customizado (acima) | 6 | 5 | `'Normal'` |
| Limite zero (todo estoque positivo = Normal) | 1 | 0 | `'Normal'` |

**Commit:** `test(inventory): add unit tests for getStatusEstoque helper`

---

### STEP 6 — Mover doc para TASK_COMPLETED

Executar o **Modo B** do agente `dev-task-manager` ainda na task branch antes de abrir a PR.

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
| ------- | ---------------- | --------------------- |
| `getStatusEstoque()` | `src/__tests__/inventoryUtils.test.ts` | Ver tabela no STEP 5 — 9 cenários obrigatórios |
| `computeInventoryStats()` | `src/__tests__/inventoryUtils.test.ts` | Ajustar cenários existentes para refletir threshold 10 (não 5) |

Regras aplicadas:
- Funções puras com lógica de classificação: **sempre testar**
- Componentes React, pages, serviços com IO Firebase: **não testar no MVP**

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando (incluindo os novos de getStatusEstoque)
[ ] Multi-tenant: updateInventoryItemLimite valida tenantId antes de escrever
[ ] Segurança: botão Editar visível apenas para clinic_admin (verificação via claims.role)
[ ] Consistência: dashboard, filtro do inventário e alertas exibem a mesma contagem de "estoque baixo"
[ ] Item sem limite_estoque_baixo no Firestore → comportamento idêntico ao padrão anterior (≤ 10 = Baixo)
[ ] Item com limite_estoque_baixo = 5: 5 unidades = Baixo; 6 unidades = Normal
[ ] Edição inline funciona: valor salvo no Firestore e badge atualizado sem recarregar a página
[ ] clinic_user não vê botão Editar na página de detalhe
[ ] alertTriggers usa limite por item com fallback ao global da clínica
[ ] Alerta não gerado novamente se já existe notificação não lida (comportamento preservado)
[ ] Documento movido para TASK_COMPLETED/ (commit na task branch)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
| ----- | ------------- | ------- | --------- |
| Testes existentes em `inventoryUtils.test.ts` quebrarem por mudança de threshold (5 → 10) | Alta | Baixo | Atualizar os testes no STEP 1; comportamento correto é 10, não 5 |
| Inconsistência de UX: badge "Baixo" na listagem divergir do badge no detalhe do item | Média | Médio | Ambos usam `getStatusEstoque()` após a feature; verificar no checklist de validação |
| clinic_admin configurar `limite_estoque_baixo = 0` zerando alertas de baixo estoque para um item | Baixa | Baixo | Comportamento válido por RN-01; 0 é um inteiro ≥ 0. Documentar que `0` significa "nunca baixo" |
| Alteração de `<` para `<=` em alertTriggers gerar alertas duplicados para itens com exatamente 10 unidades que não tinham alerta antes | Baixa | Baixo | A query de deduplicação (`existingNotifications`) já evita duplicatas; o novo alerta só será criado se não houver alerta não lido existente |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `limite_estoque_baixo` | Campo por item de inventário que define a quantidade máxima para classificação como "Baixo" (inclusive). Ausente = padrão 10 |
| `low_stock_threshold` | Campo em `NotificationSettings` por clínica (global). Usado como fallback quando o item não tem `limite_estoque_baixo` configurado |
| `getStatusEstoque()` | Helper puro centralizado que classifica um item como `'Normal'`, `'Baixo'` ou `'Sem estoque'` |
| `StatusEstoque` | Type union `'Normal' | 'Baixo' | 'Sem estoque'` retornado por `getStatusEstoque()` |
| Threshold | Valor inteiro (padrão 10) que define o limite máximo de quantidade para considerar um item como "Estoque Baixo" |

---

## 12. Referências

- `src/lib/services/inventoryService.ts` — interface `InventoryItem` e função `getInventoryStats()`
- `src/lib/inventoryUtils.ts` — helper `computeInventoryStats()` e interface `InventoryItemLike`
- `src/components/inventory/InventoryView.tsx` — filtros e badges de status na listagem
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx` — página de detalhe do item (read-only atualmente)
- `src/lib/services/alertTriggers.ts` — geração de alertas de estoque baixo por item
- `src/types/notification.ts` — `NotificationSettings.low_stock_threshold` (global por clínica)
- `src/app/(clinic)/clinic/settings/page.tsx` — UI do threshold global da clínica
- `src/__tests__/inventoryUtils.test.ts` — testes existentes de utilitários de inventário

---

## 13. Histórico de Versões

| Versão | Data       | Autor               | Descrição        |
| ------ | ---------- | ------------------- | ---------------- |
| 1.0    | 03/05/2026 | Doc Writer (Claude) | Documento criado |