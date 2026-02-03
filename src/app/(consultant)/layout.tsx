"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ConsultantLayout } from "@/components/consultant/ConsultantLayout";

export default function ConsultantRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={["clinic_consultant"]}>
      <ConsultantLayout>{children}</ConsultantLayout>
    </ProtectedRoute>
  );
}
