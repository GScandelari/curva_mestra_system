export const dynamic = 'force-dynamic';

/**
 * API Route: Gerenciar Solicitações de Acesso Antecipado
 *
 * Campos obrigatórios (novo formato):
 *   role            — 'especialista' | 'consultor'
 *   full_name       — Nome completo
 *   email           — E-mail profissional
 *   phone           — Telefone / WhatsApp
 *   council_number  — CRM/CRO (especialista) ou ID Rennova (consultor)
 *   business_name   — Nome da clínica (especialista) ou região/carteira (consultor)
 *
 * Campos opcionais:
 *   consultant_reference — Consultor Rennova de referência
 *   volume               — Volume mensal de procedimentos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import {
  validateEmail,
  validatePhone,
  validateFullName,
} from '@/lib/validations/serverValidations';

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
 * POST — Criar nova solicitação de acesso
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Verificar campos obrigatórios
    const requiredFields: Record<string, string> = {
      role: 'Perfil (especialista / consultor)',
      full_name: 'Nome completo',
      email: 'E-mail',
      phone: 'Telefone',
      council_number: 'Número de conselho / ID Rennova',
      business_name: 'Nome da clínica / região',
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!data[field]) {
        return NextResponse.json({ error: `${label} é obrigatório` }, { status: 400 });
      }
    }

    // Validar role
    if (!['especialista', 'consultor'].includes(data.role)) {
      return NextResponse.json(
        { error: "Perfil deve ser 'especialista' ou 'consultor'" },
        { status: 400 }
      );
    }

    // Validar nome completo
    const nameValidation = validateFullName(data.full_name);
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 });
    }

    // Validar email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    // Validar telefone
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }

    // Derivar type legado a partir do role
    const type = data.role === 'especialista' ? 'clinica' : 'autonomo';

    // Criar solicitação no Firestore
    const accessRequestData: Record<string, unknown> = {
      role: data.role,
      type, // campo legado
      full_name: data.full_name,
      email: data.email.toLowerCase().trim(),
      phone: data.phone,
      council_number: data.council_number,
      business_name: data.business_name,
      consultant_reference: data.consultant_reference || null,
      volume: data.volume || null,
      status: 'pendente',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'access_requests'), accessRequestData);

    console.log('✅ Solicitação de acesso criada:', docRef.id);

    return NextResponse.json({
      success: true,
      message: 'Solicitação enviada com sucesso!',
      id: docRef.id,
    });
  } catch (error: any) {
    console.error('❌ Erro ao criar solicitação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
