# UC-37: Definir Senha do Usuário Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Gestão de Usuários)
**Versão:** 1.0.2

> Um System Admin, no mesmo diálogo "Editar Usuário" (`admin/users/page.tsx`, seção "Definir Senha Manualmente"), define uma nova senha diretamente para um usuário (`clinic_admin`/`clinic_user`) de qualquer clínica — sem envio de e-mail, sem exigir reautenticação, aplicada imediatamente via Firebase Admin SDK. É o mecanismo "de suporte" da tela, para quando o sistema de e-mail falha, ao lado de "Redefinir Senha via Link" (coberto por UC-08). Equivalente exato, para usuários de clínica, do UC-30 (consultores).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC37(("UC-37\nDefinir Senha do Usuário\nManualmente"))
        UC06(("UC-06\nTrocar Senha Obrigatória\n(mecanismo irmão, se marcado)"))
        UC08(("UC-08\nRedefinir Senha via Link\n(mesma tela, caminho alternativo)"))
        UC36(("UC-36\nEditar Usuário e Alterar Status\n(mesma tela)"))
    end

    SystemAdmin --> UC37
    UC37 -.->|define senha diretamente,\nsem exigir reautenticação| FirebaseAuth[(Firebase Auth)]
    UC37 -.->|se checkbox marcada,\nseta requirePasswordChange: true| UC06
    UC08 -.->|mesma tela,\nseção "Redefinir Senha"| UC37
    UC36 -.->|mesmo diálogo\n"Editar Usuário"| UC37
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']`.

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth** — atualização da senha (`adminAuth.updateUser`) e dos custom claims (`adminAuth.setCustomUserClaims`), inteiramente via Admin SDK, server-side.
- **Usuário-alvo** (`clinic_admin`/`clinic_user`) — não é notificado por nenhum canal automático desta ação (RN-04); passa a depender da nova senha ser comunicada a ele fora do sistema.

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`.
- Existe um usuário com o id informado, cujo `role` **não** é `system_admin` (RN-02, bloqueio explícito no backend).
- O usuário possui uma conta correspondente no Firebase Auth (todo usuário listado em `admin/users` foi criado via `/api/users/create`, que sempre cria a conta Auth junto com o documento Firestore — ver UC-36, seção 13).

---

## 4. Pós-condições

### 4.1 Sucesso
- A senha do usuário é atualizada no Firebase Auth (`adminAuth.updateUser(userId, { password })`).
- Os custom claims do usuário são atualizados: se "Solicitar troca de senha no próximo login" estiver marcada, `requirePasswordChange: true` é mesclado aos claims existentes (acionando UC-06 no próximo login); se desmarcada, a chave `requirePasswordChange` é removida dos claims (não apenas setada para `false`).
- O documento `users/{uid}` é atualizado: `requirePasswordChange` (espelhando a opção escolhida, com fallback `?? false`), `passwordSetByAdminAt`, `passwordSetByAdmin` (uid do admin), `updated_at`.
- **Nenhum e-mail ou notificação é enviado** ao usuário — a nova senha só é conhecida pelo admin que a digitou (RN-04).
- Sistema exibe a confirmação de sucesso retornada pela API — mensagem diferenciada conforme `requirePasswordChange` (RN-03, corrigido) — e limpa os campos de senha do formulário.

### 4.2 Falha (Garantias Mínimas)
- Se a validação de senha (client ou server) falhar: nenhuma alteração é feita.
- Se o usuário-alvo tiver `role === 'system_admin'`: nenhuma alteração é feita (bloqueio explícito).
- Se `adminAuth.updateUser` falhar: nenhuma alteração é feita — a atualização da senha no Auth ocorre antes da atualização dos claims e do documento `users`, sem risco de estado parcialmente aplicado entre essas duas últimas etapas e uma senha não atualizada. O cliente recebe uma mensagem genérica de erro (RN-06, corrigido); o erro real é registrado apenas no log do servidor.

---

## 5. Gatilho (Trigger)
System Admin, no diálogo "Editar Usuário" (`/admin/users`), seção "Definir Senha Manualmente", preenche "Nova Senha" e "Confirmar Senha" e clica em "Definir Senha".

---

## 6. Fluxo Principal (Basic Flow)

1. System Admin acessa `/admin/users`, clica em "Editar" na linha de um usuário e localiza, no diálogo aberto, a seção "Definir Senha Manualmente" (texto de ajuda: "Use para suporte quando o sistema de email falhar. A senha é definida imediatamente.").
2. Preenche "Nova Senha" (campo com botão de mostrar/ocultar texto) e "Confirmar Senha".
3. Decide se marca a checkbox "Solicitar troca de senha no próximo login" — vem **desmarcada por padrão** (`forcePasswordChange = false`, diferente do equivalente para consultores em UC-30, que vem marcada por padrão — RN-07).
4. Clica em "Definir Senha".
5. Sistema valida no client: `newPassword.length >= 6` (senão `alert('A senha deve ter no mínimo 6 caracteres.')`); `newPassword === confirmPassword` (senão `alert('As senhas não coincidem.')`).
6. Sistema chama `POST /api/users/{id}/set-password` com `{ password: newPassword, requirePasswordChange: forcePasswordChange }` e o Bearer token do admin.
7. API valida token e `decodedToken.is_system_admin` (403 se não for admin do sistema).
8. API revalida no servidor `password.length >= 6` (400 se inválido).
9. API busca o usuário pelo id em `users` (404 se não existir).
10. API verifica `userDoc.data()?.role === 'system_admin'`; se verdadeiro, retorna 403 (RN-02).
11. API chama `adminAuth.updateUser(userId, { password })`, definindo a nova senha diretamente no Firebase Auth — sem exigir reautenticação do usuário-alvo nem do admin, diferente do fluxo self-service de troca de senha (UC-06), que roda no client e depende de reautenticação recente.
12. API busca novamente o registro do usuário (`adminAuth.getUser`) para obter os custom claims atuais.
13. Se `requirePasswordChange` (opção marcada) for `true`: API mescla os claims existentes com `requirePasswordChange: true`. Se for `false`: API remove a chave `requirePasswordChange` dos claims existentes (via desestruturação) e grava o restante.
14. API atualiza `users/{uid}` com `requirePasswordChange` (`?? false`), `passwordSetByAdminAt`, `passwordSetByAdmin`, `updated_at`.
15. API retorna sucesso, com uma mensagem que varia conforme a opção escolhida.
16. Sistema exibe uma caixa de confirmação verde com a mensagem retornada pela API (novo state `passwordSuccessMessage`, preenchido com `data.message || 'Senha definida com sucesso!'`) — **[Corrigido no commit `ec31c27` — UC-37-RN-03]**, mesma correção aplicada em UC-30 (RN-03), no mesmo commit; limpa os campos "Nova Senha"/"Confirmar Senha".
17. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado — as duas variações possíveis (com ou sem exigência de troca no próximo login) fazem parte do próprio fluxo principal (passo 13), não configurando ramificações separadas de caminho.

---

## 8. Fluxos de Exceção

### 8a. Validação client-side falha (a partir do passo 5)
1. Senha com menos de 6 caracteres, ou confirmação diferente da senha.
2. Sistema exibe o `alert()` específico; nenhuma chamada à API é feita.

### 8b. Usuário não autenticado no client (a partir do passo 6)
1. `auth.currentUser` é `null` no momento da submissão.
2. Sistema exibe `alert('Você precisa estar autenticado para realizar esta ação')`; nenhuma chamada à API é feita.

### 8c. Token ausente/inválido ou sem permissão (a partir do passo 7)
1. Token ausente (401) ou usuário autenticado não é `system_admin` (403: "Apenas administradores do sistema podem definir senhas").
2. Sistema exibe `alert('Erro ao definir senha: {mensagem}')`; nenhuma alteração é feita.

### 8d. Usuário-alvo é system_admin (a partir do passo 10)
1. API detecta `userDoc.data()?.role === 'system_admin'`.
2. Retorna 403: "Não é permitido alterar senha de administradores do sistema".
3. Sistema exibe `alert()` com o erro; nenhuma alteração é feita.

### 8e. Usuário não encontrado (a partir do passo 9)
1. `id` não corresponde a nenhum documento em `users`.
2. API retorna 404 ("Usuário não encontrado"); sistema exibe `alert()` com o erro.

### 8f. Falha do Firebase Admin SDK ao atualizar a senha (a partir do passo 11)
1. `adminAuth.updateUser` lança uma exceção (ex.: UID inválido, senha rejeitada pelo Auth, erro interno do Firebase).
2. API captura no bloco `catch`, registra o erro real via `console.error('Erro ao definir senha:', error)` e retorna 500 com a mensagem genérica fixa `"Erro ao definir senha. Tente novamente."` — **[Corrigido no commit `53df743` — UC-37-RN-06]**, mesma correção aplicada à rota irmã de consultores em UC-30 (RN-06), no mesmo commit.
3. Sistema exibe `alert()` com a mensagem genérica recebida; nenhuma alteração é confirmada como feita.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O tamanho mínimo da senha (6 caracteres) é validado tanto no client quanto no server — mesmo padrão de dupla validação já observado em UC-06/UC-30. | Confirmado por leitura de `handleSetPassword` (client) e do handler `POST` (server). |
| RN-02 | Não é permitido definir senha de um usuário com `role: "system_admin"` através deste mecanismo — mesma restrição de segurança já documentada em UC-08 (RN-05) para o mecanismo de link, aplicada aqui ao mecanismo de definição direta. | Confirmado por leitura literal do handler `POST /api/users/[id]/set-password/route.ts` — checagem explícita antes de `adminAuth.updateUser`. |
| RN-03 | **[Corrigido no commit `ec31c27` — UC-37-RN-03]** A tela (`UsersManagementPage`, `src/app/(admin)/admin/users/page.tsx`) agora lê o campo `message` da resposta da API através de um novo state `passwordSuccessMessage` (preenchido com `data.message || 'Senha definida com sucesso!'`) e o exibe no lugar do texto fixo anterior. Mesma correção aplicada em UC-30 (RN-03), no mesmo commit. **Nota histórica:** até esta correção, a tela ignorava completamente o campo `message` da resposta e sempre exibia o texto estático "Senha definida com sucesso!", independentemente da opção marcada. | Confirmado por leitura de `handleSetPassword` — novo state `passwordSuccessMessage` preenchido com `data.message || 'Senha definida com sucesso!'` na resposta da API, e renderizado no lugar do texto fixo anterior (antes: apenas `setSetPasswordSuccess(true)`, texto fixo no JSX). |
| RN-04 | Esta ação não dispara nenhum e-mail nem qualquer outra notificação ao usuário — mesmo padrão já documentado para a rota irmã de consultores em UC-30 (RN-04) e mencionado em UC-06 (RN-05): o texto de ajuda da própria tela orienta usar este recurso "para suporte quando o sistema de email falhar". O admin precisa comunicar a nova senha ao usuário por fora do sistema. | Confirmado por leitura completa do handler — nenhuma escrita em `email_queue`; confirmado também pelo texto de ajuda na UI. |
| RN-05 | Diferente do fluxo self-service de troca de senha (UC-06), que roda inteiramente no client e exige reautenticação recente (`reauthenticateWithCredential`) antes de `updatePassword`, este mecanismo é executado inteiramente no server via Firebase Admin SDK (`adminAuth.updateUser`), sem qualquer prova de posse da senha atual — por design, já que é uma ação administrativa. | Confirmado por leitura comparada de `change-password/page.tsx` (UC-06) e `api/users/[id]/set-password/route.ts`. |
| RN-06 | **[Corrigido no commit `53df743` — UC-37-RN-06]** Em caso de erro inesperado no bloco `catch`, a rota agora retorna sempre a mensagem genérica fixa `"Erro ao definir senha. Tente novamente."` ao cliente — o erro real segue apenas para o log do servidor (`console.error('Erro ao definir senha:', error)`). Mesma correção aplicada à rota irmã de consultores em UC-30 (RN-06), no mesmo commit. **Nota histórica:** até esta correção, a rota retornava `error.message` bruto do backend ao cliente — mesmo achado então documentado em UC-30 (RN-06) para a rota irmã de consultores; ambas as rotas compartilhavam exatamente o mesmo padrão de tratamento de erro, menos cauteloso que o restante do módulo administrativo. | Confirmado por leitura literal do bloco `catch` da rota (`src/app/api/users/[id]/set-password/route.ts`, linhas 79-81) — `return NextResponse.json({ error: 'Erro ao definir senha. Tente novamente.' }, { status: 500 })`, sem interpolação de `error.message`. |
| RN-07 | **[Divergência confirmada frente ao UC-30]** A checkbox "Solicitar troca de senha no próximo login" vem **desmarcada por padrão** nesta tela (`forcePasswordChange = false`, setado em `handleEditUser`), enquanto o equivalente em `admin/consultants/[id]/page.tsx` (UC-30) vem **marcada por padrão** (`true`). Não há justificativa de negócio documentada no código para essa diferença de comportamento padrão entre os dois formulários equivalentes. | Confirmado por leitura comparada de `handleEditUser` (`admin/users/page.tsx`) e da inicialização do estado equivalente em `admin/consultants/[id]/page.tsx`. |
| RN-08 | Os campos `passwordSetByAdminAt` e `passwordSetByAdmin`, gravados ativamente no documento `users/{uid}` por esta rota, **não estão declarados** na interface `User` em `src/types/index.ts` (que define `passwordResetAt` e `passwordChangedAt`, mas não os dois campos acima) — mesma divergência tipo/persistência já documentada em UC-30 (RN-07) para a interface `Consultant`. | Confirmado por leitura completa da interface `User` frente aos campos realmente escritos pelo handler. |
| RN-09 | Assim como em UC-08 (RNF-03) e UC-30 (RN-08), apenas a solicitação mais recente de definição manual de senha é registrada (`passwordSetByAdminAt`/`passwordSetByAdmin` são sobrescritos a cada nova chamada) — não há histórico auditável de todas as vezes que a senha de um usuário foi definida manualmente. | Confirmado por leitura do handler — `update()` simples, sem acréscimo a nenhuma subcoleção/array de histórico. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Ausência de notificação ao usuário quando sua senha é definida manualmente pelo admin (RN-04) — mesmo risco de suporte já sinalizado para a rota irmã de consultores em UC-30. | UX / Suporte |
| RNF-02 | **[Resolvido no commit `53df743` — RN-06]** A exposição de `error.message` bruto do Firebase Admin SDK em respostas 500 foi eliminada — a rota agora sempre retorna uma mensagem genérica ao cliente, com o erro real preservado apenas no log do servidor. Mesma correção aplicada em UC-30 (RNF-02), no mesmo commit. | Segurança |
| RNF-03 | Divergência entre a interface `User` (TypeScript) e os campos realmente gravados no Firestore por esta rota (RN-08) — risco de manutenção/type-safety. | Manutenibilidade |
| RNF-04 | Todas as mensagens de erro/sucesso desta tela usam `alert()` nativo do navegador, sem componente de toast/notificação dedicado — mesma observação de UC-36 (RNF-03). | Consistência de UI |

---

## 11. Frequência de Uso
Ocasional — usado pelo System Admin como alternativa a "Redefinir Senha via Link" (UC-08) quando o sistema de e-mail está indisponível ou para suporte imediato a usuários de clínica.

---

## 12. Casos de Uso Relacionados
- **UC-36 (Editar Usuário e Alterar Status Cross-Tenant)** — mesmo diálogo "Editar Usuário" (`admin/users/page.tsx`); ação independente, na mesma tela.
- **UC-08 (System Admin Envia Link de Redefinição de Senha)** — mecanismo irmão, na mesma seção da tela: em vez de definir a senha diretamente, envia um e-mail com link seguro (rota `api/users/{id}/reset-password`, já coberta por UC-08). Os dois cobrem juntos toda a área de gerenciamento de senha do diálogo.
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** — mecanismo acionado quando a opção "Solicitar troca de senha no próximo login" é marcada (passo 13); UC-06 já apontava esta ação (rota `api/users/[id]/set-password`) como uma pendência de mapeamento futuro (v1.2, seção 14, item 4) — agora fechada por este UC-37.
- **UC-30 (Definir Senha do Consultor Manualmente)** — equivalente exato deste UC, para consultores em vez de usuários de clínica; mesma estrutura de API, com uma divergência de comportamento padrão confirmada (RN-07). Recebeu a correção equivalente de RN-06 (`error.message` bruto) no mesmo commit `53df743` (UC-30-RN-06), e a correção equivalente de RN-03 (mensagem de sucesso ignorada pela UI) no mesmo commit `ec31c27` (UC-30-RN-03).

---

## 13. Referências
- `src/app/(admin)/admin/users/page.tsx` (seção "Definir Senha Manualmente", `handleSetPassword`)
- `src/app/api/users/[id]/set-password/route.ts` (bloco `catch`, linhas 79-81 — ver RN-06)
- `src/types/index.ts` (`User` — RN-08)
- `firestore.rules` (`users/{userId}`)
- Commit da correção: `53df743` (`fix: lote de correções de baixa severidade (UC-04, UC-08, UC-30, UC-37, UC-47)`) — remove `error.message` bruto da resposta 500 (RN-06)
- Commit da correção: `ec31c27` (`fix: segundo lote de correções de baixa severidade (UC-22, UC-30, UC-37, UC-38, UC-41)`) — UI passa a exibir a mensagem diferenciada retornada pela API (RN-03)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-03]** A UI ignora a mensagem diferenciada retornada pela API quando `requirePasswordChange` é marcado — decisão de produto pendente sobre exibir uma confirmação distinta nesse caso, mesma pendência já registrada em UC-30.~~ **[RESOLVIDO no commit `ec31c27` — UC-37-RN-03]** A tela agora exibe a mensagem diferenciada retornada pela API (`data.message`), através do novo state `passwordSuccessMessage`. Mesma correção aplicada em UC-30, no mesmo commit.
2. ~~**[RN-06]** Exposição de `error.message` bruto do Firebase Admin SDK em erros 500 — decisão pendente sobre padronizar para uma mensagem genérica.~~ **[RESOLVIDO no commit `53df743` — UC-37-RN-06]** A rota passou a retornar sempre a mensagem genérica fixa "Erro ao definir senha. Tente novamente.", com o erro real preservado apenas no log do servidor. Mesma correção aplicada em UC-30, no mesmo commit.
3. **[RN-07]** Divergência de comportamento padrão da checkbox "Solicitar troca de senha no próximo login" entre esta tela (desmarcada por padrão) e a equivalente de consultores/UC-30 (marcada por padrão) — não confirmado pelo usuário se essa diferença é intencional ou um descuido de implementação.
4. **[RN-08]** Divergência entre a interface `User` e os campos realmente persistidos (`passwordSetByAdminAt`, `passwordSetByAdmin`) — decisão pendente sobre atualizar o tipo TypeScript.
5. **[RN-09]** Ausência de histórico auditável de definições manuais de senha (apenas a mais recente é registrada) — mesma lacuna já observada em UC-08/UC-30; avaliação de necessidade de correção não solicitada até o momento.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `api/users/[id]/set-password/route.ts` e da seção "Definir Senha Manualmente" em `admin/users/page.tsx`. Documenta o mecanismo de definição direta de senha para usuários de clínica, equivalente exato do UC-30 (consultores), com a mesma estrutura de API (bloqueio de alvo `system_admin`, RN-02; atualização de claims e Firestore; ausência de notificação, RN-04). Achados: a UI ignora a mensagem diferenciada de sucesso retornada pela API (RN-03, igual UC-30); erros 500 expõem `error.message` bruto do SDK (RN-06, igual UC-30); a interface `User` não declara os campos de auditoria realmente gravados por esta rota (RN-08, mesmo padrão de UC-30 RN-07); divergência confirmada de comportamento padrão da checkbox de troca obrigatória frente ao equivalente de consultores (RN-07, achado específico deste UC, não presente em UC-30). Fecha, junto com UC-36, o módulo "Admin — Gestão de Usuários" e o Portal Admin (`system_admin`) como um todo. |
| 1.0.1 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-37-RN-06): o bloco `catch` da rota `POST /api/users/{id}/set-password` deixou de retornar `error.message` bruto do Firebase Admin SDK e passou a retornar sempre a mensagem genérica fixa "Erro ao definir senha. Tente novamente." — corrigido no commit `53df743`, mesmo commit que aplicou a correção idêntica em UC-30 (RN-06); o erro real continua sendo registrado via `console.error`, apenas no log do servidor. Atualizados Pós-condição 4.2, Fluxo de Exceção 8f, RN-06 (marcado `[Corrigido]`), RNF-02 (marcado `[Resolvido]`), referências (Seção 13), cross-reference a UC-30 na Seção 12, e item 2 da Seção 14 (marcado `[RESOLVIDO]`). |
| 1.0.2 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-37-RN-03): a tela `UsersManagementPage` (`src/app/(admin)/admin/users/page.tsx`) passou a ler o campo `message` retornado pela API `POST /api/users/{id}/set-password`, através de um novo state `passwordSuccessMessage` (`data.message || 'Senha definida com sucesso!'`), em vez do texto fixo estático anterior — corrigido no commit `ec31c27`, mesmo commit que aplicou a correção idêntica em UC-30 (RN-03). Atualizados Pós-condição 4.1, Fluxo Principal (passos 15-16), RN-03 (marcado `[Corrigido]`), cross-reference a UC-30 na Seção 12, referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
