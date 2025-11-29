# Correção: Permissão para Criar Licença durante Onboarding

## Problema

Ao confirmar o pagamento em `/clinic/setup/payment`, o clinic_admin recebia o erro:
```
FirebaseError: Missing or insufficient permissions.
Erro ao criar licença
```

## Causa

As regras de segurança do Firestore permitiam apenas que o `system_admin` criasse licenças:

```javascript
match /licenses/{licenseId} {
  allow read, write: if isSystemAdmin();
  allow read: if isAuthenticated() && resource.data.tenant_id == request.auth.token.tenant_id;
}
```

Porém, durante o fluxo de onboarding, quando o `clinic_admin` confirma o pagamento, o sistema precisa criar automaticamente uma licença para o tenant.

## Solução

Atualizadas as regras para permitir que `clinic_admin` crie licenças **apenas para seu próprio tenant**:

```javascript
// Coleção de licenças
match /licenses/{licenseId} {
  // System admins têm acesso total
  allow read, write: if isSystemAdmin();

  // Usuários podem ler suas próprias licenças
  allow read: if isAuthenticated() && resource.data.tenant_id == request.auth.token.tenant_id;

  // Clinic_admin pode criar licença para seu próprio tenant durante onboarding
  allow create: if isAuthenticated()
    && request.auth.token.role == 'clinic_admin'
    && request.resource.data.tenant_id == request.auth.token.tenant_id;
}
```

## Validações de Segurança

A nova regra garante que:

1. ✅ Apenas usuários autenticados podem criar licenças
2. ✅ Apenas usuários com role `clinic_admin` podem criar
3. ✅ Somente pode criar licença para seu próprio tenant (`tenant_id` deve corresponder)
4. ✅ System admin continua com acesso total (read, write)
5. ✅ Usuários comuns podem apenas ler suas licenças

## Fluxo Funcional

### Antes (❌ Erro)
1. Clinic_admin acessa `/clinic/setup/payment`
2. Confirma pagamento
3. Sistema tenta criar licença via `createLicense()`
4. **Firestore bloqueia** → Erro de permissão

### Depois (✅ Funciona)
1. Clinic_admin acessa `/clinic/setup/payment`
2. Confirma pagamento
3. Sistema cria licença via `createLicense()`
4. **Firestore permite** porque:
   - Usuário é clinic_admin
   - tenant_id da licença corresponde ao tenant do usuário
5. Licença criada com sucesso
6. Tenant ativado
7. Onboarding completo

## Deploy

Regras atualizadas e enviadas para produção:
```bash
firebase deploy --only firestore:rules
```

Status: ✅ Deploy concluído com sucesso

## Testado

- ✅ Clinic_admin consegue criar licença durante onboarding
- ✅ Clinic_admin NÃO consegue criar licença para outro tenant
- ✅ Clinic_user NÃO consegue criar licenças
- ✅ System_admin continua com acesso total

## Arquivos Modificados

- `firestore.rules` (linhas 103-115)

## Data da Correção

28/11/2025
