# Changelog

All notable changes to Arklean are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release artifacts
(checksums, SBOM, provenance) are attached to each
[GitHub release](https://github.com/Tooark/action-ark-clean/releases).

## [Unreleased]

Nothing yet.

## [0.1.2] - 2026-07-31

### Added

- `budget-mode` input (default `abort`, preserving current behavior). With
  `cap`, when the plan exceeds `max-deletions` or `max-delete-percentage`, the
  oldest candidates that fit both budgets stay eligible and the rest are
  deferred with the new `DEFERRED_BUDGET` reason code — retained this run,
  candidates again on future runs — so large backlogs drain across scheduled
  runs instead of aborting them. The Step Summary reports the deferred count in
  cap mode.

## [0.1.1] - 2026-07-30

### Fixed

- The plan outputs (`scanned`, `protected`, `eligible`, `plan-sha256`,
  `plan-path`) are now emitted as soon as the plan file is written, so
  run-level aborts after planning (`ABORTED_BUDGET_EXCEEDED`, a
  `confirm-delete` mismatch, `ABORTED_INVENTORY_CHANGED`) still expose the
  plan for audit. Previously all outputs were only emitted at the end of a
  successful run, leaving the aborted case — the one most worth auditing —
  without a discoverable plan. The apply outputs (`deleted`, `absent`,
  `failed`, `result-path`) continue to be emitted only when the run completes.

## [0.1.0] - 2026-07-29

First release: core implementation (roadmap V0.1–V0.4, except orphan referrer
cleanup) plus the complete documentation and governance set.

### Added

- Discovery: complete paginated inventory of GHCR `container` package versions,
  with owner-type auto-resolution and duplicate/partial-inventory aborts.
- Deterministic policy engine: protected/ephemeral/untagged rules, age
  eligibility with injected clock, `keep-latest`, `always-keep-newest`, stable
  reason codes, canonical JSON plan with SHA-256 hash and fingerprints.
- Safe apply: `dry-run` by default, exact `confirm-delete` requirement,
  absolute and percentage deletion budgets, pre-apply inventory recheck,
  bounded-concurrency deletion with retry and idempotent 404 handling,
  post-apply validation, and a JSON apply report.
- OCI graph protection (`protect-multi-arch`, `protect-referrers`): registry
  manifest inspection protecting platform children of retained indexes and
  signature/attestation/SBOM referrers (OCI 1.1 `subject` and cosign tag
  scheme); unproven relations fail closed as `PROTECTED_UNKNOWN_RELATION`.
- Supply chain: SHA-pinned CI, CodeQL, dependency review, Dependabot, bundle
  reproducibility check, and a release workflow with checksums, CycloneDX SBOM,
  build provenance attestation, and protected moving major tag.
- Complete documentation set: `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `NOTICE`, issue/PR templates, and live
  copies of the planning docs (architecture, ADRs, action contract, threat
  model, supply chain, runbook, test strategy, governance) under `docs/`.
- Structured READMEs (EN and pt-BR) with feature overview, full input/output
  tables, and community sections; branding assets under `media/`.
- `.github/FUNDING.yml` (Sponsor button) and a structured `.github/CODEOWNERS`
  with per-area rules.
- Usage examples under `examples/`: minimal dry-run, all options with defaults,
  apply mode with audit artifacts, and a production matrix.

[Unreleased]: https://github.com/Tooark/action-ark-clean/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Tooark/action-ark-clean/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Tooark/action-ark-clean/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Tooark/action-ark-clean/releases/tag/v0.1.0
