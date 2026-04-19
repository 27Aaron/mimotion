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
        "x86_64-darwin"
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

            npmDepsHash = "sha256-nAgxWrW14CKWG6vuyUTf2aOPgDI2+iEiIzwpx4Ww6+w=";

            makeCacheWritable = true;
            npmFlags = [ "--legacy-peer-deps" ];

            nodejs = pkgs.nodejs_22;

            nativeBuildInputs = with pkgs; [
              python3
              gnumake
              gcc
              makeWrapper
            ];

            buildPhase = ''
              npm run build
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/share/mimotion

              # Standalone output (use . instead of * to include hidden .next dir)
              cp -r .next/standalone/. $out/share/mimotion/

              # Static assets (overwrite standalone's with full versions)
              mkdir -p $out/share/mimotion/.next/static
              cp -r .next/static/. $out/share/mimotion/.next/static/

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

              wrapProgram $out/bin/mimotion --prefix PATH : ${pkgs.nodejs_22}/bin

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "Xiaomi/Zepp auto step counter service";
              homepage = "https://github.com/27Aaron/mimotion";
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
              gnumake
            ];
          };
        }
      );

      nixosModules.default = import ./nix/modules/nixos.nix self;
      homeManagerModules.default = import ./nix/modules/home-manager.nix self;
    };
}
