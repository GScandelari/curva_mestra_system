import { translateFirestoreError } from '@/lib/firestoreErrors';

/**
 * Regras puras para distinguir "falha ao carregar" de "não há dados" nos
 * blocos de leitura das telas (lote "erro exibido como estado vazio":
 * UX-025, UX-026, UX-038, UX-047, UX-050, UX-051, UX-053).
 * Ver ONLY_FOR_DEVS/TO_DO/BUGFIX-ux-erro-exibido-como-vazio.md.
 *
 * Sem imports de `firebase/*`, para poderem ser testadas com Jest.
 */

export type LoadView = 'loading' | 'error' | 'empty' | 'ready';

export const LOAD_ERROR_MESSAGES = {
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  session: 'Sua sessão expirou. Faça login novamente.',
  server: 'O servidor não conseguiu responder agora. Tente novamente em instantes.',
} as const;

/** Resposta de API route com status de erro (ou 2xx ilegível). */
export class ApiLoadError extends Error {
  readonly status: number;
  /** `body.error` quando for string; undefined caso contrário. */
  readonly serverMessage?: string;

  constructor(status: number, serverMessage?: string) {
    super(`API respondeu ${status}`);
    this.name = 'ApiLoadError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/**
 * Lê `{ data }` de uma resposta de API route. `!ok` e corpo ilegível viram
 * `ApiLoadError` — nunca lista vazia.
 */
export async function readApiData<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const record =
    body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null;

  if (!response.ok) {
    throw new ApiLoadError(
      response.status,
      typeof record?.error === 'string' ? record.error : undefined
    );
  }
  if (!record) throw new ApiLoadError(response.status);

  return record.data as T;
}

/**
 * Mensagem pt-BR para o detalhe do erro. Mensagem da API só em 4xx (exceto
 * 401): o 500 das rotas do consultor devolve `error.message` cru do servidor.
 */
export function describeLoadError(error: unknown): string {
  if (error instanceof ApiLoadError) {
    if (error.status === 401) return LOAD_ERROR_MESSAGES.session;
    if (error.status >= 400 && error.status < 500 && error.serverMessage) {
      return error.serverMessage;
    }
    return LOAD_ERROR_MESSAGES.server;
  }

  // fetch() rejeita com TypeError quando a rede falha.
  if (error instanceof TypeError) return LOAD_ERROR_MESSAGES.network;

  const code =
    error !== null &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;

  if (code === 'auth/network-request-failed') return LOAD_ERROR_MESSAGES.network;
  if (code?.startsWith('auth/')) return LOAD_ERROR_MESSAGES.session;
  return translateFirestoreError(code);
}

/** Precedência carregando > erro > vazio > dados: um bloco com erro nunca é "vazio". */
export function resolveLoadView(state: {
  loading: boolean;
  error: boolean;
  isEmpty: boolean;
}): LoadView {
  if (state.loading) return 'loading';
  if (state.error) return 'error';
  if (state.isEmpty) return 'empty';
  return 'ready';
}
