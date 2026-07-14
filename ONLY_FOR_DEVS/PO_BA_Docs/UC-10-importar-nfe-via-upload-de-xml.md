# UC-10: Importar NF-e via Upload de XML

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 1.0

> Um Clinic Admin faz upload do XML de uma NF-e SEFAZ v4.00 para importar automaticamente os produtos recebidos para o estoque da própria clínica — sem OCR, com extração direta do XML (número, produtos, lotes, validades, natureza da operação, forma de pagamento) e checagem de duplicidade por número da NF antes de qualquer gravação.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    Storage([🔧 Firebase Storage\ndanfe/{tenantId}/...])
    MasterCatalog([🔧 Catálogo Master\nmaster_products])
    SystemAdmin([👤 System Admin\nresolve pendências])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
    end

    ClinicAdmin --> UC10
    UC10 -.->|armazena o XML original| Storage
    UC10 -.->|busca produto por código exato| MasterCatalog
    UC10 -.->|produto não encontrado vira pendência, visível a| SystemAdmin
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** (`role: "clinic_admin"`) — único role autorizado a acessar `/clinic/upload` (a própria tela bloqueia explicitamente qualquer outro role com a mensagem "Apenas administradores podem fazer upload de NF-e").

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Storage:** armazena o arquivo XML original, em `danfe/{tenantId}/{timestamp}_{nome do arquivo}`.
- **Catálogo master de produtos (`master_products`):** mantido pelo System Admin (UC ainda não mapeado) — cada produto do XML é resolvido contra esse catálogo por código exato.
- **System Admin:** não participa diretamente deste UC, mas é notificado indiretamente — produtos do XML não encontrados no catálogo master viram uma pendência visível em `/admin/pending-products` (UC ainda não mapeado).

---

## 3. Pré-condições
- Usuário autenticado com `role === "clinic_admin"` e `tenant_id` definido.
- Usuário possui um arquivo XML de NF-e (SEFAZ v4.00, formato `<NFe><infNFe>` ou `<nfeProc><NFe><infNFe>`), com extensão `.xml` e até 10MB.

---

## 4. Pós-condições

### 4.1 Sucesso total (`status: "success"`)
- Todos os produtos do XML foram encontrados no catálogo master e adicionados ao inventário do tenant (`tenants/{tenantId}/inventory`), em um único `writeBatch`.
- O registro em `tenants/{tenantId}/nf_imports` fica com `status: "success"`, `produtos_importados` igual à contagem de itens gravados, `parsed_data` preenchido.
- O arquivo XML original permanece no Storage.

### 4.1b Sucesso parcial (`status: "novo_produto_pendente"`)
- Produtos encontrados no catálogo master foram adicionados normalmente ao inventário.
- Produtos **não** encontrados no catálogo master **não** são adicionados ao inventário — cada um gera um registro em `pending_master_products` (deduplicado por `tenant_id` + `nf_id` + `codigo`).
- O import fica com `status: "novo_produto_pendente"`, `produtos_pendentes` preenchido, e uma `error_message` orientando reenviar o XML após o cadastro do produto faltante.

### 4.2 Falha (Garantias Mínimas)
- Nenhum produto é adicionado ao inventário.
- Se a falha ocorrer antes da checagem de duplicidade (parse do XML), nenhum registro é criado em `nf_imports` nem arquivo é enviado ao Storage.
- Se a falha ocorrer durante o processamento pós-confirmação, o `nf_imports` já criado é marcado `status: "error"` com `error_message`.

---

## 5. Gatilho (Trigger)
O Clinic Admin acessa `/clinic/upload`, seleciona um arquivo XML e clica em "Importar NF-e".

---

## 6. Fluxo Principal (Basic Flow)

1. Clinic Admin acessa `/clinic/upload`.
2. Clinic Admin seleciona ou arrasta um arquivo `.xml` (o componente `FileUpload` valida extensão/MIME type e tamanho ≤ 10MB **antes** mesmo de habilitar o botão de importar).
3. Clinic Admin clica em "Importar NF-e".
4. Sistema envia o arquivo para `POST /api/parse-nf-xml`.
5. A API lê o XML com `fast-xml-parser` (`removeNSPrefix: true`), localiza o nó `infNFe` (dentro de `nfeProc/NFe` ou `NFe` diretamente) e retorna erro 422 se a estrutura não for reconhecida (ver Fluxo de Exceção 8a).
6. Para cada `<det>`: extrai `cProd`/`xProd` (nome convertido para maiúsculas), `qCom`, `vUnCom`; se houver um ou mais `<rastro>`, cria um `NFProduct` por rastro (lote `nLote`, validade convertida de `dVal`, fabricação de `dFab`); se **não** houver `<rastro>`, cria um único `NFProduct` com lote `"NÃO_INFORMADO"`, validade `"31/12/2099"` e `sem_rastro: true` (gera um warning — ver Fluxo Alternativo 7c).
7. A API extrai `natureza_operacao` de `<ide><natOp>`, calcula `forma_pagamento` a partir do `<detPag>` de **maior** `vPag` entre os existentes (descartando um `<detPag>` "fantasma" que a SEFAZ às vezes inclui com `vPag=0.00`), mapeando o código `tPag` para um rótulo legível (ex.: `"17"` → "Pagamento Instantâneo (PIX)"), e classifica `tipo_nota` por palavra-chave em `natOp` (contém "bonific" → `bonificacao`; contém "venda" → `venda`; senão → `outro`).
8. A API retorna `{ parsedNF, warnings }`.
9. Frontend valida que `parsedNF.produtos.length > 0` (senão, erro: "Nenhum produto foi encontrado no XML. Verifique se o arquivo é uma NF-e SEFAZ válida.").
10. Frontend chama `checkNumeroNFStatus(tenantId, parsedNF.numero, "xml")` — **antes** de subir o arquivo ao Storage, para não gravar arquivos de NFs que serão rejeitadas por duplicidade (RN-04). Se bloqueado, exibe o motivo e interrompe (ver Fluxo de Exceção 8d).
11. Sistema faz upload do arquivo original para o Storage (`danfe/{tenantId}/{timestamp}_{nome}`), com uma barra de progresso simulada (RNF-03).
12. Sistema cria um novo registro em `tenants/{tenantId}/nf_imports` (`status: "pending"`) **ou** reaproveita um registro existente, se `checkNumeroNFStatus` identificou um reenvio de NF com produtos pendentes (ver Fluxo Alternativo 7a).
13. Sistema exibe a tela de preview: contagem de produtos, número da NF, badge de tipo de nota (Bonificação/Venda/Outro), natureza da operação e forma de pagamento (se disponíveis), lista detalhada de cada produto (nome, código, lote, quantidade, validade, valor unitário — com destaque visual "Sem rastreamento" quando aplicável), aviso consolidado sobre produtos sem `<rastro>` (se houver), e aviso de que a confirmação é permanente.
14. Clinic Admin revisa e clica em "Confirmar e Adicionar ao Estoque".
15. Sistema marca o import como `"processing"` e, para cada produto do XML: pula silenciosamente se o par (código, lote) já constar no inventário desta mesma NF (reenvio parcial, RN-03); busca o produto no catálogo master por código exato (`cProd == code`); se encontrado, calcula a quantidade/valor final — multiplicando pela quantidade por embalagem e dividindo o valor, se o produto for fragmentável (RN-06) — e prepara para inserir; se não encontrado, registra como pendência.
16. Sistema grava, em um único `writeBatch`, todos os produtos resolvidos no inventário do tenant (herdando `nf_numero`, `nf_id`, `natureza_operacao`, `tipo_nota` da NF).
17. Se houver pendências, sistema registra cada uma em `pending_master_products` (deduplicado por `tenant_id` + `nf_id` + `codigo`).
18. Sistema atualiza o `nf_imports` para `status: "success"` (sem pendências) ou `"novo_produto_pendente"` (com pendências), gravando `produtos_importados`, `produtos_novos`, `produtos_pendentes`, `parsed_data`, e a `error_message` orientando reenvio (se houver pendência).
19. Sistema exibe a tela de sucesso com a lista de produtos, o badge de tipo de nota, e a mensagem de resultado (total adicionado, e total pendente se houver).
20. Caso de uso é concluído — com sucesso total ou parcial (RN-07).

---

## 7. Fluxos Alternativos

### 7a. Reenvio de XML para completar produtos pendentes (a partir do passo 10)
1. `checkNumeroNFStatus` encontra um `xmlImport` existente com `produtos_pendentes` não vazio para o mesmo `numero_nf`.
2. Sistema permite prosseguir (não bloqueia), reaproveitando o **mesmo** registro de `nf_imports` em vez de criar um novo.
3. No passo de confirmação, produtos cujo (código, lote) já estão no inventário desta NF são pulados silenciosamente (RN-03) — apenas os produtos ainda ausentes (inclusive os que antes estavam pendentes, se já cadastrados no catálogo master nesse meio-tempo) são processados.
4. Segue o Fluxo Principal a partir do passo 11.

### 7b. NF-e já existe apenas como importação manual (a partir do passo 10)
1. `checkNumeroNFStatus` não encontra nenhum import de origem `"xml"` para este `numero_nf`, apenas de origem `"manual"`.
2. Sistema permite a importação via XML normalmente — a partir deste ponto, a NF passa a ter (também) um registro de origem `"xml"`, e futuras tentativas de importação **manual** para o mesmo número passam a ser bloqueadas (RN-02).
3. Segue o Fluxo Principal a partir do passo 11.

### 7c. Produto sem `<rastro>` no XML (a partir do passo 6)
1. Um ou mais produtos não possuem o nó `<rastro>` (lote/validade).
2. Sistema atribui lote `"NÃO_INFORMADO"` e validade `"31/12/2099"`, marca `sem_rastro: true`, e adiciona um warning à lista retornada pela API.
3. O produto segue normalmente no fluxo, mas a tela de preview o destaca visualmente (borda âmbar + texto "Sem rastreamento") e exibe um Alert consolidado com a contagem de produtos afetados.

---

## 8. Fluxos de Exceção

### 8a. XML não é uma NF-e SEFAZ válida (a partir do passo 5)
1. O parser não encontra o nó `infNFe` (nem em `nfeProc/NFe` nem em `NFe` direto).
2. API retorna 422: "Arquivo não reconhecido como NF-e SEFAZ v4.00. Nó infNFe não encontrado."
3. Frontend exibe o erro e permanece na tela inicial.

### 8b. Número da NF ausente (a partir do passo 5)
1. `<nNF>` não encontrado ou vazio.
2. API retorna 422: "Número da NF-e (<nNF>) não encontrado no XML."

### 8c. Nenhum produto válido no XML (a partir do passo 6)
1. Nenhum `<det>` encontrado, ou todos os `<det>` são malformados (sem `cProd` ou `xProd` — cada um gera um warning `MALFORMED_PRODUCT` e é descartado individualmente).
2. Se sobrarem zero produtos válidos, API retorna 422: "Nenhum produto (<det>) encontrado no XML." ou "Nenhum produto válido pôde ser extraído do XML.", conforme o caso.
3. Se a API retornar sucesso mas com `produtos.length === 0` por qualquer outro motivo, o frontend também bloqueia com: "Nenhum produto foi encontrado no XML. Verifique se o arquivo é uma NF-e SEFAZ válida."

### 8d. NF já totalmente importada (a partir do passo 10)
1. `checkNumeroNFStatus` encontra um import de origem `"xml"` para este `numero_nf`, **sem** `produtos_pendentes`.
2. Sistema bloqueia com: "A NF {numero} já foi totalmente importada anteriormente."
3. Nenhum upload ao Storage nem registro em `nf_imports` é feito; usuário permanece na tela inicial.

### 8e. Produto do XML não existe no catálogo master (a partir do passo 15)
1. `getMasterProductByCode` não encontra nenhum documento em `master_products` com `code` igual ao código do produto (`cProd`).
2. O produto não é adicionado ao inventário; é registrado em `pending_master_products` (deduplicado).
3. O import termina com `status: "novo_produto_pendente"`; a mensagem orienta reenviar o XML após o cadastro (Fluxo Alternativo 7a).

### 8f. Erro inesperado durante o processamento (a partir dos passos 15-18)
1. Qualquer exceção durante a resolução ou a gravação dos produtos.
2. Sistema marca o import como `"error"`, grava `error_message`, e retorna `{ success: false, message }`, exibido na tela de erro.
3. O botão "Tentar Novamente" reinicia o fluxo do zero (novo upload) — não reaproveita automaticamente o import parcial; um novo upload do mesmo XML passaria novamente por `checkNumeroNFStatus`.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Uma NF-e é identificada exclusivamente pelo **número** (`numero_nf`), comparado dentro do mesmo tenant — não pelo par número+série, nem pela chave de acesso completa (`chNFe` não é usada para deduplicação). | Confirmado em `checkNumeroNFStatus` — usa apenas `where('numero_nf', '==', numeroNf)`. |
| RN-02 | **[v1, sinalizado pelo próprio usuário como sujeito a revisão]** Regras de bloqueio por duplicidade (`checkNumeroNFStatus`): (a) sem nenhum import prévio → permite XML ou manual; (b) só existe import manual prévio → manual sempre permitido (fracionado), XML permitido uma única vez e passa a travar o número para origem `xml`; (c) existe import XML com produtos pendentes → manual bloqueado, novo XML permitido (modo completar); (d) existe import XML sem pendências (completo) → bloqueia qualquer nova tentativa, XML ou manual. | Regra de negócio v1, implementada nesta mesma sessão de trabalho e explicitamente sinalizada pelo usuário como sujeita a revisão futura — não deve ser tratada como definitiva (ver seção 14). |
| RN-03 | O reenvio do mesmo XML para uma NF com pendências reaproveita o registro de importação existente (mesmo `importId`) e ignora silenciosamente produtos cujo par (código, lote) já foi gravado no inventário a partir desta mesma NF, evitando duplicar entradas de estoque a cada reenvio. | Confirmado em `processNFAndAddToInventory` (`getInventoryProdutoLoteKeysByNfId`) e no `handleUpload` do frontend (reaproveitamento do `importId`). |
| RN-04 | A verificação de duplicidade (`checkNumeroNFStatus`) ocorre **antes** do upload do arquivo ao Storage — evita gravar arquivos de NFs que serão rejeitadas. | Decisão de implementação explícita, documentada em comentário no próprio código do frontend. |
| RN-05 | Produtos sem o nó `<rastro>` no XML são importados com lote fixo `"NÃO_INFORMADO"` e validade fixa `31/12/2099`, marcados `sem_rastro: true` e sinalizados visualmente antes da confirmação. | Garante que a ausência de rastreabilidade no XML não impeça a importação, mas fique visível/rastreável na tela. |
| RN-06 | Produtos marcados como fragmentáveis no catálogo master (`fragmentavel: true`, com `unidades_por_embalagem` definido) têm a quantidade multiplicada pelas unidades por embalagem, e o valor unitário dividido pelo mesmo fator, ao entrar no inventário — o XML informa embalagens fechadas, mas o inventário passa a controlar unidades individuais. | Confirmado em `calcularQuantidadeInventario` — permite controle de estoque fracionado para produtos vendidos em caixa mas consumidos unitariamente. |
| RN-07 | Uma importação pode terminar com sucesso parcial (`status: "novo_produto_pendente"`): produtos já cadastrados no catálogo master são adicionados normalmente; os que não estão cadastrados ficam de fora, sem bloquear os demais, e geram uma pendência visível ao System Admin. | Evita que um único produto não cadastrado bloqueie a importação inteira de uma NF com múltiplos itens. |
| RN-08 | O matching entre um produto do XML e o catálogo master é feito por **igualdade exata** de código (`cProd` do XML == `code` de `master_products`) — sem correspondência parcial, por nome, ou tolerância a diferenças de formatação. | Confirmado em `getMasterProductByCode` (`where('code', '==', code)`). |
| RN-09 | `forma_pagamento` é derivada do `<detPag>` de **maior** `vPag` entre os existentes — implementado para descartar um `<detPag>` "fantasma" que a SEFAZ por vezes inclui com `vPag=0.00` além do pagamento real. | Comentário explícito em `parseNfeXml.ts` confirma esse comportamento como intencional, não um bug. |
| RN-10 | `tipo_nota` é inferido por correspondência de palavra-chave (case-insensitive, sem acentos) no texto de `<natOp>`: contém "bonific" → `bonificacao`; contém "venda" → `venda`; qualquer outro texto (ou ausente) → `outro`. | Classificação heurística simples, sem lista fechada de naturezas de operação possíveis (ver seção 14). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Arquivo limitado a `.xml` (validado por extensão e/ou MIME type) e 10MB no componente de upload (`FileUpload`) — antes mesmo do parse no servidor. | Usabilidade / Performance |
| RNF-02 | O parser (`fast-xml-parser`, `removeNSPrefix: true`) aceita tanto XML de NF-e "crua" (`<NFe><infNFe>`) quanto de processo completo (`<nfeProc><NFe><infNFe>`), cobrindo os dois formatos mais comuns exportados por sistemas emissores/SEFAZ. | Compatibilidade |
| RNF-03 | A barra de progresso do upload é simulada no frontend (incrementos de 10% a cada 300ms até 90%, saltando para 100% ao concluir) — não reflete o progresso real de bytes transferidos ao Storage. | Usabilidade (cosmético) |
| RNF-04 | Toda a gravação no inventário (`addInventoryItems`) usa um único `writeBatch` do Firestore, garantindo atomicidade entre os produtos resolvidos de uma mesma confirmação — ou todos os itens dessa leva são gravados, ou nenhum. | Confiabilidade |

---

## 11. Frequência de Uso
Alta — é o principal mecanismo de entrada de estoque da clínica, usado a cada NF-e recebida da Rennova (ou outro fornecedor emissor de NF-e compatível).

---

## 12. Casos de Uso Relacionados
- **"Gerenciar Catálogo Master de Produtos" (System Admin, UC ainda não mapeado)** é pré-condição indireta: só é possível resolver um produto do XML se ele já existir em `master_products`.
- **"Resolver Produtos Pendentes" (System Admin, `/admin/pending-products`, UC ainda não mapeado)** é o passo seguinte quando esta importação termina com `novo_produto_pendente`.
- Um eventual **"Importar NF-e Manualmente"** (origem `"manual"`, mencionada nas regras de `checkNumeroNFStatus` mas cuja tela não foi investigada nesta rodada) compartilha a mesma coleção `nf_imports` e as mesmas regras de bloqueio por `numero_nf` (RN-01/RN-02) — candidato a UC futuro.

---

## 13. Referências
- `src/app/(clinic)/clinic/upload/page.tsx`
- `src/app/api/parse-nf-xml/route.ts`
- `src/lib/parseNfeXml.ts`
- `src/lib/services/nfImportService.ts`
- `src/lib/services/inventoryService.ts` (`calcularQuantidadeInventario`, `addInventoryItems`, `getInventoryProdutoLoteKeysByNfId`)
- `src/lib/services/masterProductService.ts` (`getMasterProductByCode`)
- `src/lib/services/pendingMasterProductService.ts`
- `src/components/upload/FileUpload.tsx`
- `src/components/inventory/TipoNotaBadge.tsx`
- `src/types/nf.ts` (`ParsedNF`, `NFProduct`, `NFImport`, `NFNumeroStatus`, `TipoNota`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Sinalizado pelo próprio usuário]** RN-02 (regras de duplicidade/bloqueio por `numero_nf`) é v1, implementada nesta mesma sessão de trabalho, e está **explicitamente sujeita a revisão** — não deve ser tratada como definitiva. Qualquer alteração futura de comportamento aqui deve vir acompanhada de uma revisão deste UC.
2. **[Observação]** RN-01 usa apenas `numero_nf` (não a chave de acesso completa nem a série) para deduplicação — pode haver cenários (ex.: séries diferentes com o mesmo número, ou reemissão) não cobertos. Não confirmado se isso é intencional ou uma simplificação a revisar, junto com o item 1.
3. **[Observação]** RN-10 (classificação heurística de `tipo_nota` por palavra-chave) não tem lista fechada de naturezas de operação possíveis — qualquer natureza fora de "bonific"/"venda" cai em "outro". Não confirmado se há necessidade de mais categorias.
4. **[Nota de rastreabilidade]** Duas telas relacionadas ainda não foram mapeadas como UC formal: "Gerenciar Catálogo Master de Produtos" e "Resolver Produtos Pendentes" (`/admin/pending-products`), ambas do System Admin.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Documentado a partir de contexto detalhado fornecido pelo usuário (que implementou este fluxo nesta mesma sessão de trabalho, em PRs recentes já mergeados) e confirmado por leitura direta e completa de todos os arquivos envolvidos: `upload/page.tsx`, `api/parse-nf-xml/route.ts`, `parseNfeXml.ts`, `nfImportService.ts`, `inventoryService.ts` (funções relevantes), `masterProductService.ts`, `pendingMasterProductService.ts`, `FileUpload.tsx`, `TipoNotaBadge.tsx` e `types/nf.ts`. Registrado como aviso explícito, a pedido do próprio usuário, que a regra de duplicidade v1 (RN-02) está sujeita a revisão. |
