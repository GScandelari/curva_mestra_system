# UC-47: Gerar Relatórios de Estoque, Vencimento e Consumo

**Projeto:** Curva Mestra
**Data de Criação:** 15/07/2026
**Autor:** Guilherme Scandelari (via uml-use-case-writer)
**Status:** Rascunho
**Módulo/Contexto:** Relatórios

**Versão:** 1.0.2

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
- **[CORRIGIDO em v1.0.2, commit `70a38d7`]** No Relatório de Vencimento, se algum item de inventário tiver `dt_validade` inválida/não interpretável (formato desconhecido, tipo de dado inválido, ou uma data sintaticamente aceita pelo construtor `Date` mas com valor inválido, ex.: `"2025-13-45"`), ele é contado em `itens_ignorados` e um banner amarelo é exibido acima da tabela, avisando que o "Valor em Risco" pode estar subestimado — ver RN-02.

### 4.2 Falha (Garantias Mínimas)
- Se a geração do relatório falhar (erro de rede/permissão no Firestore): um `toast` destrutivo (`useToast`) exibe "Erro ao gerar relatório" / "Não foi possível gerar o relatório. Tente novamente." — corrigido no commit `53df743` (RNF-01); nenhum preview é exibido; o erro completo continua sendo registrado via `console.error`.

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
2. Sistema chama `generateExpirationReport(tenantId, dias)`: busca `inventory` com `active == true`, calcula `dias_para_vencer` para cada item e inclui no relatório **todo item cuja validade seja menor ou igual a `hoje + dias`** — ou seja, inclui tanto produtos a vencer dentro do prazo quanto produtos **já vencidos** (RN-01), desde que `quantidade > 0`. **[CORRIGIDO em v1.0.2, commit `70a38d7`]** Itens com `dt_validade` inválida/não interpretável são contados em `itens_ignorados` (não incluídos no relatório) — ver RN-02.
3. Sistema exibe cards de "Produtos em Risco" e "Valor em Risco" e, **[CORRIGIDO em v1.0.2]** se `itens_ignorados > 0`, um banner de aviso amarelo logo antes da tabela; e uma tabela ordenada por urgência (`dias_para_vencer` crescente), destacando em vermelho linhas com `dias_para_vencer <= 7`.
4. Usuário pode exportar ou fechar, como no fluxo principal.

### 7b. Relatório de Consumo por Período (variação do gatilho)
1. Sistema pré-preenche "Data Início" (um mês atrás) e "Data Fim" (hoje) ao carregar a página.
2. Usuário ajusta o período (opcional) e clica em "Gerar Relatório" no card "Consumo".
3. Sistema valida que ambas as datas estão preenchidas (senão, exibe um `toast` destrutivo "Selecione o período" / "Informe a data inicial e final para gerar o relatório de consumo." — corrigido no commit `53df743`, RNF-01) e chama `generateConsumptionReport(tenantId, dataInicio, dataFim)`: busca `tenants/{tenantId}/solicitacoes` com `status == 'concluida'` e `dt_procedimento` dentro do intervalo, somando `quantidade`/`valor_unitario` de cada produto em `produtos_solicitados` de cada solicitação.
4. Sistema exibe cards de "Total Procedimentos", "Produtos Consumidos" e "Valor Total", e uma tabela por produto (quantidade consumida, número de procedimentos em que apareceu, valor total).
5. Usuário pode exportar ou fechar, como no fluxo principal.

### 7c. Múltiplos relatórios gerados em sequência
1. Usuário gera um relatório, depois gera outro sem fechar o primeiro.
2. Cada relatório mantém seu próprio estado (`stockReport`, `expirationReport`, `consumptionReport`) independentemente — mas a tela exibe apenas o preview do **último relatório gerado** (`activeReport` é uma única variável, sobrescrita a cada geração); os relatórios anteriores continuam em memória, mas ficam ocultos até o usuário gerar novamente o mesmo tipo (RN-04).

---

## 8. Fluxos de Exceção

### 8a. Falha ao gerar qualquer um dos três relatórios (a partir dos passos 3 de qualquer fluxo)
1. A consulta ao Firestore lança exceção (rede, permissão).
2. Sistema exibe um `toast` destrutivo (`useToast`, `@/hooks/use-toast`) com título "Erro ao gerar relatório" e descrição "Não foi possível gerar o relatório. Tente novamente.", e registra o erro completo em `console.error` — **[Corrigido no commit `53df743` — UC-47-RNF-01]**; até então, o feedback era um `alert()` bloqueante nativo do navegador, inconsistente com o padrão de toast usado no restante do sistema.

### 8b. [CORRIGIDO — commit `70a38d7`] Data de validade em formato não reconhecido ou inválida (Relatório de Vencimento, a partir do passo 2 do fluxo 7a)
1. `dt_validade` do item de inventário não é `Timestamp`, `Date`, nem string em formato `DD/MM/YYYY` ou `YYYY-MM-DD` reconhecível — **ou** é uma string sintaticamente aceita pelo construtor `Date` mas com valor inválido (ex.: `"2025-13-45"`), resultando em `Invalid Date` (`isNaN(dtValidade.getTime())`).
2. Sistema registra um `console.warn` e **pula** esse item — ele não aparece no relatório — mas agora incrementa o contador `itensIgnorados`, retornado como `itens_ignorados` no objeto do relatório.
3. `ReportsView` exibe um banner de aviso amarelo (visível apenas quando `itens_ignorados > 0`) logo antes da tabela de produtos vencendo, informando quantos itens foram ignorados e alertando que o "Valor em Risco" pode estar subestimado.

**Comportamento anterior (histórico, antes da correção):** os dois ramos de erro (formato desconhecido; tipo de dado inválido) apenas faziam `console.warn` e `return` (equivalente a `continue` dentro do `forEach`), sem incrementar nenhum contador visível ao usuário. Além disso, datas sintaticamente aceitas pelo construtor `Date` mas com valores inválidos geravam silenciosamente um `Invalid Date`, sem cair em nenhum dos ramos de warning, e comparavam `false` em `dtValidade <= limitDate` (comparação com `NaN`), excluindo o item do relatório sem log algum — um terceiro caminho de exclusão silenciosa que não existia nos dois ramos originais. Resultado: o "Valor em Risco" do relatório de vencimento podia estar subestimado sem qualquer aviso ao usuário.

---

## 9. Regras de Negócio Relacionadas

| ID | Regra | Justificativa |
|----|-------|----------------|
| RN-01 | O Relatório de "Produtos Vencendo" inclui, apesar do nome, também produtos **já vencidos** (`dt_validade` no passado) — o filtro é `dt_validade <= hoje + diasAntecedencia`, sem piso inferior. O comentário no código confirma que essa é a intenção: "produtos vencidos até produtos que vencem nos próximos X dias". | Confirmado por leitura literal de `generateExpirationReport` — não há filtro `dt_validade >= now`. |
| RN-02 | **[CORRIGIDO — commit `70a38d7`]** Antes: itens de inventário com `dt_validade` em formato não reconhecido, ou sintaticamente aceito pelo construtor `Date` mas com valor inválido (ex.: `"2025-13-45"`, gerando `Invalid Date`), eram silenciosamente excluídos do Relatório de Vencimento (apenas um `console.warn`, ou nem isso no caso de `Invalid Date` — que era descartado só pela comparação `NaN <= limitDate`), o que podia subestimar o "Valor em Risco" sem que o usuário soubesse. Agora: novo campo `itens_ignorados: number` na interface `ExpirationReport`; nova variável `itensIgnorados` incrementada nos dois ramos de warning já existentes; novo terceiro check logo após a conversão de string para `Date` (`if (isNaN(dtValidade.getTime())) { ...; itensIgnorados++; return; }`), cobrindo o caso de `Invalid Date` que antes escapava de qualquer contabilização; `itens_ignorados` incluído no retorno da função; e um banner de aviso amarelo em `ReportsView.tsx` (visível apenas quando `itens_ignorados > 0`), exibido logo antes da tabela de produtos vencendo, informando a quantidade de itens ignorados e alertando que o "Valor em Risco" pode estar subestimado. | Correção confirmada por leitura do commit `70a38d7` (`src/lib/services/reportService.ts`, `src/components/reports/ReportsView.tsx`). |
| RN-03 | O Relatório de Consumo só considera solicitações com `status === 'concluida'` — solicitações `agendada`, `aprovada`, `cancelada` etc. nunca aparecem, mesmo que o período do filtro as inclua. | Confirmado por leitura literal do `where('status', '==', 'concluida')` em `generateConsumptionReport`; consistente com o entendimento de "concluída = produtos efetivamente consumidos" já usado nos UCs de procedimentos (UC-19). |
| RN-04 | **[Achado de UX]** Apenas um relatório é exibido por vez (`activeReport`, variável única) — gerar um segundo tipo de relatório oculta o preview do primeiro, mesmo que ambos permaneçam calculados em memória. Não há abas ou exibição simultânea. | Confirmado por leitura das condições de renderização (`stockReport && activeReport === 'stock'`, etc.) — todas dependem da mesma variável `activeReport`. |
| RN-05 | A exportação para Excel (`exportToExcel`) recalcula as linhas a partir do estado em memória do relatório já gerado — não dispara uma nova consulta ao Firestore. Uma função irmã, `exportToCSV`, existe no mesmo arquivo mas é **código morto**: nunca é chamada por `ReportsView` nem por nenhum outro ponto do código. | Confirmado por leitura de `handleExportStockReport`/`handleExportExpirationReport`/`handleExportConsumptionReport` (todos chamam `exportToExcel`) e por busca exaustiva por `exportToCSV` em `src/` — só a própria definição. |
| RN-06 | Todos os três relatórios são calculados 100% client-side, sem nenhuma API route dedicada — a segurança/isolamento multi-tenant depende inteiramente da regra genérica do Firestore `tenants/{tenantId}/{document=**}`, que concede leitura/escrita a qualquer membro do tenant (`belongsToTenant`). | Confirmado por leitura de `reportService.ts` (todas as três funções usam `collection(db, 'tenants', tenantId, ...)` diretamente) e de `firestore.rules` (linha 53-62). |
| RN-07 | **[Achado, relacionado a módulo futuro]** O componente `ReportsView` já foi construído com props `readOnly`/`backUrl` para reuso — mas a única tela que efetivamente o utiliza é `/clinic/reports`; `/consultant/reports` é um placeholder estático ("Em Desenvolvimento"), sem nenhuma chamada a `reportService.ts`. | Confirmado por busca exaustiva por `ReportsView` em `src/` (2 ocorrências: definição e uso em `clinic/reports/page.tsx`) e por leitura completa de `consultant/reports/page.tsx` (cards "opacity-60", sem nenhuma lógica de geração). |

---

## 10. Requisitos Especiais / Não Funcionais

| ID | Descrição | Categoria |
|----|-----------|-----------|
| RNF-01 | **[Corrigido no commit `53df743` — UC-47-RNF-01]** O feedback de erro passou a usar o padrão de toast (`useToast`, `@/hooks/use-toast`) do restante do sistema, em substituição às 4 chamadas de `alert()` nativo do navegador anteriormente existentes em `ReportsView.tsx`: as 3 chamadas nos handlers de geração de relatório (`handleGenerateStockReport`, `handleGenerateExpirationReport`, `handleGenerateConsumptionReport`, ver Fluxo de Exceção 8a) e a chamada de validação de período vazio no relatório de Consumo (ver Fluxo Alternativo 7b, passo 3). **Nota histórica:** até esta correção, todo o feedback de erro desta tela era feito via `alert()` bloqueante, inconsistente com o padrão de toast usado no restante do sistema, incluindo outras telas do próprio módulo Clinic. | Usabilidade / Consistência |
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
- `src/components/reports/ReportsView.tsx` (`ReportsView`, `useToast` — ver RNF-01; banner de itens ignorados — ver RN-02)
- `src/lib/services/reportService.ts` (`generateStockValueReport`, `generateExpirationReport`, `generateConsumptionReport`, `exportToExcel`, `exportToCSV` — código morto)
- `src/hooks/use-toast.ts` (`useToast`, padrão adotado na correção do RNF-01)
- `src/components/clinic/ClinicLayout.tsx` (`navLinks` — inclui "Relatórios")
- `firestore.rules` (linhas 53-62 — regra genérica de subcoleções do tenant)
- `src/app/(consultant)/consultant/reports/page.tsx` (placeholder "Em Desenvolvimento", fora do escopo deste UC — RN-07)
- Commit da correção: `53df743` (`fix: lote de correções de baixa severidade (UC-04, UC-08, UC-30, UC-37, UC-47)`) — troca `alert()` nativo por `toast()` padrão do sistema (RNF-01)
- Commit da correção: `70a38d7` (`fix: quatro itens de media severidade (UC-39, UC-45, UC-47, UC-48)`) — adiciona contagem de `itens_ignorados` e banner de aviso no Relatório de Vencimento (RN-02)

---

## 14. Perguntas em Aberto / Decisões Pendentes

⚠️ Os itens abaixo são achados confirmados por leitura de código que representam decisões de produto pendentes de confirmação — não foram decididos unilateralmente por este documento.

1. **[RESOLVIDO — commit `70a38d7`]** RN-02 — itens com data de validade inválida/não interpretável agora são contados em `itens_ignorados` e sinalizados por um banner de aviso amarelo no relatório, deixando explícito que o "Valor em Risco" pode estar subestimado.
2. **[Observação]** RN-01 — o nome "Produtos Vencendo" pode confundir usuários, já que o relatório também inclui produtos já vencidos. É intencional (nome mantido por simplicidade) ou vale renomear/ajustar a UI para deixar isso explícito?
3. **[Observação]** RN-05 — `exportToCSV` é código morto. Remover, ou manter como alternativa futura de exportação?
4. **[Observação, não bloqueante]** RN-07 — `/consultant/reports` é um placeholder sem lógica real; não foi mapeado como UC nesta rodada por não representar comportamento de negócio implementado. Deve ser tratado como pendência de roadmap, não como lacuna de documentação.

Nenhuma pendência bloqueante remanescente sobre RNF-01 ou RN-02 — ambos os achados críticos deste UC (feedback de erro e itens ignorados no relatório de vencimento) já foram corrigidos, respectivamente nos commits `53df743` e `70a38d7`.

---

## 15. Histórico de Versões

| Versão | Data | Autor | O que mudou |
|--------|------|-------|--------------|
| 1.0 | 15/07/2026 | Guilherme Scandelari | Versão inicial, investigada por leitura completa de `ReportsPage`, `ReportsView`, `reportService.ts` (as três funções de geração + utilitários de exportação), `ClinicLayout.tsx` e `firestore.rules`. Confirmado que este é o único módulo de relatórios do módulo Clinic totalmente funcional, e que a tela equivalente do Portal Consultor (`/consultant/reports`) é apenas um placeholder "Em Desenvolvimento", sem nenhuma lógica real — por isso não foi mapeada como UC separado nesta rodada (RN-07). Identificados achados: o Relatório de "Produtos Vencendo" também inclui produtos já vencidos (RN-01); itens com data de validade em formato inválido são omitidos silenciosamente (RN-02); apenas um relatório é exibido por vez, mesmo com múltiplos calculados em memória (RN-04); e `exportToCSV` é código morto (RN-05). |
| 1.0.1 | 18/07/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-47-RNF-01): as 4 chamadas de `alert()` nativo em `ReportsView.tsx` (3 nos handlers de erro de geração de relatório, 1 na validação de período vazio do relatório de Consumo) foram substituídas por `toast()` do hook `useToast` (`@/hooks/use-toast`), corrigido no commit `53df743`. Atualizados Pós-condição 4.2, Fluxo Alternativo 7b (passo 3), Fluxo de Exceção 8a, RNF-01 (marcado `[Corrigido]`) e referências (Seção 13). Nenhum item da Seção 14 estava associado a RNF-01; nenhuma alteração feita nessa seção além de uma nota final confirmando a ausência de pendência remanescente sobre o achado corrigido. |
| 1.0.2 | 03/08/2026 | Guilherme Scandelari (via uml-use-case-writer) | Correção pontual (UC-47-RN-02), commit `70a38d7`: itens de inventário com `dt_validade` inválida/não interpretável no Relatório de Vencimento passaram a ser contabilizados em um novo campo `itens_ignorados` (interface `ExpirationReport`) — incluindo um terceiro caso antes não coberto (`Invalid Date` sintaticamente aceito pelo construtor `Date`, ex.: `"2025-13-45"`, que era descartado silenciosamente pela comparação `NaN <= limitDate`). `ReportsView.tsx` ganhou um banner de aviso amarelo (visível quando `itens_ignorados > 0`) alertando que o "Valor em Risco" pode estar subestimado. Atualizados Pós-condição de Sucesso (4.1), Fluxo Alternativo 7a, Fluxo de Exceção 8b (reescrito como histórico "[Corrigido]"), RN-02 (marcada `[CORRIGIDO]`), Referências (Seção 13) e item 1 da Seção 14 (marcado `[RESOLVIDO]`). |
