# Documentação Experimental - Seleção de Plano (Onboarding)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clinic (Onboarding)
**Componente:** Setup - Seleção de Plano
**Versão:** 2.0
**Data:** 09/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de seleção de plano de assinatura durante o fluxo de onboarding da clínica. Apresenta dois planos disponíveis (Semestral e Anual) com preços, lista de features e cálculo automático de economia. O usuário seleciona um plano e prossegue para a etapa de pagamento. É a terceira etapa do onboarding (após termos e dados cadastrais).

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/setup/plan/page.tsx`
- **Rota:** `/clinic/setup/plan`
- **Layout:** Onboarding Layout (sem sidebar, fundo gradiente azul-índigo)

### 1.2 Dependências Principais
- **useAuth:** Hook de autenticação — obtém `claims.tenant_id`
- **tenantOnboardingService:** `completePlanSelection()` e `getTenantOnboarding()` — persiste seleção de plano no Firestore
- **PLANS (constants/plans):** Configuração centralizada dos planos (id, name, description, price, duration, maxUsers, features)
- **Shadcn/ui:** Card, Alert, Badge, Button
- **Lucide Icons:** CheckCircle2, CreditCard, Sparkles

---

## 2. Tipos de Usuários / Atores

### 2.1 clinic_admin
- **Descrição:** Administrador da clínica em processo de onboarding
- **Acesso:** Único ator com acesso a esta página
- **Comportamento:** Visualiza os planos, compara preços e features, seleciona um plano e confirma para avançar ao pagamento
- **Restrições:** Deve ter completado a etapa de setup (`setup_completed == true`) para acessar esta página

### 2.2 Outros Roles
- **Descrição:** clinic_user, clinic_consultant, system_admin
- **Acesso:** Sem acesso direto a esta página
- **Comportamento:** N/A — página exclusiva do fluxo de onboarding
- **Restrições:** Não há verificação de role no código; o controle é feito pelo fluxo de onboarding (apenas clinic_admin passa pelo setup)

---

## 3. Estrutura de Dados

### 3.1 PlanConfig (constante PLANS)

```typescript
interface PlanConfig {
  id: string;                    // "semestral" | "anual"
  name: string;                  // "Plano Semestral" | "Plano Anual"
  description: string;           // Texto descritivo
  price: number;                 // Preço mensal (ex: 59.90, 49.90)
  duration: string;              // "6 meses" | "12 meses"
  maxUsers: number;              // Máximo de usuários (incluindo admin)
  features: string[];            // Lista de funcionalidades incluídas
}
```

### 3.2 PlanSelectionData (enviada ao service)

```typescript
interface PlanSelectionData {
  plan_id: "semestral" | "anual";
  payment_method: "credit_card" | "pix" | "boleto";  // Default: "credit_card" no MVP
}
```

### 3.3 Valores Calculados no Componente

| Dado | Cálculo |
|------|---------|
| semestralTotal | `semestralPlan.price * 6` = R$ 359,40 |
| anualTotal | `anualPlan.price * 12` = R$ 598,80 |
| savingsPercent | `Math.round(((semestralTotal * 2 - anualTotal) / (semestralTotal * 2)) * 100)` = ~17% |
| Economia absoluta | `semestralTotal * 2 - anualTotal` = R$ 119,40/ano |

**Campos Principais:**
- **price:** Valor mensal do plano em reais (decimal com 2 casas)
- **maxUsers:** Ambos os planos permitem até 5 usuários (incluindo admin)
- **features:** Lista de 6 features; semestral tem "Suporte por email", anual tem "Suporte prioritário"

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Opções de Plano

**Ator:** clinic_admin
**Pré-condições:**
- Usuário autenticado com `tenant_id`
- Etapa de setup completada (`setup_completed == true`)
- Plano ainda não selecionado (`plan_selected == false`)

**Fluxo Principal:**
1. Usuário acessa `/clinic/setup/plan`
2. Sistema verifica status do onboarding via `getTenantOnboarding()`
3. Sistema exibe dois cards lado a lado: Semestral e Anual
4. Card semestral mostra preço R$ 59,90/mês + badge "Popular"
5. Card anual mostra preço R$ 49,90/mês + badge "Melhor Valor" + badge "Economize X%"

**Pós-condições:**
- Cards renderizados sem seleção (botão "Continuar" desabilitado)

---

### 4.2 UC-002: Selecionar e Confirmar Plano

**Ator:** clinic_admin
**Pré-condições:**
- Planos carregados e exibidos

**Fluxo Principal:**
1. Usuário clica em um card de plano (ou no botão "Selecionar Plano" dentro do card)
2. Card selecionado recebe destaque visual (`ring-2 ring-primary`) + ícone CheckCircle2
3. Botão "Continuar para Pagamento" fica habilitado
4. Usuário clica em "Continuar para Pagamento"
5. Sistema chama `completePlanSelection(tenantId, { plan_id, payment_method: "credit_card" })`
6. Service atualiza tenant com `plan_id` e onboarding com `plan_selected: true`
7. Usuário é redirecionado para `/clinic/setup/payment`

**Fluxo Alternativo 1 — Erro na Seleção:**
1. Se `completePlanSelection` retorna `success: false`, exibe Alert destructive com mensagem de erro
2. Botão volta ao estado normal (loading: false)

**Pós-condições:**
- `tenant_onboarding.plan_selected = true`
- `tenant_onboarding.selected_plan_id = "semestral" | "anual"`
- `tenant_onboarding.status = "pending_payment"`
- Navegação para `/clinic/setup/payment`

---

### 4.3 UC-003: Redirecionamento por Status

**Ator:** clinic_admin
**Pré-condições:**
- Usuário acessa `/clinic/setup/plan` diretamente

**Fluxo Principal:**
1. Sistema verifica onboarding via `checkOnboardingStatus()`
2. Se `setup_completed == false` → redireciona para `/clinic/setup`
3. Se `plan_selected == true` → redireciona para `/clinic/setup/payment`

**Pós-condições:**
- Usuário na etapa correta do onboarding

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                     SELEÇÃO DE PLANO                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ tenantId existe?  │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         ▼         ▼
              ┌──────────────────┐  (aguarda claims)
              │ getTenantOnboard │
              │ ing()            │
              └──────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ setup_completed?      │
              └──────────────────────┘
                    │           │
               SIM  │      NÃO │
                    ▼           ▼
              ┌────────┐  ┌──────────────┐
              │ plan_  │  │ Redireciona  │
              │ select │  │ /clinic/setup│
              │ ed?    │  └──────────────┘
              └────────┘
                │      │
           SIM  │  NÃO │
                ▼      ▼
    ┌──────────────┐  ┌──────────────────┐
    │ Redireciona  │  │ Exibe cards dos  │
    │ /setup/      │  │ planos           │
    │ payment      │  └──────────────────┘
    └──────────────┘           │
                               ▼
                    ┌──────────────────┐
                    │ Usuário seleciona│
                    │ um plano         │
                    └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ Clica "Continuar │
                    │ para Pagamento"  │
                    └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ completePlan     │
                    │ Selection()      │
                    └──────────────────┘
                         │         │
                   OK    │    ERRO │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ Redireciona  │  │ Alert com    │
              │ /setup/      │  │ mensagem de  │
              │ payment      │  │ erro         │
              └──────────────┘  └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Pré-requisito de Setup Completo
**Descrição:** O acesso à seleção de plano requer que a etapa de configuração da clínica tenha sido concluída.
**Aplicação:** No `useEffect` ao montar o componente — verifica `onboarding.setup_completed`.
**Exceções:** Nenhuma.
**Justificativa:** Garantir que dados cadastrais da clínica existam antes de prosseguir com plano/pagamento.

### RN-002: Redirecionamento se Plano Já Selecionado
**Descrição:** Se o plano já foi selecionado (`plan_selected == true`), redireciona automaticamente para `/clinic/setup/payment`.
**Aplicação:** No `checkOnboardingStatus()`.
**Exceções:** Nenhuma — não há opção de alterar o plano selecionado.
**Justificativa:** Evitar reseleção; o fluxo é unidirecional.

### RN-003: Método de Pagamento Padrão
**Descrição:** O método de pagamento enviado é sempre `"credit_card"` no MVP.
**Aplicação:** Hardcoded na chamada `completePlanSelection()`.
**Exceções:** Futuras implementações podem adicionar PIX e boleto.
**Justificativa:** Simplificação do MVP — apenas cartão de crédito é suportado.

### RN-004: Planos Válidos
**Descrição:** Somente `"semestral"` e `"anual"` são valores válidos para seleção de plano.
**Aplicação:** O state `selectedPlan` é tipado como `"semestral" | "anual" | null`.
**Exceções:** Nenhuma.
**Justificativa:** Dois planos configurados na constante PLANS.

### RN-005: Cálculo de Economia
**Descrição:** A economia é calculada comparando o custo anual do plano semestral (2 × semestralTotal) contra o plano anual (anualTotal).
**Aplicação:** `savingsPercent = Math.round(((semestralTotal * 2 - anualTotal) / (semestralTotal * 2)) * 100)`.
**Exceções:** Nenhuma.
**Justificativa:** Incentivar o plano anual mostrando a economia percentual e absoluta.

---

## 7. Estados da Interface

### 7.1 Estado: Nenhum Plano Selecionado
**Quando:** Ao abrir a página, antes de qualquer interação.
**Exibição:** Dois cards sem destaque visual; botão "Continuar para Pagamento" desabilitado (`disabled={!selectedPlan}`).
**Interações:** Clicar em qualquer card ou botão "Selecionar Plano".

### 7.2 Estado: Plano Selecionado
**Quando:** Após clicar em um dos cards.
**Exibição:**
- Card selecionado com `ring-2 ring-primary shadow-lg`
- Ícone CheckCircle2 no canto superior direito do card (fundo primary, texto branco)
- Botão do card muda para "Selecionado" (variant default)
- Botão "Continuar para Pagamento" habilitado

### 7.3 Estado: Processando
**Quando:** Após clicar em "Continuar para Pagamento".
**Exibição:**
- Botão exibe "Processando..." e fica desabilitado
- Botões dos cards também ficam desabilitados (`disabled={loading}`)

### 7.4 Estado: Erro
**Quando:** Falha na chamada `completePlanSelection()` ou `tenantId` ausente.
**Exibição:**
- Alert `variant="destructive"` acima dos cards
- Mensagens possíveis: "Erro: Tenant não identificado", "Erro ao selecionar plano", "Erro ao processar solicitação"

### 7.5 Destaques Visuais dos Planos

| Elemento | Semestral | Anual |
|----------|-----------|-------|
| Badge no card | "Popular" (outline) | "Melhor Valor" (verde) |
| Badge flutuante | — | "Economize X%" (gradiente amarelo→laranja com ícone Sparkles) |
| Texto economia | — | "Você economiza R$ X por ano!" (verde) |
| Padding superior | Padrão | `pt-8` (acomoda badge flutuante) |

---

## 8. Validações

### 8.1 Validações de Frontend
- **selectedPlan:**
  - Deve ser não-null para habilitar botão "Continuar"
  - Tipagem restringe a `"semestral" | "anual"`

### 8.2 Validações de Backend (Service)
- **tenantId:** Deve existir antes de chamar `completePlanSelection()`; se ausente, exibe erro "Tenant não identificado"
- **plan_id:** Deve ser "semestral" ou "anual" (tipado no TypeScript)

### 8.3 Validações de Permissão
- **Onboarding status:** `setup_completed` deve ser `true` para permanecer na página
- **Sem verificação de role:** Não há checagem explícita de `clinic_admin`

---

## 9. Integrações

### 9.1 Firestore — tenant_onboarding
- **Coleção:** `tenant_onboarding`
- **Documento:** `{tenantId}`
- **Operações:** Read (checkOnboardingStatus), Update (completePlanSelection)
- **Campos lidos:** `setup_completed`, `plan_selected`
- **Campos escritos:** `plan_selected: true`, `selected_plan_id`, `status: "pending_payment"`, `payment_data.amount`

### 9.2 Firestore — tenants
- **Coleção:** `tenants`
- **Documento:** `{tenantId}`
- **Operações:** Update (via `updateTenant` dentro de `completePlanSelection`)
- **Campos escritos:** `plan_id`

### 9.3 Constante PLANS
- **Arquivo:** `src/lib/constants/plans.ts`
- **Tipo:** Objeto estático (não banco de dados)
- **Dados:** Configuração dos 2 planos (id, name, description, price, duration, maxUsers, features)
- **Quando:** Importado no componente para renderizar cards e calcular economia

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Verificação de `tenantId` antes de operações
- ✅ Tipagem TypeScript restringe valores de plano
- ✅ Redirecionamento automático por status de onboarding
- ✅ Botão desabilitado durante processamento (previne duplo clique)

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Sem verificação de role — qualquer usuário autenticado com `tenant_id` poderia acessar
- ⚠️ Sem rate limiting na seleção de plano
- **Mitigação:** O fluxo de onboarding naturalmente restringe o acesso a clinic_admin

### 10.3 Dados Sensíveis
- **tenant_id:** Identificador do tenant (não exposto ao cliente além do token)
- **plan_id:** Não sensível — dados públicos de plano

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** ~200ms (1 query Firestore)
- **Requisições:** 1 ao montar (getTenantOnboarding) + 1 ao confirmar (completePlanSelection)
- **Bundle:** Componente leve com poucas dependências

### 11.2 Otimizações Implementadas
- ✅ Planos carregados de constante local (sem query ao banco)
- ✅ Cálculos de economia feitos no render (sem efeitos colaterais)
- ✅ `e.stopPropagation()` nos botões internos dos cards para evitar conflito com onClick do card

### 11.3 Gargalos Identificados
- ⚠️ Sem loading state durante verificação inicial de onboarding (componente renderiza antes do redirect)
- **Plano de melhoria:** Adicionar estado loading antes do checkOnboardingStatus

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial A
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Cards clicáveis com `cursor-pointer`
- ✅ Feedback visual de seleção (ring + ícone)
- ✅ Botão desabilitado quando inválido
- ✅ Alert para mensagens de erro

### 12.3 Melhorias Necessárias
- [ ] Adicionar `role="radio"` e `aria-checked` nos cards (comportamento de radio group)
- [ ] Adicionar `aria-live` para anúncio de erros
- [ ] Navegação por teclado entre os cards
- [ ] Foco visível customizado nos cards

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Exibição dos planos**
   - **Dado:** Usuário com setup completo e plano não selecionado
   - **Quando:** Acessa `/clinic/setup/plan`
   - **Então:** Dois cards são exibidos com preços e features corretos

2. **Seleção de plano semestral**
   - **Dado:** Ambos os cards exibidos
   - **Quando:** Clica no card semestral
   - **Então:** Card semestral recebe destaque, botão "Continuar" habilitado

3. **Confirmação de plano**
   - **Dado:** Plano anual selecionado
   - **Quando:** Clica "Continuar para Pagamento"
   - **Então:** `completePlanSelection` é chamado e redireciona para `/clinic/setup/payment`

4. **Cálculo de economia**
   - **Dado:** Preços de R$ 59,90 e R$ 49,90
   - **Quando:** Página renderiza
   - **Então:** Badge "Economize 17%" e texto "Você economiza R$ 119,40 por ano!" são exibidos

### 13.2 Casos de Teste de Erro
1. **Tenant não identificado:** Sem `tenantId` → exibe "Erro: Tenant não identificado"
2. **Falha no service:** `completePlanSelection` retorna erro → Alert com mensagem
3. **Setup incompleto:** `setup_completed == false` → redireciona para `/clinic/setup`

### 13.3 Testes de Integração
- [ ] Verificar persistência no Firestore após seleção de plano
- [ ] Verificar que `plan_selected` é atualizado no onboarding
- [ ] Testar fluxo completo: setup → plan → payment

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Permitir alterar plano após seleção (antes do pagamento)
- [ ] Adicionar mais opções de planos (trimestral, mensal)
- [ ] Código de cupom/desconto
- [ ] Período de trial gratuito

### 14.2 UX/UI
- [ ] Animação de transição ao selecionar plano
- [ ] Comparativo lado a lado com highlight de diferenças
- [ ] Tooltip explicando cada feature

### 14.3 Performance
- [ ] Loading skeleton durante verificação de onboarding

### 14.4 Segurança
- [ ] Verificação de role `clinic_admin` no componente
- [ ] Rate limiting na API de seleção de plano

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Setup (Dados Cadastrais):** Página anterior no fluxo — `/clinic/setup`
- **Setup Payment:** Próxima página no fluxo — `/clinic/setup/payment`
- **Plans Constant:** `src/lib/constants/plans.ts` — configuração centralizada dos planos

### 15.2 Fluxos que Passam por Esta Página
1. **Onboarding Completo:** Termos → Setup → **Seleção de Plano** → Pagamento → Sucesso

### 15.3 Impacto de Mudanças
- **Alto impacto:** Alteração nos preços/features em `PLANS` afeta esta página e payment
- **Médio impacto:** Mudanças no `tenantOnboardingService` afetam o fluxo de redirecionamento
- **Baixo impacto:** Mudanças visuais nos cards são isoladas neste componente

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Planos como constante:** Os planos são definidos em `src/lib/constants/plans.ts` em vez de no Firestore, simplificando o MVP mas limitando a flexibilidade de gestão pelo admin
- **payment_method hardcoded:** `"credit_card"` é fixo no MVP; a interface `PlanSelectionData` já prevê PIX e boleto

### 16.2 Padrões Utilizados
- **Onboarding Step Pattern:** Verificação de status no mount → redirect se etapa incorreta
- **Card Selection Pattern:** Cards clicáveis com estado visual de seleção
- **Gradient Background:** `bg-gradient-to-br from-blue-50 to-indigo-100` — padrão do onboarding

### 16.3 Limitações Conhecidas
- ⚠️ Não é possível alterar o plano após seleção sem reset do onboarding
- ⚠️ Preços e features são estáticos (constante TypeScript, não banco de dados)
- ⚠️ Sem loading state durante `checkOnboardingStatus()` — o componente renderiza brevemente antes do redirect

### 16.4 Notas de Implementação
- O card anual tem `pt-8` extra no CardHeader para acomodar o badge "Economize" posicionado com `absolute -top-3`
- `e.stopPropagation()` nos botões internos evita conflito com o `onClick` do card
- O rodapé exibe: "Garantia de 7 dias | Cancele quando quiser | Suporte dedicado"
- Layout usa `md:grid-cols-2` para cards lado a lado em telas médias+

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Claude (Engenharia Reversa) | Documentação inicial formato antigo |
| 09/02/2026 | 2.0 | Claude (Engenharia Reversa) | Padronização para template 20 seções |

---

## 18. Glossário

- **Onboarding:** Processo de configuração inicial da clínica após primeiro login
- **PLANS:** Constante TypeScript com configuração dos planos disponíveis
- **completePlanSelection:** Função do service que persiste a seleção de plano no Firestore
- **plan_selected:** Flag booleana no tenant_onboarding que indica se o plano foi escolhido
- **savingsPercent:** Percentual de economia do plano anual em relação ao semestral

---

## 19. Referências

### 19.1 Documentação Relacionada
- Setup (Dados Cadastrais) - `project_doc/clinic/setup-documentation.md`
- Setup (Termos) - `project_doc/clinic/setup-terms-documentation.md`
- Setup (Pagamento) - `project_doc/clinic/setup-payment-documentation.md`
- Setup (Sucesso) - `project_doc/clinic/setup-success-documentation.md`
- Licença - `project_doc/clinic/license-documentation.md`

### 19.2 Links Externos
- Next.js App Router - https://nextjs.org/docs/app
- Shadcn/ui Card - https://ui.shadcn.com/docs/components/card

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/setup/plan/page.tsx`
- **Service:** `src/lib/services/tenantOnboardingService.ts`
- **Constantes:** `src/lib/constants/plans.ts`
- **Types:** `src/types/onboarding.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — documentação gerada por engenharia reversa]

### 20.2 Diagramas
[Ver seção 5 — Fluxo de Processo Detalhado]

### 20.3 Exemplos de Código

```typescript
// Planos disponíveis (src/lib/constants/plans.ts)
export const PLANS: Record<string, PlanConfig> = {
  semestral: {
    id: "semestral",
    name: "Plano Semestral",
    price: 59.90,
    duration: "6 meses",
    maxUsers: 5,
    features: ["Gestão completa de estoque", "Até 5 usuários", "Controle de lotes e validades", "Rastreamento por paciente", "Relatórios e alertas", "Suporte por email"],
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    price: 49.90,
    duration: "12 meses",
    maxUsers: 5,
    features: ["Gestão completa de estoque", "Até 5 usuários", "Controle de lotes e validades", "Rastreamento por paciente", "Relatórios e alertas", "Suporte prioritário"],
  },
};
```

---

**Documento gerado por:** Claude (Engenharia Reversa)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
