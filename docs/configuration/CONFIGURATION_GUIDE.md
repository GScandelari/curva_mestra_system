# Guia de Configuração - Plataforma Curva Mestra

## Visão Geral

Este guia fornece instruções detalhadas para configurar todos os componentes da plataforma Curva Mestra, incluindo variáveis de ambiente, Firebase, e configurações de desenvolvimento e produção.

## Estrutura de Configuração

```
projeto/
├── .env                          # Configurações raiz
├── .env.example                  # Template de configurações
├── .env.production.example       # Template para produção
├── frontend/
│   ├── .env                      # Configurações frontend
│   ├── .env.example              # Template frontend
│   └── .env.production           # Configurações produção frontend
├── backend/
│   ├── .env                      # Configurações backend
│   ├── .env.example              # Template backend
│   ├── .env.production           # Configurações produção backend
│   └── .env.test                 # Configurações para testes
├── functions/
│   └── .env.production           # Configurações Firebase Functions
└── firebase.json                 # Configurações Firebase
```

## Configurações Firebase

### 1. Configuração Básica

#### Variáveis Obrigatórias (Frontend)
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

#### Variáveis Obrigatórias (Backend)
```env
# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
```

### 2. Obter Configurações Firebase

#### Passo 1: Console Firebase
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em "Configurações do projeto" (ícone de engrenagem)
4. Na aba "Geral", role até "Seus apps"
5. Clique no ícone de configuração (</>) para app web
6. Copie as configurações mostradas

#### Passo 2: Service Account (Backend)
1. No Firebase Console, vá em "Configurações do projeto"
2. Aba "Contas de serviço"
3. Clique em "Gerar nova chave privada"
4. Baixe o arquivo JSON
5. Extraia as informações necessárias:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

### 3. Validação de Configuração

#### Script de Validação
```bash
# Validar configurações Firebase
node scripts/validateEnvironment.js --firebase

# Testar conectividade
node scripts/testFirebaseInit.js

# Verificar permissões
node scripts/testFirebasePermissions.js
```

## Configurações de Ambiente

### Desenvolvimento (.env)
```env
# Environment
NODE_ENV=development
PORT=3000
BACKEND_PORT=5000

# Firebase (Development)
VITE_FIREBASE_API_KEY=dev_api_key
VITE_FIREBASE_AUTH_DOMAIN=dev-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dev-project-id

# API Configuration
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Debug
DEBUG_MODE=true
LOG_LEVEL=debug
ENABLE_CORS=true
```

### Produção (.env.production)
```env
# Environment
NODE_ENV=production
PORT=443
BACKEND_PORT=8080

# Firebase (Production)
VITE_FIREBASE_API_KEY=prod_api_key
VITE_FIREBASE_AUTH_DOMAIN=prod-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=prod-project-id

# API Configuration
API_BASE_URL=https://api.curvamestra.com
FRONTEND_URL=https://curvamestra.com

# Security
ENABLE_CORS=false
LOG_LEVEL=error
RATE_LIMIT_ENABLED=true
```

### Testes (.env.test)
```env
# Environment
NODE_ENV=test
PORT=3001
BACKEND_PORT=5001

# Firebase (Test)
VITE_FIREBASE_API_KEY=test_api_key
VITE_FIREBASE_AUTH_DOMAIN=test-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=test-project-id

# Test Configuration
TEST_TIMEOUT=30000
MOCK_FIREBASE=true
DISABLE_AUTH=true
```

## Configurações Específicas por Componente

### Frontend (Vite)
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: true,
    cors: process.env.ENABLE_CORS === 'true'
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});
```

### Backend (Express)
```javascript
// backend/src/config/index.js
module.exports = {
  port: process.env.BACKEND_PORT || 5000,
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  }
};
```

### Firebase Functions
```javascript
// functions/src/config/index.js
const functions = require('firebase-functions');

module.exports = {
  cors: {
    origin: functions.config().app?.frontend_url || 'http://localhost:3000'
  },
  auth: {
    adminEmail: functions.config().auth?.admin_email
  },
  api: {
    timeout: 30000,
    retries: 3
  }
};
```

## Configurações de Segurança

### Firestore Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler/escrever seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Apenas admins podem acessar dados administrativos
    match /admin/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Dados públicos (somente leitura)
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

### Storage Rules
```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Usuários podem fazer upload de seus próprios arquivos
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // Arquivos públicos
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
```

## Configurações de Monitoramento

### Logging
```env
# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
LOG_FILE=logs/app.log            # Arquivo de log
LOG_MAX_SIZE=10MB                # Tamanho máximo do arquivo
LOG_MAX_FILES=5                  # Número máximo de arquivos
ENABLE_CONSOLE_LOG=true          # Log no console
```

### Métricas
```env
# Metrics Configuration
ENABLE_METRICS=true              # Ativar coleta de métricas
METRICS_INTERVAL=60000           # Intervalo de coleta (ms)
METRICS_RETENTION=7d             # Retenção de dados
ALERT_EMAIL=admin@curvamestra.com # Email para alertas
```

### Health Checks
```env
# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000      # Intervalo de verificação (ms)
HEALTH_CHECK_TIMEOUT=5000        # Timeout para verificações (ms)
ENABLE_AUTO_RECOVERY=true        # Recuperação automática
```

## Configurações de Performance

### Cache
```env
# Cache Configuration
ENABLE_CACHE=true                # Ativar cache
CACHE_TTL=300000                 # TTL padrão (ms)
CACHE_MAX_SIZE=100MB             # Tamanho máximo do cache
REDIS_URL=redis://localhost:6379 # URL do Redis (se usado)
```

### Rate Limiting
```env
# Rate Limiting
RATE_LIMIT_ENABLED=true          # Ativar rate limiting
RATE_LIMIT_WINDOW=900000         # Janela de tempo (ms)
RATE_LIMIT_MAX_REQUESTS=100      # Máximo de requisições por janela
RATE_LIMIT_SKIP_SUCCESSFUL=true  # Pular requisições bem-sucedidas
```

## Validação de Configuração

### Script de Validação Automática
```bash
#!/bin/bash
# scripts/validate-config.sh

echo "🔍 Validando configurações..."

# Verificar arquivos de configuração obrigatórios
required_files=(".env" "firebase.json" "frontend/.env" "backend/.env")
for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Arquivo obrigatório não encontrado: $file"
    exit 1
  fi
done

# Validar variáveis Firebase
node scripts/validateEnvironment.js --firebase

# Testar conectividade
node scripts/testFirebaseInit.js

# Verificar permissões
node scripts/testFirebasePermissions.js

echo "✅ Configurações validadas com sucesso!"
```

### Checklist de Configuração

#### ✅ Configuração Inicial
- [ ] Arquivo `.env` criado e configurado
- [ ] Configurações Firebase definidas
- [ ] Service Account configurado
- [ ] Regras Firestore definidas
- [ ] Regras Storage definidas

#### ✅ Configuração de Desenvolvimento
- [ ] Variáveis de desenvolvimento configuradas
- [ ] CORS habilitado para desenvolvimento
- [ ] Debug mode ativado
- [ ] Logs detalhados habilitados

#### ✅ Configuração de Produção
- [ ] Variáveis de produção configuradas
- [ ] HTTPS configurado
- [ ] Rate limiting ativado
- [ ] Logs de produção configurados
- [ ] Monitoramento ativado

#### ✅ Configuração de Segurança
- [ ] Chaves privadas protegidas
- [ ] Regras de segurança implementadas
- [ ] CORS configurado corretamente
- [ ] Autenticação funcionando

#### ✅ Configuração de Performance
- [ ] Cache configurado
- [ ] Rate limiting implementado
- [ ] Otimizações de build aplicadas
- [ ] CDN configurado (se aplicável)

## Troubleshooting de Configuração

### Problemas Comuns

#### 1. Erro "Firebase project not found"
**Causa:** `FIREBASE_PROJECT_ID` incorreto
**Solução:**
```bash
# Verificar projeto ativo
firebase use

# Listar projetos disponíveis
firebase projects:list

# Definir projeto correto
firebase use your-project-id
```

#### 2. Erro "Permission denied"
**Causa:** Service Account sem permissões
**Solução:**
1. Verificar se o Service Account tem as roles necessárias
2. Regenerar chave privada se necessário
3. Verificar se `FIREBASE_PRIVATE_KEY` está formatado corretamente

#### 3. Erro de CORS
**Causa:** Configuração CORS incorreta
**Solução:**
```javascript
// backend/src/middleware/cors.js
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

### Ferramentas de Debug
```bash
# Validar todas as configurações
node scripts/validateEnvironment.js --all

# Testar configuração específica
node scripts/validateEnvironment.js --firebase
node scripts/validateEnvironment.js --cors
node scripts/validateEnvironment.js --auth

# Debug de configuração
node scripts/debug/debugToolkit.js firebase
```

## Backup de Configuração

### Script de Backup
```bash
#!/bin/bash
# scripts/backup-config.sh

backup_dir="backups/config-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# Backup de arquivos de configuração (sem dados sensíveis)
cp .env.example "$backup_dir/"
cp firebase.json "$backup_dir/"
cp firestore.rules "$backup_dir/"
cp storage.rules "$backup_dir/"

echo "✅ Backup de configuração salvo em: $backup_dir"
```

## Atualizações de Configuração

### Processo de Atualização
1. **Backup:** Sempre fazer backup antes de mudanças
2. **Validação:** Testar configurações em ambiente de desenvolvimento
3. **Deploy:** Aplicar mudanças em produção gradualmente
4. **Monitoramento:** Monitorar sistema após mudanças

### Versionamento de Configuração
- Usar Git para versionar arquivos `.example`
- Documentar mudanças no `CHANGELOG.md`
- Manter histórico de configurações críticas