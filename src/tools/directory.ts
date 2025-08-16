import fs from 'fs';
import path from 'path';

interface DirectoryItem {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryItem[];
}

interface DirectoryStructureOptions {
  path?: string;
  maxDepth?: number;
}

function parseGitignore(gitignorePath: string): string[] {
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  const content = fs.readFileSync(gitignorePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      // Convert gitignore patterns to regex-friendly format
      // Basic implementation - handles most common patterns
      if (line.endsWith('/')) {
        return line.slice(0, -1); // Directory pattern
      }
      return line;
    });
}

function isIgnored(filePath: string, ignorePatterns: string[], basePath: string): boolean {
  const relativePath = path.relative(basePath, filePath);
  const pathParts = relativePath.split(path.sep);

  for (const pattern of ignorePatterns) {
    // Handle exact matches
    if (pattern === relativePath || pattern === path.basename(filePath)) {
      return true;
    }

    // Handle wildcard patterns (basic implementation)
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(relativePath) || regex.test(path.basename(filePath))) {
        return true;
      }
    }

    // Handle directory patterns
    if (pathParts.includes(pattern)) {
      return true;
    }

    // Handle patterns that start with the ignore pattern
    if (relativePath.startsWith(pattern + '/') || relativePath.startsWith(pattern + path.sep)) {
      return true;
    }
  }

  return false;
}

function buildDirectoryTree(
  dirPath: string,
  ignorePatterns: string[],
  basePath: string,
  currentDepth: number = 0,
  maxDepth: number = 3
): DirectoryItem[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  try {
    const items = fs.readdirSync(dirPath);
    const result: DirectoryItem[] = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      
      // Skip if ignored
      if (isIgnored(fullPath, ignorePatterns, basePath)) {
        continue;
      }

      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        const children = buildDirectoryTree(fullPath, ignorePatterns, basePath, currentDepth + 1, maxDepth);
        const directoryItem: DirectoryItem = {
          name: item,
          type: 'directory'
        };
        if (children.length > 0) {
          directoryItem.children = children;
        }
        result.push(directoryItem);
      } else {
        result.push({
          name: item,
          type: 'file'
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    return result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  } catch (error) {
    return [];
  }
}

function formatTree(items: DirectoryItem[], prefix: string = ''): string {
  const result: string[] = [];

  items.forEach((item, index) => {
    const isLastItem = index === items.length - 1;
    const connector = isLastItem ? '└── ' : '├── ';
    const icon = item.type === 'directory' ? '📁 ' : '📄 ';
    
    result.push(`${prefix}${connector}${icon}${item.name}`);

    if (item.children && item.children.length > 0) {
      const childPrefix = prefix + (isLastItem ? '    ' : '│   ');
      result.push(formatTree(item.children, childPrefix));
    }
  });

  return result.join('\n');
}

export async function getDirectoryStructure(options: DirectoryStructureOptions = {}): Promise<string> {
  try {
    const targetPath = options.path ? path.resolve(options.path) : process.cwd();
    const maxDepth = options.maxDepth || 3;

    if (!fs.existsSync(targetPath)) {
      return `Error: Directory does not exist: ${targetPath}`;
    }

    if (!fs.statSync(targetPath).isDirectory()) {
      return `Error: Path is not a directory: ${targetPath}`;
    }

    // Find .gitignore file
    let gitignorePath = path.join(targetPath, '.gitignore');
    let ignorePatterns: string[] = [];

    // Look for .gitignore in the target directory or walk up to find it
    let currentDir = targetPath;
    while (currentDir !== path.dirname(currentDir)) {
      const possibleGitignore = path.join(currentDir, '.gitignore');
      if (fs.existsSync(possibleGitignore)) {
        gitignorePath = possibleGitignore;
        break;
      }
      currentDir = path.dirname(currentDir);
    }

    ignorePatterns = parseGitignore(gitignorePath);

    // Add common ignore patterns if no .gitignore found
    if (ignorePatterns.length === 0) {
      ignorePatterns = [
        'node_modules',
        '.git',
        '.DS_Store',
        '*.log',
        'dist',
        'build',
        '.env*'
      ];
    }

    const tree = buildDirectoryTree(targetPath, ignorePatterns, targetPath, 0, maxDepth);
    
    if (tree.length === 0) {
      return `Directory is empty or all contents are ignored: ${targetPath}`;
    }

    const header = `Directory Structure (${targetPath}):\n`;
    const treeOutput = formatTree(tree);
    const footer = `\n\n📊 Showing ${maxDepth} levels deep, respecting .gitignore rules`;

    return header + treeOutput + footer;

  } catch (error) {
    return `Error reading directory structure: ${(error as Error).message}`;
  }
}