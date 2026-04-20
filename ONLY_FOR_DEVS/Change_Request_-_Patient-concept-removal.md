# Change Request — Remoção do Conceito de Paciente

**Projeto:** Curva Mestra  
**Data:** 07/04/2026  
**Decisão Estratégica:** A clínica gerenciará apenas o consumo de produtos no inventário via procedimentos (solicitações). O cadastro e gestão de pacientes não é mais necessário.  
**Status:** Aguardando execução

> **Processo:** Este change request deve ser executado seguindo os padrões definidos em [GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md](./GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md) — fonte única de verdade para Git Flow, commits e PRs do projeto.

---

## 0. Workflow de Execução (Git Flow)

Antes de iniciar qualquer step, configure o ambiente conforme o SST:

```bash
# 1. Parta sempre do develop atualizado
git checkout develop
git pull origin develop

# 2. Crie a branch de feature com nome padronizado
git checkout -b feature/remove-patient-concept
```

**Convenção de commits durante a execução** (Conventional Commits):

| Step                                | Tipo sugerido | Exemplo                                                                    |
| ----------------------------------- | ------------- | -------------------------------------------------------------------------- |
| STEP 1 — Remover tipos e serviço    | `refactor`    | `refactor(types): remove patient types and patientService`                 |
| STEP 2 — Adaptar solicitacaoService | `refactor`    | `refactor(requests): remove patient fields from solicitacao model`         |
| STEP 3 — Wizard de criação          | `refactor`    | `refactor(requests): reduce wizard to 2 steps, remove patient selection`   |
| STEP 4 — Listagem                   | `refactor`    | `refactor(requests): replace patient columns with description field`       |
| STEP 5 — Detalhe e edição           | `refactor`    | `refactor(requests): remove patient section from detail and edit pages`    |
| STEP 6 — Dashboard                  | `refactor`    | `refactor(dashboard): remove patient stats cards and references`           |
| STEP 7 — Relatórios                 | `refactor`    | `refactor(reports): remove por_paciente dimension from consumption report` |
| STEP 8 — Módulo Consultor           | `refactor`    | `refactor(reports): remove patient columns from consultant views`          |
| STEP 9 — Menu e páginas             | `refactor`    | `refactor(ui): remove patients menu item and route`                        |
| STEP 10 — Limpeza Firestore         | `chore`       | `chore(firebase): remove patient collections and obsolete indexes`         |
| STEP 11 — Documentação              | `docs`        | `docs: remove obsolete patient documentation`                              |

**Abertura do PR:**

- Target: branch `develop` (nunca diretamente para `master`)
- Preencher o template de PR de `.github/pull_request_template.md`
- Todos os status checks do CI devem passar antes do merge

---

## 1. Contexto e Objetivo

O sistema atualmente associa cada procedimento (solicitação de consumo) a um paciente cadastrado. A decisão estratégica é simplificar o fluxo: os procedimentos passarão a existir de forma independente, registrando apenas quais produtos foram consumidos, em qual data e com quais observações — sem vínculo a um paciente.

**Objetivo:** Remover completamente o conceito de paciente do sistema, adaptando o módulo de procedimentos para operar sem essa dependência.

---

## 2. Mapa Completo de Impacto

### 2.1 Arquivos a REMOVER integralmente

| Arquivo                                               | Motivo                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app/(clinic)/clinic/patients/page.tsx`           | Página de listagem de pacientes                                                              |
| `src/app/(clinic)/clinic/patients/new/page.tsx`       | Formulário de criação                                                                        |
| `src/app/(clinic)/clinic/patients/[id]/page.tsx`      | Página de detalhes                                                                           |
| `src/app/(clinic)/clinic/patients/[id]/edit/page.tsx` | Formulário de edição                                                                         |
| `src/lib/services/patientService.ts`                  | Serviço completo de pacientes                                                                |
| `src/types/patient.ts`                                | Interfaces Patient, PatientWithStats, CreatePatientInput, UpdatePatientInput, PatientEditLog |
| `project_doc/clinic/patients-list-documentation.md`   | Documentação obsoleta                                                                        |
| `project_doc/clinic/patients-new-documentation.md`    | Documentação obsoleta                                                                        |
| `project_doc/clinic/patients-detail-documentation.md` | Documentação obsoleta                                                                        |
| `project_doc/clinic/patients-edit-documentation.md`   | Documentação obsoleta                                                                        |

### 2.2 Arquivos a MODIFICAR

| Arquivo                                                                  | O que muda                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/index.ts`                                                     | Remover exportação de `Patient` e tipos relacionados                                                                                 |
| `src/components/clinic/ClinicLayout.tsx`                                 | Remover item de menu "Pacientes" → `/clinic/patients`                                                                                |
| `src/app/(clinic)/clinic/dashboard/page.tsx`                             | Remover cards de estatísticas de pacientes e `getPatientsStats`; remover `paciente_nome`/`paciente_codigo` dos procedimentos futuros |
| `src/app/(clinic)/clinic/requests/new/page.tsx`                          | Remover Step 1 (autocomplete de paciente); wizard passa de 3 para 2 etapas                                                           |
| `src/app/(clinic)/clinic/requests/page.tsx`                              | Remover colunas `paciente_nome` e `paciente_codigo`; ajustar busca textual                                                           |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx`                         | Remover seção "Informações do Paciente"                                                                                              |
| `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`                    | Remover campo/seleção de paciente                                                                                                    |
| `src/lib/services/solicitacaoService.ts`                                 | Remover campos `paciente_codigo` e `paciente_nome`; ajustar interfaces e queries                                                     |
| `src/lib/services/reportService.ts`                                      | Remover campo `por_paciente` do `ConsumptionReport`; remover `generatePatientConsumptionReport` se existir                           |
| `src/app/(clinic)/clinic/reports/page.tsx`                               | Remover tabela/seção "por paciente" do relatório de consumo                                                                          |
| `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx` | Remover filtro e colunas de `paciente_nome`/`paciente_codigo`                                                                        |
| `src/app/(consultant)/consultant/clinics/[tenantId]/reports/page.tsx`    | Remover seção "por paciente" do relatório de consumo                                                                                 |
| `firestore.indexes.json`                                                 | Remover índices da coleção `patient_edit_logs` e índice de `solicitacoes` por `paciente_codigo`                                      |

### 2.3 Estrutura Firestore afetada

| Coleção                                | Ação                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tenants/{tenantId}/patients`          | **Deletar todos os documentos**                                                                                |
| `tenants/{tenantId}/patient_edit_logs` | **Deletar todos os documentos**                                                                                |
| `tenants/{tenantId}/solicitacoes`      | **Limpar campos** `paciente_codigo` e `paciente_nome` de todos os documentos existentes via script de migração |

> **Contexto:** O projeto está em fase de desenvolvimento e os dados existentes não possuem valor real. A limpeza completa garante que o código opere em conformidade com a nova estrutura sem necessidade de manter compatibilidade retroativa.

---

## 3. Decisão de Design: Procedimentos sem Paciente

Com a remoção do paciente, o procedimento (solicitação) ficará assim:

**Antes:**

- Paciente (obrigatório, autocomplete)
- Data do procedimento (obrigatório)
- Observações (opcional)
- Produtos consumidos (obrigatório)

**Depois:**

- Descrição / Identificação (opcional, texto livre — ex: "Procedimento facial Dra. Ana")
- Data do procedimento (obrigatório)
- Observações (opcional)
- Produtos consumidos (obrigatório)

> **Decisão:** Substituir o campo de paciente por um campo de texto livre opcional chamado **"Descrição"** (ou "Identificação"). Isso preserva a flexibilidade de identificar o procedimento sem exigir cadastro prévio.

---

## 4. Plano de Execução por Steps

---

### STEP 1 — Remover tipos e serviço de pacientes

**Objetivo:** Eliminar a camada de dados do conceito de paciente.

**Ações:**

1. Deletar `src/types/patient.ts`
2. Em `src/types/index.ts`: remover as linhas que exportam `Patient`, `PatientWithStats`, `CreatePatientInput`, `UpdatePatientInput`, `PatientEditLog`
3. Deletar `src/lib/services/patientService.ts`

**Validação:** O projeto deve compilar com erros apenas nos arquivos que importam esses tipos/serviços (serão tratados nos steps seguintes). Nenhum erro novo deve surgir fora do esperado.

---

### STEP 2 — Adaptar a interface Solicitacao e o serviço de solicitações

**Objetivo:** Desacoplar `solicitacaoService.ts` do conceito de paciente.

**Ações em `src/lib/services/solicitacaoService.ts`:**

1. Na interface `Solicitacao` (ou `SolicitacaoWithDetails`): remover campos `paciente_codigo: string` e `paciente_nome: string`; adicionar campo opcional `descricao?: string`
2. Na função `createSolicitacaoWithConsumption()`: remover parâmetros/validações de `paciente_codigo` e `paciente_nome`; adicionar `descricao?: string` ao payload salvo no Firestore
3. Na função `updateSolicitacaoAgendada()`: remover referências a paciente
4. Na função `listSolicitacoes()`: remover filtros por `paciente_codigo`/`paciente_nome`
5. Na função `getUpcomingProcedures()`: remover campos de paciente do retorno
6. Remover qualquer query que use `paciente_codigo` como filtro de busca

**Validação:** `solicitacaoService.ts` não deve mais importar nada de `patientService` ou `patient.ts`.

---

### STEP 3 — Adaptar o wizard de criação de procedimento

**Objetivo:** Remover o Step 1 (seleção de paciente) e reduzir o wizard para 2 etapas.

**Ações em `src/app/(clinic)/clinic/requests/new/page.tsx`:**

1. Remover import de `searchPatients` do `patientService`
2. Remover import do tipo `Patient`
3. Remover todo o estado relacionado a paciente: `selectedPatient`, `patientSearch`, `patientResults`, `patientLoading`, etc.
4. Remover o Step 1 completo (autocomplete de paciente, card de paciente selecionado)
5. Renomear Step 2 → Step 1 (Adicionar Produtos) e Step 3 → Step 2 (Revisão)
6. Adicionar no Step 1 (ex-Step 2) um campo de texto opcional **"Descrição"** (ex: placeholder "Ex: Procedimento facial - sala 2")
7. Remover da revisão final (ex-Step 3) a seção de resumo do paciente; exibir a "Descrição" se preenchida
8. Atualizar a chamada a `createSolicitacaoWithConsumption()` removendo campos de paciente e passando `descricao`

**Validação:** Criar um procedimento sem selecionar paciente deve funcionar do início ao fim.

---

### STEP 4 — Adaptar a listagem de procedimentos

**Objetivo:** Remover referências a paciente da listagem.

**Ações em `src/app/(clinic)/clinic/requests/page.tsx`:**

1. Remover colunas "Paciente" (nome e código) da tabela
2. Adicionar coluna "Descrição" (exibe o campo `descricao` se preenchido, caso contrário exibe "—")
3. Ajustar a busca textual para buscar por `descricao` em vez de `paciente_nome`/`paciente_codigo`
4. Atualizar os cards de estatísticas se algum exibir dados de paciente

**Validação:** A listagem deve carregar sem erros e exibir os procedimentos sem referências a pacientes.

---

### STEP 5 — Adaptar detalhes e edição do procedimento

**Objetivo:** Remover a seção de paciente das páginas de detalhe e edição.

**Ações em `src/app/(clinic)/clinic/requests/[id]/page.tsx`:**

1. Remover o card "Informações do Paciente" (código e nome)
2. Substituir por exibição do campo "Descrição" (se preenchido)

**Ações em `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`:**

1. Remover seleção/exibição de paciente
2. Adicionar campo de texto "Descrição" editável

**Validação:** Abrir o detalhe de um procedimento existente e de um novo deve funcionar sem erros.

---

### STEP 6 — Adaptar o Dashboard da Clínica

**Objetivo:** Remover estatísticas e referências a pacientes do dashboard.

**Ações em `src/app/(clinic)/clinic/dashboard/page.tsx`:**

1. Remover import de `getPatientsStats` do `patientService`
2. Remover estado `patientsStats` e a chamada à função
3. Remover os cards "Total de Pacientes" e "Novos este Mês"
4. Na seção de "Procedimentos Próximos": remover exibição de `paciente_nome` e `paciente_codigo`; substituir por `descricao` (se preenchida) ou "Procedimento sem descrição"
5. Reorganizar o layout do dashboard conforme necessário após remoção dos cards

**Validação:** Dashboard carrega sem erros e sem referências a pacientes.

---

### STEP 7 — Adaptar Relatórios da Clínica

**Objetivo:** Remover a dimensão "por paciente" dos relatórios de consumo.

**Ações em `src/lib/services/reportService.ts`:**

1. Na interface `ConsumptionReport`: remover o campo `por_paciente`
2. Na função `generateConsumptionReport()`: remover o agrupamento por `paciente_codigo`; remover referências a `paciente_nome` e `paciente_codigo`
3. Se existir `generatePatientConsumptionReport()`: remover a função completa

**Ações em `src/app/(clinic)/clinic/reports/page.tsx`:**

1. Remover a tabela/seção "Consumo por Paciente" do relatório de consumo
2. Remover estado e importações relacionadas

**Validação:** Gerar relatório de consumo por período deve funcionar sem a seção de pacientes.

---

### STEP 8 — Adaptar módulo do Consultor

**Objetivo:** Remover referências a pacientes nas telas do consultor.

**Ações em `src/app/(consultant)/consultant/clinics/[tenantId]/procedures/page.tsx`:**

1. Remover filtro/busca por `paciente_nome`/`paciente_codigo`
2. Remover colunas de paciente da tabela
3. Adicionar coluna "Descrição" no lugar

**Ações em `src/app/(consultant)/consultant/clinics/[tenantId]/reports/page.tsx`:**

1. Remover seção "por paciente" do relatório de consumo (consistente com Step 7)

**Validação:** Consultor consegue visualizar procedimentos e relatórios sem erros.

---

### STEP 9 — Remover menu de navegação e páginas de pacientes

**Objetivo:** Eliminar o acesso à área de pacientes da interface.

**Ações em `src/components/clinic/ClinicLayout.tsx`:**

1. Remover o item de menu `{ href: "/clinic/patients", label: "Pacientes" }` (e ícone associado)

**Ações nas páginas de pacientes:**

1. Deletar o diretório completo `src/app/(clinic)/clinic/patients/` com todos os seus arquivos

**Validação:** O menu da clínica não exibe mais "Pacientes". Acessar `/clinic/patients` deve retornar 404.

---

### STEP 10 — Limpeza de dados no Firestore

**Objetivo:** Deletar coleções de pacientes e limpar campos obsoletos nas solicitações existentes.

> O projeto está em fase de desenvolvimento — dados existentes não possuem valor real.

#### 10.1 Deletar coleções de pacientes

Executar via Firebase Console ou script Node.js:

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

```bash
node scripts/cleanup-patients.js
```

#### 10.2 Limpar campos de paciente nas solicitações existentes

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

```bash
node scripts/cleanup-solicitacoes.js
```

#### 10.3 Remover índices obsoletos do Firestore

**Ações em `firestore.indexes.json`:**

1. Remover índice da coleção `patient_edit_logs` (campos: `patient_id ASC`, `edited_at DESC`)
2. Remover índice da coleção `solicitacoes` que filtra por `paciente_codigo` (campos: `paciente_codigo ASC`, `dt_procedimento DESC`)
3. Manter todos os demais índices de `solicitacoes` intactos

```bash
firebase deploy --only firestore:indexes
```

**Validação:** Console do Firebase não deve exibir índices obsoletos. Coleções `patients` e `patient_edit_logs` devem estar vazias ou inexistentes.

---

### STEP 11 — Limpeza de documentação

**Objetivo:** Remover documentação técnica obsoleta e atualizar as afetadas.

**Ações:**

1. Deletar arquivos em `project_doc/clinic/`:
   - `patients-list-documentation.md`
   - `patients-new-documentation.md`
   - `patients-detail-documentation.md`
   - `patients-edit-documentation.md`

2. Atualizar `project_doc/clinic/requests-new-documentation.md`: refletir novo wizard de 2 etapas sem paciente
3. Atualizar `project_doc/clinic/requests-list-documentation.md`: refletir nova estrutura da tabela
4. Atualizar `project_doc/clinic/dashboard-documentation.md`: remover cards e referências a pacientes
5. Atualizar `project_doc/clinic/reports-documentation.md`: remover campo `por_paciente`
6. Atualizar `project_doc/consultant/clinics-procedures-documentation.md`: remover filtros e colunas de paciente

---

### STEP 12 — Testes e validação final

**Checklist de validação:**

- [ ] Criar novo procedimento sem campo de paciente → estoque é baixado corretamente
- [ ] Listar procedimentos → sem colunas de paciente, campo "Descrição" visível
- [ ] Ver detalhe de procedimento → exibe descrição corretamente
- [ ] Gerar relatório de consumo → sem seção "por paciente"
- [ ] Dashboard carrega sem erros e sem cards de pacientes
- [ ] Menu lateral da clínica não exibe "Pacientes"
- [ ] URL `/clinic/patients` retorna 404
- [ ] Consultor visualiza procedimentos sem colunas de paciente
- [ ] Deploy do Firestore indexes sem erros
- [ ] Coleção `patients` vazia ou inexistente no Firestore
- [ ] Coleção `patient_edit_logs` vazia ou inexistente no Firestore
- [ ] Documentos em `solicitacoes` não possuem campos `paciente_codigo` ou `paciente_nome`
- [ ] Nenhum import de `patientService` ou `patient.ts` permanece no projeto

---

## 5. Ordem Recomendada de Execução

```
STEP 1 → STEP 2 → STEP 3 → STEP 4 → STEP 5
                                          ↓
                  STEP 9 ← STEP 8 ← STEP 7 ← STEP 6
                      ↓
                  STEP 10 (limpeza Firestore — pode ser feito a qualquer momento)
                      ↓
                  STEP 11 → STEP 12
```

- **Steps 1 e 2** são pré-requisitos para todos os outros (eliminam a camada base).
- **Steps 3 a 9** podem ser executados em paralelo após Steps 1 e 2 concluídos.
- **Step 10** (limpeza Firestore) pode ser executado a qualquer momento após Step 2, independente dos demais.

---

## 6. Riscos e Pontos de Atenção

| Risco                                            | Impacto | Mitigação                                                                              |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------- |
| Script de limpeza Firestore apagar dados errados | Médio   | Revisar o script antes de executar; testar em um tenant de dev antes de rodar em todos |
| Relatório de consumo perde dimensão de paciente  | Médio   | Substituído por agrupamento por `descricao` ou apenas por produto — decisão aceita     |
| Busca em procedimentos perde filtro por paciente | Baixo   | Substituída por busca na `descricao`                                                   |
| Consultor perde rastreabilidade por paciente     | Médio   | Aceito — decisão estratégica deliberada                                                |
| Índices órfãos no Firestore com custo            | Baixo   | Removidos no Step 10                                                                   |

---

## 7. O que NÃO fazer

- **Não adicionar** redirecionamento de `/clinic/patients` para outra rota (404 é o comportamento correto)
- **Não remover** o campo `observacoes` dos procedimentos (continua existindo independentemente)
- **Não executar** os scripts de limpeza Firestore sem revisar o conteúdo antes
