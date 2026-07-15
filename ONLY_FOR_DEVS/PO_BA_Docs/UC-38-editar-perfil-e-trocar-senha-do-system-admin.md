# UC-38: Editar Perfil e Trocar Senha (System Admin)

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Autoatendimento)
**Versão:** 1.0

> Um System Admin, na tela `admin/profile/page.tsx` (acessível pelo link "Perfil" no rodapé do menu lateral do Portal Admin), atualiza o próprio nome de exibição e/ou troca a própria senha — duas ações independentes, ambas executadas inteiramente client-side via Firebase Auth SDK, sem nenhuma API route de backend envolvida. É um fluxo de autoatendimento genuinamente distinto de UC-36/UC-37 (onde o System Admin edita dados/senha de **outros** usuários): aqui o ator edita exclusivamente a própria conta.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])
    FirebaseAuth([🔧 Firebase Auth])

    subgraph Sistema["Curva Mestra"]
        UC38(("UC-38\nEditar Perfil e Trocar Senha\n(System Admin, autoatendimento)"))
        UC02(("UC-02\nAprovar Solicitação\nde Acesso"))
        UC06(("UC-06\nTrocar Senha Obrigatória\n(nunca aplicável a system_admin)"))
    end

    SystemAdmin --> UC38
    UC38 -.->|updateProfile / updatePassword\n(client SDK)| FirebaseAuth
    UC38 -.->|nome atualizado é lido depois\npor auth.currentUser.displayName| UC02
    UC06 -.->|"system_admin nunca passa\npor este fluxo (RN-06 de UC-06)"| UC38
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** (`is_system_admin === true`) — edita exclusivamente os próprios dados. Tela restrita pelo layout do grupo `(admin)` (`ProtectedRoute allowedRoles: ['system_admin']`).

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth:** `updateProfile` (atualiza `displayName` do usuário autenticado) e `updatePassword`/`reauthenticateWithCredential` (troca de senha) — ambas chamadas inteiramente client-side, sem nenhuma API route de backend envolvida nesta tela.

---

## 3. Pré-condições
- System Admin autenticado (sessão Firebase Auth ativa), `is_system_admin === true`.
- Para trocar a senha: o admin sabe sua senha atual (necessária para a reautenticação exigida pelo Firebase Auth antes de `updatePassword`).

---

## 4. Pós-condições

### 4.1 Sucesso — Editar Perfil (nome)
- `displayName` do usuário é atualizado no Firebase Auth (`updateProfile`) — reflete imediatamente em `auth.currentUser.displayName` na sessão atual.
- **Nenhum documento Firestore é criado ou atualizado** por esta ação — não existe, nesta tela, nenhuma escrita em `users/{uid}` nem em nenhuma outra coleção (RN-05).
- Sistema exibe "Perfil atualizado com sucesso!" na própria seção do formulário.

### 4.1b Sucesso — Trocar Senha
- A senha do admin é atualizada no Firebase Auth (`updatePassword`, client-side).
- **Nenhum campo de auditoria é gravado** (nem `passwordChangedAt`, nem qualquer outro) — diferente de UC-06, que grava `passwordChangedAt` no Firestore ao concluir a troca (RN-07).
- Sistema exibe "Senha alterada com sucesso!" e limpa os três campos de senha do formulário.

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita no Firebase Auth; a mensagem de erro específica é exibida na seção correspondente (perfil ou senha, cada uma com seu próprio estado de erro independente).

---

## 5. Gatilho (Trigger)
System Admin clica em "Perfil" no rodapé do menu lateral do Portal Admin (`AdminLayout`), acessando `/admin/profile`, e preenche um dos dois formulários independentes da página.

---

## 6. Fluxo Principal (Basic Flow) — Editar Perfil (Nome)

1. System Admin clica em "Perfil" no menu lateral (`AdminLayout`, visível tanto expandido quanto recolhido) e acessa `/admin/profile`.
2. Sistema exibe a seção "Informações Pessoais", pré-preenchida com `user?.email` (campo desabilitado, com nota "O email não pode ser alterado" — RN-06) e `user?.displayName` (campo editável), ambos lidos diretamente do objeto `user` do Firebase Auth via `useAuth()`.
3. System Admin altera o campo "Nome" e clica em "Salvar Alterações".
4. Sistema chama `updateProfile(user, { displayName: displayName.trim() })` do Firebase Auth SDK — chamada inteiramente client-side, sem nenhuma requisição a uma API route.
5. Sistema exibe "Perfil atualizado com sucesso!" na própria seção.
6. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Trocar Senha (ação independente, mesma tela, formulário separado)
1. System Admin preenche "Senha Atual", "Nova Senha" (mínimo 8 caracteres, indicado no texto de ajuda "Mínimo de 8 caracteres para system_admin" — RN-01) e "Confirmar Nova Senha".
2. System Admin clica em "Alterar Senha".
3. Sistema valida no client: `newPassword.length >= 8` (mensagem específica: "Para system_admin, a senha deve ter pelo menos 8 caracteres"); `newPassword === confirmPassword` ("As senhas não coincidem"). **Não há validação de que a nova senha seja diferente da atual** — diferente de UC-06 (RN-03).
4. Sistema reautentica o admin no Firebase Auth (`reauthenticateWithCredential` + `EmailAuthProvider.credential(user.email, currentPassword)`).
5. Sistema chama `updatePassword(user, newPassword)`, client-side.
6. Sistema exibe "Senha alterada com sucesso!" e limpa os três campos.
7. Retorna ao caso de uso concluído com sucesso (seção 4.1b).

---

## 8. Fluxos de Exceção

### 8a. Nome vazio ou erro inesperado ao salvar perfil (a partir do passo 4 do Fluxo Principal)
1. `updateProfile` lança exceção (raro; nenhuma validação de formato é feita além do `required` do input HTML).
2. Sistema exibe `error.message` (ou "Erro ao atualizar perfil") na seção "Informações Pessoais".

### 8b. Nova senha menor que 8 caracteres (a partir do passo 3 de 7a)
1. Sistema exibe "Para system_admin, a senha deve ter pelo menos 8 caracteres" antes de qualquer chamada ao Firebase Auth.
2. Fluxo retorna ao preenchimento do formulário de senha.

### 8c. Confirmação de senha não confere (a partir do passo 3 de 7a)
1. Sistema exibe "As senhas não coincidem".
2. Fluxo retorna ao preenchimento do formulário de senha.

### 8d. Senha atual incorreta (a partir do passo 4 de 7a)
1. Firebase Auth retorna `auth/wrong-password`.
2. Sistema exibe "Senha atual incorreta".
3. **Achado:** diferente de UC-06 (que trata tanto `auth/wrong-password` quanto `auth/invalid-credential` como "senha atual incorreta"), este formulário só trata explicitamente `auth/wrong-password` no código-fonte (RN-04) — se o Firebase Auth retornar `auth/invalid-credential` para o mesmo cenário de senha incorreta, o admin veria a mensagem genérica de erro (8f) em vez de "Senha atual incorreta".

### 8e. Muitas tentativas (a partir do passo 4 de 7a)
1. Firebase Auth retorna `auth/too-many-requests`.
2. Sistema exibe "Muitas tentativas. Tente novamente mais tarde".

### 8f. Erro genérico não mapeado (a partir dos passos 4-5 de 7a)
1. Qualquer outro erro do Firebase Auth não coberto por 8d/8e (potencialmente incluindo `auth/invalid-credential`, ver 8d).
2. Sistema exibe `error.message` bruto retornado pelo SDK (ou "Erro ao alterar senha" como fallback).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Divergência confirmada]** A senha mínima exigida nesta tela é de **8 caracteres** para `system_admin` — diferente do mínimo de 6 caracteres usado nas demais telas do sistema que envolvem senha (UC-06, UC-08, UC-30, UC-37). | Confirmado por leitura literal de `handleUpdatePassword` (`newPassword.length < 8`) e do texto de ajuda na UI ("Mínimo de 8 caracteres para system_admin"). |
| RN-02 | A validação de senha nesta tela é uma checagem local simples (apenas comprimento) — não usa a função compartilhada `validatePassword` de `serverValidations.ts`, nem qualquer validação de complexidade (letra, número, etc.). Mesmo padrão de validação ad-hoc já documentado em UC-06 (RN-02). | Confirmado por leitura de `handleUpdatePassword` — nenhuma importação de `serverValidations`. |
| RN-03 | **[Achado]** Diferente de UC-06 (que bloqueia explicitamente a nova senha sendo igual à senha atual, exceção 8d daquele UC), este formulário não faz essa checagem — o admin pode "trocar" a senha para o mesmo valor atual sem nenhum aviso ou bloqueio. | Confirmado por leitura completa de `handleUpdatePassword` — apenas duas validações client-side (comprimento e confirmação), nenhuma comparação com `currentPassword`. |
| RN-04 | **[Achado]** O tratamento de erro da troca de senha só reconhece explicitamente o código `auth/wrong-password` para exibir "Senha atual incorreta" — não trata `auth/invalid-credential`, código que versões mais recentes do Firebase Auth SDK podem retornar para o mesmo cenário (senha de reautenticação incorreta), o que faria o admin cair no tratamento de erro genérico (8f) em vez de ver a mensagem específica. UC-06 trata ambos os códigos. | Confirmado por leitura literal do bloco `catch` de `handleUpdatePassword` — comparado ao bloco equivalente em `change-password/page.tsx` (UC-06), que checa `auth/wrong-password || auth/invalid-credential`. |
| RN-05 | **[Achado]** A atualização do nome (`displayName`) só é gravada no Firebase Auth (client-side) — nenhum documento Firestore é escrito por esta tela (não existe, no código desta página, nenhuma chamada a `updateDoc`/`setDoc`). Diferente de outras telas de edição de perfil de usuário no projeto, aqui não há uma coleção `users/{uid}` sendo mantida em sincronia (não investigado se um documento equivalente existe para `system_admin` em algum outro fluxo, fora do escopo desta tela). | Confirmado por leitura completa de `admin/profile/page.tsx` — nenhum import de `firebase/firestore` no arquivo. |
| RN-06 | O campo "Email" é exibido apenas como texto informativo (`disabled`), com a nota explícita "O email não pode ser alterado" — não há, nesta tela, nenhum mecanismo de troca de e-mail para o próprio System Admin. | Confirmado pela renderização do campo com atributo `disabled` e texto de ajuda fixo. |
| RN-07 | **[Achado]** Nenhum campo de auditoria (equivalente a `passwordChangedAt` em UC-06, ou `passwordSetByAdminAt` em UC-37) é gravado quando o System Admin troca a própria senha por esta tela — a troca ocorre inteiramente no Firebase Auth (client SDK), sem nenhuma chamada de backend que registre o evento no Firestore. | Confirmado por leitura completa de `handleUpdatePassword` — nenhuma chamada a `fetch`/API route após `updatePassword`. |
| RN-08 | O nome atualizado por esta tela (`auth.currentUser.displayName`) é lido, em tempo real, por outras telas do Portal Admin que registram o nome do admin agindo em uma ação — por exemplo, `admin/access-requests/page.tsx` usa `user.displayName \|\| user.email \|\| 'Admin'` para preencher `approved_by_name`/`name` ao aprovar ou rejeitar uma solicitação (UC-02/UC-03). Ou seja, apesar de RN-05 (nenhuma persistência própria), esta ação tem um efeito indireto real e imediato sobre o texto de auditoria gravado por outras ações administrativas. | Confirmado por grep de `user.displayName` em `src/app/(admin)` — ocorrências em `admin/access-requests/page.tsx` (linhas 85 e 131). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda a troca de senha ocorre client-side via Firebase SDK, com reautenticação obrigatória (exigência do próprio Firebase Auth para operações sensíveis) — mesmo padrão de segurança de UC-06/UC-37 (self-service). | Segurança |
| RNF-02 | Ausência de qualquer registro de auditoria (RN-07) sobre trocas de senha do próprio System Admin — diferente de outros fluxos de senha do sistema, que gravam ao menos uma data/hora da última alteração. | Auditoria |
| RNF-03 | Esta tela é de uso exclusivamente pessoal — não existe, em nenhum outro lugar do sistema, uma forma de um System Admin editar o perfil ou trocar a senha de **outro** System Admin (UC-36/UC-37 bloqueiam explicitamente qualquer ação sobre usuários com `role: "system_admin"`). | Segurança / Escopo |

---

## 11. Frequência de Uso
Rara — atualização de nome e troca de senha do próprio System Admin não são ações do dia a dia.

---

## 12. Casos de Uso Relacionados
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** já documentava, em sua RN-06, que `system_admin` nunca passa por aquele fluxo forçado — este UC-38 é o mecanismo real e equivalente de autoatendimento que o System Admin usa para trocar a própria senha, por vontade própria e a qualquer momento (não forçado por nenhuma claim).
- **UC-36 (Editar Usuário e Alterar Status Cross-Tenant)** e **UC-37 (Definir Senha do Usuário Manualmente)** são os UCs em que o System Admin edita dados/senha de **outros** usuários (`clinic_admin`/`clinic_user`) — ambos bloqueiam explicitamente qualquer usuário-alvo com `role: "system_admin"`, reforçando que este UC-38 é o único caminho, em todo o sistema, para editar o perfil ou a senha de um System Admin.
- **UC-02 (Aprovar Solicitação de Acesso)** e **UC-03 (Rejeitar Solicitação de Acesso)** são afetados indiretamente por este UC: ambos leem `auth.currentUser.displayName` (que este UC-38 pode alterar) para preencher os campos de auditoria `approved_by_name`/`name` (RN-08).

---

## 13. Referências
- `src/app/(admin)/admin/profile/page.tsx`
- `src/components/admin/AdminLayout.tsx` (link "Perfil" no menu lateral, linhas ~138 e ~155)
- `src/hooks/useAuth.ts` (fonte do objeto `user` do Firebase Auth)
- `src/app/(auth)/change-password/page.tsx` (UC-06 — comparação de tratamento de erro, RN-04, e de validações, RN-01 a RN-03)
- `src/app/(admin)/admin/access-requests/page.tsx` (uso de `user.displayName` — RN-08)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-04]** Não confirmado se `auth/invalid-credential` de fato ocorre em produção para reautenticação com senha incorreta nesta versão do Firebase SDK usada pelo projeto — o achado é sobre a ausência do tratamento explícito no código-fonte (comparado a UC-06), não uma falha observada em runtime.
2. **[RN-03]** Ausência de bloqueio para "nova senha igual à atual" — não confirmado pelo usuário se deve ser corrigido para alinhar com UC-06.
3. **[RN-07]** Ausência de qualquer auditoria de troca de senha do próprio System Admin — avaliação de necessidade de correção não solicitada até o momento.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `admin/profile/page.tsx`. Documenta o fluxo de autoatendimento do System Admin (editar nome, trocar senha), distinto de UC-36/UC-37 (edição de outros usuários pelo admin) e de UC-06 (troca forçada, nunca aplicável a `system_admin`). Achados: senha mínima diferente do padrão do resto do sistema (8 vs. 6 caracteres, RN-01); validação sem checagem de complexidade nem de "nova senha diferente da atual" (RN-02/RN-03); tratamento de erro de reautenticação incompleto frente a UC-06 (RN-04); nenhuma persistência em Firestore nem auditoria da troca de nome ou senha (RN-05/RN-07); e um efeito indireto real do nome atualizado sobre os campos de auditoria de UC-02/UC-03 (RN-08). Fecha, junto com UC-39, as duas últimas lacunas conhecidas do Portal Admin. |
