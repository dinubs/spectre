import fs from 'fs';
import path from 'path';

interface PromptVariables {
  WORKING_DIRECTORY: string;
  API_BASE_URL: string;
  PROJECT_NAME: string;
}

export function loadPromptTemplate(): string {
  try {
    const promptPath = path.join(process.cwd(), 'prompt.md');
    let template = fs.readFileSync(promptPath, 'utf-8');
    
    const variables: PromptVariables = {
      WORKING_DIRECTORY: process.cwd(),
      API_BASE_URL: process.env.LLAMA_API_URL || 'http://localhost:8080',
      PROJECT_NAME: path.basename(process.cwd())
    };
    
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(pattern, value);
    }
    
    return template;
  } catch (error) {
    return `You are Spectre, an AI coding agent. You have access to tools for searching, creating, modifying, and deleting files in ${process.cwd()}.`;
  }
}

export function getSystemPrompt(): string {
  const promptTemplate = loadPromptTemplate();
  return promptTemplate;
}