'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Mail, MapPin } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Tenant } from '@/types/tenant';

export default function ClinicInfoTab() {
  const { claims } = useAuth();
  const tenantId = claims?.tenant_id;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      if (!tenantId) return;
      try {
        setLoading(true);
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        if (tenantDoc.exists()) {
          setTenant({ id: tenantDoc.id, ...tenantDoc.data() } as Tenant);
        }
      } catch (error) {
        console.error('Erro ao carregar dados da clínica:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, [tenantId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Informações da Clínica
        </CardTitle>
        <CardDescription>Dados cadastrais da clínica</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tenant ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Nome da Clínica</Label>
                <p className="font-medium">{tenant.name}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  {tenant.document_type === 'cnpj' ? 'CNPJ' : 'CPF'}
                </Label>
                <p className="font-medium">{tenant.document_number}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{tenant.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Telefone</Label>
                <p className="font-medium">{tenant.phone}</p>
              </div>
            </div>

            {(tenant.address || tenant.city || tenant.state || tenant.cep) && (
              <div className="pt-4 border-t">
                <Label className="text-muted-foreground flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4" />
                  Localização
                </Label>
                <div className="space-y-1">
                  {tenant.address && <p className="text-sm">{tenant.address}</p>}
                  {(tenant.city || tenant.state) && (
                    <p className="text-sm">
                      {[tenant.city, tenant.state].filter(Boolean).join(' - ')}
                    </p>
                  )}
                  {tenant.cep && <p className="text-sm">CEP: {tenant.cep}</p>}
                  {tenant.timezone && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Fuso horário: {tenant.timezone}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os dados da clínica
          </p>
        )}
      </CardContent>
    </Card>
  );
}
