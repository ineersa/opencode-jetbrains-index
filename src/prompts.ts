export function wrapSystemReminder(content: string): string {
	return `<system-reminder>\n${content}\n</system-reminder>`;
}

function resolveToolName(activeTools: string[], candidates: string[]): string {
	const activeSet = new Set(activeTools);
	for (const candidate of candidates) {
		if (activeSet.has(candidate)) {
			return candidate;
		}
	}

	for (const candidate of candidates) {
		const match = activeTools.find((name) => name.endsWith(`_${candidate}`));
		if (match) {
			return match;
		}
	}

	return "(not active)";
}

export function buildSystemPromptPolicy(activeTools: string[]): string {
	const findReferences = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_references",
		"ide_find_references",
	]);
	const findDefinition = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_definition",
		"ide_find_definition",
	]);
	const findClass = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_class",
		"ide_find_class",
	]);
	const findFile = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_file",
		"ide_find_file",
	]);
	const searchText = resolveToolName(activeTools, [
		"jetbrains_index_ide_search_text",
		"ide_search_text",
	]);
	const typeHierarchy = resolveToolName(activeTools, [
		"jetbrains_index_ide_type_hierarchy",
		"ide_type_hierarchy",
	]);
	const callHierarchy = resolveToolName(activeTools, [
		"jetbrains_index_ide_call_hierarchy",
		"ide_call_hierarchy",
	]);
	const findImplementations = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_implementations",
		"ide_find_implementations",
	]);
	const findSuperMethods = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_super_methods",
		"ide_find_super_methods",
	]);
	const refactorRename = resolveToolName(activeTools, [
		"jetbrains_index_ide_refactor_rename",
		"ide_refactor_rename",
	]);
	const moveFile = resolveToolName(activeTools, ["jetbrains_index_ide_move_file", "ide_move_file"]);
	const diagnostics = resolveToolName(activeTools, [
		"jetbrains_index_ide_diagnostics",
		"ide_diagnostics",
	]);
	const indexStatus = resolveToolName(activeTools, [
		"jetbrains_index_ide_index_status",
		"ide_index_status",
	]);
	const syncFiles = resolveToolName(activeTools, [
		"jetbrains_index_ide_sync_files",
		"ide_sync_files",
	]);

	return [
		"IDE INDEX MCP POLICY (STRICT)",
		"",
		"Core rule:",
		"- Always prefer JetBrains IDE index tools for semantic code operations.",
		"- Do not use bash/grep/rg/find for usages/definitions/refactors when IDE tools are available.",
		"",
		"Trigger:",
		"- Apply this policy whenever JetBrains index MCP tools are available in the session.",
		"",
		"Task-to-tool mapping (IDE first):",
		`- Find all usages of a method/class/variable -> ${findReferences}. Never use grep; it misses aliases/import semantics/overrides.`,
		`- Go to symbol definition -> ${findDefinition}. Never use grep for definitions through imports/generics.`,
		`- Find class by name -> ${findClass}.`,
		`- Find file by name -> ${findFile}. Glob-style shell lookup is acceptable for simple file patterns if IDE lookup is unavailable.`,
		`- Search exact word in code -> ${searchText}. Use bash/rg only for regex needs (${searchText} is exact-word).`,
		`- Rename symbol across project -> ${refactorRename}. Never use text replace/sed/edit/write.`,
		`- Move file/directory with references -> ${moveFile}. Never use mv/git mv for code moves.`,
		`- Check errors/warnings -> ${diagnostics}.`,
		`- Understand class hierarchy -> ${typeHierarchy}.`,
		`- Find callers/callees -> ${callHierarchy}.`,
		`- Find interface/abstract implementations -> ${findImplementations}.`,
		`- Find overridden/implemented parent method -> ${findSuperMethods}.`,
		"",
		"Pre-flight and consistency checks:",
		`- If IDE tools fail unexpectedly or results look incomplete, check ${indexStatus}.`,
		`- If files changed outside the IDE view (edit/write), run ${syncFiles} on changed relative paths and retry.`,
		"",
		"Read/search rules:",
		`- Use ${findFile} / ${searchText} before broad reads when locating code.`,
		"- Use bounded read windows (offset/limit) whenever possible.",
		"- Guardrail: after 4 consecutive unbounded reads over 200 lines, you will get penalty.",
		"",
		"Parameter rules:",
		"- File paths are project-relative (not absolute).",
		"- line/column are 1-based.",
		"- Put column on the symbol name, not whitespace or punctuation.",
		"- Use project_path only when required (multi-project workspace).",
		"- IDE tool targets must stay inside the current working directory.",
		"- If using mcp proxy mode, pass arguments exactly as the target IDE tool schema expects.",
		"",
		"Mistakes to avoid:",
		"- Do not grep for semantic usages/definitions.",
		"- Do not use text replace/sed/edit/write for symbol rename (use IDE rename refactor).",
		"- Do not use mv/git mv for code file moves (use IDE move refactor).",
		`- Do not use ${searchText} as regex search.`,
		`- Do not use ${findClass} to find methods/functions.`,
		"",
		"Runtime guard note:",
		"- edit/write is guarded by this extension against IDE dumb mode.",
		"- diagnostics flow syncs changed relative paths; avoid root sync unless necessary.",
	].join("\n");
}

export function buildSessionStartIdeNudge(activeTools: string[]): string {
	const findFile = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_file",
		"ide_find_file",
	]);
	const searchText = resolveToolName(activeTools, [
		"jetbrains_index_ide_search_text",
		"ide_search_text",
	]);
	const findDefinition = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_definition",
		"ide_find_definition",
	]);
	const findReferences = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_references",
		"ide_find_references",
	]);

	return wrapSystemReminder([
		"JetBrains index is available in this session.",
		"- Prefer IDE semantic tools first before broad read/grep/bash exploration.",
		`- Start with ${findFile}, ${searchText}, ${findDefinition}, and ${findReferences}.`,
		"- Keep reads focused with offset/limit windows.",
	].join("\n"));
}

export function buildReadEfficiencyReminder(activeTools: string[], reasons: string[]): string {
	const findFile = resolveToolName(activeTools, [
		"jetbrains_index_ide_find_file",
		"ide_find_file",
	]);
	const searchText = resolveToolName(activeTools, [
		"jetbrains_index_ide_search_text",
		"ide_search_text",
	]);

	return wrapSystemReminder([
		"Token Efficiency Reminder:",
		...reasons.map((reason) => `- ${reason}`),
		`- Use ${findFile} and ${searchText} to locate targets before reading full files.`,
		"- Prefer bounded read windows (offset/limit) over unbounded full-file reads.",
	].join("\n"));
}

export function buildMoveRefactorReminder(activeTools: string[], commandPreview: string): string {
	const moveFile = resolveToolName(activeTools, [
		"jetbrains_index_ide_move_file",
		"ide_move_file",
	]);

	return wrapSystemReminder([
		"Refactor Safety Reminder:",
		`- Detected shell move command: ${commandPreview}`,
		`- Prefer ${moveFile} for code file moves so imports/references are updated safely.`,
		"- Avoid mv/git mv for source files unless you intentionally do a raw filesystem move.",
	].join("\n"));
}

export function buildNewDiagnosticsReminder(summary: string): string {
	return wrapSystemReminder(
		`<new-diagnostics>The following new diagnostic issues were detected:\n\n${summary}</new-diagnostics>`,
	);
}
