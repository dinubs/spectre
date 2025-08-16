export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[] | undefined;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string | object;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required: string[];
    };
  };
}

export interface APIResponse {
  choices: Array<{
    message: ChatMessage;
  }>;
}

export interface SearchResult {
  lineNumber: number;
  content: string;
}

export interface SearchResults {
  [filename: string]: SearchResult[];
}