# 🚀 Iniciar Aplicação Localmente

## ⚡ Método Rápido (RECOMENDADO)

### ⚙️ Pré-requisito: Node.js 20

O projeto usa Node.js 20 para evitar warnings. Se você usa NVM:

```bash
nvm use 20
# ou se não tiver instalado:
nvm install 20 && nvm use 20
```

**Nota**: Os scripts já fazem isso automaticamente! Um arquivo `.nvmrc` foi criado no projeto.

### Opção 1: Dois Terminais (Mais Estável)

**Terminal 1 - Emuladores:**
```bash
nvm use 20  # ou deixe o script fazer automaticamente
firebase emulators:start
```
Aguarde até ver: `✔  All emulators ready!`

**Terminal 2 - Setup + Aplicação:**
```bash
# 1. Criar usuários e importar produtos
bash dev-tools/setup-local.sh

# 2. Iniciar aplicação
npm run dev
```

### Opção 2: Script Automático (Experimental)

```bash
bash dev-tools/start-local.sh
```

**Nota**: Pode ter timeout em máquinas lentas. Prefira a Opção 1.

---

## Versão Detalhada (passo a passo)

Se preferir executar manualmente ou debugar, siga esta sequência:

### 1️⃣ Instalar Dependências
```bash
npm install
```

### 2️⃣ Iniciar Emuladores Firebase
```bash
firebase emulators:start
```
**Aguarde até ver**: `✔  All emulators ready!`

Acesse o painel: http://127.0.0.1:4000

### 3️⃣ Em outro terminal: Setup Completo
```bash
# Criar System Admin + Clínicas
node dev-tools/setup-complete-environment.js
```

### 4️⃣ Importar Produtos Rennova
```bash
# Importar 19 produtos do catálogo master
node scripts/import-master-products.js
```

### 5️⃣ Iniciar Aplicação
```bash
npm run dev
```

Acesse: http://localhost:3000

---

## 📋 Credenciais Criadas

### 🔐 System Admin (Portal Admin - todas clínicas)
- **Email**: `scandelari.guilherme@curvamestra.com.br`
- **Senha**: `admin123`
- **URL**: http://localhost:3000/admin

---

### 🏥 Clínica 1: Bella Vita (Plano Anual)
**CNPJ**: 34.028.316/0001-03

**Admin**
- **Email**: `admin@bellavita.com`
- **Senha**: `bella123`

**Usuário Comum**
- **Email**: `maria@bellavita.com`
- **Senha**: `bella123`

---

### 🏥 Clínica 2: Espaço Renova (Plano Semestral)
**CNPJ**: 07.526.557/0001-00

**Admin**
- **Email**: `admin@espacorenova.com`
- **Senha**: `renova123`

**Usuário Comum**
- **Email**: `carlos@espacorenova.com`
- **Senha**: `renova123`

---

## 📦 Catálogo de Produtos Importados

19 produtos Rennova disponíveis no sistema:
- NABOTA 200U
- TORNEIRA DESCARTAVEL 3 VIAS
- RENNOVA DIAMOND INTENSE
- RENNOVA ELLEVA (3 variações)
- RENNOVA FILL (3 variações)
- RENNOVA CANNULA (3 tamanhos)
- CROQUIS (3 tipos)
- E mais...

**Consulte**: http://127.0.0.1:4000/firestore → `master_products`

---

## 🛠️ Ferramentas de Desenvolvimento

### Emulator UI (Firebase)
http://127.0.0.1:4000

### Firestore (visualizar dados)
http://127.0.0.1:4000/firestore

### Authentication (usuários)
http://127.0.0.1:4000/auth

### Functions Logs
http://127.0.0.1:4000/logs

---

## 🔧 Comandos Úteis

### Resetar Ambiente
```bash
# Parar emuladores
pkill -f firebase

# Limpar dados do emulador
rm -rf .firebase/emulator-data

# Reiniciar do zero
firebase emulators:start
```

### Verificar TypeScript
```bash
npm run type-check
```

### Build de Produção
```bash
npm run build
```

### Ver Logs em Tempo Real
```bash
# Terminal 1: Emuladores
firebase emulators:start

# Terminal 2: Logs do Next.js
npm run dev
```

---

## ⚠️ Troubleshooting

### Erro: "Port already in use"
```bash
# Matar processos nas portas
lsof -ti:3000,4000,8080,9099 | xargs kill -9
```

### Erro: "Firebase Admin not initialized"
```bash
# Reiniciar emuladores
pkill -f firebase
firebase emulators:start
```

### Erro: "User not found"
```bash
# Re-executar setup
node dev-tools/setup-complete-environment.js
```

---

## 📚 Stack Tecnológico

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **UI**: Tailwind CSS + Shadcn/ui
- **Backend**: Firebase Functions 2nd gen
- **Database**: Firestore (multi-tenant)
- **Auth**: Firebase Authentication + Custom Claims
- **Storage**: Firebase Storage

---

## 🎯 Próximos Passos

Após subir a aplicação:

1. Acesse o Portal Admin: http://localhost:3000/admin
2. Login com: `scandelari.guilherme@curvamestra.com.br` / `admin123`
3. Explore as clínicas criadas
4. Cadastre lotes manualmente em cada clínica
5. Gerencie produtos do catálogo master

---

**Desenvolvido com Claude AI** 🤖
Projeto iniciado em: 07/11/2025
