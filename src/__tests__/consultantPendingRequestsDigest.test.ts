import {
  escapeHtml,
  formatDigestDate,
  buildPendingRequestsDigestHtml,
  buildConsultantDigestVariables,
} from '@/lib/consultantPendingRequestsDigest';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<b>"Ana" & 'Bia'</b>`)).toBe(
      '&lt;b&gt;&quot;Ana&quot; &amp; &#39;Bia&#39;&lt;/b&gt;'
    );
  });
});

describe('formatDigestDate', () => {
  it('formats in America/Sao_Paulo (UTC-3)', () => {
    expect(formatDigestDate(new Date('2026-10-09T11:30:00.000Z'))).toBe('09/10/2026, 08:30');
  });

  it('handles missing or invalid dates', () => {
    expect(formatDigestDate(null)).toBe('data não informada');
    expect(formatDigestDate(new Date('invalid'))).toBe('data não informada');
  });
});

describe('buildPendingRequestsDigestHtml', () => {
  const older = {
    full_name: 'Ana Souza',
    business_name: 'Clínica Ana',
    created_at: new Date('2026-10-07T12:00:00.000Z'),
  };
  const newer = {
    full_name: 'Bruno Lima',
    business_name: 'Clínica Bruno',
    created_at: new Date('2026-10-08T12:00:00.000Z'),
  };

  it('lists every request, oldest first', () => {
    const html = buildPendingRequestsDigestHtml([newer, older]);
    expect(html.startsWith('<ul')).toBe(true);
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html.indexOf('Ana Souza')).toBeLessThan(html.indexOf('Bruno Lima'));
    expect(html).toContain('Clínica Ana');
    expect(html).toContain('07/10/2026, 09:00');
  });

  it('escapes applicant-provided data (public form)', () => {
    const html = buildPendingRequestsDigestHtml([
      { full_name: '<script>x</script>', business_name: 'A & B', created_at: null },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('data não informada');
  });
});

describe('buildConsultantDigestVariables', () => {
  it('builds the template variables for one consultant (one e-mail, all pendencies)', () => {
    const vars = buildConsultantDigestVariables('João <Rennova>', [
      { full_name: 'Ana', business_name: 'X', created_at: null },
      { full_name: 'Bia', business_name: 'Y', created_at: null },
    ]);
    expect(vars.consultantName).toBe('João &lt;Rennova&gt;');
    expect(vars.pendingCount).toBe('2');
    expect(vars.pendingRequestsBlock.match(/<li/g)).toHaveLength(2);
  });
});
