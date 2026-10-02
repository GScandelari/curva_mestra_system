/**
 * Config Jest dedicada para a suíte de teste de `firestore.rules`
 * (@firebase/rules-unit-testing). Separada da config principal
 * (jest.config.js) de propósito:
 *
 * - Precisa de uma sessão real do Firebase Emulator Suite rodando (ver
 *   script `test:rules` em package.json, que embrulha esta config com
 *   `firebase emulators:exec --only firestore`) -- não pode rodar junto da
 *   suíte unitária normal (`npm test`), que roda sem nenhum emulador.
 * - NÃO usa o `setupFiles` de env fake do client SDK
 *   (`src/lib/__mocks__/firebase-env.ts`) -- @firebase/rules-unit-testing
 *   cria seu próprio contexto de teste, isolado do client SDK da aplicação.
 * - Precisa de um `testTimeout` maior: cada teste sobe/derruba contexto
 *   autenticado contra o emulador real, mais lento que uma função pura.
 *
 * Reaproveita `next/jest` apenas pelo transform (SWC) para TypeScript --
 * não pelo ambiente Next.js, que não é necessário aqui.
 */
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/rules/**/*.test.ts'],
  testTimeout: 30000,
};

module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    setupFiles: [],
  };
};
