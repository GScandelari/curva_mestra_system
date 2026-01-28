import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

/**
 * Gera uma senha temporária segura
 * 12 caracteres com letras, números e símbolos
 */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%&*";
  let password = "";
  const randomBytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
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

    // Verificar se o usuário existe
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

    // Gerar senha temporária
    const tempPassword = generateTempPassword();

    // Atualizar senha no Firebase Auth
    await adminAuth.updateUser(userId, {
      password: tempPassword,
    });

    // Obter custom claims atuais do usuário
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    // Adicionar requirePasswordChange aos custom claims
    await adminAuth.setCustomUserClaims(userId, {
      ...currentClaims,
      requirePasswordChange: true,
    });

    // Marcar no Firestore também (para histórico/auditoria)
    await adminDb.collection("users").doc(userId).update({
      requirePasswordChange: true,
      passwordResetAt: new Date(),
      passwordResetBy: decodedToken.uid,
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      tempPassword,
      message: "Senha redefinida com sucesso. O usuário deverá trocar a senha no próximo login.",
    });
  } catch (error: any) {
    console.error("Erro ao redefinir senha:", error);

    if (error.code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "Usuário não encontrado no sistema de autenticação" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Erro ao redefinir senha. Tente novamente." },
      { status: 500 }
    );
  }
}
