// Public API exports

export { diagnoseError } from "./diagnostics";
export type {
	DiagnosticError,
	FileValidationResult,
	ValidationResult,
} from "./validator";
export {
	extractMermaidBlocks,
	validateDiagram,
	validateFile,
	validateMmdFile,
} from "./validator";
