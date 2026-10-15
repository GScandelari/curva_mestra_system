/**
 * Callable Function: Reprocessar pendências de um código do catálogo
 * Botão "Reprocessar" de /admin/pending-products — roda a mesma incorporação
 * do trigger onMasterProductWritten, para quando o trigger falhou ou o produto
 * já estava ativo antes da pendência existir. Apenas system_admin.
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { resolvePendingForCode } from './pendingResolution';

export const reprocessPendingMasterProducts = functions.https.onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    if (request.auth.token.is_system_admin !== true) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores do sistema podem reprocessar pendências'
      );
    }

    const codigo = (request.data as { codigo?: unknown } | undefined)?.codigo;
    if (typeof codigo !== 'string' || codigo.trim() === '') {
      throw new functions.https.HttpsError('invalid-argument', 'Informe o código do produto');
    }

    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    const { incorporados, produtoAtivo } = await resolvePendingForCode(admin.firestore(), codigo);
    return { incorporados, produtoAtivo };
  }
);
