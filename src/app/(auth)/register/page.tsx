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

type Role = 'especialista' | 'consultor';

const VOLUME_OPTIONS = ['Até 30', '30–80', '80–150', '150+'] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [role, setRole] = useState<Role>('especialista');
  const [volume, setVolume] = useState<string>('30–80');
  const [formData, setFormData] = useState({
    fullName: '',
    councilNumber: '', // CRM/CRO ou ID Rennova
    email: '',
    phone: '',
    businessName: '', // clínica (especialista) ou região/carteira (consultor)
    consultantReference: '', // opcional, especialista
  });
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

    setFormData({ ...formData, [e.target.id]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.fullName || formData.fullName.trim().length < 3) {
      setError('Nome completo inválido');
      return;
    }
    if (!formData.councilNumber || formData.councilNumber.trim().length < 3) {
      setError(
        role === 'especialista'
          ? 'Número de conselho (CRM/CRO) é obrigatório'
          : 'ID Rennova é obrigatório'
      );
      return;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setError('E-mail inválido');
      return;
    }
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
      setError('Telefone inválido');
      return;
    }
    if (!formData.businessName || formData.businessName.trim().length < 3) {
      setError(
        role === 'especialista'
          ? 'Nome da clínica é obrigatório'
          : 'Região / carteira é obrigatória'
      );
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string | undefined> = {
        role,
        full_name: formData.fullName,
        council_number: formData.councilNumber,
        email: formData.email,
        phone: formData.phone,
        business_name: formData.businessName,
      };
      if (role === 'especialista') {
        body.volume = volume;
        if (formData.consultantReference.trim()) {
          body.consultant_reference = formData.consultantReference.trim();
        }
      }

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
        setFormData({
          fullName: '',
          councilNumber: '',
          email: '',
          phone: '',
          businessName: '',
          consultantReference: '',
        });
        setTimeout(() => router.push('/login'), 4000);
      } else {
        setError(data.error || 'Erro ao enviar solicitação');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar solicitação');
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg">
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
            <div className="grid grid-cols-2 gap-3">
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
                  {role === 'especialista' ? 'CRM / CRO / nº conselho *' : 'ID Rennova *'}
                </Label>
                <Input
                  id="councilNumber"
                  placeholder={role === 'especialista' ? 'Ex.: CRM-SP 142337' : 'Ex.: RNV-CR-0427'}
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

            {/* Telefone + Clínica/Região */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label htmlFor="businessName">
                  {role === 'especialista' ? 'Nome da clínica *' : 'Região / carteira *'}
                </Label>
                <Input
                  id="businessName"
                  placeholder={role === 'especialista' ? 'Ex.: Clínica Cíngulo' : 'Ex.: Sudeste 2'}
                  value={formData.businessName}
                  onChange={handleChange}
                  required
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Campos exclusivos do especialista */}
            {role === 'especialista' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="consultantReference">
                    Consultor Rennova de referência{' '}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    id="consultantReference"
                    placeholder="Nome do seu consultor"
                    value={formData.consultantReference}
                    onChange={handleChange}
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Volume de procedimentos por mês</Label>
                  <div className="flex flex-wrap gap-2">
                    {VOLUME_OPTIONS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVolume(v)}
                        disabled={disabled}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-sm font-mono transition-colors',
                          volume === v
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
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
