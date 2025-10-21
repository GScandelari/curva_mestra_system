const DocumentationManager = require('./documentationManager');

async function testSmallMove() {
  const manager = new DocumentationManager();
  
  console.log('Testing small file move...');
  
  // Scan files
  await manager.generateFileInventory();
  
  // Filter to only a few test files
  const testFiles = ['COMO_VIRAR_ADMIN.md', 'FIREBASE_SETUP.md'];
  manager.fileInventory = manager.fileInventory.filter(file => 
    testFiles.includes(path.basename(file.originalPath))
  );
  
  console.log('Test files to move:');
  manager.fileInventory.forEach(file => {
    console.log(`${file.originalPath} -> docs/${file.category}/${file.fileName}`);
  });
  
  // Create backup
  console.log('\nCreating backup...');
  const backupDir = await manager.createBackup();
  
  // Move files
  console.log('\nMoving files...');
  const moveOperations = await manager.moveFilesToDocumentation();
  
  console.log('\nMove operations completed:');
  moveOperations.forEach(op => {
    console.log(`✓ ${op.originalPath} -> ${op.newPath} (${op.referencesUpdated} refs updated)`);
  });
  
  // Update indexes
  console.log('\nUpdating category indexes...');
  await manager.updateCategoryIndexes(moveOperations);
  
  console.log('\nTest complete!');
}

const path = require('path');
testSmallMove().catch(console.error);