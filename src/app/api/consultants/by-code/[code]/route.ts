/**
 * API Route: Buscar consultor por código de 6 dígitos
 * GET - Buscar por código (usado para transferência de consultoria)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET - Buscar consultor por código
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const params = await context.params;
    const code = params.code;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    // Validar formato do código (6 dígitos)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Código deve ter 6 dígitos" },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection("consultants")
      .where("code", "==", code)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Consultor não encontrado" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Retornar apenas dados públicos (para exibição na tela de transferência)
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        code: data.code,
        name: data.name,
        email: data.email,
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar consultor por código:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar consultor" },
      { status: 500 }
    );
  }
}
