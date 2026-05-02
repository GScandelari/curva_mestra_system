# Feature: Fragmentação de Produto Rennova

**Projeto:** Curva Mestra
**Data:** 30/04/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Tipo:** Feature
**Branch sugerida:** `feature/fragmentacao-produto-rennova`
**Prioridade:** Alta
**Versão:** 1.1
**Concluído em:** 01/05/2026
**Concluído por:** Guilherme Scandelari

> O sistema trata todos os produtos Rennova como unidades indivisíveis. Esta feature introduz o conceito de produto **fragmentável** — adquirido em embalagem composta (ex: caixa com 60 unidades) mas consumido por unidade individual nos procedimentos. A conversão ocorre na entrada do inventário, preservando a semântica de todas as camadas downstream (consumo, FEFO, relatórios, alertas) sem qualquer alteração nesses módulos. Além disso, corrige o campo `grupo` → `category` na interface `MasterProduct`, alinhando o TypeScript com o Firestore.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/fragmentacao-produto-rennova`
**PR target:** `develop` (nunca diretamente para `master`)

```bash
git checkout develop
git pull origin develop
git checkout -b feature/fragmentacao-produto-rennova
```

| Step   | Tipo       | Escopo      | Mensagem sugerida                                                                        |
| ------ | ---------- | ----------- | ---------------------------------------------------------------------------------------- |
| STEP 1 | `refactor` | `types`     | `refactor(types): rename grupo to category and add fragmentavel fields to MasterProduct` |
| STEP 2 | `test`     | `types`     | `test(types): add unit tests for getNomeCompletoMasterProduct helper`                    |
| STEP 3 | `feat`     | `inventory` | `feat(inventory): add calcularQuantidadeInventario helper with tests`                    |
| STEP 4 | `feat`     | `admin`     | `feat(admin): add category select and fragmentavel toggle to product creation form`      |
| STEP 5 | `feat`     | `admin`     | `feat(admin): show and edit category and fragmentavel fields in product detail`          |
| STEP 6 | `feat`     | `admin`     | `feat(admin): display full product name and fragmentavel badge in product list`          |
| STEP 7 | `feat`     | `inventory` | `feat(inventory): handle fragmentavel product entry with unit conversion`                |
| STEP 8 | `feat`     | `ui`        | `feat(ui): display fragmentation info in inventory and procedure selector`               |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

O arquivo `src/types/masterProduct.ts` define a interface `MasterProduct` com o campo `grupo?: string`, que representa a categoria do produto. Porém, o script de importação `scripts/import-master-products-dev.js` já persiste esse campo no Firestore com o nome `category` — há uma inconsistência entre TypeScript e banco de dados. O campo nunca foi exposto na UI.

Adicionalmente, todos os produtos são tratados como unidades indivisíveis: `quantidade_inicial`, `quantidade_disponivel` e `valor_unitario` sempre representam unidades individuais. Não existe nenhum mecanismo para representar produtos vendidos em embalagem composta (ex: caixa com 60 unidades).

A interface `InventoryItem` em `src/types/index.ts` e em `src/lib/services/inventoryService.ts` não possui campos de fragmentação. O `masterProductService.ts` tampouco possui helpers de exibição de nome completo.

### 1.2 Problema identificado

Produtos como **SCREW 27GX50X70 5-0 60 UND.** (código `9193924`) são adquiridos por caixa (60 unidades) mas consumidos individualmente. O sistema não representa essa diferença, forçando workarounds manuais nas clínicas.

Exemplos concretos:

| Produto                     | Código  | Comportamento atual      | Comportamento necessário          |
| --------------------------- | ------- | ------------------------ | --------------------------------- |
| NABOTA 100U 150MG           | 1162957 | 1 comprada = 1 consumida | Sem mudança                       |
| SCREW 27GX50X70 5-0 60 UND. | 9193924 | 1 caixa = 1 unidade      | 1 caixa = 60 unidades consumíveis |

### 1.3 Motivação estratégica

A inconsistência `grupo` → `category` causa divergência silenciosa entre o TypeScript e o Firestore. O suporte a produtos fragmentáveis é necessário para que o controle de estoque reflita a realidade operacional das clínicas, sem exigir alteração em nenhuma das camadas de consumo já implementadas.

---

## 2. Objetivos

1. Renomear `grupo` → `category` em toda a interface `MasterProduct`, `CreateMasterProductData` e `UpdateMasterProductData`, alinhando TypeScript com o Firestore.
2. Expor e permitir edição do campo `category` nos formulários de cadastro, detalhe e listagem de produtos (Admin).
3. Permitir que o `system_admin` marque um produto como **fragmentável**, informando quantas unidades cada embalagem contém.
4. Na entrada de inventário, converter automaticamente embalagens em unidades e calcular o `valor_unitario` por unidade.
5. Exibir informações de fragmentação no inventário da clínica, no módulo do consultor e no seletor de procedimentos.
6. Garantir que nenhum serviço de consumo, reserva, FEFO, relatório ou alerta precise ser alterado.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descrição                                                                                                                                  | Ator                                           | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------- |
| RF-01 | O system_admin deve poder marcar um produto como fragmentável, informando `unidades_por_embalagem`                                         | system_admin                                   | Must       |
| RF-02 | O system_admin deve poder visualizar e editar o campo `category` nos formulários de produto                                                | system_admin                                   | Must       |
| RF-03 | Ao adicionar produto fragmentável ao inventário, o campo de quantidade deve se chamar "Quantidade de embalagens"                           | clinic_admin / clinic_user                     | Must       |
| RF-04 | O sistema deve calcular e exibir em tempo real o total de unidades e o valor por unidade na entrada do inventário                          | clinic_admin / clinic_user                     | Must       |
| RF-05 | O inventário deve exibir a quantidade de produto fragmentável no formato `"120 UND (2 embalagens × 60)"`                                   | clinic_admin / clinic_user / clinic_consultant | Should     |
| RF-06 | O seletor de procedimentos deve exibir o nome completo do produto fragmentável e a quantidade disponível em unidades                       | clinic_admin / clinic_user                     | Must       |
| RF-07 | O sistema deve bloquear edição de `fragmentavel` e `unidades_por_embalagem` se o produto já estiver em uso no inventário de alguma clínica | system_admin                                   | Must       |
| RF-08 | A listagem de produtos Admin deve exibir badge "Fragmentável" e filtro por categoria                                                       | system_admin                                   | Should     |

### 3.2 Requisitos Não Funcionais (RNF)

| ID     | Descrição                                                                                                       | Categoria                  |
| ------ | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| RNF-01 | `valor_unitario` deve ser armazenado com no mínimo 4 casas decimais para evitar perda por arredondamento        | Precisão financeira        |
| RNF-02 | Nenhuma alteração nos serviços `solicitacaoService`, `reportService`, `alertTriggers` e `inventoryUtils` (FEFO) | Manutenibilidade           |
| RNF-03 | Produtos existentes sem o campo `fragmentavel` devem ser tratados como `false` em todo o sistema                | Compatibilidade retroativa |
| RNF-04 | O helper `calcularQuantidadeInventario()` deve ser uma função pura com testes unitários                         | Testabilidade              |

### 3.3 Regras de Negócio (RN)

| ID    | Regra                                                                                                                                                     | Justificativa                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| RN-01 | A unidade de medida é sempre `"UND"` — fixo no sistema, sem campo configurável                                                                            | Simplicidade do MVP                 |
| RN-02 | `quantidade_disponivel` e `valor_unitario` no `InventoryItem` sempre representam unidades individuais, independente do produto ser fragmentável           | Consistência das camadas downstream |
| RN-03 | Os campos `quantidade_embalagens` e `valor_por_embalagem` existem apenas para auditoria e rastreabilidade — não participam de cálculos                    | Separação de responsabilidades      |
| RN-04 | Para produtos fragmentáveis, o `name` armazena apenas o nome base (ex: `"SCREW 27GX50X70 5-0"`); a exibição completa é gerada dinamicamente pelo frontend | Integridade do dado master          |
| RN-05 | `category` pode ser editada livremente mesmo que o produto esteja em uso; apenas `fragmentavel` e `unidades_por_embalagem` são bloqueados                 | Regra de negócio da tela de edição  |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida — "Converter na Entrada, Armazenar em Unidades"

A quantidade de embalagens é convertida para unidades no momento da entrada no inventário. Todo o restante do sistema opera apenas com unidades.

```
Entrada (fragmentável):
  Usuário informa: 2 caixas × R$ 50,00/caixa
  Sistema armazena:
    quantidade_inicial    = 2 × 60 = 120 UND.
    quantidade_disponivel = 120 UND.
    valor_unitario        = R$ 50,00 ÷ 60 = R$ 0,8333/UND.
    [auditoria] quantidade_embalagens = 2
    [auditoria] valor_por_embalagem   = R$ 50,00

Consumo (fragmentável):
  Usuário informa: 6 UND.
  Sistema deduz:   quantidade_disponivel -= 6
  Valor:           6 × R$ 0,8333 = R$ 5,00
```

### 4.2 Alternativas descartadas

| Alternativa                                        | Motivo da rejeição                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Armazenar em embalagens e converter no consumo     | Exigiria alteração em `solicitacaoService`, `reportService`, FEFO e alertas — alto risco |
| Campo `unidade_medida` configurável pelo admin     | Complexidade desnecessária no MVP; a unidade é sempre UND                                |
| Criar coleção separada para produtos fragmentáveis | Fragmentação de dados sem benefício; a distinção é um atributo do master product         |

### 4.3 Trade-offs aceitos

- O `valor_unitario` armazenado é uma divisão com possível perda por arredondamento (mitigado com 4+ casas decimais).
- A exibição de nome completo depende de um helper no frontend — não é um campo persistido.
- A restrição de edição de campos de fragmentação depende de query ao Firestore para verificar uso no inventário.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo                                      | Tipo             | Propósito                                              |
| -------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `src/__tests__/masterProductService.test.ts` | Arquivo de teste | Testes unitários para `getNomeCompletoMasterProduct()` |

### 5.2 Arquivos a MODIFICAR

| Arquivo                                                                 | Natureza da mudança                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/masterProduct.ts`                                            | Renomear `grupo` → `category`; adicionar `fragmentavel`, `unidades_por_embalagem`; adicionar `MASTER_PRODUCT_CATEGORIES` e `MasterProductCategory`; criar helper `getNomeCompletoMasterProduct()` |
| `src/lib/services/masterProductService.ts`                              | Atualizar `createMasterProduct()` e `updateMasterProduct()` para persistir novos campos; adicionar validação de restrição de edição                                                               |
| `src/lib/services/inventoryService.ts`                                  | Adicionar campos de auditoria à interface `InventoryItem`; criar `calcularQuantidadeInventario()`                                                                                                 |
| `src/__tests__/inventoryUtils.test.ts`                                  | Adicionar testes unitários para `calcularQuantidadeInventario()`                                                                                                                                  |
| `src/app/(admin)/admin/products/new/page.tsx`                           | Adicionar campo `category` (Select), toggle `fragmentavel` e campo condicional `unidades_por_embalagem`; preview dinâmico                                                                         |
| `src/app/(admin)/admin/products/[id]/page.tsx`                          | Exibir e editar `category`, `fragmentavel`, `unidades_por_embalagem`; bloquear campos de fragmentação se produto em uso                                                                           |
| `src/app/(admin)/admin/products/page.tsx`                               | Exibir nome completo, badge "Fragmentável" e filtro por categoria                                                                                                                                 |
| `src/app/(clinic)/clinic/add-products/page.tsx`                         | Detectar produto fragmentável; alterar label e calcular em tempo real; usar `calcularQuantidadeInventario()`                                                                                      |
| `src/app/(clinic)/clinic/inventory/page.tsx`                            | Exibir formato `"120 UND (2 embalagens × 60)"` para fragmentáveis                                                                                                                                 |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx`                       | Exibir informações de fragmentação no detalhe                                                                                                                                                     |
| `src/app/(clinic)/clinic/requests/new/page.tsx`                         | Exibir nome completo no seletor de produto                                                                                                                                                        |
| `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` | Mesmo ajuste de exibição do inventário da clínica                                                                                                                                                 |

### 5.3 Arquivos a REMOVER

Nenhum arquivo será removido nesta feature.

### 5.4 Impacto no Firestore

| Coleção                        | Ação                                             | Detalhes                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `master_products`              | Novos campos nos documentos                      | `fragmentavel: boolean`, `unidades_por_embalagem?: number`, `category?: string` — produtos existentes sem esses campos são tratados como `fragmentavel: false` |
| `tenants/{tenantId}/inventory` | Novos campos opcionais nos documentos de entrada | `fragmentavel?: boolean`, `unidades_por_embalagem?: number`, `quantidade_embalagens?: number`, `valor_por_embalagem?: number`                                  |

### 5.5 O que NÃO muda

- `src/lib/services/solicitacaoService.ts` — nenhuma alteração (consumo já opera em unidades via `quantidade_disponivel`)
- `src/lib/services/reportService.ts` — nenhuma alteração (usa `valor_unitario × quantidade`, ambos sempre em unidades)
- `src/lib/services/alertTriggers.ts` — nenhuma alteração (opera em `quantidade_disponivel`)
- `src/__tests__/inventoryUtils.test.ts` (testes FEFO existentes) — nenhuma alteração
- `firestore.rules` — nenhuma alteração
- `firestore.indexes.json` — nenhuma alteração (os índices existentes de `inventory` já cobrem as queries necessárias)
- Todo o módulo de relatórios (`src/app/(clinic)/clinic/reports/`) — nenhuma alteração

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**`src/types/masterProduct.ts` — antes:**

```typescript
export interface MasterProduct {
  id: string;
  code: string;
  name: string;
  grupo?: string; // inconsistente com Firestore que já salva "category"
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateMasterProductData {
  code: string;
  name: string;
  grupo?: string;
  active?: boolean;
}

export interface UpdateMasterProductData {
  code?: string;
  name?: string;
  grupo?: string;
  active?: boolean;
}
```

**`src/types/masterProduct.ts` — depois:**

```typescript
export const MASTER_PRODUCT_CATEGORIES = [
  'Preenchedores',
  'Bioestimuladores',
  'Fios de PDO',
  'Toxina',
  'Cannulas',
  'Care Home',
  'Care Professional',
] as const;

export type MasterProductCategory = (typeof MASTER_PRODUCT_CATEGORIES)[number];

export interface MasterProduct {
  id: string;
  code: string;
  name: string; // Nome base (SEM quantidade/unidade para fragmentáveis)
  category?: MasterProductCategory; // RENOMEADO de "grupo"; alinhado com Firestore
  active: boolean;
  // NOVOS ↓
  fragmentavel: boolean; // false = padrão; undefined tratado como false
  unidades_por_embalagem?: number; // Obrigatório quando fragmentavel=true
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateMasterProductData {
  code: string;
  name: string;
  category?: MasterProductCategory;
  active?: boolean;
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
}

export interface UpdateMasterProductData {
  code?: string;
  name?: string;
  category?: MasterProductCategory;
  active?: boolean;
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
}

// Helper de exibição — retorna nome completo para produtos fragmentáveis
export function getNomeCompletoMasterProduct(product: MasterProduct): string {
  if (!product.fragmentavel || !product.unidades_por_embalagem) {
    return product.name;
  }
  return `${product.name} ${product.unidades_por_embalagem} UND`;
}
```

**`src/lib/services/inventoryService.ts` — campos novos na interface `InventoryItem`:**

```typescript
export interface InventoryItem {
  // ... campos existentes sem alteração ...

  // NOVO — apenas para produtos fragmentáveis; null/undefined nos demais
  fragmentavel?: boolean; // Cópia do master_product para exibição rápida
  unidades_por_embalagem?: number; // Cópia do master_product
  quantidade_embalagens?: number; // Quantas embalagens foram compradas (auditoria)
  valor_por_embalagem?: number; // Valor original por embalagem (auditoria)
}
```

> `valor_unitario`, `quantidade_inicial` e `quantidade_disponivel` **não mudam de semântica** — sempre por unidade final, independente do produto ser fragmentável ou não.

### 6.2 Mudanças em serviços

**`calcularQuantidadeInventario()` — função pura a criar em `src/lib/services/inventoryService.ts`:**

```typescript
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

**`updateMasterProduct()` — restrição de edição a adicionar em `src/lib/services/masterProductService.ts`:**

A função deve verificar se o produto está em uso em alguma coleção `tenants/{tenantId}/inventory` antes de permitir alteração de `fragmentavel` ou `unidades_por_embalagem`. Se em uso, lançar erro descritivo.

### 6.3 Mudanças na UI

**Formulário de cadastro (`/admin/products/new`):**

| Campo              | Estado atual | Estado novo                                                 |
| ------------------ | ------------ | ----------------------------------------------------------- |
| Categoria          | Ausente      | Select com `MASTER_PRODUCT_CATEGORIES`                      |
| Fragmentável       | Ausente      | Toggle "Produto fragmentável?" (padrão: NÃO)                |
| Qtd. por embalagem | Ausente      | Campo numérico, exibido condicionalmente quando toggle=true |
| Preview do nome    | Ausente      | Exibido dinamicamente: `"SCREW 27GX50X70 5-0 60 UND"`       |

**Formulário de adição ao inventário (`/clinic/add-products`):**

| Campo                     | Produto não fragmentável         | Produto fragmentável                                      |
| ------------------------- | -------------------------------- | --------------------------------------------------------- |
| Label do campo quantidade | "Quantidade"                     | "Quantidade de embalagens"                                |
| Cálculo em tempo real     | —                                | `{qtd} × {unidades/emb} = {total} UND` e valor/unidade    |
| Payload enviado           | `quantidade_inicial = informado` | `quantidade_inicial = informado × unidades_por_embalagem` |

**Exibição no inventário:**

- Não fragmentável: `"15"` (comportamento atual)
- Fragmentável: `"120 UND (2 embalagens × 60)"`

**Seletor no novo procedimento:**

- Não fragmentável: `"NABOTA 100U 150MG | Disponível: 15"`
- Fragmentável: `"SCREW 27GX50X70 5-0 60 UND | Disponível: 120 UND"`

### 6.4 Mudanças em API Routes

Não há mudanças em API Routes nesta feature. A criação de produtos e a adição ao inventário já ocorrem via chamadas diretas ao Firestore pelos serviços.

---

## 7. Plano de Implementação

### STEP 1 — Corrigir e atualizar tipos do MasterProduct

**Objetivo:** Renomear `grupo` → `category`, adicionar campos de fragmentação e helpers.

**Arquivos afetados:**

- `src/types/masterProduct.ts` — renomear campo, adicionar constante, tipos e helper

**Ações:**

1. Renomear `grupo` → `category` nas interfaces `MasterProduct`, `CreateMasterProductData` e `UpdateMasterProductData`; substituir tipo `string` por `MasterProductCategory`
2. Adicionar a constante `MASTER_PRODUCT_CATEGORIES` e o type `MasterProductCategory`
3. Adicionar campos `fragmentavel: boolean` e `unidades_por_embalagem?: number` às interfaces
4. Criar a função `getNomeCompletoMasterProduct(product: MasterProduct): string`
5. Atualizar `createMasterProduct()` e `updateMasterProduct()` em `masterProductService.ts` para persistir os novos campos
6. Buscar no projeto inteiro referências a `grupo` e substituir por `category`

**Validação:** `npm run type-check` sem erros; nenhuma ocorrência de `.grupo` permanece no código TypeScript.

**Commit:** `refactor(types): rename grupo to category and add fragmentavel fields to MasterProduct`

---

### STEP 2 — Criar teste unitário para `getNomeCompletoMasterProduct`

**Objetivo:** Garantir que o helper de exibição funciona corretamente para ambos os casos.

**Arquivos afetados:**

- `src/__tests__/masterProductService.test.ts` — arquivo a criar

**Ações:**

1. Criar o arquivo de teste
2. Testar cenário: produto não fragmentável → retorna `product.name` sem sufixo
3. Testar cenário: produto fragmentável com `unidades_por_embalagem = 60` → retorna `"{name} 60 UND"`
4. Testar cenário: produto com `fragmentavel = true` mas sem `unidades_por_embalagem` → retorna `product.name` (fallback seguro)

**Validação:** `npm run test` passa.

**Commit:** `test(types): add unit tests for getNomeCompletoMasterProduct helper`

---

### STEP 3 — Criar helper de cálculo de inventário com testes

**Objetivo:** Implementar a função pura `calcularQuantidadeInventario()` e cobri-la com testes.

**Arquivos afetados:**

- `src/lib/services/inventoryService.ts` — adicionar campos à interface `InventoryItem`; criar `calcularQuantidadeInventario()`
- `src/__tests__/inventoryUtils.test.ts` — adicionar cenários de teste

**Ações:**

1. Adicionar os campos opcionais de auditoria à interface `InventoryItem` (ver seção 6.1)
2. Implementar a função `calcularQuantidadeInventario()` (ver seção 6.2)
3. Adicionar testes: produto não fragmentável → valores intactos; fragmentável → multiplica qtd e divide valor; borda: fragmentável sem `unidades_por_embalagem` → fallback como não fragmentável

**Validação:** `npm run test` passa.

**Commit:** `feat(inventory): add calcularQuantidadeInventario helper with tests`

---

### STEP 4 — Atualizar formulário de cadastro de produto (Admin)

**Objetivo:** Expor `category`, `fragmentavel` e `unidades_por_embalagem` no formulário de criação.

**Arquivos afetados:**

- `src/app/(admin)/admin/products/new/page.tsx`

**Ações:**

1. Adicionar campo `category` como Select com as opções de `MASTER_PRODUCT_CATEGORIES`
2. Adicionar toggle "Produto fragmentável?" (padrão: desligado)
3. Exibir condicionalmente o campo `unidades_por_embalagem` (número inteiro positivo) quando o toggle estiver ativo
4. Adicionar preview dinâmico do nome completo usando `getNomeCompletoMasterProduct()`
5. Incluir `category`, `fragmentavel` e `unidades_por_embalagem` no payload passado a `createMasterProduct()`

**Validação:** Criar produto não fragmentável → `category` salva, campos de fragmentação ausentes. Criar produto fragmentável → todos os campos salvos corretamente no Firestore.

**Commit:** `feat(admin): add category select and fragmentavel toggle to product creation form`

---

### STEP 5 — Atualizar detalhe/edição do produto (Admin)

**Objetivo:** Exibir e editar os novos campos na tela de detalhe, com restrição de edição para produtos em uso.

**Arquivos afetados:**

- `src/app/(admin)/admin/products/[id]/page.tsx`

**Ações:**

1. Exibir e permitir edição de `category` (Select com `MASTER_PRODUCT_CATEGORIES`) — sem restrição
2. Exibir e permitir edição de `fragmentavel` e `unidades_por_embalagem`
3. Verificar se o produto está em uso no inventário de algum tenant; se sim, desabilitar os campos `fragmentavel` e `unidades_por_embalagem` com aviso explicativo: "Este produto já está em uso no inventário de clínicas. As configurações de fragmentação não podem ser alteradas."

**Validação:** Produto existente exibe todos os campos. Categoria pode ser alterada livremente. Campos de fragmentação bloqueados com aviso quando produto está em uso.

**Commit:** `feat(admin): show and edit category and fragmentavel fields in product detail`

---

### STEP 6 — Atualizar listagem de produtos (Admin)

**Objetivo:** Refletir os novos campos na tabela de listagem.

**Arquivos afetados:**

- `src/app/(admin)/admin/products/page.tsx`

**Ações:**

1. Exibir nome completo usando `getNomeCompletoMasterProduct()` na coluna de nome
2. Adicionar badge visual "Fragmentável" nos produtos com `fragmentavel = true`
3. Adicionar coluna `category` na tabela
4. Adicionar filtro por categoria na listagem

**Validação:** Listagem exibe nomes corretos para ambos os tipos; filtro por categoria funciona.

**Commit:** `feat(admin): display full product name and fragmentavel badge in product list`

---

### STEP 7 — Atualizar adição de produtos ao inventário (Clínica)

**Objetivo:** Adaptar o formulário de entrada no inventário para produtos fragmentáveis.

**Arquivos afetados:**

- `src/app/(clinic)/clinic/add-products/page.tsx`

**Ações:**

1. Ao selecionar produto, verificar `masterProduct.fragmentavel`
2. Se fragmentável: alterar label do campo de quantidade para "Quantidade de embalagens"; exibir `{qtd} × {unidades_por_embalagem} = {total} UND` em tempo real; exibir valor por unidade calculado em tempo real
3. Usar `calcularQuantidadeInventario()` para montar o payload antes de salvar
4. Incluir os campos de auditoria (`quantidade_embalagens`, `valor_por_embalagem`, `fragmentavel`, `unidades_por_embalagem`) no documento do `InventoryItem`

**Validação:** Adicionar 2 caixas de produto com 60 UND → inventário registra `quantidade_inicial = 120` e `valor_unitario = valor_caixa / 60`. Produto não fragmentável mantém comportamento idêntico ao atual.

**Commit:** `feat(inventory): handle fragmentavel product entry with unit conversion`

---

### STEP 8 — Atualizar exibições de inventário, consultor e seletor de procedimento

**Objetivo:** Garantir que a informação de fragmentação seja exibida corretamente em todos os pontos de leitura.

**Arquivos afetados:**

- `src/app/(clinic)/clinic/inventory/page.tsx` — exibir quantidade no formato expandido
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx` — exibir info de fragmentação no detalhe
- `src/app/(clinic)/clinic/requests/new/page.tsx` — exibir nome completo no seletor
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` — mesmo ajuste da clínica

**Ações:**

1. Inventário (clínica e consultor): exibir `"120 UND (2 embalagens × 60)"` para fragmentáveis; quantidade simples para não fragmentáveis
2. Seletor de novo procedimento: exibir nome completo gerado por `getNomeCompletoMasterProduct()` e quantidade disponível em unidades
3. Adicionar badge ou indicador visual "Fragmentável" onde aplicável

**Validação:** UI exibe informações corretas para ambos os tipos; criar um procedimento com produto fragmentável funciona normalmente.

**Commit:** `feat(ui): display fragmentation info in inventory and procedure selector`

---

## 8. Estratégia de Testes

| Função                           | Arquivo de teste                             | Cenários obrigatórios                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getNomeCompletoMasterProduct()` | `src/__tests__/masterProductService.test.ts` | (1) Não fragmentável → retorna `product.name`; (2) Fragmentável com `unidades_por_embalagem = 60` → retorna `"{name} 60 UND"`; (3) Fragmentável sem `unidades_por_embalagem` → retorna `product.name`                                             |
| `calcularQuantidadeInventario()` | `src/__tests__/inventoryUtils.test.ts`       | (1) Não fragmentável → retorna valores intactos; (2) Fragmentável: `qtdInformada=2, unidades=60, valor=50` → `{quantidade_inicial: 120, valor_unitario: 0.8333...}`; (3) Fragmentável sem `unidadesPorEmbalagem` → fallback como não fragmentável |

Regras aplicadas:

- Funções puras com lógica de cálculo: **sempre testar**
- Componentes React, pages, API routes: **não testar no MVP**

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando
[ ] Multi-tenant: todas as queries Firestore de verificação de uso filtram por tenant_id
[ ] Segurança: nenhum secret ou credencial no código
[ ] Branch pessoal: feature/fragmentacao-produto-rennova mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] Criar produto fragmentável → campos salvos no Firestore (fragmentavel, unidades_por_embalagem, category)
[ ] Criar produto não fragmentável → campos de fragmentação ausentes ou false
[ ] Adicionar produto fragmentável ao inventário → quantidade_inicial em unidades, valor_unitario por unidade
[ ] Adicionar produto não fragmentável → comportamento idêntico ao atual
[ ] Procedimento consumindo produto fragmentável → deduz unidades corretamente de quantidade_disponivel
[ ] Relatório de consumo → valores financeiros corretos (por unidade)
[ ] Alerta de estoque baixo → baseado em unidades (sem alteração)
[ ] FEFO → funciona normalmente (sem alteração)
[ ] Consultor visualiza inventário → exibe info de fragmentação
[ ] Nenhuma referência a ".grupo" permanece no TypeScript
```

---

## 10. Riscos e Mitigações

| Risco                                                                                        | Probabilidade | Impacto | Mitigação                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| Arredondamento de `valor_unitario` na divisão (ex: R$50 ÷ 60 = 0,8333...)                    | Alta          | Médio   | Armazenar com no mínimo 4 casas decimais; exibir arredondado na UI                                                        |
| Editar `unidades_por_embalagem` após produto já no inventário gerar inconsistência histórica | Média         | Alto    | Bloquear edição na tela de detalhe do Admin se produto está em uso (verificar coleções `inventory` dos tenants)           |
| Produtos existentes no Firestore sem o campo `fragmentavel`                                  | Alta          | Baixo   | Tratar `fragmentavel: undefined` como `false` em todo o código via operador `??` ou verificação explícita                 |
| Confusão de UX no formulário de adição ao inventário                                         | Média         | Médio   | Label claro "Quantidade de embalagens"; preview do cálculo em tempo real; não alterar o formulário para não fragmentáveis |
| Referências remanescentes ao campo `grupo` em scripts ou código legacy                       | Baixa         | Baixo   | Busca global por `.grupo` antes do commit do STEP 1                                                                       |

---

## 11. Glossário

| Termo                    | Definição                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto fragmentável     | Produto adquirido em embalagem composta (ex: caixa) mas consumido por unidade individual nos procedimentos                                                  |
| `unidades_por_embalagem` | Número de unidades individuais contidas em cada embalagem (ex: 60 para uma caixa de 60 unidades)                                                            |
| `quantidade_embalagens`  | Campo de auditoria no `InventoryItem` — quantas embalagens foram compradas na entrada                                                                       |
| `valor_por_embalagem`    | Campo de auditoria no `InventoryItem` — valor pago por embalagem na nota fiscal                                                                             |
| `categoria` / `category` | Classificação do produto Rennova (ex: Preenchedores, Toxina, Fios de PDO) — o campo já existia no Firestore como `category`, mas o TypeScript usava `grupo` |
| FEFO                     | First Expired, First Out — estratégia de consumo que prioriza lotes com validade mais próxima                                                               |
| Master Product           | Produto do catálogo global Rennova gerenciado pelo system_admin; não pertence a nenhum tenant                                                               |

---

## 12. Referências

- `src/types/masterProduct.ts` — interface atual com campo `grupo` (a ser renomeado)
- `src/types/index.ts` — interface `InventoryItem` no contexto do módulo de types global
- `src/lib/services/inventoryService.ts` — interface `InventoryItem` e funções de inventário
- `src/lib/services/masterProductService.ts` — funções `createMasterProduct()` e `updateMasterProduct()`
- `src/__tests__/inventoryUtils.test.ts` — testes existentes de utilitários de inventário
- `firestore.indexes.json` — índices atuais (sem alteração necessária)
- `CLAUDE.md` — convenções do projeto, multi-tenant obrigatório
- Documento original: `ONLY_FOR_DEVS/Reestruturacao_Produto_Rennova_Fragmentacao.md`

---

## 13. Histórico de Versões

| Versão | Data       | Autor               | O que mudou                                                                                                       |
| ------ | ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1.0    | 30/04/2026 | Doc Writer (Claude) | Versão inicial — reorganização e padronização do documento original seguindo estrutura de 13 seções do doc-writer |
