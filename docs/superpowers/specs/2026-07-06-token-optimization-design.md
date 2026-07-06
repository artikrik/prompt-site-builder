# Token Optimization Design

**Date:** 2026-07-06
**Goal:** Reduce input token consumption in Claude Code sessions by 60-70% without losing critical project information.

## Problem

Current token consumption per session:

| Source | Lines | Status |
|--------|-------|--------|
| Project CLAUDE.md | 105 | Keep, compress to caveman |
| Rules (10 files) | 535 | Delete 8, compress 2 |
| Global CLAUDE.md + RTK.md | ~100 | Deduplicate |
| Caveman hook repeats | 2-3x/prompt | Investigate hook config |
| settings.local.json | 53 | Keep as-is |

Root cause: 8 of 10 rules files are process-oriented (agents, code-review, coding-style, development-workflow, git-workflow, hooks, patterns, performance). User uses superpowers skills which provide their own process. These files are dead tokens.

## Solution

### Phase 1: Delete Unused Rules (8 files)

Remove from CLAUDE.md `# claudeMd` directive:
- `agents.md` — superpowers has own agents
- `code-review.md` — `/code-review` + `caveman:caveman-review` replace
- `coding-style.md` — generic, not project-specific
- `development-workflow.md` — superpowers: brainstorming → TDD → review → finish
- `git-workflow.md` — CLAUDE.md already has branching strategy
- `hooks.md` — not used
- `patterns.md` — not project-specific
- `performance.md` — model selection already in CLAUDE.md

**Keep (2 files, compress):**
- `testing.md` — project-specific: 80% coverage, AAA pattern, vitest/playwright
- `security.md` — project-specific: no-hardcoded-secrets checklist

**Savings:** ~430 lines/session

### Phase 2: Compress CLAUDE.md to Caveman Format

105 lines → ~40 lines (~60% reduction).

Remove:
- Development workflow (superpowers handles)
- Agent orchestration (superpowers handles)
- Code review standards (`/code-review` handles)
- RTK reference (already in global CLAUDE.md)
- Worktree rule (already in global CLAUDE.md)
- Verbose branch protection details

Keep in caveman format:
- Stack overview
- Model selection rules
- Key commands
- Hugo Theme Engine rules (CRITICAL — project-specific)
- Testing commands + coverage rule
- Security checklist

**Savings:** ~65 lines/session

### Phase 3: Global Deduplication

**RTK.md duplication:**
- `~/.claude/CLAUDE.md` includes `@RTK.md`
- Project CLAUDE.md currently references RTK → remove (done in Phase 2)
- Result: RTK content loaded once via global, not duplicated

**Caveman hook repeats:**
- `SessionStart:clear` + `UserPromptSubmit` hooks inject same caveman instructions 2-3x
- Investigate: can hooks be configured to not repeat?
- Fallback: reduce caveman instructions verbosity

### Phase 4: token-optimizer-mcp

Server already configured in `settings.local.json`. Verify it's working:
1. Check if MCP server connects successfully
2. Test deduplication effectiveness
3. Tune if needed

## Compressed testing.md

```markdown
# Testing
- Unit/Integration: vitest. E2E frontend: playwright. E2E backend: vitest.e2e.config.ts.
- Coverage: 80%+ required.
- TDD: RED → GREEN → IMPROVE. Superpowers tdd-guide agent.
- AAA pattern: Arrange → Act → Assert.
- External API calls MUST be mocked.
- Test names: describe behavior ("returns empty array when no markets match query").
- CI: `bash scripts/ci-local.sh` (lint → typecheck → test → build).
```

## Compressed security.md

```markdown
# Security
- NO hardcoded secrets (API keys, passwords, tokens). Use env vars.
- Validate env vars at startup (validateEnv).
- Parameterized queries only (Prisma). Never string concat SQL.
- Sanitize user input. Escape HTML output.
- Rate limiting on all endpoints.
- Error messages: no sensitive data leak.
- If secret exposed: rotate immediately.
- Security issues: STOP → security-reviewer agent → fix → audit codebase.
```

## Implementation Steps

1. **Edit CLAUDE.md** — replace with caveman version, remove 8 unused rules
2. **Compress testing.md + security.md** — caveman format
3. **Remove RTK reference** from project CLAUDE.md (already in global)
4. **Verify** — start new session, check token consumption
5. **Token-optimizer investigation** — check MCP server status
6. **Commit** — `chore: token optimization — caveman compress CLAUDE.md, remove unused rules`

## Success Metrics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Rules lines | 535 | ~100 (2 compressed files) | ~81% |
| CLAUDE.md lines | 105 | ~40 | ~62% |
| Total project context | ~640 lines | ~140 lines | ~78% |
| Per-session savings | 0 | ~500 lines × ~1.3 tokens/line ≈ 650 tokens/session | — |

## Risks

- **Low**: Compressed format might omit nuance. Mitigation: Hugo rules kept verbatim (CRITICAL tag).
- **Low**: token-optimizer-mcp might not work. Mitigation: Phase 4 is investigation-only, no dependency.
- **None**: Deleting unused rules — zero risk since user confirmed they're not used.
