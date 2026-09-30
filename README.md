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

O sistema mantém um mapa vivo de bugs, achados de segurança, débitos técnicos e decisões de produto pendentes, consolidado a partir dos 54 Casos de Uso documentados em [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/). É a fonte de verdade para priorização de próximas correções e melhorias.

📋 **Mapa completo:** [`_MAPA-DE-BUGS-E-MELHORIAS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md)

**Resumo (v3.40, 29/09/2026):**

| Severidade | Aberto | Corrigido | Descartado | Total   |
| ---------- | ------ | --------- | ---------- | ------- |
| Crítica    | 0      | 5         | 1          | 6       |
| Alta       | 2      | 27        | 1          | 30      |
| Média      | 1      | 39        | 1          | 41      |
| Baixa      | 60     | 25        | 1          | 86      |
| **Total**  | **63** | **96**    | **4**      | **163** |

- ✅ Todos os 6 achados **críticos** já têm status final ou decisão registrada: 5 corrigidos e documentados; 1 descartado por decisão de produto (UC-14, ferramenta de auditoria de inventário removida). **`UC-46-RN-03`/`RN-04` também já corrigidos e documentados** (13/08/2026) — a página quebrada `/clinic/consultant/transfer` foi removida e substituída por `/clinic/consultant/invite` (novo UC-54). **`UC-21-RN-08` também já corrigido e documentado** (21/09/2026) — a rota `POST /api/tenants/create` sempre validou Bearer token no servidor, mas o client nunca enviava o header `Authorization`, impedindo todo cadastro real de clínica com administrador; corrigido no commit `a9449a3`. **`UC-47-RN-08` também já corrigido e documentado** (23/09/2026, severidade Média) — o Relatório de Consumo (`generateConsumptionReport`) lia os campos errados de cada item consumido (`codigo_produto`/`nome_produto` em vez de `produto_codigo`/`produto_nome`), colapsando todos os produtos numa única linha indefinida no detalhamento por produto; corrigido no commit `1ac45ab`. **`UC-32-RN-08` também já corrigido e documentado** (27/09/2026, PR #297, commit `0929833`) — regra dedicada de `collectionGroup` para `inventory` em `firestore.rules` (restrita a `system_admin`) e log do erro em vez de silenciá-lo em `isMasterProductInUse`; validado contra o Firebase Emulator Suite. UC-32 já atualizado para v1.2, confirmando as sub-decisões (a) e (b) resolvidas — resta pendente apenas a sub-decisão (c), reavaliar UX de RN-01/RN-02 agora que o guard funciona de fato. **`UC-15-RN-05`/`UC-42-RN-05` (Média), `UC-42-RN-09`/`RN-10` (Média), `UC-42-RN-11` (Alta) e `UC-42-RN-12` (Média) também já corrigidos e documentados** (28-29/09/2026, PRs #299/#307/#311, documentação incorporada em 29/09/2026 via commit `9178734`) — nova Scheduled Function `checkAlertsScheduled` roda diariamente as verificações de alerta para todos os tenants ativos, antes 100% manuais (RN-05, agora documentada como `[RESOLVIDO]` em UC-42 v1.5.0 e UC-15 v1.2); dois bugs pré-existentes de `alertTriggers.ts` achados e corrigidos no caminho (`UC-42-RN-09`, `UC-42-RN-10`); e dois bugs de runtime descobertos só na validação manual real (não emulador) em dev e produção — ausência de `admin.initializeApp()` quebrava `checkAlertsScheduled` em toda execução real (corrigido, release v1.9.1) e `parseBrDate` quebrava com `dt_validade` de tipo diferente de string, silenciando alertas de pelo menos um tenant real (corrigido, release v1.9.2). Execução real do Cloud Scheduler em `curva-mestra-dev`/produção validada e limpa. **`UC-43-RN-04`/`RN-08` (Baixa) também já corrigido e documentado** (29/09/2026, commit `d0da181`) — UC-43 (Configurar Preferências de Notificação) agora reflete que `checkAlertsScheduled` já lê estas configurações automaticamente uma vez por dia; a promessa de escalonamento "60/30/15 dias" da landing page continua genuinamente não implementada, mantida em aberto na Seção 14 do UC.
- ⚠️ **2 itens de severidade Alta seguem em aberto:** (1) achado ampliado de arquitetura de segurança (`UC-13-RN-09 / UC-15-RN-07`) — a regra genérica de subcoleção do tenant em `firestore.rules` concede escrita irrestrita a qualquer usuário do tenant para todas as subcoleções (semântica OR do Firestore torna regras dedicadas inefetivas), com dúvida cruzada sinalizada sobre a efetividade real de `UC-44-RN-02`/`UC-43-RN-07`/`UC-42-RN-01`/`UC-20-RN-07` (os quatro já receberam ressalva textual do `uml-use-case-writer` reconhecendo o problema, sem correção de código); requer decisão dedicada, ainda não tomada. (2) **`UC-04-RN-11`** (ex-`UC-04-Q4`) — race condition real em `src/app/(auth)/login/page.tsx` (descoberta pelo `qa-agent` ao gerar o caderno de teste retroativo de UC-04, validada por screenshot do Playwright contra o Firebase Emulator Suite): o card "Sistema Indisponível" nunca é exibido para um `clinic_user` de clínica suspensa; decisão do usuário de não corrigir agora, teste marcado com `test.fixme()` — achado já formalmente incorporado à documentação de UC-04 (v1.2, 26/08/2026), permanece sem correção de código
- 🗂️ **9 decisões de produto pendentes** (o item de infraestrutura `ADR-QA-AUTOMATION` foi implementado de ponta a ponta em 17/08/2026, ver Seção 6 do mapa) e **16 itens de código morto/rotas órfãs** catalogados sem severidade atribuída (ver Seções 4 e 5 do mapa)
- 🔎 **12 gaps entre a landing page comercial e o sistema real** catalogados (Seção 7 do mapa) — 4 com decisão de implementar, **100% documentados**: **UC-51, UC-52 e UC-53 já escritos e aprovados**; o item de Backup Geográfico Automatizado (antes reservado como UC-54, número hoje reaproveitado pelo UC-54 real "Convidar Consultor para a Clínica") foi documentado como **ADR aprovado** — 5 com decisão de corrigir apenas o texto da landing (baixa prioridade) e 3 com decisão adiada
- ✉️ **1 reserva de novo UC fora do fluxo de UC**, por pedido direto do usuário (Seção 8 do mapa): `UC-55` (reservado, ainda não escrito) — "Editar Templates de E-mail (System Admin)", após o usuário observar que o corpo do e-mail de aprovação de acesso (UC-02) "precisa de uma revisão geral"; nove arquivos hoje com corpo de e-mail hardcoded catalogados como contexto
- 📝 12 dos 54 UCs mapeados ainda não estão com status "Aprovado" (em revisão ou rascunho) — ver Seção 1 do mapa para detalhes

> Este resumo é um retrato do mapa no momento da última atualização deste README. Para o estado atual item a item, sempre consulte o arquivo do mapa diretamente — ele é atualizado a cada correção ou novo achado.

---

## Documentação Interna

- [`CLAUDE.md`](./CLAUDE.md) — instruções de arquitetura e convenções para desenvolvimento com IA
- [`ONLY_FOR_DEVS/`](./ONLY_FOR_DEVS/) — guias, tasks pendentes e decisões técnicas
- [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/) — Casos de Uso UML (UC-01 a UC-54) e mapa de bugs/melhorias
- [`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`](./ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md) — guia completo do pipeline de desenvolvimento e dos agentes de IA do projeto
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões (gerado automaticamente)

---

Projeto privado — Curva Mestra © 2025-2026
