# Python 函数封装为 API（CSV + PNG）示例

这个示例把“输入为 5 个字符串 + 1 个整型，输出为 2 个 CSV 文件路径 + 1 个 PIL 图片对象”的函数封装为 HTTP API。

API 返回一个 `application/zip`：
- `result1.csv`
- `result2.csv`
- `chart.png`
- `meta.json`

## 运行

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

打开接口文档：`http://127.0.0.1:8000/docs`

## 调用

```bash
curl -X POST "http://127.0.0.1:8000/v1/run/simulate" \
  -H "Content-Type: application/json" \
  -d '{"s1":"a","s2":"b","s3":"c","s4":"d","s5":"e","n":10}' \
  --output simulate.zip
```

解压 `simulate.zip` 即可获得两份 CSV 和 PNG。

## 扩展更多函数

1. 在 `app/functions/` 新建你的函数文件，保持函数签名：
   - `def your_func(s1, s2, s3, s4, s5, n) -> (csv1_path, csv2_path, pil_img)`
2. 用 `@register("your_name")` 注册（见 `app/functions/simulated.py`）
3. 通过 `POST /v1/run/your_name` 调用

