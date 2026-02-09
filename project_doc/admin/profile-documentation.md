# Documentação Experimental - Perfil do Admin

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Perfil do System Admin (`/admin/profile`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de perfil do System Admin com dois formulários independentes: atualização de nome (displayName) e alteração de senha. Toda a lógica opera via Firebase Auth client SDK (`updateProfile`, `updatePassword`, `reauthenticateWithCredential`), sem necessidade de API routes ou operações no Firestore. Página compacta (~267 linhas) com layout `max-w-2xl` centralizado.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/profile/page.tsx`
- **Rota:** `/admin/profile`
- **Layout:** Admin Layout (restrito a `system_admin`)

### 1.2 Dependências Principais
- **useAuth Hook:** `src/hooks/useAuth.ts` — obtém objeto `user` do Firebase Auth
- **Firebase Auth SDK:** `updateProfile`, `updatePassword`, `reauthenticateWithCredential`, `EmailAuthProvider` de `firebase/auth`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label
- **Lucide Icons:** User, Mail, Key, Save, Shield
- **Next.js:** `Link` (não utilizado ativamente), `useRouter` (importado mas não utilizado diretamente)

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Atualizar seu próprio nome de exibição e alterar sua própria senha
- **Comportamento:** Dados do perfil (email, displayName) carregados do objeto `user` do Firebase Auth
- **Restrições:** Único tipo de usuário com acesso; email não pode ser alterado; senha mínima de 8 caracteres (regra específica para system_admin)

---

## 3. Estrutura de Dados

### 3.1 Estados do Componente

```typescript
// Profile form states
const [displayName, setDisplayName] = useState(user?.displayName || "");
const [profileLoading, setProfileLoading] = useState(false);
const [profileSuccess, setProfileSuccess] = useState("");    // Mensagem verde
const [profileError, setProfileError] = useState("");        // Mensagem vermelha

// Password form states
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [passwordLoading, setPasswordLoading] = useState(false);
const [passwordSuccess, setPasswordSuccess] = useState("");  // Mensagem verde
const [passwordError, setPasswordError] = useState("");      // Mensagem vermelha
```

**Campos Principais:**
- **displayName:** Inicializado com `user?.displayName || ""` — valor atual do Firebase Auth
- **profileSuccess/profileError:** Strings que controlam exibição de feedbacks visuais (mutuamente exclusivos por formulário)
- **currentPassword:** Necessário para reautenticação antes de trocar senha

---

## 4. Casos de Uso

### 4.1 UC-001: Atualizar Nome de Exibição

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- Objeto `user` do Firebase Auth disponível

**Fluxo Principal:**
1. Admin edita o campo "Nome" (Input controlado por `displayName`)
2. Admin clica "Salvar Alterações"
3. Form submit chama `handleUpdateProfile(e)`
4. `profileError` e `profileSuccess` são limpos
5. `profileLoading` é definido como `true`
6. Verifica que `user` existe (senão, throw "Usuário não autenticado")
7. `updateProfile(user, { displayName: displayName.trim() })` é chamado
8. Sucesso: `profileSuccess` = "Perfil atualizado com sucesso!" (div verde)
9. `profileLoading` volta para `false`

**Fluxo Alternativo - Erro:**
1. `updateProfile` lança exceção
2. `profileError` recebe `error.message || "Erro ao atualizar perfil"` (div vermelha)

**Pós-condições:**
- `displayName` atualizado no Firebase Auth
- Feedback visual verde exibido no formulário

**Regra de Negócio:**
- `displayName` é trimado antes de salvar (`displayName.trim()`)
- Atualiza APENAS no Firebase Auth (NÃO no Firestore — sem sincronização com coleção `users`)

---

### 4.2 UC-002: Alterar Senha

**Ator:** System Admin
**Pré-condições:**
- Admin conhece a senha atual
- Objeto `user` com `email` disponível

**Fluxo Principal:**
1. Admin preenche: Senha Atual, Nova Senha (≥ 8 chars), Confirmar Nova Senha
2. Admin clica "Alterar Senha"
3. Form submit chama `handleUpdatePassword(e)`
4. `passwordError` e `passwordSuccess` são limpos
5. **Validação 1:** `newPassword.length < 8` → erro "Para system_admin, a senha deve ter pelo menos 8 caracteres"
6. **Validação 2:** `newPassword !== confirmPassword` → erro "As senhas não coincidem"
7. `passwordLoading` é definido como `true`
8. Verifica que `user` e `user.email` existem
9. Cria credential: `EmailAuthProvider.credential(user.email, currentPassword)`
10. Reautentica: `reauthenticateWithCredential(user, credential)`
11. Troca senha: `updatePassword(user, newPassword)`
12. Sucesso: `passwordSuccess` = "Senha alterada com sucesso!" (div verde)
13. Campos de senha são limpos (`setCurrentPassword("")`, `setNewPassword("")`, `setConfirmPassword("")`)

**Fluxo Alternativo 1 - Senha atual incorreta:**
1. `reauthenticateWithCredential` lança `auth/wrong-password`
2. `passwordError` = "Senha atual incorreta"

**Fluxo Alternativo 2 - Rate limiting:**
1. Firebase Auth lança `auth/too-many-requests`
2. `passwordError` = "Muitas tentativas. Tente novamente mais tarde"

**Fluxo Alternativo 3 - Erro genérico:**
1. Outro erro Firebase
2. `passwordError` = `error.message || "Erro ao alterar senha"`

**Pós-condições:**
- Senha atualizada no Firebase Auth
- Campos de senha limpos
- Feedback visual verde exibido

**Regra de Negócio:**
- Reautenticação obrigatória antes de troca de senha (requisito do Firebase Auth)
- Mínimo de 8 caracteres específico para system_admin (mais restritivo que os 6 do Firebase padrão)

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                  PERFIL DO ADMIN (/admin/profile)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ Card: Informações│          │ Card: Alterar    │
    │ Pessoais         │          │ Senha            │
    └──────────────────┘          └──────────────────┘
               │                             │
               ▼                             ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ Email (disabled) │          │ Senha Atual      │
    │ Nome (editável)  │          │ Nova Senha       │
    │ Salvar Alterações│          │ Confirmar Senha  │
    └──────────────────┘          │ Alterar Senha    │
               │                  └──────────────────┘
               ▼                             │
    ┌──────────────────┐                     ▼
    │ updateProfile()  │          ┌──────────────────┐
    │ Firebase Auth    │          │ Valida:          │
    └──────────────────┘          │ ≥ 8 chars?       │
         │         │              │ Senhas iguais?   │
    Sucesso     Erro              └──────────────────┘
         │         │                    │         │
         ▼         ▼               SIM  │         │ NÃO
  ┌──────────┐ ┌──────────┐            │         │
  │ Msg verde│ │ Msg verme│            ▼         ▼
  │ "Perfil  │ │ lha com  │  ┌──────────────┐ ┌──────────┐
  │ atualiz."│ │ error.msg│  │ Reautenticar │ │ Msg erro │
  └──────────┘ └──────────┘  │ credential   │ │ validação│
                              └──────────────┘ └──────────┘
                                    │
                              ┌─────┴─────┐
                              │           │
                         Sucesso       Erro
                              │           │
                              ▼           ▼
                   ┌──────────────┐ ┌──────────────┐
                   │ updatePass() │ │ wrong-pass   │
                   │ Firebase Auth│ │ too-many-req │
                   └──────────────┘ └──────────────┘
                         │
                         ▼
                   ┌──────────────┐
                   │ Msg verde    │
                   │ "Senha alter.│
                   │ Limpa campos │
                   └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Senha Mínima de 8 Caracteres para System Admin
**Descrição:** Enquanto o Firebase Auth aceita mínimo de 6 caracteres, a página do admin exige mínimo de 8 para maior segurança.
**Aplicação:** Validação frontend em `handleUpdatePassword` antes de chamar Firebase Auth
**Exceções:** Nenhuma — validação sempre aplicada
**Justificativa:** System Admin tem acesso irrestrito à plataforma; senha mais forte é necessária

### RN-002: Reautenticação Obrigatória para Troca de Senha
**Descrição:** Firebase Auth exige reautenticação recente antes de operações sensíveis como troca de senha.
**Aplicação:** `reauthenticateWithCredential(user, credential)` chamado antes de `updatePassword`
**Exceções:** Se sessão foi recém-criada, Firebase pode não exigir (mas o código sempre reautentica)
**Justificativa:** Requisito de segurança do Firebase Auth para prevenir alterações não autorizadas

### RN-003: Email Imutável
**Descrição:** O campo de email é exibido como `disabled` e não pode ser alterado pela interface.
**Aplicação:** Input com `disabled` e texto explicativo "O email não pode ser alterado"
**Exceções:** Nenhuma
**Justificativa:** Alteração de email requer fluxo separado com verificação (não implementado)

### RN-004: DisplayName Apenas no Firebase Auth
**Descrição:** A atualização do nome (`displayName`) ocorre apenas no Firebase Auth, sem sincronização com o documento do usuário no Firestore.
**Aplicação:** `updateProfile(user, { displayName })` — apenas Auth
**Exceções:** Nenhuma
**Justificativa:** Decisão de simplicidade no MVP; sincronização com Firestore é melhoria futura

---

## 7. Estados da Interface

### 7.1 Estado: Página Carregada
**Quando:** Componente montado com `user` disponível
**Exibição:**
- **Header:** Ícone Shield + "Meu Perfil" (h1, text-3xl) + "Gerencie suas informações de System Admin"
- **Card 1: Informações Pessoais** (ícone User)
  - Email (Input disabled, com ícone Mail e texto "O email não pode ser alterado")
  - Nome (Input editável, required)
  - Botão "Salvar Alterações" (ícone Save)
- **Card 2: Alterar Senha** (ícone Key)
  - Senha Atual (type="password", required, autoComplete="current-password")
  - Nova Senha (type="password", required, minLength=8, autoComplete="new-password") + hint "Mínimo de 8 caracteres para system_admin"
  - Confirmar Nova Senha (type="password", required, autoComplete="new-password")
  - Botão "Alterar Senha" (ícone Key)

### 7.2 Estado: Salvando Perfil
**Quando:** `profileLoading === true`
**Exibição:** Botão muda para "Salvando..." e fica `disabled`, Input Nome fica `disabled`

### 7.3 Estado: Sucesso Perfil
**Quando:** `profileSuccess` não vazio
**Exibição:** Div verde (`text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md`) com mensagem

### 7.4 Estado: Erro Perfil
**Quando:** `profileError` não vazio
**Exibição:** Div vermelha (`text-destructive bg-destructive/10 p-3 rounded-md`) com mensagem

### 7.5 Estado: Alterando Senha
**Quando:** `passwordLoading === true`
**Exibição:** Botão muda para "Alterando..." e fica `disabled`, todos os campos de senha ficam `disabled`

### 7.6 Estado: Sucesso Senha
**Quando:** `passwordSuccess` não vazio
**Exibição:** Div verde com "Senha alterada com sucesso!", campos de senha limpos

### 7.7 Estado: Erro Senha
**Quando:** `passwordError` não vazio
**Exibição:** Div vermelha com mensagem específica do erro

---

## 8. Validações

### 8.1 Validações de Frontend
- **Nome (displayName):**
  - `required` no Input HTML
  - Trimado antes de enviar: `displayName.trim()`
  - Mensagem de erro: nativa do browser (required)

- **Senha Atual:**
  - `required` no Input HTML
  - Validada pelo Firebase Auth na reautenticação

- **Nova Senha:**
  - `required` + `minLength={8}` no Input HTML
  - Validação JavaScript: `newPassword.length < 8`
  - Mensagem de erro: "Para system_admin, a senha deve ter pelo menos 8 caracteres"

- **Confirmar Nova Senha:**
  - `required` no Input HTML
  - Validação JavaScript: `newPassword !== confirmPassword`
  - Mensagem de erro: "As senhas não coincidem"

### 8.2 Validações de Backend
- **Firebase Auth - reauthenticateWithCredential:** Valida senha atual
  - `auth/wrong-password` → "Senha atual incorreta"
  - `auth/too-many-requests` → "Muitas tentativas. Tente novamente mais tarde"
- **Firebase Auth - updatePassword:** Valida requisitos de senha do Firebase

### 8.3 Validações de Permissão
- **Admin Layout:** Verifica custom claim `is_system_admin === true` antes de renderizar
- **Firebase Auth:** Operações de `updateProfile` e `updatePassword` só funcionam para o usuário autenticado (self-service)

---

## 9. Integrações

### 9.1 Firebase Auth — updateProfile
- **Tipo:** Firebase Auth Client SDK
- **Método:** `updateProfile(user, { displayName })`
- **Entrada:** Objeto user do Auth + novo displayName
- **Retorno:** Promise<void> (sucesso) ou erro
- **Erros:** Genéricos do Firebase Auth

### 9.2 Firebase Auth — reauthenticateWithCredential
- **Tipo:** Firebase Auth Client SDK
- **Método:** `reauthenticateWithCredential(user, credential)`
- **Entrada:** Objeto user + `EmailAuthProvider.credential(email, currentPassword)`
- **Retorno:** Promise<UserCredential> (sucesso) ou erro
- **Erros:** `auth/wrong-password`, `auth/too-many-requests`

### 9.3 Firebase Auth — updatePassword
- **Tipo:** Firebase Auth Client SDK
- **Método:** `updatePassword(user, newPassword)`
- **Entrada:** Objeto user + nova senha string
- **Retorno:** Promise<void> (sucesso) ou erro
- **Erros:** `auth/weak-password`, `auth/requires-recent-login`

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Reautenticação obrigatória antes de troca de senha
- ✅ Senha mínima de 8 caracteres para system_admin (mais restritiva que o padrão)
- ✅ Campo de email somente leitura (disabled)
- ✅ Campos `type="password"` com `autoComplete` apropriado (current-password, new-password)
- ✅ Formulários independentes (erro em um não afeta o outro)
- ✅ Validação de igualdade entre nova senha e confirmação

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Não há validação de complexidade de senha (apenas comprimento ≥ 8)
- ⚠️ `displayName` atualiza apenas no Firebase Auth, não no Firestore (inconsistência de dados)
- ⚠️ Sem indicador de força de senha
- ⚠️ Sem botão mostrar/ocultar senha
- **Mitigação:** Firebase Auth aplica suas próprias regras de senha; Admin Layout garante acesso restrito

### 10.3 Dados Sensíveis
- **Senha atual:** Trafegada apenas via Firebase Auth SDK (HTTPS), não armazenada
- **Nova senha:** Enviada para Firebase Auth, campos limpos após sucesso
- **Email:** Exibido como somente leitura, obtido do objeto user

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** Instantâneo (sem queries ao Firestore)
- **Requisições:** 0 queries ao Firestore, apenas operações Auth sob demanda
- **Tamanho do componente:** ~267 linhas

### 11.2 Otimizações Implementadas
- ✅ Sem queries ao montar (dados vêm do objeto `user` já em memória)
- ✅ Formulários independentes com loading states separados
- ✅ Layout `max-w-2xl` centralizado para leitura otimizada

### 11.3 Gargalos Identificados
- ⚠️ Nenhum gargalo significativo — página é leve e sem queries ao Firestore

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)
- **Versão:** N/A

### 12.2 Recursos Implementados
- ✅ Labels em todos os inputs (`<Label htmlFor="...">`)
- ✅ `autoComplete` apropriado em campos de senha
- ✅ `required` em todos os campos obrigatórios
- ✅ `minLength={8}` no input de nova senha
- ✅ Textos descritivos nos cards (CardTitle + CardDescription)
- ✅ Hint text para campo de email e senha

### 12.3 Melhorias Necessárias
- [ ] Foco automático no primeiro campo com erro
- [ ] ARIA-live para feedbacks de sucesso/erro (atualmente apenas visual)
- [ ] Contraste do hint text muted (pode ser insuficiente em temas claros)
- [ ] Suporte a dark mode nos feedbacks verde/vermelho (parcial com `dark:bg-green-900/20`)

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Atualizar nome com sucesso**
   - **Dado:** Admin logado com displayName "Admin Original"
   - **Quando:** Altera para "Admin Novo" e clica "Salvar Alterações"
   - **Então:** Feedback verde "Perfil atualizado com sucesso!", displayName atualizado no Auth

2. **Alterar senha com sucesso**
   - **Dado:** Admin logado, conhece senha atual
   - **Quando:** Preenche senha atual correta, nova senha ≥ 8 chars, confirmação igual
   - **Então:** Feedback verde "Senha alterada com sucesso!", campos limpos

3. **Senha atual incorreta**
   - **Dado:** Admin preenche senha atual errada
   - **Quando:** Clica "Alterar Senha"
   - **Então:** Feedback vermelho "Senha atual incorreta"

4. **Nova senha muito curta**
   - **Dado:** Admin preenche nova senha com 5 caracteres
   - **Quando:** Clica "Alterar Senha"
   - **Então:** Feedback vermelho "Para system_admin, a senha deve ter pelo menos 8 caracteres" (sem chamada ao Auth)

5. **Senhas não coincidem**
   - **Dado:** Nova senha ≠ confirmação
   - **Quando:** Clica "Alterar Senha"
   - **Então:** Feedback vermelho "As senhas não coincidem" (sem chamada ao Auth)

### 13.2 Casos de Teste de Erro
1. **Too many requests:** Firebase retorna rate limit → "Muitas tentativas. Tente novamente mais tarde"
2. **Usuário não autenticado:** `user` é null → throw "Usuário não autenticado"
3. **Erro genérico do Auth:** Mensagem original do Firebase exibida

### 13.3 Testes de Integração
- [ ] Verificar que displayName atualizado aparece no header do Admin Layout
- [ ] Verificar que nova senha funciona no próximo login
- [ ] Verificar rate limiting do Firebase Auth com múltiplas tentativas

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Foto de perfil (avatar) com upload para Firebase Storage
- [ ] Sincronização de displayName com Firestore (coleção `users`)
- [ ] Alteração de email com verificação
- [ ] Autenticação 2FA (two-factor authentication)

### 14.2 UX/UI
- [ ] Indicador de força de senha (barra visual)
- [ ] Botão mostrar/ocultar senha (eye toggle)
- [ ] Confirmação visual antes de salvar (modal)
- [ ] Loading skeleton enquanto user carrega

### 14.3 Performance
- [ ] Nenhuma melhoria necessária (página já é leve)

### 14.4 Segurança
- [ ] Validação de complexidade de senha (maiúsculas, números, especiais)
- [ ] Notificação por email ao alterar senha
- [ ] Logout de outras sessões após troca de senha
- [ ] Histórico de senhas (impedir reuso)

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Admin Layout:** Provê verificação de autenticação e exibe displayName no header/sidebar
- **Admin Dashboard (`/admin/dashboard`):** Ponto de entrada principal do admin
- **Login (`/login`):** Página afetada por alteração de senha

### 15.2 Fluxos que Passam por Esta Página
1. **Dashboard → Perfil:** Admin acessa perfil via navegação lateral
2. **Perfil → (mesma página):** Ações são inline, sem navegação para outra página

### 15.3 Impacto de Mudanças
- **Alto impacto:** Alterações no Firebase Auth SDK (versão, API)
- **Médio impacto:** Alterações no useAuth hook (afeta disponibilidade do `user`)
- **Baixo impacto:** Alterações visuais nos cards (apenas UI)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Firebase Auth Client SDK:** Todas as operações são feitas client-side via SDK. Não há necessidade de API routes porque o Firebase Auth permite que o próprio usuário autenticado atualize seu perfil e senha.
- **Formulários independentes:** Dois cards separados com estados e loading independentes. Sucesso/erro em um não afeta o outro.
- **Sem Firestore:** Nenhuma interação com Firestore — toda a informação vem do objeto `user` do Auth.

### 16.2 Padrões Utilizados
- **Controlled State:** `useState` para todos os campos de formulário e feedbacks
- **Form Submit:** Handlers em `onSubmit` do formulário (previne submit padrão com `e.preventDefault`)
- **Error Mapping:** Switch/if sobre `error.code` do Firebase para mensagens amigáveis em português
- **Cleanup on Success:** Campos de senha limpos após troca bem-sucedida

### 16.3 Limitações Conhecidas
- ⚠️ `displayName` não sincroniza com Firestore (pode causar inconsistência se usado em queries)
- ⚠️ `useRouter` é importado mas não utilizado diretamente no componente
- ⚠️ `Link` é importado de `next/link` mas não utilizado no componente
- ⚠️ Sem dark mode completo nos feedbacks de sucesso/erro (parcialmente implementado)

### 16.4 Notas de Implementação
- Componente usa `"use client"` por depender de hooks React e Firebase Auth
- Página tem ~267 linhas
- Layout usa `max-w-2xl` para formulário focado e legível
- Feedbacks de sucesso usam `bg-green-50 dark:bg-green-900/20` (suporte parcial dark mode)
- Feedbacks de erro usam `bg-destructive/10` (herda tema do Shadcn)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

- **DisplayName:** Nome de exibição do usuário armazenado no Firebase Authentication
- **System Admin:** Administrador global da plataforma Curva Mestra com acesso irrestrito
- **Reautenticação:** Processo de confirmar a identidade do usuário antes de operações sensíveis no Firebase Auth
- **Custom Claims:** Metadados de permissão armazenados no token JWT do Firebase Authentication
- **EmailAuthProvider:** Provedor de autenticação por email/senha do Firebase
- **Credential:** Objeto que representa credenciais de autenticação (email + senha) para reautenticação

---

## 19. Referências

### 19.1 Documentação Relacionada
- Admin Dashboard - `project_doc/admin/dashboard-documentation.md`
- Clinic Profile - `project_doc/clinic/profile-documentation.md`
- Change Password (Auth) - `project_doc/auth/change-password-documentation.md`

### 19.2 Links Externos
- [Firebase Auth - Update Profile](https://firebase.google.com/docs/auth/web/manage-users#update_a_users_profile)
- [Firebase Auth - Reauthenticate](https://firebase.google.com/docs/auth/web/manage-users#re-authenticate_a_user)
- [Firebase Auth - Update Password](https://firebase.google.com/docs/auth/web/manage-users#set_a_users_password)

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(admin)/admin/profile/page.tsx`
- **Auth Hook:** `src/hooks/useAuth.ts`
- **Firebase Config:** `src/lib/firebase.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — página renderizada no browser]

### 20.2 Diagramas
Diagrama de fluxo incluído na Seção 5.

### 20.3 Exemplos de Código

```typescript
// Exemplo: Atualização de perfil
await updateProfile(user, {
  displayName: displayName.trim(),
});

// Exemplo: Reautenticação + troca de senha
const credential = EmailAuthProvider.credential(user.email, currentPassword);
await reauthenticateWithCredential(user, credential);
await updatePassword(user, newPassword);

// Exemplo: Mapeamento de erros Firebase para mensagens amigáveis
if (error.code === "auth/wrong-password") {
  setPasswordError("Senha atual incorreta");
} else if (error.code === "auth/too-many-requests") {
  setPasswordError("Muitas tentativas. Tente novamente mais tarde");
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
