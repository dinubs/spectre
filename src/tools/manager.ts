import { DEBUG_MODE } from '../config/constants.js';
import { ToolDefinition, ToolCall } from '../types/index.js';
import { searchCodebase } from '../../tools/search.js';
import { getCodeContext } from '../../tools/context.js';
import { patchFile, rollbackPatch, PatchRequest } from './patch.js';
import { getDirectoryStructure } from './directory.js';
import { createItem, createMultipleItems, createProjectStructure, createDirectoryScaffold, createEmptyFiles, CreateItemRequest } from './create.js';

function debugLog(category: string, data: any): void {
  if (DEBUG_MODE) {
    console.log(`\n🐛 DEBUG [${category}]:`);
    console.log(JSON.stringify(data, null, 2));
    console.log('─'.repeat(50));
  }
}

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "search_codebase",
        description: "Search through the codebase content for specific code patterns, functions, variables, or text. Returns actual code snippets with line numbers and file locations.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term to find in code content (e.g., function names, variable names, class names, comments, or any text)"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "code_context",
        description: "Get detailed code context around a specific line in a file. Shows 20 lines before and after the target line to understand the surrounding code structure.",
        parameters: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Path to the file (e.g., 'src/components/Button.js' or 'index.js')"
            },
            line: {
              type: "number",
              description: "Line number to get context around"
            }
          },
          required: ["file", "line"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "patch_file",
        description: "Apply targeted patches to files with precise line-based operations. Supports replace, insert, and delete operations. Creates automatic backups and validates changes before applying. Changes array should contain objects with: action (replace/insert/delete), lineStart (number), lineEnd (number, optional), content (string, not for delete)",
        parameters: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: "Path to the file to patch (e.g., 'src/components/Button.js')"
            },
            changes: {
              type: "array",
              description: "Array of patch operations. Each item has: action (replace/insert/delete), lineStart (1-based line number), lineEnd (optional, for multi-line operations), content (new text, not used for delete)"
            }
          },
          required: ["file", "changes"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "rollback_patch",
        description: "Rollback a file to its state before the last patch operation using the backup file.",
        parameters: {
          type: "object",
          properties: {
            backupPath: {
              type: "string",
              description: "Path to the backup file (returned from patch_file operation)"
            },
            originalPath: {
              type: "string",
              description: "Path to the original file to restore"
            }
          },
          required: ["backupPath", "originalPath"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "directory_structure",
        description: "Get a tree-like structure of a directory up to 3 levels deep. Respects .gitignore rules and shows both files and folders with clear hierarchy.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the directory to analyze (optional, defaults to current working directory)"
            },
            maxDepth: {
              type: "number",
              description: "Maximum depth to traverse (optional, defaults to 3)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_item",
        description: "Create a new file or directory in the project. Automatically creates parent directories if needed. Supports file content and overwrite options.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path where to create the file or directory (relative to project root)"
            },
            type: {
              type: "string",
              description: "Type of item to create: 'file' or 'directory'"
            },
            content: {
              type: "string",
              description: "Content for the file (only used when type is 'file'). Optional, defaults to empty."
            },
            overwrite: {
              type: "boolean",
              description: "Whether to overwrite if item already exists. Defaults to false."
            }
          },
          required: ["path", "type"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_multiple_items",
        description: "Create multiple files and directories in a single operation. Useful for setting up project structures or multiple related files.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Array of items to create. Each item should have path, type, and optionally content and overwrite properties."
            }
          },
          required: ["items"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_project_structure",
        description: "Create a complete project structure with directories and empty files only. Use patch_file afterward to add content to files. This avoids JSON size limits.",
        parameters: {
          type: "object",
          properties: {
            structure: {
              type: "object",
              description: "Object where keys are paths and values are either 'directory' or 'file'. Files are created empty."
            }
          },
          required: ["structure"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_directory_scaffold",
        description: "Create multiple directories at once. Useful for setting up folder structure quickly.",
        parameters: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              description: "Array of directory paths to create"
            }
          },
          required: ["paths"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_empty_files",
        description: "Create multiple empty files at once. Use patch_file afterward to add content. This is efficient for setting up file structure without hitting JSON limits.",
        parameters: {
          type: "object",
          properties: {
            paths: {
              type: "array",
              description: "Array of file paths to create (as empty files)"
            }
          },
          required: ["paths"]
        }
      }
    }
  ];
}

export async function executeTool(toolCall: ToolCall): Promise<string> {
  const { name, arguments: args } = toolCall.function;

  debugLog('TOOL_EXECUTION_START', {
    toolName: name,
    rawArguments: args,
    argumentsType: typeof args
  });

  let props: any;
  try {
    props = typeof args === 'string' ? JSON.parse(args) : args;
    debugLog('PARSED_ARGUMENTS', props);
  } catch (parseError) {
    debugLog('PARSE_ERROR', {
      error: (parseError as Error).message,
      rawArgs: args
    });
    return `Failed to parse tool arguments: ${(parseError as Error).message}`;
  }

  try {
    let result: string;
    switch (name) {
      case 'search_codebase':
        result = await searchCodebase(props.query);
        break;
      case 'code_context':
        result = await getCodeContext(props.file, props.line);
        break;
      case 'patch_file':
        const patchRequest: PatchRequest = {
          file: props.file,
          changes: props.changes
        };
        const patchResult = await patchFile(patchRequest);

        // Format user-friendly result
        let formattedResult = '';
        if (patchResult.success) {
          formattedResult = `✅ Successfully applied ${patchResult.appliedChanges} changes to ${props.file}\n`;
          if (patchResult.appliedChanges > 0) {
            formattedResult += `📝 Changes made:\n`;
            for (let i = 0; i < props.changes.length; i++) {
              const change = props.changes[i];
              if (i < patchResult.appliedChanges) { // Only show applied changes
                formattedResult += `- ${change.action} at line ${change.lineStart}`;
                if (change.action === 'replace' || change.action === 'insert') {
                  formattedResult += ` (\n${change.content}\n)`;
                }
                formattedResult += '\n';
              }
            }
          }
        } else {
          formattedResult = `❌ Patch failed: ${patchResult.message}\n`;
          if (patchResult.failedChanges && patchResult.failedChanges.length > 0) {
            formattedResult += `Failed changes:\n`;
            for (const change of patchResult.failedChanges) {
              formattedResult += `- ${change.action} at line ${change.lineStart}\n`;
            }
          }
        }

        result = formattedResult;
        break;
      case 'rollback_patch':
        const rollbackResult = await rollbackPatch(props.backupPath, props.originalPath);
        result = JSON.stringify(rollbackResult, null, 2);
        break;
      case 'directory_structure':
        result = await getDirectoryStructure({
          path: props.path,
          maxDepth: props.maxDepth
        });
        break;
      case 'create_item':
        const createRequest: CreateItemRequest = {
          path: props.path,
          type: props.type,
          content: props.content,
          overwrite: props.overwrite
        };
        const createResult = await createItem(createRequest);
        result = JSON.stringify(createResult, null, 2);
        break;
      case 'create_multiple_items':
        const multipleResults = await createMultipleItems(props.items);
        result = JSON.stringify(multipleResults, null, 2);
        break;
      case 'create_project_structure':
        const structureResults = await createProjectStructure(props.structure);
        result = JSON.stringify(structureResults, null, 2);
        break;
      case 'create_directory_scaffold':
        const scaffoldResults = await createDirectoryScaffold(props.paths);
        result = JSON.stringify(scaffoldResults, null, 2);
        break;
      case 'create_empty_files':
        const emptyFileResults = await createEmptyFiles(props.paths);
        result = JSON.stringify(emptyFileResults, null, 2);
        break;
      default:
        result = `Unknown tool: ${name}`;
    }

    debugLog('TOOL_EXECUTION_SUCCESS', {
      toolName: name,
      resultLength: result?.length || 0
    });

    return result;
  } catch (error) {
    debugLog('TOOL_EXECUTION_ERROR', {
      toolName: name,
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    return `Tool execution failed: ${(error as Error).message}`;
  }
}
