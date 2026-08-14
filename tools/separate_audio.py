#!/usr/bin/env python3
"""Sépare localement un morceau avec Demucs, sans shell ni téléversement."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Sépare localement les sources d’un fichier audio ou vidéo.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("separated"))
    parser.add_argument("--model", choices=["htdemucs", "htdemucs_6s"], default="htdemucs")
    parser.add_argument("--two-stems", choices=["vocals"])
    arguments = parser.parse_args()
    source = arguments.input.expanduser().resolve()
    if not source.is_file():
        parser.error(f"fichier introuvable : {source}")
    if source.suffix.lower() in {".mid", ".midi"}:
        parser.error("un fichier MIDI contient déjà des pistes symboliques et ne se sépare pas avec Demucs")
    if source.suffix.lower() in {".mp4", ".m4a", ".mov"} and not shutil.which("ffmpeg"):
        parser.error("FFmpeg est requis pour extraire le son de ce conteneur")
    try:
        __import__("demucs")
    except ImportError:
        parser.error("Demucs est absent. Installez-le dans un environnement Python isolé avec : python3 -m pip install demucs")
    output = arguments.output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, "-m", "demucs", "--out", str(output), "-n", arguments.model]
    if arguments.two_stems:
        command += ["--two-stems", arguments.two_stems]
    command.append(str(source))
    return subprocess.run(command, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
