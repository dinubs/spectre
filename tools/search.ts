import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import { SearchResults } from '../src/types/index.js';

const execAsync = promisify(exec);

export async function searchCodebase(query: string): Promise<string> {
  const spinner = ora('Searching codebase...').start();

  try {
    let command: string;
    let useRipgrep = false;
    
    try {
      await execAsync('which rg');
      useRipgrep = true;
      command = `rg -n -C 1 --no-heading --max-count 10 --type-not log "${query}" . 2>/dev/null || true`;
    } catch {
      command = `grep -rn --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.java" --include="*.cpp" --include="*.c" --include="*.cs" --include="*.php" --include="*.rb" --include="*.go" --include="*.rs" --include="*.swift" --include="*.kt" --include="*.scala" --include="*.sh" --include="*.html" --include="*.css" --include="*.scss" --include="*.json" --include="*.md" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=.next "${query}" . 2>/dev/null || true`;
    }

    const { stdout } = await execAsync(command);
    spinner.succeed();

    if (!stdout.trim()) {
      return `No matches found for "${query}" in the codebase.`;
    }

    const lines = stdout.trim().split('\n');
    const results: SearchResults = {};
    
    lines.forEach(line => {
      let match: RegExpMatchArray | null;
      if (useRipgrep) {
        match = line.match(/^([^:]+):(\d+):(.*)$/);
      } else {
        match = line.match(/^([^:]+):(\d+):(.*)$/);
      }
      
      if (match) {
        const [, file, lineNum, content] = match;
        const relativeFile = file.startsWith('./') ? file.slice(2) : file;
        
        if (!results[relativeFile]) {
          results[relativeFile] = [];
        }
        
        if (content.trim() && !content.includes('--')) {
          results[relativeFile].push({
            lineNumber: parseInt(lineNum),
            content: content.trim()
          });
        }
      }
    });

    if (Object.keys(results).length === 0) {
      return `No matches found for "${query}" in the codebase.`;
    }

    let output = `Found matches for "${query}" in ${Object.keys(results).length} files:\n\n`;
    
    Object.entries(results).forEach(([file, matches]) => {
      output += `📁 ${file}:\n`;
      matches.slice(0, 5).forEach(match => {
        output += `  Line ${match.lineNumber}: ${match.content}\n`;
      });
      if (matches.length > 5) {
        output += `  ... and ${matches.length - 5} more matches\n`;
      }
      output += '\n';
    });

    return output;
  } catch (error) {
    spinner.fail();
    throw new Error(`Search failed: ${(error as Error).message}`);
  }
}