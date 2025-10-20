const fs = require('fs').promises;
const path = require('path');
const sequelize = require('../config/database');

const runMigrations = async () => {
  try {
    console.log('Iniciando migrações...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('Conexão com a base de dados estabelecida.');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log(`Encontradas ${migrationFiles.length} migrações.`);

    // Run migrations in order
    for (const file of migrationFiles) {
      console.log(`Executando migração: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      
      if (migration.up) {
        await migration.up(sequelize.getQueryInterface());
        console.log(`✓ Migração ${file} executada com sucesso.`);
      }
    }

    console.log('Todas as migrações foram executadas com sucesso!');
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    throw error;
  }
};

const rollbackMigrations = async () => {
  try {
    console.log('Iniciando rollback das migrações...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('Conexão com a base de dados estabelecida.');

    // Get migration files in reverse order
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()
      .reverse();

    console.log(`Encontradas ${migrationFiles.length} migrações para rollback.`);

    // Run rollbacks in reverse order
    for (const file of migrationFiles) {
      console.log(`Executando rollback: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      
      if (migration.down) {
        await migration.down(sequelize.getQueryInterface());
        console.log(`✓ Rollback ${file} executado com sucesso.`);
      }
    }

    console.log('Todos os rollbacks foram executados com sucesso!');
  } catch (error) {
    console.error('Erro ao executar rollbacks:', error);
    throw error;
  }
};

module.exports = {
  runMigrations,
  rollbackMigrations
};

// Allow running from command line
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'up') {
    runMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'down') {
    rollbackMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Uso: node migrate.js [up|down]');
    process.exit(1);
  }
}