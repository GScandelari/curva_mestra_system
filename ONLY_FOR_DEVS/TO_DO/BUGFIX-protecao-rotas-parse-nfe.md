# Bugfix: Proteção das Rotas de Parse de NF-e (remoção da rota PDF legada + autenticação e limite na rota XML)

**Projeto:** Curva Mestra
**Data:** 09/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/nfe-parse-routes-hardening`
**Prioridade:** Média
**Versão:** 1.0
**Origem:** `UC-10-RN-12` (Média, Achado de segurança / Código morto) + `UC-10-RN-13` (Baixa, Achado de segurança) — `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.51; também listado na Seção 5, código morto)

> Duas rotas públicas de parse de NF-e: (a) `POST /api/parse-nf` — parser legado de DANFE em PDF (`pdf-parse`), sem nenhum chamador, sem autenticação, sem limite de tamanho, aceitando múltiplos arquivos e com 46 `console.log` de debug (inclusive trechos do texto extraído); (b) `POST /api/parse-nf-xml` — rota em uso pela importação de UC-10, também sem autenticação e com o limite de 10MB só no client. Esta correção **deleta** (a) e a dependência `pdf-parse`, e **endurece** (b): ID token Firebase obrigatório de `clinic_admin` ativo, limite de 10MB no servidor (413), exatamente um arquivo `.xml` por requisição; o cliente `/clinic/upload` passa a enviar o token. Nenhuma mudança de comportamento para o `clinic_admin` legítimo.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (antes de criar a branch: conferir que `develop` existe local + remoto e está em sync com `master`; `git checkout develop && git pull origin develop`).
- **Branch da task:** `bugfix/nfe-parse-routes-hardening`
  - Observação: o pedido original sugeria `fix/nfe-parse-routes-hardening`. O SST (`GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, Seção 1, tabela de branches) só reconhece `feature/*`, `bugfix/*`, `hotfix/*` e `chore/*` — por isso `bugfix/`.
- **Fluxo:** `bugfix/nfe-parse-routes-hardening` → PR → branch pessoal (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal (ex.: `dev-gscandelari.web.app`) → PR → `develop`.
- **PR sempre para a branch pessoal e depois `develop`, nunca para `master`.**
- Ordem dos commits pensada para que **cada commit mantenha a importação funcionando**: o cliente passa a enviar o token **antes** de a rota exigi-lo.

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `fix` | `api` | `fix(api): add pure guards for NF-e XML upload validation` |
| STEP 1 | `test` | `api` | `test(api): cover NF-e XML upload guards` |
| STEP 2 | `fix` | `inventory` | `fix(inventory): send ID token when parsing NF-e XML on upload` |
| STEP 3 | `fix` | `api` | `fix(api): require clinic_admin token and size limit on parse-nf-xml` |
| STEP 3 | `test` | `api` | `test(api): cover parse-nf-xml auth and size responses` |
| STEP 4 | `chore` | `api` | `chore(api): remove legacy DANFE PDF parse route` |
| STEP 5 | `chore` | `deps` | `chore(deps): remove unused pdf-parse dependency` |
| STEP 6 | — | — | Validação manual, sem commit de código |

Ao abrir o PR para `develop` (Seção 15 do SST): acionar `uml-use-case-writer` para atualizar UC-10 (passo 4 do Fluxo Principal passa a mencionar o envio do ID token; novos fluxos de exceção 401/403/413; RNF-01 passa a dizer que o limite de 10MB também é aplicado no servidor; seção de arquivos) e `uc-issues-tracker` (Modo B) para mover `UC-10-RN-12` e `UC-10-RN-13` para "Corrigido e Documentado" e retirar a rota legada da Seção 5 (código morto). Após este PR, a frase do `CLAUDE.md` "`src/app/api/parse-nf/route.ts` foi deletado" volta a ser verdadeira — **o `CLAUDE.md` não é editado por esta task**.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**(a) Rota legada `src/app/api/parse-nf/route.ts` (278 linhas)**
- `POST` sem nenhuma verificação de autenticação; `require('pdf-parse')` com detecção dinâmica do export (l. 20–51).
- `formData.getAll('files')` (l. 54): aceita N arquivos por requisição, sem limite de quantidade nem de tamanho.
- 46 chamadas `console.log`, incluindo `text.substring(0, 500)` e o final do texto extraído do PDF (l. 87–89), linhas casadas (l. 141, 272) e nomes de produtos (l. 95, 248).
- **Nenhum chamador:** busca por `/api/parse-nf` (sem `-xml`) em `src/`, `scripts/`, `tests/`, `functions/` e configs retorna apenas a própria rota. Não há `middleware.ts`.
- `pdf-parse` (`package.json` l. 50, `^2.4.5`) só é importado por essa rota; no `package-lock.json` ele traz `pdfjs-dist@5.4.296` e `@napi-rs/canvas@0.1.80` (binário nativo), sem nenhum outro dependente. `functions/package.json` não usa `pdf-parse`. `next.config.*` não referencia `pdf-parse`.
- O `CLAUDE.md` ("Funcionalidades Desabilitadas") afirma que a rota "foi deletada" — divergência com o código.

**(b) Rota ativa `src/app/api/parse-nf-xml/route.ts` (52 linhas)**

```ts
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();          // corpo inteiro bufferizado, sem auth
    const file = formData.get('file') as File | null;   // demais arquivos ignorados (mas já bufferizados)
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    if (!file.name.toLowerCase().endsWith('.xml')) { /* 400 */ }
    const xmlContent = await file.text();               // sem limite de tamanho
    // parseNfeXml(xmlContent) → 422 em erro de parse; 200 { parsedNF, warnings }
  } catch { /* 500 */ }
}
```

- Única chamada: `src/app/(clinic)/clinic/upload/page.tsx` l. 85–91 — `fetch('/api/parse-nf-xml', { method: 'POST', body: formData })`, **sem** header `Authorization`. A página já bloqueia não-admin na UI (`isAdmin = claims?.role === 'clinic_admin'`, l. 47–59) e tem `user` disponível via `useAuth()`.
- O limite de 10MB (UC-10 RNF-01) existe só em `src/components/upload/FileUpload.tsx` (`maxSizeMB = 10`, l. 18 e 35–37) e, para o arquivo salvo, em `storage.rules` (`/danfe/{tenantId}/{nfId}`: `request.resource.size < 10 * 1024 * 1024`).
- A rota não grava nada (gravação de `nf_imports`/`inventory` passa pelas rules, restritas a `clinic_admin`), por isso a severidade Baixa — mas é um endpoint público de parse de XML arbitrário.

**Padrão de verificação de token do projeto**
- Inline, repetido em várias rotas (ex.: `src/app/api/tenants/[id]/consultant/invite/route.ts` l. 23–34): lê `Authorization: Bearer`, `adminAuth.verifyIdToken(token)`, checa `decodedToken.role`/`tenant_id`, responde 401/403. Nesse padrão inline, um token inválido/expirado lança dentro do `try` e vira **500**.
- Helper reutilizável já exportado: `verifyBearerToken(req, missingTokenMessage?)` em `src/lib/services/accessRequestRouteHelpers.ts` (l. 18–31), usado por `access-requests/[id]/approve`, `approve-consultant` e `consultants/me/pending-access-requests`. Devolve o `DecodedIdToken` ou uma `NextResponse` 401 pronta — inclusive para token inválido/expirado.
- Nenhuma rota do projeto verifica a claim `active` hoje nem usa `verifyIdToken(token, true)` (revogação).

**Testes existentes:** `src/__tests__/parseNfeXml.test.ts` (parser puro); `src/__tests__/auditLogRoutes.test.ts` mostra o padrão de teste de API route com `jest.mock('../lib/firebase-admin', …)` e `new NextRequest(...)`. Não há caderno E2E de UC-10.

### 1.2 Problema identificado

1. `UC-10-RN-12`: endpoint publicado, sem chamador, que aceita N PDFs arbitrários sem auth nem limite e roda parse pesado (`pdfjs-dist` + canvas nativo) — vetor de abuso de CPU/memória/custo do backend de frameworks do Firebase Hosting (`frameworksBackend`, 1GiB) e de vazamento de conteúdo em log.
2. `UC-10-RN-13`: o parse XML aceita requisições anônimas e qualquer tamanho até o limite da plataforma; o limite de 10MB é contornável chamando a rota diretamente.
3. Dependência morta com binário nativo aumenta superfície de supply chain e tamanho do deploy.

### 1.3 Motivação estratégica

Fecha as duas únicas rotas de API públicas que executam processamento de arquivo do usuário. Correção pequena, sem mudança de UX, que também alinha código e `CLAUDE.md`.

---

## 2. Objetivos

1. **Remover** `src/app/api/parse-nf/route.ts` e a dependência `pdf-parse` (`package.json` + `package-lock.json`).
2. **Exigir** em `POST /api/parse-nf-xml` um Firebase ID token válido de `clinic_admin` com `active == true` e `tenant_id` preenchido.
3. **Limitar** o tamanho no servidor a 10MB (UC-10 RNF-01), respondendo 413 — antes de bufferizar o corpo quando `Content-Length` estiver presente.
4. **Rejeitar** requisições com zero ou mais de um arquivo, ou arquivo vazio.
5. **Ajustar** `/clinic/upload` para enviar o ID token.
6. **Cobrir** as guardas com Jest (funções puras + rota com Admin SDK mockado).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | `POST /api/parse-nf` deixa de existir (Next.js responde 404). | — | Must |
| RF-02 | `POST /api/parse-nf-xml` sem header `Authorization: Bearer <idToken>`, ou com token inválido/expirado, responde **401**. | qualquer | Must |
| RF-03 | Token válido cujo `role != 'clinic_admin'`, ou `active != true`, ou sem `tenant_id` (ex.: `clinic_user`, consultor, `system_admin`) responde **403**. | clinic_user / consultor / system_admin | Must |
| RF-04 | Requisição autorizada com `Content-Length` acima de 10MB + margem de multipart, ou arquivo com mais de 10MB, responde **413**. | clinic_admin | Must |
| RF-05 | Requisição autorizada sem arquivo, com mais de um arquivo, com arquivo vazio ou com nome sem `.xml` responde **400**. | clinic_admin | Must |
| RF-06 | Requisição autorizada válida mantém o comportamento atual: 200 `{ parsedNF, warnings }`; 422 em XML inválido; 500 em erro inesperado. | clinic_admin | Must |
| RF-07 | `/clinic/upload` envia o ID token do usuário logado e exibe a mensagem `error` devolvida pela rota em 401/403/413 (fluxo de erro já existente). | clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | Autenticação e autorização são verificadas **antes** de ler o corpo (`request.formData()`), para que requisições anônimas não forcem bufferização. | Segurança / Performance |
| RNF-02 | Limite de tamanho definido por constante única (`MAX_NFE_XML_BYTES = 10 * 1024 * 1024`), igual ao `maxSizeMB = 10` do `FileUpload`. | Manutenibilidade |
| RNF-03 | Regras de validação em funções puras testáveis sem Next.js nem Firebase. | Manutenibilidade |
| RNF-04 | Respostas de erro mantêm o formato `{ error: string }` em pt-BR, já consumido pelo cliente. | Usabilidade |
| RNF-05 | Nenhum log novo com conteúdo do arquivo ou do token. | Segurança |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | Somente `clinic_admin` ativo importa NF-e. | UC-10 (ator único); mesma restrição da UI e das rules de `nf_imports`/`inventory`. |
| RN-02 | `system_admin` **não** usa esta rota (403). | Não há fluxo de UC-10 para `system_admin`; menor privilégio. |
| RN-03 | O tenant considerado é sempre o do token; a rota não recebe `tenantId` por input. | Multi-tenant (RNF-01 de specs anteriores); a rota não grava nada. |
| RN-04 | Ordem das checagens: 401 → 403 → 413 (Content-Length) → 400/413 (arquivo) → 422/500. | Falhar cedo e barato. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Deletar** a rota legada e desinstalar `pdf-parse` com `npm uninstall pdf-parse` (atualiza `package.json` e `package-lock.json`, removendo também `pdfjs-dist` e `@napi-rs/canvas`, que só ele usa).
2. **Reutilizar `verifyBearerToken`** (`src/lib/services/accessRequestRouteHelpers.ts`) para o 401 — já trata token ausente **e** inválido/expirado como 401 (o padrão inline das outras rotas devolveria 500 para token inválido).
3. **Funções puras novas** em `src/lib/validations/nfeUploadValidation.ts` (pasta que já abriga `serverValidations.ts`): autorização por claims, checagem de `Content-Length` e validação das entradas de arquivo. A rota só orquestra.
4. **Limite em duas camadas:** `Content-Length` (rejeita antes de bufferizar, quando o header existe) + `file.size` depois do `formData()` (cobre corpo chunked sem `Content-Length`).
5. **Cliente:** `await user.getIdToken()` e header `Authorization` no `fetch` existente; sem `Content-Type` manual (o browser define o boundary do multipart).

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Manter `/api/parse-nf` protegida em vez de deletar | Sem chamador, contradiz a decisão de produto registrada no `CLAUDE.md` (XML é a estratégia única); manter custa dependência nativa e superfície. |
| Copiar o padrão inline de `verifyIdToken` | Token inválido viraria 500 (lança dentro do `try`); `verifyBearerToken` já resolve e é usado em 3 rotas. |
| Mover `verifyBearerToken` para um módulo genérico (`src/lib/apiAuth.ts`) nesta task | Melhoria de organização legítima, mas toca 3 rotas fora do escopo; fica como sugestão futura. |
| `verifyIdToken(token, true)` (checar revogação) | Nenhuma rota do projeto faz isso e a suspensão de tenant não chama `revokeRefreshTokens`; ganho nulo isoladamente. Mantida a paridade com o restante do projeto. |
| Checar `tenants/{tenant_id}.active` no Firestore via Admin SDK | Suspensão já zera a claim `active` dos usuários em cascata (`/api/tenants/[id]/suspend`); leitura extra por upload sem ganho real para uma rota que não grava. |
| Aceitar `system_admin` | Não há caso de uso; ver RN-02. |

### 4.3 Trade-offs aceitos

- **Janela de token:** claims alteradas (ex.: usuário desativado) só valem após o refresh do ID token (até ~1h) — mesmo comportamento de todas as rotas e das `firestore.rules`.
- **Sem `Content-Length`:** o `formData()` bufferiza o corpo até o limite da plataforma (backend de frameworks do Firebase Hosting) antes do 413 por `file.size`. Aceito: só alcançável por `clinic_admin` autenticado (auth vem antes).
- **Margem de multipart:** `MULTIPART_OVERHEAD_BYTES = 64 * 1024` somada ao limite no check de `Content-Length` — um arquivo de exatamente 10MB com boundary/headers não é falsamente rejeitado; o corte exato fica no `file.size`.
- **Borda de 10MB exatos:** `FileUpload` e esta rota aceitam `size <= 10MB`; `storage.rules` aceita `size < 10MB`. Diferença de 1 byte pré-existente, sem impacto prático; não corrigida aqui.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `src/lib/validations/nfeUploadValidation.ts` | Lib (pura) | Constantes de limite e guardas `checkParseNfeClaims`, `checkRequestContentLength`, `validateNfeUploadEntries`. |
| `src/__tests__/nfeUploadValidation.test.ts` | Teste Jest | Cobre as funções puras. |
| `src/__tests__/parseNfXmlRoute.test.ts` | Teste Jest | Cobre a rota com Admin SDK e parser mockados (401/403/413/400/200). |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `src/app/api/parse-nf-xml/route.ts` | Auth (`verifyBearerToken` + `checkParseNfeClaims`), `checkRequestContentLength`, `validateNfeUploadEntries` antes do parse. Resto inalterado. |
| `src/app/(clinic)/clinic/upload/page.tsx` | `fetch('/api/parse-nf-xml')` passa a enviar `Authorization: Bearer <idToken>`; guarda `!user` junto das existentes. |
| `package.json` | Remove `"pdf-parse": "^2.4.5"` de `dependencies`. |
| `package-lock.json` | Regenerado por `npm uninstall pdf-parse` (sai `pdf-parse`, `pdfjs-dist`, `@napi-rs/canvas` e binários opcionais dele). |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---|---|
| `src/app/api/parse-nf/route.ts` | Rota legada de DANFE PDF sem chamador, sem auth, sem limite (`UC-10-RN-12`). Diretório `src/app/api/parse-nf/` fica vazio e sai junto. |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| — | Nenhuma | A rota não lê nem grava no Firestore; nenhuma mudança em `firestore.rules`, `firestore.indexes.json` ou `storage.rules`. A verificação de token usa só o Firebase Auth (Admin SDK). |

### 5.5 O que NÃO muda

- `src/lib/parseNfeXml.ts` e `src/__tests__/parseNfeXml.test.ts` (parser e seus testes).
- `src/components/upload/FileUpload.tsx` (continua validando `.xml` e 10MB no client).
- `src/lib/services/nfImportService.ts` e o restante do fluxo de upload (Storage, `nf_imports`, `inventory`, `checkNumeroNFStatus`).
- `src/lib/services/accessRequestRouteHelpers.ts` (apenas importado, não alterado).
- `storage.rules` (inclusive o comentário que ainda cita "PDF (legado)" — fora do escopo).
- `CLAUDE.md` (a frase sobre a deleção volta a ser verdadeira sem edição).
- O `console.warn` existente da rota XML (número da NF + natureza da operação) — mantido.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — nenhum tipo de domínio muda. Tipos locais do módulo novo:

```ts
// src/lib/validations/nfeUploadValidation.ts (a criar)
export const MAX_NFE_XML_BYTES = 10 * 1024 * 1024; // UC-10 RNF-01 — igual a FileUpload maxSizeMB=10
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type NfeUploadGuardResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 413; error: string };

export interface NfeUploadClaims {
  role?: unknown;
  active?: unknown;
  tenant_id?: unknown;
}

export interface NfeUploadEntry {
  name: string;
  size: number;
}
```

### 6.2 Mudanças em serviços (funções puras)

```ts
/** 403 se não for clinic_admin ativo com tenant_id preenchido. */
export function checkParseNfeClaims(claims: NfeUploadClaims): NfeUploadGuardResult;
// ok  ⇔ role === 'clinic_admin' && active === true && typeof tenant_id === 'string' && tenant_id.length > 0
// erro: { status: 403, error: 'Apenas administradores ativos da clínica podem importar NF-e' }

/** 413 se Content-Length declarado exceder MAX_NFE_XML_BYTES + MULTIPART_OVERHEAD_BYTES. */
export function checkRequestContentLength(header: string | null): NfeUploadGuardResult;
// null, vazio, não numérico ou negativo → ok (a checagem por file.size cobre depois)
// erro: { status: 413, error: 'Arquivo muito grande. Máximo: 10MB' }

/** Valida as entradas File do FormData (já filtradas por instanceof File). */
export function validateNfeUploadEntries(entries: NfeUploadEntry[]): NfeUploadGuardResult;
// 0 entradas      → 400 'Nenhum arquivo enviado'
// > 1 entrada     → 400 'Envie apenas um arquivo XML por vez'
// nome sem .xml   → 400 'Apenas arquivos XML são aceitos nesta rota'  (case-insensitive, igual ao atual)
// size === 0      → 400 'Arquivo vazio'
// size > MAX      → 413 'Arquivo muito grande. Máximo: 10MB'
```

### 6.3 Mudanças na UI

`src/app/(clinic)/clinic/upload/page.tsx`, dentro de `handleUpload` (bloco l. 82–102):

```ts
// antes
const response = await fetch('/api/parse-nf-xml', { method: 'POST', body: formData });

// depois
const idToken = await user.getIdToken();
const response = await fetch('/api/parse-nf-xml', {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}` }, // NÃO definir Content-Type (boundary do multipart)
  body: formData,
});
```

- A guarda inicial (l. 68) passa a `if (!selectedFile || !tenantId || !userId || !user)` para o TypeScript estreitar `user`.
- O tratamento de erro existente (`if (!response.ok) { body.error … throw }` → `setError(msg)`, `setUploadStatus('error')`) já exibe as mensagens de 401/403/413 sem mudança. Visualmente: mesmo `Alert` de erro de hoje.

### 6.4 Mudanças em API Routes

**`DELETE` da rota:** `POST /api/parse-nf` — removida (404).

**`POST /api/parse-nf-xml`** — autenticação: `Authorization: Bearer <Firebase ID token>`, `clinic_admin` com `active == true`.

```ts
// Request: multipart/form-data
//   file: File  (exatamente 1; nome *.xml; 1 byte .. 10MB)

// Responses
type ParseNfXmlSuccess = { parsedNF: ParsedNF; warnings: XmlParseError[] }; // 200 (inalterado)
type ParseNfXmlError = { error: string };                                    // 400 | 401 | 403 | 413 | 422 | 500
```

| Status | Quando | `error` |
|---|---|---|
| 200 | XML válido | — (`{ parsedNF, warnings }`) |
| 400 | 0 arquivos / >1 arquivo / sem `.xml` / arquivo vazio | mensagens da Seção 6.2 |
| 401 | Sem `Authorization: Bearer`, token inválido ou expirado | `'Sessão inválida ou expirada. Faça login novamente.'` (passado como `missingTokenMessage`; para token inválido `verifyBearerToken` devolve `'Não autorizado'` — ver nota) |
| 403 | Token válido, mas não `clinic_admin` ativo com `tenant_id` | `'Apenas administradores ativos da clínica podem importar NF-e'` |
| 413 | `Content-Length` > 10MB + 64KB, ou `file.size` > 10MB | `'Arquivo muito grande. Máximo: 10MB'` |
| 422 | Erro de parse do XML (inalterado) | mensagem do parser |
| 500 | Erro inesperado (inalterado) | mensagem do erro |

Nota sobre o 401: hoje `verifyBearerToken` usa `missingTokenMessage` só para header ausente e `'Não autorizado'` fixo para token inválido. Ambos são 401 e o cliente exibe o texto recebido; não é necessário alterar o helper.

Esqueleto da rota (ordem obrigatória — RN-04):

```ts
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(request, 'Sessão inválida ou expirada. Faça login novamente.');
    if (decoded instanceof NextResponse) return decoded;                          // 401

    const claimsCheck = checkParseNfeClaims(decoded);
    if (!claimsCheck.ok) return NextResponse.json({ error: claimsCheck.error }, { status: claimsCheck.status }); // 403

    const lengthCheck = checkRequestContentLength(request.headers.get('content-length'));
    if (!lengthCheck.ok) return NextResponse.json({ error: lengthCheck.error }, { status: lengthCheck.status }); // 413

    const formData = await request.formData();
    const files = Array.from(formData.values()).filter((v): v is File => v instanceof File);
    const entriesCheck = validateNfeUploadEntries(files.map((f) => ({ name: f.name, size: f.size })));
    if (!entriesCheck.ok) return NextResponse.json({ error: entriesCheck.error }, { status: entriesCheck.status }); // 400/413

    const xmlContent = await files[0].text();
    // ... parseNfeXml + 422 + console.warn + 200 exatamente como hoje
  } catch (error: unknown) { /* 500 como hoje */ }
}
```

Observação: contar **todas** as entradas `File` do `FormData` (não só a chave `file`) fecha o caso "múltiplos arquivos sob chaves diferentes". O cliente atual envia só `file`.

---

## 7. Plano de Implementação

### STEP 1 — Guardas puras + testes

**Objetivo:** Ter as regras de autorização/tamanho/arquivo em funções puras cobertas por Jest.

**Arquivos afetados:**
- `src/lib/validations/nfeUploadValidation.ts` — criar (Seções 6.1 e 6.2).
- `src/__tests__/nfeUploadValidation.test.ts` — criar (Seção 8).

**Ações:**
1. Implementar constantes, tipos e as três funções exatamente como especificado.
2. Escrever os testes da Seção 8.1.

**Validação:** `npm run test -- nfeUploadValidation` verde; `npm run lint` e `npm run type-check` sem erros.

**Commits:** `fix(api): add pure guards for NF-e XML upload validation` e `test(api): cover NF-e XML upload guards`

---

### STEP 2 — Cliente envia o ID token

**Objetivo:** `/clinic/upload` passa a autenticar a chamada (ainda aceita pela rota sem auth — commit seguro isoladamente).

**Arquivos afetados:**
- `src/app/(clinic)/clinic/upload/page.tsx` — Seção 6.3.

**Ações:**
1. Ampliar a guarda inicial de `handleUpload` com `!user`.
2. Obter `idToken` e enviar `Authorization: Bearer` no `fetch`, sem `Content-Type`.

**Validação:** `npm run type-check`; importar um XML em `/clinic/upload` no emulador: preview aparece normalmente; DevTools → Network mostra o header `Authorization` na requisição a `/api/parse-nf-xml`.

**Commit:** `fix(inventory): send ID token when parsing NF-e XML on upload`

---

### STEP 3 — Endurecer `POST /api/parse-nf-xml`

**Objetivo:** 401/403/413/400 conforme a Seção 6.4, mantendo 200/422/500.

**Arquivos afetados:**
- `src/app/api/parse-nf-xml/route.ts`
- `src/__tests__/parseNfXmlRoute.test.ts` — criar.

**Ações:**
1. Importar `verifyBearerToken` de `@/lib/services/accessRequestRouteHelpers` e as guardas do STEP 1.
2. Reestruturar o início do handler na ordem do esqueleto (Seção 6.4); manter intactos o bloco de parse, o `console.warn` e as respostas 422/500.
3. Escrever o teste de rota (Seção 8.2), mockando `../lib/firebase-admin` (padrão de `auditLogRoutes.test.ts`) e `@/lib/parseNfeXml`.

**Validação:** `npm run test` verde; `curl -i -X POST http://localhost:3000/api/parse-nf-xml -F file=@nota.xml` sem header → 401.

**Commits:** `fix(api): require clinic_admin token and size limit on parse-nf-xml` e `test(api): cover parse-nf-xml auth and size responses`

---

### STEP 4 — Remover a rota legada

**Objetivo:** Eliminar `POST /api/parse-nf`.

**Arquivos afetados:**
- `src/app/api/parse-nf/route.ts` — remover (com o diretório).

**Ações:**
1. Reconfirmar ausência de chamadores: `git grep -n "api/parse-nf['\"\`/?]"` e `git grep -n "parse-nf/route"` — o único resultado esperado é documentação em `ONLY_FOR_DEVS/` e o `CLAUDE.md`.
2. `git rm -r src/app/api/parse-nf`.

**Validação:** `npm run build` sem erros e sem a rota `/api/parse-nf` na lista de rotas do build; `curl -i -X POST http://localhost:3000/api/parse-nf` → 404.

**Commit:** `chore(api): remove legacy DANFE PDF parse route`

---

### STEP 5 — Remover `pdf-parse`

**Objetivo:** Tirar a dependência morta (e suas transitivas nativas) do projeto.

**Arquivos afetados:**
- `package.json`, `package-lock.json`

**Ações:**
1. `npm uninstall pdf-parse` (na raiz; **não** em `functions/`).
2. Conferir no diff do lockfile a saída de `node_modules/pdf-parse`, `node_modules/pdfjs-dist` e `node_modules/@napi-rs/canvas*`, sem outras alterações não relacionadas (se houver ruído de versão, refazer com `npm uninstall` a partir de um `npm ci` limpo).
3. `git grep -n "pdf-parse"` — só documentação em `ONLY_FOR_DEVS/`.

**Validação:** `npm ci && npm run lint && npm run type-check && npm run test && npm run build` verdes.

**Commit:** `chore(deps): remove unused pdf-parse dependency`

---

### STEP 6 — Validação Manual

**Objetivo:** Confirmar que a importação de NF-e continua funcionando para o `clinic_admin` e que a rota recusa os demais casos com o status correto. Este roteiro é a fonte para o `qa-agent` (Modo A) gerar o caderno `tests/e2e/UC-10-importar-nfe-via-upload-de-xml.spec.ts`, que ainda não existe (regra 8 do `CLAUDE.md`).

**Pré-requisitos:**
- `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage` + `npm run test:e2e:seed` + `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` (mesmas variáveis do `playwright.config.ts`, incluindo `NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key`).
- Um XML de NF-e SEFAZ v4.00 de teste (não há XML versionado no repositório; usar o XML da NF-e 026229 se disponível localmente, ou outro XML real de teste). Chamado abaixo de `nota.xml`.
- Arquivo grande: `head -c 11000000 /dev/zero | tr '\0' 'a' > grande.xml` (≈10,5MB).
- ID tokens do emulador (Auth emulator REST, só funciona no emulador):
  `curl -s -X POST "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key" -H "Content-Type: application/json" -d '{"email":"qa.clinic-admin-a@curvamestra.test","password":"<TEST_PASSWORD>","returnSecureToken":true}'` → campo `idToken`. Repetir para `qa.clinic-user-a@curvamestra.test` e `qa.consultant@curvamestra.test`. `TEST_PASSWORD` está em `tests/e2e/fixtures/seed-data.ts`.

**Roteiro A — Fluxo feliz pela UI (sempre executar):**
1. Login como `qa.clinic-admin-a@curvamestra.test` → `/clinic/upload` (ou `/clinic/add-products` → Rennova → "Importar XML da NF-e").
2. Selecionar `nota.xml` → "Processar". **Esperado:** preview com os produtos da NF, igual ao comportamento anterior; DevTools → Network: requisição a `/api/parse-nf-xml` com header `Authorization: Bearer …` e status 200.
3. Confirmar a importação. **Esperado:** itens gravados em `tenants/test-clinic-a/inventory` e `nf_imports` (Emulator UI), como antes.
4. Na UI, tentar selecionar `grande.xml`. **Esperado:** `FileUpload` bloqueia com "Arquivo muito grande. Máximo: 10MB" (client, inalterado).

**Roteiro B — Respostas da rota (sempre executar, via curl):**
5. Sem header: `curl -i -X POST http://localhost:3000/api/parse-nf-xml -F file=@nota.xml` → **401**.
6. Token inválido: `-H "Authorization: Bearer abc"` → **401**.
7. Token de `clinic_user` → **403** com "Apenas administradores ativos da clínica podem importar NF-e".
8. Token do consultor → **403**.
9. Token de `clinic_admin` + `grande.xml` → **413** com "Arquivo muito grande. Máximo: 10MB".
10. Token de `clinic_admin` + dois arquivos (`-F file=@nota.xml -F extra=@nota.xml`) → **400** "Envie apenas um arquivo XML por vez".
11. Token de `clinic_admin` + arquivo `.pdf` (`-F file=@qualquer.pdf`) → **400**.
12. Token de `clinic_admin` + `nota.xml` → **200** com `parsedNF`.
13. Rota legada: `curl -i -X POST http://localhost:3000/api/parse-nf` → **404**.

**Roteiro C — Desativação (executar se houver tempo; garante a claim `active`):**
14. Pela UI de usuários (ou Emulator UI → Auth → editar custom claims), definir `active: false` para o clinic_admin de teste, obter novo `idToken` e repetir o passo 12 → **403**. Restaurar `active: true` ao final.

**Roteiro D — Domínio Firebase pessoal (após merge na branch pessoal):**
15. Em `dev-gscandelari.web.app` (ou domínio pessoal equivalente), repetir os passos 1–3 com um `clinic_admin` real de teste e o passo 13 (rota legada → 404). Conferir no Cloud Logging que não há mais logs `📄 Iniciando processamento de PDFs...`.

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Jest — funções puras (`src/__tests__/nfeUploadValidation.test.ts`)

| Função | Cenários obrigatórios |
|---|---|
| `checkParseNfeClaims` | `clinic_admin` + `active: true` + `tenant_id: 'tenant-a'` → ok; `clinic_user` → 403; `system_admin` (`tenant_id: null`) → 403; consultor (`role: 'clinic_consultant'`) → 403; `active: false` → 403; `active` ausente → 403; `active: 'true'` (string) → 403; `tenant_id: ''` → 403; `tenant_id` ausente → 403. |
| `checkRequestContentLength` | `null` → ok; `''` → ok; `'abc'` → ok; `'-1'` → ok; `String(MAX + OVERHEAD)` → ok; `String(MAX + OVERHEAD + 1)` → 413. |
| `validateNfeUploadEntries` | `[]` → 400; 2 entradas → 400; `nota.XML` (maiúsculas) com 1KB → ok; `nota.pdf` → 400; `nota.xml.pdf` → 400; size 0 → 400; size `MAX` → ok; size `MAX + 1` → 413. |

### 8.2 Jest — rota (`src/__tests__/parseNfXmlRoute.test.ts`)

Lógica de segurança: prioridade alta (regra do template). Mock de `../lib/firebase-admin` (`adminAuth.verifyIdToken`) como em `auditLogRoutes.test.ts`; mock de `@/lib/parseNfeXml` devolvendo `{ data: <ParsedNF mínimo>, errors: [] }`.

| Cenário | Esperado |
|---|---|
| Sem header `Authorization` | 401; `verifyIdToken` e `parseNfeXml` não chamados |
| `verifyIdToken` rejeita (token inválido) | 401; `parseNfeXml` não chamado |
| Claims de `clinic_user` | 403; `parseNfeXml` não chamado |
| Claims de `clinic_admin` com `active: false` | 403 |
| `clinic_admin` ativo + header `content-length` = 20MB | 413; `parseNfeXml` não chamado |
| `clinic_admin` ativo + FormData com 2 arquivos | 400 |
| `clinic_admin` ativo + `File` de `MAX + 1` bytes | 413 |
| `clinic_admin` ativo + `nota.xml` válido | 200 `{ parsedNF, warnings }` |
| `clinic_admin` ativo + `parseNfeXml` lança | 422 (inalterado) |

### 8.3 Suíte de rules / E2E

- `npm run test:rules`: N/A (nenhuma mudança em `firestore.rules`) — rodar só como regressão do CI.
- `npm run test:e2e`: regressão geral; não há spec de UC-10 hoje. Após a conclusão, `qa-agent` (Modo A) gera `tests/e2e/UC-10-importar-nfe-via-upload-de-xml.spec.ts` a partir do STEP 6 (exige um XML de teste versionado em fixture — o `qa-agent` deve sinalizar essa extensão do seed em vez de inventar dados), com revisão humana obrigatória.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build sem falhas e sem a rota /api/parse-nf
[ ] npm run test        — verde, com nfeUploadValidation.test.ts e parseNfXmlRoute.test.ts
[ ] npm run test:rules / test:e2e — verdes (regressão)
[ ] Multi-tenant: rota usa apenas claims do token; nenhum tenantId por input
[ ] Segurança: nenhum secret/credencial no código; nenhum log novo com conteúdo de arquivo ou token
[ ] git grep "pdf-parse" e "api/parse-nf'" sem ocorrências em código (só docs)
[ ] package-lock.json sem pdf-parse, pdfjs-dist, @napi-rs/canvas
[ ] STEP 6 executado (Roteiros A, B e D; C recomendado)
[ ] Branch pessoal: task branch mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] uml-use-case-writer: UC-10 atualizado (token, 401/403/413, RNF-01 server-side)
[ ] uc-issues-tracker (Modo B): UC-10-RN-12 e UC-10-RN-13 → Corrigido e Documentado; item da Seção 5 removido
[ ] qa-agent (Modo A) acionado após a conclusão para o caderno UC-10
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Algum consumidor externo não mapeado chamar `/api/parse-nf` | Baixa | Baixo | Varredura em todo o repo (Seção 1.1); a funcionalidade PDF foi oficialmente removida; 404 é o comportamento desejado. |
| Upload quebrar entre commits (rota exigindo token antes do cliente enviar) | Baixa | Médio | Ordem dos STEPs: cliente (STEP 2) antes da rota (STEP 3). |
| Definir `Content-Type` manual no `fetch` e quebrar o boundary do multipart | Média | Alto | Instrução explícita na Seção 6.3; STEP 6 passo 2 confere o 200. |
| Token expirado em sessão longa gerar 401 inesperado | Baixa | Baixo | `user.getIdToken()` renova automaticamente quando perto de expirar; mensagem pede novo login. |
| `npm uninstall` gerar ruído no lockfile | Média | Baixo | STEP 5 ação 2 (conferir diff; refazer a partir de `npm ci`). |
| `verifyBearerToken` mudar no futuro por causa das rotas de access request | Baixa | Médio | Coberto pelo `parseNfXmlRoute.test.ts`; sugestão futura de mover o helper para módulo genérico (Seção 4.2). |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| DANFE | Documento Auxiliar da NF-e (PDF). Estratégia de importação removida. |
| NF-e XML SEFAZ v4.00 | Arquivo XML oficial da nota fiscal; única forma de importação ativa (UC-10). |
| ID token | JWT do Firebase Auth do usuário logado, com as custom claims (`role`, `tenant_id`, `active`). |
| `verifyBearerToken` | Helper server-side existente que valida o header `Authorization: Bearer` e devolve o token decodificado ou uma resposta 401. |
| 413 Payload Too Large | Status HTTP para corpo/arquivo acima do limite aceito. |
| Multipart overhead | Bytes extras do `multipart/form-data` (boundary e cabeçalhos da parte) além do arquivo em si. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.51): `UC-10-RN-12`, `UC-10-RN-13`, Seção 5 (rota legada + `pdf-parse`), nota v3.51 item 12.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-10-importar-nfe-via-upload-de-xml.md` — Fluxo Principal passo 4, RNF-01.
- `CLAUDE.md` — "Funcionalidades Desabilitadas / Importação via XML NF-e".
- `ONLY_FOR_DEVS/TO_DO/FEAT-importacao-xml-nfe.md` — contexto da troca PDF → XML.
- `src/app/api/parse-nf/route.ts`, `src/app/api/parse-nf-xml/route.ts`, `src/app/(clinic)/clinic/upload/page.tsx`, `src/components/upload/FileUpload.tsx`, `storage.rules`.
- `src/lib/services/accessRequestRouteHelpers.ts` (`verifyBearerToken`); `src/app/api/tenants/[id]/consultant/invite/route.ts` (padrão inline).
- `src/__tests__/auditLogRoutes.test.ts` (padrão de teste de rota); `src/__tests__/parseNfeXml.test.ts`.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Seções 1, 2.3, 15.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 09/10/2026 | Doc Writer (Claude) | Versão inicial. Sem decisões pendentes. |
