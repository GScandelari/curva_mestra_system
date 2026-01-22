/**
 * API Route: Gerenciar Solicitações de Acesso Antecipado
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import bcrypt from "bcryptjs";
import {
  validateEmail,
  validateDocument,
  validatePhone,
  validateCEP,
  validatePassword,
  validateFullName,
  sanitizeString,
} from "@/lib/validations/serverValidations";

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

    // Validações completas com mensagens específicas
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

    // Verificar campos obrigatórios
    for (const field of requiredFields) {
      if (!data[field]) {
        const fieldNames: Record<string, string> = {
          type: "Tipo de conta",
          full_name: "Nome completo",
          email: "E-mail",
          phone: "Telefone",
          business_name: "Nome da empresa/profissional",
          document_type: "Tipo de documento",
          document_number: "Número do documento",
          password: "Senha",
        };
        return NextResponse.json(
          { error: `${fieldNames[field] || field} é obrigatório` },
          { status: 400 }
        );
      }
    }

    // Validar nome completo
    const nameValidation = validateFullName(data.full_name);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Validar email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error },
        { status: 400 }
      );
    }

    // Validar telefone
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { error: phoneValidation.error },
        { status: 400 }
      );
    }

    // Validar senha
    const passwordValidation = validatePassword(data.password, {
      minLength: 6,
      requireNumber: false,
    });
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
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
        { error: "Tipo de documento deve ser 'cpf' ou 'cnpj'" },
        { status: 400 }
      );
    }

    // Validar documento (CPF ou CNPJ)
    const documentValidation = validateDocument(
      data.document_number,
      data.document_type
    );
    if (!documentValidation.valid) {
      return NextResponse.json(
        { error: documentValidation.error },
        { status: 400 }
      );
    }

    // Limpar documento (remover formatação)
    const cleanDocument = data.document_number.replace(/\D/g, "");

    // Validar CEP se fornecido
    if (data.cep) {
      const cepValidation = validateCEP(data.cep);
      if (!cepValidation.valid) {
        return NextResponse.json(
          { error: cepValidation.error },
          { status: 400 }
        );
      }
    }

    // Hash da senha antes de armazenar (segurança)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Criar solicitação
    const accessRequestData = {
      type: data.type,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      business_name: data.business_name,
      document_type: data.document_type,
      document_number: cleanDocument,
      password: hashedPassword, // Senha hasheada com bcrypt (não será usada - geramos senha temporária na aprovação)
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
