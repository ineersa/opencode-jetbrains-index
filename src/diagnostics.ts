export const MAX_DIAGNOSTICS_SUMMARY_CHARS = 4000;

export type DiagnosticSeverity = "Error" | "Warning" | "Info" | "Hint";

export interface Diagnostic {
	message: string;
	severity: DiagnosticSeverity;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	source?: string;
	code?: string;
}

export interface DiagnosticFile {
	uri: string;
	diagnostics: Diagnostic[];
}

export function areDiagnosticsEqual(a: Diagnostic, b: Diagnostic): boolean {
	return (
		a.message === b.message
		&& a.severity === b.severity
		&& a.source === b.source
		&& a.code === b.code
		&& a.range.start.line === b.range.start.line
		&& a.range.start.character === b.range.start.character
		&& a.range.end.line === b.range.end.line
		&& a.range.end.character === b.range.end.character
	);
}

export function getSeveritySymbol(severity: DiagnosticSeverity): string {
	switch (severity) {
		case "Error":
			return "✗";
		case "Warning":
			return "⚠";
		case "Info":
			return "ℹ";
		case "Hint":
			return "★";
		default:
			return "•";
	}
}

export function formatDiagnosticsSummary(files: DiagnosticFile[]): string {
	const truncationMarker = "…[truncated]";
	const result = files
		.map((file) => {
			const filename = file.uri.split(/[\\/]/).pop() || file.uri;
			const diagnostics = file.diagnostics
				.map((d) => {
					const severitySymbol = getSeveritySymbol(d.severity);
					return `  ${severitySymbol} [Line ${d.range.start.line + 1}:${d.range.start.character + 1}] ${d.message}${d.code ? ` [${d.code}]` : ""}${d.source ? ` (${d.source})` : ""}`;
				})
				.join("\n");

			return `${filename}:\n${diagnostics}`;
		})
		.join("\n\n");

	if (result.length > MAX_DIAGNOSTICS_SUMMARY_CHARS) {
		return result.slice(0, MAX_DIAGNOSTICS_SUMMARY_CHARS - truncationMarker.length) + truncationMarker;
	}

	return result;
}
