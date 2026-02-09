# Documentação Experimental - Listagem de Inventário

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Inventário
**Componente:** Listagem de Inventário (`/clinic/inventory`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página principal de gerenciamento de estoque da clínica. Exibe todos os produtos ativos do inventário em formato de tabela com filtros, busca textual, cards de resumo estatístico e exportação para Excel. Utiliza listener em tempo real do Firestore para atualização automática dos dados.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/inventory/page.tsx`
- **Rota:** `/clinic/inventory`
- **Layout:** Clinic Layout (restrito a `clinic_admin` e `clinic_user`)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims do usuário
- **inventoryService:** `src/lib/services/inventoryService.ts` — `listInventory`, tipo `InventoryItem`
- **reportService:** `src/lib/services/reportService.ts` — `exportToExcel`, `formatDecimalBR`
- **Firebase Firestore:** `collection`, `query`, `where`, `orderBy`, `onSnapshot`, `Timestamp`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Badge, Skeleton
- **Lucide Icons:** Package, Search, Filter, Download, AlertTriangle, Calendar, TrendingDown, Plus

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Visualização completa do inventário + botão "Adicionar Produtos"
- **Comportamento:** Pode buscar, filtrar, exportar e adicionar produtos
- **Restrições:** Vinculado a um `tenant_id` específico

### 2.2 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Visualização completa do inventário (somente leitura + exportação)
- **Comportamento:** Pode buscar, filtrar e exportar, mas NÃO adicionar produtos
- **Restrições:** Botão "Adicionar Produtos" oculto; vinculado a um `tenant_id` específico

---

## 3. Estrutura de Dados

### 3.1 Interface InventoryItem

```typescript
interface InventoryItem {
  id: string;                    // ID do documento Firestore
  tenant_id: string;             // ID do tenant
  produto_id: string;            // ID do produto no catálogo master
  codigo_produto: string;        // Código do produto (7-8 dígitos)
  nome_produto: string;          // Nome do produto
  lote: string;                  // Número do lote
  quantidade_inicial: number;    // Quantidade original na entrada
  quantidade_disponivel: number; // Quantidade disponível atual
  quantidade_reservada: number;  // Quantidade reservada para procedimentos
  dt_validade: Date;             // Data de validade
  dt_entrada: Date;              // Data de entrada no estoque
  valor_unitario: number;        // Valor unitário (R$)
  nf_numero: string;             // Número da nota fiscal
  nf_id: string;                 // ID da importação da NF
  active: boolean;               // Status ativo/inativo
  created_at: Date;              // Data de criação
  updated_at: Date;              // Data da última atualização
}
```

**Campos Principais:**
- **quantidade_disponivel:** Estoque efetivamente disponível para uso
- **quantidade_reservada:** Quantidade alocada para procedimentos agendados (ainda não consumida)
- **Qtd. Total:** Calculado como `quantidade_disponivel + quantidade_reservada`
- **dt_validade:** Converte de `Timestamp` do Firestore ou string para `Date` JS

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Inventário Completo

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Usuário autenticado com `tenant_id` válido
- Clínica ativa

**Fluxo Principal:**
1. Página carrega e extrai `tenant_id` das claims
2. Listener `onSnapshot` criado na coleção `tenants/{tenantId}/inventory` com filtros `active == true` e `orderBy nome_produto asc`
3. Dados processados e exibidos em tabela com 9 colunas
4. Cards de resumo calculados a partir do array completo

**Pós-condições:**
- Tabela exibida com todos os produtos ativos
- Cards de resumo atualizados
- Dados atualizam automaticamente em tempo real

---

### 4.2 UC-002: Buscar Produto

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Inventário carregado

**Fluxo Principal:**
1. Usuário digita no campo de busca
2. Filtro aplicado case-insensitive em `nome_produto`, `codigo_produto` e `lote`
3. Tabela atualizada com resultados filtrados

**Pós-condições:**
- Apenas itens correspondentes exibidos
- Contador de produtos atualizado no header da tabela

---

### 4.3 UC-003: Filtrar por Status

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Inventário carregado

**Fluxo Principal:**
1. Usuário clica em um dos botões de filtro: Todos, Vencendo, Estoque Baixo, Esgotado
2. Filtro correspondente aplicado:
   - **Vencendo:** `dt_validade <= 30 dias` e `quantidade_disponivel > 0`
   - **Estoque Baixo:** `0 < quantidade_disponivel < 10`
   - **Esgotado:** `quantidade_disponivel === 0`
3. Tabela atualizada

**Fluxo Alternativo — Filtro via URL:**
1. Página carregada com `?filter=expiring` na URL
2. Filtro "Vencendo" aplicado automaticamente na primeira carga

**Pós-condições:**
- Tabela filtrada conforme critério selecionado
- Botão do filtro ativo com visual `default`, outros com `outline`

---

### 4.4 UC-004: Exportar para Excel

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Inventário carregado (loading = false)

**Fluxo Principal:**
1. Usuário clica no botão "Exportar Excel"
2. Dados filtrados são mapeados para formato de exportação
3. Função `exportToExcel` gera o arquivo

**Campos Exportados:** Código, Produto, Lote, Qtd. Total, Reservado, Disponível, Validade, Valor Unitário, NF

**Pós-condições:**
- Arquivo Excel baixado pelo navegador

---

### 4.5 UC-005: Adicionar Produtos

**Ator:** clinic_admin (exclusivo)
**Pré-condições:**
- Usuário com role `clinic_admin`

**Fluxo Principal:**
1. Usuário clica no botão "Adicionar Produtos"
2. Navegação para `/clinic/add-products`

**Pós-condições:**
- Usuário redirecionado para página de adição de produtos

---

### 4.6 UC-006: Ver Detalhes do Produto

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Inventário carregado com ao menos 1 produto

**Fluxo Principal:**
1. Usuário clica em uma linha da tabela
2. Navegação para `/clinic/inventory/{item.id}`

**Pós-condições:**
- Usuário redirecionado para página de detalhes do produto

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    LISTAGEM DE INVENTÁRIO                        │
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
              │ Criar        │  │ Não inicia       │
              │ onSnapshot   │  │ listener         │
              │ listener     │  └──────────────────┘
              └──────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ Processar snapshot   │
           │ (converter docs em   │
           │  InventoryItem[])    │
           └──────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ ?filter=expiring     │
           │ na URL?              │
           └──────────────────────┘
                 │           │
               SIM          NÃO
                 │           │
                 ▼           ▼
        ┌────────────┐  ┌────────────────┐
        │ Aplicar     │  │ Exibir todos  │
        │ filtro      │  │ os itens      │
        │ "expiring"  │  └────────────────┘
        └────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ Usuário interage:      │
        │ - Busca textual        │
        │ - Filtro por status    │
        │ - Exportar Excel       │
        │ - Clique em linha      │
        │ - Adicionar (admin)    │
        └────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Isolamento Multi-Tenant
**Descrição:** Dados filtrados exclusivamente pelo `tenantId` do usuário autenticado
**Aplicação:** Query Firestore usa `tenants/{tenantId}/inventory`
**Exceções:** Nenhuma
**Justificativa:** Garantia de privacidade entre clínicas

### RN-002: Apenas Itens Ativos
**Descrição:** Somente itens com `active == true` são carregados
**Aplicação:** Filtro `where("active", "==", true)` na query Firestore
**Exceções:** Nenhuma
**Justificativa:** Itens inativos (excluídos logicamente) não devem aparecer na listagem

### RN-003: Ordenação Padrão
**Descrição:** Produtos ordenados por `nome_produto` em ordem ascendente
**Aplicação:** `orderBy("nome_produto", "asc")` na query Firestore
**Exceções:** Nenhuma
**Justificativa:** Facilitar localização visual do produto

### RN-004: Botão Adicionar Apenas para Admin
**Descrição:** Botão "Adicionar Produtos" visível apenas para `clinic_admin`
**Aplicação:** Condição `isAdmin && (...)` no render
**Exceções:** Nenhuma
**Justificativa:** Controle de quem pode adicionar produtos ao estoque

### RN-005: Filtro de Vencimento
**Descrição:** Produtos com validade em até 30 dias e quantidade disponível > 0
**Aplicação:** Filtro "Vencendo" na interface
**Exceções:** Produtos com `quantidade_disponivel === 0` são excluídos mesmo se vencendo
**Justificativa:** Não alertar sobre vencimento de itens sem estoque

### RN-006: Estoque Baixo
**Descrição:** Produtos com `0 < quantidade_disponivel < 10` são classificados como estoque baixo
**Aplicação:** Filtro "Estoque Baixo" e badge na tabela
**Exceções:** Itens com quantidade 0 são classificados como "Esgotado" (diferente)
**Justificativa:** Limiar padrão para reposição

### RN-007: Busca Case-Insensitive
**Descrição:** Busca textual ignora maiúsculas/minúsculas
**Aplicação:** `toLowerCase()` aplicado tanto no termo de busca quanto nos campos
**Exceções:** Nenhuma
**Justificativa:** UX — usuário não precisa se preocupar com capitalização

### RN-008: Listener Realtime
**Descrição:** Dados atualizam automaticamente via `onSnapshot` sem necessidade de refresh
**Aplicação:** Qualquer alteração na coleção `inventory` do tenant reflete na tela
**Exceções:** Nenhuma
**Justificativa:** UX em tempo real para operações críticas de estoque

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** Desde o mount até o primeiro callback do `onSnapshot`
**Exibição:** 5 Skeletons em formato de linha (`h-16 w-full`)
**Interações:** Botão "Exportar Excel" desabilitado
**Duração:** Até dados serem recebidos

### 7.2 Estado: Dados Carregados
**Quando:** Após recebimento do snapshot com sucesso
**Exibição:** Cards de resumo + card de filtros + tabela com linhas clicáveis
**Campos/Elementos:**
- 4 cards de estatísticas (Total, Disponíveis, Vencendo, Estoque Baixo)
- Campo de busca textual
- 4 botões de filtro (Todos, Vencendo, Estoque Baixo, Esgotado)
- Tabela com 9 colunas e linhas clicáveis
- Botão "Exportar Excel" + "Adicionar Produtos" (admin)

**Links/Navegação:**
- Clique em linha → `/clinic/inventory/{item.id}`
- "Adicionar Produtos" → `/clinic/add-products` (admin)

### 7.3 Estado: Erro
**Quando:** Falha no listener `onSnapshot`
**Exibição:**
- Texto centralizado em vermelho (destructive): "Erro ao carregar inventário"

### 7.4 Estado: Vazio
**Quando:** `filteredInventory.length === 0`
**Exibição:**
- Ícone Package (h-12 w-12) com opacidade 50%
- Título: "Nenhum produto encontrado"
- Subtítulo contextual: "Tente ajustar os filtros ou busca" (se filtro/busca ativos) ou "Faça upload de uma DANFE para adicionar produtos" (se sem filtros)

### 7.5 Badges de Validade

| Condição | Variante | Texto |
|----------|----------|-------|
| `quantidade_disponivel === 0` | secondary | "Sem estoque" |
| Dias < 0 | destructive | "Vencido" |
| Dias <= 7 | destructive | "{X} dias" |
| Dias <= 30 | warning | "{X} dias" |
| Dias > 30 | default | "{X} dias" |

### 7.6 Badges de Estoque

| Condição | Variante | Texto / Ícone |
|----------|----------|---------------|
| `quantidade_disponivel === 0` | destructive | "Esgotado" + TrendingDown |
| `quantidade_disponivel < 10` | warning | "Baixo" + AlertTriangle |
| `quantidade_disponivel >= 10` | default | "Normal" |

---

## 8. Validações

### 8.1 Validações de Frontend
- **tenant_id:**
  - Se nulo, o `useEffect` não inicia o listener Firestore
  - Extraído de `claims?.tenant_id`

- **Timestamp fields:**
  - Conversão segura via `data.field instanceof Timestamp ? data.field.toDate() : new Date(data.field)`
  - Aplicado em: `dt_validade`, `dt_entrada`, `created_at`, `updated_at`

- **quantidade_reservada:**
  - Fallback: `item.quantidade_reservada || 0` em cálculos

### 8.2 Validações de Backend
- **Query Firestore:** `where("active", "==", true)` + `orderBy("nome_produto", "asc")`
- **Cleanup:** `unsubscribe()` chamado no unmount do componente

### 8.3 Validações de Permissão
- **Acesso à página:** Controlado pelo Clinic Layout
- **Botão Adicionar:** Condicional por `isAdmin` (`claims?.role === "clinic_admin"`)
- **Dados do tenant:** Query usa path `tenants/{tenantId}/inventory`

---

## 9. Integrações

### 9.1 Firestore — onSnapshot (Inventário em Tempo Real)
- **Tipo:** Listener realtime
- **Coleção:** `tenants/{tenantId}/inventory`
- **Filtros:** `where("active", "==", true)`, `orderBy("nome_produto", "asc")`
- **Operações:** Read (listener contínuo)
- **Campos utilizados:** Todos os campos do `InventoryItem`
- **Quando:** Mount do componente (com cleanup no unmount)

### 9.2 reportService — exportToExcel
- **Tipo:** Serviço utilitário
- **Método:** `exportToExcel(data, "inventario")`
- **Entrada:** Array de objetos formatados + nome do arquivo
- **Retorno:** Download do arquivo Excel
- **Quando:** Clique no botão "Exportar Excel"

### 9.3 reportService — formatDecimalBR
- **Tipo:** Formatador
- **Método:** `formatDecimalBR(value, 2)`
- **Entrada:** Número + casas decimais
- **Retorno:** String formatada em pt-BR
- **Quando:** Exportação de valores unitários para Excel

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via path `tenants/{tenantId}/inventory`
- ✅ Acesso controlado pelo Clinic Layout (custom claims)
- ✅ Botão de adição restrito a `clinic_admin`
- ✅ Listener limpo no unmount (prevenção de memory leak)
- ✅ Tratamento de erros no callback de erro do `onSnapshot`

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Nenhuma vulnerabilidade conhecida

### 10.3 Dados Sensíveis
- **tenant_id:** Extraído das claims (JWT), não exposto na URL
- **Valores monetários:** Exibidos apenas para usuários autorizados do tenant
- **Dados de NF:** Número da nota fiscal exibido na exportação Excel

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** Depende do tamanho do inventário
- **Requisições:** 1 listener realtime (onSnapshot)
- **Rendering:** `force-dynamic` + `Suspense` wrapping para `useSearchParams()`

### 11.2 Otimizações Implementadas
- ✅ Listener realtime (evita polling)
- ✅ Filtros aplicados no frontend (evita re-queries)
- ✅ Cleanup do listener no unmount
- ✅ `Suspense` com fallback para `useSearchParams()`

### 11.3 Gargalos Identificados
- ⚠️ Todos os documentos do inventário são carregados em memória (sem paginação)
- ⚠️ Filtros recalculados a cada mudança no `inventory`, `searchTerm` ou `filterBy`
- **Plano de melhoria:** Implementar paginação ou virtualização para inventários grandes (>500 itens)

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Tabela semântica com `<Table>`, `<TableHeader>`, `<TableBody>`
- ✅ Input de busca com placeholder descritivo
- ✅ Badges com cores contrastantes
- ✅ Ícones acompanhados de texto

### 12.3 Melhorias Necessárias
- [ ] Adicionar `aria-label` ao campo de busca
- [ ] Adicionar `aria-sort` às colunas da tabela
- [ ] Melhorar feedback de screen reader para badges de status
- [ ] Adicionar `role="status"` no contador de produtos filtrados

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Inventário carrega com dados**
   - **Dado:** Tenant com produtos ativos
   - **Quando:** Página monta
   - **Então:** Tabela exibe produtos, cards mostram estatísticas corretas

2. **Busca textual funciona**
   - **Dado:** Inventário carregado
   - **Quando:** Usuário digita "TOXINA" no campo de busca
   - **Então:** Apenas produtos com "TOXINA" no nome, código ou lote são exibidos

3. **Filtro "Vencendo" funciona**
   - **Dado:** Inventário com produtos de diferentes validades
   - **Quando:** Clique no botão "Vencendo"
   - **Então:** Apenas itens com validade <= 30 dias e quantidade > 0

4. **Exportação Excel**
   - **Dado:** Inventário com dados filtrados
   - **Quando:** Clique em "Exportar Excel"
   - **Então:** Arquivo Excel gerado com os dados filtrados atuais

### 13.2 Casos de Teste de Erro
1. **Erro no Firestore:** Mensagem "Erro ao carregar inventário" exibida em vermelho
2. **tenant_id ausente:** Listener não é criado, tela permanece em loading
3. **Inventário vazio:** Empty state com ícone e mensagem contextual

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar filtro via URL `?filter=expiring`
- [ ] Testar isolamento multi-tenant
- [ ] Testar exportação Excel com diferentes filtros ativos

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Paginação ou virtualização da tabela
- [ ] Ordenação por coluna (clique no header)
- [ ] Filtro por faixa de valor unitário
- [ ] Seleção múltipla para ações em lote

### 14.2 UX/UI
- [ ] Tooltip com detalhes ao hover nos badges
- [ ] Contador de resultados por filtro nos botões
- [ ] Modo compacto para mobile

### 14.3 Performance
- [ ] Paginação server-side para inventários grandes
- [ ] Debounce na busca textual
- [ ] Memoização dos cálculos de filtros

### 14.4 Segurança
- [ ] Logging de exportações Excel para auditoria
- [ ] Rate limiting na exportação

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Detalhes do Produto (`/clinic/inventory/{id}`):** Destino ao clicar em uma linha
- **Adicionar Produtos (`/clinic/add-products`):** Destino do botão "Adicionar Produtos"
- **Dashboard (`/clinic/dashboard`):** Link "Ver todos os alertas" aponta para esta página com `?filter=expiring`

### 15.2 Fluxos que Passam por Esta Página
1. **Dashboard → Inventário:** Via ação rápida "Gerenciar Estoque" ou "Ver todos os alertas"
2. **Inventário → Detalhe:** Via clique em linha da tabela
3. **Inventário → Adicionar Produtos:** Via botão (admin)

### 15.3 Impacto de Mudanças
- **Alto impacto:** `InventoryItem` (tipo usado em toda a aplicação), coleção `inventory` no Firestore
- **Médio impacto:** `reportService` (exportação Excel)
- **Baixo impacto:** Componentes Shadcn/ui, ícones Lucide

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Suspense wrapping:** Necessário porque `useSearchParams()` requer `Suspense` boundary no Next.js 15 App Router
- **force-dynamic:** Evita problemas de caching com dados em tempo real
- **Filtros no frontend:** Dados já carregados em memória, filtros aplicados sem novas queries

### 16.2 Padrões Utilizados
- **Realtime listener pattern:** `onSnapshot` com cleanup no `useEffect` return
- **Component composition:** `InventoryPage` wraps `InventoryContent` com `Suspense`
- **Controlled inputs:** Campo de busca e filtros via `useState`

### 16.3 Limitações Conhecidas
- ⚠️ Todos os documentos ativos são carregados — sem paginação server-side
- ⚠️ Filtro via URL (`?filter=expiring`) aplicado apenas na primeira carga dos dados
- ⚠️ Empty state menciona "upload de DANFE" mas essa funcionalidade está desabilitada no MVP

### 16.4 Notas de Implementação
- Componente interno `InventoryContent` separado do `InventoryPage` para suporte ao `Suspense`
- `dynamic = 'force-dynamic'` exportado para evitar pre-rendering estático
- Listener automaticamente desvinculado (`unsubscribe`) ao desmontar o componente
- Exportação Excel usa `filteredInventory` (dados já filtrados pela busca/filtro ativo)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **tenant_id:** Identificador único da clínica no sistema multi-tenant
- **onSnapshot:** Listener em tempo real do Firestore que recebe atualizações automáticas
- **Estoque Baixo:** Produto com 1-9 unidades disponíveis
- **Esgotado:** Produto com 0 unidades disponíveis
- **Vencendo:** Produto com validade em até 30 dias e quantidade disponível > 0
- **quantity_reservada:** Quantidade alocada para procedimentos agendados

---

## 19. Referências

### 19.1 Documentação Relacionada
- Dashboard da Clínica - `project_doc/clinic/dashboard-documentation.md`
- Detalhes do Inventário - `project_doc/clinic/inventory-detail-documentation.md`
- Adicionar Produtos - `project_doc/clinic/add-products-documentation.md`
- Auditoria do Inventário - `project_doc/clinic/inventory-audit-documentation.md`

### 19.2 Links Externos
- Firebase Firestore onSnapshot - https://firebase.google.com/docs/firestore/query-data/listen
- Next.js Suspense with useSearchParams - https://nextjs.org/docs/app/api-reference/functions/use-search-params

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/inventory/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`
- **Services:** `src/lib/services/inventoryService.ts`, `src/lib/services/reportService.ts`
- **Types:** `src/types/index.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots da interface em diferentes estados]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Badge de validade — lógica de cores
const getExpiryBadge = (date: Date, quantity: number) => {
  if (quantity === 0) return <Badge variant="secondary">Sem estoque</Badge>;
  const days = getDaysUntilExpiry(date);
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days <= 7) return <Badge variant="destructive">{days} dias</Badge>;
  if (days <= 30) return <Badge variant="warning">{days} dias</Badge>;
  return <Badge variant="default">{days} dias</Badge>;
};

// Exportação Excel — mapeamento de campos
const handleExportInventory = () => {
  const data = filteredInventory.map((item) => ({
    "Código": item.codigo_produto,
    "Produto": item.nome_produto,
    "Lote": item.lote,
    "Qtd. Total": item.quantidade_disponivel + (item.quantidade_reservada || 0),
    "Reservado": item.quantidade_reservada || 0,
    "Disponível": item.quantidade_disponivel,
    "Validade": formatDate(item.dt_validade),
    "Valor Unitário": formatDecimalBR(item.valor_unitario, 2),
    "NF": item.nf_numero || "-",
  }));
  exportToExcel(data, "inventario");
};
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
