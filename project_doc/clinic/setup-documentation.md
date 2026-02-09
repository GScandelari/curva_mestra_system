# Documentação Experimental - Setup (Configuração Inicial)

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Formulário de configuração inicial da clínica, composto por 2 etapas (steps). Permite que o `clinic_admin` preencha ou revise os dados cadastrais da clínica antes de prosseguir para a seleção de plano. Suporta pré-preenchimento com dados inseridos pelo `system_admin`.

- **Arquivo**: `src/app/(clinic)/clinic/setup/page.tsx`
- **Rota**: `/clinic/setup`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `ClinicSetupPage`
- **Dependências principais**:
  - `useAuth` (hook — autenticação, claims e signOut)
  - `completeClinicSetup`, `getTenantOnboarding` de `@/lib/services/tenantOnboardingService`
  - `getTenant` de `@/lib/services/tenantServiceDirect`
  - `ClinicSetupData` de `@/types/onboarding`
  - `validateCNPJ` de `@/types/tenant`
  - Componentes Shadcn/ui: `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`, `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Alert`, `AlertDescription`, `Button`
  - Ícones Lucide: `Building2`, `CheckCircle2`, `InfoIcon`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Preenche/revisa dados e submete o formulário |
| `clinic_user` | N/A | Não acessa setup (fluxo de onboarding exclusivo do admin) |
| `system_admin` | Indireto | Pré-cadastra dados do tenant que são carregados nesta página |

---

## 3. Estrutura de Dados

### 3.1 TypeScript — `ClinicSetupData`

```typescript
interface ClinicSetupData {
  name: string;
  document_type: "cnpj" | "cpf";
  document_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}
```

### 3.2 Estado do Componente (useState)

```typescript
const [loading, setLoading] = useState(false);         // submissão
const [loadingData, setLoadingData] = useState(true);   // carregamento inicial
const [error, setError] = useState("");
const [step, setStep] = useState(1);                    // 1 ou 2
const [dataPreFilled, setDataPreFilled] = useState(false);
const [formData, setFormData] = useState<ClinicSetupData>({...});
```

### 3.3 Documento — `tenants/{tenantId}` (dados pré-cadastrados)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | `string` | Nome da clínica |
| `document_type` | `string` | `"cnpj"` ou `"cpf"` |
| `document_number` | `string` | CNPJ ou CPF |
| `cnpj` | `string` | CNPJ (campo legado) |
| `email` | `string` | Email da clínica |
| `phone` | `string` | Telefone |
| `address` | `string` | Endereço completo (formato legado) |
| `city` | `string` | Cidade |
| `state` | `string` | UF |
| `cep` | `string` | CEP |

### 3.4 Documento — Onboarding

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `setup_completed` | `boolean` | Se true, redireciona para `/clinic/setup/plan` |

---

## 4. Casos de Uso

### UC-001: Preencher dados básicos (Step 1)

- **Ator**: clinic_admin
- **Fluxo**:
  1. Formulário exibe 5 campos: Nome, Tipo Documento, CNPJ/CPF, Email, Telefone
  2. Máscaras aplicadas em tempo real (CNPJ, CPF, telefone)
  3. Clica em "Próximo"
  4. `validateStep1()` verifica todos os campos
  5. Se válido: avança para Step 2
- **Pós-condição**: Step 2 exibido

### UC-002: Preencher endereço (Step 2)

- **Ator**: clinic_admin
- **Fluxo**:
  1. Formulário exibe 4 campos: CEP, Endereço, Cidade, Estado
  2. Máscara de CEP aplicada
  3. Estado selecionado via dropdown (27 UFs)
  4. Clica em "Continuar" (ou "Confirmar e Continuar" se dados pré-preenchidos)
  5. `validateStep2()` verifica todos os campos
  6. `completeClinicSetup(tenantId, formData)` salva dados
  7. Redireciona para `/clinic/setup/plan`
- **Pós-condição**: Dados salvos, fluxo avança para seleção de plano

### UC-003: Revisar dados pré-cadastrados

- **Ator**: clinic_admin
- **Fluxo**:
  1. Ao carregar, busca dados existentes do tenant via `getTenant(tenantId)`
  2. Se dados existem: pré-preenche formulário e exibe Alert informativo
  3. Admin pode revisar e editar qualquer campo
  4. Botão muda para "Confirmar e Continuar"
- **Pós-condição**: Dados revisados e confirmados

### UC-004: Sair do sistema

- **Ator**: clinic_admin
- **Fluxo**:
  1. Clica em "Sair" no header
  2. `signOut()` é chamado
  3. Redireciona para `/login`
- **Pós-condição**: Usuário deslogado

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/setup            │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ getTenantOnboarding()    │
│ setup_completed?         │
└───────────┬─────────────┘
        Sim │        Não
            │         │
            ▼         ▼
  Redirect       getTenant(tenantId)
  /setup/plan         │
              ┌───────┴───────┐
              │               │
          Com dados       Sem dados
              │               │
              ▼               ▼
        Pre-preenche     Form vazio
        + Alert info
              │               │
              └───────┬───────┘
                      │
                      ▼
          ┌─── Step 1 ───┐
          │ Dados Básicos │
          │ (5 campos)    │
          └───────┬───────┘
                  │ Próximo
                  ▼
          ┌─── Step 2 ───┐
          │ Endereço      │
          │ (4 campos)    │
          └───────┬───────┘
                  │ Continuar
                  ▼
          completeClinicSetup()
                  │
            ┌─────┴─────┐
         Sucesso      Erro
            │           │
            ▼           ▼
       Redirect     Alert error
       /setup/plan
```

---

## 6. Regras de Negócio

### RN-001: Redirect se setup já completado

- **Descrição**: Se `setup_completed === true`, redireciona para `/clinic/setup/plan`
- **Aplicação**: `getTenantOnboarding(tenantId)` verificado no mount
- **Exceções**: Nenhuma
- **Justificativa**: Impedir re-configuração

### RN-002: Pré-preenchimento de dados do system_admin

- **Descrição**: Se existem dados do tenant no Firestore, formulário é pré-preenchido
- **Aplicação**: `getTenant(tenantId)` no mount; `setDataPreFilled(true)`
- **Exceções**: Campos legados (address completo) são parseados para extrair cidade, estado e CEP
- **Justificativa**: Dados inseridos pelo system_admin devem ser revisados

### RN-003: CNPJ vs CPF — limite de usuários

- **Descrição**: CNPJ permite até 5 usuários; CPF permite apenas 1
- **Aplicação**: Exibido no SelectItem: "CNPJ (até 5 usuários)" / "CPF (apenas 1 usuário)"
- **Exceções**: Nenhuma
- **Justificativa**: Diferenciação entre planos

### RN-004: Validação de CNPJ com dígitos verificadores

- **Descrição**: CNPJ é validado usando `validateCNPJ` (dígitos verificadores)
- **Aplicação**: `validateCNPJ(docNumber)` após verificar 14 dígitos
- **Exceções**: CPF valida apenas comprimento (11 dígitos), sem dígitos verificadores
- **Justificativa**: Integridade do CNPJ

### RN-005: Extração de endereço legado

- **Descrição**: Se não há city/state/cep separados, tenta extrair do campo `address` legado
- **Aplicação**: Regex para formato "Rua X, Cidade - UF, CEP"
- **Exceções**: Se formato não bater, campos ficam vazios
- **Justificativa**: Compatibilidade com dados cadastrados no formato antigo

### RN-006: Texto dinâmico do botão submit

- **Descrição**: "Confirmar e Continuar" se dados pré-preenchidos; "Continuar" caso contrário
- **Aplicação**: `dataPreFilled ? "Confirmar e Continuar" : "Continuar"`
- **Exceções**: "Salvando..." durante loading
- **Justificativa**: Comunicar se é revisão ou cadastro novo

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Carregando dados (`loadingData`) | Spinner centralizado com "Carregando dados..." | Card com spinner |
| Step 1 (Dados Básicos) | 5 campos + botão "Próximo" | Indicador: step 1 ativo (azul) |
| Step 2 (Endereço) | 4 campos + botões "Voltar" e "Continuar" | Indicador: step 1 check + step 2 ativo |
| Dados pré-preenchidos | Alert informativo no topo + botão "Confirmar e Continuar" | Alert com InfoIcon |
| Erro de validação | Alert destructive com mensagem | Alert vermelho |
| Salvando (`loading`) | Botão "Salvando...", campos desabilitados | Botão com texto alterado |
| Erro de servidor | Alert destructive com mensagem | Alert vermelho |

### Indicador de Progresso

| Step | Visual |
|------|--------|
| Step 1 ativo | Círculo "1" azul + Círculo "2" cinza |
| Step 2 ativo | Círculo com CheckCircle2 + Círculo "2" azul |

---

## 8. Validações

### 8.1 Step 1 — Dados Básicos

| Campo | Validação | Mensagem de erro |
|-------|-----------|------------------|
| `name` | Não pode ser vazio (`trim()`) | "Nome da clínica é obrigatório" |
| `document_number` (CNPJ) | 14 dígitos + `validateCNPJ` | "CNPJ deve ter 14 dígitos" / "CNPJ inválido" |
| `document_number` (CPF) | 11 dígitos | "CPF deve ter 11 dígitos" |
| `email` | Não vazio + contém "@" | "Email válido é obrigatório" |
| `phone` | Mínimo 10 dígitos numéricos | "Telefone deve ter pelo menos 10 dígitos" |

### 8.2 Step 2 — Endereço

| Campo | Validação | Mensagem de erro |
|-------|-----------|------------------|
| `address` | Não pode ser vazio | "Endereço é obrigatório" |
| `city` | Não pode ser vazio | "Cidade é obrigatória" |
| `state` | Não pode ser vazio | "Estado é obrigatório" |
| `cep` | Exatamente 8 dígitos | "CEP deve ter 8 dígitos" |

### 8.3 Funções de Formatação

- `formatCNPJ`: `XX.XXX.XXX/XXXX-XX` (14 dígitos)
- `formatCPF`: `XXX.XXX.XXX-XX` (11 dígitos)
- `formatPhone`: `(XX) XXXXX-XXXX` (11 dígitos) ou `(XX) XXXX-XXXX` (10 dígitos)
- `formatCEP`: `XXXXX-XXX` (8 dígitos)

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` — claims, signOut |
| `tenantOnboardingService` | Serviço | `getTenantOnboarding` (verificar setup) + `completeClinicSetup` (salvar) |
| `tenantServiceDirect` | Serviço | `getTenant` (dados pré-cadastrados) |
| `@/types/tenant` | Validação | `validateCNPJ` para validação de dígitos verificadores |
| Next.js Router | Navegação | Redirect para `/clinic/setup/plan` ou `/login` |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Multi-tenant | `claims.tenant_id` isola dados |
| Validação de CNPJ | Dígitos verificadores validados via `validateCNPJ` |
| SignOut | Botão "Sair" permite logout durante onboarding |
| Firestore RLS | Regras garantem isolamento multi-tenant |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Carregamento sequencial | Primeiro verifica onboarding, depois carrega tenant |
| Dois estados de loading | `loadingData` (inicial) e `loading` (submissão) |
| Formulário local | Todos os dados no state até submit |
| Formatação em tempo real | Máscaras aplicadas no onChange |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Labels vinculados | Sim | `<Label htmlFor>` + `id` nos inputs |
| Campos obrigatórios | Sim | Asterisco `*` visual nos labels |
| Feedback de erro | Sim | Alert destructive com mensagem clara |
| Indicador de progresso | Parcial | Visual de steps sem aria-label |
| Select acessível | Sim | Componente Shadcn Select com ARIA |
| Navegação por teclado | Sim | Form nativo com onSubmit |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Setup já completado | E2E | Verificar redirect para `/clinic/setup/plan` |
| Dados pré-preenchidos | E2E | Verificar pré-preenchimento e Alert informativo |
| Step 1 validação completa | Unitário | Testar cada campo obrigatório |
| CNPJ inválido | Unitário | Verificar erro de dígitos verificadores |
| CPF com 10 dígitos | Unitário | Verificar erro "CPF deve ter 11 dígitos" |
| Avançar para Step 2 | E2E | Verificar transição e indicador de progresso |
| Voltar para Step 1 | E2E | Verificar que dados são preservados |
| Submit com sucesso | E2E | Verificar redirect para `/clinic/setup/plan` |
| Erro de servidor | E2E | Verificar Alert destructive |
| Máscara de CNPJ | Unitário | Verificar formato `XX.XXX.XXX/XXXX-XX` |
| Máscara de CEP | Unitário | Verificar formato `XXXXX-XXX` |
| Extração de endereço legado | Unitário | Verificar parse de "Rua X, Cidade - UF, CEP" |
| Botão Sair | E2E | Verificar signOut e redirect para /login |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Busca de CEP via API | Alta | Auto-preencher endereço ao digitar CEP |
| Validação de CPF | Média | Implementar dígitos verificadores para CPF |
| Upload de logo | Baixa | Permitir upload do logo da clínica |
| Confirmação visual de revisão | Baixa | Destacar campos alterados pelo admin |

---

## 15. Dependências e Relacionamentos

```
setup (este doc)
├── useAuth (hook) — autenticação, claims, signOut
├── tenantOnboardingService
│   ├── getTenantOnboarding — verifica se setup foi completado
│   └── completeClinicSetup — salva dados da clínica
├── tenantServiceDirect
│   └── getTenant — carrega dados pré-cadastrados
├── @/types/tenant
│   └── validateCNPJ — validação de CNPJ
├── @/types/onboarding
│   └── ClinicSetupData — tipo do formulário
└── setup/plan — próximo passo do onboarding
```

### Fluxo de Onboarding

```
/clinic/setup (este) → /clinic/setup/terms → /clinic/setup/plan → /clinic/setup/payment → /clinic/setup/success
```

---

## 16. Observações Técnicas

- A lista de estados brasileiros (BRAZILIAN_STATES) contém todas as 27 UFs.
- A página utiliza background gradiente `from-blue-50 to-indigo-100` (diferente do layout padrão).
- Os dados são salvos via `completeClinicSetup(tenantId, formData)` do tenantOnboardingService.
- A extração de cidade/estado/CEP de endereços legados assume formato "Rua X, Cidade - UF, CEP".
- Máscaras de formatação (CNPJ, CPF, telefone, CEP) são aplicadas em tempo real durante digitação.
- O campo `document_number` aceita tanto o valor do campo `document_number` quanto do campo legado `cnpj` do tenant.
- O `error` state é limpo a cada mudança de campo via `handleInputChange`.
- A página não usa o layout padrão da clínica — tem header próprio com botão "Sair".

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
| `claims` | Custom Claims do Firebase Auth |
| `setup_completed` | Flag do onboarding que indica se o setup já foi feito |
| `document_type` | Tipo de documento: `"cnpj"` (clínica) ou `"cpf"` (autônomo) |
| `validateCNPJ` | Função que valida dígitos verificadores do CNPJ |
| `dataPreFilled` | Boolean que indica se dados foram pré-cadastrados pelo system_admin |
| `ClinicSetupData` | Tipo que representa os dados do formulário de setup |
| `BRAZILIAN_STATES` | Array com as 27 UFs do Brasil |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/setup/page.tsx`
- Serviço onboarding: `src/lib/services/tenantOnboardingService.ts`
- Serviço tenant: `src/lib/services/tenantServiceDirect.ts`
- Types: `src/types/onboarding.ts`, `src/types/tenant.ts`
- Próximo passo: `project_doc/clinic/setup-plan-documentation.md`

---

## 20. Anexos

### Anexo A — Campos do Formulário

**Step 1 — Dados Básicos:**

| Campo | Tipo | Obrigatório | Máscara | Placeholder |
|-------|------|-------------|---------|-------------|
| `name` | text | Sim | - | "Ex: Clínica Beleza e Estética" |
| `document_type` | select | Sim | - | CNPJ/CPF |
| `document_number` | text | Sim | CNPJ/CPF | "00.000.000/0000-00" / "000.000.000-00" |
| `email` | email | Sim | - | "contato@clinica.com.br" |
| `phone` | text | Sim | `(XX) XXXXX-XXXX` | "(00) 00000-0000" |

**Step 2 — Endereço:**

| Campo | Tipo | Obrigatório | Máscara | Placeholder |
|-------|------|-------------|---------|-------------|
| `cep` | text | Sim | `XXXXX-XXX` | "00000-000" |
| `address` | text | Sim | - | "Rua, número, complemento" |
| `city` | text | Sim | - | "São Paulo" |
| `state` | select | Sim | UF | 27 estados |

### Anexo B — Estrutura do Layout

```
min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100
├── Header: "Curva Mestra" + Botão "Sair"
└── Card (max-w-2xl, centralizado)
    ├── CardHeader: Ícone Building2 + Título + Descrição
    │   ├── Alert informativo (se dataPreFilled)
    │   └── Indicador de progresso (2 steps)
    └── CardContent: Form
        ├── Alert de erro (condicional)
        ├── Step 1: 5 campos + "Próximo"
        └── Step 2: 4 campos + "Voltar" / "Continuar"
```
