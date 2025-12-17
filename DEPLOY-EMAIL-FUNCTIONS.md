# Deploy de Funções de E-mail

## Funções Deployadas
✅ `sendCustomEmail` - Função callable para envio de e-mails personalizados
✅ `processEmailQueue` - Trigger Firestore para processar fila de e-mails
✅ `checkLicenseExpiration` - Função agendada para verificar expiração de licenças
✅ `placeholder` - Função de teste/placeholder

## Configuração de Secrets
As funções de e-mail utilizam os seguintes secrets do Secret Manager:
- `SMTP_USER`: scandelari.guilherme@curvamestra.com.br
- `SMTP_PASS`: Configurado

### Permissões
O deploy configurou automaticamente as permissões necessárias:
- Service account `521885400577-compute@developer.gserviceaccount.com` tem acesso aos secrets
- Role `roles/secretmanager.secretAccessor` concedida

## Funções de E-mail

### sendCustomEmail
**Tipo**: Callable Function (HTTPS)
**Região**: southamerica-east1
**Timeout**: 60 segundos
**Memória**: 256MiB

**Permissões**: Apenas `system_admin` pode chamar esta função

**Uso**:
```typescript
const sendEmail = httpsCallable(functions, 'sendCustomEmail');
await sendEmail({
  to: 'usuario@exemplo.com',
  subject: 'Assunto do e-mail',
  body: '<html>Corpo do e-mail em HTML</html>'
});
```

### processEmailQueue
**Tipo**: Firestore Trigger
**Região**: southamerica-east1
**Timeout**: 60 segundos
**Memória**: 256MiB
**Trigger**: `email_queue/{emailId}` onCreate

**Funcionamento**:
1. Monitora criação de documentos na coleção `email_queue`
2. Envia o e-mail automaticamente
3. Atualiza o status para `sent` ou `failed`
4. Registra timestamp de envio

**Estrutura do documento**:
```typescript
{
  to: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: Timestamp;
  sent_at?: Timestamp;
  error_message?: string;
}
```

## Comando de Deploy
```bash
firebase deploy --only functions --force
```

## Status
✅ Deploy realizado com sucesso em 30/11/2024
✅ Secrets configurados e acessíveis
✅ Permissões do Secret Manager configuradas
✅ Todas as funções operacionais

## Próximos Passos
- Testar envio de e-mail via `sendCustomEmail`
- Testar processamento automático via `email_queue`
- Monitorar logs das funções no Firebase Console
