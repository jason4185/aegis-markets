# Aegis Markets Frontend

This frontend originated from the `aegis-protection-suite` Lovable prototype. It is now maintained as normal tracked source inside the Aegis Markets monorepo rather than as a submodule.

The interface includes mocked data and placeholder contract-service methods. Contract integration may remain incomplete until a deployed contract address and live GenLayer client are configured and verified.

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
