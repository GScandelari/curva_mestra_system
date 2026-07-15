# UC-48: Consultar Clínicas Vinculadas e Estoque

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Portal do Consultor

**Versão:** 1.0

> Um Consultor navega pelas clínicas vinculadas à sua conta em três telas encadeadas, todas somente-leitura: `/consultant/clinics` (lista com busca local), `/consultant/clinics/{tenantId}` (detalhe com estatísticas de estoque) e `/consultant/clinics/{tenantId}/inventory` (inventário completo, reutilizando o mesmo componente `InventoryView` do Portal Clinic, restrito à marca Rennova). O consultor nunca edita nada nessas telas — apenas consulta.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    Consultor([👤 Consultor])

    subgraph Sistema["Curva Mestra"]
        UC48(("UC-48\nConsultar Clínicas\nVinculadas e Estoque"))
        UC24(("UC-24\nVincular-se Automaticamente\na Clínica"))
    end

    Consultor --> UC48
    UC24 -.->|clínicas vinculadas\naqui aparecem em| UC48
    UC48 -.->|GET, somente leitura,\nfiltrado brand=Rennova| Firestore[(Firestore\ntenants/{id}/inventory)]
```

---

## 2. Atores

### 2.1 Ator Primário
**Consultor** — as três páginas ficam sob o grupo de rota `(consultant)`, protegidas por role de consultor; nenhuma delas é acessível a `clinic_admin`/`clinic_user`/`system_admin`.

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo. Os dados consultados são os mesmos geridos pelos módulos de Inventário (UC-10 a UC-14) e de vínculo de consultor (UC-24 a UC-27), sob a mesma fonte (`tenants/{tenantId}/inventory`), sem nenhuma cópia/denormalização própria.

---

## 3. Pré-condições
- Usuário autenticado com `is_consultant === true` e `authorized_tenants` definido nos custom claims.
- Para acessar detalhe (`/consultant/clinics/{tenantId}`) ou inventário (`/consultant/clinics/{tenantId}/inventory`) de uma clínica específica: `tenantId` deve constar em `authorizedTenants` (verificado no client, via `useAuth`); caso contrário, o sistema redireciona de volta para `/consultant/clinics`.

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado em nenhuma das três telas — este UC é inteiramente de consulta.
- **Lista (`/consultant/clinics`):** exibe todas as clínicas retornadas por `GET /api/consultants/me/clinics`, filtráveis localmente (client-side, sem nova consulta) por nome, documento ou e-mail.
- **Detalhe (`/consultant/clinics/{tenantId}`):** exibe nome, documento formatado e status (Ativa/Inativa) da clínica, mais três cards de estatística de estoque (Itens no Estoque, Próximos a Vencer — 30 dias, Estoque Baixo), calculados a partir do inventário filtrado por `brand == 'Rennova'`.
- **Inventário (`/consultant/clinics/{tenantId}/inventory`):** exibe a listagem completa de itens Rennova em modo somente-leitura (`InventoryView` com `readOnly` e `onlyBrand="Rennova"`), com exportação para Excel disponível, mas sem botão de "Adicionar Produtos" e sem navegação para o detalhe de item individual (ambos dependem de props — `onAddProducts`/`onRowClick` — que esta tela nunca passa ao componente).

### 4.2 Falha (Garantias Mínimas)
- Se `GET /api/consultants/me/clinics` falhar: erro apenas registrado via `console.error`; lista permanece vazia, sem mensagem visível ao usuário.
- Se `tenantId` não estiver em `authorizedTenants`: usuário é redirecionado para `/consultant/clinics`, sem nenhuma mensagem explicando o motivo.

---

## 5. Gatilho (Trigger)
Consultor navega para `/consultant/clinics` (menu "Minhas Clínicas" do Portal do Consultor) e, a partir daí, clica em uma clínica (`ClinicCard`) e depois em "Ver Estoque".

---

## 6. Fluxo Principal (Basic Flow)

1. Consultor acessa `/consultant/clinics`.
2. Sistema chama `GET /api/consultants/me/clinics` com o token do usuário e popula a lista; em seguida chama `refreshClaims()` para sincronizar `authorized_tenants` (comentário no código: "Refresh claims to sync authorized_tenants from server").
3. Sistema exibe as clínicas em um grid de cards (`ClinicCard`), com um campo de busca que filtra localmente por nome, documento ou e-mail (sem nova chamada de API).
4. Consultor clica em uma clínica; sistema navega para `/consultant/clinics/{tenantId}`.
5. Sistema verifica `authorizedTenants.includes(tenantId)`; se verdadeiro, chama (sem uso do resultado — ver RN-01) `GET /api/tenants/{tenantId}/consultant`, depois consulta `tenants/{tenantId}/inventory` filtrando `brand == 'Rennova'` para calcular estatísticas (`computeInventoryStats`), e busca os dados básicos do tenant (`tenants/{tenantId}`) via client SDK.
6. Sistema exibe nome, documento formatado, badge de status, e os três cards de estatística.
7. Consultor clica em "Ver Estoque"; sistema navega para `/consultant/clinics/{tenantId}/inventory`.
8. Sistema renderiza `InventoryView` com `tenantId`, `readOnly`, `onlyBrand="Rennova"` e `backUrl` de volta ao detalhe — mesma listagem/filtros/exportação já documentados em UC-13/UC-14 do lado da clínica, mas sem nenhuma ação de escrita disponível.
9. Caso de uso é concluído a qualquer momento em que o consultor navega para fora dessas três telas.

---

## 7. Fluxos Alternativos

### 7a. Nenhuma clínica vinculada (a partir do passo 3)
1. `clinics.length === 0`.
2. Sistema exibe estado vazio: "Nenhuma clínica vinculada" com um botão "Buscar Clínicas" (leva a `/consultant/clinics/search`, UC-24).

### 7b. Busca local sem resultados (a partir do passo 3)
1. `searchTerm` não corresponde a nenhuma clínica da lista já carregada.
2. Sistema exibe "Nenhuma clínica encontrada com os filtros aplicados" (mensagem diferente do estado "sem nenhuma clínica vinculada").

### 7c. Acesso direto a uma URL de clínica não vinculada (a partir do passo 5)
1. `tenantId` da URL não está em `authorizedTenants`.
2. Sistema redireciona imediatamente para `/consultant/clinics`, sem carregar nenhum dado da clínica solicitada.

---

## 8. Fluxos de Exceção

### 8a. Falha ao carregar lista de clínicas (a partir do passo 2)
1. `fetch` lança exceção ou a API retorna erro.
2. Erro é apenas registrado via `console.error('Erro ao carregar clínicas:', error)`; lista permanece vazia — indistinguível visualmente do fluxo 7a (sem consultor saber se é "sem vínculos" ou "falha de rede").

### 8b. Falha ao carregar estatísticas ou dados do tenant (a partir do passo 5)
1. A consulta ao inventário ou ao documento do tenant lança exceção.
2. Erro é registrado via `console.error`, mas a tela **não interrompe o carregamento** — cada bloco (`try/catch` separado) falha de forma independente; estatísticas permanecem zeradas ou o nome da clínica permanece vazio (`tenant?.name || 'Clínica'`), sem nenhum aviso de erro visível.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | **[Achado, código morto]** `loadTenantData` (página de detalhe) chama `fetch(\`/api/tenants/\${tenantId}/consultant\`, ...)` mas nunca lê o corpo da resposta (`await fetch(...)` sem `.json()` nem checagem de `response.ok`) — a chamada não tem nenhum efeito observável na tela; parece um resquício de uma versão anterior da página. | Confirmado por leitura literal de `loadTenantData` — o resultado do `fetch` nunca é atribuído a nenhuma variável usada depois. |
| RN-02 | **[Bug confirmado — divergência de texto vs. lógica]** O card "Estoque Baixo" exibe o texto fixo "produtos Rennova com **5 unidades ou menos**", mas o cálculo real (`computeInventoryStats`) usa o limiar **`<= 10`**, não 5. | Confirmado por leitura de `computeInventoryStats` em `inventoryUtils.ts` (linha `if (quantidade_disponivel <= 10) low_stock++`) comparada ao texto estático em `ClinicDetailPage` ("5 unidades ou menos"). |
| RN-03 | O limiar de 10 usado aqui é um **terceiro mecanismo de "estoque baixo"**, completamente independente do limite por produto (UC-15) e do fallback de tenant (UC-43, também default 10 — coincidência de valor, não relação de código) — `computeInventoryStats` não lê nenhuma configuração, é um valor fixo no código. | Confirmado por leitura de `computeInventoryStats` — nenhuma referência a `stock_limits` (UC-15) nem a `NotificationSettings` (UC-43). |
| RN-04 | O inventário exibido é sempre filtrado por `brand == 'Rennova'`, tanto no cálculo de estatísticas (query direta) quanto na listagem completa (`onlyBrand="Rennova"` em `InventoryView`) — produtos de outras marcas cadastrados no tenant nunca aparecem para o consultor. | Confirmado por leitura de `loadTenantData` (`where('brand', '==', 'Rennova')`) e da prop `onlyBrand` passada em `ConsultantInventoryPage`. |
| RN-05 | O modo somente-leitura do inventário é garantido, na prática, pela **ausência** das props `onAddProducts`/`onRowClick` (nunca passadas por esta tela) — não por um bloqueio explícito de role dentro de `InventoryView`. O botão "Adicionar Produtos" já é condicionado a `isAdmin && onAddProducts`, então mesmo que um consultor nunca satisfaça `isAdmin`, a ausência do callback é uma segunda camada da mesma proteção. | Confirmado por leitura de `InventoryView.tsx` (linhas 313 e 489) comparada às props passadas por `ConsultantInventoryPage`. |
| RN-06 | Isolamento multi-tenant e de marca é reforçado pela regra do Firestore (`consultantHasAccess(tenantId)`, leitura apenas — `firestore.rules` linha 60-61); o consultor nunca consegue ler subcoleções de um tenant fora de `authorized_tenants`, mesmo manipulando a URL diretamente, pois a regra do backend (não apenas o redirecionamento client-side do fluxo 7c) também bloqueia. | Confirmado por leitura de `firestore.rules`, linha 60-61. |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Falhas de carregamento em qualquer uma das três telas são inteiramente silenciosas (RN — fluxos 8a/8b) — mesmo padrão já observado em outras telas do sistema (ex.: UC-46). | Usabilidade |
| RNF-02 | A busca na lista de clínicas (`/consultant/clinics`) é local (sobre os dados já carregados), não uma nova consulta — rápida, mas limitada às clínicas já vinculadas (não busca novas clínicas; para isso, `/consultant/clinics/search`, UC-24). | Desempenho |
| RNF-03 | Multi-tenant e restrição de marca garantidos tanto no client quanto na regra do Firestore (RN-04, RN-06). | Multi-tenant / Segurança |

---

## 11. Frequência de Uso
Provavelmente alta — é o fluxo central de navegação do Portal do Consultor no dia a dia (acompanhar estoque das clínicas vinculadas).

---

## 12. Casos de Uso Relacionados
- **UC-24 (Vincular-se Automaticamente a Clínica sem Consultor)** e **UC-25/26/27 (Transferência)** — fonte das clínicas que aparecem na lista consultada aqui.
- **UC-13/UC-14 (Inventário — Clinic)** — mesmo componente `InventoryView`, aqui usado em modo `readOnly`/`onlyBrand="Rennova"`, sem nenhuma das ações de escrita documentadas naqueles UCs.
- **UC-15 (Configurar Limite de Estoque Baixo por Produto)** e **UC-43 (Configurar Preferências de Notificação)** — ambos completamente desconectados do cálculo de "Estoque Baixo" usado neste UC (RN-03), que usa seu próprio limiar fixo (10).
- **UC-49 (Visualizar Perfil Próprio do Consultor)** — outra tela somente-leitura do mesmo portal, mas sobre os dados do próprio consultor, não das clínicas.

---

## 13. Referências
- `src/app/(consultant)/consultant/clinics/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/page.tsx`
- `src/app/(consultant)/consultant/clinics/[tenantId]/inventory/page.tsx`
- `src/components/consultant/ClinicCard.tsx`
- `src/components/inventory/InventoryView.tsx` (props `readOnly`, `onlyBrand`, `onAddProducts`, `onRowClick`)
- `src/lib/inventoryUtils.ts` (`computeInventoryStats`, `parseInventoryDate`)
- `src/app/api/consultants/me/clinics/route.ts`
- `firestore.rules` (linha 60-61 — `consultantHasAccess`)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Bug confirmado, correção simples]** RN-02 — o texto "5 unidades ou menos" diverge do limiar real (`<= 10`). Corrigir o texto para "10" ou ajustar o código para de fato usar 5?
2. **[Observação]** RN-01 — a chamada `fetch` sem uso a `/api/tenants/{id}/consultant` parece código morto. Remover?
3. **[Observação]** RN-03 — existência de um terceiro limiar de "estoque baixo" (fixo, 10), independente de UC-15/UC-43. Vale unificar os três mecanismos, ou são propositalmente independentes (um é "estoque baixo por produto" da clínica, outro é "alerta configurável do tenant", e este é "resumo rápido para o consultor")?
4. **[Observação]** RNF-01 — vale conectar tratamento de erro visível nas três telas, hoje silenciosas?

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ConsultantClinicsPage`, `ClinicDetailPage`, `ConsultantInventoryPage`, `InventoryView.tsx` (props de somente-leitura), `computeInventoryStats` (`inventoryUtils.ts`) e `firestore.rules` (`consultantHasAccess`). Identificado bug confirmado de divergência entre texto e lógica no card "Estoque Baixo" (RN-02: texto diz "5", código usa 10), uma chamada de API sem uso do resultado (RN-01), e a existência de um terceiro mecanismo de limiar de estoque baixo, totalmente independente de UC-15/UC-43 (RN-03). |
