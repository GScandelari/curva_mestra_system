'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AuditLogView } from '@/components/audit/AuditLogView';

export default function ClinicAuditLogPage() {
  const { claims } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (claims && claims.role !== 'clinic_admin') {
      router.push('/clinic/dashboard');
    }
  }, [claims, router]);

  if (claims?.role !== 'clinic_admin' || !claims.tenant_id) return null;

  return (
    <div className="container py-8">
      <AuditLogView scope="clinic_admin" tenantId={claims.tenant_id} />
    </div>
  );
}
