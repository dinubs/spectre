#!/usr/bin/env node

import colors from 'yoctocolors-cjs';
import ora from 'ora';
import { log } from './utils/logger.js';
import { getSystemPrompt } from './utils/prompt.js';
import { makeAPIRequest, testConnection } from './src/api/client.js';
import { clearScreenAndRedraw } from './src/chat/interface.js';
import { createPersistentInput } from './src/chat/input.js';
import { executeCommand, isCommand } from './src/chat/commands.js';
import { getToolDefinitions, executeTool } from './src/tools/manager.js';
import { DEBUG_MODE } from './src/config/constants.js';
import { ChatMessage } from './src/types/index.js';
import { estimateTotalTokens } from './src/utils/tokenCounter.js';

let messageHistory: ChatMessage[] = [];
let chatMessages: ChatMessage[] = [];
let mockMode = false;

async function makeAPICall(abortSignal?: AbortSignal): Promise<string | undefined> {
  const message = await makeAPIRequest(messageHistory, getToolDefinitions(), abortSignal);
  const { content, tool_calls } = message;

  messageHistory.push({
    role: 'assistant',
    content: content || '',
    tool_calls: tool_calls
  });

  if (tool_calls && tool_calls.length > 0) {
    if (content && content.trim()) {
      chatMessages.push({
        role: 'assistant',
        content: content
      });
      clearScreenAndRedraw(chatMessages, mockMode);
    }

    for (const toolCall of tool_calls) {
      chatMessages.push({
        role: 'assistant',
        content: `🔧 Using tool: ${toolCall.function.name}`
      });
      clearScreenAndRedraw(chatMessages, mockMode);

      const result = await executeTool(toolCall);

      messageHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      });

      chatMessages.push({
        role: 'assistant',
        content: `📄 Tool result: ${result.substring(0, 300)}${result.length > 300 ? '...' : ''}`
      });
      clearScreenAndRedraw(chatMessages, mockMode);
    }

    return await makeAPICall(abortSignal);
  } else {
    if (content) {
      chatMessages.push({
        role: 'assistant',
        content: content
      });
    }
    return content;
  }
}

async function main(): Promise<void> {
  if (DEBUG_MODE) {
    console.log(colors.yellow('🐛 DEBUG MODE ENABLED'));
    console.log(colors.gray('Debug logs will show API requests, responses, and tool execution details.'));
    console.log(colors.gray('─'.repeat(50)));
  }

  const spinner = ora('Connecting to AI server...').start();

  try {
    await testConnection();
    spinner.succeed(colors.green('✓ Connected to AI server'));

    const systemPrompt = getSystemPrompt();
    messageHistory.push({
      role: 'system',
      content: systemPrompt
    });

    clearScreenAndRedraw(chatMessages, mockMode);
    console.log(colors.gray('Connected! Start chatting below. Type "exit" to quit or "/help" for commands.\n'));

    while (true) {
      const totalTokens = estimateTotalTokens(chatMessages);
      const TOKEN_THRESHOLD = 1500;
      const message = await createPersistentInput(totalTokens > TOKEN_THRESHOLD);

      if (message === 'exit') {
        break;
      }

      // Handle slash commands
      if (isCommand(message)) {
        const commandResult = executeCommand(message);

        if (commandResult.handled) {
          // Clear history and chat if requested
          if (commandResult.clearHistory) {
            messageHistory = [];

            // Clear chat messages and show the summary
            chatMessages = [];
          }

          // Handle summarize command
          if (commandResult.summarize) {
            // Create a system prompt for summarization
            const summarizePrompt = "Please provide a concise summary of the entire conversation. Focus on the key points, main topics, and conclusions. Keep it brief and to the point.";

            // Create a temporary message history for summarization
            const summarizeHistory = [
              ...messageHistory,
              { role: 'user', content: summarizePrompt } as ChatMessage
            ];

            try {
              const summaryResponse = await makeAPIRequest(summarizeHistory, getToolDefinitions());
              const summaryContent = summaryResponse.content || 'No summary available.';

              // Replace the entire message history with just the summary
              messageHistory = [
                { role: 'system', content: getSystemPrompt() },
                { role: 'assistant', content: summaryContent }
              ];

              // Clear chat messages and show the summary
              chatMessages = [
                { role: 'assistant', content: summaryContent }
              ];

              // Show a success message
              chatMessages.push({
                role: 'assistant',
                content: 'Conversation summarized successfully.'
              });
            } catch (error) {
              console.error('Error summarizing conversation:', error);

              // If summarization fails, at least clear the chat
              chatMessages = [
                { role: 'assistant', content: 'Failed to summarize conversation.' }
              ];
            }
          }

          // Show command result message if provided
          if (commandResult.message) {
            chatMessages.push({
              role: 'assistant',
              content: commandResult.message
            });
          }

          clearScreenAndRedraw(chatMessages, mockMode);

          if (commandResult.shouldContinue) {
            continue;
          } else {
            break;
          }
        }
      }

      chatMessages.push({
        role: 'user',
        content: message
      });

      clearScreenAndRedraw(chatMessages, mockMode);

      const spinner = ora('AI is thinking... (Press ESC to cancel)').start();

      messageHistory.push({
        role: 'user',
        content: message
      });

      // Create abort controller for cancellation
      const abortController = new AbortController();
      let cancelled = false;

      // Set up escape key listener
      const escapeListener = (key: Buffer) => {
        if (key.toString() === '\x1b') { // ESC key
          cancelled = true;
          abortController.abort();
          spinner.fail(colors.yellow('✗ AI request cancelled by user'));
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', escapeListener);
        }
      };

      // Enable raw mode to capture escape key
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', escapeListener);

      try {
        await makeAPICall(abortController.signal);
        if (!cancelled) {
          spinner.stop();
        }
      } catch (error) {
        if (!cancelled) {
          spinner.stop();
          if ((error as any).name === 'AbortError' || (error as any).code === 'ABORT_ERR') {
            console.log(colors.yellow(`✗ AI request was cancelled`));
          } else {
            console.log(colors.red(`✗ AI request failed: ${(error as Error).message}`));
          }

          chatMessages.push({
            role: 'assistant',
            content: cancelled ? 'Request cancelled by user' : `Error: ${(error as Error).message}`
          });
        }
      } finally {
        // Clean up escape key listener
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', escapeListener);
      }

      clearScreenAndRedraw(chatMessages, mockMode);
    }
  } catch (error) {
    spinner.fail(colors.red('✗ Could not connect to AI server'));
    console.log(colors.red('Please check your server configuration and try again.'));
    process.exit(1);
  }
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  process.exit(1);
});
