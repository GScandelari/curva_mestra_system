/**
 * Bootstrap inicial para ambientes reais (pré-prod / produção).
 * Usa Firebase Admin SDK com service account — nunca Client SDK.
 *
 * Pré-requisito:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/absoluto/service-account.json
 *
 * O arquivo service-account.json já está coberto pelo .gitignore.
 * NUNCA execute este script apontando para emuladores.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, '.env.dev-tools') });

if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('\n❌ Variáveis de emulador detectadas no ambiente.');
  console.error('   Este script conecta a ambientes reais. Remova as variáveis de emulador antes de prosseguir.');
  console.error('   Para setup local use: node dev-tools/setup-local.mjs\n');
  process.exit(1);
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error('\n❌ GOOGLE_APPLICATION_CREDENTIALS não definido.');
  console.error('   Exporte o caminho para o service account antes de executar:');
  console.error('   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/absoluto/service-account.json\n');
  process.exit(1);
}

const { readFileSync } = await import('fs');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf-8'));
} catch {
  console.error('\n❌ Não foi possível ler o service account. Verifique o caminho em GOOGLE_APPLICATION_CREDENTIALS.\n');
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt) => new Promise((res) => rl.question(prompt, res));

function header() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Curva Mestra — Bootstrap Prod / Pré-Prod       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Projeto: ${serviceAccount.project_id.padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('\n⚠️  ATENÇÃO: você está conectado a um ambiente REAL.\n');
}

async function confirmAction(message) {
  const answer = (await ask(`${message} (sim/não): `)).trim().toLowerCase();
  return answer === 'sim' || answer === 's';
}

async function createSystemAdmin() {
  console.log('── Criar System Admin ──────────────────────────────\n');
  const email = (await ask('Email: ')).trim();
  const password = (await ask('Senha (mínimo 8 caracteres): ')).trim();
  const displayName = (await ask('Nome: ')).trim();

  if (!email || password.length < 8 || !displayName) {
    console.error('\n❌ Email, senha (mín. 8 chars) e nome são obrigatórios.');
    return;
  }

  console.log(`\nAção: criar system admin "${email}" no projeto "${serviceAccount.project_id}"`);
  if (!(await confirmAction('Confirmar?'))) {
    console.log('Cancelado.');
    return;
  }

  try {
    const user = await auth.createUser({ email, password, displayName });
    await auth.setCustomUserClaims(user.uid, {
      is_system_admin: true,
      role: 'system_admin',
      active: true,
    });
    console.log('\n✅ System Admin criado!');
    console.log(`   UID:   ${user.uid}`);
    console.log(`   Email: ${email}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.error('\n❌ Email já em uso neste projeto Firebase.');
    } else {
      console.error('\n❌ Erro:', err.message);
    }
  }
}

async function createTenant() {
  console.log('── Criar Tenant Inicial ────────────────────────────\n');
  const name = (await ask('Nome da clínica: ')).trim();
  const cnpj = (await ask('CNPJ: ')).trim();
  const email = (await ask('Email da clínica: ')).trim();
  const adminEmail = (await ask('Email do clinic_admin (deve existir no Auth): ')).trim();

  if (!name || !cnpj || !email || !adminEmail) {
    console.error('\n❌ Todos os campos são obrigatórios.');
    return;
  }

  console.log(`\nAção: criar tenant "${name}" no projeto "${serviceAccount.project_id}"`);
  if (!(await confirmAction('Confirmar?'))) {
    console.log('Cancelado.');
    return;
  }

  try {
    const adminUser = await auth.getUserByEmail(adminEmail);
    const tenantId = `tenant_${Date.now()}`;

    await db.collection('tenants').doc(tenantId).set({
      id: tenantId,
      name,
      cnpj,
      email,
      plan_id: 'basic',
      active: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .doc(adminUser.uid)
      .set({
        uid: adminUser.uid,
        tenant_id: tenantId,
        role: 'clinic_admin',
        active: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

    await auth.setCustomUserClaims(adminUser.uid, {
      tenant_id: tenantId,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });

    console.log('\n✅ Tenant criado!');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Nome:      ${name}`);
    console.log(`   Admin UID: ${adminUser.uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error('\n❌ Usuário não encontrado. Crie o system admin primeiro (opção 1).');
    } else {
      console.error('\n❌ Erro:', err.message);
    }
  }
}

async function importRennovaProducts() {
  console.log('── Importar Produtos Rennova (CSV) ─────────────────\n');

  const defaultCsvPath = resolve(__dir, '../_lista_produtos_rennova_/lista_produtos_rennova.csv');
  const inputPath = (await ask(`Caminho do CSV [${defaultCsvPath}]: `)).trim() || defaultCsvPath;

  const { readFileSync: readFile } = await import('fs');
  let csvContent;
  try {
    csvContent = readFile(inputPath, 'utf-8');
  } catch {
    console.error(`\n❌ Arquivo não encontrado: ${inputPath}`);
    return;
  }

  const lines = csvContent.split('\n').filter((l) => l.trim());
  const productLines = lines.slice(1); // pula cabeçalho
  const validLines = productLines.filter((l) => {
    const [codigo, nome] = l.split(';').map((s) => s.trim().replaceAll('"', ''));
    return codigo && nome;
  });

  console.log(`\nAção: importar ${validLines.length} produtos para "produtos" no projeto "${serviceAccount.project_id}"`);
  if (!(await confirmAction('Confirmar?'))) {
    console.log('Cancelado.');
    return;
  }

  const productsRef = db.collection('produtos');
  let imported = 0;
  let skipped = 0;

  for (const line of validLines) {
    const [codigo, nome] = line.split(';').map((s) => s.trim().replaceAll('"', ''));
    const productRef = productsRef.doc(codigo);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      await productRef.set({
        codigo,
        nome,
        ativo: true,
        fornecedor: 'Rennova',
        categoria: 'harmonizacao',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      imported++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Importação concluída!`);
  console.log(`   Importados: ${imported}`);
  console.log(`   Já existiam: ${skipped}`);
}

async function main() {
  header();

  // Exige confirmação explícita do projeto antes de qualquer operação
  console.log('Digite o ID do projeto para confirmar que você está ciente do ambiente:');
  const typed = (await ask('> ')).trim();
  if (typed !== serviceAccount.project_id) {
    console.error('\n❌ ID do projeto não confere. Abortando.\n');
    rl.close();
    process.exit(1);
  }
  console.log('\n✅ Confirmado.\n');

  while (true) {
    console.log('Opções:');
    console.log('  1. Criar System Admin');
    console.log('  2. Criar Tenant inicial');
    console.log('  3. Importar produtos Rennova (CSV)');
    console.log('  0. Sair\n');

    const choice = (await ask('Escolha: ')).trim();
    console.log();

    if (choice === '1') await createSystemAdmin();
    else if (choice === '2') await createTenant();
    else if (choice === '3') await importRennovaProducts();
    else if (choice === '0') break;
    else console.log('Opção inválida.');

    if (choice !== '0') {
      await ask('\nPressione Enter para continuar...');
      console.log();
    }
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
