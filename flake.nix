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
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = self.packages.${system}.mimotion;

          mimotion = pkgs.buildNpmPackage rec {
            pname = "mimotion";
            version = "1.0.0";

            src = builtins.path {
              path = ./.;
              name = "${pname}-${version}-source";
              filter =
                path: type:
                let
                  base = baseNameOf path;
                in
                !(
                  builtins.elem base [
                    ".git"
                    ".github"
                    ".next"
                    ".DS_Store"
                    "node_modules"
                    "data"
                    "result"
                  ]
                  || builtins.match ".*\\.(db|db-journal)$" base != null
                );
            };

            npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

            nodejs = pkgs.nodejs_22;

            nativeBuildInputs = with pkgs; [
              nodejs_22
              python3
              make
              gcc
            ];

            buildPhase = ''
              npm run build
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/share/mimotion

              # Standalone output
              cp -r .next/standalone/* $out/share/mimotion/

              # Static assets (not bundled in standalone)
              mkdir -p $out/share/mimotion/.next/static
              cp -r .next/static/* $out/share/mimotion/.next/static/

              # Database init script
              mkdir -p $out/share/mimotion/scripts
              cp scripts/init-db.mjs $out/share/mimotion/scripts/

              # Wrapper
              mkdir -p $out/bin
              cat > $out/bin/mimotion << 'WRAPPER'
              #!/bin/sh
              set -e
              export NODE_ENV=''${NODE_ENV:-production}
              export PORT=''${PORT:-3000}
              export HOSTNAME=''${HOSTNAME:-0.0.0.0}
              cd @out@/share/mimotion
              mkdir -p "$(dirname "''${DATABASE_URL:-./data/mimotion.db}")"
              node scripts/init-db.mjs
              exec node server.js
              WRAPPER

              substituteInPlace $out/bin/mimotion --subst-var out
              chmod +x $out/bin/mimotion

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Xiaomi/Zepp auto step counter service";
              homepage = "https://github.com/..."; # TODO: fill in
              license = licenses.mit;
              mainProgram = "mimotion";
              platforms = supportedSystems;
            };
          };
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
              nodejs_22
              python3
              gcc
              make
            ];
          };
        }
      );

      nixosModules.default = import ./nix/modules/nixos.nix self;
      homeManagerModules.default = import ./nix/modules/home-manager.nix self;
    };
}
