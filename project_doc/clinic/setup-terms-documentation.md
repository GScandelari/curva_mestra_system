# Documentação Experimental - Aceitação de Termos (Onboarding)

- **Última atualização**: 09/02/2026
- **Status**: Em desenvolvimento
- **Responsável**: Engenharia Reversa (Claude)
- **Versão**: 2.0

---

## 1. Visão Geral

Página de aceitação obrigatória de termos legais e condições de uso durante o onboarding. Exibe documentos legais ativos e obrigatórios para registro, com preview parcial e visualização completa via dialog. O usuário deve aceitar todos os documentos pendentes para prosseguir.

- **Arquivo**: `src/app/(clinic)/clinic/setup/terms/page.tsx`
- **Rota**: `/clinic/setup/terms`
- **Tipo**: Client Component (`"use client"`)
- **Componente principal**: `AcceptTermsOnboardingPage`
- **Dependências principais**:
  - `useAuth` (hook — user e claims)
  - `useToast` (hook de notificações toast)
  - Firebase Firestore direto: `collection`, `query`, `where`, `getDocs`, `addDoc`, `serverTimestamp`, `orderBy`
  - `react-markdown` (renderização de conteúdo Markdown)
  - Tipo `LegalDocument` de `@/types`
  - Componentes Shadcn/ui: `Card`, `Checkbox`, `Alert`, `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogTrigger`, `ScrollArea`
  - Ícones Lucide: `FileText`, `Loader2`, `CheckCircle2`, `AlertCircle`

---

## 2. Tipos de Usuários

| Tipo | Acesso | Permissões |
|------|--------|------------|
| `clinic_admin` | Total | Visualiza, lê e aceita documentos legais |
| `clinic_user` | N/A | Não acessa setup (fluxo de onboarding) |

---

## 3. Estrutura de Dados

### 3.1 Coleção — `legal_documents`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | ID do documento (auto-gerado) |
| `title` | `string` | Título do documento legal |
| `version` | `string` | Versão do documento |
| `content` | `string` | Conteúdo completo em Markdown |
| `status` | `string` | `"ativo"` para documentos vigentes |
| `required_for_registration` | `boolean` | Se é obrigatório durante o registro |
| `order` | `number` | Ordem de exibição (ascendente) |

### 3.2 Coleção — `user_document_acceptances`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `user_id` | `string` | UID do usuário que aceitou |
| `document_id` | `string` | ID do documento aceito |
| `document_version` | `string` | Versão do documento no momento da aceitação |
| `accepted_at` | `Timestamp` | Data/hora da aceitação (serverTimestamp) |
| `ip_address` | `null` | Reservado (não implementado) |
| `user_agent` | `string` | User-Agent do navegador |

### 3.3 Estado do Componente (useState)

```typescript
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [documents, setDocuments] = useState<LegalDocument[]>([]);
const [acceptances, setAcceptances] = useState<Record<string, boolean>>({});
```

---

## 4. Casos de Uso

### UC-001: Visualizar documentos legais pendentes

- **Ator**: clinic_admin
- **Pré-condição**: Usuário autenticado
- **Fluxo**:
  1. `loadDocuments()` busca documentos com `status == "ativo"` e `required_for_registration == true`
  2. Busca aceitações existentes do usuário em `user_document_acceptances`
  3. Filtra apenas documentos não aceitos ainda
  4. Se nenhum pendente: redirect para `/clinic/setup`
  5. Se há pendentes: exibe lista de cards com preview
- **Pós-condição**: Documentos pendentes exibidos

### UC-002: Ler preview do documento

- **Ator**: clinic_admin
- **Fluxo**:
  1. Preview exibe primeiros 500 caracteres do conteúdo Markdown renderizado
  2. Texto truncado com "..." no final
  3. Área com `max-h-48` e scroll
- **Pós-condição**: Preview parcial visível

### UC-003: Ler documento completo

- **Ator**: clinic_admin
- **Fluxo**:
  1. Clica em "Ler {título} Completo"
  2. Dialog modal abre com `max-w-4xl` e `max-h-[85vh]`
  3. ScrollArea com `h-[65vh]` exibe conteúdo completo em Markdown
- **Pós-condição**: Documento completo legível

### UC-004: Aceitar documentos e prosseguir

- **Ator**: clinic_admin
- **Fluxo**:
  1. Marca checkbox "Li e concordo com..." para cada documento
  2. Botão "Aceitar e Continuar" habilitado quando todos marcados
  3. Clica no botão
  4. `handleAcceptAll()` cria registros em `user_document_acceptances` via `Promise.all`
  5. Cada registro inclui: user_id, document_id, document_version, accepted_at, user_agent
  6. Toast "Termos aceitos com sucesso" + redirect para `/clinic/setup`
- **Pós-condição**: Aceitações registradas no Firestore

---

## 5. Fluxo de Processo

```
┌─────────────────────────┐
│ Usuário acessa           │
│ /clinic/setup/terms      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Query: legal_documents   │
│ status="ativo" AND       │
│ required_for_registration│
│ orderBy("order", "asc")  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Query: acceptances       │
│ user_id == user.uid      │
│ → Set de document_ids    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Filter: pendentes =      │
│ docs - aceitos           │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
  Pendentes=0  Pendentes>0
      │           │
      ▼           ▼
  Redirect    Exibe cards
  /setup      com preview
              + checkbox
                  │
                  ▼ (todos marcados)
          ┌───────────────┐
          │ Promise.all:   │
          │ addDoc × N     │
          │ (acceptances)  │
          └───────┬───────┘
                  │
            ┌─────┴─────┐
         Sucesso      Erro
            │           │
            ▼           ▼
       Toast + redirect  Toast error
       /clinic/setup
```

---

## 6. Regras de Negócio

### RN-001: Documentos ativos e obrigatórios

- **Descrição**: Busca apenas documentos com `status == "ativo"` e `required_for_registration == true`
- **Aplicação**: Query com `where` no Firestore
- **Exceções**: Nenhuma
- **Justificativa**: Exibir apenas documentos legais vigentes e obrigatórios

### RN-002: Filtro de documentos já aceitos

- **Descrição**: Documentos já aceitos pelo usuário são filtrados e não exibidos
- **Aplicação**: Busca `user_document_acceptances` do user.uid e filtra por Set
- **Exceções**: Nenhuma
- **Justificativa**: Não exigir re-aceitação de documentos já aceitos

### RN-003: Redirect se nenhum pendente

- **Descrição**: Se não há documentos pendentes, redireciona automaticamente para `/clinic/setup`
- **Aplicação**: `if (pendingDocs.length === 0) router.push("/clinic/setup")`
- **Exceções**: Nenhuma
- **Justificativa**: Pular etapa de termos se já aceitos

### RN-004: Todos devem ser aceitos

- **Descrição**: Todos os checkboxes devem estar marcados para habilitar o botão
- **Aplicação**: `disabled={!documents.every(doc => acceptances[doc.id])}`
- **Exceções**: Se clicar sem aceitar todos, toast de alerta
- **Justificativa**: Conformidade legal — todos os documentos são obrigatórios

### RN-005: Versionamento de aceitação

- **Descrição**: A aceitação registra a versão do documento no momento (`document_version`)
- **Aplicação**: `document_version: doc.version` no addDoc
- **Exceções**: Nenhuma
- **Justificativa**: Rastreabilidade de qual versão foi aceita

### RN-006: Auditoria com user_agent

- **Descrição**: A aceitação registra o User-Agent do navegador
- **Aplicação**: `user_agent: navigator.userAgent`
- **Exceções**: `ip_address` registrado como `null` (não implementado)
- **Justificativa**: Auditoria de conformidade legal

### RN-007: Aceitações em paralelo

- **Descrição**: As aceitações de cada documento são salvas em paralelo via `Promise.all`
- **Aplicação**: `Promise.all(documents.map(doc => addDoc(...)))`
- **Exceções**: Se qualquer falhar, catch global com toast
- **Justificativa**: Performance — documentos independentes

### RN-008: Ordem de exibição

- **Descrição**: Documentos são ordenados pelo campo `order` (ascendente)
- **Aplicação**: `orderBy("order", "asc")` na query
- **Exceções**: Nenhuma
- **Justificativa**: Controle da ordem de apresentação

---

## 7. Estados da Interface

| Estado | Comportamento | Visual |
|--------|---------------|--------|
| Carregando | Spinner Loader2 centralizado + "Carregando..." | Tela com gradiente |
| Documentos exibidos | Lista de cards com preview, botão leitura e checkbox | Cards em sequência |
| Preview | 500 primeiros chars do Markdown renderizado + "..." | `max-h-48 overflow-y-auto` |
| Dialog aberto | Modal com conteúdo completo | `max-w-4xl max-h-[85vh]`, ScrollArea `h-[65vh]` |
| Todos aceitos | Botão "Aceitar e Continuar" habilitado | CheckCircle2 + texto |
| Nem todos aceitos | Botão desabilitado | `disabled` |
| Salvando | Botão com Loader2 + "Salvando..." | Spinner no botão |
| Erro | Toast destructive | Toast vermelho |
| Sucesso | Toast + redirect | Toast verde + navegação |

---

## 8. Validações

### 8.1 Validações no Frontend

| Validação | Condição | Comportamento |
|-----------|----------|---------------|
| Usuário autenticado | `!user` | Toast "Você precisa estar autenticado" |
| Todos aceitos | `!documents.every(doc => acceptances[doc.id])` | Botão desabilitado + toast se tentar clicar |

---

## 9. Integrações

| Integração | Tipo | Descrição |
|------------|------|-----------|
| Firebase Auth | Autenticação | `useAuth()` — user.uid |
| Firestore — legal_documents | Leitura | Query de documentos ativos e obrigatórios |
| Firestore — user_document_acceptances | Leitura/Escrita | Verifica aceitações e registra novas |
| `react-markdown` | Renderização | Converte Markdown para HTML no preview e dialog |
| `useToast` | Feedback | Toast para sucesso e erros |
| `navigator.userAgent` | Auditoria | Registrado na aceitação |

---

## 10. Segurança

| Aspecto | Implementação |
|---------|---------------|
| Autenticação | `useAuth()` verifica se há usuário logado |
| Auditoria legal | Registra user_id, document_version, user_agent, timestamp |
| IP address | Reservado mas não implementado (`null`) |
| Versionamento | Registra a versão exata do documento aceito |
| Firestore direto | Queries feitas diretamente no componente (sem service layer) |

---

## 11. Performance

| Aspecto | Implementação |
|---------|---------------|
| 2 queries paralelas | Documentos e aceitações poderiam ser paralelas (são sequenciais) |
| Aceitações em batch | `Promise.all` para salvar todas as aceitações em paralelo |
| Preview truncado | Apenas 500 chars renderizados no preview |
| Dialog lazy | Conteúdo completo renderizado apenas quando dialog abre |

---

## 12. Acessibilidade

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| Checkbox com label | Sim | `htmlFor` vinculando checkbox + label |
| Dialog modal | Sim | Componente Shadcn Dialog com ARIA correto |
| ScrollArea | Sim | Componente acessível para conteúdo longo |
| Markdown renderizado | Parcial | HTML semântico via `react-markdown` |
| Toast notifications | Sim | Hook `useToast` com suporte nativo |
| Loader | Parcial | Loader2 sem aria-label |

---

## 13. Testes

### 13.1 Cenários de Teste Recomendados

| Cenário | Tipo | Descrição |
|---------|------|-----------|
| Documentos pendentes | E2E | Verificar listagem de cards com preview |
| Nenhum documento pendente | E2E | Verificar redirect automático para /setup |
| Preview de documento | E2E | Verificar truncamento em 500 chars |
| Dialog completo | E2E | Abrir dialog e verificar conteúdo Markdown |
| Checkbox individual | E2E | Marcar/desmarcar e verificar estado do botão |
| Aceitar todos | E2E | Marcar todos e verificar botão habilitado |
| Submit com sucesso | E2E | Verificar registros em user_document_acceptances |
| Versionamento | Integração | Verificar que document_version é registrada |
| User-Agent | Integração | Verificar que user_agent é registrado |
| Erro ao carregar | Integração | Simular erro e verificar toast |
| Erro ao salvar | Integração | Simular falha no addDoc e verificar toast |

---

## 14. Melhorias Futuras

| Melhoria | Prioridade | Descrição |
|----------|------------|-----------|
| Captura de IP | Média | Implementar captura de IP real do cliente |
| Service layer | Média | Mover queries do componente para um serviço dedicado |
| Re-aceitação por versão | Média | Exigir re-aceitação se versão do documento mudar |
| Download de PDF | Baixa | Permitir download do documento em PDF |
| Print view | Baixa | Versão para impressão do documento |

---

## 15. Dependências e Relacionamentos

```
setup-terms (este doc)
├── useAuth (hook) — user e claims
├── useToast (hook) — notificações
├── Firestore — legal_documents (leitura)
├── Firestore — user_document_acceptances (leitura/escrita)
├── react-markdown — renderização de conteúdo
├── @/types — LegalDocument
└── setup — destino após aceitação
```

### Fluxo de Onboarding

```
/clinic/setup/terms (este) → /clinic/setup → /clinic/setup/plan → /clinic/setup/payment → /clinic/setup/success
```

---

## 16. Observações Técnicas

- O campo `ip_address` é registrado como `null`; não há implementação de captura de IP no cliente.
- O conteúdo dos documentos legais é renderizado com `react-markdown`, tanto no preview quanto no dialog.
- O preview mostra apenas `doc.content.substring(0, 500)` seguido de "...".
- O dialog de leitura completa usa `max-w-4xl` e `max-h-[85vh]` com ScrollArea `h-[65vh]`.
- A aceitação de cada documento é salva como um documento separado na coleção `user_document_acceptances`.
- As aceitações são criadas em paralelo via `Promise.all`.
- As queries são feitas diretamente no componente (sem service layer) — diferente das demais páginas.
- A página usa background gradiente `from-blue-50 to-indigo-100` (padrão onboarding).
- O componente `DialogDescription` é importado mas não há um wrapper — usado dentro de `DialogHeader`.

---

## 17. Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 07/02/2026 | 1.0 | Documentação inicial (formato antigo) |
| 09/02/2026 | 2.0 | Padronização para template de 20 seções |

---

## 18. Glossário

| Termo | Descrição |
|-------|-----------|
| `legal_documents` | Coleção Firestore com documentos legais (termos, política de privacidade) |
| `user_document_acceptances` | Coleção Firestore com registros de aceitação |
| `required_for_registration` | Flag que indica se o documento é obrigatório no onboarding |
| `document_version` | Versão do documento no momento da aceitação |
| `react-markdown` | Biblioteca para renderizar Markdown como HTML |
| `acceptances` | Estado (Record) que mapeia document_id → boolean de aceitação |
| `saving` | Estado de loading durante salvamento das aceitações |

---

## 19. Referências

- Template: `project_doc/TEMPLATE-page-documentation.md`
- Código-fonte: `src/app/(clinic)/clinic/setup/terms/page.tsx`
- Types: `src/types/index.ts` (LegalDocument)
- Setup: `project_doc/clinic/setup-documentation.md`

---

## 20. Anexos

### Anexo A — Estrutura do Layout

```
min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100
└── max-w-4xl mx-auto py-12 space-y-6
    ├── Card Header: FileText + "Bem-vindo ao Curva Mestra!"
    ├── Alert: Instrução para ler documentos
    ├── [Para cada documento]:
    │   └── Card:
    │       ├── CardHeader: Título + Versão
    │       └── CardContent:
    │           ├── Preview (max-h-48, 500 chars Markdown)
    │           ├── Button "Ler Completo" → Dialog
    │           └── Checkbox "Li e concordo com..."
    └── Card Confirmação:
        └── Button "Aceitar e Continuar" (disabled se !allAccepted)
```
