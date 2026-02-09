# Documentação Experimental - Dashboard da Clínica

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica (Área da Clínica)
**Componente:** Dashboard Principal (`/clinic/dashboard`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página principal do painel da clínica. Apresenta uma visão consolidada do estoque, pacientes, procedimentos agendados, alertas de vencimento e atividade recente. Utiliza dados em tempo real via Firestore `onSnapshot` para estatísticas de inventário, com dados complementares carregados em paralelo via promises.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/dashboard/page.tsx`
- **Rota:** `/clinic/dashboard`
- **Layout:** Clinic Layout (restrito a `clinic_admin` e `clinic_user`)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims do usuário
- **inventoryService:** `src/lib/services/inventoryService.ts` — `getInventoryStats`, `getExpiringProducts`, `getRecentActivity`, tipos `InventoryStats`, `ExpiringProduct`, `RecentActivity`
- **patientService:** `src/lib/services/patientService.ts` — `getPatientsStats`
- **solicitacaoService:** `src/lib/services/solicitacaoService.ts` — `getUpcomingProcedures`
- **Firebase Firestore:** `collection`, `query`, `where`, `onSnapshot`, `Timestamp` (listener em tempo real)
- **Utilitários:** `formatTimestamp` de `src/lib/utils`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Skeleton, Alert, AlertDescription, AlertTitle, Button
- **Lucide Icons:** Package, AlertTriangle, FileText, TrendingUp, Calendar, Clock, DollarSign, Users

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Visualização completa de todas as métricas do dashboard (estoque, pacientes, procedimentos, alertas, atividade)
- **Comportamento:** Dados carregados automaticamente via `tenant_id` das claims; variável `isAdmin` calculada mas não condiciona visibilidade nesta página
- **Restrições:** Vinculado a um `tenant_id` específico; clínica deve estar ativa

### 2.2 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Mesma visualização do `clinic_admin` nesta página
- **Comportamento:** Dados idênticos ao admin; sem diferenciação de exibição
- **Restrições:** Vinculado a um `tenant_id` específico; clínica deve estar ativa

---

## 3. Estrutura de Dados

### 3.1 Interface InventoryStats

```typescript
interface InventoryStats {
  totalProdutos: number;           // Total de unidades disponíveis em estoque
  totalValor: number;              // Valor total do estoque (quantidade * valor_unitario)
  produtosVencendo30dias: number;  // Produtos com validade nos próximos 30 dias
  produtosVencidos: number;        // Produtos com validade já expirada
  produtosEstoqueBaixo: number;    // Produtos com menos de 10 unidades
  ultimaAtualizacao: Date;         // Timestamp da última atualização
}
```

### 3.2 Interface PatientStats

```typescript
interface PatientStats {
  total: number;          // Total de pacientes cadastrados
  novos_mes: number;      // Novos pacientes no mês atual
  novos_3_meses: number;  // Novos pacientes nos últimos 3 meses
}
```

### 3.3 Interface ExpiringProduct

```typescript
interface ExpiringProduct {
  id: string;                    // ID do documento Firestore
  nome_produto: string;          // Nome do produto
  lote: string;                  // Número do lote
  quantidade_disponivel: number; // Unidades disponíveis
  dt_validade: Date;             // Data de validade
  diasParaVencer: number;        // Dias restantes para vencimento
}
```

### 3.4 Interface RecentActivity

```typescript
interface RecentActivity {
  id: string;              // ID do documento Firestore
  tipo: string;            // "entrada" | "saida"
  descricao: string;       // Descrição da movimentação
  nome_produto: string;    // Nome do produto
  quantidade: number;      // Quantidade movimentada
  timestamp: any;          // Data/hora da movimentação (Firestore Timestamp)
}
```

### 3.5 Solicitação (Procedimentos Próximos)

```typescript
// Campos usados do tipo Solicitacao
{
  id: string;                           // ID da solicitação
  paciente_nome: string;                // Nome do paciente
  paciente_codigo: string;              // Código do paciente
  produtos_solicitados: any[];          // Lista de produtos solicitados
  dt_procedimento: Timestamp | Date;    // Data agendada do procedimento
  status: string;                       // Status da solicitação
}
```

**Campos Principais:**
- **totalProdutos:** Calculado em tempo real somando `quantidade_disponivel` de todos os itens ativos com quantidade > 0
- **totalValor:** Calculado como `quantidade_disponivel * valor_unitario` para cada item
- **produtosEstoqueBaixo:** Itens com `quantidade_disponivel < 10`
- **produtosVencendo30dias:** Itens com `dt_validade` entre agora e 30 dias no futuro

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Resumo do Estoque em Tempo Real

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Usuário autenticado com `tenant_id` válido
- Clínica ativa

**Fluxo Principal:**
1. Página carrega e extrai `tenant_id` das claims
2. Listener `onSnapshot` é criado na coleção `tenants/{tenantId}/inventory` com filtro `active == true`
3. Para cada item do snapshot, calcula: totalProdutos, totalValor, produtosVencendo30dias, produtosVencidos, produtosEstoqueBaixo
4. Itens vencendo são coletados (máximo 5) e ordenados por proximidade
5. Cards de estatísticas são atualizados em tempo real

**Pós-condições:**
- 6 cards de estatísticas exibidos com valores atualizados
- Qualquer alteração no inventário atualiza automaticamente os cards

**Regra de Negócio:**
- Apenas itens com `quantidade_disponivel > 0` são contabilizados
- Estoque baixo: menos de 10 unidades

---

### 4.2 UC-002: Visualizar Próximos Procedimentos

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Dados carregados com sucesso

**Fluxo Principal:**
1. Função `getUpcomingProcedures(tenantId, 5)` busca até 5 procedimentos
2. Lista exibe: nome do paciente, código, quantidade de produtos, data e status
3. Clique em um procedimento navega para `/clinic/requests?id={proc.id}`

**Pós-condições:**
- Lista de procedimentos exibida ou empty state
- Botão "Ver todos os procedimentos" visível quando há itens

---

### 4.3 UC-003: Visualizar Alertas de Vencimento

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Listener do inventário ativo

**Fluxo Principal:**
1. Durante processamento do snapshot, produtos com validade em até 30 dias são coletados
2. Limitados a 5 itens, ordenados por `diasParaVencer` (mais urgente primeiro)
3. Cada item exibe: nome, lote, quantidade, data de validade e badge de urgência

**Pós-condições:**
- Lista de alertas exibida ou empty state
- Botão "Ver todos os alertas" navega para `/clinic/inventory?filter=expiring`

---

### 4.4 UC-004: Acessar Ações Rápidas

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Página carregada

**Fluxo Principal:**
1. Usuário visualiza 4 botões de ação rápida
2. Clique em um botão navega para a rota correspondente

**Navegação:**
- Gerenciar Estoque → `/clinic/inventory`
- Procedimentos → `/clinic/requests`
- Pacientes → `/clinic/patients`
- Relatórios → `/clinic/reports`

**Pós-condições:**
- Usuário redirecionado para a página selecionada

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD DA CLÍNICA                        │
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
              │ Criar        │  │ useEffect não    │
              │ onSnapshot   │  │ executa (return) │
              │ listener     │  └──────────────────┘
              └──────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Processar snapshot   │
           │ do inventário        │
           │ (calcular stats em   │
           │  tempo real)         │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Promise.all([        │
           │   getPatientsStats,  │
           │   getRecentActivity, │
           │   getUpcomingProc.   │
           │ ])                   │
           └──────────────────────┘
                 │           │
            SUCESSO         ERRO
                 │           │
                 ▼           ▼
        ┌────────────┐  ┌────────────────┐
        │ setLoading  │  │ setError(msg)  │
        │ (false)     │  │ setLoading     │
        │ Exibir      │  │ (false)        │
        │ dados       │  │ Exibir Alert   │
        └────────────┘  └────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Dependência de tenant_id
**Descrição:** O dashboard depende do `tenant_id` extraído das claims de autenticação
**Aplicação:** Se `tenant_id` não existe, o `useEffect` retorna sem executar
**Exceções:** Nenhuma
**Justificativa:** Garantia de isolamento multi-tenant

### RN-002: Listener em Tempo Real
**Descrição:** O inventário é monitorado em tempo real via `onSnapshot` com filtro `active == true`
**Aplicação:** Qualquer alteração na coleção `inventory` do tenant atualiza automaticamente os stats
**Exceções:** Outros dados (pacientes, atividade, procedimentos) são carregados via promises dentro do callback
**Justificativa:** UX em tempo real para métricas críticas de estoque

### RN-003: Estoque Baixo
**Descrição:** Produtos com menos de 10 unidades são classificados como estoque baixo
**Aplicação:** Contagem exibida no card "Estoque Baixo" com destaque laranja
**Exceções:** Itens com `quantidade_disponivel == 0` são ignorados em todas as contagens
**Justificativa:** Limiar padrão para reposição de produtos médicos

### RN-004: Limite de Itens nas Listas
**Descrição:** Produtos vencendo, atividade recente e procedimentos próximos são limitados a 5 itens cada
**Aplicação:** `expiringItems.length < 5`, `getRecentActivity(tenantId, 5)`, `getUpcomingProcedures(tenantId, 5)`
**Exceções:** Botões "Ver todos" disponíveis para acessar lista completa
**Justificativa:** Dashboard deve ser uma visão resumida, não uma listagem completa

### RN-005: Formatação de Moeda
**Descrição:** Valores monetários formatados em BRL (pt-BR)
**Aplicação:** Card "Valor Total" usa `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`
**Exceções:** Nenhuma
**Justificativa:** Sistema brasileiro, moeda local

### RN-006: Cálculo Paralelo de Dados
**Descrição:** Dados de pacientes, atividade e procedimentos são carregados em paralelo via `Promise.all`
**Aplicação:** Dentro do callback do `onSnapshot`, após calcular stats do inventário
**Exceções:** Se qualquer promise falhar, erro é capturado no catch
**Justificativa:** Melhor performance — reduz tempo total de carregamento

### RN-007: isAdmin Sem Efeito Visual
**Descrição:** Variável `isAdmin` é calculada (`claims?.role === "clinic_admin"`) mas não condiciona visibilidade nesta página
**Aplicação:** Presente no código para uso futuro ou consistência
**Exceções:** Nenhuma
**Justificativa:** Ambos os roles veem o mesmo conteúdo no dashboard

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** Desde o mount do componente até os dados serem carregados
**Exibição:** Skeletons animados em todos os 6 cards de estatísticas e nas 3 listas (procedimentos, alertas, atividade)
**Interações:** Nenhuma — ações desabilitadas durante loading
**Duração:** Até o callback do `onSnapshot` e `Promise.all` completarem

### 7.2 Estado: Dados Carregados
**Quando:** Após loading concluído com sucesso
**Exibição:** Cards com valores reais, listas populadas ou empty states
**Campos/Elementos:**
- 6 cards de estatísticas (grid responsivo: 2 cols md, 3 cols lg, 6 cols xl)
- Card de ações rápidas (4 botões)
- 3 cards de listas: Próximos Procedimentos, Alertas de Vencimento, Atividade Recente

**Links/Navegação:**
- "Gerenciar Estoque" → `/clinic/inventory`
- "Procedimentos" → `/clinic/requests`
- "Pacientes" → `/clinic/patients`
- "Relatórios" → `/clinic/reports`
- "Ver todos os alertas" → `/clinic/inventory?filter=expiring`
- "Ver todos os procedimentos" → `/clinic/requests`
- Clique em procedimento → `/clinic/requests?id={proc.id}`

### 7.3 Estado: Erro
**Quando:** Falha no `onSnapshot` ou no `Promise.all`
**Exibição:**
- Alert variant `destructive` com ícone AlertTriangle
- Título: "Erro"
- Mensagem: "Erro ao carregar dados do dashboard"

### 7.4 Estado: Sem Procedimentos
**Quando:** `upcomingProcedures.length === 0`
**Exibição:**
- Ícone Calendar grande (h-12 w-12) com opacidade 50%
- Texto: "Nenhum procedimento agendado nas próximas 2 semanas"

### 7.5 Estado: Sem Alertas de Vencimento
**Quando:** `expiringProducts.length === 0`
**Exibição:**
- Ícone Package grande (h-12 w-12) com opacidade 50%
- Texto: "Nenhum produto vencendo nos próximos 30 dias"

### 7.6 Estado: Sem Atividade Recente
**Quando:** `recentActivity.length === 0`
**Exibição:**
- Ícone Clock grande (h-12 w-12) com opacidade 50%
- Texto: "Nenhuma movimentação recente"

---

## 8. Validações

### 8.1 Validações de Frontend
- **tenant_id:**
  - Se `tenantId` não existe, o `useEffect` não executa (early return)
  - Extraído de `claims?.tenant_id`

- **quantidade_disponivel:**
  - Itens com quantidade `== 0` são ignorados em todas as contagens
  - Fallback: `data.quantidade_disponivel || 0`

- **dt_validade:**
  - Suporta tanto `Timestamp` do Firestore quanto `Date` string
  - Conversão: `data.dt_validade instanceof Timestamp ? data.dt_validade.toDate() : new Date(data.dt_validade)`

### 8.2 Validações de Backend
- **Listener Firestore:** Filtro `where("active", "==", true)` garante que apenas itens ativos são processados
- **Cleanup:** `unsubscribeInventory()` chamado no unmount do componente

### 8.3 Validações de Permissão
- **Acesso à página:** Controlado pelo Clinic Layout — apenas `clinic_admin` e `clinic_user` com `tenant_id` válido
- **Dados do tenant:** Query do Firestore usa `tenant_id` das claims, garantindo isolamento multi-tenant

---

## 9. Integrações

### 9.1 Firestore — onSnapshot (Inventário em Tempo Real)
- **Tipo:** Listener realtime
- **Coleção:** `tenants/{tenantId}/inventory`
- **Filtro:** `where("active", "==", true)`
- **Operações:** Read (listener)
- **Campos utilizados:** `quantidade_disponivel`, `valor_unitario`, `dt_validade`, `nome_produto`, `lote`
- **Quando:** Mount do componente (com cleanup no unmount)

### 9.2 inventoryService — getRecentActivity
- **Tipo:** Serviço
- **Método:** `getRecentActivity(tenantId, 5)`
- **Entrada:** tenant_id + limite
- **Retorno:** `RecentActivity[]` (até 5 itens)
- **Quando:** Dentro do callback do onSnapshot

### 9.3 patientService — getPatientsStats
- **Tipo:** Serviço
- **Método:** `getPatientsStats(tenantId)`
- **Entrada:** tenant_id
- **Retorno:** `{ total, novos_mes, novos_3_meses }`
- **Quando:** Dentro do callback do onSnapshot (via Promise.all)

### 9.4 solicitacaoService — getUpcomingProcedures
- **Tipo:** Serviço
- **Método:** `getUpcomingProcedures(tenantId, 5)`
- **Entrada:** tenant_id + limite
- **Retorno:** `Solicitacao[]` (até 5 itens)
- **Quando:** Dentro do callback do onSnapshot (via Promise.all)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via `tenant_id` nas queries Firestore
- ✅ Acesso controlado pelo Clinic Layout (custom claims)
- ✅ Listener limpo no unmount do componente (prevenção de memory leak)
- ✅ Tratamento de erros no onSnapshot (callback de erro)
- ✅ Fallback para valores nulos/undefined em campos numéricos (`|| 0`)

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Nenhuma vulnerabilidade conhecida

### 10.3 Dados Sensíveis
- **tenant_id:** Extraído das claims (JWT), não exposto na URL
- **Dados de pacientes:** Apenas nome e código exibidos nos procedimentos
- **Valores monetários:** Exibidos apenas para usuários autorizados do tenant

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** Depende do tamanho do inventário + 3 queries paralelas
- **Requisições:** 1 listener realtime + 3 queries paralelas (`Promise.all`)
- **Re-renders:** Automáticos a cada mudança no inventário (onSnapshot)

### 11.2 Otimizações Implementadas
- ✅ Dados complementares carregados em paralelo via `Promise.all`
- ✅ Cálculo de stats feito diretamente no snapshot (evita query adicional)
- ✅ Limites de 5 itens nas listas (evita renderização excessiva)
- ✅ Cleanup do listener no unmount (evita memory leak)
- ✅ Early return se `tenantId` não existe

### 11.3 Gargalos Identificados
- ⚠️ Stats recalculados a cada mudança no inventário (inclui todos os docs do snapshot)
- ⚠️ Dados de pacientes/atividade/procedimentos recarregados a cada trigger do onSnapshot
- **Plano de melhoria:** Considerar memoização ou debounce para inventários muito grandes

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Estrutura semântica com headings hierárquicos (h2, h3)
- ✅ Badges com cores contrastantes para status e urgência
- ✅ Ícones acompanhados de texto (não dependem apenas de cor)
- ✅ Skeletons para feedback visual durante carregamento
- ✅ Alert com título e descrição para erros

### 12.3 Melhorias Necessárias
- [ ] Adicionar aria-labels aos cards de estatísticas
- [ ] Adicionar roles e aria-live para atualizações em tempo real
- [ ] Melhorar navegação por teclado nos cards clicáveis de procedimentos

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Dashboard carrega com dados**
   - **Dado:** Tenant com inventário ativo, pacientes e procedimentos
   - **Quando:** Página monta
   - **Então:** 6 cards exibem métricas corretas, listas populadas

2. **Dashboard com inventário vazio**
   - **Dado:** Tenant sem itens no inventário
   - **Quando:** Página monta
   - **Então:** Cards mostram 0, listas mostram empty states

3. **Atualização em tempo real**
   - **Dado:** Dashboard carregado
   - **Quando:** Item adicionado/removido do inventário
   - **Então:** Cards de estatísticas atualizam automaticamente

4. **Ações rápidas navegam corretamente**
   - **Dado:** Dashboard carregado
   - **Quando:** Clique em "Gerenciar Estoque"
   - **Então:** Navega para `/clinic/inventory`

### 13.2 Casos de Teste de Erro
1. **Erro no Firestore:** Alert destructive exibido com mensagem "Erro ao carregar dados do dashboard"
2. **tenant_id ausente:** useEffect não executa, nenhum dado carregado
3. **dt_validade inválida:** Conversão segura via `instanceof Timestamp` check

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar isolamento multi-tenant (dados de outro tenant não aparecem)
- [ ] Testar cleanup do listener ao navegar para outra página

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Diferenciar visibilidade por role (clinic_admin vs clinic_user)
- [ ] Adicionar gráficos de tendência de estoque
- [ ] Adicionar filtro por período nos cards de estatísticas
- [ ] Notificações push para alertas de vencimento críticos

### 14.2 UX/UI
- [ ] Animações de transição nos cards ao atualizar valores
- [ ] Tooltip com detalhes ao hover nos cards de estatísticas
- [ ] Modo compacto para mobile

### 14.3 Performance
- [ ] Debounce no processamento do onSnapshot para inventários grandes
- [ ] Cache local das stats de pacientes (não mudam com frequência)
- [ ] Separar listener do inventário do carregamento de dados complementares

### 14.4 Segurança
- [ ] Logging de acesso ao dashboard para auditoria
- [ ] Rate limiting nas queries de serviços

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Inventário (`/clinic/inventory`):** Destino de ação rápida e link "Ver todos os alertas"
- **Procedimentos (`/clinic/requests`):** Destino de ação rápida, lista de próximos e "Ver todos"
- **Pacientes (`/clinic/patients`):** Destino de ação rápida, dados de stats
- **Relatórios (`/clinic/reports`):** Destino de ação rápida

### 15.2 Fluxos que Passam por Esta Página
1. **Login → Dashboard:** Após login com clínica ativa, usuário é redirecionado aqui
2. **Dashboard → Inventário:** Via ação rápida ou link de alertas
3. **Dashboard → Procedimento específico:** Via clique em item da lista de próximos procedimentos

### 15.3 Impacto de Mudanças
- **Alto impacto:** `inventoryService` (stats do inventário), coleção `inventory` do Firestore
- **Médio impacto:** `patientService`, `solicitacaoService` (dados complementares)
- **Baixo impacto:** Componentes Shadcn/ui, ícones Lucide

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **onSnapshot para inventário:** Escolhido para UX em tempo real — alterações no estoque refletem imediatamente no dashboard
- **Promise.all dentro do callback:** Dados complementares (pacientes, atividade, procedimentos) são recarregados a cada trigger do snapshot; trade-off: simplicidade vs eficiência
- **Stats calculados no frontend:** Em vez de uma Cloud Function, o cálculo é feito no cliente a partir do snapshot completo

### 16.2 Padrões Utilizados
- **Realtime listener pattern:** `onSnapshot` com cleanup no `useEffect` return
- **Parallel data loading:** `Promise.all` para múltiplas queries independentes
- **Defensive coding:** Fallbacks com `|| 0` para campos numéricos, `instanceof` check para timestamps

### 16.3 Limitações Conhecidas
- ⚠️ O snapshot carrega TODOS os documentos ativos do inventário para calcular stats — pode ser lento para inventários muito grandes (>1000 itens)
- ⚠️ Dados complementares (pacientes, atividade, procedimentos) são recarregados a cada trigger do onSnapshot, mesmo que o inventário tenha mudado minimamente

### 16.4 Notas de Implementação
- Saudação exibe apenas o primeiro nome: `user?.displayName?.split(" ")[0]`
- Badges de vencimento: `destructive` (< 7 dias ou vencido), `warning` (8-30 dias), `default` (> 30 dias)
- Badges de status de procedimento: `criada` (secondary), `agendada/aprovada/concluida` (default), `reprovada/cancelada` (destructive)
- Grid responsivo: 2 cols (md), 3 cols (lg), 6 cols (xl) para cards de estatísticas
- Formatação de data relativa nos procedimentos: "Hoje", "Amanhã", "Em X dias" ou "dd/mmm"

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **tenant_id:** Identificador único da clínica no sistema multi-tenant
- **claims:** Custom Claims do Firebase Authentication (role, tenant_id, active, etc.)
- **onSnapshot:** Listener em tempo real do Firestore que recebe atualizações automáticas
- **Estoque Baixo:** Produto com menos de 10 unidades disponíveis
- **Empty State:** Estado visual quando não há dados para exibir em uma lista

---

## 19. Referências

### 19.1 Documentação Relacionada
- Inventário da Clínica - `project_doc/clinic/inventory-list-documentation.md`
- Procedimentos da Clínica - `project_doc/clinic/requests-list-documentation.md`
- Pacientes da Clínica - `project_doc/clinic/patients-list-documentation.md`
- Relatórios da Clínica - `project_doc/clinic/reports-documentation.md`

### 19.2 Links Externos
- Firebase Firestore onSnapshot - https://firebase.google.com/docs/firestore/query-data/listen
- Shadcn/ui Card - https://ui.shadcn.com/docs/components/card

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/dashboard/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`
- **Services:** `src/lib/services/inventoryService.ts`, `src/lib/services/patientService.ts`, `src/lib/services/solicitacaoService.ts`
- **Types:** `src/types/index.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots da interface em diferentes estados]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Badge de vencimento — lógica de cores
const getExpiryBadgeVariant = (diasParaVencer: number) => {
  if (diasParaVencer < 0) return "destructive";   // Vencido
  if (diasParaVencer <= 7) return "destructive";   // Urgente
  if (diasParaVencer <= 30) return "warning";      // Atenção
  return "default";                                 // Normal
};

// Formatação de data relativa para procedimentos
const formatProcedureDate = (timestamp: any) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffDays = Math.ceil((date.getTime() - Date.now()) / (86400000));
  if (diffDays < 0) return "Atrasado";
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays <= 7) return `Em ${diffDays} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
};
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
