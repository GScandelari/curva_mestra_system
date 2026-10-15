# UC-11: Inserir Nota Fiscal Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 2.0

> Um Clinic Admin insere manualmente, produto a produto, uma nota fiscal sem XML disponível, para produtos Rennova (escolhidos no catálogo master) ou de outras marcas (cadastro livre). É o fluxo irmão do UC-10 e compartilha com ele a mesma tela de entrada (`/clinic/add-products`). **[v2.0, BUGFIX-identidade-e-duplicidade-nfe, PR #393]** A nota passa a ser identificada por CNPJ do emitente + série + número (CNPJ e série obrigatórios, chave de acesso opcional e validada), com número, código e lote normalizados. A gravação sai do client e vai para `POST /api/nf-imports/manual`, numa transação Admin SDK. Um novo lançamento da mesma NF complementa o mesmo registro (mesmo "ID 1000"), e uma NF já importada via XML é recusada com 409.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    API([🔧 API route\nPOST /api/nf-imports/manual\nAdmin SDK, transação única])
    MasterCatalog([🔧 Catálogo Master\nmaster_products — só p/ Rennova])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
        UC11(("UC-11\nInserir Nota Fiscal\nManualmente"))
    end

    ClinicAdmin --> UC11
    UC11 -.->|autocomplete de produtos ativos, se Rennova| MasterCatalog
    UC11 -.->|grava ou complementa o registro| API
    API -.->|Rennova: confere produto ativo\ne recalcula fragmentação| MasterCatalog
    UC11 -.->|opção "Importar XML da NF-e" redireciona para| UC10
    UC10 -.->|mesma identidade da NF:\nXML e manual se bloqueiam| UC11
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** (`role: "clinic_admin"`). A página `/clinic/add-products` verifica `claims?.role === 'clinic_admin'` e, para qualquer outro role, mostra o alerta "Acesso Negado" / "Apenas administradores podem inserir notas fiscais manualmente" (desde o commit `216b3a0`, Fluxo de Exceção 8g). **[v2.0]** No servidor, `POST /api/nf-imports/manual` exige o ID token de um `clinic_admin` com `active == true` e `tenant_id` (mesmas guardas da importação XML), e o tenant vem só do token.

### 2.2 Atores Secundários / Sistemas Externos
- **API route `POST /api/nf-imports/manual` (Admin SDK):** valida o corpo, verifica a identidade e grava (ou complementa) o registro e os itens numa transação (`confirmManualLaunch`, `src/lib/services/nfImportServer.ts`).
- **Catálogo master de produtos (`master_products`):** só no tipo "Rennova". O client usa a lista de produtos ativos no autocomplete; o servidor confere, dentro da transação, se cada produto continua ativo e recalcula quantidade e valor dos fragmentáveis.

---

## 3. Pré-condições
- Usuário autenticado com role `clinic_admin`, `active == true` e `tenant_id` definido.
- Usuário tem em mãos os dados da nota (número, série e CNPJ do emitente; chave de acesso, se houver) e de cada produto. Não precisa do arquivo XML.

---

## 4. Pós-condições

### 4.1 Sucesso — NF nova (identidade inexistente)
Gravado pelo servidor, numa única transação:
- `tenants/{tenantId}/contadores/nf_imports` com o novo `ultimo_id`.
- `tenants/{tenantId}/nf_imports/{importId}` (ID sequencial da clínica, a partir de 1000 — UC-10 RN-18) com `id_sequencial`, `tenant_id`, `origem: "manual"`, `identidade`, `numero_nf`, `serie`, `cnpj_emitente`, `chave_acesso` (se informada), `tipo` (`"rennova"`/`"outra_marca"`), `status: "success"`, `produtos_importados`, `produtos_pendentes: []`, `lancamentos_manuais: 1`, `created_by` (UID), `created_at`, `updated_at`. O documento não embute mais o array `produtos`.
- `tenants/{tenantId}/nf_identidades/{identidade}` com `{ nf_import_id, origem: "manual", created_at }`.
- Um item em `tenants/{tenantId}/inventory` por produto, com `nf_id` e `nf_import_id` (alias) iguais ao ID do registro, `nf_numero` normalizado, `codigo_produto` e `lote` sem zeros à esquerda, `dt_validade` como `Timestamp`, `is_rennova`, `brand`, `master_product_id`/`produto_id` (Rennova) e os campos de fragmentação quando aplicável.
- Toast "Nota fiscal salva — ID 1000" / "Os produtos foram adicionados ao inventário" e redirecionamento para `/clinic/inventory`.

### 4.1b Sucesso — complemento de NF manual já cadastrada
- O registro existente é atualizado na mesma transação: `produtos_importados` += N, `lancamentos_manuais` += 1, `updated_at`. **Não** consome ID novo.
- Os N itens novos são gravados no inventário com o **mesmo** `nf_id`.
- Toast "Lançamento adicionado" / "Lançamento adicionado à NF já cadastrada (ID 1000)" e redirecionamento para `/clinic/inventory`.

### 4.2 Falha (Garantias Mínimas)
- Qualquer recusa (400, 401, 403, 409, 422) ou erro (500) não grava nada: identidade, contador, registro e itens estão na mesma transação.
- O usuário permanece na tela de revisão com a lista de produtos intacta; só não consegue salvar com aqueles dados.

---

## 5. Gatilho (Trigger)
Usuário acessa `/clinic/add-products` e percorre o wizard até clicar em "Confirmar e Salvar" na tela de revisão.

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin acessa `/clinic/add-products`. Sistema verifica `isAdmin` (8g) e exibe o Passo 1: "Adicionar Produtos Rennova" ou "Adicionar Outras Marcas".
2. Se o usuário escolher "Rennova", sistema exibe "Como deseja adicionar os produtos Rennova?": "Inserção Manual" (este UC) ou "Importar XML da NF-e" (redireciona para `/clinic/upload`, UC-10 — Fluxo Alternativo 7a). Se escolher "Outras Marcas", vai direto ao Passo 2 (RN-05).
3. **[REESCRITO em v2.0]** Passo 2 ("Dados da Nota Fiscal"): o usuário informa "Número da NF *", "Série *", "CNPJ do emitente *" (máscara `00.000.000/0000-00`, aceita letras nas 12 primeiras posições — CNPJ alfanumérico) e "Chave de acesso (opcional)" (44 caracteres; texto de ajuda "Se informada, precisa conferir com CNPJ, série e número acima."). Quando a normalização muda o número digitado, a tela mostra a dica "Será registrada como {n}" (ex.: `0055501` → `55501`).
4. Usuário clica em "Continuar". Sistema executa `validateManualIdentity`: número só com dígitos e sem zeros à esquerda (inválido se vazio ou só zeros), CNPJ com DV válido (forma canônica de 14 posições), série de 0 a 999 sem zeros à esquerda e, se a chave foi informada, formato, DV e coerência com CNPJ, série e número (RN-08, RN-13). Em erro, toast "Dados da nota fiscal" com a mensagem (8a). Em sucesso, guarda a identidade normalizada e avança. **A duplicidade não é verificada neste passo** (RN-06).
5. Passo 3 ("Produtos"): sistema exibe a identidade da nota no formato "NF 55501 · série 1 · CNPJ 98.765.432/0001-98" e a lista de produtos (inicialmente vazia). Usuário clica em "Adicionar Produto", abrindo um diálogo:
   - **Rennova:** busca por código ou nome (autocomplete local sobre os `master_products` com `active == true`, carregados ao entrar no fluxo Rennova). Ao escolher um produto fragmentável, os rótulos mudam para "Número de Embalagens" e "Valor por Embalagem (R$)", com o cálculo exibido em tempo real.
   - **Outra marca:** código, nome e marca livres.
   - Em ambos: lote, quantidade/embalagens, data de validade e valor unitário/por embalagem.
   - Ao clicar em "Adicionar", sistema valida os campos obrigatórios, normaliza código (outra marca) e lote sem zeros à esquerda (RN-13) e adiciona o produto à lista **local**. Para Rennova fragmentável, o cálculo de quantidade/valor é feito aqui só para exibição; o servidor recalcula ao salvar (RN-02).
   - Usuário repete para cada produto e pode remover itens (7b).
6. Usuário clica em "Revisar e Confirmar" (exige ao menos 1 produto).
7. Passo 4 ("Revisão"): sistema exibe a identidade da nota, a tabela de produtos com o valor total e o aviso de que a ação não pode ser desfeita automaticamente.
8. Usuário clica em "Confirmar e Salvar".
9. **[REESCRITO em v2.0]** Sistema envia para `POST /api/nf-imports/manual` (JSON, `Authorization: Bearer <ID token>`) a identidade normalizada (`numero`, `cnpj`, `serie`, `chave_acesso` se houver), o `tipo` e os produtos. Para Rennova fragmentável, envia o que foi informado (`quantidade` = embalagens e `valor_unitario` = valor por embalagem).
10. A rota valida token e claims (401/403), o corpo (`validateManualLaunchRequest`: identidade, tipo, ao menos um produto, código/nome/lote obrigatórios, quantidade > 0, valor ≥ 0, validade `YYYY-MM-DD` — 400) e o orçamento de escrita (até 497 produtos por lançamento — 422, RN-15).
11. A rota abre uma transação e lê `nf_identidades/{identidade}` (e o registro correspondente, se existir), depois aplica a matriz de UC-10 RN-02: identidade inexistente → cria (passo 12); identidade de origem manual → complementa (Fluxo Alternativo 7d); identidade de origem XML → 409 (8d).
12. Para criar, a transação lê o contador e, se o tipo for Rennova, os produtos do catálogo pelos códigos normalizados. Se algum produto Rennova não existir ou estiver inativo, a transação termina sem gravar e a rota responde 422 (8h, RN-14). Para Rennova, o servidor calcula quantidade e valor com `calcularQuantidadeInventario` e o catálogo do momento; para outra marca, usa os valores informados (RN-02, RN-03).
13. A transação grava o contador, o registro `nf_imports/{importId}` (`lancamentos_manuais: 1`), a identidade e os itens de inventário.
14. A rota responde 201 `{ importId, idLabel, complemento: false, produtosImportados }`. Sistema exibe o toast "Nota fiscal salva — ID 1000" / "Os produtos foram adicionados ao inventário" e redireciona para `/clinic/inventory`.
15. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Usuário escolhe importar via XML (a partir do passo 2, apenas Rennova)
1. Usuário clica em "Importar XML da NF-e".
2. Sistema redireciona para `/clinic/upload` (UC-10); nenhum dado do wizard é aproveitado.
3. Este caso de uso é encerrado.

### 7b. Usuário remove um produto da lista (a partir do passo 5)
1. Usuário clica no ícone de lixeira de um produto.
2. Sistema remove o produto da lista local e exibe o toast "Produto removido".

### 7c. Usuário volta para editar a partir da revisão (a partir do passo 7)
1. Usuário clica em "Voltar e Editar".
2. Sistema retorna ao Passo 3, mantendo a lista de produtos.

### 7d. Lançamento repetido da mesma NF manual — complemento (a partir do passo 11) — **[Novo em v2.0]**
1. A identidade informada já existe com origem `manual` (lançamento fracionado da mesma nota).
2. A transação **não** consome ID novo: atualiza o registro existente (`produtos_importados` += N, `lancamentos_manuais` += 1, `updated_at`) e grava os N itens com o mesmo `nf_id`. Para Rennova, os produtos também precisam estar ativos no catálogo (8h).
3. A rota responde 200 `{ importId, idLabel, complemento: true, produtosImportados }`.
4. Sistema exibe o toast "Lançamento adicionado" / "Lançamento adicionado à NF já cadastrada (ID 1000)" e redireciona para `/clinic/inventory`.

### 7e. Duas confirmações simultâneas da mesma NF manual (a partir do passo 11)
1. O Firestore serializa as transações: a primeira cria o registro; a segunda é refeita, encontra a identidade de origem manual e complementa o mesmo registro (7d).

---

## 8. Fluxos de Exceção

### 8a. Dados da nota inválidos (a partir do passo 4) — **[Reescrito em v2.0]**
1. `validateManualIdentity` recusa os dados do Passo 2.
2. Sistema exibe toast destrutivo "Dados da nota fiscal" com uma destas mensagens: "Número da NF inválido" (vazio, sem dígitos ou só zeros), "CNPJ do emitente inválido" (formato ou DV), "Série inválida", "Chave de acesso inválida" (formato ou DV) ou "A chave de acesso não confere com CNPJ, série e número informados".
3. Permanece no Passo 2. A mesma validação é refeita no servidor (400), caso o client seja contornado.

### 8b. Campos obrigatórios do produto incompletos (a partir do passo 5)
1. Usuário clica em "Adicionar" sem preencher algum campo obrigatório.
2. Sistema exibe toast "Campos obrigatórios" / "Preencha todos os campos para adicionar o produto"; o diálogo permanece aberto.

### 8c. Tentativa de revisar sem produtos (a partir do passo 6)
1. A lista está vazia (o botão já vem desabilitado, mas o handler revalida).
2. Sistema exibe toast "Adicione produtos" / "Adicione pelo menos um produto antes de continuar".

### 8d. NF já importada via XML (a partir do passo 11) — **[Reescrito em v2.0]**
1. A identidade já existe com origem `xml` (UC-10), com ou sem pendências.
2. A rota responde 409 `{ error, importId }`: "Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual."
3. Sistema exibe toast destrutivo "Nota fiscal não pode ser salva" com a mensagem; nada é gravado e o usuário permanece na revisão, com a lista intacta.

### 8e. [REMOVIDO em v2.0] `tenant_id` ausente
O toast "Tenant ID não encontrado" deixou de existir: o tenant vem do token no servidor. Uma sessão sem `tenant_id` válido é recusada pela rota com 403.

### 8f. [Corrigido no commit `16877f1`] Falha durante a gravação dos itens de inventário (histórico)
1. Até o commit `16877f1`, o documento em `nf_imports` era criado com `status: "success"` (via `addDoc`) antes do laço de gravação dos itens, e uma falha no meio do laço deixava a NF incompleta, sem rollback.
2. O commit `16877f1` passou a usar `writeBatch`. **[v2.0]** O batch do client foi substituído pela transação no servidor (RN-07); a garantia "tudo ou nada" continua.

### 8g. [CORRIGIDO no commit `216b3a0`] Usuário não é Clinic Admin (a partir do passo 1)
1. Usuário com role diferente de `clinic_admin` acessa `/clinic/add-products`.
2. Sistema exibe o alerta "Acesso Negado" / "Apenas administradores podem inserir notas fiscais manualmente"; nenhum passo do wizard é renderizado.
3. **[v2.0]** Uma chamada direta à rota por outro role recebe 403 "Apenas administradores ativos da clínica podem importar NF-e".

### 8h. Produto Rennova inexistente ou inativo no catálogo (a partir do passo 12) — **[Novo em v2.0]**
1. Na transação, algum produto Rennova da lista não tem correspondente ativo no catálogo (ex.: desativado depois de entrar na lista local).
2. A rota responde 422: "Produto {código} não está ativo no catálogo Rennova." Nada é gravado.
3. Sistema exibe toast destrutivo "Nota fiscal não pode ser salva" com a mensagem.

### 8i. Lançamento acima do limite de produtos (a partir do passo 10) — **[Novo em v2.0]**
1. O lançamento tem mais de 497 produtos.
2. A rota responde 422: "Esta NF-e tem {n} itens; o limite por importação é 497. Divida o lançamento: os complementos mantêm o mesmo ID."

### 8j. Corpo inválido, erro de rede ou erro inesperado (a partir do passo 9)
1. A rota responde 400 (corpo inválido, por exemplo "Produto 2: data de validade inválida") ou 500, ou a requisição falha.
2. Sistema exibe toast destrutivo com a mensagem recebida ("Nota fiscal não pode ser salva"), ou "Erro ao salvar" / "Não foi possível salvar a nota fiscal" quando a requisição falha. Nada é gravado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[REESCRITA em v2.0 — PR #393]** A duplicidade é verificada pela identidade da NF (CNPJ do emitente + série + número, UC-10 RN-01) em `nf_identidades`, contra todas as NFs da clínica, e segue a matriz de UC-10 RN-02 no servidor: identidade inexistente → cria; identidade manual → **complementa o mesmo registro** (mesmo ID, sem consumir ID novo, `lancamentos_manuais` += 1); identidade XML → 409. A entrada fracionada continua possível, mas agora no mesmo registro. **Antes de v2.0:** `checkNumeroNFStatus` (removida) comparava só `numero_nf`, e cada lançamento manual criava um registro novo. | Decisão do usuário (spec Seção 4.5, "Fracionado" e "Regra (b)"). Confirmado em `confirmManualLaunch` e `evaluateIdentityConflict`. |
| RN-02 | Produtos Rennova fragmentáveis usam a fórmula de UC-10 (`calcularQuantidadeInventario`): quantidade = embalagens × unidades por embalagem; valor unitário = valor por embalagem ÷ unidades. **[v2.0]** O cálculo que vale é o do **servidor**, com o catálogo lido na transação; o client manda embalagens e valor por embalagem, e o cálculo da lista local é só para exibição. O item guarda `fragmentavel`, `unidades_por_embalagem`, `quantidade_embalagens` e `valor_por_embalagem`. | Confirmado em `confirmManualLaunch` e em `handleSaveNF` (payload). |
| RN-03 | Produtos de "outra marca" não passam por `calcularQuantidadeInventario`: quantidade e valor são gravados como informados. | Cadastro livre não tem noção de embalagem. |
| RN-04 | O catálogo master só é consultado no tipo "Rennova": o client carrega os produtos com `active == true` para o autocomplete e, **[v2.0]** no servidor, a transação confere que cada código continua com produto ativo (RN-14). Produtos de outra marca não passam por catálogo. | Confirmado em `loadMasterProducts` e `readMasters`. |
| RN-05 | A opção "Importar XML da NF-e" só aparece no fluxo Rennova. | Confirmado pela ausência do sub-passo de método em "outra marca". |
| RN-06 | **[ATUALIZADA em v2.0]** A checagem de duplicidade só ocorre ao clicar em "Confirmar e Salvar" (agora no servidor), não ao informar a identidade no Passo 2: o usuário pode adicionar todos os produtos e só então descobrir que a NF está bloqueada (409). A comparação original com UC-10 mudou: desde v2.0 o UC-10 também só verifica duplicidade na confirmação (o preview não consulta nada). | Confirmado por leitura de `handleContinueToProducts` (só `validateManualIdentity`) e de `confirmManualLaunch`. Ver Seção 14, item 2. |
| RN-07 | **[ATUALIZADA em v2.0]** A gravação é atômica: até v2.0, um `writeBatch` no client (commit `16877f1`, que já tinha corrigido a gravação sequencial com `addDoc`); desde v2.0, uma transação Admin SDK em `POST /api/nf-imports/manual`, que inclui identidade, contador, registro e itens. Uma falha não deixa gravação parcial. O client não escreve mais em `nf_imports` (UC-10 RN-11). | Confirmado em `confirmManualLaunch` e em `firestore.rules` (`isServerManagedTenantCollection`). |
| RN-08 | **[REESCRITA em v2.0]** O número da NF deixou de ser texto livre: é normalizado para só dígitos e sem zeros à esquerda (`0055501` → `55501`; número vazio ou só com zeros é inválido), e a tela mostra "Será registrada como {n}" quando o valor muda. CNPJ do emitente e série passaram a ser **obrigatórios**; a chave de acesso é **opcional** (nota física ou rasurada), mas, se informada, precisa ter formato e DV válidos e conferir com CNPJ, série e número digitados. | Decisão do usuário (D2/D3/D8, RF-05). Confirmado em `validateManualIdentity` (`nfIdentity.ts`) e no Passo 2 de `add-products/page.tsx`. |
| RN-09 | **[CORRIGIDO — commit `216b3a0`]** `created_by` do registro passou de e-mail para UID. **[v2.0]** Mantido: o servidor grava o `uid` do token. | Confirmado em `confirmManualLaunch`. |
| RN-10 | **[CORRIGIDO — commit `216b3a0`]** `dt_validade` dos itens passou de string para `Timestamp`. **[v2.0]** O servidor grava a data de calendário ao meio-dia UTC (`validadeFromInput`), para cair no mesmo dia em qualquer fuso das Américas. | Confirmado em `nfImportServer.ts`. |
| RN-11 | **[CORRIGIDO — commit `216b3a0`]** Os itens referenciam a NF por `nf_id`, com `nf_import_id` mantido como alias. **[v2.0]** Os dois recebem o ID sequencial do registro (ex.: `"1000"`). | Confirmado em `confirmManualLaunch`. |
| RN-12 | **[CORRIGIDO em v2.0 — achado `UC-11-RN-12` (Baixa, Bug funcional), PR #393]** Antes, o número digitado não era normalizado ("026229" ≠ "26229" do XML; espaços), e a mesma NF podia entrar pelos dois caminhos. Corrigido: número, série, código e lote normalizados nos dois caminhos (RN-08, RN-13) e identidade única por CNPJ + série + número (RN-01). | Spec v1.2; Roteiro D validado no emulador e Roteiro G em `dev-gscandelari.web.app` (15/10/2026). |
| RN-13 | **[NOVA em v2.0]** Código (outra marca) e lote são gravados com `trim` e sem zeros à esquerda, mantendo o restante do texto (`0042` → `42`, `007X` → `7X`). A normalização ocorre ao adicionar o produto à lista e é repetida no servidor. | Decisão do usuário (spec RN-05). Confirmado em `handleAddProduct` e `confirmManualLaunch`. |
| RN-14 | **[NOVA em v2.0]** No tipo Rennova, todo produto do lançamento precisa existir e estar **ativo** no catálogo no momento da gravação; senão, 422 "Produto {código} não está ativo no catálogo Rennova." e nada é gravado. O lançamento manual não gera pendência de catálogo (diferente de UC-10). | Confirmado em `confirmManualLaunch` (`kind: 'invalid'`). |
| RN-15 | **[NOVA em v2.0]** Um lançamento grava até 500 documentos na transação (3 fixos + 1 por produto). Acima de 497 produtos, 422 sugerindo dividir o lançamento: os complementos mantêm o mesmo ID. | Confirmado em `checkManualWriteBudget`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[ATUALIZADO em v2.0]** Gravação atômica numa transação Admin SDK (RN-07), inclusive em concorrência (7e). | Confiabilidade |
| RNF-02 | O autocomplete de produtos Rennova roda no cliente, sobre a lista de `master_products` ativos carregada uma vez ao entrar no fluxo Rennova (sem paginação), e mostra no máximo 10 sugestões. | Performance / Usabilidade |
| RNF-03 | Este fluxo não captura `natureza_operacao`, `forma_pagamento` nem `tipo_nota` (não há XML); os itens criados aqui não exibem o `TipoNotaBadge`. | Confirmado em `confirmManualLaunch`. |
| RNF-04 | **[NOVO em v2.0]** Multi-tenant: o tenant vem só de `claims.tenant_id`; um `tenantId` no corpo é ignorado. | Multi-tenant / Segurança |

---

## 11. Frequência de Uso
Alta. Junto com UC-10, é um dos dois mecanismos principais de entrada de estoque, usado quando a clínica não tem (ou não quer usar) o XML da NF-e.

---

## 12. Casos de Uso Relacionados
- **UC-10 (Importar NF-e via Upload de XML):** fluxo irmão. Compartilha a identidade da NF, `nf_identidades`, o contador de ID, `nf_imports` e a matriz de duplicidade: uma NF cadastrada por um caminho bloqueia o outro.
- **UC-31 / UC-32 (Catálogo Master):** pré-condição indireta do ramo Rennova (produto ativo).
- **UC-50 (Consultar Inventário e Detalhe do Item):** o detalhe do item mostra "NF-e {número} · ID {id}".

---

## 13. Referências
- `src/app/(clinic)/clinic/add-products/page.tsx` (Passo 2 com número, série, CNPJ e chave; `handleContinueToProducts`; `handleAddProduct`; `handleSaveNF` via `POST /api/nf-imports/manual`)
- `src/app/api/nf-imports/manual/route.ts` (**[v2.0]**)
- `src/lib/services/nfImportServer.ts` (**[v2.0]** `confirmManualLaunch`)
- `src/lib/validations/nfManualLaunchValidation.ts` (**[v2.0]** `validateManualLaunchRequest`)
- `src/lib/nfIdentity.ts` (`validateManualIdentity`, `normalizeNumeroNF`, `normalizeLeadingZeros`, `formatNFLabel`, `formatImportId`)
- `src/lib/nfImportPlanner.ts` (`evaluateIdentityConflict`, `checkManualWriteBudget`, `nextImportId`)
- `src/lib/inventoryQuantity.ts` (`calcularQuantidadeInventario`)
- `src/app/(clinic)/layout.tsx` (`ProtectedRoute allowedRoles`)
- `src/types/masterProduct.ts` (`getNomeCompletoMasterProduct`), `src/lib/brandUtils.ts` (`normalizeBrand`)
- `firestore.rules` (`isServerManagedTenantCollection`, bloco `nf_imports` só leitura — UC-10 RN-11)
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` (v1.2); PR #393

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RESOLVIDO em v1.2 — commit `216b3a0`]** Ator restrito a `clinic_admin` (8g).
2. **[A confirmar — RN-06, achado `UC-11-RN-06` no mapa]** A duplicidade só é conhecida ao salvar. A premissa original do achado ("diferente de UC-10, que verifica antes do upload") deixou de valer em v2.0, porque o UC-10 também só verifica na confirmação. O efeito de UX permanece (o usuário pode digitar todos os produtos antes de descobrir o bloqueio). Não está decidido se o achado deve ser mantido, reclassificado ou encerrado.
3. **[RESOLVIDO — commits `16877f1` e `216b3a0`; reforçado em v2.0]** RN-07, RN-09, RN-10 e RN-11.
4. **[RESOLVIDO em v2.0 — PR #393]** `UC-11-RN-12` (número não normalizado).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Confirmado por leitura completa de `add-products/page.tsx` e do layout do grupo de rotas `(clinic)`. Identificadas, além do contexto fornecido, quatro divergências relevantes não mencionadas inicialmente: (1) o ator real inclui `clinic_user`, não só `clinic_admin`; (2) a gravação dos itens de inventário é feita via `addDoc` sequencial, não `writeBatch`, e o status da NF já é fixado como `"success"` antes da gravação — falha parcial não é refletida nem revertida (bug confirmado, RN-07); (3) a checagem de duplicidade só ocorre no último passo do wizard (RN-06); (4) três divergências de nome/tipo de campo em relação aos itens de inventário criados por UC-10 (`created_by`, `dt_validade`, `nf_import_id` vs. `nf_id` — RN-09 a RN-11). |
| 1.1 | 20/07/2026 | Guilherme Scandelari | **Correção de bug (commit `16877f1`)**: RN-07 corrigido — `handleSaveNF` passou a usar `writeBatch(db)` para gravar o documento da NF e todos os itens de inventário atomicamente, em vez de `addDoc` sequencial com o status `"success"` fixado antes da gravação dos itens. Fluxo de Exceção 8f reescrito como histórico "[Corrigido]"; seções 4.1, 4.2, 6 (passos 9-10), 9 (RN-07), 10 (RNF-01) e 14 (item 2) atualizadas para refletir a atomicidade da gravação. Nenhuma das demais divergências confirmadas (ator, RN-06, RN-09 a RN-11) foi alterada por esta correção. |
| 1.2 | 25/07/2026 | Guilherme Scandelari | **Correção de quatro itens de severidade Média (commit `216b3a0`)**: (1) restrição de ator — `add-products/page.tsx` ganhou a mesma checagem `isAdmin` já usada em UC-10, com early-return "Acesso Negado" para `clinic_user`/outros papéis (seção 2.1, novo Fluxo de Exceção 8g); (2) RN-09 — `created_by` passou de e-mail para UID; (3) RN-10 — `dt_validade` passou de string para `Timestamp`; (4) RN-11 — campo `nf_id` adicionado aos itens de inventário (igual a `nf_import_id`, mantido como alias). Seções 2.1, 3, 4.1, 6 (passos 1, 9, 10), 8 (novo 8g), 9 (RN-09/10/11), 13 e 14 (itens 1 e 4) atualizadas de acordo. RN-06 (checagem de duplicidade só no último passo) permanece não corrigida nesta rodada. |
| 2.0 | 15/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Reestruturação as-is: identidade e duplicidade de NF-e (`TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` v1.2; PR #393, merge `2bc543f`; validado em `dev-gscandelari.web.app` em 15/10/2026).** Passo 2 com número (normalizado, dica "Será registrada como {n}"), série e CNPJ do emitente obrigatórios e chave de acesso opcional validada; gravação via `POST /api/nf-imports/manual` numa transação Admin SDK; ID sequencial "ID 1000"; lançamento repetido da mesma identidade complementa o mesmo registro (`lancamentos_manuais`); 409 contra NF importada via XML; Rennova exige produto ativo no catálogo (422). RN-01, RN-08 reescritas; RN-02, RN-04, RN-06, RN-07, RN-09, RN-10, RN-11 atualizadas; RN-12 (`UC-11-RN-12`) registrada como `[CORRIGIDO]`; novas RN-13 (normalização de código e lote), RN-14 (Rennova ativo) e RN-15 (limite de 497 produtos). Fluxos Alternativos 7d (complemento) e 7e (concorrência) novos; Fluxos de Exceção 8a e 8d reescritos, 8e removido, novos 8h, 8i e 8j. Diagrama com a API route. Seções 1-6, 10, 12, 13 e 14 atualizadas (item 2 da Seção 14 sinaliza a reavaliação de `UC-11-RN-06`). Versão major por mudança de escopo do fluxo. |
