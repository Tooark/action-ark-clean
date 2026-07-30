# Repository setup

Tracks the repository-level security controls required by
[SUPPLY-CHAIN.md](security/SUPPLY-CHAIN.md). The repository became public on
2026-07-30 and **all controls are applied**. The commands below are kept as a
reference for reproducing this setup in other Tooark repositories.

## Applied (2026-07-28)

- [x] Default workflow permissions set to read-only
      (`actions/permissions/workflow`, `default_workflow_permissions: read`,
      `can_approve_pull_request_reviews: false`).
- [x] Dependabot vulnerability alerts enabled.
- [x] Dependabot automated security fixes enabled.
- [x] Dependabot version updates configured
      ([.github/dependabot.yml](../.github/dependabot.yml)).

## Applied (2026-07-30, after going public)

- [x] Repository visibility set to public.
- [x] **Branch protection on `main`** — required status check `test` (strict),
      no force pushes, no deletions, linear history, conversation resolution.
- [x] **Protected `release` environment** — required reviewer approval before
      the release workflow runs; without it, anyone with tag push access could
      trigger a release and move the moving major tag.
- [x] **Secret scanning + push protection** enabled.
- [x] **Private vulnerability reporting** enabled — the "Report a
      vulnerability" flow promised by [SECURITY.md](../SECURITY.md).
- [x] **CodeQL verified green** — going public auto-enabled code scanning
      *default setup*, which rejects SARIF from the repo's own pinned advanced
      workflow; default setup was disabled so the advanced workflow is
      authoritative, and the re-run succeeded.

## Reference — commands used

1. Make the repository public:

   ```bash
   gh repo edit Tooark/action-ark-clean --visibility public --accept-visibility-change-consequences
   ```

2. Branch protection on `main`:

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
   gh api -X PUT repos/Tooark/action-ark-clean/branches/main/protection --input /tmp/protection.json
   ```

   Note: `required_pull_request_reviews` is intentionally null while there is a
   single maintainer (a required approval would deadlock solo PRs). When a
   second maintainer joins, enable it with CODEOWNERS review:
   `{"require_code_owner_reviews": true, "required_approving_review_count": 1}`.

3. Protected `release` environment (reviewer ID via `gh api user --jq .id`):

   ```bash
   printf '{"reviewers":[{"type":"User","id":%s}]}' "$(gh api user --jq .id)" > /tmp/env.json
   gh api -X PUT repos/Tooark/action-ark-clean/environments/release --input /tmp/env.json
   ```

4. Secret scanning and push protection:

   ```bash
   gh api -X PATCH repos/Tooark/action-ark-clean --input - <<'JSON'
   {
     "security_and_analysis": {
       "secret_scanning": { "status": "enabled" },
       "secret_scanning_push_protection": { "status": "enabled" }
     }
   }
   JSON
   ```

5. Private vulnerability reporting:

   ```bash
   gh api -X PUT repos/Tooark/action-ark-clean/private-vulnerability-reporting
   ```

6. Disable code scanning default setup (auto-enabled on going public; conflicts
   with the pinned advanced CodeQL workflow):

   ```bash
   gh api -X PATCH repos/Tooark/action-ark-clean/code-scanning/default-setup -f state=not-configured
   ```

## Where to verify in the GitHub UI

- Branch protection: Settings → Branches → rule for `main`.
- Release environment: Settings → Environments → `release`; during a release
  run, the Actions run shows a "Review deployments" approval gate.
- Secret scanning and push protection: Settings → Advanced Security; alerts
  under Security → Secret scanning alerts.
- Private vulnerability reporting: Security → Advisories → "Report a
  vulnerability".
- CodeQL: Actions → CodeQL workflow (green), alerts under Security → Code
  scanning alerts.

## Future

- When a second maintainer joins, require CODEOWNERS-reviewed pull requests
  (see note in step 2).
