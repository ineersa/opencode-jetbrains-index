# Plan: Publishable OpenCode JetBrains Index Guard Plugin

Date: 2026-04-17

## Goal
Build a **publishable npm OpenCode server plugin** in this repository that ports the useful behavior from `my-pi` JetBrains extension, while removing only the `unboundedReadCountThisTurn` reminder logic block you highlighted.

---

## Confirmed requirements
1. Package must be **publishable to npm**.
2. Keep hard read guardrail behavior:
   - block when next unbounded read is attempted after **4 consecutive large unbounded reads**.
3. Remove only this portion of old logic:
   - `unboundedReadCountThisTurn` tracking and reminder branch (the snippet you pasted).
4. Keep other behaviors (policy reminders, diagnostics gate, non-symbolic streak guard, move nudge).

---

## Proposed package shape (publishable)

```text
.
├─ package.json
├─ tsconfig.json
├─ README.md
├─ LICENSE
└─ src/
   ├─ server.ts            # default export { id, server }
   ├─ constants.ts
   ├─ prompts.ts
   ├─ tool-names.ts
   ├─ mcp-config.ts
   ├─ mcp-problems-client.ts
   ├─ diagnostics.ts
   ├─ problems-tracker.ts
   └─ state.ts
```

### package.json (target)
- `type: "module"`
- `exports["./server"] = "./dist/server.js"`
- `main = "./dist/server.js"`
- `files = ["dist", "README.md", "LICENSE"]`
- scripts: `build`, `typecheck`, `prepublishOnly`
- deps/devDeps: only what runtime/build needs (TypeScript + optional `@opencode-ai/plugin` types)

---

## Hook mapping (OpenCode)
- `experimental.chat.system.transform`:
  - inject strict IDE-index policy reminder.
- `tool.execute.before`:
  - enforce blocking rules (read guardrail, non-symbolic streak, edit/write preflight index-ready gate).
- `tool.execute.after`:
  - update read streak counters from read output.
  - append reminders (move command / read efficiency warnings).
  - run post-mutation diagnostics and append `<system-reminder><new-diagnostics>...</new-diagnostics></system-reminder>`.
- `event`:
  - optional resets on session lifecycle events (`session.status`, `session.created`, etc.) to keep counters scoped sanely.

---

## Behavior to port (and what changes)

### Keep
1. Strict IDE policy system reminder.
2. Non-symbolic exploration streak block with cooldown.
3. Consecutive large unbounded read hard block (4 then block next).
4. `mv/git mv` detection reminder toward IDE move refactor.
5. edit/write preflight gate via IDE index readiness (`ide_index_status`).
6. Baseline vs post-edit diagnostics diff + new diagnostics summary.
7. MCP retry/reconnect/timeout handling and tool name discovery.

### Remove (only)
- `unboundedReadCountThisTurn` counter and its reminder branch.
- `unboundedReadWarningSentThisTurn` state related to that branch.

### Keep read guardrail mechanics
- Keep `consecutiveLargeReadCountThisTurn` tracking.
- Keep warning one step before block (optional, controlled by cooldown).
- Keep reset behavior on bounded/small reads or semantic IDE tool usage.

---

## Implementation phases

### Phase 1 — Scaffold npm plugin package
- Create package skeleton and build setup.
- Add `src/server.ts` with OpenCode plugin default export object:
  - `id`
  - `server: async (ctx, options) => hooks`

### Phase 2 — Port core utility modules
- Port constants/prompts/tool-name resolution.
- Remove unbounded-count constants and references.

### Phase 3 — Port MCP + diagnostics services
- Port `mcp-config.ts`, `mcp-problems-client.ts`, `problems-tracker.ts`, `diagnostics.ts`.
- Ensure project-relative paths and robust reconnect/retry behavior.

### Phase 4 — Implement hook orchestration
- Implement state store for per-session counters/cooldowns.
- Wire `tool.execute.before` and `tool.execute.after`.
- Ensure block behavior uses thrown errors in OpenCode plugin hooks.

### Phase 5 — Read guardrail finalization
- Preserve large-read parsing/counting.
- Keep block-on-next behavior at threshold.
- Ensure **no** `unboundedReadCountThisTurn` logic remains.

### Phase 6 — Docs + publish readiness
- README with install/config/behavior matrix.
- Example `opencode.json` snippet for npm usage.
- npm metadata sanity (`name`, `version`, `repository`, `keywords`).

---

## Acceptance criteria
1. Plugin loads from npm package via OpenCode `plugin` config.
2. Edit/write blocked while IDE index remains dumb/indexing after retries.
3. New diagnostics summary appears only for newly introduced issues.
4. After 4 consecutive large unbounded reads, next unbounded read is blocked.
5. No `unboundedReadCountThisTurn` (or equivalent reminder branch) exists in code.
6. Build/typecheck pass for package.

---

## Out of scope
- Reintroducing per-turn unbounded-read count reminders.
- Porting Pi-specific UI APIs (`ctx.ui.notify`) exactly; OpenCode-compatible equivalents only.
- TUI plugin support (`./tui`) in this iteration (server plugin only).

---

## Execution checklist (implementation-ready)
- [ ] Scaffold files + package metadata
- [ ] Port utilities and prompts
- [ ] Port MCP client + diagnostics tracker
- [ ] Implement hooks and state machine
- [ ] Remove unbounded-count branch completely
- [ ] Add README + config examples
- [ ] Validate behavior with manual scenarios
- [ ] Prepare npm publish
