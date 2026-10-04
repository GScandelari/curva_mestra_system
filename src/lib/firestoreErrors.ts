/**
 * Traduz códigos de erro do Firestore (SDK client) para mensagens
 * amigáveis em português — por padrão, essas telas exibiam `error.message`
 * cru ao usuário (ex.: "Missing or insufficient permissions."), sem
 * nenhuma tradução (ver UC-09-RNF-03).
 *
 * `code` é o campo `error.code` de um `FirestoreError`
 * (ex.: "permission-denied", "unavailable") — não a mensagem completa.
 */
export function translateFirestoreError(code: string | undefined): string {
  switch (code) {
    case 'permission-denied':
      return 'Você não tem permissão para realizar esta ação.';
    case 'unavailable':
      return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
    case 'not-found':
      return 'O registro solicitado não foi encontrado.';
    case 'deadline-exceeded':
      return 'A operação demorou demais para responder. Tente novamente.';
    case 'resource-exhausted':
      return 'Limite de uso excedido. Tente novamente mais tarde.';
    case 'unauthenticated':
      return 'Sua sessão expirou. Faça login novamente.';
    case 'cancelled':
      return 'A operação foi cancelada.';
    default:
      return 'Ocorreu um erro inesperado. Tente novamente.';
  }
}
