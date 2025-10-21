const DocumentationManager = require('./documentationManager');

async function testMove() {
  const manager = new DocumentationManager();
  
  console.log('Testing documentation organization...');
  
  // Scan files
  await manager.generateFileInventory();
  
  // Show what would be moved (excluding .kiro specs)
  const filesToMove = manager.fileInventory.filter(file => 
    !file.originalPath.startsWith('docs/') && 
    !file.originalPath.startsWith('docs\\') &&
    !file.originalPath.includes('.kiro') &&
    !file.originalPath.includes('node_modules')
  );
  
  console.log('\nFiles that would be moved:');
  filesToMove.forEach(file => {
    const newPath = `docs/${file.category}/${file.fileName}`;
    console.log(`${file.originalPath} -> ${newPath}`);
  });
  
  console.log(`\nTotal files to move: ${filesToMove.length}`);
  
  // Test reference finding for one file
  if (filesToMove.length > 0) {
    const testFile = filesToMove[0];
    console.log(`\nTesting reference finding for: ${testFile.originalPath}`);
    const refs = await manager.findFileReferences(testFile.originalPath);
    console.log(`Found ${refs.length} references:`);
    refs.forEach(ref => {
      console.log(`  - In ${ref.referencingFile}: "${ref.fullMatch}"`);
    });
  }
}

testMove().catch(console.error);