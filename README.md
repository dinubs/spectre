# Spectre

<img width="824" height="325" alt="image" src="https://github.com/user-attachments/assets/6debeaa7-8e20-43ad-aef4-b3addd7129bc" />

Spectre is a powerful CLI tool designed for interacting with llama.cpp servers. It provides an intuitive interface for working with local AI models, making it easy to run, manage, and interact with language models without needing complex setup.

## Features

- **CLI Interface**: Intuitive command-line interface for interacting with AI models
- **Local Model Support**: Works seamlessly with llama.cpp models
- **Chat Interface**: Provides a chat-like experience for conversations with AI models
- **Prompt Management**: Easily manage and organize your prompts
- **Tool Integration**: Built-in tools for code generation, directory management, and more

## Installation

```bash
# Install via npm
npm install -g spectre

# Or clone and build locally
 git clone <repository-url>
 cd spectre
 npm install
 npm run build
```

## Usage

```bash
# Start the CLI
spectre

# Or run directly with Node
npm run dev
```

## Project Structure

```
src/
├── api/           # API client for communicating with llama.cpp server
├── chat/          # Chat interface components
├── config/        # Configuration constants
├── tools/         # Utility tools for file operations, patching, etc.
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## How It Works

Spectre works by:

1. Connecting to a local llama.cpp server
2. Providing a user-friendly CLI interface
3. Managing prompts and chat history
4. Handling model interactions through HTTP requests
5. Offering tooling for code generation and file management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
