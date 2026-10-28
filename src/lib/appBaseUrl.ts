import { resolveAppBaseUrl } from '@/lib/emailLayout';

/**
 * URL base do ambiente (Next) para links e imagens de e-mail — nunca vem do
 * header Host da requisição.
 */
export function getAppBaseUrl(): string {
  return resolveAppBaseUrl({
    explicitBaseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    fallbackLocalUrl: process.env.PLAYWRIGHT_BASE_URL,
  });
}
