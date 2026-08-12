#!/usr/bin/env python3

import argparse
import platform
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def javascript_files(paths):
    if paths:
        return [Path(path).resolve() for path in paths]
    return [path for path in ROOT.rglob("*.js") if not ({"vendor", ".git", "dist", "build"} & set(path.relative_to(ROOT).parts))]


def main():
    parser = argparse.ArgumentParser(description="Vérifie la syntaxe des fichiers JavaScript du projet.")
    parser.add_argument("paths", nargs="*")
    arguments = parser.parse_args()
    files = javascript_files(arguments.paths)
    node = shutil.which("node")
    if node:
        for path in files:
            result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
            if result.returncode:
                print(result.stderr or result.stdout, file=sys.stderr)
                return result.returncode
    elif platform.system() == "Darwin" and shutil.which("osascript"):
        result = subprocess.run(["osascript", "-l", "JavaScript", str(ROOT / "tools" / "check_javascript.js"), *map(str, files)], capture_output=True, text=True)
        if result.returncode:
            print(result.stderr or result.stdout, file=sys.stderr)
            return result.returncode
    else:
        print("Node.js est requis pour vérifier la syntaxe JavaScript sur cette plateforme.", file=sys.stderr)
        return 2
    print(f"Syntaxe JavaScript valide : {len(files)} fichier(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
