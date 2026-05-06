'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Building2,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  FileBarChart,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'consultant-sidebar-collapsed';

interface ConsultantLayoutProps {
  children: ReactNode;
}

export function ConsultantLayout({ children }: ConsultantLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') setCollapsed(true);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const navigation = [
    { name: 'Dashboard', href: '/consultant/dashboard', icon: LayoutDashboard },
    { name: 'Minhas Clínicas', href: '/consultant/clinics', icon: Building2 },
    { name: 'Buscar Clínicas', href: '/consultant/clinics/search', icon: Search },
    { name: 'Transferências', href: '/consultant/transfer-requests', icon: ArrowRightLeft },
    { name: 'Relatórios', href: '/consultant/reports', icon: FileBarChart },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen flex bg-[#f5f3ef]">
        {/* Sidebar */}
        <aside
          className={cn(
            'relative bg-card border-r flex flex-col transition-all duration-300 ease-in-out',
            mounted ? (collapsed ? 'w-16' : 'w-64') : 'w-64'
          )}
        >
          {/* Toggle button — flutuante na borda direita */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Logo */}
          <div className={cn('p-6 overflow-hidden', collapsed && 'p-4')}>
            {!collapsed ? (
              <>
                <h2 className="text-xl font-bold text-sky-600 whitespace-nowrap">
                  Portal Consultor
                </h2>
                <p className="text-sm text-muted-foreground">Curva Mestra</p>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl font-bold text-sky-600">PC</h2>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

              const linkContent = (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </div>
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/consultant/profile">
                  <Button
                    variant="ghost"
                    className={cn('w-full', collapsed ? 'justify-center px-2' : 'justify-start')}
                  >
                    <User className={cn('h-4 w-4 flex-shrink-0', !collapsed && 'mr-2')} />
                    {!collapsed && 'Meu Perfil'}
                  </Button>
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Meu Perfil</TooltipContent>}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full text-destructive hover:text-destructive',
                    collapsed ? 'justify-center px-2' : 'justify-start'
                  )}
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className={cn('h-4 w-4 flex-shrink-0', !collapsed && 'mr-2')} />
                  {!collapsed && 'Sair'}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Sair</TooltipContent>}
            </Tooltip>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#f5f3ef] h-screen">{children}</main>
      </div>
    </TooltipProvider>
  );
}
