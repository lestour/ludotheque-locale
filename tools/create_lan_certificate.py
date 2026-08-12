#!/usr/bin/env python3

import argparse
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def local_addresses():
    addresses = {"127.0.0.1"}
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = info[4][0]
            if not address.startswith("127."):
                addresses.add(address)
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("192.0.2.1", 9))
        addresses.add(probe.getsockname()[0])
        probe.close()
    except OSError:
        pass
    return sorted(addresses)


def main():
    parser = argparse.ArgumentParser(description="Crée un certificat HTTPS local pour la ludothèque LAN.")
    parser.add_argument("--output", type=Path, default=ROOT / ".runtime" / "tls")
    parser.add_argument("--days", type=int, default=365)
    arguments = parser.parse_args()
    openssl = shutil.which("openssl")
    if not openssl:
        print("OpenSSL est nécessaire pour créer le certificat.", file=sys.stderr)
        return 2
    output = arguments.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    certificate = output / "lan.crt"
    key = output / "lan.key"
    hostname = socket.gethostname().lower()
    alternatives = ["DNS:localhost", f"DNS:{hostname}", f"DNS:{hostname}.local", *[f"IP:{address}" for address in local_addresses()]]
    configuration = f"""[req]
distinguished_name=subject
x509_extensions=extensions
prompt=no
[subject]
CN=Ludotheque LAN
[extensions]
subjectAltName={','.join(alternatives)}
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
basicConstraints=CA:FALSE
"""
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".cnf") as config:
        config.write(configuration)
        config.flush()
        subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", str(max(1, arguments.days)), "-keyout", str(key), "-out", str(certificate), "-config", config.name], check=True)
    try:
        key.chmod(0o600)
    except OSError:
        pass
    print(f"Certificat créé : {certificate}")
    print("Installez lan.crt comme certificat de confiance sur les appareils du LAN, puis relancez le lanceur LAN.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
