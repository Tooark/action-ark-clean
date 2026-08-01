# Action contract

This is the implemented V0.x contract. It supersedes the original proposal: the
safety inputs `confirm-delete`, `verify-inventory-before-apply`, and
`delete-untagged` were added during implementation, and `fail-on-no-match` was
renamed `fail-on-empty`. OCI graph protection (`protect-multi-arch`,
`protect-referrers`) and orphan referrer cleanup (`delete-orphaned-referrers`,
since 0.2.0) are implemented.

## Scope

The package type is fixed to `container` in V1 (FR-001) and is not exposed as an input. A `package-type` input may be introduced by a future contract revision.

## Permissions

- Workflow token: `contents: read` and `packages: write`; deletion additionally requires that the target package grants
  the executing repository administrative Actions access, or a token (classic PAT or GitHub App) with package
  read/delete permission.
- Dry-run requires only package read access.
- Follow least privilege (R-005): prefer `GITHUB_TOKEN` with explicit package Actions access or a dedicated GitHub App over broad personal tokens.

## Inputs

Required:

- `token`: token used only for GitHub API requests.
- `owner`: organization or user owning the package.
- `package`: exact GHCR package name in V1.

Identity:

- `owner-type`: `auto`, `organization`, or `user`; default `auto` (resolved through the GitHub API).

Retention:

- `protected-tags`: newline-separated exact values or `/regex/` expressions; defaults protect `latest`, `stable`, `production`, and SemVer tags.
- `ephemeral-tags`: newline-separated exact values or `/regex/` expressions; defaults match commit SHAs,
  feature/fix/hotfix/chore/pr prefixes, and scan tags. Mutable branch tags (`main`, `master`, `develop`) are
  intentionally not ephemeral by default.
- `ephemeral-retention-days`: default `30`.
- `untagged-retention-days`: default `7`.
- `keep-latest`: default `10`.
- `delete-untagged`: default `false`.
- `always-keep-newest`: default `true`.

OCI safety:

- `protect-multi-arch`: default `true`; protects platform children of retained multi-arch indexes by inspecting registry manifests.
- `protect-referrers`: default `true`; protects referrers of retained versions via the OCI 1.1 `subject` field and the cosign `sha256-<digest>.<suffix>` tag scheme.
- `delete-orphaned-referrers`: default `false` (since 0.2.0). Makes referrers eligible (`ELIGIBLE_ORPHAN_REFERRER`)
  only under double proof of absence: every subject of the referrer is missing from the package inventory **and** the
  registry answers 404 for its manifest. Only weak retentions (`PROTECTED_UNMATCHED_TAG`, `PROTECTED_TOO_RECENT`) can
  be released; protected tags, keep-latest/newest, OCI protections, and unknown relations are never overridden. Any
  doubt — network failure, authentication error, non-404 response — keeps the referrer retained.

When either flag is enabled and the plan has eligible versions, Arklean exchanges the token for a registry pull token
and fetches one manifest per scanned version (bounded by `concurrency`, with retries). Versions whose manifest cannot
be inspected fail closed as `PROTECTED_UNKNOWN_RELATION`; if a retained version's manifest is unknown, every eligible
untagged version is also protected, because any of them could be its child.

Safety:

- `dry-run`: default `true`.
- `confirm-delete`: required in apply mode; must equal `owner/package` exactly.
- `verify-inventory-before-apply`: default `true`; re-reads the inventory and aborts before the first DELETE if it changed.
- `validate-after-cleanup`: default `true`; re-reads the inventory after apply and fails the run if any protected version disappeared.
- `max-deletions`: default `20`.
- `max-delete-percentage`: default `25`.
- `budget-mode`: default `abort` (since 0.1.2). `abort` fails the run when the plan exceeds a budget
  (`ABORTED_BUDGET_EXCEEDED`); `cap` keeps the oldest candidates that fit both budgets eligible and defers the rest as
  `DEFERRED_BUDGET`, so a large backlog drains across runs instead of blocking them.
- `fail-on-empty`: default `false`; fails when the package has no versions (renamed from `fail-on-no-match`).

Execution:

- `concurrency`: default `2`, maximum `10`.
- `retry-count`: default `3`, maximum `5`.

## Outputs

- `scanned`
- `protected`
- `eligible`
- `deleted`
- `absent`: versions already gone when deletion was attempted (HTTP 404); never counted as `deleted`.
- `failed`
- `plan-sha256`
- `plan-path`
- `result-path`: path of the JSON apply report; the empty string in dry-run.
- `estimated-reclaimed-bytes` (since 0.2.0): best-effort estimate of the bytes the plan's eligible versions would
  reclaim, summed from registry manifest sizes (config + layers, or child descriptors for indexes); the empty string
  when registry inspection did not run.

## Plan and report artifacts

The JSON plan is always written, in both dry-run and apply modes, to a file under the runner temporary directory;
`plan-path` reports its location and `plan-sha256` its canonical hash. Since 0.1.1, the plan outputs (`scanned`,
`protected`, `eligible`, `plan-sha256`, `plan-path`) are emitted as soon as the plan is written, so run-level aborts
that happen after planning (`ABORTED_BUDGET_EXCEEDED`, a `confirm-delete` mismatch, `ABORTED_INVENTORY_CHANGED`) still
expose the plan for audit; the apply outputs (`deleted`, `absent`, `failed`, `result-path`) are only emitted when the
run completes planning and apply. In apply mode a JSON apply report is also written (`result-path`) recording, per
attempted deletion, the outcome (`deleted`, `absent`, or `failed` with the error) plus aggregate counts and the
post-apply validation status. No input controls artifact emission in V0.x. Uploading either file as a workflow artifact
is a documented consumer step (Backlog F5).

## Reason codes

Stable machine-readable codes. Plan reason codes and apply outcomes are distinct namespaces: every version receives
exactly one plan reason code (its final disposition, per the domain model), and versions whose deletion is attempted
additionally receive one outcome in the apply report.

Plan reason codes (one per version):

- `PROTECTED_TAG`
- `PROTECTED_NEWEST`
- `PROTECTED_KEEP_LATEST`
- `PROTECTED_TOO_RECENT`
- `PROTECTED_UNMATCHED_TAG`: a tagged version matching no ephemeral rule is retained.
- `PROTECTED_OCI_CHILD`: platform child of a retained index; `matchedRule` carries the parent digest.
- `PROTECTED_OCI_REFERRER`: signature/attestation/SBOM referrer of a retained version; `matchedRule` carries the subject digest.
- `PROTECTED_UNKNOWN_RELATION`: the relation could not be proven; fails closed per ADR-003 and ADR-005.
- `DEFERRED_BUDGET` (since 0.1.2): candidate exceeding the budgets under `budget-mode: cap`; retained this run and a
  candidate again on future runs. Not a retention guarantee.
- `ELIGIBLE_EPHEMERAL`
- `ELIGIBLE_UNTAGGED`
- `ELIGIBLE_ORPHAN_REFERRER` (since 0.2.0): referrer whose subjects are all confirmed absent, with
  `delete-orphaned-referrers` enabled; `matchedRule` carries the absent subject digest.

Apply outcomes (one per attempted deletion, recorded in the apply report without replacing the plan disposition): `deleted`, `absent`, `failed`.

Run abort codes (run-level, reported in the failure message and Step Summary):

- `ABORTED_BUDGET_EXCEEDED`: a safety budget (`max-deletions` or `max-delete-percentage`) was exceeded by the plan;
  aborts before any DELETE. Only occurs with `budget-mode: abort` (the default); `cap` defers the excess instead.
- `ABORTED_NO_MATCH`: `fail-on-empty` is enabled and the package has no versions.
- `ABORTED_INVENTORY_CHANGED`: the inventory changed between plan and apply; aborts before any DELETE.
- `VALIDATION_FAILED`: post-apply validation found a protected version missing; the run fails even though deletions succeeded.

## Reserved

No names remain reserved as of 0.2.0. Resolution of the previously reserved names:

- Input `delete-orphaned-referrers` and reason code `ELIGIBLE_ORPHAN_REFERRER`: implemented in 0.2.0 (see "OCI
  safety").
- Output `estimated-reclaimed-bytes`: implemented in 0.2.0 (see "Outputs").
- Input `ignore-missing-on-delete`: **will not be implemented**. 404 responses during deletion are always treated as
  idempotent success (`absent`), so the flag is unnecessary; the name is released.

## Matching semantics

- Blank lines and lines beginning with `#` are ignored.
- `/.../` denotes a regular expression; all other values are exact tags.
- Regexes are compiled once after validation.
- Protected rules have precedence over every deletion rule.
- Rules evaluate the complete tag set of a version.
- Invalid patterns fail the action before discovery or deletion.
