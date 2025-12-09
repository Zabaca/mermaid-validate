#!/usr/bin/env bun
import { glob } from "glob";
import { validateDiagram, validateFile, validateMmdFile } from "./validator";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function printUsage() {
	console.log(`
Usage: mermaid-validate [options] <file|directory|->

Validate Mermaid diagram syntax using the official mermaid parser.

Arguments:
  <file>        Validate a single .md or .mmd file
  <directory>   Recursively validate all .md/.mmd files
  -             Read from stdin

Options:
  -h, --help     Show this help message
  -v, --version  Show version
  -q, --quiet    Only output errors
  --json         Output results as JSON

Examples:
  mermaid-validate README.md
  mermaid-validate docs/
  mermaid-validate diagram.mmd
  echo "graph TD; A-->B" | mermaid-validate -
`);
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
		printUsage();
		process.exit(0);
	}

	if (args.includes("-v") || args.includes("--version")) {
		const pkg = await Bun.file(
			new URL("../package.json", import.meta.url),
		).json();
		console.log(pkg.version);
		process.exit(0);
	}

	const quiet = args.includes("-q") || args.includes("--quiet");
	const jsonOutput = args.includes("--json");

	// Filter out flags (but keep "-" for stdin)
	const paths = args.filter((a) => a === "-" || !a.startsWith("-"));

	if (paths.length === 0) {
		console.error(`${RED}Error: No file or directory specified${RESET}`);
		process.exit(1);
	}

	const input = paths[0];

	// Handle stdin
	if (input === "-") {
		const stdin = await Bun.stdin.text();
		const result = await validateDiagram(stdin);

		if (jsonOutput) {
			console.log(
				JSON.stringify({ valid: result.valid, error: result.error }, null, 2),
			);
		} else if (result.valid) {
			console.log(`${GREEN}Valid${RESET}`);
		} else {
			console.log(`${RED}Invalid${RESET}`);
			console.log(result.error);
		}

		process.exit(result.valid ? 0 : 1);
	}

	// Check if path exists
	const file = Bun.file(input);
	const stat = await file.exists();

	let files: string[] = [];

	if (!stat) {
		// Try as glob pattern
		files = await glob(input, { nodir: true });
		if (files.length === 0) {
			console.error(
				`${RED}Error: File or directory not found: ${input}${RESET}`,
			);
			process.exit(1);
		}
	} else {
		// Check if directory
		const isDir = await Bun.file(input)
			.text()
			.then(() => false)
			.catch(() => true);

		if (isDir) {
			files = await glob(`${input}/**/*.{md,mmd,markdown,mdx}`, {
				nodir: true,
			});
		} else {
			files = [input];
		}
	}

	if (files.length === 0) {
		console.log(`${YELLOW}No markdown files found${RESET}`);
		process.exit(0);
	}

	let totalValid = 0;
	let totalInvalid = 0;
	const allResults: Array<{ file: string; valid: boolean; error?: string }> =
		[];

	for (const filePath of files) {
		const isMmd = filePath.endsWith(".mmd") || filePath.endsWith(".mermaid");

		if (isMmd) {
			const result = await validateMmdFile(filePath);

			if (result.valid) {
				totalValid++;
				if (!quiet && !jsonOutput) {
					console.log(`${GREEN}✓${RESET} ${filePath}`);
				}
			} else {
				totalInvalid++;
				if (!jsonOutput) {
					console.log(`${RED}✗${RESET} ${filePath}`);
					const errorLines = result.error?.split("\n").slice(0, 5) || [];
					for (const line of errorLines) {
						console.log(`  ${line}`);
					}
				}
			}

			allResults.push({
				file: filePath,
				valid: result.valid,
				error: result.error,
			});
		} else {
			const result = await validateFile(filePath);

			if (result.totalBlocks === 0) {
				continue; // Skip files with no mermaid blocks
			}

			for (const block of result.blocks) {
				if (block.valid) {
					totalValid++;
					if (!quiet && !jsonOutput) {
						console.log(
							`${GREEN}✓${RESET} ${filePath}:block${block.blockIndex}`,
						);
					}
				} else {
					totalInvalid++;
					if (!jsonOutput) {
						console.log(
							`${RED}✗${RESET} ${filePath}:block${block.blockIndex} (line ${block.lineNumber})`,
						);
						const errorLines = block.error?.split("\n").slice(0, 5) || [];
						for (const line of errorLines) {
							console.log(`  ${line}`);
						}
					}
				}

				allResults.push({
					file: `${filePath}:block${block.blockIndex}`,
					valid: block.valid,
					error: block.error,
				});
			}
		}
	}

	if (jsonOutput) {
		console.log(
			JSON.stringify(
				{
					totalValid,
					totalInvalid,
					results: allResults,
				},
				null,
				2,
			),
		);
	} else {
		console.log("");
		console.log(
			`Summary: ${GREEN}${totalValid} valid${RESET}, ${totalInvalid > 0 ? RED : ""}${totalInvalid} invalid${RESET}`,
		);
	}

	process.exit(totalInvalid > 0 ? 1 : 0);
}

main().catch((e) => {
	console.error(`${RED}Error: ${e.message}${RESET}`);
	process.exit(1);
});
