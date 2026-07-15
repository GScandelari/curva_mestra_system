# UC-31: Cadastrar Produto no Catálogo Master

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Catálogo de Produtos Master — Rennova)
**Versão:** 1.0

> Um System Admin cadastra um novo produto no catálogo master Rennova (código de 7 dígitos, nome, categoria opcional, e se é fragmentável) diretamente em `/admin/products/new`. **Diferente do módulo de Consultores (UC-28/UC-29) e de Clínicas (UC-21/UC-22)**, não existe nenhuma rota `/api/*` nem Cloud Function intermediando esta operação — o formulário grava diretamente no Firestore via client SDK (`addDoc`), e a única barreira de autorização real é a própria regra de segurança do Firestore (`allow write: if isSystemAdmin()`), sem qualquer revalidação de formato de dados no backend.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])

    subgraph Sistema["Curva Mestra"]
        UC12(("UC-12\nResolver Produtos\nPendentes de Cadastro"))
        UC31(("UC-31\nCadastrar Produto no\nCatálogo Master"))
    end

    SystemAdmin --> UC31
    UC12 -.->|"Cadastrar Produto"\n(sem prefill)| UC31
    UC31 -.->|grava direto via\nclient SDK, sem API/Function| MasterProducts[(master_products)]
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']` (`src/app/(admin)/layout.tsx`).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo envolvido. Não há Firebase Auth, e-mail, nem API route — a única "camada" de proteção é a regra de segurança do Firestore, avaliada no momento da escrita.

---

## 3. Pré-condições
- System Admin autenticado, com custom claim `is_system_admin === true` e `active === true` (exigido por `isAuthenticated()` nas regras do Firestore).
- Não existe nenhum produto em `master_products` com o mesmo `code`.

---

## 4. Pós-condições

### 4.1 Sucesso
- Um documento é criado em `master_products` com: `code` (7 dígitos, trim), `name` (maiúsculas), `active: true` (padrão — a tela de criação não oferece opção de criar já inativo), `fragmentavel` (`true`/`false`), `category` (se selecionada), `unidades_por_embalagem` (apenas se `fragmentavel === true`), `created_at`/`updated_at` (`serverTimestamp()`).
- System Admin é redirecionado para `/admin/products` (listagem).

### 4.2 Falha (Garantias Mínimas)
- Se qualquer validação de client falhar (código, nome, unidades) ou o código já existir no catálogo: nenhum documento é criado; erro exibido inline no formulário.
- Não há nenhuma escrita parcial possível — é uma única operação `addDoc`.

---

## 5. Gatilho (Trigger)
- **Direto:** System Admin acessa `/admin/products` e clica em "Novo Produto".
- **Indireto (UC-12):** System Admin, na fila de produtos pendentes (`/admin/pending-products`), clica em "Cadastrar Produto" numa linha da fila — navega para a mesma tela, **sem nenhum prefill** de código ou nome (RN-04, e já documentado em UC-12 RN-01).

---

## 6. Fluxo Principal (Basic Flow)

1. System Admin acessa `/admin/products/new`.
2. Preenche "Código do Produto" — input aceita apenas dígitos, limitado a 7 caracteres (`formatCodeInput` remove tudo que não é dígito e corta em 7).
3. Preenche "Nome do Produto" — uma pré-visualização abaixo mostra o nome final (sempre convertido para maiúsculas via `normalizeProductName`).
4. Opcionalmente seleciona uma "Categoria" (uma das 7 fixas: Preenchedores, Bioestimuladores, Fios de PDO, Toxina, Cannulas, Care Home, Care Professional).
5. Opcionalmente ativa o switch "Produto Fragmentável" — ao ativar, exibe o campo obrigatório "Unidades por Embalagem" (mínimo 2); ao desativar, o campo é limpo.
6. System Admin clica em "Criar Produto".
7. Sistema valida no client: código não vazio e com exatamente 7 dígitos (`validateProductCode`); nome não vazio; se `fragmentavel === true`, `unidades_por_embalagem` preenchido e ≥ 2.
8. Sistema chama `createMasterProduct({ code, name, category, fragmentavel, unidades_por_embalagem })` (sem `active` — o serviço aplica o padrão `true`).
9. `createMasterProduct` verifica duplicidade de código via `getMasterProductByCode(code)` — se já existir, lança erro "Já existe um produto com o código {code}" e nada é gravado (RN-01).
10. `createMasterProduct` monta o objeto (`code.trim()`, `name.trim().toUpperCase()`, `active: true`, `fragmentavel`, `category` se definida, `unidades_por_embalagem` apenas se `fragmentavel && unidades_por_embalagem !== undefined`, `created_at`/`updated_at: serverTimestamp()`) e executa `addDoc(collection(db, 'master_products'), productData)`.
11. Sistema redireciona para `/admin/products`.
12. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Acesso via fila de pendências (a partir do passo 1, ver UC-12)
1. System Admin chega a esta tela clicando em "Cadastrar Produto" na fila de `/admin/pending-products` (UC-12).
2. Nenhum dado da pendência é transferido — o admin precisa copiar manualmente o código e o nome exibidos na fila (já documentado como RN-01 do UC-12).
3. Segue o fluxo principal normalmente a partir do passo 2.
4. Ao concluir o cadastro, o admin **não é redirecionado de volta à fila** nem a pendência é removida automaticamente — ele precisa voltar manualmente a `/admin/pending-products` e usar "Marcar Resolvido" (UC-12, Fluxo Principal 7b).

---

## 8. Fluxos de Exceção

### 8a. Código inválido
1. Código vazio ou com menos/mais de 7 dígitos (não deveria ocorrer via UI, já que o input já corta em 7, mas o botão "Criar Produto" ainda revalida).
2. Sistema exibe "Código inválido. O código deve ter 7 dígitos."; nenhuma chamada ao Firestore é feita.

### 8b. Nome vazio
1. Campo "Nome do Produto" vazio ou só espaços.
2. Sistema exibe "Nome do produto é obrigatório"; nenhuma chamada ao Firestore é feita.

### 8c. Produto fragmentável sem unidades válidas
1. `fragmentavel === true` e `unidades_por_embalagem` vazio ou menor que 2.
2. Sistema exibe "Produto fragmentável requer unidades por embalagem (mínimo 2)"; nenhuma chamada ao Firestore é feita.

### 8d. Código duplicado
1. `getMasterProductByCode(code)` encontra um produto existente com o mesmo código.
2. `createMasterProduct` lança "Já existe um produto com o código {code}"; sistema exibe o erro; nenhum documento é criado.

### 8e. Falha genérica do Firestore
1. `addDoc` falha (rede, permissão negada por token expirado, etc.).
2. Sistema exibe "Erro ao criar produto" (ou a mensagem específica do erro); nenhum documento é criado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A checagem de duplicidade de código (`getMasterProductByCode` antes do `addDoc`) não é atômica — em tese, duas criações simultâneas com o mesmo código poderiam ambas passar pela checagem antes de qualquer uma gravar, resultando em dois documentos com o mesmo `code` (o Firestore não impõe unicidade de campo, apenas de id de documento). Mesma categoria de risco já identificada para a geração de código de consultor (UC-28, RN-02), porém sem nenhuma tentativa de retry aqui. | Confirmado por leitura de `createMasterProduct` — `getMasterProductByCode` seguido de `addDoc`, sem transação. |
| RN-02 | **[Achado arquitetural]** Toda a validação de formato (código com 7 dígitos, nome obrigatório, unidades por embalagem ≥ 2 quando fragmentável) ocorre **exclusivamente no client** (`new/page.tsx`). Não existe rota `/api/products/*` nem Cloud Function revalidando esses dados — `masterProductService.ts` roda no browser e grava direto no Firestore. A única barreira de fato é a regra de segurança (`allow write: if isSystemAdmin()`), que valida **quem** pode escrever, mas nada sobre **o formato** do que é escrito. Um cliente que contorne a tela (ex.: chamando `addDoc` diretamente com as credenciais de um `system_admin`) poderia gravar um produto com código fora do padrão de 7 dígitos, ou `fragmentavel: true` sem `unidades_por_embalagem`. | Confirmado pela ausência de qualquer rota em `src/app/api/products/` (não existe) e por leitura completa de `masterProductService.ts`, que não usa Admin SDK. |
| RN-03 | Produto sempre é criado com `active: true` — a tela de criação não oferece nenhuma opção para cadastrar um produto já inativo/descontinuado. | Confirmado por leitura de `new/page.tsx` — `createMasterProduct` é chamado sem o campo `active`, e o serviço aplica o padrão `true`. |
| RN-04 | O botão "Cadastrar Produto" da fila de pendências (UC-12) não passa nenhum parâmetro/prefill para esta tela — comportamento já confirmado e documentado em UC-12 (RN-01 daquele UC). | Confirmado por leitura de `pending-products/page.tsx` (`router.push('/admin/products/new')`, sem query params) e desta tela (sem leitura de `searchParams`). |
| RN-05 | `master_products` é uma coleção **global**, sem `tenant_id` — é o catálogo único do fornecedor Rennova, compartilhado por todos os tenants. A regra do Firestore permite leitura a **qualquer usuário autenticado e ativo**, de qualquer role/tenant (`allow read: if isAuthenticated()`), mas restringe escrita a `system_admin`. Este é o único módulo do sistema em que a regra de negócio central é a **ausência deliberada** de isolamento por `tenant_id` na leitura. | Confirmado em `firestore.rules` (`match /master_products/{productId}`). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Ausência de validação server-side de formato de dados (RN-02) é uma lacuna de robustez em relação ao padrão adotado em outros módulos administrativos (Consultores, Clínicas), que usam API routes com Admin SDK. | Confiabilidade |
| RNF-02 | Leitura ampla e sem isolamento por tenant (RN-05) é intencional para este catálogo — deve ser preservada, mas é uma exceção explícita à regra geral de multi-tenant do projeto (CLAUDE.md). | Multi-tenant |

---

## 11. Frequência de Uso
Ocasional — cadastro de produtos novos no catálogo ocorre apenas quando a Rennova lança um item novo, ou quando surge uma pendência (UC-12) por um código não encontrado durante a importação de NF-e (UC-10).

---

## 12. Casos de Uso Relacionados
- **UC-12 (Resolver Produtos Pendentes de Cadastro)** — o botão "Cadastrar Produto" daquela fila leva a este UC, sem prefill (RN-04).
- **UC-10 (Importar NF-e via Upload de XML)** — consome o catálogo master via `getMasterProductByCode`, que **não filtra por `active`** (ver UC-32, RN-03, para a análise completa desse comportamento).
- **UC-11 (Inserir Nota Fiscal Manualmente)** — consome o catálogo master via `loadMasterProducts`, filtrado por `active: true` (RN-04 daquele UC).
- **UC-32 (Editar, Ativar e Desativar Produto no Catálogo Master)** — ciclo de vida completo do produto criado por este UC.

---

## 13. Referências
- `src/app/(admin)/admin/products/new/page.tsx`
- `src/lib/services/masterProductService.ts` (`createMasterProduct`, `getMasterProductByCode`)
- `src/types/masterProduct.ts` (`MasterProduct`, `CreateMasterProductData`, `MASTER_PRODUCT_CATEGORIES`, `validateProductCode`, `normalizeProductName`)
- `src/app/(admin)/layout.tsx` (`ProtectedRoute allowedRoles`)
- `firestore.rules` (`match /master_products/{productId}`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. **[RN-02]** Ausência de validação server-side de formato de dados — decisão de produto pendente sobre se vale a pena introduzir uma rota `/api/products/*` (Admin SDK) para alinhar este módulo ao padrão de Consultores/Clínicas, ou se o risco é aceitável dado que o público-alvo é restrito a `system_admin`.
2. **[RN-01]** Janela de corrida teórica na checagem de duplicidade de código — risco baixo (cadastro é uma operação ocasional, raramente concorrente), mas existente.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `masterProductService.ts`, `admin/products/new/page.tsx` e `firestore.rules`. Confirmado que não há rota `/api/products/*` nem Cloud Function — toda a operação é client SDK direto, com validação de formato exclusivamente no client (RN-02, achado arquitetural). Confirmada a ausência de isolamento por tenant no catálogo master, deliberada (RN-05). Primeiro UC do módulo "Admin — Catálogo de Produtos Master". |
