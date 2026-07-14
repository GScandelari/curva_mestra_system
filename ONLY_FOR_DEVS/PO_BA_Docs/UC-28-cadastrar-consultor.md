# UC-28: Cadastrar Consultor

**Projeto:** Curva Mestra
**Data de Criação:** 14/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Gestão de Consultores)
**Versão:** 1.0

> Um System Admin cadastra um novo Consultor Rennova (nome, e-mail, telefone). O sistema gera um código único de 6 dígitos e uma senha temporária, cria o usuário no Firebase Auth com `requirePasswordChange: true`, e envia um e-mail de boas-vindas contendo **a senha em texto plano** — o mesmo padrão de risco identificado no UC-21 (Cadastrar Nova Clínica), agora agravado por trafegar a senha por e-mail (não apenas exibida uma vez na tela do admin) — mas, diferente do UC-21, este fluxo **enforce corretamente** a troca de senha no primeiro acesso (mecanismo do UC-06).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC28(("UC-28\nCadastrar Consultor"))
    end

    SystemAdmin --> UC28
    UC28 -.->|cria Auth user +\nrequirePasswordChange: true| FirebaseAuth[(Firebase Auth)]
    UC28 -.->|senha em texto plano| EmailQueue[(email_queue)]
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']`.

### 2.2 Atores Secundários / Sistemas Externos
- **Firebase Auth** — criação do usuário (`adminAuth.createUser`) e definição de custom claims.
- **Fila de e-mails** (`email_queue`) — envio assíncrono do e-mail de boas-vindas com as credenciais.

---

## 3. Pré-condições
- System Admin autenticado, `is_system_admin === true`.
- Não existe nenhum consultor com o mesmo e-mail (nem na coleção `consultants`, nem já registrado no Firebase Auth).

---

## 4. Pós-condições

### 4.1 Sucesso
- Um documento é criado em `consultants` com `status: 'active'`, `authorized_tenants: []`, e um `code` de 6 dígitos único.
- Um usuário é criado no Firebase Auth (`email`, `password: tempPassword`, `displayName`, `emailVerified: false`).
- Custom claims do novo usuário são definidos: `tenant_id: null`, `role: 'clinic_consultant'`, `is_system_admin: false`, `is_consultant: true`, `consultant_id`, `authorized_tenants: []`, `active: true`, `requirePasswordChange: true`.
- Um documento espelho é criado em `users/{uid}` com os mesmos dados básicos e `requirePasswordChange: true`.
- Um e-mail de boas-vindas é enfileirado em `email_queue`, contendo o código de 6 dígitos e a senha temporária **em texto plano**.
- Sistema exibe uma tela de confirmação com o código do consultor (mas **não** exibe a senha temporária na tela — ela só existe no e-mail).

### 4.2 Falha (Garantias Mínimas)
- Se a validação de campos ou a checagem de e-mail duplicado falhar: nenhum recurso é criado.
- Se a criação do usuário no Firebase Auth falhar por e-mail já existente no Auth (mas não na coleção `consultants` — ex.: e-mail já usado por um `clinic_admin`/`clinic_user`): nenhum documento é criado (a checagem acontece antes da escrita em `consultants`).
- **[Achado — sem rollback]** Se a criação do usuário no Auth **suceder**, mas a escrita do documento `consultants` ou `users` falhar depois: não há nenhuma lógica de rollback (diferente do UC-21, que reverte explicitamente a criação do tenant/Auth em caso de falha parcial) — um usuário Auth órfão, sem consultor nem documento `users` correspondente, pode ficar para trás (RN-05).

---

## 5. Gatilho (Trigger)
System Admin acessa `/admin/consultants/new`, preenche nome/e-mail/telefone e clica em "Criar Consultor".

---

## 6. Fluxo Principal (Basic Flow)

1. System Admin acessa `/admin/consultants/new`.
2. Preenche Nome Completo (convertido para maiúsculas automaticamente), E-mail e Telefone (com máscara `(00) 00000-0000`).
3. Sistema valida no client: nome não vazio, e-mail com formato básico válido (regex simples `^[^@\s]+@[^@\s]+$`), telefone com ao menos 10 dígitos.
4. System Admin clica em "Criar Consultor".
5. Sistema chama `POST /api/consultants` com `{ name, email (lowercase), phone }` e o Bearer token do admin.
6. API valida token e `is_system_admin`; valida presença de `name`/`email`/`phone`.
7. API verifica duplicidade de e-mail na coleção `consultants` (`where('email', '==', emailLower)`) — se já existir, retorna erro 400 (RN-01).
8. API gera um código único de 6 dígitos: `crypto.randomInt(100000, 1000000)`, verifica unicidade contra a coleção `consultants`, repete até 10 tentativas em caso de colisão (RN-02).
9. API gera uma senha temporária: 12 caracteres aleatórios (`crypto.randomInt`) de um conjunto de 58 caracteres que **exclui propositalmente caracteres ambíguos** (sem `0`, `O`, `1`, `I`, `l`) (RN-03).
10. API cria o usuário no Firebase Auth (`adminAuth.createUser`) com `email`, `password: tempPassword`, `displayName: name`, `emailVerified: false` — se o e-mail já existir no Auth (mesmo que não exista em `consultants`), retorna erro 400 (segunda camada de checagem de duplicidade, RN-01).
11. API cria o documento em `consultants` (`code`, `name`, `email`, `phone`, `status: 'active'`, `authorized_tenants: []`, `created_by`).
12. API define os custom claims do novo usuário: `tenant_id: null`, `role: 'clinic_consultant'`, `is_consultant: true`, `consultant_id`, `authorized_tenants: []`, `active: true`, **`requirePasswordChange: true`** (RN-04 — diferença crucial em relação ao UC-21).
13. API cria o documento espelho em `users/{uid}` com os mesmos dados e `requirePasswordChange: true`.
14. API monta o e-mail de boas-vindas (HTML) contendo o código de 6 dígitos e **a senha temporária em texto plano**, e o enfileira em `email_queue` (`type: 'consultant_welcome'`) — falha nessa etapa é capturada por `try/catch` e apenas logada, não interrompe a resposta de sucesso.
15. API retorna sucesso com os dados do consultor (sem a senha).
16. Sistema exibe a tela de confirmação com o código de 6 dígitos, nome, e-mail e status "Ativo", e um aviso: "O consultor receberá um email com uma senha temporária. Ele será solicitado a alterar a senha no primeiro acesso."
17. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos
Nenhum identificado — cadastro de consultor é uma ação única e direta.

---

## 8. Fluxos de Exceção

### 8a. Validação client-side falha
1. Nome vazio, e-mail em formato inválido, ou telefone com menos de 10 dígitos.
2. Sistema exibe a mensagem de erro específica sob o campo; nenhuma chamada à API é feita.

### 8b. E-mail já cadastrado como consultor
1. Já existe um documento em `consultants` com o mesmo e-mail.
2. API retorna 400 ("Já existe um consultor com este email"); nenhum recurso é criado.

### 8c. E-mail já em uso no Firebase Auth (por outro tipo de usuário)
1. O e-mail não está em `consultants`, mas já existe uma conta Auth com esse e-mail (ex.: já é `clinic_admin` de alguma clínica).
2. `adminAuth.createUser` lança `auth/email-already-exists`; API retorna 400 ("Este email já está em uso no sistema").

### 8d. Falha ao gerar código único após 10 tentativas
1. Extremamente improvável (10 colisões consecutivas em um espaço de 900.000 códigos), mas tratado explicitamente.
2. API lança exceção; retorna 500; nenhum recurso é criado (esta etapa ocorre **antes** da criação do usuário no Auth, então não há risco de órfão neste caso específico).

### 8e. Falha após criação do usuário no Auth (achado, sem rollback)
1. `adminDb.collection('consultants').add(...)`, `setCustomUserClaims`, ou a escrita em `users/{uid}` falham após o usuário já ter sido criado no Firebase Auth.
2. API retorna 500, mas o usuário Auth já existe — órfão, sem consultor nem documento `users`, sem lógica de reversão (RN-05).

### 8f. Falha ao enfileirar e-mail de boas-vindas
1. `adminDb.collection('email_queue').add(...)` falha.
2. Erro é capturado por `try/catch` (`console.warn`); a API retorna sucesso normalmente — o consultor é criado, mas nunca recebe suas credenciais por e-mail, e não há reenvio automático nem indicação disso na tela do admin.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Confirmado — responde à pergunta do coordenador]** Existe checagem de duplicidade de e-mail em duas camadas: (1) contra a coleção `consultants` (retorna erro específico "Já existe um consultor com este email"), e (2) contra o Firebase Auth como um todo, via `auth/email-already-exists` (retorna "Este email já está em uso no sistema") — cobrindo o caso de um e-mail já usado por um `clinic_admin`/`clinic_user`/outro consultor cujo documento em `consultants` não exista mais. **Não há campo de CPF/CNPJ em `Consultant`** — o cadastro de consultor não coleta nem valida documento de identificação nenhum, então não há checagem de duplicidade de documento (ela simplesmente não se aplica). | Confirmado por leitura de `POST /api/consultants` e por inspeção da interface `Consultant` em `src/types/index.ts` (sem campo de documento). |
| RN-02 | **[Confirmado — responde à pergunta do coordenador]** O código de 6 dígitos é gerado com `crypto.randomInt(100000, 999999)` (aleatoriedade criptograficamente segura, não `Math.random()`), com checagem ativa de unicidade contra a coleção `consultants` e até 10 tentativas em caso de colisão. **Colisão é tecnicamente possível** (espaço de 900.000 combinações) mas ativamente prevenida — a única lacuna é que a checagem "existe?" e a escrita não ocorrem na mesma transação, então, em tese, duas criações de consultor simultâneas poderiam gerar o mesmo código se ambas verificarem unicidade antes de qualquer uma escrever (janela de corrida estreita, mas existente). | Confirmado por leitura literal de `generateUniqueCode()` em `api/consultants/route.ts`. |
| RN-03 | A senha temporária tem 12 caracteres, gerados com `crypto.randomInt` (seguro), a partir de um alfabeto de 58 caracteres que exclui deliberadamente caracteres visualmente ambíguos (`0`, `O`, `1`, `I`, `l`) — provavelmente para reduzir erros de digitação ao inserir manualmente. | Confirmado por leitura de `generateTempPassword()`. |
| RN-04 | **[Confirmado — responde à pergunta do coordenador, mesmo padrão de risco do UC-21, mas com uma diferença importante]** A senha temporária é enviada **em texto plano** dentro do corpo HTML do e-mail de boas-vindas (`generateConsultantWelcomeEmail`), junto ao código de 6 dígitos — mesmo padrão de exposição de senha em texto plano identificado no UC-21 (lá, digitada pelo admin e visível na tela; aqui, gerada pelo sistema e visível no corpo de um e-mail, que pode ficar armazenado indefinidamente em caixas de entrada, encaminhamentos, backups de servidor de e-mail etc. — superfície de exposição arguivelmente maior). **Diferença importante em relação ao UC-21:** aqui, `requirePasswordChange: true` **é** definido nos custom claims e no documento `users`, então o mecanismo de troca obrigatória de senha no primeiro acesso (UC-06) **é** corretamente enforced — diferente do UC-21, onde essa flag não era setada. | Confirmado por leitura de `generateConsultantWelcomeEmail()` (senha em texto plano no HTML) e da definição de custom claims/documento `users` na rota (linha `requirePasswordChange: true` em ambos). |
| RN-05 | **[Achado — sem rollback]** Se qualquer etapa após a criação do usuário no Firebase Auth falhar (escrita em `consultants`, `setCustomUserClaims`, escrita em `users`), não há nenhuma lógica de reversão — diferente do UC-21, que documenta explicitamente um rollback mais completo para o fluxo de criação de tenant+admin. Um usuário Auth "órfão" (sem consultor nem documento `users`) pode ficar para trás. | Confirmado por leitura completa de `POST /api/consultants` — ausência de qualquer bloco de rollback/compensação. |
| RN-06 | **[Achado de duplicação de código]** Existe uma função `createConsultant` em `src/lib/services/consultantService.ts` (client-side) que reimplementa parcialmente esta lógica (gera código único, cria só o documento Firestore) — mas **nunca é chamada em nenhum lugar do código-fonte**. A tela usa exclusivamente a API route. Mesmo padrão de código morto já visto em `consultantService.ts` no UC-23 (RN-06). | Confirmado por grep — zero ocorrências de `createConsultant(` fora da própria definição. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A senha temporária trafega em texto plano por e-mail (RN-04) — recomenda-se, como já sinalizado no UC-21, migrar para um mecanismo sem exposição de plaintext (ex.: link de definição de senha, como já usado no UC-02 via `generatePasswordResetLink`). | Segurança |
| RNF-02 | A validação de Bearer token e permissão (`is_system_admin`) está correta e completa, seguindo o padrão já validado em UC-21/UC-23. | Segurança |
| RNF-03 | Geração de código com `crypto.randomInt` e senha com `crypto.randomInt` (não `Math.random()`) — uso correto de fontes de aleatoriedade criptograficamente seguras. | Segurança |

---

## 11. Frequência de Uso
Ocasional — cadastro de novos consultores não é uma operação do dia a dia.

---

## 12. Casos de Uso Relacionados
- **UC-21 (Cadastrar Nova Clínica)** — mesmo padrão de risco de senha em texto plano (RN-04), mas este UC corrige parcialmente o problema ao forçar a troca no primeiro acesso.
- **UC-02 (Aprovar Solicitação de Acesso)** — mecanismo mais seguro de entrega de senha (link de redefinição, sem plaintext) que poderia ser adotado aqui.
- **UC-06 (Trocar Senha Obrigatória no Primeiro Acesso)** — mecanismo efetivamente acionado por este UC, via `requirePasswordChange: true`.
- **UC-23 (Vincular/Alterar/Remover Consultor via Painel Admin)** e **UC-24 a UC-27 (módulo Consultor — vínculo com clínicas)** — usam o consultor cadastrado por este UC.
- **[Não mapeado]** Edição/Suspensão/Reativação de consultor (`toggleConsultantStatus`, `updateConsultant` em `consultantService.ts`) e redefinição de senha do consultor (`api/consultants/[id]/reset-password/route.ts`) — prováveis próximos UCs deste módulo.

---

## 13. Referências
- `src/app/(admin)/admin/consultants/new/page.tsx`
- `src/app/api/consultants/route.ts` (GET/POST)
- `src/lib/services/consultantService.ts` (`createConsultant` — órfão, RN-06)
- `src/types/index.ts` (`Consultant`, `CustomClaims`, `UserRole`)
- `firestore.rules` (`consultants/{consultantId}`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-04]** Decisão de produto pendente, compartilhada com o UC-21: migrar o envio de senha temporária em texto plano (aqui, por e-mail) para um mecanismo sem exposição de plaintext.
2. **[RN-05]** Ausência de rollback em caso de falha parcial após a criação do usuário no Auth — pode deixar usuários órfãos no Firebase Auth.
3. **[RN-02]** Janela de corrida teórica na geração de código único (checagem e escrita não atômicas) — risco baixo, mas existente em cenários de alta concorrência.
4. **[RN-06]** `createConsultant` em `consultantService.ts` é código morto — decisão de produto pendente sobre removê-lo ou não.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 14/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero. Confirmadas as três perguntas do coordenador: (1) senha temporária trafega em texto plano por e-mail — mesmo padrão de risco do UC-21, mas com `requirePasswordChange: true` corretamente enforced, diferente daquele UC (RN-04); (2) código de 6 dígitos gerado com `crypto.randomInt`, colisão tecnicamente possível mas ativamente checada, com janela de corrida teórica por falta de atomicidade (RN-02); (3) duplicidade de e-mail checada em duas camadas (coleção `consultants` + Firebase Auth), e confirmado que não existe campo de CPF/CNPJ para consultores. Achados adicionais: ausência de rollback em falha parcial pós-criação do usuário Auth (RN-05) e função client-side órfã duplicando parte da lógica (RN-06). Primeiro UC do módulo "Admin — Gestão de Consultores". |
