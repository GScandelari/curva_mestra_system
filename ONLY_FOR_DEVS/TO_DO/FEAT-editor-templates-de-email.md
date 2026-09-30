# Feature Specification: Editor de Templates de E-mail (UC-55)

**Projeto:** Curva Mestra
**Data:** 30/09/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** cinco branches sequenciais a partir de `develop` (ver Seção 0 — escopo fatiado por fronteira técnica, precedente de UC-51/2 branches e UC-53/3 branches, escalado pelo tamanho real do escopo: 13 RNs, dois runtimes de deploy distintos — `src/` via Next.js/Hosting e `functions/src/` via Cloud Functions —, uma correção de bug (RN-04) e uma migração de mecanismo (RN-11)):
- `feature/uc55-email-templates-foundation`
- `feature/uc55-editor-tela-admin`
- `feature/uc55-migrar-consumidores-email-queue`
- `feature/uc55-migrar-cloud-functions-e-fix-duplicidade`
- `feature/uc55-caderno-playwright`
**Prioridade:** Média
**Versão:** 1.1

> Implementa o UC-55 (`ONLY_FOR_DEVS/PO_BA_Docs/UC-55-editar-templates-de-email.md`, v1.1, Aprovado): nova coleção Firestore `email_templates/{tipo}` como fonte única de verdade para 12 dos 13 gatilhos de e-mail hoje com corpo hardcoded (o 13º, gatilho #9 de corpo livre por criação, é explicitamente excluído do mecanismo por RN-14 do UC), uma tela nova `/admin/email-templates` com editor por gatilho (assunto+corpo, preview, envio de teste, histórico de versões revertível), a correção da duplicidade de e-mail de boas-vindas (UC-02/UC-28, RN-04) e a migração do mecanismo isolado de UC-03 (RN-11) para o mesmo Firestore. **A decisão técnica real encontrada na investigação de código (escrita mediada por API route vs. regra direta do Firestore) foi confirmada pelo usuário como Opção A — escrita mediada por API route (Admin SDK) — e está incorporada em todo o restante desta spec (ver Seção 4.0).**

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`, para cada uma das cinco branches, cada uma partindo de `develop` **após** o merge (via `gscandelari_setup`) da anterior.
- **Fluxo de PR obrigatório para cada branch:** `feature/uc55-*` → PR → `gscandelari_setup` (validação no Firebase pessoal) → PR → `develop`. **Nunca** abrir PR direto para `master`.
- **Motivo do fatiamento em 5 branches** (mais granular que UC-51/2 e UC-53/3, critério já autorizado no UC-51 Seção 14 item 6: "se o `dev-task-manager` considerar o escopo grande demais para uma única entrega, pode fatiar em múltiplas tasks/PRs sem dividir o UC"):
  1. **Fundação** (tipos, módulo puro de renderização + espelho em `functions/src/`, serviços Admin SDK, regra do Firestore, script de seed) precisa existir e estar testada antes de qualquer consumidor ou tela poder depender dela — mesmo racional de "fundação antes de instrumentação" do UC-53.
  2. **Tela do editor + API routes + callable de teste** têm superfície de UI nova e podem ser validadas isoladamente (ler/editar/prever/reverter os 12 templates já seedados) sem nenhum risco aos 12 pontos de envio real ainda não migrados.
  3. **Migração dos 8 gatilhos via `email_queue`** (`src/app/api/**`, 7 arquivos de rota + `passwordResetService.ts`) é uma fronteira de deploy (Next.js/Hosting) e de risco diferente da próxima.
  4. **Migração dos 4 gatilhos via Cloud Functions** (`functions/src/`) exige `firebase deploy --only functions` e validação separada, e é onde vive a correção da duplicidade (RN-04) e a migração de UC-03 (RN-11) — maior risco de regressão em produção (e-mails automáticos), isolado em sua própria branch/PR.
  5. **Caderno Playwright** só pode ser gerado depois que o fluxo passa a existir de ponta a ponta (edição → envio real).
- **Pré-requisito de implementação que atravessa as branches C e D:** o script de seed (Branch A) precisa ter sido executado manualmente contra o Firestore real do ambiente em validação (`gscandelari_setup` e, depois, produção) **antes** de qualquer branch C/D ser validada nesse ambiente — sem os documentos `email_templates/{tipo}` já existindo, `getRenderedEmailTemplate*` lança erro e os e-mails migrados simplesmente deixam de ser enviados (ver Seção 10, Riscos).

### Branch A — `feature/uc55-email-templates-foundation`

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 1 | `feat` | `types` | `add EmailTemplateDoc, EmailTemplateVariable and EmailTemplateVersion types` |
| 2 | `feat` | `admin` | `add pure email template rendering and validation module` |
| 3 | `test` | `admin` | `add unit tests for email template rendering and validation` |
| 4 | `feat` | `firebase` | `add firestore.rules for email_templates collection` |
| 5 | `feat` | `admin` | `add emailTemplateAdmin service (get, save version, list/revert versions)` |
| 6 | `feat` | `admin` | `mirror email template rendering module into functions/src` |
| 7 | `feat` | `admin` | `add getRenderedEmailTemplate to functions/src emailTemplateService` |
| 8 | `chore` | `admin` | `add seed-email-templates script for the 12 migrated triggers` |

### Branch B — `feature/uc55-editor-tela-admin` (a partir de `develop`, após merge da Branch A)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 9 | `feat` | `admin` | `add email-templates list, get and save API routes` |
| 10 | `feat` | `admin` | `add email-templates version history and revert API routes` |
| 11 | `feat` | `admin` | `add sendTemplateTestEmail callable function` |
| 12 | `feat` | `admin` | `add /admin/email-templates list screen` |
| 13 | `feat` | `admin` | `add /admin/email-templates editor screen with preview, test send and version history` |
| 14 | `feat` | `admin` | `add Email Templates menu item to AdminLayout` |

### Branch C — `feature/uc55-migrar-consumidores-email-queue` (a partir de `develop`, após merge da Branch B)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 15 | `feat` | `requests` | `migrate welcome_approval and password_reset to email_templates` |
| 16 | `feat` | `requests` | `migrate consultant_welcome to email_templates and suppress duplicate welcome email` |
| 17 | `feat` | `requests` | `migrate remaining 5 consultant email_queue triggers to email_templates` |

### Branch D — `feature/uc55-migrar-cloud-functions-e-fix-duplicidade` (a partir de `develop`, após merge da Branch C)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 18 | `refactor` | `admin` | `remove hardcoded HTML generators from emailService` |
| 19 | `fix` | `admin` | `migrate onUserCreated to email_templates and suppress duplicate welcome email` |
| 20 | `feat` | `admin` | `migrate onTenantCreated notification to email_templates` |
| 21 | `feat` | `admin` | `migrate onAccessRequestCreated notification to email_templates` |
| 22 | `fix` | `admin` | `migrate sendAccessRejectionEmail to read template from email_templates` |

### Branch E — `feature/uc55-caderno-playwright` (a partir de `develop`, após merge da Branch D)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 23 | `test` | `admin` | `add UC-55 Playwright spec (qa-agent, revisado)` |

**Lembrete:** PR sempre `feature/* → gscandelari_setup → develop`. **Nunca** para `master`.

---

## 4.0 Decisão Técnica Confirmada — Escrita Mediada por API Route (Opção A)

Investigação de código encontrou uma contradição objetiva entre duas RNs do próprio UC-55 aprovado, que o texto do UC não resolve por si — não é uma suposição, é uma contradição entre dois requisitos do documento aprovado:

- **RNF-02 do UC-55** pede uma regra Firestore no padrão `allow write: if isSystemAdmin()`, "equivalente ao padrão já usado em `system_settings`/documentos legais" — ou seja, o texto do UC assume que o editor grava **diretamente via client SDK** (`updateDoc`/`addDoc`), como `LegalDocumentForm.tsx`/`admin/settings/page.tsx` fazem hoje, com a regra do Firestore como única barreira de escrita.
- **RN-07/RNF-05 do UC-55** exigem que o salvamento seja **bloqueado** se o texto usar uma variável fora da lista permitida daquele template, ou remover uma variável obrigatória — e que essa validação "nunca" dependa só do client. A linguagem de regras do Firestore (`firestore.rules`) não tem como expressar de forma confiável "extrair todas as ocorrências de `{{variavel}}` dentro de uma string arbitrária e verificar cada uma contra uma lista dinâmica por documento" — não há laço/iteração sobre substrings nessa linguagem (diferente da validação de formato simples por `matches()` já usada em `legal_documents`/`master_products`, que testa o **formato inteiro** do campo, não ocorrências múltiplas dentro de um texto livre).

**Decisão confirmada pelo usuário em 30/09/2026: Opção A — escrita mediada por API route (Admin SDK).** O editor chama `PUT /api/email-templates/[tipo]` (Bearer token + `is_system_admin`, mesmo padrão de todas as rotas administrativas já existentes). A rota valida RN-07 em TypeScript (fácil e confiável) e grava a nova versão + histórico numa transação Firestore atômica (evita condição de corrida entre "salvar versão antiga" e "sobrescrever a atual"). A regra do Firestore **não** segue o padrão de RNF-02 e passa a ser `allow read, write: if false` — mesmo padrão já usado em `password_reset_tokens` (coleção 100% mediada por Admin SDK). Esta decisão abandona a redação literal de RNF-02 em favor do cumprimento pleno de RN-07/RNF-05, e está incorporada em todas as seções desta spec (5-9).

A alternativa descartada por esta decisão (Opção B — escrita direta via client SDK, literal a RNF-02) está registrada na Seção 4.2.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

Confirmado por leitura direta de todo o código citado pelo UC-55 (RN-01), mais os arquivos de mecanismo:

- **13 gatilhos em escopo (UC-55 RN-02), dos quais 12 efetivamente migram para `email_templates`** (o 13º, gatilho #9, é excluído do mecanismo por decisão explícita da RN-14 do UC — ver Seção 1.1.3):

| # | Tipo (`email_templates/{tipo}`, proposto) | Arquivo hoje | Mecanismo | Assunto hardcoded hoje |
|---|---|---|---|---|
| 1 | `welcome_approval` (já é o `type` literal em `email_queue` hoje) | `src/app/api/access-requests/[id]/approve/route.ts` (`generateWelcomeEmailHtml`, linhas 28-81) | `email_queue` → `processEmailQueue` | "Sua Solicitação foi Aprovada - Curva Mestra" |
| 2 | `password_reset` (já literal) | `src/lib/services/passwordResetService.ts` (`generateResetPasswordEmailHtml`, linhas 253-293) — 2 chamadores: `src/app/api/users/[id]/reset-password/route.ts`, `src/app/api/consultants/[id]/reset-password/route.ts` | `email_queue` → `processEmailQueue` | "Redefinição de Senha - Curva Mestra" |
| 3 | `consultant_welcome` (já literal) | `src/app/api/consultants/route.ts` (`generateConsultantWelcomeEmail`, linhas 41-94) | `email_queue` → `processEmailQueue` | "Bem-vindo ao Curva Mestra - Portal do Consultor" |
| 4 | `consultant_email_changed` (já literal) | `src/app/api/consultants/[id]/route.ts` (inline, linhas 136-162, enviado 2x — e-mail antigo e novo) | `email_queue` → `processEmailQueue` | "Seu e-mail de acesso foi alterado - Curva Mestra" |
| 5 | `consultant_transfer_request` (já literal) | `src/app/api/consultants/claims/route.ts` (inline, linhas 193-210) | `email_queue` → `processEmailQueue` | "Pedido de transferência de clínica - Curva Mestra" |
| 6 | `consultant_invite_created` (já literal) | `src/app/api/tenants/[id]/consultant/invite/route.ts` (inline, linhas 161-178) | `email_queue` → `processEmailQueue` | "Convite de vínculo com clínica - Curva Mestra" |
| 7 | `consultant_transfer_approved` (já literal) | `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` (inline, linhas 158-176) | `email_queue` → `processEmailQueue` | "Transferência aprovada - Curva Mestra" |
| 8 | `consultant_transfer_rejected` (já literal) | `src/app/api/consultants/transfer-requests/[id]/reject/route.ts` (inline, linhas 84-110) | `email_queue` → `processEmailQueue` | "Pedido de transferência não aprovado - Curva Mestra" |
| 10 | `access_request_rejected` (novo, não tinha `type`) | `functions/src/sendRejectionEmail.ts` → `emailService.ts::sendRejectionEmail` | `fetch` HTTP → callable `sendAccessRejectionEmail` (chamado por `src/app/api/access-requests/[id]/reject/route.ts`) | "Atualização sobre sua Solicitação - Curva Mestra" |
| 11 | `generic_user_welcome` (novo) | `functions/src/onUserCreated.ts` → `emailService.ts::sendWelcomeEmail` | Trigger `onDocumentCreated` em `users/{userId}` | "🎉 Bem-vindo ao Curva Mestra!" |
| 12 | `new_tenant_notification` (novo, interno) | `functions/src/onTenantCreated.ts` → `emailService.ts::sendNewTenantNotification` | Trigger `onDocumentCreated` em `tenants/{tenantId}` | "🎊 Nova Clínica: {{tenantName}}" |
| 13 | `access_request_created` (novo, interno) | `functions/src/onAccessRequestCreated.ts` (HTML inline, linhas 65-221) | Trigger `onDocumentCreated` em `access_requests/{requestId}` | "Solicitação de Acesso - {{documentNumber}}" |

#### 1.1.1 Gatilho #9 — excluído do mecanismo (RN-14 do UC)

`src/app/api/tenants/create/route.ts` já permite ao `system_admin` compor assunto e corpo **livres** por criação de clínica (`data.welcome_email.subject`/`body`, gravado direto em `email_queue`, sem `type`). Confirmado por leitura: esse mecanismo é estruturalmente diferente (corpo 100% livre, digitado a cada envio, nunca reaproveitado) e a RN-14 do UC-55 é explícita — "Este UC **não altera** esse mecanismo existente". Nenhuma linha de código muda neste arquivo. A tela `/admin/email-templates` exibe uma linha informativa, não-clicável, para este gatilho (Seção 6.3), para cumprir o Fluxo Principal passo 2 do UC ("exibe a lista dos 13 gatilhos") sem contradizer RN-14.

#### 1.1.2 Confirmado por leitura: nenhum dos 4 gatilhos de `functions/src/` inicializa o Admin SDK de forma garantida

`onUserCreated.ts`, `onTenantCreated.ts` e `onAccessRequestCreated.ts` hoje não acessam Firestore (só chamam `sendEmail`/funções de `emailService.ts`) — nenhum deles chama `admin.initializeApp()`. Para essas 3 functions passarem a ler `email_templates` via Admin SDK, a inicialização defensiva precisa ser adicionada (mesmo padrão já comentado em `processEmailQueue.ts`: "não é seguro depender desse comportamento implícito, então inicializa explicitamente"). Centralizada em `functions/src/services/emailTemplateService.ts` (Seção 6.2), não duplicada em cada arquivo.

#### 1.1.3 Achado: `functions/` só empacota `functions/src/` — confirmado o mesmo limite já documentado em `FEAT-agendamento-automatico-verificacao-alertas.md`

`firebase.json` define `functions[0].source = "functions"`; `functions/tsconfig.json` tem `include: ["src"]` relativo a `functions/`. Um import relativo de `functions/src/algo.ts` para `src/lib/algo.ts` (fora de `functions/`) falha silenciosamente no build local e quebra no deploy real (arquivo ausente no runtime). A lógica pura de renderização (`{{variavel}}` → valor) é necessária nos dois lados (client/API routes em `src/`, e Cloud Functions em `functions/src/`) — a solução já estabelecida no projeto para esse limite é o **espelho manual** (cópia deliberada com comentário cruzado), não uma ferramenta de monorepo (rejeitada no precedente pela mesma razão: "Zero DevOps" explícito do `CLAUDE.md`).

#### 1.1.4 Duplicidade de e-mail (RN-03/RN-04 do UC) — confirmada

`onUserCreated.ts` dispara **incondicionalmente** em qualquer criação de documento em `users/{userId}`. Dois pontos de código já criam esse documento **e** já enfileiram um e-mail de boas-vindas específico em paralelo: `access-requests/[id]/approve/route.ts` (linhas 176-189, `welcome_approval`) e `consultants/route.ts` (linhas 275-289, `consultant_welcome`). Resultado hoje: 2 e-mails de boas-vindas por aprovação/criação. RN-04 do UC exige que isso gere exatamente 1 e-mail, sem adiar a correção.

### 1.2 Problema identificado

Todo o texto dos 12 e-mails migrados está hardcoded em TypeScript, espalhado em 9 arquivos de rota + 4 arquivos de `functions/src/`, sem nenhuma forma de o `system_admin` revisar redação, corrigir erros ou ajustar tom sem um deploy de código. Dois e-mails são disparados em duplicidade para a mesma ação (UC-02, UC-28). `UC-03` usa um mecanismo de envio (`fetch` + custom token para uma callable) diferente e mais frágil que os demais 12 gatilhos.

### 1.3 Motivação estratégica

Pedido direto do usuário após testar em produção o e-mail `welcome_approval` e avaliar que "o corpo do e-mail precisa de uma revisão geral". **Nota de escopo desta spec:** o objetivo desta implementação é entregar a **ferramenta** que torna a revisão de redação possível sem deploy — não reescrever o texto dos 12 e-mails. O script de seed (Branch A, Seção 7) migra o HTML **hoje em produção**, palavra por palavra, para o Firestore (mais a elevação visual mecânica exigida por RN-13 para os 5 templates de corpo simples — Seção 1.1, wrapper de `<style>`/cabeçalho já usado nos demais, sem reescrever nenhuma frase). A reescrita de conteúdo em si é um trabalho editorial que o próprio `system_admin` faz **depois** do deploy, usando a tela `/admin/email-templates` — não é uma tarefa de código desta spec, e não deveria ser inventada por mim sem input do usuário sobre o texto desejado.

---

## 2. Objetivos

1. Criar a coleção `email_templates/{tipo}` (Firestore) como fonte única de verdade para 12 dos 13 gatilhos em escopo, com subcoleção `versions` para histórico revertível.
2. Criar o módulo puro de renderização/validação de variáveis (`src/lib/emailTemplateRendering.ts`), sem nenhum import de Firebase, e seu espelho em `functions/src/` (limite de empacotamento, Seção 1.1.3).
3. Expor a tela `/admin/email-templates` (lista dos 13 gatilhos, incluindo a linha informativa não-editável do #9) e o editor por gatilho (assunto+corpo, preview, envio de teste, histórico revertível).
4. Migrar os 8 gatilhos via `email_queue` (`src/app/api/**`) para ler `email_templates` antes de enfileirar.
5. Migrar os 4 gatilhos via Cloud Functions (`onUserCreated`, `onTenantCreated`, `onAccessRequestCreated`, `sendAccessRejectionEmail`) para ler `email_templates` antes de enviar.
6. Corrigir a duplicidade de e-mail de boas-vindas (UC-02/UC-28) suprimindo condicionalmente o disparo genérico de `onUserCreated` quando um e-mail específico já foi enfileirado pela rota de origem.
7. Elevar visualmente os 5 templates de corpo simples ao mesmo padrão dos demais (RN-13), como parte do conteúdo seedado.
8. Não migrar o mecanismo de corpo livre do gatilho #9 (RN-14) e não reescrever a redação dos 12 e-mails migrados (Seção 1.3).
9. Garantir cobertura de teste unitário para toda a lógica pura de renderização/validação (CLAUDE.md item 8).
10. Não introduzir nenhuma dependência de monorepo/workspaces nem alterar a filosofia "Zero DevOps".

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Sistema exibe em `/admin/email-templates` os 13 gatilhos (12 editáveis + 1 informativo/#9), categoria (e-mail/notificação interna/mecanismo próprio) e UC consumidor | system_admin | Must |
| RF-02 | Sistema exibe, ao selecionar um gatilho editável, assunto/corpo atuais, variáveis permitidas (destacando obrigatórias) | system_admin | Must |
| RF-03 | Sistema renderiza preview com valores de exemplo, 100% client-side, sem persistir nada | system_admin | Must |
| RF-04 | Sistema envia e-mail de teste do conteúdo em edição (não salvo) para um endereço informado, via SMTP real | system_admin | Must |
| RF-05 | Sistema bloqueia o salvamento se uma variável fora da lista permitida for usada, ou se uma obrigatória for removida, com mensagem específica | system_admin | Must |
| RF-06 | Sistema grava a edição válida como nova versão, preservando a anterior no histórico | system_admin | Must |
| RF-07 | Sistema exibe o histórico de versões (data, autor) e permite reverter para uma versão anterior, gerando uma nova entrada de histórico pela própria reversão | system_admin | Must |
| RF-08 | Sistema bloqueia acesso de quem não é `system_admin`, mesmo por URL direta | outros roles | Must |
| RF-09 | Cada um dos 12 gatilhos migrados lê `email_templates/{tipo}` antes de montar e enviar o e-mail correspondente | system | Must |
| RF-10 | Uma única aprovação de solicitação (UC-02) ou criação de consultor (UC-28) gera exatamente 1 e-mail de boas-vindas ao destinatário final | system | Must |
| RF-11 | `sendAccessRejectionEmail`/UC-03 lê `email_templates/access_request_rejected` antes de enviar, alinhado ao mesmo mecanismo dos demais 12 gatilhos | system | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | `email_templates` e sua subcoleção `versions` são globais, sem dimensão de `tenant_id` — nenhum dos 12 gatilhos migrados varia por clínica (confirmação de não aplicabilidade multi-tenant, mesmo padrão de RNF-01 do UC-55) | Multi-tenant (não aplicável) |
| RNF-02 | Regra do Firestore para `email_templates`: `allow read, write: if false` (Opção A, Seção 4.0 — escrita mediada exclusivamente por API route com Admin SDK) | Segurança |
| RNF-03 | Cada um dos 12 pontos de código migrados faz uma leitura adicional ao Firestore antes de montar o e-mail — impacto de latência pequeno frente ao próprio envio SMTP, sem cache obrigatório nesta v1 (mesmo julgamento do UC-55 RNF-03) | Desempenho |
| RNF-04 | O envio de e-mail de teste é identificável em log/assunto (prefixo `[TESTE]`) para não ser confundido com e-mail de produção | Observabilidade |
| RNF-05 | Validação de variáveis permitidas ocorre no client (UX imediata, RF-03) e no servidor (fonte de verdade — API route `PUT /api/email-templates/[tipo]` via `validateTemplateVariables`, Opção A/Seção 4.0) | Segurança / Integridade de Dados |
| RNF-06 | Nenhum índice novo em `firestore.indexes.json` — todas as consultas desta feature são de documento único ou de subcoleção por caminho direto (sem `collectionGroup`, sem filtro composto) | Infraestrutura |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | 12 dos 13 gatilhos em escopo migram para `email_templates`; o #9 (`tenants/create`, corpo livre) não migra (UC-55 RN-14) | UC-55 RN-02/RN-14 |
| RN-02 | A lista de variáveis permitidas por template é fixa, definida no seed (Branch A) — não é editável pela UI nesta v1 (apenas lida, para exibição e validação) | UC-55 RN-07 |
| RN-03 | O conteúdo seedado é o HTML hoje em produção, verbatim, mais a elevação visual mecânica (RN-13) para os 5 templates simples — nenhuma reescrita de texto é feita pelo seed | Seção 1.3 desta spec |
| RN-04 | `onUserCreated` suprime o envio genérico quando o documento `users/{uid}` foi criado por uma rota que já enfileirou um e-mail específico (`skip_welcome_email: true` no documento) | UC-55 RN-04 |
| RN-05 | `sendAccessRejectionEmail`/UC-03 passa a ler `email_templates` diretamente dentro de `functions/src/sendRejectionEmail.ts` (via `emailService.ts`), sem alterar o mecanismo de `fetch`+custom token já usado por `access-requests/[id]/reject/route.ts` — decisão de tech design explicitamente delegada pelo UC-55 (RN-11: "a definir em tech design") | UC-55 RN-11 |
| RN-06 | Variáveis opcionais com conteúdo condicional (ex.: motivo de rejeição) são resolvidas pelo chamador **antes** de chamar `renderTemplate` — o chamador monta o bloco HTML condicional inteiro (`""` ou `<p>...</p>`) e passa esse bloco já pronto como o valor de uma variável (ex.: `{{motivoBlock}}`), preservando o comportamento atual sem exigir lógica condicional dentro do template armazenado | Achado técnico desta investigação — `renderTemplate` é substituição simples, sem `{{#if}}` |
| RN-07 | `email_templates`/`versions` não integra com `audit_log` (UC-53) — o próprio histórico de versões (RF-07) já registra autor e timestamp de cada edição, tornando uma segunda trilha paralela redundante | Decisão de design desta spec (Seção 4.2) |
| RN-08 | Nenhuma linha de `src/app/api/tenants/create/route.ts` é alterada (gatilho #9, RN-14 do UC) | UC-55 RN-14 |

---

## 4. Decisões de Design

> A Seção 4.0 (acima, antes do Contexto) registra a decisão técnica confirmada pelo usuário (Opção A). As subseções abaixo implementam a **Opção A**.

### 4.1 Abordagem escolhida

- **Módulo puro `src/lib/emailTemplateRendering.ts`**, sem nenhum import de Firebase: `renderTemplate(text, variables)` (substituição simples de `{{chave}}`, chaves sem correspondência permanecem literais — não lança erro), `extractVariableKeys(text)` (lista de chaves `{{chave}}` usadas, sem duplicados), `validateTemplateVariables(subject, body, allowedKeys, requiredKeys)` (RF-05/RN-07 do UC: inválido se alguma chave usada não está em `allowedKeys`, ou se alguma `requiredKeys` não aparece em `subject`+`body`). Usado pelo client (preview, RF-03) e pela rota `PUT` (validação server-side, Opção A).
- **Espelho manual `functions/src/emailTemplateRendering.ts`** — mesma técnica já estabelecida em `functions/src/alertRules.ts` (`FEAT-agendamento-automatico-verificacao-alertas.md`, Seção 4.1/4.2): cópia deliberada de `renderTemplate` (só essa função — `functions/src/` nunca valida nem grava templates, só lê e renderiza para enviar), com comentário cruzado nos dois arquivos.
- **`src/lib/services/emailTemplateAdmin.ts` (Admin SDK)**: `getEmailTemplate(tipo)`, `getRenderedEmailTemplate(tipo, variables)` (usado pelos 8 pontos de escrita via `email_queue`), `saveEmailTemplateVersion(tipo, {subject, body}, actor)` (transação: lê o doc atual, empurra para `versions`, sobrescreve com o novo conteúdo — RF-06), `listEmailTemplateVersions(tipo)`, `revertEmailTemplateVersion(tipo, versionId, actor)` (transação simétrica — RF-07/Fluxo 7c do UC: a própria reversão também gera uma entrada de histórico).
- **`functions/src/services/emailTemplateService.ts` (Admin SDK, espelho funcional, não literal)**: só `getRenderedEmailTemplate(tipo, variables)` — inclui a inicialização defensiva (`if (!admin.apps.length) admin.initializeApp();`, Seção 1.1.2) e lança erro se o documento não existir (RN-06 do UC: Firestore é fonte única, sem fallback hardcoded).
- **Script de seed `scripts/seed-email-templates.ts`** (Admin SDK, `tsx`, idempotente — só cria se o documento ainda não existir, a menos que `--force` seja passado): popula os 12 `tipo`s com o HTML hoje em produção, mais o wrapper visual (RN-13) para os 5 templates simples, reaproveitando o mesmo esqueleto de `<style>`/cabeçalho já usado em `sendWelcomeEmail`/`generateResetPasswordEmailHtml` (gradiente azul `#0ea5e9`/`#0284c7`, já usado em `consultant_welcome`, reaproveitado nos 5 para consistência visual — detalhe cosmético, livremente ajustável depois via a própria tela).
- **`emailService.ts` perde as 3 funções geradoras de HTML** (`sendWelcomeEmail`, `sendRejectionEmail`, `sendNewTenantNotification`) — os 4 chamadores em `functions/src/` passam a chamar `getRenderedEmailTemplate` + `sendEmail` diretamente. `sendTemporaryPasswordEmail` e `sendCustomEmail` (órfãs, RN-02 do UC) **não são tocadas**. `getRoleName`/`getPlanName` permanecem exportados, agora usados para resolver o valor das variáveis `{{role}}`/`{{planName}}` antes de chamar `getRenderedEmailTemplate`.
- **Callable nova `functions/src/sendTemplateTestEmail.ts`** — mesmo padrão de `sendCustomEmail.ts` (valida `is_system_admin`, recebe `{ to, subject, html }` já renderizado no client com valores de exemplo, chama `sendEmail` com prefixo `[TESTE]` no assunto, RNF-04). Chamada do editor via `httpsCallable(functions, 'sendTemplateTestEmail')` — mesmo idioma já usado em `tenantService.ts` (`httpsCallable`), ainda que aquele arquivo específico esteja hoje desalinhado do `functions/src/index.ts` real (achado incidental, fora de escopo — ver Seção 10).

### 4.2 Alternativas descartadas

- **Escrita direta via client SDK (Opção B, literal a RNF-02)**: mantinha a regra `allow write: if isSystemAdmin()` como o UC-55 pede, mas deixava a validação de RN-07 só no client antes do `updateDoc()` — contradiz o texto explícito de RNF-05 ("o client nunca é a única fonte de verdade da validação"). Exigiria duas escritas client-side separadas e não-atômicas para o histórico de versões (push do histórico, depois overwrite do atual), com risco real de corrida se duas abas do mesmo admin salvarem simultaneamente. Descartada pela decisão confirmada na Seção 4.0.
- **Reaproveitar `audit_log` (UC-53) para editar templates**: descartada — o histórico de versões (RF-07) já cobre autor+timestamp+reversão para esta entidade específica; duplicar em `audit_log` criaria duas trilhas paralelas para o mesmo evento, sem ganho real (RN-07 desta spec).
- **Templates com blocos condicionais (`{{#if}}`)**: descartada em favor de RN-06 desta spec (bloco pré-resolvido pelo chamador) — motor de template completo (Handlebars etc.) seria desproporcional a 12 templates com poucos pontos condicionais, e introduziria uma dependência nova só para isso.
- **Cache do documento `email_templates/{tipo}` em memória do processo da Cloud Function**: descartada — RNF-03 do UC-55 já qualifica o impacto de latência como pequeno frente ao envio SMTP; cache introduziria risco de servir conteúdo desatualizado por minutos após uma edição, contra o espírito de "editar sem deploy".
- **Reescrever o texto dos 12 e-mails durante o seed**: descartada explicitamente (Seção 1.3) — é trabalho editorial do `system_admin`, não uma decisão de arquitetura desta spec.

### 4.3 Trade-offs aceitos

- `functions/src/emailTemplateRendering.ts` é uma cópia deliberada (não uma única fonte) de `src/lib/emailTemplateRendering.ts` — mesmo trade-off já aceito e documentado em `alertRules.ts` (risco de deriva mitigado por comentário cruzado + revisão de PR, não por sincronização automática).
- Se o seed (Branch A) não tiver sido executado contra um ambiente antes do deploy de Branch C/D **nesse mesmo ambiente**, os 12 e-mails migrados param de ser enviados (erro logado, não propagado, mesmo padrão de robustez de `onUserCreated.ts` hoje) — aceito como responsabilidade de sequenciamento de deploy, não de código defensivo adicional (ver Seção 10, Riscos).
- `renderTemplate` nunca lança erro para chave não resolvida — prioriza nunca travar um envio de produção por uma variável ausente, em troca de possivelmente deixar um `{{chave}}` literal visível no e-mail final se o chamador esquecer de passar alguma variável (risco mitigado por RF-05 no momento de salvar, não no momento de enviar).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito | Branch |
|---------|------|-----------|--------|
| `src/lib/emailTemplateRendering.ts` | Módulo puro | `renderTemplate`, `extractVariableKeys`, `validateTemplateVariables` | A |
| `src/__tests__/emailTemplateRendering.test.ts` | Teste unitário | Cobertura das 3 funções puras | A |
| `src/lib/services/emailTemplateAdmin.ts` | Serviço (Admin SDK) | `getEmailTemplate`, `getRenderedEmailTemplate`, `saveEmailTemplateVersion`, `listEmailTemplateVersions`, `revertEmailTemplateVersion` | A |
| `functions/src/emailTemplateRendering.ts` | Módulo (espelho) | Cópia de `renderTemplate`, comentário cruzado | A |
| `functions/src/services/emailTemplateService.ts` | Serviço (Admin SDK) | `getRenderedEmailTemplate` (com init defensivo) | A |
| `scripts/seed-email-templates.ts` | Script | Seed idempotente dos 12 `tipo`s | A |
| `src/app/api/email-templates/route.ts` | API route | `GET` lista os 12 templates | B |
| `src/app/api/email-templates/[tipo]/route.ts` | API route | `GET` single, `PUT` salvar nova versão (validação RF-05) | B |
| `src/app/api/email-templates/[tipo]/versions/route.ts` | API route | `GET` histórico de versões | B |
| `src/app/api/email-templates/[tipo]/versions/[versionId]/revert/route.ts` | API route | `POST` reverter | B |
| `functions/src/sendTemplateTestEmail.ts` | Cloud Function (callable) | Envio de e-mail de teste (RF-04) | B |
| `src/app/(admin)/admin/email-templates/page.tsx` | Página | Lista dos 13 gatilhos (12 editáveis + #9 informativo) | B |
| `src/app/(admin)/admin/email-templates/[tipo]/page.tsx` | Página | Editor: assunto/corpo, preview, teste, histórico/revert | B |
| `tests/e2e/UC-55-editar-templates-de-email.spec.ts` | Teste E2E | Gerado pelo `qa-agent`, revisão humana obrigatória | E |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança | Branch |
|---------|---------------------|--------|
| `src/types/index.ts` | + `EmailTemplateVariable`, `EmailTemplateDoc`, `EmailTemplateVersion`, `EmailTemplateCategory` | A |
| `firestore.rules` | + `match /email_templates/{document=**} { allow read, write: if false; }` (Opção A, Seção 4.0) | A |
| `src/components/admin/AdminLayout.tsx` | + item de menu "Templates de E-mail" (`/admin/email-templates`) | B |
| `functions/src/index.ts` | + `export { sendTemplateTestEmail } from './sendTemplateTestEmail';` | B |
| `src/app/api/access-requests/[id]/approve/route.ts` | Remove `generateWelcomeEmailHtml`; usa `getRenderedEmailTemplate('welcome_approval', ...)`; grava `skip_welcome_email: true` no doc `users/{uid}` (RN-04) | C |
| `src/lib/services/passwordResetService.ts` | Remove `generateResetPasswordEmailHtml`; usa `getRenderedEmailTemplate('password_reset', ...)` | C |
| `src/app/api/consultants/route.ts` | Remove `generateConsultantWelcomeEmail`; usa `getRenderedEmailTemplate('consultant_welcome', ...)`; grava `skip_welcome_email: true` no doc `users/{uid}` (RN-04) | C |
| `src/app/api/consultants/[id]/route.ts` | Remove HTML inline; usa `getRenderedEmailTemplate('consultant_email_changed', ...)` (2x) | C |
| `src/app/api/consultants/claims/route.ts` | Remove HTML inline; usa `getRenderedEmailTemplate('consultant_transfer_request', ...)` | C |
| `src/app/api/tenants/[id]/consultant/invite/route.ts` | Remove HTML inline; usa `getRenderedEmailTemplate('consultant_invite_created', ...)` | C |
| `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` | Remove HTML inline; usa `getRenderedEmailTemplate('consultant_transfer_approved', ...)` | C |
| `src/app/api/consultants/transfer-requests/[id]/reject/route.ts` | Remove HTML inline; usa `getRenderedEmailTemplate('consultant_transfer_rejected', ...)` (RN-06: `motivoBlock`) | C |
| `functions/src/services/emailService.ts` | Remove `sendWelcomeEmail`, `sendRejectionEmail`, `sendNewTenantNotification`; mantém `sendEmail`, `getRoleName`, `getPlanName`, `sendTemporaryPasswordEmail`, `sendCustomEmail` | D |
| `functions/src/onUserCreated.ts` | Lê `email_templates/generic_user_welcome`; suprime envio se `userData.skip_welcome_email === true` (RN-04) | D |
| `functions/src/onTenantCreated.ts` | Lê `email_templates/new_tenant_notification` | D |
| `functions/src/onAccessRequestCreated.ts` | Remove ~150 linhas de HTML inline; lê `email_templates/access_request_created` | D |
| `functions/src/sendRejectionEmail.ts` | Lê `email_templates/access_request_rejected` antes de chamar `sendEmail` (RN-11 do UC) | D |

### 5.3 Arquivos a REMOVER

N/A — feature aditiva; as remoções listadas acima são de **funções dentro** de arquivos existentes, não de arquivos inteiros.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `email_templates/{tipo}` | **Nova coleção** | Schema Seção 6.1; regra `allow read, write: if false` (Opção A, Seção 4.0); sem índice novo (RNF-06) |
| `email_templates/{tipo}/versions/{versionId}` | **Nova subcoleção** | Histórico revertível; sem índice novo (ordenação por `replaced_at` é campo único, auto-indexado) |
| `users/{uid}` | Campo novo, opcional | `skip_welcome_email: boolean`, gravado só pelas 2 rotas afetadas por RN-04 |
| `email_queue` | Nenhuma mudança de schema | Continua recebendo `subject`/`body` já renderizados — `processEmailQueue.ts` **não é alterado** |

### 5.5 O que NÃO muda

- `processEmailQueue.ts` — continua recebendo `subject`/`body` já resolvidos, sem nenhuma consciência de `email_templates`.
- `src/app/api/tenants/create/route.ts` (gatilho #9) — RN-14 do UC, Seção 1.1.1.
- `sendTemporaryPasswordEmail.ts`/`sendCustomEmail.ts`/`sendTempPasswordEmail`/`sendCustomEmail` — órfãs, fora de escopo (RN-02 do UC).
- `audit_log`/UC-53 — não integra com esta feature (RN-07 desta spec).
- `firestore.indexes.json` — nenhuma entrada nova (RNF-06).
- Nenhuma mudança de comportamento observável para o destinatário final além do que o `system_admin` decidir editar depois do deploy — o conteúdo seedado é idêntico ao atual (mais a elevação visual mecânica dos 5 templates simples).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

```ts
// src/types/index.ts — novo

export type EmailTemplateCategory = 'email' | 'internal_notification' | 'special_mechanism';

export interface EmailTemplateVariable {
  key: string;       // usado como {{key}} no assunto/corpo
  label: string;      // rótulo exibido no editor
  required: boolean;
  sample: string;     // valor usado no preview (RF-03) e no envio de teste (RF-04)
}

export interface EmailTemplateDoc {
  tipo: string;        // = id do documento, redundante por conveniência de export/list
  label: string;       // ex.: "Aprovação de Solicitação de Acesso"
  category: EmailTemplateCategory;
  related_uc: string;  // ex.: "UC-02"
  subject: string;
  body: string;        // HTML completo
  variables: EmailTemplateVariable[]; // fixa, não editável pela UI nesta v1 (RN-02 desta spec)
  updated_at: Timestamp;
  updated_by: string;      // uid
  updated_by_name: string;
}

export interface EmailTemplateVersion {
  id: string;
  subject: string;
  body: string;
  variables: EmailTemplateVariable[]; // snapshot no momento da substituição
  replaced_at: Timestamp;
  replaced_by: string;
  replaced_by_name: string;
}
```

Nenhuma interface existente (`AuditLogEntry`, `AuditEntityType`, `LegalDocument`, `CustomClaims`) é alterada.

### 6.2 Mudanças em serviços

```ts
// src/lib/emailTemplateRendering.ts — puro, sem import de Firebase
// ESPELHO: functions/src/emailTemplateRendering.ts replica renderTemplate() linha a linha.

export function renderTemplate(text: string, variables: Record<string, string>): string;
// Substitui todas as ocorrências de {{chave}} pelo valor correspondente; chaves sem
// correspondência permanecem literais (não lança erro) — RN-06/4.3 desta spec.

export function extractVariableKeys(text: string): string[];
// Lista (sem duplicados) das chaves {{chave}} usadas em um texto.

export interface TemplateValidationResult { valid: boolean; error?: string; }

export function validateTemplateVariables(
  subject: string,
  body: string,
  allowedKeys: string[],
  requiredKeys: string[]
): TemplateValidationResult;
// Inválido se extractVariableKeys(subject + body) contém uma chave fora de allowedKeys
// ("Variável {{x}} não é permitida para este template"), ou se alguma requiredKeys não
// aparece em subject+body ("Variável obrigatória {{y}} foi removida").
```

```ts
// src/lib/services/emailTemplateAdmin.ts — Admin SDK (Opção A, Seção 4.0)

export async function getEmailTemplate(tipo: string): Promise<EmailTemplateDoc | null>;

export async function getRenderedEmailTemplate(
  tipo: string,
  variables: Record<string, string>
): Promise<{ subject: string; body: string }>;
// getEmailTemplate + renderTemplate no subject e no body; lança erro se o doc não existir.

export async function saveEmailTemplateVersion(
  tipo: string,
  content: { subject: string; body: string },
  actor: { uid: string; name: string }
): Promise<void>;
// Transação: valida via validateTemplateVariables contra as `variables` do doc atual;
// empurra o conteúdo atual para email_templates/{tipo}/versions/{novoId}; sobrescreve
// subject/body/updated_at/updated_by/updated_by_name no doc atual. Lança erro de validação
// (RF-05) antes de tocar a transação.

export async function listEmailTemplateVersions(tipo: string): Promise<EmailTemplateVersion[]>;
// orderBy('replaced_at', 'desc') — sem índice composto necessário.

export async function revertEmailTemplateVersion(
  tipo: string,
  versionId: string,
  actor: { uid: string; name: string }
): Promise<void>;
// Transação simétrica a saveEmailTemplateVersion: empurra o atual para versions (preserva
// rastreabilidade da própria reversão, Fluxo 7c do UC), sobrescreve com o conteúdo da versão
// escolhida.
```

```ts
// functions/src/services/emailTemplateService.ts — Admin SDK

export async function getRenderedEmailTemplate(
  tipo: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string }>;
// if (!admin.apps.length) admin.initializeApp(); (Seção 1.1.2)
// lê adminDb-equivalente (admin.firestore()).collection('email_templates').doc(tipo).get();
// lança erro claro se ausente (RN-06 do UC: sem fallback); renderiza com renderTemplate
// (espelho, functions/src/emailTemplateRendering.ts).
```

Pontos de chamada (Branch C, `email_queue`):

- `approve/route.ts`: `getRenderedEmailTemplate('welcome_approval', { displayName, email, businessName, passwordResetLink })`; ao criar `users/{user_id}`, adicionar `skip_welcome_email: true`.
- `passwordResetService.ts`: `getRenderedEmailTemplate('password_reset', { displayName, resetLink })`.
- `consultants/route.ts`: `getRenderedEmailTemplate('consultant_welcome', { name, email, code })`; ao criar `users/{userId}`, adicionar `skip_welcome_email: true`.
- `consultants/[id]/route.ts`: `getRenderedEmailTemplate('consultant_email_changed', { name, previousEmail, newEmail: emailLower })`, reaproveitado nos 2 envios.
- `consultants/claims/route.ts`: `getRenderedEmailTemplate('consultant_transfer_request', { currentConsultantName, requestingConsultantName, requestingConsultantCode, tenantName })`.
- `tenants/[id]/consultant/invite/route.ts`: `getRenderedEmailTemplate('consultant_invite_created', { consultantName, tenantName })`.
- `transfer-requests/[id]/approve/route.ts`: `getRenderedEmailTemplate('consultant_transfer_approved', { requestingConsultantName, tenantName })`.
- `transfer-requests/[id]/reject/route.ts`: `getRenderedEmailTemplate('consultant_transfer_rejected', { requestingConsultantName, tenantName, motivoBlock: reason ? \`<p><strong>Motivo:</strong> ${reason}</p>\` : '' })` (RN-06 desta spec).

Pontos de chamada (Branch D, `functions/src/`):

- `onUserCreated.ts`: `if (userData.skip_welcome_email === true) { return; }` antes de qualquer envio; senão `getRenderedEmailTemplate('generic_user_welcome', { displayName: full_name, role: getRoleName(role) })` + `sendEmail`.
- `onTenantCreated.ts`: `getRenderedEmailTemplate('new_tenant_notification', { tenantName: name, tenantEmail: email, planName: getPlanName(plan_id) })` + `sendEmail` (destino fixo, inalterado).
- `onAccessRequestCreated.ts`: `getRenderedEmailTemplate('access_request_created', { documentNumber: formattedDocument, documentType, fullName, email, businessName })` + `sendEmail`.
- `sendRejectionEmail.ts`: dentro do callable, antes de enviar: `getRenderedEmailTemplate('access_request_rejected', { displayName: data.displayName, businessName: data.businessName, motivoBlock: data.rejectionReason ? ... : '' })` + `sendEmail` (RN-05 desta spec/RN-11 do UC).

### 6.3 Mudanças na UI

**`src/app/(admin)/admin/email-templates/page.tsx`** (novo, protegida pelo grupo `(admin)` já restrito a `system_admin`): lista os 13 gatilhos agrupados por `category`. Os 12 vêm de `GET /api/email-templates`; a linha do #9 é estática/hardcoded no componente (sem fetch), marcada como "Gerenciado em Cadastro de Clínica — corpo livre por envio, não editável aqui", sem link de edição (Seção 1.1.1).

**`src/app/(admin)/admin/email-templates/[tipo]/page.tsx`** (novo): formulário (Input assunto, Textarea corpo — mesmo padrão de `LegalDocumentForm.tsx`), painel de variáveis permitidas (badges, obrigatórias destacadas), botão "Pré-visualizar" (renderTemplate client-side com os `sample` de cada variável, exibido num painel, RF-03), botão "Enviar e-mail de teste" (prompt de e-mail destino, chama `httpsCallable(functions, 'sendTemplateTestEmail')` com o conteúdo em edição já renderizado com os `sample`, RF-04), botão "Salvar" (chama `PUT /api/email-templates/[tipo]`, exibindo o erro específico de RF-05 se houver), botão "Ver histórico" (abre modal com `GET .../versions`, botão "Reverter" por item chama `POST .../revert`).

**`src/components/admin/AdminLayout.tsx`**: novo item `{ name: 'Templates de E-mail', href: '/admin/email-templates', icon: Mail }`, posicionado após "Configurações" (ou outra posição visualmente coerente).

### 6.4 Mudanças em API Routes

| Rota | Método | Auth | Request | Response |
|------|--------|------|---------|----------|
| `/api/email-templates` | GET | Bearer + `is_system_admin` | — | `{ success: true, data: EmailTemplateDoc[] }` |
| `/api/email-templates/[tipo]` | GET | Bearer + `is_system_admin` | — | `{ success: true, data: EmailTemplateDoc }` |
| `/api/email-templates/[tipo]` | PUT | Bearer + `is_system_admin` | `{ subject: string; body: string }` | `{ success: true }` ou `{ error: string }` (RF-05) |
| `/api/email-templates/[tipo]/versions` | GET | Bearer + `is_system_admin` | — | `{ success: true, data: EmailTemplateVersion[] }` |
| `/api/email-templates/[tipo]/versions/[versionId]/revert` | POST | Bearer + `is_system_admin` | — | `{ success: true }` |

Todas seguem o padrão já usado em `/api/consultants/**`/`/api/users/**` (Bearer token, `adminAuth.verifyIdToken`, checagem de `is_system_admin`).

---

## 7. Plano de Implementação

### Branch A — `feature/uc55-email-templates-foundation`

#### STEP 1 — Tipos de domínio
**Objetivo:** Definir `EmailTemplateDoc`, `EmailTemplateVariable`, `EmailTemplateVersion`, `EmailTemplateCategory`.
**Arquivos:** `src/types/index.ts`.
**Validação:** `npm run type-check`.
**Commit:** `feat(types): add EmailTemplateDoc, EmailTemplateVariable and EmailTemplateVersion types`

#### STEP 2 — Módulo puro de renderização/validação
**Objetivo:** `renderTemplate`, `extractVariableKeys`, `validateTemplateVariables`, sem import de Firebase.
**Arquivos:** `src/lib/emailTemplateRendering.ts` — criar.
**Validação:** `npm run type-check`; conferir manualmente ausência de import de `firebase`/`firebase-admin`.
**Commit:** `feat(admin): add pure email template rendering and validation module`

#### STEP 3 — Testes unitários
**Objetivo:** Cobertura das 3 funções puras (CLAUDE.md item 8).
**Arquivos:** `src/__tests__/emailTemplateRendering.test.ts` — criar.
**Ações:** `renderTemplate`: substitui todas ocorrências; chave sem valor permanece literal. `extractVariableKeys`: sem duplicados, ordem estável. `validateTemplateVariables`: variável fora da lista → inválido com mensagem específica; obrigatória removida → inválido; tudo certo → válido.
**Validação:** `npm run test -- emailTemplateRendering`.
**Commit:** `test(admin): add unit tests for email template rendering and validation`

#### STEP 4 — Regra do Firestore
**Objetivo:** RNF-02 — implementar `allow read, write: if false` (Opção A, Seção 4.0, decisão confirmada).
**Arquivos:** `firestore.rules`.
**Ações:** Adicionar `match /email_templates/{document=**} { allow read, write: if false; }` (mesmo padrão de `password_reset_tokens`) — o `{document=**}` cobre a coleção `email_templates` e a subcoleção `versions`.
**Validação:** Testar contra o Firebase Emulator: nenhum client SDK consegue ler nem escrever, inclusive autenticado como `system_admin` — toda leitura/escrita passa exclusivamente pelas API routes com Admin SDK (Seção 6.4).
**Commit:** `feat(firebase): add firestore.rules for email_templates collection`

#### STEP 5 — Serviço Admin SDK (`src/`)
**Objetivo:** `getEmailTemplate`, `getRenderedEmailTemplate`, `saveEmailTemplateVersion`, `listEmailTemplateVersions`, `revertEmailTemplateVersion`.
**Arquivos:** `src/lib/services/emailTemplateAdmin.ts` — criar.
**Validação:** Testar manualmente contra o emulador com um documento seedado à mão.
**Commit:** `feat(admin): add emailTemplateAdmin service (get, save version, list/revert versions)`

#### STEP 6 — Espelho em `functions/src/`
**Objetivo:** Copiar `renderTemplate` (Seção 1.1.3/4.1).
**Arquivos:** `functions/src/emailTemplateRendering.ts` — criar, comentário cruzado apontando para `src/lib/emailTemplateRendering.ts` como fonte testada.
**Validação:** `cd functions && npm run build`.
**Commit:** `feat(admin): mirror email template rendering module into functions/src`

#### STEP 7 — Serviço Admin SDK (`functions/src/`)
**Objetivo:** `getRenderedEmailTemplate` com init defensivo.
**Arquivos:** `functions/src/services/emailTemplateService.ts` — criar.
**Validação:** `cd functions && npm run build`.
**Commit:** `feat(admin): add getRenderedEmailTemplate to functions/src emailTemplateService`

#### STEP 8 — Script de seed
**Objetivo:** Popular os 12 `tipo`s com o HTML de produção + elevação visual RN-13.
**Arquivos:** `scripts/seed-email-templates.ts` — criar.
**Ações:** Para cada um dos 12 gatilhos (Seção 1.1), montar `EmailTemplateDoc` com o HTML/assunto hoje hardcoded (extraído literalmente do arquivo de origem), convertendo interpolações JS (`${var}`) para `{{var}}`; para os 5 templates simples (RN-13 do UC), envolver o conteúdo no esqueleto visual já usado nos demais. Upsert condicional (só cria se não existir, `--force` sobrescreve).
**Validação:** Executar contra o Firebase Emulator (`tsx scripts/seed-email-templates.ts`); confirmar os 12 documentos e nenhum documento para o #9.
**Commit:** `chore(admin): add seed-email-templates script for the 12 migrated triggers`

---

### Branch B — `feature/uc55-editor-tela-admin`

#### STEP 9 — API routes de leitura/gravação
**Arquivos:** `src/app/api/email-templates/route.ts`, `src/app/api/email-templates/[tipo]/route.ts` — criar.
**Validação:** Testar manualmente `GET`/`PUT` com Postman/curl contra o emulador, incluindo o caso de validação falhando (RF-05).
**Commit:** `feat(admin): add email-templates list, get and save API routes`

#### STEP 10 — API routes de histórico/reversão
**Arquivos:** `src/app/api/email-templates/[tipo]/versions/route.ts`, `.../versions/[versionId]/revert/route.ts` — criar.
**Validação:** Testar manualmente salvar 2x e depois reverter; confirmar 2 entradas no histórico (RF-07).
**Commit:** `feat(admin): add email-templates version history and revert API routes`

#### STEP 11 — Callable de e-mail de teste
**Arquivos:** `functions/src/sendTemplateTestEmail.ts` — criar; `functions/src/index.ts` — exportar.
**Validação:** `cd functions && npm run build`; testar via emulador de functions com SMTP de teste.
**Commit:** `feat(admin): add sendTemplateTestEmail callable function`

#### STEP 12 — Tela de lista
**Arquivos:** `src/app/(admin)/admin/email-templates/page.tsx` — criar.
**Validação:** Logado como `system_admin`, ver os 13 gatilhos, 12 clicáveis e o #9 informativo.
**Commit:** `feat(admin): add /admin/email-templates list screen`

#### STEP 13 — Tela de edição
**Arquivos:** `src/app/(admin)/admin/email-templates/[tipo]/page.tsx` — criar.
**Validação:** Editar um template, prever, enviar teste, salvar, reverter — todos os fluxos do UC-55 (Seção 6/7).
**Commit:** `feat(admin): add /admin/email-templates editor screen with preview, test send and version history`

#### STEP 14 — Menu
**Arquivos:** `src/components/admin/AdminLayout.tsx`.
**Validação:** Item visível só para `system_admin`.
**Commit:** `feat(admin): add Email Templates menu item to AdminLayout`

---

### Branch C — `feature/uc55-migrar-consumidores-email-queue`

#### STEP 15 — `welcome_approval` + `password_reset`
**Arquivos:** `src/app/api/access-requests/[id]/approve/route.ts`, `src/lib/services/passwordResetService.ts`.
**Ações:** Substituir geradores inline por `getRenderedEmailTemplate`; em `approve/route.ts`, adicionar `skip_welcome_email: true` ao criar `users/{user_id}` (RN-04, parte 1 de 2).
**Validação:** Aprovar uma solicitação de teste; confirmar 1 único e-mail de boas-vindas recebido (não 2) — a supressão completa depende também da Branch D (Step 19); até lá, esperar 2 e-mails ainda, documentar isso na PR.
**Commit:** `feat(requests): migrate welcome_approval and password_reset to email_templates`

#### STEP 16 — `consultant_welcome`
**Arquivos:** `src/app/api/consultants/route.ts`.
**Ações:** Substituir gerador inline; adicionar `skip_welcome_email: true` ao criar `users/{userId}` (RN-04, parte 1 de 2).
**Validação:** Criar consultor de teste, confirmar e-mail `consultant_welcome` migrado.
**Commit:** `feat(requests): migrate consultant_welcome to email_templates and suppress duplicate welcome email`

#### STEP 17 — 5 templates de consultor restantes
**Arquivos:** `src/app/api/consultants/[id]/route.ts`, `src/app/api/consultants/claims/route.ts`, `src/app/api/tenants/[id]/consultant/invite/route.ts`, `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`, `src/app/api/consultants/transfer-requests/[id]/reject/route.ts`.
**Ações:** Mesma mecânica nos 5 arquivos (Seção 6.2); em `reject/route.ts`, montar `motivoBlock` antes de chamar `getRenderedEmailTemplate` (RN-06).
**Validação:** Testar manualmente os 5 fluxos (troca de e-mail, pedido/aprovação/rejeição de transferência, convite).
**Commit:** `feat(requests): migrate remaining 5 consultant email_queue triggers to email_templates`

---

### Branch D — `feature/uc55-migrar-cloud-functions-e-fix-duplicidade`

#### STEP 18 — Refatorar `emailService.ts`
**Arquivos:** `functions/src/services/emailService.ts`.
**Ações:** Remover `sendWelcomeEmail`, `sendRejectionEmail`, `sendNewTenantNotification`; manter o restante intocado.
**Validação:** `cd functions && npm run build` (erros de import guiam os próximos steps).
**Commit:** `refactor(admin): remove hardcoded HTML generators from emailService`

#### STEP 19 — `onUserCreated` + correção da duplicidade
**Arquivos:** `functions/src/onUserCreated.ts`.
**Ações:** `if (userData.skip_welcome_email === true) return;` antes de tudo; senão `getRenderedEmailTemplate('generic_user_welcome', ...)` + `sendEmail`.
**Validação:** Aprovar solicitação de teste (Step 15) e criar consultor de teste (Step 16) novamente — confirmar agora **exatamente 1** e-mail cada (RF-10); criar usuário direto via `/admin/users` (UC-39/UC-40) e confirmar que o e-mail genérico **continua** sendo enviado (sem `skip_welcome_email`).
**Commit:** `fix(admin): migrate onUserCreated to email_templates and suppress duplicate welcome email`

#### STEP 20 — `onTenantCreated`
**Arquivos:** `functions/src/onTenantCreated.ts`.
**Validação:** Criar clínica de teste, confirmar notificação interna migrada.
**Commit:** `feat(admin): migrate onTenantCreated notification to email_templates`

#### STEP 21 — `onAccessRequestCreated`
**Arquivos:** `functions/src/onAccessRequestCreated.ts`.
**Ações:** Remover ~150 linhas de HTML inline; usar `getRenderedEmailTemplate('access_request_created', ...)`.
**Validação:** Criar solicitação de acesso de teste, confirmar notificação ao `system_admin` migrada.
**Commit:** `feat(admin): migrate onAccessRequestCreated notification to email_templates`

#### STEP 22 — `sendAccessRejectionEmail`/UC-03
**Arquivos:** `functions/src/sendRejectionEmail.ts`.
**Ações:** Ler `email_templates/access_request_rejected` antes de `sendEmail` (RN-05 desta spec/RN-11 do UC). Nenhuma mudança em `access-requests/[id]/reject/route.ts` (mecanismo de `fetch`+custom token permanece).
**Validação:** Rejeitar solicitação de teste, confirmar e-mail migrado.
**Commit:** `fix(admin): migrate sendAccessRejectionEmail to read template from email_templates`

---

### Branch E — `feature/uc55-caderno-playwright`

#### STEP 23 — Caderno de teste automatizado (qa-agent)
**Objetivo:** Cobrir o Fluxo Principal e os Fluxos 7a-7c/8a-8d do UC-55 (CLAUDE.md item 8).
**Ações:** Acionar o `qa-agent` com esta spec (Seções 6/7) e o UC-55 como referência; gerar `tests/e2e/UC-55-editar-templates-de-email.spec.ts` cobrindo: lista dos 13 gatilhos, edição+preview+salvar, erro de validação (8b), envio de e-mail de teste, histórico+reversão (7c), bloqueio de acesso não-admin (8a). Revisão humana obrigatória antes de virar gate de CI.
**Validação:** `npm run test:e2e` local passa; revisado e aprovado manualmente.
**Commit:** `test(admin): add UC-55 Playwright spec (qa-agent, revisado)`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-------------------|------------------------|
| `renderTemplate` | `src/__tests__/emailTemplateRendering.test.ts` | Substituição simples; chave sem valor permanece literal; múltiplas ocorrências da mesma chave |
| `extractVariableKeys` | idem | Sem duplicados; string sem variáveis retorna vazio |
| `validateTemplateVariables` | idem | Variável fora da lista → inválido; obrigatória removida → inválido; válido quando tudo conforme |
| `getEmailTemplate`, `getRenderedEmailTemplate`, `saveEmailTemplateVersion`, `listEmailTemplateVersions`, `revertEmailTemplateVersion` (`emailTemplateAdmin.ts`) | — (não testado no MVP, mesmo critério de orquestradores Firestore já aceito em UC-53 para `writeAuditLog`/`listAuditLog` antes da revisão pós-PR#293) | Coberto pelo caderno Playwright (Branch E) |
| `functions/src/emailTemplateRendering.ts` (espelho) | — não testado independentemente (mesmo critério já aceito para `functions/src/alertRules.ts`) | Cópia deliberada de módulo já testado do lado `src/` |
| 12 pontos de instrumentação (`src/app/api/**`, `functions/src/`) | — (não testado no MVP) | Coberto pelo caderno Playwright + validação manual por step (Seção 7) |
| `AdminLayout`, páginas React | — (não testado no MVP) | Coberto pelo caderno Playwright |

Regra aplicada (CLAUDE.md item 8): funções puras de renderização/validação — prioridade alta, sempre testadas. Orquestradores Firestore e UI — cobertos pelo caderno Playwright (qa-agent), mesmo critério já em vigor desde UC-51/UC-53.

---

## 9. Checklist de Definition of Done

```
[ ] Decisão da Seção 4.0 (Opção A — escrita mediada por API route) confirmada pelo usuário em 30/09/2026 e incorporada nas Seções 4-9 antes de iniciar a implementação
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] cd functions && npm run build — sem erros
[ ] npm run test        — todos os testes passando, incluindo emailTemplateRendering.test.ts
[ ] Multi-tenant: N/A para email_templates (RNF-01), confirmado que nenhuma query introduzida ignora tenant_id nas coleções existentes tocadas (users)
[ ] Segurança: regra de email_templates testada manualmente contra o emulador conforme a Opção A (Seção 4.0) — `if false`, escrita só via API route
[ ] Seed executado manualmente em gscandelari_setup ANTES de validar Branch C/D nesse ambiente, e em produção ANTES do merge de Branch C/D em master
[ ] Os 12 gatilhos migrados testados manualmente, 1 a 1, confirmando e-mail recebido com o conteúdo esperado
[ ] Confirmado que UC-02 (aprovar solicitação) e UC-28 (criar consultor) geram exatamente 1 e-mail de boas-vindas cada (RF-10), e que UC-39/UC-40 (criação direta) continuam gerando o e-mail genérico
[ ] Confirmado que o gatilho #9 (tenants/create) continua funcionando de forma idêntica, sem nenhuma linha alterada
[ ] Fluxos de preview, envio de teste, salvar com validação (8b), histórico e reversão testados manualmente na tela /admin/email-templates
[ ] Branch pessoal: cada task branch mergeada em gscandelari_setup para validação no Firebase, antes do PR para develop
[ ] PR: aberto para develop com template preenchido, em cada branch
[ ] Caderno Playwright (tests/e2e/UC-55-*.spec.ts) gerado pelo qa-agent e revisado por humano antes de virar gate de CI
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Seed não executado em um ambiente antes do deploy de Branch C/D nesse ambiente — os 12 e-mails migrados param de ser enviados silenciosamente (erro logado, não propagado) | Média | Alto | DoD explícito (Seção 9); ordem de branches documentada na Seção 0; considerar, na implementação, um log de nível mais visível (não apenas `console.error`) quando `getRenderedEmailTemplate` falhar por documento ausente |
| Divergência entre `functions/src/emailTemplateRendering.ts` (espelho) e `src/lib/emailTemplateRendering.ts` (fonte testada) ao longo do tempo | Média | Médio | Comentário cruzado nos dois arquivos + revisão de PR obrigatória, mesmo padrão já aceito em `alertRules.ts` |
| Correção da duplicidade (RN-04) quebrar o fluxo de criação direta de usuário (UC-39/UC-40), que depende do disparo **não** suprimido de `onUserCreated` | Baixa | Alto | Validação manual explícita no Step 19 cobrindo os 3 cenários (UC-02, UC-28, UC-39/UC-40) antes do merge |
| `sendTemplateTestEmail` ser usado para enviar volume de e-mails de teste disfarçados de produção | Baixa | Baixo | Prefixo `[TESTE]` no assunto (RNF-04) + log distinto; sem rate limit nesta v1 (fora de escopo, frequência de uso baixa por natureza da tela) |
| Seed (Branch A) copiar incorretamente uma interpolação `${var}` do HTML original, introduzindo um `{{var}}` inválido no template migrado | Média | Médio | Validação manual por gatilho no Step 15-22 (comparar e-mail recebido antes/depois da migração) antes do merge de cada branch |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `email_templates` | Nova coleção top-level, global (sem `tenant_id`), fonte única de verdade para assunto/corpo de 12 dos 13 gatilhos de e-mail do sistema |
| Espelho (mirror) | Cópia deliberada de um módulo puro entre `src/lib/` e `functions/src/`, necessária pela fronteira de empacotamento do deploy de Cloud Functions — mesma técnica de `alertRules.ts` |
| Gatilho | Ponto de código que dispara o envio de um e-mail (rota de API via `email_queue`, ou Cloud Function trigger/callable) |
| Renderização | Substituição de `{{variavel}}` pelo valor real no assunto/corpo de um template, feita por `renderTemplate` |
| Variável permitida | Chave de substituição (`{{key}}`) que um template específico autoriza usar, definida no seed, validada em `validateTemplateVariables` |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-55-editar-templates-de-email.md` (v1.1, Aprovado) — UC de origem
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-agendamento-automatico-verificacao-alertas.md` — precedente do padrão de espelho manual entre `src/lib/` e `functions/src/`, e da fronteira de empacotamento do deploy
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md` — usada como referência de formato/qualidade e de fatiamento em branches sequenciais
- `CLAUDE.md` (item 8) — obrigatoriedade de caderno de teste Playwright para toda feature
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, Conventional Commits, fluxo de PR
- `firestore.rules` — precedente `password_reset_tokens` (`allow read, write: if false`) e `legal_documents`/`system_settings` (`allow write: if isSystemAdmin()`), ambos citados na Seção 4.0
- `src/lib/auditLogPayload.ts`/`src/lib/auditLogAdmin.ts` (UC-53) — precedente de módulo puro compartilhado entre client e Admin SDK dentro de `src/`
- `src/components/admin/LegalDocumentForm.tsx` — precedente de editor com preview de conteúdo administrativo
- `functions/src/processEmailQueue.ts` — precedente do padrão de inicialização defensiva do Admin SDK dentro de Cloud Functions

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 30/09/2026 | Doc Writer (Claude) | Versão inicial. Spec de implementação derivada do UC-55 (v1.1, Aprovado). Investigado o código real dos 13 gatilhos (9 arquivos de rota via `email_queue` + 4 arquivos de `functions/src/`), confirmando que o gatilho #9 (RN-14 do UC) fica fora do mecanismo Firestore. Encontrada uma contradição objetiva entre RNF-02 (regra `isSystemAdmin()`, implica escrita client-direct) e RN-07/RNF-05 (validação de variáveis que a linguagem de regras do Firestore não expressa de forma confiável) — registrada como `⚠️ Decisão necessária` na Seção 4.0, com duas opções mutuamente exclusivas apresentadas; `Status: Aguardando decisão`. Resolvidas por conta própria, com base em texto explícito do UC que já delega à fase de implementação: o mecanismo exato de supressão da duplicidade (RN-04, campo `skip_welcome_email`) e o ponto de leitura de UC-03/RN-11 (dentro de `functions/src/sendRejectionEmail.ts`). Adotado o padrão de espelho manual (`functions/src/emailTemplateRendering.ts`) já estabelecido em `FEAT-agendamento-automatico-verificacao-alertas.md` para a fronteira de empacotamento entre `src/` e `functions/src/`. Proposto fatiamento em 5 branches sequenciais, maior que o precedente de UC-51 (2) e UC-53 (3), proporcional ao escopo real (13 RNs, dois runtimes de deploy, um bug fix e uma migração de mecanismo). |
| 1.1 | 30/09/2026 | Doc Writer (Claude) | Decisão da Seção 4.0 confirmada pelo usuário: Opção A (escrita mediada por API route com Admin SDK, validação RN-07/RNF-05 em TypeScript, histórico de versões em transação atômica, regra do Firestore `allow read, write: if false`, mesmo padrão de `password_reset_tokens`). Seção 4.0 reescrita para registrar a decisão confirmada (deixou de ser pendente); Seção 4.2 ganhou a Opção B como alternativa descartada; RNF-02/RNF-05 (3.2), Mapa de Impacto (5.2/5.4), STEP 4 (7) e Checklist/Riscos (9/10) atualizados para o texto final da regra do Firestore, sem ramificação condicional por opção. Confirmado, antes de alterar o Status, que as Seções 5, 6 e 7 já estavam integralmente escritas assumindo a Opção A, sem necessidade de ajuste de conteúdo técnico. `Status: Aguardando decisão` → `Planejamento`. |
