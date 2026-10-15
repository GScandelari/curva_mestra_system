# Bugfix: Identidade e Duplicidade de NF-e (identidade CNPJ + série + número, confirmação atômica no servidor, ID sequencial por clínica e incorporação automática de pendências)

**Projeto:** Curva Mestra
**Data:** 14/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/nfe-identity-duplicate-check`
**Prioridade:** Média
**Versão:** 1.1
**Origem:** `UC-10-RN-14` (Média, Bug funcional) + `UC-10-RN-15` (Baixa, Débito técnico) + `UC-11-RN-12` (Baixa, Bug funcional), registrados em `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.52, destaque 13). Esta versão também resolve parcialmente a decisão de produto `UC-10-RN-02` (Seção 4.4). As decisões do usuário de 14/10/2026 estão consolidadas na Seção 4.5.

> **Problema.** Hoje a NF-e é identificada só pelo número dentro do tenant. A checagem de duplicidade roda no client, sem transação. O número digitado à mão não é normalizado. Além disso, o parser apaga zeros à esquerda de forma inconsistente.
>
> **O que muda.**
> - A identidade da nota passa a ser **CNPJ do emitente + série + número**, nos dois caminhos (XML e manual).
> - A unicidade é garantida por um documento `tenants/{t}/nf_identidades/{cnpj_serie_numero}`.
> - Tudo é gravado numa **única transação Admin SDK** dentro de API routes: identidade, contador, registro, estoque e pendências. O preview não grava nada.
> - Cada registro de importação recebe um **ID sequencial por clínica a partir de 1000**, exibido como **"ID 1000"**. A chave de acesso passa a ser só um campo gravado.
> - O client perde a escrita direta em `nf_imports`, `nf_identidades`, contador e `pending_master_products`.
> - Os zeros à esquerda são limpos de forma uniforme em número, série, código de produto e lote.
> - Produtos fora do catálogo viram pendências com os dados completos da linha. Quando o system_admin ativa o produto no catálogo master, uma **Cloud Function** lança essas linhas no inventário de todas as clínicas afetadas e notifica cada uma.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`. Antes de criar a branch, confira que `develop` existe local e remoto e está em sync com `master` (`git checkout develop && git pull origin develop`).
- **Branch da task:** `bugfix/nfe-identity-duplicate-check`
- **Fluxo:** `bugfix/nfe-identity-duplicate-check` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop`. **Nunca PR para `master`.**
- **Pré-requisito obrigatório:** os PRs #389 (`bugfix/consultant-subcollection-allowlist`) e #390 (`bugfix/nfe-parse-routes-hardening`) estão em `gscandelari_setup`, mas ainda não em `develop` (situação em 14/10/2026). Esta task:
  - reaproveita as guardas de #390 (`checkParseNfeClaims`, `checkRequestContentLength`, `validateNfeUploadEntries` em `src/lib/validations/nfeUploadValidation.ts`);
  - altera os mesmos arquivos de #389/#390: `firestore.rules`, `tests/rules/firestore-tenant-subcollections.test.ts` e `src/app/(clinic)/clinic/upload/page.tsx`.

  **Crie a branch só depois que `gscandelari_setup → develop` levar #389/#390 para `develop`.** Se isso não for possível, crie-a a partir de `develop`, faça cherry-pick dos commits de #390 (`7142c5b`, `12f8b8e`, `561bc6a`, `40fafd5`, `e65fc43`) e registre isso no PR.
- **Ordem dos commits:** cada commit deve manter a importação funcionando. Funções puras e parser vêm primeiro. Depois vêm as rotas no servidor, depois as telas que passam a chamá-las. A Cloud Function de incorporação vem em seguida. As rules que fecham a escrita do client entram por último.
- **Tipos de commit:** a incorporação automática de pendências é funcionalidade nova pedida pelo usuário. Por isso o STEP 9 usa `feat`, e o release-please vai gerar um MINOR.

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `fix` | `inventory` | `fix(inventory): add NF-e identity and normalization helpers` |
| STEP 1 | `test` | `inventory` | `test(inventory): cover NF-e identity and normalization helpers` |
| STEP 2 | `fix` | `inventory` | `fix(inventory): stop numeric coercion and normalize NF-e XML fields` |
| STEP 2 | `test` | `inventory` | `test(inventory): cover normalized fields and access key in parser` |
| STEP 3 | `refactor` | `inventory` | `refactor(inventory): extract pure inventory quantity calculation` |
| STEP 4 | `fix` | `inventory` | `fix(inventory): add pure NF import planner and identity conflict rules` |
| STEP 4 | `test` | `inventory` | `test(inventory): cover NF import planner and write budget` |
| STEP 5 | `fix` | `api` | `fix(api): confirm NF-e imports atomically with Admin SDK` |
| STEP 5 | `test` | `api` | `test(api): cover NF import confirmation routes responses` |
| STEP 6 | `fix` | `inventory` | `fix(inventory): confirm XML import through server route` |
| STEP 7 | `fix` | `inventory` | `fix(inventory): require issuer identity on manual NF entry` |
| STEP 8 | `fix` | `admin` | `fix(admin): store master product codes without leading zeros` |
| STEP 9 | `feat` | `inventory` | `feat(inventory): auto-import pending NF items on catalog activation` |
| STEP 9 | `test` | `inventory` | `test(inventory): cover pending resolution rules and mirror parity` |
| STEP 9 | `ci` | `deploy` | `ci(deploy): deploy pending resolution functions to dev` |
| STEP 10 | `feat` | `admin` | `feat(admin): show import ID and reprocess action on pending products` |
| STEP 11 | `fix` | `firebase` | `fix(firebase): block client writes to server-managed NF collections` |
| STEP 11 | `test` | `firebase` | `test(firebase): cover NF collections rules for get and list` |
| STEP 12 | — | — | Validação Manual, sem commit de código |

**Ao abrir o PR para `develop`** (Seção 15 do SST):
- `uml-use-case-writer` atualiza:
  - UC-10: fluxo principal reescrito, RN-01 a RN-04, RN-07, RN-11 e exceções.
  - UC-11: CNPJ/série obrigatórios, chave opcional, complemento no mesmo ID, gravação no servidor.
  - UC-12: incorporação automática, "Reprocessar" no lugar de "Marcar Resolvido", rule de leitura.
  - UC-31/UC-32: código sem zeros à esquerda; ativação dispara a incorporação.
  - UC-44: novo tipo de notificação.
- `uc-issues-tracker` (Modo B):
  - fecha `UC-10-RN-14`, `UC-10-RN-15` e `UC-11-RN-12`;
  - registra `UC-10-RN-02` como **parcialmente decidido** (Seção 4.4);
  - registra os achados A1–A5 (Seção 1.4) como corrigidos nesta task.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Parser (`src/lib/parseNfeXml.ts`, 211 linhas)**
- Usa `XMLParser` com `ignoreAttributes: false`, `attributeNamePrefix: '@_'` e `removeNSPrefix: true` (l. 66–71). O `parseTagValue` fica no padrão (`true`).
- Extrai `numero` (`ide/nNF`), `fornecedor`, `cnpj_fornecedor` (`emit/CNPJ`, l. 203), natureza, pagamento e os produtos (`cProd`, `xProd`, `qCom`, `vUnCom`, `rastro/nLote`, `dVal`, `dFab`).
- Não extrai `infNFe@Id` (chave de acesso) nem `ide/serie`.
- **Coerção numérica, verificada localmente em 14/10/2026 com `fast-xml-parser` 5.7.3 e as mesmas opções:**
  - `<nNF>026229</nNF>` vira `26229`.
  - `<serie>001</serie>` vira `1`.
  - `<CNPJ>01234567000189</CNPJ>` vira `1234567000189`.
  - `<chNFe>` com 44 dígitos vira `3.5250301234567e+43`.
  - `cProd`/`nLote` só com dígitos perdem os zeros à esquerda; os alfanuméricos não. Isso é inconsistente.
  - Com `parseTagValue: false` todos os valores chegam como string (com `trimValues`); o mesmo teste confirmou isso.

**Fluxo XML (`src/app/(clinic)/clinic/upload/page.tsx`, `handleUpload` l. 68–195)**
1. Parse via `POST /api/parse-nf-xml`.
2. `checkNumeroNFStatus(tenantId, numero, 'xml')`.
3. `uploadNFFile` (Storage, pelo client).
4. `createNFImport` (`addDoc`, ID aleatório, `status: 'pending'`), ainda **antes** do preview.
5. Preview.
6. `processNFAndAddToInventory` (client SDK): marca `processing`, grava o inventário com `writeBatch`, chama `registerPendingMasterProducts` e marca `success`/`novo_produto_pendente`/`error`.

**Fluxo manual (`src/app/(clinic)/clinic/add-products/page.tsx`)**
- O número é texto livre, sem `trim` (l. 632–638).
- `checkNumeroNFStatus(tenantId, numeroNF, 'manual')` (l. 349).
- `writeBatch` pelo client grava `nf_imports` (ID aleatório, `numero_nf` cru, `produtos` embutido, `status: 'success'`) e os itens de `inventory` (`nf_numero` cru) (l. 372–429).
- Não há campo de CNPJ nem de série.
- A quantidade e o valor de produtos fragmentáveis são calculados no client (`calcularQuantidadeInventario`) antes de entrar na lista local.

**Checagem (`src/lib/services/nfImportService.ts:199-239`)**
- Consulta `where('numero_nf','==', numero)` e aplica a matriz v1 de UC-10 RN-02, itens (a) a (d).

**Pendências**
- `registerPendingMasterProducts` (`pendingMasterProductService.ts:29-50`) faz `getDocs(query(pending_master_products, where tenant_id/nf_id/codigo))` e depois `addDoc` com `{tenant_id, numero_nf, nf_id, codigo, nome_produto}`. **Não guarda lote, quantidade, validade nem valor.**
- A tela `/admin/pending-products` lista as pendências e tem dois botões:
  - "Cadastrar Produto", que leva a `/admin/products/new?codigo=&nome=` com o formulário pré-preenchido;
  - "Marcar Resolvido", que só apaga a pendência, e só se o produto já estiver ativo no catálogo.
- A clínica precisa **reenviar o XML** para completar a importação.

**Catálogo master (`src/lib/services/masterProductService.ts`)**
- `createMasterProduct`/`updateMasterProduct`/`reactivateMasterProduct` escrevem pelo client SDK (system_admin).
- A coleção é `master_products`. O código tem 7 dígitos, validado pela rule `code.matches('^[0-9]{7}$')` (`firestore.rules:276-284`) e por `validateProductCode` (`src/types/masterProduct.ts:90`).
- `getMasterProductByCode` busca por igualdade exata.
- Os 112 códigos presentes nos scripts de importação (`scripts/import-master-products*.js`) não têm zero à esquerda.

**Notificações (UC-44)**
- Ficam em `tenants/{t}/notifications` (`src/types/notification.ts`).
- `NotificationType` tem 10 valores.
- `notificationService.ts:270` inicializa `by_type` com todas as chaves.
- `NotificationBell.tsx:61` escolhe o ícone por tipo e tem `default`.
- As Cloud Functions já gravam notificações pelo Admin SDK (`functions/src/alertChecks.ts:83`).
- O system_admin **não** tem central de notificações. O "alerta" dele é a fila de `/admin/pending-products`.

**Cloud Functions**
- Ficam em `functions/src`, região `southamerica-east1`, com `onDocumentCreated` e `onCall`.
- O deploy empacota só `functions/src`, que **não pode importar `src/lib`**. A lógica pura é espelhada manualmente, como em `functions/src/alertRules.ts`, que espelha `src/lib/alertRules.ts`.
- `deploy-gscandelari-dev.yml` (l. 113) faz deploy de uma **lista explícita** de functions.
- `deploy-firebase.yml` (produção) não faz deploy de `firestore:rules`, `firestore:indexes` nem `storage`.

**Admin SDK (`src/lib/firebase-admin.ts`)**
- Exporta `adminAuth`/`adminDb`. **Não há helper de Storage.**
- `verifyBearerToken` fica em `src/lib/services/accessRequestRouteHelpers.ts`.

**Rules**
- O bloco `nf_imports` (`firestore.rules:181-183`) dá `read, write` a qualquer `clinic_admin` do tenant.
- O bloco genérico `tenants/{tenantId}/{collectionId}/{document=**}` (l. 105–116) dá `read, write` ao system_admin e leitura aos usuários do tenant fora de `isRestrictedTenantCollection` (`['nf_imports','financeiro','precificacao_procedimentos']`).
- Em `gscandelari_setup` (#389), o consultor lê só a allowlist `consultantReadableSubcollection` (`['inventory','stock_limits','solicitacoes']`).
- `pending_master_products` (l. 302–308): `create` para qualquer usuário do tenant; `read/update/delete` só para system_admin.
- `storage.rules`: `danfe/{tenantId}/{nfId}` aceita escrita de usuários do tenant.

**Testes existentes**
- `src/__tests__/parseNfeXml.test.ts`: o fixture `makeXml` não tem `Id`.
- `tests/rules/firestore-tenant-subcollections.test.ts:269-308`: espera que `clinic_admin` e system_admin consigam escrever em `nf_imports`.
- Não há caderno E2E de UC-10/11/12.
- O seed do emulador não cria `master_products`.

### 1.2 Problema identificado

1. **`UC-10-RN-14`.** O nNF só é único por emitente e série. Uma NF de outro fornecedor com o mesmo número é bloqueada ou misturada no mesmo registro.
2. **`UC-10-RN-15`.** Não há atomicidade nem proteção no servidor. Dois envios quase simultâneos duplicam estoque, e a rule permite sobrescrever ou apagar qualquer registro.
3. **`UC-11-RN-12`.** "026229" digitado ≠ "26229" do XML. A mesma NF entra pelos dois caminhos.

### 1.3 Motivação estratégica

O estoque alimenta todos os relatórios (UC-47, UC-51, UC-52) e o custo por procedimento. Com uma única transação no servidor, ou a nota inteira entra (identidade, registro, estoque e pendências), ou nada entra. O ID legível "ID 1000" dá à clínica e ao suporte uma referência curta para cada importação. A incorporação automática tira da clínica o trabalho de reenviar o XML.

### 1.4 Achados desta investigação (fora do mapa v3.52, corrigidos nesta task)

| # | Achado | Tratamento |
|---|---|---|
| A1 | **Coerção numérica do parser** (Seção 1.1). O CNPJ perde o zero à esquerda; `cProd` e `nLote` numéricos perdem zeros e os alfanuméricos não. | `parseTagValue: false` e normalização explícita e uniforme (RN-05). |
| A2 | **Import XML abandonado ou com falha bloqueia o número para sempre.** O `pending` criado antes do preview, ou o `error`, sem `produtos_pendentes`, cai em "já foi totalmente importada" (`nfImportService.ts:220-238`). | Some por construção: o preview não grava e uma falha desfaz a transação inteira. |
| A3 | **`registerPendingMasterProducts` consulta `pending_master_products` como `clinic_admin`**, mas a rule só libera leitura para system_admin (UC-12 RN-05). A consulta seria negada, e a NF com produto fora do catálogo terminaria em `error` depois de o estoque já ter sido gravado. | **Some.** A pendência passa a ser criada pela API route com Admin SDK, que não passa pelas rules, dentro da mesma transação; não existe mais consulta de deduplicação, porque o ID da pendência é determinístico. O client deixa de tocar essa coleção, e a rule de `create` do client é removida. |
| A4 | **CNPJ alfanumérico** (IN RFB 2.229/2024, vigente desde jul/2026; NT 2025.001 na NF-e). | Aceito: 12 posições `[0-9A-Z]` + 2 dígitos verificadores, com DV calculado pelo valor `charCode - 48` (D9). ⚠️ Conferir o leiaute na versão vigente da NT ao implementar (é verificação técnica, não decisão de produto). |
| A5 | **`forma_pagamento` errada para `tPag` 01–09.** A coerção transforma `<tPag>01</tPag>` em `1`, e `TPAG_LABELS['1']` não existe, então NF paga em dinheiro, cheque ou cartão aparece como "Não Informado". | Corrigido como efeito de `parseTagValue: false`, com teste de regressão. |

---

## 2. Objetivos

1. **Identificar** a NF por (CNPJ do emitente, série, número) nos dois caminhos, com unicidade garantida por `nf_identidades/{cnpj_serie_numero}`.
2. **Confirmar** a importação (XML ou manual) em **uma** transação Admin SDK numa API route: identidade, contador, registro, estoque e pendências. Ou tudo entra, ou nada.
3. **Numerar** os registros com ID sequencial por clínica a partir de 1000, exibido como "ID 1000" e nunca como "NF 1000".
4. **Bloquear** a duplicata com mensagem detalhada ("Esta NF já foi cadastrada (ID 1000).") e **complementar** o mesmo registro nos lançamentos manuais fracionados.
5. **Normalizar** número, série, código de produto e lote (sem zeros à esquerda) e o CNPJ (forma canônica validada).
6. **Incorporar** automaticamente as linhas pendentes de todas as clínicas quando o produto for ativado no catálogo master, e notificar cada clínica.
7. **Fechar** a escrita direta do client em `nf_imports`, `nf_identidades`, `contadores`, `pending_master_products` e `danfe/` no Storage.
8. **Cobrir** com Jest as funções puras, as respostas das rotas e a paridade dos espelhos, e com `npm run test:rules` (get **e** list) as regras.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | O preview do XML (`/clinic/upload`) só faz parse e exibe os dados. Não grava nada no Firestore nem no Storage. Mostra a identidade ("NF 26229 · série 1 · CNPJ 12.345.678/0001-99") e marca os produtos que **não** estão ativos no catálogo ("Não cadastrado — ficará pendente"). | clinic_admin | Must |
| RF-02 | "Confirmar importação" chama `POST /api/nf-imports/xml` com o arquivo. O servidor refaz o parse e, numa transação, valida a identidade, incrementa o contador, cria o registro, grava o estoque dos produtos do catálogo, cria as pendências dos demais e cria a identidade. | clinic_admin | Must |
| RF-03 | Em caso de sucesso, a tela mostra "Importação concluída — ID 1000", o total importado e a **lista dos produtos não importados** (código, nome, lote), com o texto "Serão adicionados automaticamente ao estoque quando cadastrados no catálogo; você será notificado." | clinic_admin | Must |
| RF-04 | Uma NF cuja identidade já existe é recusada com **409** e mensagem detalhada: "Esta NF já foi cadastrada (ID 1000)." Para registro manual existente: "Esta NF já foi cadastrada manualmente (ID 1000) e não pode ser importada via XML." Nada é gravado. | clinic_admin | Must |
| RF-05 | Na inserção manual, CNPJ do emitente e série são **obrigatórios**; a chave de acesso é **opcional** (nota física ou rasurada). Um CNPJ com DV inválido é recusado. Uma chave informada precisa ter DV válido e bater com CNPJ, série e número digitados. | clinic_admin | Must |
| RF-06 | "Confirmar e Salvar" na inserção manual chama `POST /api/nf-imports/manual`. Para uma identidade nova, cria o registro (novo ID). Para uma identidade já existente de origem manual, **complementa o mesmo registro** (mesmo ID) com os novos itens. Para uma identidade de origem XML, recusa com 409. | clinic_admin | Must |
| RF-07 | Concorrência: duas confirmações simultâneas da mesma NF resultam em exatamente um registro. A segunda recebe 409 com o ID do primeiro (XML) ou complementa (manual × manual). | clinic_admin | Must |
| RF-08 | O arquivo XML é salvo pelo servidor em `danfe/{tenantId}/{importId}.xml` **depois** do commit da transação, em modo best-effort (Seção 4.1, item 6). | system | Must |
| RF-09 | Quando um produto do catálogo master fica ativo (criado ativo, reativado, ou com código alterado estando ativo), as pendências abertas daquele código em **todas** as clínicas entram no inventário automaticamente. O registro de importação é atualizado e cada clínica afetada recebe a notificação "A NF (ID 1000) foi atualizada: os produtos X, Y, Z foram adicionados ao inventário automaticamente". | system | Must |
| RF-10 | Em `/admin/pending-products`, o system_admin vê, por pendência, clínica, "ID 1000", NF (número/série/CNPJ), código, nome, lote, quantidade e data. "Cadastrar Produto" continua igual. "Marcar Resolvido" é substituído por **"Reprocessar"**, que dispara manualmente a mesma incorporação do RF-09. | system_admin | Must |
| RF-11 | O reenvio do XML de uma NF já cadastrada é bloqueado como duplicata (RF-04), mesmo que ela tenha pendências. Se houver pendências, a mensagem acrescenta: "Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo." | clinic_admin | Must |
| RF-12 | Número, série, código de produto e lote são gravados sem zeros à esquerda nos dois caminhos e na incorporação. | system | Must |
| RF-13 | O código de produto do catálogo master é gravado sem zeros à esquerda: o formulário aceita até 7 dígitos e normaliza. | system_admin | Must |
| RF-14 | O detalhe do item de inventário (`/clinic/inventory/[id]`) mostra "NF-e 26229 · ID 1000" quando o item vem de uma importação. | clinic_admin / clinic_user | Should |
| RF-15 | Uma NF com mais linhas do que o orçamento de escrita da transação (Seção 4.1, item 5) é recusada com 422 e mensagem explicativa. No manual, a mensagem sugere dividir o lançamento: os complementos mantêm o mesmo ID. | clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | Toda escrita de importação usa Admin SDK em API route ou Cloud Function. O client só lê `nf_imports` (clinic_admin) e `pending_master_products` (system_admin). | Segurança |
| RNF-02 | O tenant vem **só** do token (`claims.tenant_id`). Nenhum `tenantId` vem no corpo das rotas. Toda escrita fica sob `tenants/{tenantId}/…`, e as pendências globais carregam `tenant_id`. | Multi-tenant |
| RNF-03 | A transação lê identidade e contador antes de qualquer escrita. O Firestore serializa transações concorrentes sobre os mesmos documentos. Uma falha não deixa nenhuma escrita parcial. | Confiabilidade |
| RNF-04 | O número de escritas por transação fica em no máximo 500 (limite do Firestore), validado por função pura antes de abrir a transação. | Confiabilidade |
| RNF-05 | A lógica de identidade, normalização, planejamento das linhas, conflito, orçamento e incorporação fica em funções puras testadas. O que roda em `functions/src` é espelho de `src/lib`, com teste de paridade. | Manutenibilidade |
| RNF-06 | Nenhum log novo com CNPJ completo, chave de acesso ou conteúdo do XML. | Segurança |
| RNF-07 | Consulta de pendências por código: igualdade em `codigo` + `status` (merge de índices de campo único). Listagem do admin: novo índice composto `(status ASC, created_at DESC)`. | Performance |
| RNF-08 | A incorporação automática é idempotente: a pendência só é lançada se continuar `aberta` dentro da transação. | Confiabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | **Identidade da NF** = (CNPJ do emitente canônico, série normalizada, número normalizado). Chave de identidade: `${cnpj}_${serie}_${numero}` (ex.: `12345678000199_1_26229`). Não existe fallback "só número". | Decisão do usuário (D2/D3/D4). O nNF só é único por emitente e série. |
| RN-02 | **Matriz de duplicidade (substitui UC-10 RN-02 (a)–(d)):** <br>(1) identidade inexistente → XML **cria**; manual **cria**. <br>(2) identidade existente com origem `manual` → manual **complementa o mesmo registro**; XML é **bloqueado** (409). <br>(3) identidade existente com origem `xml` (qualquer status, inclusive com pendências) → XML **bloqueado** (409, duplicata); manual **bloqueado** (409). | Decisão do usuário: a regra (b) foi revogada e o complemento manual usa o mesmo ID. O reenvio deixou de ser necessário (RN-08). |
| RN-03 | **ID do registro** = inteiro sequencial por clínica, começando em **1000**. É o ID do documento (`nf_imports/"1000"`) e também o campo `id_sequencial: 1000`. É exibido sempre como **"ID 1000"**, nunca "NF 1000". Complementos manuais não consomem ID. Transações que falham não consomem ID (o contador está na mesma transação), então não há buracos. | Decisão do usuário (D1 revisada). |
| RN-04 | A chave de acesso é só um campo gravado (`chave_acesso`). No XML é **obrigatória e validada**: o schema SEFAZ exige `infNFe@Id`; o DV precisa bater, e CNPJ, série e número da chave precisam bater com as tags. No manual é opcional, mas, se informada, recebe a mesma validação contra o que foi digitado. | A chave detecta XML adulterado ou montado; a identidade vem das tags e é conferida pela chave. |
| RN-05 | **Normalização** (aplicada na entrada, nos dois caminhos e na incorporação): <br>• número e série → só dígitos, sem zeros à esquerda (série `"000"` → `"0"`; número só com zeros é inválido); <br>• código de produto e lote → `trim` e remoção de zeros à esquerda, mantendo ao menos 1 caractere (`"0012345"`→`"12345"`, `"00A12"`→`"A12"`, `"000"`→`"0"`), com o restante do texto preservado; <br>• CNPJ → sem máscara, maiúsculas, **DV validado antes**, gravado na forma canônica de 14 posições (Seção 4.1, item 8). | Decisão do usuário: limpar zeros "em qualquer caso" e de forma consistente. |
| RN-06 | Produto do XML sem correspondente **ativo** no catálogo (`master_products.code == codigo` normalizado e `active == true`) vira **pendência por linha** (código + lote), com os dados completos da linha. O registro fica `novo_produto_pendente` enquanto houver pendência aberta. | Fluxo mantido e ampliado (UC-10 RN-07). |
| RN-07 | **Incorporação automática:** quando `master_products/{id}` passa a estar ativo (criação com `active: true`, `active` de false para true, ou `code` alterado com `active: true`), todas as pendências abertas daquele código são lançadas, agrupadas por (tenant, registro). Cada grupo usa uma transação: a pendência vira `resolvida` com `inventory_id`, o registro é atualizado e uma notificação vai para a clínica. Para fragmentável, a quantidade e o valor seguem `calcularQuantidadeInventario` com os dados do catálogo **no momento da incorporação**. | Decisão do usuário. |
| RN-08 | O reenvio do XML para completar uma importação **deixa de existir**: uma NF já cadastrada é sempre duplicata (RN-02 (3)). | Decisão do usuário (sugestão aceita). |
| RN-09 | Uma NF-e cujo emitente não tem CNPJ (`emit/CPF`) é recusada com 422: "Emitente sem CNPJ não é suportado." | A identidade exige CNPJ (D2/D3). |
| RN-10 | O system_admin não grava `nf_imports`, `nf_identidades`, `contadores` nem `pending_master_products` pelo client. Correções de dados ficam com o Admin SDK (scripts ou console). | Os dados gerenciados pelo servidor são consistentes por construção (D7). |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Módulos puros em `src/lib`:**
   - `nfIdentity.ts`: normalização, CNPJ, chave, identidade e rótulos.
   - `nfImportPlanner.ts`: conflito de identidade, próximo ID, planejamento das linhas (catálogo × pendência), orçamento de escrita e mensagens.
   - `inventoryQuantity.ts`: `calcularQuantidadeInventario`, movido de `inventoryService.ts`, que é um módulo do client SDK e por isso não pode ser importado pela rota.
   - `nfPendingResolutionRules.ts`: decisão de disparo e plano da incorporação.
2. **Parser:**
   - `parseTagValue: false` (tudo string).
   - Identidade a partir das tags `emit/CNPJ`, `ide/serie` e `ide/nNF`, normalizadas.
   - Chave obrigatória (`infNFe@Id`), com conferência cruzada contra a identidade (RN-04).
   - `codigo` e `lote` normalizados.
3. **Confirmação no servidor** (`src/lib/services/nfImportServer.ts`, server-only, Admin SDK), chamada por duas rotas:
   - `POST /api/nf-imports/xml`: multipart com o arquivo. A rota refaz o parse no servidor e **não confia** em `parsedNF` vindo do client.
   - `POST /api/nf-imports/manual`: JSON. Para Rennova, o servidor busca o catálogo e calcula quantidade e valor; o client manda a quantidade e o valor informados (embalagens).

   As duas rotas usam as guardas de #390 (`verifyBearerToken` + `checkParseNfeClaims`, ou seja, `clinic_admin` ativo com `tenant_id`) e, na rota XML, `checkRequestContentLength` + `validateNfeUploadEntries`.
4. **Transação** (`adminDb.runTransaction`):
   - **Leituras:** `nf_identidades/{chave}`; `contadores/nf_imports`; para XML, o catálogo (`master_products where code in [...]`, em blocos de 30); no complemento manual, o registro existente.
   - **Decisão:** `evaluateIdentityConflict`.
   - **Escritas, criação XML:** contador, registro, identidade, N itens de `inventory` e P pendências (`pending_master_products/{tenantId}_{importId}_{linha}`).
   - **Escritas, complemento manual:** o registro (`produtos_importados`, `lancamentos_manuais`, `updated_at`) e N itens.

   Transações concorrentes sobre a mesma identidade e o mesmo contador são serializadas pelo Firestore. A segunda tenta de novo, vê a identidade criada e responde 409 (ou complementa, no manual × manual).
5. **Limite de 500 escritas** (`checkWriteBudget`, antes de abrir a transação):
   - criação XML = 3 + N + P;
   - criação manual = 3 + N;
   - complemento = 1 + N.

   Até **497** linhas por importação. Acima disso, 422. Uma NF Rennova típica tem cerca de 13 linhas. Não é possível dividir a importação XML sem quebrar a atomicidade; no manual, o usuário divide em complementos. O documento do registro deixa de embutir `parsed_data`/`produtos` (o inventário e as pendências são a fonte, via `nf_id`), o que mantém o documento pequeno.
6. **Arquivo no Storage: depois do commit, best-effort.** A rota grava `danfe/{tenantId}/{importId}.xml` com o Admin SDK (`getAdminStorage()`, a criar em `firebase-admin.ts`) e atualiza `arquivo_path` + `arquivo_status: 'salvo'`. Se falhar, grava `arquivo_status: 'falhou'`, registra `console.error` sem conteúdo e **não** desfaz a importação.

   **Por quê:**
   - o estoque e a identidade são a fonte de verdade, e o arquivo é só arquivamento;
   - fazer o upload antes exigiria limpeza em toda rejeição, e a rejeição mais comum é justamente a duplicata;
   - uma limpeza que falhasse deixaria arquivo órfão de NF rejeitada, violando UC-10 RN-04;
   - o caminho determinístico pelo ID permite reenviar só o arquivo no futuro, se necessário.

   A rota já tem o buffer em memória (≤ 10MB, guarda de #390).
7. **Incorporação automática: Cloud Function `onMasterProductWritten`** (`onDocumentWritten('master_products/{productId}')`, `southamerica-east1`) + callable **`reprocessPendingMasterProducts({ codigo })`** (só system_admin) para o botão "Reprocessar".

   **Por que trigger e não API do admin:** o catálogo é escrito por três caminhos (`createMasterProduct`, `updateMasterProduct`/`reactivateMasterProduct` pelo client e os scripts `scripts/import-master-products*.js` com Admin SDK). Só o trigger cobre os três sem depender de o client chamar algo depois.

   A lógica pura fica em `functions/src/nfPendingResolutionRules.ts`, como **espelho manual** de `src/lib/nfPendingResolutionRules.ts` (mesmo padrão de `alertRules.ts`), com teste de paridade.
8. **CNPJ armazenado na forma canônica de 14 posições (com zeros, sem máscara).** O usuário pediu para avaliar se o CNPJ deve ser armazenado normalizado:
   - o DV é validado **antes** de qualquer transformação;
   - um CNPJ válido sempre tem 14 posições, então comparar a forma canônica equivale a comparar a forma sem zeros, mas a canônica preserva a possibilidade de revalidar o DV e de formatar a máscara para exibição;
   - remover zeros do CNPJ não traria nenhuma vantagem e criaria uma forma ambígua (12–13 caracteres) que não passa na validação.

   Em resumo: o CNPJ é "normalizado para comparação" no sentido de canônico, não de sem zeros.
9. **Código do catálogo sem zeros à esquerda** (STEP 8): `validateProductCode` aceita 1–7 dígitos e o serviço grava `normalizeLeadingZeros(code)`. A rule de `master_products` passa a exigir `^[1-9][0-9]{0,6}$`. Sem isso, um `cProd` normalizado nunca casaria com um código de catálogo que tivesse zero.
10. **Rules:** Seção 6.5.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Chave de acesso como ID do documento (v1.0) | Revisado pelo usuário (D1): o ID precisa ser legível ("ID 1000"), e o manual nem sempre tem chave. |
| Transação client-side + reserva antes do preview + trava de 10 min (v1.0, D5/D6) | Substituído: o SDK web não faz consulta dentro de transação, a escrita de estoque ficaria fora da transação e precisaria de estados retomáveis (`pending`/`error`/`processing`). A transação única no servidor elimina tudo isso. |
| Fallback "só número" para registros antigos (v1.0, D4) | Revogado: não há registros antigos a considerar (fase de implementação). |
| Upload do XML antes da transação, com limpeza na rejeição | Pode deixar arquivo órfão se a limpeza falhar; o caso comum de rejeição (duplicata) pagaria upload e delete sem necessidade. |
| Incorporação por API route chamada pela tela do admin depois de cadastrar | Não cobre os scripts de importação do catálogo nem reativações feitas por outros caminhos; depende do client. |
| Importar `src/lib` dentro de `functions/src` | O deploy empacota só `functions/src` (comentário de `functions/src/alertRules.ts`). |
| Remover zeros do CNPJ na gravação | Seção 4.1, item 8. |
| Lookup do catálogo tentando `[codigo, codigo.padStart(7,'0')]` | Mantém duas formas canônicas para o mesmo código; o usuário pediu consistência. |
| Dividir uma NF XML com mais de 497 linhas em várias transações | Quebra a garantia "tudo ou nada". O limite fica bem acima do uso real. |

### 4.3 Trade-offs aceitos

- **O arquivo pode faltar** (`arquivo_status: 'falhou'`) numa importação válida. É raro, fica visível no registro e não afeta o estoque.
- **Espelho manual** da lógica de incorporação em `functions/src`. É mitigado pelo teste de paridade, que roda os mesmos casos contra os dois módulos.
- **O contador é um documento quente por clínica.** Duas confirmações simultâneas da mesma clínica são serializadas, com espera de milissegundos. É aceitável no volume de uma clínica.
- **Catálogo lido na transação do XML e incorporação pelo trigger:** se o produto for ativado entre a leitura e o commit, a linha vira pendência depois que o trigger já rodou. O botão "Reprocessar" (RF-10) cobre esse caso, e a próxima escrita no produto também.
- **Fragmentação usa o catálogo do momento da incorporação**, não o do momento da importação. É coerente com o fluxo atual, em que o reenvio do XML também usava o catálogo do momento.
- **Bundle antigo em cache** recebe `permission-denied` ao tentar o fluxo antigo pelo client depois do deploy das rules. Recarregar a página resolve.

### 4.4 Relação com `UC-10-RN-02`

| Aspecto | Situação após v1.1 |
|---|---|
| Critério de identidade | **Decidido:** CNPJ + série + número (RN-01). |
| Matriz de bloqueio | **Decidido:** RN-02 (1)–(3). A regra (b) foi revogada e o complemento manual usa o mesmo ID. |
| Reenvio para completar | **Decidido:** deixa de existir (RN-08); a incorporação é automática (RN-07). |
| Garantia no servidor | **Decidido:** transação Admin SDK + rules (D7). |
| **Questão futura (não bloqueia esta task)** | Uma pendência cujo produto nunca entra no catálogo fica aberta indefinidamente. Não existe ação de "descartar pendência" com aviso à clínica. Registrar no mapa como decisão de produto futura. |

### 4.5 Decisões do usuário (14/10/2026) — todas resolvidas

| ID | Decisão | Onde está refletida |
|---|---|---|
| D1 (revisada) | ID legível sequencial por clínica a partir de 1000, exibido como "ID 1000"; a chave de acesso é só um campo. | RN-03, RN-04, 4.1 (item 4), 6.1 |
| D2/D3/D4 | Identidade = CNPJ + série + número nos dois caminhos, consultando todas as notas da clínica. Manual com CNPJ e série obrigatórios e chave opcional. Sem registros antigos e sem fallback. Unicidade por `nf_identidades` criada na mesma transação. | RN-01, RN-02, RF-05, 4.2 |
| D5/D6 (substituídas) | Confirmação atômica no servidor; o preview não grava; sem trava de 10 min e sem estados retomáveis; erro desfaz tudo; rules bloqueiam escrita do client; limite de 500 escritas tratado; Storage depois do commit. | 4.1 (itens 3–6), RF-01/02/07/08/15, 6.5 |
| Produtos fora do catálogo | Mostrar os não importados, criar pendência (alerta ao system_admin) e incorporar automaticamente em todas as clínicas ao cadastrar o produto, com notificação. Reenvio desnecessário e bloqueado. | RF-03/09/10/11, RN-06/07/08, 4.1 (item 7) |
| D7 | Rules completas. | 6.5 |
| D8 | Número gravado normalizado. | RN-05 |
| D9 | CNPJ alfanumérico aceito. | A4, 6.2 |
| Fracionado | O lançamento manual repetido complementa o mesmo registro (mesmo ID). | RN-02 (2), RF-06 |
| Regra (b) | Revogada: XML bloqueado quando já existe registro manual, e vice-versa. | RN-02 |
| Zeros à esquerda | Limpar número, série, código e lote; CNPJ com DV validado antes e armazenado na forma canônica (justificativa na Seção 4.1, item 8). | RN-05, 4.1 (itens 8–9) |
| A3 | Explicado: some com o Admin SDK. | 1.4 |

Não há `⚠️ Decisão necessária` em aberto. O item A4 traz uma **verificação técnica** (conferir a NT vigente), não uma decisão.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `src/lib/nfIdentity.ts` | Lib pura | Normalização, CNPJ, chave, identidade e rótulos. |
| `src/lib/nfImportPlanner.ts` | Lib pura | Conflito, próximo ID, plano de linhas, orçamento e mensagens. |
| `src/lib/inventoryQuantity.ts` | Lib pura | `calcularQuantidadeInventario` movido (reexportado por `inventoryService.ts`). |
| `src/lib/nfPendingResolutionRules.ts` | Lib pura | `shouldResolvePendingForProduct`, `planPendingResolution`, `chunkPendingLines`, `buildPendingResolvedMessage`. |
| `src/lib/services/nfImportServer.ts` | Serviço server-only | `confirmXmlImport`, `confirmManualLaunch`, `saveNfXmlFileBestEffort` (Admin SDK). |
| `src/app/api/nf-imports/xml/route.ts` | API route | `POST`: confirmação XML. |
| `src/app/api/nf-imports/manual/route.ts` | API route | `POST`: lançamento manual. |
| `functions/src/nfPendingResolutionRules.ts` | Function (pura, espelho) | Espelho de `src/lib/nfPendingResolutionRules.ts` + `calcularQuantidadeInventario` e `formatImportId`. |
| `functions/src/onMasterProductWritten.ts` | Cloud Function | Trigger de incorporação. |
| `functions/src/reprocessPendingMasterProducts.ts` | Cloud Function (callable) | "Reprocessar" do admin. |
| `functions/src/pendingResolution.ts` | Orquestração (Admin SDK) | `resolvePendingForCode(db, codigo)`, compartilhada pelo trigger e pelo callable. |
| `src/__tests__/nfIdentity.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/nfImportPlanner.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/nfPendingResolutionRules.test.ts` | Jest | Seção 8.1, incluindo paridade com o espelho. |
| `src/__tests__/nfImportRoutes.test.ts` | Jest | Seção 8.2. |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `src/lib/parseNfeXml.ts` | `parseTagValue: false`; identidade das tags; chave obrigatória e conferida; `codigo`/`lote`/`numero`/`serie` normalizados; CPF → erro. |
| `src/__tests__/parseNfeXml.test.ts` | `makeXml` com `Id` válido padrão e `serie`; casos novos (Seção 8.1). |
| `src/types/nf.ts` | `ParsedNF` + `chave_acesso`, `serie`, `cnpj_fornecedor` obrigatório; novos códigos de erro; `NFImport` reescrito (Seção 6.1); `NFImportCreate` e `NFNumeroStatus` removidos; tipos das rotas. |
| `src/types/pendingMasterProduct.ts` | Campos da linha + `status`, `nf_import_id`, `id_sequencial`, `inventory_id?`, `resolved_at?`. |
| `src/types/notification.ts` | `NotificationType` + `'nf_pending_resolved'`; `metadata` + `nf_import_id?`, `product_names?`. |
| `src/lib/services/notificationService.ts` | `by_type` inicializado com `nf_pending_resolved: 0`. |
| `src/components/notifications/NotificationBell.tsx` | Ícone `Package` verde para `nf_pending_resolved`. |
| `src/lib/services/nfImportService.ts` | Removidos `uploadNFFile`, `createNFImport`, `updateNFImportStatus`, `checkNumeroNFStatus` e `processNFAndAddToInventory`. Ficam `getNFImport`/`listNFImports` (só leitura) com o `mapNFImportDoc` novo. |
| `src/lib/services/inventoryService.ts` | `calcularQuantidadeInventario` reexportado de `inventoryQuantity.ts`. `addInventoryItems`/`getInventoryProdutoLoteKeysByNfId` removidos se `git grep` confirmar que não há outro chamador. |
| `src/lib/services/pendingMasterProductService.ts` | Removidos `registerPendingMasterProducts` e `resolvePendingMasterProduct`. `listPendingMasterProducts` passa a `where('status','==','aberta')` + `orderBy('created_at','desc')` e mapeia os campos novos. |
| `src/lib/firebase-admin.ts` | `getAdminStorage()` (bucket de `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`). |
| `src/app/(clinic)/clinic/upload/page.tsx` | Preview sem gravação + marcação de produtos fora do catálogo; confirmação via `POST /api/nf-imports/xml`; tela de resultado com "ID 1000" e lista de não importados; tratamento de 409/422. |
| `src/app/(clinic)/clinic/add-products/page.tsx` | Passo 2 com CNPJ (obrigatório), série (obrigatória) e chave (opcional); normalização; `handleSaveNF` via `POST /api/nf-imports/manual`; o `writeBatch` e os `console.log` de `handleSaveNF` saem; toast com "ID 1000" / "complementada"; código e lote normalizados ao adicionar produto. |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx` | "NF-e {nf_numero} · ID {nf_id}" (RF-14). |
| `src/app/(admin)/admin/pending-products/page.tsx` | Colunas novas; "Reprocessar" (callable) no lugar de "Marcar Resolvido". |
| `src/types/masterProduct.ts` | `validateProductCode` aceita 1–7 dígitos; `formatProductCode` mantém o limite de 7. |
| `src/lib/services/masterProductService.ts` | `createMasterProduct`/`updateMasterProduct` gravam e buscam `normalizeLeadingZeros(code)`; `getMasterProductByCode` normaliza o argumento. |
| `functions/src/index.ts` | Exporta `onMasterProductWritten` e `reprocessPendingMasterProducts`. |
| `.github/workflows/deploy-gscandelari-dev.yml` | Inclui as duas functions novas no `lib/index.js` gerado e no `--only` (l. 113). |
| `firestore.rules` | Seção 6.5. |
| `firestore.indexes.json` | `pending_master_products (status ASC, created_at DESC)`. |
| `storage.rules` | `danfe/`: escrita negada ao client (leitura do tenant mantida). |
| `tests/rules/firestore-tenant-subcollections.test.ts` | Seção 8.3. |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---|---|
| — | Nenhum arquivo inteiro. Saem as funções listadas em 5.2. |

### 5.4 Impacto no Firestore e no Storage

| Coleção / caminho | Ação | Detalhes |
|---|---|---|
| `tenants/{t}/nf_imports/{id}` | Schema + rules | ID = `"1000"`, `"1001"`, …; schema na Seção 6.1. Leitura: `clinic_admin`. Escrita: só Admin SDK. |
| `tenants/{t}/nf_identidades/{cnpj_serie_numero}` | **Nova** | `{ nf_import_id, origem, created_at }`. Escrita só Admin SDK. Leitura só system_admin (restrita). |
| `tenants/{t}/contadores/nf_imports` | **Nova** | `{ ultimo_id, updated_at }`. Escrita só Admin SDK. Leitura só system_admin (restrita). |
| `tenants/{t}/inventory` | Valor | Itens gravados pelo servidor com `nf_id: "1000"`, `nf_numero` normalizado, `codigo_produto`/`lote` normalizados. Rules inalteradas (a escrita do client em outros fluxos continua). |
| `tenants/{t}/notifications` | Valor | Novo tipo `nf_pending_resolved`, gravado pela function. |
| `pending_master_products/{tenantId}_{importId}_{linha}` | Schema + rules | Linha completa + `status`. Escrita só Admin SDK. Leitura só system_admin. |
| `master_products` | Rule + valor | Código sem zeros à esquerda. A escrita dispara o trigger. |
| `firestore.indexes.json` | Novo índice | `pending_master_products (status ASC, created_at DESC)`. |
| Storage `danfe/{t}/{importId}.xml` | Rule + caminho | Gravado pelo servidor; escrita do client negada. |

### 5.5 O que NÃO muda

- `src/app/api/parse-nf-xml/route.ts` (versão de #390): continua sendo a rota de preview, só parse. Os campos novos de `ParsedNF` passam por ela sem mudança.
- `isRestrictedTenantCollection` e `consultantReadableSubcollection` continuam com a mesma semântica. A primeira ganha `nf_identidades` e `contadores` como itens da lista.
- Regras de `inventory`, `stock_limits`, `solicitacoes`, `protocolos`, `financeiro`, `precificacao_procedimentos` e `notifications`.
- `calcularQuantidadeInventario`: a fórmula não muda, só o arquivo.
- `FileUpload.tsx`, `TipoNotaBadge.tsx`, fluxos de procedimento (UC-16 a UC-19).
- `CLAUDE.md`, os UCs e o mapa (atualizados pelos agentes no PR).

---

## 6. Especificação Técnica

### 6.1 Modelo de dados

```ts
// src/types/nf.ts — ParsedNF (DEPOIS)
export interface ParsedNF {
  numero: string;           // normalizado
  serie: string;            // normalizada
  cnpj_fornecedor: string;  // canônico 14 posições, DV validado (antes: opcional e com coerção)
  chave_acesso: string;     // 44 posições, sem "NFe", validada (RN-04)
  data_emissao?: string;
  fornecedor?: string;
  natureza_operacao?: string;
  forma_pagamento?: string;
  tipo_nota: TipoNota;
  produtos: NFProduct[];    // codigo e lote normalizados
}

export type XmlParseErrorCode =
  | 'INVALID_FORMAT' | 'MISSING_NF_NUMBER' | 'NO_PRODUCTS_FOUND' | 'MALFORMED_PRODUCT'
  | 'MISSING_ACCESS_KEY'   // novo
  | 'INVALID_ACCESS_KEY'   // novo: formato, DV ou divergência com as tags
  | 'INVALID_ISSUER';      // novo: emitente sem CNPJ, CNPJ inválido ou série inválida

export interface NFIdentity { cnpj: string; serie: string; numero: string }

export type NFImportStatus = 'success' | 'novo_produto_pendente';

// nf_imports/{id} — documento gravado pelo servidor
export interface NFImport {
  id: string;                  // "1000"
  id_sequencial: number;       // 1000
  tenant_id: string;
  origem: NFOrigem;            // 'xml' | 'manual'
  identidade: string;          // "12345678000199_1_26229"
  numero_nf: string;
  serie: string;
  cnpj_emitente: string;
  chave_acesso?: string;
  fornecedor?: string;
  data_emissao?: string;
  natureza_operacao?: string;
  forma_pagamento?: string;
  tipo_nota?: TipoNota;
  tipo?: 'rennova' | 'outra_marca';      // manual (do primeiro lançamento)
  status: NFImportStatus;
  produtos_importados: number;
  produtos_pendentes: Array<{ codigo: string; nome_produto: string; lote: string }>;
  lancamentos_manuais?: number;          // manual: 1 + complementos
  arquivo_nome?: string;
  arquivo_path?: string;                 // "danfe/{t}/1000.xml"
  arquivo_status?: 'salvo' | 'falhou';
  created_by: string;
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
}
```

- `nf_identidades/{identidade}`: `{ nf_import_id: string; origem: NFOrigem; created_at }`.
- `contadores/nf_imports`: `{ ultimo_id: number; updated_at }`.

```ts
// src/types/pendingMasterProduct.ts (DEPOIS)
export interface PendingMasterProduct {
  id: string;                 // `${tenant_id}_${nf_import_id}_${linha}`
  tenant_id: string;
  nf_import_id: string;       // "1000"
  id_sequencial: number;      // 1000
  numero_nf: string; serie: string; cnpj_emitente: string;
  linha: number;              // índice em parsedNF.produtos
  codigo: string; nome_produto: string; lote: string;
  quantidade: number;         // como na NF (embalagens)
  valor_unitario: number;     // como na NF (por embalagem)
  dt_validade: Date | Timestamp;
  dt_fabricacao?: Date | Timestamp;
  sem_rastro?: boolean;
  status: 'aberta' | 'resolvida';
  inventory_id?: string;
  created_at: Date | Timestamp;
  resolved_at?: Date | Timestamp;
}
```

Campos herdados do cabeçalho (`natureza_operacao`, `tipo_nota`, `nf_numero`) são lidos do registro `nf_imports` na incorporação, sem duplicação na pendência.

### 6.2 Funções puras

```ts
// src/lib/nfIdentity.ts
export function normalizeNumeroNF(raw: unknown): string;        // '026.229'→'26229'; '000'/'abc'/''→''
export function normalizeSerie(raw: unknown): string;           // '001'→'1'; '000'→'0'; ''/'abc'→''; >999→''
export function normalizeLeadingZeros(raw: unknown): string;    // trim; '0012345'→'12345'; '00A12'→'A12'; '000'→'0'; ''→''
export function normalizeCnpj(raw: unknown): string;            // remove . / - espaço; uppercase; exige /^[0-9A-Z]{12}[0-9]{2}$/ e isValidCnpj; senão ''
export function isValidCnpj(cnpj14: string): boolean;           // mód. 11, pesos 2..9 (dir→esq), valor = charCode-48; rejeita 14 caracteres iguais
export function formatCnpj(cnpj14: string): string;             // '12.345.678/0001-99'
export function computeChaveAcessoDV(first43: string): number;  // mód. 11; resto<2→0; senão 11-resto; valor = charCode-48
export interface ChaveAcessoInfo { chave: string; cnpj: string; modelo: string; serie: string; numero: string }
export function parseChaveAcesso(raw: unknown): ChaveAcessoInfo | null; // aceita 'NFe'+44 ou 44; /^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$/ + DV
export function buildIdentityKey(id: NFIdentity): string;       // `${cnpj}_${serie}_${numero}`
export function chaveMatchesIdentity(chave: ChaveAcessoInfo, id: NFIdentity): boolean;
export function validateManualIdentity(input: { numero: string; cnpj: string; serie: string; chave?: string }):
  | { ok: true; identity: NFIdentity; chave_acesso?: string }
  | { ok: false; error: string };
// erros: 'Número da NF inválido…' | 'CNPJ do emitente inválido' | 'Série inválida' | 'Chave de acesso inválida' | 'A chave de acesso não confere com CNPJ, série e número informados'
export function formatImportId(id: string | number): string;    // 'ID 1000'
export function formatNFLabel(id: NFIdentity): string;          // 'NF 26229 · série 1 · CNPJ 12.345.678/0001-99'
```

```ts
// src/lib/nfImportPlanner.ts
export const NF_IMPORT_FIRST_ID = 1000;
export const MAX_TRANSACTION_WRITES = 500;
export function nextImportId(ultimoId: number | undefined | null): number; // undefined→1000; 1000→1001; <999 → 1000 (robustez)

export type IdentityConflictDecision =
  | { action: 'create' }
  | { action: 'complement'; nfImportId: string }
  | { action: 'blocked'; status: 409; nfImportId: string; reason: string };
export function evaluateIdentityConflict(
  attempt: NFOrigem,
  existing: { nf_import_id: string; origem: NFOrigem; hasPending?: boolean } | null
): IdentityConflictDecision; // RN-02 + mensagens de RF-04/RF-11

export interface MasterLite { id: string; code: string; active: boolean; category?: string; fragmentavel?: boolean; unidades_por_embalagem?: number }
export function planXmlLines(produtos: NFProduct[], mastersByCode: Map<string, MasterLite>): {
  inventory: Array<{ linha: number; produto: NFProduct; master: MasterLite; quantidade: number; valor_unitario: number }>;
  pending: Array<{ linha: number; produto: NFProduct }>;
}; // inativo ou ausente → pending; usa calcularQuantidadeInventario

export function checkWriteBudget(fixedWrites: number, lineWrites: number):
  | { ok: true } | { ok: false; status: 422; error: string };
// erro XML: 'Esta NF-e tem {n} itens; o limite por importação é {max}.'
// erro manual (via wrapper): '… divida o lançamento: os complementos mantêm o mesmo ID.'
```

```ts
// src/lib/inventoryQuantity.ts — conteúdo movido sem alteração
export function calcularQuantidadeInventario(params: CalcInventarioParams): CalcInventarioResult;
```

```ts
// src/lib/nfPendingResolutionRules.ts  (espelhado em functions/src/nfPendingResolutionRules.ts)
export function shouldResolvePendingForProduct(
  before: { code?: string; active?: boolean } | null,
  after: { code?: string; active?: boolean } | null
): string | null; // devolve o código normalizado a resolver ou null
// after ausente ou inativo → null; before ausente → after.code; before.active !== true → after.code; before.code !== after.code → after.code; senão null

export function planPendingResolution(
  pendings: Array<Pick<PendingMasterProduct, 'id' | 'codigo' | 'nome_produto' | 'lote' | 'quantidade' | 'valor_unitario'>>,
  master: { fragmentavel?: boolean; unidades_por_embalagem?: number }
): Array<{ pendingId: string; quantidade: number; valor_unitario: number; quantidade_embalagens?: number; valor_por_embalagem?: number }>;

export const MAX_PENDING_PER_TRANSACTION = 248; // 2 escritas por linha + registro + notificação ≤ 500
export function chunkPendingLines<T>(lines: T[], size?: number): T[][];
export function buildPendingResolvedMessage(importId: string, productNames: string[]): string;
// 'A NF (ID 1000) foi atualizada: os produtos X, Y, Z foram adicionados ao inventário automaticamente.'
// 1 produto: 'A NF (ID 1000) foi atualizada: o produto X foi adicionado ao inventário automaticamente.'
// nomes repetidos (mesmo produto, lotes diferentes) aparecem uma vez
```

**Parser** (`parseNfeXml`):
- `new XMLParser({ ..., parseTagValue: false })`.
- Depois de `numeroNF`:
  - `cnpjRaw = extractText(emit.CNPJ)`. Se estiver vazio e `emit.CPF` existir → `INVALID_ISSUER` ("Emitente sem CNPJ não é suportado.").
  - `cnpj = normalizeCnpj(cnpjRaw)`. Se vazio → `INVALID_ISSUER` ("CNPJ do emitente inválido no XML.").
  - `serie = normalizeSerie(ide.serie)`. Se vazia → `INVALID_ISSUER` ("Série da NF-e inválida no XML.").
  - `numero = normalizeNumeroNF(numeroNF)`. Se vazio → `MISSING_NF_NUMBER`.
  - Sem `infNFe['@_Id']` → `MISSING_ACCESS_KEY`.
  - `parseChaveAcesso(...) === null` → `INVALID_ACCESS_KEY` ("Chave de acesso da NF-e inválida (formato ou dígito verificador).").
  - `!chaveMatchesIdentity` → `INVALID_ACCESS_KEY` ("A chave de acesso não confere com CNPJ, série e número do XML.").
- Nos produtos: `codigo: normalizeLeadingZeros(cProd)` e `lote: normalizeLeadingZeros(nLote) || 'NÃO_INFORMADO'`. `qCom`/`vUnCom` continuam com `parseFloat` sobre string.

### 6.3 Serviço server-only e API Routes

```ts
// src/lib/services/nfImportServer.ts  (import 'server-only' não é necessário; só é importado por rotas)
export async function confirmXmlImport(p: {
  tenantId: string; uid: string; parsedNF: ParsedNF; arquivoNome: string;
}): Promise<
  | { kind: 'created'; importId: string; produtosImportados: number; pendentes: Array<{ codigo: string; nome_produto: string; lote: string }> }
  | { kind: 'blocked'; importId: string; reason: string }
>;

export async function confirmManualLaunch(p: {
  tenantId: string; uid: string; identity: NFIdentity; chave_acesso?: string;
  tipo: 'rennova' | 'outra_marca'; produtos: ManualNfProductInput[];
}): Promise<
  | { kind: 'created' | 'complemented'; importId: string; produtosImportados: number }
  | { kind: 'blocked'; importId: string; reason: string }
  | { kind: 'invalid'; error: string }   // produto Rennova inexistente/inativo no catálogo
>;

export async function saveNfXmlFileBestEffort(tenantId: string, importId: string, buffer: Buffer): Promise<'salvo' | 'falhou'>;
```

**Transação de `confirmXmlImport`:**
1. Fora da transação:
   - `identidade = buildIdentityKey(...)`;
   - `codes = unique(parsedNF.produtos.map(p => p.codigo))`;
   - pré-checagem de orçamento: `checkWriteBudget(3, parsedNF.produtos.length)`, pior caso, já que cada linha vira inventário ou pendência.
2. `adminDb.runTransaction(async (tx) => { … })`, nesta ordem:
   1. `identSnap = await tx.get(identRef)`.
   2. Se existe: lê o registro (`tx.get(nf_imports/{id})`) para `hasPending`, chama `evaluateIdentityConflict('xml', …)` e retorna `blocked`.
   3. `counterSnap = await tx.get(counterRef)`.
   4. `masters = await tx.get(master_products where code in chunk)`, em blocos de 30.
   5. `plan = planXmlLines(...)`; `importId = String(nextImportId(counterSnap.data()?.ultimo_id))`.
   6. Escritas:
      - `tx.set(counterRef, { ultimo_id, updated_at })`;
      - `tx.set(importRef, { …NFImport, status: plan.pending.length ? 'novo_produto_pendente' : 'success', produtos_importados: plan.inventory.length, produtos_pendentes })`;
      - `tx.set(identRef, { nf_import_id: importId, origem: 'xml', created_at })`;
      - para cada item de inventário, `tx.set(inventoryRef(auto), {...})`, com os mesmos campos de hoje em `addInventoryItems` + `nf_id: importId`, `nf_numero`, `brand: 'Rennova'`, `codigo_produto`/`lote` normalizados;
      - para cada pendência, `tx.set(pending_master_products/{tenantId}_{importId}_{linha}, {...status: 'aberta'})`.
3. Retorna `created`. A rota chama `saveNfXmlFileBestEffort` depois e atualiza `arquivo_path`/`arquivo_status` com um `update` simples (Admin SDK).

**Transação de `confirmManualLaunch`:**
1. Identidade inexistente → contador + registro (`origem: 'manual'`, `lancamentos_manuais: 1`, `status: 'success'`, `produtos_pendentes: []`) + identidade + N itens.
2. Identidade existente com `origem: 'manual'` → `tx.update(registro, { produtos_importados: FieldValue.increment(N), lancamentos_manuais: FieldValue.increment(1), updated_at })` + N itens, sem consumir ID.
3. Identidade existente com `origem: 'xml'` → `blocked`.
4. Rennova: os produtos são resolvidos no catálogo **dentro** da transação (`tx.get` por código normalizado). Se algum não existir ou estiver inativo → `invalid` (422), porque o manual Rennova só oferece produtos ativos no autocomplete. Quantidade e valor são calculados pelo servidor (`calcularQuantidadeInventario`), e os campos `fragmentavel`, `unidades_por_embalagem`, `quantidade_embalagens` e `valor_por_embalagem` são gravados como hoje.
5. Outra marca: os valores são usados como informados.
6. Os itens mantêm os campos atuais do manual (`is_rennova`, `master_product_id`/`produto_id`, `nf_import_id` alias, `brand`, `category`, `dt_validade` como Timestamp).

**`POST /api/nf-imports/xml`**
- Auth: `Authorization: Bearer <idToken>` de `clinic_admin` ativo com `tenant_id`.
- Ordem: `verifyBearerToken` → `checkParseNfeClaims` → `checkRequestContentLength` → `formData` → `validateNfeUploadEntries` → `parseNfeXml` (422) → `checkWriteBudget` (422) → `confirmXmlImport` → arquivo best-effort.

```ts
// Request: multipart/form-data { file: File (1, *.xml, ≤10MB) }
type ConfirmXmlResponse =
  | { importId: string; idLabel: string; numero: string; serie: string; cnpj: string;
      produtosImportados: number; pendentes: Array<{ codigo: string; nome_produto: string; lote: string }>;
      arquivoSalvo: boolean }                                        // 201
  | { error: string; importId?: string };                            // 400|401|403|409|413|422|500
```

**`POST /api/nf-imports/manual`**
- Mesma auth. Corpo JSON validado.

```ts
interface ManualNfProductInput {
  codigo: string; nome_produto: string; lote: string;
  quantidade: number;         // como informado (embalagens, se Rennova fragmentável)
  valor_unitario: number;     // como informado (por embalagem, se fragmentável)
  dt_validade: string;        // 'YYYY-MM-DD'
  brand?: string; category?: string;  // outra_marca
}
interface ManualNfLaunchRequest {
  numero: string; cnpj: string; serie: string; chave_acesso?: string;
  tipo: 'rennova' | 'outra_marca';
  produtos: ManualNfProductInput[];   // 1..(MAX - 3)
}
type ManualNfLaunchResponse =
  | { importId: string; idLabel: string; complemento: boolean; produtosImportados: number } // 201 (criado) | 200 (complemento)
  | { error: string; importId?: string };                                                  // 400|401|403|409|422|500
```

| Status | Quando |
|---|---|
| 400 | Corpo inválido, `validateManualIdentity` falhou, produto com campo obrigatório ausente, quantidade ≤ 0, data inválida; no XML, guardas de arquivo. |
| 401 / 403 | Guardas de #390. |
| 409 | `blocked`: mensagem de RN-02 com `importId`. |
| 413 | Arquivo maior que 10MB. |
| 422 | Parse do XML; orçamento; produto Rennova inexistente ou inativo (manual). |

### 6.4 Mudanças na UI

**`/clinic/upload`**
- `handleUpload` → **"Ler XML"**: só `POST /api/parse-nf-xml` (com token) e, depois, `getMasterProductByCode` para cada código único, para marcar no preview "Não cadastrado — ficará pendente" (badge `variant="outline"`). Nada é gravado. Saem `uploadNFFile`, `checkNumeroNFStatus`, `createNFImport` e `updateNFImportStatus`, e também os estados `importId`/`existingXmlImport`.
- O preview mostra `formatNFLabel` + fornecedor, como hoje.
- `handleConfirmImport` → `POST /api/nf-imports/xml` com o mesmo `selectedFile` e o token.
  - **201** → tela de sucesso: título "Importação concluída — ID 1000", "{n} produto(s) adicionados ao estoque". Se `pendentes.length`, um `Alert` lista código, nome e lote dos não importados, com o texto do RF-03. Se `!arquivoSalvo`, aviso discreto "O arquivo XML não pôde ser arquivado; a importação foi concluída normalmente."
  - **409/422/4xx** → o `Alert` de erro existente com `error`.

**`/clinic/add-products`**
- Passo 2 com quatro campos:
  - "Número da NF" (obrigatório; dica "Será registrada como {n}" quando a normalização mudar o valor);
  - "CNPJ do emitente" (obrigatório; máscara `00.000.000/0000-00`, aceita letras nas 12 primeiras posições);
  - "Série" (obrigatória);
  - "Chave de acesso (opcional)" (44 caracteres, aceita com espaços ou com o prefixo `NFe`).
- `handleContinueToProducts` chama `validateManualIdentity`; em erro, toast com a mensagem.
- Ao adicionar produto à lista local, `codigo` e `lote` passam por `normalizeLeadingZeros`. O cálculo de fragmentação na lista local continua só para exibição.
- `handleSaveNF` → `POST /api/nf-imports/manual`. O payload envia `quantidade: p.fragmentavel ? p.quantidade_embalagens : p.quantidade` e `valor_unitario: p.fragmentavel ? p.valor_por_embalagem : p.valor_unitario`.
  - **201** → toast "Nota fiscal salva — ID 1000".
  - **200** com `complemento` → toast "Lançamento adicionado à NF já cadastrada (ID 1000)".
  - Em seguida, `router.push('/clinic/inventory')` como hoje.
  - **409/422/400** → toast destrutivo com `error`.
- Os resumos (l. 660–670 e 955–960) mostram `formatNFLabel`. Saem `writeBatch` e os `console.log` de `handleSaveNF`.

**`/clinic/inventory/[id]`** (l. 348–356): quando `item.nf_id` existe, mostra "NF-e {nf_numero} · ID {nf_id}".

**`/admin/pending-products`**
- A tabela passa a ter as colunas Clínica | Importação ("ID 1000") | NF (`formatNFLabel`) | Código | Produto | Lote | Qtd. | Data.
- "Cadastrar Produto" continua igual.
- "Reprocessar" chama `httpsCallable(functions, 'reprocessPendingMasterProducts')({ codigo })`. O toast mostra "{n} item(ns) incorporado(s)", ou "Produto ainda não está ativo no catálogo" se `n == 0` e o produto não estiver ativo. Depois, recarrega a lista.
- O texto do estado vazio continua.

### 6.5 Regras

**`firestore.rules`** (mudanças):

```
// Subcoleções do tenant gravadas apenas pelo servidor (Admin SDK) — client
// não escreve nem como system_admin (BUGFIX-identidade-e-duplicidade-nfe).
function isServerManagedTenantCollection(collectionId) {
  return collectionId in ['nf_imports', 'nf_identidades', 'contadores'];
}

function isRestrictedTenantCollection(collectionId) {
  return collectionId in ['nf_imports', 'financeiro', 'precificacao_procedimentos',
                          'nf_identidades', 'contadores'];
}

match /tenants/{tenantId}/{collectionId}/{document=**} {
  allow read: if isSystemAdmin();
  allow write: if isSystemAdmin() && !isServerManagedTenantCollection(collectionId);
  // ... demais allow read inalterados (tenant fora das restritas; consultor pela allowlist)
}

// nf_imports — leitura só clinic_admin do tenant; nenhuma escrita de client.
match /tenants/{tenantId}/nf_imports/{nfImportId} {
  allow read: if belongsToTenant(tenantId) && hasRole('clinic_admin');
}
// nf_identidades e contadores: sem bloco dedicado — só leitura do system_admin (genérico).

match /master_products/{productId} {
  allow read: if isAuthenticated();
  allow create: if isSystemAdmin()
    && request.resource.data.code.matches('^[1-9][0-9]{0,6}$')
    && request.resource.data.name is string && request.resource.data.name.size() > 0;
  allow update: if isSystemAdmin()
    && (!('code' in request.resource.data) || request.resource.data.code.matches('^[1-9][0-9]{0,6}$'))
    && (!('name' in request.resource.data)
        || (request.resource.data.name is string && request.resource.data.name.size() > 0));
  allow delete: if isSystemAdmin();
}

match /pending_master_products/{docId} {
  allow read: if isSystemAdmin();   // escrita só Admin SDK
}
```

> Ao aplicar, preserve o restante do bloco genérico como está na base (em `develop` depois de #389: `consultantReadableSubcollection`). Só a linha `allow read, write: if isSystemAdmin();` é dividida em duas.

**`storage.rules`**, `match /danfe/{tenantId}/{nfId}`:
- mantém `allow read: if isSystemAdmin();` e `allow read: if belongsToTenant(tenantId);`;
- remove os dois `allow write` (system_admin e tenant);
- atualiza o comentário: "gravado só pelo servidor (Admin SDK) em `danfe/{tenantId}/{importId}.xml`".

**`firestore.indexes.json`:** `{ collectionGroup: 'pending_master_products', queryScope: 'COLLECTION', fields: [status ASC, created_at DESC] }`.

### 6.6 Cloud Functions

```ts
// functions/src/onMasterProductWritten.ts
export const onMasterProductWritten = onDocumentWritten(
  { document: 'master_products/{productId}', region: 'southamerica-east1' },
  async (event) => {
    const codigo = shouldResolvePendingForProduct(event.data?.before.data() ?? null, event.data?.after.data() ?? null);
    if (!codigo) return;
    await resolvePendingForCode(admin.firestore(), codigo); // guard admin.app()/initializeApp como nas demais
  }
);

// functions/src/reprocessPendingMasterProducts.ts — onCall, is_system_admin obrigatório
//   input { codigo: string } -> { incorporados: number; produtoAtivo: boolean }

// functions/src/pendingResolution.ts
export async function resolvePendingForCode(db, codigoRaw): Promise<{ incorporados: number; produtoAtivo: boolean }>;
```

1. Normaliza `codigo`; busca o master por `code == codigo`. Se ausente ou inativo, retorna `{ 0, false }`.
2. `pending_master_products where codigo == X and status == 'aberta'`; agrupa por `(tenant_id, nf_import_id)`; aplica `chunkPendingLines`.
3. Para cada bloco, `db.runTransaction`:
   - `tx.get` de cada pendência (descarta as que não estão mais `aberta`, o que garante idempotência) e do registro;
   - `planPendingResolution`;
   - `tx.set` dos itens de `inventory` (mesmos campos da importação XML, com cabeçalho lido do registro);
   - `tx.update` das pendências (`status: 'resolvida'`, `inventory_id`, `resolved_at`);
   - `tx.update` do registro: remove de `produtos_pendentes` os pares (código, lote) resolvidos, `produtos_importados += n`, `status` passa a `success` se a lista ficar vazia, `updated_at`;
   - `tx.set` da notificação em `tenants/{t}/notifications` (`type: 'nf_pending_resolved'`, `priority: 'medium'`, `title: 'Produtos incorporados ao estoque'`, `message: buildPendingResolvedMessage(...)`, `read: false`, `metadata: { nf_import_id, product_names }`).
4. Erros são registrados por bloco e não interrompem os demais.

---

## 7. Plano de Implementação

### STEP 1 — Identidade e normalização (puras)

**Objetivo:** Implementar e testar `src/lib/nfIdentity.ts`.

**Arquivos afetados:**
- `src/lib/nfIdentity.ts`: criar (Seção 6.2).
- `src/types/nf.ts`: `NFIdentity`.
- `src/__tests__/nfIdentity.test.ts`: criar.

**Ações:**
1. Implementar as funções da Seção 6.2 (bloco `nfIdentity.ts`).
2. Antes de fechar a função de valor do caractere (A4), conferir na NT 2025.001 vigente o leiaute da chave e o cálculo do DV do CNPJ alfanumérico.

**Validação:** `npm run test -- nfIdentity` verde; `npm run lint` e `npm run type-check` sem erros.

**Commits:** `fix(inventory): add NF-e identity and normalization helpers` e `test(inventory): cover NF-e identity and normalization helpers`

---

### STEP 2 — Parser sem coerção e com identidade

**Objetivo:** `parseNfeXml` devolve identidade, chave e campos normalizados, e corrige A1/A5.

**Arquivos afetados:**
- `src/lib/parseNfeXml.ts`: Seção 6.2.
- `src/types/nf.ts`: `ParsedNF`, `XmlParseErrorCode`.
- `src/__tests__/parseNfeXml.test.ts`: `makeXml` com `serie` e `Id` padrão válido (`nNF 27117`, `CNPJ 12345678000199`, série 1); casos novos.

**Ações:**
1. Ativar `parseTagValue: false`, ler a identidade e conferir a chave.
2. Normalizar `codigo` e `lote`.
3. Garantir que a tela atual continua compilando. `ParsedNF` só ganha campos e `cnpj_fornecedor` vira obrigatório, então a tela atual continua funcionando.

**Validação:** `npm run test -- parseNfeXml` verde, com os casos antigos e os novos, inclusive `tPag=01` → "Dinheiro". `npm run type-check`.

**Commits:** `fix(inventory): stop numeric coercion and normalize NF-e XML fields` e `test(inventory): cover normalized fields and access key in parser`

---

### STEP 3 — Extrair o cálculo de quantidade

**Objetivo:** `calcularQuantidadeInventario` passa a ficar num módulo puro, importável pela rota server-side.

**Arquivos afetados:**
- `src/lib/inventoryQuantity.ts`: criar (move a função e os tipos `CalcInventarioParams`/`CalcInventarioResult`).
- `src/lib/services/inventoryService.ts`: `export { calcularQuantidadeInventario } from '@/lib/inventoryQuantity'` (e os tipos).

**Validação:** `npm run test` (testes existentes de `calcularQuantidadeInventario`, se houver, continuam verdes) e `npm run type-check`.

**Commit:** `refactor(inventory): extract pure inventory quantity calculation`

---

### STEP 4 — Planejador puro

**Objetivo:** Implementar e testar `src/lib/nfImportPlanner.ts`.

**Arquivos afetados:**
- `src/lib/nfImportPlanner.ts`: criar.
- `src/__tests__/nfImportPlanner.test.ts`: criar.

**Validação:** `npm run test -- nfImportPlanner` verde.

**Commits:** `fix(inventory): add pure NF import planner and identity conflict rules` e `test(inventory): cover NF import planner and write budget`

---

### STEP 5 — Rotas de confirmação no servidor

**Objetivo:** `POST /api/nf-imports/xml` e `POST /api/nf-imports/manual` funcionando com transação Admin SDK. As telas ainda não as chamam.

**Arquivos afetados:**
- `src/lib/firebase-admin.ts`: `getAdminStorage()`.
- `src/lib/services/nfImportServer.ts`: criar (Seção 6.3).
- `src/app/api/nf-imports/xml/route.ts` e `src/app/api/nf-imports/manual/route.ts`: criar.
- `src/types/nf.ts` e `src/types/pendingMasterProduct.ts`: tipos novos.
- `src/__tests__/nfImportRoutes.test.ts`: criar (Seção 8.2).

**Ações:**
1. Implementar o serviço e as rotas na ordem de guardas da Seção 6.3.
2. Pendências com ID determinístico `${tenantId}_${importId}_${linha}`.
3. Testes de rota com `../lib/firebase-admin`, `@/lib/services/nfImportServer` e `@/lib/parseNfeXml` mockados (padrão de `auditLogRoutes.test.ts` e `parseNfXmlRoute.test.ts`).

**Validação:**
- `npm run test` verde.
- Emulador com `curl -F file=@nfA.xml -H "Authorization: Bearer <token clinic_admin>" http://localhost:3000/api/nf-imports/xml` → 201 `{"importId":"1000"…}`.
- O mesmo comando de novo → 409 "Esta NF já foi cadastrada (ID 1000)."

**Commits:** `fix(api): confirm NF-e imports atomically with Admin SDK` e `test(api): cover NF import confirmation routes responses`

---

### STEP 6 — Tela XML usa a rota

**Objetivo:** O preview não grava nada; a confirmação usa a rota; a tela de resultado mostra o ID e os não importados.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/upload/page.tsx`: Seção 6.4.
- `src/lib/services/nfImportService.ts`: remover `uploadNFFile`, `createNFImport`, `updateNFImportStatus`, `processNFAndAddToInventory`.
- `src/lib/services/pendingMasterProductService.ts`: remover `registerPendingMasterProducts`.
- `src/lib/services/inventoryService.ts`: remover `addInventoryItems` e `getInventoryProdutoLoteKeysByNfId` se não houver outro chamador.

**Validação:** emulador. "Ler XML" não cria documento nem arquivo. "Confirmar" cria `nf_imports/1000`, `nf_identidades/12345678000199_1_26229`, `contadores/nf_imports` (`ultimo_id: 1000`), o inventário e `danfe/test-clinic-a/1000.xml`. `npm run type-check` e `npm run build`.

**Commit:** `fix(inventory): confirm XML import through server route`

---

### STEP 7 — Inserção manual com identidade

**Objetivo:** Exigir CNPJ e série, aceitar a chave opcional, gravar pela rota e complementar o mesmo ID.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/add-products/page.tsx`: Seção 6.4.
- `src/lib/services/nfImportService.ts`: remover `checkNumeroNFStatus`.
- `src/types/nf.ts`: remover `NFNumeroStatus` e `NFImportCreate`.

**Ações:**
1. Ajustar o Passo 2, `handleContinueToProducts`, a lista local (normalização) e `handleSaveNF`.
2. `git grep -n "checkNumeroNFStatus\|NFNumeroStatus\|createNFImport\|registerPendingMasterProducts\|processNFAndAddToInventory"` deve retornar só documentação.

**Validação:** emulador. O primeiro lançamento cria "ID 100x". Repetir com a mesma identidade → "Lançamento adicionado à NF já cadastrada (ID 100x)", e `lancamentos_manuais` vai a 2. `npm run lint`, `npm run type-check` e `npm run build`.

**Commit:** `fix(inventory): require issuer identity on manual NF entry`

---

### STEP 8 — Código do catálogo sem zeros à esquerda

**Objetivo:** Fazer o código do catálogo master usar a mesma forma normalizada do `cProd`.

**Arquivos afetados:**
- `src/types/masterProduct.ts`: `validateProductCode` (1–7 dígitos, não pode ser só zeros).
- `src/lib/services/masterProductService.ts`: normalização na gravação e na busca.
- `src/app/(admin)/admin/products/new/page.tsx` e `[id]/page.tsx`: texto de ajuda "até 7 dígitos; zeros à esquerda são removidos".

**Ações:**
1. Antes do merge em `develop`, rodar no console do projeto de produção (Admin SDK ou Firestore UI) a busca por códigos que começam com `0`: `master_products where code >= '0' and code < '1'`. O resultado esperado é vazio (os 112 códigos conhecidos não têm zero à esquerda). Se aparecer algum, registrar no PR e normalizar com um script pontual antes do deploy das rules.

**Validação:** cadastrar `0123456` no emulador → gravado `123456`. `npm run test`.

**Commit:** `fix(admin): store master product codes without leading zeros`

---

### STEP 9 — Incorporação automática (Cloud Functions)

**Objetivo:** Ativar um produto no catálogo lança as pendências e notifica as clínicas.

**Arquivos afetados:**
- `src/lib/nfPendingResolutionRules.ts`: criar.
- `functions/src/nfPendingResolutionRules.ts`: criar como espelho, com cabeçalho igual ao de `alertRules.ts`.
- `functions/src/pendingResolution.ts`, `functions/src/onMasterProductWritten.ts`, `functions/src/reprocessPendingMasterProducts.ts`: criar.
- `functions/src/index.ts`: exports.
- `src/types/notification.ts`, `src/lib/services/notificationService.ts`, `src/components/notifications/NotificationBell.tsx`: tipo `nf_pending_resolved`.
- `src/__tests__/nfPendingResolutionRules.test.ts`: criar, com bloco de paridade importando `../../functions/src/nfPendingResolutionRules`.
- `.github/workflows/deploy-gscandelari-dev.yml`: incluir `onMasterProductWritten` e `reprocessPendingMasterProducts` no `lib/index.js` gerado e no `--only`.

**Validação:**
- `npm run test` verde, incluindo a paridade.
- `cd functions && npm run build` sem erros.
- No emulador com functions: criar a pendência pelo STEP 6 (produto fora do catálogo) e cadastrar o produto. O item entra no inventário, a pendência fica `resolvida`, o registro passa a `success` e a notificação aparece no sino da clínica.

**Commits:** `feat(inventory): auto-import pending NF items on catalog activation`, `test(inventory): cover pending resolution rules and mirror parity` e `ci(deploy): deploy pending resolution functions to dev`

---

### STEP 10 — Telas do admin e do inventário

**Objetivo:** Mostrar "ID 1000" no admin e no detalhe do item, e oferecer "Reprocessar".

**Arquivos afetados:**
- `src/app/(admin)/admin/pending-products/page.tsx`: Seção 6.4.
- `src/lib/services/pendingMasterProductService.ts`: `listPendingMasterProducts` com o novo filtro e os campos novos; remover `resolvePendingMasterProduct`.
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx`: RF-14.
- `firestore.indexes.json`: índice `(status, created_at)`.

**Validação:** emulador. A lista do admin mostra só as pendências abertas, com ID. "Reprocessar" em um código já ativo incorpora o item. `npm run build`.

**Commit:** `feat(admin): show import ID and reprocess action on pending products`

---

### STEP 11 — Rules + testes de rules

**Objetivo:** Fechar a escrita do client nas coleções gerenciadas pelo servidor (D7).

**Arquivos afetados:**
- `firestore.rules`, `storage.rules`: Seção 6.5.
- `tests/rules/firestore-tenant-subcollections.test.ts`: Seção 8.3.

**Ações:**
1. Aplicar as rules.
2. Ajustar os testes existentes de `nf_imports`: o `clinic_admin` e o system_admin agora **falham** ao escrever.
3. Adicionar os casos novos, sempre com get **e** list.

**Validação:** `npm run test:rules` verde. Repetir os STEPs 6, 7, 9 e 10 no emulador com as rules novas (Firestore e Storage): tudo continua funcionando, porque as escritas vêm do Admin SDK.

**Commits:** `fix(firebase): block client writes to server-managed NF collections` e `test(firebase): cover NF collections rules for get and list`

---

### STEP 12 — Validação Manual

**Objetivo:** Confirmar de ponta a ponta a identidade, a atomicidade, a concorrência, o ID sequencial, o complemento manual, a normalização, as pendências com incorporação e notificação, e as rules. Este roteiro é a **fonte do caderno E2E** `tests/e2e/UC-10-importar-nfe-via-upload-de-xml.spec.ts` (e de trechos de `UC-11-…` e `UC-12-…`), que o `qa-agent` (Modo A) gera conforme a regra 8 do `CLAUDE.md`.

**Pré-requisitos:**
- `cd functions && npm run build`.
- `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage,functions`. As functions de e-mail podem avisar sobre secrets ausentes; isso não afeta as functions novas.
- `npm run test:e2e:seed` e `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` (variáveis do `playwright.config.ts`).
- Catálogo pelo Emulator UI, como system_admin: `master_products/p1` com `{ code: '3076528', name: 'BOTOX 100UI', active: true, fragmentavel: false }`. **Não** cadastrar `9999999`.
- XMLs a partir do `makeXml` de `src/__tests__/parseNfeXml.test.ts` (cProd `3076528`, lote `BT2024A`), ajustando `Id`, `<serie>`, `<nNF>` e `<CNPJ>`. As chaves abaixo usam cUF 35, AAMM 2503, modelo 55, tpEmis 1 e cNF 00026229; o DV foi conferido com a chave pública de exemplo `52060433009911002506550120000007800267301615` (DV 5).

| Arquivo | CNPJ | Série | nNF | `Id` |
|---|---|---|---|---|
| `nfA.xml` | 12345678000199 | 1 | 26229 | `NFe35250312345678000199550010000262291000262296` |
| `nfB.xml` | 98765432000110 | 1 | 26229 | `NFe35250398765432000110550010000262291000262297` |
| `nfC.xml` | 12345678000199 | 2 | 26229 | `NFe35250312345678000199550020000262291000262292` |
| `nfD.xml` | 01234567000189 | 1 | 26229 | `NFe35250301234567000189550010000262291000262298` |

- `nfA-zeros.xml`: igual a `nfA.xml` com `<nNF>026229</nNF>`, `<serie>001</serie>`, `<cProd>0003076528</cProd>`, `<nLote>00BT2024A</nLote>` e `<tPag>01</tPag>`.
- `nfE-pendente.xml`: CNPJ 12345678000199, série 3, nNF 26229 (calcular o `Id` com `computeChaveAcessoDV` do STEP 1), dois `<det>`: `3076528` e `9999999` (lote `L9`).
- `nfSemId.xml` = `nfA.xml` sem `Id`; `nfDvErrado.xml` = `nfA.xml` com o último dígito do `Id` trocado; `nfChaveDivergente.xml` = `nfA.xml` com `<nNF>26230</nNF>`.
- Logins `qa.clinic-admin-a@curvamestra.test`, `qa.clinic-admin-b@curvamestra.test`, `qa.system-admin@curvamestra.test` / `TEST_PASSWORD` (`tests/e2e/fixtures/seed-data.ts`).

**Roteiro A — Preview sem gravação e ID sequencial (sempre executar):**
1. Clinic admin A → `/clinic/upload` → `nfA.xml` → "Ler XML". **Esperado:** preview com "NF 26229 · série 1 · CNPJ 12.345.678/0001-99". O Emulator UI **não** mostra `nf_imports`, `nf_identidades` nem `danfe/`.
2. Fechar a aba e repetir o passo 1. **Esperado:** nenhum bloqueio (nada foi gravado).
3. Confirmar. **Esperado:** "Importação concluída — ID 1000". Existem `nf_imports/1000` (`id_sequencial: 1000`, `identidade: 12345678000199_1_26229`, `chave_acesso`, `status: success`), `nf_identidades/12345678000199_1_26229`, `contadores/nf_imports` com `ultimo_id: 1000`, o inventário com `nf_id: '1000'` e `danfe/test-clinic-a/1000.xml`.
4. `/clinic/inventory` → abrir o item. **Esperado:** "NF-e 26229 · ID 1000". Em nenhuma tela aparece "NF 1000".

**Roteiro B — Duplicidade e identidade (sempre executar):**
5. `nfA.xml` de novo → Confirmar. **Esperado:** 409 "Esta NF já foi cadastrada (ID 1000)." Sem documento novo e sem arquivo novo.
6. `nfA-zeros.xml` → preview com "NF 26229 · série 1", código `3076528`, lote `BT2024A` e forma de pagamento "Dinheiro". Confirmar → 409 "(ID 1000)" (mesma identidade).
7. `nfB.xml` → **ID 1001** (outro CNPJ). `nfC.xml` → **ID 1002** (outra série). `nfD.xml` → preview com "CNPJ 01.234.567/0001-89" → **ID 1003**.
8. `nfSemId.xml` → "Chave de acesso … não encontrada". `nfDvErrado.xml` → "Chave de acesso … inválida". `nfChaveDivergente.xml` → "A chave de acesso não confere…". Nada gravado; o contador continua em 1003.
9. Clinic admin **B** → `nfA.xml` → **ID 1000** na clínica B (contador e identidade por clínica).

**Roteiro C — Concorrência (sempre executar):**
10. Clinic admin A, NF nova (`nfA.xml` com nNF 26300 e o `Id` recalculado). Abrir **duas abas** até o preview e confirmar nas duas quase ao mesmo tempo. **Esperado:** uma recebe "ID 1004" e a outra 409 "Esta NF já foi cadastrada (ID 1004)." Um único item no inventário por (código, lote).
11. Alternativa por terminal: dois `curl` em paralelo para `/api/nf-imports/xml` com o mesmo arquivo (`& wait`). **Esperado:** um 201 e um 409.

**Roteiro D — Inserção manual (sempre executar):**
12. `/clinic/add-products` → Outras Marcas → número `0055501`, CNPJ `98.765.432/0001-10`, série `001`, sem chave. **Esperado:** dica "Será registrada como 55501". Adicionar um produto (código `0042`, lote `007X`) → salvar → "Nota fiscal salva — ID 1005". No Emulator UI: `numero_nf: '55501'`, `serie: '1'`, `cnpj_emitente: '98765432000110'`, e o item com `codigo_produto: '42'`, `lote: '7X'`.
13. Repetir com a mesma identidade e outro produto. **Esperado:** "Lançamento adicionado à NF já cadastrada (ID 1005)", com `lancamentos_manuais: 2` e o contador inalterado.
14. Manual com a identidade de `nfA.xml` (26229 / 1 / 12.345.678/0001-99). **Esperado:** 409 "…importada via XML (ID 1000)…". (A regra (b) revogada é coberta no passo 15.)
15. Importar via XML uma NF cujo registro manual foi criado no passo 12: montar um XML com CNPJ 98765432000110, série 1, nNF 55501 e o `Id` correspondente. **Esperado:** 409 "Esta NF já foi cadastrada manualmente (ID 1005) e não pode ser importada via XML."
16. CNPJ `11.111.111/1111-11` → "CNPJ do emitente inválido". Série vazia → "Série inválida". Chave informada que não bate → "A chave de acesso não confere…". Número `000` → "Número da NF inválido".
17. Rennova manual com produto fragmentável (cadastrar no catálogo `p2 { code: '3000001', fragmentavel: true, unidades_por_embalagem: 10, active: true }`), 2 embalagens a R$ 100. **Esperado:** inventário com `quantidade_inicial: 20`, `valor_unitario: 10`, `quantidade_embalagens: 2`, `valor_por_embalagem: 100`, igual ao comportamento atual.

**Roteiro E — Pendências e incorporação automática (sempre executar):**
18. Clinic admin A → `nfE-pendente.xml`. O preview marca `9999999` como "Não cadastrado — ficará pendente". Confirmar. **Esperado:** "ID 100x", 1 produto importado, e um `Alert` listando `9999999 · … · L9`. O registro fica `novo_produto_pendente` e `pending_master_products/test-clinic-a_100x_1` fica `aberta`, com lote, quantidade, validade e valor. **Achado A3:** a operação conclui sem `permission-denied`.
19. Clinic admin B importa uma NF própria (outra identidade) também com `9999999`. **Esperado:** pendência aberta na clínica B.
20. Reenviar `nfE-pendente.xml` na clínica A. **Esperado:** 409 "Esta NF já foi cadastrada (ID 100x). Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo."
21. System admin → `/admin/pending-products`. **Esperado:** duas linhas (A e B) com "ID …", NF, lote e quantidade. Clicar em "Cadastrar Produto" na linha de `9999999` e salvar (ativo).
22. **Esperado** em até alguns segundos:
    - nas clínicas A e B, os itens de `9999999` aparecem no inventário;
    - as pendências ficam `resolvidas` e somem da lista do admin;
    - o registro da clínica A passa a `success` com `produtos_pendentes: []`;
    - o sino de cada clínica mostra "A NF (ID 100x) foi atualizada: o produto … foi adicionado ao inventário automaticamente."
23. Idempotência: editar o nome do produto `9999999` no catálogo (o trigger dispara, mas o código não mudou e o produto já estava ativo). **Esperado:** nenhum item novo e nenhuma notificação nova.
24. Reativação: desativar `3076528`, importar uma NF nova com ele (vira pendência) e reativar o produto. **Esperado:** incorporação e notificação.
25. "Reprocessar": criar uma pendência e, pelo Emulator UI, ativar o produto sem disparar o trigger (com o emulador de functions parado) e depois religar o emulador. Na tela do admin, "Reprocessar" → toast "1 item(ns) incorporado(s)".

**Roteiro F — Rules (sempre executar; complementa `npm run test:rules`):**
26. No console do navegador, logado como clinic admin A (SDK exposto no bundle de dev), ou com `@firebase/rules-unit-testing`:
    - `setDoc` em `tenants/test-clinic-a/nf_imports/9999` → `permission-denied`;
    - `updateDoc` em `nf_imports/1000` → negado;
    - `getDoc` em `nf_identidades/…` → negado;
    - `addDoc` em `pending_master_products` → negado;
    - upload no Storage `danfe/test-clinic-a/x.xml` → negado.
27. Logado como system admin: `updateDoc` em `nf_imports/1000` → negado; `getDoc`/`getDocs` em `nf_imports` → permitido.

**Roteiro G — Domínio Firebase pessoal (após merge na branch pessoal):**
28. Em `dev-gscandelari.web.app`:
    - repetir os passos 1, 3, 5, 7 (`nfB`), 12, 13, 18 e 21–22 com XMLs reais de teste (NF-e 026229 se disponível);
    - conferir no console do Firebase que as functions `onMasterProductWritten` e `reprocessPendingMasterProducts` foram publicadas;
    - conferir que o índice `pending_master_products (status, created_at)` está `Enabled`.

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Jest — funções puras

`src/__tests__/nfIdentity.test.ts`

| Função | Cenários obrigatórios |
|---|---|
| `normalizeNumeroNF` | `'026229'`→`'26229'`; `' 026.229 '`→`'26229'`; `26229`→`'26229'`; `'000'`→`''`; `'abc'`→`''`; `null`→`''`. |
| `normalizeSerie` | `'001'`→`'1'`; `'000'`→`'0'`; `'1000'`→`''`; `''`→`''`. |
| `normalizeLeadingZeros` | `'0012345'`→`'12345'`; `'00A12'`→`'A12'`; `'000'`→`'0'`; `' 007X '`→`'7X'`; `'BT2024A'`→`'BT2024A'`; `''`→`''`. |
| `normalizeCnpj` / `isValidCnpj` | com máscara e válido → 14 posições; DV errado → `''`; 13 dígitos → `''` (sem reparo); `'11111111111111'` → inválido; um CNPJ alfanumérico válido construído com a regra `charCode-48` → aceito. |
| `computeChaveAcessoDV` | `'5206043300991100250655012000000780026730161'`→`5`; as quatro chaves da tabela do STEP 12 → `6, 7, 2, 8`. |
| `parseChaveAcesso` | com e sem `NFe`; com espaços; 43 posições → null; DV errado → null; letra fora das posições do CNPJ → null. |
| `chaveMatchesIdentity` | igual → true; série, número ou CNPJ diferente → false. |
| `validateManualIdentity` | válido sem chave; válido com chave coerente; cada erro da Seção 6.2. |
| `buildIdentityKey` / `formatImportId` / `formatNFLabel` / `formatCnpj` | formatos exatos; `formatImportId(1000)` = `'ID 1000'`. |

`src/__tests__/parseNfeXml.test.ts` (novos): `Id` válido → `chave_acesso`, `serie`, `cnpj_fornecedor`; `<CNPJ>01234567000189</CNPJ>` preservado (A1); `<nNF>026229</nNF>`, `<serie>001</serie>` normalizados; `cProd 0003076528` → `'3076528'`; `nLote 00BT2024A` → `'BT2024A'`; `tPag 01` → `'Dinheiro'` (A5); sem `Id` → `MISSING_ACCESS_KEY`; DV errado e chave divergente → `INVALID_ACCESS_KEY`; `emit/CPF` → `INVALID_ISSUER`; CNPJ com DV inválido → `INVALID_ISSUER`. Todos os casos existentes continuam verdes.

`src/__tests__/nfImportPlanner.test.ts`

| Função | Cenários obrigatórios |
|---|---|
| `nextImportId` | `undefined`→1000; `1000`→1001; `5`→1000. |
| `evaluateIdentityConflict` | xml×null → create; manual×null → create; manual×manual → complement (mesmo id); xml×manual → blocked 409 com "cadastrada manualmente (ID n)"; xml×xml → blocked "Esta NF já foi cadastrada (ID n)."; xml×xml com `hasPending` → mensagem com a frase de pendentes; manual×xml → blocked. |
| `planXmlLines` | todos no catálogo; um ausente → pending; um inativo → pending; fragmentável → quantidade × unidades e valor ÷ unidades; mesma linha de código com dois lotes → duas entradas. |
| `checkWriteBudget` | `(3, 497)` → ok; `(3, 498)` → 422; `(1, 499)` → ok; `(1, 500)` → 422. |

`src/__tests__/nfPendingResolutionRules.test.ts`

| Função | Cenários obrigatórios |
|---|---|
| `shouldResolvePendingForProduct` | criação ativa → código; criação inativa → null; false→true → código; true→true com mesmo código → null; true→true com código alterado → novo código; exclusão → null; código com zeros → normalizado. |
| `planPendingResolution` | não fragmentável; fragmentável (`quantidade_embalagens`/`valor_por_embalagem`); `unidades_por_embalagem` ausente → como não fragmentável. |
| `chunkPendingLines` | 0, 248, 249 e 500 itens. |
| `buildPendingResolvedMessage` | um produto (singular); três produtos (lista "X, Y, Z"); nomes repetidos deduplicados. |
| **Paridade** | Para cada caso acima, chamar também a versão de `../../functions/src/nfPendingResolutionRules` (e o `calcularQuantidadeInventario` espelhado contra `@/lib/inventoryQuantity`) e esperar o mesmo resultado. |

### 8.2 Jest — rotas (`src/__tests__/nfImportRoutes.test.ts`)

Lógica de segurança, prioridade alta. Mocks de `../lib/firebase-admin`, `@/lib/services/nfImportServer` e `@/lib/parseNfeXml`.

| Rota | Cenário | Esperado |
|---|---|---|
| ambas | sem token / token inválido | 401; serviço não chamado |
| ambas | `clinic_user`, consultor, system_admin, `active: false` | 403 |
| xml | `content-length` 20MB | 413 |
| xml | 2 arquivos / `.pdf` | 400 |
| xml | parser lança `INVALID_ACCESS_KEY` | 422 com a mensagem |
| xml | 498 linhas | 422; serviço não chamado |
| xml | serviço `created` | 201 com `importId`, `idLabel: 'ID 1000'`, `pendentes` |
| xml | serviço `blocked` | 409 `{ error, importId }` |
| xml | `tenantId` passado ao serviço vem do token, mesmo com `tenantId` forjado no form | sim |
| manual | identidade inválida (CNPJ DV) | 400 |
| manual | `produtos` vazio / quantidade 0 / data inválida | 400 |
| manual | serviço `created` / `complemented` | 201 / 200 com `complemento` |
| manual | serviço `blocked` / `invalid` | 409 / 422 |
| manual | `tenantId` no corpo é ignorado (vem do token) | sim |

### 8.3 Regras — `npm run test:rules` (`tests/rules/firestore-tenant-subcollections.test.ts`)

Toda leitura é testada com **get** (`getDoc`) **e list** (`getDocs(query(collection(...)))`), conforme a lição do PR #344 no cabeçalho da suíte.

| Coleção | Cenário | Esperado |
|---|---|---|
| `nf_imports` (seed `1000`) | clinic_admin A: get e list | sucesso |
| | clinic_user A, consultor com acesso, clinic_admin B: get e list | falha |
| | system_admin: get e list | sucesso |
| | clinic_admin A: `setDoc` novo, `updateDoc`, `deleteDoc` | falha (cada um) |
| | system_admin: `setDoc` novo, `updateDoc`, `deleteDoc` | falha (cada um) |
| `nf_identidades` (seed `12345678000199_1_26229`) | clinic_admin A, clinic_user A, consultor: get e list | falha |
| | system_admin: get e list | sucesso; `setDoc`/`deleteDoc` → falha |
| | clinic_admin A: `setDoc` | falha |
| `contadores` (seed `nf_imports`) | clinic_admin A, consultor: get e list | falha |
| | system_admin: get e list | sucesso; `updateDoc` → falha |
| `pending_master_products` (seed) | system_admin: get e list | sucesso; `updateDoc`/`deleteDoc` → falha |
| | clinic_admin A: get, list e `setDoc` (create) | falha (o create era permitido antes) |
| `master_products` | system_admin cria `code: '3076528'` | sucesso |
| | `code: '123456'` | sucesso |
| | `code: '0123456'` / `'12345678'` | falha |
| Regressão do bloco genérico | system_admin `updateDoc` em `inventory` e `financeiro` | sucesso |
| | clinic_admin A `updateDoc` em `inventory` | sucesso |

O Storage não é coberto pela suíte de rules (que roda só o emulador de Firestore). Ele é validado no STEP 12, passo 26.

### 8.4 E2E

- `npm run test:e2e`: regressão.
- Depois da conclusão, o `qa-agent` (Modo A) gera o caderno a partir do STEP 12. O caderno precisa de: XMLs em fixture versionada (a tabela traz as chaves), `master_products` no seed e o emulador de functions no `test:e2e`. O `qa-agent` deve **sinalizar** essas extensões em vez de inventá-las. Revisão humana obrigatória.

---

## 9. Checklist de Definition of Done

```
[ ] #389/#390 em develop antes de criar a branch (ou cherry-pick registrado no PR)
[ ] npm run lint                — zero erros ou warnings
[ ] npm run type-check          — zero erros TypeScript
[ ] npm run build               — build de produção sem falhas
[ ] cd functions && npm run build — sem erros
[ ] npm run test                — verde (nfIdentity, nfImportPlanner, nfPendingResolutionRules + paridade, nfImportRoutes, parseNfeXml)
[ ] npm run test:rules          — verde, get E list em todos os cenários de leitura
[ ] npm run test:e2e            — verde (regressão)
[ ] Multi-tenant: tenantId só do token; todas as escritas sob tenants/{tenantId}; pendências com tenant_id
[ ] Segurança: nenhum secret; nenhum log novo com CNPJ completo, chave ou conteúdo do XML
[ ] git grep sem chamadores de checkNumeroNFStatus/createNFImport/processNFAndAddToInventory/registerPendingMasterProducts/resolvePendingMasterProduct
[ ] Nenhuma tela exibe "NF 1000" — o ID aparece sempre como "ID 1000"
[ ] Consulta de códigos de master_products com zero à esquerda em produção executada (STEP 8)
[ ] deploy-gscandelari-dev.yml publica as duas functions novas
[ ] STEP 12 executado (Roteiros A–G)
[ ] Branch pessoal: task branch mergeada em gscandelari_setup e validada em dev-gscandelari.web.app
[ ] PR: aberto para develop com template preenchido, incluindo nota de release (abaixo)
[ ] Nota de release no PR: produção NÃO publica firestore:rules, firestore:indexes nem storage pelo CI
    (deploy-firebase.yml) — publicar manualmente junto com hosting/functions na release
[ ] uml-use-case-writer: UC-10, UC-11, UC-12, UC-31/32, UC-44
[ ] uc-issues-tracker (Modo B): fechar UC-10-RN-14/RN-15, UC-11-RN-12; UC-10-RN-02 parcialmente decidido;
    registrar A1–A5 como corrigidos; registrar a questão futura da Seção 4.4
[ ] qa-agent (Modo A) acionado para o caderno UC-10 (+ trechos UC-11/UC-12)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Rules, índices e Storage não publicados em produção (o CI de produção não os inclui) e o client novo convivendo com rules antigas | Alta | Médio | Item do DoD com publicação manual na release. As rules antigas são **mais** permissivas, então o fluxo novo funciona com elas; o risco é só a proteção ficar atrasada. |
| Functions novas não publicadas no dev (lista explícita no workflow) | Alta, se esquecido | Médio | STEP 9 altera o workflow; passo 28 confere a publicação. |
| Leiaute do CNPJ alfanumérico diferente do assumido (A4) | Média | Médio | Conferir a NT no STEP 1; testes com CNPJ alfanumérico construído pela regra. |
| Conflito com #389/#390 | Alta, sem sincronização | Baixo | Pré-requisito da Seção 0. |
| Divergência entre `src/lib` e o espelho em `functions/src` | Média | Médio | Teste de paridade obrigatório (Seção 8.1). |
| Produto ativado entre a leitura do catálogo e o commit da importação (a linha vira pendência depois do trigger) | Baixa | Baixo | "Reprocessar" (RF-10). A próxima escrita no produto também resolve. |
| Código de catálogo com zero à esquerda já existente em produção | Baixa (112 códigos conhecidos sem zero) | Médio | Consulta e normalização pontual no STEP 8, antes das rules. |
| NF com mais de 497 linhas | Muito baixa | Médio | 422 com mensagem clara; no manual, dividir em complementos. |
| Falha no upload do XML após o commit | Baixa | Baixo | `arquivo_status: 'falhou'` visível; o estoque não é afetado. |
| Contenção no contador por clínica | Baixa | Baixo | Transações curtas; o Firestore tenta de novo automaticamente. |
| Remover a escrita do system_admin em `nf_imports` bloquear alguma correção manual que hoje é feita pelo painel | Baixa (nenhum código do painel escreve ali; verificado por `git grep`) | Baixo | Correções via Admin SDK (RN-10). |
| Cache do PWA com bundle antigo depois do deploy | Média | Baixo | Mensagem de erro existente; recarregar resolve. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Identidade da NF | (CNPJ do emitente canônico, série normalizada, número normalizado); chave `cnpj_serie_numero`. |
| ID do registro ("ID 1000") | Número sequencial por clínica, a partir de 1000, que identifica o registro de importação. Não é o número da nota. |
| Registro de importação | Documento `tenants/{t}/nf_imports/{id}`. Um por identidade de NF; os complementos manuais reutilizam o mesmo. |
| Complemento manual | Novo lançamento manual de uma NF já cadastrada manualmente: soma itens ao mesmo registro. |
| Chave de acesso | 44 posições: cUF(2) + AAMM(4) + CNPJ(14) + modelo(2) + série(3) + nNF(9) + tpEmis(1) + cNF(8) + DV(1). No XML, vem em `infNFe@Id` com o prefixo `NFe`. |
| DV | Dígito verificador por módulo 11 (pesos 2 a 9, da direita para a esquerda; valor do caractere = `charCode - 48`). |
| Forma canônica do CNPJ | 14 posições, sem máscara, maiúsculas, com zeros, DV validado. |
| Pendência | Linha de NF-e (código + lote) sem produto ativo no catálogo, guardada em `pending_master_products` com os dados para lançamento posterior. |
| Incorporação automática | Lançamento das pendências no inventário pela Cloud Function quando o produto fica ativo no catálogo. |
| Orçamento de escrita | Número de documentos escritos por transação; limite de 500 no Firestore. |
| Espelho manual | Cópia da lógica pura de `src/lib` em `functions/src`, necessária porque o deploy de functions não inclui `src/`. |
| Coerção numérica | Conversão automática, pelo `fast-xml-parser`, de valores de tag numéricos em `number`, desligada com `parseTagValue: false`. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.52): `UC-10-RN-14`, `UC-10-RN-15`, `UC-11-RN-12`, destaque 13, `UC-10-RN-02`.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-10-…`, `UC-11-…`, `UC-12-resolver-produtos-pendentes-de-cadastro.md` (RN-05), `UC-31-…`, `UC-32-…`, `UC-44-consultar-e-gerenciar-notificacoes-recebidas.md`.
- `ONLY_FOR_DEVS/TO_DO/BUGFIX-protecao-rotas-parse-nfe.md` (#390) e `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (#389).
- Código: `src/lib/parseNfeXml.ts`, `src/lib/services/{nfImportService,inventoryService,pendingMasterProductService,masterProductService,notificationService,accessRequestRouteHelpers}.ts`, `src/lib/firebase-admin.ts`, `src/lib/validations/nfeUploadValidation.ts` (#390), `src/app/(clinic)/clinic/{upload,add-products,inventory/[id]}/page.tsx`, `src/app/(admin)/admin/{pending-products,products/new,products/[id]}/page.tsx`, `src/types/{nf,pendingMasterProduct,notification,masterProduct}.ts`, `src/components/notifications/NotificationBell.tsx`, `functions/src/{index,alertRules,alertChecks,onTenantCreated,checkClaimsIntegrityOnDemand}.ts`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `.github/workflows/{deploy-gscandelari-dev,deploy-firebase}.yml`, `scripts/import-master-products*.js`.
- Testes: `src/__tests__/{parseNfeXml,auditLogRoutes,alertRules}.test.ts`, `tests/rules/firestore-tenant-subcollections.test.ts`, `jest.rules.config.js`, `tests/e2e/fixtures/seed-data.ts`.
- Externas: Manual de Orientação do Contribuinte NF-e 4.00 (chave de acesso e DV); NT 2025.001 (CNPJ alfanumérico; conferir a versão vigente); `fast-xml-parser` v5 (`parseTagValue`); Firestore (transações serializáveis no Admin SDK, limite de 500 escritas, `onDocumentWritten` v2).
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Seções 1, 2 e 15. `CLAUDE.md`: Multi-Tenant, regra 8, "Importação via XML NF-e".

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 14/10/2026 | Doc Writer (Claude) | Versão inicial. Status Aguardando decisão, com D1–D9 pendentes e achados A1–A4. |
| 1.1 | 14/10/2026 | Doc Writer (Claude) | **Decisões do usuário de 14/10/2026 (via coordenador) incorporadas; Status → Planejamento.** Reescrita das Seções 0–13. D1 revisada: ID sequencial por clínica a partir de 1000 ("ID 1000"), com a chave de acesso como campo. D2/D3/D4: identidade CNPJ + série + número nos dois caminhos; manual com CNPJ e série obrigatórios e chave opcional; sem legado nem fallback; unicidade por `nf_identidades`. D5/D6 substituídas por confirmação atômica no servidor (API routes com Admin SDK, uma transação, preview sem gravação, limite de 500 escritas, Storage após o commit em modo best-effort). Produtos fora do catálogo: pendência por linha e incorporação automática em todas as clínicas por Cloud Function (trigger + callable "Reprocessar"), com notificação; reenvio do XML removido. D7, D8 e D9 aceitas. Complemento manual no mesmo ID. Regra (b) de UC-10-RN-02 revogada (nova matriz RN-02). Normalização de zeros em número, série, código (inclusive no catálogo master) e lote; CNPJ canônico com justificativa. A3 explicado (some com o Admin SDK). Novo achado A5 (`tPag` 01–09). Commits replanejados (STEPs 1–12). Observação: pela convenção do template, uma mudança de escopo desse porte seria versão major (2.0); usado 1.1 por instrução explícita do coordenador. |
