# UC-12: Resolver Produtos Pendentes de Cadastro

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 2.0

> Quando uma linha de uma NF-e importada via XML (UC-10) não tem produto ativo no catálogo master, ela vira uma pendência visível ao System Admin em `/admin/pending-products`. **[v2.0, BUGFIX-identidade-e-duplicidade-nfe, PR #393]** A resolução passou a ser automática: assim que o produto fica ativo no catálogo (cadastrado ativo, reativado ou com o código alterado estando ativo), a Cloud Function `onMasterProductWritten` lança as linhas pendentes daquele código no inventário de **todas** as clínicas afetadas, marca cada pendência como `resolvida`, atualiza o registro da importação e notifica a clínica. Na tela, o admin cadastra o produto ("Cadastrar Produto", com código e nome pré-preenchidos) e pode disparar a mesma incorporação manualmente com "Reprocessar", que substituiu "Marcar Resolvido".

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])
    ClinicAdmin([👤 Clinic Admin\ndispara o gatilho indiretamente, via UC-10])
    CloudFn([🔧 Cloud Function\nonMasterProductWritten\n+ callable reprocessPendingMasterProducts])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
        UC12(("UC-12\nResolver Produtos\nPendentes de Cadastro"))
        UC31(("UC-31\nCadastrar Produto no\nCatálogo Master"))
        UC32(("UC-32\nEditar/Ativar/Desativar\nProduto"))
        UC44(("UC-44\nConsultar e Gerenciar\nNotificações"))
    end

    ClinicAdmin -.->|linha sem produto ativo no catálogo| UC10
    UC10 -->|"<<extend>> grava a pendência\n(servidor, mesma transação)"| UC12
    SystemAdmin --> UC12
    UC12 -.->|"Cadastrar Produto"\ncom código/nome pré-preenchidos| UC31
    UC31 -.->|produto criado ativo dispara| CloudFn
    UC32 -.->|reativação ou troca de código\nde produto ativo dispara| CloudFn
    UC12 -.->|"Reprocessar" chama| CloudFn
    CloudFn -.->|lança no inventário e marca\na pendência como resolvida| UC12
    CloudFn -.->|notificação nf_pending_resolved| UC44
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin**, único role com acesso a `/admin/pending-products` (`ProtectedRoute allowedRoles: ['system_admin']`, layout do grupo `(admin)`) e o único que lê `pending_master_products` pelas rules. O callable `reprocessPendingMasterProducts` também exige `is_system_admin == true`.

### 2.2 Atores Secundários / Sistemas Externos
- **Cloud Function `onMasterProductWritten`** (`onDocumentWritten('master_products/{productId}')`, região `southamerica-east1`): ator de sistema que executa a incorporação automática quando um produto fica ativo no catálogo (RN-07, RN-09).
- **Cloud Function callable `reprocessPendingMasterProducts`** (região `southamerica-east1`): executa a mesma incorporação sob demanda, pelo botão "Reprocessar" (RN-08).
- **Clinic Admin:** não interage com esta tela. É quem, ao confirmar uma importação XML (UC-10) com linhas fora do catálogo, origina as pendências; e é quem recebe a notificação quando elas são incorporadas (UC-44).

---

## 3. Pré-condições
- System Admin autenticado (`is_system_admin === true`).
- Existe pelo menos um documento em `pending_master_products` com `status: "aberta"`, criado pelo servidor durante a confirmação de uma importação XML (UC-10, RN-07).
- Para a incorporação: o produto com o código da pendência existe e está ativo em `master_products` (código gravado sem zeros à esquerda, UC-31/UC-32).

---

## 4. Pós-condições

### 4.1 Sucesso — incorporação (automática ou por "Reprocessar")
Para cada grupo de pendências abertas do mesmo código, na mesma clínica e na mesma importação, numa transação:
- Um item novo em `tenants/{tenantId}/inventory` por linha, com os mesmos campos da importação XML: `produto_id` do catálogo, `codigo_produto`, `nome_produto`, `lote`, quantidade e valor calculados com o catálogo do momento (fragmentação, RN-10), `dt_validade` da pendência, `nf_numero`, `natureza_operacao` e `tipo_nota` lidos do registro, `nf_id` igual ao ID da importação, `brand: "Rennova"`.
- A pendência passa a `status: "resolvida"`, com `inventory_id` e `resolved_at`. **Não é apagada** (RN-11).
- O registro `tenants/{tenantId}/nf_imports/{importId}` tem os pares (código, lote) resolvidos removidos de `produtos_pendentes`, `produtos_importados` incrementado e `status` alterado para `success` quando não sobra pendência (senão, continua `novo_produto_pendente`).
- Uma notificação em `tenants/{tenantId}/notifications`: `type: "nf_pending_resolved"`, `priority: "medium"`, título "Produtos incorporados ao estoque", mensagem "A NF (ID 1000) foi atualizada: o produto X foi adicionado ao inventário automaticamente." (ou "os produtos X, Y, Z foram adicionados…", com nomes repetidos uma só vez), `metadata: { nf_import_id, product_names }` (UC-44).
- A pendência resolvida some da fila do admin (que lista só `status == "aberta"`).

### 4.1b Sucesso — "Cadastrar Produto"
- Admin é levado a `/admin/products/new?codigo={codigo}&nome={nome_produto}`, com código e nome pré-preenchidos (RN-01). Ao salvar o produto ativo, a incorporação dispara sozinha (4.1).

### 4.2 Falha (Garantias Mínimas)
- Produto ausente ou inativo no catálogo: nada é incorporado; as pendências continuam `aberta`.
- Uma falha numa transação de incorporação desfaz só aquele grupo (inventário, pendências, registro e notificação do grupo); os demais grupos seguem normalmente, e o erro é registrado no log da function (RN-07).
- Uma pendência que já estava `resolvida` nunca é lançada de novo (RN-10).

---

## 5. Gatilho (Trigger)
- **(Indireto, Clinic Admin)** Durante a confirmação de uma importação XML (UC-10), uma linha não tem produto ativo no catálogo e vira pendência.
- **(Automático, sistema)** Uma escrita em `master_products` deixa um produto ativo: criação com `active: true`, mudança de `active` de `false` para `true`, ou mudança de `code` com o produto ativo (RN-09).
- **(Direto, System Admin)** Acessa `/admin/pending-products` e clica em "Cadastrar Produto" ou "Reprocessar" numa linha.

---

## 6. Fluxo Principal (Basic Flow)

1. **(Pré-requisito, dentro de UC-10)** Na transação de confirmação da importação XML, o servidor grava, para cada linha sem produto ativo no catálogo, o documento `pending_master_products/{tenantId}_{importId}_{linha}` (coleção **top-level**) com `tenant_id`, `nf_import_id`, `id_sequencial`, `numero_nf`, `serie`, `cnpj_emitente`, `linha`, `codigo`, `nome_produto`, `lote`, `quantidade` e `valor_unitario` como na NF, `dt_validade`, `dt_fabricacao` e `sem_rastro` quando houver, `status: "aberta"` e `created_at`.
2. System Admin acessa `/admin/pending-products`.
3. Sistema chama `listPendingMasterProducts()`: `pending_master_products where status == "aberta" orderBy created_at desc` (cross-tenant, índice composto `status ASC, created_at DESC`).
4. Para cada pendência, sistema resolve o nome da clínica via `getTenant(tenant_id)`, com cache em memória por carregamento (7a se falhar).
5. Sistema exibe a tabela "Fila de Pendências" com as colunas **Clínica | Importação ("ID 1000") | NF ("NF 26229 · série 1 · CNPJ 12.345.678/0001-95") | Código | Produto (nome no XML) | Lote | Qtd. | Data**, e duas ações por linha. O texto do card explica que, assim que o produto estiver ativo no catálogo, os itens pendentes de todas as clínicas entram no estoque automaticamente e cada clínica é notificada, e que "Reprocessar" serve para quando o produto já está ativo e o item continua na fila.
6. Se não houver pendências abertas, exibe o estado vazio "Nenhuma pendência" / "Todos os produtos das NFs importadas estão cadastrados no catálogo master".
7. System Admin clica em **"Cadastrar Produto"**: sistema navega para `/admin/products/new?codigo={codigo}&nome={nome_produto}` (valores com `encodeURIComponent`), e a tela de cadastro (UC-31) pré-preenche "Código" e "Nome". O admin completa os demais campos e salva; o produto é criado ativo.
8. **(Automático)** A escrita em `master_products` dispara `onMasterProductWritten`. A função decide, com `shouldResolvePendingForProduct(before, after)`, se há código a resolver (RN-09); se houver, chama `resolvePendingForCode(codigo)`.
9. `resolvePendingForCode` normaliza o código, confirma que existe produto ativo com ele, busca `pending_master_products where codigo == X and status == "aberta"`, agrupa por (clínica, importação) e divide cada grupo em blocos de até 248 linhas.
10. Para cada bloco, numa transação: lê o registro `nf_imports` e as pendências (descartando as que não estão mais `aberta`), calcula quantidade e valor (`planPendingResolution`), grava os itens de inventário, marca as pendências como `resolvida` (com `inventory_id` e `resolved_at`), atualiza o registro e cria a notificação para a clínica (Seção 4.1).
11. Em poucos segundos, as linhas resolvidas deixam de aparecer na fila (depois de "Atualizar" ou de um novo carregamento), os itens aparecem no inventário das clínicas e o sino de cada clínica mostra a notificação.
12. Caso de uso é concluído.

---

## 7. Fluxos Alternativos

### 7a. Falha ao resolver o nome de uma clínica (a partir do passo 4)
1. `getTenant(tenant_id)` lança exceção (ex.: tenant removido).
2. Sistema usa o próprio `tenant_id` como texto da coluna "Clínica", sem interromper o carregamento.

### 7b. "Reprocessar" (a partir do passo 5) — **[Novo em v2.0, substitui "Marcar Resolvido"]**
1. System Admin clica em "Reprocessar" numa linha. Os botões "Reprocessar" ficam desabilitados enquanto a chamada está em andamento, e o da linha mostra "Reprocessando...".
2. Sistema chama o callable `reprocessPendingMasterProducts({ codigo })`, que exige `is_system_admin` e executa a mesma `resolvePendingForCode` dos passos 9-10 para o código da linha (todas as clínicas e importações com pendência aberta daquele código).
3. O callable retorna `{ incorporados, produtoAtivo }`:
   - produto ausente ou inativo (`incorporados == 0` e `produtoAtivo == false`): toast destrutivo "Produto ainda não está ativo no catálogo" / "Cadastre (ou ative) o produto de código {codigo} no catálogo master.";
   - caso contrário: toast "{n} item(ns) incorporado(s)".
4. Sistema recarrega a fila.
5. Uso típico: o produto já estava ativo, mas a linha continua aberta (por exemplo, o produto foi ativado entre a leitura do catálogo e o commit da importação, ou o trigger falhou).

### 7c. Produto reativado ou com código alterado no catálogo (a partir do passo 8)
1. O admin reativa um produto (UC-32) ou altera o código de um produto ativo.
2. O trigger dispara a incorporação para o código (o novo código, no caso de troca), exatamente como nos passos 9-11.

### 7d. Escrita no catálogo que não muda nada relevante (a partir do passo 8)
1. O admin edita outro campo de um produto que já estava ativo, sem mudar o código (ex.: nome), ou desativa/exclui um produto.
2. `shouldResolvePendingForProduct` retorna nulo e nada é incorporado; nenhuma notificação é criada.

---

## 8. Fluxos de Exceção

### 8a. Erro ao carregar a fila (a partir do passo 3)
1. `listPendingMasterProducts()` lança exceção.
2. Sistema exibe toast "Erro" / "Não foi possível carregar os produtos pendentes"; o admin pode clicar em "Atualizar".

### 8b. Erro ao reprocessar (a partir de 7b)
1. O callable falha (rede, `permission-denied` para quem não é system_admin, `invalid-argument` sem código).
2. Sistema exibe toast "Erro" / "Não foi possível reprocessar as pendências"; a fila não muda.

### 8c. Falha numa transação de incorporação (a partir do passo 10)
1. Uma transação de bloco falha (ex.: registro `nf_imports` não encontrado).
2. Só aquele bloco é desfeito; o erro é registrado no log da function e os demais blocos seguem. As pendências do bloco continuam `aberta` e podem ser reprocessadas depois (7b).

### 8d. [REMOVIDO em v2.0] "Marcar Resolvido" sem produto cadastrado/ativo
O botão "Marcar Resolvido" e a função `resolvePendingMasterProduct` (que apagava a pendência) foram removidos. Ver RN-02 (histórico).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[CORRIGIDO no commit `262584f`, PR #355, release v1.11.0 — UC-12-RN-01]** "Cadastrar Produto" navega para `/admin/products/new?codigo={codigo}&nome={nome_produto}` (valores com `encodeURIComponent`), e a tela de cadastro pré-preenche "Código" (via `formatCodeInput`) e "Nome" com `useSearchParams`. Mantido em v2.0. | Confirmado em `pending-products/page.tsx` e `admin/products/new/page.tsx`. |
| RN-02 | **[SUBSTITUÍDO em v2.0 — histórico]** Até v1.2.1, "Marcar Resolvido" apagava a pendência (`resolvePendingMasterProduct`, `deleteDoc`) depois de validar com `getMasterProductByCode` que o produto existia e estava ativo (correção do commit `216b3a0`). Em v2.0, a ação e a função foram removidas e substituídas por "Reprocessar" (RN-08); a pendência deixou de ser apagada (RN-11). | Confirmado em HEAD: nenhum chamador de `resolvePendingMasterProduct`; `pendingMasterProductService.ts` só lista. |
| RN-03 | **[CORRIGIDO em v2.0 — achado `UC-12-RN-03` (Baixa), PR #393]** Antes, uma pendência removida sem resolução real gerava uma pendência nova no próximo reenvio do XML, sem histórico. O cenário deixou de existir: "Marcar Resolvido" foi removido, a pendência não é mais apagada (passa a `resolvida`), o ID é determinístico (RN-04) e o reenvio do XML de uma NF já cadastrada é bloqueado como duplicata (UC-10 RN-02). | Fechamento registrado pelo `uc-issues-tracker` no mapa v3.55, a partir do código. |
| RN-04 | **[REESCRITA em v2.0 — a regra antiga deixou de valer]** Cada pendência é **uma linha** da NF (código + lote), com ID determinístico `{tenantId}_{importId}_{linha}`, gravada pelo servidor na mesma transação da importação. Não há mais consulta de deduplicação por (`tenant_id`, `nf_id`, `codigo`): o mesmo código em duas linhas (ex.: dois lotes) da mesma NF gera duas pendências, e o reenvio da NF é bloqueado antes de criar qualquer coisa. | Confirmado em `confirmXmlImport` (`nfImportServer.ts`). A deduplicação antiga (`registerPendingMasterProducts`) foi removida. |
| RN-05 | **[REESCRITA em v2.0]** `pending_master_products` é top-level, com `tenant_id` em cada documento, e a rule só tem `allow read: if isSystemAdmin()` (`firestore.rules`, l. 334-336). Nenhum client cria, altera ou apaga pendências, nem o system_admin: a importação (API route com Admin SDK) cria, e as Cloud Functions resolvem. A clínica não lê a fila; fica sabendo das pendências pela tela de resultado da importação (UC-10) e da incorporação pela notificação (UC-44). **Antes de v2.0:** qualquer usuário do tenant podia criar pendência (`belongsToTenant`), e a consulta de deduplicação feita como `clinic_admin` era negada pela rule (achado A3 do spec, corrigido). | Confirmado em `firestore.rules` e nos testes de rules (`clinic_admin`: get, list e create negados; system_admin: get e list permitidos, update/delete negados). |
| RN-06 | **[ATUALIZADA em v2.0]** A listagem é cross-tenant, sem paginação e sem filtro por clínica, NF ou período na tela, e traz só pendências `status == "aberta"`, ordenadas por `created_at` decrescente (índice composto `pending_master_products (status ASC, created_at DESC)` em `firestore.indexes.json`). | Confirmado em `listPendingMasterProducts`. |
| RN-07 | **[NOVA em v2.0]** **Incorporação automática:** quando um produto fica ativo no catálogo (RN-09), todas as pendências abertas daquele código, de **todas** as clínicas, são lançadas no inventário. O processamento é agrupado por (clínica, importação), em blocos de até 248 linhas (2 escritas por linha + registro + notificação ≤ 500), um bloco por transação. Uma falha num bloco não interrompe os demais. Para cada bloco: itens de inventário, pendências → `resolvida`, registro atualizado (`produtos_pendentes`, `produtos_importados`, `status`) e uma notificação `nf_pending_resolved` para a clínica. | Decisão do usuário (spec RF-09, RN-07). Confirmado em `functions/src/pendingResolution.ts` (`resolvePendingForCode`, `resolveBlock`). |
| RN-08 | **[NOVA em v2.0]** **"Reprocessar"** chama o callable `reprocessPendingMasterProducts({ codigo })`, só para `is_system_admin` (senão, `permission-denied`; sem código, `invalid-argument`), que roda a mesma incorporação de RN-07 para o código. Retorna `{ incorporados, produtoAtivo }`. Cobre o caso de produto ativado entre a leitura do catálogo e o commit de uma importação, e falhas do trigger. | Confirmado em `functions/src/reprocessPendingMasterProducts.ts` e `pending-products/page.tsx` (`handleReprocess`). |
| RN-09 | **[NOVA em v2.0]** O trigger só incorpora quando o produto **fica** ativo: criação com `active: true`; `active` de não-`true` para `true`; ou `code` alterado com o produto ativo (usa o código novo, normalizado). Produto inativo ou excluído depois da escrita, ou edição de outro campo de um produto que já estava ativo com o mesmo código, não dispara nada. | Confirmado em `shouldResolvePendingForProduct` (`src/lib/nfPendingResolutionRules.ts`, espelhado em `functions/src/nfPendingResolutionRules.ts` com teste de paridade). |
| RN-10 | **[NOVA em v2.0]** A incorporação é idempotente: dentro da transação, só pendências ainda `aberta` são lançadas. Quantidade e valor dos fragmentáveis usam o catálogo **no momento da incorporação** (`calcularQuantidadeInventario`), não o do momento da importação; o item guarda `quantidade_embalagens` e `valor_por_embalagem`. | Spec RNF-08 e Seção 4.3. Roteiro E do spec validado contra o Firestore emulado (fragmentação 2 embalagens → 20 unidades, notificação única, idempotência). |
| RN-11 | **[NOVA em v2.0]** A pendência resolvida **não é apagada**: fica com `status: "resolvida"`, `inventory_id` (o item criado) e `resolved_at`, preservando o histórico. Não há tela que liste pendências resolvidas. | Confirmado em `resolveBlock`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | O nome da clínica é resolvido com cache em memória por carregamento, sem persistência entre reloads. | Performance |
| RNF-02 | Acesso à tela restrito a `system_admin` pelo layout `(admin)`; leitura de `pending_master_products` restrita a system_admin pelas rules; callable restrito a `is_system_admin`. | Segurança |
| RNF-03 | Sem realtime listener: a fila só atualiza ao carregar a página, ao clicar em "Atualizar" ou depois de "Reprocessar". Uma incorporação automática não remove a linha da tela já aberta até um novo carregamento. | Confiabilidade |
| RNF-04 | **[RESOLVIDO no commit `262584f` — RN-01]** Risco de erro de digitação ao copiar o código para a tela de cadastro eliminado pelo prefill. | Usabilidade |
| RNF-05 | **[NOVO em v2.0]** Multi-tenant: cada pendência carrega `tenant_id`, e a incorporação grava só sob `tenants/{tenant_id}/…` da própria pendência (inventário, registro e notificação). | Multi-tenant |
| RNF-06 | **[NOVO em v2.0]** A lógica pura da incorporação vive em `src/lib/nfPendingResolutionRules.ts` e é espelhada manualmente em `functions/src/nfPendingResolutionRules.ts` (o deploy de functions não inclui `src/`), com teste de paridade. | Manutenibilidade |

---

## 11. Frequência de Uso
Ocasional. Depende de quantos produtos novos (ainda não cadastrados ou inativos no catálogo master) aparecem nas NF-e importadas. A incorporação em si é automática.

---

## 12. Casos de Uso Relacionados
- **UC-10 (Importar NF-e via Upload de XML):** origem das pendências (`<<extend>>`). O reenvio do XML para completar deixou de existir.
- **UC-31 (Cadastrar Produto no Catálogo Master):** destino de "Cadastrar Produto", com prefill; criar o produto ativo dispara a incorporação.
- **UC-32 (Editar, Ativar e Desativar Produto no Catálogo Master):** reativar um produto ou trocar o código de um produto ativo também dispara a incorporação.
- **UC-44 (Consultar e Gerenciar Notificações Recebidas):** recebe a notificação `nf_pending_resolved`.
- **UC-50 (Consultar Inventário e Detalhe do Item):** os itens incorporados aparecem no inventário com "NF-e {número} · ID {id}".

---

## 13. Referências
- `src/app/(admin)/admin/pending-products/page.tsx` (colunas novas, "Cadastrar Produto" com prefill, "Reprocessar" via `httpsCallable`)
- `src/lib/services/pendingMasterProductService.ts` (**[v2.0]** só `listPendingMasterProducts`; removidos `registerPendingMasterProducts` e `resolvePendingMasterProduct`)
- `functions/src/onMasterProductWritten.ts`, `functions/src/reprocessPendingMasterProducts.ts`, `functions/src/pendingResolution.ts`, `functions/src/nfPendingResolutionRules.ts` (**[v2.0]**)
- `src/lib/nfPendingResolutionRules.ts` (**[v2.0]** `shouldResolvePendingForProduct`, `planPendingResolution`, `chunkPendingLines`, `buildPendingResolvedMessage`)
- `src/lib/services/nfImportServer.ts` (criação das pendências na transação de UC-10)
- `src/lib/nfIdentity.ts` (`formatImportId`, `formatNFLabel`)
- `src/lib/services/tenantServiceDirect.ts` (`getTenant`)
- `src/types/pendingMasterProduct.ts`
- `src/app/(admin)/admin/products/new/page.tsx` (prefill — RN-01)
- `src/app/(admin)/layout.tsx` (`ProtectedRoute allowedRoles`)
- `firestore.rules` (l. 334-336, `pending_master_products` só leitura do system_admin); `firestore.indexes.json` (`pending_master_products (status ASC, created_at DESC)`)
- Testes: `src/__tests__/nfPendingResolutionRules.test.ts` (inclui paridade com o espelho); `tests/rules/firestore-tenant-subcollections.test.ts`
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` (v1.2); PR #393
- Commit `262584f` (prefill, RN-01), PR #355

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Decisão de produto pendente — `UC-12-Decisão-Expiração`, cross-ref UC-10]** Uma pendência cujo produto nunca entra no catálogo master fica `aberta` para sempre, e o registro da importação continua `novo_produto_pendente`. A incorporação automática resolve o caso em que o produto entra depois, mas não este. Além disso, com a remoção de "Marcar Resolvido", o system_admin **não tem mais nenhuma ação na tela para tirar uma pendência da fila** (correções só por Admin SDK, via script ou console). Não está decidido se deve existir uma ação de "descartar pendência" com aviso à clínica, nem como ela funcionaria.
2. **[RESOLVIDO em v1.2 — commit `216b3a0`; superado em v2.0]** RN-02 ("Marcar Resolvido" sem validação). A ação deixou de existir.
3. **[RESOLVIDO em v2.0 — PR #393]** RN-03 (pendência nova a cada reenvio, sem histórico).
4. **[RESOLVIDO no commit `262584f`]** RN-01 (prefill na tela de cadastro).
5. **[Observação, verificada em código — a confirmar com o usuário; cross-ref UC-31 Seção 14, item 3]** O código do catálogo aceita só dígitos (1 a 7), mas o `codigo` de uma pendência vem do `cProd` normalizado e pode ter letras ou mais de 7 dígitos. Uma pendência assim nunca é incorporada, e o prefill de "Cadastrar Produto" remove as letras e corta em 7 dígitos, gerando um código diferente. Não está confirmado se esse cenário ocorre nas NF-e reais.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, mapeada a partir de contexto detalhado fornecido pelo usuário e confirmada por leitura direta e completa de `pending-products/page.tsx`, `pendingMasterProductService.ts`, `firestore.rules` (regra de `pending_master_products`), `admin/products/new/page.tsx` (confirmado sem prefill) e do layout do grupo `(admin)`. |
| 1.1 | 15/07/2026 | Guilherme Scandelari | Seção 1 (diagrama), 4.1b, 6 (passo 7a) e 12 atualizadas para referenciar o UC-31 (Cadastrar Produto no Catálogo Master), recém-mapeado — antes citado apenas como "UC não mapeado". Seção 12 também passou a referenciar o UC-32 (Editar/Ativar/Desativar Produto). Nenhuma mudança de escopo ou de conteúdo investigativo — apenas rastreabilidade entre documentos. |
| 1.2 | 25/07/2026 | Guilherme Scandelari | **Correção de bug de severidade Média (commit `216b3a0`)**: RN-02 corrigido — "Marcar Resolvido" agora valida, via nova chamada a `getMasterProductByCode(codigo)`, que o produto está cadastrado e ativo no catálogo master antes de permitir a remoção da pendência; antes, era uma limpeza de fila sem nenhuma validação. Seções 1 (diagrama), 4.1, 6 (passo 7b, passo 8), 9 (RN-02, RN-03 com escopo reavaliado), 12, 13 e 14 (itens 1 e 2) atualizadas de acordo. Novo Fluxo de Exceção 8c documenta o bloqueio da ação quando o produto ainda não existe/não está ativo. |
| 1.2.1 | 07/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Fechamento de RN-01 (severidade Baixa), commit `262584f`, PR #355 (branch `chore/patch-10-correcoes-baixa-severidade-2`), release v1.11.0.** O botão "Cadastrar Produto" (`pending-products/page.tsx`) passou a navegar para `/admin/products/new?codigo={codigo}&nome={nome_produto}`; `admin/products/new/page.tsx` ganhou um `useEffect` que lê esses parâmetros via `useSearchParams` e pré-preenche os campos "Código"/"Nome" do formulário. Atualizados resumo do cabeçalho, diagrama (Seção 1), Pós-condição 4.1b, Fluxo Principal (passo 7a), RN-01 (marcada `[CORRIGIDO]`, nascida resolvida), RNF-04 (marcada `[RESOLVIDO]`), Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e item 3 da Seção 14 (marcado `[RESOLVIDO]`). |
| 2.0 | 15/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Reestruturação as-is: incorporação automática de pendências (`TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` v1.2; PR #393, merge `2bc543f`; validado em `dev-gscandelari.web.app` em 15/10/2026 — pendência na fila, "Reprocessar" com produto inexistente, cadastro do produto e incorporação automática com notificação).** Pendência passa a ser uma linha completa da NF, criada pelo servidor na transação de UC-10 com ID determinístico `{tenant}_{importId}_{linha}`; Cloud Function `onMasterProductWritten` incorpora as pendências em todas as clínicas quando o produto fica ativo (criado ativo, reativado ou código alterado), marca `resolvida` (sem apagar), atualiza o registro e notifica a clínica (`nf_pending_resolved`); "Reprocessar" (callable `reprocessPendingMasterProducts`, só system_admin) substitui "Marcar Resolvido"; tabela com Clínica, Importação ("ID 1000"), NF, Código, Produto, Lote, Qtd. e Data; listagem só `status == "aberta"`; rule só leitura do system_admin, sem create do client. RN-02 marcada como substituída (histórico), RN-03 `[CORRIGIDO]`, RN-04 e RN-05 reescritas, RN-06 atualizada, novas RN-07 a RN-11. Novos fluxos 7b (Reprocessar), 7c e 7d e exceções 8b e 8c; 8c antigo removido (8d). Diagrama com a Cloud Function e as relações com UC-32 e UC-44. Seção 14 mantém `UC-12-Decisão-Expiração` em aberto, agora com a observação de que o admin não tem ação na tela para descartar uma pendência. Versão major por mudança de escopo do fluxo. |
