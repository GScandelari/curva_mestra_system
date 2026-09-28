# Feature: Agendamento Automático das Verificações de Alerta (Vencimento, Vencido, Estoque Baixo)

**Projeto:** Curva Mestra
**Data:** 27/09/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Scandelari
**Data de Conclusão:** 27/09/2026
**Tipo:** Feature
**Branch sugerida:** `feature/scheduled-alert-checks`
**Prioridade:** Média
**Versão:** 1.1

> Cria a primeira Scheduled Cloud Function do projeto: um `onSchedule` diário (06:00, horário de Brasília) que executa, via Admin SDK, as mesmas três verificações de alerta hoje disponíveis apenas por acionamento manual (UC-42). Extrai a lógica pura de decisão de `alertTriggers.ts` para um módulo sem dependência de Firestore (`src/lib/alertRules.ts`), testável e reaproveitado pelo fluxo client existente. Fecha o débito técnico cross-UC `UC-15-RN-05`/`UC-42-RN-05` do mapa de bugs sem alterar o comportamento do fluxo manual nem tocar `firestore.rules`/`firestore.indexes.json`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`
- **Branch da task:** `feature/scheduled-alert-checks`
- **Fluxo de PR obrigatório** (SST do projeto, `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`): `feature/scheduled-alert-checks` → PR → `gscandelari_setup` (validação real no Firebase pessoal — **etapa crítica para esta task**, ver STEP 6) → PR → `develop`. **Nunca** abrir PR direto para `master`.

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 1 | `feat` | `alerts` | `extract pure alert decision logic to alertRules.ts` |
| 2 | `test` | `alerts` | `add unit tests for alertRules pure functions` |
| 3 | `refactor` | `alerts` | `use alertRules pure functions in client-side alertTriggers` |
| 4 | `feat` | `functions` | `add admin sdk alert checks (mirror of client alertTriggers)` |
| 5 | `feat` | `functions` | `add checkAlertsScheduled daily onSchedule trigger` |
| 6 | `docs` | `admin` | `close UC-15-RN-05 and UC-42-RN-05 in bugs map` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

- **`src/lib/services/alertTriggers.ts`** (client SDK, `firebase/firestore`, 447 linhas) implementa três verificações independentes — `checkExpiringProducts(tenantId)`, `checkExpiredProducts(tenantId)`, `checkLowStock(tenantId)` — cada uma: (a) lê `getNotificationSettings(tenantId)` e retorna antecipadamente se o interruptor correspondente (`enable_expiry_alerts`/`enable_low_stock_alerts`) estiver desligado ou se o documento de settings não existir; (b) consulta `tenants/{tenantId}/inventory` com `where('active', '==', true)`; (c) cria notificações via `notificationService.ts`, com deduplicação por notificação não lida já existente (`where('type', '==', ...) + where('inventory_id'|'codigo_produto', '==', ...) + where('read', '==', false)`).
- `checkLowStock` agrupa `quantidade_disponivel` por `codigo_produto` (soma de todos os lotes ativos) e resolve o limite mínimo com fallback de 3 níveis: `stock_limits/{codigo}` do tenant → `settings.low_stock_threshold` global → `10` (mesma divergência já registrada em `UC-15-RN-03`, não corrigida por esta spec).
- `runAllChecks(tenantId)` dispara as três verificações em paralelo (`Promise.all`) para **um** tenant — é a função consumida pelo fluxo manual.
- `runChecksForAllTenants()` itera a coleção `tenants` (`where` implícito via filtro em memória `tenantData.status !== 'active'` — pula tenants não ativos) e chama `runAllChecks(tenantId)` para cada tenant ativo, agregando resultados e isolando erro por tenant em `try/catch`. Já existe o comentário `/** Executa checks para todos os tenants ativos (usar em scheduled function) */` — mas **nunca é chamada em nenhum outro lugar do repositório** (confirmado por busca textual exaustiva por `runChecksForAllTenants` fora do próprio arquivo).
- **`src/lib/services/notificationService.ts`** (client SDK) fornece `getNotificationSettings`, `createExpiringProductNotification`, `createExpiredProductNotification`, `createLowStockNotification` — todas usadas por `alertTriggers.ts`.
- **Gatilho manual (UC-42):** `src/components/clinic/AlertsTab.tsx` (renderizado por `/clinic/alerts/page.tsx`) chama `runAllChecks(tenantId)` apenas do tenant logado — nunca `runChecksForAllTenants`. Gate de acesso: `isAdmin = claims?.role === 'clinic_admin'`. A rota `/clinic/alerts` não é referenciada por nenhum link de navegação do sistema (achado `UC-42-RN-06`) — o único caminho de acesso hoje é a URL direta.
- **`functions/src/`** tem 9 arquivos, todos **triggers** (`onDocumentCreated`, ex. `processEmailQueue.ts`) ou **callables** (`sendCustomEmail.ts`, etc.) — **nenhum `onSchedule` existe hoje**. `functions/src/processEmailQueue.ts` documenta explicitamente, em comentário, o padrão obrigatório do repositório: `admin.firestore()` é acessado **lazy dentro do handler**, nunca no topo do módulo, porque uma chamada no escopo do módulo quebraria a etapa de introspecção do `firebase deploy` (que carrega o código para gerar o manifest da função sem nenhum app Firebase inicializado nesse contexto).
- **`functions/package.json`**: `firebase-admin: ^13.6.0`, `firebase-functions: ^7.0.5` — ambas já suportam `onSchedule` de `firebase-functions/v2/scheduler` sem necessidade de upgrade de dependência.
- **`firebase.json`**: `functions[0].source = "functions"` — o deploy de functions empacota **apenas o diretório `functions/`**; `functions/tsconfig.json` tem `include: ["src"]` (relativo a `functions/`), ou seja, arquivos fora de `functions/` não são compilados nem empacotados por esse processo.
- Todas as functions existentes que definem região (`processEmailQueue`, `placeholder`) usam `region: 'southamerica-east1'` — padrão consistente do projeto.
- **O gap real:** a lógica de decisão hoje está 100% em client SDK (`firebase/firestore`), que depende de um app Firebase inicializado com config de app cliente. Uma Cloud Function `onSchedule` roda com Admin SDK (`firebase-admin`) em um runtime distinto — não pode importar `alertTriggers.ts`/`notificationService.ts` como estão, tanto pela incompatibilidade de SDK (client vs. admin) quanto pela fronteira de empacotamento do deploy (arquivos fora de `functions/` não são enviados ao runtime).

### 1.2 Problema identificado

O sistema de alertas (vencimento, vencido, estoque baixo) depende **inteiramente** de um `clinic_admin` acessar manualmente `/clinic/alerts` — rota que, por sua vez, não tem nenhum link de navegação em nenhuma outra tela (`UC-42-RN-06`). Isso significa que, na prática, um tenant pode nunca gerar nenhum alerta automaticamente, mesmo tendo produtos vencidos ou em estoque crítico, se nenhum admin acessar essa URL específica. `runChecksForAllTenants()` já foi escrita com essa finalidade ("usar em scheduled function"), mas a infraestrutura de agendamento nunca foi criada — é código morto até hoje.

### 1.3 Motivação estratégica

Este é o achado cross-UC `UC-15-RN-05` / `UC-42-RN-05` (mapa de bugs, v3.35, Seção 3, severidade Média, categoria Débito técnico), registrado desde o mapeamento original desses dois UCs e adiado por depender de uma peça de infraestrutura ainda inexistente (Cloud Scheduler via `onSchedule`). Fechar esse débito torna o sistema de alertas proativo por padrão — coerente com a proposta de valor do produto ("gestão inteligente de estoque" — CLAUDE.md) — e não mais dependente de um comportamento humano incerto.

---

## 2. Objetivos

1. Extrair a lógica pura de decisão de alertas (parsing de data de vencimento, cálculo de dias até vencer, comparação de janela de vencimento, comparação de estoque baixo, fallback de threshold) para um módulo testável sem nenhuma dependência de Firestore.
2. Criar a primeira Scheduled Cloud Function do projeto, executando diariamente (06:00, horário de Brasília) via Admin SDK, cobrindo todos os tenants com `status === 'active'`.
3. Reproduzir fielmente, na camada Admin SDK, o mesmo comportamento já existente no fluxo manual (mesmo gate de configurações, mesmo filtro `active: true`, mesma deduplicação de notificação) — sem introduzir divergência de comportamento entre o check manual e o automático.
4. Garantir cobertura de teste unitário para toda a lógica pura extraída (CLAUDE.md item 8).
5. Não alterar o fluxo manual existente (UC-42/`AlertsTab.tsx`) nem `firestore.rules`/`firestore.indexes.json`.
6. Fechar `UC-15-RN-05` e `UC-42-RN-05` no mapa de bugs, documentando a correção.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Sistema executa diariamente, sem intervenção humana, as três verificações de alerta (vencimento, vencido, estoque baixo) para todos os tenants com `status === 'active'` | system (Cloud Scheduler) | Must |
| RF-02 | Sistema gera notificações equivalentes em estrutura e conteúdo às geradas pelo acionamento manual (UC-42), incluindo a mesma deduplicação por notificação não lida já existente | system | Must |
| RF-03 | Sistema respeita as configurações `enable_expiry_alerts`/`enable_low_stock_alerts` de `tenants/{tenantId}/settings/notifications`, exatamente como o fluxo manual | system | Must |
| RF-04 | Falha ao processar um tenant específico não interrompe o processamento dos demais tenants — apenas é registrada em log | system | Must |
| RF-05 | O acionamento manual via `/clinic/alerts` (UC-42) continua funcionando de forma idêntica após esta feature — nenhuma mudança de comportamento visível ao `clinic_admin` | clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A function roda na região `southamerica-east1`, mesmo padrão de todas as demais functions do projeto | Consistência |
| RNF-02 | `admin.firestore()` é acessado apenas dentro do handler (lazy), nunca no topo do módulo — mesmo padrão documentado em `processEmailQueue.ts`, necessário para não quebrar a introspecção do `firebase deploy` | Manutenibilidade |
| RNF-03 | Nenhuma nova coleção, regra ou índice Firestore — Admin SDK ignora `firestore.rules` por definição, e todas as queries usadas (equality-only, sem `orderBy` combinado com outro campo) já funcionam sem índice composto, mesmo padrão hoje em produção via UC-42 | Multi-tenant / Segurança |
| RNF-04 | Timeout e memória configurados de forma realista para iterar todos os tenants do sistema (`timeoutSeconds: 300`, `memory: '256MiB'`), sem paralelismo elaborado — mesmo trade-off de simplicidade aceito em `runChecksForAllTenants` (loop sequencial por tenant) | Performance |
| RNF-05 | Falha em um tenant específico é isolada via `try/catch` por tenant, mesmo padrão defensivo já usado em `runChecksForAllTenants` | Robustez |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | A function roda diariamente às 06:00, horário de `America/Sao_Paulo` | Decisão de produto já tomada com o usuário antes desta spec |
| RN-02 | A camada Admin SDK (`functions/src/alertChecks.ts`) reproduz fielmente o mesmo comportamento de `checkExpiringProducts`/`checkExpiredProducts`/`checkLowStock`/`runAllChecks`/`runChecksForAllTenants` já existentes em `alertTriggers.ts`, incluindo o mesmo filtro `active === true`, a mesma deduplicação de notificação, e o mesmo fallback de 3 níveis para limite de estoque baixo (divergência já conhecida de `UC-15-RN-03`, não corrigida por esta spec) | Consistência de comportamento entre check manual e automático |
| RN-03 | A lógica pura de decisão (datas, thresholds) vive em `src/lib/alertRules.ts`, sem nenhum import de Firestore, e é consumida pela camada client (`alertTriggers.ts`, refatorado). A camada Admin SDK usa um espelho manual do mesmo módulo (`functions/src/alertRules.ts`) — ver justificativa técnica na Seção 4.1 | Decisão de arquitetura já tomada com o usuário; espelhamento resolvido nesta spec (Seção 4.1) |
| RN-04 | A function não cria notificação duplicada para a mesma condição — mesmo mecanismo de dedup do fluxo manual (notificação não lida existente do mesmo `type` + `inventory_id`/`codigo_produto`) | RF-02 |
| RN-05 | Tenants com `status !== 'active'` são ignorados, mesmo comportamento já existente em `runChecksForAllTenants` | Consistência com o código já existente |
| RN-06 | Um erro ao processar um tenant específico é isolado e não impede o processamento dos demais tenants | RF-04/RNF-05 |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Extração de lógica pura para `src/lib/alertRules.ts`** — módulo novo, sem nenhum import de `firebase/firestore` nem `firebase-admin`, contendo funções puras: `parseBrDate`, `daysUntil`, `isWithinExpiryWindow`, `isExpired`, `isLowStock`, `resolveLowStockThreshold` (assinaturas completas na Seção 6.2). `alertTriggers.ts` é refatorado para importar e usar essas funções em vez de reimplementar o cálculo inline — mesmo comportamento observável, zero mudança funcional no fluxo manual (RF-05).
- **Camada Admin SDK espelhada, não compartilhada por import direto** — descoberta técnica desta investigação: `firebase.json` define `functions[0].source = "functions"`, ou seja, o `firebase deploy --only functions` empacota **apenas o diretório `functions/`**; `functions/tsconfig.json` tem `include: ["src"]` **relativo a `functions/`**, então um `import ... from '../../src/lib/alertRules'` dentro de `functions/src/alertChecks.ts` não seria compilado por esse `tsconfig` (está fora do diretório incluído) e, mesmo que compilasse localmente com alguma configuração alternativa, o arquivo referenciado nunca seria enviado ao runtime do Cloud Functions (que só recebe o conteúdo de `functions/`). Diante disso, a solução adotada é **espelhar manualmente** o módulo puro em `functions/src/alertRules.ts` — código funcionalmente idêntico, com comentário cruzado em ambos os arquivos apontando um para o outro e alertando que qualquer mudança de regra de negócio precisa ser replicada nos dois lugares.
- **`functions/src/alertChecks.ts`** (Admin SDK) reimplementa `checkExpiringProducts`, `checkExpiredProducts`, `checkLowStock`, `runAllChecks` e `runChecksForAllTenants` usando `admin.firestore()` (lazy, dentro de cada função — RNF-02) e as funções puras de `functions/src/alertRules.ts`. Como `notificationService.ts` também é client SDK (mesma fronteira de empacotamento), a criação de notificação é reimplementada localmente em `alertChecks.ts` como uma função privada que grava diretamente via `admin.firestore().collection(...).add(...)`, replicando a mesma forma de documento (`type`, `priority`, `title`, `message`, `read: false`, `created_at`, `inventory_id`/`product_id`, `metadata`) já usada por `createExpiringProductNotification`/`createExpiredProductNotification`/`createLowStockNotification`.
- **`functions/src/checkAlertsScheduled.ts`** — novo `onSchedule` (`firebase-functions/v2/scheduler`), `schedule: '0 6 * * *'`, `timeZone: 'America/Sao_Paulo'`, `region: 'southamerica-east1'` (RNF-01), `timeoutSeconds: 300`, `memory: '256MiB'` (RNF-04) — chama `runChecksForAllTenants()` de `alertChecks.ts` e registra o resultado agregado em log estruturado (`console.log`), mesmo padrão de observabilidade já usado no restante do projeto (Google Cloud Logging via `console.log`/`console.error`, sem ferramenta de log adicional).
- **`functions/src/index.ts`** ganha `export { checkAlertsScheduled } from './checkAlertsScheduled';`, mesmo padrão de export direto já usado para as demais functions.

### 4.2 Alternativas descartadas

- **Importar `../../src/lib/alertRules.ts` diretamente dentro de `functions/src/alertChecks.ts`** — descartada pela razão técnica detalhada na Seção 4.1: o deploy de functions empacota apenas `functions/`, e `functions/tsconfig.json` não inclui nada fora de `functions/src`. Um import relativo cruzando essa fronteira falharia silenciosamente no melhor caso (build local com `ts-node` funcionando, mas deploy real quebrado por ausência do arquivo no runtime).
- **Adotar uma ferramenta de monorepo (npm workspaces, Nx, Turborepo) para compartilhar um pacote entre o app Next.js e `functions/`** — descartada por desproporção: o `package.json` raiz não declara `workspaces` hoje, e introduzir uma dessas ferramentas apenas para compartilhar ~40-60 linhas de lógica pura contraria a filosofia "Zero DevOps" explícita do `CLAUDE.md` (Stack, linha 8).
- **Publicar um pacote npm privado, ou usar `file:` dependency em `functions/package.json` apontando para `../src`** — descartada pela mesma razão de complexidade desproporcional, além de exigir um passo de build/publish adicional antes de cada deploy, o que o projeto não tem hoje para nenhuma outra function.
- **Firebase Functions v1 (`functions.pubsub.schedule`)** — descartada em favor de `onSchedule` do SDK v2 (`firebase-functions/v2/scheduler`), já suportado pela versão instalada (`^7.0.5`) sem upgrade de dependência, e consistente com o padrão v2 já usado em 100% das outras functions do projeto (`onDocumentCreated`, `onRequest`, todas do SDK v2).
- **Frequência diferente de execução (ex.: a cada 4-6 horas)** — descartada; decisão de produto já tomada (execução diária, 06:00 horário de Brasília) antes desta spec.

### 4.3 Trade-offs aceitos

- **Duplicação física de lógica pura** entre `src/lib/alertRules.ts` (testado por Jest, fonte da verdade — Seção 8) e `functions/src/alertRules.ts` (espelho manual, sem infraestrutura de teste própria, já que `functions/package.json` não tem nenhum framework de teste configurado hoje). Aceito como o trade-off mais simples dado que o projeto não tem tooling de monorepo (Seção 4.2); mitigado com comentário cruzado nos dois arquivos e revisão de PR obrigatória comparando os dois lado a lado a cada mudança.
- **Duplicação das queries de leitura Firestore** entre `alertTriggers.ts` (client SDK) e `alertChecks.ts` (Admin SDK) — inevitável, já que as duas APIs (`firebase/firestore` vs. `firebase-admin/firestore`) são incompatíveis em assinatura. RN-02 exige fidelidade de comportamento entre as duas implementações, não unificação de código.
- **Sem teste E2E cobrindo a execução real do cron** — o Firebase Emulator Suite não expõe um gatilho de cron simulável (limitação confirmada, não uma escolha). Mitigado com: (a) teste unitário exaustivo da lógica pura (Jest, sem Firestore); (b) chamada direta do handler exportado contra o Emulator Suite (Admin SDK apontando para `FIRESTORE_EMULATOR_HOST`), sem depender do agendador; (c) validação real pós-deploy forçando a execução via `gcloud scheduler jobs run` (todo `onSchedule` v2 cria um job de Cloud Scheduler por trás) — detalhado no STEP 6.
- **Threshold de estoque baixo com divergência conhecida (`UC-15-RN-03`)** — a camada automática replica fielmente o mesmo fallback de 3 níveis já usado no manual, incluindo a divergência já documentada entre UI e notificação. Corrigir essa divergência está fora do escopo desta spec.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/alertRules.ts` | Módulo | Lógica pura de decisão de alertas (datas, thresholds), sem import de Firestore |
| `src/__tests__/alertRules.test.ts` | Teste unitário | Cobertura das funções puras de `alertRules.ts` |
| `functions/src/alertRules.ts` | Módulo (projeto `functions/`) | Espelho manual do módulo acima — necessário pela fronteira de empacotamento do deploy (Seção 4.1) |
| `functions/src/alertChecks.ts` | Serviço (Admin SDK) | `checkExpiringProducts`/`checkExpiredProducts`/`checkLowStock`/`runAllChecks`/`runChecksForAllTenants` equivalentes em Admin SDK |
| `functions/src/checkAlertsScheduled.ts` | Cloud Function (`onSchedule`) | Scheduled trigger diário (06:00 America/Sao_Paulo), chama `runChecksForAllTenants` |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/lib/services/alertTriggers.ts` | Refatorado para importar e usar as funções puras de `src/lib/alertRules.ts` em vez de reimplementar o cálculo de datas/threshold inline — mesmo comportamento observável, zero mudança funcional (RF-05) |
| `functions/src/index.ts` | `+ export { checkAlertsScheduled } from './checkAlertsScheduled';` |
| `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` | Fecha `UC-15-RN-05` e `UC-42-RN-05` como "Corrigido e Documentado", referenciando este documento e o commit final |

### 5.3 Arquivos a REMOVER

N/A — feature aditiva, nada é removido.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants` | Leitura (Admin SDK, sem mudança de regra/índice) | Leitura completa da coleção, filtro `status !== 'active'` em memória — mesmo padrão já usado por `runChecksForAllTenants` (client SDK) |
| `tenants/{tenantId}/settings/notifications` | Leitura (Admin SDK) | `getDoc` direto por tenant, mesma leitura já existente no fluxo manual |
| `tenants/{tenantId}/inventory` | Leitura (Admin SDK) | `where('active', '==', true)` — mesma query já existente, sem necessidade de índice composto novo (igualdade de campo único) |
| `tenants/{tenantId}/stock_limits` | Leitura (Admin SDK) | Leitura completa da subcoleção — mesma já existente em `checkLowStock` |
| `tenants/{tenantId}/notifications` | Leitura + Escrita (Admin SDK) | Query de dedup (`type` + `inventory_id`/`codigo_produto` + `read == false`, equality-only, já roda em produção sem índice composto via UC-42) + `addDoc`/`add` de nova notificação quando não houver dedup |
| `firestore.rules` | Nenhuma mudança | Admin SDK ignora `firestore.rules` por definição — todas as leituras/escritas desta feature usam Admin SDK |
| `firestore.indexes.json` | Nenhuma mudança | Todas as queries usadas já rodam em produção hoje (via UC-42, client SDK) sem nenhum índice composto — mesmas queries, mesmo comportamento, agora também via Admin SDK |

### 5.5 O que NÃO muda

- `src/components/clinic/AlertsTab.tsx` e `/clinic/alerts/page.tsx` — nenhuma mudança de UI ou comportamento; o acionamento manual (UC-42) continua idêntico (RF-05).
- `src/lib/services/notificationService.ts` — nenhuma função existente é alterada (usada apenas pelo fluxo client, que continua intocado em comportamento).
- `firestore.rules` e `firestore.indexes.json` — nenhuma linha alterada.
- A divergência de fallback de threshold já documentada em `UC-15-RN-03` — não é corrigida por esta spec, apenas replicada fielmente na camada automática (RN-02).
- Nenhuma outra function existente em `functions/src/` (`onUserCreated`, `onTenantCreated`, `onAccessRequestCreated`, `processEmailQueue`, callables de e-mail) é modificada.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Nenhuma entidade de domínio persistida é alterada — `InventoryItem`, `Notification`, `NotificationSettings` (`src/types/index.ts`, `src/types/notification.ts`) permanecem exatamente como estão. Esta feature não introduz nenhum novo campo persistido no Firestore.

### 6.2 Mudanças em serviços

```ts
// src/lib/alertRules.ts (novo) — nenhum import de Firestore
// ESPELHO: functions/src/alertRules.ts replica este arquivo linha a linha
// (ver Seção 4.1). Qualquer mudança de regra aqui precisa ser replicada lá.

export function parseBrDate(dateStr: string): Date | null;
// Converte "DD/MM/YYYY" para Date às 00:00:00 local; retorna null se o
// formato for inválido (não lança erro) — mesma conversão hoje duplicada
// inline em checkExpiringProducts/checkExpiredProducts.

export function daysUntil(targetDate: Date, today: Date): number;
// Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

export function isWithinExpiryWindow(expiryDate: Date, today: Date, warningDays: number): boolean;
// expiryDate >= today && expiryDate <= (today + warningDays dias)

export function isExpired(expiryDate: Date, today: Date): boolean;
// expiryDate < today

export function isLowStock(totalQuantity: number, minQuantity: number): boolean;
// totalQuantity > 0 && totalQuantity <= minQuantity

export function resolveLowStockThreshold(
  perProductLimit: number | undefined,
  globalThreshold: number | undefined
): number;
// perProductLimit ?? globalThreshold ?? 10 — mesmo fallback de 3 níveis
// já usado em checkLowStock (UC-15-RN-03, divergência conhecida, não corrigida aqui)
```

```ts
// src/lib/services/alertTriggers.ts — mudança (refatoração, sem mudança de comportamento)
// Antes: cálculo de data/threshold inline em cada função de check.
// Depois: importa e usa parseBrDate/isWithinExpiryWindow/isExpired/daysUntil/
// isLowStock/resolveLowStockThreshold de '@/lib/alertRules'. Assinaturas
// públicas (checkExpiringProducts, checkExpiredProducts, checkLowStock,
// runAllChecks, runChecksForAllTenants) permanecem idênticas.
```

```ts
// functions/src/alertRules.ts (novo, projeto functions/) — espelho manual de src/lib/alertRules.ts
// Mesmas 6 funções, mesma implementação, sem import de firebase-admin.

// functions/src/alertChecks.ts (novo) — Admin SDK
import * as admin from 'firebase-admin';
import { parseBrDate, isWithinExpiryWindow, isExpired, daysUntil, isLowStock, resolveLowStockThreshold } from './alertRules';

interface CheckResult {
  checked: number;
  notificationsCreated: number;
  errors: string[];
}

export async function checkExpiringProducts(tenantId: string): Promise<CheckResult>;
export async function checkExpiredProducts(tenantId: string): Promise<CheckResult>;
export async function checkLowStock(tenantId: string): Promise<CheckResult>;

export async function runAllChecks(tenantId: string): Promise<{
  expiring: { checked: number; created: number };
  expired: { checked: number; created: number };
  lowStock: { checked: number; created: number };
  totalErrors: number;
  errors: string[];
}>;

export async function runChecksForAllTenants(): Promise<{
  tenantsProcessed: number;
  totalNotifications: number;
  errors: Record<string, string[]>;
}>;
```

Lógica de `checkExpiringProducts`/`checkExpiredProducts`/`checkLowStock` (Admin SDK): idêntica à versão client (`alertTriggers.ts`) descrita na Seção 1.1 — mesmo gate de `settings`, mesmo filtro `active === true`, mesma agregação por `codigo_produto` (estoque baixo), mesma deduplicação de notificação — porém usando `admin.firestore()` (lazy, dentro de cada função, RNF-02) em vez de `firebase/firestore`, e uma função privada `createNotificationAdmin(...)` que grava diretamente via `.collection('tenants/{tenantId}/notifications').add({...})`, replicando o formato de documento já usado por `notificationService.ts`.

```ts
// functions/src/checkAlertsScheduled.ts (novo)
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { runChecksForAllTenants } from './alertChecks';

export const checkAlertsScheduled = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const results = await runChecksForAllTenants();
    console.log('checkAlertsScheduled concluído', results);
  }
);
```

### 6.3 Mudanças na UI

N/A — nenhuma tela é criada ou alterada. `AlertsTab.tsx`/`/clinic/alerts` permanecem exatamente como estão (RF-05).

### 6.4 Mudanças em API Routes

N/A — nenhuma rota HTTP nova ou alterada. A única function nova é um `onSchedule`, sem endpoint HTTP.

---

## 7. Plano de Implementação

### STEP 1 — Extrair lógica pura para `alertRules.ts`

**Objetivo:** Isolar a lógica de decisão (datas, thresholds) sem dependência de Firestore.

**Arquivos afetados:**
- `src/lib/alertRules.ts` — criar com `parseBrDate`, `daysUntil`, `isWithinExpiryWindow`, `isExpired`, `isLowStock`, `resolveLowStockThreshold`.

**Ações:**
1. Implementar as 6 funções puras (Seção 6.2), extraindo a lógica hoje inline em `alertTriggers.ts`.
2. Não alterar `alertTriggers.ts` ainda neste step.

**Validação:** `npm run type-check` sem erros; funções exportadas e importáveis.

**Commit:** `feat(alerts): extract pure alert decision logic to alertRules.ts`

---

### STEP 2 — Testes unitários de `alertRules.ts`

**Objetivo:** Cobrir a lógica pura extraída (CLAUDE.md item 8).

**Arquivos afetados:**
- `src/__tests__/alertRules.test.ts` — criar, seguindo o padrão de `src/__tests__/projectionService.test.ts`/`costingService.test.ts`.

**Ações:**
1. `parseBrDate`: formato válido (`"25/03/2029"` → `Date` correta); formato inválido/vazio retorna `null`, não lança erro.
2. `daysUntil`: diferença correta em dias, incluindo casos de mesma data (0) e data passada (negativo).
3. `isWithinExpiryWindow`: limites exatos (`expiryDate === today` → `true`; `expiryDate === today + warningDays` → `true`; `expiryDate === today + warningDays + 1 dia` → `false`; `expiryDate < today` → `false`).
4. `isExpired`: `expiryDate === today` → `false`; `expiryDate === today - 1 dia` → `true`.
5. `isLowStock`: `totalQuantity === 0` → `false` (regra existente: zero não é "estoque baixo", é "sem estoque"); `totalQuantity === minQuantity` → `true`; `totalQuantity === minQuantity + 1` → `false`; `totalQuantity` negativo (dado inconsistente) → não lança erro.
6. `resolveLowStockThreshold`: `perProductLimit` definido prevalece; `perProductLimit` indefinido usa `globalThreshold`; ambos indefinidos retornam `10`.

**Validação:** `npm run test -- alertRules` com 100% dos cenários acima passando.

**Commit:** `test(alerts): add unit tests for alertRules pure functions`

---

### STEP 3 — Refatorar `alertTriggers.ts` para consumir `alertRules.ts`

**Objetivo:** Eliminar a duplicação de cálculo inline no client SDK, sem mudar comportamento (RF-05).

**Arquivos afetados:**
- `src/lib/services/alertTriggers.ts` — substituir cálculo inline por chamadas às funções de `alertRules.ts`.

**Ações:**
1. Em `checkExpiringProducts`/`checkExpiredProducts`, substituir o parsing manual de `dt_validade` por `parseBrDate`, e a comparação de janela/vencimento por `isWithinExpiryWindow`/`isExpired`/`daysUntil`.
2. Em `checkLowStock`, substituir a comparação `totalQty > 0 && totalQty <= minQuantity` por `isLowStock`, e o fallback de 3 níveis por `resolveLowStockThreshold`.
3. Não alterar `runAllChecks`/`runChecksForAllTenants` (já corretas, sem lógica de data/threshold própria).

**Validação:** Testar manualmente (ou via `gscandelari_setup`) o acionamento de "Executar Todos os Checks" em `/clinic/alerts` — resultado (notificações criadas/quantidade verificada) deve ser idêntico ao comportamento anterior à refatoração, para os mesmos dados de teste.

**Commit:** `refactor(alerts): use alertRules pure functions in client-side alertTriggers`

---

### STEP 4 — Camada Admin SDK (`functions/src/alertRules.ts` + `alertChecks.ts`)

**Objetivo:** Reproduzir fielmente a lógica de checks em Admin SDK, dentro do projeto `functions/`.

**Arquivos afetados:**
- `functions/src/alertRules.ts` — criar, espelho manual de `src/lib/alertRules.ts` (comentário cruzado nos dois arquivos).
- `functions/src/alertChecks.ts` — criar com `checkExpiringProducts`, `checkExpiredProducts`, `checkLowStock`, `runAllChecks`, `runChecksForAllTenants`.

**Ações:**
1. Copiar as 6 funções puras para `functions/src/alertRules.ts`, com comentário no topo apontando para `src/lib/alertRules.ts` como fonte da verdade testada.
2. Implementar as 3 funções de check em `alertChecks.ts` usando `admin.firestore()` (lazy, dentro de cada função — RNF-02), reproduzindo a lógica descrita na Seção 6.2, incluindo a função privada `createNotificationAdmin`.
3. Implementar `runAllChecks` (Promise.all das 3) e `runChecksForAllTenants` (itera `tenants`, filtra `status === 'active'`, isola erro por tenant).

**Validação:** `cd functions && npm run build` (`tsc`) sem erros. Rodar `firebase emulators:start --only functions,firestore`, popular o emulador com um tenant + item de inventário vencendo, e chamar `runChecksForAllTenants` diretamente via `firebase functions:shell` (Admin SDK conectando ao emulador via `FIRESTORE_EMULATOR_HOST`) — confirmar notificação criada no emulador.

**Commit:** `feat(functions): add admin sdk alert checks (mirror of client alertTriggers)`

---

### STEP 5 — Scheduled Function e export

**Objetivo:** Criar o `onSchedule` diário e expô-lo no `index.ts`.

**Arquivos afetados:**
- `functions/src/checkAlertsScheduled.ts` — criar.
- `functions/src/index.ts` — adicionar export.

**Ações:**
1. Implementar `checkAlertsScheduled` (Seção 6.2): `schedule: '0 6 * * *'`, `timeZone: 'America/Sao_Paulo'`, `region: 'southamerica-east1'`, `timeoutSeconds: 300`, `memory: '256MiB'`.
2. Adicionar `export { checkAlertsScheduled } from './checkAlertsScheduled';` em `functions/src/index.ts`, na seção de exports (seguir o agrupamento por comentário já existente, ex. abaixo de "Firestore Triggers").

**Validação:** `cd functions && npm run build` sem erros; `firebase deploy --only functions:checkAlertsScheduled` (dry-run local via emulador antes do deploy real, se disponível) sem erro de sintaxe/introspecção.

**Commit:** `feat(functions): add checkAlertsScheduled daily onSchedule trigger`

---

### STEP 6 — Validação manual pós-deploy (dev pessoal)

**Objetivo:** Confirmar que o Cloud Scheduler job é criado corretamente e que a execução real funciona, cobrindo a limitação do Emulator Suite (Seção 4.3).

**Ações:**
1. Após o merge da task branch em `gscandelari_setup` (fluxo obrigatório, Seção 0), fazer deploy real: `firebase deploy --only functions:checkAlertsScheduled --project <projeto-gscandelari-dev>`.
2. **Pré-requisito de infraestrutura a verificar antes do deploy** (risco identificado na Seção 10): Cloud Scheduler exige um app App Engine no projeto GCP. Se o deploy falhar por esse motivo, rodar `gcloud app describe --project <projeto>` para confirmar; se não existir, `gcloud app create --region=southamerica-east1 --project <projeto>` antes de tentar o deploy novamente.
3. Confirmar a criação do job: `gcloud scheduler jobs list --project <projeto> --location southamerica-east1`.
4. Forçar uma execução imediata (sem esperar 06:00 do dia seguinte): `gcloud scheduler jobs run <nome-do-job> --project <projeto> --location southamerica-east1`.
5. Conferir os logs da execução: `firebase functions:log --only checkAlertsScheduled` (ou Google Cloud Logging), confirmando o resultado agregado (`tenantsProcessed`, `totalNotifications`).
6. Conferir no Firestore (console ou `AlertsTab.tsx`) que as notificações esperadas foram criadas para o tenant de teste, sem duplicar as já existentes.

**Validação:** Execução forçada do job conclui sem erro, cria as notificações esperadas, e uma segunda execução forçada em seguida **não** duplica as notificações já criadas (RN-04).

**Commit:** N/A (validação manual, sem alteração de código).

---

### STEP 7 — Fechar UC-15-RN-05 e UC-42-RN-05 no mapa de bugs

**Objetivo:** Documentar a correção no mapa de bugs, encerrando os dois achados.

**Arquivos afetados:**
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` — atualizar as linhas `UC-15-RN-05` e `UC-42-RN-05` de "Aberto" para "Corrigido e Documentado", com data e referência a este documento e ao commit final da feature.

**Ações:**
1. Atualizar a tabela de resumo por severidade (contadores).
2. Atualizar as duas linhas específicas na Seção correspondente ("Inventário" e "Notificações e Alertas"), seguindo o padrão já usado em outras entradas fechadas (ex. `UC-42-RN-03`).
3. Registrar no changelog do próprio mapa (seção de histórico de correções em lote).

**Validação:** Revisão visual do arquivo — as duas linhas não aparecem mais como "Aberto" na contagem de itens abertos de severidade Média.

**Commit:** `docs(admin): close UC-15-RN-05 and UC-42-RN-05 in bugs map`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| `parseBrDate` | `src/__tests__/alertRules.test.ts` | Data válida `DD/MM/YYYY`; string vazia/formato inválido retorna `null` sem lançar erro |
| `daysUntil` | `src/__tests__/alertRules.test.ts` | Diferença positiva, zero (mesma data) e negativa (data passada) |
| `isWithinExpiryWindow` | `src/__tests__/alertRules.test.ts` | Limite inferior (`expiryDate === today`), limite superior (`expiryDate === today + warningDays`), um dia fora da janela em cada extremo, data já vencida |
| `isExpired` | `src/__tests__/alertRules.test.ts` | `expiryDate === today` (não vencido), `expiryDate === today - 1` (vencido) |
| `isLowStock` | `src/__tests__/alertRules.test.ts` | `totalQuantity === 0` (não é "estoque baixo"), `totalQuantity === minQuantity` (é baixo), `totalQuantity === minQuantity + 1` (não é baixo), valor negativo (não lança erro) |
| `resolveLowStockThreshold` | `src/__tests__/alertRules.test.ts` | Limite por produto definido prevalece; limite por produto indefinido usa o global; ambos indefinidos retornam `10` |

Regras aplicadas (CLAUDE.md item 8):
- Funções puras de `src/lib/alertRules.ts`: **sempre testadas** (Jest, sem mock de Firestore) — prioridade alta por serem a base de decisão de todos os alertas do sistema.
- `functions/src/alertRules.ts` (espelho): **não testado independentemente** — `functions/package.json` não tem framework de teste configurado hoje, e este arquivo é uma cópia deliberada do módulo já testado (Seção 4.3). Risco de deriva mitigado por comentário cruzado e revisão de PR.
- `functions/src/alertChecks.ts` e `functions/src/checkAlertsScheduled.ts` (Cloud Functions, orquestração com Firestore): **não cobertos por teste automatizado no MVP** — mesmo padrão já aplicado a `getReplenishmentProjections`/`getConsumptionRecords` (orquestradores não testados unitariamente em specs anteriores). Validação real ocorre via chamada direta do handler contra o Emulator Suite (STEP 4) e via execução forçada pós-deploy (STEP 6), dada a limitação confirmada do Emulator Suite em não expor gatilho de cron simulável.
- `AlertsTab.tsx` e demais componentes React: **não testados no MVP**, sem mudança de comportamento nesta feature (RF-05).

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando, incluindo alertRules.test.ts
[ ] cd functions && npm run build — tsc sem erros (checkAlertsScheduled, alertChecks, alertRules)
[ ] Multi-tenant: todas as queries Firestore (client e Admin SDK) filtram por tenant_id
[ ] Segurança: nenhum secret ou credencial no código; firestore.rules e firestore.indexes.json não alterados
[ ] Comportamento do fluxo manual (/clinic/alerts) idêntico ao anterior após a refatoração de alertTriggers.ts (STEP 3)
[ ] functions/src/alertRules.ts é uma cópia fiel de src/lib/alertRules.ts (comentário cruzado presente nos dois)
[ ] Cloud Scheduler job criado com sucesso após deploy — confirmado via `gcloud scheduler jobs list` (STEP 6)
[ ] Execução forçada do job (`gcloud scheduler jobs run`) conclui sem erro e não duplica notificações já existentes
[ ] Branch pessoal: task branch mergeada em gscandelari_setup para validação real do deploy no Firebase (etapa obrigatória, não opcional, dado que esta é a primeira Scheduled Function do projeto)
[ ] PR: aberto para develop com template preenchido, após validação em gscandelari_setup
[ ] Mapa de bugs (_MAPA-DE-BUGS-E-MELHORIAS.md) atualizado fechando UC-15-RN-05 e UC-42-RN-05
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Cloud Scheduler exige um app App Engine já criado no projeto GCP para provisionar jobs por trás de `onSchedule` v2 — se ausente, o deploy da function pode falhar | Média | Alto | Verificar/criar o app App Engine (`gcloud app create --region=southamerica-east1`) antes do primeiro deploy real, documentado como passo explícito do STEP 6 |
| Divergência de comportamento entre a implementação client (`alertTriggers.ts`) e a espelhada Admin SDK (`alertChecks.ts`), por serem código duplicado e não uma única fonte | Média | Médio | Comentário cruzado nos arquivos espelhados + revisão de PR obrigatória comparando as duas implementações lado a lado antes do merge |
| Execução diária para todos os tenants pode gerar picos de leitura no Firestore (inventário completo por tenant, sem paginação) | Baixa | Baixo | Nenhuma nesta spec — mesmo trade-off de escalabilidade já aceito em relatórios anteriores (UC-47/UC-51/UC-52, RNF-02) |
| `tenants/{tenantId}/settings/notifications` nunca foi criado para algum tenant (UC-43 nunca acessado) — a execução automática, assim como a manual, simplesmente não gera nenhum alerta para esse tenant, sem sinalização | Média | Baixo | Nenhuma correção nesta spec — comportamento idêntico ao já documentado em `UC-42-RN-05`/Fluxo 8b; fora de escopo |
| Impossibilidade de testar a execução real do cron via Firebase Emulator Suite | Alta (limitação confirmada) | Baixo | Validação manual pós-deploy via `gcloud scheduler jobs run` (STEP 6), além de teste do handler completo contra o emulador sem depender do agendador (STEP 4) |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Cloud Scheduler | Serviço do Google Cloud que dispara jobs em horários programados (cron); toda Cloud Function `onSchedule` v2 do Firebase cria um job de Cloud Scheduler por trás, de forma automática no deploy |
| `onSchedule` | API do Firebase Functions v2 (`firebase-functions/v2/scheduler`) usada para criar Scheduled Cloud Functions |
| Admin SDK | SDK server-side do Firebase (`firebase-admin`), usado em Cloud Functions, com acesso irrestrito ao Firestore — ignora `firestore.rules` por definição |
| Client SDK | SDK usado no frontend (`firebase/firestore`), sujeito a `firestore.rules` |
| Débito técnico | Categoria do mapa de bugs para uma lacuna de infraestrutura/arquitetura conhecida e conscientemente adiada, diferente de um bug ativo |
| Fronteira de empacotamento do deploy | Neste projeto, o `firebase deploy --only functions` empacota apenas o diretório `functions/` (`firebase.json`, `functions[0].source`), o que impede import direto de código fora dele |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.35) — achados `UC-15-RN-05` e `UC-42-RN-05`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-15-configurar-limite-de-estoque-baixo-por-produto.md`
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-42-executar-verificacoes-de-alertas-manualmente.md` (v1.4.1)
- `src/lib/services/alertTriggers.ts`
- `src/lib/services/notificationService.ts`
- `src/types/notification.ts`
- `src/components/clinic/AlertsTab.tsx`
- `functions/src/processEmailQueue.ts` (padrão `admin.firestore()` lazy)
- `functions/src/index.ts`
- `functions/package.json`
- `firebase.json`, `firestore.indexes.json`
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` (Git Flow, fluxo de PR)

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.1 | 27/09/2026 | Guilherme Scandelari | Task concluída — movida para TASK_COMPLETED. STEPs 1-5 implementados e commitados na branch `feature/scheduled-alert-checks` (extração de `alertRules.ts`, testes unitários — 30 cenários, refatoração de `alertTriggers.ts`, camada Admin SDK `alertChecks.ts`, `checkAlertsScheduled` onSchedule). Verificação de gate: `npm run type-check`, `npm test` (230 testes, 16 suites, todos passando, incluindo `alertRules.test.ts`) e `cd functions && npm run build` sem erros. Validação funcional via Firebase Emulator Suite (script temporário de seed, removido após uso): `runChecksForAllTenants` (Admin SDK) processou apenas o tenant ativo (`tenantsProcessed=1`), criou as 3 notificações esperadas (expiring/expired/low_stock) e 0 notificações no tenant inativo semeado para o teste; segunda execução não duplicou nenhuma notificação (dedup confirmado). Durante essa validação foram encontrados e corrigidos 2 bugs reais pré-existentes, fora do escopo original desta spec mas necessários para a feature funcionar: (1) `runChecksForAllTenants` filtrava `tenantData.status !== 'active'`, mas a coleção `tenants` usa o campo booleano `active` — o filtro sempre pulava 100% dos tenants; corrigido em `src/lib/services/alertTriggers.ts` (commit `refactor(inventory): use alertRules pure functions in alertTriggers`) e em `functions/src/alertChecks.ts` (já escrito correto desde a criação, commit `feat(firebase): add admin sdk alert checks`). (2) O dedup de `checkLowStock` filtrava `where('codigo_produto', '==', ...)`, campo nunca gravado no nível raiz do documento de notificação (só existe em `metadata.product_code`) — toda checagem de estoque baixo duplicava notificação; corrigido nos dois lados em commit próprio `fix(inventory): fix low-stock notification dedup querying wrong field`. STEP 6 (validação pós-deploy real via `gcloud scheduler jobs run`, incluindo o pré-requisito de App Engine para Cloud Scheduler) **não pôde ser executado nesta sessão** por depender de deploy real no ambiente pessoal do usuário — fica registrado como validação pendente pós-deploy em `gscandelari_setup` (`dev-gscandelari.web.app`), a ser feita pelo próprio usuário após o merge; não bloqueia a conclusão da task branch. STEP 7 (fechar `UC-15-RN-05`/`UC-42-RN-05` em `_MAPA-DE-BUGS-E-MELHORIAS.md`) foi **deliberadamente deferido** — esta branch foi criada antes do PR #298 (correção de UC-32-RN-08/UC-51/52/53) mergear, então o mapa de bugs nesta branch está desatualizado (v3.33); o fechamento será feito depois, via `uc-issues-tracker`, direto em `gscandelari_setup` já atualizado, para evitar conflito de versão do arquivo. |
| 1.0 | 27/09/2026 | Doc Writer (Claude) | Versão inicial |
