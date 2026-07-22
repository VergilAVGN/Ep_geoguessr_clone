"""Reverse-geocode a coordinate to a continent.

Nominatim is used sparingly: results are cached for the process lifetime and
the caller has a graceful fallback when the public service is unavailable.
"""

from functools import lru_cache
from typing import Final

import requests
from pycountry_convert import (
    country_alpha2_to_continent_code,
    country_alpha2_to_country_name,
)


NOMINATIM_URL: Final = "https://nominatim.openstreetmap.org/reverse"
CONTINENT_NAMES: Final = {
    "AF": "Africa",
    "AN": "Antarctica",
    "AS": "Asia",
    "EU": "Europe",
    "NA": "North America",
    "OC": "Oceania",
    "SA": "South America",
}


@lru_cache(maxsize=2_000)
def get_continent(latitude: float, longitude: float) -> str | None:
    """Resolve a continent for land coordinates using Nominatim's country code."""
    try:
        response = requests.get(
            NOMINATIM_URL,
            params={
                "format": "jsonv2",
                "lat": latitude,
                "lon": longitude,
                "zoom": 3,
                "addressdetails": 1,
            },
            headers={"User-Agent": "orbit-geoguessr-clone/1.0"},
            timeout=3,
        )
        response.raise_for_status()
        country_code = response.json().get("address", {}).get("country_code", "").upper()
        continent_code = country_alpha2_to_continent_code(country_code)
        return CONTINENT_NAMES.get(continent_code)
    except (requests.RequestException, KeyError, TypeError, ValueError):
        return None
