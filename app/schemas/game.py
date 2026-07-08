from typing import Optional

from pydantic import BaseModel, Field


class GuessCreate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class TargetInternal(BaseModel):
    name: str
    lat: float
    lon: float


class GameInternal(BaseModel):
    id: str
    status: str
    target: TargetInternal
    score: int
    last_guess: Optional[dict] = None
    distance_km: Optional[float] = None


class TargetOut(BaseModel):
    name: str


class GameOut(BaseModel):
    id: str
    status: str
    target: TargetOut
    score: int
    last_guess: Optional[dict] = None
    distance_km: Optional[float] = None
