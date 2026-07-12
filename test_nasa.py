import random
from io import BytesIO
import math
import requests
from PIL import Image
from global_land_mask import globe

# ----------------------------
# Настройки
# ----------------------------

WIDTH = 1024
HEIGHT = 1024

# Размер области (примерно 2500 км)
SIZE_KM = 5000
half_size = SIZE_KM / 2

LAYERS = [
    "MODIS_Terra_CorrectedReflectance_TrueColor",
    "MODIS_Aqua_CorrectedReflectance_TrueColor",
    "VIIRS_SNPP_CorrectedReflectance_TrueColor",
]


def find_land_point():
    while True:
        lat = random.uniform(-89.5, 89.5)
        lon = random.uniform(-179.5, 179.5)
        if globe.is_land(lat, lon):
            return lat, lon


def is_mostly_black(image_bytes, threshold=0.08):
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            gray = img.convert("L")
            pixels = list(gray.getdata())
            if not pixels:
                return True
            dark_pixels = sum(1 for pixel in pixels if pixel < 25)
            return dark_pixels / len(pixels) > threshold
    except Exception:
        return True


def fetch_image(lat, lon, layer):
    delta_lat = half_size / 111
    delta_lon = half_size / (111 * math.cos(math.radians(lat)))

    bbox = (
        f"{lon - delta_lon},"
        f"{lat - delta_lat},"
        f"{lon + delta_lon},"
        f"{lat + delta_lat}"
    )

    url = (
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"
        "SERVICE=WMS&"
        "REQUEST=GetMap&"
        "VERSION=1.3.0&"
        f"LAYERS={layer}&"
        "FORMAT=image/jpeg&"
        "CRS=EPSG:4326&"
        "TIME=2023-01-01&"
        f"BBOX={bbox}&"
        f"WIDTH={WIDTH}&"
        f"HEIGHT={HEIGHT}"
    )

    response = requests.get(url, timeout=20)
    response.raise_for_status()
    return response


for attempt in range(6):
    lat, lon = find_land_point()
    print(f"Попытка {attempt + 1}: lat={lat:.5f}, lon={lon:.5f}")

    for layer in LAYERS:
        try:
            response = fetch_image(lat, lon, layer)
        except Exception as exc:
            print(f"  {layer}: ошибка запроса -> {exc}")
            continue

        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type:
            print(f"  {layer}: ответ не является изображением: {content_type}")
            continue

        if is_mostly_black(response.content):
            print(f"  {layer}: изображение почти чёрное, пробуем другое")
            continue

        with open("test.jpg", "wb") as f:
            f.write(response.content)

        print(f"  {layer}: изображение сохранено как test.jpg")
        break
    else:
        continue

    break
else:
    print("Не удалось получить нормальное изображение после нескольких попыток")