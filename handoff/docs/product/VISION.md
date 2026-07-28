# Product vision

## Problem

GHCR retains package versions until explicit deletion and does not expose an ECR-like lifecycle policy configuration. Teams accumulate untagged versions, commit builds, branch builds, OCI platform manifests, signatures, attestations, and SBOMs. Naive cleanup can break a multi-architecture image or delete evidence attached to a retained release.

## Vision statement

For GitHub organizations that publish containers to GHCR, Arklean is a safe retention-policy action that produces an explainable cleanup plan and applies it only within explicit safety limits. Unlike opaque cleanup scripts, it models the package version as the deletion unit and protects the OCI dependency graph.

## Principles

1. Fail closed.
2. Dry-run by default.
3. A protected tag protects the entire package version.
4. A retained parent protects required children and referrers.
5. Every decision has a machine-readable reason.
6. Discovery, planning, application, and validation are separate phases.
7. No secret appears in logs, outputs, summaries, or errors.
8. Runtime dependencies are zero; any exception requires a superseding ADR and must be bundled (ADR-006).
9. Destructive behavior requires explicit configuration.
10. Public contracts remain backward-compatible within a major version.

## Success metrics

- Zero broken retained multi-arch indexes in integration fixtures.
- 100% of decisions carry a reason code.
- Dry-run and apply produce the same plan for an unchanged inventory.
- Pagination tests cover inventories on both sides of the 100-version page boundary.
- No token leakage in automated log tests.
- The README usage example works copy-paste for a standard GHCR package with no configuration beyond the workflow file.
