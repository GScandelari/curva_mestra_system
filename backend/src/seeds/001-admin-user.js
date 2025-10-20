const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        username: 'admin',
        email: 'admin@clinica.com',
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('Usuário administrador criado:');
    console.log('Email: admin@clinica.com');
    console.log('Senha: admin123');
    console.log('IMPORTANTE: Altere a senha após o primeiro login!');
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', {
      username: 'admin'
    });
  }
};