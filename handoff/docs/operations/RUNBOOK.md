# Operations runbook

## Onboarding a package

1. Grant the workflow repository administrative Actions access to the target package or use an approved token.
2. Run Arklean manually with `dry-run: true`.
3. Download/review the JSON plan and Step Summary.
4. Confirm protected multi-tag, SemVer, latest/stable/production, multi-arch, and signed images.
5. Repeat against at least two scheduled cycles in dry-run.
6. Set explicit deletion budgets.
7. Enable apply and monitor the first execution.

## Emergency stop

- Disable the workflow.
- Revoke or rotate the token if compromise is suspected.
- Remove the repository's package Admin access.
- Preserve logs, plan JSON, run ID, commit SHA, and policy configuration.

## Recovery

- Identify deleted version IDs and timestamps from the plan/results.
- Use GitHub-supported restoration during the available restoration period when eligible.
- If restoration is unavailable, rebuild from the immutable source commit and verified build inputs.
- Validate manifests, signatures, attestations, and deployment references before republishing mutable tags.

## Common failures

- `403`: verify package Actions access, owner type, and token permissions.
- `404`: verify URL-encoded package name and package ownership; during delete it may be idempotent.
- `422`: inspect package constraints and API response without printing secrets.
- Rate limit: honor response headers and retry within configured bounds.
- Safety budget exceeded: review regex and retention policy; never bypass without inspecting the plan.
- Validation failure: stop further cleanup and investigate OCI graph assumptions.
