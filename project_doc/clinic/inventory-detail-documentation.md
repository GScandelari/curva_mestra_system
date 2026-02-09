# Documentação Experimental - Detalhes do Item de Inventário

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Inventário
**Componente:** Detalhe do Item de Inventário (`/clinic/inventory/{id}`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de visualização detalhada de um item individual do inventário. Exibe informações completas do produto incluindo identificação, quantidades (com barra de progresso de utilização), valores financeiros, datas importantes e informações de sistema. Acessada via clique na listagem de inventário. Somente leitura — não possui funcionalidade de edição ou exclusão.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/inventory/[id]/page.tsx`
- **Rota:** `/clinic/inventory/{id}` (rota dinâmica)
- **Layout:** Clinic Layout (restrito a `clinic_admin` e `clinic_user`)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims do usuário
- **inventoryService:** `src/lib/services/inventoryService.ts` — `getInventoryItem`, tipo `InventoryItem`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge, Skeleton
- **Lucide Icons:** ArrowLeft, Package, Calendar, DollarSign, TrendingDown, AlertTriangle, FileText, Barcode

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Visualização completa de todos os detalhes do produto
- **Comportamento:** Pode ver informações, verificar status, voltar ao inventário
- **Restrições:** Página somente leitura; vinculado a um `tenant_id` específico

### 2.2 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Mesma visualização do `clinic_admin`
- **Comportamento:** Idêntico ao admin — sem diferenciação nesta página
- **Restrições:** Página somente leitura; vinculado a um `tenant_id` específico

---

## 3. Estrutura de Dados

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
- **quantidade_inicial:** Quantidade de entrada — referência fixa para cálculo de utilização
- **quantidade_disponivel:** Estoque atual disponível para uso
- **Utilizado:** Calculado como `quantidade_inicial - quantidade_disponivel`
- **Valor Total em Estoque:** Calculado como `valor_unitario * quantidade_disponivel`

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Detalhes do Produto

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Usuário autenticado com `tenant_id` válido
- Item ID válido na URL

**Fluxo Principal:**
1. Usuário clica em um item na listagem de inventário
2. Página carrega com parâmetro `id` da URL via `useParams()`
3. `getInventoryItem(tenantId, itemId)` busca os dados
4. 4 cards exibidos: Informações do Produto, Estoque e Valores, Datas Importantes, Informações do Sistema

**Pós-condições:**
- Detalhes completos do item exibidos em layout de 2 colunas

---

### 4.2 UC-002: Verificar Status de Validade e Estoque

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Item carregado com sucesso

**Fluxo Principal:**
1. Badges no header exibem status de validade e estoque
2. Card "Datas Importantes" mostra data de validade com texto de status
3. Card "Estoque e Valores" mostra quantidades com barra de progresso

**Pós-condições:**
- Usuário pode avaliar rapidamente a situação do produto

---

### 4.3 UC-003: Voltar ao Inventário

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Página carregada (qualquer estado)

**Fluxo Principal:**
1. Usuário clica no botão "Voltar"
2. Navegação para `/clinic/inventory`

**Pós-condições:**
- Usuário redirecionado para a listagem de inventário

---

### 4.4 UC-004: Produto Não Encontrado

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- ID inválido ou item não pertence ao tenant

**Fluxo Principal:**
1. `getInventoryItem` retorna `null`
2. Tela de erro exibida com ícone AlertTriangle
3. Mensagem: "Produto não encontrado"
4. Botão "Voltar ao Inventário" disponível

**Mensagens de Erro:**
- `null return` → "Produto não encontrado"
- `exception` → "Erro ao carregar produto"

**Pós-condições:**
- Usuário pode retornar à listagem via botão

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                  DETALHES DO ITEM DE INVENTÁRIO                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ tenantId e       │
                    │ itemId existem?  │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ getInventory │  │ Não carrega      │
              │ Item()       │  │ (early return)   │
              └──────────────┘  └──────────────────┘
                      │
                 ┌────┴────┐
                 │         │
              DADOS      NULL/ERRO
                 │         │
                 ▼         ▼
        ┌────────────┐  ┌────────────────┐
        │ Exibir 4   │  │ Tela de erro   │
        │ cards com  │  │ + botão Voltar │
        │ detalhes   │  └────────────────┘
        └────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Multi-Tenant
**Descrição:** Item carregado via `getInventoryItem(tenantId, itemId)` respeitando isolamento multi-tenant
**Aplicação:** Dados filtrados pelo `tenant_id` do usuário autenticado
**Exceções:** Nenhuma
**Justificativa:** Garantia de privacidade entre clínicas

### RN-002: Nota Fiscal Condicional
**Descrição:** Campo de Nota Fiscal exibido apenas se `nf_numero` existir
**Aplicação:** Renderização condicional: `{item.nf_numero && (...)}`
**Exceções:** Produtos adicionados manualmente podem não ter NF
**Justificativa:** Evitar exibir campo vazio

### RN-003: Barra de Progresso de Utilização
**Descrição:** Percentual utilizado calculado como `(inicial - disponível) / inicial * 100`
**Aplicação:** Barra visual no card "Estoque e Valores"
**Exceções:** Nenhuma
**Justificativa:** Feedback visual rápido sobre o nível de consumo

### RN-004: Valor Total em Tempo de Renderização
**Descrição:** Valor total calculado como `valor_unitario * quantidade_disponivel`
**Aplicação:** Card "Estoque e Valores"
**Exceções:** Nenhuma
**Justificativa:** Valor dinâmico que muda conforme o estoque

### RN-005: Status de Validade

| Condição | Texto | Variante | Ícone |
|----------|-------|----------|-------|
| Dias < 0 | "Vencido" | destructive | AlertTriangle |
| Dias <= 7 | "Vence em {X} dias" | destructive | AlertTriangle |
| Dias <= 30 | "Vence em {X} dias" | warning | AlertTriangle |
| Dias > 30 | "Vence em {X} dias" | default | Calendar |

### RN-006: Status de Estoque

| Condição | Texto | Variante | Ícone |
|----------|-------|----------|-------|
| `quantidade_disponivel === 0` | "Esgotado" | destructive | TrendingDown |
| `quantidade_disponivel < 10` ou `< 20%` da inicial | "Estoque Baixo" | warning | AlertTriangle |
| Demais | "Estoque Normal" | default | Package |

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** Desde o mount até retorno do `getInventoryItem`
**Exibição:** Skeleton (1 título h-10 w-48 + 2 cards h-264 em grid 2 colunas)
**Interações:** Nenhuma
**Duração:** Até dados serem carregados

### 7.2 Estado: Dados Carregados
**Quando:** Item retornado com sucesso
**Exibição:** Layout com header (nome, código, badges) + 4 cards em 2 grids de 2 colunas
**Campos/Elementos:**
- Header: nome do produto, código, badge validade, badge estoque
- Card 1: Informações do Produto (código, nome, lote, NF)
- Card 2: Estoque e Valores (qtd. inicial, disponível, utilizado com barra, valor unitário, valor total)
- Card 3: Datas Importantes (validade, entrada)
- Card 4: Informações do Sistema (cadastrado em, última atualização, status)

**Links/Navegação:**
- Botão "Voltar" → `/clinic/inventory`

### 7.3 Estado: Erro / Produto Não Encontrado
**Quando:** `getInventoryItem` retorna `null` ou lança exceção
**Exibição:**
- Ícone AlertTriangle vermelho (h-12 w-12) centralizado
- Texto: "Produto não encontrado" ou mensagem de erro
- Botão "Voltar ao Inventário"

---

## 8. Validações

### 8.1 Validações de Frontend
- **tenantId:** Se nulo, `loadItem` retorna sem executar
- **itemId:** Se nulo, `loadItem` retorna sem executar (extraído via `useParams()`)
- **Retorno nulo:** Se `getInventoryItem` retorna `null`, exibe tela de erro

### 8.2 Validações de Backend
- **getInventoryItem:** Busca o documento em `tenants/{tenantId}/inventory/{itemId}`
- **Isolamento:** Acesso apenas a itens do próprio tenant

### 8.3 Validações de Permissão
- **Acesso à página:** Controlado pelo Clinic Layout
- **Dados do tenant:** Query usa `tenantId` das claims

---

## 9. Integrações

### 9.1 inventoryService — getInventoryItem
- **Tipo:** Serviço
- **Método:** `getInventoryItem(tenantId, itemId)`
- **Entrada:** `tenant_id` + `item_id` (da URL)
- **Retorno:** `InventoryItem | null`
- **Erros:** Lança exceção se falha na leitura do Firestore
- **Quando:** Mount do componente (via `useEffect`)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via `tenantId` na query
- ✅ Acesso controlado pelo Clinic Layout (custom claims)
- ✅ Página somente leitura (sem operações de escrita)
- ✅ Tratamento de erros com fallback para tela de erro

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Nenhuma vulnerabilidade conhecida

### 10.3 Dados Sensíveis
- **Valores monetários:** Exibidos apenas para usuários autorizados do tenant
- **Dados de NF:** Número da nota fiscal visível

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** 1 leitura Firestore (getDoc)
- **Requisições:** 1 query única
- **Tamanho do bundle:** Componente simples (~434 linhas)

### 11.2 Otimizações Implementadas
- ✅ Carga única (não usa listener realtime — adequado para visualização)
- ✅ Cálculos feitos em tempo de renderização (sem estado extra)
- ✅ Early return se `tenantId` ou `itemId` ausentes

### 11.3 Gargalos Identificados
- ⚠️ Nenhum gargalo significativo — página simples de leitura única

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Estrutura semântica com headings e cards
- ✅ Badges com ícones + texto (não dependem apenas de cor)
- ✅ Barra de progresso visual com texto complementar
- ✅ Botão "Voltar" com ícone e texto

### 12.3 Melhorias Necessárias
- [ ] Adicionar `aria-label` na barra de progresso
- [ ] Adicionar `role="progressbar"` com `aria-valuenow`
- [ ] Melhorar contraste em campos `text-muted-foreground`

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Item carrega com sucesso**
   - **Dado:** ID válido de um item do tenant
   - **Quando:** Página monta
   - **Então:** 4 cards exibem dados corretos

2. **Barra de progresso precisa**
   - **Dado:** Item com quantidade_inicial = 100 e quantidade_disponivel = 30
   - **Quando:** Card renderiza
   - **Então:** Barra mostra 70% preenchido, texto "70 unidades" utilizadas

3. **Badges de status corretos**
   - **Dado:** Item com validade em 5 dias
   - **Quando:** Página carrega
   - **Então:** Badge "Vence em 5 dias" com variante `destructive`

### 13.2 Casos de Teste de Erro
1. **Item não encontrado:** Tela de erro com "Produto não encontrado" e botão Voltar
2. **Erro de rede:** Tela de erro com "Erro ao carregar produto" e botão Voltar
3. **IDs ausentes:** Nenhum carregamento iniciado

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar isolamento multi-tenant (item de outro tenant → "não encontrado")
- [ ] Testar navegação "Voltar" retorna à listagem

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Edição inline de quantidades (ajuste manual)
- [ ] Histórico de movimentações do item
- [ ] Botão de exclusão lógica (soft delete)
- [ ] Link direto para a NF de origem

### 14.2 UX/UI
- [ ] Gráfico de consumo ao longo do tempo
- [ ] Tooltip na barra de progresso com percentual exato
- [ ] Animação de transição ao carregar

### 14.3 Performance
- [ ] Cache do item para evitar re-fetch ao voltar
- [ ] Prefetch de dados ao hover na listagem

### 14.4 Segurança
- [ ] Logging de visualizações para auditoria

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Listagem de Inventário (`/clinic/inventory`):** Página de origem e destino do botão "Voltar"
- **Dashboard (`/clinic/dashboard`):** Referência indireta via alertas de vencimento

### 15.2 Fluxos que Passam por Esta Página
1. **Inventário → Detalhe:** Via clique em linha da tabela
2. **Detalhe → Inventário:** Via botão "Voltar"

### 15.3 Impacto de Mudanças
- **Alto impacto:** `InventoryItem` (tipo compartilhado), `getInventoryItem` (serviço)
- **Médio impacto:** Lógica de badges (usada em outras páginas com mesmos critérios)
- **Baixo impacto:** Componentes Shadcn/ui, ícones Lucide

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Query única (sem realtime):** Para página de detalhe, uma leitura única é suficiente — não justifica listener
- **Somente leitura:** Edição/exclusão deliberadamente omitidas nesta versão para simplificar o MVP

### 16.2 Padrões Utilizados
- **Dynamic route pattern:** `[id]` no Next.js App Router + `useParams()`
- **Early return pattern:** Loading e erro renderizados antes do conteúdo principal
- **Computed display values:** Badges e barra de progresso calculados em tempo de render

### 16.3 Limitações Conhecidas
- ⚠️ Estoque baixo usa critério duplo (`< 10 unidades` OU `< 20% da inicial`) — diferente da listagem que usa apenas `< 10`
- ⚠️ Não atualiza em tempo real — se o estoque mudar enquanto a página está aberta, dados ficam desatualizados

### 16.4 Notas de Implementação
- Parâmetro `id` extraído via `useParams()` e cast para `string`
- Formatação de datas: `formatDate` (dd/mm/yyyy) e `formatDateTime` (dd/mm/yyyy HH:mm)
- Formatação de moeda: `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`
- Ícones dos badges são renderizados dinamicamente (`ExpiryIcon`, `StockIcon`)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **tenant_id:** Identificador único da clínica no sistema multi-tenant
- **InventoryItem:** Interface TypeScript que representa um item do inventário
- **Barra de Progresso:** Representação visual do percentual de consumo do produto
- **Soft Delete:** Exclusão lógica — item marcado como `active: false` em vez de removido

---

## 19. Referências

### 19.1 Documentação Relacionada
- Listagem de Inventário - `project_doc/clinic/inventory-list-documentation.md`
- Auditoria do Inventário - `project_doc/clinic/inventory-audit-documentation.md`
- Adicionar Produtos - `project_doc/clinic/add-products-documentation.md`

### 19.2 Links Externos
- Next.js Dynamic Routes - https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/inventory/[id]/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`
- **Services:** `src/lib/services/inventoryService.ts`
- **Types:** `src/types/index.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots da interface em diferentes estados]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Status de estoque — critério duplo (absoluto + percentual)
const getStockStatus = (quantity: number, initial: number) => {
  const percentage = (quantity / initial) * 100;
  if (quantity === 0) {
    return { text: "Esgotado", variant: "destructive", icon: TrendingDown };
  }
  if (quantity < 10 || percentage < 20) {
    return { text: "Estoque Baixo", variant: "warning", icon: AlertTriangle };
  }
  return { text: "Estoque Normal", variant: "default", icon: Package };
};

// Barra de progresso de utilização
const percentUtilizado =
  ((item.quantidade_inicial - item.quantidade_disponivel) /
    item.quantidade_inicial) * 100;
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
