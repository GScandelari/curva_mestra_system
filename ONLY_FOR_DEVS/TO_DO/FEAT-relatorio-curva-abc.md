# Feature: Relatório Curva ABC de Consumo

**Projeto:** Curva Mestra
**Data:** 08/05/2026
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/relatorio-curva-abc`
**Prioridade:** Média

> Relatório estratégico que classifica os produtos do inventário pelo volume de consumo em um período, identificando quais produtos concentram a maior parte do giro da clínica. Ferramenta essencial para o planejamento de compras e para a consultoria estratégica do consultor Rennova.

---

## Contexto

A Curva ABC é uma técnica clássica de gestão de estoque que divide os itens em três grupos:

- **Classe A:** itens que representam ~80% do consumo total (poucos produtos, alto giro).
- **Classe B:** itens que representam ~15% do consumo (importância intermediária).
- **Classe C:** itens que representam ~5% do consumo (muitos produtos, baixo giro).

No contexto do Curva Mestra, esse relatório ajuda a clínica a entender quais procedimentos e produtos são o coração da operação, e ajuda o consultor a priorizar o foco de vendas nos produtos da classe A.

Os 3 relatórios existentes (valor de estoque, vencimento, consumo por período) não cobrem essa classificação estratégica.

---

## Escopo (Macro)

- **Fonte de dados:** solicitações com status `concluida` dentro de um período configurável.
- **Agrupamento:** por produto (código + nome), somando quantidade total consumida e valor total consumido.
- **Classificação:** ordenar por consumo decrescente e calcular o percentual acumulado para atribuir classe A, B ou C.
- **Filtro opcional:** permitir filtrar por apenas produtos Rennova ou todos os produtos.
- **Visualização:** tabela com ranking, classe (A/B/C), quantidade consumida, valor consumido e percentual acumulado. Gráfico de barras ou pizza é desejável mas não obrigatório no MVP.
- **Exportação:** Excel, seguindo o padrão dos demais relatórios.
- **Acesso:** disponível para clínica (todos os produtos) e para consultor (apenas produtos Rennova, readOnly).

---

## Critérios de Aceite (Alto Nível)

- [ ] Relatório exibe a classificação A/B/C de cada produto consumido no período selecionado
- [ ] Período é configurável pelo usuário
- [ ] Produtos são ordenados por consumo decrescente com percentual acumulado
- [ ] Exportação para Excel funciona com os dados do relatório
- [ ] Consultor vê apenas produtos Rennova classificados (readOnly)
- [ ] Clínica vê todos os produtos classificados
- [ ] O relatório aparece na seção de relatórios da clínica e na view de relatórios do consultor
