// Public API exports

export type {
	FileValidationResult,
	MermaidBlock,
	ValidationResult,
} from "./validator";
export {
	DEFAULT_FENCES,
	extractMermaidBlocks,
	validateDiagram,
	validateFile,
	validateMmdFile,
} from "./validator";
