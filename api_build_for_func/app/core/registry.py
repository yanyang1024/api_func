from __future__ import annotations

from typing import Callable, Dict, Tuple

from PIL import Image

FuncType = Callable[[str, str, str, str, str, int], Tuple[str, str, Image.Image]]

_REGISTRY: Dict[str, FuncType] = {}


def register(name: str):
    def decorator(func: FuncType) -> FuncType:
        if name in _REGISTRY:
            raise RuntimeError(f"duplicate function name: {name}")
        _REGISTRY[name] = func
        return func

    return decorator


def get(name: str) -> FuncType | None:
    return _REGISTRY.get(name)


def list_names() -> list[str]:
    return sorted(_REGISTRY.keys())

