import base64
import math
import random
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas.orbit import (
    OrbitGameResults,
    OrbitGuessRequest,
    OrbitGuessResult,
    OrbitImageResponse,
    OrbitMetadata,
    OrbitRoundSummary,
    OrbitStartRequest,
    OrbitStartResponse,
)
from app.services.nasa_service import NasaImageFetchError, nasa_service

router = APIRouter(prefix="/api/orbit", tags=["orbit"])

TOTAL_ORBIT_ROUNDS = 5
MAX_SCORE_PER_ROUND = 5000
orbit_games: dict[str, dict[str, object]] = {}


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
    game_id = payload.game_id or str(random.randint(100000, 999999))
    game = orbit_games.get(game_id)

    if game is None:
        game = {
            "round_number": 1,
            "total_rounds": TOTAL_ORBIT_ROUNDS,
            "total_score": 0,
            "finished": False,
            "correct_lat": payload.lat,
            "correct_lon": payload.lon,
            "completed_rounds": 0,
            "rounds": [],
        }
        orbit_games[game_id] = game
    else:
        if bool(game["finished"]):
            raise HTTPException(status_code=400, detail="Orbit game already finished")

        if int(game["completed_rounds"]) >= TOTAL_ORBIT_ROUNDS:
            game["finished"] = True
            raise HTTPException(status_code=400, detail="Orbit game already reached the last round")

        game["round_number"] = int(game["completed_rounds"]) + 1
        game["correct_lat"] = payload.lat
        game["correct_lon"] = payload.lon

    return OrbitStartResponse(
        id=game_id,
        correct_lat=float(game["correct_lat"]),
        correct_lon=float(game["correct_lon"]),
        round_number=int(game["round_number"]),
        total_rounds=int(game["total_rounds"]),
        total_score=int(game["total_score"]),
        finished=bool(game["finished"]),
    )


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
    round_number = int(game["round_number"])
    completed_rounds = int(game["completed_rounds"]) + 1
    total_score = int(game["total_score"]) + score
    game["completed_rounds"] = completed_rounds
    game["total_score"] = total_score
    game["finished"] = completed_rounds >= TOTAL_ORBIT_ROUNDS

    rounds = game.setdefault("rounds", [])
    rounds.append(
        {
            "round_number": round_number,
            "score": score,
            "distance": round(distance_km, 2),
            "guess_lat": payload.lat,
            "guess_lon": payload.lon,
            "correct_lat": float(game["correct_lat"]),
            "correct_lon": float(game["correct_lon"]),
        }
    )

    return OrbitGuessResult(
        score=score,
        distance=round(distance_km, 2),
        correct_lat=float(game["correct_lat"]),
        correct_lon=float(game["correct_lon"]),
        finished=bool(game["finished"]),
        round_number=round_number,
        total_rounds=TOTAL_ORBIT_ROUNDS,
        game_finished=bool(game["finished"]),
        total_score=total_score,
    )


@router.get("/{game_id}/results", response_model=OrbitGameResults)
def get_orbit_results(game_id: str):
    game = orbit_games.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    completed_rounds = int(game.get("completed_rounds", 0))
    if completed_rounds < TOTAL_ORBIT_ROUNDS:
        raise HTTPException(status_code=400, detail="Game is not finished yet")

    total_score = int(game["total_score"])
    max_score = TOTAL_ORBIT_ROUNDS * MAX_SCORE_PER_ROUND
    rounds = [
        OrbitRoundSummary(**round_data)
        for round_data in game.get("rounds", [])
    ]

    return OrbitGameResults(
        id=game_id,
        total_score=total_score,
        max_score=max_score,
        total_rounds=TOTAL_ORBIT_ROUNDS,
        stars=_stars_from_score(total_score, max_score),
        rounds=rounds,
    )


def _stars_from_score(total_score: int, max_score: int) -> int:
    if max_score <= 0:
        return 0

    ratio = total_score / max_score
    if ratio >= 0.9:
        return 5
    if ratio >= 0.7:
        return 4
    if ratio >= 0.5:
        return 3
    if ratio >= 0.3:
        return 2
    if ratio > 0:
        return 1
    return 0


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
