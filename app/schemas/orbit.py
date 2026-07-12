from pydantic import BaseModel, Field


class OrbitMetadata(BaseModel):
    latitude: float
    longitude: float
    layer: str
    date: str
    bbox: str


class OrbitImageResponse(BaseModel):
    """JSON representation of a random orbit image (metadata + base64 JPEG)."""

    metadata: OrbitMetadata
    image_base64: str


class OrbitStartRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class OrbitStartResponse(BaseModel):
    id: str
    correct_lat: float
    correct_lon: float


class OrbitGuessRequest(BaseModel):
    id: str
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class OrbitGuessResult(BaseModel):
    score: int
    distance: float
    correct_lat: float
    correct_lon: float
    finished: bool
