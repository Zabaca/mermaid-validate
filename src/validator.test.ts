import { describe, expect, test } from "bun:test";
import {
	extractMermaidBlocks,
	validateDiagram,
	validateFile,
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

	test("should extract kroki-mermaid blocks by default", () => {
		const content = `\`\`\`kroki-mermaid
graph LR
    A --> B
\`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(1);
		expect(blocks[0].fence).toBe("kroki-mermaid");
		expect(blocks[0].code).toBe("graph LR\n    A --> B");
	});

	test("should match fences with trailing attributes", () => {
		const content = `\`\`\`mermaid title="flow"
graph TD
    A --> B
\`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(1);
	});

	test("should not match fences whose token merely starts with mermaid", () => {
		const content = `\`\`\`mermaidjs
graph TD
    A --> B
\`\`\``;

		const blocks = extractMermaidBlocks(content);
		expect(blocks.length).toBe(0);
	});

	test("should support custom fence lists", () => {
		const content = `\`\`\`backstage-mermaid
graph TD
    A --> B
\`\`\`

\`\`\`mermaid
graph TD
    C --> D
\`\`\``;

		const blocks = extractMermaidBlocks(content, ["backstage-mermaid"]);
		expect(blocks.length).toBe(1);
		expect(blocks[0].fence).toBe("backstage-mermaid");
	});
});

describe("validateFile with kroki-mermaid fences", () => {
	test("should validate kroki-mermaid fences without extra configuration", async () => {
		const result = await validateFile(examplePath("kroki-diagram.md"));
		expect(result.totalBlocks).toBe(2);
		expect(result.validBlocks).toBe(2);
		expect(result.blocks[0].fence).toBe("kroki-mermaid");
	});

	test("should respect a custom fence list", async () => {
		const result = await validateFile(examplePath("kroki-diagram.md"), [
			"mermaid",
		]);
		expect(result.totalBlocks).toBe(1);
		expect(result.blocks[0].fence).toBe("mermaid");
	});
});
