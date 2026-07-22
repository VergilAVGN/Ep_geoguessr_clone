"""Small resilient client for terrain elevation."""

from typing import Final

import requests


ELEVATION_URL: Final = "https://api.open-meteo.com/v1/elevation"


def get_elevation_m(latitude: float, longitude: float) -> int | None:
    """Return terrain elevation in metres, or None when the API is unavailable."""
    try:
        response = requests.get(
            ELEVATION_URL,
            params={"latitude": latitude, "longitude": longitude},
            timeout=3,
        )
        response.raise_for_status()
        elevations = response.json().get("elevation", [])
        if not elevations or elevations[0] is None:
            return None
        return round(float(elevations[0]))
    except (requests.RequestException, TypeError, ValueError, IndexError):
        return None
