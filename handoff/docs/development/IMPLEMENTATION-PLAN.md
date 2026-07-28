# Implementation plan

## Mapping to the roadmap

Iterations map to roadmap versions as follows: Iterations 1 and 2 deliver V0.1, Iteration 3 delivers V0.2, Iteration 4 delivers V0.3, Iteration 5 delivers V0.4, and Iteration 6 delivers V1.0. Documents that reference "Iteration N" (such as the Claude Code bootstrap prompt) and documents that reference "V0.x" (such as the roadmap) refer to the same milestones through this mapping.

## Iteration 1 — repository foundation

Deliver metadata, TypeScript tooling, CI, governance, and an action that validates inputs and emits a harmless summary. Do not implement deletion.

## Iteration 2 — inventory

Implement owner routing, REST client, pagination, normalization, redacted diagnostics, and read-only inventory output. Create fixtures from Tooark packages.

## Iteration 3 — policy

Implement pure evaluation, stable reasons, canonical plan JSON, plan hash, newest/keep-latest, and safety budgets. Compare output with the current third-party action in dry-run, recognizing semantic differences.

## Iteration 4 — apply

Implement bounded deletion, retries, idempotency, partial failure reporting, rediscovery, and validation. Initially restrict end-to-end tests to disposable packages.

## Iteration 5 — OCI awareness

Implement graph extraction based on verified GHCR metadata. Keep orphan deletion disabled by default until every supported artifact has fixtures and validation.

## Iteration 6 — release

Complete READMEs, examples, security review, SBOM, provenance, signed/checksummed release, Marketplace listing, and `v1` tag process.

## Definition of done

- Code reviewed by CODEOWNERS.
- Tests and security checks pass.
- Documentation and PT-BR user guidance are updated.
- Public contract changes have migration notes.
- Bundle matches source build.
- Threat model and risk register reflect the implementation.
