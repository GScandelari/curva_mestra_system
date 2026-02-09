# Documentação Experimental - Edição de Documento Legal

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Edição de Documento Legal (`/admin/legal-documents/[id]/edit`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário de edição de documento legal existente. Estruturalmente idêntico ao formulário de criação (`/admin/legal-documents/new`), mas carrega dados existentes via `getDoc` e atualiza via `updateDoc` em vez de `addDoc`. Se o status for "ativo" ao salvar, `published_at` é atualizado com `serverTimestamp()`. Suporta edição de título (com regeneração de slug), conteúdo Markdown, versão, status, ordem e flags de obrigatoriedade.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/legal-documents/[id]/edit/page.tsx` (363 linhas)
- **Rota:** `/admin/legal-documents/{id}/edit`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)
- **Parâmetro dinâmico:** `[id]` — ID do documento no Firestore

### 1.2 Dependências Principais
- **Firestore:** `getDoc`, `updateDoc`, `serverTimestamp`, `doc` — coleção `legal_documents`
- **Firebase Auth:** `auth.currentUser` para verificação de autenticação
- **Types:** `LegalDocument`, `DocumentStatus` de `src/types`
- **UI:** Card, Input, Label, Textarea, Switch, Select, Button (shadcn/ui)
- **Ícones:** FileText, Save, Loader2, ArrowLeft (lucide-react)
- **Hooks:** `useToast`, `useRouter`, `useParams`

---

## 2. Tipos de Usuários / Atores

| Ator | Permissão | Descrição |
|------|-----------|-----------|
| `system_admin` | Acesso total | Único role que acessa esta página. Pode editar qualquer documento legal |
| `clinic_admin` | Sem acesso | Não tem acesso a esta página |
| `clinic_user` | Sem acesso | Não tem acesso a esta página |
| `clinic_consultant` | Sem acesso | Não tem acesso a esta página |

---

## 3. Estrutura de Dados

### 3.1 Estado do Formulário (formData)
```typescript
// Partial<LegalDocument> — inicializado vazio, preenchido via getDoc
{
  title: "",                           // Preenchido do documento existente
  slug: "",                            // Preenchido do documento existente
  content: "",                         // Markdown existente
  version: "1.0",                      // Versão atual
  status: "rascunho",                  // Status atual
  required_for_registration: false,
  required_for_existing_users: false,
  order: 1,
}
// Após loadDocument: todos os campos sobrescritos com dados do Firestore
```

### 3.2 Dados Enviados na Atualização — updateDoc
```typescript
{
  title: string;
  slug: string;                        // formData.slug || generateSlug(title)
  content: string;
  version: string;
  status: DocumentStatus;
  required_for_registration: boolean;
  required_for_existing_users: boolean;
  order: number;
  updated_at: FieldValue;             // serverTimestamp()
  published_at?: FieldValue;          // serverTimestamp() — APENAS se status === "ativo"
}
```

### 3.3 Diferenças em Relação à Criação (New)
| Aspecto | New (`addDoc`) | Edit (`updateDoc`) |
|---------|----------------|---------------------|
| Carregamento | Nenhum (formulário vazio) | `getDoc` para preencher formulário |
| Operação Firestore | `addDoc` (cria novo documento) | `updateDoc` (atualiza existente) |
| Campos automáticos | `created_by`, `created_at`, `updated_at` | `updated_at` apenas |
| Published At | Setado se status "ativo" ao criar | Atualizado se status "ativo" ao salvar |
| Slug inicial | Vazio, gerado ao digitar título | Preenchido com valor existente |
| Botão principal | "Salvar Documento" | "Salvar Alterações" |
| Título da página | "Novo Documento Legal" | "Editar Documento Legal" |
| Descrição | "Crie um novo documento legal..." | "Atualize as informações do documento" |

---

## 4. Casos de Uso

### UC-001: Carregar Documento para Edição
- **Ator:** system_admin
- **Pré-condições:** ID do documento na URL, documento existente no Firestore
- **Fluxo Principal:**
  1. Página carrega, extrai `id` de `useParams()`
  2. `getDoc(doc(db, "legal_documents", id))`
  3. Se documento existe: `setFormData({ id: docSnap.id, ...docSnap.data() })`
  4. Formulário preenchido com dados existentes
- **Fluxo Alternativo:**
  - Documento não encontrado: toast "Documento não encontrado" → redirect `/admin/legal-documents`
  - Erro na query: toast destructive com `error.message`
- **Pós-condições:** Formulário preenchido com dados do documento
- **Regra de Negócio:** N/A

### UC-002: Editar e Salvar Documento
- **Ator:** system_admin
- **Pré-condições:** Documento carregado no formulário, `auth.currentUser` disponível
- **Fluxo Principal:**
  1. Admin modifica campos desejados
  2. Se título alterado, slug é regenerado automaticamente
  3. Admin clica "Salvar Alterações"
  4. Validações: título, conteúdo, versão não vazios
  5. Monta `updateData` com campos explícitos (não usa spread do formData)
  6. Se `status === "ativo"`: inclui `published_at: serverTimestamp()`
  7. `updateDoc(docRef, updateData)`
  8. Toast: "Documento atualizado com sucesso"
  9. Navegação para `/admin/legal-documents`
- **Fluxo Alternativo:**
  - Campo obrigatório vazio: toast destructive, formulário não submetido
  - Usuário não autenticado: toast "Você precisa estar autenticado"
  - Erro no Firestore: toast destructive com `error.message`
- **Pós-condições:** Documento atualizado no Firestore
- **Regra de Negócio:** RN-001, RN-002, RN-003

### UC-003: Cancelar Edição
- **Ator:** system_admin
- **Pré-condições:** Formulário aberto
- **Fluxo Principal:**
  1. Admin clica "Voltar" ou "Cancelar"
  2. `router.push("/admin/legal-documents")` — sem confirmação
- **Pós-condições:** Alterações não salvas são perdidas
- **Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

### 5.1 Carregamento e Edição
```
[Página Carrega]
       │
       ▼
[useParams() → { id }]
       │
       ▼
[loading = true, Loader2 spinner]
       │
       ▼
[getDoc(legal_documents/{id})]
       │
  ┌────┴────┐
  ▼         ▼
[Existe]  [Não existe]
  │         │
  ▼         ▼
[setFormData(data)]  [toast + redirect]
  │
  ▼
[loading = false]
  │
  ▼
[Formulário exibido com dados]
  │
  ▼
[Admin edita campos]
  │
  ▼
[Clica "Salvar Alterações"]
  │
  ▼
[auth.currentUser?] ── Não → toast erro
  │ Sim
  ▼
[Validações título/conteúdo/versão]
  │ Falha → toast erro por campo
  │ OK
  ▼
[Monta updateData (campos explícitos)]
  │
  ▼
[status === "ativo"?]
  │ Sim → adiciona published_at
  │ Não → não inclui published_at
  ▼
[updateDoc(legal_documents/{id}, updateData)]
  │
  ┌────┴────┐
  ▼         ▼
[Sucesso]  [Erro]
  │          │
  ▼          ▼
[toast     [toast "Erro ao salvar"]
"Sucesso"]
  │
  ▼
[router.push("/admin/legal-documents")]
```

---

## 6. Regras de Negócio

### RN-001: Published At Atualizado Condicionalmente
- **Descrição:** O campo `published_at` é atualizado com `serverTimestamp()` sempre que o status for "ativo" no momento do save.
- **Aplicação:** `if (formData.status === "ativo") { updateData.published_at = serverTimestamp() }`.
- **Exceções:** Se o status já era "ativo" e permanece "ativo", `published_at` é sobrescrito a cada save. Se o status muda de "ativo" para "rascunho"/"inativo", `published_at` anterior NÃO é removido (permanece com o valor antigo).
- **Justificativa:** Registrar última publicação. Nota: pode-se argumentar que `published_at` deveria ser preservado se já "ativo", mas o comportamento atual sobrescreve.

### RN-002: Campos Explícitos no updateData
- **Descrição:** A atualização não usa spread do formData (diferente da criação). Cada campo é listado explicitamente.
- **Aplicação:** `updateData` montado com 8 campos nomeados + `updated_at` + `published_at` condicional.
- **Exceções:** Campos como `created_by`, `created_at` não são sobrescritos (mantidos do documento original).
- **Justificativa:** Preservar campos originais (criador, data de criação) e evitar sobrescrita acidental.

### RN-003: Regeneração de Slug ao Editar Título
- **Descrição:** Ao alterar o título, o slug é regenerado automaticamente com o mesmo algoritmo da criação.
- **Aplicação:** `handleTitleChange` → `generateSlug(title)` → atualiza `formData.slug`.
- **Exceções:** Se o admin havia editado o slug manualmente, a edição do título sobrescreve o slug customizado. No save, fallback: `formData.slug || generateSlug(formData.title!)`.
- **Justificativa:** Manter slug sincronizado com título. Efeito colateral: editar título apaga customizações de slug.

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
- **Quando:** `loading === true`
- **Exibição:** Loader2 spinner centralizado, altura `h-96`

### 7.2 Estado: Formulário Carregado
- **Quando:** `loading === false`, documento carregado com sucesso
- **Layout:** Idêntico ao formulário de criação, com valores preenchidos
- **Diferenças visuais:** Título "Editar Documento Legal", descrição "Atualize as informações do documento", botão "Salvar Alterações"

### 7.3 Estado: Salvando
- **Quando:** `saving === true`
- **Exibição:** Botão "Salvar Alterações" substituído por "Salvando..." com Loader2 spinner, disabled

### 7.4 Campos do Formulário
Mesma estrutura da página de criação:

| Campo | Componente | ID | Obrigatório | Default (edit) |
|-------|------------|-----|-------------|----------------|
| Título | Input | `title` | Sim (*) | Valor existente |
| Slug | Input | `slug` | Não | Valor existente |
| Versão | Input | `version` | Sim (*) | Valor existente |
| Status | Select | `status` | Sim | Valor existente |
| Ordem | Input number | `order` | Não | Valor existente |
| Conteúdo | Textarea | `content` | Sim (*) | Valor existente |
| Obrig. cadastro | Switch | `required_registration` | — | Valor existente |
| Obrig. existentes | Switch | `required_existing` | — | Valor existente |

---

## 8. Validações

### 8.1 Validações Frontend
| Campo | Validação | Mensagem (toast destructive) |
|-------|-----------|------------------------------|
| Auth | `auth.currentUser` deve existir | "Você precisa estar autenticado" |
| Título | `!formData.title?.trim()` | "O título é obrigatório" |
| Conteúdo | `!formData.content?.trim()` | "O conteúdo é obrigatório" |
| Versão | `!formData.version?.trim()` | "A versão é obrigatória" |
| Ordem | `parseInt(value) \|\| 1` (fallback) | Sem mensagem |

### 8.2 Validações Backend
- Firestore Security Rules controlam acesso por role

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin`
- `auth.currentUser` verificado antes de submissão

### 8.4 Validações Ausentes
- Sem verificação de conflitos de edição (outro admin editando simultaneamente)
- Sem validação de slug único
- Sem confirmação ao sair com alterações não salvas
- Sem verificação de que `published_at` anterior deveria ser preservado ao salvar como "ativo"

---

## 9. Integrações

### 9.1 Firestore
- **`getDoc(doc(db, "legal_documents", documentId))`:** Leitura do documento existente
- **`updateDoc(docRef, updateData)`:** Atualização do documento
- **`serverTimestamp()`:** Para `updated_at` e `published_at` (condicional)

### 9.2 Firebase Auth (Client)
- **`auth.currentUser`:** Verificação de autenticação antes de salvar

### 9.3 Navegação (Next.js Router)
- **De:** `/admin/legal-documents` (lista) ou `/admin/legal-documents/{id}` (detalhe)
- **Voltar/Cancelar:** → `/admin/legal-documents`
- **Após sucesso:** → `/admin/legal-documents`

### 9.4 Toast (useToast)
- **Sucesso:** "Documento atualizado com sucesso"
- **Erro de validação:** Mensagens específicas por campo (destructive)
- **Erro de autenticação:** "Você precisa estar autenticado" (destructive)
- **Erro de carregamento:** "Erro ao carregar documento" + `error.message` (destructive)
- **Documento não encontrado:** "Documento não encontrado" (destructive)
- **Erro de save:** "Erro ao salvar" + `error.message` (destructive)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- Verificação de `auth.currentUser` antes de salvar
- Layout admin restringe acesso por role
- Timestamps via `serverTimestamp()` (não manipuláveis pelo client)
- Campos explícitos no `updateData` (não usa spread, preserva `created_by`/`created_at`)

### 10.2 Vulnerabilidades / Pontos de Atenção
- **Sem sanitização de Markdown:** Conteúdo salvo sem sanitização, depende da renderização segura no lado de leitura
- **Sem validação de slug único:** Edição pode criar slug duplicado
- **Sem controle de concorrência:** Dois admins podem editar simultaneamente, último save ganha
- **published_at sobrescrito a cada save:** Se o documento já era "ativo", `published_at` é atualizado desnecessariamente
- **`updateData` tipado como `any`:** Linha 134 — sem type safety na construção dos dados de atualização

### 10.3 Dados Sensíveis
- Nenhum dado sensível manipulado nesta página

---

## 11. Performance

### 11.1 Métricas Esperadas
- **Carregamento:** 1 read Firestore (getDoc)
- **Salvamento:** 1 write Firestore (updateDoc)

### 11.2 Otimizações Atuais
- Carregamento único do documento
- Update parcial (apenas campos necessários, não sobrescreve documento inteiro)

### 11.3 Gargalos Identificados
- Nenhum gargalo significativo

---

## 12. Acessibilidade

### 12.1 WCAG
- Todos os campos possuem `<Label htmlFor>` com IDs correspondentes
- Campos obrigatórios marcados com asterisco vermelho
- Switch com label e descrição auxiliar

### 12.2 Recursos Implementados
- Mesma estrutura acessível da página de criação
- Labels, help texts, Select com Radix UI

### 12.3 Melhorias Necessárias
- Sem validação visual inline (apenas toast)
- Sem `aria-required` nos campos obrigatórios
- Sem confirmação ao sair com alterações não salvas

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Carregar documento existente no formulário | E2E | Pendente |
| T-002 | Documento não encontrado → redirect | E2E | Pendente |
| T-003 | Editar título e verificar regeneração de slug | E2E | Pendente |
| T-004 | Salvar com status "ativo" → published_at atualizado | Integração | Pendente |
| T-005 | Salvar com status "rascunho" → published_at NÃO incluído | Integração | Pendente |
| T-006 | Validação de campos obrigatórios | Unitário | Pendente |
| T-007 | Verificar que created_by/created_at não são sobrescritos | Integração | Pendente |
| T-008 | Cancelar edição sem salvar | E2E | Pendente |
| T-009 | Alternar switches de obrigatoriedade | E2E | Pendente |

### 13.2 Cenários de Erro
- Documento deletado entre carregamento e save
- Conflito de edição simultânea
- Firestore indisponível
- Token de autenticação expirado

### 13.3 Testes de Integração
- Verificar que `updateDoc` é chamado com campos corretos
- Verificar que `published_at` é incluído apenas quando status "ativo"
- Verificar preservação de `created_by` e `created_at`

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Controle de concorrência (optimistic locking com versão)
- [ ] Comparação visual antes/depois (diff)
- [ ] Preview de Markdown em tempo real
- [ ] Histórico de edições do documento
- [ ] Confirmação ao sair com alterações não salvas

### 14.2 UX/UI
- [ ] Validação inline com mensagens junto aos campos
- [ ] Indicador de campos modificados (dirty state)
- [ ] Preservar `published_at` se status já era "ativo"
- [ ] Aviso ao mudar status de "ativo" para "rascunho/inativo"

### 14.3 Performance
- Nenhuma otimização necessária

### 14.4 Segurança
- [ ] Sanitização de conteúdo Markdown
- [ ] Validação de slug único
- [ ] Tipar `updateData` adequadamente (em vez de `any`)
- [ ] Registro de auditoria (quem editou, quando, o que mudou)

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/legal-documents` | Navegação de volta (Voltar, Cancelar, após sucesso) |
| `/admin/legal-documents/{id}` | Navegação "Editar" vem desta página |
| `/admin/legal-documents/new` | Página irmã com formulário idêntico para criação |

### 15.2 Fluxos Relacionados
- **Lista → Detalhe → Edição → Lista:** Fluxo de navegação principal
- **Lista → Edição → Lista:** Fluxo direto (botão Edit na lista)

### 15.3 Impacto de Mudanças
- Alterar interface `LegalDocument` impacta formulário e `updateData`
- Alterar coleção `legal_documents` impacta getDoc e updateDoc
- Alterar algoritmo de slug impacta consistência entre criação e edição

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Código duplicado com criação:** O formulário é essencialmente o mesmo da página de criação (mesmos campos, mesma estrutura, mesma geração de slug). Poderia ser extraído para um componente compartilhado.
- **Campos explícitos no update:** Diferente da criação (que usa spread), a edição lista cada campo explicitamente. Isso preserva `created_by`/`created_at` mas cria manutenção duplicada.
- **published_at sem comparação:** Não verifica se o status anterior já era "ativo". Sempre sobrescreve se status final é "ativo".

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para interatividade
- **Dynamic route:** `[id]` no path com `useParams()`
- **Controlled form:** Estado via `formData` com spread updates
- **Early return validation:** Validações sequenciais antes do save
- **Early return loading:** `if (loading)` antes do JSX principal

### 16.3 Limitações Conhecidas
- Código duplicado com página de criação (~80% similar)
- Sem detecção de alterações (unsaved changes)
- Sem controle de concorrência
- Slug customizado é perdido ao editar título
- `published_at` é sobrescrito desnecessariamente se já "ativo"

### 16.4 Notas de Implementação
- **Linha 31:** `params.id as string` — cast direto sem validação
- **Linha 56:** Preenche formData com spread: `{ id: docSnap.id, ...docSnap.data() }` — inclui TODOS os campos do Firestore (incluindo timestamps)
- **Linha 134:** `updateData: any` — sem type safety
- **Linha 147-149:** `published_at` condicional: apenas quando status "ativo"
- **Linhas 84-90:** `handleTitleChange` regenera slug — sobrescreve customizações

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções). Adicionados tabela comparativa com criação, fluxo ASCII, regras de negócio expandidas, análise de concorrência e duplicação de código. |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **updateDoc** | Função Firestore que atualiza campos específicos de um documento existente (merge parcial) |
| **Optimistic locking** | Técnica de controle de concorrência que usa um campo de versão para detectar edições simultâneas |
| **Dirty state** | Estado do formulário quando há alterações não salvas em relação aos dados originais |
| **Slug** | Identificador amigável para URL derivado do título |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Legal Documents List](./legal-documents-list-documentation.md) — Lista de documentos
- [Legal Documents New](./legal-documents-new-documentation.md) — Criação de documento (formulário irmão)
- [Legal Documents Detail](./legal-documents-detail-documentation.md) — Visualização de documento

### 19.2 Código Fonte
- `src/app/(admin)/admin/legal-documents/[id]/edit/page.tsx` — Componente principal (363 linhas)
- `src/app/(admin)/admin/legal-documents/new/page.tsx` — Página irmã de criação (310 linhas)
- `src/types/index.ts` — Interfaces `LegalDocument`, `DocumentStatus`

### 19.3 Links Externos
- [Firestore updateDoc](https://firebase.google.com/docs/firestore/manage-data/add-data#update-data)
- [Firestore serverTimestamp](https://firebase.google.com/docs/firestore/manage-data/add-data#server_timestamp)

---

## 20. Anexos

### 20.1 Exemplo de updateData Enviado ao Firestore
```json
{
  "title": "Termos de Uso - Atualizado",
  "slug": "termos-de-uso-atualizado",
  "content": "# Termos de Uso\n\n## 1. Novos Termos...",
  "version": "2.0",
  "status": "ativo",
  "required_for_registration": true,
  "required_for_existing_users": true,
  "order": 1,
  "updated_at": "<serverTimestamp>",
  "published_at": "<serverTimestamp>"
}
```

### 20.2 Campos Preservados (não incluídos no updateData)
```json
{
  "created_by": "admin_uid_original",
  "created_at": "2026-01-15T10:00:00Z"
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
