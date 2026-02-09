# Documentação Experimental - Visualização de Documento Legal

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Detalhes do Documento Legal (`/admin/legal-documents/[id]`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de visualização (read-only) de um documento legal específico. Exibe título com badge de status, versão, slug, ordem, flags de obrigatoriedade e o conteúdo Markdown renderizado via `react-markdown` com estilização Tailwind Typography (`prose`). Permite navegação para edição do documento.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/legal-documents/[id]/page.tsx` (150 linhas)
- **Rota:** `/admin/legal-documents/{id}`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)
- **Parâmetro dinâmico:** `[id]` — ID do documento no Firestore

### 1.2 Dependências Principais
- **Firestore:** `getDoc`, `doc` — leitura de `legal_documents/{id}`
- **react-markdown:** Renderização de conteúdo Markdown para HTML
- **Types:** `LegalDocument`, `DocumentStatus` de `src/types`
- **UI:** Card, Badge, Button (shadcn/ui)
- **Ícones:** ArrowLeft, Edit, Loader2 (lucide-react)
- **Hooks:** `useToast`, `useRouter`, `useParams`

---

## 2. Tipos de Usuários / Atores

| Ator | Permissão | Descrição |
|------|-----------|-----------|
| `system_admin` | Acesso total | Único role que acessa esta página. Pode visualizar e navegar para edição |
| `clinic_admin` | Sem acesso | Não tem acesso a esta página |
| `clinic_user` | Sem acesso | Não tem acesso a esta página |
| `clinic_consultant` | Sem acesso | Não tem acesso a esta página |

---

## 3. Estrutura de Dados

### 3.1 Interface — LegalDocument
```typescript
// src/types/index.ts
export interface LegalDocument {
  id: string;                          // ID do documento Firestore
  title: string;                       // Título exibido no header
  slug: string;                        // Exibido no subtítulo
  content: string;                     // Markdown renderizado via react-markdown
  version: string;                     // Exibido no subtítulo
  status: DocumentStatus;              // Badge no header e card info
  required_for_registration: boolean;  // Badge condicional
  required_for_existing_users: boolean;// Badge condicional
  order: number;                       // Exibido no card info
  created_by: string;                  // Não exibido na interface
  created_at: Timestamp;               // Não exibido na interface
  updated_at: Timestamp;               // Não exibido na interface
  published_at?: Timestamp;            // Não exibido na interface
}
```

---

## 4. Casos de Uso

### UC-001: Visualizar Documento Legal
- **Ator:** system_admin
- **Pré-condições:** ID do documento na URL, documento existente no Firestore
- **Fluxo Principal:**
  1. Página carrega, extrai `id` de `useParams()`
  2. `getDoc(doc(db, "legal_documents", id))`
  3. Se documento existe: mapeia `{ id: docSnap.id, ...docSnap.data() }` e renderiza
  4. Exibe dois cards: "Informações do Documento" e "Conteúdo do Documento"
- **Fluxo Alternativo:**
  - Documento não encontrado: toast destructive "Documento não encontrado" → redirect para `/admin/legal-documents`
  - Erro na query: toast destructive com `error.message`
- **Pós-condições:** Documento exibido em modo read-only
- **Regra de Negócio:** N/A

### UC-002: Navegar para Edição
- **Ator:** system_admin
- **Pré-condições:** Documento carregado com sucesso
- **Fluxo Principal:**
  1. Admin clica "Editar" (botão no header)
  2. `router.push("/admin/legal-documents/{id}/edit")`
- **Pós-condições:** Navegação para página de edição
- **Regra de Negócio:** N/A

### UC-003: Voltar para Lista
- **Ator:** system_admin
- **Pré-condições:** Página carregada
- **Fluxo Principal:**
  1. Admin clica "Voltar" (botão ghost no header)
  2. `router.push("/admin/legal-documents")`
- **Pós-condições:** Navegação para lista de documentos
- **Regra de Negócio:** N/A

---

## 5. Fluxo de Processo Detalhado

### 5.1 Carregamento da Página
```
[Página Carrega]
       │
       ▼
[useParams() → { id }]
       │
       ▼
[documentId existe?]
  │ Não → nada (useEffect não executa)
  │ Sim
  ▼
[loading = true]
       │
       ▼
[Exibe Loader2 spinner]
       │
       ▼
[getDoc(legal_documents/{id})]
       │
  ┌────┴────┐
  ▼         ▼
[Existe]  [Não existe]
  │         │
  ▼         ▼
[setDocument()]  [toast "Documento não encontrado"]
  │              │
  ▼              ▼
[loading=false]  [router.push("/admin/legal-documents")]
  │
  ▼
[Renderiza 2 cards]
```

---

## 6. Regras de Negócio

### RN-001: Redirect ao Não Encontrar Documento
- **Descrição:** Se o documento não existe no Firestore, o usuário é redirecionado para a lista com aviso.
- **Aplicação:** `if (!docSnap.exists())` → toast destructive → `router.push("/admin/legal-documents")`.
- **Exceções:** Nenhuma.
- **Justificativa:** Evitar exibição de página vazia para documento inexistente ou deletado.

### RN-002: Página Read-Only
- **Descrição:** Esta página não permite edição. Todas as informações são exibidas em modo somente leitura.
- **Aplicação:** Nenhum formulário, nenhum campo editável. Único ponto de escrita é o botão "Editar" que navega para outra página.
- **Exceções:** Nenhuma.
- **Justificativa:** Separação de responsabilidades: visualização vs edição.

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
- **Quando:** `loading === true`
- **Exibição:** Loader2 spinner centralizado, altura `h-96`

### 7.2 Estado: Documento Não Encontrado
- **Quando:** `loading === false`, `document === null` (após redirect)
- **Exibição:** `return null` — página em branco momentânea antes do redirect

### 7.3 Estado: Documento Carregado
- **Quando:** `loading === false`, `document !== null`
- **Layout:**
```
[← Voltar]

Título do Documento [Badge Status]     [✏️ Editar]
Versão 1.0 • slug-do-documento

┌─ Card: Informações do Documento ──────────────┐
│ Ordem        │ Status                          │
│ 1            │ [Badge Ativo/Inativo/Rascunho]  │
│                                                 │
│ [Obrigatório no cadastro] [Obrigatório p/ exist]│
└─────────────────────────────────────────────────┘

┌─ Card: Conteúdo do Documento ──────────────────┐
│ Preview do documento em Markdown                │
│ ┌─────────────────────────────────────────────┐ │
│ │ bg-muted/30, border, prose prose-sm         │ │
│ │                                             │ │
│ │ <ReactMarkdown>{content}</ReactMarkdown>    │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 7.4 Badges de Status
| Status | Variante | Texto |
|--------|----------|-------|
| `ativo` | `default` | Ativo |
| `inativo` | `secondary` | Inativo |
| `rascunho` | `outline` | Rascunho |

### 7.5 Badges de Obrigatoriedade (Condicionais)
| Flag | Exibido quando | Badge (variant: outline) |
|------|----------------|--------------------------|
| `required_for_registration` | `=== true` | "Obrigatório no cadastro" |
| `required_for_existing_users` | `=== true` | "Obrigatório para usuários existentes" |

---

## 8. Validações

### 8.1 Validações Frontend
| Validação | Implementação |
|-----------|---------------|
| ID do documento na URL | `if (documentId)` antes de chamar `loadDocument()` |
| Documento existe no Firestore | `docSnap.exists()` com redirect se falso |

### 8.2 Validações Backend
- Firestore Security Rules controlam acesso por role

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin` antes de renderizar

---

## 9. Integrações

### 9.1 Firestore
- **`getDoc(doc(db, "legal_documents", documentId))`:** Leitura única do documento por ID

### 9.2 react-markdown
- **`<ReactMarkdown>{document.content}</ReactMarkdown>`:** Renderiza Markdown como HTML
- **Estilização:** `prose prose-sm max-w-none` (Tailwind Typography) com `border rounded-lg p-6 bg-muted/30`

### 9.3 Navegação (Next.js Router)
- **Voltar:** → `/admin/legal-documents`
- **Editar:** → `/admin/legal-documents/{id}/edit`
- **Redirect (não encontrado):** → `/admin/legal-documents`

### 9.4 Toast (useToast)
- **Documento não encontrado:** "Documento não encontrado" (destructive)
- **Erro de carregamento:** "Erro ao carregar documento" + `error.message` (destructive)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- Layout admin restringe acesso por role
- Página read-only (sem operações de escrita)
- Firestore Security Rules protegem leitura

### 10.2 Vulnerabilidades / Pontos de Atenção
- **react-markdown sem sanitização:** `ReactMarkdown` renderiza Markdown diretamente. Por padrão, `react-markdown` não executa HTML inline, mas plugins poderiam alterar este comportamento.
- **ID do documento exposto na URL:** O ID do Firestore é visível na barra de endereço (comportamento esperado em rotas dinâmicas).
- **Sem verificação de XSS no conteúdo Markdown:** Se o conteúdo Markdown contiver scripts ou HTML malicioso, a renderização depende das proteções do `react-markdown`.

### 10.3 Dados Sensíveis
- Conteúdo dos documentos legais é público por natureza, sem dados sensíveis.

---

## 11. Performance

### 11.1 Métricas Esperadas
- **Carregamento:** 1 read do Firestore (getDoc)
- **Renderização Markdown:** Depende do tamanho do conteúdo (tipicamente rápida para documentos legais)

### 11.2 Otimizações Atuais
- Leitura única (getDoc, não listener)
- Sem queries adicionais

### 11.3 Gargalos Identificados
- Renderização de Markdown muito longo pode ser lenta (improvável para documentos legais)
- Nenhum cache — recarrega a cada visita

---

## 12. Acessibilidade

### 12.1 WCAG
- Conteúdo Markdown renderizado em HTML semântico (headings, lists, paragraphs via react-markdown)
- Tailwind Typography (`prose`) aplica estilos legíveis

### 12.2 Recursos Implementados
- Botão "Voltar" com texto e ícone
- Botão "Editar" com texto e ícone
- Cards com títulos e descrições semânticas

### 12.3 Melhorias Necessárias
- Sem breadcrumb de navegação
- Título da página não reflete dinamicamente o nome do documento (apenas h1 no body)
- Sem `aria-label` nos botões de navegação

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Carregar documento existente | E2E | Pendente |
| T-002 | Documento não encontrado → redirect | E2E | Pendente |
| T-003 | Renderização de Markdown com headings, listas, links | Integração | Pendente |
| T-004 | Badges de status corretos | Unitário | Pendente |
| T-005 | Badges de obrigatoriedade condicionais | Unitário | Pendente |
| T-006 | Navegação para edição | E2E | Pendente |
| T-007 | Erro de carregamento exibe toast | Integração | Pendente |

### 13.2 Cenários de Erro
- ID inválido na URL
- Documento deletado entre listagem e visualização
- Firestore indisponível

### 13.3 Testes de Integração
- Verificar que `react-markdown` renderiza conteúdo corretamente
- Verificar redirect ao acessar ID inexistente

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Exibir timestamps (created_at, updated_at, published_at)
- [ ] Exibir nome do criador (created_by → resolver displayName)
- [ ] Histórico de versões do documento
- [ ] Botão para duplicar documento
- [ ] Contagem de aceitações (quantos usuários aceitaram)
- [ ] Preview de como o documento aparece para o usuário final

### 14.2 UX/UI
- [ ] Breadcrumb de navegação
- [ ] Metadata dinâmica na aba do browser (título do documento)
- [ ] Botão de download em PDF
- [ ] Modo de impressão otimizado

### 14.3 Performance
- [ ] Cache do documento para evitar recarregamento

### 14.4 Segurança
- [ ] Sanitização explícita do Markdown antes de renderização (rehype-sanitize)

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/legal-documents` | Página pai (lista), navegação "Voltar" |
| `/admin/legal-documents/{id}/edit` | Navegação "Editar" |
| `/admin/legal-documents/new` | Criação que gera documentos visualizáveis aqui |

### 15.2 Fluxos Relacionados
- **Lista → Detalhe → Edição:** Fluxo de navegação principal
- **Detalhe → Lista:** Botão "Voltar"

### 15.3 Impacto de Mudanças
- Alterar interface `LegalDocument` impacta renderização desta página
- Alterar conteúdo Markdown impacta renderização via `react-markdown`
- Alterar `react-markdown` ou adicionar plugins impacta segurança e renderização

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **react-markdown para renderização:** Biblioteca externa para converter Markdown → HTML. Sem plugins adicionais (rehype, remark) configurados.
- **Tailwind Typography:** Classe `prose prose-sm` aplica estilos tipográficos automaticamente ao HTML gerado.
- **Dois retornos antecipados:** `if (loading) return spinner`, `if (!document) return null` — antes do layout principal.
- **Read-only sem estado de form:** Nenhum formulário, apenas renderização de dados.

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para `useEffect`, `useParams`
- **Dynamic route:** `[id]` no path do Next.js App Router
- **Early returns:** Para loading e null document
- **Consistent padding:** `p-6` alinhado com outras páginas do módulo legal

### 16.3 Limitações Conhecidas
- Não exibe timestamps (created_at, updated_at)
- Não exibe quem criou o documento (created_by)
- Não exibe contagem de aceitações
- Sem cache (recarrega a cada visita)
- Badge de status aparece duplicado: no header e no card "Informações" (redundância)

### 16.4 Notas de Implementação
- **Linha 22:** `params.id as string` — cast direto sem validação
- **Linha 36:** Spread com cast: `{ id: docSnap.id, ...docSnap.data() } as LegalDocument`
- **Linha 74-76:** `if (!document) return null` — exibe nada após redirect (momentâneo)
- **Linha 142:** Container do Markdown: `prose prose-sm max-w-none border rounded-lg p-6 bg-muted/30`
- **Linha 120:** Badge de status renderizado tanto no header (linha 94) quanto no card info (redundante)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções). Adicionados fluxos ASCII, regras de negócio, análise de segurança (react-markdown), layout visual e observações técnicas. |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **react-markdown** | Biblioteca React para renderizar Markdown como componentes HTML/React |
| **Tailwind Typography** | Plugin `@tailwindcss/typography` que fornece a classe `prose` para estilizar conteúdo HTML rico |
| **Read-only** | Modo somente leitura, sem possibilidade de edição na interface |
| **Early return** | Padrão de retorno antecipado do componente antes do JSX principal, para estados como loading e null |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Legal Documents List](./legal-documents-list-documentation.md) — Lista de documentos
- [Legal Documents New](./legal-documents-new-documentation.md) — Criação de documento
- [Legal Documents Edit](./legal-documents-edit-documentation.md) — Edição de documento

### 19.2 Código Fonte
- `src/app/(admin)/admin/legal-documents/[id]/page.tsx` — Componente principal (150 linhas)
- `src/types/index.ts` — Interfaces `LegalDocument`, `DocumentStatus`

### 19.3 Links Externos
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [Tailwind Typography](https://tailwindcss.com/docs/plugins#typography)
- [Firestore getDoc](https://firebase.google.com/docs/firestore/query-data/get-data#get_a_document)

---

## 20. Anexos

### 20.1 Exemplo de Renderização Markdown
**Input (conteúdo salvo):**
```markdown
# Termos de Uso

## 1. Aceitação dos Termos
Ao utilizar o sistema Curva Mestra, você concorda com estes termos.

## 2. Uso do Sistema
- Uso permitido apenas para fins profissionais
- Dados de pacientes são confidenciais
```

**Output (renderizado no browser):**
Conteúdo HTML com headings h1/h2, parágrafo e lista não-ordenada, estilizado via `prose prose-sm`.

### 20.2 Mapa de Rotas do Módulo
```
/admin/legal-documents           ← Lista
/admin/legal-documents/new       ← Criação
/admin/legal-documents/{id}      ← Visualização (ESTA PÁGINA)
/admin/legal-documents/{id}/edit ← Edição
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
