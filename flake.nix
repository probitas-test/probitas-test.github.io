{
  description = "Development environment for the Probitas documentation site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    probitas-flake.url = "github:probitas-test/probitas";
  };

  outputs =
    { nixpkgs, probitas-flake, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
      pkgsFor =
        system:
        import nixpkgs {
          inherit system;
          overlays = [ probitas-flake.overlays.default ];
        };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = [
              # The scripts and tests run as TypeScript through Node's type
              # stripping, so the major version is named instead of following
              # whatever nixpkgs' default `nodejs` is.
              pkgs.nodejs_24
              pkgs.pagefind
              # Runs the scenarios under probitas/ against the site.
              pkgs.probitas
              pkgs.just
              pkgs.nixfmt
            ];
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
