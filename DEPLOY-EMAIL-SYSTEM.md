# 📧 Deploy do Sistema de E-mail

## 📋 Resumo

Sistema de e-mail implementado usando:
- **SMTP**: Zoho Mail (smtp.zoho.com:587)
- **Serviço**: Nodemailer
- **Secrets**: Firebase Functions Secrets
- **Triggers**: Firestore (onUserCreated, onTenantCreated)

## 🔐 Passo 1: Configurar Secrets SMTP

Os secrets precisam ser configurados ANTES do deploy das functions.

### Opção A: Via Firebase CLI (Recomendado)

```bash
# Configurar usuário SMTP
firebase functions:secrets:set SMTP_USER
# Quando solicitado, cole: scandelari.guilherme@curvamestra.com.br

# Configurar senha SMTP
firebase functions:secrets:set SMTP_PASS
# Quando solicitado, cole a senha do Zoho Mail
```

### Opção B: Via Console Firebase

1. Acesse: https://console.firebase.google.com/project/curva-mestra/functions/list
2. Vá em "Secrets" no menu lateral
3. Crie os seguintes secrets:
   - `SMTP_USER`: scandelari.guilherme@curvamestra.com.br
   - `SMTP_PASS`: [senha do Zoho Mail]

## 📦 Passo 2: Deploy das Functions

```bash
# Navegar para o diretório de functions
cd functions

# Instalar dependências (se necessário)
npm install

# Deploy apenas das functions de email
firebase deploy --only functions:onUserCreated,functions:onTenantCreated,functions:sendTempPasswordEmail,functions:sendCustomEmail

# OU deploy de todas as functions
firebase deploy --only functions
```

## ✅ Passo 3: Verificar Deploy

```bash
# Listar functions deployed
firebase functions:list

# Verificar secrets configurados
firebase functions:secrets:access SMTP_USER --data
```

## 🧪 Passo 4: Testar Sistema de E-mail

### Teste 1: Enviar E-mail de Teste

```bash
# Via Firebase CLI
firebase functions:shell

# No shell, executar:
sendTestEmail()
```

### Teste 2: Criar Novo Usuário (Trigger onUserCreated)

1. Acesse o Portal Admin: https://curva-mestra.web.app/admin
2. Aprove uma solicitação de acesso pendente
3. Verifique se o e-mail de boas-vindas foi enviado

### Teste 3: Criar Nova Clínica (Trigger onTenantCreated)

1. Acesse: https://curva-mestra.web.app/admin/tenants
2. Crie uma nova clínica
3. Verifique se a notificação foi enviada para scandelari.guilherme@curvamestra.com.br

## 📧 E-mails Implementados

### 1. E-mail de Boas-Vindas
- **Trigger**: Novo usuário criado (onUserCreated)
- **Disparo**: Automático quando documento criado em `users/{userId}`
- **Template**: `sendWelcomeEmail()`
- **Conteúdo**:
  - Mensagem de boas-vindas
  - Informações do perfil do usuário
  - Link para fazer login

### 2. E-mail com Senha Temporária
- **Function**: `sendTempPasswordEmail` (callable)
- **Disparo**: Manual via API route `/api/access-requests/[id]/approve`
- **Template**: `sendTemporaryPasswordEmail()`
- **Conteúdo**:
  - Senha temporária gerada
  - Instruções de primeiro acesso
  - Link para login

### 3. Notificação de Nova Clínica
- **Trigger**: Nova clínica criada (onTenantCreated)
- **Disparo**: Automático quando documento criado em `tenants/{tenantId}`
- **Template**: `sendNewTenantNotification()`
- **Destinatário**: Admin (scandelari.guilherme@curvamestra.com.br)
- **Conteúdo**:
  - Nome da clínica
  - E-mail
  - Plano selecionado
  - Data de criação

### 4. E-mail Personalizado
- **Function**: `sendCustomEmail` (callable)
- **Disparo**: Manual por system_admin
- **Permissão**: Apenas `is_system_admin = true`
- **Uso**: E-mails ad-hoc do admin para usuários

## 🔧 Troubleshooting

### Erro: "Secret SMTP_USER not found"

**Causa**: Secret não configurado antes do deploy
**Solução**:
```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase deploy --only functions
```

### Erro: "Invalid login: 535 Authentication failed"

**Causa**: Credenciais SMTP incorretas
**Solução**:
```bash
# Verificar valor atual
firebase functions:secrets:access SMTP_USER --data

# Reconfigurar se necessário
firebase functions:secrets:set SMTP_PASS
```

### E-mails não estão sendo enviados

**Diagnóstico**:
```bash
# Ver logs das functions
firebase functions:log --only onUserCreated,onTenantCreated

# Ver logs em tempo real
firebase functions:log --follow
```

**Possíveis causas**:
1. ❌ Secrets não configurados
2. ❌ Functions não deployed
3. ❌ Credenciais SMTP erradas
4. ❌ Firewall bloqueando porta 587

### Erro: "ETIMEDOUT" ou "Connection timeout"

**Causa**: Firewall bloqueando SMTP
**Solução**: Verificar se a porta 587 está aberta no servidor

## 📊 Monitoramento

### Ver Logs de E-mails

```bash
# Logs de envio
firebase functions:log --only sendTempPasswordEmail

# Logs de triggers
firebase functions:log --only onUserCreated,onTenantCreated
```

### Métricas no Console

1. Acesse: https://console.firebase.google.com/project/curva-mestra/functions
2. Selecione a function
3. Veja:
   - Invocações
   - Erros
   - Tempo de execução
   - Custos

## 💰 Custos Estimados

### Firebase Functions (Plano Spark - Gratuito)

- **Invocações**: 2M/mês (gratuito)
- **Uso estimado**: ~500 e-mails/mês = 500 invocações
- **Custo**: R$ 0,00 (dentro do limite gratuito)

### SMTP Zoho Mail

- **Plano**: Free (até 5 usuários)
- **Limite**: 250 e-mails/dia por conta
- **Custo**: R$ 0,00

## 🚀 Próximos Passos

Após configurar o sistema de e-mail:

1. ✅ Testar envio de e-mails
2. ✅ Monitorar logs para erros
3. ✅ Implementar fila de e-mails (já existe: `processEmailQueue`)
4. ✅ Adicionar retry logic para falhas
5. ⏳ Implementar templates adicionais:
   - E-mail de solicitação rejeitada
   - E-mail de licença expirando
   - E-mail de renovação

## 📝 Arquivos Relacionados

### Cloud Functions
- `functions/src/services/emailService.ts` - Serviço principal
- `functions/src/onUserCreated.ts` - Trigger de criação de usuário
- `functions/src/onTenantCreated.ts` - Trigger de criação de clínica
- `functions/src/sendTemporaryPasswordEmail.ts` - E-mail com senha temporária
- `functions/src/sendCustomEmail.ts` - E-mails personalizados
- `functions/src/index.ts` - Exports

### API Routes
- `src/app/api/access-requests/[id]/approve/route.ts` - Usa sendTempPasswordEmail

## 🔒 Segurança

### Secrets Storage
- ✅ Credenciais armazenadas em Firebase Secrets (não em código)
- ✅ Secrets acessíveis apenas em runtime
- ✅ Não versionados no Git

### Permissões
- ✅ `sendCustomEmail` requer `is_system_admin = true`
- ✅ `sendTempPasswordEmail` requer `is_system_admin = true`
- ✅ Triggers executam com privilégios de service account

### Validações
- ✅ Formato de e-mail validado
- ✅ Autenticação verificada
- ✅ Custom claims verificados

## ✅ Checklist de Deploy

- [ ] Secrets SMTP configurados
- [ ] Dependencies instaladas (`npm install` em functions/)
- [ ] Functions deployed
- [ ] Teste de envio executado
- [ ] Logs monitorados
- [ ] E-mail de boas-vindas testado
- [ ] E-mail de senha temporária testado
- [ ] Notificação de nova clínica testada

---

**Status**: ✅ Sistema implementado e pronto para deploy
**Pendente**: Configuração de secrets SMTP e deploy
**Próximo passo**: `firebase functions:secrets:set SMTP_USER`
