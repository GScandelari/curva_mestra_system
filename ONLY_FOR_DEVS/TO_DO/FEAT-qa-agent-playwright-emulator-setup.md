# Feature: Infraestrutura de QA Automatizada — Playwright + Firebase Emulator Suite + Agente `qa-agent`

**Projeto:** Curva Mestra
**Data:** 14/08/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `chore/qa-agent-playwright-emulator-setup`
**Prioridade:** Alta
**Versão:** 1.0

> Deriva de `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0, **Aprovado**, 7 perguntas da Seção 10.1 já respondidas). Constrói a infraestrutura completa de QA automatizada — `playwright.config.ts` apontando para o Firebase Emulator Suite já configurado em `firebase.json`, script `test:e2e` real (hoje só existe como exemplo não aplicado no guia de pipeline), `scripts/seed-emulator.ts` com fixture determinística, o novo agente `qa-agent` (`.claude/agents/qa-agent.md`) que gera specs Playwright a partir de documentação já existente, e um job de CI (`.github/workflows/e2e.yml`) que roda esses specs como gate obrigatório de PR para `develop`/`master`. Não migra o backlog retroativo dos UC-01 a UC-53 de uma vez — deixa a infraestrutura pronta e documenta esse backlog como trabalho contínuo, a começar logo após esta task ser mergeada.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`
- **Branch da task:** `chore/qa-agent-playwright-emulator-setup` (infraestrutura de teste, não é `feature/` de produto — conforme já sugerido no próprio ADR, Seção 0)
- **Fluxo de PR:** `chore/qa-agent-playwright-emulator-setup` → PR → `gscandelari_setup` (validação Firebase) → PR → `develop`. **Nunca** abrir PR direto para `master`.

| Step | Tipo | Escopo | Mensagem |
|---|---|---|---|
| 1 | `chore` | `deps` | `chore(deps): add firebase-tools and tsx as dev dependencies` |
| 1 | `chore` | `config` | `chore(config): add test:e2e and test:e2e:seed npm scripts` |
| 2 | `chore` | `config` | `chore(config): add playwright.config.ts targeting firebase emulator suite` |
| 3 | `test` | `config` | `test(config): add deterministic e2e fixture data for firebase emulator seed` |
| 4 | `chore` | `config` | `chore(config): add emulator-only admin sdk helper with real-firebase guard` |
| 4 | `test` | `config` | `test(config): cover emulator-only admin sdk guard with unit tests` |
| 5 | `feat` | `config` | `feat(config): add scripts/seed-emulator.ts to seed firebase emulator suite` |
| 6 | `test` | `config` | `test(config): add infra smoke e2e spec validating emulator + playwright pipeline` |
| 7 | `feat` | `agents` | `feat(agents): add qa-agent subagent definition` |
| 8 | `ci` | `config` | `ci(config): add e2e job running playwright against firebase emulator suite` |
| 9 | `docs` | `config` | `docs(config): require e2e status check on develop branch protection` |
| 10 | `docs` | `config` | `docs(config): document qa-agent in pipeline guide section 15` |

> Escopo `agents` não consta na lista formal de `commitlint.config.js` (Seção 2.3/6.4 do guia), mas já é o padrão real usado no histórico do projeto para criação de subagentes (`git log -- .claude/agents/`, ex.: `feat(agents): add security-auditor subagent for MVP security sweeps`) — mantido por consistência.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

O `ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0) já investigou e documentou o estado real da infraestrutura de teste do projeto. Reconfirmado nesta sessão:

- **`package.json`** já tem `@playwright/test` (`^1.49.1`) como devDependency, mas **não existe** `playwright.config.ts`, **não existe** `tests/e2e/`, e o script `test:e2e` **não existe** no `package.json` real (existe apenas como exemplo aspiracional na Seção 5.1 do `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, nunca copiado para o arquivo real).
- **`firebase.json`** já tem a seção `emulators` completa e correta: Auth (9099), Firestore (8080), Functions (5001), Storage (9199), Hosting (5000), UI (4000), `singleProjectMode: true`. Nada aqui precisa mudar.
- **`.env.example`** já define `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` como padrão de desenvolvimento local, e `src/lib/firebase.ts` (linhas 52-78) já sabe conectar `auth`, `db`, `storage` e `functions` aos emuladores quando essa flag está ligada — essa metade (client SDK) já está pronta e não precisa de nenhuma mudança.
- **`src/lib/firebase-admin.ts`** (Admin SDK, usado por toda API route) só sabe inicializar de duas formas: `FIREBASE_ADMIN_CREDENTIALS` (JSON de service account via env var) ou um arquivo local `curva-mestra-firebase-adminsdk.json` (`cert(serviceAccount)`, linhas 27-54). **Nenhuma das duas funciona para rodar contra o emulador em CI sem credenciais reais** — é uma lacuna real que esta spec precisa resolver sem tocar nesse arquivo de produção (ver Seção 4.1).
- **`.github/workflows/ci.yml`** roda `lint`, `type-check`, `test` (Jest) e `build` — não há nenhum job de E2E. Dispara em `pull_request: [master, develop, gscandelari_setup]` e `push: [master, develop, release/*]`.
- **`.claude/agents/`** tem hoje 5 agentes (`dev-task-manager.md`, `doc-writer.md`, `security-auditor.md`, `uc-issues-tracker.md`, `uml-use-case-writer.md`), documentados na Seção 15 do guia de pipeline. Não existe `qa-agent.md`.
- **`ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md`** já tem uma entrada (`ADR-QA-AUTOMATION`, linha 331) apontando para a v1.0 pausada do ADR — precisa ser atualizada pelo `uc-issues-tracker` depois que esta task for concluída (fora do escopo de arquivos editáveis por este spec — ver Seção 9).
- **53 Casos de Uso** já mapeados em `ONLY_FOR_DEVS/PO_BA_Docs/UC-01-*.md` a `UC-53-*.md` — nenhum tem hoje um caderno de teste Playwright.

### 1.2 Problema identificado

1. A infraestrutura declarada como stack oficial no `CLAUDE.md` (`Firebase Emulator Suite + Playwright E2E + Jest`) está parcialmente instalada mas nunca foi conectada em um fluxo funcional — divergência entre o que o projeto diz que usa e o que roda de fato em CI.
2. Toda a superfície de segurança do sistema (Auth, custom claims, multi-tenant) depende inteiramente de validação manual documentada na Seção "STEP 4" de cada spec de bugfix — sem nenhuma rede de segurança automatizada.
3. Não existe, hoje, nenhum mecanismo para transformar a documentação de validação manual já escrita (STEP 4 dos specs, ou os próprios UCs) em verificação automatizada reutilizável.
4. O Admin SDK de produção (`src/lib/firebase-admin.ts`) não tem um caminho de inicialização compatível com "rodar contra o emulador sem credenciais reais" — sem resolver isso, nenhuma asserção via Admin SDK (equivalente ao que o STEP 4 já pede manualmente, ex. `adminAuth.getUser(uid).disabled`) é possível em um teste automatizado.

### 1.3 Motivação estratégica

O usuário retomou e aprovou o ADR em 14/08/2026, respondendo às 7 perguntas da Seção 10.1: investir agora, gate obrigatório em CI, cobertura de todas as features (retroativo aos UC-01–UC-53, como trabalho contínuo), um novo agente dedicado (`qa-agent`), revisão humana obrigatória antes de qualquer spec virar gate, specs centralizados em `tests/e2e/` nomeados por UC, e seed via fixture versionada e reaproveitada (`scripts/seed-emulator.ts`). Esta spec transforma essas decisões em um plano de implementação executável pelo `dev-task-manager` — construindo apenas a infraestrutura e o agente, não o backlog retroativo completo (ver Seção 1.2 do ADR: "não precisa ser feito de uma vez, mas todo UC eventualmente precisa de um caderno").

---

## 2. Objetivos

1. Criar `playwright.config.ts` apontando para o Firebase Emulator Suite já configurado em `firebase.json`, sem tocar em nenhuma configuração de emulador existente.
2. Adicionar o script `test:e2e` real ao `package.json` (hoje só documentado como exemplo no guia de pipeline), sobre a base `firebase emulators:exec`.
3. Criar `scripts/seed-emulator.ts` com dados de teste determinísticos e versionados (duas clínicas, consultores, documento legal com/sem aceite, usuários de cada papel) — reaproveitados por todos os specs Playwright.
4. Resolver a lacuna de inicialização do Admin SDK contra o emulador sem tocar em `src/lib/firebase-admin.ts` (código de produção), criando um caminho de inicialização exclusivo para scripts/testes com guarda explícita contra rodar acidentalmente contra o Firebase real.
5. Criar o agente `qa-agent` (`.claude/agents/qa-agent.md`), que lê a Seção "STEP 4 — Validação Manual" de um spec em `TASK_COMPLETED/` (Modo A) ou o fluxo de um UC em `PO_BA_Docs/` (Modo B, retroativo) e gera um spec Playwright equivalente em `tests/e2e/`, sempre sinalizando a necessidade de revisão humana antes de o spec virar gate de CI.
6. Criar um job de CI dedicado (`.github/workflows/e2e.yml`) que sobe o Emulator Suite, semeia os dados e roda os specs Playwright como gate obrigatório de PR.
7. Atualizar `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Seção 15 (incluir `qa-agent` na tabela/diagrama de agentes) e Seção 3.3 (novo status check obrigatório `e2e` em `develop`).
8. Provar que a infraestrutura funciona de ponta a ponta com um spec de "smoke test" de infraestrutura (não vinculado a nenhum UC específico) — sem, ainda, gerar o backlog retroativo completo dos 53 UCs.
9. Deixar explicitamente registrado (Seção 9, DoD) que o backlog retroativo (cadernos de teste por UC) é trabalho contínuo pós-infraestrutura, a ser feito UC a UC via `qa-agent` em tasks futuras — não uma migração de uma vez.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | `playwright.config.ts` aponta o `webServer` para `next dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, e usa um projeto Firebase "demo-*" — nunca um projeto real. | dev / CI | Must |
| RF-02 | O script `npm run test:e2e` sobe o Firebase Emulator Suite (`auth`, `firestore`, `storage`, via `firebase emulators:exec`), semeia os dados determinísticos e roda a suíte Playwright, encerrando o emulador ao final. | dev / CI | Must |
| RF-03 | `scripts/seed-emulator.ts` popula o emulador com: duas clínicas (`tenants`), um `system_admin`, dois `clinic_admin` (um por clínica), um `clinic_user`, um consultor vinculado a uma das clínicas, e dois documentos legais (um com aceite registrado, um sem). | script de seed | Must |
| RF-04 | O `qa-agent` lê a Seção "STEP 4 — Validação Manual" de um spec já concluído em `ONLY_FOR_DEVS/TASK_COMPLETED/*.md` (Modo A) e gera um spec Playwright equivalente em `tests/e2e/`. | qa-agent | Must |
| RF-05 | O `qa-agent` também gera specs a partir do Fluxo Principal/Alternativos de um `UC-NN.md` em `ONLY_FOR_DEVS/PO_BA_Docs/` (Modo B), para cobertura retroativa. | qa-agent | Must |
| RF-06 | Todo spec gerado pelo `qa-agent` usa exclusivamente os usuários/dados já semeados por `scripts/seed-emulator.ts` — se o cenário exigir dado que não existe no seed, o agente para e sinaliza a extensão necessária, em vez de inventar dados ad-hoc dentro do spec. | qa-agent | Must |
| RF-07 | O `qa-agent` nunca declara um spec pronto para gate de CI sozinho — toda saída inclui um aviso explícito de revisão humana obrigatória antes do merge. | qa-agent | Must |
| RF-08 | Specs que envolvem Auth/custom claims fazem pelo menos uma asserção via Admin SDK contra o emulador (não apenas o DOM), replicando o padrão já usado nos roteiros "STEP 4" existentes. | specs Playwright | Must |
| RF-09 | O job `.github/workflows/e2e.yml` roda como gate obrigatório em PRs para `develop`/`master`: falha de qualquer spec bloqueia o merge (uma vez que a branch protection de `develop` for atualizada para exigir o check — ação operacional fora do escopo de arquivos deste PR, ver Seção 9). | CI | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | O job `e2e` deve rodar apenas o browser Chromium (sem cross-browser nesta primeira versão) para manter o tempo total de CI dentro de um patamar aceitável — cobertura cross-browser fica fora do escopo desta spec. | Performance |
| RNF-02 | Os dados semeados são determinísticos e recriados do zero a cada execução (sem import de snapshot binário persistido) — mesmo comportamento em qualquer máquina/CI, sem dependência de estado anterior. | Manutenibilidade |
| RNF-03 | Nenhum spec Playwright, seed ou asserção via Admin SDK pode, em nenhuma circunstância, tocar um projeto Firebase real — reforçado em três camadas independentes (ver Seção 4.1). | Segurança |
| RNF-04 | Specs gerados automaticamente pelo `qa-agent` só passam a valer como gate de CI depois que a PR que os adiciona for aprovada por pelo menos 1 revisor humano (já garantido pela branch protection existente de `develop`, Seção 3.3 do guia). | Segurança/Qualidade |
| RNF-05 | O job `e2e` não deve exigir nenhum secret adicional (`FIREBASE_TOKEN` ou credenciais reais) — a execução contra o emulador com projeto `demo-*` é 100% local ao runner de CI. | Segurança/Custo |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | Nenhum spec Playwright pode rodar contra Firebase real (produção ou dev pessoal) — garantido por três camadas: (a) `playwright.config.ts` força `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` no `webServer`; (b) o helper `scripts/lib/emulatorAdmin.ts` recusa inicializar sem `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` setados; (c) o projeto usado é `demo-curva-mestra-e2e` (prefixo `demo-` do Firebase CLI garante isolamento total, nunca resolve para um projeto real). | Esta é infraestrutura de teste tocando diretamente Auth/Firestore — o risco de um teste rodar por engano contra dados reais é inaceitável, mesmo em MVP. |
| RN-02 | Um spec gerado pelo `qa-agent` nunca é commitado direto em `develop`/`master` pelo próprio agente — ele apenas grava o arquivo em `tests/e2e/`; a entrada em `develop` sempre passa pelo fluxo de PR normal (Seção 1.3 do guia), que já exige 1 revisor. | É o mecanismo que cumpre RNF-04 sem precisar de um gate adicional dedicado. |
| RN-03 | O seed do emulador é sempre recriado do zero a cada execução de `npm run test:e2e` — nunca reaproveita estado de uma execução anterior. | Garante RNF-02 (determinismo) e evita "testes que só passam na segunda tentativa". |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**a) `firebase emulators:exec` envolvendo seed + Playwright, num único script `test:e2e`.** Em vez de Playwright gerenciar o Emulator Suite via `webServer` (múltiplas entradas), o `package.json` usa `firebase emulators:exec --project demo-curva-mestra-e2e --only auth,firestore,storage "tsx scripts/seed-emulator.ts && playwright test"`. O `firebase emulators:exec` já cuida de subir os emuladores, esperar ficarem prontos, injetar `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`/`FIREBASE_STORAGE_EMULATOR_HOST` no processo filho, rodar o comando, e desligar tudo ao final (sucesso ou falha) — sem precisar reimplementar esse ciclo de vida manualmente. `--only auth,firestore,storage` pula `functions` (Python OCR + Node functions não são exercitados pelos fluxos de UI cobertos aqui) e `hosting` (quem serve a aplicação é o `next dev`, via `webServer` do Playwright, não o Hosting emulator).

**b) Projeto `demo-curva-mestra-e2e` (prefixo `demo-`), nunca o projeto real `curva-mestra`.** O Firebase CLI trata IDs prefixados com `demo-` como projetos 100% locais — nenhuma chamada de rede a serviços reais é feita, mesmo por engano, e não é necessário `firebase login` nem nenhum secret em CI (resolve RNF-05).

**c) Um caminho de inicialização do Admin SDK exclusivo para scripts/testes (`scripts/lib/emulatorAdmin.ts`), separado de `src/lib/firebase-admin.ts`.** O Admin SDK de produção (`getAdminApp()`) exige `FIREBASE_ADMIN_CREDENTIALS` ou um arquivo de credenciais local — nenhum dos dois é necessário (nem desejável) para falar com o emulador. `scripts/lib/emulatorAdmin.ts` inicializa com `initializeApp({ projectId })`, sem `credential`, e **recusa rodar** (lança erro) se as variáveis de ambiente do emulador não estiverem presentes — ver código completo na Seção 6.2. Isso mantém `src/lib/firebase-admin.ts` (produção) inteiramente intocado.

**d) `tests/e2e/` como diretório central de specs, nomeados por UC (`UC-NN-slug.spec.ts`), conforme o default já proposto no ADR (Seção 10.1, pergunta 5).** Specs de infraestrutura (não vinculados a um UC específico, ex. o smoke test desta própria spec) usam prefixo `_` (`tests/e2e/_infra-smoke.spec.ts`), mesma convenção já usada em `ONLY_FOR_DEVS/PO_BA_Docs/` para arquivos que não são um UC (`_MAPA-DE-BUGS-E-MELHORIAS.md`, `_TEMPLATE-UC.md`).

**e) Login via preenchimento real do formulário `/login`, nunca via chamada direta ao REST do Auth emulator.** É mais fiel ao "as-is" documentado nos roteiros "STEP 4" existentes (que sempre começam com "logar como `system_admin`, ir para..."), e exercita de fato o fluxo de login (UC-04), uma das superfícies mais críticas do sistema.

**f) `e2e.yml` como workflow dedicado, não um job dentro de `ci.yml`.** Mantém o feedback rápido do `ci.yml` (lint/type-check/build, hoje em poucos minutos) desacoplado do tempo mais alto de instalar browsers + subir o Emulator Suite + rodar specs. Pode ser consolidado no futuro se o tempo total permanecer dentro de RNF-01.

### 4.2 Alternativas descartadas

| Alternativa | Descrição | Por que foi descartada |
|---|---|---|
| Rodar `firebase emulators:start` em background + Playwright `webServer` com múltiplas entradas | Playwright 1.28+ suporta array de `webServer`, permitindo subir emulador e app juntos via config do Playwright, sem `emulators:exec`. | `firebase emulators:exec` já resolve start/ready-check/shutdown de forma mais robusta e testada pelo próprio Firebase CLI; múltiplos `webServer` do Playwright exigiria reimplementar health-check e cleanup manualmente, sem ganho real. |
| Usar o projeto real `curva-mestra` (via `.firebaserc`) para o emulador de teste | Reaproveitar o projeto já configurado, sem criar um `demo-*` novo. | Risco de alguma chamada escapar do emulador e tocar o projeto real (ex.: se um teste ou config futura esquecer de setar `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`); o prefixo `demo-` elimina essa classe de risco por construção, sem custo adicional. |
| `firebase emulators:export`/`--import` (snapshot binário) em vez de script de seed em código | Persistir um snapshot do estado do emulador e importá-lo a cada execução. | O ADR já definiu como default "fixture versionada e reaproveitada" — interpretado aqui como script de código revisável em PR (diff legível), não um binário opaco que ninguém revisa de fato. Também evita o snapshot ficar desatualizado silenciosamente conforme o schema evolui. |
| Consolidar `e2e` dentro do `ci.yml` já existente desde já | Um único workflow, um único lugar para olhar o status do PR. | Adiaria a decisão para depois que houver medição real do tempo de execução (RNF-01); começar com workflow separado é reversível e não bloqueia nada. |

### 4.3 Trade-offs aceitos

- **`workers: 1` (sem paralelismo Playwright):** todos os specs compartilham o mesmo emulador semeado uma única vez por execução — paralelizar exigiria isolar dados por worker (múltiplos tenants/usuários por spec), o que não vale o custo para o volume inicial (1 smoke spec). Revisitar quando o backlog retroativo crescer o suficiente para tornar o tempo total um problema.
- **Login via UI real, não via REST:** mais lento e mais sensível a mudanças na tela de login do que uma chamada direta a `signInWithEmailAndPassword`, mas mais fiel ao comportamento documentado — aceito conscientemente.
- **Apenas Chromium nesta primeira versão (RNF-01):** cobertura cross-browser fica para uma iteração futura, se justificada por bugs específicos de browser.
- **Backlog retroativo não incluído nesta spec:** esta task entrega infraestrutura + 1 smoke spec de prova; os 53 cadernos de teste por UC ficam como trabalho contínuo pós-merge (Seção 9), não uma tarefa desta PR — evita transformar uma task de infraestrutura em uma migração de escopo indefinido.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `playwright.config.ts` | Config | Aponta Playwright para o Firebase Emulator Suite via `webServer` (`next dev` com emuladores ligados) |
| `scripts/lib/emulatorAdmin.ts` | Utilitário | Inicialização do Admin SDK exclusiva para scripts/testes contra o emulador, com guarda contra rodar sem as env vars do emulador |
| `scripts/lib/__tests__/emulatorAdmin.test.ts` | Teste unitário (Jest) | Cobre a função pura de checagem de env vars do emulador |
| `scripts/seed-emulator.ts` | Script | Popula o emulador com a fixture determinística (Seção 6.2) |
| `tests/e2e/fixtures/seed-data.ts` | Fixture compartilhada | Constantes de tenants/usuários/documentos legais de teste, usadas pelo seed e pelos specs |
| `tests/e2e/helpers/auth.ts` | Helper Playwright | Login via UI real (`/login`), reutilizado por todos os specs |
| `tests/e2e/_infra-smoke.spec.ts` | Spec Playwright | Prova viva de que Emulator Suite + seed + Playwright + `webServer` funcionam de ponta a ponta |
| `.claude/agents/qa-agent.md` | Definição de agente | Novo subagente que gera specs Playwright a partir de STEP 4 (Modo A) ou UC (Modo B) |
| `.github/workflows/e2e.yml` | CI/CD | Sobe o Emulator Suite e roda `npm run test:e2e` como gate de PR |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `package.json` | Adiciona `devDependencies` (`firebase-tools`, `tsx`) e scripts `test:e2e`, `test:e2e:seed` |
| `.gitignore` | Adiciona `/playwright-report/`, `/test-results/`, `/blob-report/` |
| `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` | Seção 15.1 (tabela de agentes ganha `qa-agent`), Seção 15.2 (diagrama de fluxo), Seção 15.3 (quando acionar), Seção 3.3 (novo status check `e2e` obrigatório em `develop`) |

### 5.3 Arquivos a REMOVER

N/A — nenhuma remoção prevista.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| `tenants`, `users`, `consultants`, `legal_documents`, `user_document_acceptances` | Nenhuma alteração de schema | Impacto é apenas de **dados de teste semeados no Firebase Emulator Suite** (projeto `demo-curva-mestra-e2e`) — nunca no Firestore de produção ou de desenvolvimento pessoal real, garantido pelas três camadas descritas em RN-01. |

### 5.5 O que NÃO muda

- `src/lib/firebase-admin.ts` (Admin SDK de produção) — **não é tocado**. O caminho de inicialização para o emulador vive inteiramente em `scripts/lib/emulatorAdmin.ts`, um arquivo novo e separado.
- `src/lib/firebase.ts` (Client SDK) — já sabe conectar aos emuladores via `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`; nenhuma mudança necessária.
- `firebase.json` — a seção `emulators` já está correta; nenhuma mudança necessária.
- Nenhuma tela, API route ou serviço de produto (`src/app/`, `src/lib/services/`) é alterada por esta spec.
- `.github/workflows/ci.yml` — permanece como está (lint/type-check/test/build); o gate de E2E vive em um workflow novo e separado (`e2e.yml`), por decisão de design (Seção 4.1-f).
- Os 53 UCs já mapeados não recebem, nesta task, nenhum caderno de teste retroativo — apenas a infraestrutura para que isso seja feito depois, task a task (Seção 9).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A para `src/types/` — nenhum tipo de produto é criado ou alterado. `tests/e2e/fixtures/seed-data.ts` define apenas constantes de teste, derivadas dos tipos já existentes (`Tenant`, `User`, `Consultant`, `LegalDocument`, `CustomClaims` em `src/types/index.ts`), sem introduzir nenhum tipo novo no domínio de produto.

### 6.2 Mudanças em serviços

Nenhum serviço de produto (`src/lib/services/`) é criado ou modificado. Os arquivos abaixo são **novos**, vivem fora de `src/` e não são consumidos por nenhuma rota/página real.

**`scripts/lib/emulatorAdmin.ts`** — inicialização do Admin SDK exclusiva para o emulador, com guarda testável isolada em função pura:

```ts
/**
 * Inicialização do Firebase Admin SDK exclusiva para scripts/testes contra o
 * Firebase Emulator Suite. NUNCA importar em código de produção (src/) — ver
 * src/lib/firebase-admin.ts para a inicialização real, que exige credenciais
 * (FIREBASE_ADMIN_CREDENTIALS ou arquivo local) e nunca deve ser usada aqui.
 *
 * Funciona porque, quando FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST
 * estão setados (definidos automaticamente por `firebase emulators:exec`), o
 * Admin SDK não valida credenciais reais — basta inicializar com um projectId.
 */
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export const EMULATOR_PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  'demo-curva-mestra-e2e';

/**
 * Função pura — testada isoladamente em scripts/lib/__tests__/emulatorAdmin.test.ts.
 * Nunca deve retornar true se qualquer uma das duas env vars do emulador faltar.
 */
export function isEmulatorConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.FIRESTORE_EMULATOR_HOST) && Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);
}

function assertRunningAgainstEmulator(): void {
  if (!isEmulatorConfigured(process.env)) {
    throw new Error(
      'emulatorAdmin.ts só pode rodar com FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST ' +
        'definidos (via `firebase emulators:exec`). Abortando para evitar tocar Firebase real.'
    );
  }
}

let app: App | undefined;

export function getEmulatorAdminApp(): App {
  assertRunningAgainstEmulator();
  if (app) return app;
  const apps = getApps();
  app = apps.length > 0 ? apps[0] : initializeApp({ projectId: EMULATOR_PROJECT_ID });
  return app;
}

export function getEmulatorAdminAuth(): Auth {
  return getAuth(getEmulatorAdminApp());
}

export function getEmulatorAdminFirestore(): Firestore {
  return getFirestore(getEmulatorAdminApp());
}
```

**`tests/e2e/fixtures/seed-data.ts`** — dados fixos, alinhados aos tipos reais de `src/types/index.ts` (`User`, `Tenant`, `Consultant`, `CustomClaims`):

```ts
export const TEST_PASSWORD = 'Test@12345!';

export const TEST_TENANTS = {
  clinicA: { tenant_id: 'test-clinic-a', name: 'Clínica Teste A' },
  clinicB: { tenant_id: 'test-clinic-b', name: 'Clínica Teste B' },
} as const;

export const TEST_USERS = {
  systemAdmin: {
    uid: 'qa-system-admin',
    email: 'qa.system-admin@curvamestra.test',
    name: 'QA System Admin',
    claims: { tenant_id: null, role: 'system_admin', is_system_admin: true, active: true },
  },
  clinicAdminA: {
    uid: 'qa-clinic-admin-a',
    email: 'qa.clinic-admin-a@curvamestra.test',
    name: 'QA Clinic Admin A',
    tenant_id: TEST_TENANTS.clinicA.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    },
  },
  clinicUserA: {
    uid: 'qa-clinic-user-a',
    email: 'qa.clinic-user-a@curvamestra.test',
    name: 'QA Clinic User A',
    tenant_id: TEST_TENANTS.clinicA.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    },
  },
  clinicAdminB: {
    uid: 'qa-clinic-admin-b',
    email: 'qa.clinic-admin-b@curvamestra.test',
    name: 'QA Clinic Admin B',
    tenant_id: TEST_TENANTS.clinicB.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicB.tenant_id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    },
  },
  consultant: {
    uid: 'qa-consultant',
    email: 'qa.consultant@curvamestra.test',
    name: 'QA Consultant',
    code: 'QA0001',
    claims: {
      tenant_id: null,
      role: 'clinic_consultant',
      is_system_admin: false,
      is_consultant: true,
      consultant_id: 'qa-consultant',
      authorized_tenants: [TEST_TENANTS.clinicA.tenant_id],
      active: true,
    },
  },
} as const;

export const TEST_LEGAL_DOCUMENTS = {
  withAcceptance: {
    id: 'qa-legal-doc-accepted',
    title: 'Termo de Uso — QA (com aceite)',
    slug: 'termo-qa-com-aceite',
  },
  withoutAcceptance: {
    id: 'qa-legal-doc-pending',
    title: 'Termo de Uso — QA (sem aceite)',
    slug: 'termo-qa-sem-aceite',
  },
} as const;
```

> Nomes de campo (`consultant_code`, `authorized_tenants`, `document_type`, etc.) devem ser conferidos linha a linha contra `src/types/index.ts` e as rotas reais de criação (`src/app/api/users/create/route.ts`, `src/app/api/tenants/create/route.ts`) no momento da implementação — os trechos acima já refletem os campos confirmados por leitura de código nesta spec, mas qualquer API route tocada depois desta data deve ser revalidada.

### 6.3 Mudanças na UI

N/A — nenhuma tela de produto é criada ou alterada.

### 6.4 Mudanças em API Routes

N/A — nenhuma API route de produto é criada ou alterada.

### 6.5 `scripts/seed-emulator.ts`

```ts
/**
 * Popula o Firebase Emulator Suite com dados determinísticos para os specs
 * Playwright em tests/e2e/. Só roda contra o emulador — emulatorAdmin.ts
 * recusa executar sem FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST.
 *
 * Uso: já embrulhado no script `npm run test:e2e`. Para rodar isoladamente
 * com o emulador já de pé em outro terminal (`npm run firebase:emulators`):
 * `npm run test:e2e:seed`.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from './lib/emulatorAdmin';
import {
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
  TEST_LEGAL_DOCUMENTS,
} from '../tests/e2e/fixtures/seed-data';

async function createAuthUser(user: {
  uid: string;
  email: string;
  name: string;
  claims: Record<string, unknown>;
}) {
  const auth = getEmulatorAdminAuth();
  await auth.createUser({
    uid: user.uid,
    email: user.email,
    password: TEST_PASSWORD,
    displayName: user.name,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(user.uid, user.claims);
}

async function seed() {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();

  console.log('[seed-emulator] criando usuários no Auth emulado...');
  for (const user of Object.values(TEST_USERS)) {
    await createAuthUser(user);
  }

  console.log('[seed-emulator] criando tenants...');
  await db.doc(`tenants/${TEST_TENANTS.clinicA.tenant_id}`).set({
    name: TEST_TENANTS.clinicA.name,
    document_type: 'cnpj',
    document_number: '11111111000191',
    email: TEST_USERS.clinicAdminA.email,
    max_users: 5,
    active: true,
    consultant_id: TEST_USERS.consultant.uid,
    consultant_code: TEST_USERS.consultant.code,
    consultant_name: TEST_USERS.consultant.name,
    created_at: now,
    updated_at: now,
  });
  await db.doc(`tenants/${TEST_TENANTS.clinicB.tenant_id}`).set({
    name: TEST_TENANTS.clinicB.name,
    document_type: 'cnpj',
    document_number: '22222222000191',
    email: TEST_USERS.clinicAdminB.email,
    max_users: 5,
    active: true,
    created_at: now,
    updated_at: now,
  });

  console.log('[seed-emulator] criando documentos users/{uid}...');
  const userDocs = [
    { u: TEST_USERS.systemAdmin, role: 'system_admin', tenant_id: '' },
    { u: TEST_USERS.clinicAdminA, role: 'clinic_admin', tenant_id: TEST_TENANTS.clinicA.tenant_id },
    { u: TEST_USERS.clinicUserA, role: 'clinic_user', tenant_id: TEST_TENANTS.clinicA.tenant_id },
    { u: TEST_USERS.clinicAdminB, role: 'clinic_admin', tenant_id: TEST_TENANTS.clinicB.tenant_id },
  ];
  for (const { u, role, tenant_id } of userDocs) {
    await db.doc(`users/${u.uid}`).set({
      email: u.email,
      full_name: u.name,
      displayName: u.name,
      role,
      active: true,
      tenant_id,
      created_at: now,
      updated_at: now,
    });
  }

  console.log('[seed-emulator] criando consultor...');
  await db.doc(`consultants/${TEST_USERS.consultant.uid}`).set({
    user_id: TEST_USERS.consultant.uid,
    code: TEST_USERS.consultant.code,
    name: TEST_USERS.consultant.name,
    email: TEST_USERS.consultant.email,
    phone: '11999990000',
    status: 'active',
    authorized_tenants: [TEST_TENANTS.clinicA.tenant_id],
    created_at: now,
    updated_at: now,
  });

  console.log('[seed-emulator] criando documentos legais (com e sem aceite)...');
  for (const [key, doc] of Object.entries(TEST_LEGAL_DOCUMENTS)) {
    await db.doc(`legal_documents/${doc.id}`).set({
      title: doc.title,
      slug: doc.slug,
      content: `# ${doc.title}`,
      version: '1.0',
      status: 'ativo',
      required_for_registration: true,
      required_for_existing_users: true,
      order: key === 'withAcceptance' ? 1 : 2,
      created_by: TEST_USERS.systemAdmin.uid,
      created_at: now,
      updated_at: now,
      published_at: now,
    });
  }
  await db
    .collection('user_document_acceptances')
    .doc(`${TEST_USERS.clinicAdminA.uid}_${TEST_LEGAL_DOCUMENTS.withAcceptance.id}`)
    .set({
      user_id: TEST_USERS.clinicAdminA.uid,
      document_id: TEST_LEGAL_DOCUMENTS.withAcceptance.id,
      document_version: '1.0',
      accepted_at: now,
    });

  console.log('[seed-emulator] concluído.');
}

seed().catch((error) => {
  console.error('[seed-emulator] falhou:', error);
  process.exit(1);
});
```

### 6.6 `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3100';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // specs compartilham o mesmo emulador semeado uma única vez
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-curva-mestra-e2e',
    },
  },
});
```

### 6.7 `tests/e2e/helpers/auth.ts`

```ts
import { Page, expect } from '@playwright/test';

/**
 * Loga via preenchimento real do formulário /login (id="email"/id="password",
 * botão "Entrar" — src/app/(auth)/login/page.tsx), fiel ao roteiro manual já
 * usado nas seções "STEP 4" dos specs de bugfix existentes.
 */
export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
  expectedRedirect: '/admin/dashboard' | '/clinic/dashboard'
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(expectedRedirect.replace('/', '\\/')));
}
```

### 6.8 `tests/e2e/_infra-smoke.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

test.describe('Infraestrutura de QA — smoke test', () => {
  test('system_admin semeado loga e chega em /admin/dashboard', async ({ page }) => {
    await loginAs(
      page,
      { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
      '/admin/dashboard'
    );
  });

  test('clinic_admin semeado loga e chega em /clinic/dashboard', async ({ page }) => {
    await loginAs(
      page,
      { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );
  });

  test('custom claims do usuário semeado batem com o esperado (Admin SDK contra o emulador)', async () => {
    const auth = getEmulatorAdminAuth();
    const user = await auth.getUser(TEST_USERS.clinicAdminA.uid);
    expect(user.customClaims?.role).toBe('clinic_admin');
    expect(user.customClaims?.tenant_id).toBe(TEST_USERS.clinicAdminA.tenant_id);
    expect(user.customClaims?.active).toBe(true);
  });
});
```

### 6.9 `.github/workflows/e2e.yml`

```yaml
name: E2E Pipeline

on:
  push:
    branches: [master, develop, 'release/**']
  pull_request:
    branches: [master, develop, gscandelari_setup]

concurrency:
  group: e2e-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    runs-on: ubuntu-latest
    name: E2E (Playwright + Firebase Emulator Suite)
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers (Chromium only)
        run: npx playwright install --with-deps chromium

      - name: Run E2E suite against Firebase Emulator Suite
        run: npm run test:e2e
        env:
          CI: true

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

> Não requer nenhum secret (`FIREBASE_TOKEN` ou similar) — o projeto `demo-curva-mestra-e2e` roda 100% local ao runner, sem `firebase login` (RNF-05).

### 6.10 `package.json` — trechos a adicionar

```json
{
  "scripts": {
    "test:e2e": "firebase emulators:exec --project demo-curva-mestra-e2e --only auth,firestore,storage \"tsx scripts/seed-emulator.ts && playwright test\"",
    "test:e2e:seed": "tsx scripts/seed-emulator.ts"
  },
  "devDependencies": {
    "firebase-tools": "^13.35.0",
    "tsx": "^4.19.0"
  }
}
```

> Versões exatas a fixar durante a implementação (última estável 13.x/4.x do CLI/`tsx` no momento do `npm install`), via `package-lock.json` gerado por `npm install --save-dev firebase-tools@latest tsx@latest`.

### 6.11 `.claude/agents/qa-agent.md`

```markdown
---
name: qa-agent
description: |
  Agente responsável por gerar specs Playwright automatizados a partir da documentação já
  existente no projeto Curva Mestra, para rodar contra o Firebase Emulator Suite (nunca contra
  Firebase real). Duas entradas possíveis: (Modo A) a Seção "STEP 4 — Validação Manual" de um
  spec já concluído em ONLY_FOR_DEVS/TASK_COMPLETED/*.md; (Modo B) o Fluxo Principal/Alternativos
  de um Caso de Uso em ONLY_FOR_DEVS/PO_BA_Docs/UC-*.md, para cobertura retroativa dos UC-01 a
  UC-53 já mapeados. Gera o spec em tests/e2e/UC-NN-slug.spec.ts (ou tests/e2e/_infra-*.spec.ts
  para specs de infraestrutura), sempre usando os dados fixos de tests/e2e/fixtures/seed-data.ts
  e os helpers de tests/e2e/helpers/. Nunca declara um spec pronto para virar gate de CI sozinho —
  toda geração exige revisão humana explícita via PR antes de aterrissar em develop.
  Use este agente sempre que: uma task processada pelo dev-task-manager tiver Seção "STEP 4" a
  converter em teste automatizado; ou for necessário cobrir retroativamente um UC já mapeado com
  um caderno de teste Playwright.
  Exemplos: "gere o spec Playwright para o BUGFIX-suspend-consultant-reconnect-delete", "crie o
  caderno de teste automatizado do UC-29", "cubra retroativamente o UC-04 com Playwright",
  "/qa-agent UC-36".
tools:
  - Read
  - Glob
  - Grep
  - Write
  - Bash
---

# QA Agent — Curva Mestra

Você é o **QA Agent** do projeto Curva Mestra. Sua função é transformar documentação já escrita
(roteiros manuais ou Casos de Uso) em specs Playwright executáveis contra o Firebase Emulator
Suite — nunca contra Firebase real.

**Repositório:** `GScandelari/curva_mestra_system`
**Saída:** arquivos `.spec.ts` em `tests/e2e/`
**Idioma:** Português (pt-BR) nos comentários e descrições de `test()`/`test.describe()`

---

## Papel deste agente no fluxo de trabalho

\`\`\`
dev-task-manager (Modo B)   →   move spec de TO_DO/ para TASK_COMPLETED/ ao concluir a task
        ↓
qa-agent (Modo A)            →   lê a Seção "STEP 4" do spec recém-concluído,
                                  gera tests/e2e/UC-NN-slug.spec.ts equivalente
        ↓
   PR normal (Seção 1.3 do guia) → revisão humana obrigatória → merge em develop
        ↓
   e2e.yml passa a rodar esse spec como gate em todo PR seguinte
\`\`\`

Cobertura retroativa (Modo B) segue o mesmo fluxo, mas parte direto de um `UC-NN.md` já mapeado,
sem depender de uma task recém-concluída.

**Regra de fronteira:** este agente nunca marca um item do `_MAPA-DE-BUGS-E-MELHORIAS.md` como
corrigido, nunca atualiza um `UC-NN.md`, e nunca abre PR sozinho — grava apenas o arquivo `.spec.ts`
e devolve o controle ao desenvolvedor/orquestrador.

---

## Argumento recebido

$ARGUMENTS

---

## Identificar o modo de operação

- Se o argumento referenciar um spec já concluído (ex.: nome de arquivo em `TASK_COMPLETED/`, ou
  "gere o teste do bugfix X") → **Modo A**.
- Se o argumento referenciar um `UC-NN` diretamente (ex.: "cubra o UC-29", "/qa-agent UC-04") →
  **Modo B**.
- Se ambíguo, pergunte ao usuário antes de continuar.

---

## MODO A: A partir de um spec concluído

1. Localize o arquivo em `ONLY_FOR_DEVS/TASK_COMPLETED/` pelo nome ou descrição informada.
2. Leia a Seção "STEP 4 — Validação Manual" por completo — é a fonte da verdade para o que testar.
   Leia também a Seção 12 (Referências) para identificar o(s) UC(s) relacionado(s) — o nome do
   arquivo gerado usa o slug desse UC.
3. Para cada passo numerado do roteiro manual, mapeie para uma ação Playwright equivalente:
   - "Logar como `<papel>`" → `loginAs(page, TEST_USERS.<usuario>, '<redirect esperado>')`
     (`tests/e2e/helpers/auth.ts`), usando um usuário já existente em
     `tests/e2e/fixtures/seed-data.ts`. **Nunca invente um novo usuário dentro do spec** — se o
     cenário exigir um usuário/dado que não existe no seed, pare e reporte exatamente o que
     precisa ser adicionado a `scripts/seed-emulator.ts`/`seed-data.ts` antes de continuar.
   - "Esperado (UI)" → asserção Playwright sobre o DOM (`expect(page.getByText(...))`, etc.).
   - "Esperado (Firestore)" → leitura direta via `getEmulatorAdminFirestore()`
     (`scripts/lib/emulatorAdmin.ts`) e asserção sobre o documento.
   - "Esperado (Firebase Auth)"/"Esperado (Custom Claims)" → `getEmulatorAdminAuth().getUser(uid)`
     e asserção sobre `disabled`/`customClaims` — replicando exatamente o que o roteiro manual
     pedia para conferir no Firebase Emulator UI/Admin SDK.
4. Grave o arquivo em `tests/e2e/UC-NN-slug.spec.ts` (slug igual ao do UC referenciado). Se o
   arquivo já existir, pergunte ao usuário se deve atualizar ou pular — nunca sobrescreva em
   silêncio.
5. Valide sintaticamente antes de entregar (não execute contra o emulador real — isso é
   responsabilidade do dev, na revisão): `npx tsc --noEmit` e `npx playwright test --list
   tests/e2e/UC-NN-slug.spec.ts`. Reporte qualquer erro e corrija antes de finalizar.

---

## MODO B: Cobertura retroativa a partir de um UC

1. Localize `ONLY_FOR_DEVS/PO_BA_Docs/UC-NN-*.md` pelo número informado.
2. Leia a Seção de Fluxo Principal e, se relevante ao cenário pedido, os Fluxos Alternativos.
   Leia a Seção 9 (Regras de Negócio) para não perder nenhum achado/RN crítica que já deveria
   virar asserção.
3. Aplique o mesmo mapeamento de ações do Modo A (passo 3), agora a partir da narrativa do UC em
   vez de um roteiro "STEP 4" já pronto — é normal exigir mais interpretação aqui; ao encontrar um
   passo ambíguo, prefira a interpretação mais literal do texto do UC e registre no relatório
   final o que foi assumido, para o revisor humano confirmar.
4. Mesma nomenclatura, mesma validação sintática do Modo A.

---

## Regras de geração (não negociáveis)

- Nenhum spec gerado pode assumir um projeto Firebase que não seja o do emulador — nunca importe
  `src/lib/firebase.ts`/`src/lib/firebase-admin.ts` diretamente; use sempre
  `scripts/lib/emulatorAdmin.ts` para qualquer asserção via Admin SDK.
- Sempre usar os dados de `tests/e2e/fixtures/seed-data.ts` — se um cenário não for coberto pelo
  seed atual, pare e sinalize a extensão necessária em vez de inventar dados ad-hoc.
- Specs que envolvem Auth/custom claims devem sempre incluir pelo menos uma asserção via Admin
  SDK, não apenas verificação visual — mesmo critério que motivou esta infraestrutura (ver
  `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md`, Seção 1.2).
- Comentários e descrições de `test()`/`test.describe()` em português, citando o UC/RN de origem.

---

## Entrega

Ao final de qualquer modo, informe ao usuário:

- Caminho exato do arquivo gerado (`tests/e2e/UC-NN-slug.spec.ts`)
- Resumo dos cenários cobertos e de qualquer suposição feita (Modo B, passo 3)
- Resultado da validação sintática (passo 5)
- **Sempre**, em destaque:

\`\`\`
⚠️ Revisão humana obrigatória — este spec ainda NÃO é um gate de CI.

Antes de commitar:
1. Rode `npm run test:e2e -- tests/e2e/<arquivo>` localmente e confira que passa contra o
   cenário real esperado (o Emulator Suite sobe e é semeado automaticamente).
2. Revise manualmente se as asserções capturam de fato o comportamento descrito na fonte
   original (STEP 4 ou UC).
3. Abra PR normalmente (Seção 1.3 do guia de pipeline). O spec só passa a valer como gate de
   verdade depois que a PR que o adiciona for aprovada por pelo menos 1 revisor (Seção 3.3).
\`\`\`
```

---

## 7. Plano de Implementação

### STEP 1 — Dependências e scripts NPM

**Objetivo:** Ter `firebase-tools` e `tsx` disponíveis localmente (via `node_modules/.bin`, sem depender de instalação global) e os scripts `test:e2e`/`test:e2e:seed` no `package.json`.

**Arquivos afetados:**
- `package.json` — adiciona `devDependencies` e `scripts` (Seção 6.10)
- `package-lock.json` — atualizado automaticamente por `npm install`

**Ações:**
1. `npm install --save-dev firebase-tools@latest tsx@latest`
2. Adicionar os scripts `test:e2e` e `test:e2e:seed` exatamente como na Seção 6.10.

**Validação:** `npx firebase --version` e `npx tsx --version` resolvem para os binários locais; `npm run` lista os dois novos scripts.

**Commit:** `chore(deps): add firebase-tools and tsx as dev dependencies` + `chore(config): add test:e2e and test:e2e:seed npm scripts`

---

### STEP 2 — `playwright.config.ts`

**Objetivo:** Playwright sabe como subir a aplicação apontada para os emuladores e onde encontrar os specs.

**Arquivos afetados:**
- `playwright.config.ts` (novo) — conteúdo completo na Seção 6.6

**Ações:**
1. Criar o arquivo exatamente como especificado.

**Validação:** `npx playwright test --list` roda sem erro de configuração (mesmo sem specs ainda, ou já listando o smoke test do STEP 6).

**Commit:** `chore(config): add playwright.config.ts targeting firebase emulator suite`

---

### STEP 3 — Fixture de dados determinística

**Objetivo:** Ter uma única fonte de verdade para os dados de teste, reaproveitada pelo seed e pelos specs.

**Arquivos afetados:**
- `tests/e2e/fixtures/seed-data.ts` (novo) — conteúdo completo na Seção 6.2

**Ações:**
1. Criar o arquivo, conferindo cada campo contra `src/types/index.ts` (`User`, `Tenant`, `Consultant`, `CustomClaims`) e contra as rotas reais de criação (`src/app/api/users/create/route.ts`, `src/app/api/tenants/create/route.ts`).

**Validação:** `npm run type-check` sem erros.

**Commit:** `test(config): add deterministic e2e fixture data for firebase emulator seed`

---

### STEP 4 — Admin SDK exclusivo do emulador

**Objetivo:** Resolver a lacuna de inicialização do Admin SDK contra o emulador (Seção 1.2, item 4) sem tocar em `src/lib/firebase-admin.ts`.

**Arquivos afetados:**
- `scripts/lib/emulatorAdmin.ts` (novo) — conteúdo completo na Seção 6.2
- `scripts/lib/__tests__/emulatorAdmin.test.ts` (novo)

**Ações:**
1. Criar `scripts/lib/emulatorAdmin.ts` exatamente como especificado, com `isEmulatorConfigured` exportado como função pura e testável.
2. Criar o teste unitário cobrindo `isEmulatorConfigured`:
   ```ts
   import { isEmulatorConfigured } from '../emulatorAdmin';

   describe('isEmulatorConfigured', () => {
     it('retorna true quando ambas as env vars do emulador estão setadas', () => {
       expect(
         isEmulatorConfigured({
           FIRESTORE_EMULATOR_HOST: 'localhost:8080',
           FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
         } as NodeJS.ProcessEnv)
       ).toBe(true);
     });

     it('retorna false quando falta FIRESTORE_EMULATOR_HOST', () => {
       expect(
         isEmulatorConfigured({
           FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
         } as NodeJS.ProcessEnv)
       ).toBe(false);
     });

     it('retorna false quando falta FIREBASE_AUTH_EMULATOR_HOST', () => {
       expect(
         isEmulatorConfigured({
           FIRESTORE_EMULATOR_HOST: 'localhost:8080',
         } as NodeJS.ProcessEnv)
       ).toBe(false);
     });

     it('retorna false quando nenhuma env var está setada', () => {
       expect(isEmulatorConfigured({} as NodeJS.ProcessEnv)).toBe(false);
     });
   });
   ```

**Validação:** `npm run test:coverage` inclui e passa o novo teste; `npm run type-check` sem erros.

**Commit:** `chore(config): add emulator-only admin sdk helper with real-firebase guard` + `test(config): cover emulator-only admin sdk guard with unit tests`

---

### STEP 5 — Script de seed

**Objetivo:** Popular o emulador com a fixture da Seção 6.2 antes de cada execução da suíte.

**Arquivos afetados:**
- `scripts/seed-emulator.ts` (novo) — conteúdo completo na Seção 6.5

**Ações:**
1. Criar o arquivo exatamente como especificado.

**Validação:** Com o emulador de pé (`npm run firebase:emulators` em outro terminal), `npm run test:e2e:seed` roda sem erro e os documentos aparecem na Emulator UI (`localhost:4000`).

**Commit:** `feat(config): add scripts/seed-emulator.ts to seed firebase emulator suite`

---

### STEP 6 — Smoke spec de infraestrutura

**Objetivo:** Provar, com um teste real, que Emulator Suite + seed + Playwright + `webServer` funcionam juntos de ponta a ponta — a validação viva desta spec (ver Seção 8).

**Arquivos afetados:**
- `tests/e2e/helpers/auth.ts` (novo) — conteúdo completo na Seção 6.7
- `tests/e2e/_infra-smoke.spec.ts` (novo) — conteúdo completo na Seção 6.8

**Ações:**
1. Criar os dois arquivos exatamente como especificados.

**Validação:** `npm run test:e2e` (que já embrulha seed + Playwright) passa localmente, com os 3 testes do smoke spec verdes.

**Commit:** `test(config): add infra smoke e2e spec validating emulator + playwright pipeline`

---

### STEP 7 — Agente `qa-agent`

**Objetivo:** Disponibilizar o novo subagente que gera specs Playwright a partir de documentação existente.

**Arquivos afetados:**
- `.claude/agents/qa-agent.md` (novo) — conteúdo completo na Seção 6.11

**Ações:**
1. Criar o arquivo exatamente como especificado.
2. Validar manualmente ao menos uma vez: rodar o agente contra
   `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-suspend-consultant-reconnect-delete.md` (Modo A) e
   confirmar que ele gera um `.spec.ts` sintaticamente válido — **não é necessário commitar** esse
   spec de exemplo nesta task (fica como backlog retroativo, Seção 9).

**Validação:** O agente aparece disponível para invocação; a validação manual do passo 2 gera um arquivo que passa em `npx tsc --noEmit` e `npx playwright test --list`.

**Commit:** `feat(agents): add qa-agent subagent definition`

---

### STEP 8 — Job de CI

**Objetivo:** Rodar a suíte Playwright automaticamente em todo PR relevante.

**Arquivos afetados:**
- `.github/workflows/e2e.yml` (novo) — conteúdo completo na Seção 6.9
- `.gitignore` — adiciona `/playwright-report/`, `/test-results/`, `/blob-report/`

**Ações:**
1. Criar o workflow exatamente como especificado.
2. Atualizar `.gitignore`.
3. Fazer push da task branch e confirmar, na aba Actions do GitHub, que o job `e2e` roda e passa.

**Validação:** Execução real do workflow no GitHub Actions, com os 3 testes do smoke spec verdes e o relatório do Playwright disponível como artifact.

**Commit:** `ci(config): add e2e job running playwright against firebase emulator suite`

---

### STEP 9 — Branch protection de `develop`

**Objetivo:** Fazer o gate valer de fato — falha do job `e2e` deve bloquear merge em `develop`.

**Arquivos afetados:**
- Nenhum arquivo de código — é uma configuração operacional do GitHub (Settings → Branches), documentada mas não versionada no repositório (mesma natureza do restante da Seção 3 do guia).

**Ações:**
1. Atualizar a lista de status checks obrigatórios de `develop` (GitHub UI ou `gh api`, Seção 3.4 do guia) para incluir `e2e` junto de `lint`, `type-check`, `build`.

**Validação:** Um PR de teste para `develop` com o job `e2e` falhando propositalmente mostra o merge bloqueado.

**Commit:** N/A (configuração operacional, sem arquivo de código) — documentar a mudança na Seção 3.3 do guia (STEP 10) serve como registro.

---

### STEP 10 — Atualizar o guia de pipeline

**Objetivo:** `qa-agent` e o novo gate de CI ficam documentados como parte oficial do pipeline.

**Arquivos afetados:**
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`

**Ações:**
1. Seção 15.1 (tabela de agentes): adicionar linha para `qa-agent` — Papel: "Gera specs Playwright a partir de STEP 4 (spec concluído) ou de um UC (retroativo), rodando contra o Firebase Emulator Suite." | Entrada: "Spec em `TASK_COMPLETED/` (STEP 4) ou `UC-NN.md`" | Saída: `tests/e2e/UC-NN-slug.spec.ts` (revisão humana obrigatória antes de virar gate).
2. Seção 15.2 (diagrama de fluxo): adicionar o trecho `dev-task-manager (Modo B) → qa-agent → PR/revisão humana → e2e.yml gate` logo após o fechamento do ciclo já documentado.
3. Seção 15.3 (quando acionar cada agente): adicionar linha "Após o Modo B do `dev-task-manager` (task movida para `TASK_COMPLETED/`) | `qa-agent` | Gerar o caderno de teste automatizado da feature recém-implementada, se a Seção STEP 4 existir."
4. Seção 3.3 (branch protection de `develop`): adicionar `e2e` à lista de status checks obrigatórios, junto de `lint`, `type-check`, `build`.
5. Seção 5.1: remover a nota implícita de que `test:e2e` era "apenas exemplo" — já é real a partir desta task.

**Validação:** Leitura humana da seção atualizada; nenhuma validação automatizada aplicável (documentação).

**Commit:** `docs(config): require e2e status check on develop branch protection` + `docs(config): document qa-agent in pipeline guide section 15`

---

## 8. Estratégia de Testes

> Esta spec é, ironicamente, sobre infraestrutura de testes — a "estratégia de testes" aqui cobre tanto o que se aplica ao critério usual do projeto (funções puras) quanto como validar que o setup/seed/agente funcionam de verdade.

| Função / Arquivo | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `isEmulatorConfigured` (`scripts/lib/emulatorAdmin.ts`) | `scripts/lib/__tests__/emulatorAdmin.test.ts` | `true` com ambas env vars setadas; `false` faltando `FIRESTORE_EMULATOR_HOST`; `false` faltando `FIREBASE_AUTH_EMULATOR_HOST`; `false` sem nenhuma das duas — nunca deve permitir execução silenciosa contra Firebase real (RN-01). |
| `scripts/seed-emulator.ts` (script de integração, efeitos colaterais diretos via Admin SDK) | Não testar unitariamente | Mesma justificativa recorrente do projeto para código com dependência direta do SDK sem abstração injetável (mock frágil) — validado end-to-end pelo próprio `tests/e2e/_infra-smoke.spec.ts`, que falha se o seed não rodou corretamente. |
| `playwright.config.ts`, `.github/workflows/e2e.yml`, `.claude/agents/qa-agent.md` | Não testar | Configuração/infraestrutura/definição de agente, sem lógica de negócio — mesmo critério do projeto para tasks de config/infra/docs. |
| `tests/e2e/_infra-smoke.spec.ts` | É o próprio teste de validação da infraestrutura | Login como `system_admin` semeado → chega em `/admin/dashboard`; login como `clinic_admin` semeado → chega em `/clinic/dashboard`; asserção via Admin SDK confirmando que os custom claims do usuário semeado batem com o esperado (`role`, `tenant_id`, `active`). |

**Conclusão:** o único código com lógica pura desta spec (`isEmulatorConfigured`) tem cobertura de teste unitário, seguindo a regra do projeto de sempre testar funções puras — com prioridade alta por ser, na prática, o guard-rail que impede um teste de tocar Firebase real (superfície de segurança). O restante da infraestrutura é validado pela execução real do próprio smoke spec, tanto localmente (`npm run test:e2e`) quanto em CI (STEP 8).

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings (incluindo os novos arquivos em scripts/ e tests/e2e/)
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — suíte Jest existente passa, incluindo o novo teste de emulatorAdmin.ts
[ ] npm run test:e2e    — passa localmente (Emulator Suite sobe, seed roda, smoke spec passa)
[ ] Multi-tenant: N/A para esta task — nenhuma query de produção nova; dados de teste isolados por tenant_id fixo, só no emulador (RN-01)
[ ] Segurança: nenhum secret; TEST_PASSWORD é um valor de teste fixo, sem uso fora do emulador; emulatorAdmin.ts recusa rodar sem as env vars do emulador (RN-01, RNF-03)
[ ] .github/workflows/e2e.yml validado com pelo menos uma execução real de CI (push da task branch) antes de abrir o PR para develop
[ ] qa-agent.md validado manualmente ao menos uma vez (STEP 7, gerar um spec de exemplo a partir de um spec já concluído) — o spec de exemplo não precisa ser commitado nesta task
[ ] GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md atualizado (Seções 15.1, 15.2, 15.3, 3.3, 5.1 — STEP 10)
[ ] Branch pessoal (gscandelari_setup) validada no domínio Firebase pessoal antes do PR para develop
[ ] PR aberto para develop (nunca para master)
[ ] Ação operacional pós-merge (fora do escopo de arquivos deste PR): atualizar a branch protection real de develop no GitHub para exigir o check e2e (STEP 9) — sem isso, o gate existe em código mas não bloqueia merges de verdade
[ ] Ação operacional pós-merge: acionar uc-issues-tracker (Modo B) para atualizar a entrada ADR-QA-AUTOMATION em _MAPA-DE-BUGS-E-MELHORIAS.md (linha 331), refletindo que a infraestrutura saiu de "decisão pendente" para "implementada" e registrando o backlog retroativo dos 53 UCs como itens de "Decisão de Produto"/melhoria contínua a serem cobertos um a um
[ ] Backlog retroativo (cadernos de teste Playwright para UC-01 a UC-53) explicitamente NÃO incluído nesta task — registrado como trabalho contínuo, a ser feito via qa-agent em tasks futuras, uma de cada vez, priorizadas pelo uc-issues-tracker
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Branch protection de `develop` não ser atualizada de fato (STEP 9 é uma ação operacional fora do PR, fácil de esquecer) — o gate existiria só "no papel" | Média | Alto | Item explícito e não-condicional no checklist de DoD (Seção 9); revisor do PR deve confirmar a configuração real do GitHub antes de aprovar. |
| Job `e2e` ficar lento o suficiente para incomodar o fluxo diário (RNF-01) conforme o backlog retroativo crescer | Média (cresce com o tempo, não hoje) | Médio | Workflow dedicado e desacoplado do `ci.yml` (Seção 4.1-f); `workers: 1` e Chromium-only são pontos de partida conservadores, revisáveis quando houver medição real. |
| `qa-agent` gerar specs de baixa qualidade (asserções fracas, interpretação errada de um UC ambíguo) e a revisão humana ser superficial | Média | Alto (falso senso de segurança) | RF-07/RNF-04: todo spec exige revisão humana explícita via PR; `qa-agent.md` instrui a registrar suposições feitas (Modo B) para o revisor confirmar; nenhum spec passa a ser gate sem esse merge revisado. |
| Drift entre `tests/e2e/fixtures/seed-data.ts` e o schema real de `src/types/index.ts` conforme o produto evolui (campos renomeados/removidos sem atualizar o seed) | Média (ao longo do tempo) | Médio | `npm run type-check` cobre parcialmente (se os tipos forem reaproveitados diretamente); o smoke spec (STEP 6) falha rapidamente se o seed quebrar, servindo de sinal cedo. |
| Emulador ou seed não serem 100% determinísticos entre execuções locais (Windows/dev) e CI (Linux) | Baixa | Médio | `firebase emulators:exec` recria o estado do zero a cada execução (RN-03); nenhuma dependência de caminho de arquivo específico de SO nos scripts. |
| Backlog retroativo dos 53 UCs nunca avançar por falta de "dono" explícito, mesmo com a infraestrutura pronta | Média | Médio | Ação operacional pós-merge (Seção 9) já prevê que `uc-issues-tracker` registre o backlog como itens rastreáveis no mapa — transforma "trabalho contínuo" em itens visíveis, não uma boa intenção sem rastro. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Firebase Emulator Suite | Conjunto de emuladores locais do Firebase (Auth, Firestore, Storage, Functions, Hosting) que reproduzem o comportamento real dos serviços sem tocar em dados de produção — já configurado em `firebase.json`. |
| Projeto `demo-*` | Convenção do Firebase CLI: qualquer `projectId` prefixado com `demo-` roda 100% local, sem chamadas de rede a serviços reais e sem exigir `firebase login` — usado aqui como `demo-curva-mestra-e2e`. |
| `firebase emulators:exec` | Comando do Firebase CLI que sobe o Emulator Suite, roda um comando arbitrário com as env vars do emulador injetadas, e desliga tudo ao final — usado para embrulhar seed + Playwright num único passo determinístico. |
| STEP 4 — Validação Manual | Seção padrão presente em specs de bugfix/feature deste projeto, com passos numerados de verificação manual pré-PR — a "entrada" que o `qa-agent` (Modo A) lê para gerar testes automatizados equivalentes. |
| `qa-agent` | Novo subagente de IA que gera specs Playwright a partir de STEP 4 (Modo A) ou de um UC (Modo B, retroativo), sempre exigindo revisão humana antes de o spec virar gate de CI. |
| Gate de CI | Status check obrigatório que bloqueia o merge de um PR se falhar — nesta spec, o job `e2e` passa a ser um gate de `develop` depois da atualização de branch protection (STEP 9). |
| Backlog retroativo | Conjunto dos UC-01 a UC-53 já mapeados que ainda não têm um caderno de teste Playwright — tratado nesta spec como trabalho contínuo pós-infraestrutura, não como escopo desta task. |

---

## 12. Referências

- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0, Aprovado) — decisão de origem, com as 7 perguntas da Seção 10.1 já respondidas.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Seção 3.3 (branch protection de `develop`), Seção 4.1 (`ci.yml` atual), Seção 5.1 (script `test:e2e` hoje só de exemplo), Seção 12.5 (uso dos emuladores), Seção 15 (pipeline de agentes de IA).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (linha 331) — entrada `ADR-QA-AUTOMATION`, a ser atualizada pelo `uc-issues-tracker` após o merge desta task.
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-suspend-consultant-reconnect-delete.md` — exemplo real de Seção "STEP 4", usado como referência de mapeamento para o `qa-agent` (Seção 6.11) e como alvo de validação manual do STEP 7.
- `firebase.json` — configuração já existente da seção `emulators` (Auth, Firestore, Functions, Storage, Hosting), reaproveitada sem alteração.
- `src/lib/firebase.ts` (linhas 52-78) — conexão do Client SDK aos emuladores via `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`, reaproveitada sem alteração.
- `src/lib/firebase-admin.ts` — Admin SDK de produção, intencionalmente **não tocado**; motivou a criação de `scripts/lib/emulatorAdmin.ts` como caminho separado.
- `src/types/index.ts` — `User`, `Tenant`, `Consultant`, `LegalDocument`, `UserDocumentAcceptance`, `CustomClaims`, base para `tests/e2e/fixtures/seed-data.ts`.
- `src/app/(auth)/login/page.tsx` (linhas 232-265) — markup real do formulário de login (`id="email"`, `id="password"`, botão "Entrar"), base de `tests/e2e/helpers/auth.ts`.
- `.claude/agents/dev-task-manager.md`, `.claude/agents/doc-writer.md`, `.claude/agents/uc-issues-tracker.md`, `.claude/agents/uml-use-case-writer.md`, `.claude/agents/security-auditor.md` — precedentes de estrutura/tom para `.claude/agents/qa-agent.md`.
- `package.json`, `.env.example` — confirmam `@playwright/test` já instalado e `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` já como padrão de dev local.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 14/08/2026 | Doc Writer (Claude) | Versão inicial. Spec de implementação derivada do `ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0, Aprovado) — infraestrutura completa (Playwright + Firebase Emulator Suite + seed determinístico + `qa-agent` + gate de CI), sem migrar o backlog retroativo dos 53 UCs de uma vez. |
