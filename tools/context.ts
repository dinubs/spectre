import fs from 'fs';
import path from 'path';
import ora from 'ora';

export async function getCodeContext(filePath: string, lineNumber: string, contextLines: number = 20): Promise<string> {
  const spinner = ora(`Getting context for ${filePath}:${lineNumber}...`).start();

  try {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      spinner.fail();
      return `Error: File "${filePath}" not found.`;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    const targetLine = parseInt(lineNumber);
    if (isNaN(targetLine) || targetLine < 1 || targetLine > lines.length) {
      spinner.fail();
      return `Error: Invalid line number ${lineNumber}. File has ${lines.length} lines.`;
    }

    const startLine = Math.max(1, targetLine - contextLines);
    const endLine = Math.min(lines.length, targetLine + contextLines);
    
    let output = `📁 ${filePath} (lines ${startLine}-${endLine}):\n\n`;
    
    for (let i = startLine - 1; i < endLine; i++) {
      const currentLineNum = i + 1;
      const line = lines[i];
      
      if (currentLineNum === targetLine) {
        output += `>>> ${currentLineNum.toString().padStart(4)}: ${line}\n`;
      } else {
        output += `    ${currentLineNum.toString().padStart(4)}: ${line}\n`;
      }
    }
    
    spinner.succeed();
    return output;
    
  } catch (error) {
    spinner.fail();
    return `Error reading file context: ${(error as Error).message}`;
  }
}