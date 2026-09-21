import {
  normalizeLegacyType,
  isInviteRequest,
  getApproverConsultantId,
  getPendencyTypeLabel,
  computeExpiresAt,
  isRequestExpired,
  PENDENCY_EXPIRY_DAYS,
} from '@/lib/consultantRequests';

describe('normalizeLegacyType', () => {
  it('returns the type when present', () => {
    expect(normalizeLegacyType('invite')).toBe('invite');
    expect(normalizeLegacyType('transfer')).toBe('transfer');
  });

  it('treats a missing type (legacy document) as transfer', () => {
    expect(normalizeLegacyType(undefined)).toBe('transfer');
  });
});

describe('isInviteRequest', () => {
  it('returns true for type invite', () => {
    expect(isInviteRequest({ type: 'invite' })).toBe(true);
  });

  it('returns false for type transfer', () => {
    expect(isInviteRequest({ type: 'transfer' })).toBe(false);
  });

  it('returns false for a legacy document without type', () => {
    expect(isInviteRequest({ type: undefined })).toBe(false);
  });
});

describe('getApproverConsultantId', () => {
  it('resolves to the invited consultant for type invite', () => {
    const approver = getApproverConsultantId({
      type: 'invite',
      requesting_consultant_id: 'consultant-invited',
      current_consultant_id: undefined,
    });
    expect(approver).toBe('consultant-invited');
  });

  it('resolves to the currently linked consultant for type transfer', () => {
    const approver = getApproverConsultantId({
      type: 'transfer',
      requesting_consultant_id: 'consultant-requesting',
      current_consultant_id: 'consultant-current',
    });
    expect(approver).toBe('consultant-current');
  });

  it('resolves a legacy document (no type) as transfer', () => {
    const approver = getApproverConsultantId({
      type: undefined,
      requesting_consultant_id: 'consultant-requesting',
      current_consultant_id: 'consultant-current',
    });
    expect(approver).toBe('consultant-current');
  });

  it('throws when type is transfer but current_consultant_id is missing (invalid state)', () => {
    expect(() =>
      getApproverConsultantId({
        type: 'transfer',
        requesting_consultant_id: 'consultant-requesting',
        current_consultant_id: undefined,
      })
    ).toThrow('current_consultant_id ausente para pendência do tipo transfer');
  });
});

describe('getPendencyTypeLabel', () => {
  it('labels invite requests', () => {
    expect(getPendencyTypeLabel('invite')).toBe('Convite');
  });

  it('labels transfer requests', () => {
    expect(getPendencyTypeLabel('transfer')).toBe('Transferência');
  });

  it('labels a legacy document (no type) as Transferência', () => {
    expect(getPendencyTypeLabel(undefined)).toBe('Transferência');
  });
});

describe('computeExpiresAt', () => {
  it('adds PENDENCY_EXPIRY_DAYS (15) days to the given creation date', () => {
    const createdAt = new Date(2026, 0, 1); // 01/01/2026
    const expiresAt = computeExpiresAt(createdAt);
    expect(expiresAt).toEqual(new Date(2026, 0, 1 + PENDENCY_EXPIRY_DAYS));
  });

  it('defaults to now when no creation date is given', () => {
    const before = new Date();
    const expiresAt = computeExpiresAt();
    const after = new Date();
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime() + (PENDENCY_EXPIRY_DAYS - 1) * 24 * 60 * 60 * 1000
    );
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      after.getTime() + (PENDENCY_EXPIRY_DAYS + 1) * 24 * 60 * 60 * 1000
    );
  });
});

describe('isRequestExpired', () => {
  const fakeTimestamp = (date: Date) => ({ toDate: () => date });

  it('returns false for a legacy document without expires_at (never expires)', () => {
    expect(isRequestExpired({ expires_at: undefined })).toBe(false);
  });

  it('returns true when expires_at (Firestore Timestamp-like) is in the past', () => {
    const now = new Date(2026, 5, 20);
    const expiresAt = fakeTimestamp(new Date(2026, 5, 1));
    expect(isRequestExpired({ expires_at: expiresAt as never }, now)).toBe(true);
  });

  it('returns false when expires_at (Firestore Timestamp-like) is in the future', () => {
    const now = new Date(2026, 5, 1);
    const expiresAt = fakeTimestamp(new Date(2026, 5, 20));
    expect(isRequestExpired({ expires_at: expiresAt as never }, now)).toBe(false);
  });

  it('falls back to string/Date parsing when expires_at has no toDate()', () => {
    const now = new Date(2026, 5, 20);
    expect(isRequestExpired({ expires_at: '2026-06-01T00:00:00.000Z' as never }, now)).toBe(true);
    expect(isRequestExpired({ expires_at: '2026-06-30T00:00:00.000Z' as never }, now)).toBe(false);
  });

  it('handles a Timestamp already serialized to JSON ({_seconds, _nanoseconds}), as it arrives on the client', () => {
    const now = new Date(2026, 5, 20);
    const pastSeconds = Math.floor(new Date(2026, 5, 1).getTime() / 1000);
    const futureSeconds = Math.floor(new Date(2026, 5, 30).getTime() / 1000);
    expect(
      isRequestExpired({ expires_at: { _seconds: pastSeconds, _nanoseconds: 0 } as never }, now)
    ).toBe(true);
    expect(
      isRequestExpired({ expires_at: { _seconds: futureSeconds, _nanoseconds: 0 } as never }, now)
    ).toBe(false);
  });

  it('accepts a plain Date instance for expires_at', () => {
    const now = new Date(2026, 5, 20);
    expect(isRequestExpired({ expires_at: new Date(2026, 5, 1) as never }, now)).toBe(true);
    expect(isRequestExpired({ expires_at: new Date(2026, 5, 30) as never }, now)).toBe(false);
  });
});
