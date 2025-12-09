# @zabaca/mermaid-validate

Lightweight Mermaid diagram syntax validator using the official mermaid parser.

## Why?

Existing mermaid validators either:
- Require a full browser/puppeteer setup (heavy)
- Have version compatibility issues
- Are overly strict about valid syntax

This package uses the official `mermaid` parser with `jsdom` for minimal DOM simulation, giving you accurate validation without the heavyweight dependencies.

## Installation

```bash
# npm
npm install -g @zabaca/mermaid-validate

# bun
bun add -g @zabaca/mermaid-validate
```

## Usage

### CLI

```bash
# Validate a markdown file
mermaid-validate README.md

# Validate a standalone .mmd file
mermaid-validate diagram.mmd

# Validate all files in a directory
mermaid-validate docs/

# Validate from stdin
echo "graph TD; A-->B" | mermaid-validate -

# JSON output
mermaid-validate --json README.md

# Quiet mode (only errors)
mermaid-validate -q docs/
```

### Programmatic API

```typescript
import { validateDiagram, validateFile, extractMermaidBlocks } from "@zabaca/mermaid-validate";

// Validate a single diagram
const result = await validateDiagram(`graph TD
    A[Start] --> B[End]`);
console.log(result); // { valid: true }

// Validate a markdown file
const fileResult = await validateFile("docs/architecture.md");
console.log(fileResult);
// {
//   filePath: "docs/architecture.md",
//   blocks: [...],
//   totalBlocks: 2,
//   validBlocks: 2,
//   invalidBlocks: 0
// }

// Extract mermaid blocks from markdown
const blocks = extractMermaidBlocks(markdownContent);
```

## Exit Codes

- `0` - All diagrams valid
- `1` - One or more diagrams invalid

## Supported Diagram Types

All diagram types supported by mermaid:
- Flowchart / Graph
- Sequence Diagram
- Class Diagram
- State Diagram
- Entity Relationship Diagram
- Gantt Chart
- Pie Chart
- And more...

## License

MIT
