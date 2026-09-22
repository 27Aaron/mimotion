#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root_dir=$(cd -- "$script_dir/.." && pwd)
ROOT_DIR="$root_dir" python3 <<'PY'
import base64
import binascii
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile

root = Path(os.environ["ROOT_DIR"])
path = root / "nix/hashes.json"
inputs = [path, root / "package-lock.json", root / "flake.lock", root / "flake.nix"]
original = {file: file.read_bytes() for file in inputs}
hashes = json.loads(original[path])
if not isinstance(hashes, dict) or "npm" not in hashes:
    raise SystemExit(f"{path} must contain an npm hash")

new_hash = subprocess.check_output(
    ["nix", "run", "--no-update-lock-file", "--inputs-from", str(root),
     "nixpkgs#prefetch-npm-deps", "--", str(root / "package-lock.json")],
    text=True,
).strip()
try:
    valid = new_hash.startswith("sha256-") and len(
        base64.b64decode(new_hash.removeprefix("sha256-"), validate=True)
    ) == 32
except (ValueError, binascii.Error):
    valid = False
if not valid:
    raise SystemExit(f"prefetch-npm-deps returned an invalid SRI hash: {new_hash!r}")

for file, content in original.items():
    if file.read_bytes() != content:
        raise SystemExit(f"{file} changed during prefetch; retry without concurrent edits")
if hashes["npm"] == new_hash:
    print("npm dependency hash is already current")
    raise SystemExit(0)

hashes["npm"] = new_hash
fd, temporary_path = tempfile.mkstemp(prefix=".hashes.", dir=path.parent, text=True)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        json.dump(hashes, file, indent=2)
        file.write("\n")
    os.chmod(temporary_path, stat.S_IMODE(path.stat().st_mode))
    os.replace(temporary_path, path)
finally:
    Path(temporary_path).unlink(missing_ok=True)
print(f"Updated npm dependency hash: {new_hash}")
PY
