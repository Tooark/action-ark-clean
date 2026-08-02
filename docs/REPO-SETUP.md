# Repository setup

Tracks the repository-level security controls required by
[SUPPLY-CHAIN.md](security/SUPPLY-CHAIN.md). The repository became public on
2026-07-30. Core controls are applied; items the supply-chain policy marks
"where practical" (reviews, signed commits, DCO) are **deferred by explicit
decision** and tracked below with their re-evaluation triggers. The commands
are kept as a reference for reproducing this setup in other Tooark
repositories.

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

## Applied (2026-08-01)

- [x] **Collaborator roles consolidated** — two admins, one per person:
      `paulosfjunior` (code) and `stenioignacio` (Tooark org admin, devops
      focus). Duplicate personal/corporate accounts demoted to `triage`
      (`gh api -X PUT repos/Tooark/action-ark-clean/collaborators/<user>
      -f permission=triage`). Fewer admin accounts, fewer catastrophic
      compromise targets.
- [x] **Local `gh` token extended with `read:packages`**
      (`gh auth refresh --hostname github.com --scopes read:packages`) to
      inspect GHCR packages and versions with the local account. `refresh`
      *adds* the scope to the existing grant; no re-login needed.
- [x] **Tag ruleset `protect-release-tags`** (id 20208361) — deletion and
      non-fast-forward moves blocked for `v*` tags; bypass restricted to the
      Repository admin role, so the moving major tag is updated only through
      the release flow, as SUPPLY-CHAIN.md requires (step 7 below).
- [x] **Deployment branch policy on `release`** — the environment now accepts
      only `v*` tag refs (`custom_branch_policies`), making the approval gate
      the single door to a release instead of one of the doors (step 8 below).
- [x] **Auto-merge + branch hygiene** — `allow_auto_merge`,
      `delete_branch_on_merge` and `allow_update_branch` enabled; merge
      commits disabled (linear history already blocked them in practice).
      Auto-merge is opt-in per PR and still waits for the strict `test`
      check; do not automate it for Dependabot PRs — review the diff first,
      then `gh pr merge <n> --auto --squash` (step 9 below).
- [x] **SHA pinning required for actions** — `sha_pinning_required: true`
      turns the workflows' existing pin-by-SHA discipline into
      platform-enforced policy: a future PR with `uses: someone/action@main`
      is rejected by GitHub itself (step 10 below).

## Deferred by decision (2026-08-01)

SUPPLY-CHAIN.md asks for reviews, signed commits "where practical", and DCO.
These are deferred, not forgotten — each has a re-evaluation trigger.

- **Required PR reviews + CODEOWNERS** — there are two admins but a single
  active *code reviewer*: `stenioignacio` is devops-focused and does not
  review code, which stays with `paulosfjunior`. Requiring one approval
  would deadlock solo PRs (authors cannot approve their own).
  *Trigger:* a second active code reviewer joins. Then apply
  `{"required_approving_review_count": 1, "require_code_owner_reviews": true}`
  in the branch protection body and add a CODEOWNERS file.
- **`prevent_self_review` on the `release` environment** — the only
  registered reviewer is also who triggers releases; enabling it would block
  every release. *Trigger:* register `stenioignacio` as a second environment
  reviewer (release approval is a devops role, distinct from code review),
  then enable.
- **DCO (`.github/dco.yml` + DCO App)** — legal provenance certification
  (`Signed-off-by`, `git commit -s`), the lowest-friction IP protection for
  an Apache-2.0 project. The yml alone does nothing: the DCO App
  (github.com/apps/dco) must be installed to create the PR check.
  *Trigger:* meaningful external contributions. When adopting: set
  `require: members: false` (sign-off required from external contributors
  only), enable `web_commit_signoff_required` on the repo so web-UI commits
  auto-sign-off, and document it in CONTRIBUTING.md.
- **Required commit signatures** — rejected on `main`: linear history forces
  squash/rebase through the web UI and GitHub signs the resulting commit
  itself (web-flow key), so the check would always pass — zero gain.
  Requiring signatures on PR branches would add real authenticity but blocks
  first-time external contributors without GPG/SSH signing set up.
  *Trigger:* project traction with recurring contributors.

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

   Note: `required_pull_request_reviews` is intentionally null — see
   "Deferred by decision" above. Revisited on 2026-08-01: the constraint is
   a single active *code reviewer*, not a single maintainer.

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

7. Tag ruleset protecting `v*` (deletion + non-fast-forward blocked;
   `actor_id: 5` is the Repository admin role, kept as bypass so the release
   flow can move the major tag):

   ```bash
   gh api -X POST repos/Tooark/action-ark-clean/rulesets --input - <<'JSON'
   {
     "name": "protect-release-tags",
     "target": "tag",
     "enforcement": "active",
     "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
     "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ],
     "bypass_actors": [
       { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
     ]
   }
   JSON
   ```

8. Restrict the `release` environment to `v*` tags (the PUT replaces the
   whole environment config, so reviewers go in the same body):

   ```bash
   printf '{"reviewers":[{"type":"User","id":%s}],
     "deployment_branch_policy":{"protected_branches":false,
     "custom_branch_policies":true}}' "$(gh api user --jq .id)" \
     | gh api -X PUT repos/Tooark/action-ark-clean/environments/release --input -

   gh api -X POST \
     repos/Tooark/action-ark-clean/environments/release/deployment-branch-policies \
     -f name='v*' -f type=tag
   ```

9. Auto-merge and branch hygiene:

   ```bash
   gh repo edit Tooark/action-ark-clean \
     --enable-auto-merge \
     --delete-branch-on-merge \
     --allow-update-branch \
     --enable-merge-commit=false
   ```

10. Require SHA pinning for actions (the PUT replaces the whole object, so
    `enabled` and `allowed_actions` go in the same call):

    ```bash
    gh api -X PUT repos/Tooark/action-ark-clean/actions/permissions \
      -F enabled=true -f allowed_actions=all -F sha_pinning_required=true
    ```

## Where to verify in the GitHub UI

- Branch protection: Settings → Branches → rule for `main`.
- Release environment: Settings → Environments → `release`; deployment
  branches and tags shows the `v*` tag rule; during a release run, the
  Actions run shows a "Review deployments" approval gate.
- Tag ruleset: Settings → Rules → Rulesets → `protect-release-tags`.
- Secret scanning and push protection: Settings → Advanced Security; alerts
  under Security → Secret scanning alerts.
- Private vulnerability reporting: Security → Advisories → "Report a
  vulnerability".
- CodeQL: Actions → CodeQL workflow (green), alerts under Security → Code
  scanning alerts.
- Collaborators: Settings → Collaborators and teams (2 admins, 4 triage).
- Actions policy: Settings → Actions → General (read-only token, SHA pinning
  required).
