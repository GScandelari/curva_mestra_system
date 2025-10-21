const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { 
  GitOperations, 
  FirebaseDeployment, 
  DeploymentRollback, 
  DeploymentPipeline 
} = require('../deployPipeline');

// Mock child_process for testing
jest.mock('child_process');

describe('GitOperations', () => {
  let gitOps;
  let mockExecSync;

  beforeEach(() => {
    mockExecSync = require('child_process').execSync;
    mockExecSync.mockClear();
    gitOps = new GitOperations({ verbose: false });
  });

  describe('executeGitCommand', () => {
    test('should execute git command successfully', () => {
      mockExecSync.mockReturnValue('command output');
      
      const result = gitOps.executeGitCommand('status');
      
      expect(mockExecSync).toHaveBeenCalledWith('git status', expect.any(Object));
      expect(result).toBe('command output');
    });

    test('should throw error on command failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      expect(() => gitOps.executeGitCommand('invalid')).toThrow('Git command failed');
    });
  });

  describe('isWorkingDirectoryClean', () => {
    test('should return true for clean directory', () => {
      mockExecSync.mockReturnValue('');
      
      const result = gitOps.isWorkingDirectoryClean();
      
      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git status --porcelain', expect.any(Object));
    });

    test('should return false for dirty directory', () => {
      mockExecSync.mockReturnValue('M file.txt\n?? newfile.txt');
      
      const result = gitOps.isWorkingDirectoryClean();
      
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    test('should return current branch name', () => {
      mockExecSync.mockReturnValue('main');
      
      const result = gitOps.getCurrentBranch();
      
      expect(result).toBe('main');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', expect.any(Object));
    });
  });

  describe('stageAllChanges', () => {
    test('should stage all changes', () => {
      mockExecSync.mockReturnValue('');
      
      gitOps.stageAllChanges();
      
      expect(mockExecSync).toHaveBeenCalledWith('git add .', expect.any(Object));
    });
  });

  describe('stageFiles', () => {
    test('should stage specific files', () => {
      mockExecSync.mockReturnValue('');
      
      gitOps.stageFiles(['file1.txt', 'file2.txt']);
      
      expect(mockExecSync).toHaveBeenCalledWith('git add "file1.txt" "file2.txt"', expect.any(Object));
    });

    test('should throw error for empty files array', () => {
      expect(() => gitOps.stageFiles([])).toThrow('Files array is required');
    });
  });

  describe('createCommit', () => {
    test('should create commit with message', () => {
      mockExecSync
        .mockReturnValueOnce('') // commit command
        .mockReturnValueOnce('abc123def456'); // rev-parse HEAD
      
      const result = gitOps.createCommit('Test commit');
      
      expect(mockExecSync).toHaveBeenCalledWith('git commit -m "Test commit"', expect.any(Object));
      expect(result).toBe('abc123def456');
    });

    test('should throw error for empty message', () => {
      expect(() => gitOps.createCommit('')).toThrow('Commit message is required');
    });
  });

  describe('generateCommitMessage', () => {
    test('should generate proper commit message for admin changes', () => {
      const message = gitOps.generateCommitMessage('admin', 'Update user roles');
      
      expect(message).toBe('admin: Update user roles');
    });

    test('should include file list in commit message', () => {
      const files = ['file1.txt', 'file2.txt'];
      const message = gitOps.generateCommitMessage('feature', 'Add new feature', files);
      
      expect(message).toContain('feat: Add new feature');
      expect(message).toContain('Affected files: file1.txt, file2.txt');
    });

    test('should truncate long file lists', () => {
      const files = ['file1.txt', 'file2.txt', 'file3.txt', 'file4.txt', 'file5.txt'];
      const message = gitOps.generateCommitMessage('fix', 'Bug fix', files);
      
      expect(message).toContain('file1.txt, file2.txt, file3.txt and 2 more');
    });
  });

  describe('validateWorkingDirectory', () => {
    test('should validate clean working directory', () => {
      mockExecSync
        .mockReturnValueOnce('/path/to/.git') // rev-parse --git-dir
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // status --porcelain
        .mockReturnValueOnce(''); // diff --cached --name-only
      
      const result = gitOps.validateWorkingDirectory(true);
      
      expect(result.isValid).toBe(true);
      expect(result.branch).toBe('main');
      expect(result.isClean).toBe(true);
    });

    test('should detect dirty working directory', () => {
      mockExecSync
        .mockReturnValueOnce('/path/to/.git')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('M file.txt')
        .mockReturnValueOnce('');
      
      const result = gitOps.validateWorkingDirectory(true);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Working directory has uncommitted changes');
    });

    test('should handle non-git directory', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      
      const result = gitOps.validateWorkingDirectory();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Not in a Git repository');
    });
  });

  describe('autoCommit', () => {
    test('should perform auto-commit successfully', () => {
      mockExecSync
        .mockReturnValueOnce('/path/to/.git') // validation
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // status --porcelain (clean)
        .mockReturnValueOnce('') // diff --cached --name-only (no staged)
        .mockReturnValueOnce('') // add .
        .mockReturnValueOnce('file1.txt\nfile2.txt') // diff --cached --name-only (after staging)
        .mockReturnValueOnce('') // commit
        .mockReturnValueOnce('abc123def456'); // rev-parse HEAD
      
      const result = gitOps.autoCommit({
        changeType: 'feature',
        description: 'Add new feature'
      });
      
      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc123def456');
      expect(result.stagedFiles).toEqual(['file1.txt', 'file2.txt']);
    });

    test('should handle no changes to commit', () => {
      mockExecSync
        .mockReturnValueOnce('/path/to/.git')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce(''); // No staged changes after add
      
      const result = gitOps.autoCommit();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('No changes to commit');
    });
  });

  describe('revertToCommit', () => {
    test('should revert to specific commit', () => {
      mockExecSync.mockReturnValue('');
      
      gitOps.revertToCommit('abc123def456', false);
      
      expect(mockExecSync).toHaveBeenCalledWith('git reset --soft abc123def456', expect.any(Object));
    });

    test('should perform hard reset when requested', () => {
      mockExecSync.mockReturnValue('');
      
      gitOps.revertToCommit('abc123def456', true);
      
      expect(mockExecSync).toHaveBeenCalledWith('git reset --hard abc123def456', expect.any(Object));
    });
  });
});

describe('FirebaseDeployment', () => {
  let firebaseDeployment;
  let mockExecSync;
  let mockFs;

  beforeEach(() => {
    mockExecSync = require('child_process').execSync;
    mockExecSync.mockClear();
    
    // Mock fs
    mockFs = {
      existsSync: jest.fn(),
      readFileSync: jest.fn(),
      appendFileSync: jest.fn(),
      mkdirSync: jest.fn()
    };
    
    Object.assign(fs, mockFs);
    
    firebaseDeployment = new FirebaseDeployment({ 
      projectId: 'test-project',
      verbose: false 
    });
  });

  describe('executeFirebaseCommand', () => {
    test('should execute firebase command successfully', () => {
      mockExecSync.mockReturnValue('command output');
      
      const result = firebaseDeployment.executeFirebaseCommand('projects:list');
      
      expect(mockExecSync).toHaveBeenCalledWith(
        'firebase projects:list --project=test-project',
        expect.any(Object)
      );
      expect(result).toBe('command output');
    });
  });

  describe('validateEnvironment', () => {
    test('should validate complete environment', () => {
      mockExecSync
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockReturnValueOnce('project list') // projects:list
        .mockReturnValueOnce('test-project'); // use --current
      
      mockFs.existsSync
        .mockReturnValueOnce(true) // firebase.json
        .mockReturnValueOnce(true) // frontend/dist
        .mockReturnValueOnce(true); // functions
      
      const result = firebaseDeployment.validateEnvironment();
      
      expect(result.isValid).toBe(true);
      expect(result.checks.firebaseCli).toBe(true);
      expect(result.checks.firebaseAuth).toBe(true);
      expect(result.checks.projectAccess).toBe(true);
    });

    test('should detect missing Firebase CLI', () => {
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase --version')) {
          throw new Error('Command not found');
        }
        return 'output';
      });
      
      const result = firebaseDeployment.validateEnvironment();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Firebase CLI is not installed');
    });

    test('should detect authentication issues', () => {
      mockExecSync
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockImplementation((command) => {
          if (command.includes('projects:list')) {
            throw new Error('Not authenticated');
          }
          return 'output';
        });
      
      const result = firebaseDeployment.validateEnvironment();
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Not authenticated with Firebase CLI');
    });
  });

  describe('buildFrontend', () => {
    test('should build frontend successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('Build completed');
      
      firebaseDeployment.buildFrontend();
      
      expect(mockExecSync).toHaveBeenCalledWith('npm run build', expect.objectContaining({
        cwd: expect.stringContaining('frontend')
      }));
    });

    test('should throw error if package.json missing', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      expect(() => firebaseDeployment.buildFrontend()).toThrow('Frontend package.json not found');
    });
  });

  describe('deployTarget', () => {
    test('should deploy hosting target successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync
        .mockReturnValueOnce('Build completed') // npm run build
        .mockReturnValueOnce('Deploy completed successfully'); // firebase deploy
      
      const result = firebaseDeployment.deployTarget('hosting');
      
      expect(result.success).toBe(true);
      expect(result.target).toBe('hosting');
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle deployment failure', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync
        .mockReturnValueOnce('Build completed')
        .mockImplementation((command) => {
          if (command.includes('firebase deploy')) {
            throw new Error('Deployment failed');
          }
          return 'output';
        });
      
      const result = firebaseDeployment.deployTarget('hosting');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment failed');
    });
  });

  describe('deployAll', () => {
    test('should deploy all targets successfully', () => {
      firebaseDeployment.deploymentTargets = ['hosting', 'functions'];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{"scripts":{"build":"tsc"}}');
      
      mockExecSync
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockReturnValueOnce('project list') // projects:list
        .mockReturnValueOnce('test-project') // use --current
        .mockReturnValueOnce('Build completed') // frontend build
        .mockReturnValueOnce('Deploy completed') // hosting deploy
        .mockReturnValueOnce('npm install completed') // functions npm install
        .mockReturnValueOnce('Build completed') // functions build
        .mockReturnValueOnce('Deploy completed'); // functions deploy
      
      const result = firebaseDeployment.deployAll();
      
      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(2);
      expect(result.deployments[0].target).toBe('hosting');
      expect(result.deployments[1].target).toBe('functions');
    });
  });
});

describe('DeploymentRollback', () => {
  let rollback;
  let mockGitOps;
  let mockFirebaseDeployment;

  beforeEach(() => {
    mockGitOps = {
      getLastCommitHash: jest.fn().mockReturnValue('abc123def456'),
      getCurrentBranch: jest.fn().mockReturnValue('main'),
      isWorkingDirectoryClean: jest.fn().mockReturnValue(true),
      executeGitCommand: jest.fn(),
      revertToCommit: jest.fn()
    };

    mockFirebaseDeployment = {
      projectId: 'test-project',
      getDeploymentStatus: jest.fn().mockReturnValue({ success: true }),
      executeFirebaseCommand: jest.fn()
    };

    rollback = new DeploymentRollback({
      gitOps: mockGitOps,
      firebaseDeployment: mockFirebaseDeployment,
      verbose: false
    });
  });

  describe('createDeploymentCheckpoint', () => {
    test('should create deployment checkpoint', () => {
      const checkpoint = rollback.createDeploymentCheckpoint();
      
      expect(checkpoint).toHaveProperty('timestamp');
      expect(checkpoint).toHaveProperty('gitCommit', 'abc123def456');
      expect(checkpoint).toHaveProperty('gitBranch', 'main');
      expect(checkpoint).toHaveProperty('workingDirectoryClean', true);
      expect(checkpoint).toHaveProperty('firebaseStatus');
    });
  });

  describe('rollbackGitChanges', () => {
    test('should rollback git changes successfully', () => {
      mockGitOps.executeGitCommand.mockReturnValue(''); // cat-file -e
      
      const result = rollback.rollbackGitChanges('abc123def456', false);
      
      expect(result.success).toBe(true);
      expect(result.commitHash).toBe('abc123def456');
      expect(result.resetType).toBe('soft');
      expect(mockGitOps.revertToCommit).toHaveBeenCalledWith('abc123def456', false);
    });

    test('should handle invalid commit hash', () => {
      mockGitOps.executeGitCommand.mockImplementation(() => {
        throw new Error('Invalid commit');
      });
      
      const result = rollback.rollbackGitChanges('invalid', false);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid commit hash');
    });
  });

  describe('rollbackFirebaseDeployment', () => {
    test('should rollback hosting deployment', () => {
      mockFirebaseDeployment.executeFirebaseCommand
        .mockReturnValueOnce('release1 FINALIZED\nrelease2 FINALIZED\nrelease3 FINALIZED')
        .mockReturnValueOnce('Rollback completed');
      
      const result = rollback.rollbackFirebaseDeployment('hosting');
      
      expect(result.success).toBe(true);
      expect(result.target).toBe('hosting');
    });

    test('should handle functions rollback limitation', () => {
      const result = rollback.rollbackFirebaseDeployment('functions');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Functions rollback requires redeploying');
    });
  });

  describe('performAutomaticRollback', () => {
    test('should perform complete automatic rollback', async () => {
      const deploymentResult = {
        success: false,
        deployments: [
          { success: false, target: 'hosting' }
        ]
      };
      
      const checkpoint = {
        gitCommit: 'old123commit',
        gitBranch: 'main'
      };

      mockGitOps.getLastCommitHash.mockReturnValue('new456commit');
      mockFirebaseDeployment.executeFirebaseCommand
        .mockReturnValueOnce('release1 FINALIZED\nrelease2 FINALIZED')
        .mockReturnValueOnce('Rollback completed');
      
      const result = await rollback.performAutomaticRollback(deploymentResult, checkpoint);
      
      expect(result.triggered).toBe(true);
      expect(result.actions).toHaveLength(2); // Git + Firebase rollback
      expect(result.actions[0].type).toBe('git_rollback');
      expect(result.actions[1].type).toBe('firebase_rollback');
    });
  });

  describe('validateRollbackCapability', () => {
    test('should validate rollback capabilities', () => {
      mockGitOps.executeGitCommand.mockReturnValue('commit1\ncommit2\ncommit3');
      mockFirebaseDeployment.executeFirebaseCommand.mockReturnValue('release1 FINALIZED\nrelease2 FINALIZED');
      
      const result = rollback.validateRollbackCapability();
      
      expect(result.canRollback).toBe(true);
      expect(result.capabilities.git.available).toBe(true);
      expect(result.capabilities.firebase.hosting).toBe(true);
    });
  });
});

describe('DeploymentPipeline Integration', () => {
  let pipeline;
  let mockExecSync;

  beforeEach(() => {
    mockExecSync = require('child_process').execSync;
    mockExecSync.mockClear();
    
    pipeline = new DeploymentPipeline({
      projectId: 'test-project',
      verbose: false,
      autoRollback: true
    });
  });

  describe('executeDeployment', () => {
    test('should execute complete deployment pipeline', async () => {
      // Mock successful deployment
      mockExecSync
        .mockReturnValueOnce('/path/to/.git') // Git validation
        .mockReturnValueOnce('main') // getCurrentBranch
        .mockReturnValueOnce('') // status --porcelain
        .mockReturnValueOnce('abc123def456') // getLastCommitHash (checkpoint)
        .mockReturnValueOnce('') // diff --cached --name-only
        .mockReturnValueOnce('{"success": true}') // getDeploymentStatus
        .mockReturnValueOnce('') // add .
        .mockReturnValueOnce('file1.txt') // diff --cached --name-only (staged)
        .mockReturnValueOnce('') // commit
        .mockReturnValueOnce('def456ghi789') // rev-parse HEAD (new commit)
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockReturnValueOnce('project list') // projects:list
        .mockReturnValueOnce('test-project') // use --current
        .mockReturnValueOnce('Deploy completed'); // firebase deploy
      
      // Mock fs for Firebase validation
      fs.existsSync = jest.fn().mockReturnValue(true);
      
      const result = await pipeline.executeDeployment({
        commitMessage: 'Test deployment',
        changeType: 'deploy'
      });
      
      expect(result.success).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.gitCommit).toBeDefined();
      expect(result.deployment).toBeDefined();
    });

    test('should handle deployment failure with rollback', async () => {
      // Mock failed deployment
      mockExecSync
        .mockReturnValueOnce('/path/to/.git')
        .mockReturnValueOnce('main')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc123def456')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('{"success": true}')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('file1.txt')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('def456ghi789')
        .mockReturnValueOnce('9.0.0')
        .mockReturnValueOnce('project list')
        .mockReturnValueOnce('test-project')
        .mockImplementation((command) => {
          if (command.includes('firebase deploy')) {
            throw new Error('Deployment failed');
          }
          return 'output';
        });
      
      fs.existsSync = jest.fn().mockReturnValue(true);
      
      const result = await pipeline.executeDeployment({
        commitMessage: 'Test deployment'
      });
      
      expect(result.success).toBe(false);
      expect(result.deployment.success).toBe(false);
      expect(result.rollback).toBeDefined();
    });
  });

  describe('notification handling', () => {
    test('should handle notification handlers', () => {
      const mockHandler = jest.fn();
      
      pipeline.addNotificationHandler(mockHandler);
      
      expect(pipeline.rollback.notificationHandlers).toContain(mockHandler);
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  test('should handle missing dependencies gracefully', () => {
    const gitOps = new GitOperations();
    
    require('child_process').execSync.mockImplementation(() => {
      throw new Error('git: command not found');
    });
    
    expect(() => gitOps.executeGitCommand('status')).toThrow('Git command failed');
  });

  test('should validate input parameters', () => {
    const gitOps = new GitOperations();
    
    expect(() => gitOps.stageFiles(null)).toThrow('Files array is required');
    expect(() => gitOps.createCommit(null)).toThrow('Commit message is required');
  });

  test('should handle timeout scenarios', () => {
    const firebaseDeployment = new FirebaseDeployment();
    
    require('child_process').execSync.mockImplementation(() => {
      throw new Error('Command timed out');
    });
    
    expect(() => firebaseDeployment.executeFirebaseCommand('deploy')).toThrow('Firebase command failed');
  });
});