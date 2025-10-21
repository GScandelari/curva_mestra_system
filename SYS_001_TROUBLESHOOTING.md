# 🚨 Guia de Resolução - Erro SYS_001

## ❌ Problema
Você está vendo o erro: **"Erro interno do servidor. Tente novamente. Código: SYS_001"**

## 🔍 Diagnóstico Realizado

✅ **Firebase Functions**: Todas funcionando corretamente
✅ **Servidor Local**: Rodando em http://localhost:3000
✅ **Configuração Firebase**: Presente e válida
✅ **APIs Backend**: Respondendo normalmente

## 🎯 Causa Provável
O erro SYS_001 está sendo gerado no **frontend** da aplicação, não no backend.

## 🔧 Soluções Imediatas

### 1. Limpar Cache do Navegador
```bash
# Pressione estas teclas no navegador:
Ctrl + Shift + R  # (Windows/Linux)
Cmd + Shift + R   # (Mac)
```

### 2. Verificar Console do Navegador
1. Abra o navegador em http://localhost:3000
2. Pressione **F12** para abrir Developer Tools
3. Vá para a aba **Console**
4. Procure por erros em vermelho
5. Vá para a aba **Network**
6. Recarregue a página (F5)
7. Veja se há requisições falhando (em vermelho)

### 3. Reiniciar Servidor de Desenvolvimento
```bash
# No terminal, pare o servidor (Ctrl+C) e reinicie:
cd frontend
npm run dev
```

### 4. Verificar Logs em Tempo Real
```bash
# Em um terminal separado:
firebase functions:log --project curva-mestra --follow
```

## 🔍 Investigação Detalhada

### Possíveis Causas no Frontend:

#### A. Erro de Inicialização do Firebase
**Sintomas**: Erro logo ao carregar a página
**Solução**:
```bash
# Verificar se as variáveis de ambiente estão corretas
cat frontend/.env
```

#### B. Erro de Autenticação
**Sintomas**: Erro ao tentar fazer login
**Solução**:
1. Verificar se o usuário existe no Firebase Console
2. Testar login com credenciais válidas
3. Verificar se o token não expirou

#### C. Erro de Permissões Firestore
**Sintomas**: Erro ao carregar dados
**Solução**:
```bash
# Verificar regras do Firestore
firebase firestore:rules --project curva-mestra
```

#### D. Erro de CORS
**Sintomas**: Erro de "blocked by CORS policy"
**Solução**: Já foi corrigido nas configurações

## 🛠️ Passos de Debug Avançado

### 1. Testar Componente por Componente
```javascript
// No console do navegador, teste:
console.log('Firebase config:', window.firebase);
console.log('Auth state:', firebase.auth().currentUser);
```

### 2. Verificar Estado da Aplicação
```javascript
// No console do navegador:
console.log('App state:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
```

### 3. Testar APIs Manualmente
```bash
# Testar função sem autenticação:
curl -X POST https://us-central1-curva-mestra.cloudfunctions.net/validateAdminInitialization \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'
```

## 📋 Checklist de Verificação

- [ ] Servidor de desenvolvimento rodando (http://localhost:3000)
- [ ] Console do navegador sem erros JavaScript
- [ ] Aba Network sem requisições falhando
- [ ] Firebase Functions respondendo (testado ✅)
- [ ] Arquivo .env com configurações corretas
- [ ] Cache do navegador limpo
- [ ] Usuário com permissões adequadas

## 🚀 Soluções Específicas por Cenário

### Cenário 1: Erro ao Carregar a Página
```bash
# 1. Limpar cache
# 2. Verificar console
# 3. Reiniciar servidor
cd frontend && npm run dev
```

### Cenário 2: Erro ao Fazer Login
```bash
# 1. Verificar credenciais
# 2. Testar com usuário admin conhecido:
#    Email: scandelari.guilherme@hotmail.com
# 3. Verificar Firebase Console
```

### Cenário 3: Erro ao Carregar Dados
```bash
# 1. Verificar permissões do usuário
# 2. Testar APIs diretamente
node scripts/testAPIClient.js no-auth
```

## 🆘 Se Nada Funcionar

### Opção 1: Reset Completo
```bash
# Parar servidor
Ctrl+C

# Limpar cache npm
cd frontend
npm run build
rm -rf node_modules
npm install
npm run dev
```

### Opção 2: Verificar Logs Detalhados
```bash
# Terminal 1: Logs Firebase
firebase functions:log --project curva-mestra --follow

# Terminal 2: Servidor com debug
cd frontend
DEBUG=* npm run dev
```

### Opção 3: Modo de Recuperação
```bash
# Usar versão de backup ou branch estável
git status
git log --oneline -5
```

## 📞 Próximos Passos

1. **Siga os passos na ordem apresentada**
2. **Anote exatamente onde o erro ocorre**
3. **Copie mensagens de erro completas**
4. **Teste em modo incógnito do navegador**
5. **Se persistir, forneça logs específicos**

## 🎯 Informações para Suporte

Se precisar de ajuda adicional, forneça:
- **Quando** o erro ocorre (login, carregamento, ação específica)
- **Mensagens** do console do navegador
- **Requisições** que estão falhando (aba Network)
- **Logs** do Firebase Functions
- **Versão** do navegador e sistema operacional

---

**Status**: ✅ Sistema funcionando - Erro localizado no frontend
**Última verificação**: 21/10/2025 14:35