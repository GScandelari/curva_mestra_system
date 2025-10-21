# Firebase Hosting Setup Guide

Este documento descreve a configuração completa do Firebase Hosting para o sistema Curva Mestra.

## 📋 Configuração Atual

### Estrutura de Arquivos

```
├── firebase.json              # Configuração principal do Firebase
├── .firebaserc               # Configuração de projetos
├── firebase-hosting.config.js # Configurações avançadas
├── frontend/
│   ├── public/               # Arquivos públicos
│   │   ├── manifest.json     # PWA manifest
│   │   ├── robots.txt        # SEO robots
│   │   └── _headers          # Headers customizados
│   ├── dist/                 # Build de produção
│   └── vite.config.js        # Configuração do Vite
└── scripts/
    ├── deploy-hosting.ps1    # Script de deploy (Windows)
    └── deploy-hosting.sh     # Script de deploy (Unix)
```

### Configurações do firebase.json

#### Hosting
- **Public Directory**: `frontend/dist`
- **SPA Rewrites**: Todas as rotas redirecionam para `/index.html`
- **API Rewrites**: `/api/**` redireciona para Firebase Functions
- **Security Headers**: Headers de segurança configurados
- **Cache Headers**: Cache otimizado por tipo de arquivo

#### Headers de Segurança
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

#### Cache Strategy
- **Assets estáticos** (`/assets/**`): 1 ano, immutable
- **Imagens**: 1 dia
- **HTML**: Sem cache, must-revalidate
- **Service Worker**: Sem cache

## 🚀 Deploy

### Usando Scripts Automatizados

#### Windows (PowerShell)
```powershell
# Deploy para staging
.\scripts\deploy-hosting.ps1

# Deploy para produção
.\scripts\deploy-hosting.ps1 -Environment production

# Deploy sem rebuild
.\scripts\deploy-hosting.ps1 -SkipBuild
```

#### Unix/Linux/macOS
```bash
# Deploy para staging
./scripts/deploy-hosting.sh

# Deploy para produção
./scripts/deploy-hosting.sh production

# Deploy sem rebuild
./scripts/deploy-hosting.sh staging true
```

### Deploy Manual

1. **Build do Frontend**
   ```bash
   cd frontend
   npm run build:production
   ```

2. **Deploy para Firebase**
   ```bash
   # Staging
   firebase deploy --only hosting --project staging
   
   # Produção
   firebase deploy --only hosting --project production
   ```

## 🔧 Configuração de Domínio Customizado

### 1. Adicionar Domínio no Firebase Console

1. Acesse o [Firebase Console](https://console.firebase.google.com)
2. Vá para **Hosting** > **Add custom domain**
3. Digite seu domínio (ex: `app.curvamestra.com.br`)
4. Siga as instruções para verificação

### 2. Configurar DNS

Adicione os registros DNS fornecidos pelo Firebase:

```
Type: A
Name: @
Value: 151.101.1.195
       151.101.65.195

Type: AAAA  
Name: @
Value: 2a04:4e42::645
       2a04:4e42:200::645
```

### 3. Configurar Subdomínio (www)

```
Type: CNAME
Name: www
Value: app.curvamestra.com.br
```

## 📱 PWA (Progressive Web App)

### Manifest.json
Configurado com:
- Nome da aplicação
- Ícones (192x192, 512x512)
- Tema e cores
- Modo standalone
- Orientação portrait

### Service Worker
Para implementar cache offline, adicione um service worker:

```javascript
// frontend/public/sw.js
const CACHE_NAME = 'curva-mestra-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});
```

## 🔍 SEO e Meta Tags

### Configurações Implementadas

- **Meta tags básicas**: title, description, keywords
- **Open Graph**: Facebook/LinkedIn sharing
- **Twitter Cards**: Twitter sharing
- **Favicon e ícones**: Múltiplos tamanhos
- **Robots.txt**: Configurado para SEO
- **Sitemap**: Preparado para implementação

### Robots.txt
```
User-agent: *
Disallow: /api/
Disallow: /admin/
Allow: /

Sitemap: https://curva-mestra.web.app/sitemap.xml
```

## 🛡️ Segurança

### Headers de Segurança
Implementados via `firebase.json` e `_headers`:

- **Content Security Policy**: Previne XSS
- **X-Frame-Options**: Previne clickjacking
- **X-Content-Type-Options**: Previne MIME sniffing
- **Referrer Policy**: Controla informações de referrer

### HTTPS
- Automático via Firebase Hosting
- Certificados SSL gerenciados automaticamente
- Redirecionamento HTTP → HTTPS

## 📊 Monitoramento

### Firebase Analytics
Adicione ao `index.html`:

```html
<!-- Firebase Analytics -->
<script>
  // Configuração do Analytics
</script>
```

### Performance Monitoring
```javascript
import { getPerformance } from 'firebase/performance';
const perf = getPerformance(app);
```

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Build Falha
```bash
# Limpar cache e reinstalar dependências
cd frontend
rm -rf node_modules dist
npm ci
npm run build:production
```

#### 2. Deploy Falha
```bash
# Verificar autenticação
firebase login --reauth

# Verificar projeto
firebase projects:list
firebase use staging
```

#### 3. Cache Issues
```bash
# Forçar limpeza de cache
firebase hosting:channel:deploy preview --expires 1h
```

### Logs e Debug

```bash
# Ver logs de hosting
firebase functions:log

# Debug mode
firebase deploy --debug --only hosting
```

## 📈 Otimizações

### Build Optimization
- **Code Splitting**: Chunks separados por funcionalidade
- **Tree Shaking**: Remoção de código não utilizado
- **Minification**: Compressão de JS/CSS
- **Asset Optimization**: Compressão de imagens

### Performance
- **Lazy Loading**: Componentes carregados sob demanda
- **Preconnect**: DNS prefetch para recursos externos
- **Resource Hints**: Preload de recursos críticos

### Bundle Analysis
```bash
cd frontend
npm run analyze
```

## 🌐 URLs de Produção

- **Staging**: https://curva-mestra.web.app
- **Produção**: https://curva-mestra.web.app (ou domínio customizado)

## 📝 Próximos Passos

1. **Configurar domínio customizado**
2. **Implementar Service Worker para PWA**
3. **Configurar Firebase Analytics**
4. **Implementar sitemap.xml**
5. **Configurar monitoramento de performance**
6. **Implementar testes de integração para hosting**

## 🔗 Links Úteis

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Web Performance Best Practices](https://web.dev/fast/)
- [SEO Best Practices](https://developers.google.com/search/docs/beginner/seo-starter-guide)