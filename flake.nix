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
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          frontend = pkgs.buildNpmPackage {
            pname = "mimotion-frontend";
            version = "3.0.0";
            src = ./.;
            npmDepsHash = "sha256-5D1dFCJomsbHOEKpf7vlI4SYbasz/Aau/UEm3D/zLY4=";
            npmBuildScript = "build:frontend";

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -r frontend/dist $out/dist
              runHook postInstall
            '';
          };
        in
        {
          mimotion = pkgs.rustPlatform.buildRustPackage {
            pname = "mimotion";
            version = "3.0.0";
            src = ./.;
            cargoLock.lockFile = ./backend/Cargo.lock;
            buildAndTestSubdir = "backend";

            postPatch = ''
              cp backend/Cargo.lock Cargo.lock
            '';

            preBuild = ''
              rm -rf frontend/dist
              cp -r ${frontend}/dist frontend/dist
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/bin
              cp target/${pkgs.stdenv.hostPlatform.rust.rustcTarget}/release/mimotion $out/bin/mimotion
              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Xiaomi/Zepp auto step counter service";
              homepage = "https://github.com/27Aaron/mimotion";
              license = licenses.wtfpl;
              mainProgram = "mimotion";
              platforms = supportedSystems;
            };
          };

          default = self.packages.${system}.mimotion;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
              cargo
              clippy
              rustc
              rustfmt
              python3
              gcc
              gnumake
            ];
          };
        }
      );

      nixosModules.default = import ./nix/modules/nixos.nix self;
      homeManagerModules.default = import ./nix/modules/home-manager.nix self;
    };
}
