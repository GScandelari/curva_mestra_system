# Curva Mestra System

Sistema de Gestão de Inventário para Clínicas de Harmonização Facial

## 🚀 Tecnologias

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Functions, Hosting)
- **Infraestrutura**: Firebase Hosting + Cloud Functions

## 📋 Pré-requisitos

- Node.js 16+
- npm 8+
- Firebase CLI
- Conta Firebase

## ⚙️ Configuração

### 1. Clone o repositório
```bash
git clone https://github.com/GScandelari/curva_mestra_system.git
cd curva_mestra_system
```

### 2. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações do Firebase:
```env
VITE_FIREBASE_API_KEY=sua_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 3. Instale as dependências
```bash
npm run install:all
```

### 4. Configure o Firebase
```bash
firebase login
firebase use --add
```

## 🏃‍♂️ Executando o projeto

### Desenvolvimento
```bash
# Frontend apenas
npm run dev:frontend

# Com emuladores Firebase
npm run dev:firebase
```

### Build e Deploy
```bash
# Build completo
npm run build

# Deploy para Firebase
npm run firebase:deploy
```

## 📁 Estrutura do Projeto

```
curva_mestra_system/
├── frontend/                 # Aplicação React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── services/       # Serviços Firebase
│   │   ├── hooks/          # Custom hooks
│   │   └── contexts/       # Context providers
│   └── dist/               # Build do frontend
├── functions/               # Firebase Functions
│   ├── src/                # Código TypeScript
│   └── lib/                # Código compilado (ignorado)
├── backend/                 # Scripts e utilitários
│   └── scripts/            # Scripts de migração
├── firestore.rules         # Regras de segurança Firestore
├── firestore.indexes.json  # Índices Firestore
└── firebase.json           # Configuração Firebase
```

## 🔐 Segurança

- Todas as chaves de API estão em variáveis de ambiente
- Regras de segurança Firestore configuradas
- Autenticação Firebase obrigatória
- Headers de segurança configurados no hosting

## 🌐 URLs do Projeto

- **Aplicação**: https://curva-mestra.web.app
- **Console Firebase**: https://console.firebase.google.com/project/curva-mestra

## 📚 Funcionalidades

- ✅ Gestão de produtos e estoque
- ✅ Controle de solicitações
- ✅ Cadastro de pacientes
- ✅ Sistema de notificações
- ✅ Relatórios e dashboards
- ✅ Controle de acesso por roles
- ✅ Monitoramento de custos
- ✅ Sistema de backup

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `package.json` para detalhes.

## 📞 Suporte

Para suporte, entre em contato através do GitHub Issues.