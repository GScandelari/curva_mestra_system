"use client";

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadOnlyBannerProps {
  className?: string;
}

export function ReadOnlyBanner({ className }: ReadOnlyBannerProps) {
  return (
    <div
      className={cn(
        "bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-center gap-3",
        className
      )}
    >
      <Eye className="h-5 w-5 text-sky-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-sky-800">
          Modo Visualização
        </p>
        <p className="text-xs text-sky-600">
          Como consultor, você tem acesso somente leitura aos dados desta clínica.
        </p>
      </div>
    </div>
  );
}
