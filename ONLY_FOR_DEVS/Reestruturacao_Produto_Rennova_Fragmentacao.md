# Reestruturação do Objeto "Produto Rennova" — Fragmentação

**Projeto:** Curva Mestra  
**Data:** 30/04/2026  
**Status:** Planejamento  
**Tipo de Change:** Feature  

---

## 1. Contexto e Motivação

O sistema atual trata todo produto Rennova como uma unidade indivisível. Isso funciona corretamente para produtos como **NABOTA 100U 150MG** (código `1162957`), onde cada unidade comprada equivale a uma unidade consumida num procedimento.

Porém, existem produtos vendidos em embalagem composta — como **SCREW 27GX50X70 5-0 60 UND.** (código `9193924`) —, que são adquiridos por caixa (contendo 60 unidades cada) mas consumidos por unidade individual nos procedimentos. O sistema atual não tem como representar essa diferença, forçando a clínica a registrar workarounds manuais.

### Exemplos concretos

| Produto | Código | Tipo | Comportamento |
|---------|--------|------|---------------|
| NABOTA 100U 150MG | 1162957 | Não fragmentável | 1 unidade comprada = 1 unidade consumida |
| SCREW 27GX50X70 5-0 60 UND. | 9193924 | Fragmentável | 1 caixa comprada = 60 unidades consumíveis |

---

## 2. Objetivo

1. Permitir que o **system_admin** marque um produto como **fragmentável** no cadastro, informando quantas unidades cada embalagem contém.
2. Ao **adicionar ao inventário**, a clínica informa a quantidade de embalagens adquiridas — o sistema calcula e armazena automaticamente a quantidade total de unidades.
3. Nos **procedimentos**, o consumo é sempre em unidades, independente do tipo de produto.
4. Todo o restante do sistema (relatórios, alertas, FEFO, reservas) continua funcionando sem alterações, pois a unidade de medida interna permanece a mesma.

---

## 3. Decisão de Design

### 3.1 Estratégia: "Converter na Entrada, Armazenar em Unidades"

A abordagem escolhida é **converter a quantidade de embalagens para unidades no momento da entrada no inventário** e armazenar tudo em unidades. Isso garante que **nenhum código de consumo, reserva, FEFO, relatório ou alerta precise ser alterado**.

```
Entrada no inventário (fragmentável):
  Usuário informa: 2 caixas × R$ 50,00/caixa
  Sistema armazena:
    quantidade_inicial    = 2 × 60 = 120 UND.
    quantidade_disponivel = 120 UND.
    valor_unitario        = R$ 50,00 ÷ 60 = R$ 0,8333/UND.
    [auditoria] quantidade_embalagens  = 2
    [auditoria] valor_por_embalagem    = R$ 50,00

Consumo no procedimento (fragmentável):
  Usuário informa: 6 UND.
  Sistema deduz:   quantidade_disponivel -= 6
  Valor:           6 × R$ 0,8333 = R$ 5,00
```

### 3.2 Por que essa abordagem?

- `quantidade_disponivel` e `valor_unitario` continuam com a mesma semântica em todo o sistema.
- `solicitacaoService`, `reportService`, `alertTriggers`, `inventoryUtils` (FEFO) — **zero alterações**.
- Os campos de auditoria (`quantidade_embalagens`, `valor_por_embalagem`) ficam no `InventoryItem` apenas para exibição e rastreabilidade, não participam de cálculos.

---

## 4. Mudanças no Modelo de Dados

### 4.1 MasterProduct — campos novos

```typescript
// src/types/masterProduct.ts
export interface MasterProduct {
  id: string;
  code: string;                        // 7 dígitos
  name: string;                        // Nome base (SEM quantidade/unidade)
  grupo?: string;
  active: boolean;
  // NOVO ↓
  fragmentavel: boolean;               // false = padrão (não fragmentável)
  unidades_por_embalagem?: number;     // Ex: 60 — obrigatório se fragmentavel=true
  unidade_medida?: string;             // Ex: "UND.", "mL", "mg" — opcional
  // ────────────────────────────────────
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Exemplos de dados:**

```json
// Não fragmentável (sem mudança funcional)
{
  "code": "1162957",
  "name": "NABOTA 100U 150MG",
  "fragmentavel": false
}

// Fragmentável
{
  "code": "9193924",
  "name": "SCREW 27GX50X70 5-0",
  "fragmentavel": true,
  "unidades_por_embalagem": 60,
  "unidade_medida": "UND."
}
```

> **Nota sobre o nome:** Para produtos fragmentáveis, o `name` armazenará apenas o nome base do produto (ex: `"SCREW 27GX50X70 5-0"`), sem a parte da quantidade. A exibição completa (ex: `"SCREW 27GX50X70 5-0 60 UND."`) será gerada dinamicamente pelo frontend quando necessário.

### 4.2 InventoryItem — campos novos (apenas auditoria)

```typescript
// src/lib/services/inventoryService.ts (interface InventoryItem)
export interface InventoryItem {
  // ... campos existentes sem alteração ...

  // NOVO ↓ (apenas para produtos fragmentáveis — null nos demais)
  fragmentavel?: boolean;              // Cópia do master_product para exibição rápida
  unidades_por_embalagem?: number;     // Cópia do master_product
  unidade_medida?: string;             // Cópia do master_product
  quantidade_embalagens?: number;      // Quantas embalagens foram compradas (auditoria)
  valor_por_embalagem?: number;        // Valor original por embalagem (auditoria)
  // ────────────────────────────────────
}
```

> `valor_unitario` e `quantidade_inicial`/`quantidade_disponivel` **não mudam de semântica** — são sempre por unidade final, independente do produto ser fragmentável ou não.

---

## 5. Mudanças por Módulo

### 5.1 Admin — Cadastro de Produto (`/admin/products/new`)

**Formulário atual:**
- Código (7 dígitos)
- Nome

**Formulário novo:**
- Código (7 dígitos)
- Nome *(apenas o nome base, sem quantidade)*
- **[NOVO]** Toggle: "Produto fragmentável?" (padrão: NÃO)
- **[NOVO, condicional]** Se fragmentável:
  - Quantidade por embalagem *(número inteiro positivo, ex: 60)*
  - Unidade de medida *(texto livre, ex: "UND.", "mL" — opcional)*

**Preview dinâmico** (quando fragmentável preenchido):
```
Nome completo: SCREW 27GX50X70 5-0 60 UND.
```

### 5.2 Admin — Detalhe/Edição do Produto (`/admin/products/[id]`)

- Exibir os novos campos (`fragmentavel`, `unidades_por_embalagem`, `unidade_medida`)
- Permitir edição dos mesmos
- **Restrição:** Se o produto já está em uso no inventário de alguma clínica, não permitir alterar `fragmentavel` ou `unidades_por_embalagem` (quebra os dados históricos)

### 5.3 Admin — Listagem de Produtos (`/admin/products`)

- Adicionar coluna ou badge "Fragmentável" na tabela
- Exibir nome completo: `{name} {unidades_por_embalagem} {unidade_medida}` para fragmentáveis

### 5.4 Clínica — Adicionar Produtos ao Inventário (`/clinic/add-products`)

**Fluxo atual (não fragmentável):**
```
Usuário informa: lote, quantidade (ex: 15), validade, valor unitário
Sistema armazena: quantidade_inicial = 15, valor_unitario = informado
```

**Fluxo novo (fragmentável):**
```
Usuário vê: "SCREW 27GX50X70 5-0 | 60 UND./embalagem"
Usuário informa: lote, quantidade de embalagens (ex: 2), validade, valor por embalagem
Sistema calcula e exibe em tempo real:
  - Total de unidades: 2 × 60 = 120 UND.
  - Valor por unidade: R$ 50,00 ÷ 60 = R$ 0,8333
Sistema armazena no InventoryItem:
  - quantidade_inicial    = 120
  - quantidade_disponivel = 120
  - valor_unitario        = R$ 0,8333
  - quantidade_embalagens = 2    (auditoria)
  - valor_por_embalagem   = R$ 50,00 (auditoria)
```

**O campo label muda conforme o tipo:**
- Não fragmentável: `Quantidade` *(unidades)*
- Fragmentável: `Quantidade de embalagens` *(ex: caixas)*

### 5.5 Clínica — Novo Procedimento (`/clinic/requests/new`)

**Sem alteração na lógica de consumo.** O usuário já informa a quantidade em unidades e o sistema deduz do `quantidade_disponivel` — que agora, para fragmentáveis, já está em unidades.

Única mudança de UI: ao exibir o produto no seletor, mostrar o nome completo:
- Fragmentável: `"SCREW 27GX50X70 5-0 60 UND. | Disponível: 120 UND."`
- Não fragmentável: `"NABOTA 100U 150MG | Disponível: 15 UND."`

### 5.6 Clínica — Inventário (`/clinic/inventory`)

- Produtos fragmentáveis: exibir `"120 UND. (2 embalagens × 60)"` na coluna de quantidade
- Adicionar badge ou indicador visual "Fragmentável"

### 5.7 Módulo Consultor (`/consultant/clinics/[tenantId]/inventory`)

- Mesmo ajuste de exibição do item 5.6

---

## 6. Funções a Criar/Modificar

### 6.1 `masterProductService.ts`

| Função | Ação |
|--------|------|
| `createMasterProduct()` | Receber e salvar `fragmentavel`, `unidades_por_embalagem`, `unidade_medida` |
| `updateMasterProduct()` | Idem; validar restrição de edição se produto em uso |
| `getNomeCompleto(product)` | **NOVA** — helper que retorna o nome de exibição completo |

```typescript
// Helper de exibição
export function getNomeCompletoMasterProduct(product: MasterProduct): string {
  if (!product.fragmentavel || !product.unidades_por_embalagem) {
    return product.name;
  }
  const unidade = product.unidade_medida ?? "UND.";
  return `${product.name} ${product.unidades_por_embalagem} ${unidade}`;
}
```

### 6.2 `inventoryService.ts`

| Função | Ação |
|--------|------|
| `addInventoryItem()` | Para fragmentáveis: multiplicar quantidade × unidades_por_embalagem; dividir valor; salvar campos de auditoria |
| `calcularQuantidadeInventario()` | **NOVA** — helper que faz o cálculo antes de salvar |

```typescript
// Helper de cálculo (função pura — deve ter teste unitário)
export function calcularQuantidadeInventario(params: {
  quantidadeInformada: number;
  fragmentavel: boolean;
  unidadesPorEmbalagem?: number;
  valorInformado: number;
}): {
  quantidade_inicial: number;
  valor_unitario: number;
} {
  if (!params.fragmentavel || !params.unidadesPorEmbalagem) {
    return {
      quantidade_inicial: params.quantidadeInformada,
      valor_unitario: params.valorInformado,
    };
  }
  return {
    quantidade_inicial: params.quantidadeInformada * params.unidadesPorEmbalagem,
    valor_unitario: params.valorInformado / params.unidadesPorEmbalagem,
  };
}
```

---

## 7. Testes Unitários a Criar

| Função | Arquivo de Teste | Cenários |
|--------|-----------------|----------|
| `getNomeCompletoMasterProduct()` | `src/__tests__/masterProductService.test.ts` | Não fragmentável retorna nome simples; fragmentável com unidade_medida; fragmentável sem unidade_medida (fallback "UND.") |
| `calcularQuantidadeInventario()` | `src/__tests__/inventoryUtils.test.ts` | Não fragmentável retorna valores intactos; fragmentável multiplica qtd e divide valor; borda: fragmentável sem unidades_por_embalagem (fallback seguro) |

---

## 8. Plano de Execução por Steps

---

### STEP 1 — Atualizar tipos e helpers do MasterProduct

**Arquivos:** `src/types/masterProduct.ts`, `src/lib/services/masterProductService.ts`

**Ações:**
1. Adicionar campos `fragmentavel`, `unidades_por_embalagem`, `unidade_medida` à interface `MasterProduct` e `CreateMasterProductData`
2. Criar helper `getNomeCompletoMasterProduct(product)`
3. Atualizar `createMasterProduct()` e `updateMasterProduct()` para persistir os novos campos

**Validação:** TypeScript compila sem erros; helper retorna nome correto para ambos os casos.

**Commit:** `feat(types): add fragmentavel fields to MasterProduct interface`

---

### STEP 2 — Criar teste unitário para os helpers

**Arquivo:** `src/__tests__/masterProductService.test.ts` (novo)

**Ações:**
1. Testar `getNomeCompletoMasterProduct()` com os cenários descritos na seção 7

**Validação:** `npm run test` passa.

**Commit:** `test(types): add unit tests for getNomeCompletoMasterProduct helper`

---

### STEP 3 — Atualizar helper de cálculo de inventário

**Arquivos:** `src/lib/services/inventoryService.ts`, `src/__tests__/inventoryUtils.test.ts`

**Ações:**
1. Adicionar campos opcionais de auditoria à interface `InventoryItem`
2. Criar função pura `calcularQuantidadeInventario()`
3. Adicionar testes unitários para `calcularQuantidadeInventario()`

**Validação:** `npm run test` passa.

**Commit:** `feat(inventory): add calcularQuantidadeInventario helper with tests`

---

### STEP 4 — Atualizar formulário de cadastro de produto (Admin)

**Arquivo:** `src/app/(admin)/admin/products/new/page.tsx`

**Ações:**
1. Adicionar toggle "Produto fragmentável?"
2. Exibir condicionalmente os campos `unidades_por_embalagem` e `unidade_medida`
3. Adicionar preview dinâmico do nome completo
4. Passar os novos campos para `createMasterProduct()`

**Validação:** Criar produto não fragmentável → campos novos ausentes no Firestore. Criar produto fragmentável → campos salvos corretamente.

**Commit:** `feat(admin): add fragmentavel toggle to product creation form`

---

### STEP 5 — Atualizar página de detalhe/edição do produto (Admin)

**Arquivo:** `src/app/(admin)/admin/products/[id]/page.tsx`

**Ações:**
1. Exibir os novos campos na visualização
2. Permitir edição de `fragmentavel`, `unidades_por_embalagem`, `unidade_medida`
3. Implementar restrição: se produto está em uso no inventário, desabilitar edição dos campos de fragmentação com aviso explicativo

**Validação:** Produto existente exibe campos corretamente. Tentativa de editar produto em uso exibe aviso.

**Commit:** `feat(admin): show and edit fragmentavel fields in product detail`

---

### STEP 6 — Atualizar listagem de produtos (Admin)

**Arquivo:** `src/app/(admin)/admin/products/page.tsx`

**Ações:**
1. Exibir nome completo (`getNomeCompletoMasterProduct()`) na tabela
2. Adicionar badge "Fragmentável" nos produtos com essa característica

**Validação:** Listagem exibe nomes corretos para ambos os tipos.

**Commit:** `feat(admin): display full product name and fragmentavel badge in list`

---

### STEP 7 — Atualizar adição de produtos ao inventário (Clínica)

**Arquivo:** `src/app/(clinic)/clinic/add-products/page.tsx`

**Ações:**
1. Ao selecionar produto fragmentável, detectar via `masterProduct.fragmentavel`
2. Alterar label do campo de quantidade para "Quantidade de embalagens"
3. Exibir cálculo em tempo real: `{qtd} × {unidades_por_embalagem} = {total} {unidade_medida}`
4. Exibir valor por unidade calculado em tempo real
5. Usar `calcularQuantidadeInventario()` antes de montar o payload
6. Salvar campos de auditoria (`quantidade_embalagens`, `valor_por_embalagem`) no `InventoryItem`

**Validação:** Adicionar 2 caixas de produto com 60 UND. → inventário registra `quantidade_inicial = 120` e `valor_unitario` correto.

**Commit:** `feat(inventory): handle fragmentavel product entry with unit conversion`

---

### STEP 8 — Atualizar exibição no inventário e no seletor de procedimentos

**Arquivos:**
- `src/app/(clinic)/clinic/inventory/page.tsx`
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx`
- `src/app/(clinic)/clinic/requests/new/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx`

**Ações:**
1. Inventário: exibir `"120 UND. (2 embalagens × 60)"` para fragmentáveis; quantidade simples para não fragmentáveis
2. Seletor de procedimento: exibir nome completo e quantidade disponível em unidades
3. Badge ou indicador visual "Fragmentável" onde aplicável

**Validação:** UI exibe informações corretas para ambos os tipos; procedimentos funcionam normalmente.

**Commit:** `feat(ui): display fragmentation info in inventory and procedure selector`

---

### STEP 9 — Validação final e checklist

```
[ ] npm run lint        — sem erros
[ ] npm run type-check  — sem erros
[ ] npm run build       — sem erros
[ ] npm run test        — todos os testes passando
[ ] Criar produto fragmentável → campos salvos no Firestore
[ ] Criar produto não fragmentável → campos novos ausentes (undefined/null)
[ ] Adicionar produto fragmentável ao inventário → quantidade em unidades correta
[ ] Adicionar produto não fragmentável → comportamento idêntico ao atual
[ ] Procedimento consumindo produto fragmentável → deduz unidades corretamente
[ ] Relatório de consumo → valores financeiros corretos (por unidade)
[ ] Alerta de estoque baixo → baseado em unidades (sem alteração)
[ ] FEFO → funciona normalmente (sem alteração)
[ ] Consultor visualiza inventário → exibe info de fragmentação
```

---

## 9. Ordem de Execução Recomendada

```
STEP 1 → STEP 2 → STEP 3
                       ↓
         STEP 4 → STEP 5 → STEP 6
                                ↓
                    STEP 7 → STEP 8 → STEP 9
```

Steps 1, 2 e 3 são pré-requisitos (camada de dados e testes). Steps 4 a 6 (Admin) e Step 7 (Clínica entrada) dependem da camada de dados. Step 8 pode ser feito em paralelo com Step 7 por outro dev.

---

## 10. O que NÃO muda

- `solicitacaoService.ts` — nenhuma alteração (consumo já opera em unidades)
- `reportService.ts` — nenhuma alteração (usa `valor_unitario` × `quantidade`)
- `alertTriggers.ts` — nenhuma alteração (opera em `quantidade_disponivel`)
- `inventoryUtils.ts` (FEFO) — nenhuma alteração (opera em `quantidade_disponivel`)
- Regras Firestore — nenhuma alteração
- Índices Firestore — nenhuma alteração

---

## 11. Riscos e Pontos de Atenção

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Arredondamento de `valor_unitario` (divisão) | Médio | Armazenar com no mínimo 4 casas decimais; exibir arredondado na UI |
| Editar `unidades_por_embalagem` após produto já no inventário | Alto | Bloquear edição se produto está em uso (verificar coleção `inventory` do tenant) |
| Produtos existentes no Firestore sem o campo `fragmentavel` | Baixo | Tratar `fragmentavel: undefined` como `false` em todo o código |
| Confusão de UX no formulário de adição ao inventário | Médio | Label e preview claros; exibir o cálculo em tempo real |