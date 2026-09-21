import { isEmulatorConfigured } from '../emulatorAdmin';

describe('isEmulatorConfigured', () => {
  it('retorna true quando ambas as env vars do emulador estão setadas', () => {
    expect(
      isEmulatorConfigured({
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(true);
  });

  it('retorna false quando falta FIRESTORE_EMULATOR_HOST', () => {
    expect(
      isEmulatorConfigured({
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  it('retorna false quando falta FIREBASE_AUTH_EMULATOR_HOST', () => {
    expect(
      isEmulatorConfigured({
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  it('retorna false quando nenhuma env var está setada', () => {
    expect(isEmulatorConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
