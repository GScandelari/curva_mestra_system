'use client';

import { useAuth } from '@/hooks/useAuth';
import { ReportsView } from '@/components/reports/ReportsView';

export default function ReportsPage() {
  const { claims } = useAuth();
  const tenantId = claims?.tenant_id;
  if (!tenantId) return null;
  return <ReportsView tenantId={tenantId} />;
}
