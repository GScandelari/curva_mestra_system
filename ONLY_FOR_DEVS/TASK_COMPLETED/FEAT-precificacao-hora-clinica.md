# Feature: Precificação pela Hora Clínica (Custos Fixos + Preço Sugerido de Protocolos)

**Projeto:** Curva Mestra
**Data:** 09/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Stanke Scandelari
**Data de Conclusão:** 10/10/2026
**Tipo:** Feature
**Branch sugerida:** `feature/precificacao-hora-clinica`
**Prioridade:** Média
**Versão:** 1.7

> A clínica passa a cadastrar seus custos fixos mensais (incluindo financiamentos de equipamento, "Boleto Tec"), sua disponibilidade semanal e sua capacidade simultânea de atendimento, e o sistema calcula o **custo da hora clínica** do mês corrente. Esse valor, somado ao custo médio dos materiais do inventário, gera o **custo real** e o **preço sugerido** (markup divisor) de cada Protocolo. É um valor de **norte** para precificação, não um cálculo contábil. Os dados são restritos ao `clinic_admin`, com opção explícita de compartilhamento somente-leitura com o consultor vinculado.

> Decisões D1–D6 tomadas pelo usuário em 09/10/2026 (Seção 4.4). D6 (v1.2): o consultor só lê `protocolos` com o opt-in financeiro ativo para ele — mesma regra de `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (UC-48-RN-06); convivência descrita na Seção 5.4.1. Documento pronto para o `dev-task-manager`.

> **v1.3 — Fase 2B (preço sugerido no procedimento):** as Fases 1 e 2 (STEPs 1–3) já estão implementadas e mergeadas em `gscandelari_setup` (PR #382). A v1.3 acrescenta, na mesma branch e no mesmo PR para `develop` (D7), o **preço sugerido no cadastro e no detalhe do procedimento** (`/clinic/requests/new`, `/clinic/requests/[id]`): campo de duração pré-preenchido pelo protocolo (D9), forma de pagamento Pix/Dinheiro, Débito ou Crédito com taxas de cartão separadas (D8) e **snapshot** da precificação gravado ao confirmar, numa subcoleção legível só por `clinic_admin` (D10). Decisões D7–D10 do usuário em 09/10/2026 (Seção 4.4); premissas na Seção 4.5.

> **v1.4 — revisão das premissas pelo usuário (09/10/2026):** D11 — protocolo sem duração é considerado **1 hora** (aviso em diálogo no cadastro; listagem e consultor também precificam com 60 min); D12 — o mês de referência do procedimento é o **mês da data do procedimento**; D13 — a forma de pagamento é **apenas informativa**: cadastro (revisão) e detalhe mostram sempre os três preços, cada um com a taxa considerada, e o snapshot grava os três; D14 — no caderno E2E, aceite de termos via Admin SDK dentro de cada spec, sem estender o seed. P1–P9, P11, P13, P15, P16 e P17 confirmadas. Fica **a confirmar** com o usuário a interpretação do assistente sobre a duração efetiva (I-1, Seção 4.5), em especial o caso "sem protocolo e sem duração".

> **v1.5 — respostas do usuário à I-1 (09/10/2026):** a duração padrão de 1 hora vale sempre que não houver duração — protocolo sem duração (mesmo com outros produtos adicionados) **e** procedimento sem protocolo e sem duração informada. O campo "Duração (min)" **não** é pré-preenchido com 60: só o diálogo (ao aplicar protocolo sem duração) e o aviso "Duração não informada — considerada 1 hora"; o cálculo usa 60 por baixo. Não há mais pendências de decisão neste spec.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (sincronizar antes: `git checkout develop && git pull origin develop`; conferir que `develop` existe local + remoto e está em sync com `master`).
- **Branch da task:** `feature/precificacao-hora-clinica`
- **Fluxo de PR (Seção 1.3 do guia):** task branch → PR para `gscandelari_setup` (validação em `dev-gscandelari.web.app`) → PR `gscandelari_setup` → `develop`. **Nunca** PR direto para `master`.
- **Escopo único (Fase 1 + Fase 2 + Fase 2B):** uma única branch e **um único PR** para `develop` (D7). Fases 1–2 (STEPs 1–3) já estão commitadas; a Fase 2B (STEP 6) entra na mesma branch. Ordem de execução do que falta: **STEP 6 → STEP 4 (roteiros A–L) → STEP 5**. Os STEPs são ordenados para que cada commit mantenha `lint`/`type-check`/`build` verdes.

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
| STEP 6.1 | `feat` | `tenant` | `feat(tenant): split card fee into debit and credit rates` |
| STEP 6.2 | `test` | `tenant` | `test(tenant): cover payment method divisors and legacy markup` |
| STEP 6.2a | `feat` | `tenant` | `feat(tenant): price protocols without duration as one hour` |
| STEP 6.3 | `feat` | `tenant` | `feat(tenant): add procedure pricing pure functions and types` |
| STEP 6.4 | `test` | `tenant` | `test(tenant): cover procedure pricing and snapshot builder` |
| STEP 6.5 | `feat` | `firebase` | `feat(firebase): restrict procedure pricing snapshots to clinic_admin` |
| STEP 6.6 | `test` | `firebase` | `test(firebase): cover procedure pricing snapshot rules` |
| STEP 6.7 | `feat` | `tenant` | `feat(tenant): persist procedure duration, payment method and pricing snapshot` |
| STEP 6.8 | `feat` | `clinic` | `feat(clinic): show suggested price when registering a procedure` |
| STEP 6.9 | `feat` | `clinic` | `feat(clinic): show recorded suggested price on procedure detail` |
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
- **Procedimentos (solicitações) — estado antes da v1.3** (UC-16 a UC-19): `src/app/(clinic)/clinic/requests/new/page.tsx` tem 2 passos (`'adicionar_produtos' | 'revisao'`) e redireciona quem não é `clinic_admin` para `/clinic/requests`. No passo 1: "Usar Protocolo (opcional)" (só na criação — em modo edição a lista de protocolos nem é carregada), tipo programado/efetuado, descrição, data, observações e produtos (FEFO automático no programado, lote escolhido no efetuado); a tabela mostra "Valor Total" = Σ `quantidade_solicitada × valor_unitario` dos **lotes efetivamente alocados**. O passo 2 repete os dados e confirma via `createSolicitacaoWithConsumption`/`createSolicitacaoEfetuada` (`src/lib/services/solicitacaoService.ts`), que hoje devolvem só `{ success, solicitacaoId }`. A edição (`requests/[id]/edit/page.tsx`) só existe para status `agendada` e redireciona para `requests/new?edit={id}&...`, passando os dados por query string; a confirmação chama `updateSolicitacaoAgendada`. O detalhe (`requests/[id]/page.tsx`) é visível a `clinic_admin` **e** `clinic_user`; o card "Resumo" mostra "Valor Total" = `valor_total` calculado em `getSolicitacao` (não persistido). `Solicitacao` (`src/types/index.ts`) não tem duração nem forma de pagamento. Nenhuma tela de procedimento lê `financeiro`.
- **Leitura de `solicitacoes`**: bloco genérico — qualquer usuário do tenant (inclusive `clinic_user`) e o consultor com acesso. A allowlist do `BUGFIX-consultor-allowlist-subcolecoes` **mantém** `solicitacoes` para o consultor (UC-52, projeção client-side). Logo, qualquer campo gravado no documento da solicitação é legível por `clinic_user` e pelo consultor.
- **Markup (v1.2)**: `ParametrosMarkup` tem um único `cartao_pct`; `calcularDivisorMarkup` devolve um único divisor; a listagem de protocolos e a tela do consultor mostram um único preço sugerido. O bloco genérico das rules exclui `nf_imports` e `financeiro` com `!(collectionId in [...])` repetido nas linhas de `belongsToTenant` e do consultor (a allowlist UC-48-RN-06 ainda não está em `develop`).

### 1.2 Problema identificado

1. A clínica não tem como saber quanto custa uma hora de sala/profissional — o custo fixo (aluguel, salários, financiamento de equipamentos) não está em lugar nenhum do sistema.
2. Protocolos não têm duração, então não é possível atribuir custo de tempo a um procedimento.
3. Não existe um custo médio de material por produto que sirva de base de precificação **antes** do consumo (o UC-51 só olha o passado consumido).
4. Sem esses três elementos, o preço do procedimento continua sendo definido "de cabeça", que é exatamente a dor citada em `FEAT-relatorio-custo-por-procedimento.md` (Contexto).
5. (v1.3) Ao cadastrar um procedimento, a clínica só vê o custo de material; o custo da hora clínica e o preço sugerido ficam restritos à listagem de protocolos, longe do momento em que o preço é combinado com o paciente.
6. (v1.3) Uma única "taxa de cartão" não distingue Pix/Dinheiro (sem taxa), débito e crédito — o preço sugerido fica errado para qualquer forma que não seja a média assumida.
7. (v1.3) Sem registro do valor sugerido no momento do cadastro, o "histórico" de um procedimento mudaria sempre que os custos fixos mudassem.

### 1.3 Motivação estratégica

Decisão de produto do usuário (briefing desta spec): dar à clínica um **norte** de precificação combinando tempo (hora clínica) + material (inventário real), reaproveitando dados que o Curva Mestra já tem (inventário com `valor_unitario`, protocolos). O escopo v1 foi fixado em Fase 1 (custo da hora) + Fase 2 (precificação de protocolos); a integração com o custeio histórico (UC-51) fica para a Fase 3. A opção de compartilhar com o consultor atende ao uso do consultor em planos estratégicos com a clínica, sem quebrar o padrão de "dados financeiros internos não são do consultor por padrão".

**v1.3 (pedido do usuário, 09/10/2026):** "Ao cadastrar um procedimento, só apresenta o valor total com base nos materiais. Quero que nessa tela também apresente o valor sugerido com base nos custos fixos. Será importante ter a opção de seleção se o pagamento vai ser feito no pix/dinheiro ou cartão, para termos os cálculos estimados com base nas taxas." Exemplo citado: `/clinic/requests/{id}` (detalhe). Decisões D7–D10 (Seção 4.4).

---

## 2. Objetivos

1. **Adicionar** a aba "Custos Fixos" em Minha Clínica, visível e editável apenas por `clinic_admin`, com custos fixos base + personalizados, Boletos Tec, disponibilidade semanal, salas/profissionais e parâmetros de markup.
2. **Calcular** em tempo real (client-side, funções puras) custo fixo mensal, horas planejadas do mês corrente, capacidade simultânea e custo da hora clínica.
3. **Adicionar** `duracao_minutos` ao `Protocolo` e exibir, na listagem de protocolos (apenas para quem tem acesso aos dados financeiros), custo de material, custo de hora aplicado, custo real e preço sugerido.
4. **Garantir** isolamento: dados financeiros em subcoleção nova excluída da leitura genérica das rules; `clinic_user` nunca lê; consultor só lê com opt-in explícito do `clinic_admin`.
5. **Expor** ao consultor vinculado (opt-in) uma tela somente-leitura de precificação.
6. **Registrar** na trilha de auditoria (UC-53) somente a ativação, a revogação e a troca de destinatário do compartilhamento com o consultor.
7. **Cobrir** com testes Jest todas as funções puras de cálculo/validação e com testes de rules (`npm run test:rules`) a nova subcoleção.
8. **(v1.3) Separar** a taxa de cartão em débito e crédito e calcular o divisor por forma de pagamento (Pix/Dinheiro, Débito, Crédito), lendo configurações legadas (`cartao_pct`) sem quebra.
9. **(v1.3) Exibir** no cadastro do procedimento (criação e edição) duração, forma de pagamento e preço sugerido, recalculados em tempo real, só para `clinic_admin`.
10. **(v1.3) Registrar** um snapshot da precificação ao confirmar o procedimento, numa subcoleção legível só por `clinic_admin`, e exibi-lo no detalhe; procedimentos sem snapshot mostram uma estimativa atual sinalizada.
11. **(v1.3) Garantir** que nenhum valor derivado dos custos fixos fique no documento da solicitação (legível por `clinic_user` e consultor).

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
| RF-08 | Permitir informar imposto %, taxa de cartão %, comissão % e margem desejada %; bloquear salvamento se algum valor < 0 ou se a soma ≥ 100%. **v1.3:** "taxa de cartão %" substituída por "taxa de débito %" e "taxa de crédito %" (RF-21, RN-20). | clinic_admin | Must |
| RF-09 | Exibir painel de resumo recalculado em tempo real (sem salvar): total de custos fixos (com breakdown base / personalizados / Boletos Tec), mês de referência (ex.: "outubro/2026"), horas planejadas no mês, capacidade simultânea, custo da hora clínica e divisor de markup. | clinic_admin | Must |
| RF-10 | Persistir a configuração em `tenants/{tenantId}/financeiro/custo_hora` ao clicar em "Salvar". | clinic_admin | Must |
| RF-11 | Adicionar campo "Duração (minutos)" no formulário de protocolo (criação e edição). | clinic_admin | Must |
| RF-12 | Na listagem `/clinic/protocolos`, para `clinic_admin`, exibir em cada card: custo de material, custo de hora aplicado, custo real e preço sugerido. | clinic_admin | Must |
| RF-13 | Se a configuração de custos não existir (ou não permitir calcular custo/hora), exibir na listagem de protocolos um CTA "Configure seus custos fixos" levando a `/clinic/my-clinic?tab=fixed_costs`. | clinic_admin | Must |
| RF-14 | Sinalizar quando o custo de material for incompleto (produto do protocolo sem lote com `valor_unitario` válido) ou quando o protocolo não tiver duração. **v1.4:** protocolo sem duração passa a ser precificado com 60 min e exibe "Duração não informada — considerada 1 hora" (RF-34, D11). | clinic_admin | Must |
| RF-15 | Na aba "Custos Fixos", opção "Compartilhar dados financeiros com o consultor" (desabilitada quando não há consultor vinculado). | clinic_admin | Must |
| RF-16 | Com o compartilhamento ativo, o consultor vinculado vê, em `/consultant/clinics/[tenantId]/pricing`, somente leitura: resumo do custo/hora, custos fixos, parâmetros de markup e a precificação dos protocolos. | clinic_consultant | Must |
| RF-17 | Na tela de detalhe da clínica do consultor, exibir o botão "Ver Precificação" apenas quando o documento financeiro for legível para ele (compartilhamento ativo). | clinic_consultant | Should |
| RF-18 | `clinic_user` não vê nenhum valor financeiro (nem aba, nem colunas de preço nos protocolos). | clinic_user | Must |
| RF-19 | Ao salvar com mudança no compartilhamento (desligado → ligado, ligado → desligado, ou troca do consultor destinatário), gravar uma entrada em `audit_log` (`entity_type: 'financial_config'`, ação `share_with_consultant` ou `unshare_with_consultant`), visível em `/clinic/audit-log` e `/admin/audit-log`. Demais alterações da configuração **não** são auditadas. | clinic_admin | Must |
| RF-20 | Na tela do consultor, o detalhe de material de cada protocolo lista apenas itens Rennova; os demais aparecem agregados numa linha "Outros materiais" (sem nome nem código), com subtotal. Totais (material, hora, custo real, preço sugerido) são sempre completos. | clinic_consultant | Must |
| RF-21 | (v1.3) Na aba "Custos Fixos", o card Markup passa a ter Imposto %, Taxa de débito %, Taxa de crédito %, Comissão % e Margem % (o campo único "Taxa de cartão %" deixa de existir). | clinic_admin | Must |
| RF-22 | (v1.3) Configuração gravada antes da v1.3 (só `cartao_pct`) abre com Débito = Crédito = `cartao_pct`; ao salvar, o documento passa a ter só `debito_pct`/`credito_pct`. | clinic_admin | Must |
| RF-23 | (v1.3) O resumo do custo/hora mostra os três divisores (Pix/Dinheiro, Débito, Crédito); a listagem de protocolos e a tela do consultor mostram dois preços sugeridos por protocolo: Pix/Dinheiro e Crédito. | clinic_admin / clinic_consultant | Must |
| RF-24 | (v1.3, ajustado v1.5) No passo 1 do cadastro do procedimento, campo "Duração (min)", sempre editável. Ao aplicar um protocolo **com** `duracao_minutos`, o campo é preenchido se estiver vazio. Ao aplicar um protocolo **sem** duração, abre um diálogo ("Protocolo sem duração" — "Este protocolo não tem duração cadastrada. Será considerada 1 hora (60 min) de procedimento. Você pode informar a duração no campo Duração." — botão único "Entendi"); o campo **não** é preenchido (D11, v1.5). Duração efetiva: RN-24. | clinic_admin | Must |
| RF-25 | (v1.3, ajustado v1.4) No passo 1, seleção da forma de pagamento — Pix/Dinheiro (padrão), Débito ou Crédito. A escolha é **apenas informativa** (D13): é registrada na solicitação e no snapshot e define qual preço aparece em destaque; não altera nenhum valor. Aparece na revisão. | clinic_admin | Must |
| RF-26 | (v1.3, ajustado v1.4) No passo 1 (abaixo da tabela de produtos) e na revisão, bloco "Preço sugerido (estimativa)": duração efetiva (com a origem quando for padrão), material (lotes alocados), hora clínica aplicada, custo real e **sempre os três preços** — "Pix/Dinheiro (sem taxa de cartão)", "Débito (taxa {debito_pct}%)", "Crédito (taxa {credito_pct}%)" — com a forma escolhida em destaque; recalculado a cada mudança de produtos, duração, data ou forma, sem salvar. | clinic_admin | Must |
| RF-27 | (v1.3, ajustado v1.5) Sem configuração de custos, ou com custo/hora ou divisor indefinidos, o bloco mostra só o material e o CTA "Configure seus custos fixos" (`/clinic/my-clinic?tab=fixed_costs`). Sem duração no campo e sem duração de protocolo, o cálculo usa 60 min e o bloco mostra "Duração: 60 min (padrão)" com o aviso "Duração não informada — considerada 1 hora" — inclusive sem protocolo (v1.5). "Informe a duração para calcular o preço" deixa de existir no procedimento. | clinic_admin | Must |
| RF-28 | (v1.3) Ao confirmar (criação programada/efetuada e edição de agendada), gravar `duracao_minutos` e `forma_pagamento` na solicitação e o snapshot em `tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId}`. | clinic_admin | Must |
| RF-29 | (v1.3) Se a gravação do snapshot falhar, a solicitação continua gravada e o usuário vê o toast "Procedimento salvo, mas a precificação não foi registrada". | clinic_admin | Must |
| RF-30 | (v1.3, ajustado v1.4) No detalhe `/clinic/requests/[id]`, card "Preço sugerido" com os valores do snapshot: duração, material, hora clínica, custo real e **os três preços gravados**, cada um rotulado com a taxa considerada, a forma registrada em destaque, com a data do registro e o mês de referência (mês da data do procedimento). | clinic_admin | Must |
| RF-31 | (v1.3, ajustado v1.4) Procedimento sem snapshot: o mesmo card mostra uma **estimativa atual** (configuração de custos atual aplicada ao **mês da data do procedimento**, duração/forma da solicitação, material dos lotes), com selo "Estimativa atual" e texto explicativo. | clinic_admin | Must |
| RF-32 | (v1.3) `clinic_user` não vê o card "Preço sugerido" (nem snapshot nem estimativa) e a tela não lê `financeiro`/`precificacao_procedimentos` para ele. Duração e forma de pagamento (não sensíveis, P1) aparecem no card "Detalhes do Procedimento" para os dois roles. | clinic_user | Must |
| RF-33 | (v1.3) Na edição de um procedimento agendado, a duração e a forma de pagamento gravadas vêm pré-preenchidas. | clinic_admin | Must |
| RF-34 | (v1.4, D11) Na listagem de protocolos e na tela do consultor, protocolo sem `duracao_minutos` é precificado com 60 min (`DURACAO_PADRAO_MINUTOS`), exibindo "Duração: 60 min (padrão)" e o aviso "Duração não informada — considerada 1 hora" (substitui "Informe a duração para calcular o preço"). | clinic_admin / clinic_consultant | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda leitura/escrita é em `tenants/{tenantId}/...` com `tenantId` vindo das claims (clinic) ou de `authorizedTenants` (consultor) — nunca de input livre. | Segurança |
| RNF-02 | Isolamento garantido em `firestore.rules` (não só na UI): `clinic_user` e consultor sem opt-in recebem `permission-denied` ao ler `financeiro`. | Segurança |
| RNF-03 | Todos os cálculos são funções puras sem import de Firebase, em `src/lib/precificacao.ts`, testadas com Jest. | Manutenibilidade |
| RNF-04 | Valores calculados **não** são persistidos (custo/hora depende do mês corrente) — sempre recalculados na leitura. **Exceção v1.3:** o snapshot do procedimento (RN-26) persiste os valores do momento da confirmação, por ser registro histórico (D10). Protocolos e resumo continuam sem persistência. | Manutenibilidade |
| RNF-05 | Precisão: cálculos em ponto flutuante sem arredondamento intermediário; arredondamento só na exibição (2 casas, `formatCurrency` de `src/lib/services/reportService.ts`). | Usabilidade |
| RNF-06 | A listagem de protocolos faz no máximo 1 leitura do documento `financeiro/custo_hora` + 1 leitura da coleção `inventory` por carregamento (sem N+1 por protocolo). | Performance |
| RNF-07 | Textos de UI deixam claro que os valores são uma **estimativa de norte**, não um cálculo contábil. | Usabilidade |
| RNF-08 | (v1.3) Valores derivados dos custos fixos (custo/hora, custo real, divisor, preço sugerido, percentuais) **nunca** são gravados em `solicitacoes`; só em `precificacao_procedimentos`, protegida por rules (não só pela UI). | Segurança |
| RNF-09 | (v1.3) O cadastro do procedimento faz no máximo 1 leitura extra (`financeiro/custo_hora`) por carregamento; o detalhe faz no máximo 2 (snapshot; config só se não houver snapshot). Gravar o snapshot = 1 `setDoc` (+1 `exists()` avaliado pela rule). | Performance |
| RNF-10 | (v1.3) A gravação do snapshot nunca impede nem desfaz a gravação da solicitação (best-effort, RN-29). | Confiabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | `custo_fixo_mensal = Σ custos base + Σ personalizados + Σ valor_parcela dos Boletos Tec que compõem o mês`. | Fórmula definida pelo usuário. |
| RN-02 | Boleto Tec: `parcelas_restantes(mês) = max(0, total_parcelas − parcelas_pagas − max(0, mesesEntre(mes_referencia, mês)))`; o boleto compõe o custo do mês **se e somente se** `parcelas_restantes(mês) > 0`. Ao salvar com `parcelas_pagas` editado (ou boleto novo), `mes_referencia` é redefinido para o mês corrente. Decisão D1. | Avanço automático mês a mês; quitado deixa de compor. |
| RN-03 | `horas_mes = Σ_{dia da semana ativo} (ocorrências do dia no mês de referência × horas do dia)`; horas do dia = Σ (fim − início) dos períodos, em horas. Feriados **não** são descontados na v1. Decisão D2. | Fórmula definida pelo usuário. |
| RN-04 | Mês de referência = mês corrente pelo relógio do cliente (fuso `America/Sao_Paulo`). **Exceção v1.4:** precificação de procedimento usa o mês da data do procedimento (RN-26, RN-31). | Briefing: "mês corrente". |
| RN-05 | `capacidade_simultanea = min(quantidade_salas, quantidade_profissionais)`. Decisão D3. | Não há atendimento sem sala **e** sem profissional. |
| RN-06 | Taxa de ocupação fixa em 100%, sem campo na UI. | Decisão do usuário (valor de norte). |
| RN-07 | `custo_hora = custo_fixo_mensal / (horas_mes × capacidade_simultanea)`; se `horas_mes × capacidade = 0`, custo/hora é **indefinido** (`null`) e a UI pede para configurar a disponibilidade. | Evita divisão por zero. |
| RN-08 | Cada percentual de markup ∈ [0, 100) e `imposto + cartão + comissão + margem < 100`. Divisor = `1 − soma/100`. **Substituída na v1.3 por RN-19/RN-20.** | Divisor ≤ 0 tornaria o preço infinito/negativo. |
| RN-09 | Custo médio do produto (por `codigo_produto`, no inventário do tenant): **(a)** média ponderada de `valor_unitario` por `quantidade_disponivel` entre lotes com `active !== false`, `quantidade_disponivel > 0` e `valor_unitario` válido; **(b)** se não houver nenhum lote em (a), média ponderada por `quantidade_inicial` entre **todos** os lotes (inclusive inativos/zerados) com `quantidade_inicial > 0` e `valor_unitario` válido; **(c)** se nenhum, o produto fica "sem custo". `valor_unitario` válido = número finito ≥ 0. | Critério exato pedido no briefing; (a) reflete o custo do estoque que será consumido, (b) usa o último custo conhecido. |
| RN-10 | `custo_material = Σ (quantidade_sugerida × custo_medio)` dos itens com custo; se algum item estiver "sem custo", o total é exibido com o aviso "custo de material incompleto" e a lista dos produtos sem custo. | Transparência — não esconder subestimação. |
| RN-11 | `custo_hora_aplicado = custo_hora × duracao_minutos / 60`; `custo_real = custo_hora_aplicado + custo_material`; `preco_sugerido = custo_real / divisor`. Se o protocolo não tiver `duracao_minutos`, mostra apenas o custo de material e "Informe a duração para calcular o preço". **v1.4 (D11):** sem `duracao_minutos`, usa `DURACAO_PADRAO_MINUTOS = 60` e mostra "Duração não informada — considerada 1 hora". | Fórmulas do usuário (markup divisor). |
| RN-12 | Dados financeiros: leitura/escrita apenas `clinic_admin` do tenant (e `system_admin`, pelo bloco genérico já existente). `clinic_user` nunca lê. | Dados financeiros internos. |
| RN-13 | Consultor lê `financeiro/custo_hora` somente se `compartilhar_com_consultor == true` **e** `compartilhado_com_consultant_id == consultant_id` do token **e** o tenant está em `authorized_tenants`. Troca de consultor não herda o acesso. Decisão D5. | Opt-in explícito e não herdável por outro consultor. |
| RN-14 | Somente a mudança do compartilhamento com o consultor gera entrada em `audit_log` (RF-19), decidida por `determineFinancialShareAuditAction` (Seção 6.2.4). Valores de custos, Boletos Tec, disponibilidade, capacidade e markup **não** são auditados. Falha ao gravar a auditoria não desfaz nem bloqueia o salvamento (mesmo padrão de `writeAdminAuditLog`). Decisão D4. | Compartilhar dados financeiros com terceiro é ação sensível; o restante segue UC-53 RN-10 (Minha Clínica fora do escopo). Amplia pontualmente o escopo do UC-53. |
| RN-16 | Ao carregar a aba, se `compartilhar_com_consultor == true` mas `compartilhado_com_consultant_id` ≠ id do consultor vinculado atual (ou não há consultor vinculado), o switch aparece **desligado** com o aviso "O compartilhamento anterior não vale para o consultor atual". Ao salvar, grava `false`/`null` e registra `unshare_with_consultant` com `metadata.motivo: 'troca_de_consultor'`. | Coerência entre UI e rule (RN-13); o consultor anterior já não lê, pois o tenant saiu de `authorized_tenants`. |
| RN-17 | Na visão do consultor, um produto é Rennova se algum lote dele no inventário do tenant tiver marca `'Rennova'` após `normalizeBrand` (`src/lib/brandUtils.ts`). Itens não-Rennova nunca têm nome/código exibidos ao consultor, nem no aviso de custo incompleto (aparece só "Outros materiais: custo incompleto"). | Decisão D5 + `FEAT-brand-e-visibilidade-consultor.md`. |
| RN-18 | Consultor lê `tenants/{tenantId}/protocolos` somente se `consultantHasAccess(tenantId)` **e** o documento `financeiro/custo_hora` tiver `compartilhar_com_consultor == true` e `compartilhado_com_consultant_id == consultant_id` do token. Sem o documento, ou com opt-in desligado/de outro consultor, `permission-denied`. Decisão D6. | Protocolos revelam composição e produtos de qualquer marca; só são necessários ao consultor na tela de precificação compartilhada (UC-48-RN-06). |
| RN-15 | `duracao_minutos`, quando informado, é inteiro entre 1 e 1440. Protocolos legados sem o campo continuam válidos. | Compatibilidade com documentos existentes. |
| RN-19 | (v1.3, D8) Divisor por forma de pagamento: `pix_dinheiro = 1 − (imposto + comissão + margem)/100`; `debito = 1 − (imposto + debito + comissão + margem)/100`; `credito = 1 − (imposto + credito + comissão + margem)/100`. Imposto, comissão e margem entram sempre. | Pix/Dinheiro não paga taxa de adquirente; débito e crédito têm taxas diferentes. |
| RN-20 | (v1.3) Cada percentual (imposto, débito, crédito, comissão, margem) ∈ [0, 100) e `imposto + max(debito, credito) + comissão + margem < 100` — garante divisor > 0 nas três formas. Mensagens iguais às de RN-08: 'Informe percentuais válidos', 'Percentuais não podem ser negativos', 'A soma dos percentuais deve ser menor que 100%'. | Divisor ≤ 0 em qualquer forma tornaria o preço infinito/negativo. |
| RN-21 | (v1.3, P2) Normalização do markup legado na leitura: se `debito_pct`/`credito_pct` não forem números finitos e `cartao_pct` for, assumem `cartao_pct`; qualquer campo ausente/inválido vira 0. O objeto normalizado tem **só** os 5 campos novos — como `saveCustoHoraConfig` usa `setDoc` sem merge, o próximo "Salvar" remove `cartao_pct` do documento. | Compatibilidade sem migração em lote. |
| RN-22 | (v1.3, P6) Custo de material do procedimento = Σ `quantidade × valor_unitario` dos `produtos_solicitados` **efetivamente gravados** (lotes FEFO no programado, lote escolhido no efetuado) — não o custo médio do protocolo (RN-09). `valor_unitario` não numérico/negativo conta 0 e marca o material como incompleto. | O preço do procedimento deve refletir os lotes que serão consumidos. |
| RN-23 | (v1.3, ajustado v1.4) Preço sugerido do procedimento, para **cada** forma: `custo_hora_aplicado = custo_hora × duracao_efetiva / 60`; `custo_real = custo_hora_aplicado + custo_material`; `preco(forma) = custo_real / divisor(forma)`. Sem duração efetiva ou sem custo/hora → `custo_hora_aplicado`, `custo_real` e preços `null`; sem divisor → preços `null`. | Mesmas fórmulas de RN-11. |
| RN-24 | (v1.5, D9 + D11 — confirmada pelo usuário em 09/10/2026) Duração efetiva do procedimento: **(a)** a duração no campo, se preenchida e válida (`parseDuracaoMinutos`, 1..1440) — sempre prevalece (digitada ou vinda de protocolo com duração); **(b)** senão, a `duracao_minutos` (> 0) do protocolo aplicado; **(c)** senão, `DURACAO_PADRAO_MINUTOS` (60), origem `'padrao'` — vale para protocolo sem duração (mesmo com outros produtos adicionados depois) **e** para procedimento sem protocolo. Nunca fica sem duração. Aplicar protocolo com duração preenche o campo se vazio; aplicar protocolo sem duração abre o diálogo de RF-24 e **não** preenche o campo. Remover o protocolo (botão X) não limpa o campo. **Gravação (decisão do assistente, coerente com D11 v1.5):** a solicitação grava em `duracao_minutos` só o valor presente no campo (digitado ou vindo do protocolo) e omite o campo quando ele está vazio — a edição reabre com o campo vazio; o snapshot grava a duração efetiva (sempre número) e `duracao_origem`. Na estimativa atual de procedimento sem `duracao_minutos`, a duração efetiva é 60 (`'padrao'`), com o aviso. | D11: "será considerado hora cheia"; a duração informada no procedimento prevalece. |
| RN-25 | (v1.4, D13) Forma de pagamento padrão `pix_dinheiro`; é **apenas informativa** — registrada na solicitação e no snapshot e usada só para destacar um dos três preços. Solicitação legada sem `forma_pagamento` destaca Pix/Dinheiro na estimativa (RF-31). | Decisão do usuário. |
| RN-26 | (v1.4, D10, D12, P11, P17) Snapshot gravado ao confirmar quando a configuração de custos foi lida com sucesso **e existe**. `mes_referencia` = mês da **data do procedimento** (RN-31); horas do mês e parcelas de Boleto Tec são calculadas para esse mês com a configuração **vigente na confirmação**. O snapshot grava os **três** divisores e os **três** preços. Campos que dependem de duração/custo/divisor podem ser `null`. Sem configuração → nenhum snapshot. | Registro histórico fiel ao que foi mostrado na confirmação. |
| RN-27 | (v1.3, P9, P13) Cada confirmação de edição (só `agendada`) sobrescreve o snapshot (`origem: 'edicao'`). Concluir, cancelar ou reprovar **não** recalcula nem apaga o snapshot. | O snapshot reflete a última versão confirmada pelo admin. |
| RN-28 | (v1.3, P1, P15) Snapshot só em `tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId}`: leitura/escrita só `clinic_admin` do tenant (`system_admin` pelo bloco genérico); `clinic_user` e consultor (com ou sem opt-in financeiro) recebem `permission-denied`. Escrita exige `tenant_id == tenantId`, `solicitacao_id == {solicitacaoId}`, `forma_pagamento` válida e a solicitação existente. | Dados financeiros internos (RN-12); consultor fora do escopo da v1.3. |
| RN-29 | (v1.3, P8) A gravação do snapshot acontece **depois** da transação da solicitação, fora dela, em `try/catch`: falha → `console.error` + toast de aviso (RF-29); a navegação para o detalhe continua. | A solicitação movimenta estoque e não pode depender da precificação. |
| RN-30 | (v1.4, D13) No detalhe, o snapshot **sempre** prevalece; estimativa atual só quando não há snapshot, com selo "Estimativa atual" e o mês usado (mês da data do procedimento). Os três preços vêm de `precos_sugeridos` do snapshot (não são recalculados); cada um é rotulado com a taxa de `markup` gravado. | Distinguir registro histórico de cálculo do momento. |
| RN-31 | (v1.4, D12) Mês da data do procedimento = os 7 primeiros caracteres da **data de calendário escolhida** (`'YYYY-MM-DD'`, que é a data em São Paulo). Atenção: o client grava `dt_procedimento` como `new Date('YYYY-MM-DD')` = **meia-noite UTC** (21:00 do dia anterior em São Paulo); por isso, a partir do `Timestamp` gravado, o mês é lido em **UTC** (`toISOString().slice(0, 7)`, mesmo critério do redirect de edição) — converter para `America/Sao_Paulo` jogaria o dia 1º para o mês anterior. | Coerência com a data que o usuário digitou. |

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
10. **(v1.3) Taxas de cartão separadas no próprio `ParametrosMarkup`** (`debito_pct`, `credito_pct`), com divisor calculado por forma de pagamento (RN-19). A compatibilidade com documentos v1.2 é feita por **normalização na leitura** (`normalizarCustoHoraConfig` dentro de `getCustoHoraConfig`), sem migração em lote nem mudança de rules: o próximo `setDoc` grava o formato novo (RN-21).
11. **(v1.3) Snapshot em subcoleção dedicada** `tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId}` (id do documento = id da solicitação → relação 1:1, leitura por `getDoc`, sem índice). Excluída do fallback genérico pela mesma técnica de `nf_imports`/`financeiro`; para a lista de exclusões não crescer espalhada, ela passa a ficar num helper único `isRestrictedTenantCollection(collectionId)` (Seção 5.4.2). Bloco dedicado com leitura/escrita só `clinic_admin`; consultor sem nenhum acesso, inclusive com opt-in financeiro (P1).
12. **(v1.3) `duracao_minutos` e `forma_pagamento` no documento da solicitação**: não revelam a estrutura de custos (nenhum custo/hora, percentual ou preço). A duração é dado operacional, como a data; a forma de pagamento é dado comercial do atendimento. O material (`valor_unitario` dos lotes) já é legível hoje por `clinic_user` e pelo consultor. Ficar na solicitação permite pré-preencher a edição e calcular a estimativa atual sem depender da subcoleção restrita.
13. **(v1.3) Snapshot fora da transação da solicitação, best-effort** (RN-29): a transação continua idêntica (estoque + `inventory_activity`); só depois do `success` o client faz o `setDoc` do snapshot, usando os `produtos_solicitados` **devolvidos pelo service** (os mesmos gravados na transação) — RN-22 sem segunda leitura.
14. **(v1.3) Funções puras novas em `src/lib/precificacao.ts`** para todo cálculo (divisor por forma, normalização, material do procedimento, preço, montagem do snapshot, preços derivados do snapshot) — UI e services só orquestram, como nas Fases 1–2.
15. **(v1.3) Um componente de exibição** `ProcedimentoPrecificacao`, usado no cadastro (ao vivo), na revisão e no detalhe (snapshot ou estimativa), recebendo um objeto já calculado.
16. **(v1.4) Duração padrão como constante pura** `DURACAO_PADRAO_MINUTOS = 60` em `src/lib/precificacao.ts`, usada por `calcularPrecificacaoProtocolo` (listagem e consultor) e por `resolverDuracaoProcedimento` (cadastro); a regra de precedência (RN-24) fica numa função pura testada, e a tela só guarda se o protocolo aplicado tinha duração.
17. **(v1.4) Mês do procedimento** via função pura `mesReferenciaDoProcedimento`, que aceita a string do formulário ou o `Date` do `Timestamp` gravado (RN-31). `calcularResumoCustoHora(config, mes)` já recebe o mês como parâmetro — nenhuma mudança nele.
18. **(v1.4) Três preços sempre**: o cálculo do procedimento já produz os três (`precos`); a forma escolhida só escolhe o destaque. O snapshot grava `divisores` e `precos_sugeridos` completos, dispensando recalcular no detalhe.

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
| (v1.3) Gravar o snapshot (custo/hora, preço, percentuais) no próprio documento da solicitação | `solicitacoes` é lida por `clinic_user` e pelo consultor (bloco genérico; a allowlist do UC-48-RN-06 mantém `solicitacoes` por causa do UC-52). Vazaria a estrutura de custos. |
| (v1.3) Reutilizar `financeiro` como subcoleção aninhada `financeiro/custo_hora/procedimentos/{solicitacaoId}` | Vantagem real: fica fora do fallback genérico sem ampliar a lista de exclusões (o `collectionId` do bloco genérico seria `financeiro`). Rejeitada porque (1) pendura dados de procedimento num documento de configuração de id fixo, acoplando dois ciclos de vida; (2) o bloco `financeiro/{docId}` já tem leitura do consultor com opt-in — uma evolução futura para `financeiro/{document=**}` (ex.: compartilhar outro documento) exporia os snapshots ao consultor sem ninguém perceber; (3) rules e testes ficam menos legíveis que um bloco dedicado. Continua sendo a alternativa se o usuário preferir não ampliar a lista de exclusões. |
| (v1.3) Gravar os snapshots como documentos irmãos em `financeiro/{solicitacaoId}` | Mistura schemas na mesma coleção; a escrita de `financeiro` exige `compartilhar_com_consultor is bool` e a leitura do consultor com opt-in passaria a valer para os snapshots. |
| (v1.3) Gravar o snapshot dentro da mesma `runTransaction` da solicitação | Atômico, mas uma falha de precificação (rule, rede, dado inválido) derrubaria a reserva/consumo de estoque — contraria P8. |
| (v1.3) Não persistir nada e recalcular sempre no detalhe | Contraria D10: o histórico mudaria a cada alteração de custos fixos. |
| (v1.3) Manter uma única taxa de cartão + flag "cartão sim/não" | Contraria D8 (débito e crédito com taxas diferentes). |
| (v1.3) Material do procedimento pelo custo médio do protocolo (RN-09) | O procedimento já sabe quais lotes serão consumidos; o custo médio só faz sentido antes do cadastro (P6). |
| (v1.3) Seletor de forma de pagamento no detalhe | O detalhe é registro; mostrar as três formas lado a lado (a registrada em destaque) responde à mesma pergunta sem estado de UI (P14). |
| (v1.3 → rejeitada na v1.4) Mês de referência = mês corrente da confirmação | Proposta original do assistente (antiga P12); o usuário escolheu o mês da data do procedimento (D12). |
| (v1.4) Converter o `Timestamp` de `dt_procedimento` para `America/Sao_Paulo` para achar o mês | O valor gravado é meia-noite UTC da data escolhida; em São Paulo isso cai às 21:00 do dia anterior e o dia 1º viraria o mês anterior (RN-31). |
| (v1.4) Gravar só o preço da forma escolhida no snapshot | D13: a forma é informativa e o detalhe mostra sempre os três; gravar os três evita recalcular e mantém o registro completo. |
| (v1.4) Protocolo sem duração continuar sem preço | D11: deve ser considerado 1 hora, com aviso. |

### 4.3 Trade-offs aceitos

- **Mês de referência = relógio do cliente**: um dispositivo com data errada mostra horas do mês errado. Aceito (valor de norte, sem efeito persistido).
- **Feriados ignorados e ocupação 100%**: o custo/hora sai **subestimado** em relação ao real. Aceito pelo usuário; o texto da UI diz que é uma estimativa.
- **Leitura da coleção `inventory` inteira** na listagem de protocolos (para custo médio): mesmo custo de `getHistoricalProducts` já existente; aceitável no volume atual de uma clínica.
- **Auditoria parcial**: mudanças de valores financeiros não deixam rastro (só `updated_by`/`updated_at` do último salvamento); apenas o compartilhamento é auditado.
- **Auditoria best-effort**: se o `writeAuditLog` falhar depois do `setDoc`, o compartilhamento fica salvo sem entrada na trilha (erro só no console). Aceito pelo mesmo critério de `writeAdminAuditLog`.
- **(v1.3) Snapshot best-effort**: um procedimento pode ficar sem snapshot (falha de rede/rule depois da transação). O detalhe cai na estimativa atual, sinalizada (RF-31); se o procedimento estiver agendado, editar e confirmar grava de novo.
- **(v1.3) Snapshot reflete a última confirmação**: sem histórico de versões (P13); editar um agendado recalcula com os custos do mês da edição.
- **(v1.4) Mês do procedimento com a configuração atual** (D12): para um procedimento de outro mês, horas e Boletos Tec são projetados a partir da configuração vigente na confirmação (custos fixos e disponibilidade não têm histórico). Num procedimento efetuado em mês passado, as parcelas de Boleto Tec contam como no mês de referência gravado (`mesesEntre` negativo vira 0 — RN-02).
- **(v1.4) 1 hora padrão pode superestimar ou subestimar** procedimentos de protocolos sem duração; o aviso (diálogo e texto) deixa isso explícito.
- **(v1.3) Lista de exclusões do fallback genérico passa a 3 itens**: mitigado por helper único e teste de rules por subcoleção (Seção 5.4.2).
- **(v1.3) `exists()` na rule de escrita do snapshot**: +1 leitura por gravação (P15), em troca de impedir snapshots órfãos.

### 4.4 Decisões tomadas (09/10/2026, pelo usuário)

| ID | Tema | Decisão |
|----|------|---------|
| D1 | Avanço das parcelas do Boleto Tec | **Automático.** Guarda `mes_referencia` (`'YYYY-MM'`); cada mês posterior assume 1 parcela paga; editar `parcelas_pagas` redefine `mes_referencia` para o mês atual. No mês de referência a parcela conta se `parcelas_pagas < total_parcelas` (ex.: 24 parcelas, 22 pagas em 10/2026 → compõe em out e nov/2026, sai em dez/2026). RN-02. |
| D2 | Feriados | **Não descontados** na v1 (trabalho futuro). RN-03. |
| D3 | Capacidade simultânea | **`min(salas, profissionais)`**. RN-05. |
| D4 | Auditoria | **Auditar somente ligar/desligar o compartilhamento com o consultor** (inclui troca do consultor destinatário). Novo `entity_type: 'financial_config'` e ações `share_with_consultant` / `unshare_with_consultant`. Diverge da recomendação da v1.0 (não auditar nada). RF-19, RN-14, RN-16, Seção 6.2.4. |
| D5 | Visão do consultor | **Totais completos + detalhe só dos itens Rennova**; demais agrupados como "Outros materiais". Compartilhamento **preso ao `consultant_id`** que o recebeu (troca de consultor não herda). RF-20, RN-13, RN-17. |
| D6 | Leitura de `protocolos` pelo consultor (v1.2) | **Somente com o opt-in financeiro ativo para ele**: regra de leitura do consultor em `protocolos` com `get()` em `financeiro/custo_hora`, exigindo `compartilhar_com_consultor == true` e `compartilhado_com_consultant_id == consultant_id` do token (mesma condição do bloco `financeiro`). Decidida pelo usuário em 09/10/2026 como D1 do `ONLY_FOR_DEVS/TO_DO/BUGFIX-consultor-allowlist-subcolecoes.md` (opção B). RN-18, Seção 5.4 e 5.4.1. |
| D7 | (v1.3) Escopo da Fase 2B | **Mesma branch e mesmo spec (v1.3), um único PR para `develop`.** Seção 0, STEP 6. |
| D8 | (v1.3) Taxas de cartão | **Débito e crédito separados.** A aba Custos Fixos troca `cartao_pct` por `debito_pct` e `credito_pct`. No procedimento, forma de pagamento Pix/Dinheiro (sem taxa de cartão no divisor), Débito (`debito_pct`) ou Crédito (`credito_pct`); imposto, comissão e margem sempre entram. RF-21, RF-25, RN-19, RN-20. |
| D9 | (v1.3) Duração no procedimento | **Novo campo "Duração (min)" no cadastro**, pré-preenchido pela duração do protocolo aplicado, editável. Sem duração → só material + aviso (como RN-11). RF-24, RN-24. |
| D10 | (v1.3) Histórico | **Gravar snapshot ao confirmar** (criação e edição): mês de referência, custo/hora, duração, custo/hora aplicado, material (lotes reais), custo real, percentuais, forma de pagamento, divisor e preço sugerido. Procedimentos sem snapshot mostram **estimativa atual**, sinalizada. RF-28 a RF-31, RN-26 a RN-30. |
| D11 | (v1.4) Protocolo sem duração | **Considerado 1 hora (60 min).** No cadastro do procedimento, um diálogo avisa ao aplicar o protocolo; a duração informada no procedimento prevalece. Listagem de protocolos e consultor também precificam com 60 min, com aviso. Texto do usuário: "se um protocolo estiver com tempo vazio, criar um pop-up com o aviso de que o tempo está vazio, portanto, será considerado hora cheia (1h de procedimento). Só será sobrescrito no procedimento caso o procedimento utilize o protocolo em questão e em que outros produtos forem adicionados. Ao criar procedimento e a duração for informada, será essa a duração a ser considerada." Interpretação do assistente: I-1 (Seção 4.5). RF-24, RF-34, RN-11, RN-24. |
| D12 | (v1.4) Mês de referência do procedimento | **Mês da data do procedimento**, com a configuração vigente na confirmação; vale para o snapshot e para a estimativa atual. Substitui a antiga P12. RN-26, RN-31. |
| D13 | (v1.4) Forma de pagamento | **Apenas informativa.** Cadastro (revisão) e detalhe mostram sempre os três preços, cada um com a taxa considerada, destacando a forma escolhida; o snapshot grava os três. Ajusta P4/P14. RF-25, RF-26, RF-30, RN-25, RN-30. |
| D14 | (v1.4) Caderno E2E | **Aceite de termos gravado via Admin SDK dentro de cada spec** (padrão UC-52), sem estender o seed. STEP 4, Seção 8.4. |
| D11 (v1.5) | (v1.5) Respostas à I-1 | **(1)** Confirmado: protocolo sem duração aplicado → 1 h, mesmo que outros produtos sejam adicionados. **(2)** Procedimento **sem protocolo e sem duração informada** também considera 1 h, com o aviso "Duração não informada — considerada 1 hora". **(3)** O campo "Duração (min)" **não** é pré-preenchido com 60 — só o diálogo e o aviso; o cálculo usa 60 por baixo. RF-24, RF-27, RN-24. |
| D15 | (v1.6) Margem única | **Mantida a margem única do markup divisor sobre o custo real inteiro (material + hora clínica).** Alternativa avaliada e descartada em 10/10/2026: margem separada para material e serviço. Motivo: é o modelo praticado pelo mercado; stakeholder de acordo. Consequência conhecida: em procedimentos com muito material, impostos, comissão e margem incidem também sobre os produtos. |
| D16 | (v1.6) Tabela de procedimentos | **`/clinic/requests` ganha as colunas "Custo real" e "Preço sugerido"** (só `clinic_admin`); "Valor Total" passa a se chamar "Material". Fonte: snapshot gravado; sem snapshot, estimativa atual sinalizada como "estimado" (`estimarPrecificacaoProcedimento`, função pura compartilhada com o card do detalhe). O preço exibido é o da forma de pagamento registrada (legado: Pix/Dinheiro). "Valor real" = custo real; não há campo de valor cobrado nesta versão. |

### 4.5 Premissas da Fase 2B (assistente — sujeitas à revisão do usuário)

> P1–P9 vieram do briefing de 09/10/2026; P10–P17 foram propostas pelo assistente. **Revisadas pelo usuário em 09/10/2026 (v1.4):** P1–P3, P5–P9, P11, P13, P15, P16 e P17 confirmadas; P4 e P14 ajustadas por D13; P10 substituída por D11; P12 substituída por D12. A interpretação I-1 foi respondida na v1.5 (abaixo). Observação v1.5: P16 continua valendo, mas a edição reabre o campo de duração vazio quando o procedimento usou a hora padrão.

| ID | Premissa | Onde se aplica |
|----|----------|----------------|
| P1 | Nenhum valor derivado dos custos fixos no documento da solicitação; snapshot em `precificacao_procedimentos`, só `clinic_admin` (4.1 item 11, 4.2). `duracao_minutos` e `forma_pagamento` ficam na solicitação (4.1 item 12). Consultor com opt-in financeiro **não** lê snapshots na v1.3 (a tela do consultor não mostra procedimentos). | RN-28, RNF-08, 5.4.2 |
| P2 | Documentos com `cartao_pct` são lidos como débito = crédito = `cartao_pct`; `cartao_pct` some no próximo "Salvar" (efeito do `setDoc` sem merge). | RN-21 |
| P3 | Listagem de protocolos e tela do consultor mostram dois preços (Pix/Dinheiro e Crédito); o resumo mostra os três divisores. | RF-23 |
| P4 | (ajustada v1.4, D13) Forma de pagamento padrão Pix/Dinheiro, selecionável no passo 1, visível na revisão; apenas informativa — trocar só muda o destaque, os três preços aparecem sempre. | RF-25, RN-25 |
| P5 | Preço sugerido no procedimento só para `clinic_admin`; `clinic_user` não carrega `financeiro` nem snapshot (o cadastro já é admin-only; o detalhe precisa do gate). | RF-32 |
| P6 | Material do procedimento = lotes efetivamente selecionados, não custo médio do protocolo. | RN-22 |
| P7 | Sem config (ou custo/hora/divisor indefinidos) → só material + CTA para Custos Fixos. | RF-27 |
| P8 | Snapshot best-effort, com toast de aviso; a solicitação nunca deixa de ser gravada por causa da precificação. | RF-29, RN-29 |
| P9 | `cancelada`/`reprovada` (e `concluida`) mantêm o snapshot, sem recálculo. | RN-27 |
| P10 | ~~Ao aplicar protocolo, a duração só é preenchida se o campo estiver vazio~~ — **substituída por D11 / RN-24** (v1.4). O preenchimento "só se vazio" e o botão X sem efeito na duração continuam valendo. | RN-24 |
| P11 | Sem documento `financeiro/custo_hora` (ou leitura com erro) → nenhum snapshot é gravado; o detalhe mostra CTA ou, depois que a clínica configurar, estimativa atual. | RN-26 |
| P12 | ~~Mês de referência do snapshot = mês corrente da confirmação~~ — **substituída por D12** (v1.4): mês da data do procedimento. | RN-26, RN-31 |
| P13 | Edição sobrescreve o snapshot (sem histórico de versões); `origem` e `gravado_em` registram a última confirmação. | RN-27 |
| P14 | (ajustada v1.4, D13) Cadastro (revisão) e detalhe mostram as três formas lado a lado, cada uma com a taxa considerada e a escolhida em destaque; o detalhe não tem seletor. | RF-26, RF-30, RN-30 |
| P15 | A rule de escrita do snapshot exige que a solicitação exista (`exists()`), ao custo de +1 leitura por gravação. | RN-28 |
| P16 | Na edição, duração e forma vêm da solicitação (query string do redirect de `requests/[id]/edit`); protocolos não são recarregados (o seletor de protocolo continua oculto na edição, como hoje). | RF-33 |
| P17 | O snapshot é gravado mesmo com duração ausente ou custo/hora/divisor indefinidos (campos `null`), desde que a config exista — o registro mostra o que o admin viu ao confirmar. | RN-26 |

**I-1 — Interpretação do assistente sobre D11 — resolvida pelo usuário em 09/10/2026 (v1.5).** A frase "Só será sobrescrito no procedimento caso o procedimento utilize o protocolo em questão e em que outros produtos forem adicionados" foi lida como: a duração padrão de 1 hora de um protocolo sem duração vale para o procedimento que usa esse protocolo, **mesmo que outros produtos sejam adicionados**; só a duração digitada no procedimento a substitui. Respostas:
1. Leitura correta — **confirmada**.
2. Sem protocolo e sem duração informada → **também 1 hora**, com o aviso "Duração não informada — considerada 1 hora" (o antigo caso (d) deixa de existir).
3. O 60 **não** é preenchido no campo — só o diálogo e o aviso; o cálculo usa 60 por baixo.

Consequências registradas em RN-24 (inclui a decisão do assistente sobre o que a solicitação e o snapshot gravam).

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
| `src/lib/services/precificacaoProcedimentoService.ts` | Service | (v1.3) `getPrecificacaoProcedimento`, `salvarPrecificacaoProcedimento` (Seção 6.2.8). |
| `src/components/pricing/ProcedimentoPrecificacao.tsx` | Componente | (v1.3) Bloco de preço sugerido do procedimento — cadastro (ao vivo), revisão e detalhe (snapshot/estimativa). |
| `src/components/pricing/FormaPagamentoSelector.tsx` | Componente | (v1.3) Seletor Pix/Dinheiro · Débito · Crédito (3 botões, mesmo padrão visual do seletor "Tipo de Procedimento"). |

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
| `src/types/index.ts` (v1.3) | `ParametrosMarkup`: `cartao_pct` → `debito_pct` + `credito_pct`; novos `FormaPagamento`, `ParametrosMarkupLegado`, `PrecificacaoProcedimento`; `Solicitacao` ganha `duracao_minutos?` e `forma_pagamento?` (Seção 6.1.1). |
| `src/lib/precificacao.ts` (v1.3) | Funções novas/alteradas da Seção 6.2.5; `ResumoCustoHora.divisor` → `divisores`; `PrecificacaoProtocolo.precoSugerido` → `precosSugeridos`; `calcularDivisorMarkup` removida (substituída por `calcularDivisoresMarkup`). |
| `src/__tests__/precificacao.test.ts` (v1.3) | Fixtures `cartao_pct` → `debito_pct`/`credito_pct`; cenários novos (Seção 8.1.1). |
| `src/lib/services/custoHoraService.ts` (v1.3) | `getCustoHoraConfig` aplica `normalizarCustoHoraConfig` (RN-21). |
| `src/components/clinic/FixedCostsTab.tsx` (v1.3) | `MARKUP_CAMPOS` com Débito/Crédito; soma exibida = soma da forma mais cara; validação RN-20. |
| `src/components/pricing/CustoHoraResumo.tsx` (v1.3) | Card "Divisor de markup" → "Divisores de markup" (Pix/Dinheiro, Débito, Crédito). |
| `src/components/pricing/ProtocoloPrecificacao.tsx` (v1.3) | Dois preços (Pix/Dinheiro e Crédito) no lugar de um; grid `sm:grid-cols-6`. |
| `src/app/(clinic)/clinic/protocolos/page.tsx` (v1.3) | Passa `divisores` a `calcularPrecificacaoProtocolo`; `precificacaoIndisponivel` checa `resumo.divisores.pix_dinheiro`. |
| `src/app/(consultant)/consultant/clinics/[tenantId]/pricing/page.tsx` (v1.3) | Linha "Taxa de cartão" → "Taxa de débito" e "Taxa de crédito"; dois preços por protocolo. |
| `src/lib/services/solicitacaoService.ts` (v1.3) | Inputs de criação/edição com `duracao_minutos`/`forma_pagamento`; retornos com `produtosSolicitados` (Seção 6.2.7). |
| `src/app/(clinic)/clinic/requests/new/page.tsx` (v1.3) | Duração, forma de pagamento, bloco de preço e gravação do snapshot (Seção 6.3.6). |
| `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx` (v1.3) | Query string ganha `duracaoMinutos` e `formaPagamento` (Seção 6.3.8). |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx` (v1.3) | Duração/forma no card "Detalhes do Procedimento"; card "Preço sugerido" (snapshot ou estimativa) só para `clinic_admin` (Seção 6.3.7). |
| `firestore.rules` (v1.3) | Helper `isRestrictedTenantCollection`; bloco `precificacao_procedimentos` (Seção 5.4.2). |
| `tests/rules/firestore-tenant-subcollections.test.ts` (v1.3) | `describe('tenants/{tenantId}/precificacao_procedimentos')` (Seção 8.2.1). |

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
| `tenants/{tenantId}/financeiro/custo_hora` (v1.3) | Schema de `markup` muda | `cartao_pct` → `debito_pct` + `credito_pct`. Sem migração: a leitura normaliza (RN-21); o próximo "Salvar" grava o formato novo. Rules inalteradas (não validam `markup`). |
| `tenants/{tenantId}/solicitacoes/{id}` (v1.3) | Campos novos opcionais | `duracao_minutos?: number` (1..1440) e `forma_pagamento?: 'pix_dinheiro' \| 'debito' \| 'credito'`. Legados sem os campos continuam válidos. Rule de escrita inalterada (já só `clinic_admin`). |
| `tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId}` (v1.3) | Criar (1 documento por solicitação) | Schema `PrecificacaoProcedimento` (Seção 6.1.1). Excluída do fallback genérico; bloco dedicado só `clinic_admin` (Seção 5.4.2). Sem índice (só `getDoc` por id). |

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

#### 5.4.2 (v1.3) Rules de `precificacao_procedimentos`

Helper novo junto aos demais, usado no bloco genérico:

```js
// Subcoleções do tenant com leitura restrita por bloco dedicado — ficam fora
// do fallback de leitura genérico. Toda subcoleção com dado financeiro
// interno entra aqui (FEAT-precificacao-hora-clinica v1.3).
function isRestrictedTenantCollection(collectionId) {
  return collectionId in ['nf_imports', 'financeiro', 'precificacao_procedimentos'];
}

match /tenants/{tenantId}/{collectionId}/{document=**} {
  allow read, write: if isSystemAdmin();
  allow read: if belongsToTenant(tenantId) && !isRestrictedTenantCollection(collectionId);
  // Linha do consultor: ver convivência com a allowlist abaixo.
  allow read: if consultantHasAccess(tenantId) && !isRestrictedTenantCollection(collectionId);
}
```

```js
// precificacao_procedimentos — snapshot da precificação de cada procedimento
// (FEAT-precificacao-hora-clinica v1.3, D10). Id do documento = id da
// solicitação. Dado financeiro interno: leitura E escrita só clinic_admin;
// clinic_user e consultor (mesmo com opt-in financeiro) NÃO leem. A
// solicitação continua legível por clinic_user/consultor e por isso não
// guarda nenhum destes valores. Delete só via system_admin (bloco genérico).
match /tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId} {
  allow read: if belongsToTenant(tenantId) && hasRole('clinic_admin');
  allow create, update: if belongsToTenant(tenantId) && hasRole('clinic_admin')
    && request.resource.data.tenant_id == tenantId
    && request.resource.data.solicitacao_id == solicitacaoId
    && request.resource.data.forma_pagamento in ['pix_dinheiro', 'debito', 'credito']
    && exists(/databases/$(database)/documents/tenants/$(tenantId)/solicitacoes/$(solicitacaoId));
}
```

**Convivência com `BUGFIX-consultor-allowlist-subcolecoes` (UC-48-RN-06)** — mesma lógica da Seção 5.4.1:

- **Bugfix já em `develop`:** a linha do consultor é a allowlist (`inventory`, `stock_limits`, `solicitacoes`) — **não** trocá-la por `!isRestrictedTenantCollection(...)`; `precificacao_procedimentos` já fica fora por construção. Aplicar o helper só na linha de `belongsToTenant`.
- **Esta feature primeiro:** as duas linhas usam o helper. Quando o bugfix entrar, troca só a linha do consultor pela allowlist e mantém o helper na linha de `belongsToTenant`. O `BUGFIX-consultor-allowlist-subcolecoes.md` hoje descreve a exclusão como `!(collectionId in ['nf_imports', 'financeiro'])`; recomenda-se atualizá-lo para citar o helper (fora do escopo desta task — registrar no PR).
- Em qualquer ordem, o consultor **não** lê `precificacao_procedimentos`: com blocklist, pelo helper; com allowlist, por não estar na lista; e o bloco dedicado não tem regra de consultor.

### 5.5 O que NÃO muda

- `costingService.ts`, relatórios UC-47/UC-51 e a tela `/clinic/reports` (Fase 3).
- (v1.2) ~~Fluxo de solicitações (`requests/new`, `solicitacaoService.ts`) — a duração do protocolo não é copiada para a solicitação~~ — **revogado na v1.3** (Fase 2B). Continuam inalterados na v1.3: transições de status (`updateSolicitacaoStatus`), reserva/consumo FEFO e `inventory_activity`, `validateInventoryAvailability`, listagem `/clinic/requests`, `getSolicitacoesStats`/`getUpcomingProcedures` e a projeção do consultor (UC-52), que lê `solicitacoes` e ignora os campos novos.
- (v1.3) Rules de `solicitacoes`, `financeiro` e `protocolos`; `costingService.ts`/UC-51 (o snapshot fica disponível para a Fase 3, sem integração agora).
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

#### 6.1.1 (v1.3) Fase 2B — markup por forma de pagamento, solicitação e snapshot

```ts
// Antes (v1.2)
export interface ParametrosMarkup {
  imposto_pct: number;
  cartao_pct: number;
  comissao_pct: number;
  margem_pct: number;
}

// Depois (v1.3)
export type FormaPagamento = 'pix_dinheiro' | 'debito' | 'credito';

export interface ParametrosMarkup {
  imposto_pct: number; // 0..100
  debito_pct: number; // taxa da adquirente no débito
  credito_pct: number; // taxa da adquirente no crédito
  comissao_pct: number;
  margem_pct: number;
}

/** Formato gravado até a v1.2 — só para leitura/normalização (RN-21). */
export interface ParametrosMarkupLegado {
  imposto_pct: number;
  cartao_pct: number;
  comissao_pct: number;
  margem_pct: number;
}
```

`criarConfigPadrao`: `markup: { imposto_pct: 0, debito_pct: 0, credito_pct: 0, comissao_pct: 0, margem_pct: 0 }`.

`Solicitacao` — campos novos (opcionais; legados não têm):

```ts
export interface Solicitacao {
  // ...mesmos campos
  duracao_minutos?: number; // inteiro 1..1440; v1.5: só o valor do campo (digitado ou do protocolo); ausente = campo vazio → efetiva 60 (RN-24)
  forma_pagamento?: FormaPagamento; // ausente = legado, tratado como 'pix_dinheiro' (RN-25)
}
```

Snapshot (novo):

```ts
/** tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId} — só clinic_admin (RN-28) */
export interface PrecificacaoProcedimento {
  tenant_id: string;
  solicitacao_id: string; // = id do documento
  mes_referencia: string; // 'YYYY-MM' — mês da data do procedimento (D12, RN-31)
  custo_hora: number | null; // custo/hora desse mês; null = disponibilidade não configurada (RN-07)
  duracao_minutos: number; // v1.5 — duração efetiva, sempre número (RN-24)
  duracao_origem: 'informada' | 'protocolo' | 'padrao'; // v1.5 — 'padrao' = sem duração no campo nem no protocolo → 60 min
  custo_hora_aplicado: number | null;
  custo_material: number; // Σ quantidade × valor_unitario dos produtos_solicitados gravados (RN-22)
  custo_material_incompleto: boolean;
  custo_real: number | null;
  markup: ParametrosMarkup; // cópia normalizada dos percentuais usados
  forma_pagamento: FormaPagamento; // apenas informativa (D13) — define o destaque
  divisores: Record<FormaPagamento, number | null>; // v1.4 — os três; null = markup inválido
  precos_sugeridos: Record<FormaPagamento, number | null>; // v1.4 — os três preços (D13)
  origem: 'criacao' | 'edicao';
  gravado_em: Timestamp;
  gravado_por: string; // uid do clinic_admin
}
```

Tipos exportados por `src/lib/precificacao.ts` que mudam:

```ts
// ResumoCustoHora — antes: divisor: number | null
export interface ResumoCustoHora {
  mesReferencia: string;
  custoFixo: CustoFixoMensal;
  horasMes: number;
  capacidade: number;
  custoHora: number | null;
  divisores: Record<FormaPagamento, number | null>; // v1.3
}

// PrecificacaoProtocolo — antes: precoSugerido: number | null
export interface PrecificacaoProtocolo {
  custoMaterial: CustoMaterialProtocolo;
  custoHoraAplicado: number | null;
  custoReal: number | null;
  precosSugeridos: Record<FormaPagamento, number | null>; // v1.3
  duracaoConsiderada: number; // v1.4 — duracao_minutos do protocolo ou DURACAO_PADRAO_MINUTOS
  duracaoPadrao: boolean; // v1.4 — true quando o protocolo não tem duração (D11)
}
```

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

#### 6.2.5 (v1.3) `src/lib/precificacao.ts` — funções novas/alteradas (puras)

```ts
export const FORMAS_PAGAMENTO: { key: FormaPagamento; label: string }[] = [
  { key: 'pix_dinheiro', label: 'Pix/Dinheiro' },
  { key: 'debito', label: 'Débito' },
  { key: 'credito', label: 'Crédito' },
];

/** Query string / documento legado → forma válida; qualquer outro valor → 'pix_dinheiro' (RN-25). */
export function parseFormaPagamento(valor: unknown): FormaPagamento;

/** RN-21. Aceita v1.2 (cartao_pct) ou v1.3; devolve SÓ os 5 campos novos; inválido → 0. */
export function normalizarParametrosMarkup(markup: unknown): ParametrosMarkup;

/** Aplica normalizarParametrosMarkup em config.markup; demais campos intactos. */
export function normalizarCustoHoraConfig<T extends { markup: unknown }>(
  config: T
): Omit<T, 'markup'> & { markup: ParametrosMarkup };

/** 0 (pix_dinheiro) | debito_pct | credito_pct */
export function taxaPagamentoPct(m: ParametrosMarkup, forma: FormaPagamento): number;

/** ALTERADA (RN-20): valida os 5 campos e imposto + max(debito, credito) + comissao + margem < 100. */
export function validarParametrosMarkup(m: ParametrosMarkup): string | null;

/** RN-19; null se validarParametrosMarkup(m) !== null. */
export function calcularDivisorPorFormaPagamento(
  m: ParametrosMarkup,
  forma: FormaPagamento
): number | null;

/** Substitui calcularDivisorMarkup (removida). */
export function calcularDivisoresMarkup(m: ParametrosMarkup): Record<FormaPagamento, number | null>;

/** ALTERADA: resumo.divisores = calcularDivisoresMarkup(config.markup). */
export function calcularResumoCustoHora(config: CustoHoraConfigBase, mesCalculo: string): ResumoCustoHora;

/** Extraída de calcularPrecificacaoProtocolo; null se duração ausente/≤ 0 ou custoHora null. */
export function calcularCustoHoraAplicado(
  custoHora: number | null,
  duracaoMinutos?: number | null
): number | null;

/** v1.4 (D11): duração considerada quando o protocolo não tem duracao_minutos. */
export const DURACAO_PADRAO_MINUTOS = 60;

/**
 * ALTERADA: recebe `divisores` (em vez de `divisor`) e devolve `precosSugeridos`.
 * v1.4: sem duracaoMinutos válida usa DURACAO_PADRAO_MINUTOS e marca duracaoPadrao = true.
 */
export function calcularPrecificacaoProtocolo(params: {
  duracaoMinutos?: number;
  custoHora: number | null;
  divisores: Record<FormaPagamento, number | null>;
  custoMaterial: CustoMaterialProtocolo;
}): PrecificacaoProtocolo;

// --- Procedimento (RN-22, RN-23, RN-24, RN-31)

/** v1.5 — RN-24 (a)–(c). Nunca devolve null: sem duração no campo nem no protocolo → { 60, 'padrao' }. */
export function resolverDuracaoProcedimento(params: {
  duracaoInformada: number | null;
  protocoloAplicado: { duracao_minutos?: number } | null;
}): { minutos: number; origem: 'informada' | 'protocolo' | 'padrao' };

/**
 * v1.4 — RN-31. String 'YYYY-MM-DD' do formulário → 'YYYY-MM' (slice);
 * Date vindo do Timestamp gravado → toISOString().slice(0, 7) (UTC, ver RN-31).
 */
export function mesReferenciaDoProcedimento(data: string | Date): string;
export interface CustoMaterialSolicitacao {
  total: number;
  incompleto: boolean;
}
export function calcularCustoMaterialSolicitacao(
  produtos: { quantidade: number; valor_unitario: unknown }[]
): CustoMaterialSolicitacao;

export interface PrecificacaoProcedimentoCalculada {
  custoMaterial: CustoMaterialSolicitacao;
  duracaoMinutos: number | null;
  custoHoraAplicado: number | null;
  custoReal: number | null;
  precos: Record<FormaPagamento, number | null>;
}
export function calcularPrecificacaoProcedimento(params: {
  duracaoMinutos?: number | null;
  custoHora: number | null;
  divisores: Record<FormaPagamento, number | null>;
  custoMaterial: CustoMaterialSolicitacao;
}): PrecificacaoProcedimentoCalculada;

// --- Snapshot (RN-26, RN-30)
export function montarSnapshotPrecificacao(params: {
  tenantId: string;
  solicitacaoId: string;
  config: CustoHoraConfigBase; // já normalizada
  mesReferencia: string; // v1.4: mesReferenciaDoProcedimento(dtProcedimento)
  duracaoMinutos: number; // v1.5 — duração efetiva (resolverDuracaoProcedimento), sempre número
  duracaoOrigem: 'informada' | 'protocolo' | 'padrao';
  formaPagamento: FormaPagamento;
  produtos: { quantidade: number; valor_unitario: unknown }[]; // produtos_solicitados devolvidos pelo service
  origem: 'criacao' | 'edicao';
}): Omit<PrecificacaoProcedimento, 'gravado_em' | 'gravado_por'>;
//  Usa calcularResumoCustoHora(config, mesReferencia) e calcularPrecificacaoProcedimento;
//  v1.4: grava divisores e precos_sugeridos das três formas; markup = cópia de config.markup.
```

`calcularPrecosDoSnapshot` (v1.3) **não é mais necessária** na v1.4 — o snapshot já grava os três preços.

Todas sem import de Firebase (RNF-03). Com a remoção de `calcularDivisorMarkup`, todos os chamadores passam a `calcularDivisoresMarkup`/`resumo.divisores`.

#### 6.2.6 (v1.3) `src/lib/services/custoHoraService.ts`

- `getCustoHoraConfig`: `return snap.exists() ? normalizarCustoHoraConfig(snap.data() as CustoHoraConfig) : null;` — vale para a aba do admin, a listagem de protocolos, o consultor e as telas de procedimento.
- `saveCustoHoraConfig`: sem mudança de assinatura; como `input.markup` já vem normalizado (via `extrairConfigInput` do config lido) e o `setDoc` sobrescreve o documento, `cartao_pct` desaparece no primeiro save (RN-21).

#### 6.2.7 (v1.3) `src/lib/services/solicitacaoService.ts`

```ts
export interface CreateSolicitacaoInput {
  // ...campos atuais
  duracao_minutos?: number;
  forma_pagamento?: FormaPagamento;
}
export interface CreateSolicitacaoEfetuadaInput {
  // ...campos atuais
  duracao_minutos?: number;
  forma_pagamento?: FormaPagamento;
}

// createSolicitacaoWithConsumption / createSolicitacaoEfetuada — o retorno ganha:
//   produtosSolicitados?: ProdutoSolicitado[] // = produtosDetalhados gravados na transação
// Os dois campos novos entram em solicitacaoData (removeUndefined já descarta ausentes).

// updateSolicitacaoAgendada — `updates` ganha:
//   duracao_minutos?: number | null // null → deleteField() (o admin apagou a duração)
//   forma_pagamento?: FormaPagamento
// aplicados nos DOIS ramos (com e sem `updates.produtos`); o retorno ganha
//   produtosSolicitados?: ProdutoSolicitado[] // produtosDetalhados, ou solicitacao.produtos_solicitados no ramo sem produtos
```

Nenhum valor financeiro derivado (custo/hora, preço, percentuais) entra nestas funções (RNF-08). `SolicitacaoWithDetails` herda os campos novos de `Solicitacao` sem mudança em `getSolicitacao`/`listSolicitacoes`.

#### 6.2.8 (v1.3) `src/lib/services/precificacaoProcedimentoService.ts` (a criar)

```ts
const ref = (tenantId: string, solicitacaoId: string) =>
  doc(db, 'tenants', tenantId, 'precificacao_procedimentos', solicitacaoId);

export async function getPrecificacaoProcedimento(
  tenantId: string,
  solicitacaoId: string
): Promise<PrecificacaoProcedimento | null>;
//  getDoc; inexistente → null; `markup` passa por normalizarParametrosMarkup (robustez).
//  Erros são propagados (a tela só chama para clinic_admin).

export async function salvarPrecificacaoProcedimento(
  tenantId: string,
  userId: string,
  snapshot: Omit<PrecificacaoProcedimento, 'gravado_em' | 'gravado_por'>
): Promise<void>;
//  setDoc (sobrescreve — RN-27) com gravado_em = Timestamp.now(), gravado_por = userId.
//  NÃO captura erro: quem chama (requests/new) aplica o best-effort (RN-29).
```

Multi-tenant: `tenantId` sempre de `claims.tenant_id`; isolamento real nas rules (Seção 5.4.2).

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

#### 6.3.5 (v1.3) Custos Fixos, resumo, listagem de protocolos e consultor

- **`FixedCostsTab`**: `MARKUP_CAMPOS` = Imposto (%), Taxa de débito (%), Taxa de crédito (%), Comissão (%), Margem desejada (%). Ajuda: "Pix/Dinheiro não paga taxa de cartão; débito e crédito usam a taxa da maquininha." A soma exibida passa a ser `imposto + max(débito, crédito) + comissão + margem`, com o rótulo "Soma (forma mais cara)"; erro de RN-20 inline.
- **`CustoHoraResumo`**: card "Divisores de markup" — `Pix/Dinheiro 0,64 · Débito 0,62 · Crédito 0,60` (cada um `—` se `null`); legenda "Preço = custo real ÷ divisor da forma de pagamento".
- **`ProtocoloPrecificacao`**: "Preço sugerido" vira dois valores, **"Pix/Dinheiro"** e **"Crédito"** (ambos em destaque); grid `sm:grid-cols-6`. Débito não aparece na listagem (P3). O exemplo "Preço sugerido: R$ 1.562,40" da Seção 6.3.3 vale para a v1.2; os valores v1.3 estão na Seção 8.1.1 e no STEP 4.
- **Listagem `/clinic/protocolos`**: CTA quando `config == null || resumo.custoHora == null || resumo.divisores.pix_dinheiro == null` (com markup válido os três divisores existem).
- **Consultor `/pricing`**: card de markup mostra Imposto, Taxa de débito, Taxa de crédito, Comissão e Margem; protocolos com os dois preços.
- **(v1.4, D11) Protocolo sem duração** (listagem e consultor): `ProtocoloPrecificacao` mostra "Duração: 60 min (padrão)" e o aviso "Duração não informada — considerada 1 hora" no lugar de "Informe a duração para calcular o preço"; os preços passam a aparecer.

#### 6.3.6 (v1.3) Cadastro/edição do procedimento (`requests/new/page.tsx`)

Estado novo: `duracaoTexto: string` (input), `formaPagamento: FormaPagamento` (padrão `'pix_dinheiro'`), `custoConfig: CustoHoraConfig | null`, `custoConfigStatus: 'carregando' | 'ok' | 'erro'`.

- **Carga**: com `tenantId` e `claims.role === 'clinic_admin'`, `getCustoHoraConfig(tenantId)` em paralelo com o inventário (criação **e** edição). Erro → `custoConfigStatus = 'erro'`, `console.error`, o bloco mostra só material + "Não foi possível carregar os custos fixos." (sem toast).
- **Passo 1 — card "Dados do Procedimento"**: depois de "Data do Procedimento", campo **"Duração (min)"** (`Input type="number" min=1 max=1440 step=1`, placeholder "Ex: 60", ajuda "Usada para calcular o custo da hora clínica"). Abaixo, **"Forma de pagamento"** com `FormaPagamentoSelector` (3 botões default/outline, como "Tipo de Procedimento").
- **Protocolo** (`handleAplicarProtocolo`, v1.5): guarda `protocoloSelecionado` (já existe). Se `protocolo.duracao_minutos` existe e `duracaoTexto.trim() === ''` → `setDuracaoTexto(String(protocolo.duracao_minutos))`. Se **não** existe → abre o `AlertDialog` de RF-24 (`src/components/ui/alert-dialog.tsx`, só ação "Entendi"); o campo **não** é preenchido (D11 v1.5). O botão X não mexe na duração.
- **Duração efetiva** (v1.5): `duracao = resolverDuracaoProcedimento({ duracaoInformada: valor de parseDuracaoMinutos(duracaoTexto) ou null, protocoloAplicado: protocoloSelecionado })` — sempre número. Alimenta o bloco e o snapshot. Com `origem === 'padrao'`, o bloco mostra "Duração: 60 min (padrão)" e o aviso "Duração não informada — considerada 1 hora", com ou sem protocolo.
- **Mês** (v1.4, D12): `resumo = calcularResumoCustoHora(custoConfig, mesReferenciaDoProcedimento(dtProcedimento))` quando há data; sem data ainda, usa `mesCorrenteSaoPaulo()` só para a prévia, com o texto "Informe a data para calcular com os custos do mês do procedimento".
- **Passo 1 — abaixo da tabela de produtos** (só com produtos): `ProcedimentoPrecificacao` alimentado por `calcularPrecificacaoProcedimento({ duracaoMinutos, custoHora: resumo?.custoHora ?? null, divisores: resumo?.divisores ?? { pix_dinheiro: null, debito: null, credito: null }, custoMaterial: calcularCustoMaterialSolicitacao(produtosSelecionados.map((p) => ({ quantidade: p.quantidade_solicitada, valor_unitario: p.valor_unitario }))) })`, com o `resumo` do item "Mês" acima, memoizado. Mostra: Duração (com "(padrão)" quando `origem === 'padrao'`) · Material · Hora clínica · Custo real · **três preços** — "Pix/Dinheiro (sem taxa de cartão)", "Débito (taxa {debito_pct}%)", "Crédito (taxa {credito_pct}%)" — com a forma escolhida em destaque (v1.4, D13). Avisos: RF-27 (CTA; ou "Duração não informada — considerada 1 hora" quando `origem === 'padrao'`) e "Custo de material incompleto" se algum `valor_unitario` for inválido. Rodapé RNF-07: "Estimativa com base nos custos de {mês/ano do procedimento} — não substitui a contabilidade."
- **`handleIrParaRevisao`**: se `parseDuracaoMinutos(duracaoTexto)` devolver `{ erro }` → toast "Informe uma duração entre 1 e 1440 minutos" e não avança.
- **Passo 2 — revisão**: o card "Dados do Procedimento" ganha "Duração" (`{n} min`, "(padrão — protocolo sem duração)" quando for o caso, ou "—") e "Forma de pagamento"; depois de "Produtos a Consumir", o mesmo `ProcedimentoPrecificacao` (somente leitura) com os três preços.
- **Confirmação** (`submitCreateMode`/`submitEditMode`): envia `duracao_minutos` = valor de `parseDuracaoMinutos(duracaoTexto)` — só o que está no campo (digitado ou vindo do protocolo); omitido quando o campo está vazio (na edição, `null` → `deleteField()`) — e `forma_pagamento`. A duração padrão de 60 min **não** é gravada na solicitação (v1.5). Se `result.success`:
  1. Se `custoConfigStatus === 'ok' && custoConfig !== null` (P11): `try { await salvarPrecificacaoProcedimento(tenantId, user.uid, montarSnapshotPrecificacao({ ..., mesReferencia: mesReferenciaDoProcedimento(dtProcedimento), duracaoMinutos: duracao.minutos, duracaoOrigem: duracao.origem, produtos: result.produtosSolicitados ?? payloadLocal, origem: isEditMode ? 'edicao' : 'criacao' })) } catch (e) { console.error(...); toast({ title: 'Procedimento salvo, mas a precificação não foi registrada', description: 'O detalhe mostrará uma estimativa com os custos atuais.' }) }`.
  2. Toast de sucesso atual + `router.push` para o detalhe (sem mudança).
- **Edição**: lê `duracaoMinutos` e `formaPagamento` da query string (`parseFormaPagamento`) — P16.

#### 6.3.7 (v1.3) Detalhe do procedimento (`requests/[id]/page.tsx`)

- **Card "Detalhes do Procedimento"** (dois roles): + "Duração" (`{n} min` / "—") e "Forma de pagamento" (rótulo de `FORMAS_PAGAMENTO`; ausente → "—"). Não sensíveis (P1).
- **Card "Preço sugerido"** (só `isAdmin`, depois do card "Resumo"): `getPrecificacaoProcedimento(tenantId, id)`; se `null` → `getCustoHoraConfig(tenantId)`.
  - **Com snapshot**: `ProcedimentoPrecificacao` com os valores gravados; os três preços de `precos_sugeridos`, rotulados com as taxas de `markup` gravado, a `forma_pagamento` em destaque com o selo "Forma registrada"; duração com "(padrão)" se `duracao_origem === 'padrao'`. Descrição: "Registrado em {gravado_em dd/mm/aaaa HH:mm} com os custos de {formatarMesReferencia(mes_referencia)}. Mudanças posteriores nos custos fixos não alteram este registro."
  - **Sem snapshot, com config**: `calcularPrecificacaoProcedimento` com `calcularResumoCustoHora(config, mesReferenciaDoProcedimento(solicitacao.dt_procedimento.toDate()))` (D12, RN-31), duração efetiva `resolverDuracaoProcedimento({ duracaoInformada: solicitacao.duracao_minutos ?? null, protocoloAplicado: null })` — ausente → 60 min com o aviso "Duração não informada — considerada 1 hora" (v1.5) — e `parseFormaPagamento(forma_pagamento)` da solicitação e material de `produtos_solicitados`. Selo **"Estimativa atual"** + "Este procedimento não tem precificação registrada. Valores calculados agora com a configuração de custos atual, para {mês/ano do procedimento}."
  - **Sem snapshot e sem config**: só material + CTA "Configure seus custos fixos".
  - Status `cancelada`/`reprovada`: linha extra "Procedimento {cancelado|reprovado} — valores mantidos apenas como referência."
  - Erro de leitura: card com "Não foi possível carregar a precificação." (`console.error`), sem afetar o restante da página.
- **`clinic_user`**: nenhuma chamada a `getPrecificacaoProcedimento`/`getCustoHoraConfig` (o `useEffect` sai cedo se `!isAdmin`), sem card.

#### 6.3.8 (v1.3) Redirect de edição (`requests/[id]/edit/page.tsx`)

`URLSearchParams` ganha `duracaoMinutos: data.duracao_minutos ? String(data.duracao_minutos) : ''` e `formaPagamento: data.forma_pagamento ?? ''`.

### 6.4 Mudanças em API Routes

N/A — nenhuma API route nova ou modificada. Leitura/escrita via client SDK protegidas por `firestore.rules` (Seção 4.1, item 6). **v1.3:** também N/A — snapshot e campos novos da solicitação via client SDK, protegidos pelo bloco dedicado (Seção 5.4.2).

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

### STEP 6 — Fase 2B: preço sugerido no procedimento (v1.3)

> Executar **antes** do STEP 4 (que passa a incluir os roteiros G–M) e do STEP 5. Premissas revisadas pelo usuário em 09/10/2026 (v1.4); interpretação I-1 respondida na v1.5. Sem pendências de decisão.

#### STEP 6.1 — Débito/crédito no markup

**Objetivo:** D8 na configuração: `ParametrosMarkup` com `debito_pct`/`credito_pct`, divisores por forma e leitura de documentos legados.

**Arquivos afetados:**
- `src/types/index.ts` — `FormaPagamento`, `ParametrosMarkup` (v1.3), `ParametrosMarkupLegado`.
- `src/lib/precificacao.ts` — `FORMAS_PAGAMENTO`, `parseFormaPagamento`, `normalizarParametrosMarkup`, `normalizarCustoHoraConfig`, `taxaPagamentoPct`, `calcularDivisorPorFormaPagamento`, `calcularDivisoresMarkup`, `calcularCustoHoraAplicado`; `validarParametrosMarkup`, `calcularResumoCustoHora`, `calcularPrecificacaoProtocolo` e `criarConfigPadrao` alteradas; `calcularDivisorMarkup` removida.
- `src/lib/services/custoHoraService.ts` — normalização em `getCustoHoraConfig`.
- `src/components/clinic/FixedCostsTab.tsx`, `src/components/pricing/CustoHoraResumo.tsx`, `src/components/pricing/ProtocoloPrecificacao.tsx`, `src/app/(clinic)/clinic/protocolos/page.tsx`, `src/app/(consultant)/consultant/clinics/[tenantId]/pricing/page.tsx` — Seção 6.3.5.
- `src/__tests__/precificacao.test.ts` — **só** a troca mecânica das fixtures (`cartao_pct: 3` → `debito_pct: 3, credito_pct: 3`; `divisor` → `divisores.credito`; `precoSugerido` → `precosSugeridos.credito`), para manter o `type-check` (o `tsconfig.json` inclui `**/*.ts`). Os cenários novos ficam no STEP 6.2.

**Ações:**
1. Implementar a parte de markup das Seções 6.1.1 e 6.2.5 e a Seção 6.2.6.
2. Ajustar os chamadores (Seção 6.3.5).
3. Conferir que `grep -rn "cartao_pct" src` só encontra `ParametrosMarkupLegado` e `normalizarParametrosMarkup`.

**Validação:** `npm run lint`, `npm run type-check`, `npm run build` e `npm run test -- precificacao` verdes; a aba Custos Fixos mostra Débito e Crédito; um documento legado (só `cartao_pct`) abre com os dois valores iguais.

**Commit:** `feat(tenant): split card fee into debit and credit rates`

#### STEP 6.2 — Testes do markup por forma

**Objetivo:** Cobrir RN-19, RN-20 e RN-21 (Seção 8.1.1, linhas de markup).

**Arquivos afetados:** `src/__tests__/precificacao.test.ts`.

**Validação:** `npm run test -- precificacao` verde.

**Commit:** `test(tenant): cover payment method divisors and legacy markup`

#### STEP 6.2a — Protocolo sem duração = 1 hora (v1.4)

**Objetivo:** D11 / RF-34 na listagem de protocolos e na tela do consultor.

**Arquivos afetados:**
- `src/lib/precificacao.ts` — `DURACAO_PADRAO_MINUTOS`; `calcularPrecificacaoProtocolo` usa o padrão e devolve `duracaoConsiderada`/`duracaoPadrao`.
- `src/components/pricing/ProtocoloPrecificacao.tsx` — "60 min (padrão)" e aviso "Duração não informada — considerada 1 hora".
- `src/__tests__/precificacao.test.ts` — o cenário existente "sem duração → `null`s" passa a esperar o preço com 60 min (ajuste no mesmo commit, para a suíte não quebrar); cenários novos no STEP 6.4.

**Validação:** `npm run lint`, `type-check`, `build` e `test` verdes; na listagem, P2 (sem duração) mostra preço e o aviso novo.

**Commit:** `feat(tenant): price protocols without duration as one hour`

#### STEP 6.3 — Tipos e funções puras do procedimento

**Objetivo:** `PrecificacaoProcedimento` (com `divisores`, `precos_sugeridos` e `duracao_origem` — v1.4), campos novos de `Solicitacao` e `calcularCustoMaterialSolicitacao`, `calcularPrecificacaoProcedimento`, `resolverDuracaoProcedimento`, `mesReferenciaDoProcedimento`, `montarSnapshotPrecificacao`.

**Arquivos afetados:** `src/types/index.ts`, `src/lib/precificacao.ts`.

**Validação:** `npm run lint` e `npm run type-check` verdes; `grep -n "firebase" src/lib/precificacao.ts` vazio.

**Commit:** `feat(tenant): add procedure pricing pure functions and types`

#### STEP 6.4 — Testes das funções do procedimento

**Objetivo:** Seção 8.1.1, linhas de procedimento e snapshot.

**Arquivos afetados:** `src/__tests__/precificacao.test.ts`.

**Validação:** `npm run test` inteiro verde.

**Commit:** `test(tenant): cover procedure pricing and snapshot builder`

#### STEP 6.5 — Rules de `precificacao_procedimentos`

**Objetivo:** Seção 5.4.2.

**Arquivos afetados:** `firestore.rules`.

**Ações:**
1. Conferir se o `BUGFIX-consultor-allowlist-subcolecoes` já está em `develop` e seguir a convivência da Seção 5.4.2.
2. Criar o helper `isRestrictedTenantCollection` e usá-lo no bloco genérico (linha de `belongsToTenant` sempre; linha do consultor só se ainda for blocklist).
3. Adicionar o bloco `precificacao_procedimentos` com comentário no padrão do arquivo.

**Validação:** STEP 6.6 verde.

**Commit:** `feat(firebase): restrict procedure pricing snapshots to clinic_admin`

#### STEP 6.6 — Testes de rules do snapshot

**Objetivo:** Seção 8.2.1.

**Arquivos afetados:** `tests/rules/firestore-tenant-subcollections.test.ts`.

**Validação:** `npm run test:rules` verde, incluindo a regressão do `describe.each` genérico, `nf_imports`, `financeiro` e D6.

**Commit:** `test(firebase): cover procedure pricing snapshot rules`

#### STEP 6.7 — Services

**Objetivo:** Seções 6.2.7 e 6.2.8.

**Arquivos afetados:** `src/lib/services/solicitacaoService.ts`, `src/lib/services/precificacaoProcedimentoService.ts` (novo).

**Ações:**
1. Campos novos nos inputs e retorno `produtosSolicitados` (criação programada, efetuada e edição — nos dois ramos).
2. `deleteField()` para `duracao_minutos: null` na edição.
3. Criar o service do snapshot, sem `try/catch` interno.

**Validação:** `npm run type-check` e `npm run build` verdes; criar um procedimento pela UI atual (sem os campos novos) continua funcionando.

**Commit:** `feat(tenant): persist procedure duration, payment method and pricing snapshot`

#### STEP 6.8 — Cadastro/edição com preço sugerido

**Objetivo:** RF-24 a RF-29 e RF-33 (Seções 6.3.6 e 6.3.8), incluindo o diálogo de protocolo sem duração (D11), o mês da data do procedimento (D12) e os três preços (D13).

**Arquivos afetados:** `src/app/(clinic)/clinic/requests/new/page.tsx`, `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`, `src/components/pricing/ProcedimentoPrecificacao.tsx` (novo), `src/components/pricing/FormaPagamentoSelector.tsx` (novo).

**Validação:** passos de cadastro dos roteiros G, K e M (STEP 4); a solicitação no Firestore não tem nenhum campo de custo/preço.

**Commit:** `feat(clinic): show suggested price when registering a procedure`

#### STEP 6.9 — Detalhe com snapshot ou estimativa

**Objetivo:** RF-30 a RF-32 (Seção 6.3.7).

**Arquivos afetados:** `src/app/(clinic)/clinic/requests/[id]/page.tsx`.

**Validação:** roteiro G (detalhe), H, I e J; console sem `permission-denied` para `clinic_user`.

**Commit:** `feat(clinic): show recorded suggested price on procedure detail`

### STEP 4 — Validação Manual

**Objetivo:** Validar de ponta a ponta cálculo, isolamento multi-tenant/role e opt-in do consultor, antes de abrir o PR. Esta seção é a fonte do caderno Playwright gerado pelo `qa-agent` (CLAUDE.md, regra 8).

**Pré-requisitos:**
- Firebase Emulator Suite semeado (`npm run test:e2e:seed`) — usuários de `tests/e2e/fixtures/seed-data.ts`: `clinicAdminA`, `clinicUserA`, `clinicAdminB`, `consultant` (com `authorized_tenants: ['test-clinic-a']`, `consultant_id: 'qa-consultant'`), `consultantB`.
- Data do navegador fixada em **15/10/2026** (no Playwright: `page.clock.setFixedTime(new Date('2026-10-15T12:00:00-03:00'))`).
- `test-clinic-a` já é semeado com `consultant_id: 'qa-consultant'` (`scripts/seed-emulator.ts`), então o consultor vinculado aparece no switch de compartilhamento. **Correção v1.3:** isso **não** significa que o seed dispensa extensão. O seed só grava aceite dos documentos legais para `systemAdmin`, `clinicAdminA` e `consultantB` (`usersWithFullAcceptance`); `clinicUserA`, `clinicAdminB` e `consultant` ficam presos em `/accept-terms` (`TermsInterceptor`) ao logar pela UI. Os roteiros que logam com eles (E com `clinicUserA` e `clinicAdminB`; F com `consultant`; J com `clinicUserA`) gravam o aceite via Admin SDK **dentro do próprio spec**, no `beforeAll` — `user_document_acceptances/{uid}_{docId}` para cada documento de `TEST_LEGAL_DOCUMENTS`, padrão de `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts` (linhas 85–95). **Decisão do usuário (D14, v1.4): não estender o seed** (`usersWithFullAcceptance` continua como está, preservando a premissa do UC-09). `consultantB` já tem aceite, mas não serve para o roteiro F (não tem `test-clinic-a` em `authorized_tenants`), só para o passo 9 dele.
- Dados semeados por teste via Admin SDK (`getEmulatorAdminFirestore()`, padrão do `UC-51-*.spec.ts`), removidos em `finally`:
  - `tenants/test-clinic-a/inventory`: produto `9990001` "Produto Teste Rennova" `brand: 'Rennova'`, dois lotes ativos: L1 `quantidade_disponivel: 10`, `valor_unitario: 100`; L2 `quantidade_disponivel: 30`, `valor_unitario: 120` (custo médio = R$ 115,00). Produto `9990002` "Material Sem Custo" sem nenhum lote. Produto `9990003` "Material Terceiro" `brand: 'Marca X'`, lote ativo `quantidade_disponivel: 5`, `valor_unitario: 50`.
  - (v1.3) Os lotes também precisam dos campos lidos pelo cadastro de procedimento (`listInventory` + filtro `active && quantidade_disponivel > 0 && dt_validade > agora`): `tenant_id`, `nome_produto`, `lote` (`'L1'`, `'L2'`, `'L3'`), `quantidade_inicial` = disponível, `quantidade_reservada: 0`, `active: true` e `dt_validade` (`Timestamp`): L1 **31/03/2027**, L2 **31/03/2028**, lote L3 de `9990003` 31/12/2027 — assim o FEFO aloca L1 (R$ 100,00) antes de L2.
  - `tenants/test-clinic-a/protocolos`: P1 "Protocolo Exemplo 60min" com item `9990001` × 2 e `duracao_minutos: 60`; P2 "Protocolo Incompleto" com item `9990002` × 1, sem `duracao_minutos`; P3 "Protocolo Misto" com `9990001` × 1 + `9990003` × 2 e `duracao_minutos: 30`.
  - (v1.4) P4 "Protocolo Sem Duração" com item `9990001` × 1, **sem** `duracao_minutos` (D11).

**Roteiro A — Configuração e cálculo do custo/hora (clinic_admin):**
1. Logar como `clinicAdminA` → `/clinic/my-clinic`.
2. **Esperado (UI):** aba "Custos Fixos" visível. Clicar nela → URL contém `?tab=fixed_costs`.
3. **Esperado (UI):** resumo com "Referência: outubro/2026", custo/hora indisponível e mensagem pedindo para configurar disponibilidade (config inexistente).
4. Preencher Aluguel = 30.000,00 (demais 0). Ativar Seg–Sex com período 08:00–12:00 e 13:00–17:00; ativar Sáb com 08:00–12:00. Salas = 1, Profissionais = 1. Markup: Imposto 6, Taxa de débito 2, Taxa de crédito 4, Comissão 0, Margem 30 (v1.3; na v1.2 era Cartão 3).
5. **Esperado (UI, sem salvar):** Total de custos fixos R$ 30.000,00; Horas no mês **196**; Capacidade **1**; Custo da hora **R$ 153,06**; Divisores **Pix/Dinheiro 0,64 · Débito 0,62 · Crédito 0,60**.
6. Clicar "Salvar". **Esperado (UI):** toast "Custos salvos com sucesso".
7. **Esperado (Firestore):** `tenants/test-clinic-a/financeiro/custo_hora` existe com `tenant_id: 'test-clinic-a'`, `custos_fixos_base.aluguel: 30000`, `disponibilidade.sab.periodos` com 1 período, `markup.margem_pct: 30`, `markup.debito_pct: 2`, `markup.credito_pct: 4`, **sem** `markup.cartao_pct`, `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null`, `updated_by: 'qa-clinic-admin-a'`.

**Roteiro B — Validações de formulário:**
1. Na Segunda-feira, adicionar período 11:00–14:00. **Esperado (UI):** erro "Períodos sobrepostos" na linha de Segunda; botão "Salvar" desabilitado. Remover o período.
2. Adicionar período 18:00–17:00. **Esperado (UI):** "O fim deve ser posterior ao início"; "Salvar" desabilitado. Remover.
3. Alterar Comissão para 60 (soma na forma mais cara, crédito: 6+4+60+30 = 100). **Esperado (UI):** "A soma dos percentuais deve ser menor que 100%"; "Salvar" desabilitado; os três divisores exibidos como "—". Voltar Comissão para 0.
4. (v1.3) Alterar Taxa de crédito para 64 (6+64+0+30 = 100). **Esperado (UI):** o mesmo erro, embora a soma no débito (6+2+0+30 = 38) seja válida (RN-20). Voltar Crédito para 4.

**Roteiro C — Boleto Tec e capacidade:**
1. Adicionar Boleto Tec "Laser X": parcela 5.000,00, total 24, pagas 10. **Esperado (UI):** restantes **14**, badge "Compõe o custo"; total de custos fixos **R$ 35.000,00**; custo/hora **R$ 178,57**.
2. Alterar pagas para 24. **Esperado (UI):** restantes **0**, badge "Quitado"; total volta a **R$ 30.000,00**; custo/hora **R$ 153,06**.
3. Alterar Salas para 2 (Profissionais = 1). **Esperado (UI):** capacidade **1**, custo/hora **R$ 153,06** (D3).
4. Alterar Profissionais para 2. **Esperado (UI):** capacidade **2**, custo/hora **R$ 76,53**. Voltar ambos para 1. Salvar.
5. **Esperado (Firestore):** `boletos_tec[0].parcelas_pagas: 24`, `boletos_tec[0].mes_referencia: '2026-10'`.

**Roteiro D — Precificação de protocolos (clinic_admin):**
1. Ir para `/clinic/protocolos`.
2. **Esperado (UI) em P1:** Duração 60 min; Material **R$ 230,00** (2 × 115); Hora clínica **R$ 153,06**; Custo real **R$ 383,06**; Preço sugerido **Pix/Dinheiro R$ 598,53** (383,0612 / 0,64) e **Crédito R$ 638,44** (383,0612 / 0,60).
3. **Esperado (UI) em P3:** Material **R$ 215,00** (115 + 2 × 50), com os dois produtos nomeados; Hora clínica **R$ 76,53**; Custo real **R$ 291,53**; Preço sugerido **Pix/Dinheiro R$ 455,52** e **Crédito R$ 485,88**.
4. **Esperado (UI) em P2:** aviso "Custo de material incompleto" citando "Material Sem Custo". **v1.4 (D11):** Duração "60 min (padrão)", aviso "Duração não informada — considerada 1 hora", Material **R$ 0,00**, Hora clínica **R$ 153,06**, Custo real **R$ 153,06**, Pix/Dinheiro **R$ 239,16** e Crédito **R$ 255,10**.
4a. (v1.4) **Esperado (UI) em P4:** Duração "60 min (padrão)" + o mesmo aviso; Material **R$ 115,00**; Custo real **R$ 268,06**; Pix/Dinheiro **R$ 418,85**; Crédito **R$ 446,77**.
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
8. Logar como `consultant` → `/consultant/clinics/test-clinic-a`. **Esperado (UI):** botão "Ver Precificação" presente → clicar → custo/hora **R$ 153,06**, `ReadOnlyBanner`, nenhum input editável, P1 com preços sugeridos **Pix/Dinheiro R$ 598,53** e **Crédito R$ 638,44** e detalhe "Produto Teste Rennova"; P3 com totais completos (Material **R$ 215,00**, Preços sugeridos **R$ 455,52** / **R$ 485,88**), detalhe mostrando "Produto Teste Rennova" e uma linha "Outros materiais" com **R$ 100,00** — o texto "Material Terceiro" e o código `9990003` **não** aparecem na página. **Esperado (rules):** a listagem de P1–P3 carregou — prova de que o opt-in libera a leitura de `protocolos` (D6/RN-18).
9. Logar como `consultantB` (sem `test-clinic-a` em `authorized_tenants`) → `/consultant/clinics/test-clinic-a/pricing`. **Esperado (UI):** redirecionado para `/consultant/clinics`.
10. `clinicAdminA` desativa o compartilhamento e salva. **Esperado (Firestore):** `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null`. `consultant` recarrega `/consultant/clinics/test-clinic-a/pricing` → estado vazio, sem nomes de protocolos (com a allowlist presente, a leitura de `protocolos` volta a ser negada).
11. **Esperado (Firestore — auditoria):** nova entrada `action: 'unshare_with_consultant'`, `metadata.consultant_id: 'qa-consultant'`.
12. (Troca de consultor, RN-16) Via Admin SDK, gravar `compartilhar_com_consultor: true` e `compartilhado_com_consultant_id: 'qa-consultant-b'` no documento. `clinicAdminA` abre a aba. **Esperado (UI):** switch desligado e aviso "O compartilhamento anterior não vale para o consultor atual". Salvar. **Esperado (Firestore):** `compartilhar_com_consultor: false`, `compartilhado_com_consultant_id: null` e entrada `unshare_with_consultant` com `metadata.motivo: 'troca_de_consultor'`. Antes de salvar, com o documento apontando para `qa-consultant-b`: `consultant` (`qa-consultant`) abre `/consultant/clinics/test-clinic-a/pricing` → estado vazio, sem nomes de protocolos (opt-in de outro `consultant_id` não libera `protocolos` — RN-13/RN-18). Restaurar o documento ao final (`finally`).

**Ordem (v1.3/v1.4):** executar G–M **depois** de A–F — o roteiro G reserva 2 un. do lote L1, o que muda o custo médio usado na listagem de protocolos (roteiros D/F); por isso todo roteiro que reserva estoque termina cancelando o procedimento. Estado esperado no início de G: configuração do roteiro A salva (Aluguel R$ 30.000, Seg–Sex 8 h + Sáb 4 h, 1 sala/1 profissional, Boleto Tec quitado, markup 6/2/4/0/30) e compartilhamento desligado.

**Roteiro G — Cadastro com preço sugerido e snapshot (clinic_admin):**
1. Logar como `clinicAdminA` → `/clinic/requests/new`.
2. **Esperado (UI):** card "Dados do Procedimento" com "Duração (min)" vazio e "Forma de pagamento" com **Pix/Dinheiro** selecionado.
3. Data do Procedimento = **20/10/2026**. Em "Usar Protocolo", selecionar P1 "Protocolo Exemplo 60min". **Esperado (UI):** `9990001` alocado no lote **L1** × 2 a R$ 100,00 (FEFO); "Valor Total" **R$ 200,00**; "Duração (min)" preenchida com **60**; nenhum diálogo; bloco "Preço sugerido (estimativa)": Material **R$ 200,00**, Hora clínica **R$ 153,06**, Custo real **R$ 353,06** e os três preços — **Pix/Dinheiro (sem taxa de cartão) R$ 551,66** em destaque, **Débito (taxa 2%) R$ 569,45**, **Crédito (taxa 4%) R$ 588,44**; rodapé "…custos de outubro/2026". (Material pelo lote real, não pelo custo médio R$ 230,00 da listagem de protocolos — RN-22.)
4. Selecionar **Débito** e depois **Crédito**. **Esperado (UI):** os três valores **não mudam**; só o destaque passa para a forma selecionada (D13).
5. Alterar Duração para **45** → Hora clínica **R$ 114,80**, Custo real **R$ 314,80**, Pix/Dinheiro **R$ 491,87**, Débito **R$ 507,74**, Crédito **R$ 524,66**. Voltar para **60**.
6. Alterar Duração para **0** e clicar "Revisar Procedimento". **Esperado (UI):** toast "Informe uma duração entre 1 e 1440 minutos"; continua no passo 1. Voltar para 60.
7. Tipo "Procedimento Programado" → "Revisar Procedimento". **Esperado (UI):** revisão com Duração **60 min**, Forma de pagamento **Crédito** e o bloco com os três preços (**R$ 551,66 / R$ 569,45 / R$ 588,44**), Crédito em destaque.
8. "Confirmar e Reservar Produtos". **Esperado (UI):** redireciona para `/clinic/requests/{id}`; nenhum toast de aviso de precificação.
9. **Esperado (Firestore — solicitação):** `tenants/test-clinic-a/solicitacoes/{id}` com `duracao_minutos: 60`, `forma_pagamento: 'credito'`, `protocolo_id` de P1 e **nenhum** dos campos `custo_hora`, `custo_real`, `preco_sugerido`, `divisor`, `markup`, `taxa_pagamento_pct`.
10. **Esperado (Firestore — snapshot):** `tenants/test-clinic-a/precificacao_procedimentos/{id}` com `tenant_id: 'test-clinic-a'`, `solicitacao_id: {id}`, `mes_referencia: '2026-10'`, `custo_hora ≈ 153,0612`, `duracao_minutos: 60`, `custo_hora_aplicado ≈ 153,0612`, `duracao_origem: 'protocolo'`, `custo_material: 200`, `custo_material_incompleto: false`, `custo_real ≈ 353,0612`, `markup: { imposto_pct: 6, debito_pct: 2, credito_pct: 4, comissao_pct: 0, margem_pct: 30 }`, `forma_pagamento: 'credito'`, `divisores: { pix_dinheiro: 0.64, debito: 0.62, credito: 0.6 }`, `precos_sugeridos ≈ { pix_dinheiro: 551,6582, debito: 569,4536, credito: 588,4354 }`, `origem: 'criacao'`, `gravado_por: 'qa-clinic-admin-a'`.
11. **Esperado (UI — detalhe):** "Detalhes do Procedimento" com Duração **60 min** e Forma de pagamento **Crédito**; card "Preço sugerido" com Material **R$ 200,00**, Hora clínica **R$ 153,06**, Custo real **R$ 353,06**, **Crédito (taxa 4%) R$ 588,44** em destaque com o selo "Forma registrada", Pix/Dinheiro (sem taxa de cartão) **R$ 551,66**, Débito (taxa 2%) **R$ 569,45** e o texto "…com os custos de outubro/2026"; sem selo "Estimativa atual".
12. (v1.5, D11) Novo procedimento: `/clinic/requests/new`, data 22/10/2026, Duração vazia, aplicar P4 "Protocolo Sem Duração". **Esperado (UI):** diálogo "Protocolo sem duração" com o texto de RF-24 e o botão "Entendi"; após fechar, "Duração (min)" continua **vazio**; bloco com Duração "60 min (padrão)", aviso "Duração não informada — considerada 1 hora", Material **R$ 100,00**, Hora clínica **R$ 153,06**, Custo real **R$ 253,06**, Pix/Dinheiro **R$ 395,41**, Débito **R$ 408,16**, Crédito **R$ 421,77**.
13. Adicionar manualmente `9990003` × 1. **Esperado (UI):** Duração efetiva continua **60 min (padrão)** (D11 — outros produtos não mudam a duração padrão); Material **R$ 150,00**.
14. Alterar Duração para **30**. **Esperado (UI):** Hora clínica **R$ 76,53** e sem o aviso (a duração informada prevalece — RN-24 a). Apagar a Duração. **Esperado (UI):** volta a **60 min (padrão)** com o aviso (RN-24 c). Sair da tela sem confirmar — nada é gravado.
15. (v1.5) Novo procedimento **sem protocolo**: data 22/10/2026, adicionar `9990001` × 2 manualmente (FEFO: L1), Duração vazia. **Esperado (UI):** nenhum diálogo; Duração "60 min (padrão)" com o aviso "Duração não informada — considerada 1 hora"; Material **R$ 200,00**, Custo real **R$ 353,06**, Pix/Dinheiro **R$ 551,66**, Débito **R$ 569,45**, Crédito **R$ 588,44**. Confirmar. **Esperado (Firestore):** solicitação **sem** o campo `duracao_minutos`; snapshot com `duracao_minutos: 60`, `duracao_origem: 'padrao'`, `precos_sugeridos ≈ { 551,6582; 569,4536; 588,4354 }`. **Esperado (UI — edição):** "Editar Procedimento" reabre com "Duração (min)" vazio e o bloco em 60 min (padrão). Cancelar o procedimento ao final (libera L1).

**Roteiro H — Snapshot congelado, edição e estimativa atual:**
1. `clinicAdminA` → Custos Fixos → Aluguel **35.000,00** → Salvar. **Esperado (UI):** custo/hora **R$ 178,57**.
2. Abrir o detalhe do procedimento do roteiro G. **Esperado (UI):** valores **inalterados** (Crédito **R$ 588,44**, Hora clínica **R$ 153,06**) — snapshot congelado.
3. "Editar Procedimento". **Esperado (UI):** Duração **60** e Forma **Crédito** pré-preenchidas (RF-33); bloco recalculado com a configuração atual para outubro/2026: Hora clínica **R$ 178,57**, Custo real **R$ 378,57**, Pix/Dinheiro **R$ 591,52**, Débito **R$ 610,60**, Crédito **R$ 630,95**.
4. Trocar para **Pix/Dinheiro** (valores iguais, só o destaque muda) → Revisar → "Confirmar Alterações".
5. **Esperado (Firestore):** snapshot sobrescrito com `origem: 'edicao'`, `forma_pagamento: 'pix_dinheiro'`, `mes_referencia: '2026-10'`, `custo_hora ≈ 178,5714`, `custo_real ≈ 378,5714`, `precos_sugeridos ≈ { pix_dinheiro: 591,5179, debito: 610,5991, credito: 630,9524 }`; solicitação com `forma_pagamento: 'pix_dinheiro'`. **Esperado (UI — detalhe):** Pix/Dinheiro **R$ 591,52** em destaque; Débito **R$ 610,60**; Crédito **R$ 630,95**.
6. Via Admin SDK, criar `tenants/test-clinic-a/solicitacoes/qa-legado-1` (status `agendada`, `dt_procedimento` 25/10/2026, `produtos_solicitados` com `9990001`/L1 × 1 a `valor_unitario: 100`, `duracao_minutos: 30`, **sem** `forma_pagamento` e **sem** snapshot) e `qa-legado-2` (igual, mas **sem** `duracao_minutos`). Remover os dois no `finally`.
7. Abrir `/clinic/requests/qa-legado-1`. **Esperado (UI):** selo **"Estimativa atual"** + "…para outubro/2026" (mês da data do procedimento); Material **R$ 100,00**, Hora clínica **R$ 89,29**, Custo real **R$ 189,29**, **Pix/Dinheiro R$ 295,76** em destaque (legado = Pix/Dinheiro, RN-25), Débito **R$ 305,30**, Crédito **R$ 315,48**. **Esperado (Firestore):** abrir a tela não cria `precificacao_procedimentos/qa-legado-1`.
8. Abrir `/clinic/requests/qa-legado-2`. **Esperado (UI, v1.5):** selo "Estimativa atual", Duração "60 min (padrão)" com o aviso "Duração não informada — considerada 1 hora", Material **R$ 100,00**, Hora clínica **R$ 178,57**, Custo real **R$ 278,57**, Pix/Dinheiro **R$ 435,27** em destaque, Débito **R$ 449,31**, Crédito **R$ 464,29** (Aluguel 35.000 vigente desde o passo 1).
9. Restaurar Aluguel **30.000,00** (ou o documento `financeiro/custo_hora` original, no `finally`).

**Roteiro I — Cancelamento mantém o snapshot:**
1. No detalhe do procedimento do roteiro G, "Cancelar Procedimento" → confirmar (libera a reserva de L1).
2. **Esperado (Firestore):** `precificacao_procedimentos/{id}` idêntico ao do passo 5 do roteiro H (mesmo `gravado_em`).
3. **Esperado (UI):** card "Preço sugerido" com os valores do snapshot + "Procedimento cancelado — valores mantidos apenas como referência."

**Roteiro J — Isolamento do snapshot:**
1. Gravar o aceite de termos de `clinicUserA` via Admin SDK (pré-requisitos). Logar como `clinicUserA` → `/clinic/requests/{id do roteiro G}`.
2. **Esperado (UI):** Duração e Forma de pagamento visíveis em "Detalhes do Procedimento"; card "Preço sugerido" **ausente**; nenhum texto "Estimativa atual".
3. **Esperado (console / Emulator UI → Firestore → Requests):** nenhuma leitura negada de `financeiro/custo_hora` nem de `precificacao_procedimentos/{id}` disparada pela tela (ela nem tenta).
4. **Esperado (rules, coberto em `npm run test:rules`):** `clinicUserA`, `clinicAdminB` e `consultant` (com e sem opt-in financeiro) recebem `permission-denied` em get e list de `precificacao_procedimentos`.
5. `clinicUserA` → `/clinic/requests/new`. **Esperado (UI):** redirecionado para `/clinic/requests` (comportamento atual, inalterado).

**Roteiro K — Sem configuração de custos:**
1. Via Admin SDK, copiar e apagar `tenants/test-clinic-a/financeiro/custo_hora` (restaurar no `finally`).
2. `clinicAdminA` → `/clinic/requests/new` → aplicar P1 → data 21/10/2026. **Esperado (UI):** Duração **60**; bloco com Material **R$ 200,00** e CTA "Configure seus custos fixos" apontando para `/clinic/my-clinic?tab=fixed_costs`; sem preço.
3. Confirmar. **Esperado (Firestore):** solicitação com `duracao_minutos: 60` e `forma_pagamento: 'pix_dinheiro'`; **nenhum** documento `precificacao_procedimentos/{id}` (P11); nenhum toast de aviso.
4. Abrir o detalhe. **Esperado (UI):** card "Preço sugerido" só com Material **R$ 200,00** + CTA.
5. Restaurar `financeiro/custo_hora` (Aluguel 30.000, markup 6/2/4/0/30) e recarregar o detalhe. **Esperado (UI):** selo **"Estimativa atual"**, Pix/Dinheiro **R$ 551,66** em destaque, Débito **R$ 569,45**, Crédito **R$ 588,44**.
6. Cancelar o procedimento (libera a reserva de L1).
7. **Falha do snapshot (RF-29/RN-29):** não é reproduzível de forma determinística no emulador sem alterar código; fica fora do caderno E2E e é validada por revisão do `try/catch` em `requests/new/page.tsx`.

**Roteiro L — Markup legado (`cartao_pct`):**
1. Conferir que L1 voltou a `quantidade_disponivel: 10` (roteiros I e K cancelaram). Via Admin SDK, gravar `financeiro/custo_hora` com a config do roteiro A, mas `markup: { imposto_pct: 6, cartao_pct: 3, comissao_pct: 0, margem_pct: 30 }` (sem `debito_pct`/`credito_pct`). Restaurar no `finally`.
2. `clinicAdminA` → Custos Fixos. **Esperado (UI):** Taxa de débito **3**, Taxa de crédito **3**; divisores **Pix/Dinheiro 0,64 · Débito 0,61 · Crédito 0,61**.
3. `/clinic/protocolos`. **Esperado (UI) em P1:** Pix/Dinheiro **R$ 598,53** e Crédito **R$ 627,97** (= o preço único da v1.2 — compatibilidade).
4. Clicar "Salvar" sem alterar nada. **Esperado (Firestore):** `markup` = `{ imposto_pct: 6, debito_pct: 3, credito_pct: 3, comissao_pct: 0, margem_pct: 30 }`, **sem** `cartao_pct`.

**Roteiro M — Mês da data do procedimento (v1.4, D12):**
1. Configuração do roteiro A ativa (Aluguel 30.000, markup 6/2/4/0/30). `clinicAdminA` → `/clinic/requests/new`; Data do Procedimento = **05/11/2026**; aplicar P1.
2. **Esperado (UI):** rodapé "…custos de novembro/2026"; Hora clínica **R$ 163,04** (30.000 / 184 h); Material **R$ 200,00**; Custo real **R$ 363,04**; Pix/Dinheiro **R$ 567,26**, Débito **R$ 585,55**, Crédito **R$ 605,07**.
3. Trocar a data para **20/10/2026**. **Esperado (UI):** volta para outubro — Hora clínica **R$ 153,06**, Pix/Dinheiro **R$ 551,66**. Trocar para **01/11/2026** (limite de mês). **Esperado (UI):** novembro/2026, Hora clínica **R$ 163,04** (RN-31 — não pode cair em outubro).
4. Confirmar com 01/11/2026. **Esperado (Firestore):** snapshot com `mes_referencia: '2026-11'`, `custo_hora ≈ 163,0435`, `precos_sugeridos ≈ { pix_dinheiro: 567,2554, debito: 585,5540, credito: 605,0725 }`. **Esperado (UI — detalhe):** "…com os custos de novembro/2026".
5. Cancelar o procedimento (libera a reserva de L1).

**Commit:** N/A (validação manual, não gera commit de código).

### STEP 5 — Documentação de UC

**Objetivo:** Mapear o comportamento novo como UC (próximo número livre: **UC-58**), para que o `qa-agent` tenha o slug do arquivo E2E e para fechar o ciclo da Seção 15 do guia.

**Ações:**
1. Acionar `uml-use-case-writer` para criar `ONLY_FOR_DEVS/PO_BA_Docs/UC-58-precificar-protocolos-pela-hora-clinica.md` (atores: `clinic_admin`, `clinic_consultant` com opt-in) e atualizar UC-20 (campo `duracao_minutos`), UC-48 (botão "Ver Precificação") e UC-53 (RN-10 passa a ter o compartilhamento de dados financeiros como exceção auditada).
   - (v1.3) Incluir no UC-58 o fluxo de preço sugerido no procedimento (forma de pagamento, snapshot, estimativa atual) e atualizar UC-16, UC-17 e UC-18 (duração, forma de pagamento, bloco de preço, snapshot ao confirmar) e UC-19 (concluir/cancelar mantém o snapshot).
2. Atualizar a nota de compatibilidade em `FEAT-relatorio-custo-por-procedimento.md` (Seção 5.2). (v1.3: citar `precificacao_procedimentos` como fonte do custo de hora e do preço sugerido para a Fase 3.)

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

> v1.3: as linhas `validarParametrosMarkup` / `calcularDivisorMarkup`, `calcularResumoCustoHora` e `calcularPrecificacaoProtocolo` acima descrevem a v1.2. Na v1.3 elas são substituídas pelos cenários da Seção 8.1.1 (fixtures com `debito_pct`/`credito_pct`, `divisores`, `precosSugeridos`).

#### 8.1.1 (v1.3) Fase 2B — `src/__tests__/precificacao.test.ts`

Exemplo oficial v1.3 (out/2026, 196 h, custo/hora 30.000 / 196 = 153,0612…): procedimento de 60 min, material R$ 800, markup imposto 6 / débito 2 / crédito 4 / comissão 0 / margem 30.

- Divisores: Pix/Dinheiro `1 − (6 + 0 + 30)/100 = 0,64`; Débito `1 − (6 + 2 + 0 + 30)/100 = 0,62`; Crédito `1 − (6 + 4 + 0 + 30)/100 = 0,60`.
- `custo_hora_aplicado = 153,0612 × 60/60 = 153,0612`; `custo_real = 153,0612 + 800 = 953,0612`.
- Preços: Pix/Dinheiro `953,0612 / 0,64 = 1.489,1582 → R$ 1.489,16`; Débito `953,0612 / 0,62 = 1.537,1955 → R$ 1.537,20`; Crédito `953,0612 / 0,60 = 1.588,4354 → R$ 1.588,44`.

| Função | Cenários obrigatórios |
|--------|----------------------|
| `parseFormaPagamento` | `'pix_dinheiro'`, `'debito'`, `'credito'` → o próprio; `''`, `undefined`, `null`, `'cartao'`, `42` → `'pix_dinheiro'`. |
| `normalizarParametrosMarkup` | v1.3 `{6, 2, 4, 0, 30}` → igual; legado `{ imposto_pct: 6, cartao_pct: 3, comissao_pct: 0, margem_pct: 30 }` → `{ imposto_pct: 6, debito_pct: 3, credito_pct: 3, comissao_pct: 0, margem_pct: 30 }` e `'cartao_pct' in resultado === false`; `cartao_pct: 3` + `debito_pct: 2` + `credito_pct: 4` → 2/4; só `debito_pct: 2` + `cartao_pct: 3` → débito 2, crédito 3; campos ausentes/`NaN`/string → 0; `undefined`/`null` → todos 0. |
| `normalizarCustoHoraConfig` | config legada → só `markup` muda; custos, boletos, disponibilidade e compartilhamento idênticos. |
| `taxaPagamentoPct` | `{6, 2, 4, 0, 30}`: Pix 0, Débito 2, Crédito 4. |
| `validarParametrosMarkup` (v1.3) | `{6, 2, 4, 0, 30}` → `null`; todos 0 → `null`; `{6, 2, 4, 60, 30}` (crédito = 100) → 'A soma dos percentuais deve ser menor que 100%'; `{6, 2, 64, 0, 30}` (crédito = 100, débito = 38) → mesmo erro; `{6, 64, 2, 0, 30}` (débito = 100) → mesmo erro; `debito_pct: -1` → 'Percentuais não podem ser negativos'; `credito_pct: NaN` → 'Informe percentuais válidos'; `{99.99, 0, 0, 0, 0}` → `null`. |
| `calcularDivisorPorFormaPagamento` / `calcularDivisoresMarkup` | exemplo oficial → `{ pix_dinheiro: 0,64, debito: 0,62, credito: 0,60 }` (`toBeCloseTo`); todos 0 → 1/1/1; markup inválido → três `null`; legado normalizado (cartão 3) → 0,64 / 0,61 / 0,61. |
| `calcularResumoCustoHora` (v1.3) | exemplo oficial em `'2026-10'` → `custoHora ≈ 153,06`, `divisores ≈ { 0,64; 0,62; 0,60 }`; config padrão → `custoHora: null`, divisores 1/1/1. |
| `calcularCustoHoraAplicado` | (153,0612, 60) ≈ 153,06; (153,0612, 30) ≈ 76,53; (153,0612, 45) ≈ 114,80; duração `undefined`/`null`/0 → `null`; custoHora `null` → `null`. |
| `calcularPrecificacaoProtocolo` (v1.3/v1.4) | 60 min, custoHora 153,0612, material 800, divisores oficiais → custoReal ≈ 953,06, `precosSugeridos ≈ { pix_dinheiro: 1.489,16, debito: 1.537,20, credito: 1.588,44 }`, `duracaoConsiderada: 60`, `duracaoPadrao: false`; P1 do STEP 4 (material 230) → Pix ≈ 598,53, Crédito ≈ 638,44; **v1.4 — sem duração** (`undefined`, 0) com material 800 → `duracaoConsiderada: 60`, `duracaoPadrao: true` e os mesmos valores do caso de 60 min (≈ 1.489,16 / 1.537,20 / 1.588,44); P2 do STEP 4 (sem duração, material 0) → custoReal ≈ 153,06, Pix ≈ 239,16, Crédito ≈ 255,10; P4 (sem duração, material 115) → custoReal ≈ 268,06, Pix ≈ 418,85, Crédito ≈ 446,77; `custoHora: null` → custoReal e preços `null`; divisores `null` → custoReal calculado, preços `null`. |
| `DURACAO_PADRAO_MINUTOS` | igual a 60. |
| `resolverDuracaoProcedimento` (v1.5) | informada 45 + protocolo com 60 → `{ 45, 'informada' }`; informada 45 + protocolo sem duração → `{ 45, 'informada' }`; sem informada + protocolo com 30 → `{ 30, 'protocolo' }`; sem informada + protocolo sem duração → `{ 60, 'padrao' }`; sem informada + protocolo com `duracao_minutos: 0` → `{ 60, 'padrao' }`; **sem informada e sem protocolo → `{ 60, 'padrao' }`** (v1.5 — nunca `null`). |
| `mesReferenciaDoProcedimento` (v1.4 — RN-31) | `'2026-10-20'` → `'2026-10'`; `'2026-11-01'` → `'2026-11'`; `new Date('2026-11-01')` (meia-noite UTC, como o client grava) → `'2026-11'` (não `'2026-10'`); `new Date('2026-10-31T00:00:00Z')` → `'2026-10'`. |
| `calcularCustoMaterialSolicitacao` | `[{2, 100}]` → `{ total: 200, incompleto: false }`; `[{1, 100}, {2, 50}]` → 200; `valor_unitario` `'abc'`/`undefined`/`NaN`/`-5` → conta 0, `incompleto: true`; `[{1, 0}]` → 0, `incompleto: false`; `[]` → 0, `false`. |
| `calcularPrecificacaoProcedimento` | **v1.4 — novembro/2026:** config oficial, `calcularResumoCustoHora(config, '2026-11')` → `horasMes: 184`, `custoHora ≈ 163,0435` (30.000 / 184); 60 min, material 800 → custoReal ≈ 963,04, preços ≈ 1.504,76 / 1.553,30 / 1.605,07; 60 min, material 200 (roteiro M) → custoReal ≈ 363,04, preços ≈ 567,26 / 585,55 / 605,07. Exemplo oficial (60 min, material 800) → custoHoraAplicado ≈ 153,06, custoReal ≈ 953,06, preços ≈ 1.489,16 / 1.537,20 / 1.588,44; roteiro G (60 min, material 200) → custoReal ≈ 353,06, preços ≈ 551,66 / 569,45 / 588,44; 45 min → custoReal ≈ 314,80, Crédito ≈ 524,66; duração `null` (defensivo — a UI sempre passa a duração efetiva, v1.5) → `custoHoraAplicado`, `custoReal` e preços `null` com `custoMaterial.total` preservado; `custoHora: null` → idem; procedimento sem protocolo e sem duração (v1.5: duração efetiva 60, material 200, outubro) → custoReal ≈ 353,06, preços ≈ 551,66 / 569,45 / 588,44; legado sem duração com Aluguel 35.000 (roteiro H passo 8: 60 min, material 100) → custoReal ≈ 278,57, preços ≈ 435,27 / 449,31 / 464,29; divisores `null` → custoReal calculado, preços `null`. |
| `montarSnapshotPrecificacao` (v1.4) | roteiro G (`mesReferencia: '2026-10'`, `'credito'`, duração 60 `'protocolo'`) → `mes_referencia: '2026-10'`, `custo_hora ≈ 153,0612`, `duracao_origem: 'protocolo'`, `custo_material: 200`, `custo_real ≈ 353,0612`, `divisores ≈ { 0,64; 0,62; 0,60 }`, `precos_sugeridos ≈ { 551,66; 569,45; 588,44 }`, `forma_pagamento: 'credito'`, `markup` igual ao da config (cópia), `origem`/`tenant_id`/`solicitacao_id` repassados; **a forma não altera nenhum valor** — o mesmo caso com `'pix_dinheiro'` ou `'debito'` produz os mesmos `divisores`/`precos_sugeridos`, só muda `forma_pagamento`; roteiro M (`mesReferencia: '2026-11'`) → `custo_hora ≈ 163,0435`, `precos_sugeridos ≈ { 567,26; 585,55; 605,07 }`; P4 (duração 60 `'padrao'`, material 100) → `duracao_origem: 'padrao'`, `precos_sugeridos ≈ { 395,41; 408,16; 421,77 }`; sem protocolo e sem duração (v1.5, roteiro G passo 15) → `duracao_minutos: 60`, `duracao_origem: 'padrao'`, `precos_sugeridos ≈ { 551,66; 569,45; 588,44 }` (o snapshot nunca tem duração `null`); config sem disponibilidade → `custo_hora: null`, preços `null`; markup inválido → `divisores` e `precos_sugeridos` com três `null`; material com `valor_unitario` inválido → `custo_material_incompleto: true`. |

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

#### 8.2.1 (v1.3) `describe('tenants/{tenantId}/precificacao_procedimentos')`

Semeados com `withSecurityRulesDisabled`: `tenants/{A}/solicitacoes/s1`, `tenants/{A}/precificacao_procedimentos/s1` (snapshot válido) e `tenants/{A}/financeiro/custo_hora` com opt-in ativo para `cons-x` (para provar que o opt-in financeiro **não** libera o snapshot). Toda leitura em **get e list**.

| Cenário | Esperado |
|---|---|
| `clinic_admin` do tenant lê (get e list) | sucesso |
| `clinic_admin` cria/atualiza `s1` com `tenant_id`, `solicitacao_id: 's1'` e `forma_pagamento` válidos | sucesso |
| `clinic_admin` grava com `tenant_id` de outro tenant | falha |
| `clinic_admin` grava `precificacao_procedimentos/s1` com `solicitacao_id: 's2'` | falha |
| `clinic_admin` grava com `forma_pagamento: 'cartao'` | falha |
| `clinic_admin` grava `precificacao_procedimentos/s-inexistente` (sem solicitação) | falha |
| `clinic_admin` deleta | falha |
| `clinic_user` do tenant lê (get e list) / escreve | falha |
| `clinic_admin` de outro tenant lê / escreve | falha |
| consultor com acesso **e** opt-in financeiro ativo para ele (`cons-x`) | get e list falham; escrita falha |
| consultor com acesso, sem opt-in | get e list falham |
| consultor sem o tenant em `authorized_tenants` | falha |
| `system_admin` | lê (get e list), escreve e deleta |
| Regressão: `describe.each` genérico, `nf_imports`, `financeiro` e D6 de `protocolos` | continuam verdes (o helper `isRestrictedTenantCollection` não muda a semântica de `nf_imports`/`financeiro`) |

### 8.3 Não testar (MVP)

| Item | Motivo |
|---|---|
| `FixedCostsTab`, `CustoHoraResumo`, `ProtocoloPrecificacao`, pages | Componentes React — critério do projeto; cobertos pelo caderno E2E (STEP 4). |
| `custoHoraService.ts` | Depende diretamente do client SDK sem abstração injetável (mesmo critério dos demais services); coberto por rules + E2E. |
| (v1.3) `ProcedimentoPrecificacao`, `FormaPagamentoSelector`, `requests/new`, `requests/[id]`, `requests/[id]/edit` | Componentes/pages — cobertos pelos roteiros G–M. |
| (v1.3) `precificacaoProcedimentoService.ts` e mudanças em `solicitacaoService.ts` | Client SDK direto; isolamento coberto pelas rules (8.2.1), fluxo pelos roteiros G–K. |

### 8.4 Caderno E2E (CLAUDE.md, regra 8)

Após a conclusão da task (Modo B do `dev-task-manager`), acionar o `qa-agent` (Modo A) sobre o STEP 4 → `tests/e2e/UC-58-precificar-protocolos-pela-hora-clinica.spec.ts`. Revisão humana obrigatória antes de virar gate de CI.

(v1.3/v1.4) O caderno cobre os roteiros A–M. Pontos de atenção para o `qa-agent` e o revisor:

- **Aceite de termos (D14):** `clinicUserA`, `clinicAdminB` e `consultant` não têm aceite no seed e ficam presos em `/accept-terms`; o spec grava o aceite via Admin SDK no próprio `beforeAll` (padrão do `UC-52-*.spec.ts`). **Não estender o seed.** `consultantB` já tem aceite, mas não é o consultor vinculado a `test-clinic-a`.
- **Seed por teste:** inventário com `dt_validade`/`lote`/`nome_produto`/`quantidade_reservada` (pré-requisitos do STEP 4), protocolos P1–P4, solicitações legadas `qa-legado-*` e cópia/restauração de `financeiro/custo_hora` em `finally`.
- **Ordem e estado:** G–L dependem da configuração deixada por A–F; roteiros que reservam estoque cancelam o procedimento ao final (ou o spec restaura o inventário).
- **RF-29 (falha do snapshot)** fica fora do caderno (não determinístico no emulador).

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
[ ] (v1.3) grep -rn "cartao_pct" src → só ParametrosMarkupLegado / normalizarParametrosMarkup
[ ] (v1.3) Exemplo oficial v1.3 reproduzido nos testes (Pix R$ 1.489,16 / Débito R$ 1.537,20 / Crédito R$ 1.588,44)
[ ] (v1.3) Documento financeiro legado (cartao_pct) abre, calcula e, ao salvar, perde cartao_pct
[ ] (v1.3) Rules: precificacao_procedimentos fora do fallback genérico; só clinic_admin lê/escreve; consultor com opt-in NÃO lê
[ ] (v1.3) Nenhum valor derivado dos custos fixos gravado em solicitacoes (roteiro G, passo 9)
[ ] (v1.3) Falha no snapshot não impede a gravação da solicitação (revisão do try/catch)
[ ] (v1.3) clinic_user: detalhe sem card de preço e sem leituras negadas no console
[ ] (v1.3) Roteiros G–M executados e documentados no PR; roteiros A, B, D e F reexecutados com os valores v1.3/v1.4
[ ] (v1.3) Decisões D7–D10 (Seção 4.4) refletidas no código
[ ] (v1.4/v1.5) Decisões D11–D14 e respostas à I-1 (v1.5) refletidas no código e no caderno
[ ] (v1.4) Protocolo sem duração: diálogo no cadastro; listagem/consultor com 60 min e aviso "Duração não informada — considerada 1 hora"
[ ] (v1.5) Sem duração no campo (com ou sem protocolo) → cálculo com 60 min + aviso; campo nunca pré-preenchido com 60; solicitação sem `duracao_minutos`, snapshot com `duracao_minutos: 60` e `duracao_origem: 'padrao'`
[ ] (v1.4) Mês do procedimento: 01/11/2026 → novembro/2026 (184 h, R$ 163,04/h), sem cair em outubro
[ ] (v1.4) Cadastro (revisão) e detalhe mostram sempre os três preços com a taxa considerada; snapshot grava divisores e precos_sugeridos
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
| Seed E2E não cobrir inventário/protocolos do cenário, ou usuários sem aceite de termos | Alta | Médio | O STEP 4 especifica os documentos que cada teste semeia e remove via Admin SDK (padrão de `UC-51-*.spec.ts`); o vínculo consultor ↔ `test-clinic-a` já existe no seed, mas `clinicUserA`, `clinicAdminB` e `consultant` **não** têm aceite de termos — gravar via Admin SDK (padrão de `UC-52-*.spec.ts`). (Corrigido na v1.3: a v1.2 afirmava que o seed não precisava de extensão.) |
| (v1.3) Algum valor derivado (custo/hora, preço, percentuais) gravado na solicitação por engano → `clinic_user` e consultor leem | Média | Alto | RNF-08; `Solicitacao` não ganha esses campos no tipo; roteiro G passo 9 verifica a ausência; revisão de PR. |
| (v1.3) Documento financeiro legado sem normalização → `undefined + número = NaN` nos divisores | Média | Médio | Normalização num único ponto (`getCustoHoraConfig`), testada (8.1.1); `validarParametrosMarkup` devolve 'Informe percentuais válidos' para `NaN`; roteiro L. |
| (v1.3) Conflito com o bugfix da allowlist na lista de exclusões do bloco genérico | Média | Alto | Helper `isRestrictedTenantCollection` + regras de convivência (5.4.2); testes de rules de `nf_imports`, `financeiro` e `precificacao_procedimentos` falham se a exclusão sumir. |
| (v1.3) Procedimento sem snapshot por falha best-effort | Baixa | Baixo | Toast de aviso (RF-29); detalhe mostra estimativa atual sinalizada; editar (se agendado) grava de novo. |
| (v1.3) Material do snapshot divergir do gravado na solicitação | Baixa | Médio | O snapshot usa `produtosSolicitados` devolvido pelo service (o mesmo array da transação), não o estado da tela. |
| (v1.3) Usuário confundir o snapshot com o valor cobrado | Média | Médio | Textos RNF-07 ("estimativa"), data e mês de referência no card; selo "Estimativa atual" quando não há registro. |
| (v1.4) Mês do procedimento calculado com fuso errado: `dt_procedimento` é gravado como meia-noite UTC e, convertido para São Paulo, o dia 1º cai no mês anterior | Média | Médio | `mesReferenciaDoProcedimento` lê a string do formulário ou o `Date` em UTC (RN-31); cenário Jest com `new Date('2026-11-01')`; roteiro M passo 3. Observação: a tela de detalhe atual exibe a data com `toLocaleDateString('pt-BR')` no fuso do navegador — em São Paulo mostra o dia anterior (bug preexistente, fora do escopo; registrar no mapa de bugs). |
| (v1.4) Interpretação I-1 da duração diferente do que o usuário quer | — | — | **Resolvido na v1.5** (respostas do usuário em 09/10/2026). |
| (v1.5) Procedimentos sem duração sempre precificados com 1 hora podem ter preço distorcido sem o admin perceber | Média | Médio | Aviso "Duração não informada — considerada 1 hora" no cadastro, na revisão, no detalhe (snapshot com `duracao_origem: 'padrao'`) e na estimativa atual. |
| (v1.3) Bug preexistente no redirect de edição: `requests/[id]/edit` envia `produto_codigo`/`produto_nome` no JSON de `produtos`, mas `requests/new` lê `p.codigo_produto`/`p.nome_produto` — código e nome só se recompõem se o lote ainda tiver saldo disponível | Média | Baixo | Fora do escopo (não afeta o cálculo: o material usa `valor_unitario`, que chega certo). Registrar no `_MAPA-DE-BUGS-E-MELHORIAS.md` via `uc-issues-tracker` e corrigir em task própria. |

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
| Forma de pagamento | (v1.3) Pix/Dinheiro, Débito ou Crédito; define qual taxa de cartão entra no divisor (RN-19). |
| Divisor por forma | (v1.3) `1 − Σ percentuais/100`, com a taxa da forma escolhida (0 no Pix/Dinheiro). |
| Snapshot de precificação | (v1.3) Registro dos valores mostrados ao confirmar um procedimento, em `precificacao_procedimentos`; só muda numa nova confirmação de edição. |
| Estimativa atual | (v1.3) Preço calculado na hora, com os custos do mês corrente, para procedimentos sem snapshot; sempre sinalizado na UI. |

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
- (v1.3) UCs UC-16, UC-17, UC-18, UC-19 (procedimentos) e UC-52 (consultor lê `solicitacoes`).
- (v1.3) Código: `src/app/(clinic)/clinic/requests/new/page.tsx`; `src/app/(clinic)/clinic/requests/[id]/page.tsx`; `src/app/(clinic)/clinic/requests/[id]/edit/page.tsx`; `src/lib/services/solicitacaoService.ts`; `src/lib/services/custoHoraService.ts`; `src/lib/precificacao.ts`; `src/components/pricing/*`; `src/components/clinic/FixedCostsTab.tsx`; `scripts/seed-emulator.ts` (`usersWithFullAcceptance`); `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts` (aceite via Admin SDK).

### Trabalho futuro (Fase 3 — fora do escopo)

- Integrar a hora clínica ao custeio por procedimento (UC-51 / `costingService.ts`). **A v1.3 resolve o pré-requisito**: `Solicitacao.duracao_minutos` existe e cada procedimento confirmado com custos configurados tem um snapshot em `precificacao_procedimentos` (custo/hora, custo real, preço sugerido, forma de pagamento). O relatório de custo por procedimento (`FEAT-relatorio-custo-por-procedimento.md`) pode ler o snapshot em vez de recalcular; procedimentos sem snapshot usam a estimativa atual ou ficam sem a parcela de hora. A leitura do snapshot é só `clinic_admin` — o relatório herda essa restrição.
- Compartilhar snapshots de procedimentos com o consultor (opt-in) — fora da v1.3 (P1).
- Histórico de versões do snapshot (hoje a edição sobrescreve — P13).
- Preço efetivamente cobrado e taxa de crédito por número de parcelas.
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
| 1.3 | 09/10/2026 | Doc Writer (Claude) | Nova **Fase 2B — preço sugerido no procedimento**, a pedido do usuário (Guilherme Stanke Scandelari, 09/10/2026). Decisões D7–D10 do usuário (Seção 4.4); premissas P1–P9 do briefing conferidas pelo assistente contra o código e P10–P17 propostas pelo assistente (Seção 4.5) — pendentes de revisão do usuário. Status → Em execução (Fases 1–2 entregues no PR #382). Acrescidos: RF-21–RF-33, RNF-08–RNF-10, RN-19–RN-30 (RF-08, RN-08 e RNF-04 anotadas); Seção 4.1 itens 10–15; 4.2 e 4.3 ampliadas; 5.1, 5.2, 5.4 e nova 5.4.2 (subcoleção `precificacao_procedimentos`, helper `isRestrictedTenantCollection`, convivência com o bugfix UC-48-RN-06); 5.5 revoga o "fluxo de solicitações não muda"; 6.1.1, 6.2.5–6.2.8, 6.3.5–6.3.8; STEP 6 (6.1–6.9, 9 commits); STEP 4 com pré-requisitos corrigidos (aceite de termos de `clinicUserA`/`clinicAdminB`/`consultant`; campos de lote para o cadastro de procedimento), roteiros A, B, D e F com valores v1.3 e novos roteiros G–L; STEP 5 inclui UC-16 a UC-19; 8.1.1 e 8.2.1; DoD, Riscos (inclui bug preexistente no redirect de edição), Glossário, Referências e Trabalho futuro atualizados. |
| 1.4 | 09/10/2026 | Doc Writer (Claude) | Premissas revisadas pelo usuário (Guilherme Stanke Scandelari, 09/10/2026); o bloqueio "revisar P1–P17" sai do cabeçalho, do STEP 6 e do DoD. Novas decisões D11 (protocolo sem duração = 1 hora: diálogo "Entendi" no cadastro, 60 min na listagem e no consultor — `DURACAO_PADRAO_MINUTOS`, RF-34, RN-11 e RF-14 anotadas, RN-24 reescrita), D12 (mês de referência = mês da data do procedimento, com a configuração vigente na confirmação; RN-26 reescrita, nova RN-31 sobre a data gravada em meia-noite UTC), D13 (forma de pagamento só informativa; três preços sempre, com a taxa; snapshot com `divisores`/`precos_sugeridos` no lugar de `taxa_pagamento_pct`/`divisor`/`preco_sugerido`; `calcularPrecosDoSnapshot` removida) e D14 (aceite de termos via Admin SDK em cada spec, sem estender o seed). P1–P3, P5–P9, P11, P13, P15–P17 confirmadas; P4/P14 ajustadas; P10/P12 substituídas. Interpretação I-1 da duração efetiva registrada para confirmação do usuário. Funções novas `resolverDuracaoProcedimento` e `mesReferenciaDoProcedimento`; novo commit STEP 6.2a; protocolo P4 no seed do STEP 4; roteiros D, G e H atualizados; novo roteiro M (novembro/2026, 184 h); cenários Jest 8.1.1 com os valores novos; DoD e Riscos atualizados. |
| 1.5 | 09/10/2026 | Doc Writer (Claude) | Respostas do usuário (Guilherme Stanke Scandelari, 09/10/2026) à interpretação I-1: (1) protocolo sem duração → 1 h mesmo com outros produtos — confirmado; (2) procedimento sem protocolo e sem duração também usa 1 h com o aviso "Duração não informada — considerada 1 hora" (antigo caso (d) removido); (3) o campo "Duração (min)" não é pré-preenchido com 60 — só diálogo e aviso. Decisão do assistente coerente com (3): `resolverDuracaoProcedimento` nunca devolve `null` (informada → protocolo com duração > 0 → `{ 60, 'padrao' }`); a solicitação grava em `duracao_minutos` só o valor do campo (ausente quando vazio, a edição reabre vazia); o snapshot grava a duração efetiva (sempre número) e `duracao_origem`; a estimativa atual de legado sem duração usa 60 min com aviso. Ajustados D11 (linha nova), RF-24, RF-27, RN-24, I-1 (resolvida), tipos do snapshot e da função, Seções 6.3.6/6.3.7, nota do STEP 6, roteiros G (passos 12–15) e H (passo 8), cenários 8.1.1, DoD e Riscos. Sem pendências de decisão. |
| 1.6 | 10/10/2026 | Claude | D15: margem única mantida (margem separada material/serviço descartada; modelo de mercado, stakeholder de acordo). D16: colunas "Custo real" e "Preço sugerido" na tabela de `/clinic/requests` (admin), "Valor Total" → "Material", estimativa compartilhada `estimarPrecificacaoProcedimento`. Trabalho futuro (fora desta feature, a integrar ao `FEAT-reformulacao-dashboard-clinica.md`): gráfico no dashboard com receita estimada (preço sugerido) **e** valor cobrado lado a lado, por semana em 30/60/90 dias e por mês em 6 meses/1 ano — exige o novo campo "Valor cobrado" no procedimento e uma biblioteca de gráficos. |
| 1.7 | 10/10/2026 | Guilherme Stanke Scandelari | Task concluída — movida para TASK_COMPLETED. Fases 1, 2 e 2B (STEPs 1–3 e 6, mais D15/D16 da v1.6) entregues na branch `feature/precificacao-hora-clinica` e mergeadas em `gscandelari_setup` pelos PRs #382, #383 e #384; validação manual feita em `dev-gscandelari.web.app`. Gate de testes (B.3): `npm run test:coverage` verde (24 suítes, 400 testes, incluindo `precificacao.test.ts` e `auditLogPayload.test.ts`). **Pendências de fechamento, a fazer nesta mesma branch antes do PR `gscandelari_setup` → `develop`:** (1) STEP 5 — UC-58 criado pelo `uml-use-case-writer` e atualização de UC-16 a UC-19 e UC-53; (2) caderno E2E `tests/e2e/UC-58-precificar-protocolos-pela-hora-clinica.spec.ts` gerado pelo `qa-agent` a partir do STEP 4 (Seção 8.4), com revisão humana obrigatória antes de virar gate de CI. |
