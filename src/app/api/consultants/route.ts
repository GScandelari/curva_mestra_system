/**
 * API Route: Gestão de Consultores
 * GET - Listar consultores (system_admin)
 * POST - Criar consultor (system_admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { UserRole, Consultant } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Gera código único de 6 dígitos
 */
async function generateUniqueCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));

    const existing = await adminDb
      .collection("consultants")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (existing.empty) {
      return code;
    }

    attempts++;
  } while (attempts < 10);

  throw new Error("Falha ao gerar código único após 10 tentativas");
}

/**
 * Gera o HTML do e-mail de boas-vindas para o consultor
 */
function generateConsultantWelcomeEmail(
  name: string,
  email: string,
  code: string,
  tempPassword: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Bem-vindo ao Curva Mestra!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Portal do Consultor</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Olá <strong>${name}</strong>,</p>

          <p>Sua conta de consultor foi criada com sucesso no <strong>Curva Mestra</strong>.</p>

          <div style="background: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">Seu código de consultor:</p>
            <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 4px;">${code}</p>
            <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 12px;">Use este código para se vincular às clínicas</p>
          </div>

          <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Dados de acesso:</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #92400e;">
              <li><strong>E-mail:</strong> ${email}</li>
              <li><strong>Senha temporária:</strong> ${tempPassword}</li>
            </ul>
            <p style="margin: 10px 0 0 0; color: #92400e; font-size: 12px;">Você será solicitado a alterar sua senha no primeiro acesso.</p>
          </div>

          <div style="text-align: center;">
            <a href="https://curvamestra.com.br/login" style="display: inline-block; padding: 12px 30px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Fazer Login</a>
          </div>

          <p><strong>O que você pode fazer:</strong></p>
          <ul>
            <li>Visualizar dados das clínicas vinculadas (read-only)</li>
            <li>Acompanhar estoque e procedimentos</li>
            <li>Gerar relatórios consolidados</li>
          </ul>

          <p>Se você tiver alguma dúvida, entre em contato conosco.</p>

          <p>Atenciosamente,<br><strong>Equipe Curva Mestra</strong></p>
        </div>
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>&copy; ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Gera senha temporária segura
 */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * GET - Listar consultores
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode listar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Buscar parâmetros de filtro
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Query base
    let query = adminDb.collection("consultants").orderBy("created_at", "desc");

    if (status) {
      query = query.where("status", "==", status) as any;
    }

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
  } catch (error: any) {
    console.error("Erro ao listar consultores:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao listar consultores" },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar consultor
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas system_admin pode criar consultores
    if (!decodedToken.is_system_admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone } = body;

    // Validar campos obrigatórios
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios: name, email, phone" },
        { status: 400 }
      );
    }

    // Verificar duplicidade de email
    const emailLower = email.toLowerCase();
    const existingByEmail = await adminDb
      .collection("consultants")
      .where("email", "==", emailLower)
      .limit(1)
      .get();

    if (!existingByEmail.empty) {
      return NextResponse.json(
        { error: "Já existe um consultor com este email" },
        { status: 400 }
      );
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
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Este email já está em uso no sistema" },
          { status: 400 }
        );
      }
      throw authError;
    }

    // Criar documento do consultor
    const consultantData = {
      user_id: userId,
      code,
      name,
      email: emailLower,
      phone,
      status: "active",
      authorized_tenants: [],
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      created_by: decodedToken.uid,
    };

    const consultantRef = await adminDb.collection("consultants").add(consultantData);

    // Definir Custom Claims para o usuário
    await adminAuth.setCustomUserClaims(userId, {
      tenant_id: null,
      role: "clinic_consultant" as UserRole,
      is_system_admin: false,
      is_consultant: true,
      consultant_id: consultantRef.id,
      authorized_tenants: [],
      active: true,
      requirePasswordChange: true,
    });

    // Criar documento na collection users
    await adminDb.collection("users").doc(userId).set({
      email: emailLower,
      full_name: name,
      phone,
      role: "clinic_consultant" as UserRole,
      tenant_id: null,
      active: true,
      requirePasswordChange: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Enviar e-mail de boas-vindas via fila
    try {
      const emailHtml = generateConsultantWelcomeEmail(name, emailLower, code, tempPassword);

      await adminDb.collection("email_queue").add({
        to: emailLower,
        subject: "Bem-vindo ao Curva Mestra - Portal do Consultor",
        body: emailHtml,
        status: "pending",
        type: "consultant_welcome",
        metadata: {
          user_id: userId,
          consultant_id: consultantRef.id,
        },
        created_at: FieldValue.serverTimestamp(),
      });

      console.log(`E-mail de boas-vindas adicionado à fila para ${emailLower}`);
    } catch (emailError) {
      console.warn("Erro ao adicionar e-mail à fila:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Consultor criado com sucesso",
      data: {
        id: consultantRef.id,
        user_id: userId,
        code,
        name,
        email: emailLower,
        phone,
        status: "active",
      },
    });
  } catch (error: any) {
    console.error("Erro ao criar consultor:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar consultor" },
      { status: 500 }
    );
  }
}
