import { describe, expect, test } from "bun:test";

/**
 * CLI acceptance tests. Regression coverage for: the CLI used to validate
 * only args[0], silently ignoring every other path, and unknown flags were
 * silently swallowed instead of erroring.
 */

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const CLI_TIMEOUT = 30_000;

interface CliRun {
	exitCode: number;
	stdout: string;
	stderr: string;
}

async function runCli(args: string[]): Promise<CliRun> {
	const proc = Bun.spawn(["bun", "run", "src/main.ts", ...args], {
		cwd: REPO_ROOT,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { exitCode, stdout: stripAnsi(stdout), stderr: stripAnsi(stderr) };
}

function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("CLI: multiple path arguments", () => {
	test(
		"validates every path when given more than one",
		async () => {
			const run = await runCli([
				"examples/test-diagram.md",
				"examples/test-diagram.md",
			]);
			expect(run.exitCode).toBe(0);
			expect(run.stdout).toContain("✓ examples/test-diagram.md:block1");
			// The second path is the same file; de-duplication keeps the
			// summary at 2 valid rather than double-counting to 4.
			expect(run.stdout).toContain("Summary: 2 valid, 0 invalid");
		},
		CLI_TIMEOUT,
	);
});

describe("CLI: unknown options", () => {
	test(
		"errors instead of silently ignoring an unrecognised flag",
		async () => {
			const run = await runCli(["--nope", "examples/test-diagram.md"]);
			expect(run.exitCode).toBe(1);
			expect(run.stderr).toContain("Unknown option: --nope");
		},
		CLI_TIMEOUT,
	);
});

describe("CLI: baseline", () => {
	test(
		"still validates a single file (no regression)",
		async () => {
			const run = await runCli(["examples/test-diagram.md"]);
			expect(run.exitCode).toBe(0);
			expect(run.stdout).toContain("Summary: 2 valid, 0 invalid");
		},
		CLI_TIMEOUT,
	);

	test(
		"exits 1 with a clear error for a missing path",
		async () => {
			const run = await runCli(["no-such-file.md"]);
			expect(run.exitCode).toBe(1);
			expect(run.stderr).toContain("File or directory not found");
		},
		CLI_TIMEOUT,
	);
});
