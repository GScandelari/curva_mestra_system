# UC-04: Fazer Login com Redirecionamento por Papel

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Autenticação
**Versão:** 1.1.1

> Um usuário já cadastrado e aprovado (system_admin, clinic_admin, clinic_user ou clinic_consultant) autentica-se com email e senha e é redirecionado automaticamente para a área correta do sistema, passando antes por checagens de aprovação/ativação, troca de senha obrigatória e status da clínica.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Usuario([👤 Usuário registrado e ativo\nsystem_admin / clinic_admin /\nclinic_user / clinic_consultant])
    FirebaseAuth([🔧 Firebase Auth])
    Firestore([🔧 Firestore - tenants])

    subgraph Sistema["Curva Mestra"]
        UC02(("UC-02\nAprovar Solicitação\nde Acesso"))
        UC04(("UC-04\nFazer Login com\nRedirecionamento por Papel"))
    end

    Usuario --> UC04
    UC04 -.->|autentica e obtém custom claims| FirebaseAuth
    UC04 -.->|verifica status da clínica| Firestore
    UC02 -->|pré-condição: conta aprovada e ativa| UC04
```

---

## 2. Atores

### 2.1 Ator Primário
**Usuário registrado e ativo no sistema** — qualquer um dos roles `system_admin`, `clinic_admin`, `clinic_user` ou `clinic_consultant`. O mecanismo de autenticação é idêntico para todos; o que varia é o redirecionamento pós-login e algumas checagens intermediárias, tratadas como variação dentro deste mesmo fluxo (mesmo padrão adotado em UC-01 para tipos de conta).

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth:** autentica email/senha (`signInWithEmailAndPassword`) e emite o ID token com os custom claims (`tenant_id`, `role`, `is_system_admin`, `active`, `requirePasswordChange`, etc.).
- **Firestore (coleção `tenants`):** consultado para verificar se a clínica do usuário está ativa antes de liberar o acesso.

---

## 3. Pré-condições
- O usuário possui uma conta já criada no Firebase Auth, com custom claims definidas (via UC-02 — aprovação de solicitação — ou por outro fluxo administrativo, ex.: cadastro de consultor).
- O usuário conhece seu e-mail e sua senha atual (definitiva ou temporária).
- Para `clinic_consultant`, o `tenant_id` da claim é tipicamente `null` (atuação multi-tenant via `authorized_tenants`), o que o exclui, na prática, da checagem de clínica ativa do passo 8.
- (Contextual) O usuário pode chegar a `/login` após um timeout de sessão por inatividade de 15 minutos, mecanismo externo (`useSessionTimeout`, não mapeado como UC nesta documentação). Esse valor de 15 minutos é fixo (hardcoded) no próprio `useSessionTimeout.ts` — não é lido de nenhuma configuração administrativa (ver RN-07).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Existe uma sessão Firebase Auth ativa para o usuário, com o ID token forçado a refresh (`getIdToken(true)`) para refletir custom claims atualizadas.
- O usuário é redirecionado para exatamente um destino, de acordo com o estado de suas claims e do tenant: `/waiting-approval`, `/change-password`, a própria tela `/login` (com mensagem inline e sessão encerrada), `/clinic/my-clinic`, `/admin/dashboard`, `/clinic/dashboard`, ou `/dashboard` (com um salto adicional para `/consultant/dashboard` quando aplicável — ver Fluxo Alternativo 7b).

### 4.2 Falha (Garantias Mínimas)
- Nenhuma sessão útil é estabelecida; o usuário permanece na tela `/login`.
- Uma mensagem de erro traduzida para português é exibida abaixo do formulário.

---

## 5. Gatilho (Trigger)
O usuário acessa `/login` e submete o formulário com email e senha. (Variações de entrada nesta mesma tela — usuário já autenticado, ou chegada por timeout de sessão — são tratadas nos Fluxos Alternativos.)

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário acessa `/login`.
2. Sistema exibe o formulário de login (campos de email e senha) e os links "Esqueceu a senha?" e "Registrar-se".
3. Usuário preenche email e senha e clica em "Entrar".
4. Sistema chama `signIn(email, password)`, que invoca `signInWithEmailAndPassword` do Firebase Auth.
5. Sistema força o refresh do ID token (`getIdToken(true)`) e obtém os custom claims atualizados (`getIdTokenResult()`).
6. Sistema verifica `claims.role` e `claims.active` — ambos presentes e verdadeiros (fluxo feliz).
7. Sistema verifica `claims.requirePasswordChange` — ausente ou `false` (fluxo feliz).
8. Sistema verifica se o usuário não é `system_admin` e possui `tenant_id`; nesse caso, lê o documento `tenants/{tenant_id}` no Firestore e confirma que `active !== false` (clínica ativa).
9. Sistema redireciona por role: `is_system_admin` → `/admin/dashboard`; `role === "clinic_admin"` ou `role === "clinic_user"` → `/clinic/dashboard`; qualquer outro role (inclui `clinic_consultant`) → `/dashboard` (ver Fluxo Alternativo 7b para o caso de `clinic_consultant`).
10. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Usuário já autenticado acessa /login diretamente (a partir do passo 1)
1. Sistema detecta, via `useEffect` que observa `useAuth()`, que `isAuthenticated` e `claims` já estão disponíveis, sem que o usuário submeta o formulário.
2. Sistema verifica **apenas** `claims.requirePasswordChange`; se `true`, redireciona para `/change-password` e o caso de uso é encerrado.
3. Caso contrário, sistema redireciona diretamente por role (mesma lógica do passo 9), **sem repetir** as checagens de `role`/`active` (passo 6) nem a de clínica suspensa (passo 8) — ver gap confirmado na seção 14.
4. Caso de uso é encerrado.

### 7b. Redirecionamento em dois saltos para clinic_consultant (a partir do passo 9)
1. Usuário com role `clinic_consultant` chega a `/dashboard` — uma página originalmente de depuração/debug, não uma tela de destino final.
2. A página `/dashboard`, ao montar, verifica novamente `isAuthenticated` e `claims` via `useAuth()`.
3. Sistema detecta `claims.role === "clinic_consultant"` e redireciona para `/consultant/dashboard`.
4. Caso de uso é concluído com sucesso, com um salto adicional em relação aos demais roles (ver nota de gap na seção 14).

### 7c. Alerta de sessão expirada por timeout (a partir do passo 1)
1. Usuário chega a `/login?timeout=true`, redirecionado por um mecanismo externo de timeout de inatividade (15 minutos, `useSessionTimeout`, que já efetuou `signOut` antes do redirecionamento — não mapeado como UC nesta documentação).
2. Sistema exibe um alerta informativo acima do formulário: "Sua sessão expirou por inatividade. Por favor, faça login novamente."
3. Retorna ao passo 2 do Fluxo Principal (formulário exibido normalmente).

---

## 8. Fluxos de Exceção

### 8a. Credenciais inválidas ou erro do Firebase Auth (a partir do passo 4)
1. Firebase Auth retorna um erro (ex.: `wrong-password`, `invalid-credential`, `user-not-found`, `too-many-requests`, `network-request-failed`, `invalid-email`, ou outro código não mapeado).
2. Sistema traduz o erro para português (ver RN-06) e o exibe em destaque vermelho abaixo do formulário.
3. Nenhum redirecionamento ocorre; usuário permanece em `/login`.
4. Caso de uso retorna ao passo 3.

### 8b. Usuário sem role definida ou inativo (a partir do passo 6)
1. Sistema detecta `!claims.role || !claims.active`.
2. Sistema redireciona para `/waiting-approval` — a mesma tela usada tanto para quem aguarda a primeira aprovação (pós-UC-01) quanto para quem foi desativado posteriormente por um admin (ver nota na seção 14).
3. Caso de uso é encerrado, sem acesso liberado a nenhuma área do sistema.

### 8c. Senha temporária pendente de troca (a partir do passo 7)
1. Sistema detecta `claims.requirePasswordChange === true`.
2. Sistema redireciona para `/change-password`.
3. Caso de uso é encerrado nesta etapa — a troca de senha em si é fora do escopo deste UC.

### 8d. Clínica inativa/suspensa — role clinic_user (a partir do passo 8)
1. Sistema lê `tenants/{tenant_id}` e confirma que `active === false` (explicitamente falso; a ausência do campo é tratada como clínica ativa).
2. Como o role é `clinic_user`, o sistema efetua `signOut()` do usuário e exibe, na própria tela `/login`, o card "Sistema Indisponível", com a mensagem: "O sistema encontra-se indisponível no momento. Procure o administrador da clínica ou entre em contato com o suporte técnico Curva Mestra." e o e-mail `suporte@curvamestra.com.br`.
3. Usuário pode clicar em "Voltar ao login" para limpar o estado e tentar novamente (retorna ao passo 2 do Fluxo Principal).
4. Caso de uso é encerrado, sem acesso liberado.

### 8e. Clínica inativa/suspensa — role clinic_admin (a partir do passo 8)
1. Sistema lê `tenants/{tenant_id}` e confirma a mesma condição `active === false`.
2. Como o role é `clinic_admin`, o sistema redireciona para `/clinic/my-clinic` (sem `signOut`) — presumivelmente para que o próprio admin visualize/gerencie o status da clínica.
3. Caso de uso é encerrado, com o usuário redirecionado a uma tela de gestão específica, diferente do bloqueio total aplicado ao `clinic_user`.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A checagem de `role`/`active` (passo 6) tem prioridade sobre todas as demais — mesmo com credenciais corretas, a ausência de `role` ou `active: false` bloqueia o acesso a qualquer dashboard, redirecionando para `/waiting-approval`. | Garante que apenas contas plenamente aprovadas e ativadas por um admin (ver UC-02) acessem o sistema. |
| RN-02 | A checagem de `requirePasswordChange` (passo 7) tem prioridade sobre a checagem de clínica ativa/suspensa (passo 8) — um usuário com senha temporária pendente é sempre enviado para `/change-password` antes de qualquer verificação do status da clínica. | Impede o uso prolongado de uma senha temporária, mesmo que a clínica esteja com problemas de status. |
| RN-03 | A verificação de clínica ativa (passo 8) só ocorre para usuários com `tenant_id` definido e que não sejam `system_admin` — isso exclui tanto `system_admin` (sem `tenant_id`) quanto, na prática, `clinic_consultant` (cujo `tenant_id` costuma ser `null`, atuando sobre múltiplos tenants via `authorized_tenants`). | System Admin e consultores operam fora do contexto de uma única clínica. |
| RN-04 | O tratamento de clínica inativa é diferenciado por role: `clinic_user` é desconectado e bloqueado com mensagem informativa (sem acesso a nenhuma tela do sistema); `clinic_admin` é redirecionado para `/clinic/my-clinic`, mantendo acesso a uma tela específica. | Permite que o responsável pela clínica (`clinic_admin`) tenha visibilidade/ação sobre a própria suspensão, enquanto usuários comuns ficam bloqueados. |
| RN-05 | `requirePasswordChange` é uma custom claim distinta do link de redefinição de senha gerado na aprovação inicial (UC-02, RN-03). Ela é setada manualmente por um System Admin ao redefinir a senha de um usuário ou consultor já existente (`/api/users/{id}/set-password`, `/api/consultants/{id}/set-password`), não pelo fluxo de aprovação em si. | São dois mecanismos distintos de "senha temporária", com origens e telas de destino diferentes (link de redefinição do Firebase vs. tela própria `/change-password`) — importante não confundir os dois. |
| RN-06 | Mensagens de erro de autenticação são traduzidas para português a partir do código de erro do Firebase Auth (ver Fluxo de Exceção 8a), com fallback para a mensagem original do Firebase (ou uma mensagem genérica) quando o código não é reconhecido. | Usabilidade — evita expor mensagens técnicas em inglês ao usuário final. |
| RN-07 | **[Achado crítico, confirmado em UC-35]** O timeout de sessão por inatividade citado nas Pré-condições (`useSessionTimeout.ts`, 15 minutos) usa uma constante fixa (`hardcoded`) no próprio código — não lê o campo `session_timeout_minutes` do documento `system_settings/global` (tela "Configurações do Sistema", UC-35). Alterar esse valor naquela tela administrativa não tem, hoje, nenhum efeito sobre o tempo real de expiração de sessão de nenhum usuário. | Confirmado por leitura completa de `src/hooks/useSessionTimeout.ts` (`const sessionTimeoutMinutes = 15;`, sem leitura de Firestore) e por busca exaustiva no código-fonte, documentada em UC-35 (RN-06). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | O ID token é sempre forçado a refresh (`getIdToken(true)`) tanto no login quanto no listener `onAuthStateChanged` de `useAuth`, garantindo que custom claims alteradas recentemente (ex.: aprovação, mudança de role) sejam refletidas já no primeiro carregamento pós-alteração. | Segurança |
| RNF-02 | O acesso a qualquer dashboard depende de `tenant_id` + `role` + `active` corretos nas custom claims, checados no fluxo de submissão do login. Nem o caminho de "usuário já autenticado acessa /login" (Fluxo Alternativo 7a) nem o `ProtectedRoute.tsx` (que protege as páginas internas) repetem as checagens de `requirePasswordChange` e de clínica suspensa — ver gap confirmado na seção 14. | Multi-tenant / Segurança |
| RNF-03 | O e-mail de suporte (`suporte@curvamestra.com.br`) está fixo (hardcoded) na tela de clínica inativa exibida ao `clinic_user`. | Usabilidade |

---

## 11. Frequência de Uso
Muito alta — ocorre a cada sessão de uso do sistema, por qualquer usuário, potencialmente múltiplas vezes ao dia (incluindo retornos após timeout de sessão por inatividade).

---

## 12. Casos de Uso Relacionados
- **UC-02 (Aprovar Solicitação de Acesso)** é pré-condição indireta: só é possível fazer login com sucesso e liberar o acesso após a aprovação criar o usuário no Firebase Auth com claims válidas (`role`, `active`).
- **UC-35 (Editar Configurações Globais do Sistema)** — a tela administrativa daquele UC expõe um campo "Tempo de sessão (minutos)" (`session_timeout_minutes`) que, por sua descrição, sugere controlar o timeout de inatividade citado nas Pré-condições deste UC-04. **Não há, hoje, uma relação funcional real entre os dois**: `useSessionTimeout.ts` usa um valor fixo de 15 minutos, ignorando o que é configurado naquela tela (RN-07) — a relação existe apenas como intenção de produto ainda não implementada.
- Não há relação formal `<<include>>`/`<<extend>>` com um eventual UC de "Trocar Senha Obrigatória" ou "Expirar Sessão por Inatividade" — esses fluxos existem no código (`/change-password`, `useSessionTimeout`), mas ainda não foram mapeados como casos de uso formais nesta documentação (ver seção 14).

---

## 13. Referências
- `src/app/(auth)/login/page.tsx`
- `src/hooks/useAuth.ts`
- `src/app/(auth)/change-password/page.tsx`
- `src/app/(auth)/waiting-approval/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/hooks/useSessionTimeout.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/types/index.ts` (interfaces `CustomClaims`, `UserRole`, `Tenant`, `SuspensionInfo`)
- `src/app/api/users/[id]/set-password/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts` (origem da claim `requirePasswordChange`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

**[Gap confirmado — não confirmado como escopo de correção]** O redirecionamento por role em `/login` (`redirectByRole`) não possui um branch direto para `clinic_consultant`; esse role cai no `else` genérico e é enviado para `/dashboard` (uma página originalmente de depuração/debug), que só então o redireciona para `/consultant/dashboard`. Isso gera um salto duplo desnecessário especificamente para este role, diferente do salto único de `system_admin` e `clinic_admin`/`clinic_user`. **Achado adicional, confirmado por leitura de `src/components/auth/ProtectedRoute.tsx`:** a função `redirectToDashboard()` desse componente **já possui** um branch direto `clinic_consultant` → `/consultant/dashboard` — ou seja, a lógica correta de redirecionamento direto já existe em outro ponto do sistema, mas não foi replicada em `redirectByRole` no `/login`. Isso confirma que o salto duplo é uma inconsistência entre dois trechos de código que fazem a mesma coisa de forma diferente, não uma limitação técnica. Não confirmado pelo usuário como item a corrigir nesta rodada; registrado aqui como observação (documentado como está no Fluxo Alternativo 7b).

**[As-is, sem proposta de correção]** A tela `/waiting-approval` é reaproveitada tanto para o cenário de "aguardando primeira aprovação" (pós-UC-01) quanto para "conta desativada posteriormente por um admin" — ambos exibem a mesma mensagem, que não reflete literalmente a segunda situação. Documentado como comportamento atual (Fluxo de Exceção 8b).

**[Gap confirmado de segurança/consistência]** Investigado `src/components/auth/ProtectedRoute.tsx` — componente que protege todas as rotas internas do app (fora de `/login`). Seu `useEffect` faz apenas estas checagens: (1) `!user` → `/login`; (2) `user && !claims` → `/waiting-approval`; (3) `claims.active === false` → `/waiting-approval`; (4) role fora de `allowedRoles` → `redirectToDashboard(role)`. **Ele não verifica `claims.requirePasswordChange` em nenhum momento, e não verifica o status da clínica (`tenants/{tenant_id}`) em nenhum momento.** Ou seja, as checagens de senha temporária pendente (passo 7 / RN-02) e de clínica suspensa (passo 8 / RN-03, RN-04) existem **apenas** no fluxo de submissão do formulário em `/login` (Fluxo Principal) — um usuário com uma sessão Firebase já ativa (token válido, sessão restaurada pelo app) que navegue diretamente para qualquer página protegida, sem passar pelo formulário de login, **não é bloqueado** por senha temporária pendente nem por clínica suspensa. Este é um gap real de segurança/consistência, confirmado por leitura direta do código (não mais uma hipótese não investigada). Não foi confirmado pelo usuário como escopo de correção nesta rodada de documentação; registrado aqui para avaliação e priorização futura.

**[RN-07, decisão de produto pendente]** O campo `session_timeout_minutes` (tela de Configurações do Sistema, UC-35) não é lido por `useSessionTimeout.ts` — decisão pendente sobre se essa leitura deveria ser implementada (tornando o timeout de sessão configurável de fato), ou se o campo deveria ser removido da tela de configurações caso o valor fixo de 15 minutos seja a decisão de produto definitiva.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial, mapeada a partir da leitura direta de `login/page.tsx`, `useAuth.ts`, `change-password/page.tsx`, `waiting-approval/page.tsx`, `dashboard/page.tsx` e `useSessionTimeout.ts`. Corrigidas duas suposições do levantamento inicial que não se confirmaram no código: (1) não existem rotas `/suspended/admin` ou `/suspended/user` — documentado o comportamento real (mensagem inline + `signOut` para `clinic_user`; redirecionamento para `/clinic/my-clinic` para `clinic_admin`); (2) o redirecionamento de `clinic_consultant` não é direto — passa por `/dashboard` antes de chegar a `/consultant/dashboard` (sinalizado como possível gap na seção 14). |
| 1.1 | 13/07/2026 | Guilherme Scandelari | Investigado `src/components/auth/ProtectedRoute.tsx` (adicionado às Referências) para fechar a pendência sobre a assimetria de checagens entre o fluxo de submissão do login e o acesso direto a páginas protegidas. Confirmado: a pendência deixou de ser uma "observação de risco não investigado" e passou a ser um **gap real confirmado** — `ProtectedRoute.tsx` não verifica `requirePasswordChange` nem o status da clínica em nenhuma rota interna do app. Confirmado também que `ProtectedRoute.tsx` já possui um branch direto para `clinic_consultant` em `redirectToDashboard()` (diferente de `redirectByRole` do `/login`, que não tem esse branch) — mencionado na pendência sobre o salto duplo do consultor como uma inconsistência entre os dois pontos de redirecionamento do sistema. |
| 1.1.1 | 15/07/2026 | Guilherme Scandelari | Correção pontual: adicionada RN-07 e nota em "Casos de Uso Relacionados" documentando o achado crítico confirmado em UC-35 (Editar Configurações Globais do Sistema) — o campo `session_timeout_minutes` daquela tela administrativa não é lido por `useSessionTimeout.ts`, que usa um valor fixo de 15 minutos hardcoded. Atualizada também a nota contextual das Pré-condições. Nenhuma mudança de escopo ou reestruturação; apenas referência cruzada a um achado já investigado e documentado em UC-35. |
