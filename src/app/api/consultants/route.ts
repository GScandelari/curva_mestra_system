export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { UserRole, Consultant } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import type { Query, DocumentData } from 'firebase-admin/firestore';
import { writeAuditLogAdmin, actorNameFromToken } from '@/lib/auditLogAdmin';
import { enqueueTemplatedEmail } from '@/lib/services/emailTemplateAdmin';

/**
 * Gera código único de 6 dígitos
 */
async function generateUniqueCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    code = String(crypto.randomInt(100000, 1000000));

    const existing = await adminDb
      .collection('consultants')
      .where('code', '==', code)
      .limit(1)
      .get();

    if (existing.empty) {
      return code;
    }

    attempts++;
  } while (attempts < 10);

  throw new Error('Falha ao gerar código único após 10 tentativas');
}

/**
 * Gera senha temporária segura
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return password;
}

/**
 * GET - Listar consultores
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação via Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode listar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Buscar parâmetros de filtro
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // where antes de orderBy é requisito do Firestore para índices compostos
    let query: Query<DocumentData> = adminDb.collection('consultants');

    if (status === 'suspended') {
      // 'inactive' é o valor gravado pela desativação real (DELETE); 'suspended' é o valor
      // legado gravado pelo antigo fluxo cosmético (PUT), antes da correção de UC-29-RN-01/02.
      // A aba "Suspensos" da listagem deve continuar encontrando ambos.
      query = query.where('status', 'in', ['suspended', 'inactive']);
    } else if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('created_at', 'desc');

    const snapshot = await query.get();
    let consultants = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Consultant[];

    // Filtro de busca em memória
    if (search) {
      const searchLower = search.toLowerCase();
      consultants = consultants.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.code.includes(search) ||
          c.phone.includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: consultants,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar consultores';
    console.error('[GET /api/consultants] erro:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Criar consultor
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode criar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone } = body;

    // Validar campos obrigatórios
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios: name, email, phone' },
        { status: 400 }
      );
    }

    // Verificar duplicidade de email
    const emailLower = email.toLowerCase();
    const existingByEmail = await adminDb
      .collection('consultants')
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!existingByEmail.empty) {
      return NextResponse.json({ error: 'Já existe um consultor com este email' }, { status: 400 });
    }

    // Gerar código único
    const code = await generateUniqueCode();

    // Gerar senha temporária
    const tempPassword = generateTempPassword();

    // Criar usuário no Firebase Auth
    let userId: string;
    try {
      const userRecord = await adminAuth.createUser({
        email: emailLower,
        password: tempPassword,
        displayName: name,
        emailVerified: false,
      });
      userId = userRecord.uid;
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'Este email já está em uso no sistema' },
          { status: 400 }
        );
      }
      throw authError;
    }

    // Criar documento do consultor, claims e documento em users -- se qualquer
    // etapa falhar aqui, o usuário do Firebase Auth já criado acima fica
    // órfão (ocupa o e-mail, sem doc correspondente) a menos que seja revertido.
    let consultantRef: FirebaseFirestore.DocumentReference;
    try {
      const consultantData = {
        user_id: userId,
        code,
        name,
        email: emailLower,
        phone,
        status: 'active',
        authorized_tenants: [],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        created_by: decodedToken.uid,
      };

      consultantRef = await adminDb.collection('consultants').add(consultantData);

      // Definir Custom Claims para o usuário
      await adminAuth.setCustomUserClaims(userId, {
        tenant_id: null,
        role: 'clinic_consultant' as UserRole,
        is_system_admin: false,
        is_consultant: true,
        consultant_id: consultantRef.id,
        authorized_tenants: [],
        active: true,
        requirePasswordChange: true,
      });

      // Criar documento na collection users
      await adminDb
        .collection('users')
        .doc(userId)
        .set({
          email: emailLower,
          full_name: name,
          phone,
          role: 'clinic_consultant' as UserRole,
          tenant_id: null,
          active: true,
          requirePasswordChange: true,
          skip_welcome_email: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
    } catch (postCreateError) {
      await adminAuth
        .deleteUser(userId)
        .catch((deleteError) =>
          console.error(
            `[POST /api/consultants] falha ao reverter usuário órfão ${userId}:`,
            deleteError
          )
        );
      throw postCreateError;
    }

    await writeAuditLogAdmin({
      tenant_id: null,
      entity_type: 'consultant',
      entity_id: consultantRef.id,
      action: 'create',
      descricao: `Consultor "${name}" criado`,
      actor_id: decodedToken.uid,
      actor_name: actorNameFromToken(decodedToken),
      actor_role: 'system_admin',
    });

    // Enviar e-mail de boas-vindas via fila
    try {
      await enqueueTemplatedEmail(
        'consultant_welcome',
        emailLower,
        { name, email: emailLower, code },
        { metadata: { user_id: userId, consultant_id: consultantRef.id } }
      );

      console.log(`E-mail de boas-vindas adicionado à fila para ${emailLower}`);
    } catch (emailError) {
      console.warn('Erro ao adicionar e-mail à fila:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Consultor criado com sucesso',
      data: {
        id: consultantRef.id,
        user_id: userId,
        code,
        name,
        email: emailLower,
        phone,
        status: 'active',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar consultor';
    console.error('[POST /api/consultants] erro:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
