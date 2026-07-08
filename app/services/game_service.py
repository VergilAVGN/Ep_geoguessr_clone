import math
import random
from typing import Dict, Optional

from app.schemas.game import GameInternal, GameOut, TargetInternal, TargetOut


class GameService:
    def __init__(self) -> None:
        self.locations = [
            {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
            {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
            {"name": "New York", "lat": 40.7128, "lon": -74.0060},
            {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
            {"name": "Moscow", "lat": 55.7558, "lon": 37.6173},
        ]
        self.games: Dict[str, GameInternal] = {}

    def create_game(self) -> GameOut:
        target = TargetInternal(**random.choice(self.locations))
        game_id = str(random.randint(100000, 999999))
        game = GameInternal(
            id=game_id,
            status="active",
            target=target,
            score=0,
        )
        self.games[game_id] = game
        return self._to_public_game(game)

    def get_game(self, game_id: str) -> Optional[GameOut]:
        game = self.games.get(game_id)
        if not game:
            return None
        return self._to_public_game(game)

    def submit_guess(self, game_id: str, lat: float, lon: float) -> GameOut:
        game = self.games.get(game_id)
        if not game:
            raise ValueError("Game not found")

        distance_km = self._calculate_distance_km(lat, lon, game.target.lat, game.target.lon)
        score = self._score_from_distance(distance_km)

        game.score = score
        game.last_guess = {"lat": lat, "lon": lon}
        game.distance_km = round(distance_km, 2)
        game.status = "finished"

        return self._to_public_game(game)

    def _calculate_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius = 6371
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)

        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius * c

    def _score_from_distance(self, distance_km: float) -> int:
        if distance_km < 100:
            return 5000
        if distance_km < 500:
            return 3000
        if distance_km < 2000:
            return 1000
        return 0

    def _to_public_game(self, game: GameInternal) -> GameOut:
        return GameOut(
            id=game.id,
            status=game.status,
            target=TargetOut(name=game.target.name),
            score=game.score,
            last_guess=game.last_guess,
            distance_km=game.distance_km,
        )


game_service = GameService()
