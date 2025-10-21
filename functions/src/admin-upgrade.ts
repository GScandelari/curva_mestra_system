import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Função HTTP simples para upgrade (alternativa)
 */
export const upgradeToAdminHttp = functions.https.onRequest(async (req, res) => {
  try {
    // Configurar CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const targetUid = '0vdFsTyia3di70080j9KG1vccLN2';
    const targetEmail = 'scandelari.guilherme@hotmail.com';

    console.log('🔄 HTTP Upgrade para admin');
    console.log('👤 UID:', targetUid);
    console.log('📧 Email:', targetEmail);

    // Custom claims para admin
    const adminClaims = {
      role: 'admin',
      isAdmin: true,
      clinicId: 'default-clinic',
      permissions: [
        'view_products', 'manage_products', 'view_requests', 'approve_requests',
        'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
        'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
      ]
    };

    // Aplicar custom claims
    await admin.auth().setCustomUserClaims(targetUid, adminClaims);
    
    console.log('✅ Custom claims aplicados com sucesso!');

    // Verificar se foi aplicado
    const user = await admin.auth().getUser(targetUid);
    
    const result = {
      success: true,
      message: 'UPGRADE REALIZADO COM SUCESSO!',
      user: {
        email: user.email,
        uid: user.uid,
        role: user.customClaims?.role,
        isAdmin: user.customClaims?.isAdmin,
        clinicId: user.customClaims?.clinicId,
        permissions: user.customClaims?.permissions?.length || 0
      },
      nextSteps: [
        '1. 🚪 Faça LOGOUT do sistema',
        '2. 🔑 Faça LOGIN novamente',
        '3. 🌐 Acesse: https://curva-mestra.web.app',
        '4. ✅ Verifique acesso de Admin!'
      ]
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Erro no upgrade HTTP:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Erro ao fazer upgrade para admin'
    });
  }
});