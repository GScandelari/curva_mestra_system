'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskCNPJ, maskCPF } from '@/lib/utils/documentValidation';
import { validateAccessRequestInput } from '@/lib/accessRequestPayload';
import type { DocumentType } from '@/types';

type Role = 'especialista' | 'consultor';

const EMPTY_FORM = {
  fullName: '',
  councilNumber: '', // número do conselho (especialista) ou ID Rennova (consultor)
  email: '',
  phone: '',
  businessName: '', // nome da clínica (só especialista)
  documentNumber: '', // CPF/CNPJ com máscara (só especialista)
  consultantCode: '', // opcional, especialista — código de 6 dígitos (UC-01 RN-08)
};

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [role, setRole] = useState<Role>('especialista');
  const [documentType, setDocumentType] = useState<DocumentType>('cnpj');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Formatar telefone
    if (e.target.id === 'phone') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 11) {
        value = cleaned.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
      }
    }

    // CPF/CNPJ com máscara do tipo escolhido
    if (e.target.id === 'documentNumber') {
      value = documentType === 'cpf' ? maskCPF(value) : maskCNPJ(value);
    }

    // Código do consultor: só dígitos, no máximo 6
    if (e.target.id === 'consultantCode') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }

    setFormData({ ...formData, [e.target.id]: value });
  };

  const handleDocumentTypeChange = (type: DocumentType) => {
    setDocumentType(type);
    setFormData({ ...formData, documentNumber: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const body: Record<string, string> = {
      role,
      full_name: formData.fullName,
      council_number: formData.councilNumber,
      email: formData.email,
      phone: formData.phone,
    };
    if (role === 'especialista') {
      body.business_name = formData.businessName;
      body.document_type = documentType;
      body.document_number = formData.documentNumber;
      if (formData.consultantCode.trim()) {
        body.consultant_code = formData.consultantCode.trim();
      }
    }

    // Mesma validação da API (mesmas mensagens)
    const validation = validateAccessRequestInput(body);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(
          data.message ||
            'Solicitação enviada com sucesso! Nossa equipe responderá em até 2 dias úteis.'
        );
        setFormData(EMPTY_FORM);
        setDocumentType('cnpj');
        setTimeout(() => router.push('/login'), 4000);
      } else {
        setError(data.error || 'Erro ao enviar solicitação');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  const disabled = loading || !!success;
  const especialista = role === 'especialista';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-2xl" data-auth-wide>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Solicitar Acesso</CardTitle>
          <CardDescription className="text-center">
            Distribuição fechada — cada pedido é avaliado em até 2 dias úteis
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 border-green-600 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seletor de perfil */}
            <div className="space-y-2">
              <Label>Qual é o seu perfil? *</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { v: 'especialista' as Role, t: 'Especialista HOF', d: 'Operação clínica' },
                  { v: 'consultor' as Role, t: 'Consultor Rennova', d: 'Acesso comercial' },
                ].map((r) => (
                  <button
                    key={r.v}
                    type="button"
                    onClick={() => setRole(r.v)}
                    disabled={disabled}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                      role === r.v
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    <span className="font-medium text-sm">{r.t}</span>
                    <span className="text-xs text-muted-foreground">{r.d}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nome + Conselho */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo *</Label>
                <Input
                  id="fullName"
                  placeholder="Ex.: Helena Vidal"
                  value={formData.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="councilNumber">
                  {especialista ? 'Número do conselho *' : 'ID Rennova *'}
                </Label>
                <Input
                  id="councilNumber"
                  placeholder={
                    especialista ? 'Ex.: CRM-SP 142337 ou CRO-RJ 5678' : 'Ex.: RNV-CR-0427'
                  }
                  value={formData.councilNumber}
                  onChange={handleChange}
                  className="font-mono text-sm"
                  required
                  disabled={disabled}
                />
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail profissional *</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@clinica.com.br"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
                disabled={disabled}
              />
            </div>

            {/* Telefone + Clínica (especialista) / Telefone (consultor) */}
            <div className={cn('grid gap-3', especialista && 'grid-cols-1 sm:grid-cols-2')}>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 9 9999-9999"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  maxLength={15}
                  required
                  disabled={disabled}
                />
              </div>
              {especialista && (
                <div className="space-y-2">
                  <Label htmlFor="businessName">Nome da clínica *</Label>
                  <Input
                    id="businessName"
                    placeholder="Ex.: Clínica Cíngulo"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    disabled={disabled}
                  />
                </div>
              )}
            </div>

            {/* Campos exclusivos do especialista */}
            {especialista && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="documentNumber">CPF ou CNPJ *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
                    <div className="flex gap-2" role="group" aria-label="Tipo de documento">
                      {(['cnpj', 'cpf'] as DocumentType[]).map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => handleDocumentTypeChange(tipo)}
                          disabled={disabled}
                          aria-pressed={documentType === tipo}
                          className={cn(
                            'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                            documentType === tipo
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:bg-accent'
                          )}
                        >
                          {tipo.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <Input
                      id="documentNumber"
                      placeholder={documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                      value={formData.documentNumber}
                      onChange={handleChange}
                      inputMode="numeric"
                      className="font-mono text-sm"
                      required
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consultantCode">
                    Código do consultor Rennova de referência{' '}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="consultantCode"
                    placeholder="Ex.: 847291"
                    value={formData.consultantCode}
                    onChange={handleChange}
                    inputMode="numeric"
                    maxLength={6}
                    className="font-mono text-sm"
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Código de 6 dígitos informado pelo seu consultor Rennova.
                  </p>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={disabled}>
              {loading ? 'Enviando...' : 'Solicitar acesso à Curva Mestra →'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Já tem uma conta?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Fazer login
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            Após enviar, aguarde nossa avaliação. Você receberá o acesso por e-mail.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
