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

**Status Atual**: Semana 1 - 85% concluída ✅

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
- [x] Criar Cloud Functions base
- [x] Criar parser DANFE (Python RegEx v4.0)
- [x] Criar estrutura de rotas Next.js
- [x] Componentes UI (Shadcn)
- [x] Script de usuários de teste
- [x] Documentação do projeto

### Pendente 🎯
- [ ] **Login funcional** - Formulário de login com Firebase Auth (4h)
- [ ] **Logout** - Implementar logout e limpeza de sessão (1h)
- [ ] **Proteção de rotas** - Middleware para proteger rotas por role (6h)
- [ ] **Recuperação de senha** - Fluxo de reset de senha (4h)
- [ ] **Página de perfil básica** - Editar nome e senha (4h)

**Progresso**: 85% | **Horas restantes**: ~19h

---

## 🎯 Semana 2 (14-20 Nov): Portal System Admin + OCR Completo

**Objetivo**: Portal administrativo completo + OCR funcionando 100%

### Features Planejadas

#### Portal System Admin
- [ ] **Dashboard System Admin** (12h)
  - Total de tenants, licenças ativas, usuários
  - Métricas globais
- [ ] **CRUD de Tenants** (16h)
  - Criar, editar, visualizar, desativar tenants
  - Validações e regras de negócio
- [ ] **CRUD de Licenças** (12h)
  - Criar, editar, visualizar licenças
  - Vincular licença a tenant
- [ ] **CRUD Produtos Master** (16h)
  - Cadastro de produtos Rennova no catálogo master
  - Importar lista de produtos
  - Edição e desativação

#### OCR & Parser
- [ ] **Integrar pytesseract + pdf2image** (8h)
  - Configurar Python environment nas Functions
  - Instalar dependências (tesseract, poppler)
- [ ] **Trigger automático no upload** (4h)
  - Cloud Function disparada ao upload de PDF
- [ ] **Parser completo com RegEx** (6h)
  - Aplicar RegEx v4.0
  - Extrair produtos, lotes, validades
- [ ] **Salvar produtos no Firestore** (8h)
  - Inserir produtos extraídos no inventory
  - Atualizar status da NF
- [ ] **Validação de produtos novos** (6h)
  - Comparar com catálogo master
  - Marcar como "novo_produto_pendente"
- [ ] **Teste com NF-e 026229** (4h)
  - Validar 100% de acurácia
  - Ajustar RegEx se necessário

**Horas totais**: ~92h (~11.5 dias) | **Com 2 devs**: ~46h (~6 dias)

---

## 🎯 Semana 3 (21-27 Nov): Portal Clinic + Upload DANFE

**Objetivo**: Portal da clínica completo com upload de DANFE funcional

### Features Planejadas

#### Portal Clinic - Interface
- [ ] **Dashboard Clinic** (16h)
  - Total produtos, vencimentos, solicitações pendentes
  - Cards de métricas
  - Gráficos básicos
- [ ] **Upload de DANFE (PDF)** (12h)
  - Interface drag-and-drop
  - Progress bar de upload
  - Preview do PDF
- [ ] **Visualizar inventário** (12h)
  - Listagem de produtos com paginação
  - Filtros (lote, validade, quantidade)
  - Ordenação
- [ ] **Buscar produto** (4h)
  - Search bar com autocomplete
  - Busca por código, nome, lote
- [ ] **Alertas de vencimento** (8h)
  - Badge de notificações
  - Lista de produtos vencendo em 30 dias
  - Ações rápidas

#### Gestão de Lotes
- [ ] **Controle de lotes** (8h)
  - Rastrear produtos por lote
  - Visualizar por lote específico
- [ ] **FIFO automático** (8h)
  - Consumir produtos seguindo First In, First Out
  - Lógica de seleção de lote

#### UX/UI
- [ ] **Responsividade mobile** (8h)
  - Adaptar todas as telas para mobile
  - Menu mobile
- [ ] **Loading states** (4h)
  - Skeletons e spinners
- [ ] **Error handling** (4h)
  - Mensagens de erro amigáveis
  - Retry automático

**Horas totais**: ~84h (~10.5 dias) | **Com 2 devs**: ~42h (~5 dias)

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

| Semana | Foco | Horas | Status |
|--------|------|-------|--------|
| 1 | Setup + Auth | 80h | ✅ 85% |
| 2 | Portal Admin + OCR | 92h | 🎯 Próxima |
| 3 | Portal Clinic + Upload | 84h | 📋 Planejada |
| 4 | Solicitações + Notificações | 92h | 📋 Planejada |
| 5 | Testes + Deploy + Docs | 96h | 📋 Planejada |
| **TOTAL** | **MVP v1.0** | **444h** | **15% concluído** |

**Com 2 desenvolvedores**: 444h / 2 = 222h (~5.5 semanas de trabalho)

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

### Milestone 1: Autenticação Completa ✅
**Data**: 13/11/2025 (Fim da Semana 1)
- [x] Sistema multi-tenant funcionando
- [ ] Login/logout funcional
- [ ] Proteção de rotas
- [ ] Usuários de teste criados

### Milestone 2: OCR Funcionando 100%
**Data**: 20/11/2025 (Fim da Semana 2)
- [ ] Upload de PDF
- [ ] OCR com pytesseract
- [ ] Parser RegEx v4.0
- [ ] 100% acurácia com NF-e 026229
- [ ] Produtos salvos no Firestore

### Milestone 3: Portal Clinic Funcional
**Data**: 27/11/2025 (Fim da Semana 3)
- [ ] Dashboard com métricas
- [ ] Upload de DANFE completo
- [ ] Visualização de inventário
- [ ] Alertas de vencimento

### Milestone 4: Sistema de Solicitações
**Data**: 04/12/2025 (Fim da Semana 4)
- [ ] Criar solicitação
- [ ] Aprovar/reprovar
- [ ] Notificações in-app
- [ ] Email de alertas

### Milestone 5: MVP Pronto para Produção
**Data**: 12/12/2025 (Fim da Semana 5)
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
