#!/usr/bin/env python3
"""Cut unit figures out of Formara's era sheets into transparent PNGs.

Method (same family as v1's art_src/cut.py): the sheets sit on a uniform
dark-brown background. The true background is the set of low-distance
pixels connected to the image border (flood fill); everything else -
including figure interiors that happen to match the background color -
is figure. Components are grouped to figures, trimmed to their bounding
boxes, and written with an alpha channel.

Sources: ~/workspace/user/files/4066_18_63bm.png  (swordsmen, 1070x460)
         ~/workspace/user/files/4062_14_7my6.png  (ranged,    2048x306)
Output:  build/assets/units/u_<name>.png
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

BG = np.array([52.0, 39.0, 30.0])
DIST_T = 30.0
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "units")


def figure_mask(a):
    """a: HxWx3 float array. Returns boolean mask of figure pixels.

    Two tests, because some figures (Gloom purple, Fog green-grey) sit
    close to the background in plain RGB distance while pointing in a
    completely different color direction: plain distance OR chromatic
    (direction-of-color) distance."""
    dist = np.sqrt(((a - BG) ** 2).sum(axis=2))
    chroma = a / (a.sum(axis=2, keepdims=True) + 1e-6)
    bg_chroma = BG / BG.sum()
    cdist = np.sqrt(((chroma - bg_chroma) ** 2).sum(axis=2))
    notbg = (dist > DIST_T) | ((cdist > 0.085) & (dist > 10))
    inv_lab, _ = ndimage.label(~notbg)
    border = set(np.unique(np.concatenate(
        [inv_lab[0, :], inv_lab[-1, :], inv_lab[:, 0], inv_lab[:, -1]]))) - {0}
    background = np.isin(inv_lab, list(border))
    return ~background


def components(fig):
    lab, _ = ndimage.label(fig)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None:
            continue
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        area = int((lab[sl] == i + 1).sum())
        out.append({"x0": sl[1].start, "x1": sl[1].stop,
                    "y0": sl[0].start, "y1": sl[0].stop,
                    "h": h, "w": w, "area": area})
    return out


def save_cut(im, fig, box, name, report):
    x0, y0, x1, y1 = box
    crop = im.crop((x0, y0, x1, y1)).convert("RGBA")
    alpha = (fig[y0:y1, x0:x1] * 255).astype(np.uint8)
    # soften the cut edge by one pixel so figures do not look scissored
    alpha = np.asarray(Image.fromarray(alpha).filter(
        __import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(0.7)))
    arr = np.asarray(crop).copy()
    arr[..., 3] = alpha
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"u_{name}.png")
    Image.fromarray(arr).save(path)
    report.append((name, x1 - x0, y1 - y0, path))
    print(f"  u_{name}.png  {x1-x0}x{y1-y0}")


def cut_grouped(path, anchors, bands, names, report):
    """Sheets where figures stand in two rows over shared column anchors."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(float)
    fig = figure_mask(a)
    # y0 >= 34 keeps the sheet's title line out of the top row's boxes
    comps = [c for c in components(fig)
             if c["area"] > 250 and c["h"] >= 20 and c["y0"] >= 34]
    for band_name, (by0, by1) in bands.items():
        for anchor, name in zip(anchors, names[band_name]):
            parts = [c for c in comps
                     if by0 <= (c["y0"] + c["y1"]) / 2 < by1
                     and abs((c["x0"] + c["x1"]) / 2 - anchor) <= 80]
            if not parts:
                print(f"  !! no components for {name}")
                continue
            x0 = min(c["x0"] for c in parts) - 2
            y0 = min(c["y0"] for c in parts) - 2
            x1 = max(c["x1"] for c in parts) + 2
            y1 = max(c["y1"] for c in parts) + 2
            save_cut(im, fig, (max(x0, 0), max(y0, 0), x1, y1), name, report)


def cut_windowed(path, centers, bands, names, report):
    """Sheets of tier groups: cut the leftmost (t1) figure of each group."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(float)
    fig = figure_mask(a)
    comps = [c for c in components(fig) if c["area"] > 200 and c["h"] >= 20]
    for band_name, (by0, by1) in bands.items():
        for center, name in zip(centers, names[band_name]):
            parts = [c for c in comps
                     if by0 <= (c["y0"] + c["y1"]) / 2 < by1
                     and center - 58 <= (c["x0"] + c["x1"]) / 2 < center + 48]
            if not parts:
                print(f"  !! no components for {name}")
                continue
            x0 = min(c["x0"] for c in parts) - 2
            y0 = min(c["y0"] for c in parts) - 2
            x1 = max(c["x1"] for c in parts) + 2
            y1 = max(c["y1"] for c in parts) + 2
            save_cut(im, fig, (max(x0, 0), max(y0, 0), x1, y1), name, report)


def main():
    report = []
    print("swordsmen sheet (4066):")
    cut_grouped(
        os.path.expanduser("~/workspace/user/files/4066_18_63bm.png"),
        anchors=[85, 234, 384, 536, 684, 834, 985],
        bands={"player": (20, 200), "enemy": (200, 430)},
        names={
            "player": ["shepherd_militia", "cohortman", "man_at_arms",
                       "musket_line", "line_infantry", "trooper", "peacekeeper"],
            "enemy": ["idol_golem", "brass_empire", "gloom_barons",
                      "crown_of_fog", "rust_raiders", "clockwork_legion",
                      "glitch_horde"],
        }, report=report)
    print("ranged sheet (4062):")
    cut_windowed(
        os.path.expanduser("~/workspace/user/files/4062_14_7my6.png"),
        centers=[57, 354, 653, 948, 1216, 1525, 1817],
        bands={"player": (25, 150), "enemy": (150, 275)},
        names={
            "player": ["shepherd_slinger", "javelineer", "longbowman",
                       "rifleman", "sharpshooter", "marksman",
                       "paintball_marksman"],
            "enemy": ["pebble_golem", "brass_dart_thrower", "gloom_crossbow",
                      "fog_musketeer", "rust_raider_blaster",
                      "clockwork_popper", "glitch_painter"],
        }, report=report)
    print(f"cut {len(report)} figures")


if __name__ == "__main__":
    main()
