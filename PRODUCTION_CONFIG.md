# Configuração de Produção - Sistema Curva Mestra

## URLs e Endpoints de Produção

### Frontend (Firebase Hosting)
- **URL Principal**: https://curva-mestra.web.app
- **URL Alternativa**: https://curva-mestra.firebaseapp.com
- **CDN**: Habilitado automaticamente pelo Firebase Hosting
- **HTTPS**: Certificado SSL automático

### Backend (Firebase Functions)
- **Base URL**: https://us-central1-curva-mestra.cloudfunctions.net
- **Endpoints API**:
  - `/api/products` - Gestão de produtos
  - `/api/requests` - Gestão de solicitações
  - `/api/patients` - Gestão de pacientes
  - `/api/invoices` - Gestão de notas fiscais
  - `/api/auth` - Autenticação e autorização

### Banco de Dados (Firestore)
- **Projeto**: curva-mestra
- **Região**: us-central1
- **Modo**: Produção
- **Backup**: Automático diário às 2h UTC

## Configurações de Ambiente

### Firebase Functions - Variáveis de Ambiente
```bash
# Configuradas via Firebase CLI
firebase functions:config:set email.service_enabled=true
firebase functions:config:set email.from=noreply@curva-mestra.firebaseapp.com
firebase functions:config:set monitoring.performance=true
firebase functions:config:set monitoring.error_reporting=true
firebase functions:config:set monitoring.analytics=true
firebase functions:config:set security.cors_origins=https://curva-mestra.web.app,https://curva-mestra.firebaseapp.com
firebase functions:config:set backup.enabled=true
firebase functions:config:set backup.schedule="0 2 * * *"
firebase functions:config:set backup.retention_days=30
```

### Frontend - Variáveis de Ambiente (.env.production)
```bash
VITE_NODE_ENV=production
VITE_FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
VITE_FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=curva-mestra
VITE_FIREBASE_STORAGE_BUCKET=curva-mestra.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1079488992
VITE_FIREBASE_APP_ID=1:1079488992:web:your-app-id-here
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

## Segurança

### Firestore Security Rules
- **Localização**: `firestore.rules`
- **Princípios**:
  - Autenticação obrigatória para todas as operações
  - Isolamento por clínica (multi-tenant)
  - Controle de acesso baseado em roles
  - Validação de estrutura de dados

### CORS Configuration
- **Origens Permitidas**:
  - https://curva-mestra.web.app
  - https://curva-mestra.firebaseapp.com
- **Métodos**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Authorization, Content-Type

### Headers de Segurança (Firebase Hosting)
```json
{
  "headers": [
    {
      "source": "**",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "DENY"},
        {"key": "X-XSS-Protection", "value": "1; mode=block"},
        {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}
      ]
    }
  ]
}
```

## Monitoramento e Alertas

### Firebase Performance Monitoring
- **Status**: Ativo
- **Métricas Monitoradas**:
  - Tempo de carregamento da página
  - Tempo de resposta das Functions
  - Uso de recursos
  - Erros de rede

### Firebase Analytics
- **Status**: Ativo
- **Eventos Personalizados**:
  - Login de usuários
  - Criação de produtos
  - Geração de relatórios
  - Alertas de vencimento

### Error Reporting (Firebase Crashlytics)
- **Status**: Ativo
- **Configuração**:
  - Relatórios automáticos de erros
  - Stack traces detalhados
  - Alertas por email para erros críticos

### Alertas Configurados
1. **Produtos Vencendo** (30 dias)
   - Trigger: Função agendada diária
   - Notificação: In-app + email
   
2. **Estoque Baixo**
   - Trigger: Atualização de produto
   - Notificação: Tempo real
   
3. **Erros Críticos**
   - Trigger: Exception não tratada
   - Notificação: Email imediato

## Backup e Recuperação

### Backup Automático
- **Frequência**: Diário às 2h UTC
- **Retenção**: 30 dias
- **Localização**: Google Cloud Storage
- **Escopo**: Firestore completo

### Procedimento de Restore
```bash
# Listar backups disponíveis
gcloud firestore operations list

# Restaurar backup específico
gcloud firestore import gs://curva-mestra-backups/[BACKUP_DATE]
```

## Performance

### Cache Configuration
- **Assets Estáticos**: 1 ano (immutable)
- **Imagens**: 1 dia
- **HTML**: No cache (must-revalidate)
- **API Responses**: Cache do Firestore (automático)

### Otimizações
- **Bundle Splitting**: Ativo (Vite)
- **Tree Shaking**: Ativo
- **Minificação**: Ativo
- **Compressão**: Gzip automático (Firebase Hosting)

## Custos Estimados (Mensal)

### Firebase Services
- **Hosting**: $0 (dentro do limite gratuito)
- **Functions**: $5-15 (baseado no uso)
- **Firestore**: $10-25 (baseado no volume de dados)
- **Authentication**: $0 (dentro do limite gratuito)
- **Storage**: $1-5 (backups)

**Total Estimado**: $16-45/mês

## Comandos de Deploy

### Deploy Completo
```powershell
# Windows PowerShell
.\scripts\deploy-production.ps1

# Com opções
.\scripts\deploy-production.ps1 -SkipTests -Force
```

### Deploy Parcial
```bash
# Apenas Functions
firebase deploy --only functions --project curva-mestra

# Apenas Hosting
firebase deploy --only hosting --project curva-mestra

# Apenas Firestore rules
firebase deploy --only firestore:rules --project curva-mestra
```

## Monitoramento de Custos

### Dashboard de Custos
- **URL**: https://console.firebase.google.com/project/curva-mestra/usage
- **Alertas**: Configurados para 80% do orçamento
- **Relatórios**: Mensais automáticos

### Otimização de Custos
1. **Firestore**:
   - Usar consultas eficientes
   - Implementar paginação
   - Cache de dados frequentes

2. **Functions**:
   - Otimizar tempo de execução
   - Usar memory adequada
   - Implementar timeout apropriado

3. **Storage**:
   - Limpeza automática de backups antigos
   - Compressão de dados

## Troubleshooting

### Problemas Comuns

#### 1. Erro de CORS
```bash
# Verificar configuração
firebase functions:config:get security.cors_origins

# Reconfigurar se necessário
firebase functions:config:set security.cors_origins=https://curva-mestra.web.app
```

#### 2. Falha de Autenticação
```bash
# Verificar regras do Firestore
firebase firestore:rules:get

# Testar regras localmente
firebase emulators:start --only firestore
```

#### 3. Performance Lenta
- Verificar índices do Firestore
- Analisar queries no console
- Otimizar bundle size do frontend

### Logs e Debugging
```bash
# Logs das Functions
firebase functions:log --project curva-mestra

# Logs específicos de uma função
firebase functions:log --only products --project curva-mestra
```

## Contatos e Suporte

### Equipe Técnica
- **Desenvolvedor Principal**: [Nome]
- **DevOps**: [Nome]
- **Suporte**: [Email]

### Recursos Externos
- **Firebase Support**: https://firebase.google.com/support
- **Documentação**: https://firebase.google.com/docs
- **Status Page**: https://status.firebase.google.com

---

**Última Atualização**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Versão do Sistema**: 1.0.0
**Ambiente**: Produção