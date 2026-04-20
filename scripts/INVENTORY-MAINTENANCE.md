# Manutenção de Inventário - Scripts de Correção

Este documento explica como usar os scripts de auditoria e correção do inventário.

## 📋 Problema

Quando há inconsistências nos valores de `quantidade_disponivel` e `quantidade_reservada` no inventário, seja por:

- Edições de solicitações que causaram cálculo incorreto
- Bugs em versões anteriores do sistema
- Alterações manuais no banco de dados

## 🔍 1. Auditoria (Diagnóstico)

**Primeiro, sempre faça uma auditoria para ver o estado atual:**

```bash
node scripts/audit-inventory.js <tenant_id>
```

### Exemplo:

```bash
node scripts/audit-inventory.js clinic_abc123
```

### O que o script verifica:

1. **Fórmula Básica**: `quantidade_inicial = quantidade_disponivel + quantidade_reservada`
2. **Reservas Corretas**: Compara `quantidade_reservada` com o total de produtos em solicitações agendadas
3. **Disponível Correto**: `quantidade_disponivel = quantidade_inicial - quantidade_reservada`

### Saída:

```
========================================
AUDITORIA DE INVENTÁRIO
========================================

Tenant: clinic_abc123

✓ 45 itens no inventário
✓ 12 solicitações agendadas

========================================
RESULTADO DA AUDITORIA
========================================

🟡 RESERVA INCORRETA:
   3 itens

   RENNOVA ELLEVA 150 (Lote ABC123)
   ID: item_xyz
   Reservada: 15 | Esperada: 8
   Diferença: +7

✅ ITENS CORRETOS:
   42 itens

========================================
RESUMO
========================================

Total de itens: 45
Itens OK: 42
Itens com problemas: 3

💡 Para corrigir, execute:
   node scripts/fix-inventory-quantities.js clinic_abc123 --dry-run
   node scripts/fix-inventory-quantities.js clinic_abc123
```

## 🔧 2. Correção (Dry Run)

**Antes de fazer alterações, sempre faça um DRY RUN (simulação):**

```bash
node scripts/fix-inventory-quantities.js <tenant_id> --dry-run
```

### Exemplo:

```bash
node scripts/fix-inventory-quantities.js clinic_abc123 --dry-run
```

### O que faz:

- Mostra exatamente o que **seria** alterado
- **NÃO faz nenhuma alteração** no banco de dados
- Exibe os valores atuais vs. valores corretos
- Mostra as diferenças

### Saída:

```
========================================
RECÁLCULO DE INVENTÁRIO
========================================

Tenant: clinic_abc123
Modo: DRY RUN (simulação)

✓ Encontrados 45 itens no inventário
✓ Encontradas 12 solicitações agendadas
✓ Calculadas reservas para 18 itens diferentes

========================================
ANÁLISE POR ITEM
========================================

📦 Item: RENNOVA ELLEVA 150
   ID: item_xyz
   Lote: ABC123

   VALORES ATUAIS:
   - Inicial: 50
   - Reservada: 15
   - Disponível: 35

   VALORES CORRETOS:
   - Inicial: 50 (não muda)
   - Reservada: 8 ⚠️
   - Disponível: 42 ⚠️

   DIFERENÇA:
   - Reservada: -7
   - Disponível: +7

========================================
RESUMO
========================================

Total de itens analisados: 45
Itens com valores incorretos: 3
Itens corretos: 42

💡 Modo DRY RUN: Nenhuma alteração foi feita.
   Execute sem --dry-run para aplicar as correções.
```

## ✅ 3. Correção (Aplicar Mudanças)

**Após revisar o dry run, aplique as correções:**

```bash
node scripts/fix-inventory-quantities.js <tenant_id>
```

### Exemplo:

```bash
node scripts/fix-inventory-quantities.js clinic_abc123
```

### O que faz:

1. Analisa o inventário
2. Calcula valores corretos
3. Mostra o que será alterado
4. **Pede confirmação** antes de aplicar
5. Atualiza o banco de dados

### Confirmação:

```
⚠️  ATENÇÃO: Isso irá atualizar 3 itens no banco de dados.
Deseja continuar? (digite 'SIM' para confirmar): SIM

✅ 3 itens corrigidos com sucesso!
```

## 🎯 Fluxo Completo Recomendado

```bash
# 1. Auditar (ver problemas)
node scripts/audit-inventory.js clinic_abc123

# 2. Simular correção (dry run)
node scripts/fix-inventory-quantities.js clinic_abc123 --dry-run

# 3. Revisar a saída do dry run

# 4. Aplicar correções
node scripts/fix-inventory-quantities.js clinic_abc123

# 5. Auditar novamente (verificar se corrigiu)
node scripts/audit-inventory.js clinic_abc123
```

## 📊 Lógica de Correção

Os scripts usam a seguinte lógica:

1. **Quantidade Inicial**: Nunca muda (é o valor original da entrada no estoque)

2. **Quantidade Reservada**:
   - Soma todas as quantidades em solicitações com status `agendada`
   - Cada produto em uma solicitação agendada conta como reserva

3. **Quantidade Disponível**:
   - `disponivel = inicial - reservada`
   - O que sobra depois de subtrair as reservas

### Fórmula Principal:

```
quantidade_inicial = quantidade_disponivel + quantidade_reservada
```

## ⚠️ Avisos Importantes

1. **Sempre faça backup** antes de executar scripts de correção em produção
2. **Use --dry-run primeiro** para ver o que será alterado
3. **Execute em horário de baixo uso** se possível
4. **Audite novamente** após a correção para verificar
5. **Cada tenant deve ser corrigido individualmente**

## 🔒 Segurança

- Scripts requerem credenciais do Firebase Admin
- Use `GOOGLE_APPLICATION_CREDENTIALS` para autenticação
- Pedem confirmação antes de fazer alterações
- Modo dry-run disponível para testes seguros

## 📝 Quando Usar

Execute esses scripts quando:

- Notar valores incorretos no inventário
- Após migração ou importação de dados
- Depois de corrigir bugs relacionados a reservas
- Como manutenção preventiva periódica
- Antes de gerar relatórios importantes

## 🆘 Problemas Comuns

### "Tenant ID é obrigatório"

**Solução**: Passe o ID do tenant como argumento

```bash
node scripts/audit-inventory.js SEU_TENANT_ID
```

### "Permission denied"

**Solução**: Configure as credenciais do Firebase

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

### "Nenhum item encontrado"

**Solução**: Verifique se o tenant_id está correto e se há itens ativos no inventário

## 📖 Exemplos de Uso

### Verificar múltiplos tenants:

```bash
for tenant in clinic_abc clinic_xyz clinic_123; do
  echo "Auditando $tenant..."
  node scripts/audit-inventory.js $tenant
  echo "---"
done
```

### Corrigir com log:

```bash
node scripts/fix-inventory-quantities.js clinic_abc123 | tee correction-log.txt
```

---

**Última atualização**: Dezembro 2024
