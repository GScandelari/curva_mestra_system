# Change Request: Remoção do Conceito de Paciente

**Projeto:** Curva Mestra
**Data:** 07/04/2026
**Autor:** Doc Writer (Claude)
**Status:** Aguardando execução
**Tipo:** Change Request
**Branch sugerida:** `feature/remove-patient-concept`
**Prioridade:** Alta
**Versão:** 1.0

> Decisão estratégica de produto: o sistema deixa de associar procedimentos a pacientes cadastrados. Os procedimentos (solicitações) passam a existir de forma independente, registrando apenas quais produtos foram consumidos, em qual data e com um campo de texto livre opcional chamado "Descrição". O conceito de paciente é removido integralmente do código, da UI e do Firestore.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `feature/remove-patient-concept`
**PR target:** `develop` (nunca diretamente para `master`)

```bash
git checkout develop
git pull origin develop
git checkout -b feature/remove-patient-concept
```

| Step    | Tipo       | Escopo      | Mensagem sugerida                                                          |
| ------- | ---------- | ----------- | -------------------------------------------------------------------------- |
| STEP 1  | `refactor` | `types`     | `refactor(types): remove patient types and patientService`                 |
| STEP 2  | `refactor` | `requests`  | `refactor(requests): remove patient fields from solicitacao model`         |
| STEP 3  | `refactor` | `requests`  | `refactor(requests): reduce wizard to 2 steps, remove patient selection`   |
| STEP 4  | `refactor` | `requests`  | `refactor(requests): replace patient columns with description field`       |
| STEP 5  | `refactor` | `requests`  | `refactor(requests): remove patient section from detail and edit pages`    |
| STEP 6  | `refactor` | `dashboard` | `refactor(dashboard): remove patient stats cards and references`           |
| STEP 7  | `refactor` | `reports`   | `refactor(reports): remove por_paciente dimension from consumption report` |
| STEP 8  | `refactor` | `reports`   | `refactor(reports): remove patient columns from consultant views`          |
| STEP 9  | `refactor` | `ui`        | `refactor(ui): remove patients menu item and route`                        |
| STEP 10 | `chore`    | `firebase`  | `chore(firebase): remove patient collections and obsolete indexes`         |
| STEP 11 | `docs`     | —           | `docs: remove obsolete patient documentation`                              |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Estado atual do código (verificado em 30/04/2026):**

A análise do código atual revela que a remoção do conceito de paciente já foi **parcialmente implementada**:

- `src/types/index.ts`: A interface `Solicitacao` **já não contém** os campos `paciente_codigo` ou `paciente_nome`. O campo `descricao?: string` já está presente.
- `src/lib/services/solicitacaoService.ts`: A interface `CreateSolicitacaoInput` **já aceita** `descricao?: string` e **não referencia** `paciente_codigo` ou `paciente_nome`.
- `firestore.indexes.json`: Os índices de `patient_edit_logs` e de `solicitacoes` por `paciente_codigo` **já não existem**.
- `src/lib/services/patientService.ts`: **Não existe** no código atual.
- `src/types/patient.ts`: **Não existe** no código atual.
- `src/app/(clinic)/clinic/patients/`: **Não existe** no código atual.

A busca global por `paciente|patient|Patient` no diretório `src/` retornou apenas 3 arquivos com menções residuais pontuais (não estruturais).

**Estado dos demais módulos afetados (a verificar por steps):**

- `src/app/(clinic)/clinic/requests/new/page.tsx` — wizard pode ainda referenciar etapa de paciente
- `src/app/(clinic)/clinic/requests/page.tsx` — listagem pode exibir colunas de paciente
- `src/app/(clinic)/clinic/requests/[id]/page.tsx` — detalhe pode exibir seção de paciente
- `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx` — edição pode ter campo de paciente
- `src/app/(clinic)/clinic/dashboard/page.tsx` — dashboard pode ter cards de estatísticas de paciente
- `src/lib/services/reportService.ts` — pode ter dimensão `por_paciente` (não encontrada na análise inicial)
- `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` — pode ter filtros de paciente
- `src/components/clinic/ClinicLayout.tsx` — pode ter item de menu "Pacientes"

### 1.2 Problema identificado

Apesar da remoção parcial da camada de dados (types, service, Firestore), as camadas de UI e serviços de apresentação podem ainda conter referências ao conceito de paciente, causando erros de compilação, inconsistências de UX ou referências mortas.

### 1.3 Motivação estratégica

Decisão estratégica de produto tomada em 07/04/2026: simplificar o fluxo da clínica. O cadastro e gestão de pacientes adiciona fricção sem agregar valor suficiente no MVP. Os procedimentos passam a ser identificados por um campo de texto livre opcional ("Descrição"), preservando flexibilidade sem exigir cadastro prévio.

---

## 2. Objetivos

1. Remover todas as referências residuais ao conceito de paciente da UI (telas, menus, formulários, tabelas).
2. Remover a dimensão "por paciente" dos relatórios de consumo.
3. Garantir que os procedimentos sejam identificados pelo campo `descricao?: string` já presente na interface `Solicitacao`.
4. Limpar dados de pacientes do Firestore (coleções `patients` e `patient_edit_logs`) via scripts seguros.
5. Remover documentação técnica obsoleta sobre pacientes em `project_doc/clinic/`.
6. Garantir que o sistema compile e funcione sem nenhuma referência ao conceito de paciente.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID    | Descrição                                                                                                          | Ator                             | Prioridade |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------- |
| RF-01 | O wizard de criação de procedimento deve ter no máximo 2 etapas, sem etapa de seleção de paciente                  | clinic_admin / clinic_user       | Must       |
| RF-02 | O campo "Descrição" (texto livre opcional) deve estar disponível no formulário de criação e edição de procedimento | clinic_admin / clinic_user       | Must       |
| RF-03 | A listagem de procedimentos deve exibir coluna "Descrição" no lugar das colunas de paciente                        | clinic_admin / clinic_user       | Must       |
| RF-04 | O dashboard da clínica não deve exibir cards ou estatísticas relacionadas a pacientes                              | clinic_admin / clinic_user       | Must       |
| RF-05 | O menu lateral da clínica não deve exibir o item "Pacientes"                                                       | clinic_admin / clinic_user       | Must       |
| RF-06 | A URL `/clinic/patients` deve retornar 404                                                                         | clinic_admin / clinic_user       | Must       |
| RF-07 | O consultor não deve ver filtros ou colunas de paciente nas telas de procedimentos e relatórios                    | clinic_consultant                | Must       |
| RF-08 | Os relatórios de consumo não devem incluir agrupamento ou seção "por paciente"                                     | clinic_admin / clinic_consultant | Must       |

### 3.2 Requisitos Não Funcionais (RNF)

| ID     | Descrição                                                                                                    | Categoria          |
| ------ | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| RNF-01 | Nenhum import de `patientService` ou `patient.ts` deve permanecer no projeto após a execução                 | Manutenibilidade   |
| RNF-02 | Os scripts de limpeza do Firestore devem ser testados em um tenant de dev antes de serem executados em todos | Segurança de dados |
| RNF-03 | O campo `observacoes` dos procedimentos deve ser preservado e permanecer funcional                           | Compatibilidade    |

### 3.3 Regras de Negócio (RN)

| ID    | Regra                                                                                                | Justificativa                                         |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| RN-01 | O campo `descricao` é opcional no procedimento — procedimentos sem descrição são válidos             | Não aumentar fricção na criação                       |
| RN-02 | Não adicionar redirecionamento de `/clinic/patients` para outra rota — 404 é o comportamento correto | Evitar rotas mortas no sistema                        |
| RN-03 | O campo `observacoes` dos procedimentos não deve ser removido                                        | Campo independente do conceito de paciente            |
| RN-04 | Os scripts de limpeza do Firestore não devem ser executados sem revisão prévia do conteúdo           | Projeto em fase de desenvolvimento com dados de teste |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Substituir o campo obrigatório de paciente por um campo de texto livre opcional chamado **"Descrição"** no procedimento. Essa decisão já está refletida na interface `Solicitacao` em `src/types/index.ts` (`descricao?: string`) e no `CreateSolicitacaoInput` em `solicitacaoService.ts`.

**Modelo de procedimento — antes:**

```
- Paciente (obrigatório, autocomplete vinculado a cadastro)
- Data do procedimento (obrigatório)
- Observações (opcional)
- Produtos consumidos (obrigatório)
```

**Modelo de procedimento — depois:**

```
- Descrição / Identificação (opcional, texto livre — ex: "Procedimento facial Dra. Ana")
- Data do procedimento (obrigatório)
- Observações (opcional)
- Produtos consumidos (obrigatório)
```

### 4.2 Alternativas descartadas

| Alternativa                                           | Motivo da rejeição                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Manter paciente como campo opcional (não obrigatório) | Manteria complexidade de código, cadastro prévio e coleções no Firestore sem valor real no MVP |
| Agrupar relatórios por `descricao` em vez de paciente | Aceito como consequência — a descrição é texto livre, sem valor analítico garantido            |
| Redirecionar `/clinic/patients` para o dashboard      | Cria rotas mortas e confusão; 404 é mais honesto                                               |

### 4.3 Trade-offs aceitos

- Relatórios perdem a dimensão de rastreabilidade por paciente — aceito como decisão estratégica deliberada.
- O consultor perde rastreabilidade por paciente nas visões de procedimentos — aceito.
- O campo `descricao` é texto livre sem validação de formato — simplicidade priorizada.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo                           | Tipo           | Propósito                                                                                     |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `scripts/cleanup-patients.js`     | Script Node.js | Deletar coleções `patients` e `patient_edit_logs` de todos os tenants                         |
| `scripts/cleanup-solicitacoes.js` | Script Node.js | Remover campos `paciente_codigo` e `paciente_nome` de documentos existentes em `solicitacoes` |

### 5.2 Arquivos a MODIFICAR

| Arquivo                                                                  | Natureza da mudança                                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/index.ts`                                                     | Remover exportação de `Patient` e tipos relacionados (se ainda existirem)                                                                                 |
| `src/components/clinic/ClinicLayout.tsx`                                 | Remover item de menu "Pacientes" → `/clinic/patients`                                                                                                     |
| `src/app/(clinic)/clinic/dashboard/page.tsx`                             | Remover cards de estatísticas de pacientes e chamadas a `getPatientsStats`; substituir `paciente_nome` por `descricao` na seção de procedimentos próximos |
| `src/app/(clinic)/clinic/requests/new/page.tsx`                          | Remover Step 1 de seleção de paciente; wizard passa de 3 para 2 etapas; adicionar campo "Descrição"                                                       |
| `src/app/(clinic)/clinic/requests/page.tsx`                              | Remover colunas `paciente_nome` e `paciente_codigo`; adicionar coluna "Descrição"; ajustar busca textual                                                  |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx`                         | Remover seção "Informações do Paciente"; exibir campo "Descrição"                                                                                         |
| `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`                    | Remover campo/seleção de paciente; adicionar campo "Descrição" editável                                                                                   |
| `src/lib/services/solicitacaoService.ts`                                 | Verificar e remover quaisquer referências residuais a `paciente_codigo`/`paciente_nome`                                                                   |
| `src/lib/services/reportService.ts`                                      | Verificar e remover campo `por_paciente` da interface `ConsumptionReport` e função `generateConsumptionReport()` se existirem                             |
| `src/app/(clinic)/clinic/reports/page.tsx`                               | Remover tabela/seção "Consumo por Paciente" se existir                                                                                                    |
| `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` | Remover filtros e colunas de `paciente_nome`/`paciente_codigo`; adicionar coluna "Descrição"                                                              |
| `src/app/(consultant)/consultant/clinics/[tenantId]/reports/page.tsx`    | Remover seção "por paciente" do relatório de consumo                                                                                                      |
| `firestore.indexes.json`                                                 | Verificar e remover índices obsoletos de `patient_edit_logs` e `solicitacoes` por `paciente_codigo` (análise atual indica que já foram removidos)         |

### 5.3 Arquivos a REMOVER

| Arquivo                                               | Motivo                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/(clinic)/clinic/patients/page.tsx`           | Página de listagem de pacientes — a ser removida se existir |
| `src/app/(clinic)/clinic/patients/new/page.tsx`       | Formulário de criação — a ser removido se existir           |
| `src/app/(clinic)/clinic/patients/[id]/page.tsx`      | Página de detalhes — a ser removida se existir              |
| `src/app/(clinic)/clinic/patients/[id]/edit/page.tsx` | Formulário de edição — a ser removido se existir            |
| `project_doc/clinic/patients-list-documentation.md`   | Documentação obsoleta                                       |
| `project_doc/clinic/patients-new-documentation.md`    | Documentação obsoleta                                       |
| `project_doc/clinic/patients-detail-documentation.md` | Documentação obsoleta                                       |
| `project_doc/clinic/patients-edit-documentation.md`   | Documentação obsoleta                                       |

> **Nota:** A análise do código atual indica que `src/types/patient.ts`, `src/lib/services/patientService.ts` e `src/app/(clinic)/clinic/patients/` já foram removidos. Os steps de remoção devem verificar a existência antes de agir.

### 5.4 Impacto no Firestore

| Coleção                                | Ação                        | Detalhes                                                                                                   |
| -------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `tenants/{tenantId}/patients`          | Deletar todos os documentos | Executado via `scripts/cleanup-patients.js`                                                                |
| `tenants/{tenantId}/patient_edit_logs` | Deletar todos os documentos | Executado via `scripts/cleanup-patients.js`                                                                |
| `tenants/{tenantId}/solicitacoes`      | Limpar campos obsoletos     | Remover `paciente_codigo` e `paciente_nome` de documentos existentes via `scripts/cleanup-solicitacoes.js` |

> O projeto está em fase de desenvolvimento e os dados existentes não possuem valor real. A limpeza completa é segura.

### 5.5 O que NÃO muda

- `src/lib/services/solicitacaoService.ts` — a interface e funções principais já não referenciam paciente; apenas remover eventuais resíduos
- `src/lib/services/inventoryService.ts` — nenhuma relação com o conceito de paciente
- `src/lib/services/reportService.ts` — `StockValueReport` e `ExpirationReport` não envolvem paciente; apenas `ConsumptionReport` pode ter o campo `por_paciente`
- `firestore.indexes.json` — análise indica que os índices de paciente já foram removidos; verificar e confirmar
- Todo o módulo de inventário (`/clinic/inventory/`) — nenhuma relação com paciente
- Todo o módulo Admin — nenhuma relação com paciente
- Regras Firestore (`firestore.rules`) — nenhuma alteração

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

**Estado atual confirmado de `src/types/index.ts`:**

```typescript
// Interface Solicitacao — JÁ SEM campos de paciente
export interface Solicitacao {
  id: string;
  tenant_id: string;
  descricao?: string; // Campo já presente — identifica o procedimento (texto livre)
  dt_procedimento: Timestamp;
  produtos_solicitados: ProdutoSolicitado[];
  status: SolicitacaoStatus;
  status_history?: StatusHistoryEntry[];
  observacoes?: string;
  created_by: string;
  created_by_name?: string;
  updated_by?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

Nenhuma mudança de tipo necessária para `Solicitacao` — a camada de dados já está atualizada.

**Estado atual confirmado de `src/lib/services/solicitacaoService.ts`:**

```typescript
// CreateSolicitacaoInput — JÁ SEM campos de paciente
export interface CreateSolicitacaoInput {
  descricao?: string;
  dt_procedimento: Date;
  produtos: {
    inventory_item_id: string;
    quantidade: number;
  }[];
  observacoes?: string;
}
```

### 6.2 Mudanças em serviços

**`reportService.ts` — verificar se existe `por_paciente` em `ConsumptionReport`:**

Estado atual analisado da interface `ConsumptionReport`:

```typescript
export interface ConsumptionReport {
  periodo: { inicio: Date; fim: Date; };
  total_procedimentos: number;
  total_produtos_consumidos: number;
  valor_total_consumido: number;
  por_produto: { ... }[];
  gerado_em: Date;
}
```

O campo `por_paciente` **não está presente** na interface atual. Nenhuma alteração necessária em `reportService.ts`.

### 6.3 Mudanças na UI

**Wizard de criação de procedimento (`/clinic/requests/new`):**

| Etapa             | Antes                              | Depois                                          |
| ----------------- | ---------------------------------- | ----------------------------------------------- |
| Step 1            | Seleção de paciente (autocomplete) | Eliminada                                       |
| Step 2 (→ Step 1) | Adicionar produtos                 | Adicionar produtos + campo "Descrição" opcional |
| Step 3 (→ Step 2) | Revisão (com resumo do paciente)   | Revisão (com campo Descrição se preenchido)     |

**Listagem de procedimentos (`/clinic/requests`):**

| Coluna             | Antes                                 | Depois                          |
| ------------------ | ------------------------------------- | ------------------------------- |
| Paciente           | Presente                              | Removida                        |
| Código do paciente | Presente                              | Removida                        |
| Descrição          | Ausente                               | Adicionada (exibe "—" se vazio) |
| Busca textual      | Por `paciente_nome`/`paciente_codigo` | Por `descricao`                 |

**Dashboard da clínica (`/clinic/dashboard`):**

- Remover cards "Total de Pacientes" e "Novos este Mês" (se existirem)
- Na seção "Procedimentos Próximos": substituir `paciente_nome`/`paciente_codigo` por `descricao` ou "Procedimento sem descrição"

### 6.4 Mudanças em API Routes

Não há API Routes relacionadas a pacientes — as operações ocorriam diretamente via Firestore pelo `patientService` (já removido). Nenhuma alteração em API Routes.

---

## 7. Plano de Implementação

### STEP 1 — Verificar e remover tipos e serviço de pacientes

**Objetivo:** Confirmar que a camada de tipos e serviço já foi removida; eliminar eventuais resíduos.

**Arquivos afetados:**

- `src/types/patient.ts` — deletar se existir
- `src/types/index.ts` — remover exportações de tipos de paciente se existirem
- `src/lib/services/patientService.ts` — deletar se existir

**Ações:**

1. Verificar existência de `src/types/patient.ts` — deletar se presente
2. Verificar existência de `src/lib/services/patientService.ts` — deletar se presente
3. Verificar `src/types/index.ts` — remover exportações de `Patient`, `PatientWithStats`, `CreatePatientInput`, `UpdatePatientInput`, `PatientEditLog` se existirem
4. Executar `npm run type-check` — erros esperados apenas nos arquivos que ainda importam esses tipos

**Validação:** `src/types/patient.ts` e `src/lib/services/patientService.ts` não existem. `src/types/index.ts` não exporta nenhum tipo de paciente.

**Commit:** `refactor(types): remove patient types and patientService`

---

### STEP 2 — Verificar e limpar `solicitacaoService.ts`

**Objetivo:** Garantir que o serviço de solicitações não possui referências residuais a paciente.

**Arquivos afetados:**

- `src/lib/services/solicitacaoService.ts`

**Ações:**

1. Buscar por `paciente_codigo`, `paciente_nome`, `patientService`, `Patient` no arquivo
2. Remover quaisquer referências encontradas
3. Verificar função `listSolicitacoes()`: garantir que não há filtro por `paciente_codigo`
4. Verificar função `getUpcomingProcedures()`: garantir que o retorno não inclui campos de paciente

**Validação:** `solicitacaoService.ts` não importa nada de `patientService` ou `patient.ts`. `npm run type-check` passa para este arquivo.

**Commit:** `refactor(requests): remove patient fields from solicitacao model`

---

### STEP 3 — Adaptar o wizard de criação de procedimento

**Objetivo:** Remover o Step de seleção de paciente e reduzir o wizard para 2 etapas.

**Arquivos afetados:**

- `src/app/(clinic)/clinic/requests/new/page.tsx`

**Ações:**

1. Remover imports de `patientService` e tipo `Patient` se existirem
2. Remover estados relacionados a paciente: `selectedPatient`, `patientSearch`, `patientResults`, `patientLoading`, etc.
3. Remover o Step de seleção de paciente (autocomplete, card de paciente selecionado)
4. Renumerar steps remanescentes: Step "Adicionar Produtos" → Step 1; Step "Revisão" → Step 2
5. Adicionar campo de texto opcional **"Descrição"** no Step 1 (placeholder: "Ex: Procedimento facial - sala 2")
6. Atualizar a seção de revisão (Step 2): exibir "Descrição" se preenchida; remover resumo de paciente
7. Verificar a chamada a `createSolicitacaoWithConsumption()`: garantir que não passa campos de paciente; confirmar que passa `descricao` corretamente

**Validação:** Criar um procedimento sem selecionar paciente funciona do início ao fim. Campo "Descrição" é salvo corretamente no Firestore.

**Commit:** `refactor(requests): reduce wizard to 2 steps, remove patient selection`

---

### STEP 4 — Adaptar a listagem de procedimentos

**Objetivo:** Remover referências a paciente da listagem e adicionar coluna "Descrição".

**Arquivos afetados:**

- `src/app/(clinic)/clinic/requests/page.tsx`

**Ações:**

1. Remover colunas "Paciente" (nome e código) da tabela
2. Adicionar coluna "Descrição" — exibe `descricao` se preenchido, caso contrário exibe "—"
3. Ajustar a busca textual para usar `descricao` em vez de `paciente_nome`/`paciente_codigo`
4. Remover qualquer card de estatísticas que exiba dados de paciente

**Validação:** Listagem carrega sem erros; procedimentos exibidos sem referências a pacientes; coluna "Descrição" visível.

**Commit:** `refactor(requests): replace patient columns with description field`

---

### STEP 5 — Adaptar detalhe e edição do procedimento

**Objetivo:** Remover a seção de paciente das páginas de detalhe e edição.

**Arquivos afetados:**

- `src/app/(clinic)/clinic/requests/[id]/page.tsx`
- `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`

**Ações em `[id]/page.tsx`:**

1. Remover o card/seção "Informações do Paciente" (código e nome)
2. Adicionar exibição do campo "Descrição" (se preenchido)

**Ações em `[id]/edit/page.tsx`:**

1. Remover seleção/exibição de paciente
2. Adicionar campo de texto "Descrição" editável

**Validação:** Abrir detalhe de procedimento existente e de um novo procedimento funciona sem erros.

**Commit:** `refactor(requests): remove patient section from detail and edit pages`

---

### STEP 6 — Adaptar o Dashboard da Clínica

**Objetivo:** Remover estatísticas e referências a pacientes do dashboard.

**Arquivos afetados:**

- `src/app/(clinic)/clinic/dashboard/page.tsx`

**Ações:**

1. Remover import de `getPatientsStats` ou qualquer referência ao `patientService`
2. Remover estado `patientsStats` e a chamada à função
3. Remover cards "Total de Pacientes" e "Novos este Mês" (se existirem)
4. Na seção de "Procedimentos Próximos": remover exibição de `paciente_nome` e `paciente_codigo`; substituir por `descricao` (se preenchida) ou texto "Procedimento sem descrição"
5. Reorganizar o layout do dashboard após remoção dos cards

**Validação:** Dashboard carrega sem erros e sem referências a pacientes.

**Commit:** `refactor(dashboard): remove patient stats cards and references`

---

### STEP 7 — Adaptar Relatórios da Clínica

**Objetivo:** Remover a dimensão "por paciente" dos relatórios de consumo (se existir).

**Arquivos afetados:**

- `src/lib/services/reportService.ts`
- `src/app/(clinic)/clinic/reports/page.tsx`

**Ações em `reportService.ts`:**

1. Verificar se existe campo `por_paciente` na interface `ConsumptionReport` — remover se presente (análise atual indica que não existe)
2. Verificar se existe função `generatePatientConsumptionReport()` — remover se presente
3. Verificar referências a `paciente_codigo`/`paciente_nome` em `generateConsumptionReport()` — remover se presentes

**Ações em `reports/page.tsx`:**

1. Verificar se existe tabela/seção "Consumo por Paciente" — remover se presente
2. Remover estados e importações relacionadas se existirem

**Validação:** Gerar relatório de consumo por período funciona sem a seção de pacientes.

**Commit:** `refactor(reports): remove por_paciente dimension from consumption report`

---

### STEP 8 — Adaptar módulo do Consultor

**Objetivo:** Remover referências a pacientes nas telas do consultor.

**Arquivos afetados:**

- `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/reports/page.tsx`

**Ações em `procedures/page.tsx`:**

1. Remover filtro/busca por `paciente_nome`/`paciente_codigo`
2. Remover colunas de paciente da tabela
3. Adicionar coluna "Descrição" no lugar

**Ações em `reports/page.tsx`:**

1. Remover seção "por paciente" do relatório de consumo (consistente com STEP 7)

**Validação:** Consultor consegue visualizar procedimentos e relatórios sem erros e sem referências a pacientes.

**Commit:** `refactor(reports): remove patient columns from consultant views`

---

### STEP 9 — Remover menu de navegação e diretório de páginas de pacientes

**Objetivo:** Eliminar o acesso à área de pacientes da interface.

**Arquivos afetados:**

- `src/components/clinic/ClinicLayout.tsx`
- `src/app/(clinic)/clinic/patients/` — diretório completo (se existir)

**Ações em `ClinicLayout.tsx`:**

1. Remover o item de menu `{ href: "/clinic/patients", label: "Pacientes" }` e ícone associado (se existir)

**Ações no diretório de pacientes:**

1. Verificar existência de `src/app/(clinic)/clinic/patients/` — se existir, deletar o diretório completo

**Validação:** Menu lateral da clínica não exibe "Pacientes". Acessar `/clinic/patients` retorna 404.

**Commit:** `refactor(ui): remove patients menu item and route`

---

### STEP 10 — Limpeza de dados no Firestore

**Objetivo:** Deletar coleções de pacientes e limpar campos obsoletos nas solicitações existentes.

> O projeto está em fase de desenvolvimento. Os dados existentes não possuem valor real. A limpeza completa é segura.

**Arquivos a criar:**

- `scripts/cleanup-patients.js`
- `scripts/cleanup-solicitacoes.js`

**Ações:**

1. Criar e revisar `scripts/cleanup-patients.js`:

```js
// scripts/cleanup-patients.js
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function deleteCollection(colRef) {
  const snapshot = await colRef.get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deletados ${snapshot.size} documentos de ${colRef.path}`);
}

async function run() {
  const tenants = await db.collection('tenants').get();
  for (const tenant of tenants.docs) {
    await deleteCollection(tenant.ref.collection('patients'));
    await deleteCollection(tenant.ref.collection('patient_edit_logs'));
    console.log(`Tenant ${tenant.id} limpo.`);
  }
}

run().catch(console.error);
```

2. Criar e revisar `scripts/cleanup-solicitacoes.js`:

```js
// scripts/cleanup-solicitacoes.js
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function run() {
  const tenants = await db.collection('tenants').get();
  for (const tenant of tenants.docs) {
    const solicitacoes = await tenant.ref.collection('solicitacoes').get();
    const batch = db.batch();
    solicitacoes.docs.forEach((doc) => {
      batch.update(doc.ref, {
        paciente_codigo: admin.firestore.FieldValue.delete(),
        paciente_nome: admin.firestore.FieldValue.delete(),
      });
    });
    await batch.commit();
    console.log(`Tenant ${tenant.id}: ${solicitacoes.size} solicitações limpas.`);
  }
}

run().catch(console.error);
```

3. Testar os scripts em um tenant de desenvolvimento antes de executar em todos
4. Verificar `firestore.indexes.json`: confirmar que índices de `patient_edit_logs` e de `solicitacoes` por `paciente_codigo` já foram removidos (análise atual indica que sim)
5. Se houver índices obsoletos: removê-los e executar `firebase deploy --only firestore:indexes`

**Execução:**

```bash
node scripts/cleanup-patients.js
node scripts/cleanup-solicitacoes.js
firebase deploy --only firestore:indexes
```

**Validação:** Coleções `patients` e `patient_edit_logs` vazias ou inexistentes no Firestore. Documentos em `solicitacoes` sem campos `paciente_codigo` ou `paciente_nome`. Console do Firebase sem índices obsoletos.

**Commit:** `chore(firebase): remove patient collections and obsolete indexes`

---

### STEP 11 — Limpeza de documentação

**Objetivo:** Remover documentação técnica obsoleta e atualizar as documentações afetadas.

**Arquivos afetados:**

- `project_doc/clinic/patients-list-documentation.md` — deletar se existir
- `project_doc/clinic/patients-new-documentation.md` — deletar se existir
- `project_doc/clinic/patients-detail-documentation.md` — deletar se existir
- `project_doc/clinic/patients-edit-documentation.md` — deletar se existir
- `project_doc/clinic/requests-new-documentation.md` — atualizar: refletir novo wizard de 2 etapas
- `project_doc/clinic/requests-list-documentation.md` — atualizar: refletir nova estrutura da tabela
- `project_doc/clinic/dashboard-documentation.md` — atualizar: remover cards e referências a pacientes
- `project_doc/clinic/reports-documentation.md` — atualizar: remover campo `por_paciente` se existir
- `project_doc/consultant/clinics-procedures-documentation.md` — atualizar: remover filtros e colunas de paciente

**Ações:**

1. Deletar os arquivos de documentação de pacientes (se existirem)
2. Atualizar cada documentação mencionada para refletir o novo estado do sistema

**Commit:** `docs: remove obsolete patient documentation`

---

## 8. Estratégia de Testes

| Função                               | Arquivo de teste                           | Cenários obrigatórios                                                                          |
| ------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `createSolicitacaoWithConsumption()` | `src/__tests__/solicitacaoService.test.ts` | Verificar que o teste existente não usa campos de paciente; se usar, remover o campo dos mocks |

Regras aplicadas:

- Esta task é de refatoração (remoção de código) — o foco é garantir que os testes existentes continuam passando sem referências a paciente
- Funções puras novas: não há novas funções puras nesta task
- Componentes React, pages, API routes: **não testar no MVP**

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando (incluindo solicitacaoService.test.ts)
[ ] Multi-tenant: scripts de limpeza Firestore testados em tenant dev antes de executar em todos
[ ] Segurança: scripts de limpeza revisados; nenhum dado de produção real afetado
[ ] Branch pessoal: feature/remove-patient-concept mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] Criar novo procedimento sem campo de paciente → estoque é baixado corretamente
[ ] Listar procedimentos → sem colunas de paciente, campo "Descrição" visível
[ ] Ver detalhe de procedimento → exibe descrição corretamente
[ ] Gerar relatório de consumo → sem seção "por paciente"
[ ] Dashboard carrega sem erros e sem cards de pacientes
[ ] Menu lateral da clínica não exibe "Pacientes"
[ ] URL /clinic/patients retorna 404
[ ] Consultor visualiza procedimentos sem colunas de paciente
[ ] Deploy do Firestore indexes sem erros (se houver alteração)
[ ] Coleção patients vazia ou inexistente no Firestore
[ ] Coleção patient_edit_logs vazia ou inexistente no Firestore
[ ] Documentos em solicitacoes sem campos paciente_codigo ou paciente_nome
[ ] Nenhum import de patientService ou patient.ts permanece no projeto
```

---

## 10. Riscos e Mitigações

| Risco                                                                                            | Probabilidade      | Impacto | Mitigação                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| Script de limpeza Firestore apagar coleção errada                                                | Baixa              | Alto    | Revisar o script antes de executar; testar em tenant dev; usar `console.log` antes de cada operação destrutiva |
| Referências residuais a paciente causando erros de compilação silenciosos                        | Média              | Médio   | Busca global por `paciente\|patient\|Patient` no diretório `src/` antes de fechar o PR                         |
| Relatório de consumo perde dimensão de rastreabilidade por paciente                              | Alta (já acontece) | Médio   | Aceito como decisão estratégica deliberada                                                                     |
| Consultor perde rastreabilidade por paciente                                                     | Alta (já acontece) | Médio   | Aceito como decisão estratégica deliberada                                                                     |
| Testes existentes em `solicitacaoService.test.ts` quebrarem por referências a paciente nos mocks | Baixa              | Baixo   | Verificar o arquivo de teste no STEP 2 e atualizar mocks se necessário                                         |

---

## 11. Glossário

| Termo                      | Definição                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Paciente                   | Conceito removido — pessoa física associada a procedimentos; não existe mais no sistema                 |
| Procedimento / Solicitação | Registro de consumo de produtos do inventário em uma data; identificado pelo campo `descricao` opcional |
| `descricao`                | Campo de texto livre opcional no procedimento que substitui o vínculo ao paciente                       |
| `solicitacao`              | Documento no Firestore representando um procedimento de consumo de inventário                           |
| CR                         | Change Request — mudança de comportamento existente do sistema, tipicamente por decisão de produto      |
| Wizard                     | Formulário multi-etapas; neste contexto, o fluxo de criação de procedimento reduzido de 3 para 2 etapas |

---

## 12. Referências

- `src/types/index.ts` — interface `Solicitacao` (já sem campos de paciente)
- `src/lib/services/solicitacaoService.ts` — `CreateSolicitacaoInput` (já com `descricao`)
- `src/lib/services/reportService.ts` — `ConsumptionReport` (sem `por_paciente`)
- `firestore.indexes.json` — índices atuais (sem índices de paciente)
- `src/__tests__/solicitacaoService.test.ts` — testes existentes a preservar
- `CLAUDE.md` — convenções do projeto, multi-tenant obrigatório
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, commits, PRs
- Documento original: `ONLY_FOR_DEVS/Change_Request_-_Patient-concept-removal.md`

---

## 13. Histórico de Versões

| Versão | Data       | Autor               | O que mudou                                                                                                                                                                                                |
| ------ | ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0    | 07/04/2026 | Doc Writer (Claude) | Versão inicial — reorganização e padronização do documento original seguindo estrutura de 13 seções do doc-writer; complementado com análise do código atual (estado parcialmente implementado confirmado) |
