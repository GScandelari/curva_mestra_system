# Documentação Experimental - Página Activate

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Ativação de Conta (`/activate`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página Activate é uma **tela de ativação de conta** que permite que usuários aprovados ativem suas contas usando um código de 8 dígitos enviado por email. Esta página faz parte de um fluxo de aprovação onde o System Admin aprova solicitações e o sistema envia códigos de ativação.

### 1.1 Status Atual

⚠️ **IMPORTANTE:** A função `activateAccountWithCode` está **depreciada** segundo o código:

```typescript
return {
  success: false,
  message: "Esta função foi depreciada. Use o novo fluxo de aprovação automática.",
};
```

Isso indica que esta página pode estar em processo de descontinuação ou substituição por um novo fluxo.

### 1.2 Propósito Original

- Permitir ativação de conta com código de 8 dígitos
- Validar email e código
- Criar usuário no Firebase Auth
- Configurar custom claims e tenant
- Primeira etapa após aprovação do admin

### 1.3 Fluxo Completo (Original)

```
1. Usuário solicita acesso (/register)
   ↓
2. System Admin aprova solicitação
   ↓
3. Sistema gera código de 8 dígitos
   ↓
4. Sistema envia email com código
   ↓
5. Usuário acessa /activate
   ↓
6. Usuário insere email + código
   ↓
7. Conta criada no Firebase Auth
   ↓
8. Usuário pode fazer login
```

### 1.4 Localização
- **Arquivo:** `src/app/(auth)/activate/page.tsx`
- **Rota:** `/activate`
- **Layout:** Auth Layout (sem navegação principal)

### 1.5 Dependências Principais
- **Serviço:** `src/lib/services/accessRequestService.ts` (depreciado)
- **API:** `POST /api/users/activate`
- **Firebase Admin:** Criação de usuário e custom claims
- **Firestore:** Armazenamento de dados do usuário

---

## 2. Contexto: Fluxo de Aprovação

### 2.1 Processo Completo

**Etapa 1: Solicitação**
- Usuário preenche formulário de registro
- Solicitação criada em `access_requests`
- Status: "pendente"

**Etapa 2: Aprovação**
- System Admin acessa painel
- Admin aprova solicitação
- Sistema gera código de 8 dígitos
- Sistema envia email com código
- Status: "ativa" (ou similar)

**Etapa 3: Ativação (Esta Página)**
- Usuário recebe email com código
- Usuário acessa `/activate`
- Usuário insere email + código
- Sistema valida código
- Sistema cria conta no Firebase Auth
- Sistema configura custom claims
- Status: "aprovado" ou conta criada

**Etapa 4: Login**
- Usuário faz login com credenciais
- Acesso ao sistema liberado

### 2.2 Código de Ativação

**Formato:**
- 8 dígitos numéricos
- Exemplo: "12345678"
- Gerado automaticamente
- Único por solicitação

**Validade:**
- Expira em 24 horas após aprovação
- Uso único
- Vinculado ao email

**Armazenamento:**
- Provavelmente em `access_requests`
- Campo: `activation_code` ou similar
- Hash ou texto plano (depende da implementação)

---

## 3. Casos de Uso

### 3.1 UC-001: Ativação Bem-Sucedida (Fluxo Original)

**Ator:** Usuário Aprovado  
**Pré-condições:**
- Solicitação foi aprovada por admin
- Código de 8 dígitos foi enviado por email
- Código ainda não expirou (< 24 horas)
- Código não foi usado

**Fluxo Principal:**
1. Usuário recebe email com código: "12345678"
2. Usuário acessa `/activate`
3. Sistema exibe formulário
4. Usuário digita email: "usuario@exemplo.com"
5. Usuário digita código: "12345678"
6. Usuário clica em "Ativar Conta"
7. Sistema valida email e código
8. Sistema chama `activateAccountWithCode`
9. ⚠️ **Função retorna erro (depreciada)**
10. Sistema exibe erro

**Pós-condições (Se Funcionasse):**
- Conta criada no Firebase Auth
- Custom claims configurados
- Usuário pode fazer login
- Código marcado como usado

**Status Atual:**
- ❌ Função depreciada
- ❌ Fluxo não funciona
- ⚠️ Página pode estar obsoleta

---

### 3.2 UC-002: Código Inválido ou Expirado

**Ator:** Usuário  
**Pré-condições:**
- Usuário possui código
- Código está incorreto, expirado ou já foi usado

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email e código
3. Usuário clica em "Ativar Conta"
4. Sistema valida código
5. Sistema detecta problema
6. Sistema exibe erro

**Mensagens Possíveis:**
- "Código inválido ou expirado"
- "Código já foi utilizado"
- "Email não corresponde à solicitação"
- "Solicitação não encontrada"

**Pós-condições:**
- Conta NÃO criada
- Usuário permanece na página
- Pode tentar novamente ou solicitar novo código

---

### 3.3 UC-003: Email Inválido

**Ator:** Usuário  
**Pré-condições:**
- Usuário digita email incorreto

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email sem "@": "emailinvalido"
3. Usuário digita código válido
4. Usuário clica em "Ativar Conta"
5. Sistema valida formato de email
6. Sistema detecta formato inválido
7. Sistema exibe erro: "Email inválido"

**Pós-condições:**
- Validação frontend previne envio
- Usuário corrige email

---

### 3.4 UC-004: Código com Menos de 8 Dígitos

**Ator:** Usuário  
**Pré-condições:**
- Usuário digita código incompleto

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email válido
3. Usuário digita código: "1234" (4 dígitos)
4. Usuário clica em "Ativar Conta"
5. Sistema valida tamanho do código
6. Sistema detecta código incompleto
7. Sistema exibe erro: "Código deve ter 8 dígitos"

**Pós-condições:**
- Validação frontend previne envio
- Usuário completa código

---

### 3.5 UC-005: Email Já Cadastrado

**Ator:** Usuário  
**Pré-condições:**
- Email já possui conta no Firebase Auth
- Usuário tenta ativar novamente

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email e código
3. Usuário clica em "Ativar Conta"
4. Sistema tenta criar usuário no Firebase Auth
5. Firebase retorna erro `auth/email-already-exists`
6. Sistema captura erro
7. Sistema exibe mensagem: "Este email já está cadastrado"

**Pós-condições:**
- Conta NÃO criada (já existe)
- Usuário deve fazer login
- Ou contatar suporte

---

### 3.6 UC-006: Limite de Usuários Atingido

**Ator:** Usuário  
**Pré-condições:**
- Clínica atingiu limite máximo de usuários
- Usuário tenta ativar conta

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email e código
3. Usuário clica em "Ativar Conta"
4. Sistema valida código (OK)
5. Sistema verifica limite de usuários do tenant
6. Sistema detecta limite atingido
7. Sistema exibe erro: "Clínica atingiu o limite de usuários ativos"

**Pós-condições:**
- Conta NÃO criada
- Admin precisa aumentar limite ou desativar usuário

---

### 3.7 UC-007: Ativação Sem Tenant (Aguarda System Admin)

**Ator:** Usuário  
**Pré-condições:**
- Solicitação aprovada mas sem tenant_id
- Usuário precisa ser associado a clínica

**Fluxo Principal:**
1. Usuário acessa `/activate`
2. Usuário digita email e código
3. Usuário clica em "Ativar Conta"
4. Sistema valida código (OK)
5. Sistema cria usuário no Firebase Auth
6. Sistema detecta ausência de tenant_id
7. Sistema cria em `pending_users`
8. Sistema define `active: false`
9. Sistema exibe mensagem: "Conta criada! Aguarde aprovação do administrador do sistema."

**Pós-condições:**
- Conta criada mas inativa
- Usuário aguarda associação a tenant
- System Admin precisa configurar

---

## 4. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE ACTIVATE (ORIGINAL)                        │
└─────────────────────────────────────────────────────────────────┘

ETAPA 1: ADMIN APROVA SOLICITAÇÃO
═══════════════════════════════════════════════════════════════════

    Admin acessa painel
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin aprova solicitação     │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema gera código:         │
    │ - 8 dígitos aleatórios       │
    │ - Único                      │
    │ - Vinculado ao email         │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema envia email:         │
    │ - Código de ativação         │
    │ - Link para /activate        │
    │ - Validade: 24 horas         │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Status: "ativa" ou similar   │
    └──────────────────────────────┘

═══════════════════════════════════════════════════════════════════
ETAPA 2: USUÁRIO ATIVA CONTA
═══════════════════════════════════════════════════════════════════

    Usuário recebe email
              │
              ▼
    Usuário acessa /activate
              │
              ▼
    ┌──────────────────────────────┐
    │ Formulário exibido:          │
    │ - Email                      │
    │ - Código (8 dígitos)         │
    │ - Botão "Ativar Conta"       │
    └──────────────────────────────┘
              │
              ▼
    Usuário preenche e submete
              │
              ▼
    ┌──────────────────────────────┐
    │ Validações Frontend:         │
    │ - Email válido?              │
    │ - Código tem 8 dígitos?      │
    └──────────────────────────────┘
         │              │
    VÁLIDO│              │INVÁLIDO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Continuar    │  │ Exibir erro      │
└──────────────┘  └──────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ activateAccountWithCode()    │
│ (DEPRECIADA)                 │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ ❌ Retorna erro:             │
│ "Função depreciada"          │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Exibir erro ao usuário       │
└──────────────────────────────┘

═══════════════════════════════════════════════════════════════════
FLUXO ESPERADO (SE FUNCIONASSE)
═══════════════════════════════════════════════════════════════════

┌──────────────────────────────┐
│ 1. Validar código            │
│    - Buscar em access_       │
│      requests                │
│    - Verificar email         │
│    - Verificar expiração     │
│    - Verificar se já usado   │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. Chamar API /users/activate│
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ API:                         │
│ 1. Criar usuário Firebase    │
│ 2. Configurar custom claims  │
│ 3. Criar documento Firestore │
│ 4. Marcar código como usado  │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Exibir sucesso               │
│ Redirecionar para /login     │
└──────────────────────────────┘
```

---

## 5. Regras de Negócio

### RN-001: Código de 8 Dígitos Obrigatório
**Descrição:** Código deve ter exatamente 8 dígitos numéricos  
**Aplicação:** Validação frontend e backend  
**Exceções:** Nenhuma  
**Justificativa:** Formato padronizado, fácil de digitar

### RN-002: Email Obrigatório e Válido
**Descrição:** Email deve ter formato válido e corresponder à solicitação  
**Aplicação:** Validação frontend e backend  
**Exceções:** Nenhuma  
**Justificativa:** Vincula código ao solicitante correto

### RN-003: Código com Validade de 24 Horas
**Descrição:** Código expira 24 horas após geração  
**Aplicação:** Validação no backend  
**Exceções:** Nenhuma  
**Justificativa:** Segurança - limita janela de uso

### RN-004: Código de Uso Único
**Descrição:** Cada código pode ser usado apenas uma vez  
**Aplicação:** Marcação no backend após uso  
**Exceções:** Nenhuma  
**Justificativa:** Previne reutilização

### RN-005: Verificação de Limite de Usuários
**Descrição:** Tenant não pode exceder limite de usuários ativos  
**Aplicação:** API verifica antes de criar usuário  
**Exceções:** Nenhuma  
**Justificativa:** Controle de plano e licenciamento

### RN-006: Role Baseado em Tipo de Documento
**Descrição:**
- CPF → `clinic_admin` (conta individual)
- CNPJ → `clinic_user` (pode ter múltiplos usuários)

**Aplicação:** API define role ao criar usuário  
**Exceções:** Nenhuma  
**Justificativa:** Diferenciação entre autônomo e clínica

### RN-007: Email Verificado Automaticamente
**Descrição:** Usuário criado com `emailVerified: true`  
**Aplicação:** Firebase Auth ao criar usuário  
**Exceções:** Nenhuma  
**Justificativa:** Código já validou posse do email

---
## 6. Estados da Interface

### 6.1 Estado: Formulário Inicial

**Quando:** Usuário acessa `/activate`  
**Exibição:**

**Card Header:**
- Título: "Ativar Conta"
- Descrição: "Digite o código de 8 dígitos enviado para seu email"

**Card Content:**
- **Campo Email:**
  - Type: email
  - Placeholder: "seu.email@exemplo.com"
  - Required: Sim
  - Autocomplete: email

- **Campo Código de Ativação:**
  - Type: text
  - Placeholder: "12345678"
  - Required: Sim
  - MaxLength: 8
  - Autocomplete: off
  - Estilo: Texto centralizado, tamanho 2xl, fonte mono, espaçamento largo
  - Dica: "Digite os 8 dígitos enviados por email"
  - Máscara: Apenas números

- **Botão:** "Ativar Conta"

**Card Footer:**
- Link: "Não recebeu o código? Solicitar novamente" → `/register`
- Link: "Voltar para login" → `/login`
- Texto: "O código expira em 24 horas após aprovação"

### 6.2 Estado: Processando Ativação

**Quando:** Usuário submeteu formulário  
**Exibição:**
- Campos desabilitados
- Botão desabilitado
- Ícone de loading (Loader2) animado
- Texto do botão: "Ativando..."

**Duração:** Variável (depende da API)

### 6.3 Estado: Sucesso

**Quando:** Conta ativada com sucesso  
**Exibição:**
- Alert verde com ícone de check
- Mensagem: "Conta ativada com sucesso! Redirecionando para o login..."
- Formulário desabilitado
- Após 2 segundos: redirecionamento para `/login`

### 6.4 Estado: Erro

**Quando:** Falha na ativação  
**Exibição:**
- Alert vermelho com ícone de erro
- Mensagem de erro específica
- Formulário habilitado para nova tentativa
- Campos mantêm valores

**Mensagens de Erro:**
- "Email inválido"
- "Código deve ter 8 dígitos"
- "Esta função foi depreciada. Use o novo fluxo de aprovação automática."
- "Código inválido ou expirado"
- "Este email já está cadastrado"
- "Clínica atingiu o limite de usuários ativos"
- "Clínica não encontrada"
- "Erro ao criar conta. Tente novamente."

---

## 7. Componentes da Interface

### 7.1 Estrutura Visual

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Ativar Conta                           │
│    Digite o código de 8 dígitos enviado            │
│           para seu email                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│    Email *                                          │
│    ┌─────────────────────────────────────────┐     │
│    │ seu.email@exemplo.com                   │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│    Código de Ativação *                             │
│    ┌─────────────────────────────────────────┐     │
│    │         1 2 3 4 5 6 7 8                 │     │
│    └─────────────────────────────────────────┘     │
│    Digite os 8 dígitos enviados por email          │
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │         Ativar Conta                    │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│    Não recebeu o código? Solicitar novamente       │
│                                                     │
│              Voltar para login                      │
│                                                     │
│    O código expira em 24 horas após aprovação      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Elementos de UI

**Input de Código:**
- Estilo especial: Centralizado, grande, monoespaçado
- Classes: `text-center text-2xl font-mono tracking-wider`
- Máscara: Remove caracteres não numéricos
- Limite: 8 caracteres
- Visual: Destaque para facilitar digitação

**Botão:**
- Full width
- Disabled durante processamento
- Ícone de loading quando processando

**Links:**
- Cor: Primary com hover underline
- Destinos: `/register` e `/login`

**Aviso de Expiração:**
- Tamanho: Extra small
- Cor: Muted foreground
- Posição: Rodapé

---

## 8. Validações

### 8.1 Validações de Frontend

**Email:**
- Obrigatório (HTML5 required)
- Formato de email (HTML5 type="email")
- Deve conter "@"
- Mensagem: "Email inválido"

**Código:**
- Obrigatório
- Exatamente 8 dígitos
- Apenas números (máscara remove outros caracteres)
- Mensagem: "Código deve ter 8 dígitos"

### 8.2 Validações do Backend (API)

**Dados Completos:**
- email, password, displayName obrigatórios
- Mensagem: "Dados incompletos"

**Email Único:**
- Não pode existir no Firebase Auth
- Erro: `auth/email-already-exists`
- Mensagem: "Este email já está cadastrado"

**Tenant Existe:**
- Se tenant_id fornecido, deve existir
- Mensagem: "Clínica não encontrada"

**Limite de Usuários:**
- Tenant não pode exceder max_users
- Mensagem: "Clínica atingiu o limite de usuários ativos"

### 8.3 Validações do Serviço (Depreciado)

**Código Válido:**
- Deve existir em access_requests
- Deve corresponder ao email
- Não pode estar expirado
- Não pode ter sido usado

**Status Atual:**
- ❌ Função retorna erro imediatamente
- ❌ Validações não são executadas

---

## 9. Integrações

### 9.1 Serviço - activateAccountWithCode (Depreciado)

**Função:**
```typescript
activateAccountWithCode(email: string, activationCode: string)
```

**Retorno Atual:**
```typescript
{
  success: false,
  message: "Esta função foi depreciada. Use o novo fluxo de aprovação automática."
}
```

**Status:** ❌ Depreciada

### 9.2 API - POST /users/activate

**Endpoint:** `POST /api/users/activate`  
**Headers:** `Content-Type: application/json`  
**Body:**
```json
{
  "email": "string",
  "password": "string",
  "displayName": "string",
  "tenant_id": "string (opcional)"
}
```

**Ações da API:**
1. Valida dados completos
2. Busca access_request para obter document_type
3. Define role baseado em document_type
4. Verifica se tenant existe (se fornecido)
5. Verifica limite de usuários
6. Cria usuário no Firebase Auth
7. Define custom claims
8. Cria documento no Firestore

**Resposta Sucesso:**
```json
{
  "success": true,
  "message": "Conta criada com sucesso! Você já pode fazer login.",
  "userId": "string"
}
```

**Resposta Erro:**
```json
{
  "success": false,
  "message": "Mensagem de erro"
}
```

### 9.3 Firebase Admin - createUser

**Uso:** Criar usuário no Firebase Auth  
**Método:** `adminAuth.createUser()`  
**Parâmetros:**
- email (lowercase)
- password
- displayName
- emailVerified: true

### 9.4 Firebase Admin - setCustomUserClaims

**Uso:** Configurar permissões do usuário  
**Claims Definidos:**
- `active`: true (se tem tenant) ou false (aguarda admin)
- `role`: "clinic_admin" (CPF) ou "clinic_user" (CNPJ)
- `is_system_admin`: false
- `tenant_id`: ID da clínica (se fornecido)

### 9.5 Firestore - Armazenamento

**Com Tenant:**
- Coleção: `tenants/{tenant_id}/users`
- Documento: `{uid}`
- Campos: uid, email, displayName, tenant_id, role, active, timestamps

**Sem Tenant:**
- Coleção: `pending_users`
- Documento: `{uid}`
- Campos: uid, email, displayName, role, active: false, timestamps

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Código de 8 dígitos (difícil de adivinhar)
- ✅ Expiração de 24 horas
- ✅ Código de uso único
- ✅ Vinculação email + código
- ✅ Validação de limite de usuários
- ✅ Email verificado automaticamente
- ✅ Validação de formato de email

### 10.2 Considerações de Segurança

**Código de 8 Dígitos:**
- Entropia: 10^8 = 100 milhões de possibilidades
- Difícil de adivinhar por brute force
- Expiração limita janela de ataque

**Email Verificado:**
- Código enviado por email confirma posse
- `emailVerified: true` no Firebase Auth
- Não requer verificação adicional

**Uso Único:**
- Código marcado como usado após ativação
- Previne reutilização

### 10.3 Vulnerabilidades Potenciais

**Função Depreciada:**
- ⚠️ Fluxo não funciona atualmente
- ⚠️ Página pode estar obsoleta
- ⚠️ Usuários não conseguem ativar conta

**Sem Rate Limiting:**
- ⚠️ Não há limite de tentativas
- ⚠️ Vulnerável a brute force (se funcionasse)

**Código em Texto Plano:**
- ⚠️ Não há informação se código é hasheado
- ⚠️ Pode estar armazenado em texto plano

---

## 11. Status de Depreciação

### 11.1 Evidências de Depreciação

**Código Fonte:**
```typescript
export async function activateAccountWithCode(
  email: string,
  activationCode: string
): Promise<{...}> {
  return {
    success: false,
    message: "Esta função foi depreciada. Use o novo fluxo de aprovação automática.",
  };
}
```

**Implicações:**
- ❌ Página não funciona
- ❌ Usuários não conseguem ativar conta
- ⚠️ Fluxo foi substituído

### 11.2 Novo Fluxo (Provável)

Baseado na mensagem "novo fluxo de aprovação automática", provavelmente:

1. **Admin aprova solicitação**
2. **Sistema cria conta automaticamente**
3. **Sistema envia credenciais por email**
4. **Usuário faz login diretamente**
5. **Sem necessidade de código de ativação**

### 11.3 Recomendações

**Para Desenvolvedores:**
- [ ] Remover página `/activate` se não for mais usada
- [ ] Atualizar links que apontam para `/activate`
- [ ] Documentar novo fluxo de aprovação
- [ ] Remover código depreciado

**Para Usuários:**
- Não usar esta página
- Aguardar email com credenciais
- Fazer login diretamente em `/login`

---

## 12. Melhorias Futuras (Se Reativada)

### 12.1 Funcionalidades
- [ ] Reativar função `activateAccountWithCode`
- [ ] Implementar validação de código
- [ ] Adicionar rate limiting
- [ ] Permitir reenvio de código
- [ ] Notificação de ativação bem-sucedida
- [ ] Histórico de tentativas de ativação

### 12.2 UX/UI
- [ ] Separar dígitos do código (8 inputs)
- [ ] Auto-focus entre campos
- [ ] Copiar/colar código completo
- [ ] Countdown de expiração
- [ ] Indicador visual de código válido
- [ ] Animações de feedback

### 12.3 Segurança
- [ ] Hash de código no banco
- [ ] Rate limiting (máximo X tentativas)
- [ ] Bloqueio temporário após falhas
- [ ] Auditoria de tentativas
- [ ] Captcha após múltiplas falhas
- [ ] Verificação de dispositivo

---

## 13. Observações Técnicas

### 13.1 Decisões de Arquitetura

**Por que código de 8 dígitos?**
- Fácil de digitar
- Difícil de adivinhar (100 milhões de possibilidades)
- Padrão comum em sistemas de verificação
- Não requer caracteres especiais

**Por que depreciado?**
- Provável simplificação do fluxo
- Aprovação automática mais rápida
- Menos etapas para o usuário
- Reduz complexidade

**Por que manter a página?**
- Pode estar em transição
- Pode ter usuários com códigos pendentes
- Pode ser reativada no futuro

### 13.2 Padrões Utilizados
- **Código de Verificação:** Padrão comum em 2FA e verificações
- **Validação em Camadas:** Frontend → Serviço → API
- **Feedback Progressivo:** Loading states e mensagens claras
- **Redirecionamento Automático:** Após sucesso

### 13.3 Limitações Conhecidas
- ❌ **Função depreciada - página não funciona**
- ⚠️ Sem rate limiting
- ⚠️ Sem separação visual de dígitos
- ⚠️ Sem countdown de expiração
- ⚠️ Sem opção de reenvio de código
- ⚠️ Sem auditoria de tentativas

### 13.4 Dependências Críticas
- **accessRequestService:** Depreciado
- **API /users/activate:** Funcional
- **Firebase Admin:** Criação de usuário
- **Firestore:** Armazenamento de dados

---

## 14. Mensagens do Sistema

### 14.1 Título e Descrição
- "Ativar Conta"
- "Digite o código de 8 dígitos enviado para seu email"

### 14.2 Labels e Placeholders
- Label: "Email *"
- Placeholder: "seu.email@exemplo.com"
- Label: "Código de Ativação *"
- Placeholder: "12345678"

### 14.3 Dicas
- "Digite os 8 dígitos enviados por email"
- "O código expira em 24 horas após aprovação"

### 14.4 Botões
- "Ativar Conta" (normal)
- "Ativando..." (processando)

### 14.5 Links
- "Não recebeu o código? Solicitar novamente"
- "Voltar para login"

### 14.6 Mensagens de Sucesso
- "Conta ativada com sucesso! Redirecionando para o login..."
- "Conta criada com sucesso! Você já pode fazer login."
- "Conta criada! Aguarde aprovação do administrador do sistema."

### 14.7 Mensagens de Erro
- "Email inválido"
- "Código deve ter 8 dígitos"
- "Esta função foi depreciada. Use o novo fluxo de aprovação automática."
- "Dados incompletos"
- "Este email já está cadastrado"
- "Clínica não encontrada"
- "Clínica atingiu o limite de usuários ativos"
- "Erro ao criar conta. Tente novamente."

---

## 15. Comparação com Outras Páginas

| Aspecto | Activate | Register | Waiting Approval |
|---------|----------|----------|------------------|
| **Propósito** | Ativar com código | Solicitar acesso | Aguardar aprovação |
| **Entrada** | Email + Código | Dados completos | Nenhuma |
| **Autenticação** | Não logado | Não logado | Logado |
| **Cria conta** | Sim | Não | Não |
| **Status** | ❌ Depreciada | ✅ Ativa | ✅ Ativa |
| **Próxima etapa** | Login | Aguardar email | Aguardar admin |

---

## 16. Testes Recomendados

### 16.1 Testes Funcionais (Se Reativada)

**Ativação Bem-Sucedida:**
1. Digitar email válido → OK
2. Digitar código válido → OK
3. Clicar "Ativar Conta" → Conta criada
4. Redireciona para login → OK

**Validações:**
1. Email vazio → Erro HTML5
2. Email inválido → Erro "Email inválido"
3. Código com menos de 8 dígitos → Erro
4. Código inválido → Erro
5. Código expirado → Erro

**Status Atual:**
1. Qualquer tentativa → Erro "Função depreciada"

### 16.2 Testes de Segurança
1. Tentar múltiplos códigos → Sem rate limiting (vulnerável)
2. Tentar código expirado → Deve rejeitar
3. Tentar código já usado → Deve rejeitar
4. Verificar HTTPS → Obrigatório

### 16.3 Testes de UI
1. Responsividade mobile → OK
2. Máscara de código (apenas números) → OK
3. Estilo do input de código → OK
4. Links funcionam → OK

---

## 17. Troubleshooting

### 17.1 Erro "Função Depreciada"

**Causa:**
- Função `activateAccountWithCode` foi desativada
- Fluxo foi substituído

**Solução:**
- Não usar esta página
- Aguardar novo fluxo de aprovação
- Contatar administrador

### 17.2 Código Não Funciona (Se Reativada)

**Possíveis Causas:**
- Código expirado (> 24 horas)
- Código já foi usado
- Email incorreto
- Código digitado errado

**Soluções:**
- Verificar email correto
- Verificar código no email
- Solicitar novo código
- Contatar suporte

### 17.3 Email Já Cadastrado

**Causa:**
- Conta já foi criada anteriormente
- Tentativa de ativar novamente

**Solução:**
- Fazer login em `/login`
- Usar "Esqueci a senha" se necessário
- Contatar suporte se problema persistir

---

## 18. Glossário

- **Código de Ativação:** Código de 8 dígitos para ativar conta
- **Depreciado:** Função ou recurso que não é mais suportado
- **access_requests:** Coleção de solicitações de acesso
- **pending_users:** Coleção de usuários aguardando aprovação
- **emailVerified:** Flag do Firebase indicando email verificado
- **document_type:** Tipo de documento (CPF ou CNPJ)
- **max_users:** Limite máximo de usuários por tenant

---

## 19. Referências

### 19.1 Documentação Relacionada
- Register Page Documentation - `project_doc/register-page-documentation.md`
- Waiting Approval Documentation - `project_doc/waiting-approval-documentation.md`
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 19.2 Código Fonte
- **Página:** `src/app/(auth)/activate/page.tsx`
- **Serviço:** `src/lib/services/accessRequestService.ts`
- **API:** `src/app/api/users/activate/route.ts`

### 19.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** ⚠️ **PÁGINA DEPRECIADA - NÃO FUNCIONAL**
