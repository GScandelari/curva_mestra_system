# Configuração de Produção - Curva Mestra

## Alterações Realizadas

### 1. Arquivos de Ambiente Criados/Atualizados

#### `.env` (NOVO - Produção padrão)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=curva-mestra
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=curva-mestra.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=521885400577
NEXT_PUBLIC_FIREBASE_APP_ID=1:521885400577:web:e4eed211455f2976618a00
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

#### `.env.local` (ATUALIZADO - Produção)
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false  # Era: true
```

#### `.env.development` (NOVO - Desenvolvimento com emuladores)
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
# Mesmas credenciais Firebase
```

#### `.env.production` (JÁ EXISTIA)
```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
# Mesmas credenciais Firebase
```

### 2. Código Atualizado

#### `src/lib/firebase-admin.ts`
**Mudança:** Adicionada verificação de `NODE_ENV` para evitar uso de emuladores em builds de produção

**Antes:**
```typescript
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
```

**Depois:**
```typescript
const isDevelopment = process.env.NODE_ENV === "development";
const useEmulators = isDevelopment && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
```

### 3. Documentação Criada

- **`SETUP-AMBIENTES.md`**: Guia completo sobre como alternar entre ambientes
- **`CONFIGURACAO-PRODUCAO.md`**: Este arquivo, resumo das alterações

## Configuração Atual

### Projeto Firebase
- **ID:** `curva-mestra`
- **Região:** `southamerica-east1`
- **URL de Produção:** https://curva-mestra.web.app

### Secrets Configurados
- `SMTP_USER`: scandelari.guilherme@curvamestra.com.br (configurado)
- `SMTP_PASS`: (configurado via Firebase CLI)

### Firebase Functions
- Todas as functions estão desabilitadas no `functions/src/index.ts`
- Apenas `placeholder` function está ativa para evitar erro de "no functions"

## Como Usar

### Desenvolvimento Local (com emuladores)
```bash
# 1. Configurar ambiente
cp .env.development .env.local

# 2. Iniciar emuladores
firebase emulators:start

# 3. Em outro terminal, iniciar Next.js
npm run dev
```

### Produção Local (teste)
```bash
# 1. Configurar ambiente
cp .env.production .env.local
# OU simplesmente edite .env.local e mude para false:
# NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false

# 2. Build
npm run build

# 3. Testar localmente
npm start
```

### Deploy para Produção
```bash
# 1. Garantir que está configurado para produção
# Verificar que .env.local tem NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false

# 2. Build
npm run build

# 3. Deploy
firebase deploy
```

## Verificação

Para verificar qual ambiente está ativo:

1. **Local:** Acesse http://localhost:3000/debug
2. **Produção:** Acesse https://curva-mestra.web.app/debug

A página mostrará:
- Se está usando emuladores
- Configuração do Firebase
- Status da conexão

## Problemas Resolvidos

### ✅ Build estava usando emuladores
**Solução:** Adicionada verificação de `NODE_ENV` em `firebase-admin.ts`

### ✅ .env.local apontando para emuladores
**Solução:** Atualizado para `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`

### ✅ Falta de arquivo .env padrão
**Solução:** Criado `.env` com configuração de produção

### ✅ Confusão entre ambientes
**Solução:** Criados arquivos separados (.env.development vs .env.production)

## Próximos Passos

1. Testar o aplicativo em produção: https://curva-mestra.web.app
2. Verificar se login funciona corretamente
3. Verificar se dashboard carrega
4. Habilitar Firebase Functions quando necessário (editar `functions/src/index.ts`)

## Observações Importantes

- Todos os arquivos `.env*` (exceto `.env.example`) estão no `.gitignore`
- As credenciais do Firebase Web App são públicas (usadas no frontend)
- Secrets SMTP devem estar APENAS como Firebase Secrets (nunca em .env)
- O arquivo `.env.local` sempre sobrescreve os demais em desenvolvimento

## Estrutura de Prioridade (Next.js)

O Next.js carrega os arquivos nesta ordem:

1. `.env` (menor prioridade)
2. `.env.production` ou `.env.development` (dependendo do NODE_ENV)
3. `.env.local` (maior prioridade - sempre vence)

Para alternar entre ambientes, basta editar `.env.local` ou copiá-lo de outro arquivo.
