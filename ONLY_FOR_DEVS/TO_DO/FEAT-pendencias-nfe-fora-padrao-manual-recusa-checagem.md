# Feature: Pendências de NF-e — código do catálogo com 5 a 8 dígitos, "código fora do padrão", pendência no lançamento manual Rennova, recusa pelo system_admin e checagem antecipada de duplicidade

**Projeto:** Curva Mestra
**Data:** 15/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/pendencias-nfe-fora-padrao-recusa`
**Prioridade:** Média
**Versão:** 1.2
**Origem:** `UC-31-Q3` (Baixa, questão de produto) e `UC-11-RN-06` (Baixa, achado de UX), registrados em `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.56, destaque 15), mais a Parte C, pedida pelo usuário em 15/10/2026. As decisões do usuário de 15/10/2026 estão na Seção 4.4. Base de código: `develop` @`5d5a09b`, que já contém o `BUGFIX-identidade-e-duplicidade-nfe` (PR #393/#394). Nessa revisão, `src/`, `functions/` e `firestore.rules` são idênticos aos da branch `docs/nfe-identity-closure` usada nesta análise (conferido com `git diff 5d5a09b HEAD`).
**Arquivo anterior:** `ONLY_FOR_DEVS/TO_DO/FEAT-codigo-fora-do-padrao-e-checagem-antecipada-nfe.md` (v1.0). Foi renomeado na v1.1 para refletir o escopo maior.

> **Parte A — Código do catálogo e "código fora do padrão".**
> - O catálogo master passa a aceitar códigos de **5 a 8 dígitos**, sem zeros à esquerda (hoje: 1 a 7).
> - Na importação XML, um `cProd` normalizado fora desse padrão (alfanumérico, mais de 8 dígitos ou menos de 5) vira pendência marcada como **código fora do padrão**. Os demais produtos entram no estoque e a importação não trava.
> - O system_admin vê esses códigos numa seção própria de `/admin/pending-products`, agrupada por código e com as clínicas que os enviaram, e recebe um alerta num sino novo do painel admin (sem e-mail).
>
> **Parte B — Checagem antecipada.** A rota GET `/api/nf-imports/identidade` informa se a NF (CNPJ + série + número) já existe. Ela é chamada no Passo 2 do lançamento manual e no preview do upload XML. A transação do servidor continua sendo a checagem que vale.
>
> **Parte C — Pendência no manual Rennova e ação "Recusar".**
> - No lançamento manual Rennova, um produto que não está no catálogo pode ser informado à mão e vira pendência no mesmo ID da NF.
> - A incorporação automática já existente passa a cobrir essas pendências.
> - O system_admin pode **recusar** qualquer pendência (XML, fora do padrão ou manual) com motivo obrigatório. A clínica é avisada pelo sino e pode relançar o item como complemento manual.
>
> Todas as decisões foram respondidas pelo usuário (D1–D8, Seções 4.4 e 4.5). O documento está pronto para o `dev-task-manager`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`. Antes de criar a branch, confira que `develop` existe local e remoto e está em sync com `master` (`git checkout develop && git pull origin develop`). O `develop` local desta máquina estava em `19d8fcd` e só chegou a `5d5a09b` depois de `git fetch`; atualize-o antes.
- **Branch da task:** `feature/pendencias-nfe-fora-padrao-recusa`
- **Fluxo:** `feature/pendencias-nfe-fora-padrao-recusa` → PR → `gscandelari_setup` → validação em `dev-gscandelari.web.app` → PR `gscandelari_setup` → `develop` → (release) `master`. **Nunca abra PR da task direto para `develop` ou `master`.** O merge acontece sempre pelo PR, nunca manualmente.
- **Ordem dos commits:** cada commit mantém a importação e o lançamento funcionando. A ordem é: funções puras → servidor (XML, manual, recusa) → rules → telas → rota de consulta → telas da checagem antecipada.
- **Tipo:** é funcionalidade nova (`feat` → MINOR no release-please).

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `feat` | `admin` | `feat(admin): accept 5 to 8 digit master product codes` |
| STEP 1 | `test` | `admin` | `test(admin): cover 5 to 8 digit master product code rules` |
| STEP 2 | `feat` | `inventory` | `feat(inventory): add pure rules for out-of-pattern, manual pending and rejection` |
| STEP 2 | `test` | `inventory` | `test(inventory): cover out-of-pattern, manual pending and rejection rules` |
| STEP 3 | `feat` | `api` | `feat(api): flag out-of-pattern codes and alert system admin on XML import` |
| STEP 3 | `test` | `api` | `test(api): cover out-of-pattern pending flags in XML import route` |
| STEP 4 | `feat` | `api` | `feat(api): register manual Rennova items outside the catalog as pending` |
| STEP 4 | `test` | `api` | `test(api): cover manual pending items in manual launch route` |
| STEP 5 | `feat` | `api` | `feat(api): let system admin reject pending NF products` |
| STEP 5 | `test` | `api` | `test(api): cover pending product rejection route` |
| STEP 6 | `feat` | `firebase` | `feat(firebase): add admin notifications collection rules` |
| STEP 6 | `test` | `firebase` | `test(firebase): cover admin notifications rules for get and list` |
| STEP 7 | `feat` | `admin` | `feat(admin): list out-of-pattern codes, reject pendings and notify in admin bell` |
| STEP 8 | `feat` | `inventory` | `feat(inventory): mark out-of-pattern codes in XML preview and result` |
| STEP 9 | `feat` | `inventory` | `feat(inventory): allow manual Rennova items outside the catalog` |
| STEP 10 | `feat` | `api` | `feat(api): add NF identity lookup route` |
| STEP 10 | `test` | `api` | `test(api): cover NF identity lookup route` |
| STEP 11 | `feat` | `inventory` | `feat(inventory): check NF duplicity before confirming XML import` |
| STEP 12 | `feat` | `inventory` | `feat(inventory): check NF duplicity on manual entry step 2` |
| STEP 13 | — | — | Validação Manual, sem commit de código |

**Ao abrir o PR `gscandelari_setup` → `develop`** (Seção 15 do SST):
- `uml-use-case-writer` atualiza:
  - UC-10: fora do padrão no preview, bloqueio antecipado, novo texto de pendentes, alerta do admin;
  - UC-11: RN-06 (checagem no Passo 2), produto fora do catálogo vira pendência, tela de resultado, complemento depois de recusa;
  - UC-12: seção "Códigos fora do padrão", coluna de origem, ação "Recusar", sino do system_admin;
  - UC-31: código de 5 a 8 dígitos;
  - UC-32: edição de código e produtos legados;
  - UC-44: novo tipo `nf_pending_rejected`.

  Avaliar também se o sino do system_admin pede um UC próprio.
- `uc-issues-tracker` (Modo B):
  - fecha `UC-31-Q3` e `UC-11-RN-06`;
  - registra F3 (tipo `NFImport` desatualizado) como débito técnico;
  - registra que `UC-12-Decisão-Expiração` foi resolvida em parte pela ação "Recusar".

**Produção:** o workflow `deploy-firebase.yml` publica só `hosting:curva-mestra` e `functions`. As rules e os índices de produção são publicados **manualmente pelo usuário antes do merge em `master`**:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project curva-mestra
```

---

## 1. Contexto e Motivação

### 1.1 Situação atual

**Formato do código do catálogo master**
- `validateProductCode` (`src/types/masterProduct.ts:91-94`) aceita de 1 a 7 dígitos, desde que não sejam só zeros. `formatProductCode` (l. 82-85) corta em 7 e não é usado em lugar nenhum.
- A rule de `master_products` (`firestore.rules:297-312`) exige `^[1-9][0-9]{0,6}$` no `create`. No `update`, ela testa `'code' in request.resource.data`. Como `request.resource.data` é o documento **inteiro** depois da escrita, qualquer update (até desativar) revalida o código atual.
- Os formulários `src/app/(admin)/admin/products/new/page.tsx` e `[id]/page.tsx` têm:
  - `formatCodeInput`, que faz `value.replace(/\D/g, '').slice(0, 7)` (`new` l. 96-98; `[id]` l. 153-155);
  - `maxLength={7}` (`new` l. 140; `[id]` l. 208);
  - o texto "Até 7 dígitos; zeros à esquerda são removidos";
  - o erro "Código inválido. Use até 7 dígitos (não pode ser só zeros)." (`new` l. 62; `[id]` l. 104).
- `masterProductService.ts` grava e busca `normalizeLeadingZeros(code)` (l. 156, 214, 281).
- **Dados reais (verificação do usuário em 15/10/2026, leitura nos dois projetos):**
  - `curva-mestra-dev`: **73 produtos**, 72 com 7 dígitos e 1 com 6;
  - `curva-mestra` (produção): **70 produtos**, 69 com 7 dígitos e 1 com 6.

  **Nenhum código está fora de `^[1-9][0-9]{4,7}$`.** A rule nova não afeta nenhum produto existente. Os scripts `scripts/import-master-products*.js` também só têm códigos de 6 e 7 dígitos (`309960` é o de 6).
- O `COD_REGEX = r"^(\d{7,8})\s"` citado no `CLAUDE.md` (regra 5) é do **parser PDF antigo, que foi removido** (`CLAUDE.md`, "Importação via XML NF-e"). Ele não rege o catálogo, não muda nesta task, e o `CLAUDE.md` não é editado.

**Importação XML e pendências**
- `parseNfeXml` normaliza `cProd` com `normalizeLeadingZeros` (`'00A12'` → `'A12'`).
- `planXmlLines` (`src/lib/nfImportPlanner.ts:84-112`) manda para `pending` toda linha sem master ativo.
- `confirmXmlImport` (`src/lib/services/nfImportServer.ts:114-242`):
  - grava `produtos_pendentes: [{codigo, nome_produto, lote}]` no registro;
  - cria `pending_master_products/{tenantId}_{importId}_{linha}` com `status: 'aberta'`.
- `readConflict` (l. 96-112) calcula `hasPending` como `produtos_pendentes.length > 0`.
- A rota XML usa `checkWriteBudget(3, linhas)`.
- **Incorporação** (`functions/src/pendingResolution.ts`):
  - `resolvePendingForCode` busca o master ativo por código e as pendências `where codigo == X && status == 'aberta'`, agrupadas por `(tenant_id, nf_import_id)`;
  - `resolveBlock` lê o registro e as pendências, grava o inventário com os campos da pendência (`quantidade`, `valor_unitario`, `dt_validade`, `lote`, `nome_produto`) e o cabeçalho do registro (`numero_nf`, `natureza_operacao ?? null`, `tipo_nota ?? null`), remove de `produtos_pendentes` por `(codigo, lote)` com `removeResolvedPendentes` e notifica a clínica com `nf_pending_resolved`.
  - **Não há nada específico de XML nesse caminho.** Uma pendência manual com os mesmos campos é incorporada sem mudar as functions.

**Lançamento manual (`src/app/(clinic)/clinic/add-products/page.tsx`)**
- Para Rennova, o modal "Adicionar Produto" busca só em `masterProducts`, carregado com `where('active','==',true)` (l. 174-186). Sem resultado, mostra "Nenhum produto encontrado" (l. 734-738) e não oferece alternativa.
- `handleAddProduct` (l. 197-235) exige `selectedProduct` do catálogo. A lista mostra Código | Nome | Lote | Qtd. | Validade | Valor (l. ~893-909).
- `handleContinueToProducts` (l. 154-172) só valida a identidade. A duplicidade só aparece no 409 de `handleSaveNF` (achado `UC-11-RN-06`).
- `handleSaveNF` (l. 314-399), em caso de sucesso, mostra um toast e faz `router.push('/clinic/inventory')` na hora.
- No servidor, `confirmManualLaunch` (`nfImportServer.ts:244-378`) responde `invalid` (422) "Produto X não está ativo no catálogo Rennova." quando algum produto Rennova está ausente ou inativo (l. 278-286). A validação do corpo fica em `src/lib/validations/nfManualLaunchValidation.ts`, e a rota usa `checkManualWriteBudget(3, N)`.

**Tela do system_admin (`src/app/(admin)/admin/pending-products/page.tsx`)**
- Lista as pendências `aberta` com as colunas Clínica | Importação | NF | Código | Produto | Lote | Qtd. | Data.
- Ações por linha:
  - "Cadastrar Produto" leva a `/admin/products/new?codigo=&nome=`, e o formulário **trunca para 7 dígitos e remove letras**;
  - "Reprocessar" chama um callable.
- Não existe ação de recusa ou descarte.

**Notificações**
- Existem só por tenant: `tenants/{t}/notifications`, com `NotificationType` em `src/types/notification.ts`, `by_type` em `notificationService.ts:270-282` e ícones em `NotificationBell.tsx:61-79`.
- O sino aparece só em `ClinicLayout`. `AdminLayout` não tem sino nem cabeçalho.
- **Não existe mecanismo de notificação para o system_admin.**

**Rotas de admin com Admin SDK**
- Padrão de guarda: `adminAuth.verifyIdToken` com checagem de `is_system_admin`, como em `src/app/api/access-requests/[id]/reject/route.ts`.
- `verifyBearerToken` fica em `src/lib/services/accessRequestRouteHelpers.ts`.

**Testes existentes relacionados**
- `src/__tests__/masterProductService.test.ts:53-60`: `'1'` é aceito e `'12345678'` é rejeitado. Os dois invertem com esta task.
- `tests/rules/firestore-tenant-subcollections.test.ts:417-437`: `12345678` é rejeitado e passa a ser aceito.
- Também são afetados `src/__tests__/{nfImportPlanner,nfImportRoutes,nfPendingResolutionRules}.test.ts`.

### 1.2 Problema identificado

1. **`UC-31-Q3`.** O formato do catálogo (1 a 7 dígitos) não corresponde ao da Rennova (5 a 8). Códigos fora do padrão viram pendências indistinguíveis e eternas, e "Cadastrar Produto" trunca o código.
2. O system_admin não vê essas anomalias como tal nem sabe quais clínicas as enviaram, e não recebe alerta nenhum.
3. A clínica recebe a promessa de incorporação automática para itens que nunca serão incorporados.
4. **`UC-11-RN-06`.** No manual, a duplicidade é descoberta só depois de todos os produtos digitados. No XML, só depois de "Confirmar".
5. **Parte C.** A clínica não consegue lançar manualmente um produto Rennova que ainda não está no catálogo: a busca não acha e o servidor recusa com 422. Também não existe forma de encerrar uma pendência que nunca será cadastrada.

### 1.3 Motivação estratégica

O código do produto é a chave entre NF-e, catálogo, estoque, relatórios e custo por procedimento. As decisões de 15/10/2026 são:
- alinhar o formato ao da Rennova;
- tratar os desvios como anomalia rastreável, para validar com o fornecedor, sem travar a operação da clínica;
- dar ao manual o mesmo tratamento de pendência que o XML já tem;
- dar ao system_admin uma forma explícita de encerrar pendências (recusa com motivo), sempre com aviso à clínica.

A checagem antecipada reduz retrabalho sem abrir mão da transação atômica.

### 1.4 Achados desta investigação

| # | Achado | Tratamento |
|---|---|---|
| F1 | A rule de `update` de `master_products` revalida o código atual em qualquer update. | Passa a validar o formato **só quando o código muda** (Seção 6.5). Não há código legado hoje (verificação de 15/10/2026), mas a regra protege cadastros futuros feitos por script. |
| F2 | `hasPending` conta todas as pendências. Uma NF cujas pendências estão todas fora do padrão diria, no reenvio, "serão adicionados automaticamente". | `hasPending` passa a contar só pendências **incorporáveis** (`hasResolvablePending`). |
| F3 | O tipo `NFImport` (`src/types/nf.ts:276-295`) ainda está no formato antigo. | Fora do escopo. Só os tipos de item mudam. Vai para o mapa como débito técnico. |
| F4 | Os scripts `scripts/import-master-products*.js` escrevem com Admin SDK e não passam pelas rules. | Documentado em Riscos. |
| F5 | A incorporação (`functions/src/pendingResolution.ts`) já é genérica: depende só dos campos da pendência e do cabeçalho do registro. | Pendências manuais gravadas com os mesmos campos são incorporadas **sem alterar as functions** (RN-15). O teste de paridade não muda. |
| F6 | `removeResolvedPendentes` remove por `(codigo, lote)`. Com duas linhas iguais, remove uma ocorrência. | É reaproveitada na recusa. Fica a mesma semântica. |

---

## 2. Objetivos

1. **Ampliar** o código do catálogo master para 5 a 8 dígitos numéricos, sem zeros à esquerda.
2. **Classificar** na importação XML os `cProd` fora do padrão como pendência "código fora do padrão", sem travar a NF.
3. **Permitir** no lançamento manual Rennova o registro de produto fora do catálogo como pendência no mesmo ID da NF, incorporada automaticamente quando o produto for cadastrado.
4. **Expor** ao system_admin os códigos fora do padrão (agrupados por código e clínica) e a origem de cada pendência.
5. **Alertar** o system_admin num sino próprio, sem e-mail.
6. **Permitir** ao system_admin recusar qualquer pendência com motivo, avisando a clínica.
7. **Impedir** que "Cadastrar Produto" trunque ou altere um código fora do padrão.
8. **Informar** a clínica de forma legível sobre itens pendentes, fora do padrão e recusados.
9. **Antecipar** a checagem de duplicidade no Passo 2 do manual e no preview do XML, mantendo a transação como checagem autoritativa.
10. **Cobrir** com Jest as funções puras e as rotas, e com `npm run test:rules` (get **e** list) as rules novas.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

**Parte A — Catálogo e código fora do padrão**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | O cadastro e a edição de produto do catálogo aceitam códigos numéricos que, sem os zeros à esquerda, tenham de 5 a 8 dígitos. O campo aceita até 8 caracteres. O texto de ajuda é "5 a 8 dígitos; zeros à esquerda são removidos". O erro é "Código inválido. Use de 5 a 8 dígitos (zeros à esquerda não contam)." | system_admin | Must |
| RF-02 | Na edição, o formato só é validado se o código mudou. Um produto legado continua editável e desativável. | system_admin | Must |
| RF-03 | Na confirmação do XML, uma linha com `codigo` normalizado fora do padrão vira pendência com `fora_do_padrao: true`. As demais linhas seguem a regra atual e a importação conclui. | clinic_admin / system | Must |
| RF-04 | O registro `nf_imports` marca `fora_do_padrao: true` nos itens de `produtos_pendentes` correspondentes. | system | Must |
| RF-05 | Em `/admin/pending-products`, a seção "Códigos fora do padrão" (âncora `#fora-do-padrao`) agrupa as pendências abertas fora do padrão por código. Cada grupo mostra o código, as descrições distintas (nome no XML), o número de clínicas e a tabela de ocorrências: Clínica \| Importação "ID n" \| NF "NF n · série s · CNPJ ..." \| Lote \| Qtd. \| Data \| Ação "Recusar". | system_admin | Must |
| RF-06 | Pendências fora do padrão não aparecem na fila comum e não têm "Cadastrar Produto" nem "Reprocessar". Têm só "Recusar" (RF-17). | system_admin | Must |
| RF-07 | `/admin/products/new?codigo=X` só pré-preenche o código se X normalizado estiver no padrão. Senão, deixa o campo vazio, sem truncar. O nome continua sendo pré-preenchido. | system_admin | Must |
| RF-08 | Cada importação XML ou lançamento manual que **gerar pendência** cria **um** alerta no sino do system_admin. O texto informa a clínica, a origem, a NF, o ID e os códigos, separando "fora do catálogo" de "fora do padrão". Clicar marca como lido e leva a `/admin/pending-products` (com âncora `#fora-do-padrao` se todas as pendências estiverem fora do padrão). Sem e-mail. (Escopo: toda pendência, D8-A.) | system_admin | Must |
| RF-09 | No preview do upload, um item fora do padrão mostra o badge "Código fora do padrão — ficará pendente". Um `Alert` próprio diz: "O código destes produtos não segue o padrão do catálogo Rennova. Eles não entrarão no estoque. O Administrador do Sistema foi informado e atuará assim que possível. Se o item for recusado, você será avisado pelo sino de notificações." | clinic_admin | Must |
| RF-10 | Na tela de sucesso do upload, os pendentes comuns e os fora do padrão aparecem em listas separadas. O texto dos comuns passa a ser: "Os produtos X, Y e Z não foram inseridos no estoque. O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações." | clinic_admin | Must |

**Parte B — Checagem antecipada**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-11 | `GET /api/nf-imports/identidade?cnpj=&serie=&numero=` responde se a identidade existe no tenant do token. Se existir, devolve ID, origem, `hasPending` (só incorporáveis) e `hasRejected`. Não grava nada. | clinic_admin | Must |
| RF-12 | Manual, Passo 2, "Continuar": consulta a rota. Se a decisão de `evaluateIdentityConflict('manual', …)` for `blocked`, mostra a mensagem do 409 (ex.: "Esta NF já foi importada via XML (ID n) e não aceita lançamento manual.") e o usuário fica no Passo 2. Se for `complement`, mostra o aviso de complemento ("Esta NF já tem lançamento (ID n). Os produtos que você adicionar serão incluídos nesse mesmo ID."), segue, e repete o aviso no resumo. | clinic_admin | Must |
| RF-13 | Upload XML: depois do parse, consulta a rota. Se a identidade existir, o preview mostra um `Alert` destrutivo com a mensagem do 409 e o botão "Confirmar e Adicionar ao Estoque" fica desabilitado. Nada é gravado. | clinic_admin | Must |
| RF-14 | Se a consulta falhar, o fluxo segue com o aviso "Não foi possível verificar agora se a NF já foi cadastrada; a verificação será feita ao salvar." (D5). | clinic_admin | Must |

**Parte C — Pendência no manual Rennova e recusa**

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-15 | No modal "Adicionar Produto" (Rennova), quando a busca não encontra resultado, aparece o link-botão "Produto não está no catálogo — informar manualmente". Ele abre os campos Código, Nome (conforme a NF), Lote, Quantidade, Validade e Valor unitário, com a dica "Informe como está na NF (embalagens)" junto de Quantidade e Valor. Regras do código: (a) se o normalizado não estiver no padrão (5 a 8 dígitos), o modal bloqueia com "Código inválido"; (b) se coincidir com um produto ativo já carregado no catálogo, o modal bloqueia com "Este código está no catálogo: selecione o produto na busca." | clinic_admin | Must |
| RF-16 | Na lista do Passo 3 e na revisão, o item informado à mão aparece com o badge amarelo "Pendente de cadastro". Quantidade e valor aparecem como informados, sem conversão. | clinic_admin | Must |
| RF-17 | "Recusar" em `/admin/pending-products`, disponível para toda pendência aberta (XML comum, fora do padrão e manual). Abre um diálogo com motivo obrigatório (5 a 500 caracteres) e chama `POST /api/admin/pending-products/{id}/reject`. A pendência vira `recusada` (`motivo_recusa`, `recusado_por`, `recusado_por_nome`, `recusado_em`) e nada entra no estoque. | system_admin | Must |
| RF-18 | Na recusa, o registro da NF remove o item de `produtos_pendentes`, acrescenta-o a `produtos_recusados` (com motivo e data) e recalcula o status (`success` se não sobrar pendência aberta). A clínica recebe no sino a notificação `nf_pending_rejected`: "O produto X da NF (ID n) não foi cadastrado no catálogo. Motivo: …". | system | Must |
| RF-19 | Ao salvar o manual (`POST /api/nf-imports/manual`), os itens Rennova com produto ativo no catálogo entram no estoque. Os itens Rennova sem produto ativo e com código no padrão viram pendências `pending_master_products` no **mesmo** registro e ID (criação ou complemento), com ID determinístico. O registro fica `novo_produto_pendente`, e o alerta do system_admin é gerado (RF-08). O 422 atual deixa de existir para produto **ausente**; produto **inativo** também vira pendência (D6-A). | clinic_admin / system | Must |
| RF-20 | Se o manual gerar pendências, a página **não redireciona**. Ela mostra uma tela de resultado ("Nota fiscal salva — ID n" ou "Lançamento adicionado à NF já cadastrada (ID n)") com um `Alert` amarelo: "Os produtos X, Y e Z não foram inseridos no estoque. O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações." Os botões são "Ver Estoque" e "Novo lançamento". Sem pendências, o comportamento continua o atual (toast e redirecionamento). | clinic_admin | Must |
| RF-21 | Quando o produto da pendência manual é cadastrado ou ativado no catálogo, a incorporação automática existente lança o item no estoque (convertendo embalagens pela regra do catálogo, como no XML), atualiza o registro e notifica a clínica com a mesma mensagem `nf_pending_resolved`. | system | Must |
| RF-22 | Depois de uma recusa, a clínica pode relançar o item (por exemplo, com outro código) como complemento manual no mesmo ID. Isso já vale hoje para NF de origem manual. Para NF de origem XML, só quando o registro tem item recusado (D7-A). | clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | O tenant vem só do token nas rotas de clínica. A rota de recusa é exclusiva do system_admin (`is_system_admin == true` e `active`) e obtém o tenant **da pendência**, nunca do corpo. | Multi-tenant / Segurança |
| RNF-02 | Nenhuma escrita nova de client em coleções de importação. `admin_notifications` é criada só pelo Admin SDK e lida só pelo system_admin, que pode alterar apenas `read` e `read_at` (D3-A1). A recusa é feita só pelo servidor. | Segurança |
| RNF-03 | A transação continua sendo a única checagem autoritativa de duplicidade. A rota de consulta é informativa. | Confiabilidade |
| RNF-04 | Orçamento de escrita: XML `3 + linhas + (gerou pendência ? 1 : 0)`; manual (pior caso, antes da transação) `4 + linhas`. | Confiabilidade |
| RNF-05 | O formato do código fica centralizado em `isCatalogProductCode`, com o mesmo padrão da rule (`^[1-9][0-9]{4,7}$`). | Manutenibilidade |
| RNF-06 | Nenhum log novo com CNPJ completo, chave, conteúdo do XML ou motivo de recusa. | Segurança |
| RNF-07 | As rotas GET respondem com `Cache-Control: no-store` e `dynamic = 'force-dynamic'`. | Correção |
| RNF-08 | O sino do admin usa `orderBy('created_at','desc') + limit(30)` em coleção de raiz. Sem índice composto novo. | Performance |
| RNF-09 | A recusa é idempotente: só uma pendência `aberta` pode ser recusada (verificado dentro da transação). A incorporação ignora pendências recusadas (já filtra `status == 'aberta'`). | Confiabilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | **Código do catálogo:** só dígitos, sem zeros à esquerda, de 5 a 8 dígitos (`^[1-9][0-9]{4,7}$`). | Decisão do usuário. |
| RN-02 | **Código fora do padrão:** `codigo` normalizado do XML que não satisfaz RN-01. Entram aqui o alfanumérico ou com símbolos, o `'0'`, o código com mais de 8 dígitos e o código com **menos de 5 dígitos**. | Decisão do usuário (D1). |
| RN-03 | Uma linha XML fora do padrão sempre vira pendência (`fora_do_padrao: true`), sem consulta ao catálogo e sem bloquear o resto. | Decisão do usuário. |
| RN-04 | Uma pendência fora do padrão nunca é incorporada automaticamente. Nenhum master pode ter esse código (rule + `validateProductCode`), e a incorporação parte do código do master. "Reprocessar" não é oferecido. Ela sai da fila **só por "Recusar"**. Exceção teórica: master criado por script com Admin SDK (F4). | Decisão do usuário (D4 resolvida pela recusa). |
| RN-05 | A incorporação **não** filtra por `fora_do_padrao`. Se o formato do catálogo for ampliado no futuro, essas pendências passam a ser incorporáveis pelo fluxo normal. A flag é informativa. | Evita pendência presa por flag obsoleta. |
| RN-06 | **Alerta do system_admin:** um por importação XML ou lançamento manual (criação ou complemento) que gerar ao menos uma pendência, criado na mesma transação. IDs: `nf_pendencias_{tenantId}_{importId}` (XML) e `nf_pendencias_{tenantId}_{importId}_m{n}` (manual, em que `n` é o número do lançamento). Escopo: toda pendência (D8-A). | Decisão do usuário (D2-A). |
| RN-07 | `hasPending` (mensagem de reenvio e rota de consulta) considera só pendências incorporáveis (`fora_do_padrao !== true`). | F2. |
| RN-08 | **Matriz de duplicidade** (RN-02 do BUGFIX anterior, mais o ajuste da Parte C): <br>(1) identidade inexistente → XML e manual **criam**; <br>(2) identidade com origem `manual` → manual **complementa** o mesmo ID; XML é **bloqueado** (409); <br>(3) identidade com origem `xml` → XML **bloqueado**; manual **bloqueado**, **exceto** se o registro tiver `produtos_recusados` não vazio, caso em que manual **complementa** o mesmo ID (D7-A). <br>A checagem antecipada e a transação usam a mesma função (`evaluateIdentityConflict`). | Decisão do usuário (Parte C, item 7). |
| RN-09 | A checagem antecipada não substitui a transação. Numa corrida entre a consulta e a confirmação, o 409 continua vindo da transação. | Decisão do usuário. |
| RN-10 | A marcação "fora do padrão" só existe no XML. No manual Rennova, o código informado à mão **precisa** estar no padrão (o modal e o servidor bloqueiam). No manual "Outras marcas", o código é livre e nunca vira pendência. | Parte C, item 1. |
| RN-11 | **Pendência manual:** item Rennova cujo código normalizado não tem master **ativo**. Grava quantidade e valor **como informados** (embalagens e valor por embalagem) e a validade do input. A conversão em unidades acontece na incorporação, pela regra do catálogo (`planPendingResolution`), igual ao XML. Produto **inativo** também vira pendência (D6-A). | Parte C, item 1. |
| RN-12 | **ID da pendência manual:** `{tenantId}_{importId}_m{n}_{linha}`, em que `n = (lancamentos_manuais ?? 0) + 1` lido na transação e `linha` é o índice do item no lançamento. Não colide com o XML (`{tenantId}_{importId}_{linha}`) nem entre lançamentos, porque `n` cresce a cada complemento dentro da mesma transação que grava. | Parte C, item 3. |
| RN-13 | **Recusa:** só de pendência `aberta`; motivo obrigatório (5 a 500 caracteres depois do `trim`). Na mesma transação: a pendência vira `recusada`; o registro remove uma ocorrência de `(codigo, lote)` de `produtos_pendentes`, acrescenta `{codigo, nome_produto, lote, motivo, recusado_em}` a `produtos_recusados` e passa a `success` se não sobrar pendência; a notificação `nf_pending_rejected` é criada para a clínica. Nada entra no estoque. | Parte C, item 6. |
| RN-14 | Uma pendência recusada não volta a ficar aberta. Para lançar o item, a clínica faz um complemento manual (RN-08), que gera estoque ou uma pendência nova. | Parte C, item 7. |
| RN-15 | Pendências manuais usam os mesmos campos das pendências XML (`codigo`, `nome_produto`, `lote`, `quantidade`, `valor_unitario`, `dt_validade`, `numero_nf`, `serie`, `cnpj_emitente`, `nf_import_id`, `id_sequencial`, `linha`, `status`), mais `origem: 'manual'` e `lancamento: n`. A incorporação não muda (F5). | Parte C, item 5. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

1. **Função pura única de formato** em `src/types/masterProduct.ts`:
   - `CATALOG_CODE_PATTERN` e `isCatalogProductCode(normalizado)`;
   - `validateProductCode(raw)`: só dígitos → remove zeros → padrão.

   Planejador, formulários, modal manual, preview e tela do admin importam daqui. A rule repete o padrão literal, com comentário cruzado.
2. **Planejamento XML** (`planXmlLines`): uma linha fora do padrão vai para `pending` com `fora_do_padrao: true`, antes da consulta ao catálogo. `confirmXmlImport` exclui esses códigos da consulta `in`.
3. **Planejamento manual** (`planManualLines`, novo): cada item Rennova termina num de três destinos:
   - master ativo → `inventory`;
   - código fora do padrão → `invalid` (400, porque o client deveria ter bloqueado);
   - sem master ativo → `pending` (ou `invalid` para inativo, conforme D6).

   Itens de "Outras marcas" vão sempre para `inventory`. **O servidor decide pelo catálogo.** O client não manda uma flag "pendente", só os dados, e um item que o client julgou pendente mas cujo produto foi ativado nesse meio-tempo entra direto no estoque.
4. **Transação manual** (`confirmManualLaunch`):
   - `readConflict` passa a devolver também `lancamentos_manuais`, `produtos_pendentes` e `produtos_recusados` do registro (o registro já é lido);
   - complemento: `produtos_pendentes` = existentes + novos, por **leitura-modificação-escrita**. `arrayUnion` não é usado, porque fundiria linhas idênticas. O status vira `novo_produto_pendente` se houver pendência nova;
   - leitura do `tenants/{tenantId}` para `tenant_name`, só quando há pendência;
   - a resposta passa a trazer `pendentes`.
5. **Persistência das marcações:**
   - `pending_master_products` ganha `fora_do_padrao?`, `origem` e `lancamento?`;
   - `nf_imports.produtos_pendentes[]` ganha `fora_do_padrao?`;
   - `nf_imports` ganha `produtos_recusados[]`.

   `removeResolvedPendentes` (espelhada) compara só código e lote, então não muda.
6. **Alerta do system_admin (D2-A + D3-A1):**
   - coleção de raiz `admin_notifications`, criada só pelo Admin SDK nas transações de importação e lançamento;
   - lida só pelo system_admin, que pode alterar apenas `read`/`read_at`;
   - componente `AdminNotificationBell` na sidebar do `AdminLayout`.

   Não reaproveita `tenants/{t}/notifications`: essa coleção pertence à clínica, e `useNotifications` é amarrado a `tenantId`.
7. **Recusa: API route Next com Admin SDK**, `POST /api/admin/pending-products/[id]/reject`, em vez de callable:
   - a lógica pura fica em `src/lib`, sem espelho em `functions/src`;
   - é testável com o padrão de mocks das rotas existentes;
   - evita a limitação conhecida de região dos callables no emulador local (`src/lib/firebase.ts`, registrada no BUGFIX anterior);
   - segue o padrão de `src/app/api/access-requests/[id]/reject/route.ts`.

   O serviço `rejectPendingProduct` (`src/lib/services/pendingRejectionServer.ts`) roda numa transação: lê a pendência (`aberta`?) e o registro `tenants/{tenant_id da pendência}/nf_imports/{nf_import_id}`, e grava pendência, registro e notificação.
8. **Tela de resultado no manual (RF-20):** step novo `'resultado'` em `add-products`, mostrado só quando `pendentes.length > 0`, para que o aviso não se perca no redirecionamento.
9. **Rota de consulta** `GET /api/nf-imports/identidade`:
   - mesmas guardas das rotas irmãs; valida com `validateManualIdentity`;
   - `lookupNfIdentity` devolve só fatos (existe, ID, origem, `hasPending`, `hasRejected`);
   - a mensagem é montada no client com `evaluateIdentityConflict` (função pura), então o texto é idêntico ao do 409.
10. **Fail-open** na consulta (D5).

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Recusar a NF inteira (422) por código fora do padrão | Decisão do usuário: não travar. |
| Gravar a linha fora do catálogo direto no estoque | Item sem `produto_id`, categoria nem fragmentação; quebra relatórios. |
| Manter o 422 para produto Rennova ausente no manual | Substituído por decisão do usuário (Parte C). |
| Flag "pendente" enviada pelo client no manual | O servidor já lê o catálogo na transação. Confiar no client permitiria pular o estoque de um produto ativo. |
| `arrayUnion` em `produtos_pendentes` no complemento | Funde objetos idênticos (duas linhas iguais virariam uma). |
| Callable `rejectPendingMasterProduct` em `functions/src` | Exigiria espelhar `removeResolvedPendentes` e as mensagens. Também não roda no emulador local (região) e não segue o padrão de teste de rotas. |
| "Marcar como verificado" para fora do padrão | Substituído pela recusa (decisão do usuário, D4). |
| Coleção `codigos_fora_do_padrao` separada | Duplica a pendência, que já tem todos os dados. |
| Filtrar `fora_do_padrao` na incorporação | RN-05. |
| Badge derivado no menu, sem coleção nova | Recusado (D2-A). |
| Rota de consulta devolvendo a mensagem pronta | Duplicaria textos; a função pura no client garante o mesmo texto. |
| Ler `nf_identidades` pelo client SDK | Coleção restrita; abrir leitura ampliaria a superfície. |
| Rule de update de `master_products` estrita | F1. |

### 4.3 Trade-offs aceitos

- **Limite de linhas:** o XML cai de 497 para 496 quando há pendência (1 escrita para o alerta). O manual usa o pior caso (`4 + N`), então o limite passa de 497 para 496 itens por lançamento. Irrelevante no volume real.
- **Uma ida a mais ao servidor** no "Continuar" do manual e no preview do XML (leituras por ID).
- **Pendência manual com dados digitados:** o nome e o código vêm do usuário. Um código digitado errado vira pendência que o system_admin recusa (é exatamente o caso de uso da recusa).
- **`produtos_recusados` cresce** no documento do registro, com poucos itens por NF. Aceitável.
- **Status `success` com itens recusados:** o registro não fica "pendente" para sempre. O histórico fica em `produtos_recusados`. Não há status novo, para não mexer em quem já lê `NFImportStatus`.
- **Fallback do client pelo formato** na tela do admin (`!isCatalogProductCode`): pendências antigas sem flag também caem na seção certa.

### 4.4 Decisões do usuário (15/10/2026)

| ID | Decisão | Onde está refletida |
|---|---|---|
| — | Catálogo de 5 a 8 dígitos sem zeros à esquerda; rule `^[1-9][0-9]{4,7}$` | RN-01, RF-01, 6.1, 6.5, STEP 1 |
| — | `cProd` alfanumérico ou com mais de 8 dígitos vira pendência fora do padrão; não trava | RN-02, RN-03, RF-03/04 |
| — | A incorporação nunca resolve fora do padrão; documentar | RN-04, RN-05 |
| — | Seção agrupada por código com clínica(s), código, descrição e NF; prefill sem truncar; badge no preview | RF-05/06/07/09 |
| — | `CLAUDE.md` não muda (`COD_REGEX` é do parser PDF removido) | 1.1, 5.5 |
| — | Parte B: rota GET, manual bloqueia (XML) ou avisa (manual), upload com botão desabilitado, transação autoritativa | RF-11 a RF-14, RN-08, RN-09 |
| **D1** | Código com **menos de 5 dígitos** no XML também é fora do padrão. | RN-02 |
| **D2-A** | Coleção `admin_notifications` (só o servidor grava) + sino no painel do system_admin, com um alerta por importação ou lançamento. | RF-08, RN-06, 4.1 (item 6) |
| **D3-A1** | O system_admin pode alterar só `read`/`read_at` do alerta. | 6.5, 8.3 |
| **D4** | Resolvida pela ação "Recusar"; não existe "Marcar como verificado". | RN-04, RF-17/18 |
| **D5** | Falha da consulta antecipada: o fluxo segue com aviso. | RF-14 |
| Verificação | Leitura do usuário em 15/10/2026: dev 73 produtos (72 × 7 dígitos, 1 × 6) e produção 70 (69 × 7, 1 × 6); nenhum fora de `^[1-9][0-9]{4,7}$`. | 1.1, STEP 1 |
| Parte C | Produto Rennova fora do catálogo no manual vira pendência no mesmo ID; badge "Pendente de cadastro"; aviso amarelo legível; incorporação cobre o manual; "Recusar" com motivo para XML, fora do padrão e manual; clínica avisada; relançamento como complemento. | RF-15 a RF-22, RN-10 a RN-15 |

### 4.5 Decisões da Parte C (15/10/2026) — resolvidas

Todas resolvidas pelo usuário em 15/10/2026, pela **opção A** (a recomendada). Não há `⚠️ Decisão necessária` em aberto.

| ID | Pergunta | Decisão | Onde está refletida |
|---|---|---|---|
| D6 | Produto Rennova **inativo** informado à mão no lançamento manual | **A:** vira pendência, igual ao XML. A reativação do produto dispara a incorporação (`shouldResolvePendingForProduct`, `active` de false para true). Se o produto foi descontinuado de propósito, o system_admin recusa. Não existe 422 para inativo. | RN-11, RF-19, `planManualLines` (6.2), STEP 13 passo 19, 8.1 |
| D7 | Relançar item recusado numa NF importada via XML | **A:** manual sobre registro XML vira **complemento** no mesmo ID só quando o registro tem `produtos_recusados` não vazio. Sem recusa, continua bloqueado (409). XML sobre registro manual continua bloqueado. | RN-08 (3), RF-22, `evaluateIdentityConflict` com `hasRejected` (6.2), `buildComplementNotice` (origem `xml`), STEP 13 passo 23 |
| D8 | Escopo do alerta no sino do system_admin | **A:** um alerta para **toda** importação XML ou lançamento manual que gerar **qualquer** pendência (comum ou fora do padrão), com o texto separando as duas. | RF-08, RN-06, `buildPendingAdminAlertMessage` (6.2), orçamento XML `checkWriteBudget(4, linhas)` (6.4), STEP 13 passo 5 |

As alternativas B (422 para produto inativo; nenhum complemento sobre NF XML; alerta XML só para fora do padrão) foram descartadas e **não devem ser implementadas**.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito |
|---|---|---|
| `src/app/api/nf-imports/identidade/route.ts` | API route | `GET`: consulta de identidade (Parte B). |
| `src/app/api/admin/pending-products/[id]/reject/route.ts` | API route | `POST`: recusa de pendência (Parte C). |
| `src/lib/services/pendingRejectionServer.ts` | Serviço server-only | `rejectPendingProduct` (transação Admin SDK). |
| `src/lib/nfPendingRejection.ts` | Lib pura | `validateRejectReason`, `applyRejectionToImport`, `buildPendingRejectedMessage`. |
| `src/lib/outOfPatternPendings.ts` | Lib pura | `isOutOfPatternPending`, `groupOutOfPatternPendings`. |
| `src/types/adminNotification.ts` | Tipos | `AdminNotification`. |
| `src/lib/services/adminNotificationService.ts` | Serviço (client SDK) | `subscribeToAdminNotifications`, `markAdminNotificationAsRead`, `markAllAdminNotificationsAsRead`. |
| `src/components/admin/AdminNotificationBell.tsx` | Componente | Sino do system_admin. |
| `src/components/admin/RejectPendingDialog.tsx` | Componente | Diálogo de recusa com motivo. |
| `src/__tests__/outOfPatternPendings.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/nfPendingRejection.test.ts` | Jest | Seção 8.1. |
| `src/__tests__/nfIdentityLookupRoute.test.ts` | Jest | Seção 8.2. |
| `src/__tests__/pendingRejectionRoute.test.ts` | Jest | Seção 8.2. |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `src/types/masterProduct.ts` | `CATALOG_CODE_PATTERN`, `isCatalogProductCode`; `validateProductCode` reescrita; `formatProductCode` com limite 8; comentário de `code`. |
| `src/__tests__/masterProductService.test.ts` | Casos novos e invertidos. |
| `src/app/(admin)/admin/products/new/page.tsx` | Limite 8, textos, prefill condicionado (RF-07). |
| `src/app/(admin)/admin/products/[id]/page.tsx` | Limite 8, textos, validação só se o código mudou (RF-02). |
| `firestore.rules` | `master_products` (5 a 8 dígitos e update relaxado); bloco `admin_notifications`. |
| `tests/rules/firestore-tenant-subcollections.test.ts` | `master_products`, `admin_notifications`, regressão de `pending_master_products`. |
| `src/lib/nfImportPlanner.ts` | `planXmlLines` com `fora_do_padrao`; `planManualLines`; `listOutOfPatternCodes`; `hasResolvablePending`; `evaluateIdentityConflict` com `hasRejected`; `buildComplementNotice`; `buildPendingAdminAlertMessage`. |
| `src/__tests__/nfImportPlanner.test.ts` | Casos novos. |
| `src/types/nf.ts` | `NFProdutoPendente` (+ `lote`, `fora_do_padrao?`); `NFProdutoRecusado`; `NfIdentityLookupResponse`. |
| `src/types/pendingMasterProduct.ts` | `status` + `'recusada'`; `origem?`, `lancamento?`, `fora_do_padrao?`, `motivo_recusa?`, `recusado_por?`, `recusado_por_nome?`, `recusado_em?`. |
| `src/types/notification.ts` | `NotificationType` + `'nf_pending_rejected'`; `metadata` + `motivo?`. |
| `src/lib/services/notificationService.ts` | `by_type` com `nf_pending_rejected: 0`. |
| `src/components/notifications/NotificationBell.tsx` | Ícone `X` vermelho (ou `PackageX`) para `nf_pending_rejected`. |
| `src/lib/services/nfImportServer.ts` | `confirmXmlImport` (flag, consulta `in` sem fora do padrão, alerta); `confirmManualLaunch` (pendências manuais, complemento com leitura-modificação-escrita, alerta, `pendentes` no retorno); `readConflict` com dados do registro; `lookupNfIdentity`; `PendingSummary` + `fora_do_padrao?`. |
| `src/lib/validations/nfManualLaunchValidation.ts` | Sem mudança de contrato. O código Rennova fora do padrão é tratado no servidor (`invalid` → 400 na rota). |
| `src/app/api/nf-imports/xml/route.ts` | Orçamento `checkWriteBudget(4, linhas)` (pior caso, com o alerta; ver 6.4); `pendentes[].fora_do_padrao`. |
| `src/app/api/nf-imports/manual/route.ts` | `checkManualWriteBudget(4, N)`; resposta com `pendentes`; `invalid` de código → 400. |
| `src/__tests__/nfImportRoutes.test.ts` | Novos casos (Seção 8.2). |
| `src/lib/services/pendingMasterProductService.ts` | Mapeia os campos novos. |
| `src/app/(admin)/admin/pending-products/page.tsx` | Coluna "Origem"; seção fora do padrão; botão "Recusar" + diálogo; âncora. |
| `src/components/admin/AdminLayout.tsx` | `AdminNotificationBell` na sidebar. |
| `src/app/(clinic)/clinic/upload/page.tsx` | Badge e `Alert` fora do padrão; listas separadas; textos novos; consulta de identidade; bloqueio do "Confirmar". |
| `src/app/(clinic)/clinic/add-products/page.tsx` | Modo "informar manualmente" no modal; badge "Pendente de cadastro"; step `'resultado'`; checagem no Passo 2; aviso de complemento. |

### 5.3 Arquivos a REMOVER

| Arquivo | Motivo |
|---|---|
| — | Nenhum. |

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| `master_products` | Rule + valor | Código de 5 a 8 dígitos; update relaxado (F1). Nenhum documento existente afetado (verificação de 15/10/2026). |
| `pending_master_products/{id}` | Campos + IDs novos | `fora_do_padrao?`, `origem` (`'xml'` \| `'manual'`; ausente = `'xml'`), `lancamento?`, `status` + `'recusada'`, campos de recusa. IDs manuais `{t}_{importId}_m{n}_{linha}`. Rules inalteradas (só system_admin lê; escrita só Admin SDK). Sem índice novo: a listagem continua `status == 'aberta'` + `created_at desc`. |
| `tenants/{t}/nf_imports/{id}` | Campos novos | `produtos_pendentes[].fora_do_padrao?`, `produtos_recusados[]`. Rules inalteradas. |
| `tenants/{t}/nf_identidades/{chave}` | Leitura nova (Admin SDK) | Rota de consulta. Rules inalteradas. |
| `tenants/{t}/notifications` | Valor | Novo tipo `nf_pending_rejected`, gravado pela rota de recusa (Admin SDK). Rules inalteradas. |
| `admin_notifications/{id}` | **Nova** | Criação só Admin SDK; leitura só system_admin; update só de `read`/`read_at`. Sem índice composto. |
| `tenants/{t}` | Leitura na transação | Só para o `tenant_name` do alerta, quando há pendência. |

**Multi-tenant:**
- `admin_notifications` e `pending_master_products` são globais e de uso exclusivo do system_admin. Carregam o `tenant_id`, e nenhuma clínica as lê.
- As rotas de clínica tiram o tenant do token.
- A rota de recusa tira o tenant da **pendência** (documento gravado pelo servidor) e escreve só em `tenants/{esse tenant}/…`.

### 5.5 O que NÃO muda

- `src/lib/parseNfeXml.ts` e `POST /api/parse-nf-xml`.
- `functions/src/*` (pendingResolution, onMasterProductWritten, reprocessPendingMasterProducts, nfPendingResolutionRules): a incorporação já cobre pendências manuais (F5). O teste de paridade não muda.
- `.github/workflows/*`: nenhuma function nova.
- `firestore.indexes.json` e `storage.rules`.
- `CLAUDE.md` (o `COD_REGEX` é do parser PDF removido).
- `scripts/import-master-products*.js`.
- O manual "Outras marcas" e o cálculo de fragmentação (`calcularQuantidadeInventario`).

---

## 6. Especificação Técnica

### 6.1 Modelo de dados

```ts
// src/types/masterProduct.ts
export const CATALOG_CODE_PATTERN = /^[1-9][0-9]{4,7}$/; // espelhado na rule de master_products
export function isCatalogProductCode(codigoNormalizado: string): boolean;
export function validateProductCode(code: string): boolean;
// '12345'/'12345678'/'00012345'/'309960' → true · '1234'/'123456789'/'0'/''/'12A45'/'123-45' → false
export function formatProductCode(code: string): string; // só dígitos, até 8
```

```ts
// src/types/nf.ts (só o que muda)
export interface NFProdutoPendente {
  codigo: string; nome_produto: string; lote: string;
  fora_do_padrao?: boolean;
}
export interface NFProdutoRecusado {
  codigo: string; nome_produto: string; lote: string;
  motivo: string; recusado_em: Date | Timestamp;
}
export type NfIdentityLookupResponse =
  | { existe: false }
  | { existe: true; importId: string; idLabel: string; origem: NFOrigem; hasPending: boolean; hasRejected: boolean };
```

```ts
// src/types/pendingMasterProduct.ts (DEPOIS)
export interface PendingMasterProduct {
  id: string;                 // XML: `${t}_${importId}_${linha}` · manual: `${t}_${importId}_m${n}_${linha}`
  tenant_id: string;
  nf_import_id: string; id_sequencial: number;
  numero_nf: string; serie: string; cnpj_emitente: string;
  origem?: NFOrigem;          // ausente = 'xml' (pendências anteriores)
  lancamento?: number;        // manual: n do lançamento
  linha: number;
  codigo: string; nome_produto: string; lote: string;
  quantidade: number;         // como na NF (embalagens)
  valor_unitario: number;     // como na NF (por embalagem)
  dt_validade: Date | Timestamp; dt_fabricacao?: Date | Timestamp; sem_rastro?: boolean;
  fora_do_padrao?: boolean;
  status: 'aberta' | 'resolvida' | 'recusada';
  inventory_id?: string; resolved_at?: Date | Timestamp;
  motivo_recusa?: string; recusado_por?: string; recusado_por_nome?: string; recusado_em?: Date | Timestamp;
  created_at: Date | Timestamp;
}
```

```ts
// src/types/notification.ts
export type NotificationType = /* ...existentes... */ | 'nf_pending_resolved' | 'nf_pending_rejected';
// metadata: + motivo?: string
```

```ts
// src/types/adminNotification.ts (NOVO)
export type AdminNotificationType = 'nf_pendencias';
export interface AdminNotification {
  id: string;                     // RN-06
  type: AdminNotificationType;
  title: string;                  // 'Pendências de catálogo em NF-e'
  message: string;                // buildPendingAdminAlertMessage(...)
  read: boolean;
  link: string;                   // '/admin/pending-products' ou '/admin/pending-products#fora-do-padrao'
  created_at: Timestamp | Date;
  read_at?: Timestamp | Date;
  metadata: {
    tenant_id: string; tenant_name: string;
    origem: NFOrigem; nf_import_id: string; lancamento?: number;
    numero_nf: string; serie: string; cnpj_emitente: string;
    codigos_pendentes: string[];    // fora do catálogo (comuns)
    codigos_fora_padrao: string[];  // fora do padrão (só XML)
  };
}
```

### 6.2 Funções puras

```ts
// src/lib/nfImportPlanner.ts (mudanças e novas)
export interface PlannedPendingLine { linha: number; produto: NFProduct; fora_do_padrao: boolean }

export function planXmlLines(produtos, mastersByCode): { inventory: PlannedInventoryLine[]; pending: PlannedPendingLine[] };
// 1) !isCatalogProductCode(codigo) → pending fora_do_padrao:true (sem consultar o mapa)
// 2) master ausente/inativo → pending fora_do_padrao:false · 3) senão → inventory (inalterado)

export function planManualLines(
  tipo: 'rennova' | 'outra_marca',
  produtos: ManualNfProductInput[],          // codigo/lote já normalizados
  mastersByCode: Map<string, MasterLite>
):
  | { ok: true;
      inventory: Array<{ linha: number; produto: ManualNfProductInput; master?: MasterLite; quantidade: number; valor_unitario: number }>;
      pending: Array<{ linha: number; produto: ManualNfProductInput }> }
  | { ok: false; status: 400 | 422; error: string };
// outra_marca → tudo inventory (valores como informados)
// rennova: master ativo → inventory (calcularQuantidadeInventario); !isCatalogProductCode → 400 'Produto {n}: código inválido'
//          sem master ativo → pending (D6-A, inclusive inativo)

export function listOutOfPatternCodes(produtos: Array<{ codigo: string }>): string[];
export function hasResolvablePending(p: Array<{ fora_do_padrao?: boolean }> | undefined): boolean;

export function evaluateIdentityConflict(
  attempt: NFOrigem,
  existing: { nf_import_id: string; origem: NFOrigem; hasPending?: boolean; hasRejected?: boolean } | null
): IdentityConflictDecision;
// novo (D7-A): attempt 'manual' + origem 'xml' + hasRejected → { action: 'complement', nfImportId }
// demais casos e textos INALTERADOS

export function buildComplementNotice(importId: string, origem: NFOrigem): string;
// manual: 'Esta NF já tem lançamento (ID 1005). Os produtos que você adicionar serão incluídos nesse mesmo ID.'
// xml:    'Esta NF foi importada via XML (ID 1000) e tem produto(s) recusado(s). Os produtos que você adicionar serão incluídos nesse mesmo ID.'

export function buildPendingAdminAlertMessage(p: {
  tenantName: string; origem: NFOrigem; importId: string; identity: NFIdentity;
  codigosPendentes: string[]; codigosForaPadrao: string[];
}): string;
// 'Clínica A importou via XML a NF 26229 · série 4 · CNPJ 12.345.678/0001-95 (ID 1003): 1 produto(s) fora do catálogo (9999999) e 3 código(s) fora do padrão (A12, 123456789, 1234).'
// manual: '… lançou manualmente a NF … (ID 1005): 2 produto(s) fora do catálogo (88888888, 7777777).'
// omite a parte vazia; mais de 10 códigos numa parte → 10 + ' e mais {n}'
```

```ts
// src/lib/outOfPatternPendings.ts (NOVO)
export function isOutOfPatternPending(p: { codigo: string; fora_do_padrao?: boolean }): boolean;
// fora_do_padrao === true || !isCatalogProductCode(p.codigo)
export function groupOutOfPatternPendings<T extends PendingMasterProduct & { tenant_nome: string }>(rows: T[]): OutOfPatternGroup[];
// { codigo, descricoes[], clinicas[], ocorrencias[] (created_at desc) }; grupos pela ocorrência mais recente
```

```ts
// src/lib/nfPendingRejection.ts (NOVO)
export function validateRejectReason(raw: unknown): { ok: true; motivo: string } | { ok: false; error: string };
// trim; 5..500 caracteres → 'Informe o motivo da recusa (5 a 500 caracteres).'

export function applyRejectionToImport(
  nf: { produtos_pendentes?: NFProdutoPendente[]; produtos_recusados?: NFProdutoRecusado[] },
  pendente: { codigo: string; nome_produto: string; lote: string },
  motivo: string,
  recusadoEm: Date
): { produtos_pendentes: NFProdutoPendente[]; produtos_recusados: NFProdutoRecusado[]; status: 'success' | 'novo_produto_pendente' };
// usa removeResolvedPendentes (src/lib/nfPendingResolutionRules) para remover UMA ocorrência
// status: 'novo_produto_pendente' se restar pendente, senão 'success'

export function buildPendingRejectedMessage(nomeProduto: string, importId: string, motivo: string): string;
// 'O produto X da NF (ID 1000) não foi cadastrado no catálogo. Motivo: …'
```

### 6.3 Serviços server-only

**`confirmXmlImport`** (mudanças):
1. `foraDoPadrao = listOutOfPatternCodes(produtos)`; a consulta `in` usa só códigos no padrão.
2. Leituras: `readConflict` → contador → masters → (se o plano tiver pendência) `tenants/{tenantId}`.
3. Os `pendentes` do registro, as pendências e o retorno levam `fora_do_padrao: true` quando aplicável (omitido quando falso). As pendências ganham `origem: 'xml'`.
4. Se houver qualquer pendência (D8-A), grava `admin_notifications/nf_pendencias_{tenantId}_{importId}`.

**`readConflict`** passa a devolver:

```ts
{ nf_import_id; origem; hasPending: hasResolvablePending(pp); hasRejected: (pr ?? []).length > 0;
  lancamentos_manuais?: number; produtos_pendentes: NFProdutoPendente[]; status?: string }
```

**`confirmManualLaunch`** (mudanças):
1. `decision = evaluateIdentityConflict('manual', conflict)`. `complement` agora também cobre o caso XML com recusa (D7-A).
2. Leituras: conflito (registro incluso) → contador (se `create`) → masters (Rennova; todos os códigos no padrão) → `tenants/{tenantId}` (se o plano tiver pendência).
3. `plan = planManualLines(...)`. Se `!ok`, retorna `{ kind: 'invalid', status, error }`.
4. `n = decision.action === 'create' ? 1 : (conflict.lancamentos_manuais ?? 0) + 1`.
5. Criação: o registro nasce com `produtos_importados: plan.inventory.length`, `produtos_pendentes: pendentes`, `status: pendentes.length ? 'novo_produto_pendente' : 'success'` e `lancamentos_manuais: 1`.
6. Complemento: `tx.update(registro, { produtos_importados: increment(inventory.length), lancamentos_manuais: increment(1), produtos_pendentes: [...conflict.produtos_pendentes, ...novos], status: novos.length ? 'novo_produto_pendente' : conflict.status, updated_at })`.
7. Para cada item de inventário, mesmos campos de hoje. Para cada pendência, `tx.set(pending_master_products/{t}_{importId}_m{n}_{linha}, { ...campos RN-15, origem: 'manual', lancamento: n, status: 'aberta', dt_validade: validadeFromInput(...) })`.
8. Se houver pendência, grava `admin_notifications/nf_pendencias_{t}_{importId}_m{n}`.
9. Retorno: `{ kind: 'created' | 'complemented'; importId; produtosImportados; pendentes: PendingSummary[] }`.

**`lookupNfIdentity(tenantId, identity)`:** leituras simples de `nf_identidades/{chave}` e, se existir, de `nf_imports/{id}`. Retorna `{ existe: false }` ou `{ existe: true, importId, origem, hasPending, hasRejected }`.

**`rejectPendingProduct({ pendingId, motivo, uid, actorName })`** (`pendingRejectionServer.ts`), dentro de `adminDb.runTransaction`:
1. `pend = tx.get(pending_master_products/{pendingId})`. Se não existir → `{ kind: 'not_found' }`. Se `status !== 'aberta'` → `{ kind: 'conflict', error: 'Esta pendência já foi resolvida ou recusada.' }`.
2. `nf = tx.get(tenants/{pend.tenant_id}/nf_imports/{pend.nf_import_id})`. Se não existir → `{ kind: 'not_found' }`.
3. `upd = applyRejectionToImport(nf, pend, motivo, new Date())`.
4. Escritas:
   - `tx.update(pend, { status: 'recusada', motivo_recusa, recusado_por: uid, recusado_por_nome: actorName, recusado_em: serverTimestamp })`;
   - `tx.update(nf, { produtos_pendentes, produtos_recusados (recusado_em como Timestamp.fromDate), status, updated_at })`;
   - `tx.set(tenants/{t}/notifications/{auto}, { tenant_id, type: 'nf_pending_rejected', priority: 'high', title: 'Produto não cadastrado no catálogo', message: buildPendingRejectedMessage(...), read: false, created_at, metadata: { nf_import_id, product_names: [nome], product_code: codigo, motivo } })`.
5. Retorna `{ kind: 'rejected', tenantId, importId }`.

### 6.4 API Routes

**`POST /api/nf-imports/xml`** (mudança):
- O orçamento passa a `checkWriteBudget(4, linhas)` (pior caso: alerta). Como a rota não sabe antes da transação quantas linhas viram pendência comum, o pior caso é aplicado sempre.
- `pendentes[]` ganha `fora_do_padrao?`.

**`POST /api/nf-imports/manual`** (mudanças):
- `checkManualWriteBudget(4, N)`.
- `invalid` → status vindo do serviço (400 código inválido).
- Resposta 201/200 com `pendentes: Array<{ codigo; nome_produto; lote }>`.

**`GET /api/nf-imports/identidade`** (nova)
- Guardas: `verifyBearerToken` → `checkParseNfeClaims`. O tenant vem do token; um `tenantId` na query é ignorado.
- Query `cnpj`, `serie`, `numero`, validados com `validateManualIdentity`.
- 200 `NfIdentityLookupResponse` (`Cache-Control: no-store`) | 400 (mensagem de validação) | 401/403 | 500 (sem logar a identidade).

**`POST /api/admin/pending-products/[id]/reject`** (nova)
- `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
- Auth: `verifyBearerToken`, depois `decoded.is_system_admin === true && decoded.active === true`; caso contrário, 403 "Apenas administradores do sistema podem recusar pendências".
- Corpo: `{ motivo: string }`, validado com `validateRejectReason` (400).

```ts
type RejectPendingResponse = { ok: true; importId: string } | { error: string };
// 200 rejected · 400 motivo inválido · 401/403 · 404 pendência ou registro inexistente · 409 já resolvida/recusada · 500
```

### 6.5 Rules

```
function isCatalogCode(code) {
  return code is string && code.matches('^[1-9][0-9]{4,7}$'); // = isCatalogProductCode
}

match /master_products/{productId} {
  allow read: if isAuthenticated();
  allow create: if isSystemAdmin()
    && isCatalogCode(request.resource.data.code)
    && request.resource.data.name is string && request.resource.data.name.size() > 0;
  // Formato só exigido quando o código MUDA (F1).
  allow update: if isSystemAdmin()
    && (request.resource.data.get('code', null) == resource.data.get('code', null)
        || isCatalogCode(request.resource.data.code))
    && (!('name' in request.resource.data)
        || (request.resource.data.name is string && request.resource.data.name.size() > 0));
  allow delete: if isSystemAdmin();
}

// Alertas do system_admin — criados só pelo servidor (Admin SDK). D3-A1:
// o system_admin só marca como lido. Clínicas e consultores não leem.
match /admin_notifications/{notificationId} {
  allow read: if isSystemAdmin();
  allow update: if isSystemAdmin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'read_at'])
    && request.resource.data.read == true;
}
```

`pending_master_products` (só leitura do system_admin), `nf_imports` e `notifications` não mudam. A recusa e as pendências manuais são escritas pelo Admin SDK.

### 6.6 Mudanças na UI

**`/admin/products/new` e `/admin/products/[id]`**
- `formatCodeInput = (v) => v.replace(/\D/g, '').slice(0, 8)`, `maxLength={8}`, textos do RF-01.
- `new`: o prefill só aplica `codigo` se `isCatalogProductCode(normalizeLeadingZeros(param))` (RF-07).
- `[id]`: o formato só é validado se o código normalizado for diferente do original (RF-02).

**`/admin/pending-products`**
- Depois de `loadPending`: `comuns = rows.filter(r => !isOutOfPatternPending(r))`; `grupos = groupOutOfPatternPendings(rows.filter(isOutOfPatternPending))`.
- **Fila de Pendências:**
  - coluna nova "Origem" (badge "XML" ou "Manual"; `origem` ausente = XML) depois de "Importação";
  - ações "Cadastrar Produto", "Reprocessar" e **"Recusar"** (`variant="outline"`, texto destrutivo).
- **Códigos fora do padrão** (`id="fora-do-padrao"`, só se houver grupos):
  - descrição: "Códigos de produto recebidos em NF-e que não seguem o padrão do catálogo Rennova (5 a 8 dígitos numéricos). Eles não entram no estoque nem são incorporados automaticamente. Valide com a Rennova e recuse quando for o caso.";
  - um bloco por código, com badge "{n} clínica(s)", descrições do XML e tabela de ocorrências com "Recusar" por linha.
- **`RejectPendingDialog`:**
  - resumo (clínica, ID, NF, código, produto, lote);
  - `Textarea` "Motivo da recusa (será enviado à clínica)" obrigatório, com contador e validação por `validateRejectReason`;
  - botão "Recusar pendência", que chama `POST /api/admin/pending-products/{id}/reject` com o token;
  - toast "Pendência recusada; a clínica foi notificada." e recarga da lista;
  - 409 → toast com o erro e recarga.
- Hash `#fora-do-padrao`: `scrollIntoView` depois de carregar.

**`AdminLayout` + `AdminNotificationBell`**
- O sino fica ao lado do título da sidebar (com a sidebar recolhida, abaixo de "SA").
- Badge de não lidos; dropdown com os 30 alertas mais recentes (`DropdownMenu` + `ScrollArea`, tempo relativo `ptBR`).
- Clique: `markAdminNotificationAsRead` (`updateDoc { read: true, read_at: serverTimestamp() }`) e `router.push(link)`.
- "Marcar todas como lidas" faz um `writeBatch` só com esses dois campos. Sem exclusão e sem som.

**`/clinic/upload`**
- Depois do parse:
  - `foraDoPadrao = new Set(listOutOfPatternCodes(produtos))`;
  - o catálogo é consultado só para os códigos no padrão;
  - consulta de identidade: se `existe`, `bloqueio = evaluateIdentityConflict('xml', {...}).reason`; se der erro, `avisoConsulta` (RF-14).
- Preview:
  - badge "Código fora do padrão — ficará pendente" (âmbar) para os itens em `foraDoPadrao`;
  - `Alert` "Códigos fora do padrão" com o texto do RF-09;
  - o `Alert` "Produtos fora do catálogo" passa a dizer: "Estes produtos não entrarão no estoque agora. O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações.";
  - com `bloqueio`: `Alert` destrutivo "NF já cadastrada" e "Confirmar" desabilitado.
- Sucesso: dois `Alert`s amarelos (comuns com o texto do RF-10, fora do padrão com o texto do RF-09), cada um listando `código — nome (lote)`.
- `resetUpload` limpa os estados novos.

**`/clinic/add-products`**
- **Passo 2:** `handleContinueToProducts` vira `async`:
  1. `validateManualIdentity`;
  2. `GET /api/nf-imports/identidade` (botão "Verificando...");
  3. `evaluateIdentityConflict('manual', existing)`:
     - `blocked` → toast destrutivo com `reason`, sem avançar;
     - `complement` → toast com `buildComplementNotice(importId, origem)`, `setAvisoComplemento(...)` e avança;
     - `create` → avança;
     - erro → toast do RF-14 e avança.
- **Modal Rennova:**
  - estado `modoManual`. Quando `showSuggestions && filteredProducts.length === 0`, além de "Nenhum produto encontrado", aparece o botão-link "Produto não está no catálogo — informar manualmente", que liga `modoManual` e copia o texto da busca para "Código" se forem só dígitos;
  - em `modoManual`: campos Código, Nome (conforme a NF), Lote, Quantidade e Valor unitário (dica "Informe como está na NF (embalagens)") e Validade, mais o link "Voltar à busca do catálogo";
  - `handleAddProduct` (Rennova e `modoManual`):
    1. `c = normalizeLeadingZeros(codigo)`;
    2. `!isCatalogProductCode(c)` → toast destrutivo "Código inválido" (descrição: "Use de 5 a 8 dígitos numéricos.");
    3. `masterProducts.some(p => normalizeLeadingZeros(p.code) === c)` → toast "Este código está no catálogo: selecione o produto na busca.";
    4. senão, adiciona `{ codigo: c, nome_produto: nome.trim().toUpperCase(), brand: 'Rennova', lote, quantidade: qtdInformada, valor_unitario: valorInformado, dt_validade, pendente_cadastro: true }`, sem conversão.
- **Lista (Passo 3) e revisão:** itens com `pendente_cadastro` levam o `Badge` amarelo "Pendente de cadastro" ao lado do nome. Na revisão, aparece também a nota "Itens pendentes de cadastro não entram no estoque agora."
- **Payload de `handleSaveNF`:** igual ao de hoje. Para os itens pendentes, `quantidade` e `valor_unitario` vão como informados (o tipo local `NFProduct` ganha `pendente_cadastro?: boolean`, que não é enviado).
- **Resposta:**
  - `pendentes.length === 0` → toast e `router.push('/clinic/inventory')`, como hoje;
  - `pendentes.length > 0` → `setResultado(body)` e `setStep('resultado')`. Card com título `Nota fiscal salva — {idLabel}` ou `Lançamento adicionado à NF já cadastrada ({idLabel})`, "{produtosImportados} produto(s) adicionados ao estoque", `Alert` amarelo com o texto do RF-20 (nomes via `Intl.ListFormat('pt-BR')` → "X, Y e Z"), e botões "Ver Estoque" (`/clinic/inventory`) e "Novo lançamento" (reinicia o assistente);
  - 400/409/422 → toast destrutivo, como hoje.

---

## 7. Plano de Implementação

### STEP 1 — Catálogo com 5 a 8 dígitos

**Objetivo:** Fazer o catálogo aceitar e exigir códigos de 5 a 8 dígitos, mantendo produtos legados editáveis.

**Arquivos afetados:**
- `src/types/masterProduct.ts`
- `src/app/(admin)/admin/products/new/page.tsx` e `[id]/page.tsx`
- `firestore.rules` (bloco `master_products`)
- `src/__tests__/masterProductService.test.ts`, `tests/rules/firestore-tenant-subcollections.test.ts`

**Ações:**
1. Implementar a Seção 6.1 (bloco `masterProduct`) e os formulários (Seção 6.6).
2. Trocar a rule (Seção 6.5).
3. Atualizar os testes:
   - `'1'` passa a ser rejeitado e `'12345678'` passa a ser aceito (Jest e rules);
   - `'0123456'` continua aceito no Jest (normaliza para `'123456'`) e recusado na rule (zero à esquerda não normalizado).
4. `git grep -n "slice(0, 7)\|maxLength={7}\|7 dígitos" src` não deve retornar nada de catálogo (`src/lib/precificacao.ts:730` é data `YYYY-MM`).
5. **Dados:** a verificação de 15/10/2026 (Seção 1.1) não encontrou nenhum código fora do padrão. **Repita a mesma leitura antes do deploy manual das rules em produção** se novos produtos tiverem sido cadastrados por script desde então. Pela tela já não é possível, porque a rule antiga só aceita 1 a 7 dígitos e a nova só 5 a 8. Registre o resultado no PR.

**Validação:**
- `npm run test -- masterProductService` e `npm run test:rules` verdes.
- No emulador: `00012345` → gravado `12345`; `1234` → erro; `12345678` → ok; um legado `1234` semeado pode ser desativado na edição.

**Commits:** `feat(admin): accept 5 to 8 digit master product codes` e `test(admin): cover 5 to 8 digit master product code rules`

---

### STEP 2 — Funções puras

**Objetivo:** Implementar e testar toda a lógica de decisão sem tocar no banco.

**Arquivos afetados:**
- `src/lib/nfImportPlanner.ts`
- `src/lib/outOfPatternPendings.ts` (criar)
- `src/lib/nfPendingRejection.ts` (criar)
- `src/types/{nf,pendingMasterProduct,notification,adminNotification}.ts`
- Testes da Seção 8.1

**Ações:**
1. Implementar a Seção 6.2.
2. Nos testes existentes de `nfImportPlanner`, trocar por um código válido (ex.: `3076528`) qualquer literal fora de 5 a 8 dígitos que deva ir para o estoque.

**Validação:** `npm run test -- nfImportPlanner outOfPatternPendings nfPendingRejection` verde; `npm run type-check`.

**Commits:** `feat(inventory): add pure rules for out-of-pattern, manual pending and rejection` e `test(inventory): cover out-of-pattern, manual pending and rejection rules`

---

### STEP 3 — Servidor XML: flag, alerta e orçamento

**Objetivo:** Gravar a marcação de fora do padrão e o alerta do system_admin na importação XML.

**Arquivos afetados:** `src/lib/services/nfImportServer.ts` (`confirmXmlImport`, `readConflict`), `src/app/api/nf-imports/xml/route.ts`, `src/__tests__/nfImportRoutes.test.ts`.

**Validação:**
- `npm run test` verde.
- No emulador, `nfF-fora-padrao.xml` (STEP 13) gera `fora_do_padrao: true` nas pendências e no registro, e cria `admin_notifications/nf_pendencias_test-clinic-a_{id}`.

**Commits:** `feat(api): flag out-of-pattern codes and alert system admin on XML import` e `test(api): cover out-of-pattern pending flags in XML import route`

---

### STEP 4 — Servidor manual: pendências no mesmo ID

**Objetivo:** Fazer itens Rennova sem produto ativo virarem pendência no lançamento manual, em vez do 422.

**Arquivos afetados:** `src/lib/services/nfImportServer.ts` (`confirmManualLaunch`), `src/app/api/nf-imports/manual/route.ts`, `src/__tests__/nfImportRoutes.test.ts`.

**Validação:**
- `npm run test` verde.
- No emulador, via `curl`: lançamento Rennova com `3076528` e `88888888` (sem catálogo) → 201 com `pendentes: [88888888]`, o registro `novo_produto_pendente`, a pendência `{t}_{id}_m1_1` com `origem: 'manual'`, e o alerta `..._m1`.
- Complemento com outro item pendente → pendência `..._m2_0`, `produtos_pendentes` com dois itens.

**Commits:** `feat(api): register manual Rennova items outside the catalog as pending` e `test(api): cover manual pending items in manual launch route`

---

### STEP 5 — Recusa de pendência

**Objetivo:** Permitir ao system_admin recusar uma pendência, com notificação à clínica.

**Arquivos afetados:**
- `src/lib/services/pendingRejectionServer.ts`, `src/app/api/admin/pending-products/[id]/reject/route.ts` (criar)
- `src/types/notification.ts`, `src/lib/services/notificationService.ts`, `src/components/notifications/NotificationBell.tsx` (tipo `nf_pending_rejected`)
- `src/__tests__/pendingRejectionRoute.test.ts` (criar)

**Validação:**
- `npm run test` verde.
- No emulador, `curl -X POST -H "Authorization: Bearer <token system_admin>" -d '{"motivo":"Código inexistente na Rennova"}'` na pendência do STEP 4: a pendência fica `recusada`, o registro fica com `produtos_recusados[1]` e `status: success` (se não houver mais pendências), e a notificação aparece em `tenants/{t}/notifications`. Repetir → 409.

**Commits:** `feat(api): let system admin reject pending NF products` e `test(api): cover pending product rejection route`

---

### STEP 6 — Rules de `admin_notifications`

**Objetivo:** Liberar a leitura dos alertas só ao system_admin, que pode apenas marcá-los como lidos.

**Arquivos afetados:** `firestore.rules`, `tests/rules/firestore-tenant-subcollections.test.ts`.

**Validação:** `npm run test:rules` verde (get **e** list).

**Commits:** `feat(firebase): add admin notifications collection rules` e `test(firebase): cover admin notifications rules for get and list`

---

### STEP 7 — Telas do system_admin

**Objetivo:** Mostrar a seção de fora do padrão, a origem, a ação "Recusar" e o sino.

**Arquivos afetados:**
- `src/app/(admin)/admin/pending-products/page.tsx`
- `src/components/admin/{RejectPendingDialog,AdminNotificationBell,AdminLayout}.tsx`
- `src/lib/services/{adminNotificationService,pendingMasterProductService}.ts`

**Validação:**
- Roteiro C do STEP 13.
- `npm run lint`, `npm run type-check` e `npm run build`.

**Commit:** `feat(admin): list out-of-pattern codes, reject pendings and notify in admin bell`

---

### STEP 8 — Upload: marcação e textos (Parte A)

**Objetivo:** A clínica vê a marcação própria de fora do padrão e os textos novos no preview e no resultado.

**Arquivos afetados:** `src/app/(clinic)/clinic/upload/page.tsx`

**Validação:** Roteiro B do STEP 13 (passos 5–7); `npm run build`.

**Commit:** `feat(inventory): mark out-of-pattern codes in XML preview and result`

---

### STEP 9 — Manual: produto fora do catálogo (Parte C)

**Objetivo:** O modal permite informar à mão um produto fora do catálogo, e a página mostra o resultado com as pendências.

**Arquivos afetados:** `src/app/(clinic)/clinic/add-products/page.tsx`

**Validação:** Roteiro E do STEP 13; `npm run build`.

**Commit:** `feat(inventory): allow manual Rennova items outside the catalog`

---

### STEP 10 — Rota de consulta de identidade

**Objetivo:** `GET /api/nf-imports/identidade` funcionando e testada.

**Arquivos afetados:**
- `src/lib/services/nfImportServer.ts` (`lookupNfIdentity`)
- `src/app/api/nf-imports/identidade/route.ts`
- `src/__tests__/nfIdentityLookupRoute.test.ts`

**Validação:**
- `npm run test -- nfIdentityLookupRoute` verde.
- `curl -H "Authorization: Bearer <token clinic_admin A>" "http://localhost:3000/api/nf-imports/identidade?cnpj=12.345.678/0001-95&serie=001&numero=026229"` → `existe: true` depois do Roteiro D.

**Commits:** `feat(api): add NF identity lookup route` e `test(api): cover NF identity lookup route`

---

### STEP 11 — Bloqueio antecipado no upload

**Objetivo:** O preview mostra o bloqueio de duplicidade antes do "Confirmar".

**Arquivos afetados:** `src/app/(clinic)/clinic/upload/page.tsx`

**Validação:** Roteiro D do STEP 13; `npm run build`.

**Commit:** `feat(inventory): check NF duplicity before confirming XML import`

---

### STEP 12 — Checagem no Passo 2 do manual

**Objetivo:** Bloquear ou avisar no "Continuar" do Passo 2 (fecha `UC-11-RN-06`).

**Arquivos afetados:** `src/app/(clinic)/clinic/add-products/page.tsx`

**Validação:** Roteiro F do STEP 13; `npm run lint`, `npm run type-check` e `npm run build`.

**Commit:** `feat(inventory): check NF duplicity on manual entry step 2`

---

### STEP 13 — Validação Manual

**Objetivo:** Confirmar de ponta a ponta as Partes A, B e C. Este roteiro é a **fonte dos cadernos E2E** (`CLAUDE.md`, regra 8). O `qa-agent` (Modo A) gera ou estende `tests/e2e/UC-10-…`, `UC-11-…`, `UC-12-…`, `UC-31-…` e `UC-44-…`. Revisão humana obrigatória.

**Pré-requisitos:**
- `cd functions && npm run build` e `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage,functions`. O emulador de functions só é necessário para o Roteiro E, passo 21 (incorporação); as functions de e-mail podem avisar sobre secrets ausentes.
- `npm run test:e2e:seed` e `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`.
- Catálogo pelo Emulator UI:
  - `p1 { code: '3076528', name: 'BOTOX 100UI', active: true, fragmentavel: false }`;
  - `p6 { code: '309960', name: 'COLAGENO ELLEVA', active: true, fragmentavel: false }`;
  - `p7 { code: '5550001', name: 'PRODUTO INATIVO', active: false, fragmentavel: false }`.
- XMLs a partir do `makeXml` de `src/__tests__/parseNfeXml.test.ts`, com `Id` calculado por `computeChaveAcessoDV`:
  - `nfA.xml`: CNPJ `12345678000195`, série 1, nNF 26229, `Id` `NFe35250312345678000195550010000262291000262299`, cProd `3076528`;
  - `nfF-fora-padrao.xml`: CNPJ `12345678000195`, série 4, nNF 26229, linhas:

    | Linha | cProd | Lote | Esperado |
    |---|---|---|---|
    | 0 | `3076528` | `BT1` | estoque |
    | 1 | `0309960` | `CL1` | normaliza para `309960`; estoque |
    | 2 | `00A12` | `X1` | normaliza para `A12`; fora do padrão |
    | 3 | `123456789` | `X2` | fora do padrão |
    | 4 | `1234` | `X3` | fora do padrão (D1) |
    | 5 | `9999999` | `L9` | pendência comum |

  - `nfG-fora-padrao-b.xml`: CNPJ `98765432000198`, série 1, nNF 777, cProd `00A12`, para a clínica B.
- Logins `qa.clinic-admin-a@curvamestra.test`, `qa.clinic-admin-b@curvamestra.test` e `qa.system-admin@curvamestra.test`, com `TEST_PASSWORD`.

**Roteiro A — Catálogo (sempre executar):**
1. `/admin/products/new`: código `00012345` → gravado `12345`; `1234` → "Código inválido. Use de 5 a 8 dígitos (zeros à esquerda não contam)."; `12345678` → salvo; o campo não aceita o 9º dígito.
2. Legado `master_products/legado { code: '1234', name: 'LEGADO', active: true }` (Emulator UI) → desativar sem mudar o código → salvo; trocar para `1235` → erro.
3. `/admin/products/new?codigo=00A12&nome=TESTE` → código vazio e nome "TESTE"; `?codigo=0309961` → `309961`.

**Roteiro B — XML com fora do padrão (sempre executar):**
4. Clinic admin A → `nfF-fora-padrao.xml` → "Importar NF-e". **Esperado:**
   - linhas 2–4 com "Código fora do padrão — ficará pendente";
   - linha 5 com "Não cadastrado — ficará pendente";
   - linhas 0–1 sem badge;
   - os dois `Alert`s com os textos novos;
   - nada gravado.
5. Confirmar. **Esperado:**
   - "Importação concluída — ID 100x", com 2 importados;
   - `Alert` de pendentes comuns ("Os produtos … não foram inseridos no estoque. O Administrador do Sistema foi informado…") e `Alert` de fora do padrão;
   - no Emulator UI: 4 pendências (3 com `fora_do_padrao: true` e `origem: 'xml'`), `produtos_pendentes` com as flags e `admin_notifications/nf_pendencias_test-clinic-a_100x` com `codigos_pendentes: ['9999999']` e `codigos_fora_padrao: ['A12','123456789','1234']`.
6. Clinic admin B → `nfG-fora-padrao-b.xml` → confirmar. **Esperado:** 0 importados, 1 fora do padrão e um segundo alerta.

**Roteiro C — system_admin: seção, sino e recusa (sempre executar):**
7. System admin → painel. **Esperado:** sino com badge 2.
8. Clicar no alerta da clínica B (só fora do padrão). **Esperado:** vai para `/admin/pending-products#fora-do-padrao`, rola até a seção e o badge cai para 1.
9. **Esperado** na seção:
   - grupo `A12` com "2 clínica(s)" e as ocorrências das clínicas A e B, com "NF 26229 · série 4 · CNPJ 12.345.678/0001-95" e "NF 777 · série 1 · CNPJ 98.765.432/0001-98";
   - grupos `123456789` e `1234`;
   - só "Recusar" como ação;
   - a fila comum tem `9999999` com origem "XML" e os três botões.
10. Recusar `123456789` da clínica A sem motivo. **Esperado:** botão bloqueado e a mensagem de validação.
11. Motivo "Código não existe no catálogo da Rennova" → recusar. **Esperado:**
    - o toast; o grupo some;
    - no Emulator UI, a pendência fica `recusada` (com motivo, autor e data) e `nf_imports/100x` fica com 3 pendentes e `produtos_recusados[1]`;
    - no sino da clínica A: "O produto … da NF (ID 100x) não foi cadastrado no catálogo. Motivo: Código não existe no catálogo da Rennova."
12. Recusar a mesma pendência por `curl` → 409. Recusar como clinic admin (token de clínica) → 403.
13. Reenviar `nfF-fora-padrao.xml` (clínica A). **Esperado:** o preview bloqueia com "Esta NF já foi cadastrada (ID 100x). Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo." A frase aparece porque `9999999` ainda está aberta e é incorporável.

**Roteiro D — Bloqueio antecipado no XML (sempre executar):**
14. `nfA.xml` → confirmar (ID 1000 se for a primeira) → "Nova Importação" → `nfA.xml`. **Esperado:** `Alert` "Esta NF já foi cadastrada (ID 1000)." e "Confirmar" desabilitado; nada gravado.
15. Corrida: uma NF nova aberta em duas abas até o preview, confirmando nas duas. **Esperado:** uma conclui e a outra recebe 409 (RN-09).

**Roteiro E — Manual Rennova com produto fora do catálogo (sempre executar):**
16. `/clinic/add-products` → Rennova → número `880001`, CNPJ `98.765.432/0001-98`, série `1` → "Continuar". Adicionar `3076528` pela busca. Buscar `88888888` → "Nenhum produto encontrado" mais o botão "Produto não está no catálogo — informar manualmente".
17. No modo manual: código `1234` → "Código inválido"; código `3076528` → "Este código está no catálogo: selecione o produto na busca."; código `088888888` (normaliza para `88888888`), nome "PRODUTO NOVO", lote `N1`, quantidade 2, valor 50, validade futura → adicionado com o badge amarelo "Pendente de cadastro" (também na revisão).
18. Salvar. **Esperado:**
    - **não** redireciona;
    - tela de resultado "Nota fiscal salva — ID 100y", com 1 produto no estoque e o `Alert` amarelo "Os produtos PRODUTO NOVO não foram inseridos no estoque. O Administrador do Sistema foi informado…";
    - no Emulator UI: pendência `test-clinic-a_100y_m1_1` (`origem: 'manual'`, `lancamento: 1`, `quantidade: 2`, `valor_unitario: 50`), registro `novo_produto_pendente` e alerta `..._m1`.
19. D6-A: novo lançamento manual na mesma NF com o código `5550001` (inativo) informado à mão. **Esperado:** o modal aceita (o código não está na lista de ativos); ao salvar, "Lançamento adicionado à NF já cadastrada (ID 100y)" com o `Alert` amarelo; pendência `..._m2_0`.
20. System admin → a fila mostra as duas pendências com origem "Manual".
21. Incorporação (com o emulador de functions): cadastrar `88888888` ativo e reativar `5550001`. **Esperado:** as duas pendências ficam `resolvida`, os itens entram no estoque da clínica A (convertidos pela regra do catálogo; ex.: se `88888888` for fragmentável com 10 unidades, 2 embalagens viram 20 unidades a R$ 5), o registro passa a `success`, e o sino da clínica mostra "A NF (ID 100y) foi atualizada: …". Sem o emulador de functions, validar em dev (Roteiro H).
22. Relançamento depois de recusa (manual): numa NF manual nova com uma pendência, recusar a pendência e lançar de novo pelo Passo 2 com a mesma identidade. **Esperado:** aviso de complemento e item com outro código salvo no mesmo ID.
23. Relançamento depois de recusa (XML, D7-A): na NF `nfF` (ID 100x, com 1 recusado), lançamento manual com a identidade da `nfF`. **Esperado:** Passo 2 com o aviso "Esta NF foi importada via XML (ID 100x) e tem produto(s) recusado(s)…", complemento salvo no mesmo ID e `lancamentos_manuais: 1`. Com uma NF XML **sem** recusa (`nfA`), o resultado continua bloqueado.

**Roteiro F — Checagem no Passo 2 (sempre executar):**
24. Manual com a identidade de `nfA` → "Continuar". **Esperado:** "Verificando…" e depois o toast "Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual."; permanece no Passo 2.
25. Identidade nova → avança sem aviso. Identidade de NF manual existente → aviso de complemento; ao salvar, "Lançamento adicionado…".
26. D5: bloquear a URL `/api/nf-imports/identidade` no DevTools → aviso "Não foi possível verificar agora…" e avanço.

**Roteiro G — Rules (sempre executar; complementa `npm run test:rules`):**
27. Clinic admin A: `getDoc` e `getDocs` em `admin_notifications` → negados; `updateDoc` em `pending_master_products/...` → negado.
28. System admin: `setDoc` e `deleteDoc` em `admin_notifications` → negados; `updateDoc({ read: true, read_at })` → permitido; `updateDoc({ message })` → negado; `updateDoc` de `status: 'recusada'` em `pending_master_products` → negado (a recusa só passa pela rota).

**Roteiro H — Domínio Firebase pessoal (após o merge em `gscandelari_setup`):**
29. Em `dev-gscandelari.web.app`:
    - repetir os passos 1, 4, 5, 7–11, 14, 16–18, 21 e 24, incluindo a NF-e 026229 (`CLAUDE.md`);
    - conferir que `309960` continua editável e recebe estoque via XML;
    - conferir que as rules publicadas pelo workflow de dev contêm `^[1-9][0-9]{4,7}$` e o bloco `admin_notifications`.

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Jest — funções puras

| Função | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `isCatalogProductCode` | `masterProductService.test.ts` | `'12345'`, `'309960'`, `'3076528'`, `'12345678'` → true; `'1234'`, `'123456789'`, `'0'`, `''`, `'A12'`, `'12A45'`, `'012345'` → false. |
| `validateProductCode` | idem | `'00012345'`, `'0123456'`, `' 12345 '` → true; `'1'`, `'1234'`, `'0000'`, `''`, `'123456789'`, `'12A4567'`, `'123-456'` → false. |
| `formatProductCode` | idem | `'12a345678'` → `'12345678'`. |
| `planXmlLines` | `nfImportPlanner.test.ts` | `A12` → `fora_do_padrao: true` mesmo com master `A12` no mapa; `123456789` e `1234` → fora do padrão; `309960` sem master → pending comum; com master ativo → inventory; NF mista com `linha` preservada. |
| `planManualLines` | idem | `outra_marca` com código `AB1` → inventory; Rennova ativo → inventory com fragmentação; ausente no padrão → pending; inativo → pending (D6-A); `1234` → 400 com índice do produto; mistura com contagens corretas. |
| `listOutOfPatternCodes` | idem | distintos; ordem; vazio. |
| `hasResolvablePending` | idem | `undefined`/`[]` → false; só fora do padrão → false; misto → true; sem flag → true. |
| `evaluateIdentityConflict` | idem | **regressão** de todos os textos atuais; manual × xml com `hasRejected` → complement; manual × xml sem recusa → blocked; xml × xml com `hasRejected` → blocked; xml × manual → blocked. |
| `buildComplementNotice` | idem | texto exato para `manual` e `xml`. |
| `buildPendingAdminAlertMessage` | idem | XML só comuns; XML só fora do padrão; misto; manual; 12 códigos → 10 + " e mais 2". |
| `isOutOfPatternPending` / `groupOutOfPatternPendings` | `outOfPatternPendings.test.ts` | fallback sem flag; duas clínicas num grupo; descrições deduplicadas; ordenação; `created_at` nulo. |
| `validateRejectReason` | `nfPendingRejection.test.ts` | `'    '` → erro; 4 caracteres → erro; 5 → ok (com trim); 501 → erro; não string → erro. |
| `applyRejectionToImport` | idem | remove uma ocorrência (duas iguais → sobra uma); acrescenta a `produtos_recusados` existente; status `success` quando esvazia e `novo_produto_pendente` quando sobra; `produtos_recusados` ausente → cria. |
| `buildPendingRejectedMessage` | idem | texto exato. |

A paridade de `functions/src/nfPendingResolutionRules.ts` não muda e continua verde.

### 8.2 Jest — rotas (lógica de segurança, prioridade alta)

**`src/__tests__/nfIdentityLookupRoute.test.ts`** (mocks de `../lib/firebase-admin` e `@/lib/services/nfImportServer`)

| Cenário | Esperado |
|---|---|
| Sem token / token inválido | 401; serviço não chamado |
| `clinic_user`, consultor, system_admin sem tenant, `active: false` | 403 |
| CNPJ com DV inválido / série ausente / número `000` | 400 com a mensagem de validação |
| Valores com máscara e zeros | serviço chamado com `{ cnpj: '12345678000195', serie: '1', numero: '26229' }` |
| `?tenantId=outro` | serviço chamado com o tenant do token |
| `existe: false` / `existe: true` | 200 com `Cache-Control: no-store`; `idLabel: 'ID 1000'`, `hasPending`, `hasRejected` |
| Serviço lança erro | 500 sem a identidade no `console.error` |

**`src/__tests__/pendingRejectionRoute.test.ts`** (mocks de `../lib/firebase-admin` e `@/lib/services/pendingRejectionServer`)

| Cenário | Esperado |
|---|---|
| Sem token / token inválido | 401 |
| `clinic_admin`, consultor, system_admin com `active: false` | 403; serviço não chamado |
| Motivo ausente, vazio ou com 501 caracteres | 400 |
| Serviço `not_found` / `conflict` / `rejected` | 404 / 409 / 200 `{ ok: true, importId }` |
| Corpo com `tenant_id` forjado | ignorado (o serviço recebe só `pendingId`, `motivo`, `uid` e `actorName`) |
| Serviço lança erro | 500 sem o motivo no `console.error` |

**`src/__tests__/nfImportRoutes.test.ts`** (novos)

| Cenário | Esperado |
|---|---|
| XML 201 | `pendentes[].fora_do_padrao` repassado |
| XML com 496 linhas → 201; com 497 → 422 sem chamar o serviço | Orçamento de 4 escritas fixas |
| Manual: serviço `created` com `pendentes` | 201 com `pendentes` |
| Manual: serviço `invalid` com status 400 (código) | 400 |
| Manual: com 496 itens → ok; com 497 → 422 | — |
| Manual: o 422 de produto ausente **deixa de existir** | O caso antigo é removido ou ajustado |

### 8.3 Regras — `npm run test:rules` (`tests/rules/firestore-tenant-subcollections.test.ts`)

Toda leitura é testada com **get** (`getDoc`) **e list** (`getDocs(query(collection(...)))`), conforme a lição do PR #344.

| Coleção | Cenário | Esperado |
|---|---|---|
| `master_products` | system_admin cria `'12345'`, `'309960'`, `'3076528'`, `'12345678'` | sucesso |
| | system_admin cria `'1234'`, `'123456789'`, `'0123456'`, `'A1234'`, `'0'`, `''` | falha |
| | seed `3076528` → update de código para `'12345678'` / `'1234'` | sucesso / falha |
| | seed legado `'1234'` → update `{ active: false }` / update de código para `'1235'` | sucesso / falha |
| | clinic_admin A cria `'12345'` | falha |
| `admin_notifications` (seed `nf_pendencias_a_1000`) | system_admin: get e list | sucesso |
| | clinic_admin A, clinic_user A, consultor com acesso, clinic_admin B: get e list | falha |
| | system_admin: `setDoc` novo / `deleteDoc` | falha |
| | system_admin: `updateDoc({ read: true, read_at })` | sucesso |
| | system_admin: `updateDoc({ message })` / `updateDoc({ read: false })` | falha |
| | clinic_admin A: `updateDoc({ read: true })` | falha |
| `pending_master_products` (seed `origem: 'manual'`, `fora_do_padrao: true`) | system_admin: get e list | sucesso |
| | clinic_admin A: get e list | falha |
| | system_admin: `updateDoc({ status: 'recusada' })` | falha (a recusa só passa pela rota) |
| `tenants/{t}/notifications` | regressão: clinic_admin A get e list com seed `nf_pending_rejected` | sucesso |

### 8.4 E2E (cadernos — `CLAUDE.md`, regra 8)

- `npm run test:e2e`: regressão completa.
- O `qa-agent` (Modo A) gera ou estende os cadernos a partir do STEP 13. **Extensões de seed e fixtures a sinalizar, não inventar:**
  1. `master_products` no `scripts/seed-emulator.ts` (`3076528`, `309960` e o inativo `5550001`).
  2. Fixtures XML versionadas e anonimizadas (`nfA`, `nfF-fora-padrao`, `nfG-fora-padrao-b`) com `Id` válido.
  3. O legado `1234` criado pelo Admin SDK dentro do teste (Roteiro A, passo 2).
  4. Emulador de functions no `test:e2e` para o Roteiro E, passo 21, ou esse passo marcado como validação só em dev.
  5. Nenhum seed de `admin_notifications`, pendências ou recusas (gerados pelo fluxo).

---

## 9. Checklist de Definition of Done

```
[x] Decisões D1–D8 respondidas e incorporadas (15/10/2026, opção A em D6/D7/D8)
[ ] develop local atualizado (>= 5d5a09b) antes de criar a branch
[ ] npm run lint                — zero erros ou warnings
[ ] npm run type-check          — zero erros TypeScript
[ ] npm run build               — build de produção sem falhas
[ ] cd functions && npm run build — sem erros (nenhuma mudança esperada)
[ ] npm run test                — verde (masterProductService, nfImportPlanner, outOfPatternPendings,
                                  nfPendingRejection, nfImportRoutes, nfIdentityLookupRoute,
                                  pendingRejectionRoute, nfPendingResolutionRules/paridade)
[ ] npm run test:rules          — verde, get E list em todos os cenários de leitura
[ ] npm run test:e2e            — verde (regressão)
[ ] Multi-tenant: tenant do token nas rotas de clínica; rota de recusa usa o tenant da pendência; coleções globais com tenant_id
[ ] Segurança: nenhum secret; nenhum log com CNPJ completo, chave, XML ou motivo; client não cria/apaga admin_notifications nem recusa pendências
[ ] git grep sem "slice(0, 7)" / "maxLength={7}" / "7 dígitos" em telas de catálogo
[ ] Verificação de códigos do catálogo registrada no PR (15/10/2026: dev 73 e prod 70, nenhum fora do padrão; repetir se houver cadastro por script)
[ ] STEP 13 executado (Roteiros A–H)
[ ] Branch pessoal: task branch mergeada em gscandelari_setup pelo PR e validada em dev-gscandelari.web.app
[ ] PR gscandelari_setup → develop com template e nota de release:
    "antes do merge em master, publicar manualmente:
     firebase deploy --only firestore:rules,firestore:indexes,storage --project curva-mestra"
[ ] uml-use-case-writer: UC-10, UC-11, UC-12, UC-31, UC-32, UC-44 (avaliar UC próprio para o sino do system_admin)
[ ] uc-issues-tracker (Modo B): fechar UC-31-Q3 e UC-11-RN-06; registrar F3; atualizar UC-12-Decisão-Expiração (recusa)
[ ] qa-agent (Modo A) acionado com as extensões da Seção 8.4; revisão humana
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Rules não publicadas em produção (o CI de produção não as inclui) | Alta, se esquecido | Médio | Nota de release e comando manual. Com a rule antiga, um código de 8 dígitos dá `permission-denied`, e o system_admin não consegue marcar alerta como lido. |
| Rules novas publicadas antes do hosting novo | Média | Baixo | A rule nova recusa os códigos de 1 a 4 dígitos que o formulário antigo aceitaria. Publicar na mesma janela. |
| Clínica usando "informar manualmente" para contornar a busca (código digitado errado) | Média | Baixo | O modal bloqueia código do catálogo ativo e formato inválido; o servidor decide pelo catálogo; o system_admin recusa com motivo. |
| Volume de alertas no sino (D8-A gera alerta para toda pendência) | Média | Baixo | Um alerta por importação ou lançamento, não por linha; só não lidos contam no badge. |
| XML de outro fornecedor enche a seção de fora do padrão | Média | Baixo | Coerente com a premissa Rennova do UC-10; a recusa limpa a fila. |
| Complemento sobre NF XML depois de recusa permitir itens arbitrários (D7-A) | Baixa | Baixo | Mesma liberdade do complemento manual; `lancamentos_manuais` registra o uso no registro. |
| Master criado por script com código fora do padrão (F4) | Baixa | Baixo | Documentado em RN-04. |
| Corrida entre consulta antecipada e confirmação | Baixa | Baixo | RN-09: o 409 da transação continua. |
| Corrida entre recusa e incorporação da mesma pendência | Baixa | Baixo | As duas transações leem a pendência e só agem se ela estiver `aberta`; o Firestore serializa. |
| Divergência entre `CATALOG_CODE_PATTERN` e a regex da rule | Baixa | Médio | Comentário cruzado e os mesmos casos de borda no Jest e no `test:rules`. |
| Testes antigos invertendo expectativa (`'1'`, `'12345678'`, 422 do manual) | Certa | Baixo | Atualizados explicitamente nos STEPs 1 e 4. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Código do catálogo | `master_products.code`: 5 a 8 dígitos, sem zeros à esquerda (`^[1-9][0-9]{4,7}$`). |
| Código fora do padrão | `cProd` normalizado do XML que não satisfaz o formato do catálogo (alfanumérico, `'0'`, menos de 5 ou mais de 8 dígitos). Só sai da fila por recusa. |
| Pendência comum | Linha com código no padrão sem produto ativo no catálogo. É incorporada quando o produto é ativado. |
| Pendência manual | Pendência comum criada pelo lançamento manual Rennova (`origem: 'manual'`). |
| Pendência incorporável | Pendência com `fora_do_padrao !== true`; é a base de `hasPending`. |
| Recusa | Encerramento de uma pendência pelo system_admin, com motivo. Nada entra no estoque e a clínica é notificada. |
| Alerta do system_admin | Documento em `admin_notifications`, mostrado no sino do painel admin. |
| Lançamento (n) | Cada envio manual de uma mesma NF (criação = 1; complementos = 2, 3…). Compõe o ID das pendências manuais. |
| Checagem antecipada | Consulta informativa da identidade da NF antes da confirmação. |
| Checagem autoritativa | A transação de `confirmXmlImport` / `confirmManualLaunch`. |
| Identidade da NF | (CNPJ, série, número) normalizados; chave em `nf_identidades`. |
| `COD_REGEX` | Regex do parser PDF removido, citada no `CLAUDE.md`; não rege o catálogo. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.56): `UC-31-Q3`, `UC-11-RN-06`, destaque 15, `UC-12-RN-01`, `UC-12-Decisão-Expiração`, `UC-32-Q9`.
- UCs: `UC-10-importar-nfe-via-upload-de-xml.md`, `UC-11-inserir-nota-fiscal-manualmente.md`, `UC-12-resolver-produtos-pendentes-de-cadastro.md`, `UC-31-cadastrar-produto-no-catalogo-master.md`, `UC-32-editar-ativar-e-desativar-produto-no-catalogo-master.md`, `UC-44-consultar-e-gerenciar-notificacoes-recebidas.md` (em `ONLY_FOR_DEVS/PO_BA_Docs/`).
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` (v1.2).
- Código:
  - `src/types/{masterProduct,nf,pendingMasterProduct,notification}.ts`;
  - `src/lib/{nfImportPlanner,nfIdentity,nfPendingResolutionRules,inventoryQuantity}.ts`;
  - `src/lib/services/{nfImportServer,masterProductService,pendingMasterProductService,notificationService,accessRequestRouteHelpers}.ts`;
  - `src/lib/validations/{nfeUploadValidation,nfManualLaunchValidation}.ts`;
  - `src/app/api/nf-imports/{xml,manual}/route.ts`, `src/app/api/access-requests/[id]/reject/route.ts`;
  - `src/app/(clinic)/clinic/{upload,add-products}/page.tsx`, `src/app/(admin)/admin/{pending-products,products/new,products/[id]}/page.tsx`;
  - `src/components/admin/AdminLayout.tsx`, `src/components/notifications/NotificationBell.tsx`;
  - `functions/src/{pendingResolution,onMasterProductWritten,reprocessPendingMasterProducts,nfPendingResolutionRules}.ts`;
  - `firestore.rules`, `scripts/import-master-products*.js`, `.github/workflows/{deploy-gscandelari-dev,deploy-firebase}.yml`.
- Testes: `src/__tests__/{masterProductService,nfImportPlanner,nfImportRoutes,nfPendingResolutionRules,parseNfeXml}.test.ts`, `tests/rules/firestore-tenant-subcollections.test.ts`, `tests/e2e/fixtures/seed-data.ts`, `scripts/seed-emulator.ts`.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` (Seções 1, 2 e 15); `CLAUDE.md` (Multi-Tenant, regra 5, regra 8, "Importação via XML NF-e"); `ONLY_FOR_DEVS/TO_DO/ADR-automacao-qa-playwright-firebase-emulator.md`.
- Externas: Firestore Security Rules (`request.resource.data` no update = documento completo; `diff().affectedKeys().hasOnly()`); Firestore transações (leituras antes das escritas; `arrayUnion` deduplica elementos iguais); Next.js 15 Route Handlers.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 15/10/2026 | Doc Writer (Claude) | Versão inicial (arquivo `FEAT-codigo-fora-do-padrao-e-checagem-antecipada-nfe.md`). Partes A e B. Status Aguardando decisão, com D1–D5 pendentes, verificação de códigos e achados F1–F4. Base `develop` @`5d5a09b`. |
| 1.1 | 15/10/2026 | Doc Writer (Claude) | **Decisões do usuário de 15/10/2026 (via coordenador) incorporadas: D1 (menos de 5 dígitos = fora do padrão), D2-A (`admin_notifications` + sino; alerta por importação ou lançamento), D3-A1 (system_admin altera só `read`/`read_at`), D4 (resolvida pela ação "Recusar"), D5 (fail-open com aviso).** Verificação de códigos registrada (dev: 73 produtos, 72 × 7 e 1 × 6 dígitos; produção: 70, 69 × 7 e 1 × 6; nenhum fora de `^[1-9][0-9]{4,7}$`); script temporário do STEP 1 removido, com nota para repetir antes do deploy. **Nova Parte C:** produto Rennova fora do catálogo no manual vira pendência no mesmo ID (RN-11/12/15, `planManualLines`), tela de resultado em vez de redirecionamento, incorporação existente reaproveitada sem mudar as functions (F5), ação "Recusar" por API route com Admin SDK (`nf_pending_rejected`, `produtos_recusados`), relançamento como complemento e matriz RN-08 ajustada (manual sobre XML com recusa). Novos achados F5–F6. Novas decisões pendentes D6 (produto inativo no manual), D7 (complemento sobre NF XML depois de recusa) e D8 (escopo do alerta); Status continua Aguardando decisão. STEPs replanejados (1–13) e commits revistos. Arquivo renomeado para `FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem.md` (o nome sugerido passava de 60 caracteres). Observação: pela convenção do template, uma mudança de escopo desse porte seria versão major (2.0); usado 1.1 por instrução explícita do coordenador. |
| 1.2 | 15/10/2026 | Doc Writer (Claude) | **Decisões D6, D7 e D8 resolvidas pelo usuário em 15/10/2026 (via coordenador), todas pela opção A:** D6 (produto inativo no manual vira pendência), D7 (complemento manual sobre NF XML só com item recusado), D8 (alerta do system_admin para toda importação ou lançamento com pendência). A Seção 4.5 passou a registrar as decisões; as menções ⚠️ foram trocadas pelas decisões e as alternativas B ficaram só como referência. **Status → Planejamento.** Versão minor (1.1 → 1.2) porque as decisões alteram o conteúdo, conforme a convenção do template. |
