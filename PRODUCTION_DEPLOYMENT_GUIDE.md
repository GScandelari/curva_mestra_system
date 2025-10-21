# Guia de Deploy de Produção - Sistema Curva Mestra

## Visão Geral

Este guia descreve o processo completo de deploy do sistema Curva Mestra para produção usando Firebase. O sistema foi migrado de uma arquitetura tradicional (Node.js + PostgreSQL) para uma arquitetura serverless totalmente gerenciada.

## Pré-requisitos

### Software Necessário
- **Node.js** 16+ 
- **Firebase CLI** (`npm install -g firebase-tools`)
- **PowerShell** 5.1+ (Windows)
- **Git** para controle de versão

### Configuração Inicial
1. **Autenticação Firebase**:
   ```bash
   firebase login
   ```

2. **Verificar Projeto**:
   ```bash
   firebase projects:list
   ```

3. **Configurar Projeto Local**:
   ```bash
   firebase use curva-mestra
   ```

## Estrutura do Projeto

```
curva_mestra_system/
├── frontend/                 # React frontend
│   ├── src/
│   ├── dist/                # Build output
│   └── package.json
├── functions/               # Firebase Functions
│   ├── src/
│   ├── lib/                # Compiled output
│   └── package.json
├── scripts/                # Deployment scripts
│   ├── deploy-production.ps1
│   ├── setup-monitoring.ps1
│   └── validate-production.ps1
├── firebase.json           # Firebase configuration
├── firestore.rules        # Security rules
└── firestore.indexes.json # Database indexes
```

## Deploy de Produção

### Método 1: Deploy Automático (Recomendado)

Execute o script de deploy completo:

```powershell
# Deploy completo
.\scripts\deploy-production.ps1

# Deploy com opções
.\scripts\deploy-production.ps1 -SkipTests -Force
```

### Método 2: Deploy Manual

#### Passo 1: Preparar Functions
```bash
cd functions
npm ci
npm run build
npm run test
```

#### Passo 2: Deploy Functions
```bash
firebase deploy --only functions --project curva-mestra
```

#### Passo 3: Preparar Frontend
```bash
cd frontend
npm ci
npm run build:production
```

#### Passo 4: Deploy Hosting
```bash
firebase deploy --only hosting --project curva-mestra
```

#### Passo 5: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules,firestore:indexes --project curva-mestra
```

## Configuração de Monitoramento

### Configuração Automática
```powershell
.\scripts\setup-monitoring.ps1 -NotificationEmail "admin@empresa.com"
```

### Configuração Manual

#### 1. Performance Monitoring
- Acesse: https://console.firebase.google.com/project/curva-mestra/performance
- Habilite Performance Monitoring
- Configure alertas para tempo de resposta > 3s

#### 2. Analytics
- Acesse: https://console.firebase.google.com/project/curva-mestra/analytics
- Configure eventos personalizados
- Habilite relatórios automáticos

#### 3. Error Reporting
- Acesse: https://console.firebase.google.com/project/curva-mestra/crashlytics
- Configure alertas por email
- Defina thresholds para erros críticos

## Validação do Deploy

### Validação Automática
```powershell
.\scripts\validate-production.ps1
```

### Validação Manual

#### 1. Testar Frontend
- Acesse: https://curva-mestra.web.app
- Verifique carregamento da página
- Teste login/logout
- Verifique funcionalidades principais

#### 2. Testar API
```bash
# Health check
curl https://us-central1-curva-mestra.cloudfunctions.net/healthCheck

# Test CORS
curl -X OPTIONS https://us-central1-curva-mestra.cloudfunctions.net/api/products
```

#### 3. Testar Firestore
```bash
# Verificar regras
firebase firestore:rules:get --project curva-mestra

# Testar conexão
firebase firestore:rules:test --project curva-mestra
```

## Configurações de Produção

### URLs de Produção
- **Frontend**: https://curva-mestra.web.app
- **API**: https://us-central1-curva-mestra.cloudfunctions.net
- **Console**: https://console.firebase.google.com/project/curva-mestra

### Variáveis de Ambiente

#### Frontend (.env.production)
```bash
VITE_NODE_ENV=production
VITE_FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
VITE_FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=curva-mestra
VITE_FIREBASE_STORAGE_BUCKET=curva-mestra.appspot.com
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

#### Functions (Firebase Config)
```bash
firebase functions:config:set email.service_enabled=true
firebase functions:config:set monitoring.performance=true
firebase functions:config:set backup.enabled=true
firebase functions:config:set security.cors_origins=https://curva-mestra.web.app
```

## Segurança

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require authentication
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Check user role
    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }
    
    // Check clinic access
    function sameClinic(clinicId) {
      return isAuthenticated() && request.auth.token.clinicId == clinicId;
    }
    
    match /clinics/{clinicId} {
      allow read, write: if sameClinic(clinicId);
      
      match /{document=**} {
        allow read, write: if sameClinic(clinicId);
      }
    }
  }
}
```

### CORS Configuration
```json
{
  "origins": [
    "https://curva-mestra.web.app",
    "https://curva-mestra.firebaseapp.com"
  ],
  "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "headers": ["Authorization", "Content-Type"]
}
```

## Backup e Recuperação

### Backup Automático
- **Frequência**: Diário às 2h UTC
- **Retenção**: 30 dias
- **Localização**: Google Cloud Storage

### Comandos de Backup
```bash
# Backup manual
gcloud firestore export gs://curva-mestra-backups/$(date +%Y%m%d)

# Listar backups
gsutil ls gs://curva-mestra-backups/

# Restaurar backup
gcloud firestore import gs://curva-mestra-backups/[BACKUP_DATE]
```

## Monitoramento de Custos

### Estimativa Mensal
- **Hosting**: $0 (gratuito)
- **Functions**: $5-15
- **Firestore**: $10-25
- **Auth**: $0 (gratuito)
- **Storage**: $1-5
- **Total**: $16-45

### Alertas de Custo
```bash
# Configurar alerta de custo
gcloud billing budgets create \
  --billing-account=[BILLING_ACCOUNT_ID] \
  --display-name="Curva Mestra Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=80
```

## Troubleshooting

### Problemas Comuns

#### 1. Erro de Deploy das Functions
```bash
# Verificar logs
firebase functions:log --project curva-mestra

# Verificar configuração
firebase functions:config:get --project curva-mestra
```

#### 2. Erro de CORS
```bash
# Reconfigurar CORS
firebase functions:config:set security.cors_origins=https://curva-mestra.web.app
firebase deploy --only functions
```

#### 3. Erro de Firestore Rules
```bash
# Testar regras localmente
firebase emulators:start --only firestore
firebase firestore:rules:test --project curva-mestra
```

#### 4. Frontend não carrega
- Verificar build: `npm run build:production`
- Verificar firebase.json hosting config
- Verificar cache do browser (Ctrl+F5)

### Logs e Debugging

#### Functions Logs
```bash
# Logs gerais
firebase functions:log --project curva-mestra

# Logs específicos
firebase functions:log --only products --project curva-mestra

# Logs em tempo real
firebase functions:log --follow --project curva-mestra
```

#### Performance Monitoring
- Console: https://console.firebase.google.com/project/curva-mestra/performance
- Métricas: Tempo de carregamento, erros de rede, uso de recursos

#### Error Reporting
- Console: https://console.firebase.google.com/project/curva-mestra/crashlytics
- Alertas automáticos por email
- Stack traces detalhados

## Manutenção

### Atualizações Regulares

#### Dependências
```bash
# Frontend
cd frontend && npm audit && npm update

# Functions
cd functions && npm audit && npm update
```

#### Firebase CLI
```bash
npm update -g firebase-tools
```

### Limpeza de Recursos

#### Logs Antigos
```bash
# Limpar logs de functions (30+ dias)
gcloud logging sinks delete old-logs --project curva-mestra
```

#### Backups Antigos
```bash
# Limpar backups (30+ dias)
gsutil -m rm gs://curva-mestra-backups/[OLD_BACKUP_DATE]/**
```

## Rollback

### Rollback de Functions
```bash
# Listar versões
firebase functions:list --project curva-mestra

# Rollback para versão anterior
firebase functions:rollback [FUNCTION_NAME] --project curva-mestra
```

### Rollback de Hosting
```bash
# Listar releases
firebase hosting:releases:list --project curva-mestra

# Rollback para release anterior
firebase hosting:releases:rollback [RELEASE_ID] --project curva-mestra
```

### Rollback de Firestore Rules
```bash
# Backup das regras atuais
firebase firestore:rules:get --project curva-mestra > firestore.rules.backup

# Restaurar regras anteriores
firebase deploy --only firestore:rules --project curva-mestra
```

## Contatos e Suporte

### Equipe Técnica
- **Desenvolvedor Principal**: [Nome do desenvolvedor]
- **Email de Suporte**: suporte@curva-mestra.com
- **Telefone de Emergência**: [Telefone]

### Recursos Firebase
- **Documentação**: https://firebase.google.com/docs
- **Suporte**: https://firebase.google.com/support
- **Status**: https://status.firebase.google.com
- **Comunidade**: https://stackoverflow.com/questions/tagged/firebase

---

**Última Atualização**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")  
**Versão do Sistema**: 1.0.0  
**Ambiente**: Produção  
**Projeto Firebase**: curva-mestra