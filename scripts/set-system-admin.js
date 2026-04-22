/**
 * Seta Custom Claims de system_admin em um usuário do Firebase Auth.
 *
 * Uso:
 *   FIREBASE_ADMIN_CREDENTIALS='<json>' node scripts/set-system-admin.js <email>
 *
 * Exemplo:
 *   FIREBASE_ADMIN_CREDENTIALS='{"type":"service_account",...}' \
 *     node scripts/set-system-admin.js scandelari.guilherme@curvamestra.com.br
 */

const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) {
  console.error('❌ Informe o email: node scripts/set-system-admin.js <email>');
  process.exit(1);
}

const credJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!credJson) {
  console.error('❌ Variável FIREBASE_ADMIN_CREDENTIALS não definida.');
  process.exit(1);
}

const credential = JSON.parse(credJson);

admin.initializeApp({
  credential: admin.credential.cert(credential),
});

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  console.log(`✅ Usuário encontrado: ${user.uid} (${user.email})`);

  await admin.auth().setCustomUserClaims(user.uid, {
    role: 'system_admin',
    is_system_admin: true,
    active: true,
  });

  console.log('✅ Custom Claims setados:');
  console.log('   role: system_admin');
  console.log('   is_system_admin: true');
  console.log('   active: true');
  console.log('\n⚠️  O usuário precisa fazer logout e login novamente para o token ser atualizado.');
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
