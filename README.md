# Curva Mestra

Sistema SaaS Multi-Tenant para Clínicas de Harmonização Facial e Corporal

## 📋 Stack Tecnológica

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Shadcn/ui
- **Backend**: Firebase Functions 2nd gen (TypeScript + Python 3.11)
- **Banco**: Firestore in Native Mode (multi-tenant com RLS)
- **Auth**: Firebase Authentication + Custom Claims
- **Storage**: Firebase Storage
- **OCR + IA**: Python (pytesseract) + Vertex AI Gemini 1.5 Flash

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 22.x (instalado via nvm)
- Python 3.11+
- Firebase CLI

### Instalação

1. **Clone o repositório**
```bash
git clone git@github.com:GScandelari/curva_mestra_system.git
cd curva_mestra
```

2. **Instale as dependências do Next.js**
```bash
npm install
```

3. **Instale as dependências das Functions**
```bash
cd functions
npm install
cd ..
```

4. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite `.env.local` e adicione suas credenciais do Firebase (disponíveis em Firebase Console > Project Settings).

5. **Inicie os emuladores Firebase**
```bash
firebase emulators:start
```

6. **Em outro terminal, inicie o Next.js**
```bash
npm run dev
```

Acesse `http://localhost:3000`

## 📁 Estrutura do Projeto

```
curva_mestra/
├── src/
│   ├── app/              # Next.js 15 App Router
│   │   ├── (auth)/       # Rotas públicas
│   │   ├── (admin)/      # System admin
│   │   └── (clinic)/     # Clinic admin + user
│   ├── components/       # UI reutilizáveis (shadcn)
│   ├── lib/              # firebase.ts, utils
│   ├── hooks/            # React hooks customizados
│   └── types/            # TypeScript types
├── functions/
│   └── src/
│       ├── index.ts      # Cloud Functions TypeScript
│       └── ocr-rennova.py # Parser DANFE Rennova
├── firestore.rules       # Regras de segurança multi-tenant
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

## ✨ Funcionalidades Implementadas

### Sistema de Autenticação (100% ✅)
- ✅ Login com email/senha
- ✅ Registro de novos usuários
- ✅ Recuperação de senha
- ✅ Proteção de rotas baseada em roles
- ✅ Custom Claims (tenant_id, role, is_system_admin)
- ✅ Página de aguardo de aprovação

### Portal System Admin (98% ✅)
- ✅ Dashboard com métricas do sistema
- ✅ CRUD completo de clínicas
- ✅ Gestão de usuários por clínica
- ✅ **Catálogo de Produtos Master Rennova**
- ✅ Criação e edição de produtos do catálogo
- ✅ Ativação/Desativação de produtos e clínicas
- ✅ Sistema de planos (Basic, Professional, Enterprise)
- ✅ Perfil do administrador

### Portal Clinic Admin (90% ✅)
- ✅ Dashboard com métricas em tempo real
- ✅ Sistema completo de inventário
- ✅ Upload de DANFE (Nota Fiscal Eletrônica)
- ✅ Alertas de vencimento de produtos
- ✅ Filtros inteligentes (vencendo, estoque baixo, esgotado)
- ✅ Busca em tempo real por código, nome, lote
- ✅ Exportação de dados em CSV
- ✅ Perfil do usuário da clínica

### Gestão de Produtos
- ✅ Catálogo Master centralizado (sem multi-tenant)
- ✅ Validação de código único
- ✅ Soft delete (ativação/desativação)
- ✅ Busca e filtros em tempo real
- ✅ Inventário por clínica com rastreamento completo

### Gestão de Usuários
- ✅ Criação de usuários por clínica
- ✅ Limite de usuários baseado no plano
- ✅ Roles (clinic_admin, clinic_user, system_admin)
- ✅ Integração com Firebase Auth

**📋 Veja [FEATURES.md](./FEATURES.md) para documentação completa (atualizada em 11/11/2025)**
**📝 Veja [CHANGELOG.md](./CHANGELOG.md) para histórico de versões**

## 🔐 Multi-Tenant (CRÍTICO)

**TODAS** as operações Firestore e Storage devem incluir `tenant_id`.

### Custom Claims
```typescript
{
  tenant_id: "clinic_abc123",
  role: "clinic_admin" | "clinic_user" | "system_admin",
  is_system_admin: boolean,
  active: boolean
}
```

### Regras Firestore
```javascript
match /tenants/{tenantId}/{document=**} {
  allow read, write: if request.auth.token.tenant_id == tenantId
    && request.auth.token.active == true;
}
```

## 🧪 Testes

### Testar Parser DANFE Rennova
```bash
python functions/src/ocr-rennova.py --text "..."
```

### Testar com NF-e 026229 (referência oficial)
```bash
python functions/src/ocr-rennova.py --file "samples/026229.pdf"
```

## 🚀 Deploy

### Deploy completo
```bash
firebase deploy
```

### Deploy apenas Functions
```bash
firebase deploy --only functions
```

### Deploy apenas Hosting
```bash
npm run build
firebase deploy --only hosting
```

## 📝 Regras Importantes

⚠️ **NUNCA** quebre o multi-tenant
⚠️ **NUNCA** altere as RegEx do parser Rennova sem testar com NF-e 026229
⚠️ **NUNCA** faça deploy sem testar localmente nos emuladores

## 🔧 Comandos Úteis

```bash
# Desenvolvimento local com emuladores
firebase emulators:start

# Build do Next.js
npm run build

# Verificar tipos TypeScript
npm run type-check

# Logs das Functions em produção
firebase functions:log
```

## 📚 Documentação

- [FEATURES.md](./FEATURES.md) - **Funcionalidades implementadas** (✅ atualizado em 11/11/2025)
- [CHANGELOG.md](./CHANGELOG.md) - **Histórico de versões** (✅ v0.3.0 - 11/11/2025)
- [INITIAL.md](./INITIAL.md) - Configuração inicial do projeto
- [CLAUDE.md](./CLAUDE.md) - Regras completas do projeto
- [Firebase Console](https://console.firebase.google.com/project/curva-mestra)
- [Next.js 15 Docs](https://nextjs.org/docs)

## 📊 Status do Projeto

**Versão Atual**: 0.3.0
**Progresso Geral**: 80% Completo
**Páginas**: 20
**Serviços**: 7
**Linhas de código**: ~8.000+

**Sistema de Autenticação**: ✅ 100%
**Portal System Admin**: ✅ 98%
**Portal Clinic Admin**: ✅ 90%
**Sistema de Inventário**: ✅ 100%
**Sistema de Upload**: ✅ 85% (falta OCR real)
**Sistema de Solicitações**: ⏳ 0%

## 🤝 Contribuição

Este projeto segue Conventional Commits:
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `chore:` tarefas de manutenção

## 📄 Licença

Projeto privado - Curva Mestra © 2025
