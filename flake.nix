{
  description = "MiMotion - Xiaomi/Zepp auto step counter service";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
      version = (builtins.fromJSON (builtins.readFile ./package.json)).version;
      hashes = builtins.fromJSON (builtins.readFile ./nix/hashes.json);
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          frontend = pkgs.callPackage ./nix/packages/frontend.nix {
            inherit hashes version;
          };
        in
        {
          mimotion = pkgs.callPackage ./nix/packages/mimotion.nix {
            inherit frontend version supportedSystems;
          };
          default = self.packages.${system}.mimotion;
        }
      );

      devShells = forAllSystems (
        system: {
          default = import ./nix/devshell.nix {
            pkgs = pkgsFor system;
          };
        }
      );

      nixosModules.default = import ./nix/modules/nixos.nix self;
      homeManagerModules.default = import ./nix/modules/home-manager.nix self;
    };
}
