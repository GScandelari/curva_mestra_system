const fs = require('fs').promises;
const path = require('path');
const sequelize = require('../config/database');

const runSeeds = async () => {
  try {
    console.log('Iniciando seeds...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('Conexão com a base de dados estabelecida.');

    // Get seed files
    const seedsDir = path.join(__dirname, '../seeds');
    const files = await fs.readdir(seedsDir);
    const seedFiles = files
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log(`Encontrados ${seedFiles.length} seeds.`);

    // Run seeds in order
    for (const file of seedFiles) {
      console.log(`Executando seed: ${file}`);
      const seed = require(path.join(seedsDir, file));
      
      if (seed.up) {
        await seed.up(sequelize.getQueryInterface());
        console.log(`✓ Seed ${file} executado com sucesso.`);
      }
    }

    console.log('Todos os seeds foram executados com sucesso!');
  } catch (error) {
    console.error('Erro ao executar seeds:', error);
    throw error;
  }
};

const rollbackSeeds = async () => {
  try {
    console.log('Iniciando rollback dos seeds...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('Conexão com a base de dados estabelecida.');

    // Get seed files in reverse order
    const seedsDir = path.join(__dirname, '../seeds');
    const files = await fs.readdir(seedsDir);
    const seedFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()
      .reverse();

    console.log(`Encontrados ${seedFiles.length} seeds para rollback.`);

    // Run rollbacks in reverse order
    for (const file of seedFiles) {
      console.log(`Executando rollback: ${file}`);
      const seed = require(path.join(seedsDir, file));
      
      if (seed.down) {
        await seed.down(sequelize.getQueryInterface());
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
  runSeeds,
  rollbackSeeds
};

// Allow running from command line
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'up') {
    runSeeds()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'down') {
    rollbackSeeds()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Uso: node seed.js [up|down]');
    process.exit(1);
  }
}