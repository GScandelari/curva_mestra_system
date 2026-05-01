export const dynamic = 'force-dynamic';

/**
 * API Route: Create Tenant with Admin User
 * POST /api/tenants/create
 *
 * Cria um novo tenant (clínica) junto com o usuário administrador
 * e envia e-mail de boas-vindas personalizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { CreateTenantData } from '@/types/tenant';

export async function POST(request: NextRequest) {
  try {
    const data: CreateTenantData = await request.json();

    // Validações básicas
    if (!data.name || !data.email || !data.document_number) {
      return NextResponse.json({ error: 'Dados obrigatórios não fornecidos' }, { status: 400 });
    }

    if (!data.admin_email || !data.admin_name || !data.temp_password) {
      return NextResponse.json({ error: 'Dados do administrador não fornecidos' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const auth = getAdminAuth();

    // 1. Criar o tenant (clínica)
    const tenantData = {
      name: data.name,
      document_type: data.document_type,
      document_number: data.document_number,
      cnpj: data.cnpj || data.document_number,
      max_users: data.max_users,
      email: data.email,
      plan_id: data.plan_id,
      phone: data.phone || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      cep: data.cep || '',
      active: false, // Inicia inativo até completar onboarding
      created_at: new Date(),
      updated_at: new Date(),
    };

    const tenantRef = await db.collection('tenants').add(tenantData);
    const tenantId = tenantRef.id;

    console.log(`✅ Tenant criado: ${tenantId} (${data.name})`);

    // 2. Criar usuário no Firebase Auth
    let userId: string;
    try {
      const userRecord = await auth.createUser({
        email: data.admin_email,
        password: data.temp_password,
        displayName: data.admin_name,
        emailVerified: false,
      });
      userId = userRecord.uid;

      console.log(`✅ Usuário Auth criado: ${userId} (${data.admin_email})`);
    } catch (authError: any) {
      // Se falhar ao criar usuário, deletar tenant
      await db.collection('tenants').doc(tenantId).delete();
      console.error('❌ Erro ao criar usuário Auth:', authError);
      return NextResponse.json(
        { error: `Erro ao criar usuário: ${authError.message}` },
        { status: 500 }
      );
    }

    // 3. Criar documento do usuário no Firestore
    try {
      await db
        .collection('users')
        .doc(userId)
        .set({
          tenant_id: tenantId,
          email: data.admin_email,
          full_name: data.admin_name,
          phone: data.admin_phone || '',
          role: 'clinic_admin',
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

      console.log(`✅ Documento de usuário criado no Firestore: ${userId}`);
    } catch (firestoreError: any) {
      // Se falhar, deletar usuário Auth e tenant
      await auth.deleteUser(userId);
      await db.collection('tenants').doc(tenantId).delete();
      console.error('❌ Erro ao criar documento do usuário:', firestoreError);
      return NextResponse.json(
        { error: `Erro ao criar dados do usuário: ${firestoreError.message}` },
        { status: 500 }
      );
    }

    // 4. Definir custom claims
    try {
      await auth.setCustomUserClaims(userId, {
        tenant_id: tenantId,
        role: 'clinic_admin',
        is_system_admin: false,
        active: true,
      });

      console.log(`✅ Custom claims definidos para usuário: ${userId}`);
    } catch (claimsError: any) {
      console.error('❌ Erro ao definir custom claims:', claimsError);
      // Não falhar a criação por isso, mas registrar o erro
    }

    // 5. Criar licença inicial (baseada no plano)
    try {
      const startDate = new Date();
      const endDate = new Date(startDate);

      // Plano semestral = 6 meses, anual = 12 meses
      const monthsToAdd = data.plan_id === 'semestral' ? 6 : 12;
      endDate.setMonth(endDate.getMonth() + monthsToAdd);

      await db.collection('licenses').add({
        tenant_id: tenantId,
        plan_id: data.plan_id,
        max_users: data.max_users,
        status: 'ativa',
        auto_renew: false,
        start_date: startDate,
        end_date: endDate,
        created_at: new Date(),
        updated_at: new Date(),
      });

      console.log(`✅ Licença criada para tenant ${tenantId}`);
    } catch (licenseError: any) {
      console.error('❌ Erro ao criar licença:', licenseError);
      // Não falhar a criação por isso
    }

    // 6. Inicializar registro de onboarding
    try {
      await db.collection('tenant_onboarding').doc(tenantId).set({
        tenant_id: tenantId,
        steps_completed: [],
        current_step: 'setup_admin',
        started_at: new Date(),
        updated_at: new Date(),
      });

      console.log(`✅ Onboarding inicializado para tenant ${tenantId}`);
    } catch (onboardingError: any) {
      console.error('❌ Erro ao inicializar onboarding:', onboardingError);
      // Não falhar a criação por isso
    }

    // 7. Enviar e-mail de boas-vindas (se solicitado)
    if (data.welcome_email?.send) {
      try {
        // Chamar Cloud Function para enviar o email
        console.log(`📧 Enviando e-mail de boas-vindas para: ${data.admin_email}`);
        console.log(`   Assunto: ${data.welcome_email.subject}`);

        // Nota: O e-mail será enviado de forma assíncrona via Cloud Function
        // Para isso, precisamos armazenar a solicitação de envio
        await db.collection('email_queue').add({
          to: data.admin_email,
          subject: data.welcome_email.subject,
          body: data.welcome_email.body,
          status: 'pending',
          created_at: new Date(),
        });

        console.log(`✅ E-mail adicionado à fila de envio`);
      } catch (emailError: any) {
        console.error('❌ Erro ao adicionar e-mail à fila:', emailError);
        // Não falhar a criação por isso
      }
    }

    // 8. Retornar sucesso
    return NextResponse.json(
      {
        success: true,
        tenantId,
        userId,
        message: 'Clínica e administrador criados com sucesso',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Erro geral ao criar tenant:', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar clínica' }, { status: 500 });
  }
}
