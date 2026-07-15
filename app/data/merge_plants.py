#!/usr/bin/env python3
"""Merge worker-curated plant additions + retrofit patch into plants.json.
Validates schema, dedupes by id AND botanical name, backs up the original.
Rerunnable: skips addition files that are already merged."""
import json, sys, shutil
from pathlib import Path

HERE = Path(__file__).parent
MAIN = HERE / "plants.json"
PATCH = HERE / "patch_existing.json"
ADDITIONS = sorted(HERE.glob("additions_*.json"))

CATEGORIES = {"canopy", "ornamental", "evergreen-tree", "shrub-deciduous",
              "shrub-evergreen", "perennial", "grass", "groundcover"}
REGIONS = {"northeast", "southeast", "midwest", "great-plains", "southwest",
           "mountain-west", "pacific-northwest", "california"}
SUN = {"full", "part", "shade", "full-part", "part-shade", "any"}

def norm_bot(s): return " ".join((s or "").lower().split())

def validate(p, errs, existing_ids, existing_bots):
    pid = p.get("id", "?")
    def err(msg): errs.append(f"{pid}: {msg}")
    if not p.get("id") or not p.get("common") or not p.get("botanical"): err("missing id/common/botanical")
    if p.get("category") not in CATEGORIES: err(f"bad category {p.get('category')}")
    if p.get("sun") not in SUN: err(f"bad sun {p.get('sun')}")
    sf = p.get("spreadFt"); hf = p.get("heightFt")
    if not isinstance(sf, (int, float)) or not (0.2 <= sf <= 120): err(f"implausible spreadFt {sf}")
    if not isinstance(hf, (int, float)) or not (0.2 <= hf <= 200): err(f"implausible heightFt {hf}")
    rng = p.get("spreadRangeFt")
    if not (isinstance(rng, list) and len(rng) == 2 and rng[0] <= sf <= rng[1]): err(f"spreadFt outside range {rng}")
    z = p.get("zones")
    if not (isinstance(z, list) and len(z) == 2 and 1 <= z[0] <= z[1] <= 13): err(f"bad zones {z}")
    nr = p.get("nativeRegions")
    if not isinstance(nr, list) or any(r not in REGIONS for r in nr): err(f"bad nativeRegions {nr}")
    if not p.get("src"): err("missing src")
    if p.get("category") in {"perennial", "grass", "groundcover"} and not p.get("spacingInches"):
        err("herbaceous entry missing spacingInches")
    if p["id"] in existing_ids: err("duplicate id")
    if norm_bot(p.get("botanical")) in existing_bots: err(f"duplicate botanical {p.get('botanical')}")

def main():
    plants = json.loads(MAIN.read_text())
    print(f"base: {len(plants)} entries")

    # 1. retrofit patch
    if PATCH.exists():
        patch = json.loads(PATCH.read_text())
        patched = 0
        for p in plants:
            if p["id"] in patch:
                entry = patch[p["id"]]
                p["nativeRegions"] = [r for r in entry.get("nativeRegions", []) if r in REGIONS]
                p["image"] = entry.get("image")
                p["imagePage"] = entry.get("imagePage")
                patched += 1
        missing = [p["id"] for p in plants if p["id"] not in patch]
        print(f"patch applied to {patched}/{len(plants)}; missing: {missing or 'none'}")
    else:
        print("NOTE: no patch_existing.json yet")

    # 2. additions
    ids = {p["id"] for p in plants}
    bots = {norm_bot(p["botanical"]) for p in plants}
    total_added, all_errs, skipped_dupes = 0, [], []
    for f in ADDITIONS:
        adds = json.loads(f.read_text())
        added = 0
        for p in adds:
            errs = []
            validate(p, errs, ids, bots)
            dupe = any("duplicate" in e for e in errs)
            hard = [e for e in errs if "duplicate" not in e]
            if dupe:
                skipped_dupes.append(p.get("id")); continue
            if hard:
                all_errs.extend(hard); continue
            p.setdefault("image", None); p.setdefault("imagePage", None)
            plants.append(p)
            ids.add(p["id"]); bots.add(norm_bot(p["botanical"]))
            added += 1
        print(f"{f.name}: +{added}/{len(adds)}")
        total_added += added

    if all_errs:
        print(f"\nREJECTED entries ({len(all_errs)} problems):")
        for e in all_errs[:40]: print("  -", e)
    if skipped_dupes:
        print(f"skipped duplicates: {len(skipped_dupes)}: {', '.join(skipped_dupes[:15])}…" if len(skipped_dupes) > 15
              else f"skipped duplicates: {skipped_dupes}")

    shutil.copy(MAIN, MAIN.with_suffix(".json.bak"))
    MAIN.write_text(json.dumps(plants, indent=1))
    json.loads(MAIN.read_text())  # final parse check
    with_img = sum(1 for p in plants if p.get("image"))
    native = sum(1 for p in plants if p.get("nativeRegions"))
    print(f"\nfinal: {len(plants)} plants ({total_added} new), {with_img} with images, {native} native-tagged")
    print("silver maple present:", any(p["id"] == "acer-saccharinum" for p in plants))

if __name__ == "__main__":
    main()
