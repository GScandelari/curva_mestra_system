# Changelog - Curva Mestra

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não Lançado]

### Planejado
- Sistema de solicitações de produtos
- OCR real com pytesseract + Vertex AI Gemini (integração backend)
- Relatórios personalizados e analytics avançado
- Sistema de notificações push
- PWA para mobile com Capacitor
- API REST para integrações externas
- Projeção de estoque baseada em histórico

---

## [0.3.0] - 2025-11-11

### Adicionado

**Portal de Produtos Master:**
- ✅ Página de listagem de produtos do catálogo Rennova (`/admin/products`)
- ✅ Criação de novos produtos master (`/admin/products/new`)
- ✅ Edição de produtos existentes (`/admin/products/[id]`)
- ✅ Busca e filtros em tempo real (código, nome)
- ✅ Ativação/Desativação de produtos (soft delete)
- ✅ Exibição de produtos ativos e inativos
- ✅ Serviço completo `masterProductService.ts` com CRUD
- ✅ Validação de código único
- ✅ Conversão automática de nomes para UPPERCASE
- ✅ Collection global `master_products` (sem tenant_id)

**Portal Clinic Admin - Expansões:**
- ✅ Sistema completo de upload de DANFE (`/clinic/upload`)
- ✅ Drag & Drop de arquivos PDF
- ✅ Progress bar de upload
- ✅ Estados visuais (idle, uploading, processing, success, error)
- ✅ Validação de arquivo (tipo PDF, tamanho máximo 10MB)
- ✅ Auto-extração do número da NF do filename
- ✅ Integração com Firebase Storage (organizado por tenant)
- ✅ Processamento simulado de NF (preparado para OCR real)
- ✅ Importação automática de produtos para inventário
- ✅ Componente FileUpload reutilizável
- ✅ Serviço `nfImportService.ts` completo
- ✅ Dashboard da clínica com métricas em tempo real
- ✅ Sistema de inventário completo (`/clinic/inventory`)
- ✅ Página de detalhes do produto (`/clinic/inventory/[id]`)
- ✅ Exportação CSV do inventário
- ✅ Alertas de vencimento com badges coloridos
- ✅ Filtros inteligentes (vencendo, estoque baixo, esgotado)
- ✅ Busca em tempo real (nome, código, lote)

**Sistema de Autenticação Expandido:**
- ✅ Página de registro de usuários (`/auth/register`)
- ✅ Página de recuperação de senha (`/auth/forgot-password`)
- ✅ Página de aguardo de aprovação (`/auth/waiting-approval`)
- ✅ Validação de senha (mínimo 6 caracteres)
- ✅ Confirmação de senha
- ✅ Feedback visual de erros específicos

**Páginas de Perfil:**
- ✅ Perfil do System Admin (`/admin/profile`)
- ✅ Perfil do Clinic User (`/clinic/profile`)
- ✅ Visualização de informações do usuário
- ✅ Edição de dados (nome, email, etc)

**Componentes UI Adicionais:**
- ✅ FileUpload (drag & drop com preview)
- ✅ Progress (barra de progresso animada)
- ✅ Skeleton (loading states)
- ✅ Alert (com variantes: default, destructive, warning, success)
- ✅ ClinicLayout (layout compartilhado do portal clinic)

**Serviços Implementados:**
- ✅ `masterProductService.ts` - CRUD completo de produtos master
- ✅ `inventoryService.ts` - Gestão do estoque por tenant
- ✅ `nfImportService.ts` - Upload e processamento de DANFE
- ✅ `productService.ts` - Gestão de produtos (complementar ao master)
- ✅ `tenantService.ts` - Serviço adicional de tenants

**Estrutura Firestore:**
- ✅ Collection `master_products` (global, sem multi-tenant)
- ✅ Collection `tenants/{id}/inventory` com todos os campos
- ✅ Collection `tenants/{id}/nf_imports` com rastreamento completo
- ✅ Collection `tenants/{id}/inventory_activity` para auditoria
- ✅ Timestamps automáticos (created_at, updated_at)

**Utilitários:**
- ✅ Conversão de Timestamp para Date em todos os serviços
- ✅ Formatação de datas em pt-BR
- ✅ Cálculo de dias até vencimento
- ✅ Cálculo de porcentagem de consumo
- ✅ Validação de tipos de arquivo
- ✅ Formatação de tamanho de arquivo (KB/MB)

### Modificado
- Atualizado `FEATURES.md` com documentação completa das novas funcionalidades
- Atualizado limite de caracteres em nomes de produto
- Melhorado feedback visual em todas as páginas
- Aprimorado sistema de loading states
- Expandido sistema de badges com mais variantes
- Melhorado tratamento de erros em todos os serviços

### Corrigido
- Erro de conversão de Timestamp do Firestore em múltiplos serviços
- Problema de validação de arquivo no upload
- Erro de formatação de CNPJ em alguns casos
- Problema de navegação após upload bem-sucedido
- Erro de hidratação em componentes de data

### Dependências
- Mantidas todas as dependências estáveis
- Firebase 11.1.0
- Next.js 15.5.6
- React 19.0.0

### Segurança
- Validação de tipo de arquivo no cliente e servidor
- Limite de tamanho de arquivo (10MB)
- Uploads apenas para usuários autenticados
- Multi-tenant isolation em Firebase Storage
- Sanitização de nomes de arquivo

### Performance
- Lazy loading de componentes pesados
- Otimização de queries Firestore
- Cache client-side para dados estáticos
- Skeleton loading em todas as páginas
- Queries paralelas com Promise.all

---

## [0.2.0] - 2025-11-09

### Adicionado
- Sistema completo de gestão de usuários por clínica
- Modal de criação de usuários com validações
- Limite de usuários baseado no plano
- Integração com Firebase Auth para criação de usuários
- Serviço `clinicUserService.ts` para gerenciar usuários
- Configuração de planos em `src/lib/constants/plans.ts`
- Componente Dialog do shadcn/ui
- Formatador de endereços que aceita string ou objeto
- Exibição de preços dos planos ao lado do nome do plano
- Badge "Admin" para usuários administradores
- Ícones diferenciados (Shield/User) para roles
- Contador de usuários (X de Y usuários)
- Validação de limite de usuários ao criar novo usuário
- Tratamento de erros específicos do Firebase Auth
- Documentação completa em `FEATURES.md`
- Este arquivo `CHANGELOG.md`

### Modificado
- Página de detalhes da clínica (`/admin/tenants/[id]`) com seção de usuários
- README.md com seção de funcionalidades implementadas
- Utilitários em `utils.ts` com nova função `formatAddress()`
- Adicionado suppressHydrationWarning no layout para evitar erros de hidratação

### Corrigido
- Erro de renderização de objeto no campo address
- Erro de hidratação causado por extensões do navegador
- Erro de HTML inválido (Badge dentro de <p>)
- Erro 404 em arquivos estáticos após mudanças
- Falta de dependência `@radix-ui/react-icons`

### Dependências
- Adicionado: `@radix-ui/react-icons@^1.3.2`

---

## [0.1.0] - 2025-11-08

### Adicionado
- Sistema de autenticação multi-tenant completo
- Portal System Admin com dashboard
- CRUD completo de clínicas (tenants)
  - Listagem com filtros
  - Criação de novas clínicas
  - Edição de informações
  - Ativação/Desativação
- Proteção de rotas baseada em Custom Claims
- Componente `ProtectedRoute`
- Serviço `tenantServiceDirect.ts` para operações diretas no Firestore
- Formatadores de CNPJ e telefone
- Validação de CNPJ único
- Interface de tipos TypeScript completa
- Componentes UI do shadcn/ui:
  - Button, Input, Label
  - Card (completo)
  - Badge
  - Table (completa)
- Ícones do Lucide React
- Sistema de planos (Basic, Professional, Enterprise)
- Configuração do Firebase com emuladores
- Regras de segurança Firestore multi-tenant

### Técnico
- Next.js 15.5.6 com App Router
- React 19.0.0
- TypeScript 5.7.2
- Firebase 11.1.0
- Tailwind CSS 3.4.17
- shadcn/ui components
- Firestore em modo nativo
- Firebase Authentication com Custom Claims

---

## [0.0.1] - 2025-11-07

### Adicionado
- Configuração inicial do projeto
- Estrutura de pastas do Next.js 15
- Configuração do Firebase
- Configuração do TypeScript
- Configuração do Tailwind CSS
- Estrutura de rotas (auth, admin, clinic)
- Tipos TypeScript básicos
- Arquivo de regras `CLAUDE.md`
- Configuração do git
- README.md inicial
- INITIAL.md com documentação da configuração

### Configuração
- Node.js 22.x via nvm
- Firebase CLI
- Firebase Emulator Suite
- Variáveis de ambiente (.env.local)
- ESLint e Prettier
- Git hooks

---

## Tipos de Mudanças

- `Adicionado` para novas funcionalidades
- `Modificado` para mudanças em funcionalidades existentes
- `Obsoleto` para funcionalidades que serão removidas em breve
- `Removido` para funcionalidades removidas
- `Corrigido` para correções de bugs
- `Segurança` para vulnerabilidades corrigidas
- `Dependências` para mudanças em dependências
- `Técnico` para mudanças técnicas que não afetam funcionalidades

---

**Formato de Versão:** MAJOR.MINOR.PATCH
- **MAJOR**: Mudanças incompatíveis na API
- **MINOR**: Novas funcionalidades compatíveis com versões anteriores
- **PATCH**: Correções de bugs compatíveis com versões anteriores
