/**
 * Git Integration for Deployment Pipeline
 * Handles Git operations for continuous deployment
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { GitCommitInfo } from '../types/deploymentTypes'

export interface GitConfig {
  workingDir: string
  autoCommit: boolean
  autoPush: boolean
  commitMessageTemplate: string
  branchProtection: boolean
  requiredBranch?: string
}

export interface GitStatus {
  isClean: boolean
  hasUncommittedChanges: boolean
  hasUnpushedCommits: boolean
  currentBranch: string
  uncommittedFiles: string[]
  unpushedCommits: GitCommitInfo[]
}

export class GitIntegration {
  private config: GitConfig

  constructor(config: GitConfig) {
    this.config = config
  }

  /**
   * Get current Git status
   */
  async getStatus(): Promise<GitStatus> {
    try {
      // Get current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      // Check for uncommitted changes
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      })

      const uncommittedFiles = statusOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3))

      const hasUncommittedChanges = uncommittedFiles.length > 0

      // Check for unpushed commits
      let hasUnpushedCommits = false
      let unpushedCommits: GitCommitInfo[] = []

      try {
        const unpushedOutput = execSync(`git log origin/${currentBranch}..HEAD --oneline`, {
          cwd: this.config.workingDir,
          encoding: 'utf8'
        })

        if (unpushedOutput.trim()) {
          hasUnpushedCommits = true
          unpushedCommits = await this.parseCommitLog(unpushedOutput)
        }
      } catch (error) {
        // Branch might not exist on remote, which is fine
      }

      return {
        isClean: !hasUncommittedChanges && !hasUnpushedCommits,
        hasUncommittedChanges,
        hasUnpushedCommits,
        currentBranch,
        uncommittedFiles,
        unpushedCommits
      }

    } catch (error) {
      throw new Error(`Failed to get Git status: ${error.message}`)
    }
  }

  /**
   * Create deployment commit
   */
  async createDeploymentCommit(deploymentId: string, customMessage?: string): Promise<GitCommitInfo> {
    try {
      const status = await this.getStatus()

      // Check branch protection
      if (this.config.branchProtection && this.config.requiredBranch) {
        if (status.currentBranch !== this.config.requiredBranch) {
          throw new Error(`Deployment only allowed from ${this.config.requiredBranch} branch, currently on ${status.currentBranch}`)
        }
      }

      if (!status.hasUncommittedChanges) {
        throw new Error('No changes to commit')
      }

      // Generate commit message
      const commitMessage = customMessage || this.generateCommitMessage(deploymentId)

      // Add all changes
      execSync('git add .', { cwd: this.config.workingDir })

      // Create commit
      execSync(`git commit -m "${commitMessage}"`, { cwd: this.config.workingDir })

      // Get commit info
      return await this.getLatestCommitInfo()

    } catch (error) {
      throw new Error(`Failed to create deployment commit: ${error.message}`)
    }
  }

  /**
   * Push changes to remote repository
   */
  async pushChanges(branch?: string): Promise<void> {
    try {
      const targetBranch = branch || (await this.getStatus()).currentBranch

      execSync(`git push origin ${targetBranch}`, {
        cwd: this.config.workingDir,
        stdio: 'pipe'
      })

    } catch (error) {
      throw new Error(`Failed to push changes: ${error.message}`)
    }
  }

  /**
   * Create and push deployment tag
   */
  async createDeploymentTag(deploymentId: string, message?: string): Promise<void> {
    try {
      const tagName = `deploy-${deploymentId}`
      const tagMessage = message || `Deployment ${deploymentId}`

      // Create annotated tag
      execSync(`git tag -a ${tagName} -m "${tagMessage}"`, {
        cwd: this.config.workingDir
      })

      // Push tag to remote
      execSync(`git push origin ${tagName}`, {
        cwd: this.config.workingDir
      })

    } catch (error) {
      throw new Error(`Failed to create deployment tag: ${error.message}`)
    }
  }

  /**
   * Get commit history for rollback
   */
  async getCommitHistory(limit: number = 10): Promise<GitCommitInfo[]> {
    try {
      const output = execSync(`git log --oneline -${limit} --pretty=format:"%H|%s|%an|%ad" --date=iso`, {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      })

      return this.parseCommitLog(output)

    } catch (error) {
      throw new Error(`Failed to get commit history: ${error.message}`)
    }
  }

  /**
   * Rollback to specific commit
   */
  async rollbackToCommit(commitHash: string, createBackupBranch: boolean = true): Promise<void> {
    try {
      const status = await this.getStatus()

      // Create backup branch if requested
      if (createBackupBranch) {
        const backupBranchName = `backup-${Date.now()}`
        execSync(`git checkout -b ${backupBranchName}`, { cwd: this.config.workingDir })
        execSync(`git checkout ${status.currentBranch}`, { cwd: this.config.workingDir })
      }

      // Perform rollback
      execSync(`git reset --hard ${commitHash}`, { cwd: this.config.workingDir })

      // Force push if auto-push is enabled
      if (this.config.autoPush) {
        execSync(`git push --force-with-lease origin ${status.currentBranch}`, {
          cwd: this.config.workingDir
        })
      }

    } catch (error) {
      throw new Error(`Failed to rollback to commit: ${error.message}`)
    }
  }

  /**
   * Get latest commit information
   */
  async getLatestCommitInfo(): Promise<GitCommitInfo> {
    try {
      const hash = execSync('git rev-parse HEAD', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      const message = execSync('git log -1 --pretty=format:"%s"', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      const author = execSync('git log -1 --pretty=format:"%an"', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      const timestampStr = execSync('git log -1 --pretty=format:"%ad" --date=iso', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).trim()

      const files = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      }).split('\n').filter(f => f.trim())

      return {
        hash,
        message,
        author,
        timestamp: new Date(timestampStr),
        branch,
        files
      }

    } catch (error) {
      throw new Error(`Failed to get latest commit info: ${error.message}`)
    }
  }

  /**
   * Validate repository state before deployment
   */
  async validateForDeployment(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // Check if we're in a Git repository
      execSync('git status', { cwd: this.config.workingDir, stdio: 'pipe' })

      const status = await this.getStatus()

      // Check branch protection
      if (this.config.branchProtection && this.config.requiredBranch) {
        if (status.currentBranch !== this.config.requiredBranch) {
          issues.push(`Must be on ${this.config.requiredBranch} branch for deployment`)
        }
      }

      // Check for uncommitted changes if auto-commit is disabled
      if (!this.config.autoCommit && status.hasUncommittedChanges) {
        issues.push('Repository has uncommitted changes')
      }

      // Check for unpushed commits if auto-push is disabled
      if (!this.config.autoPush && status.hasUnpushedCommits) {
        issues.push('Repository has unpushed commits')
      }

      // Check if remote is accessible
      try {
        execSync('git ls-remote origin', { cwd: this.config.workingDir, stdio: 'pipe' })
      } catch (error) {
        issues.push('Cannot access remote repository')
      }

    } catch (error) {
      issues.push(`Git validation failed: ${error.message}`)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Setup Git hooks for deployment
   */
  async setupDeploymentHooks(): Promise<void> {
    try {
      const hooksDir = path.join(this.config.workingDir, '.git', 'hooks')
      
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true })
      }

      // Pre-commit hook
      const preCommitHook = `#!/bin/sh
# Pre-commit hook for deployment validation

echo "Running pre-commit validation..."

# Run linting
npm run lint || exit 1

# Run tests
npm test || exit 1

echo "Pre-commit validation passed"
`

      fs.writeFileSync(path.join(hooksDir, 'pre-commit'), preCommitHook)
      
      // Make executable on Unix systems
      if (process.platform !== 'win32') {
        execSync(`chmod +x "${path.join(hooksDir, 'pre-commit')}"`)
      }

      // Pre-push hook
      const prePushHook = `#!/bin/sh
# Pre-push hook for deployment validation

echo "Running pre-push validation..."

# Check if pushing to protected branch
protected_branch="main"
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\\(.*\\),\\1,')

if [ "$current_branch" = "$protected_branch" ]; then
    echo "Running additional validation for protected branch..."
    
    # Run full test suite
    npm run test:full || exit 1
    
    # Run security audit
    npm audit --audit-level=high || exit 1
fi

echo "Pre-push validation passed"
`

      fs.writeFileSync(path.join(hooksDir, 'pre-push'), prePushHook)
      
      // Make executable on Unix systems
      if (process.platform !== 'win32') {
        execSync(`chmod +x "${path.join(hooksDir, 'pre-push')}"`)
      }

    } catch (error) {
      throw new Error(`Failed to setup Git hooks: ${error.message}`)
    }
  }

  /**
   * Generate deployment commit message
   */
  private generateCommitMessage(deploymentId: string): string {
    const template = this.config.commitMessageTemplate || 'Deploy {deploymentId} - {timestamp}'
    const timestamp = new Date().toISOString()
    
    return template
      .replace('{deploymentId}', deploymentId)
      .replace('{timestamp}', timestamp)
      .replace('{date}', new Date().toDateString())
  }

  /**
   * Parse Git commit log output
   */
  private async parseCommitLog(output: string): Promise<GitCommitInfo[]> {
    const commits: GitCommitInfo[] = []
    const lines = output.split('\n').filter(line => line.trim())

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length >= 4) {
        commits.push({
          hash: parts[0],
          message: parts[1],
          author: parts[2],
          timestamp: new Date(parts[3]),
          branch: '', // Will be filled by caller if needed
          files: [] // Will be filled by caller if needed
        })
      }
    }

    return commits
  }
}

/**
 * Git workflow automation for continuous deployment
 */
export class GitWorkflow {
  private gitIntegration: GitIntegration

  constructor(gitIntegration: GitIntegration) {
    this.gitIntegration = gitIntegration
  }

  /**
   * Execute complete Git workflow for deployment
   */
  async executeDeploymentWorkflow(deploymentId: string, options: {
    commitMessage?: string
    createTag?: boolean
    pushChanges?: boolean
  } = {}): Promise<GitCommitInfo> {
    try {
      // Validate repository state
      const validation = await this.gitIntegration.validateForDeployment()
      if (!validation.valid) {
        throw new Error(`Git validation failed: ${validation.issues.join(', ')}`)
      }

      // Create deployment commit
      const commitInfo = await this.gitIntegration.createDeploymentCommit(
        deploymentId,
        options.commitMessage
      )

      // Push changes if requested
      if (options.pushChanges !== false) {
        await this.gitIntegration.pushChanges()
      }

      // Create deployment tag if requested
      if (options.createTag) {
        await this.gitIntegration.createDeploymentTag(
          deploymentId,
          `Deployment ${deploymentId} - ${commitInfo.message}`
        )
      }

      return commitInfo

    } catch (error) {
      throw new Error(`Git workflow failed: ${error.message}`)
    }
  }

  /**
   * Execute rollback workflow
   */
  async executeRollbackWorkflow(targetCommitHash: string, options: {
    createBackupBranch?: boolean
    pushChanges?: boolean
  } = {}): Promise<void> {
    try {
      // Perform rollback
      await this.gitIntegration.rollbackToCommit(
        targetCommitHash,
        options.createBackupBranch !== false
      )

      // Push changes if requested
      if (options.pushChanges !== false) {
        const status = await this.gitIntegration.getStatus()
        await this.gitIntegration.pushChanges(status.currentBranch)
      }

    } catch (error) {
      throw new Error(`Rollback workflow failed: ${error.message}`)
    }
  }
}