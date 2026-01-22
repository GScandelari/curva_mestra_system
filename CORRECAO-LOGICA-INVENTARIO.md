# Correção da Lógica de Inventário

## 🎯 Objetivo

Implementar a fórmula completa de inventário em TODAS as operações, eliminando a necessidade de auditoria manual para corrigir inconsistências.

## 📐 Fórmula Implementada

```
quantidade_disponivel = quantidade_inicial - quantidade_consumida - quantidade_reservada
```

Onde:
- **quantidade_inicial**: Total de produtos recebidos (imutável)
- **quantidade_reservada**: Produtos reservados para procedimentos agendados/aprovados
- **quantidade_consumida**: Produtos usados em procedimentos concluídos (implícito)
- **quantidade_disponivel**: Produtos livres para novas reservas

## ✅ Correções Realizadas

### 1. ❌ **BUG CRÍTICO: Desconto duplicado ao concluir procedimento**

**Arquivo**: `src/lib/services/solicitacaoService.ts:472-482`

**Problema:**
```typescript
// ERRADO - descontava de disponível novamente!
else if (statusAnterior === "aprovada" && newStatus === "concluida") {
  const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;
  const novoDisponivel = itemData.quantidade_disponivel - produto.quantidade; // ❌ ERRADO!

  transaction.update(itemRef, {
    quantidade_reservada: Math.max(0, novaReserva),
    quantidade_disponivel: novoDisponivel, // ❌ Desconto em duplicata!
  });
}
```

**Correção:**
```typescript
// CORRETO - apenas libera a reserva
else if (statusAnterior === "aprovada" && newStatus === "concluida") {
  // Libera reserva (produtos são consumidos)
  // IMPORTANTE: NÃO mexe em quantidade_disponivel porque os produtos
  // já foram descontados quando a solicitação foi agendada.
  // O consumo é implícito: inicial - disponivel - reservada = consumida
  const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;

  transaction.update(itemRef, {
    quantidade_reservada: Math.max(0, novaReserva),
    updated_at: now,
  });
}
```

**Impacto:**
- Antes: Concluir procedimento → disponível descontado 2x (quando agendou + quando concluiu)
- Depois: Concluir procedimento → disponível mantém desconto original, apenas libera reserva

---

### 2. ❌ **BUG: Cancelamento não devolvia produtos**

**Arquivo**: `src/lib/services/solicitacaoService.ts:463-472, 486-495`

**Problema:**
```typescript
// ERRADO - não devolvia ao disponível!
else if (statusAnterior === "agendada" && (newStatus === "reprovada" || newStatus === "cancelada")) {
  const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;

  transaction.update(itemRef, {
    quantidade_reservada: Math.max(0, novaReserva),
    updated_at: now,
  });
  // ❌ Faltou devolver ao disponível!
}
```

**Correção:**
```typescript
// CORRETO - devolve ao disponível
else if (statusAnterior === "agendada" && (newStatus === "reprovada" || newStatus === "cancelada")) {
  const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;
  const novoDisponivel = (itemData.quantidade_disponivel || 0) + produto.quantidade;

  transaction.update(itemRef, {
    quantidade_reservada: Math.max(0, novaReserva),
    quantidade_disponivel: novoDisponivel, // ✅ Devolve ao estoque
    updated_at: now,
  });
}
```

**Impacto:**
- Antes: Cancelar/reprovar → produtos ficavam "perdidos" (nem reservados, nem disponíveis)
- Depois: Cancelar/reprovar → produtos retornam ao disponível corretamente

---

### 3. ❌ **BUG: Edição não ajustava disponível**

**Arquivo**: `src/lib/services/solicitacaoService.ts:641-720`

**Problema:**
```typescript
// ERRADO - só ajustava reserva, não disponível!
const reservasAjustadas = new Map<string, number>();

// Subtrair produtos antigos
for (const produtoAntigo of solicitacao.produtos_solicitados) {
  reservasAjustadas.set(id, reservaAtual - produtoAntigo.quantidade);
  // ❌ Faltou devolver ao disponível!
}

// Adicionar novos produtos
for (const produto of updates.produtos) {
  reservasAjustadas.set(id, reservaAtual + produto.quantidade);
  // ❌ Faltou descontar do disponível!
}
```

**Correção:**
```typescript
// CORRETO - ajusta reserva E disponível
const reservasAjustadas = new Map<string, number>();
const disponiveisAjustados = new Map<string, number>();

// Liberar produtos antigos (devolver reserva → disponível)
for (const produtoAntigo of solicitacao.produtos_solicitados) {
  reservasAjustadas.set(id, reservaAtual - produtoAntigo.quantidade);
  disponiveisAjustados.set(id, disponivelAtual + produtoAntigo.quantidade); // ✅
}

// Reservar novos produtos (disponível → reserva)
for (const produto of updates.produtos) {
  reservasAjustadas.set(id, reservaAtual + produto.quantidade);
  disponiveisAjustados.set(id, disponivelAtual - produto.quantidade); // ✅
}

// Aplicar ambos os ajustes
transaction.update(itemRef, {
  quantidade_reservada: novaReserva,
  quantidade_disponivel: Math.max(0, novoDisponivel), // ✅
  updated_at: now,
});
```

**Impacto:**
- Antes: Editar solicitação → disponível não era atualizado, causando inconsistência
- Depois: Editar solicitação → libera produtos antigos e reserva novos corretamente

---

### 4. ✅ **MELHORIA: Validação de estoque na edição**

**Arquivo**: `src/lib/services/solicitacaoService.ts:631-661`

**Antes:**
```typescript
// Validava apenas disponível atual (sem considerar liberação)
if (itemData.quantidade_disponivel < produto.quantidade) {
  throw new Error(`Estoque insuficiente`);
}
```

**Depois:**
```typescript
// Calcula disponível APÓS liberar produtos antigos
const disponivelAposLiberar = new Map<string, number>();

// Inicializar com disponível atual
produtosNovosData.forEach((itemData, itemId) => {
  disponivelAposLiberar.set(itemId, itemData.quantidade_disponivel || 0);
});

// Adicionar produtos antigos que serão liberados
for (const produtoAntigo of solicitacao.produtos_solicitados) {
  const disponivelAtual = disponivelAposLiberar.get(produtoAntigo.inventory_item_id) || 0;
  disponivelAposLiberar.set(
    produtoAntigo.inventory_item_id,
    disponivelAtual + produtoAntigo.quantidade
  );
}

// Validar com disponível ajustado
if (disponivelAposLib < produto.quantidade) {
  throw new Error(
    `Estoque insuficiente para ${itemData.nome_produto}. ` +
    `Disponível (após liberar produtos antigos): ${disponivelAposLib}, ` +
    `Solicitado: ${produto.quantidade}`
  );
}
```

**Impacto:**
- Permite edições válidas que eram bloqueadas antes
- Ex: Trocar 10 unidades do produto A por 10 do mesmo produto A → agora funciona

---

## 📊 Tabela de Transições Corrigidas

| Transição              | quantidade_reservada | quantidade_disponivel | Observação                      |
|------------------------|----------------------|-----------------------|---------------------------------|
| criada → agendada      | +X                   | -X                    | Reserva produtos                |
| agendada → aprovada    | (sem mudança)        | (sem mudança)         | Mantém reserva                  |
| aprovada → concluida   | -X                   | **(sem mudança)** ✅  | **CORRIGIDO**: não desconta 2x  |
| agendada → cancelada   | -X                   | **+X** ✅             | **CORRIGIDO**: devolve ao estoque |
| aprovada → cancelada   | -X                   | **+X** ✅             | **CORRIGIDO**: devolve ao estoque |
| Editar agendada        | **ajusta** ✅        | **ajusta** ✅         | **CORRIGIDO**: libera antigos + reserva novos |

## 🧪 Cenários de Teste

### Teste 1: Concluir Procedimento
```
ANTES da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Concluir 10 unidades → 40 - 10 = 30 disponível ❌ (ERRADO!)
- Resultado: 50 ≠ 30 + 0 (fórmula quebrada)

DEPOIS da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Concluir 10 unidades → 40 disponível (mantém), 0 reservado
- Resultado: 50 = 40 + 0 + 10 (consumido) ✅
```

### Teste 2: Cancelar Procedimento
```
ANTES da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Cancelar → 40 disponível (mantém) ❌, 0 reservado
- Resultado: 10 unidades "perdidas"

DEPOIS da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Cancelar → 50 disponível ✅, 0 reservado
- Resultado: 50 = 50 + 0 ✅
```

### Teste 3: Editar Solicitação
```
ANTES da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Editar de 10 para 5 → 40 disponível ❌, 5 reservado
- Resultado: 50 ≠ 40 + 5 (5 unidades perdidas)

DEPOIS da correção:
- Item X: 50 inicial, 40 disponível, 10 reservado
- Libera 10 → 50 disponível, 0 reservado
- Reserva 5 → 45 disponível ✅, 5 reservado ✅
- Resultado: 50 = 45 + 5 ✅
```

## 🎓 Comportamento Esperado

Agora, com as correções implementadas:

1. ✅ **Auditoria deve retornar ZERO problemas** após qualquer operação
2. ✅ **Fórmula sempre válida**: `inicial = disponivel + reservada + consumida`
3. ✅ **Não há "produtos perdidos"** em nenhum cenário
4. ✅ **Cancelamentos devolvem produtos** ao estoque corretamente
5. ✅ **Edições ajustam reserva E disponível** atomicamente
6. ✅ **Conclusões não descontam 2x** do disponível

## 📁 Arquivos Modificados

1. `src/lib/services/solicitacaoService.ts`
   - `updateSolicitacaoStatus()` - linhas 472-495
   - `updateSolicitacaoAgendada()` - linhas 631-720

2. `INVENTORY-FORMULA.md` - Documentação atualizada

3. `src/app/(clinic)/clinic/inventory/audit/page.tsx` - Auditoria com consumo

4. `dev-tools/audit-inventory-web.js` - Auditoria web com consumo

5. `dev-tools/fix-inventory-web.js` - Correção web com consumo

## ⚠️ Migração de Dados Existentes

Se houver dados inconsistentes no banco:

1. Rode a auditoria: `http://localhost:3000/clinic/inventory/audit`
2. Revise os problemas encontrados
3. Clique em "Corrigir Todos os Itens"
4. Rode a auditoria novamente para confirmar

## 📝 Notas Importantes

- `quantidade_inicial` **NUNCA** é alterada (é a fonte da verdade)
- `quantidade_consumida` é **implícita** (calculada pela auditoria)
- Todas as operações seguem a mesma fórmula consistentemente
- Transações garantem atomicidade (tudo ou nada)

---

**Data da Correção**: Dezembro 2024
**Versão**: 1.0
**Status**: ✅ Implementado e Testado
