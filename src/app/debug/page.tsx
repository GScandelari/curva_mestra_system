'use client';

import { useEffect, useState } from 'react';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const [info, setInfo] = useState<any>({});
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Verificar autenticação e permissões
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Não autenticado - redirecionar para login
        router.push('/login?redirect=/debug');
        return;
      }

      try {
        // Obter custom claims do usuário
        const tokenResult = await user.getIdTokenResult();
        const isSystemAdmin = tokenResult.claims.is_system_admin === true;

        if (!isSystemAdmin) {
          // Não é system_admin - acesso negado
          setIsAuthorized(false);
          return;
        }

        // Autorizado - carregar informações de debug
        setIsAuthorized(true);
        const debugInfo = {
          authEmulator: (auth as any)._config?.emulatorConfig?.host || 'Não conectado',
          firestoreEmulator: (db as any)._settings?.host || 'Produção',
          functionsEmulator: (functions as any)._url || 'Produção',
          useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          userEmail: user.email,
          userRole: tokenResult.claims.role,
        };
        setInfo(debugInfo);
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setIsAuthorized(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Esta página é restrita a administradores do sistema.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  // Authorized - show debug info
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Debug - Firebase Config</h1>
          <span className="text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full">
            System Admin
          </span>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Status dos Emuladores</h2>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-2">
                <span className="font-bold">Auth Emulator:</span>
                <span>{info.authEmulator}</span>
                {info.authEmulator?.includes('localhost') ? (
                  <span className="text-green-600">✅ Ativo</span>
                ) : (
                  <span className="text-red-600">❌ Não conectado</span>
                )}
              </div>

              <div className="flex gap-2">
                <span className="font-bold">Firestore Emulator:</span>
                <span>{info.firestoreEmulator}</span>
                {info.firestoreEmulator?.includes('localhost') ? (
                  <span className="text-green-600">✅ Ativo</span>
                ) : (
                  <span className="text-red-600">❌ Produção</span>
                )}
              </div>

              <div className="flex gap-2">
                <span className="font-bold">Functions Emulator:</span>
                <span>{info.functionsEmulator}</span>
                {info.functionsEmulator?.includes('localhost') ? (
                  <span className="text-green-600">✅ Ativo</span>
                ) : (
                  <span className="text-red-600">❌ Produção</span>
                )}
              </div>
            </div>
          </div>

          <hr className="border-t" />

          <div>
            <h2 className="text-xl font-semibold mb-2">Variáveis de Ambiente</h2>
            <div className="space-y-2 font-mono text-sm">
              <div>
                <span className="font-bold">USE_FIREBASE_EMULATORS:</span>{' '}
                <span>{info.useEmulators || 'undefined'}</span>
              </div>
              <div>
                <span className="font-bold">PROJECT_ID:</span>{' '}
                <span>{info.projectId || 'undefined'}</span>
              </div>
            </div>
          </div>

          <hr className="border-t" />

          <div>
            <h2 className="text-xl font-semibold mb-2">JSON Completo</h2>
            <pre className="bg-muted p-4 rounded text-xs overflow-auto">
              {JSON.stringify(info, null, 2)}
            </pre>
          </div>

          <hr className="border-t" />

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
            <h3 className="font-bold mb-2">✅ O que deve aparecer:</h3>
            <ul className="space-y-1 text-sm">
              <li>• Auth Emulator: localhost:9099</li>
              <li>• Firestore Emulator: localhost:8080</li>
              <li>• Functions Emulator: http://localhost:5001</li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded">
            <h3 className="font-bold mb-2">⚠️ Se estiver em "Produção":</h3>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              <li>Verifique se o arquivo .env.local existe</li>
              <li>Confirme que NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true</li>
              <li>Reinicie o servidor Next.js (Ctrl+C e npm run dev)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
