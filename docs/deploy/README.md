# Deploy

## Deploy Automático (GitHub Actions)

O projeto está configurado para fazer deploy automático ao fazer push na branch `master`.

O workflow (`.github/workflows/deploy-security-patches.yml`) executa:
1. Build do Next.js
2. Deploy do Firebase Hosting
3. Deploy das Cloud Functions

## Deploy Manual

### Pré-requisitos

- Firebase CLI instalado e autenticado
- Permissões de deploy no projeto Firebase

### Deploy Completo

```bash
# Build + Deploy de tudo
npm run build
firebase deploy
```

### Deploy Parcial

```bash
# Apenas Hosting (Next.js)
npm run build
firebase deploy --only hosting

# Apenas Cloud Functions
firebase deploy --only functions

# Apenas regras do Firestore
firebase deploy --only firestore:rules

# Apenas regras do Storage
firebase deploy --only storage
```

### Deploy com Debug

Para troubleshooting, use a flag `--debug`:

```bash
firebase deploy --only hosting --debug
```

## Variáveis de Ambiente

### GitHub Actions Secrets

Configure os seguintes secrets no repositório:

| Secret | Descrição |
|--------|-----------|
| `FIREBASE_TOKEN` | Token de autenticação do Firebase CLI |
| `FIREBASE_ADMIN_CREDENTIALS` | Credenciais do Service Account (JSON) |

### Gerar FIREBASE_TOKEN

```bash
firebase login:ci
```

## URLs de Produção

- **Aplicação**: https://curvamestra.com.br
- **Firebase Console**: https://console.firebase.google.com/project/curva-mestra

## Troubleshooting

### Erro "Internal error has occurred"

Este erro pode ocorrer por instabilidade temporária do Firebase. Soluções:
1. Aguarde alguns minutos e tente novamente
2. Faça deploy manual via PowerShell/Terminal
3. Verifique o status do Google Cloud: https://status.cloud.google.com/

### Erro de permissão no Firestore

Após alterar `firestore.rules`, faça deploy das regras:

```bash
firebase deploy --only firestore:rules
```
