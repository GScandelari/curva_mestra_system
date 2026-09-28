'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ProjectionsView } from '@/components/inventory/ProjectionsView';

export default function ConsultantProjectionsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { authorizedTenants, loading: authLoading, claims } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (claims && !authorizedTenants.includes(tenantId)) {
      router.push('/consultant/clinics');
    }
  }, [tenantId, authorizedTenants, authLoading, claims, router]);

  if (authLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  return <ProjectionsView tenantId={tenantId} backUrl={`/consultant/clinics/${tenantId}`} />;
}
