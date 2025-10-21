# Documentação da Plataforma Curva Mestra

## Visão Geral

Esta documentação fornece guias completos para configuração, deploy, monitoramento e troubleshooting da plataforma Curva Mestra. A documentação está organizada por categorias para facilitar a navegação e uso.

## Estrutura da Documentação

```
docs/
├── README.md                     # Este arquivo - índice geral
├── troubleshooting/              # Guias de resolução de problemas
│   ├── TROUBLESHOOTING_GUIDE.md  # Guia completo de troubleshooting
│   ├── ERROR_CODES.md            # Base de conhecimento de códigos de erro
│   └── RECOVERY_SCENARIOS.md     # Guias de recuperação por cenário
├── configuration/                # Guias de configuração
│   └── CONFIGURATION_GUIDE.md    # Guia completo de configuração
├── deployment/                   # Guias de deploy
│   └── DEPLOYMENT_GUIDE.md       # Guia de deploy e rollback
├── monitoring/                   # Guias de monitoramento
│   └── MONITORING_GUIDE.md       # Guia completo de monitoramento
├── admin/                        # Documentação administrativa
├── setup/                        # Guias de instalação inicial
├── general/                      # Documentação geral
└── migration/                    # Guias de migração
```

## Guias Principais

### 🔧 Troubleshooting e Resolução de Problemas

#### [Guia Completo de Troubleshooting](troubleshooting/TROUBLESHOOTING_GUIDE.md)
- Resolução do erro SYS_001
- Problemas de autenticação
- Problemas de conectividade
- Problemas de configuração
- Problemas de performance
- Problemas de deploy
- Ferramentas de diagnóstico

#### [Base de Conhecimento - Códigos de Erro](troubleshooting/ERROR_CODES.md)
- Códigos de sistema (SYS_*)
- Códigos de autenticação (AUTH_*)
- Códigos de rede (NET_*)
- Códigos de configuração (CONFIG_*)
- Códigos de performance (PERF_*)
- Códigos de deploy (DEPLOY_*)
- Matriz de severidade e ações

#### [Guias de Recuperação por Cenário](troubleshooting/RECOVERY_SCENARIOS.md)
- Sistema completamente inacessível
- Falha de autenticação massiva
- Degradação de performance
- Falha de deploy
- Sobrecarga do sistema
- Corrupção de dados

### ⚙️ Configuração

#### [Guia de Configuração](configuration/CONFIGURATION_GUIDE.md)
- Configurações Firebase
- Variáveis de ambiente
- Configurações por componente
- Configurações de segurança
- Configurações de monitoramento
- Configurações de performance
- Validação de configuração
- Troubleshooting de configuração

### 🚀 Deploy e Rollback

#### [Guia de Deploy e Rollback](deployment/DEPLOYMENT_GUIDE.md)
- Deploy automatizado
- Deploy manual
- Deploy por componente
- Rollback automático
- Rollback manual
- Ambientes de deploy
- Monitoramento de deploy
- Automação de deploy

### 📊 Monitoramento

#### [Guia de Monitoramento](monitoring/MONITORING_GUIDE.md)
- Configuração do sistema de monitoramento
- Métricas coletadas
- Dashboards
- Sistema de alertas
- Health checks
- Logs e auditoria
- Ferramentas de monitoramento
- Troubleshooting de monitoramento

## Ferramentas de Debug

### Scripts de Diagnóstico

#### Linha de Comando
```bash
# Kit de ferramentas de debug
node scripts/debug/debugToolkit.js

# Ferramentas CLI interativas
node scripts/debug/cliDebugTools.js

# Diagnóstico específico do SYS_001
node scripts/diagnoseSYS001.js

# Status geral do sistema
node scripts/systemStatus.js
```

#### Navegador
```javascript
// Ferramentas de debug no navegador (console)
debugTools.showSystemInfo()        // Informações do sistema
debugTools.showPerformanceMetrics() // Métricas de performance
debugTools.runFullDiagnostic()     // Diagnóstico completo
debugTools.exportLogs()             // Exportar logs para análise

// Alias curto
dt.showSystemInfo()
```

### Ferramentas de Monitoramento

#### Dashboard Web
```bash
# Iniciar dashboard de monitoramento
npm run dashboard:start

# Acessar em: http://localhost:3001
```

#### Métricas em Tempo Real
```bash
# Monitorar logs em tempo real
node scripts/debug/cliDebugTools.js logs

# Monitorar performance
node scripts/debug/cliDebugTools.js performance

# Monitorar rede
node scripts/debug/cliDebugTools.js network
```

## Comandos Rápidos

### Diagnóstico e Debug
```bash
# Diagnóstico completo do sistema
node scripts/debug/debugToolkit.js full

# Diagnóstico específico SYS_001
node scripts/diagnoseSYS001.js

# Status do sistema
node scripts/systemStatus.js --all

# Validar configurações
node scripts/validateEnvironment.js
```

### Deploy e Rollback
```bash
# Deploy completo
npm run deploy

# Deploy apenas frontend
npm run deploy:frontend

# Deploy apenas backend
npm run deploy:backend

# Rollback de emergência
npm run rollback:emergency
```

### Monitoramento
```bash
# Status de monitoramento
node scripts/monitoring/status.js

# Alertas ativos
node scripts/monitoring/alerts.js --active

# Health checks
node scripts/monitoring/health.js --all

# Limpar dados antigos
node scripts/monitoring/cleanup.js --older-than=30d
```

### Manutenção
```bash
# Limpeza geral do sistema
node scripts/debug/cliDebugTools.js cleanup

# Backup de configurações
bash scripts/backup-config.sh

# Validação pós-deploy
node scripts/post-deploy-validation.js
```

## Fluxos de Trabalho Comuns

### 1. Resolução de Problema SYS_001
```bash
# 1. Diagnóstico inicial
node scripts/diagnoseSYS001.js

# 2. Validar configurações
node scripts/validateEnvironment.js --firebase

# 3. Testar conectividade
node scripts/testFirebaseInit.js

# 4. Aplicar correções automáticas
node scripts/fixSYS001.js

# 5. Validar correção
node scripts/systemStatus.js --health
```

### 2. Deploy Seguro
```bash
# 1. Validações pré-deploy
npm run validate:all

# 2. Backup
bash scripts/backup-before-deploy.sh

# 3. Deploy
npm run deploy

# 4. Validação pós-deploy
node scripts/post-deploy-validation.js

# 5. Monitoramento
node scripts/monitoring/status.js
```

### 3. Investigação de Performance
```bash
# 1. Métricas atuais
node scripts/monitoring/metrics.js --live

# 2. Análise de performance
node scripts/debug/cliDebugTools.js performance

# 3. Health checks
node scripts/monitoring/health.js --performance

# 4. Otimizações
node scripts/optimizePerformance.js

# 5. Validação
node scripts/systemStatus.js --performance
```

## Contatos e Suporte

### Suporte Técnico
- **Email:** suporte@curvamestra.com
- **Documentação:** Esta documentação
- **Logs:** Verificar `logs/` para detalhes técnicos

### Escalação de Problemas
```bash
# Para problemas críticos
node scripts/escalate.js --critical

# Para problemas de deploy
node scripts/escalate.js --deploy-critical

# Para problemas de segurança
node scripts/escalate.js --security
```

### Recursos Adicionais
- **Firebase Console:** [console.firebase.google.com](https://console.firebase.google.com)
- **GitHub Repository:** Link do repositório
- **Monitoring Dashboard:** http://localhost:3001 (quando ativo)

## Atualizações da Documentação

Esta documentação é atualizada automaticamente quando:
- Novos códigos de erro são identificados
- Novas soluções são implementadas
- Novos procedimentos são criados
- Ferramentas são adicionadas ou modificadas

### Última Atualização
- **Data:** $(date)
- **Versão:** 1.0.0
- **Responsável:** Sistema de Recuperação SYS_001

### Histórico de Mudanças
- **v1.0.0:** Documentação inicial completa
  - Guias de troubleshooting
  - Ferramentas de debug
  - Guias de configuração
  - Guias de deploy e rollback
  - Guias de monitoramento

## Contribuição

Para contribuir com melhorias na documentação:
1. Identifique lacunas ou problemas
2. Documente soluções testadas
3. Atualize os guias relevantes
4. Teste os procedimentos documentados
5. Submeta as alterações

---

**Nota:** Esta documentação faz parte do sistema de recuperação implementado para resolver o erro SYS_001 e prevenir problemas futuros na plataforma Curva Mestra.