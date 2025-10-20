const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    // First, get the admin user ID
    const [adminUser] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!adminUser) {
      throw new Error('Admin user not found. Please run admin user seed first.');
    }

    const sampleInvoice = {
      id: uuidv4(),
      number: 'NF-001-2024',
      supplier: 'Fornecedor Exemplo Ltda',
      issue_date: '2024-01-15',
      receipt_date: '2024-01-16',
      total_value: 1500.00,
      user_id: adminUser.id,
      created_at: new Date(),
      updated_at: new Date()
    };

    await queryInterface.bulkInsert('invoices', [sampleInvoice]);

    // Sample products with different categories
    const sampleProducts = [
      {
        id: uuidv4(),
        name: 'Ácido Hialurônico 1ml',
        description: 'Preenchedor facial de ácido hialurônico',
        category: 'Preenchedores',
        unit: 'seringa',
        minimum_stock: 5,
        current_stock: 10,
        expiration_date: '2025-12-31',
        invoice_number: 'NF-001-2024',
        entry_date: '2024-01-16',
        entry_user_id: adminUser.id,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Toxina Botulínica 100U',
        description: 'Toxina botulínica tipo A para procedimentos estéticos',
        category: 'Toxinas',
        unit: 'frasco',
        minimum_stock: 3,
        current_stock: 8,
        expiration_date: '2025-06-30',
        invoice_number: 'NF-001-2024',
        entry_date: '2024-01-16',
        entry_user_id: adminUser.id,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Agulha 30G',
        description: 'Agulha descartável para aplicações',
        category: 'Materiais',
        unit: 'unidade',
        minimum_stock: 50,
        current_stock: 100,
        expiration_date: '2026-12-31',
        invoice_number: 'NF-001-2024',
        entry_date: '2024-01-16',
        entry_user_id: adminUser.id,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Seringa 1ml',
        description: 'Seringa descartável estéril',
        category: 'Materiais',
        unit: 'unidade',
        minimum_stock: 30,
        current_stock: 75,
        expiration_date: '2026-12-31',
        invoice_number: 'NF-001-2024',
        entry_date: '2024-01-16',
        entry_user_id: adminUser.id,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Anestésico Tópico',
        description: 'Creme anestésico para procedimentos',
        category: 'Anestésicos',
        unit: 'tubo',
        minimum_stock: 2,
        current_stock: 5,
        expiration_date: '2025-03-31',
        invoice_number: 'NF-001-2024',
        entry_date: '2024-01-16',
        entry_user_id: adminUser.id,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('products', sampleProducts);

    console.log('Dados de exemplo criados:');
    console.log('- 1 nota fiscal de exemplo');
    console.log('- 5 produtos de exemplo em diferentes categorias');
    console.log('- Categorias: Preenchedores, Toxinas, Materiais, Anestésicos');
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('products', {
      invoice_number: 'NF-001-2024'
    });
    
    await queryInterface.bulkDelete('invoices', {
      number: 'NF-001-2024'
    });
  }
};