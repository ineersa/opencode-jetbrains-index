import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type JetBrainsMcpServerConfig = {
	serverName: string;
	sseUrl: string;
	headers: Record<string, string>;
	configPath: string;
};

const JETBRAINS_INDEX_SERVER_NAMES = ["jetbrains-index", "jetbrains_index", "jetbrains"];

function readJson(path: string): unknown {
	if (!existsSync(path)) {
		return undefined;
	}

	try {
		return JSON.parse(readFileSync(path, "utf-8")) as unknown;
	} catch {
		return undefined;
	}
}

function resolveHeaderValue(raw: string): string {
	const envRef = raw.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
	if (!envRef) {
		return raw;
	}
	return process.env[envRef[1]] ?? "";
}

function toHeaders(input: unknown): Record<string, string> {
	if (!(input && typeof input === "object")) {
		return {};
	}

	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (typeof value === "string") {
			headers[key] = resolveHeaderValue(value);
		}
	}
	return headers;
}

function extractRemoteServer(
	servers: Record<string, unknown>,
	configPath: string,
): JetBrainsMcpServerConfig | null {
	for (const serverName of JETBRAINS_INDEX_SERVER_NAMES) {
		const server = servers[serverName];
		if (!(server && typeof server === "object")) {
			continue;
		}

		const url = (server as { url?: unknown }).url;
		if (typeof url !== "string") {
			continue;
		}

		const streamableUrl = url.trim();
		if (!streamableUrl || !/^https?:\/\//i.test(streamableUrl)) {
			continue;
		}

		return {
			serverName,
			sseUrl: streamableUrl,
			headers: toHeaders((server as { headers?: unknown }).headers),
			configPath,
		};
	}

	return null;
}

function findJetBrainsIndexInPiConfig(configPath: string): JetBrainsMcpServerConfig | null {
	const parsed = readJson(configPath);
	if (!(parsed && typeof parsed === "object")) {
		return null;
	}

	const mcpServers = (parsed as { mcpServers?: unknown }).mcpServers;
	if (!(mcpServers && typeof mcpServers === "object")) {
		return null;
	}

	return extractRemoteServer(mcpServers as Record<string, unknown>, configPath);
}

function findJetBrainsIndexInOpenCodeConfig(configPath: string): JetBrainsMcpServerConfig | null {
	const parsed = readJson(configPath);
	if (!(parsed && typeof parsed === "object")) {
		return null;
	}

	const mcp = (parsed as { mcp?: unknown }).mcp;
	if (!(mcp && typeof mcp === "object")) {
		return null;
	}

	for (const serverName of JETBRAINS_INDEX_SERVER_NAMES) {
		const server = (mcp as Record<string, unknown>)[serverName];
		if (!(server && typeof server === "object")) {
			continue;
		}

		const maybeType = (server as { type?: unknown }).type;
		const maybeUrl = (server as { url?: unknown }).url;
		if (maybeType !== "remote" || typeof maybeUrl !== "string") {
			continue;
		}

		const streamableUrl = maybeUrl.trim();
		if (!streamableUrl || !/^https?:\/\//i.test(streamableUrl)) {
			continue;
		}

		return {
			serverName,
			sseUrl: streamableUrl,
			headers: toHeaders((server as { headers?: unknown }).headers),
			configPath,
		};
	}

	return null;
}

export function findJetBrainsMcpServer(cwd: string): JetBrainsMcpServerConfig | null {
	const configPaths = [
		join(cwd, ".pi", "mcp.json"),
		join(homedir(), ".pi", "agent", "mcp.json"),
		join(cwd, "opencode.json"),
		join(cwd, ".opencode", "opencode.json"),
		join(homedir(), ".opencode", "opencode.json"),
	];

	for (const configPath of configPaths) {
		const piConfig = findJetBrainsIndexInPiConfig(configPath);
		if (piConfig) {
			return piConfig;
		}

		const opencodeConfig = findJetBrainsIndexInOpenCodeConfig(configPath);
		if (opencodeConfig) {
			return opencodeConfig;
		}
	}

	return null;
}
