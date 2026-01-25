from __future__ import annotations

import csv
import random
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.core.registry import register


def _write_csv(path: Path, header: list[str], rows: list[list[object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def _make_chart_png(width: int, height: int, series: list[int], title: str) -> Image.Image:
    img = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    pad = 80
    x0, y0 = pad, height - pad
    x1, y1 = width - pad, pad

    draw.line((x0, y0, x1, y0), fill=(0, 0, 0, 255), width=3)
    draw.line((x0, y0, x0, y1), fill=(0, 0, 0, 255), width=3)

    if series:
        ymin = min(series)
        ymax = max(series)
        span = max(1, ymax - ymin)
        step_x = (x1 - x0) / max(1, len(series) - 1)

        pts = []
        for i, v in enumerate(series):
            x = x0 + i * step_x
            y = y0 - ((v - ymin) / span) * (y0 - y1)
            pts.append((x, y))

        draw.line(pts, fill=(30, 144, 255, 255), width=4)
        for x, y in pts:
            r = 6
            draw.ellipse((x - r, y - r, x + r, y + r), fill=(30, 144, 255, 255))

    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    draw.text((pad, 20), title, fill=(0, 0, 0, 255), font=font)
    draw.text((pad, height - pad + 20), "index", fill=(0, 0, 0, 255), font=font)
    draw.text((20, pad), "value", fill=(0, 0, 0, 255), font=font)
    return img


@register("simulate")
def simulate_func(s1: str, s2: str, s3: str, s4: str, s5: str, n: int):
    job_dir = Path(tempfile.mkdtemp(prefix="job_"))

    rows1 = []
    series = []
    for i in range(n):
        v = random.randint(0, 1000)
        series.append(v)
        rows1.append([i, v, random.choice([s1, s2, s3, s4, s5])])

    csv1 = job_dir / "result1.csv"
    _write_csv(csv1, ["idx", "value", "tag"], rows1)

    rows2 = []
    for i in range(max(1, n // 2)):
        rows2.append([i, random.random(), s1, s2, s3, s4, s5])

    csv2 = job_dir / "result2.csv"
    _write_csv(csv2, ["idx", "score", "s1", "s2", "s3", "s4", "s5"], rows2)

    title = f"Simulated Chart (n={n})"
    img = _make_chart_png(2000, 1000, series, title)
    return str(csv1), str(csv2), img

