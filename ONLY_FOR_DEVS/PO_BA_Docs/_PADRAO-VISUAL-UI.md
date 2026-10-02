# Padrão Visual de UI — Curva Mestra

**Projeto:** Curva Mestra
**Data de Criação:** 01/10/2026
**Última Atualização:** 01/10/2026
**Autor:** ui-consistency-auditor (via Claude)
**Base técnica:** shadcn/ui (estilo `new-york`, Tailwind + CSS variables — `components.json`)
**Versão:** 1.0

> Este documento registra o padrão visual já dominante no sistema (não um padrão novo inventado
> para esta auditoria) e serve de referência para toda tela nova ou revisão de tela existente.
> A Seção 6 lista os desvios encontrados na auditoria mais recente — ver histórico de versões.

---

## 1. Fonte de verdade

Os primitivos em `src/components/ui/*.tsx` e os tokens de tema em `src/app/globals.css` /
`tailwind.config.ts` são a fonte de verdade técnica. Este documento descreve **como usá-los
consistentemente**, não os redefine.

Tokens relevantes definidos em `src/app/globals.css` (`:root` / `.dark`) e mapeados em
`tailwind.config.ts`: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`,
`muted`, `accent`, `destructive`, `border`, `input`, `ring`. `--radius: 0.5rem` alimenta a escala
`rounded-lg` (`var(--radius)`), `rounded-md` (`var(--radius) - 2px`) e `rounded-sm`
(`var(--radius) - 4px`).

O sistema **não possui** tokens semânticos de "sucesso"/"aviso"/"info" no tema (`globals.css`/
`tailwind.config.ts`) — apenas `destructive` tem token próprio. `badge.tsx` e `alert.tsx` já
compensam isso parcialmente com variantes `warning`/`success` cravadas em cores Tailwind puras
(`yellow-500`, `green-500`), não em CSS variables. Isso é relevante para a Seção 4.4 e para o
achado mais recorrente da auditoria (Seção 6).

## 2. Bordas e Raio

Três convenções distintas coexistem de forma consistente nos primitivos, e a amostragem em
`src/app/**/page.tsx` confirma que as telas seguem a mesma divisão:

- **`rounded-lg`** — contêineres de nível de bloco: `Card` (`card.tsx:8`), `Alert` (`alert.tsx:7`),
  `DialogContent` (`dialog.tsx:40`, como `sm:rounded-lg`), `TabsList` (`tabs.tsx:17`). Nas telas,
  blocos "card-like" feitos à mão também usam `rounded-lg` (ex.: linhas de resumo em
  `src/app/(clinic)/clinic/dashboard/page.tsx:401,415,429`, dropdown de produto em
  `src/app/(clinic)/clinic/add-products/page.tsx:956,973,1019`).
- **`rounded-md`** — controles interativos: `Button` (`button.tsx:6`), `Input` (`input.tsx:12`),
  `SelectTrigger`/`SelectContent` (`select.tsx:21,70`), `Badge` (`badge.tsx:7`), `TabsTrigger`
  (`tabs.tsx:32`). É também o valor mais usado nas telas para esse mesmo papel (ex.:
  `src/app/(admin)/admin/products/page.tsx:219`, `src/app/(admin)/admin/profile/page.tsx:159`).
- **`rounded-full`** — convenção adicional, não documentada nos primitivos, mas universalmente
  aplicada e consistente para avatares, bolhas de ícone e indicadores de etapa/status circulares
  (ex.: `src/app/(auth)/login/page.tsx:182`, `src/app/(clinic)/clinic/setup/page.tsx:318-388`,
  `src/app/(consultant)/consultant/profile/page.tsx:58,107`). Tratado como categoria própria, não
  como desvio da escala `lg`/`md`.

**Recomendação:** manter a divisão `rounded-lg` (contêiner) / `rounded-md` (controle) /
`rounded-full` (circular) tal como já praticada — é a regra real, não apenas a dos primitivos.

**Desvio observado (itens de navegação nos layouts compartilhados):** `AdminLayout.tsx:137` e
`ConsultantLayout.tsx:107` usam `rounded-lg` para linhas de navegação da sidebar (que funcionam
como controles clicáveis), enquanto o menu mobile de `ClinicLayout.tsx:109` usa `rounded-md` para
o mesmo papel. Como são apenas 3 arquivos de layout (não páginas), e cada portal é internamente
consistente, isto é registrado como observação de bordas entre portais, não como pendência por
tela.

## 3. Tipografia

- **Título de página (`<h1>`):** `text-3xl font-bold tracking-tight` é o padrão dominante — 32 das
  36 ocorrências de `<h1>` em `page.tsx` usam exatamente essa combinação (frequentemente com
  `flex items-center gap-2` quando há ícone ao lado do texto). Exemplos:
  `src/app/(admin)/admin/tenants/page.tsx:81`, `src/app/(clinic)/clinic/protocolos/page.tsx:71`,
  `src/app/(consultant)/consultant/dashboard/page.tsx:132`.
- **Título de card — três sub-convenções conforme o papel do card, todas consistentes:**
  - Card de métrica/KPI (grid de indicadores no topo de dashboards): `text-sm font-medium` —
    confirmado em 7+ arquivos: `src/app/(admin)/admin/dashboard/page.tsx:151,162,178,189`,
    `src/app/(admin)/admin/users/page.tsx:439-474`, `src/app/(consultant)/consultant/dashboard/page.tsx:168-199`.
  - Card de seção/detalhe com ícone: sem override de tamanho, apenas `flex items-center gap-2`
    (herda `text-2xl font-semibold` do primitivo `CardTitle` — `card.tsx:26`). Dominante em telas
    de detalhe/perfil/formulário: `src/app/(admin)/admin/profile/page.tsx:123,181`,
    `src/app/(admin)/admin/tenants/new/page.tsx:275,468,538`.
  - Card "lista/tabela dentro de um container": `text-lg` — convenção secundária, mas recorrente e
    deliberada (não um desvio disperso): `src/app/(admin)/admin/tenants/page.tsx:98`,
    `src/app/(admin)/admin/consultants/page.tsx:187`, `src/app/(clinic)/clinic/protocolos/page.tsx:115`,
    `src/app/(consultant)/consultant/reports/page.tsx:103,114,125`.
  - Card de autenticação (`(auth)/*`): `text-2xl text-center` (ex.:
    `src/app/(auth)/login/page.tsx:186,226`, `src/app/(auth)/forgot-password/page.tsx:83`).
- **Texto de apoio:** `text-sm text-muted-foreground`, herdado de `CardDescription`
  (`card.tsx:37`) sem overrides relevantes encontrados — ponto de conformidade alta.
- **Label de formulário:** herdado de `Label` (`label.tsx:10`): `text-sm font-medium`, sem desvios
  encontrados.

**Desvios confirmados:**
1. `src/app/(admin)/admin/dashboard/page.tsx:143` e `src/app/(clinic)/clinic/dashboard/page.tsx:285`
   usam `<h2 className="text-3xl font-bold tracking-tight">` para o título principal da tela, em
   vez do `<h1>` usado em todas as outras 36 telas com título. São exatamente as duas telas mais
   visitadas do sistema (dashboards de admin e clínica).
2. `src/app/(admin)/admin/email-templates/[tipo]/page.tsx:259` usa `<h1 className="text-2xl font-bold">`
   — um nível abaixo do `text-3xl` padrão.
3. `src/app/(clinic)/clinic/dashboard/page.tsx` mistura, na mesma tela, `CardTitle` com
   `text-base` (linhas 304, 348, 388, 450) e `CardTitle` sem override — ou seja, `text-2xl`
   herdado (linhas 496, 560, 627) para cards de papel semântico equivalente (blocos de conteúdo
   da dashboard).

## 4. Componentes de Interação

### 4.1 Botões

- Padrão dominante: componente `<Button>` com `variant="outline"` para ações secundárias
  (atualizar, cancelar), `variant="destructive"` para exclusão/reprovação,
  `variant="ghost"` para navegação/ícone-only/toggles de sidebar, e `variant` omitido
  (= `default`) para a ação primária de submit. Essa divisão é consistente em todo o admin,
  clínica e consultor (ex.: `src/app/(admin)/admin/access-requests/page.tsx:358,361`,
  `src/app/(clinic)/clinic/access-requests/page.tsx:335,338`).
- Tamanho: `size` default na maioria dos botões de ação de página; `size="sm"` em botões dentro de
  cabeçalhos compactos (ex.: `ClinicLayout.tsx:84`).

**Desvios confirmados — `<button>` HTML puro em vez de `<Button>`:**
- `src/app/(clinic)/clinic/dashboard/page.tsx:399,413,427` — três linhas de KPI clicáveis
  (navegam para `/clinic/inventory?filter=...`) implementadas como `<button>` com classes manuais
  (`w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 ...`) em vez de
  `<Button variant="ghost" className="w-full justify-between">`.
- `src/app/(auth)/register/page.tsx:198,314` — controles segmentados de seleção de papel/volume
  (toggle de estado ativo/inativo) implementados como `<button type="button">` com estilo próprio,
  sem usar `Button`/`variant`.
- `src/app/(admin)/admin/users/page.tsx:764` e `src/app/(admin)/admin/consultants/[id]/page.tsx:497`
  — ícone de mostrar/ocultar senha, absoluto dentro do campo, como `<button type="button">`.

**Exceção justificada:**
- `src/app/(clinic)/clinic/add-products/page.tsx:719` — item de sugestão dentro de um dropdown de
  autocomplete próprio. Não existe primitivo `Command`/`Combobox` em `src/components/ui/`, então
  não há alternativa pronta no design system para esse caso; listado para transparência, não como
  pendência.

### 4.2 Inputs e Busca

- Padrão de input isolado: componente `<Input>` (94 ocorrências em 27 arquivos) — amplamente
  dominante.
- Padrão de barra de pesquisa: `<div className="relative"><Search className="absolute ... text-muted-foreground" /><Input placeholder="Buscar por ..." .../></div>`,
  confirmado em `src/app/(admin)/admin/tenants/page.tsx:103-107`,
  `src/app/(admin)/admin/products/page.tsx:174-178`, `src/app/(clinic)/clinic/requests/page.tsx:222-226`,
  `src/app/(consultant)/consultant/clinics/page.tsx:92-96`. Pequena variação cosmética nas classes
  de posicionamento do ícone: `left-3 top-1/2 -translate-y-1/2` é majoritário; já
  `src/app/(admin)/admin/users/page.tsx:493` usa `left-2 top-2.5`, isoladamente.

**Desvio confirmado:**
- `src/app/(admin)/admin/users/page.tsx:762,786` e `src/app/(admin)/admin/consultants/[id]/page.tsx:495,519`
  reimplementam à mão, em um `<input>` puro, exatamente as classes visuais do primitivo `Input`
  (`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ...`)
  em vez de `<Input className="pr-10" />`, aparentemente para acomodar o ícone de
  mostrar/ocultar senha. Duplica a definição visual do primitivo em 4 lugares.

### 4.3 Cards e Containers

- `<Card>` é o padrão amplamente dominante: 170 ocorrências em 54 dos 70 arquivos `page.tsx`.
- Uso de `div` com `border`/`shadow` manual fora do componente `Card` é raro e concentrado em dois
  casos específicos (ver Exceção abaixo), não um padrão difuso de reimplementação.

**Exceção justificada:**
- `src/app/(clinic)/clinic/add-products/page.tsx:717,749` — container de dropdown de autocomplete
  (`bg-popover border rounded-md shadow-md`) feito à mão, pela mesma razão da Seção 4.1 (ausência
  de primitivo `Popover`/`Command`).

### 4.4 Badges e Status

- Variantes disponíveis em `badge.tsx`: `default`, `secondary`, `destructive`, `warning`
  (`bg-yellow-500`), `outline`. **Não existe variante `success`** — lacuna real do primitivo frente
  aos status do domínio (`'aprovada'`, `'ativa'`, `'success'` listados na Seção 6 do
  `CLAUDE.md` do projeto).

**Desvio confirmado:**
- `src/app/(consultant)/consultant/transfer-requests/page.tsx:114` e
  `src/app/(admin)/admin/consultant-pendencies/page.tsx:72` usam
  `<Badge variant="outline" className="bg-amber-100 text-amber-800">` para status pendente, em vez
  de uma variante formal.
- `src/app/(admin)/admin/users/page.tsx:193` usa `<Badge className="text-xs bg-sky-600 hover:bg-sky-700">`
  para o badge de papel "Consultor", também fora do sistema de variantes.

Essas 3 ocorrências são sintoma direto da lacuna de variantes `success`/`info` no primitivo — ver
recomendação na Seção 6 (resumo de impacto).

## 5. Espaçamento de Página

- Padrão dominante (≈56 dos 70 arquivos): wrapper externo `<div className="container py-8">` com
  wrapper interno `<div className="space-y-6">`, acrescido de `max-w-*` quando a tela é um
  formulário estreito (`max-w-lg`/`max-w-2xl`/`max-w-3xl`/`max-w-4xl`, conforme o caso). Confirmado
  em `src/app/(admin)/admin/tenants/page.tsx:76-77`, `src/app/(admin)/admin/products/new/page.tsx:100-101`,
  `src/app/(clinic)/clinic/requests/page.tsx:125-126`, `src/app/(consultant)/consultant/clinics/page.tsx:69-70`,
  entre muitos outros.
- `src/app/(clinic)/clinic/profile/page.tsx:181` e `src/app/(clinic)/clinic/inventory/audit/page.tsx:201`
  usam `<main className="container max-w-*  py-8">` em vez de `<div>` — variação sintática
  equivalente, sem impacto visual.

**Desvios confirmados:**
1. Cluster de 5 telas do Admin usa `<div className="p-6 space-y-6">` **sem** a classe `container`:
   `src/app/(admin)/admin/settings/page.tsx:115`, `src/app/(admin)/admin/email-templates/page.tsx:78`,
   `src/app/(admin)/admin/email-templates/[tipo]/page.tsx:252`,
   `src/app/(admin)/admin/legal-documents/page.tsx:134`,
   `src/app/(admin)/admin/legal-documents/[id]/page.tsx:79`. Sem `container`, o conteúdo não fica
   centralizado/com largura máxima responsiva como no resto do Admin — todas essas 5 telas são do
   tipo "configuração"/"documento", sugerindo uma convenção paralela não-intencional surgida nessas
   telas especificamente.
2. `src/app/(clinic)/clinic/my-clinic/page.tsx:60` usa `<div className="container mx-auto p-6 max-w-7xl">`
   — combina `container` (que já centraliza) com `mx-auto` redundante, troca `py-8` por `p-6`, e usa
   `max-w-7xl`, bem mais largo que o `max-w-2xl`/`max-w-3xl` do resto das telas de clínica.
3. `admin/dashboard/page.tsx:140` e `clinic/dashboard/page.tsx:282` usam `space-y-8` no wrapper
   interno em vez do `space-y-6` universal — consistente entre si, mas divergente do restante do
   sistema.

### Fundo de tela (observação transversal, fora da Seção B.2 original, mas de alto impacto)

`src/components/admin/AdminLayout.tsx:107,201` e `src/components/consultant/ConsultantLayout.tsx:60,170`
usam `bg-[#f5f3ef]` — um hex cru, repetido 4 vezes entre os dois arquivos — como fundo principal do
shell de Admin e de Consultor. `src/components/clinic/ClinicLayout.tsx:46` usa o token de tema
`bg-background` (branco puro, conforme `--background: 0 0% 100%` em `globals.css:7`). Isso significa:
(a) Admin e Consultor têm um fundo visualmente diferente do de Clínica, sem relação com o token de
tema; (b) o mesmo valor hex está hardcoded de forma independente em 2 arquivos (e novamente em
`src/app/(auth)/accept-terms/page.tsx:161,168`), sem variável CSS — qualquer mudança de marca exige
editar 3 arquivos manualmente e torna o valor invisível ao dark mode (`globals.css` não define
`--background` alternativo para esse tom). Não é uma regra de "Seção 5" propriamente, mas afeta
todas as telas de dois dos quatro portais do sistema — por isso reportado aqui com destaque.

## 6. Auditoria — Telas Avaliadas

**Última auditoria:** 01/10/2026 — 70 telas avaliadas, 13 arquivos `page.tsx` com divergência
confirmada (mais 2 componentes de layout compartilhado e 1 observação transversal de fundo de
tela, detalhados abaixo da tabela).

### Admin (23 telas)

| Tela | Status | Divergências |
|---|---|---|
| `src/app/(admin)/admin/access-requests/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/audit-log/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/consultant-pendencies/page.tsx` | ⚠️ Divergências | Badge com classe `bg-amber-100` hand-rolled (L72) |
| `src/app/(admin)/admin/consultants/[id]/page.tsx` | ⚠️ Divergências | `<input>` reimplementando `Input` (L495,519); `<button>` de toggle de senha (L497) |
| `src/app/(admin)/admin/consultants/new/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/consultants/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/dashboard/page.tsx` | ⚠️ Divergências | Título em `<h2>` em vez de `<h1>` (L143); `space-y-8` em vez de `space-y-6` (L140) |
| `src/app/(admin)/admin/email-templates/[tipo]/page.tsx` | ⚠️ Divergências | Wrapper `p-6 space-y-6` sem `container` (L252); `<h1>` em `text-2xl` em vez de `text-3xl` (L259) |
| `src/app/(admin)/admin/email-templates/page.tsx` | ⚠️ Divergências | Wrapper `p-6 space-y-6` sem `container` (L78) |
| `src/app/(admin)/admin/legal-documents/[id]/edit/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/legal-documents/[id]/page.tsx` | ⚠️ Divergências | Wrapper `p-6 space-y-6` sem `container` (L79) |
| `src/app/(admin)/admin/legal-documents/new/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/legal-documents/page.tsx` | ⚠️ Divergências | Wrapper `p-6 space-y-6` sem `container` (L134) |
| `src/app/(admin)/admin/pending-products/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/products/[id]/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/products/new/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/products/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/profile/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/settings/page.tsx` | ⚠️ Divergências | Wrapper `p-6 space-y-6` sem `container` (L115) |
| `src/app/(admin)/admin/tenants/[id]/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/tenants/new/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/tenants/page.tsx` | ✅ Conforme | - |
| `src/app/(admin)/admin/users/page.tsx` | ⚠️ Divergências | `<input>` reimplementando `Input` (L762,786); `<button>` de toggle de senha (L764); Badge `bg-sky-600` hand-rolled (L193); ícone de busca em posição isolada `left-2`/`top-2.5` (L493) |

### Clínica (29 telas)

| Tela | Status | Divergências |
|---|---|---|
| `src/app/(clinic)/clinic/access-requests/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/add-products/page.tsx` | ✅ Conforme (com exceção) | `<button>`/div manual no autocomplete (L719,717,749) — exceção justificada, sem primitivo Command/Popover |
| `src/app/(clinic)/clinic/alerts/page.tsx` | — Não avaliável diretamente | Delega 100% a `@/components/clinic/AlertsTab` (fora de `src/app`) |
| `src/app/(clinic)/clinic/audit-log/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/consultant/invite/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/consultant/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/dashboard/page.tsx` | ⚠️ Divergências | Título em `<h2>` em vez de `<h1>` (L285); `space-y-8` (L282); `<button>` em 3 linhas de KPI (L399,413,427); `CardTitle` mistura `text-base`/padrão no mesmo papel (L304-627) |
| `src/app/(clinic)/clinic/inventory/[id]/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/inventory/audit/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/inventory/page.tsx` | — Não avaliável diretamente | Delega a `@/components/inventory/InventoryView` |
| `src/app/(clinic)/clinic/inventory/projections/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/my-clinic/page.tsx` | ⚠️ Divergências | Wrapper híbrido `container mx-auto p-6 max-w-7xl` (L60) |
| `src/app/(clinic)/clinic/profile/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/protocolos/[id]/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/protocolos/novo/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/protocolos/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/reports/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/requests/new/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/requests/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/settings/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/setup/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/setup/terms/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/upload/page.tsx` | ✅ Conforme | - |
| `src/app/(clinic)/clinic/users/page.tsx` | ✅ Conforme | - |

### Consultor (9 telas)

| Tela | Status | Divergências |
|---|---|---|
| `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/clinics/[tenantId]/projections/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/clinics/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/clinics/search/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/dashboard/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/profile/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/reports/page.tsx` | ✅ Conforme | - |
| `src/app/(consultant)/consultant/transfer-requests/page.tsx` | ⚠️ Divergências | Badge com classe `bg-amber-100` hand-rolled (L114) |

### Auth / Outros (9 telas)

| Tela | Status | Divergências |
|---|---|---|
| `src/app/(auth)/accept-terms/page.tsx` | ⚠️ Divergências | `bg-[#f5f3ef]` hardcoded (L161,168) — ver observação transversal abaixo da Seção 5 |
| `src/app/(auth)/change-password/page.tsx` | ✅ Conforme | - |
| `src/app/(auth)/forgot-password/page.tsx` | ✅ Conforme | - |
| `src/app/(auth)/login/page.tsx` | ✅ Conforme | - |
| `src/app/(auth)/register/page.tsx` | ⚠️ Divergências | `<button>` em 2 controles segmentados (L198,314) |
| `src/app/(auth)/reset-password/[token]/page.tsx` | ✅ Conforme | - |
| `src/app/(auth)/waiting-approval/page.tsx` | ✅ Conforme | - |
| `src/app/dashboard/page.tsx` | — Fora de escopo de produto | Tela de debug (`Dashboard de Debug`), não é tela de usuário final |
| `src/app/debug/page.tsx` | — Fora de escopo de produto | Tela de debug de config. Firebase, não é tela de usuário final |
| `src/app/maintenance/page.tsx` | ✅ Conforme | - |
| `src/app/suspended/admin/page.tsx` | ✅ Conforme | - |
| `src/app/suspended/user/page.tsx` | ✅ Conforme | - |

> Nota de contagem: a tabela acima lista 70 arquivos `page.tsx` agrupados por portal. `dashboard`
> e `debug` na raiz de `src/app` foram avaliados mas marcados como fora do escopo de produto
> (ferramentas internas de diagnóstico, não telas que um tenant acessa).

### Layouts compartilhados (fora da contagem de 70 — afetam múltiplas telas por herança)

| Componente | Status | Divergências |
|---|---|---|
| `src/components/admin/AdminLayout.tsx` | ⚠️ Divergência | `bg-[#f5f3ef]` hardcoded no shell (L107,201) |
| `src/components/consultant/ConsultantLayout.tsx` | ⚠️ Divergência | `bg-[#f5f3ef]` hardcoded no shell (L60,170); raio `rounded-lg` em item de nav (L107) difere do `rounded-md` do menu mobile da Clínica |
| `src/components/clinic/ClinicLayout.tsx` | ✅ Conforme | Usa `bg-background` (token) |

### Resumo de divergências por dimensão

| Dimensão | Telas afetadas | Exemplo mais representativo |
|---|---|---|
| Bordas/raio | 2 (layouts, não páginas) | `AdminLayout.tsx:137` (`rounded-lg` em nav) |
| Tipografia | 4 | `admin/dashboard/page.tsx:143` (`<h2>` em vez de `<h1>`) |
| Botões | 4 | `clinic/dashboard/page.tsx:399` (`<button>` em vez de `Button`) |
| Inputs/busca | 2 | `admin/users/page.tsx:762` (`<input>` reimplementando `Input`) |
| Cards/containers | 0 confirmadas (1 exceção justificada) | `clinic/add-products/page.tsx:717` (exceção) |
| Espaçamento de página | 7 | `admin/settings/page.tsx:115` (`p-6` sem `container`) |
| Cores hardcoded / fora do token | 5 (+ 2 layouts) | `AdminLayout.tsx:107` / `ConsultantLayout.tsx:60` (`bg-[#f5f3ef]`) |
| Badges fora do sistema de variantes | 3 | `admin/users/page.tsx:193` (`bg-sky-600` hand-rolled) |

## 7. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 01/10/2026 | ui-consistency-auditor | Elaboração inicial do padrão + primeira auditoria completa (70 telas, 13 arquivos `page.tsx` com divergência confirmada, mais 2 layouts compartilhados e 1 observação transversal de fundo de tela). |
