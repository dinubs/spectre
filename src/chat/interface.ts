import colors from 'yoctocolors-cjs';
import { DEBUG_MODE } from '../config/constants.js';
import { ChatMessage } from '../types/index.js';
import { renderMarkdown, hasMarkdown } from '../utils/markdown.js';

export function clearScreenAndRedraw(chatMessages: ChatMessage[], mockMode: boolean = false): void {
  if (!DEBUG_MODE) {
    console.clear();
  }

  console.log(colors.bold(colors.magenta('╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮')));
  console.log(colors.bold(colors.magenta('│') + colors.white('           .-.                                                                                                     ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('         .\'   `.                                                                                                   ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('         :g g   :                                                                                                  ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('         : o    `.                                                                                                 ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('        :         ``.                      _______________________________________________________________________ ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('       :             `.                   /   _____/\\______   \\_   _____/\\_   ___ \\__    ___/\\______   \\_   _____/ ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('      :  :         .   `.                 \\_____  \\  |     ___/|    __)_ /    \\  \\/ |    |    |       _/|    __)_  ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('      :   :          ` . `.               /        \\ |    |    |        \\\\     \\____|    |    |    |   \\|        \\ ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('       `.. :            `. ``;           /_______  / |____|   /_______  / \\______  /|____|    |____|_  /_______  / ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('          `:;             `:\\\'                   \\/                   \\\/         \\/                  \\/        \\/  ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('             :              `.                                                                                     ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('              `.              `.     .                                                                             ') + colors.magenta('│')));
  console.log(colors.bold(colors.magenta('│') + colors.white('                                                                                                                   ') + colors.magenta('│')));
  if (mockMode) {
    console.log(colors.bold(colors.magenta('│') + colors.yellow('           ⚠️  Demo Mode - No Server                                                                               ') + colors.magenta('│')));
  }
  console.log(colors.bold(colors.magenta('╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯')));


  chatMessages.forEach(msg => {
    if (msg.role === 'user') {
      console.log(colors.gray('You: ' + msg.content));
    } else if (msg.role === 'assistant') {
      const content = msg.content;
      // Sanitize content to prevent angle bracket issues
      const sanitizedContent = content.replace(/<([^>]+)>/g, (match, p1) => {
        // If it looks like a tool call, don't show angle brackets
        if (p1.includes('tool_call') || p1.includes('function')) {
          return p1;
        }
        return match;
      });
      if (hasMarkdown(sanitizedContent)) {
        console.log(colors.magenta('AI: '));
        console.log(renderMarkdown(sanitizedContent));
      } else {
        console.log(colors.magenta('AI: ') + colors.white(sanitizedContent));
      }
    }
  });
}
