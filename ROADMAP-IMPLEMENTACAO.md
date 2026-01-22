# 🚀 Roadmap de Implementação - Curva Mestra

**Data de Início:** 22/01/2026
**Objetivo:** Completar funcionalidades essenciais (exceto pagamento)
**Tempo Estimado:** ~20 horas

---

## 📋 VISÃO GERAL

### O Que Vamos Implementar
- ✅ Correções de segurança críticas
- ✅ Sistema de email completo
- ✅ Bug de licença duplicada
- ✅ TODOs funcionais incompletos
- ✅ Validações robustas
- ✅ Qualidade e UX

### O Que Fica Para Depois
- ⏭️ Integração PagBank produção (requer aprovação externa)
- ⏭️ Testes E2E automatizados
- ⏭️ Monitoramento avançado

---

## 🎯 FASE 1: SEGURANÇA CRÍTICA (5 horas)

### ✅ TASK 1: Hash de Senhas com bcrypt
**Prioridade:** 🔴 P0 - CRÍTICO
**Tempo:** 2 horas
**Impacto:** Violação de segurança grave

**Arquivos afetados:**
- `src/app/api/access-requests/route.ts`
- `src/app/api/access-requests/[id]/approve/route.ts`

**Implementação:**
1. Instalar bcryptjs
2. Modificar POST /api/access-requests para salvar hash
3. Modificar approve para gerar senha temporária
4. Implementar email com senha temporária

**Validação:**
- [ ] Senhas nunca aparecem em plain text no Firestore
- [ ] Hash bcrypt válido (60 caracteres, começa com $2)
- [ ] Usuário recebe senha temporária por email

---

### ✅ TASK 2: Proteger Página /debug
**Prioridade:** 🔴 P0 - CRÍTICO
**Tempo:** 30 minutos
**Impacto:** Exposição de configurações

**Arquivo:** `src/app/debug/page.tsx`

**Implementação:**
1. Adicionar verificação de autenticação
2. Permitir apenas system_admin
3. Adicionar aviso de "página de desenvolvimento"

**Validação:**
- [ ] Acesso sem autenticação → redirect para /login
- [ ] Acesso com clinic_admin → 403 Forbidden
- [ ] Acesso com system_admin → página carrega

---

### ✅ TASK 3: Remover Console.logs Sensíveis
**Prioridade:** 🔴 P0 - CRÍTICO
**Tempo:** 1 hora
**Impacto:** Vazamento de dados de pagamento

**Arquivos críticos:**
- `src/app/(clinic)/clinic/setup/payment/page.tsx`
- `src/app/api/pagbank/subscription/route.ts`

**Implementação:**
1. Criar helper de logging condicional
2. Substituir console.log por logger
3. Remover logs com tokens/cartões

**Validação:**
- [ ] DevTools não mostra tokens de cartão
- [ ] Apenas logs em development mode
- [ ] Logs de produção sem dados sensíveis

---

### ✅ TASK 4: Mover Credenciais para Variáveis de Ambiente
**Prioridade:** 🟠 P1 - ALTO
**Tempo:** 1 hora
**Impacto:** Exposição de tokens

**Arquivos:**
- `.env.local` → criar `.env.local.example`
- `functions/` → usar Firebase Secrets

**Implementação:**
1. Criar .env.local.example sem valores reais
2. Adicionar .env.local ao .gitignore (já existe)
3. Configurar Firebase Secrets para functions
4. Atualizar functions para usar defineSecret()

**Validação:**
- [ ] .env.local não commitado
- [ ] .env.local.example no repositório
- [ ] Secrets configurados no Firebase

---

### ✅ TASK 5: Remover Modo MOCK de Produção
**Prioridade:** 🟠 P1 - ALTO
**Tempo:** 30 minutos
**Impacto:** Pagamentos falsos aceitos

**Arquivo:** `src/app/(clinic)/clinic/setup/payment/page.tsx`

**Implementação:**
1. Remover fallback para MOCK_TOKEN
2. Adicionar validação rigorosa de SDK
3. Mostrar erro claro se SDK não carregar

**Validação:**
- [ ] Em produção, MOCK nunca ativa
- [ ] Erro claro se SDK falhar
- [ ] Em dev, MOCK ainda funciona

---

## 🎯 FASE 2: FUNCIONALIDADES ESSENCIAIS (8 horas)

### ✅ TASK 6: Sistema de Email Completo
**Prioridade:** 🔴 P0 - BLOQUEADOR
**Tempo:** 4 horas
**Impacto:** Experiência quebrada sem emails

**Componentes:**
1. Configurar SMTP Secrets (30min)
2. Implementar sendCustomEmail Function (1h)
3. Implementar processEmailQueue Function (1h)
4. Testar envio de emails (30min)
5. Deploy functions (1h)

**Cloud Functions a criar:**
- `functions/src/sendCustomEmail.ts` - Trigger em email_queue
- `functions/src/processEmailQueue.ts` - Scheduled function (fallback)

**Validação:**
- [ ] Email de boas-vindas enviado ao aprovar acesso
- [ ] Email de rejeição enviado ao reprovar
- [ ] Emails aparecem corretamente na caixa de entrada
- [ ] Status atualizado para 'sent' no Firestore

---

### ✅ TASK 7: Corrigir Bug de Licença Duplicada
**Prioridade:** 🟠 P1 - ALTO
**Tempo:** 3 horas
**Impacto:** Métricas incorretas

**Arquivos afetados:**
- `src/app/api/tenants/create/route.ts`
- `src/lib/services/tenantOnboardingService.ts`
- `src/lib/services/licenseService.ts`

**Implementação:**
1. Remover criação de licença em /api/tenants/create
2. Modificar onboarding para verificar licença existente
3. Atualizar ao invés de criar nova
4. Script para limpar licenças duplicadas existentes

**Validação:**
- [ ] Criar nova clínica → 0 licenças criadas
- [ ] Completar onboarding → 1 licença criada
- [ ] Dashboard mostra métricas corretas
- [ ] Sem duplicatas no Firestore

---

### ✅ TASK 8: Implementar TODOs Críticos
**Prioridade:** 🟠 P1 - ALTO
**Tempo:** 1 hora
**Impacto:** Funcionalidades incompletas

**TODOs identificados:**

**8.1 - Email de boas-vindas na aprovação:**
```typescript
// src/app/api/access-requests/[id]/approve/route.ts:176
// TODO: Enviar email de boas-vindas via Cloud Function
```

**8.2 - Email de rejeição:**
```typescript
// src/lib/services/accessRequestService.ts:243
// TODO: Enviar email de rejeição via Cloud Function
```

**8.3 - Notificação de conclusão:**
```typescript
// src/lib/services/solicitacaoService.ts:576
// TODO: Criar notificação de conclusão se necessário
```

**Validação:**
- [ ] Todos os TODOs implementados
- [ ] Emails sendo enviados corretamente
- [ ] Sem comentários TODO em código crítico

---

## 🎯 FASE 3: QUALIDADE E VALIDAÇÕES (4 horas)

### ✅ TASK 9: Validações Server-Side Completas
**Prioridade:** 🟡 P2 - MÉDIO
**Tempo:** 2 horas
**Impacto:** Dados inválidos no banco

**Criar:** `src/lib/validators.ts`

**Validações a implementar:**
1. Email (regex + formato)
2. CPF (validação dígitos verificadores)
3. CNPJ (validação dígitos verificadores)
4. Telefone (formato brasileiro)
5. CEP (formato e existência)
6. Datas (formato e lógica)

**Aplicar em:**
- `/api/access-requests/route.ts`
- `/api/tenants/create/route.ts`
- `/api/users/create/route.ts`

**Validação:**
- [ ] Email inválido rejeitado
- [ ] CPF inválido rejeitado
- [ ] CNPJ inválido rejeitado
- [ ] Dados consistentes no Firestore

---

### ✅ TASK 10: Mensagens de Erro Específicas
**Prioridade:** 🟡 P2 - MÉDIO
**Tempo:** 1 hora
**Impacto:** UX ruim em caso de erro

**Criar:** `src/lib/errorMessages.ts`

**Implementar:**
1. Mapeamento de erros Firebase → mensagens PT-BR
2. Erros de validação específicos
3. Erros de permissão claros
4. Fallback para erros genéricos

**Validação:**
- [ ] Erro de email duplicado → mensagem clara
- [ ] Erro de permissão → mensagem específica
- [ ] Erro de validação → indica campo exato

---

### ✅ TASK 11: Logger Estruturado
**Prioridade:** 🟡 P2 - MÉDIO
**Tempo:** 1 hora
**Impacto:** Debugging difícil

**Criar:** `src/lib/logger.ts`

**Implementação:**
```typescript
// Logger condicional baseado em ambiente
const logger = {
  debug: (msg: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`, data);
    }
  },
  info: (msg: string, data?: any) => {
    console.info(`[INFO] ${msg}`, data);
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${msg}`, data);
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`, error);
    // Em produção, enviar para serviço de monitoring
  }
};
```

**Substituir em:**
- Todos os arquivos com console.log

**Validação:**
- [ ] Debug logs apenas em development
- [ ] Error logs sempre ativos
- [ ] Formato consistente

---

## 🎯 FASE 4: TESTES E VALIDAÇÃO (3 horas)

### ✅ TASK 12: Criar Script de Seed Completo
**Prioridade:** 🟢 P3 - BAIXO
**Tempo:** 1 hora
**Impacto:** Facilita testes

**Criar:** `scripts/seed-complete-demo.js`

**Dados a popular:**
- 1 tenant demo
- 1 licença ativa
- 10 produtos no inventário (variados)
- 5 pacientes
- 3 solicitações em diferentes estados
- 2 alertas de vencimento

**Validação:**
- [ ] Script roda sem erros
- [ ] Dados aparecem no dashboard
- [ ] Alertas funcionam

---

### ✅ TASK 13: Teste Manual Completo
**Prioridade:** 🟠 P1 - ALTO
**Tempo:** 2 horas
**Impacto:** Garantir qualidade

**Fluxos a testar:**

**13.1 - Fluxo de Cadastro e Aprovação (30min):**
- [ ] Registro público
- [ ] Solicitação criada (senha com hash)
- [ ] Admin aprova
- [ ] Email de boas-vindas recebido
- [ ] Login funciona

**13.2 - Fluxo de Inventário (30min):**
- [ ] Adicionar produto manual
- [ ] Editar produto
- [ ] Filtros funcionam
- [ ] Exportar CSV
- [ ] Real-time updates

**13.3 - Fluxo de Pacientes (30min):**
- [ ] Criar paciente
- [ ] Editar paciente
- [ ] Buscar paciente
- [ ] Vincular a solicitação

**13.4 - Fluxo de Solicitações (30min):**
- [ ] Criar solicitação
- [ ] Validação de estoque
- [ ] Aprovar solicitação
- [ ] Concluir procedimento
- [ ] Inventário atualizado

---

## 📊 RESUMO DE ESFORÇO

### Por Fase

| Fase | Tarefas | Horas | Prioridade |
|------|---------|-------|-----------|
| **Fase 1: Segurança** | 5 tasks | 5h | P0 |
| **Fase 2: Funcionalidades** | 3 tasks | 8h | P0-P1 |
| **Fase 3: Qualidade** | 3 tasks | 4h | P2 |
| **Fase 4: Testes** | 2 tasks | 3h | P1-P3 |
| **TOTAL** | **13 tasks** | **20h** | - |

### Por Prioridade

| Prioridade | Tasks | Horas | Status |
|-----------|-------|-------|--------|
| P0 (Crítico) | 6 | 11h | Obrigatório |
| P1 (Alto) | 4 | 6h | Recomendado |
| P2 (Médio) | 3 | 4h | Opcional |

---

## 🗓️ CRONOGRAMA SUGERIDO

### Sprint 1 - Segurança (1-2 dias)
**Foco:** Eliminar riscos críticos
- Day 1 AM: Tasks 1-2 (hash senhas, proteger /debug)
- Day 1 PM: Tasks 3-4 (remover logs, mover credenciais)
- Day 2 AM: Task 5 (remover MOCK)

### Sprint 2 - Funcionalidades (2-3 dias)
**Foco:** Completar features essenciais
- Day 3: Task 6 (sistema de email completo)
- Day 4 AM: Task 7 (corrigir bug licença)
- Day 4 PM: Task 8 (implementar TODOs)

### Sprint 3 - Qualidade (1-2 dias)
**Foco:** Polish e robustez
- Day 5 AM: Tasks 9-10 (validações + mensagens)
- Day 5 PM: Task 11 (logger estruturado)

### Sprint 4 - Validação (1 dia)
**Foco:** Testes e seed
- Day 6 AM: Task 12 (seed completo)
- Day 6 PM: Task 13 (testes manuais)

**Total:** 5-8 dias (depende de dedicação)

---

## 🎯 ORDEM DE EXECUÇÃO RECOMENDADA

### Abordagem 1: "Segurança Primeiro" (Recomendado)
```
1. SEC-01 → SEC-02 → SEC-03 → SEC-04 → SEC-05
2. FEAT-06 → FEAT-07 → FEAT-08
3. QA-09 → QA-10 → QA-11
4. TEST-12 → TEST-13
```

**Vantagem:** Sistema seguro desde o início
**Desvantagem:** Funcionalidades demoram mais

### Abordagem 2: "Funcionalidades Primeiro"
```
1. FEAT-06 → FEAT-07 → FEAT-08
2. SEC-01 → SEC-02 → SEC-03
3. QA-09 → QA-10
4. TEST-13
```

**Vantagem:** Features completas rapidamente
**Desvantagem:** Sistema inseguro durante desenvolvimento

### Abordagem 3: "Balanceada" ⭐ (Melhor)
```
Dia 1: SEC-01, SEC-02 (segurança crítica)
Dia 2: FEAT-06 (email - bloqueador)
Dia 3: FEAT-07 (bug licença - impacto alto)
Dia 4: SEC-03, FEAT-08 (logs + TODOs)
Dia 5: QA-09, QA-10 (validações + erros)
Dia 6: TEST-12, TEST-13 (seed + testes)
```

**Vantagem:** Progresso visível, segurança prioritária
**Desvantagem:** Nenhuma significativa

---

## ✅ CRITÉRIOS DE CONCLUSÃO

### Definition of Done (DoD)

**Para cada task:**
- [ ] Código implementado e testado
- [ ] Validações passando
- [ ] Sem console.logs desnecessários
- [ ] Documentação atualizada (se necessário)
- [ ] Commit com mensagem descritiva

**Para o roadmap completo:**
- [ ] Todas as tasks P0 concluídas
- [ ] Teste manual completo passou
- [ ] Sistema demonstrável sem ressalvas de segurança
- [ ] Documentação de features atualizada
- [ ] README.md atualizado com instruções

---

## 🚀 PRÓXIMOS PASSOS APÓS ROADMAP

**Quando este roadmap estiver completo:**

1. ✅ Sistema pronto para demo com clientes (sem pagamento)
2. ✅ Segurança validada
3. ✅ Funcionalidades essenciais completas
4. ✅ Qualidade de produção

**Então podemos:**
- Agendar demos com clientes potenciais
- Coletar feedback real
- Iterar baseado em uso
- Planejar integração PagBank produção

**Ou partir para:**
- Testes E2E automatizados
- Monitoramento avançado
- Performance optimization
- Documentação de API

---

## 📞 COMUNICAÇÃO

**Status Reports:**
- Diário: Atualizar TodoWrite com progresso
- Semanal: Commit com resumo de tasks concluídas
- Ao concluir: Documento final com checklist

**Bloqueadores:**
- Reportar imediatamente se alguma task não puder ser concluída
- Sugerir alternativas ou workarounds
- Ajustar estimativas se necessário

---

## 🎯 VAMOS COMEÇAR?

**Primeira task a executar:**
```
✅ SEC-01: Implementar hash de senhas com bcrypt
Tempo: 2 horas
Prioridade: 🔴 CRÍTICO

Você está pronto para começar?
```

---

**Criado por:** Claude Code (Anthropic)
**Data:** 22/01/2026
**Versão:** 1.0
**Estimativa total:** 20 horas (5-8 dias)
