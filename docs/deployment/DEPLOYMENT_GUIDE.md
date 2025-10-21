# Guia de Deploy e Rollback - Plataforma Curva Mestra

## Visão Geral

Este guia fornece instruções detalhadas para deploy e rollback da plataforma Curva Mestra, incluindo procedimentos automatizados e manuais para diferentes ambientes.

## Arquitetura de Deploy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Desenvolvimento  │    │    Staging      │    │    Produção     │
│                 │    │                 │    │                 │
│ • Local         │───►│ • Firebase      │───►│ • Firebase      │
│ • Hot Reload    │    │ • Preview       │    │ • Live          │
│ • Debug Mode    │    │ • Testing       │    │ • Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Pré-requisitos

### Ferramentas Necessárias
```bash
# Node.js (versão 18+)
node --version

# npm (versão 8+)
npm --version

# Firebase CLI
npm install -g firebase-tools
firebase --version

# Git
git --version
```

### Configuração Inicial
```bash
# 1. Clonar repositório
git clone https://github.com/seu-usuario/curva-mestra.git
cd curva-mestra

# 2. Instalar dependências
npm install
cd frontend && npm install
cd ../backend && npm install
cd ../functions && npm install

# 3. Configurar Firebase
firebase login
firebase use --add

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações
```

## Deploy Automatizado

### 1. Pipeline de Deploy Completo

#### Script Principal
```bash
#!/bin/bash
# scripts/deploy.sh

set -e  # Parar em caso de erro

echo "🚀 Iniciando deploy completo..."

# Validações pré-deploy
echo "🔍 Executando validações..."
npm run validate:all

# Build de todos os componentes
echo "🔨 Construindo aplicação..."
npm run build:all

# Testes finais
echo "🧪 Executando testes..."
npm run test:production

# Deploy para Firebase
echo "📤 Fazendo deploy para Firebase..."
firebase deploy

echo "✅ Deploy concluído com sucesso!"
```

#### Comandos npm
```json
{
  "scripts": {
    "deploy": "bash scripts/deploy.sh",
    "deploy:frontend": "firebase deploy --only hosting",
    "deploy:backend": "firebase deploy --only functions",
    "deploy:rules": "firebase deploy --only firestore:rules,storage",
    "validate:all": "npm run validate:config && npm run validate:build",
    "validate:config": "node scripts/validateEnvironment.js",
    "validate:build": "npm run build && npm run test:build",
    "build:all": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "test:production": "npm run test:frontend && npm run test:backend"
  }
}
```

### 2. Deploy por Componente

#### Frontend (Firebase Hosting)
```bash
# Build e deploy do frontend
cd frontend
npm run build
firebase deploy --only hosting

# Deploy com preview
firebase hosting:channel:deploy preview-$(date +%Y%m%d)
```

#### Backend (Firebase Functions)
```bash
# Deploy de todas as functions
firebase deploy --only functions

# Deploy de function específica
firebase deploy --only functions:api

# Deploy com configuração de runtime
firebase functions:config:set app.environment=production
firebase deploy --only functions
```

#### Regras de Segurança
```bash
# Deploy das regras Firestore
firebase deploy --only firestore:rules

# Deploy das regras Storage
firebase deploy --only storage

# Deploy de todas as regras
firebase deploy --only firestore:rules,storage
```

### 3. Deploy com Validação

#### Pipeline com Validação Automática
```javascript
// scripts/deployPipeline.js
const { DeploymentPipeline } = require('../shared/utils/DeploymentPipeline');

async function runDeployPipeline() {
  const pipeline = new DeploymentPipeline();
  
  try {
    // 1. Validação pré-deploy
    console.log('🔍 Validando configurações...');
    const validation = await pipeline.validateChanges();
    if (!validation.success) {
      throw new Error(`Validação falhou: ${validation.errors.join(', ')}`);
    }
    
    // 2. Build
    console.log('🔨 Construindo aplicação...');
    await pipeline.buildAll();
    
    // 3. Testes
    console.log('🧪 Executando testes...');
    await pipeline.runTests();
    
    // 4. Deploy
    console.log('📤 Fazendo deploy...');
    const result = await pipeline.deployAll();
    
    if (result.success) {
      console.log('✅ Deploy concluído com sucesso!');
      console.log(`📋 Versão: ${result.version}`);
    } else {
      throw new Error(`Deploy falhou: ${result.errors.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no deploy:', error.message);
    
    // Rollback automático em caso de falha
    console.log('🔄 Iniciando rollback...');
    await pipeline.rollback();
    
    process.exit(1);
  }
}

runDeployPipeline();
```

## Deploy Manual

### 1. Processo Passo-a-Passo

#### Preparação
```bash
# 1. Verificar branch
git branch
git status

# 2. Atualizar código
git pull origin main

# 3. Verificar configurações
node scripts/validateEnvironment.js --production

# 4. Limpar cache
npm run clean
```

#### Build
```bash
# 1. Instalar dependências atualizadas
npm ci
cd frontend && npm ci
cd ../backend && npm ci
cd ../functions && npm ci

# 2. Build frontend
cd frontend
npm run build
cd ..

# 3. Build backend (se necessário)
cd backend
npm run build
cd ..

# 4. Verificar builds
ls -la frontend/dist/
ls -la backend/dist/
```

#### Deploy
```bash
# 1. Deploy frontend
firebase deploy --only hosting

# 2. Deploy functions
firebase deploy --only functions

# 3. Deploy regras (se alteradas)
firebase deploy --only firestore:rules,storage

# 4. Verificar deploy
firebase hosting:releases:list --limit=5
```

### 2. Deploy de Emergência

#### Procedimento Rápido
```bash
#!/bin/bash
# scripts/emergency-deploy.sh

echo "🚨 DEPLOY DE EMERGÊNCIA"
echo "Pulando validações não-críticas..."

# Build rápido
npm run build:frontend --production
firebase deploy --only hosting

# Verificar se deploy funcionou
curl -f https://seu-dominio.com/health || {
  echo "❌ Deploy falhou, iniciando rollback..."
  firebase hosting:clone SOURCE_SITE_ID:VERSION_ID TARGET_SITE_ID
  exit 1
}

echo "✅ Deploy de emergência concluído"
```

## Rollback

### 1. Rollback Automático

#### Sistema de Rollback
```javascript
// scripts/rollback.js
const { RollbackManager } = require('../shared/utils/RollbackManager');

async function performRollback(targetVersion = null) {
  const rollback = new RollbackManager();
  
  try {
    // Listar versões disponíveis
    const versions = await rollback.listAvailableVersions();
    console.log('📋 Versões disponíveis:', versions);
    
    // Determinar versão alvo
    const target = targetVersion || versions.find(v => v.stable);
    if (!target) {
      throw new Error('Nenhuma versão estável encontrada');
    }
    
    console.log(`🔄 Fazendo rollback para versão: ${target.version}`);
    
    // Executar rollback
    const result = await rollback.rollbackTo(target.version);
    
    if (result.success) {
      console.log('✅ Rollback concluído com sucesso!');
      
      // Validar rollback
      await rollback.validateRollback();
      
    } else {
      throw new Error(`Rollback falhou: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Erro no rollback:', error.message);
    process.exit(1);
  }
}

// CLI
const targetVersion = process.argv[2];
performRollback(targetVersion);
```

### 2. Rollback Manual

#### Firebase Hosting
```bash
# 1. Listar releases
firebase hosting:releases:list --limit=10

# 2. Clonar release anterior
firebase hosting:clone SOURCE_SITE_ID:VERSION_ID TARGET_SITE_ID

# 3. Verificar rollback
curl -f https://seu-dominio.com/
```

#### Firebase Functions
```bash
# 1. Listar versões das functions
gcloud functions list

# 2. Fazer rollback de function específica
gcloud functions deploy FUNCTION_NAME --source=./previous-version/

# 3. Verificar function
gcloud functions describe FUNCTION_NAME
```

### 3. Rollback de Emergência

#### Procedimento Crítico
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

echo "🚨 ROLLBACK DE EMERGÊNCIA"

# Rollback imediato do hosting
LAST_STABLE=$(firebase hosting:releases:list --limit=5 | grep "FINALIZED" | head -1 | awk '{print $1}')
firebase hosting:clone $LAST_STABLE

# Rollback das functions críticas
firebase deploy --only functions:api,functions:auth --source=./backup/stable/

# Verificar sistema
node scripts/systemStatus.js --critical

echo "✅ Rollback de emergência concluído"
```

## Ambientes de Deploy

### 1. Desenvolvimento
```bash
# Configuração local
npm run dev

# Deploy para ambiente de desenvolvimento
firebase use dev-project
firebase deploy
```

### 2. Staging
```bash
# Deploy para staging
firebase use staging-project
npm run build:staging
firebase deploy

# Testes em staging
npm run test:staging
```

### 3. Produção
```bash
# Deploy para produção
firebase use production-project
npm run build:production
firebase deploy --only hosting,functions

# Monitoramento pós-deploy
npm run monitor:production
```

## Monitoramento de Deploy

### 1. Validação Pós-Deploy

#### Health Checks
```javascript
// scripts/post-deploy-validation.js
const { PostDeployValidator } = require('../shared/utils/PostDeployValidator');

async function validateDeploy() {
  const validator = new PostDeployValidator();
  
  const checks = [
    'frontend-accessibility',
    'api-endpoints',
    'authentication',
    'database-connectivity',
    'performance-metrics'
  ];
  
  for (const check of checks) {
    console.log(`🔍 Executando: ${check}`);
    const result = await validator.runCheck(check);
    
    if (result.success) {
      console.log(`✅ ${check}: OK`);
    } else {
      console.error(`❌ ${check}: FALHA - ${result.error}`);
      return false;
    }
  }
  
  console.log('✅ Todas as validações passaram!');
  return true;
}

validateDeploy();
```

### 2. Métricas de Deploy

#### Coleta de Métricas
```bash
# Tempo de deploy
echo "Deploy iniciado: $(date)" > deploy-metrics.log

# Executar deploy
time firebase deploy >> deploy-metrics.log 2>&1

# Métricas pós-deploy
echo "Deploy concluído: $(date)" >> deploy-metrics.log
node scripts/collectDeployMetrics.js >> deploy-metrics.log
```

## Troubleshooting de Deploy

### Problemas Comuns

#### 1. Falha no Build
```bash
# Limpar cache e rebuildar
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 2. Erro de Permissões Firebase
```bash
# Re-autenticar
firebase logout
firebase login

# Verificar projeto
firebase use
firebase projects:list
```

#### 3. Timeout no Deploy
```bash
# Deploy com timeout aumentado
firebase deploy --timeout=600s

# Deploy por partes
firebase deploy --only hosting
firebase deploy --only functions
```

#### 4. Falha na Validação
```bash
# Debug da validação
node scripts/validateEnvironment.js --debug

# Pular validações não-críticas (emergência)
SKIP_VALIDATION=true npm run deploy
```

## Automação de Deploy

### 1. GitHub Actions

#### Workflow de Deploy
```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Build
      run: npm run build:production
    
    - name: Deploy to Firebase
      uses: FirebaseExtended/action-hosting-deploy@v0
      with:
        repoToken: '${{ secrets.GITHUB_TOKEN }}'
        firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
        projectId: your-project-id
```

### 2. Hooks de Deploy

#### Pre-deploy Hook
```bash
#!/bin/bash
# .git/hooks/pre-push

echo "🔍 Executando validações pré-deploy..."

# Executar testes
npm run test || {
  echo "❌ Testes falharam"
  exit 1
}

# Validar configurações
node scripts/validateEnvironment.js || {
  echo "❌ Configurações inválidas"
  exit 1
}

echo "✅ Validações passaram"
```

## Backup e Recuperação

### 1. Backup Pré-Deploy
```bash
#!/bin/bash
# scripts/backup-before-deploy.sh

backup_dir="backups/pre-deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# Backup do código atual
git archive HEAD | tar -x -C "$backup_dir"

# Backup das configurações
cp -r .env* "$backup_dir/"
cp firebase.json "$backup_dir/"

# Backup do banco de dados
node scripts/backup-firestore.js "$backup_dir/firestore-backup.json"

echo "✅ Backup salvo em: $backup_dir"
```

### 2. Recuperação de Desastre
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

echo "🚨 PROCEDIMENTO DE RECUPERAÇÃO DE DESASTRE"

# 1. Rollback para última versão estável
firebase hosting:clone LAST_STABLE_VERSION

# 2. Restaurar functions críticas
firebase deploy --only functions:critical --source=./backups/stable/

# 3. Verificar integridade do sistema
node scripts/systemStatus.js --emergency

# 4. Notificar equipe
node scripts/notifyEmergency.js "Sistema restaurado após falha crítica"

echo "✅ Recuperação de desastre concluída"
```

## Checklist de Deploy

### ✅ Pré-Deploy
- [ ] Código atualizado e testado
- [ ] Configurações validadas
- [ ] Backup realizado
- [ ] Testes passando
- [ ] Dependências atualizadas

### ✅ Durante Deploy
- [ ] Build bem-sucedido
- [ ] Deploy sem erros
- [ ] Validações pós-deploy passando
- [ ] Métricas coletadas

### ✅ Pós-Deploy
- [ ] Sistema funcionando
- [ ] Performance adequada
- [ ] Monitoramento ativo
- [ ] Documentação atualizada
- [ ] Equipe notificada

## Contatos de Emergência

Para problemas críticos de deploy:
1. **Rollback Automático:** `npm run rollback:emergency`
2. **Suporte Técnico:** Executar `node scripts/escalate.js --deploy-critical`
3. **Backup Manual:** Seguir `docs/backup/MANUAL_RECOVERY.md`