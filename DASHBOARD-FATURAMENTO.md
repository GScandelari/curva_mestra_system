# 💰 Dashboard de Faturamento - System Admin

## 📋 Funcionalidade Implementada

Adicionados cards de faturamento mensal no dashboard do system_admin, separando os valores por planos semestrais e anuais.

## 🎯 Alterações Realizadas

### Arquivo Modificado

**`src/app/(admin)/admin/dashboard/page.tsx`**

### 1️⃣ Novos Imports

```typescript
import { DollarSign, TrendingUp } from "lucide-react";
import { PLANS } from "@/lib/constants/plans";
```

### 2️⃣ Interface Atualizada

Adicionada estrutura de `revenue` na interface `DashboardStats`:

```typescript
interface DashboardStats {
  // ... campos existentes
  revenue: {
    semestral: {
      monthly: number;      // Faturamento mensal do plano semestral
      total: number;        // Faturamento total (6 meses)
      count: number;        // Quantidade de clínicas
    };
    anual: {
      monthly: number;      // Faturamento mensal do plano anual
      total: number;        // Faturamento total (12 meses)
      count: number;        // Quantidade de clínicas
    };
    totalMonthly: number;   // Faturamento mensal total
    totalAnnual: number;    // Projeção anual total
  };
}
```

### 3️⃣ Cálculo de Faturamento

Lógica implementada em `loadDashboardStats()`:

```typescript
// Valores dos planos
const semestralPrice = PLANS.semestral.price; // R$ 59,90
const anualPrice = PLANS.anual.price;         // R$ 49,90

// Faturamento semestral
const semestralMonthly = semestralTenants.length * semestralPrice;
const semestralTotal = semestralMonthly * 6;

// Faturamento anual
const anualMonthly = anualTenants.length * anualPrice;
const anualTotal = anualMonthly * 12;

// Totais
const totalMonthly = semestralMonthly + anualMonthly;
const totalAnnual = semestralTotal + anualTotal;
```

### 4️⃣ Novos Cards na Interface

Adicionados 4 novos cards antes dos cards de estatísticas:

#### Card 1: Faturamento Mensal Total
- **Ícone:** DollarSign
- **Valor:** Soma do faturamento mensal de todos os planos
- **Descrição:** Quantidade de clínicas ativas

#### Card 2: Plano Semestral
- **Ícone:** TrendingUp
- **Valor:** Faturamento mensal do plano semestral
- **Descrição:** Quantidade de clínicas + valor mensal (R$ 59,90/mês)

#### Card 3: Plano Anual
- **Ícone:** TrendingUp
- **Valor:** Faturamento mensal do plano anual
- **Descrição:** Quantidade de clínicas + valor mensal (R$ 49,90/mês)

#### Card 4: Projeção Anual
- **Ícone:** DollarSign
- **Valor:** Faturamento total projetado de todos os contratos
- **Descrição:** "Faturamento total dos contratos"

## 📊 Exemplo de Cálculo

### Cenário Exemplo:
- **5 clínicas** com plano semestral
- **3 clínicas** com plano anual

### Cálculos:

#### Plano Semestral:
- Faturamento mensal: 5 × R$ 59,90 = **R$ 299,50/mês**
- Faturamento total (6 meses): R$ 299,50 × 6 = **R$ 1.797,00**

#### Plano Anual:
- Faturamento mensal: 3 × R$ 49,90 = **R$ 149,70/mês**
- Faturamento total (12 meses): R$ 149,70 × 12 = **R$ 1.796,40**

#### Totais:
- **Faturamento Mensal Total:** R$ 299,50 + R$ 149,70 = **R$ 449,20/mês**
- **Projeção Anual:** R$ 1.797,00 + R$ 1.796,40 = **R$ 3.593,40**

## 🎨 Layout do Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Bem-vindo de volta!                                        │
│  Gerencie clínicas, licenças e produtos master             │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Faturamento  │ Plano        │ Plano        │ Projeção     │
│ Mensal Total │ Semestral    │ Anual        │ Anual        │
│              │              │              │              │
│ R$ 449,20    │ R$ 299,50    │ R$ 149,70    │ R$ 3.593,40  │
│ 8 clínicas   │ 5 clínicas   │ 3 clínicas   │ Faturamento  │
│ ativas       │ R$ 59,90/mês │ R$ 49,90/mês │ total        │
└──────────────┴──────────────┴──────────────┴──────────────┘

┌──────────────┬──────────────┬──────────────┐
│ Total de     │ Licenças por │ Total de     │
│ Clínicas     │ Plano        │ Usuários     │
│              │              │              │
│ 10           │ 8            │ 25           │
│ 8 ativas     │ 5 Semestral  │ 20 ativos    │
│              │ 3 Anual      │              │
└──────────────┴──────────────┴──────────────┘

[Ações Rápidas]
[Atividade Recente]
```

## 💡 Detalhes Técnicos

### Formatação de Moeda

Utiliza `Intl.NumberFormat` para formatação em Real brasileiro:

```typescript
new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value)
```

**Resultado:** R$ 1.234,56

### Valores dos Planos

Importados de `src/lib/constants/plans.ts`:

```typescript
PLANS.semestral.price // R$ 59,90
PLANS.anual.price     // R$ 49,90
```

### Contagem de Clínicas

Baseada no campo `plan_id` dos tenants:

```typescript
const semestralTenants = tenants.filter((t: any) => t.plan_id === 'semestral');
const anualTenants = tenants.filter((t: any) => t.plan_id === 'anual');
```

## 📈 Métricas Exibidas

| Métrica | Descrição | Cálculo |
|---------|-----------|---------|
| **Faturamento Mensal Total** | Receita mensal de todas as clínicas | Soma de todos os planos |
| **Plano Semestral** | Receita mensal do plano semestral | Qtd × R$ 59,90 |
| **Plano Anual** | Receita mensal do plano anual | Qtd × R$ 49,90 |
| **Projeção Anual** | Faturamento total dos contratos | (Semestral × 6) + (Anual × 12) |

## 🎯 Benefícios

1. **Visibilidade Financeira:** System admin vê faturamento em tempo real
2. **Separação por Plano:** Fácil identificar qual plano gera mais receita
3. **Projeção:** Visualização do faturamento total dos contratos
4. **Decisões Estratégicas:** Dados para análise de pricing e crescimento

## 🔄 Atualização Automática

Os valores são recalculados automaticamente quando:
- Uma nova clínica é criada
- Um plano é alterado
- Uma clínica é ativada/desativada
- A página é recarregada

## 📝 Notas Importantes

1. **Valores Reais:** Baseados nos planos ativos no momento
2. **Apenas Clínicas Ativas:** Considera apenas tenants com `active: true`
3. **Projeção:** Assume que todos os contratos serão mantidos até o fim
4. **Faturamento Mensal:** Representa a receita recorrente mensal (MRR)

## 🚀 Próximas Melhorias Possíveis

- [ ] Gráfico de evolução do faturamento
- [ ] Comparação mês a mês
- [ ] Taxa de churn (cancelamentos)
- [ ] Lifetime Value (LTV) por cliente
- [ ] Filtros por período
- [ ] Exportação de relatórios
- [ ] Alertas de renovação

---

**Status:** ✅ Implementado  
**Data:** 29/11/2025  
**Arquivo Modificado:** `src/app/(admin)/admin/dashboard/page.tsx`
