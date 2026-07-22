"""ESA WorldCover land-cover provider.

Reads a single pixel value directly from the public ESA WorldCover Cloud
Optimized GeoTIFFs hosted on AWS Open Data (s3://esa-worldcover/), via HTTPS
range requests (GDAL /vsicurl/). No authentication required — the bucket is
public. WMS is intentionally NOT used here: Terrascope's own documentation
states the WMS only serves rendered RGB images and is "not suitable for
analysis" — reading class values from pixel colors would be guesswork.
"""

import math

import rasterio

_BASE_URL = (
    "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
    "v200/2021/map"
)
_FILENAME_TEMPLATE = "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"

# Official 11-class legend, ESA WorldCover 10 m v200 (2021)
# https://esa-worldcover.org/en
_LEGEND: dict[int, str] = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare / sparse vegetation / Desert",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen",
}

# Dataset coverage: -60 to 83 degrees latitude, global longitude
_MIN_LAT = -60.0
_MAX_LAT = 83.0


def _tile_name(latitude: float, longitude: float) -> str:
    """Build the 3x3 degree tile id (e.g. 'S48E036') for a coordinate."""
    tile_lat = math.floor(latitude / 3) * 3
    tile_lon = math.floor(longitude / 3) * 3

    lat_prefix = "N" if tile_lat >= 0 else "S"
    lon_prefix = "E" if tile_lon >= 0 else "W"

    return f"{lat_prefix}{abs(tile_lat):02d}{lon_prefix}{abs(tile_lon):03d}"


def get_surface_type(latitude: float, longitude: float) -> str | None:
    """Return the ESA WorldCover 2021 (v200) land-cover class at a coordinate.

    Returns None if the coordinate falls outside the dataset's coverage,
    or if the pixel could not be read (e.g. network failure, no-data pixel).
    """
    if not (_MIN_LAT <= latitude <= _MAX_LAT):
        return None

    tile = _tile_name(latitude, longitude)
    url = f"{_BASE_URL}/{_FILENAME_TEMPLATE.format(tile=tile)}"

    try:
        with rasterio.open(url) as dataset:
            row, col = dataset.index(longitude, latitude)
            window = ((row, row + 1), (col, col + 1))
            value = dataset.read(1, window=window)[0][0]
    except Exception:
        return None

    return _LEGEND.get(int(value))
