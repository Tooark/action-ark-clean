# Roadmap

Versions map to implementation-plan iterations: V0.1 = Iterations 1-2, V0.2 = Iteration 3, V0.3 = Iteration 4, V0.4 = Iteration 5, V1.0 = Iteration 6 (see the implementation plan).

## Phase 0 — handoff and validation

- Approve identity, scope, ADRs, contract, and threat model.
- Reserve repository and Marketplace identity.
- Capture anonymized GHCR API fixtures for the Tooark packages.
- Document known OCI artifact types produced by build pipelines.

## V0.1 — scaffold and read-only discovery

- TypeScript project and standalone action bundle.
- Input parser, REST client, pagination, package-owner routing.
- Inventory command and Step Summary.
- Unit tests and fixture-based contract tests.
- No deletion support.

## V0.2 — deterministic policy engine

- Protected/ephemeral/untagged rules.
- Age clock abstraction and keep-latest.
- Reason codes, JSON plan, plan hash, safety budgets.
- Golden tests against expected plans.

## V0.3 — safe apply

- DELETE execution, bounded concurrency, retry, idempotency.
- Apply only from an immutable in-memory plan.
- Post-apply rediscovery and validation.
- End-to-end tests against disposable packages.

## V0.4 — OCI graph

- Multi-arch relationships.
- Signatures, attestations, provenance, and SBOM referrers.
- Conservative unknown-artifact behavior.
- Optional orphan cleanup after validated fixture coverage.

## V1.0 — Marketplace

- Stable action contract and documentation.
- Apache-2.0 release, security policy, DCO, CODEOWNERS.
- SBOM, provenance, signed release, changelog.
- Immutable SemVer tag plus moving `v1` tag.

## V1.x

- Organization package discovery and include/exclude filters.
- Policy file support.
- Enhanced reports and structured audit artifacts.
- GitHub App authentication guidance.

## V2

- Provider abstraction for ECR, ACR, GAR, and Harbor, only after GHCR core stability.
- Optional plan/apply split across jobs with signed plans.
