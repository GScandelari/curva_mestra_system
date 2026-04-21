# 🚀 Guia Completo de Configuração de Pipeline e Padronização

**Projeto:** Curva Mestra System  
**Stack:** TypeScript · Next.js 15 · Firebase · SaaS Multi-Tenant  
**Repositório:** `GScandelari/curva_mestra_system`  
**Atualizado em:** Abril/2026  
**Idioma:** Português (pt-BR)

> **Este documento é a fonte única de verdade (_single source of truth_) para todos os desenvolvedores que colaboram no projeto.** Siga as práticas aqui descritas sem exceções. Dúvidas? Abra uma issue com a label `documentation`.

---

## 📋 Índice

1. [Estrutura de Branches e Convenções de Nomenclatura (Git Flow)](#1-estrutura-de-branches-e-convenções-de-nomenclatura-git-flow)
2. [Padrões de Mensagem de Commit (Conventional Commits)](#2-padrões-de-mensagem-de-commit-conventional-commits)
3. [Configuração de Regras de Proteção de Branch](#3-configuração-de-regras-de-proteção-de-branch)
4. [GitHub Actions Workflows (CI/CD, Security, Release, Dependabot)](#4-github-actions-workflows-cicd-security-release-dependabot)
5. [Scripts NPM e Configuração de Build](#5-scripts-npm-e-configuração-de-build)
6. [Pre-commit Hooks (Husky + lint-staged)](#6-pre-commit-hooks-husky--lint-staged)
7. [Templates de Pull Request e Diretrizes](#7-templates-de-pull-request-e-diretrizes)
8. [Templates de Issue (Bug Reports e Feature Requests)](#8-templates-de-issue-bug-reports-e-feature-requests)
9. [Padrões de Code Review e Checklist](#9-padrões-de-code-review-e-checklist)
10. [Configuração de CODEOWNERS](#10-configuração-de-codeowners)
11. [Guia de Contribuição (CONTRIBUTING.md)](#11-guia-de-contribuição-contributingmd)
12. [Instruções de Setup do Ambiente de Desenvolvimento](#12-instruções-de-setup-do-ambiente-de-desenvolvimento)
13. [Monitoramento e Métricas (Badges e Dashboards)](#13-monitoramento-e-métricas-badges-e-dashboards)
14. [Melhores Práticas de Configuração do Repositório](#14-melhores-práticas-de-configuração-do-repositório)
15. [Checklist de Implementação](#checklist-de-implementação)
16. [Referência Rápida](#referência-rápida)
17. [Troubleshooting](#troubleshooting)
18. [Recursos Externos](#recursos-externos)

---

## 1. Estrutura de Branches e Convenções de Nomenclatura (Git Flow)

### 1.1 Modelo de Branches Recomendado (Git Flow Simplificado para SaaS)

```
master ──────────────────────────────────────── Produção (releases estáveis)
    ↑
release/* ───────────────────────────────────── Preparação para produção (RC)
    ↑
develop ─────────────────────────────────────── Integração contínua
    ↑
feature/* ── bugfix/* ── hotfix/* ── chore/* ── Tasks diárias (criadas a partir do develop)
    ↓ merge para testar
gscandelari_setup ── lhuan_setup ────────────── Ambientes pessoais de dev (deploy automático)
```

| Branch               | Propósito                          | Merge para           | Proteção                   |
| -------------------- | ---------------------------------- | -------------------- | -------------------------- |
| `master`             | Código em produção                 | —                    | ✅ Protegida (2 revisores) |
| `develop`            | Integração de features             | `master` via release | ✅ Protegida (1 revisor)   |
| `release/*`          | Candidate de release               | `master` e `develop` | ⚠️ Somente tech lead       |
| `feature/*`          | Nova funcionalidade                | `develop`            | ❌ Sem proteção            |
| `bugfix/*`           | Correção não-crítica               | `develop`            | ❌ Sem proteção            |
| `hotfix/*`           | Correção crítica em produção       | `master` e `develop` | ❌ Sem proteção            |
| `chore/*`            | Manutenção/infra                   | `develop`            | ❌ Sem proteção            |
| `gscandelari_setup`  | Ambiente dev — Guilherme Scandelari | — (sincroniza com master) | ❌ Sem proteção     |
| `lhuan_setup`        | Ambiente dev — Lhuan Cassio        | — (sincroniza com master) | ❌ Sem proteção     |

### 1.2 Convenções de Nomenclatura de Branches

**Padrão:** `<tipo>/<escopo-kebab-case>`

```bash
# ✅ Exemplos CORRETOS
feature/add-inventory-management
feature/inventory-batch-expiration-alert
bugfix/fix-date-validation-on-nf-import
hotfix/critical-auth-token-expiration
release/v1.2.0
chore/update-firebase-dependencies
chore/configure-eslint-rules

# ❌ Exemplos INCORRETOS
nova-funcionalidade          # sem tipo
Feature/AddInventory         # PascalCase não permitido
feature/adiciona funcionalidade   # espaços não permitidos
fix-bug                     # sem tipo prefixado
```

### 1.3 Fluxo de Trabalho Diário

```bash
# 1. Sincronize o develop local
git checkout develop
git pull origin develop

# 2. Crie sua branch de task a partir do develop
git checkout -b feature/nome-da-feature

# 3. Trabalhe em commits pequenos e atômicos
git add src/components/Inventory.tsx
git commit -m "feat(inventory): add expiration date validation"

# 4. Para testar no seu ambiente Firebase pessoal:
#    merge da task branch na sua branch pessoal → dispara deploy automático
git checkout gscandelari_setup   # ou lhuan_setup
git merge feature/nome-da-feature
git push origin gscandelari_setup

# 5. Após validar no ambiente pessoal, abra PR da task branch para develop
git checkout feature/nome-da-feature
git push origin feature/nome-da-feature
# → abrir PR no GitHub: feature/nome-da-feature → develop

# 6. Mantenha sua branch atualizada com o develop durante o desenvolvimento
git fetch origin develop
git rebase origin/develop   # prefira rebase a merge para histórico limpo
```

### 1.4 Branches Pessoais de Desenvolvimento

Cada dev possui uma branch pessoal permanente vinculada a um domínio Firebase exclusivo:

| Dev               | Branch            | Domínio Firebase              | Workflow                         |
| ----------------- | ----------------- | ----------------------------- | -------------------------------- |
| Guilherme Scandelari | `gscandelari_setup` | `gscandelari-dev.web.app`  | `deploy-gscandelari-dev.yml`     |
| Lhuan Cassio      | `lhuan_setup`     | `lhuancassio-dev.web.app`     | `deploy-lhuan-dev.yml`           |

**Regras das branches pessoais:**

1. **Sempre sincronizadas com `master`** — antes de iniciar qualquer task, traga as atualizações de produção:
   ```bash
   git checkout gscandelari_setup   # ou lhuan_setup
   git fetch origin master
   git merge origin/master
   git push origin gscandelari_setup
   ```

2. **Servem apenas para validação** — toda task é desenvolvida em uma `feature/*` ou `bugfix/*` criada a partir do `develop`. A branch pessoal recebe o merge apenas para acionar o deploy e validar o comportamento no Firebase.

3. **Nunca abrir PR da branch pessoal para `develop` ou `master`** — o PR sempre parte da task branch (`feature/*`, `bugfix/*`, etc.).

4. **Todo commit (ou merge) na branch pessoal dispara deploy automático** para o respectivo domínio Firebase.

### 1.5 Regra de Ouro: Branch por Feature

> **Uma branch = uma funcionalidade**. Branches grandes que tocam muitas áreas são difíceis de revisar e introduzem riscos. Se sua feature dura mais de 2 dias, considere dividi-la em sub-tarefas.

---

## 2. Padrões de Mensagem de Commit (Conventional Commits)

Adotamos a especificação [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) — padrão utilizado por Google, Microsoft, Angular e outras empresas líderes.

### 2.1 Estrutura

```
<tipo>(<escopo>): <descrição curta>

[corpo opcional — explique o POR QUÊ, não o O QUÊ]

[rodapé opcional — breaking changes, issue refs]
```

### 2.2 Tipos Permitidos

| Tipo       | Quando usar                                              | Gera versão |
| ---------- | -------------------------------------------------------- | ----------- |
| `feat`     | Nova funcionalidade para o usuário                       | MINOR       |
| `fix`      | Correção de bug para o usuário                           | PATCH       |
| `docs`     | Mudanças apenas na documentação                          | —           |
| `style`    | Formatação, ponto-e-vírgula etc. (sem mudança de lógica) | —           |
| `refactor` | Refatoração sem mudança de comportamento                 | —           |
| `perf`     | Melhoria de performance                                  | PATCH       |
| `test`     | Adicionar ou corrigir testes                             | —           |
| `chore`    | Tarefas de build, dependências, CI                       | —           |
| `ci`       | Mudanças em arquivos de CI/CD                            | —           |
| `revert`   | Reverte um commit anterior                               | PATCH       |

### 2.3 Escopos do Projeto

Use escopos alinhados com os módulos do sistema:

```
auth, inventory, requests, reports, admin, dashboard, tenant,
firebase, api, ui, types, hooks, config, deploy
```

### 2.4 Exemplos Válidos

```bash
# Feature simples
feat(inventory): add product quantity validation on DANFE import

# Bug fix com explicação
fix(auth): resolve token expiration on page refresh

Tokens were being stored in memory only, causing 401 errors on
hard refresh. Now stored in sessionStorage with proper TTL.

Fixes #42

# Breaking change
feat(api)!: change inventory endpoint from /products to /inventory

BREAKING CHANGE: Clients using /api/products must migrate to
/api/inventory. See migration guide in docs/api-migration.md.

# Múltiplos escopos
feat(inventory,reports): add batch expiration report export

# Chore simples
chore(deps): update firebase from 11.1.0 to 11.2.0

# Documentação
docs(readme): add Firebase emulator setup instructions
```

### 2.5 Regras de Ouro para Commits

- **Imperativo no presente:** `add` não `added` / `adds`
- **Minúsculas:** primeira letra do tipo e escopo sempre minúscula
- **Máximo 72 caracteres** na primeira linha
- **Um commit = uma mudança lógica** — commits atômicos facilitam `git bisect` e revert
- **Nunca:** `fix bug`, `WIP`, `update`, `ajustes`, `minor changes`

```bash
# ❌ Mensagens proibidas
git commit -m "fix bug"
git commit -m "WIP"
git commit -m "update stuff"
git commit -m "ajustes finais"

# ✅ Mensagens corretas
git commit -m "fix(auth): resolve null pointer in token validation"
git commit -m "feat(requests): add PDF export for monthly reports"
```

---

## 3. Configuração de Regras de Proteção de Branch

### 3.1 Configuração via GitHub UI

Acesse: `Settings → Branches → Add branch protection rule`

### 3.2 Regras para `master` (Produção)

```yaml
Branch name pattern: master

Configurações obrigatórias:
  ✅ Require a pull request before merging
      - Required approving reviews: 2
      - Dismiss stale pull request approvals when new commits are pushed: true
      - Require review from Code Owners: true
      - Restrict who can dismiss pull request reviews: true (somente admins)

  ✅ Require status checks to pass before merging
      - Require branches to be up to date before merging: true
      Status checks obrigatórios:
        - lint (ESLint)
        - type-check (TypeScript)
        - test (Jest)
        - build (Next.js)
        - security (npm audit)

  ✅ Require conversation resolution before merging: true
  ✅ Require signed commits: true (recomendado)
  ✅ Include administrators: false (admins podem fazer hotfix emergencial)
  ✅ Restrict who can push to matching branches: true
      - Apenas: @GScandelari e tech leads definidos
  ✅ Do not allow bypassing the above settings: true
  ✅ Allow force pushes: false
  ✅ Allow deletions: false
```

### 3.3 Regras para `develop` (Integração)

```yaml
Branch name pattern: develop

Configurações obrigatórias:
  ✅ Require a pull request before merging
      - Required approving reviews: 1
      - Dismiss stale pull request approvals when new commits are pushed: true

  ✅ Require status checks to pass before merging
      - Require branches to be up to date before merging: true
      Status checks obrigatórios:
        - lint
        - type-check
        - build

  ✅ Require conversation resolution before merging: true
  ✅ Allow force pushes: false
  ✅ Allow deletions: false
```

### 3.4 Configuração via GitHub CLI (Automatizada)

```bash
# Instalar GitHub CLI
brew install gh   # macOS
# ou: https://cli.github.com/

# Autenticar
gh auth login

# Configurar proteção da master
gh api repos/GScandelari/curva_mestra_system/branches/master/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","type-check","test","build"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null \
  --field required_conversation_resolution=true
```

---

## 4. GitHub Actions Workflows (CI/CD, Security, Release, Dependabot)

### 4.1 Workflow 1: CI Principal

**Arquivo:** `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [master, develop, 'release/**']
  pull_request:
    branches: [master, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    name: 🔍 Linting
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check Prettier formatting
        run: npm run format:check

  type-check:
    runs-on: ubuntu-latest
    name: 🔷 TypeScript Type Check
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type checking
        run: npm run type-check

  test:
    runs-on: ubuntu-latest
    name: 🧪 Unit Tests
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  build:
    runs-on: ubuntu-latest
    name: 🏗️ Build
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js application
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}

  summary:
    needs: [lint, type-check, test, build]
    runs-on: ubuntu-latest
    name: ✅ CI Summary
    if: always()
    steps:
      - name: Check all jobs passed
        run: |
          if [[ "${{ needs.lint.result }}" != "success" || \
                "${{ needs.type-check.result }}" != "success" || \
                "${{ needs.test.result }}" != "success" || \
                "${{ needs.build.result }}" != "success" ]]; then
            echo "❌ One or more CI jobs failed"
            exit 1
          fi
          echo "✅ All CI checks passed"
```

### 4.2 Workflow 2: Security & Code Quality

**Arquivo:** `.github/workflows/security.yml`

```yaml
name: Security & Quality Check

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]
  schedule:
    - cron: '0 6 * * 1' # toda segunda-feira às 06:00 UTC

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    name: 🔐 NPM Security Audit
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit (moderate+)
        run: npm audit --audit-level=moderate

  codeql:
    runs-on: ubuntu-latest
    name: 🛡️ CodeQL Analysis
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: '/language:javascript-typescript'

  sonarcloud:
    runs-on: ubuntu-latest
    name: 📊 SonarCloud Analysis
    if: github.event_name != 'schedule'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### 4.3 Workflow 3: Release Automatizado

**Arquivo:** `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    branches: [master]

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    name: 🚀 Create Release
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Create Release with Release Please
        id: release
        uses: googleapis/release-please-action@v4
        with:
          release-type: node
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: .release-please-config.json

      - name: Deploy to Firebase Hosting (Production)
        if: ${{ steps.release.outputs.release_created }}
        run: npm run firebase:deploy
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

**Arquivo:** `.release-please-config.json`

```json
{
  "release-type": "node",
  "bump-minor-pre-major": true,
  "changelog-sections": [
    { "type": "feat", "section": "✨ Features" },
    { "type": "fix", "section": "🐛 Bug Fixes" },
    { "type": "perf", "section": "⚡ Performance Improvements" },
    { "type": "revert", "section": "🔄 Reverts" },
    { "type": "docs", "section": "📚 Documentation", "hidden": true },
    { "type": "chore", "section": "🔧 Miscellaneous", "hidden": true }
  ]
}
```

### 4.4 Workflow 4: Dependabot Auto-merge

**Arquivo:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
      timezone: 'America/Sao_Paulo'
    open-pull-requests-limit: 10
    reviewers:
      - 'GScandelari'
    labels:
      - 'dependencies'
      - 'automated'
    commit-message:
      prefix: 'chore(deps)'
    groups:
      firebase:
        patterns:
          - 'firebase*'
          - '@firebase/*'
      radix-ui:
        patterns:
          - '@radix-ui/*'
      testing:
        patterns:
          - 'jest*'
          - '@testing-library/*'
          - '@playwright/*'

  # GitHub Actions
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'monthly'
    labels:
      - 'dependencies'
      - 'github-actions'
    commit-message:
      prefix: 'ci(deps)'
```

**Arquivo:** `.github/workflows/dependabot-auto-merge.yml`

```yaml
name: Auto-merge Dependabot PRs

on:
  pull_request:
    branches: [develop]

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    name: 🤖 Dependabot Auto-merge
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: dependabot-metadata
        uses: dependabot/fetch-metadata@v2

      - name: Enable auto-merge for patch and minor updates
        if: |
          steps.dependabot-metadata.outputs.update-type == 'version-update:semver-patch' ||
          steps.dependabot-metadata.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5. Scripts NPM e Configuração de Build

### 5.1 `package.json` — Scripts Completos

Certifique-se de que o `package.json` contém todos estes scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write '**/*.{ts,tsx,md,json,yml}'",
    "format:check": "prettier --check '**/*.{ts,tsx,md,json,yml}'",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "prepare": "husky",
    "firebase:emulators": "firebase emulators:start",
    "firebase:deploy": "firebase deploy",
    "firebase:deploy:functions": "firebase deploy --only functions",
    "firebase:deploy:hosting": "firebase deploy --only hosting",
    "firebase:deploy:rules": "firebase deploy --only firestore:rules,storage:rules",
    "firebase:deploy:indexes": "firebase deploy --only firestore:indexes"
  }
}
```

### 5.2 Configuração do TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 5.3 Configuração do ESLint (`eslint.config.js` ou `.eslintrc.json`)

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"]
  },
  "ignorePatterns": ["node_modules/", ".next/", "coverage/", "dist/"]
}
```

### 5.4 Configuração do Prettier (`.prettierrc`)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Arquivo:** `.prettierignore`

```
node_modules
.next
coverage
dist
*.lock
```

---

## 6. Pre-commit Hooks (Husky + lint-staged)

Pre-commit hooks garantem que código com erros **nunca chegue ao repositório**. Prática adotada por Google, Facebook e Airbnb.

### 6.1 Instalação

```bash
# Instalar Husky e lint-staged
npm install --save-dev husky lint-staged

# Inicializar Husky
npx husky init
```

### 6.2 Configuração do Husky

**Arquivo:** `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Executar lint-staged
npx lint-staged

# Verificar tipos TypeScript (rápido, apenas arquivos staged)
echo "🔷 Verificando tipos TypeScript..."
npx tsc --noEmit --skipLibCheck
```

**Arquivo:** `.husky/commit-msg`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Validar formato do commit (Conventional Commits)
npx --no -- commitlint --edit "$1"
```

### 6.3 Configuração do lint-staged

**Arquivo:** `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix --max-warnings=0", "prettier --write"],
  "*.{md,json,yml,yaml}": ["prettier --write"],
  "*.css": ["prettier --write"]
}
```

### 6.4 Configuração do commitlint

```bash
# Instalar commitlint
npm install --save-dev @commitlint/cli @commitlint/config-conventional
```

**Arquivo:** `commitlint.config.js`

```js
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'auth',
        'inventory',
        'requests',
        'reports',
        'admin',
        'dashboard',
        'tenant',
        'firebase',
        'api',
        'ui',
        'types',
        'hooks',
        'config',
        'deploy',
        'deps',
      ],
    ],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
```

### 6.5 Verificar Instalação

```bash
# Testar hook manualmente
echo "feat(inventory): test commit" | npx commitlint

# Forçar execução do pre-commit
npx husky run pre-commit

# Verificar se hooks estão instalados
ls -la .husky/
```

---

## 7. Templates de Pull Request e Diretrizes

### 7.1 Template Principal

**Arquivo:** `.github/pull_request_template.md`

```markdown
## 📝 Descrição

<!-- Descreva as mudanças realizadas neste PR de forma clara e concisa. -->
<!-- Responda: O QUÊ foi feito? POR QUÊ foi necessário? COMO foi implementado? -->

## 🎯 Tipo de Mudança

- [ ] 🐛 **Bug fix** — correção que não quebra funcionalidade existente
- [ ] ✨ **Feature** — nova funcionalidade (não-breaking)
- [ ] 💥 **Breaking change** — mudança que quebra funcionalidade existente
- [ ] 📚 **Documentação** — apenas mudanças em docs
- [ ] 🔄 **Refatoração** — sem mudança de comportamento
- [ ] ⚡ **Performance** — melhoria de performance
- [ ] 🔐 **Segurança** — correção de vulnerabilidade
- [ ] 🔧 **Chore** — dependências, build, CI

## 🔗 Issues Relacionadas

<!-- Use "Closes #N" para fechar automaticamente a issue ao mergear -->

Closes #<!-- número da issue -->

## 🧪 Como Testar

<!-- Descreva os passos para testar suas mudanças -->

1. Clone a branch: `git checkout feature/nome-da-feature`
2. Instale dependências: `npm install`
3. Inicie o ambiente: `npm run dev`
4. Navegue para: `http://localhost:3000/...`
5. Verifique: <!-- comportamento esperado -->

## ✅ Checklist do Autor

### Qualidade de Código

- [ ] Executei `npm run lint` sem erros
- [ ] Executei `npm run format:check` sem erros
- [ ] Executei `npm run type-check` sem erros
- [ ] Código segue os padrões e convenções do projeto

### Testes

- [ ] Adicionei/atualizei testes para as mudanças realizadas
- [ ] Todos os testes passam localmente (`npm run test`)
- [ ] Cobertura de testes não reduziu

### Build e Deploy

- [ ] Build passa sem erros (`npm run build`)
- [ ] Não há erros ou warnings no console durante execução
- [ ] Variáveis de ambiente necessárias estão documentadas em `.env.example`

### Segurança (Multi-Tenant)

- [ ] Todas as queries Firestore incluem `tenant_id` no filtro
- [ ] Nenhuma credencial ou secret foi commitada
- [ ] Regras de segurança Firestore foram respeitadas

### Documentação

- [ ] Commits seguem o padrão Conventional Commits
- [ ] CHANGELOG ou doc atualizado (se necessário)
- [ ] README atualizado (se necessário)

## 📸 Screenshots / Evidências

<!-- Para mudanças de UI, inclua screenshots antes/depois -->
<!-- Para changes de API/lógica, inclua logs ou outputs relevantes -->

| Antes        | Depois       |
| ------------ | ------------ |
| _screenshot_ | _screenshot_ |

## 🚀 Notas de Deploy

<!-- Há migrações de banco? Variáveis de ambiente novas? Configurações especiais? -->
<!-- Exemplo: Adicionar NEXT_PUBLIC_FEATURE_FLAG=true no Vercel/Firebase Hosting -->

- [ ] Nenhuma ação especial necessária
- [ ] Requer configuração adicional: <!-- descreva aqui -->
```

### 7.2 Diretrizes para Pull Requests

**Boas práticas (baseadas em Google, GitHub e Airbnb):**

- **Tamanho:** PRs devem ter no máximo **400 linhas** de mudança. PRs maiores devem ser divididos.
- **Título:** Siga Conventional Commits — o título do PR vira o commit de merge.
- **Descrição:** Sempre preencha a descrição. "Ver código" não é uma descrição.
- **Self-review:** Faça uma revisão no próprio PR antes de solicitar revisores.
- **Draft PRs:** Use `Draft PR` para trabalho em progresso que precisa de feedback inicial.
- **Labels:** Aplique labels relevantes (`bug`, `feature`, `breaking-change`, etc.).
- **Linkagem:** Sempre linke à issue correspondente.

---

## 8. Templates de Issue (Bug Reports e Feature Requests)

### 8.1 Template de Bug Report

**Arquivo:** `.github/ISSUE_TEMPLATE/bug_report.yml`

```yaml
name: 🐛 Bug Report
description: Reporte um bug encontrado no sistema
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Obrigado por reportar um bug! Preencha os campos abaixo com o máximo de detalhes possível.

  - type: textarea
    id: description
    attributes:
      label: 📋 Descrição do Bug
      description: Descreva o bug de forma clara e concisa
      placeholder: 'O que está acontecendo de errado?'
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: 🔄 Como Reproduzir
      description: Passos para reproduzir o comportamento
      placeholder: |
        1. Acesse '...'
        2. Clique em '...'
        3. Preencha o campo '...' com '...'
        4. Veja o erro
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: ✅ Comportamento Esperado
      description: O que deveria acontecer?
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: ❌ Comportamento Atual
      description: O que está acontecendo de fato?
    validations:
      required: true

  - type: dropdown
    id: severity
    attributes:
      label: 🔥 Severidade
      options:
        - Crítico (sistema inoperável)
        - Alto (funcionalidade principal afetada)
        - Médio (funcionalidade afetada com workaround)
        - Baixo (cosmético / minor)
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: 🏷️ Versão
      description: Versão do sistema onde o bug ocorre
      placeholder: 'ex: v1.2.0 ou SHA do commit'
    validations:
      required: false

  - type: dropdown
    id: browser
    attributes:
      label: 🌐 Navegador
      options:
        - Chrome
        - Firefox
        - Safari
        - Edge
        - Outro
    validations:
      required: false

  - type: input
    id: os
    attributes:
      label: 💻 Sistema Operacional
      placeholder: 'ex: macOS 14, Windows 11, Ubuntu 22.04'

  - type: textarea
    id: logs
    attributes:
      label: 📎 Logs / Screenshots
      description: Cole logs do console, screenshots ou outros evidências
      render: shell

  - type: textarea
    id: context
    attributes:
      label: 📝 Contexto Adicional
      description: Qualquer outra informação relevante
```

### 8.2 Template de Feature Request

**Arquivo:** `.github/ISSUE_TEMPLATE/feature_request.yml`

```yaml
name: ✨ Feature Request
description: Solicite uma nova funcionalidade ou melhoria
title: '[FEAT] '
labels: ['enhancement', 'needs-triage']

body:
  - type: markdown
    attributes:
      value: |
        Tem uma ideia para melhorar o Curva Mestra? Adoramos feedback! Descreva abaixo.

  - type: textarea
    id: problem
    attributes:
      label: 🎯 Problema que esta feature resolve
      description: Descreva o problema ou necessidade que motivou este pedido
      placeholder: 'Atualmente não consigo fazer X, o que me obriga a Y...'
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: 💡 Solução Proposta
      description: Descreva a solução que você gostaria de ver implementada
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: 🔄 Alternativas Consideradas
      description: Você considerou outras abordagens? Quais?

  - type: dropdown
    id: priority
    attributes:
      label: 📊 Prioridade Estimada
      options:
        - Alta (bloqueia fluxo principal)
        - Média (melhoria significativa)
        - Baixa (nice-to-have)
    validations:
      required: true

  - type: dropdown
    id: area
    attributes:
      label: 📦 Área do Sistema
      options:
        - Inventário
        - Solicitações / Procedimentos
        - Relatórios
        - Autenticação
        - Painel Admin
        - Dashboard
        - Multi-tenant
        - Performance
        - Documentação
        - Outro
    validations:
      required: true

  - type: textarea
    id: acceptance-criteria
    attributes:
      label: ✅ Critérios de Aceite
      description: Como saberemos que esta feature foi implementada corretamente?
      placeholder: |
        - [ ] Critério 1
        - [ ] Critério 2
        - [ ] Critério 3

  - type: textarea
    id: context
    attributes:
      label: 📝 Contexto Adicional
      description: Mockups, exemplos de outros produtos, links relevantes
```

### 8.3 Arquivo de Configuração dos Templates

**Arquivo:** `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: 💬 Discussões
    url: https://github.com/GScandelari/curva_mestra_system/discussions
    about: Para dúvidas gerais, use as Discussões do GitHub
  - name: 📚 Documentação
    url: https://github.com/GScandelari/curva_mestra_system/tree/master/ONLY_FOR_DEVS
    about: Consulte a documentação antes de abrir uma issue
```

---

## 9. Padrões de Code Review e Checklist

### 9.1 Filosofia de Code Review

> **O objetivo do code review não é encontrar bugs — é compartilhar conhecimento, garantir qualidade e manter o padrão do projeto.**

Baseado nas práticas do Google ([Google Engineering Practices](https://google.github.io/eng-practices/review/)):

- **Seja respeitoso:** Critique o código, nunca a pessoa.
- **Seja construtivo:** Sempre sugira uma alternativa quando criticar.
- **Seja rápido:** Responda PRs em no máximo 24h em dias úteis.
- **Seja preciso:** Diferencie bloqueadores de sugestões.

### 9.2 Prefixos de Comentários em PRs

| Prefixo        | Significado                               | Bloqueia merge? |
| -------------- | ----------------------------------------- | --------------- |
| `[BLOCKER]`    | Deve ser corrigido antes do merge         | ✅ Sim          |
| `[SUGGESTION]` | Melhoria recomendada, mas não obrigatória | ❌ Não          |
| `[QUESTION]`   | Dúvida genuína sobre a abordagem          | ❌ Não          |
| `[NIT]`        | Detalhe minor (nitpick)                   | ❌ Não          |
| `[PRAISE]`     | Reconhecimento de boa prática             | ❌ Não          |

**Exemplo de comentário de qualidade:**

````
[BLOCKER] Esta query Firestore não filtra por tenant_id:

```ts
const docs = await db.collection('inventory').get();
````

Isso expõe dados de todos os tenants. Corrija para:

```ts
const docs = await db.collection('tenants').doc(tenantId).collection('inventory').get();
```

Veja a regra multi-tenant em ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md#multi-tenant.

````

### 9.3 Checklist para Revisores

```markdown
## 🔍 Checklist do Revisor

### Funcionalidade
- [ ] O código faz exatamente o que a descrição do PR afirma?
- [ ] O caso de uso principal funciona corretamente?
- [ ] Casos extremos (edge cases) foram considerados?
- [ ] Há tratamento de erros adequado?

### Qualidade de Código
- [ ] O código é fácil de entender sem comentários excessivos?
- [ ] Nomes de variáveis/funções são descritivos?
- [ ] Não há duplicação de código (DRY)?
- [ ] Complexidade ciclomática está aceitável?
- [ ] Sem `any` em TypeScript?

### Arquitetura e Design
- [ ] A solução é a mais simples possível (KISS)?
- [ ] Segue os padrões arquiteturais do projeto?
- [ ] Separação de responsabilidades está clara?
- [ ] Não introduz dependências desnecessárias?

### Segurança (Crítico para SaaS Multi-Tenant)
- [ ] Todas as queries Firestore filtram por `tenant_id`?
- [ ] Nenhuma credencial ou secret está no código?
- [ ] Inputs do usuário são validados com Zod?
- [ ] Permissões/roles foram verificados antes de operações sensíveis?

### Performance
- [ ] Não há loops desnecessários ou operações O(n²)?
- [ ] Queries Firestore têm índices adequados?
- [ ] Componentes React têm memoização onde necessário?
- [ ] Imagens são otimizadas (next/image)?

### Testes
- [ ] Existem testes para a nova funcionalidade?
- [ ] Testes cobrem casos de sucesso e falha?
- [ ] Mocks estão adequados?

### Documentação
- [ ] Lógica complexa tem comentários explicativos?
- [ ] JSDoc para funções públicas?
- [ ] README/docs atualizados se necessário?

### Observações do Revisor
<!-- Suas notas livres aqui -->
````

### 9.4 Tempo de Resposta Esperado

| Situação                              | SLA                           |
| ------------------------------------- | ----------------------------- |
| PR aberto (primeira revisão)          | 24h úteis                     |
| Resposta a comentários do reviewer    | 48h úteis                     |
| PR bloqueado aguardando infra/decisão | Comunicar em #dev Slack/Teams |
| Hotfix crítico                        | 4h                            |

---

## 10. Configuração de CODEOWNERS

O arquivo `CODEOWNERS` define revisores automáticos baseados em caminhos de arquivo. Integrado com Branch Protection Rules.

### 10.1 Arquivo CODEOWNERS

**Arquivo:** `.github/CODEOWNERS`

```
# ============================================================
# CODEOWNERS - Curva Mestra System
# Revisores automáticos por área do código
# Formato: <padrão>  @<usuário/equipe>
# ============================================================

# Padrão: todos os arquivos
* @GScandelari

# ============================================================
# ÁREAS CRÍTICAS — Requerem atenção especial
# ============================================================

# Regras de segurança Firestore (CRÍTICO)
/firestore.rules @GScandelari
/storage.rules @GScandelari
/firestore.indexes.json @GScandelari

# Configurações Firebase
/firebase.json @GScandelari
/.firebaserc @GScandelari

# Autenticação e multi-tenant
/src/lib/firebase.ts @GScandelari
/src/hooks/useTenant.ts @GScandelari
/src/lib/auth/ @GScandelari

# ============================================================
# MÓDULOS DE NEGÓCIO
# ============================================================

# Inventário (módulo principal)
/src/app/(clinic)/clinic/inventory/ @GScandelari
/src/lib/services/inventoryService.ts @GScandelari

# Solicitações / Procedimentos
/src/app/(clinic)/clinic/requests/ @GScandelari
/src/lib/services/solicitacaoService.ts @GScandelari

# Relatórios
/src/app/(clinic)/clinic/reports/ @GScandelari
/src/lib/services/reportService.ts @GScandelari

# Admin
/src/app/(admin)/ @GScandelari

# ============================================================
# INFRAESTRUTURA E CI/CD
# ============================================================

# GitHub Actions
/.github/workflows/ @GScandelari

# Configurações de build
/next.config.ts @GScandelari
/tsconfig.json @GScandelari
/package.json @GScandelari

# ============================================================
# DOCUMENTAÇÃO
# ============================================================

/ONLY_FOR_DEVS/ @GScandelari
/README.md @GScandelari
/CONTRIBUTING.md @GScandelari
*.md @GScandelari
```

---

## 11. Guia de Contribuição (CONTRIBUTING.md)

**Arquivo:** `CONTRIBUTING.md` (na raiz do projeto)

````markdown
# 🤝 Guia de Contribuição — Curva Mestra System

Obrigado por contribuir! Este guia explica como participar do desenvolvimento.

## 📋 Pré-requisitos

- Node.js 20 (use `.nvmrc`: `nvm use`)
- npm >= 10
- Git >= 2.40
- Firebase CLI: `npm install -g firebase-tools`
- Conta no Firebase com acesso ao projeto (solicitar ao tech lead)

## 🚀 Setup Inicial

Veja a seção completa em [Setup do Ambiente](#12-instruções-de-setup-do-ambiente-de-desenvolvimento) deste guia.

```bash
git clone https://github.com/GScandelari/curva_mestra_system.git
cd curva_mestra_system
nvm use
npm install
cp .env.example .env.local
# Preencha .env.local com os valores do Firebase dev
npm run dev
```
````

## 🌿 Workflow de Contribuição

### 1. Crie ou escolha uma Issue

- Verifique se já existe uma issue para sua mudança
- Se não existe, crie uma com o template adequado
- Assign a você mesmo antes de começar

### 2. Crie uma Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nome-descritivo-kebab-case
```

### 3. Desenvolva

- Faça commits pequenos e atômicos
- Use Conventional Commits (ver seção 2)
- Mantenha sua branch atualizada: `git rebase origin/develop`

### 4. Antes de abrir o PR

```bash
npm run lint          # Sem erros de lint
npm run type-check    # Sem erros TypeScript
npm run test          # Todos os testes passam
npm run build         # Build sem erros
```

### 5. Abra o Pull Request

- Preencha o template de PR completamente
- Linke à issue com "Closes #N"
- Adicione screenshots para mudanças de UI
- Solicite review de pelo menos 1 colaborador

### 6. Responda ao Feedback

- Responda a todos os comentários
- Marque como resolvido após corrigir
- Faça rebase após mudanças significativas

## 📝 Padrões de Código

### TypeScript

- **Sem `any`**: Use tipos explícitos sempre
- **Interfaces > Types** para objetos públicos
- **Zod** para validação de dados externos

```typescript
// ✅ Correto
interface CreateInventoryInput {
  productId: string;
  quantity: number;
  batchNumber: string;
  expirationDate: Date;
}

// ❌ Incorreto
const createInventory = (data: any) => { ... }
```

### React / Next.js

- **Server Components** por padrão, `'use client'` apenas quando necessário
- **`next/image`** para todas as imagens
- **`next/link`** para navegação interna
- Evite `useEffect` desnecessários

### Firebase / Firestore

- **SEMPRE** filtre por `tenant_id` em queries
- Use **transações** para operações que envolvem múltiplos documentos
- **Nunca** exponha Firebase config em logs

```typescript
// ✅ Correto — multi-tenant seguro
const getInventory = async (tenantId: string) => {
  return db
    .collection('tenants')
    .doc(tenantId)
    .collection('inventory')
    .where('active', '==', true)
    .get();
};

// ❌ NUNCA faça isso
const getInventory = async () => {
  return db.collectionGroup('inventory').get(); // expõe todos os tenants!
};
```

### Naming Conventions

| Elemento                | Convenção              | Exemplo              |
| ----------------------- | ---------------------- | -------------------- |
| Arquivos de componentes | `PascalCase.tsx`       | `InventoryTable.tsx` |
| Arquivos de utilitários | `camelCase.ts`         | `formatDate.ts`      |
| Hooks                   | `useCamelCase.ts`      | `useInventory.ts`    |
| Tipos/Interfaces        | `PascalCase`           | `InventoryItem`      |
| Variáveis/Funções       | `camelCase`            | `getInventory()`     |
| Constantes              | `UPPER_SNAKE_CASE`     | `MAX_BATCH_SIZE`     |
| CSS classes (Tailwind)  | Sem convenção especial | —                    |

## 🔐 Segurança

- **NUNCA** commite secrets, tokens ou credenciais
- Qualquer variável de ambiente deve estar em `.env.example` com valor fake
- Use `NEXT_PUBLIC_` apenas para variáveis seguras para o frontend
- Relate vulnerabilidades diretamente ao tech lead (não abra issue pública)

## ❓ Dúvidas?

- Consulte primeiro este guia e o `README.md`
- Abra uma [Discussão](https://github.com/GScandelari/curva_mestra_system/discussions)
- Contate o tech lead no canal `#dev` do Slack/Teams

````

---

## 12. Instruções de Setup do Ambiente de Desenvolvimento

### 12.1 Requisitos do Sistema

| Ferramenta | Versão Mínima | Como Verificar | Como Instalar |
|-----------|---------------|----------------|---------------|
| Node.js | 20.x | `node --version` | [nvm](https://github.com/nvm-sh/nvm) ou [nodejs.org](https://nodejs.org) |
| npm | 10.x | `npm --version` | Incluído com Node.js |
| Git | 2.40+ | `git --version` | [git-scm.com](https://git-scm.com) |
| Firebase CLI | 13.x | `firebase --version` | `npm i -g firebase-tools` |
| VS Code | Qualquer | — | [code.visualstudio.com](https://code.visualstudio.com) |

### 12.2 Passo a Passo: Setup Local

```bash
# ── 1. Clonar o repositório ──────────────────────────────────
git clone https://github.com/GScandelari/curva_mestra_system.git
cd curva_mestra_system

# ── 2. Usar versão correta do Node.js ───────────────────────
nvm install    # instala a versão do .nvmrc
nvm use        # ativa a versão

# ── 3. Instalar dependências ─────────────────────────────────
npm install    # instala tudo + configura Husky automaticamente

# ── 4. Configurar variáveis de ambiente ──────────────────────
cp .env.example .env.local
# Edite .env.local com as credenciais do Firebase DEV
# (solicite os valores ao tech lead)

# ── 5. Iniciar os emuladores Firebase (opcional mas recomendado) ──
npm run firebase:emulators

# ── 6. Iniciar o servidor de desenvolvimento ─────────────────
npm run dev
# Acesse: http://localhost:3000

# ── 7. Verificar que tudo está funcionando ───────────────────
npm run lint       # sem erros
npm run type-check # sem erros TypeScript
npm run build      # build completo
````

### 12.3 Variáveis de Ambiente Necessárias

**Arquivo:** `.env.example` (sem valores reais — apenas estrutura)

```bash
# ── Firebase Configuration ────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:0000000000000000

# ── Firebase Admin (Server-side only — NUNCA no frontend) ────
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ── App Configuration ─────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 12.4 Extensões Recomendadas do VS Code

**Arquivo:** `.vscode/extensions.json`

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "streetsidesoftware.code-spell-checker-portuguese-brazilian",
    "eamodio.gitlens",
    "mhutchie.git-graph",
    "tinkertrain.theme-panda",
    "pkief.material-icon-theme"
  ]
}
```

**Arquivo:** `.vscode/settings.json`

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "editor.rulers": [100],
  "files.eol": "\n",
  "files.insertFinalNewline": true
}
```

### 12.5 Usando os Emuladores Firebase

```bash
# Iniciar todos os emuladores
npm run firebase:emulators

# Emuladores disponíveis:
# - Auth:      http://localhost:9099
# - Firestore: http://localhost:8080
# - Storage:   http://localhost:9199
# - Functions: http://localhost:5001
# - UI:        http://localhost:4000
```

Para conectar o app local aos emuladores, defina no `.env.local`:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

---

## 13. Monitoramento e Métricas (Badges e Dashboards)

### 13.1 Badges para o README.md

Adicione ao topo do `README.md` para visibilidade do status do projeto:

```markdown
<!-- Badges de CI/CD -->

[![CI Pipeline](https://github.com/GScandelari/curva_mestra_system/actions/workflows/ci.yml/badge.svg)](https://github.com/GScandelari/curva_mestra_system/actions/workflows/ci.yml)
[![Security Check](https://github.com/GScandelari/curva_mestra_system/actions/workflows/security.yml/badge.svg)](https://github.com/GScandelari/curva_mestra_system/actions/workflows/security.yml)

<!-- Qualidade de Código -->

[![codecov](https://codecov.io/gh/GScandelari/curva_mestra_system/branch/master/graph/badge.svg)](https://codecov.io/gh/GScandelari/curva_mestra_system)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=GScandelari_curva_mestra_system&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=GScandelari_curva_mestra_system)

<!-- Metadados -->

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-20.x-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
```

### 13.2 Configuração do SonarCloud

**Arquivo:** `sonar-project.properties`

```properties
sonar.projectKey=GScandelari_curva_mestra_system
sonar.organization=gscandelari
sonar.projectName=Curva Mestra System

# Source
sonar.sources=src
sonar.exclusions=**/*.test.ts,**/*.test.tsx,**/__tests__/**,**/node_modules/**,.next/**

# Tests
sonar.tests=src
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# Quality Gates
sonar.qualitygate.wait=true
```

### 13.3 Dashboard de Métricas (Insights GitHub)

Acesse `Insights → Actions` para monitorar:

- Taxa de sucesso de workflows
- Tempo médio de execução por job
- Falhas por tipo de job

**Métricas recomendadas para acompanhar:**

| Métrica                      | Meta     | Frequência |
| ---------------------------- | -------- | ---------- |
| Taxa de CI verde             | > 95%    | Semanal    |
| Tempo médio de CI            | < 8 min  | Semanal    |
| Cobertura de testes          | > 70%    | Por PR     |
| Vulnerabilidades críticas    | 0        | Contínuo   |
| PRs abertos sem review > 24h | 0        | Diário     |
| Dívida técnica SonarCloud    | < 5 dias | Mensal     |

### 13.4 Alertas e Notificações

Configure notificações em `Settings → Notifications` para receber alertas de:

- Falhas no workflow de CI
- Novas vulnerabilidades detectadas
- PRs aguardando sua revisão há mais de 24h
- Releases criadas automaticamente

---

## 14. Melhores Práticas de Configuração do Repositório

### 14.1 Settings Recomendados (`Settings → General`)

```yaml
Repository Settings:
  Features:
    ✅ Issues: habilitado
    ✅ Projects: habilitado (para Kanban/Sprint)
    ✅ Wiki: desabilitado (usar ONLY_FOR_DEVS em vez disso)
    ✅ Discussions: habilitado (para Q&A da comunidade)
    ✅ Sponsorships: desabilitado

  Pull Requests:
    ✅ Allow merge commits: false (use squash ou rebase)
    ✅ Allow squash merging: true
        Default message: Pull request title and description
    ✅ Allow rebase merging: true
    ✅ Always suggest updating pull request branches: true
    ✅ Allow auto-merge: true (para Dependabot)
    ✅ Automatically delete head branches: true

  Danger Zone:
    Visibility: Private (repositório de SaaS)
```

### 14.2 Labels Recomendadas

Crie as seguintes labels em `Issues → Labels`:

```yaml
# Tipo
- bug: #d73a4a  # Algo está quebrado
- enhancement: #a2eeef  # Nova funcionalidade ou melhoria
- documentation: #0075ca  # Melhorias ou adições à documentação
- question: #d876e3  # Precisa de mais informações

# Prioridade
- priority:critical: #b60205  # Bloqueia usuários em produção
- priority:high: #e4e669  # Alta importância
- priority:medium: #fbca04  # Prioridade média
- priority:low: #0e8a16  # Pode esperar

# Status
- needs-triage: #ededed  # Aguardando classificação
- in-progress: #0075ca  # Em desenvolvimento
- blocked: #d93f0b  # Bloqueado por dependência
- wont-fix: #ffffff  # Decisão de não corrigir

# Área
- area:inventory: #5319e7  # Módulo de inventário
- area:auth: #e4e669  # Autenticação
- area:reports: #1d76db  # Relatórios
- area:admin: #0075ca  # Painel admin
- area:infra: #ededed  # Infraestrutura/CI

# Automação
- automated: #cfd3d7  # Criado por bot (Dependabot etc.)
- dependencies: #0075ca  # Atualização de dependências
```

### 14.3 Milestones e Projects

**Milestones** para organizar releases:

- `v1.0.0 - MVP` — Funcionalidades mínimas para lançamento
- `v1.1.0 - Reports` — Módulo de relatórios completo
- `v1.2.0 - Notifications` — Alertas de vencimento

**Projects (GitHub Projects v2)** para gestão ágil:

- Coluna `Backlog` — Issues abertas sem sprint
- Coluna `Sprint N` — Issues do sprint atual
- Coluna `Em Progresso` — PRs abertos
- Coluna `Em Review` — PRs aguardando revisão
- Coluna `Concluído` — Mergeados no sprint

### 14.4 Environments (Ambientes de Deploy)

Configure em `Settings → Environments`:

```yaml
Environments:
  development:
    Protection rules: none
    Secrets:
      FIREBASE_TOKEN: <token do ambiente dev>
    Variables:
      FIREBASE_PROJECT_ID: curva-mestra-dev

  staging:
    Protection rules:
      - Required reviewers: @GScandelari
    Secrets:
      FIREBASE_TOKEN: <token do ambiente staging>
    Variables:
      FIREBASE_PROJECT_ID: curva-mestra-staging

  production:
    Protection rules:
      - Required reviewers: @GScandelari (2 revisores)
      - Wait timer: 5 minutes
    Secrets:
      FIREBASE_TOKEN: <token do ambiente prod>
    Variables:
      FIREBASE_PROJECT_ID: curva-mestra-prod
```

### 14.5 Secrets Necessários

Configure em `Settings → Secrets and variables → Actions`:

| Secret           | Descrição                         | Obrigatório    |
| ---------------- | --------------------------------- | -------------- |
| `FIREBASE_TOKEN` | Token do Firebase CLI para deploy | ✅             |
| `SONAR_TOKEN`    | Token do SonarCloud               | ⚠️ Recomendado |
| `CODECOV_TOKEN`  | Token do Codecov                  | ⚠️ Recomendado |

```bash
# Gerar Firebase Token
firebase login:ci
# Cole o token gerado em Settings → Secrets → FIREBASE_TOKEN
```

---

## Checklist de Implementação

Use este checklist para configurar o repositório do zero ou verificar o status atual:

### Fase 1: Fundação (Obrigatório antes do primeiro colaborador)

- [ ] **Branch `develop` criada** a partir de `master`
- [ ] **Branch Protection Rules** configuradas para `master` (seção 3.2)
- [ ] **Branch Protection Rules** configuradas para `develop` (seção 3.3)
- [ ] **`.github/CODEOWNERS`** criado (seção 10.1)
- [ ] **`.github/pull_request_template.md`** criado (seção 7.1)
- [ ] **`.github/ISSUE_TEMPLATE/`** criado com templates (seção 8)
- [ ] **`CONTRIBUTING.md`** criado na raiz (seção 11)

### Fase 2: Automação CI/CD

- [ ] **`.github/workflows/ci.yml`** criado e funcionando (seção 4.1)
- [ ] **`.github/workflows/security.yml`** criado (seção 4.2)
- [ ] **`.github/workflows/release.yml`** criado (seção 4.3)
- [ ] **`.github/dependabot.yml`** configurado (seção 4.4)
- [ ] **`.github/workflows/dependabot-auto-merge.yml`** criado (seção 4.4)
- [ ] **Status checks** adicionados ao Branch Protection (seção 3.2)
- [ ] **Secrets** configurados no repositório (seção 14.5)

### Fase 3: Qualidade de Código Local

- [ ] **Husky** instalado (`npm install --save-dev husky`)
- [ ] **lint-staged** instalado e configurado (seção 6.3)
- [ ] **commitlint** instalado e configurado (seção 6.4)
- [ ] **`.husky/pre-commit`** criado (seção 6.2)
- [ ] **`.husky/commit-msg`** criado (seção 6.2)
- [ ] **ESLint** configurado (seção 5.3)
- [ ] **Prettier** configurado (seção 5.4)
- [ ] **Scripts NPM** todos adicionados ao `package.json` (seção 5.1)

### Fase 4: Observabilidade

- [ ] **SonarCloud** configurado (seção 13.2)
- [ ] **Codecov** integrado ao workflow CI (seção 4.1)
- [ ] **Badges** adicionados ao `README.md` (seção 13.1)
- [ ] **Labels** criadas no repositório (seção 14.2)
- [ ] **Environments** configurados (seção 14.3)

### Fase 5: Configurações do Repositório

- [ ] **Settings → General**: merge strategy configurada (seção 14.1)
- [ ] **Auto-delete branches** habilitado
- [ ] **GitHub Discussions** habilitado
- [ ] **Milestones** iniciais criadas

---

## Referência Rápida

### Comandos Mais Usados

```bash
# Desenvolvimento diário
npm run dev              # Servidor local
npm run lint             # Verificar linting
npm run lint:fix         # Corrigir linting automaticamente
npm run type-check       # Verificar tipos TypeScript
npm run format           # Formatar código
npm run format:check     # Verificar formatação
npm run test             # Rodar testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Testes com cobertura
npm run build            # Build de produção

# Firebase
npm run firebase:emulators       # Iniciar emuladores locais
npm run firebase:deploy          # Deploy completo
npm run firebase:deploy:functions # Deploy apenas functions
npm run firebase:deploy:rules    # Deploy apenas regras

# Git (fluxo diário)
git checkout develop && git pull origin develop
git checkout -b feature/nome-da-feature
git add -p                       # Commit interativo por hunks
git commit -m "feat(scope): description"
git rebase origin/develop        # Manter branch atualizada
git push origin feature/nome-da-feature
```

### Tipos de Commit (Referência Rápida)

```
feat     → nova funcionalidade
fix      → correção de bug
docs     → documentação
style    → formatação (sem mudança de lógica)
refactor → refatoração
perf     → performance
test     → testes
chore    → build, deps, config
ci       → CI/CD
revert   → reverter commit
```

### Prefixos de Branch (Referência Rápida)

```
feature/   → nova funcionalidade
bugfix/    → correção não-crítica
hotfix/    → correção crítica em prod
release/   → preparação de release
chore/     → manutenção/infra
```

---

## Troubleshooting

### ❌ Problema: `npm run lint` falha com erros de parsing

```bash
# Verifique a versão do Node.js
node --version  # deve ser 20.x

# Limpe cache do ESLint
npx eslint --cache-location .eslintcache . --cache
rm -rf .eslintcache

# Reinstale dependências
rm -rf node_modules package-lock.json
npm install
```

### ❌ Problema: Husky hooks não estão executando

```bash
# Reinstale Husky
npx husky install

# Verifique permissões dos hooks
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg

# Teste manualmente
npx husky run pre-commit
```

### ❌ Problema: `npm run build` falha em CI mas passa localmente

```bash
# Verifique se .env.local está correto (não comitado)
# No CI, as variáveis vêm de secrets/vars do GitHub Actions

# Verifique se todas as variáveis NEXT_PUBLIC_ estão no workflow:
# env:
#   NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
```

### ❌ Problema: Firebase emuladores não iniciam

```bash
# Verifique a versão do Firebase CLI
firebase --version  # deve ser 13.x+

# Reinstale Firebase CLI
npm install -g firebase-tools@latest

# Faça login novamente
firebase login

# Verifique o arquivo firebase.json
cat firebase.json  # deve ter configuração de emulators
```

### ❌ Problema: `type-check` falha com erros de tipos

```bash
# Limpe cache do TypeScript
rm -rf .next tsconfig.tsbuildinfo

# Verifique se todas as dependências de tipos estão instaladas
npm install

# Execute em modo verbose para ver detalhes
npx tsc --noEmit --diagnostics
```

### ❌ Problema: commitlint rejeita mensagem de commit

```bash
# Verifique o formato correto
# CORRETO:  feat(inventory): add expiration validation
# ERRADO:   "added expiration validation"

# Teste sua mensagem antes de commitar
echo "feat(inventory): add expiration validation" | npx commitlint

# Ver escopos permitidos
cat commitlint.config.js
```

### ❌ Problema: PR sendo bloqueado por status checks

```bash
# Veja quais checks estão falhando na aba "Checks" do PR
# Execute o check que falhou localmente:

npm run lint       # Se o check "lint" falhou
npm run type-check # Se o check "type-check" falhou
npm run test       # Se o check "test" falhou
npm run build      # Se o check "build" falhou
```

---

## Recursos Externos

### Documentação Oficial

| Recurso                  | URL                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Conventional Commits     | https://www.conventionalcommits.org/pt-br/                                                                                            |
| Git Flow (Atlassian)     | https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow                                                          |
| GitHub Actions           | https://docs.github.com/en/actions                                                                                                    |
| GitHub Branch Protection | https://docs.github.com/en/repositories/configuring-branches-and-merges                                                               |
| Dependabot               | https://docs.github.com/en/code-security/dependabot                                                                                   |
| CODEOWNERS               | https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners |
| Husky                    | https://typicode.github.io/husky/                                                                                                     |
| lint-staged              | https://github.com/lint-staged/lint-staged                                                                                            |
| commitlint               | https://commitlint.js.org/                                                                                                            |
| SonarCloud               | https://docs.sonarcloud.io/                                                                                                           |
| Codecov                  | https://docs.codecov.com/                                                                                                             |

### Guias de Boas Práticas

| Recurso                                    | URL                                                   |
| ------------------------------------------ | ----------------------------------------------------- |
| Google Engineering Practices (Code Review) | https://google.github.io/eng-practices/review/        |
| Airbnb JavaScript Style Guide              | https://github.com/airbnb/javascript                  |
| Facebook/Meta Open Source                  | https://opensource.fb.com/                            |
| GitHub's Engineering Blog                  | https://github.blog/engineering/                      |
| Next.js Best Practices                     | https://nextjs.org/docs/app/building-your-application |
| Firebase Security Rules                    | https://firebase.google.com/docs/rules                |

### Ferramentas Complementares

| Ferramenta     | Propósito                            | URL                                          |
| -------------- | ------------------------------------ | -------------------------------------------- |
| Release Please | Versionamento semântico automático   | https://github.com/googleapis/release-please |
| Codecov        | Relatórios de cobertura de testes    | https://codecov.io                           |
| SonarCloud     | Análise estática de código           | https://sonarcloud.io                        |
| Snyk           | Análise de segurança de dependências | https://snyk.io                              |
| Renovate       | Alternativa ao Dependabot            | https://docs.renovatebot.com                 |

---

_Documento mantido por @GScandelari — Abra uma issue com a label `documentation` para sugestões ou correções._

_Última atualização: Abril/2026 | Versão do documento: 1.0.0_
