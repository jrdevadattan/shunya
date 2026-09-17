#!/usr/bin/env bash
set -euo pipefail

test -f package.json
test -f pnpm-workspace.yaml
test -f Cargo.toml
test -f rust-toolchain.toml
corepack pnpm --version
cargo metadata --no-deps --format-version 1 >/dev/null
corepack pnpm -r exec node -e "process.exit(0)"
