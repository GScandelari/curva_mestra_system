# UC-30: Definir Senha do Consultor Manualmente

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Gestão de Consultores)
**Versão:** 1.1.2

> Um System Admin, na mesma tela de detalhe do consultor (`admin/consultants/[id]/page.tsx`, seção "Gerenciamento de Senha"), define uma nova senha diretamente — sem envio de e-mail, sem exigir reautenticação, aplicada imediatamente via Firebase Admin SDK. É o mecanismo "de suporte" da tela, para quando o sistema de e-mail falha, ao lado de "Redefinir Senha via Link" (coberto por UC-08). Opcionalmente, o admin pode marcar a senha definida para expirar no próximo login, acionando o mecanismo de troca obrigatória (UC-06).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC31(("UC-30\nDefinir Senha do Consultor\nManualmente"))
        UC06(("UC-06\nTrocar Senha Obrigatória\n(mecanismo irmão, se marcado)"))
        UC08(("UC-08\nRedefinir Senha via Link\n(mesma tela, caminho alternativo)"))
    end

    SystemAdmin --> UC31
    UC31 -.->|define senha diretamente,\nsem exigir reautenticação| FirebaseAuth[(Firebase Auth)]
    UC31 -.->|se checkbox marcada,\nseta requirePasswordChange: true| UC06
    UC08 -.->|mesma tela,\nseção "Gerenciamento de Senha"| UC31
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']`.

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth** — atualização da senha (`adminAuth.updateUser`) e dos custom claims (`adminAuth.setCustomUserClaims`), inteiramente via Admin SDK, server-side.
- **Consultor Rennova** afetado — não é notificado por nenhum canal automático desta ação (RN-04); passa a depender da nova senha ser comunicada a ele fora do sistema.

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`.
- Existe um consultor com o id informado.
- O consultor possui `user_id` (uma conta no Firebase Auth já vinculada) — caso contrário, ver Fluxo de Exceção 8d.

---

## 4. Pós-condições

### 4.1 Sucesso
- A senha do usuário associado ao consultor é atualizada no Firebase Auth (`adminAuth.updateUser(userId, { password })`).
- Os custom claims do consultor são atualizados: se a opção "Solicitar troca de senha no próximo login" estiver marcada, `requirePasswordChange: true` é mesclado aos claims existentes (acionando UC-06 no próximo login); se desmarcada, a chave `requirePasswordChange` é removida dos claims (não apenas setada para `false`).
- O documento `consultants/{id}` é atualizado: `requirePasswordChange` (espelhando a opção escolhida), `passwordSetByAdminAt` (timestamp), `passwordSetByAdmin` (uid do admin), `updated_at`.
- **Nenhum e-mail ou notificação é enviado** ao consultor — a nova senha só é conhecida pelo admin que a digitou (RN-04).
- Sistema exibe a confirmação de sucesso retornada pela API — mensagem diferenciada conforme `requirePasswordChange` (RN-03, corrigido) — e limpa os campos de senha do formulário.

### 4.2 Falha (Garantias Mínimas)
- Se a validação de senha (client ou server) falhar: nenhuma alteração é feita.
- Se o consultor não for encontrado, ou não tiver `user_id` vinculado: nenhuma alteração é feita.
- Se `adminAuth.updateUser` falhar (ex.: erro do Firebase Admin SDK): nenhuma alteração é feita — a atualização da senha no Auth ocorre antes da atualização dos claims e do documento `consultants`, então não há risco de estado parcialmente aplicado entre essas duas últimas etapas e uma senha não atualizada. O cliente recebe uma mensagem genérica de erro (RN-06, corrigido); o erro real do SDK é registrado apenas no log do servidor.

---

## 5. Gatilho (Trigger)
System Admin, na tela `/admin/consultants/{id}`, seção "Gerenciamento de Senha" → "Definir Senha Manualmente", preenche "Nova Senha" e "Confirmar Senha" e clica em "Definir Senha".

---

## 6. Fluxo Principal (Basic Flow)

1. System Admin acessa `/admin/consultants/{id}` e localiza a seção "Gerenciamento de Senha" → "Definir Senha Manualmente" (com o texto de ajuda: "Use para suporte quando o sistema de email falhar. A senha é definida imediatamente.").
2. Preenche "Nova Senha" (campo com botão de mostrar/ocultar texto) e "Confirmar Senha".
3. Decide se mantém marcada a checkbox "Solicitar troca de senha no próximo login" — vem **marcada por padrão** (`forcePasswordChange = true`, diferente do equivalente para usuários em UC-37, que vem desmarcada por padrão — ver UC-37, RN-07).
4. Clica em "Definir Senha".
5. Sistema valida no client: `newPassword.length >= 6` (senão exibe toast "A senha deve ter no mínimo 6 caracteres."); `newPassword === confirmPassword` (senão toast "As senhas não coincidem.").
6. Sistema chama `POST /api/consultants/{id}/set-password` com `{ password: newPassword, requirePasswordChange: forcePasswordChange }` e o Bearer token do admin.
7. API valida token e `is_system_admin` (403 se não for admin do sistema).
8. API revalida no servidor `password.length >= 6` (400 se inválido) — mesma checagem repetida no client e no server (RN-01).
9. API busca o consultor pelo id (404 se não existir).
10. API extrai `user_id` do documento do consultor; retorna 400 se ausente (RN-02).
11. API chama `adminAuth.updateUser(userId, { password })`, definindo a nova senha diretamente no Firebase Auth — sem exigir reautenticação do consultor nem do admin, diferente do fluxo self-service de troca de senha (UC-06), que roda no client e depende de reautenticação recente (RN-05).
12. API busca novamente o registro do usuário (`adminAuth.getUser`) para obter os custom claims atuais.
13. Se `requirePasswordChange` (opção marcada) for `true`: API mescla os claims existentes com `requirePasswordChange: true`. Se for `false`: API remove a chave `requirePasswordChange` dos claims existentes (via desestruturação, mesmo padrão de remoção "limpa" usado em UC-06) e grava o restante.
14. API atualiza `consultants/{id}` com `requirePasswordChange` (espelhando a opção escolhida, com fallback `?? false`), `passwordSetByAdminAt`, `passwordSetByAdmin`, `updated_at`.
15. API retorna sucesso, com uma mensagem que varia conforme a opção escolhida ("Senha definida. O consultor deverá alterá-la no próximo login." ou "Senha definida com sucesso.").
16. Sistema exibe uma caixa de confirmação verde com a mensagem retornada pela API (novo state `passwordSuccessMessage`, preenchido com `data.message || 'Senha definida com sucesso!'`) — **[Corrigido no commit `ec31c27` — UC-30-RN-03]**, diferenciando visualmente se a flag de troca obrigatória foi aplicada; limpa os campos "Nova Senha"/"Confirmar Senha".
17. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado — as duas variações possíveis (com ou sem exigência de troca no próximo login) fazem parte do próprio fluxo principal (passo 13), não configurando ramificações separadas de caminho.

---

## 8. Fluxos de Exceção

### 8a. Validação client-side falha (a partir do passo 5)
1. Senha com menos de 6 caracteres, ou confirmação diferente da senha.
2. Sistema exibe o toast específico; nenhuma chamada à API é feita.

### 8b. Token ausente/inválido ou sem permissão (a partir do passo 7)
1. Token ausente (401) ou usuário autenticado não é `system_admin` (403: "Apenas administradores do sistema podem definir senhas").
2. Sistema exibe toast com a mensagem de erro; nenhuma alteração é feita.

### 8c. Consultor não encontrado (a partir do passo 9)
1. `id` não corresponde a nenhum documento em `consultants`.
2. API retorna 404 ("Consultor não encontrado"); sistema exibe toast com o erro.

### 8d. Consultor sem usuário de autenticação vinculado (a partir do passo 10)
1. `consultantDoc.data()?.user_id` está ausente.
2. API retorna 400 ("Consultor não possui usuário de autenticação vinculado"); sistema exibe toast com o erro.

### 8e. Falha do Firebase Admin SDK ao atualizar a senha (a partir do passo 11)
1. `adminAuth.updateUser` lança uma exceção (ex.: UID inválido, erro interno do Firebase).
2. API captura no bloco `catch`, registra o erro real via `console.error('Erro ao definir senha do consultor:', error)` e retorna 500 com a mensagem genérica fixa `"Erro ao definir senha. Tente novamente."` — **[Corrigido no commit `53df743` — UC-30-RN-06]**, alinhando esta rota ao padrão mais cauteloso das demais rotas do módulo (UC-28/UC-29/UC-08), que não propagam `error.message` bruto do SDK ao cliente.
3. Sistema exibe toast com a mensagem genérica recebida; nenhuma alteração é confirmada como feita.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O tamanho mínimo da senha (6 caracteres) é validado tanto no client quanto no server — mesmo padrão de dupla validação já observado em outras telas do sistema (ex.: UC-06). | Confirmado por leitura de `handleSetPassword` (client) e do handler `POST` (server). |
| RN-02 | A ação exige que o consultor já possua `user_id` (conta Firebase Auth vinculada) — mesma checagem usada na rota irmã de reset por link (`api/consultants/[id]/reset-password`, coberta por UC-08). Um consultor sem conta Auth vinculada não pode ter senha definida por nenhum dos dois mecanismos. | Confirmado por leitura literal do handler — checagem idêntica em ambas as rotas. |
| RN-03 | **[Corrigido no commit `ec31c27` — UC-30-RN-03]** A tela (`ConsultantDetailPage`, `src/app/(admin)/admin/consultants/[id]/page.tsx`) agora lê o campo `message` da resposta da API através de um novo state `passwordSuccessMessage` (preenchido com `data.message || 'Senha definida com sucesso!'`) e o exibe no lugar do texto fixo anterior — o admin passa a ver a confirmação diferenciada quando `requirePasswordChange` é marcado. **Nota histórica:** até esta correção, a tela ignorava completamente o campo `message` da resposta e sempre exibia o texto estático "Senha definida com sucesso!", independentemente da opção marcada. | Confirmado por leitura de `handleSetPassword` — novo state `passwordSuccessMessage` preenchido com `data.message || 'Senha definida com sucesso!'` na resposta da API, e renderizado no lugar do texto fixo anterior (antes: apenas `setSetPasswordSuccess(true)`, texto fixo no JSX). |
| RN-04 | Esta ação não dispara nenhum e-mail nem qualquer outra notificação ao consultor — diferente de UC-08 (que sempre envia e-mail) e alinhado ao mesmo padrão já documentado para a rota irmã de usuários em UC-06 (RN-05): o texto de ajuda da própria tela orienta usar este recurso "para suporte quando o sistema de email falhar". O admin precisa comunicar a nova senha ao consultor por fora do sistema. | Confirmado por leitura completa do handler — nenhuma escrita em `email_queue`; confirmado também pelo texto de ajuda na UI (`admin/consultants/[id]/page.tsx`). |
| RN-05 | Diferente do fluxo self-service de troca de senha (UC-06), que roda inteiramente no client e exige reautenticação recente (`reauthenticateWithCredential`) antes de `updatePassword`, este mecanismo é executado inteiramente no server via Firebase Admin SDK (`adminAuth.updateUser`), que tem privilégio para alterar a senha de qualquer conta sem qualquer prova de posse da senha atual — por design, já que é uma ação administrativa. | Confirmado por leitura comparada de `change-password/page.tsx` (UC-06) e `api/consultants/[id]/set-password/route.ts`. |
| RN-06 | **[Corrigido no commit `53df743` — UC-30-RN-06]** Em caso de erro inesperado no bloco `catch`, a rota agora retorna sempre a mensagem genérica fixa `"Erro ao definir senha. Tente novamente."` ao cliente — o erro real do SDK segue apenas para o log do servidor (`console.error('Erro ao definir senha do consultor:', error)`), sem ser exposto na resposta HTTP. **Nota histórica:** até esta correção, a rota retornava `error.message \|\| 'Erro ao definir senha. Tente novamente.'` — o `error.message` bruto do Firebase Admin SDK, quando presente, era propagado diretamente ao cliente, diferente do padrão mais cauteloso das demais rotas deste módulo (UC-28/UC-29/UC-08), que sempre retornam mensagens fixas e genéricas em erros 500. | Confirmado por leitura literal do bloco `catch` da rota (`src/app/api/consultants/[id]/set-password/route.ts`, linhas 78-80) — `return NextResponse.json({ error: 'Erro ao definir senha. Tente novamente.' }, { status: 500 })`, sem interpolação de `error.message`. |
| RN-07 | **[Achado]** Os campos `passwordSetByAdminAt`, `passwordSetByAdmin` e `requirePasswordChange`, gravados ativamente no documento `consultants/{id}` por esta rota, **não estão declarados** na interface `Consultant` em `src/types/index.ts` (que só define `id`, `user_id`, `code`, `name`, `email`, `phone`, `status`, `authorized_tenants`, `created_at`, `updated_at`, `created_by`). | Confirmado por leitura completa da interface `Consultant` — divergência entre o tipo TypeScript e os campos realmente persistidos pela API. |
| RN-08 | Assim como já documentado em UC-08 (RNF-03) para o mecanismo de link, apenas a solicitação mais recente de definição manual de senha é registrada (`passwordSetByAdminAt`/`passwordSetByAdmin` são sobrescritos a cada nova chamada) — não há histórico auditável de todas as vezes que a senha de um consultor foi definida manualmente. | Confirmado por leitura do handler — `update()` simples, sem acréscimo a nenhuma subcoleção/array de histórico. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Ausência de notificação ao consultor quando sua senha é definida manualmente pelo admin (RN-04) — mesmo risco de suporte já sinalizado para a rota irmã de usuários em UC-06. | UX / Suporte |
| RNF-02 | **[Resolvido no commit `53df743` — RN-06]** A exposição de `error.message` bruto do Firebase Admin SDK em respostas 500 foi eliminada — a rota agora sempre retorna uma mensagem genérica ao cliente, com o erro real preservado apenas no log do servidor. | Segurança |
| RNF-03 | Divergência entre a interface `Consultant` (TypeScript) e os campos realmente gravados no Firestore por esta rota (RN-07) — risco de manutenção/type-safety. | Manutenibilidade |

---

## 11. Frequência de Uso
Ocasional — usado pelo System Admin como alternativa a "Redefinir Senha via Link" (UC-08) quando o sistema de e-mail está indisponível ou para suporte imediato.

---

## 12. Casos de Uso Relacionados
- **UC-28 (Cadastrar Consultor)** — pré-condição (o consultor e sua conta Auth precisam existir).
- **UC-29 (Editar, Suspender e Reativar Consultor)** — mesma tela de detalhe (`admin/consultants/[id]/page.tsx`); ação independente, na mesma página.
- **UC-08 (System Admin Envia Link de Redefinição de Senha)** — mecanismo irmão, na mesma seção "Gerenciamento de Senha": em vez de definir a senha diretamente, envia um e-mail com link seguro. Os dois cobrem juntos toda a seção da tela.
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** — mecanismo acionado quando a opção "Solicitar troca de senha no próximo login" é marcada (passo 13); UC-06 já citava esta ação (rota `api/consultants/[id]/set-password`) como uma das origens de sua pré-condição, mas sem UC formal dedicado até esta versão.
- **UC-37 (Definir Senha do Usuário Manualmente)** — equivalente exato deste UC, para usuários de clínica (`clinic_admin`/`clinic_user`) em vez de consultores; mesma estrutura de API, com uma divergência de comportamento padrão confirmada na checkbox de troca obrigatória (ver UC-37, RN-07). Recebeu a correção equivalente de RN-06 (`error.message` bruto) no mesmo commit `53df743` (UC-37-RN-06).

---

## 13. Referências
- `src/app/(admin)/admin/consultants/[id]/page.tsx` (seção "Gerenciamento de Senha" → "Definir Senha Manualmente")
- `src/app/api/consultants/[id]/set-password/route.ts` (bloco `catch`, linhas 78-80 — ver RN-06)
- `src/types/index.ts` (`Consultant` — RN-07)
- `firestore.rules` (`consultants/{consultantId}`)
- Commit da correção: `53df743` (`fix: lote de correções de baixa severidade (UC-04, UC-08, UC-30, UC-37, UC-47)`) — remove `error.message` bruto da resposta 500 (RN-06)
- Commit da correção: `ec31c27` (`fix: segundo lote de correções de baixa severidade (UC-22, UC-30, UC-37, UC-38, UC-41)`) — UI passa a exibir a mensagem diferenciada retornada pela API (RN-03)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-03]** A UI ignora a mensagem diferenciada retornada pela API quando `requirePasswordChange` é marcado — decisão de produto pendente sobre exibir uma confirmação distinta nesse caso, para o admin ter certeza de que a flag foi aplicada.~~ **[RESOLVIDO no commit `ec31c27` — UC-30-RN-03]** A tela agora exibe a mensagem diferenciada retornada pela API (`data.message`), através do novo state `passwordSuccessMessage`.
2. ~~**[RN-06]** Exposição de `error.message` bruto do Firebase Admin SDK em erros 500 — decisão pendente sobre padronizar para uma mensagem genérica, como nas demais rotas do módulo.~~ **[RESOLVIDO no commit `53df743` — UC-30-RN-06]** A rota passou a retornar sempre a mensagem genérica fixa "Erro ao definir senha. Tente novamente.", com o erro real preservado apenas no log do servidor.
3. **[RN-07]** Divergência entre a interface `Consultant` e os campos realmente persistidos (`passwordSetByAdminAt`, `passwordSetByAdmin`, `requirePasswordChange`) — decisão pendente sobre atualizar o tipo TypeScript.
4. **[RN-08]** Ausência de histórico auditável de definições manuais de senha (apenas a mais recente é registrada) — mesma lacuna já observada em UC-08; avaliação de necessidade de correção não solicitada até o momento.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `api/consultants/[id]/set-password/route.ts` e da seção "Definir Senha Manualmente" em `admin/consultants/[id]/page.tsx`. Documenta o segundo mecanismo de gerenciamento de senha da tela de detalhe do consultor (o primeiro, "Redefinir Senha via Link", é coberto por UC-08 e não recebeu UC dedicado, por decisão confirmada do usuário, para evitar duplicação de conteúdo). Achados: a UI ignora a mensagem diferenciada de sucesso retornada pela API (RN-03); erros 500 expõem `error.message` bruto do SDK, fora do padrão do módulo (RN-06); a interface `Consultant` não declara os campos de auditoria realmente gravados por esta rota (RN-07); apenas a definição de senha mais recente é registrada, sem histórico completo (RN-08). Fecha, junto com UC-28/UC-29 e a decisão de não criar UC-30, o módulo "Admin — Gestão de Consultores". |
| 1.1 | 15/07/2026 | Guilherme Scandelari | Seção 12 atualizada com referência cruzada ao UC-37 (Definir Senha do Usuário Manualmente), recém-mapeado como equivalente exato deste UC para usuários de clínica — inclusive uma divergência confirmada de comportamento padrão entre as duas telas (checkbox de troca obrigatória marcada por padrão aqui, desmarcada por padrão em UC-37). Passo 3 do Fluxo Principal atualizado com nota cruzada sobre essa divergência. |
| 1.1.1 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-30-RN-06): o bloco `catch` da rota `POST /api/consultants/{id}/set-password` deixou de retornar `error.message` bruto do Firebase Admin SDK e passou a retornar sempre a mensagem genérica fixa "Erro ao definir senha. Tente novamente." — corrigido no commit `53df743`; o erro real continua sendo registrado via `console.error`, apenas no log do servidor. Atualizados Pós-condição 4.2, Fluxo de Exceção 8e, RN-06 (marcado `[Corrigido]`), RNF-02 (marcado `[Resolvido]`), referências (Seção 13), cross-reference a UC-37 (mesma correção, mesmo commit) na Seção 12, e item 2 da Seção 14 (marcado `[RESOLVIDO]`). |
| 1.1.2 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-30-RN-03): a tela `ConsultantDetailPage` (`src/app/(admin)/admin/consultants/[id]/page.tsx`) passou a ler o campo `message` retornado pela API `POST /api/consultants/{id}/set-password`, através de um novo state `passwordSuccessMessage` (`data.message || 'Senha definida com sucesso!'`), em vez do texto fixo estático anterior — corrigido no commit `ec31c27`. Atualizados Pós-condição 4.1, Fluxo Principal (passos 15-16), RN-03 (marcado `[Corrigido]`), referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
