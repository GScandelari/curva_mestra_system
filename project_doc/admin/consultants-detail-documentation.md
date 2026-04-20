# Documentação Experimental - Detalhes do Consultor

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes do Consultor (`/admin/consultants/[id]`)
**Versão:** 1.1
**Data:** 10/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de detalhes e edição de um consultor Rennova. Exibe código único de 6 dígitos com opção de copiar, informações gerais (datas de criação/atualização, quantidade de clínicas vinculadas), formulário de edição inline com validações e lista de clínicas autorizadas com navegação direta para cada tenant. Consultores são usuários especiais que podem acessar múltiplas clínicas sem pertencer a um tenant específico.

### 1.1 Localização

- **Arquivo:** `src/app/(admin)/admin/consultants/[id]/page.tsx`
- **Rota:** `/admin/consultants/{id}`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)
- **Parâmetro dinâmico:** `[id]` — ID do consultor no Firestore

### 1.2 Dependências Principais

- **Firebase Auth:** `auth.currentUser` para obter `idToken` (Bearer token)
- **API Routes:** `GET /api/consultants/{id}`, `PUT /api/consultants/{id}`
- **Hooks:** `useAuth()` de `src/hooks/useAuth.ts`, `useToast()` de `src/hooks/use-toast.ts`
- **Utils:** `formatTimestamp()` de `src/lib/utils`
- **Types:** `Consultant` de `src/types/index.ts`
- **UI:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Badge (shadcn/ui)
- **Ícones:** ArrowLeft, Users, Loader2, Copy, Building2, Save (lucide-react)

---

## 2. Tipos de Usuários / Atores

### 2.1 System Admin (`system_admin`)

- **Descrição:** Administrador global da plataforma Curva Mestra
- **Acesso:** Visualizar detalhes completos do consultor, editar dados (nome, email, telefone), copiar código, navegar para clínicas vinculadas
- **Comportamento:** Dados carregados automaticamente ao montar via API route com autenticação Bearer
- **Restrições:** Único tipo de usuário com acesso; controle feito pelo Admin Layout via custom claims `is_system_admin`

---

## 3. Estrutura de Dados

### 3.1 Interface Consultant

```typescript
// Importado de src/types/index.ts
export interface Consultant {
  id: string; // ID do documento no Firestore
  code: string; // Código único de 6 dígitos
  name: string; // Nome completo (MAIÚSCULAS)
  email: string; // Email (lowercase)
  phone: string; // Telefone formatado
  status: ConsultantStatus; // "active" | "suspended" | "inactive"
  authorized_tenants: string[]; // Array de tenant IDs autorizados
  user_id?: string; // UID do usuário no Firebase Auth
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type ConsultantStatus = 'active' | 'suspended' | 'inactive';
```

### 3.2 Estado do Formulário (formData)

```typescript
// Estado local do componente
{
  name: string; // Inicializado com consultant.name
  email: string; // Inicializado com consultant.email
  phone: string; // Inicializado com consultant.phone
}
```

### 3.3 Dados Enviados na Atualização — PUT /api/consultants/{id}

```typescript
{
  name: string; // MAIÚSCULAS via toUpperCase()
  email: string; // lowercase via toLowerCase()
  phone: string; // Apenas dígitos, formatado na exibição
}
```

**Campos Principais:**

- **code:** Código único de 6 dígitos gerado no cadastro, imutável, usado para vincular consultor a clínicas
- **name:** Sempre armazenado em MAIÚSCULAS (conversão automática no handleChange)
- **email:** Sempre armazenado em lowercase (conversão no envio)
- **authorized_tenants:** Array de IDs de tenants que autorizaram este consultor

---

## 4. Casos de Uso

### 4.1 UC-001: Carregar Detalhes do Consultor

**Ator:** System Admin
**Pré-condições:**

- Usuário autenticado como `system_admin`
- ID do consultor válido na URL
- Consultor existe no sistema

**Fluxo Principal:**

1. Página monta e extrai `id` dos parâmetros da rota
2. Obtém `idToken` via `auth.currentUser.getIdToken()`
3. `GET /api/consultants/{id}` com header `Authorization: Bearer {idToken}`
4. API route retorna dados do consultor
5. `setConsultant(data.data)` preenche estado principal
6. `setFormData({ name, email, phone })` preenche formulário
7. `loading` muda para `false`

**Fluxo Alternativo - Consultor não encontrado:**

1. API retorna erro 404
2. Toast destructive: "Consultor não encontrado"
3. `router.push("/admin/consultants")` redireciona para lista

**Fluxo Alternativo - Erro de autenticação:**

1. Falha ao obter `idToken`
2. Toast destructive: "Erro de autenticação"
3. Redirect para lista

**Pós-condições:**

- Dados do consultor exibidos em 4 cards
- Formulário preenchido com valores atuais

**Regra de Negócio:** RN-001

---

### 4.2 UC-002: Editar Dados do Consultor

**Ator:** System Admin
**Pré-condições:**

- Consultor carregado com sucesso
- `auth.currentUser` disponível

**Fluxo Principal:**

1. Admin modifica campos no formulário (nome, email ou telefone)
2. Nome é convertido para MAIÚSCULAS automaticamente no `onChange`
3. Admin clica "Salvar Alterações"
4. `saving` definido como `true`
5. Obtém `idToken` via `auth.currentUser.getIdToken()`
6. `PUT /api/consultants/{id}` com payload: `{ name: formData.name, email: formData.email.toLowerCase(), phone: formData.phone }`
7. API route atualiza documento no Firestore
8. Toast sucesso: "Consultor atualizado com sucesso!"
9. `loadConsultant()` recarrega dados atualizados
10. `saving` volta para `false`

**Fluxo Alternativo - Erro na atualização:**

1. API retorna erro
2. Toast destructive: "Erro ao atualizar consultor: {message}"
3. `saving` volta para `false`

**Pós-condições:**

- Dados do consultor atualizados no Firestore
- Interface reflete novos valores

**Regra de Negócio:** RN-002, RN-003

---

### 4.3 UC-003: Copiar Código do Consultor

**Ator:** System Admin
**Pré-condições:**

- Consultor carregado com sucesso
- Navegador suporta Clipboard API

**Fluxo Principal:**

1. Admin clica botão "Copiar Código"
2. `navigator.clipboard.writeText(consultant.code)` copia código
3. Toast sucesso: "Código copiado para a área de transferência!"

**Fluxo Alternativo - Clipboard API não disponível:**

1. Erro ao copiar
2. Toast destructive: "Erro ao copiar código"

**Pós-condições:**

- Código do consultor copiado para clipboard

**Regra de Negócio:** N/A

---

### 4.4 UC-004: Navegar para Clínica Vinculada

**Ator:** System Admin
**Pré-condições:**

- Consultor possui clínicas vinculadas (`authorized_tenants.length > 0`)

**Fluxo Principal:**

1. Admin clica botão "Ver Clínica" em um item da lista
2. `router.push("/admin/tenants/{tenantId}")` navega para detalhes do tenant

**Pós-condições:**

- Navegação para página de detalhes do tenant

**Regra de Negócio:** N/A

---

### 4.5 UC-005: Voltar para Lista de Consultores

**Ator:** System Admin
**Pré-condições:**

- Página carregada

**Fluxo Principal:**

1. Admin clica botão "Voltar" no topo da página
2. `router.push("/admin/consultants")` navega para lista

**Pós-condições:**

- Navegação para lista de consultores

**Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│         DETALHES DO CONSULTOR (/admin/consultants/[id])          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ useEffect mount  │
                    │ loadConsultant() │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ getIdToken()     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ GET /api/        │
                    │ consultants/{id} │
                    │ Bearer token     │
                    └──────────────────┘
                         │         │
                    Sucesso     Erro
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────┐
              │ setConsultant│  │ Toast erro   │
              │ setFormData  │  │ Redirect     │
              │ setLoading   │  │ /consultants │
              │ (false)      │  └──────────────┘
              └──────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │ RENDER: 4 Cards                │
         │ ┌─────────────────────────┐    │
         │ │ Card: Código            │    │
         │ │ [Código] [Copiar]       │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Informações       │    │
         │ │ Criado/Atualizado/Clín. │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Editar Dados      │    │
         │ │ Form: Nome/Email/Tel    │    │
         │ │ [Salvar Alterações]     │    │
         │ └─────────────────────────┘    │
         │ ┌─────────────────────────┐    │
         │ │ Card: Clínicas Vinc.    │    │
         │ │ Lista de tenants        │    │
         │ └─────────────────────────┘    │
         └────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    [Copiar]    [Salvar]    [Ver Clínica]
         │            │            │
         ▼            ▼            ▼
  ┌──────────┐ ┌──────────────┐ ┌──────────┐
  │ clipboard│ │ PUT /api/    │ │ router   │
  │ .write   │ │ consultants  │ │ .push    │
  │ Text()   │ │ /{id}        │ │ /tenants │
  └──────────┘ └──────────────┘ └──────────┘
         │            │
         ▼            ▼
  ┌──────────┐ ┌──────────────┐
  │ Toast OK │ │ Sucesso?     │
  └──────────┘ │ Sim      Não │
               ▼          ▼
        ┌──────────┐ ┌──────────┐
        │ Toast OK │ │ Toast    │
        │ Reload   │ │ erro     │
        └──────────┘ └──────────┘
```

---

## 6. Regras de Negócio

### RN-001: Código Imutável

**Descrição:** O código do consultor (6 dígitos) é gerado no cadastro e não pode ser alterado.
**Aplicação:** Campo exibido apenas para visualização e cópia, sem input editável
**Exceções:** Nenhuma
**Justificativa:** Código é usado como identificador único para vincular consultor a clínicas

### RN-002: Nome em MAIÚSCULAS

**Descrição:** O nome do consultor é sempre armazenado em MAIÚSCULAS.
**Aplicação:** Conversão automática no `handleChange` via `value.toUpperCase()`
**Exceções:** Nenhuma
**Justificativa:** Padronização visual e consistência com outros cadastros do sistema

### RN-003: Email em Lowercase

**Descrição:** O email é sempre armazenado em lowercase para evitar duplicatas por case sensitivity.
**Aplicação:** Conversão no envio via `formData.email.toLowerCase()`
**Exceções:** Nenhuma
**Justificativa:** Emails são case-insensitive por padrão, lowercase evita duplicatas

### RN-004: Telefone Formatado

**Descrição:** Telefone é armazenado apenas com dígitos, mas exibido com máscara (00) 00000-0000.
**Aplicação:** Formatação na exibição, armazenamento sem formatação
**Exceções:** Nenhuma
**Justificativa:** Facilita validação e busca, mantém apresentação amigável

### RN-005: Clínicas Vinculadas Somente Leitura

**Descrição:** A lista de clínicas vinculadas não pode ser editada nesta página.
**Aplicação:** Exibição apenas dos IDs com botão de navegação
**Exceções:** Vinculação/desvinculação feita na página de detalhes do tenant
**Justificativa:** Separação de responsabilidades; tenant controla seus consultores

---

## 7. Estados da Interface

### 7.1 Estado: Carregando

**Quando:** `loading === true` (durante `loadConsultant`)
**Exibição:** Loader2 com animação spin centralizado, altura `h-96`
**Interações:** Nenhuma — toda a página substituída pelo spinner

### 7.2 Estado: Consultor Não Encontrado

**Quando:** API retorna 404
**Exibição:** Toast destructive + redirect automático para `/admin/consultants`
**Duração:** Momentânea antes do redirect

### 7.3 Estado: Dados Carregados

**Quando:** `loading === false`, `consultant !== null`
**Layout:**

```
[← Voltar]

┌─ Card: Código do Consultor (sky-50, border-sky-200) ─┐
│ [Código 6 dígitos]                    [Copiar Código]│
└───────────────────────────────────────────────────────┘

┌─ Card: Informações ───────────────────────────────────┐
│ Criado em: DD/MM/AAAA HH:MM                           │
│ Atualizado em: DD/MM/AAAA HH:MM                       │
│ Clínicas vinculadas: N [Building2]                    │
└───────────────────────────────────────────────────────┘

┌─ Card: Editar Dados ──────────────────────────────────┐
│ Nome Completo *        Email *                        │
│ [Input MAIÚSCULAS]     [Input]                        │
│                                                        │
│ Telefone                                              │
│ [Input formatado]                                     │
│                                                        │
│                        [💾 Salvar Alterações]         │
└───────────────────────────────────────────────────────┘

┌─ Card: Clínicas Vinculadas ───────────────────────────┐
│ [tenant_id_1]                      [Ver Clínica →]    │
│ [tenant_id_2]                      [Ver Clínica →]    │
│ ...                                                    │
│ (ou "Nenhuma clínica vinculada" se vazio)             │
└───────────────────────────────────────────────────────┘
```

### 7.4 Estado: Salvando

**Quando:** `saving === true`
**Exibição:** Botão "Salvar Alterações" muda para "Salvando..." com Loader2 spinner, fica `disabled`
**Campos:** Inputs do formulário ficam `disabled`

### 7.5 Badges de Status

| Status      | Variante      | Texto    |
| ----------- | ------------- | -------- |
| `active`    | `default`     | Ativo    |
| `suspended` | `destructive` | Suspenso |
| `inactive`  | `secondary`   | Inativo  |

---

## 8. Validações

### 8.1 Validações Frontend

| Campo    | Validação                   | Implementação           |
| -------- | --------------------------- | ----------------------- |
| Nome     | `required`                  | Atributo HTML no Input  |
| Email    | `required`, `type="email"`  | Atributos HTML no Input |
| Telefone | Nenhuma validação explícita | Aceita qualquer texto   |

### 8.2 Validações Backend (API Route)

- **Autenticação:** Verifica Bearer token válido
- **Autorização:** Verifica `is_system_admin === true`
- **Existência:** Verifica que consultor existe antes de atualizar
- **Campos obrigatórios:** Valida presença de name, email, phone

### 8.3 Validações de Permissão

- Layout admin verifica role `system_admin` antes de renderizar
- API route verifica token e claims antes de processar

---

## 9. Integrações

### 9.1 API Route — GET /api/consultants/{id}

- **Tipo:** Next.js API Route (server-side)
- **Método:** `GET`
- **Headers:** `Authorization: Bearer {idToken}`
- **Retorno Sucesso:** `{ success: true, data: Consultant }`
- **Retorno Erro:** `{ error: string }` com status 404/401/500

### 9.2 API Route — PUT /api/consultants/{id}

- **Tipo:** Next.js API Route (server-side)
- **Método:** `PUT`
- **Headers:** `Authorization: Bearer {idToken}`, `Content-Type: application/json`
- **Body:** `{ name: string, email: string, phone: string }`
- **Retorno Sucesso:** `{ success: true, message: string }`
- **Retorno Erro:** `{ error: string }` com status 400/401/404/500

### 9.3 Firebase Auth (Client)

- **`auth.currentUser.getIdToken()`:** Gera Bearer token para API routes

### 9.4 Clipboard API

- **`navigator.clipboard.writeText(code)`:** Copia código para clipboard

### 9.5 Next.js Router

- **`router.push("/admin/consultants")`:** Navegação para lista
- **`router.push("/admin/tenants/{id}")`:** Navegação para tenant

---

## 10. Segurança

### 10.1 Proteções Implementadas

- ✅ Autenticação via Bearer token em todas as API routes
- ✅ Verificação de role `system_admin` no backend
- ✅ Email convertido para lowercase (previne duplicatas)
- ✅ Código imutável (não pode ser alterado)
- ✅ Layout admin restringe acesso por role

### 10.2 Vulnerabilidades Conhecidas

- ⚠️ Telefone sem validação de formato (aceita qualquer texto)
- ⚠️ Sem validação de email único (pode criar duplicatas)
- ⚠️ Clínicas vinculadas exibem apenas IDs (não nomes) — possível exposição de IDs internos
- **Mitigação:** API routes validam dados antes de salvar

### 10.3 Dados Sensíveis

- **Email:** Exibido em texto plano
- **Telefone:** Exibido em texto plano
- **Código:** Exibido em texto plano (mas é público por natureza)

---

## 11. Performance

### 11.1 Métricas

- **Carregamento:** 1 requisição HTTP (GET consultor)
- **Salvamento:** 1 requisição HTTP (PUT consultor) + 1 reload (GET)
- **Tamanho do componente:** ~300 linhas

### 11.2 Otimizações Implementadas

- ✅ Carregamento único ao montar
- ✅ Reload apenas após salvamento bem-sucedido
- ✅ Conversões de texto (uppercase, lowercase) feitas client-side

### 11.3 Gargalos Identificados

- ⚠️ Reload completo após salvamento (poderia atualizar estado local)
- ⚠️ Sem cache de dados do consultor

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG

- **Nível:** Parcial (não auditado formalmente)

### 12.2 Recursos Implementados

- ✅ Labels em todos os inputs (`<Label htmlFor>`)
- ✅ Campos obrigatórios marcados com asterisco
- ✅ Botões com texto descritivo
- ✅ Cards com títulos e descrições semânticas

### 12.3 Melhorias Necessárias

- [ ] `aria-label` no botão "Copiar Código"
- [ ] Feedback de loading para screen readers
- [ ] Anúncio de sucesso/erro via `aria-live`

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| #     | Cenário                              | Tipo | Status   |
| ----- | ------------------------------------ | ---- | -------- |
| T-001 | Carregar consultor existente         | E2E  | Pendente |
| T-002 | Consultor não encontrado → redirect  | E2E  | Pendente |
| T-003 | Editar nome (conversão uppercase)    | E2E  | Pendente |
| T-004 | Editar email (conversão lowercase)   | E2E  | Pendente |
| T-005 | Copiar código para clipboard         | E2E  | Pendente |
| T-006 | Navegar para clínica vinculada       | E2E  | Pendente |
| T-007 | Salvar com campos vazios (validação) | E2E  | Pendente |

### 13.2 Cenários de Erro

- API indisponível durante carregamento
- Token expirado durante salvamento
- Consultor deletado entre carregamento e salvamento

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades

- [ ] Editar status do consultor (ativar/suspender)
- [ ] Histórico de alterações
- [ ] Adicionar/remover clínicas vinculadas inline
- [ ] Exibir nomes das clínicas (não apenas IDs)

### 14.2 UX/UI

- [ ] Validação inline de email
- [ ] Máscara de telefone em tempo real
- [ ] Confirmação antes de salvar
- [ ] Atualização otimista (sem reload)

### 14.3 Performance

- [ ] Cache de dados do consultor
- [ ] Atualização local após salvamento

### 14.4 Segurança

- [ ] Validação de formato de telefone
- [ ] Verificação de email único
- [ ] Rate limiting nas API routes

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas

| Página                   | Relação                           |
| ------------------------ | --------------------------------- |
| `/admin/consultants`     | Lista de consultores (página pai) |
| `/admin/consultants/new` | Criação de novo consultor         |
| `/admin/tenants/{id}`    | Detalhes do tenant vinculado      |

### 15.2 Fluxos Relacionados

- **Lista → Detalhe → Edição:** Fluxo principal de navegação
- **Detalhe → Tenant:** Navegação para clínicas vinculadas

### 15.3 Impacto de Mudanças

- Alterar interface `Consultant` impacta esta página e API routes
- Alterar lógica de vinculação afeta lista de clínicas exibida

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura

- **API Routes para CRUD:** Todas operações passam por API routes com autenticação
- **Conversões client-side:** Uppercase/lowercase feitas no cliente antes de enviar
- **Reload após salvamento:** Garante dados sincronizados, mas menos eficiente

### 16.2 Padrões Utilizados

- **Client Component:** `"use client"` para interatividade
- **Controlled form:** Estado via `formData` com spread updates
- **Bearer token:** Autenticação via header Authorization
- **Toast feedback:** Notificações via `useToast`

### 16.3 Limitações Conhecidas

- Clínicas vinculadas mostram apenas IDs (não nomes)
- Sem validação de formato de telefone
- Reload completo após salvamento

### 16.4 Notas de Implementação

- Nome convertido para uppercase no `onChange` (linha ~XX)
- Email convertido para lowercase no envio (linha ~XX)
- Código exibido com estilo sky-700, font-mono, tracking-widest

---

## 17. Histórico de Mudanças

| Data       | Versão | Autor              | Descrição                                               |
| ---------- | ------ | ------------------ | ------------------------------------------------------- |
| 07/02/2026 | 1.0    | Engenharia Reversa | Documentação inicial                                    |
| 10/02/2026 | 1.1    | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções) |

---

## 18. Glossário

| Termo                   | Definição                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Consultor Rennova**   | Usuário especial que pode acessar múltiplas clínicas sem pertencer a um tenant específico |
| **Código do Consultor** | Identificador único de 6 dígitos gerado no cadastro                                       |
| **Clínicas Vinculadas** | Tenants que autorizaram o consultor a acessar seus dados                                  |
| **Bearer Token**        | Token JWT usado para autenticação em API routes                                           |

---

## 19. Referências

### 19.1 Documentação Relacionada

- [Consultants List](./consultants-list-documentation.md) — Lista de consultores
- [Consultants New](./consultants-new-documentation.md) — Criação de consultor
- [Tenants Detail](./tenants-detail-documentation.md) — Detalhes do tenant

### 19.2 Código Fonte

- `src/app/(admin)/admin/consultants/[id]/page.tsx` — Componente principal
- `src/app/api/consultants/[id]/route.ts` — API routes GET/PUT
- `src/types/index.ts` — Interface Consultant

---

## 20. Anexos

### 20.1 Exemplo de Payload de Atualização

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
  "data": {
    "id": "abc123",
    "code": "123456",
    "name": "JOÃO SILVA CONSULTOR",
    "email": "joao@rennova.com.br",
    "phone": "11987654321",
    "status": "active",
    "authorized_tenants": ["tenant1", "tenant2"],
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-02-10T14:30:00Z"
  }
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 10/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
