import random

from geopy.distance import distance

HINT_RADIUS_KM = 3000
HINT_MAX_SHIFT_KM = 2400


def generate_hint(target_lat: float, target_lon: float) -> tuple[float, float, int]:
    """Generate a random hint circle center around target coordinates."""
    angle = random.uniform(0, 360)
    offset = random.uniform(0, HINT_MAX_SHIFT_KM)
    destination = distance(kilometers=offset).destination((target_lat, target_lon), bearing=angle)
    return destination.latitude, destination.longitude, HINT_RADIUS_KM
