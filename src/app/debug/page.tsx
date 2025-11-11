"use client";

import { useEffect, useState } from "react";
import { auth, db, functions } from "@/lib/firebase";

export default function DebugPage() {
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    const debugInfo = {
      authEmulator: (auth as any)._config?.emulatorConfig?.host || "Não conectado",
      firestoreEmulator: (db as any)._settings?.host || "Produção",
      functionsEmulator: (functions as any)._url || "Produção",
      useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    };
    setInfo(debugInfo);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Debug - Firebase Config</h1>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Status dos Emuladores</h2>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-2">
                <span className="font-bold">Auth Emulator:</span>
                <span>{info.authEmulator}</span>
                {info.authEmulator?.includes("localhost") ? (
                  <span className="text-green-600">✅ Ativo</span>
                ) : (
                  <span className="text-red-600">❌ Não conectado</span>
                )}
              </div>

              <div className="flex gap-2">
                <span className="font-bold">Firestore Emulator:</span>
                <span>{info.firestoreEmulator}</span>
                {info.firestoreEmulator?.includes("localhost") ? (
                  <span className="text-green-600">✅ Ativo</span>
                ) : (
                  <span className="text-red-600">❌ Produção</span>
                )}
              </div>

              <div className="flex gap-2">
                <span className="font-bold">Functions Emulator:</span>
                <span>{info.functionsEmulator}</span>
                {info.functionsEmulator?.includes("localhost") ? (
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
                <span className="font-bold">USE_FIREBASE_EMULATORS:</span>{" "}
                <span>{info.useEmulators || "undefined"}</span>
              </div>
              <div>
                <span className="font-bold">PROJECT_ID:</span>{" "}
                <span>{info.projectId || "undefined"}</span>
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
