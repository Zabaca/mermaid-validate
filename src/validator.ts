import { JSDOM } from "jsdom";

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

export interface ValidationResult {
	valid: boolean;
	blockIndex: number;
	error?: string;
	lineNumber?: number;
	fence?: string;
}

/**
 * Fence languages treated as mermaid by default. `kroki-mermaid` matches the
 * Backstage/Kroki convention of prefixing the renderer name.
 */
export const DEFAULT_FENCES: readonly string[] = ["mermaid", "kroki-mermaid"];

export interface FileValidationResult {
	filePath: string;
	blocks: ValidationResult[];
	totalBlocks: number;
	validBlocks: number;
	invalidBlocks: number;
}

/**
 * Validate a single mermaid diagram
 */
export async function validateDiagram(
	code: string,
): Promise<{ valid: boolean; error?: string }> {
	try {
		await mermaid.parse(code);
		return { valid: true };
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		return { valid: false, error };
	}
}

export interface MermaidBlock {
	code: string;
	startLine: number;
	fence: string;
}

/**
 * Extract mermaid blocks from markdown content.
 *
 * A block opens when a fence's language token (the first word after the
 * backticks) matches one of `fences`, so `\`\`\`mermaid title` still matches
 * while `\`\`\`mermaidjs` does not.
 */
export function extractMermaidBlocks(
	content: string,
	fences: readonly string[] = DEFAULT_FENCES,
): MermaidBlock[] {
	const blocks: MermaidBlock[] = [];
	const lines = content.split("\n");

	let inBlock = false;
	let currentFence = "";
	let blockStart = 0;
	let blockLines: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!inBlock && trimmed.startsWith("```")) {
			const token = trimmed.slice(3).trim().split(/\s+/)[0];
			if (token !== undefined && fences.includes(token)) {
				inBlock = true;
				currentFence = token;
				blockStart = i + 1;
				blockLines = [];
			}
		} else if (inBlock && trimmed === "```") {
			inBlock = false;
			blocks.push({
				code: blockLines.join("\n").trim(),
				startLine: blockStart + 1, // 1-indexed
				fence: currentFence,
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
	fences: readonly string[] = DEFAULT_FENCES,
): Promise<FileValidationResult> {
	const content = await Bun.file(filePath).text();
	const blocks = extractMermaidBlocks(content, fences);

	const results: ValidationResult[] = [];

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		const result = await validateDiagram(block.code);

		results.push({
			valid: result.valid,
			blockIndex: i + 1,
			error: result.error,
			lineNumber: block.startLine,
			fence: block.fence,
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
	const result = await validateDiagram(content);

	return {
		valid: result.valid,
		blockIndex: 1,
		error: result.error,
		lineNumber: 1,
	};
}
