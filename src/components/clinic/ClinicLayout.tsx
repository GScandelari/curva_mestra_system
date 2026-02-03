"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface ClinicLayoutProps {
  children: ReactNode;
}

export function ClinicLayout({ children }: ClinicLayoutProps) {
  const { user, claims, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = claims?.role === "clinic_admin";

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  const navLinks = [
    { href: "/clinic/dashboard", label: "Dashboard" },
    { href: "/clinic/inventory", label: "Gerenciar Estoque" },
    { href: "/clinic/requests", label: "Procedimentos" },
    { href: "/clinic/patients", label: "Pacientes" },
    { href: "/clinic/reports", label: "Relatórios" },
    { href: "/clinic/consultant", label: "Consultor" },
    { href: "/clinic/my-clinic", label: "Minha Clínica" },
    { href: "/clinic/profile", label: "Perfil" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo e Nav Desktop */}
          <div className="flex items-center gap-6">
            <Link href="/clinic/dashboard">
              <h1 className="text-2xl font-bold text-primary">Curva Mestra</h1>
            </Link>

            {/* Nav Desktop */}
            <nav className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive(link.href)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* User Info, Notifications e Logout */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : "Usuário"}
              </p>
            </div>

            {/* Notification Bell */}
            <NotificationBell playSound={true} />

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t md:hidden">
            <nav className="container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
