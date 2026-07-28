# Claude Code bootstrap prompt

You are implementing the first scaffold of `Tooark/arklean`, an Apache-2.0 GitHub Action for safe GHCR retention. Read every file in this repository before changing anything, especially ADRs, requirements, action contract, architecture, threat model, risk register, test strategy, and implementation plan.

## Current iteration

Implement **Iteration 1 only**: repository foundation and a harmless action that parses/validates inputs and emits a summary. Do not list packages and do not send DELETE requests.

## Constraints

- TypeScript source compiled/bundled as a JavaScript Action.
- Select a GitHub-supported Node action runtime after checking the current official documentation; record the choice in an ADR update.
- Prefer zero runtime dependencies. Any dependency requires written justification.
- Use pnpm with an exact package-manager version and committed lockfile.
- Strict TypeScript. No `any` without a localized documented reason.
- English source/contracts; provide PT-BR user documentation updates where relevant.
- Apache-2.0, DCO, CODEOWNERS, Conventional Commits.
- Do not add secrets or real GHCR responses.
- `dry-run` defaults to true. Destructive code is forbidden in this iteration.
- Ensure errors and debug output never include the token.

## Deliverables

1. `package.json`, `pnpm-lock.yaml`, strict `tsconfig.json`.
2. `action.yml` implementing the documented contract, clearly marking not-yet-active inputs in README if necessary.
3. Source modules for action entrypoint, configuration schema/parser, safe errors/redaction, outputs, and Step Summary.
4. Unit tests for booleans, bounds, exact/regex rules, invalid patterns, defaults, and token redaction.
5. Lint, format, typecheck, test, coverage, bundle, and bundle-check scripts.
6. CI workflows pinned by full SHA for quality/security checks; keep permissions minimal.
7. A committed generated `dist/index.js` only if it is reproducibly generated from source.
8. Update documentation with commands and architectural deviations.
9. Produce a final report listing files, commands executed, tests, security considerations, and deferred work.

## Required behavior for the scaffold

- Read inputs from the Actions environment.
- Validate all non-secret inputs before any future network operation.
- Mask the token immediately and never include it in objects serialized for logs.
- Parse newline rules: ignore blank lines/comments; `/.../` means regex; otherwise exact.
- Reject malformed regex and unreasonable lengths/counts.
- Emit a Step Summary stating that discovery/deletion is not implemented in Iteration 1.
- Return deterministic outputs with zero scanned/deleted counts.

## Stop conditions

Stop and report instead of inventing behavior if official API/runtime behavior is uncertain, if a dependency is required contrary to the ADR, or if documentation conflicts. Propose an ADR rather than silently changing architecture.
