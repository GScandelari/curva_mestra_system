# Feature: Campo Brand e Visibilidade Segmentada do Consultor

**Projeto:** Curva Mestra
**Data:** 08/05/2026
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/brand-e-visibilidade-consultor`
**Prioridade:** Alta

> Hoje o consultor visualiza todo o inventário da clínica em modo somente-leitura. A regra de negócio é que o consultor Rennova deve enxergar **apenas os produtos da marca Rennova** — nunca produtos de terceiros da clínica. Esta feature introduz o campo `brand` no modelo de dados e ajusta a view do consultor para filtrar por `brand == "Rennova"`.

---

## Contexto

A clínica pode ter no inventário tanto produtos Rennova quanto produtos de outras marcas (concorrentes, materiais de uso geral). Expor esses dados ao consultor Rennova seria uma violação de privacidade e poderia gerar desconforto comercial.

A solução é adicionar um campo `brand` explícito em cada item de inventário, populado automaticamente pelo fluxo de adição, e usar esse campo como filtro na view do consultor.

---

## Escopo (Macro)

### Modelo de dados
- Adicionar campo `brand: string` em `InventoryItem` e em `ProdutoMaster`.
- O campo é definido no momento da adição do produto ao inventário.

### Regras de atribuição de brand
- **Fluxo "Produtos Rennova"** (importação via NF-e ou seleção manual do catálogo Rennova): `brand` é definido como `"Rennova"` automaticamente, sem input do usuário.
- **Fluxo "Outras Marcas"**: o usuário informa a marca manualmente.
  - Se o valor digitado for `"Rennova"` (case-insensitive), o sistema aceita, atribui `brand = "Rennova"` e o produto passa a ser visível para o consultor.
  - Caso contrário, `brand` recebe o valor informado e o produto **não** aparece na view do consultor.

### Visibilidade do consultor
- As páginas `/consultant/clinics/[tenantId]/inventory` e qualquer outra view de inventário do consultor devem filtrar para exibir apenas itens onde `brand == "Rennova"`.
- A query Firestore (ou filtro client-side) deve ser atualizada para aplicar esse filtro antes de renderizar.

### Migração de dados
- Itens de inventário existentes importados via NF-e devem receber `brand = "Rennova"` via script de migração.
- Itens adicionados manualmente sem brand definida ficam com `brand = null` e **não aparecem** para o consultor.

---

## Critérios de Aceite (Alto Nível)

- [ ] Campo `brand` existe no modelo `InventoryItem` e em `ProdutoMaster`
- [ ] Importação via NF-e atribui `brand = "Rennova"` automaticamente
- [ ] Adição manual via "Produtos Rennova" atribui `brand = "Rennova"` automaticamente
- [ ] Adição manual via "Outras Marcas" exibe campo de texto para informar a marca
- [ ] Se o usuário digitar "Rennova" (qualquer capitalização) em "Outras Marcas", o sistema normaliza para `"Rennova"` e o produto aparece para o consultor
- [ ] A view do consultor exibe apenas itens com `brand == "Rennova"`
- [ ] Itens com `brand != "Rennova"` ou `brand == null` são invisíveis para o consultor
- [ ] Script de migração atualiza itens existentes importados via NF-e
