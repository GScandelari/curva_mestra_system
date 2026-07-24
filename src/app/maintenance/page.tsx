/**
 * Página: Sistema em Manutenção
 * Exibida quando system_settings/global.maintenance_mode === true
 * para qualquer usuário que não seja system_admin.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export default function MaintenancePage() {
  const router = useRouter();
  const { claims, signOut } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function checkMaintenance() {
      // system_admin nunca fica bloqueado pelo modo de manutenção
      if (claims?.role === 'system_admin') {
        router.push('/admin/dashboard');
        return;
      }

      const snap = await getDoc(doc(db, 'system_settings', 'global'));
      const data = snap.data();

      if (!data?.maintenance_mode) {
        router.push('/');
        return;
      }

      setMessage(data.maintenance_message || '');
      setLoading(false);
    }

    checkMaintenance();
  }, [claims, router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-background to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center border-b bg-amber-50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Wrench className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Sistema em Manutenção</CardTitle>
          <CardDescription className="text-base">
            Estamos realizando uma manutenção programada. Tente novamente em instantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {message && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full"
          >
            {isSigningOut ? 'Saindo...' : 'Sair da Conta'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
