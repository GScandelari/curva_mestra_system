export const dynamic = 'force-dynamic';

/**
 * API Route: Detalhes e atualização de consultor
 * GET - Obter consultor por ID
 * PUT - Atualizar consultor
 * DELETE - Desativar consultor
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET - Obter consultor por ID
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const consultantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // System admin ou o próprio consultor pode ver
    const isSystemAdmin = decodedToken.is_system_admin;
    const isOwnConsultant = decodedToken.consultant_id === consultantId;

    if (!isSystemAdmin && !isOwnConsultant) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: consultantDoc.id,
        ...consultantDoc.data(),
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar consultor' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Atualizar consultor
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const consultantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode atualizar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    const body = await req.json();
    const { name, phone, email, status } = body;

    const updateData: Record<string, any> = {
      updated_at: FieldValue.serverTimestamp(),
    };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      updateData.status = status;
    }

    // Se mudando email, verificar duplicidade
    if (email) {
      const emailLower = email.toLowerCase();
      const existingByEmail = await adminDb
        .collection('consultants')
        .where('email', '==', emailLower)
        .limit(1)
        .get();

      if (!existingByEmail.empty && existingByEmail.docs[0].id !== consultantId) {
        return NextResponse.json({ error: 'Email já está em uso' }, { status: 400 });
      }

      updateData.email = emailLower;

      // Atualizar email no Firebase Auth também
      const consultantData = consultantDoc.data();
      const previousEmail = consultantData?.email;
      if (consultantData?.user_id) {
        try {
          await adminAuth.updateUser(consultantData.user_id, { email: emailLower });
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'Email já está em uso no sistema' }, { status: 400 });
          }
          throw authError;
        }
      }

      // Avisar o consultor da troca -- antes, o e-mail de login mudava
      // silenciosamente e o consultor só descobria ao falhar o próximo login.
      if (previousEmail && previousEmail !== emailLower) {
        try {
          const notifyBody = `<p>Olá ${consultantData?.name || ''},</p>
<p>O e-mail de acesso da sua conta de consultor no Curva Mestra foi alterado de <strong>${previousEmail}</strong> para <strong>${emailLower}</strong>.</p>
<p>A partir de agora, use o novo e-mail para fazer login. Se você não reconhece esta alteração, entre em contato com o suporte.</p>
<p>Atenciosamente,<br>Equipe Curva Mestra</p>`;

          await adminDb.collection('email_queue').add({
            to: previousEmail,
            subject: 'Seu e-mail de acesso foi alterado - Curva Mestra',
            body: notifyBody,
            status: 'pending',
            type: 'consultant_email_changed',
            created_at: FieldValue.serverTimestamp(),
          });

          await adminDb.collection('email_queue').add({
            to: emailLower,
            subject: 'Seu e-mail de acesso foi alterado - Curva Mestra',
            body: notifyBody,
            status: 'pending',
            type: 'consultant_email_changed',
            created_at: FieldValue.serverTimestamp(),
          });
        } catch (emailError) {
          console.warn('Erro ao enfileirar e-mail de aviso de troca de e-mail:', emailError);
        }
      }
    }

    // Se reativando (status volta a 'active' vindo de outro valor), restaurar acesso real
    if (status === 'active' && consultantDoc.data()?.status !== 'active') {
      const consultantData = consultantDoc.data();
      if (consultantData?.user_id) {
        const userRecord = await adminAuth.getUser(consultantData.user_id);
        const currentClaims = userRecord.customClaims || {};

        await adminAuth.setCustomUserClaims(consultantData.user_id, {
          ...currentClaims,
          active: true,
        });

        await adminAuth.updateUser(consultantData.user_id, { disabled: false });
      }
    }

    await adminDb.collection('consultants').doc(consultantId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Consultor atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao atualizar consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar consultor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Desativar consultor (não deleta, apenas marca como inativo)
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const consultantId = params.id;

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode desativar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    const consultantData = consultantDoc.data();

    // Desativar no Firestore
    await adminDb.collection('consultants').doc(consultantId).update({
      status: 'inactive',
      updated_at: FieldValue.serverTimestamp(),
    });

    // Desativar custom claims do usuário
    if (consultantData?.user_id) {
      const userRecord = await adminAuth.getUser(consultantData.user_id);
      const currentClaims = userRecord.customClaims || {};

      await adminAuth.setCustomUserClaims(consultantData.user_id, {
        ...currentClaims,
        active: false,
      });

      // Desativar no Firebase Auth
      await adminAuth.updateUser(consultantData.user_id, { disabled: true });
    }

    return NextResponse.json({
      success: true,
      message: 'Consultor desativado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao desativar consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao desativar consultor' },
      { status: 500 }
    );
  }
}
