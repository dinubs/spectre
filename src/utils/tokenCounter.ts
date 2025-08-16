import { ChatMessage } from '../types/index.js';
  // Simple approximation using token-like behavior
  // In a real implementation, you'd use a proper tokenizer
  // This is a rough estimate based on word count and character length

export function countTokens(text: string): number {
  // Simple approximation using token-like behavior
  // In a real implementation, you'd use a proper tokenizer
  // This is a rough estimate based on word count and character length

  if (!text) return 0;

  // Rough estimation: average 4 characters per token
  // This is a simplification - real tokenizers like Tiktoken would be more accurate
  return Math.ceil(text.length / 4);
}

export function estimateTotalTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const message of messages) {
    // Add a bit extra for role information
    total += countTokens(message.content) + 5;  // Add 5 tokens for role info
  }
  return total;
}
