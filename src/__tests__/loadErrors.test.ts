import { translateFirestoreError } from '@/lib/firestoreErrors';
import {
  ApiLoadError,
  LOAD_ERROR_MESSAGES,
  describeLoadError,
  readApiData,
  resolveLoadView,
} from '@/lib/loadErrors';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function readError(response: Response): Promise<ApiLoadError> {
  try {
    await readApiData(response);
  } catch (err) {
    if (err instanceof ApiLoadError) return err;
    throw err;
  }
  throw new Error('readApiData deveria ter lançado');
}

describe('readApiData', () => {
  it('returns data from a 200 response', async () => {
    await expect(readApiData<number[]>(json(200, { data: [1] }))).resolves.toEqual([1]);
  });

  it('returns undefined when a 200 response has no data field', async () => {
    await expect(readApiData(json(200, { success: true }))).resolves.toBeUndefined();
  });

  it('throws on a 200 response with a non-JSON body', async () => {
    const err = await readError(new Response('<html>oops</html>', { status: 200 }));
    expect(err.status).toBe(200);
    expect(err.serverMessage).toBeUndefined();
  });

  it('throws with the server message on a 500', async () => {
    const err = await readError(json(500, { error: 'X' }));
    expect(err.status).toBe(500);
    expect(err.serverMessage).toBe('X');
  });

  it('throws with the server message on a 403', async () => {
    const err = await readError(json(403, { error: 'Acesso negado' }));
    expect(err.status).toBe(403);
    expect(err.serverMessage).toBe('Acesso negado');
  });

  it('throws without a message on a 404 with no body', async () => {
    const err = await readError(new Response(null, { status: 404 }));
    expect(err.status).toBe(404);
    expect(err.serverMessage).toBeUndefined();
  });

  it('ignores a non-string error field', async () => {
    const err = await readError(json(400, { error: { code: 1 } }));
    expect(err.serverMessage).toBeUndefined();
  });
});

describe('describeLoadError', () => {
  it('uses the session message on 401, ignoring the server text', () => {
    expect(describeLoadError(new ApiLoadError(401, 'x'))).toBe(LOAD_ERROR_MESSAGES.session);
  });

  it('shows the server message on a 4xx', () => {
    expect(describeLoadError(new ApiLoadError(403, 'Acesso restrito a consultores'))).toBe(
      'Acesso restrito a consultores'
    );
  });

  it('uses the server message fallback on a 4xx without text', () => {
    expect(describeLoadError(new ApiLoadError(404))).toBe(LOAD_ERROR_MESSAGES.server);
  });

  it('never shows the raw server text on a 5xx', () => {
    expect(describeLoadError(new ApiLoadError(500, 'Missing or insufficient permissions.'))).toBe(
      LOAD_ERROR_MESSAGES.server
    );
  });

  it('treats a fetch TypeError as a network failure', () => {
    expect(describeLoadError(new TypeError('Failed to fetch'))).toBe(LOAD_ERROR_MESSAGES.network);
  });

  it('treats auth/network-request-failed as a network failure', () => {
    expect(describeLoadError({ code: 'auth/network-request-failed' })).toBe(
      LOAD_ERROR_MESSAGES.network
    );
  });

  it('treats other auth errors as an expired session', () => {
    expect(describeLoadError({ code: 'auth/user-token-expired' })).toBe(
      LOAD_ERROR_MESSAGES.session
    );
  });

  it.each(['permission-denied', 'unavailable'])('translates the Firestore code %s', (code) => {
    expect(describeLoadError({ code })).toBe(translateFirestoreError(code));
  });

  it.each([new Error('boom'), null, 'string'])('falls back to the generic message for %p', (e) => {
    expect(describeLoadError(e)).toBe(translateFirestoreError(undefined));
  });
});

describe('resolveLoadView', () => {
  it('prefers loading over everything', () => {
    expect(resolveLoadView({ loading: true, error: true, isEmpty: true })).toBe('loading');
  });

  it('never reports empty when there is an error', () => {
    expect(resolveLoadView({ loading: false, error: true, isEmpty: true })).toBe('error');
  });

  it('reports empty after a successful read with no items', () => {
    expect(resolveLoadView({ loading: false, error: false, isEmpty: true })).toBe('empty');
  });

  it('reports ready when there are items', () => {
    expect(resolveLoadView({ loading: false, error: false, isEmpty: false })).toBe('ready');
  });
});
