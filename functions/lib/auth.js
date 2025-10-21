"use strict";
/**
 * Firebase Functions for Authentication and User Management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listClinicUsers = exports.initializeClinic = exports.updateUserProfile = exports.getUserProfile = exports.setUserRole = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Role-based permissions mapping
 */
const ROLE_PERMISSIONS = {
    admin: [
        'manage_users', 'manage_products', 'manage_requests', 'manage_patients',
        'manage_invoices', 'view_reports', 'manage_settings', 'approve_requests'
    ],
    manager: [
        'manage_products', 'view_requests', 'approve_requests', 'view_reports',
        'manage_invoices', 'view_patients'
    ],
    doctor: [
        'view_products', 'request_products', 'manage_patients', 'view_invoices',
        'create_treatments'
    ],
    receptionist: [
        'view_patients', 'manage_patients', 'view_requests', 'view_invoices'
    ]
};
/**
 * Set custom claims for a user (admin only)
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    // Check if user is admin
    if (!request.auth.token.admin && request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas administradores podem definir roles');
    }
    const { uid, role, clinicId } = request.data;
    // Validate input
    if (!uid || !role || !clinicId) {
        throw new https_1.HttpsError('invalid-argument', 'UID, role e clinicId são obrigatórios');
    }
    if (!Object.keys(ROLE_PERMISSIONS).includes(role)) {
        throw new https_1.HttpsError('invalid-argument', 'Role inválido');
    }
    try {
        // Get user to verify it exists
        await admin.auth().getUser(uid);
        // Set custom claims
        const customClaims = {
            role: role,
            clinicId: clinicId,
            permissions: ROLE_PERMISSIONS[role],
        };
        // Add admin flag for admin users
        if (role === 'admin') {
            customClaims.admin = true;
        }
        await admin.auth().setCustomUserClaims(uid, customClaims);
        logger.info('User role updated', {
            uid,
            role,
            clinicId,
            updatedBy: request.auth.uid
        });
        return {
            success: true,
            message: 'Role definido com sucesso',
            uid,
            role,
            clinicId
        };
    }
    catch (error) {
        logger.error('Error setting user role', {
            error: error,
            uid,
            role,
            clinicId
        });
        if (error.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', 'Usuário não encontrado');
        }
        throw new https_1.HttpsError('internal', 'Erro interno do servidor');
    }
});
/**
 * Get user profile with custom claims
 */
exports.getUserProfile = (0, https_1.onCall)(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    try {
        const userRecord = await admin.auth().getUser(request.auth.uid);
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            customClaims: userRecord.customClaims || {},
            metadata: {
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
                lastRefreshTime: userRecord.metadata.lastRefreshTime
            }
        };
    }
    catch (error) {
        logger.error('Error getting user profile', {
            error: error,
            uid: request.auth.uid
        });
        throw new https_1.HttpsError('internal', 'Erro ao buscar perfil do usuário');
    }
});
/**
 * Update user profile
 */
exports.updateUserProfile = (0, https_1.onCall)(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    const { displayName, email } = request.data;
    // Validate input
    if (!displayName && !email) {
        throw new https_1.HttpsError('invalid-argument', 'Pelo menos um campo deve ser fornecido');
    }
    try {
        const updateData = {};
        if (displayName) {
            updateData.displayName = displayName;
        }
        if (email) {
            updateData.email = email;
            updateData.emailVerified = false; // Reset email verification
        }
        const userRecord = await admin.auth().updateUser(request.auth.uid, updateData);
        logger.info('User profile updated', {
            uid: request.auth.uid,
            updatedFields: Object.keys(updateData)
        });
        return {
            success: true,
            message: 'Perfil atualizado com sucesso',
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                emailVerified: userRecord.emailVerified
            }
        };
    }
    catch (error) {
        logger.error('Error updating user profile', {
            error: error,
            uid: request.auth.uid
        });
        if (error.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'Email já está em uso');
        }
        throw new https_1.HttpsError('internal', 'Erro ao atualizar perfil');
    }
});
/**
 * Initialize clinic for a user (creates clinic and sets user as admin)
 */
exports.initializeClinic = (0, https_1.onCall)(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    const { clinicName, clinicData } = request.data;
    // Validate input
    if (!clinicName) {
        throw new https_1.HttpsError('invalid-argument', 'Nome da clínica é obrigatório');
    }
    try {
        const db = admin.firestore();
        // Create clinic document
        const clinicRef = await db.collection('clinics').add(Object.assign({ name: clinicName, createdAt: admin.firestore.FieldValue.serverTimestamp(), ownerId: request.auth.uid, isActive: true }, clinicData));
        // Set user as admin of the clinic
        const customClaims = {
            role: 'admin',
            clinicId: clinicRef.id,
            permissions: ROLE_PERMISSIONS.admin,
        };
        await admin.auth().setCustomUserClaims(request.auth.uid, Object.assign(Object.assign({}, customClaims), { admin: true }));
        // Create initial user document in clinic subcollection
        await db.collection(`clinics/${clinicRef.id}/users`).doc(request.auth.uid).set({
            email: request.auth.token.email,
            displayName: request.auth.token.name || request.auth.token.email,
            role: 'admin',
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isOwner: true
        });
        logger.info('Clinic initialized', {
            clinicId: clinicRef.id,
            clinicName,
            ownerId: request.auth.uid
        });
        return {
            success: true,
            message: 'Clínica criada com sucesso',
            clinicId: clinicRef.id,
            clinicName
        };
    }
    catch (error) {
        logger.error('Error initializing clinic', {
            error: error,
            clinicName,
            userId: request.auth.uid
        });
        throw new https_1.HttpsError('internal', 'Erro ao criar clínica');
    }
});
/**
 * List users in a clinic (admin/manager only)
 */
exports.listClinicUsers = (0, https_1.onCall)(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    // Check if user has permission
    const userRole = request.auth.token.role;
    if (!['admin', 'manager'].includes(userRole)) {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado');
    }
    const clinicId = request.auth.token.clinicId;
    if (!clinicId) {
        throw new https_1.HttpsError('failed-precondition', 'Usuário não associado a uma clínica');
    }
    try {
        const db = admin.firestore();
        const usersSnapshot = await db
            .collection(`clinics/${clinicId}/users`)
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .get();
        const users = usersSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return {
            success: true,
            users,
            total: users.length
        };
    }
    catch (error) {
        logger.error('Error listing clinic users', {
            error: error,
            clinicId,
            requestedBy: request.auth.uid
        });
        throw new https_1.HttpsError('internal', 'Erro ao listar usuários');
    }
});
//# sourceMappingURL=auth.js.map