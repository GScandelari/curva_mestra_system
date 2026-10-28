import {
  HIDE_PASSWORD_LABEL,
  SHOW_PASSWORD_LABEL,
  getPasswordToggleState,
} from '@/lib/passwordVisibility';

describe('getPasswordToggleState', () => {
  it('keeps the password hidden and offers to show it', () => {
    expect(getPasswordToggleState(false)).toEqual({
      inputType: 'password',
      buttonLabel: 'Mostrar senha',
    });
  });

  it('shows the password and offers to hide it', () => {
    expect(getPasswordToggleState(true)).toEqual({
      inputType: 'text',
      buttonLabel: 'Ocultar senha',
    });
  });

  it.each([false, true])('returns only inputType and buttonLabel (no pressed) for %p', (v) => {
    expect(Object.keys(getPasswordToggleState(v)).sort()).toEqual(['buttonLabel', 'inputType']);
  });
});

describe('password toggle labels', () => {
  it('uses the agreed pt-BR texts', () => {
    expect(SHOW_PASSWORD_LABEL).toBe('Mostrar senha');
    expect(HIDE_PASSWORD_LABEL).toBe('Ocultar senha');
  });
});
