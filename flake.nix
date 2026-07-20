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
            version = "2.0.2";

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

            npmDepsFetcherVersion = 2;
            npmDepsHash = "sha256-imLhbOnqh/r+KL5WYCqBezKTMbKtMyMtS1FozyyGnkQ=";

            makeCacheWritable = true;
            npmFlags = [ "--legacy-peer-deps" ];

            nodejs = pkgs.nodejs_24;

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
              cp scripts/start.mjs $out/share/mimotion/scripts/

              # Versioned database migrations and scheduler worker
              cp -r drizzle $out/share/mimotion/
              cp -r .worker $out/share/mimotion/

              # Wrapper
              mkdir -p $out/bin
              cat > $out/bin/mimotion << 'WRAPPER'
              #!/bin/sh
              set -e
              export NODE_ENV=''${NODE_ENV:-production}
              export PORT=''${PORT:-3000}
              export MIMOTION_HOST=''${MIMOTION_HOST:-0.0.0.0}
              cd @out@/share/mimotion
              mkdir -p "$(dirname "''${DATABASE_URL:-./data/mimotion.db}")"
              exec node scripts/start.mjs
              WRAPPER

              substituteInPlace $out/bin/mimotion --subst-var out
              chmod +x $out/bin/mimotion

              wrapProgram $out/bin/mimotion --prefix PATH : ${pkgs.nodejs_24}/bin

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
              nodejs_24
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
