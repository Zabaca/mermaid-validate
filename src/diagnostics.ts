/**
 * Turns raw mermaid parser output into a structured, actionable error.
 */
export interface DiagnosticError {
	/** One-line summary (the first line of the parser output). */
	message: string;
	/** Full parser output, verbatim. */
	raw: string;
	/**
	 * Where the problem is. `diagram` is 1-indexed within the diagram source;
	 * `file` is the absolute line in the containing file when known.
	 */
	lines: { diagram?: number; file?: number };
	/** Human-readable fixes, most likely first. Never empty. */
	recommendations: string[];
}

const DIAGRAM_TYPES = [
	"flowchart",
	"graph",
	"sequenceDiagram",
	"classDiagram",
	"stateDiagram",
	"stateDiagram-v2",
	"erDiagram",
	"journey",
	"gantt",
	"pie",
	"quadrantChart",
	"requirementDiagram",
	"gitGraph",
	"C4Context",
	"mindmap",
	"timeline",
	"zenuml",
	"sankey-beta",
	"xychart-beta",
	"block-beta",
	"packet-beta",
	"kanban",
	"architecture-beta",
];

const FALLBACK_RECOMMENDATION =
	"Compare the block against the syntax reference at https://mermaid.js.org/intro/syntax-reference.html";

/**
 * Patterns are matched against the parser's `got 'TOKEN'` output, which is
 * stable per mistake class (see examples/broken-diagram.md for worked cases).
 */
function recommendationsFor(raw: string): string[] {
	const recommendations: string[] = [];

	if (raw.includes("got 'PS'")) {
		recommendations.push(
			'Wrap the label in double quotes — an unquoted "(" starts a new shape: A["Function uuid() here"]',
		);
	}

	if (raw.includes("got 'PIPE'")) {
		recommendations.push(
			'Wrap the label in double quotes — an unquoted pipe starts an edge label: A["a|b"]',
		);
	}

	if (raw.includes("got 'LINK'")) {
		recommendations.push(
			"An arrow needs a node on both sides — remove the extra arrow or add the missing node",
		);
	}

	const noType = raw.match(/No diagram type detected.*for text:\s*(\S+)/);
	if (noType?.[1] !== undefined) {
		const typo = noType[1];
		const nearest = nearestDiagramType(typo);
		recommendations.push(
			nearest !== undefined
				? `Unknown diagram type "${typo}" — did you mean "${nearest}"?`
				: `Unknown diagram type "${typo}" — see https://mermaid.js.org/intro/ for supported types`,
		);
	}

	if (recommendations.length === 0 && raw.includes("Expecting 'SQE'")) {
		recommendations.push(
			"A node label may be unclosed — check that every [, (, and { has a matching closer, and quote labels containing special characters",
		);
	}

	if (recommendations.length === 0) {
		recommendations.push(FALLBACK_RECOMMENDATION);
	}

	return recommendations;
}

function nearestDiagramType(typo: string): string | undefined {
	let best: string | undefined;
	let bestDistance = 4; // only suggest close matches

	for (const type of DIAGRAM_TYPES) {
		const distance = levenshtein(typo.toLowerCase(), type.toLowerCase());
		if (distance < bestDistance) {
			bestDistance = distance;
			best = type;
		}
	}

	return best;
}

function levenshtein(a: string, b: string): number {
	const previous = new Array<number>(b.length + 1);
	const current = new Array<number>(b.length + 1);

	for (let j = 0; j <= b.length; j++) {
		previous[j] = j;
	}

	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
		}
		previous.splice(0, previous.length, ...current);
	}

	return previous[b.length];
}

/**
 * Build a structured error from raw parser output. `fileStartLine` is the
 * 1-indexed file line of the diagram's first line, when the diagram came
 * from a file.
 */
export function diagnoseError(
	raw: string,
	fileStartLine?: number,
): DiagnosticError {
	const firstLine = raw.split("\n")[0]?.replace(/:$/, "") ?? raw;

	const lineMatch = raw.match(/Parse error on line (\d+)/);
	const diagramLine =
		lineMatch?.[1] !== undefined
			? Number.parseInt(lineMatch[1], 10)
			: undefined;

	const lines: DiagnosticError["lines"] = {};
	if (diagramLine !== undefined) {
		lines.diagram = diagramLine;
	}
	if (fileStartLine !== undefined) {
		lines.file = fileStartLine + (diagramLine ?? 1) - 1;
	}

	return {
		message: firstLine,
		raw,
		lines,
		recommendations: recommendationsFor(raw),
	};
}
