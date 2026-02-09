# Documentação Experimental - Geração de Alertas

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página administrativa para execução manual de verificações (checks) que geram notificações automáticas sobre o estado do inventário. Permite executar checks individuais ou todos de uma vez, simulando o comportamento das Firebase Scheduled Functions. Restrita a usuários com role `clinic_admin`.

- **Arquivo**: `src/app/(clinic)/clinic/alerts/page.tsx`
- **Rota**: `/clinic/alerts`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `AlertTriggersPage`
- **Dependências principais**:
  - `useAuth` (hook de autenticação e claims)
  - `useToast` (hook de notificações toast)
  - `runAllChecks`, `checkExpiringProducts`, `checkLowStock`, `checkExpiredProducts` de `@/lib/services/alertTriggers`
  - Componentes Shadcn/ui: `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Button`, `Alert`, `AlertDescription`, `AlertTitle`
  - Ícones Lucide: `Bell`, `Play`, `CheckCircle`, `AlertCircle`, `Package`, `Calendar`, `Loader2`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Visualiza cards, executa checks individuais e completos |
| `clinic_user` | Bloqueado | Vê Alert destructive "Apenas administradores podem executar checks" |
| `clinic_consultant` | Bloqueado | Vê Alert destructive |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

---

## 3. Estrutura de Dados

### 3.1 Coleção — `tenants/{tenant_id}/inventory`

Fonte de dados para os checks. Cada item verificado:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID do documento (auto) |
| `nome_produto` | `string` | Nome do produto |
| `codigo_produto` | `string` | Código do produto |
| `lote` | `string` | Lote do produto |
| `dt_validade` | `string` | Data de validade (DD/MM/YYYY) |
| `quantidade_disponivel` | `number` | Quantidade atual em estoque |

### 3.2 Coleção — `tenants/{tenant_id}/notifications`

Destino das notificações geradas:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | `string` | `"expiring"`, `"expired"` ou `"low_stock"` |
| `inventory_id` | `string` | ID do item de inventário |
| `read` | `boolean` | Se a notificação foi lida |

### 3.3 Configurações — `notificationSettings`

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `enable_expiry_alerts` | `boolean` | - | Habilita checks de vencimento |
| `enable_low_stock_alerts` | `boolean` | - | Habilita check de estoque baixo |
| `expiry_warning_days` | `number` | 30 | Dias antes do vencimento para alertar |
| `low_stock_threshold` | `number` | 10 | Quantidade mínima para alerta |

### 3.4 Estado do Componente (useState)

```typescript
const [running, setRunning] = useState(false);
const [results, setResults] = useState<any>(null);
```

### 3.5 Resultado de `runAllChecks`

```typescript
{
  expiring: { checked: number; created: number };
  expired: { checked: number; created: number };
  lowStock: { checked: number; created: number };
  totalErrors: number;
  errors: string[];
}
```

### 3.6 Resultado de Check Individual

```typescript
{
  checked: number;
  notificationsCreated: number;
  errors: string[];
}
```

---

## 4. Casos de Uso

### UC-001: Verificar produtos vencendo

- **Ator**: clinic_admin
- **Pré-condição**: `enable_expiry_alerts` habilitado nas configurações
- **Fluxo**:
  1. Usuário clica em "Executar Check" no card "Produtos Vencendo"
  2. `checkExpiringProducts(tenantId)` é chamado
  3. Busca configurações de notificação (`expiry_warning_days`, default 30)
  4. Busca todos os itens do inventário
  5. Para cada item com `dt_validade` dentro do período (hoje ≤ validade ≤ hoje + warningDays):
     - Verifica se já existe notificação não lida (`type="expiring"`, `inventory_id`, `read=false`)
     - Se não existe: cria notificação via `createExpiringProductNotification`
  6. Toast: "{N} produtos verificados, {M} alertas criados"
- **Pós-condição**: Notificações criadas para produtos próximos do vencimento

### UC-002: Verificar produtos vencidos

- **Ator**: clinic_admin
- **Pré-condição**: `enable_expiry_alerts` habilitado nas configurações
- **Fluxo**:
  1. Usuário clica em "Executar Check" no card "Produtos Vencidos"
  2. `checkExpiredProducts(tenantId)` é chamado
  3. Para cada item com `dt_validade < hoje`:
     - Verifica se já existe notificação não lida (`type="expired"`)
     - Se não existe: cria notificação urgente
  4. Toast com resultado
- **Pós-condição**: Notificações criadas para produtos vencidos

### UC-003: Verificar estoque baixo

- **Ator**: clinic_admin
- **Pré-condição**: `enable_low_stock_alerts` habilitado nas configurações
- **Fluxo**:
  1. Usuário clica em "Executar Check" no card "Estoque Baixo"
  2. `checkLowStock(tenantId)` é chamado
  3. Busca `low_stock_threshold` (default 10)
  4. Para cada item com `quantidade_disponivel < minQuantity`:
     - Verifica se já existe notificação não lida (`type="low_stock"`)
     - Se não existe: cria notificação via `createLowStockNotification`
  5. Toast com resultado
- **Pós-condição**: Notificações criadas para produtos com estoque baixo

### UC-004: Executar todos os checks

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário clica em "Executar Todos os Checks"
  2. `runAllChecks(tenantId)` executa os 3 checks em paralelo (`Promise.all`)
  3. Toast com total de notificações criadas
  4. Card de resultados exibido com métricas em grid 3 colunas
  5. Se houver erros, Alert destructive exibe lista
- **Pós-condição**: Todas as verificações executadas, resultados exibidos

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/alerts           │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ É clinic_admin?├──────────► Alert destructive
    └───────┬───────┘             "Apenas administradores..."
            │ Sim
            ▼
┌─────────────────────────┐
│ Exibe:                   │
│  - Header com ícone Bell │
│  - Alert informativo     │
│  - 3 cards individuais   │
│  - Card "Executar Todos" │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │             │
  Individual    Todos
     │             │
     ▼             ▼
┌──────────┐  ┌───────────────┐
│ Switch:  │  │ Promise.all:  │
│ expiring │  │  expiring     │
│ expired  │  │  expired      │
│ lowStock │  │  lowStock     │
└────┬─────┘  └───────┬───────┘
     │                │
     ▼                ▼
  Toast com      Toast + Card
  resultado      de resultados
                 (grid 3 col)
```

---

## 6. Regras de Negócio

### RN-001: Acesso restrito a clinic_admin

- **Descrição**: Apenas usuários com `role === "clinic_admin"` podem executar checks
- **Aplicação**: `isAdmin = claims?.role === "clinic_admin"` — se false, renderiza Alert destructive
- **Exceções**: Nenhuma
- **Justificativa**: Geração de alertas é função administrativa

### RN-002: Checks respeitam configurações do tenant

- **Descrição**: Cada check verifica se está habilitado nas configurações antes de executar
- **Aplicação**: `getNotificationSettings(tenantId)` — verifica `enable_expiry_alerts` e `enable_low_stock_alerts`
- **Exceções**: Se desabilitado, retorna resultado vazio sem erro
- **Justificativa**: Tenant controla quais alertas deseja receber

### RN-003: Deduplicação de notificações

- **Descrição**: Antes de criar uma notificação, verifica se já existe uma não lida para o mesmo item
- **Aplicação**: Query `where("type", "==", tipo), where("inventory_id", "==", id), where("read", "==", false)`
- **Exceções**: Se a notificação existente for marcada como lida, uma nova será criada
- **Justificativa**: Evitar spam de notificações duplicadas

### RN-004: Threshold configurável

- **Descrição**: Os limites para alertas são configuráveis por tenant
- **Aplicação**: `expiry_warning_days` (default 30 dias), `low_stock_threshold` (default 10 unidades)
- **Exceções**: Usa defaults se não configurado
- **Justificativa**: Cada clínica tem necessidades diferentes

### RN-005: Execução paralela no "Executar Todos"

- **Descrição**: `runAllChecks` executa os 3 checks em paralelo via `Promise.all`
- **Aplicação**: `Promise.all([checkExpiringProducts, checkExpiredProducts, checkLowStock])`
- **Exceções**: Erros individuais são coletados sem interromper os demais
- **Justificativa**: Performance — não precisam ser sequenciais

### RN-006: Estado running compartilhado

- **Descrição**: O estado `running` é compartilhado entre todos os botões — apenas um check pode executar por vez
- **Aplicação**: `disabled={running}` em todos os botões
- **Exceções**: Nenhuma
- **Justificativa**: Evitar execuções simultâneas que poderiam criar notificações duplicadas

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Acesso negado | Alert destructive ocupa toda a página | Texto "Apenas administradores podem executar checks de alertas" |
| Idle | 3 cards de checks + card "Executar Todos" + alert informativo | Botões com ícone Play |
| Executando (`running=true`) | Botões desabilitados, ícone Loader2 girando | `animate-spin` + texto "Executando..." (botão Executar Todos) |
| Com resultados | Card verde com métricas em grid 3 colunas | CheckCircle verde + números em `text-2xl font-bold` |
| Com erros | Alert destructive com lista de erros | Lista `ul` com erros por produto |

### 7.1 Feedback

| Ação | Tipo de feedback | Conteúdo |
|------|------------------|----------|
| Check individual OK | Toast | "{CheckName} - Concluído: {N} verificados, {M} alertas criados" |
| Todos os checks OK | Toast + Card | Toast: "{N} notificações criadas" + Card permanente com grid |
| Erro em check | Toast destructive | "Erro ao executar check: {mensagem}" |
| Erros no resultado | Alert destructive (inline) | Lista de erros por produto |

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| Role do usuário | `claims?.role !== "clinic_admin"` | Alert destructive, nenhum botão disponível |
| `tenantId` ausente | `!tenantId` | Funções retornam sem executar |
| Estado running | `running === true` | Todos os botões desabilitados |

### 8.2 Validações nos Serviços (alertTriggers)

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| Alertas desabilitados | `enable_expiry_alerts === false` | Retorna resultado vazio |
| Estoque baixo desabilitado | `enable_low_stock_alerts === false` | Retorna resultado vazio |
| Item sem validade | `!item.dt_validade` | Pula o item (continue) |
| Notificação duplicada | Notificação não lida existente | Pula o item (continue) |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims.tenant_id` e `claims.role` |
| Firestore — inventory | Leitura | Busca todos os itens do inventário para verificação |
| Firestore — notifications | Leitura/Escrita | Verifica duplicatas e cria novas notificações |
| `alertTriggers` | Serviço | 4 funções de check exportadas |
| `notificationService` | Serviço | `createExpiringProductNotification`, `createLowStockNotification`, `getNotificationSettings` |
| `useToast` | Hook UI | Feedback visual via toast |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Autorização (frontend) | Verifica `role === "clinic_admin"`, renderiza Alert destructive se falso |
| Multi-tenant | `tenantId` do claims isola verificações por tenant |
| Firestore RLS | Regras garantem isolamento multi-tenant |
| Prevenção de execução múltipla | Estado `running` compartilhado desabilita todos os botões |
| Deduplicação | Verifica notificações existentes antes de criar novas |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Execução paralela | `runAllChecks` usa `Promise.all` para os 3 checks |
| Full scan do inventário | Cada check busca **todos** os itens do inventário — pode ser lento com muitos produtos |
| Verificação individual por item | Loop `for...of` com query de deduplicação por item — N+1 queries |
| Sem paginação | Busca completa da coleção `inventory` sem limites |
| Sem cache | Cada check faz sua própria busca ao inventário (mesmo no `runAllChecks`) |

### Observação de performance

Cada check faz `getDocs(inventoryRef)` separadamente. No `runAllChecks`, isso resulta em 3 buscas completas do inventário em paralelo. Além disso, cada item verificado gera uma query de deduplicação na coleção `notifications`, resultando em N queries adicionais por check.

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Alert de acesso negado | Sim | Componente Shadcn `Alert` com role="alert" |
| Ícones nos cards | Parcial | Ícones + texto — acessível por leitura |
| Estado de loading | Parcial | Ícone `Loader2` com `animate-spin` mas sem aria-label |
| Toast notifications | Sim | Hook `useToast` com suporte nativo |
| Cores semânticas | Limitado | Cores (laranja/vermelho/amarelo/verde) sem indicador textual alternativo |
| Alert informativo | Sim | Componente Shadcn `Alert` semântico |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Acesso como clinic_admin | E2E | Verificar que cards e botões são exibidos |
| Acesso como clinic_user | E2E | Verificar Alert destructive |
| Check de vencimento com produtos | Integração | Criar produtos com validade próxima e verificar notificações |
| Check de vencimento sem produtos | Integração | Verificar resultado zerado |
| Check de estoque baixo | Integração | Criar produto com quantidade baixa e verificar notificação |
| Check de produtos vencidos | Integração | Criar produto vencido e verificar notificação |
| Deduplicação | Integração | Executar check 2x e verificar que notificação não duplica |
| Executar todos os checks | E2E | Verificar card de resultados com grid 3 colunas |
| Check com alertas desabilitados | Integração | Desabilitar em settings e verificar resultado vazio |
| Erro durante check | Integração | Simular erro e verificar toast destructive |
| Estado running | E2E | Verificar que botões ficam desabilitados durante execução |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Cache de inventário | Alta | Compartilhar resultado do inventário entre os 3 checks no `runAllChecks` |
| Batch de deduplicação | Alta | Buscar todas as notificações de uma vez em vez de N queries individuais |
| Scheduler real | Alta | Migrar para Firebase Scheduled Functions em produção |
| Paginação de inventário | Média | Limitar busca para tenants com muitos produtos |
| Histórico de checks | Média | Registrar quando cada check foi executado e por quem |
| Progresso visual | Baixa | Barra de progresso durante execução dos checks |
| Configuração inline | Baixa | Permitir ajustar `expiry_warning_days` e `low_stock_threshold` na página |

---

## 15. Dependências e Relacionamentos

```
alerts (este doc)
├── useAuth (hook) — autenticação e claims
├── useToast (hook) — notificações toast
├── alertTriggers (serviço)
│   ├── checkExpiringProducts — verifica produtos vencendo
│   ├── checkExpiredProducts — verifica produtos vencidos
│   ├── checkLowStock — verifica estoque baixo
│   └── runAllChecks — executa os 3 em paralelo
├── notificationService (serviço)
│   ├── createExpiringProductNotification
│   ├── createLowStockNotification
│   └── getNotificationSettings
├── Firestore — inventory (leitura)
└── Firestore — notifications (leitura/escrita)
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| Dashboard | Exibe notificações geradas pelos checks |
| Inventário | Fonte dos dados verificados |
| Configurações | Define thresholds e habilitação dos alertas |

---

## 16. Observações Técnicas

- Esta página substitui manualmente o que seria feito por Firebase Scheduled Functions em produção.
- Os serviços de `alertTriggers` executam queries no Firestore para identificar produtos problemáticos.
- O estado `running` é compartilhado entre todos os botões — apenas um check pode executar por vez.
- A página não possui link de retorno (navegação via menu lateral ou breadcrumb do layout).
- A função `checkExpiredProducts` tem um placeholder para criação de notificação (faz `getDocs` em vez de `addDoc`) — possível bug ou implementação incompleta.
- Cada check individual busca o inventário completo separadamente. No `runAllChecks`, isso resulta em 3 buscas completas em paralelo.
- A conversão de `dt_validade` (string DD/MM/YYYY) para Date é feita manualmente com `split("/")` — pode falhar se o formato for diferente.
- O `runAllChecks` usa `Promise.all` para execução paralela, mas os checks individuais na página usam `handleRunSingleCheck` sequencialmente.
- Toast é usado para feedback (Shadcn/ui) em vez de `alert()` nativo — diferente das páginas de pacientes.

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
| `check` | Verificação automática do inventário para gerar alertas |
| `expiring` | Produto com validade dentro do período de alerta (vencendo) |
| `expired` | Produto com validade já passada (vencido) |
| `low_stock` | Produto com quantidade abaixo do threshold configurado |
| `alertTriggers` | Serviço que implementa a lógica dos 3 tipos de check |
| `notificationSettings` | Configurações do tenant para alertas (thresholds, habilitação) |
| `running` | Estado booleano que indica check em execução |
| `deduplicação` | Verificação se já existe notificação não lida antes de criar nova |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/alerts/page.tsx`
- Serviço: `src/lib/services/alertTriggers.ts`
- Notification Service: `src/lib/services/notificationService.ts`
- Dashboard: `project_doc/clinic/dashboard-documentation.md`
- Inventário: `project_doc/clinic/inventory-list-documentation.md`

---

## 20. Anexos

### Anexo A — Cards de Checks Individuais

| Check | Ícone | Cor | Serviço | Descrição |
|-------|-------|-----|---------|-----------|
| Produtos Vencendo | `Calendar` | Laranja (`text-orange-500`) | `checkExpiringProducts` | Detecta produtos próximos do vencimento |
| Produtos Vencidos | `AlertCircle` | Vermelho (`text-red-500`) | `checkExpiredProducts` | Detecta produtos com validade expirada |
| Estoque Baixo | `Package` | Amarelo (`text-yellow-500`) | `checkLowStock` | Detecta produtos abaixo da quantidade mínima |

### Anexo B — Estrutura do Layout

```
container py-8
├── Header: Bell icon + "Geração de Alertas" + descrição
├── Alert informativo: "Sobre os Checks Automáticos"
├── Grid 3 colunas (md:2, lg:3):
│   ├── Card: Produtos Vencendo (Calendar/laranja)
│   ├── Card: Produtos Vencidos (AlertCircle/vermelho)
│   └── Card: Estoque Baixo (Package/amarelo)
├── Card: Executar Todos os Checks (botão lg)
└── Card: Resultados (condicional, se results !== null)
    ├── Grid 3 colunas: Vencendo | Vencidos | Estoque Baixo
    └── Alert destructive (condicional, se totalErrors > 0)
```
