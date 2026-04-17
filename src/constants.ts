export const BUILTIN_GENERIC_TOOLS = new Set<string>(["read", "grep", "find", "ls", "bash"]);

export const GENERIC_SUFFIXES = new Set<string>();

export const SYMBOLIC_SUFFIXES = new Set<string>([
	"search_symbol",
	"get_symbol_info",
	"search_structural",
	"rename_refactoring",
]);

export const SEARCH_NUDGE_THRESHOLD = 3;
export const COOLDOWN_MS = 5 * 60 * 1000;
export const SEARCH_BASH_REGEX = /\b(?:rg|grep|git\s+grep|find)\b/i;

/** Detect shell move commands to nudge toward IDE move refactoring. */
export const MOVE_BASH_REGEX = /(^|[;&|]\s*|\s+)(?:git\s+mv|mv)(?=\s|$)/i;

/** Cooldown for repeated read/move nudges to avoid reminder spam. */
export const NUDGE_COOLDOWN_MS = 5 * 60 * 1000;

/** Timeout for a single MCP tool call (e.g. get_file_problems). */
export const MCP_TOOL_CALL_TIMEOUT_MS = 30_000;

/** Max attempts before giving up on a tool call. */
export const MCP_MAX_RETRIES = 3;

/** Base delay between retries, multiplied by attempt index. */
export const MCP_RETRY_BASE_DELAY_MS = 1_000;

/** How long to wait for the MCP client to connect before giving up on that attempt. */
export const MCP_CONNECT_TIMEOUT_MS = 30_000;

/** Delay before attempting reconnection after a connection drop. */
export const MCP_RECONNECT_DELAY_MS = 3_000;

/** Index readiness checks before edit/write: retry count when IDE is in dumb/indexing mode. */
export const IDE_INDEX_STATUS_MAX_RETRIES = 3;

/** Delay between index readiness retries. */
export const IDE_INDEX_STATUS_RETRY_DELAY_MS = 5_000;

/** Delay after edit/write before querying diagnostics to let IDE refresh. */
export const DIAGNOSTICS_POST_EDIT_DELAY_MS = 1_000;

/** Consider reads above this many lines as large for read-efficiency enforcement. */
export const LARGE_READ_LINE_THRESHOLD = 200;

/** Block unbounded reads once this many consecutive large reads occur in a turn. */
export const LARGE_READ_CONSECUTIVE_BLOCK_THRESHOLD = 4;

/** Block mixed non-symbolic exploration bursts after this many weighted calls. */
export const NON_SYMBOLIC_STREAK_BLOCK_THRESHOLD = 6;

/** Minimum cooldown between mixed non-symbolic deny actions. */
export const NON_SYMBOLIC_DENY_COOLDOWN_MS = 120 * 1000;

/** Unbounded reads count heavier in mixed non-symbolic streak tracking. */
export const NON_SYMBOLIC_UNBOUNDED_READ_INCREMENT = 2;

export const DEFAULT_IDE_TOOL_NAMES = [
	"jetbrains_index_ide_find_references",
	"jetbrains_index_ide_find_definition",
	"jetbrains_index_ide_find_class",
	"jetbrains_index_ide_find_file",
	"jetbrains_index_ide_search_text",
	"jetbrains_index_ide_type_hierarchy",
	"jetbrains_index_ide_call_hierarchy",
	"jetbrains_index_ide_find_implementations",
	"jetbrains_index_ide_find_super_methods",
	"jetbrains_index_ide_refactor_rename",
	"jetbrains_index_ide_move_file",
	"jetbrains_index_ide_diagnostics",
	"jetbrains_index_ide_index_status",
	"jetbrains_index_ide_sync_files",
	"mcp",
];

export const PROXY_DISCOVERY_WORKFLOW = [
	"JetBrains MCP is running in proxy mode via the mcp tool.",
	"Important: mcp(...) is a TOOL call, not a shell command. Never run it via bash.",
	"",
	"Discovery workflow (tool calls):",
	"1) Call mcp with connect=\"jetbrains\"",
	"2) Call mcp with server=\"jetbrains\"",
	"3) Call mcp with describe=\"jetbrains_<tool>\" to load exact parameter schema",
	"4) Call mcp with tool=\"jetbrains_<tool>\" and args as object (or legacy JSON string)",
].join("\n");

export const PROXY_RECONNECT_NOTIFY =
	"JetBrains MCP proxy mode: consider /mcp reconnect jetbrains once after startup to refresh tool metadata.";

