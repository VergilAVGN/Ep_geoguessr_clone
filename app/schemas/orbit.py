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
    game_id: str | None = None
    layer: str | None = None
    date: str | None = None


class OrbitStartResponse(BaseModel):
    id: str
    correct_lat: float
    correct_lon: float
    round_number: int
    total_rounds: int
    total_score: int
    finished: bool = False


class OrbitGuessRequest(BaseModel):
    id: str
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    timed_out: bool = False


class OrbitGuessResult(BaseModel):
    score: int
    distance: float
    correct_lat: float
    correct_lon: float
    finished: bool
    round_number: int
    total_rounds: int
    game_finished: bool
    total_score: int


class OrbitRoundSummary(BaseModel):
    round_number: int
    score: int
    distance: float
    guess_lat: float
    guess_lon: float
    correct_lat: float
    correct_lon: float


class OrbitGameResults(BaseModel):
    id: str
    total_score: int
    max_score: int
    total_rounds: int
    stars: int
    rounds: list[OrbitRoundSummary]


class OrbitHintResponse(BaseModel):
    center_lat: float | None = None
    center_lon: float | None = None
    radius_km: int | None = None
    used: bool
    facts: list[str] = Field(default_factory=list)
