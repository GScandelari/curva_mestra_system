const { User } = require('../src/models');
const firebaseConfig = require('../src/config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * User Migration Script - PostgreSQL to Firebase Auth
 * 
 * This script migrates existing users from PostgreSQL to Firebase Authentication
 * while maintaining their IDs and roles through custom claims.
 */
class UserMigration {
  constructor() {
    this.firebase = firebaseConfig;
    this.migrationResults = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Initialize Firebase and database connections
   */
  async initialize() {
    try {
      // Initialize Firebase
      this.firebase.initialize();
      console.log('Firebase initialized for migration');

      // Test database connection
      const { sequelize } = require('../src/models');
      await sequelize.authenticate();
      console.log('Database connection established');

      return true;
    } catch (error) {
      console.error('Error initializing migration:', error);
      throw error;
    }
  }

  /**
   * Extract users from PostgreSQL database
   */
  async extractUsersFromPostgreSQL() {
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'role', 'isActive', 'createdAt'],
        where: {
          isActive: true // Only migrate active users
        },
        order: [['createdAt', 'ASC']]
      });

      console.log(`Found ${users.length} users to migrate`);
      return users;
    } catch (error) {
      console.error('Error extracting users from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Map PostgreSQL role to Firebase custom claims
   * @param {string} role - PostgreSQL role
   * @param {string} userId - User ID for clinic association
   */
  mapRoleToCustomClaims(role, userId) {
    const basePermissions = {
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

    return {
      role: role,
      permissions: basePermissions[role] || [],
      clinicId: 'default-clinic', // Will be updated when clinic system is implemented
      migrated: true,
      migratedAt: new Date().toISOString(),
      originalUserId: userId
    };
  }

  /**
   * Create Firebase user from PostgreSQL user data
   * @param {Object} postgresUser - PostgreSQL user object
   */
  async createFirebaseUser(postgresUser) {
    try {
      const userData = {
        uid: postgresUser.id, // Maintain the same ID
        email: postgresUser.email,
        displayName: postgresUser.username,
        disabled: false,
        emailVerified: true // Assume existing users have verified emails
      };

      const customClaims = this.mapRoleToCustomClaims(
        postgresUser.role, 
        postgresUser.id
      );

      // Create user in Firebase Auth
      const userRecord = await this.firebase.createUserWithClaims(userData, customClaims);

      console.log(`✓ Successfully migrated user: ${postgresUser.email} (${postgresUser.role})`);
      
      return {
        success: true,
        firebaseUid: userRecord.uid,
        email: postgresUser.email,
        role: postgresUser.role
      };
    } catch (error) {
      console.error(`✗ Failed to migrate user ${postgresUser.email}:`, error.message);
      
      return {
        success: false,
        email: postgresUser.email,
        error: error.message
      };
    }
  }

  /**
   * Validate migrated user in Firebase
   * @param {string} uid - Firebase UID
   * @param {Object} originalUser - Original PostgreSQL user
   */
  async validateMigratedUser(uid, originalUser) {
    try {
      const firebaseUser = await this.firebase.getUser(uid);
      const idTokenResult = await this.firebase.getAuth().createCustomToken(uid);
      
      // Verify basic properties
      const isValid = 
        firebaseUser.email === originalUser.email &&
        firebaseUser.displayName === originalUser.username &&
        !firebaseUser.disabled;

      if (isValid) {
        console.log(`✓ Validation successful for user: ${originalUser.email}`);
      } else {
        console.log(`✗ Validation failed for user: ${originalUser.email}`);
      }

      return isValid;
    } catch (error) {
      console.error(`Error validating user ${uid}:`, error.message);
      return false;
    }
  }

  /**
   * Execute the complete migration process
   */
  async executeMigration() {
    try {
      console.log('🚀 Starting user migration to Firebase Auth...\n');

      // Initialize connections
      await this.initialize();

      // Extract users from PostgreSQL
      const postgresUsers = await this.extractUsersFromPostgreSQL();
      this.migrationResults.total = postgresUsers.length;

      if (postgresUsers.length === 0) {
        console.log('No users found to migrate');
        return this.migrationResults;
      }

      console.log(`\n📊 Migration Summary:`);
      console.log(`Total users to migrate: ${postgresUsers.length}\n`);

      // Migrate each user
      for (const user of postgresUsers) {
        try {
          const result = await this.createFirebaseUser(user);
          
          if (result.success) {
            // Validate the migration
            const isValid = await this.validateMigratedUser(user.id, user);
            
            if (isValid) {
              this.migrationResults.successful++;
            } else {
              this.migrationResults.failed++;
              this.migrationResults.errors.push({
                email: user.email,
                error: 'Validation failed after migration'
              });
            }
          } else {
            this.migrationResults.failed++;
            this.migrationResults.errors.push({
              email: user.email,
              error: result.error
            });
          }
        } catch (error) {
          this.migrationResults.failed++;
          this.migrationResults.errors.push({
            email: user.email,
            error: error.message
          });
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Print final results
      this.printMigrationResults();
      
      return this.migrationResults;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Print migration results
   */
  printMigrationResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📈 MIGRATION RESULTS');
    console.log('='.repeat(50));
    console.log(`Total users: ${this.migrationResults.total}`);
    console.log(`✅ Successful: ${this.migrationResults.successful}`);
    console.log(`❌ Failed: ${this.migrationResults.failed}`);
    console.log(`📊 Success rate: ${((this.migrationResults.successful / this.migrationResults.total) * 100).toFixed(1)}%`);

    if (this.migrationResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.migrationResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.email}: ${error.error}`);
      });
    }

    console.log('\n✨ Migration completed!');
  }

  /**
   * Rollback migration (delete migrated users from Firebase)
   */
  async rollbackMigration() {
    try {
      console.log('🔄 Starting migration rollback...');

      const postgresUsers = await this.extractUsersFromPostgreSQL();
      let deletedCount = 0;

      for (const user of postgresUsers) {
        try {
          await this.firebase.deleteUser(user.id);
          deletedCount++;
          console.log(`✓ Deleted Firebase user: ${user.email}`);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            console.log(`- User not found in Firebase: ${user.email}`);
          } else {
            console.error(`✗ Error deleting user ${user.email}:`, error.message);
          }
        }
      }

      console.log(`\n🔄 Rollback completed. Deleted ${deletedCount} users from Firebase.`);
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }
}

/**
 * CLI Interface
 */
async function main() {
  const migration = new UserMigration();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'migrate':
        await migration.executeMigration();
        break;
      case 'rollback':
        await migration.rollbackMigration();
        break;
      case 'validate':
        await migration.initialize();
        const users = await migration.extractUsersFromPostgreSQL();
        console.log(`Found ${users.length} users in PostgreSQL`);
        
        for (const user of users.slice(0, 5)) { // Validate first 5 users
          try {
            const firebaseUser = await migration.firebase.getUser(user.id);
            console.log(`✓ User exists in Firebase: ${user.email}`);
          } catch (error) {
            console.log(`✗ User not found in Firebase: ${user.email}`);
          }
        }
        break;
      default:
        console.log('Usage:');
        console.log('  node migrate-users-to-firebase.js migrate   - Migrate users to Firebase');
        console.log('  node migrate-users-to-firebase.js rollback  - Delete migrated users from Firebase');
        console.log('  node migrate-users-to-firebase.js validate  - Validate existing migrations');
        process.exit(1);
    }
  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = UserMigration;