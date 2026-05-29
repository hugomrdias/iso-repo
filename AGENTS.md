# Agent instructions

## Lint

```sh
pnpm run lint
```

Auto-fix formatting and lint issues:

```sh
pnpm run fix
```

Staged files are checked on commit via Biome. Run `pnpm run fix` before committing if needed.

To lint a single package:

```sh
pnpm --filter iso-base run lint
```

## Test

```sh
pnpm run test
```

To test a single package:

```sh
pnpm --filter iso-base run test
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/). Release Please reads these to version packages.

Format: `type(scope): short description`

Examples:

- `feat(iso-base): add shared extended JSON serializer`
- `fix(iso-kv): handle empty store reads`
- `test(iso-conf): cover extended JSON types`
- `docs(iso-conf): add missing JSDoc descriptions`
- `chore: sync pnpm-lock.yaml`

Common types:

- `feat` — new feature (minor release)
- `fix` — bug fix (patch release)
- `feat!` / `fix!` — breaking change (major release)
- `test`, `docs`, `chore` — no version bump

Use the package name as `scope` when changes are limited to one package (e.g. `iso-base`, `iso-kv`).

Keep each commit scoped to a single package. Avoid commits that change multiple packages — split them into separate commits instead. Root-only changes (e.g. `pnpm-lock.yaml`) may use `chore` without a scope.
