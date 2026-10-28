import type { TEST_USERS } from './seed-data';

/**
 * Telas varridas em runtime pelo axe (tests/e2e/_infra-a11y-axe-mobile.spec.ts)
 * e consumidas pelo agente ux-reviewer (Modo E). Ver
 * ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-agente-ux-reviewer.md §6.4.
 *
 * Só entram usuários semeados com termos legais já aceitos (systemAdmin e
 * clinicAdminA) — os demais caem em /accept-terms no seed atual. Toda rota
 * aqui precisa ser somente leitura: a varredura roda também no projeto
 * mobile-chromium, depois da suíte completa ter mutado o emulador.
 */
export interface A11yRoute {
  /** Chave estável usada no baseline e no nome do JSON de resultado. kebab-case. */
  key: string;
  /** Rota a visitar. */
  path: string;
  /** Usuário semeado (chave de TEST_USERS) ou null para rota pública. */
  user: keyof typeof TEST_USERS | null;
  /** Redirect esperado do loginAs (helpers/auth.ts). Obrigatório quando user != null. */
  loginRedirect?: '/admin/dashboard' | '/clinic/dashboard';
  /** Nome acessível de um heading que indica tela carregada (evita varrer spinner). */
  readyHeading: string | RegExp;
}

export const A11Y_ROUTES: A11yRoute[] = [
  {
    key: 'login',
    path: '/login',
    user: null,
    // CardTitle (<h3>) de src/app/(auth)/login/page.tsx
    readyHeading: 'Curva Mestra',
  },
  {
    key: 'admin-dashboard',
    path: '/admin/dashboard',
    user: 'systemAdmin',
    loginRedirect: '/admin/dashboard',
    readyHeading: 'Dashboard administrativo',
  },
  {
    key: 'clinic-dashboard',
    path: '/clinic/dashboard',
    user: 'clinicAdminA',
    loginRedirect: '/clinic/dashboard',
    // "Olá, {primeiro nome}!" — exige o nome já carregado
    readyHeading: /^Olá, \S+!$/,
  },
  {
    key: 'clinic-inventory',
    path: '/clinic/inventory',
    user: 'clinicAdminA',
    loginRedirect: '/clinic/dashboard',
    // InventoryView sem readOnly (clinic_admin)
    readyHeading: 'Gerenciar Estoque',
  },
  // UX-060: telas com 3 PasswordInput cada, para o axe validar o botão de mostrar/ocultar.
  {
    key: 'admin-profile',
    path: '/admin/profile',
    user: 'systemAdmin',
    loginRedirect: '/admin/dashboard',
    readyHeading: 'Meu Perfil',
  },
  {
    key: 'clinic-profile',
    path: '/clinic/profile',
    user: 'clinicAdminA',
    loginRedirect: '/clinic/dashboard',
    readyHeading: 'Meu Perfil',
  },
];
