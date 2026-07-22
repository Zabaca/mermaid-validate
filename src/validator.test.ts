import { describe, expect, test } from "bun:test";
import {
	extractMermaidBlocks,
	validateDiagram,
	validateFile,
} from "./validator";

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
		expect(result.error?.raw).toContain("Parse error");
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
});

describe("error diagnostics", () => {
	test("structures parse errors as message, raw, lines, recommendations", async () => {
		const result = await validateDiagram(`graph TD
    A[Function uuid() here] --> B[End]`);
		expect(result.valid).toBe(false);
		expect(result.error?.message).toBe("Parse error on line 2");
		expect(result.error?.raw).toContain("got 'PS'");
		expect(result.error?.lines.diagram).toBe(2);
		expect(result.error?.recommendations.length).toBeGreaterThan(0);
	});

	test("recommends quoting labels that contain parentheses", async () => {
		const result = await validateDiagram(`graph TD
    A[Function uuid() here] --> B`);
		expect(result.error?.recommendations[0]).toContain("double quotes");
	});

	test("recommends quoting labels that contain pipes", async () => {
		const result = await validateDiagram(`graph TD
    A[a|b] --> B`);
		expect(result.error?.recommendations[0]).toContain("pipe");
	});

	test("explains dangling arrows", async () => {
		const result = await validateDiagram(`graph TD
    A --> --> B`);
		expect(result.error?.recommendations[0]).toContain("both sides");
	});

	test("suggests the nearest diagram type for a typo", async () => {
		const result = await validateDiagram(`sequenceDiagam
    Alice->>Bob: Hello`);
		expect(result.error?.recommendations[0]).toContain(
			'did you mean "sequenceDiagram"',
		);
	});

	test("always offers at least one recommendation", async () => {
		const result = await validateDiagram(`graph TD
    A[Unclosed --> B`);
		expect(result.error?.recommendations.length).toBeGreaterThan(0);
	});

	test("maps parser line numbers to absolute file lines via validateFile", async () => {
		const content = `# Doc

\`\`\`mermaid
graph TD
    A[Function uuid() here] --> B
\`\`\`
`;
		const path = `${import.meta.dir}/../.tmp-structured-errors-test.md`;
		await Bun.write(path, content);
		try {
			const result = await validateFile(path);
			const block = result.blocks[0];
			// Block starts at file line 4; the parse error is on diagram line 2.
			expect(block.lineNumber).toBe(4);
			expect(block.error?.lines.diagram).toBe(2);
			expect(block.error?.lines.file).toBe(5);
		} finally {
			await Bun.file(path).delete();
		}
	});
});
