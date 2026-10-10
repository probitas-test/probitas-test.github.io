# Installation

This guide covers all methods to install Probitas CLI.

The CLI is a single `probitas` binary. It embeds its runtime and Probitas
itself, so nothing else (Node.js, Bun, or Deno) needs to be installed to run
scenarios.

Supported platforms:

- macOS (arm64, x64)
- Linux with glibc (x64, arm64)
- Windows (x64)

musl-based Linux distributions such as Alpine are not supported yet.

Upgrading from Probitas 1.x? See the [Migration Guide](/docs/migration/).

## Shell Installer

Install the CLI on macOS or Linux using the shell installer:

```bash
curl -fsSL https://raw.githubusercontent.com/probitas-test/probitas/main/install.sh | sh
```

The script downloads the binary for your platform from the
[GitHub Releases](https://github.com/probitas-test/probitas/releases), verifies
its checksum, and installs it to `~/.local/bin`. Make sure that directory is on
your `PATH`.

### Options

Configure installation via environment variables:

```bash
# Install specific version
curl -fsSL https://raw.githubusercontent.com/probitas-test/probitas/main/install.sh | PROBITAS_VERSION=2.0.0 sh

# Install under a custom root (the binary goes to <root>/bin)
curl -fsSL https://raw.githubusercontent.com/probitas-test/probitas/main/install.sh | PROBITAS_INSTALL_DIR=/usr/local sh
```

| Variable               | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `PROBITAS_VERSION`     | Version to install (default: the latest release)                  |
| `PROBITAS_INSTALL_DIR` | Installation root; the binary goes to `$PROBITAS_INSTALL_DIR/bin` |

## Windows

Download `probitas-windows-x64.zip` from the
[GitHub Releases](https://github.com/probitas-test/probitas/releases), extract
it, and put `probitas.exe` in a directory on your `PATH`.

## Homebrew (macOS/Linux)

Install via the official Homebrew tap:

```bash
# Add the tap and install
brew tap probitas-test/tap
brew install probitas

# Or install directly
brew install probitas-test/tap/probitas
```

## Nix

The Probitas repository provides a Nix flake that packages the release binary.

### Run Without Installing

Execute `probitas` directly without installing:

```bash
nix run github:probitas-test/probitas
```

### Install to Profile

Install into your Nix profile for persistent access:

```bash
nix profile install github:probitas-test/probitas
```

### Add to Project's flake.nix

Add Probitas to your project's development environment using the overlay:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    probitas-flake.url = "github:probitas-test/probitas";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, probitas-flake, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ probitas-flake.overlays.default ];
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [ probitas ];
        };
      });
}
```

Enter the development environment:

```bash
nix develop
```

### Why Use Overlays?

The overlay pattern integrates `probitas` directly into your `pkgs`, enabling
cleaner configuration:

```nix
overlays = [ probitas-flake.overlays.default ];
# ...
packages = with pkgs; [ probitas ];  # probitas is now part of pkgs
```

Benefits:

- **Unified namespace**: Access `probitas` like any nixpkgs package
- **Composable**: Combine with other overlays seamlessly

### Why Use inputs.follows?

The `inputs.follows` directive ensures Probitas uses your project's nixpkgs
version instead of its own pinned version:

```nix
probitas-flake.inputs.nixpkgs.follows = "nixpkgs";
probitas-flake.inputs.flake-utils.follows = "flake-utils";
```

Benefits:

- **Single nixpkgs version**: All dependencies share one nixpkgs, reducing
  closure size
- **Faster evaluation**: Fewer inputs to fetch and evaluate

### Pin a Specific Version

The flake provides the binary of the latest release rather than one built from
the flake's revision. To stay on a specific version, pin the flake to its
release tag:

```nix
probitas-flake.url = "github:probitas-test/probitas/v2.0.0";
```

Pin `v1.0.0` to keep using Probitas 1.x, which runs on Deno.

### Flake Outputs Reference

The Probitas flake provides:

| Output                        | Description                          |
| ----------------------------- | ------------------------------------ |
| `overlays.default`            | Overlay adding `probitas` to pkgs    |
| `packages.${system}.default`  | The `probitas` release binary        |
| `packages.${system}.probitas` | Alias for the binary package         |
| `devShells.${system}.default` | Shell for developing Probitas itself |

## GitHub Actions

### Using setup-probitas Action

The recommended way to use Probitas in GitHub Actions:

```yaml
- uses: probitas-test/setup-probitas@v2
  with:
    probitas-version: latest # or a specific version like '2.0.0'

- name: Run scenarios
  run: probitas run
```

Use `probitas-test/setup-probitas@v1` to keep using Probitas 1.x. See
[probitas-test/setup-probitas](https://github.com/probitas-test/setup-probitas)
for full documentation.

### Using Nix in GitHub Actions

For projects using Nix flakes with
[nixbuild/nix-quick-install-action](https://github.com/nixbuild/nix-quick-install-action):

```yaml
- uses: nixbuild/nix-quick-install-action@v34

- name: Run scenarios
  run: nix run github:probitas-test/probitas -- run
```

Or within a Nix development shell:

```yaml
- uses: nixbuild/nix-quick-install-action@v34

- name: Run scenarios
  run: nix develop -c probitas run
```

### Pre-fetching DuckDB

The DuckDB native binding is not embedded in the binary; it is downloaded the
first time a scenario creates a DuckDB client. Pre-fetch it when building CI
images or before going offline:

```bash
probitas cache duckdb
```

See [Native Dependencies](/docs/overview/#native-dependencies) for details.

## Verify Installation

After installation, verify the CLI is working:

```bash
probitas --version
```

## Next Steps

- [Quick Start](/docs/overview/#quick-start) - Initialize your first project
- [Scenario Guide](/docs/scenario/) - Learn to write scenarios
- [Migration Guide](/docs/migration/) - Upgrade scenarios from Probitas 1.x
