# Feature: Padronização dos e-mails (banner + rodapé) e links próprios de senha (primeiro acesso e redefinição)

**Projeto:** Curva Mestra
**Data:** 28/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Implementado (aguardando validação em dev)
**Tipo:** Feature
**Branch sugerida:** `feature/padronizacao-emails-e-links-de-senha`
**Prioridade:** Alta
**Versão:** 1.2

> Os 13 templates de e-mail passam a usar um layout único: banner por tipo, miolo editável no UC-55, rodapé e botão padrão, com HTML compatível com clientes de e-mail. Os links de senha passam a ser todos do Curva Mestra. O de redefinição ("Esqueci minha senha" e UC-08) vale 30 minutos. O de primeiro acesso vale 72 horas e é de uso único: deixa de valer na abertura. Ele vai nos e-mails de boas-vindas de usuário de clínica, de consultor, de admin de clínica cadastrada pelo system_admin (UC-21) e de aprovação de cadastro. Com isso, o admin deixa de definir a senha ao criar usuários. As 8 decisões de design foram respondidas pelo usuário em 28/10/2026 (seção 4.4) e o documento está pronto para o `dev-task-manager`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (hoje = `origin/develop` `ccc745a`, release 1.17.0). Antes de criar a branch, confirmar que `develop` local e remoto estão em sync com `master`.
- **Branch da task:** `feature/padronizacao-emails-e-links-de-senha`
- **Fluxo de PR:** `feature/padronizacao-emails-e-links-de-senha` → PR → `gscandelari_setup` (deploy automático em `dev-gscandelari.web.app`, validação) → PR → `develop` → PR de release → `master`. **Nunca** abrir PR da task direto para `master`, nem fazer merge manual antes do PR.
- **Antes do merge em `master` (release):** avisar o usuário com antecedência e passar os comandos para ele rodar em produção: deploy de rules (seção 5.4) e migração dos templates (STEP 9, autorizada pela DN-03 só no release). Avisar também que o deploy de functions de produção vai **apagar a function `onUserCreated`** (DN-08, STEP 14). Comandos no checklist da seção 9.

| Step | Tipo | Escopo | Mensagem (≤ 72 caracteres) |
|------|------|--------|-----------------------------|
| 1 | chore | email | `chore(email): adiciona banners e rodapé do layout de e-mail` |
| 2 | feat | email | `feat(email): cria layout base compartilhado com banner e rodapé` |
| 3a | fix | auth | `fix(auth): corrige invalidação de tokens de senha pendentes` |
| 3b | feat | auth | `feat(auth): adiciona finalidade e validade aos tokens de senha` |
| 4 | feat | auth | `feat(auth): torna o link de primeiro acesso de uso único` |
| 5 | feat | auth | `feat(auth): recuperação de senha com token próprio de 30 min` |
| 6a | feat | users | `feat(users): envia link de primeiro acesso ao criar usuário` |
| 6b | feat | consultants | `feat(consultants): envia link de primeiro acesso ao consultor` |
| 6c | feat | access-requests | `feat(access-requests): usa link próprio de primeiro acesso` |
| 6d | feat | tenants | `feat(tenants): remove senha manual do cadastro de clínica` |
| 7 | feat | email-templates | `feat(email-templates): editor passa a editar só o conteúdo` |
| 8 | feat | email-templates | `feat(email-templates): reescreve os 13 templates no layout novo` |
| 9 | chore | scripts | `chore(scripts): adiciona migração dos templates para o layout` |
| 10 | chore | rules | `chore(rules): bloqueia coleção de rate limit de senha` |
| 11 | test | email | `test(email): cobre layout, tokens de senha e rate limit` |
| 12 | test | e2e | `test(e2e): adiciona caderno de primeiro acesso e esqueci senha` |
| 13 | test | e2e | `test(e2e): atualiza cadernos UC-02, UC-07, UC-08 e UC-55` |
| 14 | chore | functions | `chore(functions): remove trigger onUserCreated` |

Todos os commits terminam com a linha de atribuição exigida pelo repositório.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Templates de e-mail (UC-55)**
- Existem 13 templates em `email_templates/{tipo}`, criados por `scripts/seed-email-templates.ts`. Cada um guarda o **HTML completo** no campo `body` (`<!DOCTYPE>`, `<head>`, header com gradiente, conteúdo, rodapé). Não há layout compartilhado. As cores variam por template (roxo `#667eea`, azul `#0ea5e9`, dourado `#c9a24a` só em `welcome_approval`). Os rodapés trazem o ano gravado no momento do seed (`${YEAR}`), e há links fixos misturando `curvamestra.com.br` e `curva-mestra.web.app`.
- Há dois caminhos de renderização, os dois com `renderTemplate` (substitui `{{chave}}`):
  - **Next (Admin SDK):** `src/lib/services/emailTemplateAdmin.ts`, com `getRenderedEmailTemplate` e `enqueueTemplatedEmail`. O resultado vai para `email_queue`, que a Cloud Function `functions/src/processEmailQueue.ts` envia. Usado por `consultants/route.ts`, `consultants/claims`, `consultants/[id]`, `transfer-requests/*/approve|reject`, `tenants/[id]/consultant/invite`, `users/[id]/reset-password`, `consultants/[id]/reset-password` e `accessRequestApproval.ts`.
  - **Functions (envio direto):** `functions/src/services/emailTemplateService.ts`, com `getRenderedEmailTemplate` e `sendEmail`. Usado por `onUserCreated` (`generic_user_welcome`), `onTenantCreated` (`new_tenant_notification`), `onAccessRequestCreated` (`access_request_created`), `sendRejectionEmail` (`access_request_rejected`) e `checkConsultantPendingAccessRequestsScheduled` (digest).
  - `functions/src/emailTemplateRendering.ts` é um **espelho manual** de `src/lib/emailTemplateRendering.ts`, porque o deploy de functions só empacota `functions/src`. O padrão de teste de paridade web↔functions já existe em `src/__tests__/nfPendingResolutionRules.test.ts`.
- O editor `/admin/email-templates/[tipo]` (`src/app/(admin)/admin/email-templates/[tipo]/page.tsx`) edita `subject` e `body` inteiros. O preview usa um `<iframe srcDoc>`, e o envio de teste chama a callable `sendTemplateTestEmail` com o HTML já renderizado.
- `sendEmail` (`functions/src/services/emailService.ts`) gera a versão texto com `stripHtmlTags`. Ela não descarta o conteúdo de `<style>` e perde as URLs dos links.

**Links de senha**
- **Token próprio (UC-08):** `src/lib/services/passwordResetService.ts` gera 32 bytes aleatórios e guarda só o hash SHA-256 (`TOKEN_EXPIRY_MINUTES = 30`) na coleção `password_reset_tokens`. As rotas são `GET /api/auth/validate-reset-token` (valida sem consumir) e `POST /api/auth/reset-password` (consome, troca a senha e limpa `requirePasswordChange`). A tela é `src/app/(auth)/reset-password/[token]/page.tsx`. Hoje só `POST /api/users/[id]/reset-password` e `POST /api/consultants/[id]/reset-password` criam esse token, ambos acionados pelo system_admin.
- **Bug encontrado:** `invalidateUserTokens` filtra `.where('used_at', '==', null)`, mas `createPasswordResetToken` **não grava** `used_at` (fica omitido). No Firestore, `== null` só encontra documentos em que o campo existe com valor `null`. Resultado: a consulta nunca encontra nada e os tokens antigos **não são invalidados**, nem quando um novo é emitido nem depois de uma redefinição. Além disso, `consumeToken` lê e depois escreve fora de transação, o que deixa uma janela de corrida com dois envios simultâneos.
- **`/forgot-password`** (`src/app/(auth)/forgot-password/page.tsx:46`) chama `sendPasswordResetEmail` do Firebase. O e-mail é o nativo do Firebase, sem o nosso layout e com a validade do Firebase (não 30 min), e o link leva ao handler do Firebase. O tratamento anti-enumeração (`auth/user-not-found` vira sucesso) já existe.
- **Aprovação de cadastro (UC-02/UC-56):** `src/lib/services/accessRequestApproval.ts` cria o usuário Auth **sem senha** e usa `adminAuth.generatePasswordResetLink` (link nativo do Firebase, `mode=resetPassword`) no template `welcome_approval`. O texto do template diz "expira em 24 horas", o que não corresponde à validade real do link nativo.
- **Cadastro `/register` (UC-01):** **não coleta senha** (UC-01 RN-03, commit `6402647`). A senha só é definida depois da aprovação, pelo link do e-mail. **Logo, não há conflito com a D3**: trocar o link nativo pelo link de primeiro acesso não muda o que a clínica faz no cadastro.
- **Criação de usuário de clínica (UC-39/UC-40):** `POST /api/users/create` exige `password`, cria o usuário com a senha escolhida pelo admin e grava `requirePasswordChange: true` nas claims e em `users/{uid}` (commit `467f462`, UC-39-RN-03). O e-mail `generic_user_welcome` sai por `onUserCreated` (trigger em `users/{userId}`), **sem link e sem senha**. Os diálogos são `src/components/clinic/UsersTab.tsx` (texto "O usuário receberá as credenciais…", UC-40 RN-10(b)) e `src/app/(admin)/admin/tenants/[id]/page.tsx` ("A senha definida aqui não é enviada por e-mail…").
- **Criação de consultor (UC-28):** `POST /api/consultants` gera `generateTempPassword()`, cria o usuário com ela e grava `requirePasswordChange: true`, mas **a senha nunca é enviada**. O `consultant_welcome` diz "Você será solicitado a defini-la/trocá-la no primeiro acesso", e o consultor só consegue entrar depois de uma ação do admin (UC-30 ou UC-08).
- **Cadastro de clínica pelo admin (UC-21):** `POST /api/tenants/create` recebe `temp_password` digitada pelo system_admin, grava `requirePasswordChange: true` e manda um e-mail de corpo livre (RN-14 do UC-55, fora dos templates). Como o doc `users` não tem `skip_welcome_email`, `onUserCreated` também envia `generic_user_welcome`. Esse fluxo não estava na lista da D3; **foi incluído pela DN-01** (o admin deixa de digitar senha também aqui).
- **URL base dos links:** `generateResetLink` usa `process.env.NEXT_PUBLIC_BASE_URL || 'https://curvamestra.com.br'`. `NEXT_PUBLIC_BASE_URL` **não está definida** em nenhum workflow (`deploy-firebase.yml`, `deploy-gscandelari-dev.yml`), então o ambiente dev também gera links apontando para produção, onde o token não existe.
- **Ambiente dev:** o `--only functions:...` de `deploy-gscandelari-dev.yml:115` **não inclui `processEmailQueue`**. É preciso verificar se ela existe em `curva-mestra-dev` para que os e-mails enfileirados sejam enviados durante a validação (ver risco R-08).
- **Firestore rules:** `password_reset_tokens`, `email_queue` e `email_templates` já negam acesso a client (`allow read, write: if false` / só leitura de system_admin em `email_queue`).
- **Playwright:** `npm run test:e2e` sobe só `auth,firestore,storage` (sem o emulador de functions), roda `seed-emulator.ts` e `seed-email-templates.ts`, e os specs conferem e-mails lendo `email_queue` (ex.: `UC-02…spec.ts:225`, `UC-08…spec.ts:217`). O spec do UC-07 confirma o envio nativo pela API de oobCodes do Auth Emulator. O do UC-02 confere `mode=resetPassword` no corpo.

**Arquivos de banner/rodapé (entrada recebida em 28/10/2026)**
- Local de origem, fora do projeto: `C:\Users\scand\Downloads\Banners e rodapé Email template\`. São 15 PNG RGB, todos com 600 px de largura e entre 49 e 85 KB cada.
- Identidade visual: gradiente dourado→preto, logo "M" dourado à esquerda e título em serifa dourada **embutido na imagem**.
- `1.png` traz literalmente o texto "Heading" (modelo genérico) e **não será publicado** (DN-04). `2.png` é o rodapé, com "© 2026 Curva Mestra / Gestão Inteligente de Estoque" embutido, e será usado como está (DN-05).

### 1.2 Problema identificado
1. Os e-mails não têm identidade visual consistente, e cada template repete o próprio esqueleto HTML. Mudar a marca exige editar 13 HTMLs.
2. A recuperação de senha self-service usa o e-mail do Firebase, sem o nosso layout e com validade diferente dos 30 minutos pedidos.
3. O primeiro acesso depende de senha definida pelo admin e repassada fora do sistema (UC-39/UC-40), ou de uma senha que nunca é entregue (UC-28). Não existe link de primeiro acesso com regra própria (72 h, uso único).
4. Tokens antigos não são invalidados, por causa do bug de `== null`.
5. Em dev, os links de senha apontam para o domínio de produção.

### 1.3 Motivação estratégica
Pedido explícito do usuário em 28/10/2026, com cliente real em produção desde 16/10/2026. Os e-mails são o primeiro contato da clínica com o produto. Tirar o admin da definição de senha reduz a exposição de credenciais, que já foi achado de segurança em UC-21-RN-03, UC-28-RN-04 e UC-39-RN-03.

---

## 2. Objetivos

1. **Garantir** que os 13 e-mails usem o mesmo layout: banner do tipo, miolo, botão padrão e rodapé, em HTML compatível com os principais clientes de e-mail e com versão texto.
2. **Substituir** o envio nativo do Firebase em `/forgot-password` por token próprio de 30 min e template `password_reset`, sem revelar se o e-mail existe e com rate limit.
3. **Adicionar** o link de primeiro acesso (72 h, uso único na abertura) aos e-mails `generic_user_welcome`, `consultant_welcome` e `welcome_approval`.
4. **Remover** a definição de senha pelo admin na criação de usuário de clínica (UC-39/UC-40), de consultor (UC-28) e no cadastro de clínica (UC-21, DN-01).
5. **Corrigir** a invalidação de tokens e a corrida no consumo.
6. **Garantir** que links e imagens usem a URL do ambiente certo (produção e dev).
7. **Manter** o miolo editável no UC-55, com banner e rodapé fixos.
8. **Migrar** os templates de produção sem perder customizações do admin e sem janela de e-mails quebrados.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Todo e-mail renderizado de um template com layout novo é composto de banner do tipo + miolo + botão(ões) padrão + rodapé (imagem e texto HTML fixo). | Sistema | Must |
| RF-02 | O banner de cada tipo é uma imagem fixa (mapeamento tipo → arquivo no código), com `alt` igual ao título embutido na imagem. | Sistema | Must |
| RF-03 | Em `/admin/email-templates/[tipo]`, o admin edita só o assunto e o **miolo**. O preview e o envio de teste mostram o miolo dentro do layout completo. | system_admin | Must |
| RF-04 | `/forgot-password` envia o e-mail `password_reset` do Curva Mestra com link `/reset-password/{token}` válido por 30 min. | Visitante | Must |
| RF-05 | `/forgot-password` mostra sempre a mesma mensagem, exista ou não o e-mail, esteja ou não ativo o usuário. | Visitante | Must |
| RF-06 | `/forgot-password` aplica rate limit por e-mail e por IP. | Sistema | Must |
| RF-07 | Ao criar usuário de clínica (UC-39/UC-40), o diálogo não pede senha. O sistema cria o usuário sem senha e enfileira `generic_user_welcome` com o link de primeiro acesso. | clinic_admin, system_admin | Must |
| RF-08 | Ao criar consultor (UC-28), o sistema não gera senha temporária e enfileira `consultant_welcome` com o link de primeiro acesso. | system_admin | Must |
| RF-09 | Na aprovação de cadastro (UC-02/UC-56), `welcome_approval` passa a levar o link de primeiro acesso do Curva Mestra, não o do Firebase. | system_admin, consultor | Must |
| RF-10 | O link de primeiro acesso vale 72 h a partir da emissão, enquanto não for aberto. | Sistema | Must |
| RF-11 | O link de primeiro acesso é invalidado no **clique em "Definir minha senha"** na página. O GET do link e o carregamento da página não invalidam (DN-02). Reabrir o link depois do clique (outra aba ou dispositivo) mostra "link já utilizado", com atalho para `/forgot-password`. | Usuário | Must |
| RF-12 | Depois do clique, o usuário tem **30 min** (DN-02) para enviar a nova senha. Recarregar a mesma aba mantém o formulário dentro dessa janela. Se ela vencer, ele precisa usar "Esqueci minha senha". | Usuário | Must |
| RF-13 | O link de redefinição (30 min) pode ser aberto mais de uma vez e é consumido no envio da nova senha. | Usuário | Must |
| RF-14 | Emitir um novo token para um usuário invalida todos os anteriores, de qualquer finalidade. Concluir a definição de senha também invalida os pendentes. | Sistema | Must |
| RF-15 | A tela de link inválido/expirado/usado oferece "Solicitar nova senha" (`/forgot-password`), e não mais "entre em contato com o administrador". | Usuário | Must |
| RF-16 | Concluir a definição de senha por link próprio marca `emailVerified: true` no Firebase Auth, já que o usuário provou ter acesso à caixa de e-mail. | Sistema | Should |
| RF-17 | Usuários criados por este fluxo não recebem `requirePasswordChange`. O mecanismo continua existindo para UC-30/UC-37 ("forçar troca") e para usuários antigos com a flag pendente. | Sistema | Must |
| RF-18 | Tipo de template sem banner mapeado: o layout sai **sem imagem de banner**, com o título (`label`) em texto HTML no topo. O `1.png` ("Heading") nunca é usado. Um teste Jest garante que os 13 tipos do seed têm banner próprio (DN-04). | Sistema | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | HTML do layout: tabelas (`role="presentation"`), CSS **inline**, largura máx. 600 px, sem `background-image` (Outlook desktop), sem `<style>` obrigatório, `<img>` com `width`/`height`/`alt`/`style="display:block"` e URLs absolutas HTTPS. | Compatibilidade |
| RNF-02 | Toda mensagem leva versão texto gerada de forma determinística: links no formato "texto (URL)", sem conteúdo de `<head>`/`<style>`. | Compatibilidade / Acessibilidade |
| RNF-03 | Token: 32 bytes de `crypto.randomBytes`, só o hash SHA-256 é persistido (já é assim) e o token cru nunca vai para logs. Abertura e consumo acontecem em `runTransaction`. | Segurança |
| RNF-04 | A sessão pós-abertura do primeiro acesso usa um segundo segredo aleatório (32 bytes), também guardado como hash e mantido só em memória/`sessionStorage` do navegador. | Segurança |
| RNF-05 | `POST /api/auth/forgot-password` responde com corpo e status idênticos para e-mail existente, inexistente e inativo. O 429 de rate limit não depende de a conta existir. | Segurança |
| RNF-06 | A rota `/reset-password/[token]` define `referrer: 'no-referrer'` para o token não vazar via `Referer`. | Segurança |
| RNF-07 | A URL base (links e imagens) vem do ambiente e **nunca** do header `Host`/`Origin` da requisição, para evitar injeção de host em link de redefinição. | Segurança |
| RNF-08 | Imagens otimizadas: alvo ≤ 40 KB por arquivo, sem perda perceptível. Peso total de imagens por e-mail ≤ 100 KB. | Performance |
| RNF-09 | URLs de imagem estáveis para sempre: e-mails já enviados continuam apontando para elas. Diretório versionado (`/email/v1/`) e nunca apagado. | Manutenibilidade |
| RNF-10 | Lógica pura de layout e regras de token em módulos sem Firebase, espelhados em `functions/src` com teste de paridade. | Manutenibilidade |
| RNF-11 | Multi-tenant inalterado: nenhuma claim nova, `tenant_id` dos tokens preservado como hoje, nenhuma consulta de tenant alterada. | Segurança |
| RNF-12 | Contraste do botão padrão ≥ 4,5:1 (WCAG AA) entre texto e fundo. | Acessibilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Finalidades de token: `password_reset` (30 min, consumido no envio da senha) e `first_access` (72 h, queimado na abertura). | Pedido do usuário + D1. |
| RN-02 | Token sem campo `purpose` (legado) é tratado como `password_reset`. | Compatibilidade com tokens já emitidos em produção e com os specs UC-08/UX-060, que gravam o formato atual. |
| RN-03 | Primeiro acesso aberto e não concluído não é reemitido automaticamente. O caminho é "Esqueci minha senha", que gera um `password_reset` de 30 min. | Pedido do usuário + D1. |
| RN-04 | "Esqueci minha senha" funciona para qualquer usuário com conta Auth ativa, inclusive quem nunca definiu senha (primeiro acesso expirado) e o system_admin. Usuário inativo (`customClaims.active === false`, incluindo clínica suspensa) ou consultor `suspended` **não recebe nada**, com a mesma resposta neutra (DN-07). | Self-service; o pedido não restringe papel. |
| RN-05 | O título do banner não é editável pelo admin. Mudar o título exige nova imagem e deploy. | O título está embutido na imagem. |
| RN-06 | Assunto e miolo continuam editáveis com as mesmas validações de variáveis do UC-55 (RF-05/RNF-05 daquele UC). Variáveis com link (`firstAccessLink`, `passwordResetLink`, `resetLink`) são obrigatórias. | Impede que o admin remova o link e deixe o usuário sem acesso. |
| RN-07 | `requirePasswordChange` não é mais gravado na criação de usuário (UC-39/UC-40/UC-28/UC-21). A rota de redefinição continua limpando a flag. | D2 + DN-01. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**A. Layout em código, miolo no Firestore (expand/contract)**
- Criar o módulo puro `src/lib/emailLayout.ts`, com espelho em `functions/src/emailLayout.ts` e teste de paridade. Ele contém:
  - `EMAIL_ASSET_VERSION = 'v1'`;
  - `EMAIL_BANNERS: Record<string, { file: string; alt: string }>`, o mapeamento tipo → arquivo (tabela 6.3.1);
  - `resolveAppBaseUrl(env)`;
  - `buildEmailLayout({ tipo, contentHtml, baseUrl, preheader? })`;
  - `renderEmailButton(href, label)`, o HTML do botão padrão, exportado para o seed e para o editor (snippet);
  - `htmlToPlainText(html)`.
- Adicionar ao `EmailTemplateDoc` o campo `content` (miolo) e `layout_version: 1`. **O campo legado `body` não é apagado nesta task.** Regra de renderização nos dois caminhos (`emailTemplateAdmin.getRenderedEmailTemplate` e `functions/.../emailTemplateService.getRenderedEmailTemplate`):
  - se `content` existe: `html = buildEmailLayout({ tipo, contentHtml: renderTemplate(content, vars), baseUrl })`;
  - senão (doc legado): `html = renderTemplate(body, vars)`, como hoje.
- Com isso a migração em produção roda **antes** do deploy e sem janela: o código antigo continua lendo `body`, o novo lê `content`. Remover `body` fica para uma task futura (contract).

**B. Imagens no Firebase Hosting (`public/email/v1/`)**
- Servidas em `https://<domínio do ambiente>/email/v1/<arquivo>.png`. Os dois targets de hosting (`curva-mestra` e `dev-gscandelari`) publicam `public/` automaticamente, o que dá HTTPS, URL estável e CDN sem regra nova.
- `resolveAppBaseUrl`, nesta ordem:
  1. `NEXT_PUBLIC_BASE_URL` (Next) ou `APP_BASE_URL` (functions), se definida;
  2. mapeamento pelo projeto (`NEXT_PUBLIC_FIREBASE_PROJECT_ID` no Next, `GCLOUD_PROJECT` nas functions): `curva-mestra` → `https://curvamestra.com.br` (DN-06), `curva-mestra-dev` → `https://dev-gscandelari.web.app`;
  3. caso contrário (emulador/E2E), `PLAYWRIGHT_BASE_URL`/`http://localhost:3100`, ou erro explícito se não houver nenhum.
- `generateResetLink` passa a usar `resolveAppBaseUrl`, o que resolve o problema 5 de 1.2.

**C. Um único mecanismo de token, com finalidade**
- Reaproveitar `password_reset_tokens` e `passwordResetService.ts`, adicionando `purpose`, `opened_at`, `session_hash`, `session_expires_at` e gravando `used_at: null` / `invalidated_at: null` explicitamente.
- As regras puras (expiração por finalidade e avaliação de estado) ficam em `src/lib/passwordTokenRules.ts`, sem Firebase e testáveis.

**D. Uso único sem o problema dos pré-visualizadores**
Antivírus e "Safe Links" (Outlook/Defender, Gmail, proxies corporativos) fazem GET, e às vezes executam JS, nos links do e-mail antes do usuário. Por isso:
1. O GET de `/reset-password/{token}` e o `GET /api/auth/validate-reset-token` **nunca** alteram o token.
2. Para `first_access`, a página mostra uma tela intermediária ("Olá, {e-mail mascarado}. Clique para definir sua senha.") com o botão **"Definir minha senha"**.
3. O clique faz `POST /api/auth/password-token/open`, que, em transação, confere o token (válido, não aberto), grava `opened_at` e devolve um `session` aleatório. O documento passa a guardar `session_hash` e `session_expires_at` (= `opened_at` + 30 min, DN-02). O navegador guarda `session` em `sessionStorage`, então o F5 na mesma aba mantém o formulário.
4. Daí em diante qualquer nova abertura do link responde "já utilizado". O formulário envia `{ token, session, new_password }`.
- O pedido diz "one-click": o que invalida é o **primeiro clique humano** na página, não o carregamento (confirmado na DN-02).

**E. Recuperação de senha via API própria**
`POST /api/auth/forgot-password` (pública, sem auth):
1. valida o formato do e-mail;
2. aplica rate limit em transação na coleção `password_reset_rate_limits`, com documento por `sha256('email:'+email)` e por `sha256('ip:'+ip)` (`x-forwarded-for`, primeiro IP). Usar um documento por chave evita índice composto;
3. busca `adminAuth.getUserByEmail`. Se não existir, ou se estiver inativo (`customClaims.active === false`, ou consultor com `status: 'suspended'`, DN-07), não faz nada;
4. caso contrário, `createPasswordToken({ purpose: 'password_reset', createdBy: 'self_service' })` e `enqueueTemplatedEmail('password_reset', ...)`;
5. responde sempre `200 { success: true }`.

Limites iniciais em constantes: 3 por e-mail a cada 15 min e 10 por IP a cada 60 min.

**F. E-mails de boas-vindas enviados pela API**
Os pontos de criação de usuário (`users/create`, `consultants`, `accessRequestApproval` e `tenants/create`) passam a criar o token `first_access` e enfileirar o e-mail com `enqueueTemplatedEmail`, gravando `skip_welcome_email: true` em `users/{uid}`. O motivo: Cloud Functions não importam `src/lib` e não deveriam duplicar a emissão de token. Com isso o trigger `onUserCreated` deixa de ter função e é removido (DN-08).

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|-------------|------------------------|
| Imagens no Firebase Storage | Exige regra de leitura pública em `storage.rules` (hoje restrita por tenant) e as URLs de download carregam token, que é frágil se for revogado. O Hosting já é público, tem CDN e é versionado com o código. |
| Imagens embutidas por CID (anexo inline via nodemailer) | Exige mudar o formato de `email_queue` (anexos), aumenta o tamanho de cada e-mail e alguns clientes mostram as imagens como anexos. |
| Imagens em base64 (`data:` URI) | Gmail e Outlook bloqueiam ou removem. |
| Título do banner em texto HTML sobre `background-image` | Não funciona no Outlook desktop sem VML, e os arquivos entregues já trazem o título embutido. |
| Queimar o token de primeiro acesso no GET | Scanners de e-mail queimariam o link antes do usuário. |
| Queimar automaticamente via JS no carregamento | Sandboxes de antivírus (ex.: Defender) executam JS. O clique humano é a barreira mais confiável. |
| Continuar com `generatePasswordResetLink`/`sendPasswordResetEmail` do Firebase | Não permite 30 min / 72 h nem uso único na abertura, e o e-mail nativo foge do nosso layout. |
| Layout aplicado em `sendEmail` (ponto único de envio nas functions) | O preview do editor (client) não veria o layout, e o corpo livre de `tenants/create` (RN-14 do UC-55) seria envolvido sem controle. |
| Reescrever `body` dos templates no lugar (sem campo novo) | Abre uma janela em que o código antigo envia o miolo sem layout, ou o código novo envolve um HTML completo duas vezes. |
| Gerar o token de primeiro acesso dentro de `onUserCreated` | Duplicaria `passwordResetService` em `functions/src` (o espelho manual cresceria) e o e-mail continuaria fora da fila. |

### 4.3 Trade-offs aceitos
- **Banner fixo por tipo:** template novo exige arte nova e deploy; até lá sai sem banner, com título em texto (DN-04).
- **Rodapé com ano embutido:** `2.png` é usado como está e fica desatualizado em 01/01/2027 se não for trocado. A troca pelo rodapé sem ano é uma substituição de arquivo futura (`/email/v2/`), quando o designer enviar (DN-05).
- **Uso único no clique e não no carregamento:** um scanner que clique botões (raro) poderia queimar o link. Nesse caso o usuário usa "Esqueci minha senha", como o pedido prevê.
- **`body` legado e `content` convivem temporariamente** no Firestore até a task de limpeza.
- **Espelho manual** de `emailLayout.ts` em `functions/src`, mitigado por teste de paridade.
- **Diferença de tempo de resposta** entre e-mail existente e inexistente no forgot (o caso existente grava token e fila). Aceito no MVP; a mensagem e o status são idênticos.
- Clientes que bloqueiam imagens mostram só o `alt` dos banners; o texto do miolo continua completo.

### 4.4 Decisões tomadas pelo usuário (28/10/2026)

Todas respondidas explicitamente pelo usuário, na recomendação do documento. Não há decisão pendente.

| ID | Tema | Decisão | Onde se reflete |
|----|------|---------|-----------------|
| DN-01 | Cadastro de clínica pelo admin (UC-21) | **Entra no fluxo de primeiro acesso.** `/admin/tenants/new` perde o campo de senha temporária; o usuário é criado sem senha, sem `requirePasswordChange`, com `skip_welcome_email: true`, e recebe `generic_user_welcome` com link de primeiro acesso. O e-mail de corpo livre opcional de UC-21 continua como está (RN-14 do UC-55, sem layout). | RF-07, RN-07, 6.3.6, STEP 6d |
| DN-02 | Semântica do "one-click" | Invalida no **clique em "Definir minha senha"** (POST), nunca no GET/carregamento. Depois do clique, **30 min** para salvar a senha. Recarregar a mesma aba mantém o formulário (sessão em `sessionStorage`); outra aba/dispositivo vê "link já utilizado". | RF-11, RF-12, 4.1-D, 6.3.5, `FIRST_ACCESS_SESSION_MINUTES = 30` |
| DN-03 | Migração dos 13 templates | **Autorizada**, guardando o conteúdo atual (inclusive customizações) como documento em `versions` (revertível pelo UC-55). Ordem: **primeiro em dev**; **em produção só no release**, com aviso prévio ao usuário, que roda os comandos. | STEP 9, checklist 9 |
| DN-04 | Banner genérico | Usar os 13 banners atuais. **Não publicar o `1.png`** ("Heading"). Tipo sem banner sai sem imagem, com título em texto HTML. O banner genérico sem texto fica como troca de arquivo futura, quando o designer enviar. | RF-18, 5.1, 6.3.1 |
| DN-05 | Rodapé | Usar `2.png` (com "© 2026") como está, **mais o texto legal em HTML** abaixo: "Este é um e-mail automático do Curva Mestra. Por favor, não responda." e "Nunca compartilhe sua senha ou links de acesso.", sem link de descadastro. O rodapé sem ano fica como troca de arquivo futura. | 6.3.2, R-04 |
| DN-06 | Domínio e cores | Produção: **`https://curvamestra.com.br`**; dev: **`https://dev-gscandelari.web.app`**. Botão principal **escuro com texto dourado**; os hex exatos são extraídos das imagens (preto do fundo e dourado do título, ex.: `14.png`) na implementação, conferindo contraste ≥ 4,5:1 (RNF-12), e registrados no PR. | 4.1-B, 6.3.2, STEP 2 |
| DN-07 | "Esqueci minha senha" para inativo | Usuário inativo (`active === false`, incluindo clínica suspensa) ou consultor suspenso **não recebe nada**; mesma resposta neutra. | RN-04, 4.1-E, STEP 5 |
| DN-08 | Trigger `onUserCreated` | **Remover** (arquivo, export e `functions:onUserCreated` do workflow de dev). Em produção, o `firebase deploy --only functions --force` de `deploy-firebase.yml:79` apaga a function no release; **comunicar isso ao usuário antes do merge em `master`**. | STEP 14, checklist 9 |

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `public/email/v1/banner-access-request-created.png` … (13 banners, tabela 6.3.1) | Asset | Banner por tipo |
| `public/email/v1/rodape.png` | Asset | Rodapé (`2.png`) |
| `src/lib/emailLayout.ts` | Lib pura | `EMAIL_BANNERS`, `resolveAppBaseUrl`, `buildEmailLayout`, `renderEmailButton`, `htmlToPlainText` |
| `functions/src/emailLayout.ts` | Lib pura (espelho) | Espelho manual para as functions |
| `src/lib/passwordTokenRules.ts` | Lib pura | `TOKEN_TTL_MINUTES`, `computeTokenExpiry`, `evaluatePasswordToken`, `evaluateRateLimit` |
| `src/app/api/auth/password-token/open/route.ts` | API route | `POST`: abre (queima) o link de primeiro acesso e devolve a sessão |
| `src/app/api/auth/forgot-password/route.ts` | API route | `POST`: recuperação self-service com token próprio |
| `src/app/(auth)/reset-password/[token]/layout.tsx` | Layout | `metadata.referrer = 'no-referrer'` (a página é client component) |
| `scripts/migrate-email-templates-layout.ts` | Script | Migração expand (`content` + `layout_version`), com `--dry-run`/`--apply` e backup em `versions` |
| `src/__tests__/emailLayout.test.ts` | Teste | Layout + paridade com functions |
| `src/__tests__/passwordTokenRules.test.ts` | Teste | Expiração, estados do token e rate limit |
| `src/__tests__/emailTemplatesSeed.test.ts` | Teste | Os 13 miolos do seed são fragmentos válidos e têm banner mapeado |
| `tests/e2e/UC-60-definir-senha-pelo-link-de-primeiro-acesso.spec.ts` | E2E | Caderno do primeiro acesso. O número do UC deve ser confirmado pelo `uml-use-case-writer` |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/lib/services/passwordResetService.ts` | `createPasswordToken({ purpose, ... })` (mantém `createPasswordResetToken` como wrapper de `password_reset`); grava `used_at: null`/`invalidated_at: null`; `invalidateUserTokens` consulta só `user_id` e filtra pendentes em memória (cobre docs legados); `validateToken` devolve `purpose` e `opened`; novo `openFirstAccessToken`; `consumeToken` em `runTransaction` e exige `session` para `first_access`; `generateResetLink` usa `resolveAppBaseUrl` |
| `src/app/api/auth/validate-reset-token/route.ts` | Inclui `purpose` na resposta; para `first_access` aberto devolve `{ valid:false, reason:'opened' }` |
| `src/app/api/auth/reset-password/route.ts` | Aceita `session`; usa `validatePassword` compartilhado; `emailVerified: true` (RF-16); mantém a limpeza de `requirePasswordChange` |
| `src/app/(auth)/reset-password/[token]/page.tsx` | Tela intermediária para `first_access`, sessão em `sessionStorage`, textos por finalidade, link "Solicitar nova senha" nas telas de erro |
| `src/app/(auth)/forgot-password/page.tsx` | Troca `sendPasswordResetEmail` por `fetch('/api/auth/forgot-password')`; texto "link válido por 30 minutos"; trata 429 |
| `src/app/api/users/create/route.ts` | `password` deixa de ser obrigatório e é ignorado se vier; sem `requirePasswordChange`; `skip_welcome_email: true`; cria token `first_access` e enfileira `generic_user_welcome` |
| `src/components/clinic/UsersTab.tsx` | Remove o campo Senha e a validação; novo texto do diálogo (UC-40 RN-10(b)) |
| `src/app/(admin)/admin/tenants/[id]/page.tsx` | Remove `newUserPassword`/`PasswordInput`/`validatePassword` do diálogo; novo texto (UC-39) |
| `src/app/api/consultants/route.ts` | Remove `generateTempPassword` e `password`; sem `requirePasswordChange`; token `first_access` + `consultant_welcome` com `firstAccessLink` |
| `src/lib/services/accessRequestApproval.ts` | Troca `adminAuth.generatePasswordResetLink` por `createPasswordToken({ purpose:'first_access' })` + `generateResetLink`; mantém o fallback sem reverter a aprovação (RN-05 do UC-02) |
| `src/app/api/tenants/create/route.ts` + `src/app/(admin)/admin/tenants/new/page.tsx` | Remove `temp_password` (DN-01), sem `requirePasswordChange`, `skip_welcome_email: true`, token `first_access` + `generic_user_welcome` com link |
| `src/lib/services/emailTemplateAdmin.ts` | `getRenderedEmailTemplate` aplica o layout quando há `content`; `saveEmailTemplateVersion`/`revertEmailTemplateVersion` gravam `content` quando o doc tem `layout_version` |
| `functions/src/services/emailTemplateService.ts` | Mesma regra de renderização (layout quando há `content`) |
| `functions/src/services/emailService.ts` | `text` padrão passa a vir de `htmlToPlainText` (remove `stripHtmlTags`) |
| `src/types/index.ts` | `EmailTemplateDoc.body?` (legado), `content?`, `layout_version?`; `EmailTemplateVersion.content?`; tipo `PasswordTokenPurpose` |
| `src/app/(admin)/admin/email-templates/[tipo]/page.tsx` | Edita `content` quando `layout_version` existe; preview e teste com `buildEmailLayout`; aviso "banner e rodapé são fixos"; botão "inserir botão padrão" (snippet de `renderEmailButton`) |
| `src/app/api/email-templates/[tipo]/route.ts` (+ `versions`) | Aceita/devolve `content` |
| `scripts/seed-email-templates.ts` | Os 13 templates reescritos como miolo (`content`, `layout_version: 1`); variáveis novas (6.1.3); remove `${YEAR}` e links fixos de domínio |
| `firestore.rules` | Bloco explícito `password_reset_rate_limits` (deny all) |
| `.github/workflows/deploy-gscandelari-dev.yml` | Remove `functions:onUserCreated` do `--only` (DN-08); ver R-08 sobre `processEmailQueue` |
| `functions/src/index.ts` | Remove o export `onUserCreated` (DN-08) |
| `src/__tests__/accessRequestApproval.test.ts` | Mock de `generatePasswordResetLink` substituído pelo do serviço de token |
| `tests/e2e/UC-02-…spec.ts`, `UC-07-…spec.ts`, `UC-08-…spec.ts`, `UC-55-…spec.ts`, `UX-060-…spec.ts` | Ajustes da seção 8.2 |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---------|--------|
| `functions/src/onUserCreated.ts` | DN-08: o e-mail de boas-vindas passa a sair pelas APIs. Em produção a function é apagada pelo deploy de functions do release |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `password_reset_tokens` | Campos novos | `purpose`, `opened_at`, `session_hash`, `session_expires_at`; `used_at`/`invalidated_at` gravados como `null`. Docs legados continuam válidos (RN-02). Rules **inalteradas** (`allow read, write: if false`). Sem índice novo: as consultas são de igualdade em um campo (`token_hash`, `user_id`) |
| `password_reset_rate_limits` | **Nova** | `{ count: number, window_started_at: Timestamp, expires_at: Timestamp }`, id = SHA-256 da chave. Só Admin SDK. Rule explícita deny-all. TTL do Firestore em `expires_at` opcional, configurado no console |
| `email_templates` | Campos novos | `content`, `layout_version`; `variables` atualizada. `body` legado preservado. Rules inalteradas |
| `email_templates/{tipo}/versions` | Campo novo | `content?` no snapshot. Backup do estado atual de cada tipo na migração, inclusive customizações (DN-03) |
| `email_queue` | Sem mudança de schema | `body` passa a conter o HTML final com layout |
| `users` | Sem campo novo | Criações novas sem `requirePasswordChange` e com `skip_welcome_email: true` |

**Multi-tenant:** nenhuma das coleções acima é escopada por tenant. São coleções raiz acessadas só pelo Admin SDK, como hoje. `password_reset_tokens.tenant_id` continua gravado quando existe. Nenhuma consulta de dados de clínica é criada ou alterada.

**Deploy de rules (o usuário roda, antes do merge em `master`), em PowerShell:**
```powershell
firebase deploy --only firestore:rules --project curva-mestra
```
O efeito funcional é nulo (o Firestore já nega por padrão coleções sem `match`); o bloco explícito serve para documentar. Em dev, `deploy-gscandelari-dev.yml` já publica rules automaticamente. Índices: **nenhum**.

### 5.5 O que NÃO muda
- Custom claims (`tenant_id`, `role`, `is_system_admin`, `active`, `is_consultant`, `consultant_id`, `authorized_tenants`) e todas as regras multi-tenant de `firestore.rules`.
- UC-30 / UC-37 (system_admin define senha manualmente com "forçar troca"), `src/app/api/users/[id]/set-password`, `src/app/api/consultants/[id]/set-password`, `/change-password` (UC-06), `clear-password-change-flag` e a checagem de `requirePasswordChange` em `ProtectedRoute.tsx`/`login/page.tsx`.
- UC-08 (`POST /api/users/[id]/reset-password` e `/api/consultants/[id]/reset-password`): mesmo comportamento, só ganham o layout e a correção de invalidação.
- `renderTemplate`/`validateTemplateVariables` (`src/lib/emailTemplateRendering.ts` e o espelho).
- `processEmailQueue` (formato da fila), o SMTP Zoho, as callables `sendCustomEmail`, `sendTestEmail` e `sendTempPasswordEmail` (ver seção 12, fora de escopo) e o e-mail de corpo livre de `tenants/create` (RN-14 do UC-55).
- Formulário `/register` (UC-01), que continua sem senha.
- `storage.rules` e `firestore.indexes.json`.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

#### 6.1.1 Token de senha (`src/lib/services/passwordResetService.ts` e `src/types/index.ts`)

```ts
// ANTES (interno ao serviço)
interface PasswordResetTokenData {
  token_hash: string;
  user_id: string;
  user_email: string;
  tenant_id?: string;
  expires_at: Timestamp;
  created_at: Timestamp | FieldValue;
  created_by: string;
  used_at?: Timestamp;
  invalidated_at?: Timestamp;
}

// DEPOIS
export type PasswordTokenPurpose = 'password_reset' | 'first_access'; // src/types/index.ts

interface PasswordResetTokenData {
  token_hash: string;
  purpose?: PasswordTokenPurpose;        // ausente = 'password_reset' (legado, RN-02)
  user_id: string;
  user_email: string;
  tenant_id?: string;                    // inalterado
  expires_at: Timestamp;                 // 30 min (reset) | 72 h (first_access)
  created_at: Timestamp | FieldValue;
  created_by: string;                    // uid do admin | 'self_service' | 'system'
  used_at: Timestamp | null;             // agora sempre gravado (null)
  invalidated_at: Timestamp | null;      // agora sempre gravado (null)
  opened_at?: Timestamp | null;          // first_access: momento do clique "Definir minha senha"
  session_hash?: string | null;          // SHA-256 do segredo de sessão pós-abertura
  session_expires_at?: Timestamp | null; // opened_at + 30 min (DN-02)
}
```

#### 6.1.2 Template (`src/types/index.ts`)

```ts
// ANTES
export interface EmailTemplateDoc {
  tipo: string; label: string; category: EmailTemplateCategory; related_uc: string;
  subject: string;
  body: string; // HTML completo
  variables: EmailTemplateVariable[];
  updated_at: Timestamp; updated_by: string; updated_by_name: string;
}

// DEPOIS
export interface EmailTemplateDoc {
  tipo: string; label: string; category: EmailTemplateCategory; related_uc: string;
  subject: string;
  body?: string;          // LEGADO: HTML completo. Usado só quando `content` não existe
  content?: string;       // miolo HTML (fragmento, sem <html>/<head>/<body>), envolvido pelo layout
  layout_version?: 1;     // presença = template migrado para o layout padrão
  variables: EmailTemplateVariable[];
  updated_at: Timestamp; updated_by: string; updated_by_name: string;
}

export interface EmailTemplateVersion {
  id: string; subject: string;
  body?: string;          // snapshot legado
  content?: string;       // snapshot do miolo
  variables: EmailTemplateVariable[];
  replaced_at: Timestamp; replaced_by: string; replaced_by_name: string;
}
```

Variáveis **injetadas pelo layout** (não editáveis, sempre disponíveis no miolo, sem precisar declarar em `variables`): `appUrl` (URL base do ambiente) e `currentYear`. `validateTemplateVariables` passa a receber `allowedKeys = [...variables.map(k), 'appUrl', 'currentYear']`. A mudança fica nos chamadores (`saveEmailTemplateVersion`), não na função pura.

#### 6.1.3 Variáveis por template (mudanças)

| Template | Antes | Depois |
|----------|-------|--------|
| `generic_user_welcome` | `displayName`*, `role`* | `displayName`*, `role`*, `email`*, `firstAccessLink`* (label "Link de primeiro acesso (uso único, válido por 72 h)") |
| `consultant_welcome` | `name`*, `email`*, `code`* | + `firstAccessLink`*; remove a frase "Você será solicitado a defini-la/trocá-la no primeiro acesso" |
| `welcome_approval` | `passwordResetLink`* ("expira em 24h") | mesma chave `passwordResetLink`* (evita churn nos chamadores e nos specs); label e texto passam a "uso único, válido por 72 horas" |
| `password_reset` | `displayName`*, `resetLink`* | igual; texto "válido por 30 minutos; pode ser aberto até você concluir" |
| Demais 9 | inalteradas | inalteradas (só miolo novo) |

(* = obrigatória)

### 6.2 Mudanças em serviços

**`src/lib/passwordTokenRules.ts` (novo, puro):**
```ts
export const TOKEN_TTL_MINUTES: Record<PasswordTokenPurpose, number> = {
  password_reset: 30,
  first_access: 72 * 60,
};
export const FIRST_ACCESS_SESSION_MINUTES = 30; // DN-02

export function computeTokenExpiry(purpose: PasswordTokenPurpose, now: Date): Date;

export type TokenState =
  | 'valid' | 'used' | 'invalidated' | 'expired'
  | 'opened'          // first_access já aberto (para nova abertura/validação)
  | 'session_valid'   // first_access aberto + sessão conferida e dentro da janela
  | 'session_invalid'; // sessão ausente/diferente/expirada

export interface TokenSnapshot {
  purpose?: PasswordTokenPurpose;
  expires_at: Date; used_at: Date | null; invalidated_at: Date | null;
  opened_at?: Date | null; session_hash?: string | null; session_expires_at?: Date | null;
}

/** mode: 'inspect' (GET/validate), 'open' (POST open), 'consume' (POST reset) */
export function evaluatePasswordToken(
  t: TokenSnapshot, now: Date, mode: 'inspect' | 'open' | 'consume',
  providedSessionHash?: string
): TokenState;

export function evaluateRateLimit(
  state: { count: number; window_started_at: Date } | null,
  now: Date, limit: { max: number; windowMinutes: number }
): { allowed: boolean; next: { count: number; window_started_at: Date } };
```

Regras de `evaluatePasswordToken`:
1. `used_at` → `used`;
2. `invalidated_at` → `invalidated`;
3. `now > expires_at` → `expired`; para `first_access` aberto vale `session_expires_at`, não `expires_at`;
4. `first_access`:
   - `inspect`: aberto → `opened`, senão `valid`;
   - `open`: aberto → `opened`, senão `valid`;
   - `consume`: exige aberto e `providedSessionHash === session_hash` e `now <= session_expires_at` → `session_valid`, senão `session_invalid`;
5. `password_reset`/legado: `valid` em `inspect` e `consume`, e `open` nunca é aceito para ele.

**`src/lib/services/passwordResetService.ts`:**
```ts
// NOVO (wrapper legado mantido)
export async function createPasswordToken(params: {
  userId: string; userEmail: string; createdBy: string;
  purpose: PasswordTokenPurpose; tenantId?: string;
}): Promise<{ token: string; expiresAt: Date }>;
export async function createPasswordResetToken(userId, userEmail, createdBy, tenantId?) // = createPasswordToken({ purpose:'password_reset', ... })

export async function validateToken(rawToken: string): Promise<{
  valid: boolean; purpose?: PasswordTokenPurpose; reason?: TokenState;
  userId?: string; userEmail?: string; emailMasked?: string; error?: string;
}>;

// NOVO: transação; grava opened_at, session_hash, session_expires_at
export async function openFirstAccessToken(rawToken: string): Promise<
  { success: true; session: string; sessionExpiresAt: Date; emailMasked: string } |
  { success: false; reason: TokenState; error: string }
>;

// MODIFICADO: runTransaction; aceita session; marca used_at
export async function consumeToken(rawToken: string, session?: string): Promise<{
  success: boolean; userId?: string; userEmail?: string; purpose?: PasswordTokenPurpose; error?: string;
}>;

// CORRIGIDO: where('user_id','==',userId) e filtra em memória used_at/invalidated_at nulos ou ausentes
export async function invalidateUserTokens(userId: string): Promise<void>;

// MODIFICADO: base = resolveAppBaseUrl(...)
export function generateResetLink(token: string, baseUrl?: string): string;
```

**`src/lib/emailLayout.ts` (novo, puro, espelhado):**
```ts
export const EMAIL_ASSET_VERSION = 'v1';
export const EMAIL_BANNERS: Record<string, { file: string; alt: string }>; // tabela 6.3.1
export const EMAIL_FOOTER = { file: 'rodape.png', alt: '© Curva Mestra — Gestão Inteligente de Estoque', width: 600, height: 50 };
export const EMAIL_FOOTER_LEGAL_LINES = [
  'Este é um e-mail automático do Curva Mestra. Por favor, não responda.',
  'Nunca compartilhe sua senha ou links de acesso.',
]; // DN-05
export function resolveAppBaseUrl(env: {
  explicitBaseUrl?: string; projectId?: string; fallbackLocalUrl?: string;
}): string; // ordem da seção 4.1-B; remove barra final; lança Error se nada resolver
export function emailAssetUrl(baseUrl: string, file: string): string; // `${base}/email/v1/${file}`
export function renderEmailButton(href: string, label: string): string; // botão "bulletproof" em tabela
export function buildEmailLayout(p: {
  tipo: string; contentHtml: string; baseUrl: string; preheader?: string; fallbackTitle?: string;
}): string; // documento completo (6.3.2); tipo sem banner → sem <img> de banner e com <h1> de fallbackTitle (DN-04)
export function htmlToPlainText(html: string): string;
```

**Renderização (Next e functions):**
```ts
// emailTemplateAdmin.getRenderedEmailTemplate (e o equivalente em functions)
const baseUrl = resolveAppBaseUrl({...});
const vars = { ...variables, appUrl: baseUrl, currentYear: String(new Date().getFullYear()) };
if (template.content) {
  return {
    subject: renderTemplate(template.subject, vars),
    body: buildEmailLayout({ tipo, contentHtml: renderTemplate(template.content, vars), baseUrl, fallbackTitle: template.label }),
  };
}
return { subject: renderTemplate(template.subject, vars), body: renderTemplate(template.body ?? '', vars) }; // legado
```
Nas functions o retorno continua `{ subject, html }`.

**Criação de usuários (padrão comum aos 3 ou 4 pontos):**
1. `adminAuth.createUser({ email, displayName, emailVerified: false })`, **sem** `password`;
2. claims **sem** `requirePasswordChange`;
3. `users/{uid}` com `skip_welcome_email: true` e **sem** `requirePasswordChange`;
4. `createPasswordToken({ purpose:'first_access', createdBy: <uid do ator ou 'system'>, tenantId })`;
5. `enqueueTemplatedEmail(<tipo>, email, { ..., firstAccessLink | passwordResetLink })`: `generic_user_welcome` em `users/create` e `tenants/create`, `consultant_welcome` em `consultants`, `welcome_approval` em `accessRequestApproval`;
6. falhas nos passos 4 e 5 não revertem a criação (mesmo princípio de UC-02 RN-04/RN-05). Registrar `console.warn`; o usuário recupera o acesso por "Esqueci minha senha".

### 6.3 Mudanças na UI e nos e-mails

#### 6.3.1 Assets: origem → destino → template

Copiar de `C:\Users\scand\Downloads\Banners e rodapé Email template\`, otimizar (RNF-08, ex.: `oxipng -o 4 --strip safe` ou `pngquant --quality 80-95`, conferindo visualmente) e salvar em `public/email/v1/`.

| Origem | Dimensão | Destino (`public/email/v1/`) | Tipo | `alt` |
|--------|----------|-------------------------------|------|-------|
| 1.png | 600×100 | **não publicar** (DN-04). Arte genérica sem texto é troca futura | — | — |
| 2.png | 600×50 | `rodape.png` | todos | "© Curva Mestra — Gestão Inteligente de Estoque" |
| 3.png | 600×100 | `banner-access-request-created.png` | `access_request_created` | "Nova Solicitação de Acesso" |
| 4.png | 600×100 | `banner-new-tenant-notification.png` | `new_tenant_notification` | "Nova Clínica Cadastrada" |
| 5.png | 600×100 | `banner-access-request-rejected.png` | `access_request_rejected` | "Solicitação de Acesso Não Aprovada" |
| 6.png | 600×100 | `banner-consultant-email-changed.png` | `consultant_email_changed` | "Alteração de E-mail de Acesso do Consultor" |
| 7.png | 600×100 | `banner-consultant-invite-created.png` | `consultant_invite_created` | "Convite de Vínculo com Clínica" |
| 8.png | 600×100 | `banner-consultant-pending-access-requests-digest.png` | `consultant_pending_access_requests_digest` | "Solicitações de Acesso Pendentes" |
| 9.png | 600×100 | `banner-consultant-transfer-approved.png` | `consultant_transfer_approved` | "Transferência de Clínica Aprovada" |
| 10.png | 600×100 | `banner-consultant-transfer-rejected.png` | `consultant_transfer_rejected` | "Transferência de Clínica Não Aprovada" |
| 11.png | 600×100 | `banner-consultant-transfer-request.png` | `consultant_transfer_request` | "Pedido de Transferência de Clínica" |
| 12.png | 600×100 | `banner-consultant-welcome.png` | `consultant_welcome` | "Bem-vindo ao Curva Mestra! — Portal do Consultor" |
| 13.png | 600×100 | `banner-generic-user-welcome.png` | `generic_user_welcome` | "Bem-vindo ao Curva Mestra! — Portal da Clínica" |
| 14.png | 600×100 | `banner-password-reset.png` | `password_reset` | "Redefinição de Senha — Curva Mestra" |
| 15.png | 600×100 | `banner-welcome-approval.png` | `welcome_approval` | "Aprovação de Solicitação de Acesso" |

Regras dos assets:
- nome = `banner-` + tipo em kebab-case;
- URLs finais: `https://<domínio>/email/v1/<arquivo>`;
- **nunca** apagar ou sobrescrever um arquivo de `v1` depois do merge em `master`: arte nova vai para `v2/` e muda `EMAIL_ASSET_VERSION`;
- antes do PR, confirmar que `https://dev-gscandelari.web.app/email/v1/rodape.png` responde 200 com `content-type: image/png`.

#### 6.3.2 Estrutura do layout (`buildEmailLayout`)

```html
<!DOCTYPE html>
<html lang="pt-BR"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting"><title>{título do banner}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <!-- preheader oculto (opcional) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:#ffffff;">
        <tr><td><img src="{base}/email/v1/banner-{tipo}.png" width="600" height="100" alt="{alt}"
                     style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
        <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;">
          {miolo renderizado}
        </td></tr>
        <tr><td><img src="{base}/email/v1/rodape.png" width="600" height="50" alt="{alt rodapé}"
                     style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
        <tr><td style="padding:16px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-align:center;">
          {EMAIL_FOOTER_LEGAL_LINES, uma por linha — DN-05}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```
- As cores de fundo neutras acima (cinza/branco/texto) não são de marca e podem ser ajustadas.
- **Botão padrão** (`renderEmailButton`), **fundo escuro com texto dourado** (DN-06): `<table role="presentation"><tr><td bgcolor="{EMAIL_BRAND_DARK}" style="border-radius:6px;"><a href="{href}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;text-decoration:none;color:{EMAIL_BRAND_GOLD};">{label}</a></td></tr></table>`, seguido da linha "Se o botão não funcionar, copie e cole: {href}". Links de texto no miolo usam a cor escura (contraste sobre branco); o dourado fica para o texto do botão.
- Os miolos não repetem o título (que já está no banner) e não trazem `<html>/<head>/<body>/<style>`.

#### 6.3.3 Editor UC-55 (`/admin/email-templates/[tipo]`)
- **Hoje:** `Textarea` com o `body` completo e preview `iframe srcDoc={renderTemplate(body)}`.
- **Novo (doc com `layout_version`):**
  - `Textarea` rotulado "Conteúdo do e-mail (miolo)";
  - aviso fixo "Banner e rodapé são padronizados e não são editáveis aqui";
  - preview `srcDoc={buildEmailLayout({ tipo, contentHtml: renderTemplate(content, samples), baseUrl: window.location.origin })}`;
  - botão "Inserir botão padrão", que insere `renderEmailButton('{{variavel}}', 'Texto')` no cursor;
  - o envio de teste usa o mesmo HTML do preview;
  - o histórico de versões mostra/reverte `content`.
- **Doc legado (sem `layout_version`):** comportamento atual, com o aviso "Template no formato antigo, aguardando migração".

#### 6.3.4 `/forgot-password`
- **Hoje:** Firebase `sendPasswordResetEmail`.
- **Novo:** `POST /api/auth/forgot-password { email }`.
  - Sucesso (sempre 200): "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha. O link é válido por 30 minutos."
  - 429: "Muitas solicitações. Aguarde alguns minutos e tente novamente."
  - 400: "Email inválido".
  - O redirecionamento de usuário já autenticado continua.

#### 6.3.5 `/reset-password/[token]`
Estados:
1. validando;
2. inválido/expirado/usado/aberto: mensagem específica + botões "Solicitar nova senha" (`/forgot-password`) e "Voltar ao login";
3. **`first_access` válido e não aberto:** tela intermediária com título "Defina sua senha de acesso", e-mail mascarado, texto "Por segurança, este link só pode ser aberto uma vez." e botão "Definir minha senha", que faz o POST `open`, guarda `session` em `sessionStorage` (`cm_first_access_session:{sha256(token)}`, sem o token cru como chave) e vai para o estado 4;
4. formulário (igual ao atual, `PasswordInput`), que envia `session` quando a finalidade é `first_access`;
5. sucesso → `/login`.

Para `password_reset` vai direto ao estado 4. Título "Nova Senha" (reset) ou "Defina sua senha" (primeiro acesso).

#### 6.3.6 Diálogos de criação de usuário
- `UsersTab.tsx`: remove o campo "Senha". Texto novo: "O usuário receberá por e-mail um link para definir a própria senha. O link vale por 72 horas e só pode ser aberto uma vez; se expirar, ele pode usar 'Esqueci minha senha' na tela de login."
- `admin/tenants/[id]/page.tsx`: mesma remoção e mesmo texto.
- `admin/tenants/new/page.tsx` (DN-01): remove o campo "Senha temporária" e a menção a `{{temp_password}}`; texto informando que o admin da clínica receberá o link de primeiro acesso por e-mail.

### 6.4 Mudanças em API Routes

| Método/rota | Auth | Request | Response |
|-------------|------|---------|----------|
| `GET /api/auth/validate-reset-token?token=` (mod.) | Pública | — | `{ valid: true, purpose: PasswordTokenPurpose, email_masked: string }` \| `{ valid: false, reason: 'used'\|'invalidated'\|'expired'\|'opened'\|'not_found', error: string }` (400). **Nunca altera o token.** |
| `POST /api/auth/password-token/open` (novo) | Pública (posse do token) | `{ token: string }` | `200 { success: true, session: string, session_expires_at: string(ISO), email_masked: string }` \| `400 { success: false, reason, error }`. Só aceita `first_access` |
| `POST /api/auth/reset-password` (mod.) | Pública (posse do token) | `{ token: string, new_password: string, session?: string }` | `200 { success: true, message }` \| `400 { success: false, error }`. `first_access` sem sessão válida → 400 "Sua sessão para definir a senha expirou. Solicite uma nova senha." |
| `POST /api/auth/forgot-password` (novo) | Pública | `{ email: string }` | `200 { success: true }` (sempre, exceto abaixo) \| `400 { error: 'Email inválido' }` \| `429 { error }` |
| `POST /api/users/create` (mod.) | Bearer (clinic_admin/system_admin) | `{ email, displayName, role, tenant_id_override? }` (`password` ignorado) | inalterado (`201 { success, user, message }`) |
| `POST /api/consultants` (mod.) | Bearer system_admin | inalterado | inalterado |
| `POST /api/tenants/create` (mod., DN-01) | Bearer system_admin | sem `temp_password` (ignorado se vier) | inalterado |

---

## 7. Plano de Implementação

### STEP 1 — Assets de banner e rodapé
**Objetivo:** Publicar as imagens do layout em `public/email/v1/` com nomes estáveis.
**Arquivos afetados:** `public/email/v1/*.png` (14 arquivos: 13 banners + rodapé; `1.png` não entra, DN-04).
**Ações:**
1. Copiar `2.png` e de `3.png` a `15.png` da pasta de origem com os nomes da tabela 6.3.1. **Não** copiar `1.png`.
2. Otimizar cada arquivo sem perda perceptível (RNF-08), conferir visualmente e registrar no PR o peso antes/depois.
3. Conferir as dimensões (600×100 e 600×50).
**Validação:** `ls public/email/v1` lista 14 PNG; cada um ≤ 40 KB (ou justificativa no PR); `npm run build` sem erro.
**Commit:** `chore(email): adiciona banners e rodapé do layout de e-mail`

### STEP 2 — Layout base compartilhado
**Objetivo:** Criar `emailLayout.ts` puro e o espelho nas functions.
**Arquivos afetados:** `src/lib/emailLayout.ts`, `functions/src/emailLayout.ts`, `functions/src/services/emailService.ts`.
**Ações:**
1. Implementar `EMAIL_BANNERS`, `EMAIL_FOOTER`, `EMAIL_FOOTER_LEGAL_LINES`, `resolveAppBaseUrl`, `emailAssetUrl`, `renderEmailButton`, `buildEmailLayout` e `htmlToPlainText` (seções 6.2/6.3.2). Cores em constantes nomeadas `EMAIL_BRAND_DARK` e `EMAIL_BRAND_GOLD`, com os hex extraídos com conta-gotas do `14.png` (preto do fundo, dourado do título) e contraste dourado/escuro conferido ≥ 4,5:1 (DN-06). Registrar os hex e a razão de contraste no PR.
2. Copiar para `functions/src/emailLayout.ts` com o cabeçalho "ESPELHO MANUAL", no mesmo padrão de `emailTemplateRendering.ts`.
3. Em `sendEmail`, trocar o fallback `stripHtmlTags` por `htmlToPlainText`.
**Validação:** `npm run type-check` e `cd functions && npm run build` sem erros.
**Commit:** `feat(email): cria layout base compartilhado com banner e rodapé`

### STEP 3 — Tokens com finalidade e correção da invalidação
**Objetivo:** Suportar `password_reset`/`first_access` e corrigir `invalidateUserTokens`.
**Arquivos afetados:** `src/lib/passwordTokenRules.ts`, `src/lib/services/passwordResetService.ts`, `src/types/index.ts`.
**Ações:**
1. (3a) Gravar `used_at: null`/`invalidated_at: null` na criação. `invalidateUserTokens` passa a consultar por `user_id` e filtrar em memória os pendentes (`!used_at && !invalidated_at`), cobrindo docs legados sem os campos.
2. (3b) Criar `passwordTokenRules.ts`; `createPasswordToken` com `purpose` e `computeTokenExpiry`; manter o wrapper `createPasswordResetToken`.
3. `generateResetLink` usa `resolveAppBaseUrl({ explicitBaseUrl: process.env.NEXT_PUBLIC_BASE_URL, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, fallbackLocalUrl: process.env.PLAYWRIGHT_BASE_URL })`.
**Validação:** os testes do STEP 11 para `computeTokenExpiry`/`evaluatePasswordToken` passam; o spec UC-08 existente continua passando.
**Commits:** `fix(auth): corrige invalidação de tokens de senha pendentes` · `feat(auth): adiciona finalidade e validade aos tokens de senha`

### STEP 4 — Uso único do link de primeiro acesso
**Objetivo:** Implementar o fluxo abrir → sessão → definir senha (4.1-D).
**Arquivos afetados:** `passwordResetService.ts` (`openFirstAccessToken`, `consumeToken` transacional), `src/app/api/auth/password-token/open/route.ts`, `src/app/api/auth/validate-reset-token/route.ts`, `src/app/api/auth/reset-password/route.ts`, `src/app/(auth)/reset-password/[token]/page.tsx`, `src/app/(auth)/reset-password/[token]/layout.tsx`.
**Ações:**
1. `openFirstAccessToken` em `runTransaction`: gera `session` (32 bytes) e grava `opened_at`, `session_hash` e `session_expires_at` = `opened_at` + 30 min (DN-02).
2. `consumeToken(token, session?)` em `runTransaction`, usando `evaluatePasswordToken(..., 'consume')`.
3. Na rota de reset: `validatePassword(new_password, { minLength: 6 })` compartilhado, `emailVerified: true` e manutenção da limpeza de `requirePasswordChange`.
4. Na página: estados da seção 6.3.5 e `layout.tsx` com `export const metadata = { referrer: 'no-referrer' }`.
**Validação:** manualmente no emulador, com um token `first_access` criado por script: (i) recarregar a página antes do clique não altera `opened_at`; (ii) depois do clique, abrir o link em outra aba mostra "já utilizado"; (iii) definir a senha permite login.
**Commit:** `feat(auth): torna o link de primeiro acesso de uso único`

### STEP 5 — "Esqueci minha senha" com token próprio
**Objetivo:** Substituir o envio nativo do Firebase.
**Arquivos afetados:** `src/app/api/auth/forgot-password/route.ts`, `src/app/(auth)/forgot-password/page.tsx`, `src/lib/passwordTokenRules.ts` (`evaluateRateLimit`).
**Ações:**
1. Implementar a rota conforme 4.1-E e 6.4, com rate limit em transação em `password_reset_rate_limits` (chaves por e-mail normalizado com `trim().toLowerCase()` e por IP).
2. `getUserByEmail`, filtro de inativo (DN-07: inativo ou consultor suspenso → nada), `createPasswordToken({ purpose:'password_reset', createdBy:'self_service' })` e `enqueueTemplatedEmail('password_reset', email, { displayName, resetLink })` com `metadata: { user_id, tenant_id, expires_at, origin: 'self_service' }`.
3. Atualizar a página (6.3.4) e remover o import de `sendPasswordResetEmail`.
**Validação:** e-mail existente cria doc em `email_queue` (`type: 'password_reset'`) e token com `expires_at - created_at` = 30 min; e-mail inexistente dá a mesma resposta e nenhum doc; a 4ª requisição em 15 min para o mesmo e-mail retorna 429.
**Commit:** `feat(auth): recuperação de senha com token próprio de 30 min`

### STEP 6 — Pontos de criação de usuário enviam link de primeiro acesso
**Objetivo:** Aplicar o padrão de 6.2 ("Criação de usuários").
**Arquivos afetados:** `src/app/api/users/create/route.ts`, `src/components/clinic/UsersTab.tsx`, `src/app/(admin)/admin/tenants/[id]/page.tsx`, `src/app/api/consultants/route.ts`, `src/lib/services/accessRequestApproval.ts`, `src/app/api/tenants/create/route.ts`, `src/app/(admin)/admin/tenants/new/page.tsx`.
**Ações:**
1. (6a) `users/create`: remover `password` da validação obrigatória e do `createUser`; tirar `requirePasswordChange`; `skip_welcome_email: true`; token + `generic_user_welcome` com `{ displayName, role: getRoleName(role), email, firstAccessLink }`. `getRoleName` hoje está só em `functions/src/services/emailService.ts`; criar o equivalente em `src/lib` (ex.: `src/lib/formatters.ts`) ou reaproveitar um mapa de rótulos existente. Ajustar os dois diálogos (6.3.6).
2. (6b) `consultants`: remover `generateTempPassword`, a senha e `requirePasswordChange`; token + `firstAccessLink` no `consultant_welcome`.
3. (6c) `accessRequestApproval`: trocar `adminAuth.generatePasswordResetLink` por token `first_access` (`createdBy: approver.uid`, `tenantId: tenant_id`). O fallback continua sendo não reverter a aprovação.
4. (6d, DN-01) `tenants/create` e `/admin/tenants/new`: remover `temp_password` da validação e do `createUser`, tirar `requirePasswordChange` do doc e das claims, `skip_welcome_email: true`, token `first_access` (`createdBy: decodedToken.uid`, `tenantId`) + `generic_user_welcome` com `firstAccessLink`. O e-mail de corpo livre opcional continua como hoje.
**Validação:** criar usuário pela UI da clínica no emulador gera doc em `email_queue` com `/reset-password/` no corpo; o usuário Auth não tem `passwordHash`; claims sem `requirePasswordChange`; `npm run type-check` limpo.
**Commits:** `feat(users): envia link de primeiro acesso ao criar usuário` · `feat(consultants): envia link de primeiro acesso ao consultor` · `feat(access-requests): usa link próprio de primeiro acesso` · `feat(tenants): remove senha manual do cadastro de clínica`

### STEP 7 — Renderização com layout e editor UC-55
**Objetivo:** Envolver `content` no layout nos dois caminhos e fazer o editor editar só o miolo.
**Arquivos afetados:** `src/types/index.ts`, `src/lib/services/emailTemplateAdmin.ts`, `functions/src/services/emailTemplateService.ts`, `src/app/api/email-templates/[tipo]/route.ts`, `src/app/api/email-templates/[tipo]/versions/**`, `src/app/(admin)/admin/email-templates/[tipo]/page.tsx`.
**Ações:**
1. Implementar a regra de renderização de 6.2 (layout quando há `content`, legado quando não há).
2. `saveEmailTemplateVersion`/`revertEmailTemplateVersion` gravam e restauram `content` em docs com `layout_version`; `allowedKeys` inclui `appUrl` e `currentYear`.
3. Editor conforme 6.3.3.
4. Nas functions, `resolveAppBaseUrl({ explicitBaseUrl: process.env.APP_BASE_URL, projectId: process.env.GCLOUD_PROJECT })`.
**Validação:** com um doc de teste com `content`, o preview mostra banner e rodapé; o envio de teste chega com layout; um doc legado continua igual ao atual.
**Commit:** `feat(email-templates): editor passa a editar só o conteúdo`

### STEP 8 — Reescrita dos 13 templates (seed)
**Objetivo:** Converter os 13 templates em miolo no layout novo.
**Arquivos afetados:** `scripts/seed-email-templates.ts`.
**Ações:**
1. Para cada tipo:
   - gravar `content` (fragmento, tabelas/inline CSS, botões via `renderEmailButton`, links via `{{appUrl}}/login`) e `layout_version: 1`;
   - manter as frases atuais, exceto os textos de senha de 6.1.3, e remover o título duplicado do banner, o `${YEAR}` e os emojis do assunto;
   - quanto ao assunto: o `generic_user_welcome` hoje começa com "🎉" e o `new_tenant_notification` com "🎊". Remover para padronizar (registrar no PR), sem mudar o resto do assunto.
2. Atualizar `variables` (6.1.3) e o cabeçalho do script.
3. O seed (modo idempotente) continua não sobrescrevendo docs existentes; `--force` sobrescreve.
**Validação:** `emailTemplatesSeed.test.ts` (STEP 11) passa; `npm run test:e2e` com o seed novo sobe sem erro.
**Commit:** `feat(email-templates): reescreve os 13 templates no layout novo`

### STEP 9 — Script de migração (produção e dev)
**Objetivo:** Levar os docs existentes ao formato novo sem perder customizações (DN-03).
**Arquivos afetados:** `scripts/migrate-email-templates-layout.ts`.
**Ações:**
1. Reaproveitar `resolveFirestore`/`KNOWN_REAL_PROJECT_IDS` do seed (extrair para `scripts/lib/` se preciso).
2. Modo padrão `--dry-run`: para cada um dos 13 tipos, classificar (inexistente, já migrado, padrão do seed, customizado) e imprimir a tabela.
3. `--apply`, em transação por tipo:
   - grava um doc em `versions` com o estado atual (`body`, `subject`, `variables`) e `replaced_by: 'migration-layout-v1'`;
   - grava `content`, `layout_version: 1`, `variables` novas e `label`;
   - **não** altera `body` nem `subject`, preservando o assunto customizado;
   - customizados recebem o mesmo tratamento (DN-03): o conteúdo atual fica no doc de `versions` e o relatório lista o tipo para o admin reaplicar as frases no miolo novo, se quiser.
4. Ao final, imprimir o resumo e a lista de tipos customizados para revisão manual.
**Validação:** contra o emulador: rodar o seed **antigo** (`git show develop:scripts/seed-email-templates.ts`), depois a migração `--apply`. Os 13 docs ficam com `content` + `layout_version` e `body` intacto, há 1 doc novo em `versions` por tipo, e rodar de novo é no-op.
**Ordem (DN-03):** (1) em **dev** (`curva-mestra-dev`) antes do PR → `develop`; (2) em **produção** (`curva-mestra`) **só no release**, imediatamente antes do merge em `master`, depois de avisar o usuário, que roda os comandos (PowerShell):
```powershell
npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account-dev.json --dry-run
npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account-dev.json --apply
# no release, em produção:
npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account-prod.json --dry-run
npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account-prod.json --apply
```
**Commit:** `chore(scripts): adiciona migração dos templates para o layout`

### STEP 10 — Firestore rules
**Objetivo:** Documentar a nova coleção como inacessível ao client.
**Arquivos afetados:** `firestore.rules`.
**Ações:**
1. Logo abaixo de `password_reset_tokens`, adicionar:
   ```
   // Rate limit de "Esqueci minha senha" (apenas Admin SDK)
   match /password_reset_rate_limits/{key} { allow read, write: if false; }
   ```
**Validação:** `npm run test:rules` passa; o deploy no dev (automático) não acusa erro.
**Commit:** `chore(rules): bloqueia coleção de rate limit de senha`

### STEP 11 — Testes Jest
**Objetivo:** Cobrir as funções puras (seção 8.1).
**Arquivos afetados:** `src/__tests__/emailLayout.test.ts`, `src/__tests__/passwordTokenRules.test.ts`, `src/__tests__/emailTemplatesSeed.test.ts`, `src/__tests__/accessRequestApproval.test.ts`.
**Validação:** `npm run test` todo verde.
**Commit:** `test(email): cobre layout, tokens de senha e rate limit`

### STEP 12 — Caderno Playwright novo
**Objetivo:** Caderno do primeiro acesso e da redefinição (regra 8 do CLAUDE.md).
**Arquivos afetados:** `tests/e2e/UC-60-definir-senha-pelo-link-de-primeiro-acesso.spec.ts`, `playwright.config.ts` (env `NEXT_PUBLIC_BASE_URL` = `BASE_URL` no `webServer.env`, se for necessário para os links apontarem para o servidor de teste).
**Validação:** `npm run test:e2e` verde localmente e no CI. **Revisão humana obrigatória** do spec antes de virar gate.
**Commit:** `test(e2e): adiciona caderno de primeiro acesso e esqueci senha`

### STEP 13 — Atualização dos cadernos existentes
**Objetivo:** Alinhar os specs afetados (seção 8.2).
**Validação:** `npm run test:e2e` verde.
**Commit:** `test(e2e): atualiza cadernos UC-02, UC-07, UC-08 e UC-55`

### STEP 14 — Remoção do `onUserCreated` (DN-08)
**Objetivo:** Eliminar o envio genérico sem link.
**Arquivos afetados:** `functions/src/onUserCreated.ts` (remover), `functions/src/index.ts`, `.github/workflows/deploy-gscandelari-dev.yml:115`, `functions/src/testEmail.ts` (confirmar se só lê o template e não depende do trigger).
**Validação:** `cd functions && npm run build`; o workflow de dev roda sem "No function matches". Em `curva-mestra-dev`, como o workflow usa `--only functions:<nome>`, a function antiga **não** é apagada automaticamente: apagar manualmente com `firebase functions:delete onUserCreated --region southamerica-east1 --project curva-mestra-dev`, senão ela continua disparando em dev.
**Produção (release):** o `firebase deploy --only functions --force` de `deploy-firebase.yml:79` apaga `onUserCreated` automaticamente. **Avisar o usuário antes do merge em `master`** (DN-08).
**Commit:** `chore(functions): remove trigger onUserCreated`

**Depois dos steps (fora do commit de código):** acionar o `uml-use-case-writer` (seção 8.3) e o `uc-issues-tracker` (Modo B) para UC-40 RN-10(b) e os demais itens afetados, conforme a seção 15 do guia.

---

## 8. Estratégia de Testes

### 8.1 Jest (funções puras)

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| `computeTokenExpiry` | `passwordTokenRules.test.ts` | `password_reset` = now+30 min; `first_access` = now+72 h; limite exato |
| `evaluatePasswordToken` | `passwordTokenRules.test.ts` | legado sem `purpose` = reset; `used`/`invalidated`/`expired`; `first_access` não aberto `inspect` → `valid` (inspecionar não altera nada); `open` em aberto → `opened`; `consume` sem sessão / sessão errada / sessão expirada → `session_invalid`; sessão certa → `session_valid`; `open` em `password_reset` recusado; expiração de 72 h ignorada depois de aberto (vale a sessão) |
| `evaluateRateLimit` | `passwordTokenRules.test.ts` | primeira chamada; até o limite; acima do limite; reinício após a janela |
| `resolveAppBaseUrl` | `emailLayout.test.ts` | override explícito; `curva-mestra` → `https://curvamestra.com.br`; `curva-mestra-dev` → `https://dev-gscandelari.web.app`; fallback local; nenhum → lança; remove a barra final |
| `buildEmailLayout` | `emailLayout.test.ts` | banner certo por tipo, com `alt` e `width/height`; URLs absolutas `https://` em produção/dev; miolo inserido sem escape; rodapé imagem + as duas linhas legais; sem `background-image`; tipo sem banner → sem `<img>` de banner e com `<h1>` do `fallbackTitle` (DN-04) |
| `EMAIL_BANNERS` | `emailLayout.test.ts` | os 13 tipos do seed têm banner; nenhum aponta para `1.png`/"Heading" |
| `renderEmailButton` | `emailLayout.test.ts` | `href` e label presentes; estrutura em tabela; fundo `EMAIL_BRAND_DARK` e texto `EMAIL_BRAND_GOLD` (DN-06) |
| `htmlToPlainText` | `emailLayout.test.ts` | remove `<head>`/`<style>`; `<a href=X>T</a>` → `T (X)`; `<br>`/`<p>` → quebras; entidades `&copy;`/`&amp;` |
| Paridade web ↔ functions | `emailLayout.test.ts` | as mesmas entradas dão saídas idênticas em `src/lib/emailLayout` e `functions/src/emailLayout` (padrão de `nfPendingResolutionRules.test.ts`) |
| Seed | `emailTemplatesSeed.test.ts` | os 13 tipos presentes; `content` sem `<html`/`<body`/`<style`; `validateTemplateVariables(subject, content, allowed+appUrl+currentYear, required)` válido; os 3 de boas-vindas e o `password_reset` contêm a variável de link |
| `createTenantAndUserFromAccessRequest` | `accessRequestApproval.test.ts` (existente) | atualizar o mock: `welcome_approval` recebe link `/reset-password/` em vez de `generatePasswordResetLink` |

### 8.2 Playwright + Emulator Suite (regra 8 do CLAUDE.md)
Sem envio real: o emulador não roda functions, e os e-mails são conferidos e os links extraídos lendo `email_queue` (padrão de UC-02/UC-08). O token cru só existe no corpo do e-mail. Para expiração, gravar o doc de token direto com `expires_at` no passado (padrão do UC-08 8d e do UX-060 A3).

**Novo: `UC-60-definir-senha-pelo-link-de-primeiro-acesso.spec.ts`**
1. clinic_admin cria usuário em Minha Clínica › Usuários **sem campo de senha**. O doc em `email_queue` (`generic_user_welcome`) contém o link `/reset-password/`, `<img` com `/email/v1/banner-generic-user-welcome.png` e `alt` "Bem-vindo ao Curva Mestra! — Portal da Clínica". As claims não têm `requirePasswordChange`.
2. Abrir o link e recarregar: o token continua com `opened_at == null` (o GET não queima).
3. Clicar em "Definir minha senha", definir a senha, fazer login. O usuário vai para o dashboard, **sem** `/change-password`.
4. Reabrir o mesmo link: "já utilizado" + link "Solicitar nova senha".
5. Clicar e não concluir: recarregar a mesma aba mantém o formulário (DN-02); em outro contexto de navegador, o link aparece como já utilizado.
6. Sessão expirada (doc com `session_expires_at` no passado): o envio retorna erro com orientação para pedir nova senha.
7. Token `first_access` com `expires_at` no passado (72 h): "expirado".
8. System admin cria consultor: `consultant_welcome` com o link; o fluxo completo de definição funciona.
9. Aprovação de solicitação: `welcome_approval` contém `/reset-password/` (e não `mode=resetPassword`).
10. System admin cadastra clínica em `/admin/tenants/new` sem campo de senha (DN-01): `generic_user_welcome` com o link para o admin da clínica; nenhum `requirePasswordChange`.

**Reescrito: `UC-07-recuperar-senha-esquecida.spec.ts`**
- E-mail existente: doc `password_reset` em `email_queue`, token com 30 min; o fluxo completo de redefinição funciona; o mesmo link depois do uso fica inválido.
- E-mail inexistente: mesma mensagem e nenhum doc em `email_queue`.
- Inativo (claims `active: false`): mesma mensagem e nenhum doc em `email_queue` nem token (DN-07).
- Rate limit: a 4ª tentativa recebe a mensagem de 429.
- Um novo pedido invalida o link anterior (regressão do bug de 3a).
- Remover a dependência da API de oobCodes.

**Ajustados:**
- `UC-02` (`mode=resetPassword` → `/reset-password/`).
- `UC-08` (host do link vindo de `resolveAppBaseUrl`; o corpo contém banner `password_reset`; token legado sem `purpose` continua válido).
- `UC-55` (o editor edita o miolo; o preview `iframe` contém banner e rodapé; o aviso de banner fixo aparece; histórico/reversão de `content`).
- `UX-060` (cenário 9: grava o token no formato novo ou legado, os dois aceitos).

**Revisão humana obrigatória** de todo spec gerado ou alterado antes de virar gate de CI.

### 8.3 Documentação de UCs a atualizar (handoff para o `uml-use-case-writer`)

| UC | O que muda |
|----|-----------|
| UC-01 | Texto: a senha é definida pelo link de primeiro acesso (72 h, uso único), não por "link de redefinição" |
| UC-02 / UC-56 | RN-03/RN-05: link próprio `first_access` no lugar de `generatePasswordResetLink`; layout |
| UC-03 | Layout do `access_request_rejected` |
| UC-06 | Deixa de ser acionado na criação de usuário (UC-21/28/39/40); continua para UC-30/UC-37 e usuários antigos |
| UC-07 | Reescrita: API própria, token 30 min, rate limit, anti-enumeração, inativo não recebe nada (DN-07) |
| UC-08 | Layout; invalidação corrigida; link do ambiente certo |
| UC-21 | Sem senha temporária; admin da clínica recebe link de primeiro acesso (DN-01) |
| UC-23 / UC-25 / UC-26 / UC-27 / UC-29 / UC-54 | Layout dos templates de consultor |
| UC-28 | Sem senha temporária; `consultant_welcome` com link de primeiro acesso |
| UC-30 / UC-37 | Sem mudança de comportamento (registrar convivência com o link de primeiro acesso) |
| UC-39 / UC-40 | Sem campo de senha; sem `requirePasswordChange`; RN-10(b) do UC-40 ("O usuário receberá as credenciais") resolvido pelo novo texto |
| UC-55 | Editor edita só o miolo; banner/rodapé fixos; variáveis `appUrl`/`currentYear`; `content`/`layout_version`; migração |
| UC-57 | Layout do digest |
| UC-60 (novo, a criar) | "Definir senha pelo link de primeiro acesso" |

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas (e cd functions && npm run build)
[ ] npm run test        — todos os testes passando (novos da seção 8.1)
[ ] npm run test:rules  — passando
[ ] npm run test:e2e    — passando (novo UC-60 + UC-02/07/08/55/UX-060 ajustados), specs revisados por humano
[ ] Multi-tenant: nenhuma claim/regra de tenant alterada; tokens preservam tenant_id; coleções novas só Admin SDK
[ ] Segurança: token cru nunca logado; hash SHA-256; abertura/consumo em transação; resposta neutra no forgot; referrer no-referrer
[ ] Segurança: nenhum secret ou credencial no código (service account só por argumento de linha de comando)
[ ] Assets: https://dev-gscandelari.web.app/email/v1/rodape.png e um banner respondem 200 image/png
[ ] E-mail real recebido em dev (Gmail web + Outlook) para: generic_user_welcome, consultant_welcome, welcome_approval, password_reset — banner, botão, rodapé, versão texto e link funcionando
[ ] Mesmo e-mail conferido com imagens bloqueadas (alt legível)
[ ] Migração rodada em curva-mestra-dev (dry-run + apply) antes do PR → develop
[ ] onUserCreated apagada manualmente em curva-mestra-dev (STEP 14)
[ ] Cores do botão (hex extraídos) e contraste ≥ 4,5:1 registrados no PR (DN-06)
[ ] Branch pessoal: task branch mergeada em gscandelari_setup via PR e validada em dev-gscandelari.web.app
[ ] PR: gscandelari_setup → develop com template preenchido
[ ] Antes do merge em master (release) — avisar o usuário com antecedência; ele roda (PowerShell):
      firebase deploy --only firestore:rules --project curva-mestra
      npx tsx scripts/migrate-email-templates-layout.ts <service-account-prod.json> --dry-run
      npx tsx scripts/migrate-email-templates-layout.ts <service-account-prod.json> --apply   (autorizado — DN-03)
[ ] Antes do merge em master — avisar o usuário que o deploy de functions do release apaga onUserCreated em produção (DN-08)
[ ] Handoff: uml-use-case-writer (seção 8.3) e uc-issues-tracker (UC-40 RN-10(b) e demais)
```

---

## 10. Riscos e Mitigações

| ID | Risco | Probabilidade | Impacto | Mitigação |
|----|-------|--------------|---------|-----------|
| R-01 | Template de boas-vindas não migrado em produção no deploy: e-mail sai sem link e o usuário fica sem acesso | Média | Alto | Expand/contract; a migração roda **antes** do merge em `master` (checklist); fallback "Esqueci minha senha" funciona para conta sem senha |
| R-02 | Scanner de e-mail queima o link de primeiro acesso | Baixa | Médio | Queima só por POST no clique (4.1-D); fallback para "Esqueci minha senha" |
| R-03 | Clientes de e-mail bloqueiam imagens: título aparece só como `alt` | Alta | Baixo | `alt` com o título completo; texto do miolo autossuficiente |
| R-04 | Rodapé "© 2026" desatualizado em 2027 | Alta | Baixo | Aceito na DN-05; trocar pelo rodapé sem ano (troca de arquivo em `/email/v2/`) quando o designer enviar, antes de 01/01/2027 |
| R-05 | Divergência entre `src/lib/emailLayout.ts` e o espelho nas functions | Média | Médio | Teste de paridade Jest (8.1) |
| R-06 | Link com domínio errado (dev → produção, ou o inverso) | Média | Alto | `resolveAppBaseUrl` por projeto + teste; nunca usar o header `Host` (RNF-07) |
| R-07 | Abuso de "Esqueci minha senha" (spam no e-mail de terceiros, custo SMTP) | Média | Médio | Rate limit por e-mail e IP; resposta neutra |
| R-08 | `processEmailQueue` não está deployada em `curva-mestra-dev`: e-mails da fila não saem em dev | — | — | **Resolvido por decisão do usuário (28/10/2026): sem envio real em dev.** A aparência é conferida pelo "Enviar e-mail de teste" do editor (`sendTemplateTestEmail`, ativa em dev) e os fluxos são conferidos copiando o link do doc em `email_queue` no console do Firestore. `processEmailQueue` continua fora do deploy de dev |
| R-09 | Usuários de produção criados antes da task com senha temporária e `requirePasswordChange` pendente | Baixa | Baixo | Fluxo UC-06 preservado; nenhuma migração de usuário |
| R-10 | Consultores de produção que nunca receberam senha (temp nunca enviada) | Média | Baixo | Passam a conseguir entrar sozinhos via "Esqueci minha senha" (benefício); nenhuma ação em dados |
| R-11 | Customização do admin perdida na migração | Baixa | Médio | Backup em `versions` + relatório do dry-run; produção só no release com aviso (DN-03) |
| R-12 | Remover `onUserCreated`: em produção o `--force` apaga a função; em dev ela continua viva (deploy com `--only` por nome) | Média | Baixo | Esperado (DN-08). Produção: avisar o usuário antes do merge em `master` e registrar no PR de release. Dev: `firebase functions:delete` manual (STEP 14) |
| R-13 | Peso das imagens (49–85 KB) em conexões móveis | Média | Baixo | Otimização (RNF-08) |
| R-14 | Contraste do botão reprova no WCAG | Baixa | Baixo | Botão escuro com texto dourado (DN-06); contraste conferido e registrado no PR (RNF-12) |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Miolo (`content`) | Parte editável do e-mail, entre banner e rodapé, em fragmento HTML sem `<html>/<head>/<body>` |
| Layout | Envoltório fixo (banner do tipo + miolo + rodapé imagem + texto legal) gerado por `buildEmailLayout` |
| Link de primeiro acesso (`first_access`) | Link `/reset-password/{token}` válido por 72 h, invalidado no clique "Definir minha senha" |
| Link de redefinição (`password_reset`) | Link `/reset-password/{token}` válido por 30 min, consumido no envio da nova senha |
| Sessão pós-abertura | Segundo segredo devolvido na abertura do primeiro acesso, exigido para enviar a senha dentro da janela da DN-02 |
| Expand/contract | Migração em duas fases: adiciona o campo novo mantendo o antigo e remove o antigo numa task posterior |
| Anti-enumeração | Resposta idêntica para e-mail existente e inexistente, para não revelar quem é cliente |
| Pré-visualizador/scanner de links | Serviço de segurança de e-mail que acessa links antes do usuário |
| Bulletproof button | Botão de e-mail feito com tabela + `bgcolor`, que funciona inclusive no Outlook desktop |

---

## 12. Referências

- Pedido do usuário (28/10/2026), decisões D1–D4 e respostas às decisões DN-01 a DN-08 (28/10/2026), encaminhados pelo orquestrador.
- Arquivos de arte: `C:\Users\scand\Downloads\Banners e rodapé Email template\` (1.png–15.png), mapeamento conferido pelo orquestrador.
- `CLAUDE.md` (regra 8 — cadernos de teste), `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` (Git Flow, seção 15).
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-editor-templates-de-email.md` (UC-55, RN-14, contrato de variáveis).
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` (v2.0).
- UCs: UC-01, UC-02, UC-06, UC-07, UC-08, UC-21, UC-28, UC-30, UC-37, UC-39, UC-40, UC-55, UC-56, UC-57 em `ONLY_FOR_DEVS/PO_BA_Docs/`; `_MAPA-DE-BUGS-E-MELHORIAS.md` (UC-21-RN-03, UC-28-RN-04, UC-39-RN-03, UC-07-RN-03).
- Código: `src/lib/services/passwordResetService.ts`, `src/lib/services/emailTemplateAdmin.ts`, `src/lib/services/accessRequestApproval.ts`, `src/lib/emailTemplateRendering.ts`, `functions/src/services/*`, `functions/src/onUserCreated.ts`, `functions/src/processEmailQueue.ts`, `scripts/seed-email-templates.ts`, `firestore.rules:363-386`, `firebase.json`, `.firebaserc`, `.github/workflows/deploy-*.yml`, commit `467f462`.
- **Fora de escopo (registrar no mapa, se for o caso):**
  - callable legada `sendTempPasswordEmail` (`functions/src/sendTemporaryPasswordEmail.ts`), que manda senha em texto plano com HTML fixo e não é chamada por `src/`: candidata a remoção em task própria;
  - `sendCustomEmail`/`sendTestEmail`;
  - remoção do campo legado `body` (fase contract);
  - preferência de opt-out do digest UC-57.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 28/10/2026 | Doc Writer (Claude) | Versão inicial. Inclui o mapeamento dos 15 arquivos de banner/rodapé recebidos no mesmo dia. Status "Aguardando decisão" por causa de DN-01 a DN-08. |
| 1.1 | 28/10/2026 | Doc Writer (Claude) | Decisões DN-01 a DN-08 **resolvidas pelo usuário** (resposta explícita, 28/10/2026, todas na recomendação): UC-21 entra no primeiro acesso; invalidação no clique + 30 min de sessão + F5 mantém o formulário; migração autorizada com backup em `versions`, dev primeiro e produção só no release com aviso; `1.png` não publicado e `2.png` usado com texto legal em HTML; domínio `curvamestra.com.br`, botão escuro com texto dourado; inativo não recebe nada; `onUserCreated` removido com aviso antes do merge em `master`. Seção 4.4 virou tabela de decisões tomadas; RFs, RNs, STEPs 1/2/4/5/6/9/14, testes, checklist e riscos ajustados. Status → Planejamento. |
| 1.2 | 28/10/2026 | Claude (implementação) | Implementado na branch `feature/padronizacao-emails-e-links-de-senha` (STEPs 1–14). R-08 resolvido: sem envio real em dev. Decisões de implementação, todas seguindo as recomendações (usuário autorizou "siga suas recomendações" para este PR): (a) `sendFirstAccessEmail` (`src/lib/services/firstAccessEmail.ts`) concentra token + fila nos 4 pontos de criação; (b) `getAppBaseUrl` em `src/lib/appBaseUrl.ts`; (c) `renderStoredEmailTemplate` em `emailLayout.ts` (e espelho) decide layout × legado e só resolve a URL base quando precisa; (d) reverter uma versão restaura o formato dela — versão sem `content` (anterior à migração) remove `content`/`layout_version` e volta ao `body`; (e) conteúdo dos 13 templates em `scripts/lib/emailTemplateDefinitions.ts`, compartilhado por seed, migração e testes; `resolveFirestore` em `scripts/lib/firestoreTarget.ts`; (f) migração classifica "customizado" por `updated_by != 'seed-script'`; (g) links de consultor apontam para `/login` quando não há rota dedicada; "Nova solicitação" aponta para `/register` (o `/early-access` não existe); data congelada do seed do `new_tenant_notification` removida; (h) texto de `/admin/consultants/new` corrigido (ainda falava em senha temporária); (i) rate limit por IP usa o primeiro IP de `x-forwarded-for` — pode ser forjado pelo cliente, mas o limite por e-mail continua valendo (risco aceito, registrar no PR). Status → Implementado. |
