import {
  parseBrDate,
  computeExpiryLimitDate,
  daysUntil,
  resolveExpiryWarningDays,
  isWithinExpiryWindow,
  isExpired,
  resolveLowStockThreshold,
  isLowStock,
} from '@/lib/alertRules';

describe('parseBrDate', () => {
  it('converte DD/MM/YYYY em Date à meia-noite', () => {
    const date = parseBrDate('15/03/2027');
    expect(date).toEqual(new Date(2027, 2, 15, 0, 0, 0, 0));
  });

  it('retorna null para string vazia', () => {
    expect(parseBrDate('')).toBeNull();
  });

  it('retorna null para undefined/null', () => {
    expect(parseBrDate(undefined)).toBeNull();
    expect(parseBrDate(null)).toBeNull();
  });

  it('retorna null para formato inválido (sem duas barras)', () => {
    expect(parseBrDate('2027-03-15')).toBeNull();
  });

  it('retorna null (sem lançar) para valor de tipo errado, ex.: Timestamp/number/objeto', () => {
    expect(parseBrDate(12345)).toBeNull();
    expect(parseBrDate({ seconds: 1, nanoseconds: 0 })).toBeNull();
    expect(parseBrDate(['15', '03', '2027'])).toBeNull();
    expect(parseBrDate(true)).toBeNull();
  });
});

describe('computeExpiryLimitDate', () => {
  it('soma warningDays à data base', () => {
    const today = new Date(2027, 0, 1);
    const limit = computeExpiryLimitDate(today, 30);
    expect(limit).toEqual(new Date(2027, 0, 31));
  });

  it('não modifica a data original (imutabilidade)', () => {
    const today = new Date(2027, 0, 1);
    computeExpiryLimitDate(today, 30);
    expect(today).toEqual(new Date(2027, 0, 1));
  });
});

describe('daysUntil', () => {
  it('calcula dias inteiros arredondando para cima', () => {
    const today = new Date(2027, 0, 1);
    const expiry = new Date(2027, 0, 11);
    expect(daysUntil(expiry, today)).toBe(10);
  });

  it('retorna 0 quando a data é hoje', () => {
    const today = new Date(2027, 0, 1);
    expect(daysUntil(today, today)).toBe(0);
  });

  it('retorna negativo quando a data já passou', () => {
    const today = new Date(2027, 0, 10);
    const expiry = new Date(2027, 0, 1);
    expect(daysUntil(expiry, today)).toBe(-9);
  });
});

describe('resolveExpiryWarningDays', () => {
  it('usa o valor configurado quando presente', () => {
    expect(resolveExpiryWarningDays(60)).toBe(60);
  });

  it('usa fallback de 30 quando undefined', () => {
    expect(resolveExpiryWarningDays(undefined)).toBe(30);
  });

  it('usa fallback de 30 quando null', () => {
    expect(resolveExpiryWarningDays(null)).toBe(30);
  });

  it('usa fallback de 30 quando 0 (falsy)', () => {
    expect(resolveExpiryWarningDays(0)).toBe(30);
  });
});

describe('isWithinExpiryWindow', () => {
  const today = new Date(2027, 0, 1);
  const limit = new Date(2027, 0, 31);

  it('true quando a validade é exatamente hoje (limite inferior)', () => {
    expect(isWithinExpiryWindow(today, today, limit)).toBe(true);
  });

  it('true quando a validade é exatamente o limite (limite superior)', () => {
    expect(isWithinExpiryWindow(limit, today, limit)).toBe(true);
  });

  it('true quando a validade está no meio da janela', () => {
    expect(isWithinExpiryWindow(new Date(2027, 0, 15), today, limit)).toBe(true);
  });

  it('false quando a validade já passou (antes de hoje)', () => {
    expect(isWithinExpiryWindow(new Date(2026, 11, 31), today, limit)).toBe(false);
  });

  it('false quando a validade está além do limite', () => {
    expect(isWithinExpiryWindow(new Date(2027, 1, 1), today, limit)).toBe(false);
  });
});

describe('isExpired', () => {
  const today = new Date(2027, 0, 10);

  it('true quando a validade é anterior a hoje', () => {
    expect(isExpired(new Date(2027, 0, 9), today)).toBe(true);
  });

  it('false quando a validade é hoje (ainda não vencido)', () => {
    expect(isExpired(today, today)).toBe(false);
  });

  it('false quando a validade é futura', () => {
    expect(isExpired(new Date(2027, 0, 11), today)).toBe(false);
  });
});

describe('resolveLowStockThreshold', () => {
  it('prioriza o limite específico do produto', () => {
    expect(resolveLowStockThreshold(5, 20)).toBe(5);
  });

  it('usa o threshold global quando não há limite específico', () => {
    expect(resolveLowStockThreshold(undefined, 20)).toBe(20);
    expect(resolveLowStockThreshold(null, 20)).toBe(20);
  });

  it('usa o padrão 10 quando nenhum dos dois está definido', () => {
    expect(resolveLowStockThreshold(undefined, undefined)).toBe(10);
    expect(resolveLowStockThreshold(null, null)).toBe(10);
  });

  it('respeita limite específico igual a 0 (não cai no fallback)', () => {
    expect(resolveLowStockThreshold(0, 20)).toBe(0);
  });
});

describe('isLowStock', () => {
  it('true quando a quantidade está dentro do limite (inclusive)', () => {
    expect(isLowStock(10, 10)).toBe(true);
  });

  it('true quando a quantidade está abaixo do limite', () => {
    expect(isLowStock(5, 10)).toBe(true);
  });

  it('false quando a quantidade está acima do limite', () => {
    expect(isLowStock(11, 10)).toBe(false);
  });

  it('false quando a quantidade é 0 (ruptura, caso separado de estoque baixo)', () => {
    expect(isLowStock(0, 10)).toBe(false);
  });

  it('false quando a quantidade é negativa', () => {
    expect(isLowStock(-1, 10)).toBe(false);
  });
});
