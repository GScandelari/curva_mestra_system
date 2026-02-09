# Documentação Experimental - Pagamento (Onboarding)

**Sistema:** Curva Mestra - Multi-Tenant SaaS para Clínicas de Harmonização
**Módulo:** Clinic (Onboarding)
**Componente:** Setup - Pagamento via PagSeguro
**Versão:** 2.0
**Data:** 09/02/2026
**Tipo:** Engenharia Reversa

---

## 1. Visão Geral

Página de pagamento para finalização da assinatura durante o onboarding da clínica. Integra com o SDK do PagSeguro (PagSeguroDirectPayment) para tokenização de cartão de crédito no ambiente Sandbox, com fallback automático para modo MOCK em desenvolvimento. Após tokenização, chama a Cloud Function `createPagBankSubscription` para processar a assinatura recorrente. É a quarta etapa do onboarding (após seleção de plano).

### 1.1 Localização
- **Arquivo:** `src/app/(clinic)/clinic/setup/payment/page.tsx`
- **Rota:** `/clinic/setup/payment`
- **Layout:** Onboarding Layout (sem sidebar, fundo gradiente azul-índigo)

### 1.2 Dependências Principais
- **useAuth:** Hook de autenticação — obtém `claims.tenant_id` e `user`
- **tenantOnboardingService:** `confirmPayment()` e `getTenantOnboarding()` — persiste confirmação de pagamento no Firestore
- **PLANS (constants/plans):** Configuração dos planos (preço, nome, descrição)
- **Firebase Functions:** `httpsCallable` para chamar `createPagBankSubscription`
- **next/script:** Carregamento assíncrono do SDK PagSeguro (Sandbox)
- **firebase/firestore:** `Timestamp` para registrar data do pagamento
- **Shadcn/ui:** Card, Alert, Badge, Input, Label, Button
- **Lucide Icons:** CreditCard, CheckCircle2, AlertCircle, Loader2

---

## 2. Tipos de Usuários / Atores

### 2.1 clinic_admin
- **Descrição:** Administrador da clínica em processo de onboarding
- **Acesso:** Único ator com acesso a esta página
- **Comportamento:** Visualiza resumo da assinatura, preenche dados do cartão e titular, confirma pagamento
- **Restrições:** Deve ter completado setup e selecionado plano para acessar

### 2.2 Outros Roles
- **Descrição:** clinic_user, clinic_consultant, system_admin
- **Acesso:** Sem acesso direto a esta página
- **Comportamento:** N/A — página exclusiva do fluxo de onboarding
- **Restrições:** Controle pelo fluxo de onboarding

---

## 3. Estrutura de Dados

### 3.1 TenantOnboarding (leitura)

```typescript
interface TenantOnboarding {
  tenant_id: string;
  status: OnboardingStatus;
  setup_completed: boolean;
  plan_selected: boolean;
  payment_confirmed: boolean;
  selected_plan_id?: "semestral" | "anual";
  payment_data?: PaymentData;
  // ...timestamps
}
```

### 3.2 PaymentData (escrita via confirmPayment)

```typescript
interface PaymentData {
  provider: "pagseguro" | "mock";
  subscription_id?: string;
  transaction_id?: string;
  payment_status: PaymentStatus;  // "approved" após sucesso
  amount: number;
  payment_date?: Timestamp;
  // ...outros campos
}
```

### 3.3 Estado Local do Formulário

| Campo | Tipo | Máscara | maxLength |
|-------|------|---------|-----------|
| cardNumber | string | `XXXX XXXX XXXX XXXX` | 19 |
| cardHolder | string | Uppercase automático | — |
| cardExpiry | string | `MM/AA` | 5 |
| cardCvv | string (password) | Somente dígitos | 4 |
| holderCpf | string | `XXX.XXX.XXX-XX` | 14 |
| holderBirthDate | string | `DD/MM/AAAA` | 10 |
| holderPhone | string | `(XX) XXXXX-XXXX` | 15 |

### 3.4 Payload para Cloud Function

```typescript
{
  tenant_id: string;
  plan_id: "semestral" | "anual";
  card_token: string;        // Token PagSeguro ou MOCK_TOKEN_{timestamp}
  holder_name: string;
  holder_birth_date: string;
  holder_cpf: string;
  holder_phone: string;
}
```

**Campos Principais:**
- **card_token:** Gerado pelo SDK PagSeguro (`createCardToken`) ou mock (`MOCK_TOKEN_${Date.now()}`)
- **payment_status:** Registrado como `"approved"` após retorno de `subscription_code` da Cloud Function
- **provider:** Sempre `"pagseguro"` no `confirmPayment()`

---

## 4. Casos de Uso

### 4.1 UC-001: Visualizar Resumo da Assinatura

**Ator:** clinic_admin
**Pré-condições:**
- Usuário autenticado com `tenant_id`
- Setup completado e plano selecionado
- Pagamento ainda não confirmado

**Fluxo Principal:**
1. Usuário acessa `/clinic/setup/payment`
2. Sistema verifica onboarding e recupera `selected_plan_id`
3. Sistema carrega SDK PagSeguro via `next/script`
4. Exibe card "Resumo da Assinatura" com nome do plano, compromisso, valor mensal
5. Exibe seções informativas: "Como funciona o pagamento" e "Primeira cobrança"

**Pós-condições:**
- Formulário de cartão e titular prontos para preenchimento

---

### 4.2 UC-002: Preencher Dados do Cartão

**Ator:** clinic_admin
**Pré-condições:**
- Página carregada com plano identificado

**Fluxo Principal:**
1. Usuário preenche número do cartão (máscara automática `XXXX XXXX XXXX XXXX`)
2. Preenche nome do titular (uppercase automático)
3. Preenche validade (máscara `MM/AA`)
4. Preenche CVV (campo password, somente dígitos)
5. Preenche CPF do titular (máscara `XXX.XXX.XXX-XX`)
6. Preenche data de nascimento (máscara `DD/MM/AAAA`)
7. Preenche telefone (máscara `(XX) XXXXX-XXXX`)

**Pós-condições:**
- Todos os campos preenchidos, botão "Confirmar e Ativar Assinatura" habilitado

---

### 4.3 UC-003: Confirmar Pagamento

**Ator:** clinic_admin
**Pré-condições:**
- Todos os campos preenchidos
- SDK PagSeguro carregado (ou modo MOCK ativo)

**Fluxo Principal:**
1. Usuário clica "Confirmar e Ativar Assinatura"
2. Sistema valida campos obrigatórios
3. Se SDK PagSeguro disponível:
   a. Obtém bandeira do cartão via `getBrand()` (fallback: `detectCardBrand()` local)
   b. Cria token via `createCardToken()` com número, bandeira, CVV, validade
4. Se SDK indisponível: gera `MOCK_TOKEN_{timestamp}`
5. Chama Cloud Function `createPagBankSubscription` via `httpsCallable`
6. Se resposta contém `subscription_code`:
   a. Chama `confirmPayment()` com provider "pagseguro", status "approved", transaction_id
   b. Redireciona para `/clinic/setup/success`
7. Se resposta não contém `subscription_code`: exibe erro

**Fluxo Alternativo 1 — Erro de Tokenização:**
1. `createCardToken` falha → rejeita Promise com mensagem de erro
2. Exibe erro no Alert

**Fluxo Alternativo 2 — Erro na Cloud Function:**
1. `createPagBankSubscription` lança exceção
2. Exibe mensagem de erro no Alert

**Pós-condições:**
- `tenant_onboarding.payment_confirmed = true`
- `tenant_onboarding.status = "completed"`
- Licença criada/atualizada via `confirmPayment()` (no service)
- Tenant ativado (`active: true`)
- Navegação para `/clinic/setup/success`

---

### 4.4 UC-004: Redirecionamento por Status

**Ator:** clinic_admin
**Pré-condições:**
- Usuário acessa `/clinic/setup/payment` diretamente

**Fluxo Principal:**
1. Se `setup_completed == false` → redireciona para `/clinic/setup`
2. Se `plan_selected == false` ou sem `selected_plan_id` → redireciona para `/clinic/setup/plan`
3. Se `payment_confirmed == true` → redireciona para `/clinic/setup/success`

**Pós-condições:**
- Usuário na etapa correta do onboarding

---

## 5. Fluxo de Processo Detalhado

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAGAMENTO (ONBOARDING)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ checkOnboarding  │
                    │ Status()         │
                    └──────────────────┘
                         │    │    │
            setup_completed? plan_selected? payment_confirmed?
                 │         │         │
            NÃO  │    NÃO  │    SIM  │
                 ▼         ▼         ▼
         /clinic/   /clinic/    /clinic/
         setup      setup/plan  setup/success
                         │
                    OK   │
                         ▼
              ┌──────────────────────┐
              │ Exibe resumo do      │
              │ plano + formulários  │
              └──────────────────────┘
                         │
                         ▼ (Script load)
              ┌──────────────────────┐
              │ SDK PagSeguro        │
              │ carregado?           │
              └──────────────────────┘
                    │           │
               SIM  │      NÃO │
                    ▼           ▼
          ┌──────────────┐  ┌──────────────┐
          │ initPagSeguro│  │ Modo MOCK    │
          │ (session)    │  │ ativado      │
          └──────────────┘  └──────────────┘
                    │           │
                    └─────┬─────┘
                          ▼
              ┌──────────────────────┐
              │ Usuário preenche     │
              │ dados do cartão +    │
              │ titular              │
              └──────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │ handlePayment()      │
              └──────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │ SDK disponível?      │
              └──────────────────────┘
                    │           │
               SIM  │      NÃO │
                    ▼           ▼
          ┌──────────────┐  ┌──────────────┐
          │ getBrand() + │  │ MOCK_TOKEN_  │
          │ createCard   │  │ {timestamp}  │
          │ Token()      │  │              │
          └──────────────┘  └──────────────┘
                    │           │
                    └─────┬─────┘
                          ▼
              ┌──────────────────────┐
              │ Cloud Function       │
              │ createPagBank        │
              │ Subscription()       │
              └──────────────────────┘
                    │           │
          success   │     error │
                    ▼           ▼
          ┌──────────────┐  ┌──────────────┐
          │ confirmPayment│  │ Alert com    │
          │ () + redirect │  │ mensagem de  │
          │ /success      │  │ erro         │
          └──────────────┘  └──────────────┘
```

---

## 6. Regras de Negócio

### RN-001: Pré-requisitos de Onboarding
**Descrição:** O acesso ao pagamento requer setup completado e plano selecionado.
**Aplicação:** No `checkOnboardingStatus()` — verifica `setup_completed`, `plan_selected`, e `selected_plan_id`.
**Exceções:** Nenhuma.
**Justificativa:** Garantir que os dados necessários existam antes do pagamento.

### RN-002: Redirecionamento se Pagamento Já Confirmado
**Descrição:** Se o pagamento já foi confirmado (`payment_confirmed == true`), redireciona para `/clinic/setup/success`.
**Aplicação:** No `checkOnboardingStatus()`.
**Exceções:** Nenhuma.
**Justificativa:** Evitar cobrança duplicada.

### RN-003: SDK PagSeguro com Fallback MOCK
**Descrição:** O SDK PagSeguro é carregado via `next/script` (Sandbox). Se falhar, o sistema opera em modo MOCK gerando tokens simulados.
**Aplicação:** No `onLoad`/`onError` do Script e na `initPagSeguro()`.
**Exceções:** Em produção, o modo MOCK não deve estar ativo.
**Justificativa:** Permitir desenvolvimento e testes sem dependência do SDK PagSeguro.

### RN-004: Detecção de Bandeira do Cartão
**Descrição:** A bandeira é detectada pelos primeiros 6 dígitos (BIN) via API PagSeguro (`getBrand`). Caso falhe, usa função local `detectCardBrand()`.
**Aplicação:** No `handlePayment()` antes da tokenização.
**Exceções:** Se nenhuma bandeira for reconhecida, o default é "visa".
**Justificativa:** O token do cartão requer a bandeira como parâmetro.

### RN-005: Tokenização de Cartão
**Descrição:** Os dados do cartão são tokenizados localmente pelo SDK PagSeguro (`createCardToken`), nunca transitando pelo backend da aplicação.
**Aplicação:** No `handlePayment()`.
**Exceções:** Modo MOCK gera `MOCK_TOKEN_{timestamp}`.
**Justificativa:** Conformidade PCI-DSS — dados do cartão não passam pelo servidor.

### RN-006: Processamento via Cloud Function
**Descrição:** A assinatura é processada pela Cloud Function `createPagBankSubscription`, que recebe o token do cartão e dados do titular.
**Aplicação:** Após tokenização, via `httpsCallable(functions, "createPagBankSubscription")`.
**Exceções:** Nenhuma.
**Justificativa:** Separação de responsabilidades; o processamento financeiro ocorre no backend.

### RN-007: Confirmação de Pagamento
**Descrição:** Após resposta com `subscription_code`, o service `confirmPayment()` atualiza onboarding para "completed", cria/atualiza licença e ativa o tenant.
**Aplicação:** No `handlePayment()` após resposta da Cloud Function.
**Exceções:** Se `subscription_code` ausente, exibe erro sem confirmar.
**Justificativa:** Garantir que apenas pagamentos aprovados ativem a conta.

### RN-008: Cobrança Recorrente
**Descrição:** O pagamento é mensal recorrente. A primeira cobrança é no valor do plano, e as próximas são no mesmo dia de cada mês.
**Aplicação:** Exibido nas seções informativas do resumo.
**Exceções:** Cancelamento após período de compromisso sem multa.
**Justificativa:** Modelo SaaS com assinatura recorrente.

---

## 7. Estados da Interface

### 7.1 Estado: Carregando
**Quando:** Durante `checkOnboardingStatus()` (`loading == true`).
**Exibição:** Tela centralizada com Loader2 animado + "Carregando...".
**Interações:** Nenhuma — tela de loading full-screen.

### 7.2 Estado: Plano Não Encontrado
**Quando:** `planId == null` após carregamento.
**Exibição:** Alert `variant="destructive"` com ícone AlertCircle e mensagem "Erro ao carregar informações do plano".
**Interações:** Nenhuma — requer voltar manualmente.

### 7.3 Estado: Pronto para Preenchimento
**Quando:** Plano carregado, Script PagSeguro carregado ou modo MOCK ativo.
**Exibição:**
- Card "Resumo da Assinatura" com nome, compromisso, valor mensal
- Box amarelo "Como funciona o pagamento" (4 itens)
- Box verde "Primeira cobrança" com valor e dia de cobrança
- Card "Dados do Cartão" (4 campos)
- Card "Dados do Titular" (3 campos)
- Botão "Confirmar e Ativar Assinatura" habilitado

### 7.4 Estado: Script Carregando
**Quando:** SDK PagSeguro ainda não carregou (`scriptLoaded == false`).
**Exibição:** Botão desabilitado com Loader2 + "Carregando sistema de pagamento...".

### 7.5 Estado: Processando Pagamento
**Quando:** Após clicar "Confirmar" (`processing == true`).
**Exibição:** Botão com Loader2 animado + "Processando Pagamento...", desabilitado.
**Interações:** Todas as interações bloqueadas.

### 7.6 Estado: Erro
**Quando:** Falha em validação, tokenização ou Cloud Function.
**Exibição:** Alert `variant="destructive"` com ícone AlertCircle e mensagem de erro.
**Mensagens possíveis:**
- "Erro: Dados incompletos"
- "Preencha todos os dados do cartão"
- "Preencha todos os dados do titular"
- "Erro ao processar cartão"
- "Pagamento recusado. Verifique os dados e tente novamente."
- "Erro ao processar pagamento"

---

## 8. Validações

### 8.1 Validações de Frontend
- **cardNumber:** Obrigatório, máscara remove não-dígitos, formatação `XXXX XXXX XXXX XXXX`
- **cardHolder:** Obrigatório, uppercase automático (`toUpperCase()`)
- **cardExpiry:** Obrigatório, máscara `MM/AA`, maxLength 5
- **cardCvv:** Obrigatório, somente dígitos (`replace(/\D/g, "")`), maxLength 4, tipo password
- **holderCpf:** Obrigatório, máscara `XXX.XXX.XXX-XX`, maxLength 14
- **holderBirthDate:** Obrigatório, máscara `DD/MM/AAAA`, maxLength 10, inputMode numeric
- **holderPhone:** Obrigatório, máscara `(XX) XXXXX-XXXX`, maxLength 15

### 8.2 Validações de Backend (handlePayment)
- **tenantId e planId:** Devem existir antes do processamento
- **Campos do cartão:** Todos os 4 campos devem estar preenchidos (verificação booleana simples)
- **Campos do titular:** Todos os 3 campos devem estar preenchidos

### 8.3 Validações de Permissão
- **Onboarding status:** `setup_completed == true` e `plan_selected == true` e `payment_confirmed == false`
- **Sem verificação de role:** Não há checagem explícita de `clinic_admin`

### 8.4 Validações Ausentes
- ⚠️ Sem validação de CPF (dígitos verificadores)
- ⚠️ Sem validação de data de nascimento (formato/validade)
- ⚠️ Sem validação de número de cartão (Luhn algorithm)
- ⚠️ Sem validação de validade expirada do cartão

---

## 9. Integrações

### 9.1 PagSeguro SDK (Sandbox)
- **Tipo:** SDK JavaScript externo
- **URL:** `https://stc.sandbox.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js`
- **Carregamento:** Via `next/script` com strategy `afterInteractive`
- **Métodos utilizados:**
  - `setSessionId(sessionId)` — configura sessão
  - `getBrand({ cardBin })` — detecta bandeira pelo BIN
  - `createCardToken({ cardNumber, brand, cvv, expirationMonth, expirationYear })` — tokeniza cartão
- **Fallback:** Modo MOCK com tokens simulados

### 9.2 API Route — Session PagSeguro
- **Rota:** `/api/pagseguro/session`
- **Método:** GET
- **Retorno:** `{ sessionId: string }`
- **Quando:** Após Script carregar, na `initPagSeguro()`
- **Fallback:** Se falhar, `sessionId = "MOCK_SESSION"`

### 9.3 Cloud Function — createPagBankSubscription
- **Função:** `createPagBankSubscription`
- **Chamada:** `httpsCallable(functions, "createPagBankSubscription")`
- **Payload:** `{ tenant_id, plan_id, card_token, holder_name, holder_birth_date, holder_cpf, holder_phone }`
- **Resposta esperada:** `{ subscription_code: string }` (sucesso) ou `{ error: string }` (falha)

### 9.4 Firestore — tenant_onboarding
- **Coleção:** `tenant_onboarding`
- **Documento:** `{tenantId}`
- **Operações:** Read (checkOnboardingStatus), Update (confirmPayment)
- **Campos escritos:** `payment_confirmed: true`, `status: "completed"`, `payment_data: { provider, payment_status, transaction_id, payment_date }`, `completed_at`

### 9.5 Firestore — licenses (via confirmPayment service)
- **Coleção:** `licenses`
- **Operações:** Create ou Update (dentro de `confirmPayment` no service)
- **Campos:** `plan_id`, `start_date`, `end_date`, `max_users`, `features`, `auto_renew: true`, `status: "ativa"`

### 9.6 Firestore — tenants (via confirmPayment service)
- **Coleção:** `tenants`
- **Operações:** Update (`active: true`)

---

## 10. Segurança

### 10.1 Proteções Implementadas
- ✅ Tokenização PCI-DSS via SDK PagSeguro (dados do cartão não transitam pelo backend)
- ✅ Campo CVV com `type="password"` (mascarado na tela)
- ✅ Verificação de `tenantId` e `planId` antes do processamento
- ✅ Botão desabilitado durante processamento (previne duplo clique)
- ✅ Processamento financeiro via Cloud Function (não no frontend)
- ✅ Declaração de tipo global `Window.PagSeguroDirectPayment` para compatibilidade TypeScript

### 10.2 Vulnerabilidades Conhecidas
- ⚠️ Sem verificação de role `clinic_admin` no componente
- ⚠️ Modo MOCK ativo em desenvolvimento pode vazar para produção se não configurado corretamente
- ⚠️ Links de "Termos de Uso" e "Política de Privacidade" apontam para `href="#"` (sem destino real)
- ⚠️ SDK PagSeguro Sandbox URL hardcoded — necessita troca para produção
- **Mitigação:** Ambiente Sandbox é isolado; troca de URL deve ser feita antes do deploy de produção

### 10.3 Dados Sensíveis
- **Número do cartão:** Tokenizado pelo SDK PagSeguro; nunca armazenado
- **CVV:** Tokenizado pelo SDK PagSeguro; campo mascarado
- **CPF do titular:** Enviado à Cloud Function; armazenamento deve ser avaliado
- **card_token:** Token temporário gerado pelo PagSeguro

---

## 11. Performance

### 11.1 Métricas
- **Tempo de carregamento:** ~500ms (query Firestore + carregamento do SDK PagSeguro)
- **Tempo de processamento:** ~2-5s (tokenização + Cloud Function)
- **Requisições:** 1 getTenantOnboarding + 1 fetch session + 1 Cloud Function

### 11.2 Otimizações Implementadas
- ✅ SDK PagSeguro carregado com `strategy="afterInteractive"` (não bloqueia render)
- ✅ `onError` do Script ativa modo MOCK (não trava a página)
- ✅ Dois loading states separados: `loading` (carregamento inicial) e `processing` (pagamento)

### 11.3 Gargalos Identificados
- ⚠️ SDK PagSeguro Sandbox pode ser lento para carregar (~1-3s)
- ⚠️ Cloud Function cold start pode adicionar latência
- **Plano de melhoria:** Pre-warm Cloud Function; considerar edge function

---

## 12. Acessibilidade

### 12.1 Conformidade WCAG
- **Nível:** Parcial A
- **Versão:** 2.1

### 12.2 Recursos Implementados
- ✅ Labels com `htmlFor` em todos os inputs
- ✅ Placeholders descritivos nos campos
- ✅ `inputMode="numeric"` no campo de data de nascimento
- ✅ Alert com ícones para mensagens de erro
- ✅ Botão com estados visuais claros (loading, desabilitado)

### 12.3 Melhorias Necessárias
- [ ] `aria-live` para anúncio de erros em tempo real
- [ ] `aria-required` nos campos obrigatórios
- [ ] `aria-describedby` para vincular mensagens de erro aos campos
- [ ] Melhor navegação por teclado entre os cards de formulário
- [ ] Contraste dos textos informativos (boxes amarelo/verde)

---

## 13. Testes

### 13.1 Cenários de Teste
1. **Exibição do resumo do plano semestral**
   - **Dado:** Plano semestral selecionado (R$ 59,90)
   - **Quando:** Acessa `/clinic/setup/payment`
   - **Então:** Exibe "Plano Semestral", "6 meses de compromisso", "R$ 59,90/mês"

2. **Preenchimento de dados do cartão**
   - **Dado:** Formulário exibido
   - **Quando:** Digita "4111111111111111" no campo de cartão
   - **Então:** Exibe "4111 1111 1111 1111" (formatado)

3. **Pagamento com sucesso (modo MOCK)**
   - **Dado:** Campos preenchidos, modo MOCK ativo
   - **Quando:** Clica "Confirmar e Ativar Assinatura"
   - **Então:** Token MOCK gerado, Cloud Function chamada, redireciona para `/clinic/setup/success`

4. **Máscara de CPF**
   - **Dado:** Campo CPF vazio
   - **Quando:** Digita "12345678901"
   - **Então:** Exibe "123.456.789-01"

### 13.2 Casos de Teste de Erro
1. **Campos do cartão incompletos:** Tenta confirmar sem CVV → "Preencha todos os dados do cartão"
2. **Dados do titular incompletos:** Tenta confirmar sem CPF → "Preencha todos os dados do titular"
3. **Falha na tokenização:** SDK retorna erro → "Erro ao processar cartão"
4. **Cloud Function recusa:** Retorno sem subscription_code → "Pagamento recusado..."

### 13.3 Testes de Integração
- [ ] Verificar que `confirmPayment()` cria licença com datas corretas
- [ ] Verificar que tenant é ativado (`active: true`) após pagamento
- [ ] Testar fallback MOCK quando SDK PagSeguro não carrega
- [ ] Testar fluxo completo com PagSeguro Sandbox

---

## 14. Melhorias Futuras

### 14.1 Funcionalidades
- [ ] Suporte a PIX e boleto como métodos de pagamento
- [ ] Cupom de desconto / código promocional
- [ ] Exibição da bandeira do cartão detectada
- [ ] Webhook PagSeguro para confirmação assíncrona
- [ ] Troca para URL de produção do PagSeguro (via variável de ambiente)

### 14.2 UX/UI
- [ ] Animação de progresso durante processamento do pagamento
- [ ] Preview da bandeira do cartão ao digitar
- [ ] Validação em tempo real dos campos (Luhn, CPF, data)
- [ ] Implementar links reais de "Termos de Uso" e "Política de Privacidade"

### 14.3 Performance
- [ ] Pre-warm Cloud Function para reduzir latência
- [ ] Cache do session ID do PagSeguro

### 14.4 Segurança
- [ ] Verificação de role `clinic_admin`
- [ ] Validação de CPF com dígitos verificadores
- [ ] Validação Luhn do número do cartão
- [ ] Remover modo MOCK em builds de produção (feature flag)
- [ ] Trocar URL do SDK para produção via variável de ambiente

---

## 15. Dependências e Relacionamentos

### 15.1 Páginas/Componentes Relacionados
- **Setup Plan:** Página anterior no fluxo — `/clinic/setup/plan`
- **Setup Success:** Próxima página no fluxo — `/clinic/setup/success`
- **API Route PagSeguro Session:** `/api/pagseguro/session`
- **Cloud Function:** `createPagBankSubscription`

### 15.2 Fluxos que Passam por Esta Página
1. **Onboarding Completo:** Termos → Setup → Plano → **Pagamento** → Sucesso

### 15.3 Impacto de Mudanças
- **Alto impacto:** Alteração na Cloud Function `createPagBankSubscription` afeta diretamente o processamento
- **Alto impacto:** Mudança nos planos PLANS afeta valores exibidos
- **Médio impacto:** Mudanças no `confirmPayment()` service afetam licença e ativação
- **Baixo impacto:** Mudanças visuais nos formulários são isoladas

---

## 16. Observações Técnicas

### 16.1 Decisões de Arquitetura
- **SDK PagSeguro no frontend:** Tokenização PCI-DSS — dados do cartão nunca passam pelo servidor da aplicação
- **Modo MOCK:** Permite desenvolvimento sem SDK PagSeguro; token simulado `MOCK_TOKEN_{timestamp}`
- **Dois loading states:** `loading` para carregamento inicial e `processing` para processamento do pagamento, evitando conflitos de UI

### 16.2 Padrões Utilizados
- **Onboarding Step Pattern:** Verificação de status no mount → redirect se etapa incorreta
- **SDK Loading Pattern:** `next/script` + `onLoad`/`onError` + estado `scriptLoaded`
- **Fallback Pattern:** Se SDK falha → modo MOCK; se `getBrand` falha → `detectCardBrand` local
- **Gradient Background:** `bg-gradient-to-br from-blue-50 to-indigo-100` — padrão do onboarding

### 16.3 Limitações Conhecidas
- ⚠️ URL do SDK PagSeguro é Sandbox hardcoded — deve ser trocada para produção
- ⚠️ Session ID obtido via API route `/api/pagseguro/session` — pode não estar implementada corretamente
- ⚠️ Sem validação robusta dos dados do cartão (Luhn, data de expiração)
- ⚠️ Links de Termos de Uso e Política de Privacidade apontam para `href="#"`
- ⚠️ `detectCardBrand` com default "visa" pode causar tokenização incorreta em bandeiras não reconhecidas

### 16.4 Notas de Implementação
- Declaração global `Window.PagSeguroDirectPayment` no arquivo para compatibilidade TypeScript
- Funções de máscara (`formatCardNumber`, `formatExpiry`, `formatCpf`, `formatPhone`, `formatDate`) são locais ao componente (duplicadas de outras páginas)
- A "Primeira cobrança" exibe o dia atual (`new Date().getDate()`) como dia fixo de cobrança
- O rodapé exibe: "Pagamento 100% seguro via PagSeguro | Ambiente Sandbox (Teste)"
- A validade do cartão é enviada como `expirationYear: "20" + expiryParts[1]` (assume século 21)

---

## 17. Histórico de Mudanças

| Data | Versão | Autor | Descrição |
|------|--------|-------|-----------|
| 07/02/2026 | 1.0 | Claude (Engenharia Reversa) | Documentação inicial formato antigo |
| 09/02/2026 | 2.0 | Claude (Engenharia Reversa) | Padronização para template 20 seções |

---

## 18. Glossário

- **PagSeguro:** Gateway de pagamento brasileiro (PagBank) utilizado para processamento de cartões
- **SDK:** Software Development Kit — biblioteca JavaScript do PagSeguro carregada no frontend
- **Tokenização:** Processo de substituir dados sensíveis do cartão por um token seguro
- **BIN:** Bank Identification Number — primeiros 6 dígitos do cartão que identificam a bandeira/banco
- **Sandbox:** Ambiente de teste do PagSeguro que simula transações sem cobrança real
- **MOCK:** Modo de simulação que gera tokens falsos quando o SDK não está disponível
- **Cloud Function:** Função serverless Firebase que processa a assinatura no backend
- **httpsCallable:** Método Firebase para chamar Cloud Functions de forma segura a partir do frontend

---

## 19. Referências

### 19.1 Documentação Relacionada
- Setup (Plano) - `project_doc/clinic/setup-plan-documentation.md`
- Setup (Sucesso) - `project_doc/clinic/setup-success-documentation.md`
- Setup (Dados Cadastrais) - `project_doc/clinic/setup-documentation.md`
- Setup (Termos) - `project_doc/clinic/setup-terms-documentation.md`
- Licença - `project_doc/clinic/license-documentation.md`

### 19.2 Links Externos
- PagSeguro DirectPayment - https://dev.pagseguro.uol.com.br/
- Firebase Cloud Functions - https://firebase.google.com/docs/functions
- Next.js Script - https://nextjs.org/docs/app/api-reference/components/script

### 19.3 Código Fonte
- **Componente Principal:** `src/app/(clinic)/clinic/setup/payment/page.tsx`
- **Service:** `src/lib/services/tenantOnboardingService.ts`
- **Constantes:** `src/lib/constants/plans.ts`
- **Types:** `src/types/onboarding.ts`

---

## 20. Anexos

### 20.1 Screenshots
[Não disponível — documentação gerada por engenharia reversa]

### 20.2 Diagramas
[Ver seção 5 — Fluxo de Processo Detalhado]

### 20.3 Exemplos de Código

```typescript
// Detecção de bandeira por BIN (fallback local)
function detectCardBrand(bin: string): string {
  const binNum = parseInt(bin);
  if (bin.startsWith("4")) return "visa";
  if (binNum >= 510000 && binNum <= 559999) return "mastercard";
  if (bin.startsWith("34") || bin.startsWith("37")) return "amex";
  if (bin.startsWith("6011") || bin.startsWith("65")) return "discover";
  if (bin.startsWith("636")) return "elo";
  if (bin.startsWith("606282")) return "hipercard";
  return "visa"; // default
}

// Payload enviado à Cloud Function
const result = await createSubscription({
  tenant_id: tenantId,
  plan_id: planId,
  card_token: cardToken,
  holder_name: cardHolder,
  holder_birth_date: holderBirthDate,
  holder_cpf: holderCpf,
  holder_phone: holderPhone,
});
```

---

**Documento gerado por:** Claude (Engenharia Reversa)
**Última atualização:** 09/02/2026
**Responsável:** Equipe Curva Mestra
**Revisado por:** —
**Status:** Aprovado
