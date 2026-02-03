"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Search, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ClinicCard } from "@/components/consultant/ClinicCard";

interface Clinic {
  id: string;
  name: string;
  document_type?: string;
  document_number?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

export default function ConsultantClinicsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      loadClinics();
    }
  }, [user]);

  const loadClinics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await fetch("/api/consultants/me/clinics", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setClinics(data.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar clínicas:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = clinics.filter((clinic) => {
    const search = searchTerm.toLowerCase();
    return (
      clinic.name.toLowerCase().includes(search) ||
      clinic.document_number?.includes(search) ||
      clinic.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8 text-sky-600" />
              Minhas Clínicas
            </h1>
            <p className="text-muted-foreground">
              Clínicas vinculadas à sua conta de consultor
            </p>
          </div>
          <Button
            onClick={() => router.push("/consultant/clinics/search")}
            className="bg-sky-600 hover:bg-sky-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Buscar Nova Clínica
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, documento ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clinics Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
          </div>
        ) : filteredClinics.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {clinics.length === 0 ? (
                  <>
                    <p className="text-lg font-medium mb-2">
                      Nenhuma clínica vinculada
                    </p>
                    <p className="text-muted-foreground mb-4">
                      Busque clínicas por CNPJ/CPF para solicitar vínculo
                    </p>
                    <Button
                      onClick={() => router.push("/consultant/clinics/search")}
                      className="bg-sky-600 hover:bg-sky-700"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Buscar Clínicas
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhuma clínica encontrada com os filtros aplicados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
