from fastapi import APIRouter, HTTPException

from app.schemas.game import GameOut, GuessCreate
from app.services.game_service import game_service

router = APIRouter(prefix="/api/games", tags=["games"])


@router.post("", response_model=GameOut)
def create_game():
    return game_service.create_game()


@router.get("/{game_id}", response_model=GameOut)
def get_game(game_id: str):
    game = game_service.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("/{game_id}/guess", response_model=GameOut)
def submit_guess(game_id: str, guess: GuessCreate):
    try:
        return game_service.submit_guess(game_id, guess.lat, guess.lon)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
