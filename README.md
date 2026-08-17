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

**Resumo (v3.25, 17/08/2026):**

| Severidade | Aberto | Corrigido | Descartado | Total   |
| ---------- | ------ | --------- | ---------- | ------- |
| Crítica    | 0      | 5         | 1          | 6       |
| Alta       | 1      | 24        | 1          | 26      |
| Média      | 3      | 33        | 1          | 37      |
| Baixa      | 60     | 24        | 1          | 85      |
| **Total**  | **64** | **86**    | **4**      | **154** |

- ✅ Todos os 6 achados **críticos** já têm status final ou decisão registrada: 5 corrigidos e documentados; 1 descartado por decisão de produto (UC-14, ferramenta de auditoria de inventário removida). A coluna "Em Correção" **zera completamente** em todo o mapa — os dois últimos itens nesse estado (`UC-46-RN-03`/`UC-46-RN-04`, a página quebrada `/clinic/consultant/transfer`) foram confirmados corrigidos pela implementação de `feature/consultor-vinculo-convite-transferencia`, que também resolveu o achado crítico "inatingível" de `UC-25` (backend pronto sem gatilho de UI) e introduziu o novo caso de uso **UC-54** (Convidar Consultor para a Clínica)
- ⚠️ **1 item de severidade Alta segue em aberto:** achado ampliado de arquitetura de segurança (`UC-13-RN-09 / UC-15-RN-07`) — a regra genérica de subcoleção do tenant em `firestore.rules` concede escrita irrestrita a qualquer usuário do tenant para todas as subcoleções (semântica OR do Firestore torna regras dedicadas inefetivas), com dúvida cruzada sinalizada sobre a efetividade real de `UC-44-RN-02`/`UC-43-RN-07`/`UC-42-RN-01`/`UC-20-RN-07` (os quatro já receberam ressalva textual do `uml-use-case-writer` reconhecendo o problema, sem correção de código); requer decisão dedicada, ainda não tomada. `UC-01-Q1` (achado de que `POST /api/access-requests` lia `system_settings/global` via client SDK, bloqueado pela regra `isAuthenticated()` do Firestore) foi corrigido e documentado — migrado para o Admin SDK (commit `66689fe`), UC-01 atualizado para v2.1.1. Na severidade Média, restam apenas 3 itens em aberto, todos deliberadamente adiados/consolidados (`UC-15-RN-05`, `UC-20-RN-07`, `UC-42-RN-05` — ver Seções 2 e 3 do mapa)
- 🗂️ **9 decisões de produto pendentes** e **16 itens de código morto/rotas órfãs** catalogados sem severidade atribuída (ver Seções 4 e 5 do mapa)
- 🔎 **12 gaps entre a landing page comercial e o sistema real** catalogados (Seção 7 do mapa) — 4 com decisão de implementar, **100% documentados**: **UC-51, UC-52 e UC-53 já escritos e aprovados**, aguardando apenas priorização/planejamento de implementação; o item de Backup Geográfico Automatizado (antes reservado como UC-54, número hoje reaproveitado por um caso de uso real e não relacionado) foi descartado como caso de uso e documentado como **ADR aprovado** (`ONLY_FOR_DEVS/TO_DO/ADR-backup-geografico-automatizado.md`), por ser um processo de infraestrutura sem ator/tela — 5 com decisão de corrigir apenas o texto da landing (baixa prioridade) e 3 com decisão adiada
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
