export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Páginas com data-auth-wide (ex.: /register) usam um container mais largo;
          as demais continuam em max-w-md */}
      <div className="w-full max-w-md px-4 has-[[data-auth-wide]]:max-w-2xl">{children}</div>
    </div>
  );
}
