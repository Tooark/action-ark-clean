# Supply-chain security

## Repository controls

- Protect `main`; require reviews, status checks, signed commits where practical, and DCO.
- CODEOWNERS approval for `action.yml`, `src/security`, `src/apply`, workflows, and release scripts.
- Restrict workflow permissions at organization and repository level.
- Pin third-party CI actions by full commit SHA and record the corresponding release in comments.
- Do not run privileged workflows on untrusted pull-request code.

## CI controls

- Formatting, linting, typecheck, unit, integration, and coverage.
- CodeQL and dependency review.
- Secret scanning with the organization's approved scanner.
- License allowlist compatible with Apache-2.0 distribution.
- SBOM generation for source and bundle.
- Build `dist` in CI and fail if it differs from the committed bundle.
- Scan release artifacts and verify checksums.

## Release controls

- SemVer immutable tag such as `v1.0.0`.
- Moving major tag `v1` updated only by a protected release workflow.
- GitHub release notes and checksums.
- Artifact attestation/provenance and optional keyless signing.
- Marketplace release from the public dedicated repository.
- Consumers with strict posture should pin a full commit SHA.

## Dependency policy

- Runtime dependency target: zero.
- Every new dependency requires purpose, alternatives, maintenance, license, transitive dependency, and compromise-impact review.
- Development dependencies are exact/locked and updated through reviewed automation.
