# Support

Thanks for your interest in **Arklean**! 💙

This document explains where to get help based on what you're trying to do.

---

## 🤔 I have a question

**Use [GitHub Discussions](https://github.com/Tooark/action-ark-clean/discussions).**

Please **search existing discussions** first — your question may already be
answered. Common topics: writing `protected-tags` / `ephemeral-tags` rules,
understanding a reason code in the plan, and token/permission setup.

---

## 🐛 I found a bug

**Open an issue using the "Bug report" template:**
<https://github.com/Tooark/action-ark-clean/issues/new/choose>

Please include:

- **Arklean version or commit SHA** (the `uses:` reference of your workflow).
- **Observed and expected behavior** — for policy questions, the relevant
  decisions from the JSON plan (`plan-path`) with their reason codes.
- **A redacted workflow configuration and logs.** Never include tokens or
  private package metadata.

> ⚠️ If the bug allows deleting a version that should have been protected, or
> exposes the token, treat it as a **security issue** and report it privately
> (see below).

---

## ✨ I have a feature idea

**Open an issue** explaining the **problem** you are trying to solve, not just
the solution. Destructive behavior, new inputs, and architecture changes go
through discussion (and possibly an ADR) before implementation — see
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🔒 I found a security vulnerability

**Do NOT open a public issue.** Use one of these private channels:

- **Preferred**: [GitHub Security Advisories](https://github.com/Tooark/action-ark-clean/security/advisories/new)
- **Email**: `security@tooark.com` _(PGP key available on request)_

Full policy and response targets are in [`SECURITY.md`](SECURITY.md).

---

## 📚 I want to read the docs

| Audience         | Start here                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **Users**        | [README.md](README.md) · [README.pt-BR.md](README.pt-BR.md)                                |
| **Operators**    | [Runbook](docs/operations/RUNBOOK.md) · [Action contract](docs/product/ACTION-CONTRACT.md) |
| **Contributors** | [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/](docs/)                                        |
| **Community**    | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)                                                   |

---

## ⏱️ Response times

We're a small volunteer team. Best-effort (not guaranteed) first-response
targets:

| Channel                                           | First response target |
| ------------------------------------------------- | --------------------- |
| GitHub Security Advisories (vulnerability report) | **72 hours**          |
| GitHub Issues (bug report)                        | 3–7 days              |
| GitHub Issues (feature request)                   | 7–14 days             |
| GitHub Discussions (question)                     | 3–7 days              |

The best way to speed things up is to include everything we need to reproduce or
understand your report in the first message.

---

## 📬 Other inquiries

If none of the channels above fit:

- **General help** — `support@tooark.com`
- **Partnerships and non-support inquiries** — `contact@tooark.com`

For anything public, please still prefer GitHub Discussions or Issues so the
whole community benefits from the answer.

---

## 🌐 Links

- **Repository**: <https://github.com/Tooark/action-ark-clean>
- **Discussions**: <https://github.com/Tooark/action-ark-clean/discussions>
- **Issues**: <https://github.com/Tooark/action-ark-clean/issues>
- **Tooark family**: <https://tooark.com>
