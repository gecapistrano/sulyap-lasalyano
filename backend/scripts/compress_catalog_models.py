"""
Compress laptop GLB copies for Live Scan. Never download from Supabase Storage.

Writes accession-named files to:
  backend/data/models-public/models/{CODE}.glb   (upload this folder to R2 / Pages)
  backend/uploads/models/{CODE}.glb              (local hall /media/models)

Usage (from repo root or backend/):
  python backend/scripts/compress_catalog_models.py
  python backend/scripts/compress_catalog_models.py --from "D:\\STORAGE\\Downloads\\Andrew Gonzales (AG)"
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]
DEFAULT_FROM = Path(
    r"D:\STORAGE\Downloads\Andrew Gonzales (AG)-20261022T042645Z-1-001\Andrew Gonzales (AG)"
)
CODE_RE = re.compile(r"([A-Z]{1,4}\d{1,4})", re.I)
TEXTURE_ATTRS = (
    "baseColorTexture",
    "normalTexture",
    "metallicRoughnessTexture",
    "emissiveTexture",
    "occlusionTexture",
)


def codes_from_name(name: str) -> list[str]:
    stem = Path(name).stem
    found: list[str] = []
    seen: set[str] = set()
    for match in CODE_RE.finditer(stem):
        code = re.sub(r"\s+", "", (match.group(1) or "").upper())
        if not code or code in seen:
            continue
        seen.add(code)
        found.append(code)
    return found


def shrink_image(image: Image.Image | None, size: int, quality: int) -> Image.Image | None:
    if image is None:
        return None
    rgb = image.convert("RGB")
    rgb.thumbnail((size, size), Image.Resampling.LANCZOS)
    buf = BytesIO()
    rgb.save(buf, format="JPEG", quality=quality, optimize=True)
    buf.seek(0)
    out = Image.open(buf)
    out.load()
    return out


def rewrite_textures(src: Path, dest: Path, *, size: int, quality: int) -> None:
    import trimesh

    scene = trimesh.load(str(src), force="scene")
    geometries = getattr(scene, "geometry", None)
    items = geometries.values() if isinstance(geometries, dict) else []
    for geom in items:
        mat = getattr(getattr(geom, "visual", None), "material", None)
        if mat is None:
            continue
        for attr in TEXTURE_ATTRS:
            current = getattr(mat, attr, None)
            if current is not None:
                setattr(mat, attr, shrink_image(current, size, quality))
    dest.parent.mkdir(parents=True, exist_ok=True)
    scene.export(str(dest))


def optimize_mesh(src: Path, dest: Path, *, simplify_ratio: float) -> None:
    cmd = (
        f'npx --yes @gltf-transform/cli@4.1.4 optimize "{src}" "{dest}" '
        f"--compress false --texture-compress false --texture-size 1024 "
        f"--simplify-ratio {simplify_ratio} --palette false"
    )
    result = subprocess.run(cmd, shell=True, cwd=str(ROOT))
    if result.returncode != 0:
        raise RuntimeError(f"gltf-transform failed for {src.name}")


def mb(path: Path) -> str:
    return f"{path.stat().st_size / (1024 * 1024):.2f}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Compress laptop catalog GLBs without touching Supabase Storage.")
    parser.add_argument("--from", dest="from_dir", default=str(DEFAULT_FROM))
    parser.add_argument("--out", dest="out_dir", default=str(BACKEND / "data" / "models-public" / "models"))
    parser.add_argument("--local", dest="local_dir", default=str(BACKEND / "uploads" / "models"))
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--jpeg-quality", type=int, default=68)
    parser.add_argument("--simplify-ratio", type=float, default=0.18)
    args = parser.parse_args()

    from_dir = Path(args.from_dir)
    if not from_dir.is_dir():
        print(f"Source folder missing (will not download Storage GLBs): {from_dir}", file=sys.stderr)
        return 1

    sources = sorted(path for path in from_dir.glob("*.glb") if path.is_file())
    if args.limit:
        sources = sources[: args.limit]
    if not sources:
        print(f"No .glb files in {from_dir}", file=sys.stderr)
        return 1

    public_dir = Path(args.out_dir)
    local_dir = Path(args.local_dir)
    tmp_dir = public_dir.parent / ".tmp"
    public_dir.mkdir(parents=True, exist_ok=True)
    local_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    ok = 0
    failed = 0
    for src in sources:
        codes = codes_from_name(src.name)
        names = [f"{code}.glb" for code in codes] or [src.name]
        tex_path = tmp_dir / f"{src.stem}.tex.glb"
        opt_path = tmp_dir / f"{src.stem}.opt.glb"
        print(f"\ncompress {src.name}  {mb(src)} MB -> {', '.join(names)}")
        try:
            rewrite_textures(src, tex_path, size=args.texture_size, quality=args.jpeg_quality)
            optimize_mesh(tex_path, opt_path, simplify_ratio=args.simplify_ratio)
            for name in names:
                shutil.copy2(opt_path, public_dir / name)
                shutil.copy2(opt_path, local_dir / name)
            print(f"  {mb(src)} -> {mb(opt_path)} MB")
            ok += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  {exc}", file=sys.stderr)

    print(f"\ndone compressed={ok} failed={failed}")
    print(f"public: {public_dir}")
    print(f"local:  {local_dir}")
    print("Next: npm run models:publish -- --pages-project sulyap-models")
    print("Then set PUBLIC_MODEL_BASE_URL on Render.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
