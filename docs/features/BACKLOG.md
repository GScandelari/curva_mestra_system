# Backlog de Features 📋

**Última atualização**: 08/11/2025
**Versão alvo**: v1.0 (MVP - 5 semanas)

---

## 🎯 Legendas

**Prioridade**:
- `P0` - Crítico para MVP (blocker)
- `P1` - Importante para MVP
- `P2` - Nice to have (pós-MVP)

**Complexidade**:
- `XS` - 1-2 horas
- `S` - 4-8 horas (1 dia)
- `M` - 2-3 dias
- `L` - 4-5 dias
- `XL` - 1-2 semanas

**Status**:
- `🔴 Not Started` - Não iniciado
- `🟡 In Progress` - Em desenvolvimento
- `🟢 Done` - Concluído

---

## 🔐 Módulo: Autenticação & Onboarding

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Login com Email/Senha | `S` | 🔴 | Implementar formulário de login funcional com Firebase Auth |
| Logout | `XS` | 🔴 | Botão de logout e limpeza de sessão |
| Proteção de rotas | `M` | 🔴 | Middleware para proteger rotas por role (system_admin, clinic_admin, clinic_user) |
| Recuperação de senha | `S` | 🔴 | Fluxo de reset de senha via email |
| Validação de email | `S` | 🔴 | Envio de email de verificação após cadastro |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Magic Link Login | `M` | 🔴 | Login sem senha via link enviado por email |
| 2FA (Two-Factor Auth) | `L` | 🔴 | Autenticação em dois fatores para system_admin |
| Página de perfil | `S` | 🔴 | Editar nome, avatar, senha |
| Avatar upload | `S` | 🔴 | Upload de foto de perfil para Storage |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Login com Google | `M` | 🔴 | OAuth com Google Sign-In |
| Histórico de acessos | `S` | 🔴 | Log de login/logout do usuário |
| Sessões ativas | `M` | 🔴 | Visualizar e revogar sessões ativas |

---

## 👑 Módulo: Portal System Admin

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Dashboard System Admin | `M` | 🔴 | Visão geral: total de tenants, licenças ativas, usuários |
| CRUD de Tenants | `L` | 🔴 | Criar, editar, visualizar, desativar tenants |
| CRUD de Licenças | `M` | 🔴 | Criar, editar, visualizar licenças |
| Associar licença a tenant | `S` | 🔴 | Vincular uma licença a um tenant específico |
| Visualizar todos os tenants | `S` | 🔴 | Listagem paginada de tenants com filtros |
| CRUD Produtos Master | `L` | 🔴 | Cadastro de produtos Rennova no catálogo master |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Métricas globais | `M` | 🔴 | Total de NFs importadas, produtos cadastrados, alertas ativos |
| Logs de atividades | `M` | 🔴 | Auditoria de ações de system_admin |
| Gerenciar usuários de tenants | `M` | 🔴 | Criar/editar/desativar usuários de qualquer tenant |
| Suporte a tickets | `L` | 🔴 | Sistema de tickets para suporte aos tenants |
| Notificações para tenants | `M` | 🔴 | Enviar avisos para tenants específicos |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Relatórios de uso | `L` | 🔴 | Relatório de uso de cada tenant (NFs, storage, etc) |
| Billing/Faturamento | `XL` | 🔴 | Integração com sistema de pagamentos (Stripe/Mercado Pago) |
| Exportação de dados | `M` | 🔴 | Exportar dados de tenants (CSV, Excel) |

---

## 🏥 Módulo: Portal Clinic (Admin & User)

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Dashboard Clinic | `L` | 🔴 | Visão geral: total produtos, vencimentos, solicitações pendentes |
| Upload de DANFE (PDF) | `M` | 🔴 | Interface para upload de NF-e Rennova em PDF |
| Visualizar inventário | `M` | 🔴 | Listagem de produtos com filtros (lote, validade, quantidade) |
| Buscar produto no inventário | `S` | 🔴 | Search bar para buscar por código, nome, lote |
| Alertas de vencimento | `M` | 🔴 | Notificações de produtos próximos ao vencimento (30 dias) |
| Criar solicitação de produtos | `L` | 🔴 | Formulário para criar solicitação de consumo de produtos |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Editar inventário manualmente | `M` | 🔴 | Ajustar quantidade, lote, validade manualmente |
| Histórico de NFs importadas | `S` | 🔴 | Listar todas as NFs importadas com status |
| Reprocessar NF com erro | `S` | 🔴 | Reenviar NF que falhou no OCR |
| Aprovar/reprovar solicitações | `M` | 🔴 | Fluxo de aprovação de solicitações (apenas admin) |
| Visualizar solicitações | `S` | 🔴 | Listagem de solicitações com filtros |
| Gerenciar usuários da clínica | `M` | 🔴 | CRUD de usuários do tenant (apenas admin) |
| Notificações in-app | `M` | 🔴 | Badge de notificações para alertas e solicitações |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Relatório de consumo | `L` | 🔴 | Relatório de produtos consumidos por período |
| Exportar inventário | `S` | 🔴 | Exportar inventário para Excel/CSV |
| Histórico de movimentações | `M` | 🔴 | Log de entradas/saídas de produtos |
| Configurações da clínica | `S` | 🔴 | Editar nome, CNPJ, logo, etc |
| Dashboard por profissional | `L` | 🔴 | Métricas de consumo por profissional |

---

## 🤖 Módulo: OCR & Processamento de DANFE

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Trigger automático no upload | `S` | 🔴 | Cloud Function disparada ao upload de PDF |
| OCR com pytesseract | `M` | 🔴 | Extração de texto do PDF com pytesseract + pdf2image |
| Parser RegEx v4.0 | `S` | 🔴 | Aplicar RegEx para extrair produtos, lotes, validades |
| Salvar produtos no Firestore | `M` | 🔴 | Inserir produtos extraídos no `inventory` do tenant |
| Status de processamento | `S` | 🔴 | Atualizar status da NF: pending, processing, success, error |
| Validação de produtos novos | `M` | 🔴 | Se produto não existe no catálogo master, marcar como "novo_produto_pendente" |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Fallback Vertex AI Gemini | `L` | 🔴 | Se pytesseract falhar, usar Gemini 1.5 Flash para OCR |
| Teste com NF-e 026229 | `S` | 🔴 | Validar 100% de acurácia com a NF de referência |
| Detecção de duplicatas | `M` | 🔴 | Impedir importação de NF já processada (mesmo número) |
| Preview de extração | `M` | 🔴 | Mostrar produtos extraídos antes de confirmar importação |
| Correção manual de erros | `M` | 🔴 | Interface para corrigir produtos extraídos incorretamente |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| OCR via imagem/foto | `L` | 🔴 | Aceitar foto da NF tirada pelo celular |
| Múltiplos fornecedores | `XL` | 🔴 | Suporte a DANFEs de outros fornecedores além de Rennova |
| ML para melhorar acurácia | `XL` | 🔴 | Treinar modelo custom para reconhecimento de DANFEs |

---

## 📊 Módulo: Dashboard & Relatórios

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Total de produtos no estoque | `XS` | 🔴 | Card com total de produtos em estoque |
| Produtos vencendo em 30 dias | `S` | 🔴 | Card com alertas de vencimento |
| Solicitações pendentes | `XS` | 🔴 | Card com total de solicitações aguardando aprovação |
| Gráfico de vencimentos | `M` | 🔴 | Gráfico mostrando produtos por data de vencimento |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Produtos com estoque baixo | `S` | 🔴 | Alerta para produtos com quantidade < X |
| Histórico de importações | `S` | 🔴 | Gráfico de NFs importadas por mês |
| Top 10 produtos mais usados | `M` | 🔴 | Ranking de produtos mais consumidos |
| Valor total do estoque | `S` | 🔴 | Somatório do valor total em R$ |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Relatórios personalizados | `L` | 🔴 | Criar relatórios customizados com filtros |
| Exportar relatórios PDF | `M` | 🔴 | Gerar PDF de relatórios |
| Dashboard em tempo real | `M` | 🔴 | Atualização automática com Firestore Realtime |
| Comparativo mensal | `M` | 🔴 | Comparar consumo mês a mês |

---

## 🔔 Módulo: Notificações & Alertas

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Alerta de vencimento (30 dias) | `M` | 🔴 | Notificação in-app quando produto está próximo do vencimento |
| Alerta de produto vencido | `S` | 🔴 | Notificação quando produto venceu |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Email de alertas | `M` | 🔴 | Enviar email com Firebase Extensions (Trigger Email) |
| Alerta de estoque baixo | `M` | 🔴 | Notificação quando estoque < limite configurado |
| Notificação de nova solicitação | `S` | 🔴 | Admin recebe notificação quando há nova solicitação |
| Configurar preferências | `M` | 🔴 | Usuário escolhe quais notificações quer receber |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Push notifications (PWA) | `L` | 🔴 | Notificações push no navegador/mobile |
| WhatsApp notifications | `L` | 🔴 | Enviar alertas via WhatsApp Business API |
| SMS notifications | `M` | 🔴 | Enviar alertas via SMS (Twilio) |

---

## 📦 Módulo: Gestão de Lotes & Validade

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Controle de lotes | `M` | 🔴 | Rastrear produtos por lote (entrada via DANFE) |
| FIFO automático | `M` | 🔴 | Consumir produtos seguindo First In, First Out |
| Visualizar por lote | `S` | 🔴 | Filtrar inventário por lote específico |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Histórico de lotes | `M` | 🔴 | Ver todos os lotes já utilizados de um produto |
| Bloquear lote vencido | `S` | 🔴 | Impedir consumo de produtos com lote vencido |
| Transferir entre lotes | `M` | 🔴 | Mover quantidade de um lote para outro (ajuste) |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Rastreabilidade completa | `L` | 🔴 | Rastrear lote desde importação até consumo final |
| Recall de lote | `M` | 🔴 | Marcar lote como recalled e bloquear uso |

---

## 🎫 Módulo: Sistema de Solicitações

### P0 - Críticas para MVP

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Criar solicitação | `L` | 🔴 | Formulário para solicitar consumo de produtos |
| Status da solicitação | `S` | 🔴 | criada, agendada, aprovada, reprovada, cancelada |
| Aprovar solicitação (admin) | `M` | 🔴 | Admin aprova e deduz do estoque |
| Reprovar solicitação (admin) | `S` | 🔴 | Admin reprova com motivo |

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Agendar solicitação | `M` | 🔴 | Criar solicitação para data futura |
| Anexar paciente à solicitação | `M` | 🔴 | Vincular solicitação a prontuário do paciente |
| Histórico de solicitações | `S` | 🔴 | Ver todas as solicitações do usuário |
| Cancelar solicitação | `S` | 🔴 | Usuário ou admin pode cancelar |
| Editar solicitação | `M` | 🔴 | Editar antes de aprovar (apenas criador ou admin) |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Solicitações recorrentes | `L` | 🔴 | Criar solicitação que se repete semanalmente/mensalmente |
| Templates de solicitação | `M` | 🔴 | Salvar templates de procedimentos comuns |
| Aprovar em lote | `M` | 🔴 | Admin aprova múltiplas solicitações de uma vez |

---

## 🔌 Módulo: Integrações

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Webhook de eventos | `M` | 🔴 | Enviar webhooks quando NF é importada, estoque baixo, etc |
| API REST pública | `L` | 🔴 | Endpoints para integração externa |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Integração ERP | `XL` | 🔴 | Integrar com sistemas ERP de clínicas |
| Integração WhatsApp Business | `L` | 🔴 | Enviar notificações e relatórios via WhatsApp |
| Zapier/Make integration | `M` | 🔴 | Conectar com Zapier para automações |

---

## 📱 Módulo: PWA & Mobile

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| PWA manifest | `S` | 🔴 | Configurar manifest.json para instalação |
| Service Worker | `M` | 🔴 | Cache de assets e offline support |
| Offline mode básico | `L` | 🔴 | Visualizar inventário offline |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Capacitor iOS/Android | `XL` | 🔴 | Gerar apps nativos iOS e Android |
| Camera integration | `M` | 🔴 | Tirar foto da NF pelo app |
| Biometric auth | `M` | 🔴 | Login com impressão digital/Face ID |

---

## 🧪 Módulo: Testes & Qualidade

### P1 - Importantes

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| Unit tests (Jest) | `L` | 🔴 | Testes unitários de funções críticas |
| E2E tests (Playwright) | `XL` | 🔴 | Testes end-to-end dos fluxos principais |
| Firebase Emulator tests | `M` | 🔴 | Testes com emuladores |

### P2 - Nice to Have

| Feature | Complexidade | Status | Descrição |
|---------|--------------|--------|-----------|
| CI/CD com GitHub Actions | `M` | 🔴 | Pipeline de testes automáticos |
| Code coverage | `S` | 🔴 | Relatório de cobertura de testes |
| Performance monitoring | `M` | 🔴 | Firebase Performance + Crashlytics |

---

## 📈 Resumo do Backlog

| Prioridade | Total Features | Horas Estimadas |
|------------|----------------|-----------------|
| P0         | 42             | ~420h (~10 semanas) |
| P1         | 48             | ~480h (~12 semanas) |
| P2         | 35             | ~350h (~9 semanas) |
| **TOTAL**  | **125**        | **~1250h (~31 semanas)** |

**MVP (P0 apenas)**: ~10 semanas de desenvolvimento (2 devs = 5 semanas)

---

**Observações**:
- Estimativas são aproximadas e podem variar
- Algumas features podem ser desenvolvidas em paralelo
- Priorizar P0 para entregar MVP em 5 semanas
- P1 e P2 são features pós-MVP
