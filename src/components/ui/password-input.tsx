'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { getPasswordToggleState } from '@/lib/passwordVisibility';

/** O `type` é controlado pelo componente e não pode ser sobrescrito. */
export type PasswordInputProps = Omit<InputProps, 'type'>;

/**
 * Campo de senha com botão acessível de mostrar/ocultar (UX-060).
 * Cada instância tem estado próprio e sempre começa oculta (RN-01).
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const state = getPasswordToggleState(visible);

    return (
      <div className="relative">
        <Input
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...props}
          id={inputId}
          ref={ref}
          type={state.inputType}
          disabled={disabled}
          className={cn('pr-10 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden', className)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={state.buttonLabel}
          aria-controls={inputId}
          disabled={disabled}
          // Clique de mouse/toque não tira o foco do campo (o teclado móvel não fecha).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
