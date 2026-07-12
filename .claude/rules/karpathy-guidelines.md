# Karpathy-Inspired Coding Guidelines

> Source: https://github.com/multica-ai/andrej-karpathy-skills (MIT)

## 1. Think Before Coding
- State assumptions explicitly. If uncertain — ask.
- If a simpler approach exists, push back.
- If unclear, stop, name what's confusing, ask.

## 2. Simplicity First
- No features beyond what was requested.
- No abstractions for single-use code.
- 200 lines → 50: rewrite.
- Self-check: "Would a senior engineer say this is overcomplicated?"

## 3. Surgical Changes
- Don't improve adjacent code or formatting.
- Don't refactor things that aren't broken.
- Match existing style.
- Remove only YOUR unused imports/vars.
- Every changed line traces to user request.

## 4. Goal-Driven Execution
- "Add validation" → "Write tests, make them pass"
- "Fix bug" → "Write repro test, make it pass"
- Multi-step: state plan with verify checkpoints.
