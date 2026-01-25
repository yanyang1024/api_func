from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import shutil
import tempfile
from typing import Any, Dict

from PIL import Image


@dataclass
class Artifacts:
    csv1: bytes
    csv2: bytes
    png: bytes
    meta: Dict[str, Any]


def _image_to_png_bytes(img: Image.Image) -> bytes:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _try_cleanup_generated_files(csv1_path: str, csv2_path: str) -> None:
    p1 = Path(csv1_path).resolve()
    p2 = Path(csv2_path).resolve()
    if not p1.exists() or not p2.exists():
        return
    if p1.parent != p2.parent:
        return
    tmp_root = Path(tempfile.gettempdir()).resolve()
    parent = p1.parent
    try:
        if tmp_root in parent.parents or parent == tmp_root:
            shutil.rmtree(parent, ignore_errors=True)
    except Exception:
        return


def adapt_func_output(func, s1: str, s2: str, s3: str, s4: str, s5: str, n: int) -> Artifacts:
    csv1_path, csv2_path, pil_img = func(s1, s2, s3, s4, s5, n)

    csv1_bytes = Path(csv1_path).read_bytes()
    csv2_bytes = Path(csv2_path).read_bytes()
    png_bytes = _image_to_png_bytes(pil_img)

    meta = {
        "csv1_name": Path(csv1_path).name,
        "csv2_name": Path(csv2_path).name,
        "image_name": "chart.png",
        "inputs": {"s1": s1, "s2": s2, "s3": s3, "s4": s4, "s5": s5, "n": n},
    }

    _try_cleanup_generated_files(csv1_path, csv2_path)

    return Artifacts(csv1=csv1_bytes, csv2=csv2_bytes, png=png_bytes, meta=meta)

