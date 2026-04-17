# @ineersa/opencode-jetbrains-index-plugin

OpenCode **server plugin** that ports JetBrains-index guardrail behavior from the original `my-pi` extension (IDE-first policy reminders, diagnostics gate, read/move guardrails).

## Mandatory dependency

**[jetbrains-index-mcp-plugin](https://github.com/hechtcarmel/jetbrains-index-mcp-plugin)** must be installed and running.
This plugin communicates with JetBrains IDE index through that MCP server — without it, the plugin self-disables.

## Activation requirements (must both be true)

This plugin is intended to be active **only when**:

1. `.idea/` exists in the current working directory, and
2. a JetBrains index MCP server is configured and reachable.

If either condition is missing, the plugin self-disables for that session.

## Troubleshooting / Gotchas

- `.idea/` must exist in the current working directory, otherwise the plugin disables itself.
- **[jetbrains-index-mcp-plugin](https://github.com/hechtcarmel/jetbrains-index-mcp-plugin)** must be installed/running and reachable from OpenCode.
- After plugin code changes: run `npm run build` and restart OpenCode.

## What it does (when active)

- Injects strict JetBrains IDE-index policy reminders (`experimental.chat.system.transform`)
- Enforces the hard read guardrail:
  - after **4 consecutive large unbounded reads** (>200 lines), the next unbounded read is blocked
- Applies non-symbolic streak blocking (`read` / searchy `bash` / `grep` style flow)
- Adds move-refactor nudges when `mv` / `git mv` is used
- Runs diagnostics preflight before `edit`/`write` (waits for IDE index readiness)
- Captures baseline diagnostics and appends only **newly introduced** diagnostics after mutation
- Adds explicit **Plugin Visibility Notice** messages to tool output whenever reminders/diagnostics checks are injected
- Echoes injected reminder content in plain text (`[Plugin Injected Reminder Content]`) so it is user-visible, not model-only
- Includes the exact edited file path in diagnostics reminders
- Explicitly syncs exactly the edited file path with `jetbrains_index_ide_sync_files` before post-edit diagnostics
- Move reminders are surfaced even inside cooldown windows (with an explicit repeated-within-cooldown note)
- Emits per-file diagnostics pipeline status (sync result, index readiness, new-diagnostic count)
- Waits 1 second after `edit`/`write` before post-mutation diagnostics fetch (to reduce IDE refresh race conditions)
- Handles MCP timeouts/retries/reconnect for diagnostics transport

## Agent instructions snippet (`Instructions for agents.md` / `AGENTS.md`)

If you keep an agent-instruction file, you can paste this in the same style:

```md
## Tool Preferences

When working with this codebase:

- **Prefer JetBrains IDE index MCP tools** (`jetbrains_index_ide_*`) for semantic code operations:
  - Finding usages/references: use `jetbrains_index_ide_find_references` instead of grep
  - Going to definition: use `jetbrains_index_ide_find_definition` instead of text search
  - Finding classes/files: use `jetbrains_index_ide_find_class` and `jetbrains_index_ide_find_file`
  - Searching exact words: use `jetbrains_index_ide_search_text` (use grep only for regex)
  - Renaming symbols: use `jetbrains_index_ide_refactor_rename` instead of edit/sed replacements
  - Moving code files: use `jetbrains_index_ide_move_file` instead of `mv`/`git mv`
  - Hierarchy/call flow: use `jetbrains_index_ide_type_hierarchy`, `jetbrains_index_ide_call_hierarchy`, `jetbrains_index_ide_find_implementations`, `jetbrains_index_ide_find_super_methods`
  - Diagnostics/index/sync: use `jetbrains_index_ide_diagnostics`, `jetbrains_index_ide_index_status`, `jetbrains_index_ide_sync_files`
- If IDE tools fail unexpectedly or results seem incomplete, check `jetbrains_index_ide_index_status`
- After creating/modifying files with `edit`/`write`, run `jetbrains_index_ide_sync_files` on changed paths before retrying IDE queries
- Use project-relative file paths and 1-based `line`/`column` for IDE tool calls
- These tools are faster, more context-efficient, and better integrated with the IDE than the default tools
- Only fall back to default tools when IDE tools do not support the needed operation (e.g., regex search)
```

## Included project config (`opencode.json`)

This repository includes a ready-to-use `./opencode.json` that:

- sets `"lsp": false`
- configures `mcp.jetbrains-index` as a remote server
- includes this plugin in `plugin`

The MCP server values were copied from `./.pi/mcp.json`.

## Install from npm

```bash
npm install @ineersa/opencode-jetbrains-index-plugin
```

Then add it in your OpenCode config (`opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@ineersa/opencode-jetbrains-index-plugin"]
}
```

## Local install / development notes

OpenCode plugin loading behavior (from docs):

- **npm plugins** are installed automatically using Bun at startup and cached in:
  `~/.cache/opencode/node_modules/`
- **local plugins** are loaded directly from plugin directories.

### Develop from files (recommended while iterating)

Use a **file plugin spec** in `opencode.json` (no npm publish/install needed).

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/plugin"]
}
```

Where `file:///absolute/path/to/plugin` points to this plugin repo root (the one containing `package.json`).

Then:

```bash
npm run build
# restart opencode
```

After every code change, rebuild and restart OpenCode.

> ⚠️ Avoid symlinking only `dist/server.js` into `.opencode/plugins/`.
> This plugin has relative imports (`./constants.js`, etc.), so loading only one file from a different directory can break startup.

Notes:

- Keep your `opencode.json` plugin list free of the npm package while doing local-file development (avoid loading both npm + local copies).
- Local file plugins are not pulled from npm cache, so cache clearing is not required for this mode.

### Reinstalling npm version during development (cache-aware)

If you test the npm package repeatedly, clear cache before restart:

```bash
rm -rf ~/.cache/opencode/node_modules/@ineersa/opencode-jetbrains-index-plugin
# or clear all cached npm plugins:
# rm -rf ~/.cache/opencode/node_modules
```

Then restart OpenCode.

## Build / typecheck

```bash
npm run typecheck
npm run build
```

## Version bump & publish

```bash
# choose one
npm version patch
# npm version minor
# npm version major

npm run build
npm publish --access public
```

`prepublishOnly` already runs build, but running it manually first is still recommended.

## References

- OpenCode MCP servers: https://opencode.ai/docs/mcp-servers/
- OpenCode plugins: https://opencode.ai/docs/plugins
