# GitHub Actions Workflows — Curva Mestra

Este documento descreve todos os GitHub Actions workflows configurados em `.github/workflows/`.

---

## Visão Geral

| Workflow               | Arquivo                      | Gatilho                                                                 | Destino                           |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| CI Pipeline            | `ci.yml`                     | Push em `master`, `develop`, `release/**`; PR para `master` e `develop` | — (validação)                     |
| Deploy Produção        | `deploy-firebase.yml`        | Push em `master`                                                        | `curva-mestra.web.app` (produção) |
| Deploy Dev — Guilherme | `deploy-gscandelari-dev.yml` | Push em `gscandelari_setup`                                             | `gscandelari-dev.web.app`         |
| Deploy Dev — Lhuan     | `deploy-lhuan-dev.yml`       | Push em `lhuan_setup`                                                   | `lhuancassio-dev.web.app`         |
| Security & Quality     | `security.yml`               | Push em `master`/`develop`; PR; cron semanal (segunda 06:00 UTC)        | — (validação)                     |
| Release                | `release.yml`                | Push em `master`                                                        | GitHub Releases + deploy produção |
| Dependabot Auto-merge  | `dependabot-auto-merge.yml`  | PR de `dependabot[bot]` para `develop`                                  | — (merge automático patch/minor)  |

---

## 1. CI Pipeline

**Arquivo:** [.github/workflows/ci.yml](../.github/workflows/ci.yml)

### Quando dispara

- Push em `master`, `develop` ou `release/**`
- Pull Request aberto ou atualizado com base em `master` ou `develop`
- Concorrência: cancela runs anteriores da mesma branch automaticamente

### Jobs em paralelo

| Job          | O que valida                        |
| ------------ | ----------------------------------- |
| `lint`       | ESLint + Prettier                   |
| `type-check` | TypeScript sem erros                |
| `test`       | Jest com cobertura + upload Codecov |
| `build`      | Build Next.js sem erros             |
| `summary`    | Falha se qualquer job acima falhou  |

### Pontos importantes

- Todos os jobs são pré-requisito para merge em `master` e `develop` (Branch Protection Rules)
- Usa `.nvmrc` para versão do Node.js

---

## 2. Deploy Produção

**Arquivo:** [.github/workflows/deploy-firebase.yml](../.github/workflows/deploy-firebase.yml)

**Destino:** `https://curva-mestra.web.app` (produção)

### Quando dispara

- Push na branch `master`
- Disparo manual via `workflow_dispatch`

### O que faz, passo a passo

| Passo                     | O que acontece                                                     |
| ------------------------- | ------------------------------------------------------------------ |
| Checkout                  | Clona o repositório                                                |
| Setup Node 20             | Configura Node.js com cache npm                                    |
| `npm ci`                  | Instala dependências do frontend                                   |
| `npm run build`           | Build de produção do Next.js                                       |
| Install Firebase CLI      | Instala `firebase-tools` globalmente                               |
| Enable Web Frameworks     | Habilita experimento `webframeworks` (necessário para Next.js SSR) |
| Build Functions           | `cd functions && npm install && npx tsc`                           |
| Deploy Hosting            | Deploy do target `curva-mestra` (produção)                         |
| Deploy Functions          | Deploy de todas as Firebase Functions                              |
| Upload logs (só em falha) | Salva logs de debug como artifact (7 dias)                         |

### Pontos importantes

- **Pipeline completo:** Hosting + Functions
- É o único workflow que faz deploy de Functions

---

## 3. Deploy Dev — Guilherme Scandelari

**Arquivo:** [.github/workflows/deploy-gscandelari-dev.yml](../.github/workflows/deploy-gscandelari-dev.yml)

**Destino:** `https://gscandelari-dev.web.app` (ambiente pessoal de dev)

### Quando dispara

- Push na branch `gscandelari_setup`
- Disparo manual via `workflow_dispatch`

### O que faz, passo a passo

| Passo                    | O que acontece                                |
| ------------------------ | --------------------------------------------- |
| Checkout                 | Clona o repositório                           |
| Setup Node 20            | Configura Node.js com cache npm               |
| `npm ci`                 | Instala dependências                          |
| `npm run build`          | Build de produção Next.js                     |
| Install Firebase CLI     | Instala `firebase-tools`                      |
| Enable Web Frameworks    | Habilita experimento `webframeworks`          |
| Deploy Hosting           | Deploy **apenas** do target `gscandelari-dev` |
| Upload log (só em falha) | Salva log de debug como artifact (7 dias)     |

### Pontos importantes

- **Só faz deploy de Hosting** — nenhuma Function é tocada
- Dispara em qualquer push para `gscandelari_setup`, incluindo merges de task branches para validação

---

## 4. Deploy Dev — Lhuan Cassio

**Arquivo:** [.github/workflows/deploy-lhuan-dev.yml](../.github/workflows/deploy-lhuan-dev.yml)

**Destino:** `https://lhuancassio-dev.web.app` (ambiente pessoal de dev)

### Quando dispara

- Push na branch `lhuan_setup`
- Disparo manual via `workflow_dispatch`

### O que faz, passo a passo

Idêntico ao workflow do Guilherme, com duas diferenças:

| Diferença               | Valor                             |
| ----------------------- | --------------------------------- |
| Branch gatilho          | `lhuan_setup`                     |
| Firebase Hosting target | `lhuancassio-dev`                 |
| URL final               | `https://lhuancassio-dev.web.app` |

### Pontos importantes

- **Só faz deploy de Hosting** — nenhuma Function é tocada

---

## 5. Security & Quality Check

**Arquivo:** [.github/workflows/security.yml](../.github/workflows/security.yml)

### Quando dispara

- Push em `master` ou `develop`
- Pull Request para `master` ou `develop`
- Cron: toda segunda-feira às 06:00 UTC

### Jobs

| Job          | O que faz                                                     |
| ------------ | ------------------------------------------------------------- |
| `npm-audit`  | Verifica vulnerabilidades `npm audit --audit-level=moderate`  |
| `codeql`     | Análise estática CodeQL (JavaScript/TypeScript)               |
| `sonarcloud` | Análise SonarCloud com cobertura de testes (não roda no cron) |

---

## 6. Release

**Arquivo:** [.github/workflows/release.yml](../.github/workflows/release.yml)

### Quando dispara

- Push na branch `master`

### O que faz

- Usa **Release Please** para criar GitHub Releases automáticas com base nos commits Conventional Commits
- Faz versionamento semântico automático (MAJOR/MINOR/PATCH)
- Gera CHANGELOG automaticamente
- Dispara deploy de produção somente quando uma release é criada (`steps.release.outputs.release_created`)

---

## 7. Dependabot Auto-merge

**Arquivo:** [.github/workflows/dependabot-auto-merge.yml](../.github/workflows/dependabot-auto-merge.yml)

### Quando dispara

- Pull Request aberto pelo `dependabot[bot]` com base em `develop`

### O que faz

- Faz auto-merge de PRs do Dependabot para atualizações `patch` e `minor`
- Atualizações `major` precisam de revisão manual

---

## Fluxo de Deploy por Ambiente

```
Commit em gscandelari_setup ──→ deploy-gscandelari-dev.yml ──→ gscandelari-dev.web.app
Commit em lhuan_setup        ──→ deploy-lhuan-dev.yml       ──→ lhuancassio-dev.web.app
PR mergeado em develop        ──→ ci.yml + security.yml      ──→ (validação)
PR mergeado em master         ──→ deploy-firebase.yml        ──→ curva-mestra.web.app (prod)
                              ──→ release.yml                ──→ GitHub Release
```

---

## Secrets necessários (GitHub → Settings → Secrets)

| Secret                       | Usado em         | Finalidade                                          |
| ---------------------------- | ---------------- | --------------------------------------------------- |
| `FIREBASE_TOKEN`             | Todos os deploys | Autenticação do Firebase CLI (`firebase login:ci`)  |
| `FIREBASE_ADMIN_CREDENTIALS` | Todos os deploys | Credenciais da service account para SSR server-side |
| `SONAR_TOKEN`                | `security.yml`   | Autenticação SonarCloud                             |

> Para gerar um novo `FIREBASE_TOKEN`, rode `firebase login:ci` localmente e salve o token no repositório.
