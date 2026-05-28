/**
 * Raiz da aplicação — redireciona para a landing page.
 *
 * Em produção/Firebase, o rewrite configurado em next.config.ts (`beforeFiles`)
 * intercepta "/" e serve "/landing" sem alterar a URL do browser.
 * Este componente é o fallback para ambientes onde o rewrite não atua
 * (ex: emulador local com cache de rota Next.js).
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/landing');
}
