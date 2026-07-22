import { describe, expect, test } from "bun:test";
import {
	extractMermaidBlocks,
	validateDiagram,
	validateFile,
	validateMmdFile,
} from "./validator";

const examplePath = (name: string) =>
	new URL(`../examples/${name}`, import.meta.url).pathname;

describe("validateDiagram", () => {
	test("should validate correct flowchart syntax", async () => {
		const result = await validateDiagram(`graph TD
    A[Start] --> B[End]`);
		expect(result.valid).toBe(true);
	});

	test("should validate quoted multiline labels", async () => {
		const result = await validateDiagram(`graph TB
    A["Line 1
    Line 2
    Line 3"]`);
		expect(result.valid).toBe(true);
	});

	test("should reject unquoted parentheses in labels", async () => {
		const result = await validateDiagram(`graph TB
    A[Function uuid() here]`);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Parse error");
	});

	test("should validate sequence diagram", async () => {
		const result = await validateDiagram(`sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`);
		expect(result.valid).toBe(true);
	});

	test("should validate subgraphs", async () => {
		const result = await validateDiagram(`graph TB
    subgraph Group1[My Group]
        A --> B
    end`);
		expect(result.valid).toBe(true);
	});

	test("should reject invalid syntax", async () => {
		const result = await validateDiagram(`graph TD
    A --> --> B`);
		expect(result.valid).toBe(false);
	});
});

describe("extractMermaidBlocks", () => {
	test("should extract single mermaid block", () => {
		const content = `# Header

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text`;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(1);
		expect(blocks[0].code).toBe("graph TD\n    A --> B");
		expect(blocks[0].startLine).toBe(4);
	});

	test("should extract multiple mermaid blocks", () => {
		const content = `# Doc

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

\`\`\`mermaid
sequenceDiagram
    A->>B: Hi
\`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(2);
	});

	test("should ignore non-mermaid code blocks", () => {
		const content = `# Doc

\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD
    A --> B
\`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(1);
	});

	test("should handle empty content", () => {
		const blocks = extractMermaidBlocks("");
		expect(blocks.length).toBe(0);
	});

	test("should handle indented fences", () => {
		const content = `- list item

  \`\`\`mermaid
  graph TD
      A --> B
  \`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(1);
	});
});

describe("validateFile", () => {
	test("should validate every block in a markdown file and count them correctly", async () => {
		const result = await validateFile(examplePath("test-diagram.md"));
		expect(result.totalBlocks).toBe(2);
		expect(result.validBlocks).toBe(2);
		expect(result.invalidBlocks).toBe(0);
		expect(result.blocks[0].blockIndex).toBe(1);
		expect(result.blocks[1].blockIndex).toBe(2);
	});
});

describe("validateMmdFile", () => {
	test("should validate a standalone .mmd file", async () => {
		const result = await validateMmdFile(examplePath("flowchart.mmd"));
		expect(result.valid).toBe(true);
		expect(result.blockIndex).toBe(1);
		expect(result.lineNumber).toBe(1);
	});
});
