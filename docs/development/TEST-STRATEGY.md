# Test strategy

## Unit tests

- Input parsing and validation.
- Exact/regex rule compilation.
- Protection precedence and multi-tag cases.
- Age boundaries with injected fixed clock.
- Keep-latest deterministic ordering.
- Safety budgets and plan hashing.
- Redaction and safe formatting.

## Fixture contract tests

Store anonymized GitHub API responses for:

- Fewer/more than 100 versions and pagination links.
- Tagged, untagged, SemVer, branch, SHA, and scan tags.
- One version with both protected and ephemeral tags.
- Multi-arch indexes and untagged platform children.
- Cosign signatures, attestations, provenance, and SBOM patterns observed in Tooark.
- Stale referrers with confirmed missing subjects.
- Unknown OCI relation types.

## Integration tests

Use an HTTP mock server to verify endpoints, URL encoding, headers, pagination, retry, rate-limit behavior, DELETE order, and redaction.

## End-to-end tests

Use disposable private/public test packages in a dedicated repository. Publish fixtures, run dry-run, compare plan, apply within tiny budgets, then verify pullability and attached evidence.

## Mutation and property tests

Mutation testing is especially valuable for protection precedence and safety gates. Property tests should assert that adding a protected tag can never change a version from protected to eligible, and reducing deletion budgets can never increase deletions.

## Release gate

No V1 release until all acceptance fixtures pass, coverage thresholds are met (>=90% statement and branch coverage in the policy engine per NFR-006, and >=80% statement coverage across the remaining modules), `dist` is reproducible, and an end-to-end multi-arch signed image remains usable after cleanup.
