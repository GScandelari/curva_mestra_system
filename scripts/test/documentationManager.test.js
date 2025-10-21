const fs = require('fs').promises;
const path = require('path');
const DocumentationManager = require('../documentationManager');

// Mock child_process to avoid actual git operations during tests
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('DocumentationManager', () => {
  let manager;
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    manager = new DocumentationManager();
    originalCwd = process.cwd();
    
    // Create a temporary test directory
    testDir = path.join(__dirname, 'temp-test-docs');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Override docs directory for testing
    manager.docsDir = 'test-docs';
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('scanForMarkdownFiles', () => {
    beforeEach(async () => {
      // Create test markdown files
      await fs.writeFile('test1.md', '# Test 1');
      await fs.writeFile('test2.md', '# Test 2');
      await fs.mkdir('subdir', { recursive: true });
      await fs.writeFile('subdir/test3.md', '# Test 3');
      await fs.mkdir('node_modules', { recursive: true });
      await fs.writeFile('node_modules/ignored.md', '# Should be ignored');
    });

    test('should find all markdown files recursively', async () => {
      const files = await manager.scanForMarkdownFiles();
      
      expect(files).toHaveLength(3);
      expect(files).toContain('test1.md');
      expect(files).toContain('test2.md');
      expect(files).toContain(path.join('subdir', 'test3.md'));
      expect(files).not.toContain(path.join('node_modules', 'ignored.md'));
    });

    test('should exclude specified directories', async () => {
      const files = await manager.scanForMarkdownFiles('.', ['subdir', 'node_modules']);
      
      expect(files).toHaveLength(2);
      expect(files).toContain('test1.md');
      expect(files).toContain('test2.md');
      expect(files).not.toContain(path.join('subdir', 'test3.md'));
      expect(files).not.toContain(path.join('node_modules', 'ignored.md'));
    });
  });

  describe('categorizeFile', () => {
    test('should categorize admin files correctly', async () => {
      await fs.writeFile('admin-guide.md', '# Admin Guide\nThis covers user roles and permissions.');
      
      const category = await manager.categorizeFile('admin-guide.md');
      expect(category).toBe('admin');
    });

    test('should categorize setup files correctly', async () => {
      await fs.writeFile('firebase-setup.md', '# Firebase Setup\nConfiguration instructions.');
      
      const category = await manager.categorizeFile('firebase-setup.md');
      expect(category).toBe('setup');
    });

    test('should categorize deployment files correctly', async () => {
      await fs.writeFile('deploy-guide.md', '# Deployment\nProduction deployment instructions.');
      
      const category = await manager.categorizeFile('deploy-guide.md');
      expect(category).toBe('deployment');
    });

    test('should categorize migration files correctly', async () => {
      await fs.writeFile('migration-guide.md', '# Migration\nDatabase migration procedures.');
      
      const category = await manager.categorizeFile('migration-guide.md');
      expect(category).toBe('migration');
    });

    test('should default to general category', async () => {
      await fs.writeFile('random-doc.md', '# Random Document\nSome random content.');
      
      const category = await manager.categorizeFile('random-doc.md');
      expect(category).toBe('general');
    });
  });

  describe('generateFileInventory', () => {
    beforeEach(async () => {
      await fs.writeFile('admin-guide.md', '# Admin Guide');
      await fs.writeFile('setup-guide.md', '# Setup Guide\nFirebase configuration.');
    });

    test('should generate complete file inventory with metadata', async () => {
      const inventory = await manager.generateFileInventory();
      
      expect(inventory).toHaveLength(2);
      
      const adminFile = inventory.find(f => f.fileName === 'admin-guide.md');
      expect(adminFile).toBeDefined();
      expect(adminFile.category).toBe('admin');
      expect(adminFile.originalPath).toBe('admin-guide.md');
      expect(adminFile.size).toBeGreaterThan(0);
      expect(adminFile.modified).toBeDefined();
      
      const setupFile = inventory.find(f => f.fileName === 'setup-guide.md');
      expect(setupFile).toBeDefined();
      expect(setupFile.category).toBe('setup');
    });
  });

  describe('createDocumentationStructure', () => {
    test('should create documentation directory structure', async () => {
      await manager.createDocumentationStructure();
      
      // Check main docs directory exists
      const docsExists = await fs.access(manager.docsDir).then(() => true).catch(() => false);
      expect(docsExists).toBe(true);
      
      // Check category directories exist
      for (const category of Object.keys(manager.categories)) {
        const categoryDir = path.join(manager.docsDir, category);
        const categoryExists = await fs.access(categoryDir).then(() => true).catch(() => false);
        expect(categoryExists).toBe(true);
      }
    });

    test('should create index files for each category', async () => {
      await manager.createDocumentationStructure();
      
      // Check main index exists
      const mainIndexExists = await fs.access(path.join(manager.docsDir, 'README.md')).then(() => true).catch(() => false);
      expect(mainIndexExists).toBe(true);
      
      // Check category indexes exist
      for (const category of Object.keys(manager.categories)) {
        const indexPath = path.join(manager.docsDir, category, 'README.md');
        const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
        expect(indexExists).toBe(true);
      }
    });

    test('should not overwrite existing index files', async () => {
      // Create docs structure first
      await manager.createDocumentationStructure();
      
      // Modify an index file
      const adminIndexPath = path.join(manager.docsDir, 'admin', 'README.md');
      const originalContent = await fs.readFile(adminIndexPath, 'utf8');
      const modifiedContent = originalContent + '\n<!-- Modified -->';
      await fs.writeFile(adminIndexPath, modifiedContent, 'utf8');
      
      // Run create again
      await manager.createDocumentationStructure();
      
      // Check content wasn't overwritten
      const finalContent = await fs.readFile(adminIndexPath, 'utf8');
      expect(finalContent).toContain('<!-- Modified -->');
    });
  });

  describe('findFileReferences', () => {
    beforeEach(async () => {
      await fs.writeFile('target.md', '# Target File');
      await fs.writeFile('referencing1.md', '# Referencing File 1\n[Link to target](target.md)');
      await fs.writeFile('referencing2.md', '# Referencing File 2\n[Another link](./target.md)');
      await fs.writeFile('no-refs.md', '# No References\nJust some content.');
      
      // Generate inventory for reference finding
      await manager.generateFileInventory();
    });

    test('should find all references to a file', async () => {
      const references = await manager.findFileReferences('target.md');
      
      expect(references.length).toBeGreaterThanOrEqual(2);
      
      const ref1 = references.find(r => r.referencingFile === 'referencing1.md' && r.linkPath === 'target.md');
      expect(ref1).toBeDefined();
      expect(ref1.linkText).toBe('Link to target');
      
      const ref2 = references.find(r => r.referencingFile === 'referencing2.md' && r.linkPath === './target.md');
      expect(ref2).toBeDefined();
      expect(ref2.linkText).toBe('Another link');
    });

    test('should return empty array when no references found', async () => {
      const references = await manager.findFileReferences('no-refs.md');
      expect(references).toHaveLength(0);
    });
  });

  describe('createBackup', () => {
    beforeEach(async () => {
      await fs.writeFile('test1.md', '# Test 1');
      await fs.writeFile('test2.md', '# Test 2');
      await manager.generateFileInventory();
    });

    test('should create backup of all markdown files', async () => {
      const backupDir = await manager.createBackup();
      
      expect(backupDir).toMatch(/^backup-docs-/);
      
      // Check backup directory exists
      const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
      
      // Check files were backed up
      const backup1Exists = await fs.access(path.join(backupDir, 'test1.md')).then(() => true).catch(() => false);
      const backup2Exists = await fs.access(path.join(backupDir, 'test2.md')).then(() => true).catch(() => false);
      
      expect(backup1Exists).toBe(true);
      expect(backup2Exists).toBe(true);
    });
  });

  describe('updateReferencesInFile', () => {
    test('should update file references correctly', async () => {
      const content = '# Test\n[Link to old file](old-path.md)\n[Another link](./old-path.md)';
      await fs.writeFile('referencing.md', content);
      
      await manager.updateReferencesInFile('referencing.md', 'old-path.md', 'docs/admin/new-path.md');
      
      const updatedContent = await fs.readFile('referencing.md', 'utf8');
      expect(updatedContent).toContain('docs/admin/new-path.md');
      expect(updatedContent).not.toContain('old-path.md');
    });
  });

  describe('integration tests', () => {
    test('should complete full documentation organization workflow', async () => {
      // Create test files
      await fs.writeFile('admin-guide.md', '# Admin Guide\nUser management instructions.');
      await fs.writeFile('setup-guide.md', '# Setup Guide\nFirebase setup instructions.');
      await fs.writeFile('referencing.md', '# References\n[Admin Guide](admin-guide.md)\n[Setup](setup-guide.md)');
      
      // Run full workflow
      await manager.generateFileInventory();
      await manager.createDocumentationStructure();
      
      const backupDir = await manager.createBackup();
      expect(backupDir).toBeDefined();
      
      const moveOperations = await manager.moveFilesToDocumentation(false); // Don't use git mv in tests
      expect(moveOperations.length).toBeGreaterThan(0);
      
      await manager.updateCategoryIndexes(moveOperations);
      
      // Verify files were moved
      const adminFileExists = await fs.access(path.join(manager.docsDir, 'admin', 'admin-guide.md')).then(() => true).catch(() => false);
      const setupFileExists = await fs.access(path.join(manager.docsDir, 'setup', 'setup-guide.md')).then(() => true).catch(() => false);
      
      expect(adminFileExists).toBe(true);
      expect(setupFileExists).toBe(true);
      
      // Verify indexes were updated
      const adminIndex = await fs.readFile(path.join(manager.docsDir, 'admin', 'README.md'), 'utf8');
      expect(adminIndex).toContain('admin-guide.md');
    });
  });
});