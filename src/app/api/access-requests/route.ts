export const dynamic = 'force-dynamic';

/**
 * API Route: Gerenciar Solicitações de Acesso Antecipado
 *
 * Campos obrigatórios:
 *   role            — 'especialista' | 'consultor'
 *   full_name       — Nome completo
 *   email           — E-mail profissional
 *   phone           — Telefone / WhatsApp
 *   council_number  — Número do conselho (especialista) ou ID Rennova (consultor)
 *
 * Só para role === 'especialista':
 *   business_name   — Nome da clínica (obrigatório)
 *   document_type   — 'cpf' | 'cnpj' (obrigatório)
 *   document_number — CPF/CNPJ, aceita máscara; gravado só com dígitos (obrigatório)
 *   consultant_code — Código de 6 dígitos do consultor Rennova (UC-01 RN-08,
 *                     opcional), validado contra um consultor ATIVO em `consultants`
 *
 * Campos fora dessa lista (volume, consultant_reference e, para o consultor,
 * nome da clínica e documento) são ignorados: o registro é montado só a partir
 * do valor normalizado por validateAccessRequestInput
 * (FEAT-ajustes-registro-e-busca-consultor). A gravação é feita pelo Admin SDK;
 * a rule de access_requests não permite criação pelo client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { validateAccessRequestInput } from '@/lib/accessRequestPayload';
import { INVALID_CONSULTANT_CODE_ERROR } from '@/lib/validations/serverValidations';

/**
 * POST — Criar nova solicitação de acesso
 */
export async function POST(req: NextRequest) {
  try {
    let data: unknown;
    try {
      data = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    // Bloquear novas solicitações quando o System Admin desativou registros
    // (system_settings/global.registration_enabled) -- antes, esse campo era
    // gravado pela tela de Configurações mas nunca lido por ninguém.
    // Usa o Admin SDK (bypassa as regras) porque a leitura de system_settings
    // exige isAuthenticated() e esta rota é pública/não-autenticada.
    const settingsSnap = await adminDb.doc('system_settings/global').get();
    if (settingsSnap.exists && settingsSnap.data()?.registration_enabled === false) {
      return NextResponse.json(
        { error: 'O cadastro de novas solicitações está temporariamente desativado.' },
        { status: 403 }
      );
    }

    const validation = validateAccessRequestInput(data);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const input = validation.value;

    // Bloquear duplicidade de solicitação pendente para o mesmo e-mail --
    // usa o Admin SDK (bypassa as regras de segurança) porque a leitura de
    // access_requests é restrita a system_admin para o client SDK.
    const duplicateSnap = await adminDb
      .collection('access_requests')
      .where('email', '==', input.email)
      .where('status', '==', 'pendente')
      .limit(1)
      .get();
    if (!duplicateSnap.empty) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação pendente para este e-mail' },
        { status: 409 }
      );
    }

    // Código de consultor (UC-01 RN-08) -- opcional, só para especialista. O
    // formato já foi validado; aqui confirma (Admin SDK, rota pública) que existe
    // um consultor com status "active". Grava o vínculo (consultant_code +
    // consultant_id) usado por UC-56/UC-57.
    let consultantLink: { consultant_code: string; consultant_id: string } | null = null;
    if (input.consultant_code) {
      const consultantSnap = await adminDb
        .collection('consultants')
        .where('code', '==', input.consultant_code)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (consultantSnap.empty) {
        return NextResponse.json({ error: INVALID_CONSULTANT_CODE_ERROR }, { status: 400 });
      }
      consultantLink = {
        consultant_code: input.consultant_code,
        consultant_id: consultantSnap.docs[0].id,
      };
    }

    const especialista = input.role === 'especialista';
    const agora = FieldValue.serverTimestamp();
    const accessRequestData: Record<string, unknown> = {
      role: input.role,
      type: especialista ? 'clinica' : 'autonomo', // campo legado
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      council_number: input.council_number,
      consultant_code: consultantLink?.consultant_code ?? null,
      consultant_id: consultantLink?.consultant_id ?? null,
      ...(especialista
        ? {
            business_name: input.business_name,
            document_type: input.document_type,
            document_number: input.document_number,
          }
        : {}),
      status: 'pendente',
      created_at: agora,
      updated_at: agora,
    };

    const docRef = await adminDb.collection('access_requests').add(accessRequestData);

    console.log('✅ Solicitação de acesso criada:', docRef.id);

    return NextResponse.json({
      success: true,
      message: 'Solicitação enviada com sucesso!',
      id: docRef.id,
    });
  } catch (error: unknown) {
    // Sem logar dados pessoais da solicitação
    console.error('❌ Erro ao criar solicitação:', error);
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 });
  }
}
