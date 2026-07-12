import base64
import math
import random
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas.orbit import (
    OrbitGuessRequest,
    OrbitGuessResult,
    OrbitImageResponse,
    OrbitMetadata,
    OrbitStartRequest,
    OrbitStartResponse,
)
from app.services.nasa_service import NasaImageFetchError, nasa_service

router = APIRouter(prefix="/api/orbit", tags=["orbit"])

orbit_games: dict[str, dict[str, float | bool]] = {}


@router.get("/random")
def get_random_orbit_image(
    format: Literal["jpeg", "json"] = Query(
        default="jpeg",
        description="Return raw JPEG bytes or a JSON payload with metadata.",
    ),
):
    """
    Fetch a random satellite image from NASA GIBS.

    - `format=jpeg` (default): raw JPEG image
    - `format=json`: metadata + base64-encoded JPEG
    """
    try:
        image_bytes, raw_metadata = nasa_service.get_random_satellite_image()
    except NasaImageFetchError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    metadata = OrbitMetadata(**raw_metadata)

    if format == "json":
        return OrbitImageResponse(
            metadata=metadata,
            image_base64=base64.b64encode(image_bytes).decode("ascii"),
        )

    return Response(content=image_bytes, media_type="image/jpeg")


@router.post("/start", response_model=OrbitStartResponse)
def start_orbit_game(payload: OrbitStartRequest):
    game_id = str(random.randint(100000, 999999))
    orbit_games[game_id] = {
        "correct_lat": payload.lat,
        "correct_lon": payload.lon,
        "finished": False,
    }
    return OrbitStartResponse(id=game_id, correct_lat=payload.lat, correct_lon=payload.lon)


@router.post("/guess", response_model=OrbitGuessResult)
def submit_orbit_guess(payload: OrbitGuessRequest):
    game = orbit_games.get(payload.id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    distance_km = _calculate_distance_km(
        payload.lat,
        payload.lon,
        float(game["correct_lat"]),
        float(game["correct_lon"]),
    )
    score = _score_from_distance(distance_km)

    game["finished"] = True
    return OrbitGuessResult(
        score=score,
        distance=round(distance_km, 2),
        correct_lat=float(game["correct_lat"]),
        correct_lon=float(game["correct_lon"]),
        finished=True,
    )


def _calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def _score_from_distance(distance_km: float) -> int:
    if distance_km < 100:
        return 5000
    if distance_km < 500:
        return 3000
    if distance_km < 2000:
        return 1000
    return 0
