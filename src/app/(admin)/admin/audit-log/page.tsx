'use client';

import { AuditLogView } from '@/components/audit/AuditLogView';

export default function AdminAuditLogPage() {
  return <AuditLogView scope="system_admin" />;
}
