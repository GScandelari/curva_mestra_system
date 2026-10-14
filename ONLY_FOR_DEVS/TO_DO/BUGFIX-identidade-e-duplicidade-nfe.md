# Bugfix: Identidade e Duplicidade de NF-e (chave de acesso como ID, checagem por emitente + série + número, normalização do número manual)

**Projeto:** Curva Mestra
**Data:** 14/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Aguardando decisão
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/nfe-identity-duplicate-check`
**Prioridade:** Média
**Versão:** 1.0
**Origem:** `UC-10-RN-14` (Média, Bug funcional) + `UC-10-RN-15` (Baixa, Débito técnico) + `UC-11-RN-12` (Baixa, Bug funcional) em `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.52, destaque 13). Relacionado à decisão de produto `UC-10-RN-02` (Seção 4.1 do mapa), que **continua aberta** (ver Seção 4.4).

> Hoje a NF-e é identificada só pelo número (`numero_nf`) dentro do tenant. A checagem roda só no client, sem transação, e o número digitado à mão não é normalizado. Na prática: (1) NF de mesmo número de **outro fornecedor** é bloqueada ou misturada com a primeira; (2) dois envios simultâneos podem duplicar estoque; (3) "026229" digitado à mão não casa com "26229" vindo do XML. Esta correção faz cinco coisas. Extrai a chave de acesso (44 posições) no parser e a usa como **ID determinístico** do documento em `nf_imports` para imports via XML, com reserva por transação. Passa a comparar por **(CNPJ do emitente + série + número normalizado)** nos dois caminhos. Normaliza o número. Acrescenta uma **trava de processamento** que fecha a corrida de reenvio. Endurece a regra `nf_imports` em `firestore.rules`. A matriz de bloqueio v1 (`UC-10-RN-02`, regras (a)–(d)) **não muda**; só muda o critério de "mesma NF". **Há 9 decisões pendentes (D1–D9, Seção 4.5) — o documento não está pronto para o `dev-task-manager`.**

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`. Antes de criar a branch, confira que `develop` existe local e remoto e está em sync com `master`: `git checkout develop && git pull origin develop`.
- **Branch da task:** `bugfix/nfe-identity-duplicate-check`
- **Fluxo:** `bugfix/nfe-identity-duplicate-check` → PR → branch pessoal (`gscandelari_setup`) → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop`. **Nunca PR para `master`.**
- **Pré-requisito de sincronização (importante):** em 14/10/2026, `origin/gscandelari_setup` tem dois PRs que **ainda não estão em `develop`**:
  - #389, `bugfix/consultant-subcollection-allowlist`: introduz `consultantReadableSubcollection` em `firestore.rules`.
  - #390, `bugfix/nfe-parse-routes-hardening`: `/clinic/upload` passa a enviar o ID token; a rota `parse-nf-xml` exige `clinic_admin`.

  Esta task toca `firestore.rules` (bloco `nf_imports`), `tests/rules/firestore-tenant-subcollections.test.ts` e `src/app/(clinic)/clinic/upload/page.tsx` — os mesmos arquivos. **Recomendado:** iniciar a branch depois que `gscandelari_setup → develop` levar #389/#390 para `develop`. Se não for possível, espere conflito textual (resolução trivial, hunks vizinhos) no PR para `gscandelari_setup`.
- **Ordem dos commits:** pensada para que **cada commit mantenha a importação funcionando**. Funções puras e parser vêm primeiro. Depois vêm os serviços e as telas, que passam a gravar os campos novos. As `firestore.rules`, que passam a exigir esses campos, entram **por último**.

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `fix` | `inventory` | `fix(inventory): add NF-e identity normalization helpers` |
| STEP 1 | `test` | `inventory` | `test(inventory): cover NF-e identity normalization helpers` |
| STEP 2 | `fix` | `inventory` | `fix(inventory): extract NF-e access key and series in XML parser` |
| STEP 2 | `test` | `inventory` | `test(inventory): cover access key extraction in parseNfeXml` |
| STEP 3 | `fix` | `inventory` | `fix(inventory): add pure NF-e duplicate evaluation rules` |
| STEP 3 | `test` | `inventory` | `test(inventory): cover NF-e duplicate evaluation rules` |
| STEP 4 | `fix` | `inventory` | `fix(inventory): reserve XML NF-e imports by access key in a transaction` |
| STEP 5 | `fix` | `inventory` | `fix(inventory): use access key reservation and claim on XML upload` |
| STEP 6 | `fix` | `inventory` | `fix(inventory): normalize manual NF number and match by issuer` |
| STEP 7 | `fix` | `firebase` | `fix(firebase): enforce NF-e identity in nf_imports rules` |
| STEP 7 | `test` | `firebase` | `test(firebase): cover nf_imports identity rules for get and list` |
| STEP 8 | — | — | Validação Manual, sem commit de código |

Ao abrir o PR para `develop` (Seção 15 do SST):
- Acionar `uml-use-case-writer` para atualizar:
  - **UC-10**: RN-01 (novo critério de identidade), RN-02 (texto mantido; registrar que pending/error/processing não contam como "completo" — D6), RN-03 (trava de processamento), RN-11 (rule de create/update/delete), Fluxo Principal passos 10–15, novas exceções (chave ausente/inválida, NF em processamento).
  - **UC-11**: RN-01, RN-08, novos campos opcionais CNPJ/série se D3 = (b).
- Acionar `uc-issues-tracker` (Modo B) para mover `UC-10-RN-14`, `UC-10-RN-15` e `UC-11-RN-12` para "Corrigido e Documentado" e registrar os achados novos da Seção 1.4.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Parser — `src/lib/parseNfeXml.ts` (211 linhas)**
- `XMLParser` com `ignoreAttributes: false`, `attributeNamePrefix: '@_'`, `removeNSPrefix: true` (l. 66–71). A raiz aceita `nfeProc > NFe > infNFe` ou `NFe > infNFe` (l. 76–79).
- Extrai `numero` (`ide/nNF`), `data_emissao`, `fornecedor` (`emit/xNome`) e `cnpj_fornecedor` (`emit/CNPJ`, l. 203), além de natureza, pagamento, tipo e produtos.
- **Não** extrai `infNFe@Id` (chave de acesso), `ide/serie` nem `ide/mod`.
- **Coerção numérica do `fast-xml-parser` 5.7.3 (verificado localmente em 14/10/2026):** com `parseTagValue` no padrão (`true`), valores de tag só com dígitos viram `number`. O teste com o mesmo `XMLParser` do projeto produziu:
  - `<nNF>026229</nNF>` → `26229`
  - `<serie>001</serie>` → `1`
  - `<CNPJ>01234567000189</CNPJ>` → `1234567000189` (perde o zero à esquerda)
  - `<chNFe>…44 dígitos…</chNFe>` → `3.5250301234567e+43`

  O **atributo** `Id` (`"NFe35…"`) **não** é coagido (`parseAttributeValue` é `false` por padrão). Por isso a chave é lida do atributo, e CNPJ/série/modelo são derivados da chave, não das tags.

**Checagem de duplicidade — `src/lib/services/nfImportService.ts`**
- `checkNumeroNFStatus(tenantId, numeroNf, attemptedOrigem)` (l. 199–239) consulta `tenants/{tenantId}/nf_imports where numero_nf == numeroNf` e aplica a matriz v1 (UC-10 RN-02):
  - (a) nenhum import → permite;
  - (b) só imports manuais → manual livre, XML uma vez;
  - (c) import XML com `produtos_pendentes.length > 0` → manual bloqueado, XML reaproveita (`xmlImport`);
  - (d) qualquer outro import XML → bloqueia tudo.
- `createNFImport` (l. 54–78) usa `addDoc`, com ID aleatório e `status: 'pending'`. Não grava CNPJ, série nem chave.
- `processNFAndAddToInventory(tenantId, importId, parsedData, existingXmlImport?)` (l. 255–374):
  - marca `'processing'`;
  - só se `existingXmlImport` vier preenchido, pula os pares (código, lote) já gravados (`getInventoryProdutoLoteKeysByNfId`, `inventoryService.ts:839`);
  - grava o inventário por `addInventoryItems` (`writeBatch`, `inventoryService.ts:859`);
  - registra pendências e marca `'success'` ou `'novo_produto_pendente'`. Em exceção, marca `'error'`.

**Tela XML — `src/app/(clinic)/clinic/upload/page.tsx` (`handleUpload`, l. 68–195)**
- Sequência: parse via `POST /api/parse-nf-xml` → `checkNumeroNFStatus(tenantId, parsedNF.numero, 'xml')` (l. 127) → `uploadNFFile` → `createNFImport` ou, se `nfStatus.xmlImport`, `updateNFImportStatus(..., 'pending', ...)` (l. 157–177) → preview → `handleConfirmImport` → `processNFAndAddToInventory(..., existingXmlImport)` (l. 207).
- Nenhuma etapa é atômica.

**Tela manual — `src/app/(clinic)/clinic/add-products/page.tsx` (1068 linhas)**
- Passo 2: `<Input id="numero-nf" placeholder="Ex: 026229">` com `onChange={(e) => setNumeroNF(e.target.value)}` (l. 632–638). Não há `trim` nem normalização. O único critério é "não vazio" (l. 151, 313).
- `handleSaveNF` (l. 310+):
  - chama `checkNumeroNFStatus(tenantId, numeroNF, 'manual')` (l. 349) com o texto cru;
  - grava, via `writeBatch`, `doc(collection(db, 'tenants/{tenantId}/nf_imports'))` com ID aleatório, `numero_nf: numeroNF` cru, `origem: 'manual'`, `tipo` (`'rennova' | 'outra_marca'`), `produtos`, `status: 'success'` e `created_by: user?.uid || 'unknown'` (l. 372–388);
  - grava os itens de `inventory` com `nf_numero: numeroNF` cru (l. 398).
- Não há campo de CNPJ nem de série.

**Tipos — `src/types/nf.ts`**
- `ParsedNF` (l. 16–25): sem chave, série ou modelo.
- `NFImport` (l. 46–65) e `NFImportCreate` (l. 67–77): sem CNPJ, série ou chave.
- `XmlParseErrorCode` (l. 27–31): `INVALID_FORMAT | MISSING_NF_NUMBER | NO_PRODUCTS_FOUND | MALFORMED_PRODUCT`.
- `NFNumeroStatus` (l. 80–86).
- `src/types/index.ts:125` tem um `NFImport` **legado** (`pdf_url`, `produtos: ProdutoRennova[]`), que não é usado pelos serviços de NF. Fora do escopo.

**Regras — `firestore.rules`**
- Em `develop`, `master` e na branch atual, `nf_imports` (l. 181–183) tem o bloco abaixo:

  ```
  match /tenants/{tenantId}/nf_imports/{nfImportId} {
    allow read, write: if belongsToTenant(tenantId) && hasRole('clinic_admin');
  }
  ```

  Qualquer `clinic_admin` do tenant cria, sobrescreve e apaga qualquer documento, sem validação de campo.
- `isRestrictedTenantCollection` (l. 41–43) inclui `nf_imports`: `clinic_user` e consultor não leem pelo bloco genérico.
- Em `gscandelari_setup` (PR #389, ainda não em `develop`), o consultor só lê a allowlist `consultantReadableSubcollection = ['inventory', 'stock_limits', 'solicitacoes']`. `nf_imports` continua fora dela. **Correção ao enunciado da task:** a allowlist **não** está em `develop` nem em produção; o bloco `nf_imports` está igual em todos os ramos.
- O system_admin tem `read, write` pelo bloco genérico `tenants/{tenantId}/{collectionId}/{document=**}` (l. 105–107).

**Índices:** `firestore.indexes.json` tem `nf_imports (tenant_id ASC, created_at DESC)`. A consulta por igualdade em `numero_nf` usa índice automático de campo único.

**Testes existentes:**
- `src/__tests__/parseNfeXml.test.ts`: o fixture `makeXml` (l. 112–134) monta `<infNFe>` **sem** atributo `Id` e com `<CNPJ>12345678000199</CNPJ>`.
- `tests/rules/firestore-tenant-subcollections.test.ts`: `describe('tenants/{tenantId}/nf_imports')` (l. 269–308) semeia `{ numero: '026229', status: 'success' }` e espera que o `clinic_admin` consiga `updateDoc`. **Esse teste muda com D7.**
- Não há caderno E2E de UC-10/UC-11 em `tests/e2e/`.
- O seed do emulador (`scripts/seed-emulator.ts`) não cria `master_products` nem `nf_imports`.

### 1.2 Problema identificado

1. **`UC-10-RN-14` (Média):** identidade só por `numero_nf`. O nNF só é único por (CNPJ do emitente, modelo, série). NF de mesmo número de outro fornecedor:
   - é bloqueada como "já foi totalmente importada" (importação legítima impedida); ou
   - é tratada como reenvio parcial da primeira, e os produtos de duas notas diferentes ficam misturados no mesmo `importId`, com `getInventoryProdutoLoteKeysByNfId` pulando itens da nota errada.

   Isso também afeta o caminho manual "Outras Marcas": uma NF manual de outro fornecedor com o mesmo número de uma NF Rennova já importada via XML é bloqueada.
2. **`UC-10-RN-15` (Baixa):** consulta → upload → `addDoc`, sem transação. Dois envios quase simultâneos da mesma NF passam ambos pela checagem e criam dois documentos. A rule não impede nada disso. Há também uma corrida no **reenvio**: duas abas confirmando o mesmo import parcial calculam `jaImportados` antes de qualquer commit e gravam os mesmos itens duas vezes.
3. **`UC-11-RN-12` (Baixa):** "026229" ou " 26229" digitado à mão ≠ "26229" do XML (o schema SEFAZ proíbe zeros à esquerda em `nNF`; o DANFE impresso os exibe). A mesma NF entra pelos dois caminhos e contorna o bloqueio (c)/(d).

### 1.3 Motivação estratégica

O estoque é a base de todos os relatórios (UC-47, UC-51, UC-52) e do consumo por procedimento. Uma NF duplicada infla estoque e custo. Uma NF legítima bloqueada obriga a contornar o sistema. A chave de acesso é o identificador nacional oficial da NF-e: usá-la como ID alinha o modelo de dados ao domínio fiscal e permite proteção no servidor (rules), sem Cloud Function nova.

### 1.4 Achados adicionais desta investigação (não estão no mapa v3.52)

| # | Achado | Tratamento aqui |
|---|---|---|
| A1 | **Coerção numérica do `fast-xml-parser`** (Seção 1.1): `cnpj_fornecedor` perde o zero à esquerda hoje. A mesma coerção pode afetar `cProd` e `nLote` só com dígitos e zeros à esquerda (ex.: lote `"001234"` vira `"1234"`). | **Parcial:** CNPJ, série e modelo passam a vir da chave (imune). `cProd`/`nLote` ficam **fora do escopo**: mudar `parseTagValue` altera o casamento com `master_products.code` e o histórico de lotes. Registrar no mapa como achado novo, para task própria. |
| A2 | **Import XML abandonado ou com falha bloqueia o número para sempre.** `createNFImport` grava `status: 'pending'` **antes** do preview, sem `produtos_pendentes`. Se o usuário fecha a aba no preview, ou se `processNFAndAddToInventory` cai no `catch` (`'error'`), a próxima tentativa encontra um import XML com `hasPending === false` e recebe "já foi totalmente importada" (`nfImportService.ts:220-238`). | **Dentro do escopo se D6 = sim:** `pending`/`error`/`processing` passam a ser retomáveis, alinhando o código ao texto de RN-02 (d), "XML sem pendências (**completo**)". |
| A3 | **Suspeita, não confirmada em runtime:** `registerPendingMasterProducts` (`pendingMasterProductService.ts:29-50`) faz `getDocs(query(pending_master_products, where tenant_id/nf_id/codigo))` como `clinic_admin`. A rule de `pending_master_products` (`firestore.rules:302-308`) só concede `read` a `system_admin`, e UC-12 RN-05 confirma isso. Se a consulta for negada, toda NF com produto fora do catálogo termina em `'error'` **depois** de o inventário dos produtos encontrados já ter sido gravado. | **Fora do escopo.** O STEP 8 verifica isso no emulador. Se confirmado, registrar no mapa. Com D6 = sim, o import fica ao menos retomável, e os itens já gravados são pulados pela trava (D5). |
| A4 | **CNPJ alfanumérico** (IN RFB 2.229/2024, novos CNPJs a partir de julho/2026). As notas técnicas da NF-e (NT 2025.001) adaptam o leiaute: as 12 primeiras posições do CNPJ na chave podem ter letras, e o DV usa o valor `charCode - 48`. ⚠️ Os detalhes devem ser conferidos na NT vigente antes de implementar. | Ver **D9**. |

---

## 2. Objetivos

1. **Extrair** a chave de acesso (`infNFe@Id`) no parser, validar formato e DV e derivar dela CNPJ do emitente, modelo, série e número.
2. **Usar** a chave como ID determinístico de `tenants/{tenantId}/nf_imports/{chave}` nos imports via XML, com reserva (criar ou retomar) dentro de `runTransaction`.
3. **Comparar** NFs por (CNPJ do emitente + série + número normalizado), com fallback conservador por número quando um dos lados não tem CNPJ (registros legados ou manual sem CNPJ).
4. **Normalizar** o número da NF (só dígitos, sem zeros à esquerda) nos dois caminhos e no que é gravado.
5. **Fechar** a corrida de reenvio com uma trava de processamento transacional (`claimNFImportForProcessing`).
6. **Endurecer** a regra `nf_imports`: create validado (ID, formato, `created_by`, status inicial); update sem alterar campos de identidade e vedado em import concluído; delete negado ao `clinic_admin`.
7. **Preservar** a matriz de bloqueio v1 (`UC-10-RN-02`, (a)–(d)) e o isolamento de leitura de `nf_imports` (`clinic_user` e consultor sem acesso).
8. **Cobrir** com Jest as funções puras e com `npm run test:rules` (get **e** list) a regra nova.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | O parser retorna `chave_acesso` (44 posições, sem o prefixo `NFe`), `modelo` e `serie` (normalizados), e `cnpj_fornecedor` derivado da chave. | system | Must |
| RF-02 | XML sem `infNFe@Id`, com Id fora do formato, com DV inválido, ou com `nNF` divergente do número contido na chave é rejeitado com erro de parse: 422 na rota, mensagem em pt-BR. Comportamento sujeito a **D1**. | clinic_admin | Must |
| RF-03 | Import via XML de uma NF nova cria `nf_imports/{chave_acesso}` em transação. Se dois envios da mesma NF competirem, o segundo **retoma** o mesmo documento ou é bloqueado; nunca cria outro. | clinic_admin | Must |
| RF-04 | NF de mesmo número e **CNPJ de emitente diferente** é tratada como NF distinta nos dois caminhos: nem bloqueada, nem misturada. | clinic_admin | Must |
| RF-05 | NF de mesmo CNPJ e número com **série diferente** é tratada como NF distinta. | clinic_admin | Must |
| RF-06 | O número digitado na inserção manual é normalizado (`" 026.229 "` → `"26229"`) antes da checagem e da gravação. Número sem nenhum dígito, ou só zeros, é recusado com toast. | clinic_admin | Must |
| RF-07 | A inserção manual oferece "CNPJ do emitente" e "Série". Obrigatoriedade definida em **D3**. Quando informados, entram na comparação. | clinic_admin | Must (se D3 ≠ c) |
| RF-08 | Import XML existente com status `pending`, `error`, `processing` ou `novo_produto_pendente` é retomável. `success` bloqueia (**D6**). | clinic_admin | Must |
| RF-09 | Ao confirmar, só uma sessão processa um import por vez. Uma segunda vê "Esta NF-e já está sendo processada…" ou, se a primeira concluiu, "já foi totalmente importada". Um `processing` parado há mais de `STALE_PROCESSING_MS` pode ser retomado (**D5**). | clinic_admin | Must |
| RF-10 | Mensagens de bloqueio identificam a NF por número, série e CNPJ formatado quando disponíveis (ex.: "A NF 26229 (série 1, CNPJ 12.345.678/0001-99) já foi totalmente importada anteriormente."). | clinic_admin | Should |
| RF-11 | Registros legados (ID aleatório, sem CNPJ/série/chave no topo) continuam bloqueando e sendo retomados conforme a matriz v1, comparados pelo fallback (**D4**). | system | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | Toda lógica de normalização, parse da chave, comparação de identidade, decisão de duplicidade e trava fica em funções puras testáveis sem Firebase. | Manutenibilidade |
| RNF-02 | Toda consulta continua sob `tenants/{tenantId}/nf_imports`. Nenhum `tenantId` vem de input além do `claims.tenant_id` já usado pelas telas. | Segurança / Multi-tenant |
| RNF-03 | A rule de `nf_imports` mantém leitura só para `clinic_admin` do tenant (get **e** list) e system_admin. `clinic_user` e consultor continuam sem leitura. | Segurança |
| RNF-04 | Nenhum índice composto novo. As consultas usam igualdade em `numero_nf` (índice automático) e `getDoc` por ID. | Performance |
| RNF-05 | No máximo uma consulta e uma transação de 1–2 leituras a mais por import em relação a hoje. | Performance |
| RNF-06 | Nenhum log novo com CNPJ completo ou chave de acesso. Os `console.log` existentes de `handleSaveNF` não são ampliados. | Segurança |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | **Mesma NF** ⇔ números normalizados iguais **e** (CNPJ ausente em algum dos lados **ou** CNPJs iguais **e** (série ausente em algum dos lados **ou** séries iguais)). O modelo não entra (o fluxo só recebe NF-e modelo 55). | (CNPJ, série, número) identificam a NF-e. O fallback conservador evita liberar duplicata quando falta informação (legado ou manual sem CNPJ). **D2** |
| RN-02 | A matriz v1 de `UC-10-RN-02` permanece: (a) nada → permite; (b) só manual → manual livre e XML permitido; (c) XML não concluído → manual bloqueado e XML retoma; (d) XML concluído (`status == 'success'`) → bloqueia tudo. "Concluído" passa a significar literalmente `status == 'success'` (**D6**). | A política de produto continua sendo decisão do usuário (Seção 4.4). Esta task só corrige identidade e atomicidade. |
| RN-03 | Import via XML: o ID do documento é a chave de acesso (44 posições). Import manual: o ID é aleatório e **nunca** tem formato de chave. | Determinismo para XML. O manual permite vários lançamentos por número (UC-11 RN-01). |
| RN-04 | `numero_nf` é gravado **normalizado** nos dois caminhos (XML já é, por schema e por coerção). `inventory.nf_numero` também (**D8**). | Comparação por igualdade simples, sem campo derivado nem backfill. |
| RN-05 | CNPJ gravado: 14 posições sem máscara (`cnpj_emitente`). Série gravada: sem zeros à esquerda (`"001"` → `"1"`, `"000"` → `"0"`). | Forma canônica única. |
| RN-06 | Trava de processamento: só passa para `processing` um import com status ≠ `success` e que não esteja em `processing` "fresco" (`updated_at` há menos de `STALE_PROCESSING_MS = 10 min`). | Fecha a corrida de reenvio sem bloquear para sempre um import cuja aba foi fechada no meio. **D5** |
| RN-07 | Durante o processamento, pares (código, lote) já gravados no inventário com `nf_id == importId` são **sempre** pulados (não só quando a tela passou `existingXmlImport`). | Idempotência da retomada, inclusive após `'error'` com inventário parcialmente gravado. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Módulo puro `src/lib/nfIdentity.ts`** (a criar): normalização (`normalizeNumeroNF`, `normalizeSerie`, `normalizeCnpj`), chave (`parseChaveAcesso`, `computeChaveAcessoDV`), comparação (`isSameNF`), rótulo (`formatNFLabel`), decisão de duplicidade (`evaluateNFDuplicateStatus`), trava (`canClaimForProcessing`) e adaptador de documento (`toNFIdentitySnapshot`).
2. **Parser** lê `infNFe['@_Id']` (string, não coagida), remove o prefixo `NFe`, valida com `parseChaveAcesso`, confere que o número da chave bate com `nNF` e preenche `chave_acesso`, `modelo`, `serie` e `cnpj_fornecedor` (da chave).
3. **Reserva por transação** (`reserveXmlNFImport`), em duas etapas:
   - **Fora da transação:** consulta `where('numero_nf', '==', numeroNormalizado)`. O SDK web não faz consulta dentro de `runTransaction`. O resultado traz manuais e legados.
   - **Dentro da transação:** `transaction.get` do documento `nf_imports/{chave}` e, se a decisão for retomar um legado, `transaction.get` desse legado. A partir de `evaluateNFDuplicateStatus`, faz `transaction.set` (create), `transaction.update` (retomar) ou nada (bloqueado).

   Duas transações concorrentes criando o mesmo ID: o Firestore faz a segunda tentar de novo. Ela então vê o documento existente e cai em "retomar".
4. **Ordem da tela XML:** parse → **reserva** → upload ao Storage → `updateNFImportStatus(pending, arquivo_*)` → preview. A reserva vem **antes** do upload, o que mantém UC-10 RN-04 (não subir arquivo de NF bloqueada) e elimina o caso "arquivo subiu, documento não".
5. **Trava** `claimNFImportForProcessing` (transação: ler o import, aplicar `canClaimForProcessing`, gravar `status: 'processing'` e `updated_at`) no início de `processNFAndAddToInventory`. Ela devolve o snapshot atual, de onde vem `produtos_importados` (não do estado da tela, que pode estar velho).
6. **Rules** com create/update separados e validação de identidade (Seção 6.5). DV não é verificado em rules (não dá para calcular módulo 11 de forma prática na linguagem de rules); o formato sim.
7. **Legado sem migração (D4):**
   - Os imports XML legados já têm `numero_nf` sem zeros (coerção do parser), então a consulta por número normalizado os encontra.
   - O CNPJ do legado vem de `parsed_data.cnpj_fornecedor` (com `padStart(14, '0')` para reparar a coerção) quando existir. Sem ele, entra o fallback por número.
   - Os manuais legados com zeros digitados não precisam ser encontrados: pela matriz v1, só imports **XML** bloqueiam ou retomam. Os manuais nunca bloqueiam nada.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Mover criação e processamento do import para uma API route com Admin SDK, onde a transação pode incluir consultas | Fecharia também a corrida XML × manual, mas exige reescrever `processNFAndAddToInventory` (catálogo, inventário, pendências) no servidor. É escopo de refactor. Sugestão futura. |
| Documento-trava separado (`nf_keys/{cnpj_serie_numero}`) para manual e XML | Não funciona para manual sem CNPJ (D3 opcional) e duplica o estado. O ID determinístico no próprio `nf_imports` resolve o caso principal (XML × XML). |
| Campo derivado `numero_nf_normalizado` + backfill | Desnecessário, porque `numero_nf` passa a ser gravado normalizado e os legados que importam (XML) já estão normalizados. |
| Renomear (re-keyar) os documentos legados para o ID da chave | Quebra `inventory.nf_id`, `nf_import_id` e `pending_master_products.nf_id`. A chave do legado não está gravada; exigiria baixar o XML do Storage. |
| Trocar `parseTagValue` para `false` no parser inteiro | Corrige A1 por completo, mas muda `cProd`/`nLote` de imports futuros em relação ao catálogo e ao histórico. Precisa de análise própria. |
| Validar DV da chave nas rules | Impraticável na linguagem de rules. O DV é validado no parser. Um `clinic_admin` que forjasse a chave só afetaria o próprio tenant. |

### 4.3 Trade-offs aceitos

- **Corrida XML × manual não é fechada no servidor:** a consulta cruzada fica fora da transação. A janela é de segundos e exige o mesmo admin (ou dois admins) lançando a mesma NF pelos dois caminhos ao mesmo tempo. Aceito (Baixa).
- **Legado retomado sem proteção de ID:** um import legado parcial é retomado pelo ID aleatório. A trava (RN-06) cobre a corrida de processamento; não há proteção de criação, porque o documento já existe.
- **Fallback conservador:** sem CNPJ em um dos lados, NFs de fornecedores diferentes com o mesmo número ainda colidem. Isso só acontece com legado ou manual sem CNPJ, e diminui com o tempo. A mensagem sugere informar o CNPJ (D3).
- **Relógio do cliente na trava:** `canClaimForProcessing` compara `updated_at` (servidor) com `Date.now()` (cliente). Um relógio errado em minutos só antecipa ou atrasa a liberação de um `processing` parado.
- **Abas abertas durante o deploy:** um bundle antigo em cache tenta `addDoc` com ID aleatório e `origem: 'xml'` e recebe `permission-denied` depois que as rules novas entram. Recarregar a página resolve.

### 4.4 Relação com a decisão de produto `UC-10-RN-02` (continua aberta)

| Aspecto | Status nesta task |
|---|---|
| **Critério de identidade** ("o que é a mesma NF") | **Decidido aqui** (sujeito a D2): (CNPJ + série + número normalizado), com fallback por número. Substitui UC-10 RN-01. |
| **Significado de "XML completo"** em (d) | **Decidido aqui** (sujeito a D6): só `status == 'success'`. Hoje, `pending`/`error`/`processing` também bloqueiam, contra o texto da regra. |
| **Garantia no servidor** | **Decidido aqui** (D1, D5, D7). |
| **Matriz (a)–(d) em si** | **Pendente para o usuário — não alterada.** Pontos que esta investigação levanta para a revisão de negócio, sem implementação aqui: (1) a regra (b) permite XML depois de lançamentos manuais da mesma NF, o que pode **duplicar estoque por design** se o manual já tiver lançado os mesmos itens; (2) a regra (b) permite lançamentos manuais ilimitados para o mesmo número; (3) UC-11 RN-06, checagem só no último passo do wizard manual. |

### 4.5 Decisões pendentes (gate — responder a todas antes de mudar o Status)

> ⚠️ **Decisão necessária D1 — Chave de acesso como ID e obrigatoriedade.** Usar `chave_acesso` (44 posições, **sem** o prefixo `NFe`) como ID de `nf_imports` para XML **e** rejeitar XML sem chave válida (ausente, formato inválido, DV inválido ou `nNF` divergente da chave)?
> - Opções: (a) sim, rejeitar; (b) aceitar XML sem chave, com ID aleatório e checagem só por (CNPJ + série + número), sem proteção no servidor.
> - **Recomendação: (a).** Toda NF-e v4.00 válida tem `infNFe@Id` obrigatório no schema SEFAZ (`NFe` + 44 posições). XML sem ele não é NF-e autorizada.

> ⚠️ **Decisão necessária D2 — Critério de "mesma NF".** Aplicar RN-01 (CNPJ + série + número normalizado, com fallback por número quando falta CNPJ e série ignorada quando falta em um dos lados)?
> - Opções: (a) RN-01 como está; (b) exigir CNPJ dos dois lados e, sem CNPJ, tratar como NF distinta (libera mais e arrisca duplicata com legado e manual); (c) incluir o modelo (55/65) na comparação.
> - **Recomendação: (a).**

> ⚠️ **Decisão necessária D3 — CNPJ e série na inserção manual (UC-11).** Hoje o manual só tem o número.
> - Opções: (a) nenhum campo novo (só normalização; o manual compara só por número com imports XML, e o falso bloqueio entre fornecedores continua nesse caminho); (b) campos **opcionais** "CNPJ do emitente" (com máscara e validação de DV quando preenchido) e "Série" no Passo 2. Se preenchidos, entram na comparação; se não, vale o fallback por número; (c) os mesmos campos **obrigatórios**.
> - **Recomendação: (b).** O DANFE impresso traz CNPJ e série. Para "Outras Marcas" isso elimina o falso bloqueio contra NFs Rennova sem forçar atrito em quem não tem o dado. Na mensagem de bloqueio por fallback, sugerir "Informe o CNPJ do emitente para diferenciar notas de fornecedores distintos".

> ⚠️ **Decisão necessária D4 — Registros legados.**
> - Opções: (a) **sem migração**: compatibilidade em leitura (`toNFIdentitySnapshot` usa `parsed_data.cnpj_fornecedor` com `padStart(14, '0')` quando existir e cai no fallback por número quando não existir); (b) script `scripts/backfill-nf-imports-identity.js` (dry-run por padrão, `--apply`, padrão de `scripts/migrate-brand-rennova.js`) gravando `cnpj_emitente` a partir de `parsed_data` nos legados XML, rodado em dev e prod; (c) o mesmo script, baixando também o XML do Storage (`arquivo_url`) para gravar `chave_acesso` e `serie`.
> - **Recomendação: (a).** Os legados XML já têm `numero_nf` normalizado e manuais legados nunca bloqueiam (Seção 4.1, item 7). O ganho de (b)/(c) é marginal e acrescenta uma operação manual em produção. O ID dos legados **não** muda em nenhuma opção.

> ⚠️ **Decisão necessária D5 — Trava de processamento.** Incluir `claimNFImportForProcessing` (transação) com liberação de `processing` parado após `STALE_PROCESSING_MS`?
> - Opções: (a) sim, com 10 min; (b) sim, com outro valor; (c) não incluir. Sem a trava, o ID determinístico só impede o segundo **documento**; duas abas confirmando o mesmo import ainda duplicam estoque.
> - **Recomendação: (a).** É o que efetivamente fecha `UC-10-RN-15` para o reenvio.

> ⚠️ **Decisão necessária D6 — Imports XML abandonados ou com falha.** Corrigir aqui o achado A2 (Seção 1.4): `pending`, `error` e `processing` deixam de contar como "completo" e passam a ser retomáveis?
> - Opções: (a) sim, nesta task; (b) não, registrar no mapa para task própria.
> - **Recomendação: (a).** Com ID determinístico, o import abandonado passa a ser **o mesmo** documento da próxima tentativa. Mantê-lo bloqueante tornaria a NF impossível de importar, porque não haveria mais como criar outro documento.

> ⚠️ **Decisão necessária D7 — Endurecimento da regra `nf_imports`.** Aplicar a regra da Seção 6.5?
> - Ela inclui: create com ID/formato/`created_by == auth.uid`/status inicial validados; update sem alterar `tenant_id`, `origem`, `numero_nf`, `chave_acesso`, `cnpj_emitente`, `serie`, `created_by` e `created_at`, e vedado quando `status == 'success'`; delete negado ao `clinic_admin` (system_admin continua com tudo pelo bloco genérico).
> - Opções: (a) a regra completa; (b) só create determinístico + imutabilidade de identidade, mantendo update de `success` e delete.
> - **Recomendação: (a).** Nenhum código apaga ou edita `nf_imports` concluído (verificado por busca em `src/` e `functions/src/`). O teste de rules existente que faz `updateDoc` num documento `success` precisa ser ajustado.

> ⚠️ **Decisão necessária D8 — Forma gravada do número manual.**
> - Opções: (a) gravar `numero_nf` e `inventory.nf_numero` **normalizados** ("026229" passa a aparecer como "26229" no inventário e nos relatórios); (b) gravar o texto digitado (com `trim`) em `numero_nf_informado` para exibição e o normalizado em `numero_nf`.
> - **Recomendação: (a).** O XML já grava sem zeros. Exibição uniforme entre os dois caminhos e nenhum campo novo de exibição.

> ⚠️ **Decisão necessária D9 — CNPJ alfanumérico.** Aceitar já a chave com as 12 primeiras posições do CNPJ em `[0-9A-Z]` e DV calculado com `charCode - 48` (aplicável a dígitos e letras)?
> - Opções: (a) sim, conferindo antes o leiaute na NT 2025.001 vigente; (b) só numérico agora e task própria quando surgir o primeiro fornecedor com CNPJ alfanumérico.
> - **Recomendação: (a).** Com (b), um XML legítimo de fornecedor novo seria **rejeitado** pela D1. O custo é pequeno: um regex e a função de valor do caractere.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `src/lib/nfIdentity.ts` | Lib (pura) | Normalização, chave de acesso, comparação, decisão de duplicidade, trava e adaptador de snapshot. |
| `src/__tests__/nfIdentity.test.ts` | Teste Jest | Normalização, chave/DV, `isSameNF`, `formatNFLabel`, `toNFIdentitySnapshot`. |
| `src/__tests__/nfDuplicateRules.test.ts` | Teste Jest | `evaluateNFDuplicateStatus` (matriz v1 × identidade) e `canClaimForProcessing`. |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `src/types/nf.ts` | `ParsedNF` + `chave_acesso`, `modelo`, `serie`. `XmlParseErrorCode` + `MISSING_ACCESS_KEY`, `INVALID_ACCESS_KEY`. `NFImport`/`NFImportCreate` + `chave_acesso?`, `cnpj_emitente?`, `serie?`. Novos tipos `NFIdentity`, `NFImportIdentitySnapshot`, `NFDuplicateDecision`. `NFNumeroStatus` removido no STEP 6, quando sai o último uso. |
| `src/lib/parseNfeXml.ts` | Lê `infNFe['@_Id']`, valida e deriva campos (Seção 6.2). Restante intacto. |
| `src/__tests__/parseNfeXml.test.ts` | `makeXml` ganha atributo `Id` com chave válida (parâmetro opcional). Novos casos da Seção 8.1. |
| `src/lib/services/nfImportService.ts` | Novas `reserveXmlNFImport`, `checkNFDuplicateStatus`, `claimNFImportForProcessing`. `processNFAndAddToInventory` perde o 4º parâmetro e usa a trava (STEP 5). `mapNFImportDoc` lê os campos novos. `checkNumeroNFStatus` e `createNFImport` são removidas quando ficam sem chamador (STEPs 6/5). |
| `src/app/(clinic)/clinic/upload/page.tsx` | `handleUpload` usa `reserveXmlNFImport` antes do upload. `handleConfirmImport` chama `processNFAndAddToInventory(tenantId, importId, parsedData)`. Estado `existingXmlImport` removido. |
| `src/app/(clinic)/clinic/add-products/page.tsx` | Normaliza o número (Passo 2 e `handleSaveNF`). Campos CNPJ/Série (D3). `checkNFDuplicateStatus`. Grava `numero_nf` normalizado, `cnpj_emitente?` e `serie?`. `inventory.nf_numero` normalizado. |
| `firestore.rules` | Bloco `tenants/{tenantId}/nf_imports/{nfImportId}` reescrito (Seção 6.5) + helpers `isNFImportCreateValid`, `nfImportIdentityUnchanged`. `isRestrictedTenantCollection` e `consultantReadableSubcollection` **não mudam**. |
| `tests/rules/firestore-tenant-subcollections.test.ts` | `describe('tenants/{tenantId}/nf_imports')` ampliado (Seção 8.2). O seed do teste "clinic_admin … escreve" passa a `status: 'pending'`. |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---|---|
| — | Nenhum arquivo. Saem apenas as funções `checkNumeroNFStatus` e `createNFImport` de `nfImportService.ts` e o tipo `NFNumeroStatus`, substituídos. |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| `tenants/{tenantId}/nf_imports` | Schema + rules | Novos imports XML com ID = chave. Campos novos no topo: `chave_acesso` (só XML), `cnpj_emitente`, `serie`. `numero_nf` sempre normalizado. Rules: create/update/delete conforme D7. Legados intactos (D4). |
| `tenants/{tenantId}/inventory` | Valor | `nf_numero` normalizado em lançamentos manuais novos (D8). `nf_id` dos imports XML novos passa a ser a chave (string de 44 posições). Nenhum leitor depende do formato do ID. |
| `pending_master_products` | Valor | `nf_id` dos imports XML novos passa a ser a chave. Sem mudança de rule. |
| `firestore.indexes.json` | Nenhuma | Igualdade em `numero_nf` e `getDoc` por ID. |
| `storage.rules` / Storage | Nenhuma | Caminho `danfe/{tenantId}/{timestamp}_{nome}` inalterado. |

### 5.5 O que NÃO muda

- `src/app/api/parse-nf-xml/route.ts`: já devolve 422 para qualquer erro lançado pelo parser com `message` (l. 27–35). Os códigos novos passam por ali sem alteração. A versão de `gscandelari_setup` (com auth) também não é tocada.
- `src/lib/services/inventoryService.ts`: `addInventoryItems` e `getInventoryProdutoLoteKeysByNfId` são reutilizadas sem mudança.
- `src/lib/services/pendingMasterProductService.ts` (A3 fica fora do escopo).
- `isRestrictedTenantCollection`, `consultantReadableSubcollection` e todos os demais blocos de `firestore.rules`.
- A matriz de bloqueio v1 (RN-02 (a)–(d)) e a regra UC-11 RN-06 (checagem só no último passo do wizard).
- Coerção de `cProd`/`nLote` no parser (A1, fora do escopo).
- `src/types/index.ts` (`NFImport` legado não usado).
- `CLAUDE.md`, UCs e mapa: são atualizados pelos agentes no PR, não por esta task.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

```ts
// src/types/nf.ts — ANTES
export interface ParsedNF {
  numero: string;
  data_emissao?: string;
  fornecedor?: string;
  cnpj_fornecedor?: string;
  natureza_operacao?: string;
  forma_pagamento?: string;
  tipo_nota: TipoNota;
  produtos: NFProduct[];
}

// DEPOIS
export interface ParsedNF {
  numero: string;              // normalizado (sem zeros à esquerda)
  chave_acesso: string;        // 44 posições, sem prefixo "NFe" — obrigatório para XML (D1)
  modelo: string;              // "55" (da chave)
  serie: string;               // normalizado: "001" -> "1" (da chave)
  data_emissao?: string;
  fornecedor?: string;
  cnpj_fornecedor?: string;    // 14 posições, da chave (corrige perda de zero à esquerda — A1)
  natureza_operacao?: string;
  forma_pagamento?: string;
  tipo_nota: TipoNota;
  produtos: NFProduct[];
}

export type XmlParseErrorCode =
  | 'INVALID_FORMAT'
  | 'MISSING_NF_NUMBER'
  | 'MISSING_ACCESS_KEY'   // novo
  | 'INVALID_ACCESS_KEY'   // novo (formato, DV ou nNF divergente)
  | 'NO_PRODUCTS_FOUND'
  | 'MALFORMED_PRODUCT';

// NFImport e NFImportCreate ganham (opcionais — ausentes em legados e, conforme D3, no manual):
//   chave_acesso?: string;   // só origem 'xml'; igual ao id do documento
//   cnpj_emitente?: string;  // 14 posições
//   serie?: string;          // normalizada

/** Identidade de uma NF para comparação (RN-01). */
export interface NFIdentity {
  numero: string;   // normalizado, não vazio
  cnpj?: string;    // 14 posições
  serie?: string;   // normalizada
}

/** Visão mínima de um documento nf_imports para a decisão de duplicidade. */
export interface NFImportIdentitySnapshot {
  id: string;
  origem: NFOrigem;
  status: NFImport['status'];
  identity: NFIdentity;
  produtosImportados: number;
}

export type NFDuplicateDecision =
  | { action: 'create' }                                         // xml: criar nf_imports/{chave}; manual: criar lançamento
  | { action: 'resume'; importId: string; snapshot: NFImportIdentitySnapshot } // xml: retomar existente
  | { action: 'blocked'; reason: string };
```

Remoção: `NFNumeroStatus` (l. 80–86) sai no STEP 6.

### 6.2 Mudanças no parser e nas funções puras

**`src/lib/nfIdentity.ts` (a criar):**

```ts
export const STALE_PROCESSING_MS = 10 * 60 * 1000; // D5

/** Só dígitos, sem zeros à esquerda. '' se não houver dígito diferente de zero. */
export function normalizeNumeroNF(raw: unknown): string;
// ' 026.229 ' -> '26229'; '26229' -> '26229'; 26229 (number) -> '26229'; 'abc' -> ''; '000' -> ''; '' / null -> ''

/** Só dígitos, sem zeros à esquerda, mas "0" preservado. '' se não houver dígito. */
export function normalizeSerie(raw: unknown): string;
// '001' -> '1'; '000' -> '0'; 1 (number) -> '1'; '' -> ''

/** Remove máscara (. / -), uppercase; exige 14 posições ([0-9A-Z]{12}[0-9]{2} se D9=a, senão [0-9]{14}). '' se inválido. */
export function normalizeCnpj(raw: unknown, opts?: { repairLeadingZeros?: boolean }): string;
// repairLeadingZeros: só dígitos com 12–13 posições -> padStart(14,'0') (reparo da coerção, uso exclusivo em legado)

/** Valida o DV do CNPJ (usado na entrada manual — D3). */
export function isValidCnpj(cnpj14: string): boolean;

/** DV módulo 11 da chave (pesos 2..9 da direita p/ esquerda; resto < 2 -> 0; senão 11 - resto). Valor do caractere = charCode - 48 (D9). */
export function computeChaveAcessoDV(first43: string): number;

export interface ChaveAcessoInfo {
  chave: string;   // 44 posições
  cUF: string;     // [0,2)
  aamm: string;    // [2,6)
  cnpj: string;    // [6,20)
  modelo: string;  // [20,22)
  serie: string;   // [22,25) normalizada
  numero: string;  // [25,34) normalizado
}

/** Aceita "NFe"+44 ou 44 posições; trim; valida formato e DV. null se inválida. */
export function parseChaveAcesso(raw: unknown): ChaveAcessoInfo | null;

/** RN-01. */
export function isSameNF(a: NFIdentity, b: NFIdentity): boolean;

/** "NF 26229 (série 1, CNPJ 12.345.678/0001-99)" — omite partes ausentes. */
export function formatNFLabel(identity: NFIdentity): string;

/** Converte um documento nf_imports (inclusive legado) em snapshot (D4). */
export function toNFIdentitySnapshot(id: string, data: Record<string, unknown>): NFImportIdentitySnapshot;
// numero: normalizeNumeroNF(data.numero_nf)
// cnpj:   data.cnpj_emitente  ||  normalizeCnpj(data.parsed_data?.cnpj_fornecedor, { repairLeadingZeros: true })  ||  undefined
// serie:  data.serie  ||  data.parsed_data?.serie  ||  undefined
// origem: data.origem ?? 'manual' (mesmo default de mapNFImportDoc)

/** Matriz v1 (RN-02) aplicada sobre os snapshots que são a "mesma NF" (RN-01). */
export function evaluateNFDuplicateStatus(
  attempt: { origem: NFOrigem; identity: NFIdentity; chaveAcesso?: string },
  existing: NFImportIdentitySnapshot[]
): NFDuplicateDecision;

/** RN-06. */
export function canClaimForProcessing(
  status: NFImport['status'],
  updatedAtMs: number | null,
  nowMs: number,
  staleMs?: number
): { ok: true } | { ok: false; reason: string };
```

Lógica de `evaluateNFDuplicateStatus`:
1. `same = existing.filter((e) => isSameNF(attempt.identity, e.identity))`. `xml = same.filter((e) => e.origem === 'xml')`.
2. `attempt.origem === 'manual'`:
   - se `xml.length > 0`: `blocked` com "A {formatNFLabel} já foi importada via XML e não aceita adição manual de produtos." Quando a decisão saiu do fallback (sem CNPJ na tentativa) e D3 = (b), acrescentar a sugestão de informar o CNPJ;
   - senão, `create`.
3. `attempt.origem === 'xml'`:
   - se `xml.length === 0`: `create`;
   - se algum `xml[i].status === 'success'`: `blocked` com "A {label} já foi totalmente importada anteriormente.";
   - senão, `resume` do snapshot com `id === attempt.chaveAcesso`, se houver; caso contrário, do primeiro legado.

`canClaimForProcessing`:
- `success` → `{ ok: false, reason: 'Esta NF-e já foi totalmente importada.' }`;
- `processing` com `updatedAtMs !== null && nowMs - updatedAtMs < staleMs` → `{ ok: false, reason: 'Esta NF-e já está sendo processada em outra sessão. Aguarde alguns minutos e tente novamente.' }`;
- qualquer outro caso → `ok`.

**`src/lib/parseNfeXml.ts`:** depois de obter `nfe` e `numeroNF` (l. 88–97):

```ts
const rawId = (nfe as Record<string, unknown>)['@_Id'];
if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
  throw { code: 'MISSING_ACCESS_KEY', message: 'Chave de acesso da NF-e (atributo Id de <infNFe>) não encontrada no XML.' } satisfies XmlParseError;
}
const chaveInfo = parseChaveAcesso(rawId);
if (!chaveInfo) {
  throw { code: 'INVALID_ACCESS_KEY', message: 'Chave de acesso da NF-e inválida (formato ou dígito verificador).' } satisfies XmlParseError;
}
if (chaveInfo.numero !== normalizeNumeroNF(numeroNF)) {
  throw { code: 'INVALID_ACCESS_KEY', message: 'O número da NF-e (<nNF>) não confere com a chave de acesso.' } satisfies XmlParseError;
}
```

No `return`: `numero: normalizeNumeroNF(numeroNF)`, `chave_acesso: chaveInfo.chave`, `modelo: chaveInfo.modelo`, `serie: chaveInfo.serie`, `cnpj_fornecedor: chaveInfo.cnpj`. A ordem dos erros existentes (`INVALID_FORMAT` → `MISSING_NF_NUMBER` → chave → produtos) fica preservada. O `Id` é lido de `infNFe` em qualquer das duas raízes aceitas.

### 6.3 Mudanças em serviços (`src/lib/services/nfImportService.ts`)

```ts
/** Busca candidatos por número (manuais, legados e o próprio doc da chave) — fora de transação. */
async function queryNFImportSnapshotsByNumero(tenantId: string, numeroNormalizado: string): Promise<NFImportIdentitySnapshot[]>;
// query(collection(db,'tenants',tenantId,'nf_imports'), where('numero_nf','==',numeroNormalizado)) -> toNFIdentitySnapshot

/** XML: cria nf_imports/{chave} ou retoma o existente, atomicamente. */
export async function reserveXmlNFImport(params: {
  tenantId: string;
  parsedNF: ParsedNF;
  userId: string;
  arquivoNome: string;
}): Promise<
  | { status: 'created'; importId: string }
  | { status: 'resumed'; importId: string; produtosImportados: number }
  | { status: 'blocked'; reason: string }
>;
```

Lógica:
1. `identity = { numero: parsedNF.numero, cnpj: parsedNF.cnpj_fornecedor, serie: parsedNF.serie }`. `candidatos = await queryNFImportSnapshotsByNumero(...)`.
2. `runTransaction(db, async (tx) => { ... })`:
   - `chaveSnap = await tx.get(doc(db,'tenants',tenantId,'nf_imports',parsedNF.chave_acesso))`;
   - monta `existing` (o `chaveSnap`, se existir, substitui o candidato de mesmo id) e chama `evaluateNFDuplicateStatus({ origem: 'xml', identity, chaveAcesso }, existing)`;
   - para `resume` de um legado (id ≠ chave), faz `tx.get` do legado **antes** de qualquer escrita e reavalia com o snapshot fresco;
   - `create` → `tx.set(chaveRef, { tenant_id, numero_nf, origem: 'xml', chave_acesso, cnpj_emitente, serie, arquivo_nome, natureza_operacao?, forma_pagamento?, tipo_nota, status: 'pending', produtos_importados: 0, produtos_novos: 0, created_by: userId, created_at: serverTimestamp(), updated_at: serverTimestamp() })`. Campos `undefined` são removidos, como em `createNFImport` hoje;
   - `resume` → `tx.update(ref, { status: 'pending', arquivo_nome, updated_at: serverTimestamp() })`;
   - `blocked` → sem escrita.
3. Retorna o resultado.

```ts
/** Manual: decide se o lançamento é permitido (sem escrita). */
export async function checkNFDuplicateStatus(
  tenantId: string,
  identity: NFIdentity
): Promise<{ blocked: false } | { blocked: true; reason: string }>;
// candidatos por número -> evaluateNFDuplicateStatus({ origem: 'manual', identity }, candidatos)

/** Trava de processamento (RN-06). Lança Error(reason) se não puder. */
export async function claimNFImportForProcessing(
  tenantId: string,
  importId: string
): Promise<{ produtosImportados: number }>;
// runTransaction: get -> canClaimForProcessing(status, updated_at?.toMillis() ?? null, Date.now()) -> update { status: 'processing', updated_at: serverTimestamp() }
```

`processNFAndAddToInventory`:

```ts
// ANTES
processNFAndAddToInventory(tenantId, importId, parsedData, existingXmlImport?: NFImport)
// DEPOIS
processNFAndAddToInventory(tenantId: string, importId: string, parsedData: ParsedNF): Promise<{ success: boolean; message: string }>
```

- Primeira linha: `const { produtosImportados } = await claimNFImportForProcessing(tenantId, importId)`. Se lançar, retorna `{ success: false, message }` **sem** marcar `'error'`, para não sobrescrever o `processing` da outra sessão. Isso substitui o `updateNFImportStatus(..., 'processing')` atual.
- `jaImportados = await getInventoryProdutoLoteKeysByNfId(tenantId, importId)` **sempre** (RN-07).
- `totalJaImportado = produtosImportados + resolvedItems.length`.
- Resto inalterado.

`mapNFImportDoc` passa a mapear `chave_acesso`, `cnpj_emitente` e `serie`. Saem do serviço: `createNFImport` (STEP 5) e `checkNumeroNFStatus` (STEP 6).

### 6.4 Mudanças na UI

**`/clinic/upload` (`handleUpload`)**
- Antes: parse → `checkNumeroNFStatus` → upload → `createNFImport`/`updateNFImportStatus` → preview.
- Depois: parse → `reserveXmlNFImport` → `blocked` mostra `reason` no `Alert` de erro existente (`setUploadStatus('error')`) → upload → `updateNFImportStatus(tenantId, importId, 'pending', { arquivo_nome, arquivo_url })` → preview.
- Se a reserva foi `resumed`, o preview mostra o aviso informativo "Esta NF-e já foi parcialmente importada; apenas os produtos ainda não gravados serão adicionados." (hoje a tela já trata `existingXmlImport`; o aviso passa a depender de `reservation.status === 'resumed'`).
- O preview ganha uma linha "Série / CNPJ do emitente" (`formatNFLabel`), no mesmo card onde já aparecem número e fornecedor.
- `handleConfirmImport`: `processNFAndAddToInventory(tenantId, importId, parsedData)`. Uma falha da trava aparece no `Alert` de erro existente.
- Sem mudança no `FileUpload` nem no envio do token (que vem do PR #390).

**`/clinic/add-products`**
- Passo 2, "Número da NF": continua texto livre. Abaixo dele, `<p className="text-sm text-muted-foreground">` com "Será registrada como {normalizeNumeroNF(numeroNF)}" quando o valor normalizado for diferente do digitado e não vazio.
- `handleContinueToProducts` e `handleSaveNF` validam `normalizeNumeroNF(numeroNF) !== ''`. Se vazio, toast "Número da NF inválido — informe ao menos um dígito diferente de zero".
- **Se D3 = (b):** campos "CNPJ do emitente (opcional)" (`id="cnpj-emitente"`, máscara `00.000.000/0000-00`) e "Série (opcional)" (`id="serie-nf"`). Com CNPJ preenchido e `isValidCnpj` falso, toast "CNPJ do emitente inválido" e o fluxo não avança. Os resumos (l. 660–670 e 955–960) mostram `formatNFLabel`. **Se D3 = (c):** os mesmos campos, obrigatórios. **Se D3 = (a):** nenhum campo novo.
- `handleSaveNF`: `checkNFDuplicateStatus(tenantId, identity)`. O `nfData` grava `numero_nf: identity.numero`, `cnpj_emitente?` e `serie?` (sem `undefined`). `created_by` fica `user.uid`; o fallback `'unknown'` sai, porque a rule exige `auth.uid`. Ampliar a guarda inicial com `!user`. `inventoryData.nf_numero: identity.numero`.

### 6.5 Mudanças em `firestore.rules` (bloco `nf_imports`)

```
// nf_imports — leitura só clinic_admin do tenant (inalterado; fora do
// fallback genérico via isRestrictedTenantCollection e fora da allowlist do
// consultor). Escrita: identidade validada no create e imutável no update
// (BUGFIX-identidade-e-duplicidade-nfe — UC-10-RN-14/RN-15, UC-11-RN-12).
// XML: id do documento == chave de acesso (44 posições) => um único
// documento por NF por tenant. Manual: id aleatório, nunca no formato de
// chave. Delete só system_admin (bloco genérico).
function isChaveAcessoFormat(value) {
  // D9 = (a): CNPJ alfanumérico nas posições 7–18; senão '^[0-9]{44}$'
  return value is string && value.matches('^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$');
}

function isNFImportCreateValid(tenantId, nfImportId) {
  let d = request.resource.data;
  return d.tenant_id == tenantId
    && d.created_by == request.auth.uid
    && d.numero_nf is string
    && d.numero_nf.matches('^[1-9][0-9]*$')
    && (
      (d.origem == 'xml'
        && isChaveAcessoFormat(d.get('chave_acesso', null))
        && d.chave_acesso == nfImportId
        && d.status == 'pending')
      ||
      (d.origem == 'manual'
        && !('chave_acesso' in d)
        && !isChaveAcessoFormat(nfImportId)
        && d.status == 'success')
    );
}

function nfImportIdentityUnchanged() {
  return !request.resource.data.diff(resource.data).affectedKeys().hasAny([
    'tenant_id', 'origem', 'numero_nf', 'chave_acesso', 'cnpj_emitente',
    'serie', 'created_by', 'created_at'
  ]);
}

match /tenants/{tenantId}/nf_imports/{nfImportId} {
  allow read: if belongsToTenant(tenantId) && hasRole('clinic_admin');
  allow create: if belongsToTenant(tenantId) && hasRole('clinic_admin')
    && isNFImportCreateValid(tenantId, nfImportId);
  allow update: if belongsToTenant(tenantId) && hasRole('clinic_admin')
    && resource.data.get('status', '') != 'success'
    && nfImportIdentityUnchanged();
  // delete: não concedido ao clinic_admin (D7); system_admin pelo bloco genérico.
}
```

Notas:
- `diff().affectedKeys()` só funciona em `update`. Por isso create e update ficam separados.
- `transaction.set` num documento inexistente é avaliado como **create**. `setDoc`/`tx.set` sobre um documento existente é avaliado como **update**. Assim, a tentativa de "criar de novo" a mesma chave cai no update: é negada se o documento estiver `success` e não consegue trocar a identidade nos demais estados.
- Os helpers ficam junto dos demais no topo do `match /databases/{database}/documents`, seguindo o padrão do arquivo.
- Imports legados XML com ID aleatório continuam aceitando update (status ≠ `success`, identidade intacta), o que permite a retomada.

---

## 7. Plano de Implementação

### STEP 1 — Normalização e chave de acesso (funções puras)

**Objetivo:** Ter `normalizeNumeroNF`, `normalizeSerie`, `normalizeCnpj`, `isValidCnpj`, `computeChaveAcessoDV`, `parseChaveAcesso`, `isSameNF`, `formatNFLabel` e `toNFIdentitySnapshot` implementadas e testadas.

**Arquivos afetados:**
- `src/lib/nfIdentity.ts`: criar (Seção 6.2, sem `evaluateNFDuplicateStatus`/`canClaimForProcessing`).
- `src/types/nf.ts`: adicionar `NFIdentity`, `NFImportIdentitySnapshot` e os campos opcionais de `NFImport`/`NFImportCreate`.
- `src/__tests__/nfIdentity.test.ts`: criar (Seção 8.1).

**Ações:**
1. Implementar as funções exatamente como especificado. DV com valor `charCode - 48` (D9).
2. Escrever os testes, incluindo as chaves de exemplo da Seção 8.1, cujo DV foi conferido com a chave pública de exemplo `52060433009911002506550120000007800267301615` (DV 5).

**Validação:** `npm run test -- nfIdentity` verde. `npm run lint` e `npm run type-check` sem erros.

**Commits:** `fix(inventory): add NF-e identity normalization helpers` e `test(inventory): cover NF-e identity normalization helpers`

---

### STEP 2 — Parser extrai chave, modelo e série

**Objetivo:** `parseNfeXml` devolve `chave_acesso`, `modelo`, `serie` e `cnpj_fornecedor` (da chave) e rejeita XML sem chave válida (D1).

**Arquivos afetados:**
- `src/lib/parseNfeXml.ts`: Seção 6.2.
- `src/types/nf.ts`: `ParsedNF` e `XmlParseErrorCode`.
- `src/__tests__/parseNfeXml.test.ts`: `makeXml` ganha `opts.id?: string | null` (padrão: `'NFe' + chave válida com nNF 27117 e CNPJ 12345678000199`; `null` omite o atributo). Casos novos da Seção 8.1.

**Ações:**
1. Ler `@_Id`, validar e derivar os campos. Normalizar `numero`.
2. Ajustar o fixture: o `Id` padrão tem de bater com o `nNF` padrão (`27117`) e com o CNPJ do fixture.
3. Conferir que `upload/page.tsx` e a rota compilam (`ParsedNF` ganhou campos obrigatórios só produzidos pelo parser).

**Validação:** `npm run test -- parseNfeXml` verde (casos antigos + novos). `npm run type-check`. Nesta altura a importação na UI continua funcionando, porque nada consome os campos novos ainda.

**Commits:** `fix(inventory): extract NF-e access key and series in XML parser` e `test(inventory): cover access key extraction in parseNfeXml`

---

### STEP 3 — Decisão de duplicidade e trava (funções puras)

**Objetivo:** Implementar e testar `evaluateNFDuplicateStatus` e `canClaimForProcessing`.

**Arquivos afetados:**
- `src/lib/nfIdentity.ts`: adicionar as duas funções e `STALE_PROCESSING_MS`.
- `src/types/nf.ts`: `NFDuplicateDecision`.
- `src/__tests__/nfDuplicateRules.test.ts`: criar (Seção 8.1).

**Ações:**
1. Implementar conforme a lógica da Seção 6.2.
2. Testar a matriz v1 completa sob cada variação de identidade.

**Validação:** `npm run test -- nfDuplicateRules` verde.

**Commits:** `fix(inventory): add pure NF-e duplicate evaluation rules` e `test(inventory): cover NF-e duplicate evaluation rules`

---

### STEP 4 — Serviços: reserva, checagem e trava

**Objetivo:** Disponibilizar `reserveXmlNFImport`, `checkNFDuplicateStatus` e `claimNFImportForProcessing` sem alterar ainda nenhum chamador.

**Arquivos afetados:**
- `src/lib/services/nfImportService.ts`: novas funções (Seção 6.3), `queryNFImportSnapshotsByNumero` interna, `mapNFImportDoc` com os campos novos. Import de `runTransaction`.

**Ações:**
1. Implementar as funções. Reaproveitar o filtro de `undefined` de `createNFImport` num helper local `omitUndefined`.
2. **Não** remover `checkNumeroNFStatus`/`createNFImport` ainda (ainda têm chamadores).

**Validação:** `npm run lint`, `npm run type-check` e `npm run test` verdes. Testes de serviço não são exigidos (MVP: só funções puras). A lógica de decisão já está coberta no STEP 3.

**Commit:** `fix(inventory): reserve XML NF-e imports by access key in a transaction`

---

### STEP 5 — Tela XML usa reserva e trava

**Objetivo:** `/clinic/upload` cria e retoma pelo ID da chave; a confirmação passa pela trava.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/upload/page.tsx`: Seção 6.4.
- `src/lib/services/nfImportService.ts`: `processNFAndAddToInventory` com a nova assinatura e a trava (Seção 6.3); remover `createNFImport`, que fica sem chamador.

**Ações:**
1. Trocar `checkNumeroNFStatus` + `createNFImport`/`updateNFImportStatus` por `reserveXmlNFImport` **antes** do `uploadNFFile`, e depois `updateNFImportStatus(..., 'pending', { arquivo_nome, arquivo_url })`.
2. Remover o estado `existingXmlImport` e o 4º argumento de `processNFAndAddToInventory`.
3. Linha "Série / CNPJ" e aviso de retomada no preview.

**Validação:** emulador. Importar uma NF nova: o documento aparece no Emulator UI como `nf_imports/{chave}` com `cnpj_emitente` e `serie`. Reimportar a mesma NF: "já foi totalmente importada". `npm run type-check`.

**Commit:** `fix(inventory): use access key reservation and claim on XML upload`

---

### STEP 6 — Inserção manual normalizada e por emitente

**Objetivo:** `/clinic/add-products` normaliza o número, aceita CNPJ/série (D3) e usa `checkNFDuplicateStatus`.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/add-products/page.tsx`: Seção 6.4.
- `src/lib/services/nfImportService.ts`: remover `checkNumeroNFStatus`.
- `src/types/nf.ts`: remover `NFNumeroStatus`.

**Ações:**
1. Normalização e validação no Passo 2 e em `handleSaveNF`.
2. Campos conforme D3.
3. Gravar os campos normalizados (D8) e `created_by: user.uid`.
4. `git grep -n "checkNumeroNFStatus\|NFNumeroStatus\|createNFImport"` deve retornar só documentação em `ONLY_FOR_DEVS/`.

**Validação:** emulador. Digitar "026229" mostra a dica "Será registrada como 26229". Salvar grava `numero_nf: "26229"` e `inventory.nf_numero: "26229"`. `npm run lint`, `npm run type-check` e `npm run build` verdes.

**Commit:** `fix(inventory): normalize manual NF number and match by issuer`

---

### STEP 7 — Regras do Firestore + testes de rules

**Objetivo:** Proteger no servidor a identidade e a unicidade dos imports (D7).

**Arquivos afetados:**
- `firestore.rules`: Seção 6.5.
- `tests/rules/firestore-tenant-subcollections.test.ts`: Seção 8.2.

**Ações:**
1. Reescrever o bloco `nf_imports` e adicionar os helpers, mantendo intactos `isRestrictedTenantCollection` e (se já presente na base) `consultantReadableSubcollection`.
2. Ajustar o seed do teste existente e acrescentar os casos da Seção 8.2. **Todo cenário de leitura testa `getDoc` e `getDocs(query(...))`**, como pede a lição do PR #344 registrada no cabeçalho da suíte.

**Validação:** `npm run test:rules` verde. Repetir o STEP 5 e o STEP 6 no emulador com as rules novas: importação e lançamento manual continuam funcionando.

**Commits:** `fix(firebase): enforce NF-e identity in nf_imports rules` e `test(firebase): cover nf_imports identity rules for get and list`

---

### STEP 8 — Validação Manual

**Objetivo:** Confirmar no emulador e no domínio pessoal que (1) NFs de mesmo número de emitentes ou séries diferentes convivem, (2) a mesma NF não entra duas vezes por nenhum caminho, (3) reenvio e retomada funcionam e (4) as rules recusam escrita fora do contrato. Este roteiro é a **fonte do caderno E2E `tests/e2e/UC-10-importar-nfe-via-upload-de-xml.spec.ts`** (e de trechos de um futuro `UC-11-…spec.ts`), a ser gerado pelo `qa-agent` (Modo A) conforme a regra 8 do `CLAUDE.md`.

**Pré-requisitos:**
- `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage` + `npm run test:e2e:seed` + `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` (mesmas variáveis do `playwright.config.ts`).
- **Catálogo master:** o seed não cria `master_products`. Pelo Emulator UI, criar `master_products/p-bt100` com `{ code: '3076528', name: 'BOTOX 100UI', active: true, category: 'Toxina', fragmentavel: false }` (ajustar aos campos obrigatórios de `src/types/masterProduct.ts`).
- **XMLs de teste.** Partir do XML mínimo de `makeXml` (`src/__tests__/parseNfeXml.test.ts`) com `detWithRastro` (cProd `3076528`) e variar `Id`, `nNF`, `serie` e `CNPJ`. O `nNF` dentro da chave tem de bater com `<nNF>`. Chaves já calculadas (cUF 35, AAMM 2503, modelo 55, tpEmis 1, cNF 00026229):

| Arquivo | CNPJ emitente | Série | nNF | `Id` |
|---|---|---|---|---|
| `nfA.xml` | 12345678000199 | 1 | 26229 | `NFe35250312345678000199550010000262291000262296` |
| `nfB.xml` (outro fornecedor) | 98765432000110 | 1 | 26229 | `NFe35250398765432000110550010000262291000262297` |
| `nfC.xml` (outra série) | 12345678000199 | 2 | 26229 | `NFe35250312345678000199550020000262291000262292` |
| `nfD.xml` (CNPJ com zero à esquerda) | 01234567000189 | 1 | 26229 | `NFe35250301234567000189550010000262291000262298` |
| `nfSemId.xml` | igual a `nfA.xml` sem o atributo `Id` | | | |
| `nfDvErrado.xml` | igual a `nfA.xml` com o último dígito do `Id` trocado para `0` | | | |

- `nfPendente.xml`: igual a `nfA.xml` (mesmo `Id`), com um segundo `<det>` de cProd `9999999` (fora do catálogo).
- Logins: `qa.clinic-admin-a@curvamestra.test` / `TEST_PASSWORD` de `tests/e2e/fixtures/seed-data.ts`.

**Roteiro A — Identidade XML (sempre executar):**
1. `/clinic/upload` → `nfA.xml` → Processar. **Esperado:** preview com "NF 26229 (série 1, CNPJ 12.345.678/0001-99)". Confirmar → sucesso. No Emulator UI, `tenants/test-clinic-a/nf_imports/35250312345678000199550010000262291000262296` com `status: 'success'`, `numero_nf: '26229'`, `cnpj_emitente`, `serie: '1'` e `chave_acesso` igual ao ID.
2. `nfA.xml` de novo. **Esperado:** "A NF 26229 (série 1, CNPJ 12.345.678/0001-99) já foi totalmente importada anteriormente." Nenhum arquivo novo em `danfe/test-clinic-a/` (Storage UI).
3. `nfB.xml`. **Esperado:** importa normalmente; **segundo** documento com o ID da chave de B; inventário com os itens de B e `nf_id` = chave B. (Hoje: bloqueado.)
4. `nfC.xml`. **Esperado:** importa normalmente (série distinta).
5. `nfD.xml`. **Esperado:** preview mostra "CNPJ 01.234.567/0001-89" (zero preservado).
6. `nfSemId.xml` → erro "Chave de acesso da NF-e (atributo Id de <infNFe>) não encontrada no XML." `nfDvErrado.xml` → "Chave de acesso da NF-e inválida (formato ou dígito verificador)." Nenhum documento criado em nenhum dos dois casos.

**Roteiro B — Retomada, abandono e trava (sempre executar):**
7. Limpar `nf_imports` e `inventory` do tenant (Emulator UI). `nfPendente.xml` → confirmar. **Esperado:** status `novo_produto_pendente` (ou `error`, ver passo 8), 1 item no inventário. Reenviar `nfPendente.xml` → aviso de retomada → confirmar → **nenhum** item duplicado para `3076528`.
8. **Achado A3:** se o passo 7 terminar com `status: 'error'` e mensagem de permissão, A3 está confirmado. Registrar o resultado no PR. Com D6 = sim, o reenvio continua possível e o item já gravado não é duplicado.
9. Limpar. `nfA.xml` → Processar → **fechar a aba no preview**. Reabrir `/clinic/upload` → `nfA.xml`. **Esperado:** retoma (não bloqueia). Confirmar → sucesso, um único documento.
10. Trava: limpar; `nfPendente.xml` → Processar em **duas abas** até o preview. Confirmar na aba 1 e, imediatamente, na aba 2. **Esperado:** a aba 2 mostra "Esta NF-e já está sendo processada em outra sessão…" ou retoma sem duplicar. O inventário fica sem itens repetidos para (código, lote).
11. Processing parado: no Emulator UI, colocar um import em `status: 'processing'` com `updated_at` 11 minutos no passado. Reenviar e confirmar. **Esperado:** processa. Com `updated_at` = agora, **esperado:** mensagem de "já está sendo processada".

**Roteiro C — Inserção manual (sempre executar):**
12. Com `nfA.xml` importada (passo 1): `/clinic/add-products` → Rennova → Inserção Manual → número `026229`. **Esperado:** dica "Será registrada como 26229". Adicionar produto → Confirmar e Salvar → **bloqueado** ("já foi importada via XML…"). (Hoje: passava.)
13. Mesmo fluxo com número `" 26229 "` → bloqueado.
14. **(D3 = b)** Outras Marcas → número `26229` + CNPJ `98.765.432/0001-10`. **Esperado:** permitido se a NF B **não** foi importada via XML no tenant; bloqueado se foi (passo 3). Com CNPJ `11.111.111/1111-11` (DV inválido) → toast "CNPJ do emitente inválido".
15. Outras Marcas → número `55501` (sem XML correspondente) → salva. Repetir com o mesmo número → salva de novo (lançamento fracionado, RN-02 (b) mantida). No Emulator UI, `numero_nf: '55501'` e ID aleatório (não 44 posições).
16. Número `abc` ou `000` → toast "Número da NF inválido…".

**Roteiro D — Regras no servidor (sempre executar; complementa o `npm run test:rules`):**
17. No console do navegador logado como `clinic_admin` (bundle de dev expõe o SDK), ou por um script com `@firebase/rules-unit-testing`: `setDoc` em `nf_imports/{chave A}` com `status: 'pending'` sobre o documento `success` → `permission-denied`. `deleteDoc` → `permission-denied`.
18. `addDoc` com `origem: 'xml'` e ID aleatório → `permission-denied`.

**Roteiro E — Domínio Firebase pessoal (após merge na branch pessoal):**
19. Em `dev-gscandelari.web.app`, repetir os passos 1, 2, 3, 9 e 12 com um `clinic_admin` real de teste e XMLs reais de teste (NF-e 026229 se disponível). Conferir que NFs importadas **antes** do deploy (legadas, ID aleatório) continuam bloqueando a reimportação (RF-11): reimportar uma NF legada concluída → bloqueada.

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Jest — funções puras

`src/__tests__/nfIdentity.test.ts`:

| Função | Cenários obrigatórios |
|---|---|
| `normalizeNumeroNF` | `'26229'`→`'26229'`; `'026229'`→`'26229'`; `' 026.229 '`→`'26229'`; `26229` (number)→`'26229'`; `'NF 0001'`→`'1'`; `'000'`→`''`; `'abc'`→`''`; `''`/`null`/`undefined`→`''`. |
| `normalizeSerie` | `'001'`→`'1'`; `'000'`→`'0'`; `1`→`'1'`; `''`→`''`. |
| `normalizeCnpj` | `'12.345.678/0001-99'`→`'12345678000199'`; `'1234567000189'` sem reparo→`''`; com `repairLeadingZeros`→`'01234567000189'`; `'123'`→`''`; (D9=a) `'12ABC34501DE35'`→aceito. |
| `isValidCnpj` | CNPJ válido conhecido → true; DV alterado → false; 14 dígitos iguais (`'11111111111111'`) → false. |
| `computeChaveAcessoDV` | `'5206043300991100250655012000000780026730161'`→`5`; as quatro chaves da tabela do STEP 8 → DVs `6, 7, 2, 8`. |
| `parseChaveAcesso` | `'NFe3525…2296'` → campos (`cnpj: '12345678000199'`, `modelo: '55'`, `serie: '1'`, `numero: '26229'`); sem prefixo → mesmo resultado; com espaços → `trim`; 43 posições → null; DV errado → null; letra fora da faixa do CNPJ → null; `null`/number → null. |
| `isSameNF` | mesmo número/CNPJ/série → true; CNPJ diferente → false; série diferente → false; CNPJ ausente em um lado → true (fallback); série ausente em um lado com CNPJ igual → true; número diferente → false. |
| `formatNFLabel` | completo; sem série; sem CNPJ; CNPJ formatado com máscara. |
| `toNFIdentitySnapshot` | doc novo (topo); legado XML com `parsed_data.cnpj_fornecedor: '1234567000189'` → CNPJ reparado; legado sem `parsed_data` → sem CNPJ; manual legado `numero_nf: ' 026229'` → `'26229'`; sem `origem` → `'manual'`. |

`src/__tests__/nfDuplicateRules.test.ts`:

| Função | Cenários obrigatórios |
|---|---|
| `evaluateNFDuplicateStatus` | xml × nada → create; xml × manual mesmo número → create (b); xml × xml `success` mesma identidade → blocked; xml × xml `success` **CNPJ diferente** → create; xml × xml `success` **série diferente** → create; xml × xml `novo_produto_pendente` → resume do id da chave; xml × xml legado `pending`/`error`/`processing` → resume do legado (D6); xml × legado sem CNPJ mesmo número `success` → blocked (fallback); xml com `chaveAcesso` igual a um snapshot e outro legado → resume do de id == chave; manual × xml qualquer status → blocked; manual × xml de outro CNPJ (com CNPJ informado) → create; manual sem CNPJ × xml de qualquer CNPJ mesmo número → blocked (fallback, com sugestão de informar CNPJ); manual × manual → create. |
| `canClaimForProcessing` | `pending`/`error`/`novo_produto_pendente` → ok; `success` → não; `processing` há 1 min → não; `processing` há 11 min → ok; `processing` com `updatedAtMs: null` → ok. |

`src/__tests__/parseNfeXml.test.ts` (casos novos): `Id` válido → `chave_acesso`, `modelo: '55'`, `serie`, `cnpj_fornecedor` da chave; `<CNPJ>01234567000189</CNPJ>` + chave correspondente → `cnpj_fornecedor: '01234567000189'` (regressão A1); `<nNF>026229</nNF>` com chave de nNF 26229 → `numero: '26229'`; sem `Id` → `MISSING_ACCESS_KEY`; DV errado → `INVALID_ACCESS_KEY`; `nNF` divergente da chave → `INVALID_ACCESS_KEY`; raiz `NFe` sem `nfeProc` com `Id` → ok. Todos os casos existentes continuam verdes com o `Id` padrão do fixture.

### 8.2 Regras do Firestore — `npm run test:rules` (`tests/rules/firestore-tenant-subcollections.test.ts`)

Prioridade alta (segurança). Toda leitura é testada com **get** (`getDoc`) **e list** (`getDocs(query(collection(...)))`). Constantes: `CHAVE_A = '35250312345678000199550010000262291000262296'`; `docXmlA = tenants/tenant-a/nf_imports/${CHAVE_A}`; `manualDoc = tenants/tenant-a/nf_imports/manual1`.

| Cenário | Esperado |
|---|---|
| Seed `docXmlA` (`status: 'pending'`) — `clinic_admin` A: get e list | sucesso |
| `clinic_user` A: get e list de `docXmlA` | falha |
| Consultor com acesso a A: get de `docXmlA` e list de `nf_imports` | falha |
| `clinic_admin` B: get e list de `nf_imports` de A | falha |
| system_admin: get e list | sucesso |
| `clinic_admin` A cria XML com id == chave, `numero_nf: '26229'`, `status: 'pending'`, `created_by` = próprio uid | sucesso |
| … id ≠ `chave_acesso` | falha |
| … `chave_acesso` com 43 posições | falha |
| … sem `chave_acesso` | falha |
| … `status: 'success'` na criação XML | falha |
| … `numero_nf: '026229'` / `' 26229'` / `''` | falha |
| … `created_by` de outro uid | falha |
| … `tenant_id: 'tenant-b'` no caminho de A | falha |
| `clinic_admin` A cria manual em `manual1` com `status: 'success'`, sem `chave_acesso` | sucesso |
| … manual com id no formato de chave | falha |
| … manual com campo `chave_acesso` | falha |
| `clinic_user` A cria manual válido | falha |
| Update em `docXmlA` `pending`: `status`, `arquivo_url`, `produtos_importados` | sucesso |
| Update em `docXmlA` `pending`: alterar `numero_nf` / `cnpj_emitente` / `serie` / `chave_acesso` / `origem` / `created_by` | falha (cada campo) |
| Seed `docXmlA` `success`: `setDoc` (sobrescrita "segunda criação") pelo `clinic_admin` | falha |
| Seed `docXmlA` `success`: `updateDoc` de `status` | falha |
| Seed legado `tenants/tenant-a/nf_imports/legado1` (`origem: 'xml'`, sem `chave_acesso`, `status: 'novo_produto_pendente'`): `updateDoc` de `status` | sucesso (retomada de legado) |
| `deleteDoc` pelo `clinic_admin` A | falha |
| `deleteDoc` e `updateDoc` em doc `success` pelo system_admin | sucesso |
| Teste existente "clinic_admin … lê e escreve": seed passa a `status: 'pending'` | sucesso |

### 8.3 E2E

- `npm run test:e2e`: regressão geral. Ainda não há caderno de UC-10/UC-11.
- Depois da conclusão, o `qa-agent` (Modo A) gera `tests/e2e/UC-10-importar-nfe-via-upload-de-xml.spec.ts` a partir do STEP 8. Esse caderno precisa de XMLs em fixture versionada (a tabela do STEP 8 traz as chaves prontas) e de `master_products` no seed. O `qa-agent` deve **sinalizar** a extensão do seed em vez de inventar dados. Revisão humana obrigatória.
- Componentes, pages e serviços com Firestore não ganham teste Jest (regra do template). A decisão está toda nas funções puras.

---

## 9. Checklist de Definition of Done

```
[ ] D1–D9 respondidas pelo usuário e incorporadas (Status → Planejamento)
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — verde, com nfIdentity.test.ts, nfDuplicateRules.test.ts e parseNfeXml.test.ts ampliado
[ ] npm run test:rules  — verde, com get E list em todos os cenários de leitura de nf_imports
[ ] npm run test:e2e    — verde (regressão)
[ ] Multi-tenant: toda consulta/transação sob tenants/{tenantId}/nf_imports; tenantId só das claims
[ ] Segurança: nenhum secret; nenhum log novo com CNPJ completo ou chave de acesso
[ ] git grep "checkNumeroNFStatus\|NFNumeroStatus\|createNFImport" — só documentação
[ ] isRestrictedTenantCollection e consultantReadableSubcollection inalteradas
[ ] STEP 8 executado (Roteiros A–E); resultado do passo 8 (achado A3) registrado no PR
[ ] Branch pessoal: task branch mergeada em gscandelari_setup e validada em dev-gscandelari.web.app
[ ] PR: aberto para develop com template preenchido
[ ] uml-use-case-writer: UC-10 (RN-01, RN-02 nota, RN-03, RN-11, fluxo 10–15, exceções) e UC-11 (RN-01, RN-08, campos CNPJ/série)
[ ] uc-issues-tracker (Modo B): UC-10-RN-14, UC-10-RN-15, UC-11-RN-12 → Corrigido e Documentado; registrar A1 (cProd/nLote), A3 (se confirmado); UC-10-RN-02 continua aberto com os pontos da Seção 4.4
[ ] qa-agent (Modo A) acionado para o caderno UC-10
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| XML real de fornecedor sem `Id` ou com formato inesperado ser rejeitado (D1) | Baixa | Médio | Schema SEFAZ exige `Id`; mensagem clara; STEP 8 passo 19 com XML real; D1 permite optar por (b). |
| CNPJ alfanumérico com leiaute diferente do assumido (A4) | Média | Médio | D9 exige conferir a NT vigente antes de implementar; testes com chave alfanumérica construída pela própria regra. |
| Conflito com #389/#390 (rules, testes de rules, upload page) | Alta (se a base não estiver sincronizada) | Baixo | Seção 0: iniciar depois do merge em `develop`, ou resolver os hunks vizinhos no PR para `gscandelari_setup`. |
| Abas com bundle antigo recebem `permission-denied` depois do deploy das rules | Média | Baixo | Rules entram no último commit; mensagem de erro existente; recarregar resolve. |
| Legado retomado em corrida de criação (sem ID determinístico) | Baixa | Baixo | Trava de processamento (RN-06) impede duplicar estoque; RN-07 pula itens já gravados. |
| Fallback por número ainda bloquear NFs de fornecedores diferentes (manual sem CNPJ / legado) | Média | Baixo | D3 (b) + mensagem sugerindo informar CNPJ; casos diminuem com o tempo. |
| `processing` travado bloquear a NF | Baixa | Médio | `STALE_PROCESSING_MS` (D5); passo 11 do STEP 8. |
| Mudança de `nf_numero` para forma normalizada confundir quem procura "026229" no inventário | Baixa | Baixo | D8; o XML já grava sem zeros desde sempre. |
| Achado A3 confirmar que NF com produto fora do catálogo sempre termina em `error` | Média | Médio | Fora do escopo; D6 torna o import retomável; registrar no mapa para task própria. |
| `transaction.get` de legado + `set` da chave estourarem o limite de retries da transação sob concorrência alta | Baixa | Baixo | Concorrência real é de 2 sessões no máximo; erro final cai no `Alert` existente. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Chave de acesso | Identificador nacional da NF-e com 44 posições: cUF(2) + AAMM(2+2) + CNPJ emitente(14) + modelo(2) + série(3) + nNF(9) + tpEmis(1) + cNF(8) + DV(1). No XML, aparece no atributo `Id` de `<infNFe>` com o prefixo `NFe`. |
| DV | Dígito verificador da chave, calculado por módulo 11 sobre as 43 primeiras posições (pesos 2 a 9, da direita para a esquerda). |
| nNF | Número da NF-e (`<ide><nNF>`), de 1 a 999.999.999, sem zeros à esquerda no XML. |
| Série | `<ide><serie>`, de 0 a 999. Junto com CNPJ e modelo, forma o espaço de numeração do emitente. |
| Identidade da NF | Neste documento: (CNPJ do emitente, série, número normalizado), conforme RN-01. |
| ID determinístico | ID de documento derivado do conteúdo (aqui, a chave), de modo que a mesma NF resulte sempre no mesmo documento. |
| Reserva | Transação que cria ou retoma o documento de import antes do upload do arquivo. |
| Trava de processamento (claim) | Transação que passa o import para `processing` só se nenhuma outra sessão o estiver processando. |
| Legado | Documento `nf_imports` criado antes desta correção: ID aleatório, sem `chave_acesso`, `cnpj_emitente` e `serie` no topo. |
| Coerção numérica | Conversão automática, pelo `fast-xml-parser`, de valores de tag só com dígitos em `number`, o que remove zeros à esquerda. |
| CNPJ alfanumérico | Novo formato de CNPJ (IN RFB 2.229/2024): 12 posições alfanuméricas + 2 dígitos verificadores. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.52): `UC-10-RN-14`, `UC-10-RN-15`, `UC-11-RN-12`, destaque 13, decisão `UC-10-RN-02` (Seção 4.1).
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-10-importar-nfe-via-upload-de-xml.md`: RN-01 a RN-04, RN-11, Seção 14 itens 1–2.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-11-inserir-nota-fiscal-manualmente.md`: RN-01, RN-06, RN-08.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-12-resolver-produtos-pendentes-de-cadastro.md`: RN-05 (achado A3).
- `ONLY_FOR_DEVS/TO_DO/BUGFIX-protecao-rotas-parse-nfe.md` (PR #390) e `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (PR #389): estado em `gscandelari_setup`.
- `ONLY_FOR_DEVS/TO_DO/FEAT-importacao-xml-nfe.md`: origem da importação XML.
- Código: `src/lib/parseNfeXml.ts`, `src/lib/services/nfImportService.ts`, `src/lib/services/inventoryService.ts` (l. 839–898), `src/lib/services/pendingMasterProductService.ts`, `src/app/(clinic)/clinic/upload/page.tsx`, `src/app/(clinic)/clinic/add-products/page.tsx`, `src/app/api/parse-nf-xml/route.ts`, `src/types/nf.ts`, `firestore.rules`, `firestore.indexes.json`.
- Testes: `src/__tests__/parseNfeXml.test.ts`, `tests/rules/firestore-tenant-subcollections.test.ts`, `jest.rules.config.js`, `tests/e2e/fixtures/seed-data.ts`.
- Padrão de script de migração (D4 b/c): `scripts/migrate-brand-rennova.js`.
- Externas: Manual de Orientação do Contribuinte NF-e (leiaute 4.00, composição da chave de acesso e cálculo do DV); NT 2025.001 (CNPJ alfanumérico em documentos fiscais eletrônicos — conferir a versão vigente); documentação do `fast-xml-parser` v5 (`parseTagValue`, `parseAttributeValue`); Firestore Security Rules (`request.resource.data.diff`, avaliação de `set` como create/update).
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Seções 1, 2 e 15.
- `CLAUDE.md`: Multi-Tenant, regra 8 (cadernos de teste), "Importação via XML NF-e".

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 14/10/2026 | Doc Writer (Claude) | Versão inicial. Status **Aguardando decisão**: D1–D9 pendentes (Seção 4.5). Inclui os achados adicionais A1–A4 (Seção 1.4), não registrados no mapa v3.52. |
