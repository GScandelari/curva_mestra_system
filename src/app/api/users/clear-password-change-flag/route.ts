import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
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
    const userId = decodedToken.uid;

    // Obter custom claims atuais do usuário
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    // Remover requirePasswordChange dos custom claims
    const { requirePasswordChange, ...restClaims } = currentClaims;
    await adminAuth.setCustomUserClaims(userId, restClaims);

    // Atualizar no Firestore também
    await adminDb.collection("users").doc(userId).update({
      requirePasswordChange: false,
      passwordChangedAt: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Flag de troca de senha removida com sucesso.",
    });
  } catch (error: any) {
    console.error("Erro ao limpar flag de troca de senha:", error);

    return NextResponse.json(
      { error: "Erro ao processar. Tente novamente." },
      { status: 500 }
    );
  }
}
