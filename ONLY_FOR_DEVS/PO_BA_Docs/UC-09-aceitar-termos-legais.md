# UC-09: Aceitar Termos Legais

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Autenticação
**Versão:** 1.3.1

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
- O usuário não possui, em `user_document_acceptances`, um registro para esse `document_id` com `document_version` igual à versão atual do documento (ver RN-01 — este é o critério *correto*, usado pelo mecanismo que decide redirecionar; as próprias telas de aceite usam um critério diferente, ver RN-02).

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
3. Página consulta `legal_documents` (`status: "ativo"`, `required_for_existing_users: true`, ordenado por `order`).
4. Página consulta `user_document_acceptances` do usuário e monta um `Set` dos `document_id` já aceitos, **de qualquer versão** (ver RN-02 — divergência confirmada em relação ao critério do passo 1).
5. Página filtra `pendingDocs` = documentos cujo `id` não está nesse `Set`.
6. Se `pendingDocs` estiver vazio, a página redireciona para `/` (ver Fluxo de Exceção 8a para o cenário em que isso diverge do que o `TermsInterceptor` calculou).
7. Página exibe cada documento (título, versão, conteúdo completo em Markdown, com scroll) e um checkbox "Li e aceito {título}".
8. Usuário marca os checkboxes de todos os documentos.
9. Usuário clica em "Aceitar Todos os Documentos" (habilitado somente quando todos os checkboxes estão marcados).
10. Sistema cria, em paralelo, um documento em `user_document_acceptances` para cada documento pendente exibido (`user_id`, `document_id`, `document_version` = versão do documento no momento, `accepted_at`, `ip_address: null`, `user_agent: navigator.userAgent`).
11. Sistema exibe um toast de sucesso e redireciona para `/`.
12. Caso de uso é concluído com sucesso.

### Variante B — Onboarding de nova clínica (`/clinic/setup/terms`)
1. `TermsInterceptor` detecta `hasPendingTerms` e, como o role é `clinic_admin`/`clinic_user` e o caminho já começa com `/clinic/setup`, redireciona para `/clinic/setup/terms`.
2. Página aguarda `useAuth()` resolver o usuário.
3. Página consulta `legal_documents` (`status: "ativo"`, `required_for_registration: true`, ordenado por `order`).
4. Página consulta `user_document_acceptances` e monta o mesmo tipo de `Set` (qualquer versão — mesma divergência da Variante A, RN-02).
5. Página filtra `pendingDocs`.
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

### 8a. [Bug confirmado] Loop de redirecionamento por divergência de critério de versão (a partir do passo 4 de qualquer variante)
1. `usePendingTerms` (que alimenta o `TermsInterceptor`) considera um documento pendente comparando **versão**: `acceptedVersion !== doc.version`.
2. As páginas `/accept-terms` e `/clinic/setup/terms`, ao carregar, usam um critério **diferente e mais simples**: apenas verificam se existe **qualquer** registro de aceite para aquele `document_id`, independentemente da versão aceita (`acceptedDocs.has(doc.id)`).
3. Cenário confirmado: um System Admin edita um documento "ativo" já aceito por um usuário (`LegalDocumentForm`, modo "edit", usa `updateDoc` sobre o **mesmo ID** do Firestore e permite alterar o campo `version` livremente, sem nenhum versionamento automático — ver UC-34, RN-05), mantendo `required_for_existing_users: true`. O usuário já possui um registro de aceite para aquele `document_id` (da versão antiga).
4. `TermsInterceptor` detecta a pendência (versão divergente) e redireciona para `/accept-terms`.
5. `/accept-terms` carrega, encontra o `document_id` já presente no seu `Set` de aceites (independente da versão) e considera `pendingDocs` vazio.
6. A página redireciona para `/` — o `TermsInterceptor` roda novamente, ainda detecta a mesma pendência (a versão continua divergente) e redireciona de volta para `/accept-terms`.
7. **Resultado: loop de redirecionamento entre `/` e `/accept-terms`**, sem nunca exibir o documento atualizado para reaceite. Não foi confirmado se isso já foi observado em produção, mas a lógica do código garante que ocorreria sempre que um documento "ativo" já aceito tiver sua versão alterada.

### 8b. [Bug confirmado] Divergência de filtro `required_for_registration` vs. `required_for_existing_users` (a partir do passo 3 de qualquer variante)
1. `usePendingTerms` considera um documento pendente se `required_for_registration` **ou** `required_for_existing_users` for `true`.
2. `/accept-terms` só busca documentos com `required_for_existing_users == true`; `/clinic/setup/terms` só busca documentos com `required_for_registration == true`.
3. Cenário confirmado: um documento com `required_for_registration: true` e `required_for_existing_users: false`, pendente para um `clinic_admin` que já passou do onboarding e está fora do caminho `/clinic/setup` — o `TermsInterceptor` o envia para `/accept-terms` (regra padrão), mas essa página nunca vai listar esse documento, pois sua query exige `required_for_existing_users == true`.
4. `pendingDocs` fica vazio mesmo com o documento genuinamente pendente — mesmo resultado de loop do Fluxo 8a.

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
| RN-01 | Um documento legal é considerado "pendente" para um usuário quando não existe nenhum registro em `user_document_acceptances` com `document_id` igual ao dele **e** `document_version` igual à versão atual do documento — segundo o cálculo correto usado por `usePendingTerms`/`TermsInterceptor`. | Permite forçar o reaceite quando o conteúdo de um termo é revisado (nova versão), não apenas na primeira vez. |
| RN-02 | **[Bug confirmado]** As duas páginas de aceite (`/accept-terms`, `/clinic/setup/terms`) usam um critério mais simples e incorreto: qualquer aceite pré-existente para o mesmo `document_id` (independente da versão) já é suficiente para considerar o documento "não pendente". Isso diverge do critério de RN-01 e gera um loop de redirecionamento confirmado (Fluxo de Exceção 8a). | Bug confirmado por leitura e comparação direta de `usePendingTerms.ts`, `accept-terms/page.tsx` e `clinic/setup/terms/page.tsx` — não corrigido nesta rodada, apenas documentado. |
| RN-03 | **[Bug confirmado]** `usePendingTerms` considera um documento pendente se `required_for_registration` **ou** `required_for_existing_users` for `true`; já `/accept-terms` filtra apenas por `required_for_existing_users` e `/clinic/setup/terms` filtra apenas por `required_for_registration`. Um documento pendente por um critério, mas buscado pela página "errada" para o contexto do usuário, nunca aparece na lista. | Bug confirmado por comparação direta das três queries — mesmo efeito de loop do RN-02 (Fluxo de Exceção 8b); não corrigido nesta rodada. |
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

1. **[Bug confirmado — sugerido como prioridade alta]** RN-02/Fluxo 8a — loop de redirecionamento quando um documento "ativo" já aceito tem sua versão alterada por um System Admin. Não confirmado pelo usuário como escopo de correção.
2. **[Bug confirmado]** RN-03/Fluxo 8b — divergência de filtro `required_for_registration`/`required_for_existing_users` entre `usePendingTerms` e as páginas de aceite, com o mesmo efeito de loop.
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
