import colors from 'yoctocolors-cjs';

export interface CommandResult {
  handled: boolean;
  shouldContinue: boolean;
  clearHistory?: boolean;
  clearChat?: boolean;
  summarize?: boolean;
  message?: string;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  handler: (args: string[]) => CommandResult;
}

const commands: Command[] = [
  {
    name: 'help',
    description: 'Show available commands',
    usage: '/help',
    handler: () => {
      const helpText = [
        colors.cyan('Available Commands:'),
        '',
        ...commands.map(cmd =>
          `  ${colors.yellow(cmd.usage)} - ${cmd.description}`
        ),
        '',
        colors.gray('Type "exit" to quit the application.')
      ].join('\n');

      return {
        handled: true,
        shouldContinue: true,
        message: helpText
      };
    }
  },
  {
    name: 'clear',
    description: 'Clear chat history and screen',
    usage: '/clear',
    handler: () => {
      return {
        handled: true,
        shouldContinue: true,
        clearHistory: true,
        clearChat: true,
        message: colors.green('✓ Chat history cleared')
      };
    }
  },
  {
    name: 'summarize',
    description: 'Summarize the conversation and replace history with the summary',
    usage: '/summarize',
    handler: () => {
      return {
        handled: true,
        shouldContinue: true,
        summarize: true,
        message: 'Summarizing conversation...'
      };
    }
  }
];

export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

export function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  const parts = trimmed.slice(1).split(/\s+/); // Remove '/' and split by whitespace
  const command = parts[0] || '';
  const args = parts.slice(1);

  return { command, args };
}

export function executeCommand(input: string): CommandResult {
  if (!isCommand(input)) {
    return { handled: false, shouldContinue: true };
  }

  const { command, args } = parseCommand(input);
  const cmd = commands.find(c => c.name === command);

  if (!cmd) {
    return {
      handled: true,
      shouldContinue: true,
      message: colors.red(`Unknown command: /${command}. Type /help for available commands.`)
    };
  }

  return cmd.handler(args);
}

export function getCommands(): Command[] {
  return [...commands];
}
