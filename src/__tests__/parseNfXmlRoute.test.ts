/**
 * POST /api/parse-nf-xml (UC-10-RN-13): autenticação, autorização e limites
 * antes do parse. Só o Admin SDK e o parser são mockados.
 */
const mockVerifyIdToken = jest.fn();
const mockParseNfeXml = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a) },
  adminDb: {},
}));

jest.mock('../lib/parseNfeXml', () => ({
  parseNfeXml: (...a: unknown[]) => mockParseNfeXml(...a),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/parse-nf-xml/route';
import { MAX_NFE_XML_BYTES } from '@/lib/validations/nfeUploadValidation';

const adminClaims = { uid: 'u1', role: 'clinic_admin', active: true, tenant_id: 'tenant-a' };
const parsedNF = { numero: '026229', produtos: [{ codigo: '3029055' }] };

function xmlFile(name = 'nota.xml', size = 64): File {
  return new File(['x'.repeat(size)], name, { type: 'text/xml' });
}

function request(
  files: File[],
  options: { token?: string | null; contentLength?: string } = {}
): NextRequest {
  const form = new FormData();
  files.forEach((file, i) => form.append(i === 0 ? 'file' : `extra${i}`, file));
  const headers: Record<string, string> = {};
  const token = options.token === undefined ? 'tok' : options.token;
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest('http://localhost/api/parse-nf-xml', {
    method: 'POST',
    headers,
    body: form,
  });
  if (options.contentLength) {
    jest
      .spyOn(req.headers, 'get')
      .mockImplementation((name: string) =>
        name.toLowerCase() === 'content-length'
          ? options.contentLength!
          : name.toLowerCase() === 'authorization' && token
            ? `Bearer ${token}`
            : null
      );
  }
  return req;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue(adminClaims);
  mockParseNfeXml.mockReturnValue({ data: parsedNF, errors: [] });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/parse-nf-xml', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await POST(request([xmlFile()], { token: null }));
    expect(res.status).toBe(401);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockParseNfeXml).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid'));
    const res = await POST(request([xmlFile()]));
    expect(res.status).toBe(401);
    expect(mockParseNfeXml).not.toHaveBeenCalled();
  });

  it('returns 403 for a clinic_user', async () => {
    mockVerifyIdToken.mockResolvedValue({ ...adminClaims, role: 'clinic_user' });
    const res = await POST(request([xmlFile()]));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'Apenas administradores ativos da clínica podem importar NF-e',
    });
    expect(mockParseNfeXml).not.toHaveBeenCalled();
  });

  it('returns 403 for an inactive clinic_admin', async () => {
    mockVerifyIdToken.mockResolvedValue({ ...adminClaims, active: false });
    const res = await POST(request([xmlFile()]));
    expect(res.status).toBe(403);
  });

  it('returns 413 when the declared body is above the limit, before parsing', async () => {
    const res = await POST(request([xmlFile()], { contentLength: String(20 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(mockParseNfeXml).not.toHaveBeenCalled();
  });

  it('returns 400 for more than one file', async () => {
    const res = await POST(request([xmlFile(), xmlFile('outra.xml')]));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Envie apenas um arquivo XML por vez' });
  });

  it('returns 413 for a file above 10MB', async () => {
    const res = await POST(request([xmlFile('nota.xml', MAX_NFE_XML_BYTES + 1)]));
    expect(res.status).toBe(413);
    expect(mockParseNfeXml).not.toHaveBeenCalled();
  });

  it('returns 200 with the parsed NF for an active clinic_admin', async () => {
    const res = await POST(request([xmlFile()]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ parsedNF, warnings: [] });
    expect(mockParseNfeXml).toHaveBeenCalledWith('x'.repeat(64));
  });

  it('keeps 422 when the parser throws', async () => {
    mockParseNfeXml.mockImplementation(() => {
      throw new Error('XML inválido');
    });
    const res = await POST(request([xmlFile()]));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'XML inválido' });
  });
});
