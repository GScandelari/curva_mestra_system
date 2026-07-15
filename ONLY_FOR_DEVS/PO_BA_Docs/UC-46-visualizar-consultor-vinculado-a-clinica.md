# UC-46: Visualizar Consultor Vinculado à Clínica

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Gestão de Clínica / Consultores

**Versão:** 1.0

> Um usuário de clínica (`clinic_admin` ou `clinic_user`) consulta, em modo somente-leitura, os dados do consultor atualmente vinculado à sua clínica (código, nome, e-mail, telefone, status). Essa consulta existe em **dois lugares com implementação duplicada e independente**: a aba "Consultor" dentro de `/clinic/my-clinic` (o único caminho acessível por navegação) e a página standalone `/clinic/consultant` (órfã — sem link em nenhum menu). Existe ainda uma terceira página, `/clinic/consultant/transfer`, que pretende permitir à própria clínica buscar e vincular um consultor por código — mas essa ação está **confirmadamente quebrada**: a API que ela chama rejeita qualquer usuário de clínica (só aceita `system_admin` ou o próprio consultor autenticado).

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
    end

    ClinicAdmin --> UC46
    ClinicUser --> UC46
    UC46 -.->|GET, somente leitura| API[["/api/tenants/{id}/consultant"]]
    UC46 -.->|"Vincular Consultor"\n(/clinic/consultant/transfer)\nquebrado — sempre 403| API
    UC23 -.->|única forma real de\nalterar o vínculo| API
    UC24 -.->|consultor se vincula\npelo próprio código| API
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — nenhuma das duas telas (`ClinicConsultantPage`, `ConsultantTab`) faz qualquer checagem de `claims.role`; ambas renderizam de forma idêntica para os dois roles (a aba "Consultor" em `my-clinic` é a única que não está dentro de um bloco `isAdmin &&`, diferente das abas "Usuários" e "Limite de Estoque").

### 2.2 Atores Secundários / Sistemas Externos
Nenhum. Os dados exibidos são gravados por processos de outros módulos: **System Admin** (UC-23) ou o próprio **Consultor** (UC-24/UC-25/UC-26, via seus próprios fluxos de vínculo/transferência).

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido nos custom claims.
- Nenhuma pré-condição sobre a existência de um consultor vinculado — a tela trata corretamente o caso "sem consultor".

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado — este é um caso de uso puramente de consulta.
- Se `tenants/{tenantId}.consultant_id` existir e o documento `consultants/{consultant_id}` correspondente também existir: exibe código (com botão de copiar), nome, e-mail, telefone e um `Badge` de status ("Ativo"/"Inativo", conforme `consultant.status === 'active'`).
- Se não houver consultor vinculado (`consultant_id` ausente, ou o documento do consultor não existir mais): exibe um estado vazio com texto explicativo (o texto varia entre as duas implementações — ver RN-01).

### 4.2 Falha (Garantias Mínimas)
- Se a chamada a `GET /api/tenants/{tenantId}/consultant` falhar: erro é apenas registrado via `console.error`, sem nenhuma mensagem visível ao usuário — a tela permanece no estado "sem consultor vinculado" (mesmo visual do caso de sucesso sem vínculo), indistinguível de uma falha real de rede/permissão (RN-02).

---

## 5. Gatilho (Trigger)
Usuário navega para `/clinic/my-clinic` (via menu "Minha Clínica" do `ClinicLayout`) e seleciona a aba "Consultor" — único caminho de acesso alcançável por navegação normal. Alternativamente, acesso direto por URL a `/clinic/consultant` (página órfã, sem link).

---

## 6. Fluxo Principal (Basic Flow)

1. Usuário acessa `/clinic/my-clinic` e clica na aba "Consultor" (`ConsultantTab`, renderizada via `dynamic import`).
2. Sistema chama `GET /api/tenants/{tenantId}/consultant` com o token do usuário.
3. API verifica autenticação e permissão: `system_admin`, membro do próprio tenant (`decodedToken.tenant_id === tenantId` — cobre tanto `clinic_admin` quanto `clinic_user`) ou consultor com acesso autorizado.
4. API busca `tenants/{tenantId}`; se `consultant_id` estiver ausente, retorna `{ success: true, data: null }`.
5. Se `consultant_id` existir, API busca `consultants/{consultant_id}` e retorna os campos `id`, `code`, `name`, `email`, `phone`, `status`.
6. Sistema exibe o card "Consultor Atual" com badge de status, código (formatado, com botão de copiar via `navigator.clipboard`), nome, e-mail e telefone.
7. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Nenhum consultor vinculado (a partir do passo 4 ou 5)
1. `consultant_id` ausente no tenant, ou o documento do consultor referenciado não existe mais.
2. Sistema exibe um card de estado vazio: ícone, "Nenhum Consultor Vinculado", e um texto explicativo — que **diverge entre as duas implementações** (ver RN-01).

### 7b. Usuário copia o código do consultor (a partir do passo 6)
1. Usuário clica no ícone de cópia ao lado do código.
2. Sistema copia o texto via `navigator.clipboard.writeText` e exibe um toast "Código copiado".

### 7c. Acesso à página standalone órfã `/clinic/consultant` (variação do gatilho)
1. Usuário acessa `/clinic/consultant` diretamente por URL (não há link de navegação para esta rota em nenhum lugar do sistema).
2. Comportamento idêntico ao fluxo principal — mesma chamada de API, mesma estrutura visual, com pequenas diferenças de texto e ausência do botão "Voltar"/redirecionamento presentes na variante de transferência (RN-01, RN-03).

---

## 8. Fluxos de Exceção

### 8a. Falha na chamada de API (a partir do passo 2)
1. `fetch` lança exceção, ou a API retorna erro.
2. Erro é registrado apenas via `console.error('Erro ao carregar dados:', error)` (ou variante equivalente); `consultant` permanece `null`; a tela renderiza o mesmo estado vazio do fluxo 7a, sem nenhuma indicação de que uma falha ocorreu (RN-02).

### 8b. Usuário tenta usar "Vincular Consultor" via `/clinic/consultant/transfer` (fluxo relacionado, não pertence ao caminho de consulta deste UC, mas compartilha o mesmo módulo)
1. **[Confirmado quebrado]** A página `/clinic/consultant/transfer` (rota não linkada em nenhum menu) redireciona automaticamente de volta para `/clinic/consultant` se `role === 'clinic_admin'` — ou seja, só um `clinic_user` consegue efetivamente abrir o formulário de busca por código.
2. Mesmo assim, ao buscar um consultor por código (`GET /api/consultants/by-code/{code}`) e tentar confirmar o vínculo, a página chama `POST /api/tenants/{tenantId}/consultant`.
3. **A rota rejeita a chamada com 403 ("Acesso negado")** para qualquer usuário de clínica: a checagem de permissão do `POST` só aceita `system_admin` **ou** um consultor autenticado com `authorized_tenants` incluindo o tenant (`decodedToken.is_consultant && authorized_tenants?.includes(tenantId)`) — nunca `clinic_admin`/`clinic_user`.
4. Um toast de erro é exibido ("Erro ao transferir consultoria" ou a mensagem "Acesso negado" vinda da API); o vínculo nunca é criado por este caminho.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Duplicação de código confirmada]** `ClinicConsultantPage` (`/clinic/consultant/page.tsx`) e `ConsultantTab` (`/components/clinic/ConsultantTab.tsx`, usada em `my-clinic`) são praticamente idênticas — mesma estrutura JSX, mesma chamada de API, mesmos componentes — diferindo apenas no texto do estado vazio: a página standalone diz "O consultor pode solicitar vínculo informando seu CNPJ/CPF" (texto desatualizado, sem menção a aprovação); a aba diz "o vínculo é estabelecido automaticamente, sem necessidade de aprovação... Se houver consultor anterior, ele deve aprovar a transferência" (mais alinhado a UC-24/UC-25/UC-26). Nenhuma das duas compartilha um componente comum — são duas implementações independentes do mesmo dado. | Confirmado por leitura lado a lado de `ClinicConsultantPage` e `ConsultantTab` — mesma lógica, HTML quase idêntico, apenas o texto do card informativo/estado vazio diverge. |
| RN-02 | **[Bug confirmado]** Falhas na busca do consultor (rede, permissão, erro do servidor) são tratadas de forma indistinguível do caso "sem consultor vinculado" — em ambas as implementações, o `catch` apenas loga no console e mantém `consultant: null`, sem nenhum estado de erro visível ao usuário. | Confirmado por leitura literal de `loadData` em ambos os componentes — `catch (error) { console.error(...) }`, sem `setError` ou toast. |
| RN-03 | **[Achado crítico — funcionalidade quebrada]** A página `/clinic/consultant/transfer` pretende permitir que a própria clínica busque um consultor por código de 6 dígitos e o vincule diretamente, mas a rota que ela chama (`POST /api/tenants/{id}/consultant`) só autoriza `system_admin` ou um consultor autenticado — nunca um usuário de clínica. Toda tentativa de uso por um `clinic_user` (o único role que consegue nem sequer ser redirecionado para fora da página, ver RN-04) termina em 403. | Confirmado por leitura completa de `TransferConsultantPage` e do handler `POST` em `api/tenants/[id]/consultant/route.ts` (linhas 111-118: `if (!isSystemAdmin && !isConsultant) return 403`). |
| RN-04 | **[Achado]** `TransferConsultantPage` redireciona automaticamente `clinic_admin` de volta para `/clinic/consultant` (`useEffect` com `if (role === 'clinic_admin') router.replace(...)`), mas não faz o mesmo para `clinic_user` — ou seja, o único role que consegue visualizar o formulário de busca é justamente aquele para quem, tipicamente, ações administrativas da clínica são restritas em outras telas do sistema (padrão inverso ao resto do módulo Clinic). | Confirmado por leitura literal do `useEffect` em `TransferConsultantPage` — a condição de redirecionamento verifica apenas `role === 'clinic_admin'`. |
| RN-05 | Nem `/clinic/consultant` nem `/clinic/consultant/transfer` aparecem em `navLinks` do `ClinicLayout` — o único caminho de navegação real para consultar o consultor vinculado é `/clinic/my-clinic` → aba "Consultor". As outras duas rotas só são alcançáveis por URL direta ou pelos `router.push`/`router.replace` internos entre si. | Confirmado por leitura de `ClinicLayout.tsx` (`navLinks`, linhas 34-41) — nenhuma entrada para `/clinic/consultant*`. |
| RN-06 | A API `GET /api/tenants/{id}/consultant` restringe leitura a `system_admin`, membros do próprio tenant (`clinic_admin`/`clinic_user`, via `decodedToken.tenant_id === tenantId`) ou o consultor com acesso autorizado — garantindo isolamento multi-tenant real (via Admin SDK, não apenas regra do Firestore, já que esta chamada não passa pelo client SDK). | Confirmado por leitura de `GET`, linhas 31-39 de `api/tenants/[id]/consultant/route.ts`. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Duplicação de código entre `ClinicConsultantPage` e `ConsultantTab` (RN-01) — risco de manutenção: uma correção aplicada a uma implementação pode não ser replicada na outra (como já ocorreu com o texto do estado vazio). | Manutenibilidade |
| RNF-02 | Multi-tenant garantido via Admin SDK na própria API route (RN-06), não apenas por regra do Firestore, já que a leitura passa por uma API route em vez de acesso direto ao client SDK. | Multi-tenant / Segurança |
| RNF-03 | Ausência de qualquer feedback de erro ao usuário em caso de falha de rede/permissão (RN-02) — risco de suporte. | Usabilidade |

---

## 11. Frequência de Uso
Ocasional — consulta pontual do usuário da clínica para conferir ou compartilhar o código/dados do consultor vinculado.

---

## 12. Casos de Uso Relacionados
- **UC-23 (Vincular, Alterar, Remover Consultor da Clínica)** — único caminho funcional confirmado, do lado do System Admin, para alterar o vínculo exibido aqui.
- **UC-24 a UC-27 (Consultor — vínculo com clínicas)** — caminho funcional do lado do próprio consultor para se vincular/solicitar transferência; **não** é o mesmo mecanismo que `/clinic/consultant/transfer` tentava expor do lado da clínica (RN-03).
- **UC-45 (Completar Configuração Inicial da Clínica)** — outro exemplo, no mesmo módulo Clinic, de tela sem gate de role entre `clinic_admin`/`clinic_user`.

---

## 13. Referências
- `src/app/(clinic)/clinic/consultant/page.tsx` (`ClinicConsultantPage` — página órfã)
- `src/components/clinic/ConsultantTab.tsx` (implementação duplicada, usada em `my-clinic`)
- `src/app/(clinic)/clinic/my-clinic/page.tsx` (montagem da aba "Consultor", sem gate `isAdmin`)
- `src/app/(clinic)/clinic/consultant/transfer/page.tsx` (`TransferConsultantPage` — fluxo confirmadamente quebrado)
- `src/app/api/tenants/[id]/consultant/route.ts` (`GET`, `POST`, `DELETE`)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — ausência de link para `/clinic/consultant*`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto/bugs pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Achado crítico, requer decisão de prioridade]** RN-03/RN-04 — `/clinic/consultant/transfer` é uma funcionalidade completamente não-funcional (sempre 403) e mal direcionada em termos de role (bloqueia `clinic_admin`, permite `clinic_user`). Deveria ser removida (a lógica real de vínculo já existe do lado do consultor, UC-24/25/26), ou corrigida para efetivamente funcionar como uma via alternativa de vínculo iniciada pela clínica?
2. **[Achado, requer decisão]** RN-01 — unificar `ClinicConsultantPage` e `ConsultantTab` em um único componente compartilhado, e decidir manter apenas um dos dois pontos de entrada (a página standalone, já órfã, é candidata a remoção)?
3. **[Achado, requer decisão]** RN-02 — vale conectar tratamento de erro visível (toast/alert) nas duas implementações, hoje silenciosas?

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ClinicConsultantPage`, `ConsultantTab`, `my-clinic/page.tsx`, `TransferConsultantPage` e `api/tenants/[id]/consultant/route.ts` (GET/POST/DELETE), além de `ClinicLayout.tsx` (navLinks). Confirmada duplicação de código entre as duas implementações de visualização (RN-01) e identificado achado crítico: a página `/clinic/consultant/transfer` — que pretende permitir à clínica vincular um consultor por código — está completamente quebrada, pois a API que ela chama rejeita qualquer usuário de clínica, aceitando apenas `system_admin` ou o próprio consultor autenticado (RN-03), com uma inversão adicional de gate de role que bloqueia `clinic_admin` mas permite `clinic_user` acessar o formulário inútil (RN-04). |
