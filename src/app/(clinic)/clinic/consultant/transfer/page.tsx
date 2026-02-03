"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ConsultantResult {
  id: string;
  code: string;
  name: string;
  email: string;
}

export default function TransferConsultantPage() {
  const router = useRouter();
  const { user, tenantId } = useAuth();
  const { toast } = useToast();

  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ConsultantResult | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSearch = async () => {
    if (!user) return;

    const code = searchCode.replace(/\D/g, "");

    if (code.length !== 6) {
      toast({ title: "Informe um código de 6 dígitos", variant: "destructive" });
      return;
    }

    setSearching(true);
    setSearchResult(null);

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/by-code/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          toast({ title: "Consultor não encontrado", variant: "destructive" });
        } else {
          throw new Error(data.error || "Erro ao buscar consultor");
        }
        return;
      }

      setSearchResult(data.data);
    } catch (error: any) {
      toast({ title: error.message || "Erro ao buscar consultor", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!user || !tenantId || !searchResult) return;

    if (!confirm(`Tem certeza que deseja vincular o consultor ${searchResult.name}?`)) {
      return;
    }

    setTransferring(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/tenants/${tenantId}/consultant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_consultant_id: searchResult.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao transferir consultoria");
      }

      setSuccess(true);
      toast({ title: "Consultor vinculado com sucesso!" });

      // Redirect after a delay
      setTimeout(() => {
        router.push("/clinic/consultant");
      }, 2000);
    } catch (error: any) {
      toast({ title: error.message || "Erro ao vincular consultor", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  if (success) {
    return (
      <div className="container py-8 max-w-lg">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Consultor Vinculado!
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchResult?.name} agora tem acesso aos dados da sua clínica.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecionando...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-lg">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push("/clinic/consultant")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-8 w-8 text-primary" />
            Vincular Consultor
          </h1>
          <p className="text-muted-foreground">
            Informe o código do consultor para vincular à sua clínica
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar por Código</CardTitle>
            <CardDescription>
              O consultor deve informar seu código de 6 dígitos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código do Consultor</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="font-mono text-center text-xl tracking-widest"
                  maxLength={6}
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || searchCode.length !== 6}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Result */}
        {searchResult && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Consultor Encontrado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-semibold">{searchResult.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{searchResult.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Código</span>
                  <span className="font-mono">{searchResult.code}</span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleTransfer}
                disabled={transferring}
              >
                {transferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserCheck className="mr-2 h-4 w-4" />
                Confirmar Vínculo
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Como funciona?</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Solicite o código de 6 dígitos ao consultor</li>
                <li>Busque o consultor pelo código</li>
                <li>Confirme o vínculo</li>
                <li>O consultor terá acesso imediato aos dados (read-only)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
