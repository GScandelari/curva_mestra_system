# Feature Specification: Trilha de Auditoria — Consultar e Exportar (UC-53)

**Projeto:** Curva Mestra
**Data:** 23/09/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** três branches sequenciais a partir de `develop` (ver Seção 0 — escopo fatiado pelos mesmos critérios técnicos autorizados no UC-51):
- `feature/uc53-audit-log-foundation`
- `feature/uc53-instrumentar-escritas-administrativas`
- `feature/uc53-tela-trilha-auditoria`
**Prioridade:** Média
**Versão:** 1.0

> Implementa o UC-53 (`ONLY_FOR_DEVS/PO_BA_Docs/UC-53-consultar-e-exportar-trilha-de-auditoria.md`, v1.0, Aprovado): uma nova coleção `audit_log` (top-level, cross-tenant) alimentada por log explícito em 14 pontos de escrita administrativa sensível (Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais, Configurações Globais), unificada na apresentação com o `inventory_activity` já existente, e exposta em duas telas novas — `/admin/audit-log` (System Admin, cross-tenant) e `/clinic/audit-log` (Clinic Admin, restrito ao próprio tenant) — com exportação em CSV e PDF. Nenhum dado retroativo: a trilha só registra a partir da implementação. Esta spec resolve, como achado técnico não bloqueante (Seção 4.1), uma divergência entre a tabela RN-02 do UC-53 (que aponta `tenantServiceDirect.ts`/`updateTenant` como ponto único de hook para a edição cadastral de Clínica) e a RN-10 do mesmo UC (que exclui explicitamente do escopo a edição do próprio perfil pelo `clinic_admin`, UC-45): como `updateTenant()` é a mesma função usada pelos dois fluxos, o hook é implementado no *call site* de `/admin/tenants/[id]/page.tsx`, nunca dentro do service compartilhado.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop`, para cada uma das três branches.
- **Fatiamento em três branches sequenciais**, pelo mesmo critério técnico já autorizado e usado no UC-51 (Seção 14, item 6 daquele UC): "se o `dev-task-manager` considerar o escopo grande demais para uma única entrega, pode fatiar em múltiplas tasks/PRs sem dividir o UC". Motivo do corte, nesta ordem: (1) a fundação (tipos, coleção, regra, índices, função pura de payload, service de escrita/leitura) precisa existir e estar testada antes de qualquer ponto de escrita poder ser instrumentado; (2) a instrumentação toca 14 arquivos de escrita administrativa já existentes (Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais, Configurações Globais) — mudanças pequenas e mecânicas por arquivo, mas numerosas, sem nenhuma dependência de UI; (3) a tela de consulta/exportação é a única parte com superfície de UI nova e é o que o `qa-agent` efetivamente consegue testar via Playwright (não há como testar E2E a trilha sem a tela). Cortar nessas três fronteiras mantém cada PR dentro da recomendação de ~400 linhas de diff (Seção 7.2 do `GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`) e evita um PR gigante misturando regra de segurança, 14 pontos de escrita e 2 telas novas.
- Fluxo de PR obrigatório para cada branch: `feature/uc53-*` → PR → `gscandelari_setup` (validação no Firebase pessoal) → PR → `develop`. **Nunca** abrir PR direto para `master`. Cada branch subsequente parte de `develop` **após** o merge da anterior (mesmo padrão do UC-51).

### Branch A — `feature/uc53-audit-log-foundation`

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 1 | `feat` | `types` | `add AuditLogEntry, AuditEntityType and AuditAction types` |
| 2 | `feat` | `admin` | `add pure audit log payload builder and action-diff helpers` |
| 3 | `test` | `admin` | `add unit tests for audit log payload builder and action helpers` |
| 4 | `feat` | `firebase` | `add firestore.rules for audit_log collection` |
| 5 | `feat` | `firebase` | `add firestore.indexes.json for audit_log and inventory_activity collection group` |
| 6 | `feat` | `admin` | `add writeAuditLog and listAuditLog to auditLogService` |

### Branch B — `feature/uc53-instrumentar-escritas-administrativas` (a partir de `develop`, após merge da Branch A)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 7 | `feat` | `admin` | `add audit log hooks to user management API routes` |
| 8 | `feat` | `admin` | `add audit log hooks to consultant management API routes` |
| 9 | `feat` | `admin` | `add audit log hooks to tenant creation, suspension and edit` |
| 10 | `feat` | `admin` | `add audit log hooks to master product service` |
| 11 | `feat` | `admin` | `add audit log hooks to legal documents and system settings` |

### Branch C — `feature/uc53-tela-trilha-auditoria` (a partir de `develop`, após merge da Branch B)

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| 12 | `feat` | `admin` | `add audit log query screen for system_admin` |
| 13 | `feat` | `admin` | `add audit log query screen for clinic_admin` |
| 14 | `feat` | `admin` | `add CSV and PDF export to audit log screens` |
| 15 | `test` | `admin` | `add UC-53 Playwright spec (qa-agent, revisado)` |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

- **Não existe hoje nenhuma trilha de auditoria de ações administrativas.** Confirmado por leitura de todo o código: a única forma de rastreamento de mudanças é `inventory_activity` (`writeActivityLogs`, `src/lib/services/solicitacaoService.ts` linhas 117-151), que grava exclusivamente movimentações de estoque (`reserva`/`consumo_imediato`/etc.) em `tenants/{tenantId}/inventory_activity`, chamada em 4 pontos do mesmo arquivo (linhas 325, 442, 901, 914). Campos gravados hoje: `tenant_id`, `inventory_item_id`, `produto_codigo`, `produto_nome`, `lote`, `tipo`, `quantidade`, `quantidade_anterior`, `quantidade_posterior`, `descricao`, `solicitacao_id`, `created_by`, `created_by_name`, `timestamp`. Essa coleção nunca foi exposta em nenhuma tela — confirmado por `grep` em todo `src/`, sem nenhum consumidor de leitura.
- **A busca por `audit_log` no código-fonte não retorna nenhum resultado** fora dos próprios documentos de planejamento (`_MAPA-DE-BUGS-E-MELHORIAS.md`, o UC-53) — a coleção é 100% nova, sem nenhum precedente parcial.
- **`firestore.rules`** hoje só define regras para coleções top-level já existentes (`tenants/{tenantId}`, `users`, `master_products`, `produtos_master`, `products`, `pending_master_products`, `email_queue`, `password_reset_tokens`, `legal_documents`, `user_document_acceptances`, `system_settings`, `consultants`, `consultant_claims`) mais a regra genérica de subcoleção `tenants/{tenantId}/{document=**}`. Nenhuma regra cobre `audit_log` — precisa ser criada do zero. O padrão de auditoria imutável já existe no projeto em `user_document_acceptances` (`allow update, delete: if false`), reaproveitado como referência direta.
- **Todos os 14 pontos de escrita mapeados pelo UC-53 (RN-02) foram confirmados por leitura direta nesta investigação**, com a camada de escrita exata:
  - **Usuários** (Admin SDK, API routes): `src/app/api/users/create/route.ts` (POST, cria via `adminAuth.createUser` + `adminDb.collection('users').set`), `src/app/api/users/[id]/route.ts` (PUT, atualiza `role`/`active`/`displayName` com defesa contra "último admin"), `src/app/api/users/[id]/set-password/route.ts` (POST, `adminAuth.updateUser({ password })`), `src/app/api/users/[id]/reset-password/route.ts` (POST, gera token e enfileira e-mail, não define senha diretamente).
  - **Consultores** (Admin SDK, API routes): `src/app/api/consultants/route.ts` (POST, cria consultor + usuário Auth + doc `users`), `src/app/api/consultants/[id]/route.ts` (PUT, atualiza `name`/`phone`/`email`/`status`; DELETE, marca `status: 'inactive'` e desabilita o usuário), `src/app/api/consultants/[id]/set-password/route.ts` (POST, idêntico ao de usuários).
  - **Clínicas** (Admin SDK para criar/suspender/reativar; **Client SDK direto** para editar): `src/app/api/tenants/create/route.ts` (POST, cria tenant + admin), `src/app/api/tenants/[id]/suspend/route.ts` (POST suspende, DELETE reativa, ambos via Admin SDK e em cascata sobre todos os usuários do tenant), `src/lib/services/tenantServiceDirect.ts` (`updateTenant`, `updateDoc` puro via client SDK, **sem nenhuma informação de ator no payload atual** — recebe só `tenantId` e `data`).
  - **Produtos Master** (100% Client SDK direto): `src/lib/services/masterProductService.ts` — `createMasterProduct`, `updateMasterProduct`, `deactivateMasterProduct`, `reactivateMasterProduct`, todas via `addDoc`/`updateDoc` direto, sem nenhum parâmetro de ator hoje. Confirmado por leitura de todos os chamadores (`grep` em `src/app`) que essas 4 funções só são importadas por `src/app/(admin)/admin/products/page.tsx`, `.../products/[id]/page.tsx` e `.../products/new/page.tsx` — todas dentro do grupo de rota `(admin)`, protegido por `ProtectedRoute allowedRoles={['system_admin']}` (`src/app/(admin)/layout.tsx`). Não há nenhum caminho de `clinic_admin`/`clinic_user` até essas funções.
  - **Documentos Legais** (100% Client SDK direto): `src/components/admin/LegalDocumentForm.tsx` (`performSave`, dois ramos — `addDoc` para criar, `updateDoc` para editar/publicar, ambos usando `auth.currentUser!.uid` já hoje só para `created_by`), `src/app/(admin)/admin/legal-documents/page.tsx` (`handleDelete`, `deleteDoc` direto, bloqueado se já houver aceites registrados).
  - **Configurações Globais** (100% Client SDK direto): `src/app/(admin)/admin/settings/page.tsx` (`handleSave`, `setDoc` em `system_settings/global`, já grava `updated_by: auth.currentUser.uid`).
- **Achado técnico não documentado no UC-53**: `tenantServiceDirect.ts`/`updateTenant` é chamada em **dois pontos distintos e com escopos de auditoria opostos**: `src/app/(admin)/admin/tenants/[id]/page.tsx` linha 162 (System Admin editando qualquer clínica, UC-22 — **dentro do escopo** do UC-53 por RN-02) e `src/app/(clinic)/clinic/setup/page.tsx` linha 267 (Clinic Admin completando o próprio onboarding, UC-45 — **explicitamente fora de escopo** pela RN-10 do UC-53: *"Fora de escopo nesta versão... edição do próprio perfil da clínica pelo `clinic_admin` ('Minha Clínica'/UC-45)"*). Como é a mesma função compartilhada, instrumentar `updateTenant()` por dentro geraria uma entrada de auditoria também para o fluxo de onboarding do Clinic Admin, contradizendo a RN-10. A tela `/clinic/my-clinic` (`src/app/(clinic)/clinic/my-clinic/page.tsx`) não chama `updateTenant` — é a única outra rota candidata a editar dados da clínica pelo Clinic Admin, confirmada como não afetada.
- **`actor_name` client-side**: confirmado, via `src/hooks/useAuth.ts` e uso em `src/components/clinic/ClinicLayout.tsx` linha 74 (`{user?.displayName}`), que o objeto `User` do Firebase Auth client SDK expõe `displayName` diretamente — não é preciso nenhuma leitura adicional ao Firestore para obter o nome do ator em escritas client-side.
- **`actor_name` server-side (API routes)**: três rotas já existentes (`src/app/api/tenants/[id]/consultant/invite/route.ts` linha 143, `src/app/api/access-requests/[id]/reject/route.ts` linha 35, `src/app/api/access-requests/[id]/approve/route.ts` linha 105) já usam o padrão `decodedToken.name || decodedToken.email || 'Fallback'` para obter o nome legível do ator a partir do ID token verificado — reaproveitado integralmente por este UC, sem inventar um padrão novo.
- **Bibliotecas de export já disponíveis**: `jspdf`/`jspdf-autotable` já estão em `package.json["dependencies"]` (`^4.2.1`/`^5.0.8`, adicionadas pelo UC-51) e `src/lib/services/reportService.ts` já expõe `exportToPdf` (linhas 579-589, import dinâmico) e um `exportToCSV` (linhas 595-620, client-side, `Blob`+`URL.createObjectURL`) hoje marcado `@deprecated` apenas em favor de `exportToExcel` para os relatórios que preferem planilha — mas funcionalmente correto e diretamente reaproveitável aqui, já que o UC-53 (RN-07) pede CSV, não Excel.
- **`firestore.indexes.json`** hoje não tem nenhuma entrada para `inventory_activity` nem qualquer índice com `queryScope: "COLLECTION_GROUP"` — confirmado por leitura completa do arquivo (14 índices existentes, todos `"queryScope": "COLLECTION"`). Uma consulta `collectionGroup('inventory_activity')` com `orderBy('timestamp', 'desc')`, como exigida pela visão de System Admin (RN-04), precisa de um índice explícito com escopo de grupo de coleção — o Firestore não habilita isso automaticamente como faz para consultas de coleção única.

### 1.2 Problema identificado

O sistema promete comercialmente ("Trilha de auditoria completa — Quem viu, quem alterou, quando. Exportável a qualquer momento", `public/landing/sections-trust.jsx`) uma funcionalidade que não existe: não há nenhum registro de quem criou/editou/ativou/desativou/suspendeu/mudou o papel de nenhuma entidade administrativa (Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais, Configurações Globais), e o único log real do sistema (`inventory_activity`) nunca foi exposto a nenhum usuário.

### 1.3 Motivação estratégica

Fechar o terceiro e último dos três gaps landing-vs-sistema priorizados nesta sessão (UC-51 custeio, já concluído; UC-52 projeção de reposição, já concluído; UC-53 trilha de auditoria) — segurança e conformidade são um dos pilares comerciais do produto, e hoje não têm nenhum lastro real no código.

---

## 2. Objetivos

1. Criar a coleção `audit_log` (top-level, cross-tenant) e a regra de segurança correspondente em `firestore.rules`, imutável após a criação.
2. Instrumentar, com log explícito e não retroativo, os 14 pontos de escrita administrativa sensível mapeados na RN-02 do UC-53, cobrindo Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais e Configurações Globais.
3. Expor uma tela de consulta em `/admin/audit-log` (System Admin, cross-tenant, unificando `audit_log` + `inventory_activity` de todos os tenants) e outra em `/clinic/audit-log` (Clinic Admin, restrita ao próprio tenant), com filtros aplicados em memória (mesmo padrão de UC-47/UC-50).
4. Bloquear explicitamente `clinic_user`/`clinic_consultant` do acesso à tela `/clinic/audit-log`, mesmo por URL direta.
5. Exportar a lista filtrada em CSV e em PDF, reaproveitando utilitários já existentes (`exportToCSV`/`exportToPdf` de `reportService.ts`), sem chamada adicional ao backend.
6. Resolver, sem quebrar a RN-10 do UC-53, a divergência entre a tabela RN-02 (que aponta `updateTenant()` como ponto de hook) e a exclusão explícita do fluxo de onboarding do Clinic Admin (UC-45) — instrumentando o *call site* de System Admin, não a função compartilhada.
7. Criar os índices compostos exigidos (`audit_log` por `tenant_id`+`timestamp`; `inventory_activity` em escopo de grupo de coleção por `timestamp`) em `firestore.indexes.json`.
8. Não introduzir nenhuma Cloud Function nova, nenhum TTL/expurgo automático, e nenhum dado retroativo.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | Sistema grava uma entrada em `audit_log` sempre que uma das 14 operações mapeadas (RN-02 do UC-53) for concluída com sucesso | system_admin / clinic_admin (só UC-40) | Must |
| RF-02 | Sistema exibe, em `/admin/audit-log`, a lista unificada e ordenada por `timestamp` decrescente de `audit_log` (sem filtro de tenant) + `collectionGroup('inventory_activity')` (todos os tenants) | system_admin | Must |
| RF-03 | Sistema exibe, em `/clinic/audit-log`, a lista unificada e ordenada por `timestamp` decrescente de `audit_log` (filtrada por `tenant_id`) + `tenants/{tenantId}/inventory_activity` do próprio tenant | clinic_admin | Must |
| RF-04 | Sistema oferece filtros em memória: período, categoria/entidade, tipo de ação, busca textual por nome do ator; e, apenas na visão de System Admin, filtro adicional por clínica | system_admin / clinic_admin | Must |
| RF-05 | Sistema exibe "Nenhum registro encontrado" quando o filtro não retorna itens, sem erro | system_admin / clinic_admin | Must |
| RF-06 | Sistema exporta a lista atualmente filtrada em CSV | system_admin / clinic_admin | Must |
| RF-07 | Sistema exporta a lista atualmente filtrada em PDF | system_admin / clinic_admin | Must |
| RF-08 | Sistema bloqueia `clinic_user`/`clinic_consultant` de acessar `/clinic/audit-log`, mesmo por URL direta, redirecionando para `/clinic/dashboard` | clinic_user / clinic_consultant | Must |
| RF-09 | Sistema oferece "carregar mais" quando o volume de itens excede o tamanho de página inicial (RNF-02) | system_admin / clinic_admin | Should |
| RF-10 | Sistema exibe erro visível (mensagem substituindo a tabela) se a consulta a `audit_log`/`inventory_activity` falhar | system_admin / clinic_admin | Must |
| RF-11 | Sistema exibe erro visível (toast) se a exportação falhar, sem afetar a lista em tela | system_admin / clinic_admin | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Regra do Firestore para `audit_log`: leitura total para `system_admin`; leitura restrita ao próprio `tenant_id` para os demais autenticados; criação exige `request.resource.data.actor_id == request.auth.uid`; `update`/`delete` sempre `false` — texto literal já definido na RNF-01 do UC-53, reaproveitado sem alteração | Segurança |
| RNF-02 | Paginação em janela crescente (`limit()` + "carregar mais", reconsultando com um limite maior) em vez de carregar toda a coleção de uma vez — trade-off de simplicidade aceito explicitamente na Seção 4.3 desta spec | Desempenho |
| RNF-03 | Multi-tenant: `audit_log` sempre filtrado por `tenant_id` na visão de Clinic Admin; `inventory_activity` permanece isolado por subcoleção; visão cross-tenant exclusiva de System Admin | Multi-tenant / Segurança |
| RNF-04 | Exportação (CSV e PDF) 100% client-side, sobre os itens já carregados e filtrados, sem chamada adicional ao backend | Desempenho |
| RNF-05 | A consulta `collectionGroup('inventory_activity')` exige um índice com `queryScope: "COLLECTION_GROUP"` em `firestore.indexes.json` — sem ele, a consulta falha em runtime (Fluxo de Exceção 8a do UC-53) | Infraestrutura |
| RNF-06 | Nenhuma Cloud Function nova; nenhum TTL/expurgo automático; retenção indefinida (RN-08 do UC-53) | Arquitetura |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | Somente escritas sensíveis (criar, editar, ativar, desativar, suspender, reativar, mudar papel, definir senha, gerar link de redefinição, excluir) são registradas — nunca leituras/visualizações | UC-53 RN-01 |
| RN-02 | A unificação de `audit_log` + `inventory_activity` acontece apenas na camada de apresentação (`listAuditLog`), sem migração/cópia de dados entre as coleções | UC-53 RN-03 |
| RN-03 | `system_admin` vê tudo, cross-tenant; `clinic_admin` vê apenas o próprio `tenant_id`; `clinic_user`/`clinic_consultant` não têm acesso | UC-53 RN-04 |
| RN-04 | Estrutura do documento `audit_log`: `tenant_id` (string \| null), `entity_type`, `entity_id`, `action`, `descricao`, `actor_id`, `actor_name`, `actor_role`, `timestamp`, `metadata?` — schema literal da RN-05 do UC-53 | UC-53 RN-05 |
| RN-05 | Captura via log explícito service a service/rota a rota — sem Cloud Function `onWrite`. Escritas via API route usam `actor_id` do Bearer token verificado (confiável); escritas client-side direto usam `auth.currentUser.uid` e dependem da regra do Firestore (RNF-01) para impedir personificação | UC-53 RN-06 |
| RN-06 | O hook de `updateTenant()` (Clínica — editar dados cadastrais) fica no *call site* de `/admin/tenants/[id]/page.tsx`, nunca dentro da função compartilhada `tenantServiceDirect.ts`, para não capturar também o fluxo de onboarding do Clinic Admin (UC-45), explicitamente fora de escopo pela RN-10 do UC-53 | Achado técnico desta investigação (Seção 1.1), decorrente diretamente da RN-10 do UC-53 |
| RN-07 | Exportação em CSV e PDF, ambos client-side, a partir dos itens filtrados — mesmo padrão de UC-47/UC-50/UC-51 | UC-53 RN-07 |
| RN-08 | Retenção indefinida, sem TTL/expurgo automático | UC-53 RN-08 |
| RN-09 | **Não retroatividade**: nenhuma ação administrativa anterior à entrada em produção de cada hook aparecerá na trilha. `inventory_activity` é a única fonte com histórico anterior a este UC (grava desde sua própria introdução, independente desta feature) | UC-53 RN-09 — **implicação explícita para o usuário**: ao subir esta feature, a trilha de ações administrativas começará vazia e só crescerá a partir de novas ações; não há nenhum backfill de dados históricos previsto ou possível |
| RN-10 | Escopo de entidades: Usuários/Consultores (UC-28/29/30/36/37/39/40/08), Clínicas (UC-21/22), Produtos Master (UC-31/32), Documentos Legais/Configurações Globais (UC-33/34/35) — todas de gestão exclusiva de `system_admin`, exceto criação de usuário por `clinic_admin` (UC-40, mesma rota de UC-39). Fora de escopo: protocolos, "Minha Clínica"/UC-45, solicitações de acesso, qualquer leitura/visualização | UC-53 RN-10 |
| RN-11 | Nome de exibição em ambos os menus: "Trilha de Auditoria" | UC-53 RN-12 |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- **Função pura de construção de payload (`src/lib/auditLogPayload.ts`), sem nenhum import de Firebase (client ou admin)**, para poder ser importada tanto por código server-side (API routes, que usam `firebase-admin`) quanto por código client-side (`auditLogService.ts`, que usa `firebase/firestore`) sem violar o isolamento já estabelecido no projeto — confirmado por `grep` que **nenhuma** rota em `src/app/api/**` importa hoje de `@/lib/firebase` (client SDK); só `@/lib/firebase-admin`. Se o builder morasse dentro de `auditLogService.ts` (que importa `db`/`addDoc` do client SDK), importar essa função dentro de uma API route quebraria essa convenção. `auditLogPayload.ts` exporta: `buildAuditLogPayload(input)` (monta o objeto plano, sem `timestamp` — cada SDK usa seu próprio `serverTimestamp()`/`FieldValue.serverTimestamp()`) e duas funções de diff, puras e testáveis: `determineUserAuditAction(before, after)` (decide entre `'update'`/`'activate'`/`'deactivate'`/`'change_role'` a partir da comparação de `role`/`active`) e `determineConsultantAuditAction(before, after)` (decide entre `'update'`/`'reactivate'`/`'suspend'` a partir da comparação de `status`).
- **`src/lib/services/auditLogService.ts` (client SDK) reexporta os tipos e expõe**: `writeAuditLog(input)` (client SDK, usado pelos 4 pontos de escrita client-side — Clínica/`updateTenant` call site, Produtos Master, Documentos Legais, Configurações Globais) e `listAuditLog(params)` (unifica `audit_log` + `inventory_activity`/`collectionGroup`, ordena por `timestamp` desc, aplica o recorte de paginação em janela — RNF-02). As 10 escritas via API route (Usuários x4, Consultores x4, Clínicas x2 — criar e suspender/reativar) chamam `adminDb.collection('audit_log').add({ ...buildAuditLogPayload(...), timestamp: FieldValue.serverTimestamp() })` diretamente dentro de cada rota, usando o mesmo `buildAuditLogPayload` puro — sem nenhuma dependência do client SDK dentro de `src/app/api/**`.
- **`updateTenant()` não muda de assinatura nem de comportamento** — o hook fica inteiramente no *call site* de `/admin/tenants/[id]/page.tsx` (Seção 1.1/RN-06), disparado só depois que `updateTenant()` resolve com sucesso. `/clinic/setup/page.tsx` não é tocado por este UC.
- **`masterProductService.ts` importa `auth` de `@/lib/firebase` diretamente** (mesmo padrão já usado por `LegalDocumentForm.tsx`/`admin/settings/page.tsx`) e chama `writeAuditLog` ao final de cada uma das 4 funções, com `actor_role` fixo em `'system_admin'` — decisão segura porque as 4 funções só são importadas por páginas dentro de `(admin)`, protegidas por `ProtectedRoute allowedRoles={['system_admin']}` (confirmado por `grep`, Seção 1.1).
- **Reaproveitamento total de `exportToCSV`/`exportToPdf` de `reportService.ts`** — nenhuma nova biblioteca, nenhuma duplicação de lógica de exportação. `exportToCSV`, apesar de marcado `@deprecated` no contexto dos relatórios de estoque (que preferem Excel), é funcionalmente correto e é exatamente o formato que a RN-07 do UC-53 pede — reaproveitado aqui sem alteração, sem remover a anotação `@deprecated` (que continua válida para o contexto original).
- **Paginação em janela crescente, não cursor duplo**: como a tela unifica duas fontes independentes (`audit_log` e `inventory_activity`) numa única lista ordenada, implementar paginação por cursor exigiria sincronizar dois cursores independentes mantendo a ordenação global — complexidade desproporcional ao volume esperado (RNF-02 do UC-53 já qualifica a leitura como "baixa a moderada", não uma tela de uso diário). `listAuditLog({ pageSize })` busca `limit(pageSize)` de cada fonte (ambas já ordenadas por `timestamp` desc), une e reordena em memória; "carregar mais" incrementa `pageSize` (+50) e repete a consulta. Trade-off aceito explicitamente na Seção 4.3.
- **Índice `inventory_activity` em escopo de grupo de coleção**: adicionado a `firestore.indexes.json` como uma entrada de campo único com `"queryScope": "COLLECTION_GROUP"` — sem essa entrada, o Firestore rejeita a consulta `collectionGroup('inventory_activity').orderBy('timestamp', 'desc')` usada pela visão de System Admin (RNF-05).

### 4.2 Alternativas descartadas

- **Cloud Function `onWrite` genérica, disparando em qualquer escrita das coleções afetadas**: descartada explicitamente pelo UC-53 (RN-06) — geraria ruído (capturaria também escritas não sensíveis) e quebraria a filosofia "Zero DevOps" do `CLAUDE.md`. O log explícito também é o único jeito de expressar a diferença semântica entre "criar" e "editar" e de decidir a `action` correta a partir de um diff de negócio (ex.: `change_role`), algo que um gatilho genérico `onWrite` não sabe fazer sem reimplementar a mesma lógica de diff dentro da função.
- **Migrar/duplicar `inventory_activity` para dentro de `audit_log`**: descartada explicitamente pelo UC-53 (RN-03) — manteria dois mecanismos fazendo a mesma coisa, sem necessidade real, já que a unificação na apresentação resolve o problema sem migração.
- **Paginação por cursor duplo (um cursor por fonte, mesclados)**: cogitada, descartada em favor da janela crescente (Seção 4.1) pela desproporção entre complexidade de implementação e volume real esperado de uso (leitura ocasional, não diária).
- **Instrumentar `updateTenant()` por dentro, com um parâmetro `actor` adicional na assinatura**: cogitada, descartada porque ainda exigiria que `/clinic/setup/page.tsx` (UC-45) passasse *algum* valor de ator, criando a tentação de logar aquele fluxo também — mais seguro excluir a chamada de onboarding inteiramente do caminho de código que grava em `audit_log`, movendo o hook para fora da função compartilhada.

### 4.3 Trade-offs aceitos

- RNF-02: "carregar mais" reconsulta ambas as fontes com um `limit()` maior, reprocessando itens já vistos, em vez de paginação incremental verdadeira — aceito para não introduzir a complexidade de mesclar dois cursores independentes, dado o volume de leitura qualificado como baixo/moderado pelo próprio UC-53 (Seção 11).
- RNF-01 (regra do Firestore) permite `allow read: if belongsToTenant(resource.data.tenant_id)` para **qualquer** usuário autenticado do tenant, não só `clinic_admin` — ou seja, um `clinic_user` com acesso ao console do navegador tecnicamente consegue ler `audit_log` do próprio tenant via chamada direta ao SDK, mesmo que a tela `/clinic/audit-log` bloqueie o acesso via UI (RF-08). Esse texto de regra é literal da RNF-01 do UC-53 (documento Aprovado) — reaproveitado sem alteração; o mesmo trade-off já existe hoje para `inventory`/`solicitacoes` (regra genérica de subcoleção não diferencia papel) e é consistente com o padrão de gating "só UI" já aceito em UC-51 (RNF-04).
- `masterProductService.ts` grava `actor_role: 'system_admin'` de forma fixa (não derivada de claims em tempo real) — aceito porque as 4 funções só são alcançáveis por páginas já restritas a `system_admin`; se uma nova página client-side algum dia importar essas funções fora desse grupo de rota, o campo ficaria factualmente incorreto sem nenhum erro visível — risco listado na Seção 10.
- Ausência de teste unitário para `writeAuditLog`/`listAuditLog` (orquestradores Firestore) e para os 14 pontos de instrumentação em si — cobertos pelo caderno Playwright (Branch C), mesmo padrão já usado em UC-51/UC-52.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Tipo | Propósito | Branch |
|---------|------|-----------|--------|
| `src/lib/auditLogPayload.ts` | Módulo puro | `buildAuditLogPayload`, `determineUserAuditAction`, `determineConsultantAuditAction` — sem imports de Firebase | A |
| `src/__tests__/auditLogPayload.test.ts` | Teste unitário | Cobertura das 3 funções puras (prioridade alta) | A |
| `src/lib/services/auditLogService.ts` | Serviço (client SDK) | `writeAuditLog`, `listAuditLog` (unifica `audit_log` + `inventory_activity`) | A |
| `src/app/(admin)/admin/audit-log/page.tsx` | Página | Tela de consulta/exportação para System Admin | C |
| `src/app/(clinic)/clinic/audit-log/page.tsx` | Página | Tela de consulta/exportação para Clinic Admin, bloqueada para `clinic_user` | C |
| `tests/e2e/UC-53-consultar-e-exportar-trilha-de-auditoria.spec.ts` | Teste E2E | Gerado pelo `qa-agent`, revisão humana obrigatória (CLAUDE.md item 8) | C |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança | Branch |
|---------|---------------------|--------|
| `src/types/index.ts` | + `AuditLogEntry`, `AuditEntityType`, `AuditAction` | A |
| `firestore.rules` | + `match /audit_log/{logId}` (RNF-01) | A |
| `firestore.indexes.json` | + índice composto `audit_log` (`tenant_id` asc + `timestamp` desc); + índice `inventory_activity` (`timestamp` desc, `queryScope: COLLECTION_GROUP`) | A |
| `src/app/api/users/create/route.ts` | + hook `action: 'create'` após sucesso | B |
| `src/app/api/users/[id]/route.ts` | + hook com `action` via `determineUserAuditAction` | B |
| `src/app/api/users/[id]/set-password/route.ts` | + hook `action: 'set_password'` | B |
| `src/app/api/users/[id]/reset-password/route.ts` | + hook `action: 'reset_password_link'` | B |
| `src/app/api/consultants/route.ts` | + hook `action: 'create'` (POST) | B |
| `src/app/api/consultants/[id]/route.ts` | + hook via `determineConsultantAuditAction` (PUT); + hook `action: 'suspend'` (DELETE) | B |
| `src/app/api/consultants/[id]/set-password/route.ts` | + hook `action: 'set_password'` | B |
| `src/app/api/tenants/create/route.ts` | + hook `action: 'create'` | B |
| `src/app/api/tenants/[id]/suspend/route.ts` | + hook `action: 'suspend'` (POST); + hook `action: 'reactivate'` (DELETE) | B |
| `src/app/(admin)/admin/tenants/[id]/page.tsx` | + `writeAuditLog` no call site, após `updateTenant()` resolver | B |
| `src/lib/services/masterProductService.ts` | + `writeAuditLog` ao final de `createMasterProduct`/`updateMasterProduct`/`deactivateMasterProduct`/`reactivateMasterProduct` | B |
| `src/components/admin/LegalDocumentForm.tsx` | + `writeAuditLog` nos dois ramos de `performSave` (create/edit) | B |
| `src/app/(admin)/admin/legal-documents/page.tsx` | + `writeAuditLog` em `handleDelete` | B |
| `src/app/(admin)/admin/settings/page.tsx` | + `writeAuditLog` em `handleSave` | B |
| `src/components/admin/AdminLayout.tsx` | + item de menu "Trilha de Auditoria" (`/admin/audit-log`) | C |
| `src/components/clinic/ClinicLayout.tsx` | + item de menu condicional "Trilha de Auditoria" (`/clinic/audit-log`, só `claims.role === 'clinic_admin'`) | C |

### 5.3 Arquivos a REMOVER

N/A — feature aditiva, nada é removido.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---------|------|---------|
| `audit_log` | **Nova coleção** (top-level, cross-tenant) | Schema RN-04; regra nova em `firestore.rules`; índice composto novo em `firestore.indexes.json` |
| `tenants/{tenantId}/inventory_activity` | Leitura (nenhuma mudança de regra) | Já coberta pela regra genérica `tenants/{tenantId}/{document=**}`; novo índice em escopo de grupo de coleção para a visão de System Admin |
| `firestore.rules` | **Mudança real** — nova seção `match /audit_log/{logId}` | Único UC desta trinca (UC-51/52/53) que altera `firestore.rules` |

### 5.5 O que NÃO muda

- `inventory_activity`/`writeActivityLogs` (`solicitacaoService.ts`) — mecanismo intocado, apenas lido pela nova tela.
- `tenantServiceDirect.ts` — assinatura de `updateTenant()` não muda; `/clinic/setup/page.tsx` (UC-45) não é tocado.
- Nenhuma Cloud Function nova, nenhum `functions/src/` alterado.
- Nenhum TTL/expurgo automático (RN-08).
- Nenhuma migração/backfill de dados históricos (RN-09) — a trilha começa vazia (exceto pelo `inventory_activity` já existente, que continua tendo seu próprio histórico).
- `reportService.ts` — `exportToCSV`/`exportToPdf` são reaproveitadas, não alteradas.
- Protocolos (UC-20), "Minha Clínica" (UC-45), solicitações de acesso (UC-01/02/03/05) — fora de escopo (RN-10).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

```ts
// src/types/index.ts — novo, não existe hoje

export type AuditEntityType =
  | 'user'
  | 'consultant'
  | 'tenant'
  | 'master_product'
  | 'legal_document'
  | 'system_settings';

export type AuditAction =
  | 'create'
  | 'update'
  | 'activate'
  | 'deactivate'
  | 'suspend'
  | 'reactivate'
  | 'change_role'
  | 'set_password'
  | 'reset_password_link'
  | 'delete';

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null; // null para ações sem escopo de clínica
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  descricao: string;
  actor_id: string;
  actor_name: string;
  actor_role: 'system_admin' | 'clinic_admin';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
```

```ts
// src/lib/auditLogPayload.ts — novo, sem nenhum import de Firebase (client ou admin)

export interface NewAuditLogInput {
  tenant_id: string | null;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  descricao: string;
  actor_id: string;
  actor_name: string;
  actor_role: 'system_admin' | 'clinic_admin';
  metadata?: Record<string, unknown>;
}

// Retorna o objeto plano pronto para .add()/.set() — SEM `timestamp`, que cada
// SDK preenche com seu próprio serverTimestamp() no ponto de escrita.
export function buildAuditLogPayload(input: NewAuditLogInput): Record<string, unknown>;

export function determineUserAuditAction(
  before: { role: string; active: boolean },
  after: { role: string; active: boolean }
): { action: AuditAction; metadata?: { de: string; para: string } };
// role mudou -> 'change_role' (metadata { de, para }); senão active true->false -> 'deactivate';
// active false->true -> 'activate'; senão -> 'update'

export function determineConsultantAuditAction(
  before: { status: string },
  after: { status: string }
): { action: AuditAction; metadata?: { de: string; para: string } };
// status !== antes e novo === 'active' -> 'reactivate';
// status !== antes e novo in ['suspended','inactive'] -> 'suspend';
// senão -> 'update'
```

```ts
// src/lib/services/auditLogService.ts — novo (client SDK)

export interface ListAuditLogParams {
  scope: 'system_admin' | 'clinic_admin';
  tenantId?: string; // obrigatório quando scope === 'clinic_admin'
  pageSize?: number; // default 100
}

export interface UnifiedAuditItem {
  id: string;
  source: 'audit_log' | 'inventory_activity';
  tenant_id: string | null;
  categoria: string; // nome da entidade (RN-05) ou 'Estoque'
  ator: string;
  acao: string;
  descricao: string;
  timestamp: Date;
}

export async function writeAuditLog(input: NewAuditLogInput): Promise<void>;
// addDoc(collection(db, 'audit_log'), { ...buildAuditLogPayload(input), timestamp: serverTimestamp() })

export async function listAuditLog(
  params: ListAuditLogParams
): Promise<{ items: UnifiedAuditItem[]; hasMore: boolean }>;
// Busca limit(pageSize) de audit_log (filtrado por tenant_id quando clinic_admin) e de
// inventory_activity (subcoleção quando clinic_admin; collectionGroup quando system_admin),
// ambas ordenadas por timestamp desc; une e reordena em memória; hasMore = true se
// qualquer uma das duas fontes retornou exatamente pageSize itens.
```

Nenhuma interface existente (`InventoryItem`, `Tenant`, `Consultant`, `MasterProduct`, `LegalDocument`, `SystemSettings`, `CustomClaims`) é alterada.

### 6.2 Mudanças em serviços

Lógica de `buildAuditLogPayload`: retorna o objeto de entrada tal como recebido (sem `undefined`, mesmo padrão de `removeUndefined` já usado em `solicitacaoService.ts` — reaproveitar essa função ou uma equivalente local, já que `metadata` é opcional e nunca deve virar `undefined` explícito no Firestore).

Lógica de `determineUserAuditAction`/`determineConsultantAuditAction`: comparação pura de dois objetos "antes"/"depois", sem nenhuma leitura de Firestore — chamadas pelas rotas PUT depois de já terem lido o documento anterior (`userDoc`/`consultantDoc`, ambos já lidos hoje antes do `update`, sem leitura adicional).

Pontos de instrumentação (Branch B), todos **depois** da escrita ter sido confirmada com sucesso (nunca antes, para não logar uma ação que falhou):

- `users/create/route.ts`: `action: 'create'`, `entity_type: 'user'`, `entity_id: userRecord.uid`, `actor_role: isSystemAdmin ? 'system_admin' : 'clinic_admin'` (cobre tanto UC-39 quanto UC-40, já que é a mesma rota), `actor_name: decodedToken.name || decodedToken.email || 'Admin'`.
- `users/[id]/route.ts` (PUT): `determineUserAuditAction({ role: userData.role, active: userData.active }, { role, active })`.
- `users/[id]/set-password/route.ts`: `action: 'set_password'`.
- `users/[id]/reset-password/route.ts`: `action: 'reset_password_link'`.
- `consultants/route.ts` (POST): `action: 'create'`, `entity_type: 'consultant'`, `tenant_id: null` (consultor não pertence a nenhum tenant).
- `consultants/[id]/route.ts` (PUT): `determineConsultantAuditAction({ status: consultantDoc.data()?.status }, { status: updateData.status ?? consultantDoc.data()?.status })`; (DELETE): `action: 'suspend'`.
- `consultants/[id]/set-password/route.ts`: `action: 'set_password'`.
- `tenants/create/route.ts`: `action: 'create'`, `entity_type: 'tenant'`, `entity_id: tenantId`, `tenant_id: tenantId`.
- `tenants/[id]/suspend/route.ts` (POST): `action: 'suspend'`; (DELETE): `action: 'reactivate'`.
- `admin/tenants/[id]/page.tsx` (call site, após `updateTenant()`): `action: 'update'`, `entity_type: 'tenant'`, `tenant_id: tenantId`, `actor_role: 'system_admin'` (única página que chama este call site é `(admin)`, já protegida).
- `masterProductService.ts` — `createMasterProduct`: `action: 'create'`; `updateMasterProduct`: `action: 'update'`; `deactivateMasterProduct`: `action: 'deactivate'`; `reactivateMasterProduct`: `action: 'reactivate'`. `entity_type: 'master_product'`, `tenant_id: null`.
- `LegalDocumentForm.tsx` (`performSave`): ramo `create` → `action: 'create'`; ramo `edit` → `action: 'update'`. `entity_type: 'legal_document'`, `tenant_id: null`.
- `admin/legal-documents/page.tsx` (`handleDelete`): `action: 'delete'`.
- `admin/settings/page.tsx` (`handleSave`): `action: 'update'`, `entity_type: 'system_settings'`, `entity_id: 'global'`, `tenant_id: null`.

### 6.3 Mudanças na UI

**`src/app/(admin)/admin/audit-log/page.tsx`** (novo): protegida pelo grupo `(admin)` já restrito a `system_admin` (`ProtectedRoute allowedRoles={['system_admin']}`, nenhuma verificação adicional necessária). Chama `listAuditLog({ scope: 'system_admin' })`. Tabela: Data/Hora, Ator, Categoria/Entidade, Ação, Descrição, Clínica (quando `tenant_id` presente, senão "—"). Filtros: período, categoria/entidade, ação, busca por ator, clínica (select populado via `listTenants`). Botões "Exportar CSV"/"Exportar PDF".

**`src/app/(clinic)/clinic/audit-log/page.tsx`** (novo): dentro do grupo `(clinic)`, que permite `clinic_admin` e `clinic_user` (`ProtectedRoute allowedRoles={['clinic_admin', 'clinic_user']}`) — **precisa de verificação adicional de papel dentro da própria página**, mesmo padrão já usado em `src/app/(clinic)/clinic/users/page.tsx` linha 13 (`useEffect(() => { if (claims && claims.role !== 'clinic_admin') { router.push('/clinic/dashboard'); } }, [claims, router]);`), reaproveitado literalmente (RF-08). Chama `listAuditLog({ scope: 'clinic_admin', tenantId: claims.tenant_id })`. Tabela igual, sem coluna Clínica (sempre a própria) e sem filtro de clínica.

**`src/components/admin/AdminLayout.tsx`**: novo item no array `navigation` (linha ~36-87), entre "Documentos Legais" e "Configurações" (ou em outra posição visualmente coerente): `{ name: 'Trilha de Auditoria', href: '/admin/audit-log', icon: History }` (ícone `History` já usado em outra parte do projeto, `lucide-react`).

**`src/components/clinic/ClinicLayout.tsx`**: o array `navLinks` (linha 34-42) hoje é estático — passa a ser calculado condicionalmente: `const navLinks = [...linksBase, ...(isAdmin ? [{ href: '/clinic/audit-log', label: 'Trilha de Auditoria' }] : [])]`, inserido depois de "Minha Clínica" e antes de "Meu Perfil" (posição sugerida, ajustável na implementação).

### 6.4 Mudanças em API Routes

Nenhuma rota nova. As 10 rotas já existentes listadas na Seção 5.2 ganham uma chamada adicional (`adminDb.collection('audit_log').add(...)`) após a escrita principal, sem alterar request/response body de nenhuma delas.

---

## 7. Plano de Implementação

### Branch A — `feature/uc53-audit-log-foundation`

#### STEP 1 — Tipos de domínio

**Objetivo:** Definir `AuditLogEntry`, `AuditEntityType`, `AuditAction` (RN-04).

**Arquivos afetados:**
- `src/types/index.ts` — adicionar os 3 tipos (Seção 6.1)

**Validação:** `npm run type-check` sem erros.

**Commit:** `feat(types): add AuditLogEntry, AuditEntityType and AuditAction types`

---

#### STEP 2 — Função pura de payload e helpers de diff

**Objetivo:** Implementar `buildAuditLogPayload`, `determineUserAuditAction`, `determineConsultantAuditAction`, sem nenhum import de Firebase.

**Arquivos afetados:**
- `src/lib/auditLogPayload.ts` — criar

**Ações:**
1. Implementar `buildAuditLogPayload` (Seção 6.2).
2. Implementar `determineUserAuditAction` e `determineConsultantAuditAction` (lógica de diff, Seção 6.1).

**Validação:** `npm run type-check` sem erros; nenhum import de `firebase`/`firebase-admin` no arquivo (conferir manualmente).

**Commit:** `feat(admin): add pure audit log payload builder and action-diff helpers`

---

#### STEP 3 — Testes unitários

**Objetivo:** Cobrir as 3 funções puras (CLAUDE.md item 8 — prioridade alta).

**Arquivos afetados:**
- `src/__tests__/auditLogPayload.test.ts` — criar

**Ações:**
1. `buildAuditLogPayload`: payload sem `metadata` não inclui a chave; payload com `metadata` a preserva; `tenant_id: null` é preservado (não removido como `undefined`).
2. `determineUserAuditAction`: mudança de `role` → `'change_role'` com `metadata` correto; `active` true→false → `'deactivate'`; false→true → `'activate'`; nenhuma mudança relevante → `'update'`; mudança simultânea de `role` e `active` → prioriza `'change_role'` (documentar a prioridade escolhida no teste).
3. `determineConsultantAuditAction`: `status` → `'active'` vindo de outro valor → `'reactivate'`; `status` → `'suspended'`/`'inactive'` → `'suspend'`; sem mudança de status → `'update'`.

**Validação:** `npm run test -- auditLogPayload` com 100% dos cenários acima passando.

**Commit:** `test(admin): add unit tests for audit log payload builder and action helpers`

---

#### STEP 4 — Regra do Firestore

**Objetivo:** Implementar RNF-01.

**Arquivos afetados:**
- `firestore.rules` — adicionar `match /audit_log/{logId}`

**Ações:**
1. Adicionar a regra literal da Seção 4 (RNF-01 do UC-53): `allow read: if isSystemAdmin();`, `allow read: if belongsToTenant(resource.data.tenant_id);`, `allow create: if isAuthenticated() && request.resource.data.actor_id == request.auth.uid;`, `allow update, delete: if false;`.

**Validação:** Testar manualmente contra o Firebase Emulator: (a) `system_admin` lê qualquer entrada; (b) `clinic_admin` lê só entradas do próprio `tenant_id`, recebe permissão negada para outro tenant; (c) criação com `actor_id` diferente do `auth.uid` é rejeitada; (d) `update`/`delete` sempre rejeitados.

**Commit:** `feat(firebase): add firestore.rules for audit_log collection`

---

#### STEP 5 — Índices compostos

**Objetivo:** RNF-05/RN-11 do UC-53.

**Arquivos afetados:**
- `firestore.indexes.json` — adicionar 2 entradas

**Ações:**
1. `audit_log`: `queryScope: "COLLECTION"`, campos `tenant_id` ASC + `timestamp` DESC.
2. `inventory_activity`: `queryScope: "COLLECTION_GROUP"`, campo `timestamp` DESC.

**Validação:** `firebase deploy --only firestore:indexes` (ou emulador) sem erros; consulta `collectionGroup('inventory_activity').orderBy('timestamp', 'desc')` executa sem exceção de índice ausente.

**Commit:** `feat(firebase): add firestore.indexes.json for audit_log and inventory_activity collection group`

---

#### STEP 6 — Service de escrita e leitura (client SDK)

**Objetivo:** Implementar `writeAuditLog` e `listAuditLog`.

**Arquivos afetados:**
- `src/lib/services/auditLogService.ts` — criar

**Ações:**
1. `writeAuditLog`: `addDoc(collection(db, 'audit_log'), { ...buildAuditLogPayload(input), timestamp: serverTimestamp() })`, `try/catch` relançando erro tratável.
2. `listAuditLog`: implementar a lógica de união de fontes descrita na Seção 6.1, com o recorte de paginação em janela (Seção 4.1).

**Validação:** Testar manualmente contra o Firebase Emulator com dados seedados em ambas as coleções; conferir ordenação e unificação corretas.

**Commit:** `feat(admin): add writeAuditLog and listAuditLog to auditLogService`

---

### Branch B — `feature/uc53-instrumentar-escritas-administrativas`

#### STEP 7 — Hooks em Usuários

**Objetivo:** Instrumentar as 4 rotas de Usuários (RN-02).

**Arquivos afetados:**
- `src/app/api/users/create/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/set-password/route.ts`, `src/app/api/users/[id]/reset-password/route.ts`

**Ações:**
1. Em cada rota, após a escrita principal ter sido confirmada, montar o payload via `buildAuditLogPayload` e gravar com `adminDb.collection('audit_log').add({ ...payload, timestamp: FieldValue.serverTimestamp() })` (lógica por rota, Seção 6.2).
2. Envolver a chamada em `try/catch` que **loga o erro mas não falha a resposta principal** (uma falha ao gravar auditoria não pode quebrar a operação administrativa em si — decisão de robustez, documentar no código).

**Validação:** Testar manualmente cada uma das 4 operações (criar usuário, editar, definir senha, enviar link de redefinição) e conferir a entrada correspondente em `audit_log` via console do Firebase/emulador.

**Commit:** `feat(admin): add audit log hooks to user management API routes`

---

#### STEP 8 — Hooks em Consultores

**Objetivo:** Instrumentar as 4 rotas de Consultores.

**Arquivos afetados:**
- `src/app/api/consultants/route.ts`, `src/app/api/consultants/[id]/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts`

**Ações:** Mesma mecânica do Step 7, usando `determineConsultantAuditAction` no PUT.

**Validação:** Testar manualmente criar/editar/suspender/definir senha de consultor.

**Commit:** `feat(admin): add audit log hooks to consultant management API routes`

---

#### STEP 9 — Hooks em Clínicas

**Objetivo:** Instrumentar criação, suspensão/reativação e edição de Clínicas (RN-06 desta spec).

**Arquivos afetados:**
- `src/app/api/tenants/create/route.ts`, `src/app/api/tenants/[id]/suspend/route.ts`, `src/app/(admin)/admin/tenants/[id]/page.tsx`

**Ações:**
1. `tenants/create` e `tenants/[id]/suspend` (POST/DELETE): mesma mecânica Admin SDK dos steps anteriores.
2. `admin/tenants/[id]/page.tsx`: **não tocar `tenantServiceDirect.ts`** — adicionar `await writeAuditLog(...)` (client SDK, `auditLogService.ts`) logo após `await updateTenant(...)` resolver com sucesso, antes de `setSuccess`.

**Validação:** Testar manualmente criar clínica, suspender, reativar, editar dados cadastrais via System Admin — conferir 1 entrada por operação. Testar completar onboarding via `/clinic/setup` (Clinic Admin) e confirmar **nenhuma** entrada gerada (RN-06 desta spec).

**Commit:** `feat(admin): add audit log hooks to tenant creation, suspension and edit`

---

#### STEP 10 — Hooks em Produtos Master

**Objetivo:** Instrumentar as 4 funções de `masterProductService.ts`.

**Arquivos afetados:**
- `src/lib/services/masterProductService.ts`

**Ações:**
1. Importar `auth` de `@/lib/firebase` e `writeAuditLog` de `auditLogService.ts`.
2. Ao final de cada função (após o `updateDoc`/`addDoc` resolver), gravar a entrada com `actor_role: 'system_admin'` fixo (Seção 4.1).

**Validação:** Testar manualmente criar/editar/ativar/desativar um produto master via `/admin/products`.

**Commit:** `feat(admin): add audit log hooks to master product service`

---

#### STEP 11 — Hooks em Documentos Legais e Configurações Globais

**Objetivo:** Instrumentar `LegalDocumentForm.tsx`, `admin/legal-documents/page.tsx`, `admin/settings/page.tsx`.

**Arquivos afetados:**
- `src/components/admin/LegalDocumentForm.tsx`, `src/app/(admin)/admin/legal-documents/page.tsx`, `src/app/(admin)/admin/settings/page.tsx`

**Ações:**
1. `LegalDocumentForm.tsx` (`performSave`): gravar após `addDoc`/`updateDoc`, reaproveitando `auth.currentUser!.uid`/`displayName` já usados hoje para `created_by`.
2. `legal-documents/page.tsx` (`handleDelete`): gravar após `deleteDoc`.
3. `settings/page.tsx` (`handleSave`): gravar após `setDoc`.

**Validação:** Testar manualmente criar/editar documento legal, excluir documento sem aceites, salvar configurações globais.

**Commit:** `feat(admin): add audit log hooks to legal documents and system settings`

---

### Branch C — `feature/uc53-tela-trilha-auditoria`

#### STEP 12 — Tela System Admin

**Objetivo:** RF-02, RF-04 (exceto filtro de clínica fica junto), RF-05, RF-09, RF-10.

**Arquivos afetados:**
- `src/app/(admin)/admin/audit-log/page.tsx` — criar
- `src/components/admin/AdminLayout.tsx` — novo item de menu

**Ações:**
1. Implementar a página (Seção 6.3): tabela, filtros (período, categoria, ação, ator, clínica), "carregar mais".
2. Adicionar item de menu.

**Validação:** Logado como `system_admin`, acessar `/admin/audit-log`, ver itens de múltiplos tenants unificados com `inventory_activity`.

**Commit:** `feat(admin): add audit log query screen for system_admin`

---

#### STEP 13 — Tela Clinic Admin

**Objetivo:** RF-03, RF-04 (sem clínica), RF-05, RF-08, RF-09, RF-10.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/audit-log/page.tsx` — criar
- `src/components/clinic/ClinicLayout.tsx` — novo item de menu condicional

**Ações:**
1. Implementar a página, reaproveitando o padrão de bloqueio de papel (Seção 6.3).
2. Adicionar item de menu condicional a `isAdmin`.

**Validação:** Logado como `clinic_admin`, acessar `/clinic/audit-log`, ver apenas o próprio tenant. Logado como `clinic_user`, tentar acessar a URL diretamente e confirmar redirecionamento; confirmar que o item de menu não aparece para `clinic_user`.

**Commit:** `feat(admin): add audit log query screen for clinic_admin`

---

#### STEP 14 — Exportação CSV e PDF

**Objetivo:** RF-06, RF-07, RF-11.

**Arquivos afetados:**
- `src/app/(admin)/admin/audit-log/page.tsx`, `src/app/(clinic)/clinic/audit-log/page.tsx`

**Ações:**
1. Importar `exportToCSV`/`exportToPdf` de `@/lib/services/reportService`.
2. Botões "Exportar CSV"/"Exportar PDF" operando sobre os itens atualmente filtrados em tela.

**Validação:** Gerar CSV e PDF em ambas as telas, abrir os arquivos e conferir que os dados batem com o filtro em vigor.

**Commit:** `feat(admin): add CSV and PDF export to audit log screens`

---

#### STEP 15 — Caderno de teste automatizado (qa-agent)

**Objetivo:** Cobrir o Fluxo Principal e os Fluxos 7a-7e/8a-8c do UC-53 (CLAUDE.md item 8).

**Ações:**
1. Acionar o `qa-agent` passando este documento (Seções 6/7) e o UC-53 como referência.
2. `qa-agent` gera `tests/e2e/UC-53-consultar-e-exportar-trilha-de-auditoria.spec.ts`, cobrindo: geração de entrada em `audit_log` ao executar uma ação instrumentada (ex.: criar usuário), visão unificada System Admin vs. Clinic Admin, filtro por clínica (System Admin), estado vazio (7a), tenant sem ação administrativa própria só com `inventory_activity` (7b), bloqueio de `clinic_user` (8b), exportação CSV/PDF (7d/7e).
3. **Revisão humana obrigatória** antes de virar gate de CI.

**Validação:** `npm run test:e2e` local passa com o novo spec; revisado e aprovado manualmente.

**Commit:** `test(admin): add UC-53 Playwright spec (qa-agent, revisado)`

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-------------------|------------------------|
| `buildAuditLogPayload` | `src/__tests__/auditLogPayload.test.ts` | Preserva `tenant_id: null`; omite `metadata` quando ausente; preserva `metadata` quando presente |
| `determineUserAuditAction` | idem | `change_role`, `activate`, `deactivate`, `update`, prioridade quando ambos mudam |
| `determineConsultantAuditAction` | idem | `reactivate`, `suspend`, `update` |
| `writeAuditLog`, `listAuditLog` | — (não testados unitariamente) | Orquestração Firestore; segue o mesmo precedente de `reportService.ts`/`costingService.ts`/`projectionService.ts` — cobertos pelo caderno Playwright (Step 15) |
| 14 pontos de instrumentação (API routes + services client-side) | — (não testados unitariamente) | Lógica de negócio de cada rota já é responsabilidade dela; o *fato* de gravar em `audit_log` é coberto pelo caderno Playwright, não por teste unitário |
| `AuditLogQueryPage` (ambas), componentes React | — (não testado no MVP) | Coberto pelo caderno Playwright (CLAUDE.md item 8) |

Regra aplicada: funções puras de diff/construção de payload são prioridade alta de teste unitário (mesmo padrão de `costingService.ts`/`projectionService.ts`); orquestradores Firestore, rotas de API e UI ficam cobertos pelo caderno E2E via `qa-agent`.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — todos os testes passando, incluindo auditLogPayload.test.ts
[ ] Multi-tenant: audit_log sempre filtrado por tenant_id na visão de clinic_admin; inventory_activity permanece isolado por subcoleção
[ ] Segurança: firestore.rules testado manualmente contra o emulador para os 4 cenários do Step 4 (leitura cross-tenant, leitura restrita, criação com actor_id divergente, update/delete bloqueados)
[ ] Branch pessoal: cada task branch mergeada em gscandelari_setup para validação no Firebase, antes do PR para develop
[ ] PR: aberto para develop com template preenchido, em cada branch
[ ] Os 14 pontos de instrumentação testados manualmente, cada um gerando exatamente 1 entrada em audit_log com action/entity_type corretos
[ ] Confirmado que completar onboarding via /clinic/setup NÃO gera entrada em audit_log (RN-06 desta spec)
[ ] Tela /admin/audit-log testada logado como system_admin — visão cross-tenant, filtro por clínica funcionando
[ ] Tela /clinic/audit-log testada logado como clinic_admin — visão restrita ao próprio tenant
[ ] Acesso a /clinic/audit-log via URL direta bloqueado para clinic_user, confirmado manualmente
[ ] Export CSV e PDF gerados e abertos manualmente em ambas as telas, conferindo que os dados batem com o filtro em vigor
[ ] firestore.indexes.json implantado (firebase deploy --only firestore:indexes) antes de validar a visão de System Admin
[ ] Caderno Playwright (tests/e2e/UC-53-*.spec.ts) gerado pelo qa-agent e revisado por humano antes de virar gate de CI
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Falha ao gravar `audit_log` quebrar a operação administrativa principal (ex.: erro de rede no meio da gravação da auditoria impede a criação do usuário) | Baixa | Alto | Cada hook envolve a chamada de auditoria em `try/catch` separado que apenas loga o erro (`console.error`), nunca propaga para a resposta principal (Step 7, ação 2) |
| `masterProductService.ts` com `actor_role` fixo (`'system_admin'`) ficar incorreto se uma página futura fora de `(admin)` importar essas funções | Baixa | Baixo | Documentado explicitamente na Seção 4.3; revisão de código deve reforçar esse invariante em qualquer PR futuro que toque `masterProductService.ts` |
| Falta do índice `collectionGroup` para `inventory_activity` (RNF-05) não ser implantada antes do deploy da tela, quebrando a visão de System Admin em produção | Média | Médio | Step 5 (Branch A) cria o índice antes de qualquer código de leitura depender dele; DoD exige deploy explícito do índice antes da validação da tela (Branch C) |
| Regra `allow read: if belongsToTenant(resource.data.tenant_id)` permitir leitura de `audit_log` por `clinic_user` via chamada direta ao SDK, apesar do bloqueio de UI | Média | Baixo | Trade-off documentado explicitamente na Seção 4.3 — texto de regra é literal da RNF-01 do UC-53 (Aprovado), mesmo padrão de gating já aceito em `inventory`/`solicitacoes` |
| Volume de `audit_log`/`inventory_activity` crescer sem TTL (RN-08) e tornar a paginação em janela crescente lenta no longo prazo | Média | Médio | Aceito como MVP (RNF-02); paginação em janela é mais simples que cursor duplo; otimização futura se necessário |
| Caderno Playwright não cobrir adequadamente os 14 pontos de instrumentação + as duas visões | Média | Médio | Revisão humana obrigatória do spec (Step 15); QA prioriza os fluxos de maior risco (bloqueio de papel, isolamento multi-tenant, unificação de fontes) sobre cobertura exaustiva de cada uma das 14 rotas |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| `audit_log` | Nova coleção top-level, cross-tenant, que registra escritas administrativas sensíveis sobre Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais e Configurações Globais |
| `inventory_activity` | Coleção já existente (`tenants/{tenantId}/inventory_activity`), registra movimentações de estoque; unificada na apresentação com `audit_log`, sem migração de dados |
| Log explícito | Padrão de captura em que cada service/rota grava sua própria entrada de auditoria no momento da escrita, em vez de um gatilho automático genérico (`onWrite`) |
| Ator | Usuário (`system_admin` ou `clinic_admin`) que executou a ação registrada |
| Não retroatividade | Princípio de que a trilha só registra ações a partir da entrada em produção de cada hook — nenhum dado histórico anterior é reconstruído |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-53-consultar-e-exportar-trilha-de-auditoria.md` (v1.0, Aprovado) — UC de origem
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-relatorios-gerenciais-custeio-procedimento.md` (v1.1) — UC-51, usada como referência de formato/qualidade desta spec e de precedente de fatiamento em branches sequenciais
- `CLAUDE.md` (item 8) — obrigatoriedade de caderno de teste Playwright para toda feature
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Git Flow, Conventional Commits, fluxo de PR
- `src/lib/services/solicitacaoService.ts` (`writeActivityLogs`, linhas 117-151) — padrão de log já em produção, reaproveitado conceitualmente e unificado na apresentação
- `firestore.rules` — base da nova regra `audit_log`; referência de padrão imutável em `user_document_acceptances`
- `firestore.indexes.json` — base dos 2 novos índices
- `src/hooks/useAuth.ts` — confirmação de `user.displayName` disponível client-side
- `src/lib/firebase-admin.ts` — confirmação de que nenhuma rota de API importa o client SDK
- `src/app/api/access-requests/[id]/approve/route.ts`, `.../reject/route.ts`, `src/app/api/tenants/[id]/consultant/invite/route.ts` — precedente do padrão `decodedToken.name || decodedToken.email || fallback`
- `src/lib/services/reportService.ts` (`exportToCSV`, `exportToPdf`) — reaproveitados sem alteração

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 23/09/2026 | Doc Writer (Claude) | Versão inicial. Spec de implementação derivada do UC-53 (v1.0, Aprovado). Investigado o código real de todos os 14 pontos de escrita mapeados pela RN-02 do UC-53 (Usuários, Consultores, Clínicas, Produtos Master, Documentos Legais, Configurações Globais), confirmando camada de escrita (Admin SDK via API route vs. Client SDK direto) e padrões já existentes de captura de nome do ator (`decodedToken.name`/`auth.currentUser.displayName`). Achado técnico principal desta investigação, não previsto no UC-53: `tenantServiceDirect.ts`/`updateTenant` é compartilhada entre UC-22 (dentro do escopo) e UC-45/onboarding (explicitamente fora de escopo pela RN-10 do próprio UC-53) — resolvido posicionando o hook no *call site* de `/admin/tenants/[id]/page.tsx`, não dentro do service compartilhado, sem necessidade de decisão adicional do usuário (a RN-10 já resolve a ambiguidade). Confirmado que `jspdf`/`jspdf-autotable` (UC-51) e `exportToCSV`/`exportToPdf` (`reportService.ts`) já existem e são diretamente reaproveitáveis, sem nenhuma dependência nova. Confirmado que `firestore.rules` não tem hoje nenhuma regra para `audit_log` (mudança real de regra, ao contrário de UC-51/UC-52) e que `firestore.indexes.json` não tem nenhum índice em escopo de grupo de coleção, exigindo uma entrada nova para a consulta `collectionGroup('inventory_activity')` da visão de System Admin. Proposto fatiamento em 3 branches sequenciais (fundação → instrumentação → tela), maior que o fatiamento de 2 branches do UC-51, proporcional ao escopo real (14 pontos de escrita + nova regra de segurança + 2 telas, contra 4 novos relatórios sem nenhuma mudança de regra no UC-51). Nenhum `⚠️ Decisão necessária` restante — o único ponto de ambiguidade técnica encontrado (Seção 1.1/RN-06) já tem resolução inequívoca a partir de uma regra já aprovada no próprio UC-53 (RN-10), não constituindo uma decisão de escopo nova. Documento sai direto em `Status: Planejamento`, pronto para o `dev-task-manager`. |
