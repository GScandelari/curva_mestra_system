# Documentação Experimental - Documentos Legais (Lista)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Administração do Sistema
**Componente:** Lista de Documentos Legais (`/admin/legal-documents`)
**Versão:** 1.1
**Data:** 08/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página que lista todos os documentos legais (Termos de Uso, Política de Privacidade, etc.) cadastrados no sistema. O System Admin pode visualizar, editar, criar novos e excluir documentos. Documentos são ordenados pelo campo `order` (ascendente) e exibidos como cards individuais com badges de status, versão, slug e indicadores de obrigatoriedade. A exclusão requer confirmação via AlertDialog.

### 1.1 Localização
- **Arquivo:** `src/app/(admin)/admin/legal-documents/page.tsx` (217 linhas)
- **Rota:** `/admin/legal-documents`
- **Layout:** Admin Layout (grupo `(admin)`)
- **Tipo:** Client Component (`"use client"`)

### 1.2 Dependências Principais
- **Firestore:** Coleção `legal_documents` — `getDocs`, `deleteDoc`, `query`, `orderBy`
- **Types:** `LegalDocument`, `DocumentStatus` de `src/types`
- **UI:** Card, Badge, Button, AlertDialog (shadcn/ui)
- **Ícones:** FileText, Plus, Edit, Trash2, Loader2, Eye (lucide-react)
- **Hooks:** `useToast` de `src/hooks/use-toast`

---

## 2. Tipos de Usuários / Atores

| Ator | Permissão | Descrição |
|------|-----------|-----------|
| `system_admin` | Acesso total | Único role que acessa esta página. Pode listar, visualizar, editar, criar e excluir documentos legais |
| `clinic_admin` | Sem acesso | Não tem acesso a esta página |
| `clinic_user` | Sem acesso | Não tem acesso a esta página |
| `clinic_consultant` | Sem acesso | Não tem acesso a esta página |

---

## 3. Estrutura de Dados

### 3.1 Interface — LegalDocument
```typescript
// src/types/index.ts
export type DocumentStatus = "ativo" | "inativo" | "rascunho";

export interface LegalDocument {
  id: string;
  title: string;                       // Ex: "Termos de Uso", "Política de Privacidade"
  slug: string;                        // Ex: "termos-de-uso", "politica-privacidade"
  content: string;                     // Conteúdo em Markdown
  version: string;                     // Ex: "1.0", "2.1"
  status: DocumentStatus;              // "ativo" | "inativo" | "rascunho"
  required_for_registration: boolean;  // Se obrigatório no cadastro
  required_for_existing_users: boolean;// Se usuários existentes devem aceitar
  order: number;                       // Ordem de exibição (sort key)
  created_by: string;                  // UID do criador
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;            // Opcional, quando publicado
}
```

### 3.2 Interface Relacionada — UserDocumentAcceptance
```typescript
// src/types/index.ts
export interface UserDocumentAcceptance {
  id: string;
  user_id: string;
  document_id: string;
  document_version: string;
  accepted_at: Timestamp;
  ip_address?: string;
  user_agent?: string;
}
```

---

## 4. Casos de Uso

### UC-001: Listar Documentos Legais
- **Ator:** system_admin
- **Pré-condições:** Usuário autenticado com role system_admin
- **Fluxo Principal:**
  1. Página carrega e chama `loadDocuments()`
  2. Query: `collection("legal_documents"), orderBy("order", "asc")`
  3. Mapeia documentos com spread: `{ id: doc.id, ...doc.data() }`
  4. Renderiza lista de cards (um por documento)
- **Fluxo Alternativo:**
  - Erro na query: toast destructive com mensagem de erro
  - Nenhum documento: estado vazio com botão "Criar Primeiro Documento"
- **Pós-condições:** Lista renderizada com todos os documentos ordenados por `order`
- **Regra de Negócio:** RN-001

### UC-002: Criar Novo Documento
- **Ator:** system_admin
- **Pré-condições:** Página carregada
- **Fluxo Principal:**
  1. Admin clica "Novo Documento" (header) ou "Criar Primeiro Documento" (estado vazio)
  2. `router.push("/admin/legal-documents/new")`
- **Pós-condições:** Navegação para página de criação
- **Regra de Negócio:** N/A

### UC-003: Visualizar Documento
- **Ator:** system_admin
- **Pré-condições:** Pelo menos um documento na lista
- **Fluxo Principal:**
  1. Admin clica no ícone Eye no card do documento
  2. `router.push("/admin/legal-documents/{id}")`
- **Pós-condições:** Navegação para página de detalhe
- **Regra de Negócio:** N/A

### UC-004: Editar Documento
- **Ator:** system_admin
- **Pré-condições:** Pelo menos um documento na lista
- **Fluxo Principal:**
  1. Admin clica no ícone Edit no card do documento
  2. `router.push("/admin/legal-documents/{id}/edit")`
- **Pós-condições:** Navegação para página de edição
- **Regra de Negócio:** N/A

### UC-005: Excluir Documento
- **Ator:** system_admin
- **Pré-condições:** Pelo menos um documento na lista
- **Fluxo Principal:**
  1. Admin clica no ícone Trash2 (vermelho) no card do documento
  2. AlertDialog abre: "Confirmar exclusão — Tem certeza que deseja excluir o documento **{title}**? Esta ação não pode ser desfeita."
  3. Admin clica "Excluir" (botão destructive)
  4. `deleteDoc(doc(db, "legal_documents", id))`
  5. Toast: "Sucesso — Documento excluído com sucesso"
  6. `loadDocuments()` recarrega a lista
- **Fluxo Alternativo:**
  - Admin clica "Cancelar": dialog fecha, nenhuma ação
  - Erro na exclusão: toast destructive com mensagem de erro
- **Pós-condições:** Documento removido do Firestore e da lista
- **Regra de Negócio:** RN-002, RN-003

---

## 5. Fluxo de Processo Detalhado

### 5.1 Carregamento da Página
```
[Página Carrega]
       │
       ▼
[loading = true]
       │
       ▼
[Exibe Loader2 spinner centralizado]
       │
       ▼
[getDocs(legal_documents, orderBy order asc)]
       │
       ├── Sucesso ──────────────────┐
       │                              │
       ▼                              │
[Mapeia docs → LegalDocument[]]       │
       │                              │
       ▼                              │
[setDocuments(docs)]                  │
       │                              │
       ▼                              │
[loading = false]                     │
       │                              │
       ▼                              │
[documents.length === 0?]             │
  │ Sim              │ Não             │
  ▼                  ▼                │
[Estado vazio]  [Renderiza cards]     │
                                      │
       ├── Erro ──────────────────────┘
       │
       ▼
[toast destructive: "Erro ao carregar documentos"]
       │
       ▼
[loading = false, lista vazia]
```

### 5.2 Fluxo de Exclusão
```
[Admin clica Trash2]
       │
       ▼
[setDocumentToDelete(document)]
[setDeleteDialogOpen(true)]
       │
       ▼
[AlertDialog exibe]
       │
  ┌────┴────┐
  ▼         ▼
[Cancelar] [Excluir]
  │         │
  ▼         ▼
[Fecha]   [deleteDoc(legal_documents/{id})]
            │
       ┌────┴────┐
       ▼         ▼
   [Sucesso]  [Erro]
       │         │
       ▼         ▼
   [toast     [toast
   "Sucesso"]  "Erro"]
       │         │
       ▼         ▼
   [loadDocuments()]
       │
       ▼
   [setDeleteDialogOpen(false)]
   [setDocumentToDelete(null)]
```

---

## 6. Regras de Negócio

### RN-001: Ordenação por Campo `order`
- **Descrição:** Documentos são sempre listados na ordem definida pelo campo `order` (ascendente).
- **Aplicação:** Query Firestore: `orderBy("order", "asc")`. A ordem é definida no momento da criação/edição do documento.
- **Exceções:** Nenhuma. Todos os documentos devem ter campo `order`.
- **Justificativa:** Permite ao admin controlar a sequência de exibição dos termos para os usuários finais.

### RN-002: Exclusão Permanente
- **Descrição:** A exclusão de um documento legal é permanente e irreversível.
- **Aplicação:** `deleteDoc` remove o documento do Firestore sem soft-delete.
- **Exceções:** Nenhuma verificação de documentos já aceitos por usuários (registros em `UserDocumentAcceptance` ficam órfãos).
- **Justificativa:** Simplificação para MVP. Em produção, deveria verificar aceitações existentes e possivelmente usar soft-delete.

### RN-003: Sem Verificação de Dependências na Exclusão
- **Descrição:** Ao excluir um documento, o sistema não verifica se existem registros de aceitação (`UserDocumentAcceptance`) referenciando este documento.
- **Aplicação:** `deleteDoc` é chamado diretamente sem checks adicionais.
- **Exceções:** Nenhuma.
- **Justificativa:** Simplificação para MVP. Pode causar registros órfãos de aceitação.

### RN-004: Badges de Obrigatoriedade Condicionais
- **Descrição:** Badges de obrigatoriedade só são exibidos se a flag correspondente for `true`.
- **Aplicação:** Renderização condicional: `required_for_registration && <Badge>` e `required_for_existing_users && <Badge>`.
- **Exceções:** Se ambos forem `false`, nenhum badge de obrigatoriedade é exibido.
- **Justificativa:** Comunicação visual clara das regras de aceitação obrigatória.

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
- **Quando:** `loading === true`
- **Exibição:** Loader2 (spinner animado) centralizado, altura fixa `h-96`
- **Nota:** Renderizado no nível do componente (retorno antecipado, antes do layout principal)

### 7.2 Estado: Lista Vazia
- **Quando:** `loading === false`, `documents.length === 0`
- **Exibição:** Card centralizado com:
  - Ícone FileText (h-12 w-12, muted)
  - "Nenhum documento cadastrado"
  - "Crie documentos legais para que os usuários aceitem"
  - Botão "Criar Primeiro Documento" → `/admin/legal-documents/new`

### 7.3 Estado: Lista Populada
- **Quando:** `documents.length > 0`
- **Exibição:** Grid de cards (gap-4), cada card contém:
  - **Header:** Título + Badge de status, subtítulo "Versão {version} • {slug}"
  - **Ações (header right):** Eye (ver), Edit (editar), Trash2 (excluir, cor destructive)
  - **Content:** Badges de obrigatoriedade (condicionais) + "Ordem: {order}"

### 7.4 Badges de Status
| Status | Variante | Texto |
|--------|----------|-------|
| `ativo` | `default` | Ativo |
| `inativo` | `secondary` | Inativo |
| `rascunho` | `outline` | Rascunho |

### 7.5 Badges de Obrigatoriedade
| Flag | Badge (variant: outline) |
|------|--------------------------|
| `required_for_registration === true` | "Obrigatório no cadastro" |
| `required_for_existing_users === true` | "Obrigatório para usuários existentes" |

### 7.6 Estado: Dialog de Exclusão
- **Quando:** `deleteDialogOpen === true`
- **Exibição:** AlertDialog com título "Confirmar exclusão", descrição com nome do documento em negrito, botões "Cancelar" e "Excluir" (destructive)

---

## 8. Validações

### 8.1 Validações Frontend
| Validação | Implementação |
|-----------|---------------|
| Confirmação de exclusão | AlertDialog com botões Cancelar/Excluir |
| Verificação de documento selecionado | `if (!documentToDelete) return` antes de deletar |

### 8.2 Validações Backend
- Nenhuma validação adicional na exclusão (apenas `deleteDoc` direto)
- Firestore Security Rules controlam acesso por role

### 8.3 Validações de Permissão
- Layout admin verifica role `system_admin` antes de renderizar
- Firestore Rules restringem acesso à coleção `legal_documents`

---

## 9. Integrações

### 9.1 Firestore
- **`collection(db, "legal_documents")`:** Leitura com ordenação por `order asc`
- **`doc(db, "legal_documents", id)`:** Referência para exclusão via `deleteDoc`

### 9.2 Navegação (Next.js Router)
- **`/admin/legal-documents/new`:** Criação de novo documento
- **`/admin/legal-documents/{id}`:** Visualização de documento
- **`/admin/legal-documents/{id}/edit`:** Edição de documento

### 9.3 Toast (useToast)
- **Sucesso:** "Documento excluído com sucesso"
- **Erro carregamento:** "Erro ao carregar documentos" + `error.message`
- **Erro exclusão:** "Erro ao excluir" + `error.message`

---

## 10. Segurança

### 10.1 Proteções Implementadas
- Confirmação via AlertDialog antes de exclusão
- Layout admin restringe acesso por role
- Firestore Security Rules restringem operações

### 10.2 Vulnerabilidades / Pontos de Atenção
- **Exclusão sem verificação de dependências:** Documentos aceitos por usuários (coleção `UserDocumentAcceptance`) ficam órfãos após exclusão
- **Sem soft-delete:** Não há recuperação após exclusão
- **Sem paginação:** Todos os documentos carregados de uma vez (aceitável para documentos legais que são poucos)
- **Sem verificação de status na exclusão:** Documento "ativo" pode ser excluído sem aviso especial

### 10.3 Dados Sensíveis
- Conteúdo dos documentos legais (Markdown) não é carregado na listagem (apenas título, slug, version, status, order, flags)

---

## 11. Performance

### 11.1 Métricas Esperadas
- **Carregamento:** 1 query Firestore (documentos legais são tipicamente poucos: 2-5)
- **Exclusão:** 1 write + 1 read (recarregamento)

### 11.2 Otimizações Atuais
- Ordenação no Firestore (usa índice)
- Sem paginação necessária (poucos documentos esperados)

### 11.3 Gargalos Identificados
- Recarregamento completo após exclusão (`loadDocuments()`)
- Nenhum gargalo significativo para o volume esperado de documentos legais

---

## 12. Acessibilidade

### 12.1 WCAG
- AlertDialog com gestão de foco automática (Radix UI)
- Botões com ícones possuem tamanho adequado (`size="icon"`)
- Badges com texto legível

### 12.2 Recursos Implementados
- AlertDialog semântico com título e descrição
- Cards com estrutura CardHeader/CardContent
- Spinner com animação para indicar loading

### 12.3 Melhorias Necessárias
- Botões de ação (Eye, Edit, Trash2) sem `aria-label` (apenas ícones, sem texto)
- Sem `aria-live` para anunciar mudanças na lista após exclusão
- Badges de obrigatoriedade sem contexto semântico adicional

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| # | Cenário | Tipo | Status |
|---|---------|------|--------|
| T-001 | Listar documentos ordenados por order | Integração | Pendente |
| T-002 | Estado vazio com botão de criação | E2E | Pendente |
| T-003 | Navegar para criação, visualização e edição | E2E | Pendente |
| T-004 | Excluir documento com confirmação | E2E | Pendente |
| T-005 | Cancelar exclusão | E2E | Pendente |
| T-006 | Badges de status corretos | Unitário | Pendente |
| T-007 | Badges de obrigatoriedade condicionais | Unitário | Pendente |
| T-008 | Erro de carregamento exibe toast | Integração | Pendente |

### 13.2 Cenários de Erro
- Firestore indisponível durante carregamento
- Erro de permissão ao excluir
- Documento excluído por outro admin simultaneamente

### 13.3 Testes de Integração
- Verificar que exclusão remove documento do Firestore
- Verificar recarregamento da lista após exclusão
- Verificar ordenação correta com diferentes valores de `order`

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Soft-delete com possibilidade de recuperação
- [ ] Verificar aceitações existentes antes de excluir (aviso)
- [ ] Duplicar documento existente
- [ ] Histórico de versões do documento
- [ ] Preview do conteúdo Markdown na lista

### 14.2 UX/UI
- [ ] Drag & drop para reordenar documentos
- [ ] Indicador visual de documentos aceitos por quantos usuários
- [ ] Filtro por status
- [ ] Adicionar `aria-label` aos botões de ação
- [ ] Confirmação especial para excluir documentos ativos

### 14.3 Performance
- Nenhuma otimização necessária para o volume esperado

### 14.4 Segurança
- [ ] Soft-delete em vez de exclusão permanente
- [ ] Verificar impacto em `UserDocumentAcceptance` antes de excluir
- [ ] Logs de auditoria para exclusões

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas Relacionadas
| Página | Relação |
|--------|---------|
| `/admin/legal-documents/new` | Navegação para criar novo documento |
| `/admin/legal-documents/{id}` | Navegação para visualizar documento |
| `/admin/legal-documents/{id}/edit` | Navegação para editar documento |
| `/register` | Página de registro exibe documentos com `required_for_registration === true` |

### 15.2 Fluxos Relacionados
- **Criação de documento:** Admin cria → aparece na lista → visível no cadastro (se obrigatório)
- **Aceitação de documento:** Usuário aceita termos → registro em `UserDocumentAcceptance`
- **Exclusão:** Admin exclui → registros de aceitação ficam órfãos

### 15.3 Impacto de Mudanças
- Alterar interface `LegalDocument` impacta esta página e as páginas de criação/edição/detalhe
- Alterar estrutura de `legal_documents` no Firestore impacta todas as 4 páginas do módulo
- Excluir documento ativo impacta fluxo de registro (se `required_for_registration`)

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Cards em vez de tabela:** Cada documento é um Card individual (não usa Table como a página de users). Adequado para poucos documentos com informações variadas.
- **AlertDialog para exclusão:** Usa componente shadcn/ui em vez de `confirm()` nativo (diferente da página de users). Melhor UX e acessibilidade.
- **Toast para feedback:** Usa `useToast` em vez de `alert()` nativo. Padrão mais moderno.
- **Retorno antecipado para loading:** `if (loading) return <Loader>` antes do JSX principal.

### 16.2 Padrões Utilizados
- **Client Component:** `"use client"` para interatividade
- **Layout padding:** `p-6` no container principal (diferente de `container py-8` na página de users)
- **Ghost buttons:** Botões de ação com `variant="ghost"` e `size="icon"`
- **Destructive styling:** Ícone Trash2 com `text-destructive`, botão excluir com `bg-destructive`

### 16.3 Limitações Conhecidas
- Não carrega conteúdo Markdown na listagem (apenas metadados)
- Sem busca/filtro na lista
- Sem indicação de quantos usuários aceitaram cada documento
- Exclusão não verifica dependências

### 16.4 Notas de Implementação
- **Linha 43-46:** Spread operator com cast: `{ id: doc.id, ...doc.data() } as LegalDocument[]`
- **Linha 82-91:** Mapa de status → badge variant configurado como objeto `variants`
- **Linha 93-99:** Retorno antecipado para estado de loading (fora do layout principal)
- **Linha 208:** Botão "Excluir" usa `className` para sobrescrever estilo default do AlertDialogAction

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa | Documentação inicial |
| 08/02/2026 | 1.1 | Engenharia Reversa | Reescrita completa seguindo template padrão (20 seções). Adicionados detalhes de interface LegalDocument/UserDocumentAcceptance, fluxos ASCII, regras de negócio expandidas, análise de segurança e acessibilidade. |

---

## 18. Glossário

| Termo | Definição |
|-------|-----------|
| **Documento Legal** | Termo de uso, política de privacidade ou outro documento jurídico que usuários devem aceitar |
| **Slug** | Identificador amigável para URL derivado do título (ex: "termos-de-uso") |
| **DocumentStatus** | Tipo TypeScript com valores "ativo", "inativo" ou "rascunho" |
| **Soft-delete** | Exclusão lógica (marcar como excluído) em vez de exclusão física do banco |
| **Registro órfão** | Documento de aceitação (`UserDocumentAcceptance`) que referencia um documento legal já excluído |

---

## 19. Referências

### 19.1 Documentação Relacionada
- [Legal Documents New](./legal-documents-new-documentation.md) — Criação de novo documento
- [Legal Documents Detail](./legal-documents-detail-documentation.md) — Visualização de documento
- [Legal Documents Edit](./legal-documents-edit-documentation.md) — Edição de documento

### 19.2 Código Fonte
- `src/app/(admin)/admin/legal-documents/page.tsx` — Componente principal (217 linhas)
- `src/types/index.ts` — Interfaces `LegalDocument`, `DocumentStatus`, `UserDocumentAcceptance`

### 19.3 Links Externos
- [Shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
- [Firestore orderBy](https://firebase.google.com/docs/firestore/query-data/order-limit-data)

---

## 20. Anexos

### 20.1 Estrutura Visual do Card de Documento
```
┌─────────────────────────────────────────────────┐
│ CardHeader                                       │
│ ┌─────────────────────────┐  ┌───┬───┬───┐     │
│ │ Título  [Badge Status]  │  │ 👁 │ ✏️ │ 🗑 │     │
│ │ Versão 1.0 • slug-aqui  │  └───┴───┴───┘     │
│ └─────────────────────────┘                      │
│ CardContent                                      │
│ [Obrigatório no cadastro] [Obrigatório p/ exist.]│
│ • Ordem: 1                                       │
└─────────────────────────────────────────────────┘
```

### 20.2 Mapa de Rotas do Módulo Legal Documents
```
/admin/legal-documents          ← Esta página (lista)
/admin/legal-documents/new      ← Criação
/admin/legal-documents/{id}     ← Visualização (detalhe)
/admin/legal-documents/{id}/edit ← Edição
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 08/02/2026
**Responsável:** Equipe de Desenvolvimento
**Status:** Aprovado
