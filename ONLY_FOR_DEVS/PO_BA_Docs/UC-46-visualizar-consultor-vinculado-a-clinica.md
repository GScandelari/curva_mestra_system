# UC-46: Visualizar Consultor Vinculado à Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Gestão de Clínica / Consultores

**Versão:** 1.2.1

> Um usuário de clínica (`clinic_admin` ou `clinic_user`) consulta, em modo somente-leitura, os dados do consultor atualmente vinculado à sua clínica (código, nome, e-mail, telefone, status). Essa consulta existe em **dois lugares com implementação duplicada e independente**: a aba "Consultor" dentro de `/clinic/my-clinic` (o único caminho acessível por navegação) e a página standalone `/clinic/consultant` (órfã — sem link em nenhum menu). **Atualização (v1.2):** a terceira página, `/clinic/consultant/transfer` (`TransferConsultantPage`) — que estava confirmadamente quebrada (RN-03/RN-04 antigas) — foi **removida** por `feature/consultor-vinculo-convite-transferencia` e substituída por um novo fluxo completo de convite/transferência com aprovação: `/clinic/consultant/invite` (UC-54), agora com um ponto de entrada real a partir de `ConsultantTab` (botão "Convidar Consultor", visível apenas para `clinic_admin`, sem consultor vinculado). RN-03 e RN-04 estão resolvidas; RN-05 permanece parcialmente válida — a nova rota de convite passou a ser linkada, mas a página órfã standalone `/clinic/consultant` continua sem nenhum link de navegação. **Atualização (v1.2.1):** o tratamento de erro silencioso descrito em RN-02 foi corrigido — as duas implementações agora compartilham um hook de busca (`useLinkedConsultant`), que expõe um estado de erro visível.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ClinicUser([👤 Clinic User])

    subgraph Sistema["Curva Mestra"]
        UC46(("UC-46\nVisualizar Consultor\nVinculado à Clínica"))
        UC23(("UC-23\nVincular/Alterar/Remover\nConsultor (System Admin)"))
        UC24(("UC-24\nConsultor se Vincula\nAutomaticamente"))
        UC54(("UC-54\nConvidar Consultor\n(Clinic Admin)"))
    end

    ClinicAdmin --> UC46
    ClinicUser --> UC46
    UC46 -.->|GET, somente leitura,\nvia useLinkedConsultant| API[["/api/tenants/{id}/consultant"]]
    ClinicAdmin -->|"Convidar Consultor"\n(botão no estado vazio)| UC54
    UC23 -.->|única forma real de\nalterar o vínculo sem aprovação| API
    UC24 -.->|consultor se vincula\npelo próprio código| API
    UC54 -.->|vínculo passa a existir\nsomente após aprovação (UC-26)| API
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — nenhuma das duas telas (`ClinicConsultantPage`, `ConsultantTab`) faz qualquer checagem de `claims.role` para a **consulta** em si; ambas renderizam de forma idêntica para os dois roles (a aba "Consultor" em `my-clinic` é a única que não está dentro de um bloco `isAdmin &&`, diferente das abas "Usuários" e "Limite de Estoque"). **[Nota v1.2]** O novo botão "Convidar Consultor", exibido dentro de `ConsultantTab` quando não há consultor vinculado, **é** condicionado a `isAdmin` — é o único elemento desta tela com gate de role, e pertence ao escopo do UC-54, não deste UC de consulta.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum. Os dados exibidos são gravados por processos de outros módulos: **System Admin** (UC-23), o próprio **Consultor** (UC-24, auto-link), ou pela aprovação de uma pendência criada pela clínica (UC-54) ou por outro consultor (UC-25), processada em UC-26.

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido nos custom claims.
- Nenhuma pré-condição sobre a existência de um consultor vinculado — a tela trata corretamente o caso "sem consultor".

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado — este é um caso de uso puramente de consulta.
- Se `tenants/{tenantId}.consultant_id` existir e o documento `consultants/{consultant_id}` correspondente também existir: exibe código (com botão de copiar), nome, e-mail, telefone e um `Badge` de status ("Ativo"/"Inativo", conforme `consultant.status === 'active'`).
- Se não houver consultor vinculado (`consultant_id` ausente, ou o documento do consultor não existir mais): exibe um estado vazio com texto explicativo (o texto varia entre as duas implementações — ver RN-01) e, em `ConsultantTab`, para `clinic_admin`, o botão "Convidar Consultor" (UC-54, RN-01 v1.2).

### 4.2 Falha (Garantias Mínimas)
- **[CORRIGIDO no commit `5cce33c` — UC-46-RN-02]** Se a chamada a `GET /api/tenants/{tenantId}/consultant` falhar: o erro continua sendo registrado via `console.error`, mas agora ambas as implementações exibem um bloco de erro visível ("Não foi possível carregar o consultor vinculado. Tente novamente mais tarde."), em vez de permanecerem no mesmo estado visual do caso de sucesso "sem consultor vinculado".

---

## 5. Gatilho (Trigger)
Usuário navega para `/clinic/my-clinic` (via menu "Minha Clínica" do `ClinicLayout`) e seleciona a aba "Consultor" — único caminho de acesso alcançável por navegação normal. Alternativamente, acesso direto por URL a `/clinic/consultant` (página órfã, sem link).

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário acessa `/clinic/my-clinic` e clica na aba "Consultor" (`ConsultantTab`, renderizada via `dynamic import`).
2. Sistema chama `GET /api/tenants/{tenantId}/consultant` com o token do usuário, através do hook compartilhado `useLinkedConsultant` (`src/hooks/useLinkedConsultant.ts` — ver RN-01/RN-02).
3. API verifica autenticação e permissão: `system_admin`, membro do próprio tenant (`decodedToken.tenant_id === tenantId` — cobre tanto `clinic_admin` quanto `clinic_user`) ou consultor com acesso autorizado.
4. API busca `tenants/{tenantId}`; se `consultant_id` estiver ausente, retorna `{ success: true, data: null }`.
5. Se `consultant_id` existir, API busca `consultants/{consultant_id}` e retorna os campos `id`, `code`, `name`, `email`, `phone`, `status`.
6. Sistema exibe o card "Consultor Atual" com badge de status, código (formatado, com botão de copiar via `navigator.clipboard`), nome, e-mail e telefone.
7. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Nenhum consultor vinculado (a partir do passo 4 ou 5)
1. `consultant_id` ausente no tenant, ou o documento do consultor referenciado não existe mais.
2. Sistema exibe um card de estado vazio: ícone, "Nenhum Consultor Vinculado", e um texto explicativo — que **diverge entre as duas implementações** (ver RN-01). Em `ConsultantTab`, se o usuário for `clinic_admin`, um botão "Convidar Consultor" é exibido, levando a `/clinic/consultant/invite` (UC-54).

### 7b. Usuário copia o código do consultor (a partir do passo 6)
1. Usuário clica no ícone de cópia ao lado do código.
2. Sistema copia o texto via `navigator.clipboard.writeText` e exibe um toast "Código copiado".

### 7c. Acesso à página standalone órfã `/clinic/consultant` (variação do gatilho)
1. Usuário acessa `/clinic/consultant` diretamente por URL (não há link de navegação para esta rota em nenhum lugar do sistema).
2. Comportamento idêntico ao fluxo principal — mesma chamada de API (via o mesmo hook `useLinkedConsultant`, desde o commit `5cce33c`), mesma estrutura visual, com pequenas diferenças de texto (RN-01). **[v1.2]** Esta implementação **não** recebeu o novo botão "Convidar Consultor" — apenas `ConsultantTab` (a única alcançável por navegação real) ganhou esse ponto de entrada (RN-05).

### 7d. Clinic Admin clica em "Convidar Consultor" (a partir de 7a, v1.2 — pertence ao escopo de UC-54)
1. Sistema navega para `/clinic/consultant/invite`.
2. A partir daqui, o fluxo passa a ser o de UC-54 — fora do escopo deste UC de consulta.

---

## 8. Fluxos de Exceção

### 8a. [CORRIGIDO no commit `5cce33c`] Falha na chamada de API (a partir do passo 2)
1. `fetch` lança exceção, ou a API retorna erro.
2. Sistema registra o erro via `console.error('Erro ao carregar dados do consultor:', error)` **e** exibe um bloco de erro visível ("Não foi possível carregar o consultor vinculado. Tente novamente mais tarde."), através do hook compartilhado `useLinkedConsultant` (ver RN-02). **Nota histórica:** antes desta correção, `consultant` permanecia `null` e a tela renderizava o mesmo estado vazio do fluxo 7a, sem nenhuma indicação de que uma falha havia ocorrido.

### 8b. [RESOLVIDO em v1.2] Usuário tenta usar "Vincular Consultor" via `/clinic/consultant/transfer`
1. **[Confirmado resolvido]** A página `/clinic/consultant/transfer` (`TransferConsultantPage`) foi **removida** por `feature/consultor-vinculo-convite-transferencia` — confirmado por ausência do arquivo no repositório e por grep de `clinic/consultant/transfer` em todo `src/` (zero ocorrências). O comportamento quebrado descrito nas versões anteriores deste documento (chamada a `POST /api/tenants/{tenantId}/consultant`, sempre 403 para usuários de clínica) **não existe mais** — não há como reproduzi-lo, pois a rota `/clinic/consultant/transfer` retorna 404 do próprio App Router.
2. O fluxo que a substitui — `/clinic/consultant/invite`, chamando `POST /api/tenants/{tenantId}/consultant/invite` (uma rota nova, distinta de `POST /api/tenants/[id]/consultant`) — está descrito em UC-54, fora do escopo deste UC de consulta.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Duplicação de código confirmada, inalterada]** `ClinicConsultantPage` (`/clinic/consultant/page.tsx`) e `ConsultantTab` (`/components/clinic/ConsultantTab.tsx`, usada em `my-clinic`) continuam praticamente idênticas na parte de **consulta** — mesma estrutura JSX, mesmos componentes — diferindo no texto do estado vazio. **[v1.2]** A partir desta feature, as duas implementações também divergem em funcionalidade, não só em texto: apenas `ConsultantTab` ganhou o botão "Convidar Consultor" (condicionado a `isAdmin`), pois é a única alcançável por navegação real (RN-05). **Nota v1.2.1:** desde o commit `5cce33c`, a parte de **busca de dados** (fetch, loading, erro) das duas implementações passou a ser compartilhada através do hook `useLinkedConsultant` (`src/hooks/useLinkedConsultant.ts`) — reduzindo, mas não eliminando, a duplicação: a estrutura JSX de cada tela (cards, textos, botão de convite) continua sendo duas implementações independentes. | Confirmado por leitura lado a lado de `ClinicConsultantPage` e `ConsultantTab` (v1.2.1) — ambas agora chamam `useLinkedConsultant()` para obter `consultant`/`loading`/`error`, mas mantêm blocos JSX próprios e independentes. |
| RN-02 | **[CORRIGIDO no commit `5cce33c` — UC-46-RN-02]** Falhas na busca do consultor (rede, permissão, erro do servidor) agora são tratadas de forma visível ao usuário — ambas as implementações passaram a usar o novo hook compartilhado `useLinkedConsultant` (`src/hooks/useLinkedConsultant.ts`, extraído no mesmo lote para eliminar a duplicação do padrão loading/error entre esta tela, UC-41 e UC-49; o hook, por sua vez, reaproveita `useAsyncState`), que expõe um `error` renderizado em um bloco visível antes dos cards de dados. Esse mesmo hook, ao centralizar o fetch em um único lugar, também resolve a duplicação de código da busca de dados em si (efeito colateral relacionado a RN-01 — RN-01 permanece aberta, pois a estrutura visual de cada tela ainda é independente). **Nota histórica:** até esta correção, o `catch` de ambas as implementações apenas logava no console e mantinha `consultant: null`, sem nenhum estado de erro visível ao usuário — indistinguível do caso "sem consultor vinculado". | Confirmado por leitura de `useLinkedConsultant` (`src/hooks/useLinkedConsultant.ts`) e do seu uso idêntico em `ConsultantTab.tsx` e `ClinicConsultantPage` (`clinic/consultant/page.tsx`) — ambas agora renderizam `error` em um bloco `text-destructive` antes do conteúdo normal. |
| RN-03 | **[RESOLVIDO em v1.2 — antes "achado crítico"]** A página `/clinic/consultant/transfer`, que pretendia permitir que a própria clínica buscasse um consultor por código de 6 dígitos e o vinculasse diretamente via `POST /api/tenants/{id}/consultant` (rota que só autoriza `system_admin` ou o próprio consultor autenticado, sempre 403 para clínica), foi **removida**. O código correspondente não existe mais no repositório (confirmado por `test -f` e por grep exaustivo de `clinic/consultant/transfer` em `src/` — zero ocorrências). Substituída por `/clinic/consultant/invite` (UC-54), que usa uma rota nova e correta (`POST /api/tenants/{id}/consultant/invite`, que aceita `clinic_admin` do próprio tenant) e um fluxo **com aprovação** do consultor convidado, em vez de vínculo direto. | Confirmado pela ausência do arquivo `src/app/(clinic)/clinic/consultant/transfer/page.tsx` e por grep de `clinic/consultant/transfer` em todo `src/` — nenhuma ocorrência, nem em código nem em referências de navegação. |
| RN-04 | **[RESOLVIDO em v1.2]** O achado de gate de role invertido (`TransferConsultantPage` redirecionava `clinic_admin` para fora da página, mas não fazia o mesmo para `clinic_user`, permitindo que o role tipicamente mais restrito acessasse um formulário inútil) deixou de existir junto com a remoção da página. A nova tela `/clinic/consultant/invite` (UC-54) inverte corretamente o gate: `clinic_user` é que é redirecionado para fora, e `clinic_admin` é quem tem acesso — alinhado ao padrão do restante do módulo "Minha Clínica". | Confirmado pela ausência do arquivo antigo e por leitura de `src/app/(clinic)/clinic/consultant/invite/page.tsx` — `useEffect` redireciona `role === 'clinic_user'` para `/clinic/my-clinic?tab=consultant` (RN-08 da spec de implementação). |
| RN-05 | **[Parcialmente mitigada em v1.2]** Nenhuma das duas telas de consulta (`/clinic/consultant` nem a aba "Consultor" em `/clinic/my-clinic`) aparece em `navLinks` do `ClinicLayout` como entrada própria — o único caminho de navegação real continua sendo `/clinic/my-clinic` → aba "Consultor". **[Novidade v1.2]** A partir desta feature, `/clinic/consultant/invite` (UC-54) passou a ser alcançável por navegação real **a partir de dentro** de `ConsultantTab` (botão "Convidar Consultor" no estado vazio, apenas para `clinic_admin`) — deixando de ser uma rota "só por URL direta", diferente do que ocorria com a extinta `/clinic/consultant/transfer`. A página órfã standalone `/clinic/consultant` **continua** sem nenhum link de navegação, inclusive sem o novo botão de convite (RN-01) — sua unificação/remoção permanece fora de escopo. | Confirmado por leitura de `ClinicLayout.tsx` (`navLinks`) — inalterado, nenhuma entrada nova; e de `ConsultantTab.tsx` — novo `<Link href="/clinic/consultant/invite">` dentro do card de estado vazio. |
| RN-06 | **[Inalterada]** A API `GET /api/tenants/{id}/consultant` restringe leitura a `system_admin`, membros do próprio tenant (`clinic_admin`/`clinic_user`, via `decodedToken.tenant_id === tenantId`) ou o consultor com acesso autorizado — garantindo isolamento multi-tenant real (via Admin SDK, não apenas regra do Firestore, já que esta chamada não passa pelo client SDK). | Confirmado por leitura de `GET`, linhas 31-39 de `api/tenants/[id]/consultant/route.ts` — rota não alterada por esta feature. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Duplicação de código entre `ClinicConsultantPage` e `ConsultantTab` (RN-01) — risco de manutenção: uma correção/funcionalidade aplicada a uma implementação pode não ser replicada na outra, como confirmado nesta própria revisão (o botão "Convidar Consultor" só foi adicionado a `ConsultantTab`). **[Nota v1.2.1]** A extração de `useLinkedConsultant` (RN-02) elimina esse risco especificamente para a camada de busca de dados/erro — qualquer correção futura ao fetch/tratamento de erro passa a valer para as duas telas automaticamente. | Manutenibilidade |
| RNF-02 | Multi-tenant garantido via Admin SDK na própria API route (RN-06), não apenas por regra do Firestore, já que a leitura passa por uma API route em vez de acesso direto ao client SDK. | Multi-tenant / Segurança |
| RNF-03 | **[CORRIGIDO no commit `5cce33c` — RN-02]** Ausência de qualquer feedback de erro ao usuário em caso de falha de rede/permissão foi corrigida — ambas as implementações agora exibem um bloco de erro visível via `useLinkedConsultant`. | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — consulta pontual do usuário da clínica para conferir ou compartilhar o código/dados do consultor vinculado.

---

## 12. Casos de Uso Relacionados
- **UC-23 (Vincular, Alterar, Remover Consultor da Clínica)** — caminho funcional do lado do System Admin para alterar o vínculo exibido aqui, sem etapa de aprovação.
- **UC-24 (Vincular-se Automaticamente a uma Clínica Sem Consultor)** — caminho funcional do lado do próprio consultor para se vincular a uma clínica sem consultor, sem etapa de aprovação.
- **UC-25 (Solicitar Transferência de Clínica Já Vinculada)** e **UC-26/UC-27 (Aprovar/Rejeitar)** — caminho **com** aprovação, iniciado pelo consultor, para uma clínica que já tem consultor.
- **UC-54 (Convidar Consultor para a Clínica)** — **[Novo em v1.2]** caminho **com** aprovação, iniciado pela própria clínica (`clinic_admin`), agora com ponto de entrada real a partir desta tela (`ConsultantTab`, estado vazio) — resolve a lacuna que RN-03/RN-04 antigas documentavam como quebrada.
- **UC-45 (Completar Configuração Inicial da Clínica)** — outro exemplo, no mesmo módulo Clinic, de tela sem gate de role entre `clinic_admin`/`clinic_user` (para a parte de consulta deste UC).
- **UC-41 (Editar Perfil e Trocar Senha do Usuário de Clínica)** e **UC-49 (Visualizar Perfil Próprio do Consultor)** — **[Novo, v1.2.1]** compartilham, desde o commit `5cce33c`/PR #354, o hook `useAsyncState` (base de `useLinkedConsultant`) usado para padronizar o tratamento de erro (RN-02).

---

## 13. Referências
- `src/app/(clinic)/clinic/consultant/page.tsx` (`ClinicConsultantPage` — página órfã; passou a usar `useLinkedConsultant` no commit `5cce33c`)
- `src/components/clinic/ConsultantTab.tsx` (implementação usada em `my-clinic`; ganhou o botão "Convidar Consultor" em v1.2; passou a usar `useLinkedConsultant` no commit `5cce33c`)
- `src/hooks/useLinkedConsultant.ts` (novo hook compartilhado de busca do consultor vinculado, commit `5cce33c` — RN-01/RN-02)
- `src/hooks/useAsyncState.ts` (hook de loading/error reaproveitado por `useLinkedConsultant`)
- `src/app/(clinic)/clinic/my-clinic/page.tsx` (montagem da aba "Consultor", sem gate `isAdmin` para a consulta em si)
- `src/app/api/tenants/[id]/consultant/route.ts` (`GET`, `POST`, `DELETE` — inalterada por esta feature)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — ausência de link para `/clinic/consultant*`, inalterado)
- `src/app/(clinic)/clinic/consultant/invite/page.tsx` (novo ponto de entrada — UC-54)
- `ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-unificacao-vinculo-transferencia-consultor.md` (spec de implementação — confirma remoção de `TransferConsultantPage` e criação da nova tela)
- `ONLY_FOR_DEVS/PO_BA_Docs/UC-54-convidar-consultor-para-clinica-sem-vinculo.md` (novo UC do fluxo que substitui `/clinic/consultant/transfer`)
- Commit da correção: `5cce33c` (`fix(ui): exibe erro visível ao falhar carregamento de perfil/consultor`), PR #354 (branch `chore/patch-10-correcoes-baixa-severidade`), release v1.11.0 — extrai `useLinkedConsultant`, expondo erro visível nas duas implementações (RN-02)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto/bugs pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. ~~**[DECISÃO TOMADA, AGUARDANDO IMPLEMENTAÇÃO]** RN-03/RN-04 — decisão de produto: remover `/clinic/consultant/transfer` e substituí-la por um fluxo novo e mais completo de convite/transferência com aprovação.~~ **[IMPLEMENTADO em v1.2]** `/clinic/consultant/transfer` foi removida; `/clinic/consultant/invite` (UC-54) está em produção, com ponto de entrada real a partir de `ConsultantTab`. RN-03/RN-04 resolvidas.
2. **[Achado, requer decisão]** RN-01 — unificar `ClinicConsultantPage` e `ConsultantTab` em um único componente compartilhado, e decidir manter apenas um dos dois pontos de entrada (a página standalone, já órfã e agora também funcionalmente defasada — não recebeu o botão de convite —, é candidata a remoção)? **Nota v1.2.1:** a camada de busca de dados já foi unificada via `useLinkedConsultant` (RN-02); a unificação pendente aqui é apenas da estrutura JSX/visual das duas telas. Ainda não confirmado se há uma spec cobrindo esta unificação. **Não resolvido nesta revisão.**
3. ~~**[Achado, requer decisão]** RN-02 — vale conectar tratamento de erro visível (toast/alert) nas duas implementações, hoje silenciosas?~~ **[RESOLVIDO no commit `5cce33c` — UC-46-RN-02]** As duas implementações agora exibem um bloco de erro visível, via o novo hook compartilhado `useLinkedConsultant`.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ClinicConsultantPage`, `ConsultantTab`, `my-clinic/page.tsx`, `TransferConsultantPage` e `api/tenants/[id]/consultant/route.ts` (GET/POST/DELETE), além de `ClinicLayout.tsx` (navLinks). Confirmada duplicação de código entre as duas implementações de visualização (RN-01) e identificado achado crítico: a página `/clinic/consultant/transfer` — que pretende permitir à clínica vincular um consultor por código — está completamente quebrada, pois a API que ela chama rejeita qualquer usuário de clínica, aceitando apenas `system_admin` ou o próprio consultor autenticado (RN-03), com uma inversão adicional de gate de role que bloqueia `clinic_admin` mas permite `clinic_user` acessar o formulário inútil (RN-04). |
| 1.1 | 18/07/2026 | Guilherme Scandelari | Seção 14 (item 1) atualizada: decisão de produto tomada para RN-03/RN-04 — remover `/clinic/consultant/transfer` e substituí-la por um fluxo novo de convite/transferência com aprovação, conforme spec `ONLY_FOR_DEVS/TO_DO/FEAT-unificacao-vinculo-transferencia-consultor.md` (v1.1, ainda não implementada). Seção 13 ganhou referência à spec; Seção 1 (diagrama), Seção 9 (RN-03/RN-04) e Fluxo de Exceção 8b anotados com a mesma nota de status, sem alterar a descrição do comportamento atual (as-is). Nenhuma mudança de código refletida — RN-03/RN-04 continuam descrevendo o comportamento vigente até a implementação. |
| 1.2 | 13/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Revisão pós-implementação de `feature/consultor-vinculo-convite-transferencia`: RN-03 e RN-04 marcadas como **resolvidas** — `TransferConsultantPage` removida (confirmado por ausência do arquivo e grep exaustivo de `clinic/consultant/transfer` em `src/`). Fluxo de Exceção 8b reescrito para refletir a remoção. Novo ponto de entrada `/clinic/consultant/invite` (UC-54) documentado a partir de `ConsultantTab` (botão "Convidar Consultor", estado vazio, apenas `clinic_admin` — RN-01 atualizada). RN-05 atualizada para "parcialmente mitigada": a nova rota de convite passou a ter navegação real, mas `/clinic/consultant` (página órfã) continua sem link. Seções 1 (diagrama), 2, 4, 7 (novo 7d), 12, 13 e 14 atualizadas. Item 1 da Seção 14 marcado como implementado. |
| 1.2.1 | 04/10/2026 | Guilherme Scandelari (via uml-use-case-writer) | **Fechamento de RN-02 (severidade Baixa), commit `5cce33c`, PR #354 (branch `chore/patch-10-correcoes-baixa-severidade`), release v1.11.0.** `ClinicConsultantPage` e `ConsultantTab`, antes duas implementações independentes do fetch do consultor vinculado, passaram a compartilhar o novo hook `src/hooks/useLinkedConsultant.ts` (que reaproveita `useAsyncState`, também usado por UC-41 e UC-49) — expondo um `error` visível quando `GET /api/tenants/{tenantId}/consultant` falha, em vez de permanecerem indistinguíveis do estado "sem consultor vinculado". Efeito colateral registrado em RN-01 (duplicação da camada de fetch eliminada), sem fechar RN-01 em si — a estrutura JSX das duas telas continua sendo duas implementações independentes. Atualizados Pós-condição 4.2, Fluxo Principal (passo 2), Fluxo Alternativo 7c, Fluxo de Exceção 8a (marcado `[CORRIGIDO]`), RN-01 (nota de efeito colateral), RN-02 (marcada `[CORRIGIDO]`), RNF-01/RNF-03, Casos de Uso Relacionados (Seção 12), Referências (Seção 13) e item 3 da Seção 14 (marcado `[RESOLVIDO]`). |
