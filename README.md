# Curva Mestra System

Sistema completo para gerenciamento de inventário, controle de estoque, gestão de pacientes e rastreabilidade de produtos em clínicas de harmonização facial.

## Estrutura do Projeto

```
curva-mestra-system/
├── backend/                 # API Node.js + Express
│   ├── src/
│   │   ├── config/         # Configurações (database, etc.)
│   │   ├── controllers/    # Controladores da API
│   │   ├── middleware/     # Middlewares customizados
│   │   ├── models/         # Modelos de dados (Sequelize)
│   │   ├── routes/         # Rotas da API
│   │   ├── services/       # Lógica de negócio
│   │   ├── utils/          # Utilitários
│   │   └── server.js       # Entrada principal
│   ├── tests/              # Testes do backend
│   └── package.json
├── frontend/               # Interface React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── services/       # Serviços de API
│   │   ├── hooks/          # Hooks customizados
│   │   ├── utils/          # Utilitários
│   │   └── main.jsx        # Entrada principal
│   └── package.json
└── .kiro/specs/            # Especificações do projeto
```

## Tecnologias Utilizadas

### Backend
- **Node.js** + **Express.js** - Framework web
- **PostgreSQL** - Base de dados
- **Sequelize** - ORM
- **JWT** - Autenticação
- **Jest** - Testes
- **ESLint** + **Prettier** - Qualidade de código

### Frontend
- **React** + **Vite** - Interface de usuário
- **React Router** - Roteamento
- **React Query** - Gerenciamento de estado servidor
- **Tailwind CSS** - Estilização
- **Vitest** - Testes
- **ESLint** + **Prettier** - Qualidade de código

## Pré-requisitos

- Node.js >= 16.0.0
- PostgreSQL >= 12
- npm >= 8.0.0

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm run install:all
   ```

3. Configure as variáveis de ambiente:
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   
   # Frontend  
   cp frontend/.env.example frontend/.env
   ```

4. Configure a base de dados PostgreSQL e atualize as credenciais no arquivo `.env`

## Desenvolvimento

### Executar em modo de desenvolvimento
```bash
npm run dev
```

Isso iniciará:
- Backend na porta 3001
- Frontend na porta 3000

### Executar apenas o backend
```bash
npm run dev:backend
```

### Executar apenas o frontend
```bash
npm run dev:frontend
```

## Testes

### Executar todos os testes
```bash
npm test
```

### Executar testes do backend
```bash
npm run test:backend
```

### Executar testes do frontend
```bash
npm run test:frontend
```

## Qualidade de Código

### Verificar linting
```bash
npm run lint
```

### Formatar código
```bash
npm run format
```

## Build para Produção

```bash
npm run build
```

## Funcionalidades Principais

- ✅ **Gestão de Produtos**: Cadastro, edição e controle de estoque
- ✅ **Controle de Validade**: Alertas automáticos para produtos próximos ao vencimento
- ✅ **Gestão de Notas Fiscais**: Rastreabilidade completa de entradas
- ✅ **Sistema de Solicitações**: Fluxo de aprovação para retirada de produtos
- ✅ **Gestão de Pacientes**: Cadastro e histórico de consumo
- ✅ **Relatórios**: Dashboards e relatórios detalhados
- ✅ **Autenticação**: Sistema de login com diferentes níveis de acesso
- ✅ **Auditoria**: Log completo de todas as operações

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença ISC.