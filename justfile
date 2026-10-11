# Run `nix develop` (or use direnv) first so every tool is on PATH.

set shell := ["bash", "-euo", "pipefail", "-c"]

# List the recipes.
default:
    @just --list

# Install the npm dependencies exactly as package-lock.json pins them.
install:
    npm ci

# Start the dev server with HMR.
dev:
    npm run dev

# Build the static site into dist/ (client, SSG, Pagefind index).
build:
    npm run build

# Preview the built site.
preview:
    npm run preview

# Check the internal links of the built site.
test:
    npm test

# Regenerate data/api/ from the published npm packages.
generate-api:
    npm run generate-api

# Format the Nix files.
fmt:
    git ls-files -z '*.nix' | xargs -0 nixfmt

# Check the Nix files' formatting without changing them.
fmt-check:
    git ls-files -z '*.nix' | xargs -0 nixfmt --check

# Everything CI runs.
ci: fmt-check install build test
