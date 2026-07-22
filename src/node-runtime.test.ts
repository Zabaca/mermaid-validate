import { afterAll, describe, expect, test } from "bun:test";

/**
 * Proves the *published* CLI runs under plain Node, not just Bun. The
 * source previously called Bun.file/Bun.stdin directly, so the npm-installed
 * bin script would throw `ReferenceError: Bun is not defined` for anyone
 * without Bun on their machine — despite the README advertising a plain
 * `npm install -g` flow. This builds dist/main.js with esbuild exactly as
 * `prepublishOnly` does, then spawns it with the `node` binary specifically.
 */

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const BUILD_TIMEOUT = 30_000;

function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

async function run(cmd: string[], stdinText?: string) {
	const proc = Bun.spawn(cmd, {
		cwd: REPO_ROOT,
		stdin: stdinText === undefined ? "ignore" : Buffer.from(stdinText),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout: stripAnsi(stdout), stderr: stripAnsi(stderr), exitCode };
}

describe("dist/main.js under plain node", () => {
	test(
		"builds cleanly with esbuild",
		async () => {
			const build = await run(["bun", "run", "build"]);
			expect(build.exitCode).toBe(0);
			expect(await Bun.file(`${REPO_ROOT}/dist/main.js`).exists()).toBe(true);
		},
		BUILD_TIMEOUT,
	);

	test("validates a file when run via `node`, not `bun`", async () => {
		const result = await run([
			"node",
			"dist/main.js",
			"examples/test-diagram.md",
		]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("2 valid, 0 invalid");
	});

	test("reads stdin correctly when run via `node`", async () => {
		const result = await run(["node", "dist/main.js", "-"], "graph TD; A-->B");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Valid");
	});

	test("reports --version correctly when run via `node`", async () => {
		const pkg = (await Bun.file(`${REPO_ROOT}/package.json`).json()) as {
			version: string;
		};
		const result = await run(["node", "dist/main.js", "--version"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe(pkg.version);
	});

	test("expands a directory correctly when run via `node`", async () => {
		const result = await run(["node", "dist/main.js", "examples/"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("test-diagram.md:block1");
	});
});

afterAll(async () => {
	await run(["rm", "-rf", `${REPO_ROOT}/dist`]);
});
