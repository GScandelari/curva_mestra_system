# UC-10: Importar NF-e via Upload de XML

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 2.0

> Um Clinic Admin faz upload do XML de uma NF-e SEFAZ v4.00 para importar os produtos recebidos para o estoque da própria clínica, sem OCR, com extração direta do XML. **[v2.0, BUGFIX-identidade-e-duplicidade-nfe, PR #393]** O preview só lê o arquivo e não grava nada. A gravação acontece na confirmação, em `POST /api/nf-imports/xml`, numa única transação Admin SDK: identidade da nota (CNPJ do emitente + série + número), contador do ID sequencial da clínica ("ID 1000"), registro da importação, itens de estoque e pendências de catálogo. Ou tudo entra, ou nada entra. Produtos fora do catálogo viram pendências com os dados completos da linha e são incorporados automaticamente ao estoque quando o produto é ativado no catálogo master.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    API([🔧 API route\nPOST /api/nf-imports/xml\nAdmin SDK, transação única])
    Storage([🔧 Firebase Storage\ndanfe/{tenantId}/{importId}.xml])
    MasterCatalog([🔧 Catálogo Master\nmaster_products])
    CloudFn([🔧 Cloud Function\nonMasterProductWritten])
    SystemAdmin([👤 System Admin\nvê a fila de pendências])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
        UC12(("UC-12\nResolver Produtos\nPendentes de Cadastro"))
        UC44(("UC-44\nConsultar e Gerenciar\nNotificações"))
    end

    ClinicAdmin --> UC10
    UC10 -.->|confirmação grava tudo ou nada| API
    API -.->|arquiva o XML depois do commit\nbest-effort| Storage
    UC10 -.->|busca produto ativo pelo\ncódigo sem zeros à esquerda| MasterCatalog
    UC10 -->|"<<extend>> produto fora do catálogo\nvira pendência"| UC12
    SystemAdmin --> UC12
    CloudFn -.->|incorpora as pendências quando\no produto fica ativo| UC12
    CloudFn -.->|notifica a clínica\nnf_pending_resolved| UC44
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** (`role: "clinic_admin"`), único role autorizado. A tela `/clinic/upload` bloqueia qualquer outro role com a mensagem "Apenas administradores podem fazer upload de NF-e". No servidor, as duas rotas usadas por este UC (`POST /api/parse-nf-xml`, preview, e `POST /api/nf-imports/xml`, confirmação) exigem o ID token de um `clinic_admin` com `active == true` e `tenant_id` preenchido (RN-13). **[v2.0]** O client não escreve mais em `nf_imports`: a leitura continua restrita a `clinic_admin`, e toda escrita é feita pelo servidor com Admin SDK (RN-11).

### 2.2 Atores Secundários / Sistemas Externos
- **API route `POST /api/nf-imports/xml` (Admin SDK):** refaz o parse do arquivo no servidor (não confia no preview do navegador) e grava a importação numa transação (`src/lib/services/nfImportServer.ts`, `confirmXmlImport`). O tenant vem só do token.
- **Firebase Storage:** recebe o XML original em `danfe/{tenantId}/{importId}.xml`, gravado pelo servidor depois do commit da transação, em modo best-effort (RN-04). O client não tem mais permissão de escrita em `danfe/`.
- **Catálogo master de produtos (`master_products`):** mantido pelo System Admin (UC-31/UC-32). Cada linha do XML é resolvida contra um produto **ativo** com o mesmo código normalizado (RN-08).
- **System Admin:** não participa deste UC, mas vê em `/admin/pending-products` (UC-12) as linhas que ficaram pendentes.
- **Cloud Function `onMasterProductWritten`:** não participa da importação, mas incorpora depois ao estoque as linhas pendentes quando o produto fica ativo no catálogo, e notifica a clínica (RN-07, UC-12, UC-44).

---

## 3. Pré-condições
- Usuário autenticado com `role === "clinic_admin"`, `active == true` e `tenant_id` definido.
- Usuário possui um arquivo XML de NF-e (SEFAZ v4.00, formato `<NFe><infNFe>` ou `<nfeProc><NFe><infNFe>`), com extensão `.xml`, não vazio e de até 10MB (limite validado no componente de upload e no servidor, RNF-01 e RN-13).
- **[v2.0]** O XML traz a chave de acesso no atributo `Id` de `infNFe`, o emitente identificado por CNPJ (`emit/CNPJ`) e a série (`ide/serie`), e a chave confere com CNPJ, série e número das tags (RN-16, RN-20).

---

## 4. Pós-condições

### 4.1 Sucesso total (`status: "success"`)
Tudo abaixo é gravado na mesma transação, pelo servidor:
- `tenants/{tenantId}/contadores/nf_imports` com `ultimo_id` igual ao novo ID (RN-18).
- `tenants/{tenantId}/nf_imports/{importId}` (ID do documento = `"1000"`, `"1001"`, …) com `id_sequencial`, `tenant_id`, `origem: "xml"`, `identidade` (ex.: `12345678000195_1_26229`), `numero_nf`, `serie`, `cnpj_emitente`, `chave_acesso`, `fornecedor`, `data_emissao`, `natureza_operacao`, `forma_pagamento`, `tipo_nota`, `status: "success"`, `produtos_importados`, `produtos_pendentes: []`, `arquivo_nome`, `created_by` (UID), `created_at`, `updated_at`. O documento não embute mais `parsed_data`.
- `tenants/{tenantId}/nf_identidades/{identidade}` com `{ nf_import_id, origem: "xml", created_at }` (RN-01).
- Um item em `tenants/{tenantId}/inventory` por linha do XML, com `nf_id` igual ao ID da importação, `nf_numero` normalizado, `codigo_produto` e `lote` sem zeros à esquerda, `produto_id` do catálogo, `brand: "Rennova"`, `natureza_operacao`, `tipo_nota` e os campos de fragmentação quando o produto for fragmentável (RN-06).
- Depois do commit, o XML é salvo em `danfe/{tenantId}/{importId}.xml` e o registro recebe `arquivo_status: "salvo"` e `arquivo_path`. Se o arquivamento falhar, o registro recebe `arquivo_status: "falhou"` e a importação continua válida (RN-04).

### 4.1b Sucesso parcial (`status: "novo_produto_pendente"`)
- Linhas com produto ativo no catálogo entram no estoque normalmente.
- Cada linha sem produto ativo no catálogo vira um documento em `pending_master_products/{tenantId}_{importId}_{linha}`, com `status: "aberta"` e os dados completos da linha: `numero_nf`, `serie`, `cnpj_emitente`, `nf_import_id`, `id_sequencial`, `codigo`, `nome_produto`, `lote`, `quantidade` e `valor_unitario` como na NF, `dt_validade`, `dt_fabricacao` e `sem_rastro` quando houver (RN-07).
- O registro fica com `status: "novo_produto_pendente"` e `produtos_pendentes` com `{ codigo, nome_produto, lote }` de cada linha pendente.
- A tela de resultado lista os produtos não importados e informa que eles entrarão no estoque automaticamente quando forem cadastrados no catálogo, com notificação à clínica (RN-07).

### 4.2 Falha (Garantias Mínimas)
- **[v2.0]** O preview nunca grava nada (nem Firestore, nem Storage). Abandonar a tela depois do preview não deixa rastro e não bloqueia a NF (achado A2).
- Qualquer recusa ou erro na confirmação (401, 403, 409, 413, 422, 500) não grava nada: identidade, contador, registro, estoque e pendências estão na mesma transação, e nenhum ID é consumido (RN-18).
- A falha no arquivamento do XML, que ocorre depois do commit, não desfaz a importação; só fica registrada em `arquivo_status: "falhou"`.

---

## 5. Gatilho (Trigger)
O Clinic Admin acessa `/clinic/upload`, seleciona um arquivo XML e clica em "Importar NF-e". A gravação é disparada depois, quando ele clica em "Confirmar e Adicionar ao Estoque" no preview.

---

## 6. Fluxo Principal (Basic Flow)

**Preview (nada é gravado)**

1. Clinic Admin acessa `/clinic/upload` (também acessível pelo sub-passo "Importar XML da NF-e" de `/clinic/add-products`, opção Rennova).
2. Clinic Admin seleciona ou arrasta um arquivo `.xml`. O componente `FileUpload` valida extensão/MIME type e tamanho ≤ 10MB antes de habilitar o botão.
3. Clinic Admin clica em "Importar NF-e".
4. Sistema obtém o ID token (`user.getIdToken()`) e envia o arquivo (`multipart/form-data`, chave `file`) para `POST /api/parse-nf-xml` com `Authorization: Bearer <ID token>`. A rota checa, nesta ordem: token (401), claims de `clinic_admin` ativo com `tenant_id` (403), `Content-Length` declarado (413) e o arquivo enviado (400/413) — RN-13 e Fluxo de Exceção 8g.
5. A rota lê o XML com `fast-xml-parser` (`removeNSPrefix: true`, **[v2.0]** `parseTagValue: false`, para que todos os valores cheguem como texto, sem coerção numérica — achado A1) e localiza `infNFe` (em `nfeProc/NFe` ou `NFe`); senão, 422 (8a).
6. **[v2.0]** A rota extrai a identidade da nota a partir das tags e a valida: CNPJ do emitente (`emit/CNPJ`) na forma canônica de 14 posições com DV validado, série (`ide/serie`) e número (`ide/nNF`) sem zeros à esquerda (RN-17). Em seguida exige a chave de acesso (`infNFe@Id`), valida formato e dígito verificador e confere se CNPJ, série e número da chave batem com as tags (RN-16). Qualquer falha retorna 422 (8b, 8h, 8i).
7. Para cada `<det>`, a rota extrai `cProd` e `nLote` sem zeros à esquerda (RN-17), `xProd` em maiúsculas, `qCom` e `vUnCom`. Com um ou mais `<rastro>`, cria um produto por rastro (lote, validade de `dVal`, fabricação de `dFab`). Sem `<rastro>`, cria um produto com lote `"NÃO_INFORMADO"`, validade `"31/12/2099"` e `sem_rastro: true`, e gera um warning (Fluxo Alternativo 7c, RN-05).
8. A rota extrai `natureza_operacao` (`<natOp>`), calcula `forma_pagamento` pelo `<detPag>` de maior `vPag` (RN-09) e classifica `tipo_nota` por palavra-chave (RN-10). Retorna `{ parsedNF, warnings }`, sem gravar nada.
9. Frontend valida que `parsedNF.produtos.length > 0` (senão, 8c).
10. **[v2.0]** Frontend consulta o catálogo master (`getMasterProductByCode`) para cada código distinto e marca os códigos sem produto ativo.
11. Sistema exibe o preview "Confirmar Importação": a identidade no formato "NF 26229 · série 1 · CNPJ 12.345.678/0001-95" seguida do fornecedor; contagem de produtos; número da NF; badge de tipo de nota; natureza da operação e forma de pagamento, se houver; a lista de produtos (nome, código, lote, quantidade, validade, valor unitário, destaque "Sem rastreamento" quando aplicável e o badge **"Não cadastrado — ficará pendente"** nos produtos fora do catálogo); um alerta "Produtos fora do catálogo" quando houver algum, explicando que esses itens entrarão no estoque automaticamente quando o administrador do sistema os cadastrar, sem reenviar o XML; o aviso sobre produtos sem `<rastro>`, se houver; e o aviso de que a confirmação é permanente.

**Confirmação (transação no servidor)**

12. Clinic Admin revisa e clica em "Confirmar e Adicionar ao Estoque".
13. **[v2.0]** Sistema envia o **mesmo arquivo** para `POST /api/nf-imports/xml` com o ID token. A rota repete as guardas da rota de parse (401 → 403 → 413 → 400/413), refaz o parse no servidor (422 em caso de erro) e checa o orçamento de escrita da transação: até 497 linhas por NF (RN-19, 8j).
14. A rota abre uma transação (`adminDb.runTransaction`) e lê, antes de qualquer escrita: `nf_identidades/{identidade}` (e, se existir, o registro `nf_imports` correspondente, para saber se ele tem pendências), o contador `contadores/nf_imports` e os produtos do catálogo com os códigos da NF (`master_products where code in [...]`, em blocos de 30).
15. Se a identidade já existir, a transação termina sem escrever nada e a rota responde 409 com a mensagem da matriz de duplicidade (RN-02, 8d).
16. Para cada linha, o servidor decide: produto ativo no catálogo → item de estoque, com quantidade e valor calculados por `calcularQuantidadeInventario` (RN-06); produto ausente ou inativo → pendência (RN-07).
17. O servidor calcula o novo ID (`ultimo_id + 1`, começando em 1000 — RN-18) e grava, na mesma transação: o contador, o registro `nf_imports/{importId}`, a identidade `nf_identidades/{identidade}`, os itens de estoque e as pendências.
18. Depois do commit, a rota salva o XML em `danfe/{tenantId}/{importId}.xml` e atualiza `arquivo_status`/`arquivo_path` no registro (RN-04).
19. A rota responde 201 com `importId`, `idLabel` ("ID 1000"), `numero`, `serie`, `cnpj`, `produtosImportados`, `pendentes` e `arquivoSalvo`.
20. Sistema exibe a tela de sucesso: título "Importação concluída — ID 1000", a identidade da NF, os cards "Produtos Importados", "Registro" (ID) e "Natureza da Operação", e o texto "{n} produto(s) adicionado(s) ao estoque.". Se houver pendentes, um alerta "Produtos não importados" lista código, nome e lote de cada um (Fluxo Alternativo 7a). Se o arquivo não foi arquivado, um aviso discreto (Fluxo Alternativo 7d). Botões "Ver Estoque" e "Nova Importação".
21. Caso de uso é concluído, com sucesso total ou parcial.

---

## 7. Fluxos Alternativos

### 7a. Produto do XML fora do catálogo ou inativo (a partir dos passos 10 e 16)
1. No preview, o produto aparece com o badge "Não cadastrado — ficará pendente" e o alerta "Produtos fora do catálogo".
2. Na confirmação, a linha não entra no estoque. Vira um documento `pending_master_products/{tenantId}_{importId}_{linha}` com `status: "aberta"` e os dados completos da linha, gravado na mesma transação (RN-07).
3. O registro fica `novo_produto_pendente`, e a tela de sucesso lista os produtos não importados com o texto: "Estes produtos ainda não estão no catálogo. O administrador do sistema foi avisado; quando cadastrar, eles serão adicionados ao seu inventário automaticamente e você receberá uma notificação."
4. Quando o produto fica ativo no catálogo, a Cloud Function `onMasterProductWritten` lança a linha no estoque da clínica, atualiza o registro e cria a notificação `nf_pending_resolved` ("A NF (ID 1000) foi atualizada: o produto X foi adicionado ao inventário automaticamente.") — fora deste UC, ver UC-12 e UC-44.
5. **[v2.0]** O reenvio do XML para completar a importação deixou de existir: reenviar a mesma NF é bloqueado como duplicata (RN-02, RN-03, 8d).

### 7b. NF de outro emitente ou de outra série com o mesmo número (a partir do passo 14)
1. A identidade é a tripla CNPJ do emitente + série + número (RN-01). Outra NF com o mesmo `nNF`, mas outro CNPJ ou outra série, tem outra identidade.
2. A importação segue normalmente e recebe um novo ID (ex.: "ID 1001").

### 7c. Produto sem `<rastro>` no XML (a partir do passo 7)
1. Um ou mais produtos não possuem o nó `<rastro>`.
2. A rota atribui lote `"NÃO_INFORMADO"` e validade `"31/12/2099"`, marca `sem_rastro: true` e adiciona um warning.
3. O preview destaca o produto (borda âmbar e texto "Sem rastreamento") e exibe um alerta com a contagem de produtos afetados.

### 7d. Falha ao arquivar o XML no Storage (a partir do passo 18)
1. O upload de `danfe/{tenantId}/{importId}.xml` pelo servidor falha.
2. A rota grava `arquivo_status: "falhou"` no registro, registra `console.error` sem o conteúdo do XML e **não** desfaz a importação.
3. A resposta traz `arquivoSalvo: false`, e a tela de sucesso mostra "O arquivo XML não pôde ser arquivado; a importação foi concluída normalmente."

### 7e. Duas confirmações simultâneas da mesma NF (a partir do passo 14)
1. Duas abas (ou dois usuários da mesma clínica) confirmam a mesma NF quase ao mesmo tempo.
2. O Firestore serializa as transações sobre a mesma identidade e o mesmo contador: a primeira grava; a segunda é refeita, encontra a identidade e recebe 409 "Esta NF já foi cadastrada (ID n)." (RN-02, RN-15).
3. Existe um único registro, e cada linha entra uma única vez no estoque.

---

## 8. Fluxos de Exceção

Todos os erros abaixo são exibidos na tela "Erro na Importação" ("Não foi possível processar a NF-e"), com a mensagem recebida e os botões "Tentar Novamente" (volta à seleção de arquivo) e "Voltar ao Dashboard". Nenhum deles grava nada.

### 8a. XML não é uma NF-e SEFAZ válida (passos 5 e 13)
1. O parser não encontra `infNFe`.
2. A rota responde 422: "Arquivo não reconhecido como NF-e SEFAZ v4.00. Nó infNFe não encontrado."

### 8b. Número da NF ausente ou inválido (passos 6 e 13)
1. `<nNF>` ausente, vazio ou só com zeros.
2. A rota responde 422: "Número da NF-e (<nNF>) não encontrado no XML."

### 8c. Nenhum produto válido no XML (passos 7 e 9)
1. Nenhum `<det>`, ou todos sem `cProd`/`xProd` (cada um gera o warning `MALFORMED_PRODUCT` e é descartado).
2. A rota responde 422: "Nenhum produto (<det>) encontrado no XML." ou "Nenhum produto válido pôde ser extraído do XML.". Se a rota de preview retornar zero produtos por outro motivo, o frontend mostra "Nenhum produto foi encontrado no XML. Verifique se o arquivo é uma NF-e SEFAZ válida."

### 8d. NF já cadastrada — duplicidade (passo 15) — **[Reescrito em v2.0, RN-02]**
1. A identidade (CNPJ + série + número) já existe em `nf_identidades` da clínica.
2. `POST /api/nf-imports/xml` responde 409 `{ error, importId }` com uma destas mensagens:
   - registro de origem XML: "Esta NF já foi cadastrada (ID 1000)."; se esse registro ainda tiver produtos pendentes, a mensagem acrescenta "Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo.";
   - registro de origem manual (UC-11): "Esta NF já foi cadastrada manualmente (ID 1000) e não pode ser importada via XML."
3. O bloqueio só aparece na confirmação: o preview não consulta duplicidade.

### 8e. [REMOVIDO em v2.0] Produto do XML não existe no catálogo
Deixou de ser exceção: virou o Fluxo Alternativo 7a (pendência por linha com incorporação automática).

### 8f. Erro inesperado na confirmação (passos 13 a 17)
1. Qualquer exceção não prevista na rota ou na transação.
2. A rota responde 500 com a mensagem do erro. A transação é desfeita por inteiro, nenhum ID é consumido e nada fica gravado (não existe mais registro em `error` nem em `processing` — achado A2).
3. "Tentar Novamente" volta à seleção de arquivo; como nada foi gravado, a mesma NF pode ser importada de novo.

### 8g. Requisição recusada antes do parse (passos 4 e 13)
1. `POST /api/parse-nf-xml` e `POST /api/nf-imports/xml` recusam a requisição, nesta ordem: 401 (sem `Authorization: Bearer`, token inválido ou expirado) → 403 (não é `clinic_admin` com `active == true` e `tenant_id`) → 413 (`Content-Length` declarado acima de 10MB + 64KB, antes de ler o corpo) → 400/413 (nenhum arquivo, mais de um, sem extensão `.xml`, vazio ou maior que 10MB).
2. A rota responde `{ error }` com o status correspondente (tabela em RN-13).

### 8h. Chave de acesso ausente, inválida ou divergente (passos 6 e 13) — **[Novo em v2.0, RN-16]**
1. A rota responde 422 com uma destas mensagens:
   - sem atributo `Id` em `infNFe`: "Chave de acesso da NF-e (atributo Id de infNFe) não encontrada no XML.";
   - formato ou dígito verificador inválido: "Chave de acesso da NF-e inválida (formato ou dígito verificador).";
   - CNPJ, série ou número da chave diferentes das tags: "A chave de acesso não confere com CNPJ, série e número do XML."

### 8i. Emitente sem CNPJ, CNPJ inválido ou série inválida (passos 6 e 13) — **[Novo em v2.0, RN-20]**
1. A rota responde 422 com uma destas mensagens: "Emitente sem CNPJ não é suportado." (emitente com `emit/CPF`), "CNPJ do emitente inválido no XML." ou "Série da NF-e inválida no XML."

### 8j. NF acima do limite de linhas por importação (passo 13) — **[Novo em v2.0, RN-19]**
1. A NF tem mais linhas do que cabem numa transação (3 escritas fixas + 1 por linha, limite de 500).
2. A rota responde 422: "Esta NF-e tem {n} itens; o limite por importação é 497." Nada é gravado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[REESCRITA em v2.0 — BUGFIX-identidade-e-duplicidade-nfe, PR #393]** A identidade de uma NF-e é a tripla **CNPJ do emitente** (forma canônica de 14 posições, DV validado) + **série** + **número** (os dois sem zeros à esquerda), com a chave `${cnpj}_${serie}_${numero}` (ex.: `12345678000195_1_26229`). A unicidade é garantida pelo documento `tenants/{tenantId}/nf_identidades/{identidade}`, criado na mesma transação da importação e consultado contra **todas** as NFs da clínica, de qualquer origem (XML ou manual). Não há fallback "só número". A chave de acesso não é a identidade: é um campo gravado e conferido (RN-16). **Antes de v2.0:** a NF era identificada só por `numero_nf` dentro do tenant (`checkNumeroNFStatus`, removida). | Decisão do usuário (D2/D3/D4, spec Seção 4.5): o nNF só é único por emitente e série. Confirmado em `src/lib/nfIdentity.ts` (`buildIdentityKey`) e `src/lib/services/nfImportServer.ts` (`readConflict`). |
| RN-02 | **[REESCRITA em v2.0 — decisão de produto `UC-10-RN-02` parcialmente decidida]** Matriz de duplicidade, aplicada no servidor (`evaluateIdentityConflict`): (1) identidade inexistente → XML cria, manual cria; (2) identidade existente de origem **manual** → manual **complementa o mesmo registro** (mesmo ID, UC-11) e XML é bloqueado com 409 "Esta NF já foi cadastrada manualmente (ID n) e não pode ser importada via XML."; (3) identidade existente de origem **XML**, com ou sem pendências → XML bloqueado com 409 "Esta NF já foi cadastrada (ID n)." (mais a frase sobre pendentes, se houver) e manual bloqueado com 409 "Esta NF já foi importada via XML (ID n) e não aceita lançamento manual.". **Regra (b) antiga revogada:** antes, um registro só manual permitia uma importação XML posterior; agora XML × manual e manual × XML se bloqueiam mutuamente. A matriz v1 (a)–(d) baseada só no número deixou de existir. | Decisão do usuário (spec Seções 3.3 e 4.4). Confirmado em `src/lib/nfImportPlanner.ts` (`evaluateIdentityConflict`). A questão do produto que nunca entra no catálogo continua aberta (Seção 14, item 1). |
| RN-03 | **[REVOGADA em v2.0]** O reenvio do XML para completar uma importação com pendências (reaproveitando o mesmo registro e pulando pares código+lote já gravados) **deixou de existir**. Uma NF já cadastrada é sempre duplicata (RN-02, item 3); as linhas pendentes entram no estoque pela incorporação automática (RN-07). | Decisão do usuário (spec RN-08). `getInventoryProdutoLoteKeysByNfId` e o reaproveitamento de `importId` saíram do código. |
| RN-04 | **[REESCRITA em v2.0]** O XML original é arquivado pelo **servidor**, em `danfe/{tenantId}/{importId}.xml`, **depois** do commit da transação e em modo best-effort: se falhar, o registro recebe `arquivo_status: "falhou"` e a importação não é desfeita. Como o preview não grava nada e a recusa por duplicidade acontece antes do arquivamento, nenhuma NF rejeitada deixa arquivo no Storage. O client não escreve mais em `danfe/` (`storage.rules` mantém só a leitura do tenant e do system_admin). **Antes de v2.0:** o client subia o arquivo (`danfe/{tenantId}/{timestamp}_{nome}`) depois de `checkNumeroNFStatus` e antes do preview. | Spec Seção 4.1, item 6. Confirmado em `saveNfXmlFileBestEffort` (`nfImportServer.ts`), `src/app/api/nf-imports/xml/route.ts` e `storage.rules` (`match /danfe/{tenantId}/{nfId}`, só `allow read`). |
| RN-05 | Produtos sem `<rastro>` são importados com lote `"NÃO_INFORMADO"` e validade `31/12/2099`, marcados `sem_rastro: true` e sinalizados no preview. Quando há `<rastro>`, mas `nLote` fica vazio depois da normalização, o lote também vira `"NÃO_INFORMADO"`, mas a validade vem de `dVal` (ou `31/12/2099`, se ausente) e o item não é marcado `sem_rastro`. | Garante que a falta de rastreabilidade no XML não impeça a importação. Confirmado em `parseNfeXml.ts`. |
| RN-06 | Produtos fragmentáveis no catálogo (`fragmentavel: true`, com `unidades_por_embalagem`) têm a quantidade multiplicada e o valor unitário dividido pelas unidades por embalagem; o item guarda também `quantidade_embalagens` e `valor_por_embalagem`. **[v2.0]** O cálculo é feito no servidor (`planXmlLines`, que usa `calcularQuantidadeInventario`, agora em `src/lib/inventoryQuantity.ts`), com o catálogo lido dentro da transação. Na incorporação automática de uma pendência, vale o catálogo do momento da incorporação. | Controle de estoque fracionado. Fórmula inalterada; só mudou de arquivo e de camada. |
| RN-07 | **[REESCRITA em v2.0]** Uma importação pode terminar com sucesso parcial (`novo_produto_pendente`). Cada linha sem produto **ativo** no catálogo vira uma **pendência por linha** (código + lote) em `pending_master_products/{tenantId}_{importId}_{linha}`, gravada pelo servidor na mesma transação, com `status: "aberta"` e os dados completos da linha (identidade da NF, código, nome, lote, quantidade e valor como na NF, validade, fabricação, `sem_rastro`). Quando o produto fica ativo no catálogo, a Cloud Function `onMasterProductWritten` lança as linhas no inventário da clínica, marca a pendência como `resolvida`, atualiza o registro (`produtos_pendentes`, `produtos_importados`, `status` → `success` quando não sobra pendência) e notifica a clínica (UC-12, UC-44). O reenvio do XML para completar deixou de existir: reenviar a NF retorna 409 com o aviso de que os pendentes entrarão automaticamente (RN-02, RN-03). | Decisão do usuário (spec RF-03, RF-09, RF-11, RN-06/07/08). Confirmado em `nfImportServer.ts`, `functions/src/pendingResolution.ts` e `functions/src/onMasterProductWritten.ts`. |
| RN-08 | **[ATUALIZADA em v2.0]** O matching entre uma linha do XML e o catálogo é por **igualdade exata** entre o `cProd` normalizado (sem zeros à esquerda) e o `code` de `master_products`, também gravado sem zeros à esquerda desde v2.0 (UC-31/UC-32). Só produto com `active: true` resolve a linha; inativo ou ausente vira pendência. Não há correspondência parcial nem por nome. | Confirmado em `readMasters` (`nfImportServer.ts`, `where('code','in', …)`) e `planXmlLines` (`nfImportPlanner.ts`). Sem a normalização do catálogo, um `cProd` normalizado nunca casaria com um código com zero. |
| RN-09 | `forma_pagamento` é derivada do `<detPag>` de **maior** `vPag` (descarta o `<detPag>` "fantasma" com `vPag=0.00`). **[v2.0, achado A5 corrigido]** Com `parseTagValue: false`, `<tPag>01</tPag>` a `09` chegam como texto e voltam a ser rotulados corretamente (ex.: "Dinheiro"); antes, a coerção numérica fazia essas NFs aparecerem como "Não Informado". | Comportamento intencional documentado em `parseNfeXml.ts`; A5 coberto por teste de regressão. |
| RN-10 | `tipo_nota` é inferido por palavra-chave (case-insensitive, sem acentos) em `<natOp>`: "bonific" → `bonificacao`; "venda" → `venda`; outro texto ou ausente → `outro`. | Classificação heurística, sem lista fechada (Seção 14). |
| RN-11 | **[REFORÇADA em v2.0 — client sem escrita em `nf_imports`]** `tenants/{tenantId}/nf_imports` é lida só por `clinic_admin` do tenant e pelo system_admin, e **não aceita escrita de nenhum client**, nem do system_admin: o bloco dedicado (`firestore.rules`, l. 209-211) tem só `allow read: if belongsToTenant(tenantId) && hasRole('clinic_admin')`, e o bloco genérico do tenant (l. 125-140) passou a `allow write: if isSystemAdmin() && !isServerManagedTenantCollection(collectionId)`, com `isServerManagedTenantCollection` = `nf_imports`, `nf_identidades`, `contadores` (l. 59-60). `nf_identidades` e `contadores` também estão em `isRestrictedTenantCollection` (l. 50-52): só o system_admin lê. Toda escrita é feita pelo servidor com Admin SDK (API routes e Cloud Functions). Consultor continua sem leitura de `nf_imports` (fora da allowlist `consultantReadableSubcollection`, l. 43-45). **Histórico:** PR #344 (`f3ce046`/`94cbe2e`) criou o bloco dedicado com `read, write` para `clinic_admin` e excluiu `nf_imports` do fallback genérico de leitura; v1.2.1 registrou a troca de `collectionId != 'nf_imports'` por `isRestrictedTenantCollection`. | Decisão D7 do spec (Seção 6.5). Confirmado por leitura de `firestore.rules` em HEAD (`2bc543f`) e pelos testes de rules (get **e** list) da suíte `tests/rules/firestore-tenant-subcollections.test.ts`. |
| RN-12 | **[CORRIGIDO em v1.2 — `UC-10-RN-12`, PR #390]** A rota legada `POST /api/parse-nf` (PDF via `pdf-parse`, sem autenticação) foi removida, junto com a dependência `pdf-parse`. A rota de parse publicada é `POST /api/parse-nf-xml` (RN-13). | Spec concluída `BUGFIX-protecao-rotas-parse-nfe.md` (v1.1). |
| RN-13 | **[CORRIGIDO em v1.2 — `UC-10-RN-13`, PR #390; ampliado em v2.0]** `POST /api/parse-nf-xml` exige `Authorization: Bearer <ID token>` de um `clinic_admin` com `active == true` e `tenant_id` (`system_admin`, `clinic_user` e consultor recebem 403) e aceita exatamente um arquivo `.xml`, não vazio, de até 10MB (contando todos os arquivos do `FormData`). Se o `Content-Length` passar de 10MB + 64KB, responde 413 antes de ler o corpo. Ordem: 401 → 403 → 413 → 400/413 → 422 → 200. Respostas: **200** `{ parsedNF, warnings }`; **400** "Nenhum arquivo enviado" / "Envie apenas um arquivo XML por vez" / "Apenas arquivos XML são aceitos nesta rota" / "Arquivo vazio"; **401** "Sessão inválida ou expirada. Faça login novamente." ou "Não autorizado"; **403** "Apenas administradores ativos da clínica podem importar NF-e"; **413** "Arquivo muito grande. Máximo: 10MB"; **422** mensagem do parser; **500** erro inesperado. A rota continua só fazendo parse. **[v2.0]** `POST /api/nf-imports/xml` reaproveita as mesmas guardas (`verifyBearerToken`, `checkParseNfeClaims`, `checkRequestContentLength`, `validateNfeUploadEntries`), refaz o parse e acrescenta: **422** orçamento de escrita (RN-19); **409** `{ error, importId }` duplicidade (RN-02); **201** sucesso. O tenant vem só do token; um `tenantId` enviado no formulário é ignorado. | Confirmado em `src/app/api/parse-nf-xml/route.ts`, `src/app/api/nf-imports/xml/route.ts` e `src/lib/validations/nfeUploadValidation.ts`. Testes: `nfeUploadValidation.test.ts`, `parseNfXmlRoute.test.ts`, `nfImportRoutes.test.ts`. |
| RN-14 | **[CORRIGIDO em v2.0 — achado `UC-10-RN-14` (Média, Bug funcional), PR #393]** Antes, a NF era identificada só por `numero_nf`: uma NF de mesmo número de outro fornecedor era bloqueada ou misturada com a primeira, e a chave de acesso não era extraída. Corrigido pela nova identidade (RN-01), pela chave obrigatória e conferida (RN-16) e pela nova matriz (RN-02). | Spec `TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` v1.2; validado em `dev-gscandelari.web.app` em 15/10/2026 (roteiro G). |
| RN-15 | **[CORRIGIDO em v2.0 — achado `UC-10-RN-15` (Baixa, Débito técnico), PR #393]** Antes, a checagem de duplicidade rodava só no client, sem transação nem regra de servidor, e dois envios quase simultâneos podiam duplicar estoque. Corrigido: a checagem e a gravação ficam na mesma transação Admin SDK; concorrência resolvida pela serialização do Firestore (Fluxo Alternativo 7e); client sem escrita (RN-11). | Spec v1.2, Roteiro C (concorrência em duas abas: um sucesso, um 409) executado no emulador. |
| RN-16 | **[NOVA em v2.0]** A chave de acesso (`infNFe@Id`, 44 posições, com ou sem o prefixo `NFe`) é **obrigatória e validada** no XML: formato, dígito verificador (módulo 11) e coerência de CNPJ, série e número da chave com as tags `emit/CNPJ`, `ide/serie` e `ide/nNF`. É gravada em `chave_acesso`, mas não identifica a nota (RN-01). Aceita o leiaute de CNPJ alfanumérico (achado A4). | Detecta XML adulterado ou montado. Confirmado em `parseChaveAcesso`, `computeChaveAcessoDV` e `chaveMatchesIdentity` (`nfIdentity.ts`) e em `parseNfeXml.ts`. |
| RN-17 | **[NOVA em v2.0]** Normalização aplicada no parse e na gravação: número e série só com dígitos e sem zeros à esquerda (`026229` → `26229`, `001` → `1`, `000` → `0` na série; número só com zeros é inválido); `cProd` e `nLote` com `trim` e sem zeros à esquerda, preservando o restante (`0003076528` → `3076528`, `00BT2024A` → `BT2024A`, `000` → `0`); CNPJ sem máscara, em maiúsculas, com DV validado antes de qualquer transformação e gravado na forma canônica de 14 posições (com zeros). | Decisão do usuário: limpar zeros de forma uniforme (spec RN-05 e Seção 4.1, item 8). Corrige o achado A1. Confirmado em `nfIdentity.ts`. |
| RN-18 | **[NOVA em v2.0]** Cada registro de importação recebe um **ID sequencial por clínica, começando em 1000**, que é o ID do documento (`nf_imports/"1000"`) e o campo `id_sequencial`. É exibido sempre como **"ID 1000"**, nunca como "NF 1000". O contador `tenants/{tenantId}/contadores/nf_imports` é lido e atualizado na mesma transação, então uma confirmação recusada não consome ID e não há buracos. Cada clínica tem a sua sequência (a primeira importação de outra clínica também é "ID 1000"). | Decisão do usuário (D1 revisada). Confirmado em `nextImportId` (`NF_IMPORT_FIRST_ID = 1000`) e `formatImportId`. |
| RN-19 | **[NOVA em v2.0]** Uma importação XML grava até 500 documentos numa transação: 3 fixos (contador, registro, identidade) + 1 por linha. Uma NF com mais de **497** linhas é recusada com 422 antes de abrir a transação; a importação XML não é dividida, para não quebrar a garantia "tudo ou nada". | Limite do Firestore. Confirmado em `checkWriteBudget` (`nfImportPlanner.ts`). |
| RN-20 | **[NOVA em v2.0]** NF-e cujo emitente é identificado por CPF (`emit/CPF`, sem `emit/CNPJ`) é recusada com 422 "Emitente sem CNPJ não é suportado."; CNPJ com DV inválido e série inválida também são recusados (422). | A identidade exige CNPJ (D2/D3). Confirmado em `parseNfeXml.ts`. |

**Achados A1–A5 do spec (Seção 1.4), corrigidos no PR #393:**
- **A1 — coerção numérica do parser:** o CNPJ perdia o zero à esquerda, e `cProd`/`nLote` numéricos perdiam zeros enquanto os alfanuméricos não. Corrigido por `parseTagValue: false` e pela normalização uniforme (RN-17).
- **A2 — importação abandonada ou com falha bloqueava o número para sempre:** o registro `pending` criado antes do preview, ou o `error` sem pendências, caía em "já foi totalmente importada". Some por construção: o preview não grava e uma falha desfaz a transação inteira (Seção 4.2, 8f).
- **A3 — pendência criada pelo client com consulta negada pela rule:** `registerPendingMasterProducts` consultava `pending_master_products` como `clinic_admin`, o que a rule nega; a NF com produto fora do catálogo podia terminar em `error` depois de o estoque já ter sido gravado. Some: a pendência é criada pelo servidor (Admin SDK) na mesma transação, com ID determinístico, e o client não toca mais essa coleção.
- **A4 — CNPJ alfanumérico (IN RFB 2.229/2024, NT 2025.001):** aceito no CNPJ e na chave, com DV calculado pelo valor `charCode - 48`.
- **A5 — `forma_pagamento` errada para `tPag` 01–09:** corrigido como efeito de `parseTagValue: false` (RN-09).

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Arquivo limitado a `.xml` e 10MB em duas camadas: no componente `FileUpload` e no servidor (`POST /api/parse-nf-xml` e, desde v2.0, `POST /api/nf-imports/xml`): 413 pelo `Content-Length` declarado (> 10MB + 64KB) antes de ler o corpo, e 413 pelo tamanho do arquivo depois do `formData()`. | Usabilidade / Performance / Segurança |
| RNF-02 | O parser aceita XML de NF-e "crua" (`<NFe><infNFe>`) e de processo completo (`<nfeProc><NFe><infNFe>`). | Compatibilidade |
| RNF-03 | **[REMOVIDO em v2.0]** A barra de progresso simulada do upload ao Storage deixou de existir: o client não sobe mais o arquivo. A tela mostra os estados "Processando NF-e..." (preview) e "Adicionando ao Estoque..." (confirmação). | Usabilidade |
| RNF-04 | **[REESCRITO em v2.0]** Toda a gravação da importação (contador, registro, identidade, itens de estoque e pendências) é uma única transação Admin SDK (`adminDb.runTransaction`), com todas as leituras antes das escritas. Ou tudo é gravado, ou nada é. Transações concorrentes sobre a mesma identidade ou o mesmo contador são serializadas pelo Firestore. | Confiabilidade |
| RNF-05 | **[NOVO em v2.0]** Multi-tenant: o tenant vem só de `claims.tenant_id`; nenhum `tenantId` é aceito do corpo da requisição. Toda escrita fica sob `tenants/{tenantId}/…`, e as pendências globais carregam `tenant_id`. | Multi-tenant / Segurança |
| RNF-06 | **[NOVO em v2.0]** Nenhum log novo com CNPJ completo, chave de acesso ou conteúdo do XML. | Segurança |

---

## 11. Frequência de Uso
Alta. É o principal mecanismo de entrada de estoque da clínica, usado a cada NF-e recebida da Rennova (ou de outro emissor compatível).

---

## 12. Casos de Uso Relacionados
- **UC-11 (Inserir Nota Fiscal Manualmente):** compartilha a identidade (RN-01), a coleção `nf_imports`, o contador de ID e a matriz de duplicidade (RN-02). Uma NF cadastrada por um caminho bloqueia o outro.
- **UC-12 (Resolver Produtos Pendentes de Cadastro):** `<<extend>>` quando a importação termina com `novo_produto_pendente`. As pendências criadas aqui são incorporadas automaticamente quando o produto fica ativo.
- **UC-31 / UC-32 (Catálogo Master):** pré-condição indireta. Uma linha só entra no estoque se o código normalizado tiver produto ativo no catálogo. Ativar, reativar ou trocar o código de um produto ativo dispara a incorporação das pendências.
- **UC-44 (Notificações):** recebe a notificação `nf_pending_resolved` quando as pendências de uma importação são incorporadas.
- **UC-50 (Consultar Inventário e Detalhe do Item):** o detalhe do item exibe "NF-e {número} · ID {id}" para itens vindos de uma importação.
- **UC-13/UC-15 (Inventário):** origem do achado estrutural de rules corrigido no PR #344, referenciado no histórico de RN-11.

---

## 13. Referências
- `src/app/(clinic)/clinic/upload/page.tsx` (preview sem gravação, `getMasterProductByCode` para marcar "Não cadastrado — ficará pendente", confirmação via `POST /api/nf-imports/xml`, tela "Importação concluída — ID n")
- `src/app/api/parse-nf-xml/route.ts` (preview, só parse)
- `src/app/api/nf-imports/xml/route.ts` (**[v2.0]** confirmação)
- `src/lib/services/nfImportServer.ts` (**[v2.0]** `confirmXmlImport`, `saveNfXmlFileBestEffort`)
- `src/lib/nfIdentity.ts` (**[v2.0]** normalização, CNPJ, chave de acesso, identidade, `formatImportId`, `formatNFLabel`)
- `src/lib/nfImportPlanner.ts` (**[v2.0]** `evaluateIdentityConflict`, `nextImportId`, `planXmlLines`, `checkWriteBudget`)
- `src/lib/inventoryQuantity.ts` (**[v2.0]** `calcularQuantidadeInventario`, movido de `inventoryService.ts`)
- `src/lib/parseNfeXml.ts` (`parseTagValue: false`, identidade e chave, normalização)
- `src/lib/validations/nfeUploadValidation.ts` (guardas de #390, reaproveitadas)
- `src/lib/services/nfImportService.ts` (**[v2.0]** só leitura: `getNFImport`, `listNFImports`; removidos `uploadNFFile`, `createNFImport`, `updateNFImportStatus`, `checkNumeroNFStatus`, `processNFAndAddToInventory`)
- `src/lib/services/masterProductService.ts` (`getMasterProductByCode`, normaliza o código)
- `functions/src/onMasterProductWritten.ts`, `functions/src/pendingResolution.ts` (incorporação automática, UC-12)
- `src/components/upload/FileUpload.tsx`, `src/components/inventory/TipoNotaBadge.tsx`
- `src/types/nf.ts` (`ParsedNF` com `serie`, `cnpj_fornecedor`, `chave_acesso`; `NFImport`; `NFIdentity`)
- `firestore.rules` (l. 43-45 `consultantReadableSubcollection`; l. 50-52 `isRestrictedTenantCollection`; l. 59-60 `isServerManagedTenantCollection`; l. 125-140 bloco genérico do tenant; l. 209-211 `nf_imports` só leitura de `clinic_admin`; l. 334-336 `pending_master_products` só leitura do system_admin)
- `storage.rules` (`match /danfe/{tenantId}/{nfId}`, só leitura)
- Testes: `src/__tests__/nfIdentity.test.ts`, `nfImportPlanner.test.ts`, `nfImportRoutes.test.ts`, `parseNfeXml.test.ts`, `nfeUploadValidation.test.ts`, `parseNfXmlRoute.test.ts`; `tests/rules/firestore-tenant-subcollections.test.ts`
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` (v1.2, Concluído em 15/10/2026); PR #393 (`bugfix/nfe-identity-duplicate-check` → `gscandelari_setup`, merge `2bc543f`)
- `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-protecao-rotas-parse-nfe.md` (v1.1); PR #390

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Decisão de produto pendente — `UC-12-Decisão-Expiração`, cross-ref UC-12]** Uma linha pendente cujo produto nunca entra no catálogo master fica `aberta` indefinidamente, e o registro continua `novo_produto_pendente`. Não existe ação para descartar a pendência com aviso à clínica. A incorporação automática cobre o caso em que o produto entra depois, mas não este. Registrado no mapa como decisão futura (spec Seção 4.4).
2. **[`UC-10-RN-02` — parcialmente decidida em v2.0]** Identidade, matriz de bloqueio, fim do reenvio e garantia no servidor foram decididos e implementados (RN-01, RN-02, RN-03, RN-07, RN-11). O único ponto que segue em aberto é o do item 1.
3. **[Observação]** RN-10 (classificação heurística de `tipo_nota` por palavra-chave) não tem lista fechada de naturezas de operação: qualquer natureza fora de "bonific"/"venda" vira "outro". Não confirmado se há necessidade de mais categorias.
4. **[RESOLVIDO em v1.1 — PR #344; reforçado em v2.0 — PR #393]** RN-11: a restrição de role em `nf_imports` é aplicada no Firestore; desde v2.0 nenhum client escreve na coleção. Fora de escopo e não decidido aqui: um eventual compartilhamento de leitura com o consultor (opt-in futuro, registrado separadamente no mapa).
5. **[RESOLVIDO em v1.2 — PR #390]** `UC-10-RN-12` e `UC-10-RN-13`.
6. **[RESOLVIDO em v2.0 — PR #393]** `UC-10-RN-14` e `UC-10-RN-15` (identidade só por número e checagem só no client), e os achados A1–A5 do spec.
7. **[RESOLVIDO em v2.0]** O item antigo de rastreabilidade ("Gerenciar Catálogo Master" e "Resolver Produtos Pendentes" não mapeados) já estava superado: esses fluxos são UC-31/UC-32 e UC-12.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Documentado a partir de contexto detalhado fornecido pelo usuário (que implementou este fluxo nesta mesma sessão de trabalho, em PRs recentes já mergeados) e confirmado por leitura direta e completa de todos os arquivos envolvidos: `upload/page.tsx`, `api/parse-nf-xml/route.ts`, `parseNfeXml.ts`, `nfImportService.ts`, `inventoryService.ts` (funções relevantes), `masterProductService.ts`, `pendingMasterProductService.ts`, `FileUpload.tsx`, `TipoNotaBadge.tsx` e `types/nf.ts`. Registrado como aviso explícito, a pedido do próprio usuário, que a regra de duplicidade v1 (RN-02) está sujeita a revisão. |
| 1.1 | 02/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção/reforço de segurança real implementado e mergeado (PR #344, branch `bugfix/firestore-rules-tenant-role-enforcement`, commits `f3ce046` + `94cbe2e`, deploy confirmado em `curva-mestra-dev`)**: nova regra RN-11 — `nf_imports` ganhou um bloco dedicado no Firestore com leitura e escrita restritas a `clinic_admin`, excluído do fallback de leitura genérico da regra de subcoleção do tenant (`collectionId != 'nf_imports'`), reforçando no banco de dados a restrição que antes só existia na UI. Seção 2.1, RN-11 (seção 9), item 5 da seção 14, e seções 12/13 atualizados de acordo. Mesma correção estrutural aplicada em conjunto a UC-13/RN-09 e UC-15/RN-07 (achado original) — esta é a primeira vez que o achado é documentado do ponto de vista da subcoleção `nf_imports`, que nunca teve RN de segurança própria antes desta revisão. |
| 1.2 | 14/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização as-is: proteção das rotas de parse de NF-e (`BUGFIX-protecao-rotas-parse-nfe.md` v1.1, Concluído; PR #390).** Novas RN-12 (`[CORRIGIDO]` — rota legada `/api/parse-nf` e dependência `pdf-parse` removidas) e RN-13 (`[CORRIGIDO]` — `/api/parse-nf-xml` exige ID token de `clinic_admin` ativo com `tenant_id`; um único `.xml` não vazio de até 10MB, contando todos os arquivos do formulário; 413 por `Content-Length` antes de ler o corpo; tabela 400/401/403/413/422/500; `/clinic/upload` envia `Authorization: Bearer`). RNF-01 corrigida (limite de 10MB agora também no servidor). Passo 4 do Fluxo Principal, Seção 2.1, Pré-condições, novo Fluxo de Exceção 8g, Seção 13 e Seção 14 (novo item 6) atualizados. Achados **abertos** de duplicidade `UC-10-RN-14` e `UC-10-RN-15` (mapa v3.52) apenas referenciados como RN-14/RN-15 e no item 2 da Seção 14 — sem mudança de comportamento; serão tratados por `BUGFIX-identidade-e-duplicidade-nfe.md` (TO_DO, não implementado). Fontes: leitura do código na branch `docs/nfe-duplicate-check-finding` e a spec concluída. |
| 1.2.1 | 14/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção pontual de RN-11 (as-is).** A exclusão do fallback genérico passou a ser descrita como `!isRestrictedTenantCollection(collectionId)` (`nf_imports`, `financeiro`, `precificacao_procedimentos`; l. 50-52 e 123), em vez de `collectionId != 'nf_imports'`. O bloco dedicado de `nf_imports` está nas l. 195-197. Também ficou registrado que o consultor não lê `nf_imports` por ela estar fora da allowlist `consultantReadableSubcollection`. Texto histórico de RN-11 preservado; Seção 13 atualizada. Sem mudança de comportamento. |
| 2.0 | 15/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Reestruturação as-is: identidade e duplicidade de NF-e (`TASK_COMPLETED/BUGFIX-identidade-e-duplicidade-nfe.md` v1.2; PR #393, merge `2bc543f` em `gscandelari_setup`; validado em `dev-gscandelari.web.app` em 15/10/2026, roteiro G).** Fluxo Principal reescrito em duas fases: preview sem gravação (`/api/parse-nf-xml` + marcação "Não cadastrado — ficará pendente") e confirmação via `POST /api/nf-imports/xml` numa única transação Admin SDK (identidade, contador, registro, estoque, pendências), com o XML arquivado em `danfe/{tenantId}/{importId}.xml` depois do commit, em best-effort. RN-01 (identidade CNPJ + série + número em `nf_identidades`), RN-02 (nova matriz; regra (b) revogada; `UC-10-RN-02` parcialmente decidida), RN-04, RN-07 (pendência por linha com dados completos e incorporação automática), RN-08 e RN-11 (client sem escrita em `nf_imports`) reescritas; RN-03 revogada (reenvio para completar deixou de existir); RN-14 e RN-15 marcadas `[CORRIGIDO]`; novas RN-16 (chave de acesso validada), RN-17 (zeros à esquerda em número, série, código e lote; CNPJ canônico), RN-18 ("ID 1000" sequencial por clínica), RN-19 (limite de 497 linhas) e RN-20 (emitente sem CNPJ); achados A1–A5 registrados como corrigidos. Fluxos Alternativos 7a (pendência), 7b (mesmo número, outra identidade), 7d (falha no arquivamento) e 7e (concorrência) novos; Fluxo de Exceção 8d reescrito (409), 8e removido, 8f reescrito (rollback total), novos 8h, 8i e 8j. RNF-03 removido, RNF-04 reescrito, novos RNF-05/RNF-06. Diagrama com a API route, a Cloud Function `onMasterProductWritten` e as relações com UC-12 e UC-44. Seções 2, 3, 4, 12, 13 e 14 atualizadas. Fontes: spec Seções 3, 4.5, 6 e 13; leitura do código em HEAD. Versão major por mudança de escopo do fluxo. |
