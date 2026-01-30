/**
 * API Route: Reset de Senha por Admin
 * POST /api/users/[id]/reset-password
 *
 * Gera um token de reset e envia email com link seguro
 * NÃO gera senha temporária - usuário define a própria senha via link
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  createPasswordResetToken,
  generateResetLink,
} from "@/lib/services/passwordResetService";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Gera o HTML do e-mail de reset de senha
 */
function generateResetPasswordEmailHtml(
  displayName: string,
  resetLink: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Redefinição de Senha</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Foi solicitada a redefinição da sua senha no <strong>Curva Mestra</strong>.</p>

          <p>Clique no botão abaixo para definir uma nova senha:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 35px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Definir Nova Senha</a>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Importante:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
              <li>Este link expira em <strong>30 minutos</strong></li>
              <li>O link só pode ser usado <strong>uma vez</strong></li>
              <li>Se você não solicitou esta alteração, ignore este email</li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #6b7280;">
            Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br>
            <span style="word-break: break-all; color: #667eea;">${resetLink}</span>
          </p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
          <p><strong>IMPORTANTE:</strong> Nunca compartilhe este link com terceiros.</p>
        </div>
      </body>
    </html>
  `;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Obter token do usuário autenticado
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Verificar se é system_admin
    const isSystemAdmin = decodedToken.is_system_admin === true;

    if (!isSystemAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores do sistema podem redefinir senhas" },
        { status: 403 }
      );
    }

    // Verificar se o usuário existe no Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Não permitir redefinir senha de system_admin
    if (userData?.role === "system_admin") {
      return NextResponse.json(
        { error: "Não é permitido redefinir senha de administradores do sistema" },
        { status: 403 }
      );
    }

    // Verificar se o usuário existe no Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUser(userId);
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        return NextResponse.json(
          { error: "Usuário não encontrado no sistema de autenticação" },
          { status: 404 }
        );
      }
      throw authError;
    }

    const userEmail = userRecord.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "Usuário não possui email cadastrado" },
        { status: 400 }
      );
    }

    // Criar token de reset de senha
    const { token: resetToken, expiresAt } = await createPasswordResetToken(
      userId,
      userEmail,
      decodedToken.uid,
      userData?.tenant_id
    );

    // Gerar link de reset
    const resetLink = generateResetLink(resetToken);

    // Adicionar email à fila
    const emailHtml = generateResetPasswordEmailHtml(
      userRecord.displayName || userData?.full_name || "Usuário",
      resetLink
    );

    await adminDb.collection("email_queue").add({
      to: userEmail,
      subject: "Redefinição de Senha - Curva Mestra",
      body: emailHtml,
      status: "pending",
      type: "password_reset",
      metadata: {
        user_id: userId,
        tenant_id: userData?.tenant_id,
        expires_at: expiresAt.toISOString(),
      },
      created_at: FieldValue.serverTimestamp(),
    });

    // Registrar no Firestore para auditoria
    await adminDb.collection("users").doc(userId).update({
      passwordResetRequestedAt: FieldValue.serverTimestamp(),
      passwordResetRequestedBy: decodedToken.uid,
      updated_at: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Token de reset de senha gerado para ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: "Email de redefinição de senha enviado com sucesso.",
      email: userEmail,
    });
  } catch (error: any) {
    console.error("Erro ao solicitar reset de senha:", error);

    return NextResponse.json(
      { error: "Erro ao solicitar redefinição de senha. Tente novamente." },
      { status: 500 }
    );
  }
}
