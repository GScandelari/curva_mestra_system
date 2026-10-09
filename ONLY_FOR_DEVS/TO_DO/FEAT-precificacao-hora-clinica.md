# Feature: Precificação pela Hora Clínica (Custos Fixos + Preço Sugerido de Protocolos)

**Projeto:** Curva Mestra
**Data:** 09/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/precificacao-hora-clinica`
**Prioridade:** Média
**Versão:** 1.2

> A clínica passa a cadastrar seus custos fixos mensais (incluindo financiamentos de equipamento, "Boleto Tec"), sua disponibilidade semanal e sua capacidade simultânea de atendimento, e o sistema calcula o **custo da hora clínica** do mês corrente. Esse valor, somado ao custo médio dos materiais do inventário, gera o **custo real** e o **preço sugerido** (markup divisor) de cada Protocolo. É um valor de **norte** para precificação, não um cálculo contábil. Os dados são restritos ao `clinic_admin`, com opção explícita de compartilhamento somente-leitura com o consultor vinculado.

> Decisões D1–D6 tomadas pelo usuário em 09/10/2026 (Seção 4.4). D6 (v1.2): o consultor só lê `protocolos` com o opt-in financeiro ativo para ele — mesma regra de `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (UC-48-RN-06); convivência descrita na Seção 5.4.1. Documento pronto para o `dev-task-manager`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (sincronizar antes: `git checkout develop && git pull origin develop`; conferir que `develop` existe local + remoto e está em sync com `master`).
- **Branch da task:** `feature/precificacao-hora-clinica`
- **Fluxo de PR (Seção 1.3 do guia):** task branch → PR para `gscandelari_setup` (validação em `dev-gscandelari.web.app`) → PR `gscandelari_setup` → `develop`. **Nunca** PR direto para `master`.
- **Escopo único (Fase 1 + Fase 2):** uma única branch. Os STEPs abaixo são ordenados para que cada commit mantenha `lint`/`type-check`/`build` verdes.

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| STEP 1.1 | `feat` | `types` | `feat(types): add custo hora config and protocolo duration types` |
| STEP 1.2 | `feat` | `tenant` | `feat(tenant): add pure functions for clinic hour cost and pricing` |
| STEP 1.3 | `test` | `tenant` | `test(tenant): cover clinic hour cost, pricing and share audit` |
| STEP 2.1 | `feat` | `firebase` | `feat(firebase): restrict financeiro subcollection to clinic_admin` |
| STEP 2.1 | `feat` | `firebase` | `feat(firebase): gate consultant protocol reads on financial opt-in` — **omitir** se o `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` já tiver entrado em `develop` com a mesma regra (Seção 5.4.1) |
| STEP 2.2 | `test` | `firebase` | `test(firebase): cover financeiro rules and consultant opt-in` |
| STEP 2.3 | `feat` | `tenant` | `feat(tenant): add custo hora config service` |
| STEP 2.4 | `feat` | `tenant` | `feat(tenant): audit consultant financial sharing toggle` |
| STEP 3.1 | `feat` | `clinic` | `feat(clinic): add fixed costs tab to my clinic` |
| STEP 3.2 | `feat` | `clinic` | `feat(clinic): add duration to protocolo form` |
| STEP 3.3 | `feat` | `clinic` | `feat(clinic): show suggested price on protocolos list` |
| STEP 3.4 | `feat` | `consultant` | `feat(consultant): add read-only pricing view for shared clinics` |
| STEP 4 | — | — | Validação manual (sem commit de código) |
| STEP 5 | `docs` | `uc` | `docs(uc): map clinic hour pricing use case` (acionar `uml-use-case-writer`) |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

- **Minha Clínica** (`src/app/(clinic)/clinic/my-clinic/page.tsx`) tem 4 abas: `clinic` (`ClinicInfoTab`), `users` (`UsersTab`, só admin), `stock_limits` (`StockLimitsTab`, só admin) e `consultant` (`ConsultantTab`). A restrição a admin é feita por `isAdmin = claims?.role === 'clinic_admin'` e por um `useEffect` que força `activeTab = 'clinic'` quando um não-admin tenta abrir `users`/`stock_limits` via `?tab=`. As abas são carregadas com `next/dynamic`.
- **Protocolos** (UC-20): tipo `Protocolo` em `src/types/index.ts` (campos `id`, `tenant_id`, `nome`, `descricao?`, `itens: ProtocoloItem[]`, `active`, `created_at`, `updated_at`, `created_by`); `ProtocoloItem` = `{ codigo_produto, nome_produto, quantidade_sugerida }`. Serviço em `src/lib/services/protocoloService.ts` (`getHistoricalProducts`, `listProtocolos`, `createProtocolo`, `updateProtocolo`, `deleteProtocolo` — soft delete via `active: false`). Telas: listagem `src/app/(clinic)/clinic/protocolos/page.tsx` (visível a `clinic_admin` e `clinic_user`; botões de ação só para admin), criação `.../protocolos/novo/page.tsx` e edição `.../protocolos/[id]/page.tsx` (ambas redirecionam não-admin), formulário compartilhado `src/components/protocolos/ProtocoloForm.tsx`. **Não existe tela de detalhe somente-leitura** — `[id]` é a tela de edição.
- **Inventário**: `InventoryItem` (`src/types/index.ts`) tem `valor_unitario` (sempre por unidade — ver comentário em `add-products/page.tsx`, linha 63), `quantidade_inicial`, `quantidade_disponivel`, `active?`, `brand?`, `codigo_produto`. Não existe hoje nenhuma função de "custo médio por produto".
- **Custeio (UC-51)**: `src/lib/services/costingService.ts` calcula custo de material **consumido** (solicitações concluídas, `valor_unitario` do momento do consumo). Não conhece duração nem hora clínica.
- **Regras Firestore** (`firestore.rules`):
  - Bloco genérico `match /tenants/{tenantId}/{collectionId}/{document=**}` (linhas 87–97) concede **leitura** a qualquer usuário do tenant **e** a qualquer consultor com o tenant em `authorized_tenants`, para **todas** as subcoleções exceto `nf_imports`.
  - Escrita só existe em blocos dedicados (`inventory`, `stock_limits`, `protocolos`, `solicitacoes`, `inventory_activity`, `nf_imports`, `notifications`, `settings/notifications`). Subcoleção sem bloco dedicado é fail-closed para escrita.
  - Documento raiz `tenants/{tenantId}`: **qualquer** usuário do tenant (inclusive `clinic_user`) pode fazer `update`, exceto nos campos de suspensão (linhas 49–51); consultores com acesso leem o documento raiz.
- **Consultor**: claims `is_consultant`, `consultant_id`, `authorized_tenants` (`CustomClaims` em `src/types/index.ts`; helper `consultantHasAccess(tenantId)` nas rules). Telas: `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx` (stats + botões "Ver Estoque" e "Ver Projeções"), `.../inventory/page.tsx`, `.../projections/page.tsx`. A UI do consultor filtra o inventário por `brand == 'Rennova'` (regra de produto de `FEAT-brand-e-visibilidade-consultor.md`: consultor Rennova não deve ver produtos de terceiros) — **o filtro é só de UI**; as rules permitem ao consultor ler todo o inventário. O consultor **não** tem nenhuma tela de protocolos.
- **Trilha de auditoria (UC-53)**: `writeAuditLog` (`src/lib/services/auditLogService.ts`) e `writeAuditLogAdmin` (`src/lib/auditLogAdmin.ts`). `AuditEntityType` = `'user' | 'consultant' | 'tenant' | 'master_product' | 'legal_document' | 'system_settings'`. A RN-10 do UC-53 (registrada em `TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md`, linha 144) declara **fora de escopo** "protocolos, 'Minha Clínica'/UC-45" — ou seja, o padrão atual **não** audita mudanças de configuração feitas pelo `clinic_admin` na própria clínica (ex.: `StockLimitsTab`/`updateStockLimit` não grava auditoria).

### 1.2 Problema identificado

1. A clínica não tem como saber quanto custa uma hora de sala/profissional — o custo fixo (aluguel, salários, financiamento de equipamentos) não está em lugar nenhum do sistema.
2. Protocolos não têm duração, então não é possível atribuir custo de tempo a um procedimento.
3. Não existe um custo médio de material por produto que sirva de base de precificação **antes** do consumo (o UC-51 só olha o passado consumido).
4. Sem esses três elementos, o preço do procedimento continua sendo definido "de cabeça", que é exatamente a dor citada em `FEAT-relatorio-custo-por-procedimento.md` (Contexto).

### 1.3 Motivação estratégica

Decisão de produto do usuário (briefing desta spec): dar à clínica um **norte** de precificação combinando tempo (hora clínica) + material (inventário real), reaproveitando dados que o Curva Mestra já tem (inventário com `valor_unitario`, protocolos). O escopo v1 foi fixado em Fase 1 (custo da hora) + Fase 2 (precificação de protocolos); a integração com o custeio histórico (UC-51) fica para a Fase 3. A opção de compartilhar com o consultor atende ao uso do consultor em planos estratégicos com a clínica, sem quebrar o padrão de "dados financeiros internos não são do consultor por padrão".

---

## 2. Objetivos

1. **Adicionar** a aba "Custos Fixos" em Minha Clínica, visível e editável apenas por `clinic_admin`, com custos fixos base + personalizados, Boletos Tec, disponibilidade semanal, salas/profissionais e parâmetros de markup.
2. **Calcular** em tempo real (client-side, funções puras) custo fixo mensal, horas planejadas do mês corrente, capacidade simultânea e custo da hora clínica.
3. **Adicionar** `duracao_minutos` ao `Protocolo` e exibir, na listagem de protocolos (apenas para quem tem acesso aos dados financeiros), custo de material, custo de hora aplicado, custo real e preço sugerido.
4. **Garantir** isolamento: dados financeiros em subcoleção nova excluída da leitura genérica das rules; `clinic_user` nunca lê; consultor só lê com opt-in explícito do `clinic_admin`.
5. **Expor** ao consultor vinculado (opt-in) uma tela somente-leitura de precificação.
6. **Registrar** na trilha de auditoria (UC-53) somente a ativação, a revogação e a troca de destinatário do compartilhamento com o consultor.
7. **Cobrir** com testes Jest todas as funções puras de cálculo/validação e com testes de rules (`npm run test:rules`) a nova subcoleção.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Exibir aba "Custos Fixos" em `/clinic/my-clinic?tab=fixed_costs` apenas para `clinic_admin`; `clinic_user` que acessar `?tab=fixed_costs` é redirecionado para a aba `clinic` (mesmo padrão de `users`/`stock_limits`). | clinic_admin | Must |
| RF-02 | Listar os 12 custos fixos base (Aluguel, Condomínio, IPTU, Pró-Labore, Energia, Salários, Tarifas Bancárias, Marketing, Contabilidade, Manutenção e Limpeza, Telefone, Sistema de Agenda e Prontuário) com valor em R$ editável, iniciando em 0. | clinic_admin | Must |
| RF-03 | Permitir adicionar/remover itens de custo fixo personalizados (nome + valor). | clinic_admin | Must |
| RF-04 | Permitir cadastrar, editar e remover um ou mais "Boletos Tec" (descrição, valor da parcela, total de parcelas, parcelas já pagas), exibindo as parcelas restantes derivadas e se o boleto compõe ou não o custo do mês. | clinic_admin | Must |
| RF-05 | Permitir configurar disponibilidade por dia da semana (dom..sáb): dia ativo/inativo e um ou mais períodos `HH:MM–HH:MM` por dia ativo. | clinic_admin | Must |
| RF-06 | Bloquear o salvamento quando houver período com fim ≤ início, períodos sobrepostos no mesmo dia, ou dia ativo sem nenhum período, exibindo a mensagem no próprio dia. | clinic_admin | Must |
| RF-07 | Permitir informar quantidade de salas e de profissionais atendendo simultaneamente (inteiros ≥ 1). | clinic_admin | Must |
| RF-08 | Permitir informar imposto %, taxa de cartão %, comissão % e margem desejada %; bloquear salvamento se algum valor < 0 ou se a soma ≥ 100%. | clinic_admin | Must |
| RF-09 | Exibir painel de resumo recalculado em tempo real (sem salvar): total de custos fixos (com breakdown base / personalizados / Boletos Tec), mês de referência (ex.: "outubro/2026"), horas planejadas no mês, capacidade simultânea, custo da hora clínica e divisor de markup. | clinic_admin | Must |
| RF-10 | Persistir a configuração em `tenants/{tenantId}/financeiro/custo_hora` ao clicar em "Salvar". | clinic_admin | Must |
| RF-11 | Adicionar campo "Duração (minutos)" no formulário de protocolo (criação e edição). | clinic_admin | Must |
| RF-12 | Na listagem `/clinic/protocolos`, para `clinic_admin`, exibir em cada card: custo de material, custo de hora aplicado, custo real e preço sugerido. | clinic_admin | Must |
| RF-13 | Se a configuração de custos não existir (ou não permitir calcular custo/hora), exibir na listagem de protocolos um CTA "Configure seus custos fixos" levando a `/clinic/my-clinic?tab=fixed_costs`. | clinic_admin | Must |
| RF-14 | Sinalizar quando o custo de material for incompleto (produto do protocolo sem lote com `valor_unitario` válido) ou quando o protocolo não tiver duração. | clinic_admin | Must |
| RF-15 | Na aba "Custos Fixos", opção "Compartilhar dados financeiros com o consultor" (desabilitada quando não há consultor vinculado). | clinic_admin | Must |
| RF-16 | Com o compartilhamento ativo, o consultor vinculado vê, em `/consultant/clinics/[tenantId]/pricing`, somente leitura: resumo do custo/hora, custos fixos, parâmetros de markup e a precificação dos protocolos. | clinic_consultant | Must |
| RF-17 | Na tela de detalhe da clínica do consultor, exibir o botão "Ver Precificação" apenas quando o documento financeiro for legível para ele (compartilhamento ativo). | clinic_consultant | Should |
| RF-18 | `clinic_user` não vê nenhum valor financeiro (nem aba, nem colunas de preço nos protocolos). | clinic_user | Must |
| RF-19 | Ao salvar com mudança no compartilhamento (desligado → ligado, ligado → desligado, ou troca do consultor destinatário), gravar uma entrada em `audit_log` (`entity_type: 'financial_config'`, ação `share_with_consultant` ou `unshare_with_consultant`), visível em `/clinic/audit-log` e `/admin/audit-log`. Demais alterações da configuração **não** são auditadas. | clinic_admin | Must |
| RF-20 | Na tela do consultor, o detalhe de material de cada protocolo lista apenas itens Rennova; os demais aparecem agregados numa linha "Outros materiais" (sem nome nem código), com subtotal. Totais (material, hora, custo real, preço sugerido) são sempre completos. | clinic_consultant | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda leitura/escrita é em `tenants/{tenantId}/...` com `tenantId` vindo das claims (clinic) ou de `authorizedTenants` (consultor) — nunca de input livre. | Segurança |
| RNF-02 | Isolamento garantido em `firestore.rules` (não só na UI): `clinic_user` e consultor sem opt-in recebem `permission-denied` ao ler `financeiro`. | Segurança |
| RNF-03 | Todos os cálculos são funções puras sem import de Firebase, em `src/lib/precificacao.ts`, testadas com Jest. | Manutenibilidade |
| RNF-04 | Valores calculados **não** são persistidos (custo/hora depende do mês corrente) — sempre recalculados na leitura. | Manutenibilidade |
| RNF-05 | Precisão: cálculos em ponto flutuante sem arredondamento intermediário; arredondamento só na exibição (2 casas, `formatCurrency` de `src/lib/services/reportService.ts`). | Usabilidade |
| RNF-06 | A listagem de protocolos faz no máximo 1 leitura do documento `financeiro/custo_hora` + 1 leitura da coleção `inventory` por carregamento (sem N+1 por protocolo). | Performance |
| RNF-07 | Textos de UI deixam claro que os valores são uma **estimativa de norte**, não um cálculo contábil. | Usabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | `custo_fixo_mensal = Σ custos base + Σ personalizados + Σ valor_parcela dos Boletos Tec que compõem o mês`. | Fórmula definida pelo usuário. |
| RN-02 | Boleto Tec: `parcelas_restantes(mês) = max(0, total_parcelas − parcelas_pagas − max(0, mesesEntre(mes_referencia, mês)))`; o boleto compõe o custo do mês **se e somente se** `parcelas_restantes(mês) > 0`. Ao salvar com `parcelas_pagas` editado (ou boleto novo), `mes_referencia` é redefinido para o mês corrente. Decisão D1. | Avanço automático mês a mês; quitado deixa de compor. |
| RN-03 | `horas_mes = Σ_{dia da semana ativo} (ocorrências do dia no mês de referência × horas do dia)`; horas do dia = Σ (fim − início) dos períodos, em horas. Feriados **não** são descontados na v1. Decisão D2. | Fórmula definida pelo usuário. |
| RN-04 | Mês de referência = mês corrente pelo relógio do cliente (fuso `America/Sao_Paulo`). | Briefing: "mês corrente". |
| RN-05 | `capacidade_simultanea = min(quantidade_salas, quantidade_profissionais)`. Decisão D3. | Não há atendimento sem sala **e** sem profissional. |
| RN-06 | Taxa de ocupação fixa em 100%, sem campo na UI. | Decisão do usuário (valor de norte). |
| RN-07 | `custo_hora = custo_fixo_mensal / (horas_mes × capacidade_simultanea)`; se `horas_mes × capacidade = 0`, custo/hora é **indefinido** (`null`) e a UI pede para configurar a disponibilidade. | Evita divisão por zero. |
| RN-08 | Cada percentual de markup ∈ [0, 100) e `imposto + cartão + comissão + margem < 100`. Divisor = `1 − soma/100`. | Divisor ≤ 0 tornaria o preço infinito/negativo. |
| RN-09 | Custo médio do produto (por `codigo_produto`, no inventário do tenant): **(a)** média ponderada de `valor_unitario` por `quantidade_disponivel` entre lotes com `active !== false`, `quantidade_disponivel > 0` e `valor_unitario` válido; **(b)** se não houver nenhum lote em (a), média ponderada por `quantidade_inicial` entre **todos** os lotes (inclusive inativos/zerados) com `quantidade_inicial > 0` e `valor_unitario` válido; **(c)** se nenhum, o produto fica "sem custo". `valor_unitario` válido = número finito ≥ 0. | Critério exato pedido no briefing; (a) reflete o custo do estoque que será consumido, (b) usa o último custo conhecido. |
| RN-10 | `custo_material = Σ (quantidade_sugerida × custo_medio)` dos itens com custo; se algum item estiver "sem custo", o total é exibido com o aviso "custo de material incompleto" e a lista dos produtos sem custo. | Transparência — não esconder subestimação. |
| RN-11 | `custo_hora_aplicado = custo_hora × duracao_minutos / 60`; `custo_real = custo_hora_aplicado + custo_material`; `preco_sugerido = custo_real / divisor`. Se o protocolo não tiver `duracao_minutos`, mostra apenas o custo de material e "Informe a duração para calcular o preço". | Fórmulas do usuário (markup divisor). |
| RN-12 | Dados financeiros: leitura/escrita apenas `clinic_admin` do tenant (e `system_admin`, pelo bloco genérico já existente). `clinic_user` nunca lê. | Dados financeiros internos. |
| RN-13 | Consultor lê `financeiro/custo_hora` somente se `compartilhar_com_consultor == true` **e** `compartilhado_com_consultant_id == consultant_id` do token **e** o tenant está em `authorized_tenants`. Troca de consultor não herda o acesso. Decisão D5. | Opt-in explícito e não herdável por outro consultor. |
| RN-14 | Somente a mudança do compartilhamento com o consultor gera entrada em `audit_log` (RF-19), decidida por `determineFinancialShareAuditAction` (Seção 6.2.4). Valores de custos, Boletos Tec, disponibilidade, capacidade e markup **não** são auditados. Falha ao gravar a auditoria não desfaz nem bloqueia o salvamento (mesmo padrão de `writeAdminAuditLog`). Decisão D4. | Compartilhar dados financeiros com terceiro é ação sensível; o restante segue UC-53 RN-10 (Minha Clínica fora do escopo). Amplia pontualmente o escopo do UC-53. |
| RN-16 | Ao carregar a aba, se `compartilhar_com_consultor == true` mas `compartilhado_com_consultant_id` ≠ id do consultor vinculado atual (ou não há consultor vinculado), o switch aparece **desligado** com o aviso "O compartilhamento anterior não vale para o consultor atual". Ao salvar, grava `false`/`null` e registra `unshare_with_consultant` com `metadata.motivo: 'troca_de_consultor'`. | Coerência entre UI e rule (RN-13); o consultor anterior já não lê, pois o tenant saiu de `authorized_tenants`. |
| RN-17 | Na visão do consultor, um produto é Rennova se algum lote dele no inventário do tenant tiver marca `'Rennova'` após `normalizeBrand` (`src/lib/brandUtils.ts`). Itens não-Rennova nunca têm nome/código exibidos ao consultor, nem no aviso de custo incompleto (aparece só "Outros materiais: custo incompleto"). | Decisão D5 + `FEAT-brand-e-visibilidade-consultor.md`. |
| RN-18 | Consultor lê `tenants/{tenantId}/protocolos` somente se `consultantHasAccess(tenantId)` **e** o documento `financeiro/custo_hora` tiver `compartilhar_com_consultor == true` e `compartilhado_com_consultant_id == consultant_id` do token. Sem o documento, ou com opt-in desligado/de outro consultor, `permission-denied`. Decisão D6. | Protocolos revelam composição e produtos de qualquer marca; só são necessários ao consultor na tela de precificação compartilhada (UC-48-RN-06). |
| RN-15 | `duracao_minutos`, quando informado, é inteiro entre 1 e 1440. Protocolos legados sem o campo continuam válidos. | Compatibilidade com documentos existentes. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Documento único por tenant** em subcoleção nova: `tenants/{tenantId}/financeiro/custo_hora`. Um único `getDoc`/`setDoc` por tela; o volume de dados é pequeno (dezenas de campos).
2. **Subcoleção `financeiro` excluída do bloco genérico de leitura** (mesma técnica já usada para `nf_imports`: `collectionId` de um segmento, compatível com `get` e `list`) + bloco dedicado com leitura/escrita só `clinic_admin` e leitura condicional do consultor baseada em campos do **próprio documento** (`resource.data`), sem `get()` adicional nas rules.
3. **Flag de compartilhamento no próprio documento financeiro**, não no documento raiz `tenants/{tenantId}` — porque o raiz aceita `update` de **qualquer** usuário do tenant (inclusive `clinic_user`, `firestore.rules` linhas 49–51), o que permitiria a um `clinic_user` ligar o compartilhamento.
4. **Compartilhamento amarrado ao consultor**: ao ativar, grava `compartilhado_com_consultant_id = consultant.id` (de `useLinkedConsultant`). Se a clínica trocar de consultor, o novo consultor não herda o acesso (RN-13).
5. **Cálculo 100% client-side em funções puras** (`src/lib/precificacao.ts`), sem persistir resultados (RNF-04). Mesmo padrão de `alertRules.ts`, `inventoryUtils.ts`, `auditLogPayload.ts`.
6. **Escrita via client SDK** (sem API route): a validação crítica de segurança (quem pode escrever) é expressável em rules; validações de negócio (períodos, markup) rodam na UI e são testadas como funções puras. Mesmo padrão de `stock_limits` e `protocolos`.
7. **Precificação na listagem de protocolos** (não existe tela de detalhe somente-leitura hoje). Os valores aparecem num bloco extra de cada card, só para `clinic_admin`.
8. **Tela do consultor nova** (`/consultant/clinics/[tenantId]/pricing`) reaproveitando os mesmos componentes de exibição (somente leitura) usados pelo admin, com detalhe de material filtrado por marca (RN-17).
9. **Auditoria só do compartilhamento**: novo `AuditEntityType` `'financial_config'` e duas novas `AuditAction` (`share_with_consultant`, `unshare_with_consultant`), gravadas client-side com `writeAuditLog` após o `setDoc` bem-sucedido. A rule de `audit_log` já permite `create` com `actor_id == request.auth.uid` e leitura por tenant — nenhuma alteração nela.

### 4.2 Alternativas descartadas

| Alternativa | Motivo da rejeição |
|---|---|
| Guardar a configuração em `tenants/{tenantId}/settings/custo_hora` | O bloco genérico daria leitura a `clinic_user` e consultor; excluir `settings` inteiro quebraria `settings/notifications` (lido por `clinic_user`). |
| Guardar a configuração/flag no documento raiz `tenants/{tenantId}` | `clinic_user` pode atualizar o raiz; consultor lê o raiz inteiro sem opt-in. |
| Flag de compartilhamento só booleana (sem `compartilhado_com_consultant_id`) | Um novo consultor vinculado após transferência herdaria o acesso sem novo consentimento. |
| Rule do consultor com `get()` em outro documento de flag | Custo de leitura extra por avaliação e mais superfície; a flag no próprio documento basta. |
| Auditar toda alteração da configuração financeira | Diverge de UC-53 RN-10 e geraria ruído a cada ajuste de valor; D4 limita ao compartilhamento. |
| Reusar `activate`/`deactivate` com `entity_type: 'tenant'` | Ambíguo na trilha (confunde com ativação da clínica); ações próprias deixam filtro e exportação legíveis. |
| Persistir `custo_hora` e `preco_sugerido` calculados | Ficariam desatualizados na virada do mês, a cada Boleto Tec quitado e a cada entrada de estoque. |
| API route com Admin SDK para salvar | Sem ganho de segurança sobre rules dedicadas; aumenta código sem necessidade (mesmo raciocínio de `stock_limits`). |
| Custo médio ponderado por `quantidade_inicial` de todos os lotes como regra principal | Mistura preços antigos já consumidos com o estoque atual; usado só como fallback (RN-09 b). |

### 4.3 Trade-offs aceitos

- **Mês de referência = relógio do cliente**: um dispositivo com data errada mostra horas do mês errado. Aceito (valor de norte, sem efeito persistido).
- **Feriados ignorados e ocupação 100%**: o custo/hora sai **subestimado** em relação ao real. Aceito pelo usuário; o texto da UI diz que é uma estimativa.
- **Leitura da coleção `inventory` inteira** na listagem de protocolos (para custo médio): mesmo custo de `getHistoricalProducts` já existente; aceitável no volume atual de uma clínica.
- **Auditoria parcial**: mudanças de valores financeiros não deixam rastro (só `updated_by`/`updated_at` do último salvamento); apenas o compartilhamento é auditado.
- **Auditoria best-effort**: se o `writeAuditLog` falhar depois do `setDoc`, o compartilhamento fica salvo sem entrada na trilha (erro só no console). Aceito pelo mesmo critério de `writeAdminAuditLog`.

### 4.4 Decisões tomadas (09/10/2026, pelo usuário)

| ID | Tema | Decisão |
|----|------|---------|
| D1 | Avanço das parcelas do Boleto Tec | **Automático.** Guarda `mes_referencia` (`'YYYY-MM'`); cada mês posterior assume 1 parcela paga; editar `parcelas_pagas` redefine `mes_referencia` para o mês atual. No mês de referência a parcela conta se `parcelas_pagas < total_parcelas` (ex.: 24 parcelas, 22 pagas em 10/2026 → compõe em out e nov/2026, sai em dez/2026). RN-02. |
| D2 | Feriados | **Não descontados** na v1 (trabalho futuro). RN-03. |
| D3 | Capacidade simultânea | **`min(salas, profissionais)`**. RN-05. |
| D4 | Auditoria | **Auditar somente ligar/desligar o compartilhamento com o consultor** (inclui troca do consultor destinatário). Novo `entity_type: 'financial_config'` e ações `share_with_consultant` / `unshare_with_consultant`. Diverge da recomendação da v1.0 (não auditar nada). RF-19, RN-14, RN-16, Seção 6.2.4. |
| D5 | Visão do consultor | **Totais completos + detalhe só dos itens Rennova**; demais agrupados como "Outros materiais". Compartilhamento **preso ao `consultant_id`** que o recebeu (troca de consultor não herda). RF-20, RN-13, RN-17. |
| D6 | Leitura de `protocolos` pelo consultor (v1.2) | **Somente com o opt-in financeiro ativo para ele**: regra de leitura do consultor em `protocolos` com `get()` em `financeiro/custo_hora`, exigindo `compartilhar_com_consultor == true` e `compartilhado_com_consultant_id == consultant_id` do token (mesma condição do bloco `financeiro`). Decidida pelo usuário em 09/10/2026 como D1 do `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (opção B). RN-18, Seção 5.4 e 5.4.1. |

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `src/lib/precificacao.ts` | Lib (pura) | Todas as funções de cálculo/validação (Seção 6.2.1). Sem import de Firebase. |
| `src/__tests__/precificacao.test.ts` | Teste Jest | Cobertura das funções puras (Seção 8). |
| `src/lib/services/custoHoraService.ts` | Service | `getCustoHoraConfig`, `saveCustoHoraConfig`, `listInventoryForCosting`. |
| `src/components/clinic/FixedCostsTab.tsx` | Componente | Aba "Custos Fixos" (formulário + resumo). |
| `src/components/pricing/CustoHoraResumo.tsx` | Componente | Painel de resumo (reutilizado na tela do consultor, modo somente leitura). |
| `src/components/pricing/ProtocoloPrecificacao.tsx` | Componente | Bloco de custos/preço de um protocolo (reutilizado admin + consultor). |
| `src/app/(consultant)/consultant/clinics/[tenantId]/pricing/page.tsx` | Page | Visão somente leitura do consultor (RF-16). |
| `tests/e2e/UC-58-precificar-protocolos-pela-hora-clinica.spec.ts` | E2E | Gerado pelo `qa-agent` a partir do STEP 4 (após conclusão da task; slug depende do UC criado no STEP 5). |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/types/index.ts` | Novos tipos da Seção 6.1; `Protocolo.duracao_minutos?: number`; `AuditEntityType` + `'financial_config'`; `AuditAction` + `'share_with_consultant'` e `'unshare_with_consultant'`. |
| `src/lib/auditLogPayload.ts` | Nova função pura `determineFinancialShareAuditAction` (Seção 6.2.4). |
| `src/lib/services/auditLogService.ts` | `ENTITY_TYPE_LABELS.financial_config = 'Dados Financeiros'`; `ACTION_LABELS.share_with_consultant = 'Compartilhar com Consultor'`; `ACTION_LABELS.unshare_with_consultant = 'Revogar Compartilhamento'` (os `Record<…>` tipados obrigam a inclusão). |
| `src/__tests__/auditLogPayload.test.ts` | Novo `describe('determineFinancialShareAuditAction')`. |
| `src/lib/services/protocoloService.ts` | `CreateProtocoloInput.duracao_minutos?`; `createProtocolo`/`updateProtocolo` persistem o campo. |
| `src/components/protocolos/ProtocoloForm.tsx` | Novo input "Duração (minutos)" + props `duracaoMinutos`/`onDuracaoMinutosChange`. |
| `src/app/(clinic)/clinic/protocolos/novo/page.tsx` | Estado `duracaoMinutos`, validação (RN-15), envio no `createProtocolo`. |
| `src/app/(clinic)/clinic/protocolos/[id]/page.tsx` | Carregar/editar/enviar `duracao_minutos`. |
| `src/app/(clinic)/clinic/protocolos/page.tsx` | Para `isAdmin`: carregar config + inventário, renderizar `ProtocoloPrecificacao` e CTA (RF-12/13/14). |
| `src/app/(clinic)/clinic/my-clinic/page.tsx` | Nova aba `fixed_costs` (dynamic import), `grid-cols` admin 4→5, `useEffect` de proteção inclui `fixed_costs`. |
| `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx` | Sondar `getCustoHoraConfig`; exibir botão "Ver Precificação" se legível (RF-17). |
| `firestore.rules` | Excluir `financeiro` do bloco genérico; bloco dedicado (Seção 5.4); helper `consultantHasFinancialOptIn` + `allow read` do consultor em `protocolos` (D6) — omitir o que o `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` já tiver trazido (Seção 5.4.1). |
| `tests/rules/firestore-tenant-subcollections.test.ts` | Novo `describe` para `financeiro` e novo `describe` para leitura de `protocolos` pelo consultor com opt-in (Seção 8.2). |
| `ONLY_FOR_DEVS/TO_DO/FEAT-relatorio-custo-por-procedimento.md` | Nota de compatibilidade: o "consultor não acessa" continua válido para aquele relatório; esta feature introduz opt-in apenas para os dados de `financeiro`. (Ver Seção 10.) |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `tenants/{tenantId}/financeiro/custo_hora` | Criar (documento único) | Schema `CustoHoraConfig` (Seção 6.1). Criado no primeiro "Salvar". |
| `tenants/{tenantId}/protocolos/{id}` | Campo novo opcional | `duracao_minutos?: number`. Sem migração (legados ficam sem o campo). |
| `tenants/{tenantId}/inventory` | Somente leitura | Base do custo médio (RN-09). Nenhuma escrita nova. |
| `audit_log` | Novas entradas | `entity_type: 'financial_config'`, `entity_id: tenantId`, `tenant_id: tenantId`, `actor_role: 'clinic_admin'`. Rule existente já cobre (`create` com `actor_id == auth.uid`; leitura por tenant). |
| `firestore.indexes.json` | Nenhuma | Só `getDoc` e `getDocs(collection)` sem filtro composto; `listAuditLog` reutiliza as consultas/índices já existentes do escopo `clinic_admin`. |

**Alteração em `firestore.rules`** (linhas 87–97 e novo bloco após `nf_imports`):

```js
// Bloco genérico — antes:
allow read: if belongsToTenant(tenantId) && collectionId != 'nf_imports';
allow read: if consultantHasAccess(tenantId) && collectionId != 'nf_imports';

// Depois:
allow read: if belongsToTenant(tenantId)
  && !(collectionId in ['nf_imports', 'financeiro']);
allow read: if consultantHasAccess(tenantId)
  && !(collectionId in ['nf_imports', 'financeiro']);
```

```js
// financeiro — dados financeiros internos (custos fixos, Boletos Tec,
// disponibilidade, markup). Leitura E escrita só clinic_admin. Excluída do
// fallback de leitura genérico (clinic_user e consultor NÃO leem por padrão).
// Consultor lê somente com opt-in explícito do clinic_admin, amarrado ao
// consultant_id que recebeu o compartilhamento (troca de consultor não herda).
// system_admin continua coberto pelo bloco genérico (read, write).
match /tenants/{tenantId}/financeiro/{docId} {
  allow read: if belongsToTenant(tenantId) && hasRole('clinic_admin');
  allow write: if belongsToTenant(tenantId) && hasRole('clinic_admin')
    && request.resource.data.tenant_id == tenantId
    && request.resource.data.compartilhar_com_consultor is bool;
  allow read: if consultantHasAccess(tenantId)
    && resource.data.compartilhar_com_consultor == true
    && resource.data.compartilhado_com_consultant_id == request.auth.token.consultant_id;
}
```

> Observação: `allow write` sem `request.resource` válido também cobre `delete` — com `request.resource == null` a condição falha, então `delete` só ocorre via `system_admin`. Não há fluxo de exclusão na UI (o admin zera os valores). Comportamento aceito.

**Leitura de `protocolos` pelo consultor (D6 / RN-18)** — helper junto aos demais e `allow read` no bloco dedicado já existente de `protocolos`:

```js
// opt-in financeiro ativo PARA ESTE consultor (RN-13/D5). Documento
// inexistente => get() devolve null => false (negado).
function consultantHasFinancialOptIn(tenantId) {
  let fin = get(/databases/$(database)/documents/tenants/$(tenantId)/financeiro/custo_hora);
  return fin != null
    && fin.data.get('compartilhar_com_consultor', false) == true
    && fin.data.get('compartilhado_com_consultant_id', null) == request.auth.token.consultant_id;
}

match /tenants/{tenantId}/protocolos/{protocoloId} {
  allow write: if belongsToTenant(tenantId) && hasRole('clinic_admin'); // já existe
  allow read: if consultantHasAccess(tenantId) && consultantHasFinancialOptIn(tenantId);
}
```

Custo: 1 leitura de documento por avaliação da regra (em `list`, uma por query). `clinic_admin`/`clinic_user` continuam lendo `protocolos` pelo bloco genérico, sem `get()`.

#### 5.4.1 Convivência com `BUGFIX-consultor-allowlist-subcolecoes` (UC-48-RN-06)

O bugfix `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (branch `bugfix/consultant-subcollection-allowlist`) troca a linha do consultor do bloco genérico (blocklist) por uma **allowlist** (`inventory`, `stock_limits`, `solicitacoes`) e traz **a mesma regra de `protocolos` acima** (D1 = B daquele spec). As duas mudanças são independentes de ordem de merge:

- **Bugfix primeiro:** ao sincronizar esta branch com `develop`, haverá conflito na linha do consultor do bloco genérico — **manter a allowlist** (não reintroduzir `!(collectionId in ['nf_imports', 'financeiro'])` na linha do consultor; `financeiro` já fica fora por construção). Aplicar a mudança desta feature **apenas** na linha de `belongsToTenant`. O helper `consultantHasFinancialOptIn` e o `allow read` de `protocolos` **já existirão** — não duplicar (omitir o commit `feat(firebase): gate consultant protocol reads on financial opt-in`). O bloco `financeiro` entra sem alteração.
- **Esta feature primeiro:** aplicar tudo conforme a Seção 5.4. **Atenção:** enquanto a allowlist não entra, o bloco genérico (blocklist) ainda concede ao consultor leitura de `protocolos` **sem** opt-in (semântica OR) — a regra D6 só passa a restringir de fato quando o bugfix for mergeado. O bugfix, ao entrar, verifica que a regra de `protocolos` está idêntica e não a duplica.
- Os testes de rules de D6 (Seção 8.2) semeiam `financeiro/custo_hora` com `withSecurityRulesDisabled`, então valem em qualquer ordem. O caso "consultor **sem** opt-in não lê `protocolos`" só passa quando a allowlist estiver presente — se esta feature entrar antes do bugfix, marcar esse caso com `it.todo`/comentário apontando UC-48-RN-06 e ativá-lo quando o bugfix entrar (ou vice-versa: o bugfix o traz ativo).

### 5.5 O que NÃO muda

- `costingService.ts`, relatórios UC-47/UC-51 e a tela `/clinic/reports` (Fase 3).
- Fluxo de solicitações (`requests/new`, `solicitacaoService.ts`) — a duração do protocolo **não** é copiada para a solicitação nesta versão.
- Regras de `inventory`, `nf_imports`, `notifications`, `settings/notifications`, `audit_log`, documento raiz `tenants/{tenantId}`. A regra de **escrita** de `protocolos` também não muda; a de **leitura do consultor** em `protocolos` muda (D6).
- Tela da trilha de auditoria (`AuditLogView.tsx`, `/clinic/audit-log`, `/admin/audit-log`) — só ganha os novos rótulos via `auditLogService.ts`.
- Claims, APIs de consultor e de vínculo (`/api/tenants/[id]/consultant`, `consultantClaimsSync.ts`).
- Telas `/consultant/clinics/[tenantId]/inventory` e `/projections`.
- Parser XML NF-e (`parseNfeXml.ts`) e importação.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

Adicionar em `src/types/index.ts`, nova seção `// PRECIFICAÇÃO PELA HORA CLÍNICA`:

```ts
export type DiaSemanaKey = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'; // índice = Date.getDay()

export type CustoFixoBaseKey =
  | 'aluguel'
  | 'condominio'
  | 'iptu'
  | 'pro_labore'
  | 'energia'
  | 'salarios'
  | 'tarifas_bancarias'
  | 'marketing'
  | 'contabilidade'
  | 'manutencao_limpeza'
  | 'telefone'
  | 'sistema_agenda_prontuario';

export interface CustoFixoPersonalizado {
  id: string; // gerado no client (crypto.randomUUID())
  nome: string; // obrigatório, trim, 1..60 caracteres
  valor: number; // R$ >= 0
}

export interface BoletoTec {
  id: string; // crypto.randomUUID()
  descricao: string; // obrigatório
  valor_parcela: number; // R$ > 0
  total_parcelas: number; // inteiro >= 1
  parcelas_pagas: number; // inteiro, 0..total_parcelas (na data de mes_referencia)
  mes_referencia: string; // 'YYYY-MM' — mês em que parcelas_pagas foi informado (D1)
}

export interface PeriodoAtendimento {
  inicio: string; // 'HH:MM' 24h
  fim: string; // 'HH:MM' 24h, > inicio
}

export interface DisponibilidadeDia {
  ativo: boolean;
  periodos: PeriodoAtendimento[];
}

export interface ParametrosMarkup {
  imposto_pct: number; // 0..100 (ex.: 6 = 6%)
  cartao_pct: number;
  comissao_pct: number;
  margem_pct: number;
}

/** tenants/{tenantId}/financeiro/custo_hora */
export interface CustoHoraConfig {
  tenant_id: string;
  custos_fixos_base: Record<CustoFixoBaseKey, number>;
  custos_fixos_personalizados: CustoFixoPersonalizado[];
  boletos_tec: BoletoTec[];
  disponibilidade: Record<DiaSemanaKey, DisponibilidadeDia>;
  quantidade_salas: number; // inteiro >= 1
  quantidade_profissionais: number; // inteiro >= 1
  markup: ParametrosMarkup;
  compartilhar_com_consultor: boolean; // default false
  compartilhado_com_consultant_id: string | null; // consultants/{id} que recebeu o opt-in
  created_at: Timestamp;
  updated_at: Timestamp;
  updated_by: string; // uid do clinic_admin
}
```

`Protocolo` — antes/depois:

```ts
// Antes
export interface Protocolo {
  id: string; tenant_id: string; nome: string; descricao?: string;
  itens: ProtocoloItem[]; active: boolean;
  created_at: Timestamp; updated_at: Timestamp; created_by: string;
}

// Depois
export interface Protocolo {
  // ...mesmos campos
  duracao_minutos?: number; // opcional; inteiro 1..1440 (RN-15). Ausente em protocolos legados.
}
```

Trilha de auditoria (UC-53) — antes/depois:

```ts
// Antes
export type AuditEntityType = 'user' | 'consultant' | 'tenant' | 'master_product' | 'legal_document' | 'system_settings';
export type AuditAction = 'create' | 'update' | 'activate' | 'deactivate' | 'suspend' | 'reactivate'
  | 'change_role' | 'set_password' | 'reset_password_link' | 'delete';

// Depois
export type AuditEntityType = /* ...mesmos */ | 'financial_config';
export type AuditAction = /* ...mesmos */ | 'share_with_consultant' | 'unshare_with_consultant';
```

**Valores padrão** (documento inexistente → `criarConfigPadrao(tenantId)`): todos os custos base = 0; listas vazias; todos os dias `{ ativo: false, periodos: [] }`; salas = 1; profissionais = 1; markup todo 0; `compartilhar_com_consultor: false`; `compartilhado_com_consultant_id: null`.

### 6.2 Mudanças em serviços

#### 6.2.1 `src/lib/precificacao.ts` (a criar — puro, sem Firebase)

```ts
export const CUSTOS_FIXOS_BASE: { key: CustoFixoBaseKey; label: string }[]; // 12 itens, ordem da RF-02
export const DIAS_SEMANA: { key: DiaSemanaKey; label: string }[]; // dom..sab, índice = getDay()

export function criarConfigPadrao(tenantId: string): Omit<CustoHoraConfig, 'created_at' | 'updated_at' | 'updated_by'>;

// --- Tempo
export function parseHorario(hhmm: string): number | null; // minutos desde 00:00; null se inválido
export function validarPeriodosDia(dia: DisponibilidadeDia): string | null;
//  null = válido. Erros: 'Horário inválido', 'O fim deve ser posterior ao início',
//  'Períodos sobrepostos', 'Dia ativo sem períodos'. Períodos encostados (12:00–12:00) são válidos.
export function calcularHorasDia(dia: DisponibilidadeDia): number; // 0 se inativo
export function contarOcorrenciasDiaSemanaNoMes(ano: number, mes: number /* 1..12 */): Record<DiaSemanaKey, number>;
export function calcularHorasMes(disp: Record<DiaSemanaKey, DisponibilidadeDia>, ano: number, mes: number): number;

// --- Boleto Tec (RN-02)
export function mesesEntre(deYYYYMM: string, ateYYYYMM: string): number; // pode ser negativo
export function calcularParcelasRestantes(boleto: BoletoTec, mesCalculo: string): number; // >= 0
export function boletoCompoeCusto(boleto: BoletoTec, mesCalculo: string): boolean;

// --- Custos
export interface CustoFixoMensal { base: number; personalizados: number; boletos: number; total: number }
export function calcularCustoFixoMensal(config: Pick<CustoHoraConfig,
  'custos_fixos_base' | 'custos_fixos_personalizados' | 'boletos_tec'>, mesCalculo: string): CustoFixoMensal;
export function calcularCapacidadeSimultanea(salas: number, profissionais: number): number; // min, D3
export function calcularCustoHora(custoFixoMensal: number, horasMes: number, capacidade: number): number | null;

// --- Markup (RN-08)
export function validarParametrosMarkup(m: ParametrosMarkup): string | null;
//  Erros: 'Percentuais não podem ser negativos', 'A soma dos percentuais deve ser menor que 100%'
export function calcularDivisorMarkup(m: ParametrosMarkup): number | null; // null se inválido

// --- Resumo agregado (RF-09)
export interface ResumoCustoHora {
  mesReferencia: string; // 'YYYY-MM'
  custoFixo: CustoFixoMensal;
  horasMes: number;
  capacidade: number;
  custoHora: number | null;
  divisor: number | null;
}
export function calcularResumoCustoHora(config: CustoHoraConfig | ReturnType<typeof criarConfigPadrao>, mesCalculo: string): ResumoCustoHora;

// --- Material (RN-09/RN-10)
export interface LoteParaCusto {
  codigo_produto: string;
  valor_unitario: unknown; // validado internamente
  quantidade_disponivel: number;
  quantidade_inicial: number;
  active?: boolean;
  brand?: string; // usado só na visão do consultor (RN-17)
}
export interface CustoMedioProduto { custoMedio: number; criterio: 'estoque_atual' | 'historico' }
export function calcularCustoMedioPorProduto(lotes: LoteParaCusto[]): Map<string, CustoMedioProduto>;

export interface CustoMaterialProtocolo {
  total: number; // soma só dos itens com custo
  incompleto: boolean;
  codigosSemCusto: string[];
  itens: { codigo_produto: string; nome_produto: string; quantidade: number; custoUnitario: number | null; subtotal: number | null }[];
}
export function calcularCustoMaterialProtocolo(itens: ProtocoloItem[], custos: Map<string, CustoMedioProduto>): CustoMaterialProtocolo;

// --- Precificação final (RN-11)
export interface PrecificacaoProtocolo {
  custoMaterial: CustoMaterialProtocolo;
  custoHoraAplicado: number | null; // null se sem duração ou sem custoHora
  custoReal: number | null;
  precoSugerido: number | null; // null se custoReal null ou divisor null
}
export function calcularPrecificacaoProtocolo(params: {
  duracaoMinutos?: number;
  custoHora: number | null;
  divisor: number | null;
  custoMaterial: CustoMaterialProtocolo;
}): PrecificacaoProtocolo;

// --- Visão do consultor (RN-17 / D5)
export function calcularProdutosRennova(lotes: LoteParaCusto[]): Set<string>; // códigos com algum lote de marca normalizada 'Rennova'
export interface CustoMaterialConsultor {
  total: number; // igual a CustoMaterialProtocolo.total (totais completos)
  itensRennova: CustoMaterialProtocolo['itens'];
  outrosMateriais: { subtotal: number; quantidadeItens: number; incompleto: boolean } | null; // null se não houver não-Rennova
  incompletoRennova: string[]; // códigos Rennova sem custo (podem ser nomeados)
}
export function separarMaterialParaConsultor(material: CustoMaterialProtocolo, rennova: Set<string>): CustoMaterialConsultor;

// --- Mês corrente
export function mesCorrenteSaoPaulo(agora?: Date): string; // 'YYYY-MM' via Intl, timeZone 'America/Sao_Paulo'
export function formatarMesReferencia(yyyyMM: string): string; // 'outubro/2026'
```

#### 6.2.2 `src/lib/services/custoHoraService.ts` (a criar)

```ts
const docRef = (tenantId: string) => doc(db, 'tenants', tenantId, 'financeiro', 'custo_hora');

export async function getCustoHoraConfig(tenantId: string): Promise<CustoHoraConfig | null>;
//  getDoc; inexistente → null. Erro 'permission-denied' é PROPAGADO (a tela do consultor
//  trata como "não compartilhado"; a do admin mostra toast genérico via translateFirestoreError).

export async function saveCustoHoraConfig(
  tenantId: string,
  userId: string,
  input: Omit<CustoHoraConfig, 'tenant_id' | 'created_at' | 'updated_at' | 'updated_by'>,
  existing: CustoHoraConfig | null
): Promise<void>;
//  setDoc (sobrescreve o documento inteiro) com tenant_id, updated_at = Timestamp.now(),
//  updated_by = userId, created_at = existing?.created_at ?? agora.
//  Antes de gravar, para cada Boleto Tec cujo parcelas_pagas mudou em relação a `existing`
//  (ou novo), define mes_referencia = mesCorrenteSaoPaulo() (RN-02).
//  Se compartilhar_com_consultor == false → compartilhado_com_consultant_id = null.
//  Após o setDoc bem-sucedido, chama determineFinancialShareAuditAction(existing, novo, { trocaDeConsultor })
//  e, se retornar ação, writeAuditLog({ tenant_id: tenantId, entity_type: 'financial_config',
//  entity_id: tenantId, action, descricao, actor_id: userId, actor_name: actorName,
//  actor_role: 'clinic_admin', metadata }) dentro de try/catch (só console.error — RN-14).
//  A assinatura ganha `actorName: string` e `options?: { trocaDeConsultor?: boolean; consultantName?: string }`.

export async function listInventoryForCosting(tenantId: string): Promise<LoteParaCusto[]>;
//  getDocs(collection(db, 'tenants', tenantId, 'inventory')) SEM filtro de active
//  (o fallback RN-09-b precisa de lotes inativos). Mapeia só os campos de LoteParaCusto (inclui brand).
```

Multi-tenant: todas as funções recebem `tenantId` das claims (`claims.tenant_id`) ou de `params.tenantId` validado contra `authorizedTenants` (consultor). A proteção real está nas rules (Seção 5.4).

#### 6.2.4 `src/lib/auditLogPayload.ts` (modificar — função pura nova)

```ts
export interface FinancialShareState {
  compartilhar_com_consultor: boolean;
  compartilhado_com_consultant_id: string | null;
}

export interface FinancialShareAuditResult {
  action: 'share_with_consultant' | 'unshare_with_consultant';
  metadata: {
    consultant_id: string | null;
    consultant_anterior_id?: string | null;
    motivo?: 'troca_de_consultor';
  };
}

export function determineFinancialShareAuditAction(
  before: FinancialShareState | null, // null = documento ainda não existia (tratado como desligado)
  after: FinancialShareState,
  options?: { trocaDeConsultor?: boolean } // RN-16
): FinancialShareAuditResult | null;
```

| `before` | `after` | Resultado |
|---|---|---|
| `null` ou desligado | desligado | `null` (não audita) |
| `null` ou desligado | ligado (id X) | `share_with_consultant`, `metadata.consultant_id: X` |
| ligado (X) | ligado (X) | `null` |
| ligado (X) | desligado | `unshare_with_consultant`, `metadata.consultant_id: X` (+ `motivo: 'troca_de_consultor'` se `options.trocaDeConsultor`) |
| ligado (X) | ligado (Y ≠ X) | `share_with_consultant`, `metadata: { consultant_id: Y, consultant_anterior_id: X }` |

`descricao` (montada no service): `"Dados financeiros compartilhados com o consultor {nome}"` / `"Compartilhamento de dados financeiros com o consultor revogado"`.

#### 6.2.3 `src/lib/services/protocoloService.ts` (modificar)

```ts
// Antes
export interface CreateProtocoloInput { nome: string; descricao?: string; itens: ProtocoloItem[] }
// Depois
export interface CreateProtocoloInput { nome: string; descricao?: string; itens: ProtocoloItem[]; duracao_minutos?: number }
```

- `createProtocolo`: `...(input.duracao_minutos ? { duracao_minutos: input.duracao_minutos } : {})`.
- `updateProtocolo`: `if (input.duracao_minutos !== undefined) updates.duracao_minutos = input.duracao_minutos;`. Para **remover** a duração na edição, usar `deleteField()` quando o form envia `null` (tipo `duracao_minutos?: number | null` no `Partial` de update).

### 6.3 Mudanças na UI

#### 6.3.1 Minha Clínica → aba "Custos Fixos" (`FixedCostsTab.tsx`)

- **Atual:** abas `Clínica | Usuários | Limite de Estoque | Consultor` (admin), `Clínica | Consultor` (user).
- **Novo:** admin `Clínica | Usuários | Limite de Estoque | Custos Fixos | Consultor` (`TabsList` `grid-cols-2 sm:grid-cols-5`); ícone `Calculator` (lucide); `value="fixed_costs"`. `useEffect` de proteção passa a incluir `'fixed_costs'`.
- **Layout** (cards shadcn, em ordem):
  1. **Resumo** (`CustoHoraResumo`, topo, fixo): Total de custos fixos (base / personalizados / Boletos Tec), "Referência: outubro/2026", Horas planejadas no mês, Capacidade simultânea, **Custo da hora clínica** em destaque, divisor de markup. Aviso RNF-07: "Estimativa de referência para precificação — não substitui a contabilidade. Ocupação considerada: 100%; feriados não descontados."
  2. **Custos fixos mensais**: tabela com os 12 itens base (input R$) + itens personalizados (nome + valor + lixeira) + botão "Adicionar custo".
  3. **Boleto Tec** (texto de ajuda: "Financiamento de equipamento/tecnologia"): lista de boletos com descrição, parcela, total, pagas, **restantes** (derivado), badge "Compõe o custo" / "Quitado"; botões adicionar/remover.
  4. **Disponibilidade semanal**: 7 linhas (Dom..Sáb), switch ativo, períodos `inicio`/`fim` (`<Input type="time">`), "+ período", total de horas do dia; erro de `validarPeriodosDia` exibido inline em vermelho.
  5. **Capacidade**: Salas, Profissionais simultâneos (inteiros ≥ 1).
  6. **Markup**: Imposto %, Cartão %, Comissão %, Margem %; soma exibida; erro de `validarParametrosMarkup` inline.
  7. **Compartilhamento**: switch "Compartilhar dados financeiros com o consultor"; desabilitado com texto "Nenhum consultor vinculado" quando `useLinkedConsultant().consultant` for `null`; quando habilitado mostra "Compartilhado com {nome do consultor}" e o aviso "Esta ação fica registrada na trilha de auditoria". Caso RN-16 (consultor mudou): switch desligado + aviso "O compartilhamento anterior não vale para o consultor atual".
  8. Botão **Salvar** (desabilitado enquanto houver qualquer erro de validação). Toast de sucesso "Custos salvos com sucesso" / erro via `translateFirestoreError`.
- O resumo recalcula a cada mudança de estado local (sem salvar), via `calcularResumoCustoHora(estadoLocal, mesCorrenteSaoPaulo())`.

#### 6.3.2 Formulário de protocolo (`ProtocoloForm.tsx`)

- **Novo** campo no card "Dados do Protocolo", após "Descrição": `Label "Duração (minutos)"`, `Input type="number" min=1 max=1440 step=1`, placeholder "Ex: 60", texto de ajuda "Usada para calcular o custo da hora clínica do procedimento".
- `novo/page.tsx` e `[id]/page.tsx`: se preenchido e fora de RN-15 → toast "Informe uma duração entre 1 e 1440 minutos" e não salva.

#### 6.3.3 Listagem de protocolos (`protocolos/page.tsx`)

- **`clinic_user`:** sem mudanças visuais (não carrega `financeiro`, nunca tenta ler).
- **`clinic_admin`:** além de `listProtocolos`, carrega em paralelo `getCustoHoraConfig(tenantId)` e `listInventoryForCosting(tenantId)`; calcula `resumo` uma vez e `custos = calcularCustoMedioPorProduto(lotes)` uma vez.
  - Se `config == null` ou `resumo.custoHora == null` ou `resumo.divisor == null`: banner/CTA no topo "Configure seus custos fixos para ver o preço sugerido dos protocolos" → botão para `/clinic/my-clinic?tab=fixed_costs`. Mesmo assim, cada card mostra o custo de material.
  - Cada card ganha, abaixo dos badges de itens, o bloco `ProtocoloPrecificacao`: `Duração: 60 min` · `Material: R$ 800,00` · `Hora clínica: R$ 153,06` · `Custo real: R$ 953,06` · **`Preço sugerido: R$ 1.562,40`**. Avisos: "Custo de material incompleto: sem valor para {nomes}" (RF-14) e "Informe a duração para calcular o preço" (RN-11).
  - Rodapé discreto: "Valores com base nos custos de {mês/ano}".

#### 6.3.4 Consultor

- `clinics/[tenantId]/page.tsx`: após carregar dados, `try { await getCustoHoraConfig(tenantId) → setPricingShared(config !== null) } catch { setPricingShared(false) }`. Se `true`, novo botão "Ver Precificação" (ícone `Calculator`) ao lado de "Ver Projeções".
- `clinics/[tenantId]/pricing/page.tsx` (nova): mesmo guard das irmãs (`authorizedTenants.includes(tenantId)` senão `router.push('/consultant/clinics')`); `ReadOnlyBanner`; `CustoHoraResumo` (somente leitura); tabela de custos fixos (somente leitura); markup; lista de protocolos com `ProtocoloPrecificacao` em modo consultor (prop `modo="consultor"`): totais completos; detalhe só de itens Rennova (`separarMaterialParaConsultor`); linha "Outros materiais" com subtotal para os demais (RF-20, RN-17). Se `getCustoHoraConfig` lançar `permission-denied` ou retornar `null`: estado vazio "Esta clínica não compartilhou dados financeiros com você."

### 6.4 Mudanças em API Routes

N/A — nenhuma API route nova ou modificada. Leitura/escrita via client SDK protegidas por `firestore.rules` (Seção 4.1, item 6).

---

## 7. Plano de Implementação

### STEP 1 — Modelo de dados e funções puras

#### STEP 1.1 — Tipos

**Objetivo:** Declarar os tipos da Seção 6.1.

**Arquivos afetados:**
- `src/types/index.ts` — novos tipos + `Protocolo.duracao_minutos?` + extensão de `AuditEntityType`/`AuditAction`.
- `src/lib/services/auditLogService.ts` — novos rótulos (exigidos pelo `Record` tipado).

**Ações:**
1. Adicionar a seção `PRECIFICAÇÃO PELA HORA CLÍNICA` com todos os tipos da Seção 6.1.
2. Adicionar `duracao_minutos?: number` em `Protocolo`.
3. Estender `AuditEntityType` e `AuditAction` (Seção 6.1) e incluir os rótulos em `ENTITY_TYPE_LABELS`/`ACTION_LABELS`.

**Validação:** `npm run type-check` sem erros.

**Commit:** `feat(types): add custo hora config and protocolo duration types`

#### STEP 1.2 — `src/lib/precificacao.ts`

**Objetivo:** Implementar todas as funções puras da Seção 6.2.1.

**Arquivos afetados:**
- `src/lib/precificacao.ts` (novo).
- `src/lib/auditLogPayload.ts` — nova função pura.

**Ações:**
1. Implementar conforme assinaturas e RN-01 a RN-11.
2. `contarOcorrenciasDiaSemanaNoMes`: iterar `new Date(ano, mes - 1, d)` de 1 até `new Date(ano, mes, 0).getDate()`, contando `getDay()` (datas locais, sem fuso — dia do mês não depende de hora).
3. `mesCorrenteSaoPaulo`: `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })`.
4. Nenhum import de `firebase/*` neste arquivo.
5. Em `src/lib/auditLogPayload.ts`, adicionar `determineFinancialShareAuditAction` (Seção 6.2.4) — o arquivo continua 100% puro.

**Validação:** `npm run lint` e `npm run type-check` sem erros; `grep -n "firebase" src/lib/precificacao.ts` vazio.

**Commit:** `feat(tenant): add pure functions for clinic hour cost and pricing`

#### STEP 1.3 — Testes Jest

**Objetivo:** Cobrir as funções puras com os cenários da Seção 8.

**Arquivos afetados:**
- `src/__tests__/precificacao.test.ts` (novo).
- `src/__tests__/auditLogPayload.test.ts` — novo `describe`.

**Ações:**
1. Implementar todos os cenários da tabela da Seção 8 (inclui o exemplo numérico oficial).
2. Usar `toBeCloseTo(valor, 2)` para valores monetários.

**Validação:** `npm run test -- precificacao auditLogPayload` verde; `npm run test` inteiro verde.

**Commit:** `test(tenant): cover clinic hour cost, pricing and share audit`

### STEP 2 — Segurança e serviço

#### STEP 2.1 — `firestore.rules`

**Objetivo:** Isolar `financeiro` (Seção 5.4).

**Arquivos afetados:**
- `firestore.rules` — bloco genérico (linhas 93 e 96) + novo bloco `financeiro` após `nf_imports`, com comentário explicativo no padrão do arquivo.

**Ações:**
1. Trocar `collectionId != 'nf_imports'` por `!(collectionId in ['nf_imports', 'financeiro'])` nas duas linhas de leitura.
2. Adicionar o bloco `match /tenants/{tenantId}/financeiro/{docId}` exatamente como na Seção 5.4.
3. Adicionar o helper `consultantHasFinancialOptIn` e o `allow read` do consultor em `protocolos` (D6, Seção 5.4).
4. Antes de 1 e 3, checar se o `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` já está em `develop` e seguir a Seção 5.4.1 (manter a allowlist; não duplicar a regra de `protocolos`).

**Validação:** STEP 2.2 verde.

**Commits:** `feat(firebase): restrict financeiro subcollection to clinic_admin` e `feat(firebase): gate consultant protocol reads on financial opt-in` (este último omitido se o bugfix já trouxe a regra).

#### STEP 2.2 — Testes de rules

**Objetivo:** Provar o isolamento contra o emulador.

**Arquivos afetados:**
- `tests/rules/firestore-tenant-subcollections.test.ts` — novo `describe('tenants/{tenantId}/financeiro')` e novo `describe('protocolos — leitura do consultor com opt-in financeiro (D6)')` (se o bugfix já o trouxe, apenas confirmar que existe e passa).

**Ações:**
1. Adicionar helper de consultor com `consultant_id` (se o existente não tiver, criar `consultantWith(consultantId, tenants)`).
2. Cenários da Seção 8 (rules), testando **`getDoc` e `getDocs(query(...))`** onde aplicável (lição do PR #344 registrada no cabeçalho da suíte).
3. Garantir que o `describe.each` genérico existente continua verde (nenhuma regressão em `inventory`, `protocolos` etc.).

**Validação:** `npm run test:rules` verde.

**Commit:** `test(firebase): cover financeiro rules and consultant opt-in`

#### STEP 2.3 — `custoHoraService.ts` + `protocoloService.ts`

**Objetivo:** Leitura/escrita da configuração e persistência de `duracao_minutos`.

**Arquivos afetados:**
- `src/lib/services/custoHoraService.ts` (novo).
- `src/lib/services/protocoloService.ts` — `duracao_minutos` (Seção 6.2.3).

**Ações:**
1. Implementar Seção 6.2.2 (incluindo atualização de `mes_referencia` e limpeza de `compartilhado_com_consultant_id`).
2. Implementar Seção 6.2.3.

**Validação:** `npm run type-check` e `npm run build` sem erros.

**Commit:** `feat(tenant): add custo hora config service`

#### STEP 2.4 — Auditoria do compartilhamento

**Objetivo:** RF-19, RN-14, RN-16.

**Arquivos afetados:**
- `src/lib/services/custoHoraService.ts` — `saveCustoHoraConfig` chama `determineFinancialShareAuditAction` + `writeAuditLog` após o `setDoc`.

**Ações:**
1. Receber `actorName` (de `user.displayName || user.email`), `consultantName` e `trocaDeConsultor` (RN-16) do componente.
2. Gravar a auditoria em `try/catch`, sem relançar.

**Validação:** ligar o compartilhamento → entrada em `audit_log` com `entity_type: 'financial_config'`, `action: 'share_with_consultant'`; salvar de novo sem mudar o switch → nenhuma entrada nova; a entrada aparece em `/clinic/audit-log` com os rótulos "Dados Financeiros" / "Compartilhar com Consultor".

**Commit:** `feat(tenant): audit consultant financial sharing toggle`

### STEP 3 — Interface

#### STEP 3.1 — Aba "Custos Fixos"

**Objetivo:** RF-01 a RF-10 e RF-15.

**Arquivos afetados:**
- `src/components/clinic/FixedCostsTab.tsx` (novo), `src/components/pricing/CustoHoraResumo.tsx` (novo), `src/app/(clinic)/clinic/my-clinic/page.tsx`.

**Ações:**
1. Criar componentes conforme Seção 6.3.1, seguindo `_PADRAO-VISUAL-UI.md`.
2. Registrar aba em `my-clinic/page.tsx` (dynamic import, `grid-cols-5`, guard `fixed_costs`).
3. Skeleton de carregamento no mesmo padrão de `StockLimitsTab`.

**Validação:** como `clinic_admin`, preencher o exemplo numérico (Seção 8) e ver `R$ 153,06` no resumo em out/2026; como `clinic_user`, `?tab=fixed_costs` volta para `clinic`.

**Commit:** `feat(clinic): add fixed costs tab to my clinic`

#### STEP 3.2 — Duração no protocolo

**Objetivo:** RF-11, RN-15.

**Arquivos afetados:** `ProtocoloForm.tsx`, `protocolos/novo/page.tsx`, `protocolos/[id]/page.tsx`.

**Ações:** Seção 6.3.2.

**Validação:** criar protocolo com 60 min → documento no Firestore tem `duracao_minutos: 60`; editar para vazio → campo removido; protocolo legado abre e salva sem erro.

**Commit:** `feat(clinic): add duration to protocolo form`

#### STEP 3.3 — Precificação na listagem

**Objetivo:** RF-12, RF-13, RF-14, RF-18.

**Arquivos afetados:** `src/app/(clinic)/clinic/protocolos/page.tsx`, `src/components/pricing/ProtocoloPrecificacao.tsx` (novo).

**Ações:** Seção 6.3.3. Para `clinic_user`, **não** chamar `getCustoHoraConfig` (evita erro de permissão no console).

**Validação:** protocolo do exemplo mostra `Preço sugerido: R$ 1.562,40`; sem config → CTA; `clinic_user` não vê bloco nem CTA; aba Network/console sem `permission-denied` para `clinic_user`.

**Commit:** `feat(clinic): show suggested price on protocolos list`

#### STEP 3.4 — Visão do consultor

**Objetivo:** RF-16, RF-17.

**Arquivos afetados:** `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`, `.../[tenantId]/pricing/page.tsx` (novo).

**Ações:** Seção 6.3.4 (D5: totais completos, detalhe só Rennova, "Outros materiais" agregado).

**Validação:** com compartilhamento ativo, consultor vê botão e tela; com inativo, botão some e acesso direto à URL mostra estado vazio.

**Commit:** `feat(consultant): add read-only pricing view for shared clinics`

### STEP 4 — Validação Manual

**Objetivo:** Validar de ponta a ponta cálculo, isolamento multi-tenant/role e opt-in do consultor, antes de abrir o PR. Esta seção é a fonte do caderno Playwright gerado pelo `qa-agent` (CLAUDE.md, regra 8).

**Pré-requisitos:**
- Firebase Emulator Suite semeado (`npm run test:e2e:seed`) — usuários de `tests/e2e/fixtures/seed-data.ts`: `clinicAdminA`, `clinicUserA`, `clinicAdminB`, `consultant` (com `authorized_tenants: ['test-clinic-a']`, `consultant_id: 'qa-consultant'`), `consultantB`.
- Data do navegador fixada em **15/10/2026** (no Playwright: `page.clock.setFixedTime(new Date('2026-10-15T12:00:00-03:00'))`).
- `test-clinic-a` já é semeado com `consultant_id: 'qa-consultant'` (`scripts/seed-emulator.ts`), então o consultor vinculado aparece no switch de compartilhamento sem extensão do seed.
- Dados semeados por teste via Admin SDK (`getEmulatorAdminFirestore()`, padrão do `UC-51-*.spec.ts`), removidos em `finally`:
  - `tenants/test-clinic-a/inventory`: produto `9990001` "Produto Teste Rennova" `brand: 'Rennova'`, dois lotes ativos: L1 `quantidade_disponivel: 10`, `valor_unitario: 100`; L2 `quantidade_disponivel: 30`, `valor_unitario: 120` (custo médio = R$ 115,00). Produto `9990002` "Material Sem Custo" sem nenhum lote. Produto `9990003` "Material Terceiro" `brand: 'Marca X'`, lote ativo `quantidade_disponivel: 5`, `valor_unitario: 50`.
  - `tenants/test-clinic-a/protocolos`: P1 "Protocolo Exemplo 60min" com item `9990001` × 2 e `duracao_minutos: 60`; P2 "Protocolo Incompleto" com item `9990002` × 1, sem `duracao_minutos`; P3 "Protocolo Misto" com `9990001` × 1 + `9990003` × 2 e `duracao_minutos: 30`.

**Roteiro A — Configuração e cálculo do custo/hora (clinic_admin):**
1. Logar como `clinicAdminA` → `/clinic/my-clinic`.
2. **Esperado (UI):** aba "Custos Fixos" visível. Clicar nela → URL contém `?tab=fixed_costs`.
3. **Esperado (UI):** resumo com "Referência: outubro/2026", custo/hora indisponível e mensagem pedindo para configurar disponibilidade (config inexistente).
4. Preencher Aluguel = 30.000,00 (demais 0). Ativar Seg–Sex com período 08:00–12:00 e 13:00–17:00; ativar Sáb com 08:00–12:00. Salas = 1, Profissionais = 1. Markup: Imposto 6, Cartão 3, Comissão 0, Margem 30.
5. **Esperado (UI, sem salvar):** Total de custos fixos R$ 30.000,00; Horas no mês **196**; Capacidade **1**; Custo da hora **R$ 153,06**; Divisor **0,61**.
6. Clicar "Salvar". **Esperado (UI):** toast "Custos salvos com sucesso".
7. **Esperado (Firestore):** `tenants/test-clinic-a/financeiro/custo_hora` existe com `tenant_id: 'test-clinic-a'`, `custos_fixos_base.aluguel: 30000`, `disponibilidade.sab.periodos` com 1 período, `markup.margem_pct: 30`, `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null`, `updated_by: 'qa-clinic-admin-a'`.

**Roteiro B — Validações de formulário:**
1. Na Segunda-feira, adicionar período 11:00–14:00. **Esperado (UI):** erro "Períodos sobrepostos" na linha de Segunda; botão "Salvar" desabilitado. Remover o período.
2. Adicionar período 18:00–17:00. **Esperado (UI):** "O fim deve ser posterior ao início"; "Salvar" desabilitado. Remover.
3. Alterar Comissão para 61 (soma 6+3+61+30 = 100). **Esperado (UI):** "A soma dos percentuais deve ser menor que 100%"; "Salvar" desabilitado; divisor exibido como "—". Voltar Comissão para 0.

**Roteiro C — Boleto Tec e capacidade:**
1. Adicionar Boleto Tec "Laser X": parcela 5.000,00, total 24, pagas 10. **Esperado (UI):** restantes **14**, badge "Compõe o custo"; total de custos fixos **R$ 35.000,00**; custo/hora **R$ 178,57**.
2. Alterar pagas para 24. **Esperado (UI):** restantes **0**, badge "Quitado"; total volta a **R$ 30.000,00**; custo/hora **R$ 153,06**.
3. Alterar Salas para 2 (Profissionais = 1). **Esperado (UI):** capacidade **1**, custo/hora **R$ 153,06** (D3).
4. Alterar Profissionais para 2. **Esperado (UI):** capacidade **2**, custo/hora **R$ 76,53**. Voltar ambos para 1. Salvar.
5. **Esperado (Firestore):** `boletos_tec[0].parcelas_pagas: 24`, `boletos_tec[0].mes_referencia: '2026-10'`.

**Roteiro D — Precificação de protocolos (clinic_admin):**
1. Ir para `/clinic/protocolos`.
2. **Esperado (UI) em P1:** Duração 60 min; Material **R$ 230,00** (2 × 115); Hora clínica **R$ 153,06**; Custo real **R$ 383,06**; Preço sugerido **R$ 627,97** (383,0612 / 0,61).
3. **Esperado (UI) em P3:** Material **R$ 215,00** (115 + 2 × 50), com os dois produtos nomeados; Hora clínica **R$ 76,53**; Custo real **R$ 291,53**; Preço sugerido **R$ 477,92**.
4. **Esperado (UI) em P2:** aviso "Custo de material incompleto" citando "Material Sem Custo" e "Informe a duração para calcular o preço"; sem preço sugerido.
5. Editar P1 (`/clinic/protocolos/{id}`), alterar Duração para 0 e salvar. **Esperado (UI):** toast "Informe uma duração entre 1 e 1440 minutos"; nada gravado.

**Roteiro E — Isolamento de role e tenant:**
1. Logar como `clinicUserA` → `/clinic/my-clinic?tab=fixed_costs`. **Esperado (UI):** aba "Custos Fixos" ausente; aba ativa = "Clínica".
2. `clinicUserA` → `/clinic/protocolos`. **Esperado (UI):** cards sem bloco de precificação e sem CTA.
3. **Esperado (Firestore/rules):** tentativa de `getDoc(tenants/test-clinic-a/financeiro/custo_hora)` autenticado como `clinicUserA` → `permission-denied` (coberto também em `npm run test:rules`).
4. Logar como `clinicAdminB` → `/clinic/my-clinic?tab=fixed_costs`. **Esperado (UI):** configuração vazia (padrão), sem nenhum valor de `test-clinic-a`.

**Roteiro F — Compartilhamento com o consultor:**
1. Logar como `consultant` → `/consultant/clinics/test-clinic-a`. **Esperado (UI):** botão "Ver Precificação" **ausente**. **Esperado (rules, com a allowlist do bugfix UC-48-RN-06 em `develop`):** Emulator UI → Firestore → Requests não mostra nenhuma leitura permitida de `tenants/test-clinic-a/protocolos` pelo consultor; `getDocs(tenants/test-clinic-a/protocolos)` autenticado como `consultant` → `permission-denied` (coberto em `npm run test:rules`).
2. Acessar diretamente `/consultant/clinics/test-clinic-a/pricing`. **Esperado (UI):** "Esta clínica não compartilhou dados financeiros com você." — nenhum nome de protocolo (P1/P2/P3) aparece na página.
3. Logar como `clinicAdminA` → aba "Custos Fixos" → ativar "Compartilhar dados financeiros com o consultor" → Salvar.
4. **Esperado (Firestore):** `compartilhar_com_consultor: true`, `compartilhado_com_consultant_id: 'qa-consultant'`.
5. **Esperado (Firestore — auditoria):** exatamente 1 documento novo em `audit_log` com `tenant_id: 'test-clinic-a'`, `entity_type: 'financial_config'`, `entity_id: 'test-clinic-a'`, `action: 'share_with_consultant'`, `actor_id: 'qa-clinic-admin-a'`, `actor_role: 'clinic_admin'`, `metadata.consultant_id: 'qa-consultant'`.
6. Clicar "Salvar" de novo sem alterar o switch. **Esperado (Firestore):** nenhuma entrada nova em `audit_log` com `entity_type: 'financial_config'`.
7. Abrir `/clinic/audit-log`. **Esperado (UI):** linha com "Dados Financeiros" / "Compartilhar com Consultor".
8. Logar como `consultant` → `/consultant/clinics/test-clinic-a`. **Esperado (UI):** botão "Ver Precificação" presente → clicar → custo/hora **R$ 153,06**, `ReadOnlyBanner`, nenhum input editável, P1 com preço sugerido **R$ 627,97** e detalhe "Produto Teste Rennova"; P3 com totais completos (Material **R$ 215,00**, Preço sugerido **R$ 477,92**), detalhe mostrando "Produto Teste Rennova" e uma linha "Outros materiais" com **R$ 100,00** — o texto "Material Terceiro" e o código `9990003` **não** aparecem na página. **Esperado (rules):** a listagem de P1–P3 carregou — prova de que o opt-in libera a leitura de `protocolos` (D6/RN-18).
9. Logar como `consultantB` (sem `test-clinic-a` em `authorized_tenants`) → `/consultant/clinics/test-clinic-a/pricing`. **Esperado (UI):** redirecionado para `/consultant/clinics`.
10. `clinicAdminA` desativa o compartilhamento e salva. **Esperado (Firestore):** `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null`. `consultant` recarrega `/consultant/clinics/test-clinic-a/pricing` → estado vazio, sem nomes de protocolos (com a allowlist presente, a leitura de `protocolos` volta a ser negada).
11. **Esperado (Firestore — auditoria):** nova entrada `action: 'unshare_with_consultant'`, `metadata.consultant_id: 'qa-consultant'`.
12. (Troca de consultor, RN-16) Via Admin SDK, gravar `compartilhar_com_consultor: true` e `compartilhado_com_consultant_id: 'qa-consultant-b'` no documento. `clinicAdminA` abre a aba. **Esperado (UI):** switch desligado e aviso "O compartilhamento anterior não vale para o consultor atual". Salvar. **Esperado (Firestore):** `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null` e entrada `unshare_with_consultant` com `metadata.motivo: 'troca_de_consultor'`. Antes de salvar, com o documento apontando para `qa-consultant-b`: `consultant` (`qa-consultant`) abre `/consultant/clinics/test-clinic-a/pricing` → estado vazio, sem nomes de protocolos (opt-in de outro `consultant_id` não libera `protocolos` — RN-13/RN-18). Restaurar o documento ao final (`finally`).

**Commit:** N/A (validação manual, não gera commit de código).

### STEP 5 — Documentação de UC

**Objetivo:** Mapear o comportamento novo como UC (próximo número livre: **UC-58**), para que o `qa-agent` tenha o slug do arquivo E2E e para fechar o ciclo da Seção 15 do guia.

**Ações:**
1. Acionar `uml-use-case-writer` para criar `ONLY_FOR_DEVS/PO_BA_Docs/UC-58-precificar-protocolos-pela-hora-clinica.md` (atores: `clinic_admin`, `clinic_consultant` com opt-in) e atualizar UC-20 (campo `duracao_minutos`), UC-48 (botão "Ver Precificação") e UC-53 (RN-10 passa a ter o compartilhamento de dados financeiros como exceção auditada).
2. Atualizar a nota de compatibilidade em `FEAT-relatorio-custo-por-procedimento.md` (Seção 5.2).

**Validação:** UC-58 existe e referencia este spec.

**Commit:** `docs(uc): map clinic hour pricing use case`

---

## 8. Estratégia de Testes

### 8.1 Jest — `src/__tests__/precificacao.test.ts`

Exemplo numérico oficial (outubro/2026 começa numa quinta-feira; contagem verificada: seg 4, ter 4, qua 4, qui 5, sex 5, sáb 5, dom 4):

- Custo fixo R$ 30.000; seg–sex 8h (08–12 + 13–17), sáb 4h (08–12); 1 sala, 1 profissional.
- `horas_mes = (4+4+4+5+5) × 8 + 5 × 4 = 176 + 20 = 196`.
- `custo_hora = 30.000 / (196 × 1) = 153,0612… → R$ 153,06`.
- Protocolo 60 min, material R$ 800; markup 6% + 3% + 0% + 30% = 39% → divisor 0,61.
- `custo_real = 153,0612 + 800 = 953,0612`; `preço_sugerido = 953,0612 / 0,61 = 1.562,3954… → R$ 1.562,40`.

| Função | Cenários obrigatórios |
|--------|----------------------|
| `parseHorario` | `'08:00'` → 480; `'23:59'` → 1439; `'24:00'`, `'8:0'`, `'ab:cd'`, `''` → `null`. |
| `validarPeriodosDia` | 08–12 + 13–17 → `null`; 08–12 + 12–14 (encostados) → `null`; 08–12 + 11–14 → 'Períodos sobrepostos'; 18–17 → 'O fim deve ser posterior ao início'; 08–08 → mesmo erro; ativo sem períodos → 'Dia ativo sem períodos'; inativo sem períodos → `null`. |
| `calcularHorasDia` | 08–12 + 13–17 → 8; 08–12 → 4; 08:30–12:15 → 3,75; inativo → 0. |
| `contarOcorrenciasDiaSemanaNoMes` | 2026/10 → `{dom:4, seg:4, ter:4, qua:4, qui:5, sex:5, sab:5}`; 2026/11 → seg 5, dom 5, demais 4; 2027/02 → todos 4; 2028/02 (bissexto, 29 dias) → soma 29. |
| `calcularHorasMes` | Exemplo oficial out/2026 → 196; mesmo config nov/2026 → 184 ((5+4+4+4+4)×8 + 4×4); todos inativos → 0. |
| `mesesEntre` | `('2026-10','2026-10')` → 0; `('2026-10','2027-01')` → 3; `('2026-10','2026-09')` → −1. |
| `calcularParcelasRestantes` / `boletoCompoeCusto` | 24 total, 10 pagas, ref 2026-10 em 2026-10 → 14 / `true`; 24/24 → 0 / `false` (quitado); 24 total, 22 pagas, ref 2026-10: em 2026-11 → 1 / `true`, em 2026-12 → 0 / `false`; mês anterior à referência (2026-09) → 14 (não avança para trás, `max(0, …)` sobre meses negativos tratado como 0). |
| `calcularCustoFixoMensal` | base 30.000 → total 30.000; + personalizado 500 → 30.500; + boleto ativo 5.000 → breakdown `{base:30000, personalizados:500, boletos:5000, total:35500}`; boleto quitado → `boletos: 0`. |
| `calcularCapacidadeSimultanea` | (1,1) → 1; (2,1) → 1; (1,3) → 1; (2,2) → 2. |
| `calcularCustoHora` | (30.000, 196, 1) ≈ 153,06; (35.000, 196, 1) ≈ 178,57; (30.000, 196, 2) ≈ 76,53; (30.000, 0, 1) → `null`; (0, 196, 1) → 0. |
| `validarParametrosMarkup` / `calcularDivisorMarkup` | 6/3/0/30 → `null` / 0,61; 0/0/0/0 → `null` / 1; 6/3/61/30 (=100) → erro de soma / `null`; 50/50/10/0 (>100) → erro / `null`; −1 em qualquer campo → 'Percentuais não podem ser negativos' / `null`; 99,99 total → válido, divisor ≈ 0,0001. |
| `calcularResumoCustoHora` | Exemplo oficial em `'2026-10'` → `{horasMes:196, capacidade:1, custoHora≈153,06, divisor≈0,61}`; config padrão (`criarConfigPadrao`) → `custoHora: null`. |
| `calcularCustoMedioPorProduto` | (a) lotes ativos disp 10 @100 + disp 30 @120 → 115, `criterio:'estoque_atual'`; lote ativo com disp 0 ignorado em (a); lote `active:false` ignorado em (a); (b) todos disp 0: inicial 20 @90 + inicial 5 @110 → 94, `criterio:'historico'`; `valor_unitario` `undefined`/`NaN`/`'abc'`/negativo ignorado; `valor_unitario: 0` válido (custo 0); (c) produto sem nenhum lote válido → ausente do `Map`. |
| `calcularCustoMaterialProtocolo` | item `9990001` × 2 com custo 115 → total 230, `incompleto:false`; item sem custo → `incompleto:true`, `codigosSemCusto` contém o código, total soma só os com custo; lista vazia → total 0. |
| `calcularPrecificacaoProtocolo` | Exemplo oficial (60 min, custoHora 153,0612, material 800, divisor 0,61) → custoHoraAplicado ≈ 153,06, custoReal ≈ 953,06, precoSugerido ≈ 1.562,40; 30 min → custoHoraAplicado ≈ 76,53; sem duração → custoHoraAplicado/custoReal/precoSugerido `null`; `custoHora: null` → `null`s; `divisor: null` → custoReal calculado, precoSugerido `null`. |
| `mesCorrenteSaoPaulo` | `new Date('2026-11-01T02:00:00Z')` (= 31/10 23:00 em SP) → `'2026-10'`; `new Date('2026-10-15T12:00:00Z')` → `'2026-10'`. |
| `formatarMesReferencia` | `'2026-10'` → `'outubro/2026'`. |
| `calcularProdutosRennova` | lote `brand: 'Rennova'` → incluído; `' rennova '` → incluído (normalizado); `'Marca X'` / sem brand → não incluído; produto com um lote Rennova e outro sem brand → incluído. |
| `separarMaterialParaConsultor` | P3 (`9990001` × 1 @115 Rennova + `9990003` × 2 @50 Marca X) → `total: 215`, `itensRennova` só `9990001`, `outrosMateriais: { subtotal: 100, quantidadeItens: 1, incompleto: false }`; só Rennova → `outrosMateriais: null`; não-Rennova sem custo → `outrosMateriais.incompleto: true` e código **ausente** de `incompletoRennova`; Rennova sem custo → código em `incompletoRennova`. |

**`src/__tests__/auditLogPayload.test.ts` — `describe('determineFinancialShareAuditAction')`:** as 5 linhas da tabela da Seção 6.2.4 (incluindo `before: null`) + desligamento com `options.trocaDeConsultor` → `metadata.motivo: 'troca_de_consultor'`.

### 8.2 Rules — `tests/rules/firestore-tenant-subcollections.test.ts` (`npm run test:rules`)

`describe('tenants/{tenantId}/financeiro')`, documento `custo_hora` semeado com `testEnv.withSecurityRulesDisabled`:

| Cenário | Esperado |
|---|---|
| `clinic_admin` do tenant lê (get e list) e escreve (com `tenant_id` correto e `compartilhar_com_consultor` bool) | sucesso |
| `clinic_admin` escreve com `tenant_id` de outro tenant | falha |
| `clinic_admin` escreve sem `compartilhar_com_consultor` | falha |
| `clinic_user` do tenant lê (get e list) / escreve | falha (bug que esta feature evita — o bloco genérico concederia leitura) |
| usuário de outro tenant lê/escreve | falha |
| consultor com acesso, `compartilhar_com_consultor: false` | get falha |
| consultor com acesso, `true` e `compartilhado_com_consultant_id` = seu `consultant_id` | get sucesso; write falha |
| consultor com acesso, `true` mas `compartilhado_com_consultant_id` de **outro** consultor | get falha |
| consultor **sem** o tenant em `authorized_tenants`, flag `true` com seu id | get falha |
| `system_admin` | lê e escreve |
| Regressão: `describe.each` existente (inventory, protocolos, stock_limits, solicitacoes…) | continua verde |

`describe('protocolos — leitura do consultor com opt-in financeiro (D6)')`, `financeiro/custo_hora` e `protocolos/p1` semeados com `withSecurityRulesDisabled`, toda leitura em **get e list**:

| Cenário | Esperado |
|---|---|
| consultor com acesso, opt-in `true` com seu `consultant_id` | lê `protocolos` (get e list); escrita falha |
| consultor com acesso, opt-in `false` | falha* |
| consultor com acesso, opt-in `true` com `consultant_id` de **outro** consultor | falha* |
| consultor com acesso, sem documento `financeiro/custo_hora` | falha* |
| consultor **sem** o tenant em `authorized_tenants`, opt-in `true` com seu id | falha |
| consultor inativo (`active: false`), opt-in válido | falha |
| `clinic_admin` e `clinic_user` do tenant, sem documento `financeiro` | leem `protocolos` (regressão) |

\* Só falha com a allowlist do `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` presente (sem ela, a blocklist do bloco genérico concede a leitura — Seção 5.4.1).

### 8.3 Não testar (MVP)

| Item | Motivo |
|---|---|
| `FixedCostsTab`, `CustoHoraResumo`, `ProtocoloPrecificacao`, pages | Componentes React — critério do projeto; cobertos pelo caderno E2E (STEP 4). |
| `custoHoraService.ts` | Depende diretamente do client SDK sem abstração injetável (mesmo critério dos demais services); coberto por rules + E2E. |

### 8.4 Caderno E2E (CLAUDE.md, regra 8)

Após a conclusão da task (Modo B do `dev-task-manager`), acionar o `qa-agent` (Modo A) sobre o STEP 4 → `tests/e2e/UC-58-precificar-protocolos-pela-hora-clinica.spec.ts`. Revisão humana obrigatória antes de virar gate de CI.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint          — zero erros ou warnings
[ ] npm run format:check  — sem diferenças (job do ci.yml)
[ ] npm run type-check    — zero erros TypeScript
[ ] npm run build         — build de produção sem falhas
[ ] npm run test          — precificacao.test.ts + suíte existente verdes
[ ] npm run test:rules    — novo describe financeiro + regressão verdes
[ ] Multi-tenant: toda leitura/escrita em tenants/{tenantId}/... com tenantId das claims/authorizedTenants
[ ] Rules: financeiro excluída do bloco genérico; clinic_user e consultor sem opt-in recebem permission-denied
[ ] Rules (D6): consultor só lê protocolos com opt-in financeiro ativo para o próprio consultant_id; regra única, sem duplicação com o BUGFIX-consultor-allowlist-subcolecoes (Seção 5.4.1)
[ ] Segurança: nenhum secret ou credencial no código
[ ] src/lib/precificacao.ts sem nenhum import de firebase
[ ] Exemplo numérico oficial reproduzido na UI (R$ 153,06 / 196 h em out/2026)
[ ] Protocolos legados (sem duracao_minutos) abrem, editam e listam sem erro
[ ] clinic_user: sem aba Custos Fixos e sem valores financeiros na listagem de protocolos
[ ] Validação manual do STEP 4 (roteiros A–F) executada e documentada no PR
[ ] Decisões D1–D6 (Seção 4.4) refletidas no código
[ ] Auditoria: só ligar/desligar/trocar compartilhamento gera entrada em audit_log; salvar sem mudar o switch não gera
[ ] Consultor: nenhum nome/código de produto não-Rennova renderizado na tela de precificação
[ ] Branch pessoal: task branch mergeada em gscandelari_setup e validada em dev-gscandelari.web.app
[ ] PR: gscandelari_setup → develop, template preenchido
[ ] STEP 5: UC-58 criado pelo uml-use-case-writer; caderno E2E solicitado ao qa-agent
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Esquecer de excluir `financeiro` do bloco genérico → `clinic_user` e qualquer consultor vinculado leem dados financeiros | Média | Alto | Teste de rules dedicado (`clinic_user` get/list falha); item explícito no DoD. |
| Novo consultor herdar o compartilhamento após transferência | Baixa (mitigado no design) | Alto | `compartilhado_com_consultant_id` na rule (RN-13); teste de rules com consultor diferente. |
| Consultor Rennova ver nomes de produtos de terceiros via protocolos | Média | Médio | D5/RN-17: detalhe só Rennova + "Outros materiais"; passo 8 do roteiro F verifica a ausência do nome/código. Observação: gap registrado no mapa como `UC-48-RN-06`; o `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` restringe a leitura do consultor por allowlist e, junto com D6, `protocolos` passa a exigir o opt-in. O `inventory` continua legível pelo consultor (todas as marcas) até `UC-48-RN-06-Decisão`. |
| Regra de `protocolos` duplicada/divergente entre esta feature e o bugfix UC-48-RN-06, ou blocklist reintroduzida na resolução de conflito | Média | Alto | Seção 5.4.1 (manter allowlist; uma única cópia da regra); testes de D6 e o teste "subcoleção futura negada" do bugfix falham se isso acontecer. |
| Conflito com `FEAT-relatorio-custo-por-procedimento.md` ("consultor não acessa") | Média | Baixo | Esta feature não dá ao consultor acesso àquele relatório nem a `costingService`; o opt-in é só para `financeiro`. Nota de compatibilidade no STEP 5. Se o produto quiser estender o opt-in ao relatório no futuro, deve ser decisão explícita. |
| Entrada de auditoria não gravada (falha após o `setDoc`) | Baixa | Médio | Best-effort documentado (RN-14, Seção 4.3); erro em `console.error`. Se virar requisito de conformidade, migrar a escrita para API route com Admin SDK numa versão futura. |
| Mudança de escopo do UC-53 (RN-10) não refletida na documentação | Média | Baixo | STEP 5 atualiza o UC-53. |
| Usuário interpretar o preço sugerido como valor contábil exato | Média | Médio | Aviso RNF-07 no resumo e rodapé da listagem. |
| `valor_unitario` ausente/zerado em lotes antigos distorcer o custo médio | Média | Médio | RN-09 ignora valores inválidos; RF-14 sinaliza custo incompleto. `0` é considerado válido (bonificação) — revisar se gerar confusão. |
| Relógio do cliente errado → mês de referência errado | Baixa | Baixo | Mês exibido explicitamente no resumo (RN-04). |
| `setDoc` sobrescrever alteração concorrente de outro `clinic_admin` | Baixa | Baixo | Último a salvar vence (mesmo comportamento de `StockLimitsTab`); `updated_by`/`updated_at` registram o último. |
| Seed E2E não cobrir inventário/protocolos do cenário | Alta | Baixo | O STEP 4 especifica os documentos que cada teste semeia e remove via Admin SDK (padrão de `UC-51-*.spec.ts`); vínculo consultor ↔ `test-clinic-a` já existe no seed. |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Hora clínica | Custo de manter a clínica aberta por uma hora de atendimento de uma "unidade de capacidade" (sala com profissional). |
| Custo fixo mensal | Despesas que não variam com o número de procedimentos (aluguel, salários etc.) + parcelas ativas de Boleto Tec. |
| Boleto Tec | Financiamento de equipamento/tecnologia (antes chamado "Boleto laser"), pago em parcelas mensais; compõe o custo fixo enquanto houver parcelas restantes. |
| Capacidade simultânea | Quantos atendimentos podem ocorrer ao mesmo tempo: `min(salas, profissionais)`. |
| Taxa de ocupação | Percentual das horas disponíveis efetivamente vendidas; fixada em 100% na v1. |
| Markup divisor | Método de precificação `preço = custo / (1 − Σ percentuais sobre o preço)`, garantindo que impostos, taxas, comissão e margem incidam sobre o preço final. |
| Custo médio do produto | Média ponderada de `valor_unitario` dos lotes do inventário (RN-09). |
| Custo real | `custo_hora × duração + custo de material` de um protocolo. |
| Opt-in de compartilhamento | Ação explícita do `clinic_admin` que libera leitura dos dados financeiros a um consultor específico. |

---

## 12. Referências

- `CLAUDE.md` — multi-tenant, roles, regra 8 (caderno de teste).
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Seções 1.3, 2 e 15.
- `ONLY_FOR_DEVS/TO_DO/FEAT-templates-de-procedimentos.md` — origem do conceito de Protocolo.
- `ONLY_FOR_DEVS/TO_DO/FEAT-relatorio-custo-por-procedimento.md` — restrição "consultor não acessa".
- `ONLY_FOR_DEVS/TO_DO/FEAT-brand-e-visibilidade-consultor.md` — consultor vê só Rennova.
- `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (v1.1) — allowlist de subcoleções do consultor (UC-48-RN-06) e D1 = B (leitura de `protocolos` com opt-in financeiro); convivência na Seção 5.4.1.
- `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md` e `TASK_COMPLETED/FEAT-qa-agent-playwright-emulator-setup.md` — formato do STEP 4.
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md` — UC-53 RN-10 (escopo de auditoria).
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-relatorios-gerenciais-custeio-procedimento.md` — UC-51 / `costingService.ts`.
- UCs: UC-15 (limite de estoque), UC-20 (protocolos), UC-45 (Minha Clínica), UC-46 (consultor vinculado), UC-48 (clínicas do consultor), UC-51, UC-53.
- Código: `firestore.rules`; `src/types/index.ts`; `src/lib/services/protocoloService.ts`; `src/app/(clinic)/clinic/my-clinic/page.tsx`; `src/components/clinic/StockLimitsTab.tsx`; `src/app/(clinic)/clinic/protocolos/**`; `src/components/protocolos/ProtocoloForm.tsx`; `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`; `src/hooks/useLinkedConsultant.ts`; `src/lib/services/reportService.ts` (`formatCurrency`); `src/lib/auditLogPayload.ts`; `src/lib/services/auditLogService.ts`; `src/lib/brandUtils.ts`; `scripts/seed-emulator.ts`; `src/lib/firestoreErrors.ts`; `tests/rules/firestore-tenant-subcollections.test.ts`; `tests/e2e/fixtures/seed-data.ts`.

### Trabalho futuro (Fase 3 — fora do escopo)

- Integrar a hora clínica ao custeio por procedimento (UC-51 / `costingService.ts`) — exige duração nas solicitações ou herdada do protocolo (`Solicitacao.protocolo_id` já existe).
- Taxa de ocupação configurável.
- Desconto de feriados (nacionais/municipais) no cálculo de horas.
- Markup por protocolo (sobrescrevendo o da clínica).
- Seleção de mês de referência diferente do corrente.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 09/10/2026 | Doc Writer (Claude) | Versão inicial. Status "Aguardando decisão" — D1 a D5 pendentes (Seção 4.4). |
| 1.1 | 09/10/2026 | Doc Writer (Claude) | Decisões D1–D5 respondidas pelo usuário (Guilherme Stanke Scandelari) em 09/10/2026; Seção 4.4 virou "Decisões tomadas"; status → Planejamento. D1/D2/D3 confirmaram as premissas. D4 divergiu da recomendação: audita só o compartilhamento — novo `entity_type 'financial_config'`, ações `share_with_consultant`/`unshare_with_consultant`, função pura `determineFinancialShareAuditAction` (Seção 6.2.4), RF-19, RN-14 reescrita, RN-16 (troca de consultor), STEP 2.4 com commit novo, testes em `auditLogPayload.test.ts`, roteiro F ampliado. D5: totais completos + detalhe só Rennova (RF-20, RN-17, `calcularProdutosRennova`/`separarMaterialParaConsultor`, protocolo P3 "Protocolo Misto" no STEP 4). STEP 5 inclui atualização do UC-53. |
| 1.2 | 09/10/2026 | Doc Writer (Claude) | Nova decisão D6 (usuário, 09/10/2026, tomada como D1 = B do `BUGFIX-consultor-allowlist-subcolecoes.md`): o consultor só lê `protocolos` com o opt-in financeiro ativo para o próprio `consultant_id` (`get()` em `financeiro/custo_hora`). RN-18; Seção 5.4 ganhou o helper `consultantHasFinancialOptIn` e a regra de leitura de `protocolos`; nova Seção 5.4.1 (convivência com o bugfix UC-48-RN-06 em qualquer ordem de merge); 5.2, 5.5, STEP 2.1/2.2 (commit novo condicionado), Seção 8.2 (testes de D6), Roteiro F (passos 1, 2, 8, 10 e 12), DoD, Riscos e Referências ajustados. |
