# ADR: Automação de QA via Playwright + Firebase Emulator Suite (proposta em aberto)

**Projeto:** Curva Mestra
**Data:** 17/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento — **PAUSADO deliberadamente, decisão não tomada**
**Tipo:** ADR
**Branch sugerida:** N/A — este documento apenas registra a proposta; nenhuma branch de implementação deve ser criada até a retomada e aprovação explícita do escopo (ver Seção 10.1)
**Prioridade:** A decidir na retomada — o próprio usuário pediu para revisitar este assunto **antes de iniciar qualquer nova implementação**, o que sugere revisão cedo, mas isso não é uma autorização para implementar nada agora
**Versão:** 1.0

> **Isto NÃO é uma decisão de arquitetura tomada.** É o registro de uma proposta discutida em 17/07/2026, durante a correção de 4 bugfixes críticos (UC-43, UC-34, UC-29, UC-36), a pedido explícito do usuário: *"Vamos colocar isso como uma tarefa do TO_DO. Quero voltar nessa tarefa em um momento mais oportuno, antes mesmo de iniciarmos outras implementações."* Este documento captura o raciocínio já levantado e as perguntas em aberto — nenhum código, configuração ou infraestrutura deve ser criado a partir dele sem antes retomar a discussão e responder à Seção 10.1.

---

## 0. Git Flow e Convenção de Commits

**Esta seção é N/A no estado atual do documento.** Não há implementação planejada nesta versão do ADR — apenas o registro da proposta. Quando (e se) a proposta for retomada e aprovada, o `doc-writer` deve gerar uma nova versão deste documento (ou um `FEAT`/`CR` derivado dele) com:

- Branch base: `develop` (padrão do projeto)
- Nome de branch sugerido nesse momento futuro: `chore/qa-agent-playwright-emulator-setup` (infraestrutura de teste, não é `feature` de produto)
- Tabela de commits planejados por step — a construir quando o escopo for aprovado

Até lá, **nenhum commit relacionado a esta proposta deve ser aberto**.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

Durante a sessão de correção dos 4 bugfixes críticos mais recentes, cada spec gerado pelo `doc-writer` (todos hoje em `ONLY_FOR_DEVS/TASK_COMPLETED/`) incluiu, na Seção 8 ("Estratégia de Testes"), a mesma decisão repetida: **não escrever testes automatizados** para API routes e componentes React que dependem diretamente do Firebase Admin/Client SDK. A justificativa, também repetida literalmente entre os specs, foi "mock frágil, sem abstração injetável":

- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-suspend-consultant-reconnect-delete.md` (Seção 8, linha 482): *"Handlers dependem diretamente do Firebase Admin SDK (`adminAuth`, `adminDb`) sem abstração injetável — mock frágil, mesmo padrão já adotado em todo o restante do projeto."* — refere-se a `DELETE`/`PUT` em `src/app/api/consultants/[id]/route.ts` e a `handleSuspend`/`handleReactivate` em `src/app/(admin)/admin/consultants/page.tsx` (UC-29).
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-sync-user-claims-on-edit.md` — mesmo critério aplicado à rota `PUT /api/users/[id]` (UC-36), que sincroniza custom claims (`role`, `tenant_id`, `active`) a partir de uma edição de usuário.
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-block-legal-document-deletion-with-acceptances.md` — mesmo critério aplicado ao bloqueio de exclusão de documento legal com aceites registrados (UC-34), lógica que vive direto em `admin/legal-documents/page.tsx` (`handleDelete`).
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-notification-settings-setdoc.md` — mesmo critério aplicado a `notificationService.ts` (UC-43), embora aqui o bug em si (`updateDoc` → `setDoc`) fosse trivial o suficiente para não exigir sequer validação manual extensa.

Em compensação, todos os 4 specs incluíram uma Seção "STEP 4 — Validação Manual" detalhada, com passos numerados e resultado esperado — por exemplo, em `BUGFIX-suspend-consultant-reconnect-delete.md` (linha 450, "STEP 4 — Validação manual (obrigatória antes de abrir o PR)"): clicar em Suspender, confirmar `disabled: true` no Firebase Auth, confirmar que as demais claims foram preservadas, tentar login real e esperar falha. O checklist de Definition of Done desse mesmo spec (linha 500) exige explicitamente: *"Validação manual do STEP 4 executada e documentada no PR — incluindo a confirmação de `disabled`/claims no Firebase Auth/Admin SDK, não apenas o comportamento visual da UI."*

Ao validar manualmente os 4 PRs, o usuário perguntou se seria possível automatizar essa validação manual com um "Agente de QA" que seguisse a documentação já produzida.

**Infraestrutura de teste hoje existente (verificada nesta sessão):**

- `CLAUDE.md` já declara na stack oficial: `Testes: Firebase Emulator Suite + Playwright E2E + Jest` — mas apenas o Jest está de fato em uso (funções puras, ex.: `parseNfeXml.ts`).
- `package.json`: `@playwright/test` **já está instalado** como devDependency (`^1.49.1`), mas **não existe** `playwright.config.ts`, **não existe** diretório de testes E2E, e **não existe** script `test:e2e` no `package.json` (o script consta apenas como exemplo no guia de pipeline, `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, Seção 5.1 — nunca foi de fato adicionado ao `package.json` real).
- `firebase.json`: a seção `emulators` **já está configurada** (Auth na porta 9099, Firestore na 8080, Functions na 5001, Storage na 9199, Hosting na 5000, UI na 4000, `singleProjectMode: true`) — mas não há evidência de uso ativo (nenhum script de seed, nenhum workflow de CI que suba o emulador).
- `.github/workflows/ci.yml` (conforme documentado na Seção 4.1 do guia de pipeline) roda apenas `lint`, `type-check`, `test` (Jest) e `build` — não há job de E2E.

Ou seja: a base de ferramentas para a proposta já existe parcialmente instalada/configurada, mas nunca foi conectada em um fluxo funcional.

### 1.2 Problema identificado

1. A justificativa de "mock frágil" usada para pular testes automatizados nesta sessão (e nas anteriores) é válida **apenas** para testes unitários com mock do Admin SDK — ela não se aplica a testes rodando contra o **Firebase Emulator Suite** (Firestore + Auth emulados de verdade, sem mock) combinado com **Playwright** dirigindo a UI real. Nesse cenário é possível verificar via Admin SDK, contra o emulador, se `disabled`/custom claims realmente mudaram — exatamente a classe de bug mais recorrente na sessão (claims não sincronizadas; ex.: `DELETE /api/consultants/[id]` que espalhava o próprio documento Firestore como se fossem claims, corrigido em `BUGFIX-suspend-consultant-reconnect-delete.md`).
2. Toda a superfície de segurança do sistema (Auth, custom claims, multi-tenant) hoje depende **inteiramente** de validação manual documentada em specs — sem nenhuma rede de segurança automatizada que detecte regressão nessa superfície entre um bugfix e o próximo.
3. A infraestrutura de teste declarada na stack oficial (`CLAUDE.md`) está parcialmente instalada mas nunca foi de fato acionada — há uma divergência entre o que o projeto diz que usa e o que efetivamente roda em CI.

### 1.3 Motivação estratégica

A pergunta do usuário não foi "implemente isso agora" — foi "isso é possível?". A resposta (sim, tecnicamente) abriu uma decisão de investimento de engenharia que **não deveria ser tomada no meio de uma sequência de bugfixes**: montar essa infraestrutura (seed de dados, fixtures de autenticação no Playwright, configuração do emulador, possivelmente um novo agente no pipeline de PO/BA) reverte a decisão de "não testar" tomada em todos os specs até agora e tem custo real. O usuário pediu explicitamente para registrar a proposta como tarefa do `TO_DO` e retomá-la "em um momento mais oportuno, antes mesmo de iniciarmos outras implementações" — ou seja: **este documento existe para não perder o raciocínio já feito, não para autorizar a construção de nada.**

---

## 2. Objetivos

Objetivos **deste documento** (não da eventual implementação futura):

1. Registrar formalmente a proposta de automação de QA discutida em 17/07/2026, com todo o raciocínio já levantado.
2. Documentar o estado real da infraestrutura de teste hoje existente no projeto (o que já está pronto vs. o que falta) para que a retomada não precise refazer essa investigação.
3. Levantar, sem responder, as perguntas que precisam ser decididas antes de qualquer implementação (Seção 10.1).
4. Servir de gatilho de lembrete: nenhuma nova implementação de bugfix/feature relacionada a Auth/claims deveria começar sem que este ADR seja, no mínimo, revisitado — para decidir conscientemente adiar de novo, ou não.

Objetivos **da eventual implementação futura** (não decididos, apenas capturados como intenção original da proposta):

5. ⚠️ Avaliar (não implementar) um "Agente de QA" capaz de ler a Seção "STEP 4 — Validação Manual" de um spec já concluído em `ONLY_FOR_DEVS/TASK_COMPLETED/*.md` e gerar/rodar, a partir dela, um spec Playwright equivalente.
6. ⚠️ Avaliar (não implementar) a execução desses specs Playwright contra o Firebase Emulator Suite semeado com dados de teste representativos dos cenários já usados nos roteiros manuais desta sessão.

---

## 3. Requisitos

> ⚠️ **Nenhum requisito abaixo está aprovado.** As tabelas a seguir documentam o **escopo candidato** conforme discutido na conversa de origem — servem de ponto de partida para a decisão futura, não de especificação para implementação imediata.

### 3.1 Requisitos Funcionais (RF) — candidatos, não aprovados

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 (candidato) | Um "Agente de QA" lê a seção "STEP 4 — Validação Manual" de um spec em `ONLY_FOR_DEVS/TASK_COMPLETED/*.md` já concluído. | dev-task-manager / agente de QA (a definir) | A decidir |
| RF-02 (candidato) | O agente gera um spec Playwright equivalente aos passos manuais descritos (ex.: "clicar em Suspender → confirmar `disabled: true` no Firebase Auth → confirmar preservação das demais claims → tentar login real, esperar falha"). | agente de QA (a definir) | A decidir |
| RF-03 (candidato) | O spec Playwright roda contra o Firebase Emulator Suite (Firestore + Auth reais, emulados — sem mock), semeado com dados de teste fixos (ex.: duas clínicas, uma com 2 `clinic_admin` ativos e outra com 1, um consultor de teste, um documento legal com e sem aceite). | CI ou execução sob demanda (a definir) | A decidir |
| RF-04 (candidato) | A verificação pós-ação usa o Admin SDK contra o emulador para confirmar o estado real de `disabled`/custom claims — não apenas o comportamento visual da UI. | agente de QA (a definir) | A decidir |

### 3.2 Requisitos Não Funcionais (RNF) — candidatos, não aprovados

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 (candidato) | Execução do Emulator Suite + Playwright não deve aumentar o tempo de CI de forma proibitiva (hoje: apenas lint/type-check/test/build). | Performance |
| RNF-02 (candidato) | Dados semeados no emulador devem ser determinísticos e isolados entre execuções (sem dependência de estado do Firebase real). | Manutenibilidade |
| RNF-03 (candidato) | Specs Playwright gerados automaticamente devem ser revisáveis por humano antes de rodar em CI (evitar falso senso de segurança de testes gerados sem revisão). | Segurança/Qualidade |

### 3.3 Regras de Negócio (RN)

N/A — não há regras de negócio de produto envolvidas; esta proposta é inteiramente de infraestrutura de engenharia/QA.

---

## 4. Decisões de Design

> Esta seção é o núcleo deste ADR: registra o raciocínio já discutido e as alternativas, **sem fechar uma decisão final**.

### 4.1 Abordagem em discussão (não escolhida, não descartada)

A abordagem levantada na conversa combina duas peças já parcialmente presentes no projeto:

1. **Firebase Emulator Suite** (`firebase.json` já configurado com Auth, Firestore, Functions, Storage) como substituto do mock do Admin/Client SDK — elimina a justificativa de "mock frágil" porque não há mock: Firestore e Auth reais rodam localmente/em CI, emulados.
2. **Playwright** (já instalado como devDependency, mas sem `playwright.config.ts` nem testes) dirigindo a UI real contra esse backend emulado, com asserções finais feitas via Admin SDK diretamente no emulador (não apenas via DOM).

A camada adicional discutida — e que é a parte genuinamente nova, não apenas "configurar ferramentas que já estão na stack" — é um **"Agente de QA"**: um agente de IA (nos mesmos moldes de `doc-writer`, `dev-task-manager` etc., descritos na Seção 15 do `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`) cuja entrada seria a Seção "STEP 4 — Validação Manual" de um spec já concluído, e cuja saída seria um spec Playwright executável equivalente.

### 4.2 Alternativas discutidas (nenhuma descartada nem escolhida definitivamente)

| Alternativa | Descrição | Observação levantada na conversa |
|---|---|---|
| **A — Não automatizar; manter validação 100% manual** (status quo) | Continuar exatamente como hoje: cada spec de bugfix/feature documenta um roteiro manual em "STEP 4", executado pelo dev/usuário antes do PR. | É a decisão vigente em todos os 4 specs recentes; zero custo de infraestrutura, mas zero rede de segurança automatizada contra regressão. |
| **B — Agente de QA gerando Playwright a partir do STEP 4 (proposta discutida)** | Conforme 4.1. | Resolveria a lacuna de regressão automatizada especificamente para a classe de bug mais recorrente (claims/Auth), mas exige montar seed de dados, fixtures de autenticação, config de emulador e possivelmente um novo agente no pipeline. |
| **C — Testes unitários com mock do Admin SDK (rejeitada nesta sessão, mas citável como alternativa formal)** | Abordagem clássica de mock em testes unitários para API routes. | Já rejeitada consistentemente nos 4 specs recentes por "mock frágil, sem abstração injetável" — não é uma alternativa nova, é o status quo já descartado; citada aqui apenas para registro completo. |

### 4.3 Trade-offs discutidos (não resolvidos)

- **Investimento de engenharia real vs. rede de segurança automatizada:** montar a infraestrutura da Alternativa B (seed de dados, fixtures de autenticação no Playwright, configuração do emulador, e possivelmente um novo agente no pipeline de PO/BA) é trabalho não-trivial. Reverte a decisão de "não testar" tomada em todos os specs até agora. O usuário foi explícito: isso "precisa ser avaliado com calma, não no meio de uma sequência de bugfixes."
- **Cobertura parcial vs. cobertura completa:** mesmo se aprovada, não está definido se a Alternativa B cobriria todos os bugfixes futuros ou apenas os que tocam Auth/claims (a classe de bug mais recorrente e mais crítica em segurança) — ver pergunta em 10.1.
- **Geração automática vs. confiabilidade dos testes gerados:** um spec Playwright gerado por um "Agente de QA" a partir de texto em português (a Seção STEP 4) carrega risco de má interpretação — precisaria de revisão humana antes de virar gate de CI, o que reduz (mas não elimina) o ganho de automação total.

---

## 5. Mapa de Impacto

> Nada nesta seção deve ser criado, modificado ou removido nesta etapa. Lista-se aqui apenas o que **seria potencialmente afetado se a proposta for aprovada no futuro**, para acelerar a retomada.

### 5.1 Arquivos a CRIAR (potenciais, apenas se aprovado)

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `playwright.config.ts` | Config | Apontar Playwright para a base URL do emulador/dev server e para o Firebase Emulator Suite |
| `tests/e2e/*.spec.ts` (estrutura a definir) | Testes E2E | Specs Playwright gerados a partir das seções "STEP 4" dos bugfixes já concluídos |
| Script de seed do emulador (ex.: `scripts/seed-emulator.ts`) | Script | Popular Firestore/Auth emulados com os dados de teste padrão (duas clínicas, consultores, documento legal com/sem aceite) |
| `.claude/agents/qa-agent.md` (nome provisório) | Definição de agente | Novo agente de IA que lê `STEP 4` de um spec em `TASK_COMPLETED/` e gera o spec Playwright equivalente — ver pergunta 10.1.4 sobre onde este viveria no pipeline |
| Job de CI para E2E (ex.: `.github/workflows/e2e.yml`) | CI/CD | Subir o Emulator Suite e rodar os specs Playwright — apenas se RF-03 for aprovado para rodar em CI (ver 10.1.2) |

### 5.2 Arquivos a MODIFICAR (potenciais, apenas se aprovado)

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `package.json` | Adicionar script `test:e2e` (já documentado como exemplo na Seção 5.1 do guia de pipeline, mas nunca adicionado de fato) |
| `.github/workflows/ci.yml` | Possível novo job de E2E, condicionado à decisão de 10.1.2 (sob demanda vs. CI) |
| `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` (Seção 15) | Se um novo agente de QA for criado, documentar seu papel na tabela de agentes e no fluxo completo |

### 5.3 Arquivos a REMOVER

N/A — nenhuma remoção prevista.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| Todas as coleções relevantes aos cenários de teste (`tenants/{tenantId}/*`, `consultants`, `legal_documents`, `user_document_acceptances`, `settings/notifications`) | Nenhuma alteração de schema | Impacto seria apenas de **dados de teste semeados no emulador**, nunca no Firestore de produção/dev real — isolamento total é um requisito implícito de qualquer implementação futura. |

### 5.5 O que NÃO muda

- Nenhum código de produção (`src/`) é tocado por esta proposta em si — ela é puramente sobre infraestrutura de teste.
- A decisão vigente de "não escrever testes unitários com mock do Admin SDK" para API routes/componentes React permanece válida e **não é revertida** só por este documento existir — só seria revertida por uma decisão futura explícita.
- O padrão atual de "STEP 4 — Validação Manual" em todo spec de bugfix/feature que toca Auth/segurança continua sendo a prática vigente até nova decisão.

---

## 6. Especificação Técnica

> Nenhuma especificação técnica é definitiva nesta etapa. O esboço abaixo é **ilustrativo do raciocínio discutido**, não uma spec pronta para implementação.

### 6.1 Mudanças no modelo de dados

N/A — sem mudanças de schema de produção. Dados de teste semeados no emulador (Alternativa B) seguiriam os tipos já existentes em `src/types/` sem alteração.

### 6.2 Mudanças em serviços

N/A nesta etapa.

### 6.3 Mudanças na UI

N/A — nenhuma tela de produto é alterada por esta proposta.

### 6.4 Mudanças em API Routes

N/A — nenhuma API route de produto é alterada por esta proposta.

### 6.5 Esboço ilustrativo (não normativo) de um spec Playwright gerado

Apenas para tornar a proposta concreta na leitura futura — **não é código a implementar agora**. Exemplo hipotético derivado do STEP 4 de `BUGFIX-suspend-consultant-reconnect-delete.md`:

```ts
// ILUSTRATIVO — não implementar sem retomar a decisão (Seção 10.1)
test('suspender consultor: disabled=true no Auth, claims preservadas, login falha', async ({ page }) => {
  // 1. login como system_admin (fixture de auth no emulador)
  // 2. navegar para /admin/consultants
  // 3. clicar em "Suspender" no consultor de teste semeado
  // 4. via Admin SDK contra o emulador: getUser(uid).disabled === true
  // 5. via Admin SDK: demais custom claims (tenant_id, role) preservadas
  // 6. tentar signInWithEmailAndPassword com o consultor suspenso → esperar erro
});
```

---

## 7. Plano de Implementação

**Não há plano de implementação nesta etapa.** Nenhum step abaixo deve ser executado até a proposta ser retomada e aprovada explicitamente.

Quando a proposta for retomada, sugere-se que a primeira conversa (não step de código) resolva as perguntas da Seção 10.1 antes de qualquer `doc-writer`/`dev-task-manager` ser acionado. Só depois disso um plano de implementação real (com steps, commits e validação) deveria ser gerado — nesse momento, este ADR deve ser incrementado (versão minor/major, Seção 13) ou um `FEAT`/`CR` derivado deve ser aberto referenciando-o.

---

## 8. Estratégia de Testes

N/A neste documento — ironicamente, "estratégia de testes" é o próprio objeto da proposta, não algo a aplicar a este documento. Quando a implementação for aprovada, a estratégia de testes *da infraestrutura de teste em si* (ex.: como validar que o script de seed funciona, como validar que o agente de QA gera specs corretos) deve ser definida na spec de implementação derivada.

---

## 9. Checklist de Definition of Done

```
[ ] N/A — este documento não gera código; nenhum item de DoD de implementação se aplica nesta etapa.
[ ] Este ADR foi lido e as perguntas da Seção 10.1 foram respondidas ANTES de qualquer implementação começar.
[ ] Se aprovado: gerar spec de implementação derivada (FEAT ou CR) via doc-writer, com Seção 0 (Git Flow), Seção 7 (Plano) e Seção 9 (DoD) completas de verdade.
[ ] Se cancelado/adiado indefinidamente: atualizar Status deste documento para "Cancelado" e registrar o motivo na Seção 13.
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Este documento ser esquecido em `TO_DO/` e nunca retomado, perdendo o raciocínio já investido | Média | Médio | Está registrado aqui, em `ONLY_FOR_DEVS/TO_DO/`, exatamente para ser reencontrado; recomenda-se citá-lo explicitamente na próxima vez que `uc-issues-tracker` for consultado antes de escolher a próxima task (Seção 15.3 do guia de pipeline). |
| A proposta ser retomada e implementada apressadamente, sem responder à Seção 10.1 primeiro | Média | Alto | Este ADR existe justamente para impor essa pausa; qualquer `doc-writer`/`dev-task-manager` acionado sobre este tema deve ser instruído a ler este documento por completo antes de gerar uma spec de implementação. |
| Investir na infraestrutura (Alternativa B) e ela não reduzir de fato o tempo gasto em validação manual (ex.: specs gerados exigem tanta revisão humana quanto escrever o teste à mão) | Baixa/Média | Médio | Se retomado, considerar um piloto restrito a 1 bugfix antes de generalizar (ver pergunta 10.1.3). |
| Continuar sem automação nenhuma e um bug de sincronização de claims (a classe mais recorrente nesta sessão) voltar a escapar para produção | Média | Alto | É exatamente o risco que motivou a proposta; mitigado hoje apenas pela disciplina de STEP 4 manual — sem rede de segurança automatizada. |

### 10.1 Perguntas em aberto — a responder na retomada

⚠️ **Nenhuma destas perguntas foi respondida.** Elas devem ser discutidas com o usuário antes de qualquer implementação:

1. **Momento do investimento:** vale a pena montar essa infraestrutura agora, ou o investimento deve esperar o pós-MVP (quando o sistema estiver mais estável e o custo de manutenção dos specs Playwright gerados for mais previsível)?
2. **Modo de execução:** o "Agente de QA" (e os specs Playwright que ele gera) rodaria sob demanda (ex.: acionado manualmente pelo dev ao concluir um bugfix), ou entraria como gate obrigatório em CI (`.github/workflows/ci.yml` ou um novo `e2e.yml`)? Isso afeta diretamente RNF-01 (tempo de CI) e a decisão de branch protection (Seção 3.3 do guia de pipeline, hoje sem esse gate).
3. **Escopo de cobertura:** a automação cobriria **todos** os bugfixes/features futuros que incluam uma seção "STEP 4 — Validação Manual", ou apenas os que tocam Auth/custom claims/segurança (a classe de bug mais recorrente e mais crítica identificada nesta sessão)? Um piloto restrito reduziria o investimento inicial descrito em 4.3.
4. **Onde o "Agente de QA" vive no pipeline:** seria um quinto agente formal (ao lado de `uml-use-case-writer`, `uc-issues-tracker`, `doc-writer`, `dev-task-manager`, descritos na Seção 15 do `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`), acionado em que ponto do fluxo — logo após `dev-task-manager` concluir e mover o spec para `TASK_COMPLETED/`? Isso exigiria atualizar a tabela da Seção 15.1 e o diagrama da Seção 15.2 daquele guia.
5. **Versionamento dos specs Playwright gerados:** ficam versionados junto do spec `.md` de origem (ex.: numa subpasta ao lado do arquivo em `TASK_COMPLETED/`), ou centralizados num diretório único `tests/e2e/` sem relação de pasta com o spec que os originou? Isso afeta rastreabilidade (qual teste veio de qual bugfix) vs. convenção usual de projetos Next.js/Playwright (testes centralizados).
6. **Confiabilidade da geração automática:** todo spec Playwright gerado pelo agente exigiria revisão humana obrigatória antes de virar gate de CI (reduzindo o ganho de automação), ou haveria algum nível de confiança para rodar direto? Ver trade-off 4.3.
7. **Dados de teste (seed):** os dados de teste do emulador (duas clínicas, consultores, documento legal com/sem aceite) seriam mantidos como fixture versionada e reaproveitada entre specs, ou gerados sob demanda por cada spec Playwright de forma isolada? Isso afeta RNF-02 (determinismo/isolamento).

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Firebase Emulator Suite | Conjunto de emuladores locais do Firebase (Auth, Firestore, Functions, Storage, Hosting) que reproduzem o comportamento real dos serviços sem tocar em dados de produção — já configurado em `firebase.json` neste projeto, mas não conectado a nenhum fluxo de teste automatizado. |
| Playwright | Framework de testes E2E (end-to-end) que dirige um navegador real contra a aplicação — já instalado como devDependency (`@playwright/test`), mas sem configuração (`playwright.config.ts`) nem testes escritos neste projeto. |
| "Mock frágil" | Justificativa usada nos 4 specs de bugfix recentes para não escrever testes unitários de API routes/componentes que dependem diretamente do Firebase Admin/Client SDK sem abstração injetável — válida para testes unitários com mock, não para testes contra o Emulator Suite. |
| STEP 4 — Validação Manual | Seção padrão presente em specs de bugfix/feature deste projeto, com passos numerados de verificação manual pré-PR — a "entrada" que o Agente de QA proposto leria para gerar testes automatizados equivalentes. |
| Agente de QA (proposto) | Agente de IA hipotético, não implementado, que leria a seção STEP 4 de um spec concluído e geraria/rodaria um spec Playwright equivalente contra o Emulator Suite. |

---

## 12. Referências

- `CLAUDE.md` — declara a stack oficial de testes (`Firebase Emulator Suite + Playwright E2E + Jest`), hoje parcialmente implementada.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, Seção 4.1 (workflow de CI atual, sem job de E2E), Seção 5.1 (script `test:e2e` documentado como exemplo, nunca adicionado ao `package.json` real) e Seção 15 (pipeline de agentes de IA — `uml-use-case-writer`, `uc-issues-tracker`, `doc-writer`, `dev-task-manager`).
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-suspend-consultant-reconnect-delete.md` — origem do exemplo de STEP 4 citado (UC-29); Seção 8 com a justificativa "mock frágil".
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-sync-user-claims-on-edit.md` — bugfix de sincronização de claims (UC-36), mesma justificativa de não-teste.
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-block-legal-document-deletion-with-acceptances.md` — bugfix de bloqueio de exclusão de documento legal (UC-34), mesma justificativa de não-teste.
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-notification-settings-setdoc.md` — bugfix `updateDoc`→`setDoc` (UC-43), mesma justificativa de não-teste.
- `package.json` — confirma `@playwright/test` já instalado, ausência de `playwright.config.ts` e de script `test:e2e`.
- `firebase.json` — confirma configuração já existente da seção `emulators` (Auth, Firestore, Functions, Storage, Hosting).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 17/07/2026 | Doc Writer (Claude) | Versão inicial. Registra a proposta de automação de QA discutida durante a sessão de correção dos bugfixes UC-43, UC-34, UC-29 e UC-36, com o raciocínio já levantado e as perguntas em aberto (Seção 10.1) — decisão explicitamente pausada a pedido do usuário. |
