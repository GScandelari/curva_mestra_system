# GitHub Actions Workflows — Curva Mestra

Este documento descreve todos os GitHub Actions workflows configurados em `.github/workflows/`.

---

## Visão Geral

| Workflow               | Arquivo                      | Gatilho                                                                 | Destino                           |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| CI Pipeline            | `ci.yml`                     | Push em `master`, `develop`, `release/**`; PR para `master`, `develop`, `gscandelari_setup`, `lhuan_setup` | — (validação) |
| Deploy Produção        | `deploy-firebase.yml`        | Push em `master`; `workflow_dispatch`                                   | `curva-mestra.web.app` (produção) |
| Deploy Dev — Guilherme | `deploy-gscandelari-dev.yml` | Push em `gscandelari_setup`; `workflow_dispatch`                        | `dev-gscandelari.web.app`         |
| Deploy Dev — Lhuan     | `deploy-lhuan-dev.yml`       | Push em `lhuan_setup`; `workflow_dispatch`                              | `lhuancassio-dev.web.app`         |
| Security & Quality     | `security.yml`               | Push em `master`/`develop`; PR para `master`, `develop`, `gscandelari_setup`, `lhuan_setup` | — (validação) |
| Release                | `release.yml`                | Push em `master`                                                        | GitHub Releases                   |
| Dependabot Auto-merge  | `dependabot-auto-merge.yml`  | PR de `dependabot[bot]` para `develop`                                  | — (merge automático patch/minor)  |

---

## 1. CI Pipeline

**Arquivo:** [.github/workflows/ci.yml](../.github/workflows/ci.yml)

### Quando dispara

- Push em `master`, `develop` ou `release/**`
- Pull Request aberto ou atualizado com base em `master`, `develop`, `gscandelari_setup` ou `lhuan_setup`

### Jobs em paralelo

| Job          | O que valida                        |
| ------------ | ----------------------------------- |
| `lint`       | ESLint + Prettier                   |
| `type-check` | TypeScript sem erros                |
| `test`       | Jest com cobertura + upload Codecov |
| `build`      | Build Next.js sem erros             |

### Pontos importantes

- Todos os jobs são pré-requisito para merge em `master` e `develop` (Branch Protection Rules)
- Node.js **20** (alinhado com `engines.node` em `package.json` e Firebase Functions runtime)

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

**Destino:** `https://dev-gscandelari.web.app` (ambiente pessoal de dev)

### Quando dispara

- Push na branch `gscandelari_setup`
- Disparo manual via `workflow_dispatch`

### O que faz, passo a passo

| Passo                    | O que acontece                                          |
| ------------------------ | ------------------------------------------------------- |
| Checkout                 | Clona o repositório                                     |
| Setup Node 20            | Configura Node.js com cache npm                         |
| `npm ci`                 | Instala dependências                                    |
| `npm run build`          | Build de produção Next.js                               |
| Install Firebase CLI     | Instala `firebase-tools`                                |
| Enable Web Frameworks    | Habilita experimento `webframeworks`                    |
| Deploy Hosting           | Deploy do target `dev-gscandelari` + regras/indexes dev |
| Upload log (só em falha) | Salva log de debug como artifact (7 dias)               |

### Pontos importantes

- **Só faz deploy de Hosting** — nenhuma Function é tocada
- Dispara em qualquer push/merge para `gscandelari_setup`
- **Fluxo correto:** abrir PR da task branch (`feature/*`, `bugfix/*`, `chore/*`) para `gscandelari_setup`. Após o merge e validação em `dev-gscandelari.web.app`, abrir PR de `gscandelari_setup` para `develop`

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
- **Fluxo correto:** abrir PR da task branch (`feature/*`, `bugfix/*`, `chore/*`) para `lhuan_setup`. Após o merge e validação em `lhuancassio-dev.web.app`, abrir PR de `lhuan_setup` para `develop`

---

## 5. Security & Quality Check

**Arquivo:** [.github/workflows/security.yml](../.github/workflows/security.yml)

### Quando dispara

- Push em `master` ou `develop`
- Pull Request para `master`, `develop`, `gscandelari_setup` ou `lhuan_setup`

### Jobs

| Job          | O que faz                                                    |
| ------------ | ------------------------------------------------------------ |
| `security`   | Verifica vulnerabilidades `npm audit --audit-level=moderate` |
| `sonarqube`  | Análise SonarCloud com cobertura de testes                   |

---

## 6. Release

**Arquivo:** [.github/workflows/release.yml](../.github/workflows/release.yml)

### Quando dispara

- Push na branch `master`

### O que faz

- Usa **Release Please** para criar GitHub Releases automáticas com base nos commits Conventional Commits
- Faz versionamento semântico automático (MAJOR/MINOR/PATCH)
- Gera CHANGELOG automaticamente

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
feature/* / bugfix/* / chore/*
    │
    │  PR (task branch → branch pessoal)
    ▼
gscandelari_setup ──→ deploy-gscandelari-dev.yml ──→ dev-gscandelari.web.app  (validação)
lhuan_setup       ──→ deploy-lhuan-dev.yml       ──→ lhuancassio-dev.web.app (validação)
    │
    │  PR (branch pessoal → develop) — após validação no Firebase
    ▼
develop           ──→ ci.yml + security.yml      ──→ (lint + type-check + test + build + SonarCloud)
    │
    │  PR (develop → master) — releases
    ▼
master            ──→ deploy-firebase.yml        ──→ curva-mestra.web.app (produção)
                  ──→ release.yml                ──→ GitHub Release (versionamento semântico)
```

> **Regra obrigatória:** Nunca abrir PR diretamente de uma task branch para `develop`.
> O caminho é sempre: `task branch` → `branch pessoal` (valida Firebase) → `develop` → `master`.

---

## Secrets necessários (GitHub → Settings → Secrets)

| Secret                           | Usado em                          | Finalidade                                                |
| -------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `FIREBASE_TOKEN`                 | `deploy-firebase.yml`             | Autenticação do Firebase CLI para produção                |
| `FIREBASE_TOKEN_DEV`             | `deploy-gscandelari-dev.yml`, `deploy-lhuan-dev.yml` | Autenticação do Firebase CLI para dev   |
| `FIREBASE_ADMIN_CREDENTIALS`     | `deploy-firebase.yml`, `release.yml` | Service account — projeto produção (`curva-mestra`)    |
| `FIREBASE_ADMIN_CREDENTIALS_DEV` | `deploy-gscandelari-dev.yml`, `deploy-lhuan-dev.yml` | Service account — projeto dev (`curva-mestra-dev`) |
| `SONAR_TOKEN`                    | `security.yml`                    | Autenticação SonarCloud                                   |
| `RELEASE_PLEASE_TOKEN`           | `release.yml`                     | Token para o Release Please criar PRs e releases          |

> Para gerar um novo token de deploy Firebase, rode `firebase login:ci` localmente e salve como `FIREBASE_TOKEN` (produção) ou `FIREBASE_TOKEN_DEV` (dev).
