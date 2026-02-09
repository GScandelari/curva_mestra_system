# Documentação Experimental - Página Change Password

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Troca de Senha Obrigatória (`/change-password`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página Change Password é uma **tela de troca de senha obrigatória** exibida para usuários que possuem a flag `requirePasswordChange: true` nos seus custom claims. Esta página força o usuário a definir uma nova senha antes de acessar o sistema.

### 1.1 Quando Esta Página é Exibida?

Usuário é redirecionado para `/change-password` quando:
1. Faz login e possui `requirePasswordChange: true` nos custom claims
2. Administrador resetou a senha e definiu senha temporária
3. Primeira vez acessando após aprovação (se admin configurou flag)
4. Política de segurança requer troca periódica de senha

### 1.2 Diferença: Change Password vs Reset Password

| Aspecto | Change Password | Reset Password |
|---------|-----------------|----------------|
| **Iniciado por** | Admin (força usuário) | Usuário (esqueceu senha) |
| **Requer senha atual** | Sim | Não (usa token) |
| **Autenticação** | Usuário já logado | Usuário não logado |
| **Bloqueio** | Obrigatório (não pode pular) | Opcional (pode cancelar) |
| **Flag** | `requirePasswordChange: true` | Não usa flag |
| **Uso típico** | Senha temporária, política de segurança | Esqueceu senha |

### 1.3 Localização
- **Arquivo:** `src/app/(auth)/change-password/page.tsx`
- **Rota:** `/change-password`
- **Layout:** Auth Layout (sem navegação principal)

### 1.4 Dependências Principais
- **Hook de Autenticação:** `src/hooks/useAuth.ts`
- **Firebase Auth:** `updatePassword`, `reauthenticateWithCredential`
- **API:** `POST /api/users/clear-password-change-flag`
- **Firebase Admin:** Atualização de custom claims

---

## 2. Contexto: Flag requirePasswordChange

### 2.1 O Que É Esta Flag?

```typescript
interface CustomClaims {
  // ... outros campos
  requirePasswordChange?: boolean;  // Flag de troca obrigatória
}
```

**Quando é definida como `true`:**
- Admin reseta senha de usuário
- Admin cria usuário com senha temporária
- Política de segurança requer troca periódica
- Conta comprometida (medida de segurança)

**Efeito:**
- Usuário é bloqueado no login
- Redirecionado para `/change-password`
- Não pode acessar sistema até trocar senha

### 2.2 Onde a Flag é Armazenada?

**Custom Claims (Firebase Auth):**
```typescript
{
  requirePasswordChange: true,
  // ... outros claims
}
```

**Firestore (users collection):**
```typescript
{
  requirePasswordChange: true,
  passwordResetAt: Timestamp,      // Quando admin resetou
  passwordChangedAt: Timestamp,    // Quando usuário trocou
  // ... outros campos
}
```

**Sincronização:**
- Flag deve estar em ambos os lugares
- Custom claims é verificado no login
- Firestore é usado para auditoria

---

## 3. Casos de Uso

### 3.1 UC-001: Troca de Senha Bem-Sucedida

**Ator:** Usuário com Senha Temporária  
**Pré-condições:**
- Usuário fez login
- Possui `requirePasswordChange: true`
- Conhece senha temporária (recebida por email)

**Fluxo Principal:**
1. Usuário faz login com senha temporária
2. Sistema detecta `requirePasswordChange: true`
3. Sistema redireciona para `/change-password`
4. Página exibe formulário de troca
5. Usuário digita senha atual (temporária)
6. Usuário digita nova senha
7. Usuário confirma nova senha
8. Usuário clica em "Definir Nova Senha"
9. Sistema valida campos:
   - Nova senha >= 6 caracteres
   - Senhas coincidem
   - Nova senha diferente da atual
10. Sistema reautentica usuário com senha atual
11. Sistema atualiza senha no Firebase Auth
12. Sistema chama API para remover flag
13. API remove `requirePasswordChange` dos custom claims
14. API atualiza Firestore (requirePasswordChange: false, passwordChangedAt)
15. Sistema redireciona para dashboard apropriado

**Pós-condições:**
- Senha atualizada
- Flag `requirePasswordChange` removida
- Campo `passwordChangedAt` atualizado
- Usuário tem acesso completo ao sistema

---

### 3.2 UC-002: Senha Atual Incorreta

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/change-password`
- Digita senha atual incorreta

**Fluxo Principal:**
1. Usuário preenche formulário
2. Usuário digita senha atual errada
3. Usuário clica em "Definir Nova Senha"
4. Sistema tenta reautenticar
5. Firebase retorna erro `auth/wrong-password` ou `auth/invalid-credential`
6. Sistema exibe erro: "Senha atual incorreta"
7. Usuário corrige senha atual
8. Usuário tenta novamente

**Pós-condições:**
- Senha NÃO alterada
- Flag mantida
- Usuário permanece na página

---

### 3.3 UC-003: Senhas Não Coincidem

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/change-password`

**Fluxo Principal:**
1. Usuário digita senha atual correta
2. Usuário digita nova senha: "senha123"
3. Usuário confirma senha: "senha124"
4. Usuário clica em "Definir Nova Senha"
5. Sistema compara senhas
6. Sistema detecta diferença
7. Sistema exibe erro: "As senhas não coincidem"
8. Usuário corrige confirmação
9. Usuário tenta novamente

**Pós-condições:**
- Senha NÃO alterada
- Usuário permanece na página

---

### 3.4 UC-004: Nova Senha Muito Curta

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/change-password`

**Fluxo Principal:**
1. Usuário digita senha atual correta
2. Usuário digita nova senha: "12345" (5 caracteres)
3. Usuário confirma senha: "12345"
4. Usuário clica em "Definir Nova Senha"
5. Sistema valida tamanho
6. Sistema detecta senha curta
7. Sistema exibe erro: "A senha deve ter pelo menos 6 caracteres"
8. Usuário digita senha mais longa
9. Usuário tenta novamente

**Pós-condições:**
- Senha NÃO alterada

**Validação Adicional:**
- Firebase também valida (pode rejeitar senhas fracas)
- Erro: "A nova senha é muito fraca. Use pelo menos 6 caracteres"

---

### 3.5 UC-005: Nova Senha Igual à Atual

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/change-password`

**Fluxo Principal:**
1. Usuário digita senha atual: "temp123"
2. Usuário digita nova senha: "temp123" (mesma)
3. Usuário confirma senha: "temp123"
4. Usuário clica em "Definir Nova Senha"
5. Sistema compara senhas
6. Sistema detecta que são iguais
7. Sistema exibe erro: "A nova senha deve ser diferente da senha atual"
8. Usuário digita senha diferente
9. Usuário tenta novamente

**Pós-condições:**
- Senha NÃO alterada

**Regra de Negócio:**
- Força usuário a realmente trocar senha
- Não permite "trocar" pela mesma senha

---

### 3.6 UC-006: Sessão Expirada (Requires Recent Login)

**Ator:** Usuário  
**Pré-condições:**
- Usuário fez login há muito tempo
- Token expirou ou sessão antiga

**Fluxo Principal:**
1. Usuário preenche formulário
2. Usuário clica em "Definir Nova Senha"
3. Sistema tenta atualizar senha
4. Firebase retorna erro `auth/requires-recent-login`
5. Sistema exibe erro: "Por segurança, faça login novamente antes de trocar a senha"
6. Sistema redireciona para `/login`
7. Usuário faz login novamente
8. Sistema redireciona de volta para `/change-password`
9. Usuário tenta trocar senha novamente

**Pós-condições:**
- Senha NÃO alterada
- Usuário deve fazer login novamente

**Regra de Negócio:**
- Firebase requer reautenticação recente para operações sensíveis
- Segurança adicional

---

### 3.7 UC-007: Usuário Não Autenticado Tenta Acessar

**Ator:** Usuário Não Autenticado  
**Pré-condições:**
- Usuário não está logado
- Tenta acessar `/change-password` diretamente

**Fluxo Principal:**
1. Usuário acessa `/change-password` via URL
2. Sistema verifica autenticação
3. Sistema detecta que não está autenticado
4. Sistema redireciona para `/login`

**Pós-condições:**
- Usuário redirecionado para login
- Não vê formulário de troca de senha

**Regra de Negócio:**
- Página requer autenticação
- Não faz sentido trocar senha sem estar logado

---
## 4. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE CHANGE PASSWORD                            │
└─────────────────────────────────────────────────────────────────┘

ETAPA 1: ADMIN RESETA SENHA
═══════════════════════════════════════════════════════════════════

    Admin acessa painel de usuários
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin seleciona usuário      │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin clica "Resetar Senha"  │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema gera senha temporária│
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Auth:               │
    │ - updateUser(password)       │
    │ - setCustomUserClaims({      │
    │     requirePasswordChange:   │
    │     true                     │
    │   })                         │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Firestore:                   │
    │ - requirePasswordChange:true │
    │ - passwordResetAt: now       │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Email enviado ao usuário     │
    │ com senha temporária         │
    └──────────────────────────────┘

═══════════════════════════════════════════════════════════════════
ETAPA 2: USUÁRIO FAZ LOGIN
═══════════════════════════════════════════════════════════════════

    Usuário acessa /login
              │
              ▼
    ┌──────────────────────────────┐
    │ Usuário digita:              │
    │ - Email                      │
    │ - Senha temporária           │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Auth valida         │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema obtém custom claims  │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Verificar:                   │
    │ requirePasswordChange?       │
    └──────────────────────────────┘
         │              │
    SIM  │              │  NÃO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Redirecionar │  │ Permitir acesso  │
│ /change-     │  │ ao dashboard     │
│ password     │  └──────────────────┘
└──────────────┘
         │
         ▼

═══════════════════════════════════════════════════════════════════
ETAPA 3: TROCAR SENHA
═══════════════════════════════════════════════════════════════════

    ┌──────────────────────────────┐
    │ PÁGINA CHANGE PASSWORD       │
    │                              │
    │ - Alerta obrigatório         │
    │ - Senha atual                │
    │ - Nova senha                 │
    │ - Confirmar senha            │
    │ - Dicas de senha segura      │
    └──────────────────────────────┘
              │
              ▼
    Usuário preenche formulário
              │
              ▼
    ┌──────────────────────────────┐
    │ Validações Frontend:         │
    │ - Nova senha >= 6 chars?     │
    │ - Senhas coincidem?          │
    │ - Nova ≠ atual?              │
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
│ 1. Reautenticar usuário      │
│    reauthenticateWith        │
│    Credential(email,         │
│    currentPassword)          │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. Atualizar senha           │
│    updatePassword(user,      │
│    newPassword)              │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 3. Obter token               │
│    user.getIdToken()         │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 4. Chamar API                │
│    POST /api/users/          │
│    clear-password-change-flag│
│    Authorization: Bearer     │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ API:                         │
│ 1. Verificar token           │
│ 2. Obter custom claims       │
│ 3. Remover requirePassword   │
│    Change                    │
│ 4. Atualizar Firestore       │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 5. Redirecionar para         │
│    dashboard apropriado      │
│    baseado em role           │
└──────────────────────────────┘
```

---

## 5. Regras de Negócio

### RN-001: Troca Obrigatória
**Descrição:** Usuário com `requirePasswordChange: true` não pode acessar sistema sem trocar senha  
**Aplicação:** Verificação no login, redirecionamento forçado  
**Exceções:** Nenhuma - todos devem trocar  
**Justificativa:** Segurança - senhas temporárias não devem ser permanentes

### RN-002: Reautenticação Necessária
**Descrição:** Usuário deve fornecer senha atual para trocar senha  
**Aplicação:** `reauthenticateWithCredential` antes de `updatePassword`  
**Exceções:** Nenhuma  
**Justificativa:** Segurança - confirma que é o usuário legítimo

### RN-003: Nova Senha Diferente
**Descrição:** Nova senha deve ser diferente da senha atual  
**Aplicação:** Validação frontend antes de submeter  
**Exceções:** Nenhuma  
**Justificativa:** Força troca real, não permite "trocar" pela mesma

### RN-004: Senha Mínima
**Descrição:** Nova senha deve ter no mínimo 6 caracteres  
**Aplicação:** Validação frontend e Firebase Auth  
**Exceções:** Nenhuma  
**Justificativa:** Segurança básica

### RN-005: Remoção de Flag
**Descrição:** Após troca bem-sucedida, flag `requirePasswordChange` é removida  
**Aplicação:** API atualiza custom claims e Firestore  
**Exceções:** Nenhuma  
**Justificativa:** Libera acesso ao sistema

### RN-006: Atualização de Timestamp
**Descrição:** Campo `passwordChangedAt` é atualizado com data/hora da troca  
**Aplicação:** API atualiza Firestore  
**Exceções:** Nenhuma  
**Justificativa:** Auditoria - rastrear quando senha foi trocada

### RN-007: Redirecionamento por Role
**Descrição:** Após troca, usuário é redirecionado para dashboard apropriado  
**Aplicação:** Baseado em `claims.role` e `claims.is_system_admin`  
**Exceções:** Nenhuma  
**Justificativa:** UX - levar usuário para onde ele precisa ir

---

## 6. Estados da Interface

### 6.1 Estado: Carregando Autenticação
**Quando:** Sistema está verificando se usuário está autenticado  
**Exibição:** "Carregando..." centralizado  
**Duração:** Breve (< 1 segundo)

### 6.2 Estado: Formulário de Troca

**Quando:** Usuário autenticado com `requirePasswordChange: true`  
**Exibição:**

**Header:**
- Ícone: Chave (KeyRound) em círculo azul
- Título: "Trocar Senha"
- Descrição: "Você está usando uma senha temporária. Por segurança, defina uma nova senha."

**Alerta Obrigatório (Amarelo/Âmbar):**
- Ícone: Triângulo de alerta
- Texto: "Você precisa definir uma nova senha para continuar usando o sistema."

**Formulário:**
- **Senha Atual (Temporária):**
  - Type: password
  - Placeholder: "Digite a senha temporária"
  - Required: Sim
  - Autocomplete: current-password

- **Nova Senha:**
  - Type: password
  - Placeholder: "Digite a nova senha"
  - Required: Sim
  - Autocomplete: new-password
  - Dica: "Mínimo de 6 caracteres"

- **Confirmar Nova Senha:**
  - Type: password
  - Placeholder: "Confirme a nova senha"
  - Required: Sim
  - Autocomplete: new-password

- **Botão:** "Definir Nova Senha"

**Box de Dicas (Cinza):**
- Ícone: Check verde
- Título: "Dicas para uma senha segura:"
- Lista:
  - Use pelo menos 6 caracteres
  - Combine letras, números e símbolos
  - Evite senhas óbvias como "123456"

### 6.3 Estado: Processando Troca
**Quando:** Usuário submeteu formulário  
**Exibição:**
- Botão desabilitado
- Texto: "Salvando..."
- Campos desabilitados
- Cursor de loading

### 6.4 Estado: Erro de Validação
**Quando:** Validação falhou  
**Exibição:**
- Alert vermelho com mensagem de erro
- Formulário habilitado para correção
- Campos mantêm valores (exceto senhas por segurança)

**Mensagens Possíveis:**
- "A senha deve ter pelo menos 6 caracteres"
- "As senhas não coincidem"
- "A nova senha deve ser diferente da senha atual"
- "Senha atual incorreta"
- "A nova senha é muito fraca. Use pelo menos 6 caracteres"
- "Por segurança, faça login novamente antes de trocar a senha"
- "Erro ao trocar senha. Tente novamente."

---

## 7. Validações

### 7.1 Validações de Frontend

**Senha Atual:**
- Obrigatório
- Não há validação de formato (qualquer string)

**Nova Senha:**
- Obrigatório
- Mínimo 6 caracteres
- Mensagem: "A senha deve ter pelo menos 6 caracteres"

**Confirmar Senha:**
- Obrigatório
- Deve ser igual à nova senha
- Mensagem: "As senhas não coincidem"

**Comparação:**
- Nova senha deve ser diferente da atual
- Mensagem: "A nova senha deve ser diferente da senha atual"

### 7.2 Validações do Firebase Auth

**Reautenticação:**
- Senha atual deve estar correta
- Erro: `auth/wrong-password` → "Senha atual incorreta"
- Erro: `auth/invalid-credential` → "Senha atual incorreta"

**Atualização de Senha:**
- Senha não pode ser muito fraca
- Erro: `auth/weak-password` → "A nova senha é muito fraca. Use pelo menos 6 caracteres"

**Sessão:**
- Login deve ser recente
- Erro: `auth/requires-recent-login` → "Por segurança, faça login novamente antes de trocar a senha"

### 7.3 Validações da API

**Token:**
- Deve estar presente no header Authorization
- Deve ser válido (não expirado)
- Erro: "Não autorizado" (401)

**Usuário:**
- Deve existir no Firebase Auth
- Deve ter custom claims

---

## 8. Integrações

### 8.1 Firebase Auth - reauthenticateWithCredential
- **Uso:** Confirmar identidade antes de trocar senha
- **Método:** `reauthenticateWithCredential(user, credential)`
- **Credential:** `EmailAuthProvider.credential(email, password)`
- **Quando:** Antes de atualizar senha
- **Erros:** wrong-password, invalid-credential, requires-recent-login

### 8.2 Firebase Auth - updatePassword
- **Uso:** Atualizar senha do usuário
- **Método:** `updatePassword(user, newPassword)`
- **Quando:** Após reautenticação bem-sucedida
- **Efeito:** Senha atualizada no Firebase Auth
- **Erros:** weak-password, requires-recent-login

### 8.3 API - Clear Password Change Flag
- **Endpoint:** `POST /api/users/clear-password-change-flag`
- **Headers:** `Authorization: Bearer [token]`
- **Quando:** Após atualizar senha com sucesso
- **Ações da API:**
  1. Verifica token
  2. Obtém custom claims atuais
  3. Remove `requirePasswordChange` dos claims
  4. Atualiza Firestore:
     - `requirePasswordChange: false`
     - `passwordChangedAt: now`
     - `updated_at: now`
- **Resposta Sucesso:**
```json
{
  "success": true,
  "message": "Flag de troca de senha removida com sucesso."
}
```
- **Resposta Erro:**
```json
{
  "error": "Não autorizado"
}
```

### 8.4 Firebase Admin - setCustomUserClaims
- **Uso:** Remover flag requirePasswordChange
- **Método:** `adminAuth.setCustomUserClaims(uid, claims)`
- **Quando:** API é chamada após troca de senha
- **Efeito:** Custom claims atualizados no token

### 8.5 Firestore - users collection
- **Coleção:** `users`
- **Documento:** `{uid}`
- **Operação:** Update
- **Campos atualizados:**
  - `requirePasswordChange: false`
  - `passwordChangedAt: Timestamp`
  - `updated_at: Timestamp`

---

## 9. Segurança

### 9.1 Proteções Implementadas
- ✅ Reautenticação obrigatória (confirma identidade)
- ✅ Senha atual deve ser fornecida
- ✅ Nova senha deve ser diferente da atual
- ✅ Validação de força de senha (mínimo 6 caracteres)
- ✅ Validação dupla (frontend + Firebase)
- ✅ Token JWT para chamar API
- ✅ Verificação de autenticação (não pode acessar sem login)
- ✅ Remoção de flag após troca (libera acesso)
- ✅ Auditoria (passwordChangedAt timestamp)

### 9.2 Fluxo de Segurança

**1. Verificação de Identidade:**
- Usuário deve estar autenticado
- Deve fornecer senha atual
- Reautenticação confirma que é o usuário legítimo

**2. Validação de Senha:**
- Mínimo 6 caracteres
- Firebase pode rejeitar senhas muito fracas
- Nova senha deve ser diferente

**3. Atualização Segura:**
- Senha atualizada via Firebase Auth (criptografada)
- Flag removida via API autenticada
- Sincronização entre custom claims e Firestore

**4. Auditoria:**
- `passwordChangedAt` registra quando foi trocada
- Logs no console para debugging
- Histórico de mudanças

### 9.3 Considerações de Segurança

**Por que reautenticar?**
- Confirma que é o usuário legítimo
- Previne troca de senha por sessão roubada
- Requisito do Firebase para operações sensíveis

**Por que nova senha deve ser diferente?**
- Força troca real de senha
- Evita que usuário "burle" o sistema
- Melhora segurança

**Por que remover flag após troca?**
- Libera acesso ao sistema
- Evita loop infinito
- Confirma que requisito foi cumprido

---
## 10. Cenários de Uso

### 10.1 Cenário: Admin Reseta Senha de Usuário

**Situação:**
- Usuário esqueceu senha e não tem acesso ao email
- Admin precisa ajudar usuário

**Fluxo:**
1. Admin acessa painel de usuários
2. Admin seleciona usuário
3. Admin clica "Resetar Senha"
4. Sistema gera senha temporária (ex: "Temp@123")
5. Sistema define `requirePasswordChange: true`
6. Sistema envia email com senha temporária
7. Usuário recebe email
8. Usuário faz login com senha temporária
9. Sistema redireciona para `/change-password`
10. Usuário define nova senha
11. Usuário tem acesso ao sistema

### 10.2 Cenário: Novo Usuário Aprovado

**Situação:**
- Admin aprova novo usuário
- Admin cria conta com senha temporária

**Fluxo:**
1. Admin aprova solicitação de acesso
2. Admin cria usuário no Firebase Auth
3. Admin define senha temporária
4. Admin define `requirePasswordChange: true`
5. Admin envia credenciais por email
6. Usuário faz primeiro login
7. Sistema redireciona para `/change-password`
8. Usuário define senha pessoal
9. Usuário completa onboarding

### 10.3 Cenário: Política de Segurança

**Situação:**
- Empresa requer troca de senha a cada 90 dias
- Sistema detecta senha antiga

**Fluxo:**
1. Sistema verifica data de `passwordChangedAt`
2. Sistema detecta que passou 90 dias
3. Sistema define `requirePasswordChange: true`
4. Usuário faz login
5. Sistema redireciona para `/change-password`
6. Usuário troca senha
7. Contador de 90 dias reinicia

**Nota:** Este cenário requer implementação adicional (não existe atualmente)

### 10.4 Cenário: Conta Comprometida

**Situação:**
- Admin detecta atividade suspeita
- Admin força troca de senha por segurança

**Fluxo:**
1. Admin detecta problema de segurança
2. Admin acessa usuário
3. Admin força reset de senha
4. Admin define `requirePasswordChange: true`
5. Admin notifica usuário
6. Usuário faz login
7. Sistema redireciona para `/change-password`
8. Usuário define nova senha segura
9. Conta protegida

---

## 11. Melhorias Futuras

### 11.1 Funcionalidades
- [ ] Verificação de senha comprometida (Have I Been Pwned API)
- [ ] Histórico de senhas anteriores (não permitir reutilização)
- [ ] Política de senha configurável por tenant
- [ ] Troca periódica automática (ex: a cada 90 dias)
- [ ] Notificação de troca de senha por email
- [ ] Opção de "Não fui eu" se troca não autorizada
- [ ] Gerador de senha segura
- [ ] Verificação de força de senha em tempo real
- [ ] Autenticação de dois fatores (2FA) após troca

### 11.2 UX/UI
- [ ] Indicador de força de senha visual
- [ ] Mostrar/ocultar senha
- [ ] Barra de progresso de requisitos
- [ ] Animações de feedback
- [ ] Modo escuro
- [ ] Responsividade aprimorada
- [ ] Mensagens mais específicas por contexto
- [ ] Tutorial inline de senha segura

### 11.3 Segurança
- [ ] Requisitos de senha mais fortes (números, símbolos, maiúsculas)
- [ ] Blacklist de senhas comuns
- [ ] Verificação de senha comprometida
- [ ] Limite de tentativas de troca
- [ ] Bloqueio temporário após múltiplas falhas
- [ ] Auditoria completa de tentativas
- [ ] Alertas de segurança por email
- [ ] Verificação de dispositivo conhecido

### 11.4 Administração
- [ ] Dashboard de usuários com senha temporária
- [ ] Relatório de trocas de senha
- [ ] Estatísticas de segurança
- [ ] Alertas de senhas não trocadas
- [ ] Política de senha por tenant
- [ ] Configuração de expiração de senha

---

## 12. Observações Técnicas

### 12.1 Decisões de Arquitetura

**Por que página separada ao invés de modal?**
- Bloqueio completo de acesso
- Foco total na tarefa obrigatória
- Não há como "fechar" ou "cancelar"
- Evita confusão com outras páginas

**Por que reautenticar ao invés de apenas validar senha?**
- Requisito do Firebase para operações sensíveis
- Segurança adicional
- Confirma que é o usuário legítimo
- Previne ataques com sessão roubada

**Por que chamar API para remover flag?**
- Custom claims só podem ser atualizados via Admin SDK
- Frontend não tem permissão para alterar claims
- API valida token e autorização
- Sincroniza custom claims e Firestore

**Por que armazenar flag em dois lugares?**
- Custom claims: Verificação rápida no login
- Firestore: Auditoria e histórico
- Sincronização garante consistência

### 12.2 Padrões Utilizados
- **Bloqueio Obrigatório:** Usuário não pode pular esta etapa
- **Reautenticação:** Confirma identidade antes de operação sensível
- **Validação em Camadas:** Frontend → Firebase → API
- **Feedback Progressivo:** Mensagens claras em cada etapa
- **Auditoria:** Timestamps de quando senha foi trocada

### 12.3 Limitações Conhecidas
- ⚠️ Não verifica força de senha além de 6 caracteres
- ⚠️ Não verifica se senha foi comprometida
- ⚠️ Não impede reutilização de senhas antigas
- ⚠️ Não há limite de tentativas de troca
- ⚠️ Não há notificação automática de troca
- ⚠️ Não há verificação de dispositivo
- ⚠️ Mensagem genérica para todos os contextos

### 12.4 Dependências Críticas
- **Firebase Auth:** Reautenticação e atualização de senha
- **Firebase Admin SDK:** Atualização de custom claims
- **Firestore:** Armazenamento de flags e timestamps
- **API Route:** Remoção de flag
- **useAuth Hook:** Dados do usuário e claims

---

## 13. Mensagens do Sistema

### 13.1 Título e Descrição
- "Trocar Senha"
- "Você está usando uma senha temporária. Por segurança, defina uma nova senha."

### 13.2 Alerta Obrigatório
- "Você precisa definir uma nova senha para continuar usando o sistema."

### 13.3 Labels de Campos
- "Senha Atual (Temporária)"
- "Nova Senha"
- "Confirmar Nova Senha"

### 13.4 Placeholders
- "Digite a senha temporária"
- "Digite a nova senha"
- "Confirme a nova senha"

### 13.5 Dicas
- "Mínimo de 6 caracteres"
- "Dicas para uma senha segura:"
- "Use pelo menos 6 caracteres"
- "Combine letras, números e símbolos"
- "Evite senhas óbvias como '123456'"

### 13.6 Botão
- "Definir Nova Senha" (normal)
- "Salvando..." (processando)

### 13.7 Mensagens de Erro
- "A senha deve ter pelo menos 6 caracteres"
- "As senhas não coincidem"
- "A nova senha deve ser diferente da senha atual"
- "Usuário não encontrado"
- "Senha atual incorreta"
- "A nova senha é muito fraca. Use pelo menos 6 caracteres"
- "Por segurança, faça login novamente antes de trocar a senha"
- "Erro ao trocar senha. Tente novamente."

---

## 14. Comparação com Outras Páginas

| Aspecto | Change Password | Reset Password | Forgot Password |
|---------|-----------------|----------------|-----------------|
| **Iniciado por** | Admin (força) | Usuário | Usuário |
| **Autenticação** | Logado | Não logado | Não logado |
| **Requer senha atual** | Sim | Não | Não |
| **Usa token** | Não | Sim | Sim (Firebase) |
| **Bloqueio** | Obrigatório | Opcional | Opcional |
| **Flag** | requirePasswordChange | Não | Não |
| **Redirecionamento** | Dashboard | Login | N/A |
| **Uso típico** | Senha temporária | Esqueceu senha | Solicitar reset |

---

## 15. Testes Recomendados

### 15.1 Testes Funcionais

**Troca Bem-Sucedida:**
1. Login com requirePasswordChange: true → Redireciona para change-password
2. Preencher formulário corretamente → Senha atualizada
3. Flag removida → Acesso liberado
4. Redireciona para dashboard → Sucesso

**Validações:**
1. Senha muito curta → Erro exibido
2. Senhas não coincidem → Erro exibido
3. Nova senha igual à atual → Erro exibido
4. Senha atual incorreta → Erro exibido

**Reautenticação:**
1. Sessão antiga → Requires recent login
2. Redireciona para login → Sucesso
3. Login novamente → Volta para change-password

**API:**
1. Token válido → Flag removida
2. Token inválido → Erro 401
3. Firestore atualizado → passwordChangedAt definido

### 15.2 Testes de Segurança
1. Tentar acessar sem autenticação → Bloqueado
2. Tentar usar senha fraca → Rejeitado
3. Tentar reutilizar senha atual → Bloqueado
4. Verificar reautenticação → Obrigatória
5. Verificar remoção de flag → Sincronizada

### 15.3 Testes de UI
1. Responsividade mobile
2. Responsividade tablet
3. Responsividade desktop
4. Modo escuro (se implementado)
5. Acessibilidade (screen readers)
6. Feedback visual de erros

---

## 16. Troubleshooting

### 16.1 Usuário Não Consegue Trocar Senha

**Possíveis Causas:**
- Senha atual incorreta
- Nova senha muito fraca
- Senhas não coincidem
- Sessão expirada

**Soluções:**
- Verificar senha temporária no email
- Usar senha mais forte (6+ caracteres)
- Confirmar senhas coincidem
- Fazer logout e login novamente

### 16.2 Flag Não é Removida

**Possíveis Causas:**
- Erro na API
- Token expirado
- Problema de conexão
- Erro no Firebase Admin

**Soluções:**
- Verificar console do navegador
- Verificar logs do servidor
- Admin pode remover flag manualmente
- Tentar trocar senha novamente

### 16.3 Usuário Fica em Loop

**Possíveis Causas:**
- Flag não foi removida
- Cache de custom claims
- Token antigo ainda ativo

**Soluções:**
- Fazer logout completo
- Limpar cache do navegador
- Aguardar expiração do token (1 hora)
- Admin verificar custom claims no Firebase

### 16.4 Erro "Requires Recent Login"

**Possíveis Causas:**
- Sessão muito antiga
- Token expirado
- Firebase requer reautenticação

**Soluções:**
- Fazer logout e login novamente
- Tentar trocar senha imediatamente após login
- Não deixar página aberta por muito tempo

---

## 17. Glossário

- **requirePasswordChange:** Flag que força usuário a trocar senha
- **Senha Temporária:** Senha gerada por admin, deve ser trocada
- **Reautenticação:** Confirmar identidade fornecendo senha atual
- **Custom Claims:** Metadados de permissão no token JWT
- **passwordChangedAt:** Timestamp de quando senha foi trocada
- **passwordResetAt:** Timestamp de quando admin resetou senha
- **updatePassword:** Método do Firebase para atualizar senha
- **reauthenticateWithCredential:** Método para confirmar identidade

---

## 18. Referências

### 18.1 Documentação Relacionada
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Reset Password Documentation - `project_doc/reset-password-documentation.md`
- Waiting Approval Documentation - `project_doc/waiting-approval-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 18.2 Código Fonte
- **Página:** `src/app/(auth)/change-password/page.tsx`
- **API:** `src/app/api/users/clear-password-change-flag/route.ts`
- **Login Page:** `src/app/(auth)/login/page.tsx`
- **useAuth Hook:** `src/hooks/useAuth.ts`
- **Types:** `src/types/index.ts`

### 18.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase updatePassword](https://firebase.google.com/docs/auth/web/manage-users#set_a_users_password)
- [Firebase reauthenticateWithCredential](https://firebase.google.com/docs/auth/web/manage-users#re-authenticate_a_user)
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)

---

## 19. Diagrama de Sequência

```
Admin         Firebase Admin    Firestore    Usuário    Login Page    Change Page    API    Firebase Auth
  │                │               │            │             │              │         │           │
  │ 1. Reset senha │               │            │             │              │         │           │
  │ ──────────────>│               │            │             │              │         │           │
  │                │               │            │             │              │         │           │
  │                │ 2. updateUser │            │             │              │         │           │
  │                │ ─────────────────────────────────────────────────────────────────>│
  │                │               │            │             │              │         │           │
  │                │ 3. setCustomUserClaims     │             │              │         │           │
  │                │ ─────────────────────────────────────────────────────────────────>│
  │                │               │            │             │              │         │           │
  │                │ 4. Update Firestore        │             │              │         │           │
  │                │ ─────────────>│            │             │              │         │           │
  │                │               │            │             │              │         │           │
  │                │ 5. Email com senha temp    │             │              │         │           │
  │                │ ───────────────────────────>│            │              │         │           │
  │                │               │            │             │              │         │           │
  │                │               │            │ 6. Login    │              │         │           │
  │                │               │            │ ───────────>│              │         │           │
  │                │               │            │             │              │         │           │
  │                │               │            │             │ 7. Verifica claims     │           │
  │                │               │            │             │ ────────────────────────────────>│
  │                │               │            │             │              │         │           │
  │                │               │            │             │ 8. requirePasswordChange: true    │
  │                │               │            │             │ <────────────────────────────────│
  │                │               │            │             │              │         │           │
  │                │               │            │             │ 9. Redireciona         │           │
  │                │               │            │             │ ────────────>│         │           │
  │                │               │            │             │              │         │           │
  │                │               │            │ 10. Preenche formulário    │         │           │
  │                │               │            │ ───────────────────────────>│        │           │
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │ 11. Reauth          │
  │                │               │            │             │              │ ────────────────────>│
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │ 12. updatePassword  │
  │                │               │            │             │              │ ────────────────────>│
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │ 13. Clear flag      │
  │                │               │            │             │              │ ───────>│           │
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │         │ 14. Remove claim
  │                │               │            │             │              │         │ ─────────>│
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │         │ 15. Update Firestore
  │                │               │            │             │              │         │ ─────────>│
  │                │               │            │             │              │         │           │
  │                │               │            │             │              │ 16. Redireciona     │
  │                │               │            │             │              │    dashboard        │
  │                │               │            │ <───────────────────────────│         │           │
```

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Aprovado
