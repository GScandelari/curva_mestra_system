# 📧 Configuração de E-mail - Zoho SMTP

## 🔐 Passo 1: Configurar Secrets no Firebase

Os secrets são credenciais seguras armazenadas no Google Cloud Secret Manager.

### Criar os Secrets:

```bash
# Navegar até a pasta functions
cd functions

# Criar secret para o usuário SMTP (seu e-mail Zoho)
firebase functions:secrets:set SMTP_USER

# Quando solicitado, digite:
scandelari.guilherme@curvamestra.com.br

# Criar secret para a senha SMTP (sua senha do Zoho)
firebase functions:secrets:set SMTP_PASS

# Quando solicitado, digite sua senha do Zoho Mail
# IMPORTANTE: Use a senha do Zoho, não a senha de aplicativo
```

### Verificar Secrets Criados:

```bash
# Listar secrets configurados
firebase functions:secrets:access SMTP_USER
firebase functions:secrets:access SMTP_PASS
```

---

## 🚀 Passo 2: Deploy das Functions

```bash
# Deploy das functions com os secrets
firebase deploy --only functions

# Ou deploy apenas da função de teste
firebase deploy --only functions:testEmail
```

---

## 🧪 Passo 3: Testar Envio de E-mail

### Opção A: Testar via HTTP Request (Postman/Insomnia/cURL)

```bash
# Endpoint (após deploy)
POST https://southamerica-east1-curva-mestra.cloudfunctions.net/testEmail

# Body (JSON)
{
  "type": "welcome",
  "email": "scandelari.guilherme@curvamestra.com.br"
}

# Ou teste de Magic Link
{
  "type": "magic-link",
  "email": "scandelari.guilherme@curvamestra.com.br"
}
```

### Opção B: Testar via cURL

```bash
# Teste de boas-vindas
curl -X POST \
  https://southamerica-east1-curva-mestra.cloudfunctions.net/testEmail \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "email": "scandelari.guilherme@curvamestra.com.br"
  }'

# Teste de Magic Link
curl -X POST \
  https://southamerica-east1-curva-mestra.cloudfunctions.net/testEmail \
  -H "Content-Type: application/json" \
  -d '{
    "type": "magic-link",
    "email": "scandelari.guilherme@curvamestra.com.br"
  }'
```

### Opção C: Testar Localmente com Emulador

```bash
# Iniciar emulador (em uma nova aba do terminal)
firebase emulators:start

# Chamar função local (em outra aba)
curl -X POST \
  http://127.0.0.1:5001/curva-mestra/southamerica-east1/testEmail \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "email": "scandelari.guilherme@curvamestra.com.br"
  }'
```

---

## 📋 Tipos de E-mail Disponíveis

### 1. **E-mail de Boas-vindas** (`welcome`)
Enviado quando um novo usuário é criado no sistema.

**Inclui:**
- Nome do usuário
- Perfil/Role (System Admin, Clinic Admin, User)
- Botão para acessar o sistema
- Instruções iniciais

**Uso:**
```typescript
import { sendWelcomeEmail } from './services/emailService';

await sendWelcomeEmail(
  'usuario@email.com',
  'Nome do Usuário',
  'clinic_admin'
);
```

### 2. **Magic Link** (`magic-link`)
Link temporário para login sem senha.

**Inclui:**
- Link único e seguro
- Validade de 60 minutos
- Avisos de segurança

**Uso:**
```typescript
import { sendMagicLinkEmail } from './services/emailService';

await sendMagicLinkEmail(
  'usuario@email.com',
  'https://curva-mestra.web.app/login?token=ABC123'
);
```

### 3. **Notificação de Nova Clínica** (interno)
Enviado para o admin quando uma nova clínica é cadastrada.

**Uso:**
```typescript
import { sendNewTenantNotification } from './services/emailService';

await sendNewTenantNotification(
  'Clínica ABC',
  'contato@clinica.com',
  'semestral'
);
```

---

## ⚙️ Configurações SMTP do Zoho

```
Host:     smtp.zoho.com
Port:     587 (TLS recomendado)
Secure:   false (para port 587)
Auth:     {
  user: scandelari.guilherme@curvamestra.com.br
  pass: [sua senha do Zoho]
}
```

### Limites do Zoho Mail Free:
- **500 e-mails/dia** por conta
- Suficiente para MVP e testes
- Sem custo adicional

---

## 🔧 Troubleshooting

### Erro: "Invalid login"
- Verifique se a senha está correta no secret
- Tente fazer login manualmente no Zoho Mail
- Verifique se a autenticação de dois fatores está desabilitada

### Erro: "Connection timeout"
- Verifique se a porta 587 está aberta
- Tente trocar para porta 465 com `secure: true`

### Erro: "Daily limit exceeded"
- Limite de 500 e-mails/dia atingido
- Aguarde até o dia seguinte ou considere upgrade

### E-mails indo para SPAM
- Configure SPF, DKIM e DMARC no DNS do domínio
- Entre em contato com suporte do Zoho para whitelist

---

## 📊 Monitoramento

### Ver logs das functions:
```bash
# Logs em tempo real
firebase functions:log --only testEmail

# Logs de todas as functions
firebase functions:log
```

### Ver secrets configurados:
```bash
firebase functions:secrets:access SMTP_USER
firebase functions:secrets:access SMTP_PASS
```

---

## 🎯 Próximos Passos

Após testar e confirmar que os e-mails estão sendo enviados:

1. ✅ Integrar envio de e-mail na criação de usuários
2. ✅ Configurar Magic Link no login
3. ✅ Adicionar e-mails de notificação (vencimento de produtos)
4. ✅ Criar templates personalizados por tenant

---

## 📝 Notas Importantes

- **NUNCA** commite as senhas no código
- Use apenas Firebase Secrets para credenciais
- Em produção, considere migrar para SendGrid ou Resend para melhor deliverability
- Zoho Free é adequado para MVP (até 500 e-mails/dia)

---

## ✅ Checklist de Setup

```markdown
☐ Criar conta no Zoho Mail (curvamestra.com.br)
☐ Configurar secrets SMTP_USER e SMTP_PASS no Firebase
☐ Deploy das functions com secrets
☐ Testar envio de e-mail de boas-vindas
☐ Testar envio de Magic Link
☐ Verificar logs no Firebase Console
☐ Confirmar recebimento dos e-mails
☐ Verificar se não estão indo para SPAM
```

---

**Data de Criação:** ${new Date().toLocaleDateString('pt-BR')}
**Versão:** 1.0
