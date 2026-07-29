# Security Policy

## Reporting a vulnerability

The Arklean maintainers take security seriously. Arklean performs **destructive
operations** against GitHub Container Registry packages, so any flaw that could
cause unintended deletion, token exposure, or supply-chain compromise is treated
as high priority. If you believe you have found a security vulnerability, please
report it **privately** so we can address it before public disclosure.

### How to report

**Do NOT** open a public GitHub issue for security vulnerabilities.

Instead, use one of the following channels:

1. **Preferred** — GitHub Security Advisories:
   [Report a vulnerability](https://github.com/Tooark/action-ark-clean/security/advisories/new)
2. **Email** — `security@tooark.com` (PGP key available on request)

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept if possible)
- The affected version, tag, or commit SHA
- A **redacted** workflow configuration and logs — never include live tokens or
  private package metadata
- Your name / handle for credit (optional)

Examples of reports we want to receive privately: suspected token exposure in
logs or artifacts, a policy or OCI-graph flaw that deletes a version that should
have been protected, workflow-command injection through package metadata, and
any compromise of the release pipeline or the `v1` moving tag.

### What to expect

| Milestone                            | Target time                                             |
| ------------------------------------ | ------------------------------------------------------- |
| Acknowledgment of report             | Within **72 hours**                                     |
| Initial triage & severity assessment | Within **5 business days**                              |
| Fix and coordinated disclosure plan  | Within **30 days** (may be extended for complex issues) |
| Public advisory (if applicable)      | After a fixed release is published                      |

We follow the principles of
[Coordinated Vulnerability Disclosure (CVD)](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).

Because Arklean is destructive, a security fix may require immediate consumer
action: rotating the moving `v1` tag and asking consumers pinned to a SHA or
SemVer tag to update. Advisories will state explicitly when a pin update is
required.

## Supported versions

| Version                          | Supported                                  |
| -------------------------------- | ------------------------------------------ |
| Latest release (`v1` moving tag) | ✅ Receives security fixes                 |
| Older SemVer tags / pinned SHAs  | ❌ Update your pin to the latest release   |
| `main` (unreleased)              | ❌ Not intended for production consumption |

Always update to the latest release before reporting a bug or vulnerability.

## Scope

In scope:

- Vulnerabilities in Arklean's action code (`src/`, `dist/`, `action.yml`,
  release scripts and workflows)
- Deletion-safety flaws: anything that makes Arklean delete a version its
  documented policy says is protected (tag protection, OCI multi-arch children,
  referrers, budgets, fail-closed behavior)
- Token handling: leakage of the `token` input into logs, outputs, summaries,
  plans, or reports
- Supply-chain issues in Arklean's build pipeline, committed `dist/` bundle,
  release artifacts, or declared (dev) dependencies

Out of scope:

- Vulnerabilities in GitHub, GHCR, or the Actions runner (report to
  [GitHub](https://hackerone.com/github))
- Misconfiguration of the consumer's workflow (e.g. overly broad tokens,
  deliberately raised deletion budgets, adding mutable branch tags to
  `ephemeral-tags`)
- Deletion behavior explicitly enabled by documented inputs and confirmed via
  `confirm-delete`
- Social engineering, physical attacks, and denial of service

For the full analysis of assets, trust boundaries, and controls, see the
[threat model](docs/security/THREAT-MODEL.md) and the
[security notes](docs/SECURITY-NOTES.md).

## Safe harbor

We support security research conducted in good faith. If you follow this policy,
we will:

- Not pursue legal action against you
- Work with you to understand and resolve the issue
- Publicly credit you (if you wish) in the security advisory

## Bounties

Arklean is an open-source project maintained by volunteers. **No monetary bounty
program is currently offered**, but we deeply appreciate responsible disclosure
and will credit reporters publicly.
