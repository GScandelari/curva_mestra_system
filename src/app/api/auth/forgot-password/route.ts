export const dynamic = 'force-dynamic';

/**
 * API Route: Esqueci Minha Senha (self-service)
 * POST /api/auth/forgot-password
 *
 * Envia o e-mail password_reset com link próprio de 30 min. Responde sempre
 * igual, exista ou não a conta (anti-enumeração). Usuário inativo ou
 * consultor suspenso não recebe nada (DN-07).
 * Body: { email: string }
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createPasswordToken, generateResetLink } from '@/lib/services/passwordResetService';
import { enqueueTemplatedEmail } from '@/lib/services/emailTemplateAdmin';
import { evaluateRateLimit, type RateLimitState } from '@/lib/passwordTokenRules';

const RATE_LIMITS_COLLECTION = 'password_reset_rate_limits';
const EMAIL_LIMIT = { max: 3, windowMinutes: 15 };
const IP_LIMIT = { max: 10, windowMinutes: 60 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NEUTRAL_RESPONSE = { success: true };

function rateLimitDocId(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Conta a tentativa nas chaves de e-mail e de IP. Bloqueia se qualquer uma
 * estourou; nesse caso nada é gravado.
 */
async function consumeRateLimit(email: string, ip: string): Promise<boolean> {
  const checks = [
    {
      ref: adminDb.collection(RATE_LIMITS_COLLECTION).doc(rateLimitDocId(`email:${email}`)),
      limit: EMAIL_LIMIT,
    },
    {
      ref: adminDb.collection(RATE_LIMITS_COLLECTION).doc(rateLimitDocId(`ip:${ip}`)),
      limit: IP_LIMIT,
    },
  ];

  return adminDb.runTransaction(async (tx) => {
    const snaps = await Promise.all(checks.map((c) => tx.get(c.ref)));
    const now = new Date();
    const results = checks.map((c, i) => {
      const data = snaps[i].data();
      const state: RateLimitState | null = data
        ? { count: data.count, window_started_at: data.window_started_at.toDate() }
        : null;
      return { ...c, ...evaluateRateLimit(state, now, c.limit) };
    });

    if (results.some((r) => !r.allowed)) return false;

    results.forEach((r) => {
      tx.set(r.ref, {
        count: r.next.count,
        window_started_at: Timestamp.fromDate(r.next.window_started_at),
        expires_at: Timestamp.fromMillis(
          r.next.window_started_at.getTime() + r.limit.windowMinutes * 60_000
        ),
      });
    });
    return true;
  });
}

async function isBlockedUser(claims: Record<string, unknown>): Promise<boolean> {
  if (claims.active === false) return true;
  if (typeof claims.consultant_id === 'string' && claims.consultant_id) {
    const consultant = await adminDb.collection('consultants').doc(claims.consultant_id).get();
    return consultant.data()?.status === 'suspended';
  }
  return false;
}

export async function POST(request: NextRequest) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    email = '';
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  try {
    const allowed = await consumeRateLimit(email, clientIp(request));
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.' },
        { status: 429 }
      );
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') return NextResponse.json(NEUTRAL_RESPONSE);
      throw error;
    }

    const claims = user.customClaims || {};
    if (user.disabled || (await isBlockedUser(claims))) {
      return NextResponse.json(NEUTRAL_RESPONSE);
    }

    const tenantId = typeof claims.tenant_id === 'string' ? claims.tenant_id : undefined;
    const { token, expiresAt } = await createPasswordToken({
      userId: user.uid,
      userEmail: user.email || email,
      createdBy: 'self_service',
      purpose: 'password_reset',
      tenantId,
    });

    await enqueueTemplatedEmail(
      'password_reset',
      user.email || email,
      {
        displayName: user.displayName || 'Usuário',
        resetLink: generateResetLink(token),
      },
      {
        metadata: {
          user_id: user.uid,
          ...(tenantId && { tenant_id: tenantId }),
          expires_at: expiresAt.toISOString(),
          origin: 'self_service',
        },
      }
    );

    return NextResponse.json(NEUTRAL_RESPONSE);
  } catch (error) {
    console.error('Erro ao processar recuperação de senha:', error);
    return NextResponse.json({ error: 'Erro ao enviar email. Tente novamente' }, { status: 500 });
  }
}
