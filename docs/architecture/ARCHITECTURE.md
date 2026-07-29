# Architecture

## Style

A functional core / imperative shell keeps destructive transport outside deterministic policy logic.

```text
action entrypoint
  -> configuration
  -> GitHub package gateway
  -> inventory normalizer
  -> OCI relation graph
  -> policy engine
  -> cleanup plan + safety gate
  -> dry-run reporter OR deletion executor
  -> post-apply validator
```

## Suggested modules

```text
src/
  action/       input, output, step summary, entrypoint
  config/       schema, parser, rule compiler
  github/       REST transport, endpoints, pagination, retry
  domain/       package version, tag, relation, decision, plan
  oci/          relation graph, subject/referrer classification
  policy/       evaluators, precedence, retention budgets
  apply/        deletion executor and post-apply validation
  report/       canonical JSON, summary, output writer
  security/     redaction and safe errors
```

The V0.x implementation intentionally uses a flat layout (`config.ts`, `github.ts`, `io.ts`, `main.ts`, `policy.ts`, `types.ts`) with the same logical boundaries; the directory structure above becomes worthwhile when the `oci` module lands in V0.4. The boundaries are enforced by an architecture test that inspects import statements (Backlog A4).

## Dependency rule

- `domain` and `policy` import no GitHub Actions or network modules.
- `github` implements interfaces owned by the application/domain boundary.
- `action` composes dependencies and is the only environment-aware module.
- The policy engine receives an injected clock.

## Discovery

Fetch all versions with explicit API version headers. Retain raw metadata only for diagnostics after redaction; normalize fields used by policy. Pagination must stop only when no `next` link remains.

## Planning

Planning is pure and deterministic. It accepts normalized inventory, relation graph, policy, and instant. It returns decisions, counts, canonical ordering, and safety-gate status. No delete request occurs during planning.

## Apply

Apply consumes the already-approved plan. It must never recompute eligibility per item. Before the first deletion, verify budgets and configuration. Handle transient failures with bounded exponential backoff and jitter. Return partial results without hiding failures.

## Validation

Rediscover inventory and rebuild the graph. Confirm every retained root has its required retained relations. Validation failure makes the action fail even if API deletions succeeded.

## Runtime dependency posture

The normative rule is zero runtime dependencies (ADR-006); any runtime dependency requires a superseding ADR. Use built-in `fetch`, URL, crypto, and filesystem APIs. Development dependencies may include TypeScript, a test runner, linter, formatter, and bundler. The release bundle is committed because JavaScript Actions execute the referenced file directly.
