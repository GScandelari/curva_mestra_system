# Feature: Relatório de Custo por Procedimento

**Projeto:** Curva Mestra
**Data:** 08/05/2026
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/relatorio-custo-por-procedimento`
**Prioridade:** Média

> Relatório que calcula o custo total de materiais consumidos por tipo de procedimento realizado. Permite que a clínica entenda o custo real de cada serviço e tome decisões de precificação baseadas em dados — não em estimativas.

---

## Contexto

Uma das maiores dificuldades das clínicas de HOF é precificar corretamente seus procedimentos. Muitos profissionais estimam o custo de material "de cabeça" ou com base em tabelas desatualizadas. Com o consumo de inventário registrado em cada solicitação concluída, o Curva Mestra já tem os dados necessários para calcular o custo real de material por atendimento.

Este relatório transforma esses dados operacionais em inteligência financeira diretamente acionável.

---

## Escopo (Macro)

- **Fonte de dados:** solicitações com status `concluida` dentro de um período configurável.
- **Agrupamento:** por tipo/nome de procedimento (campo `descricao` da solicitação ou nome do template, se utilizado).
- **Cálculo por grupo:**
  - Número de procedimentos realizados.
  - Custo médio de material por procedimento (soma dos `valor_unitario * quantidade_consumida` dos produtos de cada solicitação, dividida pelo número de solicitações do grupo).
  - Custo total de material do período para esse tipo de procedimento.
- **Granularidade opcional:** ao expandir um tipo de procedimento, exibir o breakdown de materiais consumidos (qual produto, quantidade média, custo médio).
- **Período configurável** pelo usuário.
- **Exportação:** Excel, seguindo o padrão dos demais relatórios.
- **Acesso:** disponível apenas para a clínica (`clinic_admin`). O consultor **não** acessa este relatório — ele contém informações financeiras internas da clínica.

---

## Critérios de Aceite (Alto Nível)

- [ ] Relatório agrupa procedimentos concluídos por nome/tipo e exibe custo médio de material
- [ ] O período de análise é configurável
- [ ] É possível expandir um tipo de procedimento para ver o breakdown de materiais
- [ ] Exportação para Excel disponível
- [ ] Acesso restrito a `clinic_admin` — consultor não vê este relatório
- [ ] Se procedimentos usaram templates, o nome do template é usado como agrupador
- [ ] Procedimentos sem template são agrupados pelo campo `descricao` da solicitação
