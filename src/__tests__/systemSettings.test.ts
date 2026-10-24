import {
  DEFAULT_SYSTEM_SETTINGS_FORM,
  buildSystemSettingsPayload,
  canSaveSystemSettings,
  hasConcurrentChange,
  normalizeSystemSettingsForm,
  validateSystemSettingsForm,
  type SettingsLoadStatus,
  type SystemSettingsForm,
} from '@/lib/systemSettings';

const ts = (seconds: number, nanoseconds = 0) => ({ seconds, nanoseconds });

describe('normalizeSystemSettingsForm', () => {
  it('returns the defaults for an undefined document', () => {
    expect(normalizeSystemSettingsForm(undefined)).toEqual(DEFAULT_SYSTEM_SETTINGS_FORM);
  });

  it('keeps the values of a complete document', () => {
    expect(
      normalizeSystemSettingsForm({
        session_timeout_minutes: 45,
        maintenance_mode: true,
        maintenance_message: 'Voltamos já',
        registration_enabled: false,
        id: 'global',
      })
    ).toEqual({
      session_timeout_minutes: 45,
      maintenance_mode: true,
      maintenance_message: 'Voltamos já',
      registration_enabled: false,
    });
  });

  it('treats a non-boolean maintenance_mode as off', () => {
    expect(normalizeSystemSettingsForm({ maintenance_mode: 'true' }).maintenance_mode).toBe(false);
  });

  it('treats a missing registration_enabled as on and keeps false', () => {
    expect(normalizeSystemSettingsForm({}).registration_enabled).toBe(true);
    expect(normalizeSystemSettingsForm({ registration_enabled: false }).registration_enabled).toBe(
      false
    );
  });

  it.each([0, -10, NaN, '30', null])('falls back to 15 for invalid timeout %p', (value) => {
    expect(
      normalizeSystemSettingsForm({ session_timeout_minutes: value }).session_timeout_minutes
    ).toBe(15);
  });

  it('keeps a timeout above the limit so validation can block it', () => {
    expect(
      normalizeSystemSettingsForm({ session_timeout_minutes: 2000 }).session_timeout_minutes
    ).toBe(2000);
  });

  it('uses an empty message when it is missing or not a string', () => {
    expect(normalizeSystemSettingsForm({}).maintenance_message).toBe('');
    expect(normalizeSystemSettingsForm({ maintenance_message: 42 }).maintenance_message).toBe('');
  });
});

describe('validateSystemSettingsForm', () => {
  const withTimeout = (session_timeout_minutes: number): SystemSettingsForm => ({
    ...DEFAULT_SYSTEM_SETTINGS_FORM,
    session_timeout_minutes,
  });

  it.each([1, 1440])('accepts %p', (value) => {
    expect(validateSystemSettingsForm(withTimeout(value))).toEqual({ ok: true });
  });

  it.each([0, 1441, -5, 1.5])('rejects %p with the exact message', (value) => {
    expect(validateSystemSettingsForm(withTimeout(value))).toEqual({
      ok: false,
      message: 'O timeout deve estar entre 1 e 1440 minutos (24 horas)',
    });
  });
});

describe('hasConcurrentChange', () => {
  it('is false when the document still does not exist', () => {
    expect(
      hasConcurrentChange({ exists: false, updatedAt: null }, { exists: false, updatedAt: null })
    ).toBe(false);
  });

  it('is true when the document was created or deleted', () => {
    expect(
      hasConcurrentChange({ exists: false, updatedAt: null }, { exists: true, updatedAt: ts(10) })
    ).toBe(true);
    expect(
      hasConcurrentChange({ exists: true, updatedAt: ts(10) }, { exists: false, updatedAt: null })
    ).toBe(true);
  });

  it('is false for the same timestamp', () => {
    expect(
      hasConcurrentChange(
        { exists: true, updatedAt: ts(10, 5) },
        { exists: true, updatedAt: ts(10, 5) }
      )
    ).toBe(false);
  });

  it('is true when only the nanoseconds differ', () => {
    expect(
      hasConcurrentChange(
        { exists: true, updatedAt: ts(10, 5) },
        { exists: true, updatedAt: ts(10, 6) }
      )
    ).toBe(true);
  });

  it('is true when only one side has updated_at', () => {
    expect(
      hasConcurrentChange({ exists: true, updatedAt: null }, { exists: true, updatedAt: ts(10) })
    ).toBe(true);
  });

  it('is false when both existing documents lack updated_at', () => {
    expect(
      hasConcurrentChange({ exists: true, updatedAt: null }, { exists: true, updatedAt: null })
    ).toBe(false);
  });
});

describe('buildSystemSettingsPayload', () => {
  it('returns only the editable fields and the author', () => {
    const payload = buildSystemSettingsPayload(
      { ...DEFAULT_SYSTEM_SETTINGS_FORM, session_timeout_minutes: 30 },
      'admin-uid'
    );
    expect(Object.keys(payload).sort()).toEqual([
      'maintenance_message',
      'maintenance_mode',
      'registration_enabled',
      'session_timeout_minutes',
      'updated_by',
    ]);
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload.session_timeout_minutes).toBe(30);
    expect(payload.updated_by).toBe('admin-uid');
  });
});

describe('canSaveSystemSettings', () => {
  it.each<SettingsLoadStatus>(['loaded', 'missing'])('allows saving when %s', (status) => {
    expect(canSaveSystemSettings(status, false)).toBe(true);
  });

  it.each<SettingsLoadStatus>(['loading', 'error', 'stale'])('blocks saving when %s', (status) => {
    expect(canSaveSystemSettings(status, false)).toBe(false);
  });

  it.each<SettingsLoadStatus>(['loading', 'loaded', 'missing', 'error', 'stale'])(
    'blocks saving while a save is running (%s)',
    (status) => {
      expect(canSaveSystemSettings(status, true)).toBe(false);
    }
  );
});
