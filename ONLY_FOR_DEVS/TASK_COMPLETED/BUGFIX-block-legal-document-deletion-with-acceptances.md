# Bugfix: Bloquear Exclusão de Documento Legal já Aceito por Usuários

**Projeto:** Curva Mestra
**Data:** 15/07/2026
**Autor:** Doc Writer (Claude)
**Status:** Concluído
**Concluído por:** Guilherme Scandelari
**Data de Conclusão:** 16/07/2026
**Tipo:** Bugfix
**Branch sugerida:** `bugfix/block-legal-document-deletion-with-acceptances`
**Prioridade:** Alta
**Versão:** 1.1

> `handleDelete` (`admin/legal-documents/page.tsx`) executa `deleteDoc` sobre `legal_documents/{id}` sem nenhuma checagem prévia de registros em `user_document_acceptances` referenciando aquele `document_id`. Como esses registros são imutáveis (`allow update, delete: if false`) e nunca são removidos em cascata, excluir um documento já aceito deixa um histórico de auditoria órfão — o aceite continua existindo, mas o conteúdo aceito desaparece. Correção: consultar `user_document_acceptances` por `document_id` (`limit(1)`) antes do `deleteDoc` e bloquear a exclusão, com mensagem explicativa, se houver qualquer aceite.

---

## 0. Git Flow e Convenção de Commits

**Branch base:** sempre `develop`.
**Branch da task:** `bugfix/block-legal-document-deletion-with-acceptances`

Fluxo obrigatório (ver `ONLY_FOR_DEVS/GUIA_CONFIGURACAO_PIPELINE_PADRONIZACAO.md`, seção 1.3-1.4):
`bugfix/block-legal-document-deletion-with-acceptances` → PR → branch pessoal do dev (`gscandelari_setup` ou `lhuan_setup`) → validação no domínio Firebase pessoal → PR → `develop`.

**PR sempre para `develop`, nunca para `master`.**

| Step | Tipo | Escopo | Mensagem de commit planejada |
|---|---|---|---|
| STEP 1 | `fix` | `legal-documents` | `fix(legal-documents): block deletion of documents with existing acceptances` |

Este bugfix é pequeno e isolado o suficiente para caber em um único commit atômico (um guard aditivo antes de um `deleteDoc` já existente, no mesmo arquivo).

Ao abrir o PR para `develop`, seguir a Seção 15 do guia (pipeline de agentes de IA): acionar `uml-use-case-writer` para atualizar UC-34 (RN-03 deixa de ser achado; novo fluxo de exceção documentando o bloqueio) e `uc-issues-tracker` (Modo B) para mover `UC-34-RN-03` de "Em Correção" para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`.

---

## 1. Contexto e Motivação

### 1.1 Situação atual

A listagem `/admin/legal-documents` (`src/app/(admin)/admin/legal-documents/page.tsx`) permite que um System Admin exclua permanentemente um documento legal clicando no ícone de lixeira (Trash2) de uma linha, confirmando em um `AlertDialog` ("Confirmar exclusão" / "Tem certeza que deseja excluir o documento {título}? Esta ação não pode ser desfeita.").

Ao confirmar, `handleDelete` (linhas 57-77) executa:

```ts
async function handleDelete() {
  if (!documentToDelete) return;

  try {
    await deleteDoc(doc(db, 'legal_documents', documentToDelete.id));
    toast({
      title: 'Sucesso',
      description: 'Documento excluído com sucesso',
    });
    loadDocuments();
  } catch (error: any) {
    toast({
      title: 'Erro ao excluir',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  }
}
```

Não há nenhuma consulta prévia à coleção `user_document_acceptances` (`src/types/index.ts`, interface `UserDocumentAcceptance`, campo `document_id: string`) para verificar se algum usuário já aceitou aquele documento.

### 1.2 Problema identificado

Registros em `user_document_acceptances` são imutáveis por regra do Firestore — confirmado em `firestore.rules` (linhas 164-171 e adiante): `allow read` restrito a `system_admin` ou ao próprio `user_id`; a regra de escrita, já documentada em UC-09 RN-05, é `allow update, delete: if false`. Esses registros também nunca são removidos em cascata quando um `legal_documents/{id}` é excluído — não existe Cloud Function, trigger ou lógica client-side que faça essa limpeza.

Consequência: excluir um documento legal já aceito por pelo menos um usuário deixa o histórico de aceites "órfão" — os registros de auditoria continuam existindo (`user_id`, `document_id`, `document_version`, `accepted_at`), mas o conteúdo real aceito (`title`, `content` de `legal_documents`) deixa de existir, tornando impossível reconstruir o que exatamente foi aceito. Isso compromete o valor probatório do histórico para fins de compliance/jurídico — o propósito inteiro de `user_document_acceptances` existir (UC-09).

Esse é o achado `UC-34-RN-03`, documentado em `ONLY_FOR_DEVS/PO_BA_Docs/UC-34-editar-publicar-e-excluir-documento-legal.md` (Seção 9, RN-03) e em `ONLY_FOR_DEVS/PO_BA_Docs/UC-09-aceitar-termos-legais.md` (Seção 9, RN-05, e Fluxo de Exceção 8f).

### 1.3 Motivação estratégica

Este é o item `UC-34-RN-03`, classificado como **Crítica** em `_MAPA-DE-BUGS-E-MELHORIAS.md` (Seção 2) e já com decisão de PO registrada na Seção 6 daquele mapa: bloquear a exclusão quando houver aceites registrados (opção (a) da Seção 14 do UC-34), preservando a possibilidade de excluir documentos que nunca foram aceitos por ninguém (rascunhos, erros de cadastro).

---

## 2. Objetivos

1. Impedir a exclusão de um documento legal (`legal_documents/{id}`) sempre que existir pelo menos um registro em `user_document_acceptances` com `document_id == id`.
2. Exibir ao System Admin uma mensagem clara explicando o motivo do bloqueio e sugerindo "desativar" (mudar `status` para `inativo` via tela de edição) como alternativa.
3. Preservar o comportamento atual (hard delete) para documentos sem nenhum aceite registrado — rascunhos e erros de cadastro continuam excluíveis normalmente.

---

## 3. Requisitos

### 3.1 Requisitos Funcionais (RF)

| ID | Descrição | Ator | Prioridade |
|---|---|---|---|
| RF-01 | Ao confirmar a exclusão de um documento legal, o sistema deve consultar `user_document_acceptances` por `document_id == documentToDelete.id` antes de chamar `deleteDoc`. | System Admin | Alta |
| RF-02 | Se a consulta retornar pelo menos um resultado, a exclusão deve ser bloqueada: nenhum `deleteDoc` é executado, e um toast destrutivo explica o motivo, sugerindo "desativar" como alternativa. | System Admin | Alta |
| RF-03 | Se a consulta não retornar nenhum resultado, a exclusão prossegue exatamente como hoje (`deleteDoc` + toast de sucesso + `loadDocuments()`). | System Admin | Alta |

### 3.2 Requisitos Não Funcionais (RNF)

| ID | Descrição | Categoria |
|---|---|---|
| RNF-01 | A consulta de checagem deve usar `limit(1)` — só é preciso saber se existe pelo menos um aceite, não quantos ou quais. | Performance |
| RNF-02 | Nenhuma nova dependência de pacote é necessária — `where` e `limit` já fazem parte do SDK `firebase/firestore` já usado no arquivo (precisam ser adicionados ao import). | Simplicidade |
| RNF-03 | Multi-tenant: N/A — `legal_documents` e `user_document_acceptances` são coleções globais (não escopadas por `tenant_id`), consistente com o padrão já documentado em UC-33/UC-34/UC-09 (System Admin gerencia documentos legais para toda a plataforma). Não introduzir filtro de `tenant_id` nesta consulta. | Multi-tenant |

### 3.3 Regras de Negócio (RN)

| ID | Regra | Justificativa |
|---|---|---|
| RN-01 | Um documento legal só pode ser excluído (hard delete) se não houver nenhum registro em `user_document_acceptances` com `document_id` igual ao seu `id`. | Decisão do PO (mapa de bugs, Seção 6, entrada `UC-34-RN-03`): opção (a) — bloquear a exclusão quando houver aceites, preservando a exclusão de documentos nunca aceitos (rascunhos, erros de cadastro). |
| RN-02 | O bloqueio não impede a edição do documento (incluir mudar `status` para `inativo`) — apenas a exclusão definitiva. A UI já expõe esse caminho (`LegalDocumentForm`, modo `edit`, campo `status`), então a mensagem de bloqueio deve sugerir essa alternativa. | Decisão do PO (opção (a), não a (b) — "desativar" não é a única forma permitida de remoção, mas é a alternativa recomendada quando o hard delete é bloqueado). |
| RN-03 | A checagem usa apenas `document_id`, sem considerar `document_version` — qualquer aceite de qualquer versão do documento é suficiente para bloquear a exclusão, já que o `id` do Firestore não muda entre versões (`LegalDocumentForm`, modo `edit`, reutiliza o mesmo ID — UC-34, referências). | Consistente com o fato de que o conteúdo (`title`, `content`) associado a esse `id` é único — excluir o documento apaga o conteúdo de todas as versões já aceitas sob esse mesmo `id`, não apenas da versão mais recente. |

---

## 4. Decisões de Design

### 4.1 Abordagem escolhida

Adicionar, no início de `handleDelete`, uma consulta a `user_document_acceptances`:

```ts
const acceptancesQuery = query(
  collection(db, 'user_document_acceptances'),
  where('document_id', '==', documentToDelete.id),
  limit(1)
);
const acceptancesSnapshot = await getDocs(acceptancesQuery);

if (!acceptancesSnapshot.empty) {
  toast({
    title: 'Não é possível excluir',
    description:
      'Este documento já foi aceito por pelo menos um usuário e não pode ser excluído, pois isso comprometeria o histórico de auditoria. Use "Editar" e defina o status como "Inativo" para removê-lo de circulação.',
    variant: 'destructive',
  });
  setDeleteDialogOpen(false);
  setDocumentToDelete(null);
  return;
}

await deleteDoc(doc(db, 'legal_documents', documentToDelete.id));
// ... restante inalterado
```

A checagem é feita **dentro** de `handleDelete`, após a confirmação do `AlertDialog` (não antes de abrir o dialog) — mantém o fluxo de UI atual intacto (o dialog de confirmação continua abrindo normalmente para qualquer documento) e concentra toda a lógica de bloqueio em um único ponto, junto ao `deleteDoc` que ela protege. Isso é consistente com o padrão de guard aditivo pedido: mínima alteração de estrutura, máxima clareza sobre onde o bloqueio ocorre.

`limit(1)` é usado porque a pergunta é binária ("existe pelo menos um aceite?") — não há necessidade de contar todos os aceites para decidir o bloqueio nem para compor a mensagem (ver RN-03 sobre não diferenciar por quantidade/versão na mensagem base; ver Seção 4.2 sobre a alternativa de exibir a contagem, descartada).

### 4.2 Alternativas descartadas

- **Checar a existência de aceites antes de abrir o `AlertDialog`** (ou seja, mover a consulta para o `onClick` do botão de lixeira): descartado. Isso adicionaria uma chamada de rede a cada clique no ícone de lixeira, mesmo quando o admin ainda pode cancelar na confirmação — pior UX (delay perceptível antes do dialog abrir) e mais leituras desnecessárias ao Firestore. Fazer a checagem só depois da confirmação (dentro de `handleDelete`) mantém o dialog instantâneo e só paga o custo da consulta quando o admin já demonstrou intenção real de excluir.
- **Exibir a contagem exata de usuários que aceitaram (`N usuário(s)`) na mensagem de bloqueio**, exigindo `getCountFromServer` ou uma query sem `limit`: descartado por escopo — o PO não pediu esse nível de detalhe, e uma contagem exata adicionaria uma segunda leitura (ou uma leitura sem `limit`, mais cara) só para melhorar uma mensagem que já é clara sem o número. Mantém-se a mensagem genérica ("já foi aceito por pelo menos um usuário"), suficiente para explicar o motivo do bloqueio.
- **Bloquear no Firestore Security Rules (`allow delete: if ...` verificando ausência de aceites)**: descartado. Regras do Firestore não conseguem fazer uma consulta a outra coleção de forma performática/suportada para esse tipo de checagem de existência condicionada por um `where` arbitrário sem custo alto (`exists()`/`get()` em regras são limitados e não suportam `where` com `limit` sobre uma coleção inteira) — e o padrão do módulo inteiro (RN-06 do UC-34) já é validação 100% client-side, sem API route. Manter a mesma camada (client) do restante do módulo evita inconsistência de abordagem dentro do mesmo arquivo.
- **Opção (b) da Seção 14 do UC-34 (permitir apenas "desativar", nunca excluir de fato)**: descartado — decisão explícita do PO, não escolhida. Documentos sem nenhum aceite (rascunhos, erros de cadastro) devem continuar sendo excluíveis normalmente; um bloqueio incondicional de exclusão perderia essa flexibilidade sem necessidade real.

### 4.3 Trade-offs aceitos

- Um documento sem aceites pode, entre o momento da consulta de checagem e o `deleteDoc`, receber um aceite concorrente (janela de corrida teórica, extremamente improvável — exigiria um usuário aceitando o documento no exato intervalo entre as duas chamadas do admin). Não é mitigado com transação porque o PO não pediu esse nível de rigor para este bugfix pequeno e isolado, e o cenário é análogo a outras janelas de corrida já aceitas e documentadas no projeto (ex.: `UC-28-RN-02`, geração de código único de consultor).
- A mensagem de bloqueio não diferencia se o bloqueio decorre de 1 ou 1000 aceites — ver alternativa descartada acima.

---

## 5. Mapa de Impacto

### 5.1 Arquivos a CRIAR

N/A — nenhum arquivo novo.

### 5.2 Arquivos a MODIFICAR

| Arquivo | Mudança |
|---|---|
| `src/app/(admin)/admin/legal-documents/page.tsx` | Import: adicionar `where`, `limit` à lista de imports de `firebase/firestore` (linha 9). `handleDelete` (linhas 57-77): adicionar a consulta de checagem em `user_document_acceptances` no início da função, com bloqueio via `return` antecipado (toast destrutivo) quando houver pelo menos um aceite; `deleteDoc` só é alcançado se a consulta não retornar nenhum resultado. |

### 5.3 Arquivos a REMOVER

N/A.

### 5.4 Impacto no Firestore

- **Nenhuma mudança em `firestore.rules`.** A regra dedicada de `user_document_acceptances` (linhas 164-171) já permite `allow read: if isSystemAdmin()` — cobre a nova consulta feita pelo System Admin autenticado nesta tela, sem necessidade de nenhuma alteração.
- **Nenhuma mudança em `firestore.indexes.json` necessária.** A nova consulta é `where('document_id', '==', documentId)` com `limit(1)` — uma igualdade de campo único, sem `orderBy` adicional. Confirmado por comparação com a query já existente e funcional em `src/app/(auth)/accept-terms/page.tsx` (linha 56-59): `query(collection(db, 'user_document_acceptances'), where('user_id', '==', ...))`, também uma igualdade de campo único sem índice composto declarado em `firestore.indexes.json` (verificado — não há nenhuma entrada para `user_document_acceptances` no arquivo). O Firestore mantém índices de campo único automaticamente para toda coleção; nenhuma configuração adicional é necessária para este padrão de query.
- **Nenhuma migração de dados** necessária.

### 5.5 O que NÃO muda

- `loadDocuments()` — sem alteração.
- `getStatusBadge` — sem alteração.
- O `AlertDialog` de confirmação (abertura, texto, botões "Cancelar"/"Excluir") — sem alteração de UI; continua abrindo para qualquer documento, independentemente de ter aceites ou não. O bloqueio ocorre depois da confirmação, dentro de `handleDelete`.
- Fluxo de edição (`LegalDocumentForm`, `admin/legal-documents/[id]/edit`) — sem alteração; permanece a única forma de "desativar" um documento (mudar `status` para `inativo`), sugerida na mensagem de bloqueio.
- `firestore.rules` — nenhuma alteração necessária (ver 5.4).
- `firestore.indexes.json` — nenhuma alteração necessária (ver 5.4).
- Tipos em `src/types/index.ts` (`LegalDocument`, `UserDocumentAcceptance`, `DocumentStatus`) — nenhuma alteração necessária.

---

## 6. Especificação Técnica

### 6.1 Mudanças no modelo de dados

N/A — nenhuma mudança em `LegalDocument` nem em `UserDocumentAcceptance`.

### 6.2 Mudanças em serviços

N/A — não há um service dedicado para `legal_documents`/`user_document_acceptances`; toda a lógica já vive direto em `page.tsx` (mesmo padrão hoje existente, RN-06 do UC-34), e este bugfix mantém esse padrão.

### 6.3 Mudanças na UI

**Arquivo:** `src/app/(admin)/admin/legal-documents/page.tsx`

**Import (linha 9)**, adicionar `where` e `limit`:

```ts
import { collection, query, orderBy, getDocs, deleteDoc, doc, where, limit } from 'firebase/firestore';
```

**`handleDelete` (linhas 57-77), versão completa após a mudança:**

```ts
async function handleDelete() {
  if (!documentToDelete) return;

  try {
    // Bloqueia a exclusão se houver pelo menos um aceite registrado (UC-34, RN-03)
    const acceptancesQuery = query(
      collection(db, 'user_document_acceptances'),
      where('document_id', '==', documentToDelete.id),
      limit(1)
    );
    const acceptancesSnapshot = await getDocs(acceptancesQuery);

    if (!acceptancesSnapshot.empty) {
      toast({
        title: 'Não é possível excluir',
        description:
          'Este documento já foi aceito por pelo menos um usuário e não pode ser excluído, pois isso comprometeria o histórico de auditoria. Use "Editar" e defina o status como "Inativo" para removê-lo de circulação.',
        variant: 'destructive',
      });
      return;
    }

    await deleteDoc(doc(db, 'legal_documents', documentToDelete.id));
    toast({
      title: 'Sucesso',
      description: 'Documento excluído com sucesso',
    });
    loadDocuments();
  } catch (error: any) {
    toast({
      title: 'Erro ao excluir',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  }
}
```

Observação de implementação: o `return` antecipado dentro do `try`, após o toast de bloqueio, ainda passa pelo bloco `finally` (fecha o dialog e limpa `documentToDelete`) — comportamento desejado, idêntico ao que já ocorre hoje em qualquer caminho de saída da função.

### 6.4 Mudanças em API Routes

N/A — não há API route envolvida; toda a leitura/escrita é feita client-side via Firestore Web SDK, respeitando as regras de segurança já existentes (mesmo padrão de RN-06 do UC-34).

---

## 7. Plano de Implementação

### STEP 1 — Adicionar checagem de aceites antes do `deleteDoc`

**Objetivo:** Impedir a exclusão definitiva de um documento legal quando existir pelo menos um registro em `user_document_acceptances` referenciando seu `id`, exibindo uma mensagem clara ao admin.

**Arquivos afetados:**
- `src/app/(admin)/admin/legal-documents/page.tsx`

**Ações:**
1. Adicionar `where` e `limit` ao bloco de import de `firebase/firestore` (linha 9).
2. No início do bloco `try` de `handleDelete` (antes do `deleteDoc` já existente), montar e executar a consulta `where('document_id', '==', documentToDelete.id)` com `limit(1)` sobre `user_document_acceptances`.
3. Se `acceptancesSnapshot.empty === false`, exibir o toast destrutivo "Não é possível excluir" com a mensagem especificada na Seção 6.3 e `return` (sem chamar `deleteDoc`).
4. Se `acceptancesSnapshot.empty === true`, manter o restante da função exatamente como está hoje (`deleteDoc` + toast de sucesso + `loadDocuments()`).
5. **Não alterar** o `AlertDialog` de confirmação, `loadDocuments`, `getStatusBadge` nem qualquer outra função do arquivo.
6. **Não alterar** `firestore.rules` nem `firestore.indexes.json` — ver Seção 5.4.

**Validação:**
- `npm run lint` sem erros.
- `npm run type-check` sem erros.
- `npm run build` sem erros.
- Validação manual (STEP 2) confirma os dois cenários: documento sem aceites (exclui normalmente) e documento com aceite (bloqueado, com a mensagem correta).

**Commit:** `fix(legal-documents): block deletion of documents with existing acceptances`

---

### STEP 2 — Validação manual (obrigatória antes de abrir o PR)

**Objetivo:** Confirmar de ponta a ponta que a exclusão é bloqueada apenas quando há aceites, e continua funcionando normalmente quando não há.

**Roteiro sugerido:**
1. No Firebase Emulator Suite (`firebase emulators:start`) ou em ambiente de teste, criar (ou usar) um documento legal em `legal_documents` que **nunca tenha sido aceito** por ninguém (sem nenhum registro correspondente em `user_document_acceptances`).
2. Logar como `system_admin` e navegar até `/admin/legal-documents`.
3. Clicar no ícone de lixeira do documento sem aceites → confirmar no `AlertDialog`.
4. **Esperado:** toast "Sucesso" / "Documento excluído com sucesso"; o documento some da listagem; `legal_documents/{id}` deixa de existir no Firestore — comportamento idêntico ao atual (sem regressão).
5. Criar (ou usar) um segundo documento legal e gerar pelo menos um registro em `user_document_acceptances` para ele — por exemplo, aceitando-o de fato via `/accept-terms` ou `/clinic/setup/terms` com um usuário de teste (ou inserindo o documento diretamente no emulador, para agilizar).
6. Voltar a `/admin/legal-documents`, clicar no ícone de lixeira desse segundo documento → confirmar no `AlertDialog`.
7. **Esperado:** toast destrutivo "Não é possível excluir" com a mensagem "Este documento já foi aceito por pelo menos um usuário e não pode ser excluído, pois isso comprometeria o histórico de auditoria. Use 'Editar' e defina o status como 'Inativo' para removê-lo de circulação."; `deleteDoc` **não** é chamado; o documento continua aparecendo normalmente na listagem; `legal_documents/{id}` continua existindo no Firestore.
8. Confirmar que o `AlertDialog` fecha corretamente em ambos os cenários (passo 4 e passo 7) e que `documentToDelete` é limpo (o botão de lixeira de outro documento abre o dialog correto na tentativa seguinte).
9. No cenário do passo 7, seguir a sugestão da mensagem: clicar em "Editar" no mesmo documento, mudar "Status" para "Inativo" e salvar — confirmar que a edição funciona normalmente (não é afetada por este bugfix) como alternativa à exclusão.

**Commit:** N/A (validação manual, não gera commit de código).

---

## 8. Estratégia de Testes

| Função / Arquivo | Arquivo de teste | Cenários obrigatórios |
|---|---|---|
| `handleDelete` (`admin/legal-documents/page.tsx`) | Não testar | Função depende diretamente do Firestore Web SDK (`doc`, `deleteDoc`, `query`, `where`, `limit`, `getDocs`) sem abstração injetável — mock frágil, mesmo padrão já adotado no restante do arquivo e nos demais services/pages do projeto (ver `BUGFIX-notification-settings-setdoc.md`, Seção 8; `BUG-consultor-vinculo-automatico.md`). |
| `LegalDocumentsPage` (`page.tsx`) | Não testar | Componente React/page com dependência de Firebase Auth + Firestore — fora do escopo de testes automatizados do MVP (mesmo critério do template padrão do projeto, Seção 8). |

**Conclusão:** Nenhum teste automatizado é necessário para este bugfix. A verificação de correção é feita via validação manual (STEP 2, Seção 7), consistente com o critério do projeto de não testar API routes/componentes React/serviços com dependência direta do Firebase SDK no MVP.

---

## 9. Checklist de Definition of Done

- [ ] `npm run lint` sem erros
- [ ] `npm run type-check` sem erros
- [ ] `npm run build` sem erros
- [ ] `npm run test` sem erros (nenhum teste novo necessário, mas suíte existente não pode quebrar)
- [ ] Multi-tenant: N/A — `legal_documents`/`user_document_acceptances` são coleções globais, sem escopo de `tenant_id` (ver RNF-03)
- [ ] Segurança: nenhuma alteração necessária em `firestore.rules` (regra `allow read: if isSystemAdmin()` de `user_document_acceptances` já cobre a nova consulta); confirmado por leitura das regras (Seção 5.4)
- [ ] Nenhuma alteração necessária em `firestore.indexes.json` (consulta de campo único, sem `orderBy` adicional); confirmado por comparação com query equivalente já existente (Seção 5.4)
- [ ] Branch pessoal (`gscandelari_setup` ou `lhuan_setup`) validada no domínio Firebase pessoal antes do PR para `develop`
- [ ] PR aberto para `develop` (nunca para `master`)
- [ ] Validação manual do STEP 2 executada e documentada no PR (cenário sem aceites exclui normalmente; cenário com aceite é bloqueado com a mensagem correta)
- [ ] Após merge: `uml-use-case-writer` aciona atualização de UC-34 (RN-03 deixa de ser achado; novo fluxo de exceção documentando o bloqueio) e de UC-09 (Fluxo de Exceção 8f e RN-05 passam a refletir que a exclusão agora é bloqueada quando há aceites); `uc-issues-tracker` (Modo B) move `UC-34-RN-03` para "Corrigido e Documentado" em `_MAPA-DE-BUGS-E-MELHORIAS.md`

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Janela de corrida: usuário aceita o documento no intervalo entre a consulta de checagem e o `deleteDoc` | Muito baixa | Baixo | Cenário extremamente improvável (exigiria um aceite concorrente exato durante a fração de segundo entre as duas chamadas de rede do admin). Não mitigado com transação — fora do escopo deste bugfix pequeno e isolado (ver Seção 4.3), consistente com outras janelas de corrida já aceitas no projeto (ex.: `UC-28-RN-02`). |
| Falso positivo: consulta falha silenciosamente (ex.: erro de rede) e é interpretada como "sem aceites", permitindo exclusão indevida | Baixa | Médio | Não se aplica — o `try/catch` da função já captura qualquer exceção lançada por `getDocs` (incluindo a nova consulta) e cai no bloco `catch` existente, que exibe o toast "Erro ao excluir" e **não chama `deleteDoc`** (a exceção interrompe a execução do `try` antes de alcançar aquela linha). Uma falha na consulta de checagem impede a exclusão, nunca a permite indevidamente. |
| Mensagem de bloqueio não é clara o suficiente para o admin entender a alternativa ("desativar") | Baixa | Baixo | Mensagem especificada explicitamente na Seção 6.3, citando o caminho concreto ("Use 'Editar' e defina o status como 'Inativo'"), não apenas uma explicação genérica do motivo. |
| Mudança não corrigir o problema completo se houver alguma outra via de exclusão de `legal_documents` não identificada | Baixa | Médio | Confirmado por busca no código: `deleteDoc` sobre `legal_documents` só é chamado em `handleDelete`, `admin/legal-documents/page.tsx` — nenhuma outra tela, service ou API route exclui documentos legais (RN-06 do UC-34: não há API route dedicada). |

---

## 11. Glossário

| Termo | Definição |
|---|---|
| Hard delete | Exclusão definitiva de um registro do banco de dados (`deleteDoc`), sem manter histórico nem possibilidade de recuperação — diferente de "soft delete" (marcar como inativo/excluído via flag). |
| `user_document_acceptances` | Coleção Firestore que registra cada aceite de documento legal por um usuário (`user_id`, `document_id`, `document_version`, `accepted_at`); imutável por regra (`allow update, delete: if false`). |
| Guard aditivo | Verificação adicionada antes de uma operação já existente, que pode interromper o fluxo (retornar antecipadamente) sem alterar o comportamento da operação original quando a condição de bloqueio não se aplica. |

---

## 12. Referências

- `ONLY_FOR_DEVS/PO_BA_Docs/UC-34-editar-publicar-e-excluir-documento-legal.md` — RN-03 (Seção 9, achado crítico), Fluxo Alternativo 7b (Seção 7, passo 4), item 1 da Seção 14 (decisão de priorizar a correção, opção (a) escolhida).
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-09-aceitar-termos-legais.md` — RN-05 (Seção 9, imutabilidade de `user_document_acceptances`), Fluxo de Exceção 8f (Seção 8, consequência da exclusão permanente).
- `ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md` — Seção 2 (`UC-34-RN-03`, Crítica), Seção 6 (decisão do PO: bloquear exclusão quando houver aceites, opção (a)).
- `src/app/(admin)/admin/legal-documents/page.tsx` — `handleDelete`, `loadDocuments`, `AlertDialog` de confirmação.
- `src/types/index.ts` — `LegalDocument`, `DocumentStatus`, `UserDocumentAcceptance`.
- `firestore.rules` (linhas 155-171) — regras de `legal_documents` e `user_document_acceptances`.
- `firestore.indexes.json` — confirmado ausência de entrada para `user_document_acceptances` (consultas de campo único não exigem índice composto).
- `src/app/(auth)/accept-terms/page.tsx` (linha 56-59) — query de referência (`where('user_id', '==', ...)` sobre `user_document_acceptances`, sem índice composto declarado).

---

## 13. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|---|---|---|---|
| 1.0 | 15/07/2026 | Doc Writer (Claude) | Versão inicial. Spec gerada a partir do item `UC-34-RN-03` do mapa de bugs (decisão do PO já tomada: bloquear exclusão quando houver aceites, opção (a) da Seção 14 do UC-34), com leitura completa de `admin/legal-documents/page.tsx`, `UC-34`, `UC-09` (RN-05), `types/index.ts` e `firestore.rules`/`firestore.indexes.json`. Confirmado que a consulta de checagem (`where('document_id', '==', ...)`, `limit(1)`) não exige novo índice composto, por comparação com query equivalente já existente em `accept-terms/page.tsx`. |
| 1.1 | 16/07/2026 | Guilherme Scandelari | Task concluída — movida para TASK_COMPLETED |
