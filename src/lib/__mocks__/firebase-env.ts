/**
 * Variáveis de ambiente falsas para inicialização do Firebase SDK em testes.
 * Permite que o SDK inicialize sem credenciais reais, sem fazer chamadas à API.
 */
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'fake-api-key-for-testing';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'fake-project.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'fake-project';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'fake-project.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:0000000000000000';
