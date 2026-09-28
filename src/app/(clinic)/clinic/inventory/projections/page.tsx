'use client';

import { useAuth } from '@/hooks/useAuth';
import { ProjectionsView } from '@/components/inventory/ProjectionsView';

export const dynamic = 'force-dynamic';

export default function ClinicProjectionsPage() {
  const { claims } = useAuth();

  const tenantId = claims?.tenant_id;
  if (!tenantId) return null;

  return <ProjectionsView tenantId={tenantId} backUrl="/clinic/inventory" />;
}
