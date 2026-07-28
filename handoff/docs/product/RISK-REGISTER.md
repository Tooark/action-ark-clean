# Risk register

## R-001 Accidental mass deletion — Critical

Mitigation: dry-run default, budgets, newest protection, fail-closed validation, plan summary, integration tests. Residual risk: authorized maintainer can deliberately raise limits.

## R-002 Broken multi-arch image — Critical

Mitigation: OCI graph, retained-parent propagation, unknown-relation protection, post-apply validation, end-to-end pulls.

## R-003 Deleted signature/attestation/SBOM — High

Mitigation: referrer preservation, conservative orphan definition, fixture coverage, orphan deletion disabled by default initially.

## R-004 Incomplete API pagination — Critical

Mitigation: pagination contract tests, next-link loop detection, maximum-page anomaly handling, complete-inventory prerequisite.

## R-005 Token compromise — Critical

Mitigation: least privilege, GITHUB_TOKEN/GitHub App preference, masking, no request dumps, protected workflows, minimal runtime dependencies.

## R-006 Marketplace or moving-tag compromise — High

Mitigation: immutable release tags, protected release workflow, provenance, SHA pinning guidance, CODEOWNERS.

## R-007 GHCR/API metadata changes — High

Mitigation: explicit API version, typed tolerant parsing, fail closed for missing safety fields, scheduled fixture validation.

## R-008 Regex performance or overmatch — High

Mitigation: validation, limits, dry-run, budgets, safe-regex review, protected precedence.

## R-009 Time-of-check/time-of-use race — Medium

Mitigation: inventory fingerprint, optional pre-apply check, short execution window, post-apply validation.

## R-010 Name confusion with similar cleanup actions or other Tooark/Ark* projects — Medium

Mitigation: use Arklean consistently, clarify in documentation that Arklean is the Tooark GHCR retention/cleanup action and distinct from other Ark* tools and third-party cleanup actions, review Marketplace and trademark availability before release.
