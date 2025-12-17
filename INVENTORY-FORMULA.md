# Fórmula de Inventário - Curva Mestra

## Fórmula Completa

```
quantidade_disponivel = quantidade_inicial - quantidade_consumida - quantidade_reservada
```

Ou, reorganizando:

```
quantidade_inicial = quantidade_disponivel + quantidade_reservada + quantidade_consumida
```

## Exemplo Prático

**Item X** com 50 unidades iniciais:
- 4 unidades em solicitação **agendada** ✓
- 3 unidades em solicitação **aprovada** ✓
- 3 unidades em solicitação **concluída** ✓

**Cálculo:**
```
quantidade_reservada = 4 + 3 = 7 (agendadas + aprovadas)
quantidade_consumida = 3 (concluídas)
quantidade_disponivel = 50 - 3 - 7 = 40
```

**Verificação:**
```
50 (inicial) = 40 (disponível) + 7 (reservada) + 3 (consumida) ✓
```

## Status de Solicitação e Impacto no Estoque

| Status      | Reserva? | Consumo? | Descrição                           |
|-------------|----------|----------|-------------------------------------|
| `criada`    | ❌       | ❌       | Criada, mas não reservou produtos   |
| `agendada`  | ✅       | ❌       | Reserva produtos, aguardando data   |
| `aprovada`  | ✅       | ❌       | Reserva mantida, aguardando conclusão |
| `concluida` | ❌       | ✅       | Libera reserva, consome estoque     |
| `reprovada` | ❌       | ❌       | Libera reserva, não consome         |
| `cancelada` | ❌       | ❌       | Libera reserva, não consome         |

## Transições de Status

### criada → agendada
```ts
quantidade_reservada += produtos_solicitados.sum(quantidade)
quantidade_disponivel -= produtos_solicitados.sum(quantidade)
```

### agendada → aprovada
```ts
// NENHUMA MUDANÇA - reserva permanece
// Os produtos continuam reservados até serem concluídos
```

### aprovada → concluida
```ts
quantidade_reservada -= produtos_solicitados.sum(quantidade)
// quantidade_disponivel NÃO muda (já estava reduzida quando agendou)
// O consumo é implícito: inicial - disponivel - reservada = consumida
```

### agendada → reprovada/cancelada
```ts
quantidade_reservada -= produtos_solicitados.sum(quantidade)
quantidade_disponivel += produtos_solicitados.sum(quantidade)
// Devolve os produtos ao estoque
```

### aprovada → cancelada
```ts
quantidade_reservada -= produtos_solicitados.sum(quantidade)
quantidade_disponivel += produtos_solicitados.sum(quantidade)
// Devolve os produtos ao estoque
```

### Edição de solicitação agendada
```ts
// 1. Liberar produtos antigos
quantidade_reservada -= produtos_antigos.sum(quantidade)
quantidade_disponivel += produtos_antigos.sum(quantidade)

// 2. Reservar novos produtos
quantidade_reservada += produtos_novos.sum(quantidade)
quantidade_disponivel -= produtos_novos.sum(quantidade)
```

## Auditoria de Inventário

A auditoria verifica se os valores estão corretos calculando:

1. **Reservas Esperadas**: soma de produtos em solicitações `agendada` + `aprovada`
2. **Consumo Esperado**: soma de produtos em solicitações `concluida`
3. **Disponível Esperado**: `inicial - consumido - reservado`

### Exemplo de Auditoria

```javascript
// Item no Firestore
{
  quantidade_inicial: 50,
  quantidade_reservada: 10,  // ATUAL
  quantidade_disponivel: 37  // ATUAL
}

// Calculando valores esperados
const reservaEsperada = 7;    // 4 agendadas + 3 aprovadas
const consumido = 3;          // 3 concluídas
const disponivelEsperado = 50 - 3 - 7 = 40;

// Comparando
reservada: 10 ≠ 7 ❌ (problema!)
disponivel: 37 ≠ 40 ❌ (problema!)
```

## Correção de Inventário

Quando a auditoria encontra problemas, a correção recalcula:

```javascript
// Para cada item com problema:
batch.update(itemRef, {
  quantidade_reservada: reservaEsperada,
  quantidade_disponivel: disponivelEsperado,
  updated_at: Timestamp.now()
});

// quantidade_inicial NUNCA é alterada!
```

## Arquivos Relevantes

### Backend (Transações)
- `src/lib/services/solicitacaoService.ts`
  - `updateSolicitacaoStatus()` - Gerencia transições de status
  - `updateSolicitacaoAgendada()` - Edição de solicitações agendadas

### Auditoria e Correção
- `src/app/(clinic)/clinic/inventory/audit/page.tsx` - Interface visual
- `dev-tools/audit-inventory-web.js` - Script de auditoria (console)
- `dev-tools/fix-inventory-web.js` - Script de correção (console)

## Regras Importantes

1. ✅ **Fórmula SEMPRE válida**: `inicial = disponível + reservada + consumida`
2. ✅ **quantidade_inicial é imutável** - nunca muda após entrada no estoque
3. ✅ **Reservas incluem**: agendadas + aprovadas (não concluídas)
4. ✅ **Consumo inclui**: apenas concluídas
5. ✅ **Transações atômicas**: leitura → processamento → escrita
6. ✅ **FEFO Strategy**: First Expired, First Out para seleção automática

## Debugging

Para verificar se um item está correto:

```javascript
console.log(`
Item: ${item.nome_produto}
Inicial: ${inicial}
Disponível: ${disponivel}
Reservada: ${reservada}
Consumida: ${consumida}

Soma: ${disponivel + reservada + consumida}
Válido: ${inicial === (disponivel + reservada + consumida) ? '✓' : '✗'}
`);
```

## Histórico de Mudanças

- **2024-12**: Correção da fórmula para incluir consumo (concluídas)
- **2024-12**: Adição de status `aprovada` nas reservas
- **2024-11**: Implementação inicial com reservas apenas em `agendada`
