toolName: view_folder
            
status: success
          
d:\apiservice_build
          

        
            
toolName: view_folder
            
status: success
          
d:\apiservice_build\
          
下面给出一个**最简单可用**的 API 服务封装方案：用 FastAPI 暴露统一接口，输入 5 个字符串 + 1 个整型，函数内部生成两份 CSV 和一张 PIL 图片，并在响应里同时返回 **文件路径** 和 **可直接传输的数据（Base64）**。  
我同时给出扩展到多函数的注册方式，便于后续维护。

```python d:\apiservice_build\app.py
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
```

**你需要做的事**
- 请手动创建文件或点击应用按钮将上述内容保存为 d:\apiservice_build\app.py。

**运行方式（Windows）**
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install fastapi uvicorn pillow
uvicorn app:app --host 0.0.0.0 --port 8000
```

**调用示例**
```bash
curl -X POST http://localhost:8000/v1/run/func_a ^
  -H "Content-Type: application/json" ^
  -d "{\"s1\":\"a\",\"s2\":\"b\",\"s3\":\"c\",\"s4\":\"d\",\"s5\":\"e\",\"n\":6}"
```

**响应数据建议格式（原因与选择）**
- JSON + Base64：最通用，前端/调用方解析方便，适合轻量数据传输。
- CSV/PNG 直接文件流：适合大文件，但需要更复杂的流式与存储管理。
- 统一结构：固定字段便于多函数扩展，调用方无需感知差异。

**多函数扩展方法论**
- 统一接口形态：保持输入结构一致，所有函数都走 /v1/run/{func_name}。
- 函数注册表：FUNCTIONS 统一维护，新增函数只需注册，不改业务逻辑。
- 版本化路径：/v1/... 为后续兼容做准备。
- 输出统一模型：csv_files + image，避免调用方反复适配。

**一般封装步骤与原因**
- 1) 抽象函数签名：统一输入和输出结构，减少接口分裂。
- 2) 设计传输格式：Base64 + JSON 简单可调试，跨语言可靠。
- 3) 生成文件并回传：路径方便追溯，Base64 保证远程可用。
- 4) 注册式路由：函数数量多时维护成本最低。
- 5) 统一入口网关：便于鉴权、监控、限流和日志收敛。

如果你希望进一步支持“直接下载 zip 包”、或者“上传参数中包含文件/更复杂结构”，告诉我接口期望，我会在此基础上给出更简洁的扩展实现。