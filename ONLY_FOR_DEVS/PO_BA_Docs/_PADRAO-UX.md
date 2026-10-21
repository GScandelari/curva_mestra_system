# Padrão de UX e Acessibilidade — Curva Mestra

**Projeto:** Curva Mestra
**Data de Criação:** 19/10/2026
**Última Atualização:** 21/10/2026
**Autor:** ux-reviewer (via Claude)
**Base:** WCAG 2.1 AA + heurísticas de usabilidade; primitivos shadcn/ui (Radix); axe-core 4.13.0
**Escopo complementar:** consistência visual em `_PADRAO-VISUAL-UI.md` (ui-consistency-auditor)
**Versão:** 1.1

> **Como ler este documento.** As Seções 1–6 são o padrão (o que toda tela deve fazer, com exemplos do próprio código). A Seção 7 é o resultado da última auditoria completa (substituída a cada auditoria completa). A Seção 8 lista o que precisa ser feito por outros agentes. A Seção 9 guarda o histórico.
>
> **Prefixos de evidência:** `Estática:` = comprovado por leitura de código; `axe <ruleId> (<projeto>|<rota>)` = comprovado em runtime pelo axe-core no emulador. Todo achado tem `arquivo:linha` ou evidência axe.

---

## 1. Fonte de verdade e fronteira de escopo

- **Fonte de verdade do comportamento:** o código de `src/app/**/page.tsx` e dos componentes que cada tela importa. Os UCs (`ONLY_FOR_DEVS/PO_BA_Docs/UC-*.md`) descrevem o fluxo esperado. Quando a tela e o UC divergem, a divergência é registrada e sinalizada ao `uml-use-case-writer`, sem decidir qual dos dois está certo.
- **Este documento cobre:**
  - estados de tela (carregando, vazio, erro, sucesso, processando, sem permissão);
  - acessibilidade WCAG 2.1 AA;
  - heurísticas de usabilidade;
  - textos em pt-BR;
  - comportamento em desktop e mobile (PWA/Capacitor).
- **Fora do escopo (ui-consistency-auditor):** raio, cor de marca, tipografia, espaçamento e variante de componente como consistência visual. Aqui, cor e tamanho só entram como acessibilidade (contraste e legibilidade). Quando a correção de contraste exige mudar um token de tema (`src/app/globals.css`), a mudança é coordenada com o `ui-consistency-auditor`.
- **Primitivos:** os componentes de `src/components/ui/*` (shadcn/Radix) já resolvem foco preso, teclado e `aria-*`. O achado é sempre sobre o **uso** do primitivo. Os textos que o projeto escreveu dentro desses arquivos (ex.: `"Close"`) são tratados como uso.
- **Controle de acesso:** `src/components/auth/ProtectedRoute.tsx` e o `layout.tsx` de cada grupo de rotas (`allowedRoles`), além do `SuspensionInterceptor` e dos redirecionamentos por papel dentro das telas.

## 2. Estados obrigatórios de tela

| Estado | Padrão recomendado | Exemplo a seguir no código | Desvio típico |
|--------|--------------------|----------------------------|---------------|
| Carregando | `Skeleton` com a forma do conteúdo final, um por bloco, para o layout não "pular". Spinner só com texto ("Carregando clínicas...") ou `role="status"` | `src/app/(clinic)/clinic/dashboard/page.tsx:269-278` (`BlockSkeleton`) e `:503-511`; `src/components/inventory/InventoryView.tsx:467-472` | Spinner só visual, sem texto nem `role="status"` (`src/app/(consultant)/consultant/clinics/page.tsx:106-108`, UX-015) |
| Vazio | Texto que explica a ausência e indica a próxima ação; diferencia "não há dados" de "nenhum resultado para o filtro" | `src/app/(consultant)/consultant/clinics/page.tsx:114-131` (vazio com CTA "Buscar Clínicas" × "Nenhuma clínica encontrada com os filtros aplicados"); `InventoryView.tsx:478-485` | Mensagem de vazio que considera só a busca e ignora o filtro de status (`src/app/(clinic)/clinic/requests/page.tsx:326-328`, UX-039) |
| Erro | Estado **distinto** do vazio, no próprio bloco, com mensagem acionável e botão "Tentar novamente" | `src/components/inventory/ProjectionsView.tsx:105-111` ("Não foi possível carregar as projeções." + "Tentar novamente"); hook `src/hooks/useAsyncState.ts` (usado em `consultant/profile`, `clinic/profile`, `useLinkedConsultant`) | `catch` que só faz `console.error` e deixa a tela no estado vazio: o usuário conclui que não há dados quando o sistema falhou (UX-025, UX-038, UX-047, UX-050, UX-051, UX-053) |
| Sucesso | Toast (`useToast`) ou redirecionamento com a lista atualizada | `src/app/(consultant)/consultant/transfer-requests/page.tsx:70-71` (toast + `loadRequests()`) | `alert('Usuário atualizado com sucesso!')` (`src/app/(admin)/admin/users/page.tsx:368`, UX-048) |
| Processando | Botão de envio `disabled` durante a operação, com rótulo de progresso | `src/app/(auth)/login/page.tsx:291-293` (`disabled={loading}`, "Entrando..."); `src/app/(clinic)/clinic/inventory/[id]/page.tsx:627-635` (`Loader2` + "Desativando...") | — |
| Sem permissão | `ProtectedRoute allowedRoles` no `layout.tsx` do grupo; quando a tela redireciona, o usuário deve entender o motivo | `src/app/(auth)/login/page.tsx:198-241` (card "Sistema Indisponível" explica a clínica inativa) | Redirecionamento silencioso, sem mensagem (`ProtectedRoute.tsx:75-80`, UX-059); tela de debug como destino padrão (`src/app/dashboard/page.tsx`, UX-058) |

**Regras:**

1. Um erro de carregamento **nunca** pode aparecer como "nenhum item" ou como contagem `0`.
2. Em uma tela com vários blocos, cada bloco tem o próprio estado de erro. Um único `error: string` compartilhado faz uma mensagem sobrescrever a outra (UX-026).
3. Se `fetch` é usado, `response.ok === false` também é erro, não só o `catch`. Desvio: `src/app/(consultant)/consultant/clinics/page.tsx:46-51`.
4. Quando o erro aparece num banner no topo, a lista abaixo não pode mostrar ao mesmo tempo "Nenhuma clínica cadastrada" (UX-049).

## 3. Acessibilidade (WCAG 2.1 AA aplicada ao stack)

### 3.1 Regras

- **Nome acessível (4.1.2).**
  - Todo `Button` cujo conteúdo é só um ícone `lucide-react` precisa de `aria-label` ou `<span className="sr-only">`.
  - Exemplo a seguir: `src/components/clinic/FixedCostsTab.tsx:265-266` (`size="icon"` + `aria-label="Remover custo"`).
  - `title` só é aceitável como último recurso (`src/app/(admin)/admin/tenants/[id]/page.tsx:561-564`).
  - Desvios: UX-002, UX-004, UX-017.
- **Toggle (4.1.2).**
  - Botão que abre ou fecha um painel expõe `aria-expanded` e `aria-controls`. O `DropdownMenuTrigger` do Radix já faz isso.
  - Botão de filtro que fica "ligado" expõe `aria-pressed`. Exemplos a seguir: `src/app/(auth)/register/page.tsx:286-293` (`role="group"` + `aria-pressed`) e `src/components/pricing/FormaPagamentoSelector.tsx:25`.
  - Desvios: UX-003, UX-020.
- **Campos de senha (3.3.2, boa prática de usabilidade).**
  - Todo campo de senha oferece um botão de mostrar/ocultar (ícone `Eye`/`EyeOff`) com `type="button"`, `aria-label` dinâmico ("Mostrar senha"/"Ocultar senha"), **sem** `aria-pressed` (rótulo que alterna junto com `aria-pressed` fica ambíguo no leitor de tela; decisão D1 de `FEAT-toggle-visibilidade-senha.md`). O campo continua com `<Label htmlFor>` e o `autoComplete` correto (`current-password` / `new-password`).
  - Padrão recomendado: um único componente `PasswordInput` (`src/components/ui/password-input.tsx`, a criar) sobre o primitivo `Input`, em vez de repetir o toggle em cada tela.
  - Hoje há 14 campos sem toggle em 7 arquivos e 2 toggles feitos à mão, sem nome acessível (UX-060, UX-017).
- **Rótulos (1.3.1/3.3.2).**
  - `<Label htmlFor>` ligado ao `id` do campo. Exemplo: `login/page.tsx:263-273`.
  - `Select` do Radix: o `id` vai no `SelectTrigger`. Se não houver rótulo visível, o `SelectTrigger` recebe `aria-label`.
  - Desvio: UX-019.
- **Teclado (2.1.1).**
  - Todo elemento clicável é `<button>` ou `<Link>`, nunca `div`, `Card` ou `TableRow` com `onClick`.
  - Exemplos a seguir: botões de alerta em `clinic/dashboard/page.tsx:399-440` (`<button>` nativo); `src/components/consultant/ClinicCard.tsx:72` (`<Link>`).
  - Desvios: UX-005, UX-028, UX-035, UX-054.
- **Mensagens de status e erro (4.1.3/3.3.1).**
  - Erro de formulário ou de carregamento vai num `Alert` do projeto, que já tem `role="alert"` (`src/components/ui/alert.tsx:30`). Exemplo a seguir: `register/page.tsx:161-165`.
  - Uma `div` com `text-destructive` não é anunciada pelo leitor de tela (UX-016).
- **Contraste (1.4.3/1.4.11).**
  - Texto normal precisa de 4.5:1; texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) precisa de 3:1; bordas de componentes precisam de 3:1.
  - Fora da faixa no tema atual:
    - `--destructive` (#ef4444): 3.76:1 sobre branco (UX-006);
    - `--muted-foreground` (#64748b) sobre o fundo `#f5f3ef` dos portais Admin e Consultor: 4.29:1 (UX-007);
    - `--input`/`--border` (#e2e8f0): ≈1.2:1 (UX-010);
    - `text-yellow-600`: 2.93:1 (UX-008);
    - `bg-sky-600` + branco: ≈4.1:1; `sky-500` + branco: ≈2.8:1 (UX-009).
  - Para texto colorido sobre branco, prefira tons `-700`/`-800`.
- **Zoom (1.4.4).** O viewport não pode bloquear o zoom (UX-001).
- **Títulos (1.3.1/2.4.6).**
  - Cada tela tem um `<h1>` que descreve o conteúdo, e os níveis não pulam.
  - Exemplo a seguir: `consultant/clinics/page.tsx:74` (`<h1>` "Minhas Clínicas").
  - Desvio: UX-022.
- **Diálogos (2.4.3).**
  - Sempre `Dialog`/`AlertDialog`/`ConfirmDialog` do projeto, com `DialogTitle`.
  - Conforme: os 20 arquivos que usam `DialogContent`/`AlertDialogContent` têm título. Nenhum modal foi feito à mão.
- **Movimento (2.3.3, boa prática).** Animações contínuas (`animate-spin`) devem ter a variante `motion-reduce:`. Hoje nenhuma tem (UX-015).

### 3.2 O que o axe cobre e o que não cobre

- **O axe confirma ou descarta:** `button-name`, `link-name`, `label`, `image-alt`, `color-contrast`, `meta-viewport`, `nested-interactive`, `aria-*` e `list`.
- **O axe não cobre:**
  - operação por teclado de `div`/`TableRow` clicável;
  - ordem de foco e foco preso;
  - contraste de componentes (1.4.11);
  - movimento reduzido;
  - erros ligados ao campo (`aria-invalid`/`aria-describedby`);
  - ausência de controle de mostrar/ocultar senha;
  - carga cognitiva e qualidade do texto.
- **Limite de dados:** o axe só avalia o que **está renderizado** na varredura. No seed atual, `clinicAdminA` não tem estoque nem procedimentos. Por isso, linhas de tabela, badges coloridos e contagens maiores que zero não foram exercitados em runtime.
- **Limite de cobertura:** `A11Y_ROUTES` cobre 4 das 72 telas (`login`, `admin-dashboard`, `clinic-dashboard`, `clinic-inventory`). O portal do Consultor não é varrido (o seed leva o consultor para `/accept-terms`).

## 4. Heurísticas de usabilidade

- **Feedback e status do sistema:** toda ação termina com toast, mudança visível na lista ou redirecionamento. Exemplo a seguir: `transfer-requests/page.tsx:70-71`.
- **Prevenção de erros:**
  - Ação destrutiva ou irreversível pede confirmação com o `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`), nunca com `confirm()`/`alert()` do navegador. Exemplo a seguir: `transfer-requests/page.tsx:322-336`.
  - Um formulário de configuração não pode ser salvo quando os dados reais não foram carregados (desvio: UX-046).
  - Quem digita uma senha (principalmente no celular) pode conferir o que digitou antes de enviar (desvio: UX-060).
- **Recuperação de erros:** a mensagem diz o que fazer, e o bloco oferece "Tentar novamente" (`ProjectionsView.tsx:105-111`).
- **Consistência entre o resumo e o destino:** um número clicável leva a uma lista filtrada pelo **mesmo critério**, logo com a mesma contagem (desvio: UX-031).
- **Rótulo fiel ao conteúdo:** o título e a descrição de um bloco descrevem exatamente o que a consulta retorna (desvio: UX-030).
- **Navegação:** um link para um item leva ao item (`/clinic/requests/{id}`), não à lista inteira (desvio: UX-029).
- **Affordances:** só tem efeito de `hover` ou `cursor-pointer` o que reage ao clique; o que diz "clique para selecionar" precisa ser clicável (desvios: UX-034, UX-043).
- **Ação primária visível só para quem pode executá-la:** um CTA que o papel não pode usar não aparece (desvio: UX-039, "Novo Procedimento" para `clinic_user`).
- **Não inventar:** as recomendações usam só componentes, tokens e dados que já existem.

## 5. Textos e mensagens em pt-BR

- **Mensagens acionáveis.** Prefira "Não foi possível carregar X. Tente novamente." a "Erro" + "Erro ao carregar dados do dashboard" (`clinic/dashboard/page.tsx:294-295`).
- **Nada de mensagem técnica crua.**
  - O `error.message` do SDK do Firebase (em inglês, ex.: "Missing or insufficient permissions.") nunca vai para toast, `alert` ou tela. Use uma mensagem fixa em pt-BR e deixe o detalhe no `console.error` (UX-023).
  - Mensagens vindas das rotas `/api/*` (`data.error`, já em pt-BR) podem ser exibidas.
  - Exemplo a seguir: `login/page.tsx:167-186` traduz os códigos do Firebase (o fallback ainda devolve o texto cru, UX-057).
- **Sem jargão para o usuário final:** "Custom Claims", "Tenant ID", "UID" e "Firestore" não aparecem em telas de usuário (UX-058).
- **Acentuação completa** em todo texto visível (desvio: `transfer-requests/page.tsx:328`, UX-055).
- **Mapa de rótulos completo:** todo status de domínio exibido passa por um mapa que cobre todos os valores de `src/types/index.ts` (desvio: `efetuada`, UX-032).
- **Frases montadas com dado opcional** não podem ficar quebradas ("Olá, !", "Bem-vindo ao Portal do Consultor, " — UX-033, UX-056).
- **Texto do leitor de tela também em pt-BR:** `ToastViewport` ("Notifications (F8)") e o `sr-only` "Close" do `Dialog` (UX-014).

## 6. Desktop e mobile (PWA/Capacitor)

- **Viewport de referência:** o `mobile-chromium` (Pixel 7, 412 px) fica abaixo dos breakpoints `sm` (640 px) e `md` (768 px). Tudo o que depende de `md:` precisa de uma alternativa abaixo de 768 px.
- **Navegação mobile.**
  - O portal Clínica tem menu mobile (`ClinicLayout.tsx:88-119`), que precisa de nome e `aria-expanded` (UX-003).
  - Os portais Admin e Consultor **não têm comportamento mobile**: a sidebar fixa de 256 px deixa cerca de 156 px para o conteúdo em 412 px (UX-011).
- **Tabelas:** o primitivo `Table` (`src/components/ui/table.tsx:7`) já envolve a `<table>` em `overflow-auto`, então tabelas não geram rolagem horizontal da página. Conforme em todas as telas.
- **Cabeçalhos de tela com vários botões:** usar `flex-wrap` (exemplo a seguir: `clinic/requests/page.tsx:188`). O desvio `InventoryView.tsx:321` causou rolagem horizontal medida em runtime: `scrollWidth` 506 px para 412 px de largura (UX-037).
- **Grades:** `md:grid-cols-*` vira uma coluna abaixo de 768 px (padrão correto; sem overflow medido em `clinic-dashboard`, `admin-dashboard` e `login`).
- **Zoom liberado** é requisito em mobile (UX-001).
- **Alvos de toque:** pelo menos 24×24 px. Exemplos abaixo disso: o botão de copiar `h-6 w-6` (`admin/consultants/page.tsx:279-282`, `tenants/[id]/page.tsx:561-563`) e a lixeira `h-6 w-6` do sino (`NotificationBell.tsx:229-236`). Eles ficam no limite (24 px) e não têm nome (UX-005, UX-017). O botão de mostrar/ocultar senha do `PasswordInput` (UX-060) também precisa de ao menos 24×24 px de área clicável.
- **Senha no teclado virtual:** no celular, erro de digitação em senha é frequente e o usuário não vê o que digitou. O toggle de visibilidade é o padrão esperado em apps móveis (UX-060).

---

## 7. Achados — Última auditoria

**Auditoria:** 19/10/2026, Modo A (padrão + auditoria completa) + Modo E.

**Runtime:**
- comando: `npm run test:e2e:a11y` (emuladores Auth/Firestore/Storage no projeto `demo-curva-mestra-e2e`);
- resultado: 16 passed, 4 skipped, exit 0, em 1,4 min;
- engine: axe-core 4.13.0, projetos `chromium` e `mobile-chromium`;
- rotas: `login` (público), `admin-dashboard` (`systemAdmin`), `clinic-dashboard` e `clinic-inventory` (`clinicAdminA`).

**Atualização escopada de 21/10/2026 (v1.1, Modo B, só análise estática, sem runtime):** registro de UX-060 (campos de senha sem mostrar/ocultar), a pedido do usuário. Varredura por `Grep` de `type="password"` e `EyeOff` em `src/`; leitura dos trechos `admin/users/page.tsx:760-799`, `admin/consultants/[id]/page.tsx:492-526`, `admin/tenants/[id]/page.tsx:790-814` e `UsersTab.tsx:265-289`. As demais linhas desta seção continuam valendo a auditoria de 19/10/2026.

> **Nota sobre o smoke test:** o documento produzido no smoke test (Modo B só em `/clinic/dashboard`) nunca foi gravado no repositório. Esta é, portanto, a versão 1.0 real. Os 15 achados daquele rascunho foram **reconfirmados no código atual** (as mesmas linhas continuam válidas) e renumerados nesta auditoria. Equivalência: rascunho UX-001→UX-025, 002→026, 003→027, 004→028, 005→002, 006→003, 007→004, 008→001, 009→030, 010→031, 011→032, 012→033, 013→034, 014→014, 015→008.

### 7.1 Resumo

| Item | Valor |
|------|-------|
| Telas existentes (`src/app/**/page.tsx`) | 72 (23 Admin, 7 Auth, 26 Clínica, 11 Consultor, 5 fora de grupo) |
| Telas avaliadas na análise estática | 72 (todas, ao menos por varredura `Grep`) |
| Leitura completa (`Read`) | 16: `clinic/dashboard`, `clinic/inventory` (+ `InventoryView.tsx`), `clinic/requests`, `consultant/dashboard`, `consultant/clinics`, `consultant/clinics/[tenantId]`, `consultant/transfer-requests`, `consultant/reports`, `admin/dashboard`, `admin/tenants`, `login` (l. 100-328), `dashboard` (raiz), `admin/users` (l. 120-800), `admin/settings` (l. 40-160), `clinic/protocolos` (l. 40-210), `consultant/access-requests` (l. 75-175) |
| Leitura parcial (trecho do achado) | `clinic/requests/new`, `clinic/access-requests`, `clinic/add-products`, `clinic/inventory/[id]`, `consultant/clinics/[tenantId]/pricing`, `admin/consultants`, `admin/consultants/[id]` (l. 492-526, em 21/10), `admin/tenants/[id]` (l. 790-814, em 21/10), `admin/products`, `admin/legal-documents`, `debug` |
| Componentes compartilhados lidos | `ClinicLayout.tsx`, `AdminLayout.tsx`, `ConsultantLayout.tsx`, `ProtectedRoute.tsx`, `NotificationBell.tsx`, `FileUpload.tsx`, `ProjectionsView.tsx` (trecho), `confirm-dialog.tsx`, `badge.tsx`, `table.tsx`, `dialog.tsx` (trecho), `error.tsx`, `src/app/layout.tsx`, `(auth)/layout.tsx`, `globals.css` (tokens), `UsersTab.tsx` (trecho, em 21/10) |
| Só varredura por `Grep` | as demais 47 telas: `catch`/`console.error`, estados vazios, `confirm(`/`alert(`, `size="icon"`, `cursor-pointer`/`onClick`, `error.message`, `aria-*`, `Dialog*Title`, `animate-*`, `outline-none`; em 21/10, `type="password"` e `EyeOff` |
| Rotas avaliadas em runtime | `chromium`: `login`, `admin-dashboard`, `clinic-dashboard`, `clinic-inventory`; `mobile-chromium`: as mesmas 4 (+ medição de reflow) |
| Total de achados | 60 (UX-001 a UX-060) |
| P0 abertos | 8 |
| P1 abertos | 32 (2 em `Suspeita (runtime)`: UX-009, UX-012) |
| P2 abertos | 20 |

**Por grupo de rota:**

| Grupo | P0 | P1 | P2 |
|-------|----|----|----|
| Transversal (layouts, tokens, padrões que se repetem em vários portais) | 0 | 16 | 9 |
| Clínica | 3 | 10 | 7 |
| Admin | 2 | 3 | 0 |
| Consultor | 3 | 2 | 2 |
| Auth / Outros | 0 | 1 | 2 |

**Por categoria:**

| Categoria | Qtde |
|-----------|------|
| Acessibilidade | 25 |
| Estado de erro | 16 |
| Texto pt-BR | 8 |
| Mobile/PWA | 2 |
| Affordance | 2 |
| Prevenção de erro | 2 |
| Estado vazio | 1 |
| Feedback/status | 1 |
| Consistência de comportamento | 1 |
| Navegação/IA | 1 |
| Sem permissão | 1 |

### 7.2 Por tela

#### Transversal — layouts, tokens de tema e padrões repetidos

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-001 | P1 | Acessibilidade | Todas (layout raiz) | `src/app/layout.tsx:24-29` | — | axe `meta-viewport` nos 8 pares projeto\|rota (`chromium` e `mobile-chromium` × `login`, `admin-dashboard`, `clinic-dashboard`, `clinic-inventory`), target `meta[name="viewport"]`, `content="width=device-width, initial-scale=1, maximum-scale=1"`. O `maximumScale: 1` bloqueia o zoom (WCAG 1.4.4) | Remover `maximumScale: 1` do `viewport` (manter `width` e `initialScale`). Uma linha corrige o `meta-viewport` das 8 entradas do baseline | Aberto |
| UX-002 | P1 | Acessibilidade | Clínica › layout do portal | `src/components/clinic/ClinicLayout.tsx:83-85` | — | axe `button-name` em `chromium`\|`clinic-dashboard`, `chromium`\|`clinic-inventory`, `mobile-chromium`\|`clinic-dashboard` e `mobile-chromium`\|`clinic-inventory`, target `.gap-4.flex.items-center > .h-9.border-input.bg-background`. O botão "Sair" tem só o ícone `LogOut` | `aria-label="Sair"` (ou `<span className="sr-only">Sair</span>`) | Aberto |
| UX-003 | P1 | Acessibilidade | Clínica › layout do portal (mobile) | `ClinicLayout.tsx:88-95`, `:100-119` | — | axe `button-name` em `mobile-chromium`\|`clinic-dashboard` e `mobile-chromium`\|`clinic-inventory`, target `.md\:hidden`. Estática: o botão de menu mobile não tem nome, `aria-expanded` nem `aria-controls`. Em 412 px é o único acesso à navegação | `aria-label` dinâmico ("Abrir menu"/"Fechar menu"), `aria-expanded={mobileMenuOpen}` e `aria-controls` apontando para o `id` do `<nav>` mobile | Aberto |
| UX-004 | P1 | Acessibilidade | Clínica › layout do portal (sino) | `src/components/notifications/NotificationBell.tsx:146-156` | UC-44 | axe `button-name` nos 4 pares de rota da clínica, target `#radix-_r_0_`. O `Button size="icon"` só com o ícone `Bell` é o trigger do `DropdownMenu` | `aria-label` com a contagem: "Notificações" / "Notificações, N não lidas" | Aberto |
| UX-005 | P1 | Acessibilidade | Clínica › sino de notificações | `NotificationBell.tsx:191-198`, `:229-236` | UC-44 | Estática: cada notificação é uma `<div onClick>` dentro do `DropdownMenuContent`, fora de `DropdownMenuItem`. O foco por teclado do menu (setas) não chega a ela, e Tab/Enter não abrem a notificação. A lixeira de cada item (`h-6 w-6 p-0`) é um botão só com ícone, sem nome. Critério 2.1.1 sem regra axe; o sino fechado não expõe os itens na varredura | Renderizar cada notificação como `DropdownMenuItem` (`onSelect` = abrir) ou `<button>`; `aria-label="Excluir notificação"` na lixeira | Aberto |
| UX-006 | P1 | Acessibilidade | Todas (token `--destructive`) | `src/app/globals.css:21`; uso: `src/components/admin/AdminLayout.tsx:167-174`, `src/components/ui/badge.tsx:14-15`, mensagens `text-destructive` (ex.: `login/page.tsx:289`) | — | axe `color-contrast` em `chromium`\|`admin-dashboard` e `mobile-chromium`\|`admin-dashboard`, target `.text-destructive` (botão "Sair" da sidebar): #ef4444 sobre #ffffff = **3.76:1** (texto 14 px, mínimo 4.5:1). Pela mesma razão, o `Badge variant="destructive"` (branco sobre #ef4444, `text-xs`) e as mensagens de erro em `text-destructive` ficam abaixo de 4.5:1 | Escurecer `--destructive` no tema claro até ≥ 4.5:1 sobre branco (ex.: equivalente a `red-600`/`red-700`), em conjunto com o `ui-consistency-auditor` (é token de tema) | Aberto |
| UX-007 | P1 | Acessibilidade | Admin e Consultor (todas as telas) | `AdminLayout.tsx:108`, `:206`; `src/components/consultant/ConsultantLayout.tsx:62`, `:172` | — | axe `color-contrast` em `chromium`\|`admin-dashboard` e `mobile-chromium`\|`admin-dashboard`, target `.space-y-8 > div:nth-child(1) > p` ("Visão geral da plataforma"): `text-muted-foreground` (#64748b) sobre `bg-[#f5f3ef]` = **4.29:1**. Afeta toda descrição em `text-muted-foreground` posta direto sobre o fundo dos dois portais (fora de `Card`). Já registrado (aspecto visual, fundo em hex cru): `_MAPA-DE-BUGS-E-MELHORIAS.md` §8.2, divergência 1. O contraste é novo | Usar o fundo de tema (`bg-background`) como no portal Clínica, ou um tom de texto secundário com ≥ 4.5:1 sobre #f5f3ef. Resolver junto com a §8.2 divergência 1 | Aberto |
| UX-008 | P1 | Acessibilidade | Clínica › Estoque e Dashboard | `src/components/inventory/InventoryView.tsx:374`, `:520`, `:523`; `src/app/(clinic)/clinic/dashboard/page.tsx:250`, `:256`, `:422`, `:436`, `:652`; `badge.tsx:16` | UC-50 | Confirmado em `chromium`\|`clinic-inventory` e `mobile-chromium`\|`clinic-inventory`: o axe pôs o nó em `incomplete` (texto curto, `shortTextContent`), mas mediu `text-yellow-600` (#ca8a04) sobre #ffffff = **2.93:1** em 24 px negrito, abaixo do mínimo de 3:1 para texto grande, target `.text-yellow-600` ("Próximos ao Vencimento"). Estática: `text-orange-600` (3.55:1) e `text-green-600` (3.29:1) em texto pequeno (células da tabela de estoque, `CrescimentoBadge` `text-xs` do Dashboard) e o `Badge variant="warning"` (branco sobre `yellow-500`, ≈2.1:1) ficam abaixo de 4.5:1. Não renderizados no seed (sem estoque) | Para texto colorido sobre branco, tons `-700`/`-800`; `Badge` warning com texto escuro (ex.: `text-yellow-950` sobre `yellow-400`) ou fundo mais escuro, até ≥ 4.5:1. Cor tratada como acessibilidade | Aberto |
| UX-009 | P1 | Acessibilidade | Consultor (todas as telas) | `ConsultantLayout.tsx:111` (nav ativa `bg-sky-600 text-white`); `src/app/(consultant)/consultant/clinics/page.tsx:82`, `:122`; `consultant/dashboard/page.tsx:142-159` | — | Estática (cálculo): branco sobre `sky-600` (#0284c7) ≈ **4.10:1** em texto de 14 px (botões e item ativo da navegação); o cartão do código do consultor usa gradiente `sky-500`→`sky-600` com texto branco e `text-sky-100` (branco sobre `sky-500` ≈ **2.77:1**, abaixo até de 3:1). O portal do Consultor não está em `A11Y_ROUTES` | Botões e nav ativa em `sky-700`; cartão do código com `sky-700`/`sky-800` e texto branco (sem `text-sky-100`) | Suspeita (runtime) |
| UX-010 | P1 | Acessibilidade | Todas (token `--input`/`--border`) | `globals.css:23-24` | — | Estática (cálculo): a borda dos campos (#e2e8f0) tem ≈ **1.2:1** sobre branco, abaixo do mínimo de 3:1 para limites de componente (WCAG 1.4.11). Num campo vazio sem rótulo, a borda é a única pista visual de que ele existe. Critério sem regra axe | Escurecer `--input` (borda de campos) até ≥ 3:1, em conjunto com o `ui-consistency-auditor` | Aberto |
| UX-011 | P1 | Mobile/PWA | Admin e Consultor (todas as telas) | `AdminLayout.tsx:110-115`; `ConsultantLayout.tsx:64-69` | — | Estática: `aside` fixa em `w-64` (256 px), sem variante responsiva nem menu mobile. Em 412 px sobram cerca de 156 px para o conteúdo. Runtime: `mobile-chromium`\|`admin-dashboard` não teve rolagem horizontal (`scrollWidth` 412 = `deviceWidth` 412), porque o conteúdo se espreme. O axe deixou o `<h2>` "Dashboard administrativo" em `incomplete` (`elmPartiallyObscured`): o título fica parcialmente coberto | Abaixo de `md`, esconder a sidebar e oferecer botão de menu (mesmo padrão do `ClinicLayout`, já com UX-003 corrigido) ou começar recolhida (`w-16`) | Aberto |
| UX-012 | P1 | Acessibilidade | Consultor › sidebar recolhida | `ConsultantLayout.tsx:105-119`, `:139-146`, `:154-163` | — | Estática: com a sidebar recolhida (estado salvo em `localStorage`), cada `<Link>` da navegação e os botões "Meu Perfil"/"Sair" ficam só com o ícone. O nome existe só no `TooltipContent` (ao passar o mouse), sem `aria-label`. No Admin, o mesmo caso usa `title` (`AdminLayout.tsx:148`, `:179`, `:187`). Candidato a `link-name`/`button-name` em runtime; o consultor não está em `A11Y_ROUTES` | `aria-label={item.name}` no `<Link>` e nos botões quando `collapsed` | Suspeita (runtime) |
| UX-013 | P2 | Acessibilidade | Os 3 portais (navegação) | `ClinicLayout.tsx:58-66`, `:104-115`; `AdminLayout.tsx:139-153`, `:161-166`, `:178-182`; `ConsultantLayout.tsx:106-119`, `:139-147` | — | Estática: o item ativo da navegação é marcado só por cor, sem `aria-current="page"`. No Admin e no Consultor, "Perfil" é `<Link><Button>` (botão dentro de link, interativo aninhado) | `aria-current={isActive ? 'page' : undefined}` nos links; `<Button asChild><Link …/></Button>` no lugar de `<Link><Button>` | Aberto |
| UX-014 | P2 | Texto pt-BR | Todas (Toaster e Dialog) | `src/components/ui/toaster.tsx:30`; `src/components/ui/dialog.tsx:48` | — | axe (lista `passes`): em `chromium`\|`clinic-dashboard` a região `div[role="region"]` tem `aria-label="Notifications (F8)"` (rótulo padrão do Radix). Estática: o botão de fechar de todo `Dialog` é anunciado como "Close" (`sr-only`) | `<ToastViewport label="Notificações ({hotkey})" />` em `toaster.tsx`; trocar o `sr-only` para "Fechar" em `dialog.tsx` (texto do projeto, não do Radix) | Aberto |
| UX-015 | P2 | Acessibilidade | ~25 telas (spinners) | ex.: `consultant/clinics/page.tsx:106-108`, `consultant/dashboard/page.tsx:119-122`, `consultant/clinics/[tenantId]/page.tsx:134-136`, `clinic/protocolos/page.tsx:141-143`; 70 ocorrências de `animate-*` em 40 arquivos | — | Estática: carregamento mostrado só como um círculo girando (`<div className="animate-spin …">`), sem texto nem `role="status"`, então o leitor de tela não anuncia nada. Nenhuma animação tem a variante `motion-reduce:` (WCAG 2.3.3, boa prática) | Spinner com texto visível ou `sr-only` ("Carregando…") em `role="status"`, ou `Skeleton` (padrão da Seção 2); `motion-reduce:animate-none` | Aberto |
| UX-016 | P1 | Acessibilidade | Auth + listas Admin + upload | `login/page.tsx:288-290`; `forgot-password/page.tsx:121-122`; `change-password/page.tsx:211-212`; `reset-password/[token]/page.tsx:253-254`; `admin/tenants/page.tsx:124-126`; `admin/consultants/page.tsx:231-233`; `admin/products/page.tsx:218-220`; `src/components/upload/FileUpload.tsx:162-167` | UC-04, UC-07, UC-06 | Estática: o erro aparece numa `<div className="text-destructive …">` sem `role="alert"` nem `aria-live`. O usuário de leitor de tela envia o formulário e não ouve que o login falhou (WCAG 4.1.3/3.3.1). Bom exemplo no próprio projeto: `register/page.tsx:161-165` (`Alert variant="destructive"`, que tem `role="alert"`) | Usar `<Alert variant="destructive">` do projeto (ou `role="alert"` na `div`) | Aberto |
| UX-017 | P1 | Acessibilidade | Várias telas (botões só com ícone) | `admin/tenants/page.tsx:199-205` (Editar), `:208-210` (Suspender), `:214-216` (Reativar); `admin/legal-documents/page.tsx:183-206` (Ver/Editar/Excluir); `admin/email-templates/[tipo]/page.tsx:253-255` (Voltar); `admin/users/page.tsx:774-784` e `admin/consultants/[id]/page.tsx:503-513` (mostrar/ocultar senha); `clinic/protocolos/page.tsx:175-188` (Editar/Excluir); `src/components/protocolos/ProtocoloForm.tsx:163-170`, `:193-199`; `clinic/add-products/page.tsx:574-576`, `:1150-1155`; `clinic/requests/new/page.tsx:1064-1066`, `:1134-1139`; `clinic/consultant/page.tsx:73-75` e `src/components/clinic/ConsultantTab.tsx:61-63` (Copiar); `consultant/dashboard/page.tsx:152-159` (Copiar); `FileUpload.tsx:182-190` (Remover arquivo) | UC-20, UC-21, UC-22, UC-33, UC-34, UC-36, UC-30, UC-10, UC-11, UC-16, UC-46 | Estática: `Button` com só um ícone `lucide-react`, sem texto, `aria-label`, `sr-only` nem `title`. O leitor de tela anuncia só "botão". Ações destrutivas (Excluir, Suspender) ficam indistinguíveis. Telas fora de `A11Y_ROUTES`, então o runtime não confirma, mas o critério é inequívoco (mesma causa de UX-002, que o axe confirmou). Bom exemplo: `FixedCostsTab.tsx:265-266`. **Cross-link:** a parte de mostrar/ocultar senha (`admin/users`, `admin/consultants/[id]`) é resolvida pela migração para o `PasswordInput` de UX-060 | `aria-label` descritivo em cada um ("Editar clínica", "Suspender clínica", "Excluir documento", "Copiar código", "Voltar", "Remover produto"). Os dois toggles de senha migram para o `PasswordInput` de UX-060 ("Mostrar senha"/"Ocultar senha" alternando, sem `aria-pressed`); quando essa migração entrar, a parte de senha deste achado fecha junto | Aberto |
| UX-018 | P2 | Acessibilidade | Campos de busca das listas | `InventoryView.tsx:411-416`; `clinic/requests/page.tsx:284-289`; `consultant/clinics/page.tsx:94-99`; `admin/tenants/page.tsx:105-110`; `admin/users/page.tsx:~497-501` | UC-50, UC-48 | axe `label` em **passes** em `mobile-chromium`\|`clinic-inventory`: o input de busca só tem `placeholder`, que o axe aceita como nome. Estática: o placeholder some ao digitar e não é rótulo visível (WCAG 3.3.2) | `aria-label="Buscar produtos"` (mínimo) ou `<Label className="sr-only">` | Aberto |
| UX-019 | P1 | Acessibilidade | Clínica › Estoque; Admin › Usuários | `InventoryView.tsx:418-422`; `admin/users/page.tsx:649-661`, `:676-688` | UC-50, UC-36 | axe `button-name` em `chromium`\|`clinic-inventory` e `mobile-chromium`\|`clinic-inventory`, target `.bg-transparent` (`button role="combobox"`, filtro de categoria). Estática: em `admin/users`, `<Label htmlFor="role">` e `<Label htmlFor="active">` apontam para `id`s que não existem, porque o `SelectTrigger` não recebe `id` | `aria-label="Categoria"` no `SelectTrigger` do estoque; `id="role"`/`id="active"` nos `SelectTrigger` de `admin/users` | Aberto |
| UX-020 | P2 | Acessibilidade | Filtros em botão | `InventoryView.tsx:433-454`; `admin/tenants/page.tsx:113-118` | UC-50, UC-22 | Estática: o filtro ativo é indicado só pela variante visual (`default` × `outline`), sem `aria-pressed`. "Mostrar Ativos"/"Mostrando Ativos" troca o rótulo, o que confunde ação e estado | `aria-pressed={filterBy === f}` e `role="group" aria-label="Filtrar por situação"` (mesmo padrão de `register/page.tsx:286-293`) | Aberto |
| UX-021 | P2 | Acessibilidade | Formulários (sistema todo) | ex.: `admin/tenants/new/page.tsx:111-136` + `:581`; `admin/products/new/page.tsx:56-74` + `:241` | UC-21, UC-31 | Estática: nenhuma ocorrência de `aria-invalid` ou `aria-describedby` em `src/`. Os erros de validação aparecem num banner único no fim do formulário, sem ligação com o campo e sem foco no primeiro campo inválido. Critério sem regra axe | Erro ao lado do campo (`<p id="campo-erro">`), `aria-invalid` + `aria-describedby` no `Input` e foco no primeiro campo inválido | Aberto |
| UX-022 | P2 | Acessibilidade | Clínica (várias), Admin › Dashboard, Login | `clinic/dashboard/page.tsx:285`; `InventoryView.tsx:311`; `clinic/requests/page.tsx:190`; `admin/dashboard/page.tsx:143`; `ClinicLayout.tsx:52`; `login/page.tsx:247` | UC-04 | Estática: no portal Clínica, o único `<h1>` é o logotipo "Curva Mestra" e o título da tela é `<h2>`. No login não há `h1` (o `CardTitle` vira `h3`). **Já registrado (parcial):** `_MAPA-DE-BUGS-E-MELHORIAS.md` §8.2, divergência 2 (só os dois dashboards, como consistência visual). Estoque, Procedimentos e Login são novos | `<h1>` no título de cada tela; o logotipo do `ClinicLayout` deixa de ser `h1` | Aberto |
| UX-023 | P1 | Texto pt-BR | Admin › Configurações, Documentos Legais, Suspender Clínica; Clínica › Termos e Alertas | `admin/settings/page.tsx:64`, `:114`, `:146`; `admin/legal-documents/page.tsx:59`, `:104`; `admin/legal-documents/[id]/page.tsx:47`; `src/components/admin/LegalDocumentForm.tsx:101`, `:263`; `src/components/admin/SuspendTenantDialog.tsx:131`, `:310`; `clinic/setup/terms/page.tsx:115`, `:170`; `src/components/clinic/AlertsTab.tsx:50`, `:90` | UC-35, UC-33, UC-34, UC-22, UC-09, UC-42 | Estática: o toast mostra `description: error.message` de chamadas diretas ao SDK do Firestore/Functions (`getDoc`, `setDoc`, `httpsCallable`). A mensagem sai em inglês e é técnica (ex.: "Missing or insufficient permissions."). Diferente de `UC-37-RN-06` (500 de rota de API, já corrigido) | Mensagem fixa e acionável em pt-BR ("Não foi possível salvar as configurações. Tente novamente."); manter o `error` só no `console.error` | Aberto |
| UX-024 | P2 | Prevenção de erro | Admin › Consultores e Clínica (detalhe); Clínica › Convidar consultor; sino | `admin/consultants/page.tsx:77`, `:108`; `admin/tenants/[id]/page.tsx:303`, `:341`; `clinic/consultant/invite/page.tsx:149`, `:198`; `NotificationBell.tsx:119`, `:126` | UC-29, UC-23, UC-54, UC-44 | Estática: confirmação de ações irreversíveis (suspender consultor, vincular/remover consultor, enviar/cancelar convite, excluir notificações) por `confirm()` do navegador: sem marca, sem botão destrutivo e com aparência diferente por navegador/Capacitor. Comportamento descrito nos UCs (UC-23 passo 9, UC-29, UC-54 passo 8, UC-44 §fluxo), sem item no mapa. O `ConfirmDialog` do projeto já existe | Trocar por `ConfirmDialog` (`destructive` nas ações destrutivas), como já foi feito em UC-08-RNF-02 e UC-19-RN-06 | Aberto |
| UX-060 | P2 | Acessibilidade | Auth › Login, Troca obrigatória de senha, Redefinir senha; Admin › Meu Perfil, Detalhe da clínica (novo usuário); Clínica › Meu Perfil, aba Usuários | `src/app/(auth)/login/page.tsx:279`; `src/app/(auth)/change-password/page.tsx:170`, `:184`, `:199`; `src/app/(auth)/reset-password/[token]/page.tsx:227`, `:243`; `src/app/(admin)/admin/profile/page.tsx:195`, `:208`, `:225`; `src/app/(admin)/admin/tenants/[id]/page.tsx:804`; `src/app/(clinic)/clinic/profile/page.tsx:309`, `:322`, `:337`; `src/components/clinic/UsersTab.tsx:277`. Toggles existentes: `src/app/(admin)/admin/users/page.tsx:766-784` (+ `:792`) e `src/app/(admin)/admin/consultants/[id]/page.tsx:495-513` (+ `:521`) | UC-04, UC-06, UC-08, UC-30, UC-37, UC-38, UC-39, UC-40, UC-41 | Estática: 14 campos `type="password"` fixos em 7 arquivos, sem opção de mostrar/ocultar a senha. O usuário não consegue conferir o que digitou, o que pesa no celular (teclado virtual, PWA/Capacitor) e para quem tem dificuldade motora ou cognitiva, e gera tentativas de login falhas e senhas novas digitadas errado em "Nova senha"/"Confirmar". Não é falha WCAG 2.1 AA estrita: é boa prática de usabilidade ligada a 3.3.2 e à autenticação acessível. Bom exemplo parcial: `admin/users` e `admin/consultants/[id]` já têm toggle `Eye`/`EyeOff` (um botão controla "Nova senha" e "Confirmar"), mas o botão não tem nome acessível (UX-017), e o campo é um `<input>` cru que recria as classes do `Input` (`_MAPA-DE-BUGS-E-MELHORIAS.md` §8.2, divergência 4). Critério sem regra axe; `login` está em `A11Y_ROUTES`, mas o axe não acusa a ausência do controle | Criar um componente reutilizável `PasswordInput` (`src/components/ui/password-input.tsx`) sobre o primitivo `Input`: botão `type="button"` com ícone `Eye`/`EyeOff`, `aria-label` dinâmico "Mostrar senha"/"Ocultar senha" (sem `aria-pressed`), área de toque de ao menos 24×24 px e repasse de `id`, `autoComplete` e `disabled`. Aplicar nos 14 campos e migrar os 2 toggles existentes, o que fecha a parte de senha de UX-017 e a §8.2 divergência 4. Spec de implementação: `ONLY_FOR_DEVS/TO_DO/FEAT-toggle-visibilidade-senha.md` | Aberto |

#### Clínica (`clinic_admin`, `clinic_user`)

**Clínica › Dashboard (`/clinic/dashboard`)**

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-025 | P0 | Estado de erro | Clínica › Dashboard | `src/app/(clinic)/clinic/dashboard/page.tsx:154-160`; `src/lib/services/inventoryService.ts:241-245` | UC-53 | Estática: o `Promise.all` de "Próximos Procedimentos" + "Atividade Recente" termina em `.catch(() => {})`, e `getRecentActivity` já engole a falha e devolve `[]`. Em qualquer falha, os blocos mostram "Nenhum procedimento agendado nas próximas 2 semanas" (`:512-518`) e "Nenhuma movimentação recente" (`:579-583`): o erro aparece como vazio | Estado de erro por bloco, com texto do próprio bloco ("Não foi possível carregar os próximos procedimentos.") e "Tentar novamente", no padrão da Projeção de Reposição (`:461-464`) e de `ProjectionsView.tsx:105-111`; `getRecentActivity` deve propagar o erro | Aberto |
| UX-026 | P1 | Estado de erro | Clínica › Dashboard | `dashboard/page.tsx:146-152`, `:291-297`, `:313-316`, `:357-360`, `:132` | — | Estática: se as estatísticas falham, aparece o `Alert` genérico ("Erro" / "Erro ao carregar dados do dashboard") **e**, ao mesmo tempo, os cards mostram "Nenhum produto em estoque" e "Sem dados de procedimentos" (mensagens contraditórias, sem ação de recuperação). O único `error: string` é compartilhado com o listener de alertas (`:132`), então uma mensagem sobrescreve a outra | Nos cards, tratar o erro como estado próprio (não cair no ramo vazio); mensagem acionável com "Tentar novamente"; um estado de erro por fonte | Aberto |
| UX-027 | P1 | Estado de erro | Clínica › Dashboard | `dashboard/page.tsx:132`, `:395-396`, `:624` | UC-50 | Estática: se o `onSnapshot` de inventário falha, `alertasStats` fica `null` e o card "Alertas" fica em `BlockSkeleton` para sempre; "Produtos a Vencer" simplesmente não aparece | Distinguir "carregando" de "falhou" e mostrar o erro no próprio card | Aberto |
| UX-028 | P1 | Acessibilidade | Clínica › Dashboard | `dashboard/page.tsx:522-526` | — | Estática: cada item de "Próximos Procedimentos" é `<div … cursor-pointer onClick>` sem `tabIndex`, `role` nem `onKeyDown`: não é operável por teclado (WCAG 2.1.1/4.1.2). Há uma alternativa parcial ("Ver todos os procedimentos", `:544-551`). Critério sem regra axe; sem dados no seed | Trocar a `div` por `<Link href={`/clinic/requests/${proc.id}`}>` (ver UX-029) | Aberto |
| UX-029 | P1 | Navegação/IA | Clínica › Dashboard → Procedimentos | `dashboard/page.tsx:525`; `src/app/(clinic)/clinic/requests/page.tsx` (sem `useSearchParams`) | UC-16..19 | Estática: o clique num procedimento navega para `/clinic/requests?id={id}`, mas a lista de Procedimentos não lê o parâmetro `id`. O usuário cai na lista inteira, sem destaque, e precisa procurar o item de novo | Navegar para o detalhe `/clinic/requests/{id}` (rota já existente) | Aberto |
| UX-030 | P1 | Feedback/status | Clínica › Dashboard | `dashboard/page.tsx:500`, `:192-197`; `src/lib/services/solicitacaoService.ts:1144-1160` | — (sem UC do Dashboard) | Estática: a consulta traz `status in ['agendada','efetuada']` com `dt_procedimento <= hoje+14d`, **sem limite inferior**, em ordem crescente e limitada a 5. Procedimentos passados (inclusive `efetuada`, já realizados) ocupam a lista com o rótulo "Atrasado" e podem esconder os próximos de fato. A descrição diz "Procedimentos agendados nas próximas 2 semanas" | Alinhar rótulo e consulta: separar "Pendentes de conclusão" (passados) de "Próximos" (`>= hoje`), ou ajustar a descrição; para `efetuada` passado, rótulo "Aguardando conclusão". A inclusão de `efetuada` pode ser intencional (`FEAT-reformulacao-regras-procedimentos`): confirmar a regra | Aberto |
| UX-031 | P1 | Consistência de comportamento | Clínica › Dashboard e Estoque | `dashboard/page.tsx:109-125`, `:413-440`; `InventoryView.tsx:125-133`, `:371-381`; `src/lib/inventoryUtils.ts:28-29`, `:60-61` | UC-50, UC-15 | Estática: o número do card difere da lista aberta pelo clique. "Estoque baixo" no Dashboard conta `quantidade < 10` fixo, por lote; o filtro `low_stock` usa `<= limite_estoque_baixo ?? 10`, por produto. "Vencem em 30 dias" (Dashboard) e o card "Próximos ao Vencimento" (Estoque) excluem vencidos; o filtro `expiring` ("Vencendo") inclui vencidos (`dt_validade <= hoje+30`). Relacionado: `UC-48-RN-03` (terceiro limiar fixo, Aberto) | Uma regra única (`getStatusEstoque` e o mesmo critério de vencimento) para card e filtro, ou filtro "Vencendo" com `>= hoje` | Aberto |
| UX-032 | P2 | Texto pt-BR | Clínica › Dashboard | `dashboard/page.tsx:227-236` | UC-17 | Estática: `getStatusLabel` não tem `efetuada` (status existente) e ainda lista `aprovada`/`reprovada`; `efetuada` aparece cru, em minúsculas, no `Badge`. O mapa completo já existe em `clinic/requests/page.tsx:165-172` | Reaproveitar o mapa de rótulos da tela de Procedimentos | Aberto |
| UX-033 | P2 | Texto pt-BR | Clínica › Dashboard | `dashboard/page.tsx:285-287` | — | Estática: com `displayName` vazio, o título vira "Olá, !". O `readyHeading` do teste (`/^Olá, \S+!$/`) depende do nome | Fallback "Olá!" quando não houver nome | Aberto |
| UX-034 | P2 | Affordance | Clínica › Dashboard | `dashboard/page.tsx:636-639` | — | Estática: os itens de "Produtos a Vencer" têm `hover:bg-accent/50`, mas não são clicáveis | Remover o hover ou tornar o item um link para `/clinic/inventory/{id}` | Aberto |

**Clínica › Estoque (`/clinic/inventory`, `InventoryView`, também usado pelo consultor)**

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-035 | P0 | Acessibilidade | Clínica › Estoque | `InventoryView.tsx:506-510`; `src/app/(clinic)/clinic/inventory/page.tsx:27` | UC-50, UC-13, UC-15 | Estática: a única forma de abrir o detalhe de um item (`/clinic/inventory/{id}`) é clicar na `TableRow` (`onClick` + `cursor-pointer`), que não recebe foco nem responde a Enter. Quem usa só teclado ou leitor de tela não consegue ver o detalhe, desativar o item (UC-13) nem ajustar o limite (UC-15): fluxo principal inoperável por teclado. Critério sem regra axe; o seed não tem itens | Pôr um `<Link href={`/clinic/inventory/${item.id}`}>` no nome do produto (célula `:512`), mantendo o clique na linha como atalho | Aberto |
| UX-036 | P1 | Estado de erro | Clínica › Estoque | `InventoryView.tsx:264-268`, `:276-279`, `:344-400`, `:473-474` | UC-50 | Estática: em falha, a tabela mostra "Erro ao carregar inventário" (distinto do vazio, correto), mas sem "Tentar novamente", e os 4 cards de resumo continuam mostrando `0`, o que contradiz o erro | Esconder ou marcar os cards como indisponíveis em caso de erro; texto acionável + botão "Tentar novamente" | Aberto |
| UX-037 | P1 | Mobile/PWA | Clínica › Estoque | `InventoryView.tsx:321-338` | UC-50 | Runtime: `mobile-chromium`\|`clinic-inventory`: `scrollWidth` **506** para `deviceWidth` 412, `overflow: true` (`clinic-inventory.overflow.json`). Estática: os três botões do cabeçalho ("Adicionar Produtos", "Ver Projeções", "Exportar Excel") ficam em `flex gap-2` sem quebra. É a única das 4 rotas com rolagem horizontal | `flex flex-wrap gap-2` (como em `clinic/requests/page.tsx:188`), ou empilhar os botões com `w-full sm:w-auto` | Aberto |

**Clínica › Procedimentos, Protocolos, Solicitações de acesso, Upload/Adicionar produtos**

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-038 | P0 | Estado de erro | Clínica › Procedimentos | `src/app/(clinic)/clinic/requests/page.tsx:118-120`, `:321-334` (e `:135-136`) | UC-16, UC-17, UC-18, UC-19 | Estática: a falha de `listSolicitacoes` só faz `console.error`; a tela mostra "Nenhum procedimento encontrado — Crie seu primeiro procedimento". A clínica pode concluir que perdeu os registros ou criar um procedimento em duplicidade. As estatísticas do mês caem em "—" sem explicação | Estado de erro distinto, com "Tentar novamente"; nos cards, "Indisponível" em vez de "—" | Aberto |
| UX-039 | P2 | Estado vazio | Clínica › Procedimentos | `requests/page.tsx:326-333`, `:195`; `requests/new/page.tsx:96-97` | UC-16 | Estática: (a) a mensagem de vazio considera só a busca (`searchTerm`) e ignora o filtro de status, então diz "Crie seu primeiro procedimento" quando há procedimentos de outro status. (b) O botão "Novo Procedimento" do vazio aparece para `clinic_user`, enquanto o do cabeçalho é escondido (`isAdmin`); ao clicar, o usuário é devolvido em silêncio para a lista | Considerar `statusFilter !== 'all'` na mensagem; mostrar o CTA só para `clinic_admin` | Aberto |
| UX-040 | P1 | Estado de erro | Clínica › Protocolos | `src/app/(clinic)/clinic/protocolos/page.tsx:83-85`, `:144-159` | UC-20 | Estática: em falha há um toast, mas a tela fica em "Nenhum protocolo cadastrado — Criar primeiro protocolo". O toast some e o estado vazio com CTA permanece | Estado de erro persistente na tela, distinto do vazio, com "Tentar novamente" | Aberto |
| UX-041 | P1 | Estado de erro | Clínica › Solicitações de acesso; Consultor › Solicitações de acesso | `src/app/(clinic)/clinic/access-requests/page.tsx:72-78`, `:~252`; `src/app/(consultant)/consultant/access-requests/page.tsx:90-94`, `:158-162` | UC-05, UC-56 | Estática: em falha, toast + "Nenhuma solicitação pendente". O toast some e o usuário fica com a impressão de que não há pendências (no consultor, as solicitações vinculadas expiram em 48 h) | Mesmo padrão de UX-040 | Aberto |
| UX-042 | P2 | Estado de erro | Clínica › Novo procedimento | `src/app/(clinic)/clinic/requests/new/page.tsx:185-190` | UC-16 | Estática: `listProtocolos(...).catch(() => {})`. Se falhar, o seletor "Aplicar protocolo" simplesmente não tem opções, sem aviso | Toast não bloqueante: "Não foi possível carregar os protocolos; você ainda pode adicionar os produtos manualmente." | Aberto |
| UX-043 | P2 | Affordance | Clínica › Upload XML | `src/components/upload/FileUpload.tsx:98-110`, `:135` | UC-10 | Estática: o cartão tracejado tem `cursor-pointer` e o texto "ou clique para selecionar", mas o `Card` não tem `onClick`. Só o botão "Selecionar Arquivo" abre o seletor | Tornar o cartão clicável (`<label htmlFor="file-upload">` envolvendo a área) ou trocar o texto por "ou use o botão abaixo" | Aberto |
| UX-044 | P2 | Acessibilidade | Clínica › Adicionar produtos (busca Rennova) | `src/app/(clinic)/clinic/add-products/page.tsx:864-906` | UC-11 | Estática: o autocomplete feito à mão não tem semântica de combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"`/`option`), não fecha com Esc nem navega por setas. As sugestões são `<button>` alcançáveis por Tab (operável, mas sem contexto). Exceção visual já justificada em `_PADRAO-VISUAL-UI.md` (sem primitivo `Command`) | Adicionar `role="combobox"`, `aria-expanded`, `aria-controls` e `aria-autocomplete="list"` no `Input`, `role="listbox"`/`option` na lista e Esc para fechar | Aberto |

#### Admin (`system_admin`)

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-045 | P1 | Estado de erro | Admin › Dashboard | `src/app/(admin)/admin/dashboard/page.tsx:45-66`, `:133-135`, `:155-198`, `:245-248` | — | Estática: falha nas estatísticas só faz `console.error`; os cards mostram `0` clínicas e `0` usuários. Falha nas atividades mostra "Nenhuma atividade recente". O bloco de atividade usa o `loading` das estatísticas, e não o próprio. Runtime: tela varrida com dados (sem falha), sem evidência axe deste critério | Estado de erro nos cards ("Indisponível") e no bloco de atividade, com "Tentar novamente"; `loading` próprio para atividades | Aberto |
| UX-046 | P0 | Estado de erro | Admin › Configurações | `src/app/(admin)/admin/settings/page.tsx:39-47`, `:53-70`, `:92-98` | UC-35 | Estática: se `getDoc(system_settings/global)` falha, há só um toast e o formulário segue **editável com os valores padrão** (timeout 15 min, manutenção desligada, cadastro liberado). Se o admin clicar "Salvar", o `setDoc` sobrescreve a configuração real com esses padrões e pode desligar um modo de manutenção ativo ou reabrir o cadastro. Dado em risco | Em falha de carga, mostrar `Alert` com "Tentar novamente" e **não** renderizar o formulário (ou desabilitar "Salvar") até a leitura dar certo | Aberto |
| UX-047 | P0 | Estado de erro | Admin › Usuários | `src/app/(admin)/admin/users/page.tsx:164-166`, `:507-512` | UC-36, UC-37, UC-08 | Estática: falha ao listar usuários só faz `console.error`; a tela mostra "Nenhum usuário cadastrado" e o card "Total de Usuários: 0" | Estado de erro distinto, com "Tentar novamente" | Aberto |
| UX-048 | P1 | Prevenção de erro | Admin › Usuários (diálogo Editar) | `admin/users/page.tsx:245-286`, `:337`, `:359-373`, `:396-420` | UC-36, UC-37, UC-08 | Estática: validação, sucesso e erro por `alert()`; a confirmação de "último admin da clínica" (ação que pode deixar a clínica sem administrador) por `confirm(data.error)`; erros como `` `Erro ao …: ${error.message}` ``. **Já registrado:** UC-36 RNF-03 (documentado no UC, sem item no mapa) | Toast para sucesso e erro; `ConfirmDialog destructive` para o caso de último admin; erros de validação ao lado dos campos de senha | Aberto |
| UX-049 | P1 | Estado de erro | Admin › Clínicas, Consultores, Produtos Rennova | `admin/tenants/page.tsx:57-59`, `:124-144`; `admin/consultants/page.tsx:65-66`, `:231-253`; `admin/products/page.tsx:84-85`, `:218-227` | UC-21, UC-22, UC-28, UC-29, UC-31, UC-32 | Estática: em falha, o banner de erro aparece **e**, logo abaixo, "Nenhuma clínica cadastrada" / "Nenhum consultor cadastrado" / "Nenhum produto encontrado", ao mesmo tempo. Mensagens contraditórias e sem "Tentar novamente" (o erro não é anunciado, ver UX-016) | Com erro, não renderizar o ramo vazio; mostrar o erro no lugar da lista, com "Tentar novamente" | Aberto |

#### Consultor (`clinic_consultant`)

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-050 | P0 | Estado de erro | Consultor › Minhas Clínicas | `src/app/(consultant)/consultant/clinics/page.tsx:42-56`, `:109-127` | UC-48 | Estática: `response.ok === false` é ignorado e o `catch` só faz `console.error`; a tela mostra "Nenhuma clínica vinculada — Busque clínicas por CNPJ/CPF para solicitar vínculo". O consultor pode sair procurando e pedir vínculo/transferência de clínicas que já são dele. **Já registrado:** UC-48 RNF-01 (fluxo 8a), só no UC, sem item no mapa | Estado de erro distinto do vazio, com "Tentar novamente" (`useAsyncState`, já usado em `consultant/profile`) | Aberto |
| UX-051 | P0 | Estado de erro | Consultor › Dashboard | `src/app/(consultant)/consultant/dashboard/page.tsx:41-61`, `:137`, `:147`, `:236-241` | UC-48, UC-52 | Estática: mesmo padrão de UX-050 para o perfil e para as clínicas. Em falha, o card do código do consultor fica vazio (sem código para compartilhar), "Clínicas Vinculadas" mostra `0` e o bloco diz "Você ainda não possui clínicas vinculadas" | Estado de erro por bloco, com "Tentar novamente" | Aberto |
| UX-052 | P1 | Estado de erro | Consultor › Detalhe da clínica | `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx:79-111`, `:158-166`, `:174-211` | UC-48 | Estática: falha nas estatísticas mantém `0` em "Itens no Estoque", "Próximos a Vencer" e "Estoque Baixo"; falha no tenant mostra o título "Clínica", documento "—" e o badge **"Inativa"** (o `tenant?.active` indefinido vira "Inativa"), uma informação falsa. **Já registrado:** UC-48 RNF-01 (fluxo 8b) | Erro por bloco; não exibir o badge de status sem o dado; "Tentar novamente" | Aberto |
| UX-053 | P0 | Estado de erro | Consultor › Pedidos de Transferência | `src/app/(consultant)/consultant/transfer-requests/page.tsx:47-54`, `:240-245` | UC-26, UC-27, UC-54 | Estática: `res.ok === false` é ignorado e o `catch` só faz `console.error`; a aba "Pendentes" mostra "Nenhum pedido de transferência pendente". Pedidos e convites têm prazo (`isRequestExpired`), então o consultor pode perder o prazo de decisão | Estado de erro distinto, com "Tentar novamente" | Aberto |
| UX-054 | P1 | Acessibilidade | Consultor › Dashboard | `consultant/dashboard/page.tsx:179-196`, `:253-257` | UC-48, UC-24 | Estática: os cards "Buscar Clínicas" e "Projeção de Reposição" e cada clínica de "Minhas Clínicas" são `Card`/`div` com `onClick`, sem foco nem Enter. Há alternativas parciais (nav lateral, "Ver Todas"), mas o atalho para o detalhe de uma clínica (`:256`) só existe por mouse | `<Link>` envolvendo cada cartão (como `ClinicCard.tsx:72`) | Aberto |
| UX-055 | P2 | Texto pt-BR | Consultor › Pedidos de Transferência | `transfer-requests/page.tsx:328`, `:288-292` | UC-26, UC-27, UC-54 | Estática: o `ConfirmDialog` diz "Confirma a aprovacao do pedido da clinica … Esta acao e irreversivel." (sem acentos). O diálogo de rejeição, para um **convite** (sem `requesting_consultant_name`), monta "o pedido de  para a clínica X" | Acentuar o texto; para convites, "Informe um motivo para recusar o convite da clínica X." | Aberto |
| UX-056 | P2 | Texto pt-BR | Consultor › Dashboard | `consultant/dashboard/page.tsx:110-114`, `:137` | — | Estática: sem nome, a frase vira "Bem-vindo ao Portal do Consultor, ". `navigator.clipboard.writeText` não é aguardado nem tratado, e o toast "Código copiado" aparece mesmo se a cópia falhar (ex.: WebView do Capacitor sem permissão) | Fallback sem vírgula; `await` + `catch` com toast "Não foi possível copiar o código" | Aberto |

#### Auth e telas fora de grupo

| ID | Prioridade | Categoria | Tela | Local | UC | Evidência | Recomendação | Status |
|----|-----------|-----------|------|-------|----|-----------|--------------|--------|
| UX-057 | P2 | Texto pt-BR | Auth › Login | `src/app/(auth)/login/page.tsx:167-186` | UC-04 | Estática: o tradutor de erros cobre os códigos comuns, mas o fallback `return error \|\| …` devolve a mensagem crua do Firebase (em inglês, com `auth/…`) para qualquer código não mapeado | Fallback sempre em pt-BR ("Não foi possível entrar. Tente novamente."), com o código só no `console.error` | Aberto |
| UX-058 | P1 | Texto pt-BR | Fora de grupo › `/dashboard` | `src/app/dashboard/page.tsx:54-58`, `:90-125`; destino de `ProtectedRoute.tsx:155-156` e `login/page.tsx:107-108` | UC-04 | Estática: usuário autenticado sem papel reconhecido é mandado para `/dashboard`, que mostra "Dashboard de Debug", "⚠️ Esta página só deve ser acessada para debug", "Custom Claims", "Tenant ID", "UID" e "Conectado ao Firebase (produção)" (jargão e informação interna) | Para esse caso, mostrar uma tela de "Acesso não configurado" com orientação ("Seu acesso ainda não foi liberado. Fale com o administrador da clínica.") e botão "Sair". Restringir a tela de debug a `system_admin` (como `src/app/debug/page.tsx` já faz) | Aberto |
| UX-059 | P2 | Sem permissão | Todas as rotas protegidas; Consultor › detalhe da clínica | `src/components/auth/ProtectedRoute.tsx:75-80`, `:129-134`; `consultant/clinics/[tenantId]/page.tsx:57-59`; `consultant/clinics/[tenantId]/pricing/page.tsx:48-50` | UC-04, UC-48 | Estática: quem abre uma rota de outro papel, ou uma clínica que não está em `authorized_tenants` (link antigo, vínculo removido), é redirecionado em silêncio para o próprio dashboard ou lista. Ninguém explica por que a página pedida não abriu | Toast no destino ("Você não tem acesso a essa página" / "Você não está mais vinculado a essa clínica") | Aberto |

> Os campos de senha das telas de Auth (`login`, `change-password`, `reset-password/[token]`) estão no achado transversal UX-060, porque o mesmo defeito se repete nos portais Admin e Clínica.

**Pontos positivos (referência para o padrão):**
- Skeletons por bloco, sem salto de layout: `clinic/dashboard/page.tsx:269-278`, `:503-511`, `:567-578`; `InventoryView.tsx:467-472`.
- Erro distinto do vazio, com "Tentar novamente": `ProjectionsView.tsx:105-111`; `clinic/inventory/[id]/page.tsx:621-625`; hook `useAsyncState`.
- Vazio que diferencia "sem dados" de "sem resultado no filtro": `consultant/clinics/page.tsx:114-131`; `InventoryView.tsx:480-484`.
- `ConfirmDialog` compartilhado: `transfer-requests/page.tsx:322-336`.
- Todos os `Dialog`/`AlertDialog` têm título.
- `Alert` com `role="alert"`: `register/page.tsx:161-165`.
- `aria-pressed` + `role="group"`: `register/page.tsx:286-293` e `FormaPagamentoSelector.tsx:25`.
- `aria-label` em botões só com ícone: `FixedCostsTab.tsx`.
- Tabelas com rolagem embutida no primitivo: `table.tsx:7`.
- `lang="pt-BR"` no `<html>`: `src/app/layout.tsx:37`.
- Login com `autoComplete` e `type` corretos: `login/page.tsx:264-286`.
- Toggle de mostrar/ocultar senha (comportamento a generalizar, faltando o nome acessível): `admin/users/page.tsx:766-784`; `admin/consultants/[id]/page.tsx:495-513`.

### 7.3 Por Caso de Uso (matriz UC × IDs)

O mapeamento é heurístico: a rota é citada no UC. Os layouts e o Dashboard da clínica não têm UC dedicado.

| UC | Tela(s) | IDs |
|----|---------|-----|
| UC-04 (login com redirecionamento por papel) | `/login`, `/dashboard`, `ProtectedRoute` | UX-001, UX-016, UX-022, UX-057, UX-058, UX-059, UX-060 |
| UC-05 (aprovar solicitação pela própria clínica) | `/clinic/access-requests` | UX-041 |
| UC-06 / UC-07 (troca e recuperação de senha) | `/change-password`, `/forgot-password`, `/reset-password/[token]` | UX-016, UX-060 (UC-06, `/change-password`) |
| UC-08 / UC-36 / UC-37 (usuários no Admin) | `/admin/users`; `/reset-password/[token]` (destino do link do UC-08) | UX-017, UX-019, UX-047, UX-048, UX-060 (UC-08 no `/reset-password/[token]`; UC-37 no toggle de `/admin/users`) |
| UC-09 (aceitar termos) | `/clinic/setup/terms` | UX-023 |
| UC-10 (importar NF-e XML) | `/clinic/upload` (`FileUpload`) | UX-016, UX-017, UX-043 |
| UC-11 (inserir NF manual) | `/clinic/add-products` | UX-017, UX-044 |
| UC-13 / UC-15 / UC-50 (inventário, detalhe, desativar, limite) | `/clinic/inventory`, `/clinic/inventory/[id]` | UX-008, UX-018, UX-019, UX-020, UX-027, UX-031, UX-035, UX-036, UX-037 |
| UC-16 a UC-19 (procedimentos) | `/clinic/requests`, `/clinic/requests/new` | UX-017, UX-029, UX-032, UX-038, UX-039, UX-042 |
| UC-20 (protocolos) | `/clinic/protocolos`, `ProtocoloForm` | UX-017, UX-040 |
| UC-21 / UC-22 (clínicas no Admin) | `/admin/tenants`, `/admin/tenants/new`, `SuspendTenantDialog` | UX-017, UX-020, UX-021, UX-023, UX-049 |
| UC-23 (vincular/remover consultor) | `/admin/tenants/[id]` | UX-024 |
| UC-26 / UC-27 (transferência) | `/consultant/transfer-requests` | UX-053, UX-055 |
| UC-28 / UC-29 / UC-30 (consultores no Admin) | `/admin/consultants`, `/admin/consultants/[id]` | UX-017, UX-024, UX-049, UX-060 (UC-30, toggle de senha) |
| UC-31 / UC-32 (catálogo master) | `/admin/products`, `/admin/products/new` | UX-021, UX-049 |
| UC-33 / UC-34 (documentos legais) | `/admin/legal-documents*`, `LegalDocumentForm` | UX-017, UX-023 |
| UC-35 (configurações globais) | `/admin/settings` | UX-023, UX-046 |
| UC-38 (perfil e senha do system admin) | `/admin/profile` | UX-060 |
| UC-39 (criar usuário para a clínica via Admin) | `/admin/tenants/[id]` (diálogo de novo usuário) | UX-060 |
| UC-40 (criar usuário na própria clínica) | `UsersTab` (`/clinic/my-clinic`, `/clinic/users`) | UX-060 |
| UC-41 (perfil e senha do usuário de clínica) | `/clinic/profile` | UX-060 (estados de carregamento conformes, usam `useAsyncState`) |
| UC-42 (alertas manuais) | `AlertsTab` (`/clinic/my-clinic`) | UX-023 |
| UC-44 (notificações) | `NotificationBell` | UX-004, UX-005, UX-024 |
| UC-46 (consultor vinculado) | `/clinic/consultant`, `ConsultantTab` | UX-017 |
| UC-48 (clínicas vinculadas e estoque, consultor) | `/consultant/clinics`, `/consultant/clinics/[tenantId]`, `/consultant/dashboard` | UX-050, UX-051, UX-052, UX-054, UX-059 |
| UC-52 (projeção de reposição) | Dashboards da clínica e do consultor, `ProjectionsView` | UX-051 (o bloco da clínica e `ProjectionsView` estão conformes) |
| UC-53 (trilha de auditoria) | widget "Atividade Recente" do Dashboard | UX-025 |
| UC-54 (convidar consultor) | `/clinic/consultant/invite`, `/consultant/transfer-requests` | UX-024, UX-053, UX-055 |
| UC-56 (consultor aprova solicitação) | `/consultant/access-requests` | UX-041 |
| UC-49 (perfil do consultor) | `/consultant/profile` | Conforme (usa `useAsyncState`; não há campo de senha) |
| UC-59 (último acesso) | coluna "Último acesso" em `/admin/users` | Exceção justificada (7.6) |
| Sem UC | Layouts, tokens, Dashboard da clínica (cabeçalho, alertas, próximos procedimentos), Dashboard do Admin | UX-002, UX-003, UX-006, UX-007, UX-009 a UX-015, UX-026, UX-028, UX-030, UX-033, UX-034, UX-045, UX-056 |

### 7.4 Suspeitas que ainda requerem runtime

| ID | Por que continua suspeita |
|----|---------------------------|
| UX-009 | O critério tem regra axe (`color-contrast`), mas o portal do Consultor não está em `A11Y_ROUTES`: o consultor semeado cai em `/accept-terms`. O cálculo estático já indica falha (4.10:1 e 2.77:1) |
| UX-012 | Regra axe `link-name`/`button-name`, mas a rota está fora de `A11Y_ROUTES` e o defeito só aparece com a sidebar recolhida (estado em `localStorage`) |
| UX-008 (parte) | `text-yellow-600` foi medido (2.93:1, `incomplete`). Os casos `text-orange-600`/`text-green-600` em texto pequeno e o `Badge` warning não foram renderizados, porque o seed de `clinicAdminA` não tem estoque nem procedimentos |
| Critérios sem regra axe (valem pela análise estática, já `Aberto`) | UX-005, UX-010, UX-015, UX-021, UX-028, UX-035, UX-054, UX-060 (teclado, contraste de componente, movimento, erro ligado ao campo, ausência de mostrar/ocultar senha) |
| Telas fora de `A11Y_ROUTES` com achados axe-verificáveis (`Aberto` pela estática) | UX-016, UX-017, UX-019 (parte de `admin/users`), UX-022. Depois da implementação de UX-060, o axe passa a poder verificar o `button-name` do novo botão de senha em `login` (já em `A11Y_ROUTES`) |

### 7.5 Baseline axe × achados

| Entrada do baseline | Regra | Achado(s) | Situação em 19/10/2026 |
|---------------------|-------|-----------|------------------------|
| `chromium\|admin-dashboard` | `color-contrast` | UX-006 (target `.text-destructive`), UX-007 (target `.space-y-8 > div:nth-child(1) > p`) | Ainda ocorre (2 nós). Manter |
| `chromium\|admin-dashboard` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `chromium\|clinic-dashboard` | `button-name` | UX-002, UX-004 | Ainda ocorre (2 nós). Manter |
| `chromium\|clinic-dashboard` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `chromium\|clinic-inventory` | `button-name` | UX-002, UX-004, UX-019 (combobox `.bg-transparent`) | Ainda ocorre (3 nós). Manter |
| `chromium\|clinic-inventory` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `chromium\|login` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `mobile-chromium\|admin-dashboard` | `color-contrast` | UX-006, UX-007 | Ainda ocorre (2 nós). Manter |
| `mobile-chromium\|admin-dashboard` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `mobile-chromium\|clinic-dashboard` | `button-name` | UX-002, UX-003, UX-004 | Ainda ocorre (3 nós). Manter |
| `mobile-chromium\|clinic-dashboard` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `mobile-chromium\|clinic-inventory` | `button-name` | UX-002, UX-003, UX-004, UX-019 | Ainda ocorre (4 nós). Manter |
| `mobile-chromium\|clinic-inventory` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |
| `mobile-chromium\|login` | `meta-viewport` | UX-001 | Ainda ocorre. Manter |

- **Entradas removíveis:** nenhuma.
- **Violações sem entrada no baseline:** nenhuma.
- **Itens `incomplete` (fora do baseline, por natureza):**
  - `color-contrast` em `.text-yellow-600` (`clinic-inventory`, 2.93:1), ligado a UX-008;
  - `color-contrast` em `.text-3xl` (`mobile-chromium|admin-dashboard`, `elmPartiallyObscured`), ligado a UX-011.
- **Reflow (`*.overflow.json`, `mobile-chromium`):**
  - `login`, `admin-dashboard` e `clinic-dashboard`: sem overflow (412/412);
  - `clinic-inventory`: overflow (506/412), ligado a UX-037.
- **Efeito da correção:** corrigir UX-001 zera `meta-viewport` em todas as 8 entradas; UX-002 + UX-003 + UX-004 + UX-019 zeram `button-name`; UX-006 + UX-007 zeram `color-contrast`. Depois de cada correção, as entradas correspondentes do baseline devem ser removidas.
- **UX-060 e o baseline:** UX-060 não tem entrada no baseline (o axe não acusa a falta do controle). Na implementação, o novo botão de senha em `login` não pode criar violação `button-name` nova: se o `aria-label` faltar, o gate de a11y acusa a regressão em `chromium|login` e `mobile-chromium|login`.

### 7.6 Exceções justificadas

| Item | Local | Justificativa |
|------|-------|---------------|
| Falha da coluna "Último acesso" só em `console.error`, células em "—" | `admin/users` (`useLastAccess`) | Decisão aceita pelo usuário e documentada em UC-59 RN-07 (coluna complementar que não pode quebrar a listagem). Não vira achado |
| Projeções de reposição no Dashboard da clínica: toast + texto inline em vez de bloco de erro com "Tentar novamente" | `clinic/dashboard/page.tsx:173-176`, `:461-464` | Erro distinto do vazio, conforme a recomendação UC-52 RNF-04. Falta só o "Tentar novamente" (melhoria, não achado) |
| `/clinic/inventory/audit` (`alert()`/`confirm()` em `:135`, `:144`, `:177`) | `src/app/(clinic)/clinic/inventory/audit/page.tsx` | A ferramenta inteira foi descartada para remoção (`UC-14-RN-05`, mapa §6). Não auditada. A tela ainda existe no código: remoção pendente |
| Rotas órfãs `/clinic/users`, `/clinic/alerts`, `/clinic/settings` | — | Já no mapa §5. Auditadas só por varredura |

---

## 8. Sinalizações para outros agentes

**(a) `uc-issues-tracker`**
- Registrar UX-001 a UX-059 numa nova subseção da Seção 8 do mapa ("8.6 — Achados de UX e Acessibilidade (`ux-reviewer`)"), no formato da 8.2.
- **Novo em 21/10/2026 (v1.1):** registrar **UX-060** (P2, Acessibilidade, "Campos de senha sem opção de mostrar/ocultar") na §8.6 do mapa, com UCs UC-04, UC-06, UC-08, UC-30, UC-37, UC-38, UC-39, UC-40, UC-41. Ligar a **UX-017** (os dois toggles existentes, sem nome acessível) e à **§8.2 divergência 4** (`<input>` cru que recria o `Input` por causa do toggle): a implementação de UX-060 fecha a parte de senha de UX-017 e a divergência 4. Spec: `ONLY_FOR_DEVS/TO_DO/FEAT-toggle-visibilidade-senha.md`.
- Equivalência sugerida, não vinculante: P0→Alta, P1→Média, P2→Baixa.
- Itens que já têm registro e devem ser **ligados**, não duplicados:
  - UX-007 ↔ §8.2 divergência 1;
  - UX-022 ↔ §8.2 divergência 2;
  - UX-031 ↔ `UC-48-RN-03`;
  - UX-048 ↔ UC-36 RNF-03 (só no UC);
  - UX-050 e UX-052 ↔ UC-48 RNF-01 (só no UC);
  - UX-024 ↔ comportamento descrito em UC-23/UC-29/UC-44/UC-54;
  - UX-060 ↔ UX-017 (parte de senha) e §8.2 divergência 4.
- Também vale registrar que `/clinic/inventory/audit` continua no código apesar de `UC-14-RN-05` (Descartado — remover funcionalidade).

**(b) `uml-use-case-writer`**
- **UX-029:** o Dashboard da clínica leva a `/clinic/requests?id=`, que a lista ignora. Não há UC do Dashboard que defina o destino.
- **UX-030 e UX-031:** regras de "Próximos Procedimentos" (inclui `efetuada` passado?) e de limiar e janela de vencimento entre o card e o filtro (UC-50/UC-15) precisam ser documentadas.
- **UX-046:** confirmar se o UC-35 descreve o comportamento quando a leitura de `system_settings/global` falha (hoje o formulário segue editável com valores padrão).
- **UX-041 / UX-053:** confirmar se UC-26/27/54/56 descrevem a falha de carregamento das listas.
- **UX-060:** depois da implementação, os UCs com campo de senha (UC-04, UC-06, UC-08, UC-30, UC-37, UC-38, UC-39, UC-40, UC-41) podem citar o controle de mostrar/ocultar no passo em que o usuário digita a senha. Não é divergência atual entre tela e UC.

**(c) `doc-writer`** — specs de correção sugeridas, em lotes:
1. **P0 "erro como vazio"** (um padrão, várias telas): UX-025, UX-038, UX-047, UX-050, UX-051, UX-053, reaproveitando `useAsyncState`.
2. **P0 isolados:** UX-046 (Configurações: bloquear o salvamento sem leitura) e UX-035 (link para o detalhe do item no estoque).
3. **P1 de acessibilidade com efeito no baseline:** UX-001, UX-002, UX-003, UX-004, UX-019, UX-006, UX-007; e UX-017 + UX-016.
4. **P1 de estado:** UX-026, UX-027, UX-036, UX-040, UX-041, UX-045, UX-049, UX-052.
5. **P1 de mobile:** UX-011 e UX-037.
6. **P1 de comportamento e regra:** UX-029, UX-030, UX-031, UX-023, UX-048, UX-058, UX-028, UX-054, UX-005, UX-008, UX-009, UX-010, UX-012.
7. **P2 UX-060 (`PasswordInput`):** spec já em elaboração em `ONLY_FOR_DEVS/TO_DO/FEAT-toggle-visibilidade-senha.md`. Pontos a cobrir: os 14 campos e os 2 toggles listados no achado; `aria-label` dinâmico, sem `aria-pressed` (decisão D1); `type="button"`; repasse de `autoComplete`; área de toque ≥ 24×24 px; decidir se "Nova senha" e "Confirmar" têm um toggle cada ou um toggle compartilhado (os dois toggles existentes usam um compartilhado).

**(d) `qa-agent` / dev**
- **Incluir em `A11Y_ROUTES`:**
  - `/consultant/dashboard`, `/consultant/clinics` e `/consultant/transfer-requests`. Exigem um consultor semeado **com termos aceitos**: hoje o consultor cai em `/accept-terms`, então é preciso mudar o seed;
  - `/admin/users`, `/admin/tenants`, `/admin/settings` e `/admin/legal-documents` (`systemAdmin` já serve; somente leitura);
  - `/clinic/requests` e `/clinic/protocolos` (`clinicAdminA`);
  - para UX-060: `/admin/profile` (`systemAdmin`) e `/clinic/profile` (`clinicAdminA`), que concentram 6 dos 14 campos de senha.
- **Seed:** para `test-clinic-a`, criar estoque vencido, vencendo em ≤ 7 dias e entre 8 e 30 dias, estoque baixo, solicitações `agendada`/`efetuada` e um protocolo. Isso exercita UX-008, UX-028, UX-035 e a tabela do estoque.
- **Espera da varredura:** em `chromium|clinic-dashboard`, o `readyHeading` fica pronto antes dos dados. Sugestão: aguardar o fim dos skeletons.
- **Caderno de UX-060:** no caderno da feature, verificar que o botão alterna o `type` do campo entre `password` e `text`, que o `aria-label` alterna com o estado (sem `aria-pressed`) e que o clique não envia o formulário.
- **Baseline:** nada a remover nesta rodada; remover as entradas listadas na 7.5 conforme as correções forem entrando.

**(e) Fora do escopo deste agente**
- **`ui-consistency-auditor`:** os tokens `--destructive`, `--input`/`--border` e o fundo `#f5f3ef` (UX-006, UX-007, UX-010) precisam mudar por contraste. Coordenar com §8.2 divergência 1. O `Badge` warning (UX-008) e o tom `sky` do portal do Consultor (UX-009) são decisão de cor com impacto de acessibilidade. O `PasswordInput` de UX-060 resolve a §8.2 divergência 4 (`<input>` cru em `admin/users` e `admin/consultants/[id]`); a posição e o estilo do ícone no campo são decisão visual dele.
- **`security-auditor`:**
  - UX-058: `/dashboard` mostra UID, `tenant_id`, papel e ambiente ("produção") para qualquer usuário autenticado sem papel reconhecido. É exposição de informação interna de baixo risco, mas vale avaliar;
  - UX-046: o salvamento de padrões sobre `system_settings/global` em caso de falha de leitura tem efeito de segurança (pode reabrir o cadastro ou desligar a manutenção);
  - UX-060: mostrar a senha em texto claro é ação do próprio usuário e o padrão é começar oculto. Vale só confirmar que o campo volta a `password` depois do envio e que o valor não vai para log nem para a trilha de auditoria.

## 9. Histórico de Versões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 19/10/2026 | ux-reviewer (via Claude) | Criação, em Modo A + Modo E. Seções 1–6 escritas a partir dos primitivos e das boas práticas do código. Auditoria das 72 telas (16 com leitura completa, as demais por varredura) e runtime com axe-core 4.13.0 em `chromium` e `mobile-chromium` nas 4 rotas de `A11Y_ROUTES` (16 passed, 4 skipped). 59 achados: 8 P0, 32 P1 (2 em `Suspeita (runtime)`) e 19 P2. Baseline: 14 regras-entrada, todas ligadas a achados, nenhuma removível. Os achados do smoke test só de `/clinic/dashboard` foram reconfirmados e renumerados (ver nota na Seção 7) |
| 1.1 | 21/10/2026 | ux-reviewer (via Claude) | Modo B (registro de achado a pedido do usuário), só análise estática, sem runtime. Novo achado **UX-060** (P2, Acessibilidade): 14 campos `type="password"` em 7 arquivos sem opção de mostrar/ocultar e 2 toggles feitos à mão sem nome acessível; recomendação de um `PasswordInput` reutilizável (spec `ONLY_FOR_DEVS/TO_DO/FEAT-toggle-visibilidade-senha.md`). Cross-link com UX-017 (parte de senha) e com o mapa §8.2 divergência 4. Seção 3.1 ganha a regra "Campos de senha"; Seções 3.2, 4 e 6 citam o caso. Seção 7: linha nova na tabela Transversal, resumo atualizado (60 achados; 20 P2; Acessibilidade 25), matriz UC × IDs com UC-38, UC-39, UC-40 e UC-41 em linhas próprias (UC-49 separado), 7.4 e 7.5 atualizadas. Seção 8: sinalizações de UX-060 para `uc-issues-tracker`, `uml-use-case-writer`, `doc-writer`, `qa-agent`, `ui-consistency-auditor` e `security-auditor` |
