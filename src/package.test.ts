import { afterAll, describe, expect, test } from "bun:test";

/**
 * Proves the *published* programmatic API actually works: the README has
 * always documented `import { validateDiagram } from "@zabaca/mermaid-validate"`,
 * but package.json had no main/module/types/exports and dist/index.js was
 * never built, so that import failed for every real consumer. This builds
 * dist/ exactly as `prepublishOnly` does, then imports from it in a fresh
 * process — the same thing a consumer's bundler would do.
 */

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const BUILD_TIMEOUT = 60_000;

async function run(cmd: string[]) {
	const proc = Bun.spawn(cmd, {
		cwd: REPO_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exitCode };
}

describe("published package surface", () => {
	test(
		"builds dist/index.js, dist/index.d.ts, and both are importable/usable",
		async () => {
			const build = await run(["bun", "run", "build"]);
			expect(build.exitCode).toBe(0);

			expect(await Bun.file(`${REPO_ROOT}/dist/index.js`).exists()).toBe(true);
			expect(await Bun.file(`${REPO_ROOT}/dist/index.d.ts`).exists()).toBe(
				true,
			);

			const dts = await Bun.file(`${REPO_ROOT}/dist/index.d.ts`).text();
			expect(dts).toContain("validateDiagram");
			expect(dts).toContain("validateFile");
			expect(dts).toContain("extractMermaidBlocks");

			// Import from dist/, not src/ — this is what a consumer gets.
			const mod = (await import(`${REPO_ROOT}/dist/index.js`)) as {
				validateDiagram: (
					code: string,
				) => Promise<{ valid: boolean; error?: unknown }>;
			};

			const valid = await mod.validateDiagram(
				"graph TD\n    A[Start] --> B[End]",
			);
			expect(valid.valid).toBe(true);

			const invalid = await mod.validateDiagram("graph TD\n    A --> --> B");
			expect(invalid.valid).toBe(false);
		},
		BUILD_TIMEOUT,
	);

	test("package.json exports resolve to files that exist after build", async () => {
		const pkg = (await Bun.file(`${REPO_ROOT}/package.json`).json()) as {
			main: string;
			types: string;
			exports: { ".": { types: string; import: string } };
		};

		for (const relPath of [
			pkg.main,
			pkg.types,
			pkg.exports["."].types,
			pkg.exports["."].import,
		]) {
			const exists = await Bun.file(
				`${REPO_ROOT}/${relPath.replace(/^\.\//, "")}`,
			).exists();
			expect(exists).toBe(true);
		}
	});
});

afterAll(async () => {
	await run(["rm", "-rf", `${REPO_ROOT}/dist`]);
});
