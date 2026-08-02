<div align="left">
  <img src="media/banner-arklean.png" alt="Arklean" width="100%" />
</div>

# Arklean

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Arklean-2088FF?logo=githubactions&logoColor=white)](https://github.com/marketplace/actions/arklean)
[![CI](https://github.com/Tooark/action-ark-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/Tooark/action-ark-clean/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/Tooark/action-ark-clean)](https://github.com/Tooark/action-ark-clean/releases)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Safe and explainable lifecycle policies for GitHub Container Registry. Arklean is a JavaScript GitHub Action written in
strict TypeScript, with no runtime npm dependencies.

> **Safety notice:** with `protect-multi-arch` and `protect-referrers` (both on by default), Arklean inspects registry
> manifests and protects platform children of retained multi-arch indexes and their signature/attestation/SBOM referrers;
> relations it cannot prove fail closed (`PROTECTED_UNKNOWN_RELATION`). Still start with `dry-run: true` and review the
> plan before enabling deletion — `delete-untagged` and `delete-orphaned-referrers` stay `false` by default.

🌍 **Languages:** ![USA Flag](https://flagcdn.com/w20/us.png) **English (this file)** · [![Brazil Flag](https://flagcdn.com/w20/br.png) Português](README.pt-BR.md)

## ✨ Features

- 🔍 **Dry-run by default** — plans first, deletes only when explicitly confirmed with `confirm-delete`.
- 🧾 **Explainable decisions** — every version gets a stable, machine-readable reason code in a canonical JSON plan.
- 🛡️ **OCI graph protection** — retains platform children of multi-arch indexes and signature/attestation/SBOM
  referrers; unprovable relations fail closed.
- 🚧 **Safety budgets** — absolute and percentage deletion limits, inventory re-check before the first DELETE, and
  post-apply validation.
- 🪶 **Zero runtime dependencies** — Node built-ins only, committed reproducible bundle, SHA-pinned CI.
- 📦 **One package per run** — fan out over multiple packages with a workflow matrix.

## 🚀 Getting started

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
      - uses: Tooark/action-ark-clean@v0
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

The executing repository needs package administration access. A classic PAT used for deletion needs package read/delete
scopes. Prefer `GITHUB_TOKEN` with explicit package Actions access or a dedicated GitHub App/token.

More examples under [examples/](examples/):

- [minimal-dry-run.yml](examples/minimal-dry-run.yml) — smallest useful setup: a weekly report, nothing deleted
- [full-options.yml](examples/full-options.yml) — every supported input with its default and a short note
- [apply-with-audit.yml](examples/apply-with-audit.yml) — apply mode with plan/report uploaded as audit artifacts
- [tooark-cleanup.yml](examples/tooark-cleanup.yml) — real production case: matrix over many packages

## ⚙️ Inputs

Required:

| Input     | Description                                         |
| --------- | --------------------------------------------------- |
| `token`   | GitHub token with package administration permission |
| `owner`   | Organization or user owning the package             |
| `package` | Exact GHCR package name                             |

Retention policy:

| Input                      | Default                                        | Description                                                            |
| -------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `protected-tags`           | `latest`, `stable`, `production`, SemVer regex | Newline-separated exact tags or `/regex/`; a match retains the version |
| `ephemeral-tags`           | SHA, branch-prefix, and scan regexes           | Newline-separated exact tags or `/regex/` eligible by age              |
| `ephemeral-retention-days` | `30`                                           | Minimum age for ephemeral tagged versions                              |
| `untagged-retention-days`  | `7`                                            | Minimum age for untagged versions                                      |
| `keep-latest`              | `10`                                           | Newest otherwise-eligible tagged versions to retain                    |
| `delete-untagged`          | `false`                                        | Permit deletion of old untagged versions                               |
| `always-keep-newest`       | `true`                                         | Always preserve the newest package version                             |

OCI safety:

| Input                       | Default | Description                                                                                         |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| `protect-multi-arch`        | `true`  | Protect platform children of retained multi-arch indexes                                            |
| `protect-referrers`         | `true`  | Protect signature, attestation, and SBOM referrers of retained versions                             |
| `delete-orphaned-referrers` | `false` | Delete referrers whose subject is confirmed absent (missing from inventory and 404 in the registry) |

Safety and execution:

| Input                           | Default | Description                                                        |
| ------------------------------- | ------- | ------------------------------------------------------------------ |
| `dry-run`                       | `true`  | Plan only; no DELETE requests                                      |
| `confirm-delete`                | —       | Required in apply mode; must equal `owner/package` exactly         |
| `verify-inventory-before-apply` | `true`  | Re-read inventory and abort if it changed before deletion          |
| `validate-after-cleanup`        | `true`  | Re-read inventory after apply; fail if a protected version is gone |
| `max-deletions`                 | `20`    | Absolute deletion safety budget                                    |
| `max-delete-percentage`         | `25`    | Percentage deletion safety budget                                  |
| `budget-mode`                   | `abort` | `abort` fails on exceeded budgets; `cap` defers the excess         |
| `fail-on-empty`                 | `false` | Fail when the package has no versions                              |
| `owner-type`                    | `auto`  | `auto`, `organization`, or `user`                                  |
| `concurrency`                   | `2`     | Concurrent requests, 1–10                                          |
| `retry-count`                   | `3`     | Retries for transient API failures, 0–5                            |

The normative description of every input, output, and reason code is the
[action contract](docs/product/ACTION-CONTRACT.md).

## 📤 Outputs

| Output                      | Description                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `scanned`                   | Number of versions scanned                                                                        |
| `protected`                 | Number of versions retained                                                                       |
| `eligible`                  | Number eligible for deletion                                                                      |
| `deleted`                   | Number deleted                                                                                    |
| `absent`                    | Number already gone when deletion was attempted (idempotent 404)                                  |
| `failed`                    | Number whose deletion failed                                                                      |
| `estimated-reclaimed-bytes` | Best-effort bytes the eligible versions would reclaim; empty when registry inspection did not run |
| `plan-sha256`               | SHA-256 of the canonical cleanup plan                                                             |
| `plan-path`                 | Path of the JSON plan (always written)                                                            |
| `result-path`               | Path of the JSON apply report; empty string in dry-run                                            |

Upload the plan and report as workflow artifacts if you need durable audit records.

## 🧠 Policy semantics

- A protected tag protects the whole package version.
- Tagged versions not matching an ephemeral rule are retained (`PROTECTED_UNMATCHED_TAG`).
- Old matching ephemeral versions become candidates.
- Old untagged versions become candidates only when explicitly enabled; default is `false`.
- With OCI protection enabled and eligible versions present, Arklean fetches one registry manifest per scanned version
  (bounded by `concurrency`): children of retained indexes become `PROTECTED_OCI_CHILD`, referrers (OCI 1.1 `subject` or
  cosign `sha256-<digest>.*` tags) become `PROTECTED_OCI_REFERRER`, and anything unprovable becomes `PROTECTED_UNKNOWN_RELATION`.
- `keep-latest` protects the newest tagged candidates; `always-keep-newest` preserves the newest package version (`PROTECTED_NEWEST`).
- Mutable branch tags (`main`, `master`, `develop`) are **not** ephemeral by default: they may point at the image currently
  in use. Add them to `ephemeral-tags` explicitly if you understand the risk.
- `owner-type` defaults to `auto` and is resolved through the GitHub API.
- Before the first DELETE, Arklean requires safety budgets, exact `confirm-delete: owner/package`, and an unchanged inventory
  re-check.
- After apply, `validate-after-cleanup` re-reads the inventory and fails the run if any protected version disappeared.
- Every decision carries a stable reason code; run-level aborts use `ABORTED_BUDGET_EXCEEDED`, `ABORTED_NO_MATCH`,
  `ABORTED_INVENTORY_CHANGED`, and `VALIDATION_FAILED`.

## 🧪 Development

```bash
corepack enable
pnpm install
pnpm check   # lint + typecheck + build + test
```

The committed `dist/` bundle must always match a fresh build; CI fails otherwise. Tests use the Node built-in test runner
with an HTTP mock of the GitHub API — no network access needed.

## 📚 Documentation

- [Action contract](docs/product/ACTION-CONTRACT.md) — the implemented public contract: inputs, outputs, reason codes,
  reserved names
- [Architecture](docs/architecture/ARCHITECTURE.md) and [domain model](docs/architecture/DOMAIN-MODEL.md)
- [Architecture decision records](docs/adr/) (ADR-001 … ADR-009)
- [Threat model](docs/security/THREAT-MODEL.md), [supply chain](docs/security/SUPPLY-CHAIN.md), and [security notes](docs/SECURITY-NOTES.md)
- [Operations runbook](docs/operations/RUNBOOK.md) — onboarding a package, emergency stop, recovery
- [Test strategy](docs/development/TEST-STRATEGY.md) and [governance](docs/GOVERNANCE.md)
- [Source module reference (pt-BR)](docs/SOURCE-MODULES.pt-BR.md)
- [Changelog](CHANGELOG.md)

The maintained versions of the original planning documents live under [docs/](docs/).

## 🔐 Supply chain

CI actions are pinned by full commit SHA. CodeQL, dependency review, and Dependabot run on every change. Releases are built
from source, checked for bundle reproducibility, published with SHA-256 checksums, a CycloneDX SBOM, and build provenance
attestation; the moving major tag (currently `v0`) is only updated by the protected release workflow. Consumers with a strict posture should
pin a full commit SHA.

Repository-level controls (branch protection, protected `release` environment, secret scanning) are pending until the
repository is public — see [docs/REPO-SETUP.md](docs/REPO-SETUP.md) for status and the exact commands.

## 🤝 Contributing

Contributions are welcome! Start with [CONTRIBUTING.md](CONTRIBUTING.md) — it covers the repository layout, the
development workflow, the commit convention, the DCO sign-off requirement, and the release process.

- 🐛 Found a bug? [Open an issue](https://github.com/Tooark/action-ark-clean/issues/new/choose).
- ✨ Have an idea? Open an issue describing the problem you want to solve.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## 🆘 Help & Security

- 💬 **Questions and help** — see [SUPPORT.md](SUPPORT.md) for all channels and response targets.
- 🔒 **Security vulnerabilities** — never open a public issue; report privately per [SECURITY.md](SECURITY.md).

## 💖 Support

If Arklean saves you storage bills or cleanup scripts, consider supporting the project:

- [GitHub Sponsors](https://github.com/sponsors/paulosfjunior)
- [Ko-fi](https://ko-fi.com/paulosfjunior)

Every contribution helps keep the Tooark family maintained. Thank you! 💙

## 📝 License

Distributed under the [Apache License 2.0](LICENSE).

---

Made with 💙 by [Tooark](https://tooark.com).
