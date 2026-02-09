# Documentação Experimental - Relatórios da Clínica (Consultor)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Consultor
**Componente:** Relatórios da Clínica (`/consultant/clinics/[tenantId]/reports`)
**Versão:** 1.0
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de relatórios de uma clínica específica, acessada pelo consultor. Idêntica à página de relatórios da clínica (`/clinic/reports`) porém com ReadOnlyBanner e verificação de autorização via `authorizedTenants`. Oferece 3 relatórios: Valor do Estoque, Produtos Vencendo e Consumo por Período.

### 1.1 Localização
- **Arquivo:** `src/app/(consultant)/consultant/clinics/[tenantId]/reports/page.tsx`
- **Rota:** `/consultant/clinics/{tenantId}/reports`
- **Layout:** Consultant Layout

### 1.2 Dependências
- **Services:** `generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`, `exportToExcel`, `formatCurrency`, `formatDecimalBR` (reportService)
- **Types:** `StockValueReport`, `ExpirationReport`, `ConsumptionReport`
- **Componentes:** `ReadOnlyBanner`
- **Hooks:** `useAuth()` (user, authorizedTenants, claims)

---

## 2. Tipos de Relatórios

### 2.1 Valor do Estoque
- Sem parâmetros
- Cards: Total de Produtos (azul), Total de Itens (verde), Valor Total (roxo)
- Tabela: Código, Produto, Qtd Total, Lotes, Valor Unit., Valor Total
- Exporta como `relatorio_valor_estoque`

### 2.2 Produtos Vencendo
- Parâmetro: dias de antecedência (1-365, padrão 30)
- Cards: Produtos em Risco (laranja), Valor em Risco (vermelho)
- Tabela: Produto, Lote, Quantidade, Validade, Dias (cor: <=7 vermelho, <=15 laranja, >15 verde), Valor
- Linhas com `dias <= 7` têm fundo vermelho
- Exporta como `relatorio_produtos_vencendo`

### 2.3 Consumo por Período
- Parâmetros: Data início + Data fim (padrão: último mês)
- Cards: Total Procedimentos (azul), Produtos Consumidos (verde), Valor Total (roxo)
- Duas tabelas: Por Produto e Por Paciente
- Exporta como `relatorio_consumo_produtos`

---

## 3. Regras de Negócio
- **RN-001:** Verificação `authorizedTenants.includes(tenantId)` no useEffect
- **RN-002:** Período padrão de consumo: último mês (calculado no mount)
- **RN-003:** Apenas um relatório ativo por vez (`activeReport` state)
- **RN-004:** Valores monetários formatados com `formatCurrency` (BRL)
- **RN-005:** Erros via `alert()` nativo

---

## 4. Estados da Interface

| Estado | Comportamento |
|--------|---------------|
| Auth loading | Spinner centralizado |
| Cards de seleção | 3 cards em grid responsivo |
| Gerando | Texto "Gerando..." + botões desabilitados |
| Preview ativo | Card expandido com borda colorida + tabela |

---

## 5. Observações
- Praticamente idêntica a `/clinic/reports` mas com controle de acesso via `authorizedTenants`
- ReadOnlyBanner exibido no topo
- Usa `<table>` HTML nativo com Tailwind (não componentes Shadcn Table)
- Botão "Voltar" → `/consultant/clinics/{tenantId}`
- Página ~542 linhas

---

## 6. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 07/02/2026
**Status:** Aprovado
