下面给你一套“最简单但可扩展”的 API 服务封装方案：用 FastAPI 把“多个入参数量不同、出参结构一致（CSV + 图片）”的函数统一封装成接口；同时支持：
- 返回 **inline 数据**（CSV 内容 + 图片 PNG 的 base64，客户端直接落盘）
- 也支持返回 **可下载 URL**（服务端保存文件，客户端按 URL 下载）

你现在无法提供现有函数，我会按你描述模拟 6 个样例函数（入参 5/6 个，字符串/整形；输出包含 3 个 CSV 文件 + 多张图片），并把整个服务代码、使用教程一次性给全。

---

## **一、项目代码（直接复制创建这些文件）**

### 1) 依赖文件

```txt d:\apiservice_build\service\requirements.txt
fastapi==0.115.6
uvicorn[standard]==0.32.1
pillow==10.4.0
pydantic==2.10.3
```

---

### 2) 核心 Schema（请求/响应）

```python d:\apiservice_build\service\app\schemas.py
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class OutputFile(BaseModel):
    name: str
    kind: Literal["ppt", "csv", "other"] = "other"
    path: Optional[str] = None
    download_url: Optional[str] = None
    content_base64: Optional[str] = None
    content_text: Optional[str] = None


class OutputImage(BaseModel):
    name: str
    mime: Literal["image/png"] = "image/png"
    width: int
    height: int
    png_base64: Optional[str] = None


class FunctionResult(BaseModel):
    files: list[OutputFile] = Field(default_factory=list)
    images: list[OutputImage] = Field(default_factory=list)


class FunctionResponse(BaseModel):
    message: str
    result: FunctionResult


class Fn1Request(BaseModel):
    a: str
    b: str
    c: int
    d: int
    e: str


class Fn2Request(BaseModel):
    a: str
    b: str
    c: int
    d: int
    e: str
    f: str


class Fn3Request(BaseModel):
    user_id: str
    project: str
    version: int
    threshold: int
    mode: str


class Fn4Request(BaseModel):
    user_id: str
    project: str
    version: int
    threshold: int
    mode: str
    seed: int


class Fn5Request(BaseModel):
    x: str
    y: str
    n: int
    m: int
    tag: str


class Fn6Request(BaseModel):
    x: str
    y: str
    n: int
    m: int
    tag: str
    level: int


class FunctionInfo(BaseModel):
    name: str
    request_schema: dict[str, Any]
```

---

### 3) 工具函数（保存 CSV/图片、base64、下载安全校验）

```python d:\apiservice_build\service\app\utils.py
from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Iterable

from PIL import Image


def get_output_root() -> Path:
    base = Path(__file__).resolve().parents[1]
    p = os.getenv("OUTPUT_ROOT")
    out = Path(p) if p else (base / "outputs")
    out.mkdir(parents=True, exist_ok=True)
    return out


def b64encode_bytes(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def image_to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def write_csv_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def safe_join_under(root: Path, *parts: str) -> Path:
    candidate = (root.joinpath(*parts)).resolve()
    root_resolved = root.resolve()
    if root_resolved not in candidate.parents and candidate != root_resolved:
        raise ValueError("unsafe path")
    return candidate


def guess_kind_from_name(name: str) -> str:
    n = name.lower()
    if n.endswith(".csv"):
        return "csv"
    if n.endswith(".ppt") or n.endswith(".pptx"):
        return "ppt"
    return "other"
```

---

### 4) 6 个样例函数（模拟你的真实函数：入参数量不同、输出 CSV+图片）

```python d:\apiservice_build\service\app\sample_funcs.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


@dataclass
class HandlerOutput:
    message: str
    files: list[Path]
    images: list[Image.Image]


def _make_demo_image(title: str, w: int = 2000, h: int = 1000) -> Image.Image:
    img = Image.new("RGBA", (w, h), (245, 246, 250, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 40, w - 40, h - 40], outline=(60, 60, 60, 255), width=6)
    try:
        font = ImageFont.truetype("arial.ttf", 48)
    except Exception:
        font = ImageFont.load_default()
    draw.text((80, 90), title, fill=(20, 20, 20, 255), font=font)
    for i in range(10):
        x0 = 120 + i * 160
        y0 = 240 + (i % 3) * 120
        draw.rectangle([x0, y0, x0 + 120, y0 + 80], fill=(90, 140, 220, 220))
    return img


def _make_demo_csv_text(prefix: str) -> str:
    rows = [
        ["col_a", "col_b", "value"],
        [f"{prefix}_r1", "alpha", "10"],
        [f"{prefix}_r2", "beta", "20"],
        [f"{prefix}_r3", "gamma", "30"],
    ]
    return "\n".join([",".join(r) for r in rows]) + "\n"


def fn1(a: str, b: str, c: int, d: int, e: str, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn1: {a},{b},{c},{d},{e}"),
        _make_demo_image("fn1: chart-2"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)


def fn2(a: str, b: str, c: int, d: int, e: str, f: str, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn2: {a},{b},{c},{d},{e},{f}"),
        _make_demo_image("fn2: chart-2"),
        _make_demo_image("fn2: chart-3"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)


def fn3(user_id: str, project: str, version: int, threshold: int, mode: str, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn3: {user_id}/{project} v{version} th={threshold} mode={mode}"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)


def fn4(user_id: str, project: str, version: int, threshold: int, mode: str, seed: int, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn4: {user_id}/{project} v{version} seed={seed}"),
        _make_demo_image("fn4: chart-2"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)


def fn5(x: str, y: str, n: int, m: int, tag: str, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn5: {x},{y},{n},{m},{tag}"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)


def fn6(x: str, y: str, n: int, m: int, tag: str, level: int, out_dir: Path) -> HandlerOutput:
    files = [
        out_dir / "ppt_file_path.pptx",
        out_dir / "t_test.csv",
        out_dir / "rawdata.csv",
    ]
    files[0].write_bytes(b"demo-pptx-placeholder")
    files[1].write_text(_make_demo_csv_text("t_test"), encoding="utf-8")
    files[2].write_text(_make_demo_csv_text("rawdata"), encoding="utf-8")
    images = [
        _make_demo_image(f"fn6: {x},{y},{n},{m},{tag},level={level}"),
        _make_demo_image("fn6: chart-2"),
    ]
    return HandlerOutput(message="Inline compare Processing completed!", files=files, images=images)
```

---

### 5) 注册中心（扩展多个函数时只改这里）

```python d:\apiservice_build\service\app\registry.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Type

from pydantic import BaseModel

from . import sample_funcs
from .schemas import Fn1Request, Fn2Request, Fn3Request, Fn4Request, Fn5Request, Fn6Request


@dataclass(frozen=True)
class FunctionSpec:
    name: str
    request_model: Type[BaseModel]
    handler: Callable[..., Any]


FUNCTIONS: dict[str, FunctionSpec] = {
    "fn1": FunctionSpec(name="fn1", request_model=Fn1Request, handler=sample_funcs.fn1),
    "fn2": FunctionSpec(name="fn2", request_model=Fn2Request, handler=sample_funcs.fn2),
    "fn3": FunctionSpec(name="fn3", request_model=Fn3Request, handler=sample_funcs.fn3),
    "fn4": FunctionSpec(name="fn4", request_model=Fn4Request, handler=sample_funcs.fn4),
    "fn5": FunctionSpec(name="fn5", request_model=Fn5Request, handler=sample_funcs.fn5),
    "fn6": FunctionSpec(name="fn6", request_model=Fn6Request, handler=sample_funcs.fn6),
}
```

---

### 6) FastAPI 服务入口（统一封装、返回格式与你要求一致）

```python d:\apiservice_build\service\app\main.py
from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .registry import FUNCTIONS
from .schemas import FunctionInfo, FunctionResponse, FunctionResult, OutputFile, OutputImage
from .utils import b64encode_bytes, get_output_root, guess_kind_from_name, image_to_png_bytes, safe_join_under


app = FastAPI(title="Function API Service", version="1.0.0")


class RunRequest(BaseModel):
    params: dict[str, Any]


@app.get("/v1/functions", response_model=list[FunctionInfo])
def list_functions() -> list[FunctionInfo]:
    items: list[FunctionInfo] = []
    for name, spec in FUNCTIONS.items():
        items.append(
            FunctionInfo(
                name=name,
                request_schema=spec.request_model.model_json_schema(),
            )
        )
    return items


@app.post("/v1/run/{fn_name}", response_model=FunctionResponse)
def run_function(
    fn_name: str,
    body: RunRequest = Body(...),
    inline: bool = True,
) -> FunctionResponse:
    spec = FUNCTIONS.get(fn_name)
    if not spec:
        raise HTTPException(status_code=404, detail=f"unknown function: {fn_name}")

    output_root = get_output_root()
    job_id = uuid.uuid4().hex
    out_dir = (output_root / job_id).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        req_obj = spec.request_model.model_validate(body.params)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    handler_kwargs = dict(req_obj.model_dump())
    handler_kwargs["out_dir"] = out_dir

    try:
        handler_out = spec.handler(**handler_kwargs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"handler error: {e}")

    files: list[OutputFile] = []
    for p in handler_out.files:
        p = Path(p)
        name = p.name
        kind = guess_kind_from_name(name)
        download_url = f"/v1/download/{job_id}/{name}"
        item = OutputFile(name=name, kind=kind, path=str(p), download_url=download_url)
        if inline:
            data = p.read_bytes()
            item.content_base64 = b64encode_bytes(data)
            if kind == "csv":
                try:
                    item.content_text = data.decode("utf-8")
                except Exception:
                    item.content_text = None
        files.append(item)

    images: list[OutputImage] = []
    for idx, img in enumerate(handler_out.images):
        png = image_to_png_bytes(img)
        item = OutputImage(
            name=f"image_{idx + 1}.png",
            width=img.width,
            height=img.height,
            png_base64=b64encode_bytes(png) if inline else None,
        )
        images.append(item)

    return FunctionResponse(
        message=handler_out.message,
        result=FunctionResult(files=files, images=images),
    )


@app.get("/v1/download/{job_id}/{filename}")
def download(job_id: str, filename: str):
    output_root = get_output_root()
    try:
        p = safe_join_under(output_root, job_id, filename)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid path")

    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="file not found")

    media_type, _ = mimetypes.guess_type(str(p))
    return FileResponse(path=str(p), media_type=media_type or "application/octet-stream", filename=p.name)
```

---

## **二、启动与部署（最简单）**

在 `d:\apiservice_build\service` 目录执行：

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- 在线接口文档（Swagger UI）：`http://127.0.0.1:8000/docs`
- 查看有哪些函数：`GET http://127.0.0.1:8000/v1/functions`

---

## **三、调用方式（客户端如何拿到 CSV 和图片）**

### 1) curl 调用（拿 inline base64 数据，最省事）

```bash
curl -X POST "http://127.0.0.1:8000/v1/run/fn1?inline=true" ^
  -H "Content-Type: application/json" ^
  -d "{\"params\":{\"a\":\"u1\",\"b\":\"p1\",\"c\":1,\"d\":2,\"e\":\"ok\"}}"
```

返回结构与你要求一致（只是在 `files/images` 内增加了更适合传输的字段）：

```json
{
  "message": "Inline compare Processing completed!",
  "result": {
    "files": [
      {
        "name": "ppt_file_path.pptx",
        "kind": "ppt",
        "path": "D:\\...\\outputs\\<job_id>\\ppt_file_path.pptx",
        "download_url": "/v1/download/<job_id>/ppt_file_path.pptx",
        "content_base64": "...."
      },
      {
        "name": "t_test.csv",
        "kind": "csv",
        "path": "...",
        "download_url": "/v1/download/<job_id>/t_test.csv",
        "content_base64": "....",
        "content_text": "col_a,col_b,value\n..."
      }
    ],
    "images": [
      {
        "name": "image_1.png",
        "mime": "image/png",
        "width": 2000,
        "height": 1000,
        "png_base64": "...."
      }
    ]
  }
}
```

### 2) Python 调用并落盘（CSV + PNG）

```python
import base64
import requests
from pathlib import Path

resp = requests.post(
    "http://127.0.0.1:8000/v1/run/fn2?inline=true",
    json={"params": {"a":"u1","b":"p1","c":1,"d":2,"e":"ok","f":"extra"}},
)
resp.raise_for_status()
data = resp.json()

out = Path("client_outputs")
out.mkdir(exist_ok=True)

for f in data["result"]["files"]:
    if f.get("content_base64"):
        (out / f["name"]).write_bytes(base64.b64decode(f["content_base64"]))

for im in data["result"]["images"]:
    if im.get("png_base64"):
        (out / im["name"]).write_bytes(base64.b64decode(im["png_base64"]))

print("saved to", out.resolve())
```

### 3) 只要下载 URL（不返回 base64，适合大文件）

把 `inline=false`：

- `POST /v1/run/fn1?inline=false`

响应里不会带 `content_base64/png_base64`，你再用 `download_url` 去拉文件即可：
- `GET http://127.0.0.1:8000/v1/download/<job_id>/t_test.csv`

---

## **四、如何扩展到更多“类似函数”（最省维护）**

你后续每增加一个真实函数，只需要做 3 件事（不改主服务逻辑）：
- 在 [sample_funcs.py](file:///d:/apiservice_build/service/app/sample_funcs.py) 增加真实函数（签名里加 `out_dir: Path`，并返回 `HandlerOutput`：message + files(list[Path]) + images(list[PIL.Image.Image])）
- 在 [schemas.py](file:///d:/apiservice_build/service/app/schemas.py) 增加一个对应的 Request Model（字段类型保持 str/int）
- 在 [registry.py](file:///d:/apiservice_build/service/app/registry.py) 的 `FUNCTIONS` 字典注册：`name + request_model + handler`

这样就能支持“6 个变 60 个”，API 仍然稳定统一。

---

## **五、你真实函数怎么接入（替换样例函数即可）**

你的真实函数当前可能长这样（示意）：
- 入参：5 或 6 个 str/int
- 返回：`{message, result: {files:[...path...], images:[PIL.Image,...]}}`

建议你把它改成“输出落盘 + 返回 Path + PIL.Image”的形式（就像样例 `fn1~fn6`），原因是：
- API 传输需要“字节/字符串”，PIL.Image 需要统一转 PNG bytes（服务里已经做了）
- CSV 最稳是先落盘，再按需 inline 或下载

如果你希望保持“你原函数完全不改”，也能适配：我可以再给你加一个 wrapper，把你原返回格式解析成 `HandlerOutput`（但你现在没法提供函数代码，我就先按最稳的落盘版示例实现了）。

---

把上面文件创建好后就能直接跑起来。如果你希望接口不是 `/v1/run/fn1` 而是 `/v1/fn1` 这种“一个函数一个 endpoint”，我也可以把路由按注册表自动生成成多个独立接口（对外更直观，内部一样复用）。