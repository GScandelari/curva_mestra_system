# Documentação Experimental - Relatórios

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página central de geração de relatórios da clínica. Oferece três tipos de relatórios: Valor do Estoque, Produtos Vencendo e Consumo por Período. Cada relatório pode ser gerado sob demanda, visualizado em preview na própria página e exportado para Excel.

- **Arquivo**: `src/app/(clinic)/clinic/reports/page.tsx`
- **Rota**: `/clinic/reports`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `ReportsPage`
- **Dependências principais**:
  - `useAuth` (hook de autenticação e claims)
  - `generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`, `exportToExcel`, `formatCurrency`, `formatDecimalBR` de `@/lib/services/reportService`
  - Tipos: `StockValueReport`, `ExpirationReport`, `ConsumptionReport`
  - Componentes Shadcn/ui: `Button`, `Input`, `Badge`
  - Ícones Lucide: `FileBarChart`, `DollarSign`, `AlertTriangle`, `TrendingUp`, `Download`, `Calendar`, `Eye`, `X`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Gera e exporta todos os relatórios |
| `clinic_user` | Total | Gera e exporta todos os relatórios (sem restrição de role) |
| `clinic_consultant` | N/A | Não acessa rotas de relatórios da clínica |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

**Nota**: A página não possui restrição explícita de role — tanto `clinic_admin` quanto `clinic_user` podem acessar.

---

## 3. Estrutura de Dados

### 3.1 StockValueReport

```typescript
interface StockValueReport {
  total_produtos: number;
  total_itens: number;
  valor_total: number;
  por_produto: {
    codigo: string;
    nome: string;
    quantidade_total: number;
    lotes: number;
    valor_unitario: number;
    valor_total: number;
  }[];
}
```

### 3.2 ExpirationReport

```typescript
interface ExpirationReport {
  total_produtos: number;
  valor_em_risco: number;
  produtos_vencendo: {
    id: string;
    codigo: string;
    nome: string;
    lote: string;
    quantidade: number;
    dt_validade: string;
    dias_para_vencer: number;
    valor_total: number;
  }[];
}
```

### 3.3 ConsumptionReport

```typescript
interface ConsumptionReport {
  total_procedimentos: number;
  total_produtos_consumidos: number;
  valor_total_consumido: number;
  por_produto: {
    codigo: string;
    nome: string;
    quantidade_consumida: number;
    procedimentos: number;
    valor_total: number;
  }[];
  por_paciente: {
    nome: string;
    procedimentos: number;
    produtos_consumidos: number;
    valor_total: number;
  }[];
}
```

### 3.4 Estado do Componente (useState)

```typescript
const [loading, setLoading] = useState(false);
const [activeReport, setActiveReport] = useState<string | null>(null);
const [stockReport, setStockReport] = useState<StockValueReport | null>(null);
const [expirationReport, setExpirationReport] = useState<ExpirationReport | null>(null);
const [expirationDays, setExpirationDays] = useState(30);
const [consumptionReport, setConsumptionReport] = useState<ConsumptionReport | null>(null);
const [consumptionStartDate, setConsumptionStartDate] = useState("");
const [consumptionEndDate, setConsumptionEndDate] = useState("");
```

---

## 4. Casos de Uso

### UC-001: Gerar relatório de valor do estoque

- **Ator**: clinic_admin, clinic_user
- **Pré-condição**: Usuário autenticado com `tenant_id`
- **Fluxo**:
  1. Usuário clica em "Gerar Relatório" no card "Valor do Estoque"
  2. `generateStockValueReport(tenantId)` é chamado (sem parâmetros adicionais)
  3. Botão exibe "Gerando..." enquanto carrega
  4. Preview exibido com: 3 cards de resumo (Total Produtos, Total Itens, Valor Total) + tabela por produto
- **Pós-condição**: Relatório exibido em preview com borda azul

### UC-002: Gerar relatório de produtos vencendo

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário configura antecedência em dias (default 30, range 1-365)
  2. Clica em "Gerar Relatório" no card "Produtos Vencendo"
  3. `generateExpirationReport(tenantId, expirationDays)` é chamado
  4. Preview exibido com: 2 cards (Produtos em Risco, Valor em Risco) + tabela com cores por urgência
- **Pós-condição**: Relatório exibido em preview com borda laranja

### UC-003: Gerar relatório de consumo por período

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Datas de início e fim pré-preenchidas (último mês via `useEffect`)
  2. Usuário pode ajustar o período
  3. Clica em "Gerar Relatório" no card "Consumo"
  4. Se datas não preenchidas: `alert("Selecione o período")`
  5. `generateConsumptionReport(tenantId, startDate, endDate)` é chamado
  6. Preview exibido com: 3 cards + tabela por produto + tabela por paciente
- **Pós-condição**: Relatório exibido em preview com borda verde

### UC-004: Exportar relatório para Excel

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Com preview ativo, usuário clica em "Exportar Excel"
  2. Dados mapeados para formato tabular com headers em português
  3. `exportToExcel(data, nomeArquivo)` gera e baixa o arquivo
- **Nomes de arquivo**: `relatorio_valor_estoque`, `relatorio_produtos_vencendo`, `relatorio_consumo_produtos`
- **Pós-condição**: Download do arquivo Excel iniciado

### UC-005: Fechar preview do relatório

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário clica em "Fechar" (botão ghost com ícone X)
  2. Estado do relatório é setado para `null`
- **Pós-condição**: Preview removido da tela

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/reports          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ useEffect:               │
│ Calcula período padrão   │
│ (último mês)             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Exibe 3 cards:           │
│  1. Valor do Estoque     │
│  2. Produtos Vencendo    │
│  3. Consumo por Período  │
└───────────┬─────────────┘
            │
     ┌──────┼──────┐
     │      │      │
  Estoque Vencimento Consumo
     │      │      │
     ▼      ▼      ▼
  Gerar   Gerar  Gerar
  Report  Report Report
     │      │      │
     └──────┼──────┘
            │
            ▼
┌─────────────────────────┐
│ Preview (activeReport):  │
│  - Badge "Preview"       │
│  - Cards de resumo       │
│  - Tabela de dados       │
│  - Botões: Fechar/Excel  │
└─────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Multi-tenant

- **Descrição**: Todos os relatórios são filtrados pelo `tenantId` do usuário autenticado
- **Aplicação**: `tenantId` passado como parâmetro para todos os serviços
- **Exceções**: Nenhuma
- **Justificativa**: Isolamento de dados por clínica

### RN-002: Período padrão de consumo

- **Descrição**: O período de consumo é inicializado com o último mês
- **Aplicação**: `useEffect` calcula `lastMonth` e `today` no mount
- **Exceções**: Usuário pode alterar o período livremente
- **Justificativa**: Conveniência — período mais comum de consulta

### RN-003: Antecedência configurável para vencimento

- **Descrição**: O relatório de vencimento aceita de 1 a 365 dias de antecedência
- **Aplicação**: Input numérico com `min=1`, `max=365`, fallback para 30 se inválido
- **Exceções**: Nenhuma
- **Justificativa**: Flexibilidade para diferentes necessidades de planejamento

### RN-004: Um relatório ativo por vez

- **Descrição**: Apenas um relatório pode estar em preview por vez
- **Aplicação**: `activeReport` controla qual preview é exibido (condição `&& activeReport === "tipo"`)
- **Exceções**: Ao gerar novo relatório, o `activeReport` muda e o anterior é substituído
- **Justificativa**: Evitar confusão visual com múltiplos previews

### RN-005: Estado loading compartilhado

- **Descrição**: O estado `loading` é compartilhado entre todos os relatórios
- **Aplicação**: `disabled={loading}` em todos os botões de geração
- **Exceções**: Nenhuma
- **Justificativa**: Impedir geração simultânea de relatórios

### RN-006: Formatação de exportação

- **Descrição**: Valores monetários na exportação usam `formatDecimalBR`, na visualização usam `formatCurrency`
- **Aplicação**: `formatDecimalBR(valor, 2)` no mapeamento para Excel; `formatCurrency(valor)` no JSX
- **Exceções**: Nenhuma
- **Justificativa**: Excel precisa de valores numéricos formatados em padrão BR

### RN-007: Destaque visual por urgência (vencimento)

- **Descrição**: No relatório de vencimento, dias para vencer usa cores semáforo
- **Aplicação**: `≤ 7 dias`: vermelho + fundo vermelho na linha; `≤ 15 dias`: laranja; `> 15 dias`: verde
- **Exceções**: Nenhuma
- **Justificativa**: Comunicação visual imediata do grau de urgência

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Inicial | 3 cards de relatório em grid responsivo | Grid `md:grid-cols-3` |
| Gerando (`loading=true`) | Texto "Gerando..." no botão ativo, todos botões desabilitados | Botão com texto alterado |
| Preview — Estoque | Card com borda azul, 3 cards resumo + tabela | `border-2 border-blue-200` |
| Preview — Vencimento | Card com borda laranja, 2 cards resumo + tabela com cores | `border-2 border-orange-200` |
| Preview — Consumo | Card com borda verde, 3 cards resumo + 2 tabelas | `border-2 border-green-200` |
| Erro | Alert nativo com "Erro ao gerar relatório" | `alert()` |

### 7.1 Controles do Preview

Cada preview possui:
- Badge "Preview" com ícone Eye (cor temática do relatório)
- Botão "Fechar" (ghost) com ícone X — seta estado do relatório para `null`
- Botão "Exportar Excel" (default) com ícone Download

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| `tenantId` ausente | `!tenantId` | Funções retornam sem executar |
| Período não preenchido (consumo) | `!consumptionStartDate \|\| !consumptionEndDate` | `alert("Selecione o período")` |
| Antecedência inválida | `parseInt(value) || 30` | Fallback para 30 dias |
| Relatório não gerado (export) | `!stockReport` (etc.) | Função retorna sem executar |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims.tenant_id` |
| `reportService` | Serviço | 3 funções de geração + `exportToExcel` + formatadores |
| Firestore — inventory | Leitura | Dados do inventário para relatórios de estoque e vencimento |
| Firestore — solicitacoes | Leitura | Dados de consumo para relatório de consumo |
| Firestore — patients | Leitura | Dados de pacientes para relatório de consumo |
| Excel (XLSX) | Exportação | `exportToExcel` gera arquivo .xlsx para download |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Multi-tenant | `claims.tenant_id` isola dados por tenant |
| Autorização | **Sem restrição de role** — qualquer usuário autenticado pode gerar relatórios |
| Firestore RLS | Regras garantem `request.auth.token.tenant_id == tenantId` |
| Exportação | Dados são processados no cliente — nenhum arquivo é enviado ao servidor |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Geração sob demanda | Relatórios gerados apenas quando usuário clica |
| Um relatório por vez | Estado `loading` compartilhado impede geração simultânea |
| Renderização de tabelas | Tabelas HTML nativas com `overflow-x-auto` para responsividade |
| Sem paginação de tabela | Todos os dados exibidos de uma vez no preview |
| Período padrão | `useEffect` calcula último mês apenas no mount |
| Dados em memória | Relatórios ficam no state até serem substituídos ou fechados |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Labels nos inputs | Sim | Labels com `<label>` para antecedência e datas |
| Tabelas semânticas | Sim | `<table>`, `<thead>`, `<tbody>`, `<th>` com uppercase |
| Cores de urgência | Limitado | Cores usadas sem indicador textual alternativo (números ajudam) |
| Badge de preview | Parcial | Badge com ícone Eye + texto "Preview" |
| Feedback de erro | Limitado | Apenas `alert()` nativo |
| Input de data | Sim | `type="date"` com date picker nativo do browser |
| Input numérico | Sim | `type="number"` com min/max |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Gerar relatório de estoque | E2E | Verificar cards resumo e tabela por produto |
| Gerar relatório de vencimento | E2E | Verificar cores por dias para vencer |
| Gerar relatório de consumo | E2E | Verificar tabelas por produto e por paciente |
| Exportar cada relatório | E2E | Verificar download de Excel |
| Período padrão | Unitário | Verificar que datas são inicializadas com último mês |
| Antecedência custom | E2E | Alterar para 90 dias e verificar resultado |
| Período vazio (consumo) | E2E | Verificar alert "Selecione o período" |
| Fechar preview | E2E | Verificar que card de preview é removido |
| Loading compartilhado | E2E | Verificar que botões ficam desabilitados durante geração |
| Cores de urgência | Visual | Verificar vermelho (≤7d), laranja (≤15d), verde (>15d) |
| Fundo vermelho em linha crítica | Visual | Verificar `bg-red-50` para ≤ 7 dias |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Gráficos | Alta | Adicionar visualizações gráficas (barras, pizza) aos relatórios |
| Restrição de role | Média | Avaliar se clinic_user deve ter acesso a todos os relatórios |
| Toast notifications | Média | Substituir `alert()` por toast para erros |
| Paginação de tabelas | Média | Limitar exibição para relatórios com muitos itens |
| Relatório de PDF | Média | Gerar PDF para impressão além do Excel |
| Cache de relatórios | Baixa | Armazenar relatório gerado para evitar re-geração |
| Agendamento | Baixa | Gerar relatórios automaticamente em horários programados |
| Filtros adicionais | Baixa | Filtrar por categoria de produto, fornecedor, etc. |

---

## 15. Dependências e Relacionamentos

```
reports (este doc)
├── useAuth (hook) — autenticação e claims
├── reportService
│   ├── generateStockValueReport — relatório de valor do estoque
│   ├── generateExpirationReport — relatório de vencimento
│   ├── generateConsumptionReport — relatório de consumo
│   ├── exportToExcel — exportação para .xlsx
│   ├── formatCurrency — formatação monetária (BRL)
│   └── formatDecimalBR — formatação decimal BR para Excel
├── Firestore — inventory (leitura)
├── Firestore — solicitacoes (leitura)
└── Firestore — patients (leitura)
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| Dashboard | Visão resumida que complementa os relatórios |
| Inventário | Fonte dos dados de estoque e vencimento |
| Solicitações | Fonte dos dados de consumo |
| Pacientes | Associação para relatório de consumo por paciente |

---

## 16. Observações Técnicas

- A página não possui restrição explícita de role — tanto `clinic_admin` quanto `clinic_user` podem acessar.
- O estado `loading` é compartilhado entre todos os relatórios, impedindo geração simultânea.
- Erros são exibidos via `alert()` nativo do browser (não usa toast ou Alert component).
- O relatório de consumo inclui duas perspectivas: por produto e por paciente, ambas na mesma visualização.
- As tabelas usam HTML nativo (`<table>`) com classes Tailwind, diferente de outras páginas que usam componentes Shadcn Table.
- O período padrão de consumo é calculado via `useEffect` na montagem do componente usando `toISOString().split("T")[0]`.
- `formatDecimalBR` é usado apenas na exportação Excel para manter precisão numérica; `formatCurrency` é usado no JSX para exibição visual.
- O botão "Fechar" seta o estado do relatório para `null` (não `activeReport`), o que efetivamente esconde o preview pois a condição verifica ambos.
- A exportação Excel usa `exportToExcel` com headers mapeados em português (ex: "Código", "Nome", "Quantidade Total").

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
| `tenant_id` | Identificador único da clínica no sistema multi-tenant |
| `claims` | Custom Claims do Firebase Auth com role e tenant_id |
| `StockValueReport` | Tipo do relatório de valor do estoque |
| `ExpirationReport` | Tipo do relatório de produtos vencendo |
| `ConsumptionReport` | Tipo do relatório de consumo por período |
| `activeReport` | Estado que controla qual preview está ativo ("stock", "expiration", "consumption") |
| `formatCurrency` | Função de formatação monetária BRL para exibição |
| `formatDecimalBR` | Função de formatação decimal BR para exportação |
| `exportToExcel` | Função que gera e baixa arquivo .xlsx |
| `expirationDays` | Número de dias de antecedência para relatório de vencimento |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/reports/page.tsx`
- Serviço: `src/lib/services/reportService.ts`
- Inventário: `project_doc/clinic/inventory-list-documentation.md`
- Dashboard: `project_doc/clinic/dashboard-documentation.md`

---

## 20. Anexos

### Anexo A — Tipos de Relatórios

| Relatório | Cor | Ícone | Serviço | Parâmetros |
|-----------|-----|-------|---------|------------|
| Valor do Estoque | Azul | `DollarSign` | `generateStockValueReport` | Nenhum |
| Produtos Vencendo | Laranja | `AlertTriangle` | `generateExpirationReport` | `expirationDays` (1-365, default 30) |
| Consumo por Período | Verde | `TrendingUp` | `generateConsumptionReport` | `startDate`, `endDate` (default: último mês) |

### Anexo B — Nomes de Arquivo na Exportação

| Relatório | Nome do arquivo |
|-----------|-----------------|
| Valor do Estoque | `relatorio_valor_estoque.xlsx` |
| Produtos Vencendo | `relatorio_produtos_vencendo.xlsx` |
| Consumo | `relatorio_consumo_produtos.xlsx` |

### Anexo C — Cores de Urgência (Vencimento)

| Dias para vencer | Cor do texto | Fundo da linha |
|------------------|-------------|----------------|
| ≤ 7 dias | `text-red-600` | `bg-red-50` |
| ≤ 15 dias | `text-orange-600` | Normal |
| > 15 dias | `text-green-600` | Normal |

### Anexo D — Estrutura do Layout

```
container py-8
└── space-y-6
    ├── Header: "Relatórios" + descrição
    ├── Grid 3 colunas:
    │   ├── Card: Valor do Estoque (DollarSign/azul)
    │   ├── Card: Produtos Vencendo (AlertTriangle/laranja) + input dias
    │   └── Card: Consumo (TrendingUp/verde) + inputs data
    └── Preview (condicional por activeReport):
        ├── Header: título + Badge Preview + botões Fechar/Excel
        ├── Cards de resumo (grid 2-3 col)
        └── Tabela(s) de dados
```
