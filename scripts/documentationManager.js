const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class DocumentationManager {
  constructor() {
    this.categories = {
      setup: ['setup', 'install', 'config', 'firebase', 'auth', 'hosting'],
      deployment: ['deploy', 'production', 'hosting', 'build'],
      migration: ['migration', 'upgrade', 'migrate'],
      admin: ['admin', 'claims', 'role', 'user', 'permission'],
      general: []
    };
    
    this.docsDir = 'docs';
    this.fileInventory = [];
  }

  /**
   * Recursively scan for all .md files in the project
   * @param {string} dir - Directory to scan
   * @param {string[]} excludeDirs - Directories to exclude from scanning
   * @returns {Promise<string[]>} Array of markdown file paths
   */
  async scanForMarkdownFiles(dir = '.', excludeDirs = ['node_modules', '.git', 'dist', 'build', 'lib']) {
    const markdownFiles = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!excludeDirs.includes(entry.name)) {
            const subFiles = await this.scanForMarkdownFiles(fullPath, excludeDirs);
            markdownFiles.push(...subFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          markdownFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error.message);
    }
    
    return markdownFiles;
  }

  /**
   * Categorize markdown files based on their content and filename
   * @param {string} filePath - Path to the markdown file
   * @returns {Promise<string>} Category name
   */
  async categorizeFile(filePath) {
    try {
      const fileName = path.basename(filePath, '.md').toLowerCase();
      const content = await fs.readFile(filePath, 'utf8');
      const contentLower = content.toLowerCase();
      
      // Enhanced categorization with more specific rules
      
      // Admin category - more specific matching
      if (fileName.includes('admin') || fileName.includes('user') || fileName.includes('role') || 
          fileName.includes('claims') || fileName.includes('permission') ||
          contentLower.includes('administrator') || contentLower.includes('user role') ||
          contentLower.includes('custom claims') || contentLower.includes('permission')) {
        return 'admin';
      }
      
      // Migration category
      if (fileName.includes('migration') || fileName.includes('upgrade') || fileName.includes('migrate') ||
          contentLower.includes('migration') || contentLower.includes('upgrade') || 
          contentLower.includes('backup') || contentLower.includes('restore')) {
        return 'migration';
      }
      
      // Deployment category
      if (fileName.includes('deploy') || fileName.includes('production') || fileName.includes('hosting') ||
          fileName.includes('build') || contentLower.includes('deployment') || 
          contentLower.includes('production') || contentLower.includes('hosting') ||
          contentLower.includes('firebase deploy')) {
        return 'deployment';
      }
      
      // Setup category
      if (fileName.includes('setup') || fileName.includes('install') || fileName.includes('config') ||
          fileName.includes('firebase') || fileName.includes('auth') || fileName.includes('firestore') ||
          contentLower.includes('setup') || contentLower.includes('installation') ||
          contentLower.includes('configuration') || contentLower.includes('firebase')) {
        return 'setup';
      }
      
      return 'general';
    } catch (error) {
      console.error(`Error categorizing file ${filePath}:`, error.message);
      return 'general';
    }
  }

  /**
   * Generate file inventory with metadata
   * @returns {Promise<Object[]>} Array of file metadata objects
   */
  async generateFileInventory() {
    const markdownFiles = await this.scanForMarkdownFiles();
    this.fileInventory = [];
    
    for (const filePath of markdownFiles) {
      try {
        const stats = await fs.stat(filePath);
        const category = await this.categorizeFile(filePath);
        
        const fileInfo = {
          originalPath: filePath,
          fileName: path.basename(filePath),
          category: category,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        };
        
        this.fileInventory.push(fileInfo);
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
      }
    }
    
    return this.fileInventory;
  }

  /**
   * Create centralized documentation directory structure
   * @returns {Promise<void>}
   */
  async createDocumentationStructure() {
    try {
      // Create main docs directory
      await this.ensureDirectoryExists(this.docsDir);
      
      // Create category subdirectories
      for (const category of Object.keys(this.categories)) {
        const categoryDir = path.join(this.docsDir, category);
        await this.ensureDirectoryExists(categoryDir);
      }
      
      console.log(`Created documentation structure in ${this.docsDir}/`);
      
      // Create index files for each category
      await this.createCategoryIndexFiles();
      
    } catch (error) {
      console.error('Error creating documentation structure:', error.message);
      throw error;
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create index files for each documentation category
   * @returns {Promise<void>}
   */
  async createCategoryIndexFiles() {
    const categoryDescriptions = {
      setup: 'Setup and Configuration Documentation',
      deployment: 'Deployment and Production Documentation', 
      migration: 'Migration and Upgrade Documentation',
      admin: 'Administrative and User Management Documentation',
      general: 'General Project Documentation'
    };

    for (const [category, description] of Object.entries(categoryDescriptions)) {
      const indexPath = path.join(this.docsDir, category, 'README.md');
      
      // Check if index file already exists
      try {
        await fs.access(indexPath);
        console.log(`Index file already exists: ${indexPath}`);
        continue;
      } catch (error) {
        // File doesn't exist, create it
      }

      const indexContent = `# ${description}

This directory contains documentation related to ${category}.

## Files in this category:

<!-- This section will be automatically updated when files are moved -->

## Quick Links

- [Main Documentation](../README.md)
- [Setup Documentation](../setup/README.md)
- [Deployment Documentation](../deployment/README.md)
- [Migration Documentation](../migration/README.md)
- [Admin Documentation](../admin/README.md)
- [General Documentation](../general/README.md)

---
*This file was automatically generated by the Documentation Manager*
`;

      await fs.writeFile(indexPath, indexContent, 'utf8');
      console.log(`Created index file: ${indexPath}`);
    }

    // Create main docs index
    await this.createMainDocsIndex();
  }

  /**
   * Create main documentation index file
   * @returns {Promise<void>}
   */
  async createMainDocsIndex() {
    const mainIndexPath = path.join(this.docsDir, 'README.md');
    
    // Check if main index already exists
    try {
      await fs.access(mainIndexPath);
      console.log(`Main index file already exists: ${mainIndexPath}`);
      return;
    } catch (error) {
      // File doesn't exist, create it
    }

    const mainIndexContent = `# Project Documentation

This directory contains all project documentation organized by category.

## Documentation Categories

### 📋 [Setup](./setup/README.md)
Configuration, installation, and initial setup documentation.

### 🚀 [Deployment](./deployment/README.md)
Production deployment, hosting, and build documentation.

### 🔄 [Migration](./migration/README.md)
Database migrations, upgrades, and data transfer documentation.

### 👥 [Admin](./admin/README.md)
User management, permissions, and administrative documentation.

### 📚 [General](./general/README.md)
General project documentation and miscellaneous files.

## Quick Navigation

| Category | Description | Files |
|----------|-------------|-------|
| Setup | Configuration and installation | [View Files](./setup/) |
| Deployment | Production and hosting | [View Files](./deployment/) |
| Migration | Upgrades and migrations | [View Files](./migration/) |
| Admin | User and permission management | [View Files](./admin/) |
| General | Miscellaneous documentation | [View Files](./general/) |

---
*This documentation structure was automatically generated by the Documentation Manager*
`;

    await fs.writeFile(mainIndexPath, mainIndexContent, 'utf8');
    console.log(`Created main index file: ${mainIndexPath}`);
  }

  /**
   * Create backup of current state before file operations
   * @returns {Promise<string>} Backup directory path
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backup-docs-${timestamp}`;
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      
      // Copy all markdown files to backup
      for (const file of this.fileInventory) {
        const backupPath = path.join(backupDir, file.originalPath);
        const backupDirPath = path.dirname(backupPath);
        
        await fs.mkdir(backupDirPath, { recursive: true });
        await fs.copyFile(file.originalPath, backupPath);
      }
      
      console.log(`Created backup in: ${backupDir}`);
      return backupDir;
    } catch (error) {
      console.error('Error creating backup:', error.message);
      throw error;
    }
  }

  /**
   * Find all references to a file in other markdown files
   * @param {string} filePath - Path to the file to find references for
   * @returns {Promise<Object[]>} Array of reference objects
   */
  async findFileReferences(filePath) {
    const references = [];
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = path.basename(filePath, '.md');
    
    // Single comprehensive pattern to avoid duplicates
    const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(([^\\)]*(?:${fileName.replace('.', '\\.')}|${fileNameWithoutExt.replace('.', '\\.')}|${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}))\\)`, 'g');
    
    for (const file of this.fileInventory) {
      if (file.originalPath === filePath) continue;
      
      try {
        const content = await fs.readFile(file.originalPath, 'utf8');
        
        let match;
        while ((match = linkPattern.exec(content)) !== null) {
          references.push({
            referencingFile: file.originalPath,
            linkText: match[1],
            linkPath: match[2],
            fullMatch: match[0],
            position: match.index
          });
        }
      } catch (error) {
        console.error(`Error reading file ${file.originalPath}:`, error.message);
      }
    }
    
    return references;
  }

  /**
   * Update references in a file after moving target file
   * @param {string} referencingFile - File containing the references
   * @param {string} oldPath - Old path of the moved file
   * @param {string} newPath - New path of the moved file
   * @returns {Promise<void>}
   */
  async updateReferencesInFile(referencingFile, oldPath, newPath) {
    try {
      let content = await fs.readFile(referencingFile, 'utf8');
      let updated = false;
      
      // Calculate relative path from referencing file to new location
      const referencingDir = path.dirname(referencingFile);
      const relativePath = path.relative(referencingDir, newPath).replace(/\\/g, '/');
      
      // Update various link formats
      const oldFileName = path.basename(oldPath);
      const oldFileNameWithoutExt = path.basename(oldPath, '.md');
      
      const replacements = [
        // Direct file name references
        { pattern: new RegExp(`(\\[[^\\]]+\\]\\()([^\\)]*${oldFileName.replace('.', '\\.')})\\)`, 'g'), replacement: `$1${relativePath})` },
        // File name without extension
        { pattern: new RegExp(`(\\[[^\\]]+\\]\\()([^\\)]*${oldFileNameWithoutExt.replace('.', '\\.')})\\)`, 'g'), replacement: `$1${relativePath})` },
        // Full path references
        { pattern: new RegExp(`(\\[[^\\]]+\\]\\()([^\\)]*${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\)`, 'g'), replacement: `$1${relativePath})` }
      ];
      
      for (const { pattern, replacement } of replacements) {
        const newContent = content.replace(pattern, replacement);
        if (newContent !== content) {
          content = newContent;
          updated = true;
        }
      }
      
      if (updated) {
        await fs.writeFile(referencingFile, content, 'utf8');
        console.log(`Updated references in: ${referencingFile}`);
      }
    } catch (error) {
      console.error(`Error updating references in ${referencingFile}:`, error.message);
    }
  }

  /**
   * Move files to documentation structure using Git mv to preserve history
   * @param {boolean} useGitMv - Whether to use git mv command (preserves history)
   * @returns {Promise<Object[]>} Array of move operations performed
   */
  async moveFilesToDocumentation(useGitMv = true) {
    const moveOperations = [];
    
    // Only move files that are not already in the docs directory or in .kiro specs
    const filesToMove = this.fileInventory.filter(file => 
      !file.originalPath.startsWith('docs/') && 
      !file.originalPath.startsWith('docs\\') &&
      !file.originalPath.includes('.kiro') && // Don't move any .kiro files
      !file.originalPath.includes('node_modules') // Don't move node_modules files
    );
    
    console.log(`Moving ${filesToMove.length} files to documentation structure...`);
    
    for (const file of filesToMove) {
      try {
        const newPath = path.join(this.docsDir, file.category, file.fileName);
        
        // Ensure target directory exists
        await this.ensureDirectoryExists(path.dirname(newPath));
        
        // Find references before moving
        const references = await this.findFileReferences(file.originalPath);
        
        // Move the file
        if (useGitMv) {
          try {
            // Use git mv to preserve history
            execSync(`git mv "${file.originalPath}" "${newPath}"`, { stdio: 'pipe' });
            console.log(`Git moved: ${file.originalPath} -> ${newPath}`);
          } catch (gitError) {
            // Fallback to regular file move if git mv fails
            console.log(`Git mv failed, using regular move: ${gitError.message}`);
            await fs.rename(file.originalPath, newPath);
            console.log(`Moved: ${file.originalPath} -> ${newPath}`);
          }
        } else {
          await fs.rename(file.originalPath, newPath);
          console.log(`Moved: ${file.originalPath} -> ${newPath}`);
        }
        
        // Update references in other files
        for (const ref of references) {
          await this.updateReferencesInFile(ref.referencingFile, file.originalPath, newPath);
        }
        
        moveOperations.push({
          originalPath: file.originalPath,
          newPath: newPath,
          category: file.category,
          referencesUpdated: references.length
        });
        
      } catch (error) {
        console.error(`Error moving file ${file.originalPath}:`, error.message);
      }
    }
    
    return moveOperations;
  }

  /**
   * Update category index files with moved files
   * @param {Object[]} moveOperations - Array of move operations
   * @returns {Promise<void>}
   */
  async updateCategoryIndexes(moveOperations) {
    const categorizedMoves = moveOperations.reduce((acc, move) => {
      if (!acc[move.category]) acc[move.category] = [];
      acc[move.category].push(move);
      return acc;
    }, {});
    
    for (const [category, moves] of Object.entries(categorizedMoves)) {
      const indexPath = path.join(this.docsDir, category, 'README.md');
      
      try {
        let content = await fs.readFile(indexPath, 'utf8');
        
        // Find the files section
        const filesSection = '## Files in this category:';
        const filesSectionIndex = content.indexOf(filesSection);
        
        if (filesSectionIndex !== -1) {
          // Build file list
          const fileList = moves.map(move => {
            const fileName = path.basename(move.newPath);
            const relativePath = `./${fileName}`;
            return `- [${fileName}](${relativePath})`;
          }).join('\n');
          
          // Replace the files section
          const beforeSection = content.substring(0, filesSectionIndex + filesSection.length);
          const afterSectionIndex = content.indexOf('\n## ', filesSectionIndex + filesSection.length);
          const afterSection = afterSectionIndex !== -1 ? content.substring(afterSectionIndex) : content.substring(content.indexOf('\n---', filesSectionIndex));
          
          content = beforeSection + '\n\n' + fileList + '\n' + afterSection;
          
          await fs.writeFile(indexPath, content, 'utf8');
          console.log(`Updated index file: ${indexPath}`);
        }
      } catch (error) {
        console.error(`Error updating index file ${indexPath}:`, error.message);
      }
    }
  }

  /**
   * Print file inventory summary
   */
  printInventorySummary() {
    if (this.fileInventory.length === 0) {
      console.log('No markdown files found.');
      return;
    }
    
    console.log('\n=== Markdown File Inventory ===');
    console.log(`Total files found: ${this.fileInventory.length}\n`);
    
    // Group by category
    const categorized = this.fileInventory.reduce((acc, file) => {
      if (!acc[file.category]) acc[file.category] = [];
      acc[file.category].push(file);
      return acc;
    }, {});
    
    for (const [category, files] of Object.entries(categorized)) {
      console.log(`${category.toUpperCase()} (${files.length} files):`);
      files.forEach(file => {
        console.log(`  - ${file.originalPath} (${(file.size / 1024).toFixed(1)}KB)`);
      });
      console.log('');
    }
  }
}

module.exports = DocumentationManager;

// If run directly, execute the scanner
if (require.main === module) {
  async function main() {
    const manager = new DocumentationManager();
    
    console.log('Scanning for markdown files...');
    await manager.generateFileInventory();
    manager.printInventorySummary();
    
    console.log('\nCreating documentation structure...');
    await manager.createDocumentationStructure();
    
    // Ask user if they want to proceed with moving files
    console.log('\nReady to move files to documentation structure.');
    console.log('This will:');
    console.log('- Create a backup of current state');
    console.log('- Move markdown files to organized directories');
    console.log('- Update internal references');
    console.log('- Use git mv to preserve file history');
    
    // For automated execution, we'll skip the interactive prompt
    // In a real scenario, you might want to add readline for user input
    
    console.log('\nCreating backup...');
    const backupDir = await manager.createBackup();
    
    console.log('\nMoving files...');
    const moveOperations = await manager.moveFilesToDocumentation();
    
    console.log('\nUpdating category indexes...');
    await manager.updateCategoryIndexes(moveOperations);
    
    console.log('\n=== Documentation Organization Complete ===');
    console.log(`Files moved: ${moveOperations.length}`);
    console.log(`Backup created: ${backupDir}`);
    console.log('All internal references have been updated.');
  }
  
  main().catch(console.error);
}