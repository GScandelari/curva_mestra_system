# Desenvolvimento Local

## Pré-requisitos

- Node.js 20+
- Firebase CLI
- Git

## Instalação do Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

## Configuração do Projeto

### 1. Clone o repositório

```bash
git clone git@github.com:GScandelari/curva_mestra_system.git
cd curva_mestra
```

### 2. Instale as dependências

```bash
# Dependências do Next.js
npm install

# Dependências das Cloud Functions
cd functions
npm install
cd ..
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com as credenciais do Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

## Executando o Projeto

### Com Emuladores Firebase (Recomendado)

```bash
# Terminal 1: Inicie os emuladores
firebase emulators:start

# Terminal 2: Inicie o Next.js
npm run dev
```

Acesse:
- **Aplicação**: http://localhost:3000
- **Emulator UI**: http://localhost:4000

### Sem Emuladores (Conecta ao Firebase real)

```bash
# Defina USE_FIREBASE_EMULATORS=false no .env.local
npm run dev
```

## Comandos Úteis

```bash
# Verificar tipos TypeScript
npm run type-check

# Build de produção
npm run build

# Lint
npm run lint

# Logs das Functions em produção
firebase functions:log
```

## Estrutura de Pastas

```
src/
├── app/                    # Rotas do Next.js 15
│   ├── (auth)/             # Login, registro, recuperação de senha
│   ├── (admin)/            # Portal do System Admin
│   ├── (clinic)/           # Portal da Clínica
│   └── (consultant)/       # Portal do Consultor
├── components/             # Componentes React
│   ├── ui/                 # Shadcn/ui components
│   ├── auth/               # Componentes de autenticação
│   ├── admin/              # Componentes do admin
│   ├── clinic/             # Componentes da clínica
│   └── consultant/         # Componentes do consultor
├── hooks/                  # React hooks customizados
├── lib/                    # Utilitários e serviços
│   ├── services/           # Serviços de dados
│   ├── firebase.ts         # Configuração Firebase
│   └── firebase-admin.ts   # Firebase Admin SDK
└── types/                  # TypeScript types
```
