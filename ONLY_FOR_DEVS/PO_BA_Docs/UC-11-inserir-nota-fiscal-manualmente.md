# UC-11: Inserir Nota Fiscal Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 2.1

> Um Clinic Admin insere manualmente, produto a produto, uma nota fiscal sem XML disponível, para produtos Rennova (escolhidos no catálogo master) ou de outras marcas (cadastro livre). É o fluxo irmão do UC-10 e compartilha com ele a mesma tela de entrada (`/clinic/add-products`). **[v2.0, BUGFIX-identidade-e-duplicidade-nfe, PR #393]** A nota passa a ser identificada por CNPJ do emitente + série + número (CNPJ e série obrigatórios, chave de acesso opcional e validada), com número, código e lote normalizados. A gravação sai do client e vai para `POST /api/nf-imports/manual`, numa transação Admin SDK. Um novo lançamento da mesma NF complementa o mesmo registro (mesmo "ID 1000"), e uma NF já importada via XML é recusada com 409. **[v2.1, FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem, PRs #396/#397]** O "Continuar" do Passo 2 já consulta a identidade da NF: bloqueia NF importada via XML (exceto quando ela tem item recusado, caso em que o lançamento complementa o mesmo ID) e avisa quando o lançamento vai complementar um registro existente. No ramo Rennova, um produto fora do catálogo (ou inativo) pode ser informado à mão e vira pendência de cadastro no mesmo ID da NF, incorporada automaticamente quando o produto entra no catálogo (UC-12). Com pendência, a página mostra uma tela de resultado em vez de redirecionar.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    Lookup([🔧 API route\nGET /api/nf-imports/identidade\nchecagem no Passo 2, só leitura])
    API([🔧 API route\nPOST /api/nf-imports/manual\nAdmin SDK, transação única])
    MasterCatalog([🔧 Catálogo Master\nmaster_products — só p/ Rennova])
    SystemAdmin([👤 System Admin\nsino admin_notifications])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
        UC11(("UC-11\nInserir Nota Fiscal\nManualmente"))
        UC12(("UC-12\nResolver Produtos\nPendentes de Cadastro"))
    end

    ClinicAdmin --> UC11
    UC11 -.->|"Passo 2: bloqueia ou avisa complemento"| Lookup
    UC11 -.->|autocomplete de produtos ativos, se Rennova| MasterCatalog
    UC11 -.->|grava ou complementa o registro| API
    API -.->|"Rennova: produto ativo vai ao estoque\ne recalcula fragmentação"| MasterCatalog
    UC11 -->|"<<extend>> Rennova fora do catálogo\nou inativo vira pendência no mesmo ID"| UC12
    API -.->|"alerta quando há pendência"| SystemAdmin
    UC11 -.->|opção "Importar XML da NF-e" redireciona para| UC10
    UC10 -.->|"mesma identidade da NF: XML e manual se bloqueiam,\nexceto complemento após recusa"| UC11
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** (`role: "clinic_admin"`). A página `/clinic/add-products` verifica `claims?.role === 'clinic_admin'` e, para qualquer outro role, mostra o alerta "Acesso Negado" / "Apenas administradores podem inserir notas fiscais manualmente" (desde o commit `216b3a0`, Fluxo de Exceção 8g). **[v2.0]** No servidor, `POST /api/nf-imports/manual` exige o ID token de um `clinic_admin` com `active == true` e `tenant_id` (mesmas guardas da importação XML), e o tenant vem só do token.

### 2.2 Atores Secundários / Sistemas Externos
- **API route `POST /api/nf-imports/manual` (Admin SDK):** valida o corpo, verifica a identidade e grava (ou complementa) o registro e os itens numa transação (`confirmManualLaunch`, `src/lib/services/nfImportServer.ts`).
- **Catálogo master de produtos (`master_products`):** só no tipo "Rennova". O client usa a lista de produtos ativos no autocomplete; o servidor confere, dentro da transação, se cada produto continua ativo e recalcula quantidade e valor dos fragmentáveis. **[v2.1]** Produto ausente ou inativo vira pendência em vez de recusar o lançamento (RN-14, RN-16).
- **[v2.1] API route `GET /api/nf-imports/identidade`:** consulta antecipada da identidade no "Continuar" do Passo 2 (mesmas guardas de `clinic_admin`, tenant só do token). Não grava nada (RN-06).
- **[v2.1] System Admin:** não participa deste UC. Recebe no sino do painel admin um alerta por lançamento com pendência (RN-18) e trata as pendências em `/admin/pending-products` (UC-12), onde pode cadastrar o produto ou recusar a pendência com motivo.

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
- Toast "Nota fiscal salva — ID 1000" / "Os produtos foram adicionados ao inventário" e redirecionamento para `/clinic/inventory` (**[v2.1]** só quando não há pendência; ver 4.1c).

### 4.1b Sucesso — complemento de NF já cadastrada
- **[v2.1]** Vale para registro de origem manual e para registro de origem XML com item recusado (RN-01).
- O registro existente é atualizado na mesma transação: `produtos_importados` += N (só os itens que entraram no estoque), `lancamentos_manuais` += 1, `updated_at`. **Não** consome ID novo.
- Os N itens novos são gravados no inventário com o **mesmo** `nf_id`.
- Toast "Lançamento adicionado" / "Lançamento adicionado à NF já cadastrada (ID 1000)" e redirecionamento para `/clinic/inventory` (**[v2.1]** só quando não há pendência).

### 4.1c Sucesso com pendência de cadastro (Rennova) — **[Novo em v2.1]**
- Cada item Rennova sem produto ativo no catálogo vira o documento `pending_master_products/{tenantId}_{importId}_m{n}_{linha}` (`n` = número do lançamento), com `status: "aberta"`, `origem: "manual"`, `lancamento: n`, a identidade da NF, código, nome, lote, quantidade e valor **como informados** e a validade (RN-16).
- O registro fica `novo_produto_pendente`, com os itens em `produtos_pendentes` (`{ codigo, nome_produto, lote }`); no complemento, os novos são acrescentados aos existentes.
- Na mesma transação, é criado o alerta `admin_notifications/nf_pendencias_{tenantId}_{importId}_m{n}` (RN-18).
- A página não redireciona: mostra a tela de resultado (Fluxo Alternativo 7g).

### 4.2 Falha (Garantias Mínimas)
- Qualquer recusa (400, 401, 403, 409, 422) ou erro (500) não grava nada: identidade, contador, registro e itens estão na mesma transação.
- O usuário permanece na tela de revisão com a lista de produtos intacta; só não consegue salvar com aqueles dados.
- **[v2.1]** A checagem antecipada do Passo 2 não grava nada.

---

## 5. Gatilho (Trigger)
Usuário acessa `/clinic/add-products` e percorre o wizard até clicar em "Confirmar e Salvar" na tela de revisão.

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin acessa `/clinic/add-products`. Sistema verifica `isAdmin` (8g) e exibe o Passo 1: "Adicionar Produtos Rennova" ou "Adicionar Outras Marcas".
2. Se o usuário escolher "Rennova", sistema exibe "Como deseja adicionar os produtos Rennova?": "Inserção Manual" (este UC) ou "Importar XML da NF-e" (redireciona para `/clinic/upload`, UC-10 — Fluxo Alternativo 7a). Se escolher "Outras Marcas", vai direto ao Passo 2 (RN-05).
3. **[REESCRITO em v2.0]** Passo 2 ("Dados da Nota Fiscal"): o usuário informa "Número da NF *", "Série *", "CNPJ do emitente *" (máscara `00.000.000/0000-00`, aceita letras nas 12 primeiras posições — CNPJ alfanumérico) e "Chave de acesso (opcional)" (44 caracteres; texto de ajuda "Se informada, precisa conferir com CNPJ, série e número acima."). Quando a normalização muda o número digitado, a tela mostra a dica "Será registrada como {n}" (ex.: `0055501` → `55501`).
4. Usuário clica em "Continuar". Sistema executa `validateManualIdentity`: número só com dígitos e sem zeros à esquerda (inválido se vazio ou só zeros), CNPJ com DV válido (forma canônica de 14 posições), série de 0 a 999 sem zeros à esquerda e, se a chave foi informada, formato, DV e coerência com CNPJ, série e número (RN-08, RN-13). Em erro, toast "Dados da nota fiscal" com a mensagem (8a). **[REESCRITO em v2.1]** Em sucesso, o botão mostra "Verificando..." e o sistema consulta `GET /api/nf-imports/identidade` com a identidade normalizada (RN-06). Se a NF não existir, avança sem aviso. Se existir, aplica `evaluateIdentityConflict('manual', …)`: bloqueio → toast destrutivo "Nota fiscal já cadastrada" e permanece no Passo 2 (8d); complemento → toast "NF já cadastrada" com o aviso de complemento e avança (7d). Se a consulta falhar, mostra o toast "Verificação de duplicidade" e avança (7h). Ao avançar, guarda a identidade normalizada.
5. Passo 3 ("Produtos"): sistema exibe a identidade da nota no formato "NF 55501 · série 1 · CNPJ 98.765.432/0001-98" (**[v2.1]** e, se for complemento, o alerta "Complemento de lançamento" com o aviso) e a lista de produtos (inicialmente vazia). Usuário clica em "Adicionar Produto", abrindo um diálogo:
   - **Rennova:** busca por código ou nome (autocomplete local sobre os `master_products` com `active == true`, carregados ao entrar no fluxo Rennova). Ao escolher um produto fragmentável, os rótulos mudam para "Número de Embalagens" e "Valor por Embalagem (R$)", com o cálculo exibido em tempo real. **[v2.1]** Se a busca não encontra nada, aparece "Nenhum produto encontrado" e o link "Produto não está no catálogo — informar manualmente" (Fluxo Alternativo 7f).
   - **Outra marca:** código, nome e marca livres.
   - Em ambos: lote, quantidade/embalagens, data de validade e valor unitário/por embalagem.
   - Ao clicar em "Adicionar", sistema valida os campos obrigatórios, normaliza código (outra marca) e lote sem zeros à esquerda (RN-13) e adiciona o produto à lista **local**. Para Rennova fragmentável, o cálculo de quantidade/valor é feito aqui só para exibição; o servidor recalcula ao salvar (RN-02).
   - Usuário repete para cada produto e pode remover itens (7b).
6. Usuário clica em "Revisar e Confirmar" (exige ao menos 1 produto).
7. Passo 4 ("Revisão"): sistema exibe a identidade da nota, a tabela de produtos com o valor total e o aviso de que a ação não pode ser desfeita automaticamente. **[v2.1]** Se for complemento, repete o alerta "Complemento de lançamento". Itens informados à mão aparecem com o badge amarelo "Pendente de cadastro", e a tela mostra a nota "Itens pendentes de cadastro não entram no estoque agora."
8. Usuário clica em "Confirmar e Salvar".
9. **[REESCRITO em v2.0]** Sistema envia para `POST /api/nf-imports/manual` (JSON, `Authorization: Bearer <ID token>`) a identidade normalizada (`numero`, `cnpj`, `serie`, `chave_acesso` se houver), o `tipo` e os produtos. Para Rennova fragmentável, envia o que foi informado (`quantidade` = embalagens e `valor_unitario` = valor por embalagem). **[v2.1]** Itens informados à mão vão no mesmo formato, sem nenhuma flag de "pendente": quem decide é o servidor, pelo catálogo (RN-16).
10. A rota valida token e claims (401/403), o corpo (`validateManualLaunchRequest`: identidade, tipo, ao menos um produto, código/nome/lote obrigatórios, quantidade > 0, valor ≥ 0, validade `YYYY-MM-DD` — 400) e o orçamento de escrita (até 496 produtos por lançamento — 422, RN-15).
11. A rota abre uma transação e lê `nf_identidades/{identidade}` (e o registro correspondente, se existir), depois aplica a matriz de UC-10 RN-02: identidade inexistente → cria (passo 12); identidade de origem manual → complementa (Fluxo Alternativo 7d); identidade de origem XML → 409 (8d), **[v2.1]** exceto quando o registro tem item recusado, caso em que complementa (7d, RN-01).
12. **[REESCRITO em v2.1]** Para criar, a transação lê o contador e, se o tipo for Rennova, os produtos do catálogo pelos códigos normalizados. O servidor planeja cada item (`planManualLines`): outra marca → estoque, com os valores informados (RN-03); Rennova com código fora do padrão (não tem 5 a 8 dígitos) → 400 e nada é gravado (8h); Rennova com produto ativo → estoque, com quantidade e valor calculados por `calcularQuantidadeInventario` e o catálogo do momento (RN-02); Rennova sem produto ativo (ausente ou inativo) → pendência (RN-16). Se houver pendência, a transação lê também `tenants/{tenantId}` (nome da clínica para o alerta).
13. A transação grava o contador, o registro `nf_imports/{importId}` (`lancamentos_manuais: 1`; `status: "novo_produto_pendente"` e `produtos_pendentes` se houver pendência), a identidade, os itens de inventário e, **[v2.1]** se houver, as pendências e o alerta do system_admin (RN-16, RN-18).
14. A rota responde 201 `{ importId, idLabel, complemento: false, produtosImportados, pendentes }`. **[v2.1]** Sem pendência, o sistema exibe o toast "Nota fiscal salva — ID 1000" / "Os produtos foram adicionados ao inventário" e redireciona para `/clinic/inventory`. Com pendência, mostra a tela de resultado (7g).
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

### 7d. Lançamento repetido da mesma NF — complemento (a partir dos passos 4 e 11) — **[Novo em v2.0; ampliado em v2.1]**
1. A identidade informada já existe com origem `manual` (lançamento fracionado da mesma nota) ou, **[v2.1]**, com origem `xml` e item recusado pelo system_admin (`produtos_recusados` não vazio — relançamento do item recusado, RN-01).
2. **[v2.1]** No Passo 2, o sistema já avisa (toast "NF já cadastrada" e alerta "Complemento de lançamento" nos Passos 3 e 4) com uma destas mensagens: "Esta NF já tem lançamento (ID 1005). Os produtos que você adicionar serão incluídos nesse mesmo ID." (origem manual) ou "Esta NF foi importada via XML (ID 1000) e tem produto(s) recusado(s). Os produtos que você adicionar serão incluídos nesse mesmo ID." (origem XML).
3. A transação **não** consome ID novo: atualiza o registro existente (`produtos_importados` += N, `lancamentos_manuais` += 1, `updated_at`) e grava os N itens com o mesmo `nf_id`. **[v2.1]** Itens Rennova sem produto ativo viram pendências `…_m{n}_{linha}`, acrescentadas a `produtos_pendentes`, e o registro passa a `novo_produto_pendente` (RN-16). Sem pendência nova, o status do registro não muda.
4. A rota responde 200 `{ importId, idLabel, complemento: true, produtosImportados, pendentes }`.
5. Sem pendência, o sistema exibe o toast "Lançamento adicionado" / "Lançamento adicionado à NF já cadastrada (ID 1000)" e redireciona para `/clinic/inventory`. **[v2.1]** Com pendência, mostra a tela de resultado (7g).

### 7e. Duas confirmações simultâneas da mesma NF manual (a partir do passo 11)
1. O Firestore serializa as transações: a primeira cria o registro; a segunda é refeita, encontra a identidade de origem manual e complementa o mesmo registro (7d).

### 7f. Produto Rennova fora do catálogo informado à mão (a partir do passo 5) — **[Novo em v2.1, RN-17]**
1. No diálogo "Adicionar Produto" (Rennova), a busca não encontra o produto entre os ativos do catálogo. Sistema mostra "Nenhum produto encontrado" e o link "Produto não está no catálogo — informar manualmente".
2. Usuário clica no link. Sistema abre o modo manual, com o aviso "Este produto ficará pendente de cadastro: ele não entra no estoque agora e o Administrador do Sistema será avisado." e os campos "Código (como na NF)" (copiado da busca se ela tinha só dígitos), "Nome (conforme a NF)", lote, quantidade, validade e valor unitário, com a dica "Informe como está na NF (embalagens)." O link "Voltar à busca do catálogo" desfaz o modo manual.
3. Ao clicar em "Adicionar", o sistema valida os campos obrigatórios (8b) e o código normalizado (sem zeros à esquerda): fora de 5 a 8 dígitos → toast "Código inválido" / "Use de 5 a 8 dígitos numéricos."; código de um produto ativo do catálogo → toast "Produto já está no catálogo" / "Este código está no catálogo: selecione o produto na busca." Nos dois casos, o item não é adicionado.
4. Válido, o item entra na lista com o nome em maiúsculas, quantidade e valor como informados (sem conversão) e o badge amarelo "Pendente de cadastro", também na revisão.
5. Um código de produto **inativo** passa (o modal só conhece os ativos) e vira pendência no servidor (D6-A). Retorna ao passo 5.

### 7g. Tela de resultado com pendências (a partir dos passos 14 e 7d) — **[Novo em v2.1, RN-19]**
1. A resposta da rota traz `pendentes` não vazio.
2. Sistema não redireciona. Mostra o card "Nota fiscal salva — ID 1000" (ou "Lançamento adicionado à NF já cadastrada (ID 1000)", no complemento), a identidade da NF, "{n} produto(s) adicionado(s) ao estoque." e o alerta amarelo "Produtos pendentes de cadastro": "O produto X não foi inserido no estoque." (ou "Os produtos X, Y e Z não foram inseridos no estoque.") seguido de "O Administrador do Sistema foi informado e atuará assim que possível. Quando o cadastro for concluído ou recusado, você será avisado pelo sino de notificações.", com a lista "código — nome (lote …)".
3. Botões "Ver Estoque" (`/clinic/inventory`) e "Novo lançamento" (reinicia o assistente no Passo 1).
4. Quando o produto é cadastrado ou ativado no catálogo, a incorporação automática lança o item no estoque, convertendo embalagens pela regra do catálogo, e a clínica recebe `nf_pending_resolved`. Se o system_admin recusar a pendência, a clínica recebe `nf_pending_rejected` com o motivo e pode relançar o item como complemento (7d). Fora deste UC: UC-12 e UC-44.

### 7h. Falha na checagem antecipada (a partir do passo 4) — **[Novo em v2.1]**
1. A chamada a `GET /api/nf-imports/identidade` falha.
2. Sistema mostra o toast "Verificação de duplicidade": "Não foi possível verificar agora se a NF já foi cadastrada; a verificação será feita ao salvar." e avança ao Passo 3 (fail-open, D5).
3. A duplicidade é verificada pela transação ao salvar (8d).

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

### 8d. NF já importada via XML (a partir dos passos 4 e 11) — **[Reescrito em v2.0; atualizado em v2.1]**
1. A identidade já existe com origem `xml` (UC-10), com ou sem pendências, e **[v2.1]** sem item recusado (com item recusado, é complemento — 7d).
2. **[v2.1]** No "Continuar" do Passo 2, o sistema mostra o toast destrutivo "Nota fiscal já cadastrada": "Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual." e o usuário permanece no Passo 2, antes de digitar os produtos.
3. Se o bloqueio surgir só ao salvar (corrida entre a consulta e a gravação, ou consulta que falhou — 7h), a rota responde 409 `{ error, importId }` com a mesma mensagem; sistema exibe toast destrutivo "Nota fiscal não pode ser salva", nada é gravado e o usuário permanece na revisão, com a lista intacta.

### 8e. [REMOVIDO em v2.0] `tenant_id` ausente
O toast "Tenant ID não encontrado" deixou de existir: o tenant vem do token no servidor. Uma sessão sem `tenant_id` válido é recusada pela rota com 403.

### 8f. [Corrigido no commit `16877f1`] Falha durante a gravação dos itens de inventário (histórico)
1. Até o commit `16877f1`, o documento em `nf_imports` era criado com `status: "success"` (via `addDoc`) antes do laço de gravação dos itens, e uma falha no meio do laço deixava a NF incompleta, sem rollback.
2. O commit `16877f1` passou a usar `writeBatch`. **[v2.0]** O batch do client foi substituído pela transação no servidor (RN-07); a garantia "tudo ou nada" continua.

### 8g. [CORRIGIDO no commit `216b3a0`] Usuário não é Clinic Admin (a partir do passo 1)
1. Usuário com role diferente de `clinic_admin` acessa `/clinic/add-products`.
2. Sistema exibe o alerta "Acesso Negado" / "Apenas administradores podem inserir notas fiscais manualmente"; nenhum passo do wizard é renderizado.
3. **[v2.0]** Uma chamada direta à rota por outro role recebe 403 "Apenas administradores ativos da clínica podem importar NF-e".

### 8h. Código Rennova fora do padrão no servidor (a partir do passo 12) — **[REESCRITO em v2.1; antes: produto inexistente ou inativo, 422]**
1. **Até v2.0:** um produto Rennova sem correspondente ativo no catálogo fazia a rota responder 422 "Produto {código} não está ativo no catálogo Rennova." Esse 422 deixou de existir: produto ausente ou inativo vira pendência (RN-14, RN-16).
2. **[v2.1]** Se um item Rennova chegar ao servidor com código fora de 5 a 8 dígitos (o modal deveria ter bloqueado — 7f), a rota responde 400: "Produto {n}: código inválido (use de 5 a 8 dígitos numéricos)." Nada é gravado.
3. Sistema exibe toast destrutivo "Nota fiscal não pode ser salva" com a mensagem.

### 8i. Lançamento acima do limite de produtos (a partir do passo 10) — **[Novo em v2.0; atualizado em v2.1]**
1. O lançamento tem mais de 496 produtos (antes de v2.1, 497).
2. A rota responde 422: "Esta NF-e tem {n} itens; o limite por importação é 496. Divida o lançamento: os complementos mantêm o mesmo ID."

### 8j. Corpo inválido, erro de rede ou erro inesperado (a partir do passo 9)
1. A rota responde 400 (corpo inválido, por exemplo "Produto 2: data de validade inválida") ou 500, ou a requisição falha.
2. Sistema exibe toast destrutivo com a mensagem recebida ("Nota fiscal não pode ser salva"), ou "Erro ao salvar" / "Não foi possível salvar a nota fiscal" quando a requisição falha. Nada é gravado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[REESCRITA em v2.0 — PR #393]** A duplicidade é verificada pela identidade da NF (CNPJ do emitente + série + número, UC-10 RN-01) em `nf_identidades`, contra todas as NFs da clínica, e segue a matriz de UC-10 RN-02 no servidor: identidade inexistente → cria; identidade manual → **complementa o mesmo registro** (mesmo ID, sem consumir ID novo, `lancamentos_manuais` += 1); identidade XML → 409. A entrada fracionada continua possível, mas agora no mesmo registro. **[ATUALIZADA em v2.1 — D7-A]** Exceção: identidade XML com item recusado (`produtos_recusados` não vazio) → manual **complementa** o mesmo ID, para relançar o item recusado. **Antes de v2.0:** `checkNumeroNFStatus` (removida) comparava só `numero_nf`, e cada lançamento manual criava um registro novo. | Decisão do usuário (spec Seção 4.5, "Fracionado" e "Regra (b)"). Confirmado em `confirmManualLaunch` e `evaluateIdentityConflict`. |
| RN-02 | Produtos Rennova fragmentáveis usam a fórmula de UC-10 (`calcularQuantidadeInventario`): quantidade = embalagens × unidades por embalagem; valor unitário = valor por embalagem ÷ unidades. **[v2.0]** O cálculo que vale é o do **servidor**, com o catálogo lido na transação; o client manda embalagens e valor por embalagem, e o cálculo da lista local é só para exibição. O item guarda `fragmentavel`, `unidades_por_embalagem`, `quantidade_embalagens` e `valor_por_embalagem`. | Confirmado em `confirmManualLaunch` e em `handleSaveNF` (payload). |
| RN-03 | Produtos de "outra marca" não passam por `calcularQuantidadeInventario`: quantidade e valor são gravados como informados. | Cadastro livre não tem noção de embalagem. |
| RN-04 | O catálogo master só é consultado no tipo "Rennova": o client carrega os produtos com `active == true` para o autocomplete e, **[v2.0]** no servidor, a transação confere se cada código tem produto ativo (**[v2.1]** com produto ativo → estoque; sem produto ativo → pendência, RN-16). Produtos de outra marca não passam por catálogo nem viram pendência. | Confirmado em `loadMasterProducts`, `readManualMasters` e `planManualLines`. |
| RN-05 | A opção "Importar XML da NF-e" só aparece no fluxo Rennova. | Confirmado pela ausência do sub-passo de método em "outra marca". |
| RN-06 | **[CORRIGIDO em v2.1 — achado `UC-11-RN-06`, PR #396]** O "Continuar" do Passo 2 consulta `GET /api/nf-imports/identidade` e aplica `evaluateIdentityConflict('manual', …)` (os mesmos textos do 409): bloqueio → toast destrutivo e permanece no Passo 2; complemento → aviso (toast e alerta "Complemento de lançamento" nos Passos 3 e 4) e avança; NF nova → avança; falha da consulta → aviso e avança (fail-open, D5). A checagem é informativa: a transação ao salvar continua sendo a que vale (409 em corrida). O UC-10 ganhou a mesma checagem no preview. **Antes de v2.1:** a duplicidade só aparecia no 409 de "Confirmar e Salvar", depois de todos os produtos digitados. | Decisão do usuário (RF-12, RF-14, RN-09 do spec). Confirmado em `handleContinueToProducts` (`add-products/page.tsx`) e `src/app/api/nf-imports/identidade/route.ts`. Validado em `dev-gscandelari.web.app` em 16/10/2026. |
| RN-07 | **[ATUALIZADA em v2.0]** A gravação é atômica: até v2.0, um `writeBatch` no client (commit `16877f1`, que já tinha corrigido a gravação sequencial com `addDoc`); desde v2.0, uma transação Admin SDK em `POST /api/nf-imports/manual`, que inclui identidade, contador, registro e itens. Uma falha não deixa gravação parcial. O client não escreve mais em `nf_imports` (UC-10 RN-11). | Confirmado em `confirmManualLaunch` e em `firestore.rules` (`isServerManagedTenantCollection`). |
| RN-08 | **[REESCRITA em v2.0]** O número da NF deixou de ser texto livre: é normalizado para só dígitos e sem zeros à esquerda (`0055501` → `55501`; número vazio ou só com zeros é inválido), e a tela mostra "Será registrada como {n}" quando o valor muda. CNPJ do emitente e série passaram a ser **obrigatórios**; a chave de acesso é **opcional** (nota física ou rasurada), mas, se informada, precisa ter formato e DV válidos e conferir com CNPJ, série e número digitados. | Decisão do usuário (D2/D3/D8, RF-05). Confirmado em `validateManualIdentity` (`nfIdentity.ts`) e no Passo 2 de `add-products/page.tsx`. |
| RN-09 | **[CORRIGIDO — commit `216b3a0`]** `created_by` do registro passou de e-mail para UID. **[v2.0]** Mantido: o servidor grava o `uid` do token. | Confirmado em `confirmManualLaunch`. |
| RN-10 | **[CORRIGIDO — commit `216b3a0`]** `dt_validade` dos itens passou de string para `Timestamp`. **[v2.0]** O servidor grava a data de calendário ao meio-dia UTC (`validadeFromInput`), para cair no mesmo dia em qualquer fuso das Américas. | Confirmado em `nfImportServer.ts`. |
| RN-11 | **[CORRIGIDO — commit `216b3a0`]** Os itens referenciam a NF por `nf_id`, com `nf_import_id` mantido como alias. **[v2.0]** Os dois recebem o ID sequencial do registro (ex.: `"1000"`). | Confirmado em `confirmManualLaunch`. |
| RN-12 | **[CORRIGIDO em v2.0 — achado `UC-11-RN-12` (Baixa, Bug funcional), PR #393]** Antes, o número digitado não era normalizado ("026229" ≠ "26229" do XML; espaços), e a mesma NF podia entrar pelos dois caminhos. Corrigido: número, série, código e lote normalizados nos dois caminhos (RN-08, RN-13) e identidade única por CNPJ + série + número (RN-01). | Spec v1.2; Roteiro D validado no emulador e Roteiro G em `dev-gscandelari.web.app` (15/10/2026). |
| RN-13 | **[NOVA em v2.0]** Código (outra marca) e lote são gravados com `trim` e sem zeros à esquerda, mantendo o restante do texto (`0042` → `42`, `007X` → `7X`). A normalização ocorre ao adicionar o produto à lista e é repetida no servidor. | Decisão do usuário (spec RN-05). Confirmado em `handleAddProduct` e `confirmManualLaunch`. |
| RN-14 | **[SUBSTITUÍDA em v2.1 — histórico]** Até v2.0, no tipo Rennova, todo produto do lançamento precisava existir e estar **ativo** no catálogo no momento da gravação; senão, 422 "Produto {código} não está ativo no catálogo Rennova." e nada era gravado, e o lançamento manual não gerava pendência. Desde v2.1, produto ausente ou inativo vira pendência (RN-16); o 422 deixou de existir. | Decisão do usuário (Parte C e D6-A do spec). Confirmado em `planManualLines`. |
| RN-15 | **[NOVA em v2.0; ATUALIZADA em v2.1]** Um lançamento grava até 500 documentos na transação: **4 fixos** no pior caso (contador, registro, identidade e o alerta do system_admin) + 1 por produto. Acima de **496** produtos (antes de v2.1, 497), 422 sugerindo dividir o lançamento: os complementos mantêm o mesmo ID. | Confirmado em `checkManualWriteBudget(4, N)` (`src/app/api/nf-imports/manual/route.ts`). |
| RN-16 | **[NOVA em v2.1 — FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem, PR #396]** **Pendência manual:** item Rennova com código no padrão (5 a 8 dígitos) e sem produto **ativo** no catálogo (ausente ou inativo, D6-A) vira pendência no **mesmo** registro e ID da NF (criação ou complemento), em `pending_master_products/{tenantId}_{importId}_m{n}_{linha}`, em que `n` é o número do lançamento (1 na criação; `lancamentos_manuais + 1` no complemento) e `linha` é o índice do item no lançamento. Grava os mesmos campos da pendência XML (identidade da NF, `nf_import_id`, `id_sequencial`, `linha`, código, nome, lote, validade, `status: "aberta"`), mais `origem: "manual"` e `lancamento: n`, com quantidade e valor **como informados** (embalagens e valor por embalagem). A conversão em unidades acontece na incorporação, pela regra do catálogo, igual ao XML. O client não envia flag de pendência: o servidor decide pelo catálogo, então um item que o client julgou pendente mas cujo produto foi ativado nesse meio-tempo entra direto no estoque. A incorporação automática e a recusa valem para essas pendências (UC-12). | Decisão do usuário (RF-19, RF-21, RN-11, RN-12, RN-15 do spec). Confirmado em `planManualLines`, `confirmManualLaunch` e `manualPendingDoc` (`nfImportServer.ts`). Validado em `dev-gscandelari.web.app` em 16/10/2026 (lançamento com pendência e incorporação automática). |
| RN-17 | **[NOVA em v2.1]** **Informar produto à mão (Rennova):** disponível só quando a busca do catálogo não encontra resultado. O código normalizado precisa ter de 5 a 8 dígitos e não pode ser de um produto ativo do catálogo (o modal bloqueia; o servidor repete a checagem de formato com 400). No tipo "Outras marcas", o código continua livre e nunca vira pendência. | Decisão do usuário (RF-15, RF-16, RN-10 do spec). Confirmado em `montarItemPendenteCadastro` e `handleAddProduct` (`add-products/page.tsx`). |
| RN-18 | **[NOVA em v2.1 — D2-A, D8-A]** Todo lançamento (criação ou complemento) que gerar pendência cria, na mesma transação, o alerta `admin_notifications/nf_pendencias_{tenantId}_{importId}_m{n}` para o sino do system_admin, com mensagem como "Clínica A lançou manualmente a NF … (ID 1005): 2 produto(s) fora do catálogo (88888888, 7777777)." e link para `/admin/pending-products`. Sem e-mail. | Confirmado em `setPendingAdminAlert` (`nfImportServer.ts`). Sino descrito em UC-12. |
| RN-19 | **[NOVA em v2.1]** Com pendência, a página não redireciona: mostra a tela de resultado (7g), para que o aviso não se perca. Sem pendência, mantém o toast e o redirecionamento para `/clinic/inventory`. | Decisão do usuário (RF-20). Confirmado em `handleSaveNF` (step `'resultado'`). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[ATUALIZADO em v2.0]** Gravação atômica numa transação Admin SDK (RN-07), inclusive em concorrência (7e). | Confiabilidade |
| RNF-02 | O autocomplete de produtos Rennova roda no cliente, sobre a lista de `master_products` ativos carregada uma vez ao entrar no fluxo Rennova (sem paginação), e mostra no máximo 10 sugestões. | Performance / Usabilidade |
| RNF-03 | Este fluxo não captura `natureza_operacao`, `forma_pagamento` nem `tipo_nota` (não há XML); os itens criados aqui não exibem o `TipoNotaBadge`. | Confirmado em `confirmManualLaunch`. |
| RNF-04 | **[NOVO em v2.0]** Multi-tenant: o tenant vem só de `claims.tenant_id`; um `tenantId` no corpo é ignorado. **[v2.1]** Vale também para a checagem antecipada (um `tenantId` na query é ignorado). | Multi-tenant / Segurança |
| RNF-05 | **[NOVO em v2.1]** A checagem do Passo 2 custa uma ida a mais ao servidor (leituras por ID), com `Cache-Control: no-store`; em erro, não loga a identidade da NF. | Performance / Segurança |

---

## 11. Frequência de Uso
Alta. Junto com UC-10, é um dos dois mecanismos principais de entrada de estoque, usado quando a clínica não tem (ou não quer usar) o XML da NF-e.

---

## 12. Casos de Uso Relacionados
- **UC-10 (Importar NF-e via Upload de XML):** fluxo irmão. Compartilha a identidade da NF, `nf_identidades`, o contador de ID, `nf_imports`, a matriz de duplicidade e, **[v2.1]**, a rota de checagem antecipada: uma NF cadastrada por um caminho bloqueia o outro, exceto o complemento manual sobre NF XML com item recusado (RN-01).
- **UC-12 (Resolver Produtos Pendentes de Cadastro):** **[v2.1]** `<<extend>>` quando um item Rennova vira pendência. As pendências manuais aparecem na fila com origem "Manual", são incorporadas automaticamente quando o produto entra no catálogo e podem ser recusadas pelo system_admin.
- **UC-31 / UC-32 (Catálogo Master):** o ramo Rennova consulta o catálogo (produto ativo vai ao estoque; **[v2.1]** sem produto ativo vira pendência). O padrão de 5 a 8 dígitos do código vale também para o código informado à mão (RN-17).
- **UC-44 (Notificações):** **[v2.1]** a clínica recebe `nf_pending_resolved` quando a pendência manual é incorporada e `nf_pending_rejected` quando é recusada.
- **UC-50 (Consultar Inventário e Detalhe do Item):** o detalhe do item mostra "NF-e {número} · ID {id}".

---

## 13. Referências
- `src/app/(clinic)/clinic/add-products/page.tsx` (Passo 2 com número, série, CNPJ e chave; `handleContinueToProducts` **[v2.1]** com a checagem antecipada; `handleAddProduct` e **[v2.1]** `montarItemPendenteCadastro` (modo "informar manualmente", badge "Pendente de cadastro"); `handleSaveNF` via `POST /api/nf-imports/manual`; **[v2.1]** step `'resultado'`)
- **[v2.1]** `src/app/api/nf-imports/identidade/route.ts` (checagem antecipada); `src/lib/services/nfImportServer.ts` (`lookupNfIdentity`, `planManualLines` aplicado em `confirmManualLaunch`, `manualPendingDoc`, `setPendingAdminAlert`); `src/lib/nfImportPlanner.ts` (`planManualLines`, `buildComplementNotice`, `evaluateIdentityConflict` com `hasRejected`); `src/types/masterProduct.ts` (`isCatalogProductCode`)
- **[v2.1]** `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem.md` (v1.3); PR #396 (merge `8b6f0ba`) e PR #397
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
2. **[RESOLVIDO em v2.1 — PR #396; `UC-11-RN-06`]** A duplicidade passou a ser verificada no "Continuar" do Passo 2 (RN-06), antes de o usuário digitar os produtos. O fechamento do achado no mapa fica com o `uc-issues-tracker`.
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
| 2.1 | 16/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização as-is: checagem no Passo 2 e pendência no lançamento manual Rennova (`TASK_COMPLETED/FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem.md` v1.3, decisões D1–D8 pela opção A; PR #396, merge `8b6f0ba` em `gscandelari_setup`, e PR #397; validado em `dev-gscandelari.web.app` em 16/10/2026).** O "Continuar" do Passo 2 consulta `GET /api/nf-imports/identidade` (bloqueia NF de XML, avisa complemento, segue com aviso se a consulta falhar) — fecha `UC-11-RN-06`; complemento manual sobre NF XML com item recusado (D7-A); produto Rennova fora do catálogo ou inativo informado à mão ("Produto não está no catálogo — informar manualmente", código de 5 a 8 dígitos, código do catálogo recusado, badge "Pendente de cadastro") vira pendência no mesmo ID (`{t}_{id}_m{n}_{linha}`, quantidade e valor como na NF); alerta do system_admin; tela de resultado no lugar do redirecionamento quando há pendência; fim do 422 de produto ausente ou inativo; código fora do padrão no servidor dá 400; limite de 496 itens. RN-01, RN-04 e RN-15 atualizadas; RN-06 `[CORRIGIDO]`; RN-14 substituída; novas RN-16 a RN-19 e RNF-05. Passos 4, 5, 7 e 9–14, Pós-condições (nova 4.1c), Fluxos Alternativos 7d (ampliado), 7f, 7g e 7h (novos), Fluxos de Exceção 8d, 8h (reescrito) e 8i atualizados. Diagrama com a rota de consulta, UC-12 e o alerta do admin. Seções 2.2, 12, 13 e 14 atualizadas. Versão minor: o escopo do UC não muda. |
