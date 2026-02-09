# Documentação Experimental - Página Waiting Approval

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação  
**Componente:** Página de Aguardando Aprovação (`/waiting-approval`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página Waiting Approval é uma **tela de espera** exibida para usuários que criaram conta no Firebase Auth mas ainda não tiveram seus **custom claims** configurados por um System Admin. É um estado intermediário entre a criação da conta e o acesso completo ao sistema.

Esta página serve como:
- **Feedback visual** de que a conta foi criada
- **Comunicação clara** de que aprovação é necessária
- **Bloqueio temporário** até configuração ser concluída
- **Ponto de saída** para fazer logout

### 1.1 Quando Esta Página é Exibida?

Usuário é redirecionado para `/waiting-approval` quando:
1. Fez login mas não possui `role` nos custom claims
2. Fez login mas não possui `active` nos custom claims
3. Fez login mas `active: false` nos custom claims
4. Tentou acessar rota protegida sem claims configurados

### 1.2 Localização
- **Arquivo:** `src/app/(auth)/waiting-approval/page.tsx`
- **Rota:** `/waiting-approval`
- **Layout:** Auth Layout (sem navegação principal)

### 1.3 Dependências Principais
- **Hook de Autenticação:** `src/hooks/useAuth.ts`
- **ProtectedRoute:** `src/components/auth/ProtectedRoute.tsx`
- **Firebase Auth:** Gerenciamento de sessão
- **Custom Claims:** Sistema de permissões

---

## 2. Contexto: Fluxo de Criação de Conta

### 2.1 Processo Completo

```
1. Usuário se registra
   ↓
2. Conta criada no Firebase Auth
   ↓
3. Usuário faz login
   ↓
4. Sistema verifica custom claims
   ↓
5. Claims NÃO configurados → /waiting-approval
   ↓
6. System Admin configura claims
   ↓
7. Usuário faz login novamente
   ↓
8. Claims configurados → Acesso liberado
```

### 2.2 O Que São Custom Claims?

Custom claims são metadados de permissão armazenados no token JWT do Firebase:

```typescript
interface CustomClaims {
  tenant_id: string | null;
  role: UserRole;
  is_system_admin: boolean;
  is_consultant?: boolean;
  consultant_id?: string;
  authorized_tenants?: string[];
  active: boolean;
  requirePasswordChange?: boolean;
}
```

**Sem estes claims, o usuário não pode acessar o sistema.**

---

## 3. Casos de Uso

### 3.1 UC-001: Usuário Recém-Registrado Faz Login

**Ator:** Novo Usuário  
**Pré-condições:**
- Usuário completou registro
- Conta criada no Firebase Auth
- Custom claims NÃO configurados

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Usuário insere credenciais
3. Firebase Auth valida credenciais (OK)
4. Sistema obtém custom claims do token
5. Sistema detecta ausência de `role` ou `active`
6. Sistema redireciona para `/waiting-approval`
7. Página exibe mensagem de aguardo
8. Usuário vê seu nome (displayName)
9. Usuário lê instruções
10. Usuário aguarda aprovação do admin

**Pós-condições:**
- Usuário autenticado mas sem acesso
- Sessão ativa
- Aguardando configuração de claims

**Mensagem Exibida:**
```
Conta Criada com Sucesso
Aguardando aprovação do administrador

Olá, [Nome do Usuário]!

Sua conta foi criada com sucesso. No entanto, você 
precisará aguardar que um administrador do sistema 
configure seu acesso e associe você a uma clínica.

⚠️ Entre em contato com o administrador do sistema 
para solicitar a ativação da sua conta.

[Botão: Sair]
```

---

### 3.2 UC-002: Usuário com active: false Tenta Acessar

**Ator:** Usuário Desativado  
**Pré-condições:**
- Usuário possui conta
- Custom claims configurados
- Campo `active: false`

**Fluxo Principal:**
1. Usuário faz login
2. Sistema obtém custom claims
3. Sistema detecta `active: false`
4. Sistema redireciona para `/waiting-approval`
5. Página exibe mensagem de aguardo

**Pós-condições:**
- Usuário bloqueado
- Não pode acessar sistema
- Deve aguardar reativação

**Cenários de active: false:**
- Usuário foi desativado por admin
- Conta suspensa temporariamente
- Aguardando reativação após problema

---

### 3.3 UC-003: Usuário Tenta Acessar Rota Protegida Sem Claims

**Ator:** Usuário Sem Claims  
**Pré-condições:**
- Usuário autenticado
- Sem custom claims
- Tenta acessar rota protegida (ex: `/clinic/dashboard`)

**Fluxo Principal:**
1. Usuário tenta acessar `/clinic/dashboard`
2. ProtectedRoute verifica autenticação (OK)
3. ProtectedRoute verifica claims (AUSENTES)
4. ProtectedRoute redireciona para `/waiting-approval`
5. Página exibe mensagem de aguardo

**Pós-condições:**
- Acesso negado à rota protegida
- Redirecionado para waiting-approval

**Regra de Negócio:**
- Todas as rotas protegidas verificam claims
- Sem claims = sem acesso

---

### 3.4 UC-004: Usuário Faz Logout da Página

**Ator:** Usuário Aguardando Aprovação  
**Pré-condições:**
- Usuário está em `/waiting-approval`

**Fluxo Principal:**
1. Usuário lê mensagem de aguardo
2. Usuário clica em botão "Sair"
3. Sistema executa `signOut()`
4. Sistema limpa sessão do Firebase
5. Sistema redireciona para `/login`

**Pós-condições:**
- Usuário deslogado
- Sessão encerrada
- Pode fazer login novamente quando aprovado

---

### 3.5 UC-005: Admin Aprova Usuário (Fora desta Página)

**Ator:** System Admin  
**Pré-condições:**
- Usuário está aguardando aprovação
- Admin acessa painel de usuários

**Fluxo Principal:**
1. Admin acessa `/admin/users`
2. Admin visualiza usuário pendente
3. Admin configura:
   - `role`: "clinic_admin" ou "clinic_user"
   - `tenant_id`: ID da clínica
   - `active`: true
4. Admin salva configurações
5. Sistema atualiza custom claims no Firebase
6. Usuário pode fazer login novamente
7. Usuário é redirecionado para dashboard (não mais para waiting-approval)

**Pós-condições:**
- Claims configurados
- Usuário tem acesso ao sistema
- Não é mais redirecionado para waiting-approval

---

## 4. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE WAITING APPROVAL                           │
└─────────────────────────────────────────────────────────────────┘

CENÁRIO 1: NOVO USUÁRIO
═══════════════════════════════════════════════════════════════════

    Usuário completa registro
              │
              ▼
    ┌──────────────────────────────┐
    │ Conta criada no Firebase     │
    │ - UID gerado                 │
    │ - Email/senha configurados   │
    │ - displayName definido       │
    │ - Custom claims: VAZIOS      │
    └──────────────────────────────┘
              │
              ▼
    Usuário faz login
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Auth valida         │
    │ credenciais                  │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema obtém token JWT      │
    │ e extrai custom claims       │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Verificar claims:            │
    │ - role existe?               │
    │ - active existe?             │
    └──────────────────────────────┘
         │              │
    NÃO  │              │  SIM
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Redirecionar │  │ Verificar active │
│ /waiting-    │  │ === true?        │
│ approval     │  └──────────────────┘
└──────────────┘       │          │
         │        SIM  │          │  NÃO
         │             │          │
         │             ▼          ▼
         │    ┌──────────────┐  ┌──────────────┐
         │    │ Permitir     │  │ Redirecionar │
         │    │ acesso       │  │ /waiting-    │
         │    └──────────────┘  │ approval     │
         │                      └──────────────┘
         │                             │
         └─────────────┬───────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │ PÁGINA WAITING APPROVAL      │
            │                              │
            │ - Título: Conta Criada       │
            │ - Nome do usuário            │
            │ - Mensagem de aguardo        │
            │ - Instruções                 │
            │ - Botão: Sair                │
            └──────────────────────────────┘
                       │
                       ▼
            Usuário aguarda aprovação

═══════════════════════════════════════════════════════════════════
CENÁRIO 2: ADMIN APROVA USUÁRIO
═══════════════════════════════════════════════════════════════════

    System Admin acessa painel
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin visualiza usuários     │
    │ pendentes                    │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin seleciona usuário      │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Admin configura:             │
    │ - role: clinic_admin         │
    │ - tenant_id: [ID]            │
    │ - active: true               │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Admin SDK           │
    │ setCustomUserClaims()        │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Claims atualizados no token  │
    └──────────────────────────────┘
              │
              ▼
    Usuário faz login novamente
              │
              ▼
    ┌──────────────────────────────┐
    │ Sistema verifica claims      │
    │ - role: ✓                    │
    │ - active: true ✓             │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Redirecionar para dashboard  │
    │ apropriado                   │
    └──────────────────────────────┘

═══════════════════════════════════════════════════════════════════
CENÁRIO 3: USUÁRIO FAZ LOGOUT
═══════════════════════════════════════════════════════════════════

    Usuário em /waiting-approval
              │
              ▼
    ┌──────────────────────────────┐
    │ Usuário clica em "Sair"      │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ signOut() do Firebase        │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Sessão encerrada             │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Redirecionar para /login     │
    └──────────────────────────────┘
```

---

## 5. Regras de Negócio

### RN-001: Bloqueio por Ausência de Claims
**Descrição:** Usuários sem custom claims configurados não podem acessar o sistema  
**Aplicação:** Verificação em login e em todas as rotas protegidas  
**Exceções:** Nenhuma - todos precisam de claims  
**Justificativa:** Segurança e controle de acesso baseado em roles

### RN-002: Bloqueio por active: false
**Descrição:** Usuários com `active: false` são bloqueados mesmo tendo claims  
**Aplicação:** Verificação em login e rotas protegidas  
**Exceções:** System Admin nunca é bloqueado  
**Justificativa:** Permite desativação temporária sem deletar conta

### RN-003: Exibição de Nome do Usuário
**Descrição:** Página exibe displayName do usuário para personalização  
**Aplicação:** Obtido de `user.displayName` do Firebase Auth  
**Exceções:** Se displayName não existir, não exibe  
**Justificativa:** Melhor experiência, confirma identidade

### RN-004: Logout Disponível
**Descrição:** Usuário pode fazer logout mesmo aguardando aprovação  
**Aplicação:** Botão "Sair" sempre visível  
**Exceções:** Nenhuma  
**Justificativa:** Usuário não deve ficar "preso" na página

### RN-005: Redirecionamento Automático
**Descrição:** Usuário é automaticamente redirecionado para esta página se tentar acessar rotas protegidas sem claims  
**Aplicação:** ProtectedRoute component  
**Exceções:** Rotas públicas (login, register, forgot-password)  
**Justificativa:** Feedback claro do motivo do bloqueio

---
## 6. Estados da Interface

### 6.1 Estado: Página Carregada

**Quando:** Usuário é redirecionado para `/waiting-approval`  
**Exibição:**

**Card Header:**
- Título: "Conta Criada com Sucesso"
- Descrição: "Aguardando aprovação do administrador"

**Card Content:**
- Saudação: "Olá, [Nome do Usuário]!"
- Mensagem principal: "Sua conta foi criada com sucesso. No entanto, você precisará aguardar que um administrador do sistema configure seu acesso e associe você a uma clínica."
- Box de alerta (amarelo/âmbar):
  - Ícone de aviso
  - Texto: "Entre em contato com o administrador do sistema para solicitar a ativação da sua conta."

**Card Footer:**
- Botão: "Sair" (variant: outline)

**Interações:**
- Usuário pode clicar em "Sair" para fazer logout
- Não há outros botões ou ações disponíveis

### 6.2 Estado: Processando Logout

**Quando:** Usuário clicou em "Sair"  
**Exibição:**
- Botão pode ficar desabilitado brevemente
- Redirecionamento rápido para `/login`

**Duração:** < 1 segundo

---

## 7. Componentes da Interface

### 7.1 Estrutura Visual

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              Conta Criada com Sucesso               │
│         Aguardando aprovação do administrador       │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│         Olá, [Nome do Usuário]!                     │
│                                                     │
│    Sua conta foi criada com sucesso. No entanto,   │
│    você precisará aguardar que um administrador    │
│    do sistema configure seu acesso e associe você  │
│    a uma clínica.                                  │
│                                                     │
│    ┌───────────────────────────────────────────┐   │
│    │ ⚠️  Entre em contato com o administrador  │   │
│    │     do sistema para solicitar a ativação  │   │
│    │     da sua conta.                         │   │
│    └───────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                   [ Sair ]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2 Elementos de UI

**Card:**
- Componente: Shadcn/ui Card
- Largura: Máxima (responsivo)
- Centralizado na tela

**Título:**
- Tamanho: 2xl
- Alinhamento: Centro
- Texto: "Conta Criada com Sucesso"

**Descrição:**
- Tamanho: Padrão
- Alinhamento: Centro
- Cor: Muted foreground
- Texto: "Aguardando aprovação do administrador"

**Nome do Usuário:**
- Fonte: Medium (negrito)
- Obtido de: `user?.displayName`
- Condicional: Só exibe se displayName existir

**Box de Alerta:**
- Background: Amber-50 (light) / Amber-950/20 (dark)
- Border: Amber-200 (light) / Amber-900 (dark)
- Cor do texto: Amber-800 (light) / Amber-200 (dark)
- Padding: 4 (1rem)
- Border radius: md

**Botão Sair:**
- Variant: Outline
- Ação: `handleSignOut()`
- Posição: Centro do footer

---

## 8. Integrações

### 8.1 useAuth Hook
- **Uso:** Obter informações do usuário e função de logout
- **Dados Obtidos:**
  - `user`: Objeto do Firebase Auth (contém displayName)
  - `signOut`: Função para fazer logout
- **Quando:** Ao carregar a página

### 8.2 Firebase Auth - signOut
- **Uso:** Encerrar sessão do usuário
- **Método:** `signOut()` do hook useAuth
- **Efeito:** Limpa token JWT, remove sessão
- **Redirecionamento:** `/login` via `window.location.href`

### 8.3 ProtectedRoute Component
- **Uso:** Redirecionar usuários sem claims para esta página
- **Verificações:**
  - `!claims` → `/waiting-approval`
  - `claims.active === false` → `/waiting-approval`
- **Quando:** Ao tentar acessar qualquer rota protegida

### 8.4 Login Page
- **Uso:** Redirecionar após login se claims não configurados
- **Verificação:**
  - `!claims.role || !claims.active` → `/waiting-approval`
- **Quando:** Após login bem-sucedido

---

## 9. Segurança

### 9.1 Proteções Implementadas
- ✅ Usuário autenticado (tem sessão válida)
- ✅ Bloqueio de acesso sem claims
- ✅ Bloqueio de acesso com active: false
- ✅ Logout disponível (não fica preso)
- ✅ Não expõe informações sensíveis
- ✅ Redirecionamento automático de rotas protegidas

### 9.2 O Que NÃO É Protegido
- ⚠️ Usuário pode acessar esta página diretamente (mas não faz sentido sem estar autenticado)
- ⚠️ Não há verificação se usuário deveria estar aqui (assume que redirecionamento foi correto)

### 9.3 Considerações de Segurança

**Por que não verificar claims na própria página?**
- Página assume que foi redirecionado corretamente
- Verificação já foi feita em login ou ProtectedRoute
- Evita duplicação de lógica

**Por que permitir logout?**
- Usuário não deve ficar "preso"
- Pode ter feito login na conta errada
- Pode querer tentar com outra conta

---

## 10. Fluxo de Aprovação (Admin Side)

### 10.1 O Que o Admin Precisa Fazer?

**Passo 1: Acessar Painel de Usuários**
- Admin faz login como system_admin
- Acessa `/admin/users`

**Passo 2: Identificar Usuário Pendente**
- Visualiza lista de usuários
- Identifica usuários sem claims ou com active: false
- Pode filtrar por status

**Passo 3: Configurar Claims**
- Seleciona usuário
- Define:
  - **role:** "clinic_admin" ou "clinic_user"
  - **tenant_id:** ID da clínica
  - **active:** true
  - **is_system_admin:** false (geralmente)

**Passo 4: Salvar**
- Sistema chama Firebase Admin SDK
- `setCustomUserClaims(uid, claims)`
- Claims atualizados no token

**Passo 5: Notificar Usuário (Manual)**
- Admin pode enviar email/mensagem
- Informar que conta foi aprovada
- Usuário pode fazer login novamente

### 10.2 Quando Claims São Aplicados?

**Imediatamente:**
- Claims são salvos no Firebase Auth

**No Próximo Login:**
- Novo token JWT é gerado com claims
- Usuário não é mais redirecionado para waiting-approval

**Sem Relogin:**
- Claims antigos ainda no token atual
- Usuário precisa fazer logout e login novamente
- Ou aguardar expiração do token (1 hora)

---

## 11. Cenários Especiais

### 11.1 Usuário Faz Login Múltiplas Vezes

**Cenário:**
- Usuário faz login
- Vê waiting-approval
- Faz logout
- Faz login novamente (claims ainda não configurados)
- Vê waiting-approval novamente

**Comportamento:**
- Normal e esperado
- Usuário deve aguardar aprovação
- Não há limite de tentativas

### 11.2 Admin Aprova Mas Usuário Não Sabe

**Cenário:**
- Admin aprova usuário
- Usuário não é notificado
- Usuário não tenta fazer login novamente

**Problema:**
- Usuário não sabe que foi aprovado
- Fica aguardando indefinidamente

**Solução:**
- Admin deve notificar usuário manualmente
- Sistema pode implementar notificação automática (futuro)

### 11.3 Usuário Já Aprovado Acessa a Página

**Cenário:**
- Usuário já tem claims configurados
- Acessa `/waiting-approval` diretamente

**Comportamento:**
- Página é exibida normalmente
- Não há verificação se usuário deveria estar aqui
- Usuário pode clicar em "Sair" e fazer login novamente

**Melhoria Futura:**
- Verificar claims ao carregar página
- Se claims configurados, redirecionar para dashboard

### 11.4 Usuário Desativado (active: false)

**Cenário:**
- Usuário tinha acesso
- Admin desativa usuário (active: false)
- Usuário tenta fazer login

**Comportamento:**
- Redirecionado para `/waiting-approval`
- Vê mesma mensagem de aguardo
- Não há diferenciação entre "nunca aprovado" e "desativado"

**Melhoria Futura:**
- Mensagem diferente para usuários desativados
- Explicar motivo da desativação

---

## 12. Melhorias Futuras

### 12.1 Funcionalidades
- [ ] Notificação automática por email quando aprovado
- [ ] Diferenciação entre "aguardando aprovação" e "desativado"
- [ ] Botão "Solicitar Aprovação" que envia email ao admin
- [ ] Estimativa de tempo de aprovação
- [ ] Status em tempo real (polling ou websocket)
- [ ] Histórico de tentativas de acesso
- [ ] Link para FAQ ou documentação
- [ ] Informações de contato do admin

### 12.2 UX/UI
- [ ] Animação de loading/aguardando
- [ ] Ilustração ou ícone mais visual
- [ ] Countdown se houver SLA de aprovação
- [ ] Mensagem personalizada por tipo de usuário
- [ ] Modo escuro
- [ ] Responsividade aprimorada
- [ ] Feedback visual ao clicar em "Sair"

### 12.3 Comunicação
- [ ] Email automático ao criar conta
- [ ] Email automático quando aprovado
- [ ] SMS de notificação
- [ ] Push notification (se app mobile)
- [ ] Integração com Slack/Teams para notificar admin

### 12.4 Administração
- [ ] Dashboard de usuários pendentes
- [ ] Aprovação em lote
- [ ] Aprovação automática baseada em regras
- [ ] Workflow de aprovação (múltiplos níveis)
- [ ] Auditoria de aprovações

---

## 13. Observações Técnicas

### 13.1 Decisões de Arquitetura

**Por que página separada ao invés de modal?**
- Bloqueio completo de acesso
- Não há ação que usuário possa fazer
- Evita confusão com outras páginas
- Foco total na mensagem de aguardo

**Por que não verificar claims na própria página?**
- Página é "burra" - apenas exibe informação
- Lógica de verificação está em login e ProtectedRoute
- Evita duplicação de código
- Assume que redirecionamento foi correto

**Por que usar window.location.href ao invés de router.push?**
- Garante limpeza completa da sessão
- Força reload da aplicação
- Evita problemas de cache de estado
- Mais confiável para logout

### 13.2 Padrões Utilizados
- **Página de Estado:** Página dedicada a um estado específico
- **Feedback Claro:** Mensagem explica exatamente o que está acontecendo
- **Ação de Saída:** Sempre oferece forma de sair
- **Personalização:** Usa nome do usuário para melhor UX

### 13.3 Limitações Conhecidas
- ⚠️ Não diferencia entre "nunca aprovado" e "desativado"
- ⚠️ Não verifica se usuário deveria estar aqui
- ⚠️ Não há notificação automática de aprovação
- ⚠️ Não há status em tempo real
- ⚠️ Não há forma de contatar admin diretamente
- ⚠️ Mensagem genérica para todos os casos

### 13.4 Dependências
- **React:** Framework
- **Next.js:** Roteamento
- **Firebase Auth:** Sessão e signOut
- **useAuth Hook:** Dados do usuário
- **Shadcn/ui:** Componentes de UI (Card, Button)

---

## 14. Mensagens do Sistema

### 14.1 Título
- "Conta Criada com Sucesso"

### 14.2 Descrição
- "Aguardando aprovação do administrador"

### 14.3 Saudação
- "Olá, [Nome do Usuário]!"

### 14.4 Mensagem Principal
- "Sua conta foi criada com sucesso. No entanto, você precisará aguardar que um administrador do sistema configure seu acesso e associe você a uma clínica."

### 14.5 Alerta
- "Entre em contato com o administrador do sistema para solicitar a ativação da sua conta."

### 14.6 Botão
- "Sair"

---

## 15. Comparação com Outras Páginas de Bloqueio

| Aspecto | Waiting Approval | Suspended | Inactive Clinic |
|---------|------------------|-----------|-----------------|
| **Motivo** | Sem claims | Clínica suspensa | Clínica inativa |
| **Público** | Novos usuários | Admins de clínica | Admins de clínica |
| **Ação Disponível** | Logout | Logout, Ver detalhes | Acesso restrito |
| **Temporário?** | Sim | Sim | Sim |
| **Quem Resolve** | System Admin | System Admin | Clinic Admin |
| **Urgência** | Baixa | Alta | Média |

---

## 16. Testes Recomendados

### 16.1 Testes Funcionais

**Redirecionamento:**
1. Criar conta sem claims → Login → Deve ir para waiting-approval
2. Tentar acessar rota protegida sem claims → Deve ir para waiting-approval
3. Login com active: false → Deve ir para waiting-approval

**Exibição:**
1. Verificar título exibido corretamente
2. Verificar nome do usuário exibido
3. Verificar mensagem completa
4. Verificar box de alerta

**Logout:**
1. Clicar em "Sair" → Deve fazer logout
2. Após logout → Deve ir para /login
3. Sessão deve estar limpa

**Aprovação:**
1. Admin configura claims
2. Usuário faz login novamente
3. Não deve mais ir para waiting-approval
4. Deve ir para dashboard apropriado

### 16.2 Testes de UI
1. Responsividade em mobile
2. Responsividade em tablet
3. Responsividade em desktop
4. Modo escuro (se implementado)
5. Acessibilidade (screen readers)

### 16.3 Testes de Integração
1. Integração com useAuth
2. Integração com Firebase Auth
3. Integração com ProtectedRoute
4. Integração com Login page

---

## 17. Troubleshooting

### 17.1 Usuário Fica Preso na Página

**Possíveis Causas:**
- Claims não foram configurados pelo admin
- Admin configurou mas usuário não fez novo login
- Token antigo ainda em cache

**Soluções:**
- Verificar se admin configurou claims
- Fazer logout e login novamente
- Limpar cache do navegador
- Aguardar expiração do token (1 hora)

### 17.2 Página Não Exibe Nome do Usuário

**Possíveis Causas:**
- displayName não foi definido no registro
- Problema ao obter dados do Firebase Auth

**Soluções:**
- Verificar se displayName existe no Firebase Auth
- Verificar console do navegador por erros
- Página funciona normalmente sem displayName

### 17.3 Botão "Sair" Não Funciona

**Possíveis Causas:**
- Erro no signOut do Firebase
- Problema de conexão
- JavaScript desabilitado

**Soluções:**
- Verificar console do navegador
- Verificar conexão com internet
- Tentar limpar cache e cookies
- Fechar navegador e abrir novamente

---

## 18. Glossário

- **Custom Claims:** Metadados de permissão no token JWT do Firebase
- **active:** Flag booleana que indica se usuário está ativo
- **role:** Tipo de usuário (clinic_admin, clinic_user, system_admin, etc.)
- **tenant_id:** ID da clínica no sistema multi-tenant
- **displayName:** Nome de exibição do usuário no Firebase Auth
- **ProtectedRoute:** Componente que protege rotas e verifica permissões
- **System Admin:** Administrador do sistema Curva Mestra
- **Waiting Approval:** Estado de aguardando aprovação/configuração

---

## 19. Referências

### 19.1 Documentação Relacionada
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Register Page Documentation - `project_doc/register-page-documentation.md`
- Reset Password Documentation - `project_doc/reset-password-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 19.2 Código Fonte
- **Página:** `src/app/(auth)/waiting-approval/page.tsx`
- **ProtectedRoute:** `src/components/auth/ProtectedRoute.tsx`
- **Login Page:** `src/app/(auth)/login/page.tsx`
- **useAuth Hook:** `src/hooks/useAuth.ts`
- **Types:** `src/types/index.ts`

### 19.3 Links Externos
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing)

---

## 20. Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                                │
└─────────────────────────────────────────────────────────────────┘

    Usuário se registra
              │
              ▼
    ┌──────────────────────────────┐
    │ Firebase Auth cria conta     │
    │ - UID                        │
    │ - Email/Senha                │
    │ - displayName                │
    │ - Claims: VAZIOS             │
    └──────────────────────────────┘
              │
              ▼
    Usuário faz login
              │
              ▼
    ┌──────────────────────────────┐
    │ Login Page verifica claims   │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Claims configurados?         │
    └──────────────────────────────┘
         │              │
    NÃO  │              │  SIM
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ /waiting-    │  │ active === true? │
│ approval     │  └──────────────────┘
└──────────────┘       │          │
         │        SIM  │          │  NÃO
         │             │          │
         │             ▼          ▼
         │    ┌──────────────┐  ┌──────────────┐
         │    │ Dashboard    │  │ /waiting-    │
         │    │ apropriado   │  │ approval     │
         │    └──────────────┘  └──────────────┘
         │                             │
         └─────────────┬───────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │ WAITING APPROVAL PAGE        │
            │                              │
            │ Usuário vê:                  │
            │ - Mensagem de aguardo        │
            │ - Seu nome                   │
            │ - Instruções                 │
            │ - Botão "Sair"               │
            └──────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │ Opções do usuário:           │
            │ 1. Aguardar aprovação        │
            │ 2. Fazer logout              │
            │ 3. Contatar admin            │
            └──────────────────────────────┘
                       │
                       ▼
            Enquanto isso, em paralelo...
                       │
                       ▼
            ┌──────────────────────────────┐
            │ System Admin:                │
            │ 1. Acessa painel             │
            │ 2. Vê usuário pendente       │
            │ 3. Configura claims          │
            │ 4. Salva                     │
            └──────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │ Claims atualizados           │
            │ no Firebase Auth             │
            └──────────────────────────────┘
                       │
                       ▼
            Usuário faz login novamente
                       │
                       ▼
            ┌──────────────────────────────┐
            │ Claims agora configurados    │
            │ - role: ✓                    │
            │ - tenant_id: ✓               │
            │ - active: true ✓             │
            └──────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────┐
            │ Acesso liberado!             │
            │ Redireciona para dashboard   │
            └──────────────────────────────┘
```

---

**Documento gerado por:** Engenharia Reversa  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Aprovado
