# Bugfix: Allowlist de Subcoleções do Tenant para Leitura do Consultor

**Projeto:** Curva Mestra
**Data:** 09/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/consultant-subcollection-allowlist`
**Prioridade:** Média
**Versão:** 1.1
**Origem:** `UC-48-RN-06` (Média, Achado de segurança) — `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.51)

> Hoje `firestore.rules:96` libera ao consultor a leitura de **qualquer** subcoleção dos tenants em `authorized_tenants`, exceto `nf_imports` (blocklist de um item). Esta correção troca a blocklist por uma **allowlist** com exatamente as subcoleções que o Portal do Consultor lê hoje pelo client SDK — `inventory`, `stock_limits` e `solicitacoes` — tornando qualquer subcoleção atual ou futura (`protocolos`, `inventory_activity`, `notifications`, `settings`, `financeiro`, ...) negada ao consultor por construção. O isolamento entre tenants já está correto e não muda; o filtro **por marca** dentro de `inventory` (`UC-48-RN-06-Decisão`) fica fora deste fix e não é pré-requisito dele.

> **D1 decidida em 09/10/2026 (usuário): opção (B)** — o consultor só lê `protocolos` quando o opt-in financeiro estiver ativo para ele (`get()` em `financeiro/custo_hora`, preso ao `consultant_id`). Ver Seção 4.4. Documento pronto para o `dev-task-manager`.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (antes de criar a branch: conferir que `develop` existe local + remoto e está em sync com `master`; `git checkout develop && git pull origin develop`).
- **Branch da task:** `bugfix/consultant-subcollection-allowlist`
  - Observação: o pedido original sugeria `fix/consultant-subcollection-allowlist`. O SST (`GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, Seção 1, tabela de branches) só reconhece `feature/*`, `bugfix/*`, `hotfix/*` e `chore/*` — por isso o prefixo `bugfix/`.
- **Fluxo:** `bugfix/consultant-subcollection-allowlist` → PR → branch pessoal (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal (ex.: `dev-gscandelari.web.app`) → PR → `develop`.
- **PR sempre para a branch pessoal e depois `develop`, nunca para `master`.**

| Step | Tipo | Escopo | Mensagem de commit planejada | Condição |
|---|---|---|---|---|
| STEP 1 | `fix` | `firebase` | `fix(firebase): restrict consultant reads to subcollection allowlist` | Sempre |
| STEP 2 | `test` | `firebase` | `test(firebase): cover consultant subcollection allowlist in rules suite` | Sempre |
| STEP 3 | `fix` | `firebase` | `fix(firebase): gate consultant protocol reads on financial opt-in` | Sempre (D1 = B). Se a FEAT v1.2 já estiver em `develop` com a mesma regra (Cenário 2, Seção 4.4.2), só há commit de regra se houver diff; os testes entram com `test(firebase): cover consultant protocol reads gated by financial opt-in` |
| STEP 4 | — | — | Validação manual, sem commit de código | Sempre |

Ao abrir o PR para `develop` (Seção 15 do SST): acionar `uml-use-case-writer` para atualizar UC-48 (RN-06 e RNF-03 deixam de afirmar que o isolamento "de marca" é reforçado pela regra; passam a descrever a allowlist; referência de linha `firestore.rules` atualizada) e UC-52 (RN-08 e RNF-03 citam a regra genérica antiga `match /tenants/{tenantId}/{document=**}`; passam a citar a allowlist, com `solicitacoes` explicitamente incluída), e `uc-issues-tracker` (Modo B) para mover `UC-48-RN-06` para "Corrigido e Documentado". `UC-48-RN-06-Decisão` permanece aberta (Seção 4.5).

---

## 1. Contexto e Motivação

### 1.1 Situação atual

Bloco genérico de subcoleções do tenant em `firestore.rules` (linhas 87–97):

```js
match /tenants/{tenantId}/{collectionId}/{document=**} {
  allow read, write: if isSystemAdmin();
  allow read: if belongsToTenant(tenantId) && collectionId != 'nf_imports';
  // linha 96:
  allow read: if consultantHasAccess(tenantId) && collectionId != 'nf_imports';
}
```

`consultantHasAccess(tenantId)` (linhas 32–36) exige `is_consultant == true`, `active == true` e `tenantId in authorized_tenants`. Como as regras do Firestore são avaliadas com semântica OR entre blocos `match`, a linha 96 concede ao consultor leitura (`get` e `list`) de **toda** subcoleção do tenant que não seja `nf_imports` — inclusive as que nenhuma tela do consultor usa.

**Varredura completa do Portal do Consultor** (`src/app/(consultant)/**`, componentes e serviços que ele importa), feita para esta spec:

| Tela / componente | Arquivo | Leitura Firestore **direta** (client SDK) | Coleção afetada |
|---|---|---|---|
| Layout do portal | `src/app/(consultant)/layout.tsx` → `src/components/auth/ProtectedRoute.tsx` (l. 66), `src/components/consultant/ConsultantLayout.tsx` | `getDoc(system_settings/global)`; layout sem leituras | `system_settings` (raiz, fora do escopo) |
| Dashboard | `src/app/(consultant)/consultant/dashboard/page.tsx` (l. 86) | `getReplenishmentProjections(clinic.id)` para cada clínica ativa (`Promise.allSettled`) | `inventory` (`where('active','==',true)`) + `solicitacoes` (`where('status','==','concluida')`, `where('dt_procedimento','>=',…)`) — `src/lib/services/projectionService.ts` l. 184–196 |
| Minhas Clínicas | `.../consultant/clinics/page.tsx` | nenhuma (só `GET /api/consultants/me/clinics`, Admin SDK) | — |
| Buscar Clínica | `.../consultant/clinics/search/page.tsx` | nenhuma (`/api/tenants/search`, `/api/consultants/claims`) | — |
| Detalhe da clínica | `.../consultant/clinics/[tenantId]/page.tsx` (l. 65–95) | `getDocs(query(inventory, where('brand','==','Rennova')))`; `getDoc(tenants/{tenantId})` | `inventory`; documento raiz do tenant (regra própria, l. 41–55, **não muda**) |
| Estoque da clínica | `.../consultant/clinics/[tenantId]/inventory/page.tsx` → `src/components/inventory/InventoryView.tsx` (l. 243–283) | `getDocs(query(inventory, where('active','==',true), orderBy('nome_produto','asc')))`; `getDocs(stock_limits)` (falha **silenciosa**: `.catch(() => {})`) | `inventory`, `stock_limits` |
| Projeções | `.../consultant/clinics/[tenantId]/projections/page.tsx` → `src/components/inventory/ProjectionsView.tsx` (l. 47) | `getReplenishmentProjections(tenantId)` | `inventory`, `solicitacoes` |
| Relatórios | `.../consultant/reports/page.tsx` | nenhuma (placeholder "Em Desenvolvimento"; só `/api/consultants/me/clinics`) | — |
| Transferências / Solicitações de acesso / Perfil | `.../transfer-requests/page.tsx`, `.../access-requests/page.tsx`, `.../profile/page.tsx` | nenhuma (somente API routes com Admin SDK) | — |

Conclusão: o consultor lê, pelo client SDK, **somente** `inventory`, `stock_limits` e `solicitacoes` dentro de `tenants/{tenantId}/…`, além do documento raiz `tenants/{tenantId}` (bloco próprio). Nenhuma tela lê `protocolos`, `inventory_activity`, `notifications`, `settings`, `users` ou `nf_imports`. Todas as demais leituras do portal passam por API routes (Admin SDK), que não são afetadas por `firestore.rules`.

Suíte de rules existente: `tests/rules/firestore-tenant-subcollections.test.ts` (rodada por `npm run test:rules`, gate de CI em `.github/workflows/e2e.yml` l. 73). O `describe.each` das linhas 131–223 hoje **afirma** que o consultor com acesso lê `inventory`, `stock_limits`, `protocolos`, `solicitacoes` e `inventory_activity` — ou seja, o comportamento do achado está congelado em teste.

### 1.2 Problema identificado

1. **Blocklist em vez de allowlist** (`UC-48-RN-06`): o consultor lê `protocolos`, `inventory_activity`, `notifications`, `settings/notifications`, `users` (subcoleção morta) e qualquer subcoleção futura — dados que nenhuma tela dele usa. Toda subcoleção nova nasce exposta ao consultor por omissão (ex.: `financeiro`, da feature de precificação, precisou de exclusão explícita na própria spec dela).
2. **Documentação incorreta:** UC-48 RN-06/RNF-03 afirmam que o isolamento "de marca" é reforçado pela regra do Firestore — não é (o filtro `brand == 'Rennova'` é só de UI). UC-52 RN-08/RNF-03 citam uma regra (`{document=**}`) que não existe mais.
3. **Regressões silenciosas possíveis:** `InventoryView` ignora erro de `stock_limits` e o Dashboard usa `Promise.allSettled` — uma allowlist incompleta quebraria o badge de estoque baixo ou o card de projeções **sem erro visível**. Por isso a cobertura de rules (Seção 8) é obrigatória, não opcional.

### 1.3 Motivação estratégica

Princípio de menor privilégio no único ator externo à clínica com acesso a dados dela (o consultor da marca). A correção é pequena, isolada em `firestore.rules`, coberta por suíte automatizada já existente e reduz a superfície de exposição antes de a feature de precificação (`feature/precificacao-hora-clinica`) introduzir dados financeiros no tenant.

---

## 2. Objetivos

1. **Substituir** a condição da linha 96 de `firestore.rules` por uma allowlist explícita (`inventory`, `stock_limits`, `solicitacoes`).
2. **Garantir** que todas as telas atuais do consultor continuem funcionando (UC-48, UC-52 — incluindo `solicitacoes`, exigida por UC-52 RN-08).
3. **Garantir** que qualquer subcoleção fora da allowlist — atual ou futura — retorne `permission-denied` ao consultor, em `get` e em `list`.
4. **Cobrir** a allowlist na suíte `npm run test:rules`, por subcoleção, com consultor com e sem acesso.
5. **Definir** como esta correção convive com `feature/precificacao-hora-clinica` em qualquer ordem de merge (Seção 4.4).
6. **Registrar** `UC-48-RN-06-Decisão` como pendência fora de escopo, sem acoplamento com a allowlist (Seção 4.5).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | Consultor com o tenant em `authorized_tenants` lê (`get` e `list`) `tenants/{tenantId}/inventory`, `/stock_limits` e `/solicitacoes`. | clinic_consultant | Must |
| RF-02 | Consultor com acesso recebe `permission-denied` (`get` e `list`) em qualquer outra subcoleção do tenant: `protocolos` (exceto com opt-in financeiro ativo para o próprio consultor — D1, Seção 4.4.1), `inventory_activity`, `notifications`, `settings`, `users`, `nf_imports`, `financeiro` e qualquer nome não listado. | clinic_consultant | Must |
| RF-03 | Consultor sem o tenant em `authorized_tenants`, ou com `active != true`, não lê nenhuma subcoleção do tenant (inclusive as da allowlist). | clinic_consultant | Must |
| RF-04 | Consultor continua sem permissão de escrita em qualquer subcoleção. | clinic_consultant | Must |
| RF-05 | Leitura do documento raiz `tenants/{tenantId}` pelo consultor com acesso permanece inalterada (tela de detalhe da clínica). | clinic_consultant | Must |
| RF-06 | `clinic_admin`, `clinic_user` e `system_admin` mantêm exatamente as permissões atuais. | todos | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | A allowlist usa o wildcard de um segmento `{collectionId}` já existente, compatível com `get` **e** `list` (lição do PR #344 registrada no comentário de `firestore.rules` l. 64–75). | Manutenibilidade |
| RNF-02 | A allowlist fica definida em **um único lugar** (função helper), com comentário apontando a tela/UC que justifica cada item. | Manutenibilidade / Segurança |
| RNF-03 | Nenhum `get()`/`exists()` adicional nas rules para a allowlist base (custo de leitura zero). | Performance / Custo |
| RNF-04 | Toda subcoleção nova do tenant nasce negada ao consultor (fail-closed por construção). | Segurança |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | Entrar na allowlist exige uma tela do Portal do Consultor que leia a subcoleção via client SDK, citada no comentário da regra. | Evita que a lista volte a crescer por conveniência. |
| RN-02 | `solicitacoes` é obrigatória na allowlist enquanto UC-52 calcular projeção client-side para o consultor. | UC-52 RN-08 / RN-09. |
| RN-03 | Compartilhamentos opcionais com o consultor (ex.: `financeiro`, futuro compartilhamento de NF-e) **não** entram na allowlist: usam bloco dedicado com opt-in do `clinic_admin`. | Padrão já adotado para `nf_imports` e para `financeiro` (FEAT precificação, D5). |
| RN-04 | O filtro por marca dentro de `inventory` continua sendo responsabilidade da UI até a resolução de `UC-48-RN-06-Decisão`. | Fora de escopo (Seção 4.5). |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Helper com a allowlist + troca da condição da linha 96, mantendo a estrutura do bloco genérico:

```js
// Subcoleções do tenant que o Portal do Consultor lê diretamente via client
// SDK (UC-48-RN-06). Allowlist — qualquer subcoleção fora desta lista, atual
// ou futura, é negada ao consultor por construção.
//   inventory    — detalhe da clínica (stats), InventoryView, projeções (UC-48, UC-52)
//   stock_limits — badge de estoque baixo no InventoryView (UC-48)
//   solicitacoes — taxa de consumo das projeções (UC-52 RN-08)
// Compartilhamentos opt-in (ex.: financeiro) NÃO entram aqui: têm bloco dedicado.
function consultantReadableSubcollection(collectionId) {
  return collectionId in ['inventory', 'stock_limits', 'solicitacoes'];
}
```

Por que no bloco genérico (e não `allow read` em cada bloco dedicado): uma única lista, auditável em uma linha, testável por `describe.each`; os blocos dedicados continuam sendo só de escrita (padrão atual). A exclusão de `nf_imports` na linha do consultor fica redundante (não está na lista) e é removida; na linha de `belongsToTenant` ela continua.

### 4.2 Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Ampliar a blocklist (`!(collectionId in ['nf_imports', 'protocolos', ...])`) | Continua fail-open para subcoleções futuras — é exatamente o achado. |
| `allow read: if consultantHasAccess(tenantId)` dentro de cada bloco dedicado (`inventory`, `stock_limits`, `solicitacoes`) | Funciona, mas espalha a política em 3 lugares; mais fácil alguém adicionar leitura do consultor num bloco novo sem perceber. Equivalente em segurança; preterida por legibilidade. |
| Servir tudo ao consultor via API (Admin SDK) e remover qualquer leitura direta | É a opção (b) de `UC-48-RN-06-Decisão` — decisão de produto pendente, escopo muito maior. A allowlist não impede essa evolução (Seção 4.5). |

### 4.3 Trade-offs aceitos

- O consultor continua lendo **todo** `inventory` do tenant (todas as marcas, com `valor_unitario`) e **todas** as `solicitacoes` (com produtos de qualquer marca). A allowlist reduz o conjunto de subcoleções, não filtra documentos. Explicitamente aceito até `UC-48-RN-06-Decisão`.
- O documento raiz `tenants/{tenantId}` continua legível por inteiro pelo consultor (regra l. 54). Fora do escopo desta correção (ver Seção 10, "descoberta registrada").
- Mudança de comportamento observável apenas para leituras que nenhuma tela faz — nenhum impacto de UX esperado.

### 4.4 Convivência com `feature/precificacao-hora-clinica` (qualquer ordem de merge) e D1 (decidida)

Referência: `ONLY_FOR_DEVS/TO_DO/FEAT-precificacao-hora-clinica.md` (v1.2, Status Planejamento — **ainda não versionado em `develop`**, existe só no working tree principal). Pontos dessa spec que tocam esta correção:

1. Ela altera **as mesmas duas linhas** do bloco genérico (Seção 5.4 dela): `collectionId != 'nf_imports'` → `!(collectionId in ['nf_imports', 'financeiro'])` nas linhas de `belongsToTenant` **e** de `consultantHasAccess`.
2. Ela cria o bloco dedicado `match /tenants/{tenantId}/financeiro/{docId}` com leitura do consultor condicionada a `resource.data.compartilhar_com_consultor == true` e `resource.data.compartilhado_com_consultant_id == request.auth.token.consultant_id`.
3. A tela nova `/consultant/clinics/[tenantId]/pricing` (Seção 6.3.4 dela) lê `financeiro/custo_hora`, `inventory` **e a lista de `protocolos`**.
4. A partir da v1.2 dela, a leitura de `protocolos` pelo consultor exige o mesmo opt-in financeiro — **a mesma regra** definida abaixo (D1 = B).

**Por que as duas mudanças são compatíveis:** a leitura de `financeiro` pelo consultor vem do bloco dedicado (semântica OR), não do bloco genérico. Com a allowlist, `financeiro` fica fora do genérico por construção — a exclusão explícita que a FEAT faz na linha do consultor se torna desnecessária, mas não conflitante em semântica. `inventory` já está na allowlist. `protocolos` fica **fora** da allowlist e ganha leitura condicional no bloco dedicado (D1).

#### 4.4.1 D1 — decidida em 09/10/2026 pelo usuário: opção (B)

> **D1 (resolvida):** o consultor **não** lê `protocolos` pela allowlist; lê **somente** quando o compartilhamento financeiro estiver ativo **para ele** — `get()` no documento `tenants/{tenantId}/financeiro/custo_hora`, exigindo `compartilhar_com_consultor == true` **e** `compartilhado_com_consultant_id == request.auth.token.consultant_id` (mesma condição do bloco `financeiro` da FEAT, RN-13/D5 dela). Alternativas descartadas: (A) incluir `protocolos` na allowlist sem condição; (C) deixar a FEAT incluí-la sem condição.

Regra (aplicada por **este fix** no STEP 3, independentemente da ordem de merge):

```js
// Helper (junto aos demais, após consultantReadableSubcollection):
// opt-in financeiro ativo PARA ESTE consultor (FEAT precificação RN-13/D5).
// Documento inexistente => get() devolve null => false (negado).
function consultantHasFinancialOptIn(tenantId) {
  let fin = get(/databases/$(database)/documents/tenants/$(tenantId)/financeiro/custo_hora);
  return fin != null
    && fin.data.get('compartilhar_com_consultor', false) == true
    && fin.data.get('compartilhado_com_consultant_id', null) == request.auth.token.consultant_id;
}

match /tenants/{tenantId}/protocolos/{protocoloId} {
  allow write: if belongsToTenant(tenantId) && hasRole('clinic_admin'); // já existe
  // Consultor lê protocolos somente com o opt-in financeiro ativo para ELE (UC-48-RN-06 / D1).
  allow read: if consultantHasAccess(tenantId) && consultantHasFinancialOptIn(tenantId);
}
```

Custo aceito: 1 leitura de documento cobrada por avaliação da regra de leitura de `protocolos` pelo consultor (em `list`, uma por query, não por documento). `consultantHasAccess` vem primeiro no `&&`, então o `get()` só é avaliado para consultores com o tenant autorizado; leituras de `clinic_admin`/`clinic_user`/`system_admin` são concedidas pelo bloco genérico e não dependem desta condição.

#### 4.4.2 Comportamento por ordem de merge

**Cenário 1 — este fix entra em `develop` primeiro (FEAT ainda não mergeada):**
- O documento `financeiro/custo_hora` não existe em nenhum tenant real e **não pode ser criado** por clientes (sem bloco dedicado, o genérico não concede escrita — só `system_admin`). Logo `consultantHasFinancialOptIn` é sempre `false` e o consultor **não lê `protocolos`**: comportamento idêntico a `protocolos` simplesmente fora da allowlist. Nenhuma tela atual é afetada (nenhuma lê `protocolos`).
- Os testes do STEP 3 rodam normalmente, porque a suíte grava `financeiro/custo_hora` com `withSecurityRulesDisabled` — a regra de `protocolos` é exercitada por completo mesmo sem o bloco `financeiro` da FEAT.
- Ao sincronizar `feature/precificacao-hora-clinica` com `develop`: (a) **conflito textual** na linha do consultor do bloco genérico — resolução: **manter a allowlist** e aplicar a mudança da FEAT **apenas** na linha de `belongsToTenant`; (b) o helper `consultantHasFinancialOptIn` e o `allow read` do consultor em `protocolos` **já existem** — a FEAT **não** os duplica (manter uma única cópia); (c) o bloco dedicado `financeiro` entra sem alteração. A partir daí, o opt-in real passa a liberar `protocolos` e a tela `/pricing` funciona.

**Cenário 2 — a FEAT entra em `develop` primeiro:**
- A FEAT v1.2 já terá trazido o helper e o `allow read` do consultor em `protocolos`. Este fix substitui a linha do consultor do bloco genérico pela allowlist (resultado para `financeiro` igual: negado no genérico, liberado com opt-in no dedicado) e, no STEP 3, **verifica** que a regra de `protocolos` está idêntica à da Seção 4.4.1 (ajusta se divergir; não duplica). Se não houver diff de regra no STEP 3, entram só os testes.
- **Atenção:** no Cenário 2, enquanto este fix não entra, o bloco genérico (blocklist) ainda concede ao consultor leitura de `protocolos` **sem** opt-in — o `allow read` condicional da FEAT não restringe nada sozinho (semântica OR). A restrição de `protocolos` ao opt-in só passa a valer de fato quando a allowlist deste fix entra.

**Testes comuns aos dois cenários (Seção 8):**
- `financeiro/custo_hora` semeado **sem** os campos de opt-in → consultor com acesso **não** lê `financeiro` (verdadeiro com ou sem o bloco dedicado da FEAT).
- `protocolos`: sem `financeiro/custo_hora` → nega; opt-in `false` → nega; opt-in `true` para **outro** `consultant_id` → nega; opt-in `true` para o próprio `consultant_id` → `get` e `list` permitidos; consultor **sem** o tenant em `authorized_tenants` com opt-in válido → nega; consultor inativo → nega; consultor nunca escreve.

### 4.5 Fora de escopo: `UC-48-RN-06-Decisão` (pendente, trabalho futuro)

Registrada no mapa, Seção 4.1: (a) aceitar o filtro de marca só na UI, como decisão consciente documentada; ou (b) servir o inventário ao consultor via API server-side (Admin SDK) já filtrada por marca, retirando a leitura direta de `inventory` nas rules. **Esta correção não depende dela:**

- Com (a): nada a mudar na allowlist; só documentação (UC-48).
- Com (b): basta remover `inventory` (e, se as projeções também migrarem, `solicitacoes`) da função `consultantReadableSubcollection` — a estrutura criada aqui é justamente o ponto único dessa mudança.
- Ponto de atenção para quem decidir: hoje a tela de **projeções** (UC-52, `ProjectionsView` + `projectionService`) e o card do Dashboard do consultor **não filtram por marca** — por decisão de produto (UC-52 RN-09, "mesma visão completa da clínica"). Ou seja, o consultor já vê nomes de produtos de outras marcas na própria UI. A decisão (b) precisaria tratar também `solicitacoes`/projeções, não só `inventory`.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

N/A — nenhum arquivo novo.

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---|---|
| `firestore.rules` | Nova função `consultantReadableSubcollection(collectionId)`; linha 96 passa a `allow read: if consultantHasAccess(tenantId) && consultantReadableSubcollection(collectionId);`; comentários das linhas 57–62, 91–96, 105–144 e 146–156 atualizados para refletir a allowlist (hoje dizem "Consultores têm acesso READ-ONLY às subcoleções" e "leitura ampla" incluindo consultor). Helper `consultantHasFinancialOptIn(tenantId)` + `allow read` do consultor no bloco `protocolos` (D1 = B, STEP 3; Seção 4.4.1). |
| `tests/rules/firestore-tenant-subcollections.test.ts` | `describe.each` existente ganha a coluna "consultor lê?"; novo `describe` da allowlist (Seção 8); helpers `consultantWithAccess` ganha `consultant_id`; novo helper `inactiveConsultantWithAccess`. |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

| Coleção | Ação | Detalhes |
|---|---|---|
| `tenants/{tenantId}/inventory`, `/stock_limits`, `/solicitacoes` | Nenhuma (leitura do consultor mantida) | Allowlist. |
| `tenants/{tenantId}/protocolos` | Leitura do consultor **condicionada** ao opt-in financeiro (D1 = B) | `get()` extra em `financeiro/custo_hora` por avaliação. Sem o documento (Cenário 1), negada. Nenhuma tela atual afetada. |
| `tenants/{tenantId}/inventory_activity`, `/notifications`, `/settings/**`, `/users`, qualquer outra | Leitura do consultor **removida** | Nenhuma tela do consultor lê. |
| `tenants/{tenantId}/nf_imports` | Nenhuma (já negada) | Continua negada (agora por não estar na allowlist). |
| `tenants/{tenantId}` (raiz) | Nenhuma | Regra própria (l. 41–55). |
| `firestore.indexes.json` | Nenhuma | Nenhuma query nova. |
| Dados | Nenhuma migração | Mudança só de regra. |

Deploy: `firestore.rules` é publicado pelo pipeline normal da branch pessoal / `develop` (`firebase deploy --only firestore:rules` quando aplicável). Nenhuma Cloud Function envolvida.

### 5.5 O que NÃO muda

- Linha de `belongsToTenant` do bloco genérico (l. 93) — `clinic_admin`/`clinic_user` continuam lendo tudo exceto `nf_imports`.
- Blocos dedicados de escrita (`inventory`, `stock_limits`, `protocolos`, `solicitacoes`, `inventory_activity`, `nf_imports`, `notifications`, `settings/notifications`) — exceto o `allow read` do consultor com opt-in financeiro em `protocolos` (D1).
- Regras de `collectionGroup` (`inventory_activity`, `inventory`), `consultants`, `consultant_claims`, documento raiz `tenants/{tenantId}`.
- Todas as telas e serviços (`src/app/(consultant)/**`, `InventoryView.tsx`, `ProjectionsView.tsx`, `projectionService.ts`) — nenhuma alteração de código de aplicação.
- API routes do consultor (`/api/consultants/**`, `/api/tenants/[id]/consultant`) — usam Admin SDK.
- `storage.rules`.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — nenhum tipo TypeScript ou campo de documento muda.

### 6.2 Mudanças em serviços / regras

`firestore.rules` — antes (l. 95–96):

```js
// Consultores têm acesso READ-ONLY às subcoleções, mesma exceção.
allow read: if consultantHasAccess(tenantId) && collectionId != 'nf_imports';
```

Depois:

```js
// Consultores: READ-ONLY e apenas na allowlist (UC-48-RN-06) — ver
// consultantReadableSubcollection(). nf_imports, financeiro e qualquer
// subcoleção futura ficam negadas ao consultor por construção.
allow read: if consultantHasAccess(tenantId)
  && consultantReadableSubcollection(collectionId);
```

A função `consultantReadableSubcollection` (Seção 4.1) é declarada junto aos demais helpers, logo após `consultantHasAccess` (l. 32–36). Comentários a revisar no mesmo commit:

- l. 57–62: "fallback de LEITURA ampla para qualquer subcoleção" → explicitar que a leitura ampla vale para usuários do tenant; para o consultor, só a allowlist.
- l. 105–144: os blocos `inventory`, `stock_limits`, `solicitacoes` mencionam "leitura ampla (bloco genérico)" — acrescentar "(consultor: allowlist)"; `protocolos` e `inventory_activity` — acrescentar "(consultor: não lê)" ou a regra da D1.
- l. 146–156 (`nf_imports`): a frase "Consultor também fica de fora por padrão" passa a valer pela allowlist; ajustar a explicação.

### 6.3 Mudanças na UI

N/A — nenhuma tela muda. Comportamento esperado idêntico em todas as telas do consultor (Seção 1.1).

### 6.4 Mudanças em API Routes

N/A.

---

## 7. Plano de Implementação

### STEP 1 — Allowlist em `firestore.rules`

**Objetivo:** Consultor passa a ler pelo bloco genérico só `inventory`, `stock_limits` e `solicitacoes`.

**Arquivos afetados:**
- `firestore.rules` — helper novo, linha 96, comentários (Seção 6.2).

**Ações:**
1. Sincronizar `develop` e verificar se o bloco `match /tenants/{tenantId}/financeiro/{docId}` já existe (indica Cenário 2 da Seção 4.4).
2. Declarar `consultantReadableSubcollection(collectionId)` após `consultantHasAccess`.
3. Substituir a condição da linha do consultor no bloco genérico (qualquer que seja a versão atual — `!= 'nf_imports'` ou `!(collectionId in ['nf_imports', 'financeiro'])`).
4. Não tocar na linha de `belongsToTenant`.
5. Atualizar os comentários listados na Seção 6.2.

**Validação:** `firebase emulators:exec --only firestore "echo ok"` sobe sem erro de compilação de rules; `npm run test:rules` roda (os testes antigos do `describe.each` que afirmam leitura de `protocolos`/`inventory_activity` pelo consultor **devem falhar** neste ponto — prova de que a regra mudou; são corrigidos no STEP 2).

**Commit:** `fix(firebase): restrict consultant reads to subcollection allowlist`

---

### STEP 2 — Cobertura na suíte de rules

**Objetivo:** Congelar em teste a allowlist (permitidas, negadas, com/sem acesso, inativo) usando as queries reais das telas.

**Arquivos afetados:**
- `tests/rules/firestore-tenant-subcollections.test.ts`

**Ações:**
1. `describe.each` (l. 131–137): adicionar terceira coluna `consultantReads: boolean` — `inventory: true`, `stock_limits: true`, `protocolos: false` (sem opt-in semeado; o caso com opt-in fica no STEP 3), `solicitacoes: true`, `inventory_activity: false`. O teste "consultor com acesso ao tenant lê (get e list), mas não escreve" (l. 209–214) passa a usar `assertSucceeds`/`assertFails` conforme a coluna; escrita continua `assertFails` sempre.
2. Helpers: `consultantWithAccess` ganha `consultant_id: 'consultant-with-access'`; novo `inactiveConsultantWithAccess(tenantId)` (mesmas claims, `active: false`).
3. Novo `describe('Portal do Consultor — allowlist de subcoleções (UC-48-RN-06)')` com os cenários da Seção 8.
4. Rodar `npm run test:rules`.

**Validação:** `npm run test:rules` 100% verde, inclusive todos os testes pré-existentes de `clinic_admin`, `clinic_user`, `system_admin`, `users`, `nf_imports`, `notifications` e `settings/notifications`.

**Commit:** `test(firebase): cover consultant subcollection allowlist in rules suite`

---

### STEP 3 — `protocolos` com opt-in financeiro (D1 = B)

**Objetivo:** Consultor lê `protocolos` apenas quando o compartilhamento financeiro estiver ativo **para ele**; em qualquer outro caso, negado.

**Dependência de ordem de merge:** nenhuma para implementar — a regra funciona com ou sem o bloco `financeiro` da FEAT (sem o documento, o `get()` devolve `null` e a leitura é negada; ver Seção 4.4.2). Se a FEAT v1.2 já estiver em `develop` com a mesma regra, este step vira verificação + testes, sem duplicar a regra.

**Arquivos afetados:**
- `firestore.rules` — helper `consultantHasFinancialOptIn(tenantId)` e `allow read` do consultor no bloco `protocolos` (Seção 4.4.1); comentário do bloco `protocolos` atualizado ("consultor: só com opt-in financeiro — D1 / UC-48-RN-06").
- `tests/rules/firestore-tenant-subcollections.test.ts` — novo `describe('protocolos — leitura do consultor com opt-in financeiro (D1)')`.

**Ações:**
1. Verificar se o helper/regra já existem em `develop` (Cenário 2). Se sim, conferir que estão idênticos à Seção 4.4.1; se não, adicioná-los.
2. Testes (seed de `tenants/{A}/financeiro/custo_hora` via `withSecurityRulesDisabled`; consultor com `consultant_id: 'consultant-with-access'`): os cenários de "Testes comuns" da Seção 4.4.2, cada um em `get` e `list` de `tenants/{A}/protocolos`; mais regressão: `clinic_user` e `clinic_admin` continuam lendo `protocolos` sem nenhum documento `financeiro`.

**Validação:** `npm run test:rules` verde em qualquer cenário de merge (o seed independe do bloco `financeiro`). Se a FEAT já estiver em `develop`: `/consultant/clinics/[tenantId]/pricing` carrega os protocolos com o opt-in ligado e mostra o estado vazio com o opt-in desligado.

**Commit:** `fix(firebase): gate consultant protocol reads on financial opt-in` (Cenário 2 sem diff de regra: apenas `test(firebase): cover consultant protocol reads gated by financial opt-in`).

---

### STEP 4 — Validação Manual

**Objetivo:** Confirmar de ponta a ponta que todas as telas do consultor continuam funcionando e que o lado da clínica não regrediu. Este roteiro é a fonte para o `qa-agent` (Modo A) gerar o caderno `tests/e2e/UC-48-consultar-clinicas-vinculadas-e-estoque.spec.ts`, que ainda não existe (regra 8 do `CLAUDE.md`).

**Pré-requisitos:**
- Emulator Suite: `firebase emulators:start --project demo-curva-mestra-e2e --only auth,firestore,storage` + `npm run test:e2e:seed` + `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` (mesma configuração do `playwright.config.ts`). Senha dos usuários de teste: `TEST_PASSWORD` em `tests/e2e/fixtures/seed-data.ts`.
- Pela Emulator UI (`http://localhost:4000` → Firestore), criar em `tenants/test-clinic-a`:
  - `inventory/lote-rennova`: `{ codigo_produto: '9990001', nome_produto: 'Produto Rennova QA', brand: 'Rennova', active: true, quantidade_disponivel: 2, quantidade_reservada: 0, valor_unitario: 100, lote: 'QA1', dt_validade: <Timestamp +60 dias> }`
  - `inventory/lote-outra`: idem com `codigo_produto: '9990002'`, `nome_produto: 'Produto Outra Marca QA'`, `brand: 'OutraMarca'`.
  - `stock_limits/9990001`: `{ limite_estoque_baixo: 5 }` (maior que a quantidade → badge "estoque baixo").
  - `solicitacoes/sol-qa`: `{ status: 'concluida', dt_procedimento: <Timestamp -5 dias>, produtos_solicitados: [{ inventory_item_id: 'lote-rennova', produto_codigo: '9990001', produto_nome: 'Produto Rennova QA', lote: 'QA1', quantidade: 1, quantidade_disponivel_antes: 3, valor_unitario: 100 }] }` (formato `ProdutoSolicitado` de `src/types/index.ts` — atenção: o campo é `produto_codigo`, não `codigo_produto`; é o que `projectionService.ts` lê).
  - `protocolos/proto-qa` e `inventory_activity/act-qa` (qualquer conteúdo válido) — usados só para conferir a negação.

**Roteiro A — Consultor (sempre executar):**
1. Login como `qa.consultant@curvamestra.test` (aceitar termos se solicitado). **Esperado:** redireciona para `/consultant/dashboard`; card de projeções carrega sem erro; DevTools → Console sem `FirebaseError: Missing or insufficient permissions`.
2. Ir para `/consultant/clinics` → abrir "Clínica Teste A". **Esperado:** nome/documento da clínica exibidos (leitura do documento raiz) e estatísticas de estoque contando apenas o item Rennova.
3. Clicar "Ver Estoque". **Esperado:** lista mostra apenas "Produto Rennova QA"; o item exibe o badge de status "Baixo" (`StockBadge`) e entra no filtro "Estoque Baixo" (prova de que `stock_limits` continua legível — a falha aqui seria **silenciosa**, então conferir explicitamente).
4. Voltar e clicar "Ver Projeções". **Esperado:** tela "Projeções" carrega, sem toast de erro, com o produto da solicitação concluída considerado na taxa de consumo (prova de `solicitacoes` legível — UC-52 RN-08).
5. Emulator UI → Firestore → aba **Requests**: as leituras dos passos 1–4 aparecem como permitidas; nenhuma leitura de `protocolos`, `inventory_activity`, `notifications` ou `settings` foi feita pelo portal.
6. Tentar `/consultant/clinics/test-clinic-b` (tenant não autorizado). **Esperado:** redireciona para `/consultant/clinics` (comportamento atual, fluxo 7c de UC-48).

**Roteiro B — Regressão do lado da clínica (sempre executar):**
7. Login como `qa.clinic-admin-a@curvamestra.test`: `/clinic/dashboard` (Atividade Recente), `/clinic/inventory`, `/clinic/protocolos`, `/clinic/requests` e Minha Clínica → aba de limites carregam normalmente.
8. Login como `qa.clinic-user-a@curvamestra.test`: `/clinic/inventory`, `/clinic/protocolos` (listagem sem ações) e `/clinic/requests` carregam normalmente.

**Roteiro C — Negações (cobertas pela suíte de rules; conferir o resultado):**
9. `npm run test:rules` verde, incluindo o `describe` da allowlist.

**Roteiro D — Domínio Firebase pessoal (após merge na branch pessoal):**
10. Em `dev-gscandelari.web.app` (ou domínio pessoal equivalente), repetir os passos 1–4 com um consultor real de teste vinculado a uma clínica de teste com estoque.

**Commit:** nenhum.

---

## 8. Estratégia de Testes

### 8.1 Suíte de rules (`npm run test:rules`, gate de CI em `e2e.yml`)

Arquivo: `tests/rules/firestore-tenant-subcollections.test.ts`. Toda asserção de leitura em **`get` e `list`** (lição do PR #344).

| Grupo | Cenários obrigatórios |
|---|---|
| Permitidas ao consultor com acesso (`it.each` em `inventory`, `stock_limits`, `solicitacoes`) | `get` permitido; `list` simples permitido; escrita (`updateDoc`, `setDoc` novo, `deleteDoc`) negada. |
| Queries reais das telas | `inventory`: `where('active','==',true), orderBy('nome_produto','asc')` (InventoryView) e `where('brand','==','Rennova')` (detalhe da clínica) permitidas; `solicitacoes`: `where('status','==','concluida'), where('dt_procedimento','>=', Timestamp)` (projectionService) permitida; `stock_limits`: `getDocs(collection)` permitida. |
| Negadas ao consultor com acesso (`it.each`) | `protocolos` (sem `financeiro/custo_hora`), `inventory_activity`, `notifications`, `settings` (doc `settings/notifications`), `users`, `nf_imports`, `financeiro` (doc `custo_hora` **sem** campos de opt-in), `subcolecao_futura_qa` — `get` e `list` negados. |
| Consultor sem o tenant em `authorized_tenants` | `get` e `list` negados nas 3 permitidas. |
| Consultor inativo (`active: false`) com o tenant autorizado | `get` e `list` negados nas 3 permitidas. |
| Documento raiz `tenants/{A}` | consultor com acesso: `get` permitido; sem acesso: negado (regressão RF-05). |
| Regressão de outros papéis | Testes existentes de `clinic_admin`, `clinic_user`, `system_admin` continuam verdes sem alteração (inclusive `clinic_user` lendo `protocolos` e `inventory_activity`). |
| `protocolos` com opt-in financeiro (D1 = B, STEP 3) | Cenários de "Testes comuns" da Seção 4.4.2, todos em `get` e `list`; regressão `clinic_user`/`clinic_admin` lendo `protocolos` sem nenhum documento `financeiro`. |

### 8.2 Jest (`npm run test`)

N/A — nenhuma função pura TypeScript nova ou alterada.

### 8.3 E2E (`npm run test:e2e`)

- Regressão obrigatória: `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts` (inclui o fluxo do consultor em `/consultant/clinics/{id}/projections`), `UC-54-*` e `UC-56-*` (fluxos do consultor) devem continuar verdes.
- Caderno novo: após a conclusão (Modo B do `dev-task-manager`), acionar `qa-agent` (Modo A) a partir do STEP 4 para gerar `tests/e2e/UC-48-consultar-clinicas-vinculadas-e-estoque.spec.ts`, com revisão humana obrigatória antes de virar gate.

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test        — suíte Jest verde (sem testes novos esperados)
[ ] npm run test:rules  — verde, com o describe da allowlist (get + list em todos os cenários)
[ ] npm run test:e2e    — UC-52, UC-54, UC-56 verdes (regressão do portal do consultor)
[ ] Multi-tenant: consultor sem o tenant em authorized_tenants continua negado em todas as subcoleções
[ ] Allowlist definida em um único helper, com comentário justificando cada item (RN-01)
[ ] Comentários de firestore.rules atualizados (nenhum texto dizendo "consultor lê qualquer subcoleção")
[ ] Convivência com feature/precificacao-hora-clinica verificada para o cenário de merge real (Seção 4.4)
[ ] Segurança: nenhum secret ou credencial no código
[ ] STEP 4 executado (Roteiros A, B, C e D)
[ ] Branch pessoal: task branch mergeada na branch pessoal para validação no Firebase
[ ] PR: aberto para develop com template preenchido
[ ] uml-use-case-writer: UC-48 (RN-06, RNF-03) e UC-52 (RN-08, RNF-03) atualizados
[ ] uc-issues-tracker (Modo B): UC-48-RN-06 → Corrigido e Documentado; UC-48-RN-06-Decisão permanece aberta
[ ] qa-agent (Modo A) acionado após a conclusão para o caderno UC-48
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Alguma leitura do consultor não mapeada quebrar silenciosamente (`stock_limits` com `.catch(() => {})`, Dashboard com `Promise.allSettled`) | Baixa | Médio | Varredura completa da Seção 1.1; testes de rules com as queries reais; STEP 4 passo 3 confere o badge explicitamente; aba Requests do Emulator UI. |
| Conflito de merge com `feature/precificacao-hora-clinica` resolvido do jeito errado (reintroduzindo a blocklist) | Média | Alto | Seção 4.4 descreve a resolução para os dois cenários; teste "`subcolecao_futura_qa` negada" falha se a blocklist voltar. |
| Tela `/pricing` da FEAT quebrar por `protocolos` negado | Baixa | Médio | D1 = B: leitura liberada pelo opt-in; regra única compartilhada pelos dois specs (Seção 4.4.2). |
| Regra de `protocolos` duplicada/divergente entre este fix e a FEAT após o merge | Média | Médio | Quem mergeia em segundo mantém uma única cópia idêntica à Seção 4.4.1; os testes de opt-in falham se a condição divergir. |
| Regressão em `clinic_user`/`clinic_admin` por edição acidental da linha 93 | Baixa | Alto | Linha 93 fora do escopo (Seção 5.5); testes existentes do `describe.each` cobrem. |
| Tokens de consultor emitidos antes do deploy | N/A | — | Regra não depende de claims novas; efeito imediato após o deploy das rules. |
| Descoberta registrada: consultor lê o documento raiz `tenants/{tenantId}` por inteiro | — | Baixo | Fora do escopo; sugerido ao `uc-issues-tracker` avaliar como item próprio (quais campos do raiz o consultor realmente precisa). |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Allowlist | Lista explícita do que é permitido; todo o resto é negado (fail-closed). |
| Blocklist | Lista do que é negado; todo o resto é permitido (fail-open). Estado atual da linha 96. |
| `consultantHasAccess(tenantId)` | Helper de `firestore.rules`: consultor ativo com o tenant em `authorized_tenants`. |
| Semântica OR das rules | Uma operação é permitida se **qualquer** `allow` de **qualquer** `match` aplicável for verdadeiro. |
| `{collectionId}` | Wildcard de um segmento do bloco genérico; vinculável em `get` e `list` (ao contrário de indexar `{document=**}`). |
| Opt-in financeiro | Flag `compartilhar_com_consultor` + `compartilhado_com_consultant_id` no doc `financeiro/custo_hora` (FEAT precificação). |
| Portal do Consultor | Rotas `src/app/(consultant)/consultant/**`. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` (v3.51): `UC-48-RN-06` (Seção 3), `UC-48-RN-06-Decisão` (Seção 4.1), nota v3.51 item 12.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-48-consultar-clinicas-vinculadas-e-estoque.md` — RN-04, RN-05, RN-06, RNF-03.
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-52-consultar-projecao-de-reposicao-de-estoque.md` — RN-08, RN-09, RNF-03.
- `ONLY_FOR_DEVS/TO_DO/FEAT-precificacao-hora-clinica.md` (v1.1, working tree principal) — Seções 4.1, 5.4, 6.3.4, D5.
- `firestore.rules` (l. 32–36, 41–55, 87–159).
- `tests/rules/firestore-tenant-subcollections.test.ts`; `jest.rules.config.js`; `.github/workflows/e2e.yml`.
- `src/components/inventory/InventoryView.tsx`, `src/components/inventory/ProjectionsView.tsx`, `src/lib/services/projectionService.ts`, `src/app/(consultant)/consultant/**`.
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md` — Seções 1, 2.3, 15.
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-qa-agent-playwright-emulator-setup.md` — convenção da Seção STEP 4.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 09/10/2026 | Doc Writer (Claude) | Versão inicial. Status "Aguardando decisão" por causa da D1 (tratamento de `protocolos` frente à FEAT de precificação). |
| 1.1 | 09/10/2026 | Doc Writer (Claude) | D1 resolvida pelo usuário (repassada pelo coordenador) em 09/10/2026: opção (B) — consultor lê `protocolos` só com opt-in financeiro ativo para o próprio `consultant_id`. Seção 4.4 reescrita (4.4.1: regra e helper `consultantHasFinancialOptIn`; 4.4.2: comportamento e testes por ordem de merge). STEP 3 deixa de ser condicional à decisão (sempre executado; vira verificação + testes se a FEAT v1.2 já trouxer a regra). Seções 0, 3, 5, 7, 8, 9 e 10 ajustadas. Status → Planejamento. |
