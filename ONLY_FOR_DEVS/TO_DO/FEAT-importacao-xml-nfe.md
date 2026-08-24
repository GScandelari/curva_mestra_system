# Feature: Importação de NF-e via XML

**Projeto:** Curva Mestra
**Data:** 06/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/importacao-xml-nfe`
**Prioridade:** Alta
**Versão:** 2.0

> O sistema possui uma tela de upload de NF-e (`/clinic/upload`) com máquina de estados completa, mas cujo processamento chama uma rota de PDF desabilitada e cujo serviço de inventário é um stub. Esta feature substitui **completamente** essa estrutura por um módulo XML-only: remove os arquivos legados relacionados ao PDF, reescreve do zero o componente de upload, cria o parser XML com `fast-xml-parser` e implementa a gravação real de itens no Firestore. O impacto esperado é que clínicas consigam importar automaticamente produtos de uma NF-e SEFAZ v4.00 com dados estruturados e confiáveis, sem fallback para PDF.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/importacao-xml-nfe`
**PR target:** branch pessoal (`gscandelari_setup`) primeiro, depois PR para `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/importacao-xml-nfe
```

| Step   | Tipo   | Escopo      | Mensagem sugerida                                                                          |
| ------ | ------ | ----------- | ------------------------------------------------------------------------------------------ |
| STEP 1 | `chore`| `api`       | `chore(api): remove parse-nf route and legacy PDF references`                              |
| STEP 2 | `feat` | `types`     | `feat(types): extend NFProduct and ParsedNF for XML fields and add XmlParseError type`     |
| STEP 3 | `feat` | `api`       | `feat(api): add parseNfeXml library and parse-nf-xml route for SEFAZ NF-e XML`            |
| STEP 4 | `feat` | `inventory` | `feat(inventory): add getProductByCode to productService and addInventoryItems to inventoryService` |
| STEP 5 | `feat` | `inventory` | `feat(inventory): implement processNFAndAddToInventory with real Firestore writes`         |
| STEP 6 | `feat` | `ui`        | `feat(ui): rewrite FileUpload for XML-only, adapt upload page and add XML sub-step in add-products` |
| STEP 7 | `test` | `lib`       | `test(lib): add unit tests for parseNfeXml and convertXmlDate`                            |

**Lembrete:** PR vai para `gscandelari_setup` para validação no Firebase. Nunca merge direto para `master`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A tela `src/app/(clinic)/clinic/upload/page.tsx` existe com máquina de estados completa: `idle → uploading → processing → preview → confirming → success/error`. O fluxo executa três ações:

1. Chama `uploadNFFile` de `nfImportService.ts` para enviar o arquivo ao Firebase Storage.
2. Chama `/api/parse-nf` via `POST` com campo `files` (plural) no FormData para extrair produtos.
3. Após confirmação do usuário, chama `processNFAndAddToInventory` de `nfImportService.ts`.

Todos os três pontos estão com problemas:

- **`/api/parse-nf`** (`src/app/api/parse-nf/route.ts`): usa `pdf-parse` + regex sobre texto de PDF. O `CLAUDE.md` marca esta funcionalidade como **DESABILITADA permanentemente (por ora)**. O código contém `any` explícito e `console.log` de debug.

- **`processNFAndAddToInventory`** (`src/lib/services/nfImportService.ts`, linhas 182–213): é um **stub** com `// TODO: Implementar lógica de adição ao inventário`. Apenas atualiza o status para `success` sem gravar nenhum item no Firestore.

- **`FileUpload.tsx`** (`src/components/upload/FileUpload.tsx`): aceita somente `.pdf`. Validação `validateFile` rejeita qualquer `file.type` que não inclua `'pdf'`. Texto fixo "Arraste e solte o PDF da NF-e".

- **`inventoryService.ts`**: não possui nenhuma função de escrita. Apenas leitura: `listInventory`, `getInventoryItem`, `getInventoryStats`, `getExpiringProducts`, `getRecentActivity`, `getStockLimitsMap`, `updateStockLimit`, `calcularQuantidadeInventario`.

- **`productService.ts`**: possui `checkProductCodeExists(code)` mas **não possui** `getProductByCode(code)`, que é necessário para o matching por código durante a importação.

### 1.2 Problema identificado

- O formato XML da NF-e SEFAZ é estruturado, determinístico e parseável sem ambiguidade de layout. Não há motivo técnico para manter suporte a PDF.
- A NF-e real analisada (`nota_fiscal_27117.xml`) é versão 4.00, namespace `http://www.portalfiscal.inf.br/nfe`. Os campos de interesse estão em `<infNFe>`: número (`<nNF>`), emissão (`<dhEmi>`), fornecedor (`<emit>/<xNome>`), CNPJ (`<emit>/<CNPJ>`), e por produto em `<det>`: `<cProd>`, `<xProd>`, `<qCom>`, `<vUnCom>`, com rastreamento em `<rastro>`: `<nLote>`, `<dFab>`, `<dVal>`.
- A data de validade vem em `YYYY-MM-DD`. O tipo `NFProduct.dt_validade` é `string` com formato `DD/MM/YYYY`. Conversão explícita é necessária.
- O inventário nunca recebeu um item via importação de NF porque `processNFAndAddToInventory` é stub.
- Manter `/api/parse-nf/route.ts` como "referência histórica" (conforme o `CLAUDE.md` dizia) não agrega valor: o código tem `any` e debug logs. A decisão de produto é **remover**.

### 1.3 Motivação estratégica

Eliminar o cadastro manual de lotes após receber uma NF-e é o fluxo central do produto. O XML SEFAZ é o formato oficial e está disponível para download direto no portal da SEFAZ ou do ERP do fornecedor. A abordagem XML é determinística — sem OCR, sem regex sobre PDF — e deve ser a estratégia permanente e única de importação no MVP.

---

## 2. Objetivos

1. Remover `src/app/api/parse-nf/route.ts` e eliminar toda referência a PDF no fluxo de importação.
2. Reescrever `src/components/upload/FileUpload.tsx` do zero para aceitar apenas `.xml`.
3. Criar `src/lib/parseNfeXml.ts` com funções puras de parsing XML (testáveis em isolamento).
4. Criar `src/app/api/parse-nf-xml/route.ts` como endpoint servidor que retorna `ParsedNF`.
5. Adicionar `getProductByCode` em `productService.ts` para matching por código de produto.
6. Adicionar `addInventoryItems` em `inventoryService.ts` com `writeBatch` para atomicidade.
7. Reescrever `processNFAndAddToInventory` em `nfImportService.ts` com lógica real de gravação.
8. Adaptar `upload/page.tsx` para o novo fluxo XML: chamar `/api/parse-nf-xml`, pré-preencher `nfNumber` com `parsedNF.numero`, exibir `warnings` no preview.
9. Inserir sub-step de método em `add-products/page.tsx`: ao selecionar "Rennova", exibir escolha entre "Inserção Manual" e "Importar XML da NF-e" antes de continuar.
9. Garantir que toda gravação Firestore inclua `tenant_id` e use `tenants/{tenantId}/inventory`.
10. Adicionar testes unitários para `convertXmlDate` e `parseNfeXml`.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descrição                                                                                                                 | Ator         | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| RF-01 | O sistema deve aceitar upload de arquivo `.xml` na tela `/clinic/upload`                                                  | clinic_admin | Must       |
| RF-02 | O sistema deve rejeitar qualquer arquivo que não seja `.xml` com mensagem de erro clara                                   | system       | Must       |
| RF-03 | O sistema deve extrair todos os produtos do XML via `<det nItem="N">` e retornar como `ParsedNF`                         | system       | Must       |
| RF-04 | Campos extraídos por produto: `cProd`, `xProd`, `qCom`, `vUnCom`, `nLote`, `dVal`                                        | system       | Must       |
| RF-05 | `dVal` (formato `YYYY-MM-DD`) deve ser convertida para `DD/MM/YYYY` em `NFProduct.dt_validade`                           | system       | Must       |
| RF-06 | `nNF` e `emit/xNome` devem ser extraídos e disponibilizados em `ParsedNF`                                                | system       | Must       |
| RF-07 | O campo `nfNumber` no formulário deve ser pré-preenchido com `parsedNF.numero` extraído do XML                           | clinic_admin | Must       |
| RF-08 | O usuário deve visualizar preview dos produtos extraídos antes de confirmar a importação                                  | clinic_admin | Must       |
| RF-09 | Ao confirmar, cada produto deve ser gravado como item em `tenants/{tenantId}/inventory`                                   | system       | Must       |
| RF-10 | O sistema deve verificar se `cProd` existe no catálogo master (`products` global) por código exato                       | system       | Must       |
| RF-11 | Se `cProd` não existe no master, nenhum item é gravado e o status vira `novo_produto_pendente`                           | system       | Must       |
| RF-12 | Se produto master tiver `fragmentavel: true`, aplicar `calcularQuantidadeInventario` antes de gravar                     | system       | Should     |
| RF-13 | Cada `<rastro>` de um `<det>` deve gerar um `InventoryItem` separado com o mesmo `cProd`/`xProd` e lotes distintos      | system       | Must       |
| RF-14 | Produto sem `<rastro>` deve entrar no preview com `lote = 'NÃO_INFORMADO'`, `dt_validade = '31/12/2099'` e alerta visual | clinic_admin | Must       |
| RF-15 | O registro em `nf_imports` deve ser atualizado com `status`, `produtos_importados` e `parsed_data`                       | system       | Must       |

### 3.2 Requisitos Não Funcionais (RNF)

| ID     | Descrição                                                                                                          | Categoria        |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| RNF-01 | O parser XML deve processar uma NF-e com até 50 produtos em menos de 2 segundos                                    | Performance      |
| RNF-02 | Toda query Firestore deve incluir `tenant_id` via estrutura `tenants/{tenantId}/...`                               | Segurança        |
| RNF-03 | A API Route `/api/parse-nf-xml` deve rejeitar arquivos que não sejam `.xml` com status 400                         | Segurança        |
| RNF-04 | Nenhum dado sensível do XML deve ser logado em produção                                                            | Segurança        |
| RNF-05 | Erros de parsing devem retornar mensagem legível ao usuário — nunca stack trace                                     | Usabilidade      |
| RNF-06 | A inserção de múltiplos itens no inventário deve usar `writeBatch` para atomicidade                                | Manutenibilidade |
| RNF-07 | O código novo não deve introduzir `any` explícito — TypeScript estrito                                             | Manutenibilidade |
| RNF-08 | Não há suporte a PDF nesta feature. Nenhum fallback para `/api/parse-nf`                                           | Manutenibilidade |

### 3.3 Regras de Negócio (RN)

| ID    | Regra                                                                                                                                                   | Justificativa                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| RN-01 | Apenas usuários com `role === 'clinic_admin'` podem iniciar importação de NF                                                                            | Controle de acesso já implementado na UI via `isAdmin`              |
| RN-02 | Se qualquer `cProd` não existe em `products`, nenhum item é gravado no inventário e o status vira `novo_produto_pendente`                               | Garantia de integridade do catálogo master                          |
| RN-03 | Se o produto master tiver `fragmentavel: true` e `unidades_por_embalagem > 0`, `quantidade_inicial` e `valor_unitario` são recalculados via `calcularQuantidadeInventario` | Regra de fragmentação já implementada                               |
| RN-04 | `dt_validade` no Firestore deve ser armazenado como `Timestamp` (não string)                                                                            | Consistência com os demais campos de data do `InventoryItem`        |
| RN-05 | `dt_entrada` deve ser `serverTimestamp()` no momento da confirmação                                                                                     | Rastreabilidade da entrada de estoque                               |
| RN-06 | Cada `<rastro>` válido gera exatamente um `InventoryItem`. Múltiplos `<rastro>` por `<det>` geram itens separados com a mesma `qCom` e lotes distintos  | Regra fiscal: um produto pode ter múltiplos lotes em uma NF         |
| RN-07 | `nf_numero` do `InventoryItem` é preenchido com `<nNF>`; `nf_id` é o ID do documento em `nf_imports`                                                   | Rastreabilidade NF → inventário                                     |
| RN-08 | Produtos sem `<rastro>` entram com `lote = 'NÃO_INFORMADO'` e `dt_validade = '31/12/2099'`; campo `sem_rastro: true` sinaliza a condição para a UI     | Edge case: NF pode ter produtos não rastreados                      |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**Parser XML no lado servidor via API Route Next.js usando a biblioteca `fast-xml-parser` (v4.x).**

O parsing ocorre inteiramente no servidor com `export const runtime = 'nodejs'`, recebendo o arquivo via `FormData` (campo `file`, singular) e retornando JSON tipado como `{ parsedNF: ParsedNF; warnings: XmlParseError[] }`. A biblioteca `fast-xml-parser` suporta remoção de prefixos de namespace (`removeNSPrefix: true`) e configuração de arrays forçados (`isArray`), eliminando ambiguidade de leitura.

A rota antiga `/api/parse-nf` é **deletada**, não preservada. A rota nova `/api/parse-nf-xml` é criada do zero.

### 4.2 Alternativas descartadas

| Alternativa                         | Motivo do descarte                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Manter `/api/parse-nf` como referência | Código com `any` e `console.log`; sem valor de referência real; ocupa espaço e pode confundir devs futuros |
| Suporte a PDF no novo componente    | Decisão de produto: escopo é XML apenas. Adicionar PDF seria escopo expandido sem demanda               |
| `DOMParser` nativo do browser       | Não disponível no Node.js runtime sem polyfill                                                          |
| `xml2js`                            | API callback-first; mais verbosa; `fast-xml-parser` é mais ergonômico para TypeScript                   |
| Firebase Function para parsing      | Cold start desnecessário para parsing síncrono simples                                                  |
| Parsing no cliente (browser)        | Expõe lógica de validação; servidor deve ser único responsável por estruturar os dados                   |

### 4.3 Trade-offs aceitos

- **`fast-xml-parser` como dependência nova:** ~50KB server-side. Aceitável — roda apenas no servidor.
- **Nenhum item é gravado se qualquer produto não existir no master (RN-02):** comportamento conservador que pode frustrar a clínica ao receber produto novo. Trade-off deliberado: integridade do catálogo master tem prioridade no MVP.
- **`qCom` aplica a mesma quantidade para todos os `<rastro>` de um `<det>`:** o XML não divide a quantidade por lote. O dev deve documentar isso no preview da UI.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo                                 | Tipo           | Propósito                                                                           |
| --------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `src/lib/parseNfeXml.ts`                | Lib utilitária | Funções puras: `convertXmlDate`, `extractText`, `parseNfeXml` — testáveis          |
| `src/app/api/parse-nf-xml/route.ts`     | API Route      | Recebe XML via FormData, chama `parseNfeXml`, retorna `{ parsedNF, warnings }`     |

### 5.2 Arquivos a MODIFICAR

| Arquivo                                          | Natureza da mudança                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `src/types/nf.ts`                                | Adicionar `dt_fabricacao?`, `sem_rastro?` em `NFProduct`; adicionar `cnpj_fornecedor?` em `ParsedNF`; adicionar `XmlParseError` |
| `src/lib/services/productService.ts`             | Adicionar `getProductByCode(code: string): Promise<Product \| null>`                                                        |
| `src/lib/services/inventoryService.ts`           | Adicionar `AddInventoryItemsParams`, `addInventoryItems(params): Promise<void>`; adicionar `writeBatch` e `doc` nos imports |
| `src/lib/services/nfImportService.ts`            | Reescrever `processNFAndAddToInventory` do zero (remover stub); adicionar imports de `getProductByCode` e `addInventoryItems` |
| `src/components/upload/FileUpload.tsx`           | Reescrever do zero para aceitar apenas `.xml`                                                                               |
| `src/app/(clinic)/clinic/upload/page.tsx`        | Adaptar para fluxo XML: chamar `/api/parse-nf-xml`, pré-preencher `nfNumber`, adicionar estado `warnings`, remover referências a PDF |
| `src/app/(clinic)/clinic/add-products/page.tsx`  | Inserir sub-step de escolha de método após seleção de "Rennova": "Inserção Manual" ou "Importar XML da NF-e" (navega para `/clinic/upload`) |

### 5.3 Arquivos a REMOVER

| Arquivo                               | Motivo                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/app/api/parse-nf/route.ts`       | Rota desabilitada, código com `any` e debug logs, sem valor de referência; decisão de produto é deletar |

### 5.4 Impacto no Firestore

| Coleção                              | Ação           | Detalhes                                                                                          |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------- |
| `tenants/{tenantId}/inventory`       | CREATE (batch) | Cada produto confirmado gera um documento com todos os campos de `InventoryItem`                  |
| `tenants/{tenantId}/nf_imports`      | UPDATE         | Status atualizado para `success`, `novo_produto_pendente` ou `error`; `parsed_data` persistido   |
| `products` (global)                  | READ           | Consulta por `code` para matching de `cProd` da NF com catálogo master — sem escrita             |

### 5.5 O que NÃO muda

- Toda a lógica de autenticação e Custom Claims (`useAuth`, `useTenant`).
- A coleção `products` global e o serviço `productService.ts` — apenas leitura via nova função `getProductByCode`.
- O fluxo de máquina de estados da UI (`idle → uploading → processing → preview → confirming → success/error`) — a estrutura permanece; apenas o destino das chamadas muda.
- As funções existentes em `inventoryService.ts`: `listInventory`, `getInventoryItem`, `getInventoryStats`, `getExpiringProducts`, `getRecentActivity`, `getStockLimitsMap`, `updateStockLimit`, `calcularQuantidadeInventario`.
- As funções existentes em `nfImportService.ts`: `uploadNFFile`, `createNFImport`, `updateNFImportStatus`, `getNFImport`, `listNFImports`.
- As regras do Firestore (`firestore.rules`) e `firestore.indexes.json`.
- Os testes existentes em `src/__tests__/` — nenhum é afetado.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**`src/types/nf.ts` — estado atual (real, lido do arquivo):**

```ts
export interface NFProduct {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number;
  dt_validade: string; // formato DD/MM/YYYY
  valor_unitario: number;
}

export interface ParsedNF {
  numero: string;
  data_emissao?: string;
  fornecedor?: string;
  produtos: NFProduct[];
}
```

**`src/types/nf.ts` — estado novo:**

```ts
export interface NFProduct {
  codigo: string;           // cProd do XML
  nome_produto: string;     // xProd do XML (uppercase)
  lote: string;             // nLote do rastro; 'NÃO_INFORMADO' se ausente
  quantidade: number;       // qCom do XML (float)
  dt_validade: string;      // dVal convertido para DD/MM/YYYY; '31/12/2099' se ausente
  dt_fabricacao?: string;   // dFab convertido para DD/MM/YYYY (novo, opcional)
  valor_unitario: number;   // vUnCom do XML
  sem_rastro?: boolean;     // true quando <rastro> ausente no XML (novo)
}

export interface ParsedNF {
  numero: string;           // nNF
  data_emissao?: string;    // dhEmi (ISO 8601, mantido como string)
  fornecedor?: string;      // emit/xNome
  cnpj_fornecedor?: string; // emit/CNPJ (novo)
  produtos: NFProduct[];
}

// Novo: códigos tipados para erros de parsing
export type XmlParseErrorCode =
  | 'INVALID_FORMAT'       // arquivo não é XML ou namespace inválido
  | 'MISSING_NF_NUMBER'    // <nNF> ausente
  | 'NO_PRODUCTS_FOUND'    // nenhum <det> encontrado
  | 'MALFORMED_PRODUCT';   // <det> sem <cProd> ou <xProd>

export interface XmlParseError {
  code: XmlParseErrorCode;
  message: string;
  itemIndex?: number; // índice do <det> com problema, quando aplicável
}

// NFImport e NFImportCreate permanecem inalterados
```

**Nota:** `NFImport`, `NFImportCreate` e a interface `InventoryItem` em `inventoryService.ts` não precisam de alteração — todos os campos necessários já existem.

### 6.2 Novo arquivo: `src/lib/parseNfeXml.ts`

Apenas funções puras. Sem dependência de Firebase ou React. Máxima testabilidade.

```ts
import { XMLParser } from 'fast-xml-parser';
import type { ParsedNF, NFProduct, XmlParseError } from '@/types/nf';

/**
 * Converte data ISO 8601 (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss-HH:mm)
 * para DD/MM/YYYY.
 * Retorna '31/12/2099' se a string for inválida ou vazia.
 */
export function convertXmlDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '31/12/2099';
  const datePart = isoDate.substring(0, 10); // pega apenas YYYY-MM-DD
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day || year.length !== 4) return '31/12/2099';
  return `${day}/${month}/${year}`;
}

/**
 * Extrai o texto de um nó, independente do tipo (string ou número).
 */
export function extractText(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  return '';
}

/**
 * Parseia o conteúdo de uma NF-e SEFAZ v4.00 (string XML) e retorna ParsedNF.
 * Lança um objeto XmlParseError se o formato for inválido.
 * Retorna warnings para produtos com <rastro> ausente ou <det> malformados.
 */
export function parseNfeXml(xmlContent: string): { data: ParsedNF; errors: XmlParseError[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true, // remove prefixos como "nfe:"
    isArray: (tagName) => tagName === 'det' || tagName === 'rastro',
  });

  // fast-xml-parser não lança exceção por padrão — parse retorna objeto
  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  // Navegar até infNFe (pode estar em nfeProc/NFe/infNFe ou NFe/infNFe)
  const root = parsed as Record<string, Record<string, unknown>>;
  const nfe =
    (root?.nfeProc?.NFe as Record<string, unknown>)?.infNFe ??
    (root?.NFe as Record<string, unknown>)?.infNFe ??
    null;

  if (!nfe) {
    throw {
      code: 'INVALID_FORMAT',
      message: 'Arquivo não reconhecido como NF-e SEFAZ v4.00. Nó infNFe não encontrado.',
    } satisfies XmlParseError;
  }

  const ide = (nfe as Record<string, unknown>).ide ?? {};
  const emit = (nfe as Record<string, unknown>).emit ?? {};
  const numeroNF = extractText((ide as Record<string, unknown>).nNF);

  if (!numeroNF) {
    throw {
      code: 'MISSING_NF_NUMBER',
      message: 'Número da NF-e (<nNF>) não encontrado no XML.',
    } satisfies XmlParseError;
  }

  const detRaw = (nfe as Record<string, unknown>).det;
  const detArray: unknown[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  if (detArray.length === 0) {
    throw {
      code: 'NO_PRODUCTS_FOUND',
      message: 'Nenhum produto (<det>) encontrado no XML.',
    } satisfies XmlParseError;
  }

  const produtos: NFProduct[] = [];
  const errors: XmlParseError[] = [];

  detArray.forEach((det: unknown, index: number) => {
    const detObj = det as Record<string, unknown>;
    const prod = (detObj?.prod ?? {}) as Record<string, unknown>;
    const cProd = extractText(prod.cProd);
    const xProd = extractText(prod.xProd);

    if (!cProd || !xProd) {
      errors.push({
        code: 'MALFORMED_PRODUCT',
        message: `Produto no item ${index + 1} sem código (<cProd>) ou nome (<xProd>).`,
        itemIndex: index,
      });
      return;
    }

    const quantidade = parseFloat(extractText(prod.qCom)) || 0;
    const valorUnitario = parseFloat(extractText(prod.vUnCom)) || 0;

    const rastroRaw = prod.rastro;
    const rastros: unknown[] = Array.isArray(rastroRaw)
      ? rastroRaw
      : rastroRaw
        ? [rastroRaw]
        : [];

    if (rastros.length === 0) {
      produtos.push({
        codigo: cProd,
        nome_produto: xProd.toUpperCase(),
        lote: 'NÃO_INFORMADO',
        quantidade,
        dt_validade: '31/12/2099',
        valor_unitario: valorUnitario,
        sem_rastro: true,
      });
      return;
    }

    // Um produto pode ter múltiplos <rastro> — cada um gera um NFProduct separado
    rastros.forEach((rastro: unknown) => {
      const rastroObj = rastro as Record<string, unknown>;
      const nLote = extractText(rastroObj.nLote) || 'NÃO_INFORMADO';
      const dVal = convertXmlDate(extractText(rastroObj.dVal));
      const dFab = convertXmlDate(extractText(rastroObj.dFab));

      produtos.push({
        codigo: cProd,
        nome_produto: xProd.toUpperCase(),
        lote: nLote,
        quantidade,
        dt_validade: dVal,
        dt_fabricacao: dFab,
        valor_unitario: valorUnitario,
      });
    });
  });

  if (produtos.length === 0 && errors.length > 0) {
    throw {
      code: 'NO_PRODUCTS_FOUND',
      message: 'Nenhum produto válido pôde ser extraído do XML.',
    } satisfies XmlParseError;
  }

  return {
    data: {
      numero: extractText((ide as Record<string, unknown>).nNF),
      data_emissao: extractText((ide as Record<string, unknown>).dhEmi) || undefined,
      fornecedor: extractText((emit as Record<string, unknown>).xNome) || undefined,
      cnpj_fornecedor: extractText((emit as Record<string, unknown>).CNPJ) || undefined,
      produtos,
    },
    errors,
  };
}
```

### 6.3 Novo arquivo: `src/app/api/parse-nf-xml/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseNfeXml } from '@/lib/parseNfeXml';
import type { XmlParseError } from '@/types/nf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json(
        { error: 'Apenas arquivos XML são aceitos nesta rota' },
        { status: 400 }
      );
    }

    const xmlContent = await file.text();

    let result: ReturnType<typeof parseNfeXml>;
    try {
      result = parseNfeXml(xmlContent);
    } catch (parseError: unknown) {
      const msg =
        typeof parseError === 'object' &&
        parseError !== null &&
        'message' in parseError
          ? String((parseError as { message: string }).message)
          : 'Erro ao interpretar o XML da NF-e';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    return NextResponse.json({
      parsedNF: result.data,
      warnings: result.errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno ao processar o arquivo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

**FormData:** campo `file` (singular) contendo o arquivo `.xml`.

**Response 200:**
```ts
{ parsedNF: ParsedNF; warnings: XmlParseError[] }
```

**Response 400:** `{ error: 'Nenhum arquivo enviado' }` ou `{ error: 'Apenas arquivos XML são aceitos nesta rota' }`

**Response 422:** `{ error: string }` — XML malformado, namespace incorreto, sem produtos.

**Response 500:** `{ error: string }` — erro interno inesperado.

**Autenticação:** Nenhuma verificação de token na rota — autenticação é responsabilidade da UI via `useAuth` e `isAdmin`.

### 6.4 Modificação: `src/lib/services/productService.ts`

Adicionar ao final do arquivo, após `deleteProduct`. Os imports necessários (`collection`, `query`, `where`, `limit`, `getDocs`) já estão presentes no arquivo atual.

```ts
/**
 * Busca um produto do catálogo master pelo código exato.
 * Retorna null se não encontrado.
 */
export async function getProductByCode(code: string): Promise<Product | null> {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('code', '==', code), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Product;
  } catch (error) {
    console.error('Erro ao buscar produto por código:', error);
    throw error;
  }
}
```

**Observação:** O arquivo atual já importa `collection`, `getDocs`, `query`, `where` do `firebase/firestore`. Adicionar `limit` aos imports existentes se ainda não estiver presente — verificar antes de adicionar.

### 6.5 Modificação: `src/lib/services/inventoryService.ts`

Adicionar ao início do bloco de imports do firebase: `writeBatch` e (confirmar que `doc` já existe — está presente). Adicionar ao final do arquivo:

```ts
// Adicionar writeBatch nos imports do firebase/firestore existentes:
// import { ..., writeBatch } from 'firebase/firestore';

export interface AddInventoryItemsParams {
  tenantId: string;
  nfNumero: string;
  nfId: string;
  items: Array<{
    produto_id: string;             // ID do documento em /products
    codigo_produto: string;         // cProd
    nome_produto: string;           // xProd uppercase
    lote: string;
    quantidade: number;             // já convertida se fragmentável
    dt_validade: Date;              // já convertida para Date
    valor_unitario: number;         // já convertido se fragmentável
    category?: string;
    fragmentavel?: boolean;
    unidades_por_embalagem?: number;
    quantidade_embalagens?: number;
    valor_por_embalagem?: number;
  }>;
}

/**
 * Grava um lote de itens no inventário do tenant usando writeBatch para atomicidade.
 * Cada item recebe tenant_id, nf_numero, nf_id, dt_entrada (serverTimestamp), active: true.
 * writeBatch suporta até 500 operações — NF-es típicas têm < 50 itens.
 */
export async function addInventoryItems(params: AddInventoryItemsParams): Promise<void> {
  const { tenantId, nfNumero, nfId, items } = params;

  if (items.length === 0) return;

  const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
  const batch = writeBatch(db);

  for (const item of items) {
    const newDocRef = doc(inventoryRef);
    batch.set(newDocRef, {
      tenant_id: tenantId,
      produto_id: item.produto_id,
      codigo_produto: item.codigo_produto,
      nome_produto: item.nome_produto,
      lote: item.lote,
      quantidade_inicial: item.quantidade,
      quantidade_disponivel: item.quantidade,
      quantidade_reservada: 0,
      dt_validade: Timestamp.fromDate(item.dt_validade),
      dt_entrada: serverTimestamp(),
      valor_unitario: item.valor_unitario,
      nf_numero: nfNumero,
      nf_id: nfId,
      active: true,
      category: item.category ?? null,
      fragmentavel: item.fragmentavel ?? false,
      unidades_por_embalagem: item.unidades_por_embalagem ?? null,
      quantidade_embalagens: item.quantidade_embalagens ?? null,
      valor_por_embalagem: item.valor_por_embalagem ?? null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
}
```

**Nota sobre imports:** O arquivo atual importa `Timestamp`, `doc`, `serverTimestamp` e `collection` do `firebase/firestore`. Apenas `writeBatch` precisa ser adicionado à linha de import existente.

### 6.6 Modificação: `src/lib/services/nfImportService.ts`

Substituir a função `processNFAndAddToInventory` inteira (linhas 182–213 do arquivo atual) pela implementação abaixo. Adicionar os imports no topo do arquivo.

**Imports a adicionar no topo:**
```ts
import { getProductByCode } from '@/lib/services/productService';
import { addInventoryItems, calcularQuantidadeInventario } from '@/lib/services/inventoryService';
import type { AddInventoryItemsParams } from '@/lib/services/inventoryService';
```

**Nova implementação de `processNFAndAddToInventory`:**

```ts
/**
 * Processa NF confirmada pelo usuário e grava produtos no inventário.
 *
 * Fluxo:
 *   1. Marca import como 'processing'.
 *   2. Para cada NFProduct, busca no catálogo master por código exato (cProd).
 *   3. Se qualquer produto não existe no master, aborta e marca como 'novo_produto_pendente'.
 *   4. Se todos existem, aplica calcularQuantidadeInventario (fragmentação) e chama addInventoryItems.
 *   5. Marca import como 'success'.
 */
export async function processNFAndAddToInventory(
  tenantId: string,
  importId: string,
  parsedData: ParsedNF
): Promise<{ success: boolean; message: string }> {
  try {
    await updateNFImportStatus(tenantId, importId, 'processing');

    type ResolvedItem = AddInventoryItemsParams['items'][number];
    const resolvedItems: ResolvedItem[] = [];
    const produtosNovos: string[] = [];

    for (const produto of parsedData.produtos) {
      const masterProduct = await getProductByCode(produto.codigo);

      if (!masterProduct) {
        produtosNovos.push(produto.codigo);
        continue;
      }

      // Converter dt_validade de DD/MM/YYYY para Date
      const [day, month, year] = produto.dt_validade.split('/').map(Number);
      const dtValidade = new Date(year, month - 1, day);

      // masterProduct pode ter campos extras não tipados na interface Product base
      const masterAny = masterProduct as Record<string, unknown>;
      const fragmentavel = Boolean(masterAny.fragmentavel);
      const unidadesPorEmbalagem = masterAny.unidades_por_embalagem as number | undefined;

      const { quantidade_inicial, valor_unitario } = calcularQuantidadeInventario({
        quantidadeInformada: produto.quantidade,
        fragmentavel,
        unidadesPorEmbalagem,
        valorInformado: produto.valor_unitario,
      });

      resolvedItems.push({
        produto_id: masterProduct.id,
        codigo_produto: produto.codigo,
        nome_produto: produto.nome_produto,
        lote: produto.lote,
        quantidade: quantidade_inicial,
        dt_validade: dtValidade,
        valor_unitario,
        category: masterAny.category as string | undefined,
        fragmentavel,
        unidades_por_embalagem: unidadesPorEmbalagem,
        quantidade_embalagens: fragmentavel ? produto.quantidade : undefined,
        valor_por_embalagem: fragmentavel ? produto.valor_unitario : undefined,
      });
    }

    if (produtosNovos.length > 0) {
      await updateNFImportStatus(tenantId, importId, 'novo_produto_pendente', {
        produtos_importados: 0,
        produtos_novos: produtosNovos.length,
        parsed_data: parsedData,
        error_message: `Produtos não encontrados no catálogo master: ${produtosNovos.join(', ')}`,
      });

      return {
        success: false,
        message: `${produtosNovos.length} produto(s) não encontrado(s) no catálogo master. Solicite ao administrador que cadastre os produtos antes de reimportar.`,
      };
    }

    await addInventoryItems({
      tenantId,
      nfNumero: parsedData.numero,
      nfId: importId,
      items: resolvedItems,
    });

    await updateNFImportStatus(tenantId, importId, 'success', {
      produtos_importados: resolvedItems.length,
      produtos_novos: 0,
      parsed_data: parsedData,
    });

    return {
      success: true,
      message: `${resolvedItems.length} produto(s) adicionado(s) ao estoque com sucesso.`,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao processar NF';
    await updateNFImportStatus(tenantId, importId, 'error', {
      error_message: msg,
    });
    return { success: false, message: msg };
  }
}
```

### 6.7 Reescrita: `src/components/upload/FileUpload.tsx`

O arquivo atual aceita apenas PDF. Reescrever **completamente** para XML-only.

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function FileUpload({
  onFileSelect,
  accept = '.xml',
  maxSizeMB = 10,
  disabled = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const validateFile = (file: File): boolean => {
    setError('');

    // Aceitar XML — alguns sistemas enviam application/octet-stream para XML
    const isXml =
      file.type.includes('xml') ||
      file.name.toLowerCase().endsWith('.xml');

    if (!isXml) {
      setError('Apenas arquivos XML da NF-e são permitidos');
      return false;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`Arquivo muito grande. Máximo: ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-all ${
          dragActive
            ? 'border-primary bg-primary/5'
            : error
              ? 'border-destructive'
              : 'border-muted-foreground/25'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div
              className={`rounded-full p-4 ${
                error ? 'bg-destructive/10' : dragActive ? 'bg-primary/10' : 'bg-muted'
              }`}
            >
              {error ? (
                <AlertCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Upload
                  className={`h-8 w-8 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`}
                />
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-lg font-medium">
                {dragActive
                  ? 'Solte o arquivo aqui'
                  : selectedFile
                    ? 'Arquivo selecionado'
                    : 'Arraste e solte o XML da NF-e'}
              </p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">
                Formato: XML (NF-e SEFAZ) • Maximo: {maxSizeMB}MB
              </p>
            </div>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept={accept}
              onChange={handleChange}
              disabled={disabled}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={disabled}
            >
              Selecionar Arquivo
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p>{error}</p>
        </div>
      )}

      {selectedFile && !error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                <File className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 6.8 Modificação: `src/app/(clinic)/clinic/upload/page.tsx`

As mudanças são cirúrgicas. O arquivo atual tem 579 linhas; descreve-se cada alteração com localização precisa.

**1. Imports a adicionar/alterar:**
```ts
// Adicionar ao bloco de imports de tipos:
import type { ParsedNF, XmlParseError } from '@/types/nf';
// Remover o import antigo: import type { ParsedNF } from '@/types/nf';
```

**2. Novo estado `warnings` (após `const [parsedData, setParsedData] = useState<ParsedNF | null>(null);`):**
```ts
const [warnings, setWarnings] = useState<XmlParseError[]>([]);
```

**3. Substituir o bloco `// 3. Processar PDF usando a API real` dentro de `handleUpload` (linhas 136–180 do arquivo atual):**

```ts
// 3. Processar XML usando a API NF-e
try {
  const formData = new FormData();
  formData.append('file', selectedFile); // campo 'file', singular

  const response = await fetch('/api/parse-nf-xml', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error || 'Erro ao processar XML da NF-e');
  }

  const parseResult = (await response.json()) as {
    parsedNF: ParsedNF;
    warnings: XmlParseError[];
  };

  if (!parseResult.parsedNF || parseResult.parsedNF.produtos.length === 0) {
    throw new Error('Nenhum produto foi encontrado no XML. Verifique se o arquivo é uma NF-e SEFAZ válida.');
  }

  setParsedData(parseResult.parsedNF);

  // Pré-preencher número da NF com o valor extraído do XML
  if (parseResult.parsedNF.numero) {
    setNfNumber(parseResult.parsedNF.numero);
  }

  if (parseResult.warnings && parseResult.warnings.length > 0) {
    setWarnings(parseResult.warnings);
  }
} catch (parseError: unknown) {
  const msg =
    parseError instanceof Error
      ? parseError.message
      : 'Erro ao processar o XML da NF-e';
  setError(msg);
  setUploadStatus('error');
  return;
}
```

**4. Atualizar `resetUpload` para limpar `warnings`:**
```ts
const resetUpload = () => {
  setSelectedFile(null);
  setNfNumber('');
  setUploadStatus('idle');
  setError('');
  setImportId('');
  setParsedData(null);
  setUploadProgress(0);
  setWarnings([]); // novo
};
```

**5. Adicionar exibição de warnings no bloco de preview (`uploadStatus === 'preview'`):**

Inserir antes do `<Alert>` de atenção existente (após a lista de produtos):

```tsx
{/* Avisos sobre produtos sem rastreamento */}
{warnings.length > 0 && (
  <Alert>
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Aviso sobre rastreamento</AlertTitle>
    <AlertDescription>
      {warnings.length} produto(s) no XML nao possuem informacao de lote ({`<rastro>`}).
      Eles serao importados com lote &quot;NAO_INFORMADO&quot; e validade 31/12/2099.
    </AlertDescription>
  </Alert>
)}
```

**6. Atualizar textos do header da tela (linhas 244–246 do arquivo atual):**
```tsx
<h2 className="text-3xl font-bold tracking-tight">Upload de NF-e</h2>
<p className="text-muted-foreground">Importar produtos via XML da Nota Fiscal Eletronica</p>
```

**7. Atualizar `CardDescription` do form idle (linha 254 do arquivo atual):**
```tsx
<CardDescription>
  Faca upload do XML da NF-e para importar os produtos automaticamente
</CardDescription>
```

**8. Remover a funcao `simulateOCRProcessing`** (linhas 219–221) — nao e mais utilizada.

**9. Atualizar o texto do bloco `processing` para refletir XML em vez de PDF:**
```tsx
<div className="flex items-center gap-2 text-sm">
  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
  Lendo arquivo XML...
</div>
<div className="flex items-center gap-2 text-sm">
  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
  Extraindo dados dos produtos...
</div>
<div className="flex items-center gap-2 text-sm">
  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
  Validando informacoes...
</div>
```

---

### 6.9 Modificação: `src/app/(clinic)/clinic/add-products/page.tsx`

**Decisão de UX (Opção B confirmada):** ao clicar em "Adicionar Produtos Rennova", o usuário vê uma sub-escolha de método antes de avançar para o step de número de NF. A opção "Outra Marca" continua sem sub-step.

**Novo fluxo completo:**

```
Step 1: Tipo
  ├── "Rennova" →  Sub-step: Método
  │                  ├── "Inserção Manual"     → Step 2: Nº NF → Step 3: Produtos → Step 4: Revisão
  │                  └── "Importar XML da NF-e" → router.push('/clinic/upload')
  └── "Outras Marcas" → Step 2: Nº NF → Step 3: Produtos → Step 4: Revisão
```

**Alterações no arquivo (`ManualNFPage`):**

**1. Novo tipo no estado `step`:**
```ts
// Antes:
const [step, setStep] = useState<'select_type' | 'enter_nf' | 'add_products' | 'review'>('select_type');

// Depois:
const [step, setStep] = useState<'select_type' | 'select_method' | 'enter_nf' | 'add_products' | 'review'>('select_type');
```

**2. Atualizar `handleSelectType`:**
```ts
const handleSelectType = (type: 'rennova' | 'outra_marca') => {
  setTipoNF(type);
  if (type === 'rennova') {
    setStep('select_method'); // sub-step apenas para Rennova
  } else {
    setStep('enter_nf');
  }
};
```

**3. Novo bloco de renderização para `select_method` (inserir após o bloco `select_type`):**
```tsx
{step === 'select_method' && (
  <Card>
    <CardHeader>
      <CardTitle>Como deseja adicionar os produtos Rennova?</CardTitle>
      <CardDescription>
        Escolha entre cadastro manual ou importação automática via XML da NF-e
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          variant="outline"
          className="h-32 flex-col gap-2 text-base"
          onClick={() => setStep('enter_nf')}
        >
          <span className="font-semibold">Inserção Manual</span>
          <span className="text-xs text-muted-foreground font-normal">
            Informe os dados produto a produto
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-32 flex-col gap-2 text-base"
          onClick={() => router.push('/clinic/upload')}
        >
          <span className="font-semibold">Importar XML da NF-e</span>
          <span className="text-xs text-muted-foreground font-normal">
            Faça upload do XML e os dados são preenchidos automaticamente
          </span>
        </Button>
      </div>
      <div className="flex justify-start mt-4">
        <Button variant="ghost" size="sm" onClick={() => setStep('select_type')}>
          ← Voltar
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

**4. Atualizar `getStepNumber` para incluir o novo step:**
```ts
const getStepNumber = () => {
  switch (step) {
    case 'select_type':
    case 'select_method': // sub-step visual, conta como step 1
      return 1;
    case 'enter_nf':
      return 2;
    case 'add_products':
      return 3;
    case 'review':
      return 4;
    default:
      return 1;
  }
};
```

**5. Botão "Voltar" no step `enter_nf`:** ao voltar de `enter_nf`, o destino depende do tipo:
```ts
// No bloco enter_nf, botão Voltar:
<Button variant="outline" onClick={() => setStep(tipoNF === 'rennova' ? 'select_method' : 'select_type')}>
  Voltar
</Button>
```

**O que NÃO muda em `add-products/page.tsx`:** toda a lógica de steps `enter_nf`, `add_products` e `review`, a função `handleSaveNF`, os campos do formulário manual e o `loadMasterProducts`. A única mudança é a inserção do `select_method` para Rennova.

---

## 7. Plano de Implementação

### STEP 1 — Remover rota legada de PDF

**Objetivo:** Eliminar o arquivo `src/app/api/parse-nf/route.ts` e atualizar o `CLAUDE.md` para refletir que o arquivo foi removido (nao apenas "desabilitado").

**Arquivos afetados:**
- `src/app/api/parse-nf/route.ts` — deletar
- `CLAUDE.md` — atualizar secao "Funcionalidades Desabilitadas" para registrar que a rota foi removida nesta task

**Acoes:**
1. Verificar se algum arquivo importa ou referencia `/api/parse-nf` alem de `upload/page.tsx`.
2. Deletar `src/app/api/parse-nf/route.ts`.
3. No `CLAUDE.md`, alterar a secao `### Importacao de PDF (DANFE Rennova)` para indicar que `src/app/api/parse-nf/route.ts` foi **removido** na feature `importacao-xml-nfe`.
4. Executar `npm run build` para confirmar que nenhum modulo dependia da rota deletada.

**Validacao:** `ls src/app/api/` nao lista `parse-nf/`. `npm run build` sem erros.

**Commit:** `chore(api): remove parse-nf route and legacy PDF references`

---

### STEP 2 — Atualizar tipos

**Objetivo:** Estender `src/types/nf.ts` com os novos campos e adicionar `XmlParseError`.

**Arquivos afetados:**
- `src/types/nf.ts` — modificar

**Acoes:**
1. Adicionar campos opcionais `dt_fabricacao?: string` e `sem_rastro?: boolean` a interface `NFProduct`.
2. Adicionar campo opcional `cnpj_fornecedor?: string` a interface `ParsedNF`.
3. Adicionar o tipo `XmlParseErrorCode` (union) e a interface `XmlParseError` conforme secao 6.1.
4. Executar `npm run type-check` — zero erros esperados (campos opcionais nao quebram codigo existente).

**Validacao:** `npm run type-check` passa. O arquivo exporta `XmlParseError` e `XmlParseErrorCode`.

**Commit:** `feat(types): extend NFProduct and ParsedNF for XML fields and add XmlParseError type`

---

### STEP 3 — Criar biblioteca de parsing e API Route

**Objetivo:** Criar `parseNfeXml.ts` com funcoes puras e a nova API Route `/api/parse-nf-xml`.

**Arquivos afetados:**
- `src/lib/parseNfeXml.ts` — criar do zero
- `src/app/api/parse-nf-xml/route.ts` — criar do zero

**Acoes:**
1. Verificar se `fast-xml-parser` ja esta instalada: `npm ls fast-xml-parser`.
2. Se nao: `npm install fast-xml-parser` — adicionar em `dependencies` (nao `devDependencies`).
3. Criar `src/lib/parseNfeXml.ts` com `convertXmlDate`, `extractText`, `parseNfeXml` conforme secao 6.2.
4. Criar diretorio `src/app/api/parse-nf-xml/` e o arquivo `route.ts` conforme secao 6.3.
5. Executar `npm run type-check` e `npm run lint`.
6. Testar manualmente: `curl -X POST http://localhost:3000/api/parse-nf-xml -F "file=@nota_fiscal_27117.xml"` e verificar resposta 200 com 7 produtos.
7. Testar com arquivo invalido (ex: JSON renomeado como .xml) e verificar resposta 422.

**Validacao:** POST com `nota_fiscal_27117.xml` retorna `parsedNF.numero === '27117'` e `parsedNF.produtos.length === 7`. POST com arquivo de texto retorna 422.

**Commit:** `feat(api): add parseNfeXml library and parse-nf-xml route for SEFAZ NF-e XML`

---

### STEP 4 — Adicionar `getProductByCode` e `addInventoryItems`

**Objetivo:** Criar as dependencias necessarias para o processamento real de NF.

**Arquivos afetados:**
- `src/lib/services/productService.ts` — adicionar `getProductByCode`
- `src/lib/services/inventoryService.ts` — adicionar `AddInventoryItemsParams` e `addInventoryItems`; adicionar `writeBatch` nos imports

**Acoes:**
1. Em `productService.ts`, adicionar `getProductByCode` conforme secao 6.4. Verificar se `limit` ja esta nos imports do arquivo — se nao, adicionar.
2. Em `inventoryService.ts`, adicionar `writeBatch` na linha de imports do `firebase/firestore` existente.
3. Adicionar `AddInventoryItemsParams` e `addInventoryItems` conforme secao 6.5.
4. Executar `npm run type-check` e `npm run lint`.
5. Testar nos emuladores Firebase: chamar `getProductByCode('3076528')` (codigo real da NF de teste) e verificar retorno.

**Validacao:** `npm run type-check` zero erros. `getProductByCode` retorna `Product | null`. `addInventoryItems` com dados mock grava documentos em `tenants/{tenantId}/inventory` no emulador.

**Commit:** `feat(inventory): add getProductByCode to productService and addInventoryItems to inventoryService`

---

### STEP 5 — Implementar `processNFAndAddToInventory`

**Objetivo:** Substituir o stub por implementacao real que orquestra matching, calculo de fragmentacao e gravacao.

**Arquivos afetados:**
- `src/lib/services/nfImportService.ts` — reescrever `processNFAndAddToInventory`; adicionar imports

**Acoes:**
1. Adicionar imports de `getProductByCode`, `addInventoryItems`, `calcularQuantidadeInventario` e `AddInventoryItemsParams` no topo do arquivo conforme secao 6.6.
2. Substituir todo o corpo da funcao `processNFAndAddToInventory` (linhas 182–213) pela nova implementacao da secao 6.6.
3. Remover o `any` do catch existente (substituido por `unknown` com narrowing).
4. Executar `npm run type-check` e `npm run lint`.
5. Testar end-to-end nos emuladores: importar `nota_fiscal_27117.xml` com todos os 7 produtos cadastrados no master → verificar que `nf_imports/{id}.status === 'success'` e que 7 documentos aparecem em `tenants/{tenantId}/inventory`.
6. Testar com 1 produto faltando no master → verificar `status: 'novo_produto_pendente'` e nenhum item no inventario.

**Validacao:** Fluxo de sucesso grava `N` documentos no inventario e `N` corresponde ao numero de produtos na NF. Fluxo de produto faltante nao grava nada no inventario.

**Commit:** `feat(inventory): implement processNFAndAddToInventory with real Firestore writes`

---

### STEP 6 — Reescrever FileUpload, adaptar upload/page.tsx e inserir sub-step em add-products

**Objetivo:** Entregar o fluxo XML completo na UI e expor o ponto de entrada via sub-step de método em `add-products`.

**Arquivos afetados:**
- `src/components/upload/FileUpload.tsx` — reescrever do zero
- `src/app/(clinic)/clinic/upload/page.tsx` — modificacoes cirurgicas
- `src/app/(clinic)/clinic/add-products/page.tsx` — inserir sub-step `select_method`

**Acoes:**

**FileUpload.tsx:**
1. Substituir o conteudo inteiro do arquivo pela versao da secao 6.7 (aceita apenas `.xml`).
2. Confirmar que a prop `accept` default mudou de `'.pdf'` para `'.xml'`.

**upload/page.tsx:**
1. Adicionar `XmlParseError` ao import de `@/types/nf`.
2. Adicionar estado `const [warnings, setWarnings] = useState<XmlParseError[]>([])`.
3. Substituir o bloco de processamento dentro de `handleUpload` pelo novo bloco da secao 6.8.
4. Atualizar `resetUpload` para incluir `setWarnings([])`.
5. Adicionar bloco de warnings no preview conforme secao 6.8.
6. Atualizar textos do header, CardDescription e bloco de processing conforme secao 6.8.
7. Remover a funcao `simulateOCRProcessing` — nao e mais utilizada.

**add-products/page.tsx:**
1. Adicionar `'select_method'` ao tipo do estado `step`.
2. Atualizar `handleSelectType`: Rennova vai para `select_method`; Outra Marca vai direto para `enter_nf`.
3. Inserir o bloco JSX de `select_method` apos o bloco `select_type` conforme secao 6.9.
4. Atualizar `getStepNumber` para mapear `select_method` → `1`.
5. Atualizar botao "Voltar" do step `enter_nf` para retornar a `select_method` quando `tipoNF === 'rennova'`.
6. Executar `npm run lint` e `npm run type-check`.

**Validacao:**
- Em `add-products`: clicar em "Rennova" exibe o sub-step com dois cards; clicar em "Importar XML da NF-e" navega para `/clinic/upload`; clicar em "Insercao Manual" avanca para o step de no NF normalmente.
- Em `add-products`: clicar em "Outras Marcas" vai direto para o step de no NF (sem sub-step).
- Upload de `nota_fiscal_27117.xml` em `/clinic/upload` → preview com 7 produtos → `nfNumber` pre-preenchido com `'27117'` → confirmar → sucesso.
- Upload de arquivo `.pdf` em `/clinic/upload` → erro de validacao no `FileUpload`.

**Commit:** `feat(ui): rewrite FileUpload for XML-only, adapt upload page and add XML sub-step in add-products`

---

### STEP 7 — Testes unitarios

**Objetivo:** Garantir cobertura de `convertXmlDate` e `parseNfeXml` com os cenarios criticos.

**Arquivos afetados:**
- `src/__tests__/parseNfeXml.test.ts` — criar do zero

**Acoes:**
1. Criar `src/__tests__/parseNfeXml.test.ts` com os cenarios da secao 8.
2. Executar `npm run test` e garantir que todos os testes passam.

**Validacao:** `npm run test` passa com zero falhas. Todos os cenarios da secao 8 cobertos.

**Commit:** `test(lib): add unit tests for parseNfeXml and convertXmlDate`

---

## 8. Estratégia de Testes

| Funcao           | Arquivo de teste                         | Cenarios obrigatorios                                                                                                                                                                                              |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `convertXmlDate` | `src/__tests__/parseNfeXml.test.ts`      | (1) `'2029-12-01'` → `'01/12/2029'`; (2) `'2025-03-31T17:52:00-03:00'` → `'31/03/2025'`; (3) `undefined` → `'31/12/2099'`; (4) `''` → `'31/12/2099'`; (5) string malformada `'invalid'` → `'31/12/2099'`      |
| `parseNfeXml`    | `src/__tests__/parseNfeXml.test.ts`      | (1) XML valido com 7 produtos com rastro → `produtos.length === 7`, `numero === '27117'`; (2) XML com produto sem `<rastro>` → `lote === 'NÃO_INFORMADO'` e `sem_rastro === true`; (3) XML com multiplos `<rastro>` por `<det>` → cada rastro gera item separado; (4) XML sem `<infNFe>` → lanca `XmlParseError` com `code === 'INVALID_FORMAT'`; (5) XML com `<det>` sem `<cProd>` → erro em `errors[]`, produto nao entra em `data.produtos`; (6) String vazia → lanca com `code === 'INVALID_FORMAT'` |

**Regras aplicadas:**
- `convertXmlDate` e `parseNfeXml` sao funcoes puras — **sempre testar**.
- `addInventoryItems`, `processNFAndAddToInventory`, `getProductByCode`: dependem do Firebase — **nao testar no MVP** (validar via emuladores manualmente).
- API Route `/api/parse-nf-xml`: componente Next.js server — **nao testar no MVP**.
- `FileUpload.tsx` e `upload/page.tsx`: componentes React — **nao testar no MVP**.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de producao sem falhas
[ ] npm run test        — todos os testes passando (incluindo 6 novos de parseNfeXml)
[ ] src/app/api/parse-nf/route.ts REMOVIDO (nao apenas comentado)
[ ] CLAUDE.md atualizado para refletir remocao da rota parse-nf
[ ] fast-xml-parser em dependencies (nao devDependencies) — verificar package.json
[ ] FileUpload.tsx aceita APENAS .xml — validacao rejeita .pdf explicitamente
[ ] getProductByCode adicionado e exportado em productService.ts
[ ] addInventoryItems adicionado e exportado em inventoryService.ts
[ ] processNFAndAddToInventory NAO e mais stub — grava itens reais no Firestore
[ ] Multi-tenant: addInventoryItems sempre usa tenants/{tenantId}/inventory
[ ] Multi-tenant: getProductByCode le de /products (colecao global, sem tenant_id — correto)
[ ] Segurança: API Route valida extensao .xml antes de processar
[ ] upload/page.tsx chama APENAS /api/parse-nf-xml — sem referencia a /api/parse-nf
[ ] Campo nfNumber pre-preenchido com parsedNF.numero extraido do XML
[ ] Produtos sem <rastro> exibem aviso no preview (nao bloqueiam o fluxo)
[ ] Status novo_produto_pendente exibe mensagem com os codigos faltantes
[ ] Nao ha any explicito no codigo novo
[ ] UX Opcao B: clicar em "Rennova" em add-products exibe sub-step com dois cards
[ ] UX Opcao B: "Importar XML da NF-e" navega para /clinic/upload
[ ] UX Opcao B: "Insercao Manual" avanca para o step de numero NF normalmente
[ ] UX Opcao B: "Outras Marcas" vai direto para step de numero NF (sem sub-step)
[ ] UX Opcao B: botao Voltar em enter_nf retorna a select_method quando tipoNF === 'rennova'
[ ] Branch pessoal: task branch mergeada na branch pessoal para validacao no Firebase
[ ] PR: aberto para gscandelari_setup com template preenchido
```

---

## 10. Riscos e Mitigações

| Risco                                                                                             | Probabilidade | Impacto | Mitigacao                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| NF-e com namespace prefixado (ex: `nfe:`) quebra o parser                                        | Media         | Alto    | `fast-xml-parser` configurado com `removeNSPrefix: true` remove prefixos automaticamente. Testar com multiplas NF-es reais.          |
| `cProd` com zeros a esquerda nao bate com `code` no master (ex: `007123` vs `7123`)              | Media         | Alto    | `getProductByCode` usa `code` como string exata. Padrao de cadastro no master deve ser sem zeros a esquerda. Documentar na UI.       |
| Multiplos `<rastro>` por produto duplica a quantidade total importada                             | Baixa         | Medio   | Regra RN-06: cada `<rastro>` usa a mesma `qCom` do `<det>` pai. Documentar no preview da UI para que o admin entenda o comportamento.|
| `writeBatch` suporta ate 500 operacoes por batch                                                  | Baixa         | Baixo   | NF-es tipicas tem < 50 produtos. Para futuro, dividir em batches de 499 se necessario.                                               |
| `fast-xml-parser` nao instalado no ambiente CI                                                    | Baixa         | Alto    | Adicionar em `dependencies` no STEP 3. Verificar `npm ls fast-xml-parser` antes do primeiro commit.                                  |
| Upload de XML falha no Firebase Storage por configuracao de MIME type                             | Baixa         | Medio   | Storage aceita qualquer MIME type por padrao. `firestore.rules` nao tem restricao de tipo de arquivo para Storage.                   |
| Usuario faz upload de PDF renomeado como `.xml` → parser retorna 422                             | Media         | Baixo   | Mensagem de erro do 422 e exibida na UI. Usuario recebe instrucao para verificar o arquivo.                                          |
| Remocao de `parse-nf/route.ts` quebra outro modulo que nao foi identificado                      | Baixa         | Alto    | STEP 1 inclui busca explicita por referencias ao arquivo antes de deletar. `npm run build` confirma ausencia de dependencias.         |

---

## 11. Glossário

| Termo                   | Definicao                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| NF-e                    | Nota Fiscal eletronica — documento fiscal digital padrao brasileiro (SEFAZ)                                                       |
| SEFAZ                   | Secretaria da Fazenda — orgao estadual que regula e valida NF-e                                                                    |
| DANFE                   | Documento Auxiliar da NF-e — representacao visual em PDF da NF-e para acompanhamento fisico (nao utilizado nesta feature)         |
| XML NF-e v4.00          | Formato XML estruturado da NF-e, namespace `http://www.portalfiscal.inf.br/nfe`, definido pelo Manual de Orientacao do Contribuinte |
| `<det>`                 | Elemento XML que representa um item (produto) na NF-e. Atributo `nItem` identifica a posicao                                      |
| `<rastro>`              | Elemento XML filho de `<prod>` com lote (`nLote`), fabricacao (`dFab`) e validade (`dVal`) do produto rastreado                   |
| `cProd`                 | Codigo interno do produto no ERP do fornecedor. Usado para matching com catálogo master                                           |
| `xProd`                 | Descricao/nome do produto no XML                                                                                                   |
| `qCom`                  | Quantidade comercial do produto no XML (float, ex: `24.0000`)                                                                     |
| `vUnCom`                | Valor unitario comercial do produto no XML (float, ex: `13.2500000000`)                                                           |
| catalogo master         | Colecao global `products` no Firestore, gerenciada pelo `system_admin`. Fonte de verdade de produtos cadastrados                   |
| fragmentavel            | Flag do produto master que indica se uma embalagem deve ser dividida em unidades menores para controle de estoque                  |
| `novo_produto_pendente` | Status de `nf_import` quando ao menos um `cProd` da NF nao existe no catalogo master                                             |
| writeBatch              | API do Firestore para gravacao atomica de multiplos documentos em uma unica transacao (ate 500 operacoes)                         |

---

## 12. Referências

- `src/app/(clinic)/clinic/upload/page.tsx` — UI completa com maquina de estados (579 linhas)
- `src/lib/services/nfImportService.ts` — stub de `processNFAndAddToInventory` a ser reescrito (linhas 182–213)
- `src/lib/services/inventoryService.ts` — `calcularQuantidadeInventario` e estrutura `InventoryItem`
- `src/lib/services/productService.ts` — `checkProductCodeExists`; adicionar `getProductByCode`
- `src/types/nf.ts` — interfaces `NFProduct`, `ParsedNF`, `NFImport`, `NFImportCreate`
- `src/components/upload/FileUpload.tsx` — componente atual com `accept = '.pdf'` a ser reescrito
- `src/__tests__/inventoryUtils.test.ts` — padrao de testes unitarios adotado no projeto
- `CLAUDE.md` — decisao de desabilitar importacao via PDF; regra multi-tenant obrigatoria
- Manual de Orientacao do Contribuinte NF-e v4.00 (SEFAZ) — especificacao dos elementos XML
- Documentacao `fast-xml-parser`: https://github.com/NaturalIntelligence/fast-xml-parser

---

## 13. Histórico de Versões

| Versao | Data       | Autor               | O que mudou                                                                                                                                                                                              |
| ------ | ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0    | 06/05/2026 | Doc Writer (Claude) | Versao inicial — scope incluia suporte a PDF e preservacao de `/api/parse-nf` como referencia                                                                                                           |
| 2.0    | 06/05/2026 | Doc Writer (Claude) | Reescrita completa: escopo alterado para XML-only; remocao explicita de `/api/parse-nf/route.ts`; reescrita do zero de `FileUpload.tsx` (sem suporte a PDF); campo `qCom` incluido; mapeamento completo de 6 campos XML; especificacoes tecnicas completas com codigo de referencia para todos os arquivos |
