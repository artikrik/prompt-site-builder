# Security

## Pre-Commit Checklist
- [ ] No hardcoded secrets (API keys, passwords, tokens) — use env vars
- [ ] User input validated at system boundaries
- [ ] SQL injection: parameterized queries (Prisma), never string concat
- [ ] XSS: sanitize HTML, escape output
- [ ] CSRF protection enabled
- [ ] Auth verified
- [ ] Rate limiting on all endpoints
- [ ] Error messages: no sensitive data leak

## Secret Management
- NEVER hardcode. ALWAYS env vars or secret manager.
- Validate required secrets at startup (validateEnv).
- Rotate exposed secrets immediately.

## Security Incident
1. STOP → security-reviewer agent
2. Fix CRITICAL issues first
3. Rotate exposed secrets
4. Audit codebase for similar issues
