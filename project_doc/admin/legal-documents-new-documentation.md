# Documentação Experimental - Novo Documento Legal

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Criação de Documento Legal (`/admin/legal-documents/new`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Formulário para criação de novos documentos legais (Termos de Uso, Política de Privacidade, etc.). Suporta conteúdo em Markdown, geração automática de slug a partir do título (com normalização Unicode), controle de versão, seleção de status (rascunho/ativo/inativo), definição de ordem de exibição e flags de obrigatoriedade para novos e existentes usuários.

### 1.1 Localização

- **Arquivo:** `src/app/(admin)/admin/legal-documents/new/page.tsx` (310 linhas)
- **Rota:** `/admin/legal-documents/new`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)

### 1.2 Dependências Principais

- **Firestore:** `addDoc`, `serverTimestamp`, coleção `legal_documents`
- **Firebase Auth:** `auth.currentUser` para `created_by` (UID)
- **Types:** `LegalDocument`, `DocumentStatus` de `src/types`
- **UI:** Card, Input, Label, Textarea, Switch, Select, Button (shadcn/ui)
- **Ícones:** FileText, Save, Loader2, ArrowLeft (lucide-react)
- **Hooks:** `useToast` de `src/hooks/use-toast`

---

## 2. Tipos de Usuários / Atores

| Ator                | Permissão    | Descrição                                                       |
| ------------------- | ------------ | --------------------------------------------------------------- |
| `system_admin`      | Acesso total | Único role que acessa esta página. Pode criar documentos legais |
| `clinic_admin`      | Sem acesso   | Não tem acesso a esta página                                    |
| `clinic_user`       | Sem acesso   | Não tem acesso a esta página                                    |
| `clinic_consultant` | Sem acesso   | Não tem acesso a esta página                                    |

---

## 3. Estrutura de Dados

### 3.1 Estado do Formulário (formData)

```typescript
// Partial<LegalDocument> com valores iniciais
{
  title: "",                           // string — campo obrigatório
  slug: "",                            // string — gerado automaticamente do título
  content: "",                         // string — Markdown, campo obrigatório
  version: "1.0",                      // string — campo obrigatório, default "1.0"
  status: "rascunho",                  // DocumentStatus — default "rascunho"
  required_for_registration: false,    // boolean — default false
  required_for_existing_users: false,  // boolean — default false
  order: 1,                            // number — default 1, min 1
}
```

### 3.2 Documento Criado no Firestore — legal_documents/{auto-id}

```typescript
{
  // Campos do formulário
  title: string;
  slug: string; // Gerado ou editado manualmente
  content: string; // Markdown
  version: string;
  status: DocumentStatus; // "rascunho" | "ativo" | "inativo"
  required_for_registration: boolean;
  required_for_existing_users: boolean;
  order: number;

  // Campos automáticos
  created_by: string; // auth.currentUser.uid
  created_at: FieldValue; // serverTimestamp()
  updated_at: FieldValue; // serverTimestamp()
  published_at: FieldValue | null; // serverTimestamp() se status === "ativo", null caso contrário
}
```

### 3.3 Interface de Referência — LegalDocument

```typescript
// src/types/index.ts
export type DocumentStatus = 'ativo' | 'inativo' | 'rascunho';

export interface LegalDocument {
  id: string;
  title: string;
  slug: string;
  content: string;
  version: string;
  status: DocumentStatus;
  required_for_registration: boolean;
  required_for_existing_users: boolean;
  order: number;
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;
}
```

---

## 4. Casos de Uso

### UC-001: Criar Documento Legal

- **Ator:** system_admin
- **Pré-condições:** Usuário autenticado com role system_admin, `auth.currentUser` disponível
- **Fluxo Principal:**
  1. Admin preenche o formulário: título (obrigatório), conteúdo Markdown (obrigatório), versão (obrigatório), status, ordem, flags de obrigatoriedade
  2. Slug é gerado automaticamente ao digitar o título (pode ser editado manualmente)
  3. Admin clica "Salvar Documento"
  4. Validações executadas: título, conteúdo, versão não vazios
  5. Documento criado via `addDoc(collection(db, "legal_documents"), docData)`
  6. Toast: "Sucesso — Documento criado com sucesso"
  7. Navegação para `/admin/legal-documents`
- **Fluxo Alternativo:**
  - Campo obrigatório vazio: toast destructive com mensagem específica, formulário não submetido
  - Usuário não autenticado: toast "Você precisa estar autenticado", formulário não submetido
  - Erro no Firestore: toast destructive com `error.message`
- **Pós-condições:** Documento criado no Firestore com timestamps automáticos
- **Regra de Negócio:** RN-001, RN-002, RN-003

### UC-002: Gerar Slug Automaticamente

- **Ator:** system_admin
- **Pré-condições:** Formulário aberto
- **Fluxo Principal:**
  1. Admin digita no campo "Título"
  2. A cada keystroke, `handleTitleChange` chama `generateSlug(title)`
  3. Slug atualizado automaticamente no campo correspondente
  4. Admin pode editar o slug manualmente após geração
- **Pós-condições:** Campo slug preenchido
- **Regra de Negócio:** RN-001

### UC-003: Cancelar Criação

- **Ator:** system_admin
- **Pré-condições:** Formulário aberto
- **Fluxo Principal:**
  1. Admin clica "Voltar" (header) ou "Cancelar" (footer)
  2. `router.push("/admin/legal-documents")` — sem confirmação
- **Pós-condições:** Navegação de volta para a lista, dados do formulário perdidos
- **Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

### 5.1 Fluxo de Criação

```
[Admin preenche formulário]
       │
       ▼
[Clica "Salvar Documento"]
       │
       ▼
[auth.currentUser existe?]
  │ Não → toast "Você precisa estar autenticado"
  │ Sim
  ▼
[título?.trim() vazio?]
  │ Sim → toast "O título é obrigatório"
  │ Não
  ▼
[conteúdo?.trim() vazio?]
  │ Sim → toast "O conteúdo é obrigatório"
  │ Não
  ▼
[versão?.trim() vazio?]
  │ Sim → toast "A versão é obrigatória"
  │ Não
  ▼
[setSaving(true)]
       │
       ▼
[Monta docData:]
  │ - ...formData (spread)
  │ - slug: formData.slug || generateSlug(title)
  │ - created_by: currentUser.uid
  │ - created_at: serverTimestamp()
  │ - updated_at: serverTimestamp()
  │ - published_at: status === "ativo" ? serverTimestamp() : null
  ▼
[addDoc(legal_documents, docData)]
       │
  ┌────┴────┐
  ▼         ▼
[Sucesso] [Erro]
  │         │
  ▼         ▼
[toast    [toast
"Sucesso"] "Erro ao salvar"]
  │         │
  ▼         ▼
[router.push  [setSaving(false)]
 "/admin/
 legal-docs"]
```

### 5.2 Algoritmo de Geração de Slug

```
[título: "Política de Privacidade 2.0"]
       │
       ▼
[.toLowerCase()]
  → "política de privacidade 2.0"
       │
       ▼
[.normalize("NFD")]
  → decomposição Unicode (separa acentos)
       │
       ▼
[.replace(/[\u0300-\u036f]/g, "")]
  → "politica de privacidade 2.0"  (remove diacríticos)
       │
       ▼
[.replace(/[^a-z0-9]+/g, "-")]
  → "politica-de-privacidade-2-0"
       │
       ▼
[.replace(/(^-|-$)/g, "")]
  → "politica-de-privacidade-2-0"  (remove hífens das pontas)
```

---

## 6. Regras de Negócio

### RN-001: Geração Automática de Slug

- **Descrição:** O slug é gerado automaticamente a partir do título usando normalização Unicode.
- **Aplicação:** `generateSlug(title)`: lowercase → NFD normalize → remove diacríticos ([\u0300-\u036f]) → substitui não-alfanuméricos por hífen → remove hífens nas extremidades.
- **Exceções:** Admin pode editar o slug manualmente após geração. Se slug ficar vazio, é regenerado do título no momento do save: `formData.slug || generateSlug(formData.title!)`.
- **Justificativa:** URLs amigáveis para documentos legais (ex: `/termos-de-uso`).

### RN-002: Published At Condicional

- **Descrição:** O campo `published_at` é preenchido automaticamente baseado no status do documento.
- **Aplicação:** Se `status === "ativo"` no momento do save, `published_at = serverTimestamp()`. Caso contrário, `published_at = null`.
- **Exceções:** Nenhuma. Mesmo que o documento seja criado como rascunho e depois ativado via edição, o `published_at` será definido na edição.
- **Justificativa:** Registrar quando o documento foi efetivamente publicado para auditoria.

### RN-003: Rastreabilidade de Criação

- **Descrição:** Todo documento criado registra o UID do criador e timestamps automáticos.
- **Aplicação:** `created_by: auth.currentUser.uid`, `created_at: serverTimestamp()`, `updated_at: serverTimestamp()`.
- **Exceções:** Se `auth.currentUser` for null, a criação é bloqueada antes de atingir este ponto.
- **Justificativa:** Auditoria e rastreabilidade.

### RN-004: Status Padrão "Rascunho"

- **Descrição:** Novos documentos são criados com status "rascunho" por padrão.
- **Aplicação:** Estado inicial: `status: "rascunho"`. Admin pode alterar para "ativo" ou "inativo" no formulário.
- **Exceções:** Nenhuma.
- **Justificativa:** Impedir publicação acidental de documentos incompletos.

### RN-005: Ordem Padrão e Mínima

- **Descrição:** O campo de ordem tem valor padrão 1 e mínimo 1.
- **Aplicação:** Input type="number" com `min="1"`. Fallback: `parseInt(e.target.value) || 1`.
- **Exceções:** Se o admin digitar valor inválido (ex: texto), converte para 1.
- **Justificativa:** Garantir que a ordem é sempre um número positivo válido.

---

## 7. Estados da Interface

### 7.1 Estado: Formulário Inicial

- **Quando:** Página carregada
- **Exibição:** Formulário com valores padrão (título vazio, versão "1.0", status "rascunho", ordem 1, switches desligados)
- **Layout:**
  - Header: botão "Voltar", ícone FileText, título "Novo Documento Legal", descrição
  - Card "Informações do Documento": campos do formulário
  - Footer: botões "Cancelar" e "Salvar Documento"

### 7.2 Estado: Salvando

- **Quando:** `saving === true`
- **Exibição:** Botão "Salvar Documento" substituído por "Salvando..." com Loader2 spinner
- **Botão:** Disabled durante salvamento

### 7.3 Campos do Formulário

| Campo             | Componente   | ID                      | Obrigatório | Placeholder            | Default    | Notas                            |
| ----------------- | ------------ | ----------------------- | ----------- | ---------------------- | ---------- | -------------------------------- |
| Título            | Input        | `title`                 | Sim (\*)    | "Ex: Termos de Uso"    | ""         | Atualiza slug automaticamente    |
| Slug              | Input        | `slug`                  | Não         | "Ex: termos-de-uso"    | ""         | Gerado auto, editável, help text |
| Versão            | Input        | `version`               | Sim (\*)    | "Ex: 1.0"              | "1.0"      | Grid 2 colunas (esquerda)        |
| Status            | Select       | `status`                | Sim         | —                      | "rascunho" | Grid 2 colunas (direita)         |
| Ordem             | Input number | `order`                 | Não         | —                      | 1          | min=1, help text                 |
| Conteúdo          | Textarea     | `content`               | Sim (\*)    | "Digite o conteúdo..." | ""         | 15 rows, font-mono, help text    |
| Obrig. cadastro   | Switch       | `required_registration` | —           | —                      | false      | Seção separada com border-t      |
| Obrig. existentes | Switch       | `required_existing`     | —           | —                      | false      | Com descrição auxiliar           |

### 7.4 Layout do Formulário

```
[Botão Voltar ←]
[FileText] Novo Documento Legal
Crie um novo documento legal para os usuários aceitarem

┌─ Card: Informações do Documento ─────────────┐
│                                                │
│ Título *          [___________________________]│
│ Slug              [___________________________]│
│                   Gerado automaticamente...     │
│ ┌─ Versão * ──────┐ ┌─ Status ───────────────┐│
│ │ [1.0          ]  │ │ [Rascunho       ▾]    ││
│ └──────────────────┘ └────────────────────────┘│
│ Ordem             [1                       ]   │
│                   Ordem em que aparecerá...     │
│ Conteúdo *                                     │
│ [                                          ]   │
│ [  ... textarea 15 linhas, font-mono ...   ]   │
│ [                                          ]   │
│                   Suporta Markdown...           │
│ ─────────────────────────────────────────────  │
│ Obrigatório no cadastro               [○    ] │
│ Novos usuários devem aceitar                   │
│ Obrigatório para existentes           [○    ] │
│ Usuários já cadastrados devem aceitar...       │
└────────────────────────────────────────────────┘

                        [Cancelar] [💾 Salvar Documento]
```

---

## 8. Validações

### 8.1 Validações Frontend

| Campo    | Validação                           | Mensagem (toast destructive)            |
| -------- | ----------------------------------- | --------------------------------------- |
| Auth     | `auth.currentUser` deve existir     | "Você precisa estar autenticado"        |
| Título   | `!formData.title?.trim()`           | "O título é obrigatório"                |
| Conteúdo | `!formData.content?.trim()`         | "O conteúdo é obrigatório"              |
| Versão   | `!formData.version?.trim()`         | "A versão é obrigatória"                |
| Ordem    | `parseInt(value) \|\| 1` (fallback) | Sem mensagem (converte silenciosamente) |

### 8.2 Validações Backend

- Firestore Security Rules controlam acesso por role
- Sem validação adicional no servidor (escrita direta via `addDoc`)

### 8.3 Validações de Permissão

- Layout admin verifica role `system_admin` antes de renderizar
- `auth.currentUser` verificado antes de submissão

### 8.4 Validações Ausentes

- Sem validação de slug único (possível duplicata)
- Sem validação de formato de versão (aceita qualquer string)
- Sem verificação de ordem duplicada
- Sem limite de tamanho para conteúdo Markdown
- Sem sanitização de conteúdo Markdown (XSS potencial na renderização)

---

## 9. Integrações

### 9.1 Firestore

- **`addDoc(collection(db, "legal_documents"), docData)`:** Criação do documento
- **`serverTimestamp()`:** Para `created_at`, `updated_at` e `published_at` (condicional)

### 9.2 Firebase Auth (Client)

- **`auth.currentUser`:** Verificação de autenticação e obtenção de UID para `created_by`

### 9.3 Navegação (Next.js Router)

- **De:** `/admin/legal-documents` (lista)
- **Para:** `/admin/legal-documents` (após salvar ou cancelar)

### 9.4 Toast (useToast)

- **Sucesso:** "Documento criado com sucesso"
- **Erro de validação:** Mensagens específicas por campo (destructive)
- **Erro de autenticação:** "Você precisa estar autenticado" (destructive)
- **Erro de Firestore:** `error.message` (destructive)

---

## 10. Segurança

### 10.1 Proteções Implementadas

- Verificação de `auth.currentUser` antes de salvar
- Layout admin restringe acesso por role
- `created_by` registra UID do criador (rastreabilidade)
- Timestamps via `serverTimestamp()` (não manipuláveis pelo client)

### 10.2 Vulnerabilidades / Pontos de Atenção

- **Sem sanitização de Markdown:** Conteúdo Markdown é salvo tal como digitado. Se renderizado sem sanitização, pode resultar em XSS.
- **Sem validação de slug único:** Dois documentos podem ter o mesmo slug, causando conflitos de rota.
- **Sem validação de versão:** Aceita qualquer string como versão (ex: "abc" é aceito).
- **Spread operator no docData:** `...formData` inclui todos os campos do estado, incluindo campos potencialmente undefined.

### 10.3 Dados Sensíveis

- Nenhum dado sensível manipulado nesta página. Conteúdo dos documentos legais é público por natureza.

---

## 11. Performance

### 11.1 Métricas Esperadas

- **Carregamento:** Instantâneo (sem query ao Firestore no load)
- **Salvamento:** 1 write ao Firestore (addDoc)

### 11.2 Otimizações Atuais

- Sem queries no carregamento (formulário inicializa vazio)
- Slug gerado client-side (sem round-trip)

### 11.3 Gargalos Identificados

- Nenhum gargalo identificado. Operação de escrita única.

---

## 12. Acessibilidade

### 12.1 WCAG

- Todos os campos possuem `<Label htmlFor>` com IDs correspondentes
- Campos obrigatórios marcados com asterisco vermelho (`text-destructive`)
- Switch com label e descrição auxiliar

### 12.2 Recursos Implementados

- Labels associados a todos os campos via `htmlFor`/`id`
- Help text em `text-muted-foreground` para slug, ordem e conteúdo
- Select com gestão de foco automática (Radix UI)
- Botão de salvar com estado visual de loading

### 12.3 Melhorias Necessárias

- Sem validação visual inline (erros exibidos apenas via toast)
- Sem `aria-required` nos campos obrigatórios (apenas asterisco visual)
- Sem `aria-describedby` ligando campos aos help texts
- Textarea sem `aria-label` adicional para Markdown

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| #     | Cenário                                         | Tipo       | Status   |
| ----- | ----------------------------------------------- | ---------- | -------- |
| T-001 | Criar documento com todos os campos preenchidos | E2E        | Pendente |
| T-002 | Validação de título obrigatório                 | Unitário   | Pendente |
| T-003 | Validação de conteúdo obrigatório               | Unitário   | Pendente |
| T-004 | Validação de versão obrigatória                 | Unitário   | Pendente |
| T-005 | Geração automática de slug                      | Unitário   | Pendente |
| T-006 | Slug com caracteres especiais e acentos         | Unitário   | Pendente |
| T-007 | Edição manual de slug após geração              | E2E        | Pendente |
| T-008 | Published_at definido quando status "ativo"     | Integração | Pendente |
| T-009 | Published_at null quando status "rascunho"      | Integração | Pendente |
| T-010 | Cancelar navegação sem salvar                   | E2E        | Pendente |
| T-011 | Ordem fallback para 1 com valor inválido        | Unitário   | Pendente |

### 13.2 Cenários de Erro

- Firestore indisponível no momento do save
- Usuário deslogado durante preenchimento
- Perda de conexão durante salvamento

### 13.3 Testes de Integração

- Verificar que documento é criado no Firestore com campos corretos
- Verificar que `created_by` contém UID do admin
- Verificar que timestamps são `serverTimestamp`

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades

- [ ] Preview do Markdown em tempo real (split view)
- [ ] Validação de slug único (verificar Firestore antes de salvar)
- [ ] Template de documentos (pré-preencher com estrutura padrão)
- [ ] Upload de arquivos/imagens para o conteúdo
- [ ] Versionamento automático (incrementar ao criar nova versão)

### 14.2 UX/UI

- [ ] Validação inline com mensagens junto aos campos (em vez de apenas toast)
- [ ] Confirmação ao sair com dados não salvos (unsaved changes)
- [ ] Autocompletar versão baseado em versões anteriores
- [ ] Contador de caracteres para conteúdo
- [ ] `aria-required` e `aria-describedby` nos campos

### 14.3 Performance

- Nenhuma otimização necessária

### 14.4 Segurança

- [ ] Sanitização de conteúdo Markdown antes de renderização
- [ ] Validação de formato de versão (semver)
- [ ] Rate limiting para criação de documentos
- [ ] Validação server-side dos campos via Cloud Function

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas

| Página                             | Relação                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `/admin/legal-documents`           | Navegação de volta (Voltar, Cancelar, após sucesso)       |
| `/admin/legal-documents/{id}`      | Visualização do documento criado                          |
| `/admin/legal-documents/{id}/edit` | Edição do documento criado                                |
| `/register`                        | Exibe documentos com `required_for_registration === true` |

### 15.2 Fluxos Relacionados

- **Lista → Novo → Lista:** Ciclo de navegação principal
- **Criação → Aceitação:** Documento criado como "ativo" + `required_for_registration` → visível no cadastro

### 15.3 Impacto de Mudanças

- Alterar interface `LegalDocument` impacta o estado do formulário
- Alterar coleção `legal_documents` impacta `addDoc`
- Alterar regras de slug impacta URLs de documentos em todo o sistema

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura

- **Estado como `Partial<LegalDocument>`:** Permite tipagem parcial para o formulário (campos opcionais durante preenchimento).
- **Slug editável:** Gerado automaticamente mas pode ser sobrescrito manualmente. No save, fallback: `formData.slug || generateSlug(formData.title!)`.
- **Toast para feedback:** Consistente com a página de lista (ambas usam `useToast`).
- **Sem preview:** Conteúdo Markdown sem preview em tempo real (apenas textarea simples).

### 16.2 Padrões Utilizados

- **Client Component:** `"use client"` para interatividade
- **Controlled form:** Todos os campos controlados via `formData` state
- **Spread update:** `setFormData({ ...formData, field: value })` para atualizações parciais
- **Early return validation:** Validações sequenciais com `return` antes do save
- **Layout padding:** `p-6` consistente com lista de documentos legais

### 16.3 Limitações Conhecidas

- Sem preview de Markdown
- Sem validação de slug único
- Sem confirmação ao sair com dados não salvos
- Sem validação de formato de versão
- Sem debounce na geração de slug (roda a cada keystroke)

### 16.4 Notas de Implementação

- **Linha 29-38:** Estado inicial usa `Partial<LegalDocument>` — permite campos opcionais
- **Linha 40-47:** `generateSlug` usa normalização NFD + regex para remover diacríticos
- **Linha 97-104:** `docData` usa spread de `formData` com campos adicionais sobrescritos
- **Linha 99:** Fallback do slug: `formData.slug || generateSlug(formData.title!)` — garante slug mesmo se campo vazio
- **Linha 103:** `published_at` condicional: `serverTimestamp()` ou `null`
- **Linha 225:** Ordem: `parseInt(e.target.value) || 1` — fallback para 1 se NaN

---

## 17. Histórico de Mudanças

| Data       | Versão | Autor              | Descrição                                                                                                                                                                                     |
| ---------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 07/02/2026 | 1.0    | Engenharia Reversa | Documentação inicial                                                                                                                                                                          |
| 08/02/2026 | 1.1    | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções). Adicionados fluxos ASCII, regras de negócio expandidas, análise de validações ausentes, layout do formulário e observações técnicas. |

---

## 18. Glossário

| Termo                 | Definição                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Slug**              | Identificador amigável para URL, derivado do título (ex: "termos-de-uso"). Gerado via normalização Unicode.                 |
| **NFD**               | Normal Form Decomposition — forma de normalização Unicode que decompõe caracteres acentuados em caractere base + diacrítico |
| **Diacrítico**        | Marca gráfica sobre ou sob uma letra (acento agudo, til, cedilha, etc.). Faixa Unicode U+0300–U+036F                        |
| **serverTimestamp()** | Função Firestore que gera timestamp no servidor (não no client), garantindo consistência                                    |
| **DocumentStatus**    | Tipo TypeScript: "ativo" (publicado), "inativo" (desativado), "rascunho" (em elaboração)                                    |

---

## 19. Referências

### 19.1 Documentação Relacionada

- [Legal Documents List](./legal-documents-list-documentation.md) — Lista de documentos
- [Legal Documents Detail](./legal-documents-detail-documentation.md) — Visualização de documento
- [Legal Documents Edit](./legal-documents-edit-documentation.md) — Edição de documento

### 19.2 Código Fonte

- `src/app/(admin)/admin/legal-documents/new/page.tsx` — Componente principal (310 linhas)
- `src/types/index.ts` — Interfaces `LegalDocument`, `DocumentStatus`

### 19.3 Links Externos

- [Firestore addDoc](https://firebase.google.com/docs/firestore/manage-data/add-data#add_a_document)
- [Unicode NFD Normalization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)

---

## 20. Anexos

### 20.1 Exemplos de Geração de Slug

| Título                    | Slug Gerado               |
| ------------------------- | ------------------------- |
| "Termos de Uso"           | `termos-de-uso`           |
| "Política de Privacidade" | `politica-de-privacidade` |
| "Contrato de Licença 2.0" | `contrato-de-licenca-2-0` |
| " Espaços Extras "        | `espacos-extras`          |
| "TÍTULO EM MAIÚSCULA"     | `titulo-em-maiuscula`     |

### 20.2 Exemplo de Documento Criado

```json
{
  "title": "Termos de Uso",
  "slug": "termos-de-uso",
  "content": "# Termos de Uso\n\n## 1. Aceitação\n...",
  "version": "1.0",
  "status": "rascunho",
  "required_for_registration": true,
  "required_for_existing_users": false,
  "order": 1,
  "created_by": "admin_uid_123",
  "created_at": "2026-02-08T12:00:00Z",
  "updated_at": "2026-02-08T12:00:00Z",
  "published_at": null
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
