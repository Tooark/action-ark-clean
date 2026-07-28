# Requirements

## Functional requirements

- FR-001 List every version of a `container` package with complete pagination.
- FR-002 Support organization and user owners, with explicit or auto-detected owner type.
- FR-003 Normalize version ID, digest/name, tags, timestamps, metadata, and known OCI links.
- FR-004 Match exact tags and delimited regular expressions.
- FR-005 Protect a version when any of its tags matches a protected rule.
- FR-006 Classify ephemeral tagged versions by age and pattern.
- FR-007 Classify untagged versions by age.
- FR-008 Keep at least N newest eligible tagged versions.
- FR-009 Protect newest package versions when configured.
- FR-010 Build a protection graph for retained multi-arch indexes and platform children.
- FR-011 Preserve known signatures, attestations, and SBOM referrers for retained subjects.
- FR-012 Delete orphaned referrers only when their subject is confirmed absent.
- FR-013 Provide dry-run, summary, JSON plan, outputs, and reason codes.
- FR-014 Enforce absolute and percentage deletion budgets.
- FR-015 Apply deletions with bounded concurrency, retry, and rate-limit handling.
- FR-016 Re-discover and validate after apply.
- FR-017 Treat already-deleted versions as idempotent success when configured.
- FR-018 Process exactly one package per invocation in V1 so consumers can fan out over multiple packages with a workflow matrix (ADR-007).

## Non-functional requirements

- NFR-001 Default all destructive features to disabled or dry-run.
- NFR-002 Do not log credentials or authorization headers.
- NFR-003 Avoid executing shell commands or user-provided code.
- NFR-004 Validate all inputs, regex length, numeric ranges, and aggregate pattern count.
- NFR-005 Target current GitHub-hosted runners through a supported JavaScript runtime (Node 24 per ADR-009).
- NFR-006 Maintain >=90% statement and branch coverage in the policy engine.
- NFR-007 Deterministic plans for the same inventory, configuration, and clock.
- NFR-008 Complete typical packages in under 60 seconds, excluding rate limiting.
- NFR-009 Apache-2.0 licensing, DCO, CODEOWNERS, conventional commits.
- NFR-010 English primary documentation plus `README.pt-BR.md`.

## Acceptance criteria for V1

- Simple tagged, untagged, SemVer, branch, SHA, multi-tag, multi-arch, signed, orphaned, paginated, rate-limited, and partial-failure fixtures pass.
- Scheduled execution can deliberately apply, while manual execution can override dry-run.
- A version carrying both an ephemeral and a protected tag is retained.
- Plan limits abort before the first DELETE request.
- Validation detects a missing child of a retained index.
