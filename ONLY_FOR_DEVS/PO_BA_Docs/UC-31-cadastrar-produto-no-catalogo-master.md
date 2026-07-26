# UC-31: Cadastrar Produto no Catálogo Master

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Aprovado
**Módulo/Contexto:** Administração do Sistema (Catálogo de Produtos Master — Rennova)
**Versão:** 1.0.1

> Um System Admin cadastra um novo produto no catálogo master Rennova (código de 7 dígitos, nome, categoria opcional, e se é fragmentável) diretamente em `/admin/products/new`. **Diferente do módulo de Consultores (UC-28/UC-29) e de Clínicas (UC-21/UC-22)**, não existe nenhuma rota `/api/*` nem Cloud Function intermediando esta operação — o formulário grava diretamente no Firestore via client SDK (`addDoc`), e a única barreira de autorização real é a própria regra de segurança do Firestore (`allow write: if isSystemAdmin()`, hoje dividida em `create`/`update`/`delete`). **[CORRIGIDO no commit `7c3cbb2` — RN-02]** Desde então, a regra de segurança de `master_products` também valida o **formato** dos dados diretamente no servidor — `code` deve casar com `^[0-9]{7}$` e `name` deve ser uma string não vazia, tanto em `create` quanto em `update` (neste caso, apenas para os campos efetivamente enviados no payload) — mitigando, ainda que parcialmente, a lacuna original de validação exclusivamente client-side.

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
    UC31 -.->|grava direto via\nclient SDK, com validação\nde formato em firestore.rules| MasterProducts[(master_products)]
```

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** — tela restrita por `ProtectedRoute allowedRoles: ['system_admin']` (`src/app/(admin)/layout.tsx`).

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo envolvido. Não há Firebase Auth, e-mail, nem API route — a única "camada" de proteção é a regra de segurança do Firestore, avaliada no momento da escrita (que, desde o commit `7c3cbb2`, também valida formato — ver RN-02).

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
- Se, apesar da validação de client, o payload enviado ao Firestore não satisfizer a validação de formato da regra de segurança (`code` fora de `^[0-9]{7}$`, ou `name` vazio/ausente) — cenário só alcançável contornando a UI — a escrita é rejeitada pelo próprio Firestore (`PERMISSION_DENIED`); nenhum documento é criado (RN-02).
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
11. **[CORRIGIDO no commit `7c3cbb2` — RN-02]** A regra de segurança de `master_products` (`allow create`) revalida no servidor que `code` casa com `^[0-9]{7}$` e que `name` é uma string não vazia antes de aceitar a escrita — como o client já normaliza esses campos no passo 10, este passo é transparente no caminho feliz.
12. Sistema redireciona para `/admin/products`.
13. Caso de uso é concluído com sucesso.

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
1. `addDoc` falha (rede, permissão negada por token expirado, formato rejeitado pela regra de segurança desde `7c3cbb2` — RN-02 —, etc.).
2. Sistema exibe "Erro ao criar produto" (ou a mensagem específica do erro); nenhum documento é criado.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | A checagem de duplicidade de código (`getMasterProductByCode` antes do `addDoc`) não é atômica — em tese, duas criações simultâneas com o mesmo código poderiam ambas passar pela checagem antes de qualquer uma gravar, resultando em dois documentos com o mesmo `code` (o Firestore não impõe unicidade de campo, apenas de id de documento). Mesma categoria de risco já identificada para a geração de código de consultor (UC-28, RN-02), porém sem nenhuma tentativa de retry aqui. | Confirmado por leitura de `createMasterProduct` — `getMasterProductByCode` seguido de `addDoc`, sem transação. |
| RN-02 | **[CORRIGIDO no commit `7c3cbb2`]** Antes: toda a validação de formato (código com 7 dígitos, nome obrigatório, unidades por embalagem ≥ 2 quando fragmentável) ocorria **exclusivamente no client** (`new/page.tsx`) — não existia rota `/api/products/*` nem Cloud Function revalidando esses dados, e a única barreira real era a regra `allow write: if isSystemAdmin()`, que validava **quem** podia escrever, mas nada sobre **o formato** do que era escrito. Agora: a regra de `master_products` foi dividida em `allow create`/`allow update`/`allow delete` (antes, um único `allow write`), com `create` e `update` validando `request.resource.data.code.matches('^[0-9]{7}$')` e `request.resource.data.name is string && request.resource.data.name.size() > 0` — em `update`, cada validação só é exigida se o campo correspondente estiver de fato presente no payload (`!('code' in request.resource.data) || ...`), permitindo atualizações parciais que não tocam `code`/`name` sem revalidação desnecessária. Esta coleção é de nível raiz, sem `tenant_id` — diferente das subcoleções de tenant, onde uma condição adicional em `allow write` pode ser contornada por semântica OR já documentada em outros UCs, aqui a validação dedicada em `create`/`update` é genuinamente efetiva. **Lacuna residual:** a validação de `unidades_por_embalagem` (obrigatório e ≥ 2 quando `fragmentavel === true`) **não** foi incluída na regra corrigida — continua sendo aplicada exclusivamente no client. | Confirmado por leitura do diff do commit `7c3cbb2` em `firestore.rules` (`match /master_products/{productId}`, novas regras `allow create`/`allow update`/`allow delete`), e por leitura completa da regra resultante — ausência de qualquer validação de `unidades_por_embalagem` ou `fragmentavel`. |
| RN-03 | Produto sempre é criado com `active: true` — a tela de criação não oferece nenhuma opção para cadastrar um produto já inativo/descontinuado. | Confirmado por leitura de `new/page.tsx` — `createMasterProduct` é chamado sem o campo `active`, e o serviço aplica o padrão `true`. |
| RN-04 | O botão "Cadastrar Produto" da fila de pendências (UC-12) não passa nenhum parâmetro/prefill para esta tela — comportamento já confirmado e documentado em UC-12 (RN-01 daquele UC). | Confirmado por leitura de `pending-products/page.tsx` (`router.push('/admin/products/new')`, sem query params) e desta tela (sem leitura de `searchParams`). |
| RN-05 | `master_products` é uma coleção **global**, sem `tenant_id` — é o catálogo único do fornecedor Rennova, compartilhado por todos os tenants. A regra do Firestore permite leitura a **qualquer usuário autenticado e ativo**, de qualquer role/tenant (`allow read: if isAuthenticated()`), mas restringe escrita a `system_admin`. Este é o único módulo do sistema em que a regra de negócio central é a **ausência deliberada** de isolamento por `tenant_id` na leitura. | Confirmado em `firestore.rules` (`match /master_products/{productId}`). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Mitigado no commit `7c3cbb2`]** A ausência de validação server-side de formato de dados (RN-02) foi parcialmente corrigida — `code` e `name` agora são validados diretamente em `firestore.rules`. Permanece uma lacuna residual: `unidades_por_embalagem` continua validado apenas no client, e o módulo ainda não segue o padrão de API route com Admin SDK adotado em Consultores e Clínicas. | Confiabilidade |
| RNF-02 | Leitura ampla e sem isolamento por tenant (RN-05) é intencional para este catálogo — deve ser preservada, mas é uma exceção explícita à regra geral de multi-tenant do projeto (CLAUDE.md). | Multi-tenant |

---

## 11. Frequência de Uso
Ocasional — cadastro de produtos novos no catálogo ocorre apenas quando a Rennova lança um item novo, ou quando surge uma pendência (UC-12) por um código não encontrado durante a importação de NF-e (UC-10).

---

## 12. Casos de Uso Relacionados
- **UC-12 (Resolver Produtos Pendentes de Cadastro)** — o botão "Cadastrar Produto" daquela fila leva a este UC, sem prefill (RN-04).
- **UC-10 (Importar NF-e via Upload de XML)** — consome o catálogo master via `getMasterProductByCode`, que, desde o commit `7c3cbb2`, passou a considerar também a flag `active` do produto encontrado (ver UC-32, RN-03, para a análise completa desse comportamento corrigido).
- **UC-11 (Inserir Nota Fiscal Manualmente)** — consome o catálogo master via `loadMasterProducts`, filtrado por `active: true` (RN-04 daquele UC).
- **UC-32 (Editar, Ativar e Desativar Produto no Catálogo Master)** — ciclo de vida completo do produto criado por este UC.

---

## 13. Referências
- `src/app/(admin)/admin/products/new/page.tsx`
- `src/lib/services/masterProductService.ts` (`createMasterProduct`, `getMasterProductByCode`)
- `src/types/masterProduct.ts` (`MasterProduct`, `CreateMasterProductData`, `MASTER_PRODUCT_CATEGORIES`, `validateProductCode`, `normalizeProductName`)
- `src/app/(admin)/layout.tsx` (`ProtectedRoute allowedRoles`)
- `firestore.rules` (`match /master_products/{productId}` — `allow create`/`allow update`/`allow delete`, RN-02)
- Commit da correção: `7c3cbb2` (`fix: seis itens de media severidade (UC-31, UC-32, UC-33, UC-34)`) — validação de formato (`code`, `name`) em `firestore.rules` para `master_products` (RN-02)

---

## 14. Perguntas em Aberto / Decisões Pendentes

1. ~~**[RN-02]** Ausência de validação server-side de formato de dados — decisão de produto pendente sobre se vale a pena introduzir uma rota `/api/products/*` (Admin SDK) para alinhar este módulo ao padrão de Consultores/Clínicas, ou se o risco é aceitável dado que o público-alvo é restrito a `system_admin`.~~ **[RESOLVIDO PARCIALMENTE no commit `7c3cbb2` — UC-31-RN-02]** A regra do Firestore (`master_products`) agora valida `code` (7 dígitos) e `name` (string não vazia) diretamente no servidor, em `create` e `update`. Decisão residual pendente: `unidades_por_embalagem` continua validado apenas no client — avaliar se vale adicionar essa validação também na regra, ou se o risco é aceitável (campo secundário, público restrito a `system_admin`); e se ainda vale a pena introduzir uma rota `/api/products/*` dedicada para alinhar este módulo ao padrão de Consultores/Clínicas.
2. **[RN-01]** Janela de corrida teórica na checagem de duplicidade de código — risco baixo (cadastro é uma operação ocasional, raramente concorrente), mas existente.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada do zero a partir de `masterProductService.ts`, `admin/products/new/page.tsx` e `firestore.rules`. Confirmado que não há rota `/api/products/*` nem Cloud Function — toda a operação é client SDK direto, com validação de formato exclusivamente no client (RN-02, achado arquitetural). Confirmada a ausência de isolamento por tenant no catálogo master, deliberada (RN-05). Primeiro UC do módulo "Admin — Catálogo de Produtos Master". |
| 1.0.1 | 26/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-31-RN-02): a regra de segurança de `master_products` em `firestore.rules` foi dividida em `allow create`/`allow update`/`allow delete` (antes, um único `allow write: if isSystemAdmin()`), com `create`/`update` validando `code.matches('^[0-9]{7}$')` e `name` como string não vazia — em `update`, apenas para os campos efetivamente enviados no payload. Corrigido no commit `7c3cbb2`. Registrada a lacuna residual: `unidades_por_embalagem` continua validado apenas no client. Atualizados resumo do cabeçalho, diagrama (Seção 1), Pós-condição 4.2, Fluxo Principal (novo passo 11), Fluxo de Exceção 8e, RN-02 (marcado `[CORRIGIDO]`), RNF-01, Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO PARCIALMENTE]`). |
