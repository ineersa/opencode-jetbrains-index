import {
	BUILTIN_GENERIC_TOOLS,
	GENERIC_SUFFIXES,
	SEARCH_BASH_REGEX,
	SYMBOLIC_SUFFIXES,
} from "./constants.js";

function hasFiniteNumberLike(value: unknown): boolean {
	if (typeof value === "number") {
		return Number.isFinite(value);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			return false;
		}
		return Number.isFinite(Number(trimmed));
	}
	return false;
}

function hasSuffix(toolName: string, suffix: string): boolean {
	return toolName === suffix || toolName.endsWith(suffix) || toolName.endsWith(`_${suffix}`);
}

export function getToolSuffix(toolName: string): string {
	if (!toolName.includes("_")) {
		return toolName;
	}

	const parts = toolName.split("_");
	const maybeTwoPartSuffix = `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
	if (SYMBOLIC_SUFFIXES.has(maybeTwoPartSuffix) || GENERIC_SUFFIXES.has(maybeTwoPartSuffix)) {
		return maybeTwoPartSuffix;
	}

	return parts[parts.length - 1] ?? toolName;
}

export function resolveEffectiveToolName(event: { toolName: string; input: Record<string, unknown> }): string {
	if (event.toolName !== "mcp") return event.toolName;

	const proxyTool = event.input?.tool;
	if (typeof proxyTool === "string" && proxyTool.trim().length > 0) {
		return proxyTool.trim();
	}

	return event.toolName;
}

export function isSymbolicTool(name: string): boolean {
	const suffix = getToolSuffix(name);
	return SYMBOLIC_SUFFIXES.has(suffix);
}

export function isGenericTool(name: string): boolean {
	if (BUILTIN_GENERIC_TOOLS.has(name)) return true;
	const suffix = getToolSuffix(name);
	return GENERIC_SUFFIXES.has(suffix);
}

export function getGenericIncrement(toolName: string, bashCommand: string): number {
	if (toolName === "read") return 2;
	if (toolName === "bash" && SEARCH_BASH_REGEX.test(bashCommand)) return 2;
	return 1;
}

export function describeGenericTool(toolName: string, bashCommand: string): string {
	if (toolName === "read") return "read";
	if (toolName === "bash" && SEARCH_BASH_REGEX.test(bashCommand)) {
		const trimmed = bashCommand.trim().replace(/\s+/g, " ");
		const preview = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
		return `bash (${preview})`;
	}
	return toolName;
}

export function isSearchFirstResetTool(toolName: string): boolean {
	return hasSuffix(toolName, "ide_find_file")
		|| hasSuffix(toolName, "ide_search_text")
		|| hasSuffix(toolName, "ide_find_class")
		|| hasSuffix(toolName, "ide_find_definition")
		|| hasSuffix(toolName, "ide_find_references");
}

export function isSemanticIdeTool(toolName: string): boolean {
	return hasSuffix(toolName, "ide_find_file")
		|| hasSuffix(toolName, "ide_search_text")
		|| hasSuffix(toolName, "ide_find_class")
		|| hasSuffix(toolName, "ide_find_definition")
		|| hasSuffix(toolName, "ide_find_references")
		|| hasSuffix(toolName, "ide_find_implementations")
		|| hasSuffix(toolName, "ide_find_super_methods")
		|| hasSuffix(toolName, "ide_type_hierarchy")
		|| hasSuffix(toolName, "ide_call_hierarchy")
		|| hasSuffix(toolName, "ide_refactor_rename")
		|| hasSuffix(toolName, "ide_move_file")
		|| hasSuffix(toolName, "ide_diagnostics");
}

export function getBashCommand(input: Record<string, unknown>): string {
	const command = input.command;
	if (typeof command !== "string") {
		return "";
	}
	return command.trim();
}

export function isUnboundedReadInput(input: Record<string, unknown>): boolean {
	const hasOffset = hasFiniteNumberLike(input.offset);
	const hasLimit = hasFiniteNumberLike(input.limit);
	return !hasOffset && !hasLimit;
}

export function getFilePathFromToolInput(input: Record<string, unknown>): string | null {
	const candidates = [input.path, input.file_path, input.filePath, input.file];
	for (const value of candidates) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}
	return null;
}
