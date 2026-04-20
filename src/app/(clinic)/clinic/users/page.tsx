'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UsersTab from '@/components/clinic/UsersTab';

export default function ClinicUsersPage() {
  const { claims } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (claims && claims.role !== 'clinic_admin') {
      router.push('/clinic/dashboard');
    }
  }, [claims, router]);

  return (
    <div className="container py-8">
      <UsersTab />
    </div>
  );
}
