/**
 * API Route: PagSeguro Session
 * Cria uma sessão para tokenização de cartão no frontend
 */

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const email = process.env.PAGBANK_EMAIL;
    const token = process.env.PAGBANK_TOKEN;

    if (!email || !token) {
      console.error("[PagSeguro Session] Credenciais não configuradas");
      return NextResponse.json(
        { error: "Credenciais PagSeguro não configuradas" },
        { status: 500 }
      );
    }

    // API v2/sessions do PagSeguro (Sandbox)
    const url = `https://sandbox.api.pagseguro.com/v2/sessions?email=${encodeURIComponent(
      email
    )}&token=${token}`;

    console.log("[PagSeguro Session] Criando sessão no ambiente sandbox...");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PagSeguro Session] Erro:", errorText);
      return NextResponse.json(
        { error: "Falha ao criar sessão" },
        { status: 500 }
      );
    }

    const xml = await response.text();

    // Extrair ID da sessão do XML
    const match = xml.match(/<id>(.*?)<\/id>/);
    if (!match || !match[1]) {
      console.error("[PagSeguro Session] ID não encontrado no XML:", xml);
      return NextResponse.json(
        { error: "Session ID não encontrado" },
        { status: 500 }
      );
    }

    const sessionId = match[1];

    console.log("[PagSeguro Session] Sessão criada com sucesso:", sessionId);

    return NextResponse.json({ sessionId });
  } catch (error: any) {
    console.error("[PagSeguro Session] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar sessão" },
      { status: 500 }
    );
  }
}
