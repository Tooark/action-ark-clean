# Arklean

**Secure, explainable lifecycle policies for GitHub Container Registry.**

Arklean is an open-source GitHub Action from the Tooark/Ark* ecosystem for safely discovering, planning, and deleting old GHCR container package versions. It emphasizes dry-run-by-default behavior, OCI relationship preservation, auditable decisions, least privilege, and supply-chain integrity.

> Status: implementation in progress. Discovery, the deterministic policy engine, safe apply, and OCI graph protection (roadmap V0.1-V0.4, except orphan referrer cleanup) are implemented in the repository root. These handoff documents remain the planning baseline, and `docs/product/ACTION-CONTRACT.md` reflects the implemented contract.

## Product identity

- Repository: `Tooark/arklean`
- Marketplace name: `Arklean - Secure GHCR Cleanup`
- License: Apache-2.0
- Primary language: TypeScript
- Distribution: JavaScript GitHub Action with a committed standalone bundle
- Default mode: dry-run

## Goals

- Apply retention policies to GHCR packages without depending on cleanup actions from third parties at runtime.
- Preserve protected tags, retained OCI indexes, platform manifests, signatures, attestations, and SBOM referrers.
- Explain every keep/delete decision.
- Provide safety budgets before destructive operations.
- Support organization and user package owners.

## Non-goals for V1

- Generic registry support outside GHCR.
- Deleting repositories, releases, Actions artifacts, or caches.
- Mutating tags independently of package versions.
- Serving as a vulnerability scanner.

## Documentation map

- [Vision and scope](docs/product/VISION.md)
- [Requirements](docs/product/REQUIREMENTS.md)
- [Action contract](docs/product/ACTION-CONTRACT.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Domain model](docs/architecture/DOMAIN-MODEL.md)
- [Threat model](docs/security/THREAT-MODEL.md)
- [Security and supply chain](docs/security/SUPPLY-CHAIN.md)
- [Roadmap](docs/product/ROADMAP.md)
- [Backlog](docs/product/BACKLOG.md)
- [Implementation plan](docs/development/IMPLEMENTATION-PLAN.md)
- [Claude Code prompt](prompts/CLAUDE-CODE-BOOTSTRAP.md)

## Proposed usage

```yaml
permissions:
  contents: read
  packages: write

steps:
  - name: Apply GHCR retention policy
    uses: Tooark/arklean@v1
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      owner: ${{ github.repository_owner }}
      package: tofu-aws
      protected-tags: |
        latest
        stable
        production
        /^v?\d+(\.\d+){0,2}$/
      ephemeral-tags: |
        /^sha-[0-9a-f]{7,40}$/
        /^[0-9a-f]{7,40}$/
        /^(feature|fix|hotfix|chore|pr)[-_].+$/
      ephemeral-retention-days: 30
      untagged-retention-days: 7
      keep-latest: 10
      max-deletions: 20
      max-delete-percentage: 25
      dry-run: true
```

## Decision gate before coding

Approve ADRs 001-009, validate GHCR fixture metadata, reserve the Marketplace name, and confirm `Arklean` does not conflict with existing Tooark branding.
