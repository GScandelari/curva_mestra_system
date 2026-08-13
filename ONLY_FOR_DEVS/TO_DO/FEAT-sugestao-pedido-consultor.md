# Feature: Sugestão de Pedido Rennova para o Consultor

**Projeto:** Curva Mestra
**Data:** 08/05/2026
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/sugestao-pedido-consultor`
**Prioridade:** Média

> Com base no histórico de consumo da clínica, o sistema gera automaticamente uma lista de sugestão de reposição dos produtos Rennova. O consultor chega à visita já sabendo o que o cliente precisa comprar — deixando de ser um "tirador de pedido" e passando a ser um parceiro estratégico.

---

## Contexto

O consultor Rennova visita periodicamente suas clínicas para verificar o andamento e sugerir novos pedidos. Hoje esse processo depende de conversas informais e observação visual do estoque. Com os dados de consumo histórico já registrados no sistema, é possível calcular automaticamente quais produtos estão abaixo do ponto de reabastecimento e sugerir quantidades de reposição.

---

## Escopo (Macro)

### Lógica de sugestão
- Para cada produto Rennova da clínica (`brand == "Rennova"`), calcular:
  - **Consumo médio por período** (ex: últimos 30 dias) com base nas solicitações concluídas.
  - **Estoque atual disponível.**
  - **Dias de estoque restante** = `quantidade_disponivel / consumo_medio_diario`.
- Sugerir reposição quando os dias de estoque restante estiverem abaixo de um threshold configurável (ex: 30 dias).
- A quantidade sugerida de reposição deve cobrir um ciclo padrão (ex: 60 dias de consumo médio).

### Pontos de entrada
- **Na view de inventário da clínica pelo consultor** (`/consultant/clinics/[tenantId]/inventory`): exibir uma seção ou banner "Sugestão de Pedido" com a lista de produtos que precisam de reposição.
- **Seção dedicada** no portal do consultor (`/consultant/clinics/[tenantId]/reorder` ou similar): visão completa e exportável da sugestão de pedido para a clínica selecionada.

### Exportação
- A lista de sugestão deve ser exportável (ex: botão "Copiar lista" ou "Exportar Excel") para facilitar o repasse ao cliente ou ao time interno da Rennova.

### Produto sem histórico de consumo
- Se o produto nunca teve consumo registrado, exibir como "sem dados suficientes" — não sugerir quantidade, mas informar o estoque atual.

---

## Critérios de Aceite (Alto Nível)

- [ ] Consultor vê a lista de sugestão de reposição na view de inventário da clínica
- [ ] A sugestão é baseada no consumo histórico das solicitações concluídas
- [ ] Produtos sem histórico são indicados como "sem dados suficientes"
- [ ] Existe uma página/seção dedicada para a sugestão de pedido completa
- [ ] A lista pode ser exportada ou copiada facilmente
- [ ] O cálculo considera apenas produtos Rennova (`brand == "Rennova"`)
- [ ] A clínica não vê nem tem acesso a essa funcionalidade (exclusiva do consultor)
