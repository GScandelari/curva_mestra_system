# Guias de Recuperação por Cenário

## Cenário 1: Sistema Completamente Inacessível (SYS_001)

### Sintomas
- Usuários não conseguem acessar a plataforma
- Erro SYS_001 em todas as tentativas de acesso
- Dashboard de admin inacessível

### Diagnóstico Rápido
```bash
# 1. Verificar status geral do sistema
node scripts/systemStatus.js --critical

# 2. Executar diagnóstico específico SYS_001
node scripts/diagnoseSYS001.js

# 3. Verificar logs de erro recentes
tail -n 100 backend/logs/app.log | grep ERROR
```

### Plano de Recuperação

#### Passo 1: Validação de Configurações (2-5 min)
```bash
# Validar variáveis de ambiente
node scripts/validateEnvironment.js --fix

# Testar conectividade Firebase
node scripts/testFirebaseInit.js

# Verificar configurações críticas
cat .env | grep -E "(FIREBASE|API)" | head -10
```

#### Passo 2: Recuperação de Serviços (5-10 min)
```bash
# Reiniciar serviços backend
npm run restart:backend

# Limpar cache e rebuildar
npm run clean && npm run build

# Deploy de emergência se necessário
firebase deploy --only functions
```

#### Passo 3: Validação da Recuperação (2-3 min)
```bash
# Testar acesso básico
node scripts/testLogin.js

# Verificar APIs críticas
node scripts/testAPI.js --critical

# Confirmar sistema operacional
node scripts/systemStatus.js --health
```

### Rollback se Necessário
```bash
# Rollback para versão estável anterior
firebase hosting:clone SOURCE_SITE_ID:VERSION_ID TARGET_SITE_ID
```

## Cenário 2: Falha de Autenticação Massiva (AUTH_001/002/003)

### Sintomas
- Múltiplos usuários não conseguem fazer login
- Tokens expirando rapidamente
- Erros de permissão generalizados

### Diagnóstico
```bash
# Verificar status Firebase Auth
firebase auth:export temp-users.json --format=json

# Testar autenticação
node scripts/testLogin.js --multiple-users

# Verificar configurações de segurança
firebase firestore:rules get
```

### Recuperação

#### Passo 1: Verificar Configuração Auth (3-5 min)
```bash
# Validar configuração Firebase Auth
node scripts/validateEnvironment.js --auth-only

# Verificar domínios autorizados
firebase auth:export --format=csv | head -5

# Testar conectividade Auth
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY"
```

#### Passo 2: Corrigir Problemas de Token (2-3 min)
```bash
# Renovar tokens em massa (se necessário)
node scripts/refreshUserToken.js --all-users

# Verificar claims customizados
node scripts/set-admin-claims.js --verify-all

# Limpar cache de autenticação
rm -rf .firebase/auth_cache
```

#### Passo 3: Restaurar Permissões (5-10 min)
```bash
# Restaurar regras Firestore
firebase deploy --only firestore:rules

# Verificar e corrigir claims de admin
node scripts/makeUserAdmin.js --restore-from-backup

# Testar permissões críticas
node scripts/testAPI.js --auth-required
```

## Cenário 3: Degradação de Performance (PERF_001/002)

### Sintomas
- Sistema lento mas acessível
- Timeouts ocasionais
- Uso alto de memória/CPU

### Diagnóstico
```bash
# Análise de performance
node scripts/systemStatus.js --performance --detailed

# Verificar memory leaks
node --inspect scripts/memoryAnalysis.js

# Analisar queries lentas
node scripts/analyzeQueries.js --slow-only
```

### Recuperação

#### Passo 1: Otimização Imediata (5-10 min)
```bash
# Limpar cache desnecessário
node scripts/clearCache.js --aggressive

# Otimizar queries ativas
node scripts/optimizeQueries.js --auto-fix

# Reduzir carga de trabalho
node scripts/enableRateLimit.js --emergency-mode
```

#### Passo 2: Monitoramento Intensivo (contínuo)
```bash
# Iniciar monitoramento detalhado
node scripts/monitor.sh --performance --interval=30s

# Ativar alertas de performance
node scripts/setupAlerts.js --performance-critical
```

## Cenário 4: Falha de Deploy (DEPLOY_001/002)

### Sintomas
- Deploy falhou parcialmente
- Versões inconsistentes entre componentes
- Funcionalidades quebradas após deploy

### Diagnóstico
```bash
# Verificar status do último deploy
firebase deploy:status

# Analisar logs de deploy
cat deploy.log | grep -E "(ERROR|FAILED)"

# Verificar integridade dos arquivos
node scripts/validateDeployment.js
```

### Recuperação

#### Passo 1: Rollback Imediato (2-5 min)
```bash
# Rollback automático para versão estável
node scripts/rollback.js --to-last-stable

# Verificar rollback bem-sucedido
firebase hosting:releases:list --limit=5

# Testar funcionalidades críticas
node scripts/testAPI.js --post-rollback
```

#### Passo 2: Correção e Re-deploy (10-20 min)
```bash
# Identificar causa da falha
node scripts/analyzeDeployFailure.js

# Corrigir problemas identificados
node scripts/fixDeployIssues.js --auto-fix

# Deploy incremental seguro
firebase deploy --only hosting
firebase deploy --only functions --function=criticalFunction
```

## Cenário 5: Sobrecarga do Sistema (NET_002, DB_002)

### Sintomas
- Rate limiting ativo
- Quotas Firebase excedidas
- Usuários recebendo erro 429

### Diagnóstico
```bash
# Verificar métricas de uso
node scripts/checkQuotas.js --firebase

# Analisar padrões de tráfego
node scripts/analyzeTraffic.js --last-hour

# Identificar usuários/IPs com alto volume
node scripts/identifyHeavyUsers.js
```

### Recuperação

#### Passo 1: Controle de Tráfego (imediato)
```bash
# Ativar rate limiting agressivo
node scripts/enableRateLimit.js --strict-mode

# Implementar circuit breakers
node scripts/activateCircuitBreakers.js --all-services

# Priorizar usuários críticos
node scripts/setPriority.js --admin-users
```

#### Passo 2: Otimização de Recursos (5-15 min)
```bash
# Otimizar queries custosas
node scripts/optimizeQueries.js --cost-reduction

# Ativar cache agressivo
node scripts/enableCache.js --max-ttl

# Reduzir funcionalidades não-críticas
node scripts/disableNonCritical.js --temporary
```

## Cenário 6: Corrupção de Dados (DB_001, VAL_002)

### Sintomas
- Dados inconsistentes
- Falhas de validação
- Erros de schema

### Diagnóstico
```bash
# Verificar integridade dos dados
node scripts/validateData.js --comprehensive

# Identificar registros corrompidos
node scripts/findCorruptedData.js

# Analisar logs de transações
node scripts/analyzeTransactionLogs.js --errors-only
```

### Recuperação

#### Passo 1: Isolamento (imediato)
```bash
# Isolar dados corrompidos
node scripts/quarantineData.js --auto-detect

# Ativar modo somente leitura
node scripts/enableReadOnlyMode.js --temporary

# Backup de emergência
node scripts/emergencyBackup.js --incremental
```

#### Passo 2: Restauração (10-30 min)
```bash
# Restaurar de backup
node scripts/restoreFromBackup.js --latest-clean

# Validar dados restaurados
node scripts/validateData.js --restored-only

# Reativar modo escrita
node scripts/disableReadOnlyMode.js --after-validation
```

## Ferramentas de Recuperação Rápida

### Script de Recuperação Universal
```bash
#!/bin/bash
# scripts/emergency-recovery.sh

echo "=== RECUPERAÇÃO DE EMERGÊNCIA ==="
echo "Executando diagnóstico completo..."

# Diagnóstico rápido
node scripts/systemStatus.js --emergency

# Recuperação automática baseada no diagnóstico
node scripts/autoRecover.js --emergency-mode

echo "Recuperação concluída. Verificando status..."
node scripts/systemStatus.js --post-recovery
```

### Checklist de Recuperação
```bash
# Usar este checklist para qualquer cenário de recuperação

# ✓ 1. Diagnóstico inicial
node scripts/systemStatus.js --critical

# ✓ 2. Backup de segurança
node scripts/emergencyBackup.js

# ✓ 3. Implementar correção
# (específico para cada cenário)

# ✓ 4. Validar correção
node scripts/validateRecovery.js

# ✓ 5. Monitoramento pós-recuperação
node scripts/monitor.sh --post-recovery --duration=30m

# ✓ 6. Documentar incidente
node scripts/documentIncident.js --auto-generate
```

## Contatos de Emergência

Para cenários críticos que não podem ser resolvidos com estas ferramentas:

1. **Escalação Técnica:** Executar `node scripts/escalate.js --critical`
2. **Backup Manual:** Seguir procedimentos em `docs/backup/MANUAL_BACKUP.md`
3. **Rollback Completo:** Usar `scripts/complete-rollback.sh`

## Métricas de Recuperação

- **Tempo Médio de Detecção:** < 2 minutos
- **Tempo Médio de Recuperação:** < 15 minutos
- **Taxa de Recuperação Automática:** > 85%
- **Disponibilidade Alvo:** 99.9%