/**
 * Estado → atributos do botão de mostrar/ocultar senha (UX-060).
 * Decisão D1 (padrão GOV.UK): o rótulo descreve a ação do próximo clique e o
 * botão não usa `aria-pressed`. Ver ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-toggle-visibilidade-senha.md.
 */

export const SHOW_PASSWORD_LABEL = 'Mostrar senha';
export const HIDE_PASSWORD_LABEL = 'Ocultar senha';

export interface PasswordToggleState {
  inputType: 'password' | 'text';
  buttonLabel: typeof SHOW_PASSWORD_LABEL | typeof HIDE_PASSWORD_LABEL;
}

export function getPasswordToggleState(visible: boolean): PasswordToggleState {
  return {
    inputType: visible ? 'text' : 'password',
    buttonLabel: visible ? HIDE_PASSWORD_LABEL : SHOW_PASSWORD_LABEL,
  };
}
