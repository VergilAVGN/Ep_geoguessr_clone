"""Collect location facts used by Orbit-game hints."""

from dataclasses import dataclass

from app.services.geo.continent_service import get_continent
from app.services.geo.coastline_service import get_distance_to_coast_km
from app.services.geo.elevation_client import get_elevation_m
from app.services.geo.landcover_service import get_surface_type


@dataclass(frozen=True)
class GeoMetadata:
    satellite: str
    acquisition_date: str
    continent: str | None
    elevation_m: int | None
    distance_to_coast_km: int | None
    surface_type: str | None
    hemisphere: str


def satellite_name_for_layer(layer: str | None) -> str:
    if not layer:
        return "Unknown"
    if "MODIS_Terra" in layer:
        return "Terra (MODIS)"
    if "MODIS_Aqua" in layer:
        return "Aqua (MODIS)"
    if "VIIRS_SNPP" in layer:
        return "Suomi NPP (VIIRS)"
    return layer.replace("_", " ")


def get_geo_metadata(
    latitude: float,
    longitude: float,
    layer: str | None,
    acquisition_date: str | None,
) -> GeoMetadata:
    return GeoMetadata(
        satellite=satellite_name_for_layer(layer),
        acquisition_date=(
            acquisition_date if acquisition_date and acquisition_date != "default" else "Latest available"
        ),
        continent=get_continent(latitude, longitude),
        elevation_m=get_elevation_m(latitude, longitude),
        distance_to_coast_km=get_distance_to_coast_km(latitude, longitude),
        surface_type=get_surface_type(latitude, longitude),
        hemisphere="Northern" if latitude >= 0 else "Southern",
    )
