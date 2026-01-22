# 🧪 Guia de Testes Manuais - Curva Mestra MVP

**Versão:** 1.0
**Data:** 22/01/2026
**Escopo:** Testes completos exceto pagamento

---

## 📋 Pré-requisitos

### Ambiente Local
```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente (.env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... demais variáveis

# 3. Iniciar servidor de desenvolvimento
npm run dev

# 4. Verificar type-check
npm run type-check
```

### Dados de Teste
- **System Admin**: scandelari.guilherme@curvamestra.com.br
- **Senha**: [senha configurada]
- **Firebase Console**: https://console.firebase.google.com/project/curva-mestra

---

## 🎯 Fluxos de Teste

### Fluxo 1: Solicitação de Acesso Antecipado ✅

#### 1.1 Criar Solicitação (Clínica)
1. Acessar: https://curva-mestra.web.app/early-access
2. Selecionar "Clínica"
3. Preencher formulário:
   - **Nome Completo**: João Silva Santos
   - **E-mail**: teste+clinica@example.com
   - **Telefone**: (11) 98765-4321
   - **Nome da Clínica**: Clínica Teste LTDA
   - **Tipo de Documento**: CNPJ
   - **CNPJ**: 11.222.333/0001-44 (válido)
   - **Senha**: Teste@123
   - **Endereço Completo**: Rua Teste, 123
   - **Cidade**: São Paulo
   - **Estado**: SP
   - **CEP**: 01234-567
4. Clicar em "Solicitar Acesso"

**Resultado Esperado:**
- ✅ Mensagem de sucesso
- ✅ Solicitação criada no Firestore (`access_requests`)
- ✅ Senha hasheada com bcrypt (não visível em texto plano)
- ✅ Status: "pendente"

**Validações a Testar:**
- ❌ CPF inválido → Erro: "CPF inválido: dígito verificador incorreto"
- ❌ CNPJ inválido → Erro: "CNPJ inválido: dígito verificador incorreto"
- ❌ Email inválido → Erro: "Formato de e-mail inválido"
- ❌ Telefone sem DDD → Erro: "Telefone deve ter 10 ou 11 dígitos (com DDD)"
- ❌ CEP incompleto → Erro: "CEP deve ter 8 dígitos"
- ❌ Senha curta (<6 chars) → Erro: "Senha deve ter pelo menos 6 caracteres"
- ❌ Nome incompleto → Erro: "Informe nome e sobrenome"

#### 1.2 Criar Solicitação (Autônomo)
Repetir fluxo 1.1 selecionando "Autônomo" e usando CPF ao invés de CNPJ.

**CPF Válido para Teste**: 123.456.789-09

---

### Fluxo 2: Aprovação de Solicitação ✅

#### 2.1 Login como System Admin
1. Acessar: https://curva-mestra.web.app/login
2. Fazer login com credenciais de system_admin
3. Verificar redirecionamento para `/admin`

#### 2.2 Visualizar Solicitações Pendentes
1. No portal admin, acessar lista de solicitações
2. Verificar solicitação criada no Fluxo 1
3. Clicar para ver detalhes

**Resultado Esperado:**
- ✅ Lista de solicitações exibida
- ✅ Status "pendente" visível
- ✅ Dados da solicitação completos
- ✅ Senha NÃO visível em texto plano

#### 2.3 Aprovar Solicitação
1. Clicar em "Aprovar"
2. Aguardar processamento

**Resultado Esperado:**
- ✅ Tenant criado (`tenants` collection)
- ✅ Usuário criado (`users` collection)
- ✅ Licença criada (`licenses` collection)
  - **Status**: ativa
  - **Plano**: early_access
  - **Duração**: 6 meses
  - **Features**: inventory_management, batch_tracking, etc.
- ✅ Onboarding criado (`tenant_onboarding`)
  - **Status**: pending_setup
  - **setup_completed**: false
- ✅ Solicitação atualizada
  - **Status**: aprovada
  - **tenant_id**: [ID do tenant criado]
  - **user_id**: [ID do usuário criado]

**Email (se SMTP configurado):**
- ✅ E-mail com senha temporária enviado
- ✅ Senha temporária de 12 caracteres
- ✅ Link para login

**Fallback (se SMTP não configurado):**
- ✅ Senha temporária retornada na resposta da API
- ✅ Senha temporária logada no console

---

### Fluxo 3: Rejeição de Solicitação ✅

#### 3.1 Criar Nova Solicitação
Repetir Fluxo 1.1 com e-mail diferente

#### 3.2 Rejeitar Solicitação
1. No portal admin, acessar solicitação
2. Clicar em "Rejeitar"
3. Opcionalmente, adicionar motivo da rejeição
4. Confirmar rejeição

**Resultado Esperado:**
- ✅ Solicitação atualizada
  - **Status**: rejeitada
  - **rejected_by**: [UID do admin]
  - **rejection_reason**: [Motivo, se fornecido]
  - **rejected_at**: [Timestamp]
- ✅ **NÃO** cria tenant, usuário ou licença

**Email (se SMTP configurado):**
- ✅ E-mail de rejeição enviado
- ✅ Motivo incluído (se fornecido)
- ✅ Link para nova solicitação

---

### Fluxo 4: Primeiro Login e Onboarding ✅

#### 4.1 Login com Usuário Aprovado
1. Acessar: https://curva-mestra.web.app/login
2. Usar e-mail da solicitação aprovada
3. Usar senha temporária

**Resultado Esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para `/clinic/setup`
- ✅ Custom claims verificados (tenant_id, role, active)

#### 4.2 Completar Setup Inicial
1. Página `/clinic/setup`
2. Verificar dados pré-preenchidos
3. Revisar/editar informações
4. Clicar em "Continuar"

**Resultado Esperado:**
- ✅ Dados salvos
- ✅ Onboarding atualizado: `setup_completed: true`
- ✅ Redirecionamento para `/clinic/setup/plan`

#### 4.3 Selecionar Plano
1. Página `/clinic/setup/plan`
2. Visualizar opções: Semestral vs Anual
3. Selecionar plano
4. Clicar em "Continuar"

**Resultado Esperado:**
- ✅ Plano selecionado salvo
- ✅ Onboarding atualizado: `plan_selected: true`
- ✅ Redirecionamento para `/clinic/setup/payment`

#### 4.4 Tela de Pagamento (Sandbox)
**ATENÇÃO**: Este fluxo NÃO deve ser testado nesta fase (conforme instrução).

**Verificação Visual Apenas:**
- ✅ Formulário de cartão exibido
- ✅ Resumo do plano exibido
- ✅ Valor mensal correto
- ✅ Indicador de ambiente "Sandbox" visível
- ⚠️ **NÃO PREENCHER** formulário de cartão

---

### Fluxo 5: Página Debug (Proteção) ✅

#### 5.1 Acesso Não Autenticado
1. Fazer logout se autenticado
2. Acessar: https://curva-mestra.web.app/debug

**Resultado Esperado:**
- ✅ Redirecionamento para `/login?redirect=/debug`
- ❌ Página debug NÃO exibida

#### 5.2 Acesso como Clinic Admin
1. Fazer login como clinic_admin
2. Acessar: https://curva-mestra.web.app/debug

**Resultado Esperado:**
- ✅ Mensagem "Acesso Negado"
- ✅ Indicação de que página é restrita
- ❌ Informações de debug NÃO exibidas

#### 5.3 Acesso como System Admin
1. Fazer login como system_admin
2. Acessar: https://curva-mestra.web.app/debug

**Resultado Esperado:**
- ✅ Página debug exibida
- ✅ Badge "System Admin" visível
- ✅ Informações do Firebase exibidas:
  - Auth Emulator status
  - Firestore Emulator status
  - Functions Emulator status
  - Project ID
  - Environment variables

---

### Fluxo 6: Validações de Formulário ✅

#### 6.1 CPF Inválido
1. Formulário de solicitação
2. Inserir CPF: 111.111.111-11 (todos dígitos iguais)
3. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "CPF inválido: todos os dígitos são iguais"

#### 6.2 CPF com Checksum Incorreto
1. Inserir CPF: 123.456.789-00 (checksum errado)
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "CPF inválido: dígito verificador incorreto"

#### 6.3 CNPJ Inválido
1. Inserir CNPJ: 11.111.111/1111-11
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "CNPJ inválido: todos os dígitos são iguais"

#### 6.4 Email Malformado
Testar diversos formatos inválidos:
- `teste` → "Formato de e-mail inválido"
- `teste@` → "Domínio do e-mail inválido"
- `@example.com` → "Parte local do e-mail inválida"
- `teste @example.com` (espaço) → "Formato de e-mail inválido"

#### 6.5 Telefone sem DDD
1. Inserir: 98765-4321 (sem DDD)
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "Telefone deve ter 10 ou 11 dígitos (com DDD)"

#### 6.6 CEP Incompleto
1. Inserir: 01234-56 (7 dígitos)
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "CEP deve ter 8 dígitos"

#### 6.7 Nome Incompleto
1. Inserir apenas: "João" (sem sobrenome)
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "Informe nome e sobrenome"

#### 6.8 Senha Fraca
1. Inserir: "123" (menos de 6 caracteres)
2. Tentar enviar

**Resultado Esperado:**
- ❌ Erro: "Senha deve ter pelo menos 6 caracteres"

---

### Fluxo 7: Segurança ✅

#### 7.1 Verificar Hash de Senha
1. Criar solicitação de acesso
2. No Firebase Console, acessar `access_requests`
3. Verificar campo `password`

**Resultado Esperado:**
- ✅ Senha hasheada (começa com $2a$ ou $2b$)
- ❌ Senha em texto plano NÃO visível
- ✅ Hash tem ~60 caracteres

#### 7.2 Verificar Logs Sanitizados
1. Abrir DevTools (F12)
2. Ir para Console
3. Navegar pelo fluxo de onboarding

**Resultado Esperado:**
- ❌ Card tokens NÃO logados
- ❌ Session IDs NÃO logados
- ❌ Senhas NÃO logadas
- ✅ Apenas logs de debug genéricos

#### 7.3 XSS Protection
1. No formulário, tentar inserir:
   - Nome: `<script>alert('XSS')</script>`
   - Email: `test<>@example.com`
2. Verificar dados salvos no Firestore

**Resultado Esperado:**
- ✅ Tags HTML removidas/escapadas
- ✅ Script NÃO executado
- ✅ Dados sanitizados

---

## 📊 Checklist de Teste

### Funcionalidades Core
- [ ] Solicitação de acesso (clínica)
- [ ] Solicitação de acesso (autônomo)
- [ ] Aprovação de solicitação
- [ ] Rejeição de solicitação
- [ ] Login com usuário aprovado
- [ ] Setup inicial (dados da clínica)
- [ ] Seleção de plano
- [ ] Tela de pagamento (visualização apenas)

### Validações
- [ ] CPF válido/inválido
- [ ] CNPJ válido/inválido
- [ ] Email válido/inválido
- [ ] Telefone válido/inválido
- [ ] CEP válido/inválido
- [ ] Nome completo válido/inválido
- [ ] Senha forte/fraca

### Segurança
- [ ] Senha hasheada no Firestore
- [ ] Debug page protegida
- [ ] Logs sanitizados (sem dados sensíveis)
- [ ] XSS protection
- [ ] Autenticação em rotas privadas

### Email (se SMTP configurado)
- [ ] Email de boas-vindas (onUserCreated trigger)
- [ ] Email com senha temporária (aprovação)
- [ ] Email de rejeição
- [ ] Email de nova clínica (para admin)

### Firestore
- [ ] Solicitação criada corretamente
- [ ] Tenant criado na aprovação
- [ ] Usuário criado na aprovação
- [ ] Licença criada na aprovação
- [ ] Onboarding criado na aprovação
- [ ] Licença NÃO duplicada
- [ ] Status correto em todas as collections

---

## 🐛 Bugs Conhecidos / Limitações

### Limitações Conhecidas (Design)
1. **Email System**: Requer configuração de SMTP (pendente)
2. **Payment**: Sandbox mode (não testar nesta fase)
3. **Senha Temporária**: Retornada na resposta se email falhar

### Bugs a Verificar
1. ❓ Licença duplicada (verificar que fix está funcionando)
2. ❓ Senha temporária visível em logs (deve estar sanitizado)
3. ❓ Debug page acessível sem autenticação (deve estar protegido)

---

## 🔧 Troubleshooting

### Erro: "Campo obrigatório: ..."
**Causa**: Validação básica
**Ação**: Preencher todos os campos obrigatórios

### Erro: "CPF inválido: dígito verificador incorreto"
**Causa**: CPF com checksum inválido
**Ação**: Usar CPF válido ou gerador de CPF

### Erro: "Não autenticado"
**Causa**: Token expirado ou não logado
**Ação**: Fazer logout e login novamente

### Email não recebido
**Causa**: SMTP não configurado
**Ação**:
1. Verificar console do servidor
2. Senha temporária deve estar logada
3. Configurar secrets SMTP (ver DEPLOY-EMAIL-SYSTEM.md)

### Type error durante build
**Causa**: Dependências desatualizadas
**Ação**:
```bash
npm install
npm run type-check
```

---

## 📈 Métricas de Teste

Após executar todos os testes, preencher:

### Testes Executados
- **Total de Casos**: 50+
- **Passou**: _____
- **Falhou**: _____
- **Bloqueado**: _____

### Tempo de Execução
- **Tempo Total**: _____ horas
- **Por Fluxo**: _____ minutos

### Bugs Encontrados
- **Críticos**: _____
- **Altos**: _____
- **Médios**: _____
- **Baixos**: _____

---

## ✅ Sign-off

### Testador
- **Nome**: _________________
- **Data**: _________________
- **Assinatura**: _________________

### Aprovação
- **Product Owner**: _________________
- **Data**: _________________

---

**Gerado por:** Claude Code (Anthropic)
**Versão:** 1.0.0
**Data:** 22/01/2026
