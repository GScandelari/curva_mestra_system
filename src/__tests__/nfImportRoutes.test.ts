/**
 * POST /api/nf-imports/xml e /api/nf-imports/manual (BUGFIX-identidade-e-
 * duplicidade-nfe): autenticação, guardas, tenant vindo do token e mapeamento
 * dos resultados do serviço para status HTTP. Admin SDK, serviço e parser mockados.
 */
const mockVerifyIdToken = jest.fn();
const mockParseNfeXml = jest.fn();
const mockConfirmXml = jest.fn();
const mockConfirmManual = jest.fn();
const mockSaveFile = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a) },
  adminDb: {},
  getAdminApp: jest.fn(),
}));

jest.mock('../lib/parseNfeXml', () => ({
  parseNfeXml: (...a: unknown[]) => mockParseNfeXml(...a),
}));

jest.mock('../lib/services/nfImportServer', () => ({
  confirmXmlImport: (...a: unknown[]) => mockConfirmXml(...a),
  confirmManualLaunch: (...a: unknown[]) => mockConfirmManual(...a),
  saveNfXmlFileBestEffort: (...a: unknown[]) => mockSaveFile(...a),
}));

import { NextRequest } from 'next/server';
import { POST as postXml } from '@/app/api/nf-imports/xml/route';
import { POST as postManual } from '@/app/api/nf-imports/manual/route';
import { validateManualLaunchRequest } from '@/lib/validations/nfManualLaunchValidation';

const admin = { uid: 'u1', role: 'clinic_admin', active: true, tenant_id: 'tenant-a' };
const parsedNF = {
  numero: '26229',
  serie: '1',
  cnpj_fornecedor: '12345678000195',
  chave_acesso: '35250312345678000195550010000262291000262299',
  tipo_nota: 'venda',
  produtos: [{ codigo: '3076528', nome_produto: 'X', lote: 'L1', quantidade: 1 }],
};

function xmlRequest(
  files: File[] = [new File(['<xml/>'], 'nota.xml', { type: 'text/xml' })],
  options: { token?: string | null; extraFields?: Record<string, string> } = {}
) {
  const form = new FormData();
  files.forEach((file, i) => form.append(i === 0 ? 'file' : `extra${i}`, file));
  Object.entries(options.extraFields ?? {}).forEach(([k, v]) => form.append(k, v));
  const token = options.token === undefined ? 'tok' : options.token;
  return new NextRequest('http://localhost/api/nf-imports/xml', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
}

const manualBody = {
  numero: '026229',
  cnpj: '12.345.678/0001-95',
  serie: '001',
  tipo: 'outra_marca',
  produtos: [
    {
      codigo: 'ABC1',
      nome_produto: 'Seringa',
      lote: 'L1',
      quantidade: 10,
      valor_unitario: 2.5,
      dt_validade: '2027-12-31',
    },
  ],
};

function manualRequest(body: unknown = manualBody, token: string | null = 'tok') {
  return new NextRequest('http://localhost/api/nf-imports/manual', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue(admin);
  mockParseNfeXml.mockReturnValue({ data: parsedNF, errors: [] });
  mockConfirmXml.mockResolvedValue({
    kind: 'created',
    importId: '1000',
    produtosImportados: 1,
    pendentes: [],
  });
  mockConfirmManual.mockResolvedValue({
    kind: 'created',
    importId: '1000',
    produtosImportados: 1,
    pendentes: [],
  });
  mockSaveFile.mockResolvedValue('salvo');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe.each([
  ['xml', () => postXml(xmlRequest(undefined, { token: null }))],
  ['manual', () => postManual(manualRequest(manualBody, null))],
])('auth — %s', (_, semToken) => {
  it('returns 401 without token', async () => {
    const res = await semToken();
    expect(res.status).toBe(401);
    expect(mockConfirmXml).not.toHaveBeenCalled();
    expect(mockConfirmManual).not.toHaveBeenCalled();
  });
});

describe.each([
  ['clinic_user', { ...admin, role: 'clinic_user' }],
  ['consultor', { ...admin, role: 'clinic_consultant', is_consultant: true }],
  ['system_admin', { uid: 'sa', role: 'system_admin', is_system_admin: true, active: true }],
  ['inativo', { ...admin, active: false }],
])('authorization — %s', (_, claims) => {
  it('returns 403 on both routes', async () => {
    mockVerifyIdToken.mockResolvedValue(claims);
    expect((await postXml(xmlRequest())).status).toBe(403);
    expect((await postManual(manualRequest())).status).toBe(403);
    expect(mockConfirmXml).not.toHaveBeenCalled();
    expect(mockConfirmManual).not.toHaveBeenCalled();
  });
});

describe('POST /api/nf-imports/xml', () => {
  it('returns 401 for an invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid'));
    expect((await postXml(xmlRequest())).status).toBe(401);
  });

  it('returns 400 for two files and for a .pdf', async () => {
    const xml = new File(['<xml/>'], 'nota.xml');
    expect((await postXml(xmlRequest([xml, xml]))).status).toBe(400);
    expect((await postXml(xmlRequest([new File(['x'], 'nota.pdf')]))).status).toBe(400);
  });

  it('returns 413 when the declared body is too large', async () => {
    const req = xmlRequest();
    const originalGet = req.headers.get.bind(req.headers);
    jest
      .spyOn(req.headers, 'get')
      .mockImplementation((name: string) =>
        name.toLowerCase() === 'content-length' ? String(20 * 1024 * 1024) : originalGet(name)
      );
    expect((await postXml(req)).status).toBe(413);
    expect(mockConfirmXml).not.toHaveBeenCalled();
  });

  it('returns 422 with the parser message', async () => {
    mockParseNfeXml.mockImplementation(() => {
      throw { code: 'INVALID_ACCESS_KEY', message: 'Chave de acesso da NF-e inválida.' };
    });
    const res = await postXml(xmlRequest());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Chave de acesso da NF-e inválida.' });
  });

  it('returns 422 above the write budget without calling the service', async () => {
    const comLinhas = (n: number) => ({
      data: { ...parsedNF, produtos: Array.from({ length: n }, () => parsedNF.produtos[0]) },
      errors: [],
    });
    mockParseNfeXml.mockReturnValue(comLinhas(497));
    const res = await postXml(xmlRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe(
      'Esta NF-e tem 497 itens; o limite por importação é 496.'
    );
    expect(mockConfirmXml).not.toHaveBeenCalled();
    mockParseNfeXml.mockReturnValue(comLinhas(496));
    expect((await postXml(xmlRequest())).status).toBe(201);
  });

  it('passes the out-of-pattern flag of pending items through', async () => {
    mockConfirmXml.mockResolvedValue({
      kind: 'created',
      importId: '1003',
      produtosImportados: 0,
      pendentes: [{ codigo: 'A12', nome_produto: 'X', lote: 'L', fora_do_padrao: true }],
    });
    const res = await postXml(xmlRequest());
    expect((await res.json()).pendentes).toEqual([
      { codigo: 'A12', nome_produto: 'X', lote: 'L', fora_do_padrao: true },
    ]);
  });

  it('returns 201 with the readable ID and pending products', async () => {
    mockConfirmXml.mockResolvedValue({
      kind: 'created',
      importId: '1000',
      produtosImportados: 1,
      pendentes: [{ codigo: '9999999', nome_produto: 'Novo', lote: 'L9' }],
    });
    const res = await postXml(xmlRequest());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      importId: '1000',
      idLabel: 'ID 1000',
      numero: '26229',
      serie: '1',
      cnpj: '12345678000195',
      produtosImportados: 1,
      pendentes: [{ codigo: '9999999', nome_produto: 'Novo', lote: 'L9' }],
      arquivoSalvo: true,
    });
    expect(mockSaveFile).toHaveBeenCalledWith('tenant-a', '1000', expect.any(Buffer));
  });

  it('returns 409 with the existing ID when blocked', async () => {
    mockConfirmXml.mockResolvedValue({
      kind: 'blocked',
      importId: '1000',
      reason: 'Esta NF já foi cadastrada (ID 1000).',
    });
    const res = await postXml(xmlRequest());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'Esta NF já foi cadastrada (ID 1000).',
      importId: '1000',
    });
    expect(mockSaveFile).not.toHaveBeenCalled();
  });

  it('uses the tenant from the token even with a forged form field', async () => {
    await postXml(xmlRequest(undefined, { extraFields: { tenantId: 'tenant-b' } }));
    expect(mockConfirmXml).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
  });
});

describe('POST /api/nf-imports/manual', () => {
  it('returns 400 for an invalid identity, an empty list, zero quantity and a bad date', async () => {
    const produto = manualBody.produtos[0];
    for (const body of [
      { ...manualBody, cnpj: '12345678000199' },
      { ...manualBody, produtos: [] },
      { ...manualBody, produtos: [{ ...produto, quantidade: 0 }] },
      { ...manualBody, produtos: [{ ...produto, dt_validade: '2027-02-31' }] },
      'nao-e-json',
    ]) {
      expect((await postManual(manualRequest(body))).status).toBe(400);
    }
    expect(mockConfirmManual).not.toHaveBeenCalled();
  });

  it('returns 201 when a new record is created', async () => {
    const res = await postManual(manualRequest());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      importId: '1000',
      idLabel: 'ID 1000',
      complemento: false,
      produtosImportados: 1,
      pendentes: [],
    });
  });

  it('returns 200 when it complements an existing manual record', async () => {
    mockConfirmManual.mockResolvedValue({
      kind: 'complemented',
      importId: '1000',
      produtosImportados: 1,
    });
    const res = await postManual(manualRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).complemento).toBe(true);
  });

  it('returns 409 when blocked and the service status for an invalid item', async () => {
    mockConfirmManual.mockResolvedValueOnce({
      kind: 'blocked',
      importId: '1000',
      reason: 'Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual.',
    });
    expect((await postManual(manualRequest())).status).toBe(409);
    mockConfirmManual.mockResolvedValueOnce({
      kind: 'invalid',
      status: 400,
      error: 'Produto 1: código inválido (use de 5 a 8 dígitos numéricos).',
    });
    const res = await postManual(manualRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Produto 1: código inválido (use de 5 a 8 dígitos numéricos).',
    });
  });

  it('returns the pending items of a Rennova launch outside the catalog', async () => {
    mockConfirmManual.mockResolvedValueOnce({
      kind: 'complemented',
      importId: '1001',
      produtosImportados: 1,
      pendentes: [{ codigo: '88888888', nome_produto: 'NOVO', lote: 'L1' }],
    });
    const res = await postManual(manualRequest({ ...manualBody, tipo: 'rennova' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      importId: '1001',
      idLabel: 'ID 1001',
      complemento: true,
      produtosImportados: 1,
      pendentes: [{ codigo: '88888888', nome_produto: 'NOVO', lote: 'L1' }],
    });
  });

  it('allows up to 496 items per launch (4 fixed writes in the worst case)', async () => {
    const produtos = (n: number) => Array.from({ length: n }, () => manualBody.produtos[0]);
    expect(
      (await postManual(manualRequest({ ...manualBody, produtos: produtos(496) }))).status
    ).toBe(201);
    const res = await postManual(manualRequest({ ...manualBody, produtos: produtos(497) }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain('o limite por importação é 496');
  });

  it('ignores a tenant sent in the body', async () => {
    await postManual(manualRequest({ ...manualBody, tenantId: 'tenant-b' }));
    expect(mockConfirmManual).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        identity: { cnpj: '12345678000195', serie: '1', numero: '26229' },
      })
    );
  });
});

describe('validateManualLaunchRequest', () => {
  it('normalizes the identity and keeps optional fields', () => {
    const result = validateManualLaunchRequest({
      ...manualBody,
      chave_acesso: 'NFe35250312345678000195550010000262291000262299',
      produtos: [{ ...manualBody.produtos[0], brand: ' Outra ', category: 'Insumo' }],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        identity: { cnpj: '12345678000195', serie: '1', numero: '26229' },
        chave_acesso: '35250312345678000195550010000262291000262299',
        tipo: 'outra_marca',
        produtos: [{ ...manualBody.produtos[0], brand: 'Outra', category: 'Insumo' }],
      },
    });
  });

  it('rejects an unknown type and a missing lot', () => {
    expect(validateManualLaunchRequest({ ...manualBody, tipo: 'x' })).toEqual({
      ok: false,
      error: 'Tipo da nota inválido',
    });
    expect(
      validateManualLaunchRequest({
        ...manualBody,
        produtos: [{ ...manualBody.produtos[0], lote: '' }],
      })
    ).toEqual({ ok: false, error: 'Produto 1: código, nome e lote são obrigatórios' });
  });
});
