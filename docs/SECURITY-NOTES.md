# Security notes

- `dry-run` defaults to true.
- The token is masked immediately and is not included in plans or reports.
- Inputs are validated before network access.
- The action never invokes a shell with package metadata.
- API errors contain status and version ID, not response bodies that may expose information.
- Pagination refuses inventories beyond 1000 pages instead of using partial data.
- Duplicate version IDs abort the run instead of producing an ambiguous inventory.
- Deletion is bounded by absolute and percentage budgets: with `budget-mode: abort` (default) an exceeded budget fails
  the run (`ABORTED_BUDGET_EXCEEDED`); with `cap`, excess candidates are deferred (`DEFERRED_BUDGET`) and the budgets
  still bound what a single run can delete.
- Apply requires exact `confirm-delete: owner/package`.
- Inventory is re-read before deletion; changes abort the run (`ABORTED_INVENTORY_CHANGED`).
- After apply, the inventory is re-read again and the run fails if any protected version disappeared (`VALIDATION_FAILED`), even when deletions succeeded.
- A JSON apply report records the outcome of every attempted deletion (`deleted`, `absent`, `failed`) for audit.
- 404 during deletion is treated as idempotent success (`absent`), never counted as `deleted`.
- Secondary rate limits (403 with `Retry-After` or an exhausted quota) are retried with bounded backoff; a plain 403 is not retried.
- Untagged deletion defaults to false.
- Mutable branch tags are not ephemeral by default.
- The newest package version is retained by default.
- With `protect-multi-arch`/`protect-referrers` (default true), registry manifests are inspected: children of retained
  indexes and referrers of retained versions are protected, and any relation that cannot be proven fails closed as
  `PROTECTED_UNKNOWN_RELATION` — including full registry unavailability, which protects every eligible untagged version.
- The registry pull token obtained for manifest inspection is scoped to `pull` on the single package.
- Orphan referrer cleanup (`delete-orphaned-referrers`, default false) requires double proof of absence: every subject
  missing from the inventory and a 404 from the registry for its manifest. Only weak retentions can be released; any
  doubt keeps the referrer.
- CI actions are pinned by full commit SHA; releases ship checksums, SBOM, and build provenance.
