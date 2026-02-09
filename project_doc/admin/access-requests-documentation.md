# Documentação Experimental - Solicitações de Acesso (Admin)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Solicitações de Acesso (`/admin/access-requests`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página onde o System Admin gerencia solicitações de acesso pendentes. Novos usuários que se registram no sistema ficam pendentes de aprovação. O admin pode aprovar (criando tenant + usuário + licença + onboarding automaticamente) ou rejeitar (com motivo opcional) cada solicitação. A aprovação é uma operação server-side complexa que cria 5 documentos em cadeia (tenant, usuário Auth, usuário Firestore, licença, onboarding) e envia e-mail de boas-vindas via fila.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/access-requests/page.tsx`
- **Rota:** `/admin/access-requests`
- **Layout:** Admin Layout (restrito a `system_admin`)

### 1.2 Dependências Principais
- **accessRequestService:** `src/lib/services/accessRequestService.ts` — `listAccessRequests`, `rejectAccessRequest`
- **API Route:** `src/app/api/access-requests/[id]/approve/route.ts` — aprovação server-side
- **useAuth Hook:** `src/hooks/useAuth.ts` — obtém `user` (Firebase Auth) e `claims` (custom claims)
- **useToast Hook:** `src/hooks/use-toast.ts` — notificações toast
- **documentValidation:** `src/lib/utils/documentValidation.ts` — `formatDocumentAuto` para formatar CPF/CNPJ
- **Types:** `AccessRequest` de `src/types/index.ts`
- **Shadcn/ui:** Card, Table, Dialog, Badge, Skeleton, Textarea, Label, Button
- **Lucide Icons:** CheckCircle, XCircle, Clock, UserPlus, Building2, AlertTriangle

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)
- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualizar todas as solicitações pendentes, aprovar e rejeitar solicitações
- **Comportamento:** Lista carrega automaticamente ao montar filtrando por `status: "pendente"`. Pode recarregar manualmente via botão "Atualizar"
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Interface AccessRequest

```typescript
// Importado de src/types/index.ts
export interface AccessRequest {
  id: string;
  type: AccessRequestType;           // "clinica" | "autonomo"

  // Dados do solicitante
  full_name: string;                  // Nome completo
  email: string;                      // Email (lowercase)
  phone: string;                      // Telefone
  password: string;                   // Senha definida no cadastro

  // Dados da empresa/pessoa
  business_name: string;              // Nome da clínica ou nome profissional
  document_type: DocumentType;        // "cpf" | "cnpj"
  document_number: string;            // CPF ou CNPJ sem formatação

  // Endereço (opcionais)
  address?: string;
  city?: string;
  state?: string;
  cep?: string;

  // Status e aprovação
  status: AccessRequestStatus;        // "pendente" | "aprovada" | "rejeitada"
  approved_by?: string;               // UID do admin que aprovou
  approved_by_name?: string;          // Nome do admin que aprovou
  approved_at?: Timestamp;            // Data da aprovação
  rejected_by?: string;               // UID do admin que rejeitou
  rejected_by_name?: string;          // Nome do admin que rejeitou
  rejected_at?: Timestamp;            // Data da rejeição
  rejection_reason?: string;          // Motivo da rejeição

  // Tenant criado
  tenant_id?: string;                 // ID do tenant criado após aprovação
  user_id?: string;                   // ID do usuário criado após aprovação

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**Campos Principais:**
- **type:** Determina o badge visual e o `max_users` (clinica=5, autonomo=1)
- **status:** Apenas "pendente" é exibido nesta página; "aprovada" e "rejeitada" são filtradas
- **password:** Senha definida pelo usuário no registro, usada na criação do Firebase Auth
- **document_number:** Exibido formatado via `formatDocumentAuto()` (CPF: 000.000.000-00, CNPJ: 00.000.000/0000-00)

---

## 4. Casos de Uso

### 4.1 UC-001: Listar Solicitações Pendentes

**Ator:** System Admin
**Pré-condições:**
- Usuário autenticado como `system_admin`
- Acesso à rota `/admin/access-requests`
- Coleção `access_requests` acessível no Firestore

**Fluxo Principal:**
1. Página monta e `useEffect` chama `loadRequests()`
2. `loadRequests()` chama `listAccessRequests({ status: "pendente" })`
3. Service executa query no Firestore: `orderBy("created_at", "desc")` + `where("status", "==", "pendente")`
4. Dados retornados são armazenados em `requests` via `setRequests()`
5. Exibe 3 cards de contagem (Total Pendentes, Clínicas, Autônomos) e tabela

**Pós-condições:**
- Tabela com solicitações pendentes exibida
- Cards de contagem refletem dados filtrados

**Regra de Negócio:**
- Contagem de Clínicas: `requests.filter(r => r.type === "clinica").length`
- Contagem de Autônomos: `requests.filter(r => r.type === "autonomo").length`

---

### 4.2 UC-002: Aprovar Solicitação

**Ator:** System Admin
**Pré-condições:**
- Solicitação com status "pendente"
- Admin autenticado com `user` e `claims` não nulos
- Solicitação possui `password` definida

**Fluxo Principal:**
1. Admin clica botão "Aprovar" na linha da tabela
2. `processingId` é definido com o ID da solicitação (desabilita botões)
3. `handleApprove()` envia `POST /api/access-requests/{id}/approve`
4. Body: `{ approved_by_uid: user.uid, approved_by_name: user.displayName || user.email || "Admin" }`
5. API Route executa cadeia de criação server-side:
   - Cria documento `tenant` no Firestore
   - Cria usuário no Firebase Auth com a senha do cadastro
   - Define custom claims (`tenant_id`, `role: "clinic_admin"`, `active: true`)
   - Cria documento `user` no Firestore
   - Cria licença `early_access` (6 meses)
   - Cria documento `tenant_onboarding` (status: `pending_setup`)
   - Atualiza status da solicitação para "aprovada"
   - Adiciona e-mail de boas-vindas à fila `email_queue`
6. Toast sucesso: "Solicitação aprovada! Tenant e usuário criados com sucesso. Email: {email}"
7. `loadRequests()` recarrega a lista (solicitação aprovada desaparece)

**Fluxo Alternativo 1 - Erro da API:**
1. API retorna `{ error: string }` com status HTTP de erro
2. Toast destructive exibe mensagem do erro

**Fluxo Alternativo 2 - Email duplicado:**
1. Firebase Auth retorna `auth/email-already-exists`
2. API reverte tenant criado (deleta documento)
3. Retorna erro "Este email já está em uso"

**Fluxo Alternativo 3 - Senha ausente:**
1. Solicitação não possui campo `password`
2. API retorna erro "Senha não encontrada na solicitação"

**Pós-condições:**
- 5 documentos criados: tenant, user (Auth), user (Firestore), license, tenant_onboarding
- E-mail de boas-vindas adicionado à fila
- Solicitação removida da listagem (status mudou para "aprovada")

**Regra de Negócio:**
- Aprovação é atômica parcial: se criação do usuário Auth falha, tenant é revertido
- `max_users` definido pelo tipo: autonomo=1, clinica=5
- Plano inicial: `early_access` (6 meses gratuitos)

---

### 4.3 UC-003: Rejeitar Solicitação

**Ator:** System Admin
**Pré-condições:**
- Solicitação com status "pendente"
- Admin autenticado com `user` e `claims` não nulos

**Fluxo Principal:**
1. Admin clica botão "Rejeitar" na linha da tabela
2. `openRejectDialog()` abre Dialog com campo "Motivo da rejeição"
3. Admin preenche motivo (opcional) no Textarea
4. Admin clica "Confirmar Rejeição"
5. `handleReject()` chama `rejectAccessRequest(id, { uid, name }, reason)` do service
6. Service valida que a solicitação existe e está "pendente"
7. Atualiza documento no Firestore: `status: "rejeitada"`, `rejected_by`, `rejected_by_name`, `rejection_reason`, `rejected_at`
8. Toast sucesso: "Solicitação rejeitada - O solicitante será notificado"
9. Dialog fecha, `loadRequests()` recarrega a lista

**Fluxo Alternativo - Solicitação já processada:**
1. Service retorna `{ success: false, message: "Solicitação já foi processada" }`
2. Toast destructive com mensagem

**Pós-condições:**
- Status atualizado para "rejeitada" no Firestore
- Motivo registrado (ou "Não especificado" se vazio)
- Solicitação removida da listagem

**Regra de Negócio:**
- Motivo da rejeição é opcional (default: "Não especificado")
- Rejeição é feita client-side via service (não precisa de operações Auth)

---

### 4.4 UC-004: Atualizar Lista Manualmente

**Ator:** System Admin
**Pré-condições:**
- Dashboard carregado

**Fluxo Principal:**
1. Admin clica botão "Atualizar" no header da página
2. `loadRequests()` é chamado novamente
3. Estado `loading` é definido como `true`
4. Lista é recarregada do Firestore
5. Estado `loading` volta para `false`

**Pós-condições:**
- Lista reflete dados atuais do Firestore

---

### 4.5 UC-005: Erro no Carregamento

**Ator:** System Admin
**Pré-condições:**
- Falha na query ao Firestore (conexão, permissão)

**Fluxo Principal:**
1. `loadRequests()` captura erro no `catch`
2. Erro logado no `console.error`
3. Toast destructive: "Não foi possível carregar as solicitações"
4. `loading` volta para `false`

**Mensagens de Erro:**
- `console.error("Erro ao carregar solicitações:", error)`

**Pós-condições:**
- Lista vazia exibida (estado do array `requests` permanece `[]`)

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│          SOLICITAÇÕES DE ACESSO (/admin/access-requests)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    │ loadRequests()   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ listAccessReqs   │
                    │ status="pendente"│
                    │ orderBy created  │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               Sucesso              Erro
                    │                   │
                    ▼                   ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ setRequests(data)│  │ Toast destructive│
         │ setLoading(false)│  │ setLoading(false)│
         └──────────────────┘  └──────────────────┘
                    │
                    ▼
         ┌──────────────────────────────────────────┐
         │ RENDER:                                    │
         │ ┌─ 3 Cards Estatísticas ────────────────┐ │
         │ │ Total Pendentes │ Clínicas │ Autônomos │ │
         │ └──────────────────────────────────────┘ │
         │ ┌─ Tabela de Solicitações ──────────────┐ │
         │ │ Tipo │ Solicitante │ Negócio │ Contato │ │
         │ │ Data │ Ações (Aprovar / Rejeitar)      │ │
         │ └──────────────────────────────────────┘ │
         └──────────────────────────────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    [Aprovar]  [Rejeitar]  [Atualizar]
         │          │          │
         ▼          ▼          ▼
  ┌────────────┐ ┌──────────┐ ┌──────────┐
  │ POST API   │ │ Dialog   │ │ loadReqs │
  │ /approve   │ │ motivo   │ │ reload   │
  │ server-side│ │ opcional │ └──────────┘
  └────────────┘ └──────────┘
         │          │
         ▼          ▼
  ┌────────────┐ ┌──────────────┐
  │ Cria:      │ │ rejectAccess │
  │ - Tenant   │ │ Request()    │
  │ - Auth User│ │ service      │
  │ - Claims   │ └──────────────┘
  │ - License  │        │
  │ - Onboard  │        ▼
  │ - Email    │ ┌──────────────┐
  └────────────┘ │ Firestore    │
         │       │ status=      │
         ▼       │ "rejeitada"  │
  ┌────────────┐ └──────────────┘
  │ Toast OK   │        │
  │ Reload list│        ▼
  └────────────┘ ┌──────────────┐
                 │ Toast OK     │
                 │ Close dialog │
                 │ Reload list  │
                 └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Filtro por Status Pendente
**Descrição:** A listagem carrega apenas solicitações com `status: "pendente"`. Solicitações aprovadas e rejeitadas não aparecem.
**Aplicação:** Query Firestore com `where("status", "==", "pendente")`
**Exceções:** Nenhuma
**Justificativa:** Admin precisa ver apenas o que requer ação imediata

### RN-002: Tipos de Conta (Clinica vs Autônomo)
**Descrição:** Solicitações são classificadas como "clinica" (CNPJ, até 5 usuários) ou "autonomo" (CPF, 1 usuário). Badge visual diferencia os tipos na tabela.
**Aplicação:** Campo `type` da solicitação determina ícone (Building2 vs UserPlus) e texto do badge
**Exceções:** Nenhuma
**Justificativa:** Diferencia visualmente o porte da conta para decisão do admin

### RN-003: Aprovação via API Route Server-Side
**Descrição:** Aprovação é feita via API route (não diretamente no Firestore) porque precisa executar operações que requerem Firebase Admin SDK: criar usuário Auth, definir custom claims, criar licença.
**Aplicação:** `POST /api/access-requests/{id}/approve` executa cadeia completa
**Exceções:** Se criação do usuário Auth falha, tenant criado é revertido (rollback parcial)
**Justificativa:** Operações de Auth e custom claims só podem ser feitas server-side com Admin SDK

### RN-004: Rejeição via Service Client-Side
**Descrição:** Rejeição é feita via service client-side (`rejectAccessRequest`) pois apenas atualiza campos no Firestore, sem operações de Auth.
**Aplicação:** `rejectAccessRequest(id, { uid, name }, reason)` faz `updateDoc` diretamente
**Exceções:** Se solicitação já foi processada (status !== "pendente"), retorna erro
**Justificativa:** Operação simples que não precisa de Admin SDK

### RN-005: Plano Inicial Early Access
**Descrição:** Toda aprovação cria uma licença `early_access` com 6 meses de duração e features básicas.
**Aplicação:** API route cria licença automaticamente com features: `inventory_management`, `batch_tracking`, `expiration_alerts`, `basic_reports`
**Exceções:** Nenhuma
**Justificativa:** Programa de acesso antecipado permite uso gratuito durante o período beta

### RN-006: E-mail de Boas-Vindas Automático
**Descrição:** Após aprovação, um e-mail de boas-vindas é adicionado à fila `email_queue` para envio assíncrono via Cloud Function.
**Aplicação:** Documento criado em `email_queue` com `type: "welcome_approval"` e `status: "pending"`
**Exceções:** Falha no envio do e-mail não impede a aprovação (try/catch separado)
**Justificativa:** E-mail assíncrono evita timeout na requisição de aprovação

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** `loading === true` (ao montar o componente ou ao recarregar)
**Exibição:** 3 Skeleton placeholders (`<Skeleton className="h-16 w-full" />`)
**Interações:** Nenhuma — área de conteúdo substituída por skeletons
**Duração:** ~1-2 segundos

### 7.2 Estado: Lista Vazia
**Quando:** `loading === false` e `requests.length === 0`
**Exibição:**
- Ícone CheckCircle (h-12, opacity-50, muted-foreground)
- Título "Nenhuma solicitação pendente" (text-lg, font-semibold)
- Subtexto "Todas as solicitações foram processadas" (text-muted-foreground)
- Cards de contagem exibem 0 em todos os campos

### 7.3 Estado: Com Solicitações
**Quando:** `loading === false` e `requests.length > 0`
**Exibição:**
- **3 Cards de estatísticas (grid 3 colunas):**
  - Total Pendentes (ícone Clock, muted) — `requests.length`
  - Clínicas (ícone Building2, blue-600) — filtrado por `type === "clinica"`
  - Autônomos (ícone UserPlus, green-600) — filtrado por `type === "autonomo"`
- **Tabela com colunas:**
  - Tipo: Badge (default para clínica, secondary para autônomo)
  - Solicitante: nome (font-medium) + email (text-xs, muted)
  - Negócio: business_name (font-medium) + CPF/CNPJ formatado (text-xs, muted)
  - Contato: phone + city/state se disponíveis
  - Data: `created_at.toDate().toLocaleDateString("pt-BR")` ou "N/A"
  - Ações: Botão "Aprovar" (default) + Botão "Rejeitar" (destructive)

**Links/Navegação:**
- Nenhum link externo — ações são inline

### 7.4 Estado: Processando Aprovação/Rejeição
**Quando:** `processingId === request.id`
**Exibição:**
- Botão "Aprovar" muda texto para "Processando..." com ícone CheckCircle
- Ambos botões ficam `disabled` na linha em processamento
- Demais linhas permanecem interativas

### 7.5 Estado: Dialog de Rejeição
**Quando:** `rejectDialogOpen === true`
**Exibição:**
- DialogTitle: "Rejeitar Solicitação"
- DialogDescription: "Informe o motivo da rejeição (opcional)"
- Label: "Motivo da rejeição"
- Textarea: placeholder "Ex: CPF/CNPJ não cadastrado, limite de usuários atingido, etc.", 4 rows
- DialogFooter: Botão "Cancelar" (outline) + Botão "Confirmar Rejeição" (destructive, disabled se `processingId` ativo)

---

## 8. Validações

### 8.1 Validações de Frontend
- **user e claims:** Verificados antes de `handleApprove` e `handleReject` — se nulos, função retorna sem ação
- **processingId:** Impede ações duplicadas desabilitando botões durante processamento
- **Timestamp:** Conversão segura com `created_at?.toDate` e fallback para "N/A"

### 8.2 Validações de Backend (API Route)
- **approved_by_uid/approved_by_name:** Obrigatórios no body — retorna 400 se ausentes
- **Solicitação existe:** Busca documento por ID — retorna 404 se não encontrado
- **Status "pendente":** Valida que solicitação ainda não foi processada — retorna 400 se já foi
- **Password presente:** Verifica que a senha foi definida no cadastro — retorna 400 se ausente
- **Email duplicado:** Firebase Auth retorna `auth/email-already-exists` — retorna 400 com rollback do tenant

### 8.3 Validações de Permissão
- **Admin Layout:** Verifica custom claim `is_system_admin === true` antes de renderizar
- **Firestore Rules:** Acesso à coleção `access_requests` permitido apenas para `system_admin`

---

## 9. Integrações

### 9.1 API Route — Aprovação
- **Tipo:** Next.js API Route (server-side)
- **Arquivo:** `src/app/api/access-requests/[id]/approve/route.ts`
- **Método:** `POST /api/access-requests/{id}/approve`
- **Entrada:** `{ approved_by_uid: string, approved_by_name: string }`
- **Retorno Sucesso:** `{ success: true, message: string, data: { tenant_id, user_id, email, business_name } }`
- **Retorno Erro:** `{ error: string }` com status 400/404/500
- **Operações:** Cria tenant → Auth user → custom claims → Firestore user → license → onboarding → atualiza request → email_queue

### 9.2 Firestore — Coleção `access_requests`
- **Tipo:** Firestore SDK (client-side via service)
- **Operações:** Read (listagem), Update (rejeição)
- **Query Listagem:** `orderBy("created_at", "desc")` + `where("status", "==", "pendente")`
- **Campos lidos:** `id`, `type`, `full_name`, `email`, `business_name`, `document_type`, `document_number`, `phone`, `city`, `state`, `created_at`
- **Campos escritos (rejeição):** `status`, `rejected_by`, `rejected_by_name`, `rejection_reason`, `rejected_at`, `updated_at`

### 9.3 Firebase Admin SDK (server-side, na API Route)
- **createUser():** Cria usuário com email, password, displayName
- **setCustomUserClaims():** Define `tenant_id`, `role`, `is_system_admin`, `active`
- **Coleções escritas:** `tenants`, `users`, `licenses`, `tenant_onboarding`, `access_requests`, `email_queue`

### 9.4 documentValidation
- **Tipo:** Utilitário
- **Método:** `formatDocumentAuto(document_number)` — detecta CPF/CNPJ pelo tamanho e aplica máscara
- **Quando:** Exibição na coluna "Negócio" da tabela

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Acesso restrito por Admin Layout (verifica `is_system_admin` via custom claims)
- ✅ Verificação de `user` e `claims` não nulos antes de qualquer ação
- ✅ Botões desabilitados durante processamento (previne ações duplicadas)
- ✅ CPF/CNPJ formatado com máscara para exibição (dados originais não alterados)
- ✅ Rollback de tenant se criação de usuário Auth falhar
- ✅ E-mail de boas-vindas não contém senha (usuário usa a que definiu no cadastro)
- ✅ Erros capturados por try/catch em todas as operações

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Aprovação não usa Bearer token na requisição (POST direto ao endpoint sem autenticação)
- ⚠️ Rollback parcial: se criação de licença ou onboarding falhar após Auth user criado, não há rollback completo
- **Mitigação:** Admin Layout garante que apenas system_admin acessa a página; API Route protegida por rota do Next.js

### 10.3 Dados Sensíveis
- **Senha:** Armazenada no campo `password` da solicitação (texto plano no Firestore) — usada apenas na criação do Auth e não exposta na interface
- **CPF/CNPJ:** Exibido formatado com máscara na tabela
- **Email:** Exibido na tabela como informação de contato

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** ~1-2s (query indexada por status + created_at)
- **Requisições Firestore:** 1 query ao montar (listAccessRequests)
- **Tamanho do componente:** ~412 linhas
- **Requisições por aprovação:** 1 POST HTTP (API route executa múltiplas operações server-side)

### 11.2 Otimizações Implementadas
- ✅ Query indexada por `status` + `orderBy created_at` — Firestore composite index
- ✅ Recarregamento manual via botão "Atualizar" (sem polling automático)
- ✅ Processamento individual (`processingId`) — não bloqueia toda a tabela

### 11.3 Gargalos Identificados
- ⚠️ Sem paginação — carrega todas as solicitações pendentes de uma vez
- ⚠️ Sem cache — cada clique em "Atualizar" refaz a query completa
- ⚠️ Aprovação é operação sequencial no backend (cria 5+ documentos em série)
- **Plano de melhoria:** Usar batch writes no backend; implementar paginação se volume crescer

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial (não auditado formalmente)
- **Versão:** N/A

### 12.2 Recursos Implementados
- ✅ Labels em campos do Dialog de rejeição (`<Label htmlFor="reason">`)
- ✅ Dialog com DialogTitle e DialogDescription para screen readers
- ✅ Botões com texto descritivo ("Aprovar", "Rejeitar", "Confirmar Rejeição")
- ✅ Skeletons indicam carregamento visualmente

### 12.3 Melhorias Necessárias
- [ ] ARIA labels nos cards de estatísticas
- [ ] Anúncio de carregamento para screen readers (aria-live)
- [ ] Foco automático no primeiro botão de ação após carregamento
- [ ] Contraste do texto "N/A" na coluna de data (pode ser insuficiente)
- [ ] Keyboard navigation na tabela

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Carregamento com solicitações pendentes**
   - **Dado:** 3 solicitações pendentes (2 clínicas, 1 autônomo)
   - **Quando:** Página é montada
   - **Então:** Cards mostram: Total=3, Clínicas=2, Autônomos=1; Tabela com 3 linhas

2. **Carregamento sem solicitações**
   - **Dado:** Nenhuma solicitação pendente no Firestore
   - **Quando:** Página é montada
   - **Então:** Exibe "Nenhuma solicitação pendente" com ícone CheckCircle

3. **Aprovação bem-sucedida**
   - **Dado:** Solicitação pendente de tipo "clinica"
   - **Quando:** Admin clica "Aprovar"
   - **Então:** Toast sucesso, solicitação desaparece da lista, tenant e usuário criados

4. **Rejeição com motivo**
   - **Dado:** Solicitação pendente
   - **Quando:** Admin clica "Rejeitar", preenche motivo, confirma
   - **Então:** Toast "Solicitação rejeitada", dialog fecha, solicitação desaparece

5. **Rejeição sem motivo**
   - **Dado:** Solicitação pendente
   - **Quando:** Admin clica "Rejeitar", não preenche motivo, confirma
   - **Então:** Motivo salvo como "Não especificado"

### 13.2 Casos de Teste de Erro
1. **Email duplicado na aprovação:** API retorna 400, tenant revertido, toast destructive
2. **Solicitação já processada:** API retorna 400, toast com mensagem
3. **Firestore indisponível:** loadRequests falha, toast destructive
4. **Sem user/claims:** handleApprove/handleReject retornam silenciosamente

### 13.3 Testes de Integração
- [ ] Verificar cadeia completa de aprovação: tenant + auth + claims + license + onboarding
- [ ] Verificar rollback ao falhar criação de Auth user
- [ ] Verificar que e-mail é adicionado à fila após aprovação
- [ ] Verificar rejeição com e sem motivo preenchido

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Filtro por tipo (clínica/autônomo) via tabs ou select
- [ ] Histórico de solicitações aprovadas/rejeitadas (tab ou página separada)
- [ ] Busca por nome/email na lista
- [ ] Paginação para grandes volumes de solicitações
- [ ] Detalhes expandidos da solicitação (expandable row ou dialog)
- [ ] Aprovação em lote (selecionar múltiplas e aprovar de uma vez)

### 14.2 UX/UI
- [ ] Skeleton loading nos cards de estatísticas (atualmente sem loading state)
- [ ] Contador atualizado em tempo real via Firestore listener
- [ ] Confirmação visual antes de aprovar (atualmente sem confirm dialog)
- [ ] Preview dos dados que serão criados antes de aprovar

### 14.3 Performance
- [ ] Firestore listener (onSnapshot) em vez de polling manual
- [ ] Cache da listagem com invalidação após ação
- [ ] Batch writes no backend para aprovação

### 14.4 Segurança
- [ ] Bearer token na requisição de aprovação (atualmente POST sem autenticação)
- [ ] Rollback completo na aprovação (incluir Auth user se licença falhar)
- [ ] Rate limiting na API route de aprovação
- [ ] Auditoria de ações (aprovar/rejeitar) em coleção separada

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Registro (`/register`):** Cria as solicitações que aparecem nesta página
- **Admin Dashboard (`/admin/dashboard`):** Exibe contagem de access_requests aprovadas no feed de atividades
- **Admin Layout:** Provê verificação de autenticação e navegação lateral
- **Waiting Approval (`/waiting-approval`):** Página que o solicitante vê após o registro

### 15.2 Fluxos que Passam por Esta Página
1. **Registro → Aprovação → Login:** Usuário registra → admin aprova → tenant/user criados → usuário faz login
2. **Registro → Rejeição:** Usuário registra → admin rejeita → solicitação arquivada

### 15.3 Impacto de Mudanças
- **Alto impacto:** Alterações na interface `AccessRequest` (afeta registro, service e API route)
- **Alto impacto:** Alterações na API route de aprovação (cadeia complexa de criação)
- **Médio impacto:** Alterações no `accessRequestService` (afeta esta página e registro)
- **Baixo impacto:** Alterações visuais nos cards/tabela (apenas UI)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Aprovação server-side, rejeição client-side:** Aprovação precisa de Admin SDK (Auth, custom claims); rejeição é apenas update no Firestore, dispensando server-side.
- **Senha no Firestore:** A senha do usuário é armazenada temporariamente no documento da solicitação para que a API route possa criar o Auth user. Após aprovação, a senha permanece no documento mas não é mais utilizada.
- **Early access plan:** Toda aprovação cria licença de 6 meses gratuitos como parte do programa de acesso antecipado.

### 16.2 Padrões Utilizados
- **Controlled State:** `useState` para requests, loading, processingId, selectedRequest, rejectDialogOpen, rejectionReason
- **Effect on Mount:** `useEffect([], [])` para carregamento inicial
- **Optimistic Disable:** `processingId` desabilita botões durante operação assíncrona
- **Error Boundary via Toast:** Todos os erros exibidos como toasts destructive

### 16.3 Limitações Conhecidas
- ⚠️ Não há confirmação antes de aprovar (apenas rejeição tem dialog de confirmação)
- ⚠️ Aprovação sem Bearer token na requisição HTTP (confia no Admin Layout para controle de acesso)
- ⚠️ Rollback incompleto: se operações posteriores à criação do Auth user falharem, tenant e user já existem
- ⚠️ Sem realtime listeners — dados podem ficar desatualizados se múltiplos admins operam simultaneamente

### 16.4 Notas de Implementação
- Componente usa `"use client"` por depender de hooks React
- Página tem ~412 linhas
- Badge de tipo usa `getStatusBadge()` com ícones Building2 (clínica) e UserPlus (autônomo)
- Data formatada com `toLocaleDateString("pt-BR")` com fallback para "N/A" se Timestamp indisponível
- `approved_by_name` usa fallback chain: `user.displayName || user.email || "Admin"`

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

- **Access Request:** Solicitação de acesso criada quando um novo usuário se registra na plataforma
- **Tenant:** Clínica ou entidade no sistema multi-tenant, representada por um documento na coleção `tenants`
- **System Admin:** Administrador global da plataforma Curva Mestra com acesso irrestrito
- **Custom Claims:** Metadados de permissão armazenados no token JWT do Firebase Authentication
- **Early Access:** Plano gratuito de 6 meses oferecido durante o período beta da plataforma
- **Email Queue:** Coleção Firestore que armazena e-mails pendentes de envio, processados por Cloud Function
- **Onboarding:** Processo de configuração inicial do tenant após aprovação (setup, plano, pagamento)
- **Rollback:** Reversão de operações já executadas quando uma etapa posterior falha

---

## 19. Referências

### 19.1 Documentação Relacionada
- Registro de Usuários - `project_doc/auth/register-page-documentation.md`
- Waiting Approval - `project_doc/auth/waiting-approval-documentation.md`
- Admin Dashboard - `project_doc/admin/dashboard-documentation.md`
- Clinic Access Requests - `project_doc/clinic/access-requests-documentation.md`

### 19.2 Links Externos
- [Firebase Admin Auth](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(admin)/admin/access-requests/page.tsx`
- **Service:** `src/lib/services/accessRequestService.ts`
- **API Route:** `src/app/api/access-requests/[id]/approve/route.ts`
- **Types:** `src/types/index.ts` (interface AccessRequest)
- **Utils:** `src/lib/utils/documentValidation.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — página renderizada no browser]

### 20.2 Diagramas
Diagrama de fluxo incluído na Seção 5.

### 20.3 Exemplos de Código

```typescript
// Exemplo: Cadeia de aprovação na API Route
// 1. Cria tenant
const tenantRef = await adminDb.collection("tenants").add(tenantData);
// 2. Cria Auth user com senha do cadastro
const userRecord = await adminAuth.createUser({
  email: request.email,
  password: request.password,
  displayName: request.full_name,
});
// 3. Define custom claims
await adminAuth.setCustomUserClaims(userRecord.uid, {
  tenant_id: tenantRef.id,
  role: "clinic_admin",
  is_system_admin: false,
  active: true,
});
// 4. Se Auth falhar, reverte tenant
// catch: await adminDb.collection("tenants").doc(tenant_id).delete();
```

```typescript
// Exemplo: Rejeição via service
const result = await rejectAccessRequest(
  selectedRequest.id,
  { uid: user.uid, name: user.displayName || "Admin" },
  rejectionReason // opcional
);
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
