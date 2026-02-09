# Documentação Experimental - Minha Clínica

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página de gerenciamento da clínica organizada em abas (tabs). Permite ao `clinic_admin` gerenciar licença, usuários e configurar alertas. Usuários com role `clinic_user` possuem acesso restrito apenas à aba de Licença.

- **Arquivo**: `src/app/(clinic)/clinic/my-clinic/page.tsx`
- **Rota**: `/clinic/my-clinic`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `MyClinicPage`
- **Dependências principais**:
  - `useAuth` (hook de autenticação com claims)
  - `useRouter`, `useSearchParams` (Next.js navigation)
  - `next/dynamic` (carregamento dinâmico de componentes)
  - Componentes Shadcn/ui: `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - Ícones Lucide: `Users`, `Shield`, `Bell`
  - Componentes dinâmicos: `UsersTab`, `LicenseTab`, `AlertsTab`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Vê 3 abas: Licença, Usuários, Alertas |
| `clinic_user` | Parcial | Vê apenas 1 aba: Licença. Se tentar acessar abas restritas via URL, é redirecionado para Licença |
| `clinic_consultant` | Parcial | Mesmo comportamento de clinic_user (sem verificação explícita) |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

---

## 3. Estrutura de Dados

### 3.1 Estado do Componente (useState)

```typescript
const isAdmin = claims?.role === "clinic_admin";
const defaultTab = searchParams.get("tab") || "license";
const [activeTab, setActiveTab] = useState(defaultTab);
```

### 3.2 Abas Disponíveis

| Aba | Valor URL | Componente | Ícone | Acesso |
|-----|-----------|------------|-------|--------|
| Licença | `?tab=license` | `LicenseTab` | `Shield` | Todos |
| Usuários | `?tab=users` | `UsersTab` | `Users` | Apenas admin |
| Alertas | `?tab=alerts` | `AlertsTab` | `Bell` | Apenas admin |

### 3.3 Componentes Dinâmicos

Cada aba é carregada via `next/dynamic` com `ssr: false`:

```typescript
const UsersTab = dynamic(() => import("@/components/clinic/UsersTab"), {
  ssr: false,
  loading: () => <div className="p-8 text-center">Carregando...</div>,
});
```

Componentes carregados:
- `@/components/clinic/UsersTab` — gerenciamento de usuários
- `@/components/clinic/LicenseTab` — informações de licença
- `@/components/clinic/AlertsTab` — configuração de alertas

---

## 4. Casos de Uso

### UC-001: Visualizar informações de licença

- **Ator**: clinic_admin, clinic_user
- **Pré-condição**: Usuário autenticado
- **Fluxo**:
  1. Usuário acessa `/clinic/my-clinic` (aba padrão "license")
  2. Componente `LicenseTab` é carregado dinamicamente
  3. Informações da licença são exibidas
- **Pós-condição**: Dados da licença visíveis

### UC-002: Gerenciar usuários da clínica

- **Ator**: clinic_admin
- **Fluxo**:
  1. Admin clica na aba "Usuários" ou acessa `?tab=users`
  2. URL atualizada via `pushState`
  3. Componente `UsersTab` carregado dinamicamente
- **Pós-condição**: Interface de gerenciamento de usuários exibida

### UC-003: Configurar alertas de estoque e vencimento

- **Ator**: clinic_admin
- **Fluxo**:
  1. Admin clica na aba "Alertas" ou acessa `?tab=alerts`
  2. URL atualizada via `pushState`
  3. Componente `AlertsTab` carregado dinamicamente
- **Pós-condição**: Interface de configuração de alertas exibida

### UC-004: Navegar entre abas via URL

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário acessa diretamente `/clinic/my-clinic?tab=users`
  2. `useEffect` sincroniza `activeTab` com query param `tab`
  3. Se não-admin tentando acessar aba restrita: redireciona para "license"
  4. Botões voltar/avançar do browser sincronizam via `useEffect` + `searchParams`
- **Pós-condição**: Aba correta exibida conforme URL e permissão

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/my-clinic        │
│ (?tab=license|users|alerts)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ searchParams.get("tab")  │
│ || "license"             │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ É clinic_admin?│
    └───────┬───────┘
        Sim │        Não
            │         │
            ▼         ▼
     3 abas visíveis  1 aba visível
     (grid-cols-3)    (grid-cols-1)
            │         │
            │    ┌────┴────┐
            │    │Tab=users│  → Força "license"
            │    │ou alerts│
            │    └─────────┘
            │
            ▼
     ┌──────┴──────┐
     │ Clique em   │
     │ TabsTrigger │
     └──────┬──────┘
            │
            ▼
  handleTabChange(value)
  ├── setActiveTab(value)
  └── pushState(?tab=value)
            │
            ▼
  Dynamic import do
  componente da aba
  (fallback: "Carregando...")
```

---

## 6. Regras de Negócio

### RN-001: Aba padrão é "license"

- **Descrição**: Se não houver parâmetro `tab` na URL, a aba de Licença é exibida
- **Aplicação**: `searchParams.get("tab") || "license"`
- **Exceções**: Nenhuma
- **Justificativa**: Licença é a aba acessível por todos os roles

### RN-002: Abas restritas ocultas para não-admins

- **Descrição**: Usuários com role diferente de `clinic_admin` só veem a aba "Licença"
- **Aplicação**: `{isAdmin && (<TabsTrigger>...)}` — abas Usuários e Alertas condicionalmente renderizadas
- **Exceções**: Nenhuma
- **Justificativa**: Controle de acesso visual

### RN-003: Proteção contra acesso via URL

- **Descrição**: Se um não-admin tentar acessar aba restrita via URL (`?tab=users` ou `?tab=alerts`), é redirecionado para "license"
- **Aplicação**: `useEffect` que verifica `!isAdmin && (activeTab === "users" || activeTab === "alerts")`
- **Exceções**: Nenhuma
- **Justificativa**: Segurança — impedir bypass visual via URL

### RN-004: URL atualizada sem reload

- **Descrição**: Ao trocar de aba, a URL é atualizada com `window.history.pushState` em vez de `router.push`
- **Aplicação**: `handleTabChange` cria `new URL(window.location.href)` e usa `pushState`
- **Exceções**: Nenhuma
- **Justificativa**: Evitar reload da página ao navegar entre abas

### RN-005: Sincronização bidirecional URL ↔ Aba

- **Descrição**: A aba ativa sincroniza com o parâmetro `tab` da URL em ambas direções
- **Aplicação**: `useEffect` monitora `searchParams` e atualiza `activeTab`; `handleTabChange` atualiza URL
- **Exceções**: Nenhuma
- **Justificativa**: Suporte a navegação pelo histórico do browser (botões voltar/avançar)

### RN-006: Grid adaptivo

- **Descrição**: O `TabsList` usa grid de 3 colunas para admin e 1 coluna para não-admin
- **Aplicação**: `className={grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'}}`
- **Exceções**: Nenhuma
- **Justificativa**: Layout adequado ao número de abas visíveis

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Admin — 3 abas | Grid 3 colunas: Licença, Usuários, Alertas | TabsList com `grid-cols-3` |
| Não-admin — 1 aba | Grid 1 coluna: apenas Licença | TabsList com `grid-cols-1` |
| Carregando aba | Texto "Carregando..." centralizado | Fallback do `next/dynamic` |
| Aba ativa | Conteúdo da aba renderizado abaixo do TabsList | TabsContent visível |
| Troca de aba | URL atualizada, conteúdo muda sem reload | pushState + rerender |

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| Role do usuário | `claims?.role === "clinic_admin"` | Controla visibilidade das abas |
| Aba restrita via URL | `!isAdmin && (tab === "users" \|\| tab === "alerts")` | Força `activeTab = "license"` |
| Tab param inválido | Sem verificação explícita | Shadcn Tabs ignora valores não-registrados |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims.role` |
| Next.js Dynamic | Carregamento | `next/dynamic` com `ssr: false` para cada aba |
| Next.js useSearchParams | URL | Leitura do query param `tab` |
| Browser History | URL | `window.history.pushState` para atualizar URL sem reload |
| `LicenseTab` | Componente | Gerenciamento de licença da clínica |
| `UsersTab` | Componente | Gerenciamento de usuários |
| `AlertsTab` | Componente | Configuração de alertas |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Autorização (visual) | Abas restritas não são renderizadas para não-admins |
| Autorização (URL) | `useEffect` redireciona para "license" se não-admin acessa tab restrita |
| Multi-tenant | Delegado aos componentes filhos (LicenseTab, UsersTab, AlertsTab) |
| Firestore RLS | Delegado aos componentes filhos |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Carregamento dinâmico | `next/dynamic` com `ssr: false` — cada aba carregada apenas quando necessário |
| Sem SSR | `ssr: false` evita renderização no servidor (componentes usam APIs do browser) |
| Fallback de loading | Texto "Carregando..." enquanto componente é carregado |
| URL sem reload | `pushState` em vez de `router.push` — não recarrega a página |
| Componentes cacheados | Após primeiro carregamento, componente fica em memória |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Tabs semânticas | Sim | Componente Shadcn `Tabs` com roles ARIA corretos |
| Ícones nas abas | Sim | Ícones + texto label — acessível |
| Navegação por teclado | Sim | Shadcn Tabs suporta Arrow keys nativamente |
| Fallback de carregamento | Parcial | Texto "Carregando..." sem role="status" |
| Grid adaptivo | Sim | Layout ajusta ao número de abas visíveis |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Acesso como admin | E2E | Verificar 3 abas visíveis (Licença, Usuários, Alertas) |
| Acesso como clinic_user | E2E | Verificar apenas 1 aba visível (Licença) |
| Navegação por URL | E2E | Acessar `?tab=users` como admin e verificar aba correta |
| Proteção de URL | E2E | Acessar `?tab=users` como clinic_user e verificar redirect para license |
| Troca de aba | E2E | Clicar em aba e verificar URL atualizada |
| Botão voltar do browser | E2E | Trocar aba, clicar voltar, verificar aba anterior restaurada |
| Carregamento dinâmico | E2E | Verificar que "Carregando..." aparece antes do componente |
| Aba padrão | E2E | Acessar sem `?tab=` e verificar que Licença é selecionada |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Breadcrumb | Baixa | Adicionar navegação por breadcrumb |
| Skeleton loading | Baixa | Substituir "Carregando..." por skeleton UI |
| Suspense | Baixa | Migrar de `next/dynamic` para React Suspense nativo |
| Prefetch de abas | Baixa | Pré-carregar componentes de abas adjacentes |

---

## 15. Dependências e Relacionamentos

```
my-clinic (este doc)
├── useAuth (hook) — role e autenticação
├── useSearchParams — query param ?tab=
├── window.history.pushState — atualização de URL
├── next/dynamic — carregamento dinâmico
│   ├── LicenseTab — gerenciamento de licença
│   ├── UsersTab — gerenciamento de usuários (admin only)
│   └── AlertsTab — configuração de alertas (admin only)
└── Shadcn Tabs — componente de abas
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| Dashboard | Navegação principal da clínica |
| Licença | Conteúdo da aba Licença |
| Usuários | Conteúdo da aba Usuários |
| Configurações (Alertas) | Conteúdo da aba Alertas |

---

## 16. Observações Técnicas

- Os componentes `UsersTab`, `LicenseTab` e `AlertsTab` são carregados dinamicamente via `next/dynamic` com `ssr: false`. Isso evita renderização no servidor e permite uso de APIs do browser.
- A sincronização da URL com a aba ativa usa `window.history.pushState` ao invés de `router.push`, evitando reload da página.
- O componente monitora mudanças em `searchParams` via `useEffect` para reagir a navegação pelo histórico do browser (botões voltar/avançar).
- O `router` é importado de `next/navigation` mas não é utilizado diretamente — apenas `useSearchParams` é usado.
- O título da página é "Minha Clínica" com subtítulo descritivo.
- O container usa `max-w-7xl` diferente das demais páginas que usam apenas `container`.
- A condição de admin não verifica `clinic_consultant` explicitamente — qualquer role diferente de `clinic_admin` vê apenas a aba Licença.

---

## 17. Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 07/02/2026 | 1.0 | Documentação inicial (formato antigo) |
| 09/02/2026 | 2.0 | Padronização para template de 20 seções |

---

## 18. Glossário

| Termo | Descrição |
|-------|-----------|
| `claims` | Custom Claims do Firebase Auth com role e tenant_id |
| `isAdmin` | Booleano derivado de `claims?.role === "clinic_admin"` |
| `activeTab` | Estado que controla a aba ativa ("license", "users", "alerts") |
| `pushState` | Método do browser para atualizar URL sem reload |
| `next/dynamic` | Função do Next.js para carregamento dinâmico com code-splitting |
| `ssr: false` | Opção que desabilita Server-Side Rendering para o componente |
| `LicenseTab` | Componente dinâmico de gerenciamento de licença |
| `UsersTab` | Componente dinâmico de gerenciamento de usuários |
| `AlertsTab` | Componente dinâmico de configuração de alertas |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/my-clinic/page.tsx`
- Componentes:
  - `src/components/clinic/LicenseTab.tsx`
  - `src/components/clinic/UsersTab.tsx`
  - `src/components/clinic/AlertsTab.tsx`

---

## 20. Anexos

### Anexo A — Estrutura do Layout

```
container mx-auto p-6 max-w-7xl
├── Header: "Minha Clínica" + descrição
└── Tabs (Shadcn)
    ├── TabsList (grid adaptivo: 3col admin / 1col user)
    │   ├── TabsTrigger "license" (Shield) — sempre visível
    │   ├── TabsTrigger "users" (Users) — admin only
    │   └── TabsTrigger "alerts" (Bell) — admin only
    ├── TabsContent "license" → <LicenseTab />
    ├── TabsContent "users" → <UsersTab /> (admin only)
    └── TabsContent "alerts" → <AlertsTab /> (admin only)
```

### Anexo B — URL Query Parameters

| Parâmetro | Valores | Default | Descrição |
|-----------|---------|---------|-----------|
| `tab` | `license`, `users`, `alerts` | `license` | Controla aba ativa |
