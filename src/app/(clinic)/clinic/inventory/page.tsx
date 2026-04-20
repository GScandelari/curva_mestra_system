'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { InventoryView } from '@/components/inventory/InventoryView';

export const dynamic = 'force-dynamic';

function InventoryContent() {
  const { claims } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tenantId = claims?.tenant_id;
  if (!tenantId) return null;

  const initialFilter = searchParams.get('filter') ?? undefined;
  const isAdmin = claims?.role === 'clinic_admin';

  return (
    <InventoryView
      tenantId={tenantId}
      realtime
      isAdmin={isAdmin}
      initialFilter={initialFilter}
      onRowClick={(id) => router.push(`/clinic/inventory/${id}`)}
      onAddProducts={() => router.push('/clinic/add-products')}
    />
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
