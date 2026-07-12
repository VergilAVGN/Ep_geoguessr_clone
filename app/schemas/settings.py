from enum import Enum
from typing import Optional

from pydantic import BaseModel


class GameMode(str, Enum):
    classic = "classic"
    orbit = "orbit"


class Difficulty(str, Enum):
    easy = "easy"
    normal = "normal"
    hard = "hard"


class SettingsOut(BaseModel):
    mode: GameMode
    difficulty: Difficulty
    show_hints: bool
    map_source: str


class SettingsUpdate(BaseModel):
    mode: Optional[GameMode] = None
    difficulty: Optional[Difficulty] = None
    show_hints: Optional[bool] = None
    map_source: Optional[str] = None
