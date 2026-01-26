```python d:\apiservice_build\service\gradio_demo.py
from __future__ import annotations

import csv
import tempfile
from pathlib import Path
from typing import Any

import gradio as gr
from PIL import Image, ImageDraw


def make_demo_image(title: str, w: int = 1200, h: int = 600) -> Image.Image:
    img = Image.new("RGBA", (w, h), (245, 246, 250, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, w - 20, h - 20], outline=(60, 60, 60, 255), width=4)
    draw.text((40, 40), title, fill=(20, 20, 20, 255))
    for i in range(12):
        x0 = 60 + i * 85
        y0 = 140 + (i % 3) * 110
        draw.rectangle([x0, y0, x0 + 60, y0 + 70], fill=(90, 140, 220, 220))
    return img


def write_csv(path: Path, header: list[str], rows: list[list[Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def read_csv_as_table(path: str, max_rows: int = 200) -> list[list[str]]:
    p = Path(path)
    if not p.exists():
        return []
    table: list[list[str]] = []
    with p.open("r", newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        for i, row in enumerate(r):
            if i >= max_rows:
                break
            table.append([str(x) for x in row])
    return table


def sample_fn(a: str, b: str, c: int, d: int, e: str) -> dict:
    out_dir = Path(tempfile.mkdtemp(prefix="gradio_demo_"))
    ppt_path = out_dir / "ppt_file_path.pptx"
    t_test_csv_path = out_dir / "t_test.csv"
    rawdata_csv_path = out_dir / "rawdata.csv"

    ppt_path.write_bytes(b"demo-pptx-placeholder")

    write_csv(
        t_test_csv_path,
        ["metric", "group", "value"],
        [
            ["t_stat", "A", c],
            ["t_stat", "B", d],
            ["note", "text", e],
        ],
    )
    write_csv(
        rawdata_csv_path,
        ["id", "name", "score"],
        [
            [1, a, c],
            [2, b, d],
            [3, "extra", c + d],
        ],
    )

    images = [
        make_demo_image(f"Processing completed: a={a}, b={b}, c={c}, d={d}, e={e}"),
        make_demo_image("Chart 2"),
    ]

    return {
        "message": "Inline compare Processing completed!",
        "result": {
            "files": [str(ppt_path), str(t_test_csv_path), str(rawdata_csv_path)],
            "images": images,
        },
    }


def run_and_convert(a: str, b: str, c: int, d: int, e: str):
    payload = sample_fn(a=a, b=b, c=c, d=d, e=e)
    message = payload["message"]
    files = payload["result"]["files"]
    images = payload["result"]["images"]

    t_test_path = next((p for p in files if Path(p).name.lower().startswith("t_test") and p.lower().endswith(".csv")), "")
    rawdata_path = next((p for p in files if Path(p).name.lower().startswith("rawdata") and p.lower().endswith(".csv")), "")

    t_test_table = read_csv_as_table(t_test_path)
    rawdata_table = read_csv_as_table(rawdata_path)

    return message, images, files, t_test_table, rawdata_table


with gr.Blocks() as demo:
    gr.Markdown("## 最小 Gradio Demo：预览表格 + 预览图 + 下载文件（直接调用 Python 函数）")

    with gr.Row():
        a = gr.Textbox(label="a (str)", value="u1")
        b = gr.Textbox(label="b (str)", value="p1")
        c = gr.Number(label="c (int)", value=1, precision=0)
        d = gr.Number(label="d (int)", value=2, precision=0)
        e = gr.Textbox(label="e (str)", value="ok")

    btn = gr.Button("运行函数")

    msg = gr.Textbox(label="message")
    gallery = gr.Gallery(label="images", columns=2, height=360)
    downloads = gr.File(label="files (download)", file_count="multiple")

    with gr.Row():
        t_test_df = gr.Dataframe(label="t_test.csv (preview)", interactive=False)
        rawdata_df = gr.Dataframe(label="rawdata.csv (preview)", interactive=False)

    btn.click(
        fn=run_and_convert,
        inputs=[a, b, c, d, e],
        outputs=[msg, gallery, downloads, t_test_df, rawdata_df],
    )

if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=7860)
```

- 运行方式（在 `d:\apiservice_build\service` 目录）：

```bat
python -m venv .venv
.venv\Scripts\activate
pip install gradio pillow
python gradio_demo.py
```

- 类型转换要点（你这里是“直接调用函数”所以最简单）  
- 图片：保持 `PIL.Image.Image` 列表，直接作为 `gr.Gallery` 输出  
- CSV：保持“文件路径字符串”用于 `gr.File` 下载；另外用 `csv.reader` 把 CSV 读成 `list[list[str]]` 给 `gr.Dataframe` 预览  
- message：直接 `str` 输出到 `gr.Textbox` 或 `gr.Markdown`

手动把文件创建为 [gradio_demo.py](file:///d:/apiservice_build/service/gradio_demo.py) 后运行即可。