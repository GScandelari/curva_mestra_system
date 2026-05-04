'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Building2, Loader2, CheckCircle2, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ClaimClinicDialog } from '@/components/consultant/ClaimClinicDialog';

interface Tenant {
  id: string;
  name: string;
  document_type?: string;
  document_number?: string;
  email?: string;
  consultant_id?: string | null;
  consultant_name?: string | null;
}

export default function SearchClinicsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [document, setDocument] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Tenant[]>([]);
  const [searched, setSearched] = useState(false);

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, '');

    if (digits.length <= 11) {
      // CPF
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }

    // CNPJ
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2');
  };

  const handleSearch = async () => {
    if (!user) return;

    const cleanDoc = document.replace(/\D/g, '');

    if (cleanDoc.length < 11) {
      toast({ title: 'Informe um CPF ou CNPJ válido', variant: 'destructive' });
      return;
    }

    setSearching(true);
    setSearched(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/tenants/search?document=${cleanDoc}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar clínicas');
      }

      setResults(data.data || []);

      if (data.data?.length === 0) {
        toast({ title: 'Nenhuma clínica encontrada com este documento' });
      }
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao buscar clínicas', variant: 'destructive' });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClaimSuccess = () => {
    // Refazer busca para atualizar status
    handleSearch();
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Search className="h-8 w-8 text-sky-600" />
            Buscar Clínicas
          </h1>
          <p className="text-muted-foreground">
            Encontre clínicas por CNPJ ou CPF para vincular ou solicitar transferência
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar por Documento</CardTitle>
            <CardDescription>Informe o CNPJ ou CPF da clínica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document">CNPJ ou CPF</Label>
              <div className="flex gap-2">
                <Input
                  id="document"
                  value={document}
                  onChange={(e) => setDocument(formatDocument(e.target.value))}
                  placeholder="00.000.000/0000-00 ou 000.000.000-00"
                  className="font-mono"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-sky-600 hover:bg-sky-700"
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

        {/* Results */}
        {searched && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {results.length === 0
                  ? 'Nenhuma clínica encontrada'
                  : `${results.length} clínica(s) encontrada(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma clínica cadastrada com este documento.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Verifique se o documento está correto ou entre em contato com a clínica.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((tenant) => (
                    <div key={tenant.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-6 w-6 text-sky-600" />
                          <div>
                            <p className="font-semibold">{tenant.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {tenant.document_type?.toUpperCase()}: {tenant.document_number}
                            </p>
                            {tenant.email && (
                              <p className="text-sm text-muted-foreground">{tenant.email}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {tenant.consultant_id ? (
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setDialogOpen(true);
                          }}
                        >
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Solicitar Transferência
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-sky-600 hover:bg-sky-700"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setDialogOpen(true);
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Vincular Agora
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
              <h4 className="font-medium text-sky-800 mb-2">Como funciona?</h4>
              <ol className="list-decimal list-inside text-sm text-sky-700 space-y-1">
                <li>Busque a clínica pelo CNPJ ou CPF</li>
                <li>Se a clínica não tem consultor → vínculo automático imediato</li>
                <li>Se a clínica já tem consultor → envie um pedido de transferência</li>
                <li>O consultor atual aprova ou rejeita o pedido</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <ClaimClinicDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={selectedTenant}
        onSuccess={handleClaimSuccess}
      />
    </div>
  );
}
