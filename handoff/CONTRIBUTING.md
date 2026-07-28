# Contributing

1. Discuss material changes before implementation.
2. Sign commits with the Developer Certificate of Origin (`git commit -s`).
3. Use Conventional Commits.
4. Add or update tests, documentation, ADRs, threat model, and risk register as applicable.
5. Never add secrets, real private package metadata, or unredacted API fixtures.
6. Do not hand-edit the release bundle without changing source and reproducing the build.

## Tooling

The project uses pnpm (version pinned by `packageManager` in `package.json`) and the Node built-in test runner:

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build   # compiles TypeScript and refreshes the committed dist bundle
pnpm check   # typecheck + test + build
```

CI fails if the committed `dist` bundle differs from a fresh build of the source.
