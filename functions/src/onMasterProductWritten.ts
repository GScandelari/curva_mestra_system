/**
 * Trigger: escrita em master_products/{productId}
 * Quando um produto fica ativo (criado ativo, reativado ou com código
 * alterado), incorpora ao inventário das clínicas as linhas de NF-e que
 * ficaram pendentes por esse código (BUGFIX-identidade-e-duplicidade-nfe).
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { shouldResolvePendingForProduct } from './nfPendingResolutionRules';
import { resolvePendingForCode } from './pendingResolution';

export const onMasterProductWritten = onDocumentWritten(
  {
    document: 'master_products/{productId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const codigo = shouldResolvePendingForProduct(
      event.data?.before.data() ?? null,
      event.data?.after.data() ?? null
    );
    if (!codigo) return;

    // Mesmo guard das demais functions (admin.initializeApp não é chamado em outro lugar)
    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    await resolvePendingForCode(admin.firestore(), codigo);
  }
);
