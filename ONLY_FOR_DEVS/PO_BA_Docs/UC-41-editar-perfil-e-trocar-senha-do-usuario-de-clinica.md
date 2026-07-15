# UC-41: Editar Perfil e Trocar Senha (Usuário de Clínica)

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Clínica (Autoatendimento)
**Versão:** 1.0

> Um usuário de clínica (`clinic_admin` ou `clinic_user`), na tela `clinic/profile/page.tsx` (link "Meu Perfil" no menu do Portal da Clínica), atualiza o próprio nome de exibição e/ou troca a própria senha — duas ações independentes, ambas executadas inteiramente client-side via Firebase Auth SDK, sem nenhuma API route de backend envolvida. A mesma tela também exibe, em modo somente-leitura, o histórico de aceites de termos legais do próprio usuário (`user_document_acceptances`) — escopo já citado como "fora do escopo" em UC-09 e formalmente coberto aqui. É estruturalmente análogo a UC-38 (mesmo padrão para System Admin), mas sem nenhuma distinção de comportamento entre `clinic_admin` e `clinic_user`.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    UsuarioClinica([👤 Usuário de Clínica\nclinic_admin ou clinic_user])
    FirebaseAuth([🔧 Firebase Auth])
    Firestore([🔧 Firestore\nuser_document_acceptances])

    subgraph Sistema["Curva Mestra"]
        UC41(("UC-41\nEditar Perfil e Trocar Senha\n(Usuário de Clínica, autoatendimento)"))
        UC09(("UC-09\nAceitar Termos Legais"))
        UC05(("UC-05\nAprovar Solicitação de Acesso\npela Própria Clínica"))
        UC16(("UC-16 a UC-19\nProcedimentos"))
    end

    UsuarioClinica --> UC41
    UC41 -.->|updateProfile / updatePassword\n(client SDK)| FirebaseAuth
    UC41 -.->|"<<include>>\nlista aceites (somente leitura)"| UC09
    UC09 -.->|gera registros lidos\npor UC-41| Firestore
    UC41 -.->|nome atualizado é lido depois\npor user.displayName| UC05
    UC41 -.->|nome atualizado é lido depois\npor user.displayName| UC16
```

---

## 2. Atores

### 2.1 Ator Primário
**Usuário de Clínica** (`clinic_admin` ou `clinic_user`) — edita exclusivamente os próprios dados. Tela restrita pelo `ProtectedRoute allowedRoles: ['clinic_admin', 'clinic_user']` do grupo `(clinic)` (`src/app/(clinic)/layout.tsx`). **Não há nenhuma diferenciação de comportamento entre os dois roles nesta tela** — o formulário, os campos e as regras de validação são idênticos para ambos (confirmado por leitura completa de `clinic/profile/page.tsx`: nenhuma checagem de `claims.role` no arquivo).

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth:** `updateProfile` (atualiza `displayName` do usuário autenticado) e `updatePassword`/`reauthenticateWithCredential` (troca de senha) — ambas chamadas inteiramente client-side, sem nenhuma API route de backend envolvida nesta tela.
- **Firestore (`user_document_acceptances`, `legal_documents`):** leitura somente-leitura, client-side, para montar a lista de termos aceitos exibida na tela (ver seção 6, passos do bloco "Termos de Uso e Privacidade").

---

## 3. Pré-condições
- Usuário de clínica autenticado (sessão Firebase Auth ativa), `claims.role` igual a `clinic_admin` ou `clinic_user`.
- Para trocar a senha: o usuário sabe sua senha atual (necessária para a reautenticação exigida pelo Firebase Auth antes de `updatePassword`).

---

## 4. Pós-condições

### 4.1 Sucesso — Editar Perfil (nome)
- `displayName` do usuário é atualizado no Firebase Auth (`updateProfile`) — reflete imediatamente em `user.displayName` na sessão atual (inclusive no cabeçalho do `ClinicLayout`, que exibe `user?.displayName`).
- **Nenhum documento Firestore é criado ou atualizado** por esta ação — não existe, nesta tela, nenhuma escrita em `users/{uid}` nem em nenhuma outra coleção (RN-05, mesmo padrão de UC-38).
- Sistema exibe "Perfil atualizado com sucesso!" na própria seção do formulário.

### 4.1b Sucesso — Trocar Senha
- A senha do usuário é atualizada no Firebase Auth (`updatePassword`, client-side).
- **Nenhum campo de auditoria é gravado** (nem `passwordChangedAt`, nem qualquer outro) — mesmo achado de UC-38 (RN-07), mas aqui o padrão de 6 caracteres é o mesmo do resto do sistema (ver RN-01, sem a divergência de 8 caracteres do UC-38).
- Sistema exibe "Senha alterada com sucesso!" e limpa os três campos de senha do formulário.

### 4.1c Sucesso — Visualizar Histórico de Aceites de Termos (somente leitura)
- Nenhuma escrita ocorre; a seção "Termos de Uso e Privacidade" exibe, para cada registro em `user_document_acceptances` do usuário, o título do documento (buscado em `legal_documents` pelo `document_id`), a versão aceita e a data/hora do aceite.

### 4.2 Falha (Garantias Mínimas)
- Nenhuma alteração é feita no Firebase Auth; a mensagem de erro específica é exibida na seção correspondente (perfil ou senha, cada uma com seu próprio estado de erro independente).
- Falha ao carregar o histórico de aceites não bloqueia o restante da tela — o erro é apenas logado no console (`console.error`), sem toast nem mensagem visível ao usuário (ver Fluxo de Exceção 8e).

---

## 5. Gatilho (Trigger)
Usuário de clínica clica em "Meu Perfil" no menu do Portal da Clínica (`ClinicLayout`, disponível tanto na navegação desktop quanto no menu mobile), acessando `/clinic/profile`, e preenche um dos dois formulários independentes da página, ou apenas consulta o histórico de aceites de termos.

---

## 6. Fluxo Principal (Basic Flow) — Editar Perfil (Nome)

1. Usuário de clínica clica em "Meu Perfil" no menu (`ClinicLayout`, item presente tanto para `clinic_admin` quanto para `clinic_user` — nenhum filtro de `navLinks` por role) e acessa `/clinic/profile`.
2. Sistema exibe a seção "Informações Pessoais", pré-preenchida com `user?.email` (campo desabilitado, com nota "O email não pode ser alterado" — RN-06) e `user?.displayName` (campo editável), ambos lidos diretamente do objeto `user` do Firebase Auth via `useAuth()`.
3. Em paralelo, sistema consulta `user_document_acceptances` (filtrado por `user_id == user.uid`) e, para cada registro, busca o título do documento correspondente em `legal_documents`, exibindo a lista na seção "Termos de Uso e Privacidade" (skeleton de carregamento enquanto a consulta está em andamento; "Nenhum termo aceito ainda" se a lista vier vazia).
4. Usuário altera o campo "Nome" e clica em "Salvar Alterações".
5. Sistema chama `updateProfile(user, { displayName: displayName.trim() })` do Firebase Auth SDK — chamada inteiramente client-side, sem nenhuma requisição a uma API route.
6. Sistema exibe "Perfil atualizado com sucesso!" na própria seção.
7. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Trocar Senha (ação independente, mesma tela, formulário separado)
1. Usuário preenche "Senha Atual", "Nova Senha" (mínimo 6 caracteres, indicado no texto de ajuda "Mínimo de 6 caracteres" — RN-01) e "Confirmar Nova Senha".
2. Usuário clica em "Alterar Senha".
3. Sistema valida no client: `newPassword.length >= 6` ("A nova senha deve ter pelo menos 6 caracteres"); `newPassword === confirmPassword` ("As senhas não coincidem"). **Não há validação de que a nova senha seja diferente da atual** — mesmo achado de UC-38 (RN-02).
4. Sistema reautentica o usuário no Firebase Auth (`reauthenticateWithCredential` + `EmailAuthProvider.credential(user.email, currentPassword)`).
5. Sistema chama `updatePassword(user, newPassword)`, client-side.
6. Sistema exibe "Senha alterada com sucesso!" e limpa os três campos.
7. Retorna ao caso de uso concluído com sucesso (seção 4.1b).

### 7b. Consultar Histórico de Aceites de Termos (independente dos formulários acima)
1. Usuário acessa `/clinic/profile` (passo 3 do Fluxo Principal já carrega a lista automaticamente, sem ação adicional do usuário).
2. Sistema exibe cada aceite com ícone de confirmação (`CheckCircle2`), título do documento, número da versão aceita e data/hora formatada em pt-BR (`toLocaleDateString`).
3. Caso de uso é concluído (visualização somente-leitura, sem escrita).

---

## 8. Fluxos de Exceção

### 8a. Nome vazio ou erro inesperado ao salvar perfil (a partir do passo 5 do Fluxo Principal)
1. `updateProfile` lança exceção (raro; nenhuma validação de formato é feita além do `required` do input HTML).
2. Sistema exibe `error.message` (ou "Erro ao atualizar perfil") na seção "Informações Pessoais".

### 8b. Nova senha menor que 6 caracteres (a partir do passo 3 de 7a)
1. Sistema exibe "A nova senha deve ter pelo menos 6 caracteres" antes de qualquer chamada ao Firebase Auth.
2. Fluxo retorna ao preenchimento do formulário de senha.

### 8c. Confirmação de senha não confere (a partir do passo 3 de 7a)
1. Sistema exibe "As senhas não coincidem".
2. Fluxo retorna ao preenchimento do formulário de senha.

### 8d. Senha atual incorreta (a partir do passo 4 de 7a)
1. Firebase Auth retorna `auth/wrong-password`.
2. Sistema exibe "Senha atual incorreta".
3. **Achado:** assim como em UC-38 (RN-04), este formulário só trata explicitamente `auth/wrong-password` no código-fonte — se o Firebase Auth retornar `auth/invalid-credential` para o mesmo cenário de senha incorreta, o usuário veria a mensagem genérica de erro (8f) em vez de "Senha atual incorreta".

### 8e. Muitas tentativas (a partir do passo 4 de 7a)
1. Firebase Auth retorna `auth/too-many-requests`.
2. Sistema exibe "Muitas tentativas. Tente novamente mais tarde".

### 8f. Erro genérico não mapeado (a partir dos passos 4-5 de 7a)
1. Qualquer outro erro do Firebase Auth não coberto por 8d/8e (potencialmente incluindo `auth/invalid-credential`, ver 8d).
2. Sistema exibe `error.message` bruto retornado pelo SDK (ou "Erro ao alterar senha" como fallback).

### 8g. Erro ao carregar histórico de aceites de termos (a partir do passo 3 do Fluxo Principal)
1. A consulta a `user_document_acceptances` (ou a busca do título em `legal_documents` para algum item) lança exceção.
2. Sistema apenas registra o erro via `console.error('Erro ao carregar aceitações de termos:', error)` — **nenhum toast ou mensagem visível é exibido ao usuário**; a seção simplesmente encerra o carregamento (skeleton desaparece) e mostra a lista com os itens que conseguiu montar (ou "Nenhum termo aceito ainda", se nada foi carregado).
3. Caso de uso prossegue normalmente nos demais blocos da tela (perfil e senha não são afetados).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A senha mínima exigida nesta tela é de **6 caracteres**, tanto para `clinic_admin` quanto para `clinic_user` — mesmo padrão do restante do sistema (UC-06, UC-08, UC-30, UC-37), e **diferente** da exceção de 8 caracteres documentada em UC-38 (exclusiva de `system_admin`). | Confirmado por leitura literal de `handleUpdatePassword` (`newPassword.length < 6`) e do texto de ajuda na UI ("Mínimo de 6 caracteres") e do atributo `minLength={6}` do input. |
| RN-02 | A validação de senha nesta tela é uma checagem local simples (apenas comprimento e confirmação) — não usa a função compartilhada `validatePassword` de `serverValidations.ts`, nem qualquer validação de complexidade (letra, número, etc.). Mesmo padrão ad-hoc já documentado em UC-06 (RN-02) e UC-38 (RN-02). | Confirmado por leitura de `handleUpdatePassword` — nenhuma importação de `serverValidations`. |
| RN-03 | **[Achado]** Assim como UC-38 (RN-03), este formulário não bloqueia a nova senha sendo igual à senha atual — o usuário pode "trocar" a senha para o mesmo valor atual sem nenhum aviso ou bloqueio. | Confirmado por leitura completa de `handleUpdatePassword` — apenas duas validações client-side (comprimento e confirmação), nenhuma comparação com `currentPassword`. |
| RN-04 | **[Achado]** O tratamento de erro da troca de senha só reconhece explicitamente o código `auth/wrong-password` para exibir "Senha atual incorreta" — não trata `auth/invalid-credential`. Mesmo achado de UC-38 (RN-04). | Confirmado por leitura literal do bloco `catch` de `handleUpdatePassword`. |
| RN-05 | **[Achado]** A atualização do nome (`displayName`) só é gravada no Firebase Auth (client-side) — nenhum documento Firestore é escrito por esta tela (não existe, no código desta página, nenhuma chamada a `updateDoc`/`setDoc`). Mesmo achado de UC-38 (RN-05). | Confirmado por leitura completa de `clinic/profile/page.tsx` — os únicos usos de `firebase/firestore` no arquivo são de **leitura** (`getDoc`, `getDocs`) para o histórico de aceites; nenhuma escrita. |
| RN-06 | O campo "Email" é exibido apenas como texto informativo (`disabled`), com a nota explícita "O email não pode ser alterado" — não há, nesta tela, nenhum mecanismo de troca de e-mail para o próprio usuário de clínica. | Confirmado pela renderização do campo com atributo `disabled` e texto de ajuda fixo. |
| RN-07 | **[Achado]** Nenhum campo de auditoria (equivalente a `passwordChangedAt` em UC-06, ou `passwordSetByAdminAt` em UC-37) é gravado quando o usuário de clínica troca a própria senha por esta tela — a troca ocorre inteiramente no Firebase Auth (client SDK). Mesmo achado de UC-38 (RN-07). | Confirmado por leitura completa de `handleUpdatePassword` — nenhuma chamada a `fetch`/API route após `updatePassword`. |
| RN-08 | O nome atualizado por esta tela (`user.displayName`) é lido, em tempo real, por outras telas do Portal da Clínica que registram o nome do usuário agindo em uma ação — `clinic/access-requests/page.tsx` usa `user.displayName \|\| user.email \|\| 'Admin'` ao aprovar/rejeitar solicitações (UC-05); `clinic/requests/new/page.tsx` e `clinic/requests/[id]/page.tsx` usam `user.displayName \|\| user.email \|\| 'Usuário'` ao registrar/concluir procedimentos (UC-16 a UC-19). | Confirmado por grep de `user.displayName` em `src/app/(clinic)` — ocorrências em `clinic/access-requests/page.tsx` (linhas 102 e 145), `clinic/requests/new/page.tsx` (linha 516) e `clinic/requests/[id]/page.tsx` (linha 118). |
| RN-09 | A seção "Termos de Uso e Privacidade" desta tela é **somente leitura**: lista os aceites já registrados (título, versão, data/hora), sem nenhuma ação de aceite, edição ou exclusão disponível — o aceite em si ocorre exclusivamente pelo fluxo de UC-09 (`/accept-terms` ou `/clinic/setup/terms`). | Confirmado por leitura completa do bloco JSX da seção — nenhum `<form>`, `<Button>` de ação ou handler de escrita associado a essa seção; já antecipado como "fora do escopo" na seção 13 de UC-09. |
| RN-10 | Não há nenhuma diferenciação de comportamento, campo ou validação entre `clinic_admin` e `clinic_user` nesta tela — ambos veem exatamente o mesmo formulário e as mesmas regras. | Confirmado pela ausência de qualquer leitura de `claims.role` no arquivo `clinic/profile/page.tsx`, e pelo array `navLinks` do `ClinicLayout` (que inclui "Meu Perfil") não ser filtrado por role. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Toda a troca de senha ocorre client-side via Firebase SDK, com reautenticação obrigatória (exigência do próprio Firebase Auth para operações sensíveis) — mesmo padrão de segurança de UC-06/UC-37/UC-38. | Segurança |
| RNF-02 | Ausência de qualquer registro de auditoria (RN-07) sobre trocas de senha do próprio usuário de clínica — mesmo achado de UC-38. | Auditoria |
| RNF-03 | Esta tela é de uso exclusivamente pessoal — não existe, em nenhum outro lugar do sistema, uma forma de um usuário de clínica editar o perfil ou trocar a senha de **outro** usuário (esse fluxo pertence ao System Admin, via UC-36/UC-37, ou ao próprio clinic_admin, via UC-40 para criação — edição/troca de senha de outros usuários da mesma clínica não foi identificada em nenhum UC até o momento, ver seção 14). | Segurança / Escopo |
| RNF-04 | Falha ao carregar o histórico de aceites de termos é silenciosa para o usuário final (apenas `console.error`) — diferente do padrão de exibição de erro usado nos demais blocos desta mesma tela (perfil e senha, que exibem mensagem visível). | Usabilidade |

---

## 11. Frequência de Uso
Rara — atualização de nome e troca de senha do próprio usuário de clínica não são ações do dia a dia. A consulta ao histórico de aceites de termos é ainda mais incomum (apenas curiosidade/verificação pontual do usuário).

---

## 12. Casos de Uso Relacionados
- **UC-38 (Editar Perfil e Trocar Senha do System Admin)** — mesmo padrão estrutural de autoatendimento (nome + senha, ambos client-side via Firebase Auth), aplicado aqui a `clinic_admin`/`clinic_user`. Principais diferenças: senha mínima de 6 caracteres (não 8, RN-01) e presença de uma terceira seção somente-leitura de histórico de aceites de termos (RN-09), inexistente em UC-38.
- **UC-09 (Aceitar Termos Legais)** já citava, em sua seção 13 (Referências), que `clinic/profile/page.tsx` exibe "somente-leitura o histórico de aceites do próprio usuário — fora do escopo daquele UC". Este UC-41 formaliza esse escopo (Fluxo Alternativo 7b, RN-09).
- **UC-05 (Aprovar Solicitação de Acesso pela Própria Clínica)** e **UC-16 a UC-19 (Registrar/Editar/Concluir Procedimento)** são afetados indiretamente por este UC: todos leem `user.displayName` (que este UC-41 pode alterar) para preencher campos de auditoria (RN-08).
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** é o fluxo forçado de troca de senha (aplicável a `clinic_admin`/`clinic_user` no primeiro acesso); este UC-41 é o mecanismo de autoatendimento voluntário, a qualquer momento.

---

## 13. Referências
- `src/app/(clinic)/clinic/profile/page.tsx`
- `src/components/clinic/ClinicLayout.tsx` (link "Meu Perfil" no menu, linha 41; array `navLinks` não filtrado por role)
- `src/app/(clinic)/layout.tsx` (`ProtectedRoute allowedRoles: ['clinic_admin', 'clinic_user']`)
- `src/hooks/useAuth.ts` (fonte do objeto `user`/`claims` do Firebase Auth)
- `src/app/(admin)/admin/profile/page.tsx` (UC-38 — comparação direta de padrão, RN-01 a RN-07)
- `src/app/(clinic)/clinic/access-requests/page.tsx`, `src/app/(clinic)/clinic/requests/new/page.tsx`, `src/app/(clinic)/clinic/requests/[id]/page.tsx` (uso de `user.displayName` — RN-08)
- `src/app/(auth)/accept-terms/page.tsx`, `src/app/(clinic)/clinic/setup/terms/page.tsx` (UC-09 — origem dos registros em `user_document_acceptances` exibidos somente-leitura aqui)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-04]** Não confirmado se `auth/invalid-credential` de fato ocorre em produção para reautenticação com senha incorreta nesta versão do Firebase SDK usada pelo projeto — mesmo ponto em aberto já registrado em UC-38.
2. **[RN-03]** Ausência de bloqueio para "nova senha igual à atual" — não confirmado pelo usuário se deve ser corrigido para alinhar com UC-06.
3. **[RN-07]** Ausência de qualquer auditoria de troca de senha do próprio usuário de clínica — avaliação de necessidade de correção não solicitada até o momento.
4. **[RNF-04]** Falha silenciosa (apenas `console.error`, sem toast) ao carregar o histórico de aceites de termos — não confirmado pelo usuário se é um comportamento intencional (a lista é apenas informativa/secundária) ou uma lacuna a corrigir.
5. **[RNF-03]** Não foi localizado, em nenhum UC mapeado até agora, um fluxo pelo qual um `clinic_admin` edite o perfil ou troque a senha de **outro** usuário da mesma clínica (`clinic_user` ou outro `clinic_admin`) — apenas UC-40 (criação) foi confirmado até o momento. Não confirmado se esse fluxo existe em alguma tela ainda não mapeada do módulo Clínica, ou se genuinamente não existe (dependência exclusiva de "Esqueci minha senha" / System Admin).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `clinic/profile/page.tsx`, usando UC-38 (System Admin) como padrão estrutural de referência. Documenta as três seções independentes da tela: editar nome (perfil), trocar senha, e visualizar (somente leitura) o histórico de aceites de termos legais — este último formalizando o escopo que UC-09 já citava como "fora do escopo daquele UC". Confirmado RN-10: nenhuma diferenciação de comportamento entre `clinic_admin` e `clinic_user` nesta tela. Achados equivalentes aos de UC-38 (mesma ausência de auditoria de troca de senha e de bloqueio de "senha igual à atual", mesmo tratamento incompleto de `auth/invalid-credential`), com uma divergência real: a senha mínima aqui é de 6 caracteres (padrão do resto do sistema), não 8 (exceção exclusiva de `system_admin` em UC-38). Registrada pendência sobre a ausência de um fluxo de edição de perfil/senha de um usuário por **outro** usuário da mesma clínica (seção 14, item 5). |
