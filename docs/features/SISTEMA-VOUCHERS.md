# Sistema de Vouchers de Desconto - Curva Mestra

**Data de Criação**: 16/12/2025
**Versão**: 1.0
**Status**: 📋 Planejado (v1.1)

---

## 📋 Visão Geral

Sistema de vouchers de desconto que permite ao **system_admin** criar códigos promocionais para oferecer descontos aos **clinic_admin** durante o processo de onboarding, especificamente na página de pagamento do plano.

### Objetivos

1. Permitir promoções e campanhas de marketing
2. Oferecer descontos personalizados para clínicas específicas
3. Atrair novos clientes com vouchers públicos
4. Rastrear efetividade de campanhas promocionais
5. Facilitar onboarding de parceiros estratégicos

---

## 🎯 Funcionalidades Principais

### 1. Criação de Vouchers (System Admin)

**Página**: `/admin/vouchers/new`

**Campos do Formulário**:
- **Código do Voucher** (obrigatório)
  - Input text, uppercase automático
  - Validação de unicidade
  - Formato sugerido: PROMO20, PARCEIRO2025, CLINIC50
  - Máximo 20 caracteres, sem espaços

- **Descrição** (obrigatório)
  - Textarea, máximo 200 caracteres
  - Ex: "Desconto de boas-vindas para novos clientes"

- **Tipo de Desconto** (obrigatório)
  - Radio button: Percentual | Valor Fixo
  - Se Percentual: input de 1-100%
  - Se Valor Fixo: input em R$ (ex: R$ 50,00)

- **Valor do Desconto** (obrigatório)
  - Número, validação conforme tipo escolhido

- **Tipo de Voucher** (obrigatório)
  - Radio button: Público | Específico para Clínica
  - Se Específico: Select de clínicas cadastradas

- **Data de Validade** (obrigatório)
  - Date picker
  - Mínimo: hoje
  - Formato: DD/MM/YYYY

- **Limite de Uso** (opcional)
  - Checkbox: "Uso único" (default: false)
  - Se não marcado: uso ilimitado até expirar
  - Se marcado: pode ser usado apenas 1 vez

- **Ativo** (obrigatório)
  - Toggle switch (default: true)
  - Permite desativar sem deletar

### 2. Listagem de Vouchers (System Admin)

**Página**: `/admin/vouchers`

**Tabela**:
- Código
- Descrição
- Tipo (Público/Específico)
- Desconto (% ou R$)
- Validade
- Uso (X vezes usado / Limite)
- Status (Ativo/Inativo/Expirado)
- Ações (Editar, Desativar/Ativar, Ver Usos)

**Filtros**:
- Busca por código
- Status (Todos/Ativos/Inativos/Expirados)
- Tipo (Todos/Públicos/Específicos)

**Stats Cards**:
- Total de vouchers
- Vouchers ativos
- Total de usos
- Desconto total concedido (R$)

### 3. Edição de Vouchers (System Admin)

**Página**: `/admin/vouchers/[id]`

**Permite editar**:
- Descrição
- Data de validade (apenas estender)
- Ativar/Desativar

**Não permite editar** (segurança):
- Código
- Tipo de desconto
- Valor do desconto
- Tipo de voucher (público/específico)
- Limite de uso

### 4. Histórico de Uso (System Admin)

**Página**: `/admin/vouchers/[id]/usage`

**Listagem**:
- Clínica que usou
- Data/hora do uso
- Plano escolhido
- Valor original
- Desconto aplicado
- Valor final

**Export**: CSV com todos os dados

### 5. Aplicação de Voucher (Clinic Admin - Onboarding)

**Página**: `/clinic/setup/payment`

**Componente**: Campo de voucher na página de pagamento

**Fluxo**:
1. Input text "Código do voucher (opcional)"
2. Botão "Aplicar"
3. Validação em tempo real:
   - Voucher existe?
   - Está ativo?
   - Está dentro da validade?
   - É válido para esta clínica? (se específico)
   - Já foi usado? (se uso único)
4. Se válido:
   - Exibir card verde com desconto aplicado
   - Mostrar valor original vs. valor com desconto
   - Atualizar valores no formulário de pagamento
5. Se inválido:
   - Exibir mensagem de erro específica
   - Não aplicar desconto

**Exemplo Visual**:
```
┌─────────────────────────────────────────┐
│ Código do Voucher (opcional)           │
│ ┌──────────────────┐  ┌───────────┐    │
│ │ PROMO20         │  │ Aplicar   │    │
│ └──────────────────┘  └───────────┘    │
└─────────────────────────────────────────┘

✅ Voucher aplicado com sucesso!
┌─────────────────────────────────────────┐
│ 🎉 Desconto: 20% (PROMO20)             │
│                                         │
│ Valor original:    R$ 359,40           │
│ Desconto:         -R$  71,88           │
│ ─────────────────────────────────────  │
│ Valor final:       R$ 287,52           │
└─────────────────────────────────────────┘
```

---

## 🗄️ Estrutura Firestore

### Collection: `/vouchers`

```typescript
interface Voucher {
  id: string; // Auto-gerado
  code: string; // UPPERCASE, único
  description: string;
  discount_type: "percentage" | "fixed_value";
  discount_value: number; // Percentual (1-100) ou valor em BRL
  voucher_type: "public" | "specific";
  tenant_id?: string; // Apenas se voucher_type = "specific"
  valid_until: Timestamp; // Data de expiração
  single_use: boolean; // Uso único ou múltiplo
  active: boolean; // Ativo/Inativo
  times_used: number; // Contador de usos
  created_by: string; // UID do system_admin que criou
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Índices necessários**:
- `code` (único)
- `active + valid_until` (consulta de vouchers válidos)
- `voucher_type + active` (filtros)

### Collection: `/voucher_usage`

```typescript
interface VoucherUsage {
  id: string; // Auto-gerado
  voucher_id: string; // Referência ao voucher
  voucher_code: string; // Denormalizado para facilitar queries
  tenant_id: string; // Clínica que usou
  tenant_name: string; // Denormalizado
  plan_id: string; // Plano escolhido
  original_amount: number; // Valor original (BRL)
  discount_amount: number; // Desconto aplicado (BRL)
  final_amount: number; // Valor final (BRL)
  used_at: Timestamp;
  used_by: string; // UID do clinic_admin
}
```

**Índices necessários**:
- `voucher_id + used_at` (histórico por voucher)
- `tenant_id` (histórico por clínica)

---

## 🔐 Regras de Segurança Firestore

```javascript
// Vouchers - apenas system_admin pode criar/editar
match /vouchers/{voucherId} {
  // Leitura: apenas autenticados (para validação durante pagamento)
  allow read: if request.auth != null;

  // Escrita: apenas system_admin
  allow create, update, delete: if request.auth.token.is_system_admin == true;
}

// Histórico de uso - apenas system_admin lê
match /voucher_usage/{usageId} {
  allow read: if request.auth.token.is_system_admin == true;

  // Criação automática via Cloud Function durante pagamento
  allow create: if request.auth != null;
}
```

---

## ⚙️ Serviços

### `src/lib/services/voucherService.ts`

```typescript
// Listar todos os vouchers (admin)
export async function listVouchers(filters?: {
  active?: boolean;
  type?: "public" | "specific";
}): Promise<Voucher[]>

// Criar voucher (admin)
export async function createVoucher(data: CreateVoucherData): Promise<{
  success: boolean;
  voucherId?: string;
  error?: string;
}>

// Atualizar voucher (admin)
export async function updateVoucher(
  voucherId: string,
  updates: UpdateVoucherData
): Promise<{ success: boolean; error?: string }>

// Desativar voucher (admin)
export async function deactivateVoucher(voucherId: string): Promise<void>

// Reativar voucher (admin)
export async function reactivateVoucher(voucherId: string): Promise<void>

// Validar voucher (onboarding)
export async function validateVoucher(
  code: string,
  tenantId: string
): Promise<{
  valid: boolean;
  voucher?: Voucher;
  error?: string;
}>

// Aplicar voucher e criar registro de uso
export async function applyVoucher(
  code: string,
  tenantId: string,
  planId: string,
  originalAmount: number
): Promise<{
  success: boolean;
  discountAmount?: number;
  finalAmount?: number;
  error?: string;
}>

// Calcular desconto
export function calculateDiscount(
  voucher: Voucher,
  originalAmount: number
): number

// Buscar histórico de uso de um voucher
export async function getVoucherUsage(
  voucherId: string
): Promise<VoucherUsage[]>

// Stats de vouchers
export async function getVoucherStats(): Promise<{
  total: number;
  active: number;
  totalUses: number;
  totalDiscountGiven: number;
}>
```

---

## 🔄 Fluxos Principais

### Fluxo 1: System Admin Cria Voucher

```
1. Admin acessa /admin/vouchers/new
2. Preenche formulário com dados do voucher
3. Clica em "Criar Voucher"
4. Frontend valida:
   - Código único
   - Valores dentro dos limites
   - Data de validade futura
5. Chama voucherService.createVoucher()
6. Service valida novamente no backend
7. Cria documento em /vouchers
8. Retorna sucesso
9. Redireciona para /admin/vouchers
10. Exibe toast: "Voucher PROMO20 criado com sucesso!"
```

### Fluxo 2: Clinic Admin Aplica Voucher

```
1. Clinic Admin na página /clinic/setup/payment
2. Seleciona plano (ex: Semestral - R$ 359,40)
3. Digita código do voucher: "PROMO20"
4. Clica em "Aplicar"
5. Frontend chama voucherService.validateVoucher("PROMO20", tenantId)
6. Service verifica:
   ✓ Voucher existe com código "PROMO20"?
   ✓ Está ativo?
   ✓ Está dentro da validade?
   ✓ É público OU específico para este tenant?
   ✓ Não atingiu limite de uso?
7. Se válido:
   - Calcula desconto: 20% de R$ 359,40 = R$ 71,88
   - Retorna voucher + discount
8. Frontend exibe card com desconto aplicado
9. Atualiza valor final no formulário
10. Quando usuário confirma pagamento:
    - Chama voucherService.applyVoucher()
    - Cria registro em /voucher_usage
    - Incrementa times_used no voucher
    - Processa pagamento com valor descontado
```

### Fluxo 3: Admin Visualiza Uso de Voucher

```
1. Admin acessa /admin/vouchers
2. Clica em "Ver Usos" no voucher PROMO20
3. Abre /admin/vouchers/{id}/usage
4. Service busca todos os registros em /voucher_usage
5. Exibe tabela com:
   - Clínicas que usaram
   - Datas de uso
   - Valores (original, desconto, final)
6. Botão "Exportar CSV" para análise
```

---

## 🎨 Interface (Wireframes)

### Página de Criação (/admin/vouchers/new)

```
┌────────────────────────────────────────────────────────┐
│  Criar Novo Voucher                              [X]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Código do Voucher *                                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │ PROMO20                                          │ │
│  └──────────────────────────────────────────────────┘ │
│  Máximo 20 caracteres, sem espaços                    │
│                                                        │
│  Descrição *                                           │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Desconto de boas-vindas para novos clientes     │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│  200 caracteres restantes                             │
│                                                        │
│  Tipo de Desconto *                                    │
│  ⚫ Percentual    ⚪ Valor Fixo                         │
│                                                        │
│  Valor do Desconto *                                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 20                                              %│ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  Tipo de Voucher *                                     │
│  ⚫ Público    ⚪ Específico para Clínica               │
│                                                        │
│  Data de Validade *                                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 31/12/2025                              📅       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ☑ Uso único (pode ser usado apenas uma vez)          │
│  ☑ Voucher ativo                                       │
│                                                        │
│  ┌─────────────┐  ┌─────────────┐                     │
│  │  Cancelar   │  │   Criar     │                     │
│  └─────────────┘  └─────────────┘                     │
└────────────────────────────────────────────────────────┘
```

### Listagem de Vouchers (/admin/vouchers)

```
┌──────────────────────────────────────────────────────────┐
│  Vouchers de Desconto                    [+ Novo Voucher]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Stats                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │
│  │ Total   │ │ Ativos  │ │ Usos    │ │ Desconto    │  │
│  │   12    │ │    8    │ │   45    │ │ R$ 2.450,00 │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │
│                                                          │
│  🔍 Filtros                                              │
│  [Buscar código...]  [Todos ▾] [Todos tipos ▾]          │
│                                                          │
│  📋 Lista                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │Código    │Desc  │Tipo   │Desconto│Uso  │Status   │ │
│  ├──────────┼──────┼───────┼────────┼─────┼─────────┤ │
│  │PROMO20   │Boas..│Público│20%     │12/∞ │✅ Ativo │ │
│  │PARCEIRO50│Parc..│Especí.│R$ 50   │1/1  │❌ Usado │ │
│  │CLINIC10  │Desc..│Público│10%     │8/∞  │⏰ Exp.  │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 🧪 Casos de Teste

### Teste 1: Criar Voucher Público

**Dados**:
- Código: TESTE20
- Tipo: Público, Percentual 20%
- Validade: 31/12/2025
- Uso: Ilimitado

**Resultado Esperado**: ✅ Voucher criado com sucesso

### Teste 2: Aplicar Voucher Válido

**Cenário**: Clinic Admin no onboarding
**Voucher**: TESTE20
**Plano**: Semestral (R$ 359,40)

**Resultado Esperado**:
- Desconto: R$ 71,88
- Valor final: R$ 287,52
- Card verde exibido

### Teste 3: Voucher Expirado

**Cenário**: Voucher com validade 01/01/2024
**Data atual**: 16/12/2025

**Resultado Esperado**: ❌ "Voucher expirado"

### Teste 4: Voucher Específico para Outra Clínica

**Cenário**: Voucher específico para Clínica A
**Tentativa**: Clínica B tenta usar

**Resultado Esperado**: ❌ "Voucher não válido para esta clínica"

### Teste 5: Uso Único Já Usado

**Cenário**: Voucher uso único, já foi usado
**Tentativa**: Usar novamente

**Resultado Esperado**: ❌ "Voucher já foi utilizado"

---

## 📊 Métricas e Analytics

### Dashboards

**Admin Dashboard** (`/admin/vouchers/analytics`):
- Vouchers mais usados (top 10)
- Desconto total concedido por mês
- Taxa de conversão com voucher vs. sem voucher
- Vouchers próximos ao vencimento
- Gráfico de usos ao longo do tempo

### Reports

**Exportação CSV**:
- Todos os vouchers com stats
- Histórico completo de uso
- Análise por período

---

## 🚀 Implementação - Ordem Sugerida

1. **Fase 1 - Backend (8h)**
   - Criar types TypeScript
   - Criar collection /vouchers
   - Implementar voucherService.ts
   - Regras de segurança Firestore

2. **Fase 2 - Admin UI (12h)**
   - Página de listagem (/admin/vouchers)
   - Página de criação (/admin/vouchers/new)
   - Página de edição (/admin/vouchers/[id])
   - Componentes reutilizáveis (VoucherCard, VoucherForm)

3. **Fase 3 - Aplicação no Onboarding (8h)**
   - Componente VoucherInput
   - Integração na página de pagamento
   - Validação em tempo real
   - Feedback visual de desconto aplicado

4. **Fase 4 - Histórico e Analytics (6h)**
   - Página de histórico de uso
   - Dashboard de analytics
   - Exportação CSV

5. **Fase 5 - Testes (4h)**
   - Testes unitários (voucherService)
   - Testes E2E (fluxo completo)
   - Testes de validação

**Total estimado**: ~38 horas (~5 dias)

---

## 🔮 Melhorias Futuras (v2.0)

- Vouchers com limite de quantidade (ex: primeiros 100 usuários)
- Vouchers escalonados (desconto maior para planos maiores)
- Vouchers com condições (ex: válido apenas para plano anual)
- Sistema de afiliados (voucher personalizado por parceiro)
- A/B testing de vouchers
- Notificações automáticas quando voucher está próximo ao vencimento
- Renovação automática de vouchers recorrentes
- API pública para criar vouchers programaticamente

---

**Documentação criada por**: Claude AI
**Projeto**: Curva Mestra
**Versão do Sistema**: v1.1 (Planejado)
