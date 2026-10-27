'use client';

import { CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { cn } from '@/lib/utils';

interface ManualPasswordSectionProps {
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  forcePasswordChange: boolean;
  onForcePasswordChange: (value: boolean) => void;
  settingPassword: boolean;
  success: boolean;
  successMessage?: string;
  onSubmit: () => void;
  /** Bloqueio extra do botão (ex.: outra operação do diálogo em andamento). */
  disabled?: boolean;
  /** Botão ocupando a largura toda (diálogo de edição de usuário). */
  fullWidthButton?: boolean;
}

/**
 * Seção "Definir Senha Manualmente" do system_admin (UC-30 e UC-37), usada em
 * /admin/users e /admin/consultants/[id]. Só apresentação: validação e chamada
 * da API continuam em cada página.
 */
export function ManualPasswordSection({
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  forcePasswordChange,
  onForcePasswordChange,
  settingPassword,
  success,
  successMessage,
  onSubmit,
  disabled = false,
  fullWidthButton = false,
}: Readonly<ManualPasswordSectionProps>) {
  return (
    <div className="pt-4 border-t space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-orange-500" />
        <Label className="font-medium">Definir Senha Manualmente</Label>
      </div>

      {success ? (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              {successMessage || 'Senha definida com sucesso!'}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Use para suporte quando o sistema de email falhar. A senha é definida imediatamente.
          </p>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="Repita a senha"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="forcePasswordChange"
              checked={forcePasswordChange}
              onCheckedChange={(checked) => onForcePasswordChange(checked === true)}
            />
            <Label htmlFor="forcePasswordChange" className="text-sm font-normal cursor-pointer">
              Solicitar troca de senha no próximo login
            </Label>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onSubmit}
            disabled={disabled || settingPassword || !newPassword || !confirmPassword}
            className={cn(
              'border-orange-200 text-orange-700 hover:bg-orange-50',
              fullWidthButton && 'w-full'
            )}
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {settingPassword ? 'Definindo...' : 'Definir Senha'}
          </Button>
        </div>
      )}
    </div>
  );
}
