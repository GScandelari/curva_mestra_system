# UC-34: Editar, Publicar/Despublicar e Excluir Documento Legal

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Documentos Legais)
**Versão:** 1.0.2

> Um System Admin edita os dados de um documento legal (`admin/legal-documents/[id]/edit`), incluindo alternar seu `status` entre "Rascunho", "Ativo" e "Inativo" — não existe um botão de "Publicar" separado; publicar/despublicar é apenas escolher o valor de status dentro do mesmo formulário de edição. O System Admin também pode visualizar o documento em modo somente leitura (`admin/legal-documents/[id]`) e excluí-lo permanentemente pela listagem (`admin/legal-documents`, com confirmação), **desde que o documento ainda não tenha sido aceito por nenhum usuário** — a exclusão consulta `user_document_acceptances` antes de qualquer `deleteDoc` e bloqueia a operação, com mensagem explicativa, caso exista ao menos um aceite registrado (RN-03). **Nota histórica:** até o commit `4561a2a`, esta era uma falha crítica confirmada — a exclusão era um hard delete (`deleteDoc`) sem nenhuma verificação prévia de que o documento já havia sido aceito por usuários, diferente do módulo de Catálogo de Produtos Master (UC-32), que ao menos bloqueia (em excesso) a edição de produtos em uso; aqui não havia bloqueio algum, nem para a remoção definitiva. O bug foi corrigido em `4561a2a fix(legal-documents): block deletion of documents with existing acceptances`. **[CORRIGIDO no commit `7c3cbb2` — RN-05]** Editar a versão ou a obrigatoriedade de um documento já ativo agora exige confirmação explícita: um `AlertDialog` avisa o System Admin que usuários que já aceitaram a versão anterior precisarão aceitar novamente, antes de permitir que a gravação de fato ocorra.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])
    Usuarios([👤 Usuários afetados\n(qualquer role/tenant)\nvia UC-09])

    subgraph Sistema["Curva Mestra"]
        UC33(("UC-33\nCadastrar Documento\nLegal"))
        UC34(("UC-34\nEditar/Publicar/Despublicar\ne Excluir Documento Legal"))
    end

    subgraph Bloqueio["Verificação de aceites (RN-03, corrigido em 4561a2a)"]
        Delete(("Excluir\nbloqueado se existir\nuser_document_acceptances"))
    end

    subgraph Confirmacao["Confirmação de impacto (RN-05, corrigido em 7c3cbb2)"]
        Confirm(("Editar versão/obrigatoriedade\nde documento ativo exige\nconfirmação explícita"))
    end

    SystemAdmin --> UC34
    UC33 --> UC34
    UC34 -.->|reabre pendência de\naceite (RN-05)| Usuarios
    UC34 -->|"<<extend>>"| Delete
    UC34 -->|"<<extend>>"| Confirm
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — telas restritas por `ProtectedRoute allowedRoles: ['system_admin']` (`src/app/(admin)/layout.tsx`).

### 2.2 Atores Secundários / Sistemas Externos
- **Usuários do sistema (indiretamente)** — qualquer usuário, de qualquer role/tenant, que já tenha (ou precise) aceitar o documento editado aqui é afetado pelas mudanças de `status`, `version` e flags de obrigatoriedade, através do mecanismo do UC-09 (`TermsInterceptor`/`usePendingTerms`).
- Nenhum sistema externo (Firebase Auth, e-mail) envolvido — mesmo padrão "sem API/Function" já descrito em UC-33.

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`, `active === true`.
- Existe um documento com o id informado em `legal_documents` (para editar, visualizar ou excluir).

---

## 4. Pós-condições

### 4.1 Sucesso — Editar
- `legal_documents/{id}` é atualizado com `title`, `slug` (desde o commit `7c3cbb2`, sempre normalizado via `generateSlug`, ver UC-33 RN-03), `content`, `version`, `status`, `required_for_registration`, `required_for_existing_users`, `order` e `updated_at`; se `status === 'ativo'` no momento do salvamento, `published_at` também é regravado (RN-02).
- **[CORRIGIDO no commit `7c3cbb2` — RN-05]** Se a edição altera a `version` (mantendo `status: 'ativo'`) ou liga `required_for_existing_users` (de `false` para `true`) em um documento que já estava `ativo` antes da edição, a gravação só ocorre após o System Admin confirmar explicitamente um `AlertDialog` de aviso — não há mais gravação silenciosa desse tipo de mudança de alto impacto.
- Sistema exibe toast "Sucesso" / "Documento atualizado com sucesso" e redireciona para `/admin/legal-documents`.
- **Não há nenhuma checagem de quantos usuários já aceitaram este documento antes de permitir a edição** — diferente do padrão de bloqueio (ainda que excessivo) do UC-32 para produtos em uso; o que existe, desde `7c3cbb2`, é um aviso de impacto (RN-05), não uma checagem do número real de aceites.

### 4.1b Sucesso — Excluir
- Antes de qualquer exclusão, o sistema consulta `user_document_acceptances` (`where('document_id', '==', documentId), limit(1)`) para verificar se existe algum registro de aceite referenciando o documento; a exclusão só prossegue se nenhum registro for encontrado (RN-03, corrigido em `4561a2a`).
- `legal_documents/{id}` é permanentemente removido do Firestore (`deleteDoc`).
- Como a exclusão só ocorre quando não há nenhum aceite registrado, este cenário de sucesso nunca deixa registros "órfãos" em `user_document_acceptances` referenciando um `document_id` inexistente (ver Fluxo de Exceção 8e para o cenário em que há aceites e a exclusão é bloqueada).
- Listagem é recarregada; o documento não aparece mais em nenhuma tela (inclusive nas telas de aceite do UC-09).

### 4.2 Falha (Garantias Mínimas)
- Se a validação de client falhar (título/conteúdo/versão vazios): nenhuma alteração é feita.
- **[CORRIGIDO no commit `7c3cbb2` — RN-05]** Se o System Admin cancelar o `AlertDialog` de confirmação de impacto (documento ativo, versão ou obrigatoriedade alterada): nenhuma chamada a `updateDoc` é feita; o documento permanece com os dados anteriores, e o formulário mantém os valores digitados (a edição não é descartada, apenas não é salva).
- Se `updateDoc`/`deleteDoc` falhar (rede, permissão): nenhuma alteração é persistida; o documento permanece com os dados anteriores.
- Se existir ao menos um registro em `user_document_acceptances` referenciando o documento a ser excluído: a exclusão é bloqueada antes de qualquer chamada a `deleteDoc`; nenhuma alteração é feita, o documento permanece intacto na listagem, e o sistema exibe um toast orientando o System Admin a usar "Editar" e definir o status como "Inativo" em vez de excluir (RN-03).

---

## 5. Gatilho (Trigger)
- **Editar:** System Admin clica no ícone de lápis (Edit) na listagem `/admin/legal-documents`, ou no botão "Editar" na tela de visualização `/admin/legal-documents/{id}` — ambos levam a `/admin/legal-documents/{id}/edit`.
- **Visualizar:** System Admin clica no ícone de olho (Eye) na linha de um documento, em `/admin/legal-documents`.
- **Excluir:** System Admin clica no ícone de lixeira (Trash2) na linha de um documento, em `/admin/legal-documents`.

---

## 6. Fluxo Principal (Basic Flow) — Editar

1. System Admin acessa `/admin/legal-documents/{id}/edit` (via listagem ou tela de visualização).
2. `LegalDocumentForm` (modo `edit`) chama `loadDocument()`: `getDoc(doc(db, 'legal_documents', documentId))`; se o documento existir, pré-preenche todos os campos do formulário com os dados atuais (incluindo `id`) e — **desde o commit `7c3cbb2`** — guarda uma cópia desse estado inicial em `originalDocument` (snapshot usado para detectar mudanças de alto impacto, RN-05); se não existir, ver Fluxo de Exceção 8a.
3. System Admin altera os campos desejados (título, slug, versão, status, ordem, conteúdo, switches de obrigatoriedade). Qualquer alteração no campo "Título" recalcula automaticamente o "Slug" via `generateSlug`, mesmo em modo edição, sobrescrevendo qualquer slug customizado manualmente antes (RN-01).
4. System Admin clica em "Salvar Alterações".
5. Sistema valida no client: usuário autenticado; título, conteúdo e versão não vazios (mesmas 3 validações do UC-33).
6. **[CORRIGIDO no commit `7c3cbb2` — RN-05]** Após as validações do passo 5, `handleSave` calcula `impactaUsuariosJaAceitos` — `true` quando `mode === 'edit' && originalDocument?.status === 'ativo'` **e** (a `version` mudou em relação a `originalDocument.version`, **ou** `required_for_existing_users` passou de `false` para `true`). Se `impactaUsuariosJaAceitos === true`, o sistema abre um `AlertDialog` ("Este documento já está ativo" / "Alterar a versão ou tornar este documento obrigatório para usuários existentes fará com que todos os usuários que já aceitaram a versão anterior precisem aceitar novamente no próximo acesso. Deseja continuar?") e **interrompe o fluxo aqui**, aguardando a decisão do admin — ver Fluxo Alternativo 7c. Se `impactaUsuariosJaAceitos === false`, o fluxo segue direto para o passo 7.
7. Sistema monta o payload de atualização, em `performSave()` (nova função extraída de `handleSave` no commit `7c3cbb2`): `title`, `slug` (sempre normalizado via `generateSlug`, `const slugNormalizado = generateSlug(formData.slug || formData.title!)` — herdado da correção do UC-33 RN-03), `content`, `version`, `status`, `required_for_registration`, `required_for_existing_users`, `order`, `updated_at: serverTimestamp()` — e, se `status === 'ativo'`, adiciona `published_at: serverTimestamp()` (RN-02 — regrava mesmo se o documento já estava ativo e nada relacionado à publicação mudou).
8. Sistema executa `updateDoc(doc(db, 'legal_documents', documentId), updateData)` — sem nenhuma checagem de quantos usuários já aceitaram este documento (permanece uma lacuna, mesmo após RN-05: o aviso é qualitativo, não quantitativo).
9. A regra de segurança de `legal_documents` (`allow update`, corrigida no mesmo commit `7c3cbb2` para UC-33 RN-03) revalida no servidor o formato de `slug`/`title`/`version`/`status` quando presentes no payload — transparente no caminho feliz.
10. Sistema exibe toast "Sucesso" / "Documento atualizado com sucesso" e redireciona para `/admin/legal-documents`.
11. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Visualizar documento antes de editar
1. System Admin clica no ícone de olho (Eye) na listagem `/admin/legal-documents` — acessa `/admin/legal-documents/{id}`.
2. Sistema busca o documento via `getDoc` e exibe, em modo somente leitura: título, badge de status, "Versão {version} • {slug}", ordem, badges de obrigatoriedade (se aplicável) e o conteúdo renderizado como Markdown (via `ReactMarkdown`, em um bloco de preview estilizado) — nenhum campo é editável nesta tela.
3. System Admin clica em "Editar" — navega para `/admin/legal-documents/{id}/edit`, retomando o Fluxo Principal a partir do passo 2.

### 7b. Excluir documento diretamente da listagem
1. Na tela `/admin/legal-documents`, System Admin clica no ícone de lixeira (Trash2, vermelho) na linha de um documento.
2. Sistema abre um `AlertDialog`: "Confirmar exclusão" / "Tem certeza que deseja excluir o documento {título}? Esta ação não pode ser desfeita."
3. System Admin confirma clicando em "Excluir" (ou clica em "Cancelar", encerrando o fluxo sem nenhuma alteração).
4. Sistema consulta `user_document_acceptances` (`where('document_id', '==', documentId), limit(1)`) para verificar se existe algum registro de aceite referenciando este documento (RN-03, corrigido em `4561a2a`).
5. Como não existe nenhum registro de aceite (cenário deste fluxo), sistema executa `deleteDoc(doc(db, 'legal_documents', documentId))` — hard delete definitivo. Ver Fluxo de Exceção 8e para o cenário em que a consulta encontra ao menos um aceite (exclusão bloqueada).
6. Sistema exibe toast "Sucesso" / "Documento excluído com sucesso" e recarrega a listagem (`loadDocuments`) — o documento não aparece mais.
7. Caso de uso é concluído com sucesso.

### 7c. [Novo, corrigido no commit `7c3cbb2`] Confirmar edição de alto impacto em documento já ativo
1. A partir do passo 6 do Fluxo Principal, `impactaUsuariosJaAceitos === true` (documento estava `ativo` e a edição muda `version` e/ou liga `required_for_existing_users`).
2. Sistema abre o `AlertDialog` "Este documento já está ativo", com o aviso sobre a necessidade de reaceite pelos usuários que já haviam aceitado a versão anterior, e dois botões: "Cancelar" e "Continuar e salvar".
3a. System Admin clica em "Cancelar" (ou fecha o diálogo) — nenhuma chamada a `updateDoc` é feita; o formulário permanece na tela, com os valores editados intactos (não há perda dos dados digitados); o caso de uso é encerrado sem gravação.
3b. System Admin clica em "Continuar e salvar" — o `AlertDialogAction` chama `performSave()` diretamente, retomando o Fluxo Principal a partir do passo 7.

---

## 8. Fluxos de Exceção

### 8a. Documento não encontrado (editar ou visualizar)
1. `getDoc` não encontra documento com o id informado (ex.: id inválido na URL, ou documento já excluído por outro admin em outra sessão).
2. Na tela de edição, sistema exibe toast "Documento não encontrado" e redireciona para `/admin/legal-documents`. Na tela de visualização, sistema exibe o mesmo toast e simplesmente não renderiza nenhum conteúdo (retorna `null`) após o redirect.

### 8b. Validação client-side falha ao editar
1. Título, conteúdo ou versão vazios (ou só espaços) ao clicar em "Salvar Alterações".
2. Sistema exibe o toast correspondente ("O título é obrigatório" / "O conteúdo é obrigatório" / "A versão é obrigatória" — mesmas mensagens do UC-33); nenhuma chamada ao Firestore é feita. Esta validação ocorre **antes** da checagem de `impactaUsuariosJaAceitos` (RN-05) — um formulário inválido não chega a abrir o diálogo de confirmação de impacto.

### 8c. Falha ao salvar edição
1. `updateDoc` falha (rede, permissão negada por token expirado, formato rejeitado pela regra de segurança desde `7c3cbb2` — UC-33 RN-03 —, etc.).
2. Sistema exibe toast "Erro ao salvar" com a mensagem crua do erro (`error.message`); nenhuma alteração é persistida. Se o erro ocorrer após a confirmação do `AlertDialog` de impacto (Fluxo Alternativo 7c), o diálogo já foi fechado (`finally` em `performSave`) antes do toast de erro ser exibido.

### 8d. Falha ao consultar aceites ou ao excluir
1. A consulta a `user_document_acceptances` (passo 4 do Fluxo Alternativo 7b) ou o `deleteDoc` subsequente falham (rede, permissão).
2. Sistema exibe toast "Erro ao excluir" com a mensagem crua do erro (`error.message`); o documento permanece na listagem, inalterado.

### 8e. [Corrigido em `4561a2a`] Exclusão bloqueada por existência de aceites registrados
1. A partir do passo 4 do Fluxo Alternativo 7b, a consulta a `user_document_acceptances` encontra ao menos um registro referenciando o `document_id` do documento a ser excluído.
2. Sistema exibe toast destructive: "Não é possível excluir" / "Este documento já foi aceito por usuários e não pode ser excluído. Use \"Editar\" e defina o status como \"Inativo\" em vez de excluir."
3. Nenhuma chamada a `deleteDoc` é feita; o documento permanece intacto na listagem; o `AlertDialog` é fechado (`setDeleteDialogOpen(false)`, `setDocumentToDelete(null)`).
4. Caso de uso é encerrado sem exclusão. **Nota histórica:** antes da correção em `4561a2a`, este cenário não existia — a exclusão ocorria sempre, sem nenhuma checagem prévia (ver nota histórica em RN-03).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Achado]** Alterar o campo "Título" em modo edição sempre recalcula o "Slug" automaticamente (mesmo `handleTitleChange` usado na criação), sobrescrevendo qualquer slug customizado manualmente antes — não existe um mecanismo para "travar" o slug após a primeira definição. Como `slug` não é usado como chave por nenhuma consulta hoje (UC-33, RN-01), o impacto atual fica limitado à exibição na listagem/visualização. **Nota:** a correção do commit `7c3cbb2` (UC-33 RN-03) passou a normalizar o slug sempre via `generateSlug()` também no momento de salvar em modo edição — reforça este comportamento (qualquer slug customizado manualmente é normalizado, e se o título mudar, sobrescrito), mas não altera a conclusão deste achado. | Confirmado por leitura de `handleTitleChange` em `LegalDocumentForm.tsx` — chamado tanto em modo `create` quanto `edit`, sem distinção de comportamento; e do diff do commit `7c3cbb2`, que introduziu `slugNormalizado` em `performSave` sem alterar `handleTitleChange`. |
| RN-02 | **[Achado]** O campo `published_at` é sobrescrito com `serverTimestamp()` em toda submissão do formulário de edição em que `status` permanece (ou passa a ser) `'ativo'` — não apenas na transição de outro status para `'ativo'`. Ou seja, `published_at` não reflete a data da primeira publicação, e sim a data do último salvamento com status ativo, mesmo que a edição não tenha alterado nada relacionado à publicação (ex.: apenas corrigiu a "Ordem de Exibição"). Este campo, além disso, não é lido por nenhuma outra tela do sistema (confirmado por busca no código) — é gravado, mas nunca consumido. | Confirmado por leitura de `performSave`, modo `edit`: `if (formData.status === 'ativo') updateData.published_at = serverTimestamp();`, sem checar o valor anterior de `status`. Busca por `published_at` no código não retorna nenhum consumidor além dos dois pontos de escrita. |
| RN-03 | **[Corrigido em `4561a2a`]** A exclusão de um documento (`deleteDoc`, na listagem) agora consulta previamente `user_document_acceptances` (`where('document_id', '==', documentId), limit(1)`) para verificar se existe algum registro de aceite referenciando aquele `document_id`. Se existir ao menos um aceite, a exclusão é bloqueada antes de qualquer chamada a `deleteDoc`, e o sistema exibe o toast "Não é possível excluir" / "Este documento já foi aceito por usuários e não pode ser excluído. Use \"Editar\" e defina o status como \"Inativo\" em vez de excluir." Apenas documentos sem nenhum registro de aceite podem ser definitivamente removidos (hard delete). **Nota histórica:** até esta correção, esta era uma falha crítica confirmada — a exclusão ocorria sempre, sem nenhuma verificação prévia de `status` ou de `user_document_acceptances`, deixando o histórico de aceites (imutável por regra — `allow update, delete: if false`, já documentado em UC-09 RN-05) "órfão": os registros de auditoria continuavam existindo, mas o conteúdo real do documento aceito (`title`, `content`) deixava de existir em `legal_documents`. | Confirmado por leitura completa de `handleDelete` em `admin/legal-documents/page.tsx` — bloqueio implementado antes de `deleteDoc`, no commit `4561a2a fix(legal-documents): block deletion of documents with existing acceptances`. |
| RN-04 | **[Achado comparativo]** Antes da correção do RN-03 (`4561a2a`), esta era a única tela do sistema que expunha um botão de exclusão definitiva de um registro já referenciado por uma coleção de auditoria imutável, sem nenhuma checagem de dependência — inclusive mais permissiva que o próprio `deleteMasterProduct` do catálogo de produtos (UC-32, RN-04). Após a correção, o comportamento passou a ser mais protetivo que o do UC-32 nesse aspecto específico: aqui a exclusão é ativamente bloqueada (com mensagem explicativa orientando o uso de "Inativo") quando há dependência real, enquanto em UC-32 o `deleteMasterProduct` permanece órfão no código (nenhum botão do sistema o chama), portanto nunca exercitado em produção. | Comparação direta com o achado já documentado em UC-32 (RN-04), revisitada após a correção confirmada por leitura de `handleDelete`. |
| RN-05 | **[CORRIGIDO no commit `7c3cbb2`]** Antes: editar um documento e alterar sua "Versão" enquanto `status` permanece `'ativo'` e algum switch de obrigatoriedade estava ligado tinha, do ponto de vista do UC-09, o mesmo efeito de publicar uma nova versão de um termo já aceito — reabrindo a pendência de aceite para os usuários que já haviam aceitado a versão anterior (critério de RN-01 do UC-09: `document_version` diferente) — sem que a tela exibisse qualquer aviso sobre esse efeito, nem sobre os bugs de loop de redirecionamento então documentados no UC-09 (RN-02/RN-03 daquele UC, Fluxos de Exceção 8a/8b), que podiam ser disparados exatamente por esse tipo de edição. Agora: `LegalDocumentForm.tsx` guarda um snapshot do documento carregado (`originalDocument`, definido em `loadDocument`) e, em `handleSave`, calcula `impactaUsuariosJaAceitos = mode === 'edit' && originalDocument?.status === 'ativo' && (originalDocument.version !== formData.version \|\| (originalDocument.required_for_existing_users === false && formData.required_for_existing_users === true))`. Se `true`, a gravação é interrompida e um `AlertDialog` de confirmação (`confirmImpactOpen`) é aberto, avisando explicitamente que usuários que já aceitaram a versão anterior precisarão aceitar novamente; a gravação real só ocorre se o admin confirmar ("Continuar e salvar", que chama `performSave()` diretamente). Se não há impacto detectado, `handleSave` chama `performSave()` direto, sem diálogo — nenhuma fricção adicional para edições que não tocam versão/obrigatoriedade de um documento ativo. **Escopo da correção:** o critério cobre apenas a transição de `required_for_existing_users` de `false` para `true` (não cobre `required_for_registration`, nem uma mudança de `status` de `'ativo'` para outro valor, nem desligar `required_for_existing_users`) — ver Perguntas em Aberto, item 2, para a discussão sobre esse escopo. | Confirmado por leitura do diff do commit `7c3cbb2` em `LegalDocumentForm.tsx` — novos estados `originalDocument`/`confirmImpactOpen`, `handleSave` dividido em validações + cálculo de `impactaUsuariosJaAceitos` + `performSave()` extraída, e o `AlertDialog` renderizado ao final do componente. |
| RN-06 | Assim como no UC-33, toda a validação de formato e a autorização desta operação (editar e excluir) dependem inteiramente do client (`LegalDocumentForm`, `admin/legal-documents/page.tsx`) e da regra de segurança do Firestore — desde o commit `7c3cbb2` (herdado de UC-33, RN-03), `allow update` de `legal_documents` também revalida no servidor o formato de `slug`/`title`/`version`/`status` quando presentes no payload, mas `content`, `order` e as flags de obrigatoriedade continuam sem qualquer validação server-side. Não há rota `/api/legal-documents/*` nem Cloud Function. A verificação de aceites do RN-03 também é feita inteiramente no client, antes do `deleteDoc`, e não é reforçada por nenhuma regra do Firestore que impeça a exclusão a nível de banco. A confirmação de impacto do RN-05 é, da mesma forma, uma checagem exclusivamente de UI — não há nenhuma regra do Firestore que exija confirmação ou bloqueie a gravação de uma mudança de versão/obrigatoriedade em documento ativo. | Confirmado por leitura completa dos arquivos envolvidos e do diff do commit `7c3cbb2` em `firestore.rules` — nenhuma chamada a Admin SDK ou API route; as checagens dos RN-03 e RN-05 são apenas client-side, antes das chamadas de escrita. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Resolvido em `4561a2a`]** RN-03 representava um risco de compliance relevante: dado que todo o sistema de documentos legais existe para produzir uma trilha de auditoria de aceite de termos (UC-09), a possibilidade de excluir permanentemente o conteúdo de um documento já aceito comprometia o valor probatório do histórico registrado em `user_document_acceptances`. A correção elimina esse risco ao bloquear a exclusão sempre que existir ao menos um aceite registrado, preservando a integridade da trilha de auditoria. | Confiabilidade / Compliance |
| RNF-02 | **[Mitigado no commit `7c3cbb2`]** Ausência de confirmação ou aviso adicional ao alterar `status`/`version` de um documento ativo e obrigatório já aceito por usuários (RN-05) — divergente do nível de cautela esperado dado o efeito colateral (reabertura de pendência, ou até o loop de redirecionamento já documentado em UC-09) — foi corrigida com a introdução do `AlertDialog` de confirmação de impacto. Permanece uma lacuna residual quanto ao escopo do critério (ver RN-05, "Escopo da correção", e item 2 da Seção 14). | Usabilidade / Confiabilidade |
| RNF-03 | Mensagens de erro do Firestore exibidas cruas (`error.message`), sem tradução — mesmo padrão já registrado em UC-09 (RNF-03) e UC-31/32. | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — edição ocorre quando um termo precisa de correção ou nova versão; exclusão é esperada ser rara e agora é tecnicamente restrita a documentos ainda não aceitos por nenhum usuário (RN-03).

---

## 12. Casos de Uso Relacionados
- **UC-33 (Cadastrar Documento Legal)** — pré-condição; ciclo de vida do documento criado ali continua neste UC. A correção de validação server-side (slug/title/version/status, UC-33 RN-03) e a normalização de slug via `generateSlug` também se aplicam à edição feita aqui, pois `LegalDocumentForm.tsx` é compartilhado entre os dois modos (`create`/`edit`).
- **UC-09 (Aceitar Termos Legais)** — consumidor direto dos documentos geridos aqui; RN-05 deste UC intersecta diretamente com os bugs RN-02/RN-03 já documentados em UC-09 (loop de redirecionamento ao editar versão/obrigatoriedade de um documento já aceito) — o `AlertDialog` introduzido no commit `7c3cbb2` avisa sobre esse efeito, mas não impede que ele ocorra quando o admin confirma.
- **UC-32 (Editar, Ativar e Desativar Produto no Catálogo Master)** — mesmo padrão de módulo Admin sem API route/validação server-side completa (RN-06), porém achados historicamente opostos: lá o bloqueio de edição era excessivo quando o produto estava em uso (UC-32, RN-01, corrigido); aqui, após a correção do RN-03 (`4561a2a`), o bloqueio de exclusão passou a ser mais preciso — ocorre apenas quando existem aceites reais registrados, permitindo exclusão livre de documentos nunca aceitos. Desde o commit `7c3cbb2`, os dois UCs também convergiram no uso de `AlertDialog` para confirmações de alto impacto (RN-05 aqui, RN-02 em UC-32).

---

## 13. Referências
- `src/app/(admin)/admin/legal-documents/page.tsx` (listagem, exclusão — `handleDelete`, incluindo a verificação de `user_document_acceptances` corrigida em `4561a2a`)
- `src/app/(admin)/admin/legal-documents/[id]/page.tsx` (visualização)
- `src/app/(admin)/admin/legal-documents/[id]/edit/page.tsx` (wrapper de edição)
- `src/components/admin/LegalDocumentForm.tsx` (`handleSave`/`performSave` modo `edit`, `handleTitleChange`, `originalDocument`, `confirmImpactOpen` — RN-05)
- `src/types/index.ts` (`LegalDocument`, `DocumentStatus`, `UserDocumentAcceptance`)
- `firestore.rules` (`match /legal_documents/{documentId}`, `match /user_document_acceptances/{acceptanceId}`)
- `src/hooks/usePendingTerms.ts`, `src/components/auth/TermsInterceptor.tsx` (consumidores afetados por RN-05)
- Commit da correção: `7c3cbb2` (`fix: seis itens de media severidade (UC-31, UC-32, UC-33, UC-34)`) — `AlertDialog` de confirmação de impacto ao editar versão/obrigatoriedade de documento ativo (RN-05, `LegalDocumentForm.tsx`); validação de formato server-side e normalização de slug herdadas de UC-33 (RN-06)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-03 — RESOLVIDO em `4561a2a`]** Decisão de produto adotada: opção (a) — bloquear a exclusão quando houver qualquer registro em `user_document_acceptances` referenciando o documento, exibindo mensagem orientando o System Admin a usar "Editar" e definir o status como "Inativo" em vez de excluir. Corrigido no commit `4561a2a fix(legal-documents): block deletion of documents with existing acceptances`.
2. ~~**[RN-05]** Falta de aviso ao editar versão/obrigatoriedade de um documento já ativo e potencialmente já aceito — decisão de produto sobre adicionar confirmação/aviso explícito nesta tela.~~ **[RESOLVIDO no commit `7c3cbb2` — UC-34-RN-05]** Decisão de produto adotada: `AlertDialog` de confirmação explícita quando a edição altera `version` ou liga `required_for_existing_users` em um documento já `ativo`. Decisão residual pendente: o critério atual não cobre mudança em `required_for_registration`, nem transição de `status` de `'ativo'` para outro valor (despublicar), nem desligar `required_for_existing_users` — avaliar se esses cenários também merecem aviso.
3. **[RN-02]** `published_at` nunca é lido por nenhuma tela do sistema — decisão de produto sobre se o campo deveria refletir a data da primeira publicação (não sobrescrever a cada save enquanto `status` permanece `'ativo'`), ou se pode ser removido do schema.
4. **[RN-01]** Slug sempre recalculado ao editar o título, mesmo quando foi customizado manualmente antes — decisão de UX pendente. Reforçado pela correção do commit `7c3cbb2` (UC-33 RN-03), que normaliza o slug via `generateSlug` também ao salvar em modo edição.
5. ~~**[RN-06]** Mesma decisão já registrada em UC-33/UC-31 sobre introduzir validação server-side (rota `/api/legal-documents/*` com Admin SDK) para este módulo.~~ **[RESOLVIDO PARCIALMENTE no commit `7c3cbb2` — herdado de UC-33 RN-03]** A regra do Firestore (`legal_documents`) agora valida `slug`, `title`, `version` e `status` no servidor, em `create` e `update` (esta última usada pela edição deste UC). Decisão residual pendente: `content`, `order` e as flags de obrigatoriedade continuam sem validação server-side, e não existe rota `/api/legal-documents/*` dedicada.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmado 1 UC agrupando Editar (incluindo alterar status = publicar/despublicar), Visualizar (somente leitura) e Excluir (hard delete, na listagem), seguindo o mesmo padrão de agrupamento do UC-29/UC-32. Achado crítico: exclusão de documento legal é permanente e não verifica a existência de registros em `user_document_acceptances` antes de apagar (RN-03) — diferente do UC-32, que ao menos bloqueia (em excesso) a edição de produtos em uso, aqui não há bloqueio algum, nem para a remoção definitiva. Achados adicionais: `published_at` sobrescrito a cada salvamento com status ativo e nunca lido por nenhuma tela (RN-02); slug sempre recalculado ao editar título, mesmo customizado (RN-01); ausência de aviso ao reabrir pendência de aceite via alteração de versão em documento já aceito (RN-05, com ligação direta aos bugs já documentados em UC-09). Segundo UC do módulo "Admin — Documentos Legais". |
| 1.0.1 | 16/07/2026 | Guilherme Scandelari | Correção de bug confirmada: RN-03 deixou de ser um bug e passou a descrever o comportamento correto atual (exclusão bloqueada com mensagem explicativa quando existem aceites registrados em `user_document_acceptances`), preservando nota histórica do bug original — corrigido no commit `4561a2a fix(legal-documents): block deletion of documents with existing acceptances`. Ajustados: introdução, diagrama (seção 1), pós-condições 4.1b/4.2, Fluxo Alternativo 7b (passo de exclusão), novo Fluxo de Exceção 8e (bloqueio por aceites existentes) e 8d renomeado, RN-04, RNF-01, seção 11 e seção 12 (comparativo com UC-32). Item 1 da seção 14 marcado como resolvido. |
| 1.0.2 | 26/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-34-RN-05): editar a `version` ou ligar `required_for_existing_users` em um documento já `ativo` agora exige confirmação explícita via `AlertDialog` — `LegalDocumentForm.tsx` ganhou os estados `originalDocument` (snapshot do documento carregado) e `confirmImpactOpen`; `handleSave` foi dividido, com a lógica de gravação extraída para `performSave()`, e passou a calcular `impactaUsuariosJaAceitos` antes de decidir entre abrir o diálogo de confirmação ou salvar direto. Corrigido no commit `7c3cbb2`. Registrado o escopo limitado da correção (não cobre `required_for_registration`, despublicação, nem desligar `required_for_existing_users`). Também incorporada, por herança de `LegalDocumentForm.tsx` ser compartilhado com UC-33, a normalização de slug e a validação de formato server-side da correção de UC-33-RN-03 (novo passo 9 do Fluxo Principal, RN-06). Atualizados resumo do cabeçalho, diagrama (Seção 1, novo subgrafo "Confirmação de impacto"), Pós-condições 4.1/4.2, Fluxo Principal (novos passos 6-9, renumeração), novo Fluxo Alternativo 7c, Fluxo de Exceção 8b/8c (notas sobre a nova checagem), RN-05 (marcado `[CORRIGIDO]`, com escopo documentado), RN-01/RN-06 (notas sobre a correção herdada), RNF-02 (marcado `[Mitigado]`), Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e itens 2 e 5 da Seção 14 (marcados `[RESOLVIDO]`/`[RESOLVIDO PARCIALMENTE]`). |
