from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    s1: str = Field(..., min_length=1)
    s2: str = Field(..., min_length=1)
    s3: str = Field(..., min_length=1)
    s4: str = Field(..., min_length=1)
    s5: str = Field(..., min_length=1)
    n: int = Field(..., ge=1, le=100000)

