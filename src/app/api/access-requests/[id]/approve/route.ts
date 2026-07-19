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

/**
 * Gera uma senha temporária usando crypto.randomBytes (CSPRNG).
 * O usuário jamais vê essa senha — ele define a própria via link de redefinição.
 */
function generateTempPassword(): string {
  // 24 bytes → 32 caracteres base64url; cryptographically secure (CSPRNG)
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Gera o HTML do e-mail de boas-vindas com link para definir a senha.
 */
function generateWelcomeEmailHtml(
  displayName: string,
  email: string,
  businessName: string,
  passwordResetLink: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c9a24a 0%, #8a6b22 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Sua Solicitação foi Aprovada!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Sua solicitação de acesso ao <strong>Curva Mestra</strong> foi aprovada! O acesso ao sistema está liberado.</p>

          <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46;"><strong>Conta Ativada com Sucesso!</strong></p>
            <p style="margin: 10px 0 0 0; color: #065f46;">Clique no botão abaixo para definir sua senha e acessar o sistema.</p>
          </div>

          <p><strong>Seu e-mail de acesso:</strong> ${email}</p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${passwordResetLink}" style="display: inline-block; padding: 14px 34px; background: #c9a24a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Definir minha senha →</a>
          </div>

          <p style="font-size: 13px; color: #6b7280;">Este link é de uso único e expira em 24 horas. Se precisar de um novo link, acesse <a href="https://curvamestra.com.br/login">curvamestra.com.br/login</a> e clique em "Esqueci a senha".</p>

          <p><strong>Próximos passos após definir a senha:</strong></p>
          <ol>
            <li>Faça login com seu e-mail em <a href="https://curvamestra.com.br/login">curvamestra.com.br/login</a></li>
            <li>Configure o perfil da clínica</li>
            <li>Importe seu primeiro inventário</li>
          </ol>

          <p>Se você tiver alguma dúvida, entre em contato conosco.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe sua senha com terceiros.</p>
        </div>
      </body>
    </html>
  `;
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
        const emailHtml = generateWelcomeEmailHtml(
          request.full_name,
          request.email,
          request.business_name,
          passwordResetLink
        );

        await adminDb.collection('email_queue').add({
          to: request.email,
          subject: 'Sua Solicitação foi Aprovada - Curva Mestra',
          body: emailHtml,
          status: 'pending',
          type: 'welcome_approval',
          metadata: {
            user_id,
            tenant_id,
          },
          created_at: FieldValue.serverTimestamp(),
        });

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
