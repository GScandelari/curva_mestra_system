# UC-09: Aceitar Termos Legais

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Autenticação
**Versão:** 1.4

> Um usuário autenticado — seja um usuário existente notificado de um novo termo obrigatório publicado (`/accept-terms`), seja um usuário em onboarding de uma nova clínica aceitando termos pela primeira vez (`/clinic/setup/terms`) — deve aceitar todos os documentos legais ativos e obrigatórios antes de continuar usando o sistema. Um componente global (`TermsInterceptor`) decide, em toda navegação, se há termos pendentes e redireciona automaticamente para a variante correta.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Usuario([👤 Usuário autenticado\nexistente ou em onboarding])
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC33(("UC-33\nCadastrar Documento\nLegal"))
        UC34(("UC-34\nEditar/Publicar/Despublicar\ne Excluir Documento Legal"))
        UC09(("UC-09\nAceitar Termos Legais"))
    end

    SystemAdmin --> UC33
    SystemAdmin --> UC34
    UC33 -.->|gera documento em\nlegal_documents| UC09
    UC34 -.->|pode reabrir pendência\n(nova versão); exclusão de doc.\njá aceito agora é bloqueada| UC09
    Usuario --> UC09
```

---

## 2. Atores

### 2.1 Ator Primário
**Usuário autenticado** (qualquer role) com pelo menos um documento legal ativo e obrigatório ainda não aceito, ou aceito em uma versão desatualizada.

### 2.2 Atores Secundários / Sistemas Externos
**System Admin** — publica/atualiza/exclui documentos na coleção `legal_documents` através de `admin/legal-documents/*`, mapeado formalmente em **UC-33 (Cadastrar Documento Legal)** e **UC-34 (Editar, Publicar/Despublicar e Excluir Documento Legal)**.

---

## 3. Pré-condições
- Usuário autenticado (claims carregadas).
- Existe pelo menos um documento em `legal_documents` com `status: "ativo"` e (`required_for_registration === true` **ou** `required_for_existing_users === true`).
- O usuário não possui, em `user_document_acceptances`, um registro para esse `document_id` com `document_version` igual à versão atual do documento (RN-01). Desde a correção do commit `16877f1` (RN-02, RN-03 — **[CORRIGIDO]**), esse é exatamente o mesmo critério usado tanto pelo mecanismo que decide redirecionar (`usePendingTerms`/`TermsInterceptor`) quanto pelas duas telas de aceite — antes da correção, as telas usavam critérios diferentes (ver histórico nos Fluxos de Exceção 8a e 8b).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Para cada documento aceito, um novo documento é criado em `user_document_acceptances` (`user_id`, `document_id`, `document_version`, `accepted_at`, `ip_address: null`, `user_agent`).
- Usuário é redirecionado: para `/` (Variante A — usuário existente) ou para `/clinic/setup` (Variante B — onboarding).

### 4.2 Falha (Garantias Mínimas)
- Nenhum registro de aceite é criado.
- Usuário permanece na tela de aceite, vendo o erro ou o aviso específico.

---

## 5. Gatilho (Trigger)
O `TermsInterceptor` (componente global, montado em `ClientProviders`) detecta, em qualquer navegação autenticada, que `usePendingTerms()` retorna `hasPendingTerms === true`, e redireciona automaticamente:
- para `/clinic/setup/terms`, se o role é `clinic_admin`/`clinic_user` **e** o caminho atual já começa com `/clinic/setup` (Variante B — onboarding);
- para `/accept-terms` em qualquer outro caso (Variante A — usuário existente).

---

## 6. Fluxo Principal (Basic Flow)

### Variante A — Usuário existente (`/accept-terms`)
1. `TermsInterceptor` detecta `hasPendingTerms` e redireciona para `/accept-terms`.
2. Página verifica `auth.currentUser`; se ausente, redireciona para `/login`.
3. Página consulta todos os documentos de `legal_documents` com `status: "ativo"` (ordenado por `order`) e filtra, no cliente, pela união `doc.required_for_registration || doc.required_for_existing_users` — mesmo critério de `usePendingTerms` (RN-02/RN-03 — **[CORRIGIDO]** no commit `16877f1`; antes, a query filtrava diretamente por `required_for_existing_users == true`, sem considerar `required_for_registration`).
4. Página consulta `user_document_acceptances` do usuário e monta um `Map<document_id, document_version>` dos aceites existentes — mesma estrutura usada por `usePendingTerms` (RN-02 — **[CORRIGIDO]** no commit `16877f1`; antes era um `Set` de `document_id`, que considerava aceito em qualquer versão).
5. Página filtra `pendingDocs` = documentos para os quais não existe entrada no `Map` ou cuja `document_version` aceita é diferente da versão atual do documento — mesmo critério de RN-01, agora idêntico ao de `usePendingTerms` (RN-02 — **[CORRIGIDO]**).
6. Se `pendingDocs` estiver vazio, a página redireciona para `/` — o critério agora é idêntico ao do `TermsInterceptor` (ver Fluxo de Exceção 8a, **[CORRIGIDO]**, para o comportamento anterior à correção).
7. Página exibe cada documento (título, versão, conteúdo completo em Markdown, com scroll) e um checkbox "Li e aceito {título}".
8. Usuário marca os checkboxes de todos os documentos.
9. Usuário clica em "Aceitar Todos os Documentos" (habilitado somente quando todos os checkboxes estão marcados).
10. Sistema cria, em paralelo, um documento em `user_document_acceptances` para cada documento pendente exibido (`user_id`, `document_id`, `document_version` = versão do documento no momento, `accepted_at`, `ip_address: null`, `user_agent: navigator.userAgent`).
11. Sistema exibe um toast de sucesso e redireciona para `/`.
12. Caso de uso é concluído com sucesso.

### Variante B — Onboarding de nova clínica (`/clinic/setup/terms`)
1. `TermsInterceptor` detecta `hasPendingTerms` e, como o role é `clinic_admin`/`clinic_user` e o caminho já começa com `/clinic/setup`, redireciona para `/clinic/setup/terms`.
2. Página aguarda `useAuth()` resolver o usuário.
3. Página consulta todos os documentos de `legal_documents` com `status: "ativo"` (ordenado por `order`) e filtra, no cliente, pela união `doc.required_for_registration || doc.required_for_existing_users` — mesmo critério de `usePendingTerms` (RN-02/RN-03 — **[CORRIGIDO]** no commit `16877f1`; antes, a query filtrava diretamente por `required_for_registration == true`, sem considerar `required_for_existing_users`).
4. Página consulta `user_document_acceptances` e monta um `Map<document_id, document_version>` — mesma estrutura da Variante A (RN-02 — **[CORRIGIDO]**; antes era um `Set` por `document_id`, aceito em qualquer versão, mesma divergência da Variante A).
5. Página filtra `pendingDocs` com o mesmo critério de versão da Variante A (passo 5).
6. Se `pendingDocs` estiver vazio, a página redireciona para `/clinic/setup` (não `/`, diferença em relação à Variante A).
7. Página exibe cada documento com um preview truncado (500 caracteres, com "...") e um botão "Ler {título} Completo" que abre um Dialog com o conteúdo integral rolável, além do checkbox "Li e concordo com {título}".
8. Usuário marca os checkboxes de todos os documentos — **não é obrigatório** abrir o Dialog de leitura completa antes de marcar (ver RN-06).
9. Usuário clica em "Aceitar e Continuar".
10. Sistema cria os registros de aceite (mesma lógica do passo 10 da Variante A).
11. Sistema exibe um toast de sucesso e redireciona para `/clinic/setup`.
12. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Usuário sem termos pendentes navega para qualquer rota (a partir do Gatilho)
1. `usePendingTerms` calcula `hasPendingTerms = false`.
2. `TermsInterceptor` não faz nada; a navegação prossegue normalmente.
3. Caso de uso não se inicia.

---

## 8. Fluxos de Exceção

### 8a. [Corrigido no commit `16877f1`] Loop de redirecionamento por divergência de critério de versão (histórico)
1. Antes da correção, `usePendingTerms` (que alimenta o `TermsInterceptor`) considerava um documento pendente comparando **versão**: `acceptedVersion !== doc.version`.
2. As páginas `/accept-terms` e `/clinic/setup/terms`, ao carregar, usavam um critério **diferente e mais simples**: apenas verificavam se existia **qualquer** registro de aceite para aquele `document_id`, independentemente da versão aceita (`acceptedDocs.has(doc.id)`).
3. Cenário que gerava o loop: um System Admin edita um documento "ativo" já aceito por um usuário (`LegalDocumentForm`, modo "edit", usa `updateDoc` sobre o **mesmo ID** do Firestore e permite alterar o campo `version` livremente, sem nenhum versionamento automático — ver UC-34, RN-05), mantendo `required_for_existing_users: true`. O usuário já possuía um registro de aceite para aquele `document_id` (da versão antiga).
4. `TermsInterceptor` detectava a pendência (versão divergente) e redirecionava para `/accept-terms`.
5. `/accept-terms` carregava, encontrava o `document_id` já presente no seu `Set` de aceites (independente da versão) e considerava `pendingDocs` vazio.
6. A página redirecionava para `/` — o `TermsInterceptor` rodava novamente, ainda detectava a mesma pendência (a versão continuava divergente) e redirecionava de volta para `/accept-terms`.
7. **Resultado (antes da correção): loop de redirecionamento entre `/` e `/accept-terms`**, sem nunca exibir o documento atualizado para reaceite.
8. **[CORRIGIDO]** No commit `16877f1`, as duas páginas passaram a montar um `Map<document_id, document_version>` (em vez de `Set<document_id>`) e a calcular pendência com o mesmo critério de `usePendingTerms` (`!acceptedVersion || acceptedVersion !== doc.version`) — ver seção 6, passos 4-5 de ambas as variantes, e RN-02.

### 8b. [Corrigido no commit `16877f1`] Divergência de filtro `required_for_registration` vs. `required_for_existing_users` (histórico)
1. Antes da correção, `usePendingTerms` considerava um documento pendente se `required_for_registration` **ou** `required_for_existing_users` fosse `true`.
2. `/accept-terms` buscava só documentos com `required_for_existing_users == true`; `/clinic/setup/terms` buscava só documentos com `required_for_registration == true`.
3. Cenário que gerava o loop: um documento com `required_for_registration: true` e `required_for_existing_users: false`, pendente para um `clinic_admin` que já passou do onboarding e está fora do caminho `/clinic/setup` — o `TermsInterceptor` o enviava para `/accept-terms` (regra padrão), mas essa página nunca listava esse documento, pois sua query exigia `required_for_existing_users == true`.
4. `pendingDocs` ficava vazio mesmo com o documento genuinamente pendente — mesmo resultado de loop do Fluxo 8a.
5. **[CORRIGIDO]** No commit `16877f1`, as duas páginas passaram a buscar todos os documentos com `status == 'ativo'` (sem filtro de `required_for_*` na query) e a filtrar client-side pela união `doc.required_for_registration || doc.required_for_existing_users`, exatamente como `usePendingTerms` — ver seção 6, passo 3 de ambas as variantes, e RN-03.

### 8c. Nem todos os documentos marcados (a partir do passo 9 de qualquer variante)
1. Usuário tenta confirmar sem marcar todos os checkboxes (o botão fica desabilitado nesse caso, mas o handler também revalida).
2. Sistema exibe toast: "Atenção" / "Você precisa aceitar todos os documentos para continuar".
3. Nenhum registro é criado; caso de uso retorna à marcação dos checkboxes.

### 8d. Usuário não autenticado (a partir do passo 2 da Variante A, ou implicitamente na Variante B)
1. `auth.currentUser` (Variante A) ou `user` de `useAuth()` (Variante B) está ausente.
2. A Variante A redireciona explicitamente para `/login`. A Variante B simplesmente não carrega nada (`loadDocuments` só roda se `user` existir) — **a tela ficaria "carregando" indefinidamente**, sem nenhum redirecionamento explícito para usuário deslogado (ver seção 14).
3. Caso de uso é encerrado (Variante A) ou fica bloqueado indefinidamente (Variante B).

### 8e. Erro ao carregar documentos ou salvar aceites
1. Exceção lançada durante a leitura (`getDocs`) ou a gravação (`addDoc`) no Firestore.
2. Sistema exibe um toast destructive com a mensagem crua do Firestore (`error.message`), sem tradução — ver RNF-03.
3. Caso de uso retorna à etapa anterior (carregamento) ou permanece no formulário (gravação).

### 8f. [Corrigido — UC-34] Documento excluído permanentemente pelo System Admin (apenas se nunca aceito)
1. Um System Admin exclui um documento (UC-34) na listagem `/admin/legal-documents`.
2. Desde a correção de UC-34/RN-03 (commit `4561a2a`), a exclusão só é permitida se não existir nenhum registro em `user_document_acceptances` referenciando o `document_id`; caso exista ao menos um aceite, a exclusão é bloqueada pelo próprio UC-34, e este fluxo não se aplica.
3. Quando a exclusão realmente ocorre (documento nunca aceito), ele deixa de existir em `legal_documents` e para de aparecer em qualquer consulta futura (inclusive nas queries deste UC) — deixa de contar como pendência.
4. Como a exclusão só é possível para documentos sem nenhum aceite prévio, este cenário não gera histórico "órfão" em `user_document_acceptances` (ver UC-34, RN-03).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Um documento legal é considerado "pendente" para um usuário quando não existe nenhum registro em `user_document_acceptances` com `document_id` igual ao dele **e** `document_version` igual à versão atual do documento — segundo o cálculo usado por `usePendingTerms`/`TermsInterceptor`, e, desde o commit `16877f1`, também pelas duas telas de aceite (RN-02, RN-03). | Permite forçar o reaceite quando o conteúdo de um termo é revisado (nova versão), não apenas na primeira vez. |
| RN-02 | **[CORRIGIDO — commit `16877f1`]** As duas páginas de aceite (`/accept-terms`, `/clinic/setup/terms`) usavam um critério mais simples e incorreto: qualquer aceite pré-existente para o mesmo `document_id` (independente da versão) já era suficiente para considerar o documento "não pendente". Isso divergia do critério de RN-01 e gerava um loop de redirecionamento confirmado (Fluxo de Exceção 8a). Corrigido: as duas páginas agora montam um `Map<document_id, document_version>` e calculam a pendência com o mesmo critério de `usePendingTerms` (`!acceptedVersion || acceptedVersion !== doc.version`). | Corrigido por comparação direta de `usePendingTerms.ts` (referência, não alterado no commit), `src/app/(auth)/accept-terms/page.tsx` e `src/app/(clinic)/clinic/setup/terms/page.tsx` (ambos alinhados ao critério de referência no commit `16877f1`). |
| RN-03 | **[CORRIGIDO — commit `16877f1`]** `usePendingTerms` considera um documento pendente se `required_for_registration` **ou** `required_for_existing_users` for `true`; antes da correção, `/accept-terms` filtrava apenas por `required_for_existing_users` e `/clinic/setup/terms` filtrava apenas por `required_for_registration` — um documento pendente por um critério, mas buscado pela página "errada" para o contexto do usuário, nunca aparecia na lista (Fluxo de Exceção 8b). Corrigido: as duas páginas agora buscam todos os documentos com `status == 'ativo'` e filtram client-side pela união das duas flags, igual a `usePendingTerms`. | Corrigido por comparação direta das três queries (`usePendingTerms.ts`, `accept-terms/page.tsx`, `clinic/setup/terms/page.tsx`) no commit `16877f1`. |
| RN-04 | O aceite é tudo-ou-nada por tela: o botão de confirmação só é habilitado quando todos os documentos pendentes exibidos estão marcados; não é possível aceitar parcialmente. | Confirmado pelo `disabled={... || !documents.every((doc) => acceptances[doc.id])}`, presente em ambas as páginas. |
| RN-05 | Registros em `user_document_acceptances` são imutáveis por regra do Firestore (`allow update, delete: if false`) — cada aceite é permanente; um novo aceite (nova versão) sempre cria um novo documento, nunca sobrescreve o anterior. **[Corrigido — UC-34]** Essa imutabilidade é agora reforçada pela verificação implementada em UC-34 (RN-03, corrigido no commit `4561a2a`): a exclusão do documento legal original é bloqueada quando existem registros em `user_document_acceptances` referenciando-o, garantindo que a trilha de auditoria sempre preserve também o conteúdo do documento aceito. Antes dessa correção, a imutabilidade dos registros de aceite não impedia que o documento legal original fosse excluído permanentemente, deixando o histórico "órfão" (auditoria sem o conteúdo aceito). | Confirmado em `firestore.rules` — trilha de auditoria legal (rastreabilidade de quem aceitou qual versão e quando); risco de órfãos, hoje mitigado, detalhado em UC-34 (RN-03). |
| RN-06 | A Variante B exige clicar em "Ler {título} Completo" para ver o documento por inteiro (o conteúdo inline é truncado em 500 caracteres), mas não impede marcar o checkbox e aceitar sem nunca ter aberto esse Dialog — não há nenhuma trava técnica que force a leitura completa. A Variante A já exibe o conteúdo completo inline (com scroll, sem truncamento). | Confirmado por leitura de ambos os componentes — diferença real de UX entre as duas variantes, sem exigência técnica de leitura integral em nenhuma delas. |
| RN-07 | O campo `ip_address` é sempre gravado como `null` nos dois pontos de entrada (comentário no próprio código: "Pode ser capturado via API") — o endereço IP de quem aceitou nunca é registrado, apesar do campo existir no schema. | Confirmado por leitura direta — campo presente mas nunca preenchido, em ambas as páginas. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | `TermsInterceptor` é montado globalmente (`ClientProviders`) e roda a cada mudança de `pathname`/usuário/claims — toda navegação autenticada passa por essa checagem, exceto as rotas em `PUBLIC_ROUTES` (`/login`, `/register`, `/accept-terms`, `/clinic/setup/terms`, `/`). | Segurança / Compliance |
| RNF-02 | Toda a leitura de `legal_documents`/`user_document_acceptances` e a escrita do aceite ocorrem client-side, direto no Firestore (sem API route própria) — a segurança depende inteiramente das regras do Firestore (RN-05, e leitura de `legal_documents` liberada a qualquer usuário autenticado). | Segurança |
| RNF-03 | Mensagens de erro do Firestore são exibidas cruas ao usuário (`error.message`), sem tradução para português — diferente do padrão de outras telas do sistema (ex.: UC-04, UC-06). | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — ocorre uma vez por documento legal obrigatório novo/atualizado, por usuário, e uma vez, obrigatoriamente, durante o onboarding de cada nova clínica (Variante B).

---

## 12. Casos de Uso Relacionados
- **UC-33 (Cadastrar Documento Legal)** — System Admin cria os documentos consumidos aqui.
- **UC-34 (Editar, Publicar/Despublicar e Excluir Documento Legal)** — System Admin altera status/versão/obrigatoriedade dos documentos (podendo reabrir pendência de aceite, RN-05 daquele UC) ou excluí-los permanentemente quando nunca aceitos (a exclusão é bloqueada quando existem aceites registrados, ver UC-34 RN-03, corrigido no commit `4561a2a`) (Fluxo de Exceção 8f, RN-05 deste UC).
- **UC-02 (Aprovar Solicitação de Acesso)** é pré-condição indireta da Variante B — só existe um `clinic_admin` em onboarding depois que UC-02 cria o tenant e o usuário.
- **UC-41 (Editar Perfil e Trocar Senha do Usuário de Clínica)** exibe, em `clinic/profile/page.tsx`, o histórico somente-leitura dos registros de `user_document_acceptances` criados por este UC — formaliza o escopo que a seção 13 deste UC já citava como "fora do escopo deste UC".
- **UC-45 (Completar Configuração Inicial da Clínica)** — destino do redirecionamento ao final da Variante B (passo 11, `router.push('/clinic/setup')`); relação sequencial, não `<<include>>`/`<<extend>>` formal.

---

## 13. Referências
- `src/app/(auth)/accept-terms/page.tsx`
- `src/app/(clinic)/clinic/setup/terms/page.tsx`
- `src/components/auth/TermsInterceptor.tsx`
- `src/hooks/usePendingTerms.ts`
- `src/components/admin/LegalDocumentForm.tsx` (confirma que "editar" reutiliza o mesmo ID do documento e permite alterar `version` livremente, sem versionamento automático — ver UC-34)
- `src/app/(clinic)/clinic/profile/page.tsx` (exibição somente-leitura do histórico de aceites do próprio usuário — formalizado em UC-41)
- `src/types/index.ts` (`LegalDocument`, `UserDocumentAcceptance`)
- `firestore.rules` (regras de `legal_documents` e `user_document_acceptances`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Resolvido — commit `16877f1`]** RN-02/Fluxo 8a — loop de redirecionamento quando um documento "ativo" já aceito tem sua versão alterada por um System Admin. Corrigido unificando o critério de pendência (`Map<document_id, document_version>` + checagem de versão) entre `usePendingTerms` e as duas páginas de aceite.
2. **[Resolvido — commit `16877f1`]** RN-03/Fluxo 8b — divergência de filtro `required_for_registration`/`required_for_existing_users` entre `usePendingTerms` e as páginas de aceite. Corrigido unificando a query (sem filtro `required_for_*` na leitura; filtro client-side pela união das duas flags) nas duas páginas.
3. **[Observação]** RN-07 — `ip_address` nunca é de fato capturado, apesar de existir no schema; pode ser relevante dependendo do requisito legal/de compliance real por trás desse campo.
4. **[Resolvido — UC-34]** RN-05/Fluxo 8f — exclusão permanente de documentos legais já aceitos (sem checagem de dependências) era um risco de compliance identificado durante o mapeamento de UC-34; corrigido em UC-34 (RN-03, commit `4561a2a`): a exclusão passou a ser bloqueada sempre que existirem aceites registrados.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Documenta as duas variantes do mesmo UC (usuário existente via `/accept-terms`; onboarding via `/clinic/setup/terms`), o mecanismo de decisão global (`TermsInterceptor` + `usePendingTerms`), e dois bugs confirmados de divergência de critério entre esse mecanismo e as páginas de aceite, que juntos podem causar um loop de redirecionamento em cenários de revisão de documento (RN-02, RN-03). |
| 1.1 | 15/07/2026 | Guilherme Scandelari | Atualização de referências cruzadas: o módulo "Gerenciar Documentos Legais" (System Admin), antes citado como "ainda não mapeado", foi mapeado como UC-33 (Cadastrar Documento Legal) e UC-34 (Editar, Publicar/Despublicar e Excluir Documento Legal). Diagrama, seções 2.2, 12 e 13 atualizados com as referências. Adicionado Fluxo de Exceção 8f e nota em RN-05 sobre o achado crítico de UC-34 (exclusão permanente de documento legal já aceito, sem checagem de `user_document_acceptances`), e item correspondente na seção 14. |
| 1.2 | 15/07/2026 | Guilherme Scandelari | Atualização de referência cruzada: a exibição somente-leitura do histórico de aceites em `clinic/profile/page.tsx`, antes citada na seção 13 como "fora do escopo deste UC", foi formalmente mapeada como UC-41 (Editar Perfil e Trocar Senha do Usuário de Clínica). Seções 12 e 13 atualizadas com a referência. |
| 1.3 | 15/07/2026 | Guilherme Scandelari | Cross-reference: adicionada referência a UC-45 (Completar Configuração Inicial da Clínica), destino do redirecionamento ao final da Variante B de onboarding. |
| 1.3.1 | 16/07/2026 | Guilherme Scandelari | Cross-reference: o bug de exclusão órfã documentado em UC-34 (RN-03) foi corrigido no commit `4561a2a` (bloqueio de exclusão quando existem aceites registrados). Atualizado o diagrama (seção 1), Fluxo de Exceção 8f, RN-05 e seção 12 para refletir que a exclusão permanente de documento legal só ocorre quando ele nunca foi aceito; item 4 da seção 14 marcado como resolvido. Nenhum outro conteúdo deste UC foi alterado. |
| 1.4 | 20/07/2026 | Guilherme Scandelari | **Correção de bug (commit `16877f1`)**: RN-02 e RN-03 corrigidos — `accept-terms/page.tsx` e `clinic/setup/terms/page.tsx` agora usam exatamente o mesmo critério de "documento pendente" que `usePendingTerms`/`TermsInterceptor` (união `required_for_registration || required_for_existing_users` na query, e `Map<document_id, document_version>` com checagem de versão em vez de `Set` por `document_id`). Isso elimina o loop de redirecionamento descrito nos Fluxos de Exceção 8a e 8b, ambos reescritos como histórico "[Corrigido]". Seções 3, 6 (passos 3-6 de ambas as variantes), 9 (RN-01 a RN-03) e 14 (itens 1 e 2) atualizadas para refletir a correção. |
