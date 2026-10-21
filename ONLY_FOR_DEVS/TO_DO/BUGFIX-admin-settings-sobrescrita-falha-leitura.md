# Bugfix: Impedir que falha de leitura em Configurações do Sistema sobrescreva a configuração real (UX-046)

**Projeto:** Curva Mestra
**Data:** 21/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/admin-settings-sobrescrita-falha-leitura`
**Prioridade:** Alta
**Versão:** 1.1

> Em `/admin/settings` (UC-35), se `getDoc(system_settings/global)` falha, a tela mostra só um toast com `error.message` cru e libera o formulário com os valores padrão do `useState` (timeout 15, manutenção desligada, cadastro liberado). Um clique em "Salvar Configurações" grava esses padrões por cima da configuração real (`setDoc` sem `merge`). Com isso, um system_admin pode desligar sem querer um modo de manutenção ativo ou reabrir o cadastro em produção, onde há cliente real desde 16/10/2026. A correção cria um estado de erro distinto, com "Tentar novamente", e bloqueia o salvamento até a leitura dar certo. Também separa "documento não existe" de "falha de leitura", grava só os campos editáveis com `merge`, compara `updated_at` em transação para não sobrescrever uma alteração concorrente (fecha também o `UC-35-RN-01`) e troca o `error.message` cru por mensagens em pt-BR (UX-023, nesta tela).

---

## Decisões resolvidas

As duas decisões abertas na v1.0 foram respondidas explicitamente pelo usuário em 21/10/2026 (pergunta estruturada). O documento está pronto para o `dev-task-manager`.

| # | Decisão | Resposta do usuário (e justificativa da recomendação aceita) | Onde impacta |
|---|---------|--------------------------------------------------------------|--------------|
| D1 | Incluir neste bugfix a **checagem otimista de concorrência** (transação comparando `updated_at`), que resolve também `UC-35-RN-01`? (UC-35 §14 item 5 registrava como decisão de produto pendente.) | **Sim, entra neste bugfix.** Custa uma transação e um estado "desatualizado". Fecha o cenário real de duas abas abertas, inclusive do mesmo admin: uma aba antiga reverteria uma manutenção ligada na outra. É a mesma classe de dano do UX-046. | §4.1, RF-06/RF-07, STEP 3, §8, §12.1 |
| D2 | No caderno Playwright, simular a falha de leitura **abortando na rede** as requisições do navegador ao emulador do Firestore (`page.route('**/google.firestore.v1.Firestore/**', r => r.abort())`)? Não há dado falso: o emulador continua real e nada é respondido no lugar dele. | **Sim, simulação por `route.abort()`.** É injeção de falha de rede, não mock de dados. Já existe precedente aceito em `tests/e2e/UC-59-...spec.ts:289` (`route.abort()`). A alternativa de trocar as rules do emulador em tempo de execução mexe em estado global compartilhado (ver §4.2). | §4.2, STEP 5, §8.2 |

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop` (antes de criar a branch, conferir se `develop` local está em sync com `origin/develop` e com `master`).
**Branch da task:** `bugfix/admin-settings-sobrescrita-falha-leitura`

Fluxo obrigatório (`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seções 1.3-1.4):
`bugfix/admin-settings-sobrescrita-falha-leitura` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop`.

**PR nunca vai para `master`.** O merge é feito pelo usuário, via PR.

| Step | Tipo | Escopo | Mensagem de commit planejada | Condição |
|------|------|--------|------------------------------|----------|
| STEP 1 | `fix` | `admin` | `fix(admin): add pure helpers for global settings load and save guards` | Sempre |
| STEP 2 | `fix` | `admin` | `fix(admin): block settings form and save when global settings fail to load` | Sempre |
| STEP 3 | `fix` | `admin` | `fix(admin): save global settings in a transaction with concurrent change check` | Sempre (D1) |
| STEP 4 | `fix` | `admin` | `fix(admin): show pt-BR messages instead of raw firebase errors in settings` | Sempre |
| STEP 5 | `test` | `e2e` | `test(e2e): add UC-35 spec covering settings load failure and missing doc` | Sempre (simulação por `route.abort()`, D2) |
| STEP 6 | — | — | Validação manual, sem commit | Sempre |

Firestore rules e índices **não mudam** (ver §5.4). Por isso não há comando de deploy de rules ou indexes a passar ao usuário antes do merge em `master`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

`src/app/(admin)/admin/settings/page.tsx`:

- **Estado inicial (linhas 39-47):** `useState<SystemSettings>` começa com `session_timeout_minutes: 15`, `maintenance_mode: false`, `maintenance_message: ''`, `registration_enabled: true`, `updated_by: ''`, `updated_at: null as any`.
- **`loadSettings` (linhas 53-70):** `getDoc(doc(db, 'system_settings', 'global'))`.
  - Se `exists()`, faz `setSettings(docSnap.data())`.
  - Se não existir, mantém os padrões.
  - No `catch`, mostra só o toast "Erro ao carregar configurações" com `description: error.message` (texto do SDK, em inglês).
  - No `finally`, faz `setLoading(false)`.
  - Resultado: **falha de leitura e documento inexistente terminam no mesmo estado visual**. O formulário fica editável e com os padrões.
- **`handleSave` (linhas 72-120):** valida `auth.currentUser` e o intervalo 1-1440. Depois chama `setDoc(docRef, { ...settings, updated_by, updated_at: serverTimestamp() })`, **sem `merge`**, gravando também o campo `id: 'global'` que vem do estado. Em seguida chama `writeAdminAuditLog(...)`. No erro, mostra o toast "Erro ao salvar" com `error.message`.
- **`handleCheckClaimsIntegrity` (linhas 122-152):** card independente ("Integridade de Custom Claims"). No erro, também mostra `error.message`.
- **Botão "Salvar Configurações" (linhas 333-345):** só fica desabilitado durante `saving`. Nada no componente sabe se a leitura deu certo.

**Quem consome `system_settings/global`** (dimensiona o dano de gravar padrões):

| Consumidor | Arquivo | Campo | Efeito de gravar o padrão por cima do valor real |
|---|---|---|---|
| `ProtectedRoute` | `src/components/auth/ProtectedRoute.tsx:62-72` | `maintenance_mode === true` | Manutenção ativa vira `false`. Todo usuário não `system_admin` volta a entrar no sistema no meio de uma manutenção (ex.: migração de dados). |
| Tela de manutenção | `src/app/maintenance/page.tsx:33-41` | `maintenance_mode`, `maintenance_message` | A mensagem configurada se perde (vira `''`, e a tela mostra o texto de fallback). |
| `POST /api/access-requests` | `src/app/api/access-requests/route.ts:45-56` (Admin SDK) | `registration_enabled === false` bloqueia | Cadastro fechado vira `true`, e novas solicitações de acesso voltam a ser aceitas. |
| `useSessionTimeout` | `src/hooks/useSessionTimeout.ts:81-92` | `session_timeout_minutes` (> 0, senão 15) | Timeout configurado (ex.: 60) volta para 15 na próxima sessão de cada usuário. |

Regras (`firestore.rules:475-482`): `allow read: if isAuthenticated();` e `allow write: if isSystemAdmin();`.

O seed do emulador (`scripts/seed-emulator.ts`) **não** grava `system_settings/global`. A observação está em `tests/e2e/UC-01-solicitar-acesso-ao-sistema.spec.ts:35-39`. Não existe hoje caderno Playwright do UC-35.

### 1.2 Problema identificado

1. **Falha de leitura vira "padrões editáveis"** (UX-046, P0, severidade Alta no mapa §8.6). Rede instável, token expirado (`permission-denied`/`unauthenticated`) ou serviço `unavailable` deixam o system_admin diante de um formulário que **parece** a configuração atual. Só um toast efêmero avisa, e ele some.
2. **O salvamento não tem nenhuma guarda.** `handleSave` não sabe se a leitura deu certo e sobrescreve o documento inteiro (`UC-35-RN-01`, `setDoc` sem `merge`), inclusive campos que o admin nem tocou.
3. **Concorrência sem detecção** (`UC-35-RN-01`). Uma aba aberta antes de outra alteração salva por cima dela, sem aviso.
4. **Mensagens técnicas cruas** (UX-023 e UC-35 RNF-04): `error.message` do SDK em inglês nos três toasts da tela.

### 1.3 Motivação estratégica

- Produção tem cliente real desde 16/10/2026. Um clique errado nesta tela afeta todos os tenants de uma vez: reabre o acesso durante uma manutenção ou reabre o cadastro.
- `_PADRAO-UX.md` §4 ("Prevenção de erros") já fixou a regra: "Um formulário de configuração não pode ser salvo quando os dados reais não foram carregados (desvio: UX-046)". O §8(c) lista o UX-046 entre os "P0 isolados" do lote 2.
- O mapa (§8.6) aponta o efeito de segurança ao `security-auditor`.

---

## 2. Objetivos

1. **Garantir** que nada seja gravado em `system_settings/global` sem uma leitura bem-sucedida, confirmada pelo servidor, na mesma montagem da tela.
2. **Expor** um estado de erro de leitura distinto, persistente e acionável ("Tentar novamente"), sem renderizar o formulário com valores que não vieram do banco.
3. **Diferenciar** "documento não existe" (legítimo: a tela mostra os padrões efetivos e permite criar) de "falha de leitura" (bloqueia).
4. **Restringir** a gravação aos campos editáveis, com `merge: true`, em vez de sobrescrever o documento inteiro.
5. **Detectar** alteração concorrente por `updated_at` antes de gravar (D1), fechando o `UC-35-RN-01`.
6. **Substituir** o `error.message` cru por mensagens em pt-BR nos toasts desta tela (UX-023, só nesta tela).
7. **Criar** o caderno Playwright do UC-35 com o cenário de falha de leitura (regra 8 do `CLAUDE.md`).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | A leitura de `system_settings/global` usa `getDocFromServer`. Um resultado vindo só do cache local nunca conta como leitura válida. | system_admin | Must |
| RF-02 | Se a leitura falha, a tela mostra um `Alert` destrutivo, com mensagem em pt-BR e botão "Tentar novamente". Os três cards de configuração (Sessão, Manutenção, Registro) e o botão "Salvar Configurações" **não** são renderizados. | system_admin | Must |
| RF-03 | "Tentar novamente" repete a leitura. Se der certo, o formulário aparece com os valores reais. Se falhar de novo, o erro continua. | system_admin | Must |
| RF-04 | Se o documento não existe (confirmado pelo servidor), o formulário aparece com os padrões efetivos e um `Alert` informativo: nenhuma configuração foi salva ainda, e os valores exibidos são os aplicados hoje pelo sistema. Salvar é permitido e cria o documento. | system_admin | Must |
| RF-05 | `handleSave` só executa quando o status de leitura é `loaded` ou `missing`. A guarda fica na função, não só no botão (defesa em profundidade). | system_admin | Must |
| RF-06 | O salvamento roda em `runTransaction`: relê o documento e compara existência e `updated_at` com a base carregada. Se forem diferentes, aborta sem gravar. | system_admin | Must |
| RF-07 | Em conflito, a tela entra no estado "desatualizado". Um `Alert` explica que as configurações foram alteradas em outra sessão e oferece "Recarregar configurações". O salvamento fica bloqueado até recarregar. | system_admin | Must |
| RF-08 | A gravação envia só `session_timeout_minutes`, `maintenance_mode`, `maintenance_message`, `registration_enabled`, `updated_by` e `updated_at`, com `{ merge: true }`. O campo `id` deixa de ser gravado. | system_admin | Must |
| RF-09 | Depois de salvar, a tela relê o documento (sem o spinner de página inteira) para atualizar a base de `updated_at`. Se essa releitura falhar, a tela vai para o estado de erro (RF-02). | system_admin | Must |
| RF-10 | Os toasts de erro de leitura, salvamento e verificação de claims exibem mensagens em pt-BR. O detalhe técnico vai para `console.error`. | system_admin | Should |
| RF-11 | O card "Integridade de Custom Claims" continua disponível em todos os estados de leitura. Ele não depende de `system_settings`. | system_admin | Should |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhuma alteração em `firestore.rules`, `firestore.indexes.json` ou nos consumidores (`ProtectedRoute`, `maintenance/page.tsx`, `access-requests/route.ts`, `useSessionTimeout.ts`). | Manutenibilidade / Segurança |
| RNF-02 | A lógica de decisão (normalização, validação, comparação de revisão, payload, permissão de salvar) fica em funções puras testadas com Jest. | Manutenibilidade |
| RNF-03 | O estado de erro segue `_PADRAO-UX.md` §2 (erro distinto do vazio, no próprio bloco, mensagem acionável, "Tentar novamente") e §5 (sem `error.message` cru). | Usabilidade |
| RNF-04 | A transação adiciona uma leitura por salvamento. O impacto é desprezível: a tela é de uso raro (UC-35 §11). | Performance |
| RNF-05 | Os textos novos usam acentuação completa e não usam jargão técnico ("Firestore", "documento", "UID"). | Usabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Só se salva sobre uma base lida do servidor nesta montagem da tela (status `loaded` ou `missing`). | `_PADRAO-UX.md` §4: formulário de configuração não pode ser salvo sem os dados reais. |
| RN-02 | "Documento não existe" é um estado legítimo e equivale, no comportamento, aos padrões: todos os consumidores já usam fallback idêntico (`maintenance_mode` só bloqueia se `=== true`; o cadastro só fecha se `registration_enabled === false`; timeout cai para 15 se ausente ou inválido). Criar o documento com esses padrões não muda o comportamento do sistema. | §1.1, tabela de consumidores. |
| RN-03 | A normalização da tela espelha a semântica dos consumidores. Um documento existente com campo ausente ou inválido é exibido como o sistema efetivamente o aplica. | Evita mostrar um valor que o sistema não aplica. |
| RN-04 | Conflito de revisão: a base carregada `{exists, updated_at}` difere da relida na transação, então nada é gravado e nenhum log de auditoria é escrito. | `UC-35-RN-01`: último a salvar sobrescrevia o outro. |
| RN-05 | Log de auditoria (`writeAdminAuditLog`) só depois de uma gravação confirmada. Comportamento atual, mantido. | Trilha fiel (UC-53). |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**(a) Máquina de estados explícita de leitura.** A página passa a ter `loadStatus: 'loading' | 'loaded' | 'missing' | 'error' | 'stale'`, além de `baseline: SettingsBaseline` (existência + `updated_at` lidos). A renderização e `handleSave` derivam desse status pela função pura `canSaveSystemSettings`. O `useAsyncState` (`src/hooks/useAsyncState.ts`) **não** é usado aqui: ele só modela `loading`/`error: string` e não representa `missing` nem `stale`, que são centrais nesta tela.

**(b) `getDocFromServer` em vez de `getDoc`.** O `db` usa cache em memória (`src/lib/firebase.ts`, `getFirestore` sem persistência). Mesmo assim, `getDoc` pode responder do cache se o cliente estiver offline e o documento já tiver passado pelo cache na sessão (inclusive como "inexistente"). `getDocFromServer` rejeita (`unavailable`) quando não alcança o servidor. Isso torna confiável a distinção `missing` × `error`, que é o coração do bug.

**(c) Salvamento em transação com checagem otimista (D1).** `runTransaction(db, async (tx) => { const snap = await tx.get(ref); if (hasConcurrentChange(baseline, toBaseline(snap))) throw new SettingsConflictError(); tx.set(ref, payload, { merge: true }); })`. O padrão `runTransaction` no client já é usado em `src/lib/services/solicitacaoService.ts:277`.
- A base usa o `updated_at` que **já existe** no documento (sempre gravado com `serverTimestamp()`), então não precisa de campo novo de versão.
- Como o valor do `serverTimestamp()` só é conhecido depois da gravação, a tela relê o documento após salvar (RF-09) para atualizar a base.

**(d) Payload explícito com `merge: true`.** `buildSystemSettingsPayload(form, uid)` monta só os quatro campos editáveis e `updated_by`. A página acrescenta `updated_at: serverTimestamp()`. O `merge` preserva campos que esta tela não conhece (o `id` legado já gravado, ou campos futuros). Com a checagem otimista, "gravar só campos alterados" (diff) não traz ganho e foi descartado (§4.2).

**(e) Documento inexistente.** Formulário com `DEFAULT_SYSTEM_SETTINGS_FORM` + `Alert` informativo (variante `default` de `src/components/ui/alert.tsx`). Na transação, a base `{ exists: false, updatedAt: null }` garante que, se outro admin criar o documento enquanto isso, o salvamento acusa conflito.

**(f) Mensagens.** O erro de leitura e o de salvamento usam título fixo em pt-BR + `translateFirestoreError(error.code)` (`src/lib/firestoreErrors.ts`, já existente e testado em `src/__tests__/firestoreErrors.test.ts`) como descrição. A verificação de claims (`httpsCallable`) tem códigos com prefixo `functions/`, que essa função não cobre. Por isso usa mensagem fixa: "Não foi possível verificar a integridade agora. Tente novamente em instantes.". O detalhe vai sempre para `console.error`.

**(g) Firestore rules: sem alteração.** A leitura (`isAuthenticated()`) cobre o `tx.get` do system_admin e a escrita (`isSystemAdmin()`) cobre o `tx.set`. O bug é do client, não de autorização. A leitura ampla (`UC-35-RN-07`) é necessária para `ProtectedRoute`/`useSessionTimeout` (UC-35 §14 item 6) e fica fora deste escopo. Ela segue relacionada ao UX-046 pelo par `↔`, mas não muda aqui.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Só desabilitar o botão "Salvar" em erro, mantendo o formulário visível com padrões | O admin continua vendo valores falsos como se fossem a configuração em vigor (pode tirar conclusões erradas, ex.: "a manutenção está desligada"). `_PADRAO-UX.md` §2 regra 1: erro nunca aparece como dado. |
| Manter `getDoc` e tratar `snap.metadata.fromCache` como erro | Funciona, mas é menos explícito e fácil de esquecer em manutenção futura. `getDocFromServer` expressa a intenção na chamada. |
| `setDoc` com `merge` **sem** transação (opção mínima) | Resolve a sobrescrita de campos desconhecidos, mas não a de campos conhecidos por uma aba desatualizada. Descartada pelo usuário na D1. |
| Gravar só os campos alterados (diff contra a base) | Reduz o raio de uma gravação desatualizada, mas não o elimina: um campo alterado nas duas abas ainda é sobrescrito. Também adiciona estado de "valor original" por campo. Com a transação, é redundante. |
| Campo novo `revision: number` em vez de `updated_at` | Evitaria a releitura pós-salvamento, mas exige mudar `SystemSettings` e lidar com documentos sem o campo (o de produção). `updated_at` já existe e basta. |
| Rota `/api/settings` com Admin SDK | Resolve também o `UC-35-RN-08` (validação server-side), mas é escopo maior. O bug é resolvido inteiramente no client. Fica para a decisão já registrada no UC-35 §14 item 7. |
| Simular falha de leitura no E2E trocando as rules do emulador (`PUT /emulator/v1/projects/demo-curva-mestra-e2e:securityRules` com leitura negada) | Produziria um `permission-denied` real, mas altera estado global do emulador compartilhado por toda a suíte (`workers: 1`, seed único). Se o teste abortar antes do `finally`, os specs seguintes rodam com rules erradas. Descartada pela D2. |

### 4.3 Trade-offs aceitos

- **Uma leitura extra por salvamento** (transação) e **uma releitura após salvar.** Custo irrelevante para uma tela de uso raro.
- **"Tentar novamente" pode falhar logo após a rede voltar.** O SDK reconecta com backoff exponencial, então a primeira tentativa pode falhar de novo. A mensagem de `unavailable` já diz "Tente novamente em instantes.". Não há retentativa automática.
- **Edições perdidas em conflito.** Ao "Recarregar configurações", o que o admin tinha digitado é descartado. Isso é aceitável porque são só quatro campos. Mesclar edições seria complexo demais para o ganho.
- **O campo `id: 'global'` legado continua no documento de produção** (o `merge` não o remove). É inofensivo: nenhum consumidor lê esse campo.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/systemSettings.ts` | Lib pura | Tipos (`SystemSettingsForm`, `SettingsBaseline`, `SettingsLoadStatus`, `TimestampLike`), `DEFAULT_SYSTEM_SETTINGS_FORM` e as funções puras `normalizeSystemSettingsForm`, `validateSystemSettingsForm`, `hasConcurrentChange`, `buildSystemSettingsPayload`, `canSaveSystemSettings` |
| `src/__tests__/systemSettings.test.ts` | Teste Jest | Cobertura das funções puras (§8.1) |
| `tests/e2e/UC-35-editar-configuracoes-globais-do-sistema.spec.ts` | Caderno Playwright | Primeiro caderno do UC-35, com falha de leitura, documento inexistente, documento existente, `merge` e conflito concorrente |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/app/(admin)/admin/settings/page.tsx` | Estado `loadStatus`/`baseline`/`form`. `loadSettings` com `getDocFromServer`. Renderização condicional por status (erro, inexistente, desatualizado). `handleSave` com guarda, transação, payload explícito e releitura. Mensagens em pt-BR nos três `catch`. |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `system_settings/global` | Forma de escrita muda | De `setDoc` integral (com `id`) para `tx.set(..., { merge: true })` com seis campos. Nenhuma migração: documentos existentes continuam válidos. |
| `firestore.rules` | **Sem alteração** | `read: isAuthenticated()` e `write: isSystemAdmin()` já cobrem `getDocFromServer`, `tx.get` e `tx.set` do system_admin. |
| `firestore.indexes.json` | Sem alteração | Leitura por id, sem query. |

Multi-tenant: `system_settings` é coleção global de plataforma, fora de `tenants/{tenantId}`, e só o system_admin escreve. Por isso não há filtro por `tenant_id`, o que é correto para este caso.

### 5.5 O que NÃO muda

- `src/components/auth/ProtectedRoute.tsx`, `src/app/maintenance/page.tsx`, `src/app/api/access-requests/route.ts` e `src/hooks/useSessionTimeout.ts` (consumidores).
- `src/types/index.ts`: a interface `SystemSettings` permanece. O formulário usa o tipo novo `SystemSettingsForm` em `src/lib/systemSettings.ts`.
- `src/lib/firestoreErrors.ts` (só é reutilizado) e `src/lib/services/auditLogService.ts`.
- `functions/src/checkClaimsIntegrityOnDemand.ts` e a lógica do card de claims (só a mensagem do toast de erro muda).
- Comportamentos fora do escopo, registrados no UC-35: `parseInt(...) || 15` no input (RN-02), mensagem de manutenção não limpa (RN-03), falta de confirmação ao ligar a manutenção (RNF-02), "Cancelar" sem confirmação (RNF-03), spinner sem texto ou `role="status"` (UX-015, lote de acessibilidade).
- UX-023 nas outras telas (Documentos Legais, Suspender, Termos, Alertas): continua aberto.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

`SystemSettings` (`src/types/index.ts:365-373`) não muda. Tipos novos, a criar em `src/lib/systemSettings.ts`:

```ts
export interface SystemSettingsForm {
  session_timeout_minutes: number;
  maintenance_mode: boolean;
  maintenance_message: string; // sempre string no formulário ('' se ausente)
  registration_enabled: boolean;
}

export const DEFAULT_SYSTEM_SETTINGS_FORM: SystemSettingsForm = {
  session_timeout_minutes: 15,
  maintenance_mode: false,
  maintenance_message: '',
  registration_enabled: true,
};

/** Forma mínima de um Timestamp do Firestore, para manter as funções puras. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
}

/** Base de revisão: o que foi lido do servidor e contra o que o salvamento compara. */
export interface SettingsBaseline {
  exists: boolean;
  updatedAt: TimestampLike | null;
}

export type SettingsLoadStatus = 'loading' | 'loaded' | 'missing' | 'error' | 'stale';
```

### 6.2 Funções puras (`src/lib/systemSettings.ts`, a criar)

```ts
/** Espelha a semântica dos consumidores (RN-03). */
export function normalizeSystemSettingsForm(
  data: Record<string, unknown> | undefined
): SystemSettingsForm;
```
- `session_timeout_minutes`: mantém se for `number` finito e `> 0` (mesma regra de `useSessionTimeout.ts:87`). Senão, 15. Valor `> 1440` é mantido e exibido, e a validação barra o salvamento.
- `maintenance_mode`: `data?.maintenance_mode === true` (igual a `ProtectedRoute.tsx:67`).
- `registration_enabled`: `data?.registration_enabled !== false` (igual a `access-requests/route.ts:51`).
- `maintenance_message`: `typeof === 'string'`, senão `''`.
- `data` indefinido retorna `DEFAULT_SYSTEM_SETTINGS_FORM`.

```ts
export function validateSystemSettingsForm(
  form: SystemSettingsForm
): { ok: true } | { ok: false; message: string };
```
- Move a regra hoje inline em `handleSave` (linhas 82-89): inteiro entre 1 e 1440. Senão, `message: 'O timeout deve estar entre 1 e 1440 minutos (24 horas)'` (texto atual mantido).

```ts
export function hasConcurrentChange(loaded: SettingsBaseline, current: SettingsBaseline): boolean;
```
- `true` se `loaded.exists !== current.exists`.
- `true` se exatamente um dos `updatedAt` for `null`.
- `true` se ambos não forem nulos e `seconds` ou `nanoseconds` diferirem.
- `false` nos demais casos (inclusive ambos inexistentes, ou ambos existentes com `updatedAt` nulo e igual).

```ts
export function buildSystemSettingsPayload(
  form: SystemSettingsForm,
  uid: string
): SystemSettingsForm & { updated_by: string };
```
- Retorna exatamente os quatro campos editáveis + `updated_by`. **Não** inclui `id` nem `updated_at` (o sentinel `serverTimestamp()` é adicionado pela página, para manter a função pura).

```ts
export function canSaveSystemSettings(status: SettingsLoadStatus, saving: boolean): boolean;
```
- `true` somente para `status === 'loaded' || status === 'missing'` e `!saving`.

### 6.3 Mudanças na UI (`src/app/(admin)/admin/settings/page.tsx`)

**Estado:**
- `form: SystemSettingsForm` substitui `settings: SystemSettings`.
- `loadStatus: SettingsLoadStatus`, com `'loading'` inicial.
- `baseline: SettingsBaseline | null`.
- `loadErrorDetail: string`, para a descrição traduzida.
- `retrying: boolean` (opcional), para o rótulo do botão.

**`loadSettings({ silent }: { silent?: boolean } = {})`:**
1. Se `!silent`, define `setLoadStatus('loading')`.
2. Executa `const snap = await getDocFromServer(doc(db, 'system_settings', 'global'))`.
3. Se `snap.exists()`: `setForm(normalizeSystemSettingsForm(snap.data()))`, `setBaseline({ exists: true, updatedAt: snap.data().updated_at ?? null })`, `setLoadStatus('loaded')`.
4. Senão: `setForm(DEFAULT_SYSTEM_SETTINGS_FORM)`, `setBaseline({ exists: false, updatedAt: null })`, `setLoadStatus('missing')`.
5. No `catch (error)`: `console.error('Erro ao carregar system_settings/global', error)`, `setLoadErrorDetail(translateFirestoreError(error?.code))`, `setLoadStatus('error')`. Sem toast: o erro é persistente na tela.

**Renderização por status:**

| `loadStatus` | Cabeçalho | Área das configurações | Card de claims | Barra de ações |
|---|---|---|---|---|
| `loading` | Página inteira com `Loader2` (comportamento atual) | — | — | — |
| `error` | Visível | `Alert variant="destructive"`. Título: "Não foi possível carregar as configurações". Texto: "As configurações em vigor não foram lidas. Para não substituí-las por engano, a edição fica bloqueada até a leitura dar certo." + `loadErrorDetail`. Botão `outline` "Tentar novamente" chama `loadSettings()`. **Cards de Sessão, Manutenção e Registro não renderizados.** | Visível e funcional | Só "Cancelar". **"Salvar Configurações" não é renderizado.** |
| `missing` | Visível | `Alert` (default). Título: "Nenhuma configuração salva ainda". Texto: "Os valores abaixo são os padrões aplicados hoje pelo sistema. Ao salvar, eles passam a ficar registrados." + os três cards editáveis. | Visível | "Cancelar" + "Salvar Configurações" |
| `loaded` | Visível | Três cards editáveis (comportamento atual) | Visível | "Cancelar" + "Salvar Configurações" |
| `stale` | Visível | `Alert variant="destructive"`. Título: "As configurações foram alteradas em outra sessão". Texto: "Outra alteração foi salva enquanto esta tela estava aberta. Recarregue para ver os valores atuais; o que você digitou aqui será descartado." Botão "Recarregar configurações" chama `loadSettings()`. Cards **não** renderizados. | Visível | Só "Cancelar" |

O `disabled` do botão Salvar passa a ser `!canSaveSystemSettings(loadStatus, saving)`.

**`handleSave`:**
1. `if (!canSaveSystemSettings(loadStatus, saving) || !baseline) return;` (guarda RF-05).
2. Checagem de `auth.currentUser`: mantém o toast atual "Erro" / "Você precisa estar autenticado".
3. `const v = validateSystemSettingsForm(form); if (!v.ok)`: toast "Erro de validação" / `v.message`.
4. `setSaving(true)`.
5. `await runTransaction(db, async (tx) => { const snap = await tx.get(ref); const current = { exists: snap.exists(), updatedAt: snap.exists() ? snap.data().updated_at ?? null : null }; if (hasConcurrentChange(baseline, current)) throw new SettingsConflictError(); tx.set(ref, { ...buildSystemSettingsPayload(form, uid), updated_at: serverTimestamp() }, { merge: true }); })`. `SettingsConflictError` é uma classe local, `extends Error`.
6. Sucesso: `writeAdminAuditLog(...)` (inalterado), toast "Sucesso" / "Configurações salvas com sucesso", `await loadSettings({ silent: true })` (RF-09).
7. `catch`:
   - `SettingsConflictError`: `setLoadStatus('stale')`, sem toast, sem log de auditoria.
   - Demais erros: `console.error(...)` e toast "Erro ao salvar" / `translateFirestoreError(error?.code)`. O formulário fica como está (UC-35 §8d mantido).
8. `finally`: `setSaving(false)`.

**`handleCheckClaimsIntegrity` (`catch`):** `console.error(...)` e toast "Erro ao verificar integridade de claims" / "Não foi possível verificar a integridade agora. Tente novamente em instantes.".

**Mapeamento campo a campo:** os `onChange` passam a usar `setForm({ ...form, ... })`. Os inputs, rótulos e o `parseInt(...) || 15` continuam iguais (RN-02 do UC fora de escopo).

### 6.4 Mudanças em API Routes

N/A. A tela continua gravando direto no Firestore pelo client SDK (UC-35 RN-08 inalterado).

---

## 7. Plano de Implementação

### STEP 1 — Funções puras e testes

**Objetivo:** Criar `src/lib/systemSettings.ts` com os tipos e funções da §6.1/§6.2, cobertos por Jest.

**Arquivos afetados:**
- `src/lib/systemSettings.ts` (a criar)
- `src/__tests__/systemSettings.test.ts` (a criar)

**Ações:**
1. Implementar tipos, `DEFAULT_SYSTEM_SETTINGS_FORM` e as cinco funções conforme a §6.2. Nenhum import de `firebase/*` no arquivo.
2. Escrever os testes da §8.1.

**Validação:** `npm run test -- systemSettings` passa, e `npm run type-check` e `npm run lint` ficam sem erros.

**Commit:** `fix(admin): add pure helpers for global settings load and save guards`

### STEP 2 — Estado de leitura, estado de erro e bloqueio do salvamento

**Objetivo:** Fechar o UX-046: falha de leitura nunca libera formulário nem salvamento, e documento inexistente é tratado à parte.

**Arquivos afetados:**
- `src/app/(admin)/admin/settings/page.tsx`

**Ações:**
1. Trocar `settings` por `form` + `loadStatus` + `baseline` + `loadErrorDetail` (§6.3).
2. Reescrever `loadSettings` com `getDocFromServer` e `normalizeSystemSettingsForm`.
3. Implementar a renderização por status da tabela da §6.3 (`error`, `missing`, `loaded`). Importar `Alert`, `AlertTitle` e `AlertDescription` de `@/components/ui/alert`.
4. Adicionar a guarda `canSaveSystemSettings` no início de `handleSave` e no `disabled` do botão. Trocar a validação inline por `validateSystemSettingsForm`.
5. Ainda **sem** mexer na forma de gravação: ela muda no STEP 3.

**Validação:** com a aba Network do DevTools em "Offline" antes de abrir `/admin/settings`, aparecem o `Alert` destrutivo e o "Tentar novamente", sem os três cards e sem o botão Salvar. Ao voltar para "Online" e clicar em "Tentar novamente" (pode precisar de mais de uma tentativa, §4.3), o formulário aparece com os valores reais. Em ambiente sem o documento, aparece o `Alert` "Nenhuma configuração salva ainda".

**Commit:** `fix(admin): block settings form and save when global settings fail to load`

### STEP 3 — Gravação segura

**Objetivo:** Gravar só os campos editáveis com `merge`, dentro de transação com checagem de `updated_at` (D1).

**Arquivos afetados:**
- `src/app/(admin)/admin/settings/page.tsx`

**Ações:**
1. Montar o payload com `buildSystemSettingsPayload` + `updated_at: serverTimestamp()`.
2. `runTransaction` + `hasConcurrentChange` + `SettingsConflictError`, estado `stale` e o `Alert` "Recarregar configurações" (§6.3).
3. Depois do sucesso, chamar `loadSettings({ silent: true })` para atualizar `baseline`.

**Validação:**
- No emulador (Firestore UI, porta 4000), depois de salvar, o documento tem exatamente `session_timeout_minutes`, `maintenance_mode`, `maintenance_message`, `registration_enabled`, `updated_by` e `updated_at`. Não há `id` novo.
- Um campo extra criado à mão (ex.: `foo: 1`) continua no documento.
- Conflito: com duas abas abertas, salvar na aba A e depois na B deixa a B em "As configurações foram alteradas em outra sessão", e o documento mantém o valor da A.

**Commit:** `fix(admin): save global settings in a transaction with concurrent change check`

### STEP 4 — Mensagens em pt-BR (UX-023 nesta tela)

**Objetivo:** Eliminar `error.message` cru dos três `catch` da página.

**Arquivos afetados:**
- `src/app/(admin)/admin/settings/page.tsx`

**Ações:**
1. Leitura: o detalhe já vem de `translateFirestoreError` (STEP 2). Conferir que nenhum `error.message` sobrou.
2. Salvamento: descrição com `translateFirestoreError(error?.code)` + `console.error`.
3. Claims: mensagem fixa (§6.3) + `console.error`.

**Validação:** `grep -n "error.message" "src/app/(admin)/admin/settings/page.tsx"` não retorna nada.

**Commit:** `fix(admin): show pt-BR messages instead of raw firebase errors in settings`

### STEP 5 — Caderno Playwright do UC-35

**Objetivo:** Criar `tests/e2e/UC-35-editar-configuracoes-globais-do-sistema.spec.ts` com os cenários da §8.2.

**Arquivos afetados:**
- `tests/e2e/UC-35-editar-configuracoes-globais-do-sistema.spec.ts` (a criar)

**Ações:**
1. Usar `loginAs(page, TEST_USERS.systemAdmin, '/admin/dashboard')` (`tests/e2e/helpers/auth.ts`) e `getEmulatorAdminFirestore()` (`scripts/lib/emulatorAdmin.ts`), no mesmo padrão de `UC-53-...spec.ts`.
2. **Higiene obrigatória:** `test.beforeEach` e `test.afterEach` apagam `system_settings/global` via Admin SDK. Motivo: um documento com `maintenance_mode: true` ou `registration_enabled: false` que sobre do teste quebra os outros specs (bloqueia não-admins e o `/api/access-requests`). O seed não cria esse documento, e o estado esperado por todos os outros specs é "inexistente".
3. Simulação de falha por `page.route('**/google.firestore.v1.Firestore/**', (route) => route.abort())` (D2, §8.2). Configurar a rota **depois** do `loginAs` e **antes** de `page.goto('/admin/settings')`, que é uma navegação completa e cria uma instância nova do SDK.
4. Revisão humana do spec antes de virar gate de CI (regra 8 do `CLAUDE.md`).

**Validação:** `npm run test:e2e -- tests/e2e/UC-35-editar-configuracoes-globais-do-sistema.spec.ts` passa. Rodar a suíte completa (`npm run test:e2e`) confirma que nenhum outro spec foi afetado.

**Commit:** `test(e2e): add UC-35 spec covering settings load failure and missing doc`

### STEP 6 — Validação manual em `dev-gscandelari.web.app`

**Objetivo:** Confirmar o comportamento no Firebase real (ambiente pessoal), depois do PR para `gscandelari_setup`.

**Ações (roteiro):**
1. Documento existente com valores não padrão (ex.: timeout 30, cadastro desligado). A tela mostra os valores reais. Alterar só o timeout e salvar: os outros campos se mantêm.
2. DevTools em "Offline", recarregar `/admin/settings`: aparece o `Alert` de erro, sem formulário e sem Salvar. Voltar a "Online" e clicar em "Tentar novamente" (pode exigir repetir): os valores reais aparecem.
3. Duas abas: salvar em uma e depois na outra deixa a segunda no estado "desatualizado". Conferir o documento no console.
4. Conferir na trilha de auditoria (`/admin/audit-log`, UC-53) que o conflito **não** gerou registro e que o salvamento com sucesso gerou.
5. **Não** ligar o modo de manutenção no ambiente de produção para testar.

**Validação:** os cinco itens conferidos e descritos no PR.

**Commit:** N/A.

---

## 8. Estratégia de Testes

### 8.1 Jest (funções puras), `src/__tests__/systemSettings.test.ts`

| Função | Cenários obrigatórios |
|--------|----------------------|
| `normalizeSystemSettingsForm` | `undefined` retorna os padrões. Documento completo preserva os valores. `maintenance_mode: 'true'` (string) vira `false`. `registration_enabled` ausente vira `true`, e `false` continua `false`. `session_timeout_minutes` `0`, negativo, `NaN` ou string viram 15. `2000` é mantido. `maintenance_message` ausente ou não string vira `''`. |
| `validateSystemSettingsForm` | `1` e `1440` são válidos. `0`, `1441` e `-5` são inválidos, com a mensagem exata. Não inteiro (`1.5`) é inválido. |
| `hasConcurrentChange` | Ambos inexistentes dão `false`. Inexistente × existente dá `true`, e o inverso também. Mesmo `seconds`/`nanoseconds` dá `false`. Mesmo `seconds` com `nanoseconds` diferente dá `true`. Um `updatedAt` nulo e outro não dá `true`. Ambos existentes com `updatedAt` nulo dá `false`. |
| `buildSystemSettingsPayload` | Chaves exatamente iguais a `['maintenance_message','maintenance_mode','registration_enabled','session_timeout_minutes','updated_by']` (ordenadas). Não inclui `id` nem `updated_at`. |
| `canSaveSystemSettings` | `loaded`/`missing` com `saving=false` dão `true`. `loading`, `error` e `stale` dão `false`. Qualquer status com `saving=true` dá `false`. |

Componente React e página: não há teste Jest (regra do MVP). A cobertura vem do caderno Playwright.

### 8.2 Caderno Playwright, `tests/e2e/UC-35-editar-configuracoes-globais-do-sistema.spec.ts`

**Como simular a falha de leitura contra o Emulator Suite:**
- Com as rules atuais, o system_admin **sempre** consegue ler `system_settings/global` (`isAuthenticated()`). Não há como provocar um `permission-denied` real sem mexer nas rules.
- "Documento inexistente" **não é** falha: é o cenário `missing`, testável de forma natural (o seed não cria o documento).
- **Decidido (D2, pelo usuário em 21/10/2026):** abortar no nível de rede as requisições do navegador ao emulador do Firestore com `page.route('**/google.firestore.v1.Firestore/**', (route) => route.abort())`, depois do login e antes do `page.goto('/admin/settings')`.
  - Não há mock: nenhuma resposta é fabricada, e o emulador segue real para a verificação via Admin SDK (que roda no processo do teste, fora do navegador, e não é afetado pela rota).
  - O SDK percebe o stream caído, marca o cliente como offline, e `getDocFromServer` rejeita com `unavailable`. É o caminho real de falha de rede em produção.
  - Precedente aceito: `tests/e2e/UC-59-consultar-ultimo-acesso-de-usuarios.spec.ts:289`.
- **Se a interceptação não funcionar tecnicamente** (ex.: o SDK usa uma URL que o glob não pega e ajustar o glob não resolve), **não** trocar por conta própria para outra técnica (como substituir as rules do emulador, descartada na §4.2). Parar e consultar o usuário, registrando o achado no PR.

**Cenários:**

| # | Cenário | Preparação | Verificação |
|---|---------|-----------|-------------|
| 1 | Falha de leitura bloqueia formulário e salvamento (UX-046) | Admin SDK grava `{ session_timeout_minutes: 45, maintenance_mode: true, maintenance_message: 'Teste E2E', registration_enabled: false, updated_at: Timestamp.now() }`. Login, `page.route(... abort)`, `goto('/admin/settings')` | Visível: "Não foi possível carregar as configurações" e o botão "Tentar novamente". `getByRole('button', { name: 'Salvar Configurações' })` com `toHaveCount(0)`. `getByLabel('Ativar modo de manutenção')` com `toHaveCount(0)`. "Integridade de Custom Claims" visível. Via Admin SDK, o documento continua **idêntico** ao gravado. |
| 2 | "Tentar novamente" recupera | Continuação do 1: `page.unroute(...)` | `expect(async () => { click "Tentar novamente"; expect(getByLabel('Tempo de sessão (minutos)')).toHaveValue('45') }).toPass({ timeout: 30_000 })`, por causa do backoff de reconexão (§4.3). O switch de manutenção aparece ligado e o de cadastro desligado. |
| 3 | Documento inexistente | `beforeEach` já apagou. Login, `goto` | Visível "Nenhuma configuração salva ainda". Timeout `15`. Salvar com timeout `30` cria o documento: via Admin SDK, chaves exatamente `maintenance_message`, `maintenance_mode`, `registration_enabled`, `session_timeout_minutes`, `updated_at`, `updated_by` (sem `id`), e `session_timeout_minutes === 30`. |
| 4 | Documento existente: `merge` preserva campo desconhecido | Admin SDK grava o documento com `campo_extra: 'x'`, `registration_enabled: true`, `maintenance_mode: false` | Alterar timeout e salvar. Via Admin SDK: `campo_extra === 'x'` e o timeout atualizado. |
| 5 | Conflito concorrente (D1) | Documento existente, tela carregada. Em seguida, Admin SDK altera `registration_enabled: false` + `updated_at: Timestamp.now()` | Clicar "Salvar Configurações": aparece "As configurações foram alteradas em outra sessão". Via Admin SDK, `registration_enabled === false` (não foi revertido). "Recarregar configurações" mostra o switch de cadastro desligado. |

O `afterEach` apaga `system_settings/global` em todos os casos, inclusive em falha (uma `test.afterEach` roda mesmo quando o teste quebra).

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — systemSettings.test.ts passando, suíte completa verde
[ ] npm run test:e2e    — UC-35 spec passando e nenhum outro spec regredido
[ ] Spec Playwright revisado por humano antes de virar gate de CI (regra 8 do CLAUDE.md)
[ ] Multi-tenant: N/A justificado (coleção global, escrita só por system_admin, §5.4)
[ ] Segurança: nenhum secret ou credencial no código
[ ] firestore.rules e firestore.indexes.json inalterados (git diff vazio nesses arquivos)
[ ] Nenhum `error.message` em src/app/(admin)/admin/settings/page.tsx
[ ] Falha de leitura: sem formulário, sem botão Salvar, com "Tentar novamente"
[ ] Documento inexistente: Alert informativo e salvamento cria o documento só com os 6 campos
[ ] Conflito concorrente não grava nem gera log de auditoria
[ ] Branch pessoal: PR da task para gscandelari_setup, validado em dev-gscandelari.web.app (STEP 6)
[ ] PR gscandelari_setup → develop aberto com template preenchido
[ ] Pós-PR: uml-use-case-writer (UC-35), uc-issues-tracker (mapa) e ux-reviewer Modo C acionados (§12.1)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| O documento sobra no emulador com `maintenance_mode: true` depois do spec e quebra a suíte inteira (não-admins redirecionados para `/maintenance`) | Média | Alto | `beforeEach` e `afterEach` apagam o documento (STEP 5, ação 2). Rodar a suíte completa no DoD. |
| `page.route` não pega o transporte do SDK (ex.: long polling com URL diferente) e a leitura não falha no teste | Baixa | Médio | O padrão `**/google.firestore.v1.Firestore/**` cobre `Listen/channel` e `Write/channel` do WebChannel. Se falhar, conferir as URLs no trace do Playwright e ajustar o glob. Se ainda falhar, parar e consultar o usuário (§8.2), sem trocar de técnica por conta própria. |
| O cenário 2 fica intermitente por causa do backoff de reconexão do SDK | Média | Baixo | `toPass` com timeout de 30 s e cliques repetidos. Se ainda assim for instável, trocar por `page.reload()` depois do `unroute` e registrar no cabeçalho do spec. |
| Releitura pós-salvamento falha logo após uma gravação bem-sucedida | Baixa | Baixo | A tela vai para o estado de erro (RF-09). A gravação já foi confirmada pelo toast e pela auditoria, e o admin só precisa clicar "Tentar novamente". |
| O documento de produção não tem `updated_at` (criado fora da tela) | Baixa | Baixo | `hasConcurrentChange` trata ambos nulos como iguais. A primeira gravação passa a gravar `updated_at`. |
| Durante uma queda real, "Tentar novamente" falha várias vezes e o admin conclui que a tela está quebrada | Média | Baixo | A mensagem traduzida de `unavailable` diz "Tente novamente em instantes". O comportamento é seguro por construção (nada é gravado). |
| `getDocFromServer` exige conexão, então a tela fica inutilizável offline | Alta (offline) | Baixo | É o comportamento desejado: editar configuração global offline é exatamente o risco que este bugfix elimina. |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `system_settings/global` | Documento singleton com as configurações de plataforma (UC-35), lido por `ProtectedRoute`, `/maintenance`, `/api/access-requests` e `useSessionTimeout`. |
| Base de revisão (`SettingsBaseline`) | Par `{ exists, updatedAt }` lido do servidor ao carregar a tela, usado para detectar alteração concorrente no salvamento. |
| Checagem otimista (optimistic concurrency) | Gravar só se o documento não mudou desde a leitura. Aqui, comparando `updated_at` dentro de `runTransaction`. |
| `getDocFromServer` | Variante de leitura do SDK web que nunca responde do cache: rejeita se não alcançar o servidor. |
| Estado `missing` | Leitura bem-sucedida que confirmou que o documento não existe. É diferente de falha. |
| Estado `stale` | Tela desatualizada depois de um conflito detectado. Salvamento bloqueado até recarregar. |
| Injeção de falha de rede | Abortar requisições no navegador (`page.route(...).abort()`) sem fabricar respostas. É diferente de mock. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-UX.md`: §2 (estado de erro), §4 (prevenção de erros, desvio UX-046), §5 (UX-023), §7 (linha UX-046), §8(c) (lote 2 "P0 isolados").
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` v3.61: §8.6 (UX-046, P0/Alta; UX-023, Baixa), linhas `UC-35-RN-01` e `UC-35-RN-07` com os pares `↔`.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-35-editar-configuracoes-globais-do-sistema.md` v2.0: §3, §4, §6 passos 2-3 e 11, §8c, §8d, RN-01, RN-07, RNF-04, §14 itens 5-7.
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` v2.0 (política "sem mock").
- Código: `src/app/(admin)/admin/settings/page.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/app/maintenance/page.tsx`, `src/app/api/access-requests/route.ts`, `src/hooks/useSessionTimeout.ts`, `src/lib/firestoreErrors.ts`, `src/hooks/useAsyncState.ts`, `src/components/inventory/ProjectionsView.tsx:105-111`, `src/lib/services/solicitacaoService.ts:277`, `firestore.rules:475-482`, `tests/e2e/helpers/auth.ts`, `scripts/lib/emulatorAdmin.ts`, `tests/e2e/UC-59-...spec.ts:289`, `playwright.config.ts`.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Git Flow e Conventional Commits.

### 12.1 Atualizações esperadas depois da correção (pipeline de agentes)

- **`uml-use-case-writer` → UC-35 (v2.0 → v2.1):**
  - §3: a pré-condição sobre documento inexistente passa a distinguir falha de leitura.
  - §4.1: gravação em transação com checagem de `updated_at`, `merge` e seis campos.
  - §4.2: nova garantia mínima de que falha de leitura não grava nada.
  - §6 passos 2-3 e 11.
  - **§8c reescrito** (estado de erro com "Tentar novamente", formulário e Salvar ocultos).
  - §8d (mensagem em pt-BR).
  - Novo §8e "Conflito de alteração concorrente".
  - RN-01 marcada `[CORRIGIDO]` (resolve a sobrescrita integral e a concorrência sem detecção).
  - RNF-04 `[CORRIGIDO]`.
  - §14 item 5 marcado como resolvido (decisão do usuário em 21/10/2026: transação com checagem de `updated_at` + `merge`).
  - Aproveitar para corrigir uma imprecisão já existente: RN-05 diz que `access-requests` lê "via `getDoc` (client SDK)", mas o código atual usa `adminDb` (`route.ts:50`).
- **`uc-issues-tracker` → mapa:**
  - `UX-046` vai para "Corrigido e Documentado".
  - Pelo par `↔`: `UC-35-RN-01` vai para "Corrigido e Documentado".
  - `UC-35-RN-07` **permanece "Aberto"**: este bugfix não toca a leitura ampla, que segue intencional (UC-35 §14 item 6). Só a nota do par recebe a menção à correção do UX-046.
  - `UX-023` permanece "Aberto", com nota de correção parcial (`/admin/settings` corrigido; restam Documentos Legais, Suspender, Termos e Alertas).
  - Registrar que o caderno do UC-35 passou a existir.
- **`ux-reviewer` (Modo C, re-verificação):** confirmar o UX-046 em `/admin/settings` (estado de erro distinto, salvamento bloqueado) e a parte do UX-023 nesta tela. Atualizar `_PADRAO-UX.md` §7 e a linha do UC-35 na tabela de telas por UC.
- **`security-auditor`:** informar que o efeito de segurança apontado no mapa §8.6 foi tratado no client, sem mudança de rules.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 21/10/2026 | Doc Writer (Claude) | Versão inicial. Status "Aguardando decisão" por causa de D1 (checagem otimista de concorrência neste escopo) e D2 (aceitar abortar requisições de rede ao emulador como simulação de falha no caderno Playwright). |
| 1.1 | 21/10/2026 | Doc Writer (Claude) | D1 e D2 resolvidas pelo usuário em 21/10/2026 (resposta explícita via pergunta estruturada). D1 = sim: a transação com checagem de `updated_at` entra no escopo e fecha o `UC-35-RN-01`. D2 = sim: a falha de leitura é simulada com `page.route(...).abort()` no emulador. Status passa de "Aguardando decisão" para "Planejamento". Removidos o caminho alternativo `merge` sem transação (STEP 3 alt.) e o plano B de troca de rules do emulador. O cenário 5 do caderno (conflito) passa a ser obrigatório. A atualização esperada do mapa fica fixada com `UC-35-RN-01` em "Corrigido e Documentado". Se o `route.abort()` não funcionar tecnicamente, a orientação passa a ser parar e consultar o usuário. |
