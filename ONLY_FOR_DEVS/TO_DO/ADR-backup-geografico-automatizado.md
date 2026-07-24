# ADR: Backup Geográfico Automatizado (Firestore + Cloud Storage)

**Projeto:** Curva Mestra
**Data:** 24/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Aprovado — decisões de arquitetura fechadas; implementação **não priorizada** (aguardando janela futura)
**Tipo:** ADR
**Branch sugerida:** `chore/backup-geografico-firestore-storage` — apenas candidata para quando a implementação for priorizada pelo `dev-task-manager`; **nenhuma branch deve ser aberta agora**
**Prioridade:** Baixa — documentar agora, implementar depois. Decisão explícita do usuário: este item **não entra na fila imediata de desenvolvimento**
**Versão:** 1.1

> Este ADR fecha a decisão de arquitetura para cumprir a promessa de "Backup geográfico diário" feita na landing page comercial (`public/landing/sections-trust.jsx`), hoje inexistente no sistema real. Diferente de um UC, não há ator humano nem tela envolvidos — é um processo de infraestrutura agendado (Cloud Scheduler + Cloud Functions + `gcloud firestore export`), por isso foi registrado como ADR, e não como o UC-54 originalmente reservado no mapa de bugs. Todas as decisões técnicas abaixo, incluindo a região secundária do bucket de backup, já foram fechadas nesta elicitação; a implementação fica para uma janela futura.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (padrão do projeto).
- **Branch de implementação (candidata, só quando priorizada):** `chore/backup-geografico-firestore-storage` — prefixo `chore/` por ser infraestrutura, não feature de produto nem correção de bug de UI, mesmo critério já usado no ADR de QA (`ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md`) para o nome de branch sugerido lá.
- **Nenhum commit relacionado à implementação deve ser aberto agora.** A tabela abaixo é um planejamento de commits **candidato**, para acelerar o trabalho quando a task for de fato retomada — corresponde aos STEPs da Seção 7.

| Step | Tipo | Escopo | Mensagem candidata |
|---|---|---|---|
| STEP 1 | `chore` | `infra` | `chore(infra): provisiona bucket de backup cross-region e service account dedicada` |
| STEP 2 | `feat` | `functions` | `feat(functions): adiciona scheduled function de export diario do Firestore` |
| STEP 3 | `feat` | `functions` | `feat(functions): adiciona replicacao diaria do bucket de NF-e (/danfe) para regiao secundaria` |
| STEP 4 | `chore` | `infra` | `chore(infra): configura lifecycle rule de retencao de 90 dias no bucket de backup` |
| STEP 5 | `feat` | `functions` | `feat(functions): adiciona scheduled function mensal de restore automatizado e validacao` |
| STEP 6 | `docs` | `devs` | `docs(devs): adiciona runbook de validacao manual do restore mensal` |

**Lembrete padrão do projeto:** PR sempre para `develop`, nunca diretamente para `master`. Quando (e se) esta implementação for retomada, siga o fluxo normal: task branch → branch pessoal (`gscandelari_setup`) para validação no Firebase → PR para `develop`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A landing page comercial do sistema promete, na seção "Segurança & conformidade" (`public/landing/sections-trust.jsx`, componente `Security`, array `pillars`, linha 10):

> "Backup geográfico diário — Cópia criptografada em região distinta, com retenção de 90 dias e restore testado mensalmente."

A mesma promessa é repetida na FAQ da landing (`sections-trust.jsx`, componente `FAQ`, linha 200: *"...trilha de auditoria completa e backup geográfico diário."*).

Nenhuma parte dessa promessa existe hoje no sistema real. Investigação de código confirmada nesta elicitação:

- `functions/src/index.ts` (arquivo ativo, único fonte de verdade de Functions em produção) exporta apenas triggers reativos e callables: `sendTestEmail`, `onUserCreated`, `onTenantCreated`, `onAccessRequestCreated`, `sendCustomEmail`, `sendTempPasswordEmail`, `sendAccessRejectionEmail`, `processEmailQueue`, e um `placeholder` (`onRequest`, região `southamerica-east1`). **Nenhum `onSchedule` existe no projeto.**
- `firebase.json` não tem nenhuma seção de configuração de backup/export — apenas `hosting`, `functions`, `firestore` (rules/indexes), `storage` (rules) e `emulators`.
- Nenhuma menção a backup/restore/scheduler em `ONLY_FOR_DEVS/` ou em `.github/workflows/`.
- `.firebaserc` confirma dois projetos GCP: `curva-mestra` (produção, `default`) e `curva-mestra-dev` (ambiente de dev). A convenção de região usada em todo o código de Functions existente é `southamerica-east1` (São Paulo) — é a região principal do projeto.
- **Caminho real de armazenamento de arquivos de NF-e hoje** (confirmado em `storage.rules`, linha 21-33): `/danfe/{tenantId}/{nfId}` no Cloud Storage do Firebase. O comentário da própria regra já documenta a transição: *"Estrutura: /danfe/{tenant_id}/{nf_id} — aceita XML NF-e (estratégia atual) e PDF (legado)"* — a regra de `write` exige `contentType` `application/xml`, `text/xml` ou `application/octet-stream`, e tamanho máximo de 10MB, consistente com a decisão já registrada no `CLAUDE.md` de que a importação é hoje exclusivamente via XML NF-e SEFAZ v4.00 (o antigo `src/app/api/parse-nf/route.ts` de importação por PDF foi removido). Ou seja: o path `/danfe/{tenantId}/{nfId}` é o alvo real e único de backup de arquivos do Cloud Storage para este ADR — não há novo path a descobrir.
- **Achado à parte, sem relação funcional com este ADR:** existe um arquivo stale `functions/src/index.ts.backup` com exports órfãos (`checkLicenseExpiration`, integração PagBank — `createPagBankSubscription`, `pagbankWebhook`) cujos arquivos-fonte não existem mais no diretório `functions/src/`. É lixo de uma tentativa de feature abandonada (cobrança/licenciamento via PagBank), não um precedente funcional de Scheduled Function reaproveitável — mencionado aqui apenas para registro, sem mais investigação.

### 1.2 Problema identificado

1. A landing page faz uma promessa de segurança/conformidade concreta e específica (região distinta, 90 dias, restore mensal testado) que **não corresponde a nenhuma implementação real** — risco de propaganda enganosa perante um cliente que audite a alegação.
2. Não existe hoje **nenhuma estratégia de disaster recovery** para o Firestore de produção (`curva-mestra`) nem para os arquivos de NF-e em Cloud Storage. Uma exclusão acidental em massa, corrupção de dados ou incidente regional no GCP não tem caminho de recuperação além dos dados já auditados/monitorados em tempo real (sem cópia fria independente).
3. O item já estava catalogado como pendência no mapa de bugs e melhorias (`ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, v3.13), reservado como candidato a **UC-54** ("Backup Geográfico Automatizado") desde a v3.8 daquele mapa, sinalizado explicitamente ali como *"trabalho de infraestrutura/DevOps, foge do padrão usual de bug fix ou feature de UI deste mapa"*.

### 1.3 Motivação estratégica

Nesta elicitação, ficou decidido que este item **não deve virar um UC formal**: não há ator humano operando uma tela, não há fluxo de UI, e o que resta a fazer é justamente formalizar decisões técnicas de arquitetura (qual mecanismo usar, qual região, como testar o restore) — exatamente o perfil já estabelecido no projeto para um ADR, precedente direto em `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md`. Diferente daquele ADR (que ficou deliberadamente pausado, com perguntas em aberto), aqui o usuário **fechou todas as decisões técnicas principais** — incluindo, na revisão que originou a v1.1 deste documento, a última pendência (região secundária do bucket) — o que faltava não era decisão, era janela de implementação. Por isso o Status deste documento é "Aprovado — decisões de arquitetura fechadas", e não "Planejamento — pausado".

---

## 2. Objetivos

1. Registrar formalmente a decisão de arquitetura para cumprir a promessa de "backup geográfico diário" da landing page, hoje inexistente no sistema.
2. Definir o mecanismo técnico para backup do Firestore: `gcloud firestore export` agendado via Cloud Scheduler + Cloud Function, gravando em bucket do Cloud Storage em região distinta da principal (`southamerica-east1`).
3. Definir o mecanismo técnico para backup dos arquivos de NF-e em Cloud Storage (`/danfe/{tenantId}/{nfId}`), cobrindo o path real confirmado nesta investigação.
4. Definir a política de retenção de 90 dias via lifecycle rule automatizada no bucket de backup, sem rotina manual de limpeza.
5. Definir o processo híbrido de restore testado mensalmente: automação (Cloud Function mensal restaura o backup mais recente em ambiente isolado e valida integridade estrutural) **mais** validação humana final.
6. Registrar, como decisão de produto explícita, que o usuário está ciente e aceita o custo recorrente de infraestrutura GCP envolvido, mesmo isso contrariando o princípio de "Zero DevOps" declarado no `CLAUDE.md`.
7. Deixar explícito que esta é uma decisão de arquitetura já fechada, mas de **prioridade baixa** — não entra na fila imediata de implementação.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | O sistema deve executar, diariamente e sem intervenção humana, um export completo do Firestore de produção para um bucket do Cloud Storage em região distinta de `southamerica-east1`. | Cloud Scheduler + Cloud Function (sistema) | Must |
| RF-02 | O sistema deve replicar, diariamente, os arquivos armazenados em `/danfe/{tenantId}/{nfId}` para um bucket secundário em região distinta. | Cloud Scheduler + Cloud Function ou Cloud Storage Transfer Service (sistema) | Must |
| RF-03 | O bucket de backup deve aplicar uma lifecycle rule que exclua automaticamente exports/arquivos com mais de 90 dias, sem rotina manual de limpeza. | Cloud Storage (sistema) | Must |
| RF-04 | Mensalmente, o sistema deve restaurar automaticamente o backup mais recente do Firestore em um banco de dados/ambiente de teste isolado da produção. | Cloud Function agendada (sistema) | Must |
| RF-05 | Após o restore automatizado, o sistema deve gerar um relatório estrutural (contagem de documentos por coleção, presença de coleções-chave) comparando o restaurado com o esperado, para apoiar a validação humana. | Cloud Function agendada (sistema) | Should |
| RF-06 | Um humano (system_admin/dev responsável) deve confirmar manualmente, todo mês, que os dados restaurados fazem sentido, e essa confirmação deve ficar registrada (ex.: runbook, ticket ou documento de acompanhamento). | system_admin / dev | Must |
| RF-07 | Falhas no job diário de export (Firestore ou Storage) devem gerar um alerta visível (log estruturado + notificação), não apenas falhar silenciosamente. | Cloud Function (sistema) | Should |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | O bucket de backup não pode ter acesso público; apenas a service account dedicada às Cloud Functions de backup e as contas de `system_admin`/dev via IAM têm permissão de leitura/escrita. | Segurança |
| RNF-02 | O armazenamento do backup deve usar uma classe de custo reduzido do Cloud Storage (Nearline/Coldline), compatível com o padrão de acesso infrequente de dados de disaster recovery. | Custo / Performance |
| RNF-03 | O restore de teste mensal deve ocorrer em um ambiente (banco de dados Firestore secundário ou projeto GCP isolado) totalmente separado da produção — nunca pode escrever no Firestore de `curva-mestra` nem sobrescrever dados reais do ambiente `curva-mestra-dev` compartilhado pelos devs. | Segurança / Multi-tenant |
| RNF-04 | O mecanismo de export/import não deve exigir nenhuma credencial ou chave de service account hardcoded no código — deve usar as permissões IAM padrão já concedidas às Cloud Functions do projeto. | Segurança |
| RNF-05 | O custo mensal estimado da solução deve ser documentado neste ADR como referência (ver Seção 4.1), ainda que aproximado, para acompanhamento futuro do orçamento de infraestrutura. | Manutenibilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Retenção de exatamente 90 dias, aplicada automaticamente via lifecycle rule do bucket — sem rotina manual de limpeza. | Cumprir literalmente a promessa da landing page ("retenção de 90 dias") sem depender de disciplina humana recorrente. |
| RN-02 | O escopo do backup cobre tanto o Firestore (todas as coleções, incluindo a estrutura multi-tenant `tenants/{tenantId}/...` e coleções top-level como `users`, `tenants`, `consultants`, `products`, `legal_documents`) quanto o Cloud Storage (`/danfe/{tenantId}/{nfId}`, arquivos XML de NF-e já enviados). | Cumprir a promessa da landing de forma completa — dado operacional e arquivos, não apenas o banco de dados. |
| RN-03 | O restore mensal de teste nunca sobrescreve produção nem o ambiente compartilhado de dev — deve usar um banco de dados Firestore secundário (multi-database, mesmo projeto ou projeto isolado dedicado). | Evitar que o próprio teste de disaster recovery vire uma fonte de incidente. |
| RN-04 | A automação de restore mensal não substitui a validação humana — ambas são obrigatórias antes de o teste do mês ser considerado concluído. | Contagem de documentos bater não garante integridade semântica dos dados; only um humano pode confirmar isso com confiança razoável. |
| RN-05 | Esta funcionalidade **não entra na fila imediata de desenvolvimento** — implementação fica condicionada a priorização futura explícita pelo `dev-task-manager`, a pedido do usuário. | Decisão de produto explícita desta elicitação: documentar agora, implementar depois. |
| RN-06 | O usuário está ciente e aceita o custo recorrente de infraestrutura GCP (Cloud Scheduler, exports do Firestore, armazenamento cross-region), mesmo isso contrariando o princípio "Zero DevOps" do `CLAUDE.md`. | Decisão de produto explícita — a promessa de segurança da landing page tem prioridade sobre a economia de infraestrutura neste caso específico. |
| RN-07 | A região secundária do bucket de backup é `southamerica-west1` (Santiago, Chile). | Decisão de produto explícita (fechada na revisão que originou a v1.1 deste ADR): mais próxima e barata que uma região fora da América do Sul, e evita a questão de transferência internacional de dados para fora do continente, mantendo a réplica dentro da América do Sul. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Padrão de mercado para backup de Firestore + Cloud Storage, 100% dentro do ecossistema GCP nativo:

1. **Firestore:** `gcloud firestore export` (Firestore Managed Export/Import, API `google.firestore.admin.v1.FirestoreAdmin.ExportDocuments`) disparado diariamente por uma Cloud Scheduled Function (2nd gen, `onSchedule`, região `southamerica-east1` — mesma convenção das demais Functions do projeto), gravando em um bucket do Cloud Storage **em região distinta** da principal.
2. **Cloud Storage (`/danfe/{tenantId}/{nfId}`):** réplica diária dos objetos para um bucket secundário na mesma região de backup, via **Cloud Storage Transfer Service** (serviço gerenciado do GCP para replicação agendada entre buckets, inclusive cross-region — preferível a escrever lógica de cópia customizada em uma Cloud Function) ou, alternativamente, uma Cloud Function dedicada usando `@google-cloud/storage` caso o Transfer Service não atenda a alguma restrição encontrada na implementação.
3. **Retenção:** lifecycle rule nativa do bucket de backup (`age: 90`, ação `Delete`) — sem rotina de limpeza manual, cobrindo tanto os exports do Firestore quanto a réplica dos arquivos de NF-e.
4. **Restore testado mensalmente (processo híbrido):**
   - **Automação:** uma segunda Cloud Scheduled Function, mensal, localiza o export mais recente no bucket de backup e executa `gcloud firestore import` (ou a API equivalente) para um **banco de dados Firestore secundário** (recurso de multi-database do Firestore, disponível desde 2023 — múltiplos bancos independentes dentro do mesmo projeto GCP), isolado da produção. Após o import, roda verificações estruturais automatizadas (contagem de documentos por coleção, presença das coleções-chave) e gera um relatório.
   - **Validação humana:** um `system_admin`/dev revisa o relatório gerado e confirma manualmente, uma vez por mês, que os dados restaurados fazem sentido — essa confirmação fica registrada (formato exato do registro — runbook, ticket, checklist — é decisão de implementação, fora do escopo deste ADR).

**Região secundária do bucket de backup — decisão fechada:** `southamerica-west1` (Santiago, Chile). Entre as duas candidatas levantadas nesta elicitação (`southamerica-west1`/Chile vs. uma região dos EUA, ex. `us-east1`), o usuário optou por `southamerica-west1` por ser mais próxima e mais barata que uma região fora da América do Sul, além de manter a réplica dentro do continente, evitando a questão adicional de transferência internacional de dados para fora da América do Sul (ainda que, tecnicamente, Chile já seja um país distinto do Brasil — a consideração de compliance é sobre manter a réplica dentro do continente, não estritamente dentro do território nacional). Não há dado de paciente envolvido em nenhum momento (o sistema não coleta esse dado, por desenho, conforme a própria landing page) — o dado replicado é estritamente operacional (produto, lote, custo, arquivos de NF-e).

**Estimativa de custo mensal (aproximada, não garantida):** para um Firestore de MVP com poucos tenants e poucos GB de dados (estimativa de referência: ~1-3GB de dados no Firestore, algumas centenas de MB em arquivos XML de NF-e), o custo recorrente estimado fica na faixa de **US$ 5 a US$ 20/mês**, composto por: armazenamento cross-region do backup em classe Coldline/Nearline em `southamerica-west1` (exports diários acumulados por até 90 dias — a maior parcela do custo, pois cada export diário é uma cópia completa, não incremental); egress de rede inter-regional do export diário e da réplica de arquivos (`southamerica-east1` → `southamerica-west1`); Cloud Scheduler (dentro da cota gratuita de 3 jobs/mês para poucos jobs); invocações de Cloud Functions (dentro ou próximo da cota gratuita). Esta é uma estimativa de referência para orçamento, a ser validada com a calculadora de preços do GCP no momento da implementação real — o custo cresce proporcionalmente ao tamanho do Firestore de produção ao longo do tempo, já que os exports são cópias completas diárias, não diffs.

### 4.2 Alternativas descartadas

| Alternativa | Descrição | Motivo do descarte |
|---|---|---|
| Backup manual/ad-hoc, sem agendamento | Um dev roda `gcloud firestore export` manualmente de tempos em tempos. | Não cumpre a promessa de "diário"/"retenção de 90 dias"/"restore mensal" — depende de disciplina humana recorrente, exatamente o tipo de processo que a landing page promete ser automático. |
| Firestore multi-region location nativa (mudar a location do banco de dados do projeto para uma location multi-region do GCP) | Em vez de backup, usar uma location de Firestore que já replica os dados entre múltiplas regiões nativamente. | É uma decisão estrutural do banco de dados, definida na criação do projeto/database e não trivialmente reversível — muda o comportamento e o custo de todo o Firestore, não é "backup" no sentido de cópia fria independente e restaurável, e não cobre o requisito de retenção de 90 dias com pontos de restauração distintos no tempo (é replicação síncrona, não snapshots). |
| Serviço de backup de terceiros (SaaS especializado em backup de Firebase/Firestore) | Contratar uma ferramenta externa dedicada a backup gerenciado. | Introduz um vendor externo adicional, com custo próprio e menos controle direto sobre região/retenção; o mecanismo nativo do GCP (`gcloud firestore export` + Cloud Storage) já atende a todos os requisitos sem dependência externa. |
| Backup incremental customizado (diffs entre exports) | Implementar lógica própria para calcular e armazenar apenas as diferenças entre um export e o anterior. | Complexidade de implementação desproporcional ao tamanho de dados esperado no MVP (poucos tenants, poucos GB); o export completo gerenciado pelo Google já é o padrão de mercado documentado e suficiente para este estágio do produto. |
| Região secundária nos EUA (ex.: `us-east1`) | Maior distância geográfica da região principal, o que ofereceria melhor postura de disaster recovery contra um incidente regional que afete toda a América do Sul. | Descartada em favor de `southamerica-west1`: custo/latência de egress maiores, e introduz transferência de dados para fora do continente — o usuário priorizou manter a réplica dentro da América do Sul, mesmo aceitando uma postura de DR regional (não intercontinental). |

### 4.3 Trade-offs aceitos

- **Custo recorrente de infraestrutura vs. princípio "Zero DevOps"**: aceito explicitamente pelo usuário nesta elicitação — a promessa de segurança já publicada na landing page tem prioridade sobre a economia de infraestrutura neste caso específico (ver RN-06).
- **Exports diários completos (não incrementais) geram redundância de armazenamento**: o mesmo dado é replicado várias vezes ao longo da janela de 90 dias, o que aumenta o custo de armazenamento comparado a uma estratégia incremental — aceito em troca de simplicidade operacional e por ser o padrão de mercado (ver 4.2, alternativa descartada de backup incremental customizado).
- **Restore automatizado valida apenas estrutura, não semântica completa**: a automação confirma contagens de documentos e presença de coleções-chave, não que os dados em si estão semanticamente corretos — por isso a validação humana final (RF-06/RN-04) é obrigatória, não apenas um "nice to have".
- **Região secundária dentro da América do Sul (`southamerica-west1`) vs. postura de disaster recovery intercontinental**: aceito que um incidente que afete toda a região sul-americana da GCP simultaneamente (cenário de baixíssima probabilidade) não seria coberto por esta réplica — trade-off aceito explicitamente pelo usuário em favor de custo menor e simplicidade de compliance (réplica dentro do continente).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `functions/src/scheduledFirestoreBackup.ts` | Cloud Scheduled Function | Export diário do Firestore de produção para o bucket de backup em `southamerica-west1` (RF-01). |
| `functions/src/scheduledStorageBackup.ts` | Cloud Scheduled Function (ou config de Storage Transfer Service, a decidir na implementação) | Réplica diária dos arquivos `/danfe/{tenantId}/{nfId}` para o bucket secundário em `southamerica-west1` (RF-02). |
| `functions/src/scheduledRestoreValidation.ts` | Cloud Scheduled Function | Restore mensal automatizado do backup mais recente em ambiente isolado + geração de relatório estrutural (RF-04/RF-05). |
| `functions/src/lib/backupNotifications.ts` | Helper | Envio de alerta em caso de falha do job diário de export (RF-07). |
| `ONLY_FOR_DEVS/RUNBOOK-BACKUP-RESTORE.md` (candidato, fora do escopo deste ADR) | Runbook | Roteiro para o humano executar e registrar a validação manual mensal do restore (RF-06). |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `functions/src/index.ts` | Exportar as novas Scheduled Functions (`scheduledFirestoreBackup`, `scheduledStorageBackup`, `scheduledRestoreValidation`). |
| `functions/package.json` | Adicionar dependências necessárias para export/import programático (ex.: `@google-cloud/firestore` para a API Admin de export/import, `@google-cloud/storage` se a réplica de arquivos for feita via Function em vez de Storage Transfer Service). |
| `firebase.json` | Nenhuma mudança obrigatória identificada nesta elicitação para as Scheduled Functions em si; a ser confirmado na implementação se alguma configuração adicional de IAM/Scheduler precisa ser declarada aqui. |

### 5.3 Arquivos a REMOVER

N/A — nenhuma remoção prevista por este ADR. (Observação à parte, sem ação: `functions/src/index.ts.backup` é lixo pré-existente de uma tentativa abandonada de feature de licenciamento/PagBank, sem relação com este ADR — não deve ser tocado por esta implementação.)

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| Todas as coleções de produção (`tenants/{tenantId}/*` e coleções top-level: `users`, `tenants`, `consultants`, `products`, `legal_documents`, `access_requests`, etc.) | Leitura completa (export) | Sem alteração de schema — o export é somente leitura sobre o Firestore de produção; nenhuma escrita é feita em produção por este mecanismo. |
| Banco de dados Firestore secundário (multi-database, isolado — usado apenas no restore de teste mensal) | Escrita (import mensal) | Populado a cada ciclo de teste mensal e descartado/limpo em seguida; nunca é o Firestore de produção nem o ambiente compartilhado de dev. |

### 5.5 O que NÃO muda

- Nenhuma coleção de produção é alterada por este ADR — o backup é estritamente somente-leitura sobre o Firestore de produção.
- O fluxo de importação de NF-e via XML (`src/lib/parseNfeXml.ts`, `src/app/api/parse-nf-xml/route.ts`, `src/lib/services/nfImportService.ts`) permanece inteiramente inalterado.
- Nenhuma regra de acesso de usuário final em `firestore.rules` ou `storage.rules` é alterada — o acesso ao bucket de backup é gerenciado via IAM do GCP, fora do escopo das Security Rules do Firebase usadas pelo app.
- `functions/src/index.ts.backup` permanece como está — lixo pré-existente, fora de escopo desta implementação.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — este ADR não introduz nenhum campo novo em documentos Firestore de produção. O único "dado novo" são objetos no Cloud Storage (arquivos de export do Firestore e metadata de execução), fora do modelo de dados da aplicação.

### 6.2 Mudanças em serviços

Esboço ilustrativo (não normativo — a implementação real fica para quando a task for priorizada):

```ts
// functions/src/scheduledFirestoreBackup.ts (ilustrativo)
import { onSchedule } from "firebase-functions/v2/scheduler";
import { FirestoreAdminClient } from "@google-cloud/firestore/v1"; // ou API equivalente

export const scheduledFirestoreBackup = onSchedule(
  {
    schedule: "0 3 * * *", // diário, 03:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1", // mesma convenção das demais Functions do projeto
  },
  async () => {
    const client = new FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId!, "(default)");
    const today = new Date().toISOString().slice(0, 10);
    await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: `gs://curva-mestra-backups-southamerica-west1/firestore/${today}`,
      // sem collectionIds => export completo de todas as coleções
    });
  }
);
```

```ts
// functions/src/scheduledRestoreValidation.ts (ilustrativo)
import { onSchedule } from "firebase-functions/v2/scheduler";

export const scheduledRestoreValidation = onSchedule(
  {
    schedule: "0 4 1 * *", // mensal, dia 1, 04:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
  },
  async () => {
    // 1. Localizar o export mais recente no bucket de backup (southamerica-west1)
    // 2. gcloud firestore import (API equivalente) para um banco Firestore secundário isolado
    // 3. Verificações estruturais: contagem de documentos por coleção, presença de coleções-chave
    // 4. Gerar relatório e notificar o responsável para validação humana (RF-06)
  }
);
```

### 6.3 Mudanças na UI

N/A — nenhuma tela de produto é criada ou alterada por este ADR. É exatamente por não haver UI/ator humano de produto envolvido que este item foi tratado como ADR, e não como o UC-54 originalmente reservado no mapa de bugs (Seção 7.1 de `_MAPA-DE-BUGS-E-MELHORIAS.md`).

### 6.4 Mudanças em API Routes

N/A — nenhuma API route do Next.js é criada ou alterada. Toda a lógica vive em Cloud Scheduled Functions, fora do runtime do Next.js.

---

## 7. Plano de Implementação

**Este plano é candidato, para quando a implementação for priorizada — nenhum step abaixo deve ser executado agora**, conforme a decisão de prioridade desta elicitação (RN-05).

### STEP 1 — Provisionar bucket de backup em `southamerica-west1` + service account dedicada

**Objetivo:** Ter a infraestrutura base (bucket + permissões IAM) pronta para receber os exports.

**Arquivos afetados:** Nenhum arquivo de código — provisionamento via Console GCP/Terraform/`gcloud`, fora do repositório de aplicação.

**Ações:**
1. Criar o bucket de backup em `southamerica-west1` (Santiago, Chile), conforme decisão fechada em RN-07/Seção 4.1.
2. Criar/configurar a service account usada pelas Scheduled Functions, com permissão de `datastore.exportAdmin`/`datastore.importAdmin` e leitura/escrita apenas nesse bucket.
3. Confirmar que o bucket não tem acesso público (RNF-01).

**Validação:** Uma execução manual de teste de `gcloud firestore export` para o bucket criado, usando a service account configurada, é bem-sucedida.

**Commit:** `chore(infra): provisiona bucket de backup cross-region e service account dedicada`

### STEP 2 — Scheduled Function diária de export do Firestore

**Objetivo:** Automatizar o export diário completo do Firestore de produção (RF-01).

**Arquivos afetados:**
- `functions/src/scheduledFirestoreBackup.ts` — nova Scheduled Function.
- `functions/src/index.ts` — exportar a nova função.
- `functions/package.json` — adicionar dependência do client de Firestore Admin, se necessário.

**Ações:**
1. Implementar a função conforme esboço da Seção 6.2.
2. Configurar alerta de falha (RF-07, via `backupNotifications.ts`).

**Validação:** Após deploy, aguardar a primeira execução agendada (ou disparar manualmente via `firebase functions:shell`) e confirmar, no bucket, a presença de um export completo e íntegro.

**Commit:** `feat(functions): adiciona scheduled function de export diario do Firestore`

### STEP 3 — Réplica diária dos arquivos de NF-e (`/danfe`)

**Objetivo:** Cobrir o Cloud Storage (arquivos XML de NF-e já enviados) no backup, não apenas o Firestore (RF-02).

**Arquivos afetados:**
- `functions/src/scheduledStorageBackup.ts` (se optar por Cloud Function) **ou** configuração de Cloud Storage Transfer Service (fora do código de `functions/`, provisionada via Console/`gcloud`).

**Ações:**
1. Decidir, na implementação, entre Cloud Storage Transfer Service (preferível, gerenciado) ou Cloud Function customizada.
2. Configurar a réplica diária de `/danfe/{tenantId}/{nfId}` para o bucket secundário em `southamerica-west1`.

**Validação:** Confirmar que um arquivo de NF-e enviado no dia anterior aparece replicado no bucket secundário após a execução do job.

**Commit:** `feat(functions): adiciona replicacao diaria do bucket de NF-e (/danfe) para regiao secundaria`

### STEP 4 — Lifecycle rule de retenção de 90 dias

**Objetivo:** Garantir a exclusão automática de exports/arquivos com mais de 90 dias, sem rotina manual (RF-03/RN-01).

**Arquivos afetados:** Nenhum arquivo de código — configuração de lifecycle rule no bucket via Console/`gcloud`/Terraform.

**Ações:**
1. Configurar a lifecycle rule (`age: 90`, ação `Delete`) no bucket de backup do Firestore e no bucket secundário de arquivos NF-e (ambos em `southamerica-west1`).

**Validação:** Confirmar, via `gsutil lifecycle get gs://<bucket>`, que a regra está ativa e com a condição correta.

**Commit:** `chore(infra): configura lifecycle rule de retencao de 90 dias no bucket de backup`

### STEP 5 — Scheduled Function mensal de restore automatizado + validação

**Objetivo:** Implementar a parte automatizada do processo híbrido de restore testado mensalmente (RF-04/RF-05).

**Arquivos afetados:**
- `functions/src/scheduledRestoreValidation.ts` — nova Scheduled Function.
- `functions/src/index.ts` — exportar a nova função.

**Ações:**
1. Implementar a função conforme esboço da Seção 6.2, restaurando para um banco Firestore secundário isolado (RNF-03/RN-03).
2. Implementar as verificações estruturais (contagem de documentos, coleções-chave) e a geração do relatório.
3. Configurar o envio do relatório para o responsável pela validação humana (RF-06).

**Validação:** Disparar manualmente a função uma vez e confirmar que o relatório gerado reflete corretamente o conteúdo do export mais recente, sem qualquer escrita em produção.

**Commit:** `feat(functions): adiciona scheduled function mensal de restore automatizado e validacao`

### STEP 6 — Runbook de validação manual humana

**Objetivo:** Documentar o processo que o humano segue para completar a validação mensal (RF-06/RN-04).

**Arquivos afetados:**
- `ONLY_FOR_DEVS/RUNBOOK-BACKUP-RESTORE.md` (novo).

**Ações:**
1. Documentar o passo a passo: onde encontrar o relatório automatizado, o que checar manualmente, e onde registrar a confirmação mensal.

**Validação:** Um dev consegue seguir o runbook do início ao fim sem precisar de contexto adicional.

**Commit:** `docs(devs): adiciona runbook de validacao manual do restore mensal`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| Helper de comparação estrutural do restore (ex.: `compareCollectionCounts`, se extraído como função pura em `backupNotifications.ts` ou módulo próprio) | `functions/src/__tests__/backupValidation.test.ts` (candidato) | Contagens iguais (sucesso); contagem divergente em uma coleção (deve sinalizar falha); coleção esperada ausente no restaurado (deve sinalizar falha). |
| `scheduledFirestoreBackup`, `scheduledStorageBackup`, `scheduledRestoreValidation` (as próprias Scheduled Functions) | N/A | **Não testar automaticamente no MVP** — dependem diretamente das APIs Admin do Firestore/Storage sem abstração injetável, mesmo critério de "mock frágil" já adotado em todo o restante do projeto (ver `ADR-automacao-qa-playwright-firebase-emulator.md`). Validação por execução manual documentada nos STEPs 2, 3 e 5. |
| Configuração de infraestrutura (bucket, lifecycle rule, IAM) | N/A | Config/infra — não se testa com testes automatizados; validação via `gsutil`/Console conforme os STEPs 1 e 4. |

Funções puras de cálculo/validação, se extraídas durante a implementação real, devem sempre ser testadas — mesmo critério já estabelecido no projeto para lógica pura.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings (quando implementado)
[ ] npm run type-check  — zero erros TypeScript (quando implementado)
[ ] npm run build       — build de produção sem falhas (quando implementado)
[ ] npm run test        — testes novos (função pura de comparação estrutural, se extraída) passando
[ ] Bucket de backup criado em southamerica-west1, com lifecycle rule de 90 dias configurada e validada (STEP 1/4)
[ ] Scheduled Functions usando a região southamerica-east1 (mesma convenção do restante do projeto) para execução, com destino do export em southamerica-west1
[ ] Nenhuma credencial ou chave de service account hardcoded no código (uso de IAM padrão)
[ ] Restore mensal automatizado testado ao menos uma vez em ambiente isolado, sem qualquer escrita em produção
[ ] Validação humana do restore mensal documentada e registrada (runbook, STEP 6)
[ ] Alerta configurado para falha do job diário de export (RF-07)
[ ] Multi-tenant: o export cobre a estrutura tenants/{tenantId}/... por completo, sem filtro que exclua tenants
[ ] Branch pessoal: task branch mergeada na branch pessoal (gscandelari_setup) para validação no Firebase
[ ] PR: aberto para develop com template preenchido
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Falha silenciosa do job diário de export, sem ninguém perceber por dias/semanas | Média | Alto | RF-07: alerta explícito de falha (log estruturado + notificação), não apenas log passivo. |
| Custo crescer de forma descontrolada conforme o Firestore de produção cresce (exports completos diários, não incrementais) | Média | Médio | Revisar periodicamente a classe de armazenamento (Coldline/Nearline) e considerar, no futuro, uma estratégia incremental caso o volume de dados justifique (ver alternativa descartada em 4.2, revisitável mais adiante). |
| Restore automatizado dar "falso positivo" — contagens batem, mas dados corrompidos/inconsistentes semanticamente | Média | Alto | RN-04: validação humana final é obrigatória todo mês, não apenas a checagem estrutural automatizada. |
| Réplica cross-region para `southamerica-west1` (Chile) envolver, tecnicamente, uma transferência de dados para outro país (ainda que dentro da América do Sul) | Baixa | Baixo | Decisão já fechada (RN-07): dado replicado é estritamente operacional, sem dado de paciente; a escolha por `southamerica-west1` em vez de uma região fora do continente já foi feita justamente para minimizar esta consideração. |
| Um incidente regional que afete simultaneamente toda a infraestrutura GCP da América do Sul (`southamerica-east1` e `southamerica-west1`) não seria coberto por esta réplica | Baixa | Alto | Trade-off aceito explicitamente (ver Seção 4.3) em favor de custo menor e simplicidade de compliance; pode ser revisitado no futuro se o risco deixar de ser aceitável. |
| Este ADR ser esquecido em `TO_DO/` por ser de baixa prioridade e nunca ser retomado, deixando a promessa da landing page permanentemente descoberta | Média | Médio | Já cross-referenciado no mapa de bugs (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1, item antes reservado como UC-54); recomenda-se citar este ADR explicitamente na próxima vez que o `uc-issues-tracker`/backlog for revisado para priorização. |
| Restore de teste mensal, por erro de implementação, acabar escrevendo no Firestore de produção ou no ambiente compartilhado de dev | Baixa | Alto | RNF-03/RN-03: uso obrigatório de um banco de dados Firestore secundário isolado (multi-database ou projeto dedicado), nunca o `(default)` de produção nem o `curva-mestra-dev` compartilhado. |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `gcloud firestore export` / `import` | Comando gerenciado do Google Cloud (API `FirestoreAdmin.ExportDocuments`/`ImportDocuments`) para exportar/importar todo ou parte de um banco Firestore para/de um bucket do Cloud Storage, sem downtime do banco de origem. |
| Cloud Scheduler | Serviço gerenciado de cron jobs do GCP, usado para disparar Cloud Functions (`onSchedule`) em horários agendados — mecanismo de trigger deste ADR para os jobs diário e mensal. |
| Lifecycle rule (Cloud Storage) | Regra configurada em um bucket do GCS que aplica ações automáticas (ex.: exclusão) a objetos que atendem a uma condição (ex.: idade maior que 90 dias) — usada aqui para a retenção automática de 90 dias. |
| Cloud Storage Transfer Service | Serviço gerenciado do GCP para replicar/mover objetos entre buckets, inclusive entre regiões, de forma agendada — candidato preferido para a réplica diária dos arquivos de NF-e. |
| Firestore multi-database | Recurso do Firestore que permite múltiplos bancos de dados independentes dentro do mesmo projeto GCP — usado neste ADR para isolar o restore de teste mensal do banco `(default)` de produção. |
| Restore testado mensalmente (processo híbrido) | Processo que combina automação (Cloud Function mensal restaura o backup mais recente em ambiente isolado e roda checagens estruturais) e validação humana final — nenhuma das duas partes substitui a outra. |
| `/danfe/{tenantId}/{nfId}` | Path real de armazenamento no Cloud Storage dos arquivos de NF-e (hoje, XML — antes, PDF/DANFE legado), conforme `storage.rules`. |
| `southamerica-west1` | Região do GCP em Santiago, Chile — escolhida como região secundária do bucket de backup (RN-07), por ser mais próxima/barata que uma região fora do continente e por manter a réplica dentro da América do Sul. |

---

## 12. Referências

- `public/landing/sections-trust.jsx` — origem da promessa "Backup geográfico diário — Cópia criptografada em região distinta, com retenção de 90 dias e restore testado mensalmente" (componente `Security`, `pillars`, item 6; reforçada na `FAQ`).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1 (v3.13) — item antes reservado como candidato a **UC-54** ("Backup Geográfico Automatizado"), agora tratado como este ADR em vez de UC formal, pela ausência de ator humano/tela e pela natureza de decisão técnica de infraestrutura.
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` — ADR de referência de formato/estrutura para este documento (único ADR existente no projeto antes deste).
- `CLAUDE.md` — declara o princípio "Zero DevOps" contrariado conscientemente por este ADR (RN-06), e a decisão já registrada de que a importação de NF-e é hoje exclusivamente via XML NF-e SEFAZ v4.00 (relevante para confirmar o path `/danfe/{tenantId}/{nfId}` como alvo real de backup de arquivos).
- `firebase.json` — confirma a ausência de qualquer configuração de backup/export hoje; confirma a convenção de projetos (`curva-mestra`/`curva-mestra-dev`) via `.firebaserc`.
- `storage.rules` — confirma o path real `/danfe/{tenantId}/{nfId}` e as regras de acesso hoje vigentes para arquivos de NF-e.
- `functions/src/index.ts` — confirma a ausência de qualquer `onSchedule` hoje no projeto e a convenção de região `southamerica-east1`.
- `functions/src/index.ts.backup` — arquivo stale citado apenas como observação lateral (exports órfãos de uma tentativa abandonada de licenciamento/PagBank), sem relação funcional com este ADR.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — convenções de Git Flow e Conventional Commits seguidas na Seção 0 deste documento.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 24/07/2026 | Doc Writer (Claude) | Versão inicial. Registra a decisão de arquitetura para o Backup Geográfico Automatizado (Firestore + Cloud Storage), a partir da promessa não cumprida da landing page (`sections-trust.jsx`) e do item antes reservado como candidato a UC-54 no mapa de bugs (Seção 7.1). Decisões fechadas nesta elicitação: mecanismo técnico (`gcloud firestore export` + Cloud Scheduler + Cloud Function), escopo (Firestore + Cloud Storage `/danfe/{tenantId}/{nfId}`), retenção de 90 dias via lifecycle rule, processo híbrido de restore mensal (automação + validação humana), aceitação explícita do custo recorrente de infraestrutura, e prioridade baixa (documentar agora, implementar depois). Única decisão explicitamente pendente: a região secundária exata do bucket de backup (Seção 4.1, ⚠️ decisão necessária). |
| 1.1 | 24/07/2026 | Doc Writer (Claude) | Fechada a última decisão pendente (Seção 4.1): região secundária do bucket de backup definida como `southamerica-west1` (Santiago, Chile) — mais próxima e mais barata que uma região fora da América do Sul, e evita transferência de dados para fora do continente. Nova RN-07 registrando a decisão; alternativa `us-east1` movida para "Alternativas descartadas" (Seção 4.2, com motivo); novo trade-off aceito documentado na Seção 4.3 (réplica dentro do continente vs. postura de DR intercontinental); esboço de código (Seção 6.2) e STEPs 1/3/4 (Seção 7) atualizados com a região concreta; novo item de risco na Seção 10 sobre a réplica cross-country dentro da América do Sul; glossário (Seção 11) ganhou entrada para `southamerica-west1`. Sem nenhuma decisão em aberto remanescente, o **Status do documento no cabeçalho passou de "Planejamento — decisão de arquitetura fechada" para "Aprovado — decisões de arquitetura fechadas"**, mesmo critério já usado nos UCs recentes (decisões de design fechadas, implementação ainda pendente). |
