# Documentação Experimental - Lista de Consultores

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Consultores (`/admin/consultants`)
**Versão:** 1.1
**Data:** 10/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todos os consultores Rennova cadastrados no sistema. Consultores são usuários especiais que podem acessar múltiplas clínicas sem pertencer a um tenant específico. A página oferece busca textual por nome/email/código/telefone, filtro por status (todos/ativos/suspensos/inativos) com recarregamento server-side, ações inline de suspender/reativar, cópia rápida de código e navegação para detalhes/edição. Utiliza API Routes com autenticação Bearer token para todas as operações.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/consultants/page.tsx`
- **Rota:** `/admin/consultants`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)

### 1.2 Dependências Principais
- **Firebase Auth:** `auth.currentUser` para obter `idToken` (Bearer token)
- **API Routes:** `GET /api/consultants`, `PUT /api/consultants/{id}`
- **Hooks:** `useAuth()` de `src/hooks/useAuth.ts`, `useToast()` de `src/hooks/use-toast.ts`
- **Utils:** `formatTimestamp()` de `src/lib/utils`
- **Types:** `Consultant`, `ConsultantStatus` de `src/types/index.ts`
- **UI:** Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Input, Badge (shadcn/ui)
- **Ícones:** Plus, Search, Users, Edit, Ban, CheckCircle, Building2, Copy (lucide-react)

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualizar todos os consultores, buscar, filtrar por status, editar, suspender/reativar, copiar códigos, criar novos consultores
- **Comportamento:** Lista carrega automaticamente ao montar com filtro de status selecionado; busca é client-side; ações de status requerem confirmação
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Interface Consultant

```typescript
// Importado de src/types/index.ts
export interface Consultant {
  id: string;                        // ID do documento no Firestore
  code: string;                      // Código único de 6 dígitos
  name: string;                      // Nome completo (MAIÚSCULAS)
  email: string;                     // Email (lowercase)
  phone: string;                     // Telefone
  status: ConsultantStatus;          // "active" | "suspended" | "inactive"
  authorized_tenants: string[];      // Array de tenant IDs
  user_id?: string;                  // UID no Firebase Auth
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type ConsultantStatus = "active" | "suspended" | "inactive";
```

### 3.2 Estado do Componente

```typescript
// Estados locais
const [consultants, setConsultants] = useState<Consultant[]>([]);
const [filteredConsultants, setFilteredConsultants] = useState<Consultant[]>([]);
const [loading, setLoading] = useState(true);
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState<ConsultantStatus | null>(null);
```

**Campos Principais:**
- **consultants:** Array completo retornado pela API (com filtro de status aplicado)
- **filteredConsultants:** Array filtrado pela busca textual (client-side)
- **statusFilter:** Filtro de status aplicado server-side (null = todos)
- **searchTerm:** Termo de busca aplicado client-side

---

## 4. Casos de Uso

### 4.1 UC-001: Listar Consultores

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- Acesso à rota `/admin/consultants`

**Fluxo Principal:**
1. Página monta e `useEffect` chama `loadConsultants()`
2. Obtém `idToken` via `auth.currentUser.getIdToken()`
3. `GET /api/consultants?status={statusFilter}` com header `Authorization: Bearer {idToken}`
4. API retorna `{ success: true, data: Consultant[] }`
5. `setConsultants(data.data)` armazena lista completa
6. `setFilteredConsultants(data.data)` inicializa lista filtrada
7. `setLoading(false)`

**Fluxo Alternativo - Erro:**
1. API retorna erro ou falha na requisição
2. Toast destructive: "Erro ao carregar consultores"
3. `setLoading(false)`, arrays permanecem vazios

**Pós-condições:**
- Tabela renderizada com consultores
- Contador exibe total de consultores

**Regra de Negócio:** RN-001

---

### 4.2 UC-002: Filtrar por Status

**Ator:** System Admin
**Pré-condições:**
- Lista de consultores carregada

**Fluxo Principal:**
1. Admin clica em um dos botões de filtro: "Todos", "Ativos", "Suspensos"
2. `setStatusFilter(newStatus)` atualiza estado
3. `loadConsultants()` é chamado novamente com novo filtro
4. API retorna apenas consultores com status correspondente
5. Lista é atualizada

**Pós-condições:**
- Tabela exibe apenas consultores do status selecionado
- Botão do filtro ativo destacado visualmente

**Regra de Negócio:** RN-001

---

### 4.3 UC-003: Buscar Consultores

**Ator:** System Admin
**Pré-condições:**
- Lista de consultores carregada

**Fluxo Principal:**
1. Admin digita no campo de busca
2. `setSearchTerm(value)` atualiza estado
3. `useEffect` filtra `consultants` por nome, email, código ou telefone (case-insensitive)
4. `setFilteredConsultants(filtered)` atualiza lista exibida

**Pós-condições:**
- Tabela exibe apenas consultores que correspondem à busca
- Contador atualizado com número de resultados

**Regra de Negócio:** RN-002

---

### 4.4 UC-004: Suspender Consultor

**Ator:** System Admin
**Pré-condições:**
- Consultor com status "active" na lista

**Fluxo Principal:**
1. Admin clica botão "Suspender" (ícone Ban)
2. `confirm()` nativo: "Tem certeza que deseja suspender o consultor {name}?"
3. Se confirmado, obtém `idToken`
4. `PUT /api/consultants/{id}` com `{ status: "suspended" }`
5. Toast sucesso: "Consultor suspenso com sucesso"
6. `loadConsultants()` recarrega lista

**Fluxo Alternativo - Cancelar:**
1. Admin clica "Cancelar" no confirm
2. Nenhuma ação executada

**Fluxo Alternativo - Erro:**
1. API retorna erro
2. Toast destructive: "Erro ao suspender consultor"

**Pós-condições:**
- Status do consultor atualizado para "suspended"
- Badge na tabela reflete novo status

**Regra de Negócio:** RN-003

---

### 4.5 UC-005: Reativar Consultor

**Ator:** System Admin
**Pré-condições:**
- Consultor com status "suspended" na lista

**Fluxo Principal:**
1. Admin clica botão "Reativar" (ícone CheckCircle)
2. `confirm()` nativo: "Tem certeza que deseja reativar o consultor {name}?"
3. Se confirmado, obtém `idToken`
4. `PUT /api/consultants/{id}` com `{ status: "active" }`
5. Toast sucesso: "Consultor reativado com sucesso"
6. `loadConsultants()` recarrega lista

**Pós-condições:**
- Status do consultor atualizado para "active"
- Badge na tabela reflete novo status

**Regra de Negócio:** RN-003

---

### 4.6 UC-006: Copiar Código do Consultor

**Ator:** System Admin
**Pré-condições:**
- Lista de consultores exibida

**Fluxo Principal:**
1. Admin clica botão "Copiar" ao lado do código
2. `navigator.clipboard.writeText(consultant.code)` copia código
3. Toast sucesso: "Código copiado para a área de transferência!"

**Fluxo Alternativo - Clipboard API não disponível:**
1. Erro ao copiar
2. Toast destructive: "Erro ao copiar código"

**Pós-condições:**
- Código copiado para clipboard

**Regra de Negócio:** N/A

---

### 4.7 UC-007: Editar Consultor

**Ator:** System Admin
**Pré-condições:**
- Lista de consultores exibida

**Fluxo Principal:**
1. Admin clica botão "Editar" (ícone Edit)
2. `router.push("/admin/consultants/{id}")` navega para detalhes

**Pós-condições:**
- Navegação para página de detalhes/edição

**Regra de Negócio:** N/A

---

### 4.8 UC-008: Criar Novo Consultor

**Ator:** System Admin
**Pré-condições:**
- Página carregada

**Fluxo Principal:**
1. Admin clica botão "Novo Consultor" no header
2. `router.push("/admin/consultants/new")` navega para criação

**Pós-condições:**
- Navegação para página de criação

**Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│            LISTA DE CONSULTORES (/admin/consultants)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    │ loadConsultants()│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ getIdToken()     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ GET /api/        │
                    │ consultants      │
                    │ ?status={filter} │
                    │ Bearer token     │
                    └──────────────────┘
                         │         │
                    Sucesso     Erro
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ setConsultants│ │ Toast erro   │
              │ setFiltered  │  └──────────────┘
              │ setLoading   │
              │ (false)      │
              └──────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │ RENDER: Header + Tabela        │
         │ ┌─────────────────────────┐    │
         │ │ [Busca] [Filtros Status]│    │
         │ │ [Novo Consultor]        │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Tabela de Consultores   │    │
         │ │ Código | Nome | Contato │    │
         │ │ Clínicas | Status | Ações│   │
         │ └─────────────────────────┘    │
         │ Mostrando X consultores         │
         └────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────┐
         │            │            │            │
    [Buscar]    [Filtrar]   [Copiar]   [Suspender/Reativar]
         │            │            │            │
         ▼            ▼            ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
  │ Filter   │ │ Reload   │ │ clipboard│ │ confirm() +  │
  │ client   │ │ server   │ │ .write   │ │ PUT /api/    │
  │ -side    │ │ -side    │ │ Text()   │ │ consultants  │
  └──────────┘ └──────────┘ └──────────┘ └──────────────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ Toast +      │
                                          │ Reload lista │
                                          └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Filtro de Status Server-Side
**Descrição:** O filtro por status é aplicado no backend via query parameter, retornando apenas consultores do status selecionado.
**Aplicação:** `GET /api/consultants?status={statusFilter}` — API filtra antes de retornar
**Exceções:** `statusFilter === null` retorna todos os consultores
**Justificativa:** Reduz volume de dados trafegados e processados no cliente

### RN-002: Busca Textual Client-Side
**Descrição:** A busca por nome, email, código ou telefone é feita no cliente sobre os dados já carregados.
**Aplicação:** `useEffect` filtra array `consultants` com `.toLowerCase().includes(searchTerm.toLowerCase())`
**Exceções:** Busca vazia exibe todos os consultores do filtro de status atual
**Justificativa:** Busca instantânea sem round-trips ao servidor

### RN-003: Confirmação para Mudança de Status
**Descrição:** Suspender ou reativar consultor requer confirmação via `confirm()` nativo.
**Aplicação:** `if (!confirm("Tem certeza...")) return;` antes de chamar API
**Exceções:** Nenhuma
**Justificativa:** Prevenir alterações acidentais de status

### RN-004: Código Imutável e Único
**Descrição:** O código do consultor (6 dígitos) não pode ser alterado após criação.
**Aplicação:** Exibido apenas para visualização e cópia na tabela
**Exceções:** Nenhuma
**Justificativa:** Código é identificador único usado para vincular consultor a clínicas

### RN-005: Reload Completo Após Ações
**Descrição:** Após suspender/reativar, a lista completa é recarregada do servidor.
**Aplicação:** `loadConsultants()` chamado após sucesso na API
**Exceções:** Nenhuma
**Justificativa:** Garante sincronização com estado do servidor

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** `loading === true` (durante `loadConsultants`)
**Exibição:** "Carregando consultores..." centralizado na área da tabela
**Interações:** Nenhuma — área de conteúdo substituída por texto de loading

### 7.2 Estado: Lista Vazia (Sem Busca)
**Quando:** `loading === false`, `filteredConsultants.length === 0`, `searchTerm === ""`
**Exibição:** "Nenhum consultor cadastrado" centralizado

### 7.3 Estado: Lista Vazia (Com Busca)
**Quando:** `loading === false`, `filteredConsultants.length === 0`, `searchTerm !== ""`
**Exibição:** "Nenhum consultor encontrado" centralizado

### 7.4 Estado: Lista Populada
**Quando:** `filteredConsultants.length > 0`
**Exibição:** Tabela com colunas:
- **Código:** `consultant.code` (font-mono, sky-600) + botão Copy (ghost)
- **Nome:** `consultant.name`
- **Contato:** Email + Telefone (text-muted-foreground, text-sm)
- **Clínicas:** Ícone Building2 + `authorized_tenants.length`
- **Status:** Badge (default/destructive/secondary)
- **Criado em:** `formatTimestamp(created_at)`
- **Ações:** Edit (ghost) + Suspender/Reativar (ghost)

**Contador:** "Mostrando X consultores"

### 7.5 Badges de Status
| Status | Variante | Texto |
|--------|----------|-------|
| `active` | `default` | Ativo |
| `suspended` | `destructive` | Suspenso |
| `inactive` | `secondary` | Inativo |

### 7.6 Botões de Filtro de Status
| Filtro | Valor | Estilo Ativo |
|--------|-------|--------------|
| Todos | `null` | `bg-primary text-primary-foreground` |
| Ativos | `"active"` | `bg-primary text-primary-foreground` |
| Suspensos | `"suspended"` | `bg-primary text-primary-foreground` |

**Estilo Inativo:** `bg-secondary text-secondary-foreground`

---

## 8. Validações

### 8.1 Validações Frontend
- **Confirmação de mudança de status:** `confirm()` antes de suspender/reativar
- **Busca:** Nenhuma validação (aceita qualquer texto)

### 8.2 Validações Backend (API Route)
- **Autenticação:** Verifica Bearer token válido
- **Autorização:** Verifica `is_system_admin === true`
- **Existência:** Verifica que consultor existe antes de atualizar status
- **Status válido:** Valida que novo status é "active", "suspended" ou "inactive"

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin` antes de renderizar
- API route verifica token e claims antes de processar

---

## 9. Integrações

### 9.1 API Route — GET /api/consultants
- **Tipo:** Next.js API Route (server-side)
- **Método:** `GET`
- **Query Params:** `status` (opcional) — "active" | "suspended" | "inactive"
- **Headers:** `Authorization: Bearer {idToken}`
- **Retorno Sucesso:** `{ success: true, data: Consultant[] }`
- **Retorno Erro:** `{ error: string }` com status 401/500

### 9.2 API Route — PUT /api/consultants/{id}
- **Tipo:** Next.js API Route (server-side)
- **Método:** `PUT`
- **Headers:** `Authorization: Bearer {idToken}`, `Content-Type: application/json`
- **Body:** `{ status: ConsultantStatus }`
- **Retorno Sucesso:** `{ success: true, message: string }`
- **Retorno Erro:** `{ error: string }` com status 400/401/404/500

### 9.3 Firebase Auth (Client)
- **`auth.currentUser.getIdToken()`:** Gera Bearer token para API routes

### 9.4 Clipboard API
- **`navigator.clipboard.writeText(code)`:** Copia código para clipboard

### 9.5 Next.js Router
- **`router.push("/admin/consultants/{id}")`:** Navegação para detalhes
- **`router.push("/admin/consultants/new")`:** Navegação para criação

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Autenticação via Bearer token em todas as API routes
- ✅ Verificação de role `system_admin` no backend
- ✅ Confirmação antes de mudança de status
- ✅ Layout admin restringe acesso por role
- ✅ Filtro de status server-side (não expõe dados desnecessários)

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ `confirm()` nativo não é bloqueante em todos os browsers
- ⚠️ Busca client-side expõe todos os dados carregados (mas já filtrados por status)
- ⚠️ Sem rate limiting nas ações de suspender/reativar
- **Mitigação:** API routes validam todas as operações

### 10.3 Dados Sensíveis
- **Emails:** Exibidos em texto plano na tabela
- **Telefones:** Exibidos em texto plano na tabela
- **Códigos:** Exibidos em texto plano (mas são públicos por natureza)

---

## 11. Performance

### 11.1 Métricas
- **Carregamento inicial:** 1 requisição HTTP (GET consultores)
- **Mudança de filtro:** 1 requisição HTTP (GET com novo filtro)
- **Busca:** Instantânea (client-side, sem IO)
- **Mudança de status:** 1 requisição HTTP (PUT) + 1 reload (GET)

### 11.2 Otimizações Implementadas
- ✅ Busca client-side evita round-trips
- ✅ Filtro de status server-side reduz volume de dados

### 11.3 Gargalos Identificados
- ⚠️ Reload completo após mudança de status (poderia atualizar estado local)
- ⚠️ Sem paginação (carrega todos os consultores do filtro)
- ⚠️ Sem cache de dados

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)

### 12.2 Recursos Implementados
- ✅ Tabela semântica com headers
- ✅ Botões com texto descritivo
- ✅ Input de busca com placeholder
- ✅ Badges com texto legível

### 12.3 Melhorias Necessárias
- [ ] `aria-label` nos botões de ação (Copy, Edit, Suspender)
- [ ] Campo de busca sem `<label>` associado
- [ ] Feedback de loading para screen readers
- [ ] Anúncio de mudanças via `aria-live`

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Carregar lista completa | E2E | Pendente |
| T-002 | Filtrar por status (ativos/suspensos) | E2E | Pendente |
| T-003 | Buscar por nome/email/código/telefone | E2E | Pendente |
| T-004 | Suspender consultor ativo | E2E | Pendente |
| T-005 | Reativar consultor suspenso | E2E | Pendente |
| T-006 | Copiar código para clipboard | E2E | Pendente |
| T-007 | Navegar para detalhes/criação | E2E | Pendente |
| T-008 | Lista vazia (sem consultores) | E2E | Pendente |

### 13.2 Cenários de Erro
- API indisponível durante carregamento
- Token expirado durante ação
- Consultor deletado entre listagem e ação

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Paginação server-side
- [ ] Exportação de lista (CSV/Excel)
- [ ] Filtros adicionais (por clínica, por data)
- [ ] Ações em lote (suspender múltiplos)
- [ ] Ordenação por colunas

### 14.2 UX/UI
- [ ] Dialog de confirmação (em vez de `confirm()`)
- [ ] Atualização otimista (sem reload)
- [ ] Skeleton loading
- [ ] Indicador de ações em progresso

### 14.3 Performance
- [ ] Paginação
- [ ] Cache de dados
- [ ] Debounce na busca

### 14.4 Segurança
- [ ] Rate limiting
- [ ] Logs de auditoria
- [ ] Validação de permissões por consultor

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/consultants/{id}` | Detalhes do consultor (navegação via Edit) |
| `/admin/consultants/new` | Criação de consultor (navegação via botão) |
| `/admin/tenants/{id}` | Detalhes do tenant (clínicas vinculadas) |

### 15.2 Fluxos Relacionados
- **Lista → Detalhe → Edição:** Fluxo principal de navegação
- **Lista → Criação → Lista:** Fluxo de cadastro

### 15.3 Impacto de Mudanças
- Alterar interface `Consultant` impacta esta página e API routes
- Alterar lógica de status afeta filtros e ações

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Filtro híbrido:** Status server-side, busca client-side
- **API Routes para CRUD:** Todas operações passam por API routes
- **Reload após ações:** Garante sincronização, mas menos eficiente

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para interatividade
- **Bearer token:** Autenticação via header Authorization
- **Toast feedback:** Notificações via `useToast`
- **Confirm nativo:** Confirmação via `window.confirm()`

### 16.3 Limitações Conhecidas
- Sem paginação (carrega todos os consultores)
- Reload completo após ações
- `confirm()` nativo (UX inconsistente)

### 16.4 Notas de Implementação
- Estilo sky-600/sky-700 para elementos de consultor
- Código exibido com font-mono
- Telefone e email em text-muted-foreground

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 10/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **Consultor Rennova** | Usuário especial que pode acessar múltiplas clínicas |
| **Código do Consultor** | Identificador único de 6 dígitos |
| **Bearer Token** | Token JWT usado para autenticação em API routes |
| **Filtro Server-Side** | Filtro aplicado no backend antes de retornar dados |
| **Busca Client-Side** | Filtro aplicado no cliente sobre dados já carregados |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Consultants Detail](./consultants-detail-documentation.md) — Detalhes do consultor
- [Consultants New](./consultants-new-documentation.md) — Criação de consultor
- [Tenants Detail](./tenants-detail-documentation.md) — Detalhes do tenant

### 19.2 Código Fonte
- `src/app/(admin)/admin/consultants/page.tsx` — Componente principal
- `src/app/api/consultants/route.ts` — API route GET
- `src/app/api/consultants/[id]/route.ts` — API route PUT
- `src/types/index.ts` — Interface Consultant

---

## 20. Anexos

### 20.1 Exemplo de Resposta da API (GET)
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "code": "123456",
      "name": "JOÃO SILVA CONSULTOR",
      "email": "joao@rennova.com.br",
      "phone": "11987654321",
      "status": "active",
      "authorized_tenants": ["tenant1", "tenant2"],
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-02-10T14:30:00Z"
    }
  ]
}
```

### 20.2 Exemplo de Payload de Atualização (PUT)
```json
{
  "status": "suspended"
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 10/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
