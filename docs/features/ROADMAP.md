# Roadmap - Curva Mestra 🗺️

**Sistema SaaS Multi-Tenant para Clínicas de Harmonização Facial e Corporal**

**Meta**: MVP em 5 semanas (07/11/2025 - 12/12/2025)

---

## 📅 Timeline Geral

```
Semana 1 (07-13 Nov): ✅ Setup + Auth
Semana 2 (14-20 Nov): 🎯 Portal Admin + OCR
Semana 3 (21-27 Nov): 🎯 Portal Clinic + Upload DANFE
Semana 4 (28 Nov-04 Dez): 🎯 Dashboard + Solicitações
Semana 5 (05-12 Dez): 🎯 Testes + Deploy + Documentação
```

**Status Atual**: Semana 3 - 60% concluída 🎯

---

## ✅ Semana 1 (07-13 Nov): Setup Infraestrutura + Autenticação

**Objetivo**: Preparar toda a infraestrutura base do projeto

### Concluído ✅
- [x] Configurar projeto Firebase
- [x] Instalar stack (Next.js 15, TypeScript, Tailwind, Firebase)
- [x] Configurar emuladores Firebase
- [x] Implementar sistema multi-tenant (Custom Claims + RLS)
- [x] Criar regras de segurança Firestore e Storage
- [x] Implementar tipos TypeScript completos
- [x] Criar Cloud Functions base (14 funções)
- [x] Criar parser DANFE (Python RegEx v4.0)
- [x] Criar estrutura de rotas Next.js (20 páginas)
- [x] Componentes UI (Shadcn - 11 componentes + 3 customizados)
- [x] Script de usuários de teste
- [x] Documentação do projeto
- [x] **Login funcional** - Formulário de login com Firebase Auth
- [x] **Logout** - Implementar logout e limpeza de sessão
- [x] **Proteção de rotas** - Middleware para proteger rotas por role
- [x] **Recuperação de senha** - Fluxo de reset de senha
- [x] **Hook useAuth** - Type-safe authentication hook
- [x] **Página de perfil básica** - Visualização de dados (edição pendente)

**Progresso**: 100% ✅ | **Todas as tarefas concluídas!**

---

## ✅ Semana 2 (14-20 Nov): Portal System Admin + OCR Completo

**Objetivo**: Portal administrativo completo + OCR funcionando 100%

### Concluído ✅

#### Portal System Admin
- [x] **Dashboard System Admin** (12h) ✅
  - Total de tenants, licenças ativas, usuários
  - Cards de ações rápidas
  - Estatísticas básicas
- [x] **CRUD de Tenants** (16h) ✅
  - Criar, editar, visualizar, desativar tenants
  - Validações CNPJ único, formatação automática
  - Sistema de planos (Basic, Pro, Enterprise)
- [x] **CRUD Produtos Master** (16h) ✅
  - Cadastro de produtos Rennova no catálogo master
  - Validação de código único (7-8 dígitos)
  - Edição e ativação/desativação
  - Collection global `master_products`
- [x] **Gestão de Usuários** (12h) ✅
  - Listagem global de todos os usuários
  - Criação de usuários por clínica
  - Validação de limite por plano
  - Custom claims automáticos

#### OCR & Parser (Parcial)
- [x] **Parser completo com RegEx** (6h) ✅
  - RegEx v4.0 implementado (LOT, QTD, VAL, COD, VALOR)
  - Classes ProdutoRennova e NFRennova
  - CLI com --file e --text
- [x] **Trigger automático no upload** (4h) ✅
  - Estrutura preparada (onNfImported)
- [x] **Salvar produtos no Firestore** (8h) 🟡
  - Service implementado (nfImportService)
  - Usando mock data temporariamente

### Pendente 🔴
- [ ] **CRUD de Licenças** (12h)
  - Criar, editar, visualizar licenças temporais
  - Controle de expiração
- [ ] **Integrar pytesseract + pdf2image** (8h)
  - Configurar Python environment nas Functions
  - Instalar dependências (tesseract, poppler)
  - Conectar com upload
- [ ] **Validação de produtos novos** (6h)
  - Comparar com catálogo master
  - Marcar como "novo_produto_pendente"
- [ ] **Teste com NF-e 026229** (4h)
  - Validar 100% de acurácia
  - Ajustar RegEx se necessário

**Progresso**: 80% ✅ | **Horas concluídas**: ~74h de ~92h | **Horas restantes**: ~18h

---

## ✅ Semana 3 (21-27 Nov): Portal Clinic + Upload DANFE

**Objetivo**: Portal da clínica completo com upload de DANFE funcional

### Concluído ✅

#### Portal Clinic - Interface
- [x] **Dashboard Clinic** (16h) ✅
  - Métricas em tempo real (total, valor, vencendo, baixo estoque)
  - Cards de ações rápidas
  - Top 5 produtos vencendo (badges coloridos)
  - Atividade recente (últimas 5 movimentações)
  - Loading states com Skeleton
- [x] **Upload de DANFE (PDF)** (12h) 🟡
  - Interface drag-and-drop completa (FileUpload component)
  - Progress bar de upload
  - Fluxo completo com 7 estados
  - Preview de produtos extraídos
  - ⚠️ OCR simulado (falta integração real)
- [x] **Visualizar inventário** (12h) ✅
  - Listagem de produtos com busca em tempo real
  - Cards de estatísticas
  - Filtros inteligentes (todos, vencendo, baixo, esgotado)
  - Ordenação múltipla
  - Exportação CSV
- [x] **Buscar produto** (4h) ✅
  - Search bar funcional
  - Busca por código, nome, lote
  - Resultados em tempo real
- [x] **Alertas de vencimento** (8h) ✅
  - Badges coloridos por urgência
  - Lista de produtos vencendo em 30 dias
  - Link para detalhes
- [x] **Detalhes do produto** (4h) ✅
  - Página individual com todas as informações
  - Barra de progresso de consumo
  - Badges de status

#### Gestão de Lotes
- [x] **Controle de lotes** (8h) ✅
  - Rastrear produtos por lote
  - Visualizar por lote específico (busca)
  - Campo lote no inventário
- [ ] **FIFO automático** (8h) 🟡
  - Estrutura preparada
  - Falta implementar consumo real

#### UX/UI
- [x] **Responsividade mobile** (8h) ✅
  - Todas as telas adaptadas para mobile
  - Menu mobile com drawer (Sheet)
  - ClinicLayout responsivo
- [x] **Loading states** (4h) ✅
  - Skeletons em dashboard e inventário
  - Spinners em operações assíncronas
- [x] **Error handling** (4h) ✅
  - Mensagens de erro amigáveis
  - Try-catch em todos os services
  - Empty states informativos

### Pendente 🔴
- [ ] **FIFO automático** (8h)
  - Implementar lógica de consumo por ordem de entrada

**Progresso**: 90% ✅ | **Horas concluídas**: ~76h de ~84h | **Horas restantes**: ~8h

---

## 🎯 Semana 4 (28 Nov-04 Dez): Sistema de Solicitações + Notificações

**Objetivo**: Fluxo completo de solicitações + notificações funcionando

### Features Planejadas

#### Sistema de Solicitações
- [ ] **Criar solicitação** (16h)
  - Formulário multi-step
  - Seleção de produtos
  - Validação de estoque disponível
- [ ] **Aprovar/reprovar solicitações** (12h)
  - Interface para admin
  - Dedução automática do estoque
  - Motivo de reprovação
- [ ] **Visualizar solicitações** (8h)
  - Listagem com filtros
  - Status em tempo real
  - Detalhes da solicitação
- [ ] **Agendar solicitação** (8h)
  - Criar solicitação para data futura
  - Notificação no dia agendado
- [ ] **Histórico de solicitações** (4h)
  - Ver todas as solicitações do usuário
  - Filtros por status e período

#### Notificações
- [ ] **Alerta de vencimento** (8h)
  - Notificação in-app (30 dias antes)
  - Badge de notificações
- [ ] **Alerta de produto vencido** (4h)
  - Notificação quando produto venceu
  - Bloquear consumo
- [ ] **Email de alertas** (8h)
  - Configurar Firebase Extension Trigger Email
  - Templates de email
- [ ] **Notificação de nova solicitação** (4h)
  - Admin recebe notificação
  - Email + in-app

#### Melhorias
- [ ] **Histórico de NFs importadas** (4h)
  - Listar todas as NFs com status
  - Download do PDF original
- [ ] **Editar inventário manualmente** (8h)
  - Ajustar quantidade, lote, validade
  - Log de alterações
- [ ] **Gerenciar usuários da clínica** (8h)
  - CRUD de usuários (apenas admin)
  - Ativar/desativar

**Horas totais**: ~92h (~11.5 dias) | **Com 2 devs**: ~46h (~6 dias)

---

## 🎯 Semana 5 (05-12 Dez): Testes + Deploy + Documentação

**Objetivo**: Preparar para produção + documentação completa

### Features Planejadas

#### Testes
- [ ] **Testes E2E com Playwright** (16h)
  - Fluxo de login
  - Upload de DANFE
  - Criar solicitação
  - Aprovar solicitação
- [ ] **Testes unitários (Jest)** (12h)
  - Funções críticas
  - Parser DANFE
  - Helpers
- [ ] **Testes com Emulators** (8h)
  - Firestore rules
  - Storage rules
  - Cloud Functions

#### Deploy & Infraestrutura
- [ ] **Habilitar serviços Firebase produção** (4h)
  - Authentication
  - Firestore
  - Storage
  - Functions
- [ ] **Deploy inicial** (4h)
  - Deploy Hosting
  - Deploy Functions
  - Deploy Rules
- [ ] **Configurar domínio** (4h)
  - Configurar DNS
  - SSL automático
- [ ] **Monitoramento** (4h)
  - Firebase Crashlytics
  - Firebase Performance
  - Google Cloud Logging

#### Documentação
- [ ] **Documentação de usuário** (8h)
  - Manual do System Admin
  - Manual do Clinic Admin
  - Manual do Clinic User
- [ ] **Documentação técnica** (8h)
  - Arquitetura do sistema
  - Guia de desenvolvimento
  - API Reference
- [ ] **Vídeos tutoriais** (8h)
  - Como fazer upload de DANFE
  - Como criar solicitação
  - Como gerenciar inventário

#### Polimento
- [ ] **UX/UI Review** (8h)
  - Ajustes de design
  - Consistência visual
  - Feedback de usuários
- [ ] **Performance** (8h)
  - Otimização de queries
  - Lazy loading
  - Code splitting
- [ ] **Segurança** (4h)
  - Auditoria de regras
  - Sanitização de inputs
  - Rate limiting

**Horas totais**: ~96h (~12 dias) | **Com 2 devs**: ~48h (~6 dias)

---

## 📊 Resumo do MVP (5 Semanas)

| Semana | Foco | Horas | Concluído | Progresso |
|--------|------|-------|-----------|-----------|
| 1 | Setup + Auth | 80h | 80h | ✅ **100%** |
| 2 | Portal Admin + OCR | 92h | 74h | ✅ **80%** |
| 3 | Portal Clinic + Upload | 84h | 76h | ✅ **90%** |
| 4 | Solicitações + Notificações | 92h | 0h | 🔴 **0%** |
| 5 | Testes + Deploy + Docs | 96h | 0h | 🔴 **0%** |
| **TOTAL** | **MVP v1.0** | **444h** | **230h** | **52%** |

**Progresso Real**: 230h concluídas de 444h planejadas = **52% do MVP** 🎉

**Estimativa de conclusão**:
- Horas restantes: ~214h
- Com 2 desenvolvedores: ~107h (~13 dias úteis / ~2.5 semanas)
- **Data estimada**: Início de Dezembro 2025

---

## 🚀 Pós-MVP (v1.1 - v2.0)

### v1.1 (Semanas 6-7): Melhorias P1
- Magic Link Login
- 2FA para system_admin
- Fallback Vertex AI Gemini
- Detecção de duplicatas de NF
- Relatórios básicos
- Configurar preferências de notificações

### v1.2 (Semanas 8-10): Features P1 Complementares
- Logs de atividades
- Suporte a tickets
- Anexar paciente à solicitação
- Histórico de movimentações
- API REST pública
- PWA manifest + Service Worker

### v2.0 (Semanas 11-15): Features P2
- Login com Google
- Billing/Faturamento
- Relatórios personalizados
- Push notifications
- Integração WhatsApp
- Capacitor iOS/Android
- CI/CD completo

---

## 🎯 Milestones Críticos

### ✅ Milestone 1: Autenticação Completa
**Data**: 13/11/2025 (Fim da Semana 1) - **CONCLUÍDO**
- [x] Sistema multi-tenant funcionando
- [x] Login/logout funcional
- [x] Proteção de rotas
- [x] Usuários de teste criados
- [x] Hook useAuth type-safe

### ✅ Milestone 2: Portal System Admin Funcional
**Data**: 20/11/2025 (Fim da Semana 2) - **80% CONCLUÍDO**
- [x] Dashboard com estatísticas
- [x] CRUD de tenants completo
- [x] CRUD de produtos master
- [x] Gestão de usuários
- [x] Sistema de planos
- [ ] CRUD de licenças temporais (pendente)

### ✅ Milestone 3: Portal Clinic Funcional
**Data**: 27/11/2025 (Fim da Semana 3) - **90% CONCLUÍDO**
- [x] Dashboard com métricas em tempo real
- [x] Upload de DANFE (interface completa, OCR simulado)
- [x] Visualização de inventário completa
- [x] Alertas de vencimento
- [x] Detalhes de produtos
- [x] Exportação CSV
- [ ] OCR real integrado (pendente)

### 🔴 Milestone 4: OCR Funcionando 100%
**Data**: 30/11/2025 (Revisado) - **EM ANDAMENTO**
- [x] Parser RegEx v4.0 implementado
- [x] Upload de PDF para Storage
- [ ] Integração pytesseract + pdf2image
- [ ] 100% acurácia com NF-e 026229
- [ ] Validação contra catálogo master
- [ ] Produtos salvos automaticamente no Firestore

### 🔴 Milestone 5: Sistema de Solicitações
**Data**: 06/12/2025 (Revisado) - **NÃO INICIADO**
- [ ] Criar solicitação
- [ ] Aprovar/reprovar
- [ ] Notificações in-app
- [ ] Email de alertas
- [ ] Histórico de solicitações

### 🔴 Milestone 6: MVP Pronto para Produção
**Data**: 15/12/2025 (Revisado) - **PLANEJADO**
- [ ] Testes E2E passando
- [ ] Deploy em produção
- [ ] Documentação completa
- [ ] Monitoramento ativo

---

## 📝 Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| OCR com baixa acurácia | Média | Alto | Implementar fallback Gemini + correção manual |
| Problemas de performance | Baixa | Médio | Otimizar queries + índices Firestore |
| Atraso no cronograma | Alta | Alto | Priorizar P0, cortar P1/P2 se necessário |
| Complexidade do parser | Média | Alto | Testar com múltiplas NFs, ajustar RegEx |
| Problemas de deploy | Baixa | Médio | Testar com emuladores antes de produção |

---

## 🎉 Definição de Pronto (DoD)

Uma feature está **PRONTA** quando:
1. ✅ Código implementado e revisado
2. ✅ Testes (unitários ou E2E) passando
3. ✅ Funciona nos emuladores Firebase
4. ✅ Documentação atualizada
5. ✅ Sem warnings de TypeScript
6. ✅ Responsivo (mobile + desktop)
7. ✅ Regras de segurança atualizadas
8. ✅ Testado por outro membro da equipe

---

**Última atualização**: 08/11/2025
**Responsável**: Equipe Curva Mestra
**Claude AI**: Arquiteto oficial do projeto
