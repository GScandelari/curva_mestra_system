# UC-34: Editar, Publicar/Despublicar e Excluir Documento Legal

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Documentos Legais)
**Versão:** 1.0

> Um System Admin edita os dados de um documento legal (`admin/legal-documents/[id]/edit`), incluindo alternar seu `status` entre "Rascunho", "Ativo" e "Inativo" — não existe um botão de "Publicar" separado; publicar/despublicar é apenas escolher o valor de status dentro do mesmo formulário de edição. O System Admin também pode visualizar o documento em modo somente leitura (`admin/legal-documents/[id]`) e excluí-lo permanentemente pela listagem (`admin/legal-documents`, com confirmação). **Achado crítico confirmado:** a exclusão é um hard delete (`deleteDoc`) sem nenhuma verificação prévia de que o documento já foi aceito por usuários (`user_document_acceptances`) — diferente do módulo de Catálogo de Produtos Master (UC-32), que ao menos bloqueia (em excesso) a edição de produtos em uso, aqui não existe bloqueio algum, nem para a remoção definitiva.

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

    subgraph Risco["⚠️ Achado crítico"]
        Delete(("Excluir (hard delete)\nsem checar\nuser_document_acceptances"))
    end

    SystemAdmin --> UC34
    UC33 --> UC34
    UC34 -.->|reabre pendência de\naceite (RN-05)| Usuarios
    UC34 -->|"<<extend>>"| Delete
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
- `legal_documents/{id}` é atualizado com `title`, `slug`, `content`, `version`, `status`, `required_for_registration`, `required_for_existing_users`, `order` e `updated_at`; se `status === 'ativo'` no momento do salvamento, `published_at` também é regravado (RN-02).
- Sistema exibe toast "Sucesso" / "Documento atualizado com sucesso" e redireciona para `/admin/legal-documents`.
- **Não há nenhuma checagem de quantos usuários já aceitaram este documento antes de permitir a edição** — diferente do padrão de bloqueio (ainda que excessivo) do UC-32 para produtos em uso.

### 4.1b Sucesso — Excluir
- `legal_documents/{id}` é permanentemente removido do Firestore (`deleteDoc`).
- Registros pré-existentes em `user_document_acceptances` que referenciam esse `document_id` **não são alterados nem removidos** (são imutáveis por regra — `allow update, delete: if false`, já documentado em UC-09 RN-05) — porém passam a apontar para um documento inexistente (RN-03, achado crítico).
- Listagem é recarregada; o documento não aparece mais em nenhuma tela (inclusive nas telas de aceite do UC-09).

### 4.2 Falha (Garantias Mínimas)
- Se a validação de client falhar (título/conteúdo/versão vazios): nenhuma alteração é feita.
- Se `updateDoc`/`deleteDoc` falhar (rede, permissão): nenhuma alteração é persistida; o documento permanece com os dados anteriores.

---

## 5. Gatilho (Trigger)
- **Editar:** System Admin clica no ícone de lápis (Edit) na listagem `/admin/legal-documents`, ou no botão "Editar" na tela de visualização `/admin/legal-documents/{id}` — ambos levam a `/admin/legal-documents/{id}/edit`.
- **Visualizar:** System Admin clica no ícone de olho (Eye) na linha de um documento, em `/admin/legal-documents`.
- **Excluir:** System Admin clica no ícone de lixeira (Trash2) na linha de um documento, em `/admin/legal-documents`.

---

## 6. Fluxo Principal (Basic Flow) — Editar

1. System Admin acessa `/admin/legal-documents/{id}/edit` (via listagem ou tela de visualização).
2. `LegalDocumentForm` (modo `edit`) chama `loadDocument()`: `getDoc(doc(db, 'legal_documents', documentId))`; se o documento existir, pré-preenche todos os campos do formulário com os dados atuais (incluindo `id`); se não existir, ver Fluxo de Exceção 8a.
3. System Admin altera os campos desejados (título, slug, versão, status, ordem, conteúdo, switches de obrigatoriedade). Qualquer alteração no campo "Título" recalcula automaticamente o "Slug" via `generateSlug`, mesmo em modo edição, sobrescrevendo qualquer slug customizado manualmente antes (RN-01).
4. System Admin clica em "Salvar Alterações".
5. Sistema valida no client: usuário autenticado; título, conteúdo e versão não vazios (mesmas 3 validações do UC-33).
6. Sistema monta o payload de atualização: `title`, `slug` (`formData.slug || generateSlug(title)`), `content`, `version`, `status`, `required_for_registration`, `required_for_existing_users`, `order`, `updated_at: serverTimestamp()` — e, se `status === 'ativo'`, adiciona `published_at: serverTimestamp()` (RN-02 — regrava mesmo se o documento já estava ativo e nada relacionado à publicação mudou).
7. Sistema executa `updateDoc(doc(db, 'legal_documents', documentId), updateData)` — sem nenhuma checagem de quantos usuários já aceitaram este documento, nem confirmação adicional, mesmo quando a alteração implica reabertura de pendência de aceite (ex.: mudar `version` mantendo `status: 'ativo'` e algum switch de obrigatoriedade ligado — RN-05).
8. Sistema exibe toast "Sucesso" / "Documento atualizado com sucesso" e redireciona para `/admin/legal-documents`.
9. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Visualizar documento antes de editar
1. System Admin clica no ícone de olho (Eye) na listagem `/admin/legal-documents` — acessa `/admin/legal-documents/{id}`.
2. Sistema busca o documento via `getDoc` e exibe, em modo somente leitura: título, badge de status, "Versão {version} • {slug}", ordem, badges de obrigatoriedade (se aplicável) e o conteúdo renderizado como Markdown (via `ReactMarkdown`, em um bloco de preview estilizado) — nenhum campo é editável nesta tela.
3. System Admin clica em "Editar" — navega para `/admin/legal-documents/{id}/edit`, retomando o Fluxo Principal a partir do passo 2.

### 7b. Excluir documento (hard delete) diretamente da listagem
1. Na tela `/admin/legal-documents`, System Admin clica no ícone de lixeira (Trash2, vermelho) na linha de um documento.
2. Sistema abre um `AlertDialog`: "Confirmar exclusão" / "Tem certeza que deseja excluir o documento {título}? Esta ação não pode ser desfeita."
3. System Admin confirma clicando em "Excluir" (ou clica em "Cancelar", encerrando o fluxo sem nenhuma alteração).
4. Sistema executa `deleteDoc(doc(db, 'legal_documents', documentId))` — hard delete, **sem nenhuma checagem prévia** de: (a) o `status` do documento (mesmo um documento "Ativo" e marcado como obrigatório pode ser excluído com um clique), ou (b) a existência de registros em `user_document_acceptances` referenciando esse `document_id` (RN-03 — achado crítico).
5. Sistema exibe toast "Sucesso" / "Documento excluído com sucesso" e recarrega a listagem (`loadDocuments`) — o documento não aparece mais.
6. Caso de uso é concluído com sucesso do ponto de vista da operação; ver RN-03 para as consequências não tratadas sobre o histórico de aceites já registrado.

---

## 8. Fluxos de Exceção

### 8a. Documento não encontrado (editar ou visualizar)
1. `getDoc` não encontra documento com o id informado (ex.: id inválido na URL, ou documento já excluído por outro admin em outra sessão).
2. Na tela de edição, sistema exibe toast "Documento não encontrado" e redireciona para `/admin/legal-documents`. Na tela de visualização, sistema exibe o mesmo toast e simplesmente não renderiza nenhum conteúdo (retorna `null`) após o redirect.

### 8b. Validação client-side falha ao editar
1. Título, conteúdo ou versão vazios (ou só espaços) ao clicar em "Salvar Alterações".
2. Sistema exibe o toast correspondente ("O título é obrigatório" / "O conteúdo é obrigatório" / "A versão é obrigatória" — mesmas mensagens do UC-33); nenhuma chamada ao Firestore é feita.

### 8c. Falha ao salvar edição
1. `updateDoc` falha (rede, permissão negada por token expirado, etc.).
2. Sistema exibe toast "Erro ao salvar" com a mensagem crua do erro (`error.message`); nenhuma alteração é persistida.

### 8d. Falha ao excluir
1. `deleteDoc` falha (rede, permissão).
2. Sistema exibe toast "Erro ao excluir" com a mensagem crua do erro (`error.message`); o documento permanece na listagem, inalterado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Achado]** Alterar o campo "Título" em modo edição sempre recalcula o "Slug" automaticamente (mesmo `handleTitleChange` usado na criação), sobrescrevendo qualquer slug customizado manualmente antes — não existe um mecanismo para "travar" o slug após a primeira definição. Como `slug` não é usado como chave por nenhuma consulta hoje (UC-33, RN-01), o impacto atual fica limitado à exibição na listagem/visualização. | Confirmado por leitura de `handleTitleChange` em `LegalDocumentForm.tsx` — chamado tanto em modo `create` quanto `edit`, sem distinção de comportamento. |
| RN-02 | **[Achado]** O campo `published_at` é sobrescrito com `serverTimestamp()` em toda submissão do formulário de edição em que `status` permanece (ou passa a ser) `'ativo'` — não apenas na transição de outro status para `'ativo'`. Ou seja, `published_at` não reflete a data da primeira publicação, e sim a data do último salvamento com status ativo, mesmo que a edição não tenha alterado nada relacionado à publicação (ex.: apenas corrigiu a "Ordem de Exibição"). Este campo, além disso, não é lido por nenhuma outra tela do sistema (confirmado por busca no código) — é gravado, mas nunca consumido. | Confirmado por leitura de `handleSave`, modo `edit`: `if (formData.status === 'ativo') updateData.published_at = serverTimestamp();`, sem checar o valor anterior de `status`. Busca por `published_at` no código não retorna nenhum consumidor além dos dois pontos de escrita. |
| RN-03 | **[Achado crítico]** A exclusão de um documento (`deleteDoc`, na listagem) é permanente (hard delete) e não faz nenhuma verificação prévia de (a) se o documento está com `status: 'ativo'` e algum switch de obrigatoriedade ligado, ou (b) se existem registros em `user_document_acceptances` referenciando aquele `document_id`. Como esses registros de aceite são imutáveis por regra do Firestore (`allow update, delete: if false` — já documentado em UC-09, RN-05) e nunca são removidos em cascata, a exclusão de um documento legal deixa para trás um histórico de aceites "órfão": os registros de auditoria continuam existindo (quem aceitou, quando, qual versão), mas o conteúdo real do documento aceito (`title`, `content`) deixa de existir em `legal_documents`, tornando impossível reconstruir o que exatamente foi aceito, caso seja necessário para fins de compliance/jurídicos. | Confirmado por leitura completa de `handleDelete` em `admin/legal-documents/page.tsx` — chamada direta a `deleteDoc`, sem nenhuma consulta prévia a `user_document_acceptances` nem checagem de `status`. |
| RN-04 | **[Achado comparativo]** Entre os módulos administrativos documentados até agora, esta é a única tela que expõe um botão de exclusão definitiva de um registro já referenciado por uma coleção de auditoria imutável, sem nenhuma checagem de dependência — inclusive mais permissiva que o próprio `deleteMasterProduct` do catálogo de produtos (UC-32, RN-04), que ao menos está órfão (nenhum botão do sistema o chama). | Comparação direta com o achado já documentado em UC-32 (RN-04) para `deleteMasterProduct`. |
| RN-05 | Editar um documento e alterar sua "Versão" enquanto `status` permanece `'ativo'` e algum switch de obrigatoriedade está ligado tem, do ponto de vista do UC-09, o mesmo efeito de publicar uma nova versão de um termo já aceito — reabrindo a pendência de aceite para os usuários que já haviam aceitado a versão anterior (critério de RN-01 do UC-09: `document_version` diferente). Esta tela não exibe nenhum aviso sobre esse efeito, nem sobre os bugs de loop de redirecionamento já documentados no UC-09 (RN-02/RN-03 daquele UC, Fluxos de Exceção 8a/8b), que são disparados exatamente por esse tipo de edição. | Consequência lógica confirmada pela combinação do critério de pendência de `usePendingTerms` (comparação de `document_version`, UC-09 RN-01) com a ausência de qualquer aviso ou checagem nesta tela de edição. |
| RN-06 | Assim como no UC-33, toda a validação de formato e a autorização desta operação (editar e excluir) dependem inteiramente do client (`LegalDocumentForm`, `admin/legal-documents/page.tsx`) e da regra `allow write: if isSystemAdmin()` do Firestore — não há rota `/api/legal-documents/*` nem Cloud Function revalidando dados ou aplicando regras adicionais. | Confirmado por leitura completa dos arquivos envolvidos — nenhuma chamada a Admin SDK ou API route. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | RN-03 é um risco de compliance relevante: dado que todo o sistema de documentos legais existe para produzir uma trilha de auditoria de aceite de termos (UC-09), a possibilidade de excluir permanentemente o conteúdo de um documento já aceito compromete o valor probatório do histórico registrado em `user_document_acceptances`. | Confiabilidade / Compliance |
| RNF-02 | Ausência de confirmação ou aviso adicional ao alterar `status`/`version` de um documento ativo e obrigatório já aceito por usuários (RN-05) — divergente do nível de cautela esperado dado o efeito colateral (reabertura de pendência, ou até o loop de redirecionamento já documentado em UC-09). | Usabilidade / Confiabilidade |
| RNF-03 | Mensagens de erro do Firestore exibidas cruas (`error.message`), sem tradução — mesmo padrão já registrado em UC-09 (RNF-03) e UC-31/32. | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — edição ocorre quando um termo precisa de correção ou nova versão; exclusão é esperada ser rara (o achado RN-03 sugere que deveria ser ainda mais controlada do que hoje é tecnicamente possível).

---

## 12. Casos de Uso Relacionados
- **UC-33 (Cadastrar Documento Legal)** — pré-condição; ciclo de vida do documento criado ali continua neste UC.
- **UC-09 (Aceitar Termos Legais)** — consumidor direto dos documentos geridos aqui; RN-05 deste UC intersecta diretamente com os bugs RN-02/RN-03 já documentados em UC-09 (loop de redirecionamento ao editar versão/obrigatoriedade de um documento já aceito).
- **UC-32 (Editar, Ativar e Desativar Produto no Catálogo Master)** — mesmo padrão de módulo Admin sem API route/validação server-side (RN-06), porém achado oposto: lá o bloqueio de edição é excessivo quando o produto está em uso (UC-32, RN-01); aqui não há bloqueio nenhum, nem para exclusão definitiva, mesmo quando o documento já foi aceito por usuários (RN-03).

---

## 13. Referências
- `src/app/(admin)/admin/legal-documents/page.tsx` (listagem, exclusão)
- `src/app/(admin)/admin/legal-documents/[id]/page.tsx` (visualização)
- `src/app/(admin)/admin/legal-documents/[id]/edit/page.tsx` (wrapper de edição)
- `src/components/admin/LegalDocumentForm.tsx` (`handleSave` modo `edit`, `handleTitleChange`)
- `src/types/index.ts` (`LegalDocument`, `DocumentStatus`, `UserDocumentAcceptance`)
- `firestore.rules` (`match /legal_documents/{documentId}`, `match /user_document_acceptances/{acceptanceId}`)
- `src/hooks/usePendingTerms.ts`, `src/components/auth/TermsInterceptor.tsx` (consumidores afetados por RN-05)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-03, decisão de produto urgente/segurança]** Exclusão definitiva de documento legal sem checagem de aceites existentes — decisão pendente sobre se deveria: (a) bloquear a exclusão quando houver qualquer registro em `user_document_acceptances` referenciando o documento, (b) permitir apenas "desativar" (`status: 'inativo'`) como forma de remoção, seguindo o padrão do catálogo de produtos (UC-32), ou (c) manter o comportamento atual.
2. **[RN-05]** Falta de aviso ao editar versão/obrigatoriedade de um documento já ativo e potencialmente já aceito — decisão de produto sobre adicionar confirmação/aviso explícito nesta tela.
3. **[RN-02]** `published_at` nunca é lido por nenhuma tela do sistema — decisão de produto sobre se o campo deveria refletir a data da primeira publicação (não sobrescrever a cada save enquanto `status` permanece `'ativo'`), ou se pode ser removido do schema.
4. **[RN-01]** Slug sempre recalculado ao editar o título, mesmo quando foi customizado manualmente antes — decisão de UX pendente.
5. **[RN-06]** Mesma decisão já registrada em UC-33/UC-31 sobre introduzir validação server-side (rota `/api/legal-documents/*` com Admin SDK) para este módulo.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmado 1 UC agrupando Editar (incluindo alterar status = publicar/despublicar), Visualizar (somente leitura) e Excluir (hard delete, na listagem), seguindo o mesmo padrão de agrupamento do UC-29/UC-32. Achado crítico: exclusão de documento legal é permanente e não verifica a existência de registros em `user_document_acceptances` antes de apagar (RN-03) — diferente do UC-32, que ao menos bloqueia (em excesso) a edição de produtos em uso, aqui não há bloqueio algum, nem para a remoção definitiva. Achados adicionais: `published_at` sobrescrito a cada salvamento com status ativo e nunca lido por nenhuma tela (RN-02); slug sempre recalculado ao editar título, mesmo customizado (RN-01); ausência de aviso ao reabrir pendência de aceite via alteração de versão em documento já aceito (RN-05, com ligação direta aos bugs já documentados em UC-09). Segundo UC do módulo "Admin — Documentos Legais". |
