# Documentação Experimental - Fluxo de Reset de Senha

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Fluxo de Reset de Senha (`/forgot-password` + `/reset-password/[token]`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

O fluxo de reset de senha permite que usuários que esqueceram suas credenciais possam redefinir a senha de forma segura. O sistema implementa um fluxo em **duas etapas** com tokens de uso único e tempo limitado.

**Importante:** Este documento cobre o fluxo **iniciado pelo próprio usuário**. Existe também um fluxo de reset de senha **iniciado por administrador** (não coberto aqui).

### 1.1 Componentes do Fluxo

1. **Forgot Password Page** (`/forgot-password`): Solicita email e envia link
2. **Reset Password Page** (`/reset-password/[token]`): Define nova senha
3. **APIs de Suporte:**
   - `POST /api/auth/reset-password`: Executa o reset
   - `GET /api/auth/validate-reset-token`: Valida token
4. **Serviço de Tokens:** Gerencia tokens seguros de uso único

### 1.2 Localização dos Arquivos
- **Forgot Password:** `src/app/(auth)/forgot-password/page.tsx`
- **Reset Password:** `src/app/(auth)/reset-password/[token]/page.tsx`
- **API Reset:** `src/app/api/auth/reset-password/route.ts`
- **API Validate:** `src/app/api/auth/validate-reset-token/route.ts`
- **Serviço:** `src/lib/services/passwordResetService.ts`

### 1.3 Dependências Principais
- **Firebase Auth:** `sendPasswordResetEmail` (método nativo do Firebase)
- **Firebase Admin:** Atualização de senha e custom claims
- **Firestore:** Armazenamento de tokens
- **crypto (Node.js):** Geração e hash de tokens
- **passwordResetService:** Lógica de negócio de tokens

---

## 2. Arquitetura do Sistema de Tokens

### 2.1 Por Que Não Usar Apenas Firebase?

O Firebase Auth possui `sendPasswordResetEmail` nativo, mas o sistema implementa uma camada adicional de tokens por:

1. **Controle Total:** Administradores podem gerar links de reset
2. **Auditoria:** Rastreamento de quem criou cada token
3. **Invalidação:** Possibilidade de invalidar tokens manualmente
4. **Multi-tenant:** Associação de tokens a tenants
5. **Customização:** Controle sobre expiração e regras de negócio

### 2.2 Estrutura do Token

```typescript
interface PasswordResetTokenData {
  token_hash: string;              // Hash SHA-256 do token
  user_id: string;                 // Firebase Auth UID
  user_email: string;              // Email do usuário
  tenant_id?: string;              // ID do tenant (multi-tenant)
  expires_at: Timestamp;           // Expiração (30 minutos)
  created_at: Timestamp;           // Data de criação
  created_by: string;              // Quem criou (user_id ou "system")
  used_at?: Timestamp;             // Quando foi usado
  invalidated_at?: Timestamp;      // Quando foi invalidado
}
```

### 2.3 Segurança do Token

**Geração:**
- Token: 32 bytes aleatórios (64 caracteres hex)
- Método: `crypto.randomBytes(32).toString("hex")`
- Exemplo: `a1b2c3d4e5f6...` (64 caracteres)

**Armazenamento:**
- Apenas o **hash SHA-256** é armazenado no banco
- Token original nunca é salvo
- Impossível recuperar token a partir do hash

**Validação:**
- Token recebido é hasheado
- Hash é comparado com banco de dados
- Se match, token é válido

---
## 3. Casos de Uso - Forgot Password Page

### 3.1 UC-001: Solicitação de Reset Bem-Sucedida

**Ator:** Usuário que esqueceu a senha  
**Pré-condições:**
- Usuário possui conta no sistema
- Email está cadastrado no Firebase Auth
- Usuário não está autenticado

**Fluxo Principal:**
1. Usuário acessa `/forgot-password`
2. Sistema exibe formulário com campo de email
3. Usuário digita email: "usuario@exemplo.com"
4. Usuário clica em "Enviar link de recuperação"
5. Sistema chama `sendPasswordResetEmail` do Firebase
6. Firebase envia email com link de reset
7. Sistema exibe mensagem de sucesso
8. Usuário recebe email na caixa de entrada

**Pós-condições:**
- Email enviado com link de reset
- Link válido por tempo limitado (configurado no Firebase)
- Usuário pode clicar no link para redefinir senha

**Mensagem Exibida:**
```
✓ Email enviado com sucesso!

Verifique sua caixa de entrada e siga as instruções 
para redefinir sua senha.

Não se esqueça de verificar a pasta de spam.
```

---

### 3.2 UC-002: Email Não Encontrado

**Ator:** Usuário  
**Pré-condições:**
- Email não está cadastrado no sistema

**Fluxo Principal:**
1. Usuário acessa `/forgot-password`
2. Usuário digita email não cadastrado
3. Usuário clica em "Enviar link de recuperação"
4. Firebase retorna erro `auth/user-not-found`
5. Sistema exibe erro: "Usuário não encontrado"

**Pós-condições:**
- Email NÃO enviado
- Usuário permanece na página
- Pode tentar com outro email

**Regra de Negócio:**
- Por segurança, alguns sistemas não revelam se email existe
- Este sistema opta por informar claramente (melhor UX)

---

### 3.3 UC-003: Email Inválido

**Ator:** Usuário  
**Pré-condições:**
- Usuário digita email com formato inválido

**Fluxo Principal:**
1. Usuário digita: "emailinvalido"
2. Usuário clica em "Enviar link de recuperação"
3. Firebase retorna erro `auth/invalid-email`
4. Sistema exibe erro: "Email inválido"

**Pós-condições:**
- Email NÃO enviado
- Usuário corrige formato

---

### 3.4 UC-004: Muitas Tentativas (Rate Limiting)

**Ator:** Usuário  
**Pré-condições:**
- Usuário fez múltiplas tentativas em curto período

**Fluxo Principal:**
1. Usuário tenta enviar email múltiplas vezes
2. Firebase detecta rate limiting
3. Firebase retorna erro `auth/too-many-requests`
4. Sistema exibe erro: "Muitas tentativas. Tente novamente mais tarde"

**Pós-condições:**
- Email NÃO enviado
- Usuário deve aguardar antes de tentar novamente

**Regra de Negócio:**
- Proteção contra abuso e spam
- Rate limiting gerenciado pelo Firebase

---

### 3.5 UC-005: Erro de Conexão

**Ator:** Usuário  
**Pré-condições:**
- Problema de conectividade

**Fluxo Principal:**
1. Usuário tenta enviar email
2. Requisição falha por problema de rede
3. Firebase retorna erro `auth/network-request-failed`
4. Sistema exibe erro: "Erro de conexão. Verifique sua internet"

**Pós-condições:**
- Email NÃO enviado
- Usuário pode tentar novamente quando conexão estabilizar

---

## 4. Casos de Uso - Reset Password Page

### 4.1 UC-006: Reset de Senha Bem-Sucedido

**Ator:** Usuário com link válido  
**Pré-condições:**
- Usuário recebeu email com link
- Token é válido e não expirado
- Token não foi usado anteriormente

**Fluxo Principal:**
1. Usuário clica no link do email
2. Sistema redireciona para `/reset-password/[token]`
3. Sistema valida token via API `validate-reset-token`
4. API verifica:
   - Token existe no banco (hash match)
   - Token não foi usado (`used_at` é null)
   - Token não foi invalidado (`invalidated_at` é null)
   - Token não expirou (< 30 minutos)
5. API retorna sucesso com email mascarado
6. Sistema exibe formulário de nova senha
7. Sistema mostra email mascarado: "u***o@exemplo.com"
8. Usuário digita nova senha: "novaSenha123"
9. Usuário confirma senha: "novaSenha123"
10. Usuário clica em "Definir Nova Senha"
11. Sistema valida senhas (mínimo 6 caracteres, coincidem)
12. Sistema chama API `reset-password`
13. API consome token (marca como usado)
14. API atualiza senha no Firebase Auth
15. API remove flag `requirePasswordChange` se existir
16. API atualiza documento do usuário no Firestore
17. API invalida outros tokens pendentes do usuário
18. Sistema exibe mensagem de sucesso
19. Sistema aguarda 3 segundos
20. Sistema redireciona para `/login`

**Pós-condições:**
- Senha atualizada no Firebase Auth
- Token marcado como usado
- Flag `requirePasswordChange` removida
- Campo `passwordChangedAt` atualizado
- Outros tokens do usuário invalidados
- Usuário pode fazer login com nova senha

---

### 4.2 UC-007: Token Inválido ou Expirado

**Ator:** Usuário com link inválido  
**Pré-condições:**
- Token não existe, expirou ou foi usado

**Fluxo Principal:**
1. Usuário acessa link com token inválido
2. Sistema valida token via API
3. API detecta problema:
   - Token não encontrado no banco
   - Token expirou (> 30 minutos)
   - Token já foi usado
   - Token foi invalidado
4. API retorna erro específico
5. Sistema exibe tela de erro com ícone vermelho
6. Sistema mostra mensagem apropriada
7. Sistema oferece botão "Voltar ao Login"

**Mensagens Possíveis:**
- "Token inválido ou expirado"
- "Este link já foi utilizado. Solicite um novo reset de senha."
- "Este link foi invalidado. Solicite um novo reset de senha."
- "Este link expirou. Solicite um novo reset de senha."

**Pós-condições:**
- Senha NÃO alterada
- Usuário deve solicitar novo reset

---

### 4.3 UC-008: Senhas Não Coincidem

**Ator:** Usuário  
**Pré-condições:**
- Token válido
- Usuário preencheu senhas diferentes

**Fluxo Principal:**
1. Usuário digita nova senha: "senha123"
2. Usuário confirma senha: "senha124"
3. Usuário clica em "Definir Nova Senha"
4. Sistema compara senhas no frontend
5. Sistema detecta diferença
6. Sistema exibe erro: "As senhas não coincidem"
7. Usuário corrige senhas

**Pós-condições:**
- Senha NÃO alterada
- Token ainda válido (não foi consumido)
- Usuário pode tentar novamente

---

### 4.4 UC-009: Senha Muito Curta

**Ator:** Usuário  
**Pré-condições:**
- Token válido
- Usuário digitou senha com menos de 6 caracteres

**Fluxo Principal:**
1. Usuário digita nova senha: "12345"
2. Usuário confirma senha: "12345"
3. Usuário clica em "Definir Nova Senha"
4. Sistema valida tamanho no frontend
5. Sistema detecta senha curta
6. Sistema exibe erro: "A senha deve ter pelo menos 6 caracteres"
7. Usuário digita senha mais longa

**Pós-condições:**
- Senha NÃO alterada
- Token ainda válido

**Validação Adicional:**
- Backend também valida (dupla validação)
- Firebase Auth pode rejeitar senhas muito fracas

---

### 4.5 UC-010: Validação de Token em Andamento

**Ator:** Usuário  
**Pré-condições:**
- Usuário acabou de acessar link

**Fluxo Principal:**
1. Usuário clica no link do email
2. Sistema carrega página `/reset-password/[token]`
3. Sistema inicia validação do token
4. Sistema exibe tela de loading:
   - Ícone de loading animado
   - Título: "Validando Link..."
   - Descrição: "Aguarde enquanto verificamos seu link..."
5. Validação completa (< 1 segundo)
6. Sistema exibe formulário ou erro

**Pós-condições:**
- Usuário informado sobre o processo
- Melhor experiência (não vê tela em branco)

---

### 4.6 UC-011: Sucesso com Redirecionamento Automático

**Ator:** Usuário  
**Pré-condições:**
- Senha foi redefinida com sucesso

**Fluxo Principal:**
1. Senha atualizada com sucesso
2. Sistema exibe tela de sucesso:
   - Ícone verde de check
   - Título: "Senha Redefinida!"
   - Descrição: "Sua senha foi alterada com sucesso."
   - Alert: "Você será redirecionado para a página de login automaticamente..."
3. Sistema aguarda 3 segundos
4. Sistema redireciona para `/login`
5. Usuário pode fazer login imediatamente

**Alternativa:**
- Usuário pode clicar em "Fazer Login Agora" (não espera 3s)

**Pós-condições:**
- Usuário na página de login
- Pode usar nova senha imediatamente

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE RESET DE SENHA                       │
└─────────────────────────────────────────────────────────────────┘

ETAPA 1: SOLICITAR RESET
═══════════════════════════════════════════════════════════════════

    Usuário acessa /forgot-password
              │
              ▼
    ┌──────────────────────┐
    │ Formulário:          │
    │ - Email              │
    │ - Botão "Enviar"     │
    └──────────────────────┘
              │
              ▼
    Usuário digita email e submete
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Auth                │
    │ sendPasswordResetEmail()     │
    └──────────────────────────────┘
         │              │
    SUCESSO│              │ERRO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Email enviado│  │ Exibir erro      │
│ Mensagem de  │  │ - user-not-found │
│ sucesso      │  │ - invalid-email  │
└──────────────┘  │ - too-many-req   │
                  └──────────────────┘

═══════════════════════════════════════════════════════════════════
ETAPA 2: RECEBER EMAIL
═══════════════════════════════════════════════════════════════════

    Usuário recebe email do Firebase
              │
              ▼
    Email contém link:
    https://app.com/reset-password/[token]
              │
              ▼
    Usuário clica no link

═══════════════════════════════════════════════════════════════════
ETAPA 3: VALIDAR TOKEN
═══════════════════════════════════════════════════════════════════

    Página carrega: /reset-password/[token]
              │
              ▼
    ┌──────────────────────────────┐
    │ Exibir loading               │
    │ "Validando Link..."          │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ GET /api/auth/               │
    │ validate-reset-token         │
    │ ?token=[token]               │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Buscar token no Firestore    │
    │ (por hash SHA-256)           │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Verificar:                   │
    │ - Token existe?              │
    │ - Não foi usado?             │
    │ - Não foi invalidado?        │
    │ - Não expirou? (< 30min)     │
    └──────────────────────────────┘
         │              │
    VÁLIDO│              │INVÁLIDO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Retornar:    │  │ Retornar erro    │
│ - valid:true │  │ - valid:false    │
│ - email_mask │  │ - error:msg      │
└──────────────┘  └──────────────────┘
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Exibir form  │  │ Exibir tela de   │
│ nova senha   │  │ erro com ícone   │
└──────────────┘  │ vermelho         │
                  └──────────────────┘

═══════════════════════════════════════════════════════════════════
ETAPA 4: DEFINIR NOVA SENHA
═══════════════════════════════════════════════════════════════════

    ┌──────────────────────────────┐
    │ Formulário:                  │
    │ - Nova senha                 │
    │ - Confirmar senha            │
    │ - Email mascarado exibido    │
    │ - Dicas de senha segura      │
    └──────────────────────────────┘
              │
              ▼
    Usuário preenche e submete
              │
              ▼
    ┌──────────────────────────────┐
    │ Validações Frontend:         │
    │ - Senha >= 6 caracteres?     │
    │ - Senhas coincidem?          │
    └──────────────────────────────┘
         │              │
    VÁLIDO│              │INVÁLIDO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Enviar para  │  │ Exibir erro      │
│ API          │  └──────────────────┘
└──────────────┘
         │
         ▼
┌──────────────────────────────┐
│ POST /api/auth/reset-password│
│ Body: {                      │
│   token: string,             │
│   new_password: string       │
│ }                            │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 1. Consumir token            │
│    - Marcar como usado       │
│    - Verificar validade      │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. Atualizar senha           │
│    Firebase Auth             │
│    updateUser(uid, {         │
│      password: new_password  │
│    })                        │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 3. Remover flag              │
│    requirePasswordChange     │
│    (custom claims)           │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 4. Atualizar Firestore       │
│    users/{uid}:              │
│    - requirePasswordChange   │
│    - passwordChangedAt       │
│    - updated_at              │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 5. Invalidar outros tokens   │
│    do usuário                │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Retornar sucesso             │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Exibir tela de sucesso       │
│ com ícone verde              │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Aguardar 3 segundos          │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Redirecionar para /login     │
└──────────────────────────────┘
```

---
## 6. Regras de Negócio

### RN-001: Expiração de Token
**Descrição:** Tokens de reset expiram após 30 minutos da criação  
**Aplicação:** Validação de token antes de permitir reset  
**Exceções:** Nenhuma - todos os tokens expiram  
**Justificativa:** Segurança - limitar janela de vulnerabilidade

### RN-002: Token de Uso Único
**Descrição:** Cada token pode ser usado apenas uma vez  
**Aplicação:** Token é marcado como usado após consumo  
**Exceções:** Nenhuma  
**Justificativa:** Prevenir reutilização maliciosa de links

### RN-003: Invalidação de Tokens Anteriores
**Descrição:** Ao criar novo token, tokens anteriores do usuário são invalidados  
**Aplicação:** Criação de novo token e após reset bem-sucedido  
**Exceções:** Nenhuma  
**Justificativa:** Apenas o link mais recente deve funcionar

### RN-004: Hash de Token
**Descrição:** Apenas hash SHA-256 do token é armazenado, nunca o token original  
**Aplicação:** Armazenamento no Firestore  
**Exceções:** Nenhuma  
**Justificativa:** Segurança - mesmo com acesso ao banco, tokens não podem ser recuperados

### RN-005: Senha Mínima
**Descrição:** Nova senha deve ter no mínimo 6 caracteres  
**Aplicação:** Validação frontend e backend  
**Exceções:** Nenhuma  
**Justificativa:** Segurança básica, alinhado com Firebase Auth

### RN-006: Remoção de Flag requirePasswordChange
**Descrição:** Ao redefinir senha, flag `requirePasswordChange` é removida  
**Aplicação:** Após reset bem-sucedido  
**Exceções:** Nenhuma  
**Justificativa:** Usuário já trocou senha, não precisa trocar novamente

### RN-007: Email Mascarado
**Descrição:** Email é exibido mascarado na página de reset (ex: u***o@exemplo.com)  
**Aplicação:** Página de reset de senha  
**Exceções:** Nenhuma  
**Justificativa:** Privacidade - confirma identidade sem expor email completo

### RN-008: Rate Limiting do Firebase
**Descrição:** Firebase limita número de emails de reset por período  
**Aplicação:** Gerenciado automaticamente pelo Firebase  
**Exceções:** Nenhuma  
**Justificativa:** Prevenir abuso e spam

---

## 7. Estados da Interface

### 7.1 Forgot Password Page

#### Estado: Formulário Inicial
**Quando:** Usuário acessa `/forgot-password`  
**Exibição:**
- Título: "Recuperar Senha"
- Descrição: "Digite seu email para receber o link de recuperação"
- Campo: Email (type: email, required, autofocus)
- Botão: "Enviar link de recuperação"
- Link: "Voltar para login" → `/login`

#### Estado: Processando
**Quando:** Usuário submeteu formulário  
**Exibição:**
- Botão desabilitado
- Texto: "Enviando..."
- Campo desabilitado

#### Estado: Sucesso
**Quando:** Email enviado com sucesso  
**Exibição:**
- Ícone verde de email
- Título: "Email enviado com sucesso!"
- Mensagem principal
- Aviso: "Não se esqueça de verificar a pasta de spam."
- Link: "Voltar para login"

#### Estado: Erro
**Quando:** Falha ao enviar email  
**Exibição:**
- Alert vermelho com mensagem de erro
- Formulário habilitado para nova tentativa
- Mensagens traduzidas em português

### 7.2 Reset Password Page

#### Estado: Validando Token
**Quando:** Página acabou de carregar  
**Exibição:**
- Ícone de loading animado (spinner)
- Título: "Validando Link..."
- Descrição: "Aguarde enquanto verificamos seu link de redefinição de senha."

#### Estado: Token Inválido
**Quando:** Token não passou na validação  
**Exibição:**
- Ícone vermelho de erro (XCircle)
- Título: "Link Inválido"
- Alert vermelho com mensagem específica
- Texto: "Se você precisa redefinir sua senha, entre em contato com o administrador do sistema."
- Botão: "Voltar ao Login"

#### Estado: Formulário de Nova Senha
**Quando:** Token válido  
**Exibição:**
- Ícone azul de chave (KeyRound)
- Título: "Nova Senha"
- Descrição: "Defina uma nova senha para sua conta"
- Email mascarado exibido
- Campos:
  - Nova Senha (password, required, autofocus)
  - Confirmar Senha (password, required)
- Dica: "Mínimo de 6 caracteres"
- Box com dicas de senha segura
- Botão: "Definir Nova Senha"
- Link: "Voltar ao Login"

#### Estado: Processando Reset
**Quando:** Usuário submeteu nova senha  
**Exibição:**
- Botão desabilitado
- Ícone de loading no botão
- Texto: "Salvando..."
- Campos desabilitados

#### Estado: Sucesso
**Quando:** Senha redefinida com sucesso  
**Exibição:**
- Ícone verde de check (CheckCircle2)
- Título: "Senha Redefinida!"
- Descrição: "Sua senha foi alterada com sucesso."
- Alert verde: "Você será redirecionado para a página de login automaticamente..."
- Botão: "Fazer Login Agora"

#### Estado: Erro de Validação
**Quando:** Senhas não coincidem ou muito curtas  
**Exibição:**
- Alert vermelho com mensagem de erro
- Formulário habilitado para correção
- Campos mantêm valores (exceto senhas por segurança)

---

## 8. Validações

### 8.1 Forgot Password - Frontend

**Email:**
- Obrigatório (HTML5 required)
- Type: email (validação básica do navegador)
- Mensagem: Gerenciada pelo Firebase

### 8.2 Forgot Password - Firebase

**Email:**
- Formato válido
- Usuário existe no sistema
- Rate limiting (automático)

**Erros Possíveis:**
- `auth/user-not-found` → "Usuário não encontrado"
- `auth/invalid-email` → "Email inválido"
- `auth/too-many-requests` → "Muitas tentativas. Tente novamente mais tarde"
- `auth/network-request-failed` → "Erro de conexão. Verifique sua internet"

### 8.3 Reset Password - Frontend

**Nova Senha:**
- Obrigatório
- Mínimo 6 caracteres
- Mensagem: "A senha deve ter pelo menos 6 caracteres"

**Confirmar Senha:**
- Obrigatório
- Deve ser igual à nova senha
- Mensagem: "As senhas não coincidem"

### 8.4 Reset Password - Backend (API)

**Token:**
- Obrigatório
- Deve existir no banco (hash match)
- Não pode estar usado
- Não pode estar invalidado
- Não pode estar expirado (< 30 minutos)

**Nova Senha:**
- Obrigatório
- Mínimo 6 caracteres
- Firebase pode rejeitar senhas muito fracas

**Erros Possíveis:**
- "Token não fornecido"
- "Nova senha não fornecida"
- "A senha deve ter pelo menos 6 caracteres"
- "Token inválido ou expirado"
- "Este link já foi utilizado"
- "Este link foi invalidado"
- "Este link expirou"
- "Usuário não encontrado"
- "A senha é muito fraca. Use pelo menos 6 caracteres"

---

## 9. Integrações

### 9.1 Firebase Auth - sendPasswordResetEmail
- **Uso:** Enviar email com link de reset
- **Método:** `sendPasswordResetEmail(auth, email, options)`
- **Parâmetros:**
  - `auth`: Instância do Firebase Auth
  - `email`: Email do usuário
  - `options`: Configurações (URL de retorno, handleCodeInApp)
- **Retorno:** Promise<void>
- **Erros:** Códigos de erro do Firebase

### 9.2 API - Validate Reset Token
- **Endpoint:** `GET /api/auth/validate-reset-token`
- **Query Params:** `?token=[token]`
- **Resposta Sucesso:**
```json
{
  "valid": true,
  "email_masked": "u***o@exemplo.com"
}
```
- **Resposta Erro:**
```json
{
  "valid": false,
  "error": "Mensagem de erro"
}
```

### 9.3 API - Reset Password
- **Endpoint:** `POST /api/auth/reset-password`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "token": "string",
  "new_password": "string"
}
```
- **Resposta Sucesso:**
```json
{
  "success": true,
  "message": "Senha redefinida com sucesso! Você já pode fazer login."
}
```
- **Resposta Erro:**
```json
{
  "success": false,
  "error": "Mensagem de erro"
}
```

### 9.4 Firestore - password_reset_tokens
- **Coleção:** `password_reset_tokens`
- **Operações:**
  - Create: Criar novo token
  - Read: Buscar por hash
  - Update: Marcar como usado/invalidado
- **Índices Necessários:**
  - `token_hash` (para busca rápida)
  - `user_id` + `used_at` (para invalidação)

### 9.5 Firebase Admin - updateUser
- **Uso:** Atualizar senha do usuário
- **Método:** `adminAuth.updateUser(uid, { password })`
- **Quando:** Após validar e consumir token
- **Efeito:** Senha atualizada no Firebase Auth

### 9.6 Firebase Admin - setCustomUserClaims
- **Uso:** Remover flag requirePasswordChange
- **Método:** `adminAuth.setCustomUserClaims(uid, claims)`
- **Quando:** Após atualizar senha
- **Efeito:** Custom claims atualizados

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Token de uso único (não pode ser reutilizado)
- ✅ Expiração de 30 minutos (janela limitada)
- ✅ Hash SHA-256 (token nunca armazenado em texto plano)
- ✅ Invalidação de tokens anteriores (apenas o mais recente funciona)
- ✅ Validação dupla (frontend + backend)
- ✅ Rate limiting do Firebase (previne spam)
- ✅ Email mascarado (privacidade)
- ✅ HTTPS obrigatório (transporte seguro)
- ✅ Remoção de flag requirePasswordChange (evita loops)

### 10.2 Fluxo de Segurança do Token

1. **Geração:**
   - 32 bytes aleatórios (crypto.randomBytes)
   - 64 caracteres hexadecimais
   - Entropia: 2^256 possibilidades

2. **Armazenamento:**
   - Apenas hash SHA-256 salvo
   - Token original descartado após envio
   - Impossível recuperar token do banco

3. **Transmissão:**
   - Token enviado via HTTPS
   - Incluído na URL do link
   - Não exposto em logs (deve ser tratado como sensível)

4. **Validação:**
   - Token recebido é hasheado
   - Hash comparado com banco
   - Verificações adicionais (expiração, uso, invalidação)

5. **Consumo:**
   - Token marcado como usado
   - Não pode ser usado novamente
   - Outros tokens do usuário invalidados

### 10.3 Vetores de Ataque Mitigados

**Brute Force:**
- Impossível adivinhar token (2^256 possibilidades)
- Rate limiting do Firebase

**Replay Attack:**
- Token de uso único
- Marcado como usado após consumo

**Token Theft:**
- Expiração de 30 minutos
- Invalidação ao criar novo token
- HTTPS obrigatório

**Database Breach:**
- Apenas hash armazenado
- Token original não recuperável

---

## 11. Performance

### 11.1 Métricas Estimadas

**Forgot Password:**
- Carregamento da página: ~300ms
- Envio de email: ~1-2 segundos
- Total: ~2-3 segundos

**Reset Password:**
- Carregamento da página: ~300ms
- Validação de token: ~500ms
- Reset de senha: ~1-2 segundos
- Total: ~2-3 segundos

### 11.2 Otimizações Implementadas
- ✅ Validação de token em paralelo ao carregamento da página
- ✅ Feedback visual imediato (loading states)
- ✅ Validação frontend antes de chamar API
- ✅ Índices no Firestore para busca rápida de tokens
- ✅ Batch operations para invalidação de múltiplos tokens

### 11.3 Gargalos Potenciais
- Envio de email pelo Firebase (depende de serviço externo)
- Busca de token no Firestore (mitigado com índices)
- Hash SHA-256 (rápido, < 1ms)

---

## 12. Diferenças: Firebase Nativo vs Sistema Customizado

| Aspecto | Firebase Nativo | Sistema Customizado |
|---------|-----------------|---------------------|
| **Geração de Link** | Apenas pelo Firebase | Admin pode gerar manualmente |
| **Controle de Expiração** | Configurado no console | Controlado no código (30 min) |
| **Auditoria** | Limitada | Completa (quem criou, quando) |
| **Invalidação** | Não suportada | Suportada |
| **Multi-tenant** | Não nativo | Associação com tenant_id |
| **Customização** | Limitada | Total |
| **Complexidade** | Baixa | Média |
| **Manutenção** | Firebase gerencia | Equipe gerencia |

**Por que usar sistema customizado?**
- Administradores podem gerar links de reset
- Auditoria completa de tokens
- Controle sobre regras de negócio
- Suporte a multi-tenant
- Invalidação manual de tokens

---
## 13. Melhorias Futuras

### 13.1 Funcionalidades
- [ ] Notificação por SMS além de email
- [ ] Histórico de resets de senha
- [ ] Alertas de segurança (email quando senha é alterada)
- [ ] Opção de "Não fui eu" no email
- [ ] Verificação de identidade adicional (perguntas de segurança)
- [ ] Suporte a autenticação de dois fatores (2FA)
- [ ] Blacklist de senhas comuns
- [ ] Verificação de senha comprometida (Have I Been Pwned API)
- [ ] Expiração configurável por tenant
- [ ] Limite de tentativas de reset por período

### 13.2 UX/UI
- [ ] Indicador de força de senha em tempo real
- [ ] Mostrar/ocultar senha
- [ ] Sugestão de senha segura
- [ ] Animações de transição
- [ ] Progress bar durante processamento
- [ ] Confirmação visual de cada etapa
- [ ] Modo escuro
- [ ] Internacionalização (i18n)

### 13.3 Segurança
- [ ] Captcha na página de forgot password
- [ ] Verificação de dispositivo conhecido
- [ ] Geolocalização de tentativas de reset
- [ ] Bloqueio temporário após múltiplas tentativas
- [ ] Notificação de admin sobre resets suspeitos
- [ ] Auditoria de IPs que solicitaram reset
- [ ] Senha não pode ser igual às últimas 3 senhas
- [ ] Requisitos de senha mais fortes (números, símbolos)

### 13.4 Administração
- [ ] Dashboard de tokens ativos
- [ ] Invalidação manual de tokens por admin
- [ ] Estatísticas de resets de senha
- [ ] Alertas de padrões suspeitos
- [ ] Exportação de logs de auditoria
- [ ] Configuração de políticas de senha por tenant

---

## 14. Observações Técnicas

### 14.1 Decisões de Arquitetura

**Por que usar Firebase sendPasswordResetEmail?**
- Simplicidade para usuário final
- Email templates gerenciados pelo Firebase
- Infraestrutura de email confiável
- Não requer servidor SMTP próprio
- Integração nativa com Firebase Auth

**Por que adicionar camada de tokens customizada?**
- Permite que admins gerem links de reset
- Auditoria completa (quem, quando, por quê)
- Invalidação manual de tokens
- Suporte a multi-tenant
- Controle total sobre regras de negócio

**Por que hash SHA-256?**
- Rápido (< 1ms)
- Seguro para este caso de uso
- Unidirecional (não pode ser revertido)
- Amplamente suportado
- Não requer bcrypt (tokens são temporários)

### 14.2 Padrões Utilizados
- **Token de Uso Único:** Previne replay attacks
- **Hash de Token:** Segurança em caso de breach
- **Expiração Temporal:** Limita janela de vulnerabilidade
- **Invalidação em Cascata:** Apenas token mais recente válido
- **Validação em Camadas:** Frontend → API → Firestore
- **Feedback Progressivo:** Loading states em cada etapa

### 14.3 Limitações Conhecidas
- ⚠️ Email pode cair em spam (depende de configuração do Firebase)
- ⚠️ Não há verificação de identidade adicional
- ⚠️ Não há limite de tentativas de reset por período
- ⚠️ Não há captcha (vulnerável a bots)
- ⚠️ Senha pode ser fraca (apenas 6 caracteres mínimo)
- ⚠️ Não há verificação de senha comprometida
- ⚠️ Não há histórico de senhas anteriores

### 14.4 Dependências Críticas
- **Firebase Auth:** Envio de email e atualização de senha
- **Firebase Admin SDK:** Operações privilegiadas
- **Firestore:** Armazenamento de tokens
- **crypto (Node.js):** Geração e hash de tokens
- **Next.js:** Framework e API routes

---

## 15. Mensagens do Sistema

### 15.1 Forgot Password - Sucesso
- "Email enviado com sucesso!"
- "Verifique sua caixa de entrada e siga as instruções para redefinir sua senha."
- "Não se esqueça de verificar a pasta de spam."

### 15.2 Forgot Password - Erros
- "Usuário não encontrado"
- "Email inválido"
- "Muitas tentativas. Tente novamente mais tarde"
- "Erro de conexão. Verifique sua internet"
- "Erro ao enviar email. Tente novamente"

### 15.3 Reset Password - Validação de Token
- "Validando Link..."
- "Aguarde enquanto verificamos seu link de redefinição de senha."

### 15.4 Reset Password - Token Inválido
- "Link Inválido"
- "Token inválido ou expirado"
- "Este link já foi utilizado. Solicite um novo reset de senha."
- "Este link foi invalidado. Solicite um novo reset de senha."
- "Este link expirou. Solicite um novo reset de senha."
- "Se você precisa redefinir sua senha, entre em contato com o administrador do sistema."

### 15.5 Reset Password - Formulário
- "Nova Senha"
- "Defina uma nova senha para sua conta"
- "Mínimo de 6 caracteres"
- "Dicas para uma senha segura:"
- "Use pelo menos 6 caracteres"
- "Combine letras, números e símbolos"
- "Evite senhas óbvias como '123456'"

### 15.6 Reset Password - Validação
- "A senha deve ter pelo menos 6 caracteres"
- "As senhas não coincidem"

### 15.7 Reset Password - Sucesso
- "Senha Redefinida!"
- "Sua senha foi alterada com sucesso."
- "Você será redirecionado para a página de login automaticamente..."
- "Senha redefinida com sucesso! Você já pode fazer login."

### 15.8 Reset Password - Erros API
- "Token não fornecido"
- "Nova senha não fornecida"
- "Usuário não encontrado"
- "A senha é muito fraca. Use pelo menos 6 caracteres"
- "Erro ao redefinir senha. Tente novamente."

---

## 16. Fluxo Alternativo: Reset por Administrador

**Nota:** Este fluxo não está coberto em detalhes neste documento, mas existe no sistema.

### 16.1 Diferenças
- Administrador acessa painel de usuários
- Administrador clica em "Resetar Senha" para um usuário
- Sistema gera token usando `passwordResetService`
- Sistema envia email com link customizado
- Usuário recebe email e segue mesmo fluxo de reset
- Flag `requirePasswordChange` é definida como `true`
- Usuário é forçado a trocar senha no próximo login

### 16.2 Casos de Uso
- Usuário esqueceu senha e não tem acesso ao email
- Administrador precisa forçar troca de senha
- Conta comprometida
- Política de segurança (troca periódica)

---

## 17. Testes Recomendados

### 17.1 Testes Funcionais

**Forgot Password:**
1. Enviar email com usuário válido → Sucesso
2. Enviar email com usuário inexistente → Erro
3. Enviar email com formato inválido → Erro
4. Enviar múltiplos emails rapidamente → Rate limiting
5. Verificar recebimento de email → Email na caixa de entrada

**Reset Password:**
1. Acessar link válido → Formulário exibido
2. Acessar link expirado → Erro
3. Acessar link já usado → Erro
4. Acessar link invalidado → Erro
5. Definir senha válida → Sucesso
6. Definir senha muito curta → Erro
7. Senhas não coincidem → Erro
8. Fazer login com nova senha → Sucesso

### 17.2 Testes de Segurança
1. Tentar reutilizar token → Bloqueado
2. Tentar usar token após expiração → Bloqueado
3. Tentar adivinhar token → Impossível (2^256)
4. Verificar hash no banco → Não recuperável
5. Criar novo token → Tokens anteriores invalidados
6. Verificar HTTPS → Obrigatório

### 17.3 Testes de Performance
1. Medir tempo de envio de email → < 3s
2. Medir tempo de validação de token → < 500ms
3. Medir tempo de reset de senha → < 2s
4. Testar com múltiplos usuários simultâneos → Escalável

---

## 18. Troubleshooting

### 18.1 Email Não Recebido

**Possíveis Causas:**
- Email caiu em spam
- Email incorreto
- Problema no servidor de email do Firebase
- Rate limiting ativo

**Soluções:**
- Verificar pasta de spam
- Verificar email digitado
- Aguardar alguns minutos e tentar novamente
- Contatar administrador

### 18.2 Link Não Funciona

**Possíveis Causas:**
- Link expirou (> 30 minutos)
- Link já foi usado
- Link foi invalidado
- Token corrompido (copiado incorretamente)

**Soluções:**
- Solicitar novo reset de senha
- Copiar link completo do email
- Contatar administrador

### 18.3 Erro ao Definir Nova Senha

**Possíveis Causas:**
- Senha muito curta (< 6 caracteres)
- Senhas não coincidem
- Problema de conexão
- Token expirou durante preenchimento

**Soluções:**
- Verificar requisitos de senha
- Confirmar senhas coincidem
- Verificar conexão com internet
- Solicitar novo reset se token expirou

---

## 19. Glossário

- **Token:** Código único e temporário usado para autenticar reset de senha
- **Hash:** Resultado de função criptográfica unidirecional (SHA-256)
- **Salt:** Dados aleatórios adicionados antes de hash (não usado aqui)
- **Expiração:** Tempo limite após o qual token não é mais válido
- **Consumir Token:** Marcar token como usado, impedindo reutilização
- **Invalidar Token:** Marcar token como inválido antes de ser usado
- **Email Mascarado:** Email parcialmente oculto (ex: u***o@exemplo.com)
- **Rate Limiting:** Limitação de número de requisições por período
- **Replay Attack:** Tentativa de reutilizar token capturado
- **Custom Claims:** Metadados de permissão no token JWT do Firebase
- **requirePasswordChange:** Flag que força usuário a trocar senha

---

## 20. Referências

### 20.1 Documentação Relacionada
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Register Page Documentation - `project_doc/register-page-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 20.2 Código Fonte
- **Forgot Password:** `src/app/(auth)/forgot-password/page.tsx`
- **Reset Password:** `src/app/(auth)/reset-password/[token]/page.tsx`
- **API Reset:** `src/app/api/auth/reset-password/route.ts`
- **API Validate:** `src/app/api/auth/validate-reset-token/route.ts`
- **Serviço:** `src/lib/services/passwordResetService.ts`
- **Firebase Admin:** `src/lib/firebase-admin.ts`

### 20.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase sendPasswordResetEmail](https://firebase.google.com/docs/auth/web/manage-users#send_a_password_reset_email)
- [Node.js crypto](https://nodejs.org/api/crypto.html)
- [SHA-256](https://en.wikipedia.org/wiki/SHA-2)
- [OWASP Password Reset](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

---

## 21. Diagrama de Sequência

```
Usuário          Forgot Page      Firebase Auth      Email Server
   │                  │                  │                  │
   │  1. Acessa       │                  │                  │
   │ ────────────────>│                  │                  │
   │                  │                  │                  │
   │  2. Digita email │                  │                  │
   │ ────────────────>│                  │                  │
   │                  │                  │                  │
   │  3. Submete      │                  │                  │
   │ ────────────────>│                  │                  │
   │                  │                  │                  │
   │                  │  4. sendPasswordResetEmail()        │
   │                  │ ────────────────>│                  │
   │                  │                  │                  │
   │                  │                  │  5. Envia email  │
   │                  │                  │ ────────────────>│
   │                  │                  │                  │
   │                  │  6. Sucesso      │                  │
   │                  │ <────────────────│                  │
   │                  │                  │                  │
   │  7. Mensagem OK  │                  │                  │
   │ <────────────────│                  │                  │
   │                  │                  │                  │
   │                  │                  │  8. Email        │
   │ <────────────────────────────────────────────────────│
   │                  │                  │                  │

Usuário       Reset Page      API Validate    API Reset    Firebase Admin    Firestore
   │                │                │             │              │               │
   │  9. Clica link │                │             │              │               │
   │ ──────────────>│                │             │              │               │
   │                │                │             │              │               │
   │                │ 10. Valida token             │              │               │
   │                │ ──────────────>│             │              │               │
   │                │                │             │              │               │
   │                │                │ 11. Busca token            │               │
   │                │                │ ───────────────────────────────────────>│
   │                │                │             │              │               │
   │                │                │ 12. Token data             │               │
   │                │                │ <───────────────────────────────────────│
   │                │                │             │              │               │
   │                │ 13. Token válido             │              │               │
   │                │ <──────────────│             │              │               │
   │                │                │             │              │               │
   │ 14. Form exibido                │             │              │               │
   │ <──────────────│                │             │              │               │
   │                │                │             │              │               │
   │ 15. Nova senha │                │             │              │               │
   │ ──────────────>│                │             │              │               │
   │                │                │             │              │               │
   │                │ 16. Reset senha              │              │               │
   │                │ ────────────────────────────>│              │               │
   │                │                │             │              │               │
   │                │                │             │ 17. Consome token            │
   │                │                │             │ ─────────────────────────>│
   │                │                │             │              │               │
   │                │                │             │ 18. updateUser(password)    │
   │                │                │             │ ────────────>│               │
   │                │                │             │              │               │
   │                │                │             │ 19. setCustomUserClaims     │
   │                │                │             │ ────────────>│               │
   │                │                │             │              │               │
   │                │                │             │ 20. Update Firestore        │
   │                │                │             │ ─────────────────────────>│
   │                │                │             │              │               │
   │                │ 21. Sucesso                  │              │               │
   │                │ <────────────────────────────│              │               │
   │                │                │             │              │               │
   │ 22. Redireciona                 │             │              │               │
   │    para /login │                │             │              │               │
   │ <──────────────│                │             │              │               │
```

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Aprovado
