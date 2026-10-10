# UC-53: Consultar e Exportar Trilha de Auditoria

**Projeto:** Curva Mestra
**Data de Criação:** 22/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Implementado
**Módulo/Contexto:** Administração do Sistema / Segurança e Conformidade
**Versão:** 1.3

> **Feature implementada.** Este UC especifica a tela "Trilha de Auditoria" — em que System Admin (visão cross-tenant, todas as clínicas) e Clinic Admin (visão restrita à própria clínica) consultam e exportam (CSV/PDF) um histórico unificado de **escritas administrativas sensíveis** (criar/editar/ativar/desativar/suspender/mudar papel, nunca leituras/visualizações) sobre um conjunto definido de entidades, somado ao log de movimentação de estoque (`inventory_activity`) que já existia e já era gravado, mas nunca havia sido exposto em nenhuma tela. Implementado nesta mesma sessão via PRs #291 (fundação — tipos, coleção `audit_log`, regra, índices, `auditLogPayload.ts`), #293 (instrumentação dos 14 pontos de escrita administrativa), #294 (testes unitários da camada de auditoria) e #295 (telas + exportação + caderno Playwright), todos mergeados em `gscandelari_setup` e deployados em `dev-gscandelari.web.app` — código em `src/lib/auditLogPayload.ts`, `src/lib/auditLogAdmin.ts`, `src/lib/services/auditLogService.ts`, `src/components/audit/AuditLogView.tsx`, telas `/admin/audit-log` e `/clinic/audit-log`, com caderno E2E em `tests/e2e/UC-53-consultar-e-exportar-trilha-de-auditoria.spec.ts` (11 cenários, revisão humana já feita). Todas as decisões de escopo abaixo foram tomadas explicitamente pelo usuário (Seção 15) e confirmadas na implementação — ver `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md` (v1.2, Concluído) para o plano completo, achados técnicos e ressalvas de cobertura de teste (Seção 14). **[Novo em v1.3 — UC-58]** O escopo de entidades foi ampliado pontualmente: o **compartilhamento de dados financeiros com o consultor** (ativar, revogar ou trocar o consultor destinatário, em Minha Clínica → Custos Fixos) passou a gerar entradas com `entity_type: 'financial_config'` e ações `share_with_consultant` / `unshare_with_consultant`, exibidas como "Dados Financeiros" / "Compartilhar com Consultor" / "Revogar Compartilhamento" (RN-10 ampliada).

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    SystemAdmin([👤 System Admin])
    ClinicAdmin([👤 Clinic Admin])

    subgraph Fontes["Ações administrativas que alimentam a trilha (fora do fluxo deste UC)"]
        UC2122(("UC-21/22\nClínicas"))
        UC282930(("UC-28/29/30\nConsultores"))
        UC3132(("UC-31/32\nProdutos Master"))
        UC3334(("UC-33/34\nDocumentos Legais"))
        UC35(("UC-35\nConfigurações Globais"))
        UC36373940(("UC-36/37/39/40\nUsuários"))
        UCSolic(("UC-16/17/18/19\nSolicitações\n(gera inventory_activity, já existente)"))
        UC58(("UC-58\nCompartilhar dados financeiros\ncom o consultor (clinic_admin)"))
    end

    AuditLog[("🗄️ audit_log\n(NOVO — top-level, cross-tenant,\ntenant_id nulo quando não se aplica)")]
    InvActivity[("🗄️ inventory_activity\n(já existente,\nsubcoleção por tenant,\nleitura compartilhada clinic_admin+clinic_user)")]

    UC2122 -.->|"grava (a implementar)"| AuditLog
    UC282930 -.->|"grava (a implementar)"| AuditLog
    UC3132 -.->|"grava (a implementar)"| AuditLog
    UC3334 -.->|"grava (a implementar)"| AuditLog
    UC35 -.->|"grava (a implementar)"| AuditLog
    UC36373940 -.->|"grava (a implementar)"| AuditLog
    UCSolic -.->|"já grava hoje"| InvActivity
    UC58 -.->|"grava financial_config\nshare/unshare_with_consultant"| AuditLog

    subgraph Sistema["Curva Mestra"]
        UC53(("UC-53\nConsultar e Exportar\nTrilha de Auditoria"))
    end

    SystemAdmin -->|"visão cross-tenant, todas as ações"| UC53
    ClinicAdmin -->|"visão restrita à própria clínica"| UC53
    AuditLog -.->|"lido, unificado na apresentação"| UC53
    InvActivity -.->|"lido, unificado na apresentação"| UC53
```

Não há relação `<<include>>`/`<<extend>>` clássica com os UCs de origem — eles não são acionados a partir deste UC nem o acionam; a relação é de **dependência de dados**: cada um deles, ao ser executado, passa a gravar (após a implementação desta feature) uma entrada que este UC lê.

---

## 2. Atores

### 2.1 Ator Primário
**System Admin** e **Clinic Admin**, com escopos de visibilidade diferentes (decisão explícita do usuário):
- **System Admin**: vê a trilha completa, cross-tenant — todas as ações administrativas de todas as clínicas, e todas as movimentações de estoque (`inventory_activity`) de todos os tenants.
- **Clinic Admin**: vê apenas a trilha da própria clínica — ações administrativas restritas ao próprio tenant (hoje, na prática, a criação de usuário via UC-40 e, **[v1.3]**, o compartilhamento de dados financeiros com o consultor via UC-58, já que as demais entidades em escopo — clínicas, consultores, produtos master, documentos legais, configurações globais — são geridas exclusivamente por `system_admin`, ver RN-10) somadas ao `inventory_activity` do próprio tenant.

`clinic_user` e `clinic_consultant` **não têm acesso à tela "Trilha de Auditoria"** (este UC) em nenhuma hipótese — decisão explícita do usuário (Seção 15, item 3). **[Esclarecimento adicionado em 02/10/2026, sem mudança de comportamento]** Isso não deve ser confundido com a leitura da coleção `inventory_activity` em si, usada fora deste UC: o widget "Atividade Recente" do dashboard (`/clinic/dashboard`, `getRecentActivity`) é compartilhado entre `clinic_admin` e `clinic_user` do mesmo tenant, sem nenhum gate de role — comportamento intencional (ver RN-04) e sem relação com o acesso restrito à tela de auditoria administrativa deste UC.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Os "atores" cujas ações alimentam a trilha (system_admin executando UC-21/22/28/29/30/31/32/33/34/35/36/37/39, clinic_admin executando UC-40 e, **[v1.3]**, UC-58 — compartilhamento de dados financeiros) não interagem diretamente com este UC — a gravação de cada entrada é um efeito colateral desses outros casos de uso, não um passo deste fluxo.

---

## 3. Pré-condições
- **[Resolvido na implementação]** Todos os hooks de gravação em `audit_log` listados na Seção 9 (RN-02) foram adicionados aos services/rotas de origem (PR #293) — a feature está implementada em todas as camadas (coleção, regra, índices, hooks de escrita, telas de consulta/exportação).
- Usuário autenticado, com custom claims válidos (`role: 'system_admin'` via `is_system_admin === true`, ou `role: 'clinic_admin'` com `tenant_id` definido).
- Para Clinic Admin: `tenant_id` presente nas claims — a query de `audit_log` e de `inventory_activity` é sempre escopada a esse valor.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado por este caso de uso em si — é somente leitura (a exportação gera um arquivo local, sem gravação no Firestore).
- A tela exibe uma lista unificada e ordenada por data/hora (mais recente primeiro), combinando entradas de `audit_log` (ações administrativas) e de `inventory_activity` (movimentações de estoque), ambas já persistidas por outros casos de uso.
- Filtros (período, entidade, ator, tipo de ação e, para System Admin, clínica) são aplicados sobre os dados já carregados/consultados.
- Exportação (CSV ou PDF) gera um arquivo com exatamente os itens visíveis no momento do clique (respeitando os filtros em vigor).

### 4.2 Falha (Garantias Mínimas)
- Se a consulta falhar (rede, índice Firestore ausente, permissão), a lista é substituída por uma mensagem de erro; nenhum dado parcial enganoso é exibido.
- Se a exportação falhar, a lista em tela permanece intacta e uma mensagem de erro é exibida; nenhum arquivo corrompido é entregue ao usuário.

---

## 5. Gatilho (Trigger)
- **System Admin** clica em "Trilha de Auditoria" no menu lateral do Portal Admin (novo item em `AdminLayout.tsx`, navegando para `/admin/audit-log`).
- **Clinic Admin** clica em "Trilha de Auditoria" no menu da Clínica (novo item em `ClinicLayout.tsx`, visível apenas quando `claims.role === 'clinic_admin'`, navegando para `/clinic/audit-log`).

---

## 6. Fluxo Principal (Basic Flow)

1. Ator (System Admin ou Clinic Admin) clica em "Trilha de Auditoria" no menu; sistema navega para `/admin/audit-log` ou `/clinic/audit-log`, conforme o contexto.
2. Sistema lê `claims.role`/`claims.is_system_admin` e, se Clinic Admin, `claims.tenant_id`.
3. **Se System Admin:** sistema consulta `audit_log` (coleção top-level, sem filtro de tenant) e uma consulta `collectionGroup('inventory_activity')` (todas as subcoleções de todos os tenants), ambas ordenadas por `timestamp` decrescente.
4. **Se Clinic Admin:** sistema consulta `audit_log` filtrada por `where('tenant_id', '==', claims.tenant_id)` e `tenants/{tenantId}/inventory_activity`, ambas ordenadas por `timestamp` decrescente.
5. Sistema combina os resultados das duas fontes em uma única lista, em memória, ordenada por `timestamp` decrescente, atribuindo a cada item uma "categoria" de exibição: "Estoque" (para itens de `inventory_activity`, reaproveitando o campo `tipo` já existente — `reserva`/`consumo_imediato`/etc.) ou o nome da entidade administrativa (para itens de `audit_log` — "Usuário", "Clínica", "Consultor", "Produto Master", "Documento Legal", "Configurações do Sistema" e, **[v1.3]**, "Dados Financeiros").
6. Sistema exibe uma tabela com as colunas: Data/Hora, Ator (nome), Categoria/Entidade, Ação, Descrição e — apenas na visão de System Admin — Clínica afetada (quando o item tiver `tenant_id`; "—" para ações sem escopo de clínica, como consultor/produto master/documento legal/configuração).
7. Ator pode filtrar por: período (data inicial/final), categoria/entidade, tipo de ação, e busca textual por nome do ator — todos aplicados em memória sobre os dados já carregados, mesmo padrão de UC-50/UC-47. **Apenas na visão de System Admin:** filtro adicional por clínica específica.
8. Ator clica em "Exportar CSV" ou "Exportar PDF"; sistema gera o arquivo a partir dos itens **atualmente filtrados** na tela.
9. Caso de uso é concluído a qualquer momento em que o ator navega para fora da tela.

---

## 7. Fluxos Alternativos

### 7a. Nenhuma entrada encontrada após filtro (a partir do passo 7)
1. A combinação de filtros não retorna nenhum item.
2. Sistema exibe "Nenhum registro encontrado" com sugestão de ajustar os filtros.

### 7b. Clínica sem nenhuma ação administrativa registrada, apenas movimentação de estoque (visão Clinic Admin)
1. Como as entidades em escopo desta versão (Clínicas, Consultores, Produtos Master, Documentos Legais, Configurações Globais) são geridas exclusivamente por `system_admin`, um tenant cujo `clinic_admin` nunca usou UC-40 (Criar Usuário para a Própria Clínica) — **[v1.3]** nem ativou/revogou o compartilhamento de dados financeiros com o consultor (UC-58) — não terá **nenhuma** entrada em `audit_log` filtrada para o seu `tenant_id` — a trilha exibida será composta inteiramente por `inventory_activity`.
2. Sistema exibe normalmente a lista, sem nenhum aviso especial — comportamento esperado dado o escopo definido em RN-10, não um erro.

### 7c. Filtrar por clínica específica (somente System Admin, a partir do passo 7)
1. System Admin seleciona uma clínica no filtro "Clínica".
2. Sistema restringe a lista a itens cujo `tenant_id` corresponda à clínica selecionada (itens sem `tenant_id` — ações sem escopo de clínica — são ocultados quando esse filtro está ativo).

### 7d. Exportar CSV (a partir do passo 8)
1. Sistema gera um arquivo `.csv` com colunas Data/Hora, Ator, Categoria/Entidade, Ação, Descrição, Clínica (quando aplicável e visível), a partir dos itens filtrados.
2. Download é iniciado pelo navegador; nenhum dado do Firestore é alterado — mesmo padrão client-side de UC-47/UC-50 (Exportar Excel).

### 7e. Exportar PDF (a partir do passo 8)
1. Sistema gera um arquivo `.pdf` com a mesma tabela (Data/Hora, Ator, Categoria/Entidade, Ação, Descrição, Clínica quando aplicável), formatada para impressão/arquivamento.
2. Download é iniciado pelo navegador; nenhum dado do Firestore é alterado.

---

## 8. Fluxos de Exceção

### 8a. Erro ao carregar a trilha (a partir dos passos 3/4)
1. A consulta falha (rede, permissão, ou ausência de índice composto do Firestore exigido pela combinação `where('tenant_id', ...)` + `orderBy('timestamp', ...)` — ver RN-11).
2. Sistema exibe "Erro ao carregar trilha de auditoria" no lugar da tabela.

### 8b. Acesso por papel não autorizado
1. Um usuário com `role` diferente de `system_admin`/`clinic_admin` (ex.: `clinic_user`, `clinic_consultant`) tenta acessar `/admin/audit-log` ou `/clinic/audit-log` diretamente pela URL.
2. `ProtectedRoute`/layout do grupo de rota bloqueia o acesso, mesmo padrão já usado em todas as demais telas administrativas (`(admin)` restrito a `system_admin`; dentro de `(clinic)`, o link só aparece para `clinic_admin`, e a página deve verificar `claims.role === 'clinic_admin'` antes de renderizar dados, redirecionando/bloqueando `clinic_user` mesmo que acesse a URL diretamente). **Este bloqueio é específico da tela de Trilha de Auditoria (este UC) e não afeta a leitura do widget "Atividade Recente" do dashboard, que permanece acessível a `clinic_user` por fora deste fluxo (ver RN-04).**

### 8c. Falha na exportação (a partir do passo 8)
1. Geração do CSV/PDF lança exceção (ex.: volume de dados muito grande no cliente).
2. Sistema exibe mensagem de erro; a lista em tela permanece intacta, permitindo nova tentativa (ex.: com filtros mais restritivos).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Decisão do usuário]** Escopo do "o quê" é auditado: **somente escritas sensíveis** (criar, editar, ativar, desativar, suspender, reativar, mudar papel/role, definir senha, excluir) sobre as entidades listadas em RN-02. **Leituras/visualizações nunca são registradas** — a promessa "quem viu" da landing page não é implementada por este UC (decisão explícita, registrada aqui para rastreabilidade da divergência entre marketing e produto). | Decisão de escopo do usuário, ver Seção 15. |
| RN-02 | **Tabela de mapeamento entidade → ação → UC de origem → camada de escrita atual → onde o hook de log precisa ser adicionado (a implementar).** Ver tabela abaixo. | Levantamento de código, confirmando os pontos exatos de escrita de cada entidade em escopo. |
| RN-03 | **[Decisão do usuário]** A trilha **unifica**, apenas na camada de apresentação, duas fontes de dados distintas: o novo `audit_log` (ações administrativas, coleção top-level) e o `inventory_activity` já existente (`tenants/{tenantId}/inventory_activity`, movimentações de estoque). Não há migração/cópia de dados entre as duas coleções — cada uma continua gravada por seu próprio mecanismo, e a combinação acontece somente no momento da consulta/exibição. | Decisão de escopo do usuário, ver Seção 15. Confirmado por leitura de `writeActivityLogs` (`solicitacaoService.ts`) que `inventory_activity` já cobre integralmente as movimentações de estoque, sem necessidade de duplicar esse mecanismo. |
| RN-04 | **[Decisão do usuário]** Escopo de visibilidade por papel **nesta tela de Trilha de Auditoria**: `system_admin` vê tudo, cross-tenant (toda entrada de `audit_log`, sem filtro de `tenant_id`, mais uma consulta `collectionGroup('inventory_activity')` cobrindo todos os tenants); `clinic_admin` vê apenas entradas com `tenant_id` igual ao seu próprio (tanto em `audit_log` quanto em `inventory_activity`, escopado à sua subcoleção). `clinic_user` e `clinic_consultant` não têm acesso a esta tela. **[Esclarecimento adicionado em 02/10/2026, sem mudança de comportamento, decisão de produto confirmada nesta sessão]** Esta restrição é exclusiva da apresentação unificada deste UC (a "Trilha de Auditoria" como tela) — ela **não** torna a coleção `inventory_activity` em si de uso restrito a `clinic_admin` em todo o sistema. Fora deste UC, a leitura de `tenants/{tenantId}/inventory_activity` é intencionalmente compartilhada entre `clinic_admin` e `clinic_user` do mesmo tenant (confirmado pelo widget "Atividade Recente" do dashboard, `getRecentActivity`, consumido por `/clinic/dashboard` sem nenhum gate de role — e pela regra dedicada em `firestore.rules`, `match /tenants/{tenantId}/inventory_activity/{activityId}`, cujo comentário documenta explicitamente essa decisão: leitura ampla para os dois papéis, escrita restrita a `clinic_admin`). Isso é diferente das ações administrativas sensíveis cobertas por `audit_log` (criar/editar/ativar/desativar/suspender/mudar papel/senha/excluir sobre Usuários, Clínicas, Consultores, Produtos Master, Documentos Legais, Configurações Globais), que continuam restritas a `system_admin`/`clinic_admin` tanto nesta tela quanto na coleção `audit_log` propriamente dita (RN-01, RN-10) — não devem ser confundidas as duas coleções: `inventory_activity` é mais antiga e específica de movimentação de estoque; `audit_log` é a nova trilha administrativa própria deste UC. | Decisão de escopo do usuário, ver Seção 15 (acesso à tela). Esclarecimento confirmado por leitura de `src/app/(clinic)/clinic/dashboard/page.tsx` (`getRecentActivity` chamado sem nenhuma checagem de `claims.role`) e de `firestore.rules` (bloco dedicado de `inventory_activity`, leitura ampla via regra genérica de subcoleção do tenant, escrita restrita a `clinic_admin`). |
| RN-05 | **Estrutura proposta do novo documento `audit_log`** (coleção top-level, análoga em espírito a `inventory_activity`, mas cross-tenant por natureza): `tenant_id` (string \| null — nulo para ações sem escopo de clínica: consultor, produto master, documento legal, configuração global), `entity_type` ('user' \| 'consultant' \| 'tenant' \| 'master_product' \| 'legal_document' \| 'system_settings' \| **[v1.3]** 'financial_config'), `entity_id`, `action` ('create' \| 'update' \| 'activate' \| 'deactivate' \| 'suspend' \| 'reactivate' \| 'change_role' \| 'set_password' \| 'reset_password_link' \| 'delete' \| **[v1.3]** 'share_with_consultant' \| 'unshare_with_consultant'), `descricao` (texto legível, mesmo padrão de `inventory_activity.descricao`), `actor_id`, `actor_name`, `actor_role` ('system_admin' \| 'clinic_admin'), `timestamp`, e um campo opcional `metadata` (objeto livre, para casos simples de diff — ex.: mudança de role: `{ de: 'clinic_user', para: 'clinic_admin' }` — sem obrigação de capturar diff completo de campos para toda ação, dado o volume de entidades distintas em escopo). | Desenho proposto, seguindo a mesma convenção de nomenclatura de `inventory_activity` (`writeActivityLogs`, `solicitacaoService.ts`) e dos campos `created_by`/`created_by_name` já usados em outras coleções do projeto. |
| RN-06 | **[Decisão do usuário]** Gatilho técnico de captura: **log explícito, adicionado service a service / rota a rota** (mesmo padrão de `writeActivityLogs`), sem Cloud Function `onWrite` automática nesta versão. **Consequência arquitetural identificada nesta investigação:** como nem toda entidade em escopo escreve hoje através de uma API route com Admin SDK (ver RN-02 — Clínica-edição, Produto Master e Documento Legal/Configurações são client SDK direto), a confiabilidade da captura do "ator" varia por entidade: para escritas via API route, `actor_id` vem do Bearer token verificado no servidor (confiável); para escritas client-side direto, `actor_id` precisa vir de `auth.currentUser.uid` no momento da chamada, e a regra do Firestore para `audit_log` deve exigir `request.resource.data.actor_id == request.auth.uid` na criação (mesmo padrão de proteção já usado para os campos `created_by` do restante do projeto) para impedir que um client escreva uma entrada de auditoria em nome de outro usuário. | Achado arquitetural desta investigação, decorrente da decisão já tomada pelo usuário (RN-06) combinada com a divergência de camada de escrita já documentada em UC-22 (RN-01, edição cadastral de clínica sem API route), UC-31/UC-32 (produtos master sem API route) e UC-33/UC-34/UC-35 (documentos legais e configurações sem API route) — nenhuma dessas divergências é nova; esta regra apenas explicita sua consequência para o desenho deste UC. |
| RN-07 | **[Decisão do usuário]** Exportação disponível em dois formatos: **CSV e PDF**, ambos gerados client-side a partir dos itens atualmente filtrados na tela — mesmo padrão já usado por UC-47 e UC-50 (Exportar Excel), sem chamada adicional ao backend. | Decisão de escopo do usuário, ver Seção 15; padrão de implementação reaproveitado de UCs já aprovados. |
| RN-08 | **[Decisão do usuário]** Retenção do log é **indefinida** nesta versão — sem TTL/expurgo automático. Diferente da política de backup geográfico prometida na landing (retenção de 90 dias, UC-54, ainda não escrito), a trilha de auditoria em si não tem prazo de expiração definido. | Decisão de escopo do usuário, ver Seção 15. |
| RN-09 | **Não retroatividade**: como o mecanismo de captura é um log explícito adicionado a cada service/rota (RN-06), **ações administrativas realizadas antes da implementação desta feature nunca aparecerão retroativamente na trilha** — apenas ações ocorridas a partir do momento em que cada hook entrar em produção. O `inventory_activity` já existente é a única fonte com histórico anterior à implementação deste UC (grava desde sua própria introdução no sistema, independente deste UC). | Consequência direta e inevitável do modelo de captura decidido em RN-06 (log explícito, não uma reconstrução retroativa a partir de outra fonte, que não existe). |
| RN-10 | **[Escopo desta versão]** As entidades cobertas são exatamente as decididas pelo usuário: Usuários e Consultores (UC-28/29/30/36/37/39/40), Clínicas (UC-21/22), Produtos Master (UC-31/32), Documentos Legais e Configurações Globais (UC-33/34/35) — todas de gestão exclusiva de `system_admin`, exceto a criação de usuário por `clinic_admin` (UC-40), que é a única ação administrativa desta lista alcançável por um `clinic_admin`. **Fora de escopo nesta versão** (não avaliado, não decidido): protocolos (UC-20), edição do próprio perfil da clínica pelo `clinic_admin` ("Minha Clínica"/UC-45), solicitações de acesso (UC-01/UC-02/UC-03/UC-05), e qualquer rastreamento de leitura/visualização (RN-01). Consequência observável: a trilha de um `clinic_admin` que nunca usou UC-40 mostrará **somente** movimentação de estoque (ver Fluxo Alternativo 7b) — comportamento esperado, não uma lacuna de implementação. **[AMPLIADA em v1.3 — decisão D4 da spec `FEAT-precificacao-hora-clinica.md`, UC-58]** Exceção pontual e deliberada ao "fora de escopo" de "Minha Clínica": o **compartilhamento de dados financeiros com o consultor** (aba Custos Fixos) passou a ser auditado — `entity_type: 'financial_config'`, `entity_id: tenantId`, `tenant_id: tenantId`, `actor_role: 'clinic_admin'`, ações `share_with_consultant` (ativar, ou trocar o consultor destinatário — `metadata.consultant_id`, `metadata.consultant_anterior_id`) e `unshare_with_consultant` (revogar — `metadata.consultant_id`; `metadata.motivo: 'troca_de_consultor'` quando a revogação decorre da troca do consultor vinculado). Somente a **mudança** do estado de compartilhamento gera entrada (salvar sem mudar o switch não gera); valores de custos fixos, Boletos Tec, disponibilidade, capacidade e markup **não** são auditados. Gravação client-side (`writeAuditLog`, sujeita a `actor_id == request.auth.uid` — RNF-01) depois do salvamento, best-effort (falha não desfaz o salvamento). O restante de "Minha Clínica" e protocolos continuam fora de escopo. | Escopo de entidades explicitamente decidido pelo usuário, ver Seção 15; a observação sobre o efeito prático em `clinic_admin` é um achado desta investigação, não uma decisão adicional. **[v1.3]** Ampliação decidida pelo usuário em 09/10/2026 (D4); confirmada por leitura de `custoHoraService.ts` (`auditarCompartilhamento`), `auditLogPayload.ts` (`determineFinancialShareAuditAction`) e `auditLogService.ts` (rótulos). | Escopo de entidades explicitamente decidido pelo usuário, ver Seção 15; a observação sobre o efeito prático em `clinic_admin` é um achado desta investigação, não uma decisão adicional. |
| RN-11 | **Requisito técnico de infraestrutura:** as consultas combinadas (`where('tenant_id', '==', ...)` + `orderBy('timestamp', 'desc')` em `audit_log`; `collectionGroup('inventory_activity')` com `orderBy('timestamp', 'desc')` para a visão de System Admin) exigem a criação de índices compostos no Firestore (`firestore.indexes.json`), que precisam ser implantados junto com o deploy desta feature — sem eles, as consultas falham em tempo de execução (Fluxo de Exceção 8a). | Requisito inerente ao modelo de consulta do Firestore para os filtros combinados propostos neste UC, análogo a outros índices já exigidos por queries filtradas+ordenadas existentes no projeto. |
| RN-12 | Nome de exibição da funcionalidade em ambos os contextos (menu do Portal Admin e menu da Clínica): **"Trilha de Auditoria"** — mesmo termo usado na landing page (decisão do usuário, Seção 15), preservando a consistência entre a promessa comercial e o rótulo real na UI. | Decisão de escopo do usuário, ver Seção 15. |

> **[Nota de implementação, adicionada em 27/09/2026]** As Regras de Negócio RN-01, RN-03, RN-04, RN-05, RN-07, RN-08, RN-09, RN-10, RN-11 e RN-12 foram implementadas exatamente como desenhadas (PRs #291/#293/#294/#295, `dev-gscandelari.web.app`). RN-06 foi implementada com um refinamento necessário: os hooks usam funções auxiliares compartilhadas (`writeAuditLogAdmin`/`writeAdminAuditLog`, não previstas nominalmente nesta versão do UC) em vez de código inline por rota, e cada gravação de auditoria é envolvida em `try/catch` isolado que nunca propaga falha para a operação principal — confirmado por teste unitário (PR #294). O único **ajuste real de escopo/local de implementação** em relação à tabela de mapeamento abaixo está na linha "Clínica | Editar dados cadastrais" (ver nota **[Ajustado na implementação]** na própria linha): o hook não foi colocado dentro de `tenantServiceDirect.ts` como a tabela original sugeria, para não capturar também o fluxo de onboarding do Clinic Admin (UC-45), explicitamente fora de escopo pela RN-10. Detalhamento completo em `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md` (Seção 1.1/4.1, achado técnico não previsto originalmente por este UC).

**Tabela de mapeamento (RN-02) — entidade → ação → UC de origem → camada de escrita → arquivo a instrumentar:**

| Entidade | Ação | UC de Origem | Camada de Escrita Atual | Arquivo Onde o Hook de Log Precisa Ser Adicionado (a implementar) |
|---|---|---|---|---|
| Usuário (cross-tenant) | Criar | UC-39 | API route (Admin SDK) | `src/app/api/users/create/route.ts` |
| Usuário (própria clínica) | Criar | UC-40 | API route (Admin SDK, mesma rota) | `src/app/api/users/create/route.ts` |
| Usuário | Editar dados/função/status | UC-36 | API route (Admin SDK) | `src/app/api/users/[id]/route.ts` (`PUT`) |
| Usuário | Definir senha manualmente | UC-37 | API route (Admin SDK) | `src/app/api/users/[id]/set-password/route.ts` |
| Usuário | Enviar link de redefinição de senha | UC-08 | API route (Admin SDK) | `src/app/api/users/[id]/reset-password/route.ts` |
| Consultor | Criar | UC-28 | API route (Admin SDK) | `src/app/api/consultants/route.ts` (`POST`) |
| Consultor | Editar / mudar status (reativar) | UC-29 | API route (Admin SDK) | `src/app/api/consultants/[id]/route.ts` (`PUT`) |
| Consultor | Suspender | UC-29 | API route (Admin SDK) | `src/app/api/consultants/[id]/route.ts` (`DELETE`) |
| Consultor | Definir senha manualmente | UC-30 | API route (Admin SDK) | `src/app/api/consultants/[id]/set-password/route.ts` |
| Clínica | Criar | UC-21 | API route (Admin SDK) | `src/app/api/tenants/create/route.ts` |
| Clínica | Editar dados cadastrais | UC-22 | **Client SDK direto** (sem API route) | **[Ajustado na implementação]** hook adicionado no *call site* `src/app/(admin)/admin/tenants/[id]/page.tsx` (após `updateTenant()` resolver com sucesso), não dentro de `src/lib/services/tenantServiceDirect.ts` — essa função é compartilhada com o onboarding do Clinic Admin (`/clinic/setup`, UC-45), explicitamente fora de escopo pela RN-10; instrumentar o service capturaria também esse fluxo indevidamente. |
| Clínica | Suspender | UC-22 | API route (Admin SDK) | `src/app/api/tenants/[id]/suspend/route.ts` (`POST`) |
| Clínica | Reativar | UC-22 | API route (Admin SDK) | `src/app/api/tenants/[id]/suspend/route.ts` (`DELETE`) |
| Produto Master | Criar | UC-31 | **Client SDK direto** | `src/lib/services/masterProductService.ts` (`createMasterProduct`) |
| Produto Master | Editar | UC-32 | **Client SDK direto** | `src/lib/services/masterProductService.ts` (`updateMasterProduct`) |
| Produto Master | Ativar / Desativar | UC-32 | **Client SDK direto** | `src/lib/services/masterProductService.ts` (`reactivateMasterProduct`/`deactivateMasterProduct`) |
| Documento Legal | Criar | UC-33 | **Client SDK direto** | `src/components/admin/LegalDocumentForm.tsx` (`handleSave`, modo `create`) |
| Documento Legal | Editar / Publicar | UC-34 | **Client SDK direto** | `src/components/admin/LegalDocumentForm.tsx` (`handleSave`, modo `edit`) |
| Documento Legal | Excluir | UC-34 | **Client SDK direto** | `src/app/(admin)/admin/legal-documents/page.tsx` (`handleDelete`) |
| Configurações Globais | Editar | UC-35 | **Client SDK direto** | `src/app/(admin)/admin/settings/page.tsx` (`handleSave`) |
| **[v1.3]** Dados Financeiros (`financial_config`) | Compartilhar / revogar compartilhamento com o consultor | UC-58 | **Client SDK direto** (`clinic_admin`) | **[Implementado]** `src/lib/services/custoHoraService.ts` (`saveCustoHoraConfig` → `auditarCompartilhamento`, após o `setDoc` de `tenants/{tenantId}/financeiro/custo_hora`); decisão da ação em `src/lib/auditLogPayload.ts` (`determineFinancialShareAuditAction`) |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | A regra do Firestore para a nova coleção `audit_log` deve seguir o mesmo padrão já usado para `users/{userId}` (`allow list` condicionado a `resource.data.tenant_id == request.auth.token.tenant_id`): `allow read: if isSystemAdmin()` (tudo) e `allow read: if belongsToTenant(resource.data.tenant_id)` (escopo próprio); `allow create: if (isSystemAdmin() || isAuthenticated()) && request.resource.data.actor_id == request.auth.uid` (impede que um client grave uma entrada de auditoria em nome de outro usuário, mitigando o risco descrito em RN-06); `allow update, delete: if false` (auditoria não deve ser alterável/removível, mesmo padrão já usado em `user_document_acceptances`). **[Confirmado na implementação]** — regra literal implementada e testada manualmente contra o Firebase Emulator (PR #291). | Segurança |
| RNF-02 | Como a retenção é indefinida (RN-08) e não há TTL, o volume de `audit_log` cresce sem limite — a tela deve considerar paginação (ex.: `limit()` + "carregar mais") em vez de carregar toda a coleção de uma vez, diferente do padrão hoje usado em UC-50 (que carrega todo o inventário do tenant de uma vez, aceitável pelo volume tipicamente menor). **[Implementado com ajuste]** paginação em janela crescente (`limit()` reconsultado com tamanho maior a cada "carregar mais"), não paginação por cursor duplo — trade-off documentado em `FEAT-trilha-de-auditoria-consultar-exportar.md`, Seção 4.1/4.3. | Desempenho |
| RNF-03 | Multi-tenant garantido por: `audit_log` sempre filtrado por `tenant_id` na visão de `clinic_admin` (nunca uma consulta sem esse filtro); `inventory_activity` continua isolado por subcoleção de tenant (`tenants/{tenantId}/inventory_activity`), com leitura ampla aos dois papéis do tenant e escrita restrita a `clinic_admin` (regra dedicada própria, ver RN-04). A visão cross-tenant é exclusiva de `system_admin`, coberto pela regra já existente `allow read, write: if isSystemAdmin()`. **[Confirmado na implementação]**. | Multi-tenant / Segurança |
| RNF-04 | Exportação (CSV e PDF) é inteiramente client-side, sobre os dados já carregados e filtrados — mesmo padrão de desempenho de UC-47/UC-50 (`exportToExcel`), sem chamada adicional ao backend. **[Confirmado na implementação]** — reaproveitados `exportToCSV`/`exportToPdf` já existentes em `reportService.ts` (adicionados por UC-51), sem nenhuma biblioteca nova. | Desempenho |
| RNF-05 | A consulta `collectionGroup('inventory_activity')` usada na visão de System Admin exige que a subcoleção mantenha o mesmo nome (`inventory_activity`) em todos os tenants — o que já é garantido hoje, já que `writeActivityLogs` sempre grava em `tenants/{tenantId}/inventory_activity` de forma hardcoded. **[Confirmado na implementação]** — índice `queryScope: "COLLECTION_GROUP"` adicionado a `firestore.indexes.json` e implantado antes da validação da tela de System Admin (PR #291). | Consistência técnica |

---

## 11. Frequência de Uso
Baixa a moderada quanto à **leitura** — consulta ocasional, tipicamente para investigação pontual (ex.: "quem desativou este usuário?") ou revisão periódica de conformidade, não uma tela de uso diário. A **gravação**, por outro lado, é tão frequente quanto a soma de todas as ações administrativas cobertas (UC-21/22/28/29/30/31/32/33/34/35/36/37/39/40) mais as movimentações de estoque já existentes — um volume potencialmente alto ao longo do tempo, justificando a preocupação de paginação (RNF-02).

---

## 12. Casos de Uso Relacionados
- **UC-21/UC-22 (Clínicas), UC-28/UC-29/UC-30 (Consultores), UC-31/UC-32 (Produtos Master), UC-33/UC-34 (Documentos Legais), UC-35 (Configurações Globais), UC-36/UC-37/UC-39/UC-40 (Usuários)** — todos são **fontes de dados** para este UC (cada execução bem-sucedida de uma ação sensível nesses UCs deve, após a implementação desta feature, gravar uma entrada em `audit_log`); nenhum deles é acionado a partir deste UC, nem este UC os inclui/estende no sentido comportamental clássico.
- **UC-08 (System Admin Envia Link de Redefinição de Senha)** — mesma relação de dependência de dados (ação sobre usuário, ver RN-02).
- **UC-58 (Precificar Protocolos pela Hora Clínica)** — **[Novo em v1.3]** fonte de dados: ativar, revogar ou trocar o destinatário do compartilhamento de dados financeiros com o consultor grava uma entrada `financial_config` (RN-10 ampliada). Única ação de "Minha Clínica" auditada.
- **UC-16/UC-17/UC-18/UC-19 (Solicitações — Procedimentos)** — fonte indireta, via `inventory_activity` já existente (`writeActivityLogs`), unificada na apresentação deste UC (RN-03). A leitura de `inventory_activity` fora desta tela (ex.: widget "Atividade Recente" do dashboard, consumido pelos fluxos de UC-16 a UC-19) é compartilhada entre `clinic_admin` e `clinic_user` do mesmo tenant — ver RN-04.
- **UC-14 (Auditar e Corrigir Inconsistências de Inventário)** — **não relacionado** a este UC, apesar do nome parecido: UC-14 é uma ferramenta de reconciliação de quantidades (`quantidade_reservada`/`quantidade_disponivel`), não um histórico de ações — confirmado por leitura completa do código durante o levantamento deste UC.
- **UC-47 (Gerar Relatórios de Estoque, Vencimento e Consumo)** e **UC-50 (Consultar Inventário e Detalhe do Item de Estoque)** — fonte do padrão de exportação client-side (RN-07/RNF-04) e de filtros aplicados em memória sobre dados já carregados, reaproveitado neste UC.
- **UC-54 (Backup Geográfico Automatizado, reservado, ainda não escrito)** — feature distinta prometida na mesma seção da landing page ("Segurança & conformidade"), mas sem relação técnica direta com este UC (retenção indefinida deste log, RN-08, é deliberadamente diferente da retenção de 90 dias prometida para o backup).

---

## 13. Referências

**Arquivos a serem criados (feature nova):**
- `src/app/(admin)/admin/audit-log/page.tsx` — tela de consulta para System Admin.
- `src/app/(clinic)/clinic/audit-log/page.tsx` — tela de consulta para Clinic Admin.
- `src/lib/services/auditLogService.ts` — novo service: `listAuditLog(params)` (unifica `audit_log` + `inventory_activity`/`collectionGroup`), `writeAuditLog(entry)` (helper reutilizado pelos hooks de cada entidade).
- `src/types/index.ts` — novos tipos `AuditLogEntry`, `AuditEntityType`, `AuditAction` (ver estrutura proposta em RN-05).
- `firestore.rules` — nova regra `match /audit_log/{logId}` (ver RNF-01).
- `firestore.indexes.json` — novos índices compostos (ver RN-11).

**Arquivos existentes a instrumentar (ver tabela completa em RN-02):**
- `src/app/api/users/create/route.ts`, `src/app/api/users/[id]/route.ts`, `src/app/api/users/[id]/set-password/route.ts`, `src/app/api/users/[id]/reset-password/route.ts`
- `src/app/api/consultants/route.ts`, `src/app/api/consultants/[id]/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts`
- `src/app/api/tenants/create/route.ts`, `src/app/api/tenants/[id]/suspend/route.ts`
- `src/lib/services/tenantServiceDirect.ts` (`updateTenant`)
- `src/lib/services/masterProductService.ts` (`createMasterProduct`, `updateMasterProduct`, `deactivateMasterProduct`, `reactivateMasterProduct`)
- `src/components/admin/LegalDocumentForm.tsx` (`handleSave`), `src/app/(admin)/admin/legal-documents/page.tsx` (`handleDelete`)
- `src/app/(admin)/admin/settings/page.tsx` (`handleSave`)

**Arquivos de navegação a alterar:**
- `src/components/admin/AdminLayout.tsx` — novo item de menu "Trilha de Auditoria" (`/admin/audit-log`).
- `src/components/clinic/ClinicLayout.tsx` — novo item de menu "Trilha de Auditoria" (`/clinic/audit-log`), condicionado a `claims.role === 'clinic_admin'` (primeiro item condicional do array `navLinks`, hoje sempre estático).

**Referência de padrão já existente (não alterado por este UC):**
- `src/lib/services/solicitacaoService.ts` (`writeActivityLogs`, linhas 117-151) — padrão de log já em produção, reaproveitado conceitualmente (RN-05) e unificado na apresentação (RN-03).
- `src/app/(clinic)/clinic/inventory/audit/page.tsx` — confirmadamente não relacionado (UC-14, reconciliação de estoque, não trilha de ações).
- `src/app/(clinic)/clinic/dashboard/page.tsx` (`getRecentActivity`, chamado sem gate de role) — confirma a leitura compartilhada de `inventory_activity` entre `clinic_admin` e `clinic_user`, fora do escopo de acesso restrito desta tela (RN-04).
- `firestore.rules` (bloco dedicado `match /tenants/{tenantId}/inventory_activity/{activityId}` — leitura ampla via regra genérica de subcoleção do tenant, escrita restrita a `clinic_admin`, comentário do arquivo documenta a decisão de leitura compartilhada) — RN-04.
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 7.1 — origem da reserva deste UC.
- `public/landing/sections-trust.jsx` (componente `Security`, pilar "Trilha de auditoria completa") — origem da promessa comercial mapeada por este UC.

**Arquivos efetivamente implementados (PRs #291/#293/#294/#295):**
- `src/lib/auditLogPayload.ts` — `buildAuditLogPayload`, `determineUserAuditAction`, `determineConsultantAuditAction` (funções puras, sem import de Firebase); **[v1.3]** `determineFinancialShareAuditAction`.
- **[v1.3]** `src/lib/services/custoHoraService.ts` (`auditarCompartilhamento`); `src/lib/services/auditLogService.ts` (`ENTITY_TYPE_LABELS.financial_config = 'Dados Financeiros'`, `ACTION_LABELS.share_with_consultant = 'Compartilhar com Consultor'`, `ACTION_LABELS.unshare_with_consultant = 'Revogar Compartilhamento'`); `src/types/index.ts` (`AuditEntityType`, `AuditAction`); spec `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-precificacao-hora-clinica.md` (v1.7, D4), PR #382.
- `src/lib/auditLogAdmin.ts` — `writeAuditLogAdmin`/helpers server-side (Admin SDK).
- `src/lib/services/auditLogService.ts` — `writeAuditLog`, `writeAdminAuditLog`, `listAuditLog` (client SDK).
- `src/components/audit/AuditLogView.tsx` — componente de tela compartilhado entre `/admin/audit-log` e `/clinic/audit-log`.
- `src/__tests__/auditLogPayload.test.ts`, `src/__tests__/auditLogAdmin.test.ts`, `src/__tests__/auditLogService.test.ts`, `src/__tests__/auditLogRoutes.test.ts` — testes unitários (PR #294).
- `tests/e2e/UC-53-consultar-e-exportar-trilha-de-auditoria.spec.ts` — caderno Playwright (11 cenários, gerado pelo `qa-agent`, revisão humana já feita — ver Seção 14 para as lacunas de cobertura conhecidas).
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-trilha-de-auditoria-consultar-exportar.md` (v1.2, Concluído) — spec de implementação derivada deste UC, com o plano completo, decisões de design e histórico de execução.

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Feature implementada (PRs #291/#293/#294/#295). Os itens 2 e 3 abaixo foram confirmados/resolvidos na implementação. O item 1 (RN-10) permanece como nota de escopo futuro genuína. Itens 4 a 7 registram lacunas de cobertura do caderno Playwright, conhecidas e documentadas na spec de implementação — não bloqueiam o status "Implementado", mas devem ser resolvidas (ou conscientemente aceitas) antes de tratar a trilha como totalmente coberta por teste automatizado. O item 8 registra o esclarecimento de escopo confirmado em 02/10/2026 (sem pendência):

1. **[Observação, não bloqueante — parcialmente endereçada em v1.3]** RN-10 — o escopo desta versão deixa a trilha de um `clinic_admin` que nunca usou UC-40 (nem o compartilhamento financeiro de UC-58) restrita apenas a `inventory_activity`. **[v1.3]** A primeira ampliação foi decidida e implementada: compartilhamento de dados financeiros com o consultor (D4). As demais ampliações (ex.: edição do próprio perfil da clínica via "Minha Clínica"/UC-45, gestão de protocolos/UC-20, valores de custos fixos) continuam decisões de produto separadas, ainda não levantadas.
2. **[Confirmado na implementação, não bloqueante]** RN-06/RNF-01 — a diferença de confiabilidade entre captura via API route (Bearer token verificado) e captura client-side direto (dependente de regra do Firestore) é inerente à arquitetura mista já existente no projeto (mesma divergência já registrada em UC-22/UC-31/UC-33/UC-35). Implementado exatamente como previsto, com um refinamento: cada gravação de auditoria (API route ou client-side) é envolvida em `try/catch` isolado que nunca propaga falha para a operação principal, validado por teste unitário (PR #294, `auditLogRoutes.test.ts`). O achado adicional sobre `tenantServiceDirect.ts`/`updateTenant` (compartilhada com o onboarding do Clinic Admin, UC-45, fora de escopo pela RN-10) foi resolvido posicionando o hook no *call site* de `/admin/tenants/[id]/page.tsx`, não dentro do service — ver nota antes da Tabela de mapeamento (RN-02) e `FEAT-trilha-de-auditoria-consultar-exportar.md`, Seção 1.1/4.1.
3. **[Resolvido na implementação]** RN-11 — índices compostos definidos e implantados: `audit_log` (`tenant_id` ASC + `timestamp` DESC, escopo `COLLECTION`) e `inventory_activity` (`timestamp` DESC, escopo `COLLECTION_GROUP`, exigido pela consulta `collectionGroup` da visão de System Admin). Ambos implantados via `firebase deploy --only firestore:indexes` antes da validação da tela de System Admin (PR #291).
4. **[Lacuna de cobertura automatizada, conhecida, não bloqueante]** O caderno Playwright (`tests/e2e/UC-53-*.spec.ts`, 11 cenários, revisão humana já feita) **não cobre** a geração de entrada em `audit_log` a partir das ações via API route (criar usuário, criar clínica, criar consultor) — cobertas apenas indiretamente pelos testes unitários de rota (`auditLogRoutes.test.ts`, PR #294), não pelo E2E real contra o Firebase Emulator.
5. **[Lacuna de cobertura automatizada, conhecida, não bloqueante]** O caderno Playwright **não cobre** as escritas client-side instrumentadas (Produtos Master, Documentos Legais, Configurações Globais, edição cadastral de Clínica) gerando entrada real em `audit_log` via UI — os 14 pontos de instrumentação foram validados manualmente (DoD do PR #295), mas não por teste automatizado ponta a ponta.
6. **[Lacuna de cobertura automatizada, conhecida, não bloqueante]** O caderno Playwright **não cobre** o botão "carregar mais" (paginação em janela crescente, RNF-02) nem o Fluxo de Exceção 8a (erro ao carregar a trilha por falha de rede/permissão/índice ausente).
7. **[Recomendação]** Os itens 4 a 6 não bloqueiam o status "Implementado" deste UC (a feature funciona em produção, validada manualmente), mas devem ser tratados como débito técnico de teste — recomendada uma extensão futura do caderno Playwright cobrindo especificamente esses três pontos antes de considerar a trilha de auditoria "totalmente coberta" por automação, conforme o espírito do CLAUDE.md item 8.
8. **[Esclarecimento confirmado, não é pendência]** RN-04 — a restrição de acesso à tela "Trilha de Auditoria" (`clinic_user`/`clinic_consultant` sem acesso) é exclusiva deste UC; a coleção `inventory_activity`, fora desta tela, continua com leitura compartilhada entre `clinic_admin` e `clinic_user` do mesmo tenant (dashboard, "Atividade Recente"), decisão de produto confirmada nesta sessão (02/10/2026) a partir do comportamento real já existente no código e do comentário já presente em `firestore.rules`. Nenhuma mudança de comportamento foi feita — apenas esclarecimento textual para evitar confusão entre as duas coleções (`inventory_activity` vs. `audit_log`).
9. **[Lacuna de cobertura automatizada, v1.3]** O caderno Playwright deste UC não cobre as entradas `financial_config`; elas estão previstas nos roteiros F (passos 5–7, 11 e 12) do caderno de UC-58 (`tests/e2e/UC-58-precificar-protocolos-pela-hora-clinica.spec.ts`), ainda não gerado. A decisão de ação é coberta por teste unitário (`auditLogPayload.test.ts`, `describe('determineFinancialShareAuditAction')`).

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 22/07/2026 | Guilherme Scandelari | Versão inicial. Feature nova (ainda não implementada), especificada a partir de decisões explícitas do usuário sobre: (1) escopo do que é auditado — somente escritas sensíveis, sem rastreamento de leitura/visualização (RN-01); (2) unificação, apenas na camada de apresentação, com o `inventory_activity` já existente, confirmado por leitura de `writeActivityLogs` (`solicitacaoService.ts`) como um log já em produção, porém nunca exposto em nenhuma tela (RN-03); (3) escopo de visibilidade — `system_admin` cross-tenant, `clinic_admin` restrito ao próprio tenant, `clinic_user`/`clinic_consultant` sem acesso (RN-04); (4) gatilho técnico de captura — log explícito service a service/rota a rota, sem Cloud Function automática (RN-06), com o achado arquitetural de que nem toda entidade em escopo escreve hoje via API route (Clínica-edição, Produtos Master, Documentos Legais e Configurações Globais são client SDK direto — RN-02, RN-06, RNF-01); (5) entidades no escopo inicial — Usuários/Consultores, Clínicas, Produtos Master, Documentos Legais e Configurações Globais (RN-10), mapeadas em detalhe, entidade a entidade, aos seus UCs de origem e aos arquivos exatos que precisarão do novo hook de log (tabela RN-02, confirmada por leitura de `solicitacaoService.ts`, `tenantServiceDirect.ts`, `masterProductService.ts`, `LegalDocumentForm.tsx`, `admin/legal-documents/page.tsx`, `admin/settings/page.tsx` e das rotas de API de usuários/consultores/clínicas); (6) exportação em CSV e PDF (RN-07); (7) retenção indefinida, sem TTL (RN-08). Confirmado, por leitura completa do código, que UC-14 (Auditar e Corrigir Inconsistências de Inventário) não tem relação com este UC apesar do nome parecido (é reconciliação de quantidades, não histórico de ações), e que não existe hoje nenhum precedente de rastreamento de leitura/visualização em nenhuma parte do sistema. Estrutura proposta para a nova coleção `audit_log` e para a regra do Firestore correspondente (RN-05, RNF-01), seguindo os mesmos padrões de nomenclatura e segurança já estabelecidos no projeto. Documento aprovado sem pendências bloqueantes — apenas observações não bloqueantes registradas na Seção 14, mesmo padrão de fechamento já usado em UC-51/UC-52. |
| 1.1 | 27/09/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Atualização de as-is: feature implementada e deployada.** Sinalizado pelo `uc-issues-tracker` (notas v3.34/v3.35 do `_MAPA-DE-BUGS-E-MELHORIAS.md`) que este UC ainda descrevia a feature como "não implementada" apesar do código já mergeado (PRs #291 fundação, #293 instrumentação, #294 testes unitários, #295 telas/exportação/caderno Playwright — todos em `gscandelari_setup`, deployados em `dev-gscandelari.web.app`). Introdução e Seção 3 (pré-condição de implementação) reescritas para refletir o as-is; nota de implementação adicionada antes da Tabela de mapeamento (RN-02) confirmando RN-01/03/04/05/07/08/09/10/11/12 implementadas conforme desenhado e RN-06 implementada com refinamento (helpers `writeAuditLogAdmin`/`writeAdminAuditLog`, try/catch isolado nunca propagando falha, PR #294); linha "Clínica | Editar dados cadastrais" da tabela de mapeamento ajustada para refletir o achado técnico real (hook no *call site* de `/admin/tenants/[id]/page.tsx`, não em `tenantServiceDirect.ts`, para não capturar o onboarding do Clinic Admin/UC-45, fora de escopo pela RN-10); RNF-01 a RNF-05 confirmados implementados (RNF-02 com o ajuste de paginação em janela crescente, não cursor duplo); Seção 13 atualizada com os arquivos reais implementados e a spec de implementação (`FEAT-trilha-de-auditoria-consultar-exportar.md`, v1.2, Concluído). Seção 14 fecha os itens 2 e 3 (já resolvidos na implementação) e adiciona os itens 4 a 7, registrando como conhecidas e não bloqueantes as lacunas de cobertura do caderno Playwright documentadas na spec de implementação: E2E não cobre ações via API (criar usuário/clínica/consultor), escritas client-side (produto master, documento legal, configurações), paginação "Carregar mais" e o Fluxo de Exceção 8a (erro de carga) — recomendada extensão futura do caderno. Item 1 (RN-10, escopo de entidades) permanece como nota de escopo futuro genuína, sem mudança. `**Status:**` alterado de "Aprovado" para "Implementado". |
| 1.2 | 02/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Esclarecimento de escopo, sem mudança de código ou comportamento** — decisão de produto confirmada nesta sessão a partir do comportamento real já existente: a restrição de acesso descrita em RN-04/Seção 2.1 (`clinic_user`/`clinic_consultant` sem acesso) é exclusiva da tela "Trilha de Auditoria" deste UC. Fora deste UC, a leitura da coleção `inventory_activity` continua compartilhada entre `clinic_admin` e `clinic_user` do mesmo tenant (widget "Atividade Recente" do dashboard, `getRecentActivity`, confirmado sem gate de role por leitura de `src/app/(clinic)/clinic/dashboard/page.tsx`; e pela regra dedicada em `firestore.rules`, cujo comentário já documentava essa decisão de leitura ampla). Esclarecimento adicionado para evitar que o texto de RN-04 seja lido como se restringisse a coleção `inventory_activity` como um todo — não apenas a apresentação unificada deste UC. Seção 2.1, RN-04 (seção 9), diagrama (seção 1), fluxo de exceção 8b, seções 12/13 e novo item 8 da seção 14 atualizados de acordo. Nenhuma relação com a correção de regras do Firestore do PR #344 (que trata de restrição de **escrita**, não desta distinção de leitura, já existente antes do PR). |
| 1.3 | 10/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Ampliação pontual de escopo (RN-10) — feature "Precificação pela Hora Clínica" (spec `FEAT-precificacao-hora-clinica.md` v1.7, decisão D4 do usuário, PR #382) — as-is.** Novo `entity_type` `'financial_config'` ("Dados Financeiros") e novas ações `share_with_consultant` ("Compartilhar com Consultor") e `unshare_with_consultant` ("Revogar Compartilhamento"), gravadas client-side por `clinic_admin` somente quando o estado do compartilhamento de dados financeiros com o consultor muda (inclui troca do destinatário e revogação automática por troca de consultor, `metadata.motivo: 'troca_de_consultor'`); valores financeiros continuam não auditados. RN-10 marcada `[AMPLIADA]`, RN-05 (tipos), tabela de mapeamento RN-02 (nova linha), resumo, diagrama (nova fonte UC-58), atores (2.1/2.2), Fluxo Principal (passo 5 — categoria), Fluxo Alternativo 7b, seções 12, 13 e 14 (item 1 atualizado; novo item 9 — lacuna de cobertura E2E) atualizados. |
