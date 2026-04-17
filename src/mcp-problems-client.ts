import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
	IDE_INDEX_STATUS_MAX_RETRIES,
	IDE_INDEX_STATUS_RETRY_DELAY_MS,
	MCP_CONNECT_TIMEOUT_MS,
	MCP_MAX_RETRIES,
	MCP_RECONNECT_DELAY_MS,
	MCP_RETRY_BASE_DELAY_MS,
	MCP_TOOL_CALL_TIMEOUT_MS,
} from "./constants.js";
import type { Diagnostic, DiagnosticSeverity } from "./diagnostics.js";

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

type JetBrainsProblem = {
	severity?: string;
	message?: string;
	description?: string;
	line?: number;
	column?: number;
	endLine?: number;
	endColumn?: number;
	source?: string;
	code?: string;
};

type StructuredResult = Record<string, unknown>;

type NotifyFn = (message: string, level: "info" | "warning" | "error") => void;

const NOOP_NOTIFY: NotifyFn = () => {};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!(value && typeof value === "object")) {
		return null;
	}
	return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toNumberValue(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toBooleanValue(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return undefined;
	}
}

function mapSeverity(severity: string | undefined): DiagnosticSeverity {
	const normalized = severity?.toUpperCase() ?? "";
	if (normalized.includes("ERROR")) {
		return "Error";
	}
	if (normalized.includes("WARNING") || normalized.includes("WEAK")) {
		return "Warning";
	}
	if (normalized.includes("INFO")) {
		return "Info";
	}
	if (normalized.includes("HINT")) {
		return "Hint";
	}
	return "Warning";
}

function extractStructuredRecord(result: unknown): StructuredResult | null {
	const direct = asRecord(result);
	if (!direct) {
		return null;
	}

	const structured = asRecord(direct.structuredContent);
	if (structured) {
		return structured;
	}

	if (Array.isArray(direct.content)) {
		for (const block of direct.content) {
			const blockRecord = asRecord(block);
			if (!blockRecord || blockRecord.type !== "text") {
				continue;
			}
			const text = toStringValue(blockRecord.text);
			if (!text) {
				continue;
			}
			const parsed = asRecord(parseJson(text));
			if (parsed) {
				return parsed;
			}
		}
	}

	return direct;
}

function extractProblems(result: unknown): JetBrainsProblem[] {
	const record = extractStructuredRecord(result);
	if (!record) {
		return [];
	}

	const rawProblems = record.problems;
	if (!Array.isArray(rawProblems)) {
		return [];
	}

	const problems: JetBrainsProblem[] = [];
	for (const value of rawProblems) {
		const item = asRecord(value);
		if (!item) {
			continue;
		}
		problems.push({
			severity: toStringValue(item.severity),
			message: toStringValue(item.message),
			description: toStringValue(item.description),
			line: toNumberValue(item.line),
			column: toNumberValue(item.column),
			endLine: toNumberValue(item.endLine),
			endColumn: toNumberValue(item.endColumn),
			source: toStringValue(item.source),
			code: toStringValue(item.code),
		});
	}
	return problems;
}

function problemToDiagnostic(problem: JetBrainsProblem): Diagnostic {
	const lineOneBased = Number.isFinite(problem.line) ? Math.max(1, problem.line ?? 1) : 1;
	const columnOneBased = Number.isFinite(problem.column) ? Math.max(1, problem.column ?? 1) : 1;
	const endLineOneBased = Number.isFinite(problem.endLine)
		? Math.max(lineOneBased, problem.endLine ?? lineOneBased)
		: lineOneBased;
	const endColumnOneBased = Number.isFinite(problem.endColumn)
		? Math.max(columnOneBased, problem.endColumn ?? columnOneBased)
		: columnOneBased + 1;

	return {
		message: problem.message ?? problem.description ?? "Inspection problem",
		severity: mapSeverity(problem.severity),
		range: {
			start: {
				line: lineOneBased - 1,
				character: columnOneBased - 1,
			},
			end: {
				line: endLineOneBased - 1,
				character: endColumnOneBased - 1,
			},
		},
		source: problem.source,
		code: problem.code,
	};
}

function parseIndexStatus(result: unknown): { isDumbMode: boolean; isIndexing: boolean } | null {
	const record = extractStructuredRecord(result);
	if (!record) {
		return null;
	}

	const isDumbMode = toBooleanValue(record.isDumbMode);
	const isIndexing = toBooleanValue(record.isIndexing);
	if (isDumbMode === undefined || isIndexing === undefined) {
		return null;
	}

	return { isDumbMode, isIndexing };
}

// ---------------------------------------------------------------------------
// MCP client
// ---------------------------------------------------------------------------

type ToolCatalog = {
	indexStatus: string;
	diagnostics: string;
	syncFiles: string;
};

type ToolKey = keyof ToolCatalog;

type CallResult = {
	ok: boolean;
	result?: unknown;
	error?: string;
};

export type IndexReadinessResult = {
	ready: boolean;
	attempts: number;
	message?: string;
};

function pickToolName(available: Set<string>, candidates: string[]): string | null {
	for (const candidate of candidates) {
		if (available.has(candidate)) {
			return candidate;
		}
	}
	return null;
}

export class McpProblemsClient {
	private client: Client | null = null;
	private transport: StreamableHTTPClientTransport | null = null;
	private connectionState: "disconnected" | "connecting" | "connected" = "disconnected";
	private connectPromise: Promise<void> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private shuttingDown = false;
	private toolCatalog: ToolCatalog | null = null;

	constructor(
		private readonly endpointUrl: string,
		private readonly headers: Record<string, string>,
		private readonly notify: NotifyFn = NOOP_NOTIFY,
	) {}

	get isConnected(): boolean {
		return this.connectionState === "connected" && this.client !== null;
	}

	async connect(): Promise<void> {
		if (this.connectionState === "connected" && this.client) {
			return;
		}

		if (this.connectionState === "connecting" && this.connectPromise) {
			await this.connectPromise;
			return;
		}

		this.connectPromise = this.doConnect();
		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
	}

	private async doConnect(): Promise<void> {
		this.connectionState = "connecting";
		this.shuttingDown = false;

		try {
			const url = new URL(this.endpointUrl);
			const transport = new StreamableHTTPClientTransport(url, {
				requestInit: {
					headers: this.headers,
				},
			});

			const client = new Client(
				{ name: "opencode-jetbrains-index-plugin", version: "1.0.0" },
				{ capabilities: {} },
			);

			client.onclose = () => {
				if (!this.shuttingDown) {
					this.connectionState = "disconnected";
					this.notify("JetBrains index MCP connection closed. Reconnecting…", "warning");
					this.scheduleReconnect();
				}
			};

			client.onerror = (error) => {
				const msg = error?.message ?? String(error);
				this.notify(`JetBrains index MCP transport error: ${msg}`, "warning");
			};

			await this.withTimeout(
				client.connect(transport),
				MCP_CONNECT_TIMEOUT_MS,
				`Timed out connecting to JetBrains index MCP (${this.endpointUrl})`,
			);

			const toolCatalog = await this.discoverToolCatalog(client);

			this.client = client;
			this.transport = transport;
			this.toolCatalog = toolCatalog;
			this.connectionState = "connected";
		} catch (error) {
			this.connectionState = "disconnected";
			const message = error instanceof Error ? error.message : String(error);
			this.notify(`Failed to connect to JetBrains index MCP: ${message}`, "error");
			throw error;
		}
	}

	private async discoverToolCatalog(client: Client): Promise<ToolCatalog> {
		const available = new Set<string>();
		let cursor: string | undefined;

		do {
			const response = await client.listTools(cursor ? { cursor } : undefined);
			for (const tool of response.tools ?? []) {
				if (tool?.name) {
					available.add(tool.name);
				}
			}
			cursor = response.nextCursor;
		} while (cursor);

		const indexStatus = pickToolName(available, [
			"ide_index_status",
			"jetbrains_index_ide_index_status",
		]);
		const diagnostics = pickToolName(available, ["ide_diagnostics", "jetbrains_index_ide_diagnostics"]);
		const syncFiles = pickToolName(available, ["ide_sync_files", "jetbrains_index_ide_sync_files"]);

		if (!(indexStatus && diagnostics && syncFiles)) {
			const missing = [
				!indexStatus ? "ide_index_status" : null,
				!diagnostics ? "ide_diagnostics" : null,
				!syncFiles ? "ide_sync_files" : null,
			]
				.filter((value): value is string => value !== null)
				.join(", ");
			throw new Error(`JetBrains index MCP server is missing required tools: ${missing}`);
		}

		return {
			indexStatus,
			diagnostics,
			syncFiles,
		};
	}

	async shutdown(): Promise<void> {
		this.shuttingDown = true;
		this.cancelReconnect();

		const client = this.client;
		const transport = this.transport;

		this.client = null;
		this.transport = null;
		this.toolCatalog = null;
		this.connectionState = "disconnected";

		if (client) {
			try {
				await client.close();
			} catch {
				// Best effort.
			}
		}

		if (transport) {
			try {
				await transport.close();
			} catch {
				// Best effort.
			}
		}
	}

	private scheduleReconnect(): void {
		this.cancelReconnect();
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.attemptReconnect();
		}, MCP_RECONNECT_DELAY_MS);
	}

	private cancelReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private async attemptReconnect(): Promise<void> {
		if (this.shuttingDown || this.connectionState === "connected") {
			return;
		}

		try {
			await this.cleanupInternals();
			await this.connect();
			this.notify("JetBrains index MCP reconnected.", "info");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.notify(`JetBrains index MCP reconnect failed: ${message}`, "error");
			this.scheduleReconnect();
		}
	}

	private async cleanupInternals(): Promise<void> {
		const client = this.client;
		const transport = this.transport;

		this.client = null;
		this.transport = null;
		this.toolCatalog = null;
		this.connectionState = "disconnected";

		if (client) {
			try {
				await client.close();
			} catch {
				// Best effort.
			}
		}
		if (transport) {
			try {
				await transport.close();
			} catch {
				// Best effort.
			}
		}
	}

	async probe(): Promise<boolean> {
		try {
			await this.connect();
			if (this.client) {
				await this.withTimeout(this.client.ping(), MCP_TOOL_CALL_TIMEOUT_MS, "JetBrains index MCP ping timed out");
			}
			return true;
		} catch {
			return false;
		}
	}

	async waitForIndexReady(projectPath: string): Promise<IndexReadinessResult> {
		for (let attempt = 1; attempt <= IDE_INDEX_STATUS_MAX_RETRIES; attempt++) {
			const status = await this.getIndexStatus(projectPath);
			if (!status) {
				return {
					ready: false,
					attempts: attempt,
					message: "Unable to query IDE index status.",
				};
			}

			if (!status.isDumbMode && !status.isIndexing) {
				return {
					ready: true,
					attempts: attempt,
				};
			}

			if (attempt < IDE_INDEX_STATUS_MAX_RETRIES) {
				this.notify(
					`IDE index is busy (attempt ${attempt}/${IDE_INDEX_STATUS_MAX_RETRIES}). Waiting ${IDE_INDEX_STATUS_RETRY_DELAY_MS / 1000}s…`,
					"warning",
				);
				await this.sleep(IDE_INDEX_STATUS_RETRY_DELAY_MS);
			}
		}

		return {
			ready: false,
			attempts: IDE_INDEX_STATUS_MAX_RETRIES,
			message: "IDE index stayed in dumb/indexing mode after retries.",
		};
	}

	async syncFiles(relativePaths: string[], projectPath: string): Promise<boolean> {
		if (relativePaths.length === 0) {
			return true;
		}

		const call = await this.callToolWithRetry("syncFiles", {
			project_path: projectPath,
			paths: relativePaths,
		});
		if (!call.ok) {
			this.notify(`Failed to sync files with IDE index: ${call.error ?? "unknown error"}`, "error");
			return false;
		}
		return true;
	}

	async getFileDiagnostics(relativeFilePath: string, projectPath: string): Promise<Diagnostic[]> {
		const call = await this.callToolWithRetry("diagnostics", {
			project_path: projectPath,
			file: relativeFilePath,
			severity: "all",
		});
		if (!call.ok) {
			this.notify(
				`Failed to fetch IDE diagnostics for ${relativeFilePath}: ${call.error ?? "unknown error"}`,
				"error",
			);
			return [];
		}

		const problems = extractProblems(call.result);
		return problems.map((problem) => problemToDiagnostic(problem));
	}

	private async getIndexStatus(projectPath: string): Promise<{ isDumbMode: boolean; isIndexing: boolean } | null> {
		const call = await this.callToolWithRetry("indexStatus", {
			project_path: projectPath,
		});
		if (!call.ok) {
			this.notify(`Failed to query IDE index status: ${call.error ?? "unknown error"}`, "error");
			return null;
		}

		const status = parseIndexStatus(call.result);
		if (!status) {
			this.notify("IDE index status response was malformed.", "error");
			return null;
		}

		return status;
	}

	private async callToolWithRetry(toolKey: ToolKey, args: Record<string, unknown>): Promise<CallResult> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= MCP_MAX_RETRIES; attempt++) {
			try {
				await this.connect();
				if (!(this.client && this.toolCatalog)) {
					throw new Error("JetBrains index MCP client is not connected");
				}

				const toolName = this.toolCatalog[toolKey];
				const result = await this.withTimeout(
					this.client.callTool({ name: toolName, arguments: args }),
					MCP_TOOL_CALL_TIMEOUT_MS,
					`Timed out waiting for MCP response (${toolName})`,
				);
				return { ok: true, result };
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				const isConnectionError = this.isConnectionError(lastError);
				const level: "warning" | "error" = isConnectionError ? "warning" : "error";
				this.notify(
					`JetBrains index MCP call failed (attempt ${attempt}/${MCP_MAX_RETRIES}): ${lastError.message}`,
					level,
				);

				if (isConnectionError) {
					await this.cleanupInternals();
				}

				if (attempt < MCP_MAX_RETRIES) {
					await this.sleep(MCP_RETRY_BASE_DELAY_MS * attempt);
				}
			}
		}

		return {
			ok: false,
			error: lastError?.message ?? "Unknown MCP tool error",
		};
	}

	private isConnectionError(error: Error): boolean {
		const msg = error.message.toLowerCase();
		return (
			msg.includes("timeout")
			|| msg.includes("terminated")
			|| msg.includes("fetch failed")
			|| msg.includes("aborted")
			|| msg.includes("econnrefused")
			|| msg.includes("econnreset")
			|| msg.includes("not connected")
			|| msg.includes("closed")
		);
	}

	private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const handle = setTimeout(() => reject(new Error(message)), ms);
			promise.then(
				(value) => {
					clearTimeout(handle);
					resolve(value);
				},
				(error) => {
					clearTimeout(handle);
					reject(error);
				},
			);
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
