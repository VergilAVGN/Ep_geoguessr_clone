# EarthGuessr

> Gra geolokalizacyjna inspirowana GeoGuessr, oparta na zdjęciach satelitarnych i zbudowana w FastAPI, Jinja2, Leaflet oraz z użyciem danych NASA.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet.js-199900?style=flat&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

🇬🇧 [English version](README.md)

EarthGuessr polega na odgadywaniu lokalizacji na podstawie prawdziwego zdjęcia satelitarnego. Aktualnie dostępny tryb gry, **Orbit Game**, korzysta ze zdjęć NASA GIBS i składa się z pięciu rund z interaktywną mapą, punktacją oraz ekranem końcowych wyników.

## Funkcje

- Losowe zdjęcia lądu z NASA GIBS WMS: MODIS Terra, MODIS Aqua i VIIRS SNPP.
- Pięć rund Orbit Game z punktacją zależną od odległości.
- Mapa Leaflet i OpenStreetMap z jednym znacznikiem na rundę.
- Dwa opcjonalne, niezależnie konfigurowane typy podpowiedzi:
  - **Circle Hint** — obszar o promieniu 3 000 km na mapie.
  - **Scan** — dane satelitarne i geograficzne w stylu terminala.
- Dane Scan: satelita, data pozyskania, kontynent, klasa powierzchni ESA WorldCover, wysokość, przybliżona odległość od wybrzeża i półkula.
- Końcowy ekran wyników z każdą próbą, właściwą pozycją, odległością, punktami i oceną gwiazdkową.
- Obsługa Dockera i endpoint health check.

## Technologie

| Obszar | Narzędzia |
| --- | --- |
| Backend | Python 3.12, FastAPI, Pydantic, Uvicorn |
| Frontend | Jinja2, vanilla JavaScript, własny CSS |
| Mapy | Leaflet, OpenStreetMap |
| Zdjęcia satelitarne | NASA GIBS WMS |
| Dane geograficzne | Open-Meteo, Nominatim, ESA WorldCover, global-land-mask |
| Obsługa obrazów | Pillow, Rasterio |
| Wdrożenie | Docker i Docker Compose |

## Szybki start

### Docker

```bash
docker compose up --build
```

Otwórz [http://localhost:8000](http://localhost:8000).

Zatrzymanie aplikacji:

```bash
docker compose down
```

### Uruchomienie lokalne w Pythonie

Wymagany jest Python 3.12 lub nowszy.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Otwórz [http://localhost:8000](http://localhost:8000).

## Jak działa Orbit Game

1. Serwer wybiera losowy punkt na lądzie i pobiera zdjęcie satelitarne z NASA GIBS.
2. Gracz umieszcza znacznik na mapie świata i wysyła odpowiedź.
3. Backend oblicza odległość od właściwej pozycji i przyznaje punkty.
4. Po pięciu rundach gra wyświetla szczegółowy ekran wyników.

Maksymalny wynik sesji to **25 000 punktów**.

| Odległość od prawidłowej lokalizacji | Punkty |
| --- | ---: |
| Poniżej 100 km | 5 000 |
| Poniżej 500 km | 3 000 |
| Poniżej 2 000 km | 1 000 |
| 2 000 km lub więcej | 0 |

## Podpowiedzi

Strona Settings pozwala niezależnie włączać typy podpowiedzi. Gracz może używać samego koła, samego Scan, obu lub żadnego z nich.

Każdą podpowiedź można użyć raz na rundę; w następnej rundzie jest znowu dostępna.

Panel Scan celowo nie ujawnia współrzędnych odpowiedzi. Pokazuje jedynie metadane pomocne w odgadnięciu lokalizacji.

## API

| Endpoint | Opis |
| --- | --- |
| `GET /api/orbit/random` | Pobiera losowe zdjęcie satelitarne i metadane. |
| `POST /api/orbit/start` | Rozpoczyna lub kontynuuje rundę Orbit Game. |
| `POST /api/orbit/guess` | Wysyła zgadywane współrzędne. |
| `GET /api/orbit/hint/{id}` | Pobiera Circle Hint. |
| `GET /api/orbit/hint/{id}/data` | Uruchamia geograficzny Scan. |
| `GET /api/orbit/{id}/results` | Pobiera końcowe wyniki po piątej rundzie. |
| `GET /api/settings` | Odczytuje ustawienia gry. |
| `PUT /api/settings` | Aktualizuje ustawienia gry. |

Interaktywna dokumentacja API jest dostępna po uruchomieniu aplikacji pod adresem [http://localhost:8000/docs](http://localhost:8000/docs).

## Struktura projektu

```text
app/
├── routers/                 # endpointy FastAPI
├── schemas/                 # modele żądań i odpowiedzi Pydantic
├── services/
│   ├── nasa_service.py      # zapytania do NASA GIBS
│   ├── hints_orbit_service.py
│   ├── geo_metadata_service.py
│   └── geo/                 # dane o wysokości, wybrzeżu, kontynencie i powierzchni
├── static/                  # CSS i JavaScript
└── templates/               # strony i partiale Jinja2
tests/                       # testy API i podpowiedzi
```

## Zrzuty ekranu

| Strona główna | Orbit Game |
| --- | --- |
| ![Strona główna EarthGuessr](app/docs/screenshot/Main.png) | ![Runda Orbit Game](app/docs/screenshot/orbit-rounds.png) |

| Circle Hint | Skan geograficzny |
| --- | --- |
| ![Circle Hint na mapie](app/docs/screenshot/orbit-circle-hint.png) | ![Skan geograficzny w stylu terminala](app/docs/screenshot/orbit-scan.png) |

![Końcowe wyniki ze wszystkimi rundami na mapie](app/docs/screenshot/orbit-results.png)

## Testy

```bash
python -m pytest tests/ -q
```

## Uwagi

- NASA GIBS, OpenStreetMap, Open-Meteo, Nominatim i ESA WorldCover wymagają dostępu do sieci.
- ESA WorldCover jest produktem klasyfikacji pokrycia terenu. Klasa `Bare / sparse vegetation / Desert` nie jest obserwacją w czasie rzeczywistym dla daty zdjęcia satelitarnego.

## Autor

Rostyslav Chabanets · Projekt portfolio · 2026

Szczegółowa instrukcja uruchomienia po angielsku: [Launch_README_eng.md](Launch_README_eng.md).
