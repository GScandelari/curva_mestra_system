"use client";

import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TermsInterceptor } from "@/components/auth/TermsInterceptor";
import { SessionTimeoutManager } from "@/components/auth/SessionTimeoutManager";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <SessionTimeoutManager />
      <TermsInterceptor>
        {children}
      </TermsInterceptor>
      <Toaster />
    </>
  );
}
