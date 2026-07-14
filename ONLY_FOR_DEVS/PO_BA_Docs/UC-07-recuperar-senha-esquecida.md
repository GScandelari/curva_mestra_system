# UC-07: Recuperar Senha Esquecida

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Autenticação
**Versão:** 1.0

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
- Um erro específico é exibido ao usuário.

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
6. Sistema exibe a mensagem de sucesso: "Email enviado com sucesso!", "Verifique sua caixa de entrada e siga as instruções para redefinir sua senha." e o aviso "Não se esqueça de verificar a pasta de spam."
7. Caso de uso é concluído com sucesso, do ponto de vista do Curva Mestra — os passos seguintes ocorrem inteiramente na página hospedada do próprio Firebase, fora do domínio/UI do sistema (ver RN-01).
8. **(Fora do controle do Curva Mestra)** Usuário clica no link recebido, é levado à página de ação padrão do Firebase (não uma tela do Curva Mestra), define a nova senha lá, e é redirecionado de volta para `/login` conforme a `continueUrl` configurada.

---

## 7. Fluxos Alternativos

### 7a. Usuário já autenticado acessa /forgot-password (a partir do passo 2)
1. A página `/forgot-password` **não verifica** se o usuário já está autenticado (diferente de `/login` e `/register`, que redirecionam para `/dashboard` nesse caso) — ver RN-04.
2. O formulário é exibido normalmente, mesmo para um usuário já logado.
3. Segue o fluxo normal a partir do passo 3.

---

## 8. Fluxos de Exceção

### 8a. E-mail não corresponde a nenhuma conta (a partir do passo 4)
1. Firebase Auth retorna `auth/user-not-found`.
2. Sistema exibe: "Usuário não encontrado".
3. **Nota de segurança:** isso permite que um visitante descubra se um determinado e-mail está cadastrado no sistema (enumeração de contas) — ver RN-03 e seção 14.
4. Caso de uso retorna ao passo 3.

### 8b. E-mail inválido (a partir do passo 4)
1. Firebase Auth retorna `auth/invalid-email`.
2. Sistema exibe: "Email inválido".
3. Caso de uso retorna ao passo 3.

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
| RN-03 | O erro `auth/user-not-found` é exibido literalmente ao usuário ("Usuário não encontrado") quando o e-mail informado não corresponde a nenhuma conta — isso permite a um visitante descobrir se um e-mail está cadastrado no sistema (enumeração de contas), diferente da prática recomendada de sempre exibir uma mensagem genérica de sucesso, independentemente da existência da conta. | Risco de segurança confirmado por leitura direta do código — não corrigido nesta rodada, apenas documentado (ver seção 14). |
| RN-04 | A página `/forgot-password` não verifica se o usuário já está autenticado (diferente de `/login` e `/register`, que redirecionam para `/dashboard` nesse caso) — um usuário já logado pode acessar esta tela normalmente e solicitar redefinição de senha para qualquer e-mail, inclusive um diferente do seu. | Inconsistência confirmada por leitura do código — comportamento *as-is*, sem correção proposta. |

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
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/login/page.tsx` (link de entrada "Esqueceu a senha?")
- Firebase Auth SDK (`sendPasswordResetEmail`) — não há nenhuma API route própria do Curva Mestra envolvida neste fluxo

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[Risco de segurança confirmado, não corrigido]** RN-03 — a mensagem "Usuário não encontrado" permite enumeração de contas cadastradas por um visitante não autenticado. Não confirmado pelo usuário como escopo de correção.
2. **[Confirmado, as-is]** RN-04 — a página não verifica se o usuário já está autenticado, diferente do padrão usado em `/login` e `/register`. Não confirmado como prioridade de correção.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial, mapeada a partir da leitura completa de `forgot-password/page.tsx`. Confirmado que este fluxo é totalmente independente do mecanismo de token customizado (UC-08) e do link de redefinição usado em UC-02 — usa exclusivamente `sendPasswordResetEmail` do Firebase Auth nativo, sem nenhuma API route própria do Curva Mestra. |
