# Documentação Experimental - Cadastro de Novo Paciente

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Formulário para cadastro de um novo paciente vinculado ao tenant corrente. Acessível apenas para usuários com role `clinic_admin`. Permite preenchimento de dados pessoais com formatação automática de telefone, CPF e data de nascimento.

- **Arquivo**: `src/app/(clinic)/clinic/patients/new/page.tsx`
- **Rota**: `/clinic/patients/new`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `NewPatientPage`
- **Dependências principais**:
  - `useAuth` (hook de autenticação com claims e user)
  - `createPatient` (serviço `patientService`)
  - Componentes Shadcn/ui: `Button`, `Input`, `Textarea`
  - Ícone Lucide: `ArrowLeft`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Acessa o formulário e cadastra novos pacientes |
| `clinic_user` | Bloqueado | Redirecionado automaticamente para `/clinic/patients` via `useEffect` |
| `clinic_consultant` | Bloqueado | Redirecionado automaticamente para `/clinic/patients` via `useEffect` |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

---

## 3. Estrutura de Dados

### 3.1 Documento Firestore — `tenants/{tenant_id}/patients/{patient_id}`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `tenant_id` | `string` | Sim | ID do tenant (isolamento multi-tenant) |
| `codigo` | `string` | Sim | Código único — manual ou auto-gerado (PAC + 8 dígitos do timestamp) |
| `nome` | `string` | Sim | Nome completo do paciente |
| `telefone` | `string \| null` | Não | Telefone formatado `(XX) XXXXX-XXXX` ou `null` |
| `email` | `string \| null` | Não | Email em lowercase ou `null` |
| `data_nascimento` | `string \| null` | Não | Data formatada `DD/MM/AAAA` ou `null` |
| `cpf` | `string \| null` | Não | CPF apenas dígitos (11 caracteres) ou `null` |
| `observacoes` | `string \| null` | Não | Texto livre ou `null` |
| `created_by` | `string` | Sim | UID do usuário que criou |
| `created_by_name` | `string` | Sim | displayName do usuário que criou |
| `created_at` | `Timestamp` | Sim | Data de criação (serverTimestamp) |
| `updated_at` | `Timestamp` | Sim | Data de atualização (serverTimestamp) |

### 3.2 Estado do Formulário (useState)

```typescript
const [formData, setFormData] = useState({
  codigo: "",
  nome: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  cpf: "",
  observacoes: "",
});
const [loading, setLoading] = useState(false);
```

### 3.3 TypeScript — `CreatePatientInput`

```typescript
interface CreatePatientInput {
  codigo?: string;
  nome: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  cpf?: string;
  observacoes?: string;
}
```

---

## 4. Casos de Uso

### UC-001: Cadastrar novo paciente com dados completos

- **Ator**: clinic_admin
- **Pré-condição**: Usuário autenticado com role `clinic_admin`
- **Fluxo**:
  1. Usuário acessa `/clinic/patients/new`
  2. Preenche os campos do formulário (nome obrigatório, demais opcionais)
  3. Máscaras são aplicadas automaticamente em telefone, CPF e data de nascimento
  4. Clica em "Cadastrar Paciente"
  5. Sistema valida o nome e envia dados para `createPatient`
  6. Serviço gera código se não informado, valida código único e CPF
  7. Documento é criado no Firestore
  8. Alert "Paciente cadastrado com sucesso!" + redirect para `/clinic/patients`
- **Pós-condição**: Paciente criado no Firestore com auditoria (created_by, created_by_name)

### UC-002: Cadastrar paciente com código automático

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário deixa o campo "Código" em branco
  2. Submete o formulário
  3. Serviço gera código no formato `PAC` + últimos 8 dígitos do timestamp (`Date.now()`)
- **Pós-condição**: Paciente criado com código no formato `PAC12345678`

### UC-003: Cadastrar paciente com código manual

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário digita um código personalizado
  2. Submete o formulário
  3. Serviço verifica se o código já existe no tenant (query `where("codigo", "==", codigo)`)
  4. Se duplicado: alert com erro "Já existe um paciente com o código {codigo}"
  5. Se único: paciente é criado com o código informado
- **Pós-condição**: Paciente criado com código customizado

### UC-004: Voltar para listagem

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário clica em "Voltar" (topo) ou "Cancelar" (formulário)
  2. `router.back()` retorna à página anterior
- **Pós-condição**: Nenhum dado é salvo

### UC-005: Bloqueio de acesso por permissão

- **Ator**: clinic_user, clinic_consultant
- **Fluxo**:
  1. Usuário tenta acessar `/clinic/patients/new`
  2. `useEffect` verifica `claims.role !== "clinic_admin"`
  3. Redirect automático para `/clinic/patients`
- **Pós-condição**: Usuário não autorizado não vê o formulário

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/patients/new     │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ É clinic_admin?├──────────► Redirect /clinic/patients
    └───────┬───────┘
            │ Sim
            ▼
┌─────────────────────────┐
│ Exibe formulário vazio   │
│ (7 campos + 2 botões)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Usuário preenche campos  │
│ (máscaras automáticas)   │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ Nome preenchido?├─────────► alert("Nome é obrigatório")
    └───────┬───────┘
            │ Sim
            ▼
┌─────────────────────────┐
│ loading = true           │
│ Botão: "Cadastrando..."  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ createPatient(           │
│   tenant_id, uid, name,  │
│   { codigo?, nome, ... } │
│ )                        │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
   Sucesso      Erro
      │           │
      ▼           ▼
  alert(✓)    alert(erro)
  redirect    loading=false
```

---

## 6. Regras de Negócio

### RN-001: Acesso restrito a clinic_admin

- **Descrição**: Apenas usuários com role `clinic_admin` podem cadastrar pacientes
- **Aplicação**: `useEffect` verifica `claims.role` e redireciona se diferente de `clinic_admin`
- **Exceções**: Nenhuma
- **Justificativa**: Controle de quem pode cadastrar pacientes na clínica

### RN-002: Nome é o único campo obrigatório

- **Descrição**: O campo `nome` é obrigatório; todos os demais são opcionais
- **Aplicação**: Atributo `required` no Input + verificação `nome.trim()` no handleSubmit
- **Exceções**: Nenhuma
- **Justificativa**: Mínimo necessário para identificar um paciente

### RN-003: Geração automática de código

- **Descrição**: Se o campo código não for informado, o serviço gera automaticamente no formato `PAC` + últimos 8 dígitos de `Date.now()`
- **Aplicação**: `generatePatientCode()` em `patientService.ts`
- **Exceções**: Se o código gerado já existir, haverá erro (improvável devido à granularidade do timestamp)
- **Justificativa**: Garantir que todo paciente tenha um código único de identificação

### RN-004: Código único por tenant

- **Descrição**: Não podem existir dois pacientes com o mesmo código no mesmo tenant
- **Aplicação**: `getPatientByCode()` verifica antes de criar
- **Exceções**: Nenhuma
- **Justificativa**: O código é usado como identificador de negócio para vincular solicitações

### RN-005: Validação de CPF no serviço

- **Descrição**: Se CPF for informado, deve ter exatamente 11 dígitos numéricos
- **Aplicação**: `formatCPF()` remove formatação, depois verifica `cpf.length !== 11`
- **Exceções**: CPF vazio é aceito (campo opcional)
- **Justificativa**: Garantir integridade mínima do dado de CPF

### RN-006: Campos vazios armazenados como null

- **Descrição**: Campos opcionais não preenchidos são enviados como `undefined` ao serviço, que os armazena como `null` no Firestore
- **Aplicação**: `formData.campo || undefined` no submit; `input.campo?.trim() || null` no serviço
- **Exceções**: Nenhuma
- **Justificativa**: Consistência no Firestore — evitar strings vazias

### RN-007: Auditoria de criação

- **Descrição**: O documento do paciente registra quem o criou (`created_by`, `created_by_name`) e quando (`created_at` via serverTimestamp)
- **Aplicação**: Parâmetros `userId` e `userName` passados para `createPatient`
- **Exceções**: `created_by_name` usa fallback "Usuário" se `displayName` for null
- **Justificativa**: Rastreabilidade de quem cadastrou cada paciente

### RN-008: Email armazenado em lowercase

- **Descrição**: O serviço converte o email para lowercase antes de salvar
- **Aplicação**: `input.email?.trim().toLowerCase()` no `createPatient`
- **Exceções**: Nenhuma
- **Justificativa**: Normalização para evitar duplicatas por diferença de case

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Formulário vazio | Campos em branco, pronto para preenchimento | Todos inputs com placeholders |
| Digitando com máscara | Formatação automática aplicada em tempo real | Telefone: `(XX) XXXXX-XXXX`, CPF: `XXX.XXX.XXX-XX`, Data: `DD/MM/AAAA` |
| Submetendo (`loading=true`) | Botão exibe "Cadastrando...", botões ficam desabilitados | Botões com `disabled` |
| Sucesso | Alert nativo "Paciente cadastrado com sucesso!" + redirect | `alert()` + `router.push("/clinic/patients")` |
| Erro — nome vazio | Alert nativo "Nome é obrigatório" | `alert()` |
| Erro — código duplicado | Alert nativo "Já existe um paciente com o código {codigo}" | `alert()` |
| Erro — CPF inválido | Alert nativo "CPF inválido (deve ter 11 dígitos)" | `alert()` |
| Erro genérico | Alert nativo "Erro ao cadastrar paciente" + `console.error` | `alert()` |
| Sem permissão | Redirect automático para `/clinic/patients` | Nenhum visual (redirect imediato) |

---

## 8. Validações

### 8.1 Validações no Frontend

| Campo | Validação | Mecanismo |
|-------|-----------|-----------|
| `nome` | Obrigatório | `required` (HTML) + `nome.trim()` no submit |
| `email` | Formato email | `type="email"` (validação nativa do browser) |
| `telefone` | Máscara de formatação | `formatPhone()` — limita a 15 caracteres (`maxLength={15}`) |
| `cpf` | Máscara de formatação | `formatCPF()` — limita a 14 caracteres (`maxLength={14}`) |
| `data_nascimento` | Máscara de formatação | `formatDate()` — limita a 10 caracteres (`maxLength={10}`) |

### 8.2 Validações no Serviço (`createPatient`)

| Validação | Condição | Mensagem de erro |
|-----------|----------|------------------|
| Código duplicado | `getPatientByCode()` retorna resultado | "Já existe um paciente com o código {codigo}" |
| CPF inválido | `cpf.length !== 11` (após remover formatação) | "CPF inválido (deve ter 11 dígitos)" |

### 8.3 Funções de Formatação

#### `formatPhone(value: string): string`
- Remove caracteres não numéricos (`/\D/g`)
- Aplica máscara `(XX) XXXX-XXXX` para telefone fixo (≤ 10 dígitos)
- Aplica máscara `(XX) XXXXX-XXXX` para celular (11 dígitos)
- Limita a 15 caracteres com `slice(0, 15)`

#### `formatCPF(value: string): string`
- Remove caracteres não numéricos (`/\D/g`)
- Aplica máscara `XXX.XXX.XXX-XX`
- Limita a 14 caracteres com `slice(0, 14)`

#### `formatDate(value: string): string`
- Remove caracteres não numéricos (`/\D/g`)
- Aplica máscara `DD/MM/AAAA`
- Limita a 10 caracteres com `slice(0, 10)`

### 8.4 Validações Ausentes

- Data de nascimento não valida se a data é real (ex: `99/99/9999` seria aceito)
- CPF não valida dígitos verificadores (apenas verifica quantidade)
- Código aceita qualquer texto sem validação de formato
- Não há verificação de CPF duplicado no tenant

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims` (role, tenant_id) e `user` (uid, displayName) |
| Firestore | Banco de dados | `addDoc` cria documento em `tenants/{tenant_id}/patients/` |
| `patientService` | Serviço | `createPatient()` encapsula validação e criação |
| Next.js Router | Navegação | `useRouter()` para redirect pós-criação e botão voltar |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Autorização (frontend) | `useEffect` redireciona se `claims.role !== "clinic_admin"` |
| Autorização (Firestore) | Regras RLS garantem que `request.auth.token.tenant_id == tenantId` |
| Multi-tenant | `tenant_id` do claims é passado ao serviço para isolar dados |
| Auditoria | `created_by` e `created_by_name` registrados no documento |
| Sanitização | Campos passam por `.trim()` no serviço; email convertido para lowercase |
| Injeção | Firestore SDK protege contra injeção por design |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Verificação de código duplicado | Query `where("codigo", "==", codigo)` com `limit(1)` — rápida com índice |
| Sem carregamento inicial | Formulário é exibido imediatamente (sem fetch de dados) |
| Estado mínimo | Apenas `formData` e `loading` no state |
| Renderização | Componente re-renderiza apenas no onChange dos inputs |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Labels nos campos | Parcial | Labels com `<label>` mas sem `htmlFor`/`id` (não vinculados programaticamente) |
| Campo obrigatório | Sim | Asterisco visual `*` + atributo `required` |
| Feedback de erro | Limitado | Apenas `alert()` nativo — não há mensagens inline |
| Navegação por teclado | Sim | Form nativo com `onSubmit` |
| Estado de loading | Parcial | Texto muda para "Cadastrando..." mas sem aria-busy |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Cadastro com todos os campos | E2E | Preencher todos os campos e verificar criação no Firestore |
| Cadastro apenas com nome | E2E | Verificar que código é gerado automaticamente |
| Nome vazio | Unitário | Verificar que alert "Nome é obrigatório" é exibido |
| Código duplicado | Integração | Tentar criar com código existente e verificar erro |
| CPF com 10 dígitos | Integração | Verificar que serviço retorna erro de CPF inválido |
| Máscara de telefone fixo | Unitário | Digitar 10 números e verificar formato `(XX) XXXX-XXXX` |
| Máscara de celular | Unitário | Digitar 11 números e verificar formato `(XX) XXXXX-XXXX` |
| Máscara de CPF | Unitário | Digitar 11 números e verificar formato `XXX.XXX.XXX-XX` |
| Máscara de data | Unitário | Digitar 8 números e verificar formato `DD/MM/AAAA` |
| Acesso sem permissão | E2E | Acessar como clinic_user e verificar redirect |
| Botão voltar | E2E | Clicar voltar e verificar navegação |
| Estado loading | E2E | Verificar que botões ficam desabilitados durante submit |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Toast notifications | Alta | Substituir `alert()` nativo por toast (Shadcn/ui) |
| Validação de CPF | Média | Implementar validação de dígitos verificadores |
| Validação de data | Média | Verificar se data de nascimento é válida e no passado |
| Labels acessíveis | Média | Vincular `<label>` aos inputs via `htmlFor`/`id` |
| Verificação de CPF duplicado | Média | Impedir cadastro de dois pacientes com mesmo CPF |
| Foto do paciente | Baixa | Upload de foto com Firebase Storage |
| Campos adicionais | Baixa | Endereço, convênio, alergias, etc. |
| Autocomplete de endereço | Baixa | Integração com API de CEP |

---

## 15. Dependências e Relacionamentos

```
patients-new (este doc)
├── useAuth (hook) — autenticação e claims
├── patientService.createPatient — criação no Firestore
│   ├── getPatientByCode — verificação de código duplicado
│   └── generatePatientCode — geração automática de código
├── patients-list — redirect após criação e botão voltar
└── types/patient.ts — CreatePatientInput, Patient
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| `/clinic/patients` | Listagem de pacientes — destino após cadastro |
| `/clinic/patients/[id]` | Detalhe do paciente — acessível após cadastro |
| `/clinic/patients/[id]/edit` | Edição do paciente |

---

## 16. Observações Técnicas

- O feedback ao usuário é feito exclusivamente via `alert()` nativo do browser (sem toast/notification components)
- A formatação de telefone diferencia automaticamente entre fixo (10 dígitos) e celular (11 dígitos)
- O campo `codigo` aceita qualquer texto; não há validação de formato específico no frontend
- O campo `data_nascimento` usa formatação por máscara, mas não valida se a data é realmente válida (ex: `99/99/9999` seria aceito no frontend)
- O componente não possui estado de "carregamento inicial" — o formulário é exibido imediatamente
- Campos opcionais vazios são passados como `undefined` ao serviço (ternário `|| undefined`)
- O serviço `createPatient` converte `undefined` para `null` no Firestore (ternário `|| null`)
- O código gerado automaticamente usa `Date.now()` — colisão é improvável mas teoricamente possível em chamadas simultâneas
- `router.back()` é usado tanto no "Voltar" quanto no "Cancelar" — volta para a página anterior no histórico, que pode não ser `/clinic/patients`

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
| `PAC` | Prefixo do código auto-gerado de paciente (PAC + 8 dígitos) |
| `createPatient` | Função do `patientService` que cria paciente no Firestore |
| `formatPhone` | Função local que aplica máscara de telefone |
| `formatCPF` | Função local que aplica máscara de CPF |
| `formatDate` | Função local que aplica máscara de data DD/MM/AAAA |
| `serverTimestamp` | Timestamp gerado pelo servidor Firestore |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/patients/new/page.tsx`
- Serviço: `src/lib/services/patientService.ts`
- Types: `src/types/patient.ts`
- Listagem de pacientes: `project_doc/clinic/patients-list-documentation.md`

---

## 20. Anexos

### Anexo A — Campos do Formulário

| Campo | Tipo | Obrigatório | Formatação | Placeholder | maxLength |
|-------|------|-------------|------------|-------------|-----------|
| `codigo` | Input | Não | Nenhuma | "Deixe em branco para gerar automaticamente" | - |
| `nome` | Input | Sim | Nenhuma | "Nome do paciente" | - |
| `telefone` | Input | Não | `formatPhone` automático | "(00) 00000-0000" | 15 |
| `email` | Input | Não | `type="email"` (validação HTML) | "email@exemplo.com" | - |
| `data_nascimento` | Input | Não | `formatDate` DD/MM/AAAA | "DD/MM/AAAA" | 10 |
| `cpf` | Input | Não | `formatCPF` 000.000.000-00 | "000.000.000-00" | 14 |
| `observacoes` | Textarea | Não | Nenhuma | "Informações adicionais sobre o paciente" | - |

### Anexo B — Layout do Formulário

- Grid de 2 colunas em telas médias+ (`md:grid-cols-2`), 1 coluna em mobile
- Linha 1: Código (opcional) + Nome Completo (obrigatório com `*`)
- Linha 2: Telefone + Email
- Linha 3: Data de Nascimento + CPF
- Linha completa: Observações (textarea com 4 rows)
- Footer: Botões "Cancelar" e "Cadastrar Paciente" separados por `border-t`
- Container: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
