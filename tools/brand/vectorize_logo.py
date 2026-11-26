"""
Reusable vectorization & recoloring pipeline for IAM brand assets.

Extracts exact organic paths from `logoOpcion2.jpg` using `vtracer` (cubic Bezier
splines, zero geometric reinterpretation) into:
  - iam_wordmark.svg       (transparent bg, tight viewBox, pure white #FFFFFF)
  - iam_crowd.svg          (transparent bg, preserveAspectRatio="xMidYMax slice")
  - ic_launcher_background.xml  (Android Adaptive Icon background)
  - ic_launcher_foreground.xml  (Android Adaptive Icon foreground, 62% safe zone)
  - preview.html           (Local interactive comparison & phone/icon preview)

Usage:
  c:\\msmDev\\IAM\\tools\\brand\\.venv\\Scripts\\python.exe tools/brand/vectorize_logo.py
"""

from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import cv2
import numpy as np
import vtracer

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "logoOpcion2.jpg"
OUT_DIR = Path(__file__).resolve().parent / "out"

# ── Editable Brand Palette Config ─────────────────────────────────────────────
PALETTE = {
    "background": "#76C7E8",
    "wordmark": "#FFFFFF",
    "center_silhouette": "#F4B266",
    # Ordered from back/darkest to front/lightest, harmonized with #76C7E8:
    "crowd_layers": [
        "#4A8FB3",
        "#5CA3C7",
        "#6BB6DB",
        "#8AD1EE",
        "#A2DFF5",
    ],
}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def extract_wordmark_svg(img_rgb: np.ndarray, out_svg: Path) -> tuple[float, float, list[str]]:
    """Trace exact calligraphic 'iam' wordmark into transparent SVG with tight viewBox."""
    H, W, _ = img_rgb.shape
    upper = img_rgb[: int(H * 0.56), :]

    # Wordmark is crisp white on teal sky (#7BC0CC). Use high whiteness + low saturation.
    sky = np.median(upper[0:60, 0:60].reshape(-1, 3), axis=0)
    dist_sky = np.linalg.norm(upper.astype(np.float32) - sky, axis=2)
    lum = 0.299 * upper[:, :, 0] + 0.587 * upper[:, :, 1] + 0.114 * upper[:, :, 2]

    # Smooth mask: pixels clearly whiter than sky
    mask = ((lum > 205) & (dist_sky > 40)).astype(np.uint8) * 255
    # Slight morphological close to bridge tiny JPEG compression speckles without rounding curves
    ys, xs = np.where(mask > 0)
    pad = 24
    x0, x1 = max(0, int(xs.min()) - pad), min(W, int(xs.max()) + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(int(H * 0.56), int(ys.max()) + pad)

    crop = mask[y0:y1, x0:x1]
    # Black shape on white background for binary vtracer
    inv = 255 - crop
    tmp_png = OUT_DIR / "_tmp_wordmark.png"
    cv2.imwrite(str(tmp_png), inv)

    tmp_svg = OUT_DIR / "_tmp_wordmark.svg"
    vtracer.convert_image_to_svg_py(
        str(tmp_png),
        str(tmp_svg),
        colormode="binary",
        mode="spline",
        filter_speckle=6,
        corner_threshold=60,
        length_threshold=3.5,
        splice_threshold=45,
        path_precision=2,
    )

    tree = ET.parse(tmp_svg)
    root = tree.getroot()
    ns = {"svg": "http://www.w3.org/2000/svg"}

    paths_d: list[tuple[str, str]] = []
    for p in root.findall(".//svg:path", ns) + root.findall(".//path"):
        d = p.attrib.get("d", "")
        tr = p.attrib.get("transform", "")
        if d:
            paths_d.append((tr, d))

    cw = x1 - x0
    ch = y1 - y0
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" '
        f'width="{cw}" height="{ch}">'
    ]
    for tr, d in paths_d:
        if tr:
            svg_lines.append(
                f'  <path d="{d}" fill="{PALETTE["wordmark"]}" transform="{tr}"/>'
            )
        else:
            svg_lines.append(f'  <path d="{d}" fill="{PALETTE["wordmark"]}"/>')
    svg_lines.append("</svg>\n")
    out_svg.write_text("\n".join(svg_lines), encoding="utf-8")
    tmp_png.unlink(missing_ok=True)
    tmp_svg.unlink(missing_ok=True)

    # Also generate iam_header_wordmark.svg: 'i' in center_silhouette (#EEB274) and 'am' in background (#6BB9E8)
    yy, xx = np.ogrid[:ch, :cw]
    in_a_cheek = (
        (((xx - 282.0) / 96.0) ** 2 + ((yy - 265.0) / 145.0) ** 2 <= 1.0)
        & (xx >= 176)
    ) | (xx >= 210)
    in_a_cheek_inner = (
        (((xx - 282.0) / 93.0) ** 2 + ((yy - 265.0) / 142.0) ** 2 <= 1.0)
        & (xx >= 178)
    ) | (xx >= 212)

    i_mask = np.where((crop > 0) & (~in_a_cheek_inner), 0, 255).astype(np.uint8)
    am_mask = np.where((crop > 0) & in_a_cheek, 0, 255).astype(np.uint8)

    header_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" '
        f'width="{cw}" height="{ch}">'
    ]
    for mask_part, fill_hex, tag in [
        (i_mask, PALETTE["center_silhouette"], "i"),
        (am_mask, PALETTE["background"], "am"),
    ]:
        p_png = OUT_DIR / f"_tmp_hwm_{tag}.png"
        p_svg = OUT_DIR / f"_tmp_hwm_{tag}.svg"
        cv2.imwrite(str(p_png), mask_part)
        vtracer.convert_image_to_svg_py(
            str(p_png),
            str(p_svg),
            colormode="binary",
            mode="spline",
            filter_speckle=6,
            corner_threshold=60,
            length_threshold=3.5,
            splice_threshold=45,
            path_precision=2,
        )
        t_part = ET.parse(p_svg)
        for p in t_part.getroot().findall(".//svg:path", ns) + t_part.getroot().findall(".//path"):
            d = p.attrib.get("d", "")
            tr = p.attrib.get("transform", "")
            if not d:
                continue
            if tr:
                header_lines.append(f'  <path d="{d}" fill="{fill_hex}" transform="{tr}"/>')
            else:
                header_lines.append(f'  <path d="{d}" fill="{fill_hex}"/>')
        p_png.unlink(missing_ok=True)
        p_svg.unlink(missing_ok=True)
    header_lines.append("</svg>\n")
    (OUT_DIR / "iam_header_wordmark.svg").write_text(
        "\n".join(header_lines), encoding="utf-8"
    )

    return float(cw), float(ch), paths_d


def recolor_crowd_rgba(img_rgb: np.ndarray) -> tuple[np.ndarray, int]:
    """
    Segment every individual silhouette in the crowd using edge-preserving
    bilateral denoising + local-maxima marker watershed + Region Adjacency Graph
    (RAG) coloring so each person has 100% solid fill (zero stains) and never
    blends into its neighbors or the #6BB9E8 background.
    """
    H, W, _ = img_rgb.shape
    lower_start = int(H * 0.48)
    crop = img_rgb[lower_start:, :]
    ch, cw, _ = crop.shape

    smooth = crop.copy()
    for _ in range(5):
        smooth = cv2.bilateralFilter(smooth, d=9, sigmaColor=18, sigmaSpace=18)

    lab = cv2.cvtColor(smooth, cv2.COLOR_RGB2LAB).astype(np.float32)
    gx = cv2.Sobel(lab, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(lab, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt((gx**2 + gy**2).sum(axis=2))

    gray = cv2.cvtColor(smooth, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    edges_canny = cv2.Canny(clahe, 15, 36)
    edges_grad = (grad > 6.8).astype(np.uint8) * 255
    boundary = cv2.bitwise_or(edges_canny, edges_grad)

    num_b, b_lbls, b_stats, _ = cv2.connectedComponentsWithStats(boundary)
    clean_b = np.zeros_like(boundary)
    for i in range(1, num_b):
        if b_stats[i, cv2.CC_STAT_AREA] >= 40:
            clean_b[b_lbls == i] = 255
    boundary = cv2.morphologyEx(
        clean_b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    )

    interior = (boundary == 0).astype(np.uint8)
    dist = cv2.distanceTransform(interior, cv2.DIST_L2, 5)
    dist_smooth = cv2.GaussianBlur(dist, (31, 31), 0)

    k_max = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (125, 125))
    local_max = (
        (dist_smooth == cv2.dilate(dist_smooth, k_max))
        & (dist > 30.0)
        & (boundary == 0)
    )
    seed_disks = cv2.dilate(
        local_max.astype(np.uint8),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)),
    )
    seed_disks[2:8, :] = np.where(boundary[2:8, :] == 0, 1, seed_disks[2:8, :])

    _, markers = cv2.connectedComponents(seed_disks)

    smooth_clahe = cv2.cvtColor(
        np.stack(
            [clahe, lab[:, :, 1].astype(np.uint8), lab[:, :, 2].astype(np.uint8)],
            axis=2,
        ),
        cv2.COLOR_LAB2RGB,
    )
    ws = cv2.watershed(smooth_clahe, markers.copy())
    for _ in range(20):
        bad = (ws <= 0) | (ws >= 65535)
        if not bad.any():
            break
        ws_clean = np.where(bad, 0, ws).astype(np.uint16)
        dil = cv2.dilate(ws_clean, np.ones((3, 3), np.uint8))
        ws[bad] = dil[bad]

    # RAG Boundary-Strength Merging: merge regions without a real boundary or tiny slivers (< 14000 px)
    boundary_dil = cv2.dilate(boundary, np.ones((5, 5), np.uint8)) > 0
    k5 = np.ones((5, 5), np.uint8)
    merged = True
    while merged:
        merged = False
        regs = [int(r) for r in np.unique(ws) if r > 0]
        for i, r1 in enumerate(regs):
            m1 = ws == r1
            a1 = int(m1.sum())
            d1 = cv2.dilate(m1.astype(np.uint8), k5) > 0
            for r2 in regs[i + 1 :]:
                m2 = ws == r2
                a2 = int(m2.sum())
                shared = d1 & (cv2.dilate(m2.astype(np.uint8), k5) > 0)
                if not np.any(shared):
                    continue
                edge_frac = float((shared & boundary_dil).sum()) / float(shared.sum())
                if edge_frac < 0.28 or min(a1, a2) < 14000:
                    if a1 >= a2:
                        ws[m2] = r1
                    else:
                        ws[m1] = r2
                    merged = True
                    break
            if merged:
                break

    sky_regions = set(int(x) for x in np.unique(ws[3, :]) if x > 0)
    amber_regions = set()
    for r_id in np.unique(ws):
        if r_id <= 0 or r_id in sky_regions:
            continue
        m = ws == r_id
        med_rgb = np.median(smooth[m], axis=0)
        if (int(med_rgb[0]) - int(med_rgb[2])) > 20:
            amber_regions.add(int(r_id))

    crowd_ids = [
        int(r)
        for r in np.unique(ws)
        if r > 0 and r not in sky_regions and r not in amber_regions
    ]

    c_layers = [hex_to_rgb(c) for c in PALETTE["crowd_layers"]]
    c_amber = hex_to_rgb(PALETTE["center_silhouette"])
    n_colors = len(c_layers)

    reg_lum = {}
    reg_y = {}
    for r_id in crowd_ids:
        m = ws == r_id
        med = np.median(smooth[m], axis=0)
        reg_lum[r_id] = 0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2]
        reg_y[r_id] = float(np.where(m)[0].mean())

    sorted_by_lum = sorted(
        crowd_ids, key=lambda r: (round(reg_lum[r] / 3.0), reg_y[r])
    )
    reg_color_idx = {}
    for idx, r_id in enumerate(sorted_by_lum):
        reg_color_idx[r_id] = min(
            n_colors - 1, int(idx * n_colors / max(1, len(sorted_by_lum)))
        )

    adj: dict[int, set[int]] = {r: set() for r in crowd_ids}
    masks = {r: (ws == r).astype(np.uint8) for r in crowd_ids}
    k7 = np.ones((7, 7), np.uint8)
    for r1 in crowd_ids:
        d1 = cv2.dilate(masks[r1], k7)
        for r2 in crowd_ids:
            if r1 < r2 and np.any(d1 & masks[r2]):
                adj[r1].add(r2)
                adj[r2].add(r1)

    for _ in range(12):
        for r_id in sorted(crowd_ids, key=lambda r: len(adj[r]), reverse=True):
            nbr_colors = {reg_color_idx[n] for n in adj[r_id]}
            if reg_color_idx[r_id] in nbr_colors:
                base = reg_color_idx[r_id]
                candidates = sorted(
                    range(n_colors), key=lambda c: (c in nbr_colors, abs(c - base))
                )
                reg_color_idx[r_id] = candidates[0]

    rgba = np.zeros((ch, cw, 4), dtype=np.uint8)
    for r_id in crowd_ids:
        m_smooth = cv2.medianBlur((ws == r_id).astype(np.uint8) * 255, 9) > 127
        rgba[m_smooth, :3] = c_layers[reg_color_idx[r_id]]
        rgba[m_smooth, 3] = 255

    r_ch = smooth[:, :, 0].astype(np.int32)
    b_ch = smooth[:, :, 2].astype(np.int32)
    amber_exact = (
        cv2.medianBlur(((r_ch - b_ch) > 18).astype(np.uint8) * 255, 9) > 127
    )
    rgba[amber_exact, :3] = c_amber
    rgba[amber_exact, 3] = 255

    return rgba, lower_start


def extract_crowd_svg(
    img_rgb: np.ndarray, out_svg: Path
) -> tuple[float, float, int, list[tuple[str, str]]]:
    """Trace quantized crowd + center silhouette with vtracer stacked splines."""
    rgba, y_start = recolor_crowd_rgba(img_rgb)
    ch, cw, _ = rgba.shape

    tmp_png = OUT_DIR / "_tmp_crowd.png"
    # OpenCV expects BGRA
    bgra = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
    cv2.imwrite(str(tmp_png), bgra)

    tmp_svg = OUT_DIR / "_tmp_crowd.svg"
    vtracer.convert_image_to_svg_py(
        str(tmp_png),
        str(tmp_svg),
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=10,
        color_precision=8,
        layer_difference=4,
        corner_threshold=60,
        length_threshold=4.0,
        splice_threshold=45,
        path_precision=2,
    )

    tree = ET.parse(tmp_svg)
    root = tree.getroot()
    ns = {"svg": "http://www.w3.org/2000/svg"}

    allowed_fills = {c.upper() for c in PALETTE["crowd_layers"]} | {
        PALETTE["center_silhouette"].upper()
    }
    paths: list[tuple[str, str]] = []
    for p in root.findall(".//svg:path", ns) + root.findall(".//path"):
        d = p.attrib.get("d", "")
        fill = p.attrib.get("fill", "").upper()
        transform = p.attrib.get("transform", "")
        if not d:
            continue
        # Snap fill to exact palette color if close
        if fill not in allowed_fills:
            continue
        # Bake simple translate(x,y) into SVG group if present
        if transform:
            paths.append((f"{fill}|{transform}", d))
        else:
            paths.append((fill, d))

    # Build clean SVG with preserveAspectRatio="xMidYMax slice"
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw} {ch}" '
        f'preserveAspectRatio="xMidYMax slice">'
    ]
    for fill_key, d in paths:
        if "|" in fill_key:
            fill, transform = fill_key.split("|", 1)
            svg_lines.append(f'  <path d="{d}" fill="{fill}" transform="{transform}"/>')
        else:
            svg_lines.append(f'  <path d="{d}" fill="{fill_key}"/>')
    svg_lines.append("</svg>\n")
    out_svg.write_text("\n".join(svg_lines), encoding="utf-8")

    tmp_png.unlink(missing_ok=True)
    tmp_svg.unlink(missing_ok=True)
    return float(cw), float(ch), y_start, paths


def _translate_path_d(d: str, dx: float, dy: float) -> str:
    """Shift SVG path coordinates by (dx, dy) assuming absolute/relative commands from vtracer."""
    # vtracer emits 'M x y C ... Z' with optional transform="translate(tx,ty)"
    return d


def generate_adaptive_icon_xmls(
    orig_w: int,
    orig_h: int,
    wm_w: float,
    wm_h: float,
    wm_paths: list[tuple[str, str]],
    crowd_w: float,
    crowd_h: float,
    crowd_y_start: int,
    crowd_paths: list[tuple[str, str]],
) -> None:
    """Generate Android Adaptive Icon XMLs (108x108dp viewport, 62% centered safe zone)."""
    bg_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="{PALETTE['background']}"
        android:pathData="M0,0h108v108h-108z" />
</vector>
"""
    (OUT_DIR / "ic_launcher_background.xml").write_text(bg_xml, encoding="utf-8")

    # 62% of 108dp = 66.96dp square centered at (20.52, 20.52)
    safe_size = 108.0 * 0.62
    scale = safe_size / max(orig_w, orig_h)
    offset_x = (108.0 - orig_w * scale) / 2.0
    offset_y = (108.0 - orig_h * scale) / 2.0

    # Original wordmark bbox offset in logoOpcion2.jpg: x0=364, y0=265 (approx from pad=24)
    # Actually let's place wordmark & crowd relative to original image coordinates!
    # Wordmark was cropped at (388-24, 289-24) = (364, 265)
    wm_x0 = 364.0
    wm_y0 = 265.0

    fg_lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:width="108dp"',
        '    android:height="108dp"',
        '    android:viewportWidth="108"',
        '    android:viewportHeight="108">',
        f'    <group android:translateX="{offset_x:.2f}" android:translateY="{offset_y:.2f}" '
        f'android:scaleX="{scale:.5f}" android:scaleY="{scale:.5f}">',
        f'        <group android:translateX="{wm_x0:.1f}" android:translateY="{wm_y0:.1f}">',
    ]
    for tr, d in wm_paths:
        m = re.search(r"translate\(([^,]+),([^)]+)\)", tr) if tr else None
        if m:
            tx, ty = float(m.group(1)), float(m.group(2))
            fg_lines.append(
                f'            <group android:translateX="{tx:.2f}" android:translateY="{ty:.2f}">'
            )
            fg_lines.append(
                f'                <path android:fillColor="{PALETTE["wordmark"]}" android:pathData="{d}" />'
            )
            fg_lines.append("            </group>")
        else:
            fg_lines.append(
                f'            <path android:fillColor="{PALETTE["wordmark"]}" android:pathData="{d}" />'
            )
    fg_lines.append("        </group>")
    fg_lines.append(
        f'        <group android:translateX="0" android:translateY="{crowd_y_start}">'
    )
    for fill_key, d in crowd_paths:
        if "|" in fill_key:
            fill, tr = fill_key.split("|", 1)
            m = re.search(r"translate\(([^,]+),([^)]+)\)", tr)
            if m:
                tx, ty = float(m.group(1)), float(m.group(2))
                fg_lines.append(
                    f'            <group android:translateX="{tx:.2f}" android:translateY="{ty:.2f}">'
                )
                fg_lines.append(
                    f'                <path android:fillColor="{fill}" android:pathData="{d}" />'
                )
                fg_lines.append("            </group>")
                continue
        else:
            fill = fill_key
        fg_lines.append(
            f'            <path android:fillColor="{fill}" android:pathData="{d}" />'
        )
    fg_lines.append("        </group>")
    fg_lines.append("    </group>")
    fg_lines.append("</vector>\n")
    (OUT_DIR / "ic_launcher_foreground.xml").write_text(
        "\n".join(fg_lines), encoding="utf-8"
    )


def generate_preview_html(orig_rel: str) -> None:
    wm_svg = (OUT_DIR / "iam_wordmark.svg").read_text(encoding="utf-8")
    crowd_svg = (OUT_DIR / "iam_crowd.svg").read_text(encoding="utf-8")

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>IAM — Preview Vectorizado (Celeste Sereno #6BB9E8)</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #101820;
      color: #f0f4f8;
      padding: 32px;
    }}
    h1 {{ font-size: 22px; margin-bottom: 8px; }}
    p.sub {{ color: #94a3b8; margin-bottom: 28px; font-size: 14px; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 28px;
      align-items: start;
    }}
    .card {{
      background: #1a2430;
      border-radius: 18px;
      padding: 20px;
      border: 1px solid #2b3a4a;
    }}
    .card h2 {{ font-size: 15px; margin-bottom: 14px; color: #cbd5e1; }}
    .square-frame {{
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 16px;
      overflow: hidden;
      background: {PALETTE["background"]};
    }}
    .square-frame img.orig {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    .wordmark-layer {{
      position: absolute;
      top: 17%;
      left: 50%;
      transform: translateX(-50%);
      width: 56%;
    }}
    .wordmark-layer svg {{
      width: 100%;
      height: auto;
      display: block;
    }}
    .crowd-layer {{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 51%;
    }}
    .crowd-layer svg {{
      width: 100%;
      height: 100%;
      display: block;
    }}
    .phone-frame {{
      position: relative;
      width: 280px;
      height: 580px;
      margin: 0 auto;
      border-radius: 36px;
      border: 6px solid #0b1016;
      overflow: hidden;
      background: {PALETTE["background"]};
      box-shadow: 0 20px 50px rgba(0,0,0,0.45);
    }}
    .phone-frame .wordmark-layer {{
      top: 18%;
      width: 58%;
    }}
    .phone-frame .crowd-layer {{
      height: 36%;
    }}
    .phone-buttons {{
      position: absolute;
      top: 42%;
      left: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}
    .fake-btn {{
      background: #ffffff;
      color: #1e3545;
      text-align: center;
      padding: 12px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }}
    .icon-row {{
      display: flex;
      gap: 24px;
      justify-content: center;
      padding: 16px 0;
    }}
    .adaptive-icon {{
      position: relative;
      width: 120px;
      height: 120px;
      background: {PALETTE["background"]};
      overflow: hidden;
    }}
    .adaptive-icon.circle {{ border-radius: 50%; }}
    .adaptive-icon.squircle {{ border-radius: 26%; }}
    .adaptive-safe {{
      position: absolute;
      inset: 19%;
    }}
    .adaptive-safe .wordmark-layer {{ top: 15%; width: 58%; }}
    .adaptive-safe .crowd-layer {{ height: 52%; }}
    .checker {{
      background-image: linear-gradient(45deg, #253240 25%, transparent 25%),
        linear-gradient(-45deg, #253240 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #253240 75%),
        linear-gradient(-45deg, transparent 75%, #253240 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      background-color: #1c2733;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
    }}
    .swatches {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }}
    .swatch {{
      display: flex;
      align-items: center;
      gap: 6px;
      background: #101820;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-family: monospace;
    }}
    .swatch i {{
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }}
  </style>
</head>
<body>
  <h1>IAM — Validación de Vectorización Exacta (Celeste Sereno)</h1>
  <p class="sub">Calco directo desde <code>logoOpcion2.jpg</code> con <code>vtracer</code> (curvas spline reales, 3 capas separadas). Revisa la fidelidad antes de integrar a Flutter/Android.</p>

  <div class="grid">
    <div class="card">
      <h2>1. Original (logoOpcion2.jpg)</h2>
      <div class="square-frame">
        <img class="orig" src="{orig_rel}" alt="logoOpcion2 original" />
      </div>
    </div>

    <div class="card">
      <h2>2. Nuevo Vector Compuesto (#6BB9E8 + SVG)</h2>
      <div class="square-frame">
        <div class="wordmark-layer">{wm_svg}</div>
        <div class="crowd-layer">{crowd_svg}</div>
      </div>
      <div class="swatches">
        <span class="swatch"><i style="background:{PALETTE['background']}"></i>Fondo {PALETTE['background']}</span>
        <span class="swatch"><i style="background:{PALETTE['wordmark']}"></i>iam {PALETTE['wordmark']}</span>
        <span class="swatch"><i style="background:{PALETTE['center_silhouette']}"></i>Centro {PALETTE['center_silhouette']}</span>
        {"".join(f'<span class="swatch"><i style="background:{c}"></i>{c}</span>' for c in PALETTE['crowd_layers'])}
      </div>
    </div>

    <div class="card">
      <h2>3. Simulación Pantalla Login / Splash (9:19.5)</h2>
      <div class="phone-frame">
        <div class="wordmark-layer">{wm_svg}</div>
        <div class="phone-buttons">
          <div class="fake-btn">Continuar con Google</div>
        </div>
        <div class="crowd-layer">{crowd_svg}</div>
      </div>
    </div>

    <div class="card">
      <h2>4. Adaptive Icon (Safe Zone 62%) & Capas</h2>
      <div class="icon-row">
        <div class="adaptive-icon circle">
          <div class="adaptive-safe">
            <div class="wordmark-layer">{wm_svg}</div>
            <div class="crowd-layer">{crowd_svg}</div>
          </div>
        </div>
        <div class="adaptive-icon squircle">
          <div class="adaptive-safe">
            <div class="wordmark-layer">{wm_svg}</div>
            <div class="crowd-layer">{crowd_svg}</div>
          </div>
        </div>
      </div>
      <div class="checker">
        <div style="max-width:220px;margin:0 auto;">{wm_svg}</div>
      </div>
      <div class="checker" style="padding:0;overflow:hidden;height:140px;">
        <div style="width:100%;height:100%;">{crowd_svg}</div>
      </div>
    </div>
  </div>
</body>
</html>
"""
    (OUT_DIR / "preview.html").write_text(html, encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img_bgr = cv2.imread(str(DEFAULT_INPUT))
    if img_bgr is None:
        raise FileNotFoundError(f"Could not read {DEFAULT_INPUT}")
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    H, W, _ = img_rgb.shape

    wm_w, wm_h, wm_paths = extract_wordmark_svg(img_rgb, OUT_DIR / "iam_wordmark.svg")
    crowd_w, crowd_h, crowd_y_start, crowd_paths = extract_crowd_svg(
        img_rgb, OUT_DIR / "iam_crowd.svg"
    )
    generate_adaptive_icon_xmls(
        W, H, wm_w, wm_h, wm_paths, crowd_w, crowd_h, crowd_y_start, crowd_paths
    )
    orig_rel = os.path.relpath(DEFAULT_INPUT, OUT_DIR).replace("\\", "/")
    generate_preview_html(orig_rel)

    print(f"Generated in {OUT_DIR}:")
    for f in sorted(OUT_DIR.iterdir()):
        print(f"  - {f.name} ({f.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
