import math
import random
from io import BytesIO
from typing import Any

import requests
from global_land_mask import globe
from PIL import Image


class NasaImageFetchError(Exception):
    """Raised when no valid satellite image could be fetched after all attempts."""


class NasaService:
    """Fetches satellite imagery from NASA GIBS WMS — images stay in memory only."""

    WMS_BASE_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"

    DEFAULT_LAYERS = [
        "MODIS_Terra_CorrectedReflectance_TrueColor",
        "MODIS_Aqua_CorrectedReflectance_TrueColor",
        "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    ]

    def __init__(
        self,
        width: int = 1024,
        height: int = 1024,
        size_km: int = 3000,
        layers: list[str] | None = None,
        image_date: str = "default",
        max_attempts: int = 6,
        request_timeout: int = 20,
        black_threshold: float = 0.08,
    ) -> None:
        self.width = width
        self.height = height
        self.half_size_km = size_km / 2
        self.layers = layers or list(self.DEFAULT_LAYERS)
        self.image_date = image_date
        self.max_attempts = max_attempts
        self.request_timeout = request_timeout
        self.black_threshold = black_threshold

    def get_random_satellite_image(self) -> tuple[bytes, dict[str, Any]]:
        """
        Fetch a random land-based satellite JPEG from NASA GIBS.

        Returns:
            (image_bytes, metadata) where metadata includes latitude, longitude,
            layer, date, and bbox.
        """
        for _ in range(self.max_attempts):
            lat, lon = self._find_land_point()
            result = self._try_layers_at_point(lat, lon)
            if result is not None:
                return result

        raise NasaImageFetchError(
            f"Failed to fetch a valid satellite image after {self.max_attempts} attempts"
        )

    def _find_land_point(self) -> tuple[float, float]:
        """Pick a random coordinate known to be on land."""
        while True:
            lat = random.uniform(-89.5, 89.5)
            lon = random.uniform(-179.5, 179.5)
            if globe.is_land(lat, lon):
                return lat, lon

    def _try_layers_at_point(self, lat: float, lon: float) -> tuple[bytes, dict[str, Any]] | None:
        """Try each GIBS layer at the given point; return the first valid image."""
        bbox = self._build_bbox(lat, lon)

        for layer in self.layers:
            image_bytes = self._fetch_layer_image(layer, bbox)
            if image_bytes is None:
                continue
            if self._is_mostly_black(image_bytes):
                continue

            metadata = {
                "latitude": lat,
                "longitude": lon,
                "layer": layer,
                "date": self.image_date,
                "bbox": bbox,
            }
            return image_bytes, metadata

        return None

    def _build_bbox(self, lat: float, lon: float) -> str:
        """Build an EPSG:4326 WMS BBOX string for the configured area size."""
        delta_lat = self.half_size_km / 111
        delta_lon = self.half_size_km / (111 * math.cos(math.radians(lat)))

        return (
            f"{lat - delta_lat},"
            f"{lon - delta_lon},"
            f"{lat + delta_lat},"
            f"{lon + delta_lon}"
            )

    def _build_wms_url(self, layer: str, bbox: str) -> str:
        """Construct the NASA GIBS GetMap request URL."""
        return (
            f"{self.WMS_BASE_URL}?"
            "SERVICE=WMS&"
            "REQUEST=GetMap&"
            "VERSION=1.3.0&"
            f"LAYERS={layer}&"
            "FORMAT=image/jpeg&"
            "CRS=EPSG:4326&"
            f"TIME={self.image_date}&"
            f"BBOX={bbox}&"
            f"WIDTH={self.width}&"
            f"HEIGHT={self.height}"
        )

    def _fetch_layer_image(self, layer: str, bbox: str) -> bytes | None:
        """Request a single layer; return JPEG bytes or None on failure."""
        url = self._build_wms_url(layer, bbox)

        try:
            response = requests.get(url, timeout=self.request_timeout)
            response.raise_for_status()
        except requests.RequestException:
            return None

        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type:
            return None

        return response.content

    def _is_mostly_black(self, image_bytes: bytes) -> bool:
        """Reject images that are mostly dark (cloud gaps, missing tiles, etc.)."""
        try:
            with Image.open(BytesIO(image_bytes)) as img:
                gray = img.convert("L")
                pixels = list(gray.getdata())
                if not pixels:
                    return True
                dark_pixels = sum(1 for pixel in pixels if pixel < 25)
                return dark_pixels / len(pixels) > self.black_threshold
        except Exception:
            return True


nasa_service = NasaService()
