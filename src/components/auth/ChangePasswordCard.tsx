'use client';

import type { FormEvent } from 'react';
import { Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

interface ChangePasswordCardProps {
  currentPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  loading: boolean;
  error: string;
  success: string;
  onSubmit: (e: FormEvent) => void;
  /** Tamanho mínimo da nova senha (8 para system_admin, 6 para usuários de clínica). */
  minLength: number;
  description: string;
  /** Dica abaixo do campo "Nova Senha". */
  newPasswordHint: string;
}

/**
 * Card "Alterar Senha" dos perfis (UC-38 e UC-41). Só apresentação: a
 * reautenticação e a validação continuam em cada página.
 */
export function ChangePasswordCard({
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  loading,
  error,
  success,
  onSubmit,
  minLength,
  description,
  newPasswordHint,
}: Readonly<ChangePasswordCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Alterar Senha
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha Atual</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => onCurrentPasswordChange(e.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <PasswordInput
              id="newPassword"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              disabled={loading}
              required
              minLength={minLength}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">{newPasswordHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              disabled={loading}
              required
              autoComplete="new-password"
            />
          </div>

          {success && (
            <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
              {success}
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <Button type="submit" disabled={loading}>
            <Key className="mr-2 h-4 w-4" />
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
