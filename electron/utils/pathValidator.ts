import * as path from 'path'

/**
 * Path validator for filesystem sandboxing.
 * Ensures file operations are restricted to allowed directories.
 */
class PathValidator {
  private allowedRoots: Set<string> = new Set()
  private initialized = false

  /**
   * Initialize with default allowed roots (app userData).
   * Must be called after app.whenReady() since app.getPath() requires it.
   */
  init(): void {
    if (this.initialized) return
    try {
      const { app } = require('electron')
      this.addRoot(app.getPath('userData'))
    } catch {
      // May fail if called before app is ready
    }
    this.initialized = true
  }

  addRoot(root: string): void {
    this.allowedRoots.add(path.resolve(root))
  }

  removeRoot(root: string): void {
    this.allowedRoots.delete(path.resolve(root))
  }

  getRoots(): string[] {
    return Array.from(this.allowedRoots)
  }

  /**
   * Validate that a target path resolves to within an allowed root.
   * Prevents path traversal attacks (e.g., ../../etc/passwd).
   */
  validate(targetPath: string): { valid: boolean; resolved: string; error?: string } {
    // Reject null bytes (poison null byte attack)
    if (targetPath.includes('\0')) {
      return { valid: false, resolved: '', error: 'Path contains null bytes' }
    }

    const resolved = path.resolve(targetPath)

    // Check if the resolved path is under any allowed root
    for (const root of this.allowedRoots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return { valid: true, resolved }
      }
    }

    return {
      valid: false,
      resolved,
      error: `Path "${resolved}" is outside allowed directories: [${this.getRoots().join(', ')}]`,
    }
  }
}

export const pathValidator = new PathValidator()
export { PathValidator }
