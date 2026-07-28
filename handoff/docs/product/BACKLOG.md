# Prioritized backlog

## Epic A — foundation

- A1 Initialize pnpm TypeScript project and Node test runner.
- A2 Define lint, format, typecheck, unit-test, coverage, and bundle scripts.
- A3 Add Apache-2.0, NOTICE, DCO, CODEOWNERS, security policy, contribution guide.
- A4 Create architecture tests preventing policy code from importing GitHub transport.

## Epic B — configuration

- B1 Parse GitHub Action inputs without leaking token.
- B2 Parse exact and regex tag rules.
- B3 Validate bounded integers and booleans strictly.
- B4 Reject dangerous/oversized patterns and ambiguous owner configuration.

## Epic C — GitHub API

- C1 Implement fetch-based REST transport.
- C2 Handle organization/user endpoints.
- C3 Implement Link-header pagination.
- C4 Add retry with jitter for transient responses and rate limits.
- C5 Create redacted typed errors.

## Epic D — policy engine

- D1 Normalize inventory.
- D2 Implement protection precedence.
- D3 Implement age eligibility with injected clock.
- D4 Implement keep-latest and newest protections.
- D5 Generate reason codes and stable ordering.
- D6 Enforce deletion budgets.
- D7 Produce canonical JSON and SHA-256 plan hash.

## Epic E — OCI safety

- E1 Identify index/manifest relationships from available metadata.
- E2 Model subjects and referrers conservatively.
- E3 Protect children and referrers transitively.
- E4 Detect proven orphans.
- E5 Validate retained graph after apply.

## Epic F — apply and reporting

- F1 Delete by package version ID.
- F2 Bound concurrency and retries.
- F3 Support idempotent 404 handling.
- F4 Write outputs and Step Summary.
- F5 Attach JSON plan as an optional workflow artifact via documented consumer step.

## Epic G — quality and release

- G1 Fixture, mutation, integration, and end-to-end tests.
- G2 CodeQL, dependency review, secret scan, license checks, SBOM.
- G3 Bundle reproducibility check.
- G4 Semantic release process and moving-major tag automation.
- G5 Marketplace documentation and examples.
