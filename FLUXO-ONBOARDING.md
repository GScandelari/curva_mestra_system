# Fluxo de Onboarding - Curva Mestra

## Visão Geral

Este documento descreve o fluxo completo de onboarding (configuração inicial) para clínicas na plataforma Curva Mestra. O onboarding é **obrigatório** e vincula o plano escolhido à criação automática da licença.

## Etapas do Onboarding

### 1. Criação da Clínica (System Admin)

**Responsável**: System Admin via `/admin/tenants/new`

**Ações**:
- System admin cria novo tenant (clínica)
- Tenant é criado com `active: false`
- Registro de onboarding é criado automaticamente com status `pending_setup`
- System admin cria usuário administrador da clínica
- Custom claims são configurados: `tenant_id`, `role: clinic_admin`, `active: true`

**Importante**: O tenant permanece INATIVO até completar o onboarding.

---

### 2. Primeiro Acesso - Configuração Inicial

**Rota**: `/clinic/setup`

**Responsável**: Clinic Admin (primeiro acesso)

**Dados Coletados**:
- Nome da clínica
- Tipo de documento (CNPJ ou CPF)
- Número do documento (validação automática para CNPJ)
- Email da clínica
- Telefone
- Endereço completo (rua, cidade, estado, CEP)

**Validações**:
- CNPJ: 14 dígitos + validação de dígitos verificadores
- CPF: 11 dígitos
- Email: formato válido
- Telefone: mínimo 10 dígitos

**Após Submissão**:
- Tenant é atualizado com os dados informados
- `max_users` é definido: 5 para CNPJ, 1 para CPF
- Status de onboarding atualizado para `pending_plan`
- Redireciona para `/clinic/setup/plan`

---

### 3. Seleção de Plano

**Rota**: `/clinic/setup/plan`

**Responsável**: Clinic Admin

**Opções de Plano**:

#### Plano Semestral
- Duração: 6 meses
- Preço: R$ 59,90/mês
- Total: R$ 359,40 (cobrado a cada 6 meses)
- Recursos: Todos incluídos

#### Plano Anual (Recomendado)
- Duração: 12 meses
- Preço: R$ 49,90/mês
- Total: R$ 598,80 (cobrado anualmente)
- Economia: ~17% comparado ao semestral
- Recursos: Todos incluídos

**Recursos Incluídos (Ambos os Planos)**:
- Gestão completa de estoque
- Controle de lotes e validades
- Rastreamento de consumo por paciente
- Relatórios e alertas
- Suporte técnico

**Após Seleção**:
- Plano é salvo no tenant (`plan_id`)
- Status de onboarding atualizado para `pending_payment`
- Registro de pagamento criado com status `pending`
- Redireciona para `/clinic/setup/payment`

---

### 4. Confirmação de Pagamento

**Rota**: `/clinic/setup/payment`

**Responsável**: Clinic Admin

**MVP (Atual)**:
- Pagamento **MOCK** automático para demonstração
- Simula processamento (2 segundos)
- Confirma automaticamente com status `approved`

**Produção (Futuro - PagSeguro)**:
- Integração com PagSeguro Checkout Transparente
- Pagamento recorrente via cartão de crédito
- Webhook para confirmação automática
- Opções: PIX, Boleto, Cartão de Crédito

**Após Confirmação**:
- Status de pagamento atualizado para `approved`
- **Licença criada automaticamente**:
  - `start_date`: Data atual
  - `end_date`: +6 meses (semestral) ou +12 meses (anual)
  - `status`: `ativa`
  - `max_users`: Conforme plano
  - `auto_renew`: `true` (renovação automática habilitada)
- Tenant é ativado (`active: true`)
- Status de onboarding atualizado para `completed`
- Redireciona para `/clinic/setup/success`

---

### 5. Onboarding Concluído

**Rota**: `/clinic/setup/success`

**Responsável**: Clinic Admin

**Exibição**:
- Confirmação visual de sucesso
- Resumo do plano ativado
- Próximos passos:
  1. Configurar estoque
  2. Cadastrar pacientes
  3. Convidar usuários
  4. Configurar alertas

**Ação Final**:
- Botão "Ir para o Dashboard"
- Redireciona para `/clinic/dashboard`
- Acesso completo à plataforma liberado

---

## Middleware de Proteção

### ProtectedRoute

Todas as rotas `/clinic/*` (exceto `/clinic/setup/*`) passam por verificação:

```typescript
if (role === "clinic_admin" || role === "clinic_user") {
  // Verifica se onboarding está completo
  const needsSetup = await needsOnboarding(tenantId);

  if (needsSetup) {
    // Redireciona para etapa pendente
    switch (nextStep) {
      case "pending_setup": router.push("/clinic/setup");
      case "pending_plan": router.push("/clinic/setup/plan");
      case "pending_payment": router.push("/clinic/setup/payment");
    }
  }
}
```

**Resultado**: Usuários não conseguem acessar o sistema até completar 100% do onboarding.

---

## Estrutura de Dados

### Coleção: `tenant_onboarding/{tenantId}`

```typescript
{
  tenant_id: string;
  status: "pending_setup" | "pending_plan" | "pending_payment" | "completed";
  setup_completed: boolean;
  plan_selected: boolean;
  payment_confirmed: boolean;
  selected_plan_id?: "semestral" | "anual";
  payment_method?: "credit_card" | "pix" | "boleto";
  payment_data?: {
    provider: "pagseguro" | "mock";
    payment_status: "pending" | "processing" | "approved" | "rejected";
    transaction_id?: string;
    payment_date?: Timestamp;
    card_last_digits?: string;
    card_brand?: string;
  };
  created_at: Timestamp;
  updated_at: Timestamp;
  completed_at?: Timestamp;
}
```

### Coleção: `licenses/{licenseId}`

Criada automaticamente após confirmação de pagamento:

```typescript
{
  tenant_id: string;
  plan_id: "semestral" | "anual";
  status: "ativa" | "expirada" | "suspensa";
  start_date: Timestamp;
  end_date: Timestamp;
  max_users: number;
  auto_renew: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

---

## Regras de Segurança (Firestore)

```javascript
match /tenant_onboarding/{tenantId} {
  // System admins têm acesso total
  allow read, write: if isSystemAdmin();

  // Usuários do tenant podem ler e atualizar seu próprio onboarding
  allow read, update: if belongsToTenant(tenantId);

  // Apenas system_admin pode criar
  allow create: if isSystemAdmin();
}
```

---

## Integração Futura - PagSeguro

### Checkout Transparente

1. **Criar Sessão**:
```typescript
const session = await pagseguro.createSession();
```

2. **Tokenizar Cartão**:
```typescript
const cardToken = PagSeguroDirectPayment.createCardToken({
  cardNumber, cvv, expirationMonth, expirationYear, holder
});
```

3. **Criar Assinatura Recorrente**:
```typescript
const subscription = await pagseguro.createRecurringPayment({
  plan: planId,
  paymentMethod: cardToken,
  customer: { email, name, document }
});
```

4. **Webhook de Confirmação**:
```typescript
// POST /api/webhooks/pagseguro
app.post('/api/webhooks/pagseguro', async (req, res) => {
  const { notificationCode } = req.body;
  const payment = await pagseguro.getNotification(notificationCode);

  if (payment.status === "approved") {
    await confirmPayment(tenantId, payment);
  }
});
```

---

## Testes

### Testar Fluxo Completo

1. **Como System Admin**:
   - Criar novo tenant em `/admin/tenants/new`
   - Criar usuário clinic_admin para o tenant
   - Fazer logout

2. **Como Clinic Admin (novo)**:
   - Login com credenciais criadas
   - Será redirecionado automaticamente para `/clinic/setup`
   - Preencher dados da clínica
   - Selecionar plano
   - Confirmar pagamento (mock)
   - Verificar licença criada
   - Acessar dashboard

3. **Verificações**:
   - Tenant está ativo
   - Licença foi criada
   - `end_date` está correto (6 ou 12 meses)
   - Onboarding status é `completed`

---

## Perguntas Frequentes

### P: O que acontece se o usuário fechar o navegador durante o onboarding?

R: O sistema salva o progresso a cada etapa. Ao fazer login novamente, o usuário será redirecionado automaticamente para a etapa onde parou.

### P: É possível pular o onboarding?

R: Não. O middleware `ProtectedRoute` bloqueia acesso a todas as rotas até completar 100% do onboarding.

### P: Como resetar o onboarding de um tenant?

R: Apenas system_admin pode resetar via função `resetOnboarding(tenantId)` (use com cuidado).

### P: O que acontece quando a licença expira?

R: Cloud Function `checkLicenseExpiration` verifica diariamente e:
- Marca licenças vencidas como `expirada`
- Envia notificações 15 dias antes
- Processa renovações automáticas (se `auto_renew: true`)

### P: Como funciona a renovação automática?

R: Quando integrado com PagSeguro, a renovação é automática via assinatura recorrente. No MVP (mock), renovações devem ser feitas manualmente pelo system_admin.

---

## Checklist de Implementação

- [x] Tipos TypeScript (`onboarding.ts`)
- [x] Serviço de onboarding (`tenantOnboardingService.ts`)
- [x] Página de setup (`/clinic/setup`)
- [x] Página de seleção de plano (`/clinic/setup/plan`)
- [x] Página de pagamento mock (`/clinic/setup/payment`)
- [x] Página de sucesso (`/clinic/setup/success`)
- [x] Middleware `ProtectedRoute` atualizado
- [x] Criação de tenant com `initializeTenantOnboarding()`
- [x] Regras de segurança Firestore
- [ ] Integração com PagSeguro (produção)
- [ ] Webhook de confirmação de pagamento
- [ ] Testes E2E do fluxo completo

---

**Última Atualização**: 27/11/2025
**Versão**: 1.0.0
**Status**: MVP Implementado (Mock Payment)
