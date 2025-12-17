/**
 * API Route: Aprovar Solicitação de Acesso Antecipado
 * Cria automaticamente tenant + usuário admin em um clique
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AccessRequest, Tenant, UserRole } from "@/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST - Aprovar solicitação e criar tenant + usuário
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const requestId = params.id;
    const { approved_by_uid, approved_by_name } = await req.json();

    if (!approved_by_uid || !approved_by_name) {
      return NextResponse.json(
        { error: "Dados do aprovador são obrigatórios" },
        { status: 400 }
      );
    }

    // 1. Buscar solicitação
    const requestDoc = await adminDb
      .collection("access_requests")
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 }
      );
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== "pendente") {
      return NextResponse.json(
        { error: "Solicitação já foi processada" },
        { status: 400 }
      );
    }

    // 2. Definir max_users baseado no tipo
    const max_users = request.type === "autonomo" ? 1 : 5;

    // 3. Criar Tenant
    const tenantData: Omit<Tenant, "id"> = {
      name: request.business_name,
      document_type: request.document_type,
      document_number: request.document_number,
      email: request.email,
      phone: request.phone || "",
      address: request.address
        ? {
            street: request.address,
            city: request.city || "",
            state: request.state || "",
            zip: request.cep || "",
          }
        : undefined,
      plan_id: "early_access", // Plano de acesso antecipado
      max_users,
      active: true,
      created_at: FieldValue.serverTimestamp() as any,
      updated_at: FieldValue.serverTimestamp() as any,
    };

    const tenantRef = await adminDb.collection("tenants").add(tenantData);
    const tenant_id = tenantRef.id;

    console.log(`✅ Tenant criado: ${tenant_id} - ${request.business_name}`);

    // 4. Criar usuário no Firebase Auth
    let user_id: string;
    try {
      // Usar a senha fornecida pelo usuário na solicitação
      const userRecord = await adminAuth.createUser({
        email: request.email,
        password: request.password,
        displayName: request.full_name,
        emailVerified: false,
      });

      user_id = userRecord.uid;

      // 5. Definir Custom Claims
      await adminAuth.setCustomUserClaims(user_id, {
        tenant_id,
        role: "clinic_admin" as UserRole,
        is_system_admin: false,
        active: true,
      });

      console.log(`✅ Usuário criado: ${user_id} - ${request.email}`);

      // 6. Criar documento de usuário no Firestore (collection users)
      await adminDb
        .collection("users")
        .doc(user_id)
        .set({
          tenant_id,
          email: request.email,
          full_name: request.full_name,
          phone: request.phone,
          role: "clinic_admin" as UserRole,
          active: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      // 7. Criar licença de acesso antecipado (6 meses grátis)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6); // 6 meses de acesso

      await adminDb.collection("licenses").add({
        tenant_id,
        plan_id: "early_access",
        status: "ativa",
        max_users,
        features: [
          "inventory_management",
          "batch_tracking",
          "expiration_alerts",
          "basic_reports",
        ],
        start_date: FieldValue.serverTimestamp(),
        end_date: FieldValue.serverTimestamp(), // Will be updated with correct date
        auto_renew: false,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Licença criada para tenant: ${tenant_id}`);

      // 8. Criar documento de onboarding inicial (pending_setup)
      // O usuário precisa revisar dados, selecionar plano e pagar
      await adminDb
        .collection("tenant_onboarding")
        .doc(tenant_id)
        .set({
          tenant_id,
          status: "pending_setup",
          setup_completed: false, // Dados pré-preenchidos, mas usuário precisa revisar
          plan_selected: false,
          payment_confirmed: false,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      console.log(`✅ Onboarding criado para tenant: ${tenant_id}`);

      // 9. Atualizar solicitação
      await adminDb
        .collection("access_requests")
        .doc(requestId)
        .update({
          status: "aprovada",
          tenant_id,
          user_id,
          approved_by: approved_by_uid,
          approved_by_name,
          approved_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

      // TODO: Enviar email de boas-vindas

      return NextResponse.json({
        success: true,
        message: "Solicitação aprovada! Tenant e usuário criados com sucesso.",
        data: {
          tenant_id,
          user_id,
          email: request.email,
          business_name: request.business_name,
        },
      });
    } catch (authError: any) {
      // Se falhou ao criar usuário, deletar tenant criado
      console.error("❌ Erro ao criar usuário, revertendo tenant:", authError);
      await adminDb.collection("tenants").doc(tenant_id).delete();

      // Verificar se é erro de email duplicado
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Este email já está em uso" },
          { status: 400 }
        );
      }

      throw authError;
    }
  } catch (error: any) {
    console.error("❌ Erro ao aprovar solicitação:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar aprovação" },
      { status: 500 }
    );
  }
}
