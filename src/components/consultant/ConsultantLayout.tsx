"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConsultantLayoutProps {
  children: ReactNode;
}

export function ConsultantLayout({ children }: ConsultantLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = [
    {
      name: "Dashboard",
      href: "/consultant/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Minhas Clínicas",
      href: "/consultant/clinics",
      icon: Building2,
    },
    {
      name: "Buscar Clínicas",
      href: "/consultant/clinics/search",
      icon: Search,
    },
    {
      name: "Relatórios",
      href: "/consultant/reports",
      icon: FileBarChart,
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#f5f3ef]">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-card border-r flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("p-6", collapsed && "p-4")}>
          {!collapsed ? (
            <>
              <h2 className="text-xl font-bold text-sky-600">Portal Consultor</h2>
              <p className="text-sm text-muted-foreground">Curva Mestra</p>
            </>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-bold text-sky-600">PC</h2>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sky-600 text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2">
          {!collapsed ? (
            <>
              <Link href="/consultant/profile">
                <Button variant="ghost" className="w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </>
          ) : (
            <>
              <Link href="/consultant/profile">
                <Button
                  variant="ghost"
                  className="w-full justify-center p-2"
                  title="Meu Perfil"
                >
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full justify-center p-2 text-destructive hover:text-destructive"
                onClick={handleSignOut}
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            className="w-full justify-center p-2"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#f5f3ef] h-screen">{children}</main>
    </div>
  );
}
