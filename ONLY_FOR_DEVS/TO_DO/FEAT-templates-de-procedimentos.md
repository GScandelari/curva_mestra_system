# Feature: Protocolos de Procedimentos

**Projeto:** Curva Mestra
**Data:** 08/05/2026 (atualizado 09/05/2026)
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/protocolos-de-procedimentos`
**Prioridade:** Alta

> O módulo de solicitações já existe, mas não há o conceito de protocolo de procedimento. Hoje o usuário seleciona os produtos manualmente ao criar cada solicitação. Esta feature introduz protocolos pré-configurados (ex: "Bioestimulação com Elleva", "Preenchimento Labial") que, ao serem selecionados, sugerem automaticamente os itens a serem consumidos — reduzindo o trabalho do clínico e garantindo dados mais precisos de consumo.

---

## Contexto

A clínica realiza procedimentos recorrentes com combinações previsíveis de materiais (preenchedores, cânulas, seringas, anestésicos). Registrar manualmente cada produto a cada atendimento é trabalhoso e propenso a esquecimentos, o que prejudica a métrica de precisão de estoque — o KPI principal do MVP.

Protocolos resolvem esse problema ao padronizar o vínculo entre "tipo de procedimento" e "materiais consumidos", permitindo que o registro seja rápido mesmo entre um paciente e outro.

---

## Decisões de Produto

| Decisão | Definição |
|---|---|
| Nome no produto | **Protocolos** (não "templates") |
| Navegação | Entrada "Protocolos" na barra superior do clinic admin, no mesmo nível de Estoque e Procedimentos |
| Fonte dos produtos | **Inventário histórico da clínica** — distinct por `codigo_produto` em `tenants/{tenantId}/inventory`, independente de ter estoque disponível atualmente |
| Produtos são sugestões | O clínico pode ajustar quantidades, adicionar ou remover antes de confirmar a solicitação |
| Uso obrigatório | Não — o fluxo manual de seleção continua funcionando normalmente |

---

## Escopo (Macro)

- **Gestão de protocolos (clinic_admin):** CRUD de protocolos. Cada protocolo tem um nome e uma lista de produtos do inventário histórico com quantidades sugeridas.
- **Uso no fluxo de solicitação:** Ao criar uma nova solicitação, o usuário pode optar por selecionar um protocolo. Os produtos do protocolo são carregados como ponto de partida; o usuário pode ajustar antes de confirmar.
- **Protocolos não são obrigatórios:** O fluxo manual de seleção de produtos deve continuar funcionando normalmente.
- **Produtos do protocolo são sugestões:** O clínico pode adicionar, remover ou alterar quantidades antes de salvar a solicitação.

---

## Estrutura Firestore

```
tenants/{tenantId}/protocolos/{protocoloId}
  nome: string                        — ex: "Bioestimulação com Elleva"
  descricao?: string                  — descrição livre opcional
  itens: [
    {
      codigo_produto: string
      nome_produto: string            — desnormalizado para leitura rápida
      quantidade_sugerida: number
    }
  ]
  active: boolean
  created_at: Timestamp
  updated_at: Timestamp
  created_by: string                  — uid do clinic_admin
```

**Fonte dos produtos disponíveis para seleção:**
Query `tenants/{tenantId}/inventory` com distinct por `codigo_produto` + `nome_produto` — retorna todos os produtos que a clínica já teve, independente de quantidade disponível atual.

---

## Critérios de Aceite (Alto Nível)

- [ ] Entrada "Protocolos" na barra de navegação superior do clinic admin
- [ ] clinic_admin pode criar, editar e excluir protocolos
- [ ] Cada protocolo possui nome, descrição opcional e lista de produtos com quantidade sugerida
- [ ] Produtos disponíveis para seleção vêm do inventário histórico da clínica (distinct por codigo_produto)
- [ ] Ao criar uma solicitação, é possível selecionar um protocolo e ter os produtos pré-carregados
- [ ] Os produtos pré-carregados podem ser ajustados antes de confirmar
- [ ] Solicitações criadas a partir de protocolo e criadas manualmente coexistem sem conflito
- [ ] O nome do protocolo é registrado na solicitação para uso futuro em relatórios
