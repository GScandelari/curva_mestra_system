# Bugfix: Observações em várias linhas e validade do lote em dd/mm/aaaa no formulário de procedimento

**Projeto:** Curva Mestra
**Data:** 19/10/2026
**Autor:** Doc Writer (Claude)
**Status:** Planejamento
**Tipo:** Bugfix
**Branch sugerida:** fix/formulario-procedimento-observacoes-validade
**Prioridade:** Média
**Versão:** 1.0

> Duas correções só de UI no formulário de novo procedimento (`/clinic/requests/new`). O campo "Observações" passa a ser `<Textarea>` (várias linhas), e o detalhe da solicitação preserva as quebras de linha. A validade do lote passa a aparecer como `31/01/2028`, e não mais como `Mon Jan 31 2028 09:00:00 GMT-0300 (...)`. Não muda dados, rules, API nem Firestore, o que é importante porque já há cliente real em produção.

---

## 0. Git Flow e Convenção de Commits

- **Branch base:** `develop` (verificar que está em sync com `master` antes de criar a branch)
- **Branch da task:** `fix/formulario-procedimento-observacoes-validade`
- **PR:** primeiro para a branch pessoal (`gscandelari_setup`) para validação no Firebase e depois para `develop`. Nunca direto para `master`.

| Step | Tipo | Escopo | Mensagem |
|------|------|--------|----------|
| STEP 1 | fix | requests | `fix(requests): use textarea for procedure notes` |
| STEP 2 | fix | requests | `fix(requests): format lot expiration date in pt-BR` |
| STEP 3 | test | e2e | `test(e2e): cover notes textarea and lot expiration format in UC-58` |
| STEP 4 | — | — | Validação manual, sem commit de código |

---

## 1. Contexto e Motivação

### 1.1 Situação atual

1. `src/app/(clinic)/clinic/requests/new/page.tsx`, linhas 999–1006: "Observações (opcional)" é um `<Input>` de uma linha (`id="observacoes"`, state `observacoes`/`setObservacoes`).
2. `src/app/(clinic)/clinic/requests/[id]/page.tsx`, linhas 334–339: as observações aparecem em `<p className="font-medium">{solicitacao.observacoes}</p>`. Quebras de linha somem.
3. `src/app/(clinic)/clinic/requests/new/page.tsx`, linhas 1072–1076: o `SelectItem` de "Lote Utilizado *" (só aparece em "Procedimento Efetuado") renderiza `{String(item.dt_validade)}`. `item.dt_validade` é `Date` (vem de `listInventory` em `inventoryService`), então aparece o `Date.toString()` completo.

### 1.2 Problema identificado

- Observações longas ficam espremidas numa linha só e não aceitam quebra de linha.
- A validade do lote é exibida em formato técnico e em inglês: `Lote QAG3 — 3 un. disponíveis (val. Mon Jan 31 2028 09:00:00 GMT-0300 (Horário Padrão de Brasília))`.

### 1.3 Motivação estratégica

O problema foi reportado no uso real da clínica. A correção é pequena e de baixo risco e segue o padrão de data já usado em `src/app/(clinic)/clinic/inventory/[id]/page.tsx:157` (`Intl.DateTimeFormat('pt-BR', ...)`).

---

## 2. Objetivos

1. Corrigir a exibição da validade do lote para `dd/mm/aaaa`.
2. Permitir observações em várias linhas no cadastro do procedimento.
3. Preservar as quebras de linha das observações na tela de detalhe.
4. Cobrir as duas correções no caderno E2E UC-58.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|----|-----------|------|-----------|
| RF-01 | O campo "Observações (opcional)" em `/clinic/requests/new` é um `<textarea>` com 3 linhas visíveis | clinic_admin / clinic_user | Must |
| RF-02 | O detalhe `/clinic/requests/[id]` exibe as observações preservando quebras de linha | clinic_admin / clinic_user | Must |
| RF-03 | A opção de lote exibe `Lote {lote} — {n} un. disponíveis (val. dd/mm/aaaa)` | clinic_admin / clinic_user | Must |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Nenhuma mudança em tipos, serviços, API, `firestore.rules` ou índices | Manutenibilidade |
| RNF-02 | Usar o componente existente `src/components/ui/textarea.tsx` (shadcn) | Manutenibilidade |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|----|-------|---------------|
| RN-01 | O valor salvo de `observacoes` continua sendo a string digitada, sem transformação (agora pode conter `\n`) | Mínimo impacto; registros existentes seguem válidos |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

- Trocar `<Input>` por `<Textarea rows={3}>`, mantendo `id`, `placeholder`, `value` e `onChange`.
- Adicionar `whitespace-pre-wrap` ao `<p>` de observações no detalhe.
- Formatar a validade inline com `new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(item.dt_validade)`. Pode ser um helper local `formatDate` no componente, como em `inventory/[id]/page.tsx`.

### 4.2 Alternativas descartadas

- **Criar um utilitário global de data:** fora do escopo de um bugfix pequeno.
- **Editar observações em `requests/[id]/edit`:** essa tela não edita observações hoje. Fica fora do escopo.

### 4.3 Trade-offs aceitos

`Intl.DateTimeFormat` usa o fuso do navegador, assim como `inventory/[id]`. Os dados reais de produção gravam a validade às 09:00 BRT, então não há troca de dia. Datas gravadas à meia-noite UTC (como as do seed do UC-58) podem aparecer com um dia a menos em BRT. Essa limitação é a mesma da tela de inventário e não é tratada aqui.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

N/A

### 5.2 Arquivos a MODIFICAR

| Arquivo | Natureza da mudança |
|---------|---------------------|
| `src/app/(clinic)/clinic/requests/new/page.tsx` | Importar `Textarea`, trocar o campo de observações e formatar a validade no `SelectItem` do lote |
| `src/app/(clinic)/clinic/requests/[id]/page.tsx` | Adicionar `whitespace-pre-wrap` no `<p>` de observações |
| `tests/e2e/UC-58-precificacao-hora-clinica.spec.ts` | Adicionar asserções para o textarea e o formato da validade |

### 5.3 Arquivos a REMOVER

N/A

### 5.4 Impacto no Firestore

N/A. Nenhuma coleção, regra ou índice muda. O campo `observacoes` continua sendo uma string.

### 5.5 O que NÃO muda

`inventoryService`, `solicitacaoService`, `src/types/`, `requests/[id]/edit`, `firestore.rules`, `firestore.indexes.json`, API routes e a lógica de reserva/FEFO.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A

### 6.2 Mudanças em serviços

N/A

### 6.3 Mudanças na UI

**`requests/new/page.tsx` — observações (linhas 999–1006):**

```tsx
// antes
<Input id="observacoes" placeholder="Informações adicionais sobre o procedimento" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
// depois
<Textarea id="observacoes" rows={3} placeholder="Informações adicionais sobre o procedimento" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
```

Adicionar `import { Textarea } from '@/components/ui/textarea';`. Manter o import de `Input`, que ainda é usado em outros campos (por exemplo, `#quantidade`).

**`requests/new/page.tsx` — lote (linhas 1074–1075):**

```tsx
// antes
Lote {item.lote} — {item.quantidade_disponivel} un. disponíveis (val.{' '}{String(item.dt_validade)})
// depois
Lote {item.lote} — {item.quantidade_disponivel} un. disponíveis (val.{' '}{formatDate(item.dt_validade)})
```

Aqui `formatDate` é o helper local com `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })`. Resultado esperado: `Lote QAG3 — 3 un. disponíveis (val. 31/01/2028)`.

**`requests/[id]/page.tsx` (linha 337):** `<p className="font-medium whitespace-pre-wrap">`.

### 6.4 Mudanças em API Routes

N/A

---

## 7. Plano de Implementação

### STEP 1 — Observações em várias linhas

**Objetivo:** O campo aceita várias linhas e o detalhe preserva as quebras.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/new/page.tsx` — import de `Textarea` e troca do campo
- `src/app/(clinic)/clinic/requests/[id]/page.tsx` — `whitespace-pre-wrap`

**Validação:** `npm run lint` e `npm run type-check` sem erros. Em `/clinic/requests/new`, Enter no campo quebra a linha, e o detalhe exibe as linhas separadas.

**Commit:** `fix(requests): use textarea for procedure notes`

### STEP 2 — Validade do lote em pt-BR

**Objetivo:** A opção de lote mostra a validade em `dd/mm/aaaa`.

**Arquivos afetados:**
- `src/app/(clinic)/clinic/requests/new/page.tsx` — helper `formatDate` e uso no `SelectItem`

**Validação:** Em "Procedimento Efetuado", ao selecionar um produto, o dropdown "Lote Utilizado *" mostra `(val. dd/mm/aaaa)` sem "GMT".

**Commit:** `fix(requests): format lot expiration date in pt-BR`

### STEP 3 — Caderno E2E

**Objetivo:** Estender `tests/e2e/UC-58-precificacao-hora-clinica.spec.ts`, que já cobre `/clinic/requests/new`.

**Ações:**
1. Adicionar um `test()` ao `describe.serial` (ou estender o Roteiro G) que abre `/clinic/requests/new` como clinic_admin e verifica `page.locator('#observacoes')` com `toHaveJSProperty('tagName', 'TEXTAREA')` (ou `evaluate(el => el.tagName)`).
2. No mesmo teste: clicar em "Procedimento Efetuado", selecionar "Produto Teste Rennova" em `#produto`, abrir `#lote` e verificar que as opções contêm `/\(val\. \d{2}\/\d{2}\/\d{4}\)/` e não contêm `GMT`. Não fixar o dia exato, porque o seed grava `T00:00:00Z` e o resultado depende do fuso (ver 4.3).
3. Não criar solicitação nesse teste (sem efeito colateral no cleanup). Se criar, registrar em `ctx.solicitacoesCriadas`.

**Validação:** `npm run test:e2e -- UC-58` passando.

**Commit:** `test(e2e): cover notes textarea and lot expiration format in UC-58`

### STEP 4 — Validação Manual

**Pré-requisitos:** Emulator Suite + `npm run test:e2e:seed` + `npm run dev` com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, ou a branch pessoal no Firebase (`dev-gscandelari.web.app`). A clínica precisa ter pelo menos um lote em estoque.

**Roteiro:**
1. Login como clinic_admin e ir em `/clinic/requests/new`. **Esperado:** "Observações (opcional)" aparece como caixa de texto com cerca de 3 linhas.
2. Digitar `Linha 1`, Enter, `Linha 2`. **Esperado:** o texto fica em duas linhas e o formulário não é enviado ao pressionar Enter.
3. Clicar em "Procedimento Efetuado", selecionar um produto e abrir "Lote Utilizado *". **Esperado:** `Lote X — N un. disponíveis (val. dd/mm/aaaa)`, sem "GMT" nem nome de dia/mês em inglês. A data confere com a validade mostrada em `/clinic/inventory/[id]` do mesmo lote.
4. Concluir o procedimento e abrir o detalhe. **Esperado:** em "Observações", `Linha 1` e `Linha 2` aparecem em linhas separadas.
5. Abrir uma solicitação antiga com observações de uma linha. **Esperado:** exibição inalterada.
6. Login como clinic_user e repetir os passos 1 e 3. **Esperado:** mesmo comportamento.

---

## 8. Estratégia de Testes

| Função | Arquivo de teste | Cenários obrigatórios |
|--------|-----------------|----------------------|
| N/A (só UI, sem função pura nova) | `tests/e2e/UC-58-precificacao-hora-clinica.spec.ts` | Campo `#observacoes` é `TEXTAREA`. Opção de lote com `val. dd/mm/aaaa` e sem `GMT` |

Spec E2E alterado por IA: revisão humana obrigatória antes do merge (regra 8 do `CLAUDE.md`).

---

## 9. Checklist de Definition of Done

```
[ ] npm run lint        — zero erros ou warnings
[ ] npm run type-check  — zero erros TypeScript
[ ] npm run build       — build de produção sem falhas
[ ] npm run test:e2e    — UC-58 passando (spec revisado por humano)
[ ] Multi-tenant: N/A — nenhuma query nova
[ ] Segurança: nenhum secret ou credencial no código
[ ] Branch pessoal: validado em dev-gscandelari.web.app (STEP 4)
[ ] PR: aberto para develop com template preenchido
[ ] Nenhuma mudança em rules/indexes/dados (sem comando de deploy de rules no merge para master)
```

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Validade exibida com um dia a menos para datas gravadas à meia-noite UTC | Baixa (produção grava 09:00 BRT) | Baixo | Mesmo comportamento de `inventory/[id]`. A asserção E2E não fixa o dia |
| `dt_validade` não ser `Date` em algum item | Baixa | Baixo | `listInventory` já converte o Timestamp para `Date`; o type-check acusa divergência |

---

## 11. Glossário

| Termo | Definição |
|-------|-----------|
| Procedimento Efetuado | Modo do formulário em que o usuário escolhe o lote exato consumido (`tipoProcedimento === 'efetuado'`) |
| `whitespace-pre-wrap` | Classe Tailwind que preserva quebras de linha e espaços e quebra o texto longo |

---

## 12. Referências

- `src/app/(clinic)/clinic/requests/new/page.tsx` (linhas 999–1006 e 1072–1076)
- `src/app/(clinic)/clinic/requests/[id]/page.tsx` (linhas 334–339)
- `src/app/(clinic)/clinic/inventory/[id]/page.tsx:157` — padrão `formatDate`
- `src/components/ui/textarea.tsx`
- `tests/e2e/UC-58-precificacao-hora-clinica.spec.ts`
- `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|-------------|
| 1.0 | 19/10/2026 | Doc Writer (Claude) | Versão inicial |
