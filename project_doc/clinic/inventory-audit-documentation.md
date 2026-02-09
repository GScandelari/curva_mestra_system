# Documentação Experimental - Auditoria de Inventário

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Inventário
**Componente:** Auditoria de Inventário (`/clinic/inventory/audit`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Ferramenta de auditoria que verifica e corrige inconsistências nos valores de `quantidade_reservada` e `quantidade_disponivel` do inventário. Compara os valores armazenados no Firestore com os valores esperados calculados a partir dos procedimentos (solicitações) nos status `agendada`, `aprovada` e `concluida`. Permite correção atômica em batch de todos os itens com problemas.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/inventory/audit/page.tsx`
- **Rota:** `/clinic/inventory/audit`
- **Layout:** Clinic Layout (com header próprio contendo link de retorno)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação e claims do usuário
- **Firebase Firestore:** `collection`, `getDocs`, `query`, `where`, `writeBatch`, `Timestamp`, `doc`
- **Types:** `InventoryItem` de `src/types`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge, Alert, AlertDescription, AlertTitle
- **Lucide Icons:** ArrowLeft, AlertTriangle, CheckCircle, RefreshCw
- **Next.js:** `Link` para navegação

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Executar auditoria, visualizar resultados e corrigir itens
- **Comportamento:** Pode executar auditoria e aplicar correções em batch
- **Restrições:** Vinculado a um `tenant_id` específico

### 2.2 Usuário de Clínica (`clinic_user`)
- **Descrição:** Usuário operacional de uma clínica
- **Acesso:** Mesmo acesso do `clinic_admin` nesta página
- **Comportamento:** Idêntico ao admin — sem diferenciação de role no código
- **Restrições:** Vinculado a um `tenant_id` específico

---

## 3. Estrutura de Dados

### 3.1 Interface AuditResult

```typescript
interface AuditResult {
  id: string;                    // ID do documento no Firestore
  nome: string;                  // Nome do produto (fallback: codigo_produto)
  lote: string;                  // Lote do produto
  inicial: number;               // Quantidade inicial do item
  reservadaAtual: number;        // Valor atual de quantidade_reservada
  disponivelAtual: number;       // Valor atual de quantidade_disponivel
  reservadaEsperada: number;     // Valor esperado calculado pelas solicitações
  disponivelEsperado: number;    // Valor esperado (inicial - consumido - reservada)
  problemaReserva: boolean;      // true se reservadaAtual !== reservadaEsperada
  problemaDisponivel: boolean;   // true se disponivelAtual !== disponivelEsperado
}
```

**Campos Principais:**
- **reservadaEsperada:** Soma das quantidades em solicitações `agendada` + `aprovada` que referenciam o item
- **disponivelEsperado:** `Math.max(0, inicial - consumido - reservadaEsperada)` — nunca negativo
- **consumido:** Soma das quantidades em solicitações `concluida` que referenciam o item

### 3.2 Estruturas Auxiliares de Cálculo

```typescript
// Maps usados durante a auditoria
const reservasEsperadas = new Map<string, number>();     // inventory_item_id → total reservado
const quantidadesConsumidas = new Map<string, number>();  // inventory_item_id → total consumido
```

---

## 4. Casos de Uso

### 4.1 UC-001: Executar Auditoria

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Usuário autenticado com `tenant_id` válido
- Botão "Executar Auditoria" habilitado

**Fluxo Principal:**
1. Usuário clica em "Executar Auditoria"
2. Sistema busca inventário ativo (`active == true`)
3. Sistema busca solicitações com status `agendada`, `aprovada` e `concluida` em paralelo
4. Para cada solicitação, soma quantidades por `inventory_item_id` em Maps
5. Para cada item do inventário, compara valores atuais com esperados
6. Itens com diferenças são adicionados aos resultados

**Pós-condições:**
- Resumo exibido: itens corretos vs. itens com problemas
- Se tudo correto: Alert verde "Tudo Certo!"
- Se problemas: lista detalhada + botão de correção

---

### 4.2 UC-002: Visualizar Resultados

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Auditoria executada com sucesso

**Fluxo Principal:**
1. Grid de resumo mostra "Itens Corretos" (verde) e "Itens com Problemas" (laranja)
2. Para cada item com problema, card exibe:
   - Nome e lote do produto
   - Badges indicando tipo: "Reserva" e/ou "Disponível"
   - Quantidade inicial
   - Comparação: valor atual (vermelho/laranja) vs. esperado (verde)

**Pós-condições:**
- Usuário pode avaliar a gravidade das inconsistências

---

### 4.3 UC-003: Corrigir Inventário

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Auditoria executada com resultados > 0
- Botão "Corrigir Todos os Itens" visível

**Fluxo Principal:**
1. Usuário clica em "Corrigir Todos os Itens"
2. `confirm()` nativo exibe aviso com número de itens afetados
3. Se confirmado, `writeBatch` atualiza todos os itens atomicamente
4. Campos atualizados: `quantidade_reservada`, `quantidade_disponivel`, `updated_at`
5. Alert verde "Correção Aplicada!" exibido
6. Auditoria re-executada automaticamente após 1 segundo

**Fluxo Alternativo — Cancelamento:**
1. Usuário cancela no `confirm()`
2. Nenhuma ação executada

**Pós-condições:**
- Inventário corrigido no Firestore
- Re-auditoria confirma que problemas foram resolvidos

---

### 4.4 UC-004: Erro na Auditoria/Correção

**Ator:** clinic_admin / clinic_user
**Pré-condições:**
- Falha na comunicação com Firestore

**Fluxo Principal:**
1. Erro capturado no try/catch
2. `alert()` nativo exibe mensagem de erro
3. Console.error registra detalhes

**Mensagens de Erro:**
- Auditoria: "Erro ao auditar inventário"
- Correção: "Erro ao corrigir inventário"

**Pós-condições:**
- Nenhuma alteração feita no Firestore (em caso de erro na correção, batch não é commitado)

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDITORIA DE INVENTÁRIO                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌────────────────────┐
                  │ Clique: "Executar  │
                  │ Auditoria"         │
                  └────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────┐
           │ Promise.all([                │
           │   getDocs(inventory active), │
           │   getDocs(agendadas),        │
           │   getDocs(aprovadas),        │
           │   getDocs(concluidas)        │
           │ ])                           │
           └──────────────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────┐
           │ Calcular Maps:               │
           │ - reservasEsperadas          │
           │ - quantidadesConsumidas      │
           └──────────────────────────────┘
                              │
                              ▼
           ┌──────────────────────────────┐
           │ Para cada item:              │
           │ comparar atual vs esperado   │
           └──────────────────────────────┘
                         │         │
                   OK    │         │  DIVERGÊNCIA
                         │         │
                         ▼         ▼
              ┌──────────────┐  ┌──────────────────┐
              │ "Tudo Certo!"│  │ Lista de itens   │
              │ Alert verde  │  │ com problemas    │
              └──────────────┘  └──────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ "Corrigir Todos" │
                              │ + confirm()      │
                              └──────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ writeBatch()     │
                              │ commit()         │
                              └──────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ Re-executar      │
                              │ auditoria (1s)   │
                              └──────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Cálculo de Reservas Esperadas
**Descrição:** Reservas esperadas = soma das quantidades em solicitações com status `agendada` + `aprovada`
**Aplicação:** Iteração por `produtos_solicitados[].inventory_item_id` e `produtos_solicitados[].quantidade`
**Exceções:** Solicitações `criada`, `reprovada` ou `cancelada` não contam como reserva
**Justificativa:** Apenas procedimentos confirmados devem reservar estoque

### RN-002: Cálculo de Quantidades Consumidas
**Descrição:** Consumido = soma das quantidades em solicitações com status `concluida`
**Aplicação:** Mesma iteração por `produtos_solicitados`
**Exceções:** Nenhuma
**Justificativa:** Procedimentos concluídos representam consumo efetivo

### RN-003: Fórmula de Disponível Esperado
**Descrição:** `disponível_esperado = max(0, inicial - consumido - reservadaEsperada)`
**Aplicação:** Cálculo por item durante a auditoria
**Exceções:** Nunca retorna valor negativo (proteção via `Math.max(0, ...)`)
**Justificativa:** Disponível é o que resta após consumo e reservas

### RN-004: Critério de Problema
**Descrição:** Item tem problema se `reservadaAtual !== reservadaEsperada` OU `disponivelAtual !== disponivelEsperado`
**Aplicação:** Comparação exata (sem tolerância)
**Exceções:** Nenhuma
**Justificativa:** Qualquer divergência pode indicar corrupção de dados

### RN-005: Correção Atômica em Batch
**Descrição:** Todos os itens são corrigidos em uma única operação `writeBatch`
**Aplicação:** Atualiza `quantidade_reservada`, `quantidade_disponivel` e `updated_at`
**Exceções:** Se o batch falhar, nenhum item é atualizado
**Justificativa:** Atomicidade garante consistência — todos ou nenhum

### RN-006: Re-auditoria Automática
**Descrição:** Após correção bem-sucedida, auditoria é re-executada com delay de 1 segundo
**Aplicação:** `setTimeout(() => runAudit(), 1000)`
**Exceções:** Nenhuma
**Justificativa:** Confirmação visual de que a correção foi efetiva

### RN-007: Apenas Itens Ativos
**Descrição:** Somente itens com `active == true` são auditados
**Aplicação:** Filtro `where("active", "==", true)` na query de inventário
**Exceções:** Itens inativos são ignorados
**Justificativa:** Itens excluídos logicamente não precisam de auditoria

### RN-008: Multi-Tenant
**Descrição:** Todas as queries filtradas por `tenantId`
**Aplicação:** Paths `tenants/{tenantId}/inventory` e `tenants/{tenantId}/solicitacoes`
**Exceções:** Nenhuma
**Justificativa:** Isolamento de dados entre clínicas

---

## 7. Estados da Interface

### 7.1 Estado: Inicial
**Quando:** Página carregada, auditoria ainda não executada
**Exibição:**
- Header com link "Voltar ao Inventário"
- Alert informativo "Como funciona"
- Card com botão "Executar Auditoria"
**Interações:** Botão habilitado se `tenantId` existe

### 7.2 Estado: Executando Auditoria
**Quando:** Auditoria em andamento
**Exibição:**
- Ícone RefreshCw com animação `animate-spin`
- Texto do botão: "Auditando..."
- Botão desabilitado
**Duração:** Até queries completarem

### 7.3 Estado: Tudo Certo
**Quando:** Auditoria concluída sem problemas (`auditResults.length === 0` e `totalItems > 0`)
**Exibição:**
- Grid de resumo: Itens Corretos (verde) / Itens com Problemas (0)
- Alert verde com CheckCircle: "Tudo Certo!" + "Nenhum problema encontrado no inventário"

### 7.4 Estado: Problemas Encontrados
**Quando:** `auditResults.length > 0`
**Exibição:**
- Grid de resumo com contagens
- Alert destructive: "Problemas Encontrados"
- Lista de cards por item com comparações de valores
- Botão "Corrigir Todos os Itens" (variant `destructive`)

### 7.5 Estado: Corrigindo
**Quando:** Correção em batch em andamento
**Exibição:**
- Botão "Corrigindo..." desabilitado
**Duração:** Até batch.commit() completar

### 7.6 Estado: Correção Aplicada
**Quando:** Batch commit bem-sucedido
**Exibição:**
- Alert verde: "Correção Aplicada!" + "Os itens foram corrigidos com sucesso"
- Re-auditoria automática após 1 segundo

---

## 8. Validações

### 8.1 Validações de Frontend
- **tenantId:**
  - Botão "Executar Auditoria" desabilitado se `tenantId` nulo
  - `runAudit()` retorna sem ação se `tenantId` nulo

- **auditResults:**
  - `fixInventory()` retorna sem ação se `auditResults.length === 0`
  - Botão de correção só visível se há resultados

- **Confirmação:**
  - `confirm()` nativo obrigatório antes da correção
  - Mensagem informa quantidade de itens afetados

### 8.2 Validações de Backend
- **Queries Firestore:** Filtros `active == true` (inventário) e `status` (solicitações)
- **writeBatch:** Operação atômica — sucesso total ou nenhuma alteração

### 8.3 Validações de Permissão
- **Acesso à página:** Controlado pelo Clinic Layout
- **Dados do tenant:** Queries usam paths com `tenantId`
- **Sem restrição de role:** Tanto admin quanto user podem executar correções

---

## 9. Integrações

### 9.1 Firestore — getDocs (Inventário)
- **Tipo:** Query pontual
- **Coleção:** `tenants/{tenantId}/inventory`
- **Filtro:** `where("active", "==", true)`
- **Operações:** Read
- **Quando:** Clique em "Executar Auditoria"

### 9.2 Firestore — getDocs (Solicitações)
- **Tipo:** 3 queries paralelas via `Promise.all`
- **Coleção:** `tenants/{tenantId}/solicitacoes`
- **Filtros:** `status == "agendada"`, `status == "aprovada"`, `status == "concluida"`
- **Operações:** Read
- **Quando:** Junto com a query de inventário

### 9.3 Firestore — writeBatch (Correção)
- **Tipo:** Escrita em batch (atômica)
- **Coleção:** `tenants/{tenantId}/inventory`
- **Operações:** Update (`quantidade_reservada`, `quantidade_disponivel`, `updated_at`)
- **Quando:** Clique em "Corrigir Todos os Itens" + confirmação

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via `tenantId` nos paths das queries
- ✅ Confirmação obrigatória antes de correção (`confirm()`)
- ✅ Operação de escrita atômica via `writeBatch` (tudo ou nada)
- ✅ Tratamento de erros em todas as operações assíncronas

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Sem restrição de role — `clinic_user` pode executar correções no inventário (operação normalmente restrita a admin)
- **Mitigação:** Considerar adicionar check `isAdmin` antes de permitir a correção

### 10.3 Dados Sensíveis
- **Quantidades de estoque:** Valores visíveis para todos os usuários do tenant
- **Operações de escrita:** Batch atualiza `updated_at` com timestamp do servidor

---

## 11. Performance

### 11.1 Métricas
- **Requisições:** 4 queries paralelas (1 inventário + 3 solicitações) + 1 batch write
- **Processamento:** Iteração em memória sobre todos os documentos

### 11.2 Otimizações Implementadas
- ✅ Queries de solicitações executadas em paralelo via `Promise.all`
- ✅ Maps para lookup O(1) ao comparar valores por item
- ✅ Batch write para correção atômica (1 operação em vez de N)

### 11.3 Gargalos Identificados
- ⚠️ Carrega TODOS os documentos de inventário e solicitações em memória
- ⚠️ Para clínicas com muitos procedimentos, as 3 queries de solicitações podem ser lentas
- **Plano de melhoria:** Considerar Cloud Function para auditoria server-side em inventários grandes

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Alerts com ícones e texto (não dependem apenas de cor)
- ✅ Badges com texto descritivo ("Reserva", "Disponível")
- ✅ Cores contrastantes: verde (correto), vermelho (erro), laranja (alerta)
- ✅ Link de navegação com ícone + texto

### 12.3 Melhorias Necessárias
- [ ] Substituir `confirm()` nativo por modal acessível
- [ ] Substituir `alert()` nativo por toast acessível
- [ ] Adicionar aria-live para atualizações de status
- [ ] Melhorar feedback de screen reader nos resultados

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Auditoria sem problemas**
   - **Dado:** Inventário com valores consistentes
   - **Quando:** Clique em "Executar Auditoria"
   - **Então:** Alert verde "Tudo Certo!", todos os itens contados como corretos

2. **Auditoria com inconsistências**
   - **Dado:** Item com `quantidade_reservada` diferente do esperado
   - **Quando:** Clique em "Executar Auditoria"
   - **Então:** Item listado com badge "Reserva" e valores comparados

3. **Correção bem-sucedida**
   - **Dado:** Itens com problemas identificados
   - **Quando:** Clique em "Corrigir Todos" + confirmação
   - **Então:** Batch commit, alert verde, re-auditoria mostra "Tudo Certo!"

4. **Cancelamento de correção**
   - **Dado:** Itens com problemas identificados
   - **Quando:** Clique em "Corrigir Todos" + cancel no confirm
   - **Então:** Nenhuma alteração feita

### 13.2 Casos de Teste de Erro
1. **Erro de rede na auditoria:** `alert("Erro ao auditar inventário")`
2. **Erro de rede na correção:** `alert("Erro ao corrigir inventário")`, nenhum item alterado
3. **tenant_id ausente:** Botão desabilitado, auditoria não executa

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar com dados de solicitações em múltiplos status
- [ ] Testar atomicidade do batch (falha parcial → nenhuma alteração)
- [ ] Testar isolamento multi-tenant

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Histórico de auditorias executadas
- [ ] Correção seletiva (escolher quais itens corrigir)
- [ ] Relatório exportável dos resultados
- [ ] Agendamento automático de auditoria periódica

### 14.2 UX/UI
- [ ] Substituir `confirm()` e `alert()` nativos por modais Shadcn
- [ ] Progress bar durante a auditoria
- [ ] Filtros na lista de problemas (apenas reserva, apenas disponível)

### 14.3 Performance
- [ ] Cloud Function para auditoria server-side
- [ ] Paginação para inventários grandes

### 14.4 Segurança
- [ ] Restringir correção apenas a `clinic_admin`
- [ ] Logging de correções para auditoria

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Listagem de Inventário (`/clinic/inventory`):** Destino do link "Voltar ao Inventário"
- **Procedimentos/Solicitações:** Dados de solicitações são a base do cálculo de auditoria

### 15.2 Fluxos que Passam por Esta Página
1. **Inventário → Auditoria:** Acesso direto via URL
2. **Auditoria → Inventário:** Via link "Voltar ao Inventário"

### 15.3 Impacto de Mudanças
- **Alto impacto:** Estrutura de `produtos_solicitados` nas solicitações, campos `quantidade_reservada`/`quantidade_disponivel` no inventário
- **Médio impacto:** Status de solicitações (`agendada`, `aprovada`, `concluida`)
- **Baixo impacto:** Componentes UI

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Cálculo no frontend:** Auditoria feita client-side para simplicidade — trade-off vs. Cloud Function
- **writeBatch:** Escolhido para garantir atomicidade da correção
- **confirm() nativo:** Usado por simplicidade — modal customizado seria melhor UX

### 16.2 Padrões Utilizados
- **Map-based aggregation:** Maps para acumular quantidades por `inventory_item_id`
- **Batch write pattern:** Todas as correções em uma operação atômica
- **Retry pattern:** Re-execução automática da auditoria após correção

### 16.3 Limitações Conhecidas
- ⚠️ Carrega todos os documentos em memória — não escala para inventários muito grandes
- ⚠️ Usa `confirm()` e `alert()` nativos do browser (não customizáveis, problemas de acessibilidade)
- ⚠️ Sem restrição de role para operação de correção (escrita)

### 16.4 Notas de Implementação
- Nome do produto usa fallback: `item.nome_produto || item.codigo_produto`
- Valores com fallback: `item.quantidade_reservada || 0`, `item.quantidade_disponivel || 0`
- Header próprio com `<header>` + `<main>` em vez de usar o layout padrão
- Container limitado a `max-w-4xl` para melhor legibilidade
- Delay de 1s na re-auditoria para permitir propagação do batch no Firestore

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **Auditoria:** Verificação de consistência entre valores armazenados e valores calculados
- **writeBatch:** Operação atômica do Firestore que aplica múltiplas escritas como uma única transação
- **Reserva:** Quantidade alocada para procedimentos agendados/aprovados (ainda não consumida)
- **Consumido:** Quantidade efetivamente utilizada em procedimentos concluídos
- **Disponível Esperado:** `max(0, inicial - consumido - reservadaEsperada)`

---

## 19. Referências

### 19.1 Documentação Relacionada
- Listagem de Inventário - `project_doc/clinic/inventory-list-documentation.md`
- Detalhes do Inventário - `project_doc/clinic/inventory-detail-documentation.md`
- Procedimentos - `project_doc/clinic/requests-list-documentation.md`

### 19.2 Links Externos
- Firestore Batched Writes - https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/inventory/audit/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`
- **Types:** `src/types/index.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots da interface em diferentes estados]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Fórmula de cálculo do disponível esperado
const consumido = quantidadesConsumidas.get(doc.id) || 0;
const reservadaEsperada = reservasEsperadas.get(doc.id) || 0;
const disponivelEsperado = Math.max(0, inicial - consumido - reservadaEsperada);

// Correção em batch (atômica)
const batch = writeBatch(db);
auditResults.forEach((result) => {
  const docRef = doc(collection(db, "tenants", tenantId, "inventory"), result.id);
  batch.update(docRef, {
    quantidade_reservada: result.reservadaEsperada,
    quantidade_disponivel: result.disponivelEsperado,
    updated_at: Timestamp.now(),
  });
});
await batch.commit();
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
