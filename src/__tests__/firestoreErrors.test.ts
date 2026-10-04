import { translateFirestoreError } from '@/lib/firestoreErrors';

describe('translateFirestoreError', () => {
  it('translates permission-denied', () => {
    expect(translateFirestoreError('permission-denied')).toBe(
      'Você não tem permissão para realizar esta ação.'
    );
  });

  it('translates unavailable', () => {
    expect(translateFirestoreError('unavailable')).toBe(
      'Serviço temporariamente indisponível. Tente novamente em instantes.'
    );
  });

  it('translates not-found', () => {
    expect(translateFirestoreError('not-found')).toBe('O registro solicitado não foi encontrado.');
  });

  it('translates unauthenticated', () => {
    expect(translateFirestoreError('unauthenticated')).toBe(
      'Sua sessão expirou. Faça login novamente.'
    );
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(translateFirestoreError('some-unknown-code')).toBe(
      'Ocorreu um erro inesperado. Tente novamente.'
    );
  });

  it('falls back to a generic message for undefined', () => {
    expect(translateFirestoreError(undefined)).toBe('Ocorreu um erro inesperado. Tente novamente.');
  });
});
