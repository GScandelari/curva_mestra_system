# UC-39: Criar Usuário Diretamente para uma Clínica (via Painel Admin)

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Em Revisão
**Módulo/Contexto:** Administração do Sistema (Gestão de Usuários)
**Versão:** 1.2.1

> Um System Admin, na seção "Usuários da Clínica" da tela `admin/tenants/[id]/page.tsx` (mesma tela de UC-21/UC-22/UC-23), cria diretamente um novo usuário (`clinic_admin` ou `clinic_user`) para uma clínica específica, escolhendo o e-mail e a senha no próprio formulário — sem que exista nenhuma solicitação de acesso prévia. É o caminho equivalente, do lado do System Admin, ao que o próprio `clinic_admin` faz em `clinic/users/page.tsx` (ainda não mapeado como UC formal, citado em UC-05): ambos chamam exatamente a mesma rota `POST /api/users/create`, diferenciados apenas pelo parâmetro `tenant_id_override`, exclusivo deste fluxo.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])
    FirebaseAuth([🔧 Firebase Auth - Admin SDK])
    CloudFunction([🔧 onUserCreated\nCloud Function])

    subgraph Sistema["Curva Mestra"]
        UC39(("UC-39\nCriar Usuário Diretamente\npara uma Clínica"))
        UC22(("UC-22\nEditar/Desativar/Reativar\nClínica (mesma tela)"))
        UC23(("UC-23\nVincular Consultor\n(mesma tela)"))
        UC02(("UC-02\nAprovar Solicitação\n(mecanismo alternativo\nde criação de usuário)"))
    end

    SystemAdmin --> UC39
    UC39 -.->|mesma tela| UC22
    UC39 -.->|mesma tela| UC23
    UC39 -.->|adminAuth.createUser +\nsetCustomUserClaims| FirebaseAuth
    UC39 -.->|dispara ao criar\ndocumento users/{uid}| CloudFunction
    UC02 -.->|mecanismo alternativo,\nsempre cria tenant novo\ne senha aleatória| UC39
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** (`is_system_admin === true`) — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']`.

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth (Admin SDK):** cria o usuário (`adminAuth.createUser`) e define os custom claims (`adminAuth.setCustomUserClaims`), server-side.
- **Cloud Function `onUserCreated`:** dispara automaticamente na criação do documento `users/{uid}` e envia um e-mail de boas-vindas genérico ao novo usuário (RN-02).
- **Usuário-alvo** (`clinic_admin`/`clinic_user` recém-criado) — não recebe suas credenciais por nenhum canal automático (RN-02); depende do System Admin comunicá-las por fora do sistema. Desde o commit `f6e9161`, o diálogo de criação já deixa esse comportamento explícito para o admin (ver RN-02, `[CORRIGIDO]`).

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`.
- Existe um tenant com o id da URL (`/admin/tenants/{id}`) — **independentemente de estar ativo ou inativo** (a API não verifica `tenant.active`, RN-05).
- A quantidade de usuários já cadastrados para o tenant (`users` onde `tenant_id === tenantId`, incluindo inativos) é menor que `tenant.max_users`.

---

## 4. Pós-condições

### 4.1 Sucesso
- Um novo usuário é criado no Firebase Auth (`adminAuth.createUser`) com o e-mail e a senha exatos informados pelo System Admin no formulário, `emailVerified: false`.
- Custom claims definidas: `tenant_id` (= `tenant_id_override`), `role` (`clinic_admin` ou `clinic_user`, escolhido no formulário), `active: true`, `is_system_admin: false`, **`requirePasswordChange: true`** — **[CORRIGIDO em v1.2, commit `467f462`]**: até então, essa claim nunca era definida por este fluxo (RN-03). O usuário criado por um System Admin agora é obrigado a trocar a senha escolhida pelo admin no primeiro acesso, acionando UC-06 — mesmo padrão já usado em UC-02/UC-28.
- Documento `users/{uid}` criado na coleção raiz do Firestore: `email`, `full_name`, `displayName`, `role`, `active: true`, `tenant_id`, **`requirePasswordChange: true`** (mesma correção do commit `467f462`, RN-03), `created_at`, `updated_at`.
- A criação do documento acima dispara a Cloud Function `onUserCreated`, que envia um e-mail de boas-vindas **genérico** ao novo usuário — contendo nome, papel e um botão "Acessar o Sistema", **mas nunca a senha nem qualquer credencial**. **[CORRIGIDO em v1.2.1, commit `f6e9161`]**: até então, o texto do diálogo de criação contradizia esse comportamento, afirmando que o usuário receberia as credenciais por e-mail; o texto foi corrigido para refletir o comportamento real (RN-02, ver passo 3 do Fluxo Principal).
- Sistema exibe "Usuário criado com sucesso!", fecha o diálogo, limpa o formulário e recarrega a lista "Usuários da Clínica" na mesma tela.

### 4.2 Falha (Garantias Mínimas)
- Se qualquer validação falhar (campos obrigatórios ausentes, limite de usuários atingido, e-mail já existente, senha rejeitada pelo Firebase Auth): nenhum usuário é criado, nenhum documento é escrito; a mensagem de erro é exibida na própria página (fora do diálogo, na seção `error` compartilhada com UC-22/UC-23), e o diálogo permanece aberto.

---

## 5. Gatilho (Trigger)
System Admin, na tela `/admin/tenants/{id}`, clica em "Adicionar Usuário" (botão desabilitado quando `clinicUsers.length >= tenant.max_users`), preenche o diálogo "Adicionar Novo Usuário" e clica em "Criar Usuário".

---

## 6. Fluxo Principal (Basic Flow)

1. System Admin acessa `/admin/tenants/{id}` e visualiza a seção "Usuários da Clínica", com a contagem `{clinicUsers.length} de {tenant.max_users || 5} usuários`.
2. Clica em "Adicionar Usuário" — botão desabilitado quando `clinicUsers.length >= (tenant.max_users || 5)` (checagem de UX apenas client-side; a validação real e definitiva do limite ocorre no backend, RN-06).
3. Sistema abre o diálogo "Adicionar Novo Usuário", com o texto **[CORRIGIDO no commit `f6e9161` — RN-02]** "Crie um novo usuário para esta clínica. A senha definida aqui não é enviada por e-mail — comunique-a ao usuário por fora do sistema. Ele será solicitado a trocá-la no primeiro acesso." — texto anterior ("O usuário receberá as credenciais por email.") não correspondia ao comportamento real do sistema; a frase final já era verdadeira desde a correção de RN-03 (commit `467f462`).
4. System Admin preenche "Nome Completo", "Email", "Senha" (placeholder "Mínimo 6 caracteres", **sem nenhum atributo `required` ou `minLength` nos campos do diálogo** — RN-01) e escolhe "Função" (`select`: "Usuário" — `clinic_user`, padrão — ou "Administrador" — `clinic_admin`).
5. Clica em "Criar Usuário".
6. Sistema obtém o Bearer token do admin (`auth.currentUser.getIdToken()`) e chama `POST /api/users/create` com `{ email, password, displayName, role, tenant_id_override: tenantId }`.
7. API valida o token e confirma que o chamador é `is_system_admin === true` ou `role === 'clinic_admin'` — neste fluxo, sempre o primeiro caso.
8. Como `isSystemAdmin && tenant_id_override` são ambos verdadeiros, a API usa `tenantId = tenant_id_override` — o `tenant_id` do próprio token do chamador (que sequer existe, já que `system_admin` não tem `tenant_id` nos claims) é ignorado por completo; o admin pode, assim, criar o usuário em **qualquer** clínica do sistema, não apenas na que estiver "selecionada" em algum outro contexto (RN-07).
9. API valida os campos obrigatórios (`email`, `displayName`, `password`, `role`) e que `role` seja `clinic_admin` ou `clinic_user`.
10. API busca o tenant pelo `tenantId`; retorna 404 se não existir. **Não há checagem de `tenant.active`** — a criação prossegue normalmente mesmo que a clínica esteja desativada (UC-22) (RN-05).
11. API conta os usuários existentes na coleção raiz `users` filtrados por `tenant_id === tenantId` (incluindo inativos) e compara com `tenant.max_users`; retorna 400 se o limite já foi atingido (mesma lógica correta já usada, por outro caminho, em UC-05 RN-01, e correta aqui também).
12. API cria o usuário no Firebase Auth (`adminAuth.createUser`) com a senha **exata** informada pelo admin no formulário — diferente de UC-02 (que sempre gera uma senha aleatória via CSPRNG e nunca reutiliza a senha de um formulário).
13. API define os custom claims (`tenant_id`, `role`, `active: true`, `is_system_admin: false`, **`requirePasswordChange: true`**) — desde o commit `467f462`, o mesmo padrão já usado por UC-02/UC-28 (RN-03, `[CORRIGIDO]`).
14. API cria o documento `users/{uid}` na coleção raiz do Firestore, incluindo `requirePasswordChange: true` (mesma correção, RN-03).
15. A criação do documento dispara a Cloud Function `onUserCreated`, que envia o e-mail de boas-vindas genérico ao novo usuário — sem a senha (RN-02).
16. API retorna 201 com `{ success: true, user: { uid, email, displayName, role }, message }`.
17. Sistema exibe "Usuário criado com sucesso!", limpa os campos do formulário (`newUserEmail`, `newUserPassword`, `newUserName`, `newUserRole` volta a `clinic_user`), fecha o diálogo, e chama `loadUsers()` para recarregar a lista "Usuários da Clínica".
18. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

Nenhum identificado como caminho de UI genuinamente distinto — a escolha de "Função" (`clinic_admin` vs. `clinic_user`) é apenas um campo do mesmo formulário, submetido no mesmo fluxo (mesmo padrão de UC-37, seção 7).

---

## 8. Fluxos de Exceção

### 8a. Campos obrigatórios ausentes (a partir do passo 6)
1. O diálogo não valida nenhum campo antes de enviar (RN-01) — se `email`, `displayName`, `password` ou o formulário for submetido incompleto, a API retorna 400 ("Campos obrigatórios: email, displayName, password, role").
2. Sistema exibe a mensagem de erro na página (fora do diálogo).

### 8b. E-mail já cadastrado no Firebase Auth (a partir do passo 12)
1. Firebase Auth retorna `auth/email-already-exists` — o mesmo e-mail não pode ser usado por dois usuários em nenhuma clínica, já que a unicidade é global no projeto Firebase Auth, não por tenant.
2. API retorna 400 ("Este email já está cadastrado no sistema"); sistema exibe a mensagem.

### 8c. E-mail inválido (a partir do passo 12)
1. Firebase Auth retorna `auth/invalid-email`.
2. API retorna 400 ("Email inválido").

### 8d. Senha rejeitada pelo Firebase Auth (a partir do passo 12)
1. Firebase Auth retorna `auth/weak-password` (senha com menos de 6 caracteres — mínimo do próprio Firebase Auth, já que nem o client nem o backend desta rota validam explicitamente o comprimento da senha, RN-01).
2. API retorna 400 ("Senha muito fraca. Use pelo menos 6 caracteres").

### 8e. Limite de usuários atingido (a partir do passo 11)
1. `currentUserCount >= maxUsers`.
2. API retorna 400 com `{ error, currentCount, maxUsers }`; sistema exibe a mensagem de erro.

### 8f. Tenant não encontrado (a partir do passo 10)
1. Só alcançável se o `id` da URL for inválido — não é um caminho comum pela UI, já que o admin chega a esta tela a partir de uma listagem de tenants existentes.
2. API retorna 404 ("Clínica não encontrada").

### 8g. Token ausente ou inválido (a partir do passo 7)
1. API retorna 401 ("Não autorizado").

### 8h. Chamador sem permissão (a partir do passo 7)
1. Não alcançável pela UI desta tela (restrita a `system_admin`), mas a API aceitaria a chamada de um `clinic_admin` legítimo também (mesma rota usada por `clinic/users/page.tsx`, fora do escopo deste UC).
2. Se nenhuma das duas condições (`is_system_admin` ou `clinic_admin`) for satisfeita, API retorna 403 ("Apenas administradores podem criar usuários").

### 8i. Erro genérico não mapeado (a partir dos passos 12-14)
1. Qualquer outra exceção do Firebase Admin SDK.
2. API retorna 500 ("Erro ao criar usuário. Tente novamente.").

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Achado]** Nenhum campo do diálogo "Adicionar Novo Usuário" tem validação client-side de fato (`required`, `minLength`, formato de e-mail) — todos os campos são `Input`s simples, sem atributos de validação HTML nem checagem em `handleCreateUser` antes da chamada à API. Toda a validação depende inteiramente do backend (`POST /api/users/create`), que também não valida explicitamente o comprimento da senha (apenas encaminha ao Firebase Auth, que rejeita com `auth/weak-password` se menor que 6 caracteres). | Confirmado por leitura completa do JSX do diálogo e de `handleCreateUser` — nenhuma checagem antes do `fetch`. |
| RN-02 | **[CORRIGIDO no commit `f6e9161` — decisão do PO pela opção (a) da Seção 14]** Antes: o texto do diálogo afirmava "O usuário receberá as credenciais por email", mas o único e-mail efetivamente disparado (via trigger `onUserCreated`, `functions/src/onUserCreated.ts` → `sendWelcomeEmail`) era um e-mail de boas-vindas **genérico**: nome, papel (badge) e um botão "Acessar o Sistema" — o corpo do e-mail nunca inclui a senha nem qualquer outra credencial, porque a função que o gera (`sendWelcomeEmail`) só recebe `email`, `full_name` e `role` do documento Firestore (que nunca armazena a senha em texto). Agora: o `DialogDescription` em `admin/tenants/[id]/page.tsx` foi alterado para "Crie um novo usuário para esta clínica. A senha definida aqui não é enviada por e-mail — comunique-a ao usuário por fora do sistema. Ele será solicitado a trocá-la no primeiro acesso." — texto que reflete o comportamento real do sistema (nunca envia a senha) e reforça, na própria UI, a orientação para o admin comunicá-la por fora, além de citar a troca obrigatória no primeiro acesso (já garantida desde a correção de RN-03, commit `467f462`). Decisão do PO, explícita: das duas alternativas registradas na v1.1/v1.2 deste UC, optou-se pela opção **(a)** — corrigir o texto da UI — em vez da opção (b) — implementar envio de senha em texto plano por e-mail —, por segurança. | Correção confirmada por leitura do commit `f6e9161` (`src/app/(admin)/admin/tenants/[id]/page.tsx`) — novo texto do `DialogDescription`. Decisão de escopo (opção "a") relatada pelo autor da correção e registrada aqui. |
| RN-03 | **[CORRIGIDO em v1.2 — commit `467f462`]** Antes: diferente de UC-02 (aprovação de solicitação, que gera uma senha aleatória via CSPRNG e envia um link de redefinição de senha) e de UC-28 (criação de consultor, que sempre nasce com `requirePasswordChange: true`), o usuário criado por este fluxo nascia com a senha exata escolhida pelo System Admin e **sem** a claim `requirePasswordChange` — nunca era obrigado a trocá-la no primeiro acesso; UC-06 nunca era acionado por este caminho de criação. Agora: `POST /api/users/create` define `requirePasswordChange: true` tanto nas custom claims (`adminAuth.setCustomUserClaims`) quanto no documento Firestore (`userDoc`, `users/{uid}`), alinhando este fluxo ao padrão já usado em UC-02/UC-28 — o usuário criado por um System Admin é obrigado a trocar a senha escolhida pelo admin no primeiro login, acionando UC-06. | Correção confirmada por leitura do commit `467f462` (`src/app/api/users/create/route.ts`) — `requirePasswordChange: true` adicionado tanto no objeto de custom claims quanto no `userDoc` gravado em `users/{uid}`. |
| RN-04 | A contagem de usuários para verificar o limite (`max_users`) é feita corretamente, consultando a coleção raiz `users` filtrada por `tenant_id` (incluindo inativos) — mesma fonte de verdade correta já confirmada em UC-05 (RN-01), diferente do cálculo incorreto de `getTenantLimits()` documentado naquele mesmo UC (RN-04, tela `clinic/access-requests`). | Confirmado por leitura literal do handler — `adminDb.collection('users').where('tenant_id', '==', tenantId).get()`. |
| RN-05 | **[Achado]** A API não verifica se o tenant está ativo (`tenant.active`) antes de permitir a criação do usuário — um System Admin pode adicionar um novo usuário a uma clínica desativada (UC-22) através desta mesma tela, sem nenhum aviso ou bloqueio. | Confirmado por leitura completa do handler `POST /api/users/create` — após buscar o tenant, a única checagem feita sobre ele é `tenantDoc.exists`. |
| RN-06 | O botão "Adicionar Usuário" é desabilitado no client quando `clinicUsers.length >= (tenant.max_users \|\| 5)`, mas essa é apenas uma conveniência de UX — a validação real e definitiva do limite é sempre revalidada no backend (RN-04), sem brecha de segurança caso o botão seja contornado (ex.: chamada direta à API). | Confirmado pela existência de checagem equivalente e independente no backend (passo 11 do Fluxo Principal). |
| RN-07 | **[Achado, mesma rota de UC-05]** Este fluxo compartilha exatamente a mesma rota `POST /api/users/create` usada pelo próprio `clinic_admin` para adicionar usuários à própria clínica (`clinic/users/page.tsx`, ainda sem UC formal — citado em UC-05, seção 14). A única diferença de comportamento entre as duas origens está no parâmetro `tenant_id_override`: quando presente e o chamador é `system_admin`, a API ignora completamente qualquer `tenant_id` do próprio chamador (que nem existe nos claims de um `system_admin`) e usa o tenant escolhido livremente pelo admin nesta tela — permitindo criar um usuário para **qualquer** clínica do sistema, não apenas uma clínica à qual o chamador esteja de alguma forma associado. | Confirmado por leitura literal da árvore de decisão de `tenantId` no handler (`if (isSystemAdmin && tenant_id_override) ... else if (isClinicAdmin) ...`). |
| RN-08 | Assim como em UC-36, nenhum campo de auditoria é gravado no documento `users/{uid}` indicando que este usuário específico foi criado diretamente por um System Admin (via `tenant_id_override`) em vez de ter passado por UC-02 (aprovação de solicitação) — não há como distinguir, olhando apenas o documento do usuário, qual das origens de criação foi usada. | Confirmado por leitura do objeto `userDoc` gravado pelo handler — nenhum campo do tipo `created_by`/`created_via`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda comunicação de erro/sucesso desta ação usa os mesmos estados `error`/`success` compartilhados com UC-22/UC-23 (mesma tela) — exibidos fora do diálogo, na página principal, não dentro do próprio `Dialog`. | Consistência de UI |
| RNF-02 | **[Mitigado no commit `f6e9161`, RN-02]** Ausência de qualquer envio de credenciais por e-mail continua sendo a decisão de produto vigente (opção "a"), mas o texto da UI foi corrigido para não mais prometer um comportamento que o sistema não executa — reduzindo o risco de confusão tanto para o admin quanto para o usuário-alvo. | UX / Suporte |
| RNF-03 | A senha escolhida pelo próprio System Admin nunca expira (RN-03 apenas força a troca no primeiro acesso, não impõe complexidade) — risco de segurança leve se o admin reutilizar senhas previsíveis/fracas ao criar múltiplos usuários (nenhuma validação de complexidade é aplicada além do mínimo de 6 caracteres do próprio Firebase Auth, RN-01). | Segurança |

---

## 11. Frequência de Uso
Ocasional — usado quando o `clinic_admin` de uma clínica não consegue ou não sabe adicionar seus próprios usuários (mecanismo equivalente, ainda não mapeado, em `clinic/users/page.tsx`), ou quando o suporte/System Admin precisa agir diretamente sobre uma clínica específica.

---

## 12. Casos de Uso Relacionados
- **UC-21 (Cadastrar Nova Clínica)**, **UC-22 (Editar, Desativar e Reativar Clínica)** e **UC-23 (Vincular, Alterar e Remover Consultor de uma Clínica)** — mesma tela (`admin/tenants/[id]/page.tsx`); este UC-39 fecha a última ação de negócio pendente daquela tela, resolvendo a pendência registrada em UC-22 (seção 14, item 3).
- **UC-02 (Aprovar Solicitação de Acesso)** é o mecanismo alternativo de criação de usuário — sempre cria um tenant novo, sempre gera senha aleatória + link de redefinição, sempre a partir de uma solicitação pendente (UC-01). Este UC-39, ao contrário, sempre usa um tenant já existente, sempre usa a senha escolhida pelo admin, e nunca depende de uma solicitação prévia.
- **UC-05 ("Aprovar Solicitação de Acesso" pela Própria Clínica)** já citava a rota `POST /api/users/create`, usada pelo próprio `clinic_admin` (`clinic/users/page.tsx`), como o mecanismo real e válido para adicionar usuários à própria clínica. Este UC-39 mapeia formalmente a variante da **mesma rota**, acionada pelo System Admin com `tenant_id_override` (RN-07), distinta por não depender de o chamador pertencer à clínica-alvo.
- **UC-40 (Criar Usuário para a Própria Clínica)** — agora mapeado — é o equivalente exato deste mecanismo do lado do `clinic_admin`, sem `tenant_id_override`, restrito ao próprio tenant do chamador (RN-07 daquele UC). UC-40 confirma um achado adicional que não se aplica a este UC-39: do lado da clínica, não existe nenhuma forma de editar, desativar/reativar ou redefinir senha de um usuário já existente — apenas criar e listar.
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** agora **é** acionado por este fluxo, desde a correção de RN-03 (commit `467f462`) — mesmo padrão de UC-28. Antes da correção (v1.0/v1.1), este UC-39 era o único caminho de criação de usuário que nunca acionava UC-06.
- **UC-28 (Cadastrar Consultor)** é o UC comparável mais próximo em estrutura (criação de conta por um admin, com senha temporária). Desde a correção de RN-03 (commit `467f462`), este UC-39 replica o comportamento `requirePasswordChange: true` de UC-28; a diferença remanescente é que UC-28 também envia um e-mail contendo a senha temporária, enquanto este UC-39 continua sem enviar credenciais por e-mail — decisão de produto confirmada (RN-02, opção "a", commit `f6e9161`).
- **UC-36 (Editar Usuário e Alterar Status Cross-Tenant)** é o UC irmão de "Gestão de Usuários" que cobre a edição de usuários já existentes — este UC-39 cobre exclusivamente a criação.

---

## 13. Referências
- `src/app/(admin)/admin/tenants/[id]/page.tsx` (seção "Usuários da Clínica", `handleCreateUser`, diálogo "Adicionar Novo Usuário" — texto corrigido no commit `f6e9161`, RN-02)
- `src/app/api/users/create/route.ts` (linhas alteradas pelo commit `467f462` — `requirePasswordChange: true` nas custom claims e no `userDoc`, RN-03)
- `functions/src/onUserCreated.ts` (trigger `onDocumentCreated` em `users/{userId}`)
- `functions/src/services/emailService.ts` (`sendWelcomeEmail` — RN-02)
- `src/types/index.ts` (`User`, `UserRole`, `CustomClaims`)
- `firestore.rules` (`users/{userId}`)
- Commit da correção: `f6e9161` (`fix: tres itens de alta severidade (UC-32, UC-04, UC-39)`) — corrige o texto do `DialogDescription` em `admin/tenants/[id]/page.tsx` (RN-02, decisão do PO pela opção "a")

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RESOLVIDO no commit `f6e9161` — decisão do PO]** RN-02, achado crítico: o texto do diálogo prometia o envio de credenciais por e-mail, o que não ocorria. Das duas alternativas registradas (a: corrigir o texto da UI; b: implementar envio de senha em texto plano por e-mail), o PO optou pela **opção (a)**, por segurança — implementada no commit `f6e9161`, que corrigiu o `DialogDescription` para deixar claro que a senha não é enviada por e-mail e deve ser comunicada por fora do sistema.
2. **[RESOLVIDO em v1.2 — commit `467f462`]** RN-03 — implementado: `requirePasswordChange: true` agora é definido tanto nas custom claims quanto no documento `users/{uid}`, alinhando este fluxo ao padrão já usado em UC-02/UC-28. O usuário criado por este caminho agora aciona UC-06 no primeiro acesso.
3. **[RN-05]** Não confirmado pelo usuário se a API deveria bloquear a criação de usuários em clínicas desativadas.
4. **[RN-01]** Ausência de validação client-side no diálogo (nenhum campo obrigatório/comprimento mínimo) — avaliação de necessidade de correção não solicitada até o momento.
5. **[Nota de rastreabilidade — resolvida]** O caminho equivalente usado pelo próprio `clinic_admin` (`clinic/users/page.tsx`, mesma rota, sem `tenant_id_override`) foi mapeado como **UC-40 (Criar Usuário para a Própria Clínica)**.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `admin/tenants/[id]/page.tsx` (`handleCreateUser`, diálogo "Adicionar Novo Usuário") e `api/users/create/route.ts`. Resolve a pendência registrada em UC-22 (seção 14, item 3). Documenta o mecanismo de criação direta de usuário pelo System Admin para qualquer clínica, via `tenant_id_override` — mesma rota de backend usada pelo `clinic_admin` em seu próprio fluxo de auto-cadastro (ainda não mapeado, UC-05). Achados críticos: o texto da UI promete envio de credenciais por e-mail que não ocorre de fato — o e-mail disparado pelo trigger `onUserCreated` é genérico e nunca inclui a senha (RN-02); o usuário criado nunca recebe a claim `requirePasswordChange`, diferente de UC-02/UC-28 (RN-03); a API não verifica se o tenant está ativo antes de permitir a criação (RN-05); e nenhuma validação client-side existe no diálogo (RN-01). Confirmado que a checagem de limite de usuários usa a fonte de dado correta (coleção raiz `users`, RN-04), sem o bug de UC-05 (`getTenantLimits`). |
| 1.1 | 15/07/2026 | Guilherme Scandelari | Correção pontual: resolvida a nota de rastreabilidade pendente (item 5, seção 14) — o caminho equivalente do lado do `clinic_admin` foi mapeado como **UC-40 (Criar Usuário para a Própria Clínica)**. Seção 12 e seção 14 atualizadas com a referência cruzada. |
| 1.2 | 18/07/2026 | Guilherme Scandelari | RN-03 marcada como `[CORRIGIDO]`, citando o commit `467f462` ("fix: dois itens de alta severidade (UC-50, UC-39)") — `POST /api/users/create` agora define `requirePasswordChange: true` nas custom claims e no documento `users/{uid}`, obrigando o usuário criado a trocar a senha escolhida pelo System Admin no primeiro acesso (aciona UC-06), alinhando este fluxo ao padrão já usado em UC-02/UC-28. Seções 4.1, 6 (passos 13-14), 9 (RN-03), 10 (RNF-03), 12 (relacionados) e 14 (item 2) atualizadas de acordo. |
| 1.2.1 | 20/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-39-RN-02), decisão do PO pela opção (a): o texto do diálogo "Adicionar Novo Usuário", que prometia "O usuário receberá as credenciais por email" apesar de o e-mail real nunca incluir a senha, foi corrigido no commit `f6e9161` para "Crie um novo usuário para esta clínica. A senha definida aqui não é enviada por e-mail — comunique-a ao usuário por fora do sistema. Ele será solicitado a trocá-la no primeiro acesso." Atualizados resumo de Pós-condição 4.1, passo 3 do Fluxo Principal, RN-02 (marcado `[CORRIGIDO]`, com a decisão do PO documentada), RNF-02, Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
