import {
  EXCLUSIVITY_WINDOW_HOURS,
  computeExclusivityExpiresAt,
  canConsultantApprove,
} from '@/lib/consultantAccessApproval';

const HOUR = 60 * 60 * 1000;
const createdAt = new Date('2026-10-09T10:00:00.000Z'); // sexta-feira

describe('EXCLUSIVITY_WINDOW_HOURS', () => {
  it('is 48 calendar hours (UC-56 RN-02/RNF-04)', () => {
    expect(EXCLUSIVITY_WINDOW_HOURS).toBe(48);
  });
});

describe('computeExclusivityExpiresAt', () => {
  it('adds exactly 48h to created_at, ignoring weekends', () => {
    // sexta 10:00Z + 48h = domingo 10:00Z (sem pular fim de semana)
    expect(computeExclusivityExpiresAt(createdAt).toISOString()).toBe('2026-10-11T10:00:00.000Z');
  });

  it('accepts a serialized Timestamp ({ _seconds })', () => {
    const serialized = { _seconds: createdAt.getTime() / 1000, _nanoseconds: 0 };
    expect(computeExclusivityExpiresAt(serialized).getTime()).toBe(createdAt.getTime() + 48 * HOUR);
  });

  it('accepts an object with toDate() (Admin SDK Timestamp)', () => {
    const ts = { toDate: () => createdAt };
    expect(computeExclusivityExpiresAt(ts).getTime()).toBe(createdAt.getTime() + 48 * HOUR);
  });
});

describe('canConsultantApprove', () => {
  const insideWindow = new Date(createdAt.getTime() + 47 * HOUR);
  const atExpiry = new Date(createdAt.getTime() + 48 * HOUR);
  const afterWindow = new Date(createdAt.getTime() + 72 * HOUR);

  it('allows any consultant when the request has no linked consultant (RN-05)', () => {
    for (const requestConsultantId of [undefined, null, '']) {
      expect(
        canConsultantApprove(
          { requestConsultantId, actingConsultantId: 'cons-b', createdAt },
          new Date(createdAt.getTime() + 1)
        )
      ).toBe(true);
    }
  });

  it('allows the linked consultant inside the window (RN-02)', () => {
    expect(
      canConsultantApprove(
        { requestConsultantId: 'cons-a', actingConsultantId: 'cons-a', createdAt },
        insideWindow
      )
    ).toBe(true);
  });

  it('allows the linked consultant after the window too', () => {
    expect(
      canConsultantApprove(
        { requestConsultantId: 'cons-a', actingConsultantId: 'cons-a', createdAt },
        afterWindow
      )
    ).toBe(true);
  });

  it('blocks another consultant inside the window (RN-02, exception 8a)', () => {
    expect(
      canConsultantApprove(
        { requestConsultantId: 'cons-a', actingConsultantId: 'cons-b', createdAt },
        insideWindow
      )
    ).toBe(false);
  });

  it('allows another consultant exactly at 48h and after (RN-03)', () => {
    const input = { requestConsultantId: 'cons-a', actingConsultantId: 'cons-b', createdAt };
    expect(canConsultantApprove(input, atExpiry)).toBe(true);
    expect(canConsultantApprove(input, afterWindow)).toBe(true);
  });
});
