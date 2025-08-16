import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../../utils/logger.js';

export interface PatchChange {
  action: 'replace' | 'insert' | 'delete';
  lineStart: number;
  lineEnd?: number;
  content: string;
}

export interface PatchRequest {
  file: string;
  changes: PatchChange[];
}

export interface PatchResult {
  success: boolean;
  message: string;
  backupPath?: string;
  appliedChanges: number;
  failedChanges: PatchChange[];
}

function createBackup(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.env.HOME || os.homedir(), '.spectre', 'backups');

  // Create the backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFileName = `${path.basename(filePath)}.backup-${timestamp}`;
  const backupPath = path.join(backupDir, backupFileName);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function validatePatchChange(change: PatchChange, totalLines: number): string | null {
  if (change.lineStart < 1 || change.lineStart > totalLines + 1) {
    return `Invalid lineStart: ${change.lineStart}. Must be between 1 and ${totalLines + 1}`;
  }

  if (change.action === 'replace' || change.action === 'delete') {
    if (!change.lineEnd) {
      change.lineEnd = change.lineStart;
    }
    if (change.lineEnd < change.lineStart) {
      return `Invalid range: lineEnd (${change.lineEnd}) must be >= lineStart (${change.lineStart})`;
    }
    if (change.lineEnd > totalLines) {
      return `Invalid lineEnd: ${change.lineEnd}. Must be <= ${totalLines}`;
    }
  }

  if (change.action === 'delete' && change.content) {
    return `Delete operation should not have content`;
  }

  if ((change.action === 'replace' || change.action === 'insert') && !change.content) {
    return `${change.action} operation requires content`;
  }

  return null;
}

function applyPatchChanges(lines: string[], changes: PatchChange[]): { success: boolean; failedChanges: PatchChange[] } {
  const failedChanges: PatchChange[] = [];

  // Sort changes by line number in reverse order to avoid index shifting issues
  const sortedChanges = [...changes].sort((a, b) => b.lineStart - a.lineStart);

  for (const change of sortedChanges) {
    try {
      switch (change.action) {
        case 'replace':
          const endLine = change.lineEnd || change.lineStart;
          const linesToReplace = endLine - change.lineStart + 1;
          const newLines = change.content.split('\n');
          lines.splice(change.lineStart - 1, linesToReplace, ...newLines);
          break;

        case 'insert':
          const insertLines = change.content.split('\n');
          lines.splice(change.lineStart - 1, 0, ...insertLines);
          break;

        case 'delete':
          const deleteEndLine = change.lineEnd || change.lineStart;
          const linesToDelete = deleteEndLine - change.lineStart + 1;
          lines.splice(change.lineStart - 1, linesToDelete);
          break;
      }
    } catch (error) {
      failedChanges.push(change);
    }
  }

  return {
    success: failedChanges.length === 0,
    failedChanges
  };
}

export async function patchFile(request: PatchRequest): Promise<PatchResult> {
  try {
    const fullPath = path.resolve(request.file);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        message: `File does not exist: ${request.file}`,
        appliedChanges: 0,
        failedChanges: request.changes
      };
    }

    // Read and validate file
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const lines = fileContent.split('\n');

    // Validate all changes first
    const validationErrors: string[] = [];
    for (let i = 0; i < request.changes.length; i++) {
      const error = validatePatchChange(request.changes[i], lines.length);
      if (error) {
        validationErrors.push(`Change ${i + 1}: ${error}`);
      }
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        message: `Validation failed:\n${validationErrors.join('\n')}`,
        appliedChanges: 0,
        failedChanges: request.changes
      };
    }

    // Create backup
    const backupPath = createBackup(fullPath);

    // Apply changes
    const { success, failedChanges } = applyPatchChanges(lines, request.changes);
    const appliedChanges = request.changes.length - failedChanges.length;

    if (success) {
      // Write modified content back to file
      fs.writeFileSync(fullPath, lines.join('\n'));

      log(`File patched successfully: ${request.file} (${appliedChanges} changes applied)`, 'success');
      return {
        success: true,
        message: `Successfully applied ${appliedChanges} changes to ${request.file}`,
        backupPath,
        appliedChanges,
        failedChanges: []
      };
    } else {
      // Partial failure - restore from backup
      fs.copyFileSync(backupPath, fullPath);

      return {
        success: false,
        message: `Patch failed. ${failedChanges.length} changes could not be applied. File restored from backup.`,
        backupPath,
        appliedChanges: 0,
        failedChanges
      };
    }

  } catch (error) {
    return {
      success: false,
      message: `Patch operation failed: ${(error as Error).message}`,
      appliedChanges: 0,
      failedChanges: request.changes
    };
  }
}

export async function rollbackPatch(backupPath: string, originalPath: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!fs.existsSync(backupPath)) {
      return {
        success: false,
        message: `Backup file not found: ${backupPath}`
      };
    }

    fs.copyFileSync(backupPath, originalPath);
    fs.unlinkSync(backupPath); // Clean up backup file

    log(`File rolled back successfully: ${originalPath}`, 'success');
    return {
      success: true,
      message: `Successfully rolled back ${originalPath} from backup`
    };
  } catch (error) {
    return {
      success: false,
      message: `Rollback failed: ${(error as Error).message}`
    };
  }
}
