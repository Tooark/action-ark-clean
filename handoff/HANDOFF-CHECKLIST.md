# Handoff checklist

## Before implementation

- [ ] Confirm final name `Arklean` and repository `Tooark/arklean`.
- [ ] Check Marketplace name availability and branding conflicts.
- [ ] Approve ADR-001 through ADR-009.
- [ ] Confirm V1 exact package scope and deferred organization mode.
- [ ] Capture anonymized fixtures from representative Tooark packages.
- [ ] Inventory current signature, attestation, SBOM, and multi-arch publishing methods.
- [ ] Define a disposable GHCR end-to-end test package.

## Before applying to production packages

- [ ] Compare Arklean dry-run against manual expectations and existing cleanup action.
- [ ] Validate complete pagination.
- [ ] Validate multi-tag protected precedence.
- [ ] Pull retained multi-arch images after test cleanup.
- [ ] Verify retained signatures/attestations/SBOMs.
- [ ] Run scheduled dry-run for at least two cycles.
- [ ] Configure conservative deletion budgets.
- [ ] Document recovery and responsible owner.

## Before Marketplace V1

- [ ] Complete security review.
- [ ] Verify bundle reproducibility.
- [ ] Publish SBOM, provenance, checksums, and signed release.
- [ ] Test SHA, SemVer, and `v1` consumer references.
- [ ] Review README and README.pt-BR.
- [ ] Accept Marketplace Developer Agreement and publish release.
