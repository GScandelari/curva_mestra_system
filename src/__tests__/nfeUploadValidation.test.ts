import {
  MAX_NFE_XML_BYTES,
  MULTIPART_OVERHEAD_BYTES,
  checkParseNfeClaims,
  checkRequestContentLength,
  validateNfeUploadEntries,
} from '@/lib/validations/nfeUploadValidation';

const admin = { role: 'clinic_admin', active: true, tenant_id: 'tenant-a' };

describe('checkParseNfeClaims', () => {
  it('accepts an active clinic_admin with tenant', () => {
    expect(checkParseNfeClaims(admin)).toEqual({ ok: true });
  });

  it.each([
    ['clinic_user', { ...admin, role: 'clinic_user' }],
    ['system_admin', { role: 'system_admin', active: true, tenant_id: null }],
    ['consultant', { ...admin, role: 'clinic_consultant' }],
    ['inactive', { ...admin, active: false }],
    ['missing active', { role: 'clinic_admin', tenant_id: 'tenant-a' }],
    ['string active', { ...admin, active: 'true' }],
    ['empty tenant', { ...admin, tenant_id: '' }],
    ['missing tenant', { role: 'clinic_admin', active: true }],
  ])('rejects %s with 403', (_, claims) => {
    expect(checkParseNfeClaims(claims)).toEqual({
      ok: false,
      status: 403,
      error: 'Apenas administradores ativos da clínica podem importar NF-e',
    });
  });
});

describe('checkRequestContentLength', () => {
  it.each([null, '', 'abc', '-1', String(MAX_NFE_XML_BYTES + MULTIPART_OVERHEAD_BYTES)])(
    'lets %p through',
    (header) => {
      expect(checkRequestContentLength(header)).toEqual({ ok: true });
    }
  );

  it('rejects a declared body above the limit with 413', () => {
    expect(
      checkRequestContentLength(String(MAX_NFE_XML_BYTES + MULTIPART_OVERHEAD_BYTES + 1))
    ).toEqual({ ok: false, status: 413, error: 'Arquivo muito grande. Máximo: 10MB' });
  });
});

describe('validateNfeUploadEntries', () => {
  it('rejects no file and more than one file with 400', () => {
    expect(validateNfeUploadEntries([])).toEqual({
      ok: false,
      status: 400,
      error: 'Nenhum arquivo enviado',
    });
    expect(
      validateNfeUploadEntries([
        { name: 'a.xml', size: 10 },
        { name: 'b.xml', size: 10 },
      ])
    ).toEqual({ ok: false, status: 400, error: 'Envie apenas um arquivo XML por vez' });
  });

  it('accepts .xml regardless of case', () => {
    expect(validateNfeUploadEntries([{ name: 'nota.XML', size: 1024 }])).toEqual({ ok: true });
  });

  it.each(['nota.pdf', 'nota.xml.pdf'])('rejects %s with 400', (name) => {
    expect(validateNfeUploadEntries([{ name, size: 1024 }])).toEqual({
      ok: false,
      status: 400,
      error: 'Apenas arquivos XML são aceitos nesta rota',
    });
  });

  it('rejects an empty file with 400', () => {
    expect(validateNfeUploadEntries([{ name: 'nota.xml', size: 0 }])).toEqual({
      ok: false,
      status: 400,
      error: 'Arquivo vazio',
    });
  });

  it('accepts exactly 10MB and rejects anything above with 413', () => {
    expect(validateNfeUploadEntries([{ name: 'nota.xml', size: MAX_NFE_XML_BYTES }])).toEqual({
      ok: true,
    });
    expect(validateNfeUploadEntries([{ name: 'nota.xml', size: MAX_NFE_XML_BYTES + 1 }])).toEqual({
      ok: false,
      status: 413,
      error: 'Arquivo muito grande. Máximo: 10MB',
    });
  });
});
