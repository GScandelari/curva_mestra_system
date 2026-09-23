/**
 * Popula curva-mestra-dev (dev-gscandelari.web.app) com dados fictícios de
 * demonstração: clínicas, usuários (clinic_admin + clinic_user), consultores,
 * inventário Rennova e ~1 ano de solicitações/procedimentos por clínica.
 *
 * NUNCA aponta para produção — valida o project_id da credencial antes de
 * escrever qualquer coisa. Uso:
 *
 *   npx tsx scripts/seed-dev-demo-data.ts <caminho-absoluto-para-service-account.json>
 *
 * Todas as contas criadas usam a senha SENHA_DEMO abaixo, com
 * requirePasswordChange: false (login direto, sem fluxo de troca obrigatória).
 * É puramente aditivo — nunca lê nem modifica tenants/usuários já existentes.
 */

import * as admin from 'firebase-admin';
import { writeFileSync } from 'fs';
import { join } from 'path';

const EXPECTED_PROJECT_ID = 'curva-mestra-dev';
const SENHA_DEMO = 'Senhas12345';

const credPath = process.argv[2];
if (!credPath) {
  console.error('Uso: npx tsx scripts/seed-dev-demo-data.ts <caminho-para-service-account.json>');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require(credPath);
if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
  console.error(
    `❌ ABORTADO: a credencial aponta para "${serviceAccount.project_id}", esperado "${EXPECTED_PROJECT_ID}". ` +
      `Isso evita escrever dados de demonstração no projeto errado (ex.: produção).`
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: EXPECTED_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ============================================================================
// DADOS FICTÍCIOS
// ============================================================================

interface ClinicSeed {
  name: string;
  city: string;
  state: string;
  cep: string;
  adminName: string;
  userNames: string[]; // "especialistas" (clinic_user)
}

const CLINICS: ClinicSeed[] = [
  {
    name: 'Clínica Bella Vitá',
    city: 'São Paulo',
    state: 'SP',
    cep: '01310-100',
    adminName: 'Fernanda Ribeiro Costa',
    userNames: ['Camila Souza Lima', 'Juliana Prado Martins'],
  },
  {
    name: 'Espaço Viva Estética',
    city: 'Rio de Janeiro',
    state: 'RJ',
    cep: '22440-032',
    adminName: 'Rafael Almeida Torres',
    userNames: ['Beatriz Nunes Cardoso', 'Larissa Gomes Freitas', 'Patrícia Vieira Rocha'],
  },
  {
    name: 'Instituto Renove',
    city: 'Belo Horizonte',
    state: 'MG',
    cep: '30130-010',
    adminName: 'Marcela Andrade Pereira',
    userNames: ['Débora Castro Barbosa', 'Renata Fonseca Dias'],
  },
  {
    name: 'Clínica Elegance Contour',
    city: 'Curitiba',
    state: 'PR',
    cep: '80020-320',
    adminName: 'Thiago Moreira Santos',
    userNames: ['Aline Barros Teixeira', 'Vanessa Correia Lopes'],
  },
  {
    name: 'Studio Derme Estética',
    city: 'Porto Alegre',
    state: 'RS',
    cep: '90010-150',
    adminName: 'Gustavo Henrique Farias',
    userNames: ['Carolina Matos Ribeiro', 'Priscila Duarte Mendes', 'Natália Cunha Azevedo'],
  },
  {
    name: 'Clínica Vitrine Facial',
    city: 'Brasília',
    state: 'DF',
    cep: '70390-025',
    adminName: 'Isabela Cristina Monteiro',
    userNames: ['Tatiane Peixoto Viana', 'Cláudia Rezende Nogueira'],
  },
  {
    name: 'Espaço Harmonia Corporal',
    city: 'Salvador',
    state: 'BA',
    cep: '40140-110',
    adminName: 'Leonardo Batista Carvalho',
    userNames: ['Simone Araújo Cavalcante', 'Michele Ferreira Brito'],
  },
  {
    name: 'Clínica Aurora Estética',
    city: 'Recife',
    state: 'PE',
    cep: '51020-280',
    adminName: 'Paula Regina Siqueira',
    userNames: ['Fabiana Melo Guedes', 'Eduarda Campos Rangel'],
  },
  {
    name: 'Instituto Belle Époque',
    city: 'Florianópolis',
    state: 'SC',
    cep: '88010-400',
    adminName: 'André Luiz Bezerra',
    userNames: ['Sabrina Machado Tavares', 'Luciana Pinheiro Soares'],
  },
];

interface ConsultantSeed {
  name: string;
  phone: string;
  clinicIndexes: number[]; // índices em CLINICS
}

const CONSULTANTS: ConsultantSeed[] = [
  { name: 'Bruno César Lacerda', phone: '(11) 98765-4321', clinicIndexes: [0, 1, 2] },
  { name: 'Amanda Cristina Figueiredo', phone: '(41) 99876-5432', clinicIndexes: [3, 4] },
  { name: 'Rodrigo Salles Amaral', phone: '(61) 98123-4567', clinicIndexes: [5, 6] },
  { name: 'Vitória Helena Nascimento', phone: '(81) 99234-5678', clinicIndexes: [7, 8, 4] },
];

const CATEGORY_PRICE_RANGE: Record<string, [number, number]> = {
  Preenchedores: [180, 320],
  Bioestimuladores: [450, 900],
  'Fios de PDO': [90, 220],
  Toxina: [650, 1200],
  Cannulas: [15, 40],
  'Care Home': [60, 150],
  'Care Professional': [60, 150],
};

const PROCEDURE_DESCRIPTIONS = [
  'Preenchimento labial',
  'Toxina botulínica facial - terço superior',
  'Bioestimulador de colágeno facial',
  'Fios de sustentação facial (lifting)',
  'Preenchimento de sulco nasogeniano',
  'Harmonização de mandíbula',
  'Skinbooster facial',
  'Preenchimento de olheiras',
  'Toxina botulínica - hiperidrose axilar',
  'Bioestimulador corporal (glúteos)',
  'Preenchimento de mento',
  'Rinomodelação',
];

// ============================================================================
// HELPERS
// ============================================================================

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function formatDateBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Gera um CNPJ sintaticamente válido (dígitos verificadores corretos), fictício. */
function generateFakeCNPJ(): string {
  const base = Array.from({ length: 12 }, () => randInt(0, 9));
  const calcDigit = (nums: number[]): number => {
    let pos = nums.length - 7;
    let sum = 0;
    for (let i = nums.length; i >= 1; i--) {
      sum += nums[nums.length - i] * pos--;
      if (pos < 2) pos = 9;
    }
    const result = sum % 11;
    return result < 2 ? 0 : 11 - result;
  };
  const d1 = calcDigit(base);
  const d2 = calcDigit([...base, d1]);
  const digits = [...base, d1, d2].join('');
  return digits;
}

function slugEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
}

async function createAuthUser(email: string, displayName: string): Promise<string> {
  const userRecord = await auth.createUser({
    email,
    password: SENHA_DEMO,
    displayName,
    emailVerified: true,
  });
  return userRecord.uid;
}

// ============================================================================
// SEED
// ============================================================================

interface CreatedAccount {
  role: string;
  clinicName?: string;
  name: string;
  email: string;
}

async function main() {
  console.log(`🚀 Populando dados fictícios em "${EXPECTED_PROJECT_ID}"...\n`);

  const createdAccounts: CreatedAccount[] = [];

  // ── 1. Master products já existentes (catálogo real Rennova) ──────────────
  const masterProductsSnap = await db
    .collection('master_products')
    .where('active', '==', true)
    .get();
  const masterProducts = masterProductsSnap.docs.map((d) => ({
    id: d.id,
    code: d.data().code as string,
    name: d.data().name as string,
    category: d.data().category as string,
  }));
  console.log(`📦 ${masterProducts.length} produtos master ativos encontrados.\n`);

  if (masterProducts.length === 0) {
    console.error(
      '❌ Nenhum produto master ativo encontrado. Rode import-master-products-dev.js primeiro.'
    );
    process.exit(1);
  }

  const consultantRefsByIndex = new Map<number, { id: string; email: string }>();

  // ── 2. Consultores ──────────────────────────────────────────────────────
  console.log('👥 Criando consultores...');
  const consultantData: {
    seed: ConsultantSeed;
    userId: string;
    consultantId: string;
    email: string;
    code: string;
  }[] = [];

  for (const seed of CONSULTANTS) {
    const email = `${slugEmail(seed.name)}@rennova-demo.com.br`;
    const userId = await createAuthUser(email, seed.name);
    const code = String(randInt(100000, 999999));

    const authorizedTenantIds: string[] = []; // preenchido depois que os tenants existirem

    const consultantRef = await db.collection('consultants').add({
      user_id: userId,
      code,
      name: seed.name,
      email,
      phone: seed.phone,
      status: 'active',
      authorized_tenants: authorizedTenantIds,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      created_by: 'seed-script',
    });

    await db.collection('users').doc(userId).set({
      email,
      full_name: seed.name,
      phone: seed.phone,
      role: 'clinic_consultant',
      tenant_id: null,
      active: true,
      requirePasswordChange: false,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    consultantData.push({ seed, userId, consultantId: consultantRef.id, email, code });
    createdAccounts.push({ role: 'Consultor Rennova', name: seed.name, email });
    console.log(`   ✅ ${seed.name} (${email}, código ${code})`);
  }

  // ── 3. Clínicas + usuários + inventário + solicitações ──────────────────
  for (let clinicIndex = 0; clinicIndex < CLINICS.length; clinicIndex++) {
    const clinic = CLINICS[clinicIndex];
    console.log(
      `\n🏥 [${clinicIndex + 1}/${CLINICS.length}] ${clinic.name} (${clinic.city}/${clinic.state})`
    );

    const cnpj = generateFakeCNPJ();
    const tenantRef = await db.collection('tenants').add({
      name: clinic.name,
      document_type: 'cnpj',
      document_number: cnpj,
      cnpj,
      max_users: 5,
      email: `contato@${slugEmail(clinic.name)}-demo.com.br`,
      phone: `(${randInt(11, 91)}) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
      address: `Rua das Flores, ${randInt(100, 999)}`,
      city: clinic.city,
      state: clinic.state,
      cep: clinic.cep,
      active: true,
      onboarding_completed: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    const tenantId = tenantRef.id;

    // Admin da clínica
    const adminEmail = `${slugEmail(clinic.adminName)}@${slugEmail(clinic.name)}-demo.com.br`;
    const adminUserId = await createAuthUser(adminEmail, clinic.adminName);
    await auth.setCustomUserClaims(adminUserId, {
      tenant_id: tenantId,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
      requirePasswordChange: false,
    });
    await db.collection('users').doc(adminUserId).set({
      tenant_id: tenantId,
      email: adminEmail,
      full_name: clinic.adminName,
      phone: '',
      role: 'clinic_admin',
      active: true,
      requirePasswordChange: false,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    createdAccounts.push({
      role: 'clinic_admin',
      clinicName: clinic.name,
      name: clinic.adminName,
      email: adminEmail,
    });

    // Especialistas (clinic_user)
    const clinicUserIds: { id: string; name: string; email: string }[] = [adminUserId].map(
      (id) => ({
        id,
        name: clinic.adminName,
        email: adminEmail,
      })
    );
    for (const userName of clinic.userNames) {
      const userEmail = `${slugEmail(userName)}@${slugEmail(clinic.name)}-demo.com.br`;
      const userId = await createAuthUser(userEmail, userName);
      await auth.setCustomUserClaims(userId, {
        tenant_id: tenantId,
        role: 'clinic_user',
        is_system_admin: false,
        active: true,
        requirePasswordChange: false,
      });
      await db.collection('users').doc(userId).set({
        tenant_id: tenantId,
        email: userEmail,
        full_name: userName,
        phone: '',
        role: 'clinic_user',
        active: true,
        requirePasswordChange: false,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      clinicUserIds.push({ id: userId, name: userName, email: userEmail });
      createdAccounts.push({
        role: 'clinic_user (especialista)',
        clinicName: clinic.name,
        name: userName,
        email: userEmail,
      });
    }
    console.log(
      `   👤 ${clinicUserIds.length} usuários criados (1 admin + ${clinicUserIds.length - 1} especialistas)`
    );

    // Vincular consultores desta clínica
    for (const c of consultantData) {
      if (c.seed.clinicIndexes.includes(clinicIndex)) {
        if (!consultantRefsByIndex.has(clinicIndex))
          consultantRefsByIndex.set(clinicIndex, { id: c.consultantId, email: c.email });
        await db
          .collection('consultants')
          .doc(c.consultantId)
          .update({ authorized_tenants: FieldValue.arrayUnion(tenantId) });
        await auth.setCustomUserClaims(c.userId, {
          tenant_id: null,
          role: 'clinic_consultant',
          is_system_admin: false,
          is_consultant: true,
          consultant_id: c.consultantId,
          authorized_tenants: (await db.collection('consultants').doc(c.consultantId).get()).data()
            ?.authorized_tenants,
          active: true,
          requirePasswordChange: false,
        });
      }
    }

    // Inventário: 8 produtos, 1-2 lotes cada
    const selectedProducts = [...masterProducts].sort(() => Math.random() - 0.5).slice(0, 8);
    const lots: {
      id: string;
      codigo_produto: string;
      nome_produto: string;
      lote: string;
      valor_unitario: number;
      qtyRemaining: number;
      dtEntrada: Date;
    }[] = [];

    let batch = db.batch();
    let batchCount = 0;
    let nfCounter = 1;

    for (const product of selectedProducts) {
      const numLots = Math.random() < 0.3 ? 2 : 1;
      const [minPrice, maxPrice] = CATEGORY_PRICE_RANGE[product.category] ?? [50, 200];

      for (let lotIdx = 0; lotIdx < numLots; lotIdx++) {
        const dtEntrada = daysAgo(randInt(30, 340));
        const quantidadeInicial = randInt(10, 40);
        const valorUnitario = Number((Math.random() * (maxPrice - minPrice) + minPrice).toFixed(2));
        const loteCode = `L${randInt(1000, 9999)}${String.fromCharCode(65 + lotIdx)}`;
        const dtValidade = daysFromNow(randInt(365, 900));

        const itemRef = db.collection(`tenants/${tenantId}/inventory`).doc();
        batch.set(itemRef, {
          tenant_id: tenantId,
          produto_id: `demo-${product.code}`,
          master_product_id: product.id,
          codigo_produto: product.code,
          nome_produto: product.name,
          lote: loteCode,
          quantidade_inicial: quantidadeInicial,
          quantidade_disponivel: quantidadeInicial, // ajustado depois do consumo
          quantidade_reservada: 0,
          dt_validade: formatDateBR(dtValidade),
          dt_entrada: Timestamp.fromDate(dtEntrada),
          valor_unitario: valorUnitario,
          nf_numero: `DEMO-${String(nfCounter++).padStart(4, '0')}`,
          brand: 'Rennova',
          is_rennova: true,
          active: true,
          created_at: Timestamp.fromDate(dtEntrada),
          updated_at: Timestamp.fromDate(dtEntrada),
        });
        batchCount++;

        lots.push({
          id: itemRef.id,
          codigo_produto: product.code,
          nome_produto: product.name,
          lote: loteCode,
          valor_unitario: valorUnitario,
          qtyRemaining: quantidadeInicial,
          dtEntrada,
        });

        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
    console.log(
      `   📦 ${lots.length} lotes de inventário criados (${selectedProducts.length} produtos)`
    );

    // Solicitações: histórico do último ano + algumas agendadas futuras
    const numHistorico = randInt(45, 65);
    const numAgendadas = randInt(3, 5);

    const events: { dtProcedimento: Date; status: 'concluida' | 'cancelada' | 'agendada' }[] = [];
    for (let i = 0; i < numHistorico; i++) {
      const dt = daysAgo(randInt(1, 364));
      const status = Math.random() < 0.88 ? 'concluida' : 'cancelada';
      events.push({ dtProcedimento: dt, status });
    }
    for (let i = 0; i < numAgendadas; i++) {
      events.push({ dtProcedimento: daysFromNow(randInt(1, 30)), status: 'agendada' });
    }
    events.sort((a, b) => a.dtProcedimento.getTime() - b.dtProcedimento.getTime());

    let solBatch = db.batch();
    let solBatchCount = 0;
    let concluidas = 0;
    let canceladas = 0;
    let agendadas = 0;

    for (const event of events) {
      const author = pick(clinicUserIds);
      const numProdutos = randInt(1, 2);
      const lotsComEstoque = lots.filter((l) => l.qtyRemaining > 0);
      if (lotsComEstoque.length === 0) continue;

      const produtosEscolhidos = [...lotsComEstoque]
        .sort(() => Math.random() - 0.5)
        .slice(0, numProdutos);
      const produtosSolicitados = [];

      for (const lot of produtosEscolhidos) {
        const maxQty = Math.min(lot.qtyRemaining, 5);
        if (maxQty < 1) continue;
        const quantidade = randInt(1, maxQty);
        const antes = lot.qtyRemaining;

        // Só decrementa o estoque de eventos que realmente consomem (concluida);
        // agendada/cancelada não afetam quantidade_disponivel.
        if (event.status === 'concluida') {
          lot.qtyRemaining -= quantidade;
        }

        produtosSolicitados.push({
          inventory_item_id: lot.id,
          produto_codigo: lot.codigo_produto,
          produto_nome: lot.nome_produto,
          lote: lot.lote,
          quantidade,
          quantidade_disponivel_antes: antes,
          valor_unitario: lot.valor_unitario,
        });
      }
      if (produtosSolicitados.length === 0) continue;

      const solRef = db.collection(`tenants/${tenantId}/solicitacoes`).doc();
      solBatch.set(solRef, {
        tenant_id: tenantId,
        tipo: 'efetuado',
        descricao: pick(PROCEDURE_DESCRIPTIONS),
        dt_procedimento: Timestamp.fromDate(event.dtProcedimento),
        produtos_solicitados: produtosSolicitados,
        status: event.status,
        created_by: author.id,
        created_by_name: author.name,
        created_at: Timestamp.fromDate(event.dtProcedimento),
        updated_at: Timestamp.fromDate(event.dtProcedimento),
      });
      solBatchCount++;
      if (event.status === 'concluida') concluidas++;
      else if (event.status === 'cancelada') canceladas++;
      else agendadas++;

      if (solBatchCount >= 400) {
        await solBatch.commit();
        solBatch = db.batch();
        solBatchCount = 0;
      }
    }
    if (solBatchCount > 0) {
      await solBatch.commit();
    }
    console.log(
      `   🗓️  ${concluidas + canceladas + agendadas} solicitações (${concluidas} concluídas, ${canceladas} canceladas, ${agendadas} agendadas)`
    );

    // Atualizar quantidade_disponivel final dos lotes após o consumo simulado
    let finalBatch = db.batch();
    let finalBatchCount = 0;
    for (const lot of lots) {
      finalBatch.update(db.doc(`tenants/${tenantId}/inventory/${lot.id}`), {
        quantidade_disponivel: Math.max(lot.qtyRemaining, 0),
      });
      finalBatchCount++;
      if (finalBatchCount >= 400) {
        await finalBatch.commit();
        finalBatch = db.batch();
        finalBatchCount = 0;
      }
    }
    if (finalBatchCount > 0) {
      await finalBatch.commit();
    }
  }

  // ── 4. Documentação local ────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('# Contas de Demonstração — curva-mestra-dev (dev-gscandelari.web.app)');
  lines.push('');
  lines.push(`Geradas em: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`**Senha de todas as contas abaixo:** \`${SENHA_DEMO}\``);
  lines.push('');
  lines.push(
    '> Este arquivo não é commitado no repositório (contém e-mails/senha de contas reais,'
  );
  lines.push('> mesmo que fictícias, em um ambiente Firebase real). Guarde localmente.');
  lines.push('');
  lines.push('## Consultores Rennova');
  lines.push('');
  for (const acc of createdAccounts.filter((a) => a.role === 'Consultor Rennova')) {
    lines.push(`- **${acc.name}** — ${acc.email}`);
  }
  lines.push('');
  lines.push('## Clínicas');
  lines.push('');
  for (const clinic of CLINICS) {
    lines.push(`### ${clinic.name} (${clinic.city}/${clinic.state})`);
    lines.push('');
    for (const acc of createdAccounts.filter((a) => a.clinicName === clinic.name)) {
      lines.push(`- **${acc.role}**: ${acc.name} — ${acc.email}`);
    }
    lines.push('');
  }

  const outPath = join(process.cwd(), 'ONLY_FOR_DEVS', 'DEMO-ACCOUNTS-DEV.local.md');
  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`\n📄 Documentação salva em: ${outPath}`);
  console.log('\n✅ Concluído.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro durante o seed:', err);
  process.exit(1);
});
