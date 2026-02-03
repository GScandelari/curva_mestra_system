"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClinicCardProps {
  clinic: {
    id: string;
    name: string;
    document_type?: string;
    document_number?: string;
    email?: string;
    phone?: string;
    active?: boolean;
  };
  className?: string;
}

function formatDocument(type?: string, number?: string): string {
  if (!number) return "—";

  const clean = number.replace(/\D/g, "");

  if (type === "cpf" || clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  // CNPJ
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function ClinicCard({ clinic, className }: ClinicCardProps) {
  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            <CardTitle className="text-lg">{clinic.name}</CardTitle>
          </div>
          <Badge variant={clinic.active ? "default" : "secondary"}>
            {clinic.active ? "Ativa" : "Inativa"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {clinic.document_type?.toUpperCase()}: {formatDocument(clinic.document_type, clinic.document_number)}
          </span>
        </div>
        {clinic.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{clinic.email}</span>
          </div>
        )}
        {clinic.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{clinic.phone}</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link href={`/consultant/clinics/${clinic.id}`} className="w-full">
          <Button variant="outline" className="w-full">
            Visualizar Dados
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
