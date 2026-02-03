"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface Clinic {
  id: string;
  name: string;
  document_number?: string;
}

interface ClinicSelectorProps {
  clinics: Clinic[];
  selectedClinicId?: string;
  onSelect?: (clinicId: string) => void;
  className?: string;
}

export function ClinicSelector({
  clinics,
  selectedClinicId,
  onSelect,
  className,
}: ClinicSelectorProps) {
  const router = useRouter();
  const [value, setValue] = useState(selectedClinicId || "");

  const handleSelect = (clinicId: string) => {
    setValue(clinicId);
    if (onSelect) {
      onSelect(clinicId);
    } else {
      router.push(`/consultant/clinics/${clinicId}`);
    }
  };

  if (clinics.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Building2 className="h-4 w-4" />
        <span>Nenhuma clínica vinculada</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={handleSelect}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <SelectValue placeholder="Selecione uma clínica" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {clinics.map((clinic) => (
          <SelectItem key={clinic.id} value={clinic.id}>
            {clinic.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
