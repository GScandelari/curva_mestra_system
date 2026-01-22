/**
 * API Route: Criar Assinatura PagBank
 * Proxy para Firebase Cloud Function createPagBankSubscription
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenant_id,
      plan_id,
      card_token,
      holder_name,
      holder_birth_date,
      holder_cpf,
      holder_phone,
    } = body;

    // Log removido - informação sensível de pagamento

    // Validações básicas
    if (!tenant_id || !plan_id || !card_token) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Obter token do usuário autenticado do header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("[PagBank API] Token de autenticação não fornecido");
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verificar token
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch (error) {
      console.error("[PagBank API] Token inválido:", error);
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 401 }
      );
    }

    // Chamar Cloud Function createPagBankSubscription
    // Como estamos em Next.js API Route, não podemos usar httpsCallable diretamente
    // Vamos fazer uma requisição HTTP para a função
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
      "https://southamerica-east1-curva-mestra.cloudfunctions.net";

    const response = await fetch(`${functionUrl}/createPagBankSubscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          tenant_id,
          plan_id,
          card_token,
          holder_name,
          holder_birth_date,
          holder_cpf,
          holder_phone,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[PagBank API] Erro da Cloud Function:", errorData);
      throw new Error(errorData.error?.message || "Erro ao processar pagamento");
    }

    const result = await response.json();

    // Retornar resposta no formato esperado pelo frontend
    return NextResponse.json({
      success: true,
      subscription_code: result.result?.subscription_code,
      status: result.result?.status || "ACTIVE",
      plan_code: result.result?.plan_code,
    });
  } catch (error: any) {
    console.error("[PagBank API] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao processar pagamento"
      },
      { status: 500 }
    );
  }
}
