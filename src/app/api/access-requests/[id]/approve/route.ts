/**
 * API Route: Aprovar Solicitação de Acesso Antecipado
 * Cria automaticamente tenant + usuário admin em um clique
 * Usa a senha que o usuário definiu no cadastro (não gera senha temporária)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AccessRequest, Tenant, UserRole } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Gera o HTML do e-mail de boas-vindas (aprovação)
 * NÃO contém senha - usuário usa a senha que definiu no cadastro
 */
function generateWelcomeEmailHtml(
  displayName: string,
  email: string,
  businessName: string
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
          <h1 style="margin: 0;">Sua Solicitação foi Aprovada!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${displayName}</strong>,</p>

          <p>Sua solicitação de acesso ao <strong>Curva Mestra</strong> foi aprovada! A clínica <strong>${businessName}</strong> já está ativa no sistema.</p>

          <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46;"><strong>Conta Ativada com Sucesso!</strong></p>
            <p style="margin: 10px 0 0 0; color: #065f46;">Você já pode fazer login com o email e senha que definiu no cadastro.</p>
          </div>

          <p><strong>Seus dados de acesso:</strong></p>
          <ul>
            <li><strong>E-mail:</strong> ${email}</li>
            <li><strong>Senha:</strong> A senha que você definiu no cadastro</li>
          </ul>

          <div style="text-align: center;">
            <a href="https://curvamestra.com.br/login" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Fazer Login</a>
          </div>

          <p><strong>Próximos passos:</strong></p>
          <ol>
            <li>Faça login com seu e-mail e senha</li>
            <li>Complete o processo de configuração da clínica</li>
            <li>Comece a usar o sistema!</li>
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
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const requestId = params.id;
    const { approved_by_uid, approved_by_name } = await req.json();

    if (!approved_by_uid || !approved_by_name) {
      return NextResponse.json(
        { error: "Dados do aprovador são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Buscar solicitação
    const requestDoc = await adminDb
      .collection("access_requests")
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== "pendente") {
      return NextResponse.json(
        { error: "Solicitação já foi processada" },
        { status: 400 }
      );
    }

    // 2. Verificar se a senha foi definida no cadastro
    if (!request.password) {
      return NextResponse.json(
        { error: "Senha não encontrada na solicitação. O usuário precisa refazer o cadastro." },
        { status: 400 }
      );
    }

    // 3. Definir max_users baseado no tipo
    const max_users = request.type === "autonomo" ? 1 : 5;

    // 4. Criar Tenant
    const tenantData: Omit<Tenant, "id"> = {
      name: request.business_name,
      document_type: request.document_type,
      document_number: request.document_number,
      email: request.email,
      phone: request.phone || "",
      plan_id: "early_access", // Plano de acesso antecipado
      max_users,
      active: true,
      created_at: FieldValue.serverTimestamp() as any,
      updated_at: FieldValue.serverTimestamp() as any,
      // Adicionar address apenas se existir (Firestore não aceita undefined)
      ...(request.address && {
        address: {
          street: request.address,
          city: request.city || "",
          state: request.state || "",
          zip: request.cep || "",
        },
      }),
    };

    const tenantRef = await adminDb.collection("tenants").add(tenantData);
    const tenant_id = tenantRef.id;

    console.log(`✅ Tenant criado: ${tenant_id} - ${request.business_name}`);

    // 5. Criar usuário no Firebase Auth com a senha que o usuário definiu no cadastro
    let user_id: string;
    try {
      const userRecord = await adminAuth.createUser({
        email: request.email,
        password: request.password,
        displayName: request.full_name,
        emailVerified: false,
      });

      user_id = userRecord.uid;

      // 6. Definir Custom Claims
      await adminAuth.setCustomUserClaims(user_id, {
        tenant_id,
        role: "clinic_admin" as UserRole,
        is_system_admin: false,
        active: true,
      });

      console.log(`✅ Usuário criado: ${user_id} - ${request.email}`);

      // 7. Criar documento de usuário no Firestore (collection users)
      await adminDb
        .collection("users")
        .doc(user_id)
        .set({
          tenant_id,
          email: request.email,
          full_name: request.full_name,
          phone: request.phone,
          role: "clinic_admin" as UserRole,
          active: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      // 8. Criar licença de acesso antecipado (6 meses grátis)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6); // 6 meses de acesso

      await adminDb.collection("licenses").add({
        tenant_id,
        plan_id: "early_access",
        status: "ativa",
        max_users,
        features: [
          "inventory_management",
          "batch_tracking",
          "expiration_alerts",
          "basic_reports",
        ],
        start_date: FieldValue.serverTimestamp(),
        end_date: FieldValue.serverTimestamp(), // Will be updated with correct date
        auto_renew: false,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Licença criada para tenant: ${tenant_id}`);

      // 9. Criar documento de onboarding inicial (pending_setup)
      // O usuário precisa revisar dados, selecionar plano e pagar
      await adminDb
        .collection("tenant_onboarding")
        .doc(tenant_id)
        .set({
          tenant_id,
          status: "pending_setup",
          setup_completed: false, // Dados pré-preenchidos, mas usuário precisa revisar
          plan_selected: false,
          payment_confirmed: false,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      console.log(`✅ Onboarding criado para tenant: ${tenant_id}`);

      // 10. Atualizar solicitação
      await adminDb
        .collection("access_requests")
        .doc(requestId)
        .update({
          status: "aprovada",
          tenant_id,
          user_id,
          approved_by: approved_by_uid,
          approved_by_name,
          approved_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      // 11. Enviar e-mail de boas-vindas (sem senha) via fila de emails
      // A Cloud Function processEmailQueue irá processar e enviar automaticamente
      try {
        const emailHtml = generateWelcomeEmailHtml(
          request.full_name,
          request.email,
          request.business_name
        );

        await adminDb.collection("email_queue").add({
          to: request.email,
          subject: "Sua Solicitação foi Aprovada - Curva Mestra",
          body: emailHtml,
          status: "pending",
          type: "welcome_approval",
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
        message: "Solicitação aprovada! O usuário já pode fazer login com a senha que definiu no cadastro.",
        data: {
          tenant_id,
          user_id,
          email: request.email,
          business_name: request.business_name,
        },
      });
    } catch (authError: any) {
      // Se falhou ao criar usuário, deletar tenant criado
      console.error("❌ Erro ao criar usuário, revertendo tenant:", authError);
      await adminDb.collection("tenants").doc(tenant_id).delete();

      // Verificar se é erro de email duplicado
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Este email já está em uso" },
          { status: 400 }
        );
      }

      throw authError;
    }
  } catch (error: any) {
    console.error("❌ Erro ao aprovar solicitação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar aprovação" },
      { status: 500 }
    );
  }
}
