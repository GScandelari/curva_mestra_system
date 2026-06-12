# Changelog - Curva Mestra

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.5.1](https://github.com/GScandelari/curva_mestra_system/compare/v1.5.0...v1.5.1) (2026-06-12)


### Bug Fixes

* **admin:** filter clinic_consultant in memory to avoid missing Firestore index ([6aeb04c](https://github.com/GScandelari/curva_mestra_system/commit/6aeb04c5172970ddce695ef09db2c678f00cb53e))

## [1.5.0](https://github.com/GScandelari/curva_mestra_system/compare/v1.4.0...v1.5.0) (2026-06-12)


### Features

* **auth:** unify access request form — remove password, align /register with landing ([6402647](https://github.com/GScandelari/curva_mestra_system/commit/6402647c3210f097f6261fb1853c8698fe846583))


### Bug Fixes

* **admin:** exclude clinic_consultant from users list in admin/users page ([d65e2f3](https://github.com/GScandelari/curva_mestra_system/commit/d65e2f3bf327b7825279e51b820bd84bd9465cae))
* **api:** resolve 500 on GET /consultants — explicit runtime and query ordering ([fb7f4af](https://github.com/GScandelari/curva_mestra_system/commit/fb7f4afe47bc0c7d592a80255a25f1ca767f747d))
* **auth:** replace Math.random with crypto.randomBytes in generateTempPassword ([d5426ec](https://github.com/GScandelari/curva_mestra_system/commit/d5426eca12cb4ebc7d3defab51bdecc47b704c49))
* **auth:** resolve SonarCloud S3923 — ternary branches returned same value ([950729e](https://github.com/GScandelari/curva_mestra_system/commit/950729e46ff0046a48cf0103d9f8707fe6ca13dd))
* **firebase:** add composite indexes for consultants and users collections ([69674d0](https://github.com/GScandelari/curva_mestra_system/commit/69674d02c109db90ad96fb30804b8348aca76d92))

## [1.4.0](https://github.com/GScandelari/curva_mestra_system/compare/v1.3.0...v1.4.0) (2026-05-29)


### Features

* **ui:** serve landing page at root via route handler — URL permanece '/' ([8bee4b6](https://github.com/GScandelari/curva_mestra_system/commit/8bee4b6207b328a0230c680d8d594e27e4705b89))
* **ui:** serve new landing page at root via next.config rewrite + fallback redirect ([b170fec](https://github.com/GScandelari/curva_mestra_system/commit/b170fec55ac45ecf627fd296ccd875868d6c7a20))


### Bug Fixes

* **deploy:** add base href to fix JSX path resolution on /landing ([a795fde](https://github.com/GScandelari/curva_mestra_system/commit/a795fde385f5b30f83cfdef12c83035bb59ad77d))
* **deploy:** add base href to fix JSX path resolution on /landing ([a795fde](https://github.com/GScandelari/curva_mestra_system/commit/a795fde385f5b30f83cfdef12c83035bb59ad77d))
* **deploy:** add base href to public/landing/index.html to fix relative path resolution ([de66e54](https://github.com/GScandelari/curva_mestra_system/commit/de66e54e8f53b9883cd235194a99d740847bff4f))
* **ui:** add section IDs, volume selector state, footer links, responsive layouts ([5810167](https://github.com/GScandelari/curva_mestra_system/commit/58101679030dae2278d2ee42a5a512a64bc910bc))
* **ui:** correct AppSidebar margin bug, sidebar icon, and add useBreakpoint hook ([a992c0d](https://github.com/GScandelari/curva_mestra_system/commit/a992c0dabfa7f7cc3d8960b86d30c0a7eb25c9ba))
* **ui:** replace hardcoded production URLs with relative paths ([2e62ff9](https://github.com/GScandelari/curva_mestra_system/commit/2e62ff9ac9394abdc7cbc82bf0fe542363756415))

## [1.3.0](https://github.com/GScandelari/curva_mestra_system/compare/v1.2.0...v1.3.0) (2026-05-11)


### Features

* **requests:** add Protocolos de Procedimentos ([85273f7](https://github.com/GScandelari/curva_mestra_system/commit/85273f70c22e2f6b38979def7a51ba17b7af3313))


### Bug Fixes

* **protocolos:** remove orderBy to avoid missing composite index ([ab9c77b](https://github.com/GScandelari/curva_mestra_system/commit/ab9c77bcd50673292ea1b1c3cb7da57ec23ddf18))

## [1.2.0](https://github.com/GScandelari/curva_mestra_system/compare/v1.1.0...v1.2.0) (2026-05-08)


### Features

* **inventory:** auto-assign brand Rennova on NF-e XML import ([c754ce1](https://github.com/GScandelari/curva_mestra_system/commit/c754ce1556f577d3a6a9df1820a59b5e2ff7a761))
* **inventory:** filter consultant inventory view by brand ([3faea7f](https://github.com/GScandelari/curva_mestra_system/commit/3faea7f2e9c59da288b0ee75c1b5867e42c14a7e))
* **inventory:** filter consultant views to brand=Rennova only ([92ab513](https://github.com/GScandelari/curva_mestra_system/commit/92ab513054882e19573e52b3e5309b15d72217a5))
* **types:** add brand field to InventoryItem and normalizeBrand utility ([53f00a5](https://github.com/GScandelari/curva_mestra_system/commit/53f00a5020b6a5eef738f5945bd5fe10fcab33ac))
* **ui:** add brand input to add-products flow for outras marcas ([1ed5f13](https://github.com/GScandelari/curva_mestra_system/commit/1ed5f13b9fbd0bb8bd628410337e6a4435ff8d57))


### Bug Fixes

* **inventory:** use brand-pre-filtered base for InventoryView stats ([090a12c](https://github.com/GScandelari/curva_mestra_system/commit/090a12cfb1bbaab05012e62add053b94b856425b))
* **ui:** remove procedures and reports access from consultant portal ([a556f58](https://github.com/GScandelari/curva_mestra_system/commit/a556f58800617b4795d5b7334bfaf0b58fa20157))

## [1.1.0](https://github.com/GScandelari/curva_mestra_system/compare/v1.0.1...v1.1.0) (2026-05-07)


### Features

* **api:** add parseNfeXml library and parse-nf-xml route for SEFAZ NF-e XML ([1770b06](https://github.com/GScandelari/curva_mestra_system/commit/1770b06647c8c6bcfd443a9310da38a75367f397))
* **consultant:** sidebar colapsável com botão flutuante, tooltip e persistência ([07cb9c8](https://github.com/GScandelari/curva_mestra_system/commit/07cb9c8f4e4ecb465125746bd1592e280f7b16ae))
* **inventory:** add getProductByCode to productService and addInventoryItems to inventoryService ([3449a61](https://github.com/GScandelari/curva_mestra_system/commit/3449a61adf46e1839c8cdd0dfdc7a234854405c3))
* **inventory:** busca por NF, desativacao de itens e bloqueio de vencidos ([59fba1e](https://github.com/GScandelari/curva_mestra_system/commit/59fba1e8bb9d0da12945a47e8c0a1d29a7360f55))
* **inventory:** desativacao forcada com redistribuicao de reservas FEFO ([7e35521](https://github.com/GScandelari/curva_mestra_system/commit/7e35521cc0893e9b8e56cf1e60708e339836beff))
* **inventory:** implement processNFAndAddToInventory with real Firestore writes ([4f9e051](https://github.com/GScandelari/curva_mestra_system/commit/4f9e051e3dae26a67645d9254b134739090e654f))
* **types:** extend NFProduct and ParsedNF for XML fields and add XmlParseError type ([41e2aa4](https://github.com/GScandelari/curva_mestra_system/commit/41e2aa4b7c83e1ffc9656497ee6956376b2e0c06))
* **ui:** rewrite FileUpload for XML-only, adapt upload page and add XML sub-step in add-products ([6e2c5ad](https://github.com/GScandelari/curva_mestra_system/commit/6e2c5ad0a071132f95396496f76c9dd5a90ea094))


### Bug Fixes

* **ci:** regenerate package-lock.json to restore missing testing-library packages ([a8f0dde](https://github.com/GScandelari/curva_mestra_system/commit/a8f0dde8608e5c68187c7e667df8c75add1d4739))
* **consultant:** adicionar padding horizontal no main content ([52ad16c](https://github.com/GScandelari/curva_mestra_system/commit/52ad16c070aaad6a5ee1eaf3f9305d65ee072465))
* **nf-import:** use master_products collection and remove manual NF input ([40051ab](https://github.com/GScandelari/curva_mestra_system/commit/40051ab6f637cb522505bdadc0bd8941c97078b1))
* **storage:** allow XML content types in /danfe/{tenantId} upload rule ([a094e52](https://github.com/GScandelari/curva_mestra_system/commit/a094e52a8672a1817489a8f79c006c566932f2d0))

## [1.0.1](https://github.com/GScandelari/curva_mestra_system/compare/v1.0.0...v1.0.1) (2026-05-05)


### Bug Fixes

* **quality:** corrigir 6 bugs reportados pelo SonarCloud ([#95](https://github.com/GScandelari/curva_mestra_system/issues/95)) ([c2eb436](https://github.com/GScandelari/curva_mestra_system/commit/c2eb43612337f086e657cee65509e0c579ffb683))
* **quality:** corrigir 6 bugs reportados pelo SonarCloud ([#96](https://github.com/GScandelari/curva_mestra_system/issues/96)) ([84f0654](https://github.com/GScandelari/curva_mestra_system/commit/84f0654149ea9ec25f4336ba542193077e88aefe))
* **quality:** corrigir 6 bugs reportados pelo SonarCloud ([#97](https://github.com/GScandelari/curva_mestra_system/issues/97)) ([915956a](https://github.com/GScandelari/curva_mestra_system/commit/915956a91a4c859fb4e236f535b38a4e1e492b2f))
* **quality:** corrigir loop infinito e vazamento de mensagem de erro ([5ad5d87](https://github.com/GScandelari/curva_mestra_system/commit/5ad5d87f916453b2eb5125ad217c4f04179f52ec))

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
