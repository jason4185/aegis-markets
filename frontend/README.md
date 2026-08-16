# Aegis Markets Frontend

This frontend originated from the `aegis-protection-suite` Lovable prototype. It is now maintained as normal tracked source inside the Aegis Markets monorepo rather than as a submodule.

The interface uses live GenLayer contract reads and writes. Runtime configuration targets GenLayer
Bradbury through the validated values in `src/lib/aegis/contract-config.ts` and the Vite
environment variables documented in `.env.example`.

## Local Development

The existing project uses Bun and retains its original `bun.lock` lockfile.

```sh
cd frontend
bun install
bun run dev
```

Build and lint commands:

```sh
bun run build
bun run lint
```
