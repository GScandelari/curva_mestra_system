# Bug Fix: CI Build — Firebase auth/invalid-api-key na pré-renderização estática

**Projeto:** Curva Mestra
**Data:** 01/05/2026
**Autor:** Doc Writer (Claude)
**Status:** Aguardando execução
**Tipo:** Bug Fix
**Branch sugerida:** `bugfix/ci-build-firebase-prerender`
**Prioridade:** Alta
**Versão:** 1.0

> O CI/CD falha no job **Build** com `FirebaseError: auth/invalid-api-key` durante a pré-renderização estática de páginas client-side. O Next.js executa as páginas `'use client'` no servidor durante o build para gerar o HTML inicial, o que aciona a inicialização do Firebase client SDK sem as variáveis de ambiente `NEXT_PUBLIC_*`. Além disso, o webpack emite um warning de módulo não encontrado (`curva-mestra-firebase-adminsdk.json`) a partir de `firebase-admin.ts`. Ambos os problemas precisam ser corrigidos para estabilizar o pipeline.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** `develop`
**Branch da task:** `bugfix/ci-build-firebase-prerender`
**PR target:** branch pessoal → `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/ci-build-firebase-prerender
```

| Step   | Tipo    | Escopo    | Mensagem sugerida                                                             |
| ------ | ------- | --------- | ----------------------------------------------------------------------------- |
| STEP 1 | `fix`   | `config`  | `fix(config): add force-dynamic to root layout to prevent Firebase SSR error` |
| STEP 2 | `fix`   | `firebase`| `fix(firebase): guard admin SDK local file require to suppress webpack warning` |
| STEP 3 | `docs`  | `tasks`   | `docs(tasks): move BUG-ci-build-firebase-prerender to TASK_COMPLETED`         |

---

## 1. Diagnóstico

### 1.1 Erro fatal — pré-renderização estática

**Páginas afetadas (confirmadas nos logs de CI):**
- `/admin/settings` → `src/app/(admin)/admin/settings/page.tsx`
- `/clinic/profile` → `src/app/(clinic)/clinic/profile/page.tsx`

**Causa raiz:**  
O Next.js App Router executa páginas `'use client'` no servidor (SSR) para gerar o HTML estático inicial durante o `next build`. Isso aciona importações do Firebase client SDK (`firebase.ts`), que tenta inicializar com `NEXT_PUBLIC_FIREBASE_API_KEY` vazia no ambiente de CI, resultando em:

```
Error [FirebaseError]: Firebase: Error (auth/invalid-api-key)
Export encountered an error on /(admin)/admin/settings/page: /admin/settings, exiting the build.
```

**Por que API routes não têm esse problema:**  
As API routes já receberam `export const dynamic = 'force-dynamic'` em sessão anterior. Porém esse export só funciona em **Server Components**. As páginas afetadas têm `'use client'` como primeira linha — logo não podem exportar `dynamic` diretamente.

**Solução correta:**  
Adicionar `export const dynamic = 'force-dynamic'` no `src/app/layout.tsx` (root layout), que **é** um Server Component. Isso instrui o Next.js a não pré-renderizar nenhuma rota estaticamente, o que é correto para este app 100% dependente de Firebase Auth em tempo de execução.

### 1.2 Warning — módulo não encontrado no webpack

**Arquivo:** `src/lib/firebase-admin.ts` linha 40

```ts
const serviceAccount = require('../../curva-mestra-firebase-adminsdk.json');
```

O webpack processa este `require` em build time e emite:
```
Module not found: Can't resolve '../../curva-mestra-firebase-adminsdk.json'
```

O código já possui tratamento de erro (`try/catch`), mas o webpack não consegue ignorar o `require` estático — ele falha na resolução antes da execução. Embora seja apenas um warning hoje, pode se tornar erro em versões futuras do Next.js.

**Solução:** substituir `require()` estático por `fs.readFileSync` com verificação de existência em runtime, ou usar `webpackIgnore` magic comment.

---

## 2. Arquivos Afetados

| Arquivo | Ação |
| ------- | ---- |
| `src/app/layout.tsx` | Adicionar `export const dynamic = 'force-dynamic'` |
| `src/lib/firebase-admin.ts` | Corrigir require estático para suprimir warning do webpack |

---

## 3. Steps de Implementação

### STEP 1 — Adicionar `force-dynamic` no root layout

Abrir `src/app/layout.tsx` e adicionar logo após os imports:

```ts
export const dynamic = 'force-dynamic';
```

**Validação:** `npm run build` não deve mais exibir erros de `auth/invalid-api-key` nas páginas. O build pode demorar um pouco mais pois não há pré-renderização estática.

### STEP 2 — Corrigir webpack warning no firebase-admin.ts

Em `src/lib/firebase-admin.ts`, substituir o bloco do `require` local:

```ts
// ANTES
const serviceAccount = require('../../curva-mestra-firebase-adminsdk.json');

// DEPOIS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require(/* webpackIgnore: true */ '../../curva-mestra-firebase-adminsdk.json');
```

O magic comment `/* webpackIgnore: true */` instrui o webpack a não tentar resolver esse módulo em build time, delegando para o Node.js em runtime (onde o try/catch já trata a ausência do arquivo).

**Validação:** `npm run build` não deve mais exibir o warning `Module not found: Can't resolve '../../curva-mestra-firebase-adminsdk.json'`.

### STEP 3 — Concluir a task (Modo B do dev-task-manager)

Executar o **Modo B** do agente `dev-task-manager` ainda na task branch para mover este documento para `TASK_COMPLETED/` antes de abrir a PR.

---

## 4. Checklist de Validação Final

- [ ] `npm run build` sem erros (nenhum `auth/invalid-api-key`)
- [ ] `npm run build` sem warning de `Module not found` para o adminsdk.json
- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] CI Build verde no PR
- [ ] Documento movido para `TASK_COMPLETED/` (commit na task branch)

---

## 5. Observações

- O `force-dynamic` no root layout é a abordagem recomendada para apps SaaS com autenticação Firebase — nenhuma página deve ser pré-renderizada estaticamente pois todas dependem do estado de auth em runtime.
- As API routes já têm `force-dynamic` individualmente (aplicado em sessão anterior). O root layout não conflita com esses exports — o Next.js respeita o setting mais específico.
- O arquivo `curva-mestra-firebase-adminsdk.json` jamais deve ser commitado (está no `.gitignore`). O `webpackIgnore` é a solução correta para requires condicionais de arquivos externos.

---

## 13. Histórico de Versões

| Versão | Data       | Autor            | Descrição                  |
| ------ | ---------- | ---------------- | -------------------------- |
| 1.0    | 01/05/2026 | Doc Writer (Claude) | Documento criado          |
