# 🔧 Guia de Correção de Inventário (Web)

Como corrigir os valores de `quantidade_disponivel` e `quantidade_reservada` diretamente do navegador.

## 📋 Pré-requisitos

- Estar logado no sistema como **admin** ou **clinic_admin**
- Acesso ao console do navegador (F12)
- Navegador moderno (Chrome, Firefox, Edge)

## 🎯 Passo a Passo

### 1️⃣ **Fazer Login no Sistema**

Acesse: `http://localhost:3000` (ou o endereço do seu ambiente)
Faça login com sua conta de admin.

### 2️⃣ **Abrir Console do Navegador**

Pressione **F12** ou:
- Chrome/Edge: `Ctrl+Shift+J` (Windows) ou `Cmd+Option+J` (Mac)
- Firefox: `Ctrl+Shift+K` (Windows) ou `Cmd+Option+K` (Mac)

### 3️⃣ **Executar Auditoria (Ver Problemas)**

No console, cole o conteúdo do arquivo `dev-tools/audit-inventory-web.js` e pressione Enter.

Ou copie este código:

```javascript
// Cole o código de audit-inventory-web.js aqui
```

**Saída esperada:**
```
========================================
AUDITORIA DE INVENTÁRIO - WEB
========================================

✓ Tenant: bbUu0YjEogD3VR5nzmTW

✓ 15 itens no inventário
✓ 3 solicitações agendadas

========================================
RESULTADO DA AUDITORIA
========================================

🟡 RESERVA INCORRETA:
   2 itens

┌─────────┬──────────────────────┬──────────┬────────┬───────────┬───────────┐
│ (index) │ Nome                 │ Lote     │ Atual  │ Esperada  │ Diferença │
├─────────┼──────────────────────┼──────────┼────────┼───────────┼───────────┤
│ 0       │ 'RENNOVA ELLEVA 150' │ 'ABC123' │ 10     │ 5         │ 5         │
│ 1       │ 'PRODUTO XYZ'        │ 'DEF456' │ 8      │ 3         │ 5         │
└─────────┴──────────────────────┴──────────┴────────┴───────────┴───────────┘

✅ ITENS CORRETOS:
   13 itens

========================================
RESUMO
========================================

Total de itens: 15
Itens OK: 13
Itens com problemas: 2

💡 Para corrigir, use a ferramenta de correção
   ou execute: corrigirInventarioWeb()
```

### 4️⃣ **Simular Correção (Dry Run)**

No console, cole o conteúdo do arquivo `dev-tools/fix-inventory-web.js` e pressione Enter.

**Saída esperada:**
```
========================================
CORREÇÃO DE INVENTÁRIO - WEB
========================================

Modo: DRY RUN (simulação)

✓ Tenant: bbUu0YjEogD3VR5nzmTW
✓ 15 itens no inventário
✓ 3 solicitações agendadas

========================================
ITENS A CORRIGIR
========================================

📦 RENNOVA ELLEVA 150 (ABC123)
   Reservada: 10 → 5 (-5)
   Disponível: 40 → 45 (+5)

📦 PRODUTO XYZ (DEF456)
   Reservada: 8 → 3 (-5)
   Disponível: 12 → 17 (+5)

========================================
RESUMO
========================================

Total de itens: 15
Itens a corrigir: 2

💡 Modo DRY RUN: Nenhuma alteração foi feita.
   Execute: corrigirInventarioWeb(false) para aplicar as correções

📌 PRÓXIMOS PASSOS:
   1. Revise as correções acima
   2. Execute: corrigirInventarioWeb(false)
   3. Confirme quando perguntado
```

### 5️⃣ **Aplicar Correções (Modo Produção)**

Se tudo estiver correto, execute no console:

```javascript
corrigirInventarioWeb(false)
```

**Uma caixa de diálogo aparecerá pedindo confirmação:**
```
⚠️  ATENÇÃO: Isso irá atualizar 2 itens no banco de dados.

Deseja continuar?
```

Clique em **OK** para confirmar.

**Saída esperada:**
```
✅ 2 itens corrigidos com sucesso!

┌─────────┬──────────────────────┬──────────┬─────────────┬────────────────┐
│ (index) │ Nome                 │ Lote     │ Δ Reservada │ Δ Disponível   │
├─────────┼──────────────────────┼──────────┼─────────────┼────────────────┤
│ 0       │ 'RENNOVA ELLEVA 150' │ 'ABC123' │ -5          │ +5             │
│ 1       │ 'PRODUTO XYZ'        │ 'DEF456' │ -5          │ +5             │
└─────────┴──────────────────────┴──────────┴─────────────┴────────────────┘
```

### 6️⃣ **Verificar Correção**

Execute a auditoria novamente para confirmar:

```javascript
// Cole audit-inventory-web.js novamente
```

Deve mostrar:
```
✅ ITENS CORRETOS:
   15 itens

Total de itens: 15
Itens OK: 15
Itens com problemas: 0

✅ Tudo certo! Nenhuma correção necessária.
```

## 📊 O Que os Scripts Fazem

### **Auditoria**
1. Busca todos os itens do inventário (ativos)
2. Busca todas as solicitações no status "agendada"
3. Calcula quanto deveria estar reservado (soma dos produtos em solicitações agendadas)
4. Compara com os valores atuais
5. Identifica discrepâncias

### **Correção**
1. Calcula os valores corretos:
   - `quantidade_reservada` = soma de produtos em solicitações agendadas
   - `quantidade_disponivel` = `quantidade_inicial` - `quantidade_reservada`
2. Mostra o que será alterado
3. Aplica as correções em batch (transação atômica)

## 🔒 Segurança

- ✅ Só funciona se você estiver logado
- ✅ Usa suas credenciais atuais (não precisa de senha)
- ✅ Modo dry-run por padrão (simulação)
- ✅ Pede confirmação antes de fazer alterações
- ✅ Transação atômica (tudo ou nada)

## ⚠️ Avisos Importantes

1. **SEMPRE execute a auditoria primeiro** para ver os problemas
2. **SEMPRE use dry-run primeiro** para simular as correções
3. **Revise cuidadosamente** as mudanças antes de confirmar
4. **Faça em horário de baixo uso** se possível
5. **Execute novamente a auditoria** após corrigir para verificar

## 🆘 Problemas Comuns

### "Firebase não encontrado"
**Solução**: Execute o script **dentro do sistema**, no console do navegador, após fazer login.

### "Usuário não está logado"
**Solução**: Faça login no sistema primeiro, depois execute o script.

### "Tenant ID não encontrado"
**Solução**: Certifique-se de estar logado como admin ou clinic_admin (não system_admin).

### Script não faz nada
**Solução**: Verifique se não há erros no console. Cole o script completo e pressione Enter.

## 📝 Notas

- Os scripts funcionam apenas com o **tenant do usuário logado**
- Não é possível auditar/corrigir outros tenants
- Os valores de `quantidade_inicial` **nunca são alterados**
- Apenas `quantidade_reservada` e `quantidade_disponivel` são recalculados

## 🎓 Exemplo de Uso Completo

```javascript
// 1. AUDITAR (ver problemas)
// Cole o conteúdo de audit-inventory-web.js

// Aguarde a saída...

// 2. SIMULAR CORREÇÃO (dry run)
// Cole o conteúdo de fix-inventory-web.js

// Aguarde a saída e revise as mudanças...

// 3. APLICAR CORREÇÕES
corrigirInventarioWeb(false)

// Confirme quando perguntado

// 4. VERIFICAR (auditar novamente)
// Cole audit-inventory-web.js novamente
```

---

**Para seu tenant específico:**

Tenant ID: `bbUu0YjEogD3VR5nzmTW`

Execute os scripts conforme descrito acima.
