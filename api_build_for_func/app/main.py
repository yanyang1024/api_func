from __future__ import annotations

from fastapi import FastAPI, HTTPException

from app.core.adapter import adapt_func_output
from app.core.registry import get as get_func, list_names
from app.core.zip_response import zip_artifacts
from app.models import RunRequest

import app.functions.simulated

app = FastAPI(title="Function Wrapper API", version="1.0.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/v1/functions")
def functions():
    return {"functions": list_names()}


@app.post("/v1/run/{func_name}")
def run(func_name: str, req: RunRequest):
    func = get_func(func_name)
    if func is None:
        raise HTTPException(status_code=404, detail="Unknown func_name")

    try:
        artifacts = adapt_func_output(func, req.s1, req.s2, req.s3, req.s4, req.s5, req.n)
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))

    return zip_artifacts(artifacts, zip_name=f"{func_name}.zip")

