/**
 * API Route: Buscar consultores
 * GET - Buscar por código, nome, telefone ou email (para transferência)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET - Buscar consultores
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token não fornecido" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    await adminAuth.verifyIdToken(token);

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Termo de busca deve ter pelo menos 2 caracteres" },
        { status: 400 }
      );
    }

    // Buscar todos consultores ativos
    const snapshot = await adminDb
      .collection("consultants")
      .where("status", "==", "active")
      .get();

    const searchLower = query.toLowerCase();
    const consultants = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((c: any) =>
        c.code.includes(query) ||
        c.name.toLowerCase().includes(searchLower) ||
        c.phone.includes(query) ||
        c.email.toLowerCase().includes(searchLower)
      )
      .map((c: any) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
      }));

    return NextResponse.json({
      success: true,
      data: consultants,
    });
  } catch (error: any) {
    console.error("Erro ao buscar consultores:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar consultores" },
      { status: 500 }
    );
  }
}
