# Curva Mestra

Sistema SaaS Multi-Tenant para Clínicas de Harmonização Facial e Corporal.

Gestão inteligente de estoque Rennova com controle de lotes, validades, licenças e consumo por paciente.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind CSS + Shadcn/ui |
| **Backend** | Firebase Functions 2nd gen (TypeScript) |
| **Banco de Dados** | Firestore (multi-tenant com RLS) |
| **Autenticação** | Firebase Auth + Custom Claims |
| **Storage** | Firebase Storage |
| **Deploy** | Firebase Hosting + GitHub Actions |

## Funcionalidades

### Portal System Admin
- Dashboard com métricas do sistema
- Gestão completa de clínicas (CRUD)
- Gestão de usuários por clínica
- Catálogo de produtos master Rennova
- Sistema de licenças e planos
- Gestão de consultores

### Portal Clinic Admin
- Dashboard com métricas em tempo real
- Gestão de inventário com alertas de vencimento
- Sistema de procedimentos (agendamento, execução, histórico)
- Gestão de pacientes
- Relatórios (valor de estoque, vencimentos, consumo)
- Onboarding guiado para novas clínicas
- Vinculação com consultores

### Portal do Consultor
- Dashboard com clínicas vinculadas
- Visualização read-only de dados das clínicas
- Acesso a inventário, procedimentos e relatórios
- Sistema de solicitação de vínculo com clínicas

### Segurança Multi-Tenant
- Isolamento completo de dados por clínica
- Custom Claims para controle de acesso
- Regras Firestore com RLS (Row Level Security)
- Três níveis de acesso: system_admin, clinic_admin, clinic_user, clinic_consultant

## Início Rápido

### Pré-requisitos

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)

### Instalação

```bash
# Clone o repositório
git clone git@github.com:GScandelari/curva_mestra_system.git
cd curva_mestra

# Instale as dependências
npm install

# Instale as dependências das Functions
cd functions && npm install && cd ..

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Firebase
```

### Desenvolvimento Local

```bash
# Inicie os emuladores Firebase
firebase emulators:start

# Em outro terminal, inicie o Next.js
npm run dev
```

Acesse http://localhost:3000

## Estrutura do Projeto

```
curva_mestra/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (auth)/             # Rotas públicas (login, registro)
│   │   ├── (admin)/            # Portal System Admin
│   │   ├── (clinic)/           # Portal Clinic Admin
│   │   └── (consultant)/       # Portal do Consultor
│   ├── components/             # Componentes UI (shadcn)
│   ├── lib/                    # Utilitários e serviços
│   ├── hooks/                  # React hooks customizados
│   └── types/                  # TypeScript types
├── functions/                  # Firebase Cloud Functions
├── docs/                       # Documentação
├── scripts/                    # Scripts de manutenção
└── dev-tools/                  # Ferramentas de desenvolvimento
```

## Deploy

O deploy é automatizado via GitHub Actions ao fazer push na branch `master`.

Para deploy manual:

```bash
# Build do Next.js
npm run build

# Deploy completo
firebase deploy

# Deploy apenas hosting
firebase deploy --only hosting

# Deploy apenas functions
firebase deploy --only functions

# Deploy apenas regras do Firestore
firebase deploy --only firestore:rules
```

## Documentação

- [docs/features/](./docs/features/) - Funcionalidades e roadmap
- [docs/legal/](./docs/legal/) - Documentos legais (termos de uso)
- [CLAUDE.md](./CLAUDE.md) - Instruções para desenvolvimento com IA
- [CHANGELOG.md](./CHANGELOG.md) - Histórico de versões

## Roles e Permissões

| Role | Descrição |
|------|-----------|
| `system_admin` | Administrador do sistema, acesso total |
| `clinic_admin` | Administrador da clínica, gestão completa |
| `clinic_user` | Usuário da clínica, acesso limitado |
| `clinic_consultant` | Consultor, acesso read-only a múltiplas clínicas |

## Contribuição

Este projeto segue Conventional Commits:
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `chore:` tarefas de manutenção
- `docs:` documentação

## Licença

Projeto privado - Curva Mestra © 2025-2026
