import { JSDOM } from "jsdom";
import { type DiagnosticError, diagnoseError } from "./diagnostics";

// Setup DOM environment before importing mermaid
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
	pretendToBeVisual: true,
});

// biome-ignore lint/suspicious/noExplicitAny: DOM globals need any type
(globalThis as any).window = dom.window;
// biome-ignore lint/suspicious/noExplicitAny: DOM globals need any type
(globalThis as any).document = dom.window.document;
// biome-ignore lint/suspicious/noExplicitAny: DOM globals need any type
(globalThis as any).DOMParser = dom.window.DOMParser;

// Dynamic import after DOM setup
const mermaid = (await import("mermaid")).default;
mermaid.initialize({ startOnLoad: false });

export type { DiagnosticError } from "./diagnostics";

export interface ValidationResult {
	valid: boolean;
	blockIndex: number;
	error?: DiagnosticError;
	lineNumber?: number;
}

export interface FileValidationResult {
	filePath: string;
	blocks: ValidationResult[];
	totalBlocks: number;
	validBlocks: number;
	invalidBlocks: number;
}

/**
 * Validate a single mermaid diagram. Pass `fileStartLine` (the 1-indexed
 * file line of the diagram's first line) to get absolute file positions in
 * the diagnostic.
 */
export async function validateDiagram(
	code: string,
	fileStartLine?: number,
): Promise<{ valid: boolean; error?: DiagnosticError }> {
	try {
		await mermaid.parse(code);
		return { valid: true };
	} catch (e) {
		const raw = e instanceof Error ? e.message : String(e);
		return { valid: false, error: diagnoseError(raw, fileStartLine) };
	}
}

/**
 * Extract mermaid blocks from markdown content
 */
export function extractMermaidBlocks(
	content: string,
): { code: string; startLine: number }[] {
	const blocks: { code: string; startLine: number }[] = [];
	const lines = content.split("\n");

	let inBlock = false;
	let blockStart = 0;
	let blockLines: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.trim().startsWith("```mermaid")) {
			inBlock = true;
			blockStart = i + 1;
			blockLines = [];
		} else if (inBlock && line.trim() === "```") {
			inBlock = false;
			blocks.push({
				code: blockLines.join("\n").trim(),
				startLine: blockStart + 1, // 1-indexed
			});
		} else if (inBlock) {
			blockLines.push(line);
		}
	}

	return blocks;
}

/**
 * Validate all mermaid blocks in a markdown file
 */
export async function validateFile(
	filePath: string,
): Promise<FileValidationResult> {
	const content = await Bun.file(filePath).text();
	const blocks = extractMermaidBlocks(content);

	const results: ValidationResult[] = [];

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		const result = await validateDiagram(block.code, block.startLine);

		results.push({
			valid: result.valid,
			blockIndex: i + 1,
			error: result.error,
			lineNumber: block.startLine,
		});
	}

	return {
		filePath,
		blocks: results,
		totalBlocks: blocks.length,
		validBlocks: results.filter((r) => r.valid).length,
		invalidBlocks: results.filter((r) => !r.valid).length,
	};
}

/**
 * Validate a standalone .mmd file
 */
export async function validateMmdFile(
	filePath: string,
): Promise<ValidationResult> {
	const content = await Bun.file(filePath).text();
	const result = await validateDiagram(content, 1);

	return {
		valid: result.valid,
		blockIndex: 1,
		error: result.error,
		lineNumber: 1,
	};
}
