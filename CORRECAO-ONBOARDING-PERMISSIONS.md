# Correção de Permissões no Onboarding

## Problema
Durante o processo de onboarding, ao confirmar o pagamento, ocorria erro de permissões ao tentar atualizar uma licença existente:

```
Erro ao atualizar licença: FirebaseError: Missing or insufficient permissions.
Erro ao confirmar pagamento: Error: Falha ao atualizar licença
```

## Causa
As regras do Firestore permitiam que `clinic_admin` **criasse** licenças para seu próprio tenant, mas não permitiam **atualizar** licenças existentes. Isso causava falha quando o sistema tentava atualizar uma licença já existente ao invés de criar uma nova (comportamento implementado para evitar duplicação).

## Solução
Adicionada permissão de `update` para `clinic_admin` nas regras da coleção `licenses`:

```javascript
// Clinic_admin pode atualizar licença do seu próprio tenant
allow update: if isAuthenticated()
  && request.auth.token.role == 'clinic_admin'
  && resource.data.tenant_id == request.auth.token.tenant_id
  && request.resource.data.tenant_id == request.auth.token.tenant_id;
```

### Validações de Segurança
A regra garante que:
1. O usuário está autenticado
2. O usuário tem role `clinic_admin`
3. A licença existente pertence ao tenant do usuário
4. A licença atualizada continua pertencendo ao mesmo tenant (não permite mudança de tenant)

## Arquivo Modificado
- `firestore.rules` - Adicionada regra de `update` para licenças

## Deploy
```bash
firebase deploy --only firestore:rules
```

## Status
✅ Corrigido e deployado em produção
✅ Regras compiladas sem erros
✅ Onboarding agora pode atualizar licenças existentes

## Data
30/11/2024
