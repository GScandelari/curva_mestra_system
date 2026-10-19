# Curva Mestra

Sistema SaaS Multi-Tenant para Clínicas de Harmonização Facial e Corporal — gestão inteligente de estoque Rennova via importação de XML de NF-e, com controle de lotes, validades, licenças e consumo por paciente.

**Responsável:** Guilherme Stanke Scandelari ([@GScandelari](https://github.com/GScandelari))

---

## Stack

100% Firebase (Google Cloud) — Next.js 15 (App Router) + TypeScript + Tailwind CSS + Shadcn/ui, Firebase Functions, Firestore, Auth, Storage. Detalhes completos de arquitetura e convenções em [`CLAUDE.md`](./CLAUDE.md).

## Rodando localmente

```bash
npm install

# Com emuladores Firebase (recomendado para desenvolvimento)
firebase emulators:start
npm run dev

# Outros comandos úteis
npm run lint          # ESLint
npm run type-check    # TypeScript sem erros
npm run test          # Jest
npm run format        # Prettier
```

---

## Fluxo de Trabalho

### Branches

| Branch                    | Finalidade                                                   |
| ------------------------- | ------------------------------------------------------------ |
| `master`                  | Produção — protegida, exige CI + 1 aprovação                 |
| `develop`                 | Integração — protegida, exige CI + 1 aprovação               |
| `gscandelari_setup`       | Branch pessoal de validação (Guilherme) — exige CI           |
| `feat/`, `fix/`, `chore/` | Branches de tarefa — efêmeras, criadas a partir de `develop` |

### Ciclo de uma tarefa

```
develop → task branch → PR → dev branch → validar → PR → develop → PR → master
```

1. Criar branch a partir de `develop`: `git checkout -b feat/nome-da-tarefa`
2. Desenvolver e commitar seguindo Conventional Commits
3. Abrir PR da task branch para a **branch pessoal** (`gscandelari_setup`)
4. CI roda automaticamente — validar no ambiente de preview
5. Abrir PR da branch pessoal para `develop`
6. CI + aprovação obrigatória — auto-merge habilitado após aprovação
7. Abrir PR de `develop` para `master`
8. CI + aprovação obrigatória — merge dispara release automático (release-please), que também sincroniza `develop` com `master` automaticamente (job `sync-develop`) — não é preciso mesclar `master` em `develop` manualmente antes da próxima PR

> **Regra:** o merge nunca é feito manualmente antes do PR. O PR **é** o mecanismo de merge.

### Conventional Commits

```
feat:   nova funcionalidade
fix:    correção de bug
chore:  manutenção, CI, dependências
docs:   documentação
```

---

## CI/CD

### Pipelines

| Pipeline                     | Gatilho                                           | Jobs                                               |
| ---------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| **CI Pipeline**              | push/PR em `master`, `develop`, branches pessoais | Linting, Type Check, Build, Unit Tests             |
| **Security & Quality Check** | push/PR em `master`, `develop`, branches pessoais | Security Audit, Code Quality Analysis (SonarCloud) |
| **Deploy Firebase**          | push em `master`                                  | Deploy produção                                    |
| **Deploy Dev**               | push nas branches pessoais                        | Deploy ambiente de preview                         |
| **Release**                  | push em `master`                                  | release-please (bump de versão + CHANGELOG)        |

### Qualidade

- **SonarCloud** — análise de qualidade e cobertura a cada push
- **Husky + lint-staged** — Prettier executa automaticamente nos arquivos staged antes de cada commit
- **Branch protection** — nenhum merge em `master` ou `develop` sem CI verde e aprovação

---

## Ambientes

| Ambiente      | URL                       | Branch              |
| ------------- | ------------------------- | ------------------- |
| Produção      | `(Firebase Hosting)`      | `master`            |
| Dev Guilherme | `dev-gscandelari.web.app` | `gscandelari_setup` |

---

## Roadmap e Backlog Técnico

O sistema mantém um mapa vivo de bugs, achados de segurança, débitos técnicos e decisões de produto pendentes, consolidado a partir dos 59 Casos de Uso documentados em [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/). É a fonte de verdade para priorização de próximas correções e melhorias.

📋 **Mapa completo:** [`_MAPA-DE-BUGS-E-MELHORIAS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md)

**Resumo (v3.59, 19/10/2026):**

| Severidade | Aberto | Corrigido | Descartado | Total   |
| ---------- | ------ | --------- | ---------- | ------- |
| Crítica    | 0      | 5         | 1          | 6       |
| Alta       | 0      | 33        | 1          | 34      |
| Média      | 3      | 46        | 1          | 50      |
| Baixa      | 53     | 55        | 1          | 109     |
| **Total**  | **56** | **139**   | **4**      | **199** |

- ✅ **Nenhum item Aberto de severidade Crítica ou Alta neste mapa** — todos os 6 achados críticos e os 34 de Alta já têm status final ou decisão registrada (33 corrigidos e documentados, 1 descartado por decisão de produto). Destaques recentes: **`UC-46-RN-03`/`RN-04`** (13/08/2026) — `/clinic/consultant/transfer` quebrada foi removida e substituída por `/clinic/consultant/invite` (UC-54). **`UC-21-RN-08`** (21/09/2026) — client de `POST /api/tenants/create` passou a enviar o header `Authorization` (commit `a9449a3`), que faltava e bloqueava todo cadastro real de clínica com administrador. **`UC-32-RN-08`** (27/09/2026, PR #297, commit `0929833`) — regra dedicada de `collectionGroup` para `inventory` em `firestore.rules` e log do erro em `isMasterProductInUse`, validados contra o Firebase Emulator Suite. **`UC-42-RN-11`** (29/09/2026, PR #307, commit `33bcd47`, release v1.9.1) — guard `admin.initializeApp()` corrige `checkAlertsScheduled`, que quebrava em toda execução real em dev/produção. **O achado estrutural de segurança do `firestore.rules` (`UC-13-RN-09`/`UC-15-RN-07`)** (02/10/2026, PR #344, commits `f3ce046`+`94cbe2e`, deploy confirmado em `curva-mestra-dev`) — a regra genérica de subcoleção do tenant deixou de conceder `write` irrestrito (passou a `tenants/{tenantId}/{collectionId}/{document=**}`), tornando efetivas de verdade as regras dedicadas de `inventory`, `stock_limits` e `protocolos`; dois achados novos já nascidos corrigidos na mesma varredura (`UC-16-RN-10`, `UC-10-RN-11`). **`UC-04-RN-11`** (ex-`UC-04-Q4`, 03/10/2026, PR #349, commits `c287322`+`55f0297`) — último item Alta em aberto: race condition em `src/app/(auth)/login/page.tsx` que impedia a exibição do card "Sistema Indisponível" para um `clinic_user` de clínica suspensa (Fluxo de Exceção 8d); corrigida com o guard `loginInProgressRef`, que impede o `useEffect` reativo de redirecionamento de navegar durante uma submissão manual de login em andamento. UC-04 atualizado para v1.3. **`UC-56-RN-10`/`UC-02-RN-07`** (08/10/2026, PR #371, release 1.13.0) — achado novo já nascido corrigido: a clínica aprovada a partir de uma solicitação com código de consultor não era vinculada a esse consultor e não aparecia em "Minhas Clínicas".
- 🧹 **19 itens de severidade Baixa corrigidos e documentados** (07/10/2026, release **v1.11.0**) — dois patches de correções pequenas já mergeados em `gscandelari_setup → develop → master`: **PR #354** (branch `chore/patch-10-correcoes-baixa-severidade`, 10 IDs: `UC-41-RNF-04`, `UC-49-RN-03`, `UC-46-RN-02`, `UC-15-RN-06`, `UC-37-RN-07`, `UC-37-RN-08`, `UC-30-RN-07`, `UC-34-RN-02`, `UC-50-RN-04`, `UC-47-RN-01`) e **PR #355** (branch `chore/patch-10-correcoes-baixa-severidade-2`, 9 IDs: `UC-33-RN-01`, `UC-33-RN-02`, `UC-29-RN-05`, `UC-19-RN-06`, `UC-26-RN-01`, `UC-27-RN-03`, `UC-20-RN-06`, `UC-39-RN-01`, `UC-12-RN-01`) — cobrindo achados de UX (feedback de erro silencioso, falta de confirmação antes de ações irreversíveis, textos desatualizados) e débito técnico (validação client-side ausente, interfaces TypeScript incompletas, duplicidade não verificada) em 16 UCs diferentes. Um 20º achado, `UC-09-RNF-03` (mesmo PR #355), foi corrigido apenas **parcialmente**: a tradução de erros do Firestore (novo helper `src/lib/firestoreErrors.ts`) foi aplicada só à Variante A (`/accept-terms`) do fluxo de aceite de termos — a Variante B (`/clinic/setup/terms`) continua exibindo erros crus, pendência residual registrada como `UC-09-RNF-03b`.
- 🛡️ **3 achados de segurança de 09/10/2026 corrigidos** (validados pelo usuário em dev em 14/10/2026 e verificados em código; status **Corrigido e Documentado**: UC-48 v1.2, UC-52 v1.3 e UC-10 v1.2 já refletem a correção): **`UC-48-RN-06`** (Média): a leitura do consultor em `firestore.rules` passou de blocklist para allowlist (`consultantReadableSubcollection`: `inventory`, `stock_limits`, `solicitacoes`), PR #389/#391. **`UC-10-RN-12`** (Média): a rota legada `/api/parse-nf` foi removida e `pdf-parse`/`pdfjs-dist`/`@napi-rs/canvas` desinstalados, PR #390. **`UC-10-RN-13`** (Baixa): `/api/parse-nf-xml` exige token de `clinic_admin` ativo e aceita um único `.xml` de até 10MB, PR #390. A decisão de produto sobre o filtro de marca dentro de `inventory` (`UC-48-RN-06-Decisão`) continua aberta
- 🧾 **Bugfix de identidade e duplicidade de NF-e entregue** (15/10/2026, PR #393 em `gscandelari_setup` e PR #394 em promoção para `develop`; validado em dev e verificado em código; status **Corrigido e Documentado**: UC-10, UC-11 e UC-12 v2.0, UC-31 v1.1, UC-32 v1.3, UC-44 v1.3.0 e UC-50 v1.3). Itens fechados: **`UC-10-RN-14`** (Média), **`UC-10-RN-15`** (Baixa), **`UC-11-RN-12`** (Baixa) e **`UC-12-RN-03`** (Baixa). A NF passa a ser identificada por CNPJ do emitente + série + número, nos dois caminhos. A confirmação é atômica no servidor (Admin SDK), com ID sequencial por clínica a partir de 1000. Os zeros à esquerda são normalizados, XML e manual se bloqueiam mutuamente, e as pendências entram no estoque automaticamente quando o produto é ativado no catálogo, com notificação à clínica. Também foram registrados 5 achados da investigação, já nascidos corrigidos: `UC-10-A1` a `UC-10-A5` (1 Alta, 2 Média, 2 Baixa)
- 📦 **Feature de pendências de NF-e fora do padrão, pendência manual, recusa e checagem antecipada entregue** (16/10/2026, PR #396 em `gscandelari_setup` e PR #397 em `develop`; validada em dev; status **Corrigido e Documentado**: UC-10, UC-11 e UC-12 v2.1, UC-31 v1.2, UC-32 v1.4 e UC-44 v1.4.0). Itens fechados: **`UC-31-Q3`** (Baixa): o catálogo aceita de 5 a 8 dígitos; um código fora do padrão vira pendência própria, só com "Recusar", e com alerta no novo sino do system_admin; o prefill não trunca mais. **`UC-11-RN-06`** (Baixa): a duplicidade é verificada no Passo 2 do manual e no preview do XML. O system_admin também passa a poder recusar qualquer pendência, com motivo e aviso à clínica
- 🔐 **Ajustes no registro de acesso e busca de clínicas pelo consultor entregues** (17/10/2026, PR #402 em `gscandelari_setup` e PR #403 em `develop`; validados em dev; UC-01 v2.4, UC-02 v2.5, UC-03 v1.3.2, UC-24 v1.1, UC-25 v2.1 e UC-56 v1.5). A decisão **`UC-02-Q1`** foi resolvida pela opção (d): o especialista volta a informar CPF/CNPJ no registro, e o tenant nasce com o documento. Dois achados de segurança foram registrados já corrigidos: **`UC-01-F1`** (Média), criação de solicitação de acesso só pelo servidor, e **`UC-24-F5`** (Baixa), busca só para consultor ativo. ⚠️ **Pendência operacional:** a rule `access_requests create: if false` ainda precisa ser publicada manualmente em produção, só depois do hosting.
- 🩺 **Bugfix do formulário de procedimento e feature de último acesso entregues** (19/10/2026, PR #406 e PR #407 em `gscandelari_setup`; validados em dev). No formulário `/clinic/requests/new`, "Observações" virou multilinha, e o detalhe do procedimento preserva as quebras de linha. A validade do lote no "Lote Utilizado" passou a sair em `dd/mm/aaaa` (UC-16 v1.3.2, UC-17 v1.1.1, UC-18 v1.2.2). Novo **UC-59** (Implementado, com caderno E2E): coluna "Último acesso" em `/admin/users` e `/admin/consultants`. O UC-58 (precificação pela hora clínica) entrou no índice do mapa.
- 🧪 **Itens novos Abertos** (19/10/2026): **`UC-16-Q7`** (Baixa): a etapa "Revisão" do formulário de procedimento mostra observações com várias linhas numa linha só (só exibição). **`UC-18-Q8`** (Baixa, depende de decisão de produto): na edição de procedimento agendado, apagar todo o texto de "Observações" ou "Descrição" não limpa o valor gravado
- 🧪 **Itens novos Abertos** (17/10/2026): **`UC-03-Q2`** (Média): a rejeição pela tela do admin não envia e-mail, embora o toast diga que o solicitante será notificado. **`UC-01-CNPJ-ALFA`** (Baixa): CNPJ alfanumérico não é aceito no registro, na aprovação, no admin, no setup nem na busca. **`UC-02-Q2`** (Baixa): a checagem de duplicidade de documento na aprovação não é transacional. **`UC-24-F6`** (Baixa): o vínculo do consultor não confere se ele está ativo. **`UC-24-F7`** (Baixa): a busca por documento ignora o campo legado `cnpj`. **`UC-24-Q5`** (Baixa, mantido por ora pelo usuário): palavras de uma letra casam com quase tudo na busca por nome. **`UC-25-Q5`** (Baixa): o UC-25 está desatualizado e precisa de revisão própria. **`UC-45-F4`** (Baixa): o setup da clínica não checa duplicidade de documento
- 🧪 **Itens novos Abertos** (15 e 16/10/2026): **`UC-32-Q9`** (Média): o guard "produto em uso" do catálogo master (UC-32 RN-01/RN-02) ignora itens de estoque vindos de XML ou da incorporação automática, que não gravam `master_product_id`; o comportamento é anterior ao PR #393. **`UC-09-E2E-VarB`** (Média): o teste E2E do onboarding com termos pendentes (`/clinic/setup/terms`) falha em `develop`, com causa ainda não investigada, e afeta a confiabilidade do gate de CI. **`DEV-EMULADOR-FUNCTIONS-REGIAO`** (Baixa): no emulador, `src/lib/firebase.ts` cria `functions` sem região, então as callables `southamerica-east1` não funcionam localmente. **`UC-18-Q6`** (Baixa): nomes de campo divergentes entre o wrapper de edição de procedimento e a tela de edição deixam código/nome do produto vazios em alguns casos. **`UC-10-F3`** (Baixa): o tipo `NFImport` em `src/types/nf.ts` está desatualizado em relação ao documento que o servidor grava. **`UC-12-Q6`** (Baixa, documentação): o sino do system_admin não tem UC próprio e hoje está documentado no UC-12. **`UC-12-Q7`** (Baixa, questão de produto): não há tela que liste pendências recusadas ou resolvidas, e o sino do admin não permite excluir alertas
- 🗂️ **10 decisões de produto pendentes** (`UC-02-Q1` foi decidida e implementada em 17/10/2026), incluindo `UC-12-Decisão-Expiração` (pendência de produto que nunca entra no catálogo master fica aberta para sempre; definir expiração/descarte). Desde 15/10/2026, a incorporação automática cobre o produto que entra no catálogo depois. Desde 16/10/2026, a ação "Recusar" (com motivo e aviso à clínica) permite encerrar pendências manualmente, mas ainda não existe expiração automática. `UC-10-RN-02` (regras de duplicidade de NF-e) passou a parcialmente decidida. O item de infraestrutura `ADR-QA-AUTOMATION` foi implementado de ponta a ponta em 17/08/2026, ver Seção 6 do mapa. Também há **16 itens de código morto/rotas órfãs** catalogados sem severidade atribuída (ver Seções 4.1 e 5 do mapa)
- 🆕 **3 features aprovadas pelo PO, já implementadas e em produção** (Seção 4.2 do mapa, release **1.13.0**, 08/10/2026 — PRs #369, #370, #371, #372): `UC-01-RN-08` (código do consultor validado contra `consultants`, substituindo o campo de texto livre), `UC-56` (Consultor Rennova aprova solicitação vinculada ao próprio código, janela de exclusividade de 2 dias corridos/48h) e `UC-57` (Scheduled Function diária notifica o consultor sobre solicitações pendentes vinculadas ao seu código) — sem impacto na tabela de severidade acima. Dois achados novos já nascidos corrigidos na mesma rodada: `UC-56-RN-10`/`UC-02-RN-07` (Alta, PR #371) e `UC-54-RN-09` (Baixa — consultor inativo exibido como "não encontrado" na tela de convite, PR #376)
- 🔎 **12 gaps entre a landing page comercial e o sistema real** catalogados (Seção 7 do mapa) — 4 com decisão de implementar, **100% documentados**: **UC-51, UC-52 e UC-53 já escritos e aprovados**; o item de Backup Geográfico Automatizado (antes reservado como UC-54, número hoje reaproveitado pelo UC-54 real "Convidar Consultor para a Clínica") foi documentado como **ADR aprovado** — 5 com decisão de corrigir apenas o texto da landing (baixa prioridade) e 3 com decisão adiada
- ✉️ **1 UC fora do fluxo normal de UC, já escrito e aprovado** (Seção 8.1 do mapa): `UC-55` ("Editar Templates de E-mail (System Admin)", v1.1), nascido de pedido direto do usuário após observar que o corpo do e-mail de aprovação de acesso (UC-02) "precisa de uma revisão geral" — escopo fechado: Firestore (`email_templates/{tipo}`) como fonte única de verdade para os 13 gatilhos de e-mail com chamador ativo, editor por gatilho com preview/teste/versionamento, correção da duplicidade UC-02/UC-28 e migração de UC-03 para o mesmo Firestore
- 🎨 **1 registro de divergências de padrão visual de UI** (Seção 8.2 do mapa), pedido direto do usuário: auditoria do subagente `ui-consistency-auditor` contra `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-VISUAL-UI.md` (v1.0) — 70 telas avaliadas, 13 arquivos `page.tsx` + 2 layouts compartilhados (Admin/Consultor) com divergência confirmada frente ao padrão shadcn/ui já dominante; destaques: fundo `bg-[#f5f3ef]` hardcoded em Admin/Consultor (vs. token `bg-background` da Clínica), dashboards Admin/Clínica com `<h2>` em vez de `<h1>`, 5 telas de configuração do Admin sem a classe `container`, `Input` reimplementado manualmente (4 ocorrências) e `Badge` sem variante `success`/`info`. Status Aberto, sem decisão de priorização ainda tomada
- 🔐 **1 pedido de produto novo** (Seção 8.3 do mapa), surgido durante o planejamento da correção de segurança de `firestore.rules` (branch `bugfix/firestore-rules-tenant-role-enforcement`, relacionada a `UC-13-RN-09 / UC-15-RN-07` e `UC-20-RN-07`): o `clinic_admin` deverá poder consentir (opt-in) com o compartilhamento de dados fiscais — a começar por `nf_imports`, podendo abranger outras subcoleções sensíveis — com o Consultor Rennova vinculado à clínica; por padrão, esse acesso fica restrito apenas ao `clinic_admin`. Nenhum campo de autorização nem UI para o consentimento existe hoje; nenhum UC aberto ainda, status Aberto/sem decisão de priorização
- 📊 **Inventário de relatórios e roadmap de relatórios** (Seção 8.4 do mapa), pedido direto do usuário: levantamento de todos os relatórios por perfil em [`_INVENTARIO-DE-RELATORIOS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_INVENTARIO-DE-RELATORIOS.md) e 14 itens de roadmap (REL-01 a REL-14) — destaque para a tela de Relatórios do Consultor ainda como placeholder, a falta de relatórios gerenciais para o System Admin e a padronização dos formatos de exportação. Todos abertos, aguardando priorização do PO; não alteram a contagem por severidade acima.
- 📧 **Mecanismo de segurança pendente para disparo controlado de e-mails reais em `curva-mestra-dev`** (Seção 8.5 do mapa), surgido ao testar manualmente a redefinição de senha nesse ambiente: a Cloud Function `processEmailQueue` (e também `sendCustomEmail`/`sendTempPasswordEmail`, já órfãs) permanece deliberadamente fora do deploy de dev — comportamento intencional documentado em `.github/workflows/deploy-gscandelari-dev.yml`, não um bug — para evitar disparo indevido de e-mail real a terceiros durante testes. Requisito registrado para um mecanismo futuro (a definir) que permita habilitar isso com segurança; status Aberto/sem decisão de priorização, nenhum UC aberto ainda
- 📝 12 dos 59 UCs mapeados ainda não estão em status final ("Aprovado" ou "Implementado") — 3 em revisão (`UC-05`, `UC-39`, `UC-40`) e 9 em rascunho (`UC-42` a `UC-50`); `UC-01` saiu de "Em Revisão" para "Implementado" em 08/10/2026 — ver Seção 1 do mapa para detalhes

> Este resumo é um retrato do mapa no momento da última atualização deste README. Para o estado atual item a item, sempre consulte o arquivo do mapa diretamente — ele é atualizado a cada correção ou novo achado.

---

## Documentação Interna

- [`CLAUDE.md`](./CLAUDE.md) — instruções de arquitetura e convenções para desenvolvimento com IA
- [`ONLY_FOR_DEVS/`](./ONLY_FOR_DEVS/) — guias, tasks pendentes e decisões técnicas
- [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/) — Casos de Uso UML (UC-01 a UC-59) e mapa de bugs/melhorias
- [`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`](./ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md) — guia completo do pipeline de desenvolvimento e dos agentes de IA do projeto
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões (gerado automaticamente)

---

Projeto privado — Curva Mestra © 2025-2026
