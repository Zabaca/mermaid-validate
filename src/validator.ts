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
}

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

const FENCE_LINE = /^(`{3,})(.*)$/;

/**
 * Extract mermaid blocks from markdown content.
 *
 * Fences are tracked CommonMark-style: a fence only closes on a line with a
 * run of at least as many backticks as opened it. Without this, a mermaid
 * example shown inside a longer outer fence (e.g. a four-backtick
 * ` ```` markdown ` block used to document mermaid syntax) is wrongly
 * treated as a live diagram and validated (and typically fails, since such
 * examples are often deliberately broken for illustration).
 */
export function extractMermaidBlocks(
	content: string,
): { code: string; startLine: number }[] {
	const blocks: { code: string; startLine: number }[] = [];
	const lines = content.split("\n");

	let open: { size: number; isMermaid: boolean; startLine: number } | null =
		null;
	let blockLines: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.trim().match(FENCE_LINE);

		if (open === null) {
			const info = match?.[2]?.trim();
			// Backtick-fence info strings cannot themselves contain backticks
			if (match !== null && info !== undefined && !info.includes("`")) {
				open = {
					size: match[1]?.length ?? 3,
					isMermaid: info.startsWith("mermaid"),
					startLine: i + 2, // 1-indexed first content line
				};
				blockLines = [];
			}
		} else if (
			match !== null &&
			(match[1]?.length ?? 0) >= open.size &&
			match[2]?.trim() === ""
		) {
			if (open.isMermaid) {
				blocks.push({
					code: blockLines.join("\n").trim(),
					startLine: open.startLine,
				});
			}
			open = null;
		} else if (open.isMermaid) {
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
		const result = await validateDiagram(block.code);

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
	const result = await validateDiagram(content);

	return {
		valid: result.valid,
		blockIndex: 1,
		error: result.error,
		lineNumber: 1,
	};
}
