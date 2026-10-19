# Feature: Coluna "Último acesso" nas listas de usuários e consultores do System Admin

**Projeto:** Curva Mestra
**Data:** 19/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** feature/ultimo-acesso-usuarios
**Prioridade:** Média
**Versão:** 1.0

> O System Admin passa a ver quando cada usuário usou o app pela última vez, em `/admin/users` e `/admin/consultants`. O dado vem do metadata do Firebase Auth (`lastSignInTime`/`lastRefreshTime`), lido por uma API route nova com Admin SDK. Não há gravação no Firestore, nem mudança de rules ou índices. O deploy é só de hosting, o que reduz o impacto para o cliente real em produção (desde 16/10/2026).

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (antes de criar a branch, confirmar que existe local e remoto e está em sync com `master`)
- **Branch da task:** `feature/ultimo-acesso-usuarios`
- **PR:** primeiro para a branch pessoal (`gscandelari_setup`), para validação em `dev-gscandelari.web.app`, e depois para `develop`. Nunca direto para `master`.

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| STEP 1 | feat | users | `feat(users): add pure last access helpers` |
| STEP 2 | feat | api | `feat(api): add last access endpoint for system admin` |
| STEP 3 | feat | admin | `feat(admin): show last access column in users and consultants lists` |
| STEP 4 | — | — | Validação manual, sem commit de código |
| STEP 5 | docs / test | uc / e2e | `docs(uc): map user last access listing (UC-59)` · `test(e2e): add UC-59 last access spec` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

1. `src/app/(admin)/admin/users/page.tsx` (851 linhas): `loadAllUsers()` lê `users` pelo client SDK (`orderBy('created_at', 'desc')`) e ignora `role === 'clinic_consultant'`. A tabela (linhas ~513–521) tem as colunas Usuário/Email/Clínica/Role/Status/Cadastro/Ações. O id do doc `users/{uid}` é o UID do Auth (`UserWithTenant.uid = userDoc.id`).
2. `src/app/(admin)/admin/consultants/page.tsx` (342 linhas): `loadConsultants()` chama `GET /api/consultants`. A tabela (linhas ~253–261) tem as colunas Código/Nome/Contato/Clínicas/Status/Criado em/Ações. O doc `consultants/{id}` tem **id gerado por `.add()`** em produção (`src/app/api/consultants/route.ts:204`), e o UID do Auth fica em `Consultant.user_id` (`src/types/index.ts:541`). No seed do emulador, id e `user_id` coincidem, mas isso **não vale em produção**.
3. Nenhum lugar do sistema expõe hoje o metadata do Auth. `src/hooks/useAuth.ts:52` chama `user.getIdToken(true)` a cada `onAuthStateChanged`, então quem abre o app com sessão ativa atualiza `metadata.lastRefreshTime`.
4. Padrão de rota restrita: `verifyBearerToken` (`src/lib/services/accessRequestRouteHelpers.ts:19`) mais a checagem `decoded.is_system_admin === true && decoded.active === true` (como em `src/app/api/tenants/search/route.ts:28`) e a constante `NO_STORE = { 'Cache-Control': 'no-store' }`.

### 1.2 Problema identificado

O System Admin não consegue saber quais usuários e consultores usam o sistema de fato. Isso dificulta suporte, acompanhamento de adoção e limpeza de contas paradas.

### 1.3 Motivação estratégica

O Firebase Auth já guarda esse histórico para todos os usuários, inclusive os de produção. A feature só lê esse dado, sem migração nem backfill.

---

## 2. Objetivos

1. Expor, só para system_admin ativo, o último acesso de uma lista de UIDs a partir do metadata do Firebase Auth.
2. Adicionar a coluna "Último acesso" em `/admin/users` e `/admin/consultants`.
3. Garantir que a tabela continue funcionando se a consulta de último acesso falhar ou demorar.
4. Cobrir a lógica pura e a rota com Jest, e o fluxo com caderno E2E (UC-59).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | `/admin/users` exibe a coluna "Último acesso" entre "Cadastro" e "Ações" | system_admin | Must |
| RF-02 | `/admin/consultants` exibe a coluna "Último acesso" entre "Criado em" e "Ações", usando `consultant.user_id` | system_admin | Must |
| RF-03 | O valor é exibido como `dd/mm/aaaa HH:mm` no fuso `America/Sao_Paulo` | system_admin | Must |
| RF-04 | Usuário existente no Auth que nunca acessou mostra "Nunca acessou" | system_admin | Must |
| RF-05 | Enquanto carrega, se a API falhar, se o UID não existir no Auth ou se o consultor não tiver `user_id`, a célula mostra "—" | system_admin | Must |
| RF-06 | `POST /api/admin/users/last-access` responde só a system_admin ativo | system_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A busca de último acesso não bloqueia a renderização da tabela (é feita depois de `setLoading(false)`, em paralelo) | Performance / Usabilidade |
| RNF-02 | No máximo 100 UIDs por chamada (limite de `adminAuth.getUsers`). O cliente divide a lista em lotes de 100 | Performance |
| RNF-03 | Resposta com `Cache-Control: no-store`. O erro 500 é genérico e não ecoa UIDs nem a mensagem interna | Segurança |
| RNF-04 | Nenhuma escrita no Firestore e nenhuma mudança em `firestore.rules`, `firestore.indexes.json` ou `storage.rules` | Manutenibilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Último acesso = o mais recente entre `metadata.lastRefreshTime` e `metadata.lastSignInTime` do `UserRecord`. Valores ausentes, vazios ou inválidos são ignorados. Sem nenhum valor válido, o resultado é `null` | D3 (decisão do usuário): última vez que usou o app, não só o último login |
| RN-02 | `null` = "Nunca acessou". UID ausente da resposta = "—" (desconhecido) | Não afirmar "nunca acessou" quando o dado simplesmente não existe |
| RN-03 | A consulta não gera trilha de auditoria (é só leitura e não altera dado) | Mesmo critério das demais listagens administrativas |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Lógica pura** em `src/lib/lastAccess.ts`: cálculo do máximo (RN-01), validação do body, divisão em lotes e rótulo de exibição. É testável sem Firebase.
- **Rota** `POST /api/admin/users/last-access`: `verifyBearerToken` → guarda de system_admin ativo → `parseLastAccessRequest(body)` → `adminAuth.getUsers(uids.map((uid) => ({ uid })))` → `{ data: { [uid]: string | null } }`. UIDs em `notFound` ficam fora de `data`. Usa POST (não GET) para não colocar até 100 UIDs na URL nem em logs de acesso.
- **Hook** `src/hooks/useLastAccess.ts`, compartilhado pelas duas telas: recebe `uids`, divide em lotes, chama a rota com `Promise.allSettled` e junta os lotes que deram certo. Lote com falha só gera `console.error`, sem toast.

### 4.2 Alternativas descartadas

- **Gravar `last_access_at` no Firestore a cada login/refresh:** cria escrita nova em produção e exige mudança de rules. Descartado por D1.
- **Incluir o último acesso em `GET /api/consultants`:** acopla a listagem ao Auth e não atende `/admin/users`, que lê pelo client SDK. Um endpoint único serve as duas telas.
- **Chamar `getUser(uid)` um por um:** N chamadas. `getUsers` resolve até 100 por chamada.

### 4.3 Trade-offs aceitos

- `lastRefreshTime` muda quando o token é renovado (cerca de 1h de sessão aberta, ou ao abrir o app por causa do `getIdToken(true)`). Por isso, "Último acesso" significa "última atividade com o app", não "último login" (D3).
- O system_admin também aparece em `/admin/users` e tem seu último acesso exibido. Não há motivo para esconder.
- A coluna não é ordenável nem filtrável neste escopo.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/lastAccess.ts` | Lib pura | `computeLastAccess`, `parseLastAccessRequest`, `chunkUids`, `formatLastAccessLabel`, `LAST_ACCESS_MAX_UIDS` |
| `src/app/api/admin/users/last-access/route.ts` | API route | `POST`, só system_admin ativo |
| `src/hooks/useLastAccess.ts` | Hook | Busca em lotes, não bloqueante |
| `src/__tests__/lastAccess.test.ts` | Jest | Lógica pura |
| `src/__tests__/lastAccessRoute.test.ts` | Jest | Rota com mocks |
| `ONLY_FOR_DEVS/PO_BA_Docs/UC-59-consultar-ultimo-acesso-de-usuarios.md` | UC | Via `uml-use-case-writer` (STEP 5) |
| `tests/e2e/UC-59-consultar-ultimo-acesso-de-usuarios.spec.ts` | E2E | Via `qa-agent` a partir do STEP 4 (STEP 5) |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/app/(admin)/admin/users/page.tsx` | Usar `useLastAccess(users.map(u => u.uid))` e adicionar `TableHead` e `TableCell` "Último acesso" |
| `src/app/(admin)/admin/consultants/page.tsx` | Usar `useLastAccess(consultants.map(c => c.user_id).filter(Boolean))` e adicionar a coluna |

### 5.3 Arquivos a REMOVER

N/A

### 5.4 Impacto no Firestore

N/A. Nenhuma leitura ou escrita nova no Firestore. Rules e índices não mudam. A rota só lê o Firebase Auth via Admin SDK.

### 5.5 O que NÃO muda

`src/hooks/useAuth.ts`, `GET /api/consultants`, `src/app/api/users/**`, a aba de usuários da clínica (`/clinic/...`), `src/types/` (o tipo de resposta fica em `src/lib/lastAccess.ts`), `firestore.rules`, `firestore.indexes.json`, `storage.rules`, Functions e audit log.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Sem mudança no Firestore. Tipos novos em `src/lib/lastAccess.ts`:

```ts
export const LAST_ACCESS_MAX_UIDS = 100;
export type LastAccessMap = Record<string, string | null>; // ISO 8601 UTC ou null

export interface AuthMetadataLike {
  lastSignInTime?: string | null;
  lastRefreshTime?: string | null;
}
```

### 6.2 Mudanças em serviços (lib pura)

```ts
// Maior data válida entre as duas (Date.parse aceita o formato RFC 1123 do Admin SDK); null se nenhuma.
export function computeLastAccess(metadata: AuthMetadataLike | null | undefined): string | null;

// Body precisa ser { uids: string[] }: 1..100 itens, cada um string não vazia (trim) com até 128 caracteres.
// Remove duplicados antes de contar.
export function parseLastAccessRequest(
  body: unknown
): { ok: true; uids: string[] } | { ok: false; error: string };

// Divide em lotes de até `size` (padrão LAST_ACCESS_MAX_UIDS), sem duplicados nem vazios.
export function chunkUids(uids: string[], size?: number): string[][];

// undefined → '—'; null → 'Nunca acessou'; ISO → 'dd/mm/aaaa HH:mm' em America/Sao_Paulo.
// Montar com Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ... }).formatToParts
// para não depender do separador ", " do ICU. ISO inválido → '—'.
export function formatLastAccessLabel(value: string | null | undefined): string;
```

Hook `src/hooks/useLastAccess.ts`:

```ts
export function useLastAccess(uids: string[]): { lastAccess: LastAccessMap; loading: boolean };
```

- Dependência estável: chave `[...new Set(uids)].sort().join(',')`. Com lista vazia, não chama a API.
- Token: `auth.currentUser?.getIdToken()` (de `@/lib/firebase`). Sem usuário, não chama a API.
- Para cada lote de `chunkUids`: `fetch('/api/admin/users/last-access', { method: 'POST', headers: { Authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ uids }) })`.
- `Promise.allSettled`: junta `data` dos lotes `ok`. Lotes com falha geram `console.error('[useLastAccess] ...')` e não lançam erro.
- Ignorar o resultado se o componente desmontar ou a chave mudar (flag `cancelled` no cleanup do `useEffect`).

### 6.3 Mudanças na UI

**`/admin/users`:** depois de `<TableHead>Cadastro</TableHead>`, adicionar `<TableHead>Último acesso</TableHead>`. Na linha, depois da célula de `formatTimestamp(user.created_at)`:

```tsx
<TableCell className="text-sm text-muted-foreground" data-testid="last-access">
  {formatLastAccessLabel(lastAccess[user.uid])}
</TableCell>
```

O hook recebe `users` (lista completa, não `filteredUsers`), então a busca por texto não dispara novas chamadas.

**`/admin/consultants`:** mesma coluna depois de "Criado em", com `consultant.user_id ? lastAccess[consultant.user_id] : undefined`. Ao trocar o filtro de status, a lista muda e o hook refaz a busca, o que é aceitável.

Nenhuma das duas tabelas usa `colSpan` no estado vazio, então não há ajuste extra.

### 6.4 Mudanças em API Routes

**`POST /api/admin/users/last-access`** (`export const dynamic = 'force-dynamic'; export const runtime = 'nodejs';`)

| Situação | Status | Body |
|----------|--------|------|
| Sem Bearer ou token inválido | 401 | `{ error }` (via `verifyBearerToken`) |
| Não é `is_system_admin === true && active === true` | 403 | `{ error: 'Acesso negado' }` |
| JSON inválido ou `parseLastAccessRequest` falha | 400 | `{ error }` |
| OK | 200 | `{ data: LastAccessMap }` |
| Erro em `getUsers` ou outro erro inesperado | 500 | `{ error: 'Erro ao consultar último acesso' }` |

```ts
// Request
interface LastAccessRequest { uids: string[] }
// Response 200
interface LastAccessResponse { data: LastAccessMap } // só UIDs encontrados no Auth
```

Todas as respostas levam `headers: NO_STORE`. Para cada `user` de `result.users`: `data[user.uid] = computeLastAccess(user.metadata)`. O `console.error` do 500 registra só o erro, sem a lista de UIDs.

---

## 7. Plano de Implementação

### STEP 1 — Lógica pura

**Objetivo:** `src/lib/lastAccess.ts` implementado e coberto por testes.

**Arquivos afetados:**
- `src/lib/lastAccess.ts` — a criar
- `src/__tests__/lastAccess.test.ts` — a criar

**Ações:**
1. Implementar as funções e constantes da seção 6.2 (sem importar Firebase).
2. Escrever os cenários da seção 8.

**Validação:** `npm run test -- lastAccess.test` verde, mais `npm run lint` e `npm run type-check`.

**Commit:** `feat(users): add pure last access helpers`

### STEP 2 — API route

**Objetivo:** Endpoint restrito a system_admin ativo, devolvendo o mapa de último acesso.

**Arquivos afetados:**
- `src/app/api/admin/users/last-access/route.ts` — a criar
- `src/__tests__/lastAccessRoute.test.ts` — a criar

**Ações:**
1. Implementar a rota conforme a seção 6.4, reutilizando `verifyBearerToken` e `adminAuth`.
2. Teste com `jest.mock('../lib/firebase-admin', () => ({ adminAuth: { verifyIdToken, getUsers }, adminDb: {}, getAdminApp: jest.fn() }))`, usando caminho **relativo**, no mesmo padrão de `src/__tests__/tenantSearchRoute.test.ts`.

**Validação:** `npm run test -- lastAccessRoute.test` verde.

**Commit:** `feat(api): add last access endpoint for system admin`

### STEP 3 — Hook e colunas

**Objetivo:** As duas telas exibem "Último acesso" sem bloquear a tabela.

**Arquivos afetados:**
- `src/hooks/useLastAccess.ts` — a criar
- `src/app/(admin)/admin/users/page.tsx` — coluna
- `src/app/(admin)/admin/consultants/page.tsx` — coluna

**Ações:**
1. Implementar o hook conforme a seção 6.2.
2. Adicionar as colunas conforme a seção 6.3 (`data-testid="last-access"` para o E2E).

**Validação:** `npm run lint`, `npm run type-check` e `npm run build` sem erros. Com o emulador, a coluna aparece preenchida em ambas as telas.

**Commit:** `feat(admin): show last access column in users and consultants lists`

### STEP 4 — Validação Manual

**Pré-requisitos:** Emulator Suite + `npm run test:e2e:seed` + `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, ou a branch pessoal em `dev-gscandelari.web.app`.

**Roteiro:**
1. Em outra janela anônima, fazer login como `qa.clinic-admin-a@curvamestra.test` e como `qa.consultant@curvamestra.test`. Anotar o horário.
2. Fazer login como system_admin (`qa.system-admin@curvamestra.test`) e abrir `/admin/users`. **Esperado:** a tabela aparece de imediato e a coluna "Último acesso", entre "Cadastro" e "Ações", passa de "—" para `dd/mm/aaaa HH:mm`. A linha do clinic_admin A mostra o horário do passo 1 (horário de Brasília, sem vírgula).
3. Criar um usuário pelo painel (UC-39) e não fazer login com ele. **Esperado:** a linha mostra "Nunca acessou".
4. Digitar algo na busca. **Esperado:** os valores continuam, e não há nova chamada a `/api/admin/users/last-access` na aba Network.
5. Abrir `/admin/consultants`. **Esperado:** coluna "Último acesso" depois de "Criado em". O consultor do passo 1 mostra a data e hora. Um consultor recém-criado (UC-28) mostra "Nunca acessou".
6. No DevTools, bloquear a URL `/api/admin/users/last-access` e recarregar. **Esperado:** a tabela carrega normalmente, a coluna fica em "—" e não aparece erro na tela (só `console.error`).
7. Como clinic_admin, chamar a rota pelo console com o próprio token. **Esperado:** 403.
8. Em `dev-gscandelari.web.app`, conferir um usuário real conhecido. **Esperado:** a data é coerente com o último uso informado.

### STEP 5 — UC e caderno E2E

**Objetivo:** Mapear o comportamento como UC-59 (próximo número livre) e gerar o caderno E2E.

**Ações:**
1. Acionar o `uml-use-case-writer` para criar `ONLY_FOR_DEVS/PO_BA_Docs/UC-59-consultar-ultimo-acesso-de-usuarios.md` (ator: system_admin), referenciando este spec. Nenhum UC existente cobre o caderno: UC-36 e UC-29 tratam de edição e não têm spec E2E.
2. Acionar o `qa-agent` (Modo A) sobre o STEP 4 para gerar `tests/e2e/UC-59-consultar-ultimo-acesso-de-usuarios.spec.ts`. Orientações:
   - Usuários "Nunca acessou": criar no próprio teste, via `getEmulatorAdminAuth().createUser` mais o doc `users/{uid}` (com `created_at`) ou `consultants/{autoId}` com `user_id`, e remover tudo no `afterAll`. Não depender de usuários do seed nunca terem logado, porque a ordem dos specs (workers: 1) é indeterminada.
   - Usuário com acesso: `loginAs` (de `tests/e2e/helpers/auth.ts`) como clinic_admin A em outro contexto e verificar na linha `[data-testid="last-access"]` o padrão `/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/`, sem fixar o horário. O Auth Emulator também preenche o metadata.
   - API: 401 sem token e 403 com token de clinic_admin, obtido como em `getIdTokenViaAuthEmulator` de `UC-02-aprovar-solicitacao-de-acesso.spec.ts`.

**Validação:** `npm run test:e2e -- UC-59` verde e spec revisado por humano.

**Commits:** `docs(uc): map user last access listing (UC-59)` · `test(e2e): add UC-59 last access spec`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| `computeLastAccess` | `src/__tests__/lastAccess.test.ts` | Refresh mais recente vence. Sign-in mais recente vence. Só um dos dois. Ambos ausentes, `''` ou inválidos → `null`. `metadata` `null`/`undefined` → `null`. Saída em ISO |
| `parseLastAccessRequest` | idem | Body não-objeto, sem `uids`, `uids` não-array, vazio, com item não-string, vazio ou maior que 128 → erro. 101 únicos → erro. 101 com duplicados que caem para ≤100 → ok. Remove duplicados e faz trim |
| `chunkUids` | idem | 0, 100, 101 e 250 itens (tamanhos 100/100/50). Remove duplicados |
| `formatLastAccessLabel` | idem | `undefined` → `—`. `null` → `Nunca acessou`. `'2026-10-19T12:30:00.000Z'` → `19/10/2026 09:30`. `'2026-10-20T02:10:00.000Z'` → `19/10/2026 23:10` (virada de dia no fuso). ISO inválido → `—` |
| `POST` (rota) | `src/__tests__/lastAccessRoute.test.ts` | 401 sem header. 401 com token inválido. 403 sem `is_system_admin`. 403 com system_admin `active: false`. 400 com JSON inválido e com 101 UIDs. 200: mapa com ISO e `null`, UID de `notFound` ausente, `getUsers` chamado com `[{ uid }]`. 500 genérico quando `getUsers` lança. `Cache-Control: no-store` em todas as respostas |

O hook e as pages não têm teste unitário (regra do MVP) e ficam cobertos pelo E2E UC-59. Spec E2E gerado por IA: revisão humana obrigatória antes de virar gate de CI (regra 8 do `CLAUDE.md`).

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — lastAccess.test e lastAccessRoute.test passando
[ ] npm run test:e2e    — UC-59 passando (spec revisado por humano)
[ ] Multi-tenant: N/A — rota global de system_admin, sem query Firestore (ver 4.1)
[ ] Segurança: só system_admin ativo; no-store; 500 sem detalhes; nenhum secret no código
[ ] Branch pessoal: validado em dev-gscandelari.web.app (STEP 4)
[ ] PR: aberto para develop com template preenchido
[ ] Deploy: só hosting — nenhuma mudança em firestore.rules / firestore.indexes.json / storage.rules (sem comando de deploy de rules no merge para master)
[ ] UC-59 criado e caderno E2E gerado (STEP 5)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Usar `consultant.id` no lugar de `user_id` (funciona no seed e falha em produção) | Média | Médio | Seção 1.1 item 2. O E2E cria um consultor com id automático, diferente do `user_id` |
| Mais de 100 usuários em produção | Baixa (hoje) | Baixo | `chunkUids` no hook. A rota rejeita mais de 100 |
| `lastRefreshTime` lido como "login" | Média | Baixo | Rótulo "Último acesso" e RN-01 documentados (D3) |
| Falha da rota quebrar a tela | Baixa | Médio | `allSettled` e fallback "—" (RF-05). Validado no passo 6 do STEP 4 |
| Exposição de dado pessoal (atividade) | Baixa | Médio | Só system_admin ativo, no-store e POST (UIDs fora da URL) |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `lastSignInTime` | Data do último login com credencial (`UserRecord.metadata`, Admin SDK) |
| `lastRefreshTime` | Data da última emissão ou renovação de ID token. Muda com o uso do app com sessão ativa |
| `getUsers` | `adminAuth.getUsers(identifiers)`: busca até 100 usuários e devolve `{ users, notFound }` |

---

## 12. Referências

- `src/app/(admin)/admin/users/page.tsx` — `loadAllUsers` e tabela (~513–560)
- `src/app/(admin)/admin/consultants/page.tsx` — `loadConsultants` e tabela (~253–300)
- `src/app/api/consultants/route.ts:204` — consultor criado com `.add()` (id ≠ uid)
- `src/types/index.ts:539` — `Consultant.user_id`
- `src/lib/services/accessRequestRouteHelpers.ts:19` — `verifyBearerToken`
- `src/app/api/tenants/search/route.ts` — guarda de system_admin ativo e `NO_STORE`
- `src/hooks/useAuth.ts:52` — `getIdToken(true)` no `onAuthStateChanged`
- `src/__tests__/tenantSearchRoute.test.ts` — padrão de mock relativo de `firebase-admin`
- `tests/e2e/UC-02-aprovar-solicitacao-de-acesso.spec.ts` — `getIdTokenViaAuthEmulator`
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md`
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 19/10/2026 | Doc Writer (Claude) | Versão inicial. Decisões D1 (fonte: metadata do Auth via Admin SDK), D2 (telas `/admin/users` e `/admin/consultants`) e D3 (máximo entre `lastRefreshTime` e `lastSignInTime`) tomadas pelo usuário antes da redação |
