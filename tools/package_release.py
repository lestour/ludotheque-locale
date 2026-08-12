#!/usr/bin/env python3

import argparse
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "dist" / "Ludotheque-locale.zip"
PACKAGE_ROOT = "Ludotheque-locale"
EXCLUDED_ROOTS = {".git", ".github", ".runtime", "dist", "build"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}
REQUIRED = {
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    "server/lan_server.py",
    "shared/game-runtime.js",
    "shared/lan-multiplayer.js",
    "games/rhythm/assets/MS-Basic.sf3",
    "vendor/spessasynth_core/dist/index.js",
    "vendor/spessasynth_lib/dist/index.js",
    "Lancer le Hub.command",
    "Lancer le Hub Windows.bat",
    "Lancer le Hub Linux.sh",
    "Lancer le Hub LAN.command",
    "Lancer le Hub LAN Windows.bat",
    "Lancer le Hub LAN Linux.sh",
}


def distributable_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if relative.parts[0] in EXCLUDED_ROOTS or "__pycache__" in relative.parts or relative.name == ".DS_Store":
            continue
        if path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        yield path, relative


def build(output):
    output.parent.mkdir(parents=True, exist_ok=True)
    files = list(distributable_files())
    available = {str(relative) for _, relative in files}
    missing = sorted(REQUIRED - available)
    if missing:
        raise RuntimeError(f"Fichiers indispensables absents : {', '.join(missing)}")
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for source, relative in files:
            archive.write(source, Path(PACKAGE_ROOT) / relative)
    return len(files)


def verify(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        bad = [name for name in names if "/.git/" in name or "/__pycache__/" in name or name.endswith((".pyc", ".pyo"))]
        missing = sorted(f"{PACKAGE_ROOT}/{name}" for name in REQUIRED if f"{PACKAGE_ROOT}/{name}" not in names)
        if bad:
            raise RuntimeError(f"Fichiers privés ou temporaires inclus : {', '.join(sorted(bad)[:8])}")
        if missing:
            raise RuntimeError(f"Fichiers indispensables absents de l’archive : {', '.join(missing)}")
    return len(names)


def main():
    parser = argparse.ArgumentParser(description="Construit ou vérifie le paquet multiplateforme de la ludothèque.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify", type=Path)
    arguments = parser.parse_args()
    try:
        if arguments.verify:
            count = verify(arguments.verify.resolve())
            print(f"Archive valide : {count} fichiers.")
        else:
            output = arguments.output.resolve()
            count = build(output)
            print(f"Archive créée : {output} ({count} fichiers).")
    except (OSError, RuntimeError, zipfile.BadZipFile) as error:
        print(f"Erreur : {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
