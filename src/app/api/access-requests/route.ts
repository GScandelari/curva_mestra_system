/**
 * API Route: Gerenciar Solicitações de Acesso Antecipado
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

/**
 * POST - Criar nova solicitação de acesso
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Validações
    const requiredFields = [
      "type",
      "full_name",
      "email",
      "phone",
      "business_name",
      "document_type",
      "document_number",
      "password",
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Campo obrigatório: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validar senha
    if (data.password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!["clinica", "autonomo"].includes(data.type)) {
      return NextResponse.json(
        { error: "Tipo deve ser 'clinica' ou 'autonomo'" },
        { status: 400 }
      );
    }

    // Validar document_type
    if (!["cpf", "cnpj"].includes(data.document_type)) {
      return NextResponse.json(
        { error: "document_type deve ser 'cpf' ou 'cnpj'" },
        { status: 400 }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    // Limpar documento (remover formatação)
    const cleanDocument = data.document_number.replace(/\D/g, "");

    // Validar documento
    if (data.document_type === "cpf" && cleanDocument.length !== 11) {
      return NextResponse.json(
        { error: "CPF deve ter 11 dígitos" },
        { status: 400 }
      );
    }

    if (data.document_type === "cnpj" && cleanDocument.length !== 14) {
      return NextResponse.json(
        { error: "CNPJ deve ter 14 dígitos" },
        { status: 400 }
      );
    }

    // Criar solicitação
    const accessRequestData = {
      type: data.type,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      business_name: data.business_name,
      document_type: data.document_type,
      document_number: cleanDocument,
      password: data.password, // Salvar senha para usar na aprovação
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      cep: data.cep?.replace(/\D/g, "") || null,
      status: "pendente",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, "access_requests"),
      accessRequestData
    );

    console.log("✅ Solicitação de acesso criada:", docRef.id);

    return NextResponse.json({
      success: true,
      message: "Solicitação enviada com sucesso!",
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("❌ Erro ao criar solicitação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar solicitação" },
      { status: 500 }
    );
  }
}
