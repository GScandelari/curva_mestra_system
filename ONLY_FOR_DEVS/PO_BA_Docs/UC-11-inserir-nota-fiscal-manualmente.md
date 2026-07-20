# UC-11: Inserir Nota Fiscal Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Inventário
**Versão:** 1.1

> Um usuário da clínica insere manualmente, produto a produto, uma nota fiscal sem XML disponível — para produtos Rennova (buscados no catálogo master) ou de outras marcas (cadastro livre). É o fluxo irmão do UC-10 (Importar NF-e via Upload de XML), compartilhando a mesma tela de entrada (`/clinic/add-products`) e a mesma função de checagem de duplicidade por número de NF, mas com um caminho de gravação totalmente separado no código — inclusive com divergências de schema confirmadas em relação ao UC-10 (ver seções 9 e 14).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicUser([👤 Clinic Admin / Clinic User\n⚠️ ver nota sobre ator, seção 2.1])
    MasterCatalog([🔧 Catálogo Master\nmaster_products — só p/ Rennova])

    subgraph Sistema["Curva Mestra"]
        UC10(("UC-10\nImportar NF-e via\nUpload de XML"))
        UC11(("UC-11\nInserir Nota Fiscal\nManualmente"))
    end

    ClinicUser --> UC11
    UC11 -.->|busca produto por código, se Rennova| MasterCatalog
    UC11 -.->|opção "Importar XML da NF-e" redireciona para| UC10
```

---

## 2. Atores

### 2.1 Ator Primário
**[Divergência confirmada em relação ao contexto recebido]** O contexto inicial indicava `clinic_admin` como único ator, mas `/clinic/add-products/page.tsx` **não tem nenhuma checagem de role própria** — diferente de `/clinic/upload` (UC-10), que bloqueia explicitamente qualquer usuário que não seja `clinic_admin` com uma tela de "Acesso Negado". A única restrição de acesso vem do layout do grupo de rotas `(clinic)` (`src/app/(clinic)/layout.tsx`), que usa `ProtectedRoute allowedRoles={['clinic_admin', 'clinic_user']}` — ou seja, **hoje um `clinic_user` também consegue acessar e completar este fluxo por inteiro**, ao contrário do UC-10. Documentado como está (não corrigido); ver seção 14.

### 2.2 Atores Secundários / Sistemas Externos
**Catálogo master de produtos (`master_products`)** — consultado apenas quando o tipo escolhido é "Rennova"; produtos de "outra marca" não passam por nenhum catálogo, são cadastro totalmente livre.

---

## 3. Pré-condições
- Usuário autenticado com role `clinic_admin` ou `clinic_user` (ver divergência na seção 2.1) e `tenant_id` definido.
- Usuário possui em mãos os dados da nota fiscal e de cada produto — não precisa do arquivo XML.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Um documento é criado em `tenants/{tenantId}/nf_imports`, com `status: "success"`, `origem: "manual"`, `tipo` (`"rennova"`/`"outra_marca"`), e o array completo de `produtos` embutido no próprio documento da NF — gravado atomicamente junto com os itens de inventário via `writeBatch` (RN-07, **[CORRIGIDO]** no commit `16877f1`).
- Cada produto é gravado como um documento individual em `tenants/{tenantId}/inventory` (via `doc()` + `batch.set()`, não mais `addDoc` — RN-07, **[CORRIGIDO]**), referenciando a NF pelo campo `nf_import_id` (não `nf_id`, diferente de UC-10 — RN-11).

### 4.2 Falha (Garantias Mínimas)
- Se bloqueado por duplicidade, nenhuma gravação ocorre.
- Se ocorrer qualquer falha durante a gravação da NF ou de qualquer item de inventário, nenhuma gravação parcial ocorre — desde a correção do commit `16877f1` (RN-07, **[CORRIGIDO]**), a gravação usa um `writeBatch` atômico: ou a NF e todos os itens são gravados, ou nada é gravado.

---

## 5. Gatilho (Trigger)
Usuário acessa `/clinic/add-products` e percorre o wizard de 4 passos até confirmar na tela de revisão.

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário acessa `/clinic/add-products`. Sistema exibe o Passo 1: "Selecione o tipo de produto" — "Adicionar Produtos Rennova" ou "Adicionar Outras Marcas".
2. Se o usuário escolher "Rennova", sistema exibe o sub-passo "Como deseja adicionar os produtos Rennova?": "Inserção Manual" (este UC) ou "Importar XML da NF-e" (redireciona para `/clinic/upload`, UC-10 — ver Fluxo Alternativo 7a). Se escolher "Outras Marcas", o sistema pula direto para o Passo 2 (XML não é oferecido para outras marcas, pois o catálogo master é exclusivamente Rennova — RN-05).
3. Passo 2: usuário informa o número da NF (campo de texto livre, sem validação de formato — RN-08) e clica em "Continuar" (só valida que o campo não está vazio; **não verifica duplicidade neste momento** — RN-06/seção 14).
4. Passo 3 ("Produtos"): sistema exibe um resumo da NF (número, tipo) e a lista de produtos já adicionados (inicialmente vazia). Usuário clica em "Adicionar Produto", abrindo um Dialog:
   - **Se Rennova:** usuário busca o produto por código ou nome (autocomplete local sobre os `master_products` ativos, carregados uma única vez ao entrar no fluxo Rennova); ao selecionar um produto fragmentável, os rótulos mudam para "Número de Embalagens" e "Valor por Embalagem (R$)", com um texto auxiliar mostrando o cálculo em tempo real.
   - **Se outra marca:** usuário digita livremente código, nome e marca do produto (sem busca em nenhum catálogo).
   - Em ambos os casos, informa lote, quantidade/embalagens, data de validade (`<input type="date">`) e valor unitário/por embalagem.
   - Ao clicar em "Adicionar": sistema valida que todos os campos obrigatórios foram preenchidos, calcula a quantidade/valor final (via `calcularQuantidadeInventario`, só para Rennova fragmentável — RN-02, mesma lógica de UC-10) e adiciona o produto à lista **local** (ainda não gravado no Firestore).
   - Usuário repete para cada produto da NF; pode remover qualquer produto da lista antes de prosseguir (Fluxo Alternativo 7b).
5. Usuário clica em "Revisar e Confirmar" (exige pelo menos 1 produto na lista).
6. Passo 4 ("Revisão"): sistema exibe a NF, a tabela completa de produtos com valor total calculado, e um aviso de que a ação não pode ser desfeita automaticamente.
7. Usuário clica em "Confirmar e Salvar".
8. **Somente agora** o sistema chama `checkNumeroNFStatus(tenantId, numeroNF, "manual")` — se bloqueado, exibe o motivo (Fluxo de Exceção 8d).
9. Se não bloqueado, sistema remove campos `undefined` do array de produtos (o Firestore não os aceita), abre um `writeBatch(db)` e monta, via `doc(collection(db, 'tenants/{tenantId}/nf_imports'))`, a referência do documento da NF com `tenant_id`, `numero_nf`, `origem: "manual"`, `tipo`, `produtos` (array completo), `status: "success"`, `created_by: user?.email` (e-mail, não UID — RN-09), timestamps — adicionado ao batch via `batch.set(nfRef, nfData)` (RN-07, **[CORRIGIDO]** no commit `16877f1`; antes era um `addDoc` imediato, fora de qualquer batch).
10. Sistema então, no mesmo laço `for` percorrendo os produtos, cria uma referência (`doc(collection(db, 'tenants/{tenantId}/inventory'))`) para cada produto e a adiciona ao mesmo batch via `batch.set(inventoryRef, inventoryData)` (em vez de `addDoc` individual — RN-07, **[CORRIGIDO]**): `tenant_id`, `nf_import_id`, `nf_numero`, `master_product_id`/`produto_id`, `codigo_produto`, `nome_produto`, `category`, `lote`, `quantidade_inicial`/`quantidade_disponivel`, `dt_validade` (string, **não convertida** para `Timestamp` — RN-10), `valor_unitario`, `active: true`, `is_rennova`, `brand`, e os campos de fragmentação quando aplicável. Ao final do laço, um único `await batch.commit()` grava a NF e todos os itens atomicamente — se qualquer gravação falhar, o Firestore rejeita o batch inteiro e nada é persistido.
11. Sistema exibe o toast de sucesso: "Nota fiscal salva" / "NF {numero} foi salva e os produtos adicionados ao inventário", e redireciona para `/clinic/inventory`.
12. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Usuário escolhe importar via XML em vez de inserção manual (a partir do sub-passo do Passo 1, apenas Rennova)
1. Usuário clica em "Importar XML da NF-e" na tela "Como deseja adicionar os produtos Rennova?".
2. Sistema redireciona para `/clinic/upload` (UC-10) — nenhum dado deste wizard é aproveitado.
3. Este caso de uso é encerrado; UC-10 assume a partir daí.

### 7b. Usuário remove um produto da lista antes de revisar (a partir do Passo 3)
1. Usuário clica no ícone de lixeira na linha de um produto já adicionado.
2. Sistema remove o produto da lista local e exibe um toast de confirmação.
3. Fluxo retorna ao Passo 3.

### 7c. Usuário volta para editar a partir da revisão (a partir do Passo 4)
1. Usuário clica em "Voltar e Editar".
2. Sistema retorna ao Passo 3, mantendo a lista de produtos já adicionados.

---

## 8. Fluxos de Exceção

### 8a. Número da NF vazio (a partir do Passo 2)
1. Usuário clica em "Continuar" sem preencher o número da NF.
2. Sistema exibe toast: "Número da NF obrigatório" / "Informe o número da nota fiscal antes de continuar".
3. Permanece no Passo 2.

### 8b. Campos obrigatórios do produto incompletos (a partir do Passo 3)
1. Usuário clica em "Adicionar" no Dialog sem preencher algum campo obrigatório.
2. Sistema exibe toast: "Campos obrigatórios" / "Preencha todos os campos para adicionar o produto".
3. Dialog permanece aberto.

### 8c. Tentativa de revisar sem produtos (a partir do Passo 3)
1. Usuário tenta prosseguir com a lista de produtos vazia (o botão já vem desabilitado nesse caso, mas o handler também revalida).
2. Sistema exibe toast: "Adicione produtos" / "Adicione pelo menos um produto antes de continuar".

### 8d. NF bloqueada por duplicidade (a partir do Passo 4, ao confirmar)
1. `checkNumeroNFStatus` retorna `blocked: true` — cenário mais comum: já existe um import de origem `"xml"` para este `numero_nf` (RN-01, mesma regra de UC-10/RN-02, aplicada em modo espelhado).
2. Sistema exibe toast destructive: "Nota fiscal não pode ser adicionada", com o motivo retornado (ex.: "A NF {numero} já foi importada via XML e não aceita adição manual de produtos.").
3. Nenhuma gravação ocorre; usuário permanece na tela de revisão com a lista de produtos intacta (diferente de UC-10, que reinicia totalmente — aqui o usuário não perde os produtos já digitados, só não consegue salvar com este número).

### 8e. `tenant_id` ausente (a partir do Passo 4)
1. Situação anômala (sessão inconsistente) em que `tenantId` não está disponível.
2. Sistema exibe toast: "Erro" / "Tenant ID não encontrado".

### 8f. [Corrigido no commit `16877f1`] Falha durante a gravação dos itens de inventário, após a NF já ter sido criada com status "success" (histórico)
1. Antes da correção, o documento em `nf_imports` já era criado com `status: "success"` (via `addDoc` imediato) antes do laço de gravação dos itens de inventário começar (não havia um status intermediário como `"processing"`, diferente de UC-10).
2. Se o `addDoc` de um item de inventário falhasse no meio do laço (ex.: erro de rede, regra do Firestore, dado inválido), os itens anteriores ao ponto de falha já tinham sido gravados, os posteriores não — e **nada disso era revertido nem corrigido no documento da NF**, que permanecia `status: "success"` mesmo estando incompleta.
3. Sistema exibia apenas o toast genérico: "Erro ao salvar" / "Não foi possível salvar a nota fiscal" — sem indicar quantos produtos foram de fato gravados.
4. Usuário não tinha, nesta tela, nenhuma forma de saber quais produtos entraram e quais não — precisaria conferir manualmente em `/clinic/inventory`.
5. **[CORRIGIDO]** No commit `16877f1`, a função `handleSaveNF` passou a usar `writeBatch(db)`: a referência do documento da NF e a de cada item de inventário são adicionadas ao mesmo batch via `batch.set()`, e um único `await batch.commit()` grava tudo atomicamente ao final. Uma falha em qualquer ponto agora rejeita o batch inteiro — não existe mais gravação parcial com status `"success"` enganoso (ver seção 6, passos 9-10, e RN-07).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A checagem de duplicidade usa a mesma função `checkNumeroNFStatus` do UC-10, agora com `attemptedOrigem: "manual"`: bloqueia apenas se já existe um import de origem `"xml"` para este `numero_nf` (travado); se só existem outros lançamentos manuais anteriores para o mesmo número, permite livremente — o mesmo número de NF pode receber múltiplos lançamentos manuais ao longo do tempo (entrada fracionada). | Confirmado por leitura de `checkNumeroNFStatus` — mesmo comportamento descrito em UC-10 (RN-02 lá, também sinalizada como v1 sujeita a revisão). |
| RN-02 | Produtos Rennova fragmentáveis (`fragmentavel: true`, com `unidades_por_embalagem`) usam a mesma fórmula de UC-10 (`calcularQuantidadeInventario`): quantidade final = embalagens informadas × unidades por embalagem; valor unitário final = valor por embalagem ÷ unidades por embalagem. | Confirmado — mesma função compartilhada com UC-10. |
| RN-03 | Produtos de "outra marca" nunca passam por `calcularQuantidadeInventario` — não existe o conceito de fragmentação fora do catálogo master; a quantidade e o valor informados são usados exatamente como digitados. | Confirmado por leitura do código — cadastro livre não tem noção de embalagem. |
| RN-04 | O catálogo master (`master_products`, filtrado por `active: true`) só é consultado quando o tipo escolhido é "Rennova"; produtos de outra marca são sempre cadastro livre, sem nenhuma validação contra um catálogo. | Confirmado — `loadMasterProducts` só é chamado quando `tipoNF === "rennova"`. |
| RN-05 | A opção "Importar XML da NF-e" só é oferecida dentro do fluxo Rennova — para "outra marca" não existe alternativa de XML, pois a extração de XML (UC-10) só resolve produtos contra o catálogo master, que é exclusivamente Rennova. | Confirmado pela ausência do sub-passo de escolha de método quando `tipoNF === "outra_marca"`. |
| RN-06 | **[Confirmado, inconsistência de UX com UC-10]** A checagem de duplicidade só ocorre no **último** passo do wizard (ao clicar em "Confirmar e Salvar"), não logo após o número da NF ser informado (Passo 2). Um usuário pode preencher o número, adicionar vários produtos manualmente, revisar, e só então descobrir que a NF está bloqueada. Diferente de UC-10, que verifica a duplicidade antes até do upload do arquivo. | Inconsistência de UX confirmada por leitura do código — não corrigida nesta rodada; ver seção 14. |
| RN-07 | **[CORRIGIDO — commit `16877f1`]** O documento em `nf_imports` era criado com `status: "success"` fixo antes de qualquer item de inventário ser gravado, e a gravação dos itens era feita em um laço de `addDoc` sequenciais — não um `writeBatch` atômico como em UC-10. Uma falha no meio do laço deixava a importação parcialmente gravada, sem nenhum mecanismo de rollback ou correção do status da NF, que permanecia `"success"` mesmo estando incompleta. Corrigido: `handleSaveNF` agora usa `writeBatch(db)` — a NF (`doc(collection(...))` + `batch.set()`) e todos os itens de inventário (mesmo padrão) são adicionados ao mesmo batch e gravados atomicamente por um único `batch.commit()`; qualquer falha rejeita o batch inteiro, sem gravação parcial. | Corrigido por leitura direta de `handleSaveNF` (commit `16877f1`) — mesmo padrão de atomicidade já usado no fluxo de importação via XML (UC-10, `writeBatch`), conforme convenção documentada no CLAUDE.md do projeto. |
| RN-08 | O campo `numero_nf` deste fluxo é texto livre, sem nenhuma validação de formato — diferente de UC-10, onde o número vem estruturado do XML (`<nNF>`). | Confirmado — único critério é "não vazio". |
| RN-09 | O campo `created_by` do documento da NF é gravado como o **e-mail** do usuário (`user?.email`, com fallback `"unknown"`), diferente de UC-10 (`createNFImport`), que grava o **UID** do usuário em `created_by`. | Divergência de schema confirmada por comparação direta do código dos dois fluxos — o mesmo campo tem semânticas diferentes conforme a origem da NF. |
| RN-10 | O campo `dt_validade` gravado nos itens de inventário deste fluxo é uma **string** no formato do `<input type="date">` (ex.: `"2026-12-31"`), **não convertida** para `Timestamp` do Firestore — diferente de UC-10 (`addInventoryItems`), que grava `dt_validade` como `Timestamp.fromDate(...)`. | Divergência de schema confirmada — itens de inventário do mesmo tenant podem ter `dt_validade` em dois tipos de dado diferentes conforme a origem (XML vs. manual), o que pode quebrar telas/relatórios que esperam um `Timestamp` (ex.: ordenação por validade, alertas de vencimento). Ver seção 14. |
| RN-11 | O campo usado para referenciar a NF de origem no item de inventário é `nf_import_id` neste fluxo, enquanto UC-10 usa `nf_id` para o mesmo propósito. | Divergência de nome de campo confirmada por comparação direta do código — qualquer consulta/relatório que dependa desse vínculo precisa tratar os dois nomes separadamente conforme a origem do item. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[CORRIGIDO — commit `16877f1`]** A gravação da NF e dos itens de inventário agora é atômica via `writeBatch` (RN-07), igual a UC-10. Antes da correção, os itens eram gravados um a um via `addDoc` sequencial, sem atomicidade. | Confiabilidade |
| RNF-02 | O autocomplete de produtos Rennova roda inteiramente no cliente, sobre a lista de `master_products` ativos carregada uma única vez ao entrar no fluxo Rennova (sem paginação nem busca server-side); mostra no máximo 10 sugestões por vez. | Performance / Usabilidade |
| RNF-03 | Este fluxo (diferente de UC-10) não captura nem grava `natureza_operacao`, `forma_pagamento` ou `tipo_nota` em nenhum dos dois documentos criados (`nf_imports`, `inventory`) — não há XML para extrair essa informação. Os itens de inventário criados aqui não exibem o `TipoNotaBadge` nas telas que o utilizam. | Confirmado — nenhum desses três campos aparece em `nfData` nem em `inventoryData` neste arquivo. |

---

## 11. Frequência de Uso
Alta — junto com UC-10, é um dos dois mecanismos principais de entrada de estoque; usado quando a clínica não tem (ou não quer usar) o XML da NF-e.

---

## 12. Casos de Uso Relacionados
- **UC-10 (Importar NF-e via Upload de XML)** é o fluxo irmão — mesma tela de entrada (`/clinic/add-products`), mesma função de checagem de duplicidade (`checkNumeroNFStatus`, "espelhada" para origem manual/xml), mas caminho de gravação totalmente separado no código, com as divergências de schema confirmadas nas RN-09 a RN-11.
- **"Gerenciar Catálogo Master de Produtos" (System Admin, UC ainda não mapeado)** é pré-condição indireta apenas para o ramo Rennova deste UC.

---

## 13. Referências
- `src/app/(clinic)/clinic/add-products/page.tsx`
- `src/app/(clinic)/layout.tsx` (`ProtectedRoute allowedRoles` — origem da divergência de ator, seção 2.1)
- `src/app/(clinic)/clinic/upload/page.tsx` (UC-10 — destino do redirecionamento em 7a)
- `src/lib/services/nfImportService.ts` (`checkNumeroNFStatus`; comparação com `createNFImport`/`addInventoryItems` de UC-10)
- `src/lib/services/inventoryService.ts` (`calcularQuantidadeInventario`)
- `src/types/masterProduct.ts` (`getNomeCompletoMasterProduct`)
- `src/lib/brandUtils.ts` (`normalizeBrand`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Divergência confirmada, não assumida como intencional]** O ator real deste UC inclui `clinic_user`, não só `clinic_admin` como informado inicialmente — não há checagem de role própria na página, diferente de UC-10. Não confirmado se isso é intencional (talvez devesse ser restrito a `clinic_admin`, como o upload de XML) ou se é uma omissão.
2. **[Resolvido — commit `16877f1`]** RN-07 — `nf_imports` e os itens de inventário agora são gravados atomicamente via `writeBatch`; antes, o status `"success"` era fixado antes da gravação não atômica (`addDoc` sequencial) dos itens, sem rollback em caso de falha parcial.
3. **[Inconsistência confirmada]** RN-06 — a checagem de duplicidade só ocorre no último passo do wizard, não logo após informar o número da NF, ao contrário de UC-10.
4. **[Divergências de schema confirmadas, relevantes para consultas/relatórios futuros]** RN-09, RN-10, RN-11 — `created_by` (e-mail vs. UID), `dt_validade` (string vs. `Timestamp`), e nome do campo de vínculo com a NF (`nf_import_id` vs. `nf_id`) diferem entre os itens de inventário criados por UC-10 e por este UC-11.
5. **[Nota, já registrada em UC-10]** "Gerenciar Catálogo Master de Produtos" ainda não foi mapeado como UC formal.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Confirmado por leitura completa de `add-products/page.tsx` e do layout do grupo de rotas `(clinic)`. Identificadas, além do contexto fornecido, quatro divergências relevantes não mencionadas inicialmente: (1) o ator real inclui `clinic_user`, não só `clinic_admin`; (2) a gravação dos itens de inventário é feita via `addDoc` sequencial, não `writeBatch`, e o status da NF já é fixado como `"success"` antes da gravação — falha parcial não é refletida nem revertida (bug confirmado, RN-07); (3) a checagem de duplicidade só ocorre no último passo do wizard (RN-06); (4) três divergências de nome/tipo de campo em relação aos itens de inventário criados por UC-10 (`created_by`, `dt_validade`, `nf_import_id` vs. `nf_id` — RN-09 a RN-11). |
| 1.1 | 20/07/2026 | Guilherme Scandelari | **Correção de bug (commit `16877f1`)**: RN-07 corrigido — `handleSaveNF` passou a usar `writeBatch(db)` para gravar o documento da NF e todos os itens de inventário atomicamente, em vez de `addDoc` sequencial com o status `"success"` fixado antes da gravação dos itens. Fluxo de Exceção 8f reescrito como histórico "[Corrigido]"; seções 4.1, 4.2, 6 (passos 9-10), 9 (RN-07), 10 (RNF-01) e 14 (item 2) atualizadas para refletir a atomicidade da gravação. Nenhuma das demais divergências confirmadas (ator, RN-06, RN-09 a RN-11) foi alterada por esta correção. |
