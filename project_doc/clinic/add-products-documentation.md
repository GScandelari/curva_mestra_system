# Documentação Experimental - Inserção Manual de Produtos

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clínica / Inserção Manual de Produtos
**Componente:** Inserção Manual de NF (`/clinic/add-products`)
**Versão:** 1.1
**Data:** 07/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de fluxo multi-step (wizard de 4 etapas) para inserção manual de produtos no inventário da clínica via Nota Fiscal. Suporta dois tipos de produtos: Rennova (com seleção do catálogo master via autocomplete) e outras marcas (cadastro livre). O fluxo possui 4 etapas: seleção de tipo, número da NF, adição de produtos e revisão/confirmação.

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/add-products/page.tsx`
- **Rota:** `/clinic/add-products`
- **Layout:** Clinic Layout (restrito a `clinic_admin`)

### 1.2 Dependências Principais
- **useAuth:** `src/hooks/useAuth.ts` — autenticação, claims e `tenantId`
- **useToast:** `src/hooks/use-toast.ts` — notificações toast
- **Firebase Firestore:** `collection`, `addDoc`, `query`, `where`, `getDocs`, `serverTimestamp`
- **Shadcn/ui:** Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, Button, Input, Label
- **Lucide Icons:** Plus, Trash2, Save, ArrowLeft

---

## 2. Tipos de Usuários / Atores

### 2.1 Administrador de Clínica (`clinic_admin`)
- **Descrição:** Administrador de uma clínica específica
- **Acesso:** Acesso completo — pode executar todo o fluxo de inserção
- **Comportamento:** Navega pelo wizard de 4 etapas, adiciona produtos e salva no Firestore
- **Restrições:** Vinculado a um `tenant_id` específico; botão "Adicionar Produtos" na listagem é visível apenas para admin

---

## 3. Estrutura de Dados

### 3.1 Interface MasterProduct

```typescript
interface MasterProduct {
  id: string;     // ID do documento Firestore (master_products)
  code: string;   // Código do produto (7-8 dígitos)
  name: string;   // Nome do produto
}
```

### 3.2 Interface NFProduct

```typescript
interface NFProduct {
  master_product_id?: string;  // ID do produto no catálogo master (apenas Rennova)
  codigo: string;              // Código do produto
  nome_produto: string;        // Nome do produto
  lote: string;                // Número do lote
  quantidade: number;          // Quantidade do produto
  dt_validade: string;         // Data de validade (formato date input YYYY-MM-DD)
  valor_unitario: number;      // Valor unitário em R$
}
```

**Campos Principais:**
- **master_product_id:** Presente apenas para produtos Rennova; vincula ao catálogo master
- **dt_validade:** Armazenado como string (formato do input date), não como Timestamp do Firestore
- **quantidade:** Parseado de string para float via `parseFloat()`

---

## 4. Casos de Uso

### 4.1 UC-001: Selecionar Tipo de Produto

**Ator:** clinic_admin
**Pré-condições:**
- Usuário autenticado como `clinic_admin`

**Fluxo Principal:**
1. Página exibe 2 botões grandes: "Adicionar Produtos Rennova" e "Adicionar Outras Marcas"
2. Usuário clica em um dos botões
3. Se Rennova: catálogo master é carregado automaticamente
4. Avança para step 2 (Número da NF)

**Pós-condições:**
- Tipo de produto definido (`rennova` ou `outra_marca`)
- Se Rennova, `masterProducts` carregados em memória

---

### 4.2 UC-002: Informar Número da NF

**Ator:** clinic_admin
**Pré-condições:**
- Tipo de produto selecionado

**Fluxo Principal:**
1. Input para número da NF exibido
2. Usuário preenche o número
3. Clique em "Continuar"

**Fluxo Alternativo — NF vazia:**
1. Usuário clica "Continuar" sem preencher
2. Toast destructive: "Número da NF obrigatório"
3. Permanece no step 2

**Pós-condições:**
- Número da NF armazenado, avança para step 3

---

### 4.3 UC-003: Adicionar Produto Rennova

**Ator:** clinic_admin
**Pré-condições:**
- Tipo = Rennova, catálogo master carregado

**Fluxo Principal:**
1. Usuário clica "Adicionar Produto" (abre Dialog)
2. Digita no campo de busca — autocomplete filtra por código ou nome
3. Seleciona produto da lista (max 10 sugestões)
4. Preenche: lote, quantidade, data de validade, valor unitário
5. Clique em "Adicionar"
6. Produto adicionado à tabela, Dialog fecha

**Pós-condições:**
- Produto na lista, campos do dialog limpos, toast de sucesso

---

### 4.4 UC-004: Adicionar Produto Outra Marca

**Ator:** clinic_admin
**Pré-condições:**
- Tipo = Outra Marca

**Fluxo Principal:**
1. Usuário clica "Adicionar Produto" (abre Dialog)
2. Preenche: código, nome, lote, quantidade, data de validade, valor unitário
3. Clique em "Adicionar"
4. Produto adicionado à tabela, Dialog fecha

**Pós-condições:**
- Produto na lista com campos livres

---

### 4.5 UC-005: Revisar e Confirmar

**Ator:** clinic_admin
**Pré-condições:**
- Ao menos 1 produto adicionado

**Fluxo Principal:**
1. Tabela de revisão exibe todos os produtos com coluna "Total" (quantidade * valor_unitario)
2. Rodapé exibe "Valor Total" (soma de todos os totais)
3. Alerta amarelo avisa que a ação não pode ser desfeita
4. Clique em "Confirmar e Salvar"
5. NF salva em `nf_imports`, cada produto salvo em `inventory`
6. Toast de sucesso, redirecionamento para `/clinic/inventory`

**Pós-condições:**
- Documentos criados no Firestore
- Inventário atualizado com os novos produtos

---

### 4.6 UC-006: Erro na Validação

**Ator:** clinic_admin
**Pré-condições:**
- Campos obrigatórios não preenchidos

**Fluxo Principal:**
1. Validação detecta campo vazio
2. Toast destructive com mensagem apropriada

**Mensagens de Erro:**
- "Número da NF obrigatório"
- "Campos obrigatórios" (produto)
- "Adicione pelo menos um produto antes de continuar"
- "Tenant ID não encontrado"
- "Não foi possível salvar a nota fiscal"
- "Não foi possível carregar os produtos Rennova"

**Pós-condições:**
- Usuário permanece na etapa atual para corrigir

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                   INSERÇÃO MANUAL DE PRODUTOS                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌────────────────────┐
                  │ STEP 1:            │
                  │ Selecionar tipo    │
                  │ [Rennova] [Outra]  │
                  └────────────────────┘
                         │         │
                   Rennova│         │Outra Marca
                         │         │
                         ▼         ▼
              ┌──────────────┐     │
              │ Carregar     │     │
              │ catálogo     │     │
              │ master       │     │
              └──────────────┘     │
                      │            │
                      └────┬───────┘
                           ▼
                  ┌────────────────────┐
                  │ STEP 2:            │
                  │ Número da NF       │
                  │ [Input] [Continuar]│
                  └────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ STEP 3:            │
                  │ Adicionar produtos │
                  │ [Dialog] [Tabela]  │
                  │ [+] [-] [Revisar]  │
                  └────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ STEP 4:            │
                  │ Revisão + Total    │
                  │ [Alerta Amarelo]   │
                  │ [Confirmar e Salvar│
                  └────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ Salvar no Firestore│
                  │ nf_imports + items │
                  └────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ Redirect para      │
                  │ /clinic/inventory  │
                  └────────────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Catálogo Master para Rennova
**Descrição:** Produtos Rennova são selecionados do catálogo `master_products` com `active == true`
**Aplicação:** Autocomplete com busca por código ou nome, max 10 sugestões
**Exceções:** Se catálogo vazio ou erro, toast de erro exibido
**Justificativa:** Padronização — produtos Rennova devem vir do catálogo oficial

### RN-002: Número da NF Obrigatório
**Descrição:** Número da NF é obrigatório para avançar do step 2
**Aplicação:** Validação no `handleContinueToProducts`
**Exceções:** Nenhuma
**Justificativa:** Rastreabilidade — todo produto deve ter NF associada

### RN-003: Mínimo de 1 Produto
**Descrição:** Ao menos 1 produto necessário para avançar para revisão
**Aplicação:** Validação no `handleGoToReview`
**Exceções:** Nenhuma
**Justificativa:** NF sem produtos não faz sentido

### RN-004: Persistência em Duas Coleções
**Descrição:** Dados salvos em `tenants/{tenantId}/nf_imports` (NF) e `tenants/{tenantId}/inventory` (itens)
**Aplicação:** `addDoc` para NF, depois loop de `addDoc` para cada produto
**Exceções:** Nenhuma
**Justificativa:** NF como registro, itens individuais no inventário

### RN-005: Inicialização de Quantidades
**Descrição:** `quantidade_disponivel` inicializada igual a `quantidade_inicial` (sem reserva)
**Aplicação:** No `inventoryData`, ambos os campos recebem `produto.quantidade`
**Exceções:** Nenhuma
**Justificativa:** Produto novo entra sem reservas

### RN-006: Status da NF
**Descrição:** Status da NF definido como `"success"` ao salvar
**Aplicação:** Campo `status` no documento `nf_imports`
**Exceções:** Nenhuma
**Justificativa:** NF de inserção manual sempre é considerada bem-sucedida

### RN-007: Flag is_rennova
**Descrição:** Campo `is_rennova` indica se o produto é Rennova ou outra marca
**Aplicação:** `is_rennova: tipoNF === "rennova"` no inventário
**Exceções:** Nenhuma
**Justificativa:** Diferenciação para relatórios e filtros futuros

### RN-008: Registro de Autoria
**Descrição:** `created_by` registra o email do usuário que criou a NF
**Aplicação:** `user?.email || "unknown"` no documento `nf_imports`
**Exceções:** Fallback para "unknown" se email não disponível
**Justificativa:** Auditoria de quem inseriu os dados

---

## 7. Estados da Interface

### 7.1 Estado: Step 1 — Seleção de Tipo
**Quando:** Página carregada inicialmente
**Exibição:** 2 botões grandes (h-32) lado a lado: "Adicionar Produtos Rennova" / "Adicionar Outras Marcas"
**Interações:** Clique em um botão define tipo e avança

### 7.2 Estado: Step 2 — Número da NF
**Quando:** Tipo selecionado
**Exibição:** Input para número da NF + botões "Voltar" / "Continuar"
**Campos/Elementos:**
- Input `numero-nf` com Label e placeholder "Ex: 026229"
**Links/Navegação:**
- "Voltar" → Step 1
- "Continuar" → Step 3 (se válido)

### 7.3 Estado: Step 3 — Adicionar Produtos
**Quando:** NF informada
**Exibição:** Card de resumo da NF + card de produtos com tabela + Dialog de adição
**Campos/Elementos:**
- Resumo: número da NF + tipo
- Tabela: Código, Nome, Lote, Quantidade, Validade, Valor Unit., Ações (remover)
- Botão "Adicionar Produto" abre Dialog
- Botões "Voltar" / "Revisar e Confirmar"

### 7.4 Estado: Step 4 — Revisão
**Quando:** Ao menos 1 produto adicionado e clique em "Revisar"
**Exibição:** Tabela completa com coluna "Total" + valor total no rodapé + alerta amarelo
**Campos/Elementos:**
- Tabela: mesmas colunas + coluna "Total" (quantidade * valor_unitario)
- Rodapé: "Valor Total: R$ X.XX"
- Alerta amarelo: "Esta ação não pode ser desfeita automaticamente"
- Botão "Confirmar e Salvar" (verde, bg-green-600)

### 7.5 Estado: Salvando
**Quando:** Clique em "Confirmar e Salvar"
**Exibição:** Botão "Salvando..." desabilitado

### 7.6 Estado: Dialog Aberto
**Quando:** Clique em "Adicionar Produto"
**Exibição:** Dialog com formulário contextual (Rennova com autocomplete ou Outra Marca com campos livres)
**Campos Rennova:** Busca de produto (autocomplete), Lote, Quantidade, Data de Validade, Valor Unitário
**Campos Outra Marca:** Código, Nome, Lote, Quantidade, Data de Validade, Valor Unitário

### 7.7 Estado: Lista Vazia
**Quando:** Step 3 sem produtos adicionados
**Exibição:** Texto centralizado "Nenhum produto adicionado. Clique em 'Adicionar Produto' para começar."

---

## 8. Validações

### 8.1 Validações de Frontend
- **Número da NF:** Obrigatório para avançar do step 2 (toast destructive se vazio)
- **Produto Rennova:** Todos obrigatórios: produto selecionado, lote, quantidade, validade, valor
- **Produto Outra Marca:** Todos obrigatórios: código, nome, lote, quantidade, validade, valor
- **Lista de produtos:** Ao menos 1 produto para avançar para revisão
- **tenantId:** Toast destructive se não encontrado ao salvar

### 8.2 Validações de Backend
- **Master products:** Query `where("active", "==", true)` na coleção `master_products`
- **Persistência:** `addDoc` com `serverTimestamp()` para campos de data

### 8.3 Validações de Permissão
- **Acesso à página:** Botão de acesso na listagem restrito a `clinic_admin`
- **Dados do tenant:** Path `tenants/{tenantId}/...` nas coleções

---

## 9. Integrações

### 9.1 Firestore — getDocs (Catálogo Master)
- **Tipo:** Query pontual
- **Coleção:** `master_products`
- **Filtro:** `where("active", "==", true)`
- **Retorno:** Lista de `MasterProduct` (id, code, name)
- **Quando:** Ao selecionar tipo "rennova" (via useEffect)

### 9.2 Firestore — addDoc (NF Import)
- **Tipo:** Escrita
- **Coleção:** `tenants/{tenantId}/nf_imports`
- **Campos:** `tenant_id`, `numero_nf`, `tipo`, `produtos[]`, `status`, `created_by`, `created_at`, `updated_at`
- **Quando:** "Confirmar e Salvar"

### 9.3 Firestore — addDoc (Itens do Inventário)
- **Tipo:** Escrita (loop)
- **Coleção:** `tenants/{tenantId}/inventory`
- **Campos:** `tenant_id`, `nf_import_id`, `nf_numero`, `master_product_id`, `produto_id`, `codigo_produto`, `nome_produto`, `lote`, `quantidade_inicial`, `quantidade_disponivel`, `dt_validade`, `dt_entrada`, `valor_unitario`, `active`, `is_rennova`, `created_at`, `updated_at`
- **Quando:** Após salvar NF, para cada produto no loop

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Isolamento multi-tenant via `tenantId` nos paths das coleções
- ✅ Acesso restrito a `clinic_admin` (via botão na listagem)
- ✅ Validação de campos obrigatórios antes de persistir
- ✅ Registro de autoria (`created_by` com email do usuário)
- ✅ Alerta visual de ação irreversível na revisão

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Não há verificação de duplicidade de NF — mesmo número pode ser inserido múltiplas vezes
- ⚠️ Produtos salvos em loop individual (`addDoc`) em vez de batch — falha parcial possível
- **Mitigação:** Considerar `writeBatch` para atomicidade

### 10.3 Dados Sensíveis
- **Valores monetários:** Valor unitário visível durante inserção
- **Email do usuário:** Registrado como `created_by`

---

## 11. Performance

### 11.1 Métricas
- **Requisições de leitura:** 1 query (catálogo master, apenas para Rennova)
- **Requisições de escrita:** 1 (NF) + N (produtos) addDoc's
- **Componente:** ~852 linhas

### 11.2 Otimizações Implementadas
- ✅ Autocomplete filtra no frontend (sem re-query ao digitar)
- ✅ Limite de 10 sugestões no dropdown

### 11.3 Gargalos Identificados
- ⚠️ Produtos salvos em loop sequencial (não paralelo, não batch)
- ⚠️ `console.log` extensivo no código (ambiente de dev)
- **Plano de melhoria:** Usar `writeBatch` para salvar NF + produtos atomicamente

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** A parcial
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Labels em todos os inputs (`<Label htmlFor="...">`)
- ✅ Placeholders descritivos
- ✅ Dialog com título e descrição
- ✅ Indicador visual de progresso (step indicator)

### 12.3 Melhorias Necessárias
- [ ] Adicionar `aria-current="step"` no step indicator
- [ ] Melhorar navegação por teclado no autocomplete
- [ ] Adicionar `aria-live` para feedback de produtos adicionados/removidos

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Fluxo completo Rennova**
   - **Dado:** Catálogo master com produtos
   - **Quando:** Wizard executado até "Confirmar e Salvar"
   - **Então:** NF e produtos criados no Firestore, redirect para inventário

2. **Fluxo completo Outra Marca**
   - **Dado:** Campos preenchidos manualmente
   - **Quando:** Wizard executado até "Confirmar e Salvar"
   - **Então:** NF e produtos criados com `is_rennova: false`

3. **Autocomplete funciona**
   - **Dado:** Catálogo com produto "TOXINA"
   - **Quando:** Digita "TOX" no campo de busca
   - **Então:** Sugestão aparece, seleção preenche campos

4. **Remover produto da lista**
   - **Dado:** 2 produtos adicionados
   - **Quando:** Clique em ícone Trash2
   - **Então:** Produto removido, toast "Produto removido"

### 13.2 Casos de Teste de Erro
1. **NF vazia:** Toast "Número da NF obrigatório", permanece no step 2
2. **Campos obrigatórios vazios:** Toast "Campos obrigatórios", Dialog permanece aberto
3. **Lista vazia na revisão:** Toast "Adicione pelo menos um produto"
4. **Erro no Firestore:** Toast "Não foi possível salvar a nota fiscal"

### 13.3 Testes de Integração
- [ ] Testar com Firebase Emulator Suite
- [ ] Testar persistência em `nf_imports` e `inventory`
- [ ] Testar que `quantidade_disponivel == quantidade_inicial`
- [ ] Testar que `is_rennova` reflete o tipo selecionado

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Verificação de duplicidade de NF antes de salvar
- [ ] Edição inline de produtos na tabela (sem reabrir Dialog)
- [ ] Importação via planilha Excel
- [ ] Suporte a múltiplas NFs em sequência

### 14.2 UX/UI
- [ ] Salvar progresso entre steps (persistência local)
- [ ] Preview do autocomplete com imagem do produto
- [ ] Animações de transição entre steps

### 14.3 Performance
- [ ] Usar `writeBatch` para salvar NF + produtos atomicamente
- [ ] Remover `console.log` de produção
- [ ] Lazy loading do catálogo master

### 14.4 Segurança
- [ ] Validação server-side (Cloud Function) antes de persistir
- [ ] Verificação de duplicidade de lote+NF

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Listagem de Inventário (`/clinic/inventory`):** Origem (botão "Adicionar") e destino (redirect após salvar)
- **Catálogo Master (`master_products`):** Fonte de dados para produtos Rennova
- **Portal Admin → Produtos:** Onde os produtos master são cadastrados

### 15.2 Fluxos que Passam por Esta Página
1. **Inventário → Adicionar Produtos → Inventário:** Fluxo principal de adição
2. **Admin cadastra produto master → Clínica adiciona via autocomplete:** Fluxo cross-module

### 15.3 Impacto de Mudanças
- **Alto impacto:** Estrutura do `InventoryItem`, coleção `nf_imports`
- **Médio impacto:** Coleção `master_products` (afeta autocomplete)
- **Baixo impacto:** Componentes UI

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **Wizard multi-step:** 4 etapas em um único componente com state `step`
- **addDoc em loop:** Simplicidade sobre atomicidade — cada produto é salvo individualmente
- **dt_validade como string:** Armazenado no formato do input date, não convertido para Timestamp

### 16.2 Padrões Utilizados
- **Wizard pattern:** Estado `step` controla qual seção é renderizada
- **Autocomplete pattern:** Input controlado + dropdown filtrado + seleção
- **Toast feedback:** Todas as ações importantes geram toast (sucesso ou erro)

### 16.3 Limitações Conhecidas
- ⚠️ `dt_validade` salvo como string — inconsistente com inventário existente que usa Timestamp
- ⚠️ Não usa `writeBatch` — falha parcial pode deixar NF sem alguns produtos
- ⚠️ Sem verificação de duplicidade de NF
- ⚠️ `console.log` extensivo presente no código (dev mode)

### 16.4 Notas de Implementação
- `useAuth` fornece `tenantId` diretamente (sem precisar de `claims?.tenant_id`)
- Step indicator com círculos numerados e barras de conexão, visível a partir do step 2
- Autocomplete fecha ao clicar fora (via `showSuggestions` state)
- Botão "Confirmar e Salvar" usa `bg-green-600` para destaque visual
- Campos do dialog são limpos após cada adição de produto

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Engenharia Reversa (Claude) | Documentação inicial |
| 09/02/2026 | 1.1 | Engenharia Reversa (Claude) | Padronização conforme template (20 seções) |

---

## 18. Glossário

- **Wizard:** Fluxo multi-step com navegação entre etapas
- **Master Products:** Catálogo global de produtos Rennova gerenciado pelo System Admin
- **NF Import:** Registro da nota fiscal usada para entrada de produtos
- **Autocomplete:** Campo de busca com sugestões filtradas em tempo real
- **is_rennova:** Flag booleana que indica se o produto é da marca Rennova

---

## 19. Referências

### 19.1 Documentação Relacionada
- Listagem de Inventário - `project_doc/clinic/inventory-list-documentation.md`
- Catálogo de Produtos (Admin) - `project_doc/admin/products-list-documentation.md`
- Upload de NF - `project_doc/clinic/upload-documentation.md`

### 19.2 Links Externos
- Firestore addDoc - https://firebase.google.com/docs/firestore/manage-data/add-data
- Shadcn/ui Dialog - https://ui.shadcn.com/docs/components/dialog

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/add-products/page.tsx`
- **Hooks:** `src/hooks/useAuth.ts`, `src/hooks/use-toast.ts`
- **Types:** `src/types/index.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Adicionar screenshots de cada step do wizard]

### 20.2 Diagramas
[Diagrama de fluxo incluído na seção 5]

### 20.3 Exemplos de Código

```typescript
// Persistência no Firestore — NF + itens do inventário
const nfRef = await addDoc(
  collection(db, `tenants/${tenantId}/nf_imports`),
  {
    tenant_id: tenantId,
    numero_nf: numeroNF,
    tipo: tipoNF,
    produtos: produtos,
    status: "success",
    created_by: user?.email || "unknown",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }
);

for (const produto of produtos) {
  await addDoc(collection(db, `tenants/${tenantId}/inventory`), {
    tenant_id: tenantId,
    nf_import_id: nfRef.id,
    nf_numero: numeroNF,
    quantidade_inicial: produto.quantidade,
    quantidade_disponivel: produto.quantidade,  // Igual ao inicial
    is_rennova: tipoNF === "rennova",
    active: true,
    // ... demais campos
  });
}
```

---

**Documento gerado por:** Engenharia Reversa (Claude)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
