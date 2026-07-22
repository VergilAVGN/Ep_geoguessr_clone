"""Approximate distance from a land point to the coast using a local land mask."""

from math import inf

from geopy.distance import distance
from global_land_mask import globe


def get_distance_to_coast_km(latitude: float, longitude: float) -> int | None:
    """Return an approximately nearest coast distance, rounded to 10 km.

    The global land mask is deliberately sampled rather than downloaded as a
    large geometry dataset. This is suitable for a game hint, not surveying.
    """
    if not globe.is_land(latitude, longitude):
        return None

    closest_km = inf
    for bearing in range(0, 360, 15):
        previous_km = 0
        for current_km in range(25, 2_025, 25):
            point = distance(kilometers=current_km).destination((latitude, longitude), bearing=bearing)
            if globe.is_land(point.latitude, point.longitude):
                previous_km = current_km
                continue

            # Refine the first land-to-water crossing on this bearing.
            low, high = previous_km, current_km
            for _ in range(5):
                middle = (low + high) / 2
                middle_point = distance(kilometers=middle).destination(
                    (latitude, longitude), bearing=bearing
                )
                if globe.is_land(middle_point.latitude, middle_point.longitude):
                    low = middle
                else:
                    high = middle
            closest_km = min(closest_km, high)
            break

    return None if closest_km == inf else round(closest_km / 10) * 10
