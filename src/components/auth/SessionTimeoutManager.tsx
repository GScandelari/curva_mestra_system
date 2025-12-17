"use client";

import { useSessionTimeout } from "@/hooks/useSessionTimeout";

export function SessionTimeoutManager() {
  useSessionTimeout();
  return null;
}
