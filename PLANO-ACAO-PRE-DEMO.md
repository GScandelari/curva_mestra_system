# 🚀 Plano de Ação Pré-Apresentação - Curva Mestra

**Objetivo:** Preparar o projeto para apresentação aos stakeholders
**Data:** 22/01/2026
**Priorização:** P0 (Crítico) → P1 (Alto) → P2 (Médio)

---

## 📋 TABELA DE PRIORIDADES

| ID | Tarefa | Severidade | Tempo | Impacto | Prioridade |
|----|--------|-----------|-------|---------|-----------|
| **SEC-01** | Remover senhas em plain text | 🔴 CRÍTICO | 2h | Alto | P0 |
| **SEC-02** | Remover/proteger página /debug | 🔴 CRÍTICO | 30min | Alto | P0 |
| **SEC-03** | Remover console.logs sensíveis | 🔴 CRÍTICO | 1h | Alto | P0 |
| **SEC-04** | Mover credenciais para secrets | 🟠 ALTO | 1h | Médio | P1 |
| **BUG-01** | Corrigir licença duplicada | 🟠 ALTO | 4h | Médio | P1 |
| **FEAT-01** | Deploy functions email | 🟠 ALTO | 2h | Alto | P1 |
| **FEAT-02** | Deploy functions PagBank | 🔴 CRÍTICO | 2h | Crítico | P0 |
| **FEAT-03** | Desabilitar modo MOCK | 🟠 ALTO | 2h | Alto | P1 |
| **QA-01** | Adicionar validações server-side | 🟡 MÉDIO | 3h | Médio | P2 |
| **QA-02** | Implementar mensagens de erro | 🟡 MÉDIO | 2h | Baixo | P2 |

---

## 🎯 CENÁRIO 1: Demo Interna (Stakeholders)
**Prazo:** IMEDIATO (2 horas)
**Objetivo:** Sistema pronto para demonstrar visão e roadmap

### Checklist Obrigatório (P0)

#### ✅ SEC-02: Remover/Proteger Página /debug
**Tempo:** 30 minutos
**Arquivo:** `src/app/debug/page.tsx`

**Opção A - Remover (Recomendado para demo):**
```bash
# Renomear para desabilitar
mv src/app/debug/page.tsx src/app/debug/page.tsx.disabled
```

**Opção B - Proteger com autenticação:**
```typescript
// Adicionar no topo do componente
export default async function DebugPage() {
  const user = await getCurrentUser();

  if (!user || !user.customClaims?.is_system_admin) {
    redirect('/');
  }

  // ... resto do código
}
```

**Validação:**
- [ ] Acessar `http://localhost:3000/debug` → Deve retornar 404 ou redirect
- [ ] Build passa sem erros

---

#### ✅ SEC-03: Remover Console.logs Sensíveis
**Tempo:** 1 hora
**Arquivos críticos:**

**1. Payment page (CRÍTICO):**
```typescript
// src/app/(clinic)/clinic/setup/payment/page.tsx

// REMOVER linha 262:
- console.log("[PagSeguro] Token criado:", response.card.token)
+ // Token criado com sucesso

// REMOVER linha 350-370: Todos os console.log de cartão
```

**2. PagBank subscription API:**
```typescript
// src/app/api/pagbank/subscription/route.ts

// REMOVER linha 35:
- card_token: card_token?.substring(0, 10) + "..."
+ // Dados de pagamento recebidos
```

**Comando rápido (comentar todos temporariamente):**
```bash
# Criar backup
cp src/app/(clinic)/clinic/setup/payment/page.tsx src/app/(clinic)/clinic/setup/payment/page.tsx.bak

# Comentar console.logs sensíveis
sed -i 's/console\.log.*token/\/\/ &/' src/app/(clinic)/clinic/setup/payment/page.tsx
```

**Validação:**
- [ ] Abrir DevTools durante teste de pagamento
- [ ] Verificar que tokens não aparecem no console

---

#### ✅ PREP-01: Preparar Dados de Seed
**Tempo:** 1 hora

**Script de preparação:**
```bash
# Criar arquivo de seed
cat > scripts/seed-demo-data.js << 'EOF'
/**
 * Script para popular dados de demo
 * Executar: node scripts/seed-demo-data.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../curva-mestra-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedDemoData() {
  console.log('🌱 Iniciando seed de dados de demo...');

  // 1. Criar tenant demo
  const tenantRef = await db.collection('tenants').add({
    name: 'Clínica Harmonia Demo',
    document_type: 'cnpj',
    document_number: '12.345.678/0001-90',
    cnpj: '12.345.678/0001-90',
    email: 'contato@clinicaharmonia.com',
    phone: '(11) 98765-4321',
    address: 'Rua das Flores, 123',
    city: 'São Paulo',
    state: 'SP',
    cep: '01234-567',
    max_users: 5,
    plan_id: 'anual',
    active: true,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  const tenantId = tenantRef.id;
  console.log('✅ Tenant criado:', tenantId);

  // 2. Criar licença ativa
  await db.collection('licenses').add({
    tenant_id: tenantId,
    plan_id: 'anual',
    max_users: 5,
    status: 'ativa',
    auto_renew: true,
    start_date: new Date(),
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('✅ Licença criada');

  // 3. Criar produtos no inventário
  const produtos = [
    {
      codigo: 3029055,
      nome_produto: 'TORNEIRA DESCARTAVEL 3VIAS LL',
      lote: 'SCTPAB002B',
      quantidade_disponivel: 15,
      quantidade_reservada: 0,
      dt_validade: new Date('2029-06-01'),
      dt_entrada: new Date(),
      valor_unitario: 1.55
    },
    {
      codigo: 3029056,
      nome_produto: 'SERINGA 3ML LUER LOCK',
      lote: 'SERLK003A',
      quantidade_disponivel: 50,
      quantidade_reservada: 5,
      dt_validade: new Date('2028-12-15'),
      dt_entrada: new Date(),
      valor_unitario: 0.85
    },
    {
      codigo: 3029057,
      nome_produto: 'AGULHA 30G x 13MM',
      lote: 'AG30G004',
      quantidade_disponivel: 100,
      quantidade_reservada: 0,
      dt_validade: new Date('2027-08-20'),
      dt_entrada: new Date(),
      valor_unitario: 0.45
    },
    {
      codigo: 3029058,
      nome_produto: 'LUVA PROCEDIMENTO M',
      lote: 'LUVM005B',
      quantidade_disponivel: 8,
      quantidade_reservada: 2,
      dt_validade: new Date('2026-03-10'),
      dt_entrada: new Date(),
      valor_unitario: 12.50
    }
  ];

  for (const produto of produtos) {
    await db.collection('inventory').add({
      tenant_id: tenantId,
      ...produto,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  console.log(`✅ ${produtos.length} produtos adicionados ao inventário`);

  // 4. Criar pacientes
  const pacientes = [
    {
      nome_completo: 'Maria Silva Santos',
      cpf: '123.456.789-00',
      data_nascimento: '1985-05-15',
      telefone: '(11) 91234-5678',
      email: 'maria.silva@email.com'
    },
    {
      nome_completo: 'João Pedro Oliveira',
      cpf: '987.654.321-00',
      data_nascimento: '1990-08-22',
      telefone: '(11) 98765-4321',
      email: 'joao.pedro@email.com'
    }
  ];

  for (const paciente of pacientes) {
    await db.collection('patients').add({
      tenant_id: tenantId,
      ...paciente,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  console.log(`✅ ${pacientes.length} pacientes criados`);

  console.log('\n🎉 Seed de dados de demo concluído!');
  console.log(`\nTenant ID: ${tenantId}`);
  console.log('Credenciais para teste serão criadas via Firebase Console');
}

seedDemoData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
EOF

# Executar seed
node scripts/seed-demo-data.js
```

**Validação:**
- [ ] Tenant criado no Firestore
- [ ] Licença ativa visível
- [ ] 4 produtos no inventário
- [ ] 2 pacientes criados

---

#### ✅ PREP-02: Criar Usuário de Teste
**Tempo:** 15 minutos

**Via Firebase Console:**
1. Acessar: https://console.firebase.google.com/project/curva-mestra/authentication
2. Criar usuário:
   - Email: `demo@curvamestra.com`
   - Senha: `Demo2026!`
   - Email verificado: ✅
3. Editar Custom Claims (via Firebase CLI):

```bash
# Obter UID do usuário criado
firebase auth:export users.json --project curva-mestra
cat users.json | grep demo@curvamestra.com

# Definir claims (substituir USER_UID)
node << EOF
const admin = require('firebase-admin');
const serviceAccount = require('./curva-mestra-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.auth().setCustomUserClaims('USER_UID', {
  tenant_id: 'TENANT_ID_DO_SEED',
  role: 'clinic_admin',
  is_system_admin: false,
  active: true
}).then(() => {
  console.log('✅ Claims definidos');
  process.exit(0);
});
EOF
```

4. Criar documento em `users` collection:
```javascript
// Via Firestore Console
{
  tenant_id: "TENANT_ID_DO_SEED",
  email: "demo@curvamestra.com",
  full_name: "Usuário Demo",
  role: "clinic_admin",
  active: true,
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
}
```

**Validação:**
- [ ] Login com demo@curvamestra.com funciona
- [ ] Dashboard carrega com dados
- [ ] Inventário mostra 4 produtos

---

### Checklist de Validação Final (P0)

**Teste de Demo Completo (30 minutos):**

1. **Login e Dashboard**
   - [ ] Login com usuário demo funciona
   - [ ] Dashboard mostra 6 cards com dados corretos
   - [ ] Métricas em tempo real funcionam

2. **Inventário**
   - [ ] Lista mostra 4 produtos
   - [ ] Filtros funcionam (todos, vencendo, estoque baixo)
   - [ ] Detalhes do produto abrem corretamente

3. **Pacientes**
   - [ ] Lista mostra 2 pacientes
   - [ ] Criar novo paciente funciona
   - [ ] Editar paciente funciona

4. **Solicitações**
   - [ ] Criar nova solicitação funciona
   - [ ] Lista de produtos disponíveis carrega
   - [ ] Validação de estoque funciona

5. **Alertas e Relatórios**
   - [ ] Alertas mostram produtos vencendo
   - [ ] Exportar CSV funciona
   - [ ] Dados do CSV estão corretos

**Problemas Conhecidos para Documentar:**
- ❌ NÃO clicar em "Confirmar Pagamento" durante onboarding
- ❌ NÃO esperar emails automáticos (não enviados)
- ❌ NÃO tentar importar DANFE (funcionalidade desabilitada)

---

## 🚀 CENÁRIO 2: Demo com Clientes
**Prazo:** 1 SEMANA (22 horas)
**Objetivo:** Sistema funcional end-to-end para clientes reais

### Fase 1: Correções de Segurança (P0 - 6 horas)

#### SEC-01: Hash de Senhas com bcrypt
**Tempo:** 2 horas
**Arquivo:** `src/app/api/access-requests/route.ts`

**Implementação:**
```typescript
// Adicionar dependência
npm install bcryptjs
npm install --save-dev @types/bcryptjs

// Atualizar route.ts
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Salvar hash ao invés de senha
    await db.collection("access_requests").add({
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      cpf: data.cpf,
      company_name: data.company_name,
      cnpj: data.cnpj,
      password_hash: passwordHash, // ✅ HASH ao invés de plain text
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });

    // ... resto do código
  } catch (error) {
    // ... tratamento
  }
}
```

**Atualizar aprovação:**
```typescript
// src/app/api/access-requests/[id]/approve/route.ts

// Ao aprovar, buscar hash
const accessRequest = await db.collection("access_requests").doc(id).get();
const passwordHash = accessRequest.data()?.password_hash;

// Criar usuário com senha gerada (enviar por email)
const tempPassword = generateSecurePassword(); // Implementar função
const userRecord = await auth.createUser({
  email: accessRequest.data()?.email,
  password: tempPassword,
  // ...
});

// TODO: Enviar tempPassword por email
```

**Validação:**
- [ ] Nova solicitação salva apenas hash
- [ ] Hash bcrypt é válido (60 caracteres iniciando com $2)
- [ ] Senha original não aparece no Firestore

---

#### SEC-04: Mover Credenciais para Secrets
**Tempo:** 1 hora

**Firebase Secrets (Cloud Functions):**
```bash
# Configurar secrets PagBank
firebase functions:secrets:set PAGBANK_EMAIL_PROD
# Colar: producao@curvamestra.com.br

firebase functions:secrets:set PAGBANK_TOKEN_PROD
# Colar: token de produção quando obtido

# Configurar SMTP
firebase functions:secrets:set SMTP_USER
# Colar: smtp@curvamestra.com.br

firebase functions:secrets:set SMTP_PASS
# Colar: senha SMTP
```

**Atualizar functions:**
```typescript
// functions/src/index.ts
import { defineSecret } from 'firebase-functions/params';

const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');
const pagbankEmailProd = defineSecret('PAGBANK_EMAIL_PROD');
const pagbankTokenProd = defineSecret('PAGBANK_TOKEN_PROD');

export const sendCustomEmail = onDocumentCreated(
  {
    document: 'email_queue/{emailId}',
    secrets: [smtpUser, smtpPass]
  },
  async (event) => {
    const user = smtpUser.value();
    const pass = smtpPass.value();
    // ...
  }
);
```

**Remover do .env.local:**
```bash
# DELETAR linhas sensíveis (mover para .env.local.example)
sed -i '/PAGBANK_/d' .env.local
sed -i '/SMTP_/d' .env.local
```

**Validação:**
- [ ] Secrets listados: `firebase functions:secrets:access --list`
- [ ] .env.local não contém credenciais
- [ ] .gitignore ignora .env.local

---

### Fase 2: Deploy de Functions (P0 - 4 horas)

#### FEAT-02: Deploy Functions PagBank
**Tempo:** 2 horas

**Preparação:**
```typescript
// functions/src/index.ts

// DESCOMENTAR exports (se comentados)
export { createPagBankSubscription } from './createPagBankSubscription';
export { pagbankWebhook } from './pagbankWebhook';
```

**Configurar região e runtime:**
```typescript
// functions/src/createPagBankSubscription.ts
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const pagbankEmail = defineSecret('PAGBANK_EMAIL_PROD');
const pagbankToken = defineSecret('PAGBANK_TOKEN_PROD');

export const createPagBankSubscription = onCall(
  {
    region: 'southamerica-east1',
    secrets: [pagbankEmail, pagbankToken],
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  async (request) => {
    // ... implementação existente
    const email = pagbankEmail.value();
    const token = pagbankToken.value();
    // ...
  }
);
```

**Deploy:**
```bash
# Build
cd functions && npm run build

# Deploy apenas PagBank functions
firebase deploy --only functions:createPagBankSubscription,functions:pagbankWebhook
```

**Validação:**
- [ ] Functions aparece em: https://console.firebase.google.com/project/curva-mestra/functions
- [ ] URL da function está ativa
- [ ] Logs não mostram erros de inicialização

---

#### FEAT-01: Deploy Functions Email
**Tempo:** 2 horas

**Implementação completa:**
```typescript
// functions/src/sendCustomEmail.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import nodemailer from 'nodemailer';

const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');

export const sendCustomEmail = onDocumentCreated(
  {
    document: 'email_queue/{emailId}',
    region: 'southamerica-east1',
    secrets: [smtpUser, smtpPass]
  },
  async (event) => {
    const data = event.data?.data();

    if (!data || data.status !== 'pending') {
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser.value(),
        pass: smtpPass.value()
      }
    });

    try {
      await transporter.sendMail({
        from: `"Curva Mestra" <${smtpUser.value()}>`,
        to: data.to,
        subject: data.subject,
        html: data.body
      });

      // Marcar como enviado
      await event.data?.ref.update({
        status: 'sent',
        sent_at: new Date()
      });

      console.log('✅ Email enviado para:', data.to);
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);

      await event.data?.ref.update({
        status: 'error',
        error_message: String(error),
        error_at: new Date()
      });
    }
  }
);
```

**Deploy:**
```bash
firebase deploy --only functions:sendCustomEmail
```

**Validação:**
- [ ] Function deployada com sucesso
- [ ] Adicionar documento em `email_queue` collection manualmente
- [ ] Verificar email recebido na caixa de entrada
- [ ] Documento marcado como `status: 'sent'`

---

### Fase 3: Correções de Funcionalidades (P1 - 8 horas)

#### BUG-01: Corrigir Licença Duplicada
**Tempo:** 4 horas
**Documentação:** `PROBLEMA-LICENCA-DUPLICADA.md`

**Solução Recomendada (Opção 2):**

```typescript
// src/lib/services/tenantOnboardingService.ts

async function activateLicenseAfterPayment(
  tenantId: string,
  subscriptionCode: string
): Promise<void> {
  // 1. Buscar licença existente
  const licensesSnapshot = await db
    .collection('licenses')
    .where('tenant_id', '==', tenantId)
    .where('status', '==', 'ativa')
    .get();

  if (!licensesSnapshot.empty) {
    // ✅ Licença já existe - apenas atualizar
    const licenseDoc = licensesSnapshot.docs[0];

    await db.collection('licenses').doc(licenseDoc.id).update({
      subscription_code: subscriptionCode,
      payment_confirmed_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    console.log('✅ Licença existente atualizada:', licenseDoc.id);
  } else {
    // ❌ Licença não existe (caso raro) - criar nova
    await createLicense({
      tenant_id: tenantId,
      subscription_code: subscriptionCode,
      // ... resto dos dados
    });

    console.warn('⚠️ Licença criada durante onboarding (não deveria acontecer)');
  }
}
```

**Remover criação duplicada:**
```typescript
// src/app/api/tenants/create/route.ts

// COMENTAR bloco de criação de licença (linhas ~129-145)
/*
try {
  await db.collection("licenses").add({
    tenant_id: tenantId,
    plan_id: data.plan_id,
    // ... NÃO CRIAR AQUI
  });
} catch (licenseError) {
  // ...
}
*/

// ✅ Licença será criada apenas no onboarding após pagamento
```

**Validação:**
- [ ] Criar nova clínica
- [ ] Completar onboarding
- [ ] Verificar que existe apenas 1 licença no Firestore
- [ ] Dashboard mostra métricas corretas

---

#### FEAT-03: Desabilitar Modo MOCK
**Tempo:** 2 horas

**Implementação:**
```typescript
// src/app/(clinic)/clinic/setup/payment/page.tsx

// Adicionar verificação rigorosa de ambiente
const isProduction = process.env.NODE_ENV === 'production';
const PAGSEGURO_SDK_URL = isProduction
  ? 'https://stc.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js'
  : 'https://stc.sandbox.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js';

// REMOVER modo MOCK completamente
const handleCardTokenization = async () => {
  try {
    if (typeof PagSeguroDirectPayment === 'undefined') {
      // ❌ NÃO permitir MOCK em produção
      if (isProduction) {
        throw new Error('SDK do PagSeguro não carregou. Tente novamente.');
      }

      // ⚠️ Apenas em desenvolvimento
      console.warn('[DEV] SDK não disponível - usando modo MOCK');
      cardToken = `MOCK_TOKEN_${Date.now()}`;
    } else {
      // ✅ Tokenização real
      PagSeguroDirectPayment.createCardToken({
        // ...
      });
    }
  } catch (error) {
    // Mostrar erro claro para o usuário
    setError('Erro ao processar cartão. Verifique os dados e tente novamente.');
  }
};
```

**Validação:**
- [ ] Em produção, modo MOCK não ativa nunca
- [ ] Erro claro se SDK não carregar
- [ ] Em dev, MOCK ainda funciona para testes

---

### Fase 4: Testes E2E (P1 - 4 horas)

#### QA-E2E: Teste Fluxo Completo
**Tempo:** 4 horas

**Checklist de Teste:**

**1. Fluxo de Cadastro (1h):**
- [ ] Registro público funciona
- [ ] Solicitação criada no Firestore (com hash de senha)
- [ ] Email de confirmação NÃO enviado ainda (esperado)

**2. Fluxo de Aprovação (1h):**
- [ ] Admin vê solicitação pendente
- [ ] Aprovar solicitação funciona
- [ ] Usuário recebe email de boas-vindas
- [ ] Custom claims definidos corretamente
- [ ] Login com novo usuário funciona

**3. Fluxo de Onboarding (1h):**
- [ ] Seleção de plano funciona
- [ ] Aceitação de termos funciona
- [ ] Formulário de pagamento carrega SDK correto
- [ ] Tokenização de cartão funciona (sandbox ainda)
- [ ] Assinatura criada via Cloud Function
- [ ] Licença ativada (apenas 1 criada, não duplicada)
- [ ] Redirect para success page

**4. Fluxo Operacional (1h):**
- [ ] Dashboard carrega com dados corretos
- [ ] Adicionar produto ao inventário funciona
- [ ] Criar paciente funciona
- [ ] Criar solicitação funciona
- [ ] Alertas aparecem corretamente
- [ ] Exportar relatório funciona

---

## 📊 RESUMO DE ESFORÇO

### Por Cenário

| Cenário | Horas | Tarefas | Impacto |
|---------|-------|---------|---------|
| **Demo Interna** | 2h | 3 tarefas P0 | Sistema demonstrável |
| **Demo Clientes** | 22h | 9 tarefas P0-P1 | Sistema funcional |
| **Produção** | 54h | 15+ tarefas | Sistema completo |

### Por Prioridade

| Prioridade | Tarefas | Horas | Status |
|-----------|---------|-------|--------|
| **P0 (Crítico)** | 6 tarefas | 10h | Obrigatório |
| **P1 (Alto)** | 5 tarefas | 12h | Recomendado |
| **P2 (Médio)** | 4 tarefas | 8h | Opcional |

---

## 🎯 DECISÃO HOJE

**Qual é o objetivo da apresentação?**

**Opção 1:** Validar visão com stakeholders internos
→ ✅ **Executar apenas Cenário 1** (2 horas)

**Opção 2:** Demonstrar para clientes potenciais
→ ⚠️ **Executar Cenário 1 + 2** (24 horas total)

**Opção 3:** Lançar sistema em produção
→ ❌ **Executar todos os cenários** (56 horas total + 1-3 dias)

---

## 📞 PRÓXIMOS PASSOS IMEDIATOS

1. **Definir objetivo** da apresentação
2. **Escolher cenário** apropriado
3. **Priorizar tarefas** do cenário escolhido
4. **Executar checklist** passo a passo
5. **Validar testes** antes de apresentar

**Documentação criada:** ✅
**Plano de ação:** ✅
**Aguardando decisão:** ⏳

---

**Preparado por:** Claude Code (Anthropic)
**Data:** 22/01/2026
**Versão:** 1.0
