# Padrão AdminLayout - System Admin

## Objetivo
Todas as páginas do System Admin (`/admin/*`) devem usar o `AdminLayout` para manter consistência visual e navegação padronizada.

## Estrutura Padrão

### Imports Necessários
```typescript
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
```

### Estrutura do Return
```typescript
return (
  <ProtectedRoute allowedRoles={["system_admin"]}>
    <AdminLayout>
      <div className="container py-8">
        <div className="space-y-6">
          {/* Conteúdo da página */}
        </div>
      </div>
    </AdminLayout>
  </ProtectedRoute>
);
```

## Páginas Atualizadas

### ✅ Já com AdminLayout
- `/admin/dashboard/page.tsx`
- `/admin/licenses/page.tsx`
- `/admin/licenses/new/page.tsx`
- `/admin/licenses/[id]/page.tsx`
- `/admin/access-requests/page.tsx`

### 🔄 Pendentes (em atualização)
- `/admin/tenants/page.tsx`
- `/admin/tenants/new/page.tsx`
- `/admin/tenants/[id]/page.tsx`
- `/admin/products/page.tsx`
- `/admin/products/new/page.tsx`
- `/admin/products/[id]/page.tsx`
- `/admin/users/page.tsx`
- `/admin/profile/page.tsx`

## Navegação Lateral (AdminLayout)

O `AdminLayout` inclui automaticamente:
- Logo "System Admin - Curva Mestra"
- Menu de navegação com:
  - Dashboard
  - Clínicas
  - Usuários
  - Licenças
  - Produtos Master
  - Solicitações de Acesso
- Rodapé com:
  - Perfil
  - Sair

## Benefícios
1. ✅ Navegação consistente em todas as páginas
2. ✅ Não precisa implementar header/sidebar manualmente
3. ✅ Proteção de rota incluída
4. ✅ UX melhorada
5. ✅ Manutenção centralizada

## O Que Remover

Ao adicionar AdminLayout, remover:
- Headers customizados (`<header>`)
- Botões de logout customizados
- Menus de navegação próprios
- Divs wrapper de layout (`min-h-screen`, etc.)

## Exceção

Páginas de onboarding (`/clinic/setup/*`) NÃO usam AdminLayout pois são fluxos especiais.
