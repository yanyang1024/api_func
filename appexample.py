from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Callable, Dict, List, Tuple
import base64
import csv
import io
import os
import random
import tempfile
from PIL import Image, ImageDraw

app = FastAPI()

class FuncInput(BaseModel):
    s1: str
    s2: str
    s3: str
    s4: str
    s5: str
    n: int

def _make_csv_text(rows: int, cols: int) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([f"col{i+1}" for i in range(cols)])
    for _ in range(rows):
        writer.writerow([random.randint(0, 100) for _ in range(cols)])
    return output.getvalue()

def _make_image(width: int = 2000, height: int = 1000) -> Image.Image:
    img = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    for _ in range(12):
        x1, y1 = random.randint(0, width - 1), random.randint(0, height - 1)
        x2, y2 = random.randint(0, width - 1), random.randint(0, height - 1)
        color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255), 255)
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
    return img

def simulate_func_a(s1: str, s2: str, s3: str, s4: str, s5: str, n: int) -> Tuple[str, str, Image.Image]:
    rows = max(1, n)
    csv1 = _make_csv_text(rows, 5)
    csv2 = _make_csv_text(max(1, rows // 2), 4)
    img = _make_image()
    return csv1, csv2, img

def simulate_func_b(s1: str, s2: str, s3: str, s4: str, s5: str, n: int) -> Tuple[str, str, Image.Image]:
    rows = max(2, n + 2)
    csv1 = _make_csv_text(rows, 6)
    csv2 = _make_csv_text(max(2, rows // 3), 3)
    img = _make_image(1600, 900)
    return csv1, csv2, img

FUNCTIONS: Dict[str, Callable[[str, str, str, str, str, int], Tuple[str, str, Image.Image]]] = {
    "func_a": simulate_func_a,
    "func_b": simulate_func_b,
}

def _persist_csv(csv_text: str, filename: str) -> str:
    temp_dir = tempfile.mkdtemp()
    path = os.path.join(temp_dir, filename)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_text)
    return path

def _persist_image(img: Image.Image, filename: str) -> str:
    temp_dir = tempfile.mkdtemp()
    path = os.path.join(temp_dir, filename)
    img.save(path, format="PNG")
    return path

def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")

def _b64_bytes(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")

@app.get("/v1/functions")
def list_functions() -> List[str]:
    return sorted(FUNCTIONS.keys())

@app.post("/v1/run/{func_name}")
def run_func(func_name: str, payload: FuncInput):
    func = FUNCTIONS.get(func_name)
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")

    csv1_text, csv2_text, img = func(payload.s1, payload.s2, payload.s3, payload.s4, payload.s5, payload.n)

    csv1_path = _persist_csv(csv1_text, "result_1.csv")
    csv2_path = _persist_csv(csv2_text, "result_2.csv")
    img_path = _persist_image(img, "chart.png")

    img_buffer = io.BytesIO()
    img.save(img_buffer, format="PNG")
    img_bytes = img_buffer.getvalue()

    return {
        "function": func_name,
        "csv_files": [
            {
                "name": "result_1.csv",
                "path": csv1_path,
                "content_base64": _b64(csv1_text),
            },
            {
                "name": "result_2.csv",
                "path": csv2_path,
                "content_base64": _b64(csv2_text),
            },
        ],
        "image": {
            "name": "chart.png",
            "path": img_path,
            "content_base64": _b64_bytes(img_bytes),
            "content_type": "image/png",
        },
    }