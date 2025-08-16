import colors from 'yoctocolors-cjs';

interface MarkdownStyles {
  h1: (text: string) => string;
  h2: (text: string) => string;
  h3: (text: string) => string;
  h4: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string, language?: string) => string;
  link: (text: string, url: string) => string;
  listItem: (text: string, level: number) => string;
  quote: (text: string) => string;
  strikethrough: (text: string) => string;
  separator: () => string;
}

const styles: MarkdownStyles = {
  h1: (text: string) => colors.bold(colors.magenta(`\n# ${text}\n`)),
  h2: (text: string) => colors.bold(colors.cyan(`\n## ${text}\n`)),
  h3: (text: string) => colors.bold(colors.blue(`\n### ${text}\n`)),
  h4: (text: string) => colors.bold(colors.green(`\n#### ${text}\n`)),
  bold: (text: string) => colors.bold(text),
  italic: (text: string) => colors.italic(text),
  code: (text: string) => colors.bgGray(colors.black(` ${text} `)),
  codeBlock: (text: string, language?: string) => {
    const lang = language ? colors.gray(`[${language}]`) : '';
    return `\n${lang}\n${colors.bgBlack(colors.white(text))}\n`;
  },
  link: (text: string, _url: string) => colors.underline(colors.blue(text)),
  listItem: (text: string, level: number) => {
    const indent = '  '.repeat(level);
    return `${indent}${colors.yellow('•')} ${text}`;
  },
  quote: (text: string) => colors.gray(`│ ${text}`),
  strikethrough: (text: string) => colors.strikethrough(text),
  separator: () => colors.gray('─'.repeat(50))
};

function parseCodeBlock(text: string, index: number): { content: string; newIndex: number } {
  const lines = text.split('\n');
  const startLine = text.substring(0, index).split('\n').length - 1;
  
  // Find the language (if any) on the opening line
  const openingLine = lines[startLine];
  const language = openingLine.substring(3).trim() || undefined;
  
  // Find the closing ```
  let endLine = startLine + 1;
  while (endLine < lines.length && !lines[endLine].startsWith('```')) {
    endLine++;
  }
  
  if (endLine >= lines.length) {
    // No closing ```, treat as regular text
    return { content: '```', newIndex: index + 3 };
  }
  
  // Extract code content
  const codeLines = lines.slice(startLine + 1, endLine);
  const codeContent = codeLines.join('\n');
  
  // Calculate new index position
  const processedText = lines.slice(0, endLine + 1).join('\n');
  const newIndex = processedText.length;
  
  return {
    content: styles.codeBlock(codeContent, language),
    newIndex
  };
}

function parseInlineCode(text: string, index: number): { content: string; newIndex: number } {
  const remaining = text.substring(index + 1);
  const endIndex = remaining.indexOf('`');
  
  if (endIndex === -1) {
    return { content: '`', newIndex: index + 1 };
  }
  
  const codeContent = remaining.substring(0, endIndex);
  return {
    content: styles.code(codeContent),
    newIndex: index + 1 + endIndex + 1
  };
}

function parseLink(text: string, index: number): { content: string; newIndex: number } {
  const remaining = text.substring(index);
  const match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  
  if (!match) {
    return { content: '[', newIndex: index + 1 };
  }
  
  const [fullMatch, linkText, url] = match;
  return {
    content: styles.link(linkText, url),
    newIndex: index + fullMatch.length
  };
}

function parseEmphasis(text: string, index: number, marker: string): { content: string; newIndex: number } {
  const remaining = text.substring(index + marker.length);
  const endIndex = remaining.indexOf(marker);
  
  if (endIndex === -1) {
    return { content: marker, newIndex: index + marker.length };
  }
  
  const emphasisContent = remaining.substring(0, endIndex);
  const formatter = marker === '**' ? styles.bold : 
                   marker === '*' ? styles.italic :
                   marker === '~~' ? styles.strikethrough : 
                   (text: string) => text;
  
  return {
    content: formatter(emphasisContent),
    newIndex: index + marker.length + endIndex + marker.length
  };
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Headers
    if (line.startsWith('#### ')) {
      result.push(styles.h4(line.substring(5)));
      continue;
    }
    if (line.startsWith('### ')) {
      result.push(styles.h3(line.substring(4)));
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(styles.h2(line.substring(3)));
      continue;
    }
    if (line.startsWith('# ')) {
      result.push(styles.h1(line.substring(2)));
      continue;
    }
    
    // Code blocks
    if (line.startsWith('```')) {
      const fullText = lines.join('\n');
      const currentIndex = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      const { content, newIndex } = parseCodeBlock(fullText, currentIndex);
      
      result.push(content);
      
      // Skip processed lines
      const processedLines = fullText.substring(0, newIndex).split('\n').length - 1;
      i = processedLines;
      continue;
    }
    
    // Block quotes
    if (line.startsWith('> ')) {
      result.push(styles.quote(line.substring(2)));
      continue;
    }
    
    // Lists
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (listMatch) {
      const [, indent, content] = listMatch;
      const level = Math.floor(indent.length / 2);
      result.push(styles.listItem(processInlineFormatting(content), level));
      continue;
    }
    
    // Numbered lists
    const numberedListMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberedListMatch) {
      const [, indent, content] = numberedListMatch;
      const level = Math.floor(indent.length / 2);
      result.push(styles.listItem(processInlineFormatting(content), level));
      continue;
    }
    
    // Horizontal rules
    if (line.match(/^-{3,}$/) || line.match(/^\*{3,}$/) || line.match(/^_{3,}$/)) {
      result.push(styles.separator());
      continue;
    }
    
    // Regular lines with inline formatting
    if (line.trim()) {
      result.push(processInlineFormatting(line));
    } else {
      result.push(''); // Preserve empty lines
    }
  }
  
  return result.join('\n');
}

function processInlineFormatting(text: string): string {
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const remaining = text.substring(i);
    
    // Code blocks (triple backticks)
    if (remaining.startsWith('```')) {
      const { content, newIndex } = parseCodeBlock(text, i);
      result += content;
      i = newIndex;
      continue;
    }
    
    // Inline code
    if (char === '`') {
      const { content, newIndex } = parseInlineCode(text, i);
      result += content;
      i = newIndex;
      continue;
    }
    
    // Links
    if (char === '[') {
      const { content, newIndex } = parseLink(text, i);
      result += content;
      i = newIndex;
      continue;
    }
    
    // Bold
    if (remaining.startsWith('**')) {
      const { content, newIndex } = parseEmphasis(text, i, '**');
      result += content;
      i = newIndex;
      continue;
    }
    
    // Strikethrough
    if (remaining.startsWith('~~')) {
      const { content, newIndex } = parseEmphasis(text, i, '~~');
      result += content;
      i = newIndex;
      continue;
    }
    
    // Italic (single asterisk or underscore)
    if (char === '*' && !remaining.startsWith('**')) {
      const { content, newIndex } = parseEmphasis(text, i, '*');
      result += content;
      i = newIndex;
      continue;
    }
    
    if (char === '_' && !remaining.startsWith('__')) {
      const { content, newIndex } = parseEmphasis(text, i, '_');
      result += content;
      i = newIndex;
      continue;
    }
    
    // Regular character
    result += char;
    i++;
  }
  
  return result;
}

// Utility function to detect if text contains markdown
export function hasMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,4}\s+/m,          // Headers
    /```[\s\S]*?```/,       // Code blocks
    /`[^`]+`/,              // Inline code
    /\*\*[^*]+\*\*/,        // Bold
    /\*[^*]+\*/,            // Italic
    /~~[^~]+~~/,            // Strikethrough
    /^\s*[-*+]\s+/m,        // Unordered lists
    /^\s*\d+\.\s+/m,        // Ordered lists
    /^\s*>\s+/m,            // Block quotes
    /\[[^\]]+\]\([^)]+\)/,  // Links
    /^[-*_]{3,}$/m          // Horizontal rules
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}