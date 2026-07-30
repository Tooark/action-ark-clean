# Threat model

## Assets

- GitHub token and its effective package permissions.
- GHCR package versions and retained OCI relationships.
- Cleanup policy and generated plan.
- Workflow logs, summaries, outputs, and release artifacts.
- Arklean source, bundle, tags, releases, and publishing credentials.

## Trust boundaries

- Workflow author to Action inputs.
- Runner environment to Arklean process.
- Arklean to GitHub REST API.
- Untrusted package/tag metadata to logs and regex evaluation.
- Source repository to built `dist` bundle and Marketplace release.

## Principal threats and controls

### Excessive deletion

Causes include bad regex, empty protection list, partial pagination, clock errors, or API schema changes. Controls: dry-run, validation, fail-closed behavior, absolute/percentage budgets, always-keep-newest, complete-pagination invariant, canonical plan, and pre-delete safety gate.

### Breaking OCI images

A deleted child or referrer can invalidate a retained image or its evidence. Controls: graph protection, conservative unknown handling, fixture tests, and post-apply validation.

### Token disclosure

Causes include raw exception logging, request dumps, debug output, or malicious metadata. Controls: never store token in domain objects, authorization redaction, GitHub masking, safe error types, and log-leak tests.

### Injection and log manipulation

Tags/package metadata may contain newlines or terminal sequences. Controls: structured formatting, escaping, maximum lengths, no shell execution, and no evaluation of metadata as code.

### Regex denial of service

User regex may cause catastrophic backtracking. Controls: pattern length/count limits, safe-regex analysis if adopted, execution strategy review, and documented trusted-workflow assumption.

### Supply-chain compromise

Threats include dependency takeover, mutable tags, compromised release workflow, or mismatched bundle. Controls: zero/minimal runtime deps, lockfile, dependency review, CodeQL, secret scanning, license checks, SBOM, provenance, signed releases, protected environments, SHA examples, and reproducible-bundle checks.

### TOCTOU inventory changes

A package can change between plan and apply. Controls: inventory fingerprint, short plan/application window, optional recheck before apply, and post-apply validation. A future signed two-stage plan must include expiry and inventory fingerprint.

## Abuse cases

- Attacker submits a PR changing regex defaults to match every version.
- A compromised dependency exfiltrates the token.
- A maintainer moves the moving major tag to unreviewed code.
- A package has more than one page but only the first page is evaluated.
- A version has `latest` and `sha-*`; naive logic deletes it.
- A manifest child appears untagged and old but is still referenced.

Each abuse case requires at least one automated test or release control before V1.
