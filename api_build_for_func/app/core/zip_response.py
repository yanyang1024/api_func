from __future__ import annotations

from io import BytesIO
import json
import zipfile

from fastapi.responses import StreamingResponse

from app.core.adapter import Artifacts


def zip_artifacts(artifacts: Artifacts, zip_name: str) -> StreamingResponse:
    mem = BytesIO()
    with zipfile.ZipFile(mem, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("meta.json", json.dumps(artifacts.meta, ensure_ascii=False))
        z.writestr("result1.csv", artifacts.csv1)
        z.writestr("result2.csv", artifacts.csv2)
        z.writestr("chart.png", artifacts.png)

    mem.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{zip_name}"'}
    return StreamingResponse(mem, media_type="application/zip", headers=headers)

