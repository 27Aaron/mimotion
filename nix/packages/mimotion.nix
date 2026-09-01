{
  lib,
  rustPlatform,
  stdenv,
  frontend,
  supportedSystems,
  version,
}:

rustPlatform.buildRustPackage {
  pname = "mimotion";
  inherit version;
  src = ../../.;
  cargoLock.lockFile = ../../backend/Cargo.lock;
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
    cp target/${stdenv.hostPlatform.rust.rustcTarget}/release/mimotion $out/bin/mimotion
    runHook postInstall
  '';

  meta = with lib; {
    description = "Xiaomi/Zepp auto step counter service";
    homepage = "https://github.com/27Aaron/mimotion";
    license = licenses.wtfpl;
    mainProgram = "mimotion";
    platforms = supportedSystems;
  };
}
