/**
 * Setup do ambiente local de desenvolvimento.
 * Requer emuladores Firebase rodando: npm run firebase:emulators
 * Requer: dev-tools/.env.dev-tools (copie de .env.dev-tools.example)
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, '.env.dev-tools') });

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('\n❌ FIREBASE_PROJECT_ID não encontrado.');
  console.error('   Copie dev-tools/.env.dev-tools.example → dev-tools/.env.dev-tools e preencha.\n');
  process.exit(1);
}

// Deve ser definido antes de importar firebase-admin
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt) => new Promise((res) => rl.question(prompt, res));

function header() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    Curva Mestra — Setup Local (Emuladores)       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST.padEnd(38)}║`);
  console.log(`║  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST.padEnd(38)}║`);
  console.log(`║  Projeto:   ${projectId.padEnd(38)}║`);
  console.log('╚══════════════════════════════════════════════════╝\n');
}

async function createSystemAdmin() {
  console.log('── Criar System Admin ──────────────────────────────\n');
  const email = (await ask('Email [admin@curva-mestra.dev]: ')).trim() || 'admin@curva-mestra.dev';
  const password = (await ask('Senha [admin123]: ')).trim() || 'admin123';
  const displayName = (await ask('Nome [System Admin]: ')).trim() || 'System Admin';

  try {
    const user = await auth.createUser({ email, password, displayName });
    await auth.setCustomUserClaims(user.uid, {
      is_system_admin: true,
      role: 'system_admin',
      active: true,
    });
    console.log('\n✅ System Admin criado!');
    console.log(`   UID:    ${user.uid}`);
    console.log(`   Email:  ${email}`);
    console.log('   Claims: is_system_admin=true | role=system_admin | active=true');
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      console.error('\n❌ Email já em uso. Use a opção 3 para ajustar claims em usuário existente.');
    } else {
      console.error('\n❌ Erro:', err.message);
    }
  }
}

async function createTenant() {
  console.log('── Criar Tenant (Clínica) ──────────────────────────\n');
  const name = (await ask('Nome da clínica: ')).trim();
  const cnpj = (await ask('CNPJ: ')).trim();
  const email = (await ask('Email da clínica: ')).trim();
  const adminEmail = (await ask('Email do clinic_admin (usuário já deve existir no Auth): ')).trim();

  if (!name || !cnpj || !email || !adminEmail) {
    console.error('\n❌ Todos os campos são obrigatórios.');
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
    console.log('   Claims e documento do usuário configurados.');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error('\n❌ Usuário não encontrado. Crie o usuário primeiro (opção 1 ou via app).');
    } else {
      console.error('\n❌ Erro:', err.message);
    }
  }
}

async function setCustomClaims() {
  console.log('── Configurar Custom Claims em usuário existente ───\n');
  const email = (await ask('Email do usuário: ')).trim();
  const role = (await ask('Role (system_admin | clinic_admin | clinic_user): ')).trim();
  const tenantId = (await ask('Tenant ID (deixe vazio se system_admin): ')).trim() || undefined;

  if (!email || !role) {
    console.error('\n❌ Email e role são obrigatórios.');
    return;
  }

  const validRoles = ['system_admin', 'clinic_admin', 'clinic_user'];
  if (!validRoles.includes(role)) {
    console.error(`\n❌ Role inválida. Use: ${validRoles.join(' | ')}`);
    return;
  }

  try {
    const user = await auth.getUserByEmail(email);
    const claims = {
      role,
      is_system_admin: role === 'system_admin',
      active: true,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };
    await auth.setCustomUserClaims(user.uid, claims);
    console.log('\n✅ Custom claims configurados!');
    console.log(`   UID:    ${user.uid}`);
    console.log(`   Claims: ${JSON.stringify(claims)}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error('\n❌ Usuário não encontrado.');
    } else {
      console.error('\n❌ Erro:', err.message);
    }
  }
}

async function main() {
  header();
  while (true) {
    console.log('Opções:');
    console.log('  1. Criar System Admin');
    console.log('  2. Criar Tenant (Clínica)');
    console.log('  3. Configurar Custom Claims em usuário existente');
    console.log('  0. Sair\n');

    const choice = (await ask('Escolha: ')).trim();
    console.log();

    if (choice === '1') await createSystemAdmin();
    else if (choice === '2') await createTenant();
    else if (choice === '3') await setCustomClaims();
    else if (choice === '0') break;
    else console.log('Opção inválida.');

    if (choice !== '0') {
      await ask('\nPressione Enter para continuar...');
      header();
    }
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
