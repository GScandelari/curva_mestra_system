# UC-47: Gerar Relatórios de Estoque, Vencimento e Consumo

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Relatórios

**Versão:** 1.0

> Um usuário de clínica (`clinic_admin` ou `clinic_user`) gera, sob demanda em `/clinic/reports`, um de três relatórios independentes — Valor do Estoque, Produtos Vencendo (com antecedência configurável) e Consumo por Período — cada um calculado em tempo real no client a partir de `tenants/{tenantId}/inventory` e `tenants/{tenantId}/solicitacoes`, exibido em preview na tela e exportável para Excel (.xlsx). É a única funcionalidade de relatórios realmente implementada no sistema hoje — o componente `ReportsView` foi construído com props (`readOnly`, `backUrl`) pensadas para reuso no Portal Consultor, mas essa tela (`/consultant/reports`) ainda é um placeholder "Em Desenvolvimento", sem nenhuma chamada real a este serviço.

---

## 1. Diagrama UML (Mermaid)

```mermaid
flowchart LR
    ClinicAdmin([👤 Clinic Admin])
    ClinicUser([👤 Clinic User])

    subgraph Sistema["Curva Mestra"]
        UC47(("UC-47\nGerar Relatórios de Estoque,\nVencimento e Consumo"))
    end

    ClinicAdmin --> UC47
    ClinicUser --> UC47
    UC47 -.->|lê tenants/{id}/inventory\ne tenants/{id}/solicitacoes| Firestore[(Firestore)]
    UC47 -.->|export .xlsx via\nbiblioteca xlsx| Excel[/Download Excel/]
```

---

## 2. Atores

### 2.1 Ator Primário
**Clinic Admin** e **Clinic User** — `ReportsPage` não faz nenhuma checagem de `claims.role`; ambos têm acesso idêntico. Diferente de outras telas órfãs já mapeadas neste módulo, `/clinic/reports` **está** presente em `navLinks` do `ClinicLayout` (item "Relatórios").

### 2.2 Atores Secundários / Sistemas Externos
Nenhum sistema externo além do próprio Firestore (leitura client-side) e da biblioteca `xlsx` (geração do arquivo de exportação, executada inteiramente no navegador).

---

## 3. Pré-condições
- Usuário autenticado com `tenant_id` definido nos custom claims.
- Nenhuma pré-condição de dado: os três relatórios lidam corretamente com o caso de não haver nenhum item de inventário/solicitação (retornam listas vazias, totais zerados).

---

## 4. Pós-condições

### 4.1 Sucesso (Garantias de Sucesso)
- Nenhum dado é alterado — os três relatórios são somente leitura/cálculo, sem nenhuma escrita no Firestore.
- O relatório solicitado é exibido em um preview na própria tela (cards de totais + tabela detalhada).
- Se o usuário clicar em "Exportar Excel": um arquivo `.xlsx` é baixado pelo navegador, nomeado `{relatorio}_{AAAA-MM-DD}.xlsx`, com os mesmos dados exibidos no preview (recalculados a partir do estado em memória, não uma nova consulta).

### 4.2 Falha (Garantias Mínimas)
- Se a geração do relatório falhar (erro de rede/permissão no Firestore): um `alert()` nativo do navegador exibe "Erro ao gerar relatório"; nenhum preview é exibido; o erro completo é apenas registrado via `console.error`.

---

## 5. Gatilho (Trigger)
Usuário navega para `/clinic/reports` (via menu "Relatórios" do `ClinicLayout`) e clica em um dos três botões "Gerar Relatório" (Valor do Estoque, Produtos Vencendo, Consumo).

---

## 6. Fluxo Principal (Basic Flow) — Relatório de Valor do Estoque

1. Usuário acessa `/clinic/reports`; sistema exibe três cards (Valor do Estoque, Produtos Vencendo, Consumo), cada um com seu próprio botão "Gerar Relatório" e, quando aplicável, campos de parâmetro.
2. Usuário clica em "Gerar Relatório" no card "Valor do Estoque".
3. Sistema chama `generateStockValueReport(tenantId)`: busca todos os documentos de `tenants/{tenantId}/inventory` com `active == true`, agrupa por `codigo_produto`, somando quantidade e valor (`quantidade_disponivel * valor_unitario`) por produto e no total, e contando o número de lotes (documentos) por produto.
4. Sistema exibe o preview: cards de "Total de Produtos", "Total de Itens" e "Valor Total", seguidos de uma tabela por produto (código, nome, quantidade total, número de lotes, valor unitário, valor total), ordenada por valor total decrescente.
5. Usuário pode clicar em "Exportar Excel" (gera e baixa um `.xlsx` com os mesmos dados da tabela) ou "Fechar" (oculta o preview, mantendo os outros dois relatórios disponíveis para gerar independentemente).
6. Caso de uso é concluído com sucesso.

---

## 7. Fluxos Alternativos

### 7a. Relatório de Produtos Vencendo (variação do gatilho)
1. Usuário informa "Antecedência (dias)" (padrão 30, mín. 1, máx. 365 — validado apenas por atributos HTML, sem checagem explícita no handler) e clica em "Gerar Relatório" no card correspondente.
2. Sistema chama `generateExpirationReport(tenantId, dias)`: busca `inventory` com `active == true`, calcula `dias_para_vencer` para cada item e inclui no relatório **todo item cuja validade seja menor ou igual a `hoje + dias`** — ou seja, inclui tanto produtos a vencer dentro do prazo quanto produtos **já vencidos** (RN-01), desde que `quantidade > 0`.
3. Sistema exibe cards de "Produtos em Risco" e "Valor em Risco", e uma tabela ordenada por urgência (`dias_para_vencer` crescente), destacando em vermelho linhas com `dias_para_vencer <= 7`.
4. Usuário pode exportar ou fechar, como no fluxo principal.

### 7b. Relatório de Consumo por Período (variação do gatilho)
1. Sistema pré-preenche "Data Início" (um mês atrás) e "Data Fim" (hoje) ao carregar a página.
2. Usuário ajusta o período (opcional) e clica em "Gerar Relatório" no card "Consumo".
3. Sistema valida que ambas as datas estão preenchidas (senão, `alert('Selecione o período')`) e chama `generateConsumptionReport(tenantId, dataInicio, dataFim)`: busca `tenants/{tenantId}/solicitacoes` com `status == 'concluida'` e `dt_procedimento` dentro do intervalo, somando `quantidade`/`valor_unitario` de cada produto em `produtos_solicitados` de cada solicitação.
4. Sistema exibe cards de "Total Procedimentos", "Produtos Consumidos" e "Valor Total", e uma tabela por produto (quantidade consumida, número de procedimentos em que apareceu, valor total).
5. Usuário pode exportar ou fechar, como no fluxo principal.

### 7c. Múltiplos relatórios gerados em sequência
1. Usuário gera um relatório, depois gera outro sem fechar o primeiro.
2. Cada relatório mantém seu próprio estado (`stockReport`, `expirationReport`, `consumptionReport`) independentemente — mas a tela exibe apenas o preview do **último relatório gerado** (`activeReport` é uma única variável, sobrescrita a cada geração); os relatórios anteriores continuam em memória, mas ficam ocultos até o usuário gerar novamente o mesmo tipo (RN-04).

---

## 8. Fluxos de Exceção

### 8a. Falha ao gerar qualquer um dos três relatórios (a partir dos passos 3 de qualquer fluxo)
1. A consulta ao Firestore lança exceção (rede, permissão).
2. Sistema exibe `alert('Erro ao gerar relatório')` (bloqueante, nativo do navegador — diferente do padrão de toast usado no restante do sistema) e registra o erro completo apenas em `console.error`.

### 8b. Data de validade em formato não reconhecido (Relatório de Vencimento, a partir do passo 2 do fluxo 7a)
1. `dt_validade` do item de inventário não é `Timestamp`, `Date`, nem string em formato `DD/MM/YYYY` ou `YYYY-MM-DD`.
2. Sistema registra um `console.warn` e **pula silenciosamente** esse item — ele não aparece no relatório, sem nenhuma indicação ao usuário de que um item foi omitido por dado inconsistente (RN-02).

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O Relatório de "Produtos Vencendo" inclui, apesar do nome, também produtos **já vencidos** (`dt_validade` no passado) — o filtro é `dt_validade <= hoje + diasAntecedencia`, sem piso inferior. O comentário no código confirma que essa é a intenção: "produtos vencidos até produtos que vencem nos próximos X dias". | Confirmado por leitura literal de `generateExpirationReport` — não há filtro `dt_validade >= now`. |
| RN-02 | **[Achado]** Itens de inventário com `dt_validade` em formato não reconhecido são silenciosamente excluídos do Relatório de Vencimento (apenas um `console.warn`), o que pode subestimar o "Valor em Risco" sem que o usuário saiba. | Confirmado por leitura do bloco de conversão de data em `generateExpirationReport` — `return` dentro do `forEach`, sem contabilizar o item nem alertar a UI. |
| RN-03 | O Relatório de Consumo só considera solicitações com `status === 'concluida'` — solicitações `agendada`, `aprovada`, `cancelada` etc. nunca aparecem, mesmo que o período do filtro as inclua. | Confirmado por leitura literal do `where('status', '==', 'concluida')` em `generateConsumptionReport`; consistente com o entendimento de "concluída = produtos efetivamente consumidos" já usado nos UCs de procedimentos (UC-19). |
| RN-04 | **[Achado de UX]** Apenas um relatório é exibido por vez (`activeReport`, variável única) — gerar um segundo tipo de relatório oculta o preview do primeiro, mesmo que ambos permaneçam calculados em memória. Não há abas ou exibição simultânea. | Confirmado por leitura das condições de renderização (`stockReport && activeReport === 'stock'`, etc.) — todas dependem da mesma variável `activeReport`. |
| RN-05 | A exportação para Excel (`exportToExcel`) recalcula as linhas a partir do estado em memória do relatório já gerado — não dispara uma nova consulta ao Firestore. Uma função irmã, `exportToCSV`, existe no mesmo arquivo mas é **código morto**: nunca é chamada por `ReportsView` nem por nenhum outro ponto do código. | Confirmado por leitura de `handleExportStockReport`/`handleExportExpirationReport`/`handleExportConsumptionReport` (todos chamam `exportToExcel`) e por busca exaustiva por `exportToCSV` em `src/` — só a própria definição. |
| RN-06 | Todos os três relatórios são calculados 100% client-side, sem nenhuma API route dedicada — a segurança/isolamento multi-tenant depende inteiramente da regra genérica do Firestore `tenants/{tenantId}/{document=**}`, que concede leitura/escrita a qualquer membro do tenant (`belongsToTenant`). | Confirmado por leitura de `reportService.ts` (todas as três funções usam `collection(db, 'tenants', tenantId, ...)` diretamente) e de `firestore.rules` (linha 53-62). |
| RN-07 | **[Achado, relacionado a módulo futuro]** O componente `ReportsView` já foi construído com props `readOnly`/`backUrl` para reuso — mas a única tela que efetivamente o utiliza é `/clinic/reports`; `/consultant/reports` é um placeholder estático ("Em Desenvolvimento"), sem nenhuma chamada a `reportService.ts`. | Confirmado por busca exaustiva por `ReportsView` em `src/` (2 ocorrências: definição e uso em `clinic/reports/page.tsx`) e por leitura completa de `consultant/reports/page.tsx` (cards "opacity-60", sem nenhuma lógica de geração). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | Feedback de erro via `alert()` nativo do navegador (RN/8a) — inconsistente com o padrão de toast (`useToast`) usado no restante do sistema, incluindo outras telas do próprio módulo Clinic. | Usabilidade / Consistência |
| RNF-02 | Sem paginação/limite: os três relatórios carregam a coleção inteira relevante (`inventory` ou `solicitacoes`) de uma vez — pode se tornar lento para tenants com grande volume histórico de solicitações. | Escalabilidade |
| RNF-03 | Multi-tenant garantido apenas pela regra genérica do Firestore, sem revalidação server-side (RN-06). | Multi-tenant / Segurança |

---

## 11. Frequência de Uso
Provavelmente frequente/recorrente — é a única tela de relatórios totalmente funcional do sistema, presente no menu principal do Portal Clinic (diferente das demais telas órfãs já mapeadas no módulo).

---

## 12. Casos de Uso Relacionados
- **UC-10/UC-11 (Importação de NF-e)** e **UC-13/UC-14 (Inventário)** — fonte dos dados de `inventory` consumidos pelo Relatório de Valor do Estoque e de Vencimento.
- **UC-16 a UC-19 (Procedimentos)** — fonte dos dados de `solicitacoes` (status `concluida`) consumidos pelo Relatório de Consumo.
- **UC-42 (Executar Verificações de Alertas Manualmente)** — cálculo de "produtos vencendo" conceitualmente semelhante ao deste UC, mas com propósito e implementação totalmente independentes (um gera notificações persistidas; este gera um relatório efêmero, sem persistência).
- Consultant — Relatórios (`/consultant/reports`) — tela placeholder, **não mapeada como UC** por não ter nenhuma lógica de negócio real implementada ainda (RN-07); candidata a UC futuro quando a funcionalidade for de fato construída.

---

## 13. Referências
- `src/app/(clinic)/clinic/reports/page.tsx` (`ReportsPage`)
- `src/components/reports/ReportsView.tsx` (`ReportsView`)
- `src/lib/services/reportService.ts` (`generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`, `exportToExcel`, `exportToCSV` — código morto)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — inclui "Relatórios")
- `firestore.rules` (linhas 53-62 — regra genérica de subcoleções do tenant)
- `src/app/(consultant)/consultant/reports/page.tsx` (placeholder "Em Desenvolvimento", fora do escopo deste UC — RN-07)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[Achado, requer decisão]** RN-02 — itens com data de validade em formato inválido são silenciosamente omitidos do Relatório de Vencimento, subestimando o valor em risco. Vale exibir um aviso ao usuário quando isso ocorrer?
2. **[Observação]** RN-01 — o nome "Produtos Vencendo" pode confundir usuários, já que o relatório também inclui produtos já vencidos. É intencional (nome mantido por simplicidade) ou vale renomear/ajustar a UI para deixar isso explícito?
3. **[Observação]** RN-05 — `exportToCSV` é código morto. Remover, ou manter como alternativa futura de exportação?
4. **[Observação, não bloqueante]** RN-07 — `/consultant/reports` é um placeholder sem lógica real; não foi mapeado como UC nesta rodada por não representar comportamento de negócio implementado. Deve ser tratado como pendência de roadmap, não como lacuna de documentação.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ReportsPage`, `ReportsView`, `reportService.ts` (as três funções de geração + utilitários de exportação), `ClinicLayout.tsx` e `firestore.rules`. Confirmado que este é o único módulo de relatórios do módulo Clinic totalmente funcional, e que a tela equivalente do Portal Consultor (`/consultant/reports`) é apenas um placeholder "Em Desenvolvimento", sem nenhuma lógica real — por isso não foi mapeada como UC separado nesta rodada (RN-07). Identificados achados: o Relatório de "Produtos Vencendo" também inclui produtos já vencidos (RN-01); itens com data de validade em formato inválido são omitidos silenciosamente (RN-02); apenas um relatório é exibido por vez, mesmo com múltiplos calculados em memória (RN-04); e `exportToCSV` é código morto (RN-05). |
