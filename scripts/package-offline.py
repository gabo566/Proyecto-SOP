#!/usr/bin/env python3
"""Build an extractable, self-contained offline SOP ZIP (never writes dist/)."""

from __future__ import annotations

import argparse
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCLUDED_PATHS = (
    "index.html",
    "README.md",
    "INICIAR-SOP-SIN-RED.bat",
    "offline",
    "src",
    "public",
)
ARCHIVE_ROOT = "Proyecto-SOP-sin-red"


def files_to_package() -> list[Path]:
    files: list[Path] = []
    for relative in INCLUDED_PATHS:
        path = ROOT / relative
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(item for item in path.rglob("*") if item.is_file())
    return sorted(set(files))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path(tempfile.gettempdir()) / "Proyecto-SOP-sin-red.zip",
        help="Destino del ZIP (por defecto, la carpeta temporal del equipo).",
    )
    args = parser.parse_args()
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    packaged_files = files_to_package()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in packaged_files:
            relative = path.relative_to(ROOT).as_posix()
            archive.write(path, f"{ARCHIVE_ROOT}/{relative}")

    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"Paquete creado: {output}")
    print(f"Archivos: {len(packaged_files)} · Tamaño: {size_mb:.1f} MiB")
    print("No se generó ni incluyó dist/.")


if __name__ == "__main__":
    main()
