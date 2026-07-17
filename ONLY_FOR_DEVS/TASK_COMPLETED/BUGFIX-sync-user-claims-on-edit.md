# Bugfix: Sincronizar Custom Claims ao Editar Usuário (Função e Status)

**Projeto:** Curva Mestra
**Data:** 16/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Scandelari
**Data de Conclusão:** 17/07/2026
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/sync-user-claims-on-edit`
**Prioridade:** Alta
**Versão:** 1.1

> No diálogo "Editar Usuário" (`admin/users/page.tsx`), trocar "Função" ou "Status" de um usuário de clínica hoje faz apenas `updateDoc` direto no Firestore — sem nenhum efeito sobre os custom claims do Firebase Auth, que são a fonte de verdade real de acesso (`ProtectedRoute`, regras do Firestore de outras coleções). Diferente do UC-29 (consultores), aqui **não existe nenhuma rota alternativa já implementada** para reaproveitar — é preciso construir `PUT /api/users/[id]` do zero. Decisão do PO já registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 6, `UC-36-RN-02, UC-36-RN-03, UC-36-RN-07`): a nova rota sincroniza claims (`role`, `active`) e desabilita a conta no Firebase Auth quando "Status" vira "Inativo", **empacotado** com uma checagem de "último `clinic_admin` ativo do tenant" que exige confirmação explícita do System Admin antes de rebaixar ou desativar o único admin local de uma clínica.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** sempre `develop`.
**Branch da task:** `bugfix/sync-user-claims-on-edit`

Fluxo obrigatório (ver `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seção 1.3-1.4):
`bugfix/sync-user-claims-on-edit` → PR → branch pessoal do dev (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal → PR → `develop`.

**PR sempre para `develop`, nunca para `master`.**

| Step | Tipo | Escopo | Mensagem de commit planejada | Condição |
|---|---|---|---|---|
| STEP 1 | `fix` | `admin` | `fix(admin): add PUT /api/users/[id] to sync auth claims and disabled status` | Sempre |
| STEP 2 | `fix` | `admin` | `fix(admin): require confirmation before removing a clinic's last active admin` | Sempre |
| STEP 3 | `fix` | `admin` | `fix(admin): migrate user edit dialog to sync claims via api route` | Sempre |
| STEP 4 | — | — | Validação manual, sem commit de código | Sempre |

Ao abrir o PR para `develop`, seguir a Seção 15 do guia (pipeline de agentes de IA): acionar `uml-use-case-writer` para atualizar UC-36 (RN-02, RN-03 e RN-07 deixam de ser achados; novo fluxo de exceção documentando a confirmação de "último admin", RN-09 permanece — sem confirmação dedicada de status fora do formulário) e `uc-issues-tracker` (Modo B) para mover `UC-36-RN-02, UC-36-RN-03, UC-36-RN-07` de "Em Correção" para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A listagem cross-tenant `/admin/users` (`src/app/(admin)/admin/users/page.tsx`) exibe todos os usuários de todas as clínicas (exceto `system_admin` e `clinic_consultant`, filtrados em `loadAllUsers`, linha 118). Ao clicar em "Editar", o diálogo abre pré-preenchido e, ao clicar em "Salvar", `handleSaveUser` (linhas 276-338) executa:

```ts
const updateData: Record<string, any> = {
  displayName: editDisplayName,
  full_name: editDisplayName,
  active: editActive,
  updated_at: new Date(),
};

if (isConsultant) {
  updateData.phone = editPhone;
  updateData.email = editEmail.toLowerCase();
} else {
  updateData.role = editRole;
}

const userRef = doc(db, 'users', editingUser.uid);
await updateDoc(userRef, updateData);
```

Isso é **inteiramente client-side**, via SDK do Firestore — nenhuma chamada `fetch`, nenhuma rota de API, nenhuma chamada a `adminAuth`. Confirmado por busca exaustiva em `src/app/api/users/` (`create`, `[id]/set-password`, `[id]/reset-password`, `activate`, `clear-password-change-flag`): **não existe** nenhuma rota `PUT`/`DELETE` genérica para `users/{id}`.

Como `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx`, linhas 27-58) decide acesso exclusivamente a partir de `claims.role`/`claims.active` (nunca lê o documento Firestore), e as regras do Firestore de outras coleções que dependem de role (ex.: `request.auth.token.role == 'clinic_admin'`) também leem apenas o token, trocar "Função" ou "Status" nesta tela **não tem nenhum efeito prático** sobre o que o usuário-alvo pode fazer ou acessar.

### 1.2 Problema identificado

Este é o item `UC-36-RN-02, UC-36-RN-03, UC-36-RN-07` do mapa de bugs, com decisão de PO já registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 6): construir `PUT /api/users/[id]` (rota nova, não existe hoje) que chame `adminAuth.setCustomUserClaims` (sincroniza "Função") e `adminAuth.updateUser({disabled: true})` (torna "Status: Inativo" real), migrando `admin/users` de `updateDoc` direto para essa rota — **empacotado junto (RN-07)**: antes de rebaixar ou desativar um `clinic_admin`, a rota deve checar se ele é o único `clinic_admin` ativo do tenant; se for, exigir confirmação explícita do System Admin antes de prosseguir (não um bloqueio automático).

**Achado de referência usado nesta spec para não repetir um erro conhecido:** ao investigar `UC-29-RN-02` (ver `BUGFIX-suspend-consultant-reconnect-delete.md`, Seção 1.2-A), foi confirmado que o handler `DELETE /api/consultants/[id]` tinha um bug — espalhava o documento Firestore (`...consultantData`) como se fossem as claims reais do usuário, em vez de buscar via `adminAuth.getUser(user_id).customClaims`. O padrão **correto**, usado em `src/app/api/consultants/claims/route.ts`, `src/app/api/consultants/claims/[id]/approve/route.ts`, `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts` e já também em `src/app/api/users/[id]/set-password/route.ts` (linhas 48-49, deste mesmo projeto), é sempre:

```ts
const userRecord = await adminAuth.getUser(userId);
const currentClaims = userRecord.customClaims || {};
await adminAuth.setCustomUserClaims(userId, { ...currentClaims, <campo alterado> });
```

A rota nova desta spec segue esse padrão desde a primeira versão — não há necessidade de uma correção posterior como aconteceu no UC-29.

### 1.3 Motivação estratégica

Classificado como Crítica em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 2, `UC-36-RN-02`/`UC-36-RN-03`) — diferente do UC-22 (clínicas) e do UC-29 (consultores), aqui **não existe sequer uma rota "correta" alternativa (órfã ou não)** que implemente a mudança real de acesso: é o achado mais severo dos três, porque a correção exige construir a rota do zero, não apenas reconectar um botão a um endpoint já pronto. Um System Admin que "desative" ou "rebaixe" um usuário por esta tela, acreditando estar revogando acesso, hoje não altera nada do que controla o acesso real do usuário ao sistema.

---

## 2. Objetivos

1. Fazer com que trocar "Função" (`clinic_admin`/`clinic_user`) no diálogo "Editar Usuário" sincronize de fato a custom claim `role` do usuário-alvo.
2. Fazer com que definir "Status: Inativo" desabilite de fato a conta no Firebase Auth (`disabled: true`) e zere a claim `active`; e que "Status: Ativo" restaure ambos.
3. Construir a rota `PUT /api/users/[id]` do zero, seguindo o padrão correto de custom claims já usado no restante do projeto (`adminAuth.getUser(...).customClaims` antes de `setCustomUserClaims`, nunca espalhando o documento Firestore).
4. Impedir que um `clinic_admin` seja rebaixado ou desativado sem que o System Admin seja avisado, quando essa ação deixaria a clínica sem nenhum `clinic_admin` ativo — exigindo confirmação explícita antes de prosseguir (não um bloqueio automático).
5. Migrar `handleSaveUser` (`admin/users/page.tsx`) de `updateDoc` direto para a nova rota, para o ramo não-consultor (o único efetivamente alcançável — RN-04).
6. Não alterar o ramo de consultor do mesmo diálogo (código morto, RN-04) nem os fluxos de reset/definição manual de senha (UC-08/UC-37), fora do escopo desta correção.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | `PUT /api/users/[id]` deve existir, autenticado via Bearer token, restrito a `is_system_admin === true` (mesmo padrão de `[id]/set-password` e `[id]/reset-password`). | Sistema (API) | Alta |
| RF-02 | O handler deve rejeitar edição se o usuário-alvo tiver `role === 'system_admin'` ou `role === 'clinic_consultant'` (403) — defesa em profundidade, já que a UI não alcança esses casos (RN-04/RN-05 do UC-36), mas a rota pode ser chamada diretamente. | Sistema (API) | Alta |
| RF-03 | O handler deve buscar as claims **reais e atuais** do usuário via `adminAuth.getUser(userId).customClaims` (nunca espalhar o documento Firestore) antes de chamar `setCustomUserClaims`, sobrepondo apenas `role` e `active`. | Sistema (API) | Alta |
| RF-04 | O handler deve chamar `adminAuth.updateUser(userId, { disabled: !active })` — desabilita a conta quando `active === false`, reabilita quando `active === true`. | Sistema (API) | Alta |
| RF-05 | Antes de aplicar a mudança, se o usuário-alvo tem `role` atual `'clinic_admin'` e a edição resultaria em ele deixar de ser um `clinic_admin` ativo (`role` mudando para `'clinic_user'` **ou** `active` mudando para `false`), o handler deve contar outros usuários do mesmo `tenant_id` com `role === 'clinic_admin'` e `active === true` (excluindo o próprio usuário-alvo). | Sistema (API) | Alta |
| RF-06 | Se essa contagem for zero e o corpo da requisição não incluir `confirmLastAdmin: true`, o handler deve responder `409` com uma mensagem específica e um código (`LAST_ADMIN_CONFIRMATION_REQUIRED`), **sem** aplicar nenhuma alteração. | Sistema (API) | Alta |
| RF-07 | Se `confirmLastAdmin: true` for enviado (ou se houver outro admin ativo), o handler prossegue normalmente com RF-03/RF-04 e a atualização do Firestore. | Sistema (API) | Alta |
| RF-08 | O handler também atualiza `users/{userId}` no Firestore: `displayName`, `full_name`, `role`, `active`, `updated_at` — mesmos campos hoje gravados por `handleSaveUser` para o ramo não-consultor. | Sistema (API) | Alta |
| RF-09 | `handleSaveUser` (`admin/users/page.tsx`), no ramo não-consultor (o único alcançável), deixa de chamar `updateDoc` e passa a chamar `fetch('/api/users/{uid}', { method: 'PUT', ... })` com `Authorization: Bearer <token>`, replicando o padrão já usado em `handleResetPassword`/`handleSetPassword` do mesmo arquivo. | Frontend | Alta |
| RF-10 | Se a resposta for `409` com `code === 'LAST_ADMIN_CONFIRMATION_REQUIRED'`, o frontend exibe `confirm()` nativo com a mensagem retornada pelo servidor; se confirmado, reenvia o mesmo `PUT` com `confirmLastAdmin: true`; se cancelado, aborta sem persistir nenhuma alteração e mantém o diálogo aberto. | Frontend | Alta |
| RF-11 | O ramo de consultor de `handleSaveUser` (código morto, RN-04) permanece inalterado, continuando a usar `updateDoc` — fora do escopo desta correção. | Frontend | N/A (sem mudança) |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | Multi-tenant: `users` é uma coleção global (não sub-coleção de tenant), mas cada documento carrega `tenant_id`. A rota nova opera sempre sobre um único documento por vez (`userId` da URL) e a consulta de contagem do RF-05 é sempre filtrada por `tenant_id` do próprio usuário-alvo — nunca uma consulta cross-tenant sem escopo. | Multi-tenant |
| RNF-02 | A consulta do RF-05 (`users` onde `tenant_id == X` e `role == 'clinic_admin'`) usa apenas filtros de igualdade — não requer novo índice composto em `firestore.indexes.json`, mesmo padrão já usado sem índice dedicado em `src/app/api/users/activate/route.ts` (`access_requests` filtrado por `email` e `status`, duas igualdades). O filtro de `active === true` e a exclusão do próprio `userId` são feitos em memória sobre o resultado (volume esperado por clínica é baixo — `max_users` é 1 ou 5). | Performance |
| RNF-03 | A rota nova (`adminAuth`/`adminDb` via Admin SDK) roda inteiramente no servidor e **não** é filtrada pelas regras do Firestore (`firestore.rules`) — mesmo padrão já usado por `create`, `[id]/set-password` e `[id]/reset-password`. Nenhuma mudança em `firestore.rules` é necessária; a regra existente de `users/{userId}` (`allow write: if isSystemAdmin()`) continua correta para o caso (hoje inexistente) de alguém tentar escrever diretamente via SDK client-side. | Segurança |
| RNF-04 | **Propagação de claims** (mesma limitação já documentada em `BUGFIX-suspend-consultant-reconnect-delete.md`, RNF-03): alterar a claim `active`/`role` via Admin SDK não invalida imediatamente um ID token já emitido e em uso pelo navegador do usuário-alvo — o novo valor só é observado no próximo refresh automático do token (até ~1h, comportamento padrão do Firebase) ou em um novo login, já que `revokeRefreshTokens` não é chamado (consistente com o restante do projeto — ver Seção 4.2). | Segurança / UX |
| RNF-05 | `adminAuth.updateUser(userId, { disabled: true })` bloqueia imediatamente **novos** logins e a emissão de **novos** ID tokens (incluindo o refresh automático) — cobre a maioria dos casos práticos de uso contínuo, mesmo sem revogação explícita (RNF-04). Idêntico ao comportamento documentado para consultores (`BUGFIX-suspend-consultant-reconnect-delete.md`, RNF-04). | Segurança |
| RNF-06 | Nenhuma nova dependência de pacote é necessária — `adminAuth.getUser`, `adminAuth.setCustomUserClaims`, `adminAuth.updateUser` e `FieldValue.serverTimestamp()` já são usados no projeto (`[id]/set-password/route.ts`, `[id]/reset-password/route.ts`). | Simplicidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | A rota `PUT /api/users/[id]` só aceita `role` em `['clinic_admin', 'clinic_user']` — mesma restrição de UI já existente (RN-05 do UC-36: `system_admin` nunca é uma opção do seletor "Função"). | Alinhado ao seletor "Função" do diálogo, que só oferece essas duas opções. |
| RN-02 | A condição de "último admin" (RF-05) só é avaliada quando o usuário-alvo **já é** `clinic_admin` **e** a edição resultaria em perda desse status (mudança de `role` para `clinic_user`, ou `active` para `false`, ou ambas). Uma edição que mantém `role: 'clinic_admin'` e `active: true` (ex.: só mudar o nome) nunca aciona a contagem. | Evita consultas desnecessárias em toda edição — só quando há risco real de a clínica ficar sem admin. |
| RN-03 | A confirmação do "último admin" é resolvida em duas idas ao servidor: a primeira tentativa (sem `confirmLastAdmin`) retorna `409` se a condição se aplicar; o frontend then exibe `confirm()` nativo (mesmo padrão já usado em `handleResetPassword`, UC-08) com a mensagem do servidor, e reenvia com `confirmLastAdmin: true` se confirmado. Nenhuma alteração é persistida na primeira tentativa. | Decisão de design (Seção 4.1) — o frontend desta tela (listagem cross-tenant de usuários individuais) não carrega, hoje, a contagem de admins por clínica; buscar essa informação antecipadamente exigiria uma consulta extra em toda abertura do diálogo, mesmo quando irrelevante (RN-02). Resolver via round-trip com `409` mantém a UX simples (mesmo `confirm()` nativo já usado em todo o projeto) sem esse custo. |
| RN-04 | O `PUT` aplica **as três mudanças em uma única chamada** (claims, `disabled`, Firestore) — não existe um estado intermediário onde só uma delas foi aplicada com sucesso e as outras não (exceto por falha real de rede/Admin SDK entre as chamadas, ver Seção 10). | Mesmo padrão de atomicidade prática (não transacional, mas sequencial e sem chamadas condicionais desnecessárias) já aceito em `[id]/set-password/route.ts`. |
| RN-05 | Usuários com `role === 'system_admin'` ou `role === 'clinic_consultant'` são rejeitados pela rota (RF-02) mesmo que, por algum motivo, sejam enviados diretamente (fora da UI) — a UI nunca oferece o botão "Editar" para eles (RN-05/RN-04 do UC-36), mas a rota não deve confiar apenas nessa barreira client-side. | Defesa em profundidade — mesmo padrão já usado em `[id]/set-password/route.ts` (linha 39, rejeita `role === 'system_admin'`). |
| RN-06 | E-mail e telefone continuam não editáveis por esta rota (RN-06 do UC-36, inalterado) — o `PUT` não aceita nem grava esses campos para usuários não-consultores. | Fora do escopo desta correção; nenhuma mudança de comportamento aqui. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Construir uma única rota `PUT /api/users/[id]` que resolve as três frentes decididas pelo PO (claims, `disabled`, "último admin") em uma única chamada HTTP do frontend, com um mecanismo de confirmação em duas idas ao servidor para o caso de "último admin":

1. **Primeira tentativa:** frontend envia `PUT` sem `confirmLastAdmin`. Se a condição de "último admin" (RF-05) não se aplicar, a rota já conclui a operação normalmente nesta única chamada — a maioria das edições (usuário comum, ou `clinic_admin` com outro admin ativo no tenant) nunca vê o passo 2.
2. **Segunda tentativa (somente quando necessário):** se a condição se aplicar, a rota responde `409` sem persistir nada; o frontend exibe `confirm()` nativo com a mensagem do servidor e, se confirmado, reenvia o mesmo `PUT` com `confirmLastAdmin: true`.

**Por que round-trip via `409` e não checagem prévia no client:** a listagem `/admin/users` é cross-tenant e lista usuários individuais, não contagens por clínica — o frontend não tem, hoje, nenhuma forma barata de saber "este é o único admin ativo do tenant X" sem fazer a mesma consulta que o servidor precisa fazer de qualquer forma. Buscar essa contagem antecipadamente (ex.: ao abrir o diálogo de edição) adicionaria uma consulta Firestore extra em **toda** abertura do diálogo, mesmo quando irrelevante (usuário comum, ou edição que não mexe em `role`/`active`). O padrão `409` + `confirm()` + reenvio mantém a UX consistente com o padrão já estabelecido no projeto (`confirm()` nativo, sem toast dedicado — RNF-03 do UC-36) e evita o custo da consulta antecipada na maioria dos casos.

### 4.2 Alternativas descartadas

- **Pré-carregar a contagem de `clinic_admin` ativos por tenant na listagem/diálogo, decidindo tudo no client antes do primeiro `PUT`.** Descartada: exigiria uma consulta Firestore adicional a cada abertura do diálogo de edição (mesmo quando o usuário não é `clinic_admin`, que é a maioria dos casos na prática), sem ganho real sobre o round-trip via `409` — que só ocorre quando a condição realmente se aplica.
- **Bloqueio automático (impedir a ação sem opção de confirmar).** Descartada — decisão explícita do PO (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 6): "não é um bloqueio automático — o admin pode confirmar que quer mesmo deixar a clínica sem admin local".
- **Chamar `adminAuth.revokeRefreshTokens(userId)` para invalidar sessões já abertas imediatamente.** Descartada nesta versão, mesmo raciocínio do `BUGFIX-suspend-consultant-reconnect-delete.md` (Seção 4.2): nenhum outro fluxo de desativação do projeto usa essa chamada; introduzi-la só aqui criaria uma inconsistência de padrão de segurança entre módulos semelhantes, sem uma decisão de produto dedicada cobrindo o padrão como um todo. Ver RNF-04/RNF-05 e risco correspondente na Seção 10.
- **Duas rotas separadas (`PUT` para dados + `DELETE`/outra para status), espelhando o padrão de `consultants/[id]`.** Descartada — diferente de UC-29, aqui não existe nenhuma rota órfã pré-existente para reaproveitar; a decisão do PO já definiu uma única rota nova (`PUT`) cobrindo os três efeitos (claims, `disabled`, "último admin") em uma chamada.
- **Migrar também o ramo de consultor de `handleSaveUser` para uma rota dedicada nesta mesma task.** Descartada — esse ramo é código morto (RN-04 do UC-36, consultores nunca alcançam este diálogo); misturar sua migração aqui ampliaria o escopo sem necessidade prática, já que ele nunca executa.

### 4.3 Trade-offs aceitos

- Uma edição que rebaixa/desativa o único `clinic_admin` ativo de um tenant sempre custa duas idas ao servidor (a primeira sempre retorna `409` antes da confirmação) — aceito como custo baixo e infrequente, em troca de não precisar pré-carregar contagens de admin em toda abertura do diálogo (Seção 4.1).
- Mesma limitação de propagação de claims já aceita em `BUGFIX-suspend-consultant-reconnect-delete.md` (RNF-04/RNF-05 desta spec): até ~1h de atraso para uma sessão já aberta perceber `active: false`, por não chamar `revokeRefreshTokens` — aceito para manter consistência com o padrão de segurança do restante do projeto.
- O ramo de consultor do diálogo (RN-04) permanece código morto, não removido — aceito por estar fora do escopo desta correção (nenhuma decisão do PO pedindo sua remoção).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

| Arquivo | Descrição |
|---|---|
| `src/app/api/users/[id]/route.ts` | Handler `PUT` — sincroniza claims (`role`, `active`), desabilita/reabilita a conta no Firebase Auth, checa "último admin" (RF-05/RF-06) e atualiza `users/{id}` no Firestore. |

### 5.2 Arquivos a MODIFICAR

| Arquivo | Mudança |
|---|---|
| `src/app/(admin)/admin/users/page.tsx` | `handleSaveUser` (linhas 276-338): ramo não-consultor deixa de usar `updateDoc` e passa a chamar `fetch('/api/users/{uid}', { method: 'PUT' })` com Bearer token, incluindo o fluxo de confirmação em duas etapas (RF-10). Botão "Salvar" (linha 792, `onClick={handleSaveUser}`) precisa virar `onClick={() => handleSaveUser()}` — `handleSaveUser` passa a aceitar um parâmetro opcional (`confirmLastAdmin`), e um `onClick` direto passaria o evento do clique como esse parâmetro por engano. Ramo de consultor (linhas 306-327) permanece inalterado. |

### 5.3 Arquivos a REMOVER

N/A — nenhum arquivo removido.

### 5.4 Impacto no Firestore

- **Nenhuma mudança em `firestore.rules`.** A regra de `users/{userId}` (`allow write: if isSystemAdmin()`) já está correta (UC-36 RN-08) e não é o mecanismo de autorização da nova rota — o Admin SDK, usado server-side, não é filtrado por essas regras (RNF-03), mesmo padrão de `create`, `[id]/set-password` e `[id]/reset-password`.
- **Nenhuma mudança em `firestore.indexes.json`.** A consulta do RF-05 usa apenas dois filtros de igualdade (`tenant_id`, `role`) — não requer índice composto dedicado (RNF-02, mesmo padrão sem índice já usado em `activate/route.ts`).
- **Nenhuma migração de dados.** Usuários já existentes não são alterados retroativamente; a sincronização passa a ocorrer apenas na próxima vez que cada um for editado por esta tela.

### 5.5 O que NÃO muda

- O ramo de consultor de `handleSaveUser` (RN-04 do UC-36) — código morto, continua usando `updateDoc` e a sincronização com `consultants`, exatamente como hoje.
- Os campos e-mail/telefone continuam não editáveis para usuários não-consultores (RN-06 do UC-36).
- `handleResetPassword`/`handleSetPassword` e as rotas `[id]/reset-password`/`[id]/set-password` — inalteradas (UC-08/UC-37, fora do escopo).
- A restrição de que `system_admin` nunca aparece com botão "Editar" (RN-05 do UC-36) — inalterada na UI; reforçada defensivamente no backend (RF-02).
- `loadAllUsers` e o filtro que exclui consultores da listagem (RN-04 do UC-36) — inalterados.
- Nenhuma auditoria nova de "quem editou o quê" é adicionada nesta correção (RNF-02 do UC-36 permanece um achado aberto, fora deste escopo).

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — `User`/`CustomClaims` (`src/types/index.ts`, linhas 14-37) já contêm todos os campos necessários (`role`, `active`). O corpo da requisição `PUT` aceita um campo adicional, **apenas na API, não persistido em nenhum tipo de dado**: `confirmLastAdmin?: boolean`.

### 6.2 Mudanças em serviços / API Routes

**Arquivo (novo):** `src/app/api/users/[id]/route.ts`

```ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem editar usuários' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { displayName, role, active, confirmLastAdmin } = body;

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 });
    }

    if (role !== 'clinic_admin' && role !== 'clinic_user') {
      return NextResponse.json(
        { error: "Função inválida. Deve ser 'clinic_admin' ou 'clinic_user'" },
        { status: 400 }
      );
    }

    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: "Campo 'active' deve ser booleano" }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Defesa em profundidade — a UI nunca oferece "Editar" para estes casos (RN-04/RN-05 do UC-36)
    if (userData?.role === 'system_admin') {
      return NextResponse.json(
        { error: 'Não é permitido editar administradores do sistema' },
        { status: 403 }
      );
    }

    if (userData?.role === 'clinic_consultant') {
      return NextResponse.json(
        { error: 'Consultores devem ser editados em /admin/consultants' },
        { status: 403 }
      );
    }

    const tenantId = userData?.tenant_id;
    const wasActiveClinicAdmin = userData?.role === 'clinic_admin' && userData?.active === true;
    const willLoseAdminStatus = wasActiveClinicAdmin && (role !== 'clinic_admin' || active === false);

    if (willLoseAdminStatus && tenantId) {
      const otherAdminsSnapshot = await adminDb
        .collection('users')
        .where('tenant_id', '==', tenantId)
        .where('role', '==', 'clinic_admin')
        .get();

      const otherActiveAdmins = otherAdminsSnapshot.docs.filter(
        (doc) => doc.id !== userId && doc.data().active === true
      );

      if (otherActiveAdmins.length === 0 && confirmLastAdmin !== true) {
        return NextResponse.json(
          {
            error:
              'Este usuário é o único administrador ativo desta clínica. Se prosseguir, a clínica ficará sem nenhum admin local. Deseja continuar mesmo assim?',
            code: 'LAST_ADMIN_CONFIRMATION_REQUIRED',
          },
          { status: 409 }
        );
      }
    }

    // Padrão correto de custom claims — nunca espalhar o documento Firestore (ver Seção 1.2)
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    await adminAuth.setCustomUserClaims(userId, {
      ...currentClaims,
      role,
      active,
    });

    await adminAuth.updateUser(userId, { disabled: !active });

    await userRef.update({
      displayName,
      full_name: displayName,
      role,
      active,
      updated_at: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Usuário ${userId} atualizado (claims sincronizadas) pelo admin ${decodedToken.uid}`);

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar usuário. Tente novamente.' },
      { status: 500 }
    );
  }
}
```

Nota sobre `wasActiveClinicAdmin`: a condição usa o `active` **atual** do documento (antes da edição), não o `active` enviado no corpo — garante que a checagem de "último admin" só dispara quando o usuário-alvo hoje é, de fato, um admin ativo que está prestes a deixar de ser (RN-02).

### 6.3 Mudanças na UI

**Arquivo:** `src/app/(admin)/admin/users/page.tsx`

**Substituir o corpo de `handleSaveUser` (linhas 276-338):**

```ts
const handleSaveUser = async (confirmLastAdmin = false) => {
  if (!editingUser) return;

  try {
    setUpdating(true);

    const isConsultant = editingUser.role === 'clinic_consultant';

    if (isConsultant) {
      // Ramo morto — consultores nunca alcançam este diálogo (RN-04 do UC-36), mantido sem alteração
      const updateData: Record<string, any> = {
        displayName: editDisplayName,
        full_name: editDisplayName,
        active: editActive,
        phone: editPhone,
        email: editEmail.toLowerCase(),
        updated_at: new Date(),
      };

      await updateDoc(doc(db, 'users', editingUser.uid), updateData);

      try {
        const consultantsRef = collection(db, 'consultants');
        const consultantsSnapshot = await getDocs(query(consultantsRef));

        for (const consultantDoc of consultantsSnapshot.docs) {
          const consultantData = consultantDoc.data();
          if (consultantData.user_id === editingUser.uid) {
            await updateDoc(doc(db, 'consultants', consultantDoc.id), {
              name: editDisplayName,
              email: editEmail.toLowerCase(),
              phone: editPhone,
              updated_at: new Date(),
            });
            break;
          }
        }
      } catch (err) {
        console.error('Erro ao atualizar consultor:', err);
      }
    } else {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Você precisa estar autenticado para realizar esta ação');
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch(`/api/users/${editingUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: editDisplayName,
          role: editRole,
          active: editActive,
          confirmLastAdmin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.code === 'LAST_ADMIN_CONFIRMATION_REQUIRED') {
          setUpdating(false);
          if (confirm(data.error)) {
            await handleSaveUser(true);
          }
          return;
        }
        throw new Error(data.error || 'Erro ao atualizar usuário');
      }
    }

    alert('Usuário atualizado com sucesso!');
    setEditDialogOpen(false);
    loadAllUsers();
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    alert(`Erro ao atualizar usuário: ${error.message}`);
  } finally {
    setUpdating(false);
  }
};
```

**Atualizar o botão "Salvar" (linha 792):**

```tsx
// Antes
<Button onClick={handleSaveUser} disabled={updating}>

// Depois — handleSaveUser agora aceita um parâmetro opcional (confirmLastAdmin);
// um onClick direto passaria o MouseEvent do clique como esse parâmetro por engano
<Button onClick={() => handleSaveUser()} disabled={updating}>
```

Nenhum novo import é necessário — `auth`, `doc`, `updateDoc`, `collection`, `getDocs`, `query`, `db` já estão importados no arquivo (linha 32-33).

### 6.4 Mudanças em API Routes

Cobertas integralmente na Seção 6.2 — rota nova `PUT /api/users/[id]`.

---

## 7. Plano de Implementação

### STEP 1 — Criar `PUT /api/users/[id]`: sincronizar claims e status real

**Objetivo:** Construir a rota do zero, cobrindo RF-01 a RF-04 e RF-08/RN-01/RN-04/RN-05/RN-06 — sem ainda a checagem de "último admin" (STEP 2).

**Arquivos afetados:**
- `src/app/api/users/[id]/route.ts` (novo)

**Ações:**
1. Criar o arquivo com o handler `PUT` completo (Seção 6.2), incluindo autenticação (`is_system_admin`), validação de `displayName`/`role`/`active`, rejeição de `system_admin`/`clinic_consultant` (RF-02), e o bloco de sincronização de claims + `disabled` + atualização do Firestore.
2. Nesta etapa, **omitir temporariamente** o bloco de checagem de "último admin" (`willLoseAdminStatus`/`otherAdminsSnapshot`) — será adicionado no STEP 2, para manter os commits focados.

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Testar isoladamente via `curl`/Postman com um token de `system_admin` de teste (ambiente com emuladores), confirmando que a claim `role`/`active` do usuário-alvo muda de verdade (`adminAuth.getUser(uid).customClaims`) e que `disabled` reflete o `active` enviado.

**Commit:** `fix(admin): add PUT /api/users/[id] to sync auth claims and disabled status`

---

### STEP 2 — Adicionar a checagem de "último admin" (RN-07)

**Objetivo:** Impedir que um `clinic_admin` seja rebaixado/desativado silenciosamente quando é o único admin ativo do tenant, exigindo confirmação explícita.

**Arquivos afetados:**
- `src/app/api/users/[id]/route.ts`

**Ações:**
1. Adicionar o bloco `wasActiveClinicAdmin` / `willLoseAdminStatus` / `otherAdminsSnapshot` (Seção 6.2), posicionado **depois** da validação de `system_admin`/`clinic_consultant` e **antes** da chamada a `adminAuth.getUser`/`setCustomUserClaims`.
2. Garantir que a resposta `409` (`LAST_ADMIN_CONFIRMATION_REQUIRED`) ocorre **antes** de qualquer chamada a `adminAuth`/`adminDb.update` — nenhuma alteração parcial deve ser persistida na primeira tentativa.

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Testar isoladamente (`curl`/Postman): com um tenant de teste tendo exatamente um `clinic_admin` ativo, enviar `PUT` rebaixando-o para `clinic_user` sem `confirmLastAdmin` → esperar `409` com o código correto; reenviar com `confirmLastAdmin: true` → esperar sucesso.

**Commit:** `fix(admin): require confirmation before removing a clinic's last active admin`

---

### STEP 3 — Migrar `handleSaveUser` para a nova rota

**Objetivo:** Fazer o diálogo "Editar Usuário" usar de fato a rota nova para o ramo não-consultor, incluindo o fluxo de confirmação em duas etapas.

**Arquivos afetados:**
- `src/app/(admin)/admin/users/page.tsx`

**Ações:**
1. Substituir `handleSaveUser` pelo código da Seção 6.3 — ramo não-consultor passa a chamar `fetch('/api/users/{uid}', { method: 'PUT' })`; ramo de consultor permanece com `updateDoc`, inalterado.
2. Adicionar o tratamento do `409`/`LAST_ADMIN_CONFIRMATION_REQUIRED`: `confirm()` com a mensagem do servidor e reenvio recursivo com `confirmLastAdmin: true`.
3. Atualizar o `onClick` do botão "Salvar" (linha 792) de `handleSaveUser` para `() => handleSaveUser()` — **obrigatório**, evita que o `MouseEvent` do clique seja passado como `confirmLastAdmin` (verdadeiro por ser um objeto truthy) na primeira chamada.
4. **Não alterar** `loadAllUsers`, `handleEditUser`, `handleResetPassword`, `handleSetPassword`, nem o JSX do diálogo fora do `onClick` do botão "Salvar".

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Validação manual completa no STEP 4.

**Commit:** `fix(admin): migrate user edit dialog to sync claims via api route`

---

### STEP 4 — Validação manual (obrigatória antes de abrir o PR)

**Objetivo:** Confirmar de ponta a ponta que editar "Função"/"Status" produz efeito real sobre Auth/claims, e que a checagem de "último admin" funciona nos dois sentidos (dispara quando deveria, não dispara quando não deveria).

**Pré-requisito:** Firebase Emulator Suite (`firebase emulators:start`) ou ambiente de teste, com pelo menos uma clínica de teste tendo **dois** usuários `clinic_admin` ativos e uma segunda clínica de teste tendo **apenas um** `clinic_admin` ativo (para cobrir os dois cenários do RF-05/RF-06).

**Roteiro:**

1. **Editar a Função de um usuário comum (`clinic_user` → `clinic_admin` ou vice-versa), sem envolver "último admin":**
   - Logar como `system_admin`, ir para `/admin/users`, editar um `clinic_user`, mudar "Função" para "Admin da Clínica", salvar.
   - **Esperado:** `alert('Usuário atualizado com sucesso!')`; `adminAuth.getUser(uid).customClaims.role === 'clinic_admin'`; deslogar e logar novamente como esse usuário (ou aguardar refresh do token) → confirmar que `ProtectedRoute` agora trata esse usuário como `clinic_admin` (acesso a rotas/UI de admin da clínica).

2. **Desativar um usuário comum:**
   - Editar um `clinic_user` ativo, mudar "Status" para "Inativo", salvar.
   - **Esperado:** `adminAuth.getUser(uid).disabled === true`; claim `active === false`; tentativa de login desse usuário falha (`auth/user-disabled` ou equivalente) — mesmo critério de validação usado em `BUGFIX-suspend-consultant-reconnect-delete.md`, STEP 4.

3. **Tentar rebaixar/desativar o único `clinic_admin` ativo de uma clínica de teste:**
   - Na clínica de teste com apenas um `clinic_admin` ativo, editar esse usuário, mudar "Função" para "Usuário da Clínica" (ou "Status" para "Inativo"), salvar.
   - **Esperado:** `confirm()` nativo aparece com a mensagem "Este usuário é o único administrador ativo desta clínica...". Clicar "Cancelar" → **Esperado:** nenhuma mudança persistida (claims, `disabled` e Firestore continuam como antes), diálogo permanece aberto.
   - Repetir a mesma edição e clicar "OK" no `confirm()` → **Esperado:** a edição é aplicada normalmente (claims/`disabled`/Firestore atualizados), `alert('Usuário atualizado com sucesso!')`.

4. **Confirmar que rebaixar/desativar um `clinic_admin` quando HÁ outro admin ativo no mesmo tenant NÃO dispara nenhum aviso:**
   - Na clínica de teste com dois `clinic_admin` ativos, editar um deles (mudar "Função" para "Usuário da Clínica"), salvar.
   - **Esperado:** nenhum `confirm()` de "último admin" aparece; a edição é aplicada diretamente na primeira chamada (`alert('Usuário atualizado com sucesso!')` imediato); o outro `clinic_admin` do tenant permanece inalterado.

5. **Ramo de consultor (regressão):** confirmar que o diálogo, quando aberto para um usuário que — hipoteticamente — tivesse `role === 'clinic_consultant'` (via chamada direta a `handleEditUser`, já que a UI não alcança esse caso — RN-04), continua usando `updateDoc` sem erros de compilação. Não é necessário um cenário real de teste, apenas confirmar que o código morto compila e não foi quebrado.

**Commit:** N/A (validação manual, não gera commit de código).

---

## 8. Estratégia de Testes

| Função / Arquivo | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `PUT` (`api/users/[id]/route.ts`) | Não testar | Handler depende diretamente do Firebase Admin SDK (`adminAuth`, `adminDb`) sem abstração injetável — mock frágil, mesmo padrão já adotado em todo o restante do projeto (ver `BUGFIX-block-legal-document-deletion-with-acceptances.md`, Seção 8, e `BUGFIX-suspend-consultant-reconnect-delete.md`, Seção 8). |
| `handleSaveUser` (`admin/users/page.tsx`) | Não testar | Componente React com dependência direta de `useAuth`/`fetch`/Firebase Auth — fora do escopo de testes automatizados do MVP, mesmo critério do restante do projeto. |

**Conclusão:** Nenhum teste automatizado é necessário para este bugfix. A verificação de correção é feita via validação manual (STEP 4), consistente com o critério do projeto de não testar API routes/componentes React com dependência direta do Firebase SDK no MVP. Como este bugfix constrói uma rota nova que toca diretamente Auth + custom claims + uma regra de negócio de segurança (último admin), a validação manual do STEP 4 é **particularmente crítica** e não deve ser abreviada — em especial os cenários 3 e 4, que cobrem os dois lados do RF-05/RF-06.

---

## 9. Checklist de Definition of Done

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `npm run test` sem erros (nenhum teste novo necessário, mas suíte existente não pode quebrar)
- [ ] Multi-tenant: consulta de "último admin" (RF-05) sempre filtrada por `tenant_id` do usuário-alvo (ver RNF-01)
- [ ] Segurança: `firestore.rules` não precisa de alteração (Admin SDK bypassa regras — ver Seção 5.4); rota nova valida `is_system_admin` no próprio handler (RF-01)
- [ ] STEP 1 (rota `PUT` base — claims + disabled) implementado e validado
- [ ] STEP 2 (checagem de "último admin") implementado e validado
- [ ] STEP 3 (migração de `handleSaveUser`, incluindo `onClick` corrigido) implementado e validado
- [ ] Validação manual do STEP 4 executada e documentada no PR — os 5 cenários, com ênfase nos cenários 3 e 4 (último admin dispara vs. não dispara)
- [ ] Branch pessoal (`gscandelari_setup` ou `lhuan_setup`) validada no domínio Firebase pessoal antes do PR para `develop`
- [ ] PR aberto para `develop` (nunca para `master`)
- [ ] Após merge: `uml-use-case-writer` aciona atualização de UC-36 (RN-02, RN-03 e RN-07 deixam de ser achados; novo fluxo de exceção documentando a confirmação de "último admin"; RN-09 permanece um achado aberto — sem confirmação dedicada de status fora do formulário de edição) e `uc-issues-tracker` (Modo B) move `UC-36-RN-02, UC-36-RN-03, UC-36-RN-07` para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Handler `PUT` novo repete o erro de claims já encontrado no `DELETE` de consultores (espalhar o documento Firestore em vez de `adminAuth.getUser(...).customClaims`) | Baixa (código desta spec já segue o padrão correto desde a primeira versão — Seção 6.2) | Alto | Código de referência da Seção 6.2 já usa `adminAuth.getUser(userId).customClaims` como base do spread — revisor do PR deve confirmar que nenhuma versão implementada se desvia disso. |
| `onClick={handleSaveUser}` não for corrigido para `onClick={() => handleSaveUser()}` no STEP 3 — o `MouseEvent` do clique é passado como `confirmLastAdmin` (truthy), pulando a checagem de "último admin" em toda primeira tentativa | Média (fácil de esquecer, já que o restante do padrão `onClick={handler}` é comum no arquivo) | Alto (uma clínica poderia perder seu único admin sem nenhum aviso) | Citado explicitamente na Seção 6.3, STEP 3 (ação 3) e no roteiro de validação manual (STEP 4, cenário 3) — se o `confirm()` de "último admin" não aparecer no cenário 3, é sinal de que este risco se materializou. |
| Sessão já aberta do usuário desativado/rebaixado continua válida por até ~1h (RNF-04), dando a falsa impressão de que a mudança "não funcionou" durante um teste manual apressado | Média (comportamento esperado, mas pode confundir quem testa) | Baixo | Documentado explicitamente em RNF-04/RNF-05 e no roteiro de validação (STEP 4, cenário 2) — testar com logout+login/token expirado, não apenas observar uma aba já aberta. |
| Consulta de "último admin" (RF-05) rodar mesmo em edições irrelevantes (ex.: só mudar o nome de um `clinic_user`), gerando latência desnecessária | Baixa | Baixo | Condição `willLoseAdminStatus` (RN-02) só é avaliada quando o usuário-alvo já é `clinic_admin` ativo **e** a edição o tiraria desse estado — edições comuns nunca disparam a consulta extra. |
| Falha de rede/Admin SDK entre `setCustomUserClaims` e `updateUser`/`update` (Firestore) deixa um estado parcialmente sincronizado (ex.: claim mudou, mas `disabled` ou o documento Firestore não) | Baixa (mesmo risco teórico aceito em `[id]/set-password/route.ts` e no `DELETE`/`PUT` de consultores) | Médio | Não mitigado nesta versão — consistente com o padrão de atomicidade prática (sequencial, não transacional) já aceito em todo o projeto para chamadas ao Admin SDK; se um `system_admin` observar uma edição inconsistente, deve reabrir o diálogo e salvar novamente (idempotente, sem efeitos colaterais cumulativos). |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Custom claims | Dados customizados (`tenant_id`, `role`, `active`, etc.) embutidos no ID token do Firebase Auth de um usuário, usados por `firestore.rules` e pelo frontend (`ProtectedRoute`) para controle de acesso — distintos do documento Firestore do usuário. |
| `disabled` (Firebase Auth) | Flag no registro do usuário no Firebase Auth; quando `true`, bloqueia novos logins e a emissão de novos ID tokens (incluindo refresh automático), mas não invalida um ID token já emitido e ainda válido, a menos que `revokeRefreshTokens` também seja chamado. |
| Último admin ativo | Situação em que um `clinic_admin` de uma clínica é o único usuário com `role === 'clinic_admin'` e `active === true` naquele `tenant_id` — se rebaixado/desativado sem substituto, a clínica fica sem nenhum admin local. |
| `revokeRefreshTokens` | Método do Admin SDK que invalida imediatamente todos os refresh tokens de um usuário — não usado em nenhum ponto deste projeto até o momento (ver RNF-04). |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-36-editar-usuario-e-alterar-status-cross-tenant.md` — RN-02/RN-03 (achados críticos), RN-07 (último admin), Seção 6 (fluxo principal), Seção 14 (decisão do PO já registrada).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` — Seção 6 (`UC-36-RN-02, UC-36-RN-03, UC-36-RN-07`, decisão do PO já registrada e ação de código pendente).
- `ONLY_FOR_DEVS/TO_DO/BUGFIX-suspend-consultant-reconnect-delete.md` — precedente do mesmo tipo de correção (desabilitar Auth + sincronizar claims) em `consultants`; fonte do padrão correto de claims (Seção 1.2-A) e da linguagem de RNF-03/RNF-04 sobre propagação de claims, replicada aqui como RNF-04/RNF-05.
- `src/app/(admin)/admin/users/page.tsx` — `loadAllUsers`, `handleEditUser`, `handleSaveUser` (linhas 276-338), botão "Salvar" (linha 792).
- `src/app/api/users/create/route.ts`, `src/app/api/users/[id]/set-password/route.ts`, `src/app/api/users/[id]/reset-password/route.ts` — padrão de autenticação (`is_system_admin`)/estrutura de resposta já usado para `users`; `[id]/set-password/route.ts` (linhas 48-49) é a referência mais próxima do padrão correto de claims dentro da própria coleção `users`.
- `src/app/api/consultants/claims/route.ts`, `src/app/api/consultants/claims/[id]/approve/route.ts`, `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts` — precedentes do padrão correto de claims (`adminAuth.getUser(...).customClaims` antes de `setCustomUserClaims`) usados como referência nesta spec.
- `src/app/api/users/activate/route.ts` — precedente de consulta com duas igualdades (`email`, `status`) sem índice composto dedicado, referenciado em RNF-02.
- `firestore.rules` — regra de `users/{userId}` (`allow write: if isSystemAdmin()`), inalterada.
- `src/components/auth/ProtectedRoute.tsx` (linhas 27-58), `src/hooks/useAuth.ts` — fonte de verdade de acesso: custom claims, nunca o documento Firestore.
- `src/types/index.ts` — `User` (linhas 25-37), `CustomClaims` (linhas 14-23), `UserRole` (linha 12).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 16/07/2026 | Doc Writer (Claude) | Versão inicial. Spec gerada a partir do item `UC-36-RN-02, UC-36-RN-03, UC-36-RN-07` do mapa de bugs (decisão do PO já registrada: construir `PUT /api/users/[id]` do zero, empacotando a sincronização de claims/status real com a checagem de "último admin"). Diferente dos bugfixes anteriores desta sequência (UC-43, UC-34, UC-29), aqui não existe rota alternativa pré-existente — a rota é inteiramente nova (Seção 6.2), já nascendo com o padrão correto de custom claims (`adminAuth.getUser(...).customClaims`), evitando repetir o bug encontrado em `DELETE /api/consultants/[id]` (UC-29). O mecanismo de confirmação de "último admin" (RN-07) foi desenhado como round-trip `409` + `confirm()` nativo + reenvio com `confirmLastAdmin: true` (Seção 4.1), decisão justificada pela ausência de dados de contagem de admins na listagem cross-tenant atual — não deixada como decisão em aberto, por ser a abordagem mais simples e consistente com o padrão de `confirm()` já usado no restante do projeto. |
| 1.1 | 17/07/2026 | Guilherme Scandelari | Task concluída — os 3 STEPs de código (rota `PUT /api/users/[id]`, checagem de "último admin", migração de `handleSaveUser`) foram implementados e commitados na branch `bugfix/sync-user-claims-on-edit`. Documento movido para TASK_COMPLETED. |
