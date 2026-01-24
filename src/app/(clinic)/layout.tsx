"use client";

import { usePathname } from "next/navigation";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SuspensionInterceptor } from "@/components/auth/SuspensionInterceptor";

export default function ClinicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Rotas de setup/onboarding não devem ter o menu lateral
  const isSetupRoute = pathname?.startsWith("/clinic/setup");

  return (
    <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
      <SuspensionInterceptor>
        {isSetupRoute ? children : <ClinicLayout>{children}</ClinicLayout>}
      </SuspensionInterceptor>
    </ProtectedRoute>
  );
}
