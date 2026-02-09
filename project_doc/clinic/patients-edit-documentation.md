# Documentação Experimental - Edição de Paciente

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Formulário de edição dos dados cadastrais de um paciente existente. Carrega os dados atuais do paciente, permite alteração e salva as mudanças com log de auditoria automático. O campo `codigo` é exibido mas não pode ser editado. Acessível apenas para usuários com role `clinic_admin`.

- **Arquivo**: `src/app/(clinic)/clinic/patients/[id]/edit/page.tsx`
- **Rota**: `/clinic/patients/{id}/edit`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `EditPatientPage`
- **Parâmetro dinâmico**: `id` (ID do documento Firestore do paciente)
- **Dependências principais**:
  - `useAuth` (hook de autenticação com claims e user)
  - `getPatientById`, `updatePatient` (serviço `patientService`)
  - Tipo `Patient` de `@/types/patient`
  - Componentes Shadcn/ui: `Button`, `Input`, `Textarea`
  - Ícones Lucide: `ArrowLeft`, `Save`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Acessa, visualiza e edita dados do paciente |
| `clinic_user` | Bloqueado | Redirecionado automaticamente para `/clinic/patients` via `useEffect` |
| `clinic_consultant` | Bloqueado | Redirecionado automaticamente para `/clinic/patients` via `useEffect` |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

---

## 3. Estrutura de Dados

### 3.1 Documento Firestore — `tenants/{tenant_id}/patients/{patient_id}`

| Campo | Tipo | Editável | Descrição |
|-------|------|----------|-----------|
| `tenant_id` | `string` | Não | ID do tenant (isolamento multi-tenant) |
| `codigo` | `string` | Não | Código único do paciente (exibido como disabled) |
| `nome` | `string` | Sim | Nome completo do paciente |
| `telefone` | `string \| null` | Sim | Telefone formatado |
| `email` | `string \| null` | Sim | Email em lowercase |
| `data_nascimento` | `string \| null` | Sim | Data formatada DD/MM/AAAA |
| `cpf` | `string \| null` | Sim | CPF apenas dígitos (11 caracteres) |
| `observacoes` | `string \| null` | Sim | Texto livre |
| `created_by` | `string` | Não | UID do criador |
| `created_by_name` | `string` | Não | displayName do criador |
| `created_at` | `Timestamp` | Não | Data de criação |
| `updated_at` | `Timestamp` | Auto | Atualizado via serverTimestamp |

### 3.2 Log de Auditoria — `tenants/{tenant_id}/patient_edit_logs`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `patient_id` | `string` | ID do documento do paciente |
| `patient_codigo` | `string` | Código do paciente |
| `changes` | `array` | Lista de alterações `{ field, old_value, new_value }` |
| `edited_by` | `string` | UID do usuário que editou |
| `edited_by_name` | `string` | displayName do editor |
| `edited_at` | `Timestamp` | Data da edição (serverTimestamp) |

### 3.3 Estado do Componente (useState)

```typescript
const [loading, setLoading] = useState(false);         // submissão
const [loadingData, setLoadingData] = useState(true);   // carregamento inicial
const [patient, setPatient] = useState<Patient | null>(null);
const [formData, setFormData] = useState({
  nome: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  cpf: "",
  observacoes: "",
});
```

### 3.4 TypeScript — `UpdatePatientInput`

```typescript
interface UpdatePatientInput {
  nome?: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  cpf?: string;
  observacoes?: string;
}
```

---

## 4. Casos de Uso

### UC-001: Editar dados de paciente

- **Ator**: clinic_admin
- **Pré-condição**: Paciente existe no Firestore, usuário com role `clinic_admin`
- **Fluxo**:
  1. Usuário acessa `/clinic/patients/{id}/edit`
  2. `loadPatient()` carrega dados do Firestore via `getPatientById`
  3. Formulário é pré-preenchido com dados atuais
  4. Usuário altera campos desejados (máscaras aplicadas em tempo real)
  5. Clica em "Salvar Alterações"
  6. `updatePatient` compara valores antigos e novos
  7. Apenas campos alterados são atualizados no Firestore
  8. Log de auditoria criado em `patient_edit_logs` com detalhes das mudanças
  9. Alert "Paciente atualizado com sucesso!" + redirect para `/clinic/patients/{id}`
- **Pós-condição**: Dados atualizados com log de auditoria registrado

### UC-002: Visualizar código (somente leitura)

- **Ator**: clinic_admin
- **Fluxo**:
  1. Campo código é exibido com `disabled` e fundo cinza (`bg-gray-50`)
  2. Nota explicativa abaixo: "O código do paciente não pode ser alterado"
- **Pós-condição**: Código visível mas não editável

### UC-003: Cancelar edição

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário clica em "Cancelar" ou "Voltar"
  2. `router.back()` retorna à página anterior
- **Pós-condição**: Nenhuma alteração é salva

### UC-004: Bloqueio de acesso por permissão

- **Ator**: clinic_user, clinic_consultant
- **Fluxo**:
  1. `useEffect` verifica `claims.role !== "clinic_admin"`
  2. Redirect automático para `/clinic/patients`
- **Pós-condição**: Usuário não autorizado não vê o formulário

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/patients/{id}/edit│
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ É clinic_admin?├──────────► Redirect /clinic/patients
    └───────┬───────┘
            │ Sim
            ▼
┌─────────────────────────┐
│ loadPatient()            │
│ getPatientById(tenantId, │
│   patientId)             │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
  Encontrado   Não encontrado
      │           │
      │           ▼
      │     "Paciente não encontrado"
      │     + botão Voltar
      ▼
┌─────────────────────────┐
│ Pre-preenche formData    │
│ com dados do paciente    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Usuário edita campos     │
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
│ updatePatient(           │
│   tenantId, patientId,   │
│   updates, uid, name     │
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
  /patients/{id}
```

---

## 6. Regras de Negócio

### RN-001: Acesso restrito a clinic_admin

- **Descrição**: Apenas usuários com role `clinic_admin` podem editar pacientes
- **Aplicação**: `useEffect` verifica `claims.role` e redireciona se diferente de `clinic_admin`
- **Exceções**: Nenhuma
- **Justificativa**: Controle de quem pode modificar dados de pacientes

### RN-002: Código não editável

- **Descrição**: O campo `codigo` do paciente não pode ser alterado
- **Aplicação**: Input com `disabled` + `className="bg-gray-50"` + nota explicativa
- **Exceções**: Nenhuma
- **Justificativa**: O código é usado como identificador de negócio em solicitações

### RN-003: Nome obrigatório

- **Descrição**: O campo `nome` é obrigatório para salvar
- **Aplicação**: `required` (HTML) + verificação `nome.trim()` no handleSubmit
- **Exceções**: Nenhuma
- **Justificativa**: Mínimo necessário para identificar um paciente

### RN-004: Comparação campo a campo

- **Descrição**: O serviço `updatePatient` compara valores antigos e novos, atualizando apenas campos efetivamente modificados
- **Aplicação**: Loop de comparação em `updatePatient` para cada campo (nome, telefone, email, data_nascimento, cpf, observações)
- **Exceções**: Se nenhum campo mudou, `updateDoc` ainda é chamado com `updated_at`
- **Justificativa**: Granularidade no log de auditoria — registrar apenas o que mudou

### RN-005: Log de auditoria automático

- **Descrição**: Um `PatientEditLog` é criado automaticamente quando há mudanças
- **Aplicação**: `addDoc` em `patient_edit_logs` com `changes[]`, `edited_by`, `edited_by_name`, `edited_at`
- **Exceções**: Log não é criado se nenhum campo foi efetivamente alterado
- **Justificativa**: Rastreabilidade completa de alterações nos dados do paciente

### RN-006: Campos vazios como null

- **Descrição**: Campos opcionais não preenchidos são enviados como `undefined` ao serviço, que os armazena como `null`
- **Aplicação**: `formData.campo || undefined` no submit; serviço converte para `null`
- **Exceções**: Nenhuma
- **Justificativa**: Consistência no Firestore

### RN-007: Redirect após sucesso

- **Descrição**: Após atualização bem-sucedida, redireciona para a página de detalhe do paciente
- **Aplicação**: `router.push("/clinic/patients/{id}")` (não usa `router.back()`)
- **Exceções**: Nenhuma
- **Justificativa**: Usuário vê os dados atualizados na página de detalhe

### RN-008: Campos desabilitados durante salvamento

- **Descrição**: Todos os campos e botões ficam desabilitados durante o salvamento
- **Aplicação**: `disabled={loading}` em todos os inputs, textarea e botões
- **Exceções**: Nenhuma
- **Justificativa**: Prevenir submissão dupla e edição durante salvamento

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Carregando dados (`loadingData=true`) | Spinner centralizado | `animate-spin` div com `h-8 w-8 border-b-2` |
| Paciente não encontrado | Mensagem centralizada + botão Voltar | Texto "Paciente não encontrado" |
| Formulário pronto | Campos pré-preenchidos com dados atuais | Inputs preenchidos, código disabled com fundo cinza |
| Salvando (`loading=true`) | "Salvando...", campos e botões desabilitados | Todos inputs/buttons com `disabled` |
| Sucesso | Alert + redirect para detalhe | `alert()` + `router.push("/clinic/patients/{id}")` |
| Erro — nome vazio | Alert "Nome é obrigatório" | `alert()` |
| Erro — CPF inválido | Alert "CPF inválido (deve ter 11 dígitos)" | `alert()` (do serviço) |
| Erro — paciente não encontrado (serviço) | Alert "Paciente não encontrado" | `alert()` (do serviço) |
| Erro genérico | Alert "Erro ao atualizar paciente" + console.error | `alert()` |
| Erro ao carregar | Alert "Erro ao carregar dados do paciente" | `alert()` |
| Sem permissão | Redirect automático | Nenhum visual |

---

## 8. Validações

### 8.1 Validações no Frontend

| Campo | Validação | Mecanismo |
|-------|-----------|-----------|
| `nome` | Obrigatório | `required` (HTML) + `nome.trim()` no submit |
| `email` | Formato email | `type="email"` (validação nativa do browser) |
| `telefone` | Máscara de formatação | `formatPhone()` — limita a 15 caracteres |
| `cpf` | Máscara de formatação | `formatCPF()` — limita a 14 caracteres |
| `data_nascimento` | Máscara de formatação | `formatDate()` — limita a 10 caracteres |

### 8.2 Validações no Serviço (`updatePatient`)

| Validação | Condição | Mensagem de erro |
|-----------|----------|------------------|
| Paciente não encontrado | `getPatientById` retorna null | "Paciente não encontrado" |
| CPF inválido | `cpf.length !== 11` (após remover formatação) | "CPF inválido (deve ter 11 dígitos)" |

### 8.3 Funções de Formatação (locais — duplicadas de patients-new)

#### `formatPhone(value: string): string`
- Remove caracteres não numéricos
- Aplica máscara `(XX) XXXX-XXXX` para fixo (≤ 10 dígitos) ou `(XX) XXXXX-XXXX` para celular
- Limita a 15 caracteres

#### `formatCPF(value: string): string`
- Remove caracteres não numéricos
- Aplica máscara `XXX.XXX.XXX-XX`
- Limita a 14 caracteres

#### `formatDate(value: string): string`
- Remove caracteres não numéricos
- Aplica máscara `DD/MM/AAAA`
- Limita a 10 caracteres

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims` (role, tenant_id) e `user` (uid, displayName) |
| Firestore — patients | Leitura/Escrita | `getPatientById` (leitura) + `updatePatient` (escrita) |
| Firestore — patient_edit_logs | Escrita | Log de auditoria criado automaticamente pelo serviço |
| Next.js Router | Navegação | `useRouter()` + `useParams()` para rota dinâmica |
| `patientService` | Serviço | `getPatientById()` e `updatePatient()` |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Autorização (frontend) | `useEffect` redireciona se `claims.role !== "clinic_admin"` |
| Autorização (Firestore) | Regras RLS garantem `request.auth.token.tenant_id == tenantId` |
| Multi-tenant | `claims.tenant_id` isola dados por tenant |
| Auditoria | Log de edição em `patient_edit_logs` com detalhes campo a campo |
| Sanitização | Campos passam por `.trim()` no serviço; email convertido para lowercase |
| Prevenção de duplo-submit | Campos e botões desabilitados durante `loading` |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Carregamento único | `getPatientById` chamado uma vez no mount |
| Atualização seletiva | Apenas campos alterados são escritos no Firestore |
| Dois estados de loading | `loadingData` (carregamento) e `loading` (salvamento) independentes |
| Sem re-fetch | Após salvar, redireciona para detalhe (que faz seu próprio fetch) |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Labels nos campos | Parcial | Labels com `<label>` mas sem `htmlFor`/`id` |
| Campo obrigatório | Sim | Asterisco visual `*` + atributo `required` |
| Campo desabilitado | Sim | Código com `disabled` + nota explicativa textual |
| Feedback de erro | Limitado | Apenas `alert()` nativo |
| Estado de loading | Parcial | Texto muda para "Salvando..." mas sem aria-busy |
| Navegação por teclado | Sim | Form nativo com `onSubmit` |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Carregar dados existentes | E2E | Verificar pré-preenchimento dos campos |
| Editar nome e salvar | E2E | Verificar atualização no Firestore e log de auditoria |
| Nome vazio | Unitário | Verificar alert "Nome é obrigatório" |
| CPF inválido | Integração | Verificar erro "CPF inválido (deve ter 11 dígitos)" |
| Paciente não encontrado | E2E | Verificar tela de erro |
| Código não editável | E2E | Verificar que input código está disabled |
| Log de auditoria | Integração | Verificar que `patient_edit_logs` registra campos alterados |
| Sem alterações | Integração | Verificar que log não é criado se nada mudou |
| Acesso sem permissão | E2E | Acessar como clinic_user e verificar redirect |
| Cancelar edição | E2E | Clicar cancelar e verificar que nada foi salvo |
| Campos desabilitados durante loading | E2E | Verificar disabled em todos inputs durante salvamento |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Toast notifications | Alta | Substituir `alert()` nativo por toast (Shadcn/ui) |
| Funções de formatação compartilhadas | Alta | Extrair `formatPhone`, `formatCPF`, `formatDate` para módulo reutilizável (duplicadas de patients-new) |
| Validação de CPF | Média | Implementar validação de dígitos verificadores |
| Validação de data | Média | Verificar se data de nascimento é válida e no passado |
| Labels acessíveis | Média | Vincular `<label>` aos inputs via `htmlFor`/`id` |
| Confirmação de saída | Baixa | Avisar ao sair se houver alterações não salvas |
| Diff visual | Baixa | Mostrar visualmente quais campos foram alterados |

---

## 15. Dependências e Relacionamentos

```
patients-edit (este doc)
├── useAuth (hook) — autenticação e claims
├── patientService
│   ├── getPatientById — carrega dados do paciente
│   └── updatePatient — atualiza dados + cria log de auditoria
│       └── patient_edit_logs (coleção Firestore)
├── types/patient.ts — Patient, UpdatePatientInput
├── patients-detail — origem da navegação + destino após salvar
└── patients-list — destino do redirect de permissão
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| `/clinic/patients/{id}` | Detalhe — origem da navegação e destino após salvar |
| `/clinic/patients` | Listagem — destino do redirect de permissão |
| `/clinic/patients/new` | Cadastro — compartilha funções de formatação (duplicadas) |

---

## 16. Observações Técnicas

- As funções de formatação (`formatPhone`, `formatCPF`, `formatDate`) são idênticas às usadas na página de criação (`patients/new/page.tsx`). Não há reutilização via módulo compartilhado.
- O campo `codigo` é exibido com `disabled` e `className="bg-gray-50"`, acompanhado de nota: "O código do paciente não pode ser alterado".
- O sistema de log de auditoria compara campo a campo os valores antigos e novos, registrando apenas os campos que foram efetivamente modificados.
- O formulário carrega dados do Firestore ao montar o componente, preenchendo o estado `formData` com os valores atuais.
- O feedback ao usuário é feito exclusivamente via `alert()` nativo do browser.
- Diferente da página de criação, aqui existem dois estados de loading independentes: `loadingData` (carregamento inicial) e `loading` (submissão do formulário).
- O email é convertido para lowercase no serviço (`updatePatient`) antes de salvar.
- O campo `codigo` ocupa 2 colunas no grid (`md:col-span-2`), assim como o campo `nome`.
- Campos nulos do Firestore são convertidos para string vazia ao preencher o formulário (`data.campo || ""`).

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
| `patientId` | ID do documento Firestore do paciente (parâmetro da URL) |
| `updatePatient` | Função do `patientService` que atualiza e cria log de auditoria |
| `PatientEditLog` | Tipo que representa o log de auditoria de edição |
| `changes` | Array de objetos `{ field, old_value, new_value }` no log |
| `loadingData` | Estado de carregamento inicial dos dados |
| `loading` | Estado de submissão do formulário |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/patients/[id]/edit/page.tsx`
- Serviço: `src/lib/services/patientService.ts`
- Types: `src/types/patient.ts`
- Detalhe do paciente: `project_doc/clinic/patients-detail-documentation.md`
- Cadastro de paciente: `project_doc/clinic/patients-new-documentation.md`

---

## 20. Anexos

### Anexo A — Campos do Formulário

| Campo | Tipo | Obrigatório | Editável | Formatação | Placeholder | maxLength |
|-------|------|-------------|----------|------------|-------------|-----------|
| `codigo` | Input | - | Não | - | (valor atual) | - |
| `nome` | Input | Sim | Sim | Nenhuma | "Nome do paciente" | - |
| `telefone` | Input | Não | Sim | `formatPhone` | "(00) 00000-0000" | 15 |
| `email` | Input | Não | Sim | `type="email"` | "email@exemplo.com" | - |
| `data_nascimento` | Input | Não | Sim | `formatDate` | "DD/MM/AAAA" | 10 |
| `cpf` | Input | Não | Sim | `formatCPF` | "000.000.000-00" | 14 |
| `observacoes` | Textarea | Não | Sim | Nenhuma | "Informações adicionais..." | - |

### Anexo B — Layout do Formulário

- Campo `codigo` ocupa 2 colunas (`md:col-span-2`), disabled com fundo cinza + nota
- Campo `nome` ocupa 2 colunas (`md:col-span-2`)
- Telefone e Email lado a lado em 2 colunas
- Data de Nascimento e CPF lado a lado em 2 colunas
- Observações em linha completa (textarea com 4 rows)
- Footer: Botões "Cancelar" e "Salvar Alterações" (com ícone Save) separados por `border-t`
- Container: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
