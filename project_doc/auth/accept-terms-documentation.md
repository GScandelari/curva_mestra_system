# Documentação Experimental - Página Accept Terms

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização  
**Módulo:** Autenticação / Compliance  
**Componente:** Página de Aceitação de Termos (`/accept-terms`)  
**Versão:** 1.0  
**Data:** 07/02/2026  
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

A página Accept Terms é uma **tela de bloqueio obrigatória** que exige que usuários aceitem documentos legais (Termos de Uso, Política de Privacidade, etc.) antes de continuar usando o sistema. Esta página faz parte de um sistema de compliance que garante que todos os usuários estejam cientes e concordem com as políticas da plataforma.

### 1.1 Propósito

- Garantir compliance legal
- Obrigar aceitação de termos e políticas
- Registrar aceitações com timestamp e versão
- Bloquear acesso até aceitação
- Suportar múltiplos documentos
- Rastrear versões de documentos

### 1.2 Quando Esta Página é Exibida?

Usuário é redirecionado para `/accept-terms` quando:
1. Possui documentos legais pendentes de aceitação
2. Nova versão de documento foi publicada
3. Novos documentos obrigatórios foram adicionados
4. Tenta acessar qualquer rota protegida sem ter aceito termos

### 1.3 Fluxo Completo

```
1. Usuário faz login
   ↓
2. TermsInterceptor verifica termos pendentes
   ↓
3. Se há termos pendentes → /accept-terms
   ↓
4. Usuário lê documentos
   ↓
5. Usuário marca checkboxes
   ↓
6. Usuário clica "Aceitar Todos"
   ↓
7. Sistema registra aceitações
   ↓
8. Usuário liberado para usar sistema
```

### 1.4 Localização
- **Arquivo:** `src/app/(auth)/accept-terms/page.tsx`
- **Rota:** `/accept-terms`
- **Layout:** Auth Layout (sem navegação principal)

### 1.5 Dependências Principais
- **Hook:** `src/hooks/usePendingTerms.ts`
- **Interceptor:** `src/components/auth/TermsInterceptor.tsx`
- **Firestore:** Coleções `legal_documents` e `user_document_acceptances`
- **ReactMarkdown:** Renderização de conteúdo

---

## 2. Contexto: Sistema de Documentos Legais

### 2.1 Estrutura de Dados

**LegalDocument (legal_documents):**
```typescript
interface LegalDocument {
  id: string;
  title: string;                          // Ex: "Termos de Uso"
  content: string;                        // Markdown
  version: string;                        // Ex: "1.0", "2.1"
  status: "ativo" | "inativo";
  required_for_registration: boolean;     // Obrigatório no registro
  required_for_existing_users: boolean;   // Obrigatório para usuários existentes
  order: number;                          // Ordem de exibição
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

**UserDocumentAcceptance (user_document_acceptances):**
```typescript
interface UserDocumentAcceptance {
  user_id: string;              // UID do usuário
  document_id: string;          // ID do documento
  document_version: string;     // Versão aceita
  accepted_at: Timestamp;       // Quando aceitou
  ip_address: string | null;    // IP (pode ser capturado)
  user_agent: string;           // Navegador/dispositivo
}
```

### 2.2 Tipos de Documentos

**required_for_registration:**
- Obrigatório durante o registro
- Novos usuários devem aceitar
- Geralmente: Termos de Uso, Política de Privacidade

**required_for_existing_users:**
- Obrigatório para usuários já cadastrados
- Exibido quando nova versão é publicada
- Bloqueia acesso até aceitação

### 2.3 Versionamento

**Como Funciona:**
- Cada documento tem uma versão (ex: "1.0", "2.1")
- Quando versão muda, usuários devem aceitar novamente
- Sistema compara versão aceita vs versão atual
- Se diferente → documento pendente

**Exemplo:**
```
Documento: "Termos de Uso"
Versão atual: "2.0"
Usuário aceitou: "1.0"
Resultado: Pendente (precisa aceitar v2.0)
```

---

## 3. Casos de Uso

### 3.1 UC-001: Aceitação de Termos Bem-Sucedida

**Ator:** Usuário Autenticado  
**Pré-condições:**
- Usuário está logado
- Possui documentos pendentes de aceitação
- Documentos estão ativos no sistema

**Fluxo Principal:**
1. Usuário faz login
2. TermsInterceptor detecta termos pendentes
3. Sistema redireciona para `/accept-terms`
4. Sistema carrega documentos pendentes
5. Sistema exibe lista de documentos:
   - Termos de Uso v2.0
   - Política de Privacidade v1.5
6. Usuário lê cada documento (scroll)
7. Usuário marca checkbox: "Li e aceito termos de uso"
8. Usuário marca checkbox: "Li e aceito política de privacidade"
9. Botão "Aceitar Todos" fica habilitado
10. Usuário clica em "Aceitar Todos"
11. Sistema registra aceitações no Firestore
12. Sistema salva: user_id, document_id, version, timestamp, user_agent
13. Sistema exibe toast de sucesso
14. Sistema redireciona para `/` (página inicial)

**Pós-condições:**
- Aceitações registradas em `user_document_acceptances`
- Usuário não tem mais termos pendentes
- Acesso ao sistema liberado
- TermsInterceptor não bloqueia mais

---

### 3.2 UC-002: Tentativa de Aceitar Sem Marcar Todos

**Ator:** Usuário  
**Pré-condições:**
- Usuário está em `/accept-terms`
- Múltiplos documentos pendentes

**Fluxo Principal:**
1. Usuário visualiza 3 documentos
2. Usuário marca apenas 2 checkboxes
3. Usuário tenta clicar em "Aceitar Todos"
4. Botão está desabilitado (não pode clicar)
5. Usuário marca o terceiro checkbox
6. Botão fica habilitado
7. Usuário pode aceitar

**Pós-condições:**
- Validação frontend previne aceitação parcial
- Todos os documentos devem ser aceitos

**Regra de Negócio:**
- Não é possível aceitar apenas alguns documentos
- Todos são obrigatórios
- Botão só habilita quando todos marcados

---

### 3.3 UC-003: Nova Versão de Documento Publicada

**Ator:** Usuário Existente  
**Pré-condições:**
- Usuário já aceitou Termos v1.0
- Admin publicou Termos v2.0
- Documento marcado como `required_for_existing_users: true`

**Fluxo Principal:**
1. Usuário faz login
2. Sistema verifica termos pendentes
3. Sistema compara versões:
   - Aceita: v1.0
   - Atual: v2.0
   - Resultado: Pendente
4. TermsInterceptor redireciona para `/accept-terms`
5. Sistema exibe apenas Termos v2.0 (novo)
6. Usuário lê e aceita
7. Sistema registra aceitação da v2.0
8. Acesso liberado

**Pós-condições:**
- Nova versão aceita
- Versão antiga substituída no registro
- Usuário atualizado com nova política

---

### 3.4 UC-004: Usuário Sem Termos Pendentes Acessa Página

**Ator:** Usuário Atualizado  
**Pré-condições:**
- Usuário já aceitou todos os termos
- Todas as versões estão atualizadas

**Fluxo Principal:**
1. Usuário acessa `/accept-terms` diretamente (URL)
2. Sistema carrega documentos pendentes
3. Sistema não encontra documentos pendentes
4. Sistema redireciona automaticamente para `/`

**Pós-condições:**
- Usuário não vê página de termos
- Redirecionado para página inicial

**Comportamento:**
- Página não é exibida se não há termos pendentes
- Redirecionamento automático

---

### 3.5 UC-005: Erro ao Salvar Aceitações

**Ator:** Usuário  
**Pré-condições:**
- Usuário marcou todos os checkboxes
- Problema de conexão ou Firestore

**Fluxo Principal:**
1. Usuário marca todos os checkboxes
2. Usuário clica em "Aceitar Todos"
3. Sistema tenta salvar no Firestore
4. Firestore retorna erro (conexão, permissão, etc.)
5. Sistema captura erro
6. Sistema exibe toast de erro
7. Usuário permanece na página
8. Usuário pode tentar novamente

**Pós-condições:**
- Aceitações NÃO registradas
- Usuário ainda bloqueado
- Pode tentar novamente

---

### 3.6 UC-006: Usuário Não Autenticado Tenta Acessar

**Ator:** Usuário Não Logado  
**Pré-condições:**
- Usuário não está autenticado
- Tenta acessar `/accept-terms` diretamente

**Fluxo Principal:**
1. Usuário acessa `/accept-terms` via URL
2. Sistema verifica autenticação
3. Sistema detecta que não está logado
4. Sistema redireciona para `/login`

**Pós-condições:**
- Usuário redirecionado para login
- Não vê página de termos

**Regra de Negócio:**
- Página requer autenticação
- Apenas usuários logados podem aceitar termos

---

## 4. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│              FLUXO DE ACCEPT TERMS                               │
└─────────────────────────────────────────────────────────────────┘

ETAPA 1: VERIFICAÇÃO DE TERMOS PENDENTES
═══════════════════════════════════════════════════════════════════

    Usuário faz login
              │
              ▼
    ┌──────────────────────────────┐
    │ TermsInterceptor ativo       │
    │ (em todas as páginas)        │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ usePendingTerms hook         │
    │ verifica termos              │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ 1. Buscar documentos ativos  │
    │    (status = "ativo")        │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ 2. Filtrar obrigatórios:     │
    │    - required_for_           │
    │      registration            │
    │    - required_for_existing_  │
    │      users                   │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ 3. Buscar aceitações do      │
    │    usuário                   │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ 4. Comparar versões:         │
    │    - Documento v2.0          │
    │    - Aceito v1.0             │
    │    → Pendente!               │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Tem termos pendentes?        │
    └──────────────────────────────┘
         │              │
    SIM  │              │  NÃO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Redirecionar │  │ Permitir acesso  │
│ /accept-     │  │ normal           │
│ terms        │  └──────────────────┘
└──────────────┘
         │
         ▼

═══════════════════════════════════════════════════════════════════
ETAPA 2: EXIBIÇÃO E ACEITAÇÃO
═══════════════════════════════════════════════════════════════════

    ┌──────────────────────────────┐
    │ PÁGINA ACCEPT TERMS          │
    │                              │
    │ Para cada documento:         │
    │ - Título                     │
    │ - Versão                     │
    │ - Conteúdo (Markdown)        │
    │ - Checkbox de aceitação      │
    └──────────────────────────────┘
              │
              ▼
    Usuário lê documentos
              │
              ▼
    Usuário marca checkboxes
              │
              ▼
    ┌──────────────────────────────┐
    │ Todos marcados?              │
    └──────────────────────────────┘
         │              │
    SIM  │              │  NÃO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Botão        │  │ Botão desabilitado│
│ habilitado   │  └──────────────────┘
└──────────────┘
         │
         ▼
    Usuário clica "Aceitar Todos"
              │
              ▼
    ┌──────────────────────────────┐
    │ Para cada documento:         │
    │ 1. Criar registro em         │
    │    user_document_acceptances │
    │ 2. Salvar:                   │
    │    - user_id                 │
    │    - document_id             │
    │    - document_version        │
    │    - accepted_at             │
    │    - user_agent              │
    └──────────────────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ Todas salvas com sucesso?    │
    └──────────────────────────────┘
         │              │
    SIM  │              │  NÃO
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────────┐
│ Toast de     │  │ Toast de erro    │
│ sucesso      │  │ Permanece na     │
└──────────────┘  │ página           │
         │        └──────────────────┘
         ▼
┌──────────────────────────────┐
│ Redirecionar para /          │
└──────────────────────────────┘
```

---

## 5. Regras de Negócio

### RN-001: Aceitação Obrigatória de Todos os Documentos
**Descrição:** Usuário DEVE aceitar TODOS os documentos pendentes para continuar usando o sistema. Não é possível aceitar apenas alguns.  
**Aplicação:** Botão "Aceitar Todos" só habilita quando todos os checkboxes estão marcados.  
**Exceções:** Nenhuma. Todos os documentos são obrigatórios.  
**Justificativa:** Garantir compliance legal completo. Evitar aceitação parcial que não protege a empresa.

### RN-002: Versionamento de Documentos
**Descrição:** Cada documento possui uma versão (ex: "1.0", "2.1"). Quando a versão muda, usuários devem aceitar novamente.  
**Aplicação:** Sistema compara versão aceita vs versão atual. Se diferente, documento aparece como pendente.  
**Exceções:** Nenhuma.  
**Justificativa:** Mudanças legais exigem nova aceitação. Usuário deve estar ciente das alterações.

### RN-003: Bloqueio de Acesso Até Aceitação
**Descrição:** Usuário com termos pendentes NÃO pode acessar nenhuma rota protegida do sistema.  
**Aplicação:** TermsInterceptor redireciona para `/accept-terms` em todas as rotas (exceto públicas).  
**Exceções:** Rotas públicas: `/login`, `/register`, `/accept-terms`, `/clinic/setup/terms`, `/`  
**Justificativa:** Garantir que usuário não use sistema sem aceitar termos. Proteção legal.

### RN-004: Registro de Aceitação com Metadados
**Descrição:** Cada aceitação deve registrar: user_id, document_id, version, timestamp, user_agent.  
**Aplicação:** Ao clicar "Aceitar Todos", sistema salva registro completo no Firestore.  
**Exceções:** IP address é opcional (pode ser null).  
**Justificativa:** Prova legal de aceitação. Rastreabilidade e auditoria.

### RN-005: Documentos Ativos vs Inativos
**Descrição:** Apenas documentos com `status: "ativo"` são exibidos e exigidos.  
**Aplicação:** Query no Firestore filtra por `status == "ativo"`.  
**Exceções:** Documentos inativos não aparecem, mesmo que obrigatórios.  
**Justificativa:** Permite desativar documentos sem deletá-los. Histórico preservado.

### RN-006: Ordem de Exibição
**Descrição:** Documentos são exibidos na ordem definida pelo campo `order`.  
**Aplicação:** Query usa `orderBy("order", "asc")`.  
**Exceções:** Se dois documentos têm mesmo `order`, ordem é indefinida.  
**Justificativa:** Controle sobre sequência de apresentação (ex: Termos antes de Privacidade).

---

## 6. Estados da Interface

### 6.1 Estado: Loading (Carregando)
**Quando:** Ao entrar na página, enquanto busca documentos pendentes.  
**Exibição:** 
- Tela com fundo `#f5f3ef`
- Ícone de loading (Loader2) centralizado
- Animação de spin
**Interações:** Nenhuma (usuário aguarda)  
**Duração:** ~1-3 segundos (depende da conexão)

### 6.2 Estado: Documentos Pendentes (Principal)
**Quando:** Após carregar, se há documentos pendentes.  
**Exibição:**
- Header com ícone FileText e título "Aceite os Termos"
- Card para cada documento pendente:
  - Título do documento
  - Versão
  - Conteúdo em Markdown (scroll vertical, max-height 96)
  - Checkbox: "Li e aceito [nome do documento]"
- Card final com botão "Aceitar Todos os Documentos"

**Campos/Elementos:**
- **Checkbox de aceitação** (obrigatório para cada documento)
- **Botão "Aceitar Todos"** (desabilitado até todos marcados)

**Interações:**
- Usuário pode rolar conteúdo de cada documento
- Usuário marca/desmarca checkboxes
- Usuário clica "Aceitar Todos" (se todos marcados)

### 6.3 Estado: Salvando
**Quando:** Após clicar "Aceitar Todos", enquanto salva no Firestore.  
**Exibição:**
- Botão muda para "Salvando..."
- Ícone de loading (Loader2) com animação
- Botão desabilitado
**Interações:** Nenhuma (usuário aguarda)  
**Duração:** ~1-2 segundos

### 6.4 Estado: Sucesso
**Quando:** Após salvar com sucesso todas as aceitações.  
**Exibição:**
- Toast de sucesso: "Termos aceitos com sucesso"
- Redirecionamento automático para `/`
**Interações:** Nenhuma (redirecionamento automático)

### 6.5 Estado: Erro ao Carregar
**Quando:** Erro ao buscar documentos do Firestore.  
**Exibição:**
- Toast de erro: "Erro ao carregar documentos"
- Descrição do erro
- Usuário permanece na página (pode recarregar)
**Interações:** Usuário pode recarregar página (F5)

### 6.6 Estado: Erro ao Salvar
**Quando:** Erro ao salvar aceitações no Firestore.  
**Exibição:**
- Toast de erro: "Erro ao salvar"
- Descrição do erro
- Usuário permanece na página
- Botão volta ao estado normal
**Interações:** Usuário pode tentar novamente

### 6.7 Estado: Sem Documentos Pendentes
**Quando:** Usuário já aceitou todos os termos.  
**Exibição:** Nenhuma (redirecionamento imediato)  
**Comportamento:** Sistema redireciona para `/` automaticamente

---

## 7. Componentes da Interface

### 7.1 Header Card
- **Componente:** `Card` com `CardHeader`
- **Ícone:** `FileText` (8x8, cor primary)
- **Título:** "Aceite os Termos" (text-2xl)
- **Descrição:** "Para continuar usando o sistema, você precisa aceitar os documentos abaixo"

### 7.2 Document Card (para cada documento)
- **Componente:** `Card` com `CardHeader` e `CardContent`
- **Header:**
  - Título do documento (text-xl)
  - Versão (CardDescription)
- **Content:**
  - Área de conteúdo (max-h-96, overflow-y-auto, border, rounded-lg)
  - Renderização Markdown via `ReactMarkdown`
  - Checkbox de aceitação
  - Label: "Li e aceito [nome do documento]"

### 7.3 Botão de Confirmação
- **Componente:** `Button` (size="lg", full width)
- **Estados:**
  - Normal: "Aceitar Todos os Documentos" + ícone CheckCircle2
  - Desabilitado: Quando nem todos checkboxes marcados
  - Salvando: "Salvando..." + ícone Loader2 (animação)
- **Comportamento:** Chama `handleAcceptAll()` ao clicar

### 7.4 Toast Notifications
- **Sucesso:** "Termos aceitos com sucesso"
- **Erro (carregar):** "Erro ao carregar documentos" + descrição
- **Erro (salvar):** "Erro ao salvar" + descrição
- **Atenção:** "Você precisa aceitar todos os documentos para continuar"

---

## 8. Validações

### 8.1 Validações de Frontend
- **Todos os checkboxes marcados:**
  - Validação: `documents.every((doc) => acceptances[doc.id])`
  - Quando: Antes de habilitar botão "Aceitar Todos"
  - Mensagem: Botão desabilitado (sem mensagem explícita)
  - Se tentar aceitar sem todos: Toast "Você precisa aceitar todos os documentos para continuar"

- **Usuário autenticado:**
  - Validação: `auth.currentUser` existe
  - Quando: Ao carregar página e ao salvar
  - Mensagem: "Você precisa estar autenticado"
  - Ação: Redireciona para `/login`

### 8.2 Validações de Backend (Firestore)
- **Documento existe:**
  - Validação: `document_id` existe na coleção `legal_documents`
  - Quando: Ao salvar aceitação
  - Erro: Firestore retorna erro se documento não existe

- **Usuário existe:**
  - Validação: `user_id` é válido
  - Quando: Ao salvar aceitação
  - Erro: Firestore retorna erro se usuário inválido

### 8.3 Validações de Permissão
- **Firestore Rules:**
  - Usuário só pode criar aceitações para seu próprio `user_id`
  - Usuário só pode ler suas próprias aceitações
  - Apenas admin pode modificar/deletar aceitações

---

## 9. Integrações

### 9.1 Firebase Authentication
- **Tipo:** Serviço de autenticação
- **Método:** `auth.currentUser`
- **Entrada:** Nenhuma (leitura de estado)
- **Retorno:** Objeto User ou null
- **Quando:** Ao carregar página e ao salvar
- **Erros:** Se não autenticado, redireciona para `/login`

### 9.2 Firestore - Coleção `legal_documents`
- **Operação:** Read (getDocs)
- **Query:**
  ```typescript
  query(
    collection(db, "legal_documents"),
    where("status", "==", "ativo"),
    where("required_for_existing_users", "==", true),
    orderBy("order", "asc")
  )
  ```
- **Retorno:** Array de LegalDocument
- **Campos utilizados:** id, title, content, version, status, required_for_existing_users, order
- **Quando:** Ao carregar página (`loadPendingDocuments()`)

### 9.3 Firestore - Coleção `user_document_acceptances`
- **Operação 1:** Read (getDocs) - Buscar aceitações existentes
  - **Query:**
    ```typescript
    query(
      collection(db, "user_document_acceptances"),
      where("user_id", "==", auth.currentUser.uid)
    )
    ```
  - **Retorno:** Array de aceitações do usuário
  - **Quando:** Ao carregar página

- **Operação 2:** Create (addDoc) - Registrar nova aceitação
  - **Payload:**
    ```typescript
    {
      user_id: string,
      document_id: string,
      document_version: string,
      accepted_at: serverTimestamp(),
      ip_address: null,
      user_agent: string
    }
    ```
  - **Quando:** Ao clicar "Aceitar Todos"
  - **Quantidade:** Uma por documento pendente

### 9.4 ReactMarkdown
- **Tipo:** Biblioteca de renderização
- **Entrada:** String Markdown (campo `content` do documento)
- **Retorno:** HTML renderizado
- **Quando:** Ao exibir conteúdo de cada documento
- **Estilo:** Classe `prose prose-sm max-w-none`

### 9.5 Next.js Router
- **Método:** `router.push()`
- **Rotas:**
  - `/login` - Se não autenticado
  - `/` - Após aceitar termos com sucesso
  - `/` - Se não há termos pendentes
- **Quando:** Redirecionamentos automáticos

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ **Autenticação obrigatória:** Página só acessível por usuários logados
- ✅ **Validação de propriedade:** Usuário só pode aceitar termos para si mesmo (user_id = auth.currentUser.uid)
- ✅ **Timestamp do servidor:** Usa `serverTimestamp()` para evitar manipulação de data
- ✅ **Registro de User-Agent:** Captura navegador/dispositivo para auditoria
- ✅ **Validação de todos os documentos:** Não permite aceitação parcial
- ✅ **Firestore Rules:** Devem impedir que usuário crie aceitações para outros usuários

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ **IP Address não capturado:** Campo `ip_address` sempre null. Seria útil para auditoria.
- ⚠️ **Sem rate limiting:** Usuário pode tentar salvar múltiplas vezes rapidamente
- ⚠️ **Sem verificação de leitura:** Sistema não garante que usuário realmente leu o documento (apenas que marcou checkbox)

**Mitigação:**
- IP pode ser capturado via API externa ou Cloud Function
- Rate limiting pode ser implementado no Firestore Rules
- Verificação de leitura (scroll tracking) pode ser adicionada no futuro

### 10.3 Dados Sensíveis
- **user_id:** Protegido por Firestore Rules (usuário só acessa seus próprios dados)
- **document_version:** Não sensível, mas importante para auditoria
- **accepted_at:** Timestamp crítico para prova legal
- **user_agent:** Pode conter informações do dispositivo, mas não é PII

### 10.4 Firestore Rules Recomendadas
```javascript
// user_document_acceptances
match /user_document_acceptances/{acceptanceId} {
  // Usuário pode criar aceitação apenas para si mesmo
  allow create: if request.auth != null 
    && request.resource.data.user_id == request.auth.uid;
  
  // Usuário pode ler apenas suas próprias aceitações
  allow read: if request.auth != null 
    && resource.data.user_id == request.auth.uid;
  
  // Apenas admin pode modificar/deletar
  allow update, delete: if request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// legal_documents
match /legal_documents/{docId} {
  // Todos usuários autenticados podem ler documentos ativos
  allow read: if request.auth != null;
  
  // Apenas admin pode criar/modificar/deletar
  allow write: if request.auth != null 
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

---

## 11. Performance

### 11.1 Métricas Estimadas
- **Tempo de carregamento:** ~1-3 segundos (depende de quantidade de documentos e conexão)
- **Tempo de resposta (salvar):** ~1-2 segundos (múltiplas escritas no Firestore)
- **Tamanho do bundle:** ~15KB (ReactMarkdown adiciona peso)
- **Requisições:**
  - 1 query para documentos ativos
  - 1 query para aceitações do usuário
  - N addDoc (onde N = número de documentos pendentes)

### 11.2 Otimizações Implementadas
- ✅ **Query com filtros:** Busca apenas documentos ativos e obrigatórios
- ✅ **Query com orderBy:** Ordenação no servidor (não no cliente)
- ✅ **Redirecionamento antecipado:** Se não há termos pendentes, redireciona sem renderizar
- ✅ **Estado de loading:** Evita renderização prematura
- ✅ **Promise.all:** Salva todas aceitações em paralelo (não sequencial)

### 11.3 Gargalos Identificados
- ⚠️ **Múltiplas escritas no Firestore:** Se há 5 documentos, são 5 addDoc. Pode ser lento.
- ⚠️ **ReactMarkdown:** Biblioteca pesada para renderizar Markdown. Pode impactar bundle size.
- ⚠️ **Sem cache:** Documentos são buscados toda vez que página carrega

**Plano de melhoria:**
- **Batch write:** Usar `writeBatch()` para salvar todas aceitações em uma única operação
- **Markdown alternativo:** Considerar biblioteca mais leve ou renderização server-side
- **Cache:** Implementar cache de documentos (se não mudam frequentemente)

### 11.4 Exemplo de Otimização com Batch Write
```typescript
import { writeBatch, doc } from "firebase/firestore";

async function handleAcceptAllOptimized() {
  const batch = writeBatch(db);
  
  documents.forEach((document) => {
    const docRef = doc(collection(db, "user_document_acceptances"));
    batch.set(docRef, {
      user_id: auth.currentUser!.uid,
      document_id: document.id,
      document_version: document.version,
      accepted_at: serverTimestamp(),
      ip_address: null,
      user_agent: navigator.userAgent,
    });
  });
  
  await batch.commit(); // Uma única operação
}
```

---

## 12. Melhorias Futuras

### 12.1 Funcionalidades
- [ ] **Captura de IP Address:** Implementar API ou Cloud Function para capturar IP real do usuário
- [ ] **Tracking de leitura:** Verificar se usuário rolou até o final do documento antes de permitir aceitar
- [ ] **Histórico de versões:** Mostrar ao usuário quais versões ele já aceitou anteriormente
- [ ] **Comparação de versões:** Destacar o que mudou entre versão antiga e nova (diff)
- [ ] **Download de documentos:** Permitir que usuário baixe PDF dos termos aceitos
- [ ] **Email de confirmação:** Enviar email com cópia dos termos aceitos
- [ ] **Assinatura digital:** Implementar assinatura eletrônica mais robusta (ex: certificado digital)

### 12.2 UX/UI
- [ ] **Indicador de progresso:** Mostrar "Documento 1 de 3" para múltiplos documentos
- [ ] **Scroll automático:** Ao marcar checkbox, rolar para próximo documento
- [ ] **Highlight de mudanças:** Se é nova versão, destacar o que mudou
- [ ] **Resumo executivo:** Adicionar resumo em linguagem simples antes do texto legal
- [ ] **Tempo estimado de leitura:** Mostrar "~5 minutos de leitura"
- [ ] **Modo escuro:** Suportar tema escuro para leitura confortável
- [ ] **Acessibilidade:** Melhorar navegação por teclado e screen readers

### 12.3 Performance
- [ ] **Batch write:** Usar `writeBatch()` para salvar todas aceitações de uma vez
- [ ] **Lazy loading de conteúdo:** Carregar conteúdo de documentos sob demanda (não todos de uma vez)
- [ ] **Cache de documentos:** Implementar cache local para documentos que não mudam
- [ ] **Markdown server-side:** Renderizar Markdown no servidor para reduzir bundle
- [ ] **Compressão de conteúdo:** Comprimir documentos longos no Firestore

### 12.4 Segurança
- [ ] **Rate limiting:** Implementar limite de tentativas de aceitação
- [ ] **Auditoria completa:** Registrar todas tentativas (sucesso e falha)
- [ ] **Verificação de bot:** Adicionar CAPTCHA para prevenir automação
- [ ] **Assinatura criptográfica:** Gerar hash do documento + timestamp + user_id para prova irrefutável

### 12.5 Administração
- [ ] **Dashboard de aceitações:** Painel admin para ver quem aceitou/não aceitou
- [ ] **Relatórios:** Gerar relatórios de compliance (% de usuários que aceitaram)
- [ ] **Notificações:** Alertar admin quando nova versão é publicada
- [ ] **Testes A/B:** Testar diferentes formatos de apresentação

---

## 13. Observações Técnicas

### 13.1 Decisões de Arquitetura

**Decisão 1: Múltiplas aceitações vs Aceitação única**
- **Escolha:** Criar um registro separado para cada documento aceito
- **Alternativa considerada:** Um único registro com array de documentos
- **Justificativa:** 
  - Facilita queries (buscar aceitações de documento específico)
  - Permite rastrear timestamp individual de cada aceitação
  - Mais flexível para auditoria e relatórios
  - Segue padrão de normalização de dados

**Decisão 2: Redirecionamento automático vs Mensagem**
- **Escolha:** Redirecionar automaticamente para `/` se não há termos pendentes
- **Alternativa considerada:** Mostrar mensagem "Você já aceitou todos os termos"
- **Justificativa:**
  - Melhor UX (usuário não vê página desnecessária)
  - Evita confusão (por que estou vendo esta página?)
  - Mais rápido (não precisa clicar em nada)

**Decisão 3: ReactMarkdown vs HTML puro**
- **Escolha:** Usar ReactMarkdown para renderizar conteúdo
- **Alternativa considerada:** Armazenar HTML diretamente no Firestore
- **Justificativa:**
  - Markdown é mais seguro (evita XSS)
  - Mais fácil de editar para admins
  - Formato padrão e portável
  - Desvantagem: Aumenta bundle size

### 13.2 Padrões Utilizados

**Padrão 1: Loading States**
- **Descrição:** Três estados distintos: loading, saving, normal
- **Aplicação:** Feedback visual claro para usuário em cada etapa
- **Benefício:** Usuário sempre sabe o que está acontecendo

**Padrão 2: Optimistic UI (NÃO usado)**
- **Descrição:** Poderia atualizar UI antes de confirmar salvamento
- **Por que não:** Aceitação de termos é crítica, precisa confirmação real
- **Alternativa:** Aguardar confirmação do Firestore antes de redirecionar

**Padrão 3: Controlled Components**
- **Descrição:** Estado de checkboxes controlado por React (`acceptances` state)
- **Aplicação:** Todos os checkboxes são controlled components
- **Benefício:** Controle total sobre estado, fácil validação

### 13.3 Limitações Conhecidas

- ⚠️ **Sem suporte offline:** Se usuário perde conexão, não pode aceitar termos
- ⚠️ **Sem retry automático:** Se falha ao salvar, usuário precisa tentar manualmente
- ⚠️ **Sem validação de leitura:** Sistema não garante que usuário leu o documento
- ⚠️ **IP sempre null:** Não captura IP real do usuário
- ⚠️ **Sem histórico de tentativas:** Não registra tentativas falhadas

### 13.4 Notas de Implementação

**Nota 1: serverTimestamp() vs new Date()**
- Sempre usar `serverTimestamp()` para garantir timestamp consistente
- Evita problemas de timezone e relógio do cliente desatualizado
- Crítico para prova legal

**Nota 2: Promise.all para múltiplas escritas**
- Salva todas aceitações em paralelo (mais rápido)
- Se uma falha, todas falham (comportamento desejado)
- Alternativa: `writeBatch()` seria ainda melhor

**Nota 3: Filtro de documentos obrigatórios**
- Query busca `required_for_existing_users == true`
- Ignora `required_for_registration` (já foi aceito no registro)
- Se admin mudar flag, usuário verá documento como pendente

**Nota 4: Comparação de versões**
- Sistema compara string exata: "1.0" !== "1.1"
- Não há versionamento semântico (major.minor.patch)
- Admin deve gerenciar versões manualmente

---

## 14. Mensagens do Sistema

### 14.1 Mensagens de Sucesso
| Código | Mensagem | Contexto |
|--------|----------|----------|
| SUCCESS_001 | "Termos aceitos com sucesso" | Após salvar todas aceitações |

### 14.2 Mensagens de Erro
| Código | Mensagem | Contexto |
|--------|----------|----------|
| ERROR_001 | "Erro ao carregar documentos" | Falha ao buscar documentos do Firestore |
| ERROR_002 | "Erro ao salvar" | Falha ao salvar aceitações no Firestore |
| ERROR_003 | "Você precisa estar autenticado" | Usuário não está logado |

### 14.3 Mensagens de Atenção
| Código | Mensagem | Contexto |
|--------|----------|----------|
| WARNING_001 | "Você precisa aceitar todos os documentos para continuar" | Tentou aceitar sem marcar todos checkboxes |

### 14.4 Textos da Interface
| Elemento | Texto |
|----------|-------|
| Título da página | "Aceite os Termos" |
| Descrição | "Para continuar usando o sistema, você precisa aceitar os documentos abaixo" |
| Checkbox label | "Li e aceito [nome do documento]" |
| Botão normal | "Aceitar Todos os Documentos" |
| Botão salvando | "Salvando..." |
| Versão do documento | "Versão [X.X]" |

---

## 15. Comparação com Outras Páginas

### 15.1 Accept Terms vs Register
| Aspecto | Accept Terms | Register |
|---------|--------------|----------|
| **Quando ocorre** | Após login, se há termos pendentes | Antes de criar conta |
| **Documentos** | `required_for_existing_users` | `required_for_registration` |
| **Bloqueio** | Bloqueia acesso ao sistema | Bloqueia criação de conta |
| **Versionamento** | Sim (usuário deve aceitar novas versões) | Não (aceita versão atual) |
| **Redirecionamento** | Para `/` após aceitar | Para `/waiting-approval` após registro |
| **Obrigatoriedade** | Todos os documentos | Todos os documentos |

**Relação:**
- Register aceita termos durante cadastro (primeira vez)
- Accept Terms aceita novas versões ou novos documentos (usuários existentes)
- Ambos usam mesma coleção `user_document_acceptances`

### 15.2 Accept Terms vs Waiting Approval
| Aspecto | Accept Terms | Waiting Approval |
|---------|--------------|------------------|
| **Propósito** | Aceitar documentos legais | Aguardar aprovação de admin |
| **Bloqueio** | Bloqueia por termos pendentes | Bloqueia por falta de custom claims |
| **Ação do usuário** | Usuário aceita termos | Usuário aguarda passivamente |
| **Duração** | Segundos (usuário decide) | Horas/dias (admin decide) |
| **Resolução** | Usuário resolve sozinho | Admin resolve |

**Relação:**
- Ambos bloqueiam acesso ao sistema
- Waiting Approval vem ANTES de Accept Terms no fluxo
- Sequência: Register → Waiting Approval → Accept Terms → Sistema

### 15.3 Accept Terms vs Change Password
| Aspecto | Accept Terms | Change Password |
|---------|--------------|-----------------|
| **Propósito** | Compliance legal | Segurança de senha |
| **Bloqueio** | Via TermsInterceptor | Via ProtectedRoute |
| **Flag** | Nenhuma (verifica documentos) | `requirePasswordChange` |
| **Frequência** | Quando nova versão publicada | Quando admin força |
| **Obrigatoriedade** | Sempre obrigatório | Apenas se flag ativa |

**Relação:**
- Ambos são "bloqueios obrigatórios"
- Podem ocorrer simultaneamente (usuário precisa fazer ambos)
- Ordem: Change Password → Accept Terms (senha tem prioridade)

### 15.4 Fluxo Completo de Onboarding

```
1. Register
   ↓
2. Waiting Approval (admin aprova)
   ↓
3. Login
   ↓
4. Change Password (se requirePasswordChange = true)
   ↓
5. Accept Terms (se há termos pendentes)
   ↓
6. Sistema liberado
```

---

## 16. Testes Recomendados

### 16.1 Cenários de Teste Funcionais

**Teste 1: Aceitação bem-sucedida de múltiplos documentos**
- **Dado:** Usuário logado com 3 documentos pendentes
- **Quando:** Marca todos os checkboxes e clica "Aceitar Todos"
- **Então:** 
  - 3 registros criados em `user_document_acceptances`
  - Toast de sucesso exibido
  - Redirecionado para `/`
  - TermsInterceptor não bloqueia mais

**Teste 2: Tentativa de aceitar sem marcar todos**
- **Dado:** Usuário em `/accept-terms` com 2 documentos
- **Quando:** Marca apenas 1 checkbox
- **Então:** 
  - Botão "Aceitar Todos" permanece desabilitado
  - Não é possível clicar
  - Nenhuma aceitação registrada

**Teste 3: Nova versão de documento**
- **Dado:** Usuário aceitou Termos v1.0
- **Quando:** Admin publica Termos v2.0
- **Então:**
  - Usuário é redirecionado para `/accept-terms` no próximo login
  - Apenas Termos v2.0 aparece como pendente
  - Após aceitar, nova versão registrada

**Teste 4: Usuário sem termos pendentes acessa página**
- **Dado:** Usuário já aceitou todos os termos
- **Quando:** Acessa `/accept-terms` diretamente
- **Então:**
  - Página não é exibida
  - Redirecionamento automático para `/`

**Teste 5: Erro ao salvar aceitações**
- **Dado:** Firestore indisponível ou erro de permissão
- **Quando:** Usuário tenta aceitar termos
- **Então:**
  - Toast de erro exibido
  - Usuário permanece na página
  - Pode tentar novamente

### 16.2 Cenários de Teste de Segurança

**Teste 6: Usuário não autenticado**
- **Dado:** Usuário não está logado
- **Quando:** Tenta acessar `/accept-terms`
- **Então:** Redirecionado para `/login`

**Teste 7: Manipulação de user_id**
- **Dado:** Usuário tenta criar aceitação para outro user_id
- **Quando:** Modifica payload antes de enviar
- **Então:** Firestore Rules devem bloquear (se configuradas corretamente)

**Teste 8: Timestamp manipulado**
- **Dado:** Usuário tenta enviar timestamp customizado
- **Quando:** Modifica `accepted_at` no payload
- **Então:** `serverTimestamp()` sobrescreve valor (não é possível manipular)

### 16.3 Cenários de Teste de Performance

**Teste 9: Múltiplos documentos (10+)**
- **Dado:** Sistema com 10 documentos pendentes
- **Quando:** Usuário aceita todos
- **Então:**
  - Tempo de salvamento < 5 segundos
  - Todas aceitações salvas com sucesso
  - Sem timeout

**Teste 10: Documento muito longo**
- **Dado:** Documento com 50+ páginas de texto
- **Quando:** Usuário carrega página
- **Então:**
  - Renderização < 3 segundos
  - Scroll funciona suavemente
  - Sem travamento

### 16.4 Cenários de Teste de UX

**Teste 11: Navegação por teclado**
- **Dado:** Usuário usa apenas teclado
- **Quando:** Navega pela página
- **Então:**
  - Tab move entre checkboxes
  - Enter marca/desmarca checkbox
  - Enter no botão aceita termos

**Teste 12: Screen reader**
- **Dado:** Usuário usa leitor de tela
- **Quando:** Acessa página
- **Então:**
  - Títulos são anunciados
  - Checkboxes têm labels claros
  - Botão tem descrição adequada

### 16.5 Cenários de Teste de Integração

**Teste 13: Integração com TermsInterceptor**
- **Dado:** Usuário com termos pendentes
- **Quando:** Tenta acessar qualquer rota protegida
- **Então:**
  - TermsInterceptor redireciona para `/accept-terms`
  - Após aceitar, acesso liberado
  - Pode acessar rotas normalmente

**Teste 14: Integração com usePendingTerms hook**
- **Dado:** Hook verifica termos pendentes
- **Quando:** Usuário aceita termos
- **Então:**
  - Hook detecta mudança
  - `hasPendingTerms` muda para false
  - TermsInterceptor para de bloquear

---

## 17. Troubleshooting

### 17.1 Problema: Página não carrega (loading infinito)

**Sintomas:**
- Ícone de loading não para de girar
- Página nunca exibe documentos

**Causas possíveis:**
1. Erro na query do Firestore
2. Firestore Rules bloqueando leitura
3. Coleção `legal_documents` não existe
4. Erro de autenticação

**Solução:**
```typescript
// Adicionar logs para debug
console.log("Buscando documentos...");
console.log("Usuário:", auth.currentUser?.uid);
console.log("Documentos encontrados:", docs.length);
```

**Verificar:**
- Console do navegador para erros
- Firestore Rules permitem leitura de `legal_documents`
- Coleção existe e tem documentos ativos

---

### 17.2 Problema: Botão "Aceitar Todos" não habilita

**Sintomas:**
- Usuário marca todos os checkboxes
- Botão permanece desabilitado

**Causas possíveis:**
1. Estado `acceptances` não está atualizando
2. Lógica de validação incorreta
3. Documento com ID undefined

**Solução:**
```typescript
// Debug do estado
console.log("Acceptances:", acceptances);
console.log("Documents:", documents.map(d => d.id));
console.log("All accepted?", documents.every((doc) => acceptances[doc.id]));
```

**Verificar:**
- Todos os documentos têm ID válido
- Estado `acceptances` tem entrada para cada documento
- Lógica de validação está correta

---

### 17.3 Problema: Erro ao salvar aceitações

**Sintomas:**
- Toast de erro: "Erro ao salvar"
- Aceitações não são registradas

**Causas possíveis:**
1. Firestore Rules bloqueando escrita
2. Campos obrigatórios faltando
3. Tipo de dado incorreto
4. Permissões insuficientes

**Solução:**
```typescript
// Verificar payload
console.log("Salvando aceitação:", {
  user_id: auth.currentUser!.uid,
  document_id: doc.id,
  document_version: doc.version,
});
```

**Verificar:**
- Firestore Rules permitem `create` em `user_document_acceptances`
- Usuário está autenticado
- Todos os campos estão presentes
- Tipos de dados estão corretos

---

### 17.4 Problema: Redirecionamento não funciona

**Sintomas:**
- Após aceitar termos, usuário não é redirecionado
- Permanece em `/accept-terms`

**Causas possíveis:**
1. Erro no `router.push()`
2. TermsInterceptor ainda detecta termos pendentes
3. Aceitações não foram salvas corretamente

**Solução:**
```typescript
// Verificar redirecionamento
console.log("Redirecionando para /");
router.push("/");
```

**Verificar:**
- Aceitações foram salvas no Firestore
- `usePendingTerms` hook detecta mudança
- Não há erro no console

---

### 17.5 Problema: TermsInterceptor continua bloqueando

**Sintomas:**
- Usuário aceitou termos
- Ainda é redirecionado para `/accept-terms`

**Causas possíveis:**
1. Hook `usePendingTerms` não atualizou
2. Cache do hook desatualizado
3. Aceitações não foram salvas
4. Comparação de versões incorreta

**Solução:**
```typescript
// Forçar refetch do hook
const { refetch } = usePendingTerms();
await refetch();
```

**Verificar:**
- Aceitações existem no Firestore
- Versões correspondem (aceita == atual)
- Hook está re-executando após mudança

---

### 17.6 Problema: Documento não renderiza (Markdown)

**Sintomas:**
- Conteúdo do documento aparece em branco
- Markdown não é convertido para HTML

**Causas possíveis:**
1. Campo `content` vazio ou undefined
2. ReactMarkdown não instalado
3. Erro de sintaxe no Markdown

**Solução:**
```typescript
// Verificar conteúdo
console.log("Conteúdo do documento:", doc.content);
```

**Verificar:**
- Campo `content` existe e tem texto
- ReactMarkdown está instalado (`npm list react-markdown`)
- Markdown tem sintaxe válida

---

## 18. Glossário

- **Compliance:** Conformidade com leis e regulamentos. No contexto, garantir que usuários aceitem termos legais.
- **Custom Claims:** Dados customizados armazenados no token JWT do Firebase Auth. Usado para roles e permissões.
- **Legal Document:** Documento legal (Termos de Uso, Política de Privacidade, etc.) que usuário deve aceitar.
- **Markdown:** Linguagem de marcação leve para formatação de texto. Usado para conteúdo dos documentos.
- **Pending Terms:** Termos pendentes de aceitação. Documentos que usuário ainda não aceitou ou versão desatualizada.
- **ReactMarkdown:** Biblioteca React para renderizar Markdown como HTML.
- **serverTimestamp():** Função do Firestore que gera timestamp no servidor (não no cliente). Evita manipulação.
- **TermsInterceptor:** Componente que intercepta navegação e redireciona para `/accept-terms` se há termos pendentes.
- **Toast:** Notificação temporária que aparece na tela (geralmente canto superior direito).
- **User-Agent:** String que identifica navegador e sistema operacional do usuário.
- **Versionamento:** Sistema de controle de versões de documentos (ex: v1.0, v2.0). Usuário deve aceitar cada nova versão.
- **writeBatch():** Método do Firestore para executar múltiplas operações de escrita em uma única transação atômica.

---

## 19. Referências

### 19.1 Documentação Relacionada
- Login Page Documentation - `project_doc/login-page-documentation.md`
- Register Page Documentation - `project_doc/register-page-documentation.md`
- Waiting Approval Documentation - `project_doc/waiting-approval-documentation.md`
- Change Password Documentation - `project_doc/change-password-documentation.md`
- Template de Documentação - `project_doc/TEMPLATE-page-documentation.md`

### 19.2 Links Externos
- Firebase Authentication - https://firebase.google.com/docs/auth
- Firestore Documentation - https://firebase.google.com/docs/firestore
- ReactMarkdown - https://github.com/remarkjs/react-markdown
- Next.js Router - https://nextjs.org/docs/app/api-reference/functions/use-router
- LGPD (Lei Geral de Proteção de Dados) - https://www.gov.br/lgpd

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(auth)/accept-terms/page.tsx`
- **Hook:** `src/hooks/usePendingTerms.ts`
- **Interceptor:** `src/components/auth/TermsInterceptor.tsx`
- **Types:** `src/types/index.ts` (interface LegalDocument)
- **UI Components:** `src/components/ui/` (Button, Card, Checkbox, Toast)

---

## 20. Diagrama de Sequência

```
┌─────────┐         ┌──────────────┐         ┌──────────┐         ┌───────────┐
│ Usuário │         │ Accept Terms │         │ Firestore│         │  Router   │
└────┬────┘         └──────┬───────┘         └────┬─────┘         └─────┬─────┘
     │                     │                      │                     │
     │  Faz login          │                      │                     │
     ├────────────────────>│                      │                     │
     │                     │                      │                     │
     │                     │  Buscar documentos   │                     │
     │                     │  ativos e obrigatórios                     │
     │                     ├─────────────────────>│                     │
     │                     │                      │                     │
     │                     │  Retorna documentos  │                     │
     │                     │<─────────────────────┤                     │
     │                     │                      │                     │
     │                     │  Buscar aceitações   │                     │
     │                     │  do usuário          │                     │
     │                     ├─────────────────────>│                     │
     │                     │                      │                     │
     │                     │  Retorna aceitações  │                     │
     │                     │<─────────────────────┤                     │
     │                     │                      │                     │
     │                     │  Filtrar pendentes   │                     │
     │                     │  (comparar versões)  │                     │
     │                     │                      │                     │
     │  Exibe documentos   │                      │                     │
     │  pendentes          │                      │                     │
     │<────────────────────┤                      │                     │
     │                     │                      │                     │
     │  Lê documento 1     │                      │                     │
     │  Marca checkbox 1   │                      │                     │
     ├────────────────────>│                      │                     │
     │                     │                      │                     │
     │  Lê documento 2     │                      │                     │
     │  Marca checkbox 2   │                      │                     │
     ├────────────────────>│                      │                     │
     │                     │                      │                     │
     │  Clica "Aceitar     │                      │                     │
     │  Todos"             │                      │                     │
     ├────────────────────>│                      │                     │
     │                     │                      │                     │
     │                     │  Validar: todos      │                     │
     │                     │  marcados?           │                     │
     │                     │                      │                     │
     │                     │  Para cada documento:│                     │
     │                     │  Criar aceitação     │                     │
     │                     ├─────────────────────>│                     │
     │                     │                      │                     │
     │                     │  Aceitação 1 salva   │                     │
     │                     │<─────────────────────┤                     │
     │                     │                      │                     │
     │                     │  Criar aceitação 2   │                     │
     │                     ├─────────────────────>│                     │
     │                     │                      │                     │
     │                     │  Aceitação 2 salva   │                     │
     │                     │<─────────────────────┤                     │
     │                     │                      │                     │
     │  Toast: "Termos     │                      │                     │
     │  aceitos com        │                      │                     │
     │  sucesso"           │                      │                     │
     │<────────────────────┤                      │                     │
     │                     │                      │                     │
     │                     │  Redirecionar para / │                     │
     │                     ├─────────────────────────────────────────>│
     │                     │                      │                     │
     │  Página inicial     │                      │                     │
     │<────────────────────┴──────────────────────┴─────────────────────┘
     │                     
```

### Fluxo Alternativo: Erro ao Salvar

```
┌─────────┐         ┌──────────────┐         ┌──────────┐
│ Usuário │         │ Accept Terms │         │ Firestore│
└────┬────┘         └──────┬───────┘         └────┬─────┘
     │                     │                      │
     │  Clica "Aceitar     │                      │
     │  Todos"             │                      │
     ├────────────────────>│                      │
     │                     │                      │
     │                     │  Criar aceitação     │
     │                     ├─────────────────────>│
     │                     │                      │
     │                     │  ERRO (permissão,    │
     │                     │  conexão, etc.)      │
     │                     │<─────────────────────┤
     │                     │                      │
     │  Toast: "Erro ao    │                      │
     │  salvar"            │                      │
     │<────────────────────┤                      │
     │                     │                      │
     │  Permanece na       │                      │
     │  página             │                      │
     │                     │                      │
     │  Pode tentar        │                      │
     │  novamente          │                      │
     │                     │                      │
```

---

**Documento gerado por:** Engenharia Reversa - Kiro AI  
**Última atualização:** 07/02/2026  
**Responsável:** Equipe de Desenvolvimento  
**Revisado por:** Pendente  
**Status:** Completo

