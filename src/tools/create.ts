import fs from 'fs';
import path from 'path';
import { log } from '../../utils/logger.js';

export interface CreateItemRequest {
  path: string;
  type: 'file' | 'directory';
  content?: string;
  overwrite?: boolean;
}

export interface CreateItemResult {
  success: boolean;
  message: string;
  created?: string;
  type?: 'file' | 'directory';
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function validatePath(targetPath: string): { valid: boolean; error?: string } {
  // Check for dangerous path patterns
  const normalized = path.normalize(targetPath);
  
  // Prevent directory traversal attacks
  if (normalized.includes('..')) {
    return { valid: false, error: 'Path cannot contain ".." (directory traversal)' };
  }
  
  // Prevent absolute paths outside of current working directory
  if (path.isAbsolute(normalized)) {
    const cwd = process.cwd();
    const resolved = path.resolve(normalized);
    if (!resolved.startsWith(cwd)) {
      return { valid: false, error: 'Cannot create files outside current project directory' };
    }
  }
  
  // Check for invalid characters (basic check)
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(path.basename(normalized))) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }
  
  return { valid: true };
}

export async function createItem(request: CreateItemRequest): Promise<CreateItemResult> {
  try {
    const { path: itemPath, type, content = '', overwrite = false } = request;
    
    // Validate the path
    const validation = validatePath(itemPath);
    if (!validation.valid) {
      return {
        success: false,
        message: `Invalid path: ${validation.error}`
      };
    }
    
    // Resolve path relative to current working directory
    const fullPath = path.resolve(process.cwd(), itemPath);
    const exists = fs.existsSync(fullPath);
    
    // Debug information available in error messages
    
    // Check if item already exists
    if (exists && !overwrite) {
      const existingType = fs.statSync(fullPath).isDirectory() ? 'directory' : 'file';
      return {
        success: false,
        message: `${existingType} already exists at: ${fullPath}\nCWD: ${process.cwd()}\nRequested: ${itemPath}\nUse overwrite option to replace.`
      };
    }
    
    if (type === 'directory') {
      // Create directory
      if (exists && overwrite) {
        // If overwriting and it's a file, remove it first
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
        }
      }
      
      ensureDirectoryExists(fullPath);
      
      log(`Directory created: ${itemPath}`, 'success');
      return {
        success: true,
        message: `Directory created successfully: ${itemPath} at ${fullPath}`,
        created: fullPath,
        type: 'directory'
      };
      
    } else if (type === 'file') {
      // Create file
      const dirPath = path.dirname(fullPath);
      
      // Ensure parent directory exists
      ensureDirectoryExists(dirPath);
      
      // If overwriting a directory, remove it first
      if (exists && overwrite && fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
      }
      
      // Write file content
      fs.writeFileSync(fullPath, content, 'utf8');
      
      log(`File created: ${itemPath}`, 'success');
      return {
        success: true,
        message: `File created successfully: ${itemPath} at ${fullPath}${content ? ` (${content.length} characters)` : ' (empty)'}`,
        created: fullPath,
        type: 'file'
      };
      
    } else {
      return {
        success: false,
        message: `Invalid type: ${type}. Must be 'file' or 'directory'.`
      };
    }
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to create ${request.type}: ${(error as Error).message}`
    };
  }
}

export async function createMultipleItems(requests: CreateItemRequest[]): Promise<CreateItemResult[]> {
  const results: CreateItemResult[] = [];
  
  for (const request of requests) {
    const result = await createItem(request);
    results.push(result);
    
    // If creation failed and it's critical, we might want to stop
    // For now, continue with remaining items
  }
  
  return results;
}

// Utility function to create a complete directory structure (directories and empty files only)
export async function createProjectStructure(structure: { [key: string]: 'directory' | 'file' }): Promise<CreateItemResult[]> {
  const requests: CreateItemRequest[] = [];
  
  // Convert object structure to create requests (no content, just structure)
  for (const [itemPath, itemType] of Object.entries(structure)) {
    const request: CreateItemRequest = {
      path: itemPath,
      type: itemType
    };
    if (itemType === 'file') {
      request.content = ''; // Empty files
    }
    requests.push(request);
  }
  
  // Sort requests to create directories before files
  requests.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.path.localeCompare(b.path);
  });
  
  return await createMultipleItems(requests);
}

// New function specifically for creating directory scaffolding
export async function createDirectoryScaffold(paths: string[]): Promise<CreateItemResult[]> {
  const requests: CreateItemRequest[] = paths.map(dirPath => ({
    path: dirPath,
    type: 'directory'
  }));
  
  return await createMultipleItems(requests);
}

// New function for creating empty files (AI can add content later with patch_file)
export async function createEmptyFiles(paths: string[]): Promise<CreateItemResult[]> {
  const requests: CreateItemRequest[] = paths.map(filePath => ({
    path: filePath,
    type: 'file',
    content: ''
  }));
  
  return await createMultipleItems(requests);
}