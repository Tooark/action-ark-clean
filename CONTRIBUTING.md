# Contributing

Use Conventional Commits, sign commits with DCO (`git commit -s`), add tests, and never commit tokens or private GHCR responses.

```bash
corepack enable
pnpm install
pnpm check   # lint + typecheck + build + test
```

Run `pnpm format` before committing. The committed `dist/` bundle must match a fresh build (`pnpm build`); CI rejects drift, including untracked files under `dist/`.
