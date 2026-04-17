# AGENTS.md

## Description
This repository contains `@ineersa/opencode-jetbrains-index-plugin`, an OpenCode **server plugin** that enforces JetBrains-index-first workflows.

Main responsibilities:
- Inject strict IDE-first system policy into chat context
- Guard against inefficient read/search exploration patterns
- Nudge against shell `mv`/`git mv` for code moves
- Gate `edit`/`write` on IDE index readiness and surface new diagnostics
- Gracefully disable index-dependent guardrails for the current session if index connectivity/readiness fails
- Emit TUI toasts for key reminders/status

## Commands
- Install deps: `npm install`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Publish prep (auto-build): `npm run prepublishOnly`

Typical local loop:
1. Edit source in `src/`
2. Run `npm run build`
3. Restart OpenCode to reload plugin

## Project structure
- `src/server.ts` — plugin entrypoint and hook wiring (`event`, `chat.message`, `experimental.chat.system.transform`, tool before/after guards)
- `src/prompts.ts` — system-reminder text builders and strict IDE policy text
- `src/state.ts` — per-session/per-turn counters and reminder state
- `src/problems-tracker.ts` — pre/post mutation diagnostics pipeline orchestration
- `src/mcp-problems-client.ts` — MCP transport for JetBrains index calls
- `src/mcp-config.ts` — MCP server config discovery
- `src/tool-names.ts` — tool name resolution/helpers (`mcp` proxy + IDE tool detection)
- `src/toast.ts` — TUI toast publishing helpers
- `src/diagnostics.ts` — diagnostics formatting and comparison helpers
- `src/constants.ts` — thresholds, cooldowns, and policy constants
- `README.md` — usage/setup docs

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