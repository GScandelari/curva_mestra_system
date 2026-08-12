# UC-07: Recuperar Senha Esquecida

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Autenticação
**Versão:** 1.2

> Um usuário desautenticado que esqueceu a senha solicita, a partir da tela de login, o envio de um e-mail de redefinição — usando exclusivamente o mecanismo nativo do Firebase Auth (`sendPasswordResetEmail`). Este fluxo é genuinamente diferente do mecanismo de token customizado usado quando é o System Admin quem inicia a redefinição em nome de outra pessoa (UC-08) — não compartilham nenhum código.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Visitante([👤 Usuário desautenticado])
    FirebaseAuth([🔧 Firebase Auth\nsendPasswordResetEmail])

    subgraph Sistema["Curva Mestra"]
        UC04(("UC-04\nFazer Login com\nRedirecionamento por Papel"))
        UC07(("UC-07\nRecuperar Senha\nEsquecida"))
    end

    Visitante --> UC07
    UC04 -.->|link "Esqueceu a senha?"| UC07
    UC07 -.->|aciona diretamente, sem API route própria| FirebaseAuth
```

---

## 2. Atores

### 2.1 Ator Primário
**Usuário desautenticado** — qualquer pessoa com uma conta no Firebase Auth (independente do role) que esqueceu a senha e não tem uma sessão ativa.

### 2.2 Atores Secundários / Sistemas Externos
**Firebase Auth** — gera o link de redefinição e envia o e-mail **por conta própria**, usando seu template e sistema de envio nativos — fora da fila `email_queue` do Curva Mestra.

---

## 3. Pré-condições
- Usuário não está autenticado.
- Usuário sabe o e-mail associado à sua conta.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- O Firebase Auth envia, por conta própria, um e-mail contendo um link de ação (`mode=resetPassword`) que aponta para a página de ação hospedada padrão do próprio Firebase — **não** uma página do Curva Mestra.
- Sistema exibe uma mensagem de confirmação na própria tela `/forgot-password`.

### 4.2 Falha (Garantias Mínimas)
- Nenhum e-mail é enviado.
- Um erro específico é exibido ao usuário — exceto no caso de `auth/user-not-found`, que **[CORRIGIDO, commit `c3f18d4`]** deixou de ser tratado como falha visível (ver RN-03 e Fluxo de Exceção 8a, corrigido).

---

## 5. Gatilho (Trigger)
O usuário clica em "Esqueceu a senha?" na tela `/login`, chega a `/forgot-password` e submete seu e-mail.

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário acessa `/login` e clica em "Esqueceu a senha?".
2. Sistema navega para `/forgot-password`, exibindo um formulário com um único campo de e-mail.
3. Usuário informa o e-mail e clica em "Enviar link de recuperação".
4. Sistema chama `sendPasswordResetEmail(auth, email, { url: "${origin}/login", handleCodeInApp: false })` — SDK client do Firebase Auth, **sem nenhuma chamada a uma API route própria do Curva Mestra**.
5. Firebase Auth gera um link de ação de redefinição de senha e envia, por conta própria (fora da fila `email_queue` do sistema), um e-mail com template padrão do Firebase para o endereço informado, com `continueUrl` configurada para `${origin}/login`.
6. Sistema exibe a mensagem de sucesso: "Email enviado com sucesso!", "Verifique sua caixa de entrada e siga as instruções para redefinir sua senha." e o aviso "Não se esqueça de verificar a pasta de spam." — **[CORRIGIDO, commit `c3f18d4`]** esta mesma tela de sucesso agora é exibida também quando o e-mail informado **não** corresponde a nenhuma conta cadastrada (ver RN-03 e Fluxo de Exceção 8a, corrigido) — do ponto de vista da interface, o resultado visível é idêntico nos dois casos.
7. Caso de uso é concluído com sucesso, do ponto de vista do Curva Mestra — os passos seguintes ocorrem inteiramente na página hospedada do próprio Firebase, fora do domínio/UI do sistema (ver RN-01).
8. **(Fora do controle do Curva Mestra)** Usuário clica no link recebido, é levado à página de ação padrão do Firebase (não uma tela do Curva Mestra), define a nova senha lá, e é redirecionado de volta para `/login` conforme a `continueUrl` configurada.

---

## 7. Fluxos Alternativos

### 7a. [CORRIGIDO — commit `1254abb`] Usuário já autenticado acessa /forgot-password (a partir do passo 2)
1. Sistema detecta, via `useAuth()` (`isAuthenticated`, `loading: authLoading`), que o usuário já está autenticado.
2. Um `useEffect` dedicado (`if (!authLoading && isAuthenticated) { router.push('/dashboard'); }`) redireciona automaticamente para `/dashboard`, sem exibir o formulário — mesmo padrão já usado em `/login` e `/register`.
3. Caso de uso é encerrado.

**Comportamento anterior (histórico, antes da correção):** a página `/forgot-password` não verificava se o usuário já estava autenticado — o formulário era exibido normalmente mesmo para um usuário já logado, que podia solicitar redefinição de senha para qualquer e-mail, inclusive um diferente do seu (ver RN-04, comportamento então documentado como *as-is*).

---

## 8. Fluxos de Exceção

### 8a. [CORRIGIDO — commit `c3f18d4`] E-mail não corresponde a nenhuma conta (a partir do passo 4)
1. Firebase Auth ainda retorna `auth/user-not-found` internamente (o comportamento do SDK não muda).
2. **[CORRIGIDO]** O `catch` de `handleSubmit`, em `forgot-password/page.tsx`, agora trata `err.code === 'auth/user-not-found'` como sucesso silencioso: chama `setSuccess(true)` e retorna imediatamente, sem passar pela função `translateFirebaseError`. O `case 'auth/user-not-found'` foi removido de `translateFirebaseError`.
3. Sistema exibe exatamente a mesma tela de sucesso do passo 6 do Fluxo Principal ("Email enviado com sucesso!"), independentemente de a conta existir ou não.
4. **Consequência da correção:** não é mais possível a um visitante distinguir, pela resposta desta tela, se um determinado e-mail está ou não cadastrado no sistema — fecha a enumeração de contas descrita em RN-03 (ver seção 14, item resolvido).
5. Caso de uso é concluído com sucesso do ponto de vista da interface — mesmo resultado do Fluxo Principal, ainda que nenhum e-mail tenha sido de fato enviado pelo Firebase Auth.

**Comportamento anterior (histórico, antes da correção):** Sistema exibia "Usuário não encontrado" — uma tela visivelmente distinta da tela de sucesso — permitindo a um visitante descobrir se um e-mail estava cadastrado no sistema (enumeração de contas). Ver RN-03.

### 8b. E-mail inválido (a partir do passo 4)
1. Firebase Auth retorna `auth/invalid-email`.
2. Sistema exibe: "Email inválido".
3. **Nota:** este caso continua tratado como erro visível e distinto do Fluxo Principal — não foi alterado pela correção do Fluxo 8a, pois é um erro de formato de digitação (e-mail malformado) e não revela nada sobre a existência de uma conta cadastrada, logo não representa risco de enumeração.
4. Caso de uso retorna ao passo 3.

### 8c. Muitas tentativas (a partir do passo 4)
1. Firebase Auth retorna `auth/too-many-requests` (rate-limiting nativo do Firebase — não implementado pelo Curva Mestra).
2. Sistema exibe: "Muitas tentativas. Tente novamente mais tarde".
3. Caso de uso retorna ao passo 3.

### 8d. Erro de rede (a partir do passo 4)
1. Firebase Auth retorna `auth/network-request-failed`.
2. Sistema exibe: "Erro de conexão. Verifique sua internet".
3. Caso de uso retorna ao passo 3.

### 8e. Erro genérico não mapeado (a partir do passo 4)
1. Qualquer outro código de erro do Firebase Auth.
2. Sistema exibe: "Erro ao enviar email. Tente novamente".
3. Caso de uso retorna ao passo 3.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | Este fluxo usa exclusivamente o mecanismo nativo do Firebase Auth (`sendPasswordResetEmail`) — não passa por nenhuma API route própria do Curva Mestra, não usa a fila `email_queue`, e a página de definição da nova senha é a página de ação hospedada padrão do próprio Firebase, não uma tela do Curva Mestra. | Diferente de UC-08 (mecanismo de token customizado, acionado pelo System Admin) e do link de redefinição do UC-02 (gerado pelo Admin SDK, mas enviado via `email_queue` com template próprio do sistema). |
| RN-02 | Não há, hoje, nenhum caminho alternativo de recuperação para um usuário desautenticado (SMS, pergunta de segurança, etc.) — o único caminho self-service é o e-mail. | Confirmado por leitura completa de `forgot-password/page.tsx` — nenhum outro método é oferecido. |
| RN-03 | **[CORRIGIDO — commit `c3f18d4`]** O erro `auth/user-not-found` deixou de ser exibido literalmente ao usuário. O `catch` de `handleSubmit` (`src/app/(auth)/forgot-password/page.tsx`) agora trata esse código como sucesso silencioso (`setSuccess(true)`), exibindo a mesma tela de sucesso ("Email enviado com sucesso!") independentemente de o e-mail informado corresponder ou não a uma conta cadastrada. O `case 'auth/user-not-found'` foi removido de `translateFirebaseError`. **Nota:** `auth/invalid-email` continua tratado como erro visível e distinto (mensagem "Email inválido") — é um erro de formato de digitação, não revela nada sobre a existência da conta, portanto não representa risco de enumeração (ver Fluxo de Exceção 8b). **Comportamento anterior (histórico):** o erro `auth/user-not-found` era exibido literalmente ("Usuário não encontrado"), permitindo a um visitante descobrir se um e-mail estava cadastrado no sistema (enumeração de contas). | Corrigido por leitura direta do diff do commit `c3f18d4` em `src/app/(auth)/forgot-password/page.tsx` — bloco `if (err.code === 'auth/user-not-found') { setSuccess(true); return; }` adicionado ao `catch`, e `case 'auth/user-not-found'` removido de `translateFirebaseError`. |
| RN-04 | **[CORRIGIDO — commit `1254abb`]** A página `/forgot-password` agora verifica se o usuário já está autenticado — usa `useAuth()` (`isAuthenticated`, `loading: authLoading`) e um `useEffect` que redireciona para `/dashboard` quando `!authLoading && isAuthenticated`, alinhando com o mesmo padrão já usado em `/login` e `/register`. **Comportamento anterior (histórico):** a página não fazia essa verificação — um usuário já logado podia acessar a tela normalmente e solicitar redefinição de senha para qualquer e-mail, inclusive um diferente do seu. | Elimina a inconsistência antes documentada aqui — comportamento agora alinhado ao padrão do restante do sistema. Corrigido por leitura direta do diff do commit `1254abb` em `src/app/(auth)/forgot-password/page.tsx`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | O rate-limiting de tentativas de envio é inteiramente delegado ao Firebase Auth (`auth/too-many-requests`) — o Curva Mestra não implementa nenhum controle próprio. | Segurança |
| RNF-02 | O e-mail de redefinição enviado pelo Firebase usa o template padrão do Firebase (idioma/marca não customizados pelo Curva Mestra), diferente dos e-mails com template HTML próprio usados em UC-02 e UC-08. | Usabilidade / Branding |

---

## 11. Frequência de Uso
Ocasional — sob demanda, a cada vez que um usuário esquece a própria senha.

---

## 12. Casos de Uso Relacionados
- **UC-04 (Fazer Login com Redirecionamento por Papel)** é o ponto de entrada — o link "Esqueceu a senha?" leva a este UC.
- **UC-08 (System Admin Envia Link de Redefinição de Senha)** é o mecanismo equivalente do ponto de vista do resultado (usuário define uma nova senha via link recebido por e-mail), mas acionado pelo System Admin em nome de outra pessoa, usando um sistema de token **completamente diferente** (customizado, não o nativo do Firebase) — não compartilha nenhum código com este UC.
- **UC-02 (Aprovar Solicitação de Acesso)** usa um terceiro mecanismo relacionado (`generatePasswordResetLink` do Admin SDK, mesma família nativa do Firebase que este UC, mas enviado via `email_queue` do próprio sistema com template customizado).

---

## 13. Referências
- `src/app/(auth)/forgot-password/page.tsx` (desde o commit `1254abb`, também usa `useAuth()` para redirecionar um usuário já autenticado para `/dashboard` — ver RN-04)
- `src/app/(auth)/login/page.tsx` (link de entrada "Esqueceu a senha?")
- `src/hooks/useAuth.ts` (`isAuthenticated`, `loading` — consumidos desde o commit `1254abb`, RN-04)
- Firebase Auth SDK (`sendPasswordResetEmail`) — não há nenhuma API route própria do Curva Mestra envolvida neste fluxo

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[Risco de segurança confirmado, não corrigido]** RN-03 — a mensagem "Usuário não encontrado" permite enumeração de contas cadastradas por um visitante não autenticado. Não confirmado pelo usuário como escopo de correção.~~ **[RESOLVIDO — commit `c3f18d4`]** `auth/user-not-found` passou a ser tratado como sucesso silencioso, exibindo a mesma tela de sucesso independentemente de a conta existir — eliminando a possibilidade de enumeração de contas pela resposta desta tela.
2. ~~**[Confirmado, as-is]** RN-04 — a página não verifica se o usuário já está autenticado, diferente do padrão usado em `/login` e `/register`. Não confirmado como prioridade de correção.~~ **[RESOLVIDO — commit `1254abb`]** `/forgot-password` passou a usar `useAuth()` e um `useEffect` que redireciona para `/dashboard` quando o usuário já está autenticado, alinhando-se ao mesmo padrão já usado em `/login` e `/register`. Ver RN-04 e Fluxo Alternativo 7a.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial, mapeada a partir da leitura completa de `forgot-password/page.tsx`. Confirmado que este fluxo é totalmente independente do mecanismo de token customizado (UC-08) e do link de redefinição usado em UC-02 — usa exclusivamente `sendPasswordResetEmail` do Firebase Auth nativo, sem nenhuma API route própria do Curva Mestra. |
| 1.1 | 26/07/2026 | Guilherme Scandelari | **Correção de bug (commit `c3f18d4`)**: RN-03 corrigida — o erro `auth/user-not-found` deixou de ser exibido como mensagem distinta ("Usuário não encontrado"); o `catch` de `handleSubmit` agora trata esse código como sucesso silencioso, exibindo a mesma tela de sucesso independentemente de a conta existir, fechando a enumeração de contas. O `case` correspondente foi removido de `translateFirebaseError`; `auth/invalid-email` permanece como erro visível e distinto (não representa risco de enumeração). Seções 4.2, 6 (passo 6), 8 (Fluxo de Exceção 8a, reescrito como histórico "[Corrigido]"; 8b atualizado com nota de que não foi afetado), 9 (RN-03) e 14 (item 1) atualizadas. |
| 1.2 | 06/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Correção de bug (commit `1254abb`, item UC-07-RN-04)**: a pendência registrada como "as-is" desde a v1.0 foi corrigida — `/forgot-password` passou a usar `useAuth()` (`isAuthenticated`, `loading`) e um `useEffect` que redireciona para `/dashboard` quando o usuário já está autenticado, alinhando este fluxo ao mesmo padrão já usado em `/login` e `/register`. RN-04 marcada `[CORRIGIDO]`; Fluxo Alternativo 7a reescrito com o comportamento novo e nota histórica do comportamento anterior; Referências (seção 13) e o segundo item da Seção 14 (marcado `[RESOLVIDO]`, mesmo padrão já usado para o item RN-03) atualizados. |
