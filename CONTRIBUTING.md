# Contributing to Arklean

First off, thank you for considering contributing to **Arklean**! 🎉

Arklean is a JavaScript GitHub Action, written in strict TypeScript with **zero
runtime npm dependencies**, that applies safe and explainable lifecycle policies
to GitHub Container Registry packages. Because the action performs destructive
operations, contributions are held to a high bar for safety, tests, and
documentation. This document explains how to propose changes, report bugs, and
submit code.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Repository layout](#repository-layout)
- [Development workflow](#development-workflow)
- [The committed dist/ bundle](#the-committed-dist-bundle)
- [Commit convention](#commit-convention)
- [Developer Certificate of Origin (DCO)](#developer-certificate-of-origin-dco)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Releasing](#releasing)
- [Pull Request checklist](#pull-request-checklist)

---

## Ways to contribute

- 🐛 **Report bugs** — open an issue with the bug template. Never include
  tokens or private package metadata; report security issues privately per
  [SECURITY.md](SECURITY.md).
- ✨ **Suggest features** — open an issue first; destructive behavior, new
  inputs, and architecture changes require discussion (and possibly an ADR in
  [docs/adr/](docs/adr/)) before implementation.
- 📖 **Improve documentation** — the READMEs, [docs/](docs/), and the PT-BR
  translations are first-class.
- 💻 **Write code** — see the workflow below.

---

## Repository layout

| Path                 | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `action.yml`         | Public contract of the action (inputs, outputs, runtime)       |
| `src/main.ts`        | Entrypoint and orchestration (plan → apply → validate)         |
| `src/config.ts`      | Input parsing and validation                                   |
| `src/policy.ts`      | Pure, deterministic policy engine (decisions, budgets, hashes) |
| `src/github.ts`      | GitHub REST transport: pagination, retry, delete               |
| `src/oci.ts`         | Registry manifest inspection for OCI graph protection          |
| `src/io.ts`          | Actions I/O: inputs, outputs, masking, summary                 |
| `src/concurrency.ts` | Bounded-concurrency pool                                       |
| `src/types.ts`       | Domain types and contracts                                     |
| `dist/`              | Committed compiled bundle executed by the runner               |
| `tests/`             | Node test runner suites + HTTP mock of the GitHub API/registry |
| `docs/`              | Architecture, ADRs, threat model, runbook, contract            |
| `handoff/`           | Original planning package, kept as reference documentation     |

A module reference in Portuguese lives at
[docs/SOURCE-MODULES.pt-BR.md](docs/SOURCE-MODULES.pt-BR.md). The architecture
rules (e.g. the policy engine never imports network modules) are described in
[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) and
enforced by `tests/architecture.test.js`.

---

## Development workflow

**Prerequisites:** Node 24+ and pnpm (the repo pins `packageManager` in
`package.json`; run `corepack enable` to match it).

1. **Fork** the repository and clone your fork.
2. Install dependencies:

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   ```

3. Create a feature branch: `git checkout -b feat/short-description`.
4. Make your changes with clear, small commits.
5. Run the full check before pushing:

   ```bash
   pnpm check   # lint + typecheck + build + test
   ```

   Individual scripts: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`,
   `pnpm coverage`, and `pnpm format` (applies Biome fixes).

6. **Sign off** every commit (see DCO section below).
7. Push and open a Pull Request against `main`.

---

## The committed dist/ bundle

The runner executes `dist/main.js` directly, so the compiled bundle is
**committed** and must always match a fresh build of `src/`. After any change to
`src/` or `tsconfig.json`:

```bash
pnpm build
git add dist
```

CI rebuilds the bundle and **fails on any drift**, including untracked files
under `dist/`. Never hand-edit `dist/` — change the source and rebuild.

---

## Commit convention

We use [**Conventional Commits**](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short summary>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`. Use the module as the scope when it applies:

```text
feat(policy): protect cosign referrers by tag scheme
fix(github): retry secondary rate limits with Retry-After
docs(readme): clarify confirm-delete requirement
```

---

## Developer Certificate of Origin (DCO)

Arklean uses the [Developer Certificate of Origin](https://developercertificate.org/)
to certify that contributors have the right to submit their contributions under
the project's license (Apache-2.0).

Every commit **must** be signed off:

```bash
git commit -s -m "fix(github): retry secondary rate limits"
```

This appends a `Signed-off-by: Your Name <you@example.com>` line using your
`git config user.name` and `user.email`. To fix the most recent commit:

```bash
git commit --amend -s --no-edit
```

---

## Coding standards

- **Strict TypeScript**, ESM, targeting the `node24` Actions runtime.
- **Zero runtime dependencies** (ADR-006): use Node built-ins (`fetch`,
  `node:crypto`, `node:fs/promises`). Adding a runtime dependency requires a
  superseding ADR — open an issue first.
- **Biome** for linting and formatting: run `pnpm format` before committing.
- **Fail closed** (ADR-003): when safety cannot be proven, protect the version
  and/or abort before the first DELETE. New behavior must preserve this posture.
- **Determinism** (NFR-007): the policy engine takes an injected clock and
  produces stable ordering; plans for the same inventory, policy, and clock must
  be byte-identical.
- **No secrets in logs**: the token is masked immediately and must never reach
  domain objects, plans, reports, or error messages.
- Comments explain _why_ (constraints, invariants), not _what_ the next line
  does; keep them in the codebase's existing style.

---

## Testing

Tests use the **Node built-in test runner** with an in-process HTTP mock of the
GitHub API and registry ([tests/helpers/mock-registry.mjs](tests/helpers/mock-registry.mjs))
— no network access is needed.

- `tests/*.test.js` cover config parsing, policy decisions, transport behavior,
  OCI evidence, properties (e.g. "adding a protected tag never makes a version
  eligible"), architecture rules, and end-to-end runs of `dist/main.js`.
- New or changed behavior **needs tests**. Deletion-safety changes need at least
  one end-to-end test proving nothing unexpected is deleted.
- The full strategy, including coverage targets, is in
  [docs/development/TEST-STRATEGY.md](docs/development/TEST-STRATEGY.md).

Run `pnpm test`, or `pnpm coverage` for coverage output.

---

## Releasing

Releases are automated by
[.github/workflows/release.yml](.github/workflows/release.yml), triggered by
pushing an immutable SemVer tag (`vX.Y.Z`):

1. CI re-runs lint, typecheck, tests, and the bundle-reproducibility check.
2. Checksums (`SHA256SUMS.txt`), a CycloneDX SBOM, and build provenance
   attestation are generated and attached to the GitHub release.
3. The moving major tag (`v1`) is updated **only** by this protected workflow.

Do **not** hand-move tags. Update [CHANGELOG.md](CHANGELOG.md) as part of the
release PR.

---

## Pull Request checklist

Before opening a PR, confirm:

- [ ] Commits follow Conventional Commits
- [ ] Every commit is signed off (`git commit -s`)
- [ ] `pnpm check` passes locally
- [ ] `dist/` was rebuilt and committed if `src/` changed
- [ ] Tests cover the change (deletion-safety changes include an e2e test)
- [ ] Documentation is updated (README, docs/, PT-BR where applicable)
- [ ] No secrets, real tokens, or private package metadata in code, tests, or
      fixtures
- [ ] Architecture/destructive-behavior changes reference an ADR

Thank you for making Arklean better! 💙
