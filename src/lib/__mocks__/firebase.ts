/**
 * Mock do Firebase para testes unitários.
 * Substitui a inicialização real do Firebase SDK que requer credenciais válidas.
 */

export const app = {};

export const auth = {
  currentUser: null,
};

export const db = {};

export const storage = {};

export const functions = {};

export const isAuthenticated = jest.fn(() => false);

export const getUserToken = jest.fn(async () => null);

export const getUserClaims = jest.fn(async () => null);

export const isSystemAdmin = jest.fn(async () => false);

export const getUserTenantId = jest.fn(async () => null);
