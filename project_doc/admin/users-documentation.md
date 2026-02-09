# Documentação Experimental - Usuários do Sistema

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Gerenciamento de Usuários (`/admin/users`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de gerenciamento global de todos os usuários do sistema. O System Admin visualiza usuários de todas as clínicas em uma tabela unificada, com busca por nome/email/clínica, edição de dados, alteração de role/status e envio de reset de senha por email via token seguro. Consultores possuem campos de edição diferenciados (email, telefone) enquanto usuários regulares permitem alteração de role e status.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/users/page.tsx` (665 linhas)
- **Rota:** `/admin/users`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)

### 1.2 Dependências Principais
- **Firestore:** Coleções `users` (leitura/escrita), `tenants` (leitura), `consultants` (escrita)
- **Firebase Auth:** `auth.currentUser` para obter `idToken` (Bearer token)
- **Firebase Admin:** `adminAuth`, `adminDb` (via API route server-side)
- **API Route:** `POST /api/users/[id]/reset-password`
- **Serviço:** `src/lib/services/passwordResetService.ts`
- **Utils:** `formatTimestamp` de `src/lib/utils`
- **UI:** Card, Table, Badge, Dialog, Input, Label, Select, Button (shadcn/ui)
- **Ícones:** Search, UserCog, Shield, User, Building2, Edit, KeyRound, CheckCircle2, Mail, UserCheck (lucide-react)

---

## 2. Tipos de Usuários / Atores

| Ator | Permissão | Descrição |
|------|-----------|-----------|
| `system_admin` | Acesso total | Único role que acessa esta página. Pode visualizar, editar e resetar senhas de todos os usuários (exceto outros system_admin) |
| `clinic_admin` | Sem acesso | Não tem acesso a esta página (protegido pelo layout admin) |
| `clinic_user` | Sem acesso | Não tem acesso a esta página |
| `clinic_consultant` | Sem acesso | Não tem acesso a esta página |

---

## 3. Estrutura de Dados

### 3.1 Interface Local — UserWithTenant
```typescript
// Definida localmente em page.tsx (não exportada)
interface UserWithTenant {
  uid: string;                    // ID do documento em users/
  email: string;                  // userData.email || ""
  displayName: string;            // userData.displayName || userData.full_name || ""
  phone?: string;                 // userData.phone || ""
  role: "clinic_admin" | "clinic_user" | "system_admin" | "clinic_consultant";
  active: boolean;                // userData.active ?? true (default true)
  tenantId: string;               // userData.tenant_id || ""
  tenantName: string;             // Buscado de tenants/{tenant_id}.name ou "Consultor" para consultores
  created_at: any;                // Firestore Timestamp
}
```

### 3.2 Documento Firestore — users/{uid}
```typescript
// Campos lidos
{
  email: string;
  displayName?: string;
  full_name?: string;
  phone?: string;
  role: string;
  active?: boolean;               // Default true se undefined
  tenant_id?: string;
  created_at: Timestamp;
}

// Campos escritos na edição
{
  displayName: string;
  full_name: string;              // Sempre sincronizado com displayName
  active: boolean;
  updated_at: Date;               // new Date() (client-side)
  role?: string;                  // Apenas para não-consultores
  phone?: string;                 // Apenas para consultores
  email?: string;                 // Apenas para consultores (lowercase)
}

// Campos escritos no reset de senha (server-side)
{
  passwordResetRequestedAt: FieldValue.serverTimestamp();
  passwordResetRequestedBy: string;  // UID do admin que solicitou
  updated_at: FieldValue.serverTimestamp();
}
```

### 3.3 Documento Firestore — consultants/{id}
```typescript
// Campos atualizados quando o usuário editado é consultor
{
  name: string;                   // Sincronizado com displayName
  email: string;                  // Lowercase
  phone: string;
  updated_at: Date;               // new Date() (client-side)
}
```

### 3.4 Interface — PasswordResetTokenData (server-side)
```typescript
// password_reset_tokens/{auto-id}
interface PasswordResetTokenData {
  token_hash: string;             // SHA-256 hash do token (32 bytes / 64 hex)
  user_id: string;
  user_email: string;
  tenant_id?: string;
  expires_at: Timestamp;          // +30 minutos
  created_at: Timestamp;          // serverTimestamp
  created_by: string;             // UID do admin solicitante
  used_at?: Timestamp;            // Preenchido quando consumido
  invalidated_at?: Timestamp;     // Preenchido quando novo token é criado
}
```

### 3.5 Documento Firestore — email_queue/{auto-id}
```typescript
// Criado pela API route de reset de senha
{
  to: string;                     // Email do usuário
  subject: "Redefinição de Senha - Curva Mestra";
  body: string;                   // HTML do email
  status: "pending";
  type: "password_reset";
  metadata: {
    user_id: string;
    tenant_id?: string;
    expires_at: string;           // ISO string
  };
  created_at: FieldValue.serverTimestamp();
}
```

---

## 4. Casos de Uso

### UC-001: Listar Todos os Usuários
- **Ator:** system_admin
- **Pré-condições:** Usuário autenticado com role system_admin
- **Fluxo Principal:**
  1. Página carrega e chama `loadAllUsers()`
  2. Busca todos os documentos de `users` (ordenados por `created_at desc`)
  3. Para cada usuário, faz query individual: `getDoc(doc(db, "tenants", tenantId))`
  4. Se `role === "clinic_consultant"`, define tenantName como "Consultor" (sem buscar tenant)
  5. Se tenant não encontrado, define tenantName como "Sem clínica"
  6. Monta array `UserWithTenant[]` e renderiza tabela + 4 cards de estatísticas
- **Fluxo Alternativo:**
  - Erro na busca do tenant: `console.error`, tenantName permanece "Sem clínica"
  - Erro geral: `console.error("Erro ao carregar usuários:")`, tabela vazia
- **Pós-condições:** Tabela renderizada com todos os usuários e estatísticas calculadas
- **Regra de Negócio:** RN-003

### UC-002: Buscar Usuários
- **Ator:** system_admin
- **Pré-condições:** Lista de usuários carregada
- **Fluxo Principal:**
  1. Admin digita no campo de busca
  2. Filtragem em tempo real no estado local (client-side)
  3. Busca por `displayName`, `email` ou `tenantName` (case insensitive via `.toLowerCase()`)
  4. Resultados atualizados instantaneamente no `filteredUsers`
- **Fluxo Alternativo:**
  - Busca vazia: exibe todos os usuários
  - Sem resultados: "Nenhum usuário encontrado"
- **Pós-condições:** Tabela filtrada exibida
- **Regra de Negócio:** RN-004

### UC-003: Editar Usuário Regular (clinic_admin / clinic_user)
- **Ator:** system_admin
- **Pré-condições:** Usuário selecionado NÃO é system_admin nem clinic_consultant
- **Fluxo Principal:**
  1. Admin clica "Editar" na linha do usuário
  2. Dialog abre com campos: Nome Completo, Função (Select: Admin/Usuário), Status (Select: Ativo/Inativo)
  3. Info text exibe email e clínica do usuário (não editáveis)
  4. Admin modifica campos desejados e clica "Salvar"
  5. `updateDoc` em `users/{uid}` com: displayName, full_name, active, role, updated_at
  6. `alert("Usuário atualizado com sucesso!")`
  7. `loadAllUsers()` recarrega a lista
- **Fluxo Alternativo:**
  - Erro na atualização: `alert("Erro ao atualizar usuário: {message}")`
  - Admin cancela: dialog fecha sem alterações
- **Pós-condições:** Dados do usuário atualizados no Firestore
- **Regra de Negócio:** RN-001, RN-005

### UC-004: Editar Consultor (clinic_consultant)
- **Ator:** system_admin
- **Pré-condições:** Usuário selecionado tem role `clinic_consultant`
- **Fluxo Principal:**
  1. Admin clica "Editar" na linha do consultor
  2. Dialog abre com campos diferenciados: Nome Completo, Email, Telefone + info box azul "Consultor Rennova"
  3. Campo de Role NÃO aparece (consultores não podem ter role alterado)
  4. Status (Ativo/Inativo) disponível
  5. Admin modifica campos e clica "Salvar"
  6. `updateDoc` em `users/{uid}` com: displayName, full_name, active, phone, email (lowercase), updated_at
  7. Busca na coleção `consultants` por documento com `user_id === uid`
  8. Se encontrado, `updateDoc` em `consultants/{id}` com: name, email, phone, updated_at
  9. `alert("Usuário atualizado com sucesso!")`
  10. `loadAllUsers()` recarrega a lista
- **Fluxo Alternativo:**
  - Erro ao atualizar consultor: `console.error`, mas não bloqueia (silencioso)
  - Consultor não encontrado na collection `consultants`: loop termina sem update
- **Pós-condições:** Dados do consultor atualizados em `users` e `consultants`
- **Regra de Negócio:** RN-002

### UC-005: Resetar Senha de Usuário
- **Ator:** system_admin
- **Pré-condições:** Dialog de edição aberto para um usuário não-system_admin
- **Fluxo Principal:**
  1. Admin clica "Enviar Link de Reset" na seção de redefinir senha
  2. `confirm()` nativo: "Tem certeza que deseja redefinir a senha de {email}?"
  3. Se confirmado, obtém `idToken` do usuário autenticado
  4. `POST /api/users/{uid}/reset-password` com Bearer token
  5. **Server-side (API Route):**
     a. Verifica Bearer token e decodifica com `adminAuth.verifyIdToken`
     b. Verifica `is_system_admin === true`
     c. Verifica usuário existe em `users/{uid}` no Firestore
     d. Verifica `role !== "system_admin"` (bloqueio duplo)
     e. Verifica usuário existe no Firebase Auth (`adminAuth.getUser`)
     f. Verifica email cadastrado
     g. Invalida tokens anteriores do usuário (batch update `invalidated_at`)
     h. Gera token seguro: `crypto.randomBytes(32).toString("hex")` (64 chars)
     i. Armazena hash SHA-256 em `password_reset_tokens/{auto-id}`
     j. Gera link: `{baseUrl}/reset-password/{token}` (expira em 30min)
     k. Cria email HTML com template e adiciona a `email_queue`
     l. Registra auditoria em `users/{uid}`: `passwordResetRequestedAt`, `passwordResetRequestedBy`
  6. **Client-side:** Exibe card verde "Email enviado com sucesso!" com endereço e info de expiração
- **Fluxo Alternativo:**
  - Usuário não autenticado: `alert("Você precisa estar autenticado")`
  - API retorna erro: `alert("Erro ao solicitar reset de senha: {message}")`
  - Confirm cancelado: nenhuma ação
- **Pós-condições:** Token criado, email na fila, auditoria registrada
- **Regra de Negócio:** RN-001, RN-006, RN-007

### UC-006: Navegar para Clínica ou Consultores
- **Ator:** system_admin
- **Pré-condições:** Lista de usuários exibida
- **Fluxo Principal:**
  1. Para usuários com role `clinic_consultant`: botão "Ver Consultores" → navega para `/admin/consultants`
  2. Para outros usuários com `tenantId`: botão "Ver Clínica" → navega para `/admin/tenants/{tenantId}`
  3. Para outros usuários sem `tenantId`: nenhum botão de navegação exibido
- **Pós-condições:** Navegação para a página correspondente
- **Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

### 5.1 Carregamento da Página
```
[Página Carrega]
       │
       ▼
[loadAllUsers()]
       │
       ▼
[getDocs(users, orderBy created_at desc)]
       │
       ▼
[Para cada userDoc] ──────────────────────────────┐
       │                                           │
       ▼                                           │
[role === "clinic_consultant"?]                    │
  │ Sim                    │ Não                   │
  ▼                        ▼                       │
[tenantName =         [tenantId existe?]           │
 "Consultor"]           │ Sim        │ Não         │
                        ▼            ▼             │
                   [getDoc(tenant)] [tenantName =  │
                        │          "Sem clínica"]  │
                        ▼                          │
                   [Existe?]                       │
                   │ Sim    │ Não                   │
                   ▼        ▼                      │
              [name]  ["Sem nome"]                  │
                   │                               │
                   ▼                               │
            [push UserWithTenant] ─────────────────┘
                   │
                   ▼
            [setUsers + setFilteredUsers]
                   │
                   ▼
            [Renderiza tabela + stats]
```

### 5.2 Fluxo de Reset de Senha (Completo)
```
[Admin clica "Enviar Link de Reset"]
       │
       ▼
[confirm() nativo] ── Cancelar ── [Nada]
       │ OK
       ▼
[auth.currentUser.getIdToken()]
       │
       ▼
[POST /api/users/{uid}/reset-password]
[Header: Bearer {token}]
       │
       ▼ (Server-side)
[verifyIdToken(token)]
       │
       ▼
[is_system_admin === true?]
  │ Não → 403
  │ Sim
  ▼
[users/{uid} existe?]
  │ Não → 404
  │ Sim
  ▼
[role !== "system_admin"?]
  │ system_admin → 403
  │ Outro role
  ▼
[adminAuth.getUser(uid)]
  │ Não encontrado → 404
  │ Encontrado
  ▼
[email existe?]
  │ Não → 400
  │ Sim
  ▼
[invalidateUserTokens(uid)]
  │ (batch update tokens antigos)
  ▼
[generateResetToken()]
  │ (crypto.randomBytes(32).toString("hex"))
  ▼
[hashToken → SHA-256]
  │
  ▼
[Salvar em password_reset_tokens/]
  │
  ▼
[generateResetLink(token)]
  │ → {baseUrl}/reset-password/{token}
  ▼
[Criar email HTML]
  │
  ▼
[Adicionar a email_queue/]
  │
  ▼
[Registrar auditoria em users/{uid}]
  │
  ▼
[Retornar { success, email }]
       │
       ▼ (Client-side)
[Exibir card verde de sucesso]
```

### 5.3 Fluxo de Edição de Consultor
```
[Admin clica "Editar" em consultor]
       │
       ▼
[Dialog abre com campos: Nome, Email, Telefone]
       │
       ▼
[Admin edita e clica "Salvar"]
       │
       ▼
[updateDoc(users/{uid})]
  │ {displayName, full_name, active, phone, email, updated_at}
  ▼
[getDocs(consultants)] ← Busca TODOS os consultores
       │
       ▼
[Loop: consultantData.user_id === uid?]
  │ Sim
  ▼
[updateDoc(consultants/{id})]
  │ {name, email, phone, updated_at}
  ▼
[alert("Usuário atualizado com sucesso!")]
  │
  ▼
[loadAllUsers()] ← Recarrega toda a lista
```

---

## 6. Regras de Negócio

### RN-001: System Admin Não Editável
- **Descrição:** Usuários com role `system_admin` não podem ser editados pela interface.
- **Aplicação:** Botão "Editar" não renderizado para `system_admin`. API route também bloqueia reset de senha para `system_admin` (verificação dupla client + server).
- **Exceções:** Nenhuma. Mesmo via API direta, o server verifica `userData.role !== "system_admin"`.
- **Justificativa:** Proteção de contas privilegiadas contra alterações acidentais ou maliciosas.

### RN-002: Consultores com Campos Diferenciados
- **Descrição:** Consultores (`clinic_consultant`) possuem formulário de edição diferente dos demais usuários.
- **Aplicação:** Dialog exibe Email e Telefone (editáveis) + info box "Consultor Rennova". Role NÃO pode ser alterado. Ao salvar, atualiza também a coleção `consultants`.
- **Exceções:** Se consultor não for encontrado na coleção `consultants`, erro é silencioso (`console.error`).
- **Justificativa:** Consultores acessam múltiplas clínicas e têm dados de contato que precisam estar sincronizados entre `users` e `consultants`.

### RN-003: Busca de Tenant por Usuário (N+1)
- **Descrição:** Para cada usuário carregado, o sistema faz uma query individual ao Firestore para buscar o nome do tenant.
- **Aplicação:** Loop `for...of` sobre todos os documentos de `users`, chamando `getDoc(doc(db, "tenants", tenantId))` individualmente.
- **Exceções:** Consultores (`role === "clinic_consultant"`) recebem tenantName "Consultor" sem query ao tenant. Usuários sem `tenant_id` recebem "Sem clínica".
- **Justificativa:** Implementação simplificada. Requer otimização futura via denormalização ou batch.

### RN-004: Busca Client-Side
- **Descrição:** A filtragem de usuários é feita inteiramente no client, sobre os dados já carregados em memória.
- **Aplicação:** Busca por `displayName`, `email` ou `tenantName` com `.toLowerCase().includes(term)`.
- **Exceções:** Nenhuma paginação ou filtragem server-side.
- **Justificativa:** Adequado para MVP com poucos usuários. Requer paginação server-side quando escalar.

### RN-005: Sincronização displayName e full_name
- **Descrição:** Ao editar o nome de um usuário, ambos os campos `displayName` e `full_name` são atualizados com o mesmo valor.
- **Aplicação:** `updateData.displayName = editDisplayName; updateData.full_name = editDisplayName;`
- **Exceções:** Nenhuma.
- **Justificativa:** Dois campos existem por compatibilidade (Firebase Auth usa `displayName`, sistema usa `full_name`). Devem sempre estar sincronizados.

### RN-006: Token de Reset de Uso Único
- **Descrição:** Tokens de reset de senha são de uso único, expiram em 30 minutos e invalidam tokens anteriores.
- **Aplicação:** Ao criar novo token, todos os tokens anteriores do usuário são invalidados via batch update (`invalidated_at`). Token armazenado como hash SHA-256 (nunca em texto plano).
- **Exceções:** Se invalidação falhar, erro é silencioso (operação de limpeza).
- **Justificativa:** Segurança: impede reutilização e limita janela de exposição.

### RN-007: Email de Reset via Fila
- **Descrição:** O email de reset não é enviado diretamente pela API route. É adicionado à coleção `email_queue` como documento pendente.
- **Aplicação:** Documento criado com `status: "pending"`, `type: "password_reset"` e metadata com `user_id`, `tenant_id`, `expires_at`.
- **Exceções:** Nenhuma. O processamento do email depende de um serviço externo (Firebase Extension ou Cloud Function) que consome a fila.
- **Justificativa:** Desacopla envio de email da API route, permitindo retry e monitoramento.

### RN-008: Busca de Consultor por Iteração
- **Descrição:** Para atualizar um consultor na coleção `consultants`, o sistema busca TODOS os documentos da coleção e itera para encontrar o que tem `user_id === uid`.
- **Aplicação:** `getDocs(query(collection(db, "consultants")))` → loop → `if (consultantData.user_id === editingUser.uid)`.
- **Exceções:** Se nenhum documento encontrado, loop termina sem ação.
- **Justificativa:** Implementação simplificada sem índice por `user_id`. Requer otimização com `where` query.

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
- **Quando:** `loading === true` (durante `loadAllUsers`)
- **Exibição:** "Carregando usuários..." centralizado na área da tabela
- **Stats:** Cards exibem 0 (array vazio)

### 7.2 Estado: Lista Vazia (Sem Busca)
- **Quando:** `loading === false`, `filteredUsers.length === 0`, `searchTerm === ""`
- **Exibição:** "Nenhum usuário cadastrado" centralizado

### 7.3 Estado: Lista Vazia (Com Busca)
- **Quando:** `loading === false`, `filteredUsers.length === 0`, `searchTerm !== ""`
- **Exibição:** "Nenhum usuário encontrado" centralizado

### 7.4 Estado: Lista Populada
- **Quando:** `filteredUsers.length > 0`
- **Exibição:** Tabela com colunas: Usuário (ícone + nome), Email, Clínica (Building2 + nome), Role (Badge), Status (Badge), Cadastro (data formatada), Ações (botões)
- **Stats Cards:**
  - Total de Usuários: `users.length`
  - Usuários Ativos: `users.filter(u => u.active).length`
  - Administradores: `users.filter(u => u.role === "clinic_admin" || u.role === "system_admin").length`
  - Clínicas: `new Set(users.map(u => u.tenantId)).size`

### 7.5 Estado: Dialog de Edição (Usuário Regular)
- **Quando:** `editDialogOpen === true`, `editingUser.role !== "clinic_consultant"`
- **Campos:** Nome Completo (Input), Função (Select: Admin/Usuário), Status (Select: Ativo/Inativo)
- **Info:** Email e Clínica do usuário (texto, não editável)
- **Seção Reset:** Botão "Enviar Link de Reset" ou card verde de sucesso
- **Botões:** Cancelar, Salvar (disabled durante updating)

### 7.6 Estado: Dialog de Edição (Consultor)
- **Quando:** `editDialogOpen === true`, `editingUser.role === "clinic_consultant"`
- **Campos:** Nome Completo (Input), Email (Input), Telefone (Input), Status (Select)
- **Info Box:** Fundo azul claro com ícone UserCheck e texto "Consultor Rennova - Este usuário é um consultor e pode acessar múltiplas clínicas."
- **Seção Reset:** Mesma do estado anterior
- **Botões:** Cancelar, Salvar

### 7.7 Estado: Reset de Senha Enviado
- **Quando:** `resetEmailSent === true`
- **Exibição:** Card verde com CheckCircle2, "Email enviado com sucesso!", endereço do email, info "O link expira em 30 minutos"
- **Substitui:** Botão "Enviar Link de Reset"

### 7.8 Badges de Role
| Role | Variante | Cor | Texto |
|------|----------|-----|-------|
| `system_admin` | `destructive` | Vermelha | System Admin |
| `clinic_consultant` | custom | `bg-sky-600` | Consultor |
| `clinic_admin` | `default` | Padrão (primária) | Admin |
| `clinic_user` | `outline` | Contorno | Usuário |

### 7.9 Ícones de Role na Tabela
| Role | Ícone | Cor |
|------|-------|-----|
| `system_admin`, `clinic_admin` | Shield | `text-primary` |
| `clinic_consultant` | UserCheck | `text-sky-600` |
| `clinic_user` | User | `text-muted-foreground` |

### 7.10 Botões de Ação por Tipo de Usuário
| Role | Editar | Navegação |
|------|--------|-----------|
| `system_admin` | Não exibido | "Ver Clínica" (se tenantId) |
| `clinic_consultant` | Exibido | "Ver Consultores" → `/admin/consultants` |
| `clinic_admin` / `clinic_user` | Exibido | "Ver Clínica" → `/admin/tenants/{tenantId}` |

---

## 8. Validações

### 8.1 Validações Frontend
| Campo | Validação | Mensagem |
|-------|-----------|----------|
| Nome Completo | Nenhuma validação explícita | — |
| Email (consultor) | Nenhuma validação explícita | — |
| Telefone (consultor) | Nenhuma validação explícita | — |
| Role | Select com opções fixas | — |
| Status | Select com opções fixas | — |

### 8.2 Validações Backend (API Route — Reset de Senha)
| Validação | Código HTTP | Mensagem |
|-----------|-------------|----------|
| Sem Bearer token | 401 | "Não autorizado" |
| Não é system_admin | 403 | "Apenas administradores do sistema podem redefinir senhas" |
| Usuário não existe (Firestore) | 404 | "Usuário não encontrado" |
| Usuário é system_admin | 403 | "Não é permitido redefinir senha de administradores do sistema" |
| Usuário não existe (Firebase Auth) | 404 | "Usuário não encontrado no sistema de autenticação" |
| Usuário sem email | 400 | "Usuário não possui email cadastrado" |
| Erro interno | 500 | "Erro ao solicitar redefinição de senha. Tente novamente." |

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin` antes de renderizar
- API route verifica `is_system_admin === true` no token decodificado
- Botão "Editar" não renderizado para `system_admin` (client-side)
- API route bloqueia reset de senha para `system_admin` (server-side)

---

## 9. Integrações

### 9.1 Firebase Auth (Client)
- **`auth.currentUser`:** Obtém usuário autenticado para extrair `idToken`
- **`currentUser.getIdToken()`:** Gera Bearer token para API route

### 9.2 Firebase Auth (Admin — Server)
- **`adminAuth.verifyIdToken(token)`:** Decodifica e valida token JWT, extrai claims
- **`adminAuth.getUser(userId)`:** Verifica existência do usuário no Firebase Auth

### 9.3 Firestore (Client)
- **`collection(db, "users")`:** Leitura de todos os usuários (ordenados por created_at desc)
- **`doc(db, "tenants", tenantId)`:** Leitura individual do nome do tenant por usuário
- **`doc(db, "users", uid)`:** Atualização de dados do usuário
- **`collection(db, "consultants")`:** Leitura de todos os consultores + atualização por user_id

### 9.4 Firestore (Admin — Server)
- **`adminDb.collection("users")`:** Leitura para verificar existência e role
- **`adminDb.collection("password_reset_tokens")`:** Criação e invalidação de tokens
- **`adminDb.collection("email_queue")`:** Adição de email na fila
- **`adminDb.collection("users").doc(uid).update()`:** Registro de auditoria

### 9.5 API Route
- **Endpoint:** `POST /api/users/[id]/reset-password`
- **Arquivo:** `src/app/api/users/[id]/reset-password/route.ts`
- **Headers:** `Authorization: Bearer {idToken}`, `Content-Type: application/json`
- **Resposta Sucesso:** `{ success: true, message: string, email: string }`
- **Resposta Erro:** `{ error: string }` com código HTTP apropriado

### 9.6 Serviço de Reset de Senha
- **Arquivo:** `src/lib/services/passwordResetService.ts`
- **Funções:**
  - `createPasswordResetToken(userId, email, createdBy, tenantId?)` → `{ token, expiresAt }`
  - `validateToken(rawToken)` → `{ valid, userId?, userEmail?, emailMasked?, error? }`
  - `consumeToken(rawToken)` → `{ success, userId?, userEmail?, error? }`
  - `invalidateUserTokens(userId)` → void (batch update)
  - `generateResetLink(token, baseUrl?)` → URL string
  - `generateResetToken()` → 64-char hex string
  - `hashToken(token)` → SHA-256 hex string
  - `maskEmail(email)` → masked email (ex: `j***@gmail.com`)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- **Verificação dupla de role:** Client-side (botão não renderizado) + Server-side (API verifica `is_system_admin`)
- **Token de reset seguro:** 32 bytes aleatórios via `crypto.randomBytes`, armazenado como hash SHA-256
- **Token de uso único:** Marcado como `used_at` ao consumir, verificado antes de processar
- **Invalidação automática:** Tokens anteriores invalidados ao criar novo
- **Expiração:** 30 minutos (`TOKEN_EXPIRY_MINUTES = 30`)
- **Confirm dialog:** Antes de enviar reset de senha
- **Bearer token:** API route requer token de autenticação válido
- **System Admin protegido:** Não pode ter senha resetada nem ser editado

### 10.2 Vulnerabilidades / Pontos de Atenção
- **Email do consultor editável no Firestore mas NÃO no Firebase Auth:** Ao editar email de consultor, o campo `email` é atualizado no Firestore (`users` e `consultants`), mas o email no Firebase Auth permanece inalterado. Isso pode causar inconsistência.
- **N+1 queries:** Para cada usuário, query individual ao tenant. Expõe leitura excessiva ao Firestore (custo + latência).
- **Busca de consultor por iteração:** `getDocs` carrega TODOS os consultores para encontrar um. Não escalável.
- **`alert()` nativo:** Não bloqueante em todos os browsers, experiência inconsistente.
- **`new Date()` client-side:** Campos `updated_at` usam data do client (pode ser manipulada), enquanto API route usa `FieldValue.serverTimestamp()`.
- **Sem rate limiting:** API route de reset não tem proteção contra abuso.
- **Email HTML inline:** Template de email com CSS inline, sem sanitização de `displayName`.

### 10.3 Dados Sensíveis
- **Emails de usuários:** Exibidos em texto plano na tabela e dialog
- **Tokens de reset:** Armazenados como hash (nunca em texto plano). Token bruto enviado apenas por email.
- **Bearer token:** Transmitido via header Authorization para API route

---

## 11. Performance

### 11.1 Métricas Esperadas
- **Carregamento inicial:** Proporcional ao número de usuários × (1 + queries de tenant). Para 100 usuários, ~100 queries adicionais ao Firestore.
- **Filtragem:** Instantânea (client-side, sem IO)
- **Edição:** 1-3 writes (users + consultants eventualmente)
- **Reset de senha:** 3-5 writes server-side (invalidação batch + token + email_queue + auditoria)

### 11.2 Otimizações Atuais
- Ordenação `created_at desc` no Firestore (usa índice automático)
- Filtragem client-side evita round-trips adicionais

### 11.3 Gargalos Identificados
- **N+1 Query de Tenants:** Principal gargalo. Para cada usuário, faz `getDoc` individual. Solução: denormalizar `tenantName` na coleção `users` ou fazer batch de tenant IDs únicos.
- **Busca de Consultor por Iteração:** `getDocs(consultants)` sem filtro `where`. Solução: `query(consultantsRef, where("user_id", "==", uid))`.
- **Sem paginação:** Carrega TODOS os usuários de uma vez. Pode ser problemático com centenas de usuários.
- **Recarregamento completo:** `loadAllUsers()` após cada edição recarrega tudo (incluindo N+1 queries).

---

## 12. Acessibilidade

### 12.1 WCAG
- **Labels:** Campos do dialog possuem `<Label htmlFor>` com IDs correspondentes
- **Dialog:** Usa componente shadcn/ui Dialog com `role="dialog"` e gestão de foco automática
- **Badges:** Texto legível em todas as variantes
- **Ícones:** Apenas decorativos (sem `aria-label`)

### 12.2 Recursos Implementados
- Tabela semântica com `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableHead>`, `<TableRow>`, `<TableCell>`
- Select com opções acessíveis (shadcn/ui Select baseado em Radix UI)
- Botões com texto descritivo ("Editar", "Ver Clínica", "Ver Consultores")
- Input de busca com ícone Search como indicador visual

### 12.3 Melhorias Necessárias
- Campo de busca sem `aria-label` ou `<label>` associado (apenas placeholder)
- `alert()` e `confirm()` nativos não são acessíveis em todos os contextos
- Ícones de role na tabela sem `aria-label` (puramente visuais)
- Sem indicação de loading para ações individuais (editar, resetar) além do texto do botão

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Carregar lista com múltiplos roles | Integração | Pendente |
| T-002 | Buscar por nome, email e clínica | Unitário | Pendente |
| T-003 | Editar usuário regular (role + status) | E2E | Pendente |
| T-004 | Editar consultor (email + telefone) | E2E | Pendente |
| T-005 | Verificar sincronização users ↔ consultants | Integração | Pendente |
| T-006 | Reset de senha — fluxo completo | E2E | Pendente |
| T-007 | Reset de senha — token expirado | Integração | Pendente |
| T-008 | Reset de senha — token já usado | Integração | Pendente |
| T-009 | Bloquear edição de system_admin | E2E | Pendente |
| T-010 | Bloquear reset de system_admin (API) | Integração | Pendente |
| T-011 | Busca N+1 com tenant inexistente | Integração | Pendente |
| T-012 | API route sem Bearer token (401) | Unitário | Pendente |
| T-013 | API route com não-admin (403) | Unitário | Pendente |

### 13.2 Cenários de Erro
- Firestore indisponível durante carregamento
- Tenant deletado mas referenciado por usuário
- Consultor com user_id inexistente na coleção consultants
- Token de autenticação expirado durante reset de senha
- Email não cadastrado no Firebase Auth

### 13.3 Testes de Integração
- Verificar que edição de consultor atualiza ambas coleções (`users` e `consultants`)
- Verificar que invalidação de tokens anteriores funciona via batch
- Verificar que email é adicionado à `email_queue` com campos corretos
- Verificar que auditoria é registrada em `users/{uid}`

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Paginação server-side com cursor Firestore
- [ ] Filtro por role (Select múltiplo)
- [ ] Filtro por status (ativo/inativo)
- [ ] Filtro por clínica (Select)
- [ ] Exportação de lista de usuários (CSV/Excel)
- [ ] Criação de usuário direto pela interface (sem access request)
- [ ] Logs de auditoria visíveis na interface (histórico de edições)
- [ ] Desativar conta (revogar custom claims no Firebase Auth)

### 14.2 UX/UI
- [ ] Substituir `alert()` por toast (sonner ou shadcn toast)
- [ ] Substituir `confirm()` por AlertDialog (shadcn/ui)
- [ ] Skeleton loading nos cards e tabela
- [ ] Indicador de loading por linha (não global)
- [ ] Feedback visual após edição sem recarregar toda a lista

### 14.3 Performance
- [ ] Eliminar N+1 queries: denormalizar `tenantName` no documento `users`
- [ ] Usar `where("user_id", "==", uid)` para buscar consultor em vez de carregar todos
- [ ] Cache de nomes de tenants (Map local)
- [ ] Atualização otimista do estado local após edição (sem `loadAllUsers()`)

### 14.4 Segurança
- [ ] Rate limiting na API route de reset de senha
- [ ] Sanitização de `displayName` no template de email HTML
- [ ] Sincronizar email no Firebase Auth quando editado para consultores
- [ ] Usar `FieldValue.serverTimestamp()` em vez de `new Date()` para `updated_at` no client
- [ ] CAPTCHA ou cooldown para múltiplos resets do mesmo usuário

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/tenants/{id}` | Navegação "Ver Clínica" a partir da lista de usuários |
| `/admin/consultants` | Navegação "Ver Consultores" a partir de usuário consultor |
| `/admin/access-requests` | Access requests geram novos documentos em `users` |
| `/reset-password/{token}` | Página pública onde usuário define nova senha via token |

### 15.2 Fluxos Relacionados
- **Aprovação de Access Request:** Cria documento em `users` que aparece nesta lista
- **Cadastro de Consultor:** Cria documento em `users` (role: clinic_consultant) + `consultants`
- **Reset de Senha:** Gera token → email → página `/reset-password/{token}` → nova senha

### 15.3 Impacto de Mudanças
- Alterar estrutura de `users` impacta esta página e todas as páginas que leem dados de usuário
- Alterar estrutura de `consultants` impacta esta página e `/admin/consultants/*`
- Alterar API route de reset impacta esta página e a página `/reset-password/{token}`
- Remover campo `full_name` requer ajuste em `handleSaveUser` (linha 214)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Interface local `UserWithTenant`:** Não exportada, definida no componente. Combina dados de `users` com nome do tenant resolvido.
- **N+1 deliberado:** Implementação simplificada para MVP, com consciência da necessidade de otimização.
- **Dual-write para consultores:** Ao editar consultor, atualiza `users` e `consultants` separadamente (sem transação).
- **Email via fila:** Desacopla envio de email da API route, usando `email_queue` processada externamente.
- **Token hash-only:** Token bruto nunca armazenado no banco, apenas hash SHA-256.

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para interatividade (useState, useEffect, event handlers)
- **N+1 Query Pattern:** Anti-pattern consciente, aceito para MVP
- **Optimistic default:** `active ?? true` — usuários sem campo `active` são considerados ativos
- **Fallback chain:** `displayName || full_name || ""` para compatibilidade de nomes
- **Bearer token auth:** Padrão REST para autenticação de API routes

### 16.3 Limitações Conhecidas
- Não há paginação (carrega todos os usuários de uma vez)
- Edição de email do consultor não sincroniza com Firebase Auth
- `confirm()` e `alert()` nativos em vez de componentes UI
- Sem debounce na busca (filtra a cada keystroke)
- Sem ordenação de colunas na tabela
- Botão "Editar" não aparece para system_admin (incluindo o próprio, que deve usar `/admin/profile`)

### 16.4 Notas de Implementação
- **Linha 69:** `editRole` tipo é `"clinic_admin" | "clinic_user"` — limita select a apenas esses dois roles
- **Linha 195:** Ao abrir dialog para system_admin ou consultant, `editRole` é forçado para `"clinic_admin"` (fallback para Select)
- **Linha 121:** `tenantName` para consultores é hardcoded como "Consultor" (não busca tenant)
- **Linha 236-249:** Busca de consultor usa `getDocs` sem filtro (carrega toda a coleção)
- **Linha 441:** Key da TableRow usa `${user.tenantId}-${user.uid}` (composta)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções). Adicionados detalhes de API route, serviço de reset de senha, fluxos ASCII, regras de negócio expandidas, análise de segurança e performance. |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **N+1 Query** | Anti-pattern onde N queries adicionais são executadas para cada item de uma lista (1 query principal + N queries individuais) |
| **Bearer Token** | Esquema de autenticação HTTP onde o token JWT é enviado no header `Authorization: Bearer {token}` |
| **SHA-256** | Algoritmo de hash criptográfico que produz digest de 256 bits (64 caracteres hexadecimais) |
| **Token de Uso Único** | Token que só pode ser consumido uma vez, marcado como `used_at` após uso |
| **Dual-write** | Padrão onde a mesma operação escreve em duas coleções/documentos separadamente (sem transação atômica) |
| **email_queue** | Coleção Firestore que atua como fila de emails pendentes, processada por serviço externo |
| **Custom Claims** | Dados extras no token JWT do Firebase Auth (ex: `is_system_admin`, `tenant_id`, `role`) |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Admin Dashboard](./dashboard-documentation.md) — Visão geral do painel administrativo
- [Access Requests](./access-requests-documentation.md) — Fluxo de aprovação que gera usuários
- [Consultants List](./consultants-list-documentation.md) — Gestão de consultores
- [Tenants Detail](./tenants-detail-documentation.md) — Detalhe da clínica (navegação "Ver Clínica")

### 19.2 Código Fonte
- `src/app/(admin)/admin/users/page.tsx` — Componente principal (665 linhas)
- `src/app/api/users/[id]/reset-password/route.ts` — API route de reset (196 linhas)
- `src/lib/services/passwordResetService.ts` — Serviço de tokens de reset (245 linhas)
- `src/lib/firebase.ts` — Configuração Firebase client
- `src/lib/firebase-admin.ts` — Configuração Firebase Admin
- `src/lib/utils.ts` — Utilitário `formatTimestamp`

### 19.3 Links Externos
- [Firebase Admin Auth — verifyIdToken](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase Admin Auth — getUser](https://firebase.google.com/docs/auth/admin/manage-users)
- [Node.js crypto.randomBytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)

---

## 20. Anexos

### 20.1 Exemplo de Email de Reset de Senha (HTML)
O template de email inclui:
- Header com gradiente (#667eea → #764ba2) e título "Redefinição de Senha"
- Saudação personalizada com nome do usuário
- Botão CTA "Definir Nova Senha" com link
- Caixa de aviso amarela: expira em 30min, uso único, ignorar se não solicitado
- Link alternativo em texto plano
- Footer com copyright e aviso de segurança

### 20.2 Exemplo de Documento password_reset_tokens
```json
{
  "token_hash": "a1b2c3d4e5f6...64chars",
  "user_id": "abc123",
  "user_email": "user@clinic.com",
  "tenant_id": "tenant_xyz",
  "expires_at": "2026-02-08T15:30:00Z",
  "created_at": "2026-02-08T15:00:00Z",
  "created_by": "admin_uid_456",
  "used_at": null,
  "invalidated_at": null
}
```

### 20.3 Exemplo de Documento email_queue
```json
{
  "to": "user@clinic.com",
  "subject": "Redefinição de Senha - Curva Mestra",
  "body": "<html>...template...</html>",
  "status": "pending",
  "type": "password_reset",
  "metadata": {
    "user_id": "abc123",
    "tenant_id": "tenant_xyz",
    "expires_at": "2026-02-08T15:30:00.000Z"
  },
  "created_at": "2026-02-08T15:00:00Z"
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
