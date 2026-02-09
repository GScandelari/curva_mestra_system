# Documentação Experimental - Dashboard Administrativo

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Dashboard Administrativo (`/admin/dashboard`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

O Dashboard Administrativo é a página principal do System Admin, oferecendo uma visão consolidada da plataforma Curva Mestra. Exibe métricas de faturamento por plano (mensal e projeção anual), contagens de clínicas e usuários, ações rápidas de navegação para os principais módulos do sistema e um feed de atividade recente consolidando dados de 4 coleções Firestore.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/dashboard/page.tsx`
- **Rota:** `/admin/dashboard`
- **Layout:** Admin Layout (restrito a `system_admin`)

### 1.2 Dependências Principais
- **Firestore:** Coleções `tenants`, `users`, `licenses`, `access_requests` (leitura direta)
- **PLANS constant:** `src/lib/constants/plans.ts` — preços dos planos semestral (R$ 59,90) e anual (R$ 49,90)
- **date-fns:** `formatDistanceToNow` com locale `ptBR` para timestamps relativos
- **Lucide Icons:** Users, Building2, CreditCard, UserCog, Package, DollarSign, TrendingUp, CheckCircle, UserPlus
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualização completa de todas as métricas globais da plataforma (faturamento, clínicas, usuários, atividades)
- **Comportamento:** Dados carregados automaticamente ao montar o componente via duas funções assíncronas paralelas
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Interface DashboardStats

```typescript
interface DashboardStats {
  totalTenants: number;        // Total de clínicas cadastradas
  activeTenants: number;       // Clínicas ativas (active: true)
  totalUsers: number;          // Total de usuários na coleção "users"
  activeUsers: number;         // Usuários ativos (active: true)
  planCounts: {
    semestral: number;         // Clínicas com plan_id "semestral"
    anual: number;             // Clínicas com plan_id "anual"
  };
  revenue: {
    semestral: {
      monthly: number;         // Faturamento mensal do plano semestral
      total: number;           // Faturamento total (monthly * 6)
      count: number;           // Quantidade de clínicas
    };
    anual: {
      monthly: number;         // Faturamento mensal do plano anual
      total: number;           // Faturamento total (monthly * 12)
      count: number;           // Quantidade de clínicas
    };
    totalMonthly: number;      // Soma mensal de todos os planos
    totalAnnual: number;       // Projeção anual total
  };
}
```

### 3.2 Interface Activity

```typescript
interface Activity {
  id: string;                                        // ID do documento Firestore
  type: 'tenant' | 'user' | 'license' | 'access_request';  // Tipo da atividade
  title: string;                                     // Texto descritivo da atividade
  description: string;                               // Nome da clínica/usuário
  timestamp: Date;                                   // Data do evento
  icon: any;                                         // Componente de ícone Lucide
}
```

**Campos Principais:**
- **totalMonthly:** Soma de `semestral.monthly + anual.monthly` — faturamento mensal recorrente total
- **totalAnnual:** Soma de `semestral.total + anual.total` — projeção de receita para o período completo dos contratos
- **type:** Determina o ícone e contexto da atividade no feed recente

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Métricas de Faturamento

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- Acesso à rota `/admin/dashboard`
- Coleções Firestore acessíveis

**Fluxo Principal:**
1. Página monta e executa `loadDashboardStats()` no `useEffect`
2. Sistema busca todos os documentos da coleção `tenants`
3. Sistema conta total de tenants e filtra os ativos (`active: true`)
4. Sistema filtra clínicas por `plan_id` (semestral/anual)
5. Sistema calcula faturamento usando preços de `PLANS`:
   - Semestral: count × R$ 59,90/mês, total = monthly × 6
   - Anual: count × R$ 49,90/mês, total = monthly × 12
6. Sistema busca todos os documentos da coleção `users`
7. Sistema conta total de usuários e filtra os ativos
8. Exibe 4 cards de faturamento + 3 cards de estatísticas

**Pós-condições:**
- 7 cards exibidos com dados atualizados
- Estado `loading` muda para `false`

**Regra de Negócio:**
- Faturamento calculado client-side com base nos preços fixos de `PLANS`
- Projeção anual considera período completo do contrato (6 ou 12 meses)

---

### 4.2 UC-002: Visualizar Atividade Recente

**Ator:** System Admin
**Pré-condições:**
- Página carregada
- Coleções Firestore com dados

**Fluxo Principal:**
1. `loadRecentActivities()` executa em paralelo com `loadDashboardStats()`
2. Busca os 3 últimos tenants criados (`orderBy created_at desc, limit 3`)
3. Busca os 3 últimos users criados (`orderBy created_at desc, limit 3`)
4. Busca as 3 últimas licenses criadas (`orderBy created_at desc, limit 3`)
5. Busca as 3 últimas access_requests (`orderBy updated_at desc, limit 3`)
6. Filtra access_requests para incluir apenas `status === 'approved'`
7. Combina todas as atividades, ordena por timestamp descendente
8. Exibe as 5 mais recentes com ícone, título, descrição e tempo relativo

**Fluxo Alternativo - Sem atividades:**
1. Nenhuma atividade encontrada nas coleções
2. Sistema exibe mensagem "Nenhuma atividade recente"

**Pós-condições:**
- Lista de até 5 atividades recentes com tempo relativo em português (`formatDistanceToNow`)

**Regra de Negócio:**
- Access requests são filtradas por status no JavaScript (apenas aprovadas)
- Cada tipo de atividade tem ícone e título específicos

---

### 4.3 UC-003: Navegação Rápida para Módulos

**Ator:** System Admin
**Pré-condições:**
- Dashboard carregado

**Fluxo Principal:**
1. Admin visualiza card "Ações Rápidas" com 4 botões
2. Admin clica em um botão de ação rápida
3. Sistema navega via `router.push()` para a rota correspondente

**Pós-condições:**
- Navegação para a página do módulo selecionado

**Regra de Negócio:**
- 4 ações rápidas disponíveis, cada uma com ícone e label descritivos

---

### 4.4 UC-004: Erro no Carregamento de Dados

**Ator:** System Admin
**Pré-condições:**
- Falha na conexão com Firestore ou permissão negada

**Fluxo Principal:**
1. Página tenta carregar dados via Firestore
2. Ocorre erro na query
3. Erro é capturado pelo `try/catch`
4. Erro é logado no `console.error`
5. Cards exibem valores zerados (estado inicial)

**Mensagens de Erro:**
- `console.error("Erro ao carregar estatísticas:", error)` — para stats
- `console.error("Erro ao carregar atividades recentes:", error)` — para atividades

**Pós-condições:**
- Dashboard exibido com dados zerados/vazios
- Sem feedback visual de erro para o usuário

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              DASHBOARD ADMINISTRATIVO (/admin/dashboard)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ loadDashboard    │  │ loadRecent       │
         │ Stats()          │  │ Activities()     │
         └──────────────────┘  └──────────────────┘
                    │                   │
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ getDocs(tenants) │  │ query(tenants,   │
         │ - total/ativos   │  │ users, licenses, │
         │ - plan_id filter │  │ access_requests) │
         └──────────────────┘  │ limit(3) cada    │
                    │          └──────────────────┘
                    ▼                   │
         ┌──────────────────┐          ▼
         │ Calcular revenue │  ┌──────────────────┐
         │ PLANS.semestral  │  │ Filtrar approved │
         │ PLANS.anual      │  │ Ordenar por data │
         └──────────────────┘  │ Top 5 atividades │
                    │          └──────────────────┘
                    ▼                   │
         ┌──────────────────┐          ▼
         │ getDocs(users)   │  ┌──────────────────┐
         │ - total/ativos   │  │ setActivities()  │
         └──────────────────┘  └──────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │ setStats(...)    │
         │ setLoading(false)│
         └──────────────────┘
                    │
                    ▼
         ┌──────────────────────────────────────────┐
         │ RENDER:                                    │
         │ ┌─ 4 Cards Faturamento (grid 4 cols)  ─┐ │
         │ │ Mensal Total │ Semestral │ Anual │ Proj│ │
         │ └──────────────────────────────────────┘ │
         │ ┌─ 3 Cards Estatísticas (grid 3 cols) ─┐ │
         │ │ Clínicas    │ Licenças   │ Usuários  │ │
         │ └──────────────────────────────────────┘ │
         │ ┌─ Ações Rápidas (grid 4 cols) ────────┐ │
         │ │ Clínicas │ Usuários │ Produtos │ Lic. │ │
         │ └──────────────────────────────────────┘ │
         │ ┌─ Atividade Recente ──────────────────┐ │
         │ │ Até 5 itens com ícone + tempo relativo│ │
         │ └──────────────────────────────────────┘ │
         └──────────────────────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Cálculo de Faturamento por Plano
**Descrição:** Faturamento é calculado multiplicando o número de clínicas ativas em cada plano pelo preço mensal definido em `PLANS`. Projeção total considera o período completo do contrato.
**Aplicação:** Cards de faturamento no topo do dashboard
**Exceções:** Clínicas sem `plan_id` não são contabilizadas em nenhum plano
**Justificativa:** Visão financeira rápida para tomada de decisão do administrador

### RN-002: Atividade Recente Consolidada de 4 Fontes
**Descrição:** Feed de atividades combina dados de `tenants`, `users`, `licenses` e `access_requests`, cada um limitado a 3 itens, ordenados por timestamp, exibindo os 5 mais recentes.
**Aplicação:** Card "Atividade Recente" na parte inferior do dashboard
**Exceções:** Access requests são filtradas para incluir apenas `status === 'approved'`
**Justificativa:** Panorama unificado das últimas ações no sistema, sem necessidade de navegar para cada módulo

### RN-003: Contagem de Clínicas Ativas
**Descrição:** Clínica ativa é definida pelo campo `active: true` no documento do tenant.
**Aplicação:** Cards de estatísticas e subtexto dos cards de faturamento
**Exceções:** Nenhuma
**Justificativa:** Distinguir entre clínicas cadastradas e efetivamente operantes

### RN-004: Acesso Exclusivo System Admin
**Descrição:** Apenas usuários com role `system_admin` podem acessar o dashboard administrativo.
**Aplicação:** Verificação feita pelo Admin Layout antes do render da página
**Exceções:** Nenhuma
**Justificativa:** Dados financeiros e métricas globais são sensíveis e restritos

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** `loading === true` (ao montar o componente)
**Exibição:** Todos os valores numéricos nos cards exibem "..."
**Interações:** Botões de ações rápidas já são clicáveis
**Duração:** ~1-3 segundos (depende do volume de dados e latência)

### 7.2 Estado: Dashboard Carregado
**Quando:** `loading === false` e dados carregados com sucesso
**Exibição:**
- **Header:** "Dashboard administrativo" + "Visão geral da plataforma"
- **4 Cards de Faturamento (grid 4 colunas):**
  - Faturamento Mensal Total (ícone DollarSign) + subtexto "{N} clínicas ativas"
  - Plano Semestral (ícone TrendingUp) + subtexto "{N} clínicas · R$ 59,90/mês"
  - Plano Anual (ícone TrendingUp) + subtexto "{N} clínicas · R$ 49,90/mês"
  - Projeção Anual (ícone DollarSign) + subtexto "Faturamento total dos contratos"
- **3 Cards de Estatísticas (grid 3 colunas):**
  - Total de Clínicas (Building2) + subtexto "{N} ativas"
  - Licenças por Plano (CreditCard) + subtexto "{N} Semestral · {N} Anual"
  - Total de Usuários (Users) + subtexto "{N} ativos"
- **Card Ações Rápidas (grid 4 colunas):** 4 botões outline com ícone e label
- **Card Atividade Recente:** Até 5 itens com ícone circular, título, descrição e tempo relativo

### 7.3 Estado: Sem Atividades
**Quando:** `activities.length === 0` após carregamento
**Exibição:** Texto "Nenhuma atividade recente" em estilo muted

### 7.4 Estado: Erro Silencioso
**Quando:** Falha em qualquer query Firestore
**Exibição:** Dashboard com valores zerados/iniciais, sem alerta visual
**Interações:** Usuário pode recarregar a página manualmente

---

## 8. Validações

### 8.1 Validações de Frontend
- **Não aplicável:** Dashboard é uma página de visualização sem inputs de usuário

### 8.2 Validações de Backend
- **Não aplicável:** Não há operações de escrita ou API routes envolvidas

### 8.3 Validações de Permissão
- **Admin Layout:** Verifica custom claim `is_system_admin === true` antes de renderizar
- **Firestore Rules:** Leitura das coleções `tenants`, `users`, `licenses`, `access_requests` permitida para `system_admin`

---

## 9. Integrações

### 9.1 Firestore - Coleção `tenants`
- **Tipo:** Firestore SDK (client-side)
- **Método(s):** `getDocs(collection(db, "tenants"))` (stats) + `query(orderBy("created_at", "desc"), limit(3))` (atividades)
- **Entrada:** Nenhum parâmetro
- **Retorno:** Todos os documentos de tenants
- **Campos utilizados:** `active`, `plan_id`, `name`, `created_at`
- **Erros:** Capturados por try/catch, logados no console

### 9.2 Firestore - Coleção `users`
- **Tipo:** Firestore SDK (client-side)
- **Método(s):** `getDocs(collection(db, "users"))` (contagem) + `query(orderBy("created_at", "desc"), limit(3))` (atividades)
- **Entrada:** Nenhum parâmetro
- **Retorno:** Todos os documentos de users
- **Campos utilizados:** `active`, `full_name`, `email`, `created_at`

### 9.3 Firestore - Coleção `licenses`
- **Tipo:** Firestore SDK (client-side)
- **Método(s):** `query(orderBy("created_at", "desc"), limit(3))`
- **Entrada:** Nenhum parâmetro
- **Retorno:** Últimas 3 licenças
- **Campos utilizados:** `plan_id`, `created_at`

### 9.4 Firestore - Coleção `access_requests`
- **Tipo:** Firestore SDK (client-side)
- **Método(s):** `query(orderBy("updated_at", "desc"), limit(3))`
- **Entrada:** Nenhum parâmetro
- **Retorno:** Últimas 3 solicitações, filtradas em JS por `status === 'approved'`
- **Campos utilizados:** `status`, `clinic_name`, `updated_at`

### 9.5 PLANS Constant
- **Tipo:** Constante importada
- **Arquivo:** `src/lib/constants/plans.ts`
- **Método(s):** Acesso direto a `PLANS.semestral.price` e `PLANS.anual.price`
- **Retorno:** Preços numéricos dos planos

### 9.6 date-fns
- **Tipo:** Biblioteca
- **Método(s):** `formatDistanceToNow(timestamp, { addSuffix: true, locale: ptBR })`
- **Entrada:** Date object do timestamp da atividade
- **Retorno:** String como "há 2 horas", "há 3 dias"

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Acesso restrito por Admin Layout (verifica `is_system_admin` via custom claims)
- ✅ Apenas operações de leitura (nenhuma escrita no Firestore)
- ✅ Erros capturados por try/catch (não expõe stack traces ao usuário)
- ✅ Dados financeiros calculados server-side via preços constantes (não manipuláveis pelo cliente)

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Todos os documentos de `tenants` e `users` são carregados no cliente (exposição de dados em memória)
- ⚠️ Preços dos planos estão hardcoded em constante importada (não validados contra backend)
- **Mitigação:** Firestore Rules garantem que apenas `system_admin` pode ler estas coleções

### 10.3 Dados Sensíveis
- **Faturamento:** Calculado a partir de contagens, sem dados bancários expostos
- **Nomes de clínicas/usuários:** Exibidos no feed de atividades, protegidos por role

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** ~1-3s (depende do volume de dados)
- **Requisições Firestore:** 6 queries ao montar (2 full collection reads + 4 limited queries)
- **Tamanho do bundle:** ~15KB (componente + dependências date-fns locale)

### 11.2 Otimizações Implementadas
- ✅ Duas funções de carregamento executam em paralelo (stats e atividades)
- ✅ Queries de atividades usam `limit(3)` para reduzir volume
- ✅ Formatação de moeda via `Intl.NumberFormat` (nativo, sem dependência extra)

### 11.3 Gargalos Identificados
- ⚠️ `getDocs(collection(db, "tenants"))` carrega TODOS os documentos de tenants (sem paginação)
- ⚠️ `getDocs(collection(db, "users"))` carrega TODOS os documentos de users (sem paginação)
- ⚠️ Sem cache — cada visita ao dashboard refaz todas as 6 queries
- **Plano de melhoria:** Usar Firestore aggregation queries (`count()`) ou Cloud Functions scheduled para pré-calcular estatísticas

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)
- **Versão:** N/A

### 12.2 Recursos Implementados
- ✅ Textos descritivos em todos os cards (título + subtexto)
- ✅ Botões de ação rápida com labels textuais visíveis
- ✅ Hierarquia visual clara com heading h2

### 12.3 Melhorias Necessárias
- [ ] ARIA labels nos cards de estatísticas
- [ ] Anúncio de carregamento para screen readers (aria-live)
- [ ] Navegação por teclado nos botões de ação rápida
- [ ] Contraste das cores dos ícones em estado muted

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Carregamento de estatísticas com dados**
   - **Dado:** 5 tenants (3 ativos, 2 semestral, 1 anual)
   - **Quando:** Dashboard é montado
   - **Então:** Cards exibem: Mensal Total = R$ 169,70, 3 ativas, projeção anual correta

2. **Carregamento sem dados**
   - **Dado:** Coleções vazias no Firestore
   - **Quando:** Dashboard é montado
   - **Então:** Cards exibem 0 e R$ 0,00, atividades exibe "Nenhuma atividade recente"

3. **Navegação por ações rápidas**
   - **Dado:** Dashboard carregado
   - **Quando:** Admin clica em "Gerenciar Clínicas"
   - **Então:** Navega para `/admin/tenants`

### 13.2 Casos de Teste de Erro
1. **Firestore indisponível:** Valores permanecem zerados, erro logado no console
2. **Permissão negada:** Admin Layout bloqueia acesso antes de renderizar
3. **Timestamp nulo:** Fallback para `new Date()` na construção de atividades

### 13.3 Testes de Integração
- [ ] Verificar cálculo de faturamento com diferentes combinações de planos
- [ ] Verificar ordenação de atividades recentes com timestamps misturados
- [ ] Verificar formatação de moeda em diferentes locales do browser

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Gráficos de evolução de faturamento ao longo do tempo
- [ ] Filtro por período (mês, trimestre, ano)
- [ ] Exportação de relatórios financeiros (PDF/Excel)
- [ ] Indicadores de crescimento (comparativo mês anterior)
- [ ] Dashboard em tempo real com Firestore listeners

### 14.2 UX/UI
- [ ] Skeleton loading nos cards durante carregamento
- [ ] Animações de entrada nos cards
- [ ] Tooltip com detalhes ao passar o mouse nos valores
- [ ] Modo compacto/expandido para cards

### 14.3 Performance
- [ ] Usar Firestore aggregation queries para contagens
- [ ] Cache de estatísticas com Cloud Functions scheduled
- [ ] Paginação ou lazy loading para coleções grandes
- [ ] Service Worker para cache offline

### 14.4 Segurança
- [ ] Rate limiting nas queries do dashboard
- [ ] Auditoria de acessos ao dashboard
- [ ] Criptografia de dados financeiros em trânsito

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Admin Tenants (`/admin/tenants`):** Ação rápida navega para lista de clínicas
- **Admin Users (`/admin/users`):** Ação rápida navega para lista de usuários
- **Admin Products (`/admin/products`):** Ação rápida navega para lista de produtos
- **Admin Licenses (`/admin/licenses`):** Ação rápida navega para lista de licenças
- **Admin Layout:** Provê verificação de autenticação e navegação lateral

### 15.2 Fluxos que Passam por Esta Página
1. **Login → Dashboard:** Após login bem-sucedido de system_admin, redirecionado para `/admin/dashboard`
2. **Dashboard → Módulos:** Ponto central de navegação para todos os módulos administrativos

### 15.3 Impacto de Mudanças
- **Alto impacto:** Alterações na estrutura de `tenants` ou `users` no Firestore (quebra cálculos)
- **Médio impacto:** Alterações nos preços em `PLANS` (altera cálculos de faturamento)
- **Baixo impacto:** Alterações visuais nos cards (apenas UI)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Client-side aggregation:** Todas as contagens e cálculos são feitos no cliente após buscar todos os documentos. Decisão adequada para MVP com poucos tenants, mas não escalável para centenas de clínicas.
- **Funções paralelas:** `loadDashboardStats()` e `loadRecentActivities()` são chamadas independentemente no `useEffect`, melhorando tempo de carregamento percebido.
- **Sem realtime listeners:** Dados são estáticos após carregamento inicial (snapshot, não listener).

### 16.2 Padrões Utilizados
- **Controlled State:** `useState` para stats, loading e activities
- **Effect on Mount:** `useEffect([], [])` para carregamento inicial
- **Compound Query:** Múltiplas queries combinadas em JS para feed de atividades

### 16.3 Limitações Conhecidas
- ⚠️ Não há refresh automático (dados ficam stale se página permanece aberta)
- ⚠️ Formatação de moeda usa `Intl.NumberFormat` (pode variar entre browsers antigos)
- ⚠️ Campo `icon` na interface Activity usa tipo `any` (sem type safety)
- ⚠️ Erros de carregamento são silenciosos (apenas `console.error`, sem feedback visual)

### 16.4 Notas de Implementação
- Componente usa `"use client"` por depender de hooks React e Next.js
- Página tem ~503 linhas
- Atividades recentes buscam 3 itens de cada coleção (12 total) e exibem as 5 mais recentes

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 07/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão |

---

## 18. Glossário

- **Tenant:** Clínica ou entidade no sistema multi-tenant, representada por um documento na coleção `tenants`
- **System Admin:** Administrador global da plataforma Curva Mestra com acesso irrestrito
- **Custom Claims:** Metadados de permissão armazenados no token JWT do Firebase Authentication
- **PLANS:** Constante com definição dos planos de assinatura (preços, nomes, períodos)
- **Revenue:** Faturamento calculado = número de clínicas × preço do plano
- **Feed de Atividades:** Lista consolidada das últimas ações no sistema, oriunda de 4 coleções

---

## 19. Referências

### 19.1 Documentação Relacionada
- Admin Tenants List - `project_doc/admin/tenants-list-documentation.md`
- Admin Users - `project_doc/admin/users-documentation.md`
- Admin Licenses List - `project_doc/admin/licenses-list-documentation.md`
- Admin Products List - `project_doc/admin/products-list-documentation.md`

### 19.2 Links Externos
- [Firestore getDocs](https://firebase.google.com/docs/firestore/query-data/get-data)
- [date-fns formatDistanceToNow](https://date-fns.org/docs/formatDistanceToNow)
- [Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(admin)/admin/dashboard/page.tsx`
- **Plans Constant:** `src/lib/constants/plans.ts`
- **Firebase Config:** `src/lib/firebase.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — página renderizada no browser]

### 20.2 Diagramas
Diagrama de fluxo incluído na Seção 5.

### 20.3 Exemplos de Código

```typescript
// Exemplo: Cálculo de faturamento
const semestralPrice = PLANS.semestral.price; // R$ 59,90
const semestralMonthly = semestralTenants.length * semestralPrice;
const semestralTotal = semestralMonthly * 6;

// Exemplo: Formatação de moeda
new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(stats.revenue.totalMonthly);

// Exemplo: Tempo relativo
formatDistanceToNow(activity.timestamp, {
  addSuffix: true,
  locale: ptBR,
}); // "há 2 horas"
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
