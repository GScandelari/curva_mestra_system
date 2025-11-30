# Configuração de Ambientes - Curva Mestra

## Arquivos de Ambiente

O projeto utiliza diferentes arquivos `.env` para cada ambiente:

### 📁 Estrutura de Arquivos

```
.env                    # Produção (padrão) - COMMITADO no .gitignore
.env.local             # Override local - COMMITADO no .gitignore
.env.development       # Desenvolvimento com emuladores - COMMITADO no .gitignore
.env.production        # Produção explícita - COMMITADO no .gitignore
.env.example           # Template para referência - COMMITADO
```

## 🚀 Ambientes

### 1. Produção (Firebase Cloud)

**Arquivos usados:** `.env` ou `.env.production` ou `.env.local` (com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Produção
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

**Como usar:**
```bash
# Build para produção
npm run build

# Deploy para Firebase Hosting
firebase deploy
```

### 2. Desenvolvimento Local (Emuladores)

**Arquivo usado:** `.env.development`

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Desenvolvimento com emuladores
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

**Como usar:**
```bash
# 1. Iniciar emuladores Firebase
firebase emulators:start

# 2. Em outro terminal, iniciar Next.js
npm run dev
```

## 🔄 Alternando entre Ambientes

### Método 1: Usando .env.local (Recomendado)

Simplesmente edite `.env.local` e mude a variável:

**Para Produção:**
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

**Para Desenvolvimento:**
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

### Método 2: Usando arquivos separados

Copie o arquivo correspondente:

```bash
# Para produção
cp .env.production .env.local

# Para desenvolvimento
cp .env.development .env.local
```

## 📋 Ordem de Precedência do Next.js

O Next.js carrega os arquivos nesta ordem (o último sobrescreve o anterior):

1. `.env` (padrão)
2. `.env.production` ou `.env.development` (dependendo do NODE_ENV)
3. `.env.local` (sempre, exceto em test)

## ⚙️ Configuração Atual

Atualmente o projeto está configurado para:

- **`.env`** → Produção (padrão)
- **`.env.local`** → Produção (override local)
- **`.env.development`** → Desenvolvimento com emuladores
- **`.env.production`** → Produção explícita

## 🔒 Secrets (Firebase Functions)

As credenciais SMTP estão armazenadas como secrets no Firebase:

```bash
# Verificar secrets
firebase functions:secrets:access SMTP_USER
firebase functions:secrets:access SMTP_PASS

# Definir secrets
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

**Valores atuais:**
- `SMTP_USER`: scandelari.guilherme@curvamestra.com.br
- `SMTP_PASS`: (configurado via Firebase CLI)

## 🧪 Testando a Configuração

Para verificar qual ambiente está ativo:

1. Acesse: http://localhost:3000/debug (desenvolvimento)
2. Ou acesse: https://curva-mestra.web.app/debug (produção)

A página mostrará:
- Se está usando emuladores
- Configuração do Firebase
- Status da conexão

## 📝 Checklist de Deploy

Antes de fazer deploy para produção:

- [ ] Verificar que `.env.local` tem `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`
- [ ] Rodar `npm run build` localmente para testar
- [ ] Verificar que secrets SMTP estão configurados no Firebase
- [ ] Fazer deploy: `firebase deploy`
- [ ] Testar na URL de produção: https://curva-mestra.web.app

## ⚠️ IMPORTANTE

- **NUNCA** commite arquivos `.env` com credenciais reais
- Todos os arquivos `.env*` (exceto `.env.example`) estão no `.gitignore`
- As credenciais do Firebase Web App são públicas (usadas no frontend)
- As credenciais SMTP devem estar APENAS como secrets no Firebase
