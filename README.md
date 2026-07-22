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

### `--json` output

`--json` emits one result per block with a structured error: a one-line
`message`, the verbatim parser output in `raw`, `lines` locating the problem,
and `recommendations` with likely fixes. In a large document this is what you
want: `lines.file` is the **absolute line in the markdown file**, so you (or
an agent, or your editor tooling) can jump straight to the failing line
instead of hunting through hundreds of lines for the right block.

```bash
mermaid-validate --json docs/architecture.md
```

```json
{
  "totalValid": 1,
  "totalInvalid": 1,
  "results": [
    {
      "file": "docs/architecture.md:block1",
      "valid": false,
      "error": {
        "message": "Parse error on line 2",
        "raw": "Parse error on line 2:\n...A[Function uuid() here] --> B[End]\n----------------------^\nExpecting 'SQE', ..., got 'PS'",
        "lines": {
          "diagram": 2,
          "file": 15
        },
        "recommendations": [
          "Wrap the label in double quotes — an unquoted \"(\" starts a new shape: A[\"Function uuid() here\"]"
        ]
      }
    }
  ]
}
```

`lines.diagram` is the 1-indexed line within the diagram itself; it is absent
when the parser doesn't report one (e.g. for an unrecognised diagram type,
where `lines.file` falls back to the block's first line). Recommendations
cover the common mistake classes — unquoted parentheses or pipes in labels,
dangling arrows, misspelled diagram types (with a did-you-mean suggestion) —
and fall back to a pointer at the mermaid syntax reference. The same
structured error is used in human-readable output as a `hint:` line below the
raw parser text, and piping from stdin returns the same shape:
`{ "valid": false, "error": { ... } }`.

### Programmatic API

```typescript
import { validateDiagram, validateFile, extractMermaidBlocks } from "@zabaca/mermaid-validate";

// Validate a single diagram
const result = await validateDiagram(`graph TD
    A[Start] --> B[End]`);
console.log(result); // { valid: true }

// Invalid diagrams come back with a structured error
const broken = await validateDiagram(`graph TD
    A --> --> B`);
console.log(broken.error?.message); // "Parse error on line 2"
console.log(broken.error?.lines); // { diagram: 2 }
console.log(broken.error?.recommendations);
// ["An arrow needs a node on both sides — ..."]

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
