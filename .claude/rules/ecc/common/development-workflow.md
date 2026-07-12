
## Pre-Commit/Pre-Push Rule (MANDATORY)

Before ANY commit or push, run full CI locally:
1. `npm run lint` — ESLint 0 errors
2. `npm run typecheck` — tsc + svelte-check 0 errors
3. `npm run test` — vitest all passing
4. `npm run build` — production build exit 0

Also available: `bash scripts/ci-local.sh`
