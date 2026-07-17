# Bugfix: Reconectar "Suspender Consultor" à Desativação Real (Auth + Claims)

**Projeto:** Curva Mestra
**Data:** 16/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Scandelari
**Data de Conclusão:** 16/07/2026
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/suspend-consultant-reconnect-delete`
**Prioridade:** Alta
**Versão:** 1.2

> Na listagem `admin/consultants`, o botão "Suspender" chama `PUT /api/consultants/[id]` com `{ status: 'suspended' }` — uma alteração puramente cosmética no Firestore, sem qualquer efeito sobre o Firebase Auth ou os custom claims (`UC-29-RN-01`, Crítica). Existe uma rota `DELETE /api/consultants/[id]` que faz a desativação real (desabilita a conta no Auth e zera a claim `active`), mas é código morto (`UC-29-RN-02`). Decisão do PO já registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md`: trocar a chamada do botão "Suspender" de `PUT` para `DELETE`. **Dois achados adicionais confirmados durante esta investigação, que fazem parte do escopo mínimo seguro desta correção:** (1) o handler `DELETE` tem, ele mesmo, um bug nos custom claims — espalha o documento Firestore (`...consultantData`) em vez das claims reais do usuário (`adminAuth.getUser(...).customClaims`), destruindo claims essenciais (`is_consultant`, `role`, `tenant_id`, `consultant_id`) sempre que for chamado; (2) o botão "Reativar" da mesma tela usa o mesmo `PUT` cosmético, que, sem correção adicional, não seria tocado pela mudança do "Suspender". **O PO decidiu (Seção 4.1.1): a Opção A foi escolhida** — o `PUT` de reativação também passa a restaurar o acesso real (Auth + claims), fechando o ciclo suspender/reativar de forma simétrica, sem nenhuma decisão pendente.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** sempre `develop`.
**Branch da task:** `bugfix/suspend-consultant-reconnect-delete`

Fluxo obrigatório (ver `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seção 1.3-1.4):
`bugfix/suspend-consultant-reconnect-delete` → PR → branch pessoal do dev (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal → PR → `develop`.

**PR sempre para `develop`, nunca para `master`.**

| Step | Tipo | Escopo | Mensagem de commit planejada | Condição |
|---|---|---|---|---|
| STEP 1 | `fix` | `admin` | `fix(admin): preserve real auth claims when deactivating consultant` | Sempre |
| STEP 2 | `fix` | `admin` | `fix(admin): route consultant suspension through the real deactivation endpoint` | Sempre |
| STEP 3 | `fix` | `admin` | `fix(admin): restore auth access and claims on consultant reactivation` | Sempre |
| STEP 4 | — | — | Validação manual, sem commit de código | Sempre |

Ao abrir o PR para `develop`, seguir a Seção 15 do guia (pipeline de agentes de IA): acionar `uml-use-case-writer` para atualizar UC-29 (RN-01 e RN-02 deixam de ser achados; RN-03 permanece; novo fluxo documentando `DELETE` como caminho real de suspensão e o `PUT` de reativação restaurando Auth+claims — Opção A, Seção 4.1.1) e `uc-issues-tracker` (Modo B) para mover `UC-29-RN-01, UC-29-RN-02` de "Em Correção" para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A listagem `/admin/consultants` (`src/app/(admin)/admin/consultants/page.tsx`) exibe, na coluna "Ações" de cada linha, um único botão que alterna entre dois ícones conforme o `status` do consultor (linhas 283-301): `Ban` ("Suspender", quando `status === 'active'`) ou `CheckCircle` ("Reativar", quando `status !== 'active'`). Ambos os ícones chamam a **mesma função**, `handleToggleStatus` (linhas 69-104):

```ts
const handleToggleStatus = async (consultant: Consultant) => {
  if (!user) return;

  const newStatus = consultant.status === 'active' ? 'suspended' : 'active';
  const action = newStatus === 'suspended' ? 'suspender' : 'reativar';

  if (!confirm(`Tem certeza que deseja ${action} o consultor "${consultant.name}"?`)) {
    return;
  }

  try {
    const token = await user.getIdToken();

    const response = await fetch(`/api/consultants/${consultant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    // ...
  }
  // ...
};
```

Ou seja: hoje **não existem** duas funções "Suspender" e "Reativar" — existe uma única função que calcula o `status` oposto e sempre chama `PUT /api/consultants/{id}`. O handler `PUT` (`src/app/api/consultants/[id]/route.ts`, linhas 64-144) trata `status` de forma simétrica e simples (linhas 96-100):

```ts
if (status && ['active', 'inactive', 'suspended'].includes(status)) {
  updateData.status = status;
}
// ...
await adminDb.collection('consultants').doc(consultantId).update(updateData);
```

**Confirmado por leitura completa do handler `PUT`:** independentemente do valor de `status` recebido (`'suspended'` ou `'active'`), a única operação realizada é `updateData.status = status` seguida de `.update(updateData)` no Firestore. Nenhuma chamada a `adminAuth` ocorre neste ramo — o único ponto do `PUT` que toca o Firebase Auth é o ramo de alteração de `email` (linhas 117-128), completamente independente do ramo de `status`. Ou seja, tanto "suspender" quanto "reativar", como implementados hoje, são **igualmente cosméticos**.

Existe uma terceira rota, `DELETE /api/consultants/[id]` (mesmo arquivo, linhas 149-204), que implementa a desativação real:

```ts
// Desativar no Firestore
await adminDb.collection('consultants').doc(consultantId).update({
  status: 'inactive',
  updated_at: FieldValue.serverTimestamp(),
});

// Desativar custom claims do usuário
if (consultantData?.user_id) {
  await adminAuth.setCustomUserClaims(consultantData.user_id, {
    ...consultantData,
    active: false,
  });

  // Desativar no Firebase Auth
  await adminAuth.updateUser(consultantData.user_id, { disabled: true });
}
```

**Confirmado por grep exaustivo em `src/app/(admin)/admin/consultants` por `method: 'DELETE'`:** nenhuma tela chama esta rota hoje. É código morto (`UC-29-RN-02`).

### 1.2 Problema identificado

Este é o item `UC-29-RN-01` (Crítica) do mapa de bugs, com decisão de PO já registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 6): *"o botão 'Suspender' (`admin/consultants`) passa a chamar `DELETE /api/consultants/[id]` (já implementada, hoje órfã) em vez de `PUT` com `{status: 'suspended'}` (...). Não foi escolhido reforçar o `PUT` (opção b) para não duplicar lógica de desativação em duas rotas."*

Investigação adicional para esta spec (não coberta pela decisão original do PO) revelou **dois pontos que tornam a mudança literal — "trocar PUT por DELETE só no botão Suspender" — insegura se feita isoladamente**:

**(A) O handler `DELETE` tem, ele mesmo, um bug de custom claims, nunca detectado porque a rota nunca foi exercitada em produção.** Ele espalha o **documento Firestore** (`...consultantData`, retornado por `consultantDoc.data()`) como se fossem as claims atuais do usuário, em vez de buscar as claims reais via `adminAuth.getUser(user_id).customClaims`. Comparando com **todos os outros pontos do código-base que atualizam custom claims de consultor** — `src/app/api/consultants/claims/route.ts` (linhas 129-136), `src/app/api/consultants/claims/[id]/approve/route.ts` (linhas 116-125), `src/app/api/consultants/transfer-requests/[id]/approve/route.ts` (linhas 112-118), `src/app/api/consultants/[id]/set-password/route.ts` (linhas 49-59) — **todos** seguem o padrão `const currentClaims = (await adminAuth.getUser(user_id)).customClaims || {}` seguido de `setCustomUserClaims(user_id, { ...currentClaims, <campo alterado> })`. O `DELETE` é o único que quebra esse padrão. O documento `consultants/{id}` (interface `Consultant`, `src/types/index.ts`, linhas 409-421: `id, user_id, code, name, email, phone, status, authorized_tenants, created_at, updated_at, created_by`) **não contém** os campos que realmente compõem as claims funcionais de um consultor — `tenant_id`, `role`, `is_system_admin`, `is_consultant`, `consultant_id` (setados na criação, `src/app/api/consultants/route.ts`, linhas 260-266). Rodar o `DELETE` hoje sobrescreveria as claims reais do consultor por um objeto **sem** `is_consultant`, `role` nem `consultant_id`, quebrando: `isConsultant()` (`firestore.rules`, linha 28, depende de `request.auth.token.is_consultant == true`), o próprio `GET /api/consultants/[id]` (linha 33, compara `decodedToken.consultant_id === consultantId` para acesso do próprio consultor) e qualquer redirecionamento de `ProtectedRoute` baseado em `role`. Como esta rota nunca foi chamada, esse bug nunca teve efeito observável — mas passa a ter, no momento em que o botão "Suspender" passa a chamá-la de verdade.

**(B) O botão "Reativar", sem correção adicional, não seria tocado por esta mudança — resolvido pela decisão do PO (Opção A, Seção 4.1.1).** Como demonstrado na Seção 1.1, "Suspender" e "Reativar" hoje são a **mesma função** (`handleToggleStatus`), apenas com o `status` alvo invertido. A decisão original do PO (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 6) trocou apenas o caminho de suspensão (`status === 'active'` → chamar `DELETE`) para `PUT`; ela não tratava do caminho de reativação (`status !== 'active'` → continuaria chamando `PUT` com `{status: 'active'}`, que — confirmado na Seção 1.1 — não toca Auth nem claims). Sem tratamento, um consultor suspenso de verdade (Auth `disabled: true`, claim `active: false`) que fosse "reativado" pela tela apenas voltaria a ter `status: 'active'` no Firestore — a conta continuaria desabilitada no Auth e a claim `active` continuaria `false`, aparecendo como "Ativo" na listagem, mas sem conseguir logar. Essa assimetria foi levada ao PO, que decidiu pela Opção A (Seção 4.1.1): o `PUT` de reativação também passa a restaurar Auth+claims, eliminando o risco por completo — faz parte do escopo desta task (RF-05, STEP 3).

### 1.3 Motivação estratégica

Item classificado como **Crítica** em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 2, `UC-29-RN-01`) — um `system_admin` que suspenda um consultor por motivo urgente (comportamento indevido, encerramento de contrato) pode acreditar erroneamente que o acesso foi cortado, quando não foi. A correção do caminho de suspensão é direta e já decidida pelo PO. Os dois achados adicionais desta investigação (claims-bug do `DELETE` e assimetria do "Reativar") não estavam cobertos pela decisão original: o primeiro é um bug objetivo, corrigido como parte normal do escopo (STEP 1); o segundo foi levado ao PO, que decidiu pela Opção A — reforçar também a reativação (STEP 3) — fechando o ciclo suspender/reativar sem nenhuma decisão pendente.

---

## 2. Objetivos

1. Fazer com que "Suspender" um consultor, na listagem `/admin/consultants`, bloqueie de fato o login e o acesso às clínicas vinculadas (desabilitar a conta no Firebase Auth e zerar a claim `active`), usando a rota `DELETE /api/consultants/[id]` já decidida pelo PO.
2. Corrigir o handler `DELETE` para preservar as claims reais do consultor (`tenant_id`, `role`, `is_system_admin`, `is_consultant`, `consultant_id`, `authorized_tenants`), alterando apenas `active: false` — sem esse ajuste, o objetivo 1 introduziria uma regressão nova e mais grave que o bug original.
3. Implementar a restauração real de acesso no botão "Reativar" (decisão do PO — Opção A, Seção 4.1.1): reabilitar a conta no Firebase Auth e restaurar a claim `active`, preservando as demais claims, para que o ciclo suspender/reativar seja simétrico e nenhum consultor fique preso após ser reativado pela UI.
4. Não alterar o fluxo de edição (nome/e-mail/telefone) da tela de detalhe (`admin/consultants/[id]/page.tsx`), que usa `PUT` para um propósito diferente e não é afetado por este bugfix.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | O botão "Suspender" (ícone `Ban`, exibido quando `consultant.status === 'active'`) deve chamar `DELETE /api/consultants/{id}` em vez de `PUT /api/consultants/{id}` com `{status: 'suspended'}`. | System Admin | Alta |
| RF-02 | O handler `DELETE /api/consultants/[id]` deve buscar as claims **reais e atuais** do usuário via `adminAuth.getUser(user_id).customClaims` antes de chamar `setCustomUserClaims`, e sobrepor apenas `active: false` — nunca espalhar `consultantData` (documento Firestore) nas claims. | Sistema (API) | Alta |
| RF-03 | Após suspender com sucesso, a listagem deve recarregar e exibir o consultor com `status: 'inactive'` (valor gravado pelo `DELETE`, ver RN-03) e o botão "Reativar" no lugar de "Suspender". | System Admin | Alta |
| RF-04 | O diálogo de confirmação do "Suspender" deve deixar claro que a ação bloqueia o acesso imediatamente (texto atualizado — ver Seção 6.3), diferenciando-o do comportamento anterior (cosmético). | System Admin | Média |
| RF-05 | O botão "Reativar" deve, além de gravar `status: 'active'` no Firestore, restaurar o acesso real do consultor — reabilitar a conta no Firebase Auth (`disabled: false`) e restaurar a claim `active: true`, preservando as demais claims (`role`, `is_consultant`, `tenant_id`, `consultant_id`, `authorized_tenants`). | System Admin | Alta |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | Multi-tenant: N/A direto — `consultants` é uma coleção global (não escopada por `tenant_id`), gerida exclusivamente por `system_admin` (`firestore.rules`, regra dedicada a `consultants/{consultantId}`, restrita a `isSystemAdmin()` — UC-29 RN-06). O campo `authorized_tenants` dentro do documento do consultor referencia múltiplos tenants, mas não é alterado por este bugfix. | Multi-tenant |
| RNF-02 | Nenhuma nova dependência de pacote é necessária — `adminAuth.getUser`, `adminAuth.setCustomUserClaims` e `adminAuth.updateUser` já são usados no arquivo/projeto. | Simplicidade |
| RNF-03 | Propagação de claims: alterar a claim `active` no Admin SDK não invalida imediatamente um ID token já emitido e em uso pelo navegador do consultor — o novo valor só é observado pelo cliente no próximo refresh automático do token (até ~1h, comportamento padrão do Firebase, sem chamada a `revokeRefreshTokens` em nenhum ponto do projeto) ou em um novo login. Isso é uma limitação conhecida e documentada (Seção 10), não corrigida nesta task — nenhum outro fluxo de desativação do projeto (`UC-22`, e o `PUT /api/users/[id]` planejado em `UC-36`) chama `revokeRefreshTokens`, então introduzir isso aqui quebraria a consistência do padrão adotado no restante do sistema sem uma decisão de produto dedicada. | Segurança / UX |
| RNF-04 | `adminAuth.updateUser(user_id, { disabled: true })` bloqueia imediatamente **novos** logins e a emissão de **novos** ID tokens (incluindo o refresh automático) — o cliente Firebase SDK recebe `auth/user-disabled` no próximo refresh e força o logout local. Isso cobre a maioria dos casos práticos de uso contínuo (sessões de app costumam renovar o token com frequência), mesmo sem revogação explícita (RNF-03). | Segurança |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | Suspender um consultor passa a executar, em uma única chamada, as três ações que hoje só existem (sem uso) no handler `DELETE`: gravar `status: 'inactive'` no Firestore, zerar `active` nas claims (preservando as demais) e desabilitar a conta no Firebase Auth. | Decisão do PO registrada em `_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 6 (`UC-29-RN-01, UC-29-RN-02`). |
| RN-02 | O handler `DELETE` deve buscar as claims atuais via `adminAuth.getUser(user_id).customClaims` (não via `consultantData`) antes de as sobrescrever — mesmo padrão já usado em `claims/route.ts`, `claims/[id]/approve/route.ts`, `transfer-requests/[id]/approve/route.ts` e `set-password/route.ts`. | Achado desta investigação (Seção 1.2-A): sem essa correção, a mudança pedida pelo PO (RN-01) corromperia as claims funcionais do consultor (`is_consultant`, `role`, `consultant_id`) na primeira vez que "Suspender" fosse clicado, quebrando o acesso do consultor de formas não relacionadas à suspensão em si (ex.: `GET /api/consultants/[id]` para o próprio consultor, `isConsultant()` no `firestore.rules`). |
| RN-03 | O `status` gravado por uma suspensão real passa a ser `'inactive'` (valor hardcoded no handler `DELETE`, linha 178), não mais `'suspended'`. A badge da listagem muda de "Suspenso" (`destructive`) para "Inativo" (`secondary`) — `getStatusBadge` já trata os dois casos, nenhuma mudança de código necessária nesse ponto. O texto do botão/diálogo continua "Suspender"/"suspenso" (linguagem voltada à ação do admin), mesmo que o valor interno seja `'inactive'` — pequena divergência de nomenclatura aceita (ver Seção 4.3), consistente com o próprio nome do handler (`DELETE — Desativar consultor`). | Consequência direta de reutilizar o handler `DELETE` já existente (decisão do PO), sem alterá-lo para gravar `'suspended'` — ver alternativas descartadas na Seção 4.2 sobre por que não alterar esse valor. |
| RN-04 | Consultores que já estejam com `status: 'suspended'` **antes** desta correção (gravado pelo `PUT` cosmético) não são migrados automaticamente — eles continuam com a conta Auth habilitada e a claim `active: true` até que um `system_admin` clique novamente em "Suspender" (agora via `DELETE`) ou "Reativar" para esse consultor. | Nenhuma migração de dados foi pedida pelo PO; o volume esperado de consultores nesse estado é baixo (sistema pré-MVP) — ver recomendação operacional na Seção 10. |
| RN-05 | O fluxo de edição (`handleSave`, `admin/consultants/[id]/page.tsx`, `PUT` com `{name, email, phone}`) não é afetado — continua exatamente como está, incluindo o achado já documentado em UC-29 RN-05 (formulário sempre reenvia o e-mail). | Fora do escopo deste bugfix — `PUT` continua existindo e sendo usado para edição; apenas o **caminho de suspensão** na listagem deixa de usá-lo. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Dividir a função única `handleToggleStatus` (`admin/consultants/page.tsx`) em duas funções distintas, já que agora elas chamam rotas HTTP diferentes:

- `handleSuspend(consultant)` — chamada quando `status === 'active'` (botão `Ban`/"Suspender"): `DELETE /api/consultants/{id}`, sem corpo.
- `handleReactivate(consultant)` — chamada quando `status !== 'active'` (botão `CheckCircle`/"Reativar"): `PUT /api/consultants/{id}` com `{status: 'active'}`, agora também restaurando o acesso real (Opção A, Seção 4.1.1).

No backend, o handler `DELETE` é corrigido para buscar `adminAuth.getUser(user_id).customClaims` antes de sobrescrever, alinhando-o ao padrão já usado em todo o resto do projeto (Seção 1.2-A). O handler `PUT` também é alterado (RF-05, Seção 6.2), ganhando o ramo que restaura Auth+claims na reativação.

#### 4.1.1 Reativação restaura acesso real (Opção A)

**Decisão do PO registrada em 16/07/2026:** entre as duas opções levantadas por esta investigação para o comportamento do botão "Reativar" após "Suspender" passar a bloquear acesso de verdade (Seção 1.2-B), o PO escolheu a **Opção A** — reforçar também o `PUT` de reativação. A decisão faz parte do escopo normal desta task (RF-05, STEP 3), sem nenhuma condicionalidade remanescente.

**Raciocínio técnico (mantido como histórico da decisão):** confirmado por leitura integral dos handlers `PUT` e `DELETE` (Seção 1.1) que, antes desta correção, "Suspender" e "Reativar" eram a mesma função `handleToggleStatus`, ambas chamando `PUT` — nenhuma das duas tocava Auth/claims. A decisão original do PO (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 6) cobria apenas o caminho de suspensão. Sem o tratamento da Opção A, depois de "Suspender" passar a desabilitar de verdade a conta no Auth e zerar a claim `active`, "Reativar" continuar chamando apenas `PUT` (sem alteração) não desfaria o que "Suspender" passou a fazer: o consultor voltaria a `status: 'active'` no Firestore, mas a conta Auth continuaria `disabled: true` e a claim `active` continuaria `false` — ele apareceria "Ativo" na listagem, mas continuaria impedido de logar. Diferente do bug original (suspender não bloqueava nada — inofensivo), essa lacuna prenderia um consultor legítimo fora do sistema, com a listagem afirmando o contrário, exigindo intervenção manual fora da UI (edição direta de Auth/claims) para desfazer.

**Implementação decidida:** o `PUT` passa a, quando `status` muda para `'active'`, também chamar `adminAuth.updateUser(user_id, { disabled: false })` e restaurar a claim `active: true` (preservando as demais claims via `adminAuth.getUser(user_id).customClaims`, mesmo padrão do RF-02). Fecha o ciclo suspender/reativar de forma simétrica e segura, sem deixar nenhum consultor preso. Código detalhado na Seção 6.2 (RF-05).

### 4.2 Alternativas descartadas

- **Reforçar o `PUT` para também desabilitar Auth/claims quando `status` muda para `'suspended'`, em vez de usar o `DELETE` já existente** — descartada pelo próprio PO antes desta spec (`_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 6): duplicaria lógica de desativação em duas rotas (`PUT` e `DELETE`).
- **Alterar o handler `DELETE` para gravar `status: 'suspended'` em vez de `'inactive'`, preservando a nomenclatura exibida na badge** — descartada. Mudar esse valor tocaria um handler que, apesar de nunca ter sido chamado, já está implementado e testável isoladamente; o objetivo desta task é reconectar a UI a ele, não redesenhá-lo. O valor `'inactive'` já é tratado corretamente por `getStatusBadge` (badge "Inativo") e é semanticamente mais preciso agora que a conta é de fato desabilitada — ver RN-03 e trade-off aceito na Seção 4.3.
- **Migrar automaticamente (script/Cloud Function) todos os consultores com `status: 'suspended'` pré-existentes para o novo fluxo real no deploy** — descartada por falta de escopo pedido pelo PO e por não haver, até o momento, nenhuma indicação de volume relevante de registros nesse estado (sistema pré-MVP). Ver recomendação operacional (não automatizada) na Seção 10.
- **Chamar `adminAuth.revokeRefreshTokens(user_id)` no `DELETE`, para invalidar sessões já abertas do consultor imediatamente** — descartada nesta versão. Nenhum outro fluxo de desativação do projeto (nem o mecanismo de suspensão de clínica do UC-22, nem o `PUT /api/users/[id]` planejado para UC-36) usa essa chamada; introduzi-la apenas aqui criaria uma inconsistência de padrão de segurança entre módulos semelhantes, sem uma decisão de produto explícita cobrindo o padrão como um todo. Ver limitação documentada em RNF-03/RNF-04 e risco correspondente na Seção 10.
- **Opção B — Manter o escopo restrito a "Suspender" nesta task:** cogitada durante a investigação como alternativa à Opção A — nenhuma mudança no fluxo de reativação agora, com um item novo aberto em `_MAPA-DE-BUGS-E-MELHORIAS.md` documentando a pendência para uma entrega futura. **Descartada pelo PO em 16/07/2026** em favor da Opção A: o risco que a Opção B deixaria em aberto (entre o merge deste bugfix e a implementação futura do tratamento de "Reativar", qualquer `system_admin` que suspendesse um consultor pelo novo caminho real criaria um consultor que só poderia ser desbloqueado manualmente, fora da UI) foi considerado desnecessário diante do baixo custo de implementar a Opção A imediatamente (mesmo padrão de correção já aplicado ao `DELETE` no RF-02, aplicado agora ao `PUT`).

### 4.3 Trade-offs aceitos

- Badge muda de "Suspenso" para "Inativo" para novas suspensões (RN-03) — aceito porque é mais preciso tecnicamente (a conta está de fato desabilitada) e não exige alterar o handler `DELETE` já pronto.
- Consultores já suspensos (cosmeticamente) antes desta correção não são migrados automaticamente (RN-04) — aceito como decisão operacional de baixo risco dado o volume esperado, com recomendação de auditoria manual pós-deploy (Seção 10).
- Até ~1h de atraso na propagação da claim `active: false` para uma sessão já aberta do consultor, por não chamar `revokeRefreshTokens` (RNF-03) — aceito para manter consistência com o padrão de segurança já usado no restante do projeto; `disabled: true` já bloqueia novos logins e a maioria dos refreshes de token na prática (RNF-04).

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

N/A — nenhum arquivo novo.

### 5.2 Arquivos a MODIFICAR

| Arquivo | Mudança |
|---|---|
| `src/app/api/consultants/[id]/route.ts` | Handler `DELETE` (linhas 149-204): substituir o spread de `consultantData` por `adminAuth.getUser(user_id).customClaims` antes de `setCustomUserClaims` (RF-02/RN-02). Handler `PUT` (linhas 64-144) ganha um ramo que, quando `status` muda para `'active'` vindo de um estado diferente, também chama `adminAuth.updateUser(user_id, {disabled: false})` e restaura `active: true` nas claims (RF-05). |
| `src/app/(admin)/admin/consultants/page.tsx` | `handleToggleStatus` (linhas 69-104) dividida em `handleSuspend` (chama `DELETE`) e `handleReactivate` (chama `PUT`, agora restaurando acesso real — RF-01/RF-03/RF-04/RF-05). Botões (linhas 283-301) atualizados para chamar a função correta conforme o `status` atual. Texto do `confirm()` de suspensão atualizado (RF-04). |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

- **Nenhuma mudança em `firestore.rules`.** A regra de `consultants/{consultantId}` já restringe escrita a `isSystemAdmin()` (UC-29 RN-06) — cobre tanto o `PUT` quanto o `DELETE`, sem alteração necessária.
- **Nenhuma mudança em `firestore.indexes.json`** — nenhuma consulta nova é introduzida; `DELETE` e `PUT` continuam operando sobre um único documento por `id`.
- **Nenhuma migração de dados automatizada** nesta task (ver RN-04 e Seção 10 para a recomendação operacional manual).

### 5.5 O que NÃO muda

- O handler `GET /api/consultants/[id]` — sem alteração.
- O fluxo de edição de nome/e-mail/telefone (`handleSave`, `admin/consultants/[id]/page.tsx`, e o ramo correspondente do `PUT`) — sem alteração, incluindo o achado já conhecido de UC-29 RN-05 (reenvio desnecessário do e-mail).
- `GET /api/consultants/search` (filtro `status === 'active'`, usado em UC-23/UC-24) — sem alteração; um consultor com `status: 'inactive'` (novo valor gravado pelo `DELETE`) já era excluído dessa busca antes desta correção (o filtro nunca aceitou `'suspended'` como ativo, e `'inactive'` também não é `'active'`), então o comportamento de busca não muda.
- O array de validação `['active', 'inactive', 'suspended']` no `PUT` (linha 98) — continua aceitando `'suspended'` como valor tecnicamente válido, mesmo que o frontend deixe de enviá-lo; não é removido por não ter nenhum efeito negativo em mantê-lo (branch morto inofensivo, fora do escopo desta correção).
- A tela de detalhe do consultor (`admin/consultants/[id]/page.tsx`) não ganha nenhum botão de suspender/reativar — essa ação continua existindo apenas na listagem, como hoje.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — `ConsultantStatus` (`src/types/index.ts`, linha 407: `'active' | 'inactive' | 'suspended'`) já contém todos os valores necessários; nenhuma mudança de tipo.

### 6.2 Mudanças em serviços / API Routes

**Arquivo:** `src/app/api/consultants/[id]/route.ts`

**RF-02 (sempre aplicado) — handler `DELETE`, correção do bug de claims:**

```ts
// Antes
if (consultantData?.user_id) {
  await adminAuth.setCustomUserClaims(consultantData.user_id, {
    ...consultantData,
    active: false,
  });

  await adminAuth.updateUser(consultantData.user_id, { disabled: true });
}

// Depois
if (consultantData?.user_id) {
  const userRecord = await adminAuth.getUser(consultantData.user_id);
  const currentClaims = userRecord.customClaims || {};

  await adminAuth.setCustomUserClaims(consultantData.user_id, {
    ...currentClaims,
    active: false,
  });

  await adminAuth.updateUser(consultantData.user_id, { disabled: true });
}
```

**RF-05 (sempre aplicado) — handler `PUT`, ramo de reativação real:**

```ts
// Dentro de PUT, após a checagem de e-mail existente, antes de update(updateData):

if (status === 'active' && consultantDoc.data()?.status !== 'active') {
  const consultantData = consultantDoc.data();
  if (consultantData?.user_id) {
    const userRecord = await adminAuth.getUser(consultantData.user_id);
    const currentClaims = userRecord.customClaims || {};

    await adminAuth.setCustomUserClaims(consultantData.user_id, {
      ...currentClaims,
      active: true,
    });

    await adminAuth.updateUser(consultantData.user_id, { disabled: false });
  }
}

await adminDb.collection('consultants').doc(consultantId).update(updateData);
```

A condição `consultantDoc.data()?.status !== 'active'` evita chamadas desnecessárias ao Auth quando o `PUT` for usado para outros fins (ex.: edição de nome/e-mail de um consultor já ativo, que também passa por este handler mas não envia `status`, ou envia `status: 'active'` para um consultor que já estava ativo).

### 6.3 Mudanças na UI

**Arquivo:** `src/app/(admin)/admin/consultants/page.tsx`

**Substituir `handleToggleStatus` (linhas 69-104) por duas funções:**

```ts
const handleSuspend = async (consultant: Consultant) => {
  if (!user) return;

  if (
    !confirm(
      `Tem certeza que deseja suspender o consultor "${consultant.name}"? O acesso dele ao sistema será bloqueado imediatamente.`
    )
  ) {
    return;
  }

  try {
    const token = await user.getIdToken();

    const response = await fetch(`/api/consultants/${consultant.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao suspender consultor');
    }

    toast({ title: 'Consultor suspenso com sucesso' });
    loadConsultants();
  } catch (err: any) {
    toast({ title: err.message, variant: 'destructive' });
  }
};

const handleReactivate = async (consultant: Consultant) => {
  if (!user) return;

  if (!confirm(`Tem certeza que deseja reativar o consultor "${consultant.name}"?`)) {
    return;
  }

  try {
    const token = await user.getIdToken();

    const response = await fetch(`/api/consultants/${consultant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'active' }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao reativar consultor');
    }

    toast({ title: 'Consultor reativado com sucesso' });
    loadConsultants();
  } catch (err: any) {
    toast({ title: err.message, variant: 'destructive' });
  }
};
```

**Atualizar os botões (linhas 283-301):**

```tsx
{consultant.status === 'active' ? (
  <Button variant="ghost" size="sm" onClick={() => handleSuspend(consultant)} title="Suspender">
    <Ban className="h-4 w-4 text-destructive" />
  </Button>
) : (
  <Button variant="ghost" size="sm" onClick={() => handleReactivate(consultant)} title="Reativar">
    <CheckCircle className="h-4 w-4 text-green-600" />
  </Button>
)}
```

Nenhum novo import é necessário — `Ban`, `CheckCircle`, `useToast`, `Consultant` já estão importados no arquivo.

### 6.4 Mudanças em API Routes

Cobertas na Seção 6.2 (`DELETE` e `PUT` de `src/app/api/consultants/[id]/route.ts`). Nenhuma rota nova é criada.

---

## 7. Plano de Implementação

### STEP 1 — Corrigir o bug de claims do handler `DELETE`

**Objetivo:** Garantir que `DELETE /api/consultants/[id]` preserve as claims funcionais reais do consultor ao desativá-lo, antes de a rota passar a ser chamada de verdade pela UI.

**Arquivos afetados:**
- `src/app/api/consultants/[id]/route.ts`

**Ações:**
1. No handler `DELETE`, substituir `...consultantData` por `adminAuth.getUser(consultantData.user_id).customClaims` (com fallback `|| {}`) como base do spread passado a `setCustomUserClaims` (ver código completo na Seção 6.2).
2. Não alterar a ordem das operações (Firestore → claims → `disabled: true`) nem o valor `status: 'inactive'` gravado no Firestore.

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.

**Commit:** `fix(admin): preserve real auth claims when deactivating consultant`

---

### STEP 2 — Reconectar "Suspender" ao `DELETE` na listagem

**Objetivo:** Fazer o botão "Suspender" bloquear de fato o acesso do consultor, usando a rota corrigida no STEP 1.

**Arquivos afetados:**
- `src/app/(admin)/admin/consultants/page.tsx`

**Ações:**
1. Substituir `handleToggleStatus` por `handleSuspend` (chama `DELETE`, sem corpo) e `handleReactivate` (chama `PUT` com `{status: 'active'}`, inalterado nesta etapa) — código completo na Seção 6.3.
2. Atualizar o `onClick` dos dois botões (linhas 283-301) para chamar a função correspondente.
3. Atualizar o texto do `confirm()` de suspensão para deixar claro o bloqueio imediato de acesso (RF-04).
4. **Não alterar** `getStatusBadge`, o filtro de busca (`searchTerm`), nem qualquer outra função do arquivo.

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Validação manual (STEP 4) confirma o bloqueio real de acesso.

**Commit:** `fix(admin): route consultant suspension through the real deactivation endpoint`

---

### STEP 3 — Restaurar acesso real na reativação

**Objetivo:** Fechar o ciclo suspender/reativar de forma simétrica, evitando que um consultor suspenso via `DELETE` fique preso mesmo após "Reativar" (decisão do PO — Opção A, Seção 4.1.1).

**Arquivos afetados:**
- `src/app/api/consultants/[id]/route.ts`

**Ações:**
1. No handler `PUT`, adicionar o ramo condicional que restaura `disabled: false` e `active: true` (com claims atuais preservadas) quando `status` muda para `'active'` vindo de um valor diferente — código completo na Seção 6.2 (RF-05).
2. Garantir que o ramo só executa quando o `status` do documento **antes** da atualização era diferente de `'active'` (evita chamadas desnecessárias ao Auth em edições normais de um consultor já ativo).

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Validação manual (STEP 4, cenário de reativação) confirma a restauração real de acesso.

**Commit:** `fix(admin): restore auth access and claims on consultant reactivation`

---

### STEP 4 — Validação manual (obrigatória antes de abrir o PR)

**Objetivo:** Confirmar de ponta a ponta que suspender bloqueia o acesso de verdade e que reativar (Opção A, Seção 4.1.1) restaura esse acesso.

**Pré-requisito:** Firebase Emulator Suite (`firebase emulators:start`) ou ambiente de teste com um consultor de teste já cadastrado (via UC-28) e vinculado a pelo menos uma clínica de teste (via UC-23/UC-24), para poder observar o efeito também no acesso a dados de clínica, não só no login.

**Roteiro — Suspensão (sempre executar):**
1. Logar como `system_admin`, ir para `/admin/consultants`, localizar o consultor de teste (`status: 'active'`).
2. Clicar em "Suspender" → confirmar no diálogo (texto deve mencionar bloqueio imediato — RF-04).
3. **Esperado (UI):** toast "Consultor suspenso com sucesso"; badge muda para "Inativo" (não mais "Suspenso" — RN-03); botão muda para "Reativar".
4. **Esperado (Firestore):** `consultants/{id}.status === 'inactive'`.
5. **Esperado (Firebase Auth):** no Firebase Emulator UI (ou console, em ambiente real) → Authentication → localizar o usuário pelo `user_id` do consultor → confirmar `disabled: true`.
6. **Esperado (Custom Claims):** via Admin SDK (`adminAuth.getUser(user_id).customClaims`, ou inspecionando o ID token decodificado após um novo login tentado) → confirmar `active: false` **e** que `is_consultant`, `role`, `consultant_id`, `tenant_id`, `authorized_tenants` continuam presentes e com os valores anteriores (confirma o STEP 1 — sem esse passo, um bug de claims corrompidas passaria despercebido).
7. **Esperado (bloqueio real de login):** com o usuário de teste do consultor **deslogado**, tentar logar novamente com as mesmas credenciais em `/login`. **Esperado:** falha de login (`auth/user-disabled` ou equivalente), consultor não consegue entrar no sistema. Se um teste de login novo não for viável no ambiente disponível, ao menos confirmar o passo 5 (Console/Emulator) como evidência suficiente do bloqueio (RNF-04 documenta que isso já é suficiente para impedir novos logins e a maioria dos refreshes de sessão).

**Roteiro — Reativação (reativação restaura acesso real, STEP 3 sempre implementado):**

1. No mesmo consultor (agora "Inativo"), clicar em "Reativar" → confirmar.
2. **Esperado (UI):** toast "Consultor reativado com sucesso"; badge volta para "Ativo"; botão volta para "Suspender".
3. **Esperado (Firestore):** `consultants/{id}.status === 'active'`.
4. **Esperado (Firebase Auth):** `disabled: false` novamente.
5. **Esperado (Custom Claims):** `active: true`, demais claims preservadas.
6. **Esperado (login real):** o mesmo usuário de teste, com as mesmas credenciais, consegue logar novamente em `/login` e acessar a(s) clínica(s) vinculada(s) normalmente.

**Commit:** N/A (validação manual, não gera commit de código).

---

## 8. Estratégia de Testes

| Função / Arquivo | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `DELETE`/`PUT` (`api/consultants/[id]/route.ts`) | Não testar | Handlers dependem diretamente do Firebase Admin SDK (`adminAuth`, `adminDb`) sem abstração injetável — mock frágil, mesmo padrão já adotado em todo o restante do projeto (ver `BUGFIX-block-legal-document-deletion-with-acceptances.md`, Seção 8). |
| `handleSuspend`/`handleReactivate` (`admin/consultants/page.tsx`) | Não testar | Componente React com dependência direta de `useAuth`/`fetch`/Firebase Auth — fora do escopo de testes automatizados do MVP, mesmo critério do restante do projeto. |

**Conclusão:** Nenhum teste automatizado é necessário para este bugfix. A verificação de correção é feita via validação manual (STEP 4), consistente com o critério do projeto de não testar API routes/componentes React com dependência direta do Firebase SDK no MVP. Dado que este bugfix toca diretamente Auth + custom claims (superfície de segurança), a validação manual do STEP 4 é **particularmente crítica** e não deve ser abreviada.

---

## 9. Checklist de Definition of Done

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `npm run test` sem erros (nenhum teste novo necessário, mas suíte existente não pode quebrar)
- [ ] Multi-tenant: N/A — `consultants` é coleção global restrita a `system_admin` (ver RNF-01)
- [ ] Segurança: `firestore.rules` já cobre `PUT`/`DELETE` via `isSystemAdmin()` — nenhuma alteração necessária (ver Seção 5.4)
- [ ] STEP 1 (correção do bug de claims do `DELETE`) implementado e validado
- [ ] STEP 2 (Suspender → `DELETE`) implementado e validado
- [ ] STEP 3 (restaurar acesso real na reativação — Opção A, Seção 4.1.1) implementado e validado
- [ ] Validação manual do STEP 4 executada e documentada no PR — incluindo a confirmação de `disabled`/claims no Firebase Auth/Admin SDK, não apenas o comportamento visual da UI
- [ ] Branch pessoal (`gscandelari_setup` ou `lhuan_setup`) validada no domínio Firebase pessoal antes do PR para `develop`
- [ ] PR aberto para `develop` (nunca para `master`)
- [ ] Após merge: `uml-use-case-writer` aciona atualização de UC-29 (RN-01/RN-02 deixam de ser achados; documentar o `PUT` de reativação restaurando Auth+claims — Opção A, Seção 4.1.1) e `uc-issues-tracker` (Modo B) move `UC-29-RN-01, UC-29-RN-02` para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| STEP 3 ser pulado por engano durante a implementação, mesmo com a decisão do PO (Opção A, Seção 4.1.1) já tomada — mergear apenas STEP 1-2 recria, na prática, o mesmo risco que a Opção A foi escolhida para eliminar: consultores "presos" em produção, reativados na UI, mas sem acesso real | Baixa (STEP 3 é item obrigatório e não condicional no checklist da Seção 9) | Alto | Checklist da Seção 9 lista STEP 3 como item obrigatório do DoD, não mais condicional — nenhum PR deve ser aprovado sem a evidência de validação do STEP 3 (roteiro de reativação, STEP 4). Revisor do PR deve rejeitar qualquer versão que só implemente STEP 1-2. |
| Bug de claims do `DELETE` (Seção 1.2-A) não for corrigido junto (STEP 1 pulado por engano) — primeira suspensão real corrompe claims funcionais do consultor | Baixa (fluxo documentado explicitamente como STEP 1, não opcional) | Alto | STEP 1 é o primeiro passo do plano, não condicional a nenhuma decisão — deve sempre ser implementado junto com STEP 2. Validação manual (STEP 4, passo 6) checa explicitamente a preservação de `is_consultant`/`role`/`consultant_id`, não apenas `active`. |
| Sessão já aberta do consultor suspenso continua válida por até ~1h (RNF-03), dando a falsa impressão de que a suspensão "não funcionou" durante um teste manual apressado | Média (é o comportamento esperado, mas pode confundir quem testa) | Baixo | Documentado explicitamente em RNF-03/RNF-04 e no roteiro de validação (STEP 4, passo 7): testar com logout+login, não apenas observar uma aba já aberta. Se o revisor quiser bloqueio imediato de sessões já abertas, isso é uma mudança de escopo maior (RNF-03, alternativa descartada) — não incluída nesta versão. |
| Consultores com `status: 'suspended'` pré-existentes (RN-04) permanecem com acesso real, mesmo aparentando estar suspensos, até serem manualmente re-tocados | Baixa (poucos registros esperados, pré-MVP) | Médio | Recomendação operacional (não automatizada nesta task): após o deploy, um `system_admin` deve consultar `consultants` filtrando `status == 'suspended'` e, para cada resultado, clicar em "Reativar" e depois "Suspender" novamente (ou, preferencialmente, pedir ao dev para rodar um script pontual de auditoria/correção, fora do escopo desta spec) para migrar cada um ao novo mecanismo real. |
| Handler `PUT` (STEP 3, RF-05) reativar acidentalmente um consultor que nunca esteve com `disabled: true` (ex.: edição de nome com `status` inalterado) | Baixa | Baixo | Ramo condicional do RF-05 só executa quando o `status` **anterior** ao update era diferente de `'active'` — uma edição normal de um consultor já ativo não aciona nenhuma chamada extra ao Auth. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Custom claims | Dados customizados (`tenant_id`, `role`, `is_consultant`, `active`, etc.) embutidos no ID token do Firebase Auth de um usuário, usados por `firestore.rules` e pelo frontend (`ProtectedRoute`) para controle de acesso — distintos do documento Firestore do usuário. |
| `disabled` (Firebase Auth) | Flag no registro do usuário no Firebase Auth; quando `true`, bloqueia novos logins e a emissão de novos ID tokens (incluindo refresh automático), mas não invalida um ID token já emitido e ainda válido, a menos que `revokeRefreshTokens` também seja chamado. |
| `revokeRefreshTokens` | Método do Admin SDK que invalida imediatamente todos os refresh tokens (e, por consequência, a capacidade de renovar sessões) de um usuário — não usado em nenhum ponto deste projeto até o momento. |
| Rota órfã / código morto | Endpoint ou função implementada, mas nunca chamada por nenhuma tela ou fluxo real do sistema — termo usado consistentemente em `_MAPA-DE-BUGS-E-MELHORIAS.md`, Seção 5. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-29-editar-suspender-e-reativar-consultor.md` — RN-01/RN-02 (Seção 9, achados críticos), Fluxos Alternativos 7a/7b (Seção 7), Seção 14 (perguntas em aberto que originaram a decisão do PO).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` — Seção 2 (`UC-29-RN-01`, Crítica), Seção 5 (`DELETE /api/consultants/[id]` como código morto), Seção 6 (decisão do PO registrada: reconectar "Suspender" ao `DELETE`).
- `src/app/(admin)/admin/consultants/page.tsx` — `handleToggleStatus` (linhas 69-104), botões de ação (linhas 283-301).
- `src/app/(admin)/admin/consultants/[id]/page.tsx` — `handleSave` (linhas 117-144), confirmado como não afetado por este bugfix.
- `src/app/api/consultants/[id]/route.ts` — `GET`/`PUT`/`DELETE` completos.
- `src/app/api/consultants/route.ts` (linhas 260-266) — claims originais setadas na criação do consultor (referência para o formato correto).
- `src/app/api/consultants/claims/route.ts`, `src/app/api/consultants/claims/[id]/approve/route.ts`, `src/app/api/consultants/transfer-requests/[id]/approve/route.ts`, `src/app/api/consultants/[id]/set-password/route.ts` — precedentes do padrão correto (`adminAuth.getUser(...).customClaims` antes de `setCustomUserClaims`).
- `firestore.rules` — regra de `consultants/{consultantId}` (`isSystemAdmin()`), `isConsultant()` (linha 28, depende de `is_consultant` na claim).
- `src/types/index.ts` — `ConsultantStatus` (linha 407), `Consultant` (linhas 409-421).
- `src/components/auth/ProtectedRoute.tsx` (linhas 46, 92) — checagem de `claims.active === false`.

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 16/07/2026 | Doc Writer (Claude) | Versão inicial. Spec gerada a partir do item `UC-29-RN-01`/`UC-29-RN-02` do mapa de bugs (decisão do PO já registrada: reconectar "Suspender" ao `DELETE`). Investigação adicional desta sessão confirmou dois achados não cobertos pela decisão original: (1) o handler `DELETE` tem um bug de custom claims — espalha o documento Firestore em vez das claims reais do usuário, divergindo do padrão usado em 4 outros pontos do código-base — corrigido como STEP 1, sempre aplicado; (2) o botão "Reativar" usa a mesma função `handleToggleStatus` de "Suspender" hoje, e continuaria chamando apenas `PUT` (sem tocar Auth/claims) mesmo após a correção do "Suspender" — investigação confirma a assimetria é real (não descartada), registrada como ⚠️ Decisão necessária (Seção 4) com duas opções concretas (A: reforçar também o `PUT` de reativação; B: escopo restrito + item de acompanhamento no mapa de bugs), sem decidir qual delas adotar. |
| 1.1 | 16/07/2026 | Doc Writer (Claude) | **O PO decidiu pela Opção A** para a decisão pendente da Seção 4 (reforçar também o `PUT` de reativação, restaurando Auth+claims — não a Opção B de escopo restrito). Documento atualizado para remover toda condicionalidade textual: cabeçalho perde o campo "Área de decisão pendente"; resumo executivo, Seção 1.2/1.3, Seção 2 (objetivo 3) e Seção 4 (nova subseção 4.1.1 "Reativação restaura acesso real (Opção A)", registrando a decisão e mantendo o raciocínio técnico como histórico) deixam de tratar a reativação como incerta; a antiga "Opção B" foi movida para a Seção 4.2 (Alternativas descartadas); RF-05 deixa de ser condicional e passa a prioridade "Alta" normal; RF-06 (requisito da Opção B) foi removido; Seção 0 (tabela de commits e aviso de bloqueio de PR), Seção 5.2, Seção 6.2, Seção 7 (STEP 3 e roteiro de reativação do STEP 4), Seção 9 (checklist) e Seção 10 (risco de "merge parcial" reformulado para "STEP 3 pulado por engano") foram ajustados para tratar STEP 3/RF-05 como escopo normal e sempre executado. Nenhuma ⚠️ Decisão necessária permanece pendente no documento — pronto para o `dev-task-manager`. |
| 1.2 | 16/07/2026 | Guilherme Scandelari | Task concluída — implementados STEP 1 (`fix(admin): preserve real auth claims when deactivating consultant`), STEP 2 (`fix(admin): route consultant suspension through the real deactivation endpoint`) e STEP 3 (`fix(admin): restore auth access and claims on consultant reactivation`). Documento movido para `TASK_COMPLETED/`. |
