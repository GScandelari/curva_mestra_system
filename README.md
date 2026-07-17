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
8. CI + aprovação obrigatória — merge dispara release automático (release-please)

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

O sistema mantém um mapa vivo de bugs, achados de segurança, débitos técnicos e decisões de produto pendentes, consolidado a partir dos 49 Casos de Uso documentados em [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/). É a fonte de verdade para priorização de próximas correções e melhorias.

📋 **Mapa completo:** [`_MAPA-DE-BUGS-E-MELHORIAS.md`](./ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md)

**Resumo (v2.5, 17/07/2026):**

| Severidade | Aberto  | Corrigido | Descartado | Total   |
| ---------- | ------- | --------- | ---------- | ------- |
| Crítica    | 0       | 5         | 1          | 6       |
| Alta       | 22      | 0         | 1          | 23      |
| Média      | 34      | 1         | 1          | 36      |
| Baixa      | 81      | 0         | 1          | 82      |
| **Total**  | **137** | **6**     | **4**      | **147** |

- ✅ Todos os 6 achados **críticos** já foram tratados (5 corrigidos e documentados, 1 descartado por decisão de produto)
- ⚠️ **22 itens de severidade Alta** seguem em aberto — próximo alvo natural de priorização
- 🗂️ **13 decisões de produto pendentes** e **16 itens de código morto/rotas órfãs** catalogados sem severidade atribuída (ver Seções 4 e 5 do mapa)
- 📝 11 dos 49 UCs mapeados ainda não estão com status "Aprovado" (em revisão ou rascunho) — ver Seção 1 do mapa para detalhes

> Este resumo é um retrato do mapa no momento da última atualização deste README. Para o estado atual item a item, sempre consulte o arquivo do mapa diretamente — ele é atualizado a cada correção ou novo achado.

---

## Documentação Interna

- [`CLAUDE.md`](./CLAUDE.md) — instruções de arquitetura e convenções para desenvolvimento com IA
- [`ONLY_FOR_DEVS/`](./ONLY_FOR_DEVS/) — guias, tasks pendentes e decisões técnicas
- [`ONLY_FOR_DEVS/PO_BA_Docs/`](./ONLY_FOR_DEVS/PO_BA_Docs/) — Casos de Uso UML (UC-01 a UC-49) e mapa de bugs/melhorias
- [`ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`](./ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md) — guia completo do pipeline de desenvolvimento e dos agentes de IA do projeto
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões (gerado automaticamente)

---

Projeto privado — Curva Mestra © 2025-2026
