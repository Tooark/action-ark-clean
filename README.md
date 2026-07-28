# Arklean

Safe and explainable lifecycle policies for GitHub Container Registry. Arklean is a JavaScript GitHub Action written in strict TypeScript, with no runtime npm dependencies.

> **Safety notice:** with `protect-multi-arch` and `protect-referrers` (both on by default), Arklean inspects registry manifests and protects platform children of retained multi-arch indexes and their signature/attestation/SBOM referrers; relations it cannot prove fail closed (`PROTECTED_UNKNOWN_RELATION`). Still start with `dry-run: true` and review the plan before enabling deletion — orphan referrer cleanup is not implemented yet, and `delete-untagged` stays `false` by default.

## Usage

```yaml
name: Cleanup GHCR
on:
  workflow_dispatch:
    inputs:
      dry-run: { type: boolean, default: true }
  schedule:
    - cron: "0 3 * * 1"
permissions:
  contents: read
  packages: write
jobs:
  cleanup:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [aws-cli, gcloud-cli, tofu]
    steps:
      - uses: Tooark/arklean@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          owner: ${{ github.repository_owner }}
          package: ${{ matrix.package }}
          dry-run: ${{ github.event_name != 'workflow_dispatch' || inputs.dry-run }}
          # Required when dry-run is false; must equal owner/package exactly:
          # confirm-delete: ${{ github.repository_owner }}/${{ matrix.package }}
          keep-latest: 10
          max-deletions: 20
          max-delete-percentage: 25
```

The executing repository needs package administration access. A classic PAT used for deletion needs package read/delete scopes. Prefer `GITHUB_TOKEN` with explicit package Actions access or a dedicated GitHub App/token.

## Policy semantics

- A protected tag protects the whole package version.
- Tagged versions not matching an ephemeral rule are retained (`PROTECTED_UNMATCHED_TAG`).
- Old matching ephemeral versions become candidates.
- Old untagged versions become candidates only when explicitly enabled; default is `false`.
- With OCI protection enabled and eligible versions present, Arklean fetches one registry manifest per scanned version (bounded by `concurrency`): children of retained indexes become `PROTECTED_OCI_CHILD`, referrers (OCI 1.1 `subject` or cosign `sha256-<digest>.*` tags) become `PROTECTED_OCI_REFERRER`, and anything unprovable becomes `PROTECTED_UNKNOWN_RELATION`.
- `keep-latest` protects the newest tagged candidates; `always-keep-newest` preserves the newest package version (`PROTECTED_NEWEST`).
- Mutable branch tags (`main`, `master`, `develop`) are **not** ephemeral by default: they may point at the image currently in use. Add them to `ephemeral-tags` explicitly if you understand the risk.
- `owner-type` defaults to `auto` and is resolved through the GitHub API.
- Before the first DELETE, Arklean requires safety budgets, exact `confirm-delete: owner/package`, and an unchanged inventory re-check.
- After apply, `validate-after-cleanup` re-reads the inventory and fails the run if any protected version disappeared.
- Every decision carries a stable reason code; run-level aborts use `ABORTED_BUDGET_EXCEEDED`, `ABORTED_NO_MATCH`, `ABORTED_INVENTORY_CHANGED`, and `VALIDATION_FAILED`.

## Outputs

`scanned`, `protected`, `eligible`, `deleted`, `absent` (already gone when deletion was attempted), `failed`, `plan-sha256`, `plan-path` (canonical JSON plan, always written), and `result-path` (JSON apply report with per-version outcomes; empty in dry-run). Upload the plan and report as workflow artifacts if you need durable audit records.

## Development

```bash
corepack enable
pnpm install
pnpm check   # lint + typecheck + build + test
```

The committed `dist/` bundle must always match a fresh build; CI fails otherwise. Tests use the Node built-in test runner with an HTTP mock of the GitHub API — no network access needed.

## Supply chain

CI actions are pinned by full commit SHA. CodeQL, dependency review, and Dependabot run on every change. Releases are built from source, checked for bundle reproducibility, published with SHA-256 checksums, a CycloneDX SBOM, and build provenance attestation; the moving `v1` tag is only updated by the protected release workflow. Consumers with a strict posture should pin a full commit SHA.

Repository-level controls (branch protection, protected `release` environment, secret scanning) are pending until the repository is public — see [docs/REPO-SETUP.md](docs/REPO-SETUP.md) for status and the exact commands.

## License

Apache-2.0.
