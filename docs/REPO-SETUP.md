# Repository setup — pending items

Tracks the repository-level security controls required by
[SUPPLY-CHAIN.md](../handoff/docs/security/SUPPLY-CHAIN.md). Some are applied;
the rest are **blocked only because the repository is private on the free
plan**. Arklean is Apache-2.0 and the GitHub Marketplace requires a public
repository anyway, so the pending items below must be resolved **as soon as the
repository is made public** (or the organization moves to a paid plan).

## Applied (2026-07-28)

- [x] Default workflow permissions set to read-only
      (`actions/permissions/workflow`, `default_workflow_permissions: read`,
      `can_approve_pull_request_reviews: false`).
- [x] Dependabot vulnerability alerts enabled.
- [x] Dependabot automated security fixes enabled.
- [x] Dependabot version updates configured
      ([.github/dependabot.yml](../.github/dependabot.yml)).

## Pending — blocked by private repo on the free plan

Attempted on 2026-07-28 and rejected by the API (HTTP 403/422: requires a paid
plan or a public repository):

- [ ] **Branch protection on `main`** — required status check `test` (strict),
      no force pushes, no deletions, linear history, conversation resolution.
- [ ] **Protected `release` environment** — required reviewer approval before
      the release workflow runs; without it, anyone with tag push access could
      trigger a release and move the `v1` tag.
      The [release workflow](../.github/workflows/release.yml) already declares
      `environment: release`.
- [ ] **Secret scanning + push protection** — requires GHAS on private repos;
      free on public repos.
- [ ] **Verify CodeQL uploads** — CodeQL result upload may fail on private
      repos without GHAS; confirm the workflow is green after going public.

## How to resolve

1. Make the repository public when ready:

   ```bash
   gh repo edit Tooark/action-arklean --visibility public --accept-visibility-change-consequences
   ```

2. Apply branch protection:

   ```bash
   cat > /tmp/protection.json <<'JSON'
   {
     "required_status_checks": { "strict": true, "contexts": ["test"] },
     "enforce_admins": false,
     "required_pull_request_reviews": null,
     "restrictions": null,
     "allow_force_pushes": false,
     "allow_deletions": false,
     "required_linear_history": true,
     "required_conversation_resolution": true
   }
   JSON
   gh api -X PUT repos/Tooark/action-arklean/branches/main/protection --input /tmp/protection.json
   ```

   Note: `required_pull_request_reviews` is intentionally null while there is a
   single maintainer (a required approval would deadlock solo PRs). When a
   second maintainer joins, enable it with CODEOWNERS review:
   `{"require_code_owner_reviews": true, "required_approving_review_count": 1}`.

3. Create the protected `release` environment (reviewer ID via `gh api user --jq .id`):

   ```bash
   printf '{"reviewers":[{"type":"User","id":%s}]}' "$(gh api user --jq .id)" > /tmp/env.json
   gh api -X PUT repos/Tooark/action-arklean/environments/release --input /tmp/env.json
   ```

4. Enable secret scanning and push protection:

   ```bash
   gh api -X PATCH repos/Tooark/action-arklean --input - <<'JSON'
   {
     "security_and_analysis": {
       "secret_scanning": { "status": "enabled" },
       "secret_scanning_push_protection": { "status": "enabled" }
     }
   }
   JSON
   ```

5. Re-run the CodeQL workflow and confirm it is green.

6. Update this file, checking the boxes above.
