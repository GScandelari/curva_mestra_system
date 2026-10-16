export const dynamic = 'force-dynamic';

/**
 * API Route: Buscar clínicas por CNPJ/CPF ou por nome (da clínica ou do
 * especialista) — tela "Buscar Clínicas" do consultor.
 * GET ?q= (ou ?document=, mantido por compatibilidade)
 *
 * Só consultor ativo (claim + documento consultants/{id}) ou system_admin
 * ativo. Só clínicas ativas. Não registra o termo buscado em log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkActiveConsultant, verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import { classifyClinicSearchQuery } from '@/lib/clinicSearch';
import {
  searchActiveTenantsByDocument,
  searchActiveTenantsByName,
} from '@/lib/services/tenantSearchServer';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ACESSO_RESTRITO = 'Acesso restrito a consultores ativos';

export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyBearerToken(req, 'Token não fornecido');
    if (decoded instanceof NextResponse) return decoded;

    const systemAdminAtivo = decoded.is_system_admin === true && decoded.active === true;
    if (!systemAdminAtivo) {
      const consultor = await checkActiveConsultant(decoded, ACESSO_RESTRITO);
      if (consultor instanceof NextResponse) return consultor;
    }

    const params = req.nextUrl.searchParams;
    const consulta = classifyClinicSearchQuery(params.get('q') ?? params.get('document'));
    if (consulta.kind === 'invalid') {
      return NextResponse.json({ error: consulta.error }, { status: 400, headers: NO_STORE });
    }

    if (consulta.kind === 'document') {
      const data = await searchActiveTenantsByDocument(consulta.document);
      return NextResponse.json({ success: true, data, truncated: false }, { headers: NO_STORE });
    }

    const { data, truncated } = await searchActiveTenantsByName(consulta.term);
    return NextResponse.json({ success: true, data, truncated }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error('Erro ao buscar clínicas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar clínicas' },
      { status: 500, headers: NO_STORE }
    );
  }
}
