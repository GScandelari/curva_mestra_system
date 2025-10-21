# Guia Completo de Troubleshooting - Plataforma Curva Mestra

## Visão Geral

Este guia fornece soluções passo-a-passo para os problemas mais comuns encontrados na plataforma Curva Mestra, incluindo o erro SYS_001 e outros problemas relacionados.

## Índice

1. [Erro SYS_001 - Erro Interno do Servidor](#erro-sys_001)
2. [Problemas de Autenticação](#problemas-de-autenticação)
3. [Problemas de Conectividade](#problemas-de-conectividade)
4. [Problemas de Configuração](#problemas-de-configuração)
5. [Problemas de Performance](#problemas-de-performance)
6. [Problemas de Deploy](#problemas-de-deploy)
7. [Ferramentas de Diagnóstico](#ferramentas-de-diagnóstico)

## Erro SYS_001

### Descrição
O erro SYS_001 é um erro interno do servidor que pode ter várias causas raiz.

### Sintomas
- Usuário não consegue acessar a plataforma
- Mensagem genérica "SYS_001" exibida
- Falha no carregamento de componentes críticos

### Diagnóstico Rápido
```bash
# Execute o diagnóstico automático
node scripts/diagnoseSYS001.js

# Verifique logs recentes
node scripts/systemStatus.js --logs
```

### Soluções por Causa

#### 1. Problemas de Configuração Firebase
**Sintomas:**
- Erro de inicialização do Firebase
- Falha na autenticação
- Problemas de conectividade com Firestore

**Solução:**
```bash
# 1. Validar configurações
node scripts/validateEnvironment.js

# 2. Verificar variáveis de ambiente
cat .env | grep FIREBASE

# 3. Testar conectividade Firebase
node scripts/testFirebaseInit.js
```

**Configurações necessárias:**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

#### 2. Problemas de CORS
**Sintomas:**
- Erro de CORS no console do navegador
- Falha em requisições para APIs externas

**Solução:**
```bash
# Corrigir configurações CORS
node scripts/fixFirebaseCORS.js
```

#### 3. Problemas de Autenticação
**Sintomas:**
- Falha no login
- Token inválido
- Sessão expirada

**Solução:**
```bash
# Testar sistema de autenticação
node scripts/testLogin.js

# Renovar token de usuário
node scripts/refreshUserToken.js
```

## Problemas de Autenticação

### AUTH_001 - Falha no Login
**Causa:** Credenciais inválidas ou problemas de conectividade

**Solução:**
1. Verificar credenciais do usuário
2. Validar configuração Firebase Auth
3. Verificar regras de segurança

```javascript
// Verificar status do Firebase Auth
import { getAuth } from 'firebase/auth';
const auth = getAuth();
console.log('Auth state:', auth.currentUser);
```

### AUTH_002 - Token Expirado
**Causa:** Token de autenticação expirou

**Solução:**
```javascript
// Renovar token automaticamente
auth.currentUser.getIdToken(true)
  .then(token => {
    // Token renovado
  })
  .catch(error => {
    // Redirecionar para login
  });
```

### AUTH_003 - Permissões Insuficientes
**Causa:** Usuário não tem permissões necessárias

**Solução:**
```bash
# Verificar claims do usuário
node scripts/set-admin-claims.js --uid USER_ID --check

# Promover usuário a admin (se necessário)
node scripts/makeUserAdmin.js USER_EMAIL
```

## Problemas de Conectividade

### NET_001 - Falha de Rede
**Sintomas:**
- Timeout em requisições
- Erro de conectividade

**Diagnóstico:**
```bash
# Testar conectividade com APIs
node scripts/testAPI.js

# Verificar status dos serviços
node scripts/systemStatus.js
```

**Solução:**
1. Implementar retry automático
2. Ativar circuit breaker
3. Usar dados em cache quando disponível

### NET_002 - Rate Limiting
**Sintomas:**
- Erro 429 (Too Many Requests)
- Requisições bloqueadas

**Solução:**
1. Implementar backoff exponencial
2. Reduzir frequência de requisições
3. Usar cache local

## Problemas de Configuração

### CONFIG_001 - Variáveis de Ambiente Inválidas
**Diagnóstico:**
```bash
# Validar todas as configurações
node scripts/validateEnvironment.js --verbose
```

**Solução:**
1. Verificar arquivo `.env`
2. Comparar com `.env.example`
3. Recarregar aplicação após correções

### CONFIG_002 - Configuração Firebase Incorreta
**Sintomas:**
- Erro de inicialização
- Projeto não encontrado

**Solução:**
```bash
# Baixar nova configuração do Firebase Console
# Atualizar firebase-config.js
# Reiniciar aplicação
```

## Problemas de Performance

### PERF_001 - Carregamento Lento
**Diagnóstico:**
```bash
# Executar diagnóstico de performance
node scripts/systemStatus.js --performance
```

**Soluções:**
1. Otimizar queries Firestore
2. Implementar lazy loading
3. Usar cache de dados
4. Comprimir assets

### PERF_002 - Memory Leak
**Sintomas:**
- Uso crescente de memória
- Aplicação lenta após uso prolongado

**Solução:**
1. Verificar listeners não removidos
2. Limpar timers e intervals
3. Otimizar componentes React

## Problemas de Deploy

### DEPLOY_001 - Falha no Build
**Diagnóstico:**
```bash
# Verificar logs de build
npm run build 2>&1 | tee build.log
```

**Soluções:**
1. Verificar dependências
2. Corrigir erros de TypeScript
3. Validar configurações de build

### DEPLOY_002 - Falha no Deploy Firebase
**Diagnóstico:**
```bash
# Verificar status do Firebase
firebase projects:list
firebase use --add
```

**Solução:**
```bash
# Deploy manual com logs detalhados
firebase deploy --debug
```

## Ferramentas de Diagnóstico

### Diagnóstico Automático
```bash
# Diagnóstico completo do sistema
node scripts/diagnoseSYS001.js

# Diagnóstico específico por componente
node scripts/systemStatus.js --component auth
node scripts/systemStatus.js --component database
node scripts/systemStatus.js --component api
```

### Monitoramento em Tempo Real
```bash
# Iniciar monitoramento
node scripts/monitor.sh

# Verificar métricas
node scripts/systemStatus.js --metrics
```

### Logs e Debug
```bash
# Visualizar logs em tempo real
tail -f backend/logs/app.log

# Filtrar logs por nível
grep "ERROR" backend/logs/app.log

# Logs do Firebase Functions
firebase functions:log
```

## Códigos de Erro de Referência Rápida

| Código | Descrição | Ação Imediata |
|--------|-----------|---------------|
| SYS_001 | Erro interno do servidor | Executar `diagnoseSYS001.js` |
| AUTH_001 | Falha no login | Verificar credenciais |
| AUTH_002 | Token expirado | Renovar token |
| AUTH_003 | Permissões insuficientes | Verificar claims |
| NET_001 | Falha de rede | Testar conectividade |
| NET_002 | Rate limiting | Implementar backoff |
| CONFIG_001 | Configuração inválida | Validar `.env` |
| CONFIG_002 | Firebase mal configurado | Verificar projeto |
| PERF_001 | Performance degradada | Otimizar queries |
| DEPLOY_001 | Falha no build | Verificar dependências |

## Contatos de Suporte

Para problemas não cobertos neste guia:
1. Verificar logs detalhados
2. Executar diagnóstico completo
3. Documentar passos para reproduzir
4. Consultar documentação técnica adicional

## Atualizações

Este documento é atualizado automaticamente quando novas soluções são implementadas no sistema.

Última atualização: $(date)