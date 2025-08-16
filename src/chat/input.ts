import colors from 'yoctocolors-cjs';
import { getCommands } from './commands.js';

function showCommandSuggestions(): void {
  const commands = getCommands();
  console.log(colors.yellow('\n┌─ Available Commands:'));
  commands.forEach(cmd => {
    console.log(colors.yellow(`│ ${cmd.usage} - ${cmd.description}`));
  });
  console.log(colors.yellow('└─ Continue typing or press Enter to cancel\n'));
}

export function createPersistentInput(reachingTokenThreshold: boolean): Promise<string> {
  return new Promise((resolve) => {
    let currentInput = '';
    let commandSuggestionsShown = false;
    let message = '┌─ Type your message or /help for commands and press Enter to send'
    if (reachingTokenThreshold) {
      console.log(colors.gray('You are reaching the token limit, please run /summarize or clear history to continue, to avoid server crashes'))
    }

    console.log(colors.cyan(message))
    process.stdout.write(colors.cyan('│ '));
    console.log('\n\n');

    process.stdout.write('\x1b[3A');
    process.stdout.write('\x1b[2C');

    // Handle individual key presses
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.removeAllListeners('data');
      process.stdin.pause();
    };

    process.stdin.on('data', (key: string) => {
      const char = key.toString();

      if (char === '\r' || char === '\n') {
        // Enter pressed
        cleanup();
        console.log(); // New line after input

        const message = currentInput.trim();
        if (message.toLowerCase() === 'exit') {
          console.log(colors.cyan('└─ Goodbye!'));
          cleanup();
          process.exit(0);
        } else if (message) {
          resolve(message);
        } else {
          resolve(createPersistentInput(reachingTokenThreshold));
        }
        return;
      }

      if (char === '\u0003') {
        // Ctrl+C
        console.log(colors.cyan('\n└─ Goodbye!'));
        cleanup();
        process.exit(0);
      }

      if (char === '\u007f' || char === '\b') {
        // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          process.stdout.write('\b \b');

          // Hide command suggestions if we're no longer typing a command
          if (commandSuggestionsShown && !currentInput.startsWith('/')) {
            // Clear the suggestions by moving cursor and clearing lines
            process.stdout.write('\x1b[s'); // Save cursor position
            process.stdout.write('\x1b[B'); // Move down
            const commands = getCommands();
            for (let i = 0; i <= commands.length + 1; i++) {
              process.stdout.write('\x1b[2K'); // Clear line
              process.stdout.write('\x1b[B'); // Move down
            }
            process.stdout.write('\x1b[u'); // Restore cursor position
            commandSuggestionsShown = false;
          }
        }
        return;
      }

      // Regular character
      currentInput += char;
      process.stdout.write(char);

      // Show command suggestions when user types '/'
      if (currentInput === '/' && !commandSuggestionsShown) {
        process.stdout.write('\x1b[s'); // Save cursor position
        showCommandSuggestions();
        process.stdout.write('\x1b[u'); // Restore cursor position
        commandSuggestionsShown = true;
      }

      // Hide suggestions if user moves away from command
      if (commandSuggestionsShown && !currentInput.startsWith('/')) {
        // Clear the suggestions
        process.stdout.write('\x1b[s'); // Save cursor position
        process.stdout.write('\x1b[B'); // Move down
        const commands = getCommands();
        for (let i = 0; i <= commands.length + 1; i++) {
          process.stdout.write('\x1b[2K'); // Clear line
          process.stdout.write('\x1b[B'); // Move down
        }
        process.stdout.write('\x1b[u'); // Restore cursor position
        commandSuggestionsShown = false;
      }
    });

    process.on('SIGINT', () => {
      console.log(colors.cyan('\n└─ Goodbye!'));
      cleanup();
      process.exit(0);
    });
  });
}
