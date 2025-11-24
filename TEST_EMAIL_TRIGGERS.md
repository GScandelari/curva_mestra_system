# 🧪 Testar Triggers de E-mail

## Após o deploy bem-sucedido

Aguarde 2-3 minutos e execute novamente:
```powershell
firebase deploy --only functions
```

## ✅ Funções que serão deployadas:

### 1. **onUserCreated** (Trigger automático)
- **Quando dispara**: Ao criar documento em `tenants/{tenantId}/users/{userId}`
- **O que faz**: Envia e-mail de boas-vindas para o novo usuário
- **E-mail enviado para**: O e-mail do usuário criado

### 2. **onTenantCreated** (Trigger automático)
- **Quando dispara**: Ao criar documento em `tenants/{tenantId}`
- **O que faz**: Notifica o admin sobre nova clínica
- **E-mail enviado para**: scandelari.guilherme@curvamestra.com.br

---

## 🧪 Como Testar

### Teste 1: E-mail de Boas-vindas
1. Acesse: https://curva-mestra.web.app/admin/tenants
2. Escolha uma clínica
3. Clique em "Adicionar Usuário"
4. Preencha:
   - Nome: "Teste Email"
   - Email: "seu_email@teste.com" (use um e-mail real que você tenha acesso)
   - Senha: "teste123"
   - Função: "Usuário"
5. Clique em "Criar Usuário"

**Resultado esperado:**
- ✅ Usuário criado no sistema
- ✅ E-mail de boas-vindas enviado automaticamente
- ✅ Verifique a caixa de entrada do e-mail que você usou

### Teste 2: Notificação de Nova Clínica
1. Acesse: https://curva-mestra.web.app/admin/tenants/new
2. Preencha os dados de uma nova clínica
3. Clique em "Criar Clínica"

**Resultado esperado:**
- ✅ Clínica criada no sistema
- ✅ E-mail de notificação enviado para scandelari.guilherme@curvamestra.com.br
- ✅ Verifique sua caixa de entrada do Zoho

---

## 📋 Verificar Logs

Para ver se os e-mails foram enviados:

```powershell
# Ver logs da função de usuário
firebase functions:log --only onUserCreated

# Ver logs da função de clínica
firebase functions:log --only onTenantCreated

# Ver todos os logs
firebase functions:log
```

Procure por mensagens como:
- `📧 Enviando e-mail de boas-vindas para...`
- `✅ E-mail enviado com sucesso para...`
- `❌ Erro ao enviar e-mail...` (se houver erro)

---

## ⚠️ Troubleshooting

### E-mail não chegou
1. Verifique a pasta de SPAM
2. Confira os logs: `firebase functions:log`
3. Verifique se as credenciais SMTP estão corretas
4. Teste fazer login no Zoho Mail manualmente

### Erro de permissão
Se aparecer erro de Eventarc Service Agent:
- Aguarde 5-10 minutos
- Execute deploy novamente
- É um processo automático do Google Cloud

### Função não aparece na lista
```powershell
firebase functions:list
```
Deve mostrar:
- onUserCreated (southamerica-east1)
- onTenantCreated (southamerica-east1)
- sendTestEmail (southamerica-east1)

---

## 🎯 Checklist Final

```markdown
☐ Aguardar 2-3 minutos após primeiro deploy
☐ Executar: firebase deploy --only functions
☐ Verificar: firebase functions:list
☐ Testar criação de usuário
☐ Verificar e-mail de boas-vindas recebido
☐ Testar criação de clínica
☐ Verificar notificação de admin recebida
☐ Conferir logs se houver erro
```

---

**Aguarde alguns minutos e tente o deploy novamente!** ⏱️
