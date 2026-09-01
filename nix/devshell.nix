{ pkgs }:

pkgs.mkShell {
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
}
