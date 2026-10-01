export const dynamic = 'force-dynamic';

/**
 * API Route: Aprovar Solicitação de Acesso Antecipado
 * Cria automaticamente tenant + usuário admin em um clique.
 * Gera senha temporária e envia link de redefinição de senha ao usuário.
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AccessRequest, Tenant, UserRole } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { enqueueTemplatedEmail } from '@/lib/services/emailTemplateAdmin';

/**
 * Gera uma senha temporária usando crypto.randomBytes (CSPRNG).
 * O usuário jamais vê essa senha — ele define a própria via link de redefinição.
 */
function generateTempPassword(): string {
  // 24 bytes → 32 caracteres base64url; cryptographically secure (CSPRNG)
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * POST - Aprovar solicitação e criar tenant + usuário
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem aprovar solicitações' },
        { status: 403 }
      );
    }

    const approved_by_uid = decodedToken.uid;
    const approved_by_name = decodedToken.name || decodedToken.email || 'System Admin';

    const params = await context.params;
    const requestId = params.id;

    // 1. Buscar solicitação
    const requestDoc = await adminDb.collection('access_requests').doc(requestId).get();

    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 400 });
    }

    // 2. Definir max_users baseado no role / type
    const max_users = request.type === 'autonomo' || request.role === 'consultor' ? 1 : 5;

    // 3. Criar Tenant
    const tenantData: Omit<Tenant, 'id'> = {
      name: request.business_name,
      document_type: request.document_type ?? 'cnpj',
      document_number: request.document_number ?? '',
      email: request.email,
      phone: request.phone || '',
      max_users,
      active: true,
      created_at: FieldValue.serverTimestamp() as any,
      updated_at: FieldValue.serverTimestamp() as any,
      // Adicionar address apenas se existir (Firestore não aceita undefined)
      ...(request.address && {
        address: {
          street: request.address,
          city: request.city || '',
          state: request.state || '',
          zip: request.cep || '',
        },
      }),
    };

    const tenantRef = await adminDb.collection('tenants').add(tenantData);
    const tenant_id = tenantRef.id;

    console.log(`✅ Tenant criado: ${tenant_id} - ${request.business_name}`);

    // 4. Criar usuário no Firebase Auth com senha temporária aleatória
    let user_id: string;
    try {
      const tempPassword = generateTempPassword();
      const userRecord = await adminAuth.createUser({
        email: request.email,
        password: tempPassword,
        displayName: request.full_name,
        emailVerified: false,
      });

      user_id = userRecord.uid;

      // 6. Definir Custom Claims
      await adminAuth.setCustomUserClaims(user_id, {
        tenant_id,
        role: 'clinic_admin' as UserRole,
        is_system_admin: false,
        active: true,
      });

      console.log(`✅ Usuário criado: ${user_id} - ${request.email}`);

      // 7. Criar documento de usuário no Firestore (collection users)
      await adminDb
        .collection('users')
        .doc(user_id)
        .set({
          tenant_id,
          email: request.email,
          full_name: request.full_name,
          phone: request.phone,
          role: 'clinic_admin' as UserRole,
          active: true,
          skip_welcome_email: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      // 8. Atualizar solicitação
      await adminDb.collection('access_requests').doc(requestId).update({
        status: 'aprovada',
        tenant_id,
        user_id,
        approved_by: approved_by_uid,
        approved_by_name,
        approved_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      // 5. Gerar link de redefinição de senha para o usuário definir a própria senha
      let passwordResetLink = 'https://curvamestra.com.br/login';
      try {
        passwordResetLink = await adminAuth.generatePasswordResetLink(request.email);
        console.log(`✅ Link de redefinição de senha gerado para ${request.email}`);
      } catch (resetErr) {
        console.warn(`⚠️ Não foi possível gerar link de redefinição:`, resetErr);
      }

      // 6. Enviar e-mail de boas-vindas com link de redefinição via fila de emails
      try {
        await enqueueTemplatedEmail(
          'welcome_approval',
          request.email,
          {
            displayName: request.full_name,
            email: request.email,
            businessName: request.business_name,
            passwordResetLink,
          },
          { metadata: { user_id, tenant_id } }
        );

        console.log(`✅ E-mail de boas-vindas adicionado à fila para ${request.email}`);
      } catch (emailError) {
        // Não falhar a aprovação se o e-mail falhar
        console.warn(`⚠️ Erro ao adicionar e-mail à fila:`, emailError);
      }

      return NextResponse.json({
        success: true,
        message:
          'Solicitação aprovada! Um e-mail com o link para definir a senha foi enviado ao usuário.',
        data: {
          tenant_id,
          user_id,
          email: request.email,
          business_name: request.business_name,
        },
      });
    } catch (authError: any) {
      // Se falhou ao criar usuário, deletar tenant criado
      console.error('❌ Erro ao criar usuário, revertendo tenant:', authError);
      await adminDb.collection('tenants').doc(tenant_id).delete();

      // Verificar se é erro de email duplicado
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Este email já está em uso' }, { status: 400 });
      }

      throw authError;
    }
  } catch (error: any) {
    console.error('❌ Erro ao aprovar solicitação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar aprovação' },
      { status: 500 }
    );
  }
}
