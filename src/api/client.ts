import axios, { AxiosResponse } from 'axios';
import { API_BASE_URL, DEBUG_MODE } from '../config/constants.js';
import { ChatMessage, ToolDefinition, APIResponse } from '../types/index.js';

function debugLog(category: string, data: any): void {
  if (DEBUG_MODE) {
    console.log(`\n🐛 DEBUG [${category}]:`);
    console.log(JSON.stringify(data, null, 2));
    console.log('─'.repeat(50));
  }
}

export async function makeAPIRequest(messages: ChatMessage[], tools: ToolDefinition[], abortSignal?: AbortSignal): Promise<ChatMessage> {
  const cleanMessages = messages.filter(msg =>
    msg.content && msg.content.trim() !== '' &&
    ['system', 'user', 'assistant', 'tool'].includes(msg.role)
  );

  debugLog('MESSAGE_HISTORY', {
    totalMessages: messages.length,
    cleanMessages: cleanMessages.length,
    lastFewMessages: cleanMessages.slice(-3)
  });

  const requestBody = {
    model: 'gpt-3.5-turbo',
    messages: cleanMessages,
    max_tokens: 2048,
    temperature: 0.7,
    stream: false,
    tools: tools,
    tool_choice: 'auto'
  };

  debugLog('API_REQUEST', {
    url: `${API_BASE_URL}/v1/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: requestBody
  });

  const config: any = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (abortSignal) {
    config.signal = abortSignal;
  }
  
  const response: AxiosResponse<APIResponse> = await axios.post(`${API_BASE_URL}/v1/chat/completions`, requestBody, config);

  debugLog('API_RESPONSE', {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data
  });

  return response.data.choices[0].message;
}

export async function testConnection(): Promise<AxiosResponse> {
  return await axios.get(`${API_BASE_URL}/v1/models`, { timeout: 5000 });
}