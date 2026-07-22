"""Presentation layer for Orbit-game textual hints."""

from app.services.geo_metadata_service import get_geo_metadata


def build_orbit_hint_facts(
    latitude: float,
    longitude: float,
    layer: str | None,
    acquisition_date: str | None,
) -> list[str]:
    """Build user-facing facts without exposing the answer coordinates."""
    metadata = get_geo_metadata(latitude, longitude, layer, acquisition_date)
    facts = [
        f"Satellite: {metadata.satellite}",
        (
            f"Acquisition: {metadata.acquisition_date} UTC"
            if metadata.acquisition_date != "Latest available"
            else "Acquisition: Latest available"
        ),
        f"Continent: {metadata.continent or 'Unknown'}",
        f"Surface: {metadata.surface_type or 'Unknown'}",
        f"Elevation: {f'{metadata.elevation_m} m' if metadata.elevation_m is not None else 'Unknown'}",
        (
            f"Distance to coast: ≈{metadata.distance_to_coast_km} km"
            if metadata.distance_to_coast_km is not None
            else "Distance to coast: Unknown"
        ),
        f"Hemisphere: {metadata.hemisphere}",
    ]
    return facts
