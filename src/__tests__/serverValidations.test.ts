import {
  validateConsultantCode,
  INVALID_CONSULTANT_CODE_ERROR,
} from '@/lib/validations/serverValidations';

describe('validateConsultantCode (UC-01, RN-08)', () => {
  it('accepts exactly 6 numeric digits', () => {
    expect(validateConsultantCode('847291')).toEqual({ valid: true });
    expect(validateConsultantCode('100000')).toEqual({ valid: true });
  });

  it('accepts surrounding whitespace (trimmed)', () => {
    expect(validateConsultantCode('  847291 ')).toEqual({ valid: true });
  });

  it.each(['', '12345', '1234567', 'QA0001', '84729a', '847 291', '-84729'])(
    'rejects %p',
    (code) => {
      expect(validateConsultantCode(code)).toEqual({
        valid: false,
        error: INVALID_CONSULTANT_CODE_ERROR,
      });
    }
  );
});
