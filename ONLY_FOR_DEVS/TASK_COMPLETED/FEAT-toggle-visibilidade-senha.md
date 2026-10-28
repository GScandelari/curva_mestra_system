# Feature: Opção de mostrar/ocultar senha em todos os campos de senha (UX-060)

**Projeto:** Curva Mestra
**Data:** 21/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Stanke Scandelari
**Data de Conclusão:** 26/10/2026
**Tipo:** Feature
**Branch sugerida:** `feature/toggle-visibilidade-senha`
**Prioridade:** Média
**Versão:** 1.3

> Hoje, 16 dos 18 campos de senha do sistema não têm como mostrar o que foi digitado. Os outros 2 (`/admin/users` e `/admin/consultants/[id]`) têm um "olho" feito à mão, sem nome acessível (UX-017). Esta feature cria o componente reutilizável `PasswordInput` (`src/components/ui/password-input.tsx`), no padrão shadcn `new-york` e montado sobre o `Input` existente. O componente tem um botão "olho" acessível dentro do campo, e cada campo controla a própria visibilidade. Ele substitui todos os `type="password"` do sistema, em 9 arquivos e 9 UCs. A mudança é só de front-end: não toca em regras do Firestore, dados, API, multi-tenant nem autenticação. Fecha o UX-060 e a parte "mostrar senha" do UX-017.

---

## Decisões resolvidas

A decisão aberta na v1.0 foi respondida explicitamente pelo usuário em 21/10/2026 (via coordenador). O documento está pronto para o `dev-task-manager`.

| # | Decisão | Resposta do usuário | Onde impacta |
|---|---------|---------------------|--------------|
| D1 | Como o botão "olho" se anuncia ao leitor de tela: (A) rótulo fixo + `aria-pressed`; (B) rótulo dinâmico sem `aria-pressed`; (C) rótulo dinâmico + `aria-pressed`. | **(B), padrão GOV.UK Design System ("Password input").** O `aria-label` alterna entre `"Mostrar senha"` (senha oculta) e `"Ocultar senha"` (senha visível). O botão **não** usa `aria-pressed`. O `aria-controls` continua. O rótulo descreve a **ação** que o botão vai executar, e isso evita a ambiguidade de rótulo dinâmico + `aria-pressed` apontada pela WAI-ARIA APG. | §3.1 RF-03, §4.1(c), §4.3, §6.1, §6.2, §6.3, STEP 1, STEP 8, §8.1, §8.2, §9, §10, §12.1 |

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop` (antes de criar a branch, conferir se `develop` local está em sync com `origin/develop` e com `master`).
**Branch da task:** `feature/toggle-visibilidade-senha`

Fluxo obrigatório (`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seções 1.3-1.4):
`feature/toggle-visibilidade-senha` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop`.

**PR nunca vai para `master`.** O merge é feito pelo usuário, via PR.

| Step | Tipo | Escopo | Mensagem de commit planejada |
|------|------|--------|------------------------------|
| STEP 1 | `feat` | `ui` | `feat(ui): add PasswordInput with accessible show/hide toggle` |
| STEP 2 | `feat` | `auth` | `feat(auth): add show/hide password toggle to login, change and reset password` |
| STEP 3 | `feat` | `ui` | `feat(ui): add show/hide password toggle to admin and clinic profile forms` |
| STEP 4 | `feat` | `ui` | `feat(ui): add show/hide password toggle to user creation dialogs` |
| STEP 5 | `fix` | `admin` | `fix(admin): replace unlabeled password toggles with PasswordInput` |
| STEP 6 | `test` | `e2e` | `test(e2e): add UX-060 notebook for password visibility toggle` |
| STEP 7 | `test` | `e2e` | `test(e2e): add profile screens to a11y routes and baseline` |
| STEP 8 | — | — | Validação manual, sem commit |

Firestore rules, índices e Storage rules **não mudam** (§5.4). Por isso não há comando de deploy de rules/indexes a passar ao usuário antes do merge em `master`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Inventário completo** (`grep -rn "password" src --include=*.tsx`, conferido em 21/10/2026). Nenhuma tela usa `react-hook-form`: todos os campos são `Input` controlados por `useState` (`value` + `onChange`).

| # | Tela / componente | Arquivo:linha | Campos (`id`) | `autoComplete` atual | UC |
|---|---|---|---|---|---|
| 1 | Login | `src/app/(auth)/login/page.tsx:277-286` | `password` | `current-password` | UC-04 |
| 2 | Troca obrigatória de senha | `src/app/(auth)/change-password/page.tsx:168-206` | `currentPassword`, `newPassword`, `confirmPassword` | `current-password`, `new-password`, `new-password` | UC-06 |
| 3 | Redefinição por link (token) | `src/app/(auth)/reset-password/[token]/page.tsx:225-250` | `newPassword` (com `autoFocus`), `confirmPassword` | `new-password` ×2 | UC-08 |
| 4 | Perfil do system_admin | `src/app/(admin)/admin/profile/page.tsx:193-231` | `currentPassword`, `newPassword` (`minLength={8}`), `confirmPassword` | `current-password`, `new-password`, `new-password` | UC-38 |
| 5 | Perfil do usuário de clínica | `src/app/(clinic)/clinic/profile/page.tsx:307-343` | `currentPassword`, `newPassword` (`minLength={6}`), `confirmPassword` | `current-password`, `new-password`, `new-password` | UC-41 |
| 6 | Diálogo "Adicionar Novo Usuário" (clínica) | `src/components/clinic/UsersTab.tsx:274-282` | `password` | **ausente** | UC-40 |
| 7 | Diálogo "Adicionar Novo Usuário" (admin, detalhe da clínica) | `src/app/(admin)/admin/tenants/[id]/page.tsx:801-810` | `newUserPassword` | `new-password` | UC-39 |
| 8 | "Definir Senha Manualmente" no diálogo "Editar Usuário" | `src/app/(admin)/admin/users/page.tsx:763-797` | `newPassword`, `confirmPassword` | **ausente** | UC-37 (diálogo de UC-36) |
| 9 | "Definir Senha Manualmente" no card "Gerenciamento de Senha" | `src/app/(admin)/admin/consultants/[id]/page.tsx:492-526` | `newPassword`, `confirmPassword` | **ausente** | UC-30 |

Total: **18 campos em 9 arquivos**. `register/page.tsx` e `forgot-password` não têm campo de senha. O UC-07 (recuperação nativa via `sendPasswordResetEmail`) termina na página hospedada do Firebase Auth, fora do app, e por isso **não** é afetado.

**Toggle ad-hoc existente (linhas 8 e 9 da tabela):**

- `users/page.tsx:104` e `consultants/[id]/page.tsx:65` declaram `const [showNewPassword, setShowNewPassword] = useState(false)`.
- Um **único** estado controla os **dois** campos: o `type` de `confirmPassword` (`users:792`, `consultants:521`) também lê `showNewPassword`.
- O botão (`users:774-784`, `consultants:503-513`) é um `<button type="button">` cru, só com o ícone `Eye`/`EyeOff`, **sem** `aria-label` nem `aria-controls`. O leitor de tela anuncia só "botão" (UX-017).
- Os campos são `<input>` crus que copiam à mão as classes do `Input` com variações (`h-9`, `bg-transparent`, `shadow-sm`, `focus-visible:ring-1`). O `_PADRAO-VISUAL-UI.md` §4.1 e §4.2 já registra isso como desvio.
- Os imports `Eye` e `EyeOff` (`users:28-29`, `consultants:19-20`) só são usados nesse botão.

**Primitivo base:** `src/components/ui/input.tsx` (`forwardRef`, `InputProps extends React.InputHTMLAttributes<HTMLInputElement>`, classes `h-10 ... focus-visible:ring-2 ...`). Não existe hoje `password-input.tsx` em `src/components/ui/`. `components.json`: `style: "new-york"`. `Button` tem `size="icon"` = `h-10 w-10` (`button.tsx:21`).

**Testes E2E existentes que digitam em campos de senha** sempre localizam o campo por `id`: `#password` em `tests/e2e/helpers/auth.ts:20` e nos UC-04, UC-09, UC-52, UC-56, UC-58 e UC-59; `#currentPassword`, `#newPassword` e `#confirmPassword` no UC-06 e no UC-08. Nenhum usa `getByLabel` em campo de senha.

### 1.2 Problema identificado

1. **UX-060 (P2, acessibilidade/usabilidade):** os campos de senha não têm opção de mostrar/ocultar. Quem digita no celular (PWA/Capacitor) ou tem baixa visão ou dislexia não consegue conferir o que digitou. O resultado é tentativa e erro no login e erro de "senhas não conferem" na troca e na criação de senha.
2. **UX-017 (P1), parte "mostrar senha":** os dois toggles que existem não têm nome acessível (WCAG 4.1.2).
3. **Inconsistência:** só 2 das 9 telas têm o recurso, e nessas 2 um único botão revela os dois campos.
4. **Duplicação visual:** 4 `<input>` crus reimplementam o `Input` (`_PADRAO-VISUAL-UI.md` §4.2).
5. **Três telas sem `autoComplete`** (linhas 6, 8 e 9): nelas, um admin define a senha **de outra pessoa**. Sem `autoComplete="new-password"`, o gerenciador de senhas do navegador pode preencher ali a senha salva do **próprio** admin.

### 1.3 Motivação estratégica

- Pedido direto do usuário (21/10/2026), com escopo aprovado: **todos** os campos `type="password"`.
- O `_PADRAO-UX.md` §3.1 (nome acessível e toggle) já define a regra. Resolver por um componente único evita que uma tela nova repita o desvio.
- Há cliente real em produção desde 16/10/2026. O login (UC-04) é a tela mais usada do sistema, e a mudança precisa ter risco mínimo, sem alterar nenhum fluxo de autenticação.

---

## 2. Objetivos

1. **Criar** o componente `PasswordInput` (`src/components/ui/password-input.tsx`) com a mesma API do `Input` e um botão acessível de mostrar/ocultar.
2. **Substituir** os 18 campos de senha dos 9 arquivos pelo `PasswordInput`, cada um com estado de visibilidade próprio.
3. **Remover** os toggles ad-hoc de `admin/users` e `admin/consultants/[id]`, fechando a parte "mostrar senha" do UX-017 e os desvios do `_PADRAO-VISUAL-UI.md` §4.1/§4.2 nessas telas.
4. **Garantir** que os atributos `id`, `autoComplete`, `required`, `minLength`, `disabled`, `placeholder` e `autoFocus` continuem iguais. Assim os gerenciadores de senha e os cadernos Playwright existentes não quebram.
5. **Adicionar** `autoComplete="new-password"` nas três telas em que um admin define a senha de terceiros e o atributo falta hoje.
6. **Criar** o caderno Playwright da feature e colocar `/admin/profile` e `/clinic/profile` na varredura axe (`A11Y_ROUTES`).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Todo campo de senha do sistema mostra, dentro do campo, à direita, um botão com ícone `Eye` (senha oculta) ou `EyeOff` (senha visível). | todos (inclusive não autenticado) | Must |
| RF-02 | Clicar no botão (ou acioná-lo com Espaço/Enter pelo teclado) alterna o `type` do campo entre `password` e `text`, **sem** apagar nem alterar o valor digitado. | todos | Must |
| RF-03 | O botão tem nome acessível que descreve a ação seguinte (D1 = B): `aria-label="Mostrar senha"` com a senha oculta e `aria-label="Ocultar senha"` com a senha visível. O botão **não** usa `aria-pressed`. O `aria-controls` aponta para o `id` do campo. | todos | Must |
| RF-04 | Cada campo tem estado de visibilidade próprio. Revelar "Nova Senha" não revela "Senha Atual" nem "Confirmar". | todos | Must |
| RF-05 | Todo campo começa oculto (`type="password"`) a cada montagem. Fechar e reabrir um diálogo volta o campo a ficar oculto. | todos | Must |
| RF-06 | O botão é `type="button"`: nunca envia o formulário. Enter **dentro do campo** continua enviando o formulário, como hoje. | todos | Must |
| RF-07 | Quando o campo está `disabled` (ex.: `loading` no login), o botão também fica desabilitado. | todos | Should |
| RF-08 | `admin/users` e `admin/consultants/[id]` passam a ter um botão por campo ("Nova Senha" e "Confirmar Senha"), no lugar do botão único que revelava os dois. | system_admin | Must |
| RF-09 | Os campos de senha definida por um admin para outra pessoa (`UsersTab`, `admin/users`, `admin/consultants/[id]`) passam a ter `autoComplete="new-password"`. | system_admin / clinic_admin | Should |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | O botão fica na ordem natural de Tab, logo depois do campo (campo → olho → próximo controle), e não sai da navegação por teclado (sem `tabIndex={-1}`, WCAG 2.1.1). Clicar com mouse/toque **não** tira o foco do campo. | Usabilidade / Acessibilidade |
| RNF-02 | Área de toque do botão: 40×40 px (largura `w-10` × altura do campo `h-10`), acima do mínimo de 24×24 px do `_PADRAO-UX.md` §6. | Acessibilidade |
| RNF-03 | O ícone é decorativo (`aria-hidden="true"`). O nome vem só do `aria-label`. | Acessibilidade |
| RNF-04 | O campo nunca ativa corretor, autocapitalização nem verificação ortográfica, mesmo com `type="text"` (`autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`). Assim a senha visível não é enviada a serviços de verificação ortográfica do navegador nem alterada pelo teclado móvel. | Segurança |
| RNF-05 | O botão nativo de revelar senha do Edge (`::-ms-reveal`) fica oculto, para não aparecerem dois "olhos". | Usabilidade |
| RNF-06 | O componente reutiliza o `Input` (sem copiar classes) e o `Button` (`variant="ghost"`, `size="icon"`), conforme `_PADRAO-VISUAL-UI.md` §4.1/§4.2. | Manutenibilidade |
| RNF-07 | Mudança só de front-end: nenhum arquivo em `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `src/app/api/**`, `functions/**`, `src/lib/services/**` ou `src/types/**` é alterado. | Segurança / Manutenibilidade |
| RNF-08 | Os `id` dos campos não mudam. Os cadernos UC-04, UC-06, UC-08, UC-09, UC-52, UC-56, UC-58 e UC-59 continuam passando sem edição. | Manutenibilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | A senha começa **sempre** oculta. O sistema nunca lembra a preferência de visibilidade (nem em `localStorage`, nem entre telas). | Evita expor a senha numa tela aberta em ambiente compartilhado (recepção de clínica). |
| RN-02 | Revelar a senha é ação explícita do usuário, campo a campo. | Menor exposição possível (RF-04). |
| RN-03 | A validação, as mensagens de erro e as chamadas de API de cada tela não mudam. | Escopo puramente visual/acessibilidade. As regras de senha (UC-06 RN-02, UC-38, UC-41 etc.) continuam como estão. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

**(a) Componente único `PasswordInput` em `src/components/ui/password-input.tsx`.**
- `React.forwardRef<HTMLInputElement, PasswordInputProps>`, com `PasswordInputProps = Omit<InputProps, 'type'>`. O `type` é controlado pelo componente, e quem chama não consegue sobrescrevê-lo.
- Renderiza `<div className="relative">` com o `<Input>` existente e um `<Button>` posicionado em absoluto.
- Todas as outras props (`id`, `value`, `onChange`, `autoComplete`, `required`, `minLength`, `disabled`, `placeholder`, `autoFocus`, `className`) vão direto para o `<Input>`. A troca em cada tela é **só o nome do componente**: `<Input type="password" ...>` vira `<PasswordInput ...>`.
- O estado `visible` é **interno** (`useState(false)`), e por isso cada instância é independente (RF-04) e reinicia ao desmontar (RF-05).
- Não há API controlada (`visible`/`onVisibleChange`) no MVP: nenhuma tela precisa dela depois da decisão de um estado por campo.

**(b) Teclado e foco.**
- O botão fica no DOM logo depois do `<input>`, então a ordem de Tab é campo → olho → próximo controle. Não há `tabIndex={-1}`: tirar o botão do Tab deixaria o recurso inacessível pelo teclado.
- `onMouseDown={(e) => e.preventDefault()}` no botão evita que o clique de mouse/toque tire o foco do campo. O cursor fica onde estava e o teclado virtual do celular não fecha. Pelo teclado, o usuário chega ao botão com Tab e aciona com Espaço/Enter normalmente.

**(c) Nome acessível (D1 = B, padrão GOV.UK).**
- `aria-label` dinâmico: `"Mostrar senha"` quando a senha está oculta, `"Ocultar senha"` quando está visível. Não há `aria-pressed`: o rótulo já diz o que o botão vai fazer, e combinar rótulo dinâmico com `aria-pressed` é ambíguo (WAI-ARIA APG, "Toggle button").
- `aria-controls={inputId}` liga o botão ao campo.
- O ícone acompanha o rótulo: `Eye` com "Mostrar senha" e `EyeOff` com "Ocultar senha".
- Com várias instâncias na mesma tela (perfil: 3 botões "Mostrar senha"), cada botão vem logo depois do próprio rótulo e campo, e o `aria-controls` liga botão e campo. Rótulos por campo ("Mostrar senha atual") foram descartados (§4.2).
- Se `id` não for informado, o componente gera um com `React.useId()`, para que `aria-controls` sempre aponte para algo.

**(d) Helper puro para estado → atributos.** `src/lib/passwordVisibility.ts` (a criar) exporta `getPasswordToggleState(visible)`, que retorna `{ inputType, buttonLabel }`, e as constantes dos dois rótulos. Assim a regra da D1 fica num lugar só, testável com Jest (o `jest.config.js` usa `testEnvironment: 'node'`, sem renderização de componente), e o componente só a consome.

**(e) Atributos de segurança/compatibilidade fixos no `<Input>`:** `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` (RNF-04) e as classes `[&::-ms-reveal]:hidden [&::-ms-clear]:hidden` (RNF-05; variante arbitrária do Tailwind 3.4, versão do projeto `^3.4.17`) + `pr-10` para o texto não ficar sob o ícone.

**(f) Visual.**
- `Button variant="ghost" size="icon"` com `className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"`.
- Ícone `h-4 w-4`, igual aos toggles atuais.
- O anel de foco do `Button` (`focus-visible:ring-2`) mostra o foco no botão sem conflitar com o do campo.
- Nos campos migrados de `admin/users` e `admin/consultants/[id]`, a altura passa de `h-9` para `h-10` (padrão do `Input`). É um ajuste visual intencional de alinhamento ao primitivo.

**(g) Firestore/multi-tenant.** Nenhuma operação de dados é criada ou alterada. O filtro por `tenant_id` não se aplica: o componente é puramente de apresentação e não lê nem grava nada.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Copiar o toggle ad-hoc de `admin/users` nas outras 7 telas | Repete o desvio do UX-017 e do `_PADRAO-VISUAL-UI.md` §4.2 em 18 lugares. Qualquer correção futura teria que ser feita em todos. |
| Um botão por formulário revelando todos os campos (comportamento atual de `admin/users`) | Expõe também a "Senha Atual" quando o usuário só queria conferir a nova. O pedido aprovado é "cada campo tem seu próprio estado". |
| `tabIndex={-1}` no botão, para "não atrapalhar o Tab" | Deixa o recurso inacessível pelo teclado (WCAG 2.1.1). Ter um Tab a mais por campo é o custo aceito pelos padrões de referência (GOV.UK, APG). |
| Rótulo por campo ("Mostrar senha atual", "Mostrar nova senha") | Obrigaria cada tela a passar mais uma prop e deixaria o rótulo dependente do texto do `<Label>`. O `aria-controls` + a posição logo depois do campo já dão o contexto. Pode virar melhoria futura se o `ux-reviewer` apontar. |
| Ocultar a senha automaticamente ao enviar o formulário (comportamento do GOV.UK "Password input") | Muda o comportamento do erro de login: depois de "senha incorreta", a senha que o usuário revelou volta a ficar oculta, e isso não foi pedido. A RN-01 + o reinício ao desmontar já cobrem a exposição. Fica registrado como possível evolução se a validação manual (STEP 8) mostrar que o gerenciador de senhas não oferece salvar quando o envio acontece com `type="text"`. |
| Lembrar a preferência em `localStorage` | Contraria a RN-01. |
| Componente controlado (`visible` + `onVisibleChange`) | Nenhuma tela precisa. Seria API a mais para manter sem consumidor. |
| Ícone dentro de um `<span>` clicável em vez de `<Button>` | Sem semântica de botão e sem foco por teclado. É o mesmo problema de UX-005. |

### 4.3 Trade-offs aceitos

- **Sem região `aria-live` no MVP (D1 = B).** O novo rótulo é anunciado quando o leitor relê o botão. Se o anúncio vem logo após o clique, depende do leitor de tela (ver §10).
- **Um Tab a mais por campo de senha.** No perfil, são 3 paradas extras. É o comportamento padrão e acessível.
- **A visibilidade continua após um envio bem-sucedido enquanto a tela estiver montada.** Em `admin/profile` e `clinic/profile`, os campos voltam a `''` depois de trocar a senha, mas o "olho" continua no estado em que estava. O impacto é baixo: o campo fica vazio, e a próxima navegação reinicia o estado.
- **Pequena mudança visual** nos dois campos migrados (`h-9` → `h-10`, sem `shadow-sm`). O resultado fica alinhado ao resto do sistema.
- **Extensões de gerenciador de senha** (1Password, Bitwarden, LastPass) desenham o próprio ícone na borda direita do campo e podem se sobrepor ao "olho". Isso é comum em qualquer implementação do padrão. A verificação está no STEP 8.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/components/ui/password-input.tsx` | Componente UI (shadcn `new-york`) | `PasswordInput` com botão acessível de mostrar/ocultar (§6.2) |
| `src/lib/passwordVisibility.ts` | Lib pura | `getPasswordToggleState(visible)` e a constante do rótulo (§6.1) |
| `src/__tests__/passwordVisibility.test.ts` | Teste Jest | Cobertura do helper (§8.1) |
| `tests/e2e/UX-060-mostrar-ocultar-senha.spec.ts` | Caderno Playwright | Cobertura transversal das 9 telas (§8.2). O prefixo `UX-060` é usado porque a feature atravessa 9 UCs e não pertence a um só, no mesmo espírito do prefixo `_infra-` dos specs que não são de UC. |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/app/(auth)/login/page.tsx` | `#password` (linhas 277-286): `Input type="password"` → `PasswordInput`. Importar `PasswordInput`; `Input` continua (campo `#email`). |
| `src/app/(auth)/change-password/page.tsx` | 3 campos (linhas 168-206) → `PasswordInput`. **Remover** o import de `Input` (linha 7), que fica sem uso. |
| `src/app/(auth)/reset-password/[token]/page.tsx` | 2 campos (linhas 225-250) → `PasswordInput`, mantendo `autoFocus` em `#newPassword`. **Remover** o import de `Input` (linha 7). |
| `src/app/(admin)/admin/profile/page.tsx` | 3 campos (linhas 193-231) → `PasswordInput`, mantendo `minLength={8}`. `Input` continua (nome/e-mail). |
| `src/app/(clinic)/clinic/profile/page.tsx` | 3 campos (linhas 307-343) → `PasswordInput`, mantendo `minLength={6}`. `Input` continua. |
| `src/components/clinic/UsersTab.tsx` | `#password` (linhas 275-282) → `PasswordInput` + `autoComplete="new-password"` (RF-09). `Input` continua. |
| `src/app/(admin)/admin/tenants/[id]/page.tsx` | `#newUserPassword` (linhas 802-810) → `PasswordInput`. `Input` continua. |
| `src/app/(admin)/admin/users/page.tsx` | Os dois `<input>` crus e o `<button>` (linhas 763-797) → dois `PasswordInput` com `autoComplete="new-password"`. Remover o `<div className="relative">`, o estado `showNewPassword` (linha 104) e os imports `Eye`/`EyeOff` (linhas 28-29). |
| `src/app/(admin)/admin/consultants/[id]/page.tsx` | Mesma mudança, nas linhas 492-526. Remover `showNewPassword` (linha 65) e `Eye`/`EyeOff` (linhas 19-20). |
| `tests/e2e/fixtures/a11y-routes.ts` | Adicionar `admin-profile` (`/admin/profile`, `systemAdmin`, `readyHeading: 'Meu Perfil'`) e `clinic-profile` (`/clinic/profile`, `clinicAdminA`, `readyHeading: 'Meu Perfil'`). |
| `tests/e2e/fixtures/a11y-baseline.json` | Entradas `chromium\|admin-profile`, `chromium\|clinic-profile`, `mobile-chromium\|admin-profile` e `mobile-chromium\|clinic-profile`, regravadas com `A11Y_UPDATE_BASELINE=1` (STEP 7). |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| Nenhuma | Nenhuma | Nenhuma leitura ou escrita nova ou alterada. |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Sem alteração | — |

**Multi-tenant:** não se aplica. O componente é de apresentação, e os fluxos que o usam continuam chamando exatamente as mesmas APIs (`/api/users/create`, `/api/users/{id}/set-password`, `/api/consultants/{id}/set-password`, `/api/auth/reset-password` etc.) com os mesmos dados. **Custom claims:** sem alteração.

### 5.5 O que NÃO muda

- Validações e mensagens de senha de cada tela (`validatePassword` de `@/lib/validations/serverValidations` no UC-06/UC-08, `minLength` dos perfis, validação client-side do UC-39/UC-40).
- Fluxos de autenticação: `useAuth().signIn`, `reauthenticateWithCredential` + `updatePassword` (perfis), `requirePasswordChange` (UC-06), tokens de redefinição (UC-08).
- `src/components/ui/input.tsx` (só é reutilizado) e `src/components/ui/button.tsx`.
- Os outros itens do UX-017 (Editar/Suspender clínica, documentos legais, copiar código etc.) continuam **Abertos**: esta task só resolve a parte "mostrar senha".
- O resto do UX-048 (`alert()`/`confirm()` em `admin/users`) fica fora do escopo.
- Os cadernos UC-04, UC-06, UC-08, UC-09, UC-52, UC-56, UC-58 e UC-59 não são editados (RNF-08).

---

## 6. Especificação Técnica

### 6.1 Helper puro (`src/lib/passwordVisibility.ts`, a criar)

Conforme a D1 = (B):

```ts
export const SHOW_PASSWORD_LABEL = 'Mostrar senha';
export const HIDE_PASSWORD_LABEL = 'Ocultar senha';

export interface PasswordToggleState {
  inputType: 'password' | 'text';
  buttonLabel: typeof SHOW_PASSWORD_LABEL | typeof HIDE_PASSWORD_LABEL;
}

export function getPasswordToggleState(visible: boolean): PasswordToggleState {
  return {
    inputType: visible ? 'text' : 'password',
    buttonLabel: visible ? HIDE_PASSWORD_LABEL : SHOW_PASSWORD_LABEL,
  };
}
```

O rótulo descreve a ação que o clique vai executar. Não há campo `pressed`, e o componente não emite `aria-pressed`.

Sem imports de React, Next ou Firebase.

### 6.2 Componente (`src/components/ui/password-input.tsx`, a criar)

```tsx
'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { getPasswordToggleState } from '@/lib/passwordVisibility';

export type PasswordInputProps = Omit<InputProps, 'type'>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const state = getPasswordToggleState(visible);

    return (
      <div className="relative">
        <Input
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...props}
          id={inputId}
          ref={ref}
          type={state.inputType}
          disabled={disabled}
          className={cn('pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden', className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={state.buttonLabel}
          aria-controls={inputId}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
```

Notas:
- `type` vem depois do `{...props}` e não faz parte de `PasswordInputProps`, então não pode ser sobrescrito.
- `autoCapitalize`, `autoCorrect` e `spellCheck` vêm antes do spread. Uma tela pode sobrescrevê-los, mas nenhuma das 9 deve fazer isso.
- O `ref` aponta para o `<input>` (mesmo contrato do `Input`).
- `InputProps` já é exportado por `input.tsx`.
- React 19 (`^19.2.3`) continua aceitando `forwardRef`. Ele é mantido por consistência com `input.tsx`.

### 6.3 Mudanças na UI (por tela)

Padrão de troca: `<Input id="X" type="password" {...resto} />` vira `<PasswordInput id="X" {...resto} />`. Todos os atributos restantes ficam idênticos, inclusive a ordem visual, o `<Label htmlFor>` e o texto de ajuda abaixo do campo.

| Tela | Antes | Depois |
|---|---|---|
| `/login` | `#password` sem toggle | `#password` com botão. Ordem de Tab: e-mail → senha → olho → "Entrar". |
| `/change-password` | 3 campos sem toggle, ocultos quando `passwordChanged` | 3 campos com botão independente. O bloco continua condicionado a `!passwordChanged`. |
| `/reset-password/[token]` | 2 campos, `autoFocus` na nova senha | 2 campos com botão. O `autoFocus` continua no `<input>` `#newPassword`, não no botão. |
| `/admin/profile`, `/clinic/profile` | 3 campos sem toggle | 3 botões independentes. |
| `UsersTab` (diálogo) | `#password` sem toggle e sem `autoComplete` | Com botão e `autoComplete="new-password"`. Fechar e reabrir o diálogo reinicia o estado (o `DialogContent` do Radix desmonta ao fechar). |
| `/admin/tenants/[id]` (diálogo) | `#newUserPassword` sem toggle | Com botão. |
| `/admin/users` (diálogo "Editar Usuário") e `/admin/consultants/[id]` (card "Gerenciamento de Senha") | Um botão sem nome, só em "Nova Senha", que revela os dois campos. `<input>` cru `h-9`. | Um botão por campo, com `aria-label` dinâmico ("Mostrar senha"/"Ocultar senha") e `aria-controls`. `PasswordInput` (`h-10`) com `autoComplete="new-password"`. Placeholders "Mínimo 6 caracteres" e "Repita a senha" mantidos. |

### 6.4 Mudanças em API Routes

N/A.

---

## 7. Plano de Implementação

### STEP 1 — Helper puro e componente `PasswordInput`

**Objetivo:** Ter o componente pronto e o helper testado, ainda sem uso nas telas.

**Arquivos afetados:**
- `src/lib/passwordVisibility.ts` (a criar)
- `src/__tests__/passwordVisibility.test.ts` (a criar)
- `src/components/ui/password-input.tsx` (a criar)

**Ações:**
1. Implementar o helper conforme a §6.1 (D1 = B).
2. Escrever os testes da §8.1.
3. Implementar o componente conforme a §6.2.

**Validação:** `npm run test -- passwordVisibility` passa, e `npm run type-check` e `npm run lint` ficam sem erros.

**Commit:** `feat(ui): add PasswordInput with accessible show/hide toggle`

### STEP 2 — Telas de autenticação (UC-04, UC-06, UC-08)

**Objetivo:** Login, troca obrigatória e redefinição por token com o "olho".

**Arquivos afetados:**
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/change-password/page.tsx`
- `src/app/(auth)/reset-password/[token]/page.tsx`

**Ações:**
1. Trocar os 6 campos conforme a §6.3.
2. Remover o import de `Input`, que fica sem uso, em `change-password` e `reset-password/[token]`.

**Validação:**
- Com `firebase emulators:start` + `npm run dev`: em `/login`, digitar a senha, clicar no olho (o texto aparece), clicar de novo (o texto some) e entrar normalmente.
- `npm run test:e2e -- tests/e2e/UC-04-fazer-login-com-redirecionamento-por-papel.spec.ts tests/e2e/UC-06-trocar-senha-obrigatoria-no-primeiro-acesso.spec.ts tests/e2e/UC-08-system-admin-envia-link-de-redefinicao-de-senha.spec.ts` passa **sem editar** os specs.

**Commit:** `feat(auth): add show/hide password toggle to login, change and reset password`

### STEP 3 — Perfis (UC-38, UC-41)

**Objetivo:** Os 3 campos de cada perfil com botões independentes.

**Arquivos afetados:**
- `src/app/(admin)/admin/profile/page.tsx`
- `src/app/(clinic)/clinic/profile/page.tsx`

**Ações:** trocar os 6 campos conforme a §6.3, preservando `minLength`.

**Validação:** em cada perfil, revelar só "Nova Senha" deixa os outros dois com `type="password"` (DevTools). A troca de senha continua funcionando (testar com um usuário do emulador).

**Commit:** `feat(ui): add show/hide password toggle to admin and clinic profile forms`

### STEP 4 — Diálogos de criação de usuário (UC-39, UC-40)

**Objetivo:** "Adicionar Novo Usuário" no portal da clínica e no detalhe da clínica (admin) com o "olho".

**Arquivos afetados:**
- `src/components/clinic/UsersTab.tsx`
- `src/app/(admin)/admin/tenants/[id]/page.tsx`

**Ações:**
1. Trocar os 2 campos.
2. Adicionar `autoComplete="new-password"` no `UsersTab` (RF-09).

**Validação:** abrir o diálogo, revelar, fechar com Esc e reabrir: o campo volta oculto. Criar um usuário no emulador continua funcionando.

**Commit:** `feat(ui): add show/hide password toggle to user creation dialogs`

### STEP 5 — Migração dos toggles ad-hoc (UC-30, UC-37; UX-017)

**Objetivo:** Remover os toggles sem nome e passar a usar o componente.

**Arquivos afetados:**
- `src/app/(admin)/admin/users/page.tsx`
- `src/app/(admin)/admin/consultants/[id]/page.tsx`

**Ações:**
1. Substituir o bloco `<div className="relative"><input .../><button ...>...</button></div>` e o `<input>` de confirmação por dois `PasswordInput` com `autoComplete="new-password"`.
2. Remover `showNewPassword`/`setShowNewPassword` e os imports `Eye`/`EyeOff`.
3. Importar `PasswordInput`.

**Validação:**
- `grep -n "showNewPassword\|EyeOff" "src/app/(admin)/admin/users/page.tsx" "src/app/(admin)/admin/consultants/[id]/page.tsx"` não retorna nada.
- `grep -rn 'type="password"' src` não retorna nada (todo campo de senha passa pelo componente).
- "Definir Senha" continua funcionando no emulador.

**Commit:** `fix(admin): replace unlabeled password toggles with PasswordInput`

### STEP 6 — Caderno Playwright UX-060

**Objetivo:** Criar `tests/e2e/UX-060-mostrar-ocultar-senha.spec.ts` com os cenários da §8.2.

**Arquivos afetados:**
- `tests/e2e/UX-060-mostrar-ocultar-senha.spec.ts` (a criar)

**Ações:**
1. Seguir o padrão dos cadernos existentes: `loginAs` (`tests/e2e/helpers/auth.ts`), `TEST_USERS`/`TEST_PASSWORD`/`TEST_TENANTS` (`tests/e2e/fixtures/seed-data.ts`), `getEmulatorAdminAuth`/`getEmulatorAdminFirestore` (`scripts/lib/emulatorAdmin.ts`).
2. Localizar cada botão por `page.locator('button[aria-controls="<id>"]')`. Isso evita ambiguidade quando há vários "Mostrar senha" na tela, não depende do rótulo (que muda a cada clique) e já valida o `aria-controls`.
3. **Somente leitura em relação às senhas semeadas:** nenhum cenário envia troca de senha, criação de usuário nem "Definir Senha". Só digita e alterna a visibilidade. Isso protege a senha real dos usuários semeados, de que toda a suíte depende.
4. Pré-condições que mexem no emulador (claim `requirePasswordChange`, token de redefinição) são criadas no `beforeEach` do cenário e desfeitas no `afterEach`, no mesmo padrão de `UC-06-...spec.ts:66-95` e `UC-08-...spec.ts:556-575`.
5. Revisão humana do spec antes de virar gate de CI (regra 8 do `CLAUDE.md`).

**Validação:** `npm run test:e2e -- tests/e2e/UX-060-mostrar-ocultar-senha.spec.ts` passa. A suíte completa (`npm run test:e2e`) continua verde.

**Commit:** `test(e2e): add UX-060 notebook for password visibility toggle`

### STEP 7 — Varredura axe nos perfis

**Objetivo:** Garantir, em runtime, que o botão tem nome acessível e não traz violação nova.

**Arquivos afetados:**
- `tests/e2e/fixtures/a11y-routes.ts`
- `tests/e2e/fixtures/a11y-baseline.json`

**Ações:**
1. Adicionar as rotas `admin-profile` e `clinic-profile` (§5.2). As duas atendem à restrição do arquivo: os usuários semeados já aceitaram os termos, e a tela é somente leitura ao carregar.
2. Localmente, rodar `A11Y_UPDATE_BASELINE=1` com o modo enforce da varredura (`firebase emulators:exec ... "playwright test tests/e2e/_infra-a11y-axe-mobile.spec.ts"`, mesmo comando do `test:e2e:a11y` sem `A11Y_MODE=report`) para gravar as 4 entradas novas.
3. **Conferir o conteúdo do baseline gravado.** Só podem entrar regras **já existentes no layout** (ex.: `meta-viewport` e `color-contrast` no admin, `button-name` do UX-002 no `ClinicLayout`). Se aparecer `button-name`, `aria-*` ou `label` vindo do `PasswordInput`, **corrigir o componente**, não colocar no baseline.
4. `/change-password` e `/reset-password/[token]` **não** entram em `A11Y_ROUTES`: as duas exigem estado mutado (claim ou token) e não podem ser somente leitura. Elas ficam cobertas pelo caderno do STEP 6.

**Validação:** `npm run test:e2e:a11y` termina com exit 0 e anota as rotas novas. Em modo enforce, o cenário 3 passa para as 4 combinações novas.

**Commit:** `test(e2e): add profile screens to a11y routes and baseline`

### STEP 8 — Validação Manual (roteiro do caderno)

**Objetivo:** Confirmar em navegador real (emulador local e depois `dev-gscandelari.web.app`) o que o Playwright não cobre: gerenciadores de senha, leitor de tela, Edge e mobile. Esta seção também é a fonte que o `qa-agent` lê para gerar ou revisar o caderno (CLAUDE.md §8).

**Roteiro:**

| # | Passo | Resultado esperado |
|---|-------|--------------------|
| 1 | Abrir `/login`, digitar uma senha qualquer em "Senha". | Texto mascarado. Olho (`Eye`) visível dentro do campo, à direita. |
| 2 | Clicar no olho. | O texto aparece. O ícone vira `EyeOff`, e o `aria-label` do botão passa a ser "Ocultar senha" (DevTools → Elements ou painel Accessibility). O foco continua no campo (o cursor pisca no fim do texto). A URL não muda e nenhuma mensagem de erro aparece (o formulário não foi enviado). |
| 3 | Clicar de novo. | Texto mascarado de novo, com o mesmo valor. Ícone `Eye` e `aria-label` "Mostrar senha". O botão não tem `aria-pressed`. |
| 4 | Recarregar a página e navegar só com teclado: Tab a partir de "Email". | Ordem: Email → Senha → olho → "Entrar". No olho, Espaço alterna a visibilidade e Enter também. O anel de foco aparece no botão. |
| 5 | Com a senha visível, posicionar o foco no campo e pressionar Enter, usando credenciais válidas do ambiente. | O login acontece normalmente (o formulário foi enviado pelo campo, não pelo botão). |
| 6 | Leitor de tela (NVDA no Windows ou TalkBack no Android): focar o olho com Tab e acionar com Espaço. | Ao focar, o leitor anuncia "Mostrar senha, botão", sem "pressionado"/"não pressionado". Depois de acionar, ao revisitar o botão, anuncia "Ocultar senha, botão". Registrar no PR se o leitor anuncia o novo rótulo logo após o acionamento, sem sair e voltar ao botão (ver §4.3 e §10). |
| 7 | Gerenciador de senhas do Chrome: fazer login com a senha **visível** em um usuário ainda não salvo. | O Chrome oferece salvar a senha. **Se não oferecer**, registrar no PR (gatilho da alternativa "ocultar ao enviar", §4.2). |
| 8 | Com uma senha já salva no navegador, abrir `/login`. | O preenchimento automático continua funcionando (`autoComplete="current-password"`). |
| 9 | Microsoft Edge: digitar no campo. | Só **um** olho aparece (o do sistema). O olho nativo do Edge não aparece. |
| 10 | `/admin/profile` (system_admin): revelar só "Nova Senha". | Só esse campo mostra o texto. "Senha Atual" e "Confirmar Nova Senha" continuam mascarados. Repetir em `/clinic/profile` (clinic_admin ou clinic_user). |
| 11 | `/clinic/my-clinic` → aba "Usuários" → "Adicionar Usuário": revelar a senha, fechar o diálogo com Esc e reabrir. | Ao reabrir, o campo está vazio ou mascarado (oculto). O navegador **não** sugere a senha salva do próprio admin no campo (`autoComplete="new-password"`). |
| 12 | `/admin/tenants/{id}` → "Adicionar Usuário": revelar e ocultar. | Funciona como no passo 2. |
| 13 | `/admin/users` → "Editar" em um usuário → "Definir Senha Manualmente": revelar "Nova Senha". | Só "Nova Senha" é revelada. "Confirmar Senha" tem o próprio olho e continua mascarada (antes, um botão revelava as duas). Repetir em `/admin/consultants/{id}` → "Gerenciamento de Senha". |
| 14 | Celular (Chrome Android ou PWA): tocar no olho com o teclado aberto. | O teclado não fecha e o texto não é autocorrigido nem capitalizado ao digitar com a senha visível. |
| 15 | Com uma extensão de gerenciador de senhas instalada (se houver): abrir `/login`. | Registrar no PR se o ícone da extensão se sobrepõe ao olho. É risco conhecido (§10) e não bloqueia. |
| 16 | `/change-password` (usuário com troca obrigatória) e `/reset-password/{token}` (link gerado pelo UC-08 no ambiente de dev). | Cada campo tem o próprio olho. Em `/reset-password`, o foco inicial continua no campo "Nova Senha", não no botão. |

**Validação:** os 16 passos conferidos e descritos no PR para `gscandelari_setup`, com o resultado dos passos 6, 7, 9 e 15 registrado explicitamente.

**Commit:** N/A.

---

## 8. Estratégia de Testes

### 8.1 Jest (função pura), `src/__tests__/passwordVisibility.test.ts`

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| `getPasswordToggleState` | `src/__tests__/passwordVisibility.test.ts` | `false` retorna `{ inputType: 'password', buttonLabel: 'Mostrar senha' }`. `true` retorna `{ inputType: 'text', buttonLabel: 'Ocultar senha' }`. O retorno tem exatamente as chaves `['buttonLabel', 'inputType']` (ordenadas), sem `pressed`. `SHOW_PASSWORD_LABEL === 'Mostrar senha'` e `HIDE_PASSWORD_LABEL === 'Ocultar senha'`. |

O componente `PasswordInput` e as páginas não têm teste Jest (regra do MVP; `testEnvironment: 'node'`). A cobertura vem do caderno Playwright.

### 8.2 Caderno Playwright, `tests/e2e/UX-060-mostrar-ocultar-senha.spec.ts`

**Função auxiliar do spec** (local ao arquivo): `expectToggle(page, inputId)`. Ela verifica, no estado inicial:
- `#inputId` com `type="password"`;
- `button[aria-controls=inputId]` com `toHaveAttribute('aria-label', 'Mostrar senha')` e `toHaveAccessibleName('Mostrar senha')`;
- o botão **sem** `aria-pressed` (`not.toHaveAttribute('aria-pressed')`).

Depois clica no botão e verifica `type="text"`, `aria-label="Ocultar senha"` (e nome acessível "Ocultar senha"), ainda sem `aria-pressed`, e o valor preservado (`toHaveValue`). Clica de novo e verifica a volta a `type="password"` e `aria-label="Mostrar senha"`. Os textos esperados ficam em constantes locais do spec, não importadas de `src/`.

| # | Cenário | Preparação | Verificação |
|---|---------|-----------|-------------|
| 1 | Login: alternância básica e valor preservado (UC-04) | `goto('/login')`, `#password.fill('QualquerCoisa1')` | `expectToggle(page, 'password')`. `#password` tem `autocomplete="current-password"`, `spellcheck="false"` e `autocapitalize="none"`. |
| 2 | Login: botão não envia o formulário | Continuação do 1 | Depois de clicar no botão, `toHaveURL(/\/login/)` e nenhuma mensagem de erro de credencial visível. |
| 3 | Login: teclado | `goto('/login')`, `#password.focus()` | `keyboard.press('Tab')` deixa o foco no `button[aria-controls="password"]`. `keyboard.press('Space')` deixa `#password` com `type="text"` e o botão focado com `aria-label="Ocultar senha"`. `keyboard.press('Tab')` deixa o foco em `getByRole('button', { name: 'Entrar' })`. |
| 4 | Login com a senha visível funciona | `#email`/`#password` com `TEST_USERS.systemAdmin` + `TEST_PASSWORD`, clicar no olho, depois "Entrar" | `toHaveURL(/\/admin\/dashboard/)`. |
| 5 | Mouse não tira o foco do campo | `goto('/login')`, `#password.click()`, clicar no olho | `#password` continua com `toBeFocused()`. |
| 6 | Perfil do admin: 3 estados independentes (UC-38) | `loginAs(systemAdmin, '/admin/dashboard')`, `goto('/admin/profile')`, preencher os 3 campos **sem enviar** | Clicar só no olho de `newPassword`: `#newPassword` fica `text`, e `#currentPassword` e `#confirmPassword` ficam `password`. `expectToggle` nos 3. `#newPassword` mantém `minlength="8"`. |
| 7 | Perfil da clínica: 3 estados independentes (UC-41) | `loginAs(clinicAdminA, '/clinic/dashboard')`, `goto('/clinic/profile')` | Igual ao 6, com `minlength="6"`. |
| 8 | Troca obrigatória (UC-06) | `beforeEach`: `setCustomUserClaims` de `clinicAdminA` com `requirePasswordChange: true` (padrão `UC-06-...spec.ts:66-72`). `afterEach`: restaurar claims e documento (`UC-06-...spec.ts:74-85`). `loginAs(clinicAdminA, '/change-password')` | `expectToggle` em `currentPassword`, `newPassword` e `confirmPassword`. **Não** enviar. |
| 9 | Redefinição por token (UC-08) | `beforeEach`: `password_reset_tokens.add({ token_hash: sha256(rawToken), user_id, user_email, expires_at: agora + 30 min, created_at, created_by })` para `clinicAdminA` (formato de `UC-08-...spec.ts:565-572`). `afterEach`: apagar o documento. `goto('/reset-password/' + rawToken)` | `#newPassword` com `toBeFocused()` (o `autoFocus` continua no campo). `expectToggle` em `newPassword` e `confirmPassword`. **Não** enviar. |
| 10 | Criação de usuário pela clínica (UC-40) | `loginAs(clinicAdminA)`, `goto('/clinic/my-clinic')`, aba "Usuários", "Adicionar Usuário" | `expectToggle(page, 'password')`. `#password` com `autocomplete="new-password"`. Revelar, `keyboard.press('Escape')`, reabrir: `#password` com `type="password"` (RF-05). |
| 11 | Criação de usuário pelo admin (UC-39) | `loginAs(systemAdmin)`, `goto('/admin/tenants/' + TEST_TENANTS.clinicA.tenant_id)`, "Adicionar Usuário" | `expectToggle(page, 'newUserPassword')`. |
| 12 | Definir senha de usuário (UC-37, regressão UX-017) | `loginAs(systemAdmin)`, `goto('/admin/users')`, buscar `TEST_USERS.clinicUserA.email`, "Editar" | Dois botões `button[aria-controls="newPassword"]` e `button[aria-controls="confirmPassword"]`, cada um com `aria-label="Mostrar senha"` e sem `aria-pressed`. Revelar `newPassword` muda só o rótulo do primeiro para "Ocultar senha". Revelar só `newPassword` deixa `confirmPassword` com `type="password"`. Os dois campos com `autocomplete="new-password"`. **Não** clicar "Definir Senha". |
| 13 | Definir senha de consultor (UC-30, regressão UX-017) | `loginAs(systemAdmin)`, `goto('/admin/consultants/' + TEST_USERS.consultant.uid)` | Igual ao 12. |
| 14 | Nenhum campo de senha sem toggle (guarda de regressão) | Para cada tela dos cenários 1, 6, 7 e 10-13, depois de abrir | `page.locator('input[type="password"]')`: para cada campo, existe `button[aria-controls=<id do campo>]`. |

**Observações para o `qa-agent` e o revisor:**
- Nunca localizar o botão pelo nome (`getByRole('button', { name: 'Mostrar senha' })`) para clicar, porque o nome muda a cada clique. Localizar por `aria-controls` e só **verificar** o nome.
- Nunca usar `getByLabel('Senha')` para localizar o campo. Com o botão "Mostrar senha"/"Ocultar senha", o `getByLabel` (que faz correspondência por substring) também casa com o botão pelo `aria-label`, e a busca viola o modo estrito. Use `#id`, como os cadernos existentes.
- Um `<input type="password">` não tem papel ARIA (não é `textbox`). Por isso o estado é verificado por `toHaveAttribute('type', ...)`, não por `getByRole`.
- Os cenários 8 e 9 alteram o emulador e precisam de `afterEach` que rode mesmo em falha. Isso é especialmente importante no 8: sem a restauração, `clinicAdminA` fica preso em `/change-password` e quebra o resto da suíte.
- O caderno não usa mock nem `page.route`. Todo o estado vem do emulador real (ADR v2.0).
- A varredura axe dos perfis fica no `_infra-a11y-axe-mobile.spec.ts`, via `A11Y_ROUTES` (STEP 7), e não é duplicada aqui.

---

## 9. Checklist de Definition of Done

```
[ ] D1 = (B) aplicada: aria-label alterna "Mostrar senha"/"Ocultar senha", sem aria-pressed, com aria-controls
[ ] grep -n "aria-pressed\|pressed" src/components/ui/password-input.tsx src/lib/passwordVisibility.ts  — sem resultados
[ ] npm run lint        — zero erros ou warnings (imports Input/Eye/EyeOff sem uso removidos)
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — passwordVisibility.test.ts passando, suíte completa verde
[ ] npm run test:e2e    — UX-060 spec passando; UC-04, UC-06, UC-08, UC-09, UC-52, UC-56, UC-58, UC-59 passando SEM edição
[ ] npm run test:e2e:a11y — exit 0 com admin-profile e clinic-profile; baseline novo só com regras de layout já conhecidas
[ ] Spec Playwright revisado por humano antes de virar gate de CI (regra 8 do CLAUDE.md)
[ ] grep -rn 'type="password"' src  — sem resultados
[ ] grep -rn "showNewPassword" src    — sem resultados
[ ] Os 18 campos dos 9 arquivos usam PasswordInput, com os ids originais
[ ] Multi-tenant: N/A justificado (componente de apresentação, nenhuma operação de dados, §5.4)
[ ] firestore.rules, storage.rules, firestore.indexes.json, src/app/api/**, functions/** inalterados (git diff vazio)
[ ] Segurança: nenhum secret ou credencial no código; spellCheck/autoCorrect/autoCapitalize desligados no campo
[ ] Validação Manual (STEP 8) executada e descrita no PR, com os passos 6, 7, 9 e 15 registrados
[ ] Branch pessoal: PR da task para gscandelari_setup, validado em dev-gscandelari.web.app
[ ] PR gscandelari_setup → develop aberto com template preenchido
[ ] Pós-PR: uml-use-case-writer, uc-issues-tracker, ux-reviewer (Modo C) e ui-consistency-auditor acionados (§12.1)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Regressão no login (UC-04), tela mais usada e com cliente real em produção | Baixa | Alto | Troca restrita ao componente, com os mesmos `id`/`autoComplete`/`required`/`disabled`. Os cadernos UC-04 e UC-09 e o `loginAs` (`#password`) rodam sem edição. Os passos 1-5 e 8 do STEP 8 são feitos em `dev-gscandelari.web.app` antes do `develop`. |
| O Chrome deixa de oferecer salvar a senha quando o envio acontece com `type="text"` | Média | Médio | O passo 7 do STEP 8 mede isso. Se acontecer, abrir follow-up com a alternativa "ocultar ao enviar" (§4.2), que é simples de acrescentar ao componente. O preenchimento automático (passo 8) não é afetado. |
| Ícone de extensão de gerenciador de senha sobreposto ao olho | Média | Baixo | Padrão comum de mercado. Registrar no PR (passo 15). Não há ajuste possível sem quebrar a extensão. |
| Baseline axe novo "engole" uma violação introduzida pelo próprio `PasswordInput` | Baixa | Médio | STEP 7, ação 3: conferência manual obrigatória do JSON gravado. Regras do componente são corrigidas, não colocadas no baseline. |
| O caderno deixa `clinicAdminA` com `requirePasswordChange` ou um token válido sobrando no emulador | Baixa | Alto (quebra a suíte) | `afterEach` com restauração no padrão já usado nos cadernos UC-06 e UC-08. Rodar a suíte completa no DoD. |
| `getByLabel` em spec futuro casa com o botão "Mostrar senha" e quebra no modo estrito | Média | Baixo | Observação explícita na §8.2. Os specs existentes usam `#id` e não são afetados. |
| Usuário revela a senha numa tela compartilhada e se afasta | Baixa | Médio | A RN-01 (sempre começa oculta, sem lembrar a preferência) e o reinício ao desmontar limitam a exposição. O timeout de sessão (`useSessionTimeout`) continua valendo. |
| Com rótulo dinâmico sem `aria-pressed` (D1 = B), algum leitor de tela não anuncia o novo rótulo logo após o acionamento | Média | Baixo | O estado continua perceptível ao revisitar o botão e ao ler o campo. O passo 6 do STEP 8 mede isso. Se for confirmado, abrir follow-up para uma região `aria-live` com `sr-only` ("Sua senha está visível"/"Sua senha está oculta"), como faz o GOV.UK. |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `PasswordInput` | Componente novo em `src/components/ui/password-input.tsx`. É um `Input` com botão de mostrar/ocultar senha embutido. |
| Toggle de visibilidade | Botão que alterna a senha entre oculta e visível. Aqui (D1 = B), o estado é comunicado pelo rótulo da ação ("Mostrar senha"/"Ocultar senha"), sem `aria-pressed`. |
| `aria-controls` | Atributo que liga o botão ao `id` do campo que ele controla. Também é usado pelo caderno para localizar o botão de cada campo. |
| `::-ms-reveal` | Pseudo-elemento do Microsoft Edge que desenha um olho nativo em `input[type=password]`. É ocultado para não duplicar o do sistema. |
| `autoComplete="new-password"` | Indica ao navegador e aos gerenciadores de senha que o campo recebe uma senha **nova**. Eles deixam de preencher a senha salva do usuário logado e podem sugerir uma senha forte. |
| `A11Y_ROUTES` | Lista de telas varridas pelo axe-core em `tests/e2e/_infra-a11y-axe-mobile.spec.ts` (`tests/e2e/fixtures/a11y-routes.ts`). |
| Baseline axe ("catraca") | `tests/e2e/fixtures/a11y-baseline.json`: regras axe já conhecidas por tela. Só regra nova falha o CI. |
| Caderno de teste | Spec Playwright que roda contra o Emulator Suite, obrigatório por feature (CLAUDE.md §8). |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-UX.md` v1.0:
  - §3.1 (nome acessível, regra "Campos de senha" já alinhada à D1 = B, teclado);
  - §6 (alvos de toque);
  - §7, linha **UX-017** (P1; `admin/users/page.tsx:774-784` e `admin/consultants/[id]/page.tsx:503-513`, "Mostrar senha"/"Ocultar senha" alternando, sem `aria-pressed`);
  - **UX-060** (P2, acessibilidade/usabilidade, "campos de senha sem opção de mostrar/ocultar"; registrado em paralelo a este spec).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` v3.61, §8.6: UX-017, e UX-060 (registro em paralelo).
- `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-VISUAL-UI.md` v1.0: §4.1 (`<button>` cru do toggle de senha, desvio), §4.2 (`<input>` reimplementando `Input`, desvio) e §6 (linhas de `admin/users` e `admin/consultants/[id]`).
- UCs afetados:
  - UC-04 (login);
  - UC-06 (troca obrigatória);
  - UC-08 (redefinição por link/token);
  - UC-30 (definir senha de consultor);
  - UC-36/UC-37 (editar usuário, definir senha de usuário);
  - UC-38 (perfil do system_admin);
  - UC-39 (criar usuário pelo admin);
  - UC-40 (criar usuário pela clínica);
  - UC-41 (perfil do usuário de clínica).
  - UC-07 foi verificado e **não** é afetado (§1.1).
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` v2.0 (cadernos obrigatórios, sem mock, revisão humana).
- Código: `src/components/ui/input.tsx`, `src/components/ui/button.tsx`, `components.json`, `jest.config.js`, `tests/e2e/helpers/auth.ts`, `tests/e2e/fixtures/seed-data.ts`, `tests/e2e/fixtures/a11y-routes.ts`, `tests/e2e/fixtures/a11y-baseline.json`, `tests/e2e/helpers/a11y.ts`, `tests/e2e/UC-06-...spec.ts:66-95`, `tests/e2e/UC-08-...spec.ts:556-575`.
- Externas: WAI-ARIA Authoring Practices Guide, padrão "Button" (toggle button); GOV.UK Design System, componente "Password input"; WCAG 2.1 (2.1.1, 2.5.5 informativo, 4.1.2).
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`: Git Flow, Conventional Commits, escopos (§2.3).

### 12.1 Atualizações esperadas depois da entrega (pipeline de agentes)

- **`uml-use-case-writer`:**
  - registrar, nos UCs 04, 06, 08, 30, 37, 38, 39, 40 e 41, que os campos de senha têm o botão "mostrar senha" (fluxo principal / requisitos de interface);
  - no UC-30 e no UC-37, registrar a mudança de "um botão revela os dois campos" para "um botão por campo";
  - no UC-40, registrar o `autoComplete="new-password"` novo.
- **`uc-issues-tracker` → mapa:**
  - **UX-060** vai para "Corrigido e Documentado";
  - **UX-017** permanece "Aberto", com nota de correção parcial (a parte "mostrar/ocultar senha" de `admin/users` e `admin/consultants/[id]` está corrigida; restam os outros botões só com ícone listados no achado).
- **`ux-reviewer` (Modo C):**
  - re-verificar UX-060 e a parte de senha do UX-017;
  - atualizar `_PADRAO-UX.md` §7 e a tabela de telas por UC (linhas UC-04, UC-06/UC-07, UC-08/UC-36/UC-37, UC-28/UC-29/UC-30);
  - incluir `PasswordInput` como "exemplo a seguir" na §3.1 (toggle);
  - registrar o `PasswordInput` como exemplo na §3.1. O padrão adotado (D1 = B) é `aria-label` dinâmico "Mostrar senha"/"Ocultar senha" **sem** `aria-pressed`, com `aria-controls`. A regra geral de `aria-pressed` para botões de filtro (§3.1) continua valendo.
- **`ui-consistency-auditor`:** marcar como resolvidos os desvios do `_PADRAO-VISUAL-UI.md` §4.1 (`<button>` do toggle de senha) e §4.2 (`<input>` reimplementando `Input`) em `admin/users` e `admin/consultants/[id]`, e registrar `PasswordInput` como primitivo novo.
- **`qa-agent`:** usar o STEP 8 desta spec como entrada para gerar ou revisar o caderno `UX-060-mostrar-ocultar-senha.spec.ts`.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 21/10/2026 | Doc Writer (Claude) | Versão inicial. Status "Aguardando decisão" por causa da D1 (padrão de anúncio do botão: rótulo fixo + `aria-pressed` × rótulo dinâmico sem `aria-pressed` × rótulo dinâmico + `aria-pressed`). |
| 1.1 | 21/10/2026 | Doc Writer (Claude) | D1 resolvida pelo usuário em 21/10/2026 (resposta explícita, via coordenador): **opção (B), padrão GOV.UK**. O `aria-label` alterna entre "Mostrar senha" e "Ocultar senha", sem `aria-pressed`, e o `aria-controls` é mantido. Atualizados: o helper `src/lib/passwordVisibility.ts` (constantes `SHOW_PASSWORD_LABEL`/`HIDE_PASSWORD_LABEL`, sem `pressed`), o componente (§6.2), RF-03, §4.1(c), §4.3, §6.3, o teste Jest (§8.1), o STEP 8 (passos 2, 3 e 6), o caderno Playwright (verifica a troca do `aria-label` e a ausência de `aria-pressed`), o DoD, os riscos (anúncio sem `aria-live`), o glossário e a §12.1. Status passa de "Aguardando decisão" para "Planejamento". |
| 1.2 | 26/10/2026 | Claude (implementação) | Task concluída e movida para `TASK_COMPLETED`. Commits: `17325de` (`passwordVisibility.ts` + 5 testes Jest; `PasswordInput`), `5dd59cb` (login, change-password, reset-password), `f6890cc` (perfis admin/clínica, `minLength` preservados), `e1f57d5` (UsersTab com `autoComplete="new-password"`; tenants/[id]), `a4b4e37` (admin/users e admin/consultants/[id]: dois `PasswordInput` com `new-password`; removidos `showNewPassword`, o reset na abertura do diálogo de edição e os ícones `Eye`/`EyeOff`), `cfe696b` (`admin-profile`/`clinic-profile` em `A11Y_ROUTES` com `loginRedirect`; baseline regravado), `6306304` (caderno `UX-060-mostrar-ocultar-senha.spec.ts`, 13 testes cobrindo os 14 cenários — o 14 roda como `test.step`). Divergências do spec tratadas na execução: linhas de `/admin/users` deslocadas pelo lote "erro exibido como estado vazio" (toggle igual); `loginRedirect` obrigatório nas rotas do axe; mensagens de commit dos STEPs 2 e 3 encurtadas para ≤72 caracteres (commitlint). Validação: `grep -rn 'type="password"' src` e `grep -rn showNewPassword src` vazios; Jest 44 suítes/799 testes; type-check e lint sem erros; UC-04/UC-06/UC-08 + UX-060 = 46/46 sem editar os cadernos antigos; axe: baseline do `login` inalterado, os 3 botões de cada perfil passam em `button-name`, e as entradas novas (`admin-profile`: `color-contrast`/`meta-viewport`; `clinic-profile`: `button-name`/`meta-viewport`) vêm de nós do layout (sidebar, sino, menu — UX-002/003/004/006/007), conferidos nó a nó. Suíte E2E local completa: 205 passed, 3 failed — UC-09 Variante B (falha local pré-existente) e 2 cenários do UC-59, que passaram 7/7 rodando o UC-59 isolado (instabilidade da suíte longa). STEP 8 (validação manual de 16 passos em `dev-gscandelari.web.app`) fica para depois do PR. Pendências pós-entrega (§12.1): `uml-use-case-writer`, `uc-issues-tracker` (UX-060 corrigido, UX-017 parcial, §8.2 divergência 4), `ux-reviewer` Modo C e `ui-consistency-auditor`. |
| 1.3 | 27/10/2026 | Claude (implementação) | SonarCloud reprovou o PR #425 por duplicação no código novo (9,5%, limite 3%): as linhas trocadas para `PasswordInput` caíam dentro de blocos que já eram duplicados entre telas. Decisão do usuário: extrair os 2 componentes no mesmo PR. `b0f01ba` cria `src/components/admin/ManualPasswordSection.tsx` (seção "Definir Senha Manualmente" de `/admin/users` e `/admin/consultants/[id]`; `/admin/users` mantém o bloqueio por `updating` e o botão em largura total via props) e `b3abb38` cria `src/components/auth/ChangePasswordCard.tsx` (card "Alterar Senha" de `/admin/profile` e `/clinic/profile`, com `minLength` 8/6, descrição e dica por props). Comportamento, ids e textos inalterados. A lógica de troca de senha repetida entre os dois perfis (código antigo, fora da conta do gate) não foi mexida. Revalidado: UX-060 13/13, varredura axe em modo enforce (perfis sem regra nova), Jest 799/799, type-check e lint sem erros. |
