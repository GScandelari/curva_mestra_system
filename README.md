# 🏥 Curva Mestra System

<div align="center">
  <h3>Sistema de Gestão de Inventário para Clínicas de Harmonização</h3>
  <p>Solução completa para controle de estoque, produtos e tratamentos em clínicas de harmonização facial</p>
  
  ![Node.js](https://img.shields.io/badge/Node.js-18+-green)
  ![React](https://img.shields.io/badge/React-18+-blue)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)
  ![Docker](https://img.shields.io/badge/Docker-Ready-blue)
  ![License](https://img.shields.io/badge/License-Proprietary-red)
</div>

## 📋 Sobre o Projeto

O **Curva Mestra System** é uma solução empresarial desenvolvida especificamente para clínicas de harmonização facial, oferecendo controle total sobre inventário, pacientes, tratamentos e operações clínicas.

### 🎯 Principais Benefícios

- ✅ **Controle Total**: Gestão completa de produtos, lotes e validades
- ✅ **Automatização**: Alertas automáticos e movimentações de estoque
- ✅ **Rastreabilidade**: Auditoria completa de todas as operações
- ✅ **Relatórios**: Dashboards inteligentes e relatórios detalhados
- ✅ **Segurança**: Autenticação robusta e controle de acesso
- ✅ **Escalabilidade**: Arquitetura preparada para crescimento

## 🚀 Funcionalidades

### 📦 Gestão de Produtos
- Cadastro completo com códigos, categorias e fornecedores
- Controle de lotes individuais com datas de validade
- Alertas automáticos para produtos próximos ao vencimento
- Histórico completo de movimentações

### 👥 Gestão de Pacientes
- Cadastro detalhado de pacientes
- Histórico completo de tratamentos realizados
- Controle de produtos utilizados por paciente
- Relatórios de consumo personalizado

### 📊 Sistema de Alertas
- Notificações em tempo real para produtos vencendo
- Alertas de baixo estoque configuráveis
- Dashboard de alertas centralizado
- Notificações por email (configurável)

### 📈 Relatórios e Analytics
- Dashboard executivo com métricas principais
- Relatórios de estoque e movimentações
- Análise de consumo por produto/paciente
- Relatórios de vencimento e perdas

### 🔒 Segurança e Auditoria
- Sistema de autenticação JWT
- Controle de acesso baseado em roles
- Log completo de todas as operações
- Backup automático de dados de auditoria## 🛠️ 
Tecnologias

### Frontend
- **React 18** - Interface moderna e responsiva
- **Vite** - Build tool otimizado
- **TailwindCSS** - Estilização utilitária
- **React Router** - Navegação SPA
- **Axios** - Cliente HTTP

### Backend
- **Node.js 18+** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL 15+** - Banco de dados relacional
- **Sequelize** - ORM para PostgreSQL
- **JWT** - Autenticação stateless

### DevOps & Produção
- **Docker** - Containerização
- **Docker Compose** - Orquestração
- **Nginx** - Proxy reverso e servidor web
- **SSL/HTTPS** - Segurança em produção
- **Backup automático** - Proteção de dados

## 📦 Instalação e Desenvolvimento

### Pré-requisitos
- Node.js 18+
- PostgreSQL 15+
- npm ou yarn

### Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/GScandelari/curva_mestra_system.git
cd curva_mestra_system

# Instale todas as dependências
npm run install:all

# Configure as variáveis de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure o banco de dados
cd backend
npm run db:setup

# Inicie o ambiente de desenvolvimento
cd ..
npm run dev
```

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia frontend e backend
npm run dev:frontend     # Apenas frontend
npm run dev:backend      # Apenas backend

# Build e Produção
npm run build           # Build completo
npm run build:frontend  # Build do frontend
npm run start:production # Inicia em produção

# Testes
npm run test           # Executa todos os testes
npm run test:frontend  # Testes do frontend
npm run test:backend   # Testes do backend

# Qualidade de Código
npm run lint          # Linting
npm run format        # Formatação
```##
 🚀 Deploy em Produção

### Deploy com Docker (Recomendado)

```bash
# Configure variáveis de produção
cp .env.production.example .env

# Execute o deploy
./scripts/deploy.sh deploy    # Linux/macOS
.\scripts\deploy.ps1 deploy   # Windows
```

### Verificação de Saúde

```bash
# Verificar status dos serviços
./scripts/deploy.sh health

# Monitoramento completo
./scripts/monitor.sh all
```

## 📁 Estrutura do Projeto

```
curva_mestra_system/
├── 📁 frontend/              # Aplicação React
│   ├── 📁 src/
│   │   ├── 📁 components/    # Componentes React
│   │   ├── 📁 pages/         # Páginas da aplicação
│   │   ├── 📁 contexts/      # Contextos React
│   │   ├── 📁 services/      # Serviços de API
│   │   └── 📁 utils/         # Utilitários
│   └── 📄 package.json
├── 📁 backend/               # API Node.js
│   ├── 📁 src/
│   │   ├── 📁 controllers/   # Controladores
│   │   ├── 📁 models/        # Modelos Sequelize
│   │   ├── 📁 routes/        # Rotas da API
│   │   ├── 📁 services/      # Serviços de negócio
│   │   ├── 📁 middleware/    # Middlewares
│   │   └── 📁 utils/         # Utilitários
│   ├── 📁 scripts/           # Scripts de backup/deploy
│   └── 📄 package.json
├── 📁 nginx/                 # Configuração Nginx
├── 📁 scripts/               # Scripts de deploy
├── 📄 docker-compose.production.yml
├── 📄 DEPLOYMENT.md          # Guia de deploy
└── 📄 README.md
```

## 🔧 Configuração

### Variáveis de Ambiente

#### Backend (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario_clinica
DB_USER=postgres
DB_PASSWORD=sua_senha

# JWT
JWT_SECRET=sua_chave_secreta_jwt

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_app
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_APP_NAME=Curva Mestra System
```## 📊 Monito
ramento

O sistema inclui monitoramento completo:

- **Health Checks**: Verificação automática de saúde dos serviços
- **Logs Estruturados**: Sistema de logging com rotação automática
- **Métricas**: Monitoramento de recursos e performance
- **Alertas**: Notificações para problemas críticos

## 🔒 Segurança

- **Autenticação JWT** com refresh tokens
- **Validação de entrada** em todos os endpoints
- **Rate limiting** para prevenir ataques
- **Headers de segurança** configurados
- **HTTPS obrigatório** em produção
- **Auditoria completa** de operações

## 🧪 Testes

```bash
# Executar todos os testes
npm run test

# Testes com coverage
npm run test:coverage

# Testes E2E
npm run test:e2e
```

## 📚 Documentação

- [📖 Guia de Deploy](DEPLOYMENT.md) - Instruções completas de produção
- [🔧 API Documentation](backend/README.md) - Documentação da API
- [⚛️ Frontend Guide](frontend/README.md) - Guia do frontend

## 🤝 Contribuição

Este é um projeto proprietário. Para contribuições:

1. Entre em contato com a equipe de desenvolvimento
2. Siga os padrões de código estabelecidos
3. Inclua testes para novas funcionalidades
4. Documente mudanças significativas

## 📄 Licença

Este projeto está sob licença proprietária. Todos os direitos reservados.

## 📞 Suporte

Para suporte técnico ou dúvidas:

- 📧 Email: suporte@curvamestra.com
- 📱 WhatsApp: (11) 99999-9999
- 🌐 Website: https://curvamestra.com

---

<div align="center">
  <p>Desenvolvido com ❤️ para clínicas de harmonização facial</p>
  <p><strong>Curva Mestra System</strong> - Gestão Inteligente de Inventário</p>
</div>