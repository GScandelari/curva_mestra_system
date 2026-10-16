# Feature: Ajustes no registro de acesso (CPF/CNPJ do especialista, código do consultor na landing, rótulos, largura, sem volume, sem região do consultor) e busca de clínicas por nome no Portal do Consultor

**Projeto:** Curva Mestra
**Data:** 16/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Stanke Scandelari
**Data de Conclusão:** 16/10/2026
**Tipo:** Feature
**Branch sugerida:** `feature/ajustes-registro-e-busca-consultor`
**Prioridade:** Alta
**Versão:** 1.2
**Origem:** decisões do usuário de 16/10/2026 (itens 1 a 7, Seção 4.4). Base de código: `develop` @`55df264`. Nesta análise, o `develop` local estava em `194f494` (merge do PR #400), sem diferença em `src/`, `public/`, `functions/` e `firestore.rules` em relação a `55df264`.
**Contexto crítico:** desde 16/10/2026 há o **primeiro cliente real em produção**. Exigência do usuário: "máximo de cuidado, mínimo impacto ao usuário". Este spec prefere mudanças retrocompatíveis, não migra nenhum dado e não exige publicação de rules nem de índices no caminho principal. A ordem segura de deploy está na Seção 5.6.

> **Parte A — Registro de acesso (landing e `/register`).**
> - O especialista passa a informar **CPF ou CNPJ** (obrigatório, com máscara e validação de dígito verificador). A API grava só os dígitos.
> - O formulário da landing troca o texto livre "Consultor Rennova de referência" pelo **código do consultor** de 6 dígitos, o mesmo de `/register`.
> - O rótulo "CRM / CRO / nº conselho" vira **"Número do conselho"**.
> - `/register` fica mais largo (`max-w-2xl`) e responsivo.
> - **Volume de procedimentos** sai dos dois formulários e da API, que não grava mais o campo.
> - **Região / carteira** sai do formulário do Consultor Rennova. A API deixa de exigir `business_name` do consultor e continua exigindo do especialista.
>
> **Parte B — Busca de clínicas pelo consultor.** A tela "Buscar Clínicas" passa a aceitar CPF/CNPJ **ou** parte do nome da clínica ou do especialista. A busca por nome filtra em memória, no servidor, os tenants ativos. Não grava campo novo, não exige backfill, índice nem rule.
>
> **Status: Planejamento.** As decisões D1 a D9 foram respondidas pelo usuário em 16/10/2026, todas pela opção recomendada (Seção 4.5), e as verificações V1 e V2 foram feitas em produção (só leitura). Não há `⚠️ Decisão necessária` em aberto. O documento está pronto para o `dev-task-manager`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`. Antes de criar a branch, confira que `develop` existe local e remoto e está em sync com `master` (`git checkout develop && git pull origin develop`).
- **Branch da task:** `feature/ajustes-registro-e-busca-consultor`
- **Fluxo:** `feature/ajustes-registro-e-busca-consultor` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop` → (release) `master`. **Nunca abra PR da task direto para `develop` ou `master`.** O merge acontece sempre pelo PR, nunca manualmente.
- **Ordem dos commits:** cada commit mantém o registro e a busca funcionando. A ordem é: funções puras → API de solicitação → aprovação → tipos e telas de admin/consultor → `/register` → landing → busca (puras → servidor → tela) → rules → caderno E2E do UC-01.
- **Tipo:** é funcionalidade nova (`feat` → MINOR no release-please).

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `feat` | `auth` | `feat(auth): add pure access request payload validation with CPF/CNPJ` |
| STEP 1 | `test` | `auth` | `test(auth): cover access request payload validation` |
| STEP 2 | `feat` | `api` | `feat(api): require specialist document and drop volume in access requests` |
| STEP 2 | `test` | `api` | `test(api): cover access request creation route` |
| STEP 3 | `feat` | `api` | `feat(api): block duplicate document and name consultant tenants on approval` |
| STEP 3 | `test` | `api` | `test(api): cover duplicate document check on access request approval` |
| STEP 4 | `feat` | `admin` | `feat(admin): show document and council number in access request lists` |
| STEP 5 | `feat` | `auth` | `feat(auth): collect CPF/CNPJ and widen register form` |
| STEP 6 | `feat` | `ui` | `feat(ui): align landing access form with register form` |
| STEP 7 | `feat` | `api` | `feat(api): add pure clinic search query and name matching rules` |
| STEP 7 | `test` | `api` | `test(api): cover clinic search query and name matching rules` |
| STEP 8 | `feat` | `api` | `feat(api): search clinics by clinic or specialist name` |
| STEP 8 | `test` | `api` | `test(api): cover clinic search route` |
| STEP 9 | `feat` | `ui` | `feat(ui): search clinics by document or name in consultant portal` |
| STEP 10 | `feat` | `firebase` | `feat(firebase): deny client-side creation of access requests` |
| STEP 10 | `test` | `firebase` | `test(firebase): cover access requests rules for get and list` |
| STEP 11 | `test` | `e2e` | `test(e2e): update UC-01 notebook for document field and removed volume` |
| STEP 12 | — | — | Validação Manual, sem commit de código |

> O escopo `e2e` não está na lista da Seção 2.3 do SST, mas já é usado no histórico do projeto para os cadernos Playwright. Se o commitlint recusar, use `test(auth)`.

**Ao abrir o PR `gscandelari_setup` → `develop`** (Seção 15 do SST):
- `uml-use-case-writer` atualiza:
  - UC-01: CPF/CNPJ obrigatório para especialista, código do consultor na landing, rótulo "Número do conselho", fim do volume, consultor sem região/carteira, novas mensagens de erro;
  - UC-02: documento vindo da solicitação (fecha `UC-02-Q1` pela opção (d)), checagem de duplicidade (D1), nome do tenant do consultor (D6);
  - UC-03: rejeição de solicitação de consultor sem `business_name` (texto do e-mail);
  - UC-56: mesma checagem de duplicidade na aprovação pelo consultor; tela sem "Região / carteira";
  - UC-24 e UC-25: busca por nome (RN-03 do UC-24 passa a ser falsa), guarda de consultor ativo;
  - UC-45: a tela de onboarding passa a vir com o documento preenchido.
- `uc-issues-tracker` (Modo B):
  - fecha `UC-02-Q1` (opção (d));
  - registra os achados F4, F6, F7 e F11 (Seção 1.4) que ficaram fora do escopo;
  - registra F1 como corrigido (D7-A) e o CNPJ alfanumérico como débito técnico (D2-A).

**Produção:** o workflow `deploy-firebase.yml` publica só `hosting:curva-mestra` e `functions`. Este spec **não muda `firestore.indexes.json`** e muda `firestore.rules` só em `access_requests` (D7-A: `allow create: if false`). **Ordem obrigatória: primeiro o hosting de produção (merge em `master`), depois a conferência do passo 37 e só então a publicação manual da rule pelo usuário.** É o oposto da ordem usual dos specs anteriores: se a rule entrar antes, a API antiga (que grava pelo client SDK) recebe `PERMISSION_DENIED` e todas as solicitações de acesso falham. Detalhes e rollback na Seção 5.6.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Formulários de solicitação de acesso (UC-01)**
- `/register` (`src/app/(auth)/register/page.tsx`):
  - card `max-w-lg` (l. 180), com grids `grid-cols-2` fixas também no celular (l. 206, 231, 276);
  - campos: perfil, `fullName`, `councilNumber` (rótulo "CRM / CRO / nº conselho *" ou "ID Rennova *", l. 246; placeholder "Ex.: CRM-SP 142337", l. 250), `email`, `phone`, `businessName` ("Nome da clínica *" ou "Região / carteira *", l. 293);
  - só para especialista: `consultantCode` (6 dígitos, validado por `validateConsultantCode`) e os botões "Volume de procedimentos por mês" (`VOLUME_OPTIONS`, l. 30, 329-349; `body.volume`, l. 130);
  - erro do conselho: "Número de conselho (CRM/CRO) é obrigatório" (l. 88); da região: "Região / carteira é obrigatória" (l. 107);
  - **não coleta CPF/CNPJ.**
- Landing (`public/landing/sections-cta.jsx`, componente `RequestAccess`):
  - JSX puro, transpilado no navegador pelo Babel standalone (sem `import`);
  - servida pelo Route Handler `src/app/route.ts`, que devolve um HTML fixo (`LANDING_HTML`, `dynamic = 'force-dynamic'`) com `<base href="/landing/">` e `<script type="text/babel" src="sections-cta.jsx">` **sem versão na URL** (l. 204-211);
  - `public/landing/index.html` é a "cópia de referência" desse HTML (comentário de `route.ts`, l. 13) e tem as mesmas tags `<script>` (l. 193-199);
  - mesmos campos de `/register`, mas o campo opcional é "Consultor Rennova de referência", texto livre enviado como `consultant_reference` (l. 49-51, 276-285), que a API ignora; o volume é enviado (l. 48, 287-305);
  - não valida nada no client além de `required`.
- **API** `POST /api/access-requests` (`src/app/api/access-requests/route.ts`):
  - rota pública; lê `system_settings/global.registration_enabled` com Admin SDK (l. 77-83);
  - `requiredFields` exige `role`, `full_name`, `email`, `phone`, `council_number` ("Número de conselho / ID Rennova") e `business_name` ("Nome da clínica / região") **para os dois perfis** (l. 86-99);
  - valida nome, e-mail e telefone com `serverValidations`; bloqueia solicitação pendente do mesmo e-mail com Admin SDK (409);
  - valida `consultant_code` só para especialista (formato + consultor `active`);
  - grava `volume: data.volume || null` (l. 189). **Não lê `document_type` nem `document_number`;**
  - **grava pelo client SDK** (`addDoc`, l. 195), numa instância própria de `initializeApp` dentro da rota. Por isso depende da rule `access_requests` `allow create: if true` (`firestore.rules:276-282`).
- Tipo `AccessRequest` (`src/types/index.ts:255-304`):
  - `business_name: string` obrigatório;
  - `volume?: string`;
  - `document_type?` e `document_number?` opcionais, com o comentário "opcional desde nova versão do formulário".

**Aprovação (UC-02 e UC-56)**
- `createTenantAndUserFromAccessRequest` (`src/lib/services/accessRequestApproval.ts:78-218`), chamada por `POST /api/access-requests/[id]/approve` (system_admin) e `.../approve-consultant` (consultor ativo, UC-56):
  - cria o tenant com `name: request.business_name`, `document_type: request.document_type ?? 'cnpj'` e `document_number: request.document_number ?? ''` (l. 94-96);
  - cria o usuário Auth `clinic_admin`, o documento `users/{uid}` com `full_name`, e envia o e-mail `welcome_approval` com `businessName: request.business_name`;
  - **não verifica se já existe tenant com o mesmo documento.**
- Uma solicitação de **consultor**, quando aprovada, também cria um tenant (1 usuário, UC-02 RN-02), com nome igual à "Região / carteira" digitada.
- `approveAccessRequestResponse` (`src/lib/services/accessRequestRouteHelpers.ts:84-103`) traduz `EmailAlreadyInUseError` para 400.

**Telas que exibem solicitações**
- `/admin/access-requests` (`src/app/(admin)/admin/access-requests/page.tsx:277-291`): a coluna "Negócio" mostra `business_name` e, num **ternário**, o conselho (`"ID Rennova"`/`"Conselho"`) **ou** o documento. Como toda solicitação tem `council_number`, o documento nunca aparece.
- `/consultant/access-requests` (`src/app/(consultant)/consultant/access-requests/page.tsx`):
  - mostra "Clínica:" / "Região / carteira:" + `business_name` (l. 181-183) e "Conselho:" / "ID Rennova:" (l. 187);
  - o diálogo de aprovação diz `Será criada a clínica "${business_name}"` (l. 222);
  - a interface local tem `volume: string | null` (l. 28), que não é exibido.
- `GET /api/consultants/me/pending-access-requests` devolve `business_name` e `volume` (l. 74-75).

**Outros consumidores de `business_name`, `volume` e documento**
- `functions/src/onAccessRequestCreated.ts:57-61`: e-mail interno ao system_admin usa `document_number || ''` (assunto "Solicitação de Acesso - {{documentNumber}}") e `business_name || fullName`. **Já tolera os dois campos ausentes e passa a mostrar o documento sem nenhuma mudança.**
- `functions/src/checkConsultantPendingAccessRequestsScheduled.ts:90` e `src/lib/consultantPendingRequestsDigest.ts`: usam `business_name || ''`. Só valem para solicitações com `consultant_id`, que hoje são só de especialista.
- `src/app/api/access-requests/[id]/reject/route.ts:88,112`: usa `request.business_name` no e-mail de rejeição. Segundo o UC-03 v1.3, essa rota não é chamada pela UI (a tela usa `rejectAccessRequest` do client SDK).
- `src/lib/services/accessRequestService.ts:33-149` (`createAccessRequest`): código morto, já registrado no mapa. Não é tocado.

**Edição do documento do tenant**
- `/admin/tenants/[id]` valida com `validateDocument` e grava só dígitos em `document_number` e no legado `cnpj` (l. 141-168).
- `/clinic/setup` (UC-45, onboarding do `clinic_admin`) **exige** CNPJ válido ou CPF com 11 dígitos e grava em `document_number` (l. 172-189, 256). A tela vem pré-preenchida com o que estiver no tenant.

**Busca de clínicas pelo consultor (UC-24, UC-25)**
- `/consultant/clinics/search` (`src/app/(consultant)/consultant/clinics/search/page.tsx`):
  - um campo "CNPJ ou CPF" com máscara (`formatDocument`, que **apaga tudo que não é dígito**);
  - exige 11+ dígitos e chama `GET /api/tenants/search?document=`;
  - cada resultado mostra nome, documento, e-mail e:
    - "Vincular Agora" (sem consultor), ou
    - "Clínica já possui o consultor X" + "Solicitar Transferência" (com consultor), via `POST /api/consultants/claims`.
- `GET /api/tenants/search` (`src/app/api/tenants/search/route.ts`):
  - exige `is_consultant` **ou** `is_system_admin`, mas **não verifica `active` no token nem `consultants/{id}.status`**;
  - consulta `tenants where document_number == X && active == true` (Admin SDK);
  - devolve `{ id, name, document_type, document_number, email, consultant_id, consultant_name }`.
- Já existe a guarda `verifyActiveConsultant` (`accessRequestRouteHelpers.ts:43-67`): claim `is_consultant`, `consultant_id`, `active === true` **e** documento `consultants/{id}` com `status === 'active'` (UC-56 RN-07).
- Rules: o consultor só lê `tenants/{id}` com `consultantHasAccess`; `users` só é listável por `clinic_admin` do próprio tenant. **O client não consegue buscar clínicas alheias**, e a busca precisa continuar no servidor.

**Validadores existentes**

| Função | Arquivo | Retorno | Observação |
|---|---|---|---|
| `validateCPF`, `validateCNPJ`, `validateDocument(doc, type)` | `src/lib/validations/serverValidations.ts` | `{ valid, error }` com mensagens ("CPF deve ter 11 dígitos", "CNPJ inválido: dígito verificador incorreto"…) | Já importado por `/register`. Só numérico. |
| `validateCPF`, `validateCNPJ`, `validateDocument(doc)`, `maskCPF`, `maskCNPJ`, `formatDocumentAuto` | `src/lib/utils/documentValidation.ts` | `boolean` / string | Usado pelo admin. Só numérico. |
| `validateCNPJ` | `src/types/tenant.ts:92` | `boolean` | Usado por `/clinic/setup`. Só numérico. |
| `isValidCnpj`, `normalizeCnpj`, `maskCnpjInput` | `src/lib/nfIdentity.ts:57-95` | `boolean` / string | **Aceita CNPJ alfanumérico** (12 posições `[0-9A-Z]` + 2 DV). Usado na identidade da NF-e. |

**Testes existentes relacionados**
- `src/__tests__/serverValidations.test.ts` cobre `validateConsultantCode`.
- Não existem testes Jest para `POST /api/access-requests`, para a aprovação nem para `GET /api/tenants/search`.
- `tests/e2e/UC-01-solicitar-acesso-ao-sistema.spec.ts`:
  - preenche `#councilNumber` e `#businessName` para os dois perfis;
  - **verifica o texto "Volume de procedimentos por mês" e `doc.volume`** (l. 77, 88, 102, 132, 153, 174, 196);
  - verifica "Região / carteira *" e `doc.business_name` do consultor (l. 151, 161, 192, 250);
  - quebra com esta task e é gate de CI (STEP 11).
- `tests/e2e/UC-02`, `UC-03`, `UC-05` e `UC-56` gravam solicitações direto no emulador (Admin SDK). Não passam pelo formulário.

### 1.2 Problema identificado

1. As clínicas criadas pelo fluxo de solicitação nascem com `document_number: ''`, porque nenhum formulário coleta o documento (UC-02-Q1). Elas não são encontradas pela busca por documento do consultor, e o system_admin precisa completar o cadastro à mão em `/admin/tenants/[id]`.
2. A landing manda um texto livre de consultor que a API ignora. Um especialista que chega pela landing não consegue se vincular ao consultor (UC-01 RN-08, UC-56 e UC-57 não funcionam por esse caminho).
3. O rótulo "CRM / CRO / nº conselho" não cobre os demais conselhos da HOF.
4. `/register` é estreito (`max-w-lg`) e usa duas colunas fixas mesmo no celular.
5. O volume de procedimentos é gravado sem uso nenhum ("lixo no banco", nas palavras do usuário).
6. A "Região / carteira" do consultor não é usada em regra nenhuma e, se a solicitação for aprovada, vira o **nome do tenant**.
7. O consultor só encontra uma clínica se souber o CPF/CNPJ exato, e hoje nem as clínicas reais têm documento.

### 1.3 Motivação estratégica

Com o primeiro cliente real em produção, a aquisição de clínicas pelos consultores Rennova passa a ser o caminho de crescimento. O documento coletado no registro dá à clínica uma identidade desde a aprovação e destrava a busca por documento. A busca por nome resolve o caso mais comum, em que o consultor conhece o especialista ou a clínica pelo nome. Os demais ajustes reduzem atrito e dados inúteis no formulário. Toda mudança é retrocompatível com os dados atuais e não exige migração.

### 1.4 Achados desta investigação

| # | Achado | Tratamento |
|---|---|---|
| F1 | `access_requests` tem `allow create: if true` e a API grava pelo client SDK. **Qualquer visitante pode gravar uma solicitação direto no Firestore, sem passar pela validação da API** (sem documento, com `volume`, com `business_name` arbitrário). A obrigatoriedade do documento seria contornável. | D7-A: a API grava com Admin SDK e a rule passa a `allow create: if false` (STEP 2 e STEP 10), publicada só depois do hosting (Seção 5.6). |
| F2 | A aprovação de uma solicitação de **consultor** cria um tenant com `name: request.business_name` (a região). Sem `business_name`, `adminDb.collection('tenants').add()` receberia `name: undefined` e **falharia** (o Admin SDK recusa `undefined` sem `ignoreUndefinedProperties`). | Fallback de nome: `full_name` (D6-A). Fica fora do escopo saber se aprovar uma solicitação de consultor deve criar um tenant: é o comportamento documentado em UC-02 RN-02 e não muda. |
| F3 | O ternário de `/admin/access-requests` esconde o documento sempre que há `council_number`. | Exibe os dois (STEP 4). |
| F4 | `/clinic/setup` (UC-45) exige o documento no onboarding. Uma clínica cujo `clinic_admin` concluiu o onboarding **já tem** `document_number` preenchido por ele. O setup também não checa duplicidade, e o CPF só é validado pelo tamanho. | V1 (16/10/2026): o tenant do cliente real ("Clínica Linda Mello") está com `document_number` vazio e sem `onboarding_completed`, ou seja, o onboarding não foi concluído. O preenchimento é um passo manual opcional do system_admin (Seção 5.6). O resto fica fora do escopo e vai para o mapa. |
| F5 | `GET /api/tenants/search` não exige `active` nem consultor `status: 'active'`: um consultor suspenso com token ainda válido consegue buscar. | Corrigido pela guarda nova (RF-14), exigida pelo usuário. |
| F6 | `POST /api/consultants/claims` também não confere `consultants/{id}.status`. | Fora do escopo. Vai para o mapa. |
| F7 | A busca por documento só lê `document_number`. Um tenant muito antigo que tenha só o campo legado `cnpj` não é encontrado. | Fora do escopo; a busca por nome cobre esse caso. A checagem de duplicidade (D1) lê os dois campos. |
| F8 | Os `.jsx` da landing são servidos sem versão na URL e podem ficar em cache no navegador. Uma aba ou cache antigo enviaria o formulário velho (sem documento) e receberia 400 "CPF ou CNPJ é obrigatório" num formulário sem esse campo. | Versão na URL dos `<script>` (`?v=…`) em `route.ts` e `index.html` (STEP 6). O HTML é `force-dynamic` e passa a apontar para a versão nova assim que o hosting sobe. |
| F9 | O caderno `tests/e2e/UC-01-…spec.ts` verifica volume e região do consultor, e é gate de CI. | Atualizado no STEP 11, com revisão humana. |
| F10 | `UC-02-Q1` (decisão pendente sobre o documento do tenant ser fallback fixo) é resolvido pela opção (d), "reintroduzir a coleta em UC-01". | Fechar no mapa. |
| F11 | Na busca, uma clínica que já é do próprio consultor aparece com "Solicitar Transferência", e a API responde 400 "Você já é o consultor vinculado a esta clínica". A busca por nome deixa isso mais frequente. | D9-A: card "Você já é o consultor desta clínica", sem botão (RF-20). |

---

## 2. Objetivos

1. **Exigir** CPF ou CNPJ válido do especialista nos dois formulários e na API, gravando só os dígitos na solicitação.
2. **Garantir** que a clínica aprovada nasça com o documento da solicitação, sem duplicar documento de outra clínica (D1).
3. **Substituir** na landing o texto livre do consultor pelo código de 6 dígitos validado, igual a `/register`.
4. **Renomear** o rótulo do conselho para "Número do conselho" nos formulários e nas mensagens.
5. **Alargar** `/register` para `max-w-2xl`, com layout de uma coluna no celular.
6. **Remover** o volume de procedimentos dos formulários, da API, da resposta do consultor e do tipo (que fica como legado), sem tocar nos dados antigos.
7. **Remover** a "Região / carteira" do formulário do consultor e da exigência da API, mantendo a aprovação funcionando (D6).
8. **Permitir** ao consultor ativo (e ao system_admin) buscar clínicas ativas por nome da clínica ou do especialista, com mínimo de caracteres e limite de resultados (D3, D4, D5).
9. **Garantir** que a busca só responda a consultor ativo ou system_admin ativo.
10. **Cobrir** com Jest as funções puras e as rotas; com `npm run test:rules` (get e list), a rule nova de `access_requests` e a regressão de `tenants`/`users`; e atualizar o caderno E2E do UC-01.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

**Parte A — Registro**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | Em `/register` e na landing, com o perfil **Especialista HOF**, aparece o campo obrigatório **"CPF ou CNPJ \*"**, com seletor de tipo (CNPJ, que é o padrão, e CPF) e máscara (`00.000.000/0000-00` ou `000.000.000-00`). Trocar o tipo limpa o número. O campo não aparece para o Consultor Rennova. | Visitante | Must |
| RF-02 | Em `/register`, o documento é validado no client com as mesmas funções da API (`validateCPF`/`validateCNPJ` de `serverValidations`). Mensagens: vazio → "CPF ou CNPJ é obrigatório"; demais casos → mensagem da função (ex.: "CNPJ inválido: dígito verificador incorreto"). Na landing, o client só confere o tamanho (11 ou 14 dígitos) e o DV vem da API, exibido no bloco de erro atual. | Visitante | Must |
| RF-03 | `POST /api/access-requests`, com `role === 'especialista'`, exige `document_type` (`'cpf'` ou `'cnpj'`) e `document_number`. Remove a máscara, valida tamanho e DV e grava `document_type` e `document_number` só com dígitos. Com `role === 'consultor'`, ignora os dois campos e não os grava. | Sistema | Must |
| RF-04 | Na landing, com o perfil Especialista, o campo opcional passa a ser **"Código do consultor Rennova (opcional)"**: só dígitos, no máximo 6, `inputMode="numeric"`, com a dica "Código de 6 dígitos informado pelo seu consultor Rennova.". Preenchido, o client exige 6 dígitos ("Código de consultor inválido ou inativo") e envia `consultant_code`. A API valida como hoje (formato + consultor `active`, mensagem única `INVALID_CONSULTANT_CODE_ERROR`). `consultant_reference` deixa de ser enviado. | Visitante | Must |
| RF-05 | O rótulo do conselho do especialista passa a ser **"Número do conselho \*"** em `/register` (com asterisco) e **"Número do conselho"** na landing (que não usa asterisco em nenhum rótulo hoje). Placeholder: "Ex.: CRM-SP 142337 ou CRO-RJ 5678" (D8). Mensagem de erro de `/register` e da API: "Número do conselho é obrigatório". Para o consultor continuam "ID Rennova \*" e "ID Rennova é obrigatório". | Visitante | Must |
| RF-06 | `/register` usa `max-w-2xl`. As grades de duas colunas viram `grid-cols-1 sm:grid-cols-2`. O seletor de perfil continua com duas colunas. | Visitante | Must |
| RF-07 | O volume de procedimentos sai de `/register` (`VOLUME_OPTIONS`, estado `volume`, bloco de botões, `body.volume`) e da landing (estado `volume`, bloco, `body.volume`). A API **não grava mais** `volume`, mesmo que o corpo o traga (cache antigo). | Visitante / Sistema | Must |
| RF-08 | Com o perfil Consultor Rennova, o campo "Região / carteira" sai dos dois formulários e o telefone ocupa a linha inteira. A API não exige nem grava `business_name` do consultor (mesmo que o corpo o traga). Para o especialista, "Nome da clínica \*" continua obrigatório. | Visitante / Sistema | Must |
| RF-09 | Cada perfil tem seu próprio erro de obrigatório na API: "Número do conselho é obrigatório" / "ID Rennova é obrigatório" e "Nome da clínica é obrigatório" (só especialista). As mensagens atuais de perfil, nome, e-mail e telefone não mudam. | Sistema | Must |

**Parte A — Aprovação e telas**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-10 | A aprovação (system_admin e consultor) cria o tenant com `document_type` e `document_number` da solicitação (já é assim). Uma solicitação antiga sem documento continua aprovável e gera o tenant com `''`, como hoje. | system_admin / consultor | Must |
| RF-11 | Checagem de duplicidade do documento (D1-A): na aprovação, nas duas rotas, antes de criar o tenant, se a solicitação tiver documento e já existir tenant (ativo ou inativo) com o mesmo valor em `document_number` ou no legado `cnpj`, a API responde **409** "Já existe uma clínica cadastrada com este CPF/CNPJ. Verifique com o solicitante antes de aprovar." e não cria nada. | system_admin / consultor | Must |
| RF-12 | Nome do tenant criado a partir de solicitação sem `business_name` (consultor): usa o `full_name` (D6-A). O mesmo valor vai para `businessName` do e-mail `welcome_approval`, para o retorno da aprovação, para o e-mail de rejeição da rota `/reject` e para o diálogo do consultor. | Sistema | Must |
| RF-13 | `/admin/access-requests`, coluna "Negócio": mostra `business_name` (ou "—" se ausente), o conselho e, **também**, o documento ("CNPJ: 12.345.678/0001-95"), quando existir. `/consultant/access-requests`: mostra "Clínica:" só se houver `business_name`. Uma solicitação antiga de consultor com região continua exibindo "Região / carteira:" + valor (legado). Os rótulos "Conselho:" das duas listas passam a "Nº do conselho:" (D8). `GET /api/consultants/me/pending-access-requests` deixa de devolver `volume`. | system_admin / consultor | Must |

**Parte B — Busca**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-14 | `GET /api/tenants/search` aceita: <br>(a) system_admin com `is_system_admin === true` e `active === true`; ou <br>(b) consultor ativo pela guarda `verifyActiveConsultant` (claim `active`, `consultant_id` e `consultants/{id}.status === 'active'`). <br>Qualquer outro token → 403 "Acesso restrito a consultores ativos". Sem token → 401. | Consultor / system_admin | Must |
| RF-15 | A rota aceita o parâmetro novo `q`, e o antigo `document` continua sendo aceito como sinônimo (retrocompatibilidade com aba aberta). A consulta é classificada assim: <br>(1) **com pelo menos uma letra** → busca por nome; <br>(2) **sem letra** e com 11 ou 14 dígitos → busca por documento (exatamente como hoje: `document_number == dígitos && active == true`); <br>(3) os demais casos → 400 "Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome". | Consultor | Must |
| RF-16 | Busca por nome: termo normalizado (minúsculas, sem acento, espaços colapsados) com **no mínimo 3 caracteres** sem espaço (D5), senão 400 "Digite ao menos 3 letras do nome da clínica ou do especialista". Um tenant **ativo** casa quando **todas** as palavras do termo aparecem (como substring) no nome normalizado da clínica **ou** no nome normalizado de um mesmo especialista (`clinic_admin` ativo, D3-A). | Consultor | Must |
| RF-17 | Resultado da busca por nome: ordenado pelo nome da clínica, **até 20 itens** (D5), no **mesmo formato** da busca por documento (`id`, `name`, `document_type`, `document_number`, `email`, `consultant_id`, `consultant_name`), incluindo clínicas que já têm consultor, sem indicar qual especialista casou com o termo (D5). A resposta acrescenta `truncated: boolean`. | Consultor | Must |
| RF-18 | Tela "Buscar Clínicas": <br>- campo único **"CNPJ, CPF ou nome"**, placeholder "CNPJ, CPF, nome da clínica ou do especialista"; <br>- a máscara de documento só é aplicada quando o texto não tem letra (com letra, o texto fica como digitado); <br>- Enter dispara a busca; <br>- validação local com a mesma função pura da rota; <br>- textos de vazio: "Nenhuma clínica encontrada com este documento." ou "Nenhuma clínica encontrada com este nome."; <br>- com `truncated`: "Mostrando os 20 primeiros resultados. Refine a busca."; <br>- títulos: "Buscar Clínicas", "Encontre clínicas por CNPJ, CPF ou nome para vincular", card "Buscar Clínica", "Informe o CNPJ, o CPF ou parte do nome da clínica ou do especialista"; <br>- passo 1 do "Como funciona?": "Busque a clínica pelo CNPJ, CPF ou nome". | Consultor | Must |
| RF-19 | Tenants inativos (`active != true`) nunca aparecem, nem na busca por nome nem na busca por documento. | Sistema | Must |
| RF-20 | Clínica já vinculada ao próprio consultor (D9-A): o card mostra "Você já é o consultor desta clínica", sem botão (comparação de `tenant.consultant_id` com `claims.consultant_id`, só no client). | Consultor | Should |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | **Nenhuma migração nem escrita em documento existente.** `access_requests`, `tenants` e `users` antigos ficam como estão, inclusive o `volume` e a região das solicitações antigas. | Segurança de dados / produção |
| RNF-02 | Retrocompatibilidade: <br>- solicitação antiga sem documento continua aprovável; <br>- solicitação antiga de consultor com `business_name` usa esse nome na aprovação (comportamento atual); <br>- o parâmetro `?document=` continua aceito; <br>- a API ignora campos extras de formulário em cache (`volume`, `consultant_reference`, `business_name` e documento do consultor), sem erro. | Compatibilidade |
| RNF-03 | Nenhuma escrita nova de client em coleção alguma. A busca roda só no servidor (Admin SDK) e não abre rule de `tenants` nem de `users` para o consultor. A criação de `access_requests` passa a ser só do servidor (D7-A). | Segurança / Multi-tenant |
| RNF-04 | A busca por nome não grava nada e não exige índice composto: `tenants where active == true` e `users where role == 'clinic_admin'` usam índices de campo único automáticos. | Operação |
| RNF-05 | Custo da busca por nome: uma leitura por tenant ativo e por `clinic_admin` em cada busca. Aceitável no volume atual (V2). Revisar a abordagem (D4-B) se a soma passar de ~1.000 documentos por busca. | Performance |
| RNF-06 | Nenhum log novo com CPF/CNPJ, termo de busca, nome ou e-mail. Os `console.error` das rotas registram só o erro. | Privacidade (LGPD) |
| RNF-07 | `GET /api/tenants/search` responde com `Cache-Control: no-store` (já é `dynamic = 'force-dynamic'`). | Correção |
| RNF-08 | Mesmas funções de validação no client (TS) e na API: `validateAccessRequestInput` e `classifyClinicSearchQuery`. A landing (JSX sem `import`) replica só a máscara e o tamanho; o DV é sempre validado pela API. | Manutenibilidade |
| RNF-09 | Sem mudança em `functions/`: `onAccessRequestCreated` já trata documento e `business_name` ausentes. | Deploy |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | O documento é obrigatório só para `role === 'especialista'`. O consultor não informa documento. | Decisão do usuário (item 1). |
| RN-02 | `document_number` é gravado só com dígitos: 11 para CPF, 14 para CNPJ, com os dois DV corretos e sem todos os dígitos iguais. CNPJ alfanumérico não é aceito nesta task (D2-A; débito técnico). | Decisão do usuário; padrão do resto do sistema (admin, setup, busca). |
| RN-03 | `document_type` precisa bater com o tamanho: `'cpf'` e 14 dígitos → "CPF deve ter 11 dígitos"; `'cnpj'` e 11 → "CNPJ deve ter 14 dígitos". | Evita tipo e número incoerentes no tenant. |
| RN-04 | `consultant_code` continua opcional, só para especialista, com 6 dígitos e consultor `active`. Mesma mensagem para formato inválido e código inexistente ou inativo. | UC-01 RN-08 / RN-11. |
| RN-05 | `volume` não é mais aceito nem gravado. Os documentos antigos que o têm não são alterados. | Decisão do usuário (item 5). |
| RN-06 | `business_name` é obrigatório e gravado só para o especialista. Para o consultor, não é gravado. | Decisão do usuário (item 6). |
| RN-07 | Nome do tenant na aprovação = `business_name` (sem espaços nas pontas), se houver; senão, `full_name` (D6). | F2. |
| RN-08 | Duplicidade de documento (D1-A): checada na aprovação (system_admin e consultor), antes de qualquer escrita. Existe tenant, **ativo ou inativo**, com o mesmo valor em `document_number` ou no legado `cnpj` → 409, sem criar tenant, usuário nem e-mail. Solicitação sem documento não é checada. | Evita duas clínicas com o mesmo documento sem abrir enumeração na rota pública. |
| RN-09 | Busca: só tenants `active == true`; por documento, igualdade exata; por nome, todas as palavras do termo no mesmo campo (nome da clínica ou nome de um especialista), sem acento e sem diferença de maiúsculas. | Decisão do usuário (item 7). |
| RN-10 | "Especialista" de um tenant, para a busca: os documentos `users` com `role == 'clinic_admin'`, `tenant_id` do tenant e `active !== false`, pelo nome `full_name` (ou `displayName`, se `full_name` faltar). (D3) | Cobre clínicas criadas por solicitação e pelo admin, e reflete edições de perfil. |
| RN-11 | A busca é autorizada só para consultor ativo (claim e documento) ou system_admin ativo. | Decisão do usuário (item 7); F5. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Validação pura compartilhada para a solicitação.** O novo `src/lib/accessRequestPayload.ts` concentra:
   - `validateAccessRequestInput(data)`: obrigatórios por perfil, documento, código do consultor (formato) e normalização;
   - `getAccessRequestBusinessName(request)`: fallback de nome do RN-07.

   A rota passa a montar o registro só a partir do valor normalizado (lista branca de campos). Assim, `volume`, `consultant_reference`, a região e o documento do consultor ficam de fora automaticamente. `/register` reaproveita a mesma função antes do `fetch`.
2. **Documento com seletor de tipo.** O seletor é explícito, não deduzido do tamanho, para casar com `document_type` do tenant e com as máscaras já existentes (`maskCPF`/`maskCNPJ` de `documentValidation.ts`). O DV usa `validateCPF`/`validateCNPJ` de `serverValidations.ts`, que já têm mensagens prontas e são as mesmas no client e no servidor.
3. **Landing.** Recebe as mesmas mudanças, implementadas com funções locais (máscara, tamanho, regex `^\d{6}$`), porque o JSX não pode importar módulos. Os `<script>` ganham `?v=20261016` (o valor final é a data do merge) em `src/app/route.ts` e em `public/landing/index.html`, para o navegador não usar o JSX antigo (F8).
4. **Aprovação.** Muda o mínimo:
   - nome do tenant e `businessName` pelo fallback (D6);
   - checagem de duplicidade antes de `tenants.add()` (D1-A), com um erro tipado novo, `DocumentAlreadyInUseError`, que `approveAccessRequestResponse` traduz para 409.

   Como as duas rotas de aprovação usam a mesma cadeia, a regra vale para system_admin e para consultor.
5. **Busca por nome: filtro em memória no servidor (D4-A).**
   - A rota lê, com Admin SDK, `tenants where active == true` e `users where role == 'clinic_admin'`, agrupa os nomes dos especialistas por `tenant_id` e aplica `filterTenantsByName` (função pura).
   - Não há campo novo, backfill, índice nem rule.
   - O nome atual da clínica e o do especialista são lidos na hora. Isso importa porque a clínica edita o próprio `name` pelo client SDK (`/clinic/setup`, `updateTenant`) e o system_admin também (`/admin/tenants/[id]`). Um campo derivado ficaria desatualizado nesses caminhos, a menos que todos fossem alterados ou que se criasse um trigger novo.
   - O tenant do cliente real é encontrado no primeiro deploy, sem tocar no documento dele.
6. **Guarda da busca.** `verifyActiveConsultant` hoje recebe o `req` e verifica o token. Ela é dividida em duas, **sem mudar o comportamento** das rotas UC-56 que já a usam:
   - `checkActiveConsultant(decodedToken, deniedMessage)` (nova; recebe o token já decodificado);
   - `verifyActiveConsultant` (passa a chamar a nova).

   A rota de busca decodifica o token uma vez, aceita system_admin ativo ou consultor ativo, e nega o resto.
7. **Classificação da consulta.** É feita por uma função pura (`classifyClinicSearchQuery`), usada pela tela e pela rota. "Tem letra" decide o tipo de busca, porque nomes de clínica com número ("Clínica 24h") sempre têm letra.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Busca por prefixo num campo normalizado (`name_search`) com backfill (D4-B) | Exige script de migração em produção (não autorizado). Todo caminho que edita `name` precisaria manter o campo: `/clinic/setup` e `/admin/tenants/[id]` gravam pelo client SDK, e a rule do tenant deixa o `clinic_admin` alterar qualquer campo exceto os de ativação, inclusive o campo derivado. Prefixo também não encontra "Cíngulo" em "Clínica Cíngulo". |
| Campo de busca gravado só na aprovação (D4-C) | Não cobre os tenants existentes (cliente real incluído) sem backfill, nem os tenants criados por `/admin/tenants/new`, e fica velho quando o nome muda. |
| Abrir rules de `tenants`/`users` para o consultor buscar pelo client | Expõe a lista de todas as clínicas e usuários a qualquer consultor, viola a allowlist de UC-48-RN-06 e não resolve a busca por substring. |
| Deduzir CPF/CNPJ pelo tamanho, sem seletor | Funciona para a validação, mas mascarar o campo enquanto o usuário digita fica ambíguo (11 dígitos ainda pode ser um CNPJ incompleto). O seletor deixa `document_type` explícito. |
| Validar o DV também na landing | Exigiria copiar o algoritmo para o JSX, sem teste. A API valida e a landing já mostra o erro da API. |
| Checar duplicidade de documento na solicitação (rota pública) (D1-C) | Permite que qualquer visitante descubra se um CPF/CNPJ é cliente (enumeração), e bloqueia o solicitante sem contexto. |
| Apagar `volume` ou região das solicitações antigas | Migração não autorizada (RNF-01). |

### 4.3 Trade-offs aceitos

- **Leitura linear na busca por nome:** custo e latência crescem com o número de tenants e de `clinic_admin`. Aceitável hoje (RNF-05 e V2). O gatilho de revisão fica registrado.
- **Validação da landing mais fraca que a de `/register`:** o DV só aparece depois do envio. Aceito para não duplicar algoritmo em JSX sem teste.
- **Rótulos legados:** solicitações antigas de consultor continuam mostrando "Região / carteira" nas telas. Aceito para não reescrever dados.
- **CNPJ só numérico** (D2-A): um CNPJ alfanumérico emitido pela Receita não passa no registro. Esses casos vão para o system_admin (o solicitante entra em contato e o admin cria a clínica por `/admin/tenants/new`, que também é só numérico hoje). Fica registrado como débito.
- **Duplicidade checada só na aprovação** (D1-A): o solicitante só descobre a duplicidade pelo contato do admin. Aceito para não abrir enumeração na rota pública.

### 4.4 Decisões do usuário (16/10/2026)

| Item | Decisão | Onde está refletida |
|---|---|---|
| 1 | CPF/CNPJ obrigatório para o especialista nos dois formulários; API valida com DV e grava só dígitos; máscara; exibição no admin; avaliar a duplicidade e recomendar. | RF-01 a RF-03, RF-10, RF-11, RF-13, RN-01 a RN-03, D1, D2 |
| 2 | Landing usa o código de 6 dígitos do consultor (`consultant_code`) com a validação de `/register`. | RF-04, RN-04 |
| 3 | "CRM / CRO / nº conselho \*" → "Número do conselho \*"; mensagem "Número do conselho é obrigatório"; listar os outros lugares. | RF-05, RF-13, D8 |
| 4 | `/register` mais largo e responsivo (sugestão `max-w-2xl`). | RF-06 |
| 5 | Volume sai dos formulários e da API; dados antigos não são alterados. | RF-07, RN-05, RNF-01 |
| 6 | Região/carteira sai do formulário do consultor; API deixa de exigir `business_name` do consultor e continua exigindo do especialista. | RF-08, RF-12, RN-06, RN-07, D6 |
| 7 | Busca por nome do especialista ou da clínica; só consultor ativo ou system_admin; mínimo de caracteres; limite; mesmo formato; inativas continuam fora; recomendar implementação e origem do nome. | RF-14 a RF-20, RN-09 a RN-11, D3, D4, D5, D9 |

### 4.5 Decisões resolvidas (16/10/2026)

Todas respondidas pelo usuário em 16/10/2026, via coordenador, pela **opção recomendada**. Não há `⚠️ Decisão necessária` em aberto. As alternativas descartadas ficam só como referência e **não devem ser implementadas**.

| ID | Pergunta | Decisão | Onde está refletida |
|---|---|---|---|
| D1 | Onde checar a duplicidade de CPF/CNPJ | **A:** na **aprovação**, nas duas rotas (system_admin e consultor), bloqueando com **409**. Tenant **inativo** também bloqueia, e o campo legado `cnpj` também é considerado. Solicitação sem documento não é checada. Descartadas: só avisar (B) e checar na solicitação pública (C). | RF-11, RN-08, 6.3 (`assertDocumentAvailable`), STEP 3, STEP 12 passo 20, 8.2 |
| D2 | CNPJ alfanumérico | **A:** só CNPJ **numérico** nesta task. O alfanumérico fica registrado como **débito técnico** (task própria, cobrindo registro, aprovação, admin, setup e busca). | RN-02, 4.3, STEP 1, 9 (mapa) |
| D3 | Origem do "nome do especialista" | **A:** `users` do tenant com `role == 'clinic_admin'` e ativos (`active !== false`), pelo `full_name` (ou `displayName`). `clinic_user` **não** entra. | RF-16, RN-10, 6.3, STEP 8 |
| D4 | Implementação da busca por nome | **A:** filtro **em memória, no servidor** (Admin SDK). Sem campo novo, backfill, índice ou rule. Confirmada pelo volume de V2. | 4.1 (item 5), RNF-04, RNF-05, 6.3, STEP 8 |
| D5 | Limites e privacidade da busca por nome | (a) mínimo de **3** caracteres sem espaço; (b) no máximo **20** resultados, ordenados por nome, com `truncated` e o aviso "Mostrando os 20 primeiros resultados. Refine a busca."; (c) **mesmo formato** da busca por documento, **com** e-mail e documento; (d) **inclui** clínicas que já têm consultor; (e) **não** mostra qual especialista casou com o termo. | RF-16, RF-17, RF-18, 6.2, STEP 7 |
| D6 | Nome do tenant de consultor aprovado sem `business_name` | **A:** `full_name` do solicitante (também no `businessName` dos e-mails e no diálogo do consultor). | RF-12, RN-07, 6.3, STEP 3 |
| D7 | Fechar a criação de `access_requests` pelo client | **A:** a API grava pelo **Admin SDK** e a rule passa a `allow create: if false`. A rule é publicada manualmente **só depois** que o hosting de produção estiver no ar (Seção 5.6). | F1, RNF-03, 5.6, 6.3, 6.5, STEP 2, STEP 10, 8.3, 10 |
| D8 | Textos do conselho | Placeholder **"Ex.: CRM-SP 142337 ou CRO-RJ 5678"**; rótulo **"Nº do conselho:"** nas listas de `/admin/access-requests` e `/consultant/access-requests`. | RF-05, RF-13, 6.6, STEP 4, STEP 5, STEP 6 |
| D9 | Clínica que já é do próprio consultor nos resultados | **A:** card com "Você já é o consultor desta clínica", **sem botão** (só no client). | RF-20, STEP 9, STEP 12 passo 23 |

**Verificações feitas em produção (somente leitura, 16/10/2026, pelo usuário):**
- **V1:** cliente real **"Clínica Linda Mello"** (tenant criado em 16/10/2026): `document_number` **vazio**, `onboarding_completed` **ausente** (onboarding não concluído) e **já tem consultor** vinculado. Consequências:
  - a busca por **nome** encontra a clínica no primeiro deploy (D4-A);
  - pela busca por **documento** ela só é encontrada depois que o documento for preenchido;
  - na busca, o card mostra o consultor atual (ou "Você já é o consultor desta clínica" para ele mesmo, D9-A).
- **V2:** **4 tenants**, todos ativos, **2 sem documento** ("Clínica Linda Mello" e "Clínica GScandelari"); **6 users**, dos quais **4 `clinic_admin` ativos**. Cada busca por nome lê hoje cerca de 8 documentos, muito abaixo do gatilho de revisão de RNF-05 (~1.000). O volume confirma D4-A.

**Passo manual opcional, depois do deploy (sem migração nem script):** o system_admin pode preencher o CPF/CNPJ dos tenants sem documento ("Clínica Linda Mello" e "Clínica GScandelari") pela tela `/admin/tenants/[id]`, que já valida e grava o documento. Isso não é pré-requisito da task e não é feito por código (RNF-01). A alternativa natural para o cliente real é concluir o onboarding em `/clinic/setup`, que também exige o documento.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `src/lib/accessRequestPayload.ts` | Lib pura | `validateAccessRequestInput`, `getAccessRequestBusinessName`, mensagens (`DOCUMENT_REQUIRED_ERROR`, etc.). |
| `src/lib/clinicSearch.ts` | Lib pura | `MIN_NAME_QUERY_LENGTH`, `MAX_NAME_RESULTS`, `normalizeSearchText`, `classifyClinicSearchQuery`, `filterTenantsByName`. |
| `src/lib/services/tenantSearchServer.ts` | Serviço server-only (Admin SDK) | `searchActiveTenantsByDocument`, `searchActiveTenantsByName`. |
| `src/__tests__/accessRequestPayload.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/clinicSearch.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/accessRequestsRoute.test.ts` | Jest | Seção 8.2. |
| `src/__tests__/accessRequestApproval.test.ts` | Jest | Seção 8.2 (duplicidade e nome do tenant). |
| `src/__tests__/tenantSearchRoute.test.ts` | Jest | Seção 8.2. |
| `tests/rules/access-requests.test.ts` *(ou novo `describe` no arquivo existente)* | Rules | Seção 8.3 (D7-A). |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `src/app/api/access-requests/route.ts` | Usa `validateAccessRequestInput`; monta o registro por lista branca; documento do especialista; sem `volume`; `business_name` só do especialista; comentário do cabeçalho; grava com Admin SDK (D7-A) e remove `initializeApp`, `getFirestore` e `connectFirestoreEmulator`. |
| `src/lib/services/accessRequestApproval.ts` | `getAccessRequestBusinessName` no nome do tenant, no log, no e-mail e no retorno; `assertDocumentAvailable` (D1-A) antes de `tenants.add()` e o erro novo `DocumentAlreadyInUseError`. |
| `src/lib/services/accessRequestRouteHelpers.ts` | `checkActiveConsultant` (extraída de `verifyActiveConsultant`, sem mudar o comportamento); `approveAccessRequestResponse` traduz `DocumentAlreadyInUseError` → 409. |
| `src/app/api/access-requests/[id]/reject/route.ts` | `businessName` e `business_name` da resposta via `getAccessRequestBusinessName`. |
| `src/app/api/consultants/me/pending-access-requests/route.ts` | Sem `volume`; `business_name: request.business_name ?? null`. |
| `src/types/index.ts` | `AccessRequest.business_name?` (opcional, com comentário); `volume?` marcado como legado ("não é mais gravado"); comentário do documento; comentário de `council_number`. |
| `src/app/(admin)/admin/access-requests/page.tsx` | Coluna "Negócio": `business_name` ou "—", conselho **e** documento (fim do ternário); rótulo conforme D8. |
| `src/app/(consultant)/consultant/access-requests/page.tsx` | Interface sem `volume`; `business_name` opcional; "Clínica:" só com valor; legado "Região / carteira:" só para consultor com valor; diálogo com `getAccessRequestBusinessName`; rótulo conforme D8. |
| `src/app/(auth)/register/page.tsx` | Documento (seletor + máscara + validação), rótulo/placeholder/erro do conselho, consultor sem região, sem volume, `max-w-2xl`, grades responsivas, usa `validateAccessRequestInput` antes do envio. |
| `public/landing/sections-cta.jsx` | Documento (seletor + máscara + tamanho), `consultant_code` no lugar de `consultant_reference`, rótulo e placeholder do conselho, consultor sem região, sem volume. |
| `src/app/route.ts` | `?v=AAAAMMDD` nos 8 `<script type="text/babel">`. |
| `public/landing/index.html` | Mesma versão nos `<script>` (cópia de referência). |
| `src/app/api/tenants/search/route.ts` | Guarda nova (RF-14), parâmetro `q` (com `document` como sinônimo), classificação, busca por nome, `truncated`, `Cache-Control: no-store`. |
| `src/app/(consultant)/consultant/clinics/search/page.tsx` | Campo único, máscara condicional, Enter, textos, `truncated`, D9. |
| `firestore.rules` | `access_requests` → `allow create: if false;` com comentário (D7-A). Publicação em produção só depois do hosting (Seção 5.6). |
| `tests/e2e/UC-01-solicitar-acesso-ao-sistema.spec.ts` | Documento, sem volume, sem região do consultor, novos rótulos (STEP 11). |
| `src/lib/services/consultantService.ts` | Só o JSDoc de `searchTenantsByDocument` (client SDK; nenhuma tela o usa): nota de que a busca da tela é a rota. Opcional. |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---|---|
| — | Nenhum. |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| `access_requests` | Formato de **novos** documentos | Especialista: + `document_type`, `document_number` (dígitos); − `volume`. Consultor: − `business_name`, − `volume`. **Documentos existentes: nenhuma alteração.** Rule: `create: if false` (D7-A); leitura, update e delete continuam só do system_admin. Sem índice novo. |
| `tenants` | Leitura (Admin SDK) | Busca por nome lê `where('active','==',true)`. Aprovação (D1-A) lê `where('document_number','==',X).limit(1)` e `where('cnpj','==',X).limit(1)`. **Nenhum campo novo e nenhuma escrita nova.** Novos tenants recebem o documento da solicitação (campo já existente). |
| `users` | Leitura (Admin SDK) | Busca por nome lê `where('role','==','clinic_admin')`. Sem escrita nova. |
| `consultants` | Leitura (Admin SDK) | Guarda da busca lê `consultants/{consultant_id}` (como UC-56). |
| `firestore.indexes.json` | — | **Inalterado.** Todas as consultas novas são de igualdade em um campo, ou já existem (`document_number` + `active`). |

**Multi-tenant:**
- A busca não tem `tenant_id` no token (o consultor não tem tenant). O acesso é controlado pelo papel (consultor ativo ou system_admin ativo) e só no servidor.
- Nenhuma rule de leitura de `tenants` ou `users` é aberta para o consultor.
- A resposta tem só os campos públicos de cadastro já devolvidos hoje pela busca por documento.
- A aprovação continua escrevendo só no tenant recém-criado.

### 5.5 O que NÃO muda

- `functions/src/*`, incluindo `onAccessRequestCreated` (já usa `document_number` e `business_name || fullName`), o digest do UC-57 e `sendAccessRejectionEmail`. **Nenhum deploy de function é necessário.**
- `firestore.indexes.json` e `storage.rules`. Em `firestore.rules`, só o `create` de `access_requests` muda (D7-A).
- `POST /api/consultants/claims` (vínculo e transferência; F6 vai para o mapa).
- `/admin/tenants/[id]`, `/admin/tenants/new`, `/clinic/setup` (UC-45): continuam como estão. O setup passa a vir pré-preenchido com o documento informado no registro.
- `max_users` na aprovação (por `role`, UC-02 RN-02).
- A janela de exclusividade e a elegibilidade do UC-56 (`canConsultantApprove`).
- `accessRequestService.createAccessRequest` (código morto) e `rejectAccessRequest`.
- Os dados existentes de `access_requests`, `tenants` e `users` em produção.
- `CLAUDE.md`.

### 5.6 Impacto em produção (cliente real) e ordem segura de deploy

**Impacto nos dados e no uso atual**

| Quem / o quê | Efeito | Risco |
|---|---|---|
| Cliente real (clinic_admin e usuários) | Nenhuma tela da clínica muda. O tenant não é alterado. | Nenhum. |
| Tenant do cliente real ("Clínica Linda Mello") | Não é alterado. Passa a ser encontrado pela busca por nome no primeiro deploy (D4-A). Pela busca por documento, só depois que o documento for preenchido (V1: hoje vazio; ver o passo manual opcional abaixo). Já tem consultor, então a busca mostra o consultor atual. | Nenhum. |
| Solicitações pendentes em produção | Continuam aprováveis. Sem documento, o tenant nasce com `''` (como hoje). Uma solicitação de consultor antiga com região usa a região como nome (como hoje). | Nenhum. |
| Solicitações antigas com `volume` | Ficam como estão. O campo deixa de ser lido pelas telas. | Nenhum. |
| Visitante com landing em cache | Se o JSX antigo estiver em cache, o envio de especialista recebe 400 "CPF ou CNPJ é obrigatório". O `?v=` no HTML dinâmico elimina isso no carregamento seguinte. Uma aba aberta desde antes do deploy precisa de recarga. | Baixo; a mensagem é clara. |
| Visitante em `/register` aberto antes do deploy | Mesmo caso: 400 com mensagem; recarregar resolve. | Baixo. |
| Consultor suspenso com sessão aberta | Passa a receber 403 na busca (F5, intencional). | Intencional. |

**Ordem de deploy (obrigatória — hosting primeiro, rule depois)**

1. Merge em `gscandelari_setup`: o workflow de dev publica hosting, rules e índices em `curva-mestra-dev` no mesmo comando. Em dev, uma janela de segundos com a rule nova e o hosting antigo é aceitável.
2. Validação em `dev-gscandelari.web.app` (STEP 12, Roteiro H), incluindo a rule nova publicada em dev.
3. Merge em `master`: o workflow publica **só** `hosting:curva-mestra` e `functions` (functions sem mudança). Neste momento a rule de produção **ainda é a antiga** (`allow create: if true`), e a API nova (Admin SDK) funciona com ela.
4. Conferir em produção que a API nova está no ar (STEP 12, passo 37): enviar uma solicitação de teste de especialista pela landing, ver o documento gravado com `document_type`/`document_number` só com dígitos e sem `volume`, e rejeitá-la em seguida.
5. **Só então** o usuário publica manualmente a rule:
   ```bash
   firebase deploy --only firestore:rules --project curva-mestra
   ```
   Os índices não mudam; publicar `firestore:indexes` junto é inofensivo.
6. Depois da rule, repetir o envio de teste pela landing (deve funcionar) e rejeitá-lo.
7. **Nunca na ordem inversa.** Se a rule `create: if false` entrar antes do hosting novo, a API antiga (que grava pelo client SDK) recebe `PERMISSION_DENIED` e **todas** as solicitações de acesso falham até o hosting subir.
8. **Rollback:**
   - se for preciso voltar o hosting (versão anterior no console do Firebase Hosting) **depois** de publicada a rule, **primeiro** republique a rule anterior (`allow create: if true`) a partir do `master` anterior; senão o formulário para de funcionar;
   - voltar só a rule é sempre seguro, porque a API nova grava com Admin SDK.

**Passo manual opcional, depois do deploy:** o system_admin preenche, em `/admin/tenants/[id]`, o documento de "Clínica Linda Mello" e de "Clínica GScandelari" (V2). Não há migração nem script.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**`AccessRequest` (`src/types/index.ts`) — antes:**
```ts
  // Número de conselho profissional ou ID Rennova
  council_number: string; // CRM/CRO para especialistas, ID Rennova para consultores

  // Dados da empresa/pessoa
  business_name: string; // Nome da clínica (especialista) ou região/carteira (consultor)
  ...
  volume?: string; // Volume de procedimentos por mês (especialista)

  // Documento — opcional desde nova versão do formulário
  document_type?: DocumentType; // cpf ou cnpj
  document_number?: string; // CPF ou CNPJ sem formatação
```

**Depois:**
```ts
  // Número do conselho profissional (especialista) ou ID Rennova (consultor)
  council_number: string;

  /**
   * Nome da clínica — obrigatório e gravado só para especialista.
   * Ausente nas solicitações de consultor criadas a partir de
   * FEAT-ajustes-registro-e-busca-consultor; solicitações de consultor antigas
   * podem ter a "região / carteira" aqui (legado, não alterado).
   * Use getAccessRequestBusinessName() para exibir/derivar o nome do tenant.
   */
  business_name?: string;
  ...
  /** Legado — não é mais gravado (FEAT-ajustes-registro-e-busca-consultor); solicitações antigas podem ter */
  volume?: string;

  /**
   * Documento do especialista — obrigatório para role 'especialista' desde
   * FEAT-ajustes-registro-e-busca-consultor (só dígitos: 11 CPF / 14 CNPJ).
   * Ausente em solicitações antigas e em solicitações de consultor.
   */
  document_type?: DocumentType;
  document_number?: string;
```

Nenhum campo de `Tenant` muda.

**Resposta da busca (`src/lib/services/tenantSearchServer.ts`, a criar):**
```ts
export interface TenantSearchResult {
  id: string;
  name: string;
  document_type?: DocumentType;
  document_number?: string;
  email?: string;
  consultant_id: string | null;
  consultant_name: string | null;
}

// GET /api/tenants/search → 200
interface TenantSearchResponse {
  success: true;
  data: TenantSearchResult[];
  truncated: boolean; // sempre false na busca por documento
}
```

### 6.2 Funções puras

**`src/lib/accessRequestPayload.ts` (a criar)**
```ts
export const DOCUMENT_REQUIRED_ERROR = 'CPF ou CNPJ é obrigatório';
export const DOCUMENT_TYPE_ERROR = "Tipo de documento deve ser 'cpf' ou 'cnpj'";
export const COUNCIL_REQUIRED_ERROR = 'Número do conselho é obrigatório';
export const RENNOVA_ID_REQUIRED_ERROR = 'ID Rennova é obrigatório';
export const BUSINESS_NAME_REQUIRED_ERROR = 'Nome da clínica é obrigatório';

export interface NormalizedAccessRequestInput {
  role: AccessRequestRole;
  full_name: string;        // trim
  email: string;            // trim + lowercase
  phone: string;            // como recebido (trim)
  council_number: string;   // trim
  business_name?: string;   // só especialista (trim)
  document_type?: DocumentType;  // só especialista
  document_number?: string;      // só especialista, só dígitos
  consultant_code?: string;      // só especialista, se informado (formato já validado)
}

export type AccessRequestInputResult =
  | { ok: true; value: NormalizedAccessRequestInput }
  | { ok: false; error: string };

export function validateAccessRequestInput(data: unknown): AccessRequestInputResult;
export function getAccessRequestBusinessName(
  request: Pick<AccessRequest, 'business_name' | 'full_name'>
): string;
```

Ordem de validação de `validateAccessRequestInput`. A primeira falha devolve o erro. Os textos 1-4 são os atuais:
1. `role` ausente → "Perfil (especialista / consultor) é obrigatório"; fora de `especialista`/`consultor` → "Perfil deve ser 'especialista' ou 'consultor'".
2. `full_name` ausente → "Nome completo é obrigatório"; senão `validateFullName`.
3. `email` → `validateEmail`.
4. `phone` → `validatePhone`.
5. `council_number` vazio (depois de `trim`) → `COUNCIL_REQUIRED_ERROR` (especialista) ou `RENNOVA_ID_REQUIRED_ERROR` (consultor).
6. Só especialista:
   - `business_name` vazio → `BUSINESS_NAME_REQUIRED_ERROR`;
   - `document_number` vazio (sem dígitos) → `DOCUMENT_REQUIRED_ERROR`;
   - `document_type` fora de `cpf`/`cnpj` → `DOCUMENT_TYPE_ERROR`;
   - `validateDocument(dígitos, type)` de `serverValidations` → erro da função;
   - `consultant_code` com texto → `validateConsultantCode` (erro `INVALID_CONSULTANT_CODE_ERROR`).
7. Campos não listados (`volume`, `consultant_reference`, e para o consultor `business_name`, `document_*` e `consultant_code`) são ignorados, sem erro.

A existência do consultor do código **não** é verificada aqui (é I/O); continua na rota.

`getAccessRequestBusinessName`: `request.business_name?.trim() || request.full_name`.

**`src/lib/clinicSearch.ts` (a criar)**
```ts
export const MIN_NAME_QUERY_LENGTH = 3;   // D5 (a)
export const MAX_NAME_RESULTS = 20;       // D5 (b)
export const SEARCH_QUERY_INVALID_ERROR =
  'Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome';
export const NAME_QUERY_TOO_SHORT_ERROR =
  'Digite ao menos 3 letras do nome da clínica ou do especialista';

/** minúsculas, NFD sem diacríticos, espaços colapsados, trim */
export function normalizeSearchText(raw: string): string;

export type ClinicSearchQuery =
  | { kind: 'document'; document: string }   // só dígitos, 11 ou 14
  | { kind: 'name'; term: string }           // normalizado
  | { kind: 'invalid'; error: string };

export function classifyClinicSearchQuery(raw: string | null | undefined): ClinicSearchQuery;

export interface NameSearchCandidate {
  id: string;
  name: string;
  specialistNames: string[];
}

export function filterTenantsByName<T extends NameSearchCandidate>(
  candidates: T[],
  term: string,               // já normalizado
  limit?: number              // padrão MAX_NAME_RESULTS
): { matches: T[]; truncated: boolean };
```

Regras:
- **"Tem letra":** `/\p{L}/u` no texto cru.
- **Tamanho do termo:** contado sem espaços no texto normalizado.
- **Casamento:** `tokens = term.split(' ')`; o candidato casa se `tokens.every(t => normalizedName.includes(t))` ou se, para algum especialista, `tokens.every(t => normalizedSpecialist.includes(t))`.
- **Ordenação:** por `normalizeSearchText(name)` e, em empate, por `id`.
- **Limite:** `truncated = total > limit`.

### 6.3 Serviços server-only

**`src/lib/services/accessRequestApproval.ts`**
```ts
/** Já existe tenant com este documento (D1-A) */
export class DocumentAlreadyInUseError extends Error {
  constructor() {
    super('Já existe uma clínica cadastrada com este CPF/CNPJ. Verifique com o solicitante antes de aprovar.');
    this.name = 'DocumentAlreadyInUseError';
  }
}

async function assertDocumentAvailable(documentNumber: string | undefined): Promise<void>;
// vazio → retorna sem ler; senão consulta tenants por document_number e por cnpj (limit 1 cada);
// encontrou → throw new DocumentAlreadyInUseError()
```

Em `createTenantAndUserFromAccessRequest`:
- chamar `assertDocumentAvailable(request.document_number)` **antes** de `resolveLinkedConsultant` e de qualquer escrita;
- `const businessName = getAccessRequestBusinessName(request)` em `name`, no `console.log`, em `businessName` do e-mail e em `business_name` do retorno.

**`src/lib/services/accessRequestRouteHelpers.ts`**
- `export async function checkActiveConsultant(decodedToken: DecodedIdToken, deniedMessage: string): Promise<ActiveConsultant | NextResponse>`: o corpo atual de `verifyActiveConsultant`, a partir de `const denied = …`.
- `verifyActiveConsultant` passa a ser `verifyBearerToken` + `checkActiveConsultant`. A assinatura e o comportamento ficam iguais.
- `approveAccessRequestResponse`: `DocumentAlreadyInUseError` → `NextResponse.json({ error: e.message }, { status: 409 })`.

**`src/lib/services/tenantSearchServer.ts` (a criar)**
```ts
export async function searchActiveTenantsByDocument(document: string): Promise<TenantSearchResult[]>;
// mesma consulta de hoje: tenants where document_number == document && active == true

export async function searchActiveTenantsByName(
  term: string
): Promise<{ data: TenantSearchResult[]; truncated: boolean }>;
// 1. tenants where active == true (get)
// 2. users where role == 'clinic_admin' (get) → filtra active !== false → Map<tenant_id, string[]>
//    com full_name ?? displayName
// 3. filterTenantsByName(candidatos, term) → mapeia para TenantSearchResult
```

`POST /api/access-requests` grava (D7-A) com `adminDb.collection('access_requests').add({...registro, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp()})`. O `id` da resposta é `ref.id`.

### 6.4 API Routes

**`POST /api/access-requests`** (pública; sem mudança de autenticação)
- Request body:
  ```ts
  {
    role: 'especialista' | 'consultor';
    full_name: string; email: string; phone: string; council_number: string;
    business_name?: string;                 // obrigatório p/ especialista; ignorado p/ consultor
    document_type?: 'cpf' | 'cnpj';         // obrigatório p/ especialista; ignorado p/ consultor
    document_number?: string;               // idem; aceita máscara
    consultant_code?: string;               // opcional, só especialista
    // volume, consultant_reference: ignorados
  }
  ```
- Fluxo:
  1. `registration_enabled === false` → 403 (como hoje).
  2. `validateAccessRequestInput` → 400 `{ error }`.
  3. Pendência do mesmo e-mail → 409 (como hoje).
  4. Código do consultor inexistente ou inativo → 400 (como hoje).
  5. Grava o registro.
- Registro gravado:
  ```ts
  {
    role, type /* legado */, full_name, email, phone, council_number,
    consultant_code: string | null, consultant_id: string | null,
    status: 'pendente', created_at, updated_at,
    // só especialista:
    business_name, document_type, document_number,
  }
  ```
- Response 200: `{ success: true, message: 'Solicitação enviada com sucesso!', id }` (inalterada).

**`POST /api/access-requests/[id]/approve` e `.../approve-consultant`**
- Sem mudança de autenticação.
- Nova resposta **409** `{ error: 'Já existe uma clínica cadastrada com este CPF/CNPJ. Verifique com o solicitante antes de aprovar.' }` (D1-A).
- A 200 tem `data.business_name` = nome efetivo do tenant.

**`GET /api/tenants/search`**
- Autenticação: `Authorization: Bearer`.
  - System_admin: `is_system_admin === true && active === true`.
  - Consultor: `checkActiveConsultant(decoded, 'Acesso restrito a consultores ativos')`.
  - Outros → 403. Sem token ou token inválido → 401.
- Query: `q` (ou `document`, como sinônimo).
  - `classifyClinicSearchQuery`; `invalid` → 400 `{ error }`.
  - `document` → `searchActiveTenantsByDocument`, `truncated: false`.
  - `name` → `searchActiveTenantsByName`.
- Response 200: `TenantSearchResponse`, com header `Cache-Control: no-store`.
- Erro: 500 `{ error: 'Erro ao buscar clínicas' }`. O `console.error` registra só o erro, nunca o termo.

### 6.5 Rules (D7-A)

```js
match /access_requests/{requestId} {
  // Criação só pelo servidor (POST /api/access-requests, Admin SDK) —
  // FEAT-ajustes-registro-e-busca-consultor (F1). Antes era `if true`, e
  // qualquer visitante podia gravar sem a validação da API (documento etc.).
  allow create: if false;

  // Apenas system_admin pode ler, atualizar e deletar
  allow read, update, delete: if isSystemAdmin();
}
```

### 6.6 Mudanças na UI

**`/register`**

| Hoje | Novo |
|---|---|
| `Card` `max-w-lg` | `max-w-2xl` |
| Grades `grid-cols-2` | `grid-cols-1 sm:grid-cols-2` (o seletor de perfil continua `grid-cols-2`) |
| "CRM / CRO / nº conselho \*" / placeholder "Ex.: CRM-SP 142337" | "Número do conselho \*" / placeholder "Ex.: CRM-SP 142337 ou CRO-RJ 5678" (D8) |
| Erro "Número de conselho (CRM/CRO) é obrigatório" | "Número do conselho é obrigatório" |
| Consultor: "Região / carteira \*" | Campo some; telefone ocupa a linha inteira |
| — | Especialista: linha "CPF ou CNPJ \*" com seletor de dois botões (CNPJ, CPF; padrão CNPJ), no mesmo estilo dos botões de perfil, e `Input id="documentNumber"` com `maskCNPJ`/`maskCPF`, `inputMode="numeric"`, `font-mono`, placeholder `00.000.000/0000-00` ou `000.000.000-00` |
| Volume de procedimentos | Removido |

Ordem dos campos do especialista: Perfil → [Nome completo | Número do conselho] → E-mail → [Telefone | Nome da clínica] → CPF ou CNPJ → Código do consultor (opcional).
Ordem dos campos do consultor: Perfil → [Nome completo | ID Rennova] → E-mail → Telefone.

O submit chama `validateAccessRequestInput` com o corpo montado e mostra o primeiro erro no `Alert` atual. O corpo envia `document_type` e `document_number` (com máscara; a API limpa) só para especialista. O reset de sucesso limpa o documento e volta o tipo para CNPJ.

**Landing (`sections-cta.jsx`)**

| Hoje | Novo |
|---|---|
| "CRM / CRO / nº conselho" | "Número do conselho" (os rótulos da landing não têm asterisco) |
| "Consultor Rennova de referência (opcional)" + texto livre | "Código do consultor Rennova (opcional)" + só dígitos, `maxLength={6}`, `inputMode="numeric"`, `inputStyleMono`, dica "Código de 6 dígitos informado pelo seu consultor Rennova." |
| Volume (chips) | Removido |
| Consultor: "Região / carteira" | Removido; telefone com `gridColumn: "1 / -1"` |
| — | Especialista: "CPF ou CNPJ", seletor de 2 chips (mesmo estilo dos antigos chips de volume) e input mono com máscara local; antes do `fetch`: tamanho 14/11 → "CNPJ deve ter 14 dígitos" / "CPF deve ter 11 dígitos" em `apiError`; código preenchido e diferente de `^\d{6}$` → "Código de consultor inválido ou inativo" |

`src/app/route.ts` e `public/landing/index.html`: `src="sections-cta.jsx?v=AAAAMMDD"` (e igual nos outros 7 `.jsx`, para não misturar versões).

**`/admin/access-requests`**, coluna "Negócio":
```
{business_name ?? '—'}
{Nº do conselho|Conselho / ID Rennova}: {council_number}     ← se houver
{CPF|CNPJ}: {formatDocumentAuto(document_number)}            ← se houver (independente do conselho)
```

**`/consultant/access-requests`**
- Linha "Clínica:" só para especialista com `business_name`.
- Linha "Região / carteira:" só para consultor com `business_name` (legado).
- Diálogo: `Será criada a clínica "${getAccessRequestBusinessName(target)}" …`.

**`/consultant/clinics/search`:** conforme RF-18 e RF-20.
- Estado `query` (texto) no lugar de `document`.
- `onChange`: se `/\p{L}/u.test(valor)`, guarda cru; senão, aplica `formatDocument` atual.
- `handleSearch`: `classifyClinicSearchQuery(query)`; `invalid` → toast destrutivo com a mensagem; senão `fetch('/api/tenants/search?q=' + encodeURIComponent(query))`.
- O estado `lastKind` define o texto de "nenhum resultado".
- `data.truncated` mostra o aviso.

---

## 7. Plano de Implementação

### STEP 1 — Validação pura da solicitação

**Objetivo:** Ter `validateAccessRequestInput` e `getAccessRequestBusinessName` testadas, sem mudar nenhum comportamento ainda.

**Arquivos afetados:**
- `src/lib/accessRequestPayload.ts` — criar (Seção 6.2).
- `src/__tests__/accessRequestPayload.test.ts` — criar (Seção 8.1).

**Ações:**
1. Implementar as constantes e as duas funções, importando `validateFullName`, `validateEmail`, `validatePhone`, `validateDocument` e `validateConsultantCode` de `@/lib/validations/serverValidations`.
2. CNPJ só numérico (D2-A): **não** usar `isValidCnpj`/`normalizeCnpj` de `@/lib/nfIdentity` neste fluxo.
3. Escrever os testes.

**Validação:** `npm run test -- accessRequestPayload` verde; `npm run type-check` sem erros.

**Commits:** `feat(auth): add pure access request payload validation with CPF/CNPJ` · `test(auth): cover access request payload validation`

---

### STEP 2 — API de solicitação

**Objetivo:** `POST /api/access-requests` passa a exigir o documento do especialista, deixa de gravar `volume` e de exigir `business_name` do consultor.

**Arquivos afetados:**
- `src/app/api/access-requests/route.ts`
- `src/__tests__/accessRequestsRoute.test.ts` — criar.

**Ações:**
1. Trocar o bloco `requiredFields` e as validações soltas por `validateAccessRequestInput`, mantendo a ordem: `registration_enabled` → validação → pendência por e-mail → código do consultor → gravação.
2. Montar o registro só com o valor normalizado (Seção 6.4).
3. Gravar (D7-A) com `adminDb.collection('access_requests').add(...)` + `FieldValue.serverTimestamp()`, e remover `firebaseConfig`, `initializeApp`, `getFirestore`, `connectFirestoreEmulator` e o bloco do emulador (o Admin SDK já respeita `FIRESTORE_EMULATOR_HOST`; confirmar no e2e).
4. Atualizar o comentário do cabeçalho (campos por perfil; volume removido).
5. Escrever os testes da rota.

**Validação:** testes verdes. No emulador, `curl` com especialista sem documento → 400 "CPF ou CNPJ é obrigatório"; consultor sem `business_name` → 200, e o documento no Emulator UI não tem `business_name`, `volume` nem `document_*`.

**Commits:** `feat(api): require specialist document and drop volume in access requests` · `test(api): cover access request creation route`

---

### STEP 3 — Aprovação: duplicidade e nome do tenant

**Objetivo:** A aprovação usa o nome efetivo (D6) e bloqueia documento duplicado (D1).

**Arquivos afetados:**
- `src/lib/services/accessRequestApproval.ts`
- `src/lib/services/accessRequestRouteHelpers.ts`
- `src/app/api/access-requests/[id]/reject/route.ts`
- `src/__tests__/accessRequestApproval.test.ts` — criar.

**Ações:**
1. `DocumentAlreadyInUseError` + `assertDocumentAvailable` (D1-A): bloqueia com 409, considera tenants ativos e inativos e os campos `document_number` e `cnpj`.
2. `getAccessRequestBusinessName` em todos os usos de `request.business_name` da cadeia e da rota `/reject`.
3. `approveAccessRequestResponse` → 409 para `DocumentAlreadyInUseError`.
4. Extrair `checkActiveConsultant` (usado no STEP 8), sem mudar `verifyActiveConsultant`.

**Validação:** testes verdes. No emulador, aprovar uma solicitação com o CNPJ `11111111000191` (o de `test-clinic-a` no seed) → 409, e nenhum tenant nem usuário Auth novo é criado. Aprovar uma solicitação de consultor sem `business_name` → tenant com `name = full_name`.

**Commits:** `feat(api): block duplicate document and name consultant tenants on approval` · `test(api): cover duplicate document check on access request approval`

---

### STEP 4 — Tipos e telas de solicitações

**Objetivo:** Tipos coerentes e listas exibindo documento e conselho, sem volume.

**Arquivos afetados:**
- `src/types/index.ts`
- `src/app/(admin)/admin/access-requests/page.tsx`
- `src/app/(consultant)/consultant/access-requests/page.tsx`
- `src/app/api/consultants/me/pending-access-requests/route.ts`

**Ações:**
1. Aplicar a Seção 6.1 em `AccessRequest` e corrigir os erros de tipo que aparecerem.
2. Admin: substituir o ternário (l. 280-290) por duas linhas independentes; `business_name ?? '—'`; rótulo "Nº do conselho:" (D8).
3. Consultor: remover `volume` da interface; tornar `business_name` opcional; aplicar as linhas condicionais e o diálogo (Seção 6.6); rótulo "Nº do conselho:" (D8).
4. API do consultor: remover `volume`; `business_name: request.business_name ?? null`.

**Validação:** `npm run type-check` e `npm run lint` limpos. `git grep -n "volume" src/` só encontra o comentário de legado em `types/index.ts`.

**Commit:** `feat(admin): show document and council number in access request lists`

---

### STEP 5 — `/register`

**Objetivo:** Formulário com documento, rótulos novos, sem volume nem região do consultor, mais largo e responsivo.

**Arquivos afetados:**
- `src/app/(auth)/register/page.tsx`

**Ações:**
1. Estado `documentType: DocumentType` (`'cnpj'`) e campo `documentNumber`. `handleChange` aplica `maskCNPJ`/`maskCPF` (de `@/lib/utils/documentValidation`) para `id === 'documentNumber'`.
2. Remover `VOLUME_OPTIONS`, `volume`, `setVolume`, o bloco de chips e `body.volume`.
3. Consultor: não renderizar `businessName` nem enviá-lo.
4. Rótulo, placeholder e erro do conselho (RF-05, D8).
5. `max-w-2xl`; grades `grid-cols-1 sm:grid-cols-2`.
6. Validar com `validateAccessRequestInput` antes do `fetch` (as validações de 3 caracteres atuais podem ficar; não contradizem a função pura).
7. Atualizar o comentário da l. 40.

**Validação:** `npm run dev`, com o Roteiro A do STEP 12 (passos 1-6) em 375 px e em 1280 px.

**Commit:** `feat(auth): collect CPF/CNPJ and widen register form`

---

### STEP 6 — Landing

**Objetivo:** A landing igual a `/register` em campos e envio, sem servir JSX antigo.

**Arquivos afetados:**
- `public/landing/sections-cta.jsx`
- `src/app/route.ts`
- `public/landing/index.html`

**Ações:**
1. Estados `docType` (`"cnpj"`), `fields.documentNumber`, `fields.consultantCode`; remover `volume` e `consultantReference`.
2. Funções locais `maskDoc(value, type)` e `onlyDigits(value)`, e a validação pré-envio (Seção 6.6).
3. Corpo: `consultant_code` (se preenchido) e `document_type`/`document_number` só para especialista; `business_name` só para especialista.
4. Rótulo e placeholder do conselho; remover o bloco de volume; consultor sem região.
5. `?v=AAAAMMDD` nos 8 `<script type="text/babel">` de `route.ts` e de `index.html` (mesmo valor nos dois).

**Validação:** `npm run dev` → `http://localhost:3000/#acesso`, Roteiro B do STEP 12. `curl -s http://localhost:3000/ | grep "sections-cta.jsx?v="` mostra a versão.

**Commit:** `feat(ui): align landing access form with register form`

---

### STEP 7 — Funções puras da busca

**Objetivo:** Classificação da consulta e casamento por nome testados.

**Arquivos afetados:**
- `src/lib/clinicSearch.ts` — criar.
- `src/__tests__/clinicSearch.test.ts` — criar.

**Ações:**
1. Implementar a Seção 6.2 (`clinicSearch`) com os limites de D5.
2. Testes da Seção 8.1.

**Validação:** `npm run test -- clinicSearch` verde.

**Commits:** `feat(api): add pure clinic search query and name matching rules` · `test(api): cover clinic search query and name matching rules`

---

### STEP 8 — Serviço e rota da busca

**Objetivo:** `GET /api/tenants/search` com guarda de consultor ativo, busca por documento (igual a hoje) e por nome.

**Arquivos afetados:**
- `src/lib/services/tenantSearchServer.ts` — criar.
- `src/app/api/tenants/search/route.ts`
- `src/__tests__/tenantSearchRoute.test.ts` — criar.

**Ações:**
1. Serviço conforme a Seção 6.3 (D3/D4).
2. Rota: `verifyBearerToken` → system_admin ativo ou `checkActiveConsultant` → `q ?? document` → `classifyClinicSearchQuery` → serviço → `NextResponse.json({ success: true, data, truncated }, { headers: { 'Cache-Control': 'no-store' } })`.
3. Remover `cleanDocument` local (substituída pela classificação).

**Validação:** testes verdes. No emulador, como `qa.consultant@curvamestra.test`: `?q=teste` → as duas clínicas do seed; `?q=11111111000191` → `test-clinic-a`; `?q=ab` → 400.

**Commits:** `feat(api): search clinics by clinic or specialist name` · `test(api): cover clinic search route`

---

### STEP 9 — Tela "Buscar Clínicas"

**Objetivo:** Campo único de documento ou nome, com textos novos e D9.

**Arquivos afetados:**
- `src/app/(consultant)/consultant/clinics/search/page.tsx`

**Ações:**
1. Aplicar a Seção 6.6 e RF-18.
2. D9-A: `const { claims } = useAuth()`. Se `tenant.consultant_id === claims?.consultant_id`, mostrar `UserCheck` + "Você já é o consultor desta clínica", sem botão.
3. Enter no `Input` chama `handleSearch` (`onKeyDown`).

**Validação:** Roteiro E do STEP 12.

**Commit:** `feat(ui): search clinics by document or name in consultant portal`

---

### STEP 10 — Rule de `access_requests` (D7-A)

**Objetivo:** Fechar a criação de solicitações pelo client.

**Arquivos afetados:**
- `firestore.rules`
- `tests/rules/firestore-tenant-subcollections.test.ts` (novo `describe('access_requests')`) ou `tests/rules/access-requests.test.ts`.

**Ações:**
1. Aplicar a Seção 6.5.
2. Testes da Seção 8.3 (get **e** list).

**Validação:** `npm run test:rules` verde. **Em produção, esta rule só é publicada depois do hosting (Seção 5.6).** `npm run test:e2e` (UC-01, UC-02, UC-03, UC-05 e UC-56) verde: os seeds usam Admin SDK e a criação pela UI passa pela API.

**Commits:** `feat(firebase): deny client-side creation of access requests` · `test(firebase): cover access requests rules for get and list`

---

### STEP 11 — Caderno E2E do UC-01 (gate de CI)

**Objetivo:** Manter `npm run test:e2e` verde com o formulário novo.

**Arquivos afetados:**
- `tests/e2e/UC-01-solicitar-acesso-ao-sistema.spec.ts`

**Ações:**
1. `fillCommonFields`: o campo `businessName` só para especialista; incluir `#documentNumber` (CNPJ válido, ex.: `12.345.678/0001-95`) para especialista.
2. Trocar as verificações de "Volume de procedimentos por mês" e de `volume` por: o texto não existe, `requestBody.volume` é `undefined` e `doc.volume` é `undefined`.
3. Consultor: "Região / carteira \*" e `#businessName` com `toHaveCount(0)`; `doc.business_name` é `undefined`.
4. Especialista: `doc.document_type === 'cnpj'` e `doc.document_number === '12345678000195'`.
5. Novo caso: CNPJ com DV errado → mensagem "CNPJ inválido: dígito verificador incorreto", sem documento criado.
6. Rótulo "Número do conselho \*" visível.
7. Pedir revisão humana do diff do caderno no PR (regra 8 do `CLAUDE.md`).

**Validação:** `npm run test:e2e -- UC-01` verde; depois a suíte completa.

**Commit:** `test(e2e): update UC-01 notebook for document field and removed volume`

---

### STEP 12 — Validação Manual

**Objetivo:** Confirmar as Partes A e B de ponta a ponta. Este roteiro é a **fonte dos cadernos E2E** (`CLAUDE.md`, regra 8). O `qa-agent` (Modo A) gera ou estende `tests/e2e/UC-01-…`, `UC-02-…`, `UC-56-…` e cria os cadernos de busca do UC-24 e do UC-25. Revisão humana obrigatória.

**Pré-requisitos:**
- `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage`, depois `npm run test:e2e:seed` e `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`.
- Seed atual:
  - `test-clinic-a` "Clínica Teste A", CNPJ `11111111000191` (DV válido), consultor `QA Consultant` (código `482913`), `clinic_admin` "QA Clinic Admin A";
  - `test-clinic-b` "Clínica Teste B", CNPJ `22222222000191` (DV válido), sem consultor, `clinic_admin` "QA Clinic Admin B";
  - consultores `qa.consultant@` e `qa.consultant-b@` (`731548`).
- Documentos de teste:
  - CNPJ válido `12.345.678/0001-95`; com DV errado `12.345.678/0001-99`;
  - CPF válido `529.982.247-25`; inválido `111.111.111-11`.

**Roteiro A — `/register` (sempre executar):**
1. Abrir `/register` em 1280 px. **Esperado:** card mais largo (`max-w-2xl`), Especialista selecionado, "Número do conselho \*", "CPF ou CNPJ \*" com CNPJ selecionado, código do consultor e **nenhum** volume.
2. Em 375 px. **Esperado:** campos em uma coluna (o seletor de perfil continua em duas).
3. Enviar sem documento. **Esperado:** "CPF ou CNPJ é obrigatório"; nada gravado.
4. CNPJ `12.345.678/0001-99`. **Esperado:** "CNPJ inválido: dígito verificador incorreto". Trocar para CPF: o campo fica vazio e a máscara passa a `000.000.000-00`; `111.111.111-11` → "CPF inválido: todos os dígitos são iguais".
5. Conselho vazio. **Esperado:** "Número do conselho é obrigatório".
6. Especialista válido com CNPJ `12.345.678/0001-95` e código `482913` → sucesso. **Esperado** no Emulator UI (`access_requests`): `document_type: 'cnpj'`, `document_number: '12345678000195'`, `business_name`, `consultant_code: '482913'` e `consultant_id` preenchidos; **sem** `volume`.
7. Perfil Consultor. **Esperado:** sem "Região / carteira", sem documento, sem código; "ID Rennova \*"; telefone em linha inteira. Enviar → sucesso; o documento **não** tem `business_name`, `document_*` nem `volume`.

**Roteiro B — Landing (sempre executar):**
8. `/` → "Solicitar acesso". **Esperado:**
   - rótulo "Número do conselho";
   - "Código do consultor Rennova (opcional)" aceita só 6 dígitos (`12a456` vira `12456`);
   - "CPF ou CNPJ" com seletor;
   - sem volume.
9. Código `12345` → "Código de consultor inválido ou inativo"; código `000000` (bem-formado e inexistente) → mesma mensagem, vinda da API.
10. CNPJ `12.345.678/0001-99` → mensagem do DV vinda da API.
11. Especialista válido com CPF `529.982.247-25` e código `731548` → tela de sucesso. **Esperado:** `document_type: 'cpf'`, `document_number: '52998224725'`, `consultant_code: '731548'`; sem `consultant_reference` e sem `volume`.
12. Consultor: sem região → sucesso; documento sem `business_name`.
13. DevTools → Network: os `.jsx` são carregados com `?v=`.

**Roteiro C — Compatibilidade com cliente antigo (sempre executar):**
14. `curl -X POST /api/access-requests` com o corpo **antigo** de especialista (com `volume` e `consultant_reference`, sem documento). **Esperado:** 400 "CPF ou CNPJ é obrigatório".
15. Mesmo corpo com documento válido. **Esperado:** 200; o documento gravado não tem `volume` nem `consultant_reference`.
16. Corpo antigo de consultor (com `business_name: 'Sudeste 2'` e `volume`). **Esperado:** 200; nenhum dos dois é gravado.

**Roteiro D — Aprovação e telas (sempre executar):**
17. System admin → `/admin/access-requests`. **Esperado:**
    - a solicitação do passo 6 mostra a clínica, "Nº do conselho: …" **e** "CNPJ: 12.345.678/0001-95";
    - a do consultor (passo 7) mostra "—" em "Negócio".
18. Criar pelo Emulator UI uma solicitação pendente **antiga** de especialista, sem documento, com `volume: '30–80'`, e uma de consultor com `business_name: 'Sudeste 2'`. **Esperado:** as duas aparecem e são aprovadas. A primeira gera um tenant com `document_number: ''`; a segunda, um tenant com `name: 'Sudeste 2'`. Os documentos antigos não são alterados (o `volume` continua lá).
19. Aprovar a solicitação do passo 7 (consultor, sem região). **Esperado:** o tenant tem `name` igual ao nome completo (D6-A), e o e-mail `welcome_approval` na `email_queue` tem esse nome.
20. D1-A: criar uma solicitação de especialista com CNPJ `11.111.111/0001-91` (o de `test-clinic-a`) e aprovar. **Esperado:**
    - toast "Já existe uma clínica cadastrada com este CPF/CNPJ…";
    - a solicitação continua `pendente`;
    - nenhum tenant novo e nenhum usuário Auth novo.

    Repetir como `qa.consultant@` em `/consultant/access-requests` (depois das 48h, ou com um consultor do código) → mesmo 409.
21. `/consultant/access-requests`. **Esperado:** sem "Região / carteira" para o consultor novo; o diálogo de aprovação do consultor usa o nome completo.

**Roteiro E — Busca de clínicas (sempre executar):**
22. `qa.consultant@` → `/consultant/clinics/search`. **Esperado:** campo "CNPJ, CPF ou nome" e textos novos.
23. Digitar `clinica teste` (sem acento) + Enter. **Esperado:**
    - "Clínica Teste A", com "Você já é o consultor desta clínica" (D9-A), e "Clínica Teste B", com "Vincular Agora";
    - ordem alfabética; mesmo formato de card da busca por documento.
24. `qa clinic admin b` → só "Clínica Teste B" (nome do especialista, D3-A). `ADMIN B` → idem (sem diferença de maiúsculas).
25. `ab` → toast "Digite ao menos 3 letras do nome da clínica ou do especialista"; `1234567` → "Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome".
26. `11.111.111/0001-91` → "Clínica Teste A" (busca por documento, igual a hoje). `/api/tenants/search?document=11111111000191` (parâmetro antigo) → mesmo resultado.
27. No Emulator UI, `test-clinic-b.active = false` → buscar `teste` → só A. Voltar `active = true`.
28. Limite: criar pelo Emulator UI 21 tenants ativos `Clinica Lote NN` → buscar `lote`. **Esperado:** 20 resultados e "Mostrando os 20 primeiros resultados. Refine a busca." Apagar depois.
29. Vincular "Clínica Teste B" pelo resultado da busca por nome → "Vínculo estabelecido com sucesso!" (fluxo UC-24 inalterado).
30. Guarda:
    - `consultants/{qa.consultant}.status = 'suspended'` (Emulator UI) → buscar → 403 "Acesso restrito a consultores ativos"; voltar para `active`;
    - token de `qa.clinic-admin-a@` via `curl` → 403;
    - sem token → 401;
    - `qa.system-admin@` via `curl` → 200.
31. Conferir no terminal do `npm run dev` que nenhum log mostra o termo buscado nem documento.

**Roteiro F — Rules (sempre executar; complementa `npm run test:rules`):**
32. Console do navegador anônimo em `/`: `addDoc(collection(db,'access_requests'), {...})` → `permission-denied`. O formulário da landing continua funcionando (passo 11).
33. System admin rejeita uma solicitação em `/admin/access-requests` → status `rejeitada` (o update pelo client continua permitido).

**Roteiro G — Regressão (sempre executar):**
34. `npm run test:e2e` completo verde (UC-01 atualizado; UC-02, UC-03, UC-05 e UC-56 sem mudança).
35. `/clinic/setup` com um tenant recém-aprovado no passo 6. **Esperado:** documento pré-preenchido com `12.345.678/0001-95`.

**Roteiro H — Domínio Firebase pessoal (após o merge em `gscandelari_setup`):**
36. Em `dev-gscandelari.web.app`:
    - repetir os passos 1, 6, 7, 8, 11, 13, 17, 19, 20, 23, 24, 26 e 30;
    - conferir com `curl -sI https://dev-gscandelari.web.app/landing/sections-cta.jsx?v=…` que o arquivo novo é servido;
    - conferir que as rules publicadas pelo workflow de dev contêm `allow create: if false` em `access_requests`.
37. Produção (depois do deploy de `master`, **só leitura e uma solicitação de teste**):
    - enviar uma solicitação de especialista pela landing com dados de teste e rejeitá-la em seguida;
    - buscar o nome da clínica do cliente real como consultor de teste, para confirmar que é encontrada;
    - só então publicar a rule (Seção 5.6, passos 5 e 6) e repetir o envio de teste;
    - opcional: o system_admin preenche o documento dos 2 tenants sem documento em `/admin/tenants/[id]` (sem script).

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Jest — funções puras

| Função | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `validateAccessRequestInput` | `src/__tests__/accessRequestPayload.test.ts` | Especialista com CNPJ mascarado → `document_number` só dígitos; com CPF válido → ok; sem documento → `DOCUMENT_REQUIRED_ERROR`; `document_type: 'rg'` → `DOCUMENT_TYPE_ERROR`; `'cnpj'` com 11 dígitos → "CNPJ deve ter 14 dígitos"; `'cpf'` com 14 → "CPF deve ter 11 dígitos"; DV errado → mensagem do DV; todos iguais → mensagem própria; sem `business_name` → `BUSINESS_NAME_REQUIRED_ERROR`; conselho vazio/espaços → `COUNCIL_REQUIRED_ERROR`; consultor sem ID → `RENNOVA_ID_REQUIRED_ERROR`; consultor sem `business_name` e sem documento → ok, e o valor **não** tem `business_name` nem `document_*`; consultor com `business_name`, documento e `consultant_code` → todos ignorados; `volume` e `consultant_reference` nunca aparecem no valor; `consultant_code: '12a456'` → `INVALID_CONSULTANT_CODE_ERROR`; `consultant_code: '  '` → ok, sem código; e-mail `' A@B.COM '` → `'a@b.com'`; `role` ausente / inválido → mensagens atuais; `data` não-objeto (`null`, string) → erro de perfil. |
| `getAccessRequestBusinessName` | idem | `business_name: ' Clínica X '` → `'Clínica X'`; ausente → `full_name`; `'   '` → `full_name`. |
| `normalizeSearchText` | `src/__tests__/clinicSearch.test.ts` | `'  Clínica   CÍNGULO '` → `'clinica cingulo'`; `'São João'` → `'sao joao'`; `''` → `''`. |
| `classifyClinicSearchQuery` | idem | `'11.111.111/0001-91'` → document `'11111111000191'`; `'529.982.247-25'` → document; `'1234567'` → invalid (`SEARCH_QUERY_INVALID_ERROR`); `'123456789012'` (12) → invalid; `'ab'` → invalid (`NAME_QUERY_TOO_SHORT_ERROR`); `'a b c'` → name (3 sem espaços); `'Clínica 24h'` → name; `null` / `''` → invalid; `'Ção'` → name `'cao'`. |
| `filterTenantsByName` | idem | casa pelo nome da clínica; casa pelo nome do especialista; `'vidal helena'` casa "Helena Vidal" (todas as palavras); palavras divididas entre clínica e especialista **não** casam; ordenação alfabética e desempate por `id`; 21 candidatos → 20 + `truncated: true`; 20 → `truncated: false`; lista vazia; especialista sem nome ignorado. |

### 8.2 Jest — rotas e serviço (lógica de segurança, prioridade alta)

**`src/__tests__/accessRequestsRoute.test.ts`** (mocks de `../lib/firebase-admin`; a rota não usa mais o client SDK)

| Cenário | Esperado |
|---|---|
| `registration_enabled: false` | 403; nada gravado |
| Corpo inválido (cada erro da Seção 6.2) | 400 com a mensagem; nada gravado |
| Pendência para o mesmo e-mail | 409; nada gravado |
| Código de consultor bem-formado sem consultor ativo | 400 `INVALID_CONSULTANT_CODE_ERROR` |
| Especialista válido | 200 `{ success, id }`; gravação com `document_type`, `document_number` (dígitos), `business_name`, `consultant_code`/`consultant_id`; **sem** `volume` |
| Consultor válido com `business_name`, `volume` e `consultant_code` no corpo | 200; gravação **sem** `business_name`, `volume`, `document_*`; `consultant_code: null` |
| Corpo antigo de especialista com `volume` e documento | 200; sem `volume` nem `consultant_reference` |
| Falha da gravação | 500; `console.error` sem o corpo da requisição |

**`src/__tests__/accessRequestApproval.test.ts`** (mocks de `../lib/firebase-admin`, `emailTemplateAdmin` e `consultantClaimsSync`)

| Cenário | Esperado |
|---|---|
| Solicitação com documento já em `tenants.document_number` | `DocumentAlreadyInUseError`; `tenants.add`, `createUser` e e-mail **não** chamados |
| Documento só no legado `cnpj` de outro tenant | idem |
| Solicitação sem documento | nenhuma consulta de duplicidade; tenant com `document_number: ''` |
| Documento livre | tenant com o documento e o tipo da solicitação |
| Consultor sem `business_name` | `name` e `businessName` do e-mail = `full_name`; retorno `business_name` = `full_name` |
| Solicitação antiga de consultor com `business_name: 'Sudeste 2'` | `name: 'Sudeste 2'` (regressão) |
| `approveAccessRequestResponse` com `DocumentAlreadyInUseError` / `EmailAlreadyInUseError` | 409 / 400 (regressão) |

**`src/__tests__/tenantSearchRoute.test.ts`** (mocks de `../lib/firebase-admin` e `@/lib/services/tenantSearchServer`)

| Cenário | Esperado |
|---|---|
| Sem token / token inválido | 401; serviço não chamado |
| `clinic_admin`, `clinic_user` | 403 |
| Consultor com `active: false` / sem `consultant_id` / com `consultants/{id}.status: 'suspended'` / sem documento do consultor | 403 "Acesso restrito a consultores ativos" |
| System admin com `active: false` | 403 |
| Consultor ativo / system admin ativo | 200 |
| `?q=ab`, `?q=1234567`, sem parâmetro | 400 com a mensagem; serviço não chamado |
| `?q=11.111.111/0001-91` | `searchActiveTenantsByDocument('11111111000191')`; `truncated: false` |
| `?document=11111111000191` (legado) | mesma chamada |
| `?q=Clínica Teste` | `searchActiveTenantsByName('clinica teste')`; `truncated` repassado |
| Header | `Cache-Control: no-store` |
| Serviço lança erro | 500; `console.error` sem o termo |

**Regressão de `verifyActiveConsultant`:** os testes de rota do UC-56 que existirem continuam verdes. Se não houver, acrescentar em `tenantSearchRoute.test.ts` um caso que chame `verifyActiveConsultant` diretamente (consultor ativo → objeto; suspenso → 403).

**`searchActiveTenantsByName` (serviço):** um teste com `adminDb` mockado, em `tenantSearchRoute.test.ts` ou num arquivo próprio:
- agrupa os especialistas por `tenant_id`;
- ignora `clinic_admin` com `active: false`;
- usa `displayName` quando falta `full_name`;
- não devolve tenant fora da consulta `active == true`.

### 8.3 Regras — `npm run test:rules`

**Rule nova** (`describe('access_requests')`, D7-A). Toda leitura é testada com **get** (`getDoc`) **e list** (`getDocs(query(collection(...)))`), conforme a lição do PR #344.

| Cenário | Esperado |
|---|---|
| Anônimo: `addDoc` | falha |
| `clinic_admin` A, consultor, system_admin: `addDoc` | falha |
| System_admin: get e list (seed `req1`) | sucesso |
| `clinic_admin` A, `clinic_user` A, consultor: get e list | falha |
| System_admin: `updateDoc({ status: 'rejeitada', rejection_reason })` | sucesso (fluxo `rejectAccessRequest`) |
| Consultor: `updateDoc` | falha |

**Regressão (sempre, mesmo sem mudança de rule):** sustenta a premissa de que a busca só pode ser feita pelo servidor (RNF-03).

| Cenário | Esperado |
|---|---|
| Consultor sem acesso a `test-clinic-b`: `getDoc(tenants/test-clinic-b)` e `getDocs(collection('tenants'))` | falha |
| Consultor: `getDocs(query(collection('users'), where('role','==','clinic_admin')))` | falha |

### 8.4 E2E (cadernos — `CLAUDE.md`, regra 8)

- `npm run test:e2e`: regressão completa, com o UC-01 atualizado no STEP 11.
- O `qa-agent` (Modo A) gera ou estende os cadernos a partir do STEP 12:
  - UC-01 (Roteiros A, B e C);
  - UC-02 (passos 17-20);
  - UC-56 (passo 20, como consultor);
  - um caderno novo de busca do UC-24/UC-25 (Roteiro E).
- **Extensões de seed e fixtures a sinalizar, não inventar:**
  1. Nenhum seed novo é obrigatório: `test-clinic-a`/`b` têm CNPJ com DV válido e `clinic_admin` com nome.
  2. As solicitações "antigas" (passo 18) e os 21 tenants do passo 28 são criados pelo Admin SDK dentro do teste e apagados no fim.
  3. Suspensão do consultor (passo 30) dentro do teste, com restauração no `afterEach`.
  4. A landing (Roteiro B) depende do Babel standalone via unpkg. Se o CI não tiver acesso externo, marcar o roteiro como validação só manual e em dev.

---

## 9. Checklist de Definition of Done

```
[x] Decisões D1–D9 respondidas pelo usuário e incorporadas (16/10/2026, opção recomendada em todas)
[x] Verificações V1 e V2 feitas em produção (16/10/2026, só leitura); registrar no PR
[ ] develop local atualizado (>= 55df264) antes de criar a branch
[ ] npm run lint                — zero erros ou warnings novos
[ ] npm run type-check          — zero erros TypeScript
[ ] npm run build               — build de produção sem falhas
[ ] npm run test                — verde (accessRequestPayload, clinicSearch, accessRequestsRoute,
                                  accessRequestApproval, tenantSearchRoute, serverValidations e demais)
[ ] npm run test:rules          — verde; get E list em access_requests; regressão tenants/users
[ ] npm run test:e2e            — verde (UC-01 atualizado com revisão humana)
[ ] Multi-tenant: busca só no servidor; nenhuma rule de leitura aberta; aprovação escreve só no tenant novo
[ ] Segurança: nenhum secret; nenhum log com documento, termo de busca, nome ou e-mail; busca só para
    consultor ativo / system_admin ativo
[ ] Nenhum script de migração ou escrita em documento existente
[ ] git grep sem "CRM / CRO / nº conselho", "VOLUME_OPTIONS", "consultant_reference" (exceto o tipo legado),
    "Região / carteira *" em src/ e public/landing/
[ ] Landing servida com ?v= em route.ts e index.html (mesmo valor)
[ ] STEP 12 executado (Roteiros A–H)
[ ] Branch pessoal: task branch mergeada em gscandelari_setup pelo PR e validada em dev-gscandelari.web.app
[ ] PR gscandelari_setup → develop com template e nota de release:
    "DEPOIS do deploy de master e do teste do passo 37, publicar manualmente:
     firebase deploy --only firestore:rules --project curva-mestra
     (nunca antes — a API antiga grava pelo client SDK; ver Seção 5.6)"
[ ] Rule de access_requests publicada em produção só depois do hosting, e envio de teste repetido
[ ] (Opcional, manual) documento dos 2 tenants sem documento preenchido em /admin/tenants/[id]
[ ] uml-use-case-writer: UC-01, UC-02, UC-03, UC-24, UC-25, UC-45, UC-56
[ ] uc-issues-tracker (Modo B): fechar UC-02-Q1; registrar F1 como corrigido; F4, F6, F7 e o CNPJ alfanumérico (D2-A) como débito
[ ] qa-agent (Modo A) acionado com as extensões da Seção 8.4; revisão humana
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Rule `create: if false` publicada antes do hosting novo (D7-A) | Média, se esquecido | **Alto** (todas as solicitações falham) | Ordem obrigatória da Seção 5.6: hosting de produção → passo 37 → publicação manual da rule → novo envio de teste. Nota de release e item no DoD. |
| Rollback do hosting com a rule nova já publicada | Baixa | **Alto** (formulário para) | Republicar primeiro a rule anterior (`allow create: if true`) e só depois voltar o hosting (Seção 5.6, passo 8). |
| JSX da landing em cache com o formulário antigo | Média | Baixo | `?v=` no HTML `force-dynamic`; a API responde 400 com mensagem clara. |
| Aba de `/register` aberta desde antes do deploy | Baixa | Baixo | Mesma mensagem 400; recarregar resolve. |
| Busca por nome com custo crescente | Baixa hoje | Médio no futuro | RNF-05 e V2; gatilho de ~1.000 leituras por busca para migrar a D4-B. |
| Consultor enumerando clínicas por nome | Média | Médio (privacidade) | Só consultor ativo; mínimo 3 caracteres; limite 20 (D5). Com o formato mantido, e-mail e documento continuam visíveis; se houver abuso, reduzir os dados devolvidos numa task própria. |
| Duplicidade bloqueando um caso legítimo (mesmo CPF em dois consultórios) | Baixa | Médio | D1-A bloqueia. O admin cria o segundo tenant por `/admin/tenants/new` se for o caso. |
| CNPJ alfanumérico recusado no registro (D2-A) | Baixa hoje, crescente | Médio | Débito registrado; o admin cadastra manualmente até a task própria. |
| Aprovação de consultor quebrando por `name` ausente | Certa sem o fallback | Alto | RN-07 / D6 e teste no STEP 3. |
| Caderno UC-01 quebrando o gate de CI | Certa sem o STEP 11 | Médio | STEP 11 no mesmo PR. |
| Mudança na guarda de `verifyActiveConsultant` afetar o UC-56 | Baixa | Médio | Extração sem mudança de lógica; regressão no Jest e no e2e do UC-56. |
| Tenant do cliente real com documento vazio | Certa (V1) | Baixo | A busca por nome o encontra; o system_admin completa o documento em `/admin/tenants/[id]` quando quiser (passo manual opcional, sem migração). |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Solicitação de acesso | Documento em `access_requests` criado por `/register` ou pela landing (UC-01), aprovado por system_admin (UC-02) ou consultor (UC-56). |
| Especialista | Perfil `role: 'especialista'` da solicitação: profissional de HOF que opera uma clínica. Vira `clinic_admin` do tenant aprovado. |
| Consultor Rennova | Perfil `role: 'consultor'` da solicitação; ou usuário com `is_consultant` (Portal do Consultor). |
| Documento | CPF (11 dígitos) ou CNPJ (14 dígitos), gravado só com dígitos em `document_number`, com `document_type`. |
| CNPJ alfanumérico | CNPJ com letras nas 12 primeiras posições, emitido pela Receita desde 2026; validado por `isValidCnpj` (`nfIdentity.ts`). |
| Código do consultor | 6 dígitos de `consultants.code` (UC-28), informado opcionalmente pelo especialista (UC-01 RN-08). |
| Nome efetivo da solicitação | `business_name` sem espaços nas pontas, ou `full_name` quando ausente (`getAccessRequestBusinessName`). |
| Busca por nome | Filtro em memória, no servidor, dos tenants ativos pelo nome da clínica ou do `clinic_admin`, sem acento e sem diferença de maiúsculas. |
| Consultor ativo | Token com `is_consultant`, `consultant_id` e `active === true`, **e** `consultants/{id}.status === 'active'`. |
| Cache-busting | Sufixo `?v=…` na URL de um arquivo estático, para o navegador baixar a versão nova. |

---

## 12. Referências

- Decisões do usuário de 16/10/2026 (itens 1 a 7), recebidas via coordenador.
- `ONLY_FOR_DEVS/PO_BA_Docs/`:
  - `UC-01-solicitar-acesso-ao-sistema.md` (v2.3), `UC-02-aprovar-solicitacao-de-acesso.md` (v2.4; `UC-02-Q1`), `UC-03-rejeitar-solicitacao-de-acesso.md`;
  - `UC-24-vincular-se-automaticamente-a-clinica-sem-consultor.md` (v1.0.1; RN-03), `UC-25-solicitar-transferencia-de-clinica-ja-vinculada.md` (v2.0);
  - `UC-45-completar-configuracao-inicial-da-clinica.md`, `UC-56-consultor-aprova-solicitacao-vinculada-ao-codigo.md` (v1.4);
  - `_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.57).
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem.md` (formato e padrão de testes de rules get/list).
- Código:
  - `src/app/(auth)/register/page.tsx`, `public/landing/sections-cta.jsx`, `public/landing/index.html`, `src/app/route.ts`;
  - `src/app/api/access-requests/route.ts`, `src/app/api/access-requests/[id]/{approve,approve-consultant,reject}/route.ts`;
  - `src/lib/services/{accessRequestApproval,accessRequestRouteHelpers,accessRequestService,consultantService,tenantServiceDirect}.ts`;
  - `src/lib/validations/serverValidations.ts`, `src/lib/utils/documentValidation.ts`, `src/lib/nfIdentity.ts`, `src/types/{index,tenant}.ts`;
  - `src/app/(admin)/admin/{access-requests,tenants/[id]}/page.tsx`, `src/app/(clinic)/clinic/setup/page.tsx`;
  - `src/app/(consultant)/consultant/{access-requests,clinics/search}/page.tsx`;
  - `src/app/api/tenants/search/route.ts`, `src/app/api/consultants/{claims,me/pending-access-requests}/route.ts`;
  - `functions/src/{onAccessRequestCreated,checkConsultantPendingAccessRequestsScheduled}.ts`, `src/lib/consultantPendingRequestsDigest.ts`, `scripts/seed-email-templates.ts`;
  - `firestore.rules` (`access_requests`, `tenants`, `users`, `consultants`), `firestore.indexes.json`, `firebase.json`, `.github/workflows/{deploy-firebase,deploy-gscandelari-dev}.yml`.
- Testes: `src/__tests__/{serverValidations,nfIdentityLookupRoute}.test.ts` (padrão de mock de rota), `tests/rules/firestore-tenant-subcollections.test.ts`, `tests/e2e/UC-01-…spec.ts`, `tests/e2e/fixtures/seed-data.ts`, `scripts/seed-emulator.ts`.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` (Seções 1, 2 e 15); `CLAUDE.md` (Multi-Tenant, regra 8).
- Externas:
  - Firestore: consultas de igualdade com índice de campo único automático; o Admin SDK recusa `undefined` sem `ignoreUndefinedProperties`;
  - Next.js 15 Route Handlers;
  - Receita Federal: CNPJ alfanumérico (IN RFB 2.229/2024).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 16/10/2026 | Doc Writer (Claude) | Versão inicial. Partes A (registro) e B (busca por nome), a partir das decisões do usuário de 16/10/2026 (itens 1 a 7). Achados F1–F11. Status **Aguardando decisão**, com D1–D9 pendentes e as verificações V1 e V2. Base `develop` @`55df264`. |
| 1.1 | 16/10/2026 | Doc Writer (Claude) | **Decisões D1–D9 resolvidas pelo usuário em 16/10/2026 (via coordenador), todas pela opção recomendada:** D1-A (duplicidade checada na aprovação, nas duas rotas, 409; tenant inativo e legado `cnpj` também contam); D2-A (só CNPJ numérico; alfanumérico como débito); D3-A (`clinic_admin` ativos; sem `clinic_user`); D4-A (filtro em memória no servidor); D5 (mín. 3, máx. 20 com aviso, mesmo formato com e-mail e documento, inclui clínicas com consultor, sem indicar o especialista casado); D6-A (`full_name`); D7-A (Admin SDK + `allow create: if false`, publicada só depois do hosting de produção); D8 (placeholder "Ex.: CRM-SP 142337 ou CRO-RJ 5678" e "Nº do conselho:"); D9-A ("Você já é o consultor desta clínica", sem botão). **V1 e V2 registradas** (leitura em produção pelo usuário): cliente real "Clínica Linda Mello" com documento vazio, sem `onboarding_completed` e com consultor; 4 tenants ativos (2 sem documento), 6 users (4 `clinic_admin` ativos). Seção 4.5 reescrita como decisões resolvidas; condicionais de decisão removidas do plano; Seção 5.6 com a ordem obrigatória hosting → teste → rule e o rollback; passo manual opcional de preenchimento de documento em `/admin/tenants/[id]` (sem migração). **Status → Planejamento.** |
| 1.2 | 16/10/2026 | Guilherme Stanke Scandelari | Task concluída — movida para TASK_COMPLETED. **Status → Concluído.** Branch `feature/ajustes-registro-e-busca-consultor` (de `develop` @`1479f5d`). **Commits** (do mais antigo ao mais novo, depois do spec `27e861e`): STEP 1 `61872da` / `f77ac4c`; STEP 2 `293e507` / `a16eb8b`; STEP 3 `7172d8c` / `3e17672`; STEP 4 `b97a504`; STEP 5 `0c96f93` (inclui `src/app/(auth)/layout.tsx`, que passou a usar `has-[[data-auth-wide]]:max-w-2xl`: o `max-w-md` do layout limitava todas as páginas de auth, e assim só o `/register` alarga); STEP 6 `88f0c79`; STEP 7 `a59e7ab` / `df6d348`; STEP 8 `437ebfe` / `40d05c3`; STEP 9 `10805bf`; STEP 10 `2042395` / `41e4625`; STEP 11 `0500438` (inclui o ajuste do rótulo "Nº do conselho:" no caderno UC-02). **Validação:** lint com 0 erros (428 avisos, todos anteriores); type-check e build OK; Jest 710 verdes (`test:coverage` reexecutado no fechamento: 39 suítes, 710 testes); `test:rules` 170 verdes; `test:e2e` 150 passed / 2 skipped / 1 failed, sendo a falha o UC-09 Variante B, pré-existente (item `UC-09-E2E-VarB` no mapa); cadernos UC-01, UC-02, UC-03, UC-05 e UC-56 verdes isoladamente (41 testes). Testes temporários no emulador, já apagados, todos verdes: `/register` (CNPJ com dígito verificador inválido barrado, troca de tipo limpa o campo, gravação só com dígitos e sem volume, consultor sem região nem documento); landing (CPF com máscara, código do consultor gravando `consultant_id`, sem volume nem `consultant_reference`); busca do consultor (nome da clínica, nome do especialista, CNPJ com máscara, "Você já é o consultor desta clínica", mensagem de vazio por nome e mínimo de 3 letras). **Ponto para o usuário avaliar:** na busca por nome, uma palavra de uma letra casa com quase tudo (ex.: "teste a" também traz a "Clínica Teste B", porque o "a" está em "clínica"). É o comportamento do spec (RF-16); a alternativa é ignorar palavras com menos de 2 letras. **Pendências de fechamento:** (1) validação em `dev-gscandelari.web.app` (o workflow de dev publica hosting e rules juntos); (2) ordem de deploy em produção: hosting primeiro; depois um envio de teste pela landing e a rejeição dessa solicitação; só então o usuário publica manualmente a rule (`firebase deploy --only firestore:rules --project curva-mestra`); depois um novo teste; rollback: rule antiga primeiro, depois o hosting; (3) passo manual opcional: o system_admin preenche o CPF/CNPJ da "Clínica Linda Mello" e da "Clínica GScandelari" em `/admin/tenants/[id]`; (4) docs: UC-01, UC-02, UC-03, UC-56 e os UCs de busca/reivindicação do consultor (`uml-use-case-writer`); mapa de bugs (`uc-issues-tracker`), incluindo o débito do CNPJ alfanumérico; (5) cadernos E2E novos pelo `qa-agent` (busca do consultor). |
