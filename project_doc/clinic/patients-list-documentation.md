# Documentação Experimental - Listagem de Pacientes

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Pacientes
**Componente:** Listagem de Pacientes (`/clinic/patients`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página principal do módulo de pacientes no portal da clínica. Exibe uma listagem completa de todos os pacientes cadastrados no tenant corrente, com busca em tempo real (client-side), cards de estatísticas e tabela interativa com botão "Ver Detalhes". Dados carregados em paralelo via `Promise.all`.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/patients/page.tsx`
- **Rota:** `/clinic/patients`
- **Layout:** Clinic Layout (restrito a `clinic_admin` e `clinic_user`)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims
- **patientService:** `src/lib/services/patientService.ts` — `listPatients`, `getPatientsStats`
- **Types:** `Patient` de `src/types/patient`
- **Firebase Firestore:** `Timestamp` (conversão de datas)
- **Shadcn/ui:** Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription
- **Lucide Icons:** Plus, Search, Users, Calendar

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Visualização completa + botão "Novo Paciente"
- **Comportamento:** Pode listar, buscar, ver detalhes e criar novos pacientes
- **Restrições:** Vinculado a um `tenant_id` específico

### 2.2 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Visualização e busca (somente leitura)
- **Comportamento:** Pode listar, buscar e ver detalhes, mas NÃO criar pacientes
- **Restrições:** Botão "Novo Paciente" oculto; vinculado a um `tenant_id` específico

---

## 3. Estrutura de Dados

```typescript
interface Patient {
  id: string;                        // ID do documento Firestore
  codigo: string;                    // Código do paciente
  nome: string;                      // Nome completo
  cpf?: string;                      // CPF (opcional)
  telefone?: string;                 // Telefone (opcional)
  email?: string;                    // Email (opcional)
  created_at: Timestamp | Date;      // Data de cadastro
  // ... demais campos
}

interface PatientStats {
  total: number;       // Total de pacientes cadastrados
  novos_mes: number;   // Novos pacientes no mês atual
}
```

**Campos Principais:**
- **codigo:** Identificador visual do paciente
- **created_at:** Aceita tanto `Timestamp` do Firestore quanto `Date` nativo
- **telefone/email:** Exibem "-" se vazios

---

## 4. Casos de Uso

### 4.1 UC-001: Listar Pacientes

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Usuário autenticado com `tenant_id` válido

**Fluxo Principal:**
1. Página carrega e extrai `tenant_id` das claims
2. `Promise.all` carrega lista de pacientes e estatísticas em paralelo
3. Tabela exibida com 6 colunas: Código, Nome, Telefone, Email, Cadastro, Ações
4. Cards de estatísticas exibem total e novos do mês

**Pós-condições:**
- Lista completa de pacientes exibida com contagem no header

---

### 4.2 UC-002: Buscar Paciente

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Pacientes carregados

**Fluxo Principal:**
1. Usuário digita no campo de busca
2. Filtro client-side case-insensitive em: nome, código, CPF, telefone
3. Tabela atualizada com resultados filtrados
4. Contador no header reflete quantidade filtrada

**Pós-condições:**
- Apenas pacientes correspondentes exibidos

---

### 4.3 UC-003: Ver Detalhes do Paciente

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Pacientes carregados

**Fluxo Principal:**
1. Clique em "Ver Detalhes" na linha do paciente
2. Navegação para `/clinic/patients/{patient.id}`

**Pós-condições:**
- Usuário redirecionado para página de detalhes

---

### 4.4 UC-004: Criar Novo Paciente

**Ator:** clinic_admin (exclusivo)
**Pré-condições:**
- Usuário com role `clinic_admin`

**Fluxo Principal:**
1. Clique em "Novo Paciente"
2. Navegação para `/clinic/patients/new`

**Pós-condições:**
- Usuário redirecionado para formulário de cadastro

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    LISTAGEM DE PACIENTES                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ tenant_id        │
                    │ existe?          │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Promise.all  │  │ Não carrega      │
              │ [listPatients│  └──────────────────┘
              │  getStats]   │
              └──────────────┘
                      │
                 ┌────┴────┐
                 │         │
              SUCESSO     ERRO
                 │         │
                 ▼         ▼
        ┌────────────┐  ┌────────────────┐
        │ Exibir     │  │ console.error  │
        │ tabela +   │  │ (sem feedback  │
        │ stats      │  │  visual)       │
        └────────────┘  └────────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ Usuário interage:      │
        │ - Busca textual        │
        │ - Ver Detalhes         │
        │ - Novo Paciente (admin)│
        └────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Multi-Tenant
**Descrição:** Dados carregados apenas quando `tenantId` está disponível
**Aplicação:** `loadData` verifica `tenantId` antes de executar
**Exceções:** Nenhuma
**Justificativa:** Isolamento de dados entre clínicas

### RN-002: Botão Novo Paciente Restrito
**Descrição:** Botão "Novo Paciente" exibido somente para `clinic_admin`
**Aplicação:** `isAdmin && (<Button>...)` no render
**Exceções:** Nenhuma
**Justificativa:** Controle de quem pode cadastrar pacientes

### RN-003: Busca Client-Side
**Descrição:** Filtro feito sobre a lista completa já carregada em memória
**Aplicação:** `filterPatients` compara `searchTerm` com nome, código, CPF e telefone
**Exceções:** Nenhuma
**Justificativa:** Simplicidade — lista completa já está no estado

### RN-004: Busca Case-Insensitive
**Descrição:** Busca converte para lowercase antes de comparar
**Aplicação:** `searchTerm.toLowerCase()` e `p.campo.toLowerCase()`
**Exceções:** CPF e telefone não usam toLowerCase (busca por conteúdo direto)
**Justificativa:** UX — usuário não precisa se preocupar com capitalização

### RN-005: Carregamento Paralelo
**Descrição:** Dados de pacientes e estatísticas carregados em paralelo
**Aplicação:** `Promise.all([listPatients, getPatientsStats])`
**Exceções:** Nenhuma
**Justificativa:** Performance — reduz tempo total de carregamento

### RN-006: Conversão de Timestamp
**Descrição:** Campo `created_at` aceita tanto `Timestamp` do Firestore quanto `Date`
**Aplicação:** `formatDate` verifica `instanceof Timestamp` antes de converter
**Exceções:** Nenhuma
**Justificativa:** Compatibilidade com diferentes fontes de dados

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** Desde o mount até dados carregados
**Exibição:** Spinner centralizado (animate-spin) em container de 64px de altura
**Interações:** Nenhuma
**Duração:** Até `Promise.all` completar

### 7.2 Estado: Dados Carregados
**Quando:** Pacientes e stats carregados com sucesso
**Exibição:**
- Header com título "Pacientes" + botão "Novo Paciente" (admin)
- 2 cards de estatísticas: Total de Pacientes, Novos este Mês
- Card de filtros com campo de busca
- Tabela com 6 colunas e contagem no header

**Links/Navegação:**
- "Novo Paciente" → `/clinic/patients/new` (admin)
- "Ver Detalhes" → `/clinic/patients/{id}`

### 7.3 Estado: Lista Vazia (Sem Busca)
**Quando:** `filteredPatients.length === 0` e `searchTerm` vazio
**Exibição:**
- Mensagem: "Nenhum paciente cadastrado"
- Botão "Cadastrar Primeiro Paciente" → `/clinic/patients/new`

### 7.4 Estado: Lista Vazia (Com Busca)
**Quando:** `filteredPatients.length === 0` e `searchTerm` preenchido
**Exibição:**
- Mensagem: "Nenhum paciente encontrado"

### 7.5 Estado: Erro
**Quando:** Falha no carregamento
**Exibição:**
- Nenhum feedback visual para o usuário
- Erro logado apenas no `console.error`

---

## 8. Validações

### 8.1 Validações de Frontend
- **tenantId:** Obrigatório para carregamento de dados
- **searchTerm:** Trim aplicado; se vazio, exibe todos os pacientes
- **telefone/email:** Exibem "-" se campos vazios/undefined

### 8.2 Validações de Backend
- **listPatients:** Query no serviço filtra por `tenantId`
- **getPatientsStats:** Cálculo de stats por `tenantId`

### 8.3 Validações de Permissão
- **Acesso à página:** Controlado pelo Clinic Layout
- **Botão Novo Paciente:** Condicional por `isAdmin`
- **Dados do tenant:** Serviços usam `tenantId` das claims

---

## 9. Integrações

### 9.1 patientService — listPatients
- **Tipo:** Serviço
- **Método:** `listPatients(tenantId)`
- **Entrada:** `tenant_id`
- **Retorno:** `Patient[]`
- **Quando:** Mount do componente (via `loadData`)

### 9.2 patientService — getPatientsStats
- **Tipo:** Serviço
- **Método:** `getPatientsStats(tenantId)`
- **Entrada:** `tenant_id`
- **Retorno:** `{ total, novos_mes }`
- **Quando:** Mount do componente (via `Promise.all`)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via `tenantId`
- ✅ Acesso controlado pelo Clinic Layout
- ✅ Botão de criação restrito a `clinic_admin`
- ✅ Tratamento de erros (console.error)

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Sem feedback visual de erro para o usuário
- **Mitigação:** Adicionar toast ou Alert para erros de carregamento

### 10.3 Dados Sensíveis
- **CPF:** Dado pessoal sensível exibido na busca (não na tabela)
- **Dados de pacientes:** Nome, telefone, email visíveis na tabela

---

## 11. Performance

### 11.1 Métricas
- **Requisições:** 2 queries paralelas (listPatients + getPatientsStats)
- **Componente:** ~236 linhas

### 11.2 Otimizações Implementadas
- ✅ Carregamento paralelo via `Promise.all`
- ✅ Filtro client-side (evita re-queries)

### 11.3 Gargalos Identificados
- ⚠️ Todos os pacientes carregados em memória (sem paginação)
- ⚠️ Busca recalculada a cada mudança de `searchTerm` (sem debounce)
- **Plano de melhoria:** Implementar paginação ou busca server-side para clínicas grandes

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Tabela HTML semântica (`<table>`, `<thead>`, `<tbody>`)
- ✅ Cabeçalhos de coluna com `<th>`
- ✅ Input de busca com placeholder descritivo

### 12.3 Melhorias Necessárias
- [ ] Adicionar `aria-label` no campo de busca
- [ ] Usar componentes Shadcn/ui Table (em vez de HTML nativo) para consistência
- [ ] Adicionar `role="status"` no contador de pacientes

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Listagem carrega corretamente**
   - **Dado:** Tenant com pacientes cadastrados
   - **Quando:** Página monta
   - **Então:** Tabela exibe pacientes, cards mostram stats

2. **Busca funciona**
   - **Dado:** Pacientes carregados
   - **Quando:** Digita "Maria" no campo de busca
   - **Então:** Apenas pacientes com "Maria" no nome exibidos

3. **Botão Novo Paciente (admin)**
   - **Dado:** Usuário `clinic_admin`
   - **Quando:** Página carrega
   - **Então:** Botão "Novo Paciente" visível

4. **Botão Novo Paciente oculto (user)**
   - **Dado:** Usuário `clinic_user`
   - **Quando:** Página carrega
   - **Então:** Botão "Novo Paciente" não visível

### 13.2 Casos de Teste de Erro
1. **Erro de carregamento:** Console.error, sem feedback visual
2. **tenant_id ausente:** Dados não carregados
3. **Busca sem resultado:** Mensagem "Nenhum paciente encontrado"

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar isolamento multi-tenant
- [ ] Testar busca por CPF e telefone

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Paginação da lista de pacientes
- [ ] Ordenação por coluna (clique no header)
- [ ] Exportação para Excel
- [ ] Filtros adicionais (data de cadastro, status)

### 14.2 UX/UI
- [ ] Feedback visual de erro (Alert ou toast)
- [ ] Usar Shadcn/ui Table em vez de HTML nativo
- [ ] Skeleton loading em vez de spinner simples

### 14.3 Performance
- [ ] Debounce na busca textual
- [ ] Paginação server-side
- [ ] Virtualização para listas grandes

### 14.4 Segurança
- [ ] Mascarar CPF na listagem
- [ ] Logging de acesso a dados de pacientes

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Detalhes do Paciente (`/clinic/patients/{id}`):** Destino do botão "Ver Detalhes"
- **Novo Paciente (`/clinic/patients/new`):** Destino do botão "Novo Paciente"
- **Dashboard (`/clinic/dashboard`):** Stats de pacientes reutilizadas

### 15.2 Fluxos que Passam por Esta Página
1. **Dashboard → Pacientes:** Via ação rápida
2. **Pacientes → Detalhes:** Via "Ver Detalhes"
3. **Pacientes → Novo:** Via "Novo Paciente" (admin)

### 15.3 Impacto de Mudanças
- **Alto impacto:** Interface `Patient`, `patientService`
- **Médio impacto:** Componentes de tabela
- **Baixo impacto:** Ícones, layout

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Tabela HTML nativa:** Usa `<table>` em vez do componente Shadcn/ui Table — inconsistência com outras páginas
- **Busca client-side:** Lista completa em memória, sem paginação — adequado para clínicas pequenas
- **Stats em cards separados:** Não usa componente Card do Shadcn para stats (usa divs customizadas)

### 16.2 Padrões Utilizados
- **Parallel loading:** `Promise.all` para dados e stats
- **Controlled search:** Input controlado com `useState`
- **Early return:** Loading renderizado antes do conteúdo

### 16.3 Limitações Conhecidas
- ⚠️ Sem paginação — carrega todos os pacientes
- ⚠️ Sem feedback visual de erro (apenas console.error)
- ⚠️ Tabela HTML nativa (inconsistente com Shadcn/ui Table usado em outras páginas)
- ⚠️ Contador no header da tabela reflete filtrados, não total

### 16.4 Notas de Implementação
- `isAdmin` calculado a partir de `claims?.role === "clinic_admin"`
- `formatDate` trata `Timestamp` e `Date` nativamente
- Campos opcionais (telefone, email) exibem "-" quando vazios
- Empty state sem busca exibe botão "Cadastrar Primeiro Paciente" (sem verificação de role)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **tenant_id:** Identificador único da clínica no sistema multi-tenant
- **Patient:** Interface TypeScript que representa um paciente
- **Stats:** Estatísticas agregadas de pacientes (total, novos do mês)
- **CPF:** Cadastro de Pessoa Física — documento de identificação brasileiro

---

## 19. Referências

### 19.1 Documentação Relacionada
- Detalhes do Paciente - `project_doc/clinic/patients-detail-documentation.md`
- Novo Paciente - `project_doc/clinic/patients-new-documentation.md`
- Editar Paciente - `project_doc/clinic/patients-edit-documentation.md`

### 19.2 Links Externos
- Firebase Firestore Timestamp - https://firebase.google.com/docs/reference/js/firestore_.timestamp

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/patients/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`
- **Services:** `src/lib/services/patientService.ts`
- **Types:** `src/types/patient.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots da interface em diferentes estados]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Busca client-side case-insensitive
function filterPatients() {
  if (!searchTerm.trim()) {
    setFilteredPatients(patients);
    return;
  }
  const term = searchTerm.toLowerCase();
  const filtered = patients.filter(
    (p) =>
      p.nome.toLowerCase().includes(term) ||
      p.codigo.toLowerCase().includes(term) ||
      (p.cpf && p.cpf.includes(term)) ||
      (p.telefone && p.telefone.includes(term))
  );
  setFilteredPatients(filtered);
}

// Conversão segura de Timestamp
function formatDate(timestamp: Timestamp | Date): string {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleDateString("pt-BR");
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
