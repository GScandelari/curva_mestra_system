# Fluxo de Onboarding com Revisão de Dados

## Objetivo
Modificar o fluxo de onboarding para que o system_admin pré-cadastre os dados da clínica e o clinic_admin revise e confirme as informações antes de continuar com a seleção de plano.

## Alterações Implementadas

### 1. Estrutura de Dados do Tenant

**Arquivo**: `src/types/tenant.ts`

Adicionados campos separados para endereço completo:
```typescript
export interface Tenant {
  // ... campos existentes ...
  address: string;     // Apenas rua, número, complemento
  city?: string;       // Cidade separada
  state?: string;      // Estado separado (UF)
  cep?: string;        // CEP separado
  // ... demais campos ...
}
```

### 2. Criação de Tenant pelo System Admin

**Arquivo**: `src/app/(admin)/admin/tenants/new/page.tsx`

- Adicionados campos separados no formulário:
  - CEP (com formatação automática)
  - Endereço (apenas rua/número)
  - Cidade
  - Estado (dropdown com todos os estados brasileiros)

- O system_admin agora preenche todos os dados da clínica antes de vincular o primeiro usuário

### 3. Página de Setup para Clinic Admin

**Arquivo**: `src/app/(clinic)/clinic/setup/page.tsx`

**Mudanças principais:**

1. **Carregamento de Dados Existentes**:
   - Ao acessar `/clinic/setup`, a página carrega os dados do tenant já cadastrados
   - Extrai cidade, estado e CEP do campo `address` caso ainda não estejam separados
   - Pre-preenche todos os campos do formulário

2. **UI Adaptada**:
   - Título muda para "Revisão de Dados da Clínica" quando dados foram pré-preenchidos
   - Alert informativo indicando que os dados foram cadastrados pelo administrador
   - Botão muda de "Continuar" para "Confirmar e Continuar"
   - Loading state enquanto carrega os dados

3. **Edição Permitida**:
   - Clinic_admin pode editar qualquer campo antes de confirmar
   - Validações são mantidas

### 4. Serviço de Onboarding

**Arquivo**: `src/lib/services/tenantOnboardingService.ts`

- Função `completeClinicSetup` atualizada para salvar campos separados:
  ```typescript
  await updateTenant(tenantId, {
    name: setupData.name,
    document_type: setupData.document_type,
    document_number: setupData.document_number.replace(/\D/g, ""),
    email: setupData.email,
    phone: setupData.phone.replace(/\D/g, ""),
    address: setupData.address,  // Apenas rua/número
    city: setupData.city,         // Cidade separada
    state: setupData.state,       // Estado separado
    cep: setupData.cep.replace(/\D/g, ""), // CEP separado
    max_users: setupData.document_type === "cnpj" ? 5 : 1,
  });
  ```

### 5. Serviço de Tenant

**Arquivo**: `src/lib/services/tenantServiceDirect.ts`

- Função `createTenant` salva os novos campos
- Função `updateTenant` atualiza os novos campos
- Suporte para cidade, estado e CEP separados

## Fluxo Completo

### 1. System Admin Cria Clínica
1. Acessa `/admin/tenants/new`
2. Preenche todos os dados:
   - Nome da clínica
   - Tipo de documento (CPF/CNPJ)
   - Documento
   - Email
   - Telefone
   - CEP
   - Endereço (rua/número)
   - Cidade
   - Estado
   - Plano
3. Salva a clínica (tenant é criado INATIVO)
4. Vincula um usuário como clinic_admin

### 2. Clinic Admin Acessa o Sistema
1. Faz login pela primeira vez
2. É redirecionado para `/clinic/setup`
3. Vê todos os dados pré-preenchidos
4. Revisa as informações
5. Pode editar se necessário
6. Clica em "Confirmar e Continuar"
7. É redirecionado para `/clinic/setup/plan` para escolher o plano

### 3. Seleção de Plano e Pagamento
1. Clinic_admin seleciona o plano
2. Simula pagamento (mock para MVP)
3. Licença é criada automaticamente
4. Tenant é ativado
5. Redirecionado para o dashboard

## Compatibilidade

- **Dados Antigos**: Se um tenant foi criado antes (sem city/state/cep separados), a página de setup tenta extrair esses dados do campo `address` usando regex
- **Campo Address**: Mantido por compatibilidade, mas agora armazena apenas rua/número
- **Campo CNPJ**: Mantido por compatibilidade (deprecated), mas `document_number` é o campo oficial

## Validações

- Todos os campos obrigatórios são validados
- CPF/CNPJ são validados com dígitos verificadores
- CEP deve ter 8 dígitos
- Telefone deve ter 10 ou 11 dígitos
- Email deve ser válido

## Próximos Passos

1. Testar fluxo completo em desenvolvimento:
   - Criar tenant como system_admin
   - Vincular usuário
   - Fazer login como clinic_admin
   - Revisar dados
   - Confirmar setup

2. Verificar se dados são salvos corretamente no Firestore

3. Testar compatibilidade com tenants existentes
