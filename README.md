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

O sistema mantém um mapa vivo de bugs, achados de segurança, débitos técnicos e decisões de produto pendentes, consolidado a partir dos 57 Casos de Uso documentados em [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/). É a fonte de verdade para priorização de próximas correções e melhorias.

📋 **Mapa completo:** [`_MAPA-DE-BUGS-E-MELHORIAS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md)

**Resumo (v3.50, 08/10/2026):**

| Severidade | Aberto | Corrigido | Descartado | Total   |
| ---------- | ------ | --------- | ---------- | ------- |
| Crítica    | 0      | 5         | 1          | 6       |
| Alta       | 0      | 32        | 1          | 33      |
| Média      | 0      | 40        | 1          | 41      |
| Baixa      | 41     | 46        | 1          | 88      |
| **Total**  | **41** | **123**   | **4**      | **168** |

- ✅ **Nenhum item Aberto de severidade Crítica ou Alta neste mapa** — todos os 6 achados críticos e os 33 de Alta já têm status final ou decisão registrada (32 corrigidos e documentados, 1 descartado por decisão de produto). Destaques recentes: **`UC-46-RN-03`/`RN-04`** (13/08/2026) — `/clinic/consultant/transfer` quebrada foi removida e substituída por `/clinic/consultant/invite` (UC-54). **`UC-21-RN-08`** (21/09/2026) — client de `POST /api/tenants/create` passou a enviar o header `Authorization` (commit `a9449a3`), que faltava e bloqueava todo cadastro real de clínica com administrador. **`UC-32-RN-08`** (27/09/2026, PR #297, commit `0929833`) — regra dedicada de `collectionGroup` para `inventory` em `firestore.rules` e log do erro em `isMasterProductInUse`, validados contra o Firebase Emulator Suite. **`UC-42-RN-11`** (29/09/2026, PR #307, commit `33bcd47`, release v1.9.1) — guard `admin.initializeApp()` corrige `checkAlertsScheduled`, que quebrava em toda execução real em dev/produção. **O achado estrutural de segurança do `firestore.rules` (`UC-13-RN-09`/`UC-15-RN-07`)** (02/10/2026, PR #344, commits `f3ce046`+`94cbe2e`, deploy confirmado em `curva-mestra-dev`) — a regra genérica de subcoleção do tenant deixou de conceder `write` irrestrito (passou a `tenants/{tenantId}/{collectionId}/{document=**}`), tornando efetivas de verdade as regras dedicadas de `inventory`, `stock_limits` e `protocolos`; dois achados novos já nascidos corrigidos na mesma varredura (`UC-16-RN-10`, `UC-10-RN-11`). **`UC-04-RN-11`** (ex-`UC-04-Q4`, 03/10/2026, PR #349, commits `c287322`+`55f0297`) — último item Alta em aberto: race condition em `src/app/(auth)/login/page.tsx` que impedia a exibição do card "Sistema Indisponível" para um `clinic_user` de clínica suspensa (Fluxo de Exceção 8d); corrigida com o guard `loginInProgressRef`, que impede o `useEffect` reativo de redirecionamento de navegar durante uma submissão manual de login em andamento. UC-04 atualizado para v1.3. **`UC-56-RN-10`/`UC-02-RN-07`** (08/10/2026, PR #371, release 1.13.0) — achado novo já nascido corrigido: a clínica aprovada a partir de uma solicitação com código de consultor não era vinculada a esse consultor e não aparecia em "Minhas Clínicas".
- 🧹 **19 itens de severidade Baixa corrigidos e documentados** (07/10/2026, release **v1.11.0**) — dois patches de correções pequenas já mergeados em `gscandelari_setup → develop → master`: **PR #354** (branch `chore/patch-10-correcoes-baixa-severidade`, 10 IDs: `UC-41-RNF-04`, `UC-49-RN-03`, `UC-46-RN-02`, `UC-15-RN-06`, `UC-37-RN-07`, `UC-37-RN-08`, `UC-30-RN-07`, `UC-34-RN-02`, `UC-50-RN-04`, `UC-47-RN-01`) e **PR #355** (branch `chore/patch-10-correcoes-baixa-severidade-2`, 9 IDs: `UC-33-RN-01`, `UC-33-RN-02`, `UC-29-RN-05`, `UC-19-RN-06`, `UC-26-RN-01`, `UC-27-RN-03`, `UC-20-RN-06`, `UC-39-RN-01`, `UC-12-RN-01`) — cobrindo achados de UX (feedback de erro silencioso, falta de confirmação antes de ações irreversíveis, textos desatualizados) e débito técnico (validação client-side ausente, interfaces TypeScript incompletas, duplicidade não verificada) em 16 UCs diferentes. Um 20º achado, `UC-09-RNF-03` (mesmo PR #355), foi corrigido apenas **parcialmente**: a tradução de erros do Firestore (novo helper `src/lib/firestoreErrors.ts`) foi aplicada só à Variante A (`/accept-terms`) do fluxo de aceite de termos — a Variante B (`/clinic/setup/terms`) continua exibindo erros crus, pendência residual registrada como `UC-09-RNF-03b`.
- 🗂️ **9 decisões de produto pendentes** (o item de infraestrutura `ADR-QA-AUTOMATION` foi implementado de ponta a ponta em 17/08/2026, ver Seção 6 do mapa) e **16 itens de código morto/rotas órfãs** catalogados sem severidade atribuída (ver Seções 4.1 e 5 do mapa)
- 🆕 **3 features aprovadas pelo PO, já implementadas e em produção** (Seção 4.2 do mapa, release **1.13.0**, 08/10/2026 — PRs #369, #370, #371, #372): `UC-01-RN-08` (código do consultor validado contra `consultants`, substituindo o campo de texto livre), `UC-56` (Consultor Rennova aprova solicitação vinculada ao próprio código, janela de exclusividade de 2 dias corridos/48h) e `UC-57` (Scheduled Function diária notifica o consultor sobre solicitações pendentes vinculadas ao seu código) — sem impacto na tabela de severidade acima. Dois achados novos já nascidos corrigidos na mesma rodada: `UC-56-RN-10`/`UC-02-RN-07` (Alta, PR #371) e `UC-54-RN-09` (Baixa — consultor inativo exibido como "não encontrado" na tela de convite, PR #376)
- 🔎 **12 gaps entre a landing page comercial e o sistema real** catalogados (Seção 7 do mapa) — 4 com decisão de implementar, **100% documentados**: **UC-51, UC-52 e UC-53 já escritos e aprovados**; o item de Backup Geográfico Automatizado (antes reservado como UC-54, número hoje reaproveitado pelo UC-54 real "Convidar Consultor para a Clínica") foi documentado como **ADR aprovado** — 5 com decisão de corrigir apenas o texto da landing (baixa prioridade) e 3 com decisão adiada
- ✉️ **1 UC fora do fluxo normal de UC, já escrito e aprovado** (Seção 8.1 do mapa): `UC-55` ("Editar Templates de E-mail (System Admin)", v1.1), nascido de pedido direto do usuário após observar que o corpo do e-mail de aprovação de acesso (UC-02) "precisa de uma revisão geral" — escopo fechado: Firestore (`email_templates/{tipo}`) como fonte única de verdade para os 13 gatilhos de e-mail com chamador ativo, editor por gatilho com preview/teste/versionamento, correção da duplicidade UC-02/UC-28 e migração de UC-03 para o mesmo Firestore
- 🎨 **1 registro de divergências de padrão visual de UI** (Seção 8.2 do mapa), pedido direto do usuário: auditoria do subagente `ui-consistency-auditor` contra `ONLY_FOR_DEVS/PO_BA_Docs/_PADRAO-VISUAL-UI.md` (v1.0) — 70 telas avaliadas, 13 arquivos `page.tsx` + 2 layouts compartilhados (Admin/Consultor) com divergência confirmada frente ao padrão shadcn/ui já dominante; destaques: fundo `bg-[#f5f3ef]` hardcoded em Admin/Consultor (vs. token `bg-background` da Clínica), dashboards Admin/Clínica com `<h2>` em vez de `<h1>`, 5 telas de configuração do Admin sem a classe `container`, `Input` reimplementado manualmente (4 ocorrências) e `Badge` sem variante `success`/`info`. Status Aberto, sem decisão de priorização ainda tomada
- 🔐 **1 pedido de produto novo** (Seção 8.3 do mapa), surgido durante o planejamento da correção de segurança de `firestore.rules` (branch `bugfix/firestore-rules-tenant-role-enforcement`, relacionada a `UC-13-RN-09 / UC-15-RN-07` e `UC-20-RN-07`): o `clinic_admin` deverá poder consentir (opt-in) com o compartilhamento de dados fiscais — a começar por `nf_imports`, podendo abranger outras subcoleções sensíveis — com o Consultor Rennova vinculado à clínica; por padrão, esse acesso fica restrito apenas ao `clinic_admin`. Nenhum campo de autorização nem UI para o consentimento existe hoje; nenhum UC aberto ainda, status Aberto/sem decisão de priorização
- 📊 **Inventário de relatórios e roadmap de relatórios** (Seção 8.4 do mapa), pedido direto do usuário: levantamento de todos os relatórios por perfil em [`_INVENTARIO-DE-RELATORIOS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_INVENTARIO-DE-RELATORIOS.md) e 14 itens de roadmap (REL-01 a REL-14) — destaque para a tela de Relatórios do Consultor ainda como placeholder, a falta de relatórios gerenciais para o System Admin e a padronização dos formatos de exportação. Todos abertos, aguardando priorização do PO; não alteram a contagem por severidade acima.
- 📧 **Mecanismo de segurança pendente para disparo controlado de e-mails reais em `curva-mestra-dev`** (Seção 8.5 do mapa), surgido ao testar manualmente a redefinição de senha nesse ambiente: a Cloud Function `processEmailQueue` (e também `sendCustomEmail`/`sendTempPasswordEmail`, já órfãs) permanece deliberadamente fora do deploy de dev — comportamento intencional documentado em `.github/workflows/deploy-gscandelari-dev.yml`, não um bug — para evitar disparo indevido de e-mail real a terceiros durante testes. Requisito registrado para um mecanismo futuro (a definir) que permita habilitar isso com segurança; status Aberto/sem decisão de priorização, nenhum UC aberto ainda
- 📝 12 dos 57 UCs mapeados ainda não estão em status final ("Aprovado" ou "Implementado") — 3 em revisão (`UC-05`, `UC-39`, `UC-40`) e 9 em rascunho (`UC-42` a `UC-50`); `UC-01` saiu de "Em Revisão" para "Implementado" em 08/10/2026 — ver Seção 1 do mapa para detalhes

> Este resumo é um retrato do mapa no momento da última atualização deste README. Para o estado atual item a item, sempre consulte o arquivo do mapa diretamente — ele é atualizado a cada correção ou novo achado.

---

## Documentação Interna

- [`CLAUDE.md`](./CLAUDE.md) — instruções de arquitetura e convenções para desenvolvimento com IA
- [`ONLY_FOR_DEVS/`](./ONLY_FOR_DEVS/) — guias, tasks pendentes e decisões técnicas
- [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/) — Casos de Uso UML (UC-01 a UC-57) e mapa de bugs/melhorias
- [`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`](./ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md) — guia completo do pipeline de desenvolvimento e dos agentes de IA do projeto
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões (gerado automaticamente)

---

Projeto privado — Curva Mestra © 2025-2026
