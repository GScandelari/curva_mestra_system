# Atualização de Produtos Master com Grupos

Script para atualizar o catálogo de produtos master do Rennova incluindo grupos/categorias.

## 📋 O que o script faz

1. **Inativa** todos os produtos master existentes no banco de dados
2. **Lê** o arquivo `lista_completa.txt` com produtos divididos por grupos
3. **Cria** novos produtos master com os campos:
   - `codigo`: Código do produto Rennova (7 dígitos)
   - `nome`: Nome do produto (uppercase)
   - `grupo`: Categoria/grupo do produto
   - `active`: true
   - `created_at`: timestamp de criação
   - `updated_at`: timestamp de atualização

## 📁 Estrutura do Arquivo

O arquivo `_lista_produtos_rennova_/lista_completa.txt` deve seguir o formato:

```
Nome do Grupo
CODIGO1 NOME DO PRODUTO 1
CODIGO2 NOME DO PRODUTO 2

Outro Grupo
CODIGO3 NOME DO PRODUTO 3
```

**Exemplo real:**

```
Preenchedores
9980012 FILL 1ML
9006974 FILL LIDO 1ML

Bioestimuladores
9252818 ELLEVA 150 150Mg
9058322 ELLEVA 210Mg

Toxina
1162957 NABOTA 100U 150Mg
```

## 🚀 Como Executar

### 1. Configurar Credenciais Firebase

```bash
# Fazer login no Firebase CLI
firebase login

# Definir projeto
firebase use curva-mestra

# Ou usar credenciais de service account
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
```

### 2. Executar o Script

```bash
cd /mnt/c/Users/scand/OneDrive/Área\ de\ Trabalho/Curva\ Mestra/curva_mestra

# Executar o script
node scripts/update-master-products-with-groups.js
```

### 3. Saída Esperada

```
🚀 Iniciando atualização de produtos master...

📂 Arquivo: /path/to/lista_completa.txt

📖 Lendo arquivo de produtos...
📦 Grupo: Preenchedores
📦 Grupo: Bioestimuladores
📦 Grupo: Fios de PDO
...
✅ 83 produtos encontrados no arquivo.

📊 Estatísticas por grupo:
   • Preenchedores: 15 produtos
   • Bioestimuladores: 4 produtos
   • Fios de PDO: 7 produtos
   • Toxina: 2 produtos
   • Cannulas: 9 produtos
   • Care Home: 24 produtos
   • Care Professional: 22 produtos

⚠️  ATENÇÃO: Esta operação irá:
   1. Inativar TODOS os produtos master existentes
   2. Criar 83 novos produtos master com grupos


📋 Inativando todos os produtos master existentes...
✅ 67 produtos master foram inativados.

📦 Criando 83 novos produtos master...
   ✓ Lote 1 criado (83 produtos)
✅ 83 produtos master foram criados.

============================================================
✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!
============================================================
📊 Resumo:
   • Produtos inativados: 67
   • Produtos criados: 83
   • Grupos: 7
============================================================

📄 Exemplo de produto criado:
{
  "codigo": "9980012",
  "nome": "FILL 1ML",
  "grupo": "Preenchedores",
  "active": true
}
```

## 📊 Grupos de Produtos

Os grupos identificados no arquivo `lista_completa.txt`:

1. **Preenchedores** - Produtos de preenchimento dérmico
2. **Bioestimuladores** - Bioestimuladores de colágeno
3. **Fios de PDO** - Fios de sustentação
4. **Toxina** - Toxina botulínica
5. **Cannulas** - Cânulas e agulhas
6. **Care Home** - Linha de cuidados para casa
7. **Care Professional** - Linha de cuidados profissional

## 🔍 Verificação Pós-Execução

### 1. Verificar no Firestore Console

Acesse: https://console.firebase.google.com/project/curva-mestra/firestore/data/master_products

Verifique:

- ✅ Produtos antigos estão com `active: false`
- ✅ Novos produtos têm `active: true`
- ✅ Todos os produtos têm o campo `grupo`

### 2. Verificar via Script

```bash
# Contar produtos ativos
firebase firestore:get master_products --limit=1000 | grep "active: true" | wc -l

# Listar produtos de um grupo específico
firebase firestore:get master_products --where "grupo==Preenchedores"
```

### 3. Verificar na Aplicação

1. Acessar `/admin/products` (como system_admin)
2. Verificar que os novos produtos aparecem
3. Verificar que cada produto tem seu grupo listado

## ⚠️ Avisos Importantes

1. **Backup Recomendado**: Fazer backup do Firestore antes de executar

   ```bash
   gcloud firestore export gs://curva-mestra-backup/$(date +%Y%m%d)
   ```

2. **Ambiente de Produção**: O script afeta diretamente o banco de dados de produção. Use com cuidado!

3. **Produtos Inativos**: Os produtos antigos não são deletados, apenas marcados como `active: false`. Isso preserva o histórico.

4. **Códigos como ID**: O script usa o código do produto como ID do documento para evitar duplicatas.

## 🔄 Reverter Alterações (Se Necessário)

Se precisar reverter:

```javascript
// Script para reativar produtos antigos
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function revert() {
  const snapshot = await db.collection('master_products').where('active', '==', false).get();

  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.update(doc.ref, { active: true });
  });

  await batch.commit();
  console.log('✅ Produtos reativados');
}

revert();
```

## 📝 Logs e Debugging

O script gera logs detalhados:

- ✅ Sucesso
- ⚠️ Avisos (linhas inválidas, produtos sem grupo)
- ❌ Erros

Para debugging adicional, adicione:

```javascript
console.log('Debug:', JSON.stringify(produto, null, 2));
```

## 🆘 Problemas Comuns

### Erro: "Arquivo não encontrado"

- Verificar se `_lista_produtos_rennova_/lista_completa.txt` existe
- Verificar path relativo do script

### Erro: "Permission denied"

- Verificar credenciais Firebase Admin
- Verificar regras de segurança do Firestore

### Produtos não aparecem na aplicação

- Verificar campo `active: true`
- Verificar queries que filtram produtos master
- Verificar se o código está correto (7 dígitos)

## 📚 Documentação Relacionada

- `src/types/masterProduct.ts` - Tipos TypeScript
- `firestore.rules` - Regras de segurança
- `CLAUDE.md` - Documentação geral do projeto

---

**Última Atualização**: 2025-12-13
**Autor**: Claude AI
**Projeto**: Curva Mestra - Sistema SaaS Multi-Tenant
