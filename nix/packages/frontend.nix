{
  buildNpmPackage,
  hashes,
  version,
}:

buildNpmPackage {
  pname = "mimotion-frontend";
  inherit version;
  src = ../../.;
  npmDepsHash = hashes.npm;
  npmBuildScript = "build:frontend";

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r frontend/dist $out/dist
    runHook postInstall
  '';
}
