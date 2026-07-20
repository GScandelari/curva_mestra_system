# UC-32: Editar, Ativar e Desativar Produto no Catálogo Master

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Catálogo de Produtos Master — Rennova)
**Versão:** 1.0.3

> Um System Admin edita os dados de um produto do catálogo master (`admin/products/[id]`) e/ou alterna seu status entre "Ativo" e "Inativo" diretamente na listagem (`admin/products`, sem confirmação). **Achado crítico [CORRIGIDO no commit `f6e9161`]:** quando o produto já estava em uso no inventário de alguma clínica, o formulário de edição bloqueava **toda** a operação de salvar — inclusive alterações que nada tinham a ver com fragmentação (nome, categoria, status) — porque o campo `fragmentavel` era sempre reenviado no payload, disparando incondicionalmente a checagem de bloqueio pensada apenas para os campos de fragmentação. Corrigido: o payload só inclui `fragmentavel`/`unidades_por_embalagem` quando esses campos realmente mudam em relação ao produto carregado, e a checagem de "produto em uso" só é disparada nesse caso (ver RN-01). Um `deleteMasterProduct` (hard delete) existe no serviço, mas é código morto, nunca chamado por nenhuma tela.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC31(("UC-31\nCadastrar Produto no\nCatálogo Master"))
        UC32(("UC-32\nEditar/Ativar/Desativar\nProduto (checagem de uso\nsó se fragmentação muda)"))
    end

    subgraph Orfao["⚠️ Função órfã — nunca chamada"]
        DelFn(("deleteMasterProduct()\n(hard delete, sem botão\nem lugar nenhum)"))
    end

    SystemAdmin --> UC32
    UC31 --> UC32
    UC32 -.->|alcance real bem menor\nque o esperado| DelFn
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — telas restritas por `ProtectedRoute allowedRoles: ['system_admin']` (`src/app/(admin)/layout.tsx`).

### 2.2 Atores Secundários / Sistemas Externos
- **Clínicas (indiretamente)** — o status `active` de um produto master afeta se ele aparece como sugestão na inserção manual de NF-e (UC-11), e um produto "em uso" (`isMasterProductInUse`) é aquele referenciado em `inventory` de pelo menos uma clínica.
- Nenhum sistema externo (Firebase Auth, e-mail) envolvido — mesmo padrão "sem API/Function" já descrito em UC-31.

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`, `active === true`.
- Existe um produto com o id informado em `master_products`.

---

## 4. Pós-condições

### 4.1 Sucesso — Editar (produto não está em uso)
- `master_products/{id}` é atualizado com os campos informados (`code`, `name`, `active`, `category`, e — desde o commit `f6e9161` — `fragmentavel`/`unidades_por_embalagem` apenas se esses dois campos realmente mudaram em relação ao produto carregado) e `updated_at`. **Desde o commit `2ddebd6` (RN-06):** se `category` for enviado como `null` (opção "Sem categoria" selecionada na UI), o campo `category` é removido do documento via `deleteField()`, em vez de apenas receber um valor vazio ou permanecer intocado.
- Sistema exibe "Produto atualizado com sucesso!" e, após 1,5s, redireciona para `/admin/products`.

### 4.1b Sucesso — Ativar/Desativar (listagem)
- `master_products/{id}.active` alterna instantaneamente, **sem diálogo de confirmação** e **sem checar se o produto está em uso** (RN-02).
- A lista é recarregada (`loadProducts`) e a linha reflete o novo status.

### 4.2 Falha (Garantias Mínimas)
- **[Achado crítico, corrigido no commit `f6e9161`]** Se o produto estiver em uso (`isMasterProductInUse === true`) **e** o admin alterar `fragmentavel`/`unidades_por_embalagem` em relação ao valor já salvo: nenhum campo é alterado — o serviço aborta a operação inteira antes de gravar qualquer coisa (RN-01). Desde a correção, editar apenas nome, categoria ou status de um produto em uso **não** aciona mais esse bloqueio.
- Se a validação de código duplicado falhar: nenhuma alteração é feita.
- Demais falhas (rede, Firestore indisponível): nenhuma alteração parcial identificada — ambas as operações (`updateDoc` de edição, `updateDoc` de toggle) são escritas únicas.

---

## 5. Gatilho (Trigger)
- **Editar:** System Admin, na listagem `/admin/products`, clica no ícone de edição (lápis) de um produto, é levado a `/admin/products/{id}`, altera campos e clica em "Salvar Alterações".
- **Ativar/Desativar:** System Admin, na mesma listagem, clica diretamente no ícone Power (produto inativo → ativar) ou PowerOff (produto ativo → desativar) na linha do produto.

---

## 6. Fluxo Principal (Basic Flow) — Editar

1. System Admin acessa `/admin/products/{id}`.
2. Sistema chama `getMasterProduct(id)` e `isMasterProductInUse(id)` em paralelo (`Promise.all`); pré-preenche o formulário (código, nome, categoria, ativo/inativo, fragmentável, unidades por embalagem) e guarda o resultado em `emUso`.
3. Se `emUso === true`, sistema exibe um banner de aviso (âmbar): "Este produto está em uso no inventário de clínicas. As configurações de fragmentação não podem ser alteradas." e desabilita apenas o switch "Produto Fragmentável" e o campo "Unidades por Embalagem" — os demais campos (código, nome, categoria, status) permanecem editáveis e, desde a correção do commit `f6e9161`, realmente podem ser salvos sem bloqueio (ver RN-01).
4. System Admin altera os campos desejados — incluindo, no campo "Categoria", a opção "Sem categoria" (`<SelectItem value="none">`), disponível desde o commit `2ddebd6`, para limpar uma categoria já definida (RN-06).
5. Clica em "Salvar Alterações".
6. Sistema valida no client: código com 7 dígitos, nome não vazio, unidades ≥ 2 se fragmentável (mesmas regras do UC-31).
7. **[Corrigido no commit `f6e9161`]** Sistema calcula `fragmentacaoAlterada` — `true` somente se `fragmentavel` for diferente do `product.fragmentavel` carregado, ou se `fragmentavel === true` e `unidades_por_embalagem` for diferente do valor carregado. Sistema chama `updateMasterProduct(id, { code, name, active, category, ...(fragmentacaoAlterada && { fragmentavel, unidades_por_embalagem }) })` — o payload só inclui `fragmentavel`/`unidades_por_embalagem` quando `fragmentacaoAlterada === true`; caso contrário, esses dois campos ficam `undefined` e não são enviados. O campo `category` continua sendo enviado como `category || null` — `null` quando "Sem categoria" está selecionado.
8. O serviço calcula `tentandoAlterarFragmentacao = data.fragmentavel !== undefined || data.unidades_por_embalagem !== undefined` — agora essa condição só é verdadeira quando o formulário efetivamente enviou esses campos (passo 7), ou seja, apenas quando a fragmentação realmente mudou (RN-01, `[CORRIGIDO]`).
9. Se `tentandoAlterarFragmentacao === true`, o serviço chama `isMasterProductInUse(id)` **novamente** (segunda chamada, redundante com o passo 2) — se `true`, lança a exceção "Este produto já está em uso..." e nenhum campo é gravado (ver Fluxo de Exceção 8a). Se `tentandoAlterarFragmentacao === false` (fragmentação não mudou), essa checagem é pulada e a gravação segue normalmente, mesmo que o produto esteja em uso.
10. Se o produto não estiver em uso (ou se a fragmentação não mudou), o serviço grava as alterações em `master_products/{id}` (`code.trim()`, `name.trim().toUpperCase()`, `active`, `category` — `deleteField()` se `null`, ou o valor informado —, `fragmentavel`/`unidades_por_embalagem` quando enviados, `updated_at: serverTimestamp()`).
11. Sistema exibe "Produto atualizado com sucesso!" e, após 1,5s, redireciona para `/admin/products`.
12. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Ativar/Desativar diretamente na listagem (sem passar pela tela de edição)
1. Na tela `/admin/products`, System Admin clica no ícone Power/PowerOff na linha de um produto.
2. Sistema chama `handleToggleActive(productId, currentActive)`, que executa diretamente `deactivateMasterProduct(id)` (se estava ativo) ou `reactivateMasterProduct(id)` (se estava inativo) — **sem nenhum diálogo de confirmação** (diferente do padrão `confirm()` usado no módulo de Consultores, UC-29, Fluxos Alternativos 7a/7b) e **sem chamar `isMasterProductInUse`** — um produto ativamente usado no inventário de uma ou mais clínicas pode ser desativado com um único clique, sem qualquer aviso (RN-02).
3. `deactivateMasterProduct`/`reactivateMasterProduct` grava apenas `{ active: true|false, updated_at }`.
4. Sistema recarrega a lista (`loadProducts`); a linha reflete o novo status e o ícone alterna.

---

## 8. Fluxos de Exceção

### 8a. Edição bloqueada por produto em uso, com fragmentação alterada (RN-01)
1. Produto está em uso (`isMasterProductInUse === true`) e o admin altera `fragmentavel`/`unidades_por_embalagem` em relação ao valor carregado, e o formulário é submetido — desde o commit `f6e9161`, isso só ocorre quando `fragmentacaoAlterada === true` (passo 7 do Fluxo Principal); editar apenas outros campos não aciona mais este fluxo.
2. O serviço lança "Este produto já está em uso no inventário de clínicas. As configurações de fragmentação não podem ser alteradas."
3. Sistema exibe a mensagem de erro; nenhum campo é salvo.

### 8b. Código duplicado ao editar
1. Admin altera o campo "Código do Produto" para um valor já usado por outro produto (`getMasterProductByCode` encontra um documento com `id` diferente do produto sendo editado).
2. Serviço lança "Já existe um produto com o código {code}"; nenhuma alteração é feita.

### 8c. Validação client-side falha
1. Código fora do padrão de 7 dígitos, nome vazio, ou unidades por embalagem inválidas (< 2) quando fragmentável.
2. Sistema exibe a mensagem específica; nenhuma chamada ao Firestore é feita.

### 8d. Produto não encontrado
1. `getMasterProduct(id)` lança "Produto não encontrado" (id não corresponde a nenhum documento).
2. Sistema exibe "Produto não encontrado" com um botão "Voltar para Produtos".

### 8e. Falha ao ativar/desativar na listagem
1. `deactivateMasterProduct`/`reactivateMasterProduct` lança exceção (rede, permissão).
2. Sistema exibe a mensagem de erro em um bloco no topo da listagem; a linha do produto mantém o status anterior (sem otimistic update — só é atualizado após recarregar com sucesso).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[CORRIGIDO no commit `f6e9161`]** Antes: o formulário de edição (`admin/products/[id]/page.tsx`) sempre enviava o campo `fragmentavel` no payload de `updateMasterProduct`, mesmo quando o admin não alterava nada relacionado a fragmentação. Como `updateMasterProduct` interpretava a mera presença de `fragmentavel !== undefined` como "tentando alterar fragmentação", a checagem `isMasterProductInUse` era disparada em **toda** submissão do formulário — e, se o produto estivesse em uso, a operação inteira era abortada **antes** de qualquer campo ser gravado. Na prática, um produto em uso no inventário de qualquer clínica não podia ser editado de forma alguma através desta tela — nem para corrigir um erro de digitação no nome, nem para trocar a categoria, nem para reativá-lo/desativá-lo — mesmo que a UI (banner + switch desabilitado) sugerisse que apenas os campos de fragmentação estavam bloqueados. Agora: em `handleSubmit` (`admin/products/[id]/page.tsx`), uma nova constante `fragmentacaoAlterada` compara `fragmentavel`/`unidadesPorEmbalagem` atuais contra os valores originais carregados em `product` (`product.fragmentavel`, `product.unidades_por_embalagem`); o payload enviado a `updateMasterProduct` só inclui `fragmentavel`/`unidades_por_embalagem` (via spread condicional `...(fragmentacaoAlterada && {...})`) quando esses campos realmente mudaram — caso contrário ficam `undefined`, e a checagem de bloqueio em `isMasterProductInUse` nunca é acionada para edições que não tocam fragmentação. | Confirmado por leitura literal de `handleSubmit` em `admin/products/[id]/page.tsx` (nova constante `fragmentacaoAlterada` e spread condicional) e de `updateMasterProduct` em `masterProductService.ts` (a condição `tentandoAlterarFragmentacao` agora só é verdadeira quando o payload efetivamente inclui os campos de fragmentação). Commit `f6e9161` (`fix: tres itens de alta severidade (UC-32, UC-04, UC-39)`). |
| RN-02 | **[Achado]** Ativar/Desativar diretamente na listagem (`handleToggleActive`) não exibe nenhum diálogo de confirmação — diferente do padrão `window.confirm()` usado para suspender/reativar consultores (UC-29) — e não verifica `isMasterProductInUse` antes de desativar. Um produto em uso corrente no inventário de uma ou mais clínicas pode ser desativado com um único clique acidental. | Confirmado por leitura completa de `handleToggleActive` em `admin/products/page.tsx` — chamada direta a `deactivateMasterProduct`/`reactivateMasterProduct`, sem `confirm()` nem checagem prévia de uso. |
| RN-03 | **[Achado de inconsistência entre módulos]** Desativar um produto (`active: false`) tem efeito **parcial e inconsistente** entre os dois fluxos de entrada de produtos: (1) na inserção manual de NF-e (UC-11), `loadMasterProducts` filtra explicitamente `where('active', '==', true)` — um produto desativado **desaparece** das sugestões de autocomplete; (2) na importação de NF-e via XML (UC-10), `getMasterProductByCode` faz o matching **sem nenhum filtro de `active`** — um produto desativado continua sendo encontrado e importado normalmente se aparecer em um XML. Ou seja, "desativar" um produto no catálogo master bloqueia apenas um dos dois caminhos de entrada de estoque, não ambos. | Confirmado por leitura de `loadMasterProducts` em `clinic/add-products/page.tsx` (`where('active', '==', true)`) versus `getMasterProductByCode` em `masterProductService.ts` (usado por `nfImportService.ts`, sem filtro de `active`). |
| RN-04 | **[Achado de código morto]** `deleteMasterProduct` (hard delete, `deleteDoc`) existe em `masterProductService.ts`, mas **nenhuma tela do sistema o chama** — nem a listagem, nem a tela de edição. O único mecanismo de "remoção" exposto na UI é a desativação (`active: false`), que é reversível. Mesmo padrão de função órfã já observado em outros módulos (ex.: rota `DELETE` de consultores no UC-29 RN-02, `createConsultant` órfã no UC-28 RN-06). | Confirmado por grep — zero ocorrências de `deleteMasterProduct(` fora da própria definição. |
| RN-05 | Alterar o campo `code` de um produto **já em uso** nos inventários das clínicas não tem nenhuma checagem própria — mesmo após a correção de RN-01, alterar apenas `code` (sem tocar fragmentação) não dispara `isMasterProductInUse`, já que `fragmentacaoAlterada` só considera `fragmentavel`/`unidades_por_embalagem`. O vínculo do inventário é por `master_product_id` (o id do documento, não o `code`), mas a importação de XML (UC-10) faz o matching por `code` — trocar o código de um produto em uso pode fazer produtos futuros de NF-e pararem de "casar" com o catálogo, mesmo já existindo internamente sob outro código. | Consequência lógica confirmada pela combinação de `updateMasterProduct` (sem checagem específica para mudança de `code`, mesmo após a correção de RN-01) com o uso de `code` como chave de matching em `getMasterProductByCode` (UC-10, RN-08). |
| RN-06 | **[Corrigido no commit `2ddebd6` — UC-32-RN-06]** O `<Select>` de categoria da tela de edição (`admin/products/[id]/page.tsx`) agora oferece a opção "Sem categoria" (`<SelectItem value="none">Sem categoria</SelectItem>`), com `value={category \|\| 'none'}` e `onValueChange={(v) => setCategory(v === 'none' ? '' : (v as MasterProductCategory))}` — o admin consegue limpar a categoria de um produto já categorizado diretamente pela UI. O payload enviado a `updateMasterProduct` mudou de `category: category \|\| undefined` para `category: category \|\| null`, usando `null` como sinal explícito de "limpar". **Bug adicional descoberto e corrigido no mesmo commit (causa raiz de por que a limpeza não funcionava de fato):** em `masterProductService.ts`, `updateMasterProduct` tinha `if (data.category !== undefined) firestoreData.category = data.category;` — como a UI antiga enviava `category: undefined` para "limpar", essa condição nunca disparava, e o campo `category` nunca era de fato removido no Firestore (o valor antigo permanecia intacto mesmo com a intenção de limpeza). Corrigido para `if (data.category !== undefined) { firestoreData.category = data.category === null ? deleteField() : data.category; }`, usando `deleteField()` do Firestore quando `category === null`. O tipo `UpdateMasterProductData.category` (`src/types/masterProduct.ts`) mudou de `MasterProductCategory` para `MasterProductCategory \| null` para suportar o novo contrato explícito de limpeza. **Achado adicional confirmado durante validação manual desta correção, já nascido corrigido no mesmo padrão (commit `199d09b`):** o `<Select>` de categoria da tela de **listagem** (`admin/products/page.tsx`) tinha a mesma lacuna original do RN-06 (a própria v1.0 deste UC já registrava a ausência de "Nenhuma categoria" em "ambas as telas" — edição e listagem) e não havia sido corrigida junto com o formulário de edição no commit `2ddebd6`: só oferecia "Todas as categorias" mais cada categoria específica, sem opção para filtrar produtos sem categoria definida. Corrigido no commit `199d09b`, no mesmo padrão do formulário de edição: o estado `categoryFilter` foi ampliado de `useState<MasterProductCategory | 'all'>('all')` para `useState<MasterProductCategory | 'all' | 'none'>('all')`; a função `filterProducts` ganhou o branch `if (categoryFilter === 'none') { filtered = filtered.filter((p) => !p.category); }` antes do `else if (categoryFilter !== 'all')`; e o `<Select>` ganhou `<SelectItem value="none">Sem categoria</SelectItem>` logo após "Todas as categorias". Diferente da correção do formulário de edição, este filtro é puramente client-side sobre os `products` já carregados em memória (sem escrita no Firestore), então não havia bug equivalente ao do `updateMasterProduct`/`deleteField()` a corrigir aqui. | Confirmado por leitura direta de `admin/products/[id]/page.tsx` (novo `SelectItem`, `onValueChange`, payload `category: category \|\| null`), `masterProductService.ts` (`updateMasterProduct`, uso de `deleteField()`) e `src/types/masterProduct.ts` (`category?: MasterProductCategory \| null`) para a correção do formulário de edição; e por leitura direta de `admin/products/page.tsx` (estado `categoryFilter`, branch `categoryFilter === 'none'` em `filterProducts`, novo `SelectItem value="none"`) para a correção do filtro da listagem. |
| RN-07 | Assim como no cadastro (UC-31, RN-02), a autorização desta operação depende inteiramente da regra `allow write: if isSystemAdmin()` do Firestore, sem nenhuma revalidação de formato de dados no backend (não há rota `/api/products/*`). | Confirmado por leitura completa de `masterProductService.ts` — nenhuma chamada a Admin SDK ou API route. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Mitigado no commit `f6e9161`]** RN-01 era um bug funcional relevante: impedia qualquer manutenção (mesmo cosmética) em produtos já usados por clínicas — que tendem a ser justamente os produtos mais importantes do catálogo. Corrigido: o bloqueio agora só ocorre quando a fragmentação realmente muda. | Confiabilidade |
| RNF-02 | Ausência de confirmação ao ativar/desativar direto na listagem (RN-02) é uma divergência de padrão de UX/segurança operacional em relação ao módulo de Consultores (UC-29). | Usabilidade |
| RNF-03 | RN-03 (inconsistência do efeito de `active` entre UC-10 e UC-11) pode gerar confusão: um admin que desative um produto "para não ser mais usado" pode não perceber que ele continua entrando via importação de XML. | Confiabilidade / Comunicação |

---

## 11. Frequência de Uso
Ocasional — edição e ativação/desativação de produtos do catálogo não são operações do dia a dia.

---

## 12. Casos de Uso Relacionados
- **UC-31 (Cadastrar Produto no Catálogo Master)** — pré-condição; ciclo de vida do produto criado ali continua neste UC.
- **UC-10 (Importar NF-e via Upload de XML)** e **UC-11 (Inserir Nota Fiscal Manualmente)** — consumidores do campo `active` deste catálogo, com comportamento inconsistente entre si (RN-03).
- **UC-29 (Editar, Suspender e Reativar Consultor)** — mesmo padrão de agrupar edição + toggle de status em um único UC, e achado estruturalmente similar (mecanismo de "remoção definitiva" existe no serviço, mas está órfão — RN-04 aqui, RN-02 lá); porém, diferente daquele UC, o achado central aqui não era "o botão fraco não faz nada", e sim "o botão de edição bloqueava mais do que deveria" quando o produto estava em uso (corrigido, RN-01).
- **UC-13 (Desativar Item de Estoque com Verificação de Reservas Ativas)** — mesmo padrão conceitual de "bloquear desativação quando há uso ativo", mas implementado de forma bem mais completa naquele UC (nível de item de inventário por tenant) do que aqui (nível de catálogo global, e apenas para os campos de fragmentação, desde a correção de RN-01).

---

## 13. Referências
- `src/app/(admin)/admin/products/page.tsx` (listagem, ativar/desativar — inclui filtro `SelectItem` "Sem categoria", RN-06)
- `src/app/(admin)/admin/products/[id]/page.tsx` (edição — inclui `SelectItem` "Sem categoria", RN-06; constante `fragmentacaoAlterada`, RN-01)
- `src/lib/services/masterProductService.ts` (`updateMasterProduct`, `deactivateMasterProduct`, `reactivateMasterProduct`, `isMasterProductInUse`, `deleteMasterProduct` — órfã, RN-04)
- `src/lib/services/nfImportService.ts` (consumidor via `getMasterProductByCode`, sem filtro `active` — RN-03)
- `src/app/(clinic)/clinic/add-products/page.tsx` (consumidor via `loadMasterProducts`, com filtro `active === true` — RN-03)
- `src/types/masterProduct.ts` (`UpdateMasterProductData.category: MasterProductCategory | null` — RN-06)
- `firestore.rules` (`match /master_products/{productId}`)
- Commit da correção: `2ddebd6` (`fix: terceiro lote de correções de baixa severidade (UC-32, UC-38, UC-41, UC-44)`) — opção "Sem categoria" na UI de edição e correção de `updateMasterProduct` para usar `deleteField()` (RN-06)
- Commit da correção: `199d09b` (`fix(admin): adiciona filtro "Sem categoria" na listagem de produtos master`) — achado adicional do RN-06, confirmado durante validação manual da correção anterior: mesma opção "Sem categoria" agora também no filtro de categoria da listagem
- Commit da correção: `f6e9161` (`fix: tres itens de alta severidade (UC-32, UC-04, UC-39)`) — `handleSubmit` em `admin/products/[id]/page.tsx` passa a calcular `fragmentacaoAlterada` e só reenviar `fragmentavel`/`unidades_por_embalagem` quando esses campos realmente mudam (RN-01)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-01, decisão de produto urgente]** O bloqueio total de edição de produtos em uso (mesmo para campos não relacionados a fragmentação) parece um bug, não uma intenção de produto. Decisão pendente: corrigir `updateMasterProduct` para só disparar `isMasterProductInUse` quando os valores de `fragmentavel`/`unidades_por_embalagem` realmente mudarem em relação ao que já está salvo (comparação de valores, não apenas presença do campo no payload)?~~ **[RESOLVIDO no commit `f6e9161` — UC-32-RN-01]** `handleSubmit` agora compara os valores atuais contra os originais carregados (`fragmentacaoAlterada`) e só envia `fragmentavel`/`unidades_por_embalagem` no payload quando eles realmente mudaram — o serviço só dispara `isMasterProductInUse` nesse caso.
2. **[RN-02]** Ausência de confirmação e de checagem de uso ao ativar/desativar direto na listagem — decisão de produto sobre adicionar `confirm()` (como no UC-29) e/ou um aviso quando o produto estiver em uso.
3. **[RN-03]** Inconsistência confirmada entre UC-10 (não filtra `active`) e UC-11 (filtra `active === true`) — decisão de produto sobre padronizar o comportamento entre os dois fluxos de entrada de estoque.
4. **[RN-04]** `deleteMasterProduct` é código morto — decisão de produto sobre remover a função ou expor algum fluxo de remoção definitiva (com as devidas checagens de uso).
5. **[RN-05]** Mesmo após a correção de RN-01, não há nenhuma checagem específica para alteração de `code` de um produto já em uso, dado o papel do `code` no matching de importação de XML (UC-10) — decisão de produto pendente.
6. ~~**[RN-06]** Falta de opção para limpar a categoria de um produto já categorizado — ajuste de UX menor, prioridade a definir.~~ **[RESOLVIDO no commit `2ddebd6` — UC-32-RN-06]** Opção "Sem categoria" adicionada ao `<Select>` de edição; corrigido também, no mesmo commit, o bug de `updateMasterProduct` que impedia a limpeza real da categoria no Firestore (uso de `deleteField()`).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmado 1 UC (mesmo padrão do UC-22/UC-29), mesclando Editar (tela de detalhe) e Ativar/Desativar (listagem). Achado crítico: o formulário de edição sempre reenvia `fragmentavel`, disparando incondicionalmente a checagem de "produto em uso" e bloqueando a operação inteira, mesmo para campos não relacionados a fragmentação (RN-01). Achados adicionais: toggle de status na listagem sem confirmação e sem checagem de uso (RN-02); efeito inconsistente da flag `active` entre UC-10 (ignorado) e UC-11 (filtrado) (RN-03); `deleteMasterProduct` confirmado como código morto (RN-04); risco futuro de alteração de `code` de produto em uso, caso RN-01 seja corrigido (RN-05); impossibilidade de limpar categoria via UI (RN-06). Segundo UC do módulo "Admin — Catálogo de Produtos Master". |
| 1.0.1 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-32-RN-06): adicionada a opção "Sem categoria" ao `<Select>` de categoria em `admin/products/[id]/page.tsx` (`SelectItem value="none"`, `value={category \|\| 'none'}`, `onValueChange` mapeando `'none'` de volta para string vazia), com o payload de `updateMasterProduct` passando a enviar `category: category \|\| null` — corrigido no commit `2ddebd6`. **Bug adicional descoberto e corrigido no mesmo commit:** `updateMasterProduct` (`masterProductService.ts`) ignorava `category === undefined`, então a categoria nunca era de fato removida no Firestore mesmo com a UI antiga tentando enviar `undefined` para limpeza; corrigido para usar `deleteField()` quando `category === null`, com o tipo `UpdateMasterProductData.category` ampliado para `MasterProductCategory \| null` (`src/types/masterProduct.ts`). Atualizados Pós-condição 4.1, Fluxo Principal (passos 4, 7 e 10), RN-06 (marcado `[Corrigido]`, com o bug adicional documentado como parte do mesmo achado), referências (Seção 13) e item 6 da Seção 14 (marcado `[RESOLVIDO]`). |
| 1.0.2 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual, sub-achado do RN-06: confirmado por leitura de código que o filtro de categoria da tela de **listagem** (`admin/products/page.tsx`) tinha a mesma lacuna original do RN-06 (ausência de opção "Sem categoria"), não coberta pela correção anterior (v1.0.1), que tratou apenas o formulário de edição. Achado nasceu já corrigido, no mesmo padrão, durante validação manual do RN-06 (commit `199d09b`): estado `categoryFilter` ampliado para aceitar `'none'`, novo branch de filtro (`filtered.filter((p) => !p.category)`) e novo `SelectItem value="none"` no `<Select>` da listagem. Atualizados RN-06 (Seção 9, com o achado adicional e sua fonte de confirmação) e Referências (Seção 13, com o commit `199d09b`). |
| 1.0.3 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-32-RN-01): o achado crítico registrado desde a v1.0 — o formulário de edição sempre reenviava `fragmentavel`, disparando incondicionalmente a checagem de "produto em uso" e bloqueando a edição inteira sempre que o produto já estava em uso — foi corrigido no commit `f6e9161`. `handleSubmit` (`admin/products/[id]/page.tsx`) agora calcula `fragmentacaoAlterada` comparando os valores atuais de `fragmentavel`/`unidadesPorEmbalagem` contra os originais carregados em `product`, e só inclui esses campos no payload de `updateMasterProduct` (via spread condicional) quando realmente mudaram. Atualizados resumo do cabeçalho, diagrama (Seção 1), Pós-condição 4.2, Fluxo Principal (passos 3 e 7-10), Fluxo de Exceção 8a, RN-01 (marcado `[CORRIGIDO]`), RN-05 (ajustado para refletir o novo comportamento), RNF-01, Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
