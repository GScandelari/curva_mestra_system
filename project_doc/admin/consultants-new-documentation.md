# Documentação Experimental - Novo Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Consultor (`/admin/consultants/new`)
**Versão:** 1.1
**Data:** 10/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário de cadastro de novo consultor Rennova com validações inline e tela de sucesso dedicada. Após criação bem-sucedida, o sistema gera automaticamente um código único de 6 dígitos, cria credenciais de acesso no Firebase Auth, envia email com senha temporária e exibe tela de confirmação com opções de cadastrar outro consultor ou visualizar a lista. Consultores são usuários especiais que podem acessar múltiplas clínicas sem pertencer a um tenant específico.

### 1.1 Localização

- **Arquivo:** `src/app/(admin)/admin/consultants/new/page.tsx`
- **Rota:** `/admin/consultants/new`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)

### 1.2 Dependências Principais

- **Firebase Auth:** `auth.currentUser` para obter `idToken` (Bearer token)
- **API Route:** `POST /api/consultants`
- **Hooks:** `useAuth()` de `src/hooks/useAuth.ts`, `useToast()` de `src/hooks/use-toast.ts`
- **UI:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Alert (shadcn/ui)
- **Ícones:** ArrowLeft, Users, Loader2, CheckCircle2, AlertCircle (lucide-react)

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)

- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Criar novos consultores, visualizar tela de sucesso, cadastrar múltiplos consultores
- **Comportamento:** Formulário com validações inline; após sucesso, pode cadastrar outro ou ir para lista
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Estado do Formulário (formData)

```typescript
// Estado local do componente
{
  name: string; // Nome completo (convertido para MAIÚSCULAS)
  email: string; // Email
  phone: string; // Telefone (apenas dígitos)
}
```

### 3.2 Estado de Validação (errors)

```typescript
{
  name?: string;     // Mensagem de erro do campo nome
  email?: string;    // Mensagem de erro do campo email
  phone?: string;    // Mensagem de erro do campo telefone
}
```

### 3.3 Dados Enviados — POST /api/consultants

```typescript
{
  name: string; // MAIÚSCULAS
  email: string; // lowercase
  phone: string; // Apenas dígitos
}
```

### 3.4 Resposta da API — Consultor Criado

```typescript
{
  success: true;
  message: string;
  data: {
    id: string;
    code: string; // Código de 6 dígitos gerado
    name: string;
    email: string;
    phone: string;
    status: 'active'; // Sempre "active" ao criar
    authorized_tenants: []; // Array vazio inicialmente
    created_at: Timestamp;
    updated_at: Timestamp;
  }
}
```

**Campos Principais:**

- **code:** Gerado automaticamente pela API (6 dígitos únicos)
- **name:** Sempre em MAIÚSCULAS (conversão no handleChange)
- **email:** Sempre em lowercase (conversão no envio)
- **phone:** Armazenado apenas com dígitos, formatado na exibição

---

## 4. Casos de Uso

### 4.1 UC-001: Criar Novo Consultor

**Ator:** System Admin
**Pré-condições:**

- Usuário autenticado como `system_admin`
- Acesso à rota `/admin/consultants/new`

**Fluxo Principal:**

1. Admin preenche formulário: Nome Completo, Email, Telefone
2. Nome é convertido para MAIÚSCULAS automaticamente no `onChange`
3. Admin clica "Criar Consultor"
4. Sistema valida campos:
   - Nome não vazio
   - Email não vazio e formato válido (regex)
   - Telefone não vazio e mínimo 10 dígitos
5. Se validações OK, `creating` definido como `true`
6. Obtém `idToken` via `auth.currentUser.getIdToken()`
7. `POST /api/consultants` com `{ name, email: email.toLowerCase(), phone }`
8. **Server-side (API Route):**
   a. Gera código único de 6 dígitos
   b. Cria usuário no Firebase Auth com email e senha temporária
   c. Define custom claims: `role: "clinic_consultant"`, `active: true`
   d. Cria documento em `consultants` no Firestore
   e. Adiciona email de boas-vindas à fila `email_queue`
9. **Client-side:** API retorna dados do consultor criado
10. `setCreatedConsultant(data.data)` armazena consultor
11. `setShowSuccess(true)` exibe tela de sucesso
12. `creating` volta para `false`

**Fluxo Alternativo - Validação falha:**

1. Sistema identifica campo(s) inválido(s)
2. `setErrors({ campo: "mensagem" })` exibe erro inline
3. Formulário não é submetido

**Fluxo Alternativo - Email duplicado:**

1. API retorna erro "Email já cadastrado"
2. Toast destructive com mensagem
3. `creating` volta para `false`

**Fluxo Alternativo - Erro de autenticação:**

1. Falha ao obter `idToken`
2. Toast destructive: "Erro de autenticação"
3. `creating` volta para `false`

**Pós-condições:**

- Consultor criado no Firestore e Firebase Auth
- Email de boas-vindas na fila
- Tela de sucesso exibida

**Regra de Negócio:** RN-001, RN-002, RN-003, RN-004

---

### 4.2 UC-002: Cadastrar Outro Consultor

**Ator:** System Admin
**Pré-condições:**

- Tela de sucesso exibida após criação

**Fluxo Principal:**

1. Admin clica "Cadastrar Outro Consultor"
2. `setShowSuccess(false)` oculta tela de sucesso
3. `setCreatedConsultant(null)` limpa consultor criado
4. `setFormData({ name: "", email: "", phone: "" })` limpa formulário
5. `setErrors({})` limpa erros
6. Formulário vazio é exibido novamente

**Pós-condições:**

- Formulário limpo e pronto para novo cadastro

**Regra de Negócio:** N/A

---

### 4.3 UC-003: Ir para Lista de Consultores

**Ator:** System Admin
**Pré-condições:**

- Tela de sucesso exibida após criação

**Fluxo Principal:**

1. Admin clica "Ver Lista de Consultores"
2. `router.push("/admin/consultants")` navega para lista

**Pós-condições:**

- Navegação para lista de consultores

**Regra de Negócio:** N/A

---

### 4.4 UC-004: Voltar para Lista (Antes de Criar)

**Ator:** System Admin
**Pré-condições:**

- Formulário exibido (antes de criar)

**Fluxo Principal:**

1. Admin clica botão "Voltar" no topo
2. `router.push("/admin/consultants")` navega para lista

**Pós-condições:**

- Navegação para lista de consultores
- Dados do formulário são perdidos

**Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│          NOVO CONSULTOR (/admin/consultants/new)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Formulário vazio │
                    │ showSuccess=false│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Admin preenche   │
                    │ Nome/Email/Tel   │
                    │ (nome→UPPERCASE) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Clica "Criar     │
                    │ Consultor"       │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Validações       │
                    │ - Nome vazio?    │
                    │ - Email válido?  │
                    │ - Tel ≥10 dígitos│
                    └──────────────────┘
                         │         │
                    Válido     Inválido
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ getIdToken() │  │ setErrors()  │
              └──────────────┘  │ Exibe inline │
                      │         └──────────────┘
                      ▼
              ┌──────────────┐
              │ POST /api/   │
              │ consultants  │
              │ Bearer token │
              └──────────────┘
                      │
                 ┌────┴────┐
            Sucesso      Erro
                 │         │
                 ▼         ▼
      ┌──────────────┐  ┌──────────────┐
      │ API retorna: │  │ Toast erro   │
      │ - id         │  │ creating=    │
      │ - code (6d)  │  │ false        │
      │ - dados      │  └──────────────┘
      └──────────────┘
                 │
                 ▼
      ┌──────────────────────────────┐
      │ setCreatedConsultant(data)   │
      │ setShowSuccess(true)         │
      └──────────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────────┐
      │ TELA DE SUCESSO              │
      │ ┌─────────────────────────┐  │
      │ │ ✓ Consultor Criado!     │  │
      │ │ Email enviado           │  │
      │ └─────────────────────────┘  │
      │ ┌─────────────────────────┐  │
      │ │ Código: XXXXXX          │  │
      │ │ Nome: ...               │  │
      │ │ Email: ...              │  │
      │ │ Status: Ativo           │  │
      │ └─────────────────────────┘  │
      │ [Cadastrar Outro] [Ver Lista]│
      └──────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
   [Cadastrar]    [Ver Lista]
         │               │
         ▼               ▼
  ┌──────────┐   ┌──────────┐
  │ Limpa    │   │ router   │
  │ form +   │   │ .push    │
  │ success  │   │ /list    │
  └──────────┘   └──────────┘
```

---

## 6. Regras de Negócio

### RN-001: Código Gerado Automaticamente

**Descrição:** O código do consultor (6 dígitos) é gerado automaticamente pela API e não pode ser definido pelo admin.
**Aplicação:** API gera código único usando algoritmo de geração aleatória com verificação de duplicatas
**Exceções:** Nenhuma
**Justificativa:** Garante unicidade e evita conflitos

### RN-002: Nome em MAIÚSCULAS

**Descrição:** O nome do consultor é sempre armazenado em MAIÚSCULAS.
**Aplicação:** Conversão automática no `handleChange` via `value.toUpperCase()`
**Exceções:** Nenhuma
**Justificativa:** Padronização visual e consistência com outros cadastros

### RN-003: Email em Lowercase

**Descrição:** O email é sempre armazenado em lowercase para evitar duplicatas por case sensitivity.
**Aplicação:** Conversão no envio via `formData.email.toLowerCase()`
**Exceções:** Nenhuma
**Justificativa:** Emails são case-insensitive, lowercase evita duplicatas

### RN-004: Senha Temporária Enviada por Email

**Descrição:** Ao criar consultor, uma senha temporária é gerada e enviada por email via fila.
**Aplicação:** API gera senha, cria usuário no Firebase Auth e adiciona email à `email_queue`
**Exceções:** Falha no envio de email não impede criação do consultor
**Justificativa:** Desacopla criação de consultor do envio de email

### RN-005: Status Inicial Sempre "Active"

**Descrição:** Novos consultores são criados com status "active" por padrão.
**Aplicação:** API define `status: "active"` ao criar documento
**Exceções:** Nenhuma
**Justificativa:** Consultores devem estar ativos imediatamente após criação

### RN-006: Validação de Telefone Mínima

**Descrição:** Telefone deve ter no mínimo 10 dígitos (DDD + número).
**Aplicação:** Validação frontend: `phone.replace(/\D/g, "").length >= 10`
**Exceções:** Nenhuma
**Justificativa:** Garante formato mínimo válido para telefone brasileiro

---

## 7. Estados da Interface

### 7.1 Estado: Formulário Inicial

**Quando:** `showSuccess === false`, `creating === false`
**Exibição:**

```
[← Voltar]

Novo Consultor
Cadastre um novo consultor Rennova

┌─ Card: Dados do Consultor ────────────────────────┐
│ Nome Completo *                                    │
│ [Input MAIÚSCULAS]                                 │
│ {erro inline se houver}                            │
│                                                    │
│ Email *                                            │
│ [Input]                                            │
│ {erro inline se houver}                            │
│                                                    │
│ Telefone *                                         │
│ [Input formatado (00) 00000-0000]                  │
│ {erro inline se houver}                            │
│                                                    │
│                        [👥 Criar Consultor]        │
└────────────────────────────────────────────────────┘

┌─ Alert: Informações (blue) ───────────────────────┐
│ ℹ️ Após o cadastro:                                │
│ • Um código único de 6 dígitos será gerado        │
│ • Uma senha temporária será enviada por email     │
│ • O consultor poderá fazer login e vincular-se... │
└────────────────────────────────────────────────────┘
```

### 7.2 Estado: Criando

**Quando:** `creating === true`
**Exibição:** Botão "Criar Consultor" muda para "Criando..." com Loader2 spinner, fica `disabled`
**Campos:** Inputs ficam `disabled`

### 7.3 Estado: Tela de Sucesso

**Quando:** `showSuccess === true`, `createdConsultant !== null`
**Exibição:**

```
[← Voltar]

┌─ Sucesso (center, flex-col) ──────────────────────┐
│ ⭕ CheckCircle2 (green, h-16 w-16)                │
│                                                    │
│ Consultor Criado com Sucesso!                     │
│ (text-2xl, font-bold)                             │
│                                                    │
│ Um email foi enviado com as credenciais de acesso.│
│ (text-muted-foreground)                           │
└────────────────────────────────────────────────────┘

┌─ Card: Código do Consultor (sky-50, border-sky)──┐
│ [Código 6 dígitos]                                │
│ (text-4xl, font-mono, sky-700, tracking-widest)  │
└────────────────────────────────────────────────────┘

┌─ Card: Dados do Consultor ────────────────────────┐
│ Nome: {name}                                       │
│ Email: {email}                                     │
│ Status: [Badge Ativo]                              │
└────────────────────────────────────────────────────┘

┌─ Alert: Aviso (blue) ─────────────────────────────┐
│ ℹ️ O consultor receberá um email com uma senha    │
│ temporária. Ele deverá alterá-la no primeiro...   │
└────────────────────────────────────────────────────┘

[Cadastrar Outro Consultor] [Ver Lista de Consultores]
```

### 7.4 Erros Inline

**Quando:** Campo inválido após tentativa de submit
**Exibição:** Texto vermelho (`text-destructive text-sm`) abaixo do input correspondente

---

## 8. Validações

### 8.1 Validações Frontend

| Campo    | Validação                                   | Mensagem                                |
| -------- | ------------------------------------------- | --------------------------------------- |
| Nome     | `!formData.name.trim()`                     | "Nome é obrigatório"                    |
| Email    | `!formData.email.trim()`                    | "Email é obrigatório"                   |
| Email    | `!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)` | "Email inválido"                        |
| Telefone | `!formData.phone.trim()`                    | "Telefone é obrigatório"                |
| Telefone | `phone.replace(/\D/g, "").length < 10`      | "Telefone inválido (mínimo 10 dígitos)" |

**Implementação:** Validações executadas no `handleSubmit` antes de chamar API

### 8.2 Validações Backend (API Route)

- **Autenticação:** Verifica Bearer token válido
- **Autorização:** Verifica `is_system_admin === true`
- **Campos obrigatórios:** Valida presença de name, email, phone
- **Email único:** Verifica se email já existe no Firebase Auth
- **Código único:** Gera código e verifica duplicatas no Firestore

### 8.3 Validações de Permissão

- Layout admin verifica role `system_admin` antes de renderizar
- API route verifica token e claims antes de processar

---

## 9. Integrações

### 9.1 API Route — POST /api/consultants

- **Tipo:** Next.js API Route (server-side)
- **Método:** `POST`
- **Headers:** `Authorization: Bearer {idToken}`, `Content-Type: application/json`
- **Body:** `{ name: string, email: string, phone: string }`
- **Retorno Sucesso:** `{ success: true, message: string, data: Consultant }`
- **Retorno Erro:** `{ error: string }` com status 400/401/409/500

### 9.2 Firebase Auth (Admin — Server)

- **`adminAuth.createUser()`:** Cria usuário com email e senha temporária
- **`adminAuth.setCustomUserClaims()`:** Define role `clinic_consultant`

### 9.3 Firestore (Admin — Server)

- **`adminDb.collection("consultants").add()`:** Cria documento do consultor
- **`adminDb.collection("email_queue").add()`:** Adiciona email de boas-vindas

### 9.4 Firebase Auth (Client)

- **`auth.currentUser.getIdToken()`:** Gera Bearer token para API route

### 9.5 Next.js Router

- **`router.push("/admin/consultants")`:** Navegação para lista

---

## 10. Segurança

### 10.1 Proteções Implementadas

- ✅ Autenticação via Bearer token
- ✅ Verificação de role `system_admin` no backend
- ✅ Email convertido para lowercase (previne duplicatas)
- ✅ Validação de email único no Firebase Auth
- ✅ Senha temporária gerada server-side (não exposta ao cliente)
- ✅ Código gerado server-side (não manipulável)

### 10.2 Vulnerabilidades Conhecidas

- ⚠️ Telefone sem validação de formato específico (apenas comprimento)
- ⚠️ Senha temporária enviada por email (não é o método mais seguro)
- ⚠️ Sem rate limiting na criação de consultores
- **Mitigação:** API routes validam todos os dados antes de criar

### 10.3 Dados Sensíveis

- **Senha temporária:** Gerada server-side, enviada por email, não exposta ao admin
- **Email:** Exibido em texto plano na tela de sucesso
- **Código:** Exibido em texto plano (mas é público por natureza)

---

## 11. Performance

### 11.1 Métricas

- **Criação:** 1 requisição HTTP (POST consultor)
- **Operações server-side:** Criar Auth user + Firestore doc + Email queue (~2-3s)

### 11.2 Otimizações Implementadas

- ✅ Validações frontend antes de chamar API
- ✅ Conversões de texto (uppercase, lowercase) feitas client-side

### 11.3 Gargalos Identificados

- ⚠️ Criação de usuário no Firebase Auth pode ser lenta
- ⚠️ Sem feedback de progresso durante operações server-side

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG

- **Nível:** Parcial (não auditado formalmente)

### 12.2 Recursos Implementados

- ✅ Labels em todos os inputs (`<Label htmlFor>`)
- ✅ Campos obrigatórios marcados com asterisco
- ✅ Erros inline associados aos campos
- ✅ Alert com ícone e texto descritivo

### 12.3 Melhorias Necessárias

- [ ] `aria-invalid` nos campos com erro
- [ ] `aria-describedby` ligando erros aos campos
- [ ] Anúncio de sucesso via `aria-live`
- [ ] Foco automático no primeiro campo com erro

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| #     | Cenário                                 | Tipo     | Status   |
| ----- | --------------------------------------- | -------- | -------- |
| T-001 | Criar consultor com dados válidos       | E2E      | Pendente |
| T-002 | Validação de nome vazio                 | E2E      | Pendente |
| T-003 | Validação de email inválido             | E2E      | Pendente |
| T-004 | Validação de telefone < 10 dígitos      | E2E      | Pendente |
| T-005 | Email duplicado (409)                   | E2E      | Pendente |
| T-006 | Conversão de nome para uppercase        | Unitário | Pendente |
| T-007 | Conversão de email para lowercase       | Unitário | Pendente |
| T-008 | Tela de sucesso exibida corretamente    | E2E      | Pendente |
| T-009 | Cadastrar outro consultor (limpar form) | E2E      | Pendente |
| T-010 | Navegar para lista após sucesso         | E2E      | Pendente |

### 13.2 Cenários de Erro

- API indisponível durante criação
- Token expirado durante submit
- Falha ao criar usuário no Firebase Auth
- Falha ao enviar email (não deve bloquear criação)

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades

- [ ] Preview de email de boas-vindas
- [ ] Opção de definir senha manualmente
- [ ] Upload de foto de perfil
- [ ] Vincular clínicas durante criação

### 14.2 UX/UI

- [ ] Validação em tempo real (não apenas no submit)
- [ ] Máscara de telefone em tempo real
- [ ] Barra de progresso durante criação
- [ ] Confirmação antes de sair com dados preenchidos

### 14.3 Performance

- [ ] Feedback de progresso das operações server-side
- [ ] Otimização de criação paralela (Auth + Firestore)

### 14.4 Segurança

- [ ] Validação de formato de telefone específico
- [ ] Rate limiting na API route
- [ ] Logs de auditoria de criação
- [ ] Link de ativação em vez de senha por email

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas

| Página                    | Relação                                       |
| ------------------------- | --------------------------------------------- |
| `/admin/consultants`      | Lista de consultores (navegação após sucesso) |
| `/admin/consultants/{id}` | Detalhes do consultor criado                  |

### 15.2 Fluxos Relacionados

- **Lista → Novo → Sucesso → Lista:** Fluxo principal de cadastro
- **Novo → Sucesso → Novo:** Fluxo de cadastro múltiplo

### 15.3 Impacto de Mudanças

- Alterar interface `Consultant` impacta tela de sucesso
- Alterar lógica de geração de código afeta API route
- Alterar template de email afeta `email_queue`

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura

- **Tela de sucesso dedicada:** Substitui formulário em vez de usar dialog
- **Validações inline:** Erros exibidos abaixo dos campos (não em toast)
- **API Route para criação:** Operações complexas (Auth + Firestore + Email) feitas server-side

### 16.2 Padrões Utilizados

- **Client Component:** `"use client"` para interatividade
- **Controlled form:** Estado via `formData` com spread updates
- **Bearer token:** Autenticação via header Authorization
- **Toast feedback:** Apenas para erros de API

### 16.3 Limitações Conhecidas

- Sem validação em tempo real (apenas no submit)
- Sem máscara de telefone em tempo real
- Sem confirmação ao sair com dados preenchidos

### 16.4 Notas de Implementação

- Nome convertido para uppercase no `onChange` (linha ~XX)
- Email convertido para lowercase no envio (linha ~XX)
- Código exibido com estilo sky-700, font-mono, tracking-widest
- Alert informativo usa variant "default" com ícone AlertCircle

---

## 17. Histórico de Mudanças

| Data       | Versão | Autor              | Descrição                                               |
| ---------- | ------ | ------------------ | ------------------------------------------------------- |
| 07/02/2026 | 1.0    | Engenharia Reversa | Documentação inicial                                    |
| 10/02/2026 | 1.1    | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

| Termo                   | Definição                                               |
| ----------------------- | ------------------------------------------------------- |
| **Consultor Rennova**   | Usuário especial que pode acessar múltiplas clínicas    |
| **Código do Consultor** | Identificador único de 6 dígitos gerado automaticamente |
| **Senha Temporária**    | Senha gerada automaticamente e enviada por email        |
| **Bearer Token**        | Token JWT usado para autenticação em API routes         |
| **Email Queue**         | Fila de emails pendentes de envio no Firestore          |

---

## 19. Referências

### 19.1 Documentação Relacionada

- [Consultants List](./consultants-list-documentation.md) — Lista de consultores
- [Consultants Detail](./consultants-detail-documentation.md) — Detalhes do consultor

### 19.2 Código Fonte

- `src/app/(admin)/admin/consultants/new/page.tsx` — Componente principal
- `src/app/api/consultants/route.ts` — API route POST
- `src/types/index.ts` — Interface Consultant

---

## 20. Anexos

### 20.1 Exemplo de Payload de Criação

```json
{
  "name": "JOÃO SILVA CONSULTOR",
  "email": "joao@rennova.com.br",
  "phone": "11987654321"
}
```

### 20.2 Exemplo de Resposta da API

```json
{
  "success": true,
  "message": "Consultor criado com sucesso",
  "data": {
    "id": "abc123",
    "code": "123456",
    "name": "JOÃO SILVA CONSULTOR",
    "email": "joao@rennova.com.br",
    "phone": "11987654321",
    "status": "active",
    "authorized_tenants": [],
    "created_at": "2026-02-10T14:30:00Z",
    "updated_at": "2026-02-10T14:30:00Z"
  }
}
```

### 20.3 Exemplo de Email na Fila

```json
{
  "to": "joao@rennova.com.br",
  "subject": "Bem-vindo ao Curva Mestra - Consultor Rennova",
  "body": "<html>...</html>",
  "status": "pending",
  "type": "consultant_welcome",
  "metadata": {
    "consultant_id": "abc123",
    "code": "123456"
  },
  "created_at": "2026-02-10T14:30:00Z"
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 10/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
