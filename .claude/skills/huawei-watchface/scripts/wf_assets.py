#!/usr/bin/env python3
"""Outils pour cadrans Huawei Watch GT.

  check    <dossier> --res 466   vérifie dimensions, mode, poids, sprites
  optimize <dossier> [--colors 256]  palettise les PNG (pngquant si dispo, sinon Pillow)
  preview  <image> --res 466 [-o out.png]  applique le masque rond (aperçu réaliste)
  inspect  <fichier.hwt>         liste le contenu, lit description.xml, contrôle le poids

Dépendance : Pillow. pngquant optionnel (meilleure qualité).
"""
import argparse
import io
import re
import shutil
import subprocess
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

MAX_HWT_BYTES = 1_500_000
IMG_EXT = {".png", ".jpg", ".jpeg"}


def human(n):
    return f"{n / 1024:.0f} Ko" if n < 1_048_576 else f"{n / 1_048_576:.2f} Mo"


def iter_images(folder):
    return sorted(p for p in Path(folder).rglob("*") if p.suffix.lower() in IMG_EXT)


def cmd_check(args):
    res = args.res
    problems, total = 0, 0
    sprite_sets = defaultdict(dict)
    for p in iter_images(args.folder):
        size = p.stat().st_size
        total += size
        with Image.open(p) as im:
            w, h, mode = im.width, im.height, im.mode
            rel = p.relative_to(args.folder)
            notes = []
            if w > res or h > res:
                notes.append(f"plus grand que l'écran ({w}x{h} > {res})")
            top = rel.parts[0] if len(rel.parts) > 1 else ""
            if top in ("bg", "hands", "aod", "preview") and p.stem.startswith(("background", "aod_background", "cover")) and (w, h) != (res, res):
                notes.append(f"devrait faire {res}x{res}")
            if top == "bg" and "A" in mode:
                with Image.open(p) as im2:
                    if im2.getchannel("A").getextrema()[0] < 255:
                        notes.append("fond avec transparence (inutile)")
            if mode in ("RGBA", "RGB") and size > 60_000 and top != "bg":
                notes.append(f"lourd ({human(size)}), palettiser ?")
            if top == "aod" and "background" in p.stem:
                rgb = im.convert("L")
                lit = sum(rgb.histogram()[17:]) / (w * h)
                if lit > 0.15:
                    notes.append(f"AOD trop allumé ({lit:.0%} > 15 %)")
            m = re.match(r"(.+?)_(\d|colon|percent)$", p.stem)
            if m and top == "digits":
                sprite_sets[m.group(1)][m.group(2)] = (w, h)
        status = "!!" if notes else "ok"
        problems += bool(notes)
        print(f"[{status}] {rel}  {w}x{h} {mode} {human(size)}" + (f"  -> {'; '.join(notes)}" if notes else ""))
    for name, items in sprite_sets.items():
        digit_sizes = {v for k, v in items.items() if k.isdigit()}
        missing = [str(d) for d in range(10) if str(d) not in items]
        if len(digit_sizes) > 1:
            problems += 1
            print(f"[!!] jeu '{name}': chiffres de tailles différentes {sorted(digit_sizes)} (l'heure va sauter)")
        if missing:
            problems += 1
            print(f"[!!] jeu '{name}': chiffres manquants {','.join(missing)}")
    print(f"\nTotal images : {human(total)} (cible .hwt < {human(MAX_HWT_BYTES)})")
    if total > MAX_HWT_BYTES:
        problems += 1
        print("[!!] trop lourd : lancer `optimize`, réduire animations / recadrer aiguilles")
    print("OK" if not problems else f"{problems} point(s) à corriger")
    return 1 if problems else 0


def cmd_optimize(args):
    pq = shutil.which("pngquant")
    saved = 0
    for p in iter_images(args.folder):
        if p.suffix.lower() != ".png":
            continue
        before = p.stat().st_size
        if pq:
            subprocess.run([pq, "--force", "--skip-if-larger", "--strip", "--quality=70-95",
                            str(args.colors), "--output", str(p), str(p)], check=False)
        else:
            with Image.open(p) as im:
                im.load()
                if im.mode == "P":
                    continue
                rgba = im.convert("RGBA")
                q = rgba.quantize(colors=args.colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
                buf = io.BytesIO()
                q.save(buf, "PNG", optimize=True)
                if buf.tell() < before:
                    p.write_bytes(buf.getvalue())
        after = p.stat().st_size
        saved += before - after
        print(f"{p.relative_to(args.folder)}: {human(before)} -> {human(after)}")
    print(f"\nGain : {human(saved)} ({'pngquant' if pq else 'Pillow'})")
    return 0


def cmd_preview(args):
    with Image.open(args.image) as im:
        im = im.convert("RGBA").resize((args.res, args.res), Image.Resampling.LANCZOS)
    scale = 4
    mask = Image.new("L", (args.res * scale, args.res * scale), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, args.res * scale - 1, args.res * scale - 1), fill=255)
    mask = mask.resize((args.res, args.res), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (args.res, args.res), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    dest = args.output or str(Path(args.image).with_name(Path(args.image).stem + "_round.png"))
    out.save(dest)
    print(dest)
    return 0


def cmd_inspect(args):
    path = Path(args.hwt)
    size = path.stat().st_size
    print(f"{path.name}: {human(size)}" + ("  [!!] > 1,5 Mo" if size > MAX_HWT_BYTES else ""))
    try:
        z = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        print("[!!] pas une archive ZIP valide : ce n'est pas un .hwt exporté par Theme Studio")
        return 1
    names = z.namelist()
    roots = {n.split("/")[0] for n in names}
    if len(roots) == 1 and not any(n == "description.xml" for n in names):
        print(f"[!!] tout est dans un sous-dossier '{roots.pop()}' : rezipper depuis l'intérieur")
    for info in z.infolist():
        print(f"  {info.filename}  {human(info.file_size)}")
    desc = next((n for n in names if n.endswith("description.xml")), None)
    if desc:
        print(f"\n--- {desc} ---")
        print(z.read(desc).decode("utf-8", errors="replace")[:3000])
    else:
        print("[!!] description.xml absent")
    for n in names:
        if n.lower().endswith((".hwt", ".zip")):
            print(f"\n(archive imbriquée : {n})")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("folder"); c.add_argument("--res", type=int, default=466)
    o = sub.add_parser("optimize"); o.add_argument("folder"); o.add_argument("--colors", type=int, default=256)
    pv = sub.add_parser("preview"); pv.add_argument("image"); pv.add_argument("--res", type=int, default=466); pv.add_argument("-o", "--output")
    i = sub.add_parser("inspect"); i.add_argument("hwt")
    args = ap.parse_args()
    sys.exit({"check": cmd_check, "optimize": cmd_optimize, "preview": cmd_preview, "inspect": cmd_inspect}[args.cmd](args))


if __name__ == "__main__":
    main()
