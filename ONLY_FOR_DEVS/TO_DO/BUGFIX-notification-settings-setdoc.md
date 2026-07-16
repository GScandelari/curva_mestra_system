# Bugfix: Corrigir inicialização de Preferências de Notificação (`updateDoc` → `setDoc`)

**Projeto:** Curva Mestra
**Data:** 15/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/notification-settings-setdoc`
**Prioridade:** Alta
**Versão:** 1.0

> `initializeNotificationSettings` e o fallback de `saveNotificationSettings` (`notificationService.ts`) usam `updateDoc` para criar o documento `tenants/{tenantId}/settings/notifications`, mas `updateDoc` do Firestore Web SDK nunca cria documentos — só atualiza os já existentes. Para qualquer tenant cujo documento de configurações nunca foi criado por outro caminho (todo tenant novo), a tela `/clinic/settings` falha permanentemente com erro "not-found" e nunca renderiza o formulário. Correção: trocar `updateDoc` por `setDoc` nos dois pontos afetados.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** sempre `develop`.
**Branch da task:** `bugfix/notification-settings-setdoc`

Fluxo obrigatório (ver `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seção 1.3-1.4):
`bugfix/notification-settings-setdoc` → PR → branch pessoal do dev (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal → PR → `develop`.

**PR sempre para `develop`, nunca para `master`.**

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `fix` | `notifications` | `fix(notifications): use setDoc to create tenant notification settings` |

Este bugfix é pequeno e isolado o suficiente para caber em um único commit atômico (dois pontos de mudança na mesma função de arquivo, mesma causa raiz).

Ao abrir o PR para `develop`, seguir a Seção 15 do guia (pipeline de agentes de IA): acionar `uml-use-case-writer` para atualizar UC-43 (RN-01/RN-02 deixam de ser achados) e `uc-issues-tracker` (Modo B) para mover `UC-43-RN-01/02` de "Em Correção" para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A tela `/clinic/settings` (`ClinicSettingsPage`, `src/app/(clinic)/clinic/settings/page.tsx`) permite que um `clinic_admin` configure preferências de notificação do tenant (alertas de vencimento, estoque baixo, solicitações, som e e-mail). Essas preferências ficam em `tenants/{tenantId}/settings/notifications`, lidas/gravadas via `src/lib/services/notificationService.ts`.

No `useEffect` de carregamento (`loadSettings`, linhas 37-63 de `page.tsx`), se `getNotificationSettings` retorna `null` (documento ainda não existe), a página chama `initializeNotificationSettings(tenantId, user.uid)` para criar o documento com os valores padrão antes de tentar ler novamente.

`initializeNotificationSettings` (linhas 95-112 de `notificationService.ts`) executa:

```ts
const settingsRef = doc(db, `tenants/${tenantId}/settings/notifications`);

await updateDoc(settingsRef, {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  tenant_id: tenantId,
  updated_at: Timestamp.now(),
  updated_by: userId,
});
```

`saveNotificationSettings` (linhas 58-90) tem o mesmo problema em seu bloco de fallback, usado quando o `updateDoc` principal (linha 73) falha com `error.code === 'not-found'`:

```ts
if (error.code === 'not-found') {
  const settingsRef = doc(db, `tenants/${tenantId}/settings/notifications`);
  await updateDoc(settingsRef, {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...settings,
    tenant_id: tenantId,
    updated_at: Timestamp.now(),
    updated_by: userId,
  });
} else {
  console.error('Erro ao salvar configurações:', error);
  throw error;
}
```

### 1.2 Problema identificado

`updateDoc` do Firestore Web SDK **exige que o documento já exista** — nunca cria um documento novo (diferente de `setDoc`, que cria ou sobrescreve). Nos dois pontos acima, o documento `tenants/{tenantId}/settings/notifications` **não existe ainda** (é exatamente por isso que o código está tentando criá-lo). O `updateDoc` lança uma exceção com `code: 'not-found'`.

Não há nenhum outro caminho no sistema que crie esse documento — confirmado por busca em toda a base de código (UC-43, RN-01) e pela ausência de qualquer escrita em `settings/notifications` fora de `notificationService.ts`. Em particular, o cadastro de nova clínica (UC-21) não cria este documento.

Consequência observável (UC-43, fluxo 7a):
1. `getNotificationSettings` retorna `null`.
2. `initializeNotificationSettings` tenta `updateDoc` → falha com `not-found`.
3. A exceção sobe até o `try/catch` de `loadSettings`, que chama `setError('Erro ao carregar configurações')`.
4. A página nunca renderiza o formulário — apenas o bloco de erro. Isso se repete em toda visita futura, pois o documento nunca chega a ser criado.

O mesmo problema se manifesta de forma equivalente no fluxo de exceção 8b (`saveNotificationSettings`): se o `updateDoc` principal falhar com `not-found`, o fallback tenta `updateDoc` de novo (em vez de `setDoc`) e falha pelo mesmo motivo, propagando a exceção para `handleSave`.

### 1.3 Motivação estratégica

Além de quebrar `/clinic/settings` para todo tenant novo, este bug bloqueia indiretamente o UC-42 (Executar Verificações de Alertas Manualmente): quando o documento de configurações não existe, UC-42 trata a ausência como "tudo desabilitado" (fluxo 8b daquele UC), silenciando alertas de vencimento e estoque baixo mesmo quando o tenant nunca teve a chance de configurá-los.

Este é o item `UC-43-RN-01/02`, classificado como **Crítica** em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 2) e já com decisão de PO registrada na Seção 6 daquele mapa: corrigir apenas o bug (`updateDoc` → `setDoc`), sem religar a navegação de `/clinic/settings` (decisão separada) e sem implementar automação de alertas (decisão de roadmap separada).

---

## 2. Objetivos

1. Fazer com que a primeira visita de qualquer tenant a `/clinic/settings` crie o documento `tenants/{tenantId}/settings/notifications` com sucesso e renderize o formulário com os valores padrão (`DEFAULT_NOTIFICATION_SETTINGS`).
2. Fazer com que o fallback de `saveNotificationSettings` para `error.code === 'not-found'` crie o documento com sucesso em vez de propagar uma segunda falha idêntica.
3. Não alterar nenhum outro comportamento da tela, do serviço ou da navegação (ver Seção 5.5).

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | Ao acessar `/clinic/settings` pela primeira vez (documento de configurações inexistente), o sistema deve criar `tenants/{tenantId}/settings/notifications` com `DEFAULT_NOTIFICATION_SETTINGS` e exibir o formulário carregado, sem erro. | Clinic Admin | Alta |
| RF-02 | Ao salvar configurações (`handleSave`) num tenant cujo documento não existe (ou deixou de existir por qualquer motivo), o fallback de `saveNotificationSettings` deve criar o documento com sucesso, mesclando os valores padrão com os valores submetidos pelo usuário. | Clinic Admin | Alta |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | A mudança não deve alterar a assinatura pública (parâmetros, tipo de retorno) de `initializeNotificationSettings` nem de `saveNotificationSettings` — apenas a implementação interna. | Compatibilidade |
| RNF-02 | Nenhuma nova dependência de pacote é necessária — `setDoc` já faz parte do SDK `firebase/firestore` já usado no arquivo (só precisa ser importado). | Simplicidade |
| RNF-03 | Multi-tenant: a escrita continua escopada por `tenants/{tenantId}/settings/notifications`, sem alterar o padrão de isolamento por `tenant_id` já existente. | Multi-tenant |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | A criação do documento de configurações (`initializeNotificationSettings` e o fallback de `saveNotificationSettings`) deve usar `setDoc`, não `updateDoc`. | `updateDoc` exige documento pré-existente; `setDoc` cria ou sobrescreve — comportamento correto para "criar se não existir". Confirmado em UC-43 (RN-01/RN-02). |
| RN-02 | O caminho principal de `saveNotificationSettings` (linha 73, `updateDoc` sobre um documento presumidamente já existente) **não é alterado** por este bugfix — só o bloco de fallback do `catch`. | Decisão do PO (mapa de bugs, Seção 6, entrada UC-43-RN-01/02): corrigir apenas o bug relatado, sem escopo adicional. O caminho principal já funciona corretamente quando o documento existe. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Trocar `updateDoc` por `setDoc` (sem `{ merge: true }`) nos dois pontos identificados:

1. `initializeNotificationSettings` — grava o objeto completo (`DEFAULT_NOTIFICATION_SETTINGS` + `tenant_id` + `updated_at` + `updated_by`), que já cobre 100% dos campos de `NotificationSettings`. Overwrite total é seguro porque o documento não existe neste ponto (é por isso que a função foi chamada).
2. Fallback de `saveNotificationSettings` — grava `{ ...DEFAULT_NOTIFICATION_SETTINGS, ...settings, tenant_id, updated_at, updated_by }`, também um objeto completo (o spread de `DEFAULT_NOTIFICATION_SETTINGS` garante que todos os campos obrigatórios de `NotificationSettings` estejam presentes, mesmo que `settings` seja parcial).

Ambos os pontos já constroem o objeto completo antes da escrita — não é necessário `{ merge: true }` (ver análise de risco na Seção 10).

### 4.2 Alternativas descartadas

- **Usar `setDoc(ref, data, { merge: true })` em ambos os pontos:** descartado. `merge: true` é útil quando se quer preservar campos existentes não incluídos no `data` — mas nos dois pontos afetados o documento **não existe** (senão `updateDoc` teria funcionado), então não há nada para "preservar". Adicionar `merge: true` sem necessidade não corrige nem piora o bug, apenas adiciona uma opção sem efeito prático neste caso; manter a chamada mais simples (`setDoc(ref, data)`) reduz a superfície de leitura do código.
- **Usar uma transação (`runTransaction`) com leitura+escrita condicional ("criar só se não existir"):** descartado por excesso de engenharia para o escopo deste bugfix — o PO decidiu explicitamente corrigir só o `updateDoc`→`setDoc` (mapa de bugs, Seção 6), sem introduzir novo mecanismo de concorrência. O cenário de duas requisições simultâneas de inicialização do mesmo tenant é extremamente improvável (mesmo usuário, mesma sessão, mesma navegação) e, mesmo que ocorresse, `setDoc` sem `merge` apenas sobrescreveria com o mesmo conteúdo padrão — sem dado perdido.
- **Criar o documento de configurações no momento do cadastro de clínica (UC-21), em vez de lazy-init em `/clinic/settings`:** descartado — é uma mudança de escopo maior (mexe em UC-21) e não foi a decisão do PO registrada no mapa de bugs, que optou por corrigir apenas o bug local.

### 4.3 Trade-offs aceitos

- O documento de configurações continua sendo criado de forma "preguiçosa" (lazy), só na primeira visita a `/clinic/settings` — não há mudança de arquitetura, apenas conserto do mecanismo de criação já planejado.
- A rota `/clinic/settings` continua sem link de navegação em nenhum menu (decisão de produto separada, já registrada no mapa de bugs) — este bugfix não adiciona nem remove esse link.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

N/A — nenhum arquivo novo.

### 5.2 Arquivos a MODIFICAR

| Arquivo | Mudança |
|---|---|
| `src/lib/services/notificationService.ts` | Import: adicionar `setDoc` à lista de imports de `firebase/firestore` (linha 6-22). `initializeNotificationSettings` (linha 102): trocar `updateDoc(settingsRef, {...})` por `setDoc(settingsRef, {...})`. `saveNotificationSettings`, bloco `catch` / `if (error.code === 'not-found')` (linha 78): trocar `updateDoc(settingsRef, {...})` por `setDoc(settingsRef, {...})`. |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

- **Nenhuma mudança em `firestore.rules`.** A regra dedicada já existente (linhas 77-86) usa `allow write`, que no Firestore Security Rules cobre `create`, `update` e `delete` — já permite a operação de criação (`setDoc`) para `clinic_admin` do próprio tenant, exatamente como já permitia `update` via `updateDoc`. Confirmado por leitura de `firestore.rules`:
  ```
  match /tenants/{tenantId}/settings/notifications {
    allow read, write: if isSystemAdmin();
    allow read: if belongsToTenant(tenantId);
    allow write: if belongsToTenant(tenantId) && request.auth.token.role == 'clinic_admin';
  }
  ```
- **Nenhuma mudança em `firestore.indexes.json`** — não há query nova, apenas leitura/escrita por caminho de documento direto.
- **Nenhuma migração de dados** necessária — tenants que já têm o documento (criados por acaso ou em ambiente de teste anterior) não são afetados; a mudança só muda o comportamento de criação para tenants sem o documento.

### 5.5 O que NÃO muda

- `getNotificationSettings` — leitura, não é afetada.
- O caminho principal (não-fallback) de `saveNotificationSettings` (linha 73) — continua usando `updateDoc`, como já documentado em RN-02.
- `ClinicSettingsPage` (`page.tsx`) — nenhuma alteração de UI, de gate de role, ou de tratamento de erro. O `try/catch` de `loadSettings` e `handleSave` continuam iguais; eles simplesmente passam a não cair mais no `catch` neste cenário específico.
- Navegação (`ClinicLayout`, `navLinks`) — a rota `/clinic/settings` continua sem link de menu, por decisão de produto separada (mapa de bugs, Seção 5 e Seção 6).
- Automação de alertas (Scheduled Function) — fora de escopo, decisão de roadmap separada (UC-42/UC-43, RN-08).
- `firestore.rules` — nenhuma alteração necessária (ver 5.4).
- Tipos em `src/types/notification.ts` (`NotificationSettings`, `DEFAULT_NOTIFICATION_SETTINGS`) — nenhuma alteração necessária.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — nenhuma mudança em `NotificationSettings` nem em `DEFAULT_NOTIFICATION_SETTINGS`.

### 6.2 Mudanças em serviços

**Arquivo:** `src/lib/services/notificationService.ts`

**Import (linha 6-22):** adicionar `setDoc` à lista já importada de `firebase/firestore`:

```ts
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc, // ← novo
  deleteDoc,
  writeBatch,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
```

**`saveNotificationSettings` — bloco de fallback (linhas 74-89), trocar `updateDoc` por `setDoc`:**

```ts
} catch (error: any) {
  // Se documento não existe, criar com valores padrão
  if (error.code === 'not-found') {
    const settingsRef = doc(db, `tenants/${tenantId}/settings/notifications`);
    await setDoc(settingsRef, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...settings,
      tenant_id: tenantId,
      updated_at: Timestamp.now(),
      updated_by: userId,
    });
  } else {
    console.error('Erro ao salvar configurações:', error);
    throw error;
  }
}
```

**`initializeNotificationSettings` (linhas 95-112), trocar `updateDoc` por `setDoc`:**

```ts
export async function initializeNotificationSettings(
  tenantId: string,
  userId: string
): Promise<void> {
  try {
    const settingsRef = doc(db, `tenants/${tenantId}/settings/notifications`);

    await setDoc(settingsRef, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      tenant_id: tenantId,
      updated_at: Timestamp.now(),
      updated_by: userId,
    });
  } catch (error) {
    console.error('Erro ao inicializar configurações:', error);
    throw error;
  }
}
```

### 6.3 Mudanças na UI

N/A — `ClinicSettingsPage` (`src/app/(clinic)/clinic/settings/page.tsx`) não precisa de nenhuma alteração de código. O efeito observável (formulário passa a carregar) é consequência direta da correção no service.

### 6.4 Mudanças em API Routes

N/A — não há API route envolvida; toda a leitura/escrita é feita client-side via Firestore Web SDK, respeitando as regras de segurança já existentes.

---

## 7. Plano de Implementação

### STEP 1 — Trocar `updateDoc` por `setDoc` nos dois pontos de criação

**Objetivo:** Fazer com que a criação do documento `tenants/{tenantId}/settings/notifications` funcione corretamente na primeira visita de um tenant novo a `/clinic/settings`, e no fallback de salvamento.

**Arquivos afetados:**
- `src/lib/services/notificationService.ts`

**Ações:**
1. Adicionar `setDoc` ao bloco de import de `firebase/firestore` (linha 6-22).
2. Em `initializeNotificationSettings` (linha 102), trocar `updateDoc(settingsRef, {...})` por `setDoc(settingsRef, {...})`. Manter o objeto gravado idêntico (`...DEFAULT_NOTIFICATION_SETTINGS, tenant_id, updated_at, updated_by`).
3. Em `saveNotificationSettings`, dentro do bloco `if (error.code === 'not-found')` (linha 78), trocar `updateDoc(settingsRef, {...})` por `setDoc(settingsRef, {...})`. Manter o objeto gravado idêntico (`...DEFAULT_NOTIFICATION_SETTINGS, ...settings, tenant_id, updated_at, updated_by`).
4. **Não alterar** o `updateDoc` da linha 73 (caminho principal de `saveNotificationSettings`) — ver RN-02.
5. **Não alterar** `firestore.rules` — a regra `allow write` já cobre `setDoc` (ver Seção 5.4).

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Validação manual (ver abaixo) confirma que a primeira visita de um tenant sem o documento carrega o formulário e que salvar funciona.

**Commit:** `fix(notifications): use setDoc to create tenant notification settings`

---

### STEP 2 — Validação manual (obrigatória antes de abrir o PR)

**Objetivo:** Confirmar de ponta a ponta que o bug foi corrigido, usando um tenant sem o documento `settings/notifications`.

**Roteiro sugerido:**
1. No Firebase Emulator Suite (`firebase emulators:start`) ou num tenant de teste recém-criado (que nunca visitou `/clinic/settings` antes), confirmar via Firestore que `tenants/{tenantId}/settings/notifications` **não existe**.
2. Logar como `clinic_admin` desse tenant e navegar diretamente para `/clinic/settings` (lembrar: não há link de menu — acesso via URL direta, RN-06 do UC-43).
3. **Esperado:** o formulário carrega normalmente, sem o bloco de erro "Erro ao carregar configurações", exibindo os valores padrão (`enable_expiry_alerts: true`, `expiry_warning_days: 30`, `enable_low_stock_alerts: true`, `low_stock_threshold: 10`, `enable_request_alerts: true`, `notification_sound: true`, `email_notifications: false`).
4. Confirmar no Firestore que o documento `tenants/{tenantId}/settings/notifications` foi criado com esses valores mais `tenant_id`, `updated_at`, `updated_by`.
5. Alterar um valor (ex.: desligar "Ativar alertas de estoque baixo") e clicar em "Salvar Configurações".
6. **Esperado:** toast de sucesso "Configurações salvas", sem erro; o Firestore reflete o novo valor.
7. Recarregar a página (`F5`) e confirmar que o valor alterado persiste (não volta ao padrão).
8. Repetir o passo 5-7 uma segunda vez, para confirmar que o caminho principal (`updateDoc`, já funcional, linha 73) continua funcionando normalmente após o documento existir — não deve mais cair no bloco de fallback.

**Commit:** N/A (validação manual, não gera commit de código).

---

## 8. Estratégia de Testes

| Função / Arquivo | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `initializeNotificationSettings` (`notificationService.ts`) | Não testar | Função depende diretamente do Firestore Web SDK (`doc`, `setDoc`) sem abstração injetável — mock frágil, mesmo padrão já adotado no restante de `notificationService.ts` e nos demais services do projeto (ver `BUG-consultor-vinculo-automatico.md`, Seção "Avaliação de Testes"). |
| `saveNotificationSettings` (`notificationService.ts`) | Não testar | Mesma justificativa — dependência direta do SDK Firestore. |
| `ClinicSettingsPage` (`page.tsx`) | Não testar | Componente React/page com dependência de Firebase Auth + Firestore — fora do escopo de testes automatizados do MVP (ver seção 8 do template padrão do projeto). |

**Conclusão:** Nenhum teste automatizado é necessário para este bugfix. A verificação de correção é feita via validação manual (STEP 2, Seção 7), consistente com o critério do projeto de não testar API routes/componentes React/serviços com dependência direta do Firebase SDK no MVP.

---

## 9. Checklist de Definition of Done

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `npm run test` sem erros (nenhum teste novo necessário, mas suíte existente não pode quebrar)
- [ ] Multi-tenant: escrita continua escopada por `tenants/{tenantId}/settings/notifications` (nenhuma mudança de escopo)
- [ ] Segurança: nenhuma alteração necessária em `firestore.rules` (regra `allow write` já cobre `setDoc`); confirmado por leitura das regras (Seção 5.4)
- [ ] Branch pessoal (`gscandelari_setup` ou `lhuan_setup`) validada no domínio Firebase pessoal antes do PR para `develop`
- [ ] PR aberto para `develop` (nunca para `master`)
- [ ] Validação manual do STEP 2 executada e documentada no PR (com tenant sem `settings/notifications` pré-existente)
- [ ] Após merge: `uml-use-case-writer` aciona atualização de UC-43 (RN-01/RN-02 deixam de ser achado); `uc-issues-tracker` (Modo B) move `UC-43-RN-01/02` para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `setDoc` sem `{ merge: true }` sobrescrever campos existentes indevidamente | Baixa | Médio (se ocorresse) | **Avaliado e descartado como preocupação real neste caso específico.** Nos dois pontos alterados, o objeto gravado é sempre construído por inteiro: `initializeNotificationSettings` grava `{ ...DEFAULT_NOTIFICATION_SETTINGS, tenant_id, updated_at, updated_by }` (100% dos campos de `NotificationSettings`); o fallback de `saveNotificationSettings` grava `{ ...DEFAULT_NOTIFICATION_SETTINGS, ...settings, tenant_id, updated_at, updated_by }` (também completo, já que o spread de `DEFAULT_NOTIFICATION_SETTINGS` preenche qualquer campo não presente em `settings`). Não há nenhum ponto onde um objeto parcial seja gravado sem `merge`. Além disso, ambos os pontos só são alcançados quando o documento **não existe** — não há "campos existentes" para sobrescrever. |
| Corrida entre duas chamadas simultâneas de `initializeNotificationSettings` para o mesmo tenant (ex.: dois cliques rápidos, duas abas) | Muito baixa | Baixo | `setDoc` sem `merge` faz "last write wins" — mas como ambos gravariam exatamente o mesmo conteúdo padrão (mesmo `tenant_id`), o resultado final é idêntico independentemente de qual escrita "vence". Nenhum dado é perdido. Fora do escopo deste bugfix introduzir uma transação para este cenário extremamente improvável (ver Seção 4.2). |
| Regressão no caminho principal de `saveNotificationSettings` (linha 73, não alterado) | Muito baixa | Baixo | Nenhuma linha desse caminho é tocada por este bugfix (RN-02); validado explicitamente no STEP 2, passo 8, que ele continua funcionando após o documento já existir. |
| Mudança não corrigir o bug se houver alguma outra causa raiz não identificada | Baixa | Médio | Causa raiz confirmada por leitura literal do código-fonte (não é hipótese) — `updateDoc` do Firestore Web SDK comprovadamente não cria documentos. Validação manual do STEP 2 confirma a correção de ponta a ponta antes do PR. |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| `updateDoc` | Função do Firestore Web SDK que atualiza campos de um documento **existente**; lança erro `not-found` se o documento não existir. |
| `setDoc` | Função do Firestore Web SDK que cria um documento novo ou sobrescreve um existente (sobrescrita total, a menos que `{ merge: true }` seja passado). |
| Lazy init | Padrão de criar um recurso (aqui, o documento de configurações) somente na primeira vez que é necessário, em vez de no cadastro/provisionamento inicial. |
| `DEFAULT_NOTIFICATION_SETTINGS` | Constante em `src/types/notification.ts` com os valores padrão de todas as preferências de notificação, exceto `tenant_id`/`updated_at`/`updated_by`. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-43-configurar-preferencias-de-notificacao.md` — RN-01, RN-02 (Seção 9), fluxo alternativo 7a e fluxo de exceção 8b (Seções 7 e 8), item 1 da Seção 14 (decisão de priorizar a correção).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` — Seção 2 (`UC-43-RN-01/02`, Crítica), Seção 6 (decisão do PO: corrigir apenas o bug `updateDoc`→`setDoc`, sem religar navegação nem implementar automação).
- `src/lib/services/notificationService.ts` — `initializeNotificationSettings`, `saveNotificationSettings`, `getNotificationSettings`.
- `src/app/(clinic)/clinic/settings/page.tsx` — `ClinicSettingsPage`.
- `src/types/notification.ts` — `NotificationSettings`, `DEFAULT_NOTIFICATION_SETTINGS`.
- `firestore.rules` (linhas 77-86) — regra dedicada de `settings/notifications`.
- Documentação oficial Firestore — [`setDoc` vs `updateDoc`](https://firebase.google.com/docs/firestore/manage-data/add-data).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 15/07/2026 | Doc Writer (Claude) | Versão inicial. Spec gerada a partir do item `UC-43-RN-01/02` do mapa de bugs (decisão do PO já tomada: corrigir apenas `updateDoc`→`setDoc`), com leitura completa de `notificationService.ts`, `ClinicSettingsPage`, `notification.ts` e das regras de `firestore.rules` relevantes. |
