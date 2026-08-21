import math
import random
from datetime import datetime
from io import BytesIO
from typing import Any
from xml.etree import ElementTree as ET

import requests
from global_land_mask import globe
from PIL import Image


class NasaImageFetchError(Exception):
    """Raised when no valid satellite image could be fetched after all attempts."""


class NasaService:
    """Fetches satellite imagery from NASA GIBS WMS — images stay in memory only."""

    WMS_BASE_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
    
    METADATA_API_URL = "https://cmr.earthdata.nasa.gov/search/granules.atom"

    DEFAULT_LAYERS = [
        "MODIS_Terra_CorrectedReflectance_TrueColor",
        "MODIS_Aqua_CorrectedReflectance_TrueColor",
        "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    ]

    LAYER_COLLECTIONS = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": [
        ("MOD02QKM", "6.1"),
        ("MOD02HKM", "6.1"),
        ("MOD021KM", "6.1"),
    ],
    "MODIS_Aqua_CorrectedReflectance_TrueColor": [
        ("MYD02QKM", "6.1"),
        ("MYD02HKM", "6.1"),
        ("MYD021KM", "6.1"),
    ],
    "VIIRS_SNPP_CorrectedReflectance_TrueColor": [
        ("VNP02IMG_NRT", "2"),
        ("VNP02MOD_NRT", "2"),
    ],
    }

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
        use_metadata_api: bool = True,
        
    ) -> None:
        self.width = width
        self.height = height
        self.half_size_km = size_km / 2
        self.layers = layers or list(self.DEFAULT_LAYERS)
        self.image_date = image_date
        self.max_attempts = max_attempts
        self.session = requests.Session()
        self.request_timeout = request_timeout
        self.black_threshold = black_threshold
        self.use_metadata_api = use_metadata_api  # Включить двухэтапный запрос

    def get_random_satellite_image(self) -> tuple[bytes, dict[str, Any]]:
        """
        Fetch a random land-based satellite JPEG from NASA GIBS.
        Если use_metadata_api=True, использует двухэтапный запрос:
        1. Получает метаданные с датой съемки из XML
        2. Получает изображение с использованием полученной даты

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
        """Try one randomly selected GIBS layer at the given point."""
        bbox = self._build_bbox(lat, lon)

        layer = random.choice(self.layers)
        print(f"Selected layer: {layer}")

        image_date = self.image_date

        if self.use_metadata_api:
            fresh_date = self._fetch_metadata_xml(
                lat,
                lon,
                layer,
            )
            if fresh_date:
                image_date = fresh_date

        print(f"Date to use: {image_date}")

        image_bytes = self._fetch_layer_image(
            layer,
            bbox,
            image_date,
        )

        if image_bytes is None:
            print("GIBS: image not found")
            return None

        if self._is_mostly_black(image_bytes):
            print("GIBS: image is mostly black")
            return None

        metadata = {
            "latitude": lat,
            "longitude": lon,
            "layer": layer,
            "date": image_date,
            "bbox": bbox,
        }

        return image_bytes, metadata

    def _fetch_metadata_xml(self, lat: float, lon: float, layer: str) -> str | None:
        collections = self.LAYER_COLLECTIONS.get(layer)

        if not collections:
            return None

        for short_name, version in collections:
            try:
                params = {
                    "short_name": short_name,
                    "version": version,
                    "point": f"{lon},{lat}",
                    "page_size": 1,
                    "sort_key": "-start_date",
                }

                response = self.session.get(
                    self.METADATA_API_URL,
                    params=params,
                    timeout=self.request_timeout,
                )

                response.raise_for_status()

                print("CMR URL:", response.url)
                print("CMR Status:", response.status_code)

                root = ET.fromstring(response.content)

                namespace = {
                    "atom": "http://www.w3.org/2005/Atom",
                    "time": "http://a9.com/-/opensearch/extensions/time/1.0/",
                }

                entry = root.find(".//atom:entry", namespace)

                if entry is None:
                    print(f"CMR: {short_name} image not found")
                    continue

                start_time = entry.find("time:start", namespace)

                if start_time is not None and start_time.text:
                    date = start_time.text[:10]

                    print(f"CMR acquisition date ({short_name}): {date}")

                    return date

            except requests.RequestException as e:
                print(f"CMR REQUEST ERROR ({short_name}):", e)

            except ET.ParseError as e:
                print(f"CMR XML PARSE ERROR ({short_name}):", e)

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

    def _build_wms_url(self, layer: str, bbox: str, image_date: str | None = None) -> str:
        """Construct the NASA GIBS GetMap request URL."""
        date_to_use = image_date or self.image_date
        return (
            f"{self.WMS_BASE_URL}?"
            "SERVICE=WMS&"
            "REQUEST=GetMap&"
            "VERSION=1.3.0&"
            f"LAYERS={layer}&"
            "FORMAT=image/jpeg&"
            "CRS=EPSG:4326&"
            f"TIME={date_to_use}&"
            f"BBOX={bbox}&"
            f"WIDTH={self.width}&"
            f"HEIGHT={self.height}"
        )

    def _fetch_layer_image(self, layer: str, bbox: str, image_date: str | None = None) -> bytes | None:
        """Request a single layer; return JPEG bytes or None on failure."""
       
        date_to_use = image_date or self.image_date
        url = self._build_wms_url(layer, bbox, date_to_use)

        try:
            response = self.session.get(url, timeout=self.request_timeout)
            response.raise_for_status()
        except requests.RequestException:
            return None

        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type:
            return None

        return response.content

    def _is_mostly_black(self, image_bytes: bytes) -> bool:
        """Reject images that are mostly dark."""
        try:
            with Image.open(BytesIO(image_bytes)) as img:
                gray = img.convert("L")

                
                gray.thumbnail((128, 128))

                pixels = list(gray.getdata())

                if not pixels:
                    return True

                dark_pixels = sum(1 for pixel in pixels if pixel < 25)

                return dark_pixels / len(pixels) > self.black_threshold

        except Exception:
            return True


nasa_service = NasaService()

