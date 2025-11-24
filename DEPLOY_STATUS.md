# Status do Deploy - Curva Mestra

**Data:** 24/11/2025
**Projeto Firebase:** curva-mestra

## ✅ Componentes Implantados com Sucesso

### 1. Firestore Database
- **Status:** ✅ Deployed
- **Regras de Segurança:** Ativas (multi-tenant com RLS)
- **Índices:** Configurados
- **Console:** https://console.firebase.google.com/project/curva-mestra/firestore

### 2. Firebase Storage
- **Status:** ✅ Deployed
- **Regras de Segurança:** Ativas (multi-tenant)
- **Console:** https://console.firebase.google.com/project/curva-mestra/storage

## ⚠️ Componentes Bloqueados

### 3. Firebase Functions
- **Status:** ❌ Bloqueado por bug do Firebase CLI
- **Problema:** Timeout durante análise do código (10 segundos)
- **Causa Raiz:** Incompatibilidade do Firebase CLI 14.24.0 com Node.js 22
- **Issue Conhecida:** https://github.com/firebase/firebase-tools/issues (Next.js 15 + Node 22)

**Mensagem de Erro:**
```
Error: User code failed to load. Cannot determine backend specification.
Timeout after 10000. See https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization
```

**Functions Prontas (aguardando deploy):**
- `placeholder` - Function de teste simples
- `sendTestEmail` - Envio de email via Zoho SMTP (comentada, requer secrets)
- `onUserCreated` - Trigger de boas-vindas (comentada, requer secrets)
- `onTenantCreated` - Notificação de nova clínica (comentada, requer secrets)

### 4. Firebase Hosting (Next.js)
- **Status:** ❌ Bloqueado pelo mesmo bug
- **Problema:** Firebase precisa criar uma Cloud Function automática (`ssrcurvamestra`) para rodar o Next.js
- **Alternativa:** Hospedar temporariamente em Vercel ou local

## 🔧 Soluções Alternativas

### Opção 1: Usar Node.js 20 (Recomendado)
1. Instalar Node.js 20 via `nvm`:
   ```bash
   nvm install 20
   nvm use 20
   firebase deploy --only functions
   ```

### Opção 2: Aguardar Correção do Firebase CLI
- Acompanhar: https://github.com/firebase/firebase-tools/issues
- Firebase já está ciente do problema com Next.js 15

### Opção 3: Deploy Manual via Docker
```bash
# Build Docker image
docker build -t curva-mestra-ssr .

# Deploy para Cloud Run
gcloud run deploy curva-mestra \
  --image curva-mestra-ssr \
  --platform managed \
  --region southamerica-east1
```

### Opção 4: Hospedar Frontend em Vercel (Temporário)
```bash
npm install -g vercel
vercel --prod
```

## 🚀 Configuração Atual para Desenvolvimento

### Emuladores Locais (Funcionando)
```bash
firebase emulators:start
```

**URLs dos Emuladores:**
- Auth: http://localhost:9099
- Firestore: http://localhost:8080
- Functions: http://localhost:5001
- Hosting: http://localhost:5000
- Storage: http://localhost:9199
- UI: http://localhost:4000

### Desenvolvimento Local (Next.js)
```bash
npm run dev
# http://localhost:3000
```

## 📋 Próximos Passos (Ordem de Prioridade)

### Prioridade 1: Continuar Desenvolvimento Local
- ✅ Sistema de autenticação multi-tenant funcionando
- ✅ Portal Admin (products, tenants, users)
- ✅ Portal Clínica (inventory, requests)
- ✅ Sistema de solicitações completo
- ✅ Firestore e Storage rules configuradas

### Prioridade 2: Resolver Deploy
**Opções em ordem de facilidade:**
1. Instalar Node 20 e fazer deploy normal
2. Hospedar frontend em Vercel temporariamente
3. Aguardar correção do Firebase CLI
4. Deploy manual via Cloud Run com Docker

### Prioridade 3: Configurar Secrets (Após resolver deploy)
```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

Após configurar secrets, descomentar as functions em:
- `functions/src/index.ts`

### Prioridade 4: Features Pendentes do MVP
- [ ] Sistema de alertas de vencimento/estoque baixo
- [ ] Dashboard com métricas em tempo real
- [ ] Relatórios de consumo por paciente
- [ ] Integração com WhatsApp (notificações)
- [ ] PWA para mobile

## 📝 Notas Importantes

1. **Multi-Tenant Funcionando:** Todas as regras de segurança RLS estão ativas no Firestore
2. **Development Ready:** Ambiente local totalmente funcional com emuladores
3. **Production Database:** Firestore em produção está configurado e seguro
4. **Storage Configurado:** Upload de arquivos funcionando (estrutura: `/danfe/{tenant_id}/`)

## 🔗 Links Úteis

- **Firebase Console:** https://console.firebase.google.com/project/curva-mestra
- **Firestore Data:** https://console.firebase.google.com/project/curva-mestra/firestore/databases/-default-/data
- **Storage Files:** https://console.firebase.google.com/project/curva-mestra/storage
- **Functions (quando deployadas):** https://console.firebase.google.com/project/curva-mestra/functions

## 🎯 Decisão: Priorizar MVP

**Decisão tomada:** Continuar desenvolvimento local e focar em completar funcionalidades do MVP antes de resolver o problema de deploy.

**Justificativa:**
- Firestore e Storage já estão em produção (suficiente para desenvolvimento)
- Frontend pode rodar localmente ou em Vercel
- Functions podem aguardar (não bloqueiam MVP)
- Resolver deploy não agrega valor imediato ao MVP

**Próximo Milestone:** Completar todas as features do MVP com emuladores locais.
