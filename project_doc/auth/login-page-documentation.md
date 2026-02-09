# Documentação Experimental - Página de Login

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Login (`/login`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página de login é o ponto de entrada principal do sistema Curva Mestra. Ela gerencia a autenticação de diferentes tipos de usuários (System Admin, Administradores de Clínica, Usuários de Clínica e Consultores) e implementa regras de negócio complexas baseadas em roles, status de clínica e requisitos de segurança.

### 1.1 Localização
- **Arquivo:** `src/app/(auth)/login/page.tsx`
- **Rota:** `/login`
- **Layout:** Auth Layout (sem navegação principal)

### 1.2 Dependências Principais
- **Hook de Autenticação:** `src/hooks/useAuth.ts`
- **Firebase Auth:** Autenticação de usuários
- **Firestore:** Validação de status de clínicas (tenants)
- **Custom Claims:** Sistema de permissões e roles

---

## 2. Tipos de Usuários (Roles)

O sistema suporta 4 tipos de usuários, cada um com comportamento específico no login:

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador do sistema Curva Mestra
- **Acesso:** Irrestrito a todas as funcionalidades
- **Redirecionamento:** `/admin/dashboard`
- **Restrições:** Nenhuma

### 2.2 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Gerenciamento completo da sua clínica
- **Redirecionamento:** 
  - Clínica ativa: `/clinic/dashboard`
  - Clínica inativa: `/clinic/my-clinic` (acesso restrito)
- **Restrições:** Vinculado a um `tenant_id` específico

### 2.3 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Funcionalidades operacionais (pacientes, solicitações, estoque)
- **Redirecionamento:** `/clinic/dashboard` (apenas se clínica ativa)
- **Restrições:** 
  - Bloqueado se clínica inativa
  - Vinculado a um `tenant_id` específico

### 2.4 Consultor (`clinic_consultant`)
- **Descrição:** Consultor externo com acesso a múltiplas clínicas
- **Acesso:** Visualização de dados de clínicas autorizadas
- **Redirecionamento:** `/clinic/dashboard`
- **Restrições:** Acesso apenas às clínicas em `authorized_tenants`

---

## 3. Custom Claims (Permissões)

O sistema utiliza Firebase Custom Claims para gerenciar permissões. Cada usuário possui os seguintes claims:

```typescript
interface CustomClaims {
  tenant_id: string | null;           // ID da clínica (null para consultores)
  role: UserRole;                     // Tipo de usuário
  is_system_admin: boolean;           // Flag de admin do sistema
  is_consultant?: boolean;            // Flag de consultor
  consultant_id?: string;             // ID do consultor
  authorized_tenants?: string[];      // Clínicas autorizadas (consultores)
  active: boolean;                    // Status ativo/inativo
  requirePasswordChange?: boolean;    // Requer troca de senha
}
```

---

## 4. Casos de Uso

### 4.1 UC-001: Login Bem-Sucedido - System Admin

**Ator:** System Admin  
**Pré-condições:**
- Usuário possui credenciais válidas
- Usuário tem role `system_admin`
- Custom claims configurados

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica role como `system_admin`
6. Sistema redireciona para `/admin/dashboard`

**Pós-condições:**
- Usuário autenticado
- Sessão ativa
- Acesso total ao sistema

---

### 4.2 UC-002: Login Bem-Sucedido - Clinic Admin (Clínica Ativa)

**Ator:** Administrador de Clínica  
**Pré-condições:**
- Usuário possui credenciais válidas
- Usuário tem role `clinic_admin`
- Clínica está ativa (`active: true`)
- Custom claims configurados

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica role como `clinic_admin`
6. Sistema busca documento da clínica no Firestore (`tenants/{tenant_id}`)
7. Sistema verifica que `active: true`
8. Sistema redireciona para `/clinic/dashboard`

**Pós-condições:**
- Usuário autenticado
- Sessão ativa
- Acesso completo às funcionalidades da clínica

---

### 4.3 UC-003: Login com Restrição - Clinic Admin (Clínica Inativa)

**Ator:** Administrador de Clínica  
**Pré-condições:**
- Usuário possui credenciais válidas
- Usuário tem role `clinic_admin`
- Clínica está inativa (`active: false`)
- Custom claims configurados

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica role como `clinic_admin`
6. Sistema busca documento da clínica no Firestore
7. Sistema verifica que `active: false`
8. Sistema redireciona para `/clinic/my-clinic` (acesso restrito)

**Pós-condições:**
- Usuário autenticado
- Sessão ativa
- Acesso restrito apenas a:
  - Visualização de dados da clínica
  - Perfil do usuário
  - Informações de pagamento/reativação

**Regra de Negócio:**
- Administradores mantêm acesso limitado mesmo com clínica inativa
- Permite resolução de problemas de pagamento/reativação

---

### 4.4 UC-004: Login Bloqueado - Clinic User (Clínica Inativa)

**Ator:** Usuário de Clínica  
**Pré-condições:**
- Usuário possui credenciais válidas
- Usuário tem role `clinic_user`
- Clínica está inativa (`active: false`)
- Custom claims configurados

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica role como `clinic_user`
6. Sistema busca documento da clínica no Firestore
7. Sistema verifica que `active: false`
8. Sistema executa logout automático
9. Sistema exibe mensagem: "Sistema Indisponível"

**Fluxo Alternativo - Mensagem Exibida:**
```
Sistema Indisponível

O sistema encontra-se indisponível no momento. 
Procure o administrador da clínica ou entre em 
contato com o suporte técnico Curva Mestra.

Suporte técnico: suporte@curvamestra.com.br

[Botão: Voltar ao login]
```

**Pós-condições:**
- Usuário NÃO autenticado
- Sessão encerrada
- Acesso completamente bloqueado

**Regra de Negócio:**
- Usuários operacionais não têm acesso quando clínica está inativa
- Apenas administradores podem resolver problemas de reativação

---

### 4.5 UC-005: Login Pendente de Aprovação

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário completou registro
- Credenciais válidas
- Custom claims NÃO configurados (sem role ou active)

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica ausência de `role` ou `active`
6. Sistema redireciona para `/waiting-approval`

**Pós-condições:**
- Usuário autenticado mas sem acesso
- Aguardando aprovação do System Admin
- Exibe mensagem de aguardo

---

### 4.6 UC-006: Login com Requisito de Troca de Senha

**Ator:** Qualquer Usuário  
**Pré-condições:**
- Usuário possui credenciais válidas
- Custom claim `requirePasswordChange: true`
- Senha foi resetada por administrador

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e senha
3. Sistema valida credenciais no Firebase Auth
4. Sistema obtém custom claims do token
5. Sistema identifica `requirePasswordChange: true`
6. Sistema redireciona para `/change-password`

**Pós-condições:**
- Usuário autenticado mas bloqueado
- Deve trocar senha antes de acessar sistema
- Após troca, acesso liberado conforme role

**Regra de Negócio:**
- Segurança: força troca de senha após reset por admin
- Usuário não pode pular esta etapa

---

### 4.7 UC-007: Login com Credenciais Inválidas

**Ator:** Qualquer Usuário  
**Pré-condições:**
- Usuário acessa página de login

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere email e/ou senha incorretos
3. Sistema tenta validar no Firebase Auth
4. Firebase retorna erro de autenticação
5. Sistema traduz erro para português
6. Sistema exibe mensagem de erro

**Mensagens de Erro Traduzidas:**
- `wrong-password` ou `invalid-credential` → "Email ou senha incorretos"
- `user-not-found` → "Usuário não encontrado"
- `too-many-requests` → "Muitas tentativas. Tente novamente mais tarde"
- `network-request-failed` → "Erro de conexão. Verifique sua internet"
- `invalid-email` → "Email inválido"
- Outros → "Erro ao fazer login. Tente novamente"

**Pós-condições:**
- Usuário NÃO autenticado
- Permanece na página de login
- Pode tentar novamente

---

### 4.8 UC-008: Redirecionamento por Timeout de Sessão

**Ator:** Usuário Autenticado  
**Pré-condições:**
- Usuário estava autenticado
- Sessão expirou por inatividade
- Sistema redirecionou para `/login?timeout=true`

**Fluxo Principal:**
1. Sistema detecta timeout de sessão
2. Sistema redireciona para `/login?timeout=true`
3. Página de login detecta parâmetro `timeout`
4. Sistema exibe alerta informativo
5. Usuário visualiza mensagem: "Sua sessão expirou por inatividade. Por favor, faça login novamente."
6. Usuário faz login normalmente

**Pós-condições:**
- Usuário informado sobre motivo do logout
- Pode fazer login novamente

---

### 4.9 UC-009: Usuário Já Autenticado Acessa Login

**Ator:** Usuário Autenticado  
**Pré-condições:**
- Usuário já está autenticado
- Sessão ativa válida
- Custom claims configurados

**Fluxo Principal:**
1. Usuário acessa `/login` (diretamente ou por link)
2. Sistema detecta sessão ativa via `useAuth`
3. Sistema obtém custom claims
4. Sistema redireciona automaticamente baseado em role:
   - `system_admin` → `/admin/dashboard`
   - `clinic_admin` ou `clinic_user` → `/clinic/dashboard`
   - Outros → `/dashboard`

**Pós-condições:**
- Usuário não vê formulário de login
- Redirecionado para dashboard apropriado
- Sessão mantida

**Regra de Negócio:**
- Evita login duplicado
- Melhora experiência do usuário

---

## 5. Fluxo de Autenticação Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    PÁGINA DE LOGIN (/login)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Usuário já       │
                    │ autenticado?     │
                    └──────────────────┘
                         │         │
                    SIM  │         │  NÃO
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Redirecionar │  │ Exibir formulário│
              │ para         │  │ de login         │
              │ dashboard    │  └──────────────────┘
              └──────────────┘           │
                                         ▼
                              ┌──────────────────────┐
                              │ Usuário submete      │
                              │ email + senha        │
                              └──────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Firebase Auth        │
                              │ valida credenciais   │
                              └──────────────────────┘
                                    │         │
                              VÁLIDO│         │INVÁLIDO
                                    │         │
                                    ▼         ▼
                         ┌──────────────┐  ┌──────────────┐
                         │ Obter Custom │  │ Exibir erro  │
                         │ Claims       │  │ traduzido    │
                         └──────────────┘  └──────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ Claims configurados? │
                    │ (role + active)      │
                    └──────────────────────┘
                         │              │
                    SIM  │              │  NÃO
                         │              │
                         ▼              ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ requirePassword  │  │ Redirecionar     │
              │ Change?          │  │ /waiting-approval│
              └──────────────────┘  └──────────────────┘
                   │          │
              SIM  │          │  NÃO
                   │          │
                   ▼          ▼
        ┌──────────────┐  ┌──────────────────┐
        │ Redirecionar │  │ Verificar role   │
        │ /change-     │  └──────────────────┘
        │ password     │           │
        └──────────────┘           ▼
                         ┌──────────────────────┐
                         │ system_admin?        │
                         └──────────────────────┘
                              │          │
                         SIM  │          │  NÃO
                              │          │
                              ▼          ▼
                   ┌──────────────┐  ┌──────────────────┐
                   │ Redirecionar │  │ Buscar dados da  │
                   │ /admin/      │  │ clínica          │
                   │ dashboard    │  │ (tenant)         │
                   └──────────────┘  └──────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ Clínica ativa?       │
                                   └──────────────────────┘
                                        │          │
                                   SIM  │          │  NÃO
                                        │          │
                                        ▼          ▼
                             ┌──────────────┐  ┌──────────────────┐
                             │ Redirecionar │  │ clinic_user?     │
                             │ /clinic/     │  └──────────────────┘
                             │ dashboard    │       │          │
                             └──────────────┘  SIM  │          │  NÃO
                                                     │          │
                                                     ▼          ▼
                                          ┌──────────────┐  ┌──────────────┐
                                          │ Logout +     │  │ Redirecionar │
                                          │ Mensagem     │  │ /clinic/     │
                                          │ "Sistema     │  │ my-clinic    │
                                          │ Indisponível"│  │ (restrito)   │
                                          └──────────────┘  └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Hierarquia de Acesso
- **System Admin:** Acesso irrestrito, nunca bloqueado
- **Clinic Admin:** Acesso restrito quando clínica inativa
- **Clinic User:** Bloqueado quando clínica inativa
- **Consultant:** Acesso apenas a clínicas autorizadas

### RN-002: Validação de Clínica
- Validação ocorre apenas para usuários não-admin (`!is_system_admin`)
- Validação ocorre apenas se usuário tem `tenant_id`
- Busca documento em `tenants/{tenant_id}`
- Verifica campo `active`

### RN-003: Troca de Senha Obrigatória
- Usuário com `requirePasswordChange: true` não pode acessar sistema
- Deve ser redirecionado para `/change-password`
- Após troca, flag é removida e acesso liberado

### RN-004: Aprovação Pendente
- Usuário sem `role` ou sem `active` não tem acesso
- Deve aguardar aprovação do System Admin
- Redirecionado para `/waiting-approval`

### RN-005: Tradução de Erros
- Todos os erros do Firebase são traduzidos para português
- Mensagens amigáveis e claras para o usuário
- Não expõe detalhes técnicos

### RN-006: Refresh de Token
- Token é forçado a refresh (`getIdToken(true)`) após login
- Garante custom claims atualizados
- Evita problemas de sincronização

---

## 7. Estados da Interface

### 7.1 Estado: Carregando Autenticação
**Quando:** Sistema está verificando se usuário já está autenticado  
**Exibição:** "Carregando..."  
**Duração:** Breve (< 1 segundo)

### 7.2 Estado: Formulário de Login
**Quando:** Usuário não autenticado  
**Campos:**
- Email (type: email, required, autocomplete: email)
- Senha (type: password, required, autocomplete: current-password)
- Botão "Entrar"

**Links:**
- "Esqueceu a senha?" → `/forgot-password`
- "Registrar-se" → `/register`

### 7.3 Estado: Processando Login
**Quando:** Usuário submeteu formulário  
**Exibição:** 
- Botão desabilitado
- Texto: "Entrando..."
- Campos desabilitados

### 7.4 Estado: Erro de Autenticação
**Quando:** Credenciais inválidas ou erro no processo  
**Exibição:**
- Mensagem de erro em destaque (vermelho)
- Formulário habilitado para nova tentativa

### 7.5 Estado: Alerta de Timeout
**Quando:** Parâmetro `?timeout=true` na URL  
**Exibição:**
- Alerta informativo no topo
- Ícone de relógio
- Mensagem: "Sua sessão expirou por inatividade..."

### 7.6 Estado: Sistema Indisponível (Clinic User)
**Quando:** Clinic user tenta acessar com clínica inativa  
**Exibição:**
- Card com ícone de alerta
- Título: "Sistema Indisponível"
- Mensagem explicativa
- Informações de suporte
- Botão "Voltar ao login"

---

## 8. Integrações

### 8.1 Firebase Authentication
- **Método:** `signInWithEmailAndPassword`
- **Retorno:** UserCredential com user
- **Erros:** Códigos de erro do Firebase

### 8.2 Firebase Custom Claims
- **Método:** `user.getIdTokenResult()`
- **Refresh:** `user.getIdToken(true)` força atualização
- **Claims:** Objeto com permissões e metadata

### 8.3 Firestore - Tenants
- **Coleção:** `tenants`
- **Documento:** `{tenant_id}`
- **Campo verificado:** `active` (boolean)
- **Quando:** Apenas para usuários não-admin com tenant_id

---

## 9. Segurança

### 9.1 Proteções Implementadas
- ✅ Validação de email e senha obrigatórios
- ✅ Desabilitação de formulário durante processamento
- ✅ Logout automático para usuários bloqueados
- ✅ Verificação de status de clínica
- ✅ Troca de senha obrigatória quando necessário
- ✅ Mensagens de erro genéricas (não expõe detalhes)

### 9.2 Limitações do Firebase
- Rate limiting automático (muitas tentativas)
- Proteção contra brute force
- Mensagem: "Muitas tentativas. Tente novamente mais tarde"

---

## 10. Melhorias Futuras Sugeridas

### 10.1 Funcionalidades
- [ ] Login com Google/Microsoft (SSO)
- [ ] Autenticação de dois fatores (2FA)
- [ ] Lembrar dispositivo confiável
- [ ] Histórico de logins
- [ ] Notificação de login em novo dispositivo

### 10.2 UX/UI
- [ ] Indicador de força de senha
- [ ] Mostrar/ocultar senha
- [ ] Recuperação de email esquecido
- [ ] Modo escuro/claro
- [ ] Animações de transição

### 10.3 Segurança
- [ ] Captcha após múltiplas tentativas
- [ ] Bloqueio temporário de conta
- [ ] Auditoria de tentativas de login
- [ ] Alertas de segurança por email

---

## 11. Observações Técnicas

### 11.1 Suspense Boundary
- Componente usa `<Suspense>` para evitar erros de hidratação
- Necessário devido ao uso de `useSearchParams()`
- Fallback: "Carregando..."

### 11.2 Client Component
- Marcado com `"use client"`
- Necessário para hooks do React (useState, useEffect)
- Necessário para hooks do Next.js (useRouter, useSearchParams)

### 11.3 Performance
- Verificação de autenticação é rápida (< 1s)
- Busca no Firestore adiciona ~200-500ms
- Redirecionamentos são instantâneos

---

## 12. Glossário

- **Tenant:** Clínica no sistema multi-tenant
- **Custom Claims:** Metadados de permissão no token JWT
- **Role:** Tipo de usuário (system_admin, clinic_admin, etc.)
- **Active:** Status ativo/inativo de usuário ou clínica
- **Suspended:** Status de suspensão de clínica (diferente de inativo)
- **Onboarding:** Processo de configuração inicial da clínica

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento
