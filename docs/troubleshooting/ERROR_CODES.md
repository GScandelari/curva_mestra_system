# Base de Conhecimento - Códigos de Erro

## Códigos de Sistema (SYS)

### SYS_001 - Erro Interno do Servidor
**Descrição:** Erro genérico do servidor que pode ter múltiplas causas
**Severidade:** CRITICAL
**Causas Comuns:**
- Configuração Firebase incorreta
- Problemas de conectividade
- Falha na inicialização de serviços
- Erro não tratado no backend

**Solução:**
1. Executar diagnóstico: `node scripts/diagnoseSYS001.js`
2. Verificar logs: `tail -f backend/logs/app.log`
3. Validar configurações: `node scripts/validateEnvironment.js`
4. Testar conectividade: `node scripts/testFirebaseInit.js`

**Prevenção:**
- Monitoramento contínuo ativo
- Validação automática de configurações
- Health checks regulares

## Códigos de Autenticação (AUTH)

### AUTH_001 - Falha no Login
**Descrição:** Usuário não consegue fazer login
**Severidade:** HIGH
**Causas:**
- Credenciais inválidas
- Conta desabilitada
- Problemas de conectividade Firebase Auth

**Solução:**
```bash
# Testar autenticação
node scripts/testLogin.js

# Verificar status da conta
firebase auth:export users.json
```

### AUTH_002 - Token Expirado
**Descrição:** Token de autenticação expirou
**Severidade:** MEDIUM
**Solução Automática:** Sistema renova automaticamente
**Solução Manual:**
```javascript
auth.currentUser.getIdToken(true)
```

### AUTH_003 - Permissões Insuficientes
**Descrição:** Usuário não tem permissões para ação
**Severidade:** MEDIUM
**Solução:**
```bash
# Verificar claims
node scripts/set-admin-claims.js --uid USER_ID --check

# Promover a admin se necessário
node scripts/makeUserAdmin.js USER_EMAIL
```

## Códigos de Rede (NET)

### NET_001 - Falha de Conectividade
**Descrição:** Problemas de rede ou timeout
**Severidade:** HIGH
**Recuperação Automática:** Circuit breaker + retry
**Monitoramento:** Ativo via health checks

### NET_002 - Rate Limiting
**Descrição:** Muitas requisições em pouco tempo
**Severidade:** MEDIUM
**Recuperação:** Backoff exponencial automático

## Códigos de Configuração (CONFIG)

### CONFIG_001 - Variáveis de Ambiente Inválidas
**Descrição:** Configurações de ambiente incorretas
**Severidade:** CRITICAL
**Validação:** Automática na inicialização

### CONFIG_002 - Firebase Mal Configurado
**Descrição:** Configuração Firebase incorreta
**Severidade:** CRITICAL
**Solução:** Reconfigurar projeto Firebase
## Códi
gos de Performance (PERF)

### PERF_001 - Performance Degradada
**Descrição:** Sistema respondendo lentamente
**Severidade:** MEDIUM
**Causas:**
- Queries Firestore não otimizadas
- Memory leaks
- Sobrecarga de componentes

**Solução:**
```bash
# Diagnóstico de performance
node scripts/systemStatus.js --performance
```

### PERF_002 - Memory Leak Detectado
**Descrição:** Uso crescente de memória
**Severidade:** HIGH
**Monitoramento:** Automático via métricas

## Códigos de Deploy (DEPLOY)

### DEPLOY_001 - Falha no Build
**Descrição:** Erro durante processo de build
**Severidade:** HIGH
**Solução:**
```bash
npm run build 2>&1 | tee build.log
```

### DEPLOY_002 - Falha no Deploy Firebase
**Descrição:** Erro durante deploy para Firebase
**Severidade:** HIGH
**Solução:**
```bash
firebase deploy --debug
```

## Códigos de Validação (VAL)

### VAL_001 - Dados Inválidos
**Descrição:** Dados não passaram na validação
**Severidade:** LOW
**Recuperação:** Automática com feedback ao usuário

### VAL_002 - Schema Incompatível
**Descrição:** Estrutura de dados incompatível
**Severidade:** MEDIUM

## Códigos de Banco de Dados (DB)

### DB_001 - Falha na Conexão Firestore
**Descrição:** Não foi possível conectar ao Firestore
**Severidade:** CRITICAL
**Recuperação:** Circuit breaker + fallback local

### DB_002 - Quota Excedida
**Descrição:** Limite de operações Firestore excedido
**Severidade:** HIGH
**Recuperação:** Rate limiting automático

## Códigos de Monitoramento (MON)

### MON_001 - Health Check Falhou
**Descrição:** Verificação de saúde falhou
**Severidade:** MEDIUM
**Ação:** Investigação automática iniciada

### MON_002 - Métrica Crítica
**Descrição:** Métrica ultrapassou limite crítico
**Severidade:** HIGH
**Ação:** Alerta automático enviado

## Matriz de Severidade

| Severidade | Descrição | Tempo de Resposta | Ação |
|------------|-----------|-------------------|------|
| CRITICAL | Sistema inacessível | Imediato | Recuperação automática |
| HIGH | Funcionalidade crítica afetada | < 5 min | Investigação prioritária |
| MEDIUM | Funcionalidade específica afetada | < 30 min | Correção programada |
| LOW | Impacto mínimo | < 2 horas | Monitoramento |

## Fluxo de Resolução

1. **Detecção Automática**
   - Sistema detecta erro
   - Classifica severidade
   - Inicia recuperação automática

2. **Diagnóstico**
   - Coleta contexto do erro
   - Identifica causa raiz
   - Determina estratégia de correção

3. **Recuperação**
   - Executa estratégia apropriada
   - Monitora sucesso da recuperação
   - Registra resultado para aprendizado

4. **Prevenção**
   - Atualiza regras de detecção
   - Melhora estratégias de recuperação
   - Documenta nova solução

## Ferramentas de Diagnóstico por Código

```bash
# Para erros SYS_*
node scripts/diagnoseSYS001.js

# Para erros AUTH_*
node scripts/testLogin.js
node scripts/set-admin-claims.js --check

# Para erros NET_*
node scripts/testAPI.js
node scripts/systemStatus.js --connectivity

# Para erros CONFIG_*
node scripts/validateEnvironment.js

# Para erros PERF_*
node scripts/systemStatus.js --performance

# Para erros DEPLOY_*
firebase deploy --debug
npm run build

# Diagnóstico geral
node scripts/systemStatus.js --all
```