# UC-05: "Aprovar Solicitação de Acesso" pela Própria Clínica (Clinic Admin) — Candidato à Descontinuação

**Projeto:** Curva Mestra
**Data de Criação:** 13/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Em Revisão
**Módulo/Contexto:** Administração da Clínica
**Versão:** 2.2

> ⚠️ **Reclassificação (v2.0):** este documento deixou de tratar UC-05 como "um design pretendido que está quebrado na implementação". O usuário esclareceu que **o `clinic_admin` não precisa aprovar nenhuma solicitação de acesso para a própria clínica** — o mecanismo real e válido para adicionar usuários a uma clínica existente é a **criação direta de usuário pelo `clinic_admin`** (fluxo "Criar Usuário da Clínica", telas `clinic/users/page.tsx` + `POST /api/users/create` — ainda não mapeado como UC formal nesta documentação). A tela `clinic/access-requests/page.tsx` e seu botão "Aprovar" são, portanto, **candidatos a serem conceitualmente desnecessários/equivocados**, não apenas uma implementação com bugs — no mesmo espírito do que foi encontrado com o antigo fluxo `/activate` (UC-01, histórico de versões). Este documento mantém a estrutura do template, mas com o propósito de registrar evidências técnicas dessa hipótese e levar a decisão de descontinuação (ou não) ao produto, na seção 14 — **a decisão em si não foi tomada aqui.**

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])

    subgraph Sistema["Curva Mestra"]
        UC05(("UC-05\n\"Aprovar Solicitação\"\npela Própria Clínica\n⚠️ candidato à descontinuação"))
        UCCriarUsuario(("UC não mapeado\nCriar Usuário\nda Clínica (clinic_admin)"))
        UC39(("UC-39\nCriar Usuário Diretamente\npara Clínica (System Admin)"))
    end

    ClinicAdmin -.->|botão existe na tela, mas evidências indicam que\nprovavelmente nunca funcionou nem foi usado| UC05
    ClinicAdmin -->|caminho real e válido para adicionar usuários hoje| UCCriarUsuario
    UCCriarUsuario -.->|mesma rota POST /api/users/create,\nsem tenant_id_override| UC39
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** (`role: "clinic_admin"`) — administrador de uma clínica específica. É o ator nominal desta tela (quem veria e clicaria o botão "Aprovar" em `/clinic/access-requests`), mas as evidências reunidas neste documento (seção 8 e RN-01 a RN-04) sugerem que, na prática, o `clinic_admin` gerencia a entrada de novos usuários na própria clínica por outro caminho — a criação direta de usuário (`clinic/users/page.tsx`), não por esta tela de "aprovação de solicitação".

### 2.2 Atores Secundários / Sistemas Externos
Nenhum de fato acionado hoje. Firebase Auth (Admin SDK) e a fila `email_queue` seriam necessários caso esta tela algum dia viesse a aprovar algo de verdade, mas nunca são alcançados na prática (ver seção 8).

---

## 3. Pré-condições
- Clinic Admin autenticado, com `claims.role === "clinic_admin"` e `claims.tenant_id` definido.
- Existiria, em tese, uma solicitação com `status: "pendente"` vinculada ao `tenant_id` da própria clínica — **mas isso não ocorre hoje na prática** (RN-03): nenhuma tela viva do sistema cria uma `access_request` já vinculada a um tenant existente.

---

## 4. Pós-condições

### 4.1 "Sucesso" (nunca observado na prática — mantido apenas para registrar o que o código tenta expressar)
- Se a lista não estivesse sempre vazia (RN-03) e a função de aprovação não estivesse depreciada (RN-02), um usuário seria criado no Firebase Auth e vinculado ao tenant existente, análogo a UC-02. **Nenhuma evidência no código confirma que isso já tenha ocorrido de fato** — ver seção 8 e 14.

### 4.2 Falha (este é o único caminho observável hoje, quando alcançado)
- Nenhum usuário é criado; a solicitação (nos raros casos em que existisse) permanece `"pendente"`.
- Um toast de erro é exibido ao Clinic Admin, com a mensagem literal de uma função depreciada.

---

## 5. Gatilho (Trigger)
O Clinic Admin clica em "Aprovar" na linha de uma solicitação pendente, na tela `/clinic/access-requests` — evento que, pelas evidências reunidas (seção 8), dificilmente ocorre hoje, já que a lista de solicitações normalmente está vazia.

---

## 6. Fluxo Principal (Basic Flow)

> Este fluxo descreve o que o código **tenta** fazer, mantido por completude e rastreabilidade — não uma recomendação de fluxo de negócio. Ver seção 8 para o comportamento real e a evidência de que os passos 5 em diante raramente ou nunca são alcançados.

1. Clinic Admin acessa `/clinic/access-requests`.
2. Sistema tenta carregar as solicitações pendentes vinculadas ao `tenant_id` da própria clínica — **na prática, esta lista está normalmente vazia** (RN-03), pois nenhum mecanismo ativo do sistema cria solicitações vinculadas a um tenant existente.
3. Sistema exibe cards de contagem (pendentes, vagas disponíveis, usuários ativos — este último calculado incorretamente, ver RN-04) e a tabela de solicitações (normalmente vazia).
4. **[Cenário hipotético, não observado]** Se excepcionalmente existisse uma solicitação pendente e o Clinic Admin clicasse em "Aprovar": o sistema chamaria `approveAccessRequest()`, que está marcada `DEPRECATED` no código-fonte e sempre retorna `{ success: false }` (RN-02) — nenhum usuário seria criado, nenhuma solicitação seria de fato aprovada.
5. Na prática, o caso de uso quase sempre termina no Fluxo Alternativo 7a (nenhuma solicitação pendente) — a tela é, para todos os efeitos observáveis, uma lista permanentemente vazia com um botão que, historicamente, não parece ter tido chance de ser clicado com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Nenhuma solicitação pendente (a partir do passo 2) — **estado normal/quase permanente desta tela**
1. Sistema exibe o estado vazio: "Nenhuma solicitação pendente", "Não há pedidos de acesso no momento".
2. Caso de uso é encerrado sem ação disponível.

### 7b. Sem vagas disponíveis, segundo o cálculo (hipotético — ver RN-04)
1. `limits.available_slots <= 0`, segundo `getTenantLimits()` — cálculo que tem um bug confirmado (RN-04), então este caminho nunca é alcançado na prática hoje (o cálculo sempre reporta vagas cheias de espaço, nunca esgotadas).
2. Sistema exibe toast destructive: "Limite atingido" / "Sua clínica atingiu o limite de usuários. Entre em contato com o suporte."
3. Caso de uso é encerrado sem ação.

---

## 8. Fluxos de Exceção — Evidências Técnicas de que este Botão Provavelmente Nunca Funcionou nem Foi Usado

### 8a. `approveAccessRequest()` está depreciada e sempre falha
1. A função (marcada `DEPRECATED` no código-fonte, `accessRequestService.ts`, linhas ~199-211) sempre retorna `{ success: false, message: "Esta função foi depreciada. Use a API route /api/access-requests/[id]/approve." }` — independentemente da solicitação, do tenant ou de qualquer outro dado.
2. Ou seja: mesmo nos raros casos em que uma solicitação pendente existisse e tivesse vagas, clicar em "Aprovar" **nunca** produziria um resultado positivo, para nenhum usuário, em nenhuma circunstância. Não há um único caminho de código que leve ao sucesso.

### 8b. `getTenantLimits()` conta usuários na subcoleção errada do Firestore
1. `getTenantLimits(tenantId)` conta usuários ativos consultando a subcoleção `tenants/{tenantId}/users` — mas nenhum outro lugar do sistema escreve documentos nessa subcoleção; usuários reais ficam na coleção raiz `users`, filtrada por `tenant_id` (confirmado em `clinicUserService.ts`, em `approve/route.ts` de UC-02, e em `POST /api/users/create`, que usa corretamente `adminDb.collection('users').where('tenant_id', '==', tenantId)`).
2. `current_users` é, portanto, sempre `0`, e `available_slots` é sempre igual a `max_users`. O card "Vagas Disponíveis" desta tela nunca refletiu o uso real da clínica.

### 8c. Nenhuma solicitação pendente vinculada a um tenant existente jamais chega a existir
1. Esta tela depende de `listAccessRequests({ status: "pendente", tenant_id })` para popular a lista.
2. Nenhuma tela viva do sistema cria uma `access_request` com `tenant_id` já apontando para uma clínica existente — a única função que faria essa correspondência por CNPJ/documento (`accessRequestService.createAccessRequest()`) é código morto, nunca chamado por nenhuma página (confirmado por busca em todo o `src/`).
3. **A combinação de 8a + 8b + 8c** é o núcleo da evidência reunida neste documento: mesmo que 8a e 8b fossem corrigidas isoladamente, 8c garante que a tela continuaria sem nenhuma solicitação real para processar — reforçando a hipótese de que esta tela é vestigial (talvez um remanescente de uma versão anterior do produto, anterior ao mecanismo real de "Criar Usuário da Clínica", e nunca removida).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O mecanismo real e válido, hoje, para um `clinic_admin` adicionar um usuário à própria clínica é a criação direta de usuário (`POST /api/users/create`, a partir de `clinic/users/page.tsx`) — que **corretamente** conta usuários na coleção raiz `users` filtrada por `tenant_id` e bloqueia a criação ao atingir `max_users`. Este mecanismo **não passa** por `access_requests` em nenhum momento. Esta é exatamente a mesma rota de backend usada pelo System Admin em **UC-39**, distinguida apenas pela ausência do parâmetro `tenant_id_override` (o `clinic_admin` só consegue criar usuários para o próprio `tenant_id`, obtido do seu token). | Confirmado por leitura direta de `api/users/create/route.ts` — esclarecido pelo usuário como o caminho de produto correto, tornando o fluxo de "aprovar solicitação" (este UC) desnecessário para esse objetivo. |
| RN-02 | `approveAccessRequest()` (chamada por esta tela) está marcada `DEPRECATED` no código-fonte e sempre retorna `success: false` — nenhuma lógica de aprovação real é executada quando o `clinic_admin` clica em "Aprovar". | Bug confirmado por leitura direta do código — evidência de que este caminho nunca foi finalizado/mantido. |
| RN-03 | Não existe hoje nenhum mecanismo ativo na UI que crie uma `access_request` pendente já vinculada ao `tenant_id` de uma clínica existente — a função que faria essa correspondência por CNPJ/documento (`accessRequestService.createAccessRequest()`) é código morto. | Reforça a hipótese de que este fluxo nunca foi (ou deixou de ser) o caminho real de produto — mesma causa-raiz documentada em UC-03 (seção 14). |
| RN-04 | `getTenantLimits()` calcula `current_users` a partir de uma consulta à subcoleção `tenants/{tenantId}/users`, nunca escrita por nenhum fluxo do sistema. Por isso, `current_users` é sempre `0` e `available_slots` é sempre igual a `max_users` nesta tela. | Bug confirmado por leitura direta do código — não é uma regra de negócio pretendida, é um defeito de implementação (consulta ao caminho errado no Firestore), e mais uma evidência de abandono deste fluxo. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Esta tela está sob o layout de clínica, restrita a `clinic_admin` (ver `ProtectedRoute`, UC-04). | Segurança |
| RNF-02 | O card "Vagas Disponíveis" desta tela exibe um número (`available_slots`) que está sempre incorreto (RN-04) — nunca reflete o uso real da clínica. | Confiabilidade |

---

## 11. Frequência de Uso
Provavelmente **zero historicamente**, não apenas "zero hoje" — a combinação dos três problemas confirmados (RN-02 a RN-04) sugere que este botão nunca produziu um resultado de sucesso desde que existe. Reforça a hipótese de vestígio de uma versão anterior do produto.

---

## 12. Casos de Uso Relacionados
- **UC-02 (Aprovar Solicitação de Acesso, System Admin)** é o caso de uso do qual este UC-05 parecia, à primeira vista, ser uma variante — mas o esclarecimento do usuário indica que essa simetria não corresponde à intenção real de produto.
- **UC-03 (Rejeitar Solicitação de Acesso)** já documenta `clinic_admin` como ator secundário na mesma tela (`/clinic/access-requests`) — a rejeição funciona corretamente ali (não depende de tenant/documento), diferente desta aprovação.
- **UC-40 (Criar Usuário para a Própria Clínica)** — agora mapeado — é o "Criar Usuário da Clínica" citado nas versões anteriores deste documento: `clinic/users/page.tsx` (e a aba "Usuários" de `clinic/my-clinic/page.tsx`) + `POST /api/users/create`, sem `tenant_id_override`, é o mecanismo real e válido, pelo próprio `clinic_admin`, para adicionar usuários à sua clínica. UC-40 também confirma um achado adicional: este é o **único** ponto de gestão de usuários do `clinic_admin` — não existe, do lado da clínica, nenhuma forma de editar, desativar/reativar ou redefinir senha de um usuário já existente (pendência registrada na seção 14 de UC-40).
- **UC-39 (Criar Usuário Diretamente para uma Clínica via Painel Admin)** — é o equivalente exato do mecanismo de UC-40, mas acionado pelo **System Admin** a partir de `admin/tenants/[id]/page.tsx`, com `tenant_id_override`, para qualquer clínica do sistema. UC-39 e UC-40 compartilham a mesma rota de backend (`POST /api/users/create`), reforçando ainda mais a conclusão deste documento de que a criação direta de usuário — não a "aprovação de solicitação" — é o mecanismo real de produto, seja pelo `clinic_admin` da própria clínica, seja pelo System Admin em nome de qualquer clínica.

---

## 13. Referências
- `src/app/(clinic)/clinic/access-requests/page.tsx`
- `src/lib/services/accessRequestService.ts` (`approveAccessRequest` — depreciada; `getTenantLimits` — bug confirmado; `createAccessRequest` — código morto)
- `src/app/api/access-requests/[id]/approve/route.ts` (UC-02 — mecanismo diferente, sempre cria tenant novo)
- `src/app/(clinic)/clinic/users/page.tsx` e `src/app/api/users/create/route.ts` — **mecanismo real e válido**, segundo esclarecimento do usuário, para adicionar usuários à própria clínica; mesma rota documentada, do lado do System Admin, em UC-39
- `src/lib/services/clinicUserService.ts` (confirma onde usuários reais são armazenados: coleção raiz `users`, filtrada por `tenant_id`)
- `src/types/index.ts` (interfaces `AccessRequest`, `TenantLimits`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

**[Decisão de produto pendente — a mais importante deste documento]** Diante das evidências reunidas (RN-01 a RN-04, seção 8), há duas alternativas para a tela `/clinic/access-requests` e seu botão "Aprovar" pelo `clinic_admin`, e o usuário ainda não escolheu uma:

- **(a) Remover** a tela/botão de aprovação do `clinic_admin` (mantendo apenas a rejeição, que já confirmamos funcionar corretamente — UC-03 expandido), consolidando o caminho de adição de usuários exclusivamente no mecanismo "Criar Usuário da Clínica"; ou
- **(b) Implementar de fato** o mecanismo de aprovação de solicitação pela própria clínica, **se houver algum motivo de negócio ainda não explicado** (ex.: um fluxo de auto-cadastro de `clinic_user` que precise de aprovação do próprio `clinic_admin`, distinto da criação direta feita pelo admin) — nesse caso, seria necessário corrigir RN-02, RN-03 e RN-04 e desenhar como uma solicitação chegaria a esta tela.

Este documento não assume nenhuma das duas — apenas reúne a evidência técnica que embasa a decisão.

**[Pendência secundária, caso a opção (b) seja escolhida]** Se o mecanismo vier a ser implementado, o `role` atribuído ao novo usuário (`clinic_user`, presumivelmente) e a rota/lógica exata de aprovação precisariam ser definidos — nada disso está especificado hoje em lugar nenhum do código.

**[Nota de rastreabilidade — resolvida em v2.2]** O fluxo real "Criar Usuário da Clínica" (`clinic/users/page.tsx` + a aba "Usuários" de `clinic/my-clinic/page.tsx`, ambos via `POST /api/users/create`) foi mapeado formalmente como **UC-40 (Criar Usuário para a Própria Clínica)**. O equivalente exato do lado do **System Admin** (mesma rota, com `tenant_id_override`, a partir de `admin/tenants/[id]/page.tsx`) havia sido mapeado anteriormente como **UC-39**. UC-40 também levanta uma pendência própria (não coberta por este UC-05): a ausência total de qualquer forma de editar/desativar/redefinir senha de usuários já existentes pelo lado do `clinic_admin` — ver seção 14 de UC-40.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 13/07/2026 | Guilherme Scandelari | Versão inicial. Documentou o Fluxo Principal como o comportamento **pretendido/projetado** (simétrico a UC-02, mas adicionando o usuário à clínica já existente em vez de criar um tenant novo), com três problemas confirmados por leitura direta do código destacados em Fluxos de Exceção e Regras de Negócio. |
| 2.0 | 13/07/2026 | Guilherme Scandelari | **Reclassificação major**, motivada por esclarecimento do usuário: este UC não representa um design pretendido e quebrado, e sim um **candidato a mecanismo conceitualmente desnecessário/equivocado** — o caminho real para o `clinic_admin` adicionar usuários à própria clínica é a criação direta de usuário (`clinic/users/page.tsx` + `POST /api/users/create`, confirmado como funcional e correto, inclusive na contagem de usuários por `tenant_id`), não a aprovação de uma "solicitação de acesso". Documento reestruturado: título e blockquote reclassificam o UC; Fluxo Principal e Pós-condições deixaram de descrever um "comportamento pretendido" e passaram a descrever o que o código tenta fazer, sem recomendá-lo; seção 8 (Fluxos de Exceção) reorganizada como "evidências técnicas" de que o botão provavelmente nunca funcionou nem foi usado; Regras de Negócio reescritas (nova RN-01 aponta o mecanismo real); seção 14 registra a decisão de produto pendente (remover vs. implementar), sem assumir nenhuma das duas; adicionada referência ao UC ainda não mapeado "Criar Usuário da Clínica". |
| 2.1 | 15/07/2026 | Guilherme Scandelari | Adicionada referência cruzada a **UC-39 (Criar Usuário Diretamente para uma Clínica via Painel Admin)**, recém-mapeado — equivalente exato de "Criar Usuário da Clínica" do lado do System Admin, compartilhando a mesma rota `POST /api/users/create` (RN-01 atualizada, seção 12 e seção 14 atualizadas). A pendência sobre o lado do `clinic_admin` (`clinic/users/page.tsx`) permanece em aberto, fora do escopo desta sessão (limitada ao Portal Admin). |
| 2.2 | 15/07/2026 | Guilherme Scandelari | Correção pontual: resolvida a nota de rastreabilidade pendente desde a v2.0 — o fluxo "Criar Usuário da Clínica" pelo lado do `clinic_admin` foi mapeado formalmente como **UC-40 (Criar Usuário para a Própria Clínica)**. Seção 12 e seção 14 atualizadas com a referência cruzada. |
