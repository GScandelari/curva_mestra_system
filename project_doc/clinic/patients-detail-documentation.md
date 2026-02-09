# Documentação Experimental - Detalhe do Paciente

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página de visualização completa de um paciente individual. Exibe dados cadastrais, estatísticas de procedimentos (total e valor gasto), ações rápidas e histórico completo de procedimentos com detalhamento de produtos utilizados.

- **Arquivo**: `src/app/(clinic)/clinic/patients/[id]/page.tsx`
- **Rota**: `/clinic/patients/{id}`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `PatientDetailPage`
- **Parâmetro dinâmico**: `id` (ID do documento Firestore do paciente)
- **Dependências principais**:
  - `useAuth` (hook de autenticação com claims multi-tenant)
  - `getPatientById`, `getPatientHistory`, `deletePatient` (serviço `patientService`)
  - `formatCurrency` (serviço `reportService`)
  - Componentes Shadcn/ui: `Button`
  - Ícones Lucide: `ArrowLeft`, `Edit`, `Trash2`, `Calendar`, `FileText`, `List`, `Plus`
  - Tipo `Patient` de `@/types/patient`
  - `Timestamp` do Firebase Firestore

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Visualizar, editar, deletar paciente e criar procedimentos |
| `clinic_user` | Leitura | Visualizar dados e histórico (botões editar/deletar visíveis mas sem restrição frontend — depende do serviço/Firestore) |
| `clinic_consultant` | N/A | Não acessa rotas de pacientes |
| `system_admin` | N/A | Não acessa rotas do módulo clínica |

---

## 3. Estrutura de Dados

### 3.1 Documento Firestore — `tenants/{tenant_id}/patients/{patient_id}`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | `string` | ID do tenant (isolamento multi-tenant) |
| `codigo` | `string` | Código único do paciente |
| `nome` | `string` | Nome completo |
| `telefone` | `string \| null` | Telefone formatado |
| `email` | `string \| null` | Email em lowercase |
| `data_nascimento` | `string \| null` | Data formatada DD/MM/AAAA |
| `cpf` | `string \| null` | CPF apenas dígitos |
| `observacoes` | `string \| null` | Texto livre |
| `created_by` | `string` | UID do criador |
| `created_by_name` | `string` | displayName do criador |
| `created_at` | `Timestamp` | Data de criação |
| `updated_at` | `Timestamp` | Data de atualização |

### 3.2 Coleção relacionada — `tenants/{tenant_id}/solicitacoes`

O histórico de procedimentos é buscado na coleção `solicitacoes` usando `where("paciente_codigo", "==", patient.codigo)` ordenado por `dt_procedimento desc`.

Cada solicitação contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `paciente_codigo` | `string` | Código do paciente (vinculação) |
| `dt_procedimento` | `Timestamp` | Data do procedimento |
| `status` | `string` | Status da solicitação |
| `produtos_solicitados` | `array` | Lista de produtos com nome, lote, quantidade, valor_unitario |
| `observacoes` | `string` | Observações do procedimento |

### 3.3 Estado do Componente (useState)

```typescript
const [patient, setPatient] = useState<Patient | null>(null);
const [history, setHistory] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [actionLoading, setActionLoading] = useState(false);
```

---

## 4. Casos de Uso

### UC-001: Visualizar dados do paciente

- **Ator**: clinic_admin, clinic_user
- **Pré-condição**: Paciente existe no Firestore
- **Fluxo**:
  1. Usuário acessa `/clinic/patients/{id}`
  2. `useEffect` dispara `loadData()` quando `tenantId` e `patientId` estão disponíveis
  3. `Promise.all` carrega dados do paciente e histórico em paralelo
  4. Exibe dados cadastrais no card "Dados do Paciente" (campos opcionais exibidos condicionalmente)
- **Pós-condição**: Dados do paciente exibidos

### UC-002: Visualizar estatísticas de procedimentos

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Após carregamento, estatísticas são calculadas a partir do histórico
  2. Total de procedimentos: `history.length`
  3. Valor total gasto: soma de `quantidade * valor_unitario` de todos os `produtos_solicitados`
  4. Último procedimento: data do primeiro item do histórico (ordenado desc)
- **Pós-condição**: Cards de estatísticas exibidos (azul e verde)

### UC-003: Scroll para histórico de procedimentos

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário clica em "Listar Procedimentos (N)" na seção de ações rápidas
  2. `document.getElementById("historico-procedimentos")` localiza a seção
  3. `scrollIntoView({ behavior: "smooth" })` faz scroll suave
- **Pós-condição**: Viewport posicionada na seção de histórico

### UC-004: Criar novo procedimento pré-preenchido

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário clica em "Novo Procedimento" na seção de ações rápidas
  2. Navega para `/clinic/requests/new?patientCode={codigo}&patientName={nome}`
  3. Dados do paciente são pré-preenchidos no formulário de solicitação
- **Pós-condição**: Formulário de nova solicitação aberto com paciente selecionado

### UC-005: Editar dados do paciente

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário clica em "Editar Dados" no cabeçalho
  2. `router.push("/clinic/patients/{id}/edit")`
  3. Navega para página de edição
- **Pós-condição**: Página de edição carregada

### UC-006: Deletar paciente

- **Ator**: clinic_admin
- **Fluxo**:
  1. Usuário clica em "Deletar" no cabeçalho
  2. `confirm("Tem certeza que deseja deletar este paciente?")` exibe diálogo nativo
  3. Se confirmado: `deletePatient(tenantId, patientId)` é chamado
  4. Serviço verifica se há solicitações vinculadas ao código do paciente
  5. Se não houver: paciente deletado + alert "Paciente deletado com sucesso!" + redirect
  6. Se houver: alert "Não é possível deletar: paciente possui procedimentos registrados"
- **Exceção**: Se cancelar o confirm, nada acontece
- **Pós-condição**: Paciente removido e redirecionado, ou erro exibido

### UC-007: Voltar para página anterior

- **Ator**: clinic_admin, clinic_user
- **Fluxo**:
  1. Usuário clica em "Voltar"
  2. `router.back()` retorna à página anterior no histórico
- **Pós-condição**: Navegação para página anterior

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/patients/{id}    │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐     Não
    │ tenantId e id  ├──────────► Aguarda (loading)
    │ disponíveis?   │
    └───────┬───────┘
            │ Sim
            ▼
┌─────────────────────────┐
│ Promise.all:             │
│  1. getPatientById()     │
│  2. getPatientHistory()  │
│     (com id — falha      │
│      silenciosa)         │
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
│ getPatientHistory()      │
│ (com patient.codigo)     │
│ — busca correta          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Exibe:                   │
│  - Cabeçalho + ações     │
│  - Ações rápidas (2 btn) │
│  - Dados do paciente     │
│  - Estatísticas          │
│  - Histórico             │
└─────────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Carregamento condicional

- **Descrição**: Dados são carregados apenas quando `tenantId` e `patientId` estão disponíveis
- **Aplicação**: `useEffect` com dependências `[tenantId, patientId]`
- **Exceções**: Se `tenantId` for null, `loadData` retorna sem executar
- **Justificativa**: Evitar chamadas ao Firestore sem contexto de autenticação

### RN-002: Histórico via código do paciente

- **Descrição**: O histórico de procedimentos é buscado usando `patient.codigo` (não o document ID)
- **Aplicação**: `getPatientHistory(tenantId, patient.codigo)` após carregar o paciente
- **Exceções**: A primeira chamada com `patientId` falha silenciosamente (`.catch(() => [])`)
- **Justificativa**: A coleção `solicitacoes` usa `paciente_codigo` como campo de vinculação

### RN-003: Cálculo de valor total gasto

- **Descrição**: O valor total é a soma de `quantidade * valor_unitario` de todos os `produtos_solicitados` de todos os procedimentos
- **Aplicação**: `calculateTotalValue()` para cada procedimento, `reduce` para soma total
- **Exceções**: Se `produtos_solicitados` não existir, retorna 0
- **Justificativa**: Métrica financeira por paciente

### RN-004: Exclusão protegida por solicitações

- **Descrição**: Um paciente só pode ser deletado se não possuir solicitações vinculadas
- **Aplicação**: `deletePatient` no serviço verifica com `where("paciente_codigo", "==", patient.codigo)` com `limit(1)`
- **Exceções**: Nenhuma
- **Justificativa**: Preservar integridade referencial do histórico de procedimentos

### RN-005: Confirmação de exclusão

- **Descrição**: A exclusão requer confirmação via `confirm()` nativo do browser
- **Aplicação**: `if (!confirm(...)) return` antes de chamar o serviço
- **Exceções**: Nenhuma
- **Justificativa**: Prevenir exclusão acidental

### RN-006: Pré-preenchimento de novo procedimento

- **Descrição**: Ao criar novo procedimento, `patientCode` e `patientName` são passados como query params
- **Aplicação**: `URLSearchParams` com `patientCode` e `patientName` na URL
- **Exceções**: Nenhuma
- **Justificativa**: UX — evitar que o usuário precise buscar o paciente novamente

### RN-007: Exibição condicional de campos

- **Descrição**: Campos opcionais (telefone, email, data_nascimento, cpf, observações) só são exibidos se preenchidos
- **Aplicação**: Renderização condicional com `{patient.campo && (...)}`
- **Exceções**: Nome e data de cadastro são sempre exibidos
- **Justificativa**: Interface limpa sem campos vazios

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Carregando (`loading=true`) | Spinner centralizado | `animate-spin` div com `h-8 w-8 border-b-2` |
| Paciente não encontrado | Mensagem centralizada + botão Voltar | Texto "Paciente não encontrado" |
| Dados carregados | Exibe todas as seções | Cabeçalho, ações rápidas, dados, estatísticas, histórico |
| Sem procedimentos | Mensagem na seção de histórico | "Nenhum procedimento realizado" |
| Ação em andamento (`actionLoading=true`) | Botões Editar e Deletar desabilitados | `disabled` nos botões |
| Exclusão com sucesso | Alert + redirect | `alert()` + `router.push("/clinic/patients")` |
| Exclusão com erro | Alert com mensagem | `alert(result.error)` |
| Exclusão negada (confirm) | Nada acontece | `confirm()` retorna false |

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| `tenantId` ausente | `claims?.tenant_id` é null | `loadData` retorna sem executar |
| Paciente não encontrado | `getPatientById` retorna null | Tela de "Paciente não encontrado" |
| Erro no histórico | Exceção em `getPatientHistory` | `.catch(() => [])` — retorna array vazio silenciosamente |
| Confirmação de exclusão | `confirm()` retorna false | Operação cancelada |

### 8.2 Validações no Serviço (`deletePatient`)

| Validação | Condição | Mensagem de erro |
|-----------|----------|------------------|
| Paciente não encontrado | `getPatientById` retorna null | "Paciente não encontrado" |
| Paciente com procedimentos | Query `solicitacoes` retorna resultados | "Não é possível deletar: paciente possui procedimentos registrados" |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` fornece `claims.tenant_id` |
| Firestore — patients | Leitura/Exclusão | `getPatientById`, `deletePatient` |
| Firestore — solicitacoes | Leitura | `getPatientHistory` para histórico de procedimentos |
| `reportService` | Formatação | `formatCurrency` para exibir valores monetários |
| Next.js Router | Navegação | `useRouter()` + `useParams()` para rota dinâmica |
| Página de solicitações | Navegação | Link para `/clinic/requests/new` com query params |
| Página de edição | Navegação | Link para `/clinic/patients/{id}/edit` |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Multi-tenant | `claims.tenant_id` isola dados por tenant |
| Autorização (exclusão) | Sem verificação de role no frontend — depende do Firestore |
| Proteção de exclusão | Serviço impede exclusão se há solicitações vinculadas |
| Firestore RLS | Regras garantem `request.auth.token.tenant_id == tenantId` |
| Confirmação destrutiva | `confirm()` nativo antes de deletar |

### Observação de segurança

O botão de exclusão não verifica `claims.role` no frontend. Qualquer usuário autenticado no tenant pode ver e clicar no botão. A proteção real depende das regras do Firestore e do serviço `deletePatient`.

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| Carregamento paralelo | `Promise.all` para paciente + histórico (primeira chamada) |
| Chamada redundante | `getPatientHistory(tenantId, patientId)` é chamado com ID (falha silenciosa) e depois com `patient.codigo` (chamada correta) — **chamada desnecessária ao Firestore** |
| Cálculo inline | `calculateTotalValue` e `totalGasto` calculados a cada render |
| Sem paginação de histórico | Todos os procedimentos são carregados de uma vez |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Spinner de loading | Parcial | Elemento visual sem `aria-label` ou `role="status"` |
| Botões com ícones | Parcial | Ícones + texto — acessível por leitura |
| Scroll suave | Sim | `scrollIntoView({ behavior: "smooth" })` |
| Cores de status | Limitado | Estatísticas usam cores (azul/verde) sem indicador textual |
| Confirm nativo | Sim | Acessível por padrão do browser |
| Feedback de erro | Limitado | Apenas `alert()` nativo |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Carregar paciente existente | E2E | Verificar exibição de todos os dados e estatísticas |
| Paciente não encontrado | E2E | Verificar tela de erro e botão voltar |
| Campos opcionais vazios | E2E | Verificar que campos null não são exibidos |
| Histórico com procedimentos | E2E | Verificar listagem com produtos e valores |
| Histórico vazio | E2E | Verificar mensagem "Nenhum procedimento realizado" |
| Cálculo de valor total | Unitário | Verificar soma de `quantidade * valor_unitario` |
| Scroll para histórico | E2E | Clicar "Listar Procedimentos" e verificar scroll |
| Novo procedimento | E2E | Verificar que query params são passados corretamente |
| Deletar paciente sem procedimentos | E2E | Verificar exclusão e redirect |
| Deletar paciente com procedimentos | E2E | Verificar mensagem de erro |
| Cancelar exclusão | E2E | Verificar que confirm(false) não executa ação |
| Estado de loading | E2E | Verificar spinner durante carregamento |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Remover chamada redundante | Alta | Eliminar `getPatientHistory(tenantId, patientId)` — usar apenas `patient.codigo` |
| Toast notifications | Alta | Substituir `alert()` e `confirm()` por toast/dialog (Shadcn/ui) |
| Verificação de role para exclusão | Alta | Esconder botão "Deletar" para `clinic_user` |
| Paginação de histórico | Média | Implementar paginação para pacientes com muitos procedimentos |
| Memoização de cálculos | Baixa | `useMemo` para `totalGasto` e `totalProcedimentos` |
| Impressão de ficha | Baixa | Gerar PDF com dados do paciente |
| Edição inline | Baixa | Editar campos diretamente na página de detalhe |

---

## 15. Dependências e Relacionamentos

```
patients-detail (este doc)
├── useAuth (hook) — autenticação e claims
├── patientService
│   ├── getPatientById — carrega dados do paciente
│   ├── getPatientHistory — carrega histórico de procedimentos
│   └── deletePatient — exclusão com verificação de solicitações
├── reportService.formatCurrency — formatação de moeda
├── types/patient.ts — Patient type
├── patients-list — origem da navegação
├── patients-edit — botão "Editar Dados"
└── requests-new — botão "Novo Procedimento" (com query params)
```

### Páginas relacionadas

| Página | Relação |
|--------|---------|
| `/clinic/patients` | Listagem — origem da navegação |
| `/clinic/patients/{id}/edit` | Edição — acessível pelo botão "Editar Dados" |
| `/clinic/requests/new` | Nova solicitação — acessível pelo botão "Novo Procedimento" |

---

## 16. Observações Técnicas

- A função `loadData` faz duas chamadas para `getPatientHistory`: uma com `patientId` (que falha silenciosamente com `.catch(() => [])`) e outra com `patient.codigo` (que é o campo correto de busca). Isso resulta em uma chamada desnecessária ao Firestore.
- O cálculo de `totalGasto` usa a função local `calculateTotalValue` que soma `quantidade * valor_unitario` dos `produtos_solicitados`.
- A formatação de moeda utiliza `formatCurrency` importado do `reportService`.
- O botão de exclusão não verifica role do usuário no frontend; a proteção depende das regras do Firestore e do serviço.
- Campos opcionais do paciente (telefone, email, data de nascimento, CPF, observações) são exibidos condicionalmente — se estiverem vazios, o campo é omitido.
- A seção de histórico usa `id="historico-procedimentos"` para permitir scroll via JavaScript a partir do botão de ação rápida.
- `router.back()` é usado no botão "Voltar" — volta para a página anterior no histórico, que pode não ser `/clinic/patients`.
- A função `formatDate` local converte `Timestamp` ou `Date` para string formatada usando `toLocaleDateString("pt-BR")`.
- O tipo `history` é `any[]` — sem tipagem forte para os procedimentos.

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
| `patient.codigo` | Código de negócio do paciente (PAC + 8 dígitos ou manual) |
| `solicitacoes` | Coleção Firestore que armazena procedimentos/solicitações |
| `paciente_codigo` | Campo na solicitação que vincula ao paciente |
| `produtos_solicitados` | Array de produtos usados em cada procedimento |
| `formatCurrency` | Função do `reportService` para formatar valores monetários |
| `actionLoading` | Estado que indica ação destrutiva em andamento (desabilita botões) |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/patients/[id]/page.tsx`
- Serviço: `src/lib/services/patientService.ts`
- Report Service: `src/lib/services/reportService.ts`
- Types: `src/types/patient.ts`
- Cadastro de paciente: `project_doc/clinic/patients-new-documentation.md`
- Listagem de pacientes: `project_doc/clinic/patients-list-documentation.md`

---

## 20. Anexos

### Anexo A — Seções da Interface

| Seção | Descrição | Layout |
|-------|-----------|--------|
| Cabeçalho | Nome, código, botões Editar e Deletar | Flex com gap |
| Ações Rápidas | "Listar Procedimentos" e "Novo Procedimento" | Grid 2 colunas (`md:grid-cols-2`), botões com `h-16` |
| Dados do Paciente | Campos cadastrais exibidos condicionalmente | Card `bg-white rounded-lg shadow-sm border p-6` |
| Estatísticas | Total procedimentos (azul), Valor gasto (verde), Último procedimento | Card com `bg-blue-50` e `bg-green-50` |
| Histórico de Procedimentos | Lista de procedimentos com produtos utilizados | Cards com `border rounded-lg hover:bg-gray-50` |

### Anexo B — Estrutura do Layout

```
container py-8
└── space-y-6
    ├── Header (flex): Voltar | Nome + Código | Editar + Deletar
    ├── Ações Rápidas (grid 2col): Listar Procedimentos | Novo Procedimento
    ├── Info Cards (grid 2col):
    │   ├── Dados do Paciente (card)
    │   └── Estatísticas (card)
    └── Histórico de Procedimentos (card, id="historico-procedimentos")
```
